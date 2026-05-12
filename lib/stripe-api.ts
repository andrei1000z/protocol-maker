// Direct Stripe API wrapper — no SDK install.
//
// Why no SDK: `stripe` is ~3MB unpacked and pulls in node:https specifics
// that complicate edge-runtime experiments. Stripe's REST API takes form-
// urlencoded bodies and returns JSON; that's three lines per call.
//
// We use this for Checkout + Customer Portal session creation. Webhooks
// stay handled by lib/stripe-webhook.ts (signature-verify via node:crypto).
// Everything fails closed when STRIPE_SECRET_KEY is unset, so this module
// is safe to deploy before live keys are provisioned.

import { logger } from '@/lib/logger';

const STRIPE_API_BASE = 'https://api.stripe.com/v1';

function authHeader(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
  // Basic auth: secret key as username, empty password (Stripe convention).
  return `Basic ${Buffer.from(`${key}:`).toString('base64')}`;
}

// Flatten a nested object into Stripe's bracketed form-urlencoded shape.
//   { line_items: [{ price: 'p_1', quantity: 1 }] }
//   → line_items[0][price]=p_1&line_items[0][quantity]=1
function toForm(input: Record<string, unknown>, prefix = ''): string[] {
  const out: string[] = [];
  for (const [key, val] of Object.entries(input)) {
    if (val === null || val === undefined) continue;
    const path = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(val)) {
      val.forEach((item, idx) => {
        if (item && typeof item === 'object') {
          out.push(...toForm(item as Record<string, unknown>, `${path}[${idx}]`));
        } else {
          out.push(`${encodeURIComponent(`${path}[${idx}]`)}=${encodeURIComponent(String(item))}`);
        }
      });
    } else if (typeof val === 'object') {
      out.push(...toForm(val as Record<string, unknown>, path));
    } else {
      out.push(`${encodeURIComponent(path)}=${encodeURIComponent(String(val))}`);
    }
  }
  return out;
}

async function stripeFetch<T = Record<string, unknown>>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${STRIPE_API_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: toForm(body).join('&'),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    logger.warn('stripe.api_error', { path, status: res.status, errorCode: (data as { error?: { code?: string } }).error?.code });
    const message = (data as { error?: { message?: string } }).error?.message || `Stripe ${res.status}`;
    throw new Error(message);
  }
  return data as T;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API — one function per Stripe call we make.
// ─────────────────────────────────────────────────────────────────────────────

export interface CheckoutSession { id: string; url: string; }

export async function createCheckoutSession(opts: {
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  userId: string;
  email?: string | null;
  existingCustomerId?: string | null;
  tier?: string;
  /** Trial days — passed to subscription_data.trial_period_days. */
  trialDays?: number;
}): Promise<CheckoutSession> {
  const body: Record<string, unknown> = {
    mode: 'subscription',
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    line_items: [{ price: opts.priceId, quantity: 1 }],
    // Metadata MUST carry userId — that's how the webhook ties subscription
    // events back to a profile row. Don't ship checkout creation without it.
    metadata: { userId: opts.userId, tier: opts.tier || 'pro' },
    subscription_data: {
      metadata: { userId: opts.userId, tier: opts.tier || 'pro' },
      ...(opts.trialDays && opts.trialDays > 0 ? { trial_period_days: opts.trialDays } : {}),
    },
    // Allow the customer to type promotion codes at checkout — keeps the
    // promo loop simple without us hand-rolling coupon UI.
    allow_promotion_codes: true,
    // Tax computed by Stripe Tax when enabled in the dashboard.
    automatic_tax: { enabled: false },
    billing_address_collection: 'auto',
  };
  if (opts.existingCustomerId) body.customer = opts.existingCustomerId;
  else if (opts.email) body.customer_email = opts.email;
  return stripeFetch<CheckoutSession>('/checkout/sessions', body);
}

export interface PortalSession { id: string; url: string; }

export async function createPortalSession(opts: {
  customerId: string;
  returnUrl: string;
}): Promise<PortalSession> {
  return stripeFetch<PortalSession>('/billing_portal/sessions', {
    customer: opts.customerId,
    return_url: opts.returnUrl,
  });
}

// Helper for the UI — has Stripe been configured at all on this deployment?
export function stripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_PRICE_ID;
}
