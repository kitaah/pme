import { Injectable, Logger } from '@nestjs/common';
import { ConfirmChannel, LISTINGS_EXCHANGE, LISTING_SUBMITTED_ROUTING_KEY, RabbitMqClient } from '@pme/common';
import { LISTING_SUBMITTED_SUBJECT, ListingSubmittedEvent } from './listing-events';
import { ListingEventsPort } from './listing-events.port';
import { Listing } from './listing.entity';

/** Delai maximal d'attente de la confirmation du broker, et nouvelles tentatives. */
const PUBLISH_TIMEOUT_MS = 3000;
const PUBLISH_RETRIES = 2;
const RETRY_DELAY_MS = 300;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Publie les evenements metier dans RabbitMQ.
 * Un delai maximal et deux nouvelles tentatives remplacent le @Retry de Resilience4j
 * du projet Spring : un broker lent ne doit pas bloquer la requete HTTP.
 *
 * Le canal est a confirmations : la promesse n'aboutit qu'une fois le message pris en charge (et ecrit sur disque,
 * message persistant) par le broker. `messageId` vaut l'identifiant de l'annonce. Contrairement a NATS JetStream,
 * RabbitMQ n'ignore pas une publication rejouee : c'est la moderation qui detecte le doublon a la reception.
 */
@Injectable()
export class RabbitMqListingEventsPublisher implements ListingEventsPort {
  private readonly logger = new Logger(RabbitMqListingEventsPublisher.name);

  constructor(private readonly rabbit: RabbitMqClient) {}

  async publishSubmitted(listing: Listing): Promise<void> {
    const event: ListingSubmittedEvent = {
      listingId: listing.id,
      ownerId: listing.ownerId,
      ownerUsername: listing.ownerUsername,
      title: listing.title,
      description: listing.description,
      condition: listing.condition,
      category: listing.category.code,
      kind: listing.kind,
      handoverPlace: listing.handoverPlace.code,
      submittedAt: listing.createdAt.toISOString(),
    };

    // Les champs facultatifs ne sont pas envoyes a vide : `undefined` disparait de la
    // representation JSON, et la validation a la reception les traite comme absents.
    if (listing.priceCents !== null) event.priceCents = listing.priceCents;
    if (listing.wantedInExchange !== null) event.wantedInExchange = listing.wantedInExchange;
    if (listing.photoKey !== null) event.photoKey = listing.photoKey;

    await this.publishWithRetry(event);
    this.logger.log(`Evenement ${LISTING_SUBMITTED_SUBJECT} publie pour l'annonce ${listing.id}`);
  }

  /**
   * Recursion plutot qu'une boucle : chaque nouvelle tentative attend la precedente (voir RETRY_DELAY_MS).
   * Le canal est redemande a chaque tentative : si le precedent s'est ferme, une connexion neuve est ouverte.
   */
  private async publishWithRetry(event: ListingSubmittedEvent, attempt = 0): Promise<void> {
    try {
      await this.publishOnce(await this.rabbit.channel(), event);
    } catch (error) {
      if (attempt >= PUBLISH_RETRIES) {
        throw error;
      }
      await sleep(RETRY_DELAY_MS);
      return this.publishWithRetry(event, attempt + 1);
    }
  }

  private publishOnce(channel: ConfirmChannel, event: ListingSubmittedEvent): Promise<void> {
    const confirmed = new Promise<void>((resolve, reject) => {
      channel.publish(
        LISTINGS_EXCHANGE,
        LISTING_SUBMITTED_ROUTING_KEY,
        Buffer.from(JSON.stringify(event)),
        { persistent: true, contentType: 'application/json', messageId: event.listingId },
        (error) => {
          if (error) {
            reject(error instanceof Error ? error : new Error(String(error)));
          } else {
            resolve();
          }
        },
      );
    });
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Confirmation RabbitMQ non recue a temps')), PUBLISH_TIMEOUT_MS);
    });
    return Promise.race([confirmed, timeout]).finally(() => clearTimeout(timer));
  }
}
