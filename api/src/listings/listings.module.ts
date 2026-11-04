import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { TypeOrmModule } from '@nestjs/typeorm';
import { loadConfiguration } from '../config/configuration';
import { Listing } from './listing.entity';
import { LISTING_SUBMITTED_QUEUE, LISTING_SUBMITTED_QUEUE_OPTIONS } from './listing-events';
import { RABBIT_CLIENT, ListingEventsPublisher } from './listing-events.publisher';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Listing]),
    ClientsModule.registerAsync([
      {
        name: RABBIT_CLIENT,
        useFactory: () => {
          const { rabbit } = loadConfiguration();
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
              // Messages persistants : ils survivent a un redemarrage du broker (si son stockage est persistant).
              persistent: true,
            },
          };
        },
      },
    ]),
  ],
  controllers: [ListingsController],
  providers: [ListingsService, ListingEventsPublisher],
})
export class ListingsModule {}
