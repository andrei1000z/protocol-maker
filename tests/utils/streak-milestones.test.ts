import { describe, test, expect, beforeEach, vi } from 'vitest';
import {
  STREAK_MILESTONES,
  milestoneFor,
  nextMilestone,
  progressToNext,
  markMilestoneCelebrated,
  getCelebratedSet,
  getUncelebratedMilestone,
} from '@/lib/utils/streak-milestones';

describe('milestone ladder', () => {
  test('milestoneFor returns null below first threshold', () => {
    expect(milestoneFor(0)).toBeNull();
    expect(milestoneFor(2)).toBeNull();
  });

  test('milestoneFor returns highest crossed milestone', () => {
    expect(milestoneFor(3)?.days).toBe(3);
    expect(milestoneFor(8)?.days).toBe(7);
    expect(milestoneFor(29)?.days).toBe(14);
    expect(milestoneFor(100)?.days).toBe(100);
    expect(milestoneFor(400)?.days).toBe(365);
  });

  test('nextMilestone returns upcoming target', () => {
    expect(nextMilestone(0)?.days).toBe(3);
    expect(nextMilestone(3)?.days).toBe(7);
    expect(nextMilestone(30)?.days).toBe(60);
  });

  test('nextMilestone returns null past top of ladder', () => {
    expect(nextMilestone(365)).toBeNull();
    expect(nextMilestone(500)).toBeNull();
  });

  test('progressToNext is in [0, 1]', () => {
    for (const streak of [0, 1, 5, 7, 15, 50, 100, 400]) {
      const p = progressToNext(streak);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });

  test('progressToNext gives half-ish between milestones', () => {
    // 10 days: between 7 and 14 — closer to midpoint
    const p = progressToNext(10);
    expect(p).toBeGreaterThan(0.3);
    expect(p).toBeLessThan(0.7);
  });
});

describe('celebration persistence', () => {
  // Mock localStorage for Node test env.
  beforeEach(() => {
    const store: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
    });
  });

  test('new user has empty celebrated set', () => {
    expect(getCelebratedSet('user-1').size).toBe(0);
  });

  test('marked milestone persists across reads', () => {
    markMilestoneCelebrated(7, 'user-1');
    expect(getCelebratedSet('user-1').has(7)).toBe(true);
  });

  test('users on the same browser do not cross-contaminate', () => {
    markMilestoneCelebrated(7, 'user-A');
    expect(getCelebratedSet('user-A').has(7)).toBe(true);
    expect(getCelebratedSet('user-B').has(7)).toBe(false);
  });

  test('getUncelebratedMilestone returns current milestone the first time', () => {
    const m = getUncelebratedMilestone(10, 'user-1');
    expect(m?.days).toBe(7);
  });

  test('getUncelebratedMilestone returns null after marking', () => {
    markMilestoneCelebrated(7, 'user-1');
    expect(getUncelebratedMilestone(10, 'user-1')).toBeNull();
  });
});

describe('ladder data quality', () => {
  test('milestones are strictly increasing', () => {
    for (let i = 1; i < STREAK_MILESTONES.length; i++) {
      expect(STREAK_MILESTONES[i].days).toBeGreaterThan(STREAK_MILESTONES[i - 1].days);
    }
  });

  test('every milestone has a label + blurb', () => {
    for (const m of STREAK_MILESTONES) {
      expect(m.label.length).toBeGreaterThan(0);
      expect(m.blurb.length).toBeGreaterThan(10);
    }
  });
});
