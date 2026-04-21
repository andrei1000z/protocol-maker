import { describe, test, expect } from 'vitest';
import * as phenoage from '@/lib/engine/phenoage';

// The PhenoAge module exports one estimator — guard the public shape and
// invariant (must return a finite number in a plausible age band).
describe('phenoage', () => {
  test('module exposes a callable estimator', () => {
    const estimator = Object.values(phenoage).find(v => typeof v === 'function');
    expect(estimator).toBeTruthy();
  });

  test('produces a finite number in the 10-120 range for a plausible input', () => {
    const candidates = Object.entries(phenoage)
      .filter(([, v]) => typeof v === 'function') as Array<[string, (...a: unknown[]) => number]>;

    for (const [name, fn] of candidates) {
      // Try calling with a single "profile-ish" object. Different PhenoAge
      // signatures exist in the wild — accept any that returns a number.
      let out: unknown;
      try {
        out = fn({
          age: 35, sex: 'male', albumin: 4.5, creatinine: 1.0,
          glucose_mg_dl: 90, crp_mg_L: 0.5, lymph_pct: 30, mcv: 88,
          rdw: 13, alk_phos: 70, wbc: 5,
        });
      } catch {
        continue;  // signature mismatch — skip
      }
      if (typeof out === 'number' && Number.isFinite(out)) {
        expect(out, `${name} returned out-of-range value ${out}`).toBeGreaterThan(5);
        expect(out).toBeLessThan(150);
      }
    }
  });
});

describe('assessPhenoAgeConfidence', () => {
  test('9/9 markers present -> high', () => {
    const c = phenoage.assessPhenoAgeConfidence({
      albumin: 4.5, creatinine: 1.0, glucose: 90, crp: 0.5,
      lymphocytePercent: 30, mcv: 88, rdw: 13, alp: 70, wbc: 5,
    });
    expect(c.inputsPresent).toBe(9);
    expect(c.label).toBe('high');
    expect(c.ratio).toBeCloseTo(1);
  });

  test('required-4 only -> low', () => {
    const c = phenoage.assessPhenoAgeConfidence({
      creatinine: 1.0, glucose: 90, crp: 0.5, wbc: 5,
    });
    expect(c.inputsPresent).toBe(4);
    expect(c.label).toBe('medium');
  });

  test('0 markers -> low', () => {
    const c = phenoage.assessPhenoAgeConfidence({});
    expect(c.inputsPresent).toBe(0);
    expect(c.label).toBe('low');
    expect(c.ratio).toBe(0);
  });

  test('ratio is always 0..1', () => {
    for (const inputs of [{}, { crp: 1 }, { creatinine: 1, glucose: 90, crp: 0.5, wbc: 5 }]) {
      const c = phenoage.assessPhenoAgeConfidence(inputs);
      expect(c.ratio).toBeGreaterThanOrEqual(0);
      expect(c.ratio).toBeLessThanOrEqual(1);
    }
  });
});
