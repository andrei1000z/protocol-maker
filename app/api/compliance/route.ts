import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { logger, describeError } from '@/lib/logger';
import { getComplianceRateLimit, checkRateLimit } from '@/lib/rate-limit';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
// Validates the date is real (catches 2025-02-30 etc) before letting it touch the DB.
function isRealDate(s: string): boolean {
  if (!ISO_DATE.test(s)) return false;
  const d = new Date(s);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

const PostSchema = z.object({
  itemType: z.string().min(1).max(40),
  itemName: z.string().min(1).max(200),
  date: z.string().refine(isRealDate, 'date must be YYYY-MM-DD and a real calendar day'),
  completed: z.boolean(),
  // Omit for "no protocol attached" — explicit null is rejected so clients
  // can't bypass ownership checks by sending `null` instead of undefined.
  protocolId: z.string().uuid().optional(),
});

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    if (!isRealDate(date)) return NextResponse.json({ error: 'Invalid date' }, { status: 400 });

    const { data } = await supabase.from('compliance_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', date);

    return NextResponse.json({ logs: data || [] });
  } catch (err) {
    return NextResponse.json({ error: describeError(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    // Rate limit: 200 writes/hour — matches daily_metrics budget; power user
    // ticking 40 items × 2 views/day is ~80/day, so 200/h handles rage-clicks.
    const { allowed, reset } = await checkRateLimit(getComplianceRateLimit(), user.id, user.email);
    if (!allowed) {
      const resetIn = reset ? Math.max(1, Math.ceil((reset - Date.now()) / 60000)) : 60;
      return NextResponse.json({ error: `Too many updates. Try again in ${resetIn}m.`, rateLimited: true }, { status: 429 });
    }

    const raw = await request.json().catch(() => null);
    const parsed = PostSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', issues: parsed.error.flatten() }, { status: 400 });
    }
    const { itemType, itemName, date, completed, protocolId } = parsed.data;

    // Verify protocolId belongs to this user (defense in depth — RLS already
    // guards user_id, but a stray protocol_id from another user's protocol
    // would corrupt the FK relationship without this check).
    if (protocolId) {
      const { data: protoCheck } = await supabase
        .from('protocols')
        .select('id')
        .eq('id', protocolId)
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .maybeSingle();
      if (!protoCheck) {
        return NextResponse.json({ error: 'Invalid protocolId' }, { status: 400 });
      }
    }

    const { error } = await supabase.from('compliance_logs').upsert({
      user_id: user.id,
      protocol_id: protocolId ?? null,
      item_type: itemType,
      item_name: itemName,
      date,
      completed,
    }, { onConflict: 'user_id,item_type,item_name,date' });

    if (error) {
      logger.error('compliance.upsert_failed', { userId: user.id, errorMessage: error.message });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('compliance.handler_failed', { errorMessage: describeError(err) });
    return NextResponse.json({ error: describeError(err) }, { status: 500 });
  }
}
