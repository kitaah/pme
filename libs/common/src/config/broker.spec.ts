import { loadBroker, loadRabbitMqConfig } from './env';

describe('loadBroker', () => {
  it('choisit NATS par defaut', () => {
    expect(loadBroker({})).toBe('nats');
  });

  it('accepte rabbitmq, sans tenir compte de la casse', () => {
    expect(loadBroker({ BROKER: 'RabbitMQ' })).toBe('rabbitmq');
  });

  it('refuse une valeur inconnue', () => {
    expect(() => loadBroker({ BROKER: 'kafka' })).toThrow('BROKER');
  });
});

describe('loadRabbitMqConfig', () => {
  const env = { RABBITMQ_USER: 'pme', RABBITMQ_PASSWORD: 'secret' };

  it('utilise le port en clair sans autorite TLS', () => {
    expect(loadRabbitMqConfig(env)).toMatchObject({ host: 'localhost', port: 5672, tlsCaFile: undefined });
  });

  it('passe au port chiffre des que l autorite TLS est fournie', () => {
    expect(loadRabbitMqConfig({ ...env, RABBITMQ_TLS_CA: '/etc/ssl/pme/ca.crt' })).toMatchObject({
      port: 5671,
      tlsCaFile: '/etc/ssl/pme/ca.crt',
    });
  });

  it('laisse le port explicite l emporter', () => {
    expect(loadRabbitMqConfig({ ...env, RABBITMQ_PORT: '5999', RABBITMQ_TLS_CA: '/ca.crt' }).port).toBe(5999);
  });

  it('exige un identifiant', () => {
    expect(() => loadRabbitMqConfig({})).toThrow('RABBITMQ_USER');
  });
});
