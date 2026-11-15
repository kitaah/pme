import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthenticatedUser } from '@pme/common';
import { DatabaseCircuitBreaker } from '../common/database-circuit-breaker';
import { PhotoStorageService, StoredPhoto } from '../storage/photo-storage.service';
import { CreateListingDto } from './create-listing.dto';
import { ListingReferences, ListingReferencesService } from './listing-references.service';
import { ListingKind, ListingStatus } from './listing.enums';
import { Listing } from './listing.entity';
import { ListingEventsPublisher } from './listing-events.publisher';

/**
 * Annonce telle qu'elle est renvoyee au navigateur : le chemin de la photo dans le stockage
 * (`photoKey`) reste interne, le front ne recoit qu'une URL signee de courte duree.
 */
export type ListingView = Omit<Listing, 'photoKey' | 'photoMime' | 'category' | 'handoverPlace'> & {
  /** Code de la categorie (`FIGURINES`...) : le libelle vient de GET /api/v1/categories. */
  category: string;
  /** Lieu de remise avec son libelle : un lieu ferme depuis reste lisible sur les annonces qui l'ont. */
  handoverPlace: { code: string; label: string };
  photoUrl: string | null;
};

@Injectable()
export class ListingsService {
  private readonly logger = new Logger(ListingsService.name);

  constructor(
    @InjectRepository(Listing) private readonly repository: Repository<Listing>,
    private readonly publisher: ListingEventsPublisher,
    private readonly database: DatabaseCircuitBreaker,
    private readonly photos: PhotoStorageService,
    private readonly references: ListingReferencesService,
  ) {}

  /**
   * Enregistre l'annonce "en attente de moderation" puis publie l'evenement.
   * L'API repond sans attendre la moderation : c'est le service separe qui la traite.
   *
   * La photo est enregistree AVANT l'annonce : si le stockage refuse le fichier, rien n'est ecrit
   * en base. Si une etape ulterieure echoue, la photo deja enregistree est supprimee (compensation),
   * comme l'annonce elle-meme : on ne laisse ni annonce que personne ne verra passer, ni fichier
   * orphelin dans le stockage.
   */
  async submit(user: AuthenticatedUser, dto: CreateListingDto, photo?: Buffer): Promise<ListingView> {
    // La categorie est verifiee avant tout enregistrement : une photo n'est stockee que pour une demande recevable.
    const references = await this.references.resolve(dto);
    const stored = photo ? await this.photos.store(photo) : undefined;
    const listing = await this.save(user, dto, references, stored);

    try {
      await this.publisher.publishSubmitted(listing);
    } catch (error) {
      this.logger.error(`Publication impossible pour l'annonce ${listing.id} : ${String(error)}`);
      await this.compensate(listing, stored);
      throw new ServiceUnavailableException(
        "La modération est momentanément indisponible, l'annonce n'a pas été enregistrée. Réessayez dans un instant.",
      );
    }
    return this.toView(listing);
  }

  /** Les annonces les plus recentes du membre (pagination simple : jamais plus de `limit` lignes). */
  async findByOwner(user: AuthenticatedUser, limit = 50): Promise<ListingView[]> {
    const listings = await this.database.run(() =>
      this.repository.find({
        where: { ownerId: user.id },
        relations: { category: true, handoverPlace: true },
        order: { createdAt: 'DESC' },
        take: limit,
      }),
    );
    // Les URL signees sont calculees localement (aucun appel au stockage) : les demander en
    // parallele evite malgre tout d'additionner les calculs de signature ligne apres ligne.
    return Promise.all(listings.map((listing) => this.toView(listing)));
  }

  private save(
    user: AuthenticatedUser,
    dto: CreateListingDto,
    { category, handoverPlace }: ListingReferences,
    photo?: StoredPhoto,
  ): Promise<Listing> {
    const kind = dto.kind ?? ListingKind.EXCHANGE;
    return this.database
      .run(() =>
        this.repository.save(
          this.repository.create({
            ownerId: user.id,
            ownerUsername: user.username,
            title: dto.title,
            description: dto.description,
            condition: dto.condition,
            category,
            kind,
            // Le prix n'est retenu que pour une vente : la contrainte chk_listings_price
            // refuserait un prix accompagnant un echange ou un don.
            priceCents: kind === ListingKind.SALE ? (dto.priceCents ?? null) : null,
            wantedInExchange: dto.wantedInExchange ?? null,
            handoverPlace,
            photoKey: photo?.key ?? null,
            photoMime: photo?.mime ?? null,
            status: ListingStatus.PENDING_MODERATION,
          }),
        ),
      )
      .catch(async (error: unknown) => {
        if (photo) await this.photos.remove(photo.key);
        throw error;
      });
  }

  /**
   * Retire l'annonce et sa photo apres un echec de publication.
   * La compensation peut echouer a son tour (base elle aussi tombee). On la trace sans la laisser
   * remonter : sinon elle remplacerait le 503 explicite par un 500 opaque pour le membre.
   */
  private async compensate(listing: Listing, photo?: StoredPhoto): Promise<void> {
    try {
      await this.database.run(() => this.repository.delete(listing.id));
    } catch (rollbackError) {
      this.logger.error(`Annonce ${listing.id} non retiree apres l'echec de publication : ${String(rollbackError)}`);
    }
    if (photo) await this.photos.remove(photo.key);
  }

  private async toView(listing: Listing): Promise<ListingView> {
    const { category, handoverPlace, ...rest } = listing;
    const view = {
      ...rest,
      category: category.code,
      handoverPlace: { code: handoverPlace.code, label: handoverPlace.label },
      photoUrl: listing.photoKey ? await this.photos.signedUrl(listing.photoKey) : null,
    };
    // Le chemin dans le stockage ne sort pas de l'API : seule l'URL signee est utile au navigateur.
    delete (view as Partial<Pick<Listing, 'photoKey' | 'photoMime'>>).photoKey;
    delete (view as Partial<Pick<Listing, 'photoKey' | 'photoMime'>>).photoMime;
    return view;
  }
}
