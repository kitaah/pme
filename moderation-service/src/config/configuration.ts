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
 * Configuration du service de moderation, lue depuis les variables d'environnement.
 * Meme principe que l'API ; ce service a SA PROPRE base (`moderation`) : jamais de lecture
 * directe dans la base de l'API, ce qui evite un couplage cache entre les deux services.
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
    port: num(env, 'PORT', 3001),
    throttleLimit: num(env, 'THROTTLE_LIMIT', 200),
    db: loadDatabaseConfig(env, { name: 'moderation', poolSize: 5 }),
    nats: loadNatsConfig(env),
    keycloak: loadKeycloakConfig(env),
  };
}
