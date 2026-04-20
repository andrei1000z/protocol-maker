// Smoke tests — cheap assertions that catch accidental regressions in the
// overall wiring. If any of these fail, something structural broke (a file
// was renamed / deleted / export was removed).

import { describe, test, expect } from 'vitest';
import { BIOMARKER_DB } from '@/lib/engine/biomarkers';
import { PATTERN_REFERENCE } from '@/lib/engine/patterns';
import { DAILY_HABITS } from '@/lib/engine/daily-habits';
import { SITE_URL } from '@/lib/config';

describe('smoke', () => {
  test('BIOMARKER_DB loads', () => {
    expect(BIOMARKER_DB.length).toBeGreaterThan(0);
  });

  test('PATTERN_REFERENCE loads', () => {
    expect(PATTERN_REFERENCE.length).toBeGreaterThan(0);
  });

  test('DAILY_HABITS loads', () => {
    expect(Array.isArray(DAILY_HABITS)).toBe(true);
    expect(DAILY_HABITS.length).toBeGreaterThan(0);
  });

  test('SITE_URL is an absolute URL', () => {
    expect(SITE_URL).toMatch(/^https?:\/\//);
  });

  test('no hardcoded protocol-tawny in SITE_URL when a custom one is set', () => {
    // Idempotent: if NEXT_PUBLIC_SITE_URL is set, the config must respect it.
    const override = process.env.NEXT_PUBLIC_SITE_URL;
    if (override) expect(SITE_URL).toBe(override);
  });
});
