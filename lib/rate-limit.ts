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

export async function checkRateLimit(
  limiter: Ratelimit | null,
  identifier: string
): Promise<{ allowed: boolean; limit?: number; remaining?: number; reset?: number }> {
  if (!limiter) return { allowed: true }; // No rate limiting configured → allow all
  const result = await limiter.limit(identifier);
  return {
    allowed: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  };
}
