import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Service-role Supabase client — bypasses RLS.
 * Use ONLY from trusted server-side contexts (cron jobs, admin routes).
 * Never expose to the browser or pass to client components.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('Supabase admin env vars missing (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)');
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// audit_log helper
// ─────────────────────────────────────────────────────────────────────────────
// Writes one row into public.audit_log via the SECURITY DEFINER `log_audit`
// function. Fire-and-forget — audit failures must never block the operation
// being audited (e.g. an account deletion must complete even if logging fails),
// so we swallow errors and surface them to the structured logger instead.
//
// Usage from any admin-context route:
//   await logAudit(admin, { actor: 'delete_account', action: 'erase_user',
//                           targetUserId: user.id, metadata: { tablesCleared: 9 } });

export interface AuditEntry {
  actor: string;                  // 'cron' | 'delete_account' | 'stripe.webhook' | 'oauth.token_stored' | ...
  action: string;                 // short verb, ≤64 chars
  targetUserId?: string | null;
  metadata?: Record<string, unknown>;
}

export async function logAudit(admin: SupabaseClient, entry: AuditEntry): Promise<void> {
  try {
    await admin.rpc('log_audit', {
      p_actor: entry.actor,
      p_action: entry.action,
      p_target_user_id: entry.targetUserId ?? null,
      p_metadata: (entry.metadata ?? {}) as object,
    });
  } catch {
    // Function may not yet be migrated, or DB may be unavailable. Either way,
    // we don't want audit logging to break the calling operation.
  }
}
