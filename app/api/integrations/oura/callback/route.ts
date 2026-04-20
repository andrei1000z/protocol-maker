// Oura OAuth callback — receives ?code=...&state=..., verifies the state
// cookie we set in /connect, exchanges the code for tokens, stores them in
// oauth_connections, then redirects back to Settings with a success banner.
//
// Uses the admin client to write tokens — they shouldn't be readable from
// the client-side supabase session anyway (RLS gives SELECT only, no write).
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { exchangeCodeForTokens, isConfigured } from '@/lib/integrations/oura';
import { logger, describeError } from '@/lib/logger';
import { SITE_URL } from '@/lib/config';

export const runtime = 'nodejs';

function redirectBackWithError(reason: string) {
  const url = `${SITE_URL}/settings?integration=oura&error=${encodeURIComponent(reason)}`;
  return NextResponse.redirect(url);
}
function redirectBackWithSuccess() {
  return NextResponse.redirect(`${SITE_URL}/settings?integration=oura&connected=1`);
}

export async function GET(request: Request) {
  if (!isConfigured()) return redirectBackWithError('not_configured');

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const oauthError = searchParams.get('error');

  if (oauthError) return redirectBackWithError(oauthError);
  if (!code || !state) return redirectBackWithError('missing_code_or_state');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${SITE_URL}/login?next=/settings`);

  // CSRF verify — match the state we stashed in /connect.
  const stateCookie = request.headers.get('cookie')?.match(/oura_oauth_state=([^;]+)/)?.[1];
  if (!stateCookie || stateCookie !== state) {
    logger.warn('oura.callback_state_mismatch', { userId: user.id });
    return redirectBackWithError('state_mismatch');
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const admin = createAdminClient();
    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null;

    const { error: upsertErr } = await admin.from('oauth_connections').upsert({
      user_id: user.id,
      provider: 'oura',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      token_type: tokens.token_type || 'Bearer',
      expires_at: expiresAt,
      scopes: tokens.scope || null,
      updated_at: new Date().toISOString(),
      last_sync_error: null,
    }, { onConflict: 'user_id,provider' });

    if (upsertErr) throw new Error(`oauth_connections upsert: ${upsertErr.message}`);

    logger.info('oura.connected', { userId: user.id, hasRefresh: !!tokens.refresh_token });

    const res = redirectBackWithSuccess();
    // Clear the state cookie — single-use.
    res.cookies.set('oura_oauth_state', '', { path: '/', maxAge: 0 });
    return res;
  } catch (err) {
    logger.error('oura.callback_failed', { userId: user.id, errorMessage: describeError(err) });
    return redirectBackWithError('token_exchange_failed');
  }
}
