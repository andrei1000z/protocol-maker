import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { protocolId } = await request.json();
    const slug = Math.random().toString(36).substring(2, 10);

    const { error } = await supabase.from('share_links').insert({
      user_id: user.id,
      protocol_id: protocolId,
      slug,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ slug });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');
    if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 });

    const supabase = await createClient();

    const { data: link } = await supabase.from('share_links').select('protocol_id').eq('slug', slug).single();
    if (!link) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await supabase.from('share_links').update({ view_count: 1 }).eq('slug', slug);

    const { data: protocol } = await supabase.from('protocols').select('protocol_json, longevity_score, biological_age').eq('id', link.protocol_id).single();
    if (!protocol) return NextResponse.json({ error: 'Protocol not found' }, { status: 404 });

    return NextResponse.json(protocol);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
