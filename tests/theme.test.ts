import { describe, test, expect, beforeEach, vi } from 'vitest';
import { getThemeMode, setThemeMode, resolveTheme, THEME_BOOT_SCRIPT } from '@/lib/theme';

describe('theme module', () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
    });
    vi.stubGlobal('document', {
      documentElement: {
        setAttribute: vi.fn(),
        style: {} as { colorScheme?: string },
      },
    });
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    });
  });

  test('default is system when nothing stored', () => {
    expect(getThemeMode()).toBe('system');
  });

  test('setThemeMode persists explicit choice', () => {
    setThemeMode('light');
    expect(getThemeMode()).toBe('light');
    setThemeMode('dark');
    expect(getThemeMode()).toBe('dark');
  });

  test('setThemeMode("system") removes the stored value', () => {
    setThemeMode('light');
    expect(getThemeMode()).toBe('light');
    setThemeMode('system');
    expect(getThemeMode()).toBe('system');
  });

  test('resolveTheme with explicit light/dark passes through', () => {
    expect(resolveTheme('light')).toBe('light');
    expect(resolveTheme('dark')).toBe('dark');
  });

  test('resolveTheme("system") falls back to dark when matchMedia=false', () => {
    expect(resolveTheme('system')).toBe('dark');
  });

  test('boot script is a single-line IIFE', () => {
    expect(THEME_BOOT_SCRIPT).toMatch(/^\(function\(\)/);
    expect(THEME_BOOT_SCRIPT).toContain('protocol:theme');
    expect(THEME_BOOT_SCRIPT).toContain('data-theme');
    // Should be safe to inline — no template strings or unescaped quotes
    expect(THEME_BOOT_SCRIPT).not.toContain('\n');
  });
});
