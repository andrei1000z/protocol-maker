-- ============================================================================
-- PROTOCOL MAKER — UPGRADE SCRIPT (idempotent, safe to re-run)
-- ============================================================================
-- Run this in Supabase Dashboard > SQL Editor to bring an existing database
-- up to the latest schema WITHOUT dropping any data.
--
-- Adds missing columns, tables, indexes, policies, and triggers one-by-one
-- with guards (IF NOT EXISTS, DROP IF EXISTS). Running it twice is a no-op.
-- ============================================================================

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ 1. PROFILES — add onboarding_data JSONB for 150+ deep-dive fields        │
-- └──────────────────────────────────────────────────────────────────────────┘
alter table public.profiles add column if not exists onboarding_data jsonb default '{}';
alter table public.profiles add column if not exists onboarding_step integer default 0;
alter table public.profiles add column if not exists onboarding_completed boolean default false;
alter table public.profiles add column if not exists ethnicity text;
alter table public.profiles add column if not exists latitude real;
alter table public.profiles add column if not exists occupation text;
alter table public.profiles add column if not exists sleep_hours_avg real;
alter table public.profiles add column if not exists sleep_quality integer;
alter table public.profiles add column if not exists diet_type text default 'omnivore';
alter table public.profiles add column if not exists alcohol_drinks_per_week integer default 0;
alter table public.profiles add column if not exists caffeine_mg_per_day integer default 0;
alter table public.profiles add column if not exists smoker boolean default false;
alter table public.profiles add column if not exists cardio_minutes_per_week integer default 0;
alter table public.profiles add column if not exists strength_sessions_per_week integer default 0;
alter table public.profiles add column if not exists conditions text[] default '{}';
alter table public.profiles add column if not exists medications jsonb default '[]';
alter table public.profiles add column if not exists current_supplements text[] default '{}';
alter table public.profiles add column if not exists allergies text[] default '{}';
alter table public.profiles add column if not exists goals jsonb default '[]';
alter table public.profiles add column if not exists time_budget_min integer default 60;
alter table public.profiles add column if not exists monthly_budget_ron integer default 500;
alter table public.profiles add column if not exists experimental_openness text default 'otc_only';
alter table public.profiles add column if not exists activity_level text default 'moderate';
alter table public.profiles add column if not exists updated_at timestamptz default now();

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ 2. PROTOCOLS — add aging_pace (DunedinPACE analog 0.60-1.55)             │
-- └──────────────────────────────────────────────────────────────────────────┘
alter table public.protocols add column if not exists aging_pace numeric(4,2);
alter table public.protocols add column if not exists longevity_score integer;
alter table public.protocols add column if not exists biological_age integer;
alter table public.protocols add column if not exists detected_patterns jsonb;
alter table public.protocols add column if not exists classified_biomarkers jsonb;
alter table public.protocols add column if not exists model_used text default 'llama-3.3-70b-versatile';

