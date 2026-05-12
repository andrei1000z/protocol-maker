import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createCheckoutSession, stripeConfigured } from '@/lib/stripe-api';
import { SITE_URL } from '@/lib/config';
import { logger, describeError } from '@/lib/logger';

export const runtime = 'nodejs';

// POST /api/stripe/checkout — returns { url } for a Stripe-hosted checkout.
// Client redirects via window.location.assign(url). The hosted page handles
// card collection + 3DS; we never see the card details.
//
// Required env: STRIPE_SECRET_KEY, STRIPE_PRICE_ID. Optional: STRIPE_TRIAL_DAYS.
// Until those are set, the route returns 501 so the pricing-page button can
// degrade to a "Coming soon" state without crashing.

export async function POST(request: Request) {
  if (!stripeConfigured()) {
    return NextResponse.json({ error: 'Stripe not configured yet' }, { status: 501 });
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    // Look up an existing Stripe customer id (set by webhook on first sub).
    // Re-using the customer keeps tax + payment methods consistent across
    // multiple subscriptions over the user's lifetime.
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_customer_id, subscription_status')
      .eq('id', user.id)
      .maybeSingle();

    // Don't allow stacking — if already on an active sub, redirect to portal
    // instead of creating a second one.
    if (profile?.subscription_status === 'active' || profile?.subscription_status === 'trialing') {
      return NextResponse.json({ error: 'Already subscribed. Use the customer portal to manage your plan.' }, { status: 409 });
    }

    const priceId = process.env.STRIPE_PRICE_ID!;
    const trialDays = Number(process.env.STRIPE_TRIAL_DAYS || 0) || undefined;

    const body = await request.json().catch(() => ({}));
    const successUrl = `${SITE_URL}${(body.successPath as string) || '/settings?subscription=success'}`;
    const cancelUrl = `${SITE_URL}${(body.cancelPath as string) || '/pricing?canceled=1'}`;

    const session = await createCheckoutSession({
      priceId,
      successUrl,
      cancelUrl,
      userId: user.id,
      email: user.email,
      existingCustomerId: profile?.subscription_customer_id || null,
      tier: 'pro',
      trialDays,
    });

    return NextResponse.json({ url: session.url, id: session.id });
  } catch (err) {
    logger.error('stripe.checkout_failed', { errorMessage: describeError(err) });
    return NextResponse.json({ error: describeError(err) }, { status: 500 });
  }
}
