import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Sondes Kubernetes (equivalent des /actuator/health/liveness et /readiness de Spring).
 * Pas de @Public() ni de @SkipThrottle() ici : ce service n'a pas de garde globale a
 * court-circuiter (voir JwtAuthGuard), ces decorateurs n'auraient aucun effet.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get('liveness')
  liveness() {
    return { status: 'UP' };
  }

  @Get('readiness')
  async readiness() {
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'UP' };
    } catch {
      throw new ServiceUnavailableException('Base de données injoignable');
    }
  }
}
