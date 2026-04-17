# Database scripts

Run any of these in **Supabase Dashboard → SQL Editor**. Every script is now self-contained, modernized to 2026 Postgres/Supabase best practices, and idempotent unless marked destructive.

## Pick your script

| Script | Destructive? | When to use |
|---|---|---|
| [`upgrade.sql`](upgrade.sql) | ❌ Safe | **Most common.** Live DB with user data. Adds missing columns/tables/indexes/policies without touching data. Re-runnable. |
| [`setup-db.sql`](setup-db.sql) | ❌ Safe (only CREATE IF NOT EXISTS) | Fresh empty Supabase project — full canonical schema. |
| [`migrate-db.sql`](migrate-db.sql) | ⚠️ **DESTROYS DATA** | Dev only. Drops every table then recreates from scratch with modern schema inlined. |
| [`add-daily-metrics.sql`](add-daily-metrics.sql) | ❌ Safe | Want only the tracking module (daily_metrics + helper funcs). Useful if you're building a tracking-only feature. |
| [`add-share-tracking.sql`](add-share-tracking.sql) | ❌ Safe | Want only sharing + adherence (share_links + compliance_logs + streak/adherence funcs). |

## What's modernized (2026 Postgres/Supabase best practices)

### Extensions
- **`pg_trgm`** — fuzzy text search (biomarker name auto-complete)
- **`pgcrypto`** — `gen_random_uuid()`

### Indexing strategy
- **JSONB GIN with `jsonb_path_ops`** (smaller + faster than default `jsonb_ops`):
  - `profiles.onboarding_data`, `medications`, `goals`
  - `protocols.protocol_json`
  - `blood_tests.biomarkers`
- **Array GIN** on `conditions`, `allergies`, `habits_completed` — instant `@>` / `ANY` queries
- **Partial indexes** on hot-but-narrow queries:
  - `WHERE deleted_at IS NULL` (skips soft-deleted)
  - `WHERE onboarding_completed = true` (dashboard users)
  - `WHERE completed = true` (streak/adherence)
  - `WHERE workout_done = true` (workout calendar)
- **Covering indexes** `(user_id, date DESC)` on all user-scoped tables

### Data validity (check constraints)
- Enum-like: `sex`, `activity_level`, `diet_type`, `experimental_openness`, `item_type`, `workout_intensity`, `generation_source`
- Numeric ranges: scores 0-100, ages 0-120, sleep 0-24h, HRV 0-300, resting HR 20-220, aging_pace 0.4-2.0
- Added with `NOT VALID` + `VALIDATE` pattern so they're non-blocking on existing data

### New columns
- `protocols.biological_age_decimal numeric(4,1)` — full precision (was int-only)
- `protocols.aging_pace numeric(4,2)` — DunedinPACE 0.60-1.55
- `protocols.generation_source text` — `claude` / `groq` / `fallback`
- `compliance_logs.completed_at timestamptz` — auto-set by trigger on flip
- `share_links.expires_at timestamptz` — optional TTL
- `blood_tests.notes text`
- `deleted_at timestamptz` on profiles/protocols/blood_tests (soft delete)

### Security — defense in depth
- **RLS** on every table (`auth.uid() = user_id`)
- **`FORCE ROW LEVEL SECURITY`** on sensitive tables (applies even to owner role)
- **RLS excludes soft-deleted rows** (`WHERE deleted_at IS NULL` in SELECT policies)
- **Explicit grants** per Supabase role:
  - `authenticated` — full CRUD on own rows via RLS
  - `anon` — read `share_links`, increment `view_count`, nothing more
  - `service_role` — full access (for server-side API routes)

### Helper SQL functions (keep business logic out of app N+1)
- `get_current_streak(user_id)` — consecutive compliant days
- `get_adherence_rate(user_id, days)` — % completion over window
- `get_latest_diagnostics(user_id)` — bio age + pace + score in one query
- `get_item_consistency(user_id, days, item_type?)` — per-item completion %
- `get_recent_misses(user_id, days)` — items user has been skipping
- `get_metric_trend(user_id, metric, days)` — 7-day rolling avg for any metric
- `get_days_logged(user_id, days)` — engagement stat
- `get_tracking_summary(user_id, days)` — full JSON snapshot for dashboard

### Realtime publication (live updates without polling)
Subscribe from client:
```js
supabase.channel('metrics')
  .on('postgres_changes', {
    event: '*', schema: 'public', table: 'daily_metrics',
    filter: `user_id=eq.${userId}`
  }, handleChange)
  .subscribe();
```
Enabled tables: `daily_metrics`, `compliance_logs`, `protocols`, `share_links`.

### Triggers
- **`handle_new_user`** — auto-creates profile row on `auth.users` insert
- **`set_updated_at`** — auto-refreshes `updated_at` on profiles + daily_metrics
- **`set_completed_at`** — auto-stamps exact completion time when compliance item flips to `true`

## Verify after running

```sql
-- Tables
select tablename from pg_tables where schemaname = 'public';

-- All indexes (should see 20+)
select indexname from pg_indexes where schemaname = 'public' order by indexname;

-- Helper functions
select proname from pg_proc where pronamespace = 'public'::regnamespace;

-- Realtime-enabled tables
select tablename from pg_publication_tables where pubname = 'supabase_realtime';

-- Smoke test — should return a number
select public.get_adherence_rate(auth.uid(), 30);

-- Tracking snapshot
select public.get_tracking_summary(auth.uid(), 30);
```
