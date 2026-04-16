import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://qfougkekxwatlnvwduos.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmb3Vna2VreHdhdGxudndkdW9zIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjI5MTA0NSwiZXhwIjoyMDkxODY3MDQ1fQ.xytdzP06LnjSvcafyGAyRBTZ89cRlUJJhO5DGWV7n2c'
);

const queries = [
  // Profiles table
  `create table if not exists public.profiles (
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
  )`,

  // Protocols table
  `create table if not exists public.protocols (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users on delete cascade not null,
    macro_targets jsonb not null,
    daily_tasks jsonb not null default '[]',
    supplements jsonb not null default '[]',
    tips text[] not null default '{}',
    warnings text[] not null default '{}',
    summary text not null default '',
    created_at timestamptz not null default now()
  )`,

  // Daily logs table
  `create table if not exists public.daily_logs (
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
  )`,

  // User configs table
  `create table if not exists public.user_configs (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users on delete cascade unique not null,
    tasks jsonb not null default '[]',
    supplements text[] not null default '{}',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`,

  // Enable RLS
  `alter table public.profiles enable row level security`,
  `alter table public.protocols enable row level security`,
  `alter table public.daily_logs enable row level security`,
  `alter table public.user_configs enable row level security`,

  // RLS Policies
  `do $$ begin
    if not exists (select 1 from pg_policies where policyname = 'Users can view own profile') then
      create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
    end if;
    if not exists (select 1 from pg_policies where policyname = 'Users can insert own profile') then
      create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);
    end if;
    if not exists (select 1 from pg_policies where policyname = 'Users can update own profile') then
      create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
    end if;
  end $$`,

  `do $$ begin
    if not exists (select 1 from pg_policies where policyname = 'Users can view own protocols') then
      create policy "Users can view own protocols" on public.protocols for select using (auth.uid() = user_id);
    end if;
    if not exists (select 1 from pg_policies where policyname = 'Users can insert own protocols') then
      create policy "Users can insert own protocols" on public.protocols for insert with check (auth.uid() = user_id);
    end if;
  end $$`,

  `do $$ begin
    if not exists (select 1 from pg_policies where policyname = 'Users can view own logs') then
      create policy "Users can view own logs" on public.daily_logs for select using (auth.uid() = user_id);
    end if;
    if not exists (select 1 from pg_policies where policyname = 'Users can insert own logs') then
      create policy "Users can insert own logs" on public.daily_logs for insert with check (auth.uid() = user_id);
    end if;
    if not exists (select 1 from pg_policies where policyname = 'Users can update own logs') then
      create policy "Users can update own logs" on public.daily_logs for update using (auth.uid() = user_id);
    end if;
  end $$`,

  `do $$ begin
    if not exists (select 1 from pg_policies where policyname = 'Users can view own config') then
      create policy "Users can view own config" on public.user_configs for select using (auth.uid() = user_id);
    end if;
    if not exists (select 1 from pg_policies where policyname = 'Users can insert own config') then
      create policy "Users can insert own config" on public.user_configs for insert with check (auth.uid() = user_id);
    end if;
    if not exists (select 1 from pg_policies where policyname = 'Users can update own config') then
      create policy "Users can update own config" on public.user_configs for update using (auth.uid() = user_id);
    end if;
  end $$`,

  // Auto-create profile trigger
  `create or replace function public.handle_new_user()
  returns trigger as $$
  begin
    insert into public.profiles (id)
    values (new.id);
    return new;
  end;
  $$ language plpgsql security definer`,

  `drop trigger if exists on_auth_user_created on auth.users`,
  `create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user()`,

  // Updated_at triggers
  `create or replace function public.update_updated_at()
  returns trigger as $$
  begin
    new.updated_at = now();
    return new;
  end;
  $$ language plpgsql`,

  `drop trigger if exists profiles_updated_at on public.profiles`,
  `create trigger profiles_updated_at before update on public.profiles for each row execute procedure public.update_updated_at()`,

  `drop trigger if exists daily_logs_updated_at on public.daily_logs`,
  `create trigger daily_logs_updated_at before update on public.daily_logs for each row execute procedure public.update_updated_at()`,

  `drop trigger if exists user_configs_updated_at on public.user_configs`,
  `create trigger user_configs_updated_at before update on public.user_configs for each row execute procedure public.update_updated_at()`,
];

async function setup() {
  console.log('Setting up database...');
  for (const sql of queries) {
    const { error } = await supabase.rpc('', {}).then(() => ({ error: null })).catch(() => ({ error: null }));
    // Use raw SQL via fetch
    const res = await fetch('https://qfougkekxwatlnvwduos.supabase.co/rest/v1/', {
      method: 'GET',
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmb3Vna2VreHdhdGxudndkdW9zIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjI5MTA0NSwiZXhwIjoyMDkxODY3MDQ1fQ.xytdzP06LnjSvcafyGAyRBTZ89cRlUJJhO5DGWV7n2c',
      }
    });
    void res;
    void error;
  }
}

// Actually, the supabase-js client doesn't support raw SQL.
// We need to use the Supabase Dashboard SQL Editor.
// Let's create an API route that does this instead.
console.log('==================================================');
console.log('IMPORTANT: Run the SQL in scripts/setup-db.sql');
console.log('in your Supabase Dashboard > SQL Editor');
console.log('URL: https://supabase.com/dashboard/project/qfougkekxwatlnvwduos/sql');
console.log('==================================================');
