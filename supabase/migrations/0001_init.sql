-- ============================================================================
-- PROTOCOL MAKER — INITIAL SCHEMA (unified, idempotent, safe to re-run)
-- ============================================================================
-- This is the single source of truth for the database schema. Paste this
-- into Supabase SQL Editor once. It creates everything from scratch on a
-- fresh database AND brings an existing database up to date (all DDL uses
-- IF NOT EXISTS / IF EXISTS / DROP+CREATE patterns).
--
-- 9 tables: profiles, blood_tests, protocols, daily_metrics, share_links,
-- compliance_logs, oauth_connections, chat_messages, meals.
--
-- Also installs: 2 extensions, 40+ indexes, RLS policies, FORCE RLS on 9
-- tables, 13 RPC functions, triggers (updated_at / completed_at / new-user
-- signup / referral code), realtime publication on 3 tables, grants.
--
-- Structure:
--   §0  Extensions
--   §1  Tables (CREATE TABLE IF NOT EXISTS, then ALTER ... ADD COLUMN IF
--       NOT EXISTS for every nullable column — covers both fresh installs
--       and upgrades from older partial schemas).
--   §2  Check constraints (wrapped in DO blocks for idempotency)
--   §3  Indexes
--   §4  RLS enable + force
--   §5  Policies
--   §6  Grants
--   §7  Triggers + trigger functions
--   §8  RPC functions
--   §9  Realtime publication
--   §10 Backfill
-- ============================================================================

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ §0. EXTENSIONS                                                           │
-- └──────────────────────────────────────────────────────────────────────────┘
create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "pg_trgm";    -- fuzzy text search on biomarkers

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ §1. TABLES                                                               │
-- └──────────────────────────────────────────────────────────────────────────┘

-- 1.1 PROFILES — one row per user, grown during onboarding.
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  created_at timestamptz default now()
);

alter table public.profiles add column if not exists age integer;
alter table public.profiles add column if not exists sex text;
alter table public.profiles add column if not exists height_cm real;
alter table public.profiles add column if not exists weight_kg real;
alter table public.profiles add column if not exists ethnicity text;
alter table public.profiles add column if not exists latitude real;
alter table public.profiles add column if not exists occupation text;
alter table public.profiles add column if not exists activity_level text default 'moderate';
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
alter table public.profiles add column if not exists onboarding_completed boolean default false;
alter table public.profiles add column if not exists onboarding_step integer default 0;
alter table public.profiles add column if not exists onboarding_data jsonb default '{}'::jsonb;
alter table public.profiles add column if not exists updated_at timestamptz default now();
alter table public.profiles add column if not exists deleted_at timestamptz;
-- Notification preferences — opt-in bitmap. Actual email delivery requires
-- a transactional provider (Resend/Postmark); until that ships these flags
-- are a preference record that future workers read.
alter table public.profiles add column if not exists notif_weekly_digest boolean default false;
alter table public.profiles add column if not exists notif_protocol_regen boolean default true;
alter table public.profiles add column if not exists notif_retest_reminders boolean default false;
alter table public.profiles add column if not exists notif_streak_milestones boolean default false;
-- Stripe subscription state — written server-side only via webhook.
alter table public.profiles add column if not exists subscription_status text;
alter table public.profiles add column if not exists subscription_tier text;
alter table public.profiles add column if not exists subscription_customer_id text;
alter table public.profiles add column if not exists subscription_current_period_end timestamptz;
-- Referral system — 6-char uppercase code, generated on insert.
alter table public.profiles add column if not exists referral_code text unique;
alter table public.profiles add column if not exists referred_by_user_id uuid references auth.users on delete set null;
alter table public.profiles add column if not exists referred_by_code text;

