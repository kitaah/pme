import type { NextFunction, Request, Response } from 'express';
import { collectDefaultMetrics, Histogram, Registry } from 'prom-client';

/** Registre unique du service : metriques du processus Node.js et duree des requetes HTTP. */
export const registry = new Registry();
collectDefaultMetrics({ register: registry });

const httpDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duree des requetes HTTP, par methode, route et code de statut',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [registry],
});

// Sondes Kubernetes et lecture des metriques : ni utiles ni souhaitees dans les statistiques.
const IGNORED_PREFIXES = ['/api/health', '/api/metrics'];

/**
 * Mesure la duree de chaque requete. L'etiquette `route` est le modele de la route (ex. /api/v1/listings/:id),
 * jamais l'URL reelle : cela limite le nombre de series. Une route inconnue (404) devient `inconnue`.
 */
export function httpMetricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (IGNORED_PREFIXES.some((prefix) => req.path.startsWith(prefix))) {
    next();
    return;
  }
  const stopTimer = httpDuration.startTimer();
  res.on('finish', () => {
    const route = (req.route as { path?: string } | undefined)?.path ?? 'inconnue';
    stopTimer({ method: req.method, route, status: res.statusCode });
  });
  next();
}
