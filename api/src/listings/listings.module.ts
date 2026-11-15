import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NatsClient, registry } from '@pme/common';
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
import { ListingEventsPublisher } from './listing-events.publisher';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';

@Module({
  imports: [TypeOrmModule.forFeature([Listing, Category, HandoverPlace]), StorageModule],
  controllers: [ListingsController, CategoriesController, HandoverPlacesController],
  providers: [
    ListingsService,
    CategoriesService,
    HandoverPlacesService,
    ListingReferencesService,
    ListingEventsPublisher,
    {
      provide: DatabaseCircuitBreaker,
      useFactory: () => {
        const breaker = new DatabaseCircuitBreaker();
        breaker.exposeMetric(registry);
        return breaker;
      },
    },
    {
      provide: NatsClient,
      useFactory: () => new NatsClient(loadConfiguration().nats, 'pme-api'),
    },
  ],
})
export class ListingsModule {}
