-- ============================================================================
-- 0003 — AUDIT_LOG
-- ============================================================================
-- Append-only ledger of every privileged operation that runs with the
-- service-role key (i.e. bypasses RLS). Today that's:
--   - cron.regen           — overnight protocol generation per user
--   - delete_account       — full-cascade account deletion (irreversible)
--   - stripe.webhook       — subscription state changes from Stripe
--   - oauth.token_stored   — wearable refresh token write on OAuth callback
--
-- Why this exists: in a leak / incident scenario we need to answer "what did
-- the service role do, against which user, when?" without trusting application
-- logs (which can be tampered with or rotated). Append-only + deny-all RLS
-- (with FORCE) means even a future anon-key leak can't read or alter rows.
-- Service role still has full access — that's how the app writes entries.
--
-- Safe to re-run. Only creates what's missing.
-- ============================================================================

create table if not exists public.audit_log (
  id uuid default gen_random_uuid() primary key,
  ts timestamptz not null default now(),
  actor text not null,                                   -- 'cron' | 'delete_account' | 'stripe.webhook' | 'oauth.token_stored' | ...
  action text not null,                                  -- short verb e.g. 'regen_protocol', 'erase_user', 'set_subscription_active'
  target_user_id uuid,                                   -- null for system-wide events
  metadata jsonb not null default '{}'::jsonb            -- non-PII context (provider name, latency, error code, etc.)
);

-- Length + size guards — protect against accidental blob writes that would
-- make the table painful to query under load.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'audit_actor_length') then
    alter table public.audit_log add constraint audit_actor_length
      check (char_length(actor) between 1 and 64) not valid;
    alter table public.audit_log validate constraint audit_actor_length;
  end if;
exception when others then null; end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'audit_action_length') then
    alter table public.audit_log add constraint audit_action_length
      check (char_length(action) between 1 and 64) not valid;
    alter table public.audit_log validate constraint audit_action_length;
  end if;
exception when others then null; end $$;

-- Hot-path indexes — incident response usually asks "what did we do to this
-- user?" or "what happened in the last 24h?".
create index if not exists idx_audit_target_ts on public.audit_log(target_user_id, ts desc);
create index if not exists idx_audit_actor_ts  on public.audit_log(actor, ts desc);
create index if not exists idx_audit_ts        on public.audit_log(ts desc);

-- RLS — deny-all to authenticated/anon. Only service_role can read or write.
-- FORCE row level security so a future leak of the anon key can't bypass.
alter table public.audit_log enable row level security;
alter table public.audit_log force row level security;

drop policy if exists "audit_log_deny_all" on public.audit_log;
create policy "audit_log_deny_all" on public.audit_log for all
  using (false) with check (false);

-- Strip everything from authenticated/anon; grant only to service_role.
revoke all on public.audit_log from authenticated, anon;
grant select, insert on public.audit_log to service_role;

-- ============================================================================
-- Convenience function: log_audit() — call from admin client code so the
-- table doesn't need direct insert imports everywhere.
-- ============================================================================
create or replace function public.log_audit(
  p_actor text,
  p_action text,
  p_target_user_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.audit_log (actor, action, target_user_id, metadata)
  values (p_actor, p_action, p_target_user_id, p_metadata)
  returning id into v_id;
  return v_id;
end;
$$;

-- security definer = the function runs with the privileges of its owner
-- (postgres), so service-role callers don't need direct table grants.
revoke all on function public.log_audit(text, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.log_audit(text, text, uuid, jsonb) to service_role;

comment on table public.audit_log is 'Append-only ledger of privileged service-role operations. Deny-all RLS; service_role only.';
comment on function public.log_audit is 'Helper to write into audit_log from server-side admin clients.';
