# 🧬 PROTOCOL MAKER — MASSIVE IMPROVEMENT PLAN
# For Claude Code — Read this ENTIRELY before writing any code.

## CURRENT STATE ASSESSMENT

The app works end-to-end: onboarding → biomarker input → Groq generation → 
dashboard display → daily tracking. But it's a functional MVP, not a product 
Bryan Johnson would screenshot. Here's what needs to happen:

---

## 🔴 PHASE 1 — CRITICAL FIXES (do these FIRST)

### 1.1 — Switch language to ENGLISH everywhere
The entire app is in Romanian. Bryan Johnson won't use a Romanian app.
- ALL UI text → English
- Master prompt → English (Groq/Claude respond better in English anyway)
- Biomarker names and descriptions → English
- Keep RON prices and Romanian shopping sources, but UI language = English
- Add i18n later if needed (next-intl), but default = English NOW

### 1.2 — Landing page that SELLS
Current: just a login form. No landing page at all.
Build a proper landing page at `/` (unauthenticated):
HERO SECTION:
"Bryan Johnson spends $2M/year on longevity.
You have your blood panel and AI.
Get a protocol calibrated to YOUR biomarkers — not his."
[Get Started Free] button → /login
SOCIAL PROOF BAR:
"Analyzing 20+ biomarkers • 5 health patterns detected •
Protocol generated in <60 seconds • Used by X people"
HOW IT WORKS (3 steps, with icons):

Enter your blood work (2 min)
AI analyzes your biomarkers against longevity-optimal ranges
Get a personalized protocol: nutrition, supplements, exercise, sleep

BIOMARKER PREVIEW:
Show an interactive demo of the biomarker classification UI —
use Bryan Johnson's actual public values as example data.
Let visitors hover/click to see classifications WITHOUT signing up.
This is the "aha moment" that converts visitors.
COMPARISON TABLE:
"Your Protocol vs Bryan Johnson's Blueprint"
Show how the engine adapts:

Bryan: vegan, 1977 kcal → Your protocol: adapted to YOUR diet
Bryan: 100+ supplements → Your protocol: 8-15 based on YOUR gaps
Bryan: $2M/year → Your protocol: fits YOUR budget

PRICING (if applicable, or just "Free during beta")
FOOTER: Disclaimer, About, GitHub link

Design: black background, #00ff88 accent (keep current), 
Inter font, big typography, data-heavy but clean.
Think: Linear.app meets Bloomberg terminal.
NO generic wellness vibes. NO gradients. NO stock photos.

### 1.3 — Fix the onboarding UX (MAJOR overhaul)

Current problems:
- Too many steps with too many fields
- Biomarker input is painful (20 fields manually)
- No PDF upload
- Genetics step is a dead placeholder
- No progress saving (if you refresh, you lose everything)

NEW ONBOARDING FLOW:
STEP 1 — "The Basics" (30 seconds)

