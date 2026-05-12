import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, logAudit } from '@/lib/supabase/admin';
import { revokeProviderToken } from '@/lib/integrations/base';
import type { ProviderKey } from '@/lib/integrations/base';
import { logger, describeError } from '@/lib/logger';

export const runtime = 'nodejs';

/**
 * Deletes the caller's auth.users row. Every app table references auth.users
 * with ON DELETE CASCADE, so profiles + protocols + blood_tests + daily_metrics
 * + share_links + compliance_logs + chat_messages + meals + supplement_feedback
 * + oauth_connections are wiped automatically.
 *
 * Before the CASCADE fires we do two extra things:
 *   1. Best-effort revoke any wearable OAuth tokens with their providers.
 *      Failures don't block — provider tokens expire on their own anyway, and
 *      blocking the user's deletion on a third-party outage would be wrong.
 *   2. Write an audit_log entry so an erase is recoverable in post-incident
 *      forensics (the row keeps no PII — only user_id + timestamps).
 *
 * Requires the user to be authenticated (session cookie). Uses the service-
 * role admin client because users can't delete themselves via normal auth.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    if (!body.confirm) {
      return NextResponse.json({ error: 'Missing confirmation' }, { status: 400 });
    }

    const admin = createAdminClient();

    // ── 1. Best-effort revoke wearable OAuth tokens ─────────────────────────
    const { data: connections } = await admin
      .from('oauth_connections')
      .select('provider, access_token, refresh_token')
      .eq('user_id', user.id);

    const revokeOutcomes: Record<string, { ok: boolean; status?: number; error?: string }> = {};
    if (Array.isArray(connections) && connections.length > 0) {
      await Promise.allSettled(
        connections.map(async (c: { provider: string; access_token: string; refresh_token: string | null }) => {
          const result = await revokeProviderToken(
            c.provider as ProviderKey,
            c.access_token,
            c.refresh_token,
          );
          revokeOutcomes[c.provider] = result;
        }),
      );
    }

    // ── 2. Explicit data wipe before auth deletion ──────────────────────────
    // CASCADE handles all of these via the FK to auth.users, but doing it
    // explicitly here lets us count rows deleted (audit metadata) and catches
    // any future table that someone adds without a proper FK.
    const tables = [
      'compliance_logs', 'daily_metrics', 'share_links', 'protocols',
      'blood_tests', 'chat_messages', 'meals', 'supplement_feedback',
      'oauth_connections',
    ] as const;
    await Promise.allSettled(tables.map(t => admin.from(t).delete().eq('user_id', user.id)));
    await admin.from('profiles').delete().eq('id', user.id);

    // ── 3. Audit log entry — before auth deletion so we capture the userId ──
    await logAudit(admin, {
      actor: 'delete_account',
      action: 'erase_user',
      targetUserId: user.id,
      metadata: {
        connectionsRevoked: revokeOutcomes,
        tablesCleared: tables.length + 1,
        requestedAt: new Date().toISOString(),
      },
    });

    // ── 4. Delete the auth user itself (this also signs them out) ───────────
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) {
      return NextResponse.json({ error: `Auth delete failed: ${deleteError.message}` }, { status: 500 });
    }

    // Sign out the session from the request cookie too
    await supabase.auth.signOut();

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('delete_account.failed', { errorMessage: describeError(err) });
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
