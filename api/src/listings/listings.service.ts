import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { CreateListingDto } from './create-listing.dto';
import { ListingStatus } from './listing.enums';
import { Listing } from './listing.entity';
import { ListingEventsPublisher } from './listing-events.publisher';

@Injectable()
export class ListingsService {
  private readonly logger = new Logger(ListingsService.name);

  constructor(
    @InjectRepository(Listing) private readonly repository: Repository<Listing>,
    private readonly publisher: ListingEventsPublisher,
  ) {}

  /**
   * Enregistre l'annonce "en attente de moderation" puis publie l'evenement.
   * L'API repond sans attendre la moderation : c'est le service separe qui la traite.
   * Si le broker est injoignable, l'annonce est retiree (compensation) et la requete
   * echoue en 503 : on ne laisse jamais une annonce en attente que personne ne verra passer.
   */
  async submit(user: AuthenticatedUser, dto: CreateListingDto): Promise<Listing> {
    const listing = await this.repository.save(
      this.repository.create({
        ownerId: user.id,
        ownerUsername: user.username,
        title: dto.title,
        description: dto.description,
        condition: dto.condition,
        status: ListingStatus.PENDING_MODERATION,
      }),
    );

    try {
      await this.publisher.publishSubmitted(listing);
    } catch (error) {
      this.logger.error(`Publication impossible pour l'annonce ${listing.id} : ${String(error)}`);
      // La compensation peut echouer a son tour (base elle aussi tombee). On la trace sans la
      // laisser remonter : sinon elle remplacerait le 503 explicite par un 500 opaque pour le membre.
      try {
        await this.repository.delete(listing.id);
      } catch (rollbackError) {
        this.logger.error(`Annonce ${listing.id} non retiree apres l'echec de publication : ${String(rollbackError)}`);
      }
      throw new ServiceUnavailableException(
        "La modération est momentanément indisponible, l'annonce n'a pas été enregistrée. Réessayez dans un instant.",
      );
    }
    return listing;
  }

  /** Les annonces les plus recentes du membre (pagination simple : jamais plus de `limit` lignes). */
  findByOwner(user: AuthenticatedUser, limit = 50): Promise<Listing[]> {
    return this.repository.find({ where: { ownerId: user.id }, order: { createdAt: 'DESC' }, take: limit });
  }
}
