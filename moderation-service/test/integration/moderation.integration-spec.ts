import { INestApplication, ValidationPipe } from '@nestjs/common';
import { RmqContext } from '@nestjs/microservices';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { ProblemDetailsFilter } from '../../src/common/problem-details.filter';
import { ListingSubmittedConsumer } from '../../src/moderation/listing-submitted.consumer';
import { FakeKeycloak } from '../support/jwt-helper';
import { PostgresInfo, startPostgres } from '../support/infrastructure';

/**
 * Test d'integration du service de moderation : vrai PostgreSQL (conteneur jetable), vrai controle
 * de jeton (faux Keycloak) et consommateur appele avec un faux contexte RabbitMQ (ack / nack
 * observables). Le vrai broker est teste dans moderation-broker.integration-spec.ts.
 */
describe('Service de moderation (integration)', () => {
  let postgres: PostgresInfo;
  const keycloak = new FakeKeycloak();
  let app: INestApplication;
  let dataSource: DataSource;
  let consumer: ListingSubmittedConsumer;

  const event = (overrides: Record<string, unknown> = {}) => ({
    listingId: '33333333-3333-4333-8333-333333333333',
    ownerId: '11111111-1111-4111-8111-111111111111',
    ownerUsername: 'membre',
    title: 'Figurine Pyramid Head',
    description: 'Édition 2019, dans sa boîte.',
    condition: 'GOOD',
    submittedAt: new Date().toISOString(),
    ...overrides,
  });

  function fakeRmq() {
    const channel = { ack: jest.fn(), nack: jest.fn() };
    const message = { content: Buffer.from('{}') };
    const context = { getChannelRef: () => channel, getMessage: () => message } as unknown as RmqContext;
    return { channel, message, context };
  }

  beforeAll(async () => {
    await keycloak.start();
    postgres = await startPostgres('moderation');
    Object.assign(process.env, {
      DB_HOST: postgres.host,
      DB_PORT: String(postgres.port),
      DB_NAME: postgres.database,
      DB_USER: postgres.user,
      DB_PASSWORD: postgres.password,
      RABBITMQ_USER: 'test',
      RABBITMQ_PASSWORD: 'test',
      KEYCLOAK_ISSUER: FakeKeycloak.ISSUER,
      KEYCLOAK_JWKS_URI: keycloak.jwksUri,
    });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new ProblemDetailsFilter());
    await app.init();
    dataSource = app.get(DataSource);
    consumer = app.get(ListingSubmittedConsumer);
  });

  afterAll(async () => {
    await app?.close();
    await keycloak.stop();
    await postgres?.stop();
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE moderation_queue');
  });

  describe('consommation de l evenement annonce soumise', () => {
    it("place l'annonce dans la file de moderation et acquitte le message", async () => {
      const { channel, message, context } = fakeRmq();

      await consumer.onListingSubmitted(event(), context);

      const rows = await dataSource.query('SELECT listing_id, status, title FROM moderation_queue');
      expect(rows).toEqual([{ listing_id: event().listingId, status: 'PENDING', title: 'Figurine Pyramid Head' }]);
      expect(channel.ack).toHaveBeenCalledWith(message);
      expect(channel.nack).not.toHaveBeenCalled();
    });

    it('est idempotent : un message rejoue est acquitte sans creer de doublon', async () => {
      await consumer.onListingSubmitted(event(), fakeRmq().context);
      const replay = fakeRmq();

      await consumer.onListingSubmitted(event(), replay.context);

      expect(await dataSource.query('SELECT 1 FROM moderation_queue')).toHaveLength(1);
      expect(replay.channel.ack).toHaveBeenCalled();
      expect(replay.channel.nack).not.toHaveBeenCalled();
    });

    it('rejette un message mal forme vers la file des messages en echec (nack sans remise en file)', async () => {
      const { channel, message, context } = fakeRmq();

      await consumer.onListingSubmitted({ listingId: 'pas-un-uuid', title: '' }, context);

      expect(channel.nack).toHaveBeenCalledWith(message, false, false);
      expect(channel.ack).not.toHaveBeenCalled();
      expect(await dataSource.query('SELECT 1 FROM moderation_queue')).toHaveLength(0);
    });
  });

  describe('GET /api/v1/moderation/queue', () => {
    beforeEach(async () => {
      await consumer.onListingSubmitted(event(), fakeRmq().context);
    });

    it('refuse un membre (403)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/moderation/queue')
        .set('Authorization', `Bearer ${keycloak.token({ roles: ['membre'] })}`);
      expect(res.status).toBe(403);
      expect(res.body.title).toBe('Accès refusé');
    });

    it('refuse une requete sans jeton (401)', async () => {
      expect((await request(app.getHttpServer()).get('/api/v1/moderation/queue')).status).toBe(401);
    });

    it('renvoie la file a un moderateur (200)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/moderation/queue')
        .set('Authorization', `Bearer ${keycloak.token({ username: 'moderateur', roles: ['membre', 'moderateur'] })}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({ title: 'Figurine Pyramid Head', status: 'PENDING', ownerUsername: 'membre' });
    });
  });
});
