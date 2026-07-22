import * as fs from 'fs';
import * as path from 'path';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ReprintApprovalGuard } from '../../common/guards/reprint-approval.guard';
import { LabelReprintApprovalController } from './label-reprint.controller';
import { LabelReprintService, MAX_PRINTS_PER_APPROVAL } from './label-reprint.service';

/**
 * The reprint lock. What is pinned here:
 *  - the FIRST print stays free, for raw material and finished goods alike — the whole
 *    point is that nothing about the existing release flow gains friction;
 *  - a SECOND print is refused server-side, not merely hidden in the UI;
 *  - an approval is spent per print and re-locks when its quota runs out;
 *  - nobody can approve their own request, and only OVERSIGHT can approve at all;
 *  - MINTING is never routed through this service, so a future edit cannot quietly
 *    make issuing a QR depend on an approval.
 */

// ─────────────────────────── an in-memory Prisma double ───────────────────────────

type Mat = { id: string; poId: string; labelPrintedAt: Date | null };
type Fg = { id: string; outputId: string; labelPrintedAt: Date | null; qrReprintNeeded: boolean };
type Req = Record<string, any>;

function makePrisma(seed: { materials?: Mat[]; finishedGoods?: Fg[]; requests?: Req[] } = {}) {
  const materials: Mat[] = seed.materials ?? [];
  const finishedGoods: Fg[] = seed.finishedGoods ?? [];
  const requests: Req[] = seed.requests ?? [];
  let seq = 0;

  /** Match only the operators this service actually uses. */
  const matches = (row: any, where: any = {}): boolean =>
    Object.entries(where).every(([k, v]) => {
      const actual = row[k];
      if (v === null) return actual === null || actual === undefined;
      if (v && typeof v === 'object') {
        if ('not' in v) return v.not === null ? actual !== null && actual !== undefined : actual !== v.not;
        if ('in' in v) return (v as any).in.includes(actual);
        if ('lt' in v) return actual < (v as any).lt;
      }
      return actual === v;
    });

  const table = <T extends Record<string, any>>(rows: T[]) => ({
    count: jest.fn(async ({ where }: any = {}) => rows.filter((r) => matches(r, where)).length),
    findUnique: jest.fn(async ({ where }: any) => rows.find((r) => r.id === where.id) ?? null),
    findUniqueOrThrow: jest.fn(async ({ where }: any) => {
      const found = rows.find((r) => r.id === where.id);
      if (!found) throw new Error('not found');
      return found;
    }),
    findFirst: jest.fn(async ({ where }: any = {}) => rows.find((r) => matches(r, where)) ?? null),
    findMany: jest.fn(async ({ where }: any = {}) => rows.filter((r) => matches(r, where))),
    update: jest.fn(async ({ where, data }: any) => {
      const row = rows.find((r) => r.id === where.id);
      Object.assign(row!, applyData(row, data));
      return row;
    }),
    updateMany: jest.fn(async ({ where, data }: any) => {
      const hit = rows.filter((r) => matches(r, where));
      hit.forEach((r) => Object.assign(r, applyData(r, data)));
      return { count: hit.length };
    }),
    create: jest.fn(async ({ data }: any) => {
      // Mirror the schema defaults the real client would apply — without status
      // defaulting to PENDING, a freshly created request looks like no request at all.
      const row = { id: `row-${++seq}`, status: 'PENDING', printsApproved: 0, printsUsed: 0, ...data } as any;
      rows.push(row);
      return row;
    }),
  });

  const applyData = (row: any, data: any) =>
    Object.fromEntries(
      Object.entries(data).map(([k, v]: [string, any]) =>
        v && typeof v === 'object' && 'increment' in v ? [k, (row[k] ?? 0) + v.increment] : [k, v],
      ),
    );

  const prisma: any = {
    material: table(materials),
    finishedGood: table(finishedGoods),
    labelReprintRequest: table(requests),
    purchaseOrder: { findUnique: jest.fn(async () => ({ id: 'po1' })) },
    productionOutput: { findUnique: jest.fn(async () => ({ id: 'out1' })) },
  };
  prisma.$transaction = jest.fn(async (fn: any) => fn(prisma));
  return { prisma, materials, finishedGoods, requests };
}

const build = (seed?: Parameters<typeof makePrisma>[0]) => {
  const db = makePrisma(seed);
  const audit = { log: jest.fn() };
  return { ...db, audit, svc: new LabelReprintService(db.prisma as never, audit as never) };
};

