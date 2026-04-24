# Delivery notes

Append-only log of shipped work. Newest entries at top.

---

## Phase 4 — Tracking frictionless · 2026-04-24

### Shipped

**F4.3 — Grace-day streak (forgiving)**
- `lib/utils/streak.ts` → `calculateStreakForgiving(history, threshold)` returns `{ days, graceUsed }`. Tolerates ONE missed day per 7-day window; the chain continues and the flag flips `graceUsed: true`. A second missed day in the same window breaks the streak.
- Stops when it walks past the end of logged history (that's "never logged", not "forgiven").
- `calculateStreak` now delegates to the forgiving variant (same public API as before).
- `StreakWidget` accepts `graceUsed` prop and renders "· 1 grace day used" in amber alongside "Current streak" when active. Gives the user a gentle heads-up that one more miss will break it, without punishing them for a single off day.
- 5 new unit tests cover: empty history, 5+grace+more = continues, 2 consecutive miss = break, clean 3 days = no grace, delegation.

**F4.4 — Pending-count discriminator already correct**
- Verified `countPending` in `components/tracking/SmartLogSheet.tsx` already uses strict `!== null && !== undefined && !== ''`. A legit `0` (e.g. `awake_min: 0`) is kept, not mis-flagged as missing. Spec claim of `!value` truthy-check was wrong — no fix needed.

**F4.1 — Yesterday-missed CTA already shipped**
- Verified at `app/(app)/tracking/page.tsx:758`. No fix needed.

### Not shipped this session

**F4.2 — Critical-fields chip** above each bucket ("✨ 3 fields critical for the protocol"). Deferred — requires adding a field-importance metadata layer to `lib/engine/metric-catalog.ts` (which doesn't exist yet — would need to be created as part of the work). Clean to pick up in the same session as Phase 2's full reducer.

### Verification

```bash
$ npx tsc --noEmit     # clean
$ npm test             # 315/315 (was 310, +5 streak tests)
```

Manual QA:
1. User with 28 consecutive met days → "28 days · Current streak" (no grace hint).
2. User misses a day → "28 days · 1 grace day used" in amber.
3. User misses 2 days in a row → streak resets to 0.
4. User with `awake_min: 0` logged → bucket doesn't flag that field as pending.

---

## Phase 3 (partial) — Dashboard UX wins · 2026-04-24

**Shipped (F3.2 + F3.3 + F3.4):**

- `components/dashboard/MedicalDisclaimer.tsx` NEW. Amber-toned band sitting above the hero — "Asta e optimizare de lifestyle, nu diagnostic medical. Dacă ai simptome acute sună la 112." Dismissible per session (NOT permanent), so a doctor who opens a shared dashboard always sees the disclaimer fresh. "Citește mai mult" expands inline (no navigation away from the page mid-flow).
- `components/dashboard/FirstVisitTour.tsx` NEW. 4-step modal that fires once, 900ms after mount, on a real user's first dashboard visit. Explains the 4 most-confusing things: longevity score semantics, biological vs chronological age, organ radar, "keep scrolling for the full plan". LocalStorage flag = permanent dismiss. Escape / outside-click closes. **Skipped in demo mode** so tire-kickers don't burn through the tour before they sign up. Copy is 100% RO.
- `app/(app)/dashboard/page.tsx` wires both components above the existing demo/cron banners.

**Already shipped previously (F3.2 — Mobile TOC FAB):**
- `components/layout/DashboardTOC.tsx` already contains a floating-action button below `lg:` breakpoint with a slide-up sheet + scroll-spy highlighting. No rework needed — feature is live.

**Deferred to a dedicated session (F3.1 — Section extraction):**
- Reason: 2360-line dashboard → 12 section components is the same class of freehand-mechanical refactor as onboarding's 205-useState → reducer. A codemod + one-PR-per-section is the right move. Attempting it in this session risks silently changing render order or memo boundaries on the dashboard that renders 17 subsystems and 6 banner states.

### Verification

```bash
$ npx tsc --noEmit     # clean
$ npm test             # 310/310
```

Manual QA:
1. Fresh user (no localStorage flag) → tour modal pops up ~900ms after dashboard renders. 4 steps. "Am înțeles" dismisses permanently.
2. Existing user → no tour.
3. `/dashboard?demo=1` → no tour (even on fresh session).
4. Disclaimer band visible on every scroll-top revisit until the X is clicked (once per session).
5. After disclaimer dismiss, a browser refresh re-renders it — by design.

---

## Phase 2 — Onboarding (F2.2 + F2.3 delivered, F2.1 + F2.4 deferred) · 2026-04-24

**Context:** Onboarding file is 2274 lines with 205 useState. Full reducer migration + step extraction is the spec target but carries serious regression risk on the flagship data-capture flow (any typo in a setter rename breaks protocol generation). This commit ships the user-facing UX wins (validation + real-% progress) on top of the existing state shape. The 205-useState cleanup is queued for a dedicated session with a codemod + full QA rather than a freehand refactor.

### Shipped

**F2.2 — Per-step validation + inline errors + scroll-to-first-error**
- `validateStep(stepIdx)` pure function: returns `{ ok, errors, firstFieldId }`. Step 0 validates age (13-110), height (100-250 cm), weight (25-350 kg). Error copy in RO, child-friendly phrasing ("Vârsta trebuie să fie între 13 și 110"), not "must match /\d+/".
- `handleNext` runs validation first. On failure: `scrollIntoView` + `focus` on first broken field. On pass: clears errors, proceeds with save.
- Step-0 required inputs (age / height / weight) now:
  - Have `id="onb-age"` etc. so validation can query them.
  - Are wrapped with `aria-invalid` + `aria-describedby` pointing at the error message.
  - Render their error inline beneath the input with red border.
  - Auto-clear the error on next edit.

**F2.3 — Real completion % based on field-completion**
- `completionPct` useMemo counts filled fields across all 5 steps (~35 meaningful flags).
- Rendered as "X% completat" beneath the step pips — more honest than "step 3 of 5" which implies 60% when step 2 has 40 unfilled fields.

### Deferred to next session (explicit scope, explicit reason)

**F2.1 — 205 useState → single `useOnboardingForm` hook + step-component extraction**
- Reason: 205 field references × an average 5 reads/writes each = ~1000 mechanical edits. Done freehand, the probability of at least one bug breaking protocol generation is too high for a single-session commit. The right tooling is a TypeScript codemod (ts-morph AST walk → replace useState + references). That's its own 3-4h of work; doing it correctly is more valuable than rushing it.
- Alternative considered: 10-group sub-state (reduces 205 → 10 object-useStates). Delivers ~90% of perf win with much less risk, but still ~200 reference edits. Queued for the same follow-up session.

**F2.4 — Conversational mode (1-2 questions per screen)**
- Reason: Presentation-layer alternative mode with horizontal-slide animation. Nice-to-have, doesn't unblock anything, and risks schema-shape mistakes in the review modal. Queued.

### Verification

```bash
$ npx tsc --noEmit        # clean
$ npm test                # 310/310 green
```

Manual QA:
1. Step 0 with age=5 → "Vârsta trebuie să fie între 13 și 110", border red, focus lands on age field.
2. Fix age to 35, height still empty → Next → error on height field, auto-scrolled.
3. All 3 required → Next proceeds, savedToast flashes.
4. Progress number under the step pips reflects field-completion, not step index.

---

## Phase 1 — Accessibility brutal (F1.1 + F1.2 + F1.3) · 2026-04-24

**Goal:** WCAG AA body copy, keyboard entry point, explainable terms, accessible chart.

### Commit 1 — Text-size purge across the codebase (36 files)

**Rule applied:**
- `text-[9px]` → `text-[11px] font-medium` (bump size + weight).
- `text-[10px]` → `text-xs` (12px — Tailwind default small).
- `text-[11px]` kept untouched (most sit next to `font-mono tabular-nums` or `font-medium` already).

**Counts before:** 17× 9px + 384× 10px + 172× 11px = 573 total.
**Counts after:** 0× 9px + 0× 10px + untouched 11px (verified `grep -rE 'text-\[9px\]|text-\[10px\]' --include='*.tsx' --include='*.ts' .` → 0).

**Top 3 files:** dashboard (108 refs → 0), onboarding (90 → 0), settings (24 → 0). Plus 33 other components across tracking, stats, history, chat, marketing, layout, biomarkers, etc.

**Manual QA:** Spot-check the small-label heavy sections on 375px viewport — organ radar legend, biomarker list rows, meal-logger macro chips, tracking bucket headers. Everything should be comfortably readable without zooming.

### Commit 2 — ExplainTerm + HelpIcon + skip-to-content + radar a11y

**Files:**
- `components/ui/ExplainTerm.tsx` — NEW. Inline explainer with dotted-underline + popover. Looks up term in `BIOMARKER_DB` (case-insensitive match on code / shortName / name), falls back to the `what` + `why` props. Includes HelpIcon alias — `(i)` chip for onboarding field help.
- `app/(app)/layout.tsx` — skip-to-content link as first focusable element; `<main id="main">` wraps children.
- `components/dashboard/OrganRadar.tsx` — wrapped in `<div role="img" aria-label="Organ system scores: cardiovascular 72 of 100; metabolic 88 of 100; …">`. Label is computed from the data prop at render time.
- `tests/engine/biomarker-lookup.test.ts` — NEW. Guards the case-insensitive term lookup contract + sanity-checks `BIOMARKER_DB.length === 38` so future edits don't silently drift from the landing/README claim.

**Manual QA:**
1. Open any app page, press Tab immediately. First focus lands on "Skip to content" floating link.
2. Press Enter → jumps focus into `<main>`, bypassing the sticky header nav.
3. VoiceOver on dashboard → organ radar reads as "Organ system scores: cardiovascular …, metabolic …, immune …, endocrine …".
4. Render `<ExplainTerm term="hsCRP">hsCRP</ExplainTerm>` somewhere → dotted underline, hover/focus opens popover with name + description + Bryan value + "Read more" link.

**Note:** Wiring ExplainTerm into actual usage sites across the dashboard/onboarding is deferred to Phase 3 (dashboard section extraction) to avoid re-touching hundreds of lines twice. Component is production-ready and imported-and-used in at least 1 site after Phase 3 lands.

### Verification

```bash
$ npx tsc --noEmit      # clean
$ npm test              # 310/310 (was 303, +7 new lookup tests)
$ grep -rE 'text-\[9px\]|text-\[10px\]' --include='*.tsx' --include='*.ts' . | wc -l
# 0
```

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
