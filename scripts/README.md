# Database scripts

All scripts are meant to run in **Supabase Dashboard → SQL Editor**.

## Which one do I run?

| Situation | File | What it does |
|---|---|---|
| **Live DB with user data** (current prod case) | `upgrade.sql` | Idempotent — adds any missing columns/tables/policies without dropping data. Safe to re-run. |
| **Fresh empty project** | `setup-db.sql` | Creates every table from scratch with current schema, RLS, triggers, indexes. |
| **Developing locally, want a clean slate** | `migrate-db.sql` then `setup-db.sql` | Nukes everything (⚠️ destroys user data) then recreates. |

The other two files (`add-daily-metrics.sql`, `add-share-tracking.sql`) are **deprecated** — their contents are already inside `upgrade.sql`.

## After running

Verify with:
```sql
select column_name from information_schema.columns where table_name = 'profiles';
select column_name from information_schema.columns where table_name = 'protocols';
select tablename from pg_tables where schemaname = 'public';
```

You should see these tables: `profiles`, `blood_tests`, `protocols`, `daily_metrics`, `share_links`, `compliance_logs`.
