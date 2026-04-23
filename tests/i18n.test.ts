import { describe, test, expect } from 'vitest';
import { lookup, EN, RO } from '@/lib/i18n/dictionaries';

describe('i18n lookup', () => {
  test('returns the locale-specific string when present', () => {
    expect(lookup('en', 'nav.home')).toBe('Home');
    expect(lookup('ro', 'nav.home')).toBe('Acasă');
  });

  test('falls back to English when key is missing in target locale', () => {
    // Add a temporary EN-only key for this test (not present in RO)
    EN.__test_only__ = 'fallback works';
    expect(lookup('ro', '__test_only__')).toBe('fallback works');
    delete EN.__test_only__;
  });

  test('returns the key itself when missing everywhere', () => {
    expect(lookup('en', 'totally.unknown.key')).toBe('totally.unknown.key');
  });

  test('every EN key has a corresponding RO key (no silent gaps in shipped translations)', () => {
    const missingInRo = Object.keys(EN).filter(k => !(k in RO));
    expect(missingInRo, `Missing RO translations for: ${missingInRo.join(', ')}`).toEqual([]);
  });

  test('every RO key has a corresponding EN key (caught typos in keys)', () => {
    const missingInEn = Object.keys(RO).filter(k => !(k in EN));
    expect(missingInEn, `RO has keys missing from EN: ${missingInEn.join(', ')}`).toEqual([]);
  });
});
