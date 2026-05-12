# Procotol — Master Improvement Brief for Claude

> **For:** Claude (any future Sonnet/Opus session opening this repo).
> **From:** Andrei (owner) via Claude Opus 4.7, plan mode, 2026-05-12.
> **Repo:** `c:\Users\Andrei\Procotol` · **Branch:** `master` (clean) · **Live:** https://protocol-tawny.vercel.app
> **Companion doc:** `AUDIT_AND_PLAN.md` at repo root — dated 2026-04-19, HEAD `7536145`. Many of its Blockers may already be resolved by the Phase 5.5 + Phase 6 commits that followed. **Verify before re-doing.** This brief assumes that audit as background reading and focuses on what to do *now*.

---

## Context — why this brief exists

Procotol is an AI longevity-protocol engine for Romanian health-conscious adults (28–45, disposable income, lifestyle optimizers). Blood work in → personalised protocol out. Daily tracking and a Claude-streaming coach evolve the plan over time. The codebase is ~75% ship-ready (per April audit) and Phase 6 has shipped a Romanian-first UI sweep across landing, login, dashboard, onboarding, settings, MealLogger, WorkoutLogger, TodaysAgenda, AskAIPill, marketing sub-pages, theme picker, OAuth modal, install prompt, and error/loading screens.

The owner wants the next push to land a product that is **secure, fast, fluid, beautifully usable, GDPR-clean, and unmistakably European** — without bloating scope or losing the existing polish. This document is the brief. It is executable: each phase has files to touch, acceptance criteria, and verification commands.

**Operating principles (non-negotiable, read first):**

