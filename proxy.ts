import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export default async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            // Force a long maxAge when Supabase doesn't set one, so the
            // auth cookie isn't dropped when the tab closes. Browsers
            // treat a cookie with no maxAge/expires as a "session cookie"
            // → gone when the last tab for this origin closes. Was
            // happening even though Supabase passes maxAge for the main
            // token, because a few auxiliary cookies (code verifier,
            // provider token) omit it. 400 days matches Chrome's ceiling.
            const cookieOpts = options?.maxAge || options?.expires
              ? options
              : { ...options, maxAge: 400 * 24 * 60 * 60 };
            supabaseResponse.cookies.set(name, value, cookieOpts);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  // Demo mode: anyone can view /dashboard?demo=1 (sample protocol, no real data)
  const isDemoMode = path === '/dashboard' && request.nextUrl.searchParams.has('demo');

  // Public allowlist — everything else requires a Supabase session. Marketing
  // pages MUST live in here; otherwise the proxy 307s anonymous visitors to
  // /login before they can read the pricing page or biomarker explanations
  // (which defeats the point of having them as marketing surfaces).
  // Keep this list flat + comma-separated for greppability.
  const PUBLIC_EXACT = new Set<string>([
    '/', '/login', '/auth/callback', '/sitemap.xml', '/robots.txt',
    '/privacy', '/terms', '/pricing', '/changelog',
    '/biomarkers', '/patterns',
    // Static assets that shouldn't go through auth: PWA manifest, icons, OG,
    // and the service worker file. /sw.js MUST be public — without it the
    // browser can't fetch worker updates, leaving users stuck on whatever
    // SW version they last installed. That bug previously caused "This page
    // couldn't load" on /dashboard for clients with an expired session who
    // had no way to update past the cached 307s.
    '/sw.js', '/manifest.webmanifest', '/opengraph-image', '/twitter-image',
    '/icon', '/apple-icon',
  ]);
  // Public prefixes — anything under these is treated as marketing/api.
  const PUBLIC_PREFIXES = ['/api', '/share', '/r/', '/biomarkers/', '/patterns/'];

  const isPublic = isDemoMode
    || PUBLIC_EXACT.has(path)
    || PUBLIC_PREFIXES.some(p => path.startsWith(p));

  // Every redirect we emit has to carry forward the Set-Cookie headers
  // that Supabase wrote to `supabaseResponse` during getUser(). If we
  // return a bare NextResponse.redirect(), the refreshed auth token is
  // silently thrown away — the next page load sends the stale token,
  // Supabase rejects it, and the user gets kicked to /login. This was
  // the cause of "close the tab, come back, I'm signed out": access
  // tokens expire after 1h, the first navigation refreshes them, but
  // the redirect response didn't include the rotated cookies.
  const redirectWithCookies = (url: URL) => {
    const res = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach(c => res.cookies.set(c));
    return res;
  };

  if (isPublic) return supabaseResponse;

  if (!user) {
    return redirectWithCookies(new URL('/login', request.url));
  }

  if (path !== '/onboarding') {
    const { data: profile } = await supabase.from('profiles').select('onboarding_completed').eq('id', user.id).single();
    if (!profile?.onboarding_completed) {
      return redirectWithCookies(new URL('/onboarding', request.url));
    }
  }

  if (path === '/onboarding') {
    const { data: profile } = await supabase.from('profiles').select('onboarding_completed').eq('id', user.id).single();
    if (profile?.onboarding_completed) {
      return redirectWithCookies(new URL('/dashboard', request.url));
    }
  }

  return supabaseResponse;
}

// Matcher excludes:
//   - _next/static, _next/image — Next's build output, never auth-gated.
//   - favicon.ico — Chrome fetches without cookies, would 307 noisily.
//   - Static file extensions at any path: svg/png/jpg/jpeg/gif/webp images,
//     js/json/css scripts + data, woff/woff2/ttf/otf/eot fonts, ico icons,
//     map sourcemaps, webmanifest, txt.
//   This belt-and-suspenders pair with the PUBLIC_EXACT allowlist: even if
//   we forget to add a new static path there, the file extension regex
//   below keeps the middleware out of static asset delivery entirely.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|json|css|woff|woff2|ttf|otf|eot|map|webmanifest|txt)$).*)'],
};