const actions = (audit: { log: jest.Mock }) => audit.log.mock.calls.map((c) => c[0].action);

const PO = { kind: 'PO_LABELS', poId: 'po1' } as const;
const OUT = { kind: 'FG_OUTPUT_LABELS', outputId: 'out1' } as const;

const unprintedPo = () => ({ materials: [{ id: 'm1', poId: 'po1', labelPrintedAt: null }] });
const printedPo = () => ({ materials: [{ id: 'm1', poId: 'po1', labelPrintedAt: new Date('2026-07-01') }] });
const unprintedOutput = () => ({
  finishedGoods: [{ id: 'f1', outputId: 'out1', labelPrintedAt: null, qrReprintNeeded: false }],
});
const printedOutput = () => ({
  finishedGoods: [{ id: 'f1', outputId: 'out1', labelPrintedAt: new Date('2026-07-01'), qrReprintNeeded: false }],
});

// ─────────────────────────────── the first print ───────────────────────────────

describe('the first print is untouched', () => {
  it('raw material: no approval needed, and the labels are stamped as printed', async () => {
    const { svc, materials, audit } = build(unprintedPo());
    await expect(svc.assertMayPrint(PO)).resolves.toBeUndefined();
    expect(await svc.consumePrint(PO, 'u1', 'PDF')).toEqual({ via: 'FIRST_PRINT' });
    expect(materials[0].labelPrintedAt).toBeInstanceOf(Date);
    expect(actions(audit)).toEqual(['LABEL_PRINTED']);
  });

  it('finished goods: same — confirming an output and printing its roll gains no friction', async () => {
    const { svc, finishedGoods, audit } = build(unprintedOutput());
    await expect(svc.assertMayPrint(OUT)).resolves.toBeUndefined();
    expect(await svc.consumePrint(OUT, 'u1', 'PDF')).toEqual({ via: 'FIRST_PRINT' });
    expect(finishedGoods[0].labelPrintedAt).toBeInstanceOf(Date);
    expect(actions(audit)).toEqual(['LABEL_PRINTED']);
  });

  it('a whole roll stamps EVERY unit, so pulling one unit afterwards is a reprint', async () => {
    const { svc, materials } = build({
      materials: [
        { id: 'm1', poId: 'po1', labelPrintedAt: null },
        { id: 'm2', poId: 'po1', labelPrintedAt: null },
      ],
    });
    await svc.consumePrint(PO, 'u1', 'PDF');
    expect(materials.every((m) => m.labelPrintedAt)).toBe(true);
    await expect(svc.assertMayPrint({ kind: 'MC_UNIT_LABEL', materialId: 'm2' })).rejects.toThrow(ForbiddenException);
  });
});

// ─────────────────────────────── the lock itself ───────────────────────────────

describe('a second print is refused without approval', () => {
  it('raw material', async () => {
    const { svc } = build(printedPo());
    await expect(svc.assertMayPrint(PO)).rejects.toThrow(ForbiddenException);
    await expect(svc.consumePrint(PO, 'u1', 'PDF')).rejects.toThrow(ForbiddenException);
  });

  it('finished goods', async () => {
    const { svc } = build(printedOutput());
    await expect(svc.assertMayPrint(OUT)).rejects.toThrow(ForbiddenException);
    await expect(svc.consumePrint(OUT, 'u1', 'PDF')).rejects.toThrow(ForbiddenException);
  });

  it('every export format draws on the SAME allowance — switching format is not a way round', async () => {
    // The CSV feeds label-design software that prints the same stickers.
    const { svc } = build(printedPo());
    for (const format of ['PDF', 'ZIP', 'CSV']) {
      await expect(svc.consumePrint(PO, 'u1', format)).rejects.toThrow(ForbiddenException);
    }
  });

  it('a request that is still PENDING does not itself unlock anything', async () => {
    const { svc } = build({
      ...printedPo(),
      requests: [{ id: 'r1', scope: 'PO_LABELS', poId: 'po1', status: 'PENDING', printsApproved: 0, printsUsed: 0 }],
    });
    await expect(svc.assertMayPrint(PO)).rejects.toThrow(/waiting for the factory Admin/);
  });
});

