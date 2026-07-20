import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { HealthController, StorageHealthController } from './health.controller';
import { ROLES_KEY } from './common/decorators/roles.decorator';

/**
 * Access control for the health endpoints.
 *
 * REGRESSION THIS LOCKS: the storage probe first shipped PUBLIC. It disclosed the R2
 * endpoint host — which embeds the Cloudflare account ID — plus the bucket name and
 * which env vars were missing, and its deep mode performs a real WRITE on every call,
 * making it a free write/cost amplifier against the client's R2 bill.
 *
 * Two properties must hold together, which is why both are asserted here:
 *  - liveness stays PUBLIC (the platform polls it before any auth exists), and
 *  - the storage probe stays ADMIN-ONLY.
 */
describe('health endpoint access control', () => {
  const reflector = new Reflector();

  it('keeps plain liveness PUBLIC so the platform health check works', () => {
    // No guards and no @Roles on the liveness controller or its handler.
    const guards =
      Reflect.getMetadata('__guards__', HealthController) ??
      Reflect.getMetadata('__guards__', HealthController.prototype.check);
    expect(guards).toBeUndefined();

    const roles = reflector.getAllAndOverride(ROLES_KEY, [
      HealthController.prototype.check,
      HealthController,
    ]);
    expect(roles).toBeUndefined();
  });

  it('guards the storage probe', () => {
    const guards = Reflect.getMetadata('__guards__', StorageHealthController);
    expect(guards).toBeDefined();
    expect(guards.length).toBeGreaterThanOrEqual(2); // JwtAuthGuard + RolesGuard
  });

  it('restricts the storage probe to admin roles only', () => {
    const roles: Role[] | undefined = reflector.getAllAndOverride(ROLES_KEY, [
      StorageHealthController.prototype.storageHealth,
      StorageHealthController,
    ]);
    expect(roles).toEqual(expect.arrayContaining([Role.ADMIN, Role.OVERSIGHT]));

    // Floor staff and dispatch have no business reading infrastructure config.
    for (const r of [Role.OPERATOR, Role.SUPERVISOR, Role.PRODUCTION_HEAD, Role.DISPATCH]) {
      expect(roles).not.toContain(r);
    }
  });
});
