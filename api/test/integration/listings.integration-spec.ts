import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { ProblemDetailsFilter } from '../../src/common/problem-details.filter';
import { RABBIT_CLIENT } from '../../src/listings/listing-events.publisher';
import { FakeKeycloak } from '../support/jwt-helper';
import { PostgresInfo, startPostgres } from '../support/infrastructure';

/**
 * Test d'integration de l'API : vrai PostgreSQL (conteneur jetable), vrai controle de jeton
 * (faux Keycloak local), RabbitMQ remplace par un double (le vrai broker est teste dans
 * listings-broker.integration-spec.ts). Lancer avec `npm run test:integration`.
 */
describe('API annonces (integration)', () => {
  let postgres: PostgresInfo;
  const keycloak = new FakeKeycloak();
  const emit = jest.fn();
  let app: INestApplication;
  let dataSource: DataSource;

  const validBody = { title: 'Figurine Pyramid Head', description: 'Édition 2019, dans sa boîte.', condition: 'GOOD' };
  const member = () => `Bearer ${keycloak.token()}`;

  beforeAll(async () => {
    await keycloak.start();
    postgres = await startPostgres('pme');
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
      KEYCLOAK_ALLOWED_CLIENTS: 'pme-web,pme-cli',
    });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RABBIT_CLIENT)
      .useValue({ emit })
      .compile();

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
    await postgres?.stop();
  });

  beforeEach(async () => {
    emit.mockReset().mockReturnValue(of(true));
    await dataSource.query('TRUNCATE listings');
  });

  describe('authentification', () => {
    it('refuse une requete sans jeton (401)', async () => {
      const res = await request(app.getHttpServer()).post('/api/v1/listings').send(validBody);
      expect(res.status).toBe(401);
      expect(res.headers['content-type']).toContain('application/problem+json');
    });

    it('refuse un jeton emis par un autre emetteur (401)', async () => {
      const token = keycloak.token({ issuer: 'https://evil.example/realms/pme' });
      const res = await request(app.getHttpServer())
        .post('/api/v1/listings')
        .set('Authorization', `Bearer ${token}`)
        .send(validBody);
      expect(res.status).toBe(401);
    });

    it('refuse un jeton emis pour un autre client (401)', async () => {
      const token = keycloak.token({ azp: 'autre-application' });
      const res = await request(app.getHttpServer())
        .post('/api/v1/listings')
        .set('Authorization', `Bearer ${token}`)
        .send(validBody);
      expect(res.status).toBe(401);
    });

    it('refuse un jeton expire (401)', async () => {
      const token = keycloak.token({ expiresIn: -10 });
      const res = await request(app.getHttpServer())
        .post('/api/v1/listings')
        .set('Authorization', `Bearer ${token}`)
        .send(validBody);
      expect(res.status).toBe(401);
    });

    it('refuse un utilisateur sans le role membre (403)', async () => {
      const token = keycloak.token({ roles: ['autre-role'] });
      const res = await request(app.getHttpServer())
        .post('/api/v1/listings')
        .set('Authorization', `Bearer ${token}`)
        .send(validBody);
      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/v1/listings', () => {
    it("enregistre l'annonce en attente de moderation et publie l'evenement (201)", async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/listings')
        .set('Authorization', member())
        .send(validBody);

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ title: validBody.title, status: 'PENDING_MODERATION', ownerUsername: 'membre' });

      const rows = await dataSource.query('SELECT status FROM listings');
      expect(rows).toEqual([{ status: 'PENDING_MODERATION' }]);

      expect(emit).toHaveBeenCalledTimes(1);
      const [pattern, event] = emit.mock.calls[0];
      expect(pattern).toBe('listing.submitted');
      expect(event).toMatchObject({ listingId: res.body.id, title: validBody.title, ownerUsername: 'membre' });
    });

    it.each([
      ['titre vide', { ...validBody, title: '   ' }],
      ['titre trop court', { ...validBody, title: 'ab' }],
      ['description trop longue', { ...validBody, description: 'x'.repeat(1001) }],
      ['etat inconnu', { ...validBody, condition: 'CASSE' }],
      ['champ inattendu', { ...validBody, status: 'PUBLISHED' }],
    ])('rejette une annonce invalide : %s (400)', async (_label, body) => {
      const res = await request(app.getHttpServer()).post('/api/v1/listings').set('Authorization', member()).send(body);

      expect(res.status).toBe(400);
      expect(res.body.title).toBe('Erreur de validation');
      expect(res.body.errors.length).toBeGreaterThan(0);
      expect(emit).not.toHaveBeenCalled();
      expect(await dataSource.query('SELECT 1 FROM listings')).toHaveLength(0);
    });

    it("retire l'annonce et repond 503 si RabbitMQ est injoignable", async () => {
      emit.mockReturnValue(throwError(() => new Error('connexion refusee')));

      const res = await request(app.getHttpServer())
        .post('/api/v1/listings')
        .set('Authorization', member())
        .send(validBody);

      expect(res.status).toBe(503);
      expect(await dataSource.query('SELECT 1 FROM listings')).toHaveLength(0);
    });
  });

  describe('GET /api/v1/listings/mine', () => {
    it('ne renvoie que les annonces du membre connecte', async () => {
      const other = `Bearer ${keycloak.token({ sub: '22222222-2222-4222-8222-222222222222', username: 'autre' })}`;
      await request(app.getHttpServer()).post('/api/v1/listings').set('Authorization', member()).send(validBody);
      await request(app.getHttpServer())
        .post('/api/v1/listings')
        .set('Authorization', other)
        .send({ ...validBody, title: 'Autre annonce' });

      const res = await request(app.getHttpServer()).get('/api/v1/listings/mine').set('Authorization', member());

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].title).toBe(validBody.title);
    });
  });

  describe('sante', () => {
    it('expose les sondes sans jeton', async () => {
      expect((await request(app.getHttpServer()).get('/api/health/liveness')).status).toBe(200);
      expect((await request(app.getHttpServer()).get('/api/health/readiness')).status).toBe(200);
    });
  });
});
