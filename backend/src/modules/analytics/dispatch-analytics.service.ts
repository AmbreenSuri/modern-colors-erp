import { Injectable } from '@nestjs/common';
import { Department, FgStatus, StockTxnType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/** Local copies of the shared window helpers, kept private to this service. */
function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function daysAgo(n: number): Date {
  const d = startOfToday();
  d.setDate(d.getDate() - (n - 1));
  return d;
}
function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function dayBuckets(days: number): string[] {
  const keys: string[] = [];
  const start = daysAgo(days);
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    keys.push(dayKey(d));
  }
  return keys;
}

const DEPARTMENTS: Department[] = [Department.PU, Department.ENAMEL, Department.POWDER];

/**
 * Analytics for the DISPATCH role, and the dispatch slice of the owner's view.
 *
 * Deliberately scoped to finished goods ONLY. A dispatch worker has no business seeing
 * raw-material stock, production requests or Phase 1 receiving data, so none of it is
 * queried here — the isolation is in the data access, not just in the UI.
 *
 * The same numbers power the Admin dashboard's dispatch section, so the two can never
 * disagree about how much went out.
 */
@Injectable()
export class DispatchAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * @param days rolling window for the trend/volume figures
   * @param department when set, restrict to one department's output (Admin drill-down).
   *        The DISPATCH role never passes this — it ships the whole factory.
   */
  async overview(days = 30, department?: Department) {
    const since = daysAgo(days);
    const batchWhere = department ? { batch: { department } } : {};

    const [
      dispatchedInWindow,
      readyUnits,
      dispatchedToday,
      totalDispatchedAllTime,
      byDeptRows,
      recent,
      batchRows,
    ] = await Promise.all([
      // Units dispatched inside the window, with the timestamps needed for the
      // "how long did it sit?" figure.
      this.prisma.finishedGood.findMany({
        where: { status: FgStatus.DISPATCHED, dispatchedAt: { gte: since }, ...batchWhere },
        select: {
          id: true,
          dispatchedAt: true,
          createdAt: true,
          sizePerPackage: true,
          sizeUnit: true,
          batch: { select: { department: true } },
        },
      }),

      // The backlog: produced and waiting. Not window-bound — a drum sitting since
      // last month is exactly what the dispatch worker needs to see.
      this.prisma.finishedGood.findMany({
        where: { status: { in: [FgStatus.GENERATED, FgStatus.READY] }, ...batchWhere },
        select: {
          id: true,
          createdAt: true,
          sizePerPackage: true,
          sizeUnit: true,
          batch: { select: { department: true } },
        },
      }),

      this.prisma.finishedGood.count({
        where: { status: FgStatus.DISPATCHED, dispatchedAt: { gte: startOfToday() }, ...batchWhere },
      }),

      this.prisma.finishedGood.count({ where: { status: FgStatus.DISPATCHED, ...batchWhere } }),

      this.prisma.finishedGood.findMany({
        where: { status: FgStatus.DISPATCHED, dispatchedAt: { gte: since }, ...batchWhere },
        select: { batch: { select: { department: true } } },
      }),

      this.prisma.finishedGood.findMany({
        where: { status: FgStatus.DISPATCHED, ...batchWhere },
        select: {
          uniqueId: true,
          productName: true,
          dispatchedAt: true,
          sizePerPackage: true,
          sizeUnit: true,
          dispatchedBy: { select: { name: true } },
          batch: { select: { batchNumber: true, department: true } },
        },
        orderBy: { dispatchedAt: 'desc' },
        take: 10,
      }),

      // Per-batch completion, so partially-shipped batches are visible.
      this.prisma.batch.findMany({
        where: department ? { department } : {},
        select: {
          id: true,
          batchNumber: true,
          department: true,
          finishedGoods: { select: { status: true } },
        },
      }),
    ]);

    // ---- trend ------------------------------------------------------------
    const buckets = dayBuckets(days);
    const index = new Map(buckets.map((k) => [k, { date: k, units: 0 }]));
    for (const fg of dispatchedInWindow) {
      if (!fg.dispatchedAt) continue;
      const slot = index.get(dayKey(fg.dispatchedAt));
      if (slot) slot.units += 1;
    }
    const series = buckets.map((k) => index.get(k)!);

    // ---- by department ----------------------------------------------------
    const deptCounts = new Map<string, number>(DEPARTMENTS.map((d) => [d, 0]));
    for (const r of byDeptRows) {
      const d = r.batch?.department;
      if (d) deptCounts.set(d, (deptCounts.get(d) ?? 0) + 1);
    }
    const byDepartment = DEPARTMENTS.map((d) => ({ department: d, units: deptCounts.get(d) ?? 0 }));

    // ---- batch completion -------------------------------------------------
    let fullyDispatched = 0;
    let partiallyDispatched = 0;
    let notStarted = 0;
    for (const b of batchRows) {
      const total = b.finishedGoods.length;
      if (total === 0) continue; // batch produced nothing yet — not a dispatch concern
      const out = b.finishedGoods.filter((f) => f.status === FgStatus.DISPATCHED).length;
      if (out === 0) notStarted++;
      else if (out === total) fullyDispatched++;
      else partiallyDispatched++;
    }

    // ---- turnaround: FG created -> dispatched ------------------------------
    const hours = dispatchedInWindow
      .filter((f) => f.dispatchedAt)
      .map((f) => (f.dispatchedAt!.getTime() - f.createdAt.getTime()) / 36e5)
      .filter((h) => h >= 0);
    const avgHoursToDispatch = hours.length
      ? Number((hours.reduce((s, h) => s + h, 0) / hours.length).toFixed(1))
      : null;

    // ---- volume -----------------------------------------------------------
    // Litres and kilograms are NOT interchangeable, so they are reported separately
    // rather than summed into a meaningless single number.
    const volume = (rows: { sizePerPackage: number; sizeUnit: string }[]) => {
      let litres = 0;
      let kg = 0;
      for (const r of rows) {
        if ((r.sizeUnit ?? '').toUpperCase().startsWith('L')) litres += r.sizePerPackage;
        else kg += r.sizePerPackage;
      }
      return { litres: Number(litres.toFixed(3)), kg: Number(kg.toFixed(3)) };
    };

    // Oldest waiting unit — the thing most likely to be forgotten.
    const oldestReady = readyUnits.reduce<Date | null>(
      (oldest, u) => (!oldest || u.createdAt < oldest ? u.createdAt : oldest),
      null,
    );
    const oldestReadyDays = oldestReady
      ? Math.floor((Date.now() - oldestReady.getTime()) / 864e5)
      : null;

    return {
      windowDays: days,
      department: department ?? null,
      totals: {
        dispatchedToday,
        dispatchedInWindow: dispatchedInWindow.length,
        dispatchedAllTime: totalDispatchedAllTime,
        readyForDispatch: readyUnits.length,
        oldestReadyDays,
        avgHoursToDispatch,
      },
      volume: {
        dispatchedInWindow: volume(dispatchedInWindow),
        awaitingDispatch: volume(readyUnits),
      },
      series,
      byDepartment,
      batches: { fullyDispatched, partiallyDispatched, notStarted },
      recent: recent.map((r) => ({
        uniqueId: r.uniqueId,
        productName: r.productName,
        dispatchedAt: r.dispatchedAt,
        size: `${r.sizePerPackage} ${r.sizeUnit}`,
        by: r.dispatchedBy?.name ?? null,
        batchNumber: r.batch?.batchNumber ?? null,
        department: r.batch?.department ?? null,
      })),
    };
  }

  /**
   * The factory-wide flow — the "Company Brain".
   *
   * Answers one question with measured numbers: what came in, what was issued, what was
   * made, and what went out, for an arbitrary date range.
   *
   * Every figure is read from the existing ledger, batches, outputs and dispatch
   * records; nothing is estimated. Litres and kilograms are kept apart because adding
   * them would produce a number that means nothing.
   */
  async flow(from: Date, to: Date) {
    const range = { gte: from, lte: to };

    const [received, issuedRows, discarded, outputs, fgCreated, fgDispatched, batches] =
      await Promise.all([
        // Raw material IN — the ADD ledger is the only honest source.
        this.prisma.stockTransaction.aggregate({
          where: { type: StockTxnType.ADD, createdAt: range },
          _sum: { quantityKg: true },
          _count: { _all: true },
        }),

        // Issued to each department.
        this.prisma.stockTransaction.groupBy({
          by: ['department'],
          where: { type: StockTxnType.DEDUCT, department: { not: null }, createdAt: range },
          _sum: { quantityKg: true },
          _count: { _all: true },
        }),

        this.prisma.stockTransaction.aggregate({
          where: { type: StockTxnType.DISCARD, createdAt: range },
          _sum: { quantityKg: true },
        }),

        // Production output, by department, confirmed only.
        this.prisma.productionOutput.findMany({
          where: { confirmed: true, productionDate: range },
          select: {
            packageCount: true,
            sizePerPackage: true,
            sizeUnit: true,
            productName: true,
            batch: { select: { department: true, batchNumber: true } },
          },
        }),

        this.prisma.finishedGood.count({ where: { createdAt: range } }),

        this.prisma.finishedGood.findMany({
          where: { status: FgStatus.DISPATCHED, dispatchedAt: range },
          select: {
            sizePerPackage: true,
            sizeUnit: true,
            batch: { select: { department: true } },
          },
        }),

        this.prisma.batch.findMany({
          where: { createdAt: range },
          select: { id: true, department: true },
        }),
      ]);

    const receivedKg = Number((received._sum.quantityKg ?? 0).toFixed(3));
    const discardedKg = Number((discarded._sum.quantityKg ?? 0).toFixed(3));

    const issuedByDept = DEPARTMENTS.map((d) => {
      const row = issuedRows.find((r) => r.department === d);
      return {
        department: d,
        kg: Number((row?._sum.quantityKg ?? 0).toFixed(3)),
        movements: row?._count._all ?? 0,
      };
    });
    const issuedKg = Number(issuedByDept.reduce((s, d) => s + d.kg, 0).toFixed(3));

    // Produced, per department, split by unit because L and Kg cannot be added.
    const producedByDept = DEPARTMENTS.map((d) => {
      const rows = outputs.filter((o) => o.batch?.department === d);
      let litres = 0;
      let kg = 0;
      let packages = 0;
      for (const o of rows) {
        const total = o.packageCount * o.sizePerPackage;
        packages += o.packageCount;
        if ((o.sizeUnit ?? '').toUpperCase().startsWith('L')) litres += total;
        else kg += total;
      }
      return {
        department: d,
        litres: Number(litres.toFixed(3)),
        kg: Number(kg.toFixed(3)),
        packages,
        batches: batches.filter((b) => b.department === d).length,
      };
    });

    const dispatchedByDept = DEPARTMENTS.map((d) => {
      const rows = fgDispatched.filter((f) => f.batch?.department === d);
      let litres = 0;
      let kg = 0;
      for (const r of rows) {
        if ((r.sizeUnit ?? '').toUpperCase().startsWith('L')) litres += r.sizePerPackage;
        else kg += r.sizePerPackage;
      }
      return {
        department: d,
        units: rows.length,
        litres: Number(litres.toFixed(3)),
        kg: Number(kg.toFixed(3)),
      };
    });

    const producedTotals = producedByDept.reduce(
      (a, d) => ({
        litres: Number((a.litres + d.litres).toFixed(3)),
        kg: Number((a.kg + d.kg).toFixed(3)),
        packages: a.packages + d.packages,
      }),
      { litres: 0, kg: 0, packages: 0 },
    );
    const dispatchedTotals = dispatchedByDept.reduce(
      (a, d) => ({
        units: a.units + d.units,
        litres: Number((a.litres + d.litres).toFixed(3)),
        kg: Number((a.kg + d.kg).toFixed(3)),
      }),
      { units: 0, litres: 0, kg: 0 },
    );

    /**
     * Yield: finished output measured against raw material issued.
     *
     * Only meaningful for the KG side — comparing litres of paint to kilograms of
     * pigment is a category error, so it is reported as null rather than a
     * confident-looking wrong number.
     */
    const yieldPct =
      issuedKg > 0 && producedTotals.kg > 0
        ? Number(((producedTotals.kg / issuedKg) * 100).toFixed(1))
        : null;

    return {
      range: { from: from.toISOString(), to: to.toISOString() },
      stages: {
        received: { kg: receivedKg, movements: received._count._all },
        issued: { kg: issuedKg, byDepartment: issuedByDept },
        discarded: { kg: discardedKg },
        batches: { opened: batches.length },
        produced: { ...producedTotals, byDepartment: producedByDept, fgUnitsCreated: fgCreated },
        dispatched: { ...dispatchedTotals, byDepartment: dispatchedByDept },
      },
      derived: {
        yieldPct,
        // What was issued but has not yet come out the other side as finished goods.
        inProcessKg: Number(Math.max(0, issuedKg - producedTotals.kg).toFixed(3)),
        awaitingDispatchUnits: Math.max(0, fgCreated - dispatchedTotals.units),
      },
    };
  }
}