-- 1.2 BLOOD_TESTS — each upload creates a new row; full history kept.
create table if not exists public.blood_tests (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  taken_at date not null,
  biomarkers jsonb not null default '[]'::jsonb,
  created_at timestamptz default now()
);
alter table public.blood_tests add column if not exists lab_name text;
alter table public.blood_tests add column if not exists notes text;
alter table public.blood_tests add column if not exists deleted_at timestamptz;

-- 1.3 PROTOCOLS — generated longevity protocols; full history kept.
create table if not exists public.protocols (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  based_on_blood_test_id uuid references public.blood_tests on delete set null,
  protocol_json jsonb not null,
  created_at timestamptz default now()
);
alter table public.protocols add column if not exists classified_biomarkers jsonb;
alter table public.protocols add column if not exists detected_patterns jsonb;
alter table public.protocols add column if not exists longevity_score integer;
alter table public.protocols add column if not exists biological_age integer;
alter table public.protocols add column if not exists biological_age_decimal numeric(4,1);
alter table public.protocols add column if not exists aging_pace numeric(4,2);
alter table public.protocols add column if not exists model_used text default 'claude-sonnet-4-5';
alter table public.protocols add column if not exists generation_source text;
alter table public.protocols add column if not exists deleted_at timestamptz;
-- Drop legacy columns from older app versions that caused insert errors.
alter table public.protocols drop column if exists prompt_hash;
alter table public.protocols drop column if exists generation_time_ms;

-- 1.4 DAILY_METRICS — tracking, one row per user per day.
create table if not exists public.daily_metrics (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  date date not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, date)
);
-- Self-reported core
alter table public.daily_metrics add column if not exists weight_kg real;
alter table public.daily_metrics add column if not exists sleep_hours real;
alter table public.daily_metrics add column if not exists sleep_quality integer;
alter table public.daily_metrics add column if not exists mood integer;
alter table public.daily_metrics add column if not exists energy integer;
alter table public.daily_metrics add column if not exists hrv integer;
alter table public.daily_metrics add column if not exists resting_hr integer;
alter table public.daily_metrics add column if not exists steps integer;
alter table public.daily_metrics add column if not exists workout_done boolean default false;
alter table public.daily_metrics add column if not exists workout_minutes integer;
alter table public.daily_metrics add column if not exists workout_intensity text;
alter table public.daily_metrics add column if not exists stress_level integer;
alter table public.daily_metrics add column if not exists habits_completed text[] default '{}';
alter table public.daily_metrics add column if not exists notes text;
-- Wearable-grade metrics
alter table public.daily_metrics add column if not exists sleep_hours_planned real;
alter table public.daily_metrics add column if not exists sleep_score integer;
alter table public.daily_metrics add column if not exists deep_sleep_min integer;
alter table public.daily_metrics add column if not exists light_sleep_min integer;
alter table public.daily_metrics add column if not exists rem_sleep_min integer;
alter table public.daily_metrics add column if not exists awake_min integer;
alter table public.daily_metrics add column if not exists blood_oxygen_avg_sleep real;
alter table public.daily_metrics add column if not exists skin_temp_deviation real;
alter table public.daily_metrics add column if not exists skin_temp_deviation_min real;
alter table public.daily_metrics add column if not exists skin_temp_deviation_max real;
alter table public.daily_metrics add column if not exists hrv_sleep_avg integer;
alter table public.daily_metrics add column if not exists bp_systolic_morning integer;
alter table public.daily_metrics add column if not exists bp_diastolic_morning integer;
alter table public.daily_metrics add column if not exists bp_systolic_evening integer;
alter table public.daily_metrics add column if not exists bp_diastolic_evening integer;
alter table public.daily_metrics add column if not exists avg_heart_rate integer;
alter table public.daily_metrics add column if not exists min_heart_rate integer;
alter table public.daily_metrics add column if not exists max_heart_rate integer;
alter table public.daily_metrics add column if not exists avg_respiratory_rate real;
alter table public.daily_metrics add column if not exists energy_score integer;
alter table public.daily_metrics add column if not exists active_time_min integer;
alter table public.daily_metrics add column if not exists activity_calories integer;
alter table public.daily_metrics add column if not exists antioxidant_index integer;
-- Morning fasted composition
alter table public.daily_metrics add column if not exists body_fat_pct real;
alter table public.daily_metrics add column if not exists muscle_mass_kg real;
alter table public.daily_metrics add column if not exists visceral_fat integer;
alter table public.daily_metrics add column if not exists body_water_pct real;
alter table public.daily_metrics add column if not exists bone_mass_kg real;
alter table public.daily_metrics add column if not exists bmr_kcal integer;
alter table public.daily_metrics add column if not exists basal_body_temp_c real;
alter table public.daily_metrics add column if not exists body_score integer;
alter table public.daily_metrics add column if not exists stress_level_avg integer;
alter table public.daily_metrics add column if not exists stress_bedtime integer;
-- ORPHAN: ages_index — created in older schemas, never written by any device
-- or read by any UI. Drop if present to keep the column list clean.
alter table public.daily_metrics drop column if exists ages_index;

