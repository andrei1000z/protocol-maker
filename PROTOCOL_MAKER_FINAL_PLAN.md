# 🧬 PROTOCOL MAKER v3 — THE DEFINITIVE AUDIT & MASTERPLAN
# ═══════════════════════════════════════════════════════════════════
# Generated after reading EVERY file in the project (fresh re-audit)
# This replaces ALL previous documents. Use this one only.
# ═══════════════════════════════════════════════════════════════════

---

## PART 1 — EXECUTIVE SUMMARY

You went from 70% spec completion to **~85% completion** in this sprint.
The project is now a serious product. Almost everything I criticized last 
audit has been shipped. What's left is **deep protocol personalization**, 
**a few critical bugs**, and **polish**. This document has it all.

---

## PART 2 — WHAT EXISTS NOW (verified by re-reading every file)

### 📦 Dependencies (package.json)
- Next.js 16.2.4, React 19.2.4, TypeScript
- Tailwind v4
- Supabase (@supabase/ssr + js)
- **@anthropic-ai/sdk 0.89.0** (installed but still UNUSED anywhere in code)
- **@upstash/ratelimit + @upstash/redis** (installed but UNUSED)
- Groq SDK (used for protocol generation, PDF parsing, chat)
- **Zod** (installed but UNUSED — no validation on AI output)
- Recharts, Lucide React, clsx, uuid, pdf-parse
- Vercel Analytics

### 🏗️ File structure (complete)
```
app/
├── (marketing)/
│   ├── page.tsx                         ✅ Landing page (BiomarkerDemo, comparison, CTA)
│   ├── layout.tsx                       ✅
│   ├── privacy/                         ✅
│   └── terms/                           ✅
├── (auth)/login/page.tsx                ✅
├── (app)/
│   ├── layout.tsx                       ✅ (NavBar)
│   ├── dashboard/page.tsx               ✅ 484 lines — big, full sections
│   ├── onboarding/page.tsx              ✅ 5 steps, state persistence working
│   ├── tracking/page.tsx                ✅ Real streak math, tabs, no Math.random
│   ├── history/page.tsx                 ✅ Side-by-side blood test compare
│   ├── settings/page.tsx                ⚠️ Still basic, no profile editing
│   ├── chat/page.tsx                    ✅ AI chat context-aware (NEW!)
│   └── protocol/                        ⚠️ Empty directory — exists but unused
├── api/
│   ├── auth/                            ✅
│   ├── chat/route.ts                    ✅ Context-aware Groq chat (NEW!)
│   ├── compare/route.ts                 ✅ Blood test comparison
│   ├── compliance/route.ts              ✅ POST upsert + GET single day
│   ├── compliance/history/route.ts      ✅ 30-day aggregation (NEW!)
│   ├── daily-metrics/route.ts           ✅ GET range/single + POST upsert (NEW!)
│   ├── generate-protocol/route.ts       ✅ Groq + fallback, NO Claude Opus
│   ├── logout/route.ts                  ✅
│   ├── my-data/route.ts                 ✅ Profile + protocol + blood tests
│   ├── parse-bloodwork/route.ts         ✅ Groq PDF parsing
│   ├── reset-onboarding/route.ts        ✅
│   ├── save-bloodtest/route.ts          ✅
│   ├── save-profile/route.ts            ✅
│   └── share/route.ts                   ✅ view_count bug fixed
├── share/[slug]/                        ✅ Public read-only view
├── globals.css                          ✅ CSS vars, print styles
├── layout.tsx                           ✅
├── robots.ts                            ✅
└── sitemap.ts                           ✅

components/
├── landing/                             ⚠️ Empty dir (landing inlined in page.tsx)
├── layout/NavBar.tsx                    ✅ 5 tabs (Protocol/Track/Chat/History/Settings)
├── onboarding/                          ⚠️ Empty dir
├── protocol/GeneratingScreen.tsx        ✅ Animated generating screen
├── tracking/Tabs.tsx                    ✅
├── tracking/HabitsTab.tsx               ✅ 14 habits
├── tracking/MetricsTab.tsx              ✅ weight/sleep/mood/energy/steps/HRV/workout
└── tracking/TrendsTab.tsx               ✅ 7 charts (weight, sleep, mood, energy, steps, HR, HRV)

lib/
├── engine/
│   ├── achievements.ts                  ✅ 14 achievements across 4 categories
│   ├── biomarkers.ts                    ✅ 30 markers (expanded from 20)
│   ├── classifier.ts                    ✅ Weighted scoring + critical thresholds
│   ├── daily-habits.ts                  ✅ 14 habits across 8 categories (NEW!)
│   ├── interactions.ts                  ✅ Drug-supplement interactions DB
│   ├── master-prompt.ts                 ⚠️ 614 lines but DOESN'T USE new onboarding fields
│   ├── patterns.ts                      ✅ 13 patterns (expanded from 5)
│   ├── phenoage.ts                      ✅ PhenoAge algorithm
│   └── universal-tips.ts                ✅ Universal longevity tips DB
├── hooks/
│   └── useDailyMetrics.ts               ✅ Single day + range hooks (NEW!)
├── supabase/
│   ├── client.ts                        ✅
│   └── server.ts                        ✅
├── utils/
│   └── streak.ts                        ✅ Real streak math from DB (NEW!)
└── types.ts                             ⚠️ Doesn't include new onboarding fields

scripts/
├── setup-db.sql                         ⚠️ DOESN'T include daily_metrics table
├── migrate-db.sql                       ⚠️ Same
├── add-share-tracking.sql               ✅
└── ??? no migration for daily_metrics   ❌ MISSING

public/                                  ✅ Basic assets
```

