-- ============================================================================
-- PROTOCOL MAKER — SHARE LINKS + COMPLIANCE TRACKING MODULE (standalone)
-- ============================================================================
-- Self-contained script for the sharing + adherence modules. Safe to run on
-- any DB that already has auth.users and public.protocols. Creates:
--   - share_links table (public-readable protocol URLs by slug)
--   - compliance_logs table (per-day adherence ticks)
--   - Hot-path indexes including partial index on completed items
--   - RLS with per-user + public-read policies
--   - completed_at auto-timestamp trigger
--   - Realtime publication for both tables
--   - Helper SQL functions: get_current_streak, get_adherence_rate,
--     get_item_consistency, get_recent_misses
--
-- Run in Supabase SQL Editor. Re-runnable without side effects.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ============================================================================
-- SHARE_LINKS
-- ============================================================================
-- Each row is a slug-addressable public view of a protocol.
-- Anon users can SELECT + increment view_count but nothing else.
-- ============================================================================

create table if not exists public.share_links (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  protocol_id uuid references public.protocols on delete cascade not null,
  slug text unique not null check (length(slug) between 6 and 64),
  view_count integer default 0 check (view_count >= 0),
  expires_at timestamptz,  -- null = never expires
  created_at timestamptz default now()
);

-- Add new columns to existing installs
alter table public.share_links add column if not exists expires_at timestamptz;

-- Fast lookup by slug (public viewer route)
create index if not exists idx_share_links_slug on public.share_links(slug);
-- Owner's list of their links
create index if not exists idx_share_links_user on public.share_links(user_id, created_at desc);

-- RLS
alter table public.share_links enable row level security;

drop policy if exists "share_links_owner" on public.share_links;
drop policy if exists "share_links_public_read" on public.share_links;
drop policy if exists "share_links_increment" on public.share_links;
drop policy if exists "share_links_select" on public.share_links;
drop policy if exists "share_links_insert" on public.share_links;
drop policy if exists "share_links_public" on public.share_links;

create policy "share_links_owner" on public.share_links
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "share_links_public_read" on public.share_links
  for select using (true);

-- Anon/public can UPDATE view_count (but nothing else — column grant scopes it)
create policy "share_links_increment" on public.share_links
  for update using (true);

-- Grants: authenticated owns full CRUD, anon gets select + view_count increment only
grant select, insert, update, delete on public.share_links to authenticated;
grant select on public.share_links to anon;
grant update(view_count) on public.share_links to anon;
grant all on public.share_links to service_role;

-- ============================================================================
-- COMPLIANCE_LOGS
-- ============================================================================
-- Each row = "did user X complete item Y on date Z?"
-- item_type: task | supplement | habit | meal | workout
-- UNIQUE (user_id, item_type, item_name, date) ensures one log per item per day.
-- ============================================================================

create table if not exists public.compliance_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  protocol_id uuid,
  item_type text not null check (item_type in ('task','supplement','habit','meal','workout')),
  item_name text not null,
  date date not null,
  completed boolean default false,
  completed_at timestamptz,  -- auto-set by trigger when completed flips to true
  unique(user_id, item_type, item_name, date)
);

-- Add completed_at to existing installs
alter table public.compliance_logs add column if not exists completed_at timestamptz;

-- Constraint for existing installs
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'compliance_item_type_check') then
    alter table public.compliance_logs add constraint compliance_item_type_check
      check (item_type in ('task','supplement','habit','meal','workout')) not valid;
    alter table public.compliance_logs validate constraint compliance_item_type_check;
  end if;
exception when others then null; end $$;

-- Indexes — hot paths for streak/adherence queries
create index if not exists idx_compliance_user_date
  on public.compliance_logs(user_id, date desc);

-- Partial index: only completed rows (streak/adherence rarely cares about "logged but not done")
create index if not exists idx_compliance_completed
  on public.compliance_logs(user_id, date, item_type)
  where completed = true;

-- By-type queries (e.g. "supplements this week")
create index if not exists idx_compliance_type
  on public.compliance_logs(user_id, item_type, date desc);

-- RLS
alter table public.compliance_logs enable row level security;

drop policy if exists "compliance_own" on public.compliance_logs;
drop policy if exists "compliance_select" on public.compliance_logs;
drop policy if exists "compliance_insert" on public.compliance_logs;
drop policy if exists "compliance_update" on public.compliance_logs;
drop policy if exists "compliance_upsert" on public.compliance_logs;

create policy "compliance_own" on public.compliance_logs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.compliance_logs to authenticated;
grant all on public.compliance_logs to service_role;

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ TRIGGER — auto-timestamp completed_at on flip                            │
-- └──────────────────────────────────────────────────────────────────────────┘
create or replace function public.set_completed_at()
returns trigger language plpgsql as $$
begin
  if new.completed = true and (old is null or old.completed = false) then
    new.completed_at = now();
  elsif new.completed = false then
    new.completed_at = null;
  end if;
  return new;
end; $$;