-- 1.5 SHARE_LINKS — public read-only snapshot by slug.
create table if not exists public.share_links (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  protocol_id uuid references public.protocols on delete cascade not null,
  slug text unique not null,
  view_count integer default 0,
  created_at timestamptz default now()
);
alter table public.share_links add column if not exists expires_at timestamptz;

-- 1.6 COMPLIANCE_LOGS — per-day adherence ticks.
create table if not exists public.compliance_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  protocol_id uuid,
  item_type text not null,
  item_name text not null,
  date date not null,
  completed boolean default false,
  unique(user_id, item_type, item_name, date)
);
alter table public.compliance_logs add column if not exists completed_at timestamptz;

-- 1.7 OAUTH_CONNECTIONS — third-party wearable tokens. Sensitive; owner
-- reads via service role, writes only from the OAuth callback routes.
create table if not exists public.oauth_connections (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  provider text not null,
  access_token text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, provider)
);
alter table public.oauth_connections add column if not exists refresh_token text;
alter table public.oauth_connections add column if not exists token_type text default 'Bearer';
alter table public.oauth_connections add column if not exists expires_at timestamptz;
alter table public.oauth_connections add column if not exists scopes text;
alter table public.oauth_connections add column if not exists provider_user_id text;
alter table public.oauth_connections add column if not exists last_synced_at timestamptz;
alter table public.oauth_connections add column if not exists last_sync_error text;

-- 1.8 CHAT_MESSAGES — server-persisted conversation history. 90-day retention
-- via prune_old_chat_messages() RPC called from the daily cron.
create table if not exists public.chat_messages (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);
alter table public.chat_messages add column if not exists model text;

