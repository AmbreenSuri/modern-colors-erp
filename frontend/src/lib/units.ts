/**
 * Unit-aware total formatting.
 *
 * The backend never blends kilograms and litres into one number; it returns a per-unit
 * breakdown. This renders that breakdown so a dashboard shows an honest figure:
 *   - one unit  → "97.8 kg"      (labelled, never a bare number)
 *   - mixed     → "1,200 kg · 340 L"  (broken out, never summed)
 *   - none      → the `zero` fallback ("0 kg" by default)
 */
import type { UnitTotal } from '@/types/api'
export type { UnitTotal }

const nf = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 })

export function formatUnitTotals(totals: UnitTotal[] | undefined | null, opts?: { zero?: string }): string {
  if (!totals || totals.length === 0) return opts?.zero ?? '0 kg'
  return totals.map((t) => `${nf.format(t.total)} ${t.unit}`).join(' · ')
}

/** True when a breakdown spans more than one unit — callers may want a "not comparable" note. */
export function isMixedUnit(totals: UnitTotal[] | undefined | null): boolean {
  return !!totals && totals.length > 1
}

/** Group rows by unit and sum within each — the client-side mirror of the backend helper. */
export function sumByUnit(rows: Array<{ unit: string; qty: number }>): UnitTotal[] {
  const m = new Map<string, number>()
  for (const r of rows) m.set(r.unit, Number(((m.get(r.unit) ?? 0) + r.qty).toFixed(6)))
  return [...m.entries()]
    .map(([unit, total]) => ({ unit, total }))
    .sort((a, b) => (a.unit === 'kg' ? -1 : b.unit === 'kg' ? 1 : a.unit.localeCompare(b.unit)))
}

/** A single labelled amount, e.g. formatAmount(97.8, "kg") → "97.8 kg". */
export function formatAmount(value: number, unit: string): string {
  return `${nf.format(value)} ${unit}`
}

/**
 * The kilogram-only slice of a breakdown. Used ONLY to drive comparative charts
 * (bar/trend), which need a single numeric magnitude per category and are labelled as
 * kilograms — litres are shown as real numbers in the headline totals and the Company
 * Brain, never blended into a kg axis.
 */
export function kgOnly(totals: UnitTotal[] | undefined | null): number {
  return totals?.find((t) => t.unit === 'kg')?.total ?? 0
}
