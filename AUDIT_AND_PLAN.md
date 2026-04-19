# AUDIT_AND_PLAN.md — Protocol Maker

**Date:** 2026-04-19 · **Branch:** master · **HEAD:** `7536145`
**Auditor:** Claude Opus 4.7 (plan mode, max effort)
**Scope:** Everything from `app/` and `lib/` down to `scripts/*.sql`. 3 parallel Explore sweeps + direct verification of critical claims.

> When plan mode exits, this document should be saved as `AUDIT_AND_PLAN.md` at the repo root.

---

# PART 1 — EXECUTIVE SUMMARY

## Current state: ~75% ship-ready

You have a serious, comprehensive product. Backend architecture is clean (RLS + force RLS, soft deletes, SWR caching, good dependency boundaries). Engine is rich (40 biomarkers, 13 clinical patterns, PhenoAge implementation, Bryan benchmark data, 50+ device catalog, 36+ home equipment items). Dashboard is the best-executed longevity-protocol UI I've audited — the per-phase daily schedule + per-bucket supplement grouping + life-journey diagnostic are not gimmicks, they're product-market-fit material.

**But it has a handful of critical bugs that will bite you within a week of launch**, a huge uncapped cost exposure, and one unresolved strategic question (target user).

## Top 3 strengths

1. **Engine is evidence-anchored.** PhenoAge (Levine 2018) is wired correctly, biomarker ranges are longevity-optimal not lab-normal, Bryan constants are single-sourced in `lib/engine/bryan-constants.ts`, fallback protocol produces a complete runnable output if both Claude and Groq fail. This is rare.
2. **Device-aware tracking is a real moat.** `lib/engine/device-catalog.ts` mapping ~130 smartwatch models + 22 rings + 36 home equipment items → daily_metrics columns, then filtering SmartLogSheet to only show the user's capabilities, is a product feature most competitors don't have. Keep investing here.
3. **Chat actions.** `app/api/chat-action/route.ts` with `[[ACTION:...]]` markers + Zod allowlist + tap-to-apply chips is genuinely novel UX. Users saying "I quit smoking" → instant profile update is the right bet.

## Top 3 critical weaknesses

1. **`app/api/cron/daily-regenerate/route.ts:28` — auth check is broken.** `if (secret && authHeader !== ...)` — if `CRON_SECRET` is unset or empty string, the entire rejection is skipped. **Anyone with the URL can trigger expensive regeneration for every onboarded user in the DB.** At 100 users × $0.10/generation, a single malicious curl burns $10; looped it burns cash until Vercel rate-limits you. **Verified by reading the file.**
2. **Uncapped AI cost.** No prompt caching anywhere (verified: `grep -rn 'cache_control' app/api lib/` returned 0 matches). Daily cron regenerates all users regardless of activity. At 100 users: ~$2.4k/mo. At 1000 users: ~$24k/mo. Unsustainable without optimization.
3. **`app/(app)/dashboard/page.tsx:1247` — dynamic Tailwind classes don't compile.** `'border-' + c.text.replace('text-', '') + '/20'` — Tailwind JIT does not scan string concatenation, so these border colors are silently missing from the production CSS. The daily schedule block items render without their intended colored borders. Purely visual, but looks broken. **Verified by reading the line.**

## Strategic recommendation

Before any of this matters, answer these three questions and commit:

1. **Who is the target user?** Landing copy is English, `app/(app)/dashboard/loading.tsx:6` shows "Se încarcă protocolul..." in Romanian, eMAG/RON is hardcoded in supplements, Bryan benchmark is US tech-bro culture. Currently neither a clean RO product nor a clean US product. **Recommendation: Romanian health-conscious 28-45 year olds with disposable income. Rewrite landing in RO, keep Bryan as one comparison target, add Peter Attia + Rhonda Patrick as alternatives.**

2. **What's the monetization?** "Free during beta" is unsustainable given costs. At 100 free users you're net -$2.4k/mo. **Recommendation: free tier = lifestyle-only protocol + 1 AI generation/month; €9.99/mo = unlimited regen + Claude Sonnet + daily chat. Covers Anthropic at ~100:1 ratio.**

3. **What are you NOT?** This is close to a medical product but legally can't be one. "Not medical advice" is in the terms but the dashboard shows scores like a diagnostic. **Recommendation: reposition as "longevity protocol coach" (like Noom or Whoop app), not "health dashboard" (like MyChart). The Bryan Johnson comp is the right framing — lifestyle optimization, not diagnosis.**

---

# PART 2 — PAGE-BY-PAGE AUDIT

## app/(marketing)/page.tsx — landing (394 lines)

**What works:** Hero + CTA clarity, "Why not ChatGPT?" 6-card comparison section, live sample protocol button (`?demo=1`), stats bar pulls real engine counts.