describe('an approval carries a quota and re-locks when spent', () => {
  const approved = (prints: number) => ({
    ...printedPo(),
    requests: [
      {
        id: 'r1',
        scope: 'PO_LABELS',
        poId: 'po1',
        status: 'APPROVED',
        printsApproved: prints,
        printsUsed: 0,
        decidedAt: new Date(),
      },
    ],
  });

  it('one approved print allows exactly one, then locks again', async () => {
    const { svc, requests, audit } = build(approved(1));
    const first = await svc.consumePrint(PO, 'u1', 'PDF');
    expect(first).toMatchObject({ via: 'APPROVAL', requestId: 'r1', remainingAfter: 0 });
    expect(requests[0].status).toBe('CONSUMED');
    await expect(svc.consumePrint(PO, 'u1', 'PDF')).rejects.toThrow(ForbiddenException);
    expect(actions(audit)).toEqual(['LABEL_REPRINTED']);
  });

  it('the Admin can grant several prints, and each one is spent in turn', async () => {
    const { svc, requests } = build(approved(3));
    for (const remaining of [2, 1, 0]) {
      expect(await svc.consumePrint(PO, 'u1', 'PDF')).toMatchObject({ remainingAfter: remaining });
    }
    expect(requests[0].printsUsed).toBe(3);
    expect(requests[0].status).toBe('CONSUMED');
    // A fourth print needs a fresh approval.
    await expect(svc.consumePrint(PO, 'u1', 'PDF')).rejects.toThrow(ForbiddenException);
  });

  it('records how the print was authorised, and never silently', async () => {
    const { svc, audit } = build(approved(2));
    await svc.consumePrint(PO, 'u1', 'PDF');
    expect(audit.log.mock.calls[0][0]).toMatchObject({
      action: 'LABEL_REPRINTED',
      actorId: 'u1',
      after: { source: 'APPROVAL', requestId: 'r1', printsUsed: 1, printsApproved: 2, approvalExhausted: false },
    });
  });
});

// ───────────────────────── correction-driven reprints ─────────────────────────

describe('a correction carries its own single-use allowance', () => {
  const corrected = () => ({
    finishedGoods: [
      { id: 'f1', outputId: 'out1', labelPrintedAt: new Date('2026-07-01'), qrReprintNeeded: true },
    ],
  });
  const UNIT = { kind: 'FG_UNIT_LABEL', finishedGoodId: 'f1' } as const;

  it('reprints without a request, because the correction already invalidated the sticker', async () => {
    const { svc, finishedGoods, audit } = build(corrected());
    await expect(svc.assertMayPrint(UNIT)).resolves.toBeUndefined();
    expect(await svc.consumePrint(UNIT, 'u1', 'PDF')).toEqual({ via: 'CORRECTION' });
    // The flag is cleared as part of the SAME transaction that records the print, so
    // "flag cleared" and "print recorded" can never disagree.
    expect(finishedGoods[0].qrReprintNeeded).toBe(false);
    expect(audit.log.mock.calls[0][0].after).toMatchObject({ source: 'CORRECTION' });
  });

  it('is consumed once — the NEXT print needs a normal approval', async () => {
    const { svc } = build(corrected());
    await svc.consumePrint(UNIT, 'u1', 'PDF');
    await expect(svc.consumePrint(UNIT, 'u1', 'PDF')).rejects.toThrow(ForbiddenException);
  });
});

// ────────────────────────── the request / decide workflow ──────────────────────────

describe('raising a request', () => {
  it('requires a reason', async () => {
    const { svc } = build(printedPo());
    await expect(svc.request('u1', PO, '   ')).rejects.toThrow(BadRequestException);
  });

  it('is refused when the labels have never been printed — the first print is free', async () => {
    const { svc } = build(unprintedPo());
    await expect(svc.request('u1', PO, 'smudged')).rejects.toThrow(/not been printed yet/);
  });

  it('audits the reason and who asked', async () => {
    const { svc, audit } = build(printedPo());
    await svc.request('u1', PO, 'printer jammed, half the roll is blank');
    expect(audit.log.mock.calls[0][0]).toMatchObject({
      action: 'LABEL_REPRINT_REQUESTED',
      actorId: 'u1',
      after: { reason: 'printer jammed, half the roll is blank' },
    });
  });

  it('refuses a second live request for the same labels', async () => {
    const { svc } = build(printedPo());
    await svc.request('u1', PO, 'smudged');
    await expect(svc.request('u2', PO, 'again')).rejects.toThrow(ConflictException);
  });
});

