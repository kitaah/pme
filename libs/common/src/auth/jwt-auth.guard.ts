import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from './public.decorator';

/**
 * Exige un jeton valide, sauf si la route est marquee @Public().
 * Posee en APP_GUARD, elle protege toute l'application (cas de l'API). Un service qui est aussi consommateur NATS
 * la pose controleur par controleur : un garde global s'appliquerait aussi aux messages, qui n'ont pas de jeton HTTP.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    return isPublic ? true : super.canActivate(context);
  }
}
