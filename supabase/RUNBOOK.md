# Supabase migration runbook

A practical guide for applying the four pending migrations to the live
Supabase project. Two paths — pick whichever you trust more.

---

## Why I can't run these from this session

Claude Code runs against your local repo. It has zero credentials for
your Supabase project (no service role key, no PAT, no SQL Editor
session). Pasting `SUPABASE_SERVICE_ROLE_KEY` into the chat would expose
it to the AI provider and to log retention — that's a credential leak,
not a feature.

So the migrations sit in `supabase/migrations/` waiting for you to apply
them with credentials that only you should hold. Every dependent feature
in the app is built to **degrade gracefully** until that happens:

| Migration | What goes live when applied |
|---|---|
| `0003_audit_log.sql` | Audit log starts capturing service-role ops (cron, deletes, Stripe webhook, OAuth token saves). |
| `0004_byok_and_vault_prep.sql` | BYOK card in Settings starts persisting Anthropic keys. `encrypt_pii` / `decrypt_pii` helpers exist for the next iteration. |
| `0005_push_subscriptions.sql` | Push subscribe card in Settings starts saving subscriptions; cron pushes can fan out. |
| `0006_household.sql` | Family-mode card in Settings flips from "migration not applied" to live roster + invite flow. |

Until you run them, those cards either no-op or render a clear
"migration not applied" hint. Nothing crashes.

---

## Path 1 — Supabase Dashboard (recommended, 2 minutes)

Best for one-off migrations, zero-tool-install, fully visible diff.

1. Open <https://supabase.com/dashboard> → your Protocol project → **SQL Editor** → **New query**.
2. Copy the entire contents of `supabase/migrations/0003_audit_log.sql` into the editor. Click **Run**. You should see `Success. No rows returned.`
3. Repeat for `0004_byok_and_vault_prep.sql`, `0005_push_subscriptions.sql`, `0006_household.sql` in that order.
4. Verify by running:
   ```sql
   select * from information_schema.tables where table_schema = 'public' order by table_name;
   ```
   You should see `audit_log` and `push_subscriptions` in the list. Profiles should have new columns: query
   ```sql
   select column_name from information_schema.columns
   where table_name = 'profiles' and table_schema = 'public'
   order by column_name;
   ```
   and look for `anthropic_api_key`, `household_owner_id`, `household_role`.

All four files are `if not exists` / `do $$` guarded so re-running is safe.

---

## Path 2 — Supabase CLI (one-time setup, then `db push`)

Better if you expect to write more migrations.

```bash
# One-time: install + link
npm install -g supabase
supabase login                    # opens browser, generates access token
supabase link --project-ref <your-project-ref>
# project-ref is the subdomain part of your supabase URL
# e.g. for https://qfougkekxwatlnvwduos.supabase.co → ref is qfougkekxwatlnvwduos

# Apply all pending migrations
cd <project-root>
supabase db push
```

`supabase db push` reads everything in `supabase/migrations/` and applies
files that haven't been recorded in the `supabase_migrations.schema_migrations`
table yet. Each file's checksum is captured — re-runs are no-ops.

If `db push` complains about the `0001_init.sql` / `0002_supplement_feedback.sql`
already being applied but not tracked, run once:
```bash
supabase migration repair --status applied 0001
supabase migration repair --status applied 0002
```
to backfill the tracking table, then `db push` again.

---

## Path 3 — psql directly (if you have the connection string)

```bash
# Supabase Dashboard → Settings → Database → Connection string (URI)
# Use the "Direct connection" string, not the pgbouncer pooler.

psql "$DATABASE_URL" -f supabase/migrations/0003_audit_log.sql
psql "$DATABASE_URL" -f supabase/migrations/0004_byok_and_vault_prep.sql
psql "$DATABASE_URL" -f supabase/migrations/0005_push_subscriptions.sql
psql "$DATABASE_URL" -f supabase/migrations/0006_household.sql
```

---

## After applying

1. **Spot-check the Settings page** at `/settings`:
   - BYOK card should accept a `sk-ant-…` key and show "Activă" after save.
   - Push card should jump from "Not configured" to "Activează notificările" *if* VAPID env vars are also set on Vercel.
   - Household card should show a real roster with you as owner.
2. **Spot-check audit logging** by triggering any cron run (`curl` against `/api/cron/daily-regenerate` with `Authorization: Bearer $CRON_SECRET`) and querying:
   ```sql
   select ts, actor, action, target_user_id from audit_log order by ts desc limit 10;
   ```
3. **Pre-flight account deletion**: create a throwaway test account, populate
   one row in every table, hit `DELETE /api/delete-account`, then query each
   table for the test `user_id` — all should return zero rows.

---

## Rollback

Each migration is additive (`add column if not exists`, `create table if
not exists`). To revert:

```sql
-- 0006_household
alter table public.profiles drop column if exists household_owner_id;
alter table public.profiles drop column if exists household_role;
drop index if exists idx_profiles_household_owner;

-- 0005_push_subscriptions
drop table if exists public.push_subscriptions;

-- 0004_byok_and_vault_prep
alter table public.profiles drop column if exists anthropic_api_key;
drop function if exists public.encrypt_pii(text);
drop function if exists public.decrypt_pii(text);

-- 0003_audit_log
drop function if exists public.log_audit(text, text, uuid, jsonb);
drop table if exists public.audit_log;
```

Rolling back will not delete the app code that depends on these tables;
the dependent Settings cards just go back to their pre-migration "not
yet activated" state.
