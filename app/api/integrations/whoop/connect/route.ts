import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildAuthorizeUrl, isConfigured } from '@/lib/integrations/whoop';
import { generateState, setStateCookie } from '@/lib/integrations/base';

export const runtime = 'nodejs';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  if (!isConfigured()) {
    return NextResponse.json({
      error: 'WHOOP integration is not configured. Set WHOOP_CLIENT_ID + WHOOP_CLIENT_SECRET in env.',
    }, { status: 503 });
  }

  const state = generateState();
  return setStateCookie(NextResponse.redirect(buildAuthorizeUrl(state)), 'whoop', state);
}
