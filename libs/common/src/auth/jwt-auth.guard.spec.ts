import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  const context = { getHandler: () => undefined, getClass: () => undefined } as unknown as ExecutionContext;

  function guardWith(isPublic: boolean | undefined) {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(isPublic);
    return new JwtAuthGuard(reflector);
  }

  afterEach(() => jest.restoreAllMocks());

  it('laisse passer une route marquee @Public() sans verifier le jeton', () => {
    const parent = Object.getPrototypeOf(JwtAuthGuard.prototype) as { canActivate: () => unknown };
    const verify = jest.spyOn(parent, 'canActivate');

    expect(guardWith(true).canActivate(context)).toBe(true);
    expect(verify).not.toHaveBeenCalled();
  });

  it('delegue a la strategie JWT pour toute autre route', () => {
    const parent = Object.getPrototypeOf(JwtAuthGuard.prototype) as { canActivate: () => unknown };
    const verify = jest.spyOn(parent, 'canActivate').mockReturnValue(true);

    expect(guardWith(undefined).canActivate(context)).toBe(true);
    expect(verify).toHaveBeenCalledTimes(1);
  });
});
