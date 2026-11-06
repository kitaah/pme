import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { loadConfiguration } from './config/configuration';
import { httpMetricsMiddleware } from './metrics/metrics';

async function bootstrap() {
  const config = loadConfiguration();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Derriere un seul relais (ingress-nginx) : l'IP reelle du client vient de X-Forwarded-For, en faisant
  // confiance au dernier saut seulement (equivalent de server.forward-headers-strategy=framework).
  // Faire confiance a plus de sauts qu'il n'y a de relais laisserait un client falsifier son adresse.
  app.set('trust proxy', 1);
  app.use(httpMetricsMiddleware);
  app.use(helmet());
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableShutdownHooks();

  await app.listen(config.port, '0.0.0.0');
  new Logger('Bootstrap').log(`API demarree sur le port ${config.port}`);
}

void bootstrap();
