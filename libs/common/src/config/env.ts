/**
 * Lecture de la configuration depuis les variables d'environnement, commune a l'API et au service de moderation.
 * Fonctions pures (l'environnement est un parametre) : faciles a tester, sans dependance a @nestjs/config.
 */
export interface DatabaseConfig {
  host: string;
  port: number;
  name: string;
  user: string;
  password: string;
  /**
   * Chemin du certificat de l'autorite qui a signe celui de PostgreSQL. Defini, il active le TLS avec
   * verification du nom du serveur (equivalent de `sslmode=verify-full`). Absent en developpement local
   * et dans les tests d'integration (Testcontainers demarre un PostgreSQL sans TLS) : connexion en clair.
   */
  sslCaFile?: string;
  /** Connexions maximum ouvertes vers PostgreSQL par instance (voir le budget dans k8s/03-postgres.yaml). */
  poolSize: number;
}

export interface NatsConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  /**
   * Chemin du certificat de l'autorite qui a signe celui de NATS. Defini, il active le TLS avec
   * verification du nom du serveur. Absent en developpement local et dans les tests d'integration
   * (Testcontainers demarre un NATS sans TLS) : connexion en clair.
   */
  tlsCaFile?: string;
}

/** Broker de messages : NATS JetStream (defaut) ou RabbitMQ, choisi par la variable BROKER. */
export type Broker = 'nats' | 'rabbitmq';

export function loadBroker(env: NodeJS.ProcessEnv): Broker {
  const value = (env.BROKER ?? 'nats').toLowerCase();
  if (value !== 'nats' && value !== 'rabbitmq') {
    throw new Error(`BROKER doit valoir "nats" ou "rabbitmq" (recu : "${env.BROKER}")`);
  }
  return value;
}

export interface RabbitMqConfig {
  host: string;
  port: number;
  user: string;
  password: string;
}

export interface KeycloakConfig {
  /** Valeur attendue dans la claim `iss` : URL publique de Keycloak (celle que voit le navigateur). */
  issuer: string;
  /** URL de recuperation des cles publiques : URL interne au cluster (pas de TLS auto-signe a gerer). */
  jwksUri: string;
  /** Clients autorises (claim `azp`) : le front, et le client de test en ligne de commande. */
  allowedClients: string[];
}

export function required(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];
  if (value === undefined || value === '') {
    throw new Error(`Variable d'environnement obligatoire manquante : ${key}`);
  }
  return value;
}

export function num(env: NodeJS.ProcessEnv, key: string, fallback: number): number {
  const raw = env[key];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Variable d'environnement invalide : ${key}="${raw}" (entier positif attendu)`);
  }
  return value;
}

export function csv(value: string): string[] {
  return value
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
}

/** Valeurs par defaut propres a chaque service : nom de sa base et taille de son pool de connexions. */
export interface DatabaseDefaults {
  name: string;
  poolSize: number;
}

export function loadDatabaseConfig(env: NodeJS.ProcessEnv, defaults: DatabaseDefaults): DatabaseConfig {
  return {
    host: env.DB_HOST ?? 'localhost',
    port: num(env, 'DB_PORT', 5432),
    name: env.DB_NAME ?? defaults.name,
    user: required(env, 'DB_USER'),
    password: required(env, 'DB_PASSWORD'),
    sslCaFile: env.DB_SSL_CA || undefined,
    poolSize: num(env, 'DB_POOL_SIZE', defaults.poolSize),
  };
}

export function loadNatsConfig(env: NodeJS.ProcessEnv): NatsConfig {
  return {
    host: env.NATS_HOST ?? 'localhost',
    port: num(env, 'NATS_PORT', 4222),
    user: required(env, 'NATS_USER'),
    password: required(env, 'NATS_PASSWORD'),
    tlsCaFile: env.NATS_TLS_CA || undefined,
  };
}

export function loadRabbitMqConfig(env: NodeJS.ProcessEnv): RabbitMqConfig {
  return {
    host: env.RABBITMQ_HOST ?? 'localhost',
    port: num(env, 'RABBITMQ_PORT', 5672),
    user: required(env, 'RABBITMQ_USER'),
    password: required(env, 'RABBITMQ_PASSWORD'),
  };
}

export function loadKeycloakConfig(env: NodeJS.ProcessEnv): KeycloakConfig {
  return {
    issuer: required(env, 'KEYCLOAK_ISSUER'),
    jwksUri: required(env, 'KEYCLOAK_JWKS_URI'),
    allowedClients: csv(env.KEYCLOAK_ALLOWED_CLIENTS ?? 'pme-web'),
  };
}
