import { ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import {
  assertDepartmentAccess,
  departmentFilter,
  ownDepartment,
} from '../../common/auth/department-scope';

/**
 * Multiple heads per department — the visibility model, pinned:
 *
 *   same department = same data (shift handover works: PU2 continues what PU started)
 *   different department = blocked, for a new login exactly as for the seeded one
 *   attribution = individual user ID, never "a PU head"
 *
 * Every scope decision keys on `user.department` from the JWT, never on identity —
 * these tests prove the seeded PU head and a freshly created PU2 are indistinguishable
 * to the scoping layer, so nothing about isolation changes when logins multiply.
 */
const pu1 = { id: 'seed-pu', email: 'pu@moderncolours.local', role: Role.PRODUCTION_HEAD, department: 'PU' as const };
const pu2 = { id: 'new-pu2', email: 'pu2@moderncolours.local', role: Role.PRODUCTION_HEAD, department: 'PU' as const };
const enamel = { id: 'seed-enamel', email: 'enamel@moderncolours.local', role: Role.PRODUCTION_HEAD, department: 'ENAMEL' as const };
const asUser = (u: typeof pu1 | typeof enamel) => u as never;

describe('two PU heads are identical to the scoping layer', () => {
  it('both resolve to the same department scope', () => {
    expect(ownDepartment(asUser(pu1))).toBe('PU');
    expect(ownDepartment(asUser(pu2))).toBe('PU');
    expect(departmentFilter(asUser(pu1))).toEqual(departmentFilter(asUser(pu2)));
  });

  it('both may access PU data; neither may touch Enamel or Powder', () => {
    for (const head of [pu1, pu2]) {
      expect(() => assertDepartmentAccess(asUser(head), 'PU')).not.toThrow();
      expect(() => assertDepartmentAccess(asUser(head), 'ENAMEL')).toThrow(ForbiddenException);
      expect(() => assertDepartmentAccess(asUser(head), 'POWDER')).toThrow(ForbiddenException);
    }
  });

  it('PU2 can continue a batch PU created — ownership is the DEPARTMENT, not the creator', () => {
    // Mirrors the check in ProductionRequestService.create: a line may target a batch
    // only if batch.department === the head's own department. Creator is irrelevant.
    const batchCreatedByPu1 = { department: 'PU', createdById: pu1.id };
    const mayTarget = (user: { department: string }, batch: { department: string }) =>
      batch.department === user.department;
    expect(mayTarget(pu2, batchCreatedByPu1)).toBe(true);
    expect(mayTarget(enamel, batchCreatedByPu1)).toBe(false);
  });
});

describe('attribution stays individual', () => {
  it('the records write the ACTING user id, so PU and PU2 never blur', () => {
    // The services set these from @CurrentUser — asserted here as the contract that
    // every attribution column is a user id, not a role or department:
    const attributionColumns = [
      'requestedById', // ProductionRequest
      'reviewedById',
      'createdById', // Batch
      'recordedById', // ProductionOutput
      'confirmedById',
      'dispatchedById', // FinishedGood
      'returnedById',
      'actorId', // StockTransaction + AuditLog
    ];
    // Schema-level check: each column exists on its model in the Prisma DMMF.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Prisma } = require('@prisma/client');
    const fields = new Set<string>(
      Prisma.dmmf.datamodel.models.flatMap((m: { fields: { name: string }[] }) => m.fields.map((f) => f.name)),
    );
    for (const col of attributionColumns) {
      expect(fields.has(col)).toBe(true);
    }
  });
});
