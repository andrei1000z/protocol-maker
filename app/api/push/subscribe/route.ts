import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { logger, describeError } from '@/lib/logger';

export const runtime = 'nodejs';

// Validate the subscription payload the browser hands us via PushManager.
// All three keys are required for the web-push library to encrypt the
// outbound message on the server side.
const SubscribeSchema = z.object({
  endpoint: z.string().url().max(600),
  keys: z.object({
    p256dh: z.string().min(20).max(200),
    auth: z.string().min(8).max(60),
  }),
  ua: z.string().max(300).optional(),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const raw = await request.json().catch(() => null);
    const parsed = SubscribeSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid subscription', issues: parsed.error.flatten() }, { status: 400 });
    }
    const { endpoint, keys, ua } = parsed.data;

    // Upsert by (user_id, endpoint) so subscribing twice from the same
    // browser doesn't create duplicate rows. failure_count resets on resub.
    const { error } = await supabase.from('push_subscriptions').upsert({
      user_id: user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      ua: ua || null,
      last_used_at: new Date().toISOString(),
      failure_count: 0,
    }, { onConflict: 'user_id,endpoint' });

    if (error) {
      logger.error('push.subscribe_failed', { userId: user.id, errorMessage: error.message });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('push.subscribe_handler_failed', { errorMessage: describeError(err) });
    return NextResponse.json({ error: describeError(err) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { endpoint } = await request.json().catch(() => ({}));
    if (!endpoint || typeof endpoint !== 'string') {
      return NextResponse.json({ error: 'endpoint required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', user.id)
      .eq('endpoint', endpoint);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: describeError(err) }, { status: 500 });
  }
}
