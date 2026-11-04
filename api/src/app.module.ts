import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { ProblemDetailsFilter } from './common/problem-details.filter';
import { loadConfiguration } from './config/configuration';
import { HealthController } from './health/health.controller';
import { Listing } from './listings/listing.entity';
import { ListingsModule } from './listings/listings.module';
import { CreateListings1730000000000 } from './migrations/1730000000000-create-listings';

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
          entities: [Listing],
          migrations: [CreateListings1730000000000],
          migrationsRun: true, // schema gere uniquement par migrations (jamais synchronize)
          synchronize: false,
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
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
    // Ordre = ordre d'execution : debit, puis authentification (refus par defaut).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
