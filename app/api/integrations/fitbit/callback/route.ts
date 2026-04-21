import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { exchangeCodeForTokens, isConfigured } from '@/lib/integrations/fitbit';
import { clearStateCookie, readStateCookie, redirectErr, redirectOk, upsertConnection } from '@/lib/integrations/base';
import { logger, describeError } from '@/lib/logger';
import { SITE_URL } from '@/lib/config';
import { trackServer } from '@/lib/analytics';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (!isConfigured()) return redirectErr('fitbit', 'not_configured');

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const oauthError = searchParams.get('error');
  if (oauthError) return redirectErr('fitbit', oauthError);
  if (!code || !state) return redirectErr('fitbit', 'missing_code_or_state');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${SITE_URL}/login?next=/settings`);

  const stored = readStateCookie(request, 'fitbit');
  if (!stored || stored !== state) {
    logger.warn('fitbit.callback_state_mismatch', { userId: user.id });
    return redirectErr('fitbit', 'state_mismatch');
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    await upsertConnection(createAdminClient(), user.id, 'fitbit', tokens);
    logger.info('fitbit.connected', { userId: user.id, hasRefresh: !!tokens.refreshToken });
    trackServer('wearable_connected', { provider: 'fitbit' });
    return clearStateCookie(redirectOk('fitbit'), 'fitbit');
  } catch (err) {
    logger.error('fitbit.callback_failed', { userId: user.id, errorMessage: describeError(err) });
    return redirectErr('fitbit', 'token_exchange_failed');
  }
}