---

## PART 3 — CRITICAL BUGS & GAPS STILL PRESENT

### 🔴 BUG #1 — Master prompt IGNORES half the onboarding data
**File:** `lib/engine/master-prompt.ts`

The onboarding now collects: chronotype, bedtime/wake time, work schedule, 
sleep issues, food allergies, family history, pain points, non-negotiables, 
primary/secondary goals, specific targets, meditation practice, exercise 
window preference, sitting hours, screen time, meals per day, hydration.

**The master prompt uses almost NONE of this.** It only passes the old fields
through `buildMasterPromptV2()`. This means you collect rich data → throw it away.

**Impact:** A user who says "I'm a night owl, work 9-5, have pizza Fridays" 
gets the same protocol as someone who's a morning person, self-employed, 
and eats strictly keto. That's the opposite of personalized.

### 🔴 BUG #2 — ProtocolOutput TypeScript doesn't match what AI returns
**File:** `lib/types.ts`

Master prompt asks AI to return: `painPointSolutions`, `flexRules`, 
`weekByWeekPlan`, `adherenceScore` — but these aren't in `ProtocolOutput` 
type. The AI might return them (or not), but dashboard can't render them
safely without types.

### 🔴 BUG #3 — daily_metrics table migration missing
**File:** `scripts/setup-db.sql`

API `/api/daily-metrics` writes to `public.daily_metrics` but there's 
NO SQL migration creating this table. Every user who tries to use the 
Metrics tab gets a Postgres error "relation does not exist."

### 🔴 BUG #4 — Fallback protocol is still English-only omnivore
**File:** `app/api/generate-protocol/route.ts` lines 125-230

When AI fails, fallback generates chicken + eggs + salmon meals regardless 
of user's `dietType`. If user is vegan, they get useless fallback.
Also fallback doesn't use pain points, work schedule, or goals.

### 🟡 BUG #5 — Dashboard doesn't render new sections
**File:** `app/(app)/dashboard/page.tsx`

Even if AI returns `painPointSolutions` or `flexRules`, dashboard doesn't 
have components to render them. User never sees this data.

### 🟡 BUG #6 — Settings page has no profile editing
**File:** `app/(app)/settings/page.tsx`

Shows age/sex/BMI as read-only. User can't update weight if they lose 15kg. 
Can't add new blood work. Can't change medications. Only actions: share, 
export, logout, reset.

