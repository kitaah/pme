import { loadBroker } from './env';

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
