import { describe, test, expect } from 'vitest';
import { buildFallbackProtocol } from '@/lib/engine/fallback-protocol';
import type { UserProfile } from '@/lib/types';

const baseProfile: UserProfile = {
  age: 35, sex: 'male', heightCm: 180, weightKg: 80,
  ethnicity: '', occupation: '', activityLevel: 'moderate',
  sleepHoursAvg: 7.5, sleepQuality: 7, dietType: 'omnivore',
  alcoholDrinksPerWeek: 2, caffeineMgPerDay: 200, smoker: false,
  cardioMinutesPerWeek: 180, strengthSessionsPerWeek: 2,
  conditions: [], medications: [], currentSupplements: [],
  allergies: [], goals: [], timeBudgetMin: 60, monthlyBudgetRon: 200,
  experimentalOpenness: 'otc_only',
  onboardingCompleted: true,
};

describe('buildFallbackProtocol', () => {
  test('returns all required top-level sections', () => {
    const p = buildFallbackProtocol(baseProfile, 33, 70, [], []);
    for (const key of [
      'diagnostic', 'nutrition', 'supplements', 'exercise',
      'sleep', 'tracking', 'doctorDiscussion', 'dailySchedule',
      'bryanComparison', 'universalTips', 'dailyBriefing', 'costBreakdown',
    ]) {
      expect(p[key], `missing ${key}`).toBeDefined();
    }
  });

  test('supplements array is non-empty', () => {
    const p = buildFallbackProtocol(baseProfile, 33, 70, [], []);
    const sups = p.supplements as Array<Record<string, unknown>>;
    expect(Array.isArray(sups)).toBe(true);
    expect(sups.length).toBeGreaterThan(2);
  });

  test('daily schedule has 8+ entries', () => {
    const p = buildFallbackProtocol(baseProfile, 33, 70, [], []);
    const schedule = p.dailySchedule as unknown[];
    expect(schedule.length).toBeGreaterThanOrEqual(8);
  });

  test('warfarin user on a supplement that interacts gets a medication warning', () => {
    // Fallback ships Omega-3 + Magnesium by default; both have entries in
    // interactions.ts for warfarin (bleeding) and levothyroxine (absorption).
    const warfarinUser: UserProfile = {
      ...baseProfile,
      medications: [{ name: 'warfarin', dose: '5mg', frequency: 'daily' }],
    };
    const p = buildFallbackProtocol(warfarinUser, 33, 70, [], []);
    const sups = p.supplements as Array<{ name: string; interactions?: string[] }>;
    const omega = sups.find(s => /omega/i.test(s.name));
    expect(omega, 'Omega-3 should be in fallback stack').toBeTruthy();
    const interactions = omega?.interactions || [];
    // Look for a medication-specific warning (SEVERE/MODERATE/MILD keywords
    // or the drug name itself).
    expect(interactions.some(i => /warfarin/i.test(i))).toBe(true);
  });

  test('cross-supplement spacing note added when Mg + Ca co-stacked', () => {
    const calciumUser: UserProfile = {
      ...baseProfile,
      currentSupplements: ['Calcium citrate 500mg'],
    };
    const p = buildFallbackProtocol(calciumUser, 33, 70, [], []);
    const sups = p.supplements as Array<{ name: string; interactions?: string[] }>;
    const mg = sups.find(s => /magnesium/i.test(s.name));
    expect(mg).toBeTruthy();
    const notes = (mg?.interactions || []).join(' ').toLowerCase();
    // The spacing rule mentions "calcium" somewhere in the hint.
    expect(notes).toMatch(/calcium/);
  });

  test('no-user-supplements profile still produces the default canonical stack', () => {
    const p = buildFallbackProtocol(baseProfile, 33, 70, [], []);
    const sups = p.supplements as Array<{ name: string }>;
    const names = sups.map(s => s.name.toLowerCase());
    expect(names.some(n => /vitamin d|d3/.test(n))).toBe(true);
    expect(names.some(n => /omega/.test(n))).toBe(true);
    expect(names.some(n => /magnesium/.test(n))).toBe(true);
  });
});
