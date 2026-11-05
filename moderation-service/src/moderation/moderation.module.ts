import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { loadConfiguration } from '../config/configuration';
import { ListingSubmittedConsumer } from './listing-submitted.consumer';
import { ModerationController } from './moderation.controller';
import { ModerationItem } from './moderation-item.entity';
import { ModerationService } from './moderation.service';
import { NatsClient } from './nats.client';

@Module({
  imports: [TypeOrmModule.forFeature([ModerationItem])],
  controllers: [ModerationController],
  providers: [
    ModerationService,
    ListingSubmittedConsumer,
    {
      provide: NatsClient,
      useFactory: () => new NatsClient(loadConfiguration().nats),
    },
  ],
})
export class ModerationModule {}
