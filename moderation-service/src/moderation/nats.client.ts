import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { JetStreamClient, NatsConnection, connect } from 'nats';
import { AppConfig } from '../config/configuration';

/**
 * Connexion NATS du service de moderation. Contrairement a l'API, ce service ne sert a rien sans
 * le broker : la connexion est ouverte au demarrage du consommateur, apres que nats-topology.ts a
 * attendu NATS et declare les flux.
 */
@Injectable()
export class NatsClient implements OnApplicationShutdown {
  private readonly logger = new Logger(NatsClient.name);
  private pending?: Promise<NatsConnection>;

  constructor(private readonly options: AppConfig['nats']) {}

  private open(): Promise<NatsConnection> {
    this.pending ??= connect({
      servers: `${this.options.host}:${this.options.port}`,
      user: this.options.user,
      pass: this.options.password,
      name: 'pme-moderation',
      timeout: 3000,
      maxReconnectAttempts: -1,
      reconnectTimeWait: 1000,
    }).catch((error: unknown) => {
      this.pending = undefined;
      throw error;
    });
    return this.pending;
  }

  async jetstream(): Promise<JetStreamClient> {
    return (await this.open()).jetstream();
  }

  async onApplicationShutdown(): Promise<void> {
    const connection = await this.pending?.catch(() => undefined);
    if (connection) {
      await connection.drain();
      this.pending = undefined;
      this.logger.log('Connexion NATS fermee');
    }
  }
}
