-- Daily metrics table (Sprint 3)
-- Run this in Supabase Dashboard > SQL Editor

CREATE TABLE IF NOT EXISTS public.daily_metrics (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  date date NOT NULL,
  weight_kg real,
  sleep_hours real,
  sleep_quality integer CHECK (sleep_quality BETWEEN 1 AND 10),
  mood integer CHECK (mood BETWEEN 1 AND 10),
  energy integer CHECK (energy BETWEEN 1 AND 10),
  hrv integer,
  resting_hr integer,
  steps integer,
  workout_done boolean DEFAULT false,
  workout_minutes integer,
  workout_intensity text,
  stress_level integer CHECK (stress_level BETWEEN 1 AND 10),
  habits_completed text[] DEFAULT '{}',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

ALTER TABLE public.daily_metrics ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "daily_metrics_own" ON public.daily_metrics FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
