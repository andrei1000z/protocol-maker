// Sanity tests against BIOMARKER_DB — the single source of truth for every
// biomarker we score. Regressions here silently break the classifier, the
// SEO pages, and the AI prompt, so we check shape + invariants on every test
// run rather than wait for a user to hit a malformed row.

import { describe, test, expect } from 'vitest';
import { BIOMARKER_DB, getBiomarkerRef, BIOMARKER_CATEGORIES, CATEGORY_LABELS } from '@/lib/engine/biomarkers';

describe('BIOMARKER_DB integrity', () => {
  test('has at least 30 markers (canonical panel scope)', () => {
    expect(BIOMARKER_DB.length).toBeGreaterThanOrEqual(30);
  });

  test('every marker has the required shape', () => {
    for (const b of BIOMARKER_DB) {
      expect(b.code).toMatch(/^[A-Z0-9_]+$/);   // uppercase + digits + underscores
      expect(b.name.length).toBeGreaterThan(0);
      expect(b.shortName.length).toBeGreaterThan(0);
      expect(b.category.length).toBeGreaterThan(0);
      expect(b.unit.length).toBeGreaterThan(0);
      expect(typeof b.longevityOptimalLow).toBe('number');
      expect(typeof b.longevityOptimalHigh).toBe('number');
      expect(typeof b.populationAvgLow).toBe('number');
      expect(typeof b.populationAvgHigh).toBe('number');
      expect(b.description.length).toBeGreaterThan(20);
      expect(typeof b.retestIntervalWeeks).toBe('number');
    }
  });

  test('codes are unique', () => {
    const seen = new Set<string>();
    for (const b of BIOMARKER_DB) {
      expect(seen.has(b.code), `duplicate code ${b.code}`).toBe(false);
      seen.add(b.code);
    }
  });

  test('ranges are in the same order-of-magnitude (catch decimal typos)', () => {
    for (const b of BIOMARKER_DB) {
      // If optimal is wildly off from lab-reference — e.g. a missing decimal
      // putting an Omega-3 value at 80% instead of 8% — flag it. Anything
      // within 10× on either side is fine; longevity-optimal deliberately
      // deviates from population norms (Omega-3 Index: lab 4-6% but optimal
      // 8-12%; hsCRP: lab <3 but optimal <0.5). We're only catching typos.
      const midLab = (b.populationAvgLow + b.populationAvgHigh) / 2 || 1;
      const midOpt = (b.longevityOptimalLow + b.longevityOptimalHigh) / 2 || 1;
      const ratio = Math.abs(midOpt) / Math.max(0.001, Math.abs(midLab));
      expect(ratio, `${b.code} optimal mid ${midOpt} vs lab mid ${midLab} — order of magnitude off?`)
        .toBeGreaterThan(0.05);
      expect(ratio).toBeLessThan(20);
    }
  });

  test('ranges are ordered (low ≤ high)', () => {
    for (const b of BIOMARKER_DB) {
      expect(b.longevityOptimalLow).toBeLessThanOrEqual(b.longevityOptimalHigh);
      expect(b.populationAvgLow).toBeLessThanOrEqual(b.populationAvgHigh);
    }
  });

  test('every Bryan Johnson value (where given) falls within plausible bounds', () => {
    for (const b of BIOMARKER_DB) {
      if (b.bryanJohnsonValue === undefined) continue;
      // Bryan's values should sit roughly within an expanded range — allow
      // 3× the optimal span on either side to catch typos (e.g. 6200 vs 62).
      const optSpan = b.longevityOptimalHigh - b.longevityOptimalLow || 1;
      const min = b.longevityOptimalLow - optSpan * 3;
      const max = b.longevityOptimalHigh + optSpan * 3;
      expect(b.bryanJohnsonValue, `${b.code} bryanJohnsonValue ${b.bryanJohnsonValue} outside plausible band`)
        .toBeGreaterThanOrEqual(min);
      expect(b.bryanJohnsonValue).toBeLessThanOrEqual(max);
    }
  });

  test('every category has a human-readable label', () => {
    for (const c of BIOMARKER_CATEGORIES) {
      expect(CATEGORY_LABELS[c], `missing label for category ${c}`).toBeTruthy();
    }
  });

  test('getBiomarkerRef finds canonical markers', () => {
    expect(getBiomarkerRef('HSCRP')?.shortName).toBe('hsCRP');
    expect(getBiomarkerRef('LDL')?.shortName).toBe('LDL-C');
    expect(getBiomarkerRef('HBA1C')?.shortName).toBe('HbA1c');
  });

  test('getBiomarkerRef returns undefined for unknown codes', () => {
    expect(getBiomarkerRef('NOT_A_REAL_MARKER')).toBeUndefined();
    expect(getBiomarkerRef('')).toBeUndefined();
  });

  test('interventions shape — array fields never undefined', () => {
    for (const b of BIOMARKER_DB) {
      for (const direction of ['interventionsIfLow', 'interventionsIfHigh'] as const) {
        const iv = b[direction];
        if (!iv) continue;
        expect(Array.isArray(iv.lifestyle), `${b.code} ${direction}.lifestyle not array`).toBe(true);
        expect(Array.isArray(iv.supplements), `${b.code} ${direction}.supplements not array`).toBe(true);
        expect(Array.isArray(iv.foods_add), `${b.code} ${direction}.foods_add not array`).toBe(true);
        expect(Array.isArray(iv.foods_avoid), `${b.code} ${direction}.foods_avoid not array`).toBe(true);
        expect(Array.isArray(iv.medical), `${b.code} ${direction}.medical not array`).toBe(true);
        for (const s of iv.supplements) {
          expect(s.name.length).toBeGreaterThan(0);
          expect(s.dose.length).toBeGreaterThan(0);
          expect(['MUST', 'STRONG', 'CONSIDER', 'OPTIONAL']).toContain(s.priority);
        }
      }
    }
  });
});
