-- ============================================================================
-- PROTOCOL MAKER — CANONICAL DATABASE SCHEMA (fresh install)
-- ============================================================================
-- Modern Postgres 15+ / Supabase best practices:
--   - JSONB with GIN + jsonb_path_ops indexes for sub-ms onboarding queries
--   - GIN indexes on text[] arrays (goals, conditions, habits)
--   - Check constraints for data validity (sex, activity_level, diet_type, etc.)
--   - Soft delete (deleted_at) on protocols / profiles / blood_tests
--   - Covering + partial indexes on hot paths
--   - Realtime publication for live dashboard updates
--   - Helper SQL functions for streak + adherence (avoid N+1 in app layer)
--   - Explicit grants to authenticated / anon roles
--   - pg_trgm extension for fuzzy biomarker name search
--   - Decimal precision on biological_age and aging_pace
--
-- Run this ONCE on an empty database in Supabase SQL Editor.
-- For an existing DB with data, run upgrade.sql instead.
-- ============================================================================

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ 0. EXTENSIONS                                                            │
-- └──────────────────────────────────────────────────────────────────────────┘
create extension if not exists "pgcrypto";        -- gen_random_uuid()
create extension if not exists "pg_trgm";         -- fuzzy text search on biomarker names

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ 1. PROFILES — one row per user, grown during onboarding                  │
-- └──────────────────────────────────────────────────────────────────────────┘
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,

  -- Identity
  age integer check (age is null or (age between 0 and 120)),
  sex text check (sex in ('male', 'female', 'intersex') or sex is null),
  height_cm real check (height_cm is null or height_cm between 30 and 250),
  weight_kg real check (weight_kg is null or weight_kg between 2 and 500),
  ethnicity text,
  latitude real,
  occupation text check (occupation in ('desk', 'physical', 'shift', 'mixed') or occupation is null),

  -- Lifestyle snapshot (full deep-dive in onboarding_data JSONB)
  activity_level text default 'moderate'
    check (activity_level in ('sedentary', 'light', 'moderate', 'active', 'elite')),
  sleep_hours_avg real check (sleep_hours_avg is null or sleep_hours_avg between 0 and 24),
  sleep_quality integer check (sleep_quality is null or sleep_quality between 1 and 10),
  diet_type text default 'omnivore'
    check (diet_type in ('omnivore', 'vegetarian', 'vegan', 'keto', 'carnivore', 'mediterranean', 'custom') or diet_type is null),
  alcohol_drinks_per_week integer default 0 check (alcohol_drinks_per_week >= 0),
  caffeine_mg_per_day integer default 0 check (caffeine_mg_per_day >= 0),
  smoker boolean default false,
  cardio_minutes_per_week integer default 0 check (cardio_minutes_per_week >= 0),
  strength_sessions_per_week integer default 0 check (strength_sessions_per_week between 0 and 14),

  -- Medical
  conditions text[] default '{}',
  medications jsonb default '[]'::jsonb,
  current_supplements text[] default '{}',
  allergies text[] default '{}',

  -- Goals / constraints
  goals jsonb default '[]'::jsonb,
  time_budget_min integer default 60 check (time_budget_min between 0 and 1440),
  monthly_budget_ron integer default 500 check (monthly_budget_ron >= 0),
  experimental_openness text default 'otc_only'
    check (experimental_openness in ('otc_only', 'open_rx', 'open_experimental')),

  -- Onboarding state
  onboarding_completed boolean default false,
  onboarding_step integer default 0 check (onboarding_step between 0 and 10),
  onboarding_data jsonb default '{}'::jsonb,

  -- Audit
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz  -- soft delete
);

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ 2. BLOOD_TESTS — each upload creates a new row (full history kept)       │
-- └──────────────────────────────────────────────────────────────────────────┘
create table if not exists public.blood_tests (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  taken_at date not null,
  lab_name text,
  biomarkers jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz default now(),
  deleted_at timestamptz
);

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ 3. PROTOCOLS — generated longevity protocols (full history kept)         │
-- └──────────────────────────────────────────────────────────────────────────┘
create table if not exists public.protocols (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  based_on_blood_test_id uuid references public.blood_tests on delete set null,
  protocol_json jsonb not null,
  classified_biomarkers jsonb,
  detected_patterns jsonb,

  -- Diagnostics (duplicated from protocol_json for fast indexed queries)
  longevity_score integer check (longevity_score is null or longevity_score between 0 and 100),
  biological_age integer check (biological_age is null or biological_age between 0 and 120),
  biological_age_decimal numeric(4,1) check (biological_age_decimal is null or biological_age_decimal between 0 and 120),
  aging_pace numeric(4,2) check (aging_pace is null or aging_pace between 0.4 and 2.0),

  model_used text default 'claude-sonnet-4-5',
  generation_source text check (generation_source in ('claude', 'groq', 'fallback') or generation_source is null),
  created_at timestamptz default now(),
  deleted_at timestamptz
);

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ 4. DAILY_METRICS — tracking (one row per user per day)                   │
-- └──────────────────────────────────────────────────────────────────────────┘
create table if not exists public.daily_metrics (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  date date not null,
  weight_kg real check (weight_kg is null or weight_kg between 2 and 500),
  sleep_hours real check (sleep_hours is null or sleep_hours between 0 and 24),
  sleep_quality integer check (sleep_quality is null or sleep_quality between 1 and 10),
  mood integer check (mood is null or mood between 1 and 10),
  energy integer check (energy is null or energy between 1 and 10),
  hrv integer check (hrv is null or hrv between 0 and 300),
  resting_hr integer check (resting_hr is null or resting_hr between 20 and 220),
  steps integer check (steps is null or steps between 0 and 200000),
  workout_done boolean default false,
  workout_minutes integer check (workout_minutes is null or workout_minutes between 0 and 1440),
  workout_intensity text check (workout_intensity in ('low', 'moderate', 'high') or workout_intensity is null),
  stress_level integer check (stress_level is null or stress_level between 1 and 10),
  habits_completed text[] default '{}',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, date)
);

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ 5. SHARE_LINKS — public read-only view of a protocol by slug             │
-- └──────────────────────────────────────────────────────────────────────────┘
create table if not exists public.share_links (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  protocol_id uuid references public.protocols on delete cascade not null,
  slug text unique not null check (length(slug) between 6 and 64),
  view_count integer default 0 check (view_count >= 0),
  expires_at timestamptz,  -- null = never expires
  created_at timestamptz default now()
);

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ 6. COMPLIANCE_LOGS — per-day adherence ticks                             │
-- └──────────────────────────────────────────────────────────────────────────┘
create table if not exists public.compliance_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  protocol_id uuid,
  item_type text not null check (item_type in ('task', 'supplement', 'habit', 'meal', 'workout')),
  item_name text not null,
  date date not null,
  completed boolean default false,
  completed_at timestamptz,  -- exact time of completion (analytics: do morning people stay consistent?)
  unique(user_id, item_type, item_name, date)
);