drop trigger if exists compliance_set_completed_at on public.compliance_logs;
create trigger compliance_set_completed_at
  before insert or update on public.compliance_logs
  for each row execute procedure public.set_completed_at();

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ REALTIME — live badge updates on the tracking page                       │
-- └──────────────────────────────────────────────────────────────────────────┘
do $$ begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'compliance_logs') then
    alter publication supabase_realtime add table public.compliance_logs;
  end if;
exception when others then null;
end $$;

do $$ begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'share_links') then
    alter publication supabase_realtime add table public.share_links;
  end if;
exception when others then null;
end $$;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Current streak: consecutive days where AT LEAST ONE item was completed
create or replace function public.get_current_streak(p_user_id uuid)
returns integer language sql stable as $$
  with daily as (
    select date from public.compliance_logs
    where user_id = p_user_id and completed = true
    group by date order by date desc
  ),
  gaps as (
    select date, date - (row_number() over (order by date desc))::int as grp from daily
  )
  select coalesce(count(*)::int, 0)
  from gaps where grp = (select grp from gaps limit 1);
$$;

-- Adherence rate over last N days (% of logged items that were completed)
create or replace function public.get_adherence_rate(p_user_id uuid, p_days integer default 30)
returns numeric language sql stable as $$
  select case when count(*) = 0 then 0
              else round(100.0 * sum(case when completed then 1 else 0 end)::numeric / count(*), 1)
         end
  from public.compliance_logs
  where user_id = p_user_id and date >= current_date - p_days;
$$;

-- Per-item consistency: for each distinct item, how often was it completed?
-- Useful for "you stick with Vit D (92%) but skip cardio (34%)"
create or replace function public.get_item_consistency(
  p_user_id uuid,
  p_days integer default 30,
  p_type text default null
)
returns table(
  item_type text,
  item_name text,
  total_days integer,
  completed_days integer,
  consistency_pct numeric
)
language sql stable as $$
  select
    item_type,
    item_name,
    count(*)::int as total_days,
    sum(case when completed then 1 else 0 end)::int as completed_days,
    round(100.0 * sum(case when completed then 1 else 0 end)::numeric / count(*), 1) as consistency_pct
  from public.compliance_logs
  where user_id = p_user_id
    and date >= current_date - p_days
    and (p_type is null or item_type = p_type)
  group by item_type, item_name
  order by consistency_pct asc;
$$;

-- Items most recently missed — for dashboard "you skipped X for 3 days" nudges
create or replace function public.get_recent_misses(
  p_user_id uuid,
  p_days integer default 7
)
returns table(
  item_type text,
  item_name text,
  missed_days integer,
  last_completed date
)
language sql stable as $$
  select
    item_type,
    item_name,
    count(*) filter (where completed = false)::int as missed_days,
    max(date) filter (where completed = true) as last_completed
  from public.compliance_logs
  where user_id = p_user_id
    and date >= current_date - p_days
  group by item_type, item_name
  having count(*) filter (where completed = false) > 0
  order by missed_days desc;
$$;

-- Latest diagnostics helper (also in upgrade.sql; re-defined here so this
-- module is fully standalone)
create or replace function public.get_latest_diagnostics(p_user_id uuid)
returns table(
  biological_age_decimal numeric,
  aging_pace numeric,
  longevity_score integer,
  generated_at timestamptz
)
language sql stable as $$
  select biological_age_decimal, aging_pace, longevity_score, created_at
  from public.protocols
  where user_id = p_user_id and deleted_at is null
  order by created_at desc limit 1;
$$;

grant execute on function public.get_current_streak(uuid) to authenticated, service_role;
grant execute on function public.get_adherence_rate(uuid, integer) to authenticated, service_role;
grant execute on function public.get_item_consistency(uuid, integer, text) to authenticated, service_role;
grant execute on function public.get_recent_misses(uuid, integer) to authenticated, service_role;
grant execute on function public.get_latest_diagnostics(uuid) to authenticated, service_role;

-- ============================================================================
-- USAGE EXAMPLES
-- ============================================================================
-- Mark supplement taken today:
--   INSERT INTO compliance_logs (user_id, item_type, item_name, date, completed)
--   VALUES (auth.uid(), 'supplement', 'Vitamin D3', current_date, true)
--   ON CONFLICT (user_id, item_type, item_name, date) DO UPDATE SET
--     completed = EXCLUDED.completed;
--
-- Get user's streak:
--   SELECT get_current_streak(auth.uid());
--
-- Get 30-day adherence %:
--   SELECT get_adherence_rate(auth.uid(), 30);
--
-- See which supplements they skip most:
--   SELECT * FROM get_item_consistency(auth.uid(), 30, 'supplement');
--
-- Recent misses for dashboard nudge:
--   SELECT * FROM get_recent_misses(auth.uid(), 7);
--
-- Create public share link:
--   INSERT INTO share_links (user_id, protocol_id, slug)
--   VALUES (auth.uid(), '<protocol_uuid>', 'my-longevity-2026');
-- ============================================================================
