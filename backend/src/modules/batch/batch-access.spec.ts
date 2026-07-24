import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { BatchController } from './batch.controller';

/**
 * Who may READ batches.
 *
 * The "Store Head / Admin" line in the requested-changes doc was a naming trap: the
 * factory's Admin is OVERSIGHT, not the Store desk (internal ADMIN). Cross-department
 * batch visibility therefore belongs to OVERSIGHT and the production heads — NOT Store.
 *
 * Store loses nothing operational: it issues AGAINST a batch, but that batch context
 * rides on the request-item being issued (the issue payload carries batchNumber), never
 * on reading the batch list. This spec pins the corrected matrix so a future edit cannot
 * quietly hand Store back a cross-department read.
 */
describe('batch reads belong to Oversight and the heads, not the Store desk', () => {
  const reflector = new Reflector();
  const rolesFor = (method: string): Role[] =>
    reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      BatchController.prototype[method as keyof typeof BatchController.prototype],
      BatchController,
    ]) ?? [];

  const readMethods = Object.getOwnPropertyNames(BatchController.prototype).filter((m) => {
    if (m === 'constructor') return false;
    const roles = rolesFor(m);
    // A read route is one OVERSIGHT can reach (create is PRODUCTION_HEAD-only).
    return roles.includes(Role.OVERSIGHT);
  });

  it('found the read routes (a sweep matching nothing proves nothing)', () => {
    expect(readMethods.length).toBeGreaterThan(0);
  });

  it('STORE (ADMIN) is on NO batch route — read or write', () => {
    for (const m of Object.getOwnPropertyNames(BatchController.prototype)) {
      if (m === 'constructor') continue;
      expect({ method: m, admin: rolesFor(m).includes(Role.ADMIN) }).toEqual({ method: m, admin: false });
    }
  });

  it('OVERSIGHT and PRODUCTION_HEAD keep the cross-department read', () => {
    for (const m of readMethods) {
      expect({ method: m, oversight: rolesFor(m).includes(Role.OVERSIGHT) }).toEqual({ method: m, oversight: true });
      expect({ method: m, head: rolesFor(m).includes(Role.PRODUCTION_HEAD) }).toEqual({ method: m, head: true });
    }
  });

  it('creating a batch stays a production-head act', () => {
    // Whatever the create handler is named, it must be PRODUCTION_HEAD-only — never ADMIN.
    const createLike = Object.getOwnPropertyNames(BatchController.prototype).filter((m) => {
      const roles = rolesFor(m);
      return roles.length === 1 && roles[0] === Role.PRODUCTION_HEAD;
    });
    expect(createLike.length).toBeGreaterThan(0);
  });
});
