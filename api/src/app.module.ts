import { readFileSync } from 'node:fs';
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard, ProblemDetailsFilter } from '@pme/common';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { loadConfiguration } from './config/configuration';
import { HealthController } from './health/health.controller';
import { MetricsController } from './metrics/metrics.controller';
import { Category } from './listings/category.entity';
import { Listing } from './listings/listing.entity';
import { ListingsModule } from './listings/listings.module';
import { CreateListings1730000000000 } from './migrations/1730000000000-create-listings';
import { AddListingDetails1763100000000 } from './migrations/1763100000000-add-listing-details';
import { RemoveForPartsCondition1763200000000 } from './migrations/1763200000000-remove-for-parts-condition';
import { AddListingCategory1763300000000 } from './migrations/1763300000000-add-listing-category';
import { CreateCategoriesTable1763400000000 } from './migrations/1763400000000-create-categories-table';

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
          entities: [Listing, Category],
          // Ordre d'application : la liste est parcourue dans l'ordre des horodatages des noms.
          migrations: [
            CreateListings1730000000000,
            AddListingDetails1763100000000,
            RemoveForPartsCondition1763200000000,
            AddListingCategory1763300000000,
            CreateCategoriesTable1763400000000,
          ],
          migrationsRun: true, // schema gere uniquement par migrations (jamais synchronize)
          synchronize: false,
          poolSize: db.poolSize, // plafond de connexions par instance : evite de saturer PostgreSQL quand l'autoscaler ajoute des pods
          retryAttempts: 10,
          retryDelay: 3000,
        };
      },
    }),
    // Limitation de debit par IP (equivalent du RateLimitFilter / Bucket4j du projet Spring).
    ThrottlerModule.forRootAsync({
      useFactory: () => [{ ttl: 60_000, limit: loadConfiguration().throttleLimit }],
    }),
    AuthModule,
    ListingsModule,
  ],
  controllers: [HealthController, MetricsController],
  providers: [
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
    // Ordre = ordre d'execution : debit, puis authentification (refus par defaut).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
