import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedUser } from './authenticated-user';
import { ROLES_KEY } from './roles.decorator';

/** Verifie les roles Keycloak exiges par @Roles(). Sans @Roles(), un jeton valide suffit. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) {
      return true;
    }
    const user: AuthenticatedUser | undefined = context.switchToHttp().getRequest().user;
    if (user && required.some((role) => user.roles.includes(role))) {
      return true;
    }
    throw new ForbiddenException("Vous n'avez pas le role necessaire pour cette action");
  }
}