-- 1.9 MEALS — AI-analyzed meal log (photo + text → macros + verdict).
-- Photo bytes NEVER stored; only extracted data + short reasons. The
-- nutrition_detail JSONB bag holds everything beyond the core 5 macros
-- (sugar, sodium, cholesterol, micros, NOVA, GI, quality flags) — one
-- JSONB column avoids migrations for every new field.
create table if not exists public.meals (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  eaten_at timestamptz not null default now(),
  source text not null check (source in ('photo', 'text', 'photo_with_text')),
  title text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.meals add column if not exists user_text text;
alter table public.meals add column if not exists description text;
alter table public.meals add column if not exists ingredients text[] default '{}';
alter table public.meals add column if not exists calories integer;
alter table public.meals add column if not exists protein_g real;
alter table public.meals add column if not exists carbs_g real;
alter table public.meals add column if not exists fat_g real;
alter table public.meals add column if not exists fiber_g real;
alter table public.meals add column if not exists verdict text check (verdict in ('good', 'mixed', 'bad'));
alter table public.meals add column if not exists verdict_reasons text[] default '{}';
alter table public.meals add column if not exists ai_model text;
alter table public.meals add column if not exists input_tokens integer;
alter table public.meals add column if not exists output_tokens integer;
alter table public.meals add column if not exists nutrition_detail jsonb default '{}'::jsonb;
alter table public.meals add column if not exists longevity_impact_score smallint;

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ §2. CHECK CONSTRAINTS — added as NOT VALID then VALIDATEd (non-blocking) │
-- └──────────────────────────────────────────────────────────────────────────┘
-- Each constraint wrapped in DO block so it's idempotent. Existing data that
-- violates is silently tolerated (exception-catch at the end).

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_sex_check') then
    alter table public.profiles add constraint profiles_sex_check
      check (sex in ('male', 'female', 'intersex') or sex is null) not valid;
    alter table public.profiles validate constraint profiles_sex_check;
  end if;
exception when others then null; end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_activity_check') then
    alter table public.profiles add constraint profiles_activity_check
      check (activity_level in ('sedentary', 'light', 'moderate', 'active', 'elite')) not valid;
    alter table public.profiles validate constraint profiles_activity_check;
  end if;
exception when others then null; end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_diet_check') then
    alter table public.profiles add constraint profiles_diet_check
      check (diet_type in ('omnivore','vegetarian','vegan','keto','carnivore','mediterranean','custom') or diet_type is null) not valid;
    alter table public.profiles validate constraint profiles_diet_check;
  end if;
exception when others then null; end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_experimental_check') then
    alter table public.profiles add constraint profiles_experimental_check
      check (experimental_openness in ('otc_only', 'open_rx', 'open_experimental')) not valid;
    alter table public.profiles validate constraint profiles_experimental_check;
  end if;
exception when others then null; end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'protocols_score_range') then
    alter table public.protocols add constraint protocols_score_range
      check (longevity_score is null or longevity_score between 0 and 100) not valid;
    alter table public.protocols validate constraint protocols_score_range;
  end if;
exception when others then null; end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'protocols_pace_range') then
    alter table public.protocols add constraint protocols_pace_range
      check (aging_pace is null or aging_pace between 0.4 and 2.0) not valid;
    alter table public.protocols validate constraint protocols_pace_range;
  end if;
exception when others then null; end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'compliance_item_type_check') then
    alter table public.compliance_logs add constraint compliance_item_type_check
      check (item_type in ('task', 'supplement', 'habit', 'meal', 'workout')) not valid;
    alter table public.compliance_logs validate constraint compliance_item_type_check;
  end if;
exception when others then null; end $$;

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

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'meals_longevity_impact_range') then
    alter table public.meals add constraint meals_longevity_impact_range
      check (longevity_impact_score is null or longevity_impact_score between -5 and 5) not valid;
    alter table public.meals validate constraint meals_longevity_impact_range;
  end if;
exception when others then null; end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'meals_calories_range') then
    alter table public.meals add constraint meals_calories_range
      check (calories is null or calories between 0 and 10000) not valid;
    alter table public.meals validate constraint meals_calories_range;
  end if;
exception when others then null; end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'meals_macros_range') then
    alter table public.meals add constraint meals_macros_range
      check (
        (protein_g is null or protein_g between 0 and 500)
        and (carbs_g is null or carbs_g between 0 and 1000)
        and (fat_g   is null or fat_g   between 0 and 500)
        and (fiber_g is null or fiber_g between 0 and 300)
      ) not valid;
    alter table public.meals validate constraint meals_macros_range;
  end if;
exception when others then null; end $$;

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ §3. INDEXES                                                              │
-- └──────────────────────────────────────────────────────────────────────────┘
-- Hot paths
create index if not exists idx_blood_tests_user_date on public.blood_tests(user_id, taken_at desc)
  where deleted_at is null;
-- One non-deleted blood test per user per day (unique partial index).
create unique index if not exists uq_blood_tests_user_date_active
  on public.blood_tests(user_id, taken_at)
  where deleted_at is null;
