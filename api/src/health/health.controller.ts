import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { DataSource } from 'typeorm';
import { Public } from '../auth/public.decorator';

/** Sondes Kubernetes (equivalent des /actuator/health/liveness et /readiness de Spring). */
@ApiExcludeController()
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
