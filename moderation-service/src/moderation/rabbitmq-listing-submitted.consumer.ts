import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ConfirmChannel, ConsumeMessage, LISTING_SUBMITTED_QUEUE, RabbitMqClient } from '@pme/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListingSubmittedEvent } from './listing-submitted.event';
import { InvalidMessageError } from './listing-submitted.consumer';
import { ListingMessageConsumer } from './listing-message-consumer';
import { ModerationService } from './moderation.service';

/** Attente avant la remise d'un message dont le traitement a echoue passagerement. */
const REDELIVERY_DELAY_MS = 3000;
/** Attente entre deux tentatives de connexion au broker (au demarrage, et apres une coupure). */
const RETRY_DELAY_MS = 3000;
const START_ATTEMPTS = 20;
/** Messages remis sans attendre d'acquittement : l'equivalent de `max_ack_pending` cote NATS. */
const PREFETCH = 5;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Consommateur RabbitMQ (acquittement manuel). Trois issues, et une seule envoie dans la file des messages en echec :
 *  - succes ou doublon        -> ack() : le message est retire de la file ;
 *  - message invalide         -> nack sans remise : RabbitMQ l'envoie lui-meme dans `listing.submitted.dlq`
 *                                (echange `listings.dlx`, voir listings-topology.ts), car le rejouer donnerait
 *                                exactement le meme resultat ;
 *  - panne passagere (base indisponible, reseau) -> nack avec remise, apres un delai : le message revient et sera
 *    traite une fois la panne terminee. C'est ce qui garantit qu'une annonce deposee n'est jamais perdue.
 *
 * Si ce service est arrete, les messages restent dans la file (durable, messages persistants) et sont traites au
 * redemarrage. Si la connexion tombe, la consommation reprend toute seule (amqplib ne se reconnecte pas lui-meme).
 */
@Injectable()
export class RabbitMqListingSubmittedConsumer extends ListingMessageConsumer implements OnApplicationShutdown {
  private readonly logger = new Logger(RabbitMqListingSubmittedConsumer.name);
  private stopping = false;
  private channel?: ConfirmChannel;
  private consumerTag?: string;
  private restartTimer?: NodeJS.Timeout;

  constructor(
    private readonly rabbit: RabbitMqClient,
    private readonly moderation: ModerationService,
  ) {
    super();
  }

  /**
   * Demarre la consommation, en attendant le broker si besoin (nouvelles tentatives toutes les 3 s). L'echange et la
   * file sont declares a l'ouverture du canal (listings-topology.ts).
   */
  async start(attempts = START_ATTEMPTS): Promise<void> {
    this.stopping = false;
    await this.startWithRetry(1, attempts);
  }

  /** Recursion plutot qu'une boucle : chaque tentative attend la fin de la precedente et de son delai. */
  private async startWithRetry(attempt: number, attempts: number): Promise<void> {
    try {
      await this.consume();
    } catch (error) {
      if (attempt >= attempts) {
        throw error;
      }
      this.logger.warn(`RabbitMQ injoignable (tentative ${attempt}/${attempts}) : ${String(error)}`);
      await sleep(RETRY_DELAY_MS);
      return this.startWithRetry(attempt + 1, attempts);
    }
  }

  private async consume(): Promise<void> {
    const channel = await this.rabbit.channel();
    await channel.prefetch(PREFETCH);
    const { consumerTag } = await channel.consume(
      LISTING_SUBMITTED_QUEUE,
      (message) => {
        if (message) void this.handle(channel, message);
      },
      { noAck: false },
    );
    this.channel = channel;
    this.consumerTag = consumerTag;
    channel.on('close', () => this.onChannelClosed(channel));
    this.logger.log(`Consommateur demarre sur la file ${LISTING_SUBMITTED_QUEUE}`);
  }

  /** Canal ferme sans que ce soit voulu (broker redemarre, coupure) : la consommation reprend apres un court delai. */
  private onChannelClosed(channel: ConfirmChannel): void {
    if (this.channel !== channel) return;
    this.channel = undefined;
    this.consumerTag = undefined;
    if (this.stopping) return;
    this.logger.warn(`Canal RabbitMQ ferme : reprise de la consommation dans ${RETRY_DELAY_MS / 1000} s`);
    this.restartTimer = setTimeout(() => {
      this.startWithRetry(1, Number.POSITIVE_INFINITY).catch((error: unknown) => {
        this.logger.error(`Reprise de la consommation impossible : ${String(error)}`);
      });
    }, RETRY_DELAY_MS);
  }

  async handle(channel: ConfirmChannel, message: ConsumeMessage): Promise<void> {
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
      channel.ack(message);
    } catch (error) {
      await this.reject(channel, message, error);
    }
  }

  private payload(message: ConsumeMessage): unknown {
    try {
      return JSON.parse(message.content.toString('utf8')) as unknown;
    } catch (error) {
      throw new InvalidMessageError(`contenu illisible : ${String(error)}`);
    }
  }

  /**
   * `nack(..., requeue = false)` envoie le message dans la file des messages en echec, `nack(..., requeue = true)` le
   * remet dans la file. Le rejet lui-meme peut echouer (canal deja ferme, broker tombe) : on ne laisse pas cette
   * erreur secondaire remonter, elle masquerait la cause reelle. Le message n'etant alors ni acquitte ni rejete,
   * RabbitMQ le remet de lui-meme des que la connexion se ferme : rien n'est perdu.
   */
  private async reject(channel: ConfirmChannel, message: ConsumeMessage, error: unknown): Promise<void> {
    const permanent = error instanceof InvalidMessageError;
    this.logger.error(
      permanent
        ? `Message rejete vers la file des messages en echec : ${String(error)}`
        : `Traitement impossible pour le moment, message remis dans la file : ${String(error)}`,
    );
    try {
      if (permanent) {
        channel.nack(message, false, false);
      } else {
        await sleep(REDELIVERY_DELAY_MS);
        channel.nack(message, false, true);
      }
    } catch (rejectError) {
      this.logger.error(`Rejet du message impossible (canal ferme ?) : ${String(rejectError)}`);
    }
  }

  /** Arrete la consommation sans couper un traitement en cours. */
  async stop(): Promise<void> {
    this.stopping = true;
    clearTimeout(this.restartTimer);
    const channel = this.channel;
    const consumerTag = this.consumerTag;
    this.channel = undefined;
    this.consumerTag = undefined;
    if (channel && consumerTag) {
      await channel.cancel(consumerTag).catch(() => undefined);
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.stop();
  }
}
