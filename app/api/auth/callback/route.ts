import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { trackServer } from '@/lib/analytics';

// Supabase auth callback — handles both email-confirm and OAuth code exchange.
// Also attributes a referral if the `protocol_ref` cookie is present and the
// user hasn't already been attributed (first-touch wins, no overwrite).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  if (!code) return NextResponse.redirect(`${origin}/login?error=auth`);

  const supabase = await createClient();
  const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}/login?error=auth`);

  // Emit signup vs signin analytics. Signup is defined as a user whose
  // created_at is within 60s of now — new accounts hit the callback once for
  // session exchange, and that same race window rules out spoofed events.
  const authedUser = sessionData?.user;
  if (authedUser?.created_at) {
    const createdMs = Date.parse(authedUser.created_at);
    const isNew = Number.isFinite(createdMs) && (Date.now() - createdMs) < 60_000;
    const provider = authedUser.app_metadata?.provider ?? 'email';
    trackServer(isNew ? 'signup' : 'signin', { provider });
  }

  // Referral attribution: best-effort. Silent failures never block the signin.
  try {
    const refCookie = request.headers.get('cookie')?.match(/protocol_ref=([^;]+)/)?.[1];
    const refCode = refCookie ? decodeURIComponent(refCookie).toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 16) : '';
    if (refCode) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Only attribute if this profile hasn't been attributed yet AND the
        // code maps to a real, non-self user. Prevents self-referral farming.
        const { data: profile } = await supabase.from('profiles')
          .select('referred_by_code, referral_code').eq('id', user.id).maybeSingle();
        if (profile && !profile.referred_by_code && profile.referral_code !== refCode) {
          const { data: referrer } = await supabase.from('profiles')
            .select('id').eq('referral_code', refCode).maybeSingle();
          if (referrer && referrer.id !== user.id) {
            await supabase.from('profiles').update({
              referred_by_code: refCode,
              referred_by_user_id: referrer.id,
            }).eq('id', user.id);
          }
        }
      }
    }
  } catch { /* attribution failure never blocks auth */ }

  const res = NextResponse.redirect(`${origin}/dashboard`);
  // Clear the ref cookie — one-shot.
  res.cookies.set('protocol_ref', '', { path: '/', maxAge: 0 });
  return res;
}
