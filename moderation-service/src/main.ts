import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { httpMetricsMiddleware } from '@pme/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { loadConfiguration } from './config/configuration';
import { LISTINGS_STREAM } from './moderation/listing-submitted.event';
import { ListingSubmittedConsumer } from './moderation/listing-submitted.consumer';
import { ensureStreams } from './moderation/nats-topology';

/**
 * Application hybride : une API HTTP (file de moderation, sondes) et un consommateur NATS JetStream
 * dans le meme processus. Le POC garde ainsi un seul deploiement pour le service de moderation.
 */
async function bootstrap() {
  const config = loadConfiguration();
  await ensureStreams(config.nats);
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Un seul relais de confiance : Traefik.
  app.set('trust proxy', 1);
  app.use(httpMetricsMiddleware);
  app.use(helmet());
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableShutdownHooks();

  await app.get(ListingSubmittedConsumer).start();
  await app.listen(config.port, '0.0.0.0');
  new Logger('Bootstrap').log(`Service de moderation demarre (HTTP ${config.port}, flux ${LISTINGS_STREAM})`);
}

void bootstrap();
