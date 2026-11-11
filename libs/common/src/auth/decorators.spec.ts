import { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { AuthenticatedUser } from './authenticated-user';
import { CurrentUser } from './current-user.decorator';
import { IS_PUBLIC_KEY, Public } from './public.decorator';
import { Roles, ROLES_KEY } from './roles.decorator';

describe('decorateurs d authentification', () => {
  it('@Public() marque la route comme accessible sans jeton', () => {
    class Controller {
      @Public()
      handler() {}
    }

    expect(Reflect.getMetadata(IS_PUBLIC_KEY, Controller.prototype.handler)).toBe(true);
  });

  it('@Roles() memorise les roles exiges', () => {
    class Controller {
      @Roles('membre', 'moderateur')
      handler() {}
    }

    expect(Reflect.getMetadata(ROLES_KEY, Controller.prototype.handler)).toEqual(['membre', 'moderateur']);
  });

  it('@CurrentUser() extrait l utilisateur authentifie de la requete', () => {
    class Controller {
      handler(@CurrentUser() _user: AuthenticatedUser) {}
    }
    const user: AuthenticatedUser = { id: 'u1', username: 'membre', roles: ['membre'] };
    const context = { switchToHttp: () => ({ getRequest: () => ({ user }) }) } as unknown as ExecutionContext;

    const metadata = Reflect.getMetadata(ROUTE_ARGS_METADATA, Controller, 'handler') as Record<
      string,
      { factory: (data: unknown, ctx: ExecutionContext) => AuthenticatedUser }
    >;
    const [parameter] = Object.values(metadata);

    expect(parameter.factory(undefined, context)).toBe(user);
  });
});
