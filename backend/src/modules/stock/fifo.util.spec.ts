import { ageDays, ageingLevel, fifoSort, olderUnitsThan, AGEING } from './fifo.util';

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const NOW = d('2026-07-13');

describe('FIFO util', () => {
  describe('ageDays', () => {
    it('counts whole days since arrival', () => {
      expect(ageDays(d('2026-07-03'), NOW)).toBe(10);
      expect(ageDays(d('2026-07-13'), NOW)).toBe(0);
    });
    it('returns 0 for unknown or future arrival', () => {
      expect(ageDays(null, NOW)).toBe(0);
      expect(ageDays(d('2026-08-01'), NOW)).toBe(0);
    });
  });

  describe('ageingLevel (30d amber / 60d red)', () => {
    it('classifies by threshold', () => {
      expect(ageingLevel(0)).toBe('FRESH');
      expect(ageingLevel(AGEING.AMBER_DAYS - 1)).toBe('FRESH');
      expect(ageingLevel(AGEING.AMBER_DAYS)).toBe('AMBER');
      expect(ageingLevel(AGEING.RED_DAYS - 1)).toBe('AMBER');
      expect(ageingLevel(AGEING.RED_DAYS)).toBe('RED');
      expect(ageingLevel(200)).toBe('RED');
    });
  });

  describe('fifoSort', () => {
    it('orders oldest-first, same-day tiebreak by uniqueId', () => {
      const units = [
        { uniqueId: 'MC-000005', arrivedAt: d('2026-07-07'), balanceKg: 5 },
        { uniqueId: 'MC-000002', arrivedAt: d('2026-06-24'), balanceKg: 5 },
        { uniqueId: 'MC-000004', arrivedAt: d('2026-07-07'), balanceKg: 5 }, // same day as 005
        { uniqueId: 'MC-000001', arrivedAt: d('2026-06-24'), balanceKg: 5 }, // same day as 002
      ];
      expect(fifoSort(units).map((u) => u.uniqueId)).toEqual([
        'MC-000001', 'MC-000002', 'MC-000004', 'MC-000005',
      ]);
    });
    it('puts unknown-arrival units last (cannot be proven older)', () => {
      const units = [
        { uniqueId: 'MC-000009', arrivedAt: null, balanceKg: 5 },
        { uniqueId: 'MC-000001', arrivedAt: d('2026-07-01'), balanceKg: 5 },
      ];
      expect(fifoSort(units).map((u) => u.uniqueId)).toEqual(['MC-000001', 'MC-000009']);
    });
    it('does not mutate the input array', () => {
      const units = [
        { uniqueId: 'B', arrivedAt: d('2026-07-07'), balanceKg: 5 },
        { uniqueId: 'A', arrivedAt: d('2026-06-24'), balanceKg: 5 },
      ];
      const copy = [...units];
      fifoSort(units);
      expect(units).toEqual(copy);
    });
  });

  describe('olderUnitsThan', () => {
    const units = [
      { uniqueId: 'MC-000001', arrivedAt: d('2026-06-24'), balanceKg: 24 },
      { uniqueId: 'MC-000002', arrivedAt: d('2026-07-01'), balanceKg: 10 },
      { uniqueId: 'MC-000003', arrivedAt: d('2026-07-07'), balanceKg: 0 }, // empty — excluded
      { uniqueId: 'MC-000004', arrivedAt: d('2026-07-09'), balanceKg: 5 },
    ];
    it('finds only in-stock units strictly older than the target', () => {
      const target = { uniqueId: 'MC-000004', arrivedAt: d('2026-07-09'), balanceKg: 5 };
      const older = olderUnitsThan(target, units);
      expect(older.map((u) => u.uniqueId)).toEqual(['MC-000001', 'MC-000002']);
    });
    it('returns empty when the target IS the oldest in-stock unit', () => {
      const target = { uniqueId: 'MC-000001', arrivedAt: d('2026-06-24'), balanceKg: 24 };
      expect(olderUnitsThan(target, units)).toEqual([]);
    });
    it('ignores empty (balance 0) older units', () => {
      // MC-000003 arrived before MC-000004 but is empty, so it is not "older stock available".
      const target = { uniqueId: 'MC-000004', arrivedAt: d('2026-07-09'), balanceKg: 5 };
      const older = olderUnitsThan(target, units);
      expect(older.map((u) => u.uniqueId)).not.toContain('MC-000003');
    });
  });
});
