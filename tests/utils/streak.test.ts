import { describe, test, expect } from 'vitest';
import {
  calculateStreak, calculateStreakForgiving, calculateLongestStreak,
  countPerfectDays, type ComplianceEntry,
} from '@/lib/utils/streak';

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

describe('calculateStreak', () => {
  test('returns 0 for an empty history', () => {
    expect(calculateStreak([])).toBe(0);
  });

  test('returns 0 when today/yesterday have no data above threshold', () => {
    const history: ComplianceEntry[] = [
      { date: isoDaysAgo(0), pct: 20, completed: 1, total: 5 },
    ];
    expect(calculateStreak(history, 50)).toBe(0);
  });

  test('counts consecutive days meeting the threshold starting today', () => {
    const history: ComplianceEntry[] = [
      { date: isoDaysAgo(0), pct: 80, completed: 4, total: 5 },
      { date: isoDaysAgo(1), pct: 80, completed: 4, total: 5 },
      { date: isoDaysAgo(2), pct: 80, completed: 4, total: 5 },
      { date: isoDaysAgo(3), pct: 10, completed: 0, total: 5 },  // breaks streak
    ];
    expect(calculateStreak(history, 50)).toBe(3);
  });

  test('gracefully starts from yesterday when today not in history', () => {
    const history: ComplianceEntry[] = [
      { date: isoDaysAgo(1), pct: 80, completed: 4, total: 5 },
      { date: isoDaysAgo(2), pct: 80, completed: 4, total: 5 },
    ];
    expect(calculateStreak(history, 50)).toBe(2);
  });
});

describe('calculateLongestStreak', () => {
  test('returns 0 for empty history', () => {
    expect(calculateLongestStreak([])).toBe(0);
  });

  test('finds the longest run of consecutive above-threshold days', () => {
    const history: ComplianceEntry[] = [
      { date: '2026-04-01', pct: 80, completed: 4, total: 5 },
      { date: '2026-04-02', pct: 80, completed: 4, total: 5 },
      { date: '2026-04-03', pct: 20, completed: 1, total: 5 },  // break
      { date: '2026-04-04', pct: 80, completed: 4, total: 5 },
      { date: '2026-04-05', pct: 90, completed: 4, total: 5 },
      { date: '2026-04-06', pct: 85, completed: 4, total: 5 },
      { date: '2026-04-07', pct: 85, completed: 4, total: 5 },
    ];
    // Longest is the 4-day run 04→07
    expect(calculateLongestStreak(history, 50)).toBeGreaterThanOrEqual(4);
  });

  test('single above-threshold day gives a streak of 1', () => {
    expect(calculateLongestStreak([
      { date: '2026-01-01', pct: 80, completed: 4, total: 5 },
    ], 50)).toBe(1);
  });
});

describe('calculateStreakForgiving', () => {
  test('empty history = 0 days, grace not used', () => {
    expect(calculateStreakForgiving([])).toEqual({ days: 0, graceUsed: false });
  });

  test('5 consecutive met days + 1 missed + 1 met = continues with grace', () => {
    const history: ComplianceEntry[] = [
      { date: isoDaysAgo(0), pct: 80, completed: 4, total: 5 },  // today: met
      { date: isoDaysAgo(1), pct: 20, completed: 1, total: 5 },  // yesterday: missed (grace)
      { date: isoDaysAgo(2), pct: 80, completed: 4, total: 5 },  // met
      { date: isoDaysAgo(3), pct: 80, completed: 4, total: 5 },
      { date: isoDaysAgo(4), pct: 80, completed: 4, total: 5 },
      { date: isoDaysAgo(5), pct: 80, completed: 4, total: 5 },
    ];
    const result = calculateStreakForgiving(history, 50);
    expect(result.graceUsed).toBe(true);
    expect(result.days).toBeGreaterThanOrEqual(5);
  });

  test('two consecutive missed days break the streak', () => {
    const history: ComplianceEntry[] = [
      { date: isoDaysAgo(0), pct: 20, completed: 1, total: 5 },  // today: missed
      { date: isoDaysAgo(1), pct: 20, completed: 1, total: 5 },  // yesterday: missed — 2 in a row = break
      { date: isoDaysAgo(2), pct: 80, completed: 4, total: 5 },
      { date: isoDaysAgo(3), pct: 80, completed: 4, total: 5 },
    ];
    const result = calculateStreakForgiving(history, 50);
    expect(result.days).toBe(0);
  });

  test('no missed days = grace not used', () => {
    const history: ComplianceEntry[] = [
      { date: isoDaysAgo(0), pct: 80, completed: 4, total: 5 },
      { date: isoDaysAgo(1), pct: 80, completed: 4, total: 5 },
      { date: isoDaysAgo(2), pct: 80, completed: 4, total: 5 },
    ];
    const result = calculateStreakForgiving(history, 50);
    expect(result.days).toBe(3);
    expect(result.graceUsed).toBe(false);
  });

  test('calculateStreak delegates to forgiving variant', () => {
    const history: ComplianceEntry[] = [
      { date: isoDaysAgo(0), pct: 80, completed: 4, total: 5 },
      { date: isoDaysAgo(1), pct: 80, completed: 4, total: 5 },
    ];
    expect(calculateStreak(history, 50)).toBe(2);
  });
});

describe('countPerfectDays', () => {
  test('counts entries where pct = 100', () => {
    const history: ComplianceEntry[] = [
      { date: '2026-04-01', pct: 100, completed: 5, total: 5 },
      { date: '2026-04-02', pct: 95, completed: 4, total: 5 },
      { date: '2026-04-03', pct: 100, completed: 5, total: 5 },
    ];
    expect(countPerfectDays(history)).toBe(2);
  });

  test('0 perfect days in an empty or imperfect history', () => {
    expect(countPerfectDays([])).toBe(0);
    expect(countPerfectDays([
      { date: '2026-04-01', pct: 80, completed: 4, total: 5 },
    ])).toBe(0);
  });
});
