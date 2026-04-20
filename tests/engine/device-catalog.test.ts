import { describe, test, expect } from 'vitest';
import { CAPABILITY_TO_COLUMNS, EQUIPMENT_TO_COLUMNS } from '@/lib/engine/device-catalog';

describe('CAPABILITY_TO_COLUMNS', () => {
  test('every capability maps to an array of column names', () => {
    for (const [cap, cols] of Object.entries(CAPABILITY_TO_COLUMNS)) {
      expect(Array.isArray(cols), `capability ${cap} is not an array`).toBe(true);
      for (const c of cols) {
        expect(typeof c).toBe('string');
        expect(c.length).toBeGreaterThan(0);
      }
    }
  });

  test('skin_temp maps to all three deviation columns (single + min + max)', () => {
    expect(CAPABILITY_TO_COLUMNS.skin_temp).toContain('skin_temp_deviation');
    expect(CAPABILITY_TO_COLUMNS.skin_temp).toContain('skin_temp_deviation_min');
    expect(CAPABILITY_TO_COLUMNS.skin_temp).toContain('skin_temp_deviation_max');
  });

  test('stress capability covers all three split columns', () => {
    const cols = CAPABILITY_TO_COLUMNS.stress;
    expect(cols).toContain('stress_level');
    expect(cols).toContain('stress_level_avg');
    expect(cols).toContain('stress_bedtime');
  });
});

describe('EQUIPMENT_TO_COLUMNS', () => {
  test('smart_scale covers the full body-comp suite including body_score', () => {
    const cols = EQUIPMENT_TO_COLUMNS.smart_scale;
    expect(cols).toContain('weight_kg');
    expect(cols).toContain('body_fat_pct');
    expect(cols).toContain('muscle_mass_kg');
    expect(cols).toContain('body_water_pct');
    expect(cols).toContain('bone_mass_kg');
    expect(cols).toContain('bmr_kcal');
    expect(cols).toContain('body_score');
  });

  test('bp_monitor covers morning + evening BP columns', () => {
    const cols = EQUIPMENT_TO_COLUMNS.bp_monitor;
    expect(cols).toContain('bp_systolic_morning');
    expect(cols).toContain('bp_diastolic_morning');
    expect(cols).toContain('bp_systolic_evening');
    expect(cols).toContain('bp_diastolic_evening');
  });

  test('body_thermometer maps to basal + all three skin-temp columns', () => {
    const cols = EQUIPMENT_TO_COLUMNS.body_thermometer;
    expect(cols).toContain('basal_body_temp_c');
    expect(cols).toContain('skin_temp_deviation');
    expect(cols).toContain('skin_temp_deviation_min');
    expect(cols).toContain('skin_temp_deviation_max');
  });
});
