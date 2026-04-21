// Stripe webhook signature verification + event handling — scaffold.
//
// Written without the @stripe/stripe-node dependency: Stripe documents the
// signature algorithm, so we can verify it with Node's built-in crypto. The
// trade-off is we don't get typed event objects — we read fields defensively
// via `(evt as Record<string, unknown>)` instead. When traffic grows enough
// to warrant full billing flows, swap in the SDK for typed events + API
// calls to Stripe from server actions (customer.retrieve, etc.).
//
// Signature algorithm:
//   1. Header Stripe-Signature: `t=<timestamp>,v1=<signature>,[v0=<legacy>]`
//   2. signed_payload = `${t}.${raw_body}`
//   3. expected = HMAC-SHA256(STRIPE_WEBHOOK_SECRET, signed_payload)
//   4. constant-time compare(expected, v1)
//
// Reject if:
//   - header missing or malformed
//   - timestamp older than 5 minutes (replay protection)
//   - signature mismatch

import crypto from 'node:crypto';

export interface VerifiedEvent {
  id: string;
  type: string;
  created: number;
  /** Raw event body parsed as JSON. Shape is event-dependent. */
  data: { object: Record<string, unknown> };
}

export type VerifyResult =
  | { ok: true; event: VerifiedEvent }
  | { ok: false; reason: 'missing_header' | 'malformed_header' | 'stale_timestamp' | 'bad_signature' | 'bad_body' };

/** Verify a Stripe-signed webhook. `rawBody` MUST be the exact bytes the
 *  server received — re-stringifying a parsed object breaks the HMAC. */
export function verifyStripeWebhook(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  tolerance = 5 * 60, // seconds
): VerifyResult {
  if (!signatureHeader) return { ok: false, reason: 'missing_header' };

  // Header looks like: "t=1648212345,v1=abc123,v1=def456". Duplicate v1
  // entries are allowed (Stripe rotates keys) so collect them all.
  const parts = signatureHeader.split(',').map(p => p.trim());
  let timestamp: number | null = null;
  const signatures: string[] = [];
  for (const part of parts) {
    const [k, v] = part.split('=');
    if (k === 't' && v) timestamp = parseInt(v, 10);
    else if (k === 'v1' && v) signatures.push(v);
  }
  if (timestamp === null || !Number.isFinite(timestamp) || signatures.length === 0) {
    return { ok: false, reason: 'malformed_header' };
  }

  // Replay-attack guard.
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - timestamp) > tolerance) {
    return { ok: false, reason: 'stale_timestamp' };
  }

  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  const expectedBuf = Buffer.from(expected, 'hex');

  let match = false;
  for (const sig of signatures) {
    try {
      const sigBuf = Buffer.from(sig, 'hex');
      // timingSafeEqual throws on length mismatch, which itself is a mismatch.
      if (sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf)) {
        match = true;
        break;
      }
    } catch { /* malformed hex — treat as no match */ }
  }
  if (!match) return { ok: false, reason: 'bad_signature' };

  try {
    const parsed = JSON.parse(rawBody) as Record<string, unknown>;
    return {
      ok: true,
      event: {
        id: String(parsed.id ?? ''),
        type: String(parsed.type ?? ''),
        created: Number(parsed.created ?? timestamp),
        data: parsed.data as { object: Record<string, unknown> } ?? { object: {} },
      },
    };
  } catch {
    return { ok: false, reason: 'bad_body' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Subscription-event → profile update mapping.
// ─────────────────────────────────────────────────────────────────────────────
// We care about the lifecycle that affects tier gating:
//   - customer.subscription.created  → 'active' | 'trialing'
//   - customer.subscription.updated  → status flip (e.g. trial → active → past_due)
//   - customer.subscription.deleted  → 'canceled'
//   - invoice.payment_failed         → 'past_due' (backup signal)
// Everything else we log + ignore.

export interface SubscriptionPatch {
  subscription_status: string | null;
  subscription_tier: string | null;
  subscription_customer_id: string | null;
  subscription_current_period_end: string | null;
  /** Where on the user we should write. Matches profiles.id (= auth.users.id). */
  userId: string | null;
}

/** Extract a patch to apply to the profiles row. Returns null if we can't
 *  determine the user — the caller should log it and let Stripe retry. */
export function subscriptionPatchFromEvent(event: VerifiedEvent): SubscriptionPatch | null {
  const obj = event.data.object as Record<string, unknown>;

  // Stripe lets you pass arbitrary metadata on Checkout sessions + subscriptions.
  // We require `metadata.userId` to be present — without it we can't tie the
  // subscription to a user. All checkout creation code must set this.
  const metadata = (obj.metadata ?? {}) as Record<string, unknown>;
  const userId = typeof metadata.userId === 'string' ? metadata.userId : null;
  const customerId = typeof obj.customer === 'string' ? obj.customer : null;

  const status = typeof obj.status === 'string' ? obj.status : null;
  const periodEnd = typeof obj.current_period_end === 'number'
    ? new Date(obj.current_period_end * 1000).toISOString()
    : null;

  // Tier can live on the subscription's metadata, OR be inferred from the
  // price id. Keep it simple: read from metadata.tier if present, else null.
  const tier = typeof metadata.tier === 'string' ? metadata.tier : null;

  if (event.type === 'customer.subscription.deleted') {
    return {
      userId, subscription_customer_id: customerId,
      subscription_status: 'canceled',
      subscription_tier: tier,
      subscription_current_period_end: periodEnd,
    };
  }

  if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
    return {
      userId, subscription_customer_id: customerId,
      subscription_status: status,
      subscription_tier: tier,
      subscription_current_period_end: periodEnd,
    };
  }

  if (event.type === 'invoice.payment_failed') {
    return {
      userId, subscription_customer_id: customerId,
      subscription_status: 'past_due',
      subscription_tier: tier,
      subscription_current_period_end: null,
    };
  }

  return null;
}
