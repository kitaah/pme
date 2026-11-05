import { Controller, Get, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ROLE_MODERATOR } from '../auth/authenticated-user';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ModerationService } from './moderation.service';

/**
 * Les gardes sont poses sur ce controleur plutot qu'en APP_GUARD : ce service est aussi un
 * consommateur NATS, et un garde global s'appliquerait aussi aux messages (pas de jeton HTTP).
 */
@UseGuards(ThrottlerGuard, JwtAuthGuard, RolesGuard)
@Roles(ROLE_MODERATOR)
@Controller('v1/moderation')
export class ModerationController {
  constructor(private readonly service: ModerationService) {}

  @Get('queue')
  queue() {
    return this.service.pending();
  }
}
