-- ============================================================================
-- PROTOCOL MAKER — UPGRADE SCRIPT (idempotent, safe to re-run)
-- ============================================================================
-- Brings an existing live database up to the latest schema WITHOUT dropping
-- any user data. Run in Supabase Dashboard → SQL Editor. Safe to re-run 10×.
--
-- Applies 2026 best practices:
--   - pg_trgm extension for fuzzy text search
--   - JSONB GIN indexes with jsonb_path_ops (faster + smaller)
--   - Array GIN indexes on text[] columns
--   - Check constraints added as NOT VALID then VALIDATE (non-blocking)
--   - biological_age_decimal column for sub-year precision
--   - Soft delete (deleted_at) on profiles, protocols, blood_tests
--   - Covering partial indexes on hot paths
--   - Helper SQL functions (streak, adherence, latest diagnostics)
--   - Realtime publication for daily_metrics + compliance_logs + protocols
--   - Explicit grants to authenticated/anon/service_role
-- ============================================================================

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ 0. EXTENSIONS                                                            │
-- └──────────────────────────────────────────────────────────────────────────┘
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ 1. PROFILES — add missing columns                                        │
-- └──────────────────────────────────────────────────────────────────────────┘
alter table public.profiles add column if not exists onboarding_data jsonb default '{}'::jsonb;
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
alter table public.profiles add column if not exists medications jsonb default '[]'::jsonb;
alter table public.profiles add column if not exists current_supplements text[] default '{}';
alter table public.profiles add column if not exists allergies text[] default '{}';
alter table public.profiles add column if not exists goals jsonb default '[]'::jsonb;
alter table public.profiles add column if not exists time_budget_min integer default 60;
alter table public.profiles add column if not exists monthly_budget_ron integer default 500;
alter table public.profiles add column if not exists experimental_openness text default 'otc_only';
alter table public.profiles add column if not exists activity_level text default 'moderate';
alter table public.profiles add column if not exists updated_at timestamptz default now();
alter table public.profiles add column if not exists deleted_at timestamptz;  -- soft delete

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ 2. PROTOCOLS — precision bio age, aging pace, soft delete                │
-- └──────────────────────────────────────────────────────────────────────────┘
alter table public.protocols add column if not exists aging_pace numeric(4,2);
alter table public.protocols add column if not exists biological_age_decimal numeric(4,1);
alter table public.protocols add column if not exists longevity_score integer;
alter table public.protocols add column if not exists biological_age integer;
alter table public.protocols add column if not exists detected_patterns jsonb;
alter table public.protocols add column if not exists classified_biomarkers jsonb;
alter table public.protocols add column if not exists model_used text default 'claude-sonnet-4-5';
alter table public.protocols add column if not exists generation_source text;
alter table public.protocols add column if not exists deleted_at timestamptz;

-- Drop legacy columns that caused insert errors in older app versions
alter table public.protocols drop column if exists prompt_hash;
alter table public.protocols drop column if exists generation_time_ms;

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ 3. BLOOD_TESTS — soft delete + notes                                     │
-- └──────────────────────────────────────────────────────────────────────────┘
alter table public.blood_tests add column if not exists notes text;
alter table public.blood_tests add column if not exists deleted_at timestamptz;

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ 4. DAILY_METRICS — create if missing + expand with smartwatch metrics    │
-- └──────────────────────────────────────────────────────────────────────────┘
create table if not exists public.daily_metrics (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  date date not null,
  weight_kg real,
  sleep_hours real,
  sleep_quality integer,
  mood integer,
  energy integer,
  hrv integer,
  resting_hr integer,
  steps integer,
  workout_done boolean default false,
  workout_minutes integer,
  workout_intensity text,
  stress_level integer,
  habits_completed text[] default '{}',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, date)
);

