-- ============================================================================
-- PROTOCOL MAKER — DAILY METRICS MODULE (standalone, idempotent)
-- ============================================================================
-- Self-contained script for the tracking module. Safe to run on any DB that
-- already has auth.users. Creates:
--   - daily_metrics table with full validation
--   - Hot-path indexes (user_id + date DESC, GIN on habits)
--   - RLS with per-user policies
--   - updated_at trigger
--   - Realtime publication subscription
--   - Explicit grants
--
-- Run this in Supabase SQL Editor. Re-runnable without side effects.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ TABLE                                                                    │
-- └──────────────────────────────────────────────────────────────────────────┘
create table if not exists public.daily_metrics (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  date date not null,

  -- Body composition
  weight_kg real check (weight_kg is null or weight_kg between 2 and 500),

  -- Sleep
  sleep_hours real check (sleep_hours is null or sleep_hours between 0 and 24),
  sleep_quality integer check (sleep_quality is null or sleep_quality between 1 and 10),

  -- Subjective state
  mood integer check (mood is null or mood between 1 and 10),
  energy integer check (energy is null or energy between 1 and 10),
  stress_level integer check (stress_level is null or stress_level between 1 and 10),

  -- Cardiovascular
  hrv integer check (hrv is null or hrv between 0 and 300),
  resting_hr integer check (resting_hr is null or resting_hr between 20 and 220),

  -- Activity
  steps integer check (steps is null or steps between 0 and 200000),
  workout_done boolean default false,
  workout_minutes integer check (workout_minutes is null or workout_minutes between 0 and 1440),
  workout_intensity text check (workout_intensity in ('low','moderate','high') or workout_intensity is null),

  -- Habits (free-form: array of habit names that were completed today)
  habits_completed text[] default '{}',

  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique(user_id, date)  -- one row per user per day
);

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ CHECK CONSTRAINTS (for existing tables — add if missing)                 │
-- └──────────────────────────────────────────────────────────────────────────┘
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'daily_metrics_sleep_q_range') then
    alter table public.daily_metrics add constraint daily_metrics_sleep_q_range
      check (sleep_quality is null or sleep_quality between 1 and 10) not valid;
    alter table public.daily_metrics validate constraint daily_metrics_sleep_q_range;
  end if;
exception when others then null; end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'daily_metrics_intensity_check') then
    alter table public.daily_metrics add constraint daily_metrics_intensity_check
      check (workout_intensity in ('low','moderate','high') or workout_intensity is null) not valid;
    alter table public.daily_metrics validate constraint daily_metrics_intensity_check;
  end if;
exception when others then null; end $$;

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ INDEXES                                                                  │
-- └──────────────────────────────────────────────────────────────────────────┘
-- Hot path: "give me this user's last 30 days" — covered by desc date
create index if not exists idx_daily_metrics_user_date
  on public.daily_metrics(user_id, date desc);

-- Fast habit search: "which users did meditation yesterday"
create index if not exists idx_daily_metrics_habits
  on public.daily_metrics using gin (habits_completed);

-- Workout-only queries
create index if not exists idx_daily_metrics_workouts
  on public.daily_metrics(user_id, date desc)
  where workout_done = true;

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ RLS                                                                      │
-- └──────────────────────────────────────────────────────────────────────────┘
alter table public.daily_metrics enable row level security;

drop policy if exists "daily_metrics_own" on public.daily_metrics;
create policy "daily_metrics_own" on public.daily_metrics
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ GRANTS                                                                   │
-- └──────────────────────────────────────────────────────────────────────────┘
grant select, insert, update, delete on public.daily_metrics to authenticated;
grant all on public.daily_metrics to service_role;

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ TRIGGER — auto-refresh updated_at                                        │
-- └──────────────────────────────────────────────────────────────────────────┘
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists daily_metrics_set_updated_at on public.daily_metrics;
create trigger daily_metrics_set_updated_at
  before update on public.daily_metrics
  for each row execute procedure public.set_updated_at();

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ REALTIME — live dashboard updates without polling                        │
-- └──────────────────────────────────────────────────────────────────────────┘
-- Client subscribes:
--   supabase.channel('metrics')
--     .on('postgres_changes', {
--        event: '*', schema: 'public', table: 'daily_metrics',
--        filter: `user_id=eq.${userId}`
--     }, handler)
--     .subscribe()

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'daily_metrics'
  ) then
    alter publication supabase_realtime add table public.daily_metrics;
  end if;
