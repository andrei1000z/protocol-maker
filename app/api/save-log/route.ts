import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const log = await request.json();

    const { error } = await supabase.from('daily_logs').upsert({
      user_id: user.id,
      date: log.date,
      tasks: log.tasks,
      supplements: log.supplements,
      meals: log.meals,
      water: log.water,
      mood: log.mood,
      energy: log.energy,
      focus: log.focus,
      notes: log.notes,
      watch_metrics: log.watchMetrics,
      weight: log.weight ?? null,
    }, { onConflict: 'user_id,date' });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
