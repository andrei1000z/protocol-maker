import { describe, test, expect } from 'vitest';
import { detectPatterns, PATTERN_COUNT, PATTERN_REFERENCE, getPatternRef, slugifyPatternName } from '@/lib/engine/patterns';
import type { BiomarkerValue } from '@/lib/types';

const mk = (code: string, value: number): BiomarkerValue => ({ code, value, unit: 'x' });

describe('detectPatterns', () => {
  test('fires nothing for an empty biomarker list', () => {
    expect(detectPatterns([])).toEqual([]);
  });

  test('Prediabetes triggers on HbA1c 5.8', () => {
    const res = detectPatterns([mk('HBA1C', 5.8), mk('GLUC', 105)]);
    expect(res.find(p => p.name === 'Prediabetes')).toBeTruthy();
  });

  test('Cardiovascular Risk triggers on LDL 150 + TG 200 + low HDL', () => {
    const res = detectPatterns([mk('LDL', 150), mk('TRIG', 200), mk('HDL', 35)]);
    expect(res.find(p => p.name === 'Cardiovascular Risk')).toBeTruthy();
  });

  test('Iron Overload triggers on ferritin > 200', () => {
    const res = detectPatterns([mk('FERRITIN', 500)]);
    expect(res.find(p => p.name === 'Iron Overload')).toBeTruthy();
  });

  test('Anemia Cluster triggers on low HGB + low ferritin + low iron', () => {
    const res = detectPatterns([mk('HGB', 11), mk('FERRITIN', 15), mk('IRON', 40)]);
    expect(res.find(p => p.name === 'Anemia Cluster')).toBeTruthy();
  });

  test('results are sorted by severity (critical → high → moderate → low)', () => {
    const res = detectPatterns([
      mk('HBA1C', 6.0),   // Prediabetes (moderate-high)
      mk('FERRITIN', 500), // Iron Overload (high)
    ]);
    const rank = { critical: 0, high: 1, moderate: 2, low: 3 } as const;
    for (let i = 1; i < res.length; i++) {
      expect(rank[res[i].severity]).toBeGreaterThanOrEqual(rank[res[i - 1].severity]);
    }
  });
});

describe('pattern exclusion layer', () => {
  test('Prediabetes suppresses Metabolic Syndrome when HbA1c is sub-diabetic + HDL ok', () => {
    const res = detectPatterns([
      mk('HBA1C', 6.0),    // prediabetic
      mk('GLUC', 110),     // fasting elevated
      mk('TRIG', 160),     // borderline
      mk('HDL', 50),       // NOT < 40 — so Metabolic can be suppressed
    ]);
    expect(res.find(p => p.name === 'Prediabetes')).toBeTruthy();
    expect(res.find(p => p.name === 'Metabolic Syndrome')).toBeFalsy();
  });

  test('Metabolic Syndrome survives when HbA1c crosses diabetic threshold (≥6.5)', () => {
    const res = detectPatterns([
      mk('HBA1C', 6.8),
      mk('GLUC', 130),
      mk('TRIG', 200),
      mk('HDL', 45),
    ]);
    // HbA1c 6.8 is out of Prediabetes band (5.7-6.4) so Prediabetes won't
    // trigger; Metabolic should fire on its own anyway with 3+ factors.
    expect(res.find(p => p.name === 'Metabolic Syndrome')).toBeTruthy();
  });

  test('Metabolic Syndrome survives when HDL is low (non-glucose cluster factor)', () => {
    const res = detectPatterns([
      mk('HBA1C', 5.9),
      mk('GLUC', 105),
      mk('HDL', 35),       // the override condition
      mk('TRIG', 220),
    ]);
    expect(res.find(p => p.name === 'Prediabetes')).toBeTruthy();
    expect(res.find(p => p.name === 'Metabolic Syndrome')).toBeTruthy();
  });

  test('Anemia suppresses the broader Nutritional Deficiency Cluster', () => {
    const res = detectPatterns([
      mk('HGB', 11),
      mk('FERRITIN', 15),
      mk('IRON', 40),
      mk('VITD', 20),      // would also feed Nutritional Deficiency
    ]);
    expect(res.find(p => p.name === 'Anemia Cluster')).toBeTruthy();
    expect(res.find(p => p.name === 'Nutritional Deficiency Cluster')).toBeFalsy();
  });

  test('Inflammatory Cluster suppresses Oxidative Stress when both would fire', () => {
    const res = detectPatterns([
      mk('HSCRP', 2.5),    // Inflammatory trigger
      mk('HOMOCYS', 14),   // Inflammatory + Oxidative
      mk('VITD', 25),      // Oxidative trigger
      mk('OMEGA3', 4),     // Oxidative trigger
      mk('GGT', 50),       // Oxidative trigger
    ]);
    expect(res.find(p => p.name === 'Inflammatory Cluster')).toBeTruthy();
    expect(res.find(p => p.name === 'Oxidative Stress')).toBeFalsy();
  });
});

