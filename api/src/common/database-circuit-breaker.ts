import { ServiceUnavailableException } from '@nestjs/common';
import CircuitBreaker from 'opossum';
import { Gauge, Registry } from 'prom-client';
import { QueryFailedError } from 'typeorm';

/** Etats du disjoncteur, exposes tels quels dans la metrique `circuit_breaker_state`. */
export type BreakerState = 'closed' | 'half-open' | 'open';

export interface BreakerOptions {
  /** Duree maximale d'un appel avant qu'il compte comme un echec (ms). */
  timeout: number;
  /** Part d'echecs (en %) a partir de laquelle le circuit s'ouvre. */
  errorThresholdPercentage: number;
  /** Nombre minimal d'appels dans la fenetre avant d'evaluer la part d'echecs. */
  volumeThreshold: number;
  /** Duree pendant laquelle le circuit reste ouvert avant de laisser passer un appel d'essai (ms). */
  resetTimeout: number;
}

export const DEFAULT_BREAKER_OPTIONS: BreakerOptions = {
  timeout: 3000,
  errorThresholdPercentage: 50,
  volumeThreshold: 5,
  resetTimeout: 10_000,
};

/** Classes SQLSTATE d'une erreur de donnees ou de requete : la base repond, elle n'est donc pas en panne. */
const QUERY_ERROR_CLASSES = ['22', '23', '42'];

/**
 * Une erreur de requete (contrainte violee, syntaxe) prouve que la base est joignable : elle ne doit pas
 * ouvrir le circuit. Seules les pannes de connexion et les delais depasses comptent.
 */
function isBusinessError(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) return false;
  const code = (error.driverError as { code?: unknown } | undefined)?.code;
  return typeof code === 'string' && QUERY_ERROR_CLASSES.some((prefix) => code.startsWith(prefix));
}

/**
 * Disjoncteur devant PostgreSQL (equivalent Node du Resilience4j du projet Spring).
 *
 * Fermé : les appels passent. Quand trop d'appels echouent, le circuit s'ouvre : les appels suivants echouent
 * aussitot en 503, sans attendre le delai de connexion. Apres `resetTimeout`, un appel d'essai est autorise
 * (semi-ouvert) : s'il reussit le circuit se referme, sinon il se rouvre.
 */
export class DatabaseCircuitBreaker {
  private readonly breaker: CircuitBreaker<[() => Promise<unknown>], unknown>;

  constructor(
    readonly name = 'postgresql',
    options: BreakerOptions = DEFAULT_BREAKER_OPTIONS,
    private readonly onTransition: (state: BreakerState) => void = () => undefined,
  ) {
    this.breaker = new CircuitBreaker(async (action: () => Promise<unknown>) => action(), {
      ...options,
      name,
      errorFilter: isBusinessError,
    });
    this.breaker.on('open', () => this.onTransition('open'));
    this.breaker.on('halfOpen', () => this.onTransition('half-open'));
    this.breaker.on('close', () => this.onTransition('closed'));
  }

  get state(): BreakerState {
    if (this.breaker.opened) return 'open';
    return this.breaker.halfOpen ? 'half-open' : 'closed';
  }

  /** Execute l'appel a la base. Circuit ouvert : 503 immediat. Autre echec : l'erreur d'origine remonte. */
  async run<T>(action: () => Promise<T>): Promise<T> {
    try {
      return (await this.breaker.fire(action)) as T;
    } catch (error) {
      if ((error as { code?: string }).code === 'EOPENBREAKER') {
        throw new ServiceUnavailableException(
          'La base de données est momentanément indisponible. Réessayez dans un instant.',
        );
      }
      throw error;
    }
  }

  /** Publie l'etat du circuit dans le registre Prometheus : 0 = ferme, 1 = semi-ouvert, 2 = ouvert. */
  exposeMetric(registry: Registry): void {
    const levels: Record<BreakerState, number> = { closed: 0, 'half-open': 1, open: 2 };
    const gauge: Gauge<'name'> = new Gauge<'name'>({
      name: 'circuit_breaker_state',
      help: 'Etat du disjoncteur : 0 = ferme, 1 = semi-ouvert, 2 = ouvert',
      labelNames: ['name'],
      registers: [registry],
      collect: () => gauge.set({ name: this.name }, levels[this.state]),
    });
  }

  shutdown(): void {
    this.breaker.shutdown();
  }
}
