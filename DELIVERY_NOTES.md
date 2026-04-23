# Delivery notes

Append-only log of shipped work. Newest entries at top.

---

## Phase 0 — Blockers (N1-N4 + B6) · 2026-04-23

**Goal:** Fresh install works. Dead dir gone. GeneratingScreen in sync with server.

### Commit 0.1 — Schema unification + dead code cleanup

**Files:**
- `supabase/migrations/0001_init.sql` — new, 636 lines, unified idempotent schema.
- `scripts/setup-db.sql` — deleted (485 lines).
- `scripts/upgrade.sql` — deleted (941 lines).
- `scripts/add-daily-metrics.sql` — deleted (narrow subset, superseded).
- `scripts/README.md` — rewritten to point at `0001_init.sql`.
- `components/landing/MobileNavToggle.tsx` → `components/ui/MobileNavToggle.tsx` (moved).
- `components/landing/` — directory removed.
- `app/(marketing)/page.tsx` — import path updated.
- `lib/hooks/useDailyMetrics.ts` — drop `ages_index` type.
- `app/(app)/statistics/page.tsx` — drop AGEs index metric def.
- `components/tracking/SmartLogSheet.tsx` — drop AGEs index input field.
- `lib/engine/biomarkers.ts` — fix header comment "40 markers" → "38 markers".
- `README.md` — fix "40 markers" → "38 markers", drop stale SQL script refs.

**Manual QA steps (to run on Supabase):**
1. Create a fresh Supabase project.
2. Open SQL Editor → paste contents of `supabase/migrations/0001_init.sql` → run.
3. Expected: all 9 tables listed in `select tablename from pg_tables where schemaname='public'`.
4. Expected: all 9 tables `relforcerowsecurity=t` in `pg_class`.
5. Signup via the app → profile row auto-created with a `referral_code`.
6. Run onboarding → dashboard renders protocol with all sections.
7. Chat → history persists across reload.
8. Meal log → photo upload works, row lands in `meals` table with `nutrition_detail` JSONB.
9. Re-run the migration SQL a second time → no errors, no duplicate objects.

### Commit 0.2 — GeneratingScreen sync with server state

**Files:**
- `components/protocol/GeneratingScreen.tsx` — rewritten. Accepts `completed` + `onDone` props. Waiting-phase timer holds at penultimate step; fast-forwards + fires onDone when `completed=true`.
- `app/(app)/onboarding/page.tsx` — tracks `generationComplete` state, passes props, navigates via `onDone` callback.

**Behavior delta:**
- Before: fixed 32.5s step timer. Claude returns in 5s → user sees "ready" while still waiting. Claude returns in 60s → user sees "stuck at 100%" for 25s.
- After: waiting phase steps advance normally but hold at the penultimate step. When the POST returns OK, parent flips `completed=true`, the screen cascades remaining checkmarks in ~800ms, holds on "Your Protocol is ready." for 600ms, then navigates.

**Manual QA steps:**
1. Open DevTools → Network → Fast 3G throttle.
2. Click "Verifică răspunsurile" → "Build my protocol".
3. Expected: progress advances to ~85-90% (penultimate step), holds while the POST is pending.
4. On response: remaining steps flash in ~800ms, final step "Your Protocol is ready." holds for ~600ms, then redirect to /dashboard.
5. Fast response (no throttle): same animation, just compressed — no stuck-at-100% window.
6. Error path (disconnect network after clicking): `loading` resets, error message appears, GeneratingScreen unmounts.

### B6 orphan `ages_index` cleanup

Not a separate commit — folded into 0.1. Column drop included in migration. UI refs removed in 3 files.

### Verification

```bash
$ grep -rn "ages_index" --include="*.ts" --include="*.tsx" .
# 0 hits (only the DROP COLUMN IF EXISTS line in the migration — intentional)

$ grep -rnE "40 markers|40 biomarker" --include="*.md" --include="*.ts" --include="*.tsx" . | grep -v AUDIT_AND_PLAN
# 0 hits outside AUDIT_AND_PLAN.md (historical doc, left intact)

$ ls components/landing/ 2>&1
# No such file or directory
```

**Build / typecheck / tests:** Green (run at end of phase).
