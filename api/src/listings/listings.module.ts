import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NatsClient, registry } from '@pme/common';
import { DatabaseCircuitBreaker } from '../common/database-circuit-breaker';
import { loadConfiguration } from '../config/configuration';
import { Listing } from './listing.entity';
import { ListingEventsPublisher } from './listing-events.publisher';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';

@Module({
  imports: [TypeOrmModule.forFeature([Listing])],
  controllers: [ListingsController],
  providers: [
    ListingsService,
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
