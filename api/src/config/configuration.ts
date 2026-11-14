import {
  DatabaseConfig,
  KeycloakConfig,
  NatsConfig,
  loadDatabaseConfig,
  loadKeycloakConfig,
  loadNatsConfig,
  num,
} from '@pme/common';

/**
 * Stockage objet des photos (S3 : Garage en local, hebergeur europeen ensuite).
 *
 * Classe et non interface : c'est aussi le jeton d'injection du module de stockage
 * (une interface TypeScript n'existe plus a l'execution).
 *
 * `endpoint` est l'adresse INTERNE, utilisee par l'API pour ecrire ; `publicEndpoint` est celle
 * que le navigateur utilisera pour lire. Les deux sont necessaires : la signature d'une URL
 * couvre le nom d'hote, elle doit donc etre calculee pour l'adresse publique.
 *
 * Cles absentes : le stockage est desactive (developpement local, tests d'integration). Le depot
 * sans photo continue de fonctionner.
 */
export class S3Config {
  endpoint: string;
  publicEndpoint: string;
  region: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  /** Duree de validite d'une URL de lecture signee. */
  urlTtlSeconds: number;
}

/**
 * Configuration de l'API, lue depuis les variables d'environnement.
 * Reprend le principe du projet Spring (application.properties surchargeable par env),
 * sans dependance a @nestjs/config : une fonction pure, facile a tester.
 * La lecture des blocs communs (base, NATS, Keycloak) est dans le module partage @pme/common.
 */
export interface AppConfig {
  port: number;
  /** Requetes autorisees par minute et par IP (a relever pour les tests de charge). */
  throttleLimit: number;
  db: DatabaseConfig;
  nats: NatsConfig;
  keycloak: KeycloakConfig;
  s3: S3Config;
}

export function loadConfiguration(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const endpoint = env.S3_ENDPOINT ?? 'http://localhost:3900';
  return {
    port: num(env, 'PORT', 3000),
    throttleLimit: num(env, 'THROTTLE_LIMIT', 200),
    db: loadDatabaseConfig(env, { name: 'pme', poolSize: 10 }),
    nats: loadNatsConfig(env),
    keycloak: loadKeycloakConfig(env),
    s3: {
      endpoint,
      publicEndpoint: env.S3_PUBLIC_ENDPOINT ?? endpoint,
      region: env.S3_REGION ?? 'garage',
      bucket: env.S3_BUCKET ?? 'pme-photos',
      accessKey: env.S3_ACCESS_KEY ?? '',
      secretKey: env.S3_SECRET_KEY ?? '',
      urlTtlSeconds: num(env, 'S3_URL_TTL', 300),
    },
  };
}
