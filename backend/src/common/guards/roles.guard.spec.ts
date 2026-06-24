import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { RolesGuard } from './roles.guard';

// Invariant I5: RBAC is enforced server-side. These tests guard that contract.
describe('RolesGuard', () => {
  let reflector: Reflector;
  let guard: RolesGuard;

  const ctxWithUser = (user: unknown, handler = () => {}): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
      getHandler: () => handler,
      getClass: () => class {},
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('allows when no roles are required (any authenticated user)', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(ctxWithUser({ role: Role.OPERATOR }))).toBe(true);
  });

  it('allows when the user has a required role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.ADMIN]);
    expect(guard.canActivate(ctxWithUser({ role: Role.ADMIN }))).toBe(true);
  });

  it('rejects when the user lacks the required role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.ADMIN]);
    expect(() => guard.canActivate(ctxWithUser({ role: Role.OPERATOR }))).toThrow(
      ForbiddenException,
    );
  });

  it('rejects when there is no authenticated user', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.SUPERVISOR]);
    expect(() => guard.canActivate(ctxWithUser(undefined))).toThrow(
      ForbiddenException,
    );
  });

  it('allows a SUPERVISOR for a supervisor-or-admin route', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([Role.ADMIN, Role.SUPERVISOR]);
    expect(guard.canActivate(ctxWithUser({ role: Role.SUPERVISOR }))).toBe(true);
  });
});
