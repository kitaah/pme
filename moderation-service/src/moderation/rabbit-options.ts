import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppConfig } from '../config/configuration';
import { LISTING_SUBMITTED_QUEUE, LISTING_SUBMITTED_QUEUE_OPTIONS } from './listing-submitted.event';

/** Options du consommateur RabbitMQ, partagees par main.ts et par les tests d'integration. */
export function rabbitConsumerOptions(rabbit: AppConfig['rabbit']): MicroserviceOptions {
  return {
    transport: Transport.RMQ,
    options: {
      urls: [
        {
          protocol: 'amqp',
          hostname: rabbit.host,
          port: rabbit.port,
          username: rabbit.user,
          password: rabbit.password,
        },
      ],
      queue: LISTING_SUBMITTED_QUEUE,
      queueOptions: LISTING_SUBMITTED_QUEUE_OPTIONS,
      noAck: false, // acquittement manuel : un message n'est retire de la file qu'une fois traite
      prefetchCount: 10,
      persistent: true,
    },
  };
}
