import { Logger } from '@nestjs/common';
import { connect } from 'amqplib';
import { AppConfig } from '../config/configuration';
import { LISTING_SUBMITTED_DLQ } from './listing-submitted.event';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Declare la file des messages en echec (`listing.submitted.dlq`) avant de consommer, puis sert
 * aussi d'attente du broker au demarrage (nouvelles tentatives toutes les 3 s).
 * Les messages rejetes par le consommateur y sont deposes par RabbitMQ (dead-lettering) :
 * on peut les inspecter dans l'interface de gestion, sans qu'ils bloquent la file principale.
 */
export async function ensureDeadLetterQueue(rabbit: AppConfig['rabbit'], attempts = 20): Promise<void> {
  const logger = new Logger('RabbitTopology');
  for (let attempt = 1; ; attempt++) {
    try {
      const connection = await connect({
        protocol: 'amqp',
        hostname: rabbit.host,
        port: rabbit.port,
        username: rabbit.user,
        password: rabbit.password,
      });
      const channel = await connection.createChannel();
      await channel.assertQueue(LISTING_SUBMITTED_DLQ, { durable: true });
      await channel.close();
      await connection.close();
      logger.log(`File ${LISTING_SUBMITTED_DLQ} declaree`);
      return;
    } catch (error) {
      if (attempt >= attempts) {
        throw error;
      }
      logger.warn(`RabbitMQ injoignable (tentative ${attempt}/${attempts}) : ${String(error)}`);
      await sleep(3000);
    }
  }
}
