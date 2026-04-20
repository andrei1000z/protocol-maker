// Starts the Fitbit OAuth flow. Mirrors /api/integrations/oura/connect.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildAuthorizeUrl, isConfigured } from '@/lib/integrations/fitbit';
import { generateState, setStateCookie } from '@/lib/integrations/base';

export const runtime = 'nodejs';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  if (!isConfigured()) {
    return NextResponse.json({
      error: 'Fitbit integration is not configured on this server. Set FITBIT_CLIENT_ID + FITBIT_CLIENT_SECRET in env.',
    }, { status: 503 });
  }

  const state = generateState();
  return setStateCookie(NextResponse.redirect(buildAuthorizeUrl(state)), 'fitbit', state);
}
