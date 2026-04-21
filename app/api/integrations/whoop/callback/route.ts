import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { exchangeCodeForTokens, isConfigured } from '@/lib/integrations/whoop';
import { clearStateCookie, readStateCookie, redirectErr, redirectOk, upsertConnection } from '@/lib/integrations/base';
import { logger, describeError } from '@/lib/logger';
import { SITE_URL } from '@/lib/config';
import { trackServer } from '@/lib/analytics';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (!isConfigured()) return redirectErr('whoop', 'not_configured');

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const oauthError = searchParams.get('error');
  if (oauthError) return redirectErr('whoop', oauthError);
  if (!code || !state) return redirectErr('whoop', 'missing_code_or_state');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${SITE_URL}/login?next=/settings`);

  const stored = readStateCookie(request, 'whoop');
  if (!stored || stored !== state) {
    logger.warn('whoop.callback_state_mismatch', { userId: user.id });
    return redirectErr('whoop', 'state_mismatch');
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    await upsertConnection(createAdminClient(), user.id, 'whoop', tokens);
    logger.info('whoop.connected', { userId: user.id, hasRefresh: !!tokens.refreshToken });
    trackServer('wearable_connected', { provider: 'whoop' });
    return clearStateCookie(redirectOk('whoop'), 'whoop');
  } catch (err) {
    logger.error('whoop.callback_failed', { userId: user.id, errorMessage: describeError(err) });
    return redirectErr('whoop', 'token_exchange_failed');
  }
}