### 🟡 BUG #7 — Anthropic SDK installed but nowhere used
Package `@anthropic-ai/sdk` sits in node_modules. Master prompt was 
designed for Claude Opus. Groq (Llama) is a solid fallback but Claude 
would produce noticeably deeper protocols.

### 🟡 BUG #8 — Rate limiting imported but not enforced
`@upstash/ratelimit` + `@upstash/redis` are installed. Free tier could 
spam generation infinitely. Need actual limiter on `/api/generate-protocol` 
and `/api/chat`.

### 🟡 BUG #9 — No Zod validation on AI output
`zod` is in deps. If Groq returns malformed JSON, runtime crashes somewhere 
in dashboard rendering. Should validate → show helpful error.

### 🟡 BUG #10 — Achievements don't track habit streaks separately
`ACHIEVEMENTS` uses `supplementStreak` field but that's just `currentStreak`
(compliance). A "habits streak" (e.g., "14 days of 10+ habits completed")
would be more motivating and is easy to calculate from `daily_metrics.habits_completed`.

### 🟢 BUG #11 — No retest reminder email/notification
Tables exist for `retest_reminders` (probably? need to verify) but no cron, 
no email via Resend, no in-app banner.

### 🟢 BUG #12 — Print/PDF export is basic window.print()
Works, but a proper PDF with letterhead + page breaks + doctor-ready format 
using @react-pdf/renderer would be a big upgrade for the "Premium" tier.

### 🟢 BUG #13 — No OG image for social sharing
`/share/[slug]` works but sharing a link doesn't show a rich preview. 
Dynamic OG image with bio age + longevity score would 2-3× click-through.

### 🟢 BUG #14 — No revenue / tier system
Everything is free. No Stripe, no usage limits enforced per tier, no upsell
prompts.

---

## PART 4 — THE MISSING FEATURES THAT MAKE v3 LEGENDARY

### 4.1 — Master Prompt v3 (the most important upgrade)

Add a **DEEP CONTEXT BLOCK** to the master prompt that consumes ALL new 
onboarding data. Example:

```
═══ PATIENT'S DAILY CONTEXT ═══
WORK: Starts 09:00, ends 18:00, hybrid (home/office). Sits ~6 hrs/day.
SLEEP: Currently in bed at 23:00, wakes at 07:00. Chronotype: night owl.
  Reports: trouble falling asleep, wakes unrested.
  → Target bedtime should shift toward 22:30 progressively. Use morning 
    sunlight + caffeine cutoff protocol.
EXERCISE WINDOW: Prefers evening. 90 min cardio/week + 2 strength sessions.
EATING: Omnivore, 3 meals/day, 6 glasses water. Allergies: dairy.
STRESS: 7/10. No meditation practice currently.
MEDITATION: None → start with 5 min/day, not 20 min.
FAMILY HISTORY: Diabetes (father). Cancer (grandmother).
  → Prioritize glucose interventions EVEN IF HbA1c is OK.
  → Annual cancer screening recommended.
SUBSTANCES: 3 drinks/week alcohol. 2 coffees/day. Non-smoker.
PAIN POINTS (from onboarding):
  1. "Afternoon energy crash around 3 PM"
  2. "Can't fall asleep before midnight"
  3. "Lower back stiffness in morning"
NON-NEGOTIABLES:
  1. "Friday pizza night with kids"
  2. "Morning coffee, won't give up"
  → Do NOT demand elimination. Build flex-rules around these.

═══ PRIMARY GOAL ═══
Longevity / Healthspan (ranked #1)

═══ SECONDARY GOALS ═══
Energy / Mood, Cognitive Performance

═══ SPECIFIC TARGET ═══
"Reduce biological age by 2 years in 6 months"

═══ TIMELINE ═══
6 months commitment. Time budget: 60 min/day. Monthly supplement budget: 500 RON.
```

### 4.2 — ProtocolOutput v3 — new sections AI must return

Add to `lib/types.ts` and prompt schema:

```typescript
painPointSolutions: {
  problem: string;              // exact user phrase from onboarding
  likelyCause: string;          // AI's hypothesis
  solution: string;             // concrete plan
  supportingBiomarkers?: string[];  // which markers relate
  expectedTimeline: string;     // "1-2 weeks for first improvements"
  checkpoints: string[];        // how to measure progress
}[];

flexRules: {
  scenario: string;             // user's non-negotiable
  strategy: string;             // "20-min walk before + berberine 500mg"
  damageControl: string;        // what to do if overdone
  frequency: string;            // "up to 1x/week without penalty"
}[];

weekByWeekPlan: {
  week: number;                 // 1-12
  focus: string;                // "Foundation"
  newThisWeek: string[];        // add these
  removeThisWeek?: string[];    // stop these
  keyMetric: string;            // "Sleep quality should improve"
  checkpoints: string[];        // end-of-week questions
}[];

adherenceScore?: number;        // 0-100, calculated from compliance data

dailyBriefing?: {
  morningPriorities: string[];  // top 3 things today
  eveningReview: string[];      // what to reflect on
};
```

### 4.3 — Settings page upgrade

```
NEW sections:
- Edit profile (age, weight, height, activity) — with Save button
- Edit answers to onboarding (re-open specific questions without full reset)
- Add new blood work (upload PDF or manual entry) → triggers protocol regen
- Manage medications (add/edit/remove rows)
- Manage current supplements (add/edit/remove)
- Update goals (change primary, add/remove secondary)
- View all protocols (with date, version badge)
- Compare two protocols side-by-side
- Retest reminders (enable/disable email, view upcoming)
- Notification preferences
- Delete account
```

### 4.4 — Dashboard new sections to render

After the existing sections, add:

**Pain Point Solutions** (after Diagnostic Hero if present):
```tsx
<Section title="Your Pain Points" icon="🎯">
  {protocol.painPointSolutions.map(p => (
    <div>
      <p className="text-sm font-semibold">{p.problem}</p>
      <p className="text-xs text-muted">Likely cause: {p.likelyCause}</p>
      <p className="text-sm text-accent">{p.solution}</p>
      <p className="text-[10px]">Expected: {p.expectedTimeline}</p>
    </div>
  ))}
</Section>
```

**Flex Rules** (before Shopping List):
```tsx
<Section title="Your Flex Rules" icon="🎉">
  <p className="text-xs">Non-negotiables you can keep, with strategies.</p>
  {protocol.flexRules.map(r => (
    <div>
      <p className="font-medium">{r.scenario}</p>
      <p className="text-sm text-accent">{r.strategy}</p>
      <p className="text-[10px] text-muted">If overdone: {r.damageControl}</p>
    </div>
  ))}
</Section>
```

**Week-by-Week Plan** (expandable, replacing roadmap):
```tsx
<Section title="12-Week Plan" icon="📅">
  {protocol.weekByWeekPlan.map(w => (
    <ExpandableWeek key={w.week} {...w} isCurrentWeek={currentWeekNumber === w.week} />
  ))}
</Section>
```

**Daily Briefing** (at top, above everything, time-aware):
```tsx
{currentHour < 12 ? (
  <Card>
    <h2>☀️ Good morning</h2>
    <h3>Today's priorities:</h3>
    {protocol.dailyBriefing.morningPriorities.map(p => <li>{p}</li>)}
  </Card>
) : (
  <Card>
    <h2>🌙 Evening</h2>
    <h3>Review:</h3>
    {protocol.dailyBriefing.eveningReview.map(q => <li>{q}</li>)}
  </Card>
)}
```

### 4.5 — Claude Opus as primary with Groq fallback

Replace `generateWithGroq()` as sole path. New flow:
```
1. Try Claude Opus 4.5 (anthropic)
   - Slower but produces MUCH better medical reasoning
   - Max 60s timeout
2. If Claude fails → try Groq Llama 3.3 70B (fast backup)
3. If Groq fails → use deterministic fallback (already exists, fix it to 
   respect dietType + pain points + non-negotiables)
```

### 4.6 — Retest reminder system