-- ============================================================================
-- INDEXES — modern 2026 patterns
-- ============================================================================

-- Hot paths (user + date descending, covering common selects)
create index if not exists idx_blood_tests_user_date on public.blood_tests(user_id, taken_at desc)
  where deleted_at is null;
create index if not exists idx_protocols_user_created on public.protocols(user_id, created_at desc)
  where deleted_at is null;
create index if not exists idx_daily_metrics_user_date on public.daily_metrics(user_id, date desc);
create index if not exists idx_compliance_user_date on public.compliance_logs(user_id, date desc);
create index if not exists idx_compliance_completed on public.compliance_logs(user_id, date, completed)
  where completed = true;

-- Partial index: onboarded users only (most dashboard queries filter this)
create index if not exists idx_profiles_onboarded on public.profiles(id)
  where onboarding_completed = true and deleted_at is null;

-- JSONB GIN indexes with jsonb_path_ops (faster + smaller than default jsonb_ops)
create index if not exists idx_profiles_onboarding_data on public.profiles
  using gin (onboarding_data jsonb_path_ops);
create index if not exists idx_profiles_medications on public.profiles
  using gin (medications jsonb_path_ops);
create index if not exists idx_profiles_goals on public.profiles
  using gin (goals jsonb_path_ops);
create index if not exists idx_protocols_json on public.protocols
  using gin (protocol_json jsonb_path_ops);
create index if not exists idx_blood_tests_biomarkers on public.blood_tests
  using gin (biomarkers jsonb_path_ops);

-- Array GIN indexes (for ANY/contains queries on text[])
create index if not exists idx_profiles_conditions on public.profiles using gin (conditions);
create index if not exists idx_profiles_allergies on public.profiles using gin (allergies);
create index if not exists idx_daily_metrics_habits on public.daily_metrics using gin (habits_completed);

-- Share links lookup (by slug is hottest path)
create index if not exists idx_share_links_slug on public.share_links(slug);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.blood_tests enable row level security;
alter table public.protocols enable row level security;
alter table public.daily_metrics enable row level security;
alter table public.share_links enable row level security;
alter table public.compliance_logs enable row level security;

-- Force RLS even for superuser (defense in depth)
alter table public.profiles force row level security;
alter table public.blood_tests force row level security;
alter table public.protocols force row level security;

-- Profiles
drop policy if exists "profiles_select" on public.profiles;
drop policy if exists "profiles_insert" on public.profiles;
drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_select" on public.profiles for select
  using (auth.uid() = id and deleted_at is null);
create policy "profiles_insert" on public.profiles for insert
  with check (auth.uid() = id);
create policy "profiles_update" on public.profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);

-- Blood tests
drop policy if exists "blood_tests_select" on public.blood_tests;
drop policy if exists "blood_tests_insert" on public.blood_tests;
drop policy if exists "blood_tests_update" on public.blood_tests;
drop policy if exists "blood_tests_delete" on public.blood_tests;
create policy "blood_tests_select" on public.blood_tests for select
  using (auth.uid() = user_id and deleted_at is null);
create policy "blood_tests_insert" on public.blood_tests for insert
  with check (auth.uid() = user_id);
