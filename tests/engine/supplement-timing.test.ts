import { describe, test, expect } from 'vitest';
import {
  classifySupplementTiming,
  bucketSupplements,
  currentSupplementBucket,
} from '@/lib/engine/supplement-timing';

describe('classifySupplementTiming', () => {
  test('keyword-driven classification', () => {
    expect(classifySupplementTiming('morning with breakfast')).toBe('morning');
    expect(classifySupplementTiming('before bed')).toBe('bedtime');
    expect(classifySupplementTiming('with dinner')).toBe('evening');
    expect(classifySupplementTiming('at lunch')).toBe('midday');
    expect(classifySupplementTiming('pre-workout')).toBe('midday');
  });

  test('explicit hour wins over keyword', () => {
    // "at 07:00" should be morning even if "evening" appeared somewhere weird
    expect(classifySupplementTiming('at 07:00')).toBe('morning');
    expect(classifySupplementTiming('around 22:00')).toBe('bedtime');
    expect(classifySupplementTiming('13:30 with lunch')).toBe('midday');
  });

  test('am/pm notation', () => {
    expect(classifySupplementTiming('7am')).toBe('morning');
    expect(classifySupplementTiming('10pm before bed')).toBe('bedtime');
  });

  test('missing or empty timing → anytime', () => {
    expect(classifySupplementTiming('')).toBe('anytime');
    expect(classifySupplementTiming(undefined)).toBe('anytime');
    expect(classifySupplementTiming(null)).toBe('anytime');
  });

  test('unknown timing falls back to anytime', () => {
    expect(classifySupplementTiming('whenever you remember')).toBe('anytime');
  });
});

describe('bucketSupplements', () => {
  test('returns empty buckets for null input', () => {
    const b = bucketSupplements(null);
    expect(b.morning).toEqual([]);
    expect(b.bedtime).toEqual([]);
    expect(b.anytime).toEqual([]);
  });

  test('groups mixed timings into correct buckets', () => {
    const b = bucketSupplements([
      { name: 'Vitamin D', timing: 'morning' },
      { name: 'Magnesium', timing: 'before bed' },
      { name: 'Omega-3', timing: 'with dinner' },
      { name: 'Creatine', timing: 'pre-workout' },
      { name: 'NAC', timing: '' },
    ]);
    expect(b.morning.map(s => s.name)).toContain('Vitamin D');
    expect(b.bedtime.map(s => s.name)).toContain('Magnesium');
    expect(b.evening.map(s => s.name)).toContain('Omega-3');
    expect(b.midday.map(s => s.name)).toContain('Creatine');
    expect(b.anytime.map(s => s.name)).toContain('NAC');
  });

  test('preserves input order within bucket', () => {
    const b = bucketSupplements([
      { name: 'A', timing: 'morning' },
      { name: 'B', timing: 'morning' },
      { name: 'C', timing: 'morning' },
    ]);
    expect(b.morning.map(s => s.name)).toEqual(['A', 'B', 'C']);
  });

  test('each entry carries its bucket field', () => {
    const b = bucketSupplements([{ name: 'VitD', timing: 'morning' }]);
    expect(b.morning[0].bucket).toBe('morning');
  });
});

describe('currentSupplementBucket', () => {
  test('maps hour of day to correct bucket', () => {
    expect(currentSupplementBucket(7)).toBe('morning');
    expect(currentSupplementBucket(12)).toBe('midday');
    expect(currentSupplementBucket(18)).toBe('evening');
    expect(currentSupplementBucket(23)).toBe('bedtime');
    expect(currentSupplementBucket(2)).toBe('bedtime');
  });
});
