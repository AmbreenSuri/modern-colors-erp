/**
 * Unit-aware quantity totals.
 *
 * Kilograms and litres are physically different quantities: adding them yields a number
 * that means nothing. Every aggregate that would otherwise sum quantities into a single
 * figure runs them through here instead, which groups by unit and sums only WITHIN a
 * unit — never across. The result is one entry when the rows are uniform (show it with
 * the unit labelled) and several entries when they are mixed (show the breakdown, e.g.
 * "1,200 kg · 340 L"), so a blended, meaningless total can never reach a dashboard.
 *
 * This is the same discipline the Company Brain already applies to litres-vs-kg yield
 * (reported as null rather than an invented percentage), applied consistently.
 */
export interface UnitTotal {
  unit: string;
  total: number;
}

/** Group quantities by unit and sum within each. Missing unit is treated as "kg". */
export function unitTotals(rows: Array<{ unit: string | null | undefined; qty: number | null | undefined }>): UnitTotal[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const unit = r.unit || 'kg';
    m.set(unit, Number(((m.get(unit) ?? 0) + (r.qty ?? 0)).toFixed(6)));
  }
  return [...m.entries()]
    .map(([unit, total]) => ({ unit, total }))
    .sort(byKgFirst);
}

/** Merge already-computed per-unit totals (e.g. summing per-department breakdowns). */
export function mergeUnitTotals(groups: UnitTotal[][]): UnitTotal[] {
  return unitTotals(groups.flat().map((t) => ({ unit: t.unit, qty: t.total })));
}

/** True when more than one unit is present — the totals must NOT be collapsed to one number. */
export function isMixedUnit(totals: UnitTotal[]): boolean {
  return totals.length > 1;
}

/** The kilogram-only total (0 if none) — kept where a legacy kg field must stay populated. */
export function kgOnly(totals: UnitTotal[]): number {
  return totals.find((t) => t.unit === 'kg')?.total ?? 0;
}

/** kg sorts first, then everything else alphabetically — stable, readable order. */
function byKgFirst(a: UnitTotal, b: UnitTotal): number {
  if (a.unit === b.unit) return 0;
  if (a.unit === 'kg') return -1;
  if (b.unit === 'kg') return 1;
  return a.unit.localeCompare(b.unit);
}
