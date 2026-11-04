import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { connect } from 'amqplib';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { ProblemDetailsFilter } from '../../src/common/problem-details.filter';
import {
  LISTING_SUBMITTED,
  LISTING_SUBMITTED_QUEUE,
  LISTING_SUBMITTED_QUEUE_OPTIONS,
} from '../../src/listings/listing-events';
import { PostgresInfo, RabbitInfo, startPostgres, startRabbit, waitFor } from '../support/infrastructure';
import { FakeKeycloak } from '../support/jwt-helper';

/**
 * L'API face a un VRAI RabbitMQ et un vrai PostgreSQL (conteneurs jetables) : on verifie ce que
 * recevrait vraiment le service de moderation. Necessite Docker. Lancer avec `npm run test:integration`.
 */
describe('API annonces avec RabbitMQ (integration)', () => {
  const keycloak = new FakeKeycloak();
  const body = { title: 'Figurine Pyramid Head', description: 'Édition 2019, dans sa boîte.', condition: 'GOOD' };
  let postgres: PostgresInfo;
  let rabbit: RabbitInfo;
  let app: INestApplication;
  let dataSource: DataSource;

  const post = () =>
    request(app.getHttpServer()).post('/api/v1/listings').set('Authorization', `Bearer ${keycloak.token()}`).send(body);

  beforeAll(async () => {
    await keycloak.start();
    [postgres, rabbit] = await Promise.all([startPostgres('pme'), startRabbit()]);
    Object.assign(process.env, {
      DB_HOST: postgres.host,
      DB_PORT: String(postgres.port),
      DB_NAME: postgres.database,
      DB_USER: postgres.user,
      DB_PASSWORD: postgres.password,
      RABBITMQ_HOST: rabbit.host,
      RABBITMQ_PORT: String(rabbit.port),
      RABBITMQ_USER: rabbit.user,
      RABBITMQ_PASSWORD: rabbit.password,
      KEYCLOAK_ISSUER: FakeKeycloak.ISSUER,
      KEYCLOAK_JWKS_URI: keycloak.jwksUri,
    });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new ProblemDetailsFilter());
    await app.init();
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await app?.close();
    await keycloak.stop();
    await Promise.all([postgres?.stop(), rabbit?.stop()]);
  });

  it('publie un message persistant avec le contrat attendu par le service de moderation', async () => {
    // Given : le service de moderation n'est pas la ; on lit la file comme le ferait un consommateur
    const connection = await connect({
      protocol: 'amqp',
      hostname: rabbit.host,
      port: rabbit.port,
      username: rabbit.user,
      password: rabbit.password,
    });
    const channel = await connection.createChannel();
    try {
      // meme declaration que le service de moderation : echoue si les arguments de la file divergent
      await channel.assertQueue(LISTING_SUBMITTED_QUEUE, LISTING_SUBMITTED_QUEUE_OPTIONS);

      // When
      const res = await post();

      // Then : 201, annonce en attente, et un message persistant dans la file
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('PENDING_MODERATION');
      const message = await waitFor(
        async () => (await channel.get(LISTING_SUBMITTED_QUEUE, { noAck: true })) || undefined,
        20_000,
        'le message publie',
      );
      expect(JSON.parse(message.content.toString())).toMatchObject({
        pattern: LISTING_SUBMITTED,
        data: { listingId: res.body.id, ownerUsername: 'membre', title: body.title, condition: 'GOOD' },
      });
      expect(message.properties.deliveryMode).toBe(2);
    } finally {
      await channel.close();
      await connection.close();
    }
  });

  it("repond 503 et ne garde pas l'annonce quand RabbitMQ tombe", async () => {
    // Given : le broker est arrete
    await dataSource.query('TRUNCATE listings');
    await rabbit.stop();

    // When
    const res = await post();

    // Then : l'API n'a pas laisse une annonce "en attente" que personne ne verra passer
    expect(res.status).toBe(503);
    expect(await dataSource.query('SELECT 1 FROM listings')).toHaveLength(0);
  });
});