1. **This is Next.js 16 + React 19 + Tailwind v4.** Before writing any code, open `node_modules/next/dist/docs/` for the relevant area (App Router, server actions, middleware, route handlers). APIs differ from training data. Heed deprecation notices.
2. **Romanian-first UI.** Default copy is RO. The i18n dict (`lib/i18n/dictionaries.ts`) is the source of truth; do not hardcode strings in components — extend the dict. AI-generated protocol JSON stays English (regen-cost trade-off; documented).
3. **No new abstractions for hypothetical needs.** No design-system rewrite, no introducing shadcn/ui or Radix, no swapping SWR for React Query. Use what exists. Edit, don't add.
4. **Health data = GDPR Art. 9 special category.** Treat every change touching `profiles`, `blood_tests`, `daily_metrics`, `meals`, `chat_messages` with that lens.
5. **RLS-first.** Every new table or column gets `force row level security` and explicit `auth.uid()` policies. No exceptions.
6. **Server-side only for secrets.** `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `GROQ_API_KEY` never reach the client bundle. Use `lib/supabase/admin.ts` for service-role; keep imports out of `app/(app)/**` client components.
7. **No emojis in files** unless they're already part of the design system (e.g., agenda category icons in `lib/engine/daily-schedule.ts`).
8. **Don't break the cookie patch in [proxy.ts](proxy.ts).** The 400-day `maxAge` override (lines 24–27) fixes a real bug where browsers dropped the Supabase refresh token after tab close. Touch with care.
9. **323 tests must stay green.** Run `npm test` before and after every phase.

---

## Phase 0 — Verify what's already done (2–4 h, do first)

Several items from `AUDIT_AND_PLAN.md` blockers may have been silently fixed in commits since `7536145`. Before adding work, confirm what's still open.

For each item below, verify with the listed command. If green, mark resolved in `AUDIT_AND_PLAN.md` (append a `RESOLVED 2026-MM-DD` line). If still red, escalate to Phase 1 Blockers.

| ID | Check | Command |
|---|---|---|
| B1 | Cron auth no longer bypassable | `Grep "if \(secret &&" app/api/cron/daily-regenerate/route.ts` — expect 0 matches |
| B2 | Dashboard daily schedule borders not built from dynamic strings | `Grep "'border-' \+" app/(app)/dashboard/page.tsx` — expect 0 matches |
| B3a | Share slug uses crypto-strong randomness | `Grep "Math.random" app/api/share/route.ts` — expect 0 matches |
| B3b | Share view_count uses atomic increment | Read [app/api/share/route.ts](app/api/share/route.ts), confirm `.rpc('increment_share_view'` or equivalent — not read-then-update |
| B4 | SITE_URL centralised | `Grep "protocol-tawny.vercel.app" --type=ts --type=tsx -- app lib` — expect 0 matches |
| B5 | Anthropic prompt caching wired | `Grep "cache_control" lib/engine app/api` — expect ≥3 matches |
| B6 | Cron skips inactive users | Read [app/api/cron/daily-regenerate/route.ts](app/api/cron/daily-regenerate/route.ts), confirm pre-check against `daily_metrics` and `compliance_logs` within the last 7 days |
| H1 | Onboarding auto-saves to localStorage between steps | `Grep "localStorage" app/(app)/onboarding/page.tsx` — expect a debounced setItem call |
| H3 | Zod at save-profile / save-bloodtest / compliance / daily-metrics / retest | Read each route, confirm `.parse(` or `.safeParse(` of body |

Run `npm test` and `npm run build` at the end of Phase 0. Both must pass before continuing.

---

## Phase 1 — Security & GDPR (EU launch readiness, 12–16 h)

The product targets Romania, which means full GDPR scope including Article 9 (special category health data). Today the policy text is in place, but technical guarantees and operational evidence are partial.

### 1.1 Security headers (90 min)
Edit [next.config.ts](next.config.ts) — add a `headers()` function returning, for `'/(.*)'`:
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(self), microphone=(), geolocation=(self), interest-cohort=()` — note `camera=(self)` is required because MealLogger uses `capture="environment"`.
- `Content-Security-Policy` — start in `Content-Security-Policy-Report-Only` mode for 1 week. Sources: `default-src 'self'`; `img-src 'self' data: blob: https://*.supabase.co`; `connect-src 'self' https://*.supabase.co https://api.anthropic.com https://api.groq.com https://*.upstash.io https://vercel-analytics.com`; `script-src 'self' 'unsafe-inline'` (needed for the pre-hydration theme/locale boot scripts in [app/layout.tsx](app/layout.tsx) — do NOT remove those); `style-src 'self' 'unsafe-inline'` (Tailwind v4 inline `<style>`); `font-src 'self' data:`; `frame-ancestors 'none'`.

Verify: `curl -I https://protocol-tawny.vercel.app/` — all five headers present.

### 1.2 Cookie consent banner — EU-compliant (3 h)
Vercel Analytics fires before consent today. That's not OK in the EU.

Create `components/layout/CookieConsent.tsx` (client component): a slide-up bottom bar, Romanian default copy, three options — **Accept**, **Reject non-essential**, **Settings**. Persist choice to `localStorage('procotol:consent', JSON.stringify({ analytics: bool, ts: ... }))`. Wire in [app/layout.tsx](app/layout.tsx) so `<Analytics />` only mounts after `analytics=true`.

Add a "Cookie preferences" link in the footer and in `/settings` that re-opens the modal. Localise via the i18n dict — keys `consent.title`, `consent.body`, `consent.accept`, `consent.reject`, `consent.settings`, `consent.analytics_label`, `consent.essential_label`.

Verify: First incognito visit shows banner; refusing analytics → DOM check confirms no `va.vercel-scripts.com` or `@vercel/analytics` script tags.

### 1.3 Sub-processor disclosure & DPA register (1.5 h)
Update [app/(marketing)/privacy/page.tsx](app/(marketing)/privacy/page.tsx) to list every sub-processor with: **Name · purpose · data categories shared · region · DPA reference**. Required entries: Supabase (auth + DB, region), Vercel (hosting + analytics, region), Anthropic (AI processing, prompts may contain health data, region), Groq (fallback AI, same), Upstash (rate-limiting, no PII), Stripe (when active, billing only), Oura/Fitbit/Withings/Whoop/Google Fit (only if user explicitly connected).

For each, link to the public DPA URL. If a DPA is not signed yet (likely Anthropic + Groq), flag in your reply that the owner must sign or remove the integration before EU launch. Don't ship Anthropic/Groq calls containing health data without a DPA in place.

### 1.4 Data residency (research + decide, 1 h)
Confirm Supabase project region. If `us-east-1`, that's a cross-border transfer under GDPR. Two options:
- **Best:** Migrate project to `eu-central-1` (Frankfurt) or `eu-west-2` (London). Requires a one-time export/import — Supabase supports this from the dashboard but you lose realtime publications and need to re-grant the realtime tables. Plan a 2 h window.
- **Acceptable:** Document SCCs (Standard Contractual Clauses) in the privacy page. Slower legally; doesn't fix the EU-data-stays-in-EU expectation Romanian users have.

Owner decision required — surface in your reply. Don't migrate without explicit approval.

### 1.5 Field-level encryption for the most sensitive columns (4 h, optional but recommended)
Supabase provides encryption at rest by default. That protects against disk theft, not against a leaked service-role key or a misconfigured RLS policy. For two columns this is worth doing:
- `profiles.medications`
- `profiles.conditions`

Use Supabase Vault (pgsodium) — `vault.create_secret()` per row OR a single application-key wrapping pattern via the Supabase Vault API. Encryption/decryption happens server-side in API routes that read/write these columns. **Do not** encrypt biomarkers (you need to compute on them) or `protocol_json` (too large, hot-path).

Skip if Phase 1 is already over budget — list as a debt item.

### 1.6 Account deletion completeness audit (1 h)
Read [app/api/delete-account/route.ts](app/api/delete-account/route.ts). For each table in the schema, verify either (a) the user-row is cascaded by FK or (b) the route explicitly deletes it. Pay attention to: `share_links`, `oauth_connections` (must revoke tokens with providers, not just drop the row), `chat_messages`, `meals`, `supplement_feedback`. Add provider-side token revocation calls (Oura, Fitbit, Withings, Whoop, Google Fit) — each has a `POST /revoke` endpoint.

Verify: Create test account, populate every table with one row, delete account, query each table with service role: zero rows match the user_id. Provider apps show the connection revoked.

### 1.7 Audit log table for service-role operations (2 h)
New table `audit_log` — `id uuid, ts timestamptz, actor text, action text, target_user_id uuid, metadata jsonb`. Insert from `lib/supabase/admin.ts` wrapper functions for the four sensitive paths: cron, delete-account, stripe-webhook, oauth-callback-token-storage. RLS disabled (only service role reads). Add `force row level security` anyway with a deny-all policy, so a future anon-key leak can't read it.

Migration: `supabase/migrations/0003_audit_log.sql`.

### 1.8 Rate-limit founder email leak (10 min)
[.env.local.example](.env.local.example) currently contains `musateduardandrei10@gmail.com` as a hardcoded bypass example. Replace with `your-email@example.com`. The real bypass list lives in Vercel env vars, not in the repo example.

### 1.9 PDF parser hardening (1 h)
[app/api/parse-bloodwork/route.ts](app/api/parse-bloodwork/route.ts) uses `pdf-parse@2.4.5`. Risk: malformed PDFs can OOM or expose XXE vectors.
- Confirm the 10 MB size cap is enforced **before** invoking the parser, not after.
- Wrap the parse call in a 15 s timeout (the route has `maxDuration` but inside the handler too).
- Reject if `result.numpages > 50`.
- Strip any `<` and `>` from extracted text before sending to Groq.

---

## Phase 2 — Performance & cost (10–14 h)

### 2.1 Anthropic prompt caching, finalised (4 h — if Phase 0 found B5 unresolved)
Split [lib/engine/master-prompt.ts](lib/engine/master-prompt.ts) into three slabs:
1. **`SHARED_REFERENCE`** — `BRYAN_REFERENCE`, `INTERVENTION_RULES`, `BUDGET_RULES`, `UNIVERSAL_TIPS`, biomarker-range table. Identical across all users and calls. ~15 k tokens.
2. **`USER_REFERENCE`** — onboarding profile blob, current daily_metrics rollups, recent blood test. ~3–5 k tokens, stable for ~24 h.
3. **`USER_TURN`** — the actual ask of this generation/chat turn.

In the Anthropic SDK call, pass three message blocks with `cache_control: { type: 'ephemeral' }` on (1) and (2). Verify with the response metadata — `cache_read_input_tokens` should be >0 from the second call onward.

Apply to `/api/generate-protocol`, `/api/cron/daily-regenerate`, `/api/chat`, `/api/chat-action`, `/api/meals/analyze` (where prompt size justifies).

Telemetry: log `{ cache_read, cache_create, input, output }` per call to `audit_log` (1.7). Monitor cache hit rate weekly — target ≥80% on shared block.

### 2.2 Cron: process only active users (1 h — if B6 unresolved)
In [app/api/cron/daily-regenerate/route.ts](app/api/cron/daily-regenerate/route.ts), before each user iteration:

```ts
const recent = await admin
  .from('daily_metrics')
  .select('id', { head: true, count: 'exact' })
  .eq('user_id', user.id)
  .gte('date', sevenDaysAgo);
if ((recent.count ?? 0) === 0) {
  const recentCompliance = await admin
    .from('compliance_logs').select('id', { head: true, count: 'exact' })
    .eq('user_id', user.id).gte('date', sevenDaysAgo);
  if ((recentCompliance.count ?? 0) === 0) { results.skipped++; continue; }
}
```

Also: **batch users in groups of 10**, `Promise.all` per batch, sleep 1 s between batches to stay under Anthropic rate limits.

### 2.3 Onboarding refactor — split 2042-line monolith (4 h)
File: [app/(app)/onboarding/page.tsx](app/(app)/onboarding/page.tsx). 181 `useState` calls in one component re-creates 100+ handlers each render. Mobile Samsung A55 will jank.

Plan:
- Move state into a single `useReducer` keyed by step. New file `lib/hooks/useOnboardingForm.ts`.
- Split into `components/onboarding/Step1Basics.tsx`, `Step2Biomarkers.tsx`, `Step3Lifestyle.tsx`, `Step4Wearables.tsx`, `Step5Goals.tsx`. Each ≤400 lines.
- Extract `DevicePicker`, `EquipmentRow`, `CollapseSection` to their own files in `components/onboarding/`.
- Wire localStorage auto-save in the reducer (debounced 500 ms via `useDeferredValue` + effect).
- The top-level `page.tsx` becomes a step-router (≤200 lines).

Acceptance: Lighthouse mobile TTI improves by ≥1.5 s on the onboarding flow. No test regressions.

### 2.4 Server vs client split on the dashboard (2 h)
[app/(app)/dashboard/page.tsx](app/(app)/dashboard/page.tsx) is ~1500 lines and entirely `'use client'`. Most sections only read data and don't need client reactivity.

Move static-content sections into server components, keep interactive widgets (`WorkoutLogger`, `MealLogger`, `AskAIPill`, `TodaysAgenda` controls, `OrganRadar` lazy-loaded) as client islands. Use server-side Supabase from `lib/supabase/server.ts` to fetch the protocol once per request and pass to children.

This saves ~50–80 kB JS on first paint. Lighthouse: target FCP <1.2 s on a mid-tier Android.

### 2.5 Image optimisation in MealLogger (1 h)
Today the meal photo is compressed client-side (good) but the result is sent as multipart/form-data. Switch to:
- Client compression → keep
- Server: `next/image` for any persisted thumbnails (none persisted today by design — confirm), but for the AI vision call, send as a `data:` URL inline to Anthropic.
- Confirm no `<img>` tags reference user-uploaded photo URLs (they shouldn't — the design ditches the photo after analysis).

### 2.6 SWR config — eliminate accidental refetches (30 min)
Read [lib/hooks/useApiData.ts](lib/hooks/useApiData.ts). Confirm `revalidateOnFocus: false`, `revalidateIfStale: false`, `dedupingInterval: 20_000`. If not, set them. Dashboard mounts ~6 SWR hooks; without this, switching tabs nukes Anthropic rate limits.

---

## Phase 3 — UX polish (8–12 h)

The Phase 6 RO sweep is solid. These items close the remaining rough edges flagged in the audit and observed in the live build.

### 3.1 Romanian date & number formatting everywhere (2 h)
20+ places use `en-US` locale or naked `.toLocaleDateString()`. Create `lib/utils/format.ts` with `formatDate(d, locale)`, `formatNumber(n, locale, opts)`, `formatRelative(d, locale)`. Read locale from the user-preference store (already exists for theme/language). Default `ro-RO`. Romanian users expect `DD.MM.YYYY` and comma decimals (`1.234,56`).

Grep target: `Grep "toLocaleDateString\|en-US" --type=tsx --type=ts -- app lib components` — replace each call.

### 3.2 Ban font sizes below 12 px (45 min)
WCAG AA wants 12 px minimum for body. Today `text-[9px]` and `text-[10px]` appear 40+ times. Replace with `text-xs` (12 px) globally where they apply to body/label text. Keep smaller sizes only inside SVG charts where text is decorative.

Grep: `Grep "text-\[9px\]\|text-\[10px\]" --type=tsx -- app components`.

### 3.3 Mobile TOC drawer (1.5 h)
Dashboard TOC is desktop-only. On mobile (≤lg), no nav inside the dashboard. Add a hamburger pill (top-right of dashboard, below header) that opens a Sheet/Drawer with the same section links. Slide animation. Close on link tap.

### 3.4 Loading skeletons that match final layout (1 h)
Several `loading.tsx` files render a centered spinner. That shifts layout when content arrives. For each of `/dashboard`, `/tracking`, `/statistics`, `/history`, `/chat`, `/settings`, the `loading.tsx` should render a skeleton mirroring the page's grid (use existing `<Skeleton />` primitive). Target Lighthouse CLS <0.05.

### 3.5 Empty-state polish on Statistics and History (1.5 h)
For brand-new users with one blood test and three days of metrics, these pages today show empty charts and bare lists. Add empty states with:
- An illustration (use Lucide icons composed, no new asset deps).
- One-line empathy ("Mai dă-i o săptămână, apoi revino — graficele prind sens după ~7 zile de tracking").
- A primary CTA back to `/tracking`.

### 3.6 Per-message retry on `/chat` (1 h)
Today if the chat stream fails mid-response, the user sees a half-message and no clear next step. On error, replace the half-bubble with an inline `<RetryMessage />` showing `[Error: ...] [Retry]`. Tapping retry re-sends the same user message.

### 3.7 In-app banner when cron regenerates overnight (2 h)
After cron runs, the user opens the app and sees changed numbers with no explanation. Add a dismissible top-of-dashboard banner:
- Trigger: most recent protocol's `generation_source === 'cron'` and `created_at > last_seen` (cookie `procotol:dashboard_last_seen`).
- Copy (RO): "Protocolul tău s-a actualizat azi-noapte. Vezi ce s-a schimbat ↓"
- Tap scrolls to the existing v1→v2 diff section.

### 3.8 PDF export of the protocol (2 h)
Add a "Exportă PDF" button in `/dashboard` and `/history`. Use `react-pdf/renderer` (no Chromium dep, EU-friendly), generate client-side. Layout: cover (logo, name, date, score, bio age), summary, organ systems, daily schedule, supplements, doctor-discussion. Romanian copy. ≤4 pages.

### 3.9 Add a "Discuție cu medicul" doctor-mode share (2.5 h)
Existing `/api/share` is a public marketing share. Add a sibling: `/api/share/clinical` that emits a doctor-friendly view — purely clinical language, biomarker values with reference ranges, current medications/supplements, top 3 patterns detected, no Bryan comparison, no "longevity score" branding. Same RLS pattern. Slug TTL: 14 days, then auto-expire.

Why: Romanian GPs don't follow Attia/Johnson. A clinical-style summary lets the user say "uite aici, dr., ce iau". Real-world value, low build cost.

---

## Status update — 2026-05-12 (post Phase 7-13 shipping)

The first four commit batches of this brief landed live:

- ✅ **Phase 7** (`260b29b`) — EU launch readiness: security headers, GDPR cookie consent, full privacy rewrite, PDF parser hardening.
- ✅ **Phase 8** (`7d35aa3`) — audit_log table + helper, full account deletion with provider revoke, F3 calendar `.ics` export, F12 non-shaming streak break, GitHub Actions CI, cron banner RO.
- ✅ **Phase 9** (`844d61a`) — `/share/clinical/[slug]` doctor-share view, PrivacyControls in Settings, mobile TOC drawer fully RO, settings exports + share links Romanised.
- ✅ **Phase 10+** (this push) — BYOK Anthropic key (Settings UI + /api/save-profile + /api/generate-protocol wiring + my-data redaction), Vault encryption prep migration, Web Push (SW handlers + subscribe endpoint + Settings UI), F4 voice log on tracking, F5 weekly digest cron (dry-run mode until Resend keys), F8 household schema, F9 referral RO sweep.

### Still not done — and why

**Items that need owner action (cannot be done from code alone):**
- 1.4 Supabase EU migration — requires Supabase dashboard project move. Privacy page already documents SCCs as the interim path.
- 5.1 monetisation timing — Stripe live credentials required. Schema is ready; UI gate needs the owner's pricing decision.
- F2 HealthKit / Health Connect — requires native iOS app shell (HealthKit) or signed Android package (Health Connect). Web cannot reach these APIs.
- F6 lab APIs — no public APIs without partner contracts at Synevo / Regina Maria / MedLife / Bioclinica.
- F7 pharmacy aggregator — legal review for scraping eMAG / Catena / Sensiblu / Help Net, or signed partner.
- F15 CGM (Libre / Dexcom) — both vendors require partner-program access for app integrations.

**Items deferred because the risk-to-reward in a single iteration is wrong:**
- 2.3 onboarding refactor (2042 lines, 181 useState calls) — needs a dedicated session with full regression coverage. Partial refactor is worse than no refactor.
- 2.4 dashboard server/client split (~1500 lines, ~6 SWR hooks woven in) — same risk profile as 2.3.

**Items effectively done by a different path:**
- 3.8 PDF export — `/share/clinical/[slug]` carries a print stylesheet that emits a clean A4 one-pager. File → Print → Save as PDF in any browser produces the same artefact a `react-pdf` SDK would, without the 250 KB dep.
- 5.6 Sentry — `lib/logger.ts` already redacts PII and is the single hook point. Wiring `@sentry/nextjs` is one block in `emit()` away when the owner provisions a DSN; not adding the SDK weight until that happens.
- F13 doctor invite — `/share/clinical/[slug]` is the doctor invite. Optional expiration UI in Settings already exists. A bespoke "doctor email + magic link" iteration is a follow-up.

### Migrations to apply manually (Supabase SQL Editor, in order)

All idempotent — safe to re-run.

1. `supabase/migrations/0003_audit_log.sql` — append-only audit_log + log_audit() helper.
2. `supabase/migrations/0004_byok_and_vault_prep.sql` — profiles.anthropic_api_key column + encrypt_pii/decrypt_pii helpers (vault not yet active in app code).
3. `supabase/migrations/0005_push_subscriptions.sql` — Web Push subscription rows.
4. `supabase/migrations/0006_household.sql` — household_owner_id + household_role columns on profiles (UI follow-up).

Until these run, the dependent features no-op gracefully: BYOK card shows "salvarea a eșuat (column missing)", push card stays at "available" but subscribe returns 500, etc. Nothing else breaks.

### Owner env vars to set in Vercel for full feature parity

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` + `VAPID_SUBJECT` — Web Push; generate with `npx web-push generate-vapid-keys`. Without these, PushNotificationsCard renders the "Not configured" state.
- `RESEND_API_KEY` + `RESEND_FROM` — weekly digest send. Without them the cron runs in dry-run mode and emits `weekly_digest.dry_run` log entries (one per opted-in user).
- `CRON_SECRET` — required for both `/api/cron/daily-regenerate` and `/api/cron/weekly-digest`; both fail closed when unset.

### Server-side send wiring still pending

The Web Push table exists, the SW handles push events, the client subscribes successfully — but there is no `/api/push/send` endpoint yet because it requires the `web-push` library (or a manual JWT signer) and VAPID keys. Add the route + dep after generating VAPID; the rest of the plumbing is in place.

---

## Phase 4 — New features (proposals, 30–60 h depending on scope picked)

The owner agreed to **balanced scope including new features**. These are concrete proposals — each with a one-line value statement, rough effort, and a "ship-it-or-skip" criterion. The owner picks. Do not start building these without confirmation.

| # | Feature | Value | Effort | Ship if… |
|---|---|---|---|---|
| F1 | **Web Push notifications (PWA)** — protocol updated, retest due, streak milestones | Re-engagement w/o Apple/Google deps; 100% EU-friendly | 6 h | Owner wants daily re-engagement past month 1 |
| F2 | **Apple HealthKit + Google Health Connect bridge** | Closes the biggest tracking-data gap; users on iPhone today can't auto-sync | 12 h (HealthKit needs an iOS shell or a Shortcut workflow; Health Connect is web-API) | Owner plans iOS app or accepts Shortcut workaround |
| F3 | **Calendar export (.ics)** of TodaysAgenda + supplement schedule | Solves "I keep forgetting the 4pm Mg" — Outlook/Google/Apple calendar friendly | 3 h | Always — small effort, real value |
| F4 | **Voice log** — "Am dormit 7 ore și am mers 8000 de pași" → daily_metrics row | Friction killer, distinctive | 6 h (Web Speech API + Claude parse → `daily-metrics` POST) | Owner wants distinctive feature |
| F5 | **Weekly digest email (Sunday)** — what changed, what's next week | Re-engagement without push permission; email native EU | 5 h (Resend + a server route + a cron) | Owner has a sender domain ready |
| F6 | **Lab API integration: Synevo / Regina Maria / MedLife** | Auto-import blood tests instead of PDF parse → removes the worst onboarding friction | 8 h per lab; need API access (Synevo has one; Regina Maria/MedLife unclear) | Lab API access confirmed |
| F7 | **Pharmacy price aggregation (Sensiblu / Catena / Help Net / eMAG)** | Today supplement recs are abstract; show "₂ RON la Catena, ₃ la Sensiblu" with a deeplink | 10 h (scraper or partner API per pharmacy; legal review for scraping) | Legal OK for scraping or 1 partner signed |
| F8 | **Family / household mode** — one account, multiple profiles (kids, partner) | Romanian families use one tablet; locks them into the product | 8 h (schema: `profiles.household_id`; UI switcher) | Owner sees families as a target segment |
| F9 | **Referral loop** — invite friend, both get 1 month free | Low-CAC growth | 4 h (referral code already in `profiles.referral_code`; just need the UI + Stripe credit) | Stripe live + monetisation decided |
| F10 | **Offline-first PWA** with service worker | Romanian rural internet; tracking should never lose data | 6 h (next-pwa or hand-rolled SW; queue POSTs to /api/daily-metrics) | Owner sees rural users as relevant |
| F11 | **Streak badges (light gamification)** — non-addictive | 7/14/30/90/365-day streaks per habit category, no dark patterns, no notifications spam | 4 h | Owner wants retention nudge |
| F12 | **Habit shaming opt-out** — explicit no-judgement copy when streak breaks; "no streak this week, fresh start tomorrow" | EU-style mental-health-conscious UX, differentiator | 1 h | Always — pairs with F11 |
| F13 | **Doctor invite** — issue a 14-day read-only link for a GP, with their feedback flowing back to the user | Closes the loop with traditional medicine | 6 h (extends 3.9) | After 3.9 ships and validates |
| F14 | **Bring-your-own-key** (BYOK) for Anthropic | Owner cost relief; paid-tier perk; advanced users love it | 3 h (settings field, encrypt with vault, swap into API calls) | Monetisation tier decided |
| F15 | **Glucose CGM integration (Libre / Dexcom)** | Closes the biggest signal gap for metabolic-pattern detection | 12 h (Abbott LibreView API has limited access; Dexcom Share API is open) | Owner targets metabolic-focused users |

**Recommended starter pack** (high value / low effort, ≤25 h): F3, F5, F11, F12, plus F1 if owner can stomach push-permission UX work. Defer F2, F6, F7, F15 until lab-partner conversations exist. F8 only if family is a stated segment.

For each feature picked: open a fresh plan-mode session and write a per-feature plan that follows the same structure. Do not bundle multiple features into one PR.

---

## Phase 5 — Strategy & growth (owner-decided)

Surface these to the owner explicitly. Do not assume answers.

1. **Monetisation timing.** Free during beta is unsustainable past ~100 users. Recommended tier: free = lifestyle-only protocol + 1 AI generation per month; €9.99/mo (or 49 RON/mo for parity) = unlimited regen + Claude Sonnet + chat. Stripe is scaffolded but inactive. Owner: ship Stripe now, or wait one more month of feedback?
2. **Medical positioning.** Today the dashboard reads "diagnostic". Legal can't ship a medical device. Recommendation: rebrand "longevity score" → "scor de optimizare", "diagnostic" → "evaluare lifestyle", add a persistent (small) disclaimer below the score. The Bryan comparison is the right framing — keep it.
3. **Cron frequency.** Today daily. Weekly cuts AI cost ~85% at the cost of "your protocol updated overnight" magic. Recommendation: weekly cron + same-day push when the user logs a blood test or hits a streak milestone.
4. **Auth providers.** Today Google only. Add Apple Sign-In if iOS App Store is on the roadmap. Email-only login already works as a fallback.
5. **CI/CD.** No GitHub Actions today. Recommended workflow: PR → `npm ci && npm run lint && npm test && npm run build` on Node 22. Add Vercel preview deployments per PR. Effort: 1.5 h, one-time.
6. **Observability.** No Sentry today. Vercel Logs are stdout. Recommendation: Sentry free tier (5k events/mo), wire via `@sentry/nextjs`. PII scrubbing config required (no biomarker values in error context). Effort: 2 h.
7. **Backup verification.** Supabase auto-backs-up but the recovery path has never been tested. Recommendation: quarterly drill — restore to a scratch project, confirm latest blood test for owner's account is intact. Effort: 1 h per drill.

---

## Files of interest — quick reference

**App shell & auth**
- [proxy.ts](proxy.ts) — middleware, auth gate, cookie maxAge patch (don't break)
- [app/layout.tsx](app/layout.tsx) — theme + locale boot scripts, fonts
- [app/(auth)/login/page.tsx](app/(auth)/login/page.tsx) — Google OAuth, email/password
- [app/api/auth/callback/route.ts](app/api/auth/callback/route.ts)

**Onboarding & profile**
- [app/(app)/onboarding/page.tsx](app/(app)/onboarding/page.tsx) — Phase 2.3 refactor target
- [app/api/save-profile/route.ts](app/api/save-profile/route.ts)
- [lib/engine/onboarding-schema.ts](lib/engine/onboarding-schema.ts) — TBD, Phase 1.5 / 2.3 supporting

**Dashboard & widgets**
- [app/(app)/dashboard/page.tsx](app/(app)/dashboard/page.tsx)
- [components/dashboard/TodaysAgenda.tsx](components/dashboard/TodaysAgenda.tsx)
- [components/dashboard/WorkoutLogger.tsx](components/dashboard/WorkoutLogger.tsx)
- [components/dashboard/MealLogger.tsx](components/dashboard/MealLogger.tsx)
- [components/dashboard/AskAIPill.tsx](components/dashboard/AskAIPill.tsx)
- [components/dashboard/OrganRadar.tsx](components/dashboard/OrganRadar.tsx)

**Engine**
- [lib/engine/master-prompt.ts](lib/engine/master-prompt.ts) — caching target
- [lib/engine/biomarkers.ts](lib/engine/biomarkers.ts) — 40 markers, ranges
- [lib/engine/patterns.ts](lib/engine/patterns.ts) — 13 clinical patterns
- [lib/engine/fallback-protocol.ts](lib/engine/fallback-protocol.ts) — used when both AIs fail
- [lib/engine/phenoage.ts](lib/engine/phenoage.ts) — Levine 2018 bio-age
- [lib/engine/device-catalog.ts](lib/engine/device-catalog.ts) — wearable capability map

**API**
- [app/api/generate-protocol/route.ts](app/api/generate-protocol/route.ts)
- [app/api/chat/route.ts](app/api/chat/route.ts) + [app/api/chat-action/route.ts](app/api/chat-action/route.ts)
- [app/api/cron/daily-regenerate/route.ts](app/api/cron/daily-regenerate/route.ts)
- [app/api/share/route.ts](app/api/share/route.ts)
- [app/api/meals/analyze/route.ts](app/api/meals/analyze/route.ts)
- [app/api/parse-bloodwork/route.ts](app/api/parse-bloodwork/route.ts)
- [app/api/delete-account/route.ts](app/api/delete-account/route.ts)
- [app/api/my-data/route.ts](app/api/my-data/route.ts) — GDPR export

**Infra**
- [next.config.ts](next.config.ts) — Phase 1.1 headers target
- [vercel.json](vercel.json) — cron schedule
- [supabase/migrations/0001_init.sql](supabase/migrations/0001_init.sql)
- [supabase/migrations/0002_supplement_feedback.sql](supabase/migrations/0002_supplement_feedback.sql)
- [lib/i18n/dictionaries.ts](lib/i18n/dictionaries.ts) — RO/EN strings
- [lib/rate-limit.ts](lib/rate-limit.ts) — Upstash wrapper
- [lib/supabase/admin.ts](lib/supabase/admin.ts) — service-role client

---

## End-to-end verification (run before declaring any phase done)

```bash
# Static checks
npm run lint
npx tsc --noEmit
npm test
npm run build

# Phase 1 headers
curl -I https://<preview>.vercel.app/ | grep -i "strict-transport-security\|x-frame-options\|content-security-policy"

# Phase 1 cookie consent
# Open in incognito → banner appears → reject analytics → DOM has no vercel-analytics script

# Phase 1.6 account deletion
# Test user signs up, logs metrics + protocol + share, deletes account
# Service-role query: SELECT count(*) FROM <each table> WHERE user_id = <test_id> → 0

# Phase 2.1 prompt caching
# Trigger 2 sequential /api/generate-protocol calls
# Inspect Anthropic dashboard → cache_read_input_tokens > 0 on call 2

# Phase 2.2 cron skip
# Mark 3 test users as inactive (no metrics, no compliance for 8 days)
# curl -H "Authorization: Bearer $CRON_SECRET" /api/cron/daily-regenerate
# Response: { processed: N, skipped: ≥3 }

# Phase 3.1 RO formatting
Grep "toLocaleDateString\(\|en-US" --type=tsx --type=ts -- app lib components
# Expect: 0 matches (or all via lib/utils/format.ts)

# Phase 3.2 type sizes
Grep "text-\[9px\]\|text-\[10px\]" --type=tsx -- app components
# Expect: 0 matches in non-chart files

# Manual: Lighthouse mobile on /, /dashboard, /onboarding
# Target: Performance ≥85, Accessibility ≥95, Best-Practices ≥95, SEO ≥90
```

---

## What to do first when you open this

1. Read `AUDIT_AND_PLAN.md` end-to-end.
2. Run **Phase 0** verification table top to bottom. Update `AUDIT_AND_PLAN.md` with resolved/open status per item.
3. Ask the owner the four open questions:
   - Supabase region migration (Phase 1.4) — yes / SCCs only / not now?
   - Monetisation timing (Phase 5.1) — Stripe now / one more month free?
   - Feature pack pick from Phase 4 — which IDs?
   - Apple Sign-In (Phase 5.4) — needed before launch?
4. Pick Phase 1 + Phase 2 in parallel branches; ship Phase 3 polish bundled with each feature PR rather than as a separate sprint (less reviewer fatigue).
5. Every PR: green tests, green build, RO copy via dict, no secrets in diff, RLS check on new tables.

**Definition of done for the whole brief:**
- Phase 0–3 fully shipped to production with the verification commands all green.
- Phase 4: at least F3, F5, F11, F12 shipped.
- Phase 5: monetisation answer locked in code (even if "free tier only" — make it explicit).
- Live Lighthouse mobile ≥85 perf on `/`, `/dashboard`, `/onboarding`.
- Zero critical CSP report-only violations after 1 week → flip to enforce mode.
- 100% of routes pass automated GDPR check: data export returns user data, deletion clears it, sub-processor list matches running integrations.

When done, the app should feel like Linear meets Apple Health, written by a Romanian who actually cares — small, fast, calm, trustworthy. That's the bar.
