import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AckPolicy, JetStreamManager, NatsConnection, connect } from 'nats';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import {
  DEAD_LETTER_REASON_HEADER,
  LISTINGS_DLQ_STREAM,
  LISTINGS_STREAM,
  LISTING_SUBMITTED_DLQ_SUBJECT,
  LISTING_SUBMITTED_SUBJECT,
  MODERATION_CONSUMER,
} from '../../src/moderation/listing-submitted.event';
import { ListingSubmittedConsumer } from '../../src/moderation/listing-submitted.consumer';
import { ensureStreams } from '../../src/moderation/nats-topology';
import { NatsInfo, PostgresInfo, startNats, startPostgres, waitFor } from '../support/infrastructure';

/** Lecteur de test du flux des messages en echec : personne ne le consomme en production. */
const DLQ_READER = 'test-dlq-reader';

/**
 * Service de moderation face a un VRAI NATS (JetStream) et un vrai PostgreSQL (conteneurs jetables).
 * Le producteur publie sur le meme sujet que l'API. Necessite Docker.
 * Lancer avec `npm run test:integration`.
 */
describe('Service de moderation avec NATS (integration)', () => {
  let postgres: PostgresInfo;
  let nats: NatsInfo;
  let connection: NatsConnection;
  let jsm: JetStreamManager;
  let app: INestApplication | undefined;

  const natsConfig = () => ({ host: nats.host, port: nats.port, user: nats.user, password: nats.password });

  // Un identifiant neuf par test : il sert de msgID, et la fenetre de deduplication du flux (2 min) survit a un purge.
  let listingId: string;
  beforeEach(() => {
    listingId = randomUUID();
  });

  const event = (overrides: Record<string, unknown> = {}) => ({
    listingId,
    ownerId: '11111111-1111-4111-8111-111111111111',
    ownerUsername: 'membre',
    title: 'Figurine Pyramid Head',
    description: 'Édition 2019, dans sa boîte.',
    condition: 'GOOD',
    submittedAt: new Date().toISOString(),
    ...overrides,
  });

  let published = 0;

  /** Publie comme le fait l'API (meme sujet, meme deduplication par identifiant d'annonce). */
  const publish = (payload: Record<string, unknown>) =>
    connection.jetstream().publish(LISTING_SUBMITTED_SUBJECT, JSON.stringify(payload), {
      msgID: String(payload.listingId ?? `sans-identifiant-${++published}`),
    });

  /** Messages restant dans un flux : en file de travail, un message acquitte est supprime. */
  const messagesIn = async (stream: string) => (await jsm.streams.info(stream)).state.messages;
  const rowCount = async (dataSource: DataSource) =>
    (await dataSource.query('SELECT count(*)::int AS n FROM moderation_queue'))[0].n as number;

  async function buildApp(): Promise<{ application: INestApplication; dataSource: DataSource }> {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const application = moduleRef.createNestApplication();
    await application.init(); // base + migrations ; le consommateur n'est PAS encore demarre
    const dataSource = application.get(DataSource);
    await dataSource.query('TRUNCATE moderation_queue');
    app = application;
    return { application, dataSource };
  }

  const startConsumer = (application: INestApplication) => application.get(ListingSubmittedConsumer).start();

  beforeAll(async () => {
    [postgres, nats] = await Promise.all([startPostgres('moderation'), startNats()]);
    Object.assign(process.env, {
      DB_HOST: postgres.host,
      DB_PORT: String(postgres.port),
      DB_NAME: postgres.database,
      DB_USER: postgres.user,
      DB_PASSWORD: postgres.password,
      NATS_HOST: nats.host,
      NATS_PORT: String(nats.port),
      NATS_USER: nats.user,
      NATS_PASSWORD: nats.password,
      KEYCLOAK_ISSUER: 'https://keycloak.test/realms/pme',
      KEYCLOAK_JWKS_URI: 'http://127.0.0.1:9/certs', // jamais appele : aucune requete HTTP authentifiee ici
    });

    // Declaration des flux et du consommateur durable, exactement comme au demarrage du service
    await ensureStreams(natsConfig());
    connection = await connect({
      servers: `${nats.host}:${nats.port}`,
      user: nats.user,
      pass: nats.password,
    });
    jsm = await connection.jetstreamManager();
    await jsm.consumers.add(LISTINGS_DLQ_STREAM, { durable_name: DLQ_READER, ack_policy: AckPolicy.Explicit });
  });

  afterEach(async () => {
    await app?.close();
    app = undefined;
    await jsm.streams.purge(LISTINGS_STREAM);
    await jsm.streams.purge(LISTINGS_DLQ_STREAM);
  });

  afterAll(async () => {
    await connection?.close().catch(() => undefined);
    await Promise.all([postgres?.stop(), nats?.stop()]);
  });

  it("consomme l'evenement et place l'annonce dans la file de moderation", async () => {
    // Given : le service de moderation tourne
    const { application, dataSource } = await buildApp();
    await startConsumer(application);

    // When : l'API publie "annonce soumise"
    await publish(event());

    // Then : l'annonce est en base et le message est acquitte (donc retire du flux de travail)
    await waitFor(async () => (await rowCount(dataSource)) === 1, 20_000, "l'annonce dans la file de moderation");
    await waitFor(async () => (await messagesIn(LISTINGS_STREAM)) === 0, 10_000, 'le flux NATS vide');

    const rows = await dataSource.query('SELECT listing_id, status, title FROM moderation_queue');
    expect(rows).toEqual([{ listing_id: event().listingId, status: 'PENDING', title: 'Figurine Pyramid Head' }]);
    expect(await messagesIn(LISTINGS_DLQ_STREAM)).toBe(0);
  });

  it('conserve le message tant que le service est arrete, puis le traite au demarrage', async () => {
    // Given : le service de moderation est arrete (application initialisee, consommateur non demarre)
    const { application, dataSource } = await buildApp();

    // When : une annonce est soumise pendant l'arret
    await publish(event());

    // Then : le message attend dans le flux, rien n'est perdu ni traite
    await waitFor(async () => (await messagesIn(LISTINGS_STREAM)) === 1, 10_000, 'le message en attente');
    expect(await rowCount(dataSource)).toBe(0);

    // When : le service redemarre
    await startConsumer(application);

    // Then : le message est traite et le flux se vide
    await waitFor(async () => (await rowCount(dataSource)) === 1, 20_000, "l'annonce traitee apres redemarrage");
    await waitFor(async () => (await messagesIn(LISTINGS_STREAM)) === 0, 10_000, 'le flux NATS vide');
  });

  it('envoie un message invalide dans le flux des messages en echec, sans rien enregistrer', async () => {
    // Given
    const { application, dataSource } = await buildApp();
    await startConsumer(application);

    // When : un message mal forme arrive
    await publish({ listingId: 'pas-un-uuid', title: '' });

    // Then : il est copie dans le flux d'echec, avec le motif, et ne revient pas en boucle
    await waitFor(async () => (await messagesIn(LISTINGS_DLQ_STREAM)) === 1, 20_000, "le message en flux d'echec");
    const dead = await connection
      .jetstream()
      .consumers.get(LISTINGS_DLQ_STREAM, DLQ_READER)
      .then((consumer) => consumer.next({ expires: 10_000 }));

    expect(dead).not.toBeNull();
    expect(dead?.subject).toBe(LISTING_SUBMITTED_DLQ_SUBJECT);
    expect(dead?.json()).toMatchObject({ listingId: 'pas-un-uuid' });
    expect(dead?.headers?.get(DEAD_LETTER_REASON_HEADER)).toContain('message invalide');
    dead?.ack();

    expect(await rowCount(dataSource)).toBe(0);
    await waitFor(async () => (await messagesIn(LISTINGS_STREAM)) === 0, 10_000, 'le flux principal vide');
  });

  it('expose le consommateur durable attendu par la supervision', async () => {
    // `make queues` lit ces informations sur /jsz : le consommateur doit bien porter ce nom
    const info = await jsm.consumers.info(LISTINGS_STREAM, MODERATION_CONSUMER);
    expect(info.name).toBe(MODERATION_CONSUMER);
    expect(info.config.ack_policy).toBe(AckPolicy.Explicit);
  });
});
