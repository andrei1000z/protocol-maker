-- MIGRATION: Drop old tables and recreate for Protocol Engine
-- Run this in Supabase Dashboard > SQL Editor

-- Drop old policies
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "profiles_select" on public.profiles;
drop policy if exists "profiles_insert" on public.profiles;
drop policy if exists "profiles_update" on public.profiles;

drop policy if exists "Users can view own protocols" on public.protocols;
drop policy if exists "Users can insert own protocols" on public.protocols;
drop policy if exists "Users can delete own protocols" on public.protocols;
drop policy if exists "protocols_select" on public.protocols;
drop policy if exists "protocols_insert" on public.protocols;
drop policy if exists "protocols_delete" on public.protocols;

drop policy if exists "Users can view own logs" on public.daily_logs;
drop policy if exists "Users can insert own logs" on public.daily_logs;
drop policy if exists "Users can update own logs" on public.daily_logs;
drop policy if exists "Users can delete own logs" on public.daily_logs;

drop policy if exists "Users can view own config" on public.user_configs;
drop policy if exists "Users can insert own config" on public.user_configs;
drop policy if exists "Users can update own config" on public.user_configs;
drop policy if exists "Users can delete own config" on public.user_configs;

drop policy if exists "blood_tests_select" on public.blood_tests;
drop policy if exists "blood_tests_insert" on public.blood_tests;
drop policy if exists "blood_tests_delete" on public.blood_tests;

-- Drop old trigger
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists profiles_updated_at on public.profiles;
drop trigger if exists daily_logs_updated_at on public.daily_logs;
drop trigger if exists user_configs_updated_at on public.user_configs;

-- Drop old tables (order matters due to foreign keys)
drop table if exists public.user_configs cascade;
drop table if exists public.daily_logs cascade;
drop table if exists public.protocols cascade;
drop table if exists public.blood_tests cascade;
drop table if exists public.profiles cascade;

-- Drop old functions
drop function if exists public.handle_new_user();
drop function if exists public.update_updated_at();

-- ============================================
-- NEW SCHEMA: Protocol Engine
-- ============================================

create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  age integer,
  sex text,
  height_cm real,
  weight_kg real,
  ethnicity text,
  latitude real,
  occupation text,
  activity_level text default 'moderate',
  sleep_hours_avg real,
  sleep_quality integer,
  diet_type text default 'omnivore',
  alcohol_drinks_per_week integer default 0,
  caffeine_mg_per_day integer default 0,
  smoker boolean default false,
  cardio_minutes_per_week integer default 0,
  strength_sessions_per_week integer default 0,
  conditions text[] default '{}',
  medications jsonb default '[]',
  current_supplements text[] default '{}',
  allergies text[] default '{}',
  goals jsonb default '[]',
  time_budget_min integer default 60,
  monthly_budget_ron integer default 500,
  experimental_openness text default 'otc_only',
  onboarding_completed boolean default false,
  onboarding_step integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.blood_tests (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  taken_at date not null,
  lab_name text,
  biomarkers jsonb not null default '[]',
  created_at timestamptz default now()
);

create table public.protocols (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  based_on_blood_test_id uuid references public.blood_tests,
  protocol_json jsonb not null,
  classified_biomarkers jsonb,
  detected_patterns jsonb,
  longevity_score integer,
  biological_age integer,
  model_used text default 'llama-3.3-70b-versatile',
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.blood_tests enable row level security;
alter table public.protocols enable row level security;

-- RLS Policies
create policy "profiles_select" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);

create policy "blood_tests_select" on public.blood_tests for select using (auth.uid() = user_id);
create policy "blood_tests_insert" on public.blood_tests for insert with check (auth.uid() = user_id);
create policy "blood_tests_delete" on public.blood_tests for delete using (auth.uid() = user_id);

create policy "protocols_select" on public.protocols for select using (auth.uid() = user_id);
create policy "protocols_insert" on public.protocols for insert with check (auth.uid() = user_id);
create policy "protocols_delete" on public.protocols for delete using (auth.uid() = user_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Recreate profile for existing user
insert into public.profiles (id)
select id from auth.users
where id not in (select id from public.profiles)
on conflict do nothing;
