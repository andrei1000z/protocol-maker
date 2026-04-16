-- Protocol Maker Database Schema
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)

-- Profiles table
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null default '',
  age integer not null default 25,
  sex text not null default 'M',
  height real not null default 175,
  weight real not null default 75,
  goals text[] not null default '{}',
  fitness_level text not null default 'beginner',
  macro_targets jsonb not null default '{"calories": 2200, "protein": 150, "carbs": 250, "fat": 70}',
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Generated protocols
create table if not exists public.protocols (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  macro_targets jsonb not null,
  daily_tasks jsonb not null default '[]',
  supplements jsonb not null default '[]',
  tips text[] not null default '{}',
  warnings text[] not null default '{}',
  summary text not null default '',
  created_at timestamptz not null default now()
);

-- Daily logs
create table if not exists public.daily_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  date date not null,
  tasks jsonb not null default '[]',
  supplements jsonb not null default '[]',
  meals jsonb not null default '[]',
  water integer not null default 0,
  mood integer not null default 0,
  energy integer not null default 0,
  focus integer not null default 0,
  notes text not null default '',
  watch_metrics jsonb not null default '{}',
  weight real,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, date)
);

-- User config (custom tasks, supplements)
create table if not exists public.user_configs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade unique not null,
  tasks jsonb not null default '[]',
  supplements text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable Row Level Security
alter table public.profiles enable row level security;
alter table public.protocols enable row level security;
alter table public.daily_logs enable row level security;
alter table public.user_configs enable row level security;

-- RLS Policies: users can only access their own data
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

create policy "Users can view own protocols" on public.protocols for select using (auth.uid() = user_id);
create policy "Users can insert own protocols" on public.protocols for insert with check (auth.uid() = user_id);
create policy "Users can delete own protocols" on public.protocols for delete using (auth.uid() = user_id);

create policy "Users can view own logs" on public.daily_logs for select using (auth.uid() = user_id);
create policy "Users can insert own logs" on public.daily_logs for insert with check (auth.uid() = user_id);
create policy "Users can update own logs" on public.daily_logs for update using (auth.uid() = user_id);
create policy "Users can delete own logs" on public.daily_logs for delete using (auth.uid() = user_id);

create policy "Users can view own config" on public.user_configs for select using (auth.uid() = user_id);
create policy "Users can insert own config" on public.user_configs for insert with check (auth.uid() = user_id);
create policy "Users can update own config" on public.user_configs for update using (auth.uid() = user_id);
create policy "Users can delete own config" on public.user_configs for delete using (auth.uid() = user_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Updated_at trigger
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at before update on public.profiles
  for each row execute procedure public.update_updated_at();
create trigger daily_logs_updated_at before update on public.daily_logs
  for each row execute procedure public.update_updated_at();
create trigger user_configs_updated_at before update on public.user_configs
  for each row execute procedure public.update_updated_at();