- 🟡 `page.tsx:85,181` — CTAs link to `/dashboard?demo=1`. `proxy.ts:25-26` correctly detects `demo` searchParam and makes it public, so this works. Previous audit claim "demo mode loses param on login" was **WRONG — verified working.**
- 🟡 `page.tsx:348` — "Get my protocol" is English on a page whose target is likely RO. See strategic recommendation.
- 🟢 `page.tsx:48-50` — nav anchors `hidden sm:block` so mobile users can't jump to sections. Add mobile hamburger or pill-nav.

## app/(auth)/login/page.tsx (241 lines)

**What works:** Mode toggle (login/register/forgot), Google OAuth top-of-fold, password strength live check, Terms+Privacy GDPR checkbox, router.prefetch on mount.

- 🔴 `login/page.tsx:85` — OAuth error handling leaves `oauthLoading` true forever if OAuth never returns (network hang). Add timeout.
- 🟡 OAuth callback path: `login/page.tsx:79` redirects to `/api/auth/callback` (correct post-fix `caa48ce`), but Google Cloud OAuth console still needs `External` user type — documented for user, not in code.
- 🟢 "Forgot password?" link is small; consider making it more visible.

## app/(app)/dashboard/page.tsx (~1500 lines)

**What works:** Diagnostic hero with percentile positioning + life-journey section, organ systems with drivers/drag-anchors/top-lever, Bryan comparison with why-the-gap + close-the-gap, supplements grouped by 5 timing buckets, daily schedule grouped by 5 phases with sticky headers, ALL extremely polished. The supplement + schedule rendering is genuinely best-in-class.

- 🔴 `dashboard/page.tsx:1247` — `'border-' + c.text.replace('text-', '') + '/20'` is dynamic Tailwind — won't compile. Borders silently missing on daily schedule block items (work, school, exercise).
- 🟡 `dashboard/page.tsx:1205-1215` — sticky phase headers use hardcoded `top-[3.5rem]`, fragile if header height changes.
- 🟡 `dashboard/page.tsx:135-145` — loading skeleton doesn't match responsive 3-column desktop layout — will layout-shift on first load.
- 🟡 `dashboard/page.tsx:326,340` — `.slice(0, 4)` hard cap on Top Wins + Top Risks. If AI returns 8, user sees 4. Add "show more" or bump to 6.
- 🟢 No mobile TOC — `DashboardTOC` is desktop-only sidebar. Mobile users can't jump to sections.
- 🟢 No "Export to PDF" button (print CSS exists, but download-as-PDF button is missing).

## app/(app)/onboarding/page.tsx (2042 lines, 181 useState calls)

**What works:** Thorough (every biometric imaginable), DevicePicker brand→model→other pattern is elegant, CollapseSection for organization, PDF upload flow, `triggerSaved()` toast post-Next, red-flag hard-stop modal, experimental-openness default `open_rx`, pre-opened sleep+diet sections.

- 🔴 **181 useState calls in one file, no auto-save between steps.** Verified with `grep -c 'useState(' 'app/(app)/onboarding/page.tsx'` = 181. `saveProgress()` only fires on Next click. Mid-step crash = lose all input on that step.
- 🔴 Single component is 2042 lines. Every render re-creates 100+ handlers — performance hit on mobile (Samsung A55 etc).
- 🟡 Form has no client-side validation until `handleFinish()`. User fills 5 steps, clicks Generate, then finds step 2 has errors.
- 🟡 CONDITIONS, GOALS, SLEEP_ISSUES hardcoded at top of file instead of in `lib/engine/`.
- 🟢 DevicePicker + EquipmentRow are defined inline; extract to `components/onboarding/`.

## app/(app)/tracking/page.tsx + statistics + history + chat + settings

- 🔴 `app/(app)/chat/page.tsx — parseActions` — partial-JSON streams can produce false-positive regex matches during streaming. Verified logic only parses when not streaming, but marker buffer between chunks could still misfire on an unfortunate boundary.
- 🟡 Tracking has retroactive date picker (last 7 days) — **good**. But no "Yesterday was missed, log it now" nudge on open.
- 🟡 Settings lacks 2FA setup, connected devices list, "Logout all other devices" button.

## app/share/[slug]/page.tsx

- 🔴 `app/api/share/route.ts:11` — `Math.random().toString(36).substring(2, 10)` → 8-char guessable slug. 36⁸ = 2.8T but `Math.random` isn't cryptographically secure. Use `crypto.randomUUID()` and take the first 10 chars, or `nanoid`.
- 🔴 `app/api/share/route.ts:34-38` — read-then-update race on `view_count`. Two concurrent views both read 10, both write 11. Data loss.
- 🟡 `app/share/[slug]/page.tsx:9,37` — `baseUrl` computed twice with DIFFERENT fallback logic (line 9 uses `VERCEL_URL`, line 37 uses `NEXT_PUBLIC_SUPABASE_URL` as a tell-tale). DRY violation + correctness risk.

---

# PART 3 — API ROUTES AUDIT (21 routes)

