import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NatsClient, registry } from '@pme/common';
import { DatabaseCircuitBreaker } from '../common/database-circuit-breaker';
import { loadConfiguration } from '../config/configuration';
import { StorageModule } from '../storage/storage.module';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { Category } from './category.entity';
import { Listing } from './listing.entity';
import { ListingEventsPublisher } from './listing-events.publisher';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';

@Module({
  imports: [TypeOrmModule.forFeature([Listing, Category]), StorageModule],
  controllers: [ListingsController, CategoriesController],
  providers: [
    ListingsService,
    CategoriesService,
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
