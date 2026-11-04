import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom, retry, timeout } from 'rxjs';
import { Listing } from './listing.entity';
import { LISTING_SUBMITTED, ListingSubmittedEvent } from './listing-events';

export const RABBIT_CLIENT = 'RABBIT_CLIENT';

/**
 * Publie les evenements metier dans RabbitMQ.
 * Un delai maximal et deux nouvelles tentatives remplacent le @Retry de Resilience4j
 * du projet Spring : un broker lent ne doit pas bloquer la requete HTTP.
 */
@Injectable()
export class ListingEventsPublisher {
  private readonly logger = new Logger(ListingEventsPublisher.name);

  constructor(@Inject(RABBIT_CLIENT) private readonly client: ClientProxy) {}

  async publishSubmitted(listing: Listing): Promise<void> {
    const event: ListingSubmittedEvent = {
      listingId: listing.id,
      ownerId: listing.ownerId,
      ownerUsername: listing.ownerUsername,
      title: listing.title,
      description: listing.description,
      condition: listing.condition,
      submittedAt: listing.createdAt.toISOString(),
    };

    await lastValueFrom(
      this.client.emit(LISTING_SUBMITTED, event).pipe(timeout(3000), retry({ count: 2, delay: 300 })),
      { defaultValue: undefined },
    );
    this.logger.log(`Evenement ${LISTING_SUBMITTED} publie pour l'annonce ${listing.id}`);
  }
}
