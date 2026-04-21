// Stripe webhook receiver.
//
// Scaffold only — this route is a no-op until `STRIPE_WEBHOOK_SECRET` is
// configured in the environment. That keeps the route safe to deploy today
// (it refuses to mutate the DB without a configured secret) while giving
// us the endpoint URL to paste into Stripe Dashboard → Webhooks when we
// flip billing on.
//
// Signature verification lives in lib/stripe-webhook.ts so it's unit-
// testable independent of the route. Event → profile mapping does too.
//
// The route uses the admin Supabase client because webhooks are server-to-
// server and bypass the authed user context. RLS is force-enabled on
// profiles, so the admin client is required to write without impersonating.

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger, describeError } from '@/lib/logger';
import { verifyStripeWebhook, subscriptionPatchFromEvent } from '@/lib/stripe-webhook';

// Stripe needs the raw body bytes to verify the signature — Next's JSON
// body parsing would destroy that. Force the route to receive raw text.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    // Billing isn't wired yet. Return 501 so Stripe-side dashboard shows
    // a clear "not implemented" response in the event log instead of the
    // misleading 200 an empty handler would give. Ops can grep this event
    // to know billing is still gated.
    logger.warn('stripe.webhook_received_without_secret');
    return NextResponse.json({ error: 'Stripe webhook secret not configured' }, { status: 501 });
  }

  const rawBody = await request.text();  // MUST be raw — never request.json() here
  const signature = request.headers.get('stripe-signature');
  const verified = verifyStripeWebhook(rawBody, signature, secret);

  if (!verified.ok) {
    logger.warn('stripe.webhook_verification_failed', { reason: verified.reason });
    return NextResponse.json({ error: `Signature check failed: ${verified.reason}` }, { status: 400 });
  }

  const { event } = verified;

  // Map the event to a profile patch. Returns null for event types we don't
  // care about (e.g. customer.updated with no subscription change) — those
  // are logged + acknowledged without a DB write.
  const patch = subscriptionPatchFromEvent(event);
  if (!patch) {
    logger.info('stripe.webhook_ignored', { type: event.type, id: event.id });
    return NextResponse.json({ received: true, ignored: true });
  }
  if (!patch.userId) {
    // Metadata.userId wasn't set when the subscription was created. This is
    // a bug in checkout session creation — without it we can't tie the
    // subscription to a user. Log loudly so the bug is visible.
    logger.error('stripe.webhook_missing_user_id', { type: event.type, id: event.id, customerId: patch.subscription_customer_id });
    return NextResponse.json({ error: 'Event missing metadata.userId' }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const updates: Record<string, unknown> = {};
    if (patch.subscription_status !== null) updates.subscription_status = patch.subscription_status;
    if (patch.subscription_tier !== null) updates.subscription_tier = patch.subscription_tier;
    if (patch.subscription_customer_id !== null) updates.subscription_customer_id = patch.subscription_customer_id;
    if (patch.subscription_current_period_end !== null) updates.subscription_current_period_end = patch.subscription_current_period_end;
    updates.updated_at = new Date().toISOString();

    const { error } = await admin.from('profiles').update(updates).eq('id', patch.userId);
    if (error) throw new Error(error.message);

    logger.info('stripe.webhook_applied', {
      type: event.type,
      id: event.id,
      userId: patch.userId,
      status: patch.subscription_status,
      tier: patch.subscription_tier,
    });
    return NextResponse.json({ received: true });
  } catch (err) {
    logger.error('stripe.webhook_apply_failed', { type: event.type, id: event.id, errorMessage: describeError(err) });
    // Return 500 so Stripe retries. The event is idempotent if our DB
    // update is — subscription_status is a simple overwrite.
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
