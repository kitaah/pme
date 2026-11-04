import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ListingSubmittedConsumer } from './listing-submitted.consumer';
import { ModerationController } from './moderation.controller';
import { ModerationItem } from './moderation-item.entity';
import { ModerationService } from './moderation.service';

@Module({
  imports: [TypeOrmModule.forFeature([ModerationItem])],
  controllers: [ModerationController, ListingSubmittedConsumer],
  providers: [ModerationService],
})
export class ModerationModule {}
