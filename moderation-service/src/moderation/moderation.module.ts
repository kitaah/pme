import { Module, Provider } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NatsClient, RabbitMqClient, declareListingsTopology, loadBroker, loadRabbitMqConfig } from '@pme/common';
import { loadConfiguration } from '../config/configuration';
import { ListingMessageConsumer } from './listing-message-consumer';
import { ListingSubmittedConsumer } from './listing-submitted.consumer';
import { RabbitMqListingSubmittedConsumer } from './rabbitmq-listing-submitted.consumer';
import { ModerationController } from './moderation.controller';
import { ModerationItem } from './moderation-item.entity';
import { ModerationService } from './moderation.service';

/**
 * Broker choisi au demarrage par BROKER (`nats` par defaut, ou `rabbitmq`). Seul le client du broker choisi est
 * declare : les parametres de l'autre ne sont jamais lus, et aucune connexion vers lui n'est ouverte.
 */
const brokerProviders: Provider[] =
  loadBroker(process.env) === 'rabbitmq'
    ? [
        { provide: ListingMessageConsumer, useClass: RabbitMqListingSubmittedConsumer },
        {
          provide: RabbitMqClient,
          useFactory: () =>
            new RabbitMqClient(loadRabbitMqConfig(process.env), 'pme-moderation', declareListingsTopology),
        },
      ]
    : [
        { provide: ListingMessageConsumer, useClass: ListingSubmittedConsumer },
        {
          provide: NatsClient,
          useFactory: () => new NatsClient(loadConfiguration().nats, 'pme-moderation'),
        },
      ];

@Module({
  imports: [TypeOrmModule.forFeature([ModerationItem])],
  controllers: [ModerationController],
  providers: [
    ModerationService,
    ...brokerProviders,
  ],
})
export class ModerationModule {}
