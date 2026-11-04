import { INestApplication } from '@nestjs/common';
import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';
import { Test } from '@nestjs/testing';
import { connect } from 'amqplib';
import { lastValueFrom } from 'rxjs';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import {
  LISTING_SUBMITTED,
  LISTING_SUBMITTED_DLQ,
  LISTING_SUBMITTED_QUEUE,
  LISTING_SUBMITTED_QUEUE_OPTIONS,
} from '../../src/moderation/listing-submitted.event';
import { rabbitConsumerOptions } from '../../src/moderation/rabbit-options';
import { ensureDeadLetterQueue } from '../../src/moderation/rabbit-topology';
import { PostgresInfo, RabbitInfo, startPostgres, startRabbit, waitFor } from '../support/infrastructure';

/**
 * Service de moderation face a un VRAI RabbitMQ et un vrai PostgreSQL (conteneurs jetables).
 * Le producteur est configure comme celui de l'API (memes options de file) : si les arguments de
 * la file divergeaient entre les deux services, RabbitMQ refuserait la declaration et ces tests echoueraient.
 * Necessite Docker. Lancer avec `npm run test:integration`.
 */
describe('Service de moderation avec RabbitMQ (integration)', () => {
  let postgres: PostgresInfo;
  let rabbit: RabbitInfo;
  let connection: Awaited<ReturnType<typeof connect>>;
  let channel: Awaited<ReturnType<Awaited<ReturnType<typeof connect>>['createChannel']>>;
  let producer: ClientProxy;
  let app: INestApplication | undefined;

  const rabbitConfig = () => ({ host: rabbit.host, port: rabbit.port, user: rabbit.user, password: rabbit.password });

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

  const publish = (payload: unknown) =>
    lastValueFrom(producer.emit(LISTING_SUBMITTED, payload), { defaultValue: undefined });
  const messagesIn = async (queue: string) => (await channel.checkQueue(queue)).messageCount;
  const rowCount = async (dataSource: DataSource) =>
    (await dataSource.query('SELECT count(*)::int AS n FROM moderation_queue'))[0].n as number;

  async function buildApp(): Promise<{ application: INestApplication; dataSource: DataSource }> {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const application = moduleRef.createNestApplication();
    application.connectMicroservice(rabbitConsumerOptions(rabbitConfig()));
    await application.init(); // base + migrations ; le consommateur n'est PAS encore demarre
    const dataSource = application.get(DataSource);
    await dataSource.query('TRUNCATE moderation_queue');
    app = application;
    return { application, dataSource };
  }

  beforeAll(async () => {
    [postgres, rabbit] = await Promise.all([startPostgres('moderation'), startRabbit()]);
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
      KEYCLOAK_ISSUER: 'https://keycloak.test/realms/pme',
      KEYCLOAK_JWKS_URI: 'http://127.0.0.1:9/certs', // jamais appele : aucune requete HTTP authentifiee ici
    });

    await ensureDeadLetterQueue(rabbitConfig());
    connection = await connect({
      protocol: 'amqp',
      hostname: rabbit.host,
      port: rabbit.port,
      username: rabbit.user,
      password: rabbit.password,
    });
    channel = await connection.createChannel();
    // meme declaration que l'API : echoue (PRECONDITION_FAILED) si les arguments divergent
    await channel.assertQueue(LISTING_SUBMITTED_QUEUE, LISTING_SUBMITTED_QUEUE_OPTIONS);

    producer = ClientProxyFactory.create({
      transport: Transport.RMQ,
      options: {
        urls: [
          {
            protocol: 'amqp',
            hostname: rabbit.host,
            port: rabbit.port,
            username: rabbit.user,
            password: rabbit.password,
          },
        ],
        queue: LISTING_SUBMITTED_QUEUE,
        queueOptions: LISTING_SUBMITTED_QUEUE_OPTIONS,
        persistent: true,
      },
    });
  });

  afterEach(async () => {
    await app?.close();
    app = undefined;
    await channel.purgeQueue(LISTING_SUBMITTED_QUEUE);
    await channel.purgeQueue(LISTING_SUBMITTED_DLQ);
  });

  afterAll(async () => {
    await producer?.close();
    await channel?.close();
    await connection?.close();
    await Promise.all([postgres?.stop(), rabbit?.stop()]);
  });

  it("consomme l'evenement et place l'annonce dans la file de moderation", async () => {
    // Given : le service de moderation tourne
    const { application, dataSource } = await buildApp();
    await application.startAllMicroservices();

    // When : l'API publie "annonce soumise"
    await publish(event());

    // Then : l'annonce est en base, le message est acquitte (file vide) et le consommateur reste connecte
    await waitFor(async () => (await rowCount(dataSource)) === 1, 20_000, "l'annonce dans la file de moderation");
    await waitFor(async () => (await messagesIn(LISTING_SUBMITTED_QUEUE)) === 0, 10_000, 'la file RabbitMQ vide');
    expect((await channel.checkQueue(LISTING_SUBMITTED_QUEUE)).consumerCount).toBe(1);
  });

  it('conserve le message tant que le service est arrete, puis le traite au demarrage', async () => {
    // Given : le service de moderation est arrete (application initialisee, consommateur non demarre)
    const { application, dataSource } = await buildApp();

    // When : une annonce est soumise pendant l'arret
    await publish(event());

    // Then : le message attend dans RabbitMQ, rien n'est perdu ni traite
    await waitFor(async () => (await messagesIn(LISTING_SUBMITTED_QUEUE)) === 1, 10_000, 'le message en attente');
    expect(await rowCount(dataSource)).toBe(0);

    // When : le service redemarre
    await application.startAllMicroservices();

    // Then : le message est traite et la file se vide
    await waitFor(async () => (await rowCount(dataSource)) === 1, 20_000, "l'annonce traitee apres redemarrage");
    await waitFor(async () => (await messagesIn(LISTING_SUBMITTED_QUEUE)) === 0, 10_000, 'la file RabbitMQ vide');
  });

  it('envoie un message invalide dans la file des messages en echec, sans rien enregistrer', async () => {
    // Given
    const { application, dataSource } = await buildApp();
    await application.startAllMicroservices();

    // When : un message mal forme arrive
    await publish({ listingId: 'pas-un-uuid', title: '' });

    // Then : RabbitMQ le range dans la file d'echec (rejected), il n'est ni perdu ni rejoue en boucle
    const dead = await waitFor(
      async () => (await channel.get(LISTING_SUBMITTED_DLQ, { noAck: true })) || undefined,
      20_000,
      "le message en file d'echec",
    );
    expect(JSON.parse(dead.content.toString()).data.listingId).toBe('pas-un-uuid');
    expect(dead.properties.headers?.['x-death']?.[0]?.reason).toBe('rejected');
    expect(await rowCount(dataSource)).toBe(0);
    expect(await messagesIn(LISTING_SUBMITTED_QUEUE)).toBe(0);
  });
});
