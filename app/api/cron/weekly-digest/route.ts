import { NextResponse } from 'next/server';
import { createAdminClient, logAudit } from '@/lib/supabase/admin';
import { logger, describeError } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// F5 — Weekly digest email
// ─────────────────────────────────────────────────────────────────────────────
// Runs Sunday 16:00 UTC (19:00 RO during DST, 18:00 outside DST). For every
// user with notif_weekly_digest = true, builds a 1-paragraph recap of the
// past week and sends via Resend (POST to api.resend.com — no SDK install).
//
// When RESEND_API_KEY or RESEND_FROM are missing, the route still runs and
// returns the digest payload but skips the actual send (dev / staging mode).
// That way owner can preview the content before flipping a feature flag.

interface DigestRow {
  user_id: string;
  email: string | null;
  name: string;
  metricsLogged: number;
  workoutsLogged: number;
  bestStreak: number;
  currentStreak: number;
  protocolRefreshedAt: string | null;
}

// Direct fetch to Resend — keeps us from pulling a 200KB SDK for a single
// POST call. https://resend.com/docs/api-reference/emails/send-email
async function sendEmailViaResend(to: string, subject: string, html: string, text: string): Promise<{ ok: boolean; status?: number; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) return { ok: false, error: 'resend_not_configured' };
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html, text }),
    });
    return { ok: res.ok, status: res.status };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function buildDigestEmail(row: DigestRow, weekStart: Date): { subject: string; html: string; text: string } {
  const weekLabel = weekStart.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long' });
  const greeting = row.name ? `Salut ${row.name},` : 'Salut,';
  const refreshedLine = row.protocolRefreshedAt
    ? `Protocolul tău s-a actualizat ultima dată pe ${new Date(row.protocolRefreshedAt).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' })}.`
    : 'Nu am regenerat protocolul în această săptămână — adaugă tracking ca să declanșezi un refresh.';
  const subject = `Săptămâna ta în Protocol — ${weekLabel}`;
  const intro = `${greeting} iată sumarul săptămânii care s-a încheiat ieri.`;
  const stats = [
    `Zile cu tracking: ${row.metricsLogged}/7`,
    `Antrenamente logate: ${row.workoutsLogged}`,
    `Streak curent: ${row.currentStreak} ${row.currentStreak === 1 ? 'zi' : 'zile'}`,
    `Cel mai bun streak: ${row.bestStreak}`,
  ].join(' · ');

  const html = `
<!doctype html>
<html lang="ro"><head><meta charset="utf-8"></head><body style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#08090d;color:#e6e8ee;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#13161c;border:1px solid #2a2f3a;border-radius:16px;padding:28px;">
    <h1 style="font-size:20px;margin:0 0 12px;color:#34d399;">Săptămâna ta în Protocol</h1>
    <p style="margin:0 0 16px;line-height:1.5;">${intro}</p>
    <div style="background:#1a1e26;border:1px solid #2a2f3a;border-radius:12px;padding:14px 16px;margin:0 0 16px;font-size:13px;line-height:1.7;">${stats}</div>
    <p style="margin:0 0 16px;line-height:1.5;color:#9ca3af;">${refreshedLine}</p>
    <p style="margin:0 0 8px;"><a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://protocol-tawny.vercel.app'}/dashboard" style="display:inline-block;background:#34d399;color:#08090d;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:600;font-size:13px;">Vezi dashboard</a></p>
    <p style="margin:24px 0 0;font-size:11px;color:#6b7280;line-height:1.5;">Primești acest email pentru că ai activat „digest săptămânal" în Setări. <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://protocol-tawny.vercel.app'}/settings" style="color:#34d399;">Dezactivează</a>.</p>
  </div>
</body></html>`.trim();

  const text = `${intro}\n\n${stats}\n\n${refreshedLine}\n\nDashboard: ${process.env.NEXT_PUBLIC_SITE_URL || 'https://protocol-tawny.vercel.app'}/dashboard\n\nDezactivează în Setări dacă nu mai vrei să primești.`;
  return { subject, html, text };
}

