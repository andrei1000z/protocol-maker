import { describe, test, expect } from 'vitest';
import { ACHIEVEMENTS, checkAchievements, getNextAchievement, type UserStats } from '@/lib/engine/achievements';

const baseStats = (): UserStats => ({
  totalDaysTracked: 0,
  currentStreak: 0,
  longestStreak: 0,
  perfectDays: 0,
  bloodTestsUploaded: 0,
  protocolsGenerated: 0,
  supplementStreak: 0,
  weeklyCompliance: 0,
  monthlyAvgCompliance: 0,
});

describe('ACHIEVEMENTS catalog', () => {
  test('every achievement has unique id', () => {
    const seen = new Set<string>();
    for (const a of ACHIEVEMENTS) {
      expect(seen.has(a.id), `duplicate ${a.id}`).toBe(false);
      seen.add(a.id);
    }
  });

  test('every achievement has all required fields', () => {
    for (const a of ACHIEVEMENTS) {
      expect(a.name.length).toBeGreaterThan(2);
      expect(a.description.length).toBeGreaterThan(5);
      expect(a.icon.length).toBeGreaterThanOrEqual(1);
      expect(['bronze', 'silver', 'gold', 'legendary']).toContain(a.tier);
      expect(typeof a.check).toBe('function');
    }
  });
});

describe('checkAchievements', () => {
  test('empty stats unlocks nothing', () => {
    expect(checkAchievements(baseStats())).toEqual([]);
  });

  test('streak ladder unlocks in order', () => {
    const earned3  = checkAchievements({ ...baseStats(), currentStreak: 3 }).map(a => a.id);
    const earned7  = checkAchievements({ ...baseStats(), currentStreak: 7 }).map(a => a.id);
    const earned30 = checkAchievements({ ...baseStats(), currentStreak: 30 }).map(a => a.id);
    expect(earned3).toContain('streak_3');
    expect(earned3).not.toContain('streak_7');
    expect(earned7).toContain('streak_7');
    expect(earned30).toContain('streak_30');
  });

  test('new meal achievements respect counts', () => {
    expect(checkAchievements({ ...baseStats(), mealsLogged: 1 }).map(a => a.id)).toContain('first_meal');
    expect(checkAchievements({ ...baseStats(), mealsLoggedDays: 7 }).map(a => a.id)).toContain('meal_week');
    expect(checkAchievements({ ...baseStats(), mealsLoggedDays: 30 }).map(a => a.id)).toContain('meal_month');
  });

  test('workout achievements unlock at thresholds', () => {
    expect(checkAchievements({ ...baseStats(), workoutsLogged: 1 }).map(a => a.id)).toContain('first_workout');
    expect(checkAchievements({ ...baseStats(), workoutsLogged: 10 }).map(a => a.id)).toContain('workout_10');
  });

  test('outcome badges fire only when boolean is true', () => {
    expect(checkAchievements({ ...baseStats(), biologicalAgeImproved: false }).map(a => a.id)).not.toContain('bio_age_drop');
    expect(checkAchievements({ ...baseStats(), biologicalAgeImproved: true }).map(a => a.id)).toContain('bio_age_drop');
  });

  test('tenure milestones gate by daysSinceSignup', () => {
    expect(checkAchievements({ ...baseStats(), daysSinceSignup: 30 }).map(a => a.id)).toContain('thirty_days');
    expect(checkAchievements({ ...baseStats(), daysSinceSignup: 365 }).map(a => a.id)).toContain('one_year');
  });
});

describe('getNextAchievement', () => {
  test('returns the first unearned in order', () => {
    const next = getNextAchievement(baseStats());
    expect(next?.id).toBe('streak_3');
  });

  test('skips already-earned achievements', () => {
    const next = getNextAchievement({ ...baseStats(), currentStreak: 5 });
    // streak_3 earned → next should be the next item that isn't satisfied
    expect(next?.id).not.toBe('streak_3');
  });
});