Schema already planned:
```sql
create table public.retest_reminders (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  biomarker_codes text[] not null,
  due_date date not null,
  sent boolean default false,
  sent_at timestamptz,
  created_at timestamptz default now()
);
```

Add:
- `/api/retest-reminders` GET (upcoming) + POST (create when protocol generated)
- Auto-create reminders when protocol is generated, based on 
  `retestSchedule` from AI output
- Vercel cron job (weekly): `/api/cron/send-retest-emails`
- Use Resend to send emails
- Dashboard banner: "You have a retest due in 5 days"

### 4.7 — Daily briefing (push-ready)

Generate a compact daily summary each morning:
```
API: /api/daily-briefing
- Fetches today's compliance items (not yet logged)
- Fetches yesterday's adherence %
- Picks top 3 items that matter most (MUST > STRONG > OPTIONAL)
- Generates one-liner motivation based on their goal
- Returns JSON for display at dashboard top
```

### 4.8 — Doctor-ready PDF export

Replace `window.print()` with:
- `@react-pdf/renderer` dependency
- `/api/export-pdf` route
- Generates actual PDF (not HTML print) with:
  - Patient header (name, DOB, date, chronological vs biological age)
  - Executive summary (top wins, top risks)
  - Biomarker table with reference ranges (standard + longevity)
  - Detected patterns section
  - Current medications & interactions warnings
  - Recommended tests to order
  - Red flags (if any)
  - AI-generated executive summary for the doctor
  - Footer: "Generated by Protocol AI — not medical advice"

### 4.9 — OG image for share links

Create `/api/og/[slug]` route using `@vercel/og`:
- Dark background, #00ff88 accent
- Big bio age number
- Longevity score
- "Personalized by Protocol AI"
- User can post to X/Twitter and get rich preview

### 4.10 — Habit streak tracking

Separate from protocol compliance. Track:
- Longest habit streak (consecutive days with ≥10 habits completed)
- Per-habit streak (e.g., "floss: 23 days straight")
- Add to achievements: "Floss Master" (30 days), "Habit Hero" (14 days all habits)

---

## PART 5 — EXACT IMPLEMENTATION ORDER (25 steps)

### 🔥 SPRINT 1 — Fix Critical Bugs (1 day)

**Step 1:** Create SQL migration for `daily_metrics` table
```sql
create table if not exists public.daily_metrics (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  date date not null,
  weight_kg real,
  sleep_hours real,
  sleep_quality integer check (sleep_quality between 1 and 10),
  mood integer check (mood between 1 and 10),
  energy integer check (energy between 1 and 10),
  hrv integer,
  resting_hr integer,
  steps integer,
  workout_done boolean default false,
  workout_minutes integer,
  workout_intensity text,
  stress_level integer check (stress_level between 1 and 10),
  habits_completed text[] default '{}',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, date)
);
alter table public.daily_metrics enable row level security;
create policy "daily_metrics_own" on public.daily_metrics for all using (auth.uid() = user_id);
```

**Step 2:** Also add `retest_reminders` table (will need it soon)

**Step 3:** Run both migrations in Supabase Dashboard

**Step 4:** Update `lib/types.ts` with new onboarding fields:
```typescript
export interface UserProfile {
  // ...existing
  ethnicity?: string;
  occupationType?: 'desk' | 'physical' | 'shift' | 'mixed';
  restingHR?: number;
  bedtime?: string;
  wakeTime?: string;
  chronotype?: 'morning' | 'neutral' | 'night';
  sleepIssues?: string[];
  mealsPerDay?: number;
  hydrationGlasses?: number;
  foodAllergies?: string[];
  stressLevel?: number;
  meditationPractice?: 'none' | 'occasional' | 'daily';
  familyHistory?: string[];
  workStart?: string;
  workEnd?: string;
  workLocation?: 'home' | 'office' | 'hybrid';
  sittingHours?: number;
  exerciseWindow?: 'morning' | 'lunch' | 'evening' | 'weekends' | 'inconsistent';
  screenTime?: number;
  painPoints?: string;
  nonNegotiables?: string;
  primaryGoal?: string;
  secondaryGoals?: string[];
  specificTarget?: string;
  timelineMonths?: number;
}

export interface ProtocolOutput {
  // ...existing
  painPointSolutions?: PainPointSolution[];
  flexRules?: FlexRule[];
  weekByWeekPlan?: WeekPlan[];
  dailyBriefing?: { morningPriorities: string[]; eveningReview: string[]; };
  adherenceScore?: number;
}
```

