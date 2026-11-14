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
  kind: string;
  /** Centimes, pour une vente seulement. */
  priceCents?: number;
  wantedInExchange?: string;
  handoverPlace: string;
  /**
   * Chemin de la photo dans le stockage objet, jamais le fichier : un message de flux reste
   * petit, et seul le coeur ecrit dans le stockage (relation 25 du C4 niveau 2). Le service de
   * moderation ne lit pas la photo dans le POC.
   */
  photoKey?: string;
  submittedAt: string;
}