create index if not exists idx_protocols_user_created on public.protocols(user_id, created_at desc)
  where deleted_at is null;
create index if not exists idx_daily_metrics_user_date on public.daily_metrics(user_id, date desc);
create index if not exists idx_compliance_user_date on public.compliance_logs(user_id, date desc);
create index if not exists idx_compliance_completed on public.compliance_logs(user_id, date, completed)
  where completed = true;
create index if not exists idx_profiles_onboarded on public.profiles(id)
  where onboarding_completed = true and deleted_at is null;

-- JSONB GIN (jsonb_path_ops — smaller + faster than default jsonb_ops)
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

-- Array GIN
create index if not exists idx_profiles_conditions on public.profiles using gin (conditions);
create index if not exists idx_profiles_allergies on public.profiles using gin (allergies);
create index if not exists idx_daily_metrics_habits on public.daily_metrics using gin (habits_completed);

-- Share + chat + meals
create index if not exists idx_share_links_slug on public.share_links(slug);
create index if not exists idx_chat_messages_user_created on public.chat_messages(user_id, created_at desc);
create index if not exists idx_meals_user_eaten on public.meals(user_id, eaten_at desc);

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ §4. RLS                                                                  │
-- └──────────────────────────────────────────────────────────────────────────┘
alter table public.profiles enable row level security;
alter table public.blood_tests enable row level security;
alter table public.protocols enable row level security;
alter table public.daily_metrics enable row level security;
alter table public.share_links enable row level security;
alter table public.compliance_logs enable row level security;
alter table public.chat_messages enable row level security;
alter table public.oauth_connections enable row level security;
alter table public.meals enable row level security;

-- Defense in depth: force RLS even for table owner. A future route that
-- accidentally uses the service-role client without a user filter would
-- otherwise leak rows across users.
alter table public.profiles force row level security;
alter table public.blood_tests force row level security;
alter table public.protocols force row level security;
alter table public.daily_metrics force row level security;
alter table public.share_links force row level security;
alter table public.compliance_logs force row level security;
alter table public.chat_messages force row level security;
alter table public.oauth_connections force row level security;
alter table public.meals force row level security;

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ §5. POLICIES                                                             │
-- └──────────────────────────────────────────────────────────────────────────┘
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
create policy "share_links_owner" on public.share_links for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "share_links_public_read" on public.share_links for select using (true);
create policy "share_links_increment" on public.share_links for update using (true);

drop policy if exists "compliance_own" on public.compliance_logs;
create policy "compliance_own" on public.compliance_logs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "chat_messages_own" on public.chat_messages;
create policy "chat_messages_own" on public.chat_messages for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- oauth_connections: owner can SELECT metadata (status badge in settings);
-- writes happen via service role (callback + sync), which bypasses RLS.
drop policy if exists "oauth_connections_own" on public.oauth_connections;
create policy "oauth_connections_own" on public.oauth_connections for select
  using (auth.uid() = user_id);

drop policy if exists "meals_own" on public.meals;
create policy "meals_own" on public.meals for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ §6. GRANTS                                                               │
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
-- │ §7. TRIGGERS                                                             │
-- └──────────────────────────────────────────────────────────────────────────┘

-- Auto-create profile on new user signup.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Keep updated_at fresh on writes.
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
drop trigger if exists meals_set_updated_at on public.meals;
create trigger meals_set_updated_at before update on public.meals
  for each row execute procedure public.set_updated_at();
drop trigger if exists oauth_connections_set_updated_at on public.oauth_connections;
create trigger oauth_connections_set_updated_at before update on public.oauth_connections
  for each row execute procedure public.set_updated_at();

-- Auto-stamp completed_at when compliance item is flipped to done.
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

-- Referral code generator (6-char base32-ish, collision-retrying).
create or replace function public.generate_referral_code()
returns text language plpgsql as $$
declare
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';  -- drops ambiguous 0/O/1/I/L
  code text;
  i int;