-- Smartwatch / wearable-grade metrics (Galaxy Watch, Oura, WHOOP, Apple Watch, Garmin)
alter table public.daily_metrics add column if not exists sleep_hours_planned real;      -- target last night
alter table public.daily_metrics add column if not exists sleep_score integer;            -- 0-100 from wearable
alter table public.daily_metrics add column if not exists deep_sleep_min integer;
alter table public.daily_metrics add column if not exists light_sleep_min integer;
alter table public.daily_metrics add column if not exists rem_sleep_min integer;
alter table public.daily_metrics add column if not exists awake_min integer;
alter table public.daily_metrics add column if not exists blood_oxygen_avg_sleep real;    -- SpO2 % during sleep
alter table public.daily_metrics add column if not exists skin_temp_deviation real;       -- °C vs recent avg (single-reading fallback)
alter table public.daily_metrics add column if not exists skin_temp_deviation_min real;   -- °C lowest delta vs recent avg
alter table public.daily_metrics add column if not exists skin_temp_deviation_max real;   -- °C highest delta vs recent avg
alter table public.daily_metrics add column if not exists hrv_sleep_avg integer;          -- HRV during sleep
alter table public.daily_metrics add column if not exists bp_systolic_morning integer;
alter table public.daily_metrics add column if not exists bp_diastolic_morning integer;
alter table public.daily_metrics add column if not exists bp_systolic_evening integer;
alter table public.daily_metrics add column if not exists bp_diastolic_evening integer;
alter table public.daily_metrics add column if not exists avg_heart_rate integer;         -- whole day avg
alter table public.daily_metrics add column if not exists min_heart_rate integer;         -- lowest today
alter table public.daily_metrics add column if not exists max_heart_rate integer;         -- peak today
alter table public.daily_metrics add column if not exists avg_respiratory_rate real;      -- breaths/min
alter table public.daily_metrics add column if not exists energy_score integer;           -- wearable energy 0-100
alter table public.daily_metrics add column if not exists active_time_min integer;
alter table public.daily_metrics add column if not exists activity_calories integer;
alter table public.daily_metrics add column if not exists antioxidant_index integer;      -- Galaxy Watch 0-100
alter table public.daily_metrics add column if not exists ages_index real;                -- Advanced Glycation End products

-- ── MORNING FASTED measurements (weight, body composition, basal temp) ──
-- Do AFTER waking, BEFORE food/water — lowest-noise baseline.
alter table public.daily_metrics add column if not exists body_fat_pct real;              -- smart scale BIA
alter table public.daily_metrics add column if not exists muscle_mass_kg real;            -- smart scale
alter table public.daily_metrics add column if not exists visceral_fat integer;           -- Tanita rating 1-60
alter table public.daily_metrics add column if not exists body_water_pct real;            -- smart scale
alter table public.daily_metrics add column if not exists bone_mass_kg real;              -- smart scale
alter table public.daily_metrics add column if not exists bmr_kcal integer;               -- smart scale estimate
alter table public.daily_metrics add column if not exists basal_body_temp_c real;         -- oral/forehead thermometer on waking
alter table public.daily_metrics add column if not exists body_score integer;             -- smart scale composite 0-100 (Withings/Renpho/Xiaomi)
alter table public.daily_metrics add column if not exists stress_level_avg integer;       -- evening self-report — avg stress across the day
alter table public.daily_metrics add column if not exists stress_bedtime integer;         -- night self-report — stress right before bed

-- Range constraints — silent skip if data violates (NOT VALID + VALIDATE pattern)
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'dm_sleep_score_range') then
    alter table public.daily_metrics add constraint dm_sleep_score_range
      check (sleep_score is null or sleep_score between 0 and 100) not valid;
    alter table public.daily_metrics validate constraint dm_sleep_score_range;
  end if;
exception when others then null; end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'dm_spo2_range') then
    alter table public.daily_metrics add constraint dm_spo2_range
      check (blood_oxygen_avg_sleep is null or blood_oxygen_avg_sleep between 70 and 100) not valid;
    alter table public.daily_metrics validate constraint dm_spo2_range;
  end if;
exception when others then null; end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'dm_energy_score_range') then
    alter table public.daily_metrics add constraint dm_energy_score_range
      check (energy_score is null or energy_score between 0 and 100) not valid;
    alter table public.daily_metrics validate constraint dm_energy_score_range;
  end if;
exception when others then null; end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'dm_bp_sys_range') then
    alter table public.daily_metrics add constraint dm_bp_sys_range
      check ((bp_systolic_morning is null or bp_systolic_morning between 60 and 250)
         and (bp_systolic_evening is null or bp_systolic_evening between 60 and 250)) not valid;
    alter table public.daily_metrics validate constraint dm_bp_sys_range;
  end if;
