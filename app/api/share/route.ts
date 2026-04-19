import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// 9-byte random → 12-char base64url. ~6×10^16 keyspace, cryptographically secure.
// Replaces Math.random().toString(36).substring(2, 10) which was guessable
// (only 36^8 ≈ 2.8 × 10^12 entries from a non-CSPRNG).
function generateSlug(): string {
  return randomBytes(9).toString('base64url');
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { protocolId } = await request.json();
    if (!protocolId || typeof protocolId !== 'string') {
      return NextResponse.json({ error: 'protocolId required' }, { status: 400 });
    }

    // RLS already constrains share_links insert to auth.uid() = user_id,
    // but we double-check the protocol belongs to this user before allowing
    // a public link — defense in depth against a leaked id.
    const { data: protocol, error: protocolErr } = await supabase
      .from('protocols')
      .select('id')
      .eq('id', protocolId)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .maybeSingle();
    if (protocolErr) return NextResponse.json({ error: protocolErr.message }, { status: 500 });
    if (!protocol) return NextResponse.json({ error: 'Protocol not found' }, { status: 404 });

    // Retry once on the unlikely event of a slug collision (RFC: 9 bytes ≈ 4.7 × 10^16,
    // so collisions are statistically negligible — but the unique constraint will catch it).
    let slug = generateSlug();
    let { error } = await supabase.from('share_links').insert({ user_id: user.id, protocol_id: protocolId, slug });
    if (error && /duplicate key|unique/i.test(error.message)) {
      slug = generateSlug();
      ({ error } = await supabase.from('share_links').insert({ user_id: user.id, protocol_id: protocolId, slug }));
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ slug });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');
    if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 });

    const supabase = await createClient();

    const { data: link } = await supabase
      .from('share_links')
      .select('protocol_id, expires_at')
      .eq('slug', slug)
      .maybeSingle();
    if (!link) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Link expired' }, { status: 410 });
    }

    // Atomic increment via SQL function — no read-then-write race when many
    // viewers hit the same slug at once. Falls back silently if RPC is missing
    // (e.g. before the SQL migration runs) so views still work.
    void supabase.rpc('increment_share_view', { p_slug: slug });

    const { data: protocol } = await supabase
      .from('protocols')
      .select('protocol_json, longevity_score, biological_age')
      .eq('id', link.protocol_id)
      .is('deleted_at', null)
      .maybeSingle();
    if (!protocol) return NextResponse.json({ error: 'Protocol not found' }, { status: 404 });

    return NextResponse.json(protocol);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
