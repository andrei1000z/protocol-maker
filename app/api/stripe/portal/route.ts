import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createPortalSession, stripeConfigured } from '@/lib/stripe-api';
import { SITE_URL } from '@/lib/config';
import { logger, describeError } from '@/lib/logger';

export const runtime = 'nodejs';

// POST /api/stripe/portal — returns { url } for the Customer Portal, where
// the user can update payment method, switch plans, cancel, etc. Stripe's
// hosted UI; no card data ever touches us.
//
// The customer id has to be already on file (set by the webhook on first
// subscription event). New users can't open the portal — they need to
// check out first.

export async function POST() {
  if (!stripeConfigured()) {
    return NextResponse.json({ error: 'Stripe not configured yet' }, { status: 501 });
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_customer_id')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile?.subscription_customer_id) {
      return NextResponse.json({ error: 'No Stripe customer on file. Subscribe first.' }, { status: 404 });
    }

    const session = await createPortalSession({
      customerId: profile.subscription_customer_id,
      returnUrl: `${SITE_URL}/settings`,
    });

    return NextResponse.json({ url: session.url, id: session.id });
  } catch (err) {
    logger.error('stripe.portal_failed', { errorMessage: describeError(err) });
    return NextResponse.json({ error: describeError(err) }, { status: 500 });
  }
}
