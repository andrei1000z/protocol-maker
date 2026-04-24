// POST /api/supplement-feedback — user reports a side effect on a supplement.
// GET  /api/supplement-feedback — list the user's last 30 days of reports.
// DELETE /api/supplement-feedback?id=… — revoke a report.
//
// Feeds into the master-prompt context so the next regen can route around
// supplements the user has flagged ("got bloating on magnesium glycinate →
// try malate instead"). Kept narrow-scope on purpose — no ratings, no
// severity scale — because the call-to-action is "avoid or switch", not
// "rank all your experiences".

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getSaveProfileRateLimit, checkRateLimit } from '@/lib/rate-limit';
import { logger, describeError } from '@/lib/logger';

export const runtime = 'nodejs';

// Controlled vocabulary — the modal checkboxes write one of these and the
// master prompt reads them. Adding a new category means updating both.
// "other" is the escape hatch; free text goes in `notes`.
const CATEGORIES = [
  'digestive',      // bloating, diarrhea, nausea, constipation
  'sleep',          // insomnia, vivid dreams, waking up
  'energy',         // jitters, crash, lethargy
  'mood',           // irritability, anxiety spike, flat affect
  'skin',           // acne, rash, itching
  'headache',       // migraine, tension headache
  'other',
] as const;

const PostSchema = z.object({
  supplement_name: z.string().min(1).max(120),
  categories: z.array(z.enum(CATEGORIES)).min(1).max(10),
  notes: z.string().max(1000).optional().nullable(),
  protocol_id: z.string().uuid().optional().nullable(),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    // Reuse the save-profile limiter (20/hour) — feedback is bursty at first
    // then sporadic; no reason for a dedicated budget.
    const { allowed, reset } = await checkRateLimit(getSaveProfileRateLimit(), user.id, user.email);
    if (!allowed) {
      const resetIn = reset ? Math.max(1, Math.ceil((reset - Date.now()) / 60_000)) : 60;
      return NextResponse.json({ error: `Too many reports. Try again in ${resetIn}m.`, rateLimited: true }, { status: 429 });
    }

    const raw = await request.json().catch(() => null);
    const parsed = PostSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', issues: parsed.error.flatten() }, { status: 400 });
    }

    const { data, error } = await supabase.from('supplement_feedback').insert({
      user_id: user.id,
      supplement_name: parsed.data.supplement_name,
      categories: parsed.data.categories,
      notes: parsed.data.notes ?? null,
      protocol_id: parsed.data.protocol_id ?? null,
    }).select('*').single();

    if (error) {
      logger.error('supplement_feedback.insert_failed', { userId: user.id, errorMessage: error.message });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    logger.info('supplement_feedback.reported', {
      userId: user.id,
      supplement: parsed.data.supplement_name,
      categories: parsed.data.categories,
    });

    return NextResponse.json({ feedback: data });
  } catch (err) {
    logger.error('supplement_feedback.post_handler_failed', { errorMessage: describeError(err) });
    return NextResponse.json({ error: describeError(err) }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const daysParam = parseInt(searchParams.get('days') || '30', 10);
    const days = Number.isFinite(daysParam) ? Math.min(90, Math.max(1, daysParam)) : 30;

    const since = new Date(Date.now() - days * 864e5).toISOString();
    const { data, error } = await supabase.from('supplement_feedback')
      .select('*')
      .eq('user_id', user.id)
      .gte('reported_at', since)
      .order('reported_at', { ascending: false })
      .limit(100);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ feedback: data || [], days });
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

    const { error } = await supabase.from('supplement_feedback').delete().eq('id', id).eq('user_id', user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: describeError(err) }, { status: 500 });
  }
}
