// Meal log — types, Zod shape for AI output, and 7-day aggregations that
// feed back into the protocol-regeneration prompt.
//
// Design choice: photos are NEVER stored. The vision call consumes the
// image, returns structured JSON (title / ingredients / macros / verdict),
// and the image bytes are discarded. Zero storage cost + minimal GDPR
// surface. Users can re-photograph to re-analyze if they want.
//
// The macro numbers are AI estimates, not measurements — don't treat them
// as ground truth. They're useful as a 7-day rolling signal (is the user
// hitting their calorie / protein target?) but a single meal's "320 cal"
// could easily be ±20%. That's acceptable for the protocol feedback loop.

import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Zod shape the AI is expected to return from the vision call. Advisory
// only — we still accept a sparse response and fall back to showing whatever
// made it through. A strict schema would reject the whole analysis on any
// missing field, which is worse than showing a partial card.
// ─────────────────────────────────────────────────────────────────────────────

export const MealAnalysisSchema = z.object({
  title:            z.string().min(1).max(80),
  description:      z.string().max(400).optional().default(''),
  ingredients:      z.array(z.string().max(80)).max(20).default([]),
  // Macro numbers are estimates — AI routinely over- or under-shoots by
  // 10-20%. Clamp to reasonable ranges so a hallucinated "7000 cal salad"
  // doesn't poison the weekly aggregate.
  calories:         z.number().finite().min(0).max(5000).optional().nullable(),
  protein_g:        z.number().finite().min(0).max(300).optional().nullable(),
  carbs_g:          z.number().finite().min(0).max(600).optional().nullable(),
  fat_g:            z.number().finite().min(0).max(300).optional().nullable(),
  fiber_g:          z.number().finite().min(0).max(150).optional().nullable(),
  // Keep the verdict binary-enough to actually be useful. "Excellent choice
  // but consider the sodium" is the kind of AI hedging that makes the signal
  // useless. good | mixed | bad forces a call.
  verdict:          z.enum(['good', 'mixed', 'bad']),
  verdict_reasons:  z.array(z.string().max(200)).max(5).default([]),
});

export type MealAnalysis = z.infer<typeof MealAnalysisSchema>;

/** Extract a JSON object from an AI response that may have surrounding text,
 *  markdown fences, or a "Here is the analysis:" preamble. Mirrors the
 *  permissive parser used in generate-protocol + cron. */
export function parseMealJson(text: string): unknown {
  if (!text) throw new Error('empty AI response');
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try { return JSON.parse(cleaned); } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('no JSON object found in meal analysis');
    return JSON.parse(match[0]);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Persisted-meal shape (matches the DB row). Everything the AI can emit plus
// bookkeeping columns. Used by the /api/meals list endpoint and the dashboard.
// ─────────────────────────────────────────────────────────────────────────────
export interface MealRow {
  id: string;
  user_id: string;
  eaten_at: string;
  source: 'photo' | 'text' | 'photo_with_text';
  user_text: string | null;
  title: string;
  description: string | null;
  ingredients: string[];
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  verdict: 'good' | 'mixed' | 'bad' | null;
  verdict_reasons: string[];
  ai_model: string | null;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 7-day aggregation — used both by the dashboard (show "avg 2400 cal, 160g
// protein" chip) and the master prompt (give the AI a concrete picture of
// what the user is eating).
// ─────────────────────────────────────────────────────────────────────────────
export interface MealAggregate {
  days: number;
  count: number;
  avgCalories: number | null;
  avgProteinG: number | null;
  avgCarbsG: number | null;
  avgFatG: number | null;
  avgFiberG: number | null;
  verdictMix: { good: number; mixed: number; bad: number };
  /** Top 5 most-repeated meal titles (normalized). Useful for the AI to see
   *  "user eats oatmeal 5x/week" without dumping all 30 rows. */
  topMeals: Array<{ title: string; count: number }>;
}

/** Aggregate a window of meal rows. `days` is the window in days — the
 *  caller is responsible for filtering to that window; this function just
 *  computes the math. Returns `null` when the caller passes an empty array
 *  so the UI can render a "no meals logged yet" state cleanly. */
export function aggregateMeals(rows: MealRow[], days: number): MealAggregate | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const sumOrNull = (field: keyof MealRow) => {
    const vals = rows.map(r => r[field]).filter((v): v is number => typeof v === 'number');
    return vals.length === 0 ? null : vals.reduce((a, b) => a + b, 0);
  };
  const sum = {
    cal:  sumOrNull('calories'),
    pro:  sumOrNull('protein_g'),
    car:  sumOrNull('carbs_g'),
    fat:  sumOrNull('fat_g'),
    fib:  sumOrNull('fiber_g'),
  };
  const avg = (total: number | null) => total === null ? null : Math.round((total / days) * 10) / 10;

  // Verdict distribution as a simple count bag — useful signal for the prompt.
  const verdictMix = { good: 0, mixed: 0, bad: 0 };
  for (const r of rows) {
    if (r.verdict && r.verdict in verdictMix) verdictMix[r.verdict]++;
  }

  // Top meals — normalize case + whitespace so "Oatmeal" and "oatmeal "
  // collapse. Not language-aware (treating titles as opaque), which is
  // fine because users generally write in one language.
  const titleCounts = new Map<string, number>();
  for (const r of rows) {
    const key = r.title.trim().toLowerCase();
    if (!key) continue;
    titleCounts.set(key, (titleCounts.get(key) || 0) + 1);
  }
  const topMeals = [...titleCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([title, count]) => ({ title, count }));

  return {
    days,
    count: rows.length,
    avgCalories: avg(sum.cal),
    avgProteinG: avg(sum.pro),
    avgCarbsG: avg(sum.car),
    avgFatG: avg(sum.fat),
    avgFiberG: avg(sum.fib),
    verdictMix,
    topMeals,
  };
}

/** Render a short, prompt-ready summary of the last N days of meals. Fed
 *  into the master prompt as a "RECENT MEALS" section so the AI can tune
 *  nutrition recommendations to what the user actually eats, not what the
 *  onboarding form said they eat. */
export function describeMealsForPrompt(rows: MealRow[], days: number): string | null {
  const agg = aggregateMeals(rows, days);
  if (!agg) return null;
  const lines: string[] = [];
  lines.push(`Meals logged (${days}d): ${agg.count} total.`);
  if (agg.avgCalories !== null) {
    const parts: string[] = [`~${agg.avgCalories.toFixed(0)} kcal/day`];
    if (agg.avgProteinG !== null) parts.push(`${agg.avgProteinG.toFixed(0)}g protein`);
    if (agg.avgCarbsG   !== null) parts.push(`${agg.avgCarbsG.toFixed(0)}g carbs`);
    if (agg.avgFatG     !== null) parts.push(`${agg.avgFatG.toFixed(0)}g fat`);
    if (agg.avgFiberG   !== null) parts.push(`${agg.avgFiberG.toFixed(0)}g fiber`);
    lines.push(`Avg intake: ${parts.join(' · ')}`);
  }
  const { good, mixed, bad } = agg.verdictMix;
  if (good + mixed + bad > 0) {
    lines.push(`Verdict mix: ${good} good, ${mixed} mixed, ${bad} bad.`);
  }
  if (agg.topMeals.length > 0) {
    const repeats = agg.topMeals
      .filter(m => m.count >= 2)
      .slice(0, 3)
      .map(m => `${m.title} (${m.count}×)`);
    if (repeats.length > 0) {
      lines.push(`Repeat meals: ${repeats.join(', ')}.`);
    }
  }
  return lines.join(' ');
}
