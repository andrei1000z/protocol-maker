// GET  /api/integrations/oura → status ({ connected, lastSyncedAt, lastSyncError, configured })
// POST /api/integrations/oura → on-demand sync (pulls last 14 days into daily_metrics)
// DELETE /api/integrations/oura → disconnect (removes tokens)
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isConfigured } from '@/lib/integrations/oura';
import { syncOuraForUser } from '@/lib/integrations/oura-sync';
import { logger, describeError } from '@/lib/logger';

export const runtime = 'nodejs';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  // oauth_connections has SELECT policy for the owner, so we can read via the
  // user's own client — don't need admin here.
  const { data: row } = await supabase
    .from('oauth_connections')
    .select('last_synced_at, last_sync_error, scopes, expires_at')
    .eq('user_id', user.id)
    .eq('provider', 'oura')
    .maybeSingle();

  return NextResponse.json({
    configured: isConfigured(),
    connected: !!row,
    lastSyncedAt: row?.last_synced_at ?? null,
    lastSyncError: row?.last_sync_error ?? null,
    tokenExpiresAt: row?.expires_at ?? null,
  });
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  if (!isConfigured()) {
    return NextResponse.json({ error: 'Oura integration not configured on this server' }, { status: 503 });
  }

  try {
    const admin = createAdminClient();
    const result = await syncOuraForUser(admin, user.id, { lookbackDays: 14 });
    return NextResponse.json(result);
  } catch (err) {
    logger.error('oura.sync_failed_manual', { userId: user.id, errorMessage: describeError(err) });
    return NextResponse.json({ error: describeError(err) }, { status: 500 });
  }
}

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  // Admin client — the owner-only RLS policy is SELECT-only, DELETE needs service role.
  const admin = createAdminClient();
  const { error } = await admin
    .from('oauth_connections')
    .delete()
    .eq('user_id', user.id)
    .eq('provider', 'oura');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  logger.info('oura.disconnected', { userId: user.id });
  return NextResponse.json({ ok: true });
}
