import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger, describeError } from '@/lib/logger';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
function isRealDate(s: unknown): s is string {
  if (typeof s !== 'string' || !ISO_DATE.test(s)) return false;
  const d = new Date(s);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const date = searchParams.get('date');

    if (date) {
      if (!isRealDate(date)) return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
      const { data } = await supabase.from('daily_metrics').select('*').eq('user_id', user.id).eq('date', date).maybeSingle();
      return NextResponse.json({ metrics: data });
    }

    if (!startDate || !endDate) return NextResponse.json({ error: 'startDate+endDate or date required' }, { status: 400 });
    if (!isRealDate(startDate) || !isRealDate(endDate)) return NextResponse.json({ error: 'Invalid date range' }, { status: 400 });

    const { data, error } = await supabase
      .from('daily_metrics')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ metrics: data || [] });
  } catch (err) {
    return NextResponse.json({ error: describeError(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const { date, ...fields } = body as { date: unknown; [k: string]: unknown };
    if (!isRealDate(date)) {
      return NextResponse.json({ error: 'date required and must be YYYY-MM-DD (real calendar day)' }, { status: 400 });
    }
    // Block future dates — logging ahead corrupts trend math + statistics views.
    // Allow today in any timezone: compare against tomorrow's UTC date so a user
    // in UTC+3 logging at 23:30 local on day N isn't rejected just because the
    // server is already on day N+1 in UTC.
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    if (date > tomorrow.toISOString().slice(0, 10)) {
      return NextResponse.json({ error: 'date cannot be in the future' }, { status: 400 });
    }

    // Try upsert as-is. If DB rejects due to missing columns (pre-migration DB),
    // strip the unknown column and retry — so the UI never breaks while users
    // wait for the schema migration to land.
    const attemptUpsert = async (data: Record<string, unknown>) => supabase.from('daily_metrics').upsert({
      user_id: user.id, date, ...data, updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,date' });

    let working = { ...fields };
    for (let attempts = 0; attempts < 25; attempts++) {
      const { error } = await attemptUpsert(working);
      if (!error) return NextResponse.json({ success: true, strippedFields: Object.keys(fields).length - Object.keys(working).length });
      // Postgres "column ... of relation ... does not exist" — strip that field and retry
      const m = error.message.match(/column "?(\w+)"? of relation/i) || error.message.match(/(\w+) does not exist/i);
      if (m && m[1] && m[1] in working) {
        delete working[m[1]];
        continue;
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: 'Too many missing columns — run upgrade.sql in Supabase SQL Editor' }, { status: 500 });
  } catch (err) {
    logger.error('daily_metrics.handler_failed', { errorMessage: describeError(err) });
    return NextResponse.json({ error: describeError(err) }, { status: 500 });
  }
}
