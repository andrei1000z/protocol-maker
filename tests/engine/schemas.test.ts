import { describe, test, expect } from 'vitest';
import {
  ProtocolJsonSchema,
  inspectProtocolShape,
  OnboardingDataSchema,
} from '@/lib/engine/schemas';

describe('ProtocolJsonSchema', () => {
  test('accepts an empty object (all sections optional)', () => {
    expect(ProtocolJsonSchema.safeParse({}).success).toBe(true);
  });

  test('passes through extra top-level fields without error', () => {
    const res = ProtocolJsonSchema.safeParse({
      diagnostic: { biologicalAge: 32 },
      someNewFieldTheAIInvented: 'whatever',
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect((res.data as Record<string, unknown>).someNewFieldTheAIInvented).toBe('whatever');
    }
  });

  test('accepts a realistic enriched protocol', () => {
    const sample = {
      diagnostic: {
        biologicalAge: 31.2,
        chronologicalAge: 34,
        longevityScore: 82,
        agingVelocity: 'decelerated',
        agingVelocityNumber: 0.9,
        topWins: ['Great sleep quality', 'Exceptional VO2 max'],
        topRisks: ['Elevated ApoB', 'Sub-optimal vitamin D'],
        wearableSignalDays: 28,
        organSystemScores: { cardio: 82, metabolic: 78 },
      },
      nutrition: {
        dailyCalories: 2400,
        macros: { protein: 180, carbs: 220, fat: 80 },
        eatingWindow: '11:00 - 19:00',
      },
      supplements: [
        { name: 'Omega-3 EPA/DHA', dose: '2g', timing: 'with breakfast', priority: 'high' },
        { name: 'Vitamin D3', dose: '4000 IU', timing: 'morning' },
      ],
      biomarkerReadout: [
        { code: 'APOB', name: 'ApoB', value: 95, unit: 'mg/dL', classification: 'risk', gap: 15 },
      ],
    };
    expect(ProtocolJsonSchema.safeParse(sample).success).toBe(true);
  });

  test('rejects a supplement entry missing a name', () => {
    const res = ProtocolJsonSchema.safeParse({
      supplements: [{ dose: '500mg' }],
    });
    expect(res.success).toBe(false);
  });
});

describe('inspectProtocolShape (advisory)', () => {
  test('returns ok:true for a valid protocol', () => {
    expect(inspectProtocolShape({ diagnostic: { biologicalAge: 32 } })).toEqual({ ok: true });
  });

  test('returns ok:false with path + code on drift', () => {
    const r = inspectProtocolShape({ supplements: [{ dose: 'missing name' }] });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.drift.issueCount).toBeGreaterThan(0);
      expect(r.drift.issues[0].path).toMatch(/supplements/);
    }
  });

  test('never throws on totally malformed input', () => {
    expect(() => inspectProtocolShape(null)).not.toThrow();
    expect(() => inspectProtocolShape('garbage')).not.toThrow();
    expect(() => inspectProtocolShape(42)).not.toThrow();
  });
});

describe('OnboardingDataSchema', () => {
  test('accepts typical onboarding blob', () => {
    const r = OnboardingDataSchema.safeParse({
      name: 'Andrei',
      birthDate: '1992-04-01',
      country: 'Romania',
      stressLevel: 6,
      familyHistory: ['Diabetes', 'Heart disease'],
    });
    expect(r.success).toBe(true);
  });

  test('passes through unknown fields', () => {
    const r = OnboardingDataSchema.safeParse({
      customField: 'whatever',
      arbitrary: { nested: 1 },
    });
    expect(r.success).toBe(true);
  });

  test('rejects out-of-range stressLevel', () => {
    const r = OnboardingDataSchema.safeParse({ stressLevel: 99 });
    expect(r.success).toBe(false);
  });
});