-- Drop legacy columns that caused insert errors in old app versions
alter table public.protocols drop column if exists prompt_hash;
alter table public.protocols drop column if exists generation_time_ms;

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ 3. DAILY_METRICS — create if missing                                     │
-- └──────────────────────────────────────────────────────────────────────────┘
create table if not exists public.daily_metrics (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  date date not null,
  weight_kg real,
  sleep_hours real,
  sleep_quality integer check (sleep_quality between 1 and 10),
  mood integer check (mood between 1 and 10),
  energy integer check (energy between 1 and 10),
  hrv integer,
  resting_hr integer,
  steps integer,
  workout_done boolean default false,
  workout_minutes integer,
  workout_intensity text,
  stress_level integer check (stress_level between 1 and 10),
  habits_completed text[] default '{}',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, date)
);

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ 4. SHARE_LINKS — create if missing                                       │
-- └──────────────────────────────────────────────────────────────────────────┘
create table if not exists public.share_links (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  protocol_id uuid references public.protocols on delete cascade not null,
  slug text unique not null,
  view_count integer default 0,
  created_at timestamptz default now()
);

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ 5. COMPLIANCE_LOGS — create if missing                                   │
-- └──────────────────────────────────────────────────────────────────────────┘
create table if not exists public.compliance_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  protocol_id uuid not null,
  item_type text not null,
  item_name text not null,
  date date not null,
  completed boolean default false,
  unique(user_id, item_type, item_name, date)
);

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ 6. INDEXES                                                               │
-- └──────────────────────────────────────────────────────────────────────────┘
create index if not exists idx_blood_tests_user_date on public.blood_tests(user_id, taken_at desc);
create index if not exists idx_protocols_user_created on public.protocols(user_id, created_at desc);
create index if not exists idx_daily_metrics_user_date on public.daily_metrics(user_id, date desc);
create index if not exists idx_compliance_user_date on public.compliance_logs(user_id, date desc);

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ 7. RLS — enable + ensure policies exist (drops + recreates to be safe)   │
-- └──────────────────────────────────────────────────────────────────────────┘
alter table public.profiles enable row level security;
alter table public.blood_tests enable row level security;
alter table public.protocols enable row level security;
alter table public.daily_metrics enable row level security;
alter table public.share_links enable row level security;
alter table public.compliance_logs enable row level security;

drop policy if exists "profiles_select" on public.profiles;
drop policy if exists "profiles_insert" on public.profiles;
drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_select" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);

drop policy if exists "blood_tests_select" on public.blood_tests;
drop policy if exists "blood_tests_insert" on public.blood_tests;
drop policy if exists "blood_tests_delete" on public.blood_tests;
create policy "blood_tests_select" on public.blood_tests for select using (auth.uid() = user_id);
create policy "blood_tests_insert" on public.blood_tests for insert with check (auth.uid() = user_id);
create policy "blood_tests_delete" on public.blood_tests for delete using (auth.uid() = user_id);

drop policy if exists "protocols_select" on public.protocols;
drop policy if exists "protocols_insert" on public.protocols;
drop policy if exists "protocols_delete" on public.protocols;
create policy "protocols_select" on public.protocols for select using (auth.uid() = user_id);
create policy "protocols_insert" on public.protocols for insert with check (auth.uid() = user_id);
create policy "protocols_delete" on public.protocols for delete using (auth.uid() = user_id);

drop policy if exists "daily_metrics_own" on public.daily_metrics;
create policy "daily_metrics_own" on public.daily_metrics for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "share_links_owner" on public.share_links;
drop policy if exists "share_links_public_read" on public.share_links;
drop policy if exists "share_links_increment" on public.share_links;
drop policy if exists "share_links_select" on public.share_links;
drop policy if exists "share_links_insert" on public.share_links;
drop policy if exists "share_links_public" on public.share_links;
create policy "share_links_owner" on public.share_links for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "share_links_public_read" on public.share_links for select using (true);
create policy "share_links_increment" on public.share_links for update using (true);

drop policy if exists "compliance_own" on public.compliance_logs;
drop policy if exists "compliance_select" on public.compliance_logs;
drop policy if exists "compliance_insert" on public.compliance_logs;
drop policy if exists "compliance_update" on public.compliance_logs;
drop policy if exists "compliance_upsert" on public.compliance_logs;
create policy "compliance_own" on public.compliance_logs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ 8. TRIGGERS                                                              │
-- └──────────────────────────────────────────────────────────────────────────┘
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute procedure public.set_updated_at();

drop trigger if exists daily_metrics_set_updated_at on public.daily_metrics;
create trigger daily_metrics_set_updated_at before update on public.daily_metrics
  for each row execute procedure public.set_updated_at();

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ 9. BACKFILL: ensure every auth user has a profile row                    │
-- └──────────────────────────────────────────────────────────────────────────┘
insert into public.profiles (id)
select u.id from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- Done. Verify:
--   select column_name from information_schema.columns where table_name = 'profiles';
--   select column_name from information_schema.columns where table_name = 'protocols';
--   select tablename from pg_tables where schemaname = 'public';