describe('medication-driven exclusions', () => {
  test('prednisone suppresses Inflammatory Cluster (steroid-driven neutrophilia, not real inflammation)', () => {
    const biomarkers = [
      mk('HSCRP', 2.5),
      mk('WBC', 9.0),
      mk('HOMOCYS', 14),
    ];
    const withoutMeds = detectPatterns(biomarkers);
    const withSteroid = detectPatterns(biomarkers, ['Prednisone 10mg daily']);
    expect(withoutMeds.find(p => p.name === 'Inflammatory Cluster')).toBeTruthy();
    expect(withSteroid.find(p => p.name === 'Inflammatory Cluster')).toBeFalsy();
  });

  test('metformin + controlled HbA1c (<6.0) suppresses Prediabetes', () => {
    // HbA1c 5.8 + GLUC 105 would normally fire Prediabetes, but on metformin
    // with HbA1c below 6.0 this is "controlled", not "pre".
    const biomarkers = [mk('HBA1C', 5.8), mk('GLUC', 105)];
    const noMeds = detectPatterns(biomarkers);
    const onMetformin = detectPatterns(biomarkers, [{ name: 'Metformin 500mg' }]);
    expect(noMeds.find(p => p.name === 'Prediabetes')).toBeTruthy();
    expect(onMetformin.find(p => p.name === 'Prediabetes')).toBeFalsy();
  });

  test('metformin does NOT suppress Prediabetes when HbA1c is still elevated (≥6.0)', () => {
    const res = detectPatterns([mk('HBA1C', 6.2), mk('GLUC', 115)], ['metformin']);
    expect(res.find(p => p.name === 'Prediabetes')).toBeTruthy();
  });

  test('unrelated medications leave pattern detection untouched', () => {
    const biomarkers = [mk('HSCRP', 2.5), mk('WBC', 9.0)];
    const res = detectPatterns(biomarkers, ['lisinopril', 'vitamin d3 4000 IU']);
    expect(res.find(p => p.name === 'Inflammatory Cluster')).toBeTruthy();
  });

  test('accepts structured {name, dose, frequency} shape used by profiles table', () => {
    const res = detectPatterns(
      [mk('HSCRP', 2.5), mk('WBC', 9.0), mk('HOMOCYS', 14)],
      [{ name: 'Dexamethasone' } as { name: string }],
    );
    expect(res.find(p => p.name === 'Inflammatory Cluster')).toBeFalsy();
  });
});

describe('PATTERN_REFERENCE (SEO/static view)', () => {
  test('count matches the live detector count', () => {
    expect(PATTERN_REFERENCE.length).toBe(PATTERN_COUNT);
  });

  test('every reference has a non-empty slug + recommendations', () => {
    for (const p of PATTERN_REFERENCE) {
      expect(p.slug).toMatch(/^[a-z0-9-]+$/);
      expect(p.slug.length).toBeGreaterThan(1);
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.description.length).toBeGreaterThan(20);
      expect(p.recommendations.length).toBeGreaterThan(0);
    }
  });

  test('slugs are unique across all patterns', () => {
    const seen = new Set<string>();
    for (const p of PATTERN_REFERENCE) {
      expect(seen.has(p.slug), `duplicate slug ${p.slug}`).toBe(false);
      seen.add(p.slug);
    }
  });

  test('getPatternRef finds known patterns by slug', () => {
    expect(getPatternRef('metabolic-syndrome')?.name).toBe('Metabolic Syndrome');
    expect(getPatternRef('prediabetes')?.name).toBe('Prediabetes');
  });

  test('slugifyPatternName is URL-safe', () => {
    expect(slugifyPatternName('Metabolic Syndrome')).toBe('metabolic-syndrome');
    expect(slugifyPatternName('Iron Overload')).toBe('iron-overload');
    expect(slugifyPatternName('Type 2 Diabetes?')).toBe('type-2-diabetes');
    expect(slugifyPatternName('  Leading & trailing  ')).toBe('leading-trailing');
  });
});
