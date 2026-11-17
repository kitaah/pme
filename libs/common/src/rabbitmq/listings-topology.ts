import type { ConfirmChannel } from 'amqplib';

/**
 * Topologie RabbitMQ de l'evenement "annonce soumise", partagee par l'API (qui publie) et le service de moderation
 * (qui consomme). Les deux la declarent : les declarations sont idempotentes, et l'ordre de demarrage des pods n'a
 * alors plus d'importance (publier sur un echange absent fermerait le canal).
 *
 *   API --publie--> echange `listings` --cle `listing.submitted`--> file `listing.submitted` --> moderation
 *                                                                        |
 *                                                          message rejete (nack sans remise)
 *                                                                        v
 *                                  echange `listings.dlx` --> file `listing.submitted.dlq` (gardee 7 jours)
 *
 * Equivalents NATS : echange + file = flux LISTINGS, file des echecs = flux LISTINGS_DLQ.
 */
export const LISTINGS_EXCHANGE = 'listings';
export const LISTINGS_DLX = 'listings.dlx';
export const LISTING_SUBMITTED_ROUTING_KEY = 'listing.submitted';
export const LISTING_SUBMITTED_QUEUE = 'listing.submitted';
export const LISTING_SUBMITTED_DLQ = 'listing.submitted.dlq';

/** Duree de conservation des messages en echec, pour inspection (comme le flux LISTINGS_DLQ de NATS). */
const DLQ_TTL_MS = 7 * 24 * 3600 * 1000;

export async function declareListingsTopology(channel: ConfirmChannel): Promise<void> {
  // File des messages en echec d'abord : la file principale y renvoie ses rejets.
  await channel.assertExchange(LISTINGS_DLX, 'direct', { durable: true });
  await channel.assertQueue(LISTING_SUBMITTED_DLQ, { durable: true, arguments: { 'x-message-ttl': DLQ_TTL_MS } });
  await channel.bindQueue(LISTING_SUBMITTED_DLQ, LISTINGS_DLX, LISTING_SUBMITTED_DLQ);

  await channel.assertExchange(LISTINGS_EXCHANGE, 'direct', { durable: true });
  await channel.assertQueue(LISTING_SUBMITTED_QUEUE, {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': LISTINGS_DLX,
      'x-dead-letter-routing-key': LISTING_SUBMITTED_DLQ,
    },
  });
  await channel.bindQueue(LISTING_SUBMITTED_QUEUE, LISTINGS_EXCHANGE, LISTING_SUBMITTED_ROUTING_KEY);
}
