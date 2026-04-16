import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    const { data } = await supabase.from('compliance_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', date);

    return NextResponse.json({ logs: data || [] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { itemType, itemName, date, completed, protocolId } = await request.json();

    const { error } = await supabase.from('compliance_logs').upsert({
      user_id: user.id,
      protocol_id: protocolId,
      item_type: itemType,
      item_name: itemName,
      date,
      completed,
    }, { onConflict: 'user_id,item_type,item_name,date' });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
