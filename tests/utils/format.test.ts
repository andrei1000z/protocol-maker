import { describe, test, expect } from 'vitest';
import {
  formatDate, formatDateShort, formatNumber,
  formatCurrency, formatPercent, getDaysAgo, getToday,
} from '@/lib/utils/format';

describe('formatDate', () => {
  test('renders a recognizable date string from an ISO input', () => {
    const out = formatDate('2026-04-20');
    // ro-RO locale varies ("20 apr. 2026" / "20.04.2026"), but it must
    // include both the year and the day number.
    expect(out).toMatch(/2026/);
    expect(out).toMatch(/20/);
  });

  test('accepts Date objects directly', () => {
    const out = formatDate(new Date('2026-04-20'));
    expect(out).toMatch(/2026/);
  });
});

describe('formatDateShort', () => {
  test('omits the year for a compact chart label', () => {
    const out = formatDateShort('2026-04-20');
    expect(out).not.toMatch(/2026/);
    expect(out).toMatch(/20/);
  });
});

describe('formatNumber', () => {
  test('default 0 decimals for integers', () => {
    expect(formatNumber(1234)).toMatch(/1/);
    expect(formatNumber(1234)).toMatch(/234|\.234/);  // any RO grouping
  });

  test('honors explicit decimal count', () => {
    const out = formatNumber(7.456, 2);
    expect(out).toMatch(/7[.,]46/);  // locale-dependent separator
  });
});

describe('formatCurrency', () => {
  test('defaults to RON suffix', () => {
    expect(formatCurrency(200)).toMatch(/RON/);
  });

  test('accepts a custom currency code', () => {
    expect(formatCurrency(100, 'EUR')).toMatch(/EUR/);
  });
});

describe('formatPercent', () => {
  test('returns 0 when total is 0 (avoid divide-by-zero)', () => {
    expect(formatPercent(5, 0)).toBe(0);
  });

  test('computes rounded %', () => {
    expect(formatPercent(1, 4)).toBe(25);
    expect(formatPercent(3, 10)).toBe(30);
  });
});

describe('getDaysAgo', () => {
  test('returns the expected count of ISO date strings', () => {
    const arr = getDaysAgo(7);
    expect(arr.length).toBe(7);
    for (const d of arr) expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('is chronological (oldest first)', () => {
    const arr = getDaysAgo(5);
    for (let i = 1; i < arr.length; i++) {
      expect(arr[i] >= arr[i - 1]).toBe(true);
    }
  });
});

describe('getToday', () => {
  test('matches YYYY-MM-DD', () => {
    expect(getToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('is within 1 day of now (sanity)', () => {
    const t = getToday();
    const parsed = new Date(t + 'T00:00:00Z').getTime();
    const now = Date.now();
    expect(Math.abs(parsed - now)).toBeLessThan(2 * 86400 * 1000);
  });
});
