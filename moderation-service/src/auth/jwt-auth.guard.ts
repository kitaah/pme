import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from './public.decorator';

/**
 * Exige un jeton valide, sauf si la route est marquee @Public().
 * Dans ce service la garde est posee controleur par controleur (voir ModerationController) et non
 * en APP_GUARD : il est aussi consommateur RabbitMQ, or un garde global s'appliquerait aussi aux
 * messages, qui n'ont pas de jeton HTTP. Tout nouveau controleur doit donc declarer ses gardes.
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
