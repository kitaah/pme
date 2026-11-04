/**
 * Contrat de l'evenement "annonce soumise", partage (par copie) avec le service de moderation.
 * Le nom du motif sert aussi de nom de file : une seule file durable, ce qui rend la
 * demonstration lisible dans l'interface RabbitMQ.
 */
export const LISTING_SUBMITTED = 'listing.submitted';
export const LISTING_SUBMITTED_QUEUE = 'listing.submitted';
export const LISTING_SUBMITTED_DLQ = 'listing.submitted.dlq';

export interface ListingSubmittedEvent {
  listingId: string;
  ownerId: string;
  ownerUsername: string;
  title: string;
  description: string;
  condition: string;
  submittedAt: string;
}

/**
 * Arguments de declaration de la file. Ils doivent etre IDENTIQUES chez le producteur et le
 * consommateur, sinon RabbitMQ refuse la redeclaration (PRECONDITION_FAILED).
 * Un message rejete par le consommateur est redirige vers la file `listing.submitted.dlq`
 * (declaree dans moderation-service/src/moderation/rabbit-topology.ts) au lieu d'etre perdu ou rejoue sans fin.
 */
export const LISTING_SUBMITTED_QUEUE_OPTIONS = {
  durable: true,
  arguments: {
    'x-dead-letter-exchange': '',
    'x-dead-letter-routing-key': LISTING_SUBMITTED_DLQ,
  },
};
