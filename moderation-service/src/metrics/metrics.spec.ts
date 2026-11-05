import { EventEmitter } from 'node:events';
import type { Request, Response } from 'express';
import { httpMetricsMiddleware, registry } from './metrics';
import { MetricsController } from './metrics.controller';

function exchange(path: string, routePath?: string, status = 200) {
  const req = { method: 'GET', path, route: routePath ? { path: routePath } : undefined } as unknown as Request;
  const res = Object.assign(new EventEmitter(), { statusCode: status }) as unknown as Response;
  return { req, res };
}

describe('metriques HTTP', () => {
  beforeEach(() => registry.resetMetrics());

  it('enregistre la duree d une requete avec le modele de route et le statut', async () => {
    const { req, res } = exchange('/api/v1/listings/42', '/api/v1/listings/:id', 201);
    const next = jest.fn();

    httpMetricsMiddleware(req, res, next);
    res.emit('finish');

    expect(next).toHaveBeenCalledTimes(1);
    const text = await registry.metrics();
    expect(text).toContain(
      'http_request_duration_seconds_count{method="GET",route="/api/v1/listings/:id",status="201"} 1',
    );
  });

  it('nomme `inconnue` une route sans modele (404)', async () => {
    const { req, res } = exchange('/nimporte/quoi');

    httpMetricsMiddleware(req, res, jest.fn());
    res.emit('finish');

    expect(await registry.metrics()).toContain('route="inconnue"');
  });

  it.each(['/api/health/liveness', '/api/metrics'])('ignore %s', async (path) => {
    const { req, res } = exchange(path, path);
    const next = jest.fn();

    httpMetricsMiddleware(req, res, next);
    res.emit('finish');

    expect(next).toHaveBeenCalledTimes(1);
    expect(await registry.metrics()).not.toContain(`route="${path}"`);
  });
});

describe('MetricsController', () => {
  it('renvoie les metriques du processus au format Prometheus', async () => {
    const text = await new MetricsController().metrics();

    expect(text).toContain('# TYPE process_cpu_user_seconds_total counter');
  });
});
