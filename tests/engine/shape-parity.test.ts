import { describe, test, expect } from 'vitest';
import { buildFallbackProtocol } from '@/lib/engine/fallback-protocol';
import { ProtocolJsonSchema, inspectProtocolShape } from '@/lib/engine/schemas';
import type { UserProfile } from '@/lib/types';

// Shape-parity: the deterministic fallback protocol MUST pass the same Zod
// schema the AI output is advisory-checked against. Otherwise the moment
// Claude + Groq both fail, we emit a protocol that our own validator would
// flag as drifted.
//
// Also verifies that the critical sections (nutrition, supplements,
// dailySchedule, exercise, sleep, tracking, doctorDiscussion, dailyBriefing,
// costBreakdown) are present — the fallback's contract to the user is
// "complete protocol", not "skeleton with a 'diagnostic' and nothing else".

const SAMPLE_PROFILE: UserProfile = {
  age: 34,
  sex: 'male',
  heightCm: 180,
  weightKg: 80,
  activityLevel: 'moderate',
  dietType: 'omnivore',
  alcoholDrinksPerWeek: 3,
  caffeineMgPerDay: 200,
  smoker: false,
  cardioMinutesPerWeek: 180,
  strengthSessionsPerWeek: 3,
  sleepHoursAvg: 7.5,
  sleepQuality: 7,
  conditions: [],
  medications: [],
  currentSupplements: [],
  allergies: [],
  goals: ['Longevity / Healthspan'],
  timeBudgetMin: 60,
  monthlyBudgetRon: 300,
  experimentalOpenness: 'otc_only',
} as unknown as UserProfile;

describe('fallback protocol shape parity', () => {
  test('fallback output passes the same Zod schema the AI output is checked against', () => {
    const protocol = buildFallbackProtocol(SAMPLE_PROFILE, 32, 78, [], []);
    const result = ProtocolJsonSchema.safeParse(protocol);
    if (!result.success) {
      // Surface the path + code so a shape drift is debuggable from CI output.
      const issues = result.error.issues.slice(0, 8).map(i => `${i.path.join('.')}:${i.code}`);
      throw new Error(`fallback shape drift: ${issues.join(', ')}`);
    }
    expect(result.success).toBe(true);
  });

  test('fallback has all 9 sections the dashboard + tracking pages render', () => {
    const protocol = buildFallbackProtocol(SAMPLE_PROFILE, 32, 78, [], []);
    const required = [
      'nutrition', 'supplements', 'exercise', 'sleep',
      'tracking', 'doctorDiscussion', 'dailySchedule',
      'dailyBriefing', 'costBreakdown',
    ];
    for (const key of required) {
      const v = (protocol as Record<string, unknown>)[key];
      expect(v, `fallback missing '${key}'`).toBeDefined();
      if (Array.isArray(v)) {
        expect(v.length, `fallback '${key}' is empty array`).toBeGreaterThan(0);
      } else if (typeof v === 'object' && v !== null) {
        expect(Object.keys(v).length, `fallback '${key}' is empty object`).toBeGreaterThan(0);
      }
    }
  });

  test('fallback supplements all have required name field', () => {
    const protocol = buildFallbackProtocol(SAMPLE_PROFILE, 32, 78, [], []);
    const supplements = (protocol as { supplements?: Array<{ name?: string }> }).supplements;
    expect(Array.isArray(supplements)).toBe(true);
    for (const s of supplements || []) {
      expect(typeof s.name).toBe('string');
      expect((s.name || '').length).toBeGreaterThan(0);
    }
  });

  test('inspectProtocolShape returns ok on fallback', () => {
    const protocol = buildFallbackProtocol(SAMPLE_PROFILE, 32, 78, [], []);
    const res = inspectProtocolShape(protocol);
    expect(res.ok).toBe(true);
  });
});
