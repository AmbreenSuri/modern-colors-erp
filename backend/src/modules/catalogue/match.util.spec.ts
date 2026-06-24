import { MatchType } from '@prisma/client';
import { matchMaterial, similarity, CatalogueCandidate } from './match.util';

const items: CatalogueCandidate[] = [
  { id: '1', materialName: 'Titanium Dioxide', sku: 'TIO2-001' },
  { id: '2', materialName: 'Iron Oxide Red', sku: 'FEOR-110' },
  { id: '3', materialName: 'Calcium Carbonate', sku: 'CACO3-200' },
];

describe('catalogue matching (PRD §4.5, invariant I6)', () => {
  it('EXACT on identical name', () => {
    const r = matchMaterial({ materialName: 'Titanium Dioxide' }, items);
    expect(r.matchType).toBe(MatchType.EXACT);
    expect(r.matchedSku).toBe('TIO2-001');
  });

  it('EXACT on SKU even if name differs slightly', () => {
    const r = matchMaterial({ materialName: 'Titanium Di-oxide', sku: 'TIO2-001' }, items);
    expect(r.matchType).toBe(MatchType.EXACT);
  });

  it('EXACT is case/punctuation-insensitive on name', () => {
    const r = matchMaterial({ materialName: 'titanium  dioxide' }, items);
    expect(r.matchType).toBe(MatchType.EXACT);
  });

  it('SIMILAR on a close misspelling', () => {
    const r = matchMaterial({ materialName: 'Titanium Dioxde' }, items);
    expect(r.matchType).toBe(MatchType.SIMILAR);
    expect(r.matchedSku).toBe('TIO2-001');
    expect(r.score).toBeGreaterThanOrEqual(0.82);
  });

  it('NONE on an unrelated material (still returns, never throws — I6)', () => {
    const r = matchMaterial({ materialName: 'Sodium Hydroxide Flakes' }, items);
    expect(r.matchType).toBe(MatchType.NONE);
    expect(r.matchedId).toBeNull();
  });

  it('similarity is symmetric and bounded 0..1', () => {
    expect(similarity('abc', 'abc')).toBe(1);
    expect(similarity('abc', 'xyz')).toBeGreaterThanOrEqual(0);
    expect(similarity('Iron Oxide Red', 'Iron Oxide Yellow')).toBeLessThan(1);
  });
});
