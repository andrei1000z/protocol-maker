import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Only create rate limiter if Upstash env vars are set
let ratelimit: Ratelimit | null = null;
let chatRatelimit: Ratelimit | null = null;

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
