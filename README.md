# Protocol Maker

AI longevity engine. Blood work in → personalized protocol out. Tracking + retest loop closes the feedback cycle.

**Live**: https://protocol-tawny.vercel.app

## Positioning

- **Target user**: Romanian health-conscious adults 28–45 with disposable income. People who already test their blood once a year and follow Peter Attia / Bryan Johnson / Rhonda Patrick. Not medical patients — *lifestyle optimizers*.
- **Primary market**: Romania (RON pricing, eMAG sourcing, Synevo / Regina Maria / MedLife PDF parsing). US / EU expansion is G4/G5 in the plan, not day-one.
- **Framing**: "longevity protocol coach" (like Whoop or Noom's domain), NOT "health dashboard" (like MyChart). Every AI output is lifestyle optimization, not diagnosis. Legal copy on `/privacy` + `/terms` is explicit.
- **Language**: English UI across the app, Romanian-facing marketing copy on landing once the founder locks H2. Labels in a future i18n dict so RO translation is 1 PR away.
- **Business model (not yet shipped)**: free tier = lifestyle-only protocol + 1 AI generation / month. Paid €9.99/mo = unlimited regen + Claude Sonnet + daily chat. Covers Anthropic at ~100:1 conversion ratio. See `AUDIT_AND_PLAN.md` § G1.
- **Moat**: three things competitors don't combine — (a) deterministic engine + AI coach (reproducible, not chatbot-random), (b) device-aware tracking (130+ wearable models → capability-filtered SmartLog), (c) overnight auto-regen so the protocol drifts with your data, not your memory.

## What it does

1. **Onboarding** (5 steps, ~5 min) — collects 150+ optional fields stored in `profiles.onboarding_data` JSONB. Required: age, height, weight.
2. **Protocol generation** — Claude Sonnet 4.5 (primary) → Groq Llama 3.3 (fallback) → deterministic engine (always works). Includes biomarker classification (38 markers), pattern detection, PhenoAge bio age, DunedinPACE-style velocity, lifestyle-aware longevity score, organ-system breakdown, Bryan Johnson comparison, full nutrition (3 options × 4 meal types + daily maximums), supplement stack with how-to + universal rules, daily schedule with school/work blocks, exercise plan personalized to gym access, sleep with full bedroom checklist + hygiene rules, pain points + flex strategies, doctor discussion in 4 categories, 12-week roadmap, shopping list with eMAG links.
3. **Daily tracking** — Smart Log time-aware bottom sheet (morning/midday/evening/night), 25+ metrics including all wearable-grade fields (sleep stages, HRV during sleep, blood O₂, BP morning/evening, antioxidant + AGEs indices). 14 daily habits across categories.
4. **Statistics** — every metric trended; "your X improved by Y% from when you started the protocol".
5. **Retest loop** — Settings → Upload new blood test → auto-regen v2 with diff vs v1 on history page.
6. **Auto-regen cron** — every 3 AM Romania time, rolls 7-day daily metrics averages back into the profile and regenerates the protocol so it stays current.
7. **Chat** — Claude-streaming, full-context coach (loads profile + protocol + biomarkers + last 14d metrics + last 7d compliance).

## Stack

- **Next.js 16.2.4** (App Router, Turbopack)
- **React 19**, TypeScript strict
- **Tailwind v4** (CSS-based config via `@theme inline`, `@plugin "@tailwindcss/typography"`)
- **Supabase** (Auth + Postgres + RLS + JSONB heavy)
- **Anthropic Claude Sonnet 4.5** + **Groq Llama 3.3** + deterministic fallback
- **Recharts** for charts, **react-markdown** for chat rendering, **SWR** for client data fetching
- **Upstash Redis** for rate limiting (3 protocols/day, 30 chat/hour) — bypassable via `RATE_LIMIT_DISABLED`

## Repo conventions

- **Single source of truth** — counts (biomarkers, patterns, habits) come from engine exports, never hardcoded in copy
- **JSONB-first** — new fields land in `profiles.onboarding_data` or `protocol_json.diagnostic`, no SQL migration needed
- **Soft delete** — `deleted_at IS NULL` filter on profiles/protocols/blood_tests; CASCADE handles full account delete
- **SWR everywhere** — `useMyData()`, `useStatistics()`, `useProtocolHistory()` etc. in `lib/hooks/useApiData.ts`
- **Section + metric-tile + glass-card + pill-* + 9×9 accent-bg icons** — design system primitives, used uniformly across dashboard / settings / history / stats / chat / tracking

## Scripts

| Command | What |
|---|---|
| `npm run dev` | Local dev with Turbopack |
| `npm run build` | Production build |
| Supabase SQL Editor → `supabase/migrations/0001_init.sql` | Full schema — idempotent, covers fresh installs + upgrades |
| Vercel Cron → `/api/cron/daily-regenerate` | 3 AM auto-regen |

## Env vars

See `.env.local.example`. Required: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. AI: at least one of `ANTHROPIC_API_KEY` or `GROQ_API_KEY`.
