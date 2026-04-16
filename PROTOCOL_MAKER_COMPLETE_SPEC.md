# 🧬 PROTOCOL MAKER — COMPLETE REBUILD SPECIFICATION
# Claude Code: Read this ENTIRE document before writing a single line of code.
# This is the ONLY source of truth. Follow it exactly.

---

## TABLE OF CONTENTS
1. Current State Audit (what exists, what's broken, what's missing)
2. Architecture & Stack
3. Database Schema (complete, updated)
4. File Tree (every file, annotated)
5. Design System (colors, typography, spacing, components)
6. Landing Page (complete spec)
7. Auth Flow (complete spec)
8. Onboarding Flow (complete 4-step redesign)
9. PDF Parsing Engine (Groq)
10. Biomarker Reference Database (40 markers, complete)
11. Classification Engine (improved algorithms)
12. Pattern Detection Engine (10 patterns)
13. Master Prompt (Claude Opus 4.6 — the crown jewel)
14. Protocol Generation API (complete)
15. Dashboard (complete redesign with all 15 sections)
16. Tracking System (streaks, heatmap, gamification)
17. Settings & Profile Management
18. Share System (public links, PDF export)
19. Universal Tips Engine
20. Daily Schedule Generator
21. Shopping List with eMAG Integration
22. Temporal Comparison (multi-panel blood work)
23. Mobile PWA Setup
24. SEO & Open Graph
25. Error Handling & Edge Cases
26. Safety & Legal
27. Monetization
28. Implementation Order (exact sequence)

---

## 1. CURRENT STATE AUDIT

### What exists and works:
- ✅ Next.js 15 App Router + TypeScript + Tailwind v4
- ✅ Supabase auth (email/password) + RLS policies
- ✅ 5-step onboarding with manual biomarker input
- ✅ 20 biomarker reference database with intervention libraries
- ✅ Classifier engine (classifyAll, calculateLongevityScore, estimateBiologicalAge)
- ✅ 5 pattern detectors (metabolic syndrome, inflammation, thyroid, nutritional, cardiovascular)
- ✅ Master prompt for Groq (Llama 3.3 70B) protocol generation
- ✅ Protocol generation API (/api/generate-protocol)
- ✅ Dashboard with 10 sections (diagnostic, biomarkers, nutrition, supplements, exercise, sleep, tracking, doctor, roadmap, shopping)
- ✅ Daily compliance tracking with checkbox toggle
- ✅ Settings page (profile view, blood test history, share, export, logout)
- ✅ Share links (slug-based public protocol view)
- ✅ Generating screen with animated steps and fun facts
- ✅ Dark theme with #00ff88 accent
- ✅ Mobile-friendly bottom nav
- ✅ Vercel deployment at protocol-tawny.vercel.app

