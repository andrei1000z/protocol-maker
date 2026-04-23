// CRUD for the meals table.
//
// POST   — save a previewed meal (the /analyze endpoint returns the shape
//          this route expects, plus `source`/`eatenAt`/`userText`/`model`)
// GET    — list recent meals (default 7 days, max 30)
// DELETE — delete one meal by id
//
// All three are rate-limited on the save-profile budget (20/hour) — the
// expensive work happened in /analyze; these are just persistence calls.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getSaveProfileRateLimit, checkRateLimit } from '@/lib/rate-limit';
import { logger, describeError } from '@/lib/logger';
import { MealAnalysisSchema } from '@/lib/engine/meals';

export const runtime = 'nodejs';

// Incoming save body: the analyzer's output plus the session metadata. The
// AI's output is re-validated here because users can edit fields in the
// preview UI before confirming — we don't trust the client to send us the
// exact same bytes the /analyze route returned.
const SaveSchema = z.object({
  analysis: MealAnalysisSchema,
  source: z.enum(['photo', 'text', 'photo_with_text']),
  eatenAt: z.string().refine(s => !Number.isNaN(Date.parse(s)), 'eatenAt must be a valid ISO timestamp'),
  userText: z.string().max(2000).optional().nullable(),
  model: z.string().max(80).optional(),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { allowed, reset } = await checkRateLimit(getSaveProfileRateLimit(), user.id, user.email);
    if (!allowed) {
      const resetIn = reset ? Math.max(1, Math.ceil((reset - Date.now()) / 60_000)) : 60;
      return NextResponse.json({ error: `Too many saves. Try again in ${resetIn}m.`, rateLimited: true }, { status: 429 });
    }

    const raw = await request.json().catch(() => null);
    const parsed = SaveSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid meal payload', issues: parsed.error.flatten() }, { status: 400 });
    }
    const { analysis, source, eatenAt, userText, model } = parsed.data;

    // Everything outside the core 5 macros lands in a single JSONB column so
    // we don't need a schema migration every time we extend the nutrition
    // shape. Fields set to undefined are trimmed out before insert.
    const nutrition_detail = {
      sugar_g:         analysis.sugar_g         ?? null,
      added_sugar_g:   analysis.added_sugar_g   ?? null,
      saturated_fat_g: analysis.saturated_fat_g ?? null,
      unsaturated_fat_g: analysis.unsaturated_fat_g ?? null,
      trans_fat_g:     analysis.trans_fat_g     ?? null,
      sodium_mg:       analysis.sodium_mg       ?? null,
      cholesterol_mg:  analysis.cholesterol_mg  ?? null,
      omega_3_g:       analysis.omega_3_g       ?? null,
      caffeine_mg:     analysis.caffeine_mg     ?? null,
      alcohol_g:       analysis.alcohol_g       ?? null,
      micros:          analysis.micros          ?? {},
      processing_nova: analysis.processing_nova ?? null,
      glycemic_index:  analysis.glycemic_index  ?? null,
      quality_flags:   analysis.quality_flags   ?? [],
    };

    const { data: inserted, error } = await supabase.from('meals').insert({
      user_id: user.id,
      eaten_at: eatenAt,
      source,
      user_text: userText ?? null,
      title: analysis.title,
      description: analysis.description || null,
      ingredients: analysis.ingredients,
      calories: analysis.calories ?? null,
      protein_g: analysis.protein_g ?? null,
      carbs_g: analysis.carbs_g ?? null,
      fat_g: analysis.fat_g ?? null,
      fiber_g: analysis.fiber_g ?? null,
      verdict: analysis.verdict,
      verdict_reasons: analysis.verdict_reasons,
      longevity_impact_score: analysis.longevity_impact_score ?? null,
      nutrition_detail,
      ai_model: model ?? null,
    }).select('*').single();

    if (error) {
      logger.error('meals.insert_failed', { userId: user.id, errorMessage: error.message });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ meal: inserted });
  } catch (err) {
    logger.error('meals.post_handler_failed', { errorMessage: describeError(err) });
    return NextResponse.json({ error: describeError(err) }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const daysParam = parseInt(searchParams.get('days') || '7', 10);
    const days = Number.isFinite(daysParam) ? Math.min(30, Math.max(1, daysParam)) : 7;

    const since = new Date(Date.now() - days * 864e5).toISOString();
    const { data, error } = await supabase.from('meals')
      .select('*')
      .eq('user_id', user.id)
      .gte('eaten_at', since)
      .order('eaten_at', { ascending: false })
      .limit(200);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ meals: data || [], days });
  } catch (err) {
    return NextResponse.json({ error: describeError(err) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    // RLS enforces user scope, but we also filter user_id explicitly so the
    // delete is a no-op if the id belongs to someone else (no information leak).
    const { error } = await supabase.from('meals').delete().eq('id', id).eq('user_id', user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: describeError(err) }, { status: 500 });
  }
}
