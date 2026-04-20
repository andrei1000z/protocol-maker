// Fitbit status / sync-now / disconnect — same shape as Oura's, different provider.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isConfigured } from '@/lib/integrations/fitbit';
import { syncProvider } from '@/lib/integrations/sync';
import { logger, describeError } from '@/lib/logger';

export const runtime = 'nodejs';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data: row } = await supabase
    .from('oauth_connections')
    .select('last_synced_at, last_sync_error, scopes, expires_at')
    .eq('user_id', user.id).eq('provider', 'fitbit').maybeSingle();

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
  if (!isConfigured()) return NextResponse.json({ error: 'Fitbit not configured' }, { status: 503 });
  try {
    const result = await syncProvider(createAdminClient(), user.id, 'fitbit', { lookbackDays: 14 });
    return NextResponse.json(result);
  } catch (err) {
    logger.error('fitbit.sync_failed_manual', { userId: user.id, errorMessage: describeError(err) });
    return NextResponse.json({ error: describeError(err) }, { status: 500 });
  }
}

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const admin = createAdminClient();
  const { error } = await admin.from('oauth_connections').delete()
    .eq('user_id', user.id).eq('provider', 'fitbit');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  logger.info('fitbit.disconnected', { userId: user.id });
  return NextResponse.json({ ok: true });
}
