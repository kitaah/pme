import { ServiceUnavailableException } from '@nestjs/common';
import { Registry } from 'prom-client';
import { QueryFailedError } from 'typeorm';
import { BreakerState, DatabaseCircuitBreaker } from './database-circuit-breaker';

const OPTIONS = { timeout: 200, errorThresholdPercentage: 50, volumeThreshold: 3, resetTimeout: 100 };
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('DatabaseCircuitBreaker', () => {
  let transitions: BreakerState[];
  let breaker: DatabaseCircuitBreaker;
  const down = () => Promise.reject(new Error('connect ECONNREFUSED'));

  beforeEach(() => {
    transitions = [];
    breaker = new DatabaseCircuitBreaker('postgresql', OPTIONS, (state) => transitions.push(state));
  });

  afterEach(() => breaker.shutdown());

  async function openCircuit(): Promise<void> {
    for (let i = 0; i < OPTIONS.volumeThreshold; i++) {
      await expect(breaker.run(down)).rejects.toBeInstanceOf(ServiceUnavailableException);
    }
  }

  it('laisse passer les appels tant que la base repond', async () => {
    await expect(breaker.run(async () => 'ok')).resolves.toBe('ok');
    expect(breaker.state).toBe('closed');
  });

  it("s'ouvre apres des pannes repetees et repond 503 sans appeler la base", async () => {
    await openCircuit();
    const action = jest.fn(async () => 'ok');

    await expect(breaker.run(action)).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(breaker.state).toBe('open');
    expect(action).not.toHaveBeenCalled();
    expect(transitions).toEqual(['open']);
  });

  it("se referme quand l'appel d'essai reussit apres la pause", async () => {
    await openCircuit();
    await sleep(OPTIONS.resetTimeout + 50);

    await expect(breaker.run(async () => 'ok')).resolves.toBe('ok');

    expect(breaker.state).toBe('closed');
    expect(transitions).toEqual(['open', 'half-open', 'closed']);
  });

  it("se rouvre quand l'appel d'essai echoue encore", async () => {
    await openCircuit();
    await sleep(OPTIONS.resetTimeout + 50);

    await expect(breaker.run(down)).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(breaker.state).toBe('open');
    expect(transitions).toEqual(['open', 'half-open', 'open']);
  });

  it("ne s'ouvre pas sur une erreur de donnees : la base est joignable", async () => {
    const duplicate = () =>
      Promise.reject(new QueryFailedError('INSERT', [], Object.assign(new Error('doublon'), { code: '23505' })));

    for (let i = 0; i < OPTIONS.volumeThreshold * 2; i++) {
      await expect(breaker.run(duplicate)).rejects.toBeInstanceOf(QueryFailedError);
    }

    expect(breaker.state).toBe('closed');
  });

  it('publie son etat dans la metrique circuit_breaker_state', async () => {
    const registry = new Registry();
    breaker.exposeMetric(registry);
    expect(await registry.metrics()).toContain('circuit_breaker_state{name="postgresql"} 0');

    await openCircuit();

    expect(await registry.metrics()).toContain('circuit_breaker_state{name="postgresql"} 2');
  });
});
