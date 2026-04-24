import { describe, test, expect } from 'vitest';
import {
  describeFeedbackForPrompt,
  type SupplementFeedbackRow,
} from '@/lib/engine/supplement-feedback';

function mkRow(overrides: Partial<SupplementFeedbackRow> = {}): SupplementFeedbackRow {
  return {
    id: 'fb-' + Math.random().toString(36).slice(2, 8),
    user_id: 'u-1',
    supplement_name: 'Magnesium Glycinate',
    categories: ['digestive'],
    notes: null,
    reported_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('describeFeedbackForPrompt', () => {
  test('returns null for empty or missing input', () => {
    expect(describeFeedbackForPrompt(null)).toBeNull();
    expect(describeFeedbackForPrompt(undefined)).toBeNull();
    expect(describeFeedbackForPrompt([])).toBeNull();
  });

  test('renders a single reported reaction', () => {
    const out = describeFeedbackForPrompt([
      mkRow({ supplement_name: 'Creatine', categories: ['digestive'], notes: 'bloating 2h after' }),
    ]);
    expect(out).toContain('Creatine');
    expect(out).toContain('digestive');
    expect(out).toContain('bloating');
  });

  test('merges duplicate supplement reports into one entry', () => {
    const rows = [
      mkRow({ supplement_name: 'Magnesium Glycinate', categories: ['digestive'] }),
      mkRow({ supplement_name: 'Magnesium Glycinate', categories: ['sleep'] }),
    ];
    const out = describeFeedbackForPrompt(rows)!;
    // One bullet for the supplement, not two
    const bulletMatches = out.match(/^·/gm) || [];
    expect(bulletMatches.length).toBe(1);
    expect(out).toContain('digestive');
    expect(out).toContain('sleep');
  });

  test('trims extremely long notes to keep the prompt compact', () => {
    const longNote = 'x'.repeat(500);
    const out = describeFeedbackForPrompt([
      mkRow({ supplement_name: 'Caffeine', notes: longNote }),
    ])!;
    // 180-char cap from the implementation
    const noteLine = out.split('\n').find(l => l.includes('Caffeine'))!;
    expect(noteLine).toMatch(/Notes: "x{1,180}"/);
  });

  test('includes the closing guidance paragraph so the AI knows what to do', () => {
    const out = describeFeedbackForPrompt([
      mkRow({ supplement_name: 'X', categories: ['energy'] }),
    ])!;
    expect(out.toLowerCase()).toContain('avoid');
  });

  test('ignores unknown category keys (falls back to raw)', () => {
    const out = describeFeedbackForPrompt([
      mkRow({ supplement_name: 'Novel', categories: ['custom_cat' as unknown as string] }),
    ])!;
    // Doesn't crash, and renders the raw key since we fell through the label map
    expect(out).toContain('custom_cat');
  });
});
