# 🧬 PROTOCOL MAKER v3 — FINAL AUDIT & PERFECTION PLAN
# ═══════════════════════════════════════════════════════════════════
# Complete re-audit after major implementation sprint.
# This replaces all previous specs.
# ═══════════════════════════════════════════════════════════════════

## EXECUTIVE SUMMARY

Andrei has implemented ~70% of the v2 spec successfully. The app now has:
- ✅ Landing page with Bryan comparison + biomarker demo
- ✅ 4-step onboarding with PDF upload (Groq parsing)
- ✅ 30-biomarker reference DB (up from 20)
- ✅ 13 pattern detectors (up from 5)
- ✅ Master prompt v2 (614 lines — crown jewel)
- ✅ Dashboard with range bars, organ radar, Bryan comparison, daily schedule
- ✅ Supplement timeline (morning/food/evening/bedtime)
- ✅ Universal tips section
- ✅ Cost breakdown
- ✅ Tracking with streaks, weekly chart, monthly heatmap, achievements
- ✅ History page with side-by-side blood test comparison
- ✅ Print/PDF export (via window.print + CSS @media print)
- ✅ PhenoAge biological age algorithm
- ✅ Drug-supplement interaction DB
- ✅ Achievement system (14 badges)
- ✅ Privacy + Terms pages
- ✅ Sitemap + robots.ts
- ✅ Fallback protocol generator (when AI fails)
- ✅ Fixed share view_count bug
- ✅ English UI throughout

What's still missing or broken — this document covers it.

---

## PART 1 — CRITICAL BUGS & ISSUES FOUND

### 🔴 BUG #1 — Tracking uses MOCK DATA (biggest issue)
**File:** `app/(app)/tracking/page.tsx`, lines 130-148

The streak, weekly chart, and monthly heatmap ALL use `Math.random()`:
```typescript
setStreak(todayPct >= 50 ? Math.floor(Math.random() * 7) + 1 : 0);
setWeekData(days.map((d, i) => ({
  day: d,
  pct: i < dayIdx ? Math.floor(Math.random() * 60 + 40) : ...
})));
setMonthData(Array.from({ length: 30 }, (_, i) => {
  return { date: ..., pct: i < 29 ? Math.floor(Math.random() * 100) : todayPct };
}));
```
This is fake data. User will see different numbers every refresh. **CRITICAL FIX NEEDED.**

### 🔴 BUG #2 — Compliance logs only fetched for TODAY
**File:** `app/api/compliance/route.ts`

The GET endpoint only accepts a single date parameter. Cannot fetch a range for weekly/monthly charts. Needs a new endpoint or parameter.

### 🔴 BUG #3 — Achievements always re-checked with current-day stats only
**File:** `app/(app)/tracking/page.tsx`, line 235

Passes `currentStreak: streak` (which is Math.random), `bloodTestsUploaded: 0` (hardcoded!), etc. Achievements should be calculated from REAL historical data.

### 🟡 BUG #4 — Onboarding doesn't actually save partial progress
**File:** `app/(app)/onboarding/page.tsx`

`saveProgress()` is called between steps, but the user state (biomarkers entered, lifestyle choices) is NOT persisted — only the step number. If user refreshes, they lose everything entered.

### 🟡 BUG #5 — Fallback protocol doesn't respect user's diet/budget/goals
**File:** `app/api/generate-protocol/route.ts`, line 125-230

The `buildFallbackProtocol()` function generates a generic protocol with omnivore meals (eggs, chicken, salmon). If user is vegan, budget is 200 RON, or sleep quality is 2/10, fallback ignores this. Only partial personalization.

### 🟡 BUG #6 — Dashboard radar chart doesn't handle missing organSystemScores
**File:** `app/(app)/dashboard/page.tsx`, line 99-102

If AI returns incomplete scores, radar renders with undefined values showing as blank axes. Needs fallback values.

### 🟡 BUG #7 — Settings page missing regenerate button flow
The dashboard has a "Regenerate protocol" link that calls `/api/reset-onboarding`, but the button exists only in the dashboard footer. Settings page should prominently feature this.

### 🟡 BUG #8 — No Anthropic SDK usage despite being installed
Package `@anthropic-ai/sdk` is installed but nowhere imported. The v2 plan called for Claude Opus as primary with Groq fallback — only Groq is used.

### 🟡 BUG #9 — Medication input is single text field
Onboarding line: `medications: medications ? [{ name: medications, dose: '', frequency: 'daily' }] : []`

