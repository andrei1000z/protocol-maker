import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    await Promise.all([
      supabase.from('daily_logs').delete().eq('user_id', user.id),
      supabase.from('protocols').delete().eq('user_id', user.id),
      supabase.from('user_configs').delete().eq('user_id', user.id),
      supabase.from('profiles').update({ onboarding_completed: false }).eq('id', user.id),
    ]);

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
