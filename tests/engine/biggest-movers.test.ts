import { describe, test, expect } from 'vitest';
import { computeMover, pickBiggestMovers, type MoverInput } from '@/lib/engine/biggest-movers';

const series = (values: number[]) =>
  values.map((v, i) => ({ date: `2026-04-${String(i + 1).padStart(2, '0')}`, value: v }));

const base: Omit<MoverInput, 'series'> = { key: 'sleep_hours', label: 'Sleep', direction: 'up' };

describe('computeMover', () => {
  test('returns null when the series has <4 points', () => {
    expect(computeMover({ ...base, series: series([7, 7, 7]) })).toBeNull();
    expect(computeMover({ ...base, series: [] })).toBeNull();
  });

  test('detects an "up"-direction improvement', () => {
    const m = computeMover({ ...base, series: series([6, 6, 6, 8, 8, 8]) });
    expect(m).not.toBeNull();
    expect(m!.improved).toBe(true);
    expect(m!.improvementPct).toBeGreaterThan(0);
    expect(m!.priorAvg).toBeCloseTo(6);
    expect(m!.recentAvg).toBeCloseTo(8);
  });

  test('detects an "up"-direction decline', () => {
    const m = computeMover({ ...base, series: series([8, 8, 8, 6, 6, 6]) });
    expect(m!.improved).toBe(false);
    expect(m!.improvementPct).toBeLessThan(0);
  });

  test('"down"-direction — lower value is improvement', () => {
    const m = computeMover({
      key: 'resting_hr', label: 'RHR', direction: 'down',
      series: series([70, 70, 70, 60, 60, 60]),
    });
    expect(m!.improved).toBe(true);
    expect(m!.improvementPct).toBeGreaterThan(0);     // always positive when improved
    expect(m!.pctChange).toBeLessThan(0);             // raw change is negative
  });

  test('"target"-direction — closer to target wins', () => {
    // Target 8h sleep. Priors avg 6, recent avg 8 → closer → improved.
    const m = computeMover({
      key: 'sleep', label: 'Sleep', direction: 'target', target: 8,
      series: series([6, 6, 6, 8, 8, 8]),
    });
    expect(m!.improved).toBe(true);
    expect(m!.improvementPct).toBeGreaterThan(0);

    // Flipped: priors closer to target, recent drifted away.
    const decline = computeMover({
      key: 'sleep', label: 'Sleep', direction: 'target', target: 8,
      series: series([8, 8, 8, 6, 6, 6]),
    });
    expect(decline!.improved).toBe(false);
  });

  test('flat series returns improved=null, improvementPct=0', () => {
    const m = computeMover({ ...base, series: series([7, 7, 7, 7, 7, 7]) });
    expect(m!.improved).toBeNull();
    expect(m!.improvementPct).toBe(0);
  });
});

describe('pickBiggestMovers', () => {
  test('returns [] when no input has enough points', () => {
    expect(pickBiggestMovers([{ ...base, series: series([7]) }])).toEqual([]);
  });

  test('returns top N sorted by absolute improvementPct', () => {
    const inputs: MoverInput[] = [
      // tiny change
      { key: 'a', label: 'A', direction: 'up', series: series([10, 10, 10, 10.5, 10.5, 10.5]) },
      // huge improvement
      { key: 'b', label: 'B', direction: 'up', series: series([5, 5, 5, 10, 10, 10]) },
      // medium decline
      { key: 'c', label: 'C', direction: 'up', series: series([8, 8, 8, 6, 6, 6]) },
    ];
    const top = pickBiggestMovers(inputs, 2);
    expect(top.length).toBe(2);
    expect(top[0].key).toBe('b');
    // second place should be the ~25% decline, not the ~5% bump
    expect(top[1].key).toBe('c');
  });

  test('absolute value ranks improvements AND declines equally', () => {
    const inputs: MoverInput[] = [
      { key: 'up50', label: 'up', direction: 'up',   series: series([10, 10, 10, 15, 15, 15]) },
      { key: 'dn50', label: 'dn', direction: 'down', series: series([10, 10, 10,  5,  5,  5]) },
    ];
    const top = pickBiggestMovers(inputs, 2);
    expect(top.length).toBe(2);
    // Both hit ±50% — either can be first; just ensure both surface.
    expect(top.map(m => m.key).sort()).toEqual(['dn50', 'up50']);
  });

  test('respects limit parameter', () => {
    const inputs: MoverInput[] = Array.from({ length: 8 }, (_, i) => ({
      key: `m${i}`, label: `M${i}`, direction: 'up' as const,
      series: series([5, 5, 5, 5 + i, 5 + i, 5 + i]),
    }));
    expect(pickBiggestMovers(inputs, 3).length).toBe(3);
    expect(pickBiggestMovers(inputs, 5).length).toBe(5);
  });
});
