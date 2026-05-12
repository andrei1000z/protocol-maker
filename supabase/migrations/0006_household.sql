-- ============================================================================
-- 0006 — HOUSEHOLD (F8 Family / household mode)
-- ============================================================================
-- Schema-only step toward family accounts: one parent account can manage
-- multiple "linked" profiles (children, partner, parents). Each linked
-- profile keeps its own protocols + tracking; only the owner's session can
-- switch between them. RLS continues to scope reads by auth.uid() = id, so
-- the linked profiles need an OR check via household_id once the UI ships.
--
-- This migration deploys the column + index only — UI + read policy
-- adjustments come in the next iteration so we don't accidentally relax
-- isolation before the switcher exists.
--
-- Safe to re-run.
-- ============================================================================

alter table public.profiles
  add column if not exists household_owner_id uuid references auth.users on delete set null,
  add column if not exists household_role text default null;

-- "owner" = the paying parent; "member" = linked profile (kid / partner).
-- Null means a standard solo account (the common case).
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_household_role') then
    alter table public.profiles add constraint profiles_household_role
      check (household_role is null or household_role in ('owner', 'member')) not valid;
    alter table public.profiles validate constraint profiles_household_role;
  end if;
exception when others then null; end $$;

-- Hot-path index: owner queries "list everyone in my household" by their own id.
create index if not exists idx_profiles_household_owner on public.profiles(household_owner_id)
  where household_owner_id is not null;

comment on column public.profiles.household_owner_id is
  'When set, this profile is a member of a household owned by household_owner_id (auth.users). Owners reference themselves.';
comment on column public.profiles.household_role is
  'Role within the household: owner | member | null (solo).';