exception when others then null; end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'dm_hr_range') then
    alter table public.daily_metrics add constraint dm_hr_range
      check ((avg_heart_rate is null or avg_heart_rate between 20 and 220)
         and (min_heart_rate is null or min_heart_rate between 20 and 220)
         and (max_heart_rate is null or max_heart_rate between 20 and 300)) not valid;
    alter table public.daily_metrics validate constraint dm_hr_range;
  end if;
exception when others then null; end $$;

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ 5. SHARE_LINKS                                                           │
-- └──────────────────────────────────────────────────────────────────────────┘
create table if not exists public.share_links (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  protocol_id uuid references public.protocols on delete cascade not null,
  slug text unique not null,
  view_count integer default 0,
  expires_at timestamptz,
  created_at timestamptz default now()
);
alter table public.share_links add column if not exists expires_at timestamptz;

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ 6. COMPLIANCE_LOGS                                                       │
-- └──────────────────────────────────────────────────────────────────────────┘
create table if not exists public.compliance_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  protocol_id uuid,
  item_type text not null,
  item_name text not null,
  date date not null,
  completed boolean default false,
  completed_at timestamptz,
  unique(user_id, item_type, item_name, date)
);
alter table public.compliance_logs add column if not exists completed_at timestamptz;

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ 7. CHECK CONSTRAINTS — add as NOT VALID, then VALIDATE (non-blocking)    │
-- └──────────────────────────────────────────────────────────────────────────┘
-- Each constraint wrapped in DO block so it's idempotent (skips if exists).

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_sex_check') then
    alter table public.profiles add constraint profiles_sex_check
      check (sex in ('male', 'female', 'intersex') or sex is null) not valid;
    alter table public.profiles validate constraint profiles_sex_check;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_activity_check') then
    alter table public.profiles add constraint profiles_activity_check
      check (activity_level in ('sedentary', 'light', 'moderate', 'active', 'elite')) not valid;
    alter table public.profiles validate constraint profiles_activity_check;
  end if;
exception when others then null;  -- silently skip if existing data violates
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_diet_check') then
    alter table public.profiles add constraint profiles_diet_check
      check (diet_type in ('omnivore','vegetarian','vegan','keto','carnivore','mediterranean','custom') or diet_type is null) not valid;
    alter table public.profiles validate constraint profiles_diet_check;
  end if;
exception when others then null;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_experimental_check') then
    alter table public.profiles add constraint profiles_experimental_check
      check (experimental_openness in ('otc_only', 'open_rx', 'open_experimental')) not valid;
    alter table public.profiles validate constraint profiles_experimental_check;
  end if;
exception when others then null;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'protocols_score_range') then
    alter table public.protocols add constraint protocols_score_range
      check (longevity_score is null or longevity_score between 0 and 100) not valid;
    alter table public.protocols validate constraint protocols_score_range;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'protocols_pace_range') then
    alter table public.protocols add constraint protocols_pace_range
      check (aging_pace is null or aging_pace between 0.4 and 2.0) not valid;
    alter table public.protocols validate constraint protocols_pace_range;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'compliance_item_type_check') then
    alter table public.compliance_logs add constraint compliance_item_type_check
      check (item_type in ('task', 'supplement', 'habit', 'meal', 'workout')) not valid;
    alter table public.compliance_logs validate constraint compliance_item_type_check;
  end if;
exception when others then null;
end $$;

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ 8. INDEXES — modern JSONB + GIN array + partial covering                 │
-- └──────────────────────────────────────────────────────────────────────────┘
create index if not exists idx_blood_tests_user_date on public.blood_tests(user_id, taken_at desc)
  where deleted_at is null;
create index if not exists idx_protocols_user_created on public.protocols(user_id, created_at desc)
  where deleted_at is null;
create index if not exists idx_daily_metrics_user_date on public.daily_metrics(user_id, date desc);
create index if not exists idx_compliance_user_date on public.compliance_logs(user_id, date desc);
create index if not exists idx_compliance_completed on public.compliance_logs(user_id, date, completed)
  where completed = true;

