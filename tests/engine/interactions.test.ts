import { describe, test, expect } from 'vitest';
import { checkInteractions } from '@/lib/engine/interactions';

describe('checkInteractions', () => {
  test('detects Omega-3 × warfarin (severe bleeding risk)', () => {
    const hits = checkInteractions(['Omega-3 fish oil'], [{ name: 'warfarin' }]);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some(h => /bleeding/i.test(h.description))).toBe(true);
  });

  test('detects Iron × levothyroxine absorption conflict', () => {
    const hits = checkInteractions(['Iron bisglycinate'], [{ name: 'levothyroxine' }]);
    expect(hits.some(h => h.severity === 'moderate' || h.severity === 'severe')).toBe(true);
  });

  test('no interaction → empty array', () => {
    const hits = checkInteractions(['Creatine monohydrate'], [{ name: 'ibuprofen' }]);
    expect(hits).toEqual([]);
  });

  test('returned array is sorted severe → mild', () => {
    const hits = checkInteractions(
      ['Omega-3', 'Curcumin with piperine', 'Vitamin E'],
      [{ name: 'warfarin' }],
    );
    const rank = { severe: 0, moderate: 1, mild: 2 } as const;
    for (let i = 1; i < hits.length; i++) {
      expect(rank[hits[i].severity]).toBeGreaterThanOrEqual(rank[hits[i - 1].severity]);
    }
  });

  test('case-insensitive matching on both supplement + drug', () => {
    const hits = checkInteractions(['OMEGA-3 EPA/DHA'], [{ name: 'WARFARIN' }]);
    expect(hits.length).toBeGreaterThan(0);
  });
});
