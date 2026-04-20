// Dynamic Web App Manifest — generated at build time so biomarker / pattern
// counts in the description reflect the live BIOMARKER_DB.length instead of
// a stale hardcoded value. Next.js wires `/manifest.webmanifest` for us.
import type { MetadataRoute } from 'next';
import { BIOMARKER_DB } from '@/lib/engine/biomarkers';
import { PATTERN_COUNT } from '@/lib/engine/patterns';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Protocol — AI Longevity Engine',
    short_name: 'Protocol',
    description: `Personalized longevity protocols from your biomarker data. ${BIOMARKER_DB.length} markers, ${PATTERN_COUNT} clinical patterns, 8 organ systems. Built in 60s.`,
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    background_color: '#08090d',
    theme_color: '#34d399',
    orientation: 'portrait',
    lang: 'en',
    dir: 'ltr',
    categories: ['health', 'lifestyle', 'medical'],
    icons: [
      { src: '/icon',       sizes: '32x32',   type: 'image/png', purpose: 'any' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png', purpose: 'any' },
      { src: '/apple-icon', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    // App shortcuts — long-press the installed icon on Android / iOS for
    // quick jumps into the three pages users hit daily. Keep ≤4 shortcuts
    // (OS limit on most platforms).
    shortcuts: [
      {
        name: 'Today\'s tracking',
        short_name: 'Tracking',
        description: 'Log today\'s metrics',
        url: '/tracking',
        icons: [{ src: '/icon', sizes: '96x96', type: 'image/png' }],
      },
      {
        name: 'AI chat',
        short_name: 'Chat',
        description: 'Ask the protocol AI',
        url: '/chat',
        icons: [{ src: '/icon', sizes: '96x96', type: 'image/png' }],
      },
      {
        name: 'Protocol dashboard',
        short_name: 'Protocol',
        description: 'Your full protocol',
        url: '/dashboard',
        icons: [{ src: '/icon', sizes: '96x96', type: 'image/png' }],
      },
    ],
    prefer_related_applications: false,
  };
}