exception when others then null;
end $$;

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ HELPER FUNCTIONS for common queries                                      │
-- └──────────────────────────────────────────────────────────────────────────┘

-- 7-day moving average of a numeric metric (weight, sleep, mood, etc.)
create or replace function public.get_metric_trend(
  p_user_id uuid,
  p_metric text,
  p_days integer default 30
)
returns table(date date, value numeric, rolling_avg numeric)
language plpgsql stable as $$
declare
  col text;
begin
  -- Validate metric name against the whitelisted columns
  if p_metric not in ('weight_kg','sleep_hours','sleep_quality','mood','energy',
                      'stress_level','hrv','resting_hr','steps','workout_minutes') then
    raise exception 'Invalid metric: %', p_metric;
  end if;
  col := p_metric;

  return query execute format($f$
    select date,
           %I::numeric as value,
           round(avg(%I) over (order by date rows between 6 preceding and current row)::numeric, 2) as rolling_avg
    from public.daily_metrics
    where user_id = $1 and date >= current_date - $2 and %I is not null
    order by date asc
  $f$, col, col, col) using p_user_id, p_days;
end; $$;

grant execute on function public.get_metric_trend(uuid, text, integer) to authenticated, service_role;

-- Days logged in the last N days (how engaged is this user?)
create or replace function public.get_days_logged(p_user_id uuid, p_days integer default 30)
returns integer language sql stable as $$
  select count(*)::int
  from public.daily_metrics
  where user_id = p_user_id and date >= current_date - p_days;
$$;

grant execute on function public.get_days_logged(uuid, integer) to authenticated, service_role;

-- Summary snapshot: most recent row, averages, completion stats
create or replace function public.get_tracking_summary(p_user_id uuid, p_days integer default 30)
returns jsonb language sql stable as $$
  with window_rows as (
    select * from public.daily_metrics
    where user_id = p_user_id and date >= current_date - p_days
  ),
  latest as (
    select * from window_rows order by date desc limit 1
  )
  select jsonb_build_object(
    'latest_date',        (select date from latest),
    'days_logged',        (select count(*)::int from window_rows),
    'avg_weight_kg',      (select round(avg(weight_kg)::numeric, 1) from window_rows),
    'avg_sleep_hours',    (select round(avg(sleep_hours)::numeric, 2) from window_rows),
    'avg_sleep_quality',  (select round(avg(sleep_quality)::numeric, 1) from window_rows),
    'avg_mood',           (select round(avg(mood)::numeric, 1) from window_rows),
    'avg_energy',         (select round(avg(energy)::numeric, 1) from window_rows),
    'avg_hrv',            (select round(avg(hrv)::numeric, 0) from window_rows),
    'avg_resting_hr',     (select round(avg(resting_hr)::numeric, 0) from window_rows),
    'avg_steps',          (select round(avg(steps)::numeric, 0) from window_rows),
    'workout_days',       (select count(*) filter (where workout_done) from window_rows),
    'workout_rate',       (select case when count(*) = 0 then 0
                                        else round(100.0 * count(*) filter (where workout_done) / count(*), 1)
                                   end from window_rows),
    'latest_weight_kg',   (select weight_kg from latest),
    'latest_hrv',         (select hrv from latest),
    'latest_mood',        (select mood from latest)
  );
$$;

grant execute on function public.get_tracking_summary(uuid, integer) to authenticated, service_role;

-- ============================================================================
-- USAGE EXAMPLES
-- ============================================================================
-- Upsert today's metrics:
--   INSERT INTO daily_metrics (user_id, date, weight_kg, sleep_hours, mood)
--   VALUES (auth.uid(), current_date, 75.2, 7.5, 8)
--   ON CONFLICT (user_id, date) DO UPDATE SET
--     weight_kg = EXCLUDED.weight_kg,
--     sleep_hours = EXCLUDED.sleep_hours,
--     mood = EXCLUDED.mood;
--
-- Get 30-day weight trend:
--   SELECT * FROM get_metric_trend(auth.uid(), 'weight_kg', 30);
--
-- Get engagement stat:
--   SELECT get_days_logged(auth.uid(), 30);
--
-- Get full summary JSON:
--   SELECT get_tracking_summary(auth.uid(), 30);
-- ============================================================================
