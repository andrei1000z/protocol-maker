// Centralized site config — single source of truth for deployment URL + branding.
//
// Why this exists: SITE_URL was hardcoded as "https://protocol-tawny.vercel.app"
// in 6 different files (layout.tsx, robots.ts, sitemap.ts, share[slug] page +
// opengraph-image, tracking page achievement-share). Moving to a custom domain
// meant 6 sequential edits. Now: change one env var, redeploy.
//
// Resolution order:
//   1. NEXT_PUBLIC_SITE_URL (preferred — set this in Vercel for both prod + preview)
//   2. VERCEL_URL (auto-injected on Vercel deploys, missing the protocol)
//   3. Fallback to the current Vercel-generated domain so local builds + missing
//      envs don't crash.

const FALLBACK = 'https://protocol-tawny.vercel.app';

function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit && /^https?:\/\//.test(explicit)) return explicit.replace(/\/$/, '');

  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel.replace(/\/$/, '')}`;

  return FALLBACK;
}

export const SITE_URL = resolveSiteUrl();

// Brand metadata — keep in one place so OG/sitemap/robots stay consistent.
export const SITE_NAME = 'Protocol';
export const SITE_TAGLINE = 'AI-powered longevity protocols calibrated to your biomarkers';
