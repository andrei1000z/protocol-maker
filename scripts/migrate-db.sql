-- ============================================================================
-- PROTOCOL MAKER — DESTRUCTIVE NUKE (drop all tables)
-- ============================================================================
-- ⚠️  WARNING: This DROPS ALL TABLES and wipes ALL USER DATA.
--
-- Use this ONLY when:
--   - You want a clean slate (no users/protocols in production)
--   - You're developing locally and schema is badly out of sync
--
-- After running this, run `setup-db.sql` next to recreate fresh tables.
--
-- For a LIVE database with real users, use `upgrade.sql` instead — it adds
-- missing columns/tables without destroying data.
-- ============================================================================

drop table if exists public.compliance_logs cascade;
drop table if exists public.share_links cascade;
drop table if exists public.daily_metrics cascade;
drop table if exists public.protocols cascade;
drop table if exists public.blood_tests cascade;
drop table if exists public.profiles cascade;
drop table if exists public.user_configs cascade;   -- legacy
drop table if exists public.daily_logs cascade;     -- legacy

drop function if exists public.handle_new_user() cascade;
drop function if exists public.update_updated_at() cascade;
drop function if exists public.set_updated_at() cascade;

-- Next step: run `setup-db.sql` to recreate all tables.
