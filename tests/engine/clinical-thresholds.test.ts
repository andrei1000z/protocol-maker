import { describe, test, expect } from 'vitest';
import { CLINICAL_THRESHOLDS, thresholdValue } from '@/lib/engine/clinical-thresholds';

// These values are embedded across pattern detection + classifier logic.
// A change here is intentional — but the test is here to catch accidental
// edits and to pin historical values against the published guidelines.

describe('clinical thresholds registry', () => {
  test('every entry has value + unit + source + version', () => {
    for (const [key, t] of Object.entries(CLINICAL_THRESHOLDS)) {
      expect(typeof t.value, `${key}.value`).toBe('number');
      expect(Number.isFinite(t.value), `${key}.value finite`).toBe(true);
      expect(typeof t.unit, `${key}.unit`).toBe('string');
      expect(t.unit.length, `${key}.unit non-empty`).toBeGreaterThan(0);
      expect(typeof t.source, `${key}.source`).toBe('string');
      expect(t.source.length, `${key}.source non-empty`).toBeGreaterThan(0);
      expect(typeof t.version, `${key}.version`).toBe('number');
      expect(t.version, `${key}.version >= 1`).toBeGreaterThanOrEqual(1);
    }
  });

  test('thresholdValue returns the numeric value for a key', () => {
    expect(thresholdValue('HBA1C_PREDIABETES_LOW')).toBe(5.7);
    expect(thresholdValue('HBA1C_DIABETES')).toBe(6.5);
    expect(thresholdValue('LDL_CARDIO_RISK')).toBe(130);
    expect(thresholdValue('HSCRP_ELEVATED')).toBe(1.0);
  });

  test('diabetes band is strictly ordered (prediabetes low < high < diabetes)', () => {
    const lo = thresholdValue('HBA1C_PREDIABETES_LOW');
    const hi = thresholdValue('HBA1C_PREDIABETES_HIGH');
    const dm = thresholdValue('HBA1C_DIABETES');
    expect(lo).toBeLessThan(hi);
    expect(hi).toBeLessThan(dm);
  });

  test('ferritin thresholds form low < high < overload', () => {
    expect(thresholdValue('FERRITIN_LOW')).toBeLessThan(thresholdValue('FERRITIN_HIGH'));
    expect(thresholdValue('FERRITIN_HIGH')).toBeLessThanOrEqual(thresholdValue('FERRITIN_IRON_OVERLOAD'));
  });

  test('creatinine elevation escalates (high < severe)', () => {
    expect(thresholdValue('CREAT_HIGH')).toBeLessThan(thresholdValue('CREAT_SEVERE'));
  });

  test('glucose prediabetes floor < diabetes floor', () => {
    expect(thresholdValue('GLUC_PREDIABETES_LOW')).toBeLessThan(thresholdValue('GLUC_DIABETES'));
  });
});
