# Database scripts

Run in **Supabase Dashboard → SQL Editor**.

## Which one do I run?

| Situation | File | What it does |
|---|---|---|
| **Live DB with user data** (current prod case) | [`upgrade.sql`](upgrade.sql) | Idempotent — adds missing columns/tables/indexes/policies without dropping data. Safe to re-run. |
| **Fresh empty project** | [`setup-db.sql`](setup-db.sql) | Creates every table from scratch with current modern schema. |
| **Developing locally, want a clean slate** | [`migrate-db.sql`](migrate-db.sql) then [`setup-db.sql`](setup-db.sql) | ⚠️ Nukes everything then recreates. |

The files [`add-daily-metrics.sql`](add-daily-metrics.sql) and [`add-share-tracking.sql`](add-share-tracking.sql) are **deprecated** — already inside `upgrade.sql`.

## What's modernized (2026 Postgres/Supabase best practices)

- **Extensions**: `pg_trgm` (fuzzy biomarker search), `pgcrypto` (`gen_random_uuid`)
- **JSONB GIN indexes** with `jsonb_path_ops` — sub-ms queries into `onboarding_data`, `medications`, `goals`, `biomarkers`, `protocol_json`
- **Array GIN indexes** on `conditions`, `allergies`, `habits_completed` — fast `@>` / `ANY` queries
- **Check constraints** validating `sex`, `activity_level`, `diet_type`, `experimental_openness`, `item_type`, numeric ranges (score 0-100, aging_pace 0.4-2.0, etc.)
- **Soft delete** (`deleted_at timestamptz`) on profiles, protocols, blood_tests — RLS policies exclude deleted rows automatically
- **Partial indexes** — `onboarding_completed = true` users, `completed = true` compliance, `deleted_at is null` rows
- **Covering indexes** on hot paths (user_id + date DESC)
- **`biological_age_decimal` (numeric 4,1)** — full precision bio age in DB (was rounded int only)
- **`aging_pace` (numeric 4,2)** — DunedinPACE-style velocity 0.60-1.55
- **Helper SQL functions**:
  - `get_current_streak(user_id)` → consecutive compliant days
  - `get_adherence_rate(user_id, days)` → % compliance over N days
  - `get_latest_diagnostics(user_id)` → bio age / pace / score in one call
- **Realtime publication** on `daily_metrics`, `compliance_logs`, `protocols` — live dashboard updates via `supabase.channel(...)` without polling
- **Explicit grants** to `authenticated` / `anon` / `service_role` — anon can read share_links + increment view_count, nothing more
- **Force RLS** on sensitive tables (defense in depth — RLS applied even for table owners)
- **Trigger**: `set_completed_at` auto-timestamps when compliance items flip to `true`

## After running — verify:

```sql
-- All expected tables
select tablename from pg_tables where schemaname = 'public';
-- → profiles, blood_tests, protocols, daily_metrics, share_links, compliance_logs

-- All indexes (should see ~20+)
select indexname from pg_indexes where schemaname = 'public' order by indexname;

-- Helper functions
select proname from pg_proc where pronamespace = 'public'::regnamespace;
-- → get_current_streak, get_adherence_rate, get_latest_diagnostics, handle_new_user, set_completed_at, set_updated_at

-- Realtime enabled tables
select tablename from pg_publication_tables where pubname = 'supabase_realtime';
-- → daily_metrics, compliance_logs, protocols

-- Smoke test helper function
select public.get_adherence_rate(auth.uid(), 30);
```
