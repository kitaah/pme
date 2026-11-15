import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { NatsClient, ProblemDetailsFilter } from '@pme/common';
import { AppModule } from '../../src/app.module';
import { FakeKeycloak } from '../support/jwt-helper';
import { PostgresInfo, startPostgres } from '../support/infrastructure';

/**
 * Test d'integration de l'API : vrai PostgreSQL (conteneur jetable), vrai controle de jeton
 * (faux Keycloak local), NATS remplace par un double (le vrai broker est teste dans
 * listings-broker.integration-spec.ts). Lancer avec `npm run test:integration`.
 */
describe('API annonces (integration)', () => {
  let postgres: PostgresInfo;
  const keycloak = new FakeKeycloak();
  const publish = jest.fn();
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
      NATS_USER: 'test',
      NATS_PASSWORD: 'test',
      KEYCLOAK_ISSUER: FakeKeycloak.ISSUER,
      KEYCLOAK_JWKS_URI: keycloak.jwksUri,
      KEYCLOAK_ALLOWED_CLIENTS: 'pme-web,pme-cli',
    });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(NatsClient)
      .useValue({ jetstream: async () => ({ publish }) })
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
    publish.mockReset().mockResolvedValue({ seq: 1, duplicate: false });
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

      expect(publish).toHaveBeenCalledTimes(1);
      const [subject, payload] = publish.mock.calls[0];
      expect(subject).toBe('listing.submitted');
      expect(JSON.parse(payload as string)).toMatchObject({
        listingId: res.body.id,
        title: validBody.title,
        ownerUsername: 'membre',
      });
    });

    it('range l annonce dans la categorie choisie et la renvoie sous la forme de son code, avec la cle etrangere en base', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/listings')
        .set('Authorization', member())
        .send({ ...validBody, category: 'FILMS' });

      expect(res.status).toBe(201);
      expect(res.body.category).toBe('FILMS');
      const rows = await dataSource.query('SELECT c.code FROM listings l JOIN categories c ON c.id = l.category_id');
      expect(rows).toEqual([{ code: 'FILMS' }]);
    });

    it('utilise Autres sans categorie, et refuse un code inconnu (400) sans rien enregistrer', async () => {
      const sans = await request(app.getHttpServer())
        .post('/api/v1/listings')
        .set('Authorization', member())
        .send(validBody);
      const inconnue = await request(app.getHttpServer())
        .post('/api/v1/listings')
        .set('Authorization', member())
        .send({ ...validBody, category: 'MEUBLES' });

      expect(sans.body.category).toBe('OTHER');
      expect(inconnue.status).toBe(400);
      expect(await dataSource.query('SELECT 1 FROM listings')).toHaveLength(1);
    });

    it('range l annonce au lieu de remise choisi, avec la cle etrangere en base, et refuse un lieu inconnu (400)', async () => {
      const ok = await request(app.getHttpServer())
        .post('/api/v1/listings')
        .set('Authorization', member())
        .send({ ...validBody, handoverPlace: 'SHOP_LYON' });
      const inconnu = await request(app.getHttpServer())
        .post('/api/v1/listings')
        .set('Authorization', member())
        .send({ ...validBody, handoverPlace: 'SHOP_PARIS' });

      expect(ok.status).toBe(201);
      expect(ok.body.handoverPlace).toEqual({ code: 'SHOP_LYON', label: 'Magasin de Lyon' });
      expect(inconnu.status).toBe(400);
      const rows = await dataSource.query(
        'SELECT h.code FROM listings l JOIN handover_places h ON h.id = l.handover_place_id',
      );
      expect(rows).toEqual([{ code: 'SHOP_LYON' }]);
    });

    it('utilise « a convenir » quand aucun lieu de remise n est precise', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/listings')
        .set('Authorization', member())
        .send(validBody);

      expect(res.body.handoverPlace.code).toBe('TO_AGREE');
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
      expect(publish).not.toHaveBeenCalled();
      expect(await dataSource.query('SELECT 1 FROM listings')).toHaveLength(0);
    });

    it("retire l'annonce et repond 503 si NATS est injoignable", async () => {
      publish.mockRejectedValue(new Error('connexion refusee'));

      const res = await request(app.getHttpServer())
        .post('/api/v1/listings')
        .set('Authorization', member())
        .send(validBody);

      expect(res.status).toBe(503);
      expect(await dataSource.query('SELECT 1 FROM listings')).toHaveLength(0);
    });
  });

  describe('GET /api/v1/categories', () => {
    it('renvoie les huit categories de depart dans l ordre d affichage', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/categories').set('Authorization', member());

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(8);
      expect(res.body[0]).toEqual({ code: 'FIGURINES', label: 'Figurines et statues' });
      expect(res.body[7]).toEqual({ code: 'OTHER', label: 'Autres' });
    });

    it('refuse une requete sans jeton (401)', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/categories');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/handover-places', () => {
    it('renvoie les cinq lieux de depart dans l ordre d affichage', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/handover-places').set('Authorization', member());

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(5);
      expect(res.body[0]).toEqual({ code: 'SHOP_ANGOULEME', label: 'Magasin d’Angoulême' });
      expect(res.body[4]).toEqual({ code: 'TO_AGREE', label: 'À convenir avec le membre' });
    });

    it('refuse une requete sans jeton (401)', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/handover-places');

      expect(res.status).toBe(401);
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
