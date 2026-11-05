/**
 * Configuration de l'API, lue depuis les variables d'environnement.
 * Reprend le principe du projet Spring (application.properties surchargeable par env),
 * sans dependance a @nestjs/config : une fonction pure, facile a tester.
 */
export interface AppConfig {
  port: number;
  /** Requetes autorisees par minute et par IP (a relever pour les tests de charge). */
  throttleLimit: number;
  db: { host: string; port: number; name: string; user: string; password: string };
  rabbit: { host: string; port: number; user: string; password: string };
  keycloak: {
    /** Valeur attendue dans la claim `iss` : URL publique de Keycloak (celle que voit le navigateur). */
    issuer: string;
    /** URL de recuperation des cles publiques : URL interne au cluster (pas de TLS auto-signe a gerer). */
    jwksUri: string;
    /** Clients autorises (claim `azp`) : le front, et le client de test en ligne de commande. */
    allowedClients: string[];
  };
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
    port: num(env, 'PORT', 3000),
    throttleLimit: num(env, 'THROTTLE_LIMIT', 200),
    db: {
      host: env.DB_HOST ?? 'localhost',
      port: num(env, 'DB_PORT', 5432),
      name: env.DB_NAME ?? 'pme',
      user: required(env, 'DB_USER'),
      password: required(env, 'DB_PASSWORD'),
    },
    rabbit: {
      host: env.RABBITMQ_HOST ?? 'localhost',
      port: num(env, 'RABBITMQ_PORT', 5672),
      user: required(env, 'RABBITMQ_USER'),
      password: required(env, 'RABBITMQ_PASSWORD'),
    },
    keycloak: {
      issuer: required(env, 'KEYCLOAK_ISSUER'),
      jwksUri: required(env, 'KEYCLOAK_JWKS_URI'),
      allowedClients: csv(env.KEYCLOAK_ALLOWED_CLIENTS ?? 'pme-web'),
    },
  };
}
