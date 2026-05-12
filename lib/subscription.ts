// Subscription tier helpers.
//
// One file decides every "is this user paid?" question across the app so
// gating doesn't drift. The DB columns we read from are populated by
// /api/stripe/webhook on customer.subscription.* events.
//
// Tier semantics (matches what Stripe + the pricing page render):
//   - 'free'    : default for anyone without an active subscription
//   - 'pro'     : monthly/annual paid plan (the only paid tier today)
//
// Status is the Stripe subscription status verbatim:
//   active, trialing, past_due, canceled, incomplete, ...
// We treat active + trialing as "paid"; everything else falls back to free.

export type Tier = 'free' | 'pro';

export interface SubscriptionFields {
  subscription_status?: string | null;
  subscription_tier?: string | null;
  subscription_current_period_end?: string | null;
}

const PAID_STATUSES = new Set(['active', 'trialing']);

export function resolveTier(profile: SubscriptionFields | null | undefined): Tier {
  if (!profile) return 'free';
  const status = profile.subscription_status?.toLowerCase() || '';
  if (!PAID_STATUSES.has(status)) return 'free';
  // Period-end is the safety net: if Stripe webhook flipped status='active'
  // but the period has elapsed and the renewal webhook hasn't landed yet,
  // we still treat the user as paid for up to 24h grace. After that, free.
  const endIso = profile.subscription_current_period_end;
  if (endIso) {
    const end = new Date(endIso).getTime();
    if (Number.isFinite(end) && Date.now() > end + 24 * 3600_000) return 'free';
  }
  return 'pro';
}

export function isPaid(profile: SubscriptionFields | null | undefined): boolean {
  return resolveTier(profile) === 'pro';
}

// Per-tier soft limits. The rate-limit module reads these via tierLimit() so
// new ceilings flow through to every gated route in one place.
export const TIER_LIMITS = {
  free: {
    protocolGensPerDay: 1,        // 1 manual regen / day; cron still runs daily
    chatMessagesPerHour: 10,
    mealAnalyzesPerDay: 3,
    parseBloodworkPerHour: 3,
    voiceLogsPerHour: 20,
  },
  pro: {
    protocolGensPerDay: 6,        // 2× the previous platform default
    chatMessagesPerHour: 60,
    mealAnalyzesPerDay: 30,
    parseBloodworkPerHour: 10,
    voiceLogsPerHour: 60,
  },
} as const;

export type LimitKey = keyof typeof TIER_LIMITS['free'];

export function tierLimit(tier: Tier, key: LimitKey): number {
  return TIER_LIMITS[tier][key];
}
