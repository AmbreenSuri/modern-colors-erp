import { AuditService, STORE_AUDIT_SCOPE } from './audit.service';

/**
 * The audit read engine's SERVER-forced scoping.
 *
 * Oversight sees the whole trail; the Store desk is confined to its own actions and
 * cannot widen itself with a query parameter. Pinned here at the service, where the
 * `actionScope` allow-list is applied, plus the buildWhere shape that carries it.
 */
describe('audit engine scoping', () => {
  // A prisma double that captures the `where` the service builds, so we can assert the
  // scope is present without a database.
  const capture = () => {
    let lastWhere: any = null;
    const prisma = {
      $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
      auditLog: {
        findMany: (args: any) => {
          lastWhere = args.where;
          return Promise.resolve([]);
        },
        count: () => Promise.resolve(0),
        groupBy: (args: any) => {
          lastWhere = args.where;
          return Promise.resolve([]);
        },
      },
      user: { findMany: () => Promise.resolve([]) },
    };
    return { svc: new AuditService(prisma as never), getWhere: () => lastWhere };
  };

  const flatten = (where: any): any[] => where?.AND ?? [];

  it('Store scope confines to inward/stock/issue prefixes as an OR of startsWith', async () => {
    const { svc, getWhere } = capture();
    await svc.query({ actionScope: STORE_AUDIT_SCOPE });
    const or = flatten(getWhere()).find((c) => c.OR);
    expect(or).toBeDefined();
    // Every scope entry is present as an action startsWith.
    const prefixes = or.OR.map((o: any) => o.action.startsWith);
    expect(prefixes).toEqual([...STORE_AUDIT_SCOPE]);
  });

  it('the Store scope excludes the sensitive families entirely', () => {
    // A guard against someone widening STORE_AUDIT_SCOPE later.
    for (const forbidden of ['USER_', 'SETTING', 'STORE_INWARD_ACCESS', 'LABEL_REPRINT', 'CARTON', 'PACKED']) {
      expect(STORE_AUDIT_SCOPE.some((p) => p.startsWith(forbidden) || forbidden.startsWith(p))).toBe(false);
    }
  });

  it('an unscoped (Oversight) query carries NO action OR-filter', async () => {
    const { svc, getWhere } = capture();
    await svc.query({});
    // No AND at all, or no OR clause — the whole trail.
    expect(flatten(getWhere()).find((c) => c.OR)).toBeUndefined();
  });

  it('a scoped caller asking for an out-of-scope action still cannot escape', async () => {
    // action + scope are ANDed: the OR(scope) AND action=USER_CREATED yields nothing,
    // never another desk's rows.
    const { svc, getWhere } = capture();
    await svc.query({ action: 'USER_CREATED', actionScope: STORE_AUDIT_SCOPE });
    const parts = flatten(getWhere());
    expect(parts.find((c) => c.action === 'USER_CREATED')).toBeDefined();
    expect(parts.find((c) => c.OR)).toBeDefined();
  });

  it('pagination is bounded — pageSize can never exceed 200', async () => {
    const { svc } = capture();
    const r = await svc.query({ pageSize: 100000 });
    expect(r.pageSize).toBeLessThanOrEqual(200);
  });

  it('date range becomes a createdAt gte/lte', async () => {
    const { svc, getWhere } = capture();
    const from = new Date('2026-07-01');
    const to = new Date('2026-07-31');
    await svc.query({ from, to });
    const dateClause = flatten(getWhere()).find((c) => c.createdAt);
    expect(dateClause.createdAt).toEqual({ gte: from, lte: to });
  });
});
