/**
 * Contrat de l'evenement "annonce soumise", partage (par copie) avec le service de moderation.
 *
 * NATS JetStream remplace RabbitMQ : le sujet (`subject`) joue le role du nom de file, et le flux
 * (`stream`) celui du stockage durable. Flux et consommateur durable sont declares par le service
 * de moderation (moderation-service/src/moderation/nats-topology.ts) : l'API ne fait que publier.
 */
export const LISTING_SUBMITTED_SUBJECT = 'listing.submitted';
export const LISTING_SUBMITTED_DLQ_SUBJECT = 'listing.submitted.dlq';

/** Flux qui conserve les annonces soumises jusqu'a leur traitement par la moderation. */
export const LISTINGS_STREAM = 'LISTINGS';

export interface ListingSubmittedEvent {
  listingId: string;
  ownerId: string;
  ownerUsername: string;
  title: string;
  description: string;
  condition: string;
  submittedAt: string;
}
