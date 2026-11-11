import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { Registry } from 'prom-client';
import { QueryFailedError } from 'typeorm';
import { BreakerState, DatabaseCircuitBreaker } from './database-circuit-breaker';

const FAST = { timeout: 200, errorThresholdPercentage: 50, volumeThreshold: 1, resetTimeout: 60_000 };

/** Attend (au plus 1 s) qu'une condition devienne vraie : evite un delai fixe, source de tests instables. */
async function waitFor(condition: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100 && !condition(); attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

function queryError(code: string): QueryFailedError {
  return new QueryFailedError('INSERT ...', [], Object.assign(new Error('requete refusee'), { code }));
}

describe('DatabaseCircuitBreaker', () => {
  let breaker: DatabaseCircuitBreaker;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    breaker.shutdown();
    jest.restoreAllMocks();
  });

  it('laisse passer les appels quand la base repond', async () => {
    breaker = new DatabaseCircuitBreaker('test', FAST);

    await expect(breaker.run(async () => 42)).resolves.toBe(42);
    expect(breaker.state).toBe('closed');
  });

  it('transforme une panne de connexion en 503', async () => {
    breaker = new DatabaseCircuitBreaker('test', { ...FAST, volumeThreshold: 100 });

    await expect(breaker.run(() => Promise.reject(new Error('ECONNREFUSED')))).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(Logger.prototype.warn).toHaveBeenCalledTimes(1);
  });

  it('transforme un delai depasse en 503', async () => {
    breaker = new DatabaseCircuitBreaker('test', { ...FAST, timeout: 20, volumeThreshold: 100 });

    await expect(breaker.run(() => new Promise<never>(() => undefined))).rejects.toThrow(ServiceUnavailableException);
  });

  it('remonte telle quelle une erreur de donnees : la base repond, elle n est pas en panne', async () => {
    breaker = new DatabaseCircuitBreaker('test', FAST);
    const error = queryError('23505');

    await expect(breaker.run(() => Promise.reject(error))).rejects.toBe(error);
    expect(breaker.state).toBe('closed');
  });

  it('traite une erreur de requete sans code SQLSTATE comme une panne', async () => {
    breaker = new DatabaseCircuitBreaker('test', { ...FAST, volumeThreshold: 100 });

    await expect(
      breaker.run(() => Promise.reject(new QueryFailedError('SELECT 1', [], new Error('inconnu')))),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('ouvre le circuit apres trop d echecs puis repond 503 sans appeler la base', async () => {
    const transitions: BreakerState[] = [];
    breaker = new DatabaseCircuitBreaker('test', FAST, (state) => transitions.push(state));
    const failing = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(breaker.run(failing)).rejects.toThrow(ServiceUnavailableException);
    expect(breaker.state).toBe('open');
    expect(transitions).toEqual(['open']);

    await expect(breaker.run(failing)).rejects.toThrow(ServiceUnavailableException);
    expect(failing).toHaveBeenCalledTimes(1);
  });

  it('publie l etat du circuit dans le registre Prometheus', async () => {
    breaker = new DatabaseCircuitBreaker('test', FAST);
    const registry = new Registry();
    breaker.exposeMetric(registry);

    expect(await registry.metrics()).toContain('circuit_breaker_state{name="test"} 0');

    await breaker.run(() => Promise.reject(new Error('ECONNREFUSED'))).catch(() => undefined);

    expect(await registry.metrics()).toContain('circuit_breaker_state{name="test"} 2');
  });

  it("passe en semi-ouvert apres le delai, puis se referme quand l'appel d'essai reussit", async () => {
    const transitions: BreakerState[] = [];
    breaker = new DatabaseCircuitBreaker('test', { ...FAST, resetTimeout: 30 }, (state) => transitions.push(state));
    await breaker.run(() => Promise.reject(new Error('ECONNREFUSED'))).catch(() => undefined);
    expect(breaker.state).toBe('open');

    await waitFor(() => breaker.state === 'half-open');
    await expect(breaker.run(async () => 'ok')).resolves.toBe('ok');

    expect(breaker.state).toBe('closed');
    expect(transitions).toEqual(['open', 'half-open', 'closed']);
  });

  it("ne planifie rien quand aucun observateur de transition n'est fourni", async () => {
    breaker = new DatabaseCircuitBreaker('test', FAST);

    await breaker.run(() => Promise.reject(new Error('ECONNREFUSED'))).catch(() => undefined);

    expect(breaker.state).toBe('open');
  });

  it('utilise le nom et les reglages par defaut', () => {
    breaker = new DatabaseCircuitBreaker();

    expect(breaker.name).toBe('postgresql');
    expect(breaker.state).toBe('closed');
  });
});