Age, sex, height, weight (keep these)
REMOVE: ethnicity, latitude, occupation (calculate latitude from
browser geolocation API silently, occupation doesn't affect protocol much)
Activity level: keep but make it a SLIDER not 5 buttons
ADD: "Do you have recent blood work?" → Yes/No
If No → skip to step 3 (lifestyle-only protocol)
If Yes → step 2

STEP 2 — "Your Blood Work" (the money step)
OPTION A: PDF Upload (PRIMARY — make this the default, big and obvious)

Drag-and-drop zone, beautiful, with "Supports Synevo, Regina Maria,
MedLife, LabCorp, Quest, and most lab formats"
Upload → extract text with pdf-parse → send to Groq for structured
extraction → show parsed results for user to VERIFY
Verification UI: show each detected biomarker with value,
let user correct mistakes, add missing ones

OPTION B: Manual entry (secondary, collapsed by default)

Show ONLY the "Big 11" biomarkers first (the ones Bryan tracks):
HbA1c, Fasting Glucose, Insulin, LDL, HDL, Triglycerides,
hsCRP, Vitamin D, Testosterone/Estradiol, ALT, TSH
"Show more biomarkers" expander for the other 9
Each field: show optimal range as placeholder,
show unit clearly, validate on blur
Auto-classify as they type (live green/yellow/red indicator)

OPTION C: "I don't have blood work" → Skip, get lifestyle-only protocol
Show: "Your protocol will be more accurate with blood work.
Get a basic panel at Synevo for ~150 RON."
STEP 3 — "Your Lifestyle" (45 seconds)
Condense into FEWER fields:

Sleep: hours + quality (keep)
Diet type (keep)
Exercise: just "hours per week" (don't split cardio/strength)
Substances: alcohol Y/N, caffeine Y/N, smoking Y/N (binary, not numbers)
Medical conditions (keep chips)
Current medications (keep, IMPORTANT for interactions)
Current supplements (keep)

STEP 4 — "Your Goals" (15 seconds)

Goals: keep drag-to-rank or multi-select
Budget: keep 4 tiers
Time available: keep 4 tiers
Experimental openness: keep 3 tiers
REMOVE genetics step entirely (add it later as a separate feature)

TOTAL: 4 steps, ~2-3 minutes. Save progress to Supabase after EACH step
so refreshing doesn't lose data. Show a beautiful progress bar.

### 1.4 — PDF parsing with Groq

New API route: `/api/parse-bloodwork`

Accept PDF upload (max 20MB)
Store in Supabase Storage (bucket: 'blood-panels', RLS enforced)
Extract text with pdf-parse npm package
Send extracted text to Groq (Llama 3.3 70B) with this prompt:

"You are a medical lab report parser. Extract ALL biomarker values
from this lab report text. Return ONLY a JSON array:
[
{"name": "...", "value": 123.4, "unit": "mg/dL", "code": "LDL"},
...
]
Map each biomarker to one of these codes:
HSCRP, GLUC, HBA1C, LDL, HDL, TRIG, VITD, TSH, FERRITIN, B12,
TESTO, ALT, CREAT, HOMOCYS, WBC, HGB, INSULIN, MAGNE, FOLAT, OMEGA3
If a biomarker doesn't match any code, use code 'UNKNOWN' and include
the original name. Handle Romanian lab names (TGP=ALT, TGO=AST,
Glicemie=GLUC, Hemoglobina glicata=HBA1C, Colesterol LDL=LDL, etc.)
Common Romanian lab formats: Synevo, Regina Maria, MedLife, Bioclinica."

Parse Groq response
Return to frontend for user verification
After verification → save to blood_tests table


---

## 🟡 PHASE 2 — PROTOCOL QUALITY (the thing that makes it WOW)

### 2.1 — Massively improve the master prompt

Current prompt is decent but produces generic protocols. 
NEW master prompt requirements:
SYSTEM PROMPT IMPROVEMENTS:

ADD Bryan Johnson's FULL supplement stack as reference
(not just "100+ supplements" — list the actual top 30 with doses)
ADD specific intervention-to-biomarker mapping:
"If hsCRP > 1.0: Omega-3 2-3g, Curcumin 1g, NAC 1.2g"
"If Vitamin D < 30: D3 4000-5000 IU + K2 MK-7 200mcg"
"If LDL > 130 + hsCRP > 1.5: cardiovascular risk protocol..."
Include 30+ such rules as examples for the LLM.
ADD budget-aware supplement prioritization:
Under 200 RON: ONLY D3, Omega-3, Magnesium, Creatine
200-500 RON: + K2, NAC, Curcumin, Zinc, Ashwagandha
500-1500 RON: + CoQ10, B-complex, Berberine, probiotics
1500+: full stack similar to Bryan's
ADD exercise protocol templates:

Beginner (0-2 sessions/week currently): 3 days, 30 min each
Intermediate (3-4): 4-5 days, 45-60 min
Advanced (5+): 6 days, 60-90 min, Bryan-style
Each with specific movements, sets, reps — not vague.


ADD sleep protocol depth:

Calculate ideal bedtime from wake time + 8 hours
Wind-down routine with SPECIFIC actions and times
Environment checklist (temperature, darkness, sound)
Melatonin only if sleep quality < 5/10


ADD universal tips section (NEW in output schema):
Regardless of biomarkers, EVERYONE should:

Walk 8000+ steps/day
Get morning sunlight 10-15 min
Stop eating 3+ hours before bed
Hydrate 2-3L/day
7-9 hours sleep
Strength train 2-3x/week minimum
Eat 30+ different plants per week
Floss daily
Minimize alcohol (ideally zero)
Minimize processed food
Manage stress (meditation, breathwork, journaling)


ADD the "vs Bryan" comparison in diagnostic:
For each biomarker, show:
"Your LDL: 142 mg/dL | Bryan's: 53 | Gap: 89 | Priority: HIGH"
This creates urgency and a clear target.
SWITCH from Groq to Claude Opus 4.6 for protocol generation:

Groq (Llama) for PDF parsing and quick classification (fast, cheap)
Claude Opus 4.6 for the actual protocol synthesis (deep, accurate)
This is critical — Claude produces significantly better
medical reasoning than Llama 3.3

Implementation:
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
// Use for protocol generation only
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
// Use for PDF parsing and quick lookups


### 2.2 — Expand biomarker database to 40+ markers

Add these to biomarkers.ts:
MISSING CRITICAL MARKERS:

APOB (ApoB) — better than LDL for CV risk
LPA (Lp(a)) — genetic CV risk
CORTISOL — stress/HPA axis
DHEA_S — adrenal health, aging marker
ESTRADIOL — important for both sexes
SHBG — sex hormone binding globulin
FREE_T — free testosterone (calculated)
FT3 — free T3 (thyroid)
FT4 — free T4 (thyroid)
ANTI_TPO — thyroid antibodies
GGT — liver, alcohol marker
AST — liver (TGO in Romanian)
URIC_ACID — gout, metabolic health
EGFR — kidney function (calculated from creatinine)
IRON — serum iron
TIBC — total iron binding capacity
PLT — platelets
RBC — red blood cells
HCT — hematocrit
MCH / MCV — red cell indices


For each: add longevity optimal range, Bryan's value (if public), 
and full intervention libraries.

### 2.3 — Add more pattern detectors

Add to patterns.ts:
NEW PATTERNS:

Hormonal Imbalance (low T + high cortisol + low DHEA-S)
Iron Overload (high ferritin + high iron + high transferrin sat)
Anemia Cluster (low HGB + low ferritin + low iron + high TIBC)
Liver Stress (high ALT + high AST + high GGT)
Kidney Decline (high creatinine + low eGFR + high uric acid)
Autoimmune Thyroid (high anti-TPO + abnormal TSH)
Oxidative Stress (low VITD + low omega-3 + high hsCRP + high homocysteine)
Prediabetes (HBA1C 5.7-6.4 + fasting glucose 100-125 + insulin >7)


### 2.4 — Add ProtocolOutput schema improvements

Update types.ts ProtocolOutput to include:
```typescript
// NEW SECTIONS:
universalTips: {
  category: string;  // "Movement", "Sleep", "Nutrition", "Mindset"
  tips: { tip: string; why: string; difficulty: 'easy' | 'medium' | 'hard' }[];
}[];

bryanComparison: {
  marker: string;
  yourValue: number;
  bryanValue: number;
  gap: number;
  verdict: string;  // "You're ahead", "Close", "Work needed", "Priority"
}[];

dailySchedule: {
  time: string;
  activity: string;
  category: string;
  duration: string;
  notes: string;
}[];

weeklyMealPlan: {
  day: string;
  meals: { name: string; time: string; calories: number; recipe: string }[];
}[];

costBreakdown: {
  supplements: number;
  food: number;
  equipment: number;
  testing: number;
  total: number;
  currency: string;
};
```

---

## 🟢 PHASE 3 — UI/UX PERFECTION

### 3.1 — Dashboard redesign (the showpiece)

Current dashboard is functional but plain. Redesign:
TOP HERO: Full-width card with:

Biological age (HUGE number, animated count-up on load)
Aging velocity badge ("0.72 years per calendar year")
Longevity score (circular progress ring, animated)
"You vs Bryan Johnson" mini comparison

BIOMARKER SECTION:

Replace list with interactive chart
Each biomarker: horizontal bar showing range
[CRITICAL | DEFICIENT | SUBOPTIMAL | ===OPTIMAL=== | SUBOPTIMAL | EXCESS | CRITICAL]
With YOUR dot, BRYAN's dot, and population average zone
Click to expand: full explanation + interventions
Color-coded: green/yellow/orange/red

ORGAN SYSTEM RADAR:

Keep the radar chart but make it BIGGER and more beautiful
Add organ-specific icons around it
Click each axis → drill into that system's details

SUPPLEMENT STACK:

Visual timeline: morning | with food | evening | bedtime
Each supplement as a pill-shaped badge
Drag to reorder (future)
"Total monthly cost: 340 RON" prominently displayed
Each supplement expandable: justification, eMAG link, alternatives

EXERCISE WEEKLY VIEW:

Calendar-style 7-day grid
Each day: activity icon, duration, intensity color
"This week: 180 min Zone 2, 3 strength sessions"

DAILY SCHEDULE:

NEW: vertical timeline of the entire day
05:00 — Wake up, morning light 10 min
05:15 — Supplement stack #1
06:00 — Workout (Zone 2, 45 min)
07:00 — Breakfast (Meal 1: 480 kcal)
...
22:30 — Sleep

SHOPPING LIST:

Grouped: "Buy Now" / "Add in Week 4" / "Nice to Have"
Each item: name, price, direct eMAG search URL
"Add all to cart" concept (future)
Total estimated first-month cost

12-WEEK ROADMAP:

Visual timeline (not just bullet points)
Current week highlighted
Expandable weeks with specific actions
Checkmarks for completed milestones


### 3.2 — Generating screen upgrade

Current GeneratingScreen is basic. Make it SPECTACULAR:

Full-screen dark background
DNA helix animation (CSS or simple SVG animation)
Live streaming text updates (not just spinner):
"Parsing 18 biomarkers..." (with count animating up)
"Detected pattern: Inflammatory Cluster"
"Cross-referencing 312 intervention studies..."
"Optimizing supplement stack for 500 RON budget..."
"Calibrating exercise protocol to moderate activity..."
"Your Blueprint is ready."
Progress bar that actually moves based on API streaming
Estimated time remaining
Fun fact about longevity while waiting


### 3.3 — Tracking page upgrade

Current tracking is basic checkboxes. Upgrade:

STREAK counter ("7 days in a row! 🔥")
Weekly compliance chart (bar chart, 7 days)
Monthly heatmap (GitHub-style contribution graph)
Categorized sections with progress rings per category
Smart reminders: "You haven't checked off Omega-3 today"
Historical compliance: "Last 30 days: 87% compliance"
Gamification: badges/achievements
"Perfect Week", "Supplement Streak 30", "Early Bird 7 days"
Quick-log: swipe to complete on mobile
Time-based: show only relevant items
(morning supplements in morning, sleep routine at night)


### 3.4 — Settings page

Build proper settings:

View/edit profile data
View blood test history (list of all uploads)
Regenerate protocol button
Delete account
Export data (GDPR compliance)
Change password
Notification preferences (future: email reminders)
Connected devices (future: Oura, WHOOP, Apple Health)
Subscription management (future)


### 3.5 — Share page upgrade

Generate beautiful OG image for social sharing
Public protocol view (read-only, no auth required)
"Compare with a friend" feature (side-by-side protocols)
QR code for easy mobile sharing
"Share with your doctor" PDF export
(formatted professionally with letterhead and disclaimer)


### 3.6 — Mobile PWA

Add manifest.json for PWA
Service worker for offline access to protocol
Push notifications for daily tracking reminders
"Add to Home Screen" prompt
Splash screen with logo


---

## 🔵 PHASE 4 — ADVANCED FEATURES

### 4.1 — Temporal comparison (multi-panel tracking)

When user uploads new blood work after 3 months:

Side-by-side biomarker comparison
Trend arrows (improved ↑, stable →, worsened ↓)
"What worked" analysis:
"Your hsCRP dropped from 2.1 → 0.8 after 12 weeks of
Omega-3 2g + Curcumin 1g. Keep going."
"What needs adjustment":
"Your Vitamin D only went from 22 → 31. Increase D3 from
2000 IU → 4000 IU. Add K2 MK-7 200mcg."
Auto-regenerate protocol with new data
Beautiful before/after charts


### 4.2 — Wearable integrations (future)

Apple Health / Google Fit (sleep, steps, HR)
Oura Ring (sleep stages, HRV, readiness)
WHOOP (strain, recovery, sleep)
Samsung Health (for Galaxy Watch users)
Display wearable data alongside protocol recommendations
"Your HRV trend suggests recovery is improving since
you started the sleep protocol"


### 4.3 — AI Chat assistant

Chat interface within the app
"Ask anything about your protocol"
Context-aware: knows your biomarkers, protocol, history
"Why did you recommend NAC?" → explains based on YOUR data
"Can I take curcumin with my metformin?" → checks interactions
"I can't afford CoQ10, what's an alternative?" → budget swap
Uses Groq for fast responses


### 4.4 — Doctor mode / PDF export

Professional PDF report for sharing with physician
Includes: all biomarkers with ranges, detected patterns,
recommended interventions with evidence citations,
supplement-drug interaction warnings
Clean, medical-looking format (not consumer app aesthetic)
"Prepared by Protocol AI Engine — for physician review"


---

## 🗂️ FILE STRUCTURE AFTER ALL PHASES
protocol-maker/
├── app/
│   ├── (marketing)/           # NEW — unauthenticated pages
│   │   ├── layout.tsx
│   │   ├── page.tsx           # Landing page
│   │   ├── pricing/page.tsx
│   │   └── about/page.tsx
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx    # NEW — separate signup
│   ├── (app)/
│   │   ├── layout.tsx         # With NavBar
│   │   ├── dashboard/
│   │   │   └── page.tsx       # REDESIGNED — showpiece dashboard
│   │   ├── onboarding/
│   │   │   └── page.tsx       # OVERHAULED — 4 steps, PDF upload
│   │   ├── tracking/
│   │   │   └── page.tsx       # UPGRADED — streaks, heatmap, gamification
│   │   ├── history/           # NEW — blood test history + comparison
│   │   │   └── page.tsx
│   │   ├── chat/              # NEW (Phase 4) — AI assistant
│   │   │   └── page.tsx
│   │   └── settings/
│   │       └── page.tsx       # EXPANDED
│   ├── share/
│   │   └── [slug]/page.tsx    # Public share view
│   ├── api/
│   │   ├── auth/
│   │   ├── generate-protocol/route.ts  # UPGRADED — Claude Opus
│   │   ├── parse-bloodwork/route.ts    # NEW — PDF parser
│   │   ├── save-profile/route.ts
│   │   ├── save-bloodtest/route.ts
│   │   ├── my-data/route.ts
│   │   ├── compliance/route.ts
│   │   ├── share/route.ts
│   │   ├── compare/route.ts           # NEW — temporal comparison
│   │   └── chat/route.ts             # NEW (Phase 4)
│   ├── globals.css
│   └── layout.tsx
├── components/
│   ├── landing/               # NEW
│   │   ├── Hero.tsx
│   │   ├── HowItWorks.tsx
│   │   ├── BiomarkerDemo.tsx  # Interactive demo with Bryan's data
│   │   ├── Comparison.tsx
│   │   └── Pricing.tsx
│   ├── onboarding/
│   │   ├── StepBasics.tsx
│   │   ├── StepBloodWork.tsx  # PDF upload + manual entry
│   │   ├── StepLifestyle.tsx
│   │   ├── StepGoals.tsx
│   │   └── PDFUploader.tsx    # NEW
│   ├── protocol/
│   │   ├── GeneratingScreen.tsx  # UPGRADED — spectacular animation
│   │   ├── DiagnosticHero.tsx    # NEW — bio age, score, velocity
│   │   ├── BiomarkerChart.tsx    # NEW — visual range bars
│   │   ├── RadarChart.tsx
│   │   ├── SupplementStack.tsx   # NEW — timeline view
│   │   ├── ExerciseWeek.tsx      # NEW — calendar grid
│   │   ├── DailySchedule.tsx     # NEW — vertical timeline
│   │   ├── SleepProtocol.tsx
│   │   ├── ShoppingList.tsx
│   │   ├── Roadmap.tsx           # NEW — visual timeline
│   │   ├── BryanComparison.tsx   # NEW — vs Bryan table
│   │   ├── UniversalTips.tsx     # NEW
│   │   └── CostBreakdown.tsx     # NEW
│   ├── tracking/
│   │   ├── StreakCounter.tsx     # NEW
│   │   ├── ComplianceHeatmap.tsx # NEW
│   │   ├── Achievements.tsx      # NEW
│   │   └── TrackingList.tsx
│   ├── layout/
│   │   ├── NavBar.tsx
│   │   └── Header.tsx           # NEW — top bar for desktop
│   └── ui/                      # shadcn/ui components
│       ├── button.tsx
│       ├── card.tsx
│       ├── input.tsx
│       ├── dialog.tsx
│       ├── progress.tsx
│       ├── tabs.tsx
│       └── tooltip.tsx
├── lib/
│   ├── engine/
│   │   ├── biomarkers.ts       # EXPANDED — 40+ markers
│   │   ├── classifier.ts       # IMPROVED — better algorithms
│   │   ├── patterns.ts         # EXPANDED — 10+ patterns
│   │   ├── master-prompt.ts    # MASSIVELY UPGRADED
│   │   ├── pdf-parser.ts       # NEW
│   │   └── phenoage.ts         # NEW — biological age calculation
│   ├── supabase/
│   │   ├── client.ts
│   │   └── server.ts
│   ├── hooks/
│   │   ├── useProtocol.ts      # NEW
│   │   └── useCompliance.ts    # NEW
│   └── types.ts                # EXPANDED
├── scripts/
│   ├── setup-db.sql            # UPDATED schema
│   └── seed-biomarkers.ts      # NEW — seed script
└── public/
├── manifest.json           # NEW — PWA
├── sw.js                   # NEW — service worker
└── icons/                  # NEW — PWA icons

## IMPLEMENTATION ORDER

Start with Phase 1 (critical fixes) in this exact order:
1. Switch all text to English
2. Build landing page
3. Overhaul onboarding (4 steps + PDF upload)
4. Add PDF parsing API with Groq
5. Expand biomarker DB to 40 markers
6. Improve master prompt (add Claude Opus option)
7. Add universal tips + Bryan comparison to output
8. Redesign dashboard
9. Upgrade generating screen
10. Upgrade tracking (streaks, heatmap)
11. Build settings page
12. Add PWA manifest

DO NOT skip steps. DO NOT start Phase 2 before Phase 1 is complete.
After each step, verify the app builds and works end-to-end.

## DESIGN SYSTEM (enforce throughout)

Colors:
- Background: #000000
- Card: #0a0a0a, border: #1a1a1a
- Accent: #00ff88 (electric green — Bryan's vibe)
- Text: #fafafa (primary), #a1a1aa (secondary), #71717a (muted)
- Danger: #ef4444, Warning: #f59e0b
- Optimal: #00ff88, Suboptimal: #f59e0b, Critical: #ef4444

Typography:
- Headings: Geist Sans, bold
- Body: Geist Sans, regular
- Data/numbers: Geist Mono
- Sizes: text-3xl hero, text-xl section, text-sm body, text-xs labels

Spacing:
- Cards: rounded-2xl, p-5, border border-card-border
- Buttons: rounded-xl, py-3
- Gaps: space-y-6 between sections, space-y-3 within
- Max width: max-w-3xl for content, max-w-6xl for landing

Components:
- All interactive elements: transition-all duration-200
- Hover states on everything clickable
- Active: scale-[0.98] on buttons
- Loading: skeleton shimmer, not spinners (except initial load)

Mobile-first:
- Touch targets: min 44px
- Bottom nav: 64px with safe-area-inset
- No hover-only interactions
- Swipe gestures where appropriate