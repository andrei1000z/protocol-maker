import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Returns the user's full daily_metrics history (no pagination — typical user
 * logs once/day so even a year = 365 rows, tiny payload).
 * Ordered ascending by date so the client can render charts without re-sorting.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    // Pull daily metrics (full history) + protocol start date (first protocol = "when you started")
    const [metricsRes, firstProtocolRes] = await Promise.all([
      supabase
        .from('daily_metrics')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: true }),
      supabase
        .from('protocols')
        .select('created_at')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

    if (metricsRes.error) return NextResponse.json({ error: metricsRes.error.message }, { status: 500 });

    return NextResponse.json({
      metrics: metricsRes.data || [],
      protocolStartedAt: firstProtocolRes.data?.created_at || null,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
