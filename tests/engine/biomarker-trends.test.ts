import { describe, test, expect } from 'vitest';
import { computeBiomarkerTrends, computeRetestDue } from '@/lib/engine/biomarker-trends';

const mkTest = (taken_at: string, biomarkers: Array<[string, number]>) => ({
  taken_at,
  biomarkers: biomarkers.map(([code, value]) => ({ code, value, unit: 'x' })),
});

describe('computeBiomarkerTrends', () => {
  test('returns empty map for < 2 tests', () => {
    expect(computeBiomarkerTrends([])).toEqual(new Map());
    expect(computeBiomarkerTrends([mkTest('2025-01-01', [['LDL', 110]])])).toEqual(new Map());
  });

  test('LDL going down = improved (lower is better)', () => {
    const trends = computeBiomarkerTrends([
      mkTest('2025-01-01', [['LDL', 130]]),
      mkTest('2025-04-01', [['LDL', 100]]),
    ]);
    const ldl = trends.get('LDL')!;
    expect(ldl.delta).toBe(-30);
    expect(ldl.direction).toBe('down');
    expect(ldl.improved).toBe(true);
  });

  test('HDL going up = improved (higher is better)', () => {
    const trends = computeBiomarkerTrends([
      mkTest('2025-01-01', [['HDL', 40]]),
      mkTest('2025-04-01', [['HDL', 55]]),
    ]);
    const hdl = trends.get('HDL')!;
    expect(hdl.direction).toBe('up');
    expect(hdl.improved).toBe(true);
  });

  test('sub-noise-floor delta is steady, not up/down', () => {
    const trends = computeBiomarkerTrends([
      mkTest('2025-01-01', [['HBA1C', 5.4]]),
      mkTest('2025-04-01', [['HBA1C', 5.45]]),
    ]);
    const hba1c = trends.get('HBA1C')!;
    expect(hba1c.direction).toBe('steady');
    expect(hba1c.improved).toBeNull();
  });

  test('sorts tests by date so caller order does not matter', () => {
    const trends = computeBiomarkerTrends([
      mkTest('2025-04-01', [['APOB', 70]]),    // should be "latest"
      mkTest('2025-01-01', [['APOB', 100]]),   // should be "previous"
    ]);
    const apoB = trends.get('APOB')!;
    expect(apoB.latestValue).toBe(70);
    expect(apoB.previousValue).toBe(100);
    expect(apoB.improved).toBe(true);
  });

  test('ignores codes missing from either test', () => {
    const trends = computeBiomarkerTrends([
      mkTest('2025-01-01', [['LDL', 100], ['HDL', 55]]),
      mkTest('2025-04-01', [['LDL', 95]]),  // no HDL in latest
    ]);
    expect(trends.has('LDL')).toBe(true);
    expect(trends.has('HDL')).toBe(false);
  });
});

describe('computeRetestDue', () => {
  test('empty input returns empty array', () => {
    expect(computeRetestDue(null)).toEqual([]);
  });

  test('returns only OUT-OF-RANGE markers whose retest window has elapsed', () => {
    // 20 weeks ago — well past HBA1C's 12-week retest
    const takenAt = new Date(Date.now() - 20 * 7 * 864e5).toISOString();
    // Out-of-range LDL (optimal is < 100) + in-range HDL
    const due = computeRetestDue(mkTest(takenAt, [
      ['LDL', 150],     // out of range + past retest interval
      ['HDL', 60],      // in range → skipped even if old
    ]));
    expect(due.length).toBeGreaterThan(0);
    expect(due.find(d => d.code === 'LDL')).toBeTruthy();
    expect(due.find(d => d.code === 'HDL')).toBeFalsy();
  });

  test('fresh tests do not generate reminders even if markers are off', () => {
    const takenAt = new Date().toISOString();  // today
    const due = computeRetestDue(mkTest(takenAt, [['LDL', 150]]));
    expect(due.length).toBe(0);
  });
});
