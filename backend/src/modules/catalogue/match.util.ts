import { MatchType } from '@prisma/client';

/**
 * Catalogue matching used by AI-extraction validation (PRD §4.5).
 * Returns EXACT / SIMILAR / NONE. This is INFORMATIONAL ONLY — it never gates
 * an operation (invariant I6). A NONE result must still be confirmable.
 */

export interface CatalogueCandidate {
  id: string;
  materialName: string;
  sku: string;
}

export interface MatchResult {
  matchType: MatchType;
  matchedId: string | null;
  matchedSku: string | null;
  matchedName: string | null;
  score: number; // 0..1 (1 = exact)
}

const SIMILAR_THRESHOLD = 0.82;

export function normalize(s: string | null | undefined): string {
  return (s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let prevDiag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, prevDiag + cost);
      prevDiag = tmp;
    }
  }
  return prev[b.length];
}

export function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na && !nb) return 1;
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const dist = levenshtein(na, nb);
  return 1 - dist / Math.max(na.length, nb.length);
}

/**
 * Find the best catalogue match for an extracted material.
 * @param query  extracted material name (and optional sku)
 * @param items  catalogue candidates (typically all active items)
 */
export function matchMaterial(
  query: { materialName: string; sku?: string | null },
  items: CatalogueCandidate[],
): MatchResult {
  const qName = normalize(query.materialName);
  const qSku = normalize(query.sku);

  // Exact: SKU equality (if provided) or exact normalized-name equality.
  for (const item of items) {
    if (qSku && normalize(item.sku) === qSku) {
      return exact(item);
    }
  }
  for (const item of items) {
    if (qName && normalize(item.materialName) === qName) {
      return exact(item);
    }
  }

  // Otherwise: closest by name similarity.
  let best: CatalogueCandidate | null = null;
  let bestScore = 0;
  for (const item of items) {
    const score = similarity(query.materialName, item.materialName);
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }

  if (best && bestScore >= SIMILAR_THRESHOLD) {
    return {
      matchType: MatchType.SIMILAR,
      matchedId: best.id,
      matchedSku: best.sku,
      matchedName: best.materialName,
      score: round(bestScore),
    };
  }

  return { matchType: MatchType.NONE, matchedId: null, matchedSku: null, matchedName: null, score: round(bestScore) };
}

function exact(item: CatalogueCandidate): MatchResult {
  return {
    matchType: MatchType.EXACT,
    matchedId: item.id,
    matchedSku: item.sku,
    matchedName: item.materialName,
    score: 1,
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