### What's broken or missing:
- ❌ NO landing page — goes straight to login
- ❌ ALL UI text is in Romanian — needs English for global audience
- ❌ NO PDF upload for blood work — manual entry only
- ❌ Onboarding has 5 steps (step 4 "Genetics" is dead placeholder)
- ❌ Only 20 biomarkers — missing ApoB, Lp(a), cortisol, DHEA-S, estradiol, FT4, anti-TPO, GGT, AST, uric acid, iron, platelets, RBC
- ❌ Master prompt is decent but produces semi-generic protocols
- ❌ Uses only Groq — no Claude Opus 4.6 option for deeper synthesis
- ❌ No Bryan Johnson comparison in output
- ❌ No universal tips section
- ❌ No daily schedule timeline
- ❌ No cost breakdown
- ❌ Dashboard biomarkers shown as flat list — no visual range bars
- ❌ Supplements shown as cards — no timeline/timing view
- ❌ Tracking has no streaks, no heatmap, no gamification
- ❌ No temporal comparison (can't compare blood tests over time)
- ❌ No PDF export for doctor sharing
- ❌ Share page is minimal
- ❌ No Google OAuth
- ❌ No PWA manifest/service worker
- ❌ No rate limiting on generation
- ❌ No Zod validation on AI output
- ❌ Onboarding doesn't save progress between steps (refresh = lost)
- ❌ No Anthropic SDK installed (has it in package.json but doesn't use it)
- ❌ Login page has no branding/pitch
- ❌ Blood test date is auto-set to today (user can't pick test date)
- ❌ No medication interaction checking
- ❌ Compliance upsert has potential RLS conflict
- ❌ share_links view_count always sets to 1 instead of incrementing

### Bugs found:
1. share route: `update({ view_count: 1 })` should be `update({ view_count: link.view_count + 1 })` or use Supabase RPC
2. compliance RLS: has both "compliance_insert" and "compliance_upsert" policies — potential conflict
3. Onboarding: `canNext()` for step 0 allows age >= 10 but safety rules say block under 18
4. Settings: calls `/api/reset-onboarding` which doesn't exist
5. Dashboard: casts `(b as Record<string, unknown>).shortName` — fragile type assertion
6. No error boundary wrapping the dashboard
7. No loading skeleton — just spinner

---

## 2. ARCHITECTURE & STACK

```
FIXED STACK (do not change):
├── Next.js 15 App Router + TypeScript (strict)
├── Tailwind CSS v4 (with @theme inline)
├── Supabase (Auth + PostgreSQL + Storage + RLS)
├── Groq API (Llama 3.3 70B) — fast operations: PDF parsing, quick classification
├── Anthropic API (Claude Opus 4.6) — deep operations: protocol synthesis
├── Recharts — charts and data viz
├── Lucide React — icons
├── Zod — schema validation
├── clsx — conditional classes
├── Vercel — deployment
├── Vercel Analytics — tracking
├── pdf-parse — PDF text extraction (ADD to dependencies)
├── Upstash Redis — rate limiting (ADD)
├── Resend — email notifications (ADD later)

NEW DEPENDENCIES TO INSTALL:
pnpm add pdf-parse @upstash/ratelimit @upstash/redis zod
pnpm add -D @types/pdf-parse
```

### API Architecture:
```
Groq (fast, cheap):           Claude Opus (deep, expensive):
├── PDF text → biomarkers     ├── Full protocol synthesis
├── Quick Q&A in chat         └── Complex protocol comparison
├── Biomarker verification
└── Fallback if Claude fails
```

---

## 3. DATABASE SCHEMA (complete, replace scripts/setup-db.sql)

```sql
-- ============================================
-- PROTOCOL ENGINE v3 — Complete Schema
-- Run in Supabase Dashboard > SQL Editor
-- ============================================

-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- ══════ PROFILES ══════
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  -- Demographics
  age integer,
  sex text check (sex in ('male', 'female')),
  height_cm real,
  weight_kg real,
  latitude real,
  occupation text,
  activity_level text default 'moderate',
  -- Lifestyle
  sleep_hours_avg real,
  sleep_quality integer check (sleep_quality between 1 and 10),
  diet_type text default 'omnivore',
  alcohol_drinks_per_week integer default 0,
  caffeine_mg_per_day integer default 0,
  smoker boolean default false,
  cardio_minutes_per_week integer default 0,
  strength_sessions_per_week integer default 0,
  -- Medical
  conditions text[] default '{}',
  medications jsonb default '[]',
  current_supplements text[] default '{}',
  allergies text[] default '{}',
  -- Goals & constraints
  goals jsonb default '[]',
  time_budget_min integer default 60,
  monthly_budget_ron integer default 500,
  experimental_openness text default 'otc_only',
  -- Onboarding state
  onboarding_completed boolean default false,
  onboarding_step integer default 0,
  onboarding_data jsonb default '{}',  -- NEW: saves partial progress
  -- Timestamps
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ══════ BLOOD TESTS ══════
create table if not exists public.blood_tests (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  taken_at date not null,
  lab_name text,
  biomarkers jsonb not null default '[]',
  parsed_from_pdf boolean default false,
  raw_pdf_path text,  -- NEW: Supabase Storage path
  created_at timestamptz default now()
);

-- ══════ PROTOCOLS ══════
create table if not exists public.protocols (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  version integer default 1,
  based_on_blood_test_id uuid references public.blood_tests,
  -- Generated content
  protocol_json jsonb not null,
  classified_biomarkers jsonb,
  detected_patterns jsonb,
  longevity_score integer,
  biological_age integer,
  -- Metadata
  model_used text default 'llama-3.3-70b-versatile',
  prompt_hash text,  -- NEW: for reproducibility
  generation_time_ms integer,  -- NEW
  is_active boolean default true,
  created_at timestamptz default now()
);

-- ══════ COMPLIANCE TRACKING ══════
create table if not exists public.compliance_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  protocol_id uuid not null,
  item_type text not null,
  item_name text not null,
  date date not null,
  completed boolean default false,
  notes text,
  created_at timestamptz default now(),
  unique(user_id, item_type, item_name, date)
);

-- ══════ SHARE LINKS ══════
create table if not exists public.share_links (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  protocol_id uuid references public.protocols not null,
  slug text unique not null,
  view_count integer default 0,
  is_public boolean default true,
  expires_at timestamptz,
  created_at timestamptz default now()
);

-- ══════ RETEST REMINDERS ══════
create table if not exists public.retest_reminders (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  biomarker_codes text[] not null,
  due_date date not null,
  sent boolean default false,
  sent_at timestamptz,
  created_at timestamptz default now()
);

-- ══════ RLS POLICIES ══════
alter table public.profiles enable row level security;
alter table public.blood_tests enable row level security;
alter table public.protocols enable row level security;
alter table public.compliance_logs enable row level security;
alter table public.share_links enable row level security;
alter table public.retest_reminders enable row level security;

-- Profiles
create policy "profiles_own" on public.profiles for all using (auth.uid() = id);

-- Blood tests
create policy "blood_tests_own" on public.blood_tests for all using (auth.uid() = user_id);

-- Protocols
create policy "protocols_own" on public.protocols for all using (auth.uid() = user_id);

-- Compliance
create policy "compliance_own" on public.compliance_logs for all using (auth.uid() = user_id);

-- Share links — owner can manage, anyone can read public links
create policy "share_own" on public.share_links for all using (auth.uid() = user_id);
create policy "share_public_read" on public.share_links for select using (is_public = true);

-- Retest reminders
create policy "retest_own" on public.retest_reminders for all using (auth.uid() = user_id);

-- ══════ FUNCTIONS ══════

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Increment view count (avoids race condition)
create or replace function public.increment_view_count(link_slug text)
returns void as $$
begin
  update public.share_links
  set view_count = view_count + 1
  where slug = link_slug;
end;
$$ language plpgsql security definer;

-- Backfill existing users
insert into public.profiles (id)
select id from auth.users
where id not in (select id from public.profiles)
on conflict do nothing;

-- ══════ STORAGE ══════
-- Create bucket for blood panel PDFs (do this in Supabase Dashboard > Storage)
-- Bucket name: blood-panels
-- Public: false
-- File size limit: 20MB
-- Allowed MIME types: application/pdf
```

---

## 4. FILE TREE (every file, annotated)

```
protocol-maker/
├── app/
│   ├── (marketing)/                    # PUBLIC — no auth required
│   │   ├── layout.tsx                  # Clean layout, no nav bar
│   │   └── page.tsx                    # Landing page — THE first impression
│   │
│   ├── (auth)/                         # Auth pages
│   │   ├── login/page.tsx              # Login + signup combined
│   │   └── callback/route.ts           # OAuth callback handler
│   │
│   ├── (app)/                          # AUTHENTICATED — requires login
│   │   ├── layout.tsx                  # App shell with NavBar
│   │   ├── dashboard/page.tsx          # THE showpiece — protocol display
│   │   ├── onboarding/page.tsx         # 4-step intake form
│   │   ├── tracking/page.tsx           # Daily compliance + streaks
│   │   ├── history/page.tsx            # NEW — blood test history + comparison
│   │   └── settings/page.tsx           # Profile, data, account management
│   │
│   ├── share/[slug]/page.tsx           # Public read-only protocol view
│   │
│   ├── api/
│   │   ├── auth/callback/route.ts      # Supabase auth callback
│   │   ├── generate-protocol/route.ts  # Protocol synthesis (Groq + Claude)
│   │   ├── parse-bloodwork/route.ts    # NEW — PDF → structured biomarkers
│   │   ├── save-profile/route.ts       # Save/update profile
│   │   ├── save-bloodtest/route.ts     # Save blood test results
│   │   ├── my-data/route.ts            # Fetch user's complete data
│   │   ├── compliance/route.ts         # Track daily compliance
│   │   ├── share/route.ts              # Generate/fetch share links
│   │   ├── compare/route.ts            # NEW — compare two blood panels
│   │   └── logout/route.ts             # Sign out
│   │
│   ├── globals.css                     # Theme variables + base styles
│   ├── layout.tsx                      # Root layout (fonts, meta, analytics)
│   └── favicon.ico
│
├── components/
│   ├── landing/                        # NEW — landing page sections
│   │   ├── Hero.tsx                    # Main pitch + CTA
│   │   ├── HowItWorks.tsx             # 3-step explanation
│   │   ├── BiomarkerDemo.tsx          # Interactive demo with Bryan's data
│   │   ├── ComparisonSection.tsx      # Your protocol vs Bryan's
│   │   ├── Testimonials.tsx           # Social proof
│   │   └── Footer.tsx
│   │
│   ├── onboarding/                     # Onboarding step components
│   │   ├── StepBasics.tsx             # Age, sex, height, weight, activity
│   │   ├── StepBloodWork.tsx          # PDF upload + manual entry
│   │   ├── StepLifestyle.tsx          # Sleep, diet, exercise, medical
│   │   ├── StepGoals.tsx             # Goals, budget, time, openness
│   │   └── PDFUploader.tsx            # Drag-drop PDF component
│   │
│   ├── protocol/                       # Dashboard section components
│   │   ├── GeneratingScreen.tsx       # Loading animation during generation
│   │   ├── DiagnosticHero.tsx         # Bio age, score, velocity — big numbers
│   │   ├── BiomarkerChart.tsx         # Visual range bars for each marker
│   │   ├── BiomarkerRow.tsx           # Single biomarker with range visualization
│   │   ├── OrganRadar.tsx             # Organ system radar chart
│   │   ├── BryanComparison.tsx        # NEW — your values vs Bryan's
│   │   ├── NutritionPlan.tsx          # Calories, macros, meals
│   │   ├── SupplementTimeline.tsx     # NEW — morning/food/evening/bed timeline
│   │   ├── ExerciseCalendar.tsx       # NEW — 7-day calendar grid
│   │   ├── SleepProtocol.tsx          # Bedtime, wind-down, environment
│   │   ├── DailySchedule.tsx          # NEW — full day vertical timeline
│   │   ├── UniversalTips.tsx          # NEW — evidence-based tips for everyone
│   │   ├── TrackingPlan.tsx           # What to monitor + retest schedule
│   │   ├── DoctorSection.tsx          # Rx suggestions, referrals, red flags
│   │   ├── RoadmapTimeline.tsx        # 12-week visual timeline
│   │   ├── ShoppingList.tsx           # Categorized with eMAG links
│   │   ├── CostBreakdown.tsx          # NEW — monthly cost summary
│   │   └── ProtocolPDF.tsx            # NEW — PDF export component
│   │
│   ├── tracking/                       # Tracking page components
│   │   ├── StreakCounter.tsx           # NEW — consecutive days
│   │   ├── ComplianceRing.tsx         # Progress ring (keep existing)
│   │   ├── WeeklyChart.tsx            # NEW — 7-day bar chart
│   │   ├── MonthlyHeatmap.tsx         # NEW — GitHub-style heatmap
│   │   ├── Achievements.tsx           # NEW — badges and milestones
│   │   └── TrackingChecklist.tsx      # Grouped checkbox list
│   │
│   ├── history/                        # NEW — blood test comparison
│   │   ├── PanelTimeline.tsx          # List of blood tests with dates
│   │   ├── MarkerTrend.tsx            # Single marker trend over time
│   │   └── ComparisonView.tsx         # Side-by-side two panels
│   │
│   ├── layout/
│   │   ├── NavBar.tsx                 # Bottom nav (existing, update icons)
│   │   └── Header.tsx                 # NEW — top bar for desktop
│   │
│   └── ui/                            # Reusable primitives
│       ├── Card.tsx                   # Standard card wrapper
│       ├── Badge.tsx                  # Classification badge
│       ├── ProgressBar.tsx            # Animated progress bar
│       ├── Tooltip.tsx                # Info tooltip on hover
│       ├── Skeleton.tsx               # Loading skeleton
│       ├── RangeBar.tsx              # NEW — biomarker range visualization
│       └── AnimatedNumber.tsx         # NEW — count-up animation
│
├── lib/
│   ├── engine/
│   │   ├── biomarkers.ts             # 40 biomarker reference DB
│   │   ├── classifier.ts             # Classify values, calculate scores
│   │   ├── patterns.ts               # Detect health patterns
│   │   ├── master-prompt.ts          # THE prompt for Claude Opus 4.6
│   │   ├── groq-prompts.ts           # NEW — Groq-specific prompts (PDF parsing)
│   │   ├── phenoage.ts               # NEW — PhenoAge biological age algorithm
│   │   ├── interactions.ts           # NEW — drug-supplement interaction DB
│   │   └── universal-tips.ts         # NEW — evidence-based universal advice
│   │
│   ├── supabase/
│   │   ├── client.ts                 # Browser Supabase client
│   │   └── server.ts                 # Server Supabase client
│   │
│   ├── hooks/
│   │   ├── useProtocol.ts            # NEW — fetch/cache current protocol
│   │   ├── useCompliance.ts          # NEW — compliance state management
│   │   ├── useProfile.ts             # NEW — profile data hook
│   │   └── useBloodTests.ts          # NEW — blood test history hook
│   │
│   ├── utils/
│   │   ├── format.ts                 # NEW — number/date formatting helpers
│   │   ├── export-pdf.ts             # NEW — generate PDF from protocol
│   │   └── emag-links.ts             # NEW — generate eMAG search URLs
│   │
│   └── types.ts                       # All TypeScript types
│
├── scripts/
│   ├── setup-db.sql                   # Complete DB schema (from section 3)
│   └── seed-biomarkers.ts            # Seed reference data
│
├── public/
│   ├── manifest.json                  # PWA manifest
│   ├── icons/                         # PWA icons (192x192, 512x512)
│   ├── og-image.png                   # Open Graph image
│   └── favicon.ico
│
├── CLAUDE.md                          # Points to AGENTS.md
├── AGENTS.md                          # Agent instructions
├── IMPROVEMENT_PLAN.md                # This file
├── package.json
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
├── eslint.config.mjs
└── .env.local.example
```

---

## 5. DESIGN SYSTEM

```css
/* globals.css — complete theme */
:root {
  /* Base */
  --background: #000000;
  --foreground: #fafafa;
  --card: #0a0a0a;
  --card-hover: #111111;
  --card-border: #1a1a1a;
  --card-border-hover: #2a2a2a;
  
  /* Accent */
  --accent: #00ff88;
  --accent-dim: #00cc6a;
  --accent-glow: rgba(0, 255, 136, 0.15);
  --accent-subtle: rgba(0, 255, 136, 0.05);
  
  /* Text */
  --muted: #71717a;
  --muted-foreground: #a1a1aa;
  
  /* Semantic */
  --danger: #ef4444;
  --danger-bg: rgba(239, 68, 68, 0.1);
  --warning: #f59e0b;
  --warning-bg: rgba(245, 158, 11, 0.1);
  --info: #3b82f6;
  --info-bg: rgba(59, 130, 246, 0.1);
  
  /* Classification */
  --optimal: #00ff88;
  --optimal-bg: rgba(0, 255, 136, 0.1);
  --suboptimal: #f59e0b;
  --suboptimal-bg: rgba(245, 158, 11, 0.1);
  --deficient: #f97316;
  --deficient-bg: rgba(249, 115, 22, 0.1);
  --critical: #ef4444;
  --critical-bg: rgba(239, 68, 68, 0.1);
}

/* Typography rules:
   - Display/hero: text-4xl md:text-6xl font-bold tracking-tight
   - Section titles: text-xl font-semibold
   - Body: text-sm
   - Labels: text-xs text-muted-foreground
   - Data/numbers: font-mono
   - Never use text-lg for body text
*/

/* Component patterns:
   - Cards: rounded-2xl bg-card border border-card-border p-5
   - Buttons primary: rounded-xl bg-accent text-black font-semibold py-3
   - Buttons secondary: rounded-xl bg-card border border-card-border
   - Inputs: rounded-xl bg-background border border-card-border px-4 py-2.5
   - Badges: text-[10px] font-mono px-2 py-0.5 rounded-full
   - All interactive: transition-all duration-200
   - Hover: hover:border-card-border-hover or hover:bg-card-hover
   - Active: active:scale-[0.98]
   - Focus: focus:border-accent outline-none
*/
```

### Font choices:
- Display headings: Use a distinctive font — NOT Inter. Options:
  - "Space Mono" for the techy/data feel
  - "Outfit" for modern geometric
  - "Syne" for bold personality
  - Or keep Inter for body but use Geist Mono for ALL headings (the "data terminal" look)
- Body: Inter or Geist Sans (current — fine)
- Numbers/data: JetBrains Mono or Geist Mono (current — keep)

### Animation principles:
- Page transitions: fade in + slide up, staggered per section (50ms delay each)
- Numbers: count-up animation on first render (bio age, longevity score)
- Progress rings: animated stroke-dashoffset on mount
- Cards: subtle hover lift (translate-y -1px + border color change)
- Loading: skeleton shimmer (linear-gradient animation), not spinners
- Charts: animated on scroll into view

---

## 6. LANDING PAGE

File: `app/(marketing)/page.tsx`

```
LAYOUT:
├── [HERO] Full viewport height
│   ├── Small "Protocol" logo top-left
│   ├── Giant headline (2 lines max):
│   │   "Your blood work. AI analysis."
│   │   "A protocol built for YOU."
│   ├── Subtitle: "Upload your labs. Get a personalized longevity 
│   │   protocol calibrated to your biomarkers — not Bryan Johnson's."
│   ├── Two CTAs: [Get Started Free] (accent) + [See Demo] (outline)
│   ├── Stats bar: "20+ biomarkers analyzed • 10 health patterns 
│   │   detected • Protocol in <60 seconds"
│   └── Subtle scroll indicator arrow at bottom
│
├── [HOW IT WORKS] 3-step visual
│   ├── Step 1: Upload or enter your blood work (icon: test tube)
│   ├── Step 2: AI classifies against longevity-optimal ranges (icon: chart)
│   ├── Step 3: Get your personalized protocol (icon: clipboard)
│   └── Each step: icon + title + one-line description
│
├── [BIOMARKER DEMO] Interactive section — the conversion hook
│   ├── Title: "See how it works — Bryan Johnson's actual biomarkers"
│   ├── Show 6 biomarkers (HbA1c, LDL, hsCRP, Vitamin D, Testosterone, HDL)
│   │   each as a RangeBar component:
│   │   [CRITICAL|DEFICIENT|SUBOPTIMAL|===OPTIMAL===|SUBOPTIMAL|EXCESS|CRITICAL]
│   │   with Bryan's dot on each bar
│   ├── Visitors can interact WITHOUT signing up
│   └── CTA below: "Now imagine YOUR biomarkers here"
│
├── [COMPARISON] Your protocol vs Bryan's
│   ├── Two-column comparison table:
│   │   Bryan: 100+ supplements → You: Only what YOUR biomarkers need
│   │   Bryan: $2M/year → You: Fits YOUR budget
│   │   Bryan: 30 doctors → You: AI-powered in 60 seconds
│   │   Bryan: Vegan only → You: Adapted to YOUR diet
│   └── Point: same quality reasoning, personalized to YOU
│
├── [SOCIAL PROOF] (if available, otherwise skip for now)
│   ├── "Used by X people in Y countries"
│   └── Logos of labs supported: Synevo, Regina Maria, MedLife
│
├── [PRICING] (simple for MVP)
│   ├── Free: 1 protocol
│   ├── Pro (49 RON/mo): unlimited + tracking + PDF export
│   └── Premium (149 RON/mo): + comparison + priority AI
│
├── [CTA] Final call to action
│   ├── "Stop guessing. Start measuring."
│   ├── [Get Your Protocol — Free] button
│   └── "Takes 2 minutes. No credit card required."
│
└── [FOOTER]
    ├── Disclaimer: "Not medical advice. Consult your doctor."
    ├── Links: About, Privacy, Terms, GitHub
    └── "Built with AI. Powered by science."
```

Design direction: **Brutalist data terminal** — black bg, monospace accents, 
grid lines, data-heavy but clean. Think Bloomberg terminal meets Linear.app.
NOT a wellness site. NOT pastel gradients. NOT stock photos of happy people jogging.

---

## 7-12. [CORE ENGINE FILES]

These are in the two files I already delivered (master-prompt-v2.ts and biomarkers-v2.ts).
Claude Code should use those as drop-in replacements for the existing files.

Key additions the master prompt v2 includes:
- Bryan's full top 30 supplement stack with exact doses
- 30+ biomarker-to-intervention decision rules
- 4-tier budget system with specific RON amounts
- Universal tips (movement, sleep, nutrition, mindset, environment, oral health)
- Bryan comparison output
- Daily schedule generation
- Cost breakdown
- Romanian shopping sources
- Exercise protocol templates by activity level
- Sleep protocol with calculated bedtime

---

## 13-14. PROTOCOL GENERATION API

File: `app/api/generate-protocol/route.ts`

```typescript
// KEY CHANGES:
// 1. Add Claude Opus 4.6 as PRIMARY model for protocol synthesis
// 2. Keep Groq as FALLBACK and for PDF parsing
// 3. Add Zod validation on output
// 4. Add rate limiting (1 generation per 5 minutes for free tier)
// 5. Add generation timing measurement
// 6. Add prompt hashing for reproducibility

// Flow:
// 1. Receive profile + biomarkers from frontend
// 2. Classify all biomarkers (local, instant)
// 3. Detect patterns (local, instant)
// 4. Calculate longevity score + biological age (local, instant)
// 5. Build master prompt with all context
// 6. Try Claude Opus 4.6 first (max_tokens: 16000)
// 7. If Claude fails/timeout → fallback to Groq Llama 3.3
// 8. Validate output JSON with Zod schema
// 9. If validation fails → retry with error context
// 10. Save to database
// 11. Return to frontend

// Claude API call:
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',  // Use Sonnet 4 for cost efficiency
  max_tokens: 16000,
  messages: [
    { role: 'user', content: masterPrompt }
  ],
  // System message is embedded in the masterPrompt itself
});

// Groq fallback:
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const fallback = await groq.chat.completions.create({
  model: 'llama-3.3-70b-versatile',
  messages: [
    { role: 'system', content: 'You are a longevity expert. Respond ONLY with valid JSON.' },
    { role: 'user', content: masterPrompt }
  ],
  temperature: 0.7,
  max_tokens: 8000,
});
```

---

## 15. DASHBOARD (complete redesign)

File: `app/(app)/dashboard/page.tsx`

The dashboard is THE product. It must feel like receiving a report from 
a $5,000 longevity clinic. Sections in order:

```
1. DIAGNOSTIC HERO
   - Biological age (BIG animated number, count-up from 0)
   - Aging velocity badge
   - Longevity score (circular progress ring, animated)
   - 3 top wins (green checkmarks)
   - 3 top risks (red warnings)

2. BRYAN COMPARISON (NEW)
   - Table: marker | your value | Bryan's value | gap | verdict
   - Color-coded verdicts
   - "You're ahead on 3 markers, need work on 5"

3. ORGAN SYSTEM RADAR
   - Interactive radar chart (cardiovascular, metabolic, hormonal, etc.)
   - Each axis clickable → shows details

4. BIOMARKER READOUT
   - Each marker as a visual RANGE BAR:
     [===OPTIMAL===] with dots for:
     🟢 Your value | 🟡 Bryan's value | ⬜ Population average
   - Classification badge
   - Expandable details on click
   - Grouped by category with collapsible headers

5. DAILY SCHEDULE (NEW)
   - Vertical timeline: 05:00 → 22:30
   - Each item: time, activity, category icon, duration
   - "Your optimized day" header

6. NUTRITION PLAN
   - Calorie target + macro pie chart
   - Eating window recommendation
   - 3 meal cards with ingredients
   - Foods to add (with biomarker justification)
   - Foods to reduce

7. SUPPLEMENT STACK
   - Timeline view: MORNING | WITH FOOD | EVENING | BEDTIME
   - Each supplement: name, dose, form, priority badge
   - Justification expandable
   - eMAG link on each
   - Total monthly cost prominently displayed

8. EXERCISE PROTOCOL
   - 7-day calendar grid
   - Each day: activity type icon, duration, intensity
   - Zone 2 target vs current
   - Strength sessions target
   - Progressive overload notes

9. SLEEP PROTOCOL
   - Target bedtime + wake time
   - Wind-down timeline (with times)
   - Environment checklist
   - Morning light protocol

10. UNIVERSAL TIPS (NEW)
    - Grouped by category: Movement, Sleep, Nutrition, Mindset, Environment
    - Each tip: actionable advice + why + difficulty badge
    - "These apply to EVERYONE regardless of biomarkers"

11. TRACKING PLAN
    - Daily metrics to track
    - Weekly check-ins
    - Retest schedule with specific dates
    - Recommended devices (budget-gated)

12. DOCTOR DISCUSSION
    - Warning banner: "Bring this to your doctor"
    - Red flags (urgent items)
    - Rx suggestions to discuss
    - Specialist referrals
    - Tests to order

13. 12-WEEK ROADMAP
    - Visual timeline (not bullet points)
    - Current week highlighted
    - Each week expandable with specific actions

14. SHOPPING LIST
    - Categories: Supplements | Supermarket | Equipment | Testing
    - Priority: Buy Now | Add Week 4 | Nice to Have
    - Each item: name, cost, where (eMAG/Farmacia Tei/Kaufland)
    - Direct eMAG search link
    - Total costs

15. COST BREAKDOWN (NEW)
    - Monthly supplements: X RON
    - Monthly food estimate: X RON
    - One-time equipment: X RON
    - Quarterly testing: X RON
    - Total ongoing: X RON/month
```

---

## 16. TRACKING SYSTEM

File: `app/(app)/tracking/page.tsx`

```
LAYOUT:
├── Date header (today's date, day of week)
├── STREAK COUNTER
│   ├── "🔥 7 day streak!"
│   ├── Flame icon scales with streak length
│   └── "Longest streak: 14 days"
│
├── DAILY PROGRESS RING (keep existing, improve)
│   ├── Percentage in center (animated)
│   ├── Completed/Total below
│   └── Ring color: red→yellow→green based on %
│
├── WEEKLY CHART (NEW)
│   ├── 7-day bar chart (Mon-Sun)
│   ├── Each bar: compliance % for that day
│   ├── Today highlighted
│   └── Average line across
│
├── CHECKLIST (grouped by category)
│   ├── 💊 Supplements (with time-awareness: only show morning ones in AM)
│   ├── 🏋️ Exercise (today's plan from protocol)
│   ├── 🌙 Sleep (wind-down routine items)
│   ├── 🥗 Nutrition (meal compliance)
│   └── Each item: tap to toggle, line-through when done
│
├── MONTHLY HEATMAP (NEW)
│   ├── GitHub contribution-style grid
│   ├── 30 days, color = compliance %
│   ├── Green (100%) → Yellow (50-99%) → Red (<50%) → Grey (no data)
│   └── Tap a day to see that day's log
│
└── ACHIEVEMENTS (NEW)
    ├── Badge grid
    ├── Earned: "Perfect Week", "7 Day Streak", "All Supplements 30 Days"
    ├── Locked: "30 Day Streak", "100% Month", "Lab Rat (3+ blood tests)"
    └── Progress indicator toward next achievement
```

---

## 17-27. [REMAINING SECTIONS — CONDENSED]

### Settings Page:
- Profile display with edit capability
- Blood test history (list all, with biomarker count and date)
- Protocol history (list all generated protocols)
- Share management (create/delete share links)
- Export all data as JSON
- Delete account (with confirmation)
- Regenerate protocol button
- Logout

### Share Page (/share/[slug]):
- Public read-only protocol view
- No auth required
- Show diagnostic hero + biomarker readout + supplement stack + roadmap
- "Get your own protocol" CTA at bottom
- Beautiful OG meta tags for social sharing

### History Page (NEW):
- List all blood tests with dates
- Select two → side-by-side comparison
- Trend arrows per marker (improved ↑, stable →, worsened ↓)
- "What changed" summary
- Option to regenerate protocol from any historical panel

### PWA:
- manifest.json with name, icons, theme_color #000000, display standalone
- Service worker for offline protocol access
- "Add to Home Screen" prompt after 2nd visit

### Safety:
- Disclaimer on every page footer: "Not medical advice. Consult your doctor."
- Critical biomarker detection → red banner + automatic doctor referral in output
- Age gate: under 16 blocked, 16-18 restricted (lifestyle only)
- Drug-supplement interaction checking against their medication list
- Never recommend Rx directly — always "discuss with your doctor because..."

### Rate Limiting:
- Free tier: 1 protocol generation ever (stored in profile)
- Pro: 5/month
- No limit on viewing/tracking
- Use Upstash Redis for rate limiting

---

## 28. IMPLEMENTATION ORDER (EXACT SEQUENCE)

```
PHASE 1 — Foundation (do these first, in order):

1.  Install new deps: pnpm add pdf-parse @upstash/ratelimit @upstash/redis
2.  Replace lib/engine/biomarkers.ts with expanded 40-marker version
3.  Replace lib/engine/master-prompt.ts with v2 (Claude Opus prompt)
4.  Update lib/types.ts with new ProtocolOutput fields
5.  Update lib/engine/patterns.ts with 5 new pattern detectors
6.  Update lib/engine/classifier.ts with improved scoring
7.  Switch ALL UI text from Romanian to English (every file)
8.  Build landing page: app/(marketing)/page.tsx + components/landing/*
9.  Update login page with better branding
10. Overhaul onboarding: 4 steps, PDF upload, BIG_11 first, save progress
11. Create app/api/parse-bloodwork/route.ts (Groq PDF parser)
12. Update app/api/generate-protocol/route.ts (add Claude Opus + Zod + rate limit)
13. Fix bugs: share view_count, compliance RLS, missing reset-onboarding API

PHASE 2 — Dashboard Perfection:

14. Build all new dashboard section components
15. Redesign dashboard page with all 15 sections
16. Add animated numbers, range bars, radar chart improvements
17. Upgrade GeneratingScreen with better animation

PHASE 3 — Tracking & Engagement:

18. Add streak counter + weekly chart + monthly heatmap
19. Add achievements/badges system
20. Build history page with temporal comparison
21. Build settings page improvements

PHASE 4 — Polish & Growth:

22. Add PWA manifest + service worker
23. Add OG meta tags + social sharing preview
24. Add PDF export for doctor sharing
25. Add proper error boundaries on all pages
26. Add loading skeletons (not spinners)
27. Performance optimization (code splitting, lazy loading charts)

VERIFY after each step: `pnpm build` must succeed.
VERIFY after phases: test full flow end-to-end (signup → onboard → generate → view → track).
```

---

## FINAL NOTE

The master prompt (section 13) is 80% of the product quality.
The landing page (section 6) is 80% of the conversion rate.
The biomarker visualization (section 15, item 4) is 80% of the "wow factor."

Get those three right and the rest follows.

The two files I already delivered (master-prompt-v2.ts and biomarkers-v2.ts) 
contain the complete engine code. This document is the architecture and UI spec.

Together, they are EVERYTHING Claude Code needs to transform this from MVP to 
"Bryan Johnson screenshots this and posts it on X."

Good luck. Build something extraordinary.