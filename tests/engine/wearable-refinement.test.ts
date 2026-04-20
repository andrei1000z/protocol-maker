import { describe, test, expect } from 'vitest';
import {
  summarizeRecentMetrics, refineAgingPace, refineBiologicalAge,
  refineLongevityScore, describeRecentSignals,
  type RecentMetricRow,
} from '@/lib/engine/wearable-refinement';

const mkRows = (n: number, partial: Partial<RecentMetricRow>): RecentMetricRow[] =>
  Array.from({ length: n }, () => ({ ...partial }));

const profile35M = { age: 35, sex: 'male' };

describe('summarizeRecentMetrics', () => {
  test('returns zero-days summary for empty input', () => {
    const s = summarizeRecentMetrics([], profile35M);
    expect(s.days).toBe(0);
    expect(s.restingHR).toBeNull();
    expect(s.hrv).toBeNull();
    expect(s.restingHRBelowExpected).toBeNull();
  });

  test('treats < 5 values as "not enough signal" (avg → null)', () => {
    const s = summarizeRecentMetrics(mkRows(4, { resting_hr: 58, hrv: 60 }), profile35M);
    expect(s.restingHR).toBeNull();
    expect(s.hrv).toBeNull();
  });

  test('averages are computed once we hit 5+ samples', () => {
    const s = summarizeRecentMetrics(mkRows(10, { resting_hr: 58, hrv: 60 }), profile35M);
    expect(s.restingHR).toBeCloseTo(58);
    expect(s.hrv).toBeCloseTo(60);
  });

  test('prefers sleep HRV over daytime HRV when both exist', () => {
    const rows = mkRows(10, { hrv: 30, hrv_sleep_avg: 50 });
    const s = summarizeRecentMetrics(rows, profile35M);
    expect(s.hrv).toBeCloseTo(50);
  });

  test('flags elite resting HR as below-expected', () => {
    const s = summarizeRecentMetrics(mkRows(10, { resting_hr: 48 }), profile35M);
    expect(s.restingHRBelowExpected).toBe(true);
  });

  test('flags poor resting HR as above-expected', () => {
    const s = summarizeRecentMetrics(mkRows(10, { resting_hr: 85 }), profile35M);
    expect(s.restingHRBelowExpected).toBe(false);
  });

  test('sleep consistency flags σ < 0.9h as consistent', () => {
    // Values cluster tight around 7.5h → σ small
    const rows: RecentMetricRow[] = [
      { sleep_hours: 7.4 }, { sleep_hours: 7.5 }, { sleep_hours: 7.6 },
      { sleep_hours: 7.5 }, { sleep_hours: 7.4 }, { sleep_hours: 7.5 },
    ];
    const s = summarizeRecentMetrics(rows, profile35M);
    expect(s.sleepIsConsistent).toBe(true);
  });

  test('sleep consistency flags σ > 0.9h as inconsistent', () => {
    const rows: RecentMetricRow[] = [
      { sleep_hours: 5.0 }, { sleep_hours: 9.5 }, { sleep_hours: 6.0 },
      { sleep_hours: 8.5 }, { sleep_hours: 5.5 }, { sleep_hours: 9.0 },
    ];
    const s = summarizeRecentMetrics(rows, profile35M);
    expect(s.sleepIsConsistent).toBe(false);
  });

  test('stress_level_avg overrides stress_level when both are present', () => {
    const rows = mkRows(10, { stress_level: 3, stress_level_avg: 8 });
    const s = summarizeRecentMetrics(rows, profile35M);
    expect(s.stress).toBeCloseTo(8);
  });
});

describe('refineAgingPace', () => {
  test('less than 5 days of data → no adjustment at all', () => {
    const base = 1.0;
    const s = summarizeRecentMetrics(mkRows(3, { resting_hr: 45 }), profile35M);
    expect(refineAgingPace(base, s)).toBeCloseTo(base);
  });

  test('excellent metrics with lots of days push pace down', () => {
    const s = summarizeRecentMetrics(mkRows(28, {
      resting_hr: 48, hrv_sleep_avg: 70, sleep_hours: 8, steps: 12_000,
      bp_systolic_morning: 112,
    }), profile35M);
    expect(refineAgingPace(1.0, s)).toBeLessThan(1.0);
  });

  test('poor metrics push pace up', () => {
    const s = summarizeRecentMetrics(mkRows(20, {
      resting_hr: 88, hrv_sleep_avg: 20, sleep_hours: 5.5,
      steps: 3000, stress_level_avg: 8, bp_systolic_morning: 142,
    }), profile35M);
    expect(refineAgingPace(1.0, s)).toBeGreaterThan(1.0);
  });

  test('pace stays in the 0.6–1.55 contract range', () => {
    const sGood = summarizeRecentMetrics(mkRows(28, {
      resting_hr: 42, hrv_sleep_avg: 90, sleep_hours: 8, steps: 20_000,
    }), profile35M);
    expect(refineAgingPace(0.6, sGood)).toBeGreaterThanOrEqual(0.6);
    expect(refineAgingPace(1.55, sGood)).toBeLessThanOrEqual(1.55);
  });

  test('high confidence (>=25 days) allows larger adjustment than low (5-11 days)', () => {
    const highDays = summarizeRecentMetrics(mkRows(30, {
      resting_hr: 50, hrv_sleep_avg: 65, sleep_hours: 7.8,
    }), profile35M);
    const lowDays = summarizeRecentMetrics(mkRows(6, {
      resting_hr: 50, hrv_sleep_avg: 65, sleep_hours: 7.8,
    }), profile35M);
    const base = 1.1;
    const drifteHigh = Math.abs(refineAgingPace(base, highDays) - base);
    const driftLow = Math.abs(refineAgingPace(base, lowDays) - base);
    expect(drifteHigh).toBeGreaterThan(driftLow);
  });
});

describe('refineBiologicalAge', () => {
  test('< 5 days of data → baseline unchanged (within rounding)', () => {
    const s = summarizeRecentMetrics(mkRows(2, { resting_hr: 40 }), profile35M);
    expect(refineBiologicalAge(38.5, 40, s)).toBeCloseTo(38.5, 1);
  });

  test('bio age caps at chronoAge + 25 years', () => {
    const s = summarizeRecentMetrics(mkRows(30, {
      resting_hr: 99, bp_systolic_morning: 160, steps: 1000, sleep_hours: 4,
    }), profile35M);
    const refined = refineBiologicalAge(90, 35, s);
    expect(refined).toBeLessThanOrEqual(35 + 25);
  });

  test('bio age never goes below 5', () => {
    const s = summarizeRecentMetrics(mkRows(30, {
      resting_hr: 40, hrv_sleep_avg: 120, sleep_hours: 8, steps: 25000,
    }), profile35M);
    const refined = refineBiologicalAge(8, 35, s);
    expect(refined).toBeGreaterThanOrEqual(5);
  });
});

describe('refineLongevityScore', () => {
  test('stays within 0-100', () => {
    const sPerfect = summarizeRecentMetrics(mkRows(30, {
      resting_hr: 42, hrv_sleep_avg: 90, sleep_hours: 8, steps: 20000, bp_systolic_morning: 115,
    }), profile35M);
    const sAwful = summarizeRecentMetrics(mkRows(30, {
      resting_hr: 95, hrv_sleep_avg: 15, sleep_hours: 4, steps: 1000,
      bp_systolic_morning: 160, stress_level_avg: 9,
    }), profile35M);
    expect(refineLongevityScore(100, sPerfect)).toBeLessThanOrEqual(100);
    expect(refineLongevityScore(0, sAwful)).toBeGreaterThanOrEqual(0);
    expect(refineLongevityScore(50, sPerfect)).toBeGreaterThanOrEqual(0);
    expect(refineLongevityScore(50, sAwful)).toBeLessThanOrEqual(100);
  });

  test('elite metrics nudge score up from the baseline', () => {
    const s = summarizeRecentMetrics(mkRows(28, {
      resting_hr: 48, hrv_sleep_avg: 70, sleep_hours: 8, steps: 12_000,
    }), profile35M);
    expect(refineLongevityScore(70, s)).toBeGreaterThan(70);
  });

  test('poor metrics nudge score down from baseline', () => {
    const s = summarizeRecentMetrics(mkRows(28, {
      resting_hr: 88, hrv_sleep_avg: 20, sleep_hours: 5, steps: 3000,
      stress_level_avg: 8, bp_systolic_morning: 145,
    }), profile35M);
    expect(refineLongevityScore(70, s)).toBeLessThan(70);
  });
});

describe('describeRecentSignals', () => {
  test('empty input produces the "no data" phrasing', () => {
    const s = summarizeRecentMetrics([], profile35M);
    expect(describeRecentSignals(s)).toMatch(/no wearable/i);
  });

  test('non-empty input mentions resting HR and sleep', () => {
    const s = summarizeRecentMetrics(mkRows(10, {
      resting_hr: 50, hrv_sleep_avg: 65, sleep_hours: 7.8, steps: 9000,
    }), profile35M);
    const text = describeRecentSignals(s);
    expect(text).toMatch(/resting hr/i);
    expect(text).toMatch(/sleep/i);
    expect(text).toMatch(/steps/i);
  });
});