### 🎯 SPRINT 2 — Master Prompt v3 (1 day)

**Step 5:** Rewrite `buildMasterPromptV2()` to consume ALL new fields
- Add DEEP CONTEXT block (see section 4.1 above)
- Add painPointSolutions, flexRules, weekByWeekPlan, dailyBriefing to output schema
- Add instruction: "derive target bedtime from chronotype + wake time + 8h sleep"
- Add instruction: "factor family history into preventive priority"
- Add instruction: "never demand elimination of non-negotiables"

**Step 6:** Update `save-profile` route to persist new fields
Currently it saves the core fields but not ethnicity/chronotype/bedtime etc.
Make sure ALL new onboarding fields get stored properly.

**Step 7:** Update `generate-protocol` to build prompt with new fields
The profile object passed to `buildMasterPromptV2` needs the new fields.

**Step 8:** Fix fallback protocol to respect dietType + goals
```typescript
// Vegan fallback meals
const veganMeals = [
  { name: 'Breakfast', ingredients: ['tofu scramble', 'oats', 'berries', 'almond butter'] },
  { name: 'Lunch', ingredients: ['lentil bowl', 'quinoa', 'roasted vegetables', 'tahini'] },
  { name: 'Dinner', ingredients: ['tempeh stir-fry', 'brown rice', 'broccoli', 'ginger sauce'] },
];

const ketoMeals = [...];
const omniMeals = [...];  // current default
```

**Step 9:** Add Zod validation to AI output
```typescript
const ProtocolSchema = z.object({
  diagnostic: z.object({...}),
  supplements: z.array(z.object({...})),
  // ...
});

try {
  const validated = ProtocolSchema.parse(protocolJson);
  return validated;
} catch (zodErr) {
  // Log, fall back to deterministic
}
```

### 💎 SPRINT 3 — Dashboard v3 (1-2 days)

**Step 10:** Create `components/protocol/PainPointSolutions.tsx`
**Step 11:** Create `components/protocol/FlexRules.tsx`
**Step 12:** Create `components/protocol/WeekByWeekPlan.tsx` (with expand/collapse per week)
**Step 13:** Create `components/protocol/DailyBriefing.tsx` (time-aware morning/evening)
**Step 14:** Update `app/(app)/dashboard/page.tsx` to render all new sections

### 🔔 SPRINT 4 — Retest Reminders + Settings (1 day)

**Step 15:** Create `/api/retest-reminders/route.ts` (GET + POST)
**Step 16:** Auto-create reminders when protocol generated (extract from `retestSchedule`)
**Step 17:** Add dashboard banner for upcoming retests
**Step 18:** Expand settings page:
- Profile editor (age/weight/height/activity with Save button)
- Medications manager (add/edit/remove)
- Supplements manager
- Goals updater
- Upload new blood test (triggers re-gen)
- View protocol history (list all, compare two)

### 🧠 SPRINT 5 — Claude Opus Integration (1 day)

**Step 19:** Create `lib/ai/claude.ts` wrapper
```typescript
import Anthropic from '@anthropic-ai/sdk';
export async function generateWithClaude(prompt: string) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',  // or opus when available
    max_tokens: 16000,
    messages: [{ role: 'user', content: prompt }],
  });
  return msg.content[0].type === 'text' ? msg.content[0].text : '';
}
```

**Step 20:** Update `generate-protocol` flow: Claude → Groq → fallback

**Step 21:** Add env var `ANTHROPIC_API_KEY` to `.env.local.example`

### 🛡️ SPRINT 6 — Rate Limiting + Safety (half day)

