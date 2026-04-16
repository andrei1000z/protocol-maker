-- Protocol Engine - Longevity Database Schema
-- Run in Supabase Dashboard > SQL Editor

-- Profiles (auto-created on signup)
create table if not exists public.profiles (
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

-- Blood tests
create table if not exists public.blood_tests (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  taken_at date not null,
  lab_name text,
  biomarkers jsonb not null default '[]',
  created_at timestamptz default now()
);

-- Generated protocols
create table if not exists public.protocols (
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
