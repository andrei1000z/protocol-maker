# Database scripts

The authoritative schema lives in **[`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql)** — one idempotent file that covers both fresh installs and upgrades of existing databases.

## How to apply

Open **Supabase Dashboard → SQL Editor → New query**, paste the contents of `supabase/migrations/0001_init.sql`, and run it. Safe to re-run at any time — every DDL statement uses `CREATE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` / `DROP … IF EXISTS` + `CREATE`.

## What it installs

- **9 tables**: `profiles`, `blood_tests`, `protocols`, `daily_metrics`, `share_links`, `compliance_logs`, `oauth_connections`, `chat_messages`, `meals`.
- **Extensions**: `pgcrypto`, `pg_trgm`.
- **Indexes**: ~25 covering + partial + JSONB GIN (`jsonb_path_ops`) + array GIN.
- **Check constraints**: enum-like (`sex`, `activity_level`, `diet_type`, `experimental_openness`, `item_type`, `workout_intensity`, `generation_source`) and numeric ranges — added `NOT VALID` + `VALIDATE` so they're non-blocking on legacy data.
- **RLS + FORCE RLS** on every table. Policies scoped to `auth.uid() = user_id`. `share_links` has an additional `public_read` policy so the share page works without auth.
- **Triggers**: `handle_new_user` (profile on signup), `set_updated_at`, `set_completed_at`, `ensure_referral_code`.
- **RPC functions**: `get_current_streak`, `get_adherence_rate`, `get_latest_diagnostics`, `increment_share_view`, `apply_daily_metric_patch`, `apply_profile_patch`, `apply_protocol_adjust`, `prune_old_chat_messages`, `generate_referral_code`.
- **Realtime publication** on `daily_metrics`, `compliance_logs`, `protocols`.

## Legacy scripts (kept for niche use)

| Script | Why it exists |
|---|---|
| [`migrate-db.sql`](migrate-db.sql) | ⚠️ **DROPS EVERY TABLE** then recreates. Dev only, destructive. Rarely needed — prefer re-running `0001_init.sql`. |
| [`add-share-tracking.sql`](add-share-tracking.sql) | Subset install: just `share_links` + `compliance_logs` + streak/adherence funcs. Use if you're spinning up a sandbox that only needs share/compliance. |
| [`observability.sql`](observability.sql) | Optional observability views + queries (auth usage, error rates). Not required for the app to run. |

## Verify after running

```sql
-- 9 tables exist
select tablename from pg_tables where schemaname = 'public' order by tablename;

-- FORCE RLS on all 9
select relname, relforcerowsecurity from pg_class
where relname in ('profiles','blood_tests','protocols','daily_metrics',
                  'share_links','compliance_logs','oauth_connections',
                  'chat_messages','meals');

-- All helper functions
select proname from pg_proc where pronamespace = 'public'::regnamespace order by proname;

-- Realtime publication
select tablename from pg_publication_tables where pubname = 'supabase_realtime';

-- Smoke test (requires a logged-in session)
select public.get_adherence_rate(auth.uid(), 30);
```
