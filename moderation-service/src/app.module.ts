import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { ProblemDetailsFilter } from './common/problem-details.filter';
import { loadConfiguration } from './config/configuration';
import { HealthController } from './health/health.controller';
import { CreateModerationQueue1730000000000 } from './migrations/1730000000000-create-moderation-queue';
import { ModerationItem } from './moderation/moderation-item.entity';
import { ModerationModule } from './moderation/moderation.module';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        const { db } = loadConfiguration();
        return {
          type: 'postgres' as const,
          host: db.host,
          port: db.port,
          database: db.name,
          username: db.user,
          password: db.password,
          entities: [ModerationItem],
          migrations: [CreateModerationQueue1730000000000],
          migrationsRun: true,
          synchronize: false,
          retryAttempts: 10,
          retryDelay: 3000,
        };
      },
    }),
    ThrottlerModule.forRootAsync({
      useFactory: () => [{ ttl: 60_000, limit: loadConfiguration().throttleLimit }],
    }),
    AuthModule,
    ModerationModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_FILTER, useClass: ProblemDetailsFilter }],
})
export class AppModule {}
