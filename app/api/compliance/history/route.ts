import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'startDate and endDate required' }, { status: 400 });
    }

    const { data: logs, error } = await supabase
      .from('compliance_logs')
      .select('date, completed, item_type, item_name')
      .eq('user_id', user.id)
      .gte('date', startDate)
      .lte('date', endDate);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Group by date
    const byDate = new Map<string, { completed: number; total: number }>();
    for (const log of logs || []) {
      const existing = byDate.get(log.date) || { completed: 0, total: 0 };
      existing.total++;
      if (log.completed) existing.completed++;
      byDate.set(log.date, existing);
    }

    const history = Array.from(byDate.entries())
      .map(([date, stats]) => ({
        date,
        completed: stats.completed,
        total: stats.total,
        pct: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({ history });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
