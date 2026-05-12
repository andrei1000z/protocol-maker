import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient, logAudit } from '@/lib/supabase/admin';
import { sendPushToUser, pushConfigured } from '@/lib/push';
import { logger, describeError } from '@/lib/logger';

export const runtime = 'nodejs';

// POST /api/push/send — internal endpoint used by cron jobs to fan out a
// notification to every subscription for a given user, or to ALL opted-in
// users when `broadcast: true` is set.
//
// Auth: requires Bearer $CRON_SECRET in Authorization header — same gate
// as the cron routes. This is intentionally NOT a user-callable endpoint;
// it can only be invoked from a trusted server context. A user-triggered
// "test push" goes through the Settings card directly without this route.

const BodySchema = z.union([
  // Single-user mode.
  z.object({
    userId: z.string().uuid(),
    payload: z.object({
      title: z.string().min(1).max(120),
      body: z.string().max(400).optional(),
      url: z.string().max(400).optional(),
      tag: z.string().max(60).optional(),
      icon: z.string().max(200).optional(),
      renotify: z.boolean().optional(),
    }),
  }),
  // Broadcast mode — sends to every opted-in user. Use sparingly.
  z.object({
    broadcast: z.literal(true),
    payload: z.object({
      title: z.string().min(1).max(120),
      body: z.string().max(400).optional(),
      url: z.string().max(400).optional(),
      tag: z.string().max(60).optional(),
      icon: z.string().max(200).optional(),
      renotify: z.boolean().optional(),
    }),
  }),
]);

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!pushConfigured()) {
    return NextResponse.json({ error: 'Push not configured (VAPID keys missing)' }, { status: 501 });
  }

  try {
    const raw = await request.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body', issues: parsed.error.flatten() }, { status: 400 });
    }

    const admin = createAdminClient();

    if ('broadcast' in parsed.data) {
      // Broadcast — every user with at least one subscription row.
      const { data: rows } = await admin
        .from('push_subscriptions')
        .select('user_id');
      const userIds = Array.from(new Set((rows || []).map(r => r.user_id))) as string[];

      let totalSent = 0;
      let totalFailed = 0;
      for (let i = 0; i < userIds.length; i += 10) {
        const batch = userIds.slice(i, i + 10);
        const outcomes = await Promise.allSettled(
          batch.map(uid => sendPushToUser(admin, uid, parsed.data.payload))
        );
        for (const o of outcomes) {
          if (o.status === 'fulfilled') {
            totalSent += o.value.sent;
            totalFailed += o.value.failed;
          } else {
            totalFailed++;
          }
        }
      }

      await logAudit(admin, {
        actor: 'push',
        action: 'broadcast',
        metadata: { userCount: userIds.length, sent: totalSent, failed: totalFailed },
      });

      return NextResponse.json({ ok: true, users: userIds.length, sent: totalSent, failed: totalFailed });
    }

    // Single-user.
    const result = await sendPushToUser(admin, parsed.data.userId, parsed.data.payload);
    await logAudit(admin, {
      actor: 'push',
      action: 'single',
      targetUserId: parsed.data.userId,
      metadata: { sent: result.sent, failed: result.failed },
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    logger.error('push.send_handler_failed', { errorMessage: describeError(err) });
    return NextResponse.json({ error: describeError(err) }, { status: 500 });
  }
}
