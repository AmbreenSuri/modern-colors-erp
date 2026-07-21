import { unitTotals, mergeUnitTotals, isMixedUnit, kgOnly } from './unit-total';

/**
 * The helper every aggregate now flows through. If this holds, no dashboard can be
 * handed a blended kg+L number — there is simply no code path that produces one.
 */
describe('unitTotals — the never-blend primitive', () => {
  it('sums within a unit, never across units', () => {
    const t = unitTotals([
      { unit: 'kg', qty: 100 },
      { unit: 'kg', qty: 50 },
      { unit: 'L', qty: 200 },
    ]);
    expect(t).toEqual([
      { unit: 'kg', total: 150 },
      { unit: 'L', total: 200 },
    ]);
    // The blended figure must not exist anywhere in the result.
    expect(t.some((x) => x.total === 350)).toBe(false);
  });

  it('collapses to a single entry when rows are uniform', () => {
    const t = unitTotals([
      { unit: 'kg', qty: 10 },
      { unit: 'kg', qty: 5 },
    ]);
    expect(t).toEqual([{ unit: 'kg', total: 15 }]);
    expect(isMixedUnit(t)).toBe(false);
  });

  it('flags mixed units so a caller can refuse to show one number', () => {
    expect(isMixedUnit(unitTotals([{ unit: 'kg', qty: 1 }, { unit: 'L', qty: 1 }]))).toBe(true);
  });

  it('treats a missing unit as kg (legacy rows), and sorts kg first', () => {
    const t = unitTotals([
      { unit: 'L', qty: 3 },
      { unit: null, qty: 2 },
      { unit: undefined, qty: 1 },
    ]);
    expect(t).toEqual([
      { unit: 'kg', total: 3 },
      { unit: 'L', total: 3 },
    ]);
  });

  it('mergeUnitTotals combines per-department breakdowns without blending', () => {
    const merged = mergeUnitTotals([
      [{ unit: 'kg', total: 10 }, { unit: 'L', total: 5 }],
      [{ unit: 'kg', total: 20 }],
    ]);
    expect(merged).toEqual([
      { unit: 'kg', total: 30 },
      { unit: 'L', total: 5 },
    ]);
  });

  it('kgOnly returns the kilogram slice, never a blend', () => {
    const t = unitTotals([{ unit: 'kg', qty: 40 }, { unit: 'L', qty: 60 }]);
    expect(kgOnly(t)).toBe(40); // not 100
    expect(kgOnly([{ unit: 'L', total: 9 }])).toBe(0);
  });

  it('returns [] for no rows (renders as an honest zero, not NaN)', () => {
    expect(unitTotals([])).toEqual([]);
    expect(kgOnly([])).toBe(0);
  });
});