All medications typed as one string become a single record with empty dose. Should be a repeatable list with name/dose/frequency per medication.

### 🟡 BUG #10 — No biomarker editing after onboarding
User can't add/edit biomarkers after initial upload. If they get new blood work, they must redo onboarding completely.

### 🟢 BUG #11 — Rate limiting packages installed but unused
`@upstash/ratelimit` and `@upstash/redis` installed but never imported. Free tier could hit AI generation limits rapidly without this.

### 🟢 BUG #12 — No Zod validation on AI output
`zod` is in deps but not used. AI returns invalid JSON → runtime crash when dashboard renders.

---

## PART 2 — ONBOARDING PERFECTION (ASK EVERYTHING)

The current onboarding collects the basics but misses critical personalization inputs. For a truly bespoke protocol, expand to:

### NEW STEP 1 — "The Basics" (expand)
Current: age, sex, height, weight, activity level, has bloodwork
**ADD:**
- **Ethnicity** (dropdown) — affects certain biomarker ranges (e.g., vitamin D, ferritin)
- **Latitude** (auto-detect via browser geolocation, editable) — vitamin D synthesis target
- **Occupation type** (radio: desk / physical / shift-work / mixed) — circadian implications
- **Resting heart rate** (if they know it) — cardiovascular fitness proxy

### NEW STEP 2 — "Your Blood Work" (keep as-is, working well)

### NEW STEP 3 — "Your Lifestyle" (MAJOR expansion)
Current has basic sleep/diet/exercise/conditions. Expand to:

**Sleep deep-dive:**
- Average bedtime (time picker)
- Average wake time (time picker)
- Consistency (1-10 — do you keep same schedule on weekends?)
- Sleep issues (multi-select: trouble falling asleep / staying asleep / wake unrested / snoring / restless legs / none)
- **Chronotype** (radio: Morning person / Neutral / Night owl) — affects protocol timing

**Diet deep-dive:**
- Current diet type (keep)
- Meals per day (1-6)
- Current eating window (time picker pair)
- Hydration (glasses per day, 1-12)
- How often home-cooked vs restaurants (%)
- Favorite foods / things you won't give up (text)
- Food allergies/intolerances (multi-select: gluten / dairy / nuts / seafood / eggs / soy / shellfish / other)

**Exercise deep-dive:**
- Current cardio min/week (slider 0-500)
- Current strength sessions/week (0-7)
- Flexibility/mobility work (yes/no)
- Access to gym (yes/no/home equipment only)
- Activity preferences (multi-select: walking / running / cycling / swimming / weights / yoga / martial arts / team sports / none)
- Physical limitations/injuries (text)

**Stress & mental:**
- Stress level (1-10)
- Meditation/mindfulness practice (none / occasionally / daily)
- Major life stressors currently (multi-select: work / family / health / financial / none)
- Mood (1-10)
- Energy level throughout day (morning/afternoon/evening sliders)

**Substances (granular):**
- Alcohol: drinks per week (0-30 slider)
- Caffeine: servings per day (0-10) + cutoff time
- Nicotine: none / occasional / daily / vaping
- Recreational drugs: none / occasional / frequent
- Current prescription medications (multi-row: name + dose + frequency)
- Current supplements (multi-row: name + dose)

