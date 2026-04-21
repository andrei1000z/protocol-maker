import { describe, test, expect } from 'vitest';
import crypto from 'node:crypto';
import { verifyStripeWebhook, subscriptionPatchFromEvent } from '@/lib/stripe-webhook';

// Helpers replicate the signature Stripe sends so tests don't need the SDK.
function sign(body: string, secret: string, ts = Math.floor(Date.now() / 1000)) {
  const signedPayload = `${ts}.${body}`;
  const v1 = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  return { header: `t=${ts},v1=${v1}`, ts };
}

const SECRET = 'whsec_test_fixture_123456789';

describe('verifyStripeWebhook', () => {
  test('rejects missing header', () => {
    const r = verifyStripeWebhook('{}', null, SECRET);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('missing_header');
  });

  test('rejects malformed header', () => {
    const r = verifyStripeWebhook('{}', 'garbage', SECRET);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('malformed_header');
  });

  test('rejects stale timestamp', () => {
    const body = JSON.stringify({ id: 'evt_1', type: 'ping' });
    const { header } = sign(body, SECRET, Math.floor(Date.now() / 1000) - 3600); // 1h old
    const r = verifyStripeWebhook(body, header, SECRET);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('stale_timestamp');
  });

  test('rejects bad signature', () => {
    const body = JSON.stringify({ id: 'evt_1', type: 'ping' });
    const { ts } = sign(body, SECRET);
    const badHeader = `t=${ts},v1=deadbeef`;
    const r = verifyStripeWebhook(body, badHeader, SECRET);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('bad_signature');
  });

  test('accepts correctly-signed event', () => {
    const body = JSON.stringify({ id: 'evt_1', type: 'customer.subscription.created', created: 1, data: { object: {} } });
    const { header } = sign(body, SECRET);
    const r = verifyStripeWebhook(body, header, SECRET);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.event.id).toBe('evt_1');
      expect(r.event.type).toBe('customer.subscription.created');
    }
  });

  test('handles multiple v1 signatures (key rotation)', () => {
    const body = JSON.stringify({ id: 'evt_2', type: 'ping', created: 1, data: { object: {} } });
    const ts = Math.floor(Date.now() / 1000);
    const goodV1 = crypto.createHmac('sha256', SECRET).update(`${ts}.${body}`).digest('hex');
    // Stripe may send multiple v1 entries during key rotation. Ours must be present.
    const header = `t=${ts},v1=baadf00d,v1=${goodV1}`;
    const r = verifyStripeWebhook(body, header, SECRET);
    expect(r.ok).toBe(true);
  });
});

describe('subscriptionPatchFromEvent', () => {
  const mkEvent = (type: string, obj: Record<string, unknown>) => ({
    id: 'evt_test',
    type,
    created: 1,
    data: { object: obj },
  });

  test('subscription.created maps to active status', () => {
    const patch = subscriptionPatchFromEvent(mkEvent('customer.subscription.created', {
      metadata: { userId: 'uuid-1', tier: 'plus' },
      customer: 'cus_123',
      status: 'active',
      current_period_end: 1735689600,
    }));
    expect(patch?.userId).toBe('uuid-1');
    expect(patch?.subscription_status).toBe('active');
    expect(patch?.subscription_tier).toBe('plus');
    expect(patch?.subscription_customer_id).toBe('cus_123');
    expect(patch?.subscription_current_period_end).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  test('subscription.deleted always ends with canceled', () => {
    const patch = subscriptionPatchFromEvent(mkEvent('customer.subscription.deleted', {
      metadata: { userId: 'uuid-1' },
      status: 'active', // even if status says active, deletion → canceled
    }));
    expect(patch?.subscription_status).toBe('canceled');
  });

  test('invoice.payment_failed → past_due', () => {
    const patch = subscriptionPatchFromEvent(mkEvent('invoice.payment_failed', {
      metadata: { userId: 'uuid-1' },
    }));
    expect(patch?.subscription_status).toBe('past_due');
  });

  test('unrelated events return null', () => {
    const patch = subscriptionPatchFromEvent(mkEvent('customer.updated', {
      metadata: { userId: 'uuid-1' },
    }));
    expect(patch).toBeNull();
  });

  test('missing metadata.userId is allowed but userId is null', () => {
    const patch = subscriptionPatchFromEvent(mkEvent('customer.subscription.created', {
      status: 'active',
    }));
    expect(patch).not.toBeNull();
    expect(patch?.userId).toBeNull();
  });
});
