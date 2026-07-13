// FIFO (First-In-First-Out) helpers for stock consumption. The FIFO basis is a unit's
// arrival date (Material.arrivedAt, populated at Phase-1 receiving); same-day arrivals
// tiebreak by uniqueId ascending (MC-000001 before MC-000002). Only units still holding
// stock (balanceKg > 0) participate. Nothing here blocks — it only orders and flags.

export const AGEING = {
  AMBER_DAYS: 30, // in stock ≥ 30 days → ageing (amber)
  RED_DAYS: 60, // in stock ≥ 60 days → old (red)
} as const;

export type AgeingLevel = 'FRESH' | 'AMBER' | 'RED';

export interface FifoUnit {
  uniqueId: string;
  arrivedAt: Date | null;
  balanceKg: number | null;
}

/** Whole days between a unit's arrival and `now` (0 if arrival unknown/future). */
export function ageDays(arrivedAt: Date | null, now: Date): number {
  if (!arrivedAt) return 0;
  const ms = now.getTime() - arrivedAt.getTime();
  return ms <= 0 ? 0 : Math.floor(ms / 86_400_000);
}

export function ageingLevel(days: number): AgeingLevel {
  if (days >= AGEING.RED_DAYS) return 'RED';
  if (days >= AGEING.AMBER_DAYS) return 'AMBER';
  return 'FRESH';
}

/**
 * Order units oldest-first for FIFO consumption: by arrivedAt ascending (nulls last —
 * an unknown arrival can't be proven older), then uniqueId ascending as the same-day
 * tiebreak. Returns a new array; does not mutate the input.
 */
export function fifoSort<T extends FifoUnit>(units: T[]): T[] {
  return [...units].sort((a, b) => {
    const at = a.arrivedAt ? a.arrivedAt.getTime() : Infinity;
    const bt = b.arrivedAt ? b.arrivedAt.getTime() : Infinity;
    if (at !== bt) return at - bt;
    return a.uniqueId.localeCompare(b.uniqueId);
  });
}

/**
 * Among `units` of the SAME material that still hold stock, which are strictly OLDER
 * than the `target` unit by FIFO order. Used to decide whether issuing `target` is a
 * FIFO override and to recommend the oldest instead.
 */
export function olderUnitsThan<T extends FifoUnit>(target: FifoUnit, units: T[]): T[] {
  const inStock = units.filter((u) => (u.balanceKg ?? 0) > 0 && u.uniqueId !== target.uniqueId);
  const ordered = fifoSort(inStock);
  const targetKey = fifoKey(target);
  return ordered.filter((u) => fifoKey(u) < targetKey);
}

/** A comparable FIFO sort key: "<arrival-ms padded>|<uniqueId>". */
function fifoKey(u: FifoUnit): string {
  const t = u.arrivedAt ? u.arrivedAt.getTime() : Number.MAX_SAFE_INTEGER;
  return `${String(t).padStart(16, '0')}|${u.uniqueId}`;
}