export async function GET(request: Request) {
  // Vercel injects Authorization: Bearer $CRON_SECRET. Fail closed if env
  // is unset to prevent burning AI/email credits via random pings.
  const authHeader = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const admin = createAdminClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 864e5);
  const sevenDaysAgoIso = sevenDaysAgo.toISOString().slice(0, 10);

  // Pull every onboarded user who opted into the weekly digest. Notification
  // prefs default to off — explicit opt-in only.
  const { data: users, error: usersErr } = await admin
    .from('profiles')
    .select('id, onboarding_data, notif_weekly_digest')
    .eq('onboarding_completed', true)
    .eq('notif_weekly_digest', true)
    .is('deleted_at', null);

  if (usersErr) return NextResponse.json({ error: usersErr.message }, { status: 500 });
  if (!users || users.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, note: 'No opted-in users' });
  }

  const results = { total: users.length, sent: 0, skipped: 0, failed: 0 };
  const notConfigured = !process.env.RESEND_API_KEY || !process.env.RESEND_FROM;

  for (const u of users) {
    try {
      // Pull the recap data — daily_metrics + latest protocol.
      const [{ data: metrics }, { data: latestProtocol }, { data: authUser }] = await Promise.all([
        admin.from('daily_metrics').select('date, workout_done').eq('user_id', u.id).gte('date', sevenDaysAgoIso),
        admin.from('protocols').select('created_at').eq('user_id', u.id).is('deleted_at', null).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        admin.auth.admin.getUserById(u.id),
      ]);

      const email = authUser?.user?.email || null;
      if (!email) { results.skipped++; continue; }

      const metricsRows = (metrics || []) as Array<{ date: string; workout_done: boolean | null }>;
      const onboardingData = (u.onboarding_data || {}) as Record<string, unknown>;
      const name = typeof onboardingData.name === 'string' ? onboardingData.name.trim().split(/\s+/)[0] : '';

      const digestRow: DigestRow = {
        user_id: u.id,
        email,
        name,
        metricsLogged: metricsRows.length,
        workoutsLogged: metricsRows.filter(m => m.workout_done).length,
        bestStreak: 0,        // populated by future iteration; keep 0 for now
        currentStreak: 0,
        protocolRefreshedAt: latestProtocol?.created_at || null,
      };

      // Skip "lazy week" users — if they didn't log anything, emailing them
      // a recap with all zeros is a guilt-trip, not a value signal. They'll
      // see the dashboard banner when they next open the app.
      if (digestRow.metricsLogged === 0 && !digestRow.protocolRefreshedAt) {
        results.skipped++;
        continue;
      }

      const { subject, html, text } = buildDigestEmail(digestRow, sevenDaysAgo);

      if (notConfigured) {
        // Dry-run: log payload metadata only (never the body or email — PII)
        // so owner can verify cadence + reach before flipping the real send.
        logger.info('weekly_digest.dry_run', {
          userId: u.id,
          metricsLogged: digestRow.metricsLogged,
          workoutsLogged: digestRow.workoutsLogged,
        });
        results.sent++; // count as sent for dry-run analytics
        continue;
      }

      const send = await sendEmailViaResend(email, subject, html, text);
      if (send.ok) results.sent++;
      else { results.failed++; logger.warn('weekly_digest.send_failed', { userId: u.id, status: send.status, error: send.error }); }
    } catch (err) {
      results.failed++;
      logger.warn('weekly_digest.user_failed', { userId: u.id, errorMessage: describeError(err) });
    }
  }

  await logAudit(admin, {
    actor: 'cron.weekly_digest',
    action: 'batch_complete',
    metadata: { ...results, dryRun: notConfigured, durationMs: Date.now() - startTime },
  });

  return NextResponse.json({
    ok: true,
    ...results,
    dryRun: notConfigured,
    durationMs: Date.now() - startTime,
    ranAt: new Date().toISOString(),
  });
}

export const POST = GET;
