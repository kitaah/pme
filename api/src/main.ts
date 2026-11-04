import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { loadConfiguration } from './config/configuration';

async function bootstrap() {
  const config = loadConfiguration();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Derriere l'ingress : l'IP reelle du client vient de X-Forwarded-For
  // (equivalent de server.forward-headers-strategy=framework).
  app.set('trust proxy', 1);
  app.use(helmet());
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableShutdownHooks();

  if (config.swaggerEnabled) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle("Petite Maison de l'Épouvante - API")
        .setDescription('POC : dépôt d’annonces de troc')
        .setVersion('0.1')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(config.port, '0.0.0.0');
  new Logger('Bootstrap').log(`API demarree sur le port ${config.port}`);
}

void bootstrap();