**Medical history:**
- Diagnosed conditions (multi-select, expanded)
- Family history (multi-select: diabetes / heart disease / cancer / Alzheimer's / autoimmune / none)
- Past surgeries (text)
- Recent illnesses (last 6 months, text)
- For women: pregnancy status / menopausal status / hormonal contraception
- Last blood work date (date picker)
- Last physical checkup (date picker)

### NEW STEP 4 — "Your Day-to-Day" (NEW STEP)
This is the MOST important for personalization. The AI needs to know what your day actually looks like.

**Daily routine:**
- What time do you start work?
- What time do you finish work?
- Do you work from home / office / hybrid?
- How many hours sitting per day?
- Time for exercise (morning / lunch / after work / weekends only / inconsistent)
- Screen time per day (slider 1-16 hours)
- Blue light exposure at night (none / minimal / moderate / heavy)
- Natural light exposure (morning sunlight routine? yes/no)

**Social & lifestyle:**
- Single / partnered / married / parent
- Number of dependents
- Social activity level (isolated / moderate / very social)
- Travel frequency (rarely / monthly / weekly)
- Nature exposure (hours per week)

**What you've tried:**
- Previous diets attempted (multi-select)
- Previous supplements that worked/didn't (text)
- What health interventions you're curious about (multi-select: fasting / cold exposure / sauna / meditation / biohacking / peptides / hormone therapy / red light / CGM)

### NEW STEP 5 — "Your Goals & Constraints"
Current goals step — expand:

**Goals:**
- Primary goal (radio, pick ONE): Longevity / Body composition / Cognitive performance / Athletic performance / Recovery / Energy / Sleep / Mental health
- Secondary goals (multi-select: up to 3 additional)
- Specific targets (optional text: "Lose 10kg by summer", "Run a 5K under 25 min", "Sleep 8 hours consistently")

**Timeline:**
- Commitment horizon: 1 month / 3 months / 6 months / 1 year / ongoing

**Resources:**
- Time per day available (slider 15-180 min)
- Monthly supplement/health budget (RON)
- Willingness to change habits (1-10)
- Willingness to track daily (1-10)
- Openness to experimental (keep)

**Preferences:**
- Prefer simplicity or maximum optimization? (slider)
- Pill tolerance (how many supplements per day are you willing to take — slider 0-30)
- Food prep time willing (minutes per day)

### IMPLEMENTATION FOR ONBOARDING:

1. Convert to 5 steps (was 4)
2. Save FULL state to `profiles.onboarding_data` JSONB column after every step
3. Restore state on page load if onboarding incomplete
4. Add collapse/expand for deep-dive sections (so it's not overwhelming)
5. Progress bar shows "~3 min remaining" etc.
6. Each step has "Why we ask this" tooltips
7. Smart defaults based on previous answers (e.g., if smoker → flag in top priorities)

---

## PART 3 — TRACKING PERFECTION (REAL DATA, NO MOCK)

The tracking page is currently 70% fake. Here's the complete fix plan:

### 3.1 — New API endpoint: `/api/compliance/history`

```typescript
// app/api/compliance/history/route.ts
export async function GET(request: Request) {
  // params: startDate, endDate (ISO)
  // returns: array of { date, completed, total, pct }
  
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  const { data: logs } = await supabase
    .from('compliance_logs')
    .select('date, completed, item_type')
    .eq('user_id', user.id)
    .gte('date', startDate)
    .lte('date', endDate);
  
  // Group by date, calculate percentage
  const byDate = logs.reduce((acc, log) => {
    if (!acc[log.date]) acc[log.date] = { completed: 0, total: 0 };
    acc[log.date].total++;
    if (log.completed) acc[log.date].completed++;
    return acc;
  }, {});
  
  return NextResponse.json({ 
    byDate: Object.entries(byDate).map(([date, stats]) => ({
      date,
      completed: stats.completed,
      total: stats.total,
      pct: Math.round((stats.completed / stats.total) * 100)
    }))
  });
}
```

### 3.2 — Calculate streaks from real data

```typescript
function calculateStreak(complianceHistory: { date: string; pct: number }[]) {
  const sorted = [...complianceHistory].sort((a, b) => b.date.localeCompare(a.date));
  const today = new Date().toISOString().split('T')[0];
  
  let streak = 0;
  let checkDate = today;
  
  for (const entry of sorted) {
    if (entry.date !== checkDate) break;
    if (entry.pct < 50) break; // Must hit 50% to count
    streak++;
    const prev = new Date(checkDate);
    prev.setDate(prev.getDate() - 1);
    checkDate = prev.toISOString().split('T')[0];
  }
  
  return streak;
}

function calculateLongestStreak(history) {
  // Walk through chronologically, find longest consecutive 50%+ run
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  let longest = 0, current = 0;
  let lastDate = null;
  
  for (const entry of sorted) {
    if (entry.pct >= 50) {
      if (lastDate && isConsecutive(lastDate, entry.date)) {
        current++;
      } else {
        current = 1;
      }
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
    lastDate = entry.date;
  }
  
  return longest;
}
```

### 3.3 — Expand tracking with HABIT TRACKING (NEW)

Add a new section: "Daily Habits" — separate from protocol checklist.
These are the universal tips made trackable:

```typescript
const DAILY_HABITS = [
  { id: 'steps', name: '8,000+ steps', icon: '🚶', category: 'Movement' },
  { id: 'sunlight', name: 'Morning sunlight 10+ min', icon: '☀️', category: 'Circadian' },
  { id: 'hydration', name: '2L+ water', icon: '💧', category: 'Nutrition' },
  { id: 'strength', name: 'Strength training', icon: '🏋️', category: 'Movement' },
  { id: 'zone2', name: 'Zone 2 cardio', icon: '🚴', category: 'Movement' },
  { id: 'no_alcohol', name: 'No alcohol', icon: '🚫🍷', category: 'Substances' },
  { id: 'meditation', name: 'Meditation/breathwork', icon: '🧘', category: 'Mindset' },
  { id: 'stretch', name: 'Mobility/stretching', icon: '🤸', category: 'Movement' },
  { id: 'floss', name: 'Floss', icon: '🦷', category: 'Hygiene' },
  { id: 'cold_shower', name: 'Cold shower', icon: '🧊', category: 'Recovery' },
  { id: 'read', name: 'Read 20+ min', icon: '📖', category: 'Mindset' },
  { id: 'journal', name: 'Journal', icon: '📝', category: 'Mindset' },
  { id: 'no_screens_bed', name: 'No screens 1h before bed', icon: '📵', category: 'Sleep' },
  { id: 'fasted_16h', name: '16h fast', icon: '⏰', category: 'Nutrition' },
];
```

### 3.4 — Add DAILY METRICS INPUT (NEW)

User should be able to log quantitative data each day:
- Weight (kg)
- Sleep hours + quality (1-10)
- Mood (1-10)
- Energy (1-10)
- HRV (if they track via Oura/WHOOP)
- Resting HR
- Steps
- Workout done? (yes/no + duration + intensity)
- Stress level (1-10)
- Notes (text)

Schema addition:
```sql
create table public.daily_metrics (
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
  notes text,
  created_at timestamptz default now(),
  unique(user_id, date)
);

alter table public.daily_metrics enable row level security;
create policy "daily_metrics_own" on public.daily_metrics for all using (auth.uid() = user_id);
```

### 3.5 — Tracking page redesign (real data edition)

```
TRACKING PAGE STRUCTURE (new):

├── Top stats bar (4 cards)
│   ├── Current streak (🔥 N days — real from DB)
│   ├── Today's compliance (ring, real %)
│   ├── Week average (bar chart)
│   └── Month average (circle)
│
├── TABBED SECTIONS (tabs for easier navigation)
│   │
│   ├── Tab: PROTOCOL CHECKLIST
│   │   └── Current checklist grouped by type
│   │
│   ├── Tab: DAILY HABITS
│   │   └── 14 universal habits with toggles
│   │
│   ├── Tab: DAILY METRICS
│   │   ├── Weight input
│   │   ├── Sleep hours + quality sliders
│   │   ├── Mood + energy sliders  
│   │   ├── Steps input
│   │   ├── Workout completion + duration
│   │   └── Notes textarea
│   │
│   ├── Tab: TRENDS (30-day charts)
│   │   ├── Weight line chart
│   │   ├── Sleep hours bar chart
│   │   ├── Mood/energy line chart
│   │   └── Steps bar chart
│   │
│   └── Tab: ACHIEVEMENTS
│       └── Real achievement grid with progress
│
└── Bottom: SAVE button that persists all tabs at once
```

---

## PART 4 — PROTOCOL ENHANCEMENTS (MORE PERSONAL)

### 4.1 — Master prompt additions

Add these CONTEXT BLOCKS before output schema:

**Personal context block (injected when data available):**
```
═══ PATIENT'S DAILY CONTEXT ═══
Work schedule: Monday-Friday 9:00 AM - 6:00 PM, hybrid remote
Exercise window preference: Morning (before work)
Sleep: currently 11 PM - 7 AM, wants to shift to 10:30 PM - 6:30 AM
Eating pattern: 3 meals, 7 AM - 9 PM window currently, wants TRE
Chronotype: Night owl (but wants to shift toward morning)
Stress sources: Work deadlines, parenting 2 kids
Biggest current pain points: Brain fog afternoons, trouble falling asleep
Non-negotiables: Coffee in the morning, pizza Friday nights
Family history: Father had type 2 diabetes diagnosed at 55
Social context: Partnered, 2 kids (3 and 7), dog

═══ DERIVE FROM CONTEXT ═══
- Target bedtime = desired wake time - 8.5 hours
- Morning exercise window = wake time + 30 min to work start - 15 min commute
- Eating window = align with work schedule + sleep target
- Given family diabetes history: prioritize glucose interventions EVEN IF HbA1c is OK
- Given parenting: realistic time budget, meal prep efficient
- Given "pizza Friday" rule: include flex strategy, not demand elimination
```

**Pain point block:**
Ask for current pain points in onboarding. Pass them to prompt:
```
═══ CURRENT PAIN POINTS (address directly) ═══
1. Afternoon energy crash (2-4 PM)
2. Can't fall asleep until midnight despite trying
3. Lower back stiffness morning
4. Brain fog in meetings
5. Weight creep past 2 years
```

### 4.2 — Protocol output additions

Add these new JSON fields to master-prompt output:

**painPointSolutions:**
```json
"painPointSolutions": [
  {
    "problem": "Afternoon energy crash 2-4 PM",
    "likely_cause": "Post-lunch glucose spike + insufficient protein breakfast",
    "solution": "Shift breakfast to higher protein (35g+), add 10-min walk after lunch, avoid refined carbs at lunch, small magnesium dose at 2 PM",
    "expected_timeline": "Improvements within 1 week, full resolution 3-4 weeks"
  }
]
```

**flexRules:**
```json
"flexRules": [
  {
    "scenario": "Friday pizza night (non-negotiable)",
    "strategy": "20-min walk before + 15-min walk after. Berberine 500mg with meal. Extended 14-hour overnight fast Saturday."
  }
]
```

**weekByWeekPlan:**
Current roadmap has themes. Expand to WEEK-BY-WEEK concrete actions:
```json
"weekByWeekPlan": [
  { "week": 1, "focus": "Foundation", 
    "mondayActions": ["Start Vitamin D3 4000 IU with breakfast", "Walk 5000 steps target"],
    "wednesdayActions": ["First strength session 30 min"],
    "fridayActions": ["Friday flex night — stick to 1 slice plan"],
    "sundayActions": ["Review week, plan ahead"],
    "endOfWeekCheck": ["Did I hit 5x walking target?", "Sleep improved?"]
  }
]
```

### 4.3 — Dashboard: New protocol sections to render

Add to dashboard:
- **Pain Point Solutions** — dedicated section after Diagnostic Hero
- **Flex Rules** — concrete strategies for their weak spots
- **Protocol Adherence Score** — weighted score of how well their lifestyle aligns with protocol
- **Next 7 Days** — calendar view of specific actions for this week
- **Questions for Doctor** — ready-to-print list for next appointment

---

## PART 5 — NEW FEATURES TO BUILD (BEYOND FIXES)

### 5.1 — AI Chat Assistant
New page `/chat`. Context-aware conversation:
- Knows your full profile, biomarkers, protocol
- Uses Groq for speed
- Can answer: "Why NAC?", "Can I take curcumin with my metformin?", "My headache got worse, any ideas?"
- System prompt loaded with full user context

### 5.2 — Daily Briefing (push notification ready)
Generate each morning: "Good morning! Today's focus: [top 3 actions]. Yesterday: 87% compliance. Bryan's tip: [relevant tip]."

### 5.3 — Smart Retest Reminders
Already have retest_reminders table. Build the cron + email:
- Resend API integration
- Weekly check: any reminders due in next 7 days? Send email.
- In-app banner for upcoming retests

### 5.4 — Protocol Versioning UI
Each time user regenerates, create v2, v3. Let them compare protocols side-by-side like blood tests.

### 5.5 — Wearable Data Import
Phase 2: Allow CSV import from Apple Health / Oura / WHOOP exports. Parse and populate daily_metrics.

### 5.6 — Doctor-Ready PDF Export
Current: `window.print()` works but is amateur.
Better: Generate professionally formatted PDF with:
- Patient summary header
- Biomarker table with reference ranges
- Red flags section
- Supplement list with interactions noted
- Signature line for doctor

Use `@react-pdf/renderer` or similar. Save to Supabase Storage.

### 5.7 — Referral System
Share link with referral tracking. First user gets 1 month Pro free when 3 friends sign up.

---

## PART 6 — UI POLISH ITEMS

### 6.1 — Onboarding improvements
- Each step shows estimated time remaining
- Can go back AND preserve data
- "Skip for now" on non-essential fields
- Auto-focus first input of each step
- Enter key moves to next field
- Validation messages inline (not just disable button)

### 6.2 — Dashboard polish
- Count-up animation on bio age / score on mount
- Sticky table of contents sidebar on desktop
- Collapsible sections (save preferences to localStorage)
- Share individual sections (not just whole protocol)
- Dark mode toggle (optional — some prefer light for PDF export)

### 6.3 — Print/PDF improvements
Current `@media print` works but:
- Page breaks between major sections
- Repeating page header with user name + date
- Page numbers
- Remove interactive elements completely
- Better table formatting

### 6.4 — Mobile improvements
- Swipe gestures on tracking checkboxes
- Haptic feedback on completion
- Pull-to-refresh on dashboard
- Bottom sheet modals instead of dropdowns

### 6.5 — Accessibility
- ARIA labels on all interactive elements
- Keyboard navigation for all buttons
- Focus visible states
- Color contrast audit (some muted text fails WCAG AA)

---

## PART 7 — EXACT IMPLEMENTATION ORDER

### SPRINT 1 — FIX THE LIES (critical bugs, 1 day)
Priority: tracking must stop showing fake data.

```
1. Create /api/compliance/history endpoint (returns 30-day compliance)
2. Update tracking page to fetch real data
3. Implement calculateStreak() from real data
4. Implement calculateLongestStreak() 
5. Remove all Math.random() calls
6. Fix achievements to receive real stats
7. Add bloodTestsUploaded real count
8. Add protocolsGenerated real count
```

### SPRINT 2 — ONBOARDING EXPANSION (2-3 days)
Make it truly ask about the user's life.

```
9.  Add onboarding_data JSONB column migration (if not present)
10. Split onboarding state save to persist full form data
11. Restore form state on load if incomplete
12. Add Step 1 expansions (ethnicity, latitude, occupation, RHR)
13. Add Step 3 expansions (sleep deep-dive, diet deep-dive, exercise deep-dive, stress)
14. Add Step 3 expansions (medication rows, supplements, family history)
15. Add NEW Step 4 "Your Day-to-Day" (work schedule, routine, social context)
16. Add Step 5 expansions (primary goal, secondary goals, specific targets, pain points)
17. Collapsible deep-dive sections
18. Smart defaults and validation
```

### SPRINT 3 — TRACKING PERFECTION (2-3 days)

```
19. Create daily_metrics table migration
20. Create /api/daily-metrics endpoints (GET range + POST upsert)
21. Build tabs component (protocol / habits / metrics / trends / achievements)
22. Build Daily Habits tab with 14 universal habit toggles
23. Build Daily Metrics tab with weight/sleep/mood/energy inputs
24. Build Trends tab with 4 line/bar charts (30 days)
25. Real achievement calculation from historical data
26. Progress indicators toward next achievement
27. Streak visualization (flame animation scales with streak)
```

### SPRINT 4 — PROTOCOL DEEPENING (2-3 days)

```
28. Add pain points collection to onboarding
29. Add personal context block to master prompt
30. Add painPointSolutions output schema
31. Add flexRules output schema
32. Add weekByWeekPlan output schema
33. Update dashboard to render new sections
34. Add "Questions for Doctor" printable section
35. Protocol Adherence Score calculation from tracking data
```

### SPRINT 5 — NICE-TO-HAVES (1-2 weeks total, optional)

```
36. AI Chat assistant page
37. Email notifications via Resend
38. Professional PDF export via @react-pdf/renderer
39. Protocol versioning UI
40. Anthropic Claude as primary with Groq fallback
41. Zod validation on AI output
42. Rate limiting with @upstash/ratelimit
43. Wearable CSV import (Oura/WHOOP/Apple Health)
44. Referral system
45. Dark/light mode toggle
```

---

## PART 8 — CLAUDE CODE MEGA-PROMPT (copy-paste this)

```
Read PROTOCOL_MAKER_FINAL_PLAN.md (this file) completely.
Do not write code yet.

Tell me in 15 lines:
1. What you understood about the current state
2. Which bugs are most critical
3. Which sprint you'd start with
4. Any questions about the plan

Then wait for my "go" before starting Sprint 1.

When starting Sprint 1:
- Show me the file tree of what you'll create/modify
- Create /api/compliance/history/route.ts first
- Show me the code before applying
- Run `pnpm build` after each file to verify compilation
- Don't proceed to next file until previous verifies

Principles:
- Strict TypeScript, no `any` types
- Follow existing Tailwind patterns (rounded-2xl, bg-card, border-card-border)
- English only in UI
- Match existing font weights and sizes
- Keep components <300 lines each
- Add loading states AND error states for everything
- Test mobile view (safe-area-inset)
```

---

## FINAL NOTE

The project went from MVP to real product in the last sprint. The remaining work makes it a tool serious biohackers would pay for. Focus order:

1. **Tracking with real data** (biggest lie currently)
2. **Onboarding that truly understands the user** (more inputs = better personalization = better protocol)
3. **Protocol with pain points + flex rules + week-by-week** (makes it feel like a coach, not a document)
4. **Polish and delight** (animations, email, PDF)

Then it's Bryan-Johnson-tweetable.