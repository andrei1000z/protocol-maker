// Meal log — types, Zod shape for AI output, and 7-day aggregations that
// feed back into the protocol-regeneration prompt.
//
// Design choice: photos are NEVER stored. The vision call consumes the
// image, returns structured JSON (title / ingredients / macros / verdict
// plus extended nutrition), and the image bytes are discarded. Zero storage
// cost + minimal GDPR surface. Users can re-photograph to re-analyze if they
// want.
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

// Micronutrient bag — flexible so we can add new ones without changing the
// DB schema (persisted as JSONB under `nutrition_detail.micros`).
export const MealMicrosSchema = z.object({
  vitamin_c_mg: z.number().finite().min(0).max(3000).nullable().optional(),
  vitamin_d_iu: z.number().finite().min(0).max(10000).nullable().optional(),
  iron_mg:      z.number().finite().min(0).max(100).nullable().optional(),
  magnesium_mg: z.number().finite().min(0).max(2000).nullable().optional(),
  calcium_mg:   z.number().finite().min(0).max(5000).nullable().optional(),
  zinc_mg:      z.number().finite().min(0).max(100).nullable().optional(),
  potassium_mg: z.number().finite().min(0).max(10000).nullable().optional(),
}).partial();

export type MealMicros = z.infer<typeof MealMicrosSchema>;

// Quality flag vocabulary the AI is told to pick from. Controlled set beats
// free-form text: downstream UI colors the chip, aggregations count flags
// across the week, and filtering by flag becomes trivial.
export const QUALITY_FLAGS = [
  // Positive
  'whole_food', 'high_protein', 'high_fiber', 'high_omega3', 'high_polyphenols',
  'leafy_greens', 'fermented', 'nutrient_dense', 'anti_inflammatory',
  // Watch
  'high_added_sugar', 'high_sodium', 'high_saturated_fat', 'low_protein',
  'high_processed_carbs', 'fried', 'alcohol',
  // Negative
  'ultra_processed', 'low_nutrient_density', 'high_refined_sugar', 'trans_fat_risk',
] as const;

