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

  it('applique les valeurs par defaut du stockage des photos : desactive sans cle', () => {
    const { s3 } = loadConfiguration(minimal);

    expect(s3).toEqual({
      endpoint: 'http://localhost:3900',
      publicEndpoint: 'http://localhost:3900',
      region: 'garage',
      bucket: 'pme-photos',
      accessKey: '',
      secretKey: '',
      urlTtlSeconds: 300,
    });
  });

  it('lit le stockage des photos dans l environnement, avec une adresse publique distincte de l interne', () => {
    const { s3 } = loadConfiguration({
      ...minimal,
      S3_ENDPOINT: 'https://garage:3900',
      S3_PUBLIC_ENDPOINT: 'https://garage.localhost',
      S3_REGION: 'eu',
      S3_BUCKET: 'photos',
      S3_ACCESS_KEY: 'GKabc',
      S3_SECRET_KEY: 'secret',
      S3_URL_TTL: '60',
    });

    expect(s3).toEqual({
      endpoint: 'https://garage:3900',
      publicEndpoint: 'https://garage.localhost',
      region: 'eu',
      bucket: 'photos',
      accessKey: 'GKabc',
      secretKey: 'secret',
      urlTtlSeconds: 60,
    });
  });

  it('prend l adresse interne pour la signature quand aucune adresse publique n est donnee', () => {
    const { s3 } = loadConfiguration({ ...minimal, S3_ENDPOINT: 'https://garage:3900' });

    expect(s3.publicEndpoint).toBe('https://garage:3900');
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
