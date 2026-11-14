import { readFileSync } from 'node:fs';
import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ProblemDetailsFilter } from '@pme/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { loadConfiguration } from './config/configuration';
import { HealthController } from './health/health.controller';
import { MetricsController } from './metrics/metrics.controller';
import { CreateModerationQueue1730000000000 } from './migrations/1730000000000-create-moderation-queue';
import { AddListingDetails1763100000000 } from './migrations/1763100000000-add-listing-details';
import { RemoveForPartsCondition1763200000000 } from './migrations/1763200000000-remove-for-parts-condition';
import { AddListingCategory1763300000000 } from './migrations/1763300000000-add-listing-category';
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
          // Connexion chiffree des que l'autorite est fournie : `rejectUnauthorized` impose que le certificat
          // du serveur soit signe par elle ET emis pour le nom utilise dans `host` (ici `postgres`).
          ssl: db.sslCaFile ? { ca: readFileSync(db.sslCaFile, 'utf8'), rejectUnauthorized: true } : false,
          entities: [ModerationItem],
          // Ordre d'application : la liste est parcourue dans l'ordre des horodatages des noms.
          migrations: [CreateModerationQueue1730000000000, AddListingDetails1763100000000, RemoveForPartsCondition1763200000000, AddListingCategory1763300000000],
          migrationsRun: true,
          synchronize: false,
          poolSize: db.poolSize, // plafond de connexions par instance : evite de saturer PostgreSQL quand l'autoscaler ajoute des pods
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
  controllers: [HealthController, MetricsController],
  providers: [{ provide: APP_FILTER, useClass: ProblemDetailsFilter }],
})
export class AppModule {}