begin
  for i in 1..5 loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    if not exists (select 1 from public.profiles where referral_code = code) then
      return code;
    end if;
  end loop;
  return code || to_char(extract(epoch from clock_timestamp()) * 1000, 'FM999999999999');
end;
$$;

-- Backfill missing referral codes for existing profiles.
update public.profiles
set referral_code = public.generate_referral_code()
where referral_code is null;

create or replace function public.ensure_referral_code()
returns trigger language plpgsql as $$
begin
  if new.referral_code is null then
    new.referral_code := public.generate_referral_code();
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_ensure_referral_code on public.profiles;
create trigger profiles_ensure_referral_code before insert on public.profiles
  for each row execute procedure public.ensure_referral_code();

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ §8. RPC FUNCTIONS                                                        │
-- └──────────────────────────────────────────────────────────────────────────┘

-- Current streak: consecutive days with ≥1 completed compliance item.
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
  select count(*)::int from gaps where grp = (select grp from gaps limit 1);
$$;

-- Adherence rate (% completed) over the last N days.
create or replace function public.get_adherence_rate(p_user_id uuid, p_days integer default 30)
returns numeric language sql stable as $$
  select case when count(*) = 0 then 0
              else round(100.0 * sum(case when completed then 1 else 0 end)::numeric / count(*), 1)
         end
  from public.compliance_logs
  where user_id = p_user_id and date >= current_date - p_days;
$$;

-- Latest bio age + pace + longevity score for a user.
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
create or replace function public.increment_share_view(p_slug text)
returns integer language sql as $$
  update public.share_links
     set view_count = coalesce(view_count, 0) + 1
   where slug = p_slug
   returning view_count;
$$;
grant execute on function public.increment_share_view(text) to anon, authenticated;

-- Atomic partial-upsert for daily_metrics. Replaces the read-merge-write path
-- which silently lost writes when two tabs hit the same date.
create or replace function public.apply_daily_metric_patch(
  p_user_id uuid,
  p_date date,
  p_patch jsonb
) returns void
language plpgsql security definer set search_path = public as $$
declare
  update_set text;
  rec public.daily_metrics;
begin
  if p_user_id is null or p_user_id <> auth.uid() then
    raise exception 'not authorized';
  end if;
  p_patch := p_patch - array['id','user_id','date','created_at','updated_at'];
  select string_agg(format('%I = coalesce(excluded.%I, daily_metrics.%I)', key, key, key), ', ')
    into update_set
  from jsonb_object_keys(p_patch) as key
  where exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'daily_metrics' and column_name = key
  );
  rec := jsonb_populate_record(
    null::public.daily_metrics,
    coalesce(p_patch, '{}'::jsonb) || jsonb_build_object('user_id', p_user_id, 'date', p_date)
  );
  if update_set is null then
    insert into public.daily_metrics (user_id, date) values (p_user_id, p_date)
      on conflict (user_id, date) do nothing;
    return;
  end if;
  execute format(
    'insert into public.daily_metrics select ($1).* on conflict (user_id, date) do update set %s',
    update_set
  ) using rec;
end;
$$;
grant execute on function public.apply_daily_metric_patch(uuid, date, jsonb) to authenticated;