Summary of meaningful issues (per-route detail available in agent output):

| Route | Issue | Severity | File:line |
|---|---|---|---|
| cron/daily-regenerate | **Auth check skipped if secret empty** | 🔴 BLOCKER | `route.ts:28` |
| share | Guessable slug (`Math.random`) | 🔴 | `route.ts:11` |
| share | View_count race condition | 🔴 | `route.ts:34-38` |
| generate-protocol | No input validation (Zod) on profile+biomarkers | 🟡 | `route.ts:56-62` |
| chat / generate-protocol / cron | **Zero prompt caching** — verified 0 grep hits | 🔴 COST | All AI routes |
| cron/daily-regenerate | Regenerates all users daily regardless of activity | 🔴 COST | `route.ts:37-41` |
| retest | Internal fetch to /api/generate-protocol relies on cookie forwarding — fragile | 🟡 | `retest/route.ts:80-91` |
| compliance | `protocolId` column unvalidated (stored but not enforced against user's protocols) — not priv-esc per se since user_id is server-side, but FK integrity suffers | 🟡 | `route.ts:30-39` |
| parse-bloodwork | Greedy regex JSON extraction on Groq output — fragile | 🟡 | `route.ts:42` |
| daily-metrics | POST retries up to 25× stripping missing columns — worst case = 25 queries | 🟢 | `route.ts:55` |
| save-profile | No validation — accepts `age: -50, smoker: "maybe"` until DB rejects | 🟡 | `route.ts` |
| delete-account | Explicit deletes are redundant (CASCADE handles rest); 5+ extra queries | 🟢 | `route.ts` |
| All AI routes | `console.error('...', err)` leaks full context including PII in prod logs | 🟡 PRIVACY | Multiple |

## Cost model (confirmed against code)

| Scale | Daily cron | Manual gens | Chat | Parse-bloodwork | Monthly total |
|---|---|---|---|---|---|
| 100 users | ~$864 | ~$1,350 | ~$162 | ~$1 | **~$2,376/mo** |
| 1000 users | ~$8,640 | ~$13,500 | ~$1,620 | ~$10 | **~$23,770/mo** |

With **Anthropic system-prompt caching** (master-prompt.ts reference data is ~15k tokens of identical prefix across all calls):
- Cache writes: 1.25× cost; cache reads: 0.1× cost
- Expected savings: **30-40% on generate-protocol + cron, ~15% on chat** (per-user system prompt differs)
- Estimated savings: **~$700/mo at 100 users, ~$7k/mo at 1000 users**

---

# PART 4 — ENGINE / LIB AUDIT

## lib/engine/biomarkers.ts (711 lines, 40 markers)

**What works:** Every biomarker has longevity-optimal range, lab range, optimal range source citation, Bryan value where known, retest interval, category assignment. This is the strongest file in the engine.

- 🟡 `classifier.ts:184-227` — only 18 of 40 biomarkers are weighted in `calculateLongevityScore()`. The other 22 get default weight=1. Users uploading 40 biomarkers see the same score as users uploading 18.
  - **Fix:** Either (a) weight all 40 explicitly, or (b) prune the DB to the clinically-relevant 20 and document why.

## lib/engine/master-prompt.ts (1075 lines)

**What works:** Output contract is detailed + specific; trim functions work correctly; final-reminders block enforces post-conditions; dailySchedule spec is explicit about 15+ entries and every-supplement-at-its-time.

- 🔴 **Token cost.** Prompt is ~20-25k tokens uncompressed. At $3/M input, that's $0.06-$0.08 per generate. With caching it would be $0.006-$0.008 (10× cheaper).
- 🟡 `master-prompt.ts:43-84` — `trimBryanReference` + `trimInterventionRules` save ~5% tokens. The real win is prompt caching, not trimming.
- 🟡 Prompt demands rich fields (life journey, evidence citations, percentile positioning) that Groq fallback can't produce as well. When Claude fails → Groq, user silently gets a weaker protocol. Add model-specific prompt variants.

## lib/engine/phenoage.ts (76 lines)

**What works:** Levine 2018 coefficients correct, linear algebra sound.

- 🟡 `phenoage.ts:19-22` — runs with 4+ inputs, fills population-mean defaults for the other 5. Bias risk: a user with high inflammation but missing MCV+RDW gets an estimate that ignores the unmeasured signal. **Flag confidence based on input coverage.**

## lib/engine/lifestyle-diagnostics.ts (608 lines)

- 🟡 `lifestyle-diagnostics.ts:78-95` — `biomarkerAdjust()` caps the biomarker-vs-lifestyle swing at ±20 points. If lifestyle says "healthy cardio" but LDL=200 + ApoB=120, the cardio organ score barely budges. Remove cap or make it dynamic (more markers = higher allowed swing).
- 🟢 `lifestyle-diagnostics.ts:530,544` — recently-fixed supplement-matching (Round 5). Good.

## lib/engine/patterns.ts (204 lines, 13 patterns)

- 🟡 Rules overlap. HbA1c 5.8 triggers Metabolic Syndrome AND Prediabetes AND Insulin Resistance all three. Add priority/exclusion: if Prediabetes, skip Metabolic unless HbA1c ≥ 6.5.
- 🟡 Rules are snapshot-only. HbA1c 5.3 three months ago → 5.6 today (trend worsening) is read same as stable-at-5.6. Add trend detection when blood tests ≥ 2.

## lib/engine/fallback-protocol.ts (recent round 10, 670+ lines)

**What works:** Supplement timing rules for 17 compounds, rich fallback dailySchedule with hydration + movement breaks + post-lunch walk, merges all supplements into the schedule at their exact times. **Very good.**

- 🟡 Fallback supplements lack `interactions` and `warnings` that master-prompt's AI output has. Safety gap: a fallback stack of Mg + Ca + Zn gets no "space 2h apart" warning.
- 🟢 `buildFallbackBryanComparison` limits to 8 markers; master-prompt asks for 5+. Fine.

## lib/engine/device-catalog.ts (Round 8, 583 lines)

- 🟢 Comprehensive. Capability → column mapping is tight. Samsung Galaxy Watch 8 / Oura Ring 4 / Pixel Watch 3 / WHOOP 5.0 all present (verified).
- 🟡 `antioxidant_index` has no device mapped (only the `antioxidant_scanner` equipment item maps to it). Galaxy Watch Ultra supports antioxidant index but isn't in CAPABILITY_TO_COLUMNS — missing entry.

## Types (lib/types.ts) + Zod usage

- 🟡 `onboarding_data: jsonb` is `Record<string, unknown>` everywhere. Create a proper `OnboardingData` schema, validate at save-profile boundary, downstream code gets real types.
- 🟡 `ProtocolOutput` has ~70 optional fields. Not wrong — AI output is shape-variable — but a Zod schema at generate-protocol output would catch shape drift.

## Components

- 🟢 `components/ui/SectionCard.tsx` — good shared primitive, adopted by tracking/statistics/history.
- 🟡 Dashboard still defines its own Section (emoji + larger title variant) — acceptable, but document why in a comment.
- 🟡 `components/onboarding/` dir exists empty — either populate (extract DevicePicker + EquipmentRow + CollapseSection) or delete.

---

# PART 5 — CROSS-CUTTING ISSUES

## A. Single source of truth violations

| Constant | Good source | Duplicates |
|---|---|---|
| BIOMARKER_COUNT | `biomarkers.ts` (via `BIOMARKER_DB.length`) | ✅ Used correctly everywhere |
| PATTERN_COUNT | `patterns.ts` | ✅ Correctly imported |
| DAILY_HABITS.length | `daily-habits.ts` | ✅ |
| Bryan constants | `bryan-constants.ts` | ✅ (post Round 5) |
| **SITE_URL** | None — hardcoded | 🔴 6 locations: `layout.tsx:11`, `robots.ts:3`, `sitemap.ts:3`, `tracking/page.tsx:770`, `share/[slug]/page.tsx:9,37`, `share/[slug]/opengraph-image.tsx:14` |

## B. Type drift

- `Record<string, unknown>` appears in 17+ files.
- `as unknown` appears in 23+ places.
- Primary offender: `profile.onboarding_data` blob and `protocol.protocol_json` blob.
- Fix: define `OnboardingDataSchema` and `ProtocolJsonSchema` with Zod, validate at boundary.

## C. Dead code / unused

- `components/onboarding/` — empty directory
- `components/landing/` — empty directory
- `lib/engine/master-prompt.ts:43-84` `trimBryanReference` + `trimInterventionRules` — save <5% tokens, not worth the complexity
- `daily-metrics` schema `ages_index` column — no device in catalog writes to it, no UI renders it

## D. Error boundaries / empty states

| Page | error.tsx | loading.tsx | Empty state |
|---|---|---|---|
| dashboard | ✅ | ✅ | ✅ |
| onboarding | ✅ | — | n/a |
| tracking | ✅ | — | 🟡 partial |
| statistics | ✅ | — | ✅ |
| history | ✅ | — | 🟡 partial |
| chat | ✅ | — | ✅ (suggestion chips) |
| settings | ✅ | — | n/a |

Coverage is actually **better than the UI agent claimed** — all 6 app pages have error.tsx (post Round 5). What's missing is `loading.tsx` per-route (only dashboard has one). Less critical — Next 16 uses the global one.

## E. Security

| Check | Status |
|---|---|
| RLS on every table | ✅ + FORCE RLS on profiles/protocols/blood_tests |
| Auth on every API route | ✅ except intentional public (share GET, auth/callback, cron) |
| Cron auth | 🔴 **BROKEN** — `cron/daily-regenerate/route.ts:28` passes if `CRON_SECRET` unset |
| Share slug entropy | 🔴 **WEAK** — `Math.random()` not cryptographically secure |
| Input validation (Zod) | 🟡 only chat-action + generate-protocol output |
| Service-role key scope | ✅ admin client used only in cron + delete-account |
| PII in logs | 🟡 `console.error('Chat error:', err)` leaks full context |
| SQL injection | ✅ all queries via supabase-js (parameterized) |

## F. Performance

- 🔴 Onboarding: 181 useState calls + 2042-line single component = slow on mobile
- 🟡 `proxy.ts:34-45` — onboarding_completed queried twice per request in some flows
- 🟡 `daily-metrics POST` — worst case 25 queries for schema-mismatch recovery
- 🟢 SWR config is correct (20s dedupe, keepPreviousData, no focus-revalidate)
- 🟢 `Promise.all` used in 4 places correctly

## G. AI cost exposure

| Call | Per call | Frequency | Monthly (100 users) |
|---|---|---|---|
| generate-protocol | ~$0.10 | 3/day × 30 days | ~$900 |
| daily-regenerate cron | ~$0.08 | 1/day | ~$240 |
| chat (streaming) | ~$0.008 | assume 5/day | ~$120 |
| parse-bloodwork (Groq) | ~$0.0004 | on-demand | <$5 |
| **Total** | | | **~$1,265/mo** |

Compressed via prompt caching: **~$800/mo**. Big win.

## H. Copy/UX consistency

- 🔴 **EN/RO mix is the single biggest UX issue.** Landing EN, `dashboard/loading.tsx` RO, onboarding EN, all supplement content EN, eMAG/RON supplements RO market. Commit to one. Realistic: target RO market but keep code in EN (labels in a single i18n dict).
- 🟡 Medical disclaimer on terms/privacy strong, but dashboard copy ("Elite tier", "Longevity score") reads diagnostic. Soften to "tier" / "optimization score" or add "preventive optimization, not diagnostic" banner on dashboard.
- 🟡 Date formatting: `en-US` locale hardcoded in 20+ places. Romanian users expect `DD.MM.YYYY`.

## I. Accessibility

- 🟡 `text-[9px]` and `text-[10px]` appear 40+ times. WCAG AA wants 12px+ for body text.
- 🟡 Color-only classification (red/amber/green pills) has text labels — good, but confirm screen reader announces them.
- 🟡 Radar chart lacks `<title>` + aria-label.
- 🟡 No skip-to-content on long dashboard.
- 🟢 Reduced motion handled in globals.css.

## J. Mobile

- 🔴 Onboarding on Samsung A55: 2042-line scroll + 181 inputs = frustration.
- 🟡 Dashboard sidebar TOC (desktop) becomes nothing on mobile — no hamburger replacement.
- 🟡 Header tab bar scroll overflow when many pages added.
- 🟢 Touch targets are consistently 44px+ in recent rounds.

## K. Feedback loop

- ✅ Protocol v1 → v2 diff banner on dashboard (post Round 2).
- ✅ Cron marks `generation_source='cron'` so history distinguishes manual vs auto.
- 🟡 No in-app notification when cron regenerates overnight — user opens dashboard, notices numbers shifted, no explanation unless they scroll to see diff banner.
- 🟡 Statistics page filters by `metrics.length > 0` but not by whether the metric was logged under the current protocol vs previous — trend lines cross protocol boundaries silently.

## L. Strategy layer

See Executive Summary § "Strategic recommendation". Three blocking questions:
1. Target user (RO vs US)
2. Monetization (free tier limits)
3. Medical positioning (coach vs dashboard)

---

# PART 6 — DATABASE AUDIT

## Tables expected vs created

| Table | Created in upgrade.sql | Used by code | Status |
|---|---|---|---|
| profiles | ✅ | ✅ | Good |
| blood_tests | ✅ | ✅ | Good |
| protocols | ✅ | ✅ | Good |
| daily_metrics | ✅ | ✅ | Good |
| compliance_logs | ✅ | ✅ | Good |
| share_links | ✅ | ✅ | Good |
| chat_messages | ❌ | ❌ | Planned but not implemented (chat history not persisted) |

## Missing columns

Verified all ALTER TABLE entries against code — no missing columns the code assumes exist. The daily-metrics API route's 25× retry loop (schema-drift-tolerance) is the safety net.

## Indexes — hot paths covered

- ✅ `idx_blood_tests_user_date` (user_id, taken_at desc) with `where deleted_at is null`
- ✅ `idx_protocols_user_created` same pattern
- ✅ `idx_daily_metrics_user_date`, `idx_compliance_user_date`
- ✅ GIN indexes on jsonb columns (onboarding_data, medications, goals, protocol_json, biomarkers)
- ✅ GIN indexes on text[] columns (conditions, allergies, habits_completed)
- 🟡 No index on `share_links.view_count` — fine, only read by admin/analytics

## RLS — verified per table

| Table | enable RLS | force RLS | Policy coverage |
|---|---|---|---|
| profiles | ✅ | ✅ | select/insert/update (no delete — good, soft-delete only) |
| blood_tests | ✅ | ✅ | select/insert/update/delete |
| protocols | ✅ | ✅ | select/insert/update/delete |
| daily_metrics | ✅ | — | `for all` policy (ok) |
| share_links | ✅ | — | Owner + public-read (intended) |
| compliance_logs | ✅ | — | `for all` policy (ok) |

**RLS is solid.** Agent claim "not verified" — I verified by reading upgrade.sql end-to-end.

## Helper functions

- `get_current_streak(user_id)` — clever window-function solution
- `get_adherence_rate(user_id, days)` — simple aggregate
- `get_latest_diagnostics(user_id)` — good pattern
- 🟡 **None of these three are called from the TS code.** `lib/utils/streak.ts` reimplements streak in JS. Choose: use the SQL functions (1 roundtrip vs loading all logs) or delete them.

## Realtime

- ✅ daily_metrics, compliance_logs, protocols subscribed to supabase_realtime publication. Not currently used by the client (no Realtime subscriptions in the hooks I read) but ready for future features.

## Backfill

- ✅ Existing auth.users backfilled into profiles via `upgrade.sql:530+`

---

# PART 7 — PRIORITIZED ACTION PLAN

## 🔥 BLOCKER — 8 hours total, ship before anything else

### B1. Fix cron auth bypass (30 min)
**File:** `app/api/cron/daily-regenerate/route.ts:28`
**Change:** `if (secret && authHeader !== ...)` → `if (!secret || authHeader !== \`Bearer ${secret}\`) return 401`
**Why:** Currently anyone can trigger regen for all users. Financial + DoS risk.
**Accept:** Calling `curl /api/cron/daily-regenerate` without header → 401. With correct header → 200 and processes.
**Risk if skipped:** Attacker burns cash; Vercel bill surprise.

### B2. Fix dynamic Tailwind classes in daily schedule (30 min)
**File:** `app/(app)/dashboard/page.tsx:1247`
**Change:** Replace `'border-' + c.text.replace(...) + '/20'` with a lookup table `const borderByCat: Record<string, string> = { 'sleep': 'border-blue-400/20', ... }`.
**Why:** Borders silently missing on work/school/exercise block rows. Looks broken.
**Accept:** In production build, inspect a schedule block item, confirm `border-blue-400/20` (or similar) is present in the DOM.
**Risk if skipped:** Dashboard looks half-styled.

### B3. Fix share slug entropy + view_count race (1 hour)
**File:** `app/api/share/route.ts`
**Changes:**
- Line 11: `const slug = crypto.randomBytes(6).toString('base64url').slice(0, 10)` (Node crypto, cryptographically secure)
- Lines 34-38: Create SQL helper `increment_share_view(p_slug text)` OR use `.rpc('increment_share_view', {p_slug: slug})` OR inline update with atomic increment
**Why:** Slugs currently guessable; view counts lose under concurrent load.
**Accept:** Generate 100 slugs, confirm distinct + ≥10 chars; 10 concurrent GETs, confirm view_count lands on 10.
**Risk if skipped:** Privacy leak (guessable URLs) + wrong analytics.

### B4. Fix BASE_URL hardcoding (30 min)
**File:** create `lib/config.ts`, update 6 call sites
**Change:** `export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://protocol-tawny.vercel.app'`
**Touches:** `layout.tsx:11`, `robots.ts:3`, `sitemap.ts:3`, `tracking/page.tsx:770`, `share/[slug]/page.tsx:9+37`, `share/[slug]/opengraph-image.tsx:14`
**Why:** Moving to custom domain = 6 edits + 1 deploy; currently fragile.
**Accept:** grep for `protocol-tawny.vercel.app` returns 0 code hits (README ok).
**Risk if skipped:** Hard domain migration.

### B5. Add Anthropic prompt caching on master-prompt + chat (4 hours)
**Files:** `lib/engine/master-prompt.ts`, `app/api/chat/route.ts`, `app/api/generate-protocol/route.ts`, `app/api/cron/daily-regenerate/route.ts`
**Change:** Split system prompt into (a) cacheable reference block (BRYAN_REFERENCE + INTERVENTION_RULES + BUDGET_RULES + UNIVERSAL_TIPS — identical across users) and (b) user-specific block. Wrap (a) with `{ type: 'text', text: '...', cache_control: { type: 'ephemeral' } }` in the Anthropic messages API.
**Why:** 30-40% cost reduction. At 100 users = $700+/mo saved. At 1000 = $7k/mo.
**Accept:** Check Anthropic API response metadata — `cache_read_input_tokens` > 0 after 2nd call; monthly bill drops within 2 weeks.
**Risk if skipped:** Cost spiral at growth.

### B6. Cron skip inactive users (1.5 hours)
**File:** `app/api/cron/daily-regenerate/route.ts:37-41`
**Change:** Before processing each user, check `daily_metrics` for any row in last 7 days OR `compliance_logs` in last 7 days. If neither, skip and mark `results.skipped++`.
**Why:** 40-60% of users on any given day are inactive. Regenerating their protocol wastes ~$500/mo per 100 inactive users.
**Accept:** Cron output `{processed: X, skipped: Y}` where Y > 0. Reduced Anthropic bill within a week.
**Risk if skipped:** Cost model unsustainable past 500 users.

---

## 🎯 HIGH VALUE — 16 hours, this week

### H1. Onboarding auto-save to localStorage on field blur (3 hours)
**File:** `app/(app)/onboarding/page.tsx`
**Change:** Add debounced effect to sync all states to localStorage every 500ms. On mount, read from localStorage if `profile.onboarding_step < 5`.
**Why:** 181 state vars + no auto-save = rage quits on mobile.
**Accept:** Fill step 2, refresh browser, data restored on reload.
**Risk if skipped:** High drop-off during onboarding.

### H2. Lock in target user + language (2 hours, strategic)
**File:** README.md + commit strategic decision
**Change:** Write single-paragraph positioning doc. Rewrite landing headline + 3 CTAs + hero subtitle in chosen language. Keep app UI in EN for now (simpler). Add `dashboard/loading.tsx` in chosen language.
**Why:** Unresolved positioning costs real conversion.
**Accept:** Landing in one language end-to-end; README has a "Positioning" section.
**Risk if skipped:** Scattered marketing.

### H3. Zod validation at API boundaries (3 hours)
**Files:** `save-profile/route.ts`, `save-bloodtest/route.ts`, `retest/route.ts`, `compliance/route.ts`, `daily-metrics/route.ts`
**Change:** Add Zod schemas, parse inside try/catch, return 400 on parse failure with issues list.
**Why:** Currently `age: -50, smoker: "maybe"` reaches the DB and the LLM prompt.
**Accept:** `curl` with bad body → `{error, issues: [...]}` 400.
**Risk if skipped:** Bad data in protocol generation = weird outputs.

### H4. Mobile hamburger for dashboard TOC (1.5 hours)
**File:** `app/(app)/dashboard/page.tsx` + `components/layout/DashboardTOC.tsx` or wherever it lives
**Change:** Show TOC as sheet overlay behind a hamburger button on `<lg`.
**Accept:** On 375px viewport, hamburger visible; tapping opens drawer with section links.

### H5. Dashboard skeleton matches final layout (1 hour)
**File:** `app/(app)/dashboard/page.tsx:135-145` or pull into `dashboard/loading.tsx`
**Change:** Skeleton mirrors 3-col desktop layout + stacked mobile.
**Accept:** No layout shift on first load (Lighthouse CLS < 0.05).

### H6. Structured error logging (2.5 hours)
**File:** all `/api/*` routes
**Change:** Add `lib/logger.ts` wrapper, replace `console.error('Chat error:', err)` with `logger.error('chat.stream_failed', { userId: user.id, errorMessage: err.message })`. Sensitive body fields redacted. Optional Sentry integration.
**Why:** Observable production + no PII leaks.
**Accept:** grep for `console.error` in `app/api/` returns 0.

### H7. Empty state + loading state for Chat first message (1 hour)
**File:** `app/(app)/chat/page.tsx`
**Change:** While streaming, show typing indicator. If API error, show retry button inline.
**Accept:** Disable network, send message, see retry UI.

### H8. In-app notification on cron-regenerated protocol (2 hours)
**File:** `lib/hooks/useApiData.ts` or new notification banner in app layout
**Change:** If most recent protocol `generation_source === 'cron'` AND `created_at` is post-last-user-view, show dismissable top banner: "Your protocol was updated overnight — see what changed".
**Accept:** Trigger cron regen manually, open dashboard, see banner.

---

## 💎 POLISH — 24 hours, this month

### P1. Extract onboarding into step sub-components (4 hours)
Split 2042-line file into 5 × ~400-line files (OnboardingStep0Basics, Step1Blood, Step2Lifestyle, Step3Day, Step4Goals) + `hooks/useOnboardingForm.ts` holding state. Wire CollapseSection, DevicePicker, EquipmentRow into `components/onboarding/`.

### P2. Typed onboarding_data schema (3 hours)
Define `OnboardingDataSchema` in `lib/engine/onboarding-schema.ts`. Validate at `save-profile` boundary. Remove `as unknown` / `Record<string, unknown>` from consumers.

### P3. Complete classifier weights (2 hours)
`lib/engine/classifier.ts:184-227` — explicitly weight all 40 biomarkers or prune to 20.

### P4. Pattern priority + trend detection (3 hours)
`lib/engine/patterns.ts` — rule exclusion (if Prediabetes detected, skip Metabolic Syndrome overlap). Add trend-aware pattern variants when ≥2 blood tests exist.

### P5. Remove biomarkerAdjust maxSwing cap (30 min)
`lib/engine/lifestyle-diagnostics.ts:78-95` — allow full swing when ≥3 relevant markers present.

### P6. PhenoAge confidence flagging (2 hours)
Return confidence score based on input coverage. UI shows "low confidence" badge when <7/9 markers present.

### P7. Supplement interaction warnings in fallback (2 hours)
`lib/engine/fallback-protocol.ts` — populate `interactions` + `warnings` per supplement using `lib/engine/interactions.ts` data.

### P8. Share link expiration UI (1 hour)
Settings page → list of active shares with view count + "revoke" button + "set expiration" picker.

### P9. PDF export button on dashboard (2 hours)
Use react-pdf or jsPDF to generate downloadable protocol PDF (vs browser Print).

### P10. Romanian date formatting (1 hour)
Replace `en-US` locale with `ro-RO` in 20+ places, OR add a tiny i18n helper that reads from user profile.

### P11. Text size floor — ban text-[9px] and text-[10px] (1.5 hours)
Global find-replace to minimum `text-xs` (12px). WCAG AA.

### P12. Remove unused trimBryanReference / trimInterventionRules (30 min)
After prompt caching lands, these save <5% and add complexity.

### P13. Delete empty dirs + unused SQL helper functions OR wire them up (1 hour)
`components/onboarding/`, `components/landing/`, `get_current_streak()` SQL function.

---

## 🚀 GROWTH — post-launch

### G1. Monetization (Stripe + feature gates)
Free = lifestyle-only + 1 gen/month. Paid €9.99/mo = unlimited + Claude + chat.

### G2. Chat history persistence (chat_messages table)
Currently chat resets on reload. Persist with optimistic updates + SWR.

### G3. Wearable API integration
Oura API, Garmin Connect, Apple HealthKit (iOS app first) → auto-populate daily_metrics.

### G4. A/B testing framework
Test fallback vs Claude quality, landing headline variants, CTA copy.

### G5. Referral loop
"Invite a friend, both get 1 month free" — low CAC, compounding.

### G6. SEO — programmatic landing pages
`/biomarkers/[code]`, `/patterns/[name]`, `/bryan-johnson-diet-compared` — long-tail capture.

---

# PART 8 — OPEN QUESTIONS

Things I can't decide without Andrei's input:

1. **Target user + primary language.** RO only? EN only? Bilingual with locale detection? Commits to ~3h of implementation regardless.
2. **Monetization timing.** Ship free-only for 1 month to gather feedback, or launch with Stripe day 1?
3. **Medical positioning.** Is "longevity coach" framing OK, or does legal want softer language (e.g., "lifestyle optimization companion")?
4. **Cron frequency.** 1×/day (current) OR weekly with push-on-demand regenerate? Weekly cuts costs 85% but removes "overnight protocol update" feature.
5. **Prompt caching investment.** Spend 4h now, or wait until first $500 Anthropic bill lands?
6. **Onboarding refactor.** Keep 2042-line single file (works, don't fix) or spend 4h splitting into 5 step-files (better DX, regression risk)?
7. **Chat history.** Persist to DB (new migration + 2h code) or keep session-only (simpler, user loses history on reload)?
8. **Apple/Google auth.** Only Google currently. Add Apple (required for iOS App Store if you publish)?

---

# VERIFICATION (how to prove the fixes work)

After implementing BLOCKER group, verify end-to-end:

```bash
# B1: cron auth
curl -X GET https://protocol-tawny.vercel.app/api/cron/daily-regenerate
# Expect: {"error":"Unauthorized"}
curl -X GET -H "Authorization: Bearer $CRON_SECRET" https://.../api/cron/daily-regenerate
# Expect: {"ok":true,"processed":N,...}

# B2: Tailwind borders — open dashboard, schedule section, inspect a block item
# Expect: border-{color}-400/20 class present in compiled CSS

# B3: share slug + view count
# Generate 100 slugs via POST /api/share, confirm distinct + ≥10 chars
for i in {1..10}; do curl https://.../api/share?slug=$SLUG & done; wait
# Check DB: SELECT view_count FROM share_links WHERE slug=$SLUG → 10

# B4: SITE_URL
grep -rn "protocol-tawny.vercel.app" app/ lib/ --include="*.ts" --include="*.tsx"
# Expect: 0 matches (README is OK)

# B5: prompt caching
# Trigger 2 consecutive generate-protocol calls; check Anthropic dashboard
# Expect: cache_read_input_tokens > 0 on 2nd call

# B6: cron skip
# Manually mark 5 users inactive (no metrics in 7+ days)
# curl with CRON_SECRET
# Expect: response.skipped >= 5
```

Build + typecheck:

```bash
npm run build && npx tsc --noEmit
# Expect: 0 errors
```
