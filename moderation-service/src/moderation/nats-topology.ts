import { Logger } from '@nestjs/common';
import { AckPolicy, JetStreamManager, RetentionPolicy, StorageType, StreamConfig, connect, nanos } from 'nats';
import { AppConfig } from '../config/configuration';
import {
  LISTINGS_DLQ_STREAM,
  LISTINGS_STREAM,
  LISTING_SUBMITTED_DLQ_SUBJECT,
  LISTING_SUBMITTED_SUBJECT,
  MODERATION_CONSUMER,
} from './listing-submitted.event';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Flux principal, en mode "file de travail" (`WorkQueue`) : un message est supprime du flux des
 * qu'il est acquitte, exactement comme une file RabbitMQ. Ce qui reste dans le flux est donc,
 * a tout moment, ce qui reste a traiter (visible dans `make queues`).
 * La fenetre de deduplication ignore une publication rejouee de la meme annonce (`msgID`).
 */
const LISTINGS_CONFIG: Partial<StreamConfig> = {
  name: LISTINGS_STREAM,
  subjects: [LISTING_SUBMITTED_SUBJECT],
  retention: RetentionPolicy.Workqueue,
  storage: StorageType.File,
  duplicate_window: nanos(120_000),
};

/**
 * Flux des messages en echec : retention par limites (et non file de travail), car personne ne
 * les consomme. Ils sont gardes 7 jours pour inspection, l'equivalent de la file
 * `listing.submitted.dlq` de RabbitMQ.
 */
const LISTINGS_DLQ_CONFIG: Partial<StreamConfig> = {
  name: LISTINGS_DLQ_STREAM,
  subjects: [LISTING_SUBMITTED_DLQ_SUBJECT],
  retention: RetentionPolicy.Limits,
  storage: StorageType.File,
  max_age: nanos(7 * 24 * 3600 * 1000),
};

async function upsertStream(jsm: JetStreamManager, config: Partial<StreamConfig>): Promise<void> {
  try {
    await jsm.streams.add(config);
  } catch {
    // Le flux existe deja avec une configuration differente (version precedente du POC) : on l'aligne.
    await jsm.streams.update(config.name as string, config);
  }
}

/**
 * Declare les flux et le consommateur durable avant de consommer, puis sert aussi d'attente du
 * broker au demarrage (nouvelles tentatives toutes les 3 s).
 *
 * Le consommateur est declare ici, et non a la volee : c'est lui qui porte l'acquittement manuel
 * (`AckPolicy.Explicit`). Sans acquittement manuel, un message serait considere comme traite des
 * sa remise, et une annonce serait perdue si la base tombait au mauvais moment.
 */
export async function ensureStreams(nats: AppConfig['nats'], attempts = 20): Promise<void> {
  const logger = new Logger('NatsTopology');
  for (let attempt = 1; ; attempt++) {
    try {
      const connection = await connect({
        servers: `${nats.host}:${nats.port}`,
        user: nats.user,
        pass: nats.password,
        name: 'pme-moderation-topology',
        timeout: 3000,
      });
      try {
        const jsm = await connection.jetstreamManager();
        await upsertStream(jsm, LISTINGS_CONFIG);
        await upsertStream(jsm, LISTINGS_DLQ_CONFIG);
        await jsm.consumers.add(LISTINGS_STREAM, {
          durable_name: MODERATION_CONSUMER,
          ack_policy: AckPolicy.Explicit,
          // Delai au-dela duquel un message non acquitte est remis : couvre un traitement lent.
          ack_wait: nanos(30_000),
          // Equivalent du prefetchCount de RabbitMQ : messages remis sans attendre l'acquittement.
          max_ack_pending: 10,
          // Remise illimitee : c'est le consommateur qui decide du sort de chaque message
          // (acquittement, remise en file, ou envoi dans le flux d'echec).
          max_deliver: -1,
        });
        logger.log(`Flux ${LISTINGS_STREAM} et ${LISTINGS_DLQ_STREAM} declares, consommateur ${MODERATION_CONSUMER}`);
      } finally {
        await connection.close();
      }
      return;
    } catch (error) {
      if (attempt >= attempts) {
        throw error;
      }
      logger.warn(`NATS injoignable (tentative ${attempt}/${attempts}) : ${String(error)}`);
      await sleep(3000);
    }
  }
}