describe('deciding a request', () => {
  const pending = () => ({
    ...printedPo(),
    requests: [{ id: 'r1', scope: 'PO_LABELS', poId: 'po1', status: 'PENDING', requestedById: 'requester', printsApproved: 0, printsUsed: 0 }],
  });

  it('REFUSES self-approval — Oversight can print raw-material labels itself', async () => {
    const { svc } = build(pending());
    await expect(svc.approve('requester', 'r1', 1)).rejects.toThrow(/cannot be approved by the person who requested/);
  });

  it('rejects a nonsense quota', async () => {
    const { svc } = build(pending());
    for (const n of [0, -1, 1.5, MAX_PRINTS_PER_APPROVAL + 1]) {
      await expect(svc.approve('owner', 'r1', n)).rejects.toThrow(BadRequestException);
    }
  });

  it('approving records the decider and the quota', async () => {
    const { svc, requests, audit } = build(pending());
    await svc.approve('owner', 'r1', 5, 'ok, reprint the damaged half');
    expect(requests[0]).toMatchObject({ status: 'APPROVED', decidedById: 'owner', printsApproved: 5 });
    expect(audit.log.mock.calls[0][0]).toMatchObject({
      action: 'LABEL_REPRINT_APPROVED',
      actorId: 'owner',
      after: { printsApproved: 5 },
    });
  });

  it('rejecting is audited and unlocks nothing', async () => {
    const { svc, audit } = build(pending());
    await svc.reject('owner', 'r1', 'print it from the CSV you already have');
    expect(actions(audit)).toEqual(['LABEL_REPRINT_REJECTED']);
    await expect(svc.assertMayPrint(PO)).rejects.toThrow(ForbiddenException);
  });

  it('a request can only be decided once', async () => {
    const { svc } = build(pending());
    await svc.approve('owner', 'r1', 1);
    await expect(svc.approve('owner', 'r1', 1)).rejects.toThrow(ConflictException);
    await expect(svc.reject('owner', 'r1')).rejects.toThrow(ConflictException);
  });
});

// ─────────────────────────────── the named door ───────────────────────────────

describe('ReprintApprovalGuard is two-sided', () => {
  const reflector = new Reflector();
  const guard = new ReprintApprovalGuard(reflector);
  const ctx = (handler: unknown, role?: Role) =>
    ({
      getHandler: () => handler,
      getClass: () => LabelReprintApprovalController,
      switchToHttp: () => ({ getRequest: () => ({ user: role ? { role } : undefined }) }),
    }) as never;
  const marked = LabelReprintApprovalController.prototype.approve;

  it('refuses an UNMARKED handler even for OVERSIGHT', () => {
    expect(() => guard.canActivate(ctx(function unmarked() {}, Role.OVERSIGHT))).toThrow(ForbiddenException);
  });

  it('refuses every role except OVERSIGHT (403)', () => {
    for (const r of [Role.ADMIN, Role.DISPATCH, Role.PRODUCTION_HEAD, Role.OPERATOR, Role.SUPERVISOR]) {
      expect(() => guard.canActivate(ctx(marked, r))).toThrow(ForbiddenException);
    }
  });

  it('passes OVERSIGHT on marked handlers', () => {
    expect(guard.canActivate(ctx(marked, Role.OVERSIGHT))).toBe(true);
  });
});

// ─────────────────────────── minting must stay untouched ───────────────────────────

describe('the lock never reaches minting', () => {
  const src = (f: string) => fs.readFileSync(path.join(__dirname, '..', 'finished-goods', f), 'utf8');

  /** Body of a named async method, up to the next method at the same indentation. */
  const methodBody = (source: string, name: string) => {
    const start = source.indexOf(`  async ${name}(`);
    expect(start).toBeGreaterThan(-1);
    const rest = source.slice(start + 10);
    const next = rest.search(/\n  (async |\/\*\*)/);
    return next === -1 ? rest : rest.slice(0, next);
  };

  it('generate() issues QRs without consulting the reprint service', () => {
    // If a future edit routes minting through an approval, the release act at output
    // confirm would silently start requiring the factory Admin. Fail here instead.
    expect(methodBody(src('finished-goods.service.ts'), 'generate')).not.toMatch(/reprints\./);
  });

  it('the fgGeneratedAt double-mint guard is still the thing that stops a second mint', () => {
    expect(methodBody(src('finished-goods.service.ts'), 'generate')).toMatch(/output\.fgGeneratedAt/);
  });

  it('registration mints raw-material QRs without consulting it either', () => {
    const material = fs.readFileSync(path.join(__dirname, '..', 'material', 'material.service.ts'), 'utf8');
    expect(material).not.toMatch(/LabelReprintService|reprints\./);
  });
});
