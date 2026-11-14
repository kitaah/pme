import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthenticatedUser } from '@pme/common';
import { DatabaseCircuitBreaker } from '../common/database-circuit-breaker';
import { PhotoStorageService, StoredPhoto } from '../storage/photo-storage.service';
import { CreateListingDto } from './create-listing.dto';
import { HandoverPlace, ListingCategory, ListingKind, ListingStatus } from './listing.enums';
import { Listing } from './listing.entity';
import { ListingEventsPublisher } from './listing-events.publisher';

/**
 * Annonce telle qu'elle est renvoyee au navigateur : le chemin de la photo dans le stockage
 * (`photoKey`) reste interne, le front ne recoit qu'une URL signee de courte duree.
 */
export type ListingView = Omit<Listing, 'photoKey' | 'photoMime'> & { photoUrl: string | null };

@Injectable()
export class ListingsService {
  private readonly logger = new Logger(ListingsService.name);

  constructor(
    @InjectRepository(Listing) private readonly repository: Repository<Listing>,
    private readonly publisher: ListingEventsPublisher,
    private readonly database: DatabaseCircuitBreaker,
    private readonly photos: PhotoStorageService,
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
    const stored = photo ? await this.photos.store(photo) : undefined;
    const listing = await this.save(user, dto, stored);

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
      this.repository.find({ where: { ownerId: user.id }, order: { createdAt: 'DESC' }, take: limit }),
    );
    // Les URL signees sont calculees localement (aucun appel au stockage) : les demander en
    // parallele evite malgre tout d'additionner les calculs de signature ligne apres ligne.
    return Promise.all(listings.map((listing) => this.toView(listing)));
  }

  private save(user: AuthenticatedUser, dto: CreateListingDto, photo?: StoredPhoto): Promise<Listing> {
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
            category: dto.category ?? ListingCategory.OTHER,
            kind,
            // Le prix n'est retenu que pour une vente : la contrainte chk_listings_price
            // refuserait un prix accompagnant un echange ou un don.
            priceCents: kind === ListingKind.SALE ? (dto.priceCents ?? null) : null,
            wantedInExchange: dto.wantedInExchange ?? null,
            handoverPlace: dto.handoverPlace ?? HandoverPlace.TO_AGREE,
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
    const view: ListingView = {
      ...listing,
      photoUrl: listing.photoKey ? await this.photos.signedUrl(listing.photoKey) : null,
    };
    // Le chemin dans le stockage ne sort pas de l'API : seule l'URL signee est utile au navigateur.
    delete (view as Partial<Listing>).photoKey;
    delete (view as Partial<Listing>).photoMime;
    return view;
  }
}