create policy "blood_tests_update" on public.blood_tests for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "blood_tests_delete" on public.blood_tests for delete
  using (auth.uid() = user_id);

-- Protocols
drop policy if exists "protocols_select" on public.protocols;
drop policy if exists "protocols_insert" on public.protocols;
drop policy if exists "protocols_update" on public.protocols;
drop policy if exists "protocols_delete" on public.protocols;
create policy "protocols_select" on public.protocols for select
  using (auth.uid() = user_id and deleted_at is null);
create policy "protocols_insert" on public.protocols for insert
  with check (auth.uid() = user_id);
create policy "protocols_update" on public.protocols for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "protocols_delete" on public.protocols for delete
  using (auth.uid() = user_id);

-- Daily metrics: full CRUD on own rows
drop policy if exists "daily_metrics_own" on public.daily_metrics;
create policy "daily_metrics_own" on public.daily_metrics for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Share links: owner full CRUD; anyone reads (public viewer) + increments view_count
drop policy if exists "share_links_owner" on public.share_links;
drop policy if exists "share_links_public_read" on public.share_links;
drop policy if exists "share_links_increment" on public.share_links;
create policy "share_links_owner" on public.share_links for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "share_links_public_read" on public.share_links for select using (true);
create policy "share_links_increment" on public.share_links for update using (true);

-- Compliance logs: full CRUD on own rows
drop policy if exists "compliance_own" on public.compliance_logs;
create policy "compliance_own" on public.compliance_logs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- GRANTS — explicit permissions for Supabase roles
-- ============================================================================
grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.share_links to anon;  -- anon can read public protocol links
grant update(view_count) on public.share_links to anon;  -- and increment view counter
grant all on all tables in schema public to service_role;

grant usage, select on all sequences in schema public to authenticated, service_role;
grant execute on all functions in schema public to authenticated, service_role;

-- Default privileges for future objects
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant execute on functions to authenticated;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-create profile on new user signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute procedure public.set_updated_at();

drop trigger if exists daily_metrics_set_updated_at on public.daily_metrics;
create trigger daily_metrics_set_updated_at before update on public.daily_metrics
  for each row execute procedure public.set_updated_at();

-- Auto-set completed_at when compliance item is marked done
create or replace function public.set_completed_at()
returns trigger
language plpgsql
as $$
begin
  if new.completed = true and (old is null or old.completed = false) then
    new.completed_at = now();
  elsif new.completed = false then
    new.completed_at = null;
  end if;
  return new;
end;
$$;

drop trigger if exists compliance_set_completed_at on public.compliance_logs;
create trigger compliance_set_completed_at before insert or update on public.compliance_logs
  for each row execute procedure public.set_completed_at();

-- ============================================================================
-- HELPER FUNCTIONS — keep business logic out of N+1 app loops
-- ============================================================================

-- Current streak: consecutive days where ≥1 compliance item was completed
create or replace function public.get_current_streak(p_user_id uuid)
returns integer
language sql
stable
as $$
  with daily as (
    select date
    from public.compliance_logs
    where user_id = p_user_id and completed = true
    group by date
    order by date desc
  ),
  gaps as (
    select date, date - (row_number() over (order by date desc))::int as grp
    from daily
  )
  select count(*)::int from gaps where grp = (select grp from gaps limit 1);
$$;

-- Adherence rate over last N days (percentage of completed vs total logged items)
create or replace function public.get_adherence_rate(p_user_id uuid, p_days integer default 30)
returns numeric
language sql
stable
as $$
  select case when count(*) = 0 then 0
              else round(100.0 * sum(case when completed then 1 else 0 end)::numeric / count(*), 1)
         end
  from public.compliance_logs
  where user_id = p_user_id
    and date >= current_date - p_days;
$$;

-- Latest biological age + pace for a user (convenience view replacement)
create or replace function public.get_latest_diagnostics(p_user_id uuid)
returns table(
  biological_age_decimal numeric,
  aging_pace numeric,
  longevity_score integer,
  generated_at timestamptz
)
language sql
stable
as $$
  select biological_age_decimal, aging_pace, longevity_score, created_at
  from public.protocols
  where user_id = p_user_id and deleted_at is null
  order by created_at desc
  limit 1;
$$;

-- ============================================================================
-- REALTIME PUBLICATION — live dashboard updates without polling
-- ============================================================================
-- Subscribe from the client:
--   supabase.channel('dashboard')
--     .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_metrics' }, ...)
--     .subscribe()

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'daily_metrics'
  ) then
    alter publication supabase_realtime add table public.daily_metrics;
  end if;
exception when others then null;  -- publication may not exist in all setups
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'compliance_logs'
  ) then
    alter publication supabase_realtime add table public.compliance_logs;
  end if;
exception when others then null;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'protocols'
  ) then
    alter publication supabase_realtime add table public.protocols;
  end if;
exception when others then null;
end $$;

-- ============================================================================
-- BACKFILL — give every existing auth user a profile row
-- ============================================================================
insert into public.profiles (id)
select u.id from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);
