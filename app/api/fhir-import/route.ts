import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parseFhirObservations } from '@/lib/fhir-parser';
import { getParseBloodworkRateLimit, checkRateLimit } from '@/lib/rate-limit';
import { logger, describeError } from '@/lib/logger';

export const runtime = 'nodejs';

// POST /api/fhir-import — accepts a FHIR Observation, Bundle, or array of
// Observations and converts to our biomarker shape, then writes a new
// blood_tests row.
//
// Why this exists alongside /api/parse-bloodwork: PDF is the messy 80%
// case; FHIR is the clean 20% that European labs are starting to support.
// Users who can export FHIR get instant, deterministic ingest with zero
// AI calls — and zero Groq cost. Same end state in the DB.

const MAX_BYTES = 2 * 1024 * 1024;  // 2 MB is more than enough for a panel

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    // Reuse the parse-bloodwork rate limiter — same "cost ceiling" intent
    // (no AI involved here, but we still want to cap bulk imports).
    const { allowed, reset } = await checkRateLimit(getParseBloodworkRateLimit(), user.id, user.email);
    if (!allowed) {
      const resetIn = reset ? Math.max(1, Math.ceil((reset - Date.now()) / 60000)) : 60;
      return NextResponse.json({ error: `Prea multe importuri. Încearcă în ${resetIn}m.`, rateLimited: true }, { status: 429 });
    }

    // Reject obviously huge payloads at the door — the FHIR spec doesn't
    // cap document size, but a 2 MB JSON is already ~5000 observations.
    const text = await request.text();
    if (text.length > MAX_BYTES) {
      return NextResponse.json({ error: 'Bundle too large (>2 MB). Split into per-panel files.' }, { status: 413 });
    }

    let json: unknown;
    try { json = JSON.parse(text); } catch { return NextResponse.json({ error: 'Body is not valid JSON' }, { status: 400 }); }

    const { biomarkers, unmapped } = parseFhirObservations(json as Parameters<typeof parseFhirObservations>[0]);
    if (biomarkers.length === 0) {
      return NextResponse.json({
        error: 'Niciun biomarker recognoscut în acest bundle FHIR. Vezi lista de coduri LOINC suportate.',
        unmapped,
      }, { status: 422 });
    }

    // Pick the most common takenAt timestamp from the observations. Falls
    // back to "now" if none of them carry one.
    const dates = biomarkers.map(b => b.takenAt).filter(Boolean) as string[];
    const takenAt = dates[0] || new Date().toISOString();

    const { data: inserted, error } = await supabase.from('blood_tests').insert({
      user_id: user.id,
      taken_at: takenAt,
      biomarkers: biomarkers.map(b => ({ code: b.code, value: b.value, unit: b.unit })),
      lab_name: 'FHIR import',
    }).select('id').single();

    if (error) {
      logger.error('fhir_import.insert_failed', { userId: user.id, errorMessage: error.message });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      bloodTestId: inserted?.id,
      biomarkersImported: biomarkers.length,
      unmappedCount: unmapped.length,
      unmappedSample: unmapped.slice(0, 5),
    });
  } catch (err) {
    logger.error('fhir_import.handler_failed', { errorMessage: describeError(err) });
    return NextResponse.json({ error: describeError(err) }, { status: 500 });
  }
}
