import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { logger, describeError } from '@/lib/logger';

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

    const raw = await request.json().catch(() => null);
    const parsed = Schema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', issues: parsed.error.flatten() }, { status: 400 });
    }

    const { error } = await supabase.from('blood_tests').insert({
      user_id: user.id,
      taken_at: new Date().toISOString().split('T')[0],
      biomarkers: parsed.data.biomarkers,
    });

    if (error) {
      logger.error('save_bloodtest.db_failed', { userId: user.id, errorMessage: error.message });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('save_bloodtest.handler_failed', { errorMessage: describeError(err) });
    return NextResponse.json({ error: describeError(err) }, { status: 500 });
  }
}
