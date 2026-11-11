import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NatsClient } from '@pme/common';
import { loadConfiguration } from '../config/configuration';
import { ListingSubmittedConsumer } from './listing-submitted.consumer';
import { ModerationController } from './moderation.controller';
import { ModerationItem } from './moderation-item.entity';
import { ModerationService } from './moderation.service';

@Module({
  imports: [TypeOrmModule.forFeature([ModerationItem])],
  controllers: [ModerationController],
  providers: [
    ModerationService,
    ListingSubmittedConsumer,
    {
      provide: NatsClient,
      useFactory: () => new NatsClient(loadConfiguration().nats, 'pme-moderation'),
    },
  ],
})
export class ModerationModule {}
