// Start an Oura OAuth flow. Authenticated user hits this, we:
//   1. Generate a random CSRF state + stash it in an HttpOnly cookie
//   2. Redirect to Oura's authorize URL with our client_id + scopes
// On return the callback verifies the state cookie matches the state param.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildAuthorizeUrl, isConfigured } from '@/lib/integrations/oura';
import { randomBytes } from 'node:crypto';

export const runtime = 'nodejs';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  if (!isConfigured()) {
    return NextResponse.json({
      error: 'Oura integration is not configured on this server. Set OURA_CLIENT_ID + OURA_CLIENT_SECRET in env.',
    }, { status: 503 });
  }

  // 32 bytes → 64 hex chars; plenty of CSRF entropy + small enough to cookie.
  const state = randomBytes(32).toString('hex');
  const authorizeUrl = buildAuthorizeUrl(state);

  const res = NextResponse.redirect(authorizeUrl);
  // HttpOnly, Secure in prod, SameSite=Lax so the cookie survives the cross-
  // site redirect back from Oura. 10-minute TTL — flow takes seconds.
  res.cookies.set('oura_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });
  return res;
}
