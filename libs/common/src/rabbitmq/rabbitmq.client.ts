import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ChannelModel, ConfirmChannel, connect } from 'amqplib';
import { RabbitMqConfig } from '../config/env';

// Les types d'amqplib sont reexportes ici : les services les importent depuis @pme/common, sans declarer la bibliotheque.
export type { ConfirmChannel, ConsumeMessage } from 'amqplib';

/** Delai laisse a la fermeture de la connexion a l'arret, avant de l'abandonner. */
const CLOSE_TIMEOUT_MS = 5000;
const CONNECT_TIMEOUT_MS = 3000;
const HEARTBEAT_SECONDS = 30;

/** Declaration executee sur chaque nouveau canal (echanges, files, liaisons) : voir listings-topology.ts. */
export type ChannelSetup = (channel: ConfirmChannel) => Promise<void>;

/**
 * Connexion RabbitMQ d'un service, ouverte a la PREMIERE utilisation et non au demarrage : un service doit pouvoir
 * demarrer meme si le broker est absent (l'API continue ainsi de servir les lectures). Equivalent de NatsClient.
 *
 * amqplib ne se reconnecte pas tout seul : quand la connexion ou le canal se ferme, le canal mis en cache est oublie,
 * et l'appel suivant a `channel()` ouvre une connexion neuve. Si l'ouverture echoue, rien n'est garde : l'appel
 * suivant retentera. `clientName` identifie le service dans l'interface et les journaux de RabbitMQ (ex. `pme-api`).
 */
@Injectable()
export class RabbitMqClient implements OnApplicationShutdown {
  private readonly logger = new Logger(RabbitMqClient.name);
  private connection?: ChannelModel;
  private pending?: Promise<ConfirmChannel>;

  constructor(
    private readonly options: RabbitMqConfig,
    private readonly clientName: string,
    private readonly setup?: ChannelSetup,
  ) {}

  /** Canal a confirmations : `publish` n'aboutit qu'une fois le message pris en charge par le broker. */
  channel(): Promise<ConfirmChannel> {
    this.pending ??= this.open().catch((error: unknown) => {
      this.pending = undefined;
      throw error;
    });
    return this.pending;
  }

  private async open(): Promise<ConfirmChannel> {
    const connection = await connect(
      {
        protocol: 'amqp',
        hostname: this.options.host,
        port: this.options.port,
        username: this.options.user,
        password: this.options.password,
        heartbeat: HEARTBEAT_SECONDS,
      },
      { timeout: CONNECT_TIMEOUT_MS, clientProperties: { connection_name: this.clientName } },
    );
    this.connection = connection;
    const forget = () => {
      if (this.connection === connection) {
        this.connection = undefined;
        this.pending = undefined;
      }
    };
    connection.on('error', (error: Error) => this.logger.warn(`Connexion RabbitMQ en erreur : ${error.message}`));
    connection.on('close', () => {
      forget();
      this.logger.warn('Connexion RabbitMQ fermee');
    });
    try {
      const channel = await connection.createConfirmChannel();
      channel.on('error', (error: Error) => this.logger.warn(`Canal RabbitMQ en erreur : ${error.message}`));
      // Un canal ferme seul (erreur de protocole) ne se rouvre pas : on repart d'une connexion neuve.
      channel.on('close', () => {
        forget();
        void connection.close().catch(() => undefined);
      });
      await this.setup?.(channel);
      return channel;
    } catch (error) {
      forget();
      await connection.close().catch(() => undefined);
      throw error;
    }
  }

  /** Arret propre : si le broker est injoignable, la connexion est abandonnee au bout de CLOSE_TIMEOUT_MS. */
  async onApplicationShutdown(): Promise<void> {
    const connection = this.connection;
    this.connection = undefined;
    this.pending = undefined;
    if (!connection) return;
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, CLOSE_TIMEOUT_MS);
    });
    try {
      await Promise.race([connection.close().catch(() => undefined), timeout]);
      this.logger.log('Connexion RabbitMQ fermee');
    } finally {
      clearTimeout(timer);
    }
  }
}
