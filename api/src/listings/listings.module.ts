import { Module, Provider } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NatsClient, RabbitMqClient, declareListingsTopology, loadBroker, loadRabbitMqConfig, registry } from '@pme/common';
import { DatabaseCircuitBreaker } from '../common/database-circuit-breaker';
import { loadConfiguration } from '../config/configuration';
import { StorageModule } from '../storage/storage.module';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { Category } from './category.entity';
import { HandoverPlace } from './handover-place.entity';
import { HandoverPlacesController } from './handover-places.controller';
import { HandoverPlacesService } from './handover-places.service';
import { Listing } from './listing.entity';
import { ListingReferencesService } from './listing-references.service';
import { ListingEventsPort } from './listing-events.port';
import { ListingEventsPublisher } from './listing-events.publisher';
import { RabbitMqListingEventsPublisher } from './rabbitmq-listing-events.publisher';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';

/**
 * Broker choisi au demarrage par BROKER (`nats` par defaut, ou `rabbitmq`). Seul le client du broker choisi est
 * declare : les parametres de l'autre ne sont jamais lus, et aucune connexion vers lui n'est ouverte.
 */
const brokerProviders: Provider[] =
  loadBroker(process.env) === 'rabbitmq'
    ? [
        { provide: ListingEventsPort, useClass: RabbitMqListingEventsPublisher },
        {
          provide: RabbitMqClient,
          useFactory: () => new RabbitMqClient(loadRabbitMqConfig(process.env), 'pme-api', declareListingsTopology),
        },
      ]
    : [
        { provide: ListingEventsPort, useClass: ListingEventsPublisher },
        {
          provide: NatsClient,
          useFactory: () => new NatsClient(loadConfiguration().nats, 'pme-api'),
        },
      ];

@Module({
  imports: [TypeOrmModule.forFeature([Listing, Category, HandoverPlace]), StorageModule],
  controllers: [ListingsController, CategoriesController, HandoverPlacesController],
  providers: [
    ListingsService,
    CategoriesService,
    HandoverPlacesService,
    ListingReferencesService,
    ...brokerProviders,
    {
      provide: DatabaseCircuitBreaker,
      useFactory: () => {
        const breaker = new DatabaseCircuitBreaker();
        breaker.exposeMetric(registry);
        return breaker;
      },
    },
  ],
})
export class ListingsModule {}
