import type { NextConfig } from "next";

// ─────────────────────────────────────────────────────────────────────────────
// Security headers — applied to every route.
// ─────────────────────────────────────────────────────────────────────────────
// CSP is intentionally permissive on script/style for now ('unsafe-inline'):
//   - app/layout.tsx ships two synchronous boot scripts (theme + i18n) via
//     dangerouslySetInnerHTML. They run BEFORE hydration so the saved theme /
//     locale is applied to <html> before first paint, preventing a dark→light
//     flash. Hashing them is the long-term plan; for now we ship in
//     Report-Only mode so violations are visible without breaking the app.
//   - Tailwind v4 emits inline <style> blocks at SSR time.
// Once the boot scripts have stable hashes (or move to external files with
// nonces), swap CSP-Report-Only → Content-Security-Policy.
// ─────────────────────────────────────────────────────────────────────────────
const CSP = [
  "default-src 'self'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "media-src 'self' blob:",
  "font-src 'self' data:",
  // Anthropic, Groq, Supabase, Upstash, Vercel Analytics + Vercel Insights
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.anthropic.com https://api.groq.com https://*.upstash.io https://va.vercel-scripts.com https://vitals.vercel-insights.com",
  // Inline needed for the theme + i18n boot scripts and Tailwind v4 SSR styles
  "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // MealLogger uses capture="environment" — keep camera allowed for same-origin.
  // microphone unused; geolocation reserved for future locale features.
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(self), interest-cohort=()",
  },
  // Start in report-only — flip to enforce after monitoring for 1 week.
  { key: "Content-Security-Policy-Report-Only", value: CSP },
];

const nextConfig: NextConfig = {
  transpilePackages: ['recharts'],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
