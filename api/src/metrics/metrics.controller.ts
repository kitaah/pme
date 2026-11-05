import { Controller, Get, Header } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../auth/public.decorator';
import { registry } from './metrics';

/**
 * Metriques au format Prometheus, lues par Prometheus a l'interieur du cluster.
 * Le serveur nginx du front renvoie 404 sur cette route : elle n'est jamais exposee a l'exterieur.
 */
@Public()
@SkipThrottle()
@Controller('metrics')
export class MetricsController {
  @Get()
  @Header('Content-Type', registry.contentType)
  metrics(): Promise<string> {
    return registry.metrics();
  }
}
