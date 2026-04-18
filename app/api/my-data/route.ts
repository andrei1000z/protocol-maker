import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const [profileRes, protocolRes, bloodTestsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      // .maybeSingle() so no-protocol case doesn't produce an RLS-style error row
      supabase.from('protocols').select('*').eq('user_id', user.id).is('deleted_at', null).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('blood_tests').select('id, taken_at, biomarkers, lab_name').eq('user_id', user.id).is('deleted_at', null).order('taken_at', { ascending: false }),
    ]);

    return NextResponse.json(
      {
        profile: profileRes.data,
        protocol: protocolRes.data,
        bloodTests: bloodTestsRes.data || [],
      },
      {
        headers: {
          // Private CDN cache for 10s + stale-while-revalidate 5min.
          // User still hits origin for fresh data, but rapid nav feels instant.
          'Cache-Control': 'private, max-age=10, stale-while-revalidate=300',
        },
      }
    );
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