create index if not exists idx_profiles_onboarded on public.profiles(id)
  where onboarding_completed = true and deleted_at is null;

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

create index if not exists idx_profiles_conditions on public.profiles using gin (conditions);
create index if not exists idx_profiles_allergies on public.profiles using gin (allergies);
create index if not exists idx_daily_metrics_habits on public.daily_metrics using gin (habits_completed);

create index if not exists idx_share_links_slug on public.share_links(slug);

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ 9. RLS — enable + (re)create policies                                    │
-- └──────────────────────────────────────────────────────────────────────────┘
alter table public.profiles enable row level security;
alter table public.blood_tests enable row level security;
alter table public.protocols enable row level security;
alter table public.daily_metrics enable row level security;
alter table public.share_links enable row level security;
alter table public.compliance_logs enable row level security;

-- Defense in depth: force RLS even for table owner
alter table public.profiles force row level security;
alter table public.blood_tests force row level security;
alter table public.protocols force row level security;

drop policy if exists "profiles_select" on public.profiles;
drop policy if exists "profiles_insert" on public.profiles;
drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_select" on public.profiles for select
  using (auth.uid() = id and deleted_at is null);
create policy "profiles_insert" on public.profiles for insert
  with check (auth.uid() = id);
create policy "profiles_update" on public.profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);

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
-- │ 10. GRANTS                                                               │
-- └──────────────────────────────────────────────────────────────────────────┘
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.share_links to anon;
grant update(view_count) on public.share_links to anon;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
grant execute on all functions in schema public to authenticated, service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant execute on functions to authenticated;

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ 11. TRIGGERS                                                             │
-- └──────────────────────────────────────────────────────────────────────────┘
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

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
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

create or replace function public.set_completed_at()
returns trigger language plpgsql as $$
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

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ 12. HELPER FUNCTIONS                                                     │
-- └──────────────────────────────────────────────────────────────────────────┘
create or replace function public.get_current_streak(p_user_id uuid)
returns integer language sql stable as $$
  with daily as (
    select date from public.compliance_logs
    where user_id = p_user_id and completed = true
    group by date order by date desc
  ),
  gaps as (
    select date, date - (row_number() over (order by date desc))::int as grp
    from daily
  )
  select count(*)::int from gaps where grp = (select grp from gaps limit 1);
$$;

create or replace function public.get_adherence_rate(p_user_id uuid, p_days integer default 30)
returns numeric language sql stable as $$
  select case when count(*) = 0 then 0
              else round(100.0 * sum(case when completed then 1 else 0 end)::numeric / count(*), 1)
         end
  from public.compliance_logs
  where user_id = p_user_id and date >= current_date - p_days;
$$;

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

-- Atomic increment of share_links.view_count — prevents read-then-update race.
-- Returns the new view_count so callers can show the updated value without re-querying.
create or replace function public.increment_share_view(p_slug text)
returns integer language sql as $$
  update public.share_links
     set view_count = coalesce(view_count, 0) + 1
   where slug = p_slug
   returning view_count;
$$;
grant execute on function public.increment_share_view(text) to anon, authenticated;

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ 13. REALTIME PUBLICATION                                                 │
-- └──────────────────────────────────────────────────────────────────────────┘
do $$ begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'daily_metrics') then
    alter publication supabase_realtime add table public.daily_metrics;
  end if;
exception when others then null;
end $$;

do $$ begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'compliance_logs') then
    alter publication supabase_realtime add table public.compliance_logs;
  end if;
exception when others then null;
end $$;

do $$ begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'protocols') then
    alter publication supabase_realtime add table public.protocols;
  end if;
exception when others then null;
end $$;

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ 14. BACKFILL                                                             │
-- └──────────────────────────────────────────────────────────────────────────┘
insert into public.profiles (id)
select u.id from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- ============================================================================
-- DONE. Verify:
--   select column_name from information_schema.columns where table_name = 'protocols';
--   select indexname from pg_indexes where schemaname = 'public' order by indexname;
--   select proname from pg_proc where pronamespace = 'public'::regnamespace;
--   select tablename from pg_publication_tables where pubname = 'supabase_realtime';
-- ============================================================================
