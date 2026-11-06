import { Controller, Get, Header } from '@nestjs/common';
import { registry } from './metrics';

/**
 * Metriques au format Prometheus, lues par Prometheus a l'interieur du cluster.
 * Pas de @Public() ni de @SkipThrottle() : ce service n'a pas de garde globale (voir JwtAuthGuard).
 * Cette route n'est pas atteignable depuis l'exterieur : l'ingress ne relaie que
 * /api/v1/moderation vers ce service (k8s/08-ingress.yaml).
 */
@Controller('metrics')
export class MetricsController {
  @Get()
  @Header('Content-Type', registry.contentType)
  metrics(): Promise<string> {
    return registry.metrics();
  }
}
