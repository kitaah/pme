import { csv, loadDatabaseConfig, loadKeycloakConfig, loadNatsConfig, num, required } from './env';

describe('required', () => {
  it('renvoie la valeur de la variable', () => {
    expect(required({ DB_USER: 'pme' }, 'DB_USER')).toBe('pme');
  });

  it.each([undefined, ''])('refuse une variable absente ou vide (%p)', (value) => {
    expect(() => required({ DB_USER: value }, 'DB_USER')).toThrow(
      "Variable d'environnement obligatoire manquante : DB_USER",
    );
  });
});

describe('num', () => {
  it('lit un entier', () => {
    expect(num({ PORT: '8080' }, 'PORT', 3000)).toBe(8080);
  });

  it.each([undefined, ''])('utilise la valeur par defaut quand la variable est absente ou vide (%p)', (value) => {
    expect(num({ PORT: value }, 'PORT', 3000)).toBe(3000);
  });

  it.each(['abc', '-1', '3.5'])('refuse une valeur invalide (%s)', (value) => {
    expect(() => num({ PORT: value }, 'PORT', 3000)).toThrow("Variable d'environnement invalide : PORT");
  });
});

describe('csv', () => {
  it('decoupe, nettoie et ignore les elements vides', () => {
    expect(csv('pme-web, pme-cli ,,')).toEqual(['pme-web', 'pme-cli']);
  });
});

describe('loadDatabaseConfig', () => {
  const defaults = { name: 'pme', poolSize: 10 };
  const minimal = { DB_USER: 'pme', DB_PASSWORD: 'secret' };

  it('applique les valeurs par defaut du service', () => {
    expect(loadDatabaseConfig(minimal, defaults)).toEqual({
      host: 'localhost',
      port: 5432,
      name: 'pme',
      user: 'pme',
      password: 'secret',
      sslCaFile: undefined,
      poolSize: 10,
    });
  });

  it('lit toutes les variables fournies', () => {
    const config = loadDatabaseConfig(
      {
        ...minimal,
        DB_HOST: 'postgres',
        DB_PORT: '6543',
        DB_NAME: 'autre',
        DB_SSL_CA: '/certs/ca.crt',
        DB_POOL_SIZE: '4',
      },
      defaults,
    );

    expect(config).toMatchObject({
      host: 'postgres',
      port: 6543,
      name: 'autre',
      sslCaFile: '/certs/ca.crt',
      poolSize: 4,
    });
  });

  it('traite DB_SSL_CA vide comme absent', () => {
    expect(loadDatabaseConfig({ ...minimal, DB_SSL_CA: '' }, defaults).sslCaFile).toBeUndefined();
  });

  it.each(['DB_USER', 'DB_PASSWORD'])('refuse de demarrer sans %s', (key) => {
    expect(() => loadDatabaseConfig({ ...minimal, [key]: undefined }, defaults)).toThrow(key);
  });
});

describe('loadNatsConfig', () => {
  const minimal = { NATS_USER: 'nats', NATS_PASSWORD: 'secret' };

  it('applique les valeurs par defaut', () => {
    expect(loadNatsConfig(minimal)).toEqual({
      host: 'localhost',
      port: 4222,
      user: 'nats',
      password: 'secret',
      tlsCaFile: undefined,
    });
  });

  it('lit toutes les variables fournies', () => {
    expect(
      loadNatsConfig({ ...minimal, NATS_HOST: 'nats', NATS_PORT: '4223', NATS_TLS_CA: '/certs/ca.crt' }),
    ).toMatchObject({
      host: 'nats',
      port: 4223,
      tlsCaFile: '/certs/ca.crt',
    });
  });

  it.each(['NATS_USER', 'NATS_PASSWORD'])('refuse de demarrer sans %s', (key) => {
    expect(() => loadNatsConfig({ ...minimal, [key]: undefined })).toThrow(key);
  });
});

describe('loadKeycloakConfig', () => {
  const minimal = {
    KEYCLOAK_ISSUER: 'https://keycloak.localhost/realms/pme',
    KEYCLOAK_JWKS_URI: 'https://keycloak:8443/realms/pme/protocol/openid-connect/certs',
  };

  it('autorise le client pme-web par defaut', () => {
    expect(loadKeycloakConfig(minimal)).toEqual({
      issuer: minimal.KEYCLOAK_ISSUER,
      jwksUri: minimal.KEYCLOAK_JWKS_URI,
      allowedClients: ['pme-web'],
    });
  });

  it('lit la liste des clients autorises', () => {
    expect(loadKeycloakConfig({ ...minimal, KEYCLOAK_ALLOWED_CLIENTS: 'pme-web, pme-cli' }).allowedClients).toEqual([
      'pme-web',
      'pme-cli',
    ]);
  });

  it.each(['KEYCLOAK_ISSUER', 'KEYCLOAK_JWKS_URI'])('refuse de demarrer sans %s', (key) => {
    expect(() => loadKeycloakConfig({ ...minimal, [key]: undefined })).toThrow(key);
  });
});
