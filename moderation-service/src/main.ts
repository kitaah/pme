import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions } from '@nestjs/microservices';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { loadConfiguration } from './config/configuration';
import { LISTING_SUBMITTED_QUEUE } from './moderation/listing-submitted.event';
import { rabbitConsumerOptions } from './moderation/rabbit-options';
import { ensureDeadLetterQueue } from './moderation/rabbit-topology';

/**
 * Application hybride : une API HTTP (file de moderation, sondes) et un consommateur RabbitMQ
 * dans le meme processus. Le POC garde ainsi un seul deploiement pour le service de moderation.
 */
async function bootstrap() {
  const config = loadConfiguration();
  await ensureDeadLetterQueue(config.rabbit);
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.set('trust proxy', 1);
  app.use(helmet());
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableShutdownHooks();

  app.connectMicroservice<MicroserviceOptions>(rabbitConsumerOptions(config.rabbit));

  if (config.swaggerEnabled) {
    SwaggerModule.setup(
      'api/docs',
      app,
      SwaggerModule.createDocument(
        app,
        new DocumentBuilder().setTitle('Service de modération').setVersion('0.1').addBearerAuth().build(),
      ),
    );
  }

  await app.startAllMicroservices();
  await app.listen(config.port, '0.0.0.0');
  new Logger('Bootstrap').log(`Service de moderation demarre (HTTP ${config.port}, file ${LISTING_SUBMITTED_QUEUE})`);
}

void bootstrap();
