import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { logger, describeError } from '@/lib/logger';
import { getSaveBloodtestRateLimit, checkRateLimit } from '@/lib/rate-limit';

// Tight per-biomarker shape — code is required, value must be a real number,
// unit caps at a reasonable length. Reject anything outside.
const BiomarkerSchema = z.object({
  code: z.string().min(1).max(40),
  value: z.number().finite().min(-1000).max(100000),
  unit: z.string().max(20).optional().default(''),
});

const Schema = z.object({
  biomarkers: z.array(BiomarkerSchema).min(1).max(60),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    // Rate limit: 10/hour. Server dedupes same-day writes, so the only legit
    // reason to hit this repeatedly is a failed parse retry flow (3-4 tries).
    const { allowed, reset } = await checkRateLimit(getSaveBloodtestRateLimit(), user.id, user.email);
    if (!allowed) {
      const resetIn = reset ? Math.max(1, Math.ceil((reset - Date.now()) / 60000)) : 60;
      return NextResponse.json({ error: `Too many saves. Try again in ${resetIn}m.`, rateLimited: true }, { status: 429 });
    }

    const raw = await request.json().catch(() => null);
    const parsed = Schema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', issues: parsed.error.flatten() }, { status: 400 });
    }

    // Dedupe biomarkers by code — keep the LAST value. A PDF with multiple
    // glucose rows (fasted + post-prandial) would otherwise write two GLUC
    // entries and the classifier would pick whichever it found first.
    const biomarkersByCode = new Map<string, typeof parsed.data.biomarkers[number]>();
    for (const b of parsed.data.biomarkers) biomarkersByCode.set(b.code, b);
    const deduped = Array.from(biomarkersByCode.values());

    const today = new Date().toISOString().split('T')[0];

    // If the user already saved a test for today, REPLACE it instead of
    // inserting a duplicate row. Accidental double-upload (network retry,
    // refresh during parse) would otherwise show two separate tests on the
    // same day and the dashboard's "latest" pick becomes a coin flip.
    const { data: existing } = await supabase.from('blood_tests')
      .select('id').eq('user_id', user.id).eq('taken_at', today)
      .is('deleted_at', null).maybeSingle();

    let error;
    if (existing) {
      ({ error } = await supabase.from('blood_tests')
        .update({ biomarkers: deduped })
        .eq('id', existing.id));
    } else {
      ({ error } = await supabase.from('blood_tests').insert({
        user_id: user.id,
        taken_at: today,
        biomarkers: deduped,
      }));
    }

    if (error) {
      logger.error('save_bloodtest.db_failed', { userId: user.id, errorMessage: error.message });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, replaced: !!existing, biomarkers: deduped.length });
  } catch (err) {
    logger.error('save_bloodtest.handler_failed', { errorMessage: describeError(err) });
    return NextResponse.json({ error: describeError(err) }, { status: 500 });
  }
}