export const MealAnalysisSchema = z.object({
  title:            z.string().min(1).max(80),
  description:      z.string().max(400).optional().default(''),
  ingredients:      z.array(z.string().max(80)).max(20).default([]),

  // Core macros — these stay as top-level DB columns so the 7-day aggregate
  // query stays a simple sum() instead of jsonb_path_query.
  calories:         z.number().finite().min(0).max(5000).nullable().optional(),
  protein_g:        z.number().finite().min(0).max(300).nullable().optional(),
  carbs_g:          z.number().finite().min(0).max(600).nullable().optional(),
  fat_g:            z.number().finite().min(0).max(300).nullable().optional(),
  fiber_g:          z.number().finite().min(0).max(150).nullable().optional(),

  // Extended macros — all stored in `nutrition_detail` JSONB.
  sugar_g:          z.number().finite().min(0).max(500).nullable().optional(),
  added_sugar_g:    z.number().finite().min(0).max(500).nullable().optional(),
  saturated_fat_g:  z.number().finite().min(0).max(200).nullable().optional(),
  unsaturated_fat_g: z.number().finite().min(0).max(200).nullable().optional(),
  trans_fat_g:      z.number().finite().min(0).max(50).nullable().optional(),
  sodium_mg:        z.number().finite().min(0).max(20000).nullable().optional(),
  cholesterol_mg:   z.number().finite().min(0).max(3000).nullable().optional(),
  omega_3_g:        z.number().finite().min(0).max(50).nullable().optional(),
  caffeine_mg:      z.number().finite().min(0).max(2000).nullable().optional(),
  alcohol_g:        z.number().finite().min(0).max(300).nullable().optional(),

  // Micronutrients bag.
  micros:           MealMicrosSchema.optional().default({}),

  // Quality / classification signals. NOVA is the food-processing
  // classification (1 = unprocessed whole food, 4 = ultra-processed). GI
  // is the glycemic-index estimate (0-120 because sometimes you get e.g.
  // white bread 95-105).
  processing_nova:  z.number().int().min(1).max(4).nullable().optional(),
  glycemic_index:   z.number().int().min(0).max(120).nullable().optional(),
  // Longevity impact: compressed composite score from the AI. -5 (very
  // harmful if repeated) to +5 (optimal). Used for daily-sum sparklines
  // and heatmap colors in the UI.
  longevity_impact_score: z.number().int().min(-5).max(5).nullable().optional(),

  // Controlled vocabulary of food-quality flags. Accept anything the AI
  // emits (not restricted to the enum) so we don't blow up on a new value,
  // but the UI only renders with a known style for recognized flags.
  quality_flags:    z.array(z.string().max(40)).max(12).default([]),

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
export interface NutritionDetail {
  sugar_g?: number | null;
  added_sugar_g?: number | null;
  saturated_fat_g?: number | null;
  unsaturated_fat_g?: number | null;
  trans_fat_g?: number | null;
  sodium_mg?: number | null;
  cholesterol_mg?: number | null;
  omega_3_g?: number | null;
  caffeine_mg?: number | null;
  alcohol_g?: number | null;
  micros?: MealMicros;
  processing_nova?: number | null;
  glycemic_index?: number | null;
  quality_flags?: string[];
}

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
  longevity_impact_score: number | null;
  nutrition_detail: NutritionDetail | null;
  ai_model: string | null;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Daily targets — used by the "Today's intake" panel. These are broad-strokes
// defaults, not per-user calibrated values. When we eventually wire meals
// into the profile (TDEE from bodyweight + activity), these numbers should
// move into `lib/engine/nutrition-targets.ts` keyed off profile. For now they
// are global constants so the dashboard can render before onboarding is done.
// ─────────────────────────────────────────────────────────────────────────────
export interface DailyTargets {
  calories: number;          // kcal
  protein_g: number;         // g (≈ 1.6 g/kg bodyweight; 100g is a reasonable default)
  fiber_g: number;           // g (WHO recommendation >25g/day, longevity cohort data supports 30g+)
  sodium_mg_max: number;     // mg (<2300 is WHO ceiling, <1500 is ideal for BP)
  added_sugar_g_max: number; // g (AHA <36g men / <25g women; pick 36 as ceiling)
  saturated_fat_g_max: number; // g (<10% of kcal; at 2000 kcal that's ~22g)
}

export const DEFAULT_DAILY_TARGETS: DailyTargets = {
  calories: 2200,
  protein_g: 130,
  fiber_g: 30,
  sodium_mg_max: 2300,
  added_sugar_g_max: 36,
  saturated_fat_g_max: 22,
};

export interface TodayTotals {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  added_sugar_g: number;
  sodium_mg: number;
  saturated_fat_g: number;
  omega_3_g: number;
  caffeine_mg: number;
  alcohol_g: number;
  longevity_impact_sum: number;
  count: number;
}

/** Cumulative totals across a set of meals (intended to be today's rows).
 *  Null values are treated as 0 — callers are expected to know which macros
 *  were not present in the underlying meals if they need that distinction. */
export function sumTodayTotals(rows: MealRow[]): TodayTotals {
  const empty: TodayTotals = {
    calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0,
    sugar_g: 0, added_sugar_g: 0, sodium_mg: 0, saturated_fat_g: 0,
    omega_3_g: 0, caffeine_mg: 0, alcohol_g: 0,
    longevity_impact_sum: 0, count: 0,
  };
  for (const r of rows) {
    empty.calories       += r.calories      || 0;
    empty.protein_g      += r.protein_g     || 0;
    empty.carbs_g        += r.carbs_g       || 0;
    empty.fat_g          += r.fat_g         || 0;
    empty.fiber_g        += r.fiber_g       || 0;
    const d = r.nutrition_detail ?? {};
    empty.sugar_g         += d.sugar_g         || 0;
    empty.added_sugar_g   += d.added_sugar_g   || 0;
    empty.sodium_mg       += d.sodium_mg       || 0;
    empty.saturated_fat_g += d.saturated_fat_g || 0;
    empty.omega_3_g       += d.omega_3_g       || 0;
    empty.caffeine_mg     += d.caffeine_mg     || 0;
    empty.alcohol_g       += d.alcohol_g       || 0;
    empty.longevity_impact_sum += r.longevity_impact_score || 0;
    empty.count++;
  }
  // Round to avoid 0.30000000000000004 floats in the UI.
  for (const k of Object.keys(empty) as Array<keyof TodayTotals>) {
    if (k === 'count') continue;
    empty[k] = Math.round((empty[k] as number) * 10) / 10;
  }
  return empty;
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
  avgAddedSugarG: number | null;
  avgSodiumMg: number | null;
  avgSatFatG: number | null;
  avgLongevityImpact: number | null;
  ultraProcessedDays: number;    // count of meals with processing_nova === 4
  verdictMix: { good: number; mixed: number; bad: number };
  /** Top 5 most-repeated meal titles (normalized). Useful for the AI to see
   *  "user eats oatmeal 5x/week" without dumping all 30 rows. */
  topMeals: Array<{ title: string; count: number }>;
  /** Most common quality flags across the window. Capped at 6 so the prompt
   *  stays compact. */
  topFlags: Array<{ flag: string; count: number }>;
}

/** Aggregate a window of meal rows. `days` is the window in days — the
 *  caller is responsible for filtering to that window; this function just
 *  computes the math. Returns `null` when the caller passes an empty array
 *  so the UI can render a "no meals logged yet" state cleanly. */
export function aggregateMeals(rows: MealRow[], days: number): MealAggregate | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const sumOrNull = (extractor: (r: MealRow) => number | null | undefined) => {
    const vals = rows.map(extractor).filter((v): v is number => typeof v === 'number');
    return vals.length === 0 ? null : vals.reduce((a, b) => a + b, 0);
  };

  const avg = (total: number | null) => total === null ? null : Math.round((total / days) * 10) / 10;
  const avgPerMeal = (total: number | null) => {
    if (total === null) return null;
    return Math.round((total / rows.length) * 10) / 10;
  };

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

  const flagCounts = new Map<string, number>();
  for (const r of rows) {
    for (const f of r.nutrition_detail?.quality_flags ?? []) {
      flagCounts.set(f, (flagCounts.get(f) || 0) + 1);
    }
  }
  const topFlags = [...flagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([flag, count]) => ({ flag, count }));

  const ultraProcessedDays = rows.filter(r => r.nutrition_detail?.processing_nova === 4).length;

  return {
    days,
    count: rows.length,
    avgCalories:  avg(sumOrNull(r => r.calories)),
    avgProteinG:  avg(sumOrNull(r => r.protein_g)),
    avgCarbsG:    avg(sumOrNull(r => r.carbs_g)),
    avgFatG:      avg(sumOrNull(r => r.fat_g)),
    avgFiberG:    avg(sumOrNull(r => r.fiber_g)),
    avgAddedSugarG: avg(sumOrNull(r => r.nutrition_detail?.added_sugar_g ?? null)),
    avgSodiumMg:    avg(sumOrNull(r => r.nutrition_detail?.sodium_mg ?? null)),
    avgSatFatG:     avg(sumOrNull(r => r.nutrition_detail?.saturated_fat_g ?? null)),
    avgLongevityImpact: avgPerMeal(sumOrNull(r => r.longevity_impact_score)),
    ultraProcessedDays,
    verdictMix,
    topMeals,
    topFlags,
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
  const watchParts: string[] = [];
  if (agg.avgSodiumMg    !== null && agg.avgSodiumMg    > 2300) watchParts.push(`sodium ${agg.avgSodiumMg.toFixed(0)}mg/day (>2300 ceiling)`);
  if (agg.avgAddedSugarG !== null && agg.avgAddedSugarG > 36)   watchParts.push(`added sugar ${agg.avgAddedSugarG.toFixed(0)}g/day (>36 ceiling)`);
  if (agg.avgSatFatG     !== null && agg.avgSatFatG     > 22)   watchParts.push(`sat fat ${agg.avgSatFatG.toFixed(0)}g/day (>22 ceiling)`);
  if (agg.ultraProcessedDays > 0) watchParts.push(`${agg.ultraProcessedDays} ultra-processed meals`);
  if (watchParts.length) lines.push(`Watch: ${watchParts.join(', ')}.`);

  if (agg.avgLongevityImpact !== null) {
    const emoji = agg.avgLongevityImpact > 1 ? 'net positive' : agg.avgLongevityImpact < -1 ? 'net negative' : 'neutral';
    lines.push(`Avg longevity-impact per meal: ${agg.avgLongevityImpact.toFixed(1)} (${emoji}).`);
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
  if (agg.topFlags.length > 0) {
    const flags = agg.topFlags.slice(0, 5).map(f => `${f.flag}×${f.count}`).join(', ');
    lines.push(`Quality flags: ${flags}.`);
  }
  return lines.join(' ');
}
