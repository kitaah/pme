import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { loadConfiguration } from '../config/configuration';
import { Listing } from './listing.entity';
import { ListingEventsPublisher } from './listing-events.publisher';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';
import { NatsClient } from './nats.client';

@Module({
  imports: [TypeOrmModule.forFeature([Listing])],
  controllers: [ListingsController],
  providers: [
    ListingsService,
    ListingEventsPublisher,
    {
      provide: NatsClient,
      useFactory: () => new NatsClient(loadConfiguration().nats),
    },
  ],
})
export class ListingsModule {}
