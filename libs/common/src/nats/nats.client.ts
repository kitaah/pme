import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { JetStreamClient, NatsConnection, connect } from 'nats';
import { NatsConfig } from '../config/env';

/** Delai laisse a `drain()` avant de fermer de force la connexion a l'arret. */
const DRAIN_TIMEOUT_MS = 5000;

/**
 * Connexion NATS d'un service, ouverte a la PREMIERE utilisation et non au demarrage : un service doit
 * pouvoir demarrer meme si le broker est absent (l'API continue ainsi de servir les lectures). Si la connexion
 * echoue, elle n'est pas mise en cache : l'appel suivant retentera.
 * `clientName` identifie le service dans les journaux du broker (ex. `pme-api`).
 */
@Injectable()
export class NatsClient implements OnApplicationShutdown {
  private readonly logger = new Logger(NatsClient.name);
  private pending?: Promise<NatsConnection>;

  constructor(
    private readonly options: NatsConfig,
    private readonly clientName: string,
  ) {}

  private open(): Promise<NatsConnection> {
    this.pending ??= connect({
      servers: `${this.options.host}:${this.options.port}`,
      user: this.options.user,
      pass: this.options.password,
      name: this.clientName,
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

  /**
   * Arret propre : les publications en cours sont terminees avant la fermeture. Si le broker est injoignable
   * (la reconnexion est infinie), `drain()` ne termine jamais : au bout de DRAIN_TIMEOUT_MS la connexion est fermee
   * de force, pour que l'arret du pod ne reste pas bloque.
   */
  async onApplicationShutdown(): Promise<void> {
    const connection = await this.pending?.catch(() => undefined);
    if (connection) {
      this.pending = undefined;
      await this.drainOrClose(connection);
      this.logger.log('Connexion NATS fermee');
    }
  }

  private async drainOrClose(connection: NatsConnection): Promise<void> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<boolean>((resolve) => {
      timer = setTimeout(() => resolve(false), DRAIN_TIMEOUT_MS);
    });
    try {
      const drained = await Promise.race([
        connection.drain().then(
          () => true,
          () => false,
        ),
        timeout,
      ]);
      if (!drained) {
        this.logger.warn(`Arret NATS : publications non terminees, fermeture forcee de la connexion`);
        await connection.close();
      }
    } finally {
      clearTimeout(timer);
    }
  }
}
