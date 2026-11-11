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
}

export function loadConfiguration(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    port: num(env, 'PORT', 3000),
    throttleLimit: num(env, 'THROTTLE_LIMIT', 200),
    db: loadDatabaseConfig(env, { name: 'pme', poolSize: 10 }),
    nats: loadNatsConfig(env),
    keycloak: loadKeycloakConfig(env),
  };
}
