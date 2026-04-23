import { describe, test, expect } from 'vitest';
import {
  MealAnalysisSchema,
  parseMealJson,
  aggregateMeals,
  describeMealsForPrompt,
  type MealRow,
} from '@/lib/engine/meals';

// Minimal MealRow factory — sets unused fields to null so tests can focus
// on the ones they exercise without writing 12-field object literals.
const mkMeal = (overrides: Partial<MealRow> = {}): MealRow => ({
  id: 'm-' + Math.random().toString(36).slice(2, 8),
  user_id: 'u-1',
  eaten_at: new Date().toISOString(),
  source: 'text',
  user_text: null,
  title: 'Oatmeal',
  description: null,
  ingredients: [],
  calories: null,
  protein_g: null,
  carbs_g: null,
  fat_g: null,
  fiber_g: null,
  verdict: null,
  verdict_reasons: [],
  ai_model: 'claude-sonnet-4-5',
  created_at: new Date().toISOString(),
  ...overrides,
});

describe('MealAnalysisSchema', () => {
  test('accepts a complete meal analysis', () => {
    const r = MealAnalysisSchema.safeParse({
      title: 'Grilled salmon with quinoa',
      description: 'Pan-seared salmon on quinoa with roasted broccoli',
      ingredients: ['salmon', 'quinoa', 'broccoli', 'olive oil'],
      calories: 520,
      protein_g: 42,
      carbs_g: 38,
      fat_g: 22,
      fiber_g: 8,
      verdict: 'good',
      verdict_reasons: ['High protein', 'Complete amino acid profile'],
    });
    expect(r.success).toBe(true);
  });

  test('rejects missing title', () => {
    const r = MealAnalysisSchema.safeParse({ verdict: 'good' });
    expect(r.success).toBe(false);
  });

  test('rejects out-of-range calories', () => {
    const r = MealAnalysisSchema.safeParse({ title: 'x', verdict: 'good', calories: 99999 });
    expect(r.success).toBe(false);
  });

  test('clamps via max constraint on protein', () => {
    const r = MealAnalysisSchema.safeParse({ title: 'x', verdict: 'good', protein_g: 500 });
    expect(r.success).toBe(false);
  });

  test('fills defaults for optional arrays', () => {
    const r = MealAnalysisSchema.safeParse({ title: 'x', verdict: 'good' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.ingredients).toEqual([]);
      expect(r.data.verdict_reasons).toEqual([]);
    }
  });

  test('rejects unknown verdict value', () => {
    const r = MealAnalysisSchema.safeParse({ title: 'x', verdict: 'excellent' });
    expect(r.success).toBe(false);
  });
});

describe('parseMealJson', () => {
  test('parses clean JSON', () => {
    const obj = parseMealJson('{"title":"Pasta","verdict":"mixed"}');
    expect((obj as { title: string }).title).toBe('Pasta');
  });

  test('strips markdown fences', () => {
    const obj = parseMealJson('```json\n{"title":"Pizza","verdict":"bad"}\n```');
    expect((obj as { title: string }).title).toBe('Pizza');
  });

  test('extracts JSON from preamble', () => {
    const obj = parseMealJson('Here is the analysis:\n\n{"title":"Salad","verdict":"good"}\n\nEnjoy!');
    expect((obj as { title: string }).title).toBe('Salad');
  });

  test('throws on non-JSON response', () => {
    expect(() => parseMealJson('not json at all')).toThrow();
  });

  test('throws on empty', () => {
    expect(() => parseMealJson('')).toThrow();
  });
});

describe('aggregateMeals', () => {
  test('returns null for empty array', () => {
    expect(aggregateMeals([], 7)).toBeNull();
  });

  test('averages macros across the window', () => {
    const agg = aggregateMeals([
      mkMeal({ calories: 700, protein_g: 50, carbs_g: 80, fat_g: 25 }),
      mkMeal({ calories: 500, protein_g: 30, carbs_g: 60, fat_g: 20 }),
      mkMeal({ calories: 400, protein_g: 20, carbs_g: 50, fat_g: 15 }),
    ], 3);
    expect(agg).not.toBeNull();
    // 1600 cal / 3 days = 533.3 → rounded to 1 decimal
    expect(agg!.avgCalories).toBe(533.3);
    expect(agg!.avgProteinG).toBeCloseTo(33.3, 1);
  });

  test('counts verdict mix', () => {
    const agg = aggregateMeals([
      mkMeal({ verdict: 'good' }),
      mkMeal({ verdict: 'good' }),
      mkMeal({ verdict: 'mixed' }),
      mkMeal({ verdict: 'bad' }),
    ], 7);
    expect(agg!.verdictMix).toEqual({ good: 2, mixed: 1, bad: 1 });
  });

  test('returns null averages when no rows have the field', () => {
    const agg = aggregateMeals([
      mkMeal({ calories: null }),
      mkMeal({ calories: null }),
    ], 7);
    expect(agg!.avgCalories).toBeNull();
  });

  test('normalizes repeat-meal detection (case + whitespace)', () => {
    const agg = aggregateMeals([
      mkMeal({ title: 'Oatmeal' }),
      mkMeal({ title: 'oatmeal ' }),
      mkMeal({ title: '  OATMEAL' }),
      mkMeal({ title: 'Salad' }),
    ], 7);
    const oatmeal = agg!.topMeals.find(m => m.title === 'oatmeal');
    expect(oatmeal?.count).toBe(3);
  });

  test('topMeals caps at 5', () => {
    const rows = Array.from({ length: 10 }, (_, i) => mkMeal({ title: `meal-${i}` }));
    const agg = aggregateMeals(rows, 7);
    expect(agg!.topMeals.length).toBeLessThanOrEqual(5);
  });
});

describe('describeMealsForPrompt', () => {
  test('returns null for empty window', () => {
    expect(describeMealsForPrompt([], 7)).toBeNull();
  });

  test('includes total count and avg intake line', () => {
    const out = describeMealsForPrompt([
      mkMeal({ calories: 600, protein_g: 40, carbs_g: 70, fat_g: 20 }),
      mkMeal({ calories: 500, protein_g: 30, carbs_g: 60, fat_g: 18 }),
    ], 7);
    expect(out).toContain('Meals logged (7d): 2');
    expect(out).toContain('kcal/day');
    expect(out).toContain('protein');
  });

  test('surfaces repeat meals only when count >= 2', () => {
    const out = describeMealsForPrompt([
      mkMeal({ title: 'Eggs' }),
      mkMeal({ title: 'Eggs' }),
      mkMeal({ title: 'Pizza' }),
    ], 7);
    // Titles are normalized to lowercase for dedup before rendering.
    expect(out?.toLowerCase()).toContain('eggs');
    expect(out?.toLowerCase()).not.toContain('pizza');
  });

  test('includes verdict mix when present', () => {
    const out = describeMealsForPrompt([
      mkMeal({ verdict: 'good' }),
      mkMeal({ verdict: 'bad' }),
    ], 7);
    expect(out).toContain('Verdict mix');
  });
});
