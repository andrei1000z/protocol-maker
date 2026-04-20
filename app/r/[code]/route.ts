// /r/CODE — short-link shim for referrals. Anyone who clicks the link is
// redirected to /login?ref=CODE, which hands the code off to the signup
// flow. Kept as a route.ts (not a page) so there's no React render, zero
// friction: instant 302 + a cookie drop so the attribution survives the
// user clicking around the landing page before signing up.
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  // Normalize: codes are A-Z + 2-9, 6-8 chars. Strip anything suspicious so
  // `/r/<script>` doesn't propagate past this handler.
  const safe = (code || '').toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 16);
  if (!safe) return NextResponse.redirect(new URL('/', _request.url));

  const res = NextResponse.redirect(new URL(`/login?mode=register&ref=${safe}`, _request.url));
  // 30-day referral cookie — user can browse / sleep on it / come back later.
  res.cookies.set('protocol_ref', safe, {
    path: '/',
    maxAge: 30 * 86400,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  return res;
}