-- Atomic partial-update for profiles + onboarding_data JSONB merge.
create or replace function public.apply_profile_patch(
  p_user_id uuid,
  p_height_cm int,
  p_weight_kg numeric,
  p_activity_level int,
  p_sleep_hours_avg numeric,
  p_cardio_minutes_per_week int,
  p_strength_sessions_per_week int,
  p_alcohol_drinks_per_week int,
  p_caffeine_mg_per_day int,
  p_smoker boolean,
  p_od_patch jsonb
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_user_id is null or p_user_id <> auth.uid() then
    raise exception 'not authorized';
  end if;
  update public.profiles set
    height_cm                  = coalesce(p_height_cm,                  height_cm),
    weight_kg                  = coalesce(p_weight_kg,                  weight_kg),
    activity_level             = coalesce(p_activity_level,             activity_level),
    sleep_hours_avg            = coalesce(p_sleep_hours_avg,            sleep_hours_avg),
    cardio_minutes_per_week    = coalesce(p_cardio_minutes_per_week,    cardio_minutes_per_week),
    strength_sessions_per_week = coalesce(p_strength_sessions_per_week, strength_sessions_per_week),
    alcohol_drinks_per_week    = coalesce(p_alcohol_drinks_per_week,    alcohol_drinks_per_week),
    caffeine_mg_per_day        = coalesce(p_caffeine_mg_per_day,        caffeine_mg_per_day),
    smoker                     = coalesce(p_smoker,                     smoker),
    onboarding_data            = case
      when p_od_patch is null or p_od_patch = '{}'::jsonb then onboarding_data
      else coalesce(onboarding_data, '{}'::jsonb) || p_od_patch
    end,
    updated_at                 = now()
  where id = p_user_id;
end;
$$;
grant execute on function public.apply_profile_patch(uuid, int, numeric, int, numeric, int, int, int, int, boolean, jsonb) to authenticated;

-- Atomic jsonb_set on the user's latest protocol.
create or replace function public.apply_protocol_adjust(
  p_user_id uuid,
  p_path text,
  p_value jsonb
) returns void
language plpgsql security definer set search_path = public as $$
declare
  path_parts text[];
begin
  if p_user_id is null or p_user_id <> auth.uid() then
    raise exception 'not authorized';
  end if;
  path_parts := string_to_array(p_path, '.');
  update public.protocols p
  set protocol_json = jsonb_set(
        coalesce(p.protocol_json, '{}'::jsonb),
        path_parts,
        p_value,
        true
      )
  where p.id = (
    select id from public.protocols
    where user_id = p_user_id and deleted_at is null
    order by created_at desc limit 1
  );
end;
$$;
grant execute on function public.apply_protocol_adjust(uuid, text, jsonb) to authenticated;

-- 90-day retention on chat history. Called from the daily cron.
create or replace function public.prune_old_chat_messages(p_days int default 90)
returns integer
language sql security definer set search_path = public as $$
  with deleted as (
    delete from public.chat_messages
    where created_at < now() - (p_days || ' days')::interval
    returning 1
  )
  select count(*)::int from deleted;
$$;
grant execute on function public.prune_old_chat_messages(int) to service_role;

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ §9. REALTIME PUBLICATION                                                 │
-- └──────────────────────────────────────────────────────────────────────────┘
do $$ begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'daily_metrics') then
    alter publication supabase_realtime add table public.daily_metrics;
  end if;
exception when others then null; end $$;

do $$ begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'compliance_logs') then
    alter publication supabase_realtime add table public.compliance_logs;
  end if;
exception when others then null; end $$;

do $$ begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'protocols') then
    alter publication supabase_realtime add table public.protocols;
  end if;
exception when others then null; end $$;

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ §10. BACKFILL                                                            │
-- └──────────────────────────────────────────────────────────────────────────┘
-- Every existing auth user gets a profile row.
insert into public.profiles (id)
select u.id from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- ============================================================================
-- DONE. Verify in SQL Editor:
--   select tablename from pg_tables where schemaname='public';
--     (expect 9: profiles, blood_tests, protocols, daily_metrics,
--      share_links, compliance_logs, oauth_connections, chat_messages, meals)
--   select relname, relforcerowsecurity from pg_class
--     where relname in ('profiles','blood_tests','protocols','daily_metrics',
--                       'share_links','compliance_logs','oauth_connections',
--                       'chat_messages','meals');
--     (all should be relforcerowsecurity=t)
--   select proname from pg_proc where pronamespace='public'::regnamespace
--     order by proname;
-- ============================================================================