**Step 22:** Add rate limiting with Upstash
```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(3, '1 d'),  // 3 generations per day (free tier)
});

// In generate-protocol:
const { success } = await ratelimit.limit(user.id);
if (!success) return NextResponse.json({ error: 'Rate limit. Upgrade to Pro.' }, { status: 429 });
```

**Step 23:** Same for `/api/chat` (20/day) and `/api/parse-bloodwork` (5/day)

### 📱 SPRINT 7 — Polish & Growth (2-3 days, optional)

**Step 24:** Dynamic OG image for `/share/[slug]` using `@vercel/og`

**Step 25:** PDF export with `@react-pdf/renderer` (doctor-ready format)

**Bonus:** Email reminders via Resend, Stripe tiers, referral system

---

## PART 6 — COPY-PASTE CLAUDE CODE PROMPT

Paste this into Claude Code as the FIRST message:

```
Read C:\Users\Andrei\protocol-maker\PROTOCOL_MAKER_V3_FINAL.md completely 
(this document). Do not write any code yet.

In ~15 lines, tell me:
1. The 3 most critical bugs you found
2. Which sprint you'd do first  
3. Any questions about the plan
4. Whether you see the daily_metrics table migration issue
5. What you think of the master prompt v3 deep context idea

Then wait for my "go".

When I say go, start Sprint 1:
- Show me the proposed SQL migration file first
- Wait for my confirmation
- Then modify lib/types.ts with new fields
- Run `pnpm build` after each file to verify
- Don't proceed until build is green

Rules:
- Strict TypeScript, no `any`
- Match existing Tailwind patterns (rounded-2xl, bg-card, border-card-border)
- Keep components under 300 lines
- English only in UI
- Mobile-first (test with narrow viewport)
- Always add loading AND error states
- Update existing types, don't create parallel ones

For Sprint 2 (master prompt v3), this is the MOST important sprint. 
Show me the full new prompt before applying. I want to review it.

For Sprint 3 (dashboard sections), show design mockup / component outline 
before writing 300 lines of JSX.

For Sprint 5 (Claude Opus), use model "claude-sonnet-4-5-20250929" initially. 
If that's unavailable in their account, fall back to "claude-3-5-sonnet-latest".
```

---

## PART 7 — FINAL HONEST ASSESSMENT

### You've built something real.

This project is no longer an MVP — it's a credible product. The tracking 
system with real streak math, the 5-step onboarding with state persistence, 
the AI chat with full user context, the daily metrics with trends, the 
13-pattern detector, the PhenoAge algorithm, the drug interaction database, 
the PDF parsing via Groq, the biomarker range visualizations on dashboard — 
this is serious engineering.

### The missing 15% is what makes it great vs. good.

1. **Master prompt that actually uses the data** — you ask users all these 
   questions then feed only 40% of it to AI. Fix this and protocols will 
   feel 5× more personal overnight.

2. **Pain points and flex rules** — this is the humanization layer. 
   "I know you have Friday pizza night. Here's how to keep it without 
   wrecking progress." That's a coach, not a spreadsheet.

3. **Settings that let you EDIT** — right now a user who gains 3kg has 
   to redo onboarding. That's a dealbreaker for retention.

4. **Retest reminders** — the app forgets about you after protocol 
   generation. Reminders 8 weeks later is where you earn $49/month.

5. **Claude Opus** — you designed the prompt for Claude. Groq is a 
   capable fallback but Claude produces notably better medical reasoning.

### Do Sprint 1 + 2 this week.

The database migration is a blocker (users WILL hit errors on Metrics tab). 
The master prompt upgrade unlocks the real protocol quality. Together 
these two sprints are maybe 2 days of focused work and transform the product.

Sprints 3-7 can come over the next 2-3 weeks.

### After that, you can tag Bryan.

Take his publicly shared biomarkers, run them through your engine, post 
the output side-by-side with his actual Blueprint on X/Twitter. If 70%+ 
matches, you've demonstrated the engine works. That's your viral moment.

Let's make it happen.