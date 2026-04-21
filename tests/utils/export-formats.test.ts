import { describe, test, expect } from 'vitest';
import {
  buildBiomarkersCsv,
  buildDailyMetricsCsv,
  buildProtocolHistoryCsv,
  buildDoctorMarkdown,
} from '@/lib/utils/export-formats';

const SAMPLE = {
  profile: { age: 34, sex: 'male', height_cm: 180, weight_kg: 80, conditions: ['Hypertension'] },
  protocol: {
    diagnostic: {
      longevityScore: 82,
      biologicalAge: 31.2,
      chronologicalAge: 34,
      agingVelocityNumber: 0.9,
    },
  },
  bloodTests: [
    { taken_at: '2025-01-01', biomarkers: [
      { code: 'LDL', value: 110, unit: 'mg/dL' },
      { code: 'HDL', value: 55, unit: 'mg/dL' },
    ]},
    { taken_at: '2025-04-01', biomarkers: [
      { code: 'LDL', value: 95, unit: 'mg/dL' },
      { code: 'HDL', value: 60, unit: 'mg/dL' },
    ]},
  ],
  dailyMetrics: [
    { date: '2025-04-01', sleep_hours: 7.5, resting_hr: 58, mood: 7 },
    { date: '2025-04-02', sleep_hours: 8.1, resting_hr: 55, mood: 8 },
  ],
  protocolHistory: [
    { created_at: '2025-01-15T10:00:00Z', longevity_score: 75, biological_age_decimal: 33.0, aging_pace: 0.95, model_used: 'claude-sonnet-4-5' },
    { created_at: '2025-04-15T10:00:00Z', longevity_score: 82, biological_age_decimal: 31.2, aging_pace: 0.9, model_used: 'claude-sonnet-4-5' },
  ],
};

describe('buildBiomarkersCsv', () => {
  test('produces one row per (test, biomarker) plus header', () => {
    const csv = buildBiomarkersCsv(SAMPLE);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('taken_at,code,value,unit');
    expect(lines.length).toBe(1 + 4); // 2 tests × 2 markers
    expect(lines[1]).toContain('LDL');
    expect(lines[1]).toContain('110');
  });

  test('escapes cells containing commas', () => {
    const csv = buildBiomarkersCsv({
      bloodTests: [{ taken_at: '2025-01-01', biomarkers: [{ code: 'LDL', value: 110, unit: 'mg/dL, fasted' }] }],
    });
    expect(csv).toContain('"mg/dL, fasted"');
  });

  test('handles empty biomarkers', () => {
    expect(buildBiomarkersCsv({})).toBe('taken_at,code,value,unit');
  });
});

describe('buildDailyMetricsCsv', () => {
  test('puts date column first, union of keys as header', () => {
    const csv = buildDailyMetricsCsv(SAMPLE);
    const [header] = csv.split('\n');
    expect(header.startsWith('date,')).toBe(true);
    expect(header).toContain('sleep_hours');
    expect(header).toContain('resting_hr');
  });

  test('preserves row count', () => {
    const csv = buildDailyMetricsCsv(SAMPLE);
    expect(csv.split('\n').length).toBe(3); // header + 2 rows
  });

  test('empty input produces only header', () => {
    expect(buildDailyMetricsCsv({})).toBe('date\n');
  });
});

describe('buildProtocolHistoryCsv', () => {
  test('fixed header + one row per protocol', () => {
    const csv = buildProtocolHistoryCsv(SAMPLE);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('created_at,longevity_score,biological_age,aging_pace,model_used,generation_source');
    expect(lines.length).toBe(1 + 2);
  });
});

describe('buildDoctorMarkdown', () => {
  test('includes profile + protocol + latest panel sections', () => {
    const md = buildDoctorMarkdown(SAMPLE);
    expect(md).toContain('# Longevity Protocol Snapshot');
    expect(md).toContain('## Profile');
    expect(md).toContain('Age: 34');
    expect(md).toContain('BMI:');
    expect(md).toContain('## Latest protocol');
    expect(md).toContain('Longevity score: 82/100');
    expect(md).toContain('## Latest lab panel — 2025-04-01');
    expect(md).toContain('**LDL**: 95 mg/dL');
  });

  test('handles missing sections gracefully', () => {
    const md = buildDoctorMarkdown({});
    expect(md).toContain('# Longevity Protocol Snapshot');
    expect(md).not.toThrow;
  });
});
