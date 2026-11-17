/**
 * Port de consommation des annonces soumises : le demarrage ne connait pas le broker.
 * Deux adaptateurs : NATS JetStream (listing-submitted.consumer.ts) et RabbitMQ
 * (rabbitmq-listing-submitted.consumer.ts). Le choix se fait au demarrage par la variable BROKER (moderation.module.ts).
 *
 * Classe abstraite et non interface : c'est aussi le jeton d'injection (une interface n'existe plus a l'execution).
 */
export abstract class ListingMessageConsumer {
  abstract start(): Promise<void>;
}
