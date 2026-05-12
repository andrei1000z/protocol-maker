-- ============================================================================
-- 0005 — PUSH_SUBSCRIPTIONS (Web Push, F1)
-- ============================================================================
-- One row per (user, device endpoint). A user can have multiple subscriptions:
-- desktop Chrome, phone Chrome, secondary laptop. We notify all of them when
-- a cron run wants to ping the user (protocol regen, retest due, streak
-- milestone — gated by the user's notif_* prefs on profiles).
--
-- The endpoint URL plus the p256dh + auth keys form the full subscription
-- the web-push library needs. We store them server-side under RLS so they're
-- only readable by the owning user + the service role.
--
-- Safe to re-run.
-- ============================================================================

create table if not exists public.push_subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  endpoint text not null,                                -- the push service URL the browser gave us
  p256dh text not null,                                  -- public key from PushSubscription.getKey('p256dh')
  auth text not null,                                    -- authentication secret from getKey('auth')
  ua text,                                               -- optional user agent for debugging which device this is
  created_at timestamptz default now(),
  last_used_at timestamptz,
  failure_count int default 0,                           -- bumped when a push fails; >3 → soft-delete the row
  unique (user_id, endpoint)                             -- a given device endpoint maps to exactly one row per user
);

-- Length guards — endpoints can be long URLs (Apple's APNs proxy is ~300 chars).
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'push_endpoint_length') then
    alter table public.push_subscriptions add constraint push_endpoint_length
      check (char_length(endpoint) between 10 and 600) not valid;
    alter table public.push_subscriptions validate constraint push_endpoint_length;
  end if;
exception when others then null; end $$;

create index if not exists idx_push_user on public.push_subscriptions(user_id);

-- RLS — owner reads/writes their own subscriptions; service_role can fan out
-- pushes across all users (cron path).
alter table public.push_subscriptions enable row level security;
alter table public.push_subscriptions force row level security;

drop policy if exists "push_subscriptions_own" on public.push_subscriptions;
create policy "push_subscriptions_own" on public.push_subscriptions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant all on public.push_subscriptions to service_role;

comment on table public.push_subscriptions is
  'Web Push subscriptions per (user, device). Service role pushes via web-push lib using stored p256dh + auth keys.';
