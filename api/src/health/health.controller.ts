import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '@pme/common';
import { SkipThrottle } from '@nestjs/throttler';
import { DataSource } from 'typeorm';

/** Sondes Kubernetes (equivalent des /actuator/health/liveness et /readiness de Spring). */
@Public()
@SkipThrottle()
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
