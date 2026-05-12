// Server-side push helper.
//
// Wraps the `web-push` library so the rest of the codebase can do
//   await sendPushToUser(admin, userId, { title, body, url })
// and never has to think about VAPID, encryption, dead-endpoint pruning, or
// fan-out across multiple devices.
//
// All paths fail closed when VAPID env vars aren't set: pushConfigured()
// returns false and senders no-op with a logger.info entry. That keeps the
// Settings card + cron triggers safe to deploy before keys exist.

import webpush from 'web-push';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

let vapidReady = false;

export interface PushPayload {
  title: string;
  body?: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
  renotify?: boolean;
}

export function pushConfigured(): boolean {
  return !!(
    process.env.VAPID_PRIVATE_KEY &&
    (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY) &&
    process.env.VAPID_SUBJECT
  );
}

function ensureVapid(): boolean {
  if (vapidReady) return true;
  if (!pushConfigured()) return false;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY!;
  const privateKey = process.env.VAPID_PRIVATE_KEY!;
  const subject = process.env.VAPID_SUBJECT!;  // 'mailto:you@example.com' or your site URL
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidReady = true;
  return true;
}

interface PushSubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth: string;
  failure_count?: number | null;
}

interface SendResult {
  endpoint: string;
  ok: boolean;
  statusCode?: number;
  error?: string;
}

// Fan-out: load every active subscription for the user, send to each, and
// soft-evict endpoints that return 410/404 (Gone / Not Found) — those are
// the browser telling us "this subscription is dead, stop trying".
export async function sendPushToUser(
  admin: SupabaseClient,
  userId: string,
  payload: PushPayload,
): Promise<{ sent: number; failed: number; results: SendResult[] }> {
  if (!ensureVapid()) {
    logger.info('push.send_skipped_not_configured', { userId });
    return { sent: 0, failed: 0, results: [] };
  }

  const { data: rows } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth, failure_count')
    .eq('user_id', userId);

  const subs = (rows || []) as PushSubscriptionRow[];
  if (subs.length === 0) return { sent: 0, failed: 0, results: [] };

  const body = JSON.stringify(payload);

  const results: SendResult[] = await Promise.all(
    subs.map(async (sub): Promise<SendResult> => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body,
          { TTL: 3600 },  // 1h — beyond that the message is no longer relevant
        );
        // Bump last_used_at + reset failure count.
        await admin
          .from('push_subscriptions')
          .update({ last_used_at: new Date().toISOString(), failure_count: 0 })
          .eq('user_id', userId)
          .eq('endpoint', sub.endpoint);
        return { endpoint: sub.endpoint, ok: true };
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        const message = err instanceof Error ? err.message : String(err);

        // 410 Gone / 404 Not Found = endpoint is dead, prune it immediately.
        if (statusCode === 410 || statusCode === 404) {
          await admin
            .from('push_subscriptions')
            .delete()
            .eq('user_id', userId)
            .eq('endpoint', sub.endpoint);
        } else {
          // Soft eviction after 3 consecutive non-gone failures (server outage etc.)
          const nextFailure = (sub.failure_count ?? 0) + 1;
          await admin
            .from('push_subscriptions')
            .update({ failure_count: nextFailure })
            .eq('user_id', userId)
            .eq('endpoint', sub.endpoint);
          if (nextFailure > 3) {
            await admin
              .from('push_subscriptions')
              .delete()
              .eq('user_id', userId)
              .eq('endpoint', sub.endpoint);
          }
        }
        return { endpoint: sub.endpoint, ok: false, statusCode, error: message.slice(0, 200) };
      }
    }),
  );

  return {
    sent: results.filter(r => r.ok).length,
    failed: results.filter(r => !r.ok).length,
    results,
  };
}
