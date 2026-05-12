import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildIcsCalendar } from '@/lib/utils/export-formats';

export const runtime = 'nodejs';

// GET /api/calendar.ics — returns a subscribable calendar of the user's
// daily schedule + supplement reminders. Each event repeats daily.
//
// Auth: cookie-based Supabase session. Returns 401 if not signed in.
// Content-Type is text/calendar so browsers download or auto-add depending
// on the OS; Outlook/Apple Calendar treat it as a subscribable feed when
// added by URL.
//
// To subscribe (instead of one-shot import), point the calendar client at
// this exact URL. The cookie is sent on each fetch, so the feed always
// reflects the user's latest protocol.

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data: row } = await supabase
    .from('protocols')
    .select('protocol_json, created_at')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row?.protocol_json) {
    return NextResponse.json({ error: 'No protocol to export. Generate one first.' }, { status: 404 });
  }

  const ics = buildIcsCalendar(row.protocol_json as Parameters<typeof buildIcsCalendar>[0], {
    calName: 'Protocol — agenda zilnică',
  });

  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="protocol.ics"',
      // Subscribers re-fetch every few hours/days — let them cache briefly to
      // keep load down without losing updates after a regen.
      'Cache-Control': 'private, max-age=900',
    },
  });
}
