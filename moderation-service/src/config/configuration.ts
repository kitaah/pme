/**
 * Configuration du service de moderation, lue depuis les variables d'environnement.
 * Meme principe que l'API ; ce service a SA PROPRE base (`moderation`) : jamais de lecture
 * directe dans la base de l'API, ce qui evite un couplage cache entre les deux services.
 */
export interface AppConfig {
  port: number;
  /** Requetes autorisees par minute et par IP (a relever pour les tests de charge). */
  throttleLimit: number;
  db: {
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
    /** Connexions maximum ouvertes vers PostgreSQL par instance (voir le budget dans k8s/01-postgres.yaml). */
    poolSize: number;
  };
  nats: {
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
  };
  keycloak: { issuer: string; jwksUri: string; allowedClients: string[] };
}

function required(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];
  if (value === undefined || value === '') {
    throw new Error(`Variable d'environnement obligatoire manquante : ${key}`);
  }
  return value;
}

function num(env: NodeJS.ProcessEnv, key: string, fallback: number): number {
  const raw = env[key];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Variable d'environnement invalide : ${key}="${raw}" (entier positif attendu)`);
  }
  return value;
}

function csv(value: string): string[] {
  return value
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
}

export function loadConfiguration(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    port: num(env, 'PORT', 3001),
    throttleLimit: num(env, 'THROTTLE_LIMIT', 200),
    db: {
      host: env.DB_HOST ?? 'localhost',
      port: num(env, 'DB_PORT', 5432),
      name: env.DB_NAME ?? 'moderation',
      user: required(env, 'DB_USER'),
      password: required(env, 'DB_PASSWORD'),
      sslCaFile: env.DB_SSL_CA || undefined,
      poolSize: num(env, 'DB_POOL_SIZE', 5),
    },
    nats: {
      host: env.NATS_HOST ?? 'localhost',
      port: num(env, 'NATS_PORT', 4222),
      user: required(env, 'NATS_USER'),
      password: required(env, 'NATS_PASSWORD'),
      tlsCaFile: env.NATS_TLS_CA || undefined,
    },
    keycloak: {
      issuer: required(env, 'KEYCLOAK_ISSUER'),
      jwksUri: required(env, 'KEYCLOAK_JWKS_URI'),
      allowedClients: csv(env.KEYCLOAK_ALLOWED_CLIENTS ?? 'pme-web'),
    },
  };
}
