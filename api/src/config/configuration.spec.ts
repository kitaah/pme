import { loadConfiguration } from './configuration';

describe('loadConfiguration', () => {
  const minimal: NodeJS.ProcessEnv = {
    DB_USER: 'pme',
    DB_PASSWORD: 'secret',
    NATS_USER: 'nats',
    NATS_PASSWORD: 'secret-nats',
    KEYCLOAK_ISSUER: 'https://keycloak.localhost/realms/pme',
    KEYCLOAK_JWKS_URI: 'https://keycloak:8443/realms/pme/protocol/openid-connect/certs',
  };

  it('applique les valeurs par defaut propres au service', () => {
    const config = loadConfiguration(minimal);

    expect(config.port).toBe(3000);
    expect(config.throttleLimit).toBe(200);
    expect(config.db).toMatchObject({ name: 'pme', poolSize: 10 });
    expect(config.nats).toMatchObject({ user: 'nats', host: 'localhost' });
    expect(config.keycloak).toMatchObject({ issuer: minimal.KEYCLOAK_ISSUER, allowedClients: ['pme-web'] });
  });

  it('lit le port et la limite de debit dans l environnement', () => {
    const config = loadConfiguration({ ...minimal, PORT: '8080', THROTTLE_LIMIT: '1000' });

    expect(config.port).toBe(8080);
    expect(config.throttleLimit).toBe(1000);
  });

  it('refuse de demarrer sans les variables obligatoires', () => {
    expect(() => loadConfiguration({ ...minimal, DB_PASSWORD: undefined })).toThrow('DB_PASSWORD');
  });

  it('lit process.env quand aucun environnement n est fourni', () => {
    const saved = { ...process.env };
    Object.assign(process.env, minimal);
    try {
      expect(loadConfiguration().db.user).toBe('pme');
    } finally {
      process.env = saved;
    }
  });
});
