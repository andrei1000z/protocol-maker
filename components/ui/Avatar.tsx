'use client';

// Deterministic gradient avatar. No upload, no storage — derives a stable
// colour pair from the user's id (or name fallback) and renders the first
// initial on top.
//
// Why deterministic: a real upload feature would need Supabase Storage +
// CORS + RLS + size limits + crop UI. Big surface for a small win. The
// gradient avatar gives every user a recognisable, personal-feeling
// circle while costing zero infrastructure.
//
// The same seed always produces the same colours, so users see "their
// avatar" stably across sessions and devices.

import clsx from 'clsx';

// Hand-picked palette — high-contrast pairs that work on both light and
// dark backgrounds. Each pair is `[from, to]` for a CSS linear-gradient.
const PALETTE: Array<[string, string]> = [
  ['#34d399', '#10b981'],   // emerald (matches accent)
  ['#60a5fa', '#3b82f6'],   // sky
  ['#a78bfa', '#7c3aed'],   // violet
  ['#fb923c', '#f97316'],   // orange
  ['#f472b6', '#ec4899'],   // pink
  ['#fbbf24', '#f59e0b'],   // amber
  ['#22d3ee', '#06b6d4'],   // cyan
  ['#84cc16', '#65a30d'],   // lime
];

/** Hash a string to an integer — small, deterministic, no deps.
 *  Used to pick a stable palette index from the user's seed. */
function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h) + seed.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export interface AvatarProps {
  /** Stable seed for the gradient — user id is ideal; name is acceptable;
   *  email works but burns more bytes than needed. */
  seed: string;
  /** Display name → first initial. Falls back to "?" when missing. */
  name?: string | null;
  size?: number;
  className?: string;
}

export function Avatar({ seed, name, size = 36, className }: AvatarProps) {
  const idx = hashSeed(seed || 'anon') % PALETTE.length;
  const [from, to] = PALETTE[idx];
  const initial = (name?.trim()?.charAt(0) || '?').toUpperCase();

  return (
    <div
      className={clsx('inline-flex items-center justify-center rounded-full font-semibold text-white shrink-0', className)}
      style={{
        width: size, height: size,
        background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`,
        fontSize: Math.round(size * 0.42),
      }}
      aria-hidden
    >
      {initial}
    </div>
  );
}
