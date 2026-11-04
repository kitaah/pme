import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { RabbitMQContainer } from '@testcontainers/rabbitmq';

export interface PostgresInfo {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  stop: () => Promise<void>;
}

export interface RabbitInfo {
  host: string;
  port: number;
  user: string;
  password: string;
  stop: () => Promise<void>;
}

/**
 * PostgreSQL de test : un conteneur jetable (Testcontainers, comme dans le projet Spring).
 * Si TEST_DB_HOST est defini, on utilise a la place un PostgreSQL deja lance (utile sans Docker).
 */
export async function startPostgres(database: string): Promise<PostgresInfo> {
  if (process.env.TEST_DB_HOST) {
    return {
      host: process.env.TEST_DB_HOST,
      port: Number(process.env.TEST_DB_PORT ?? 5432),
      user: process.env.TEST_DB_USER ?? 'postgres',
      password: process.env.TEST_DB_PASSWORD ?? 'postgres',
      database: process.env.TEST_DB_NAME ?? database,
      stop: async () => undefined,
    };
  }
  const container = await new PostgreSqlContainer('postgres:16-alpine').withDatabase(database).start();
  return {
    host: container.getHost(),
    port: container.getPort(),
    user: container.getUsername(),
    password: container.getPassword(),
    database,
    stop: async () => {
      await container.stop();
    },
  };
}

/** RabbitMQ reel (meme version que le cluster), utilisateur par defaut guest / guest. */
export async function startRabbit(): Promise<RabbitInfo> {
  const container = await new RabbitMQContainer('rabbitmq:3.13-management-alpine').start();
  let stopped = false;
  return {
    host: container.getHost(),
    port: container.getMappedPort(5672),
    user: 'guest',
    password: 'guest',
    // idempotent : un test peut arreter le broker pour simuler une panne, le nettoyage final le rappelle
    stop: async () => {
      if (!stopped) {
        stopped = true;
        await container.stop();
      }
    },
  };
}

/** Attend qu'une condition devienne vraie (sondage toutes les 200 ms). */
export async function waitFor<T>(
  probe: () => Promise<T | undefined | false>,
  timeoutMs = 20_000,
  label = 'condition',
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await probe();
    if (value) {
      return value;
    }
    if (Date.now() > deadline) {
      throw new Error(`Delai depasse en attendant : ${label}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}
