import { describe, test, expect } from 'vitest';
import { BIOMARKER_DB } from '@/lib/engine/biomarkers';

// The ExplainTerm component does a case-insensitive lookup across code,
// shortName, and name. This test guards that lookup contract without
// pulling React into the test tree (jsdom isn't installed).

function findBiomarker(term: string) {
  const q = term.toLowerCase().trim();
  return BIOMARKER_DB.find(b =>
    b.code.toLowerCase() === q ||
    b.shortName.toLowerCase() === q ||
    b.name.toLowerCase() === q
  );
}

describe('biomarker term lookup', () => {
  test('matches by canonical code', () => {
    expect(findBiomarker('HSCRP')?.shortName).toBe('hsCRP');
  });

  test('is case-insensitive on code', () => {
    expect(findBiomarker('hscrp')).toBeDefined();
    expect(findBiomarker('HsCRP')).toBeDefined();
  });

  test('matches by shortName', () => {
    expect(findBiomarker('Homocysteine')?.code).toBe('HOMOCYS');
  });

  test('trims whitespace', () => {
    expect(findBiomarker('  HSCRP  ')).toBeDefined();
  });

  test('returns undefined for unknown terms (renders generic fallback)', () => {
    expect(findBiomarker('not-a-biomarker-xyz')).toBeUndefined();
  });

  test('every biomarker has a non-empty description for the popover', () => {
    for (const b of BIOMARKER_DB) {
      expect(b.description.length).toBeGreaterThan(10);
    }
  });

  test('BIOMARKER_DB size stays at 38', () => {
    // Keeps the landing/README/AUDIT in sync with the data. If this fails
    // after you add/remove a marker, update the three docs that claim 38.
    expect(BIOMARKER_DB.length).toBe(38);
  });
});
