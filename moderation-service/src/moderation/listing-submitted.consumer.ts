import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ConsumerMessages, JsMsg, headers } from 'nats';
import {
  DEAD_LETTER_REASON_HEADER,
  LISTINGS_STREAM,
  LISTING_SUBMITTED_DLQ_SUBJECT,
  MODERATION_CONSUMER,
  ListingSubmittedEvent,
} from './listing-submitted.event';
import { ModerationService } from './moderation.service';
import { NatsClient } from './nats.client';

/** Attente avant la remise d'un message dont le traitement a echoue passagerement. */
const REDELIVERY_DELAY_MS = 3000;
const DLQ_PUBLISH_TIMEOUT_MS = 3000;

/** Message dont le contenu est definitivement inexploitable : le rejouer ne changerait rien. */
export class InvalidMessageError extends Error {}

/**
 * Consommateur NATS JetStream (acquittement manuel). Trois issues, et une seule envoie en flux d'echec :
 *  - succes ou doublon        -> ack() : le message est retire du flux ;
 *  - message invalide         -> copie dans `listing.submitted.dlq` puis term() : plus aucune remise,
 *                                car le rejouer donnerait exactement le meme resultat ;
 *  - panne passagere (base indisponible, reseau) -> nak() : le message revient et sera traite une
 *    fois la panne terminee. C'est ce qui garantit qu'une annonce deposee n'est jamais perdue.
 *
 * Si ce service est arrete, les messages restent dans le flux et sont traites au redemarrage :
 * le consommateur `moderation` est durable, JetStream retient sa position.
 */
@Injectable()
export class ListingSubmittedConsumer implements OnApplicationShutdown {
  private readonly logger = new Logger(ListingSubmittedConsumer.name);
  private messages?: ConsumerMessages;
  private loop?: Promise<void>;

  constructor(
    private readonly nats: NatsClient,
    private readonly moderation: ModerationService,
  ) {}

  /** Demarre la consommation. Les flux et le consommateur durable doivent deja exister (nats-topology.ts). */
  async start(): Promise<void> {
    const jetstream = await this.nats.jetstream();
    const consumer = await jetstream.consumers.get(LISTINGS_STREAM, MODERATION_CONSUMER);
    const messages = await consumer.consume();
    this.messages = messages;
    this.loop = this.run(messages);
    this.logger.log(`Consommateur ${MODERATION_CONSUMER} demarre sur le flux ${LISTINGS_STREAM}`);
  }

  /** Un message a la fois : l'ordre d'arrivee des annonces est conserve. */
  private async run(messages: ConsumerMessages): Promise<void> {
    for await (const message of messages) {
      await this.handle(message);
    }
  }

  async handle(message: JsMsg): Promise<void> {
    try {
      const event = plainToInstance(ListingSubmittedEvent, this.payload(message));
      const errors = await validate(event, { whitelist: true, forbidUnknownValues: true });
      if (errors.length > 0) {
        const detail = errors.flatMap((e) => Object.values(e.constraints ?? {})).join(', ');
        throw new InvalidMessageError(`message invalide : ${detail}`);
      }

      const created = await this.moderation.enqueue(event);
      if (created) {
        this.logger.log(
          `Annonce ${event.listingId} recue de ${event.ownerUsername} -> placee dans la file de moderation`,
        );
      }
      message.ack();
    } catch (error) {
      await this.reject(message, error);
    }
  }

  private payload(message: JsMsg): unknown {
    try {
      return message.json<unknown>();
    } catch (error) {
      throw new InvalidMessageError(`contenu illisible : ${String(error)}`);
    }
  }

  /**
   * `term()` arrete definitivement les remises, `nak()` en demande une nouvelle.
   * Le rejet lui-meme peut echouer (connexion deja fermee, broker tombe) : on ne laisse pas cette
   * erreur secondaire remonter, elle masquerait la cause reelle et terminerait en rejet de promesse
   * non gere. Le message n'est alors ni acquitte ni termine : JetStream le remettra de lui-meme
   * passe le delai d'acquittement, donc rien n'est perdu.
   */
  private async reject(message: JsMsg, error: unknown): Promise<void> {
    const permanent = error instanceof InvalidMessageError;
    this.logger.error(
      permanent
        ? `Message rejete vers le flux des messages en echec : ${String(error)}`
        : `Traitement impossible pour le moment, message remis dans la file : ${String(error)}`,
    );
    try {
      if (permanent) {
        // La copie passe AVANT term() : si elle echoue, le message n'est pas perdu, il sera remis.
        await this.deadLetter(message, String(error));
        message.term(String(error));
      } else {
        message.nak(REDELIVERY_DELAY_MS);
      }
    } catch (rejectError) {
      this.logger.error(`Rejet du message impossible (connexion fermee ?) : ${String(rejectError)}`);
    }
  }

  /** Copie le message tel quel dans le flux des messages en echec, avec le motif en en-tete. */
  private async deadLetter(message: JsMsg, reason: string): Promise<void> {
    const jetstream = await this.nats.jetstream();
    const reasonHeaders = headers();
    reasonHeaders.set(DEAD_LETTER_REASON_HEADER, reason);
    await jetstream.publish(LISTING_SUBMITTED_DLQ_SUBJECT, message.data, {
      headers: reasonHeaders,
      timeout: DLQ_PUBLISH_TIMEOUT_MS,
    });
  }

  /** Arrete la consommation sans couper un traitement en cours. */
  async stop(): Promise<void> {
    const messages = this.messages;
    this.messages = undefined;
    await messages?.close();
    await this.loop?.catch(() => undefined);
    this.loop = undefined;
  }

  async onApplicationShutdown(): Promise<void> {
    await this.stop();
  }
}
