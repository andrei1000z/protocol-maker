import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Only create rate limiter if Upstash env vars are set. Cached per-kind so we
// don't reconstruct the Ratelimit client on every request (keeps the Redis
// connection warm + matches the original single-limiter memoization pattern).
let ratelimit: Ratelimit | null = null;
let chatRatelimit: Ratelimit | null = null;
let dailyMetricsRatelimit: Ratelimit | null = null;
let chatActionRatelimit: Ratelimit | null = null;
let parseBloodworkRatelimit: Ratelimit | null = null;
let saveBloodtestRatelimit: Ratelimit | null = null;
let complianceRatelimit: Ratelimit | null = null;
let saveProfileRatelimit: Ratelimit | null = null;

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export function getProtocolRateLimit(): Ratelimit | null {
  if (ratelimit) return ratelimit;
  const redis = getRedis();
  if (!redis) return null;
  ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, '1 d'), // 3 generations per day
    prefix: 'protocol',
  });
  return ratelimit;
}

export function getChatRateLimit(): Ratelimit | null {
  if (chatRatelimit) return chatRatelimit;
  const redis = getRedis();
  if (!redis) return null;
  chatRatelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, '1 h'), // 30 chat messages per hour
    prefix: 'chat',
  });
  return chatRatelimit;
}

// Daily-metrics POST: legitimate heavy logging (user can sync wearable +
// self-log multiple fields in a single session). 200/hour = ~3/min sustained
// which still comfortably covers a burst sync, but blocks spam loops.
export function getDailyMetricsRateLimit(): Ratelimit | null {
  if (dailyMetricsRatelimit) return dailyMetricsRatelimit;
  const redis = getRedis();
  if (!redis) return null;
  dailyMetricsRatelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(200, '1 h'),
    prefix: 'daily_metrics',
  });
  return dailyMetricsRatelimit;
}

// Chat-action chip apply: user confirms an AI suggestion, one click per chip.
// 60/hour is generous (chat limiter caps at 30 msgs/h, each can yield multiple
// actions, so 60 is 2× worst-case without breaking normal usage).
export function getChatActionRateLimit(): Ratelimit | null {
  if (chatActionRatelimit) return chatActionRatelimit;
  const redis = getRedis();
  if (!redis) return null;
  chatActionRatelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, '1 h'),
    prefix: 'chat_action',
  });
  return chatActionRatelimit;
}

// Parse-bloodwork: Groq PDF parse. Most expensive unmetered surface. Users
// upload 1-2 PDFs per retest cycle (quarterly). 20/hour is extremely generous
// for legit use and hard-caps abuse at ~$0.20/hour/user worst case.
export function getParseBloodworkRateLimit(): Ratelimit | null {
  if (parseBloodworkRatelimit) return parseBloodworkRatelimit;
  const redis = getRedis();
  if (!redis) return null;
  parseBloodworkRatelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '1 h'),
    prefix: 'parse_bloodwork',
  });
  return parseBloodworkRatelimit;
}

// Save-bloodtest: same-day replace semantics (server dedupes). 10/hour lets
// a user retry after failed parse but blocks scripting.
export function getSaveBloodtestRateLimit(): Ratelimit | null {
  if (saveBloodtestRatelimit) return saveBloodtestRatelimit;
  const redis = getRedis();
  if (!redis) return null;
  saveBloodtestRatelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 h'),
    prefix: 'save_bloodtest',
  });
  return saveBloodtestRatelimit;
}

// Compliance log toggles: user ticks habits/supplements/etc. 200/hour matches
// daily_metrics budget — power user with 40 items checks each twice a day is
// ~80/day, so 200/hour handles the worst rage-click.
export function getComplianceRateLimit(): Ratelimit | null {
  if (complianceRatelimit) return complianceRatelimit;
  const redis = getRedis();
  if (!redis) return null;
  complianceRatelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(200, '1 h'),
    prefix: 'compliance',
  });
  return complianceRatelimit;
}

// Save-profile: full profile write. Onboarding saves per-step + settings
// edits occasionally. 20/hour covers both without enabling writestorms.
export function getSaveProfileRateLimit(): Ratelimit | null {
  if (saveProfileRatelimit) return saveProfileRatelimit;
  const redis = getRedis();
  if (!redis) return null;
  saveProfileRatelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '1 h'),
    prefix: 'save_profile',
  });
  return saveProfileRatelimit;
}

// Bypass allowlist — founders / admins get unlimited generations.
// Configure via env: RATE_LIMIT_BYPASS_USER_IDS and/or RATE_LIMIT_BYPASS_EMAILS
// (comma-separated). Matches are case-insensitive for emails.
function isBypassed(userId: string, email?: string | null): boolean {
  const idList = (process.env.RATE_LIMIT_BYPASS_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (idList.includes(userId)) return true;
  if (email) {
    const emailList = (process.env.RATE_LIMIT_BYPASS_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    if (emailList.includes(email.toLowerCase())) return true;
  }
  return false;
}

export async function checkRateLimit(
  limiter: Ratelimit | null,
  identifier: string,
  email?: string | null
): Promise<{ allowed: boolean; limit?: number; remaining?: number; reset?: number; bypassed?: boolean }> {
  // GLOBAL KILL SWITCH: set RATE_LIMIT_DISABLED=true to disable all rate limiting.
  // Also disabled by default (unset env var is treated as "disabled" during dev/founder mode).
  // Flip to 'false' explicitly to re-enable the 3/day + 30/hour limits.
  if (process.env.RATE_LIMIT_DISABLED !== 'false') {
    return { allowed: true, bypassed: true };
  }
  if (!limiter) return { allowed: true };
  if (isBypassed(identifier, email)) return { allowed: true, bypassed: true };
  const result = await limiter.limit(identifier);
  return {
    allowed: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  };
}
