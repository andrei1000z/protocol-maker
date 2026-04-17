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
    const date = searchParams.get('date');

    if (date) {
      const { data } = await supabase.from('daily_metrics').select('*').eq('user_id', user.id).eq('date', date).maybeSingle();
      return NextResponse.json({ metrics: data });
    }

    if (!startDate || !endDate) return NextResponse.json({ error: 'startDate+endDate or date required' }, { status: 400 });

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
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await request.json();
    const { date, ...fields } = body;
    if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 });

    const { error } = await supabase.from('daily_metrics').upsert({
      user_id: user.id,
      date,
      ...fields,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,date' });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
