import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// Dual-mode endpoint:
//   GET /api/my-data        → lean response for page-load hydration (profile,
//                             latest protocol, blood tests). Hit on every nav.
//   GET /api/my-data?full=1 → complete per-user export (GDPR Article 15).
//                             Adds daily_metrics, compliance_logs, share_links,
//                             and full protocol history. Larger payload, hit
//                             only from Settings → "Export my data".
//
// Split because useMyData() fires on every page transition — ballooning its
// response with years of daily_metrics would waste bandwidth on 99% of calls.
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const full = new URL(request.url).searchParams.get('full') === '1';

    const [profileRes, protocolRes, bloodTestsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('protocols').select('*').eq('user_id', user.id).is('deleted_at', null).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('blood_tests').select('id, taken_at, biomarkers, lab_name').eq('user_id', user.id).is('deleted_at', null).order('taken_at', { ascending: false }),
    ]);

    const baseBody = {
      profile: profileRes.data,
      protocol: protocolRes.data,
      bloodTests: bloodTestsRes.data || [],
    };

    if (!full) {
      return NextResponse.json(baseBody, {
        headers: {
          // Private CDN cache for 10s + stale-while-revalidate 5min.
          'Cache-Control': 'private, max-age=10, stale-while-revalidate=300',
        },
      });
    }

    // Full export — every user-owned row across the app. No caching: this is
    // a one-shot download the user intentionally triggered.
    const [dailyMetricsRes, complianceRes, shareLinksRes, protocolHistoryRes, chatMessagesRes] = await Promise.all([
      supabase.from('daily_metrics').select('*').eq('user_id', user.id).order('date', { ascending: false }),
      supabase.from('compliance_logs').select('*').eq('user_id', user.id).order('date', { ascending: false }),
      supabase.from('share_links').select('*').eq('user_id', user.id),
      supabase.from('protocols').select('id, created_at, longevity_score, biological_age_decimal, aging_pace, model_used, generation_source')
        .eq('user_id', user.id).is('deleted_at', null).order('created_at', { ascending: false }),
      // chat_messages table is newer — if the export runs before migration,
      // PostgREST returns a "relation does not exist" error. Swallow that to
      // keep the export usable; any real error still surfaces.
      supabase.from('chat_messages').select('role, content, model, created_at').eq('user_id', user.id).order('created_at', { ascending: false }),
    ]);

    const chatMessages = chatMessagesRes.error && /does not exist|relation.*chat_messages/i.test(chatMessagesRes.error.message)
      ? []
      : (chatMessagesRes.data || []);

    return NextResponse.json(
      {
        ...baseBody,
        dailyMetrics:    dailyMetricsRes.data    || [],
        complianceLogs:  complianceRes.data      || [],
        shareLinks:      shareLinksRes.data      || [],
        protocolHistory: protocolHistoryRes.data || [],
        chatMessages,
        exportedAt: new Date().toISOString(),
        exportedForUserId: user.id,
        gdprNotice: 'This archive contains all personal data we store for your account. Chat messages are auto-purged after 90 days; everything else is retained until you delete your account. Under GDPR Article 15 you have the right to access, correct, or delete any of it — use Delete Account in Settings.',
      },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
