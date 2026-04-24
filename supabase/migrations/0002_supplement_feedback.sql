-- ============================================================================
-- 0002 — SUPPLEMENT_FEEDBACK
-- ============================================================================
-- One row every time a user reports a side effect on a supplement. The
-- master-prompt context builder reads the last 30 days so the next regen
-- can say "user got bloating on magnesium glycinate — switch to malate" or
-- "user got jitters on caffeine+L-theanine — reduce caffeine dose".
--
-- Kept separate from the meals/metrics tables because the shape is distinct
-- (category-tagged side effects + free text), and because future phases may
-- migrate this into a ratings/effects/reactions umbrella.
--
-- Safe to re-run. Only creates what's missing.
-- ============================================================================

create table if not exists public.supplement_feedback (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  protocol_id uuid,                                      -- optional: which protocol was active
  supplement_name text not null,                         -- normalized name as rendered in the card
  categories text[] not null default '{}',               -- e.g. ['digestive','sleep']
  notes text,                                            -- free-text, max 1000 chars
  reported_at timestamptz not null default now(),
  created_at timestamptz default now()
);

-- Range + length guards — keep a single user from injecting massive text or
-- an absurd number of category tags that would blow up the prompt.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'sfb_notes_length') then
    alter table public.supplement_feedback add constraint sfb_notes_length
      check (notes is null or char_length(notes) <= 1000) not valid;
    alter table public.supplement_feedback validate constraint sfb_notes_length;
  end if;
exception when others then null; end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'sfb_categories_cap') then
    alter table public.supplement_feedback add constraint sfb_categories_cap
      check (array_length(categories, 1) is null or array_length(categories, 1) <= 10) not valid;
    alter table public.supplement_feedback validate constraint sfb_categories_cap;
  end if;
exception when others then null; end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'sfb_name_length') then
    alter table public.supplement_feedback add constraint sfb_name_length
      check (char_length(supplement_name) between 1 and 120) not valid;
    alter table public.supplement_feedback validate constraint sfb_name_length;
  end if;
exception when others then null; end $$;

-- Hot-path index: "last N days of feedback for this user" is what the
-- master-prompt context query runs before every regen.
create index if not exists idx_sfb_user_reported on public.supplement_feedback(user_id, reported_at desc);

-- GIN on categories for future filtering ("show me everyone with digestive issues").
create index if not exists idx_sfb_categories on public.supplement_feedback using gin (categories);

-- RLS + force RLS (defense in depth like the rest of the schema).
alter table public.supplement_feedback enable row level security;
alter table public.supplement_feedback force row level security;

drop policy if exists "supplement_feedback_own" on public.supplement_feedback;
create policy "supplement_feedback_own" on public.supplement_feedback for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Grants are automatic via the default privileges alter in 0001_init.sql,
-- but be explicit here so this file is self-contained.
grant select, insert, update, delete on public.supplement_feedback to authenticated;
grant all on public.supplement_feedback to service_role;
