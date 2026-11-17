import { Listing } from './listing.entity';

/**
 * Port de publication des evenements metier : le service des annonces ne connait pas le broker.
 * Deux adaptateurs : NATS JetStream (listing-events.publisher.ts) et RabbitMQ (rabbitmq-listing-events.publisher.ts).
 * Le choix se fait au demarrage par la variable BROKER (listings.module.ts).
 *
 * Classe abstraite et non interface : c'est aussi le jeton d'injection (une interface n'existe plus a l'execution).
 */
export abstract class ListingEventsPort {
  abstract publishSubmitted(listing: Listing): Promise<void>;
}
