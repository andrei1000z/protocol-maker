import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { exchangeCodeForTokens, isConfigured } from '@/lib/integrations/google-fit';
import { clearStateCookie, readStateCookie, redirectErr, redirectOk, upsertConnection } from '@/lib/integrations/base';
import { logger, describeError } from '@/lib/logger';
import { SITE_URL } from '@/lib/config';
import { trackServer } from '@/lib/analytics';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (!isConfigured()) return redirectErr('google_fit', 'not_configured');

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const oauthError = searchParams.get('error');
  if (oauthError) return redirectErr('google_fit', oauthError);
  if (!code || !state) return redirectErr('google_fit', 'missing_code_or_state');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${SITE_URL}/login?next=/settings`);

  const stored = readStateCookie(request, 'google_fit');
  if (!stored || stored !== state) {
    logger.warn('google_fit.callback_state_mismatch', { userId: user.id });
    return redirectErr('google_fit', 'state_mismatch');
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    await upsertConnection(createAdminClient(), user.id, 'google_fit', tokens);
    logger.info('google_fit.connected', { userId: user.id, hasRefresh: !!tokens.refreshToken });
    trackServer('wearable_connected', { provider: 'google_fit' });
    return clearStateCookie(redirectOk('google_fit'), 'google_fit');
  } catch (err) {
    logger.error('google_fit.callback_failed', { userId: user.id, errorMessage: describeError(err) });
    return redirectErr('google_fit', 'token_exchange_failed');
  }
}
