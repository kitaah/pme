import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

function contextWith(user: unknown, roles?: string[]): { context: ExecutionContext; reflector: Reflector } {
  const reflector = new Reflector();
  jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(roles);
  const context = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
  return { context, reflector };
}

describe('RolesGuard', () => {
  it('laisse passer quand aucun role n est exige', () => {
    const { context, reflector } = contextWith({ roles: [] }, undefined);
    expect(new RolesGuard(reflector).canActivate(context)).toBe(true);
  });

  it('laisse passer un utilisateur qui possede le role exige', () => {
    const { context, reflector } = contextWith({ roles: ['membre'] }, ['membre']);
    expect(new RolesGuard(reflector).canActivate(context)).toBe(true);
  });

  it('refuse (403) un utilisateur sans le role exige', () => {
    const { context, reflector } = contextWith({ roles: ['membre'] }, ['moderateur']);
    expect(() => new RolesGuard(reflector).canActivate(context)).toThrow(ForbiddenException);
  });
});
