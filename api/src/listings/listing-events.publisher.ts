import { Injectable, Logger } from '@nestjs/common';
import { NatsClient } from '@pme/common';
import { JetStreamClient } from 'nats';
import { LISTING_SUBMITTED_SUBJECT, ListingSubmittedEvent } from './listing-events';
import { Listing } from './listing.entity';

/** Delai maximal d'attente de l'accuse de reception du flux, et nouvelles tentatives. */
const PUBLISH_TIMEOUT_MS = 3000;
const PUBLISH_RETRIES = 2;
const RETRY_DELAY_MS = 300;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Publie les evenements metier dans NATS JetStream.
 * Un delai maximal et deux nouvelles tentatives remplacent le @Retry de Resilience4j
 * du projet Spring : un broker lent ne doit pas bloquer la requete HTTP.
 *
 * `msgID` vaut l'identifiant de l'annonce : dans la fenetre de deduplication du flux, NATS
 * ignore un message deja recu. Une publication rejouee ne cree donc pas de doublon.
 */
@Injectable()
export class ListingEventsPublisher {
  private readonly logger = new Logger(ListingEventsPublisher.name);

  constructor(private readonly nats: NatsClient) {}

  async publishSubmitted(listing: Listing): Promise<void> {
    const event: ListingSubmittedEvent = {
      listingId: listing.id,
      ownerId: listing.ownerId,
      ownerUsername: listing.ownerUsername,
      title: listing.title,
      description: listing.description,
      condition: listing.condition,
      kind: listing.kind,
      handoverPlace: listing.handoverPlace,
      submittedAt: listing.createdAt.toISOString(),
    };

    // Les champs facultatifs ne sont pas envoyes a vide : `undefined` disparait de la
    // representation JSON, et la validation a la reception les traite comme absents.
    if (listing.priceCents !== null) event.priceCents = listing.priceCents;
    if (listing.wantedInExchange !== null) event.wantedInExchange = listing.wantedInExchange;
    if (listing.photoKey !== null) event.photoKey = listing.photoKey;

    const jetstream = await this.nats.jetstream();
    await this.publishWithRetry(jetstream, event);
    this.logger.log(`Evenement ${LISTING_SUBMITTED_SUBJECT} publie pour l'annonce ${listing.id}`);
  }

  /** Recursion plutot qu'une boucle : chaque nouvelle tentative attend la precedente (voir RETRY_DELAY_MS). */
  private async publishWithRetry(jetstream: JetStreamClient, event: ListingSubmittedEvent, attempt = 0): Promise<void> {
    try {
      await jetstream.publish(LISTING_SUBMITTED_SUBJECT, JSON.stringify(event), {
        msgID: event.listingId,
        timeout: PUBLISH_TIMEOUT_MS,
      });
    } catch (error) {
      if (attempt >= PUBLISH_RETRIES) {
        throw error;
      }
      await sleep(RETRY_DELAY_MS);
      return this.publishWithRetry(jetstream, event, attempt + 1);
    }
  }
}
