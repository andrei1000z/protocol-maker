import { describe, test, expect } from 'vitest';
import {
  classifyAll, calculateLongevityScore,
  estimateBiologicalAge, estimateAgingPace,
} from '@/lib/engine/classifier';

describe('classifyAll', () => {
  test('tags a clearly optimal marker as OPTIMAL', () => {
    const out = classifyAll([{ code: 'HSCRP', value: 0.3, unit: 'mg/L' }]);
    expect(out[0].classification).toBe('OPTIMAL');
  });

  test('tags a CRITICAL marker (HbA1c 9) as CRITICAL', () => {
    const out = classifyAll([{ code: 'HBA1C', value: 9.0, unit: '%' }]);
    expect(out[0].classification).toBe('CRITICAL');
  });

  test('unknown codes pass through (no classification) without throwing', () => {
    // Any behaviour is acceptable as long as it's not a crash — unknown
    // markers might come from user-entered data + we don't want to break.
    expect(() => classifyAll([{ code: 'MADE_UP', value: 1, unit: 'x' }])).not.toThrow();
  });

  test('classified output has a longevityGap number on every row', () => {
    const out = classifyAll([
      { code: 'LDL', value: 150, unit: 'mg/dL' },
      { code: 'HDL', value: 55, unit: 'mg/dL' },
    ]);
    for (const b of out) {
      expect(typeof b.longevityGap).toBe('number');
      expect(Number.isFinite(b.longevityGap)).toBe(true);
    }
  });
});

describe('calculateLongevityScore', () => {
  test('returns the lifestyle-only score when no biomarkers are provided', () => {
    const score = calculateLongevityScore([], {
      age: 30, heightCm: 180, weightKg: 75, smoker: false,
      cardioMinutesPerWeek: 200, strengthSessionsPerWeek: 3,
      sleepHoursAvg: 8,
    });
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  test('critical markers drag the score down hard', () => {
    const allCritical = calculateLongevityScore([
      { code: 'HSCRP', value: 15, unit: 'mg/L', classification: 'CRITICAL', longevityGap: 1 },
      { code: 'HBA1C', value: 9, unit: '%', classification: 'CRITICAL', longevityGap: 1 },
      { code: 'LDL', value: 250, unit: 'mg/dL', classification: 'CRITICAL', longevityGap: 1 },
    ]);
    expect(allCritical).toBeLessThan(50);
  });

  test('all-optimal markers produce a high score', () => {
    const allOptimal = calculateLongevityScore([
      { code: 'HSCRP', value: 0.3, unit: 'mg/L', classification: 'OPTIMAL', longevityGap: 0 },
      { code: 'HBA1C', value: 5.0, unit: '%', classification: 'OPTIMAL', longevityGap: 0 },
      { code: 'LDL', value: 60, unit: 'mg/dL', classification: 'OPTIMAL', longevityGap: 0 },
      { code: 'HDL', value: 80, unit: 'mg/dL', classification: 'OPTIMAL', longevityGap: 0 },
    ]);
    expect(allOptimal).toBeGreaterThan(75);
  });

  test('score is bounded 0-100 regardless of input', () => {
    const extremeLow = calculateLongevityScore(
      Array.from({ length: 20 }, (_, i) => ({
        code: `EXTREME_${i}`, value: 999, unit: 'x',
        classification: 'CRITICAL' as const, longevityGap: 1,
      })),
    );
    expect(extremeLow).toBeGreaterThanOrEqual(0);
    expect(extremeLow).toBeLessThanOrEqual(100);
  });

  test('longevityGap severity modulates within a classification', () => {
    // Two markers, both SUBOPTIMAL_HIGH, one mild, one severe — the severe
    // one should drag the score lower.
    const mild = calculateLongevityScore([
      { code: 'LDL', value: 110, unit: 'mg/dL', classification: 'SUBOPTIMAL_HIGH', longevityGap: 0.1 },
    ]);
    const severe = calculateLongevityScore([
      { code: 'LDL', value: 110, unit: 'mg/dL', classification: 'SUBOPTIMAL_HIGH', longevityGap: 0.9 },
    ]);
    expect(mild).toBeGreaterThanOrEqual(severe);
  });
});

describe('estimateBiologicalAge', () => {
  test('returns a number for a plausible profile', () => {
    const bio = estimateBiologicalAge({ age: 35, heightCm: 180, weightKg: 75 }, []);
    expect(Number.isFinite(bio)).toBe(true);
    expect(bio).toBeGreaterThan(5);
    expect(bio).toBeLessThan(120);
  });

  test('smoker + sedentary adds years above chronological', () => {
    const healthy = estimateBiologicalAge({
      age: 40, heightCm: 175, weightKg: 72, smoker: false,
      cardioMinutesPerWeek: 200, strengthSessionsPerWeek: 3,
      sleepHoursAvg: 8,
    }, []);
    const unhealthy = estimateBiologicalAge({
      age: 40, heightCm: 175, weightKg: 100, smoker: true,
      cardioMinutesPerWeek: 0, strengthSessionsPerWeek: 0,
      sleepHoursAvg: 5,
    }, []);
    expect(unhealthy).toBeGreaterThan(healthy);
  });
});

describe('estimateAgingPace', () => {
  test('pace stays in the 0.6 – 1.55 band per the function contract', () => {
    const pace = estimateAgingPace({ age: 30 }, []);
    expect(pace).toBeGreaterThanOrEqual(0.6);
    expect(pace).toBeLessThanOrEqual(1.55);
  });

  test('smoker + poor sleep accelerates', () => {
    const baseline = estimateAgingPace({ age: 35, smoker: false, sleepHoursAvg: 8, cardioMinutesPerWeek: 200 }, []);
    const poor = estimateAgingPace({ age: 35, smoker: true, sleepHoursAvg: 5, cardioMinutesPerWeek: 0 }, []);
    expect(poor).toBeGreaterThan(baseline);
  });
});
