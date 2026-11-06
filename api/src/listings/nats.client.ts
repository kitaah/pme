import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { JetStreamClient, NatsConnection, connect } from 'nats';
import { AppConfig } from '../config/configuration';

/**
 * Connexion NATS de l'API, ouverte a la PREMIERE publication et non au demarrage : l'API doit
 * pouvoir demarrer et servir les lectures meme si le broker est absent. Si la connexion echoue,
 * elle n'est pas mise en cache : la requete suivante retentera (voir ListingsService, qui
 * transforme l'echec en 503 et retire l'annonce).
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
      name: 'pme-api',
      timeout: 3000,
      // TLS des que l'autorite est fournie : le certificat du serveur doit etre signe par elle ET emis pour
      // le nom utilise dans `servers` (ici `nats`). Sans elle, l'option est absente : connexion en clair.
      ...(this.options.tlsCaFile ? { tls: { caFile: this.options.tlsCaFile } } : {}),
      // Une coupure passagere du broker ne doit pas condamner la connexion pour toute la duree de vie du pod.
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

  /** Arret propre : les publications en cours sont terminees avant la fermeture. */
  async onApplicationShutdown(): Promise<void> {
    const connection = await this.pending?.catch(() => undefined);
    if (connection) {
      await connection.drain();
      this.logger.log('Connexion NATS fermee');
    }
  }
}
