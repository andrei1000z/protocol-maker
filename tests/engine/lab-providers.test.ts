import { describe, test, expect } from 'vitest';
import { LAB_PROVIDERS, getLabProvider, resolveBiomarkerCode } from '@/lib/engine/lab-providers';

describe('LAB_PROVIDERS', () => {
  test('every provider has id + name + aliases', () => {
    for (const p of LAB_PROVIDERS) {
      expect(p.id).toBeTruthy();
      expect(p.name.length).toBeGreaterThan(2);
      expect(typeof p.aliases).toBe('object');
    }
  });

  test('ids are unique', () => {
    const seen = new Set<string>();
    for (const p of LAB_PROVIDERS) {
      expect(seen.has(p.id)).toBe(false);
      seen.add(p.id);
    }
  });

  test('includes the four major Romanian providers', () => {
    const ids = LAB_PROVIDERS.map(p => p.id);
    expect(ids).toContain('synevo');
    expect(ids).toContain('bioclinica');
    expect(ids).toContain('medlife');
    expect(ids).toContain('regina-maria');
  });
});

describe('getLabProvider', () => {
  test('returns the named provider', () => {
    expect(getLabProvider('synevo').name).toBe('Synevo');
  });

  test('falls back to "other" for unknown id', () => {
    expect(getLabProvider('not-a-lab').id).toBe('other');
  });
});

describe('resolveBiomarkerCode', () => {
  test('Synevo TGP → ALT', () => {
    expect(resolveBiomarkerCode('synevo', 'TGP')).toBe('ALT');
  });

  test('Synevo TGO → AST', () => {
    expect(resolveBiomarkerCode('synevo', 'TGO')).toBe('AST');
  });

  test('case-insensitive', () => {
    expect(resolveBiomarkerCode('synevo', 'glicemie')).toBe('GLUC');
    expect(resolveBiomarkerCode('synevo', 'GLICEMIE')).toBe('GLUC');
    expect(resolveBiomarkerCode('synevo', 'Glicemie')).toBe('GLUC');
  });

  test('substring match handles trailing qualifiers', () => {
    expect(resolveBiomarkerCode('synevo', 'colesterol ldl direct')).toBe('LDL');
  });

  test('different providers can use different aliases', () => {
    expect(resolveBiomarkerCode('bioclinica', 'alat')).toBe('ALT');
    expect(resolveBiomarkerCode('medlife', 'tgp (alt)')).toBe('ALT');
  });

  test('returns null for unknown test name', () => {
    expect(resolveBiomarkerCode('synevo', 'cyclomethanedione')).toBeNull();
  });

  test('"other" provider returns null for everything (AI fallback)', () => {
    expect(resolveBiomarkerCode('other', 'glicemie')).toBeNull();
  });
});
