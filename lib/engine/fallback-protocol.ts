// Deterministic fallback protocol — runs when both Claude + Groq fail.
// This is NOT a stub: it's a complete, coherent protocol built from the user's
// profile and classified biomarkers, using the same longevity principles the
// AI prompt enforces. Keep this file in sync with master-prompt.ts expectations.
import { BIOMARKER_DB } from './biomarkers';
import { buildPainPoints, buildFlexRules } from './personalization-fills';
import type { BiomarkerValue, UserProfile } from '@/lib/types';

export function buildFallbackProtocol(
  profile: UserProfile,
  bioAge: number,
  score: number,
  classified: BiomarkerValue[],
  patterns: { name: string; severity: string }[],
): Record<string, unknown> {
  const criticalCount = classified.filter(b => b.classification === 'CRITICAL').length;
  const isLoss = profile.goals?.some((g: string) => g.toLowerCase().includes('composition') || g.toLowerCase().includes('loss'));
  const isGain = profile.goals?.some((g: string) => g.toLowerCase().includes('athletic') || g.toLowerCase().includes('muscle'));
  const multiplier = isLoss ? 24 : isGain ? 34 : 28;
  const calories = Math.round(profile.weightKg * multiplier);
  const protein = Math.round(profile.weightKg * (isGain ? 2.2 : 1.8));
  const fat = Math.round((calories * 0.3) / 9);
  const carbs = Math.round((calories - protein * 4 - fat * 9) / 4);

  // Pull rich onboarding context for personalization
  const od = (profile as UserProfile & { onboardingData?: Record<string, unknown> }).onboardingData || {};
  const idealBedtime = (od.idealBedtime as string) || (profile as UserProfile & { bedtime?: string }).bedtime || '22:30';
  const idealWakeTime = (od.idealWakeTime as string) || (profile as UserProfile & { wakeTime?: string }).wakeTime || '06:30';
  const allergies = profile.allergies || [];
  const exercisesDone = (od.exercisesDone as string[]) || [];

  // Prefer explicit onboarding answer; fall back to inference from exercises done
  const explicitGym = od.gymAccess as 'full_gym' | 'home_gym' | 'minimal' | 'none' | undefined;
  const gymAccess: 'gym' | 'home' | 'none' =
    explicitGym === 'full_gym' ? 'gym'
    : explicitGym === 'home_gym' || explicitGym === 'minimal' ? 'home'
    : explicitGym === 'none' ? 'none'
    : exercisesDone.some(e => /weights|crossfit|gym/i.test(e)) ? 'gym'
    : exercisesDone.some(e => /calisthenics|yoga|hiit|home/i.test(e)) ? 'home'
    : 'none';

  // Daily maximums — tighter for users with metabolic/cardio risk
  const hasHighBP = patterns.some(p => /hypertension|cardio/i.test(p.name)) || (od.bloodPressureSys && Number(od.bloodPressureSys) >= 130);
  const hasGlucIssue = patterns.some(p => /metabolic|insulin|glucose/i.test(p.name));

  return {
    diagnostic: {
      biologicalAge: bioAge,
      chronologicalAge: profile.age,
      agingVelocity: score > 70 ? 'decelerated' : score > 40 ? 'normal' : 'accelerated',
      longevityScore: score,
      summary: `Based on ${classified.length} biomarkers, your longevity score is ${score}/100. ${patterns.length} health patterns detected.`,
      topWins: classified.filter(b => b.classification === 'OPTIMAL').slice(0, 3).map(b => `${b.code} is optimal at ${b.value}`),
      topRisks: patterns.slice(0, 3).map(p => p.name),
      organSystemScores: { cardiovascular: 70, metabolic: 70, hormonal: 70, inflammatory: 70, hepatic: 80, renal: 80, nutritional: 60 },
    },
    nutrition: {
      dailyCalories: calories,
      macros: { protein, carbs, fat },
      eatingWindow: '10:00 - 18:00 (8h window)',
      meals: buildFallbackMeals(profile.dietType, calories),
      mealOptions: buildFallbackMealOptions(profile.dietType, calories, allergies),
      dailyMaximums: {
        sugar_g: hasGlucIssue ? 15 : 25,
        sodium_mg: hasHighBP ? 1500 : 2300,
        saturatedFat_g: 20,
        fiber_g_min: 30,
        water_ml_min: Math.round(profile.weightKg * 35),
      },
      generalRecommendations: [
        'Eat protein FIRST at every meal — it blunts the glucose spike from carbs and signals satiety faster',
        'Hydrate 500ml on waking before any caffeine — overnight dehydration is real',
        'No liquid calories: avoid juice, sweetened coffee, and alcohol-mixed drinks',
        'Last meal 3+ hours before bed — late eating fragments deep sleep',
        'Aim 30g+ protein per meal — better muscle protein synthesis than spreading thin',
        'Eat the rainbow: 30+ different plants per week feeds gut diversity',
        'Chew each bite 20+ times — gives leptin time to signal fullness, prevents overeating',
        '5-min walk after meals — drops glucose AUC by ~20% (Diabetes Care 2016)',
        'Track first 2 weeks then stop — calibrates portions, no need to log forever',
      ],
      foodsToAdd: buildFallbackFoodsToAdd(profile.dietType),
      foodsToReduce: [
        { food: 'Processed foods', why: 'Drive inflammation and metabolic dysfunction' },
        { food: 'Refined sugar', why: 'Spikes insulin and glucose' },
        { food: 'Seed oils (sunflower, corn, soybean)', why: 'Omega-6 inflammation' },
      ],
    },
    supplements: buildFallbackSupplements(profile, classified),
    supplementsHowTo: [
      'Always swallow with 200ml+ water — never juice or coffee (tannins block absorption)',
      'Fat-soluble vitamins (D3, K2, A, E) need 10g+ fat in the same meal — taking them dry wastes 70%',
      'Magnesium glycinate at NIGHT — calming, supports sleep architecture. Magnesium oxide is mostly excreted unused',
      'Iron and calcium block each other — separate by 2 hours minimum',
      'Coffee blocks iron + zinc absorption — wait 1 hour either side of those supplements',
      'Probiotics empty stomach (30 min before food) so stomach acid doesn\'t kill the bacteria',
      'Creatine: timing doesn\'t matter, consistency does — take it the same time each day to build the habit',
      'Omega-3 with the fattiest meal of the day — boosts EPA/DHA absorption ~2-3×',
      'Don\'t mix all supplements in one shot — split AM (water-soluble), midday (fat-soluble), evening (calming)',
      'If you forget a dose, skip it — never double up. Consistency over weeks matters more than any single dose',
    ],
    exercise: {
      weeklyPlan: buildFallbackExerciseWeek(gymAccess),
      zone2Target: 150,
      strengthSessions: 3,
      hiitSessions: 1,
      dailyStepsTarget: 8000,
      gymAccess,
      warmupRoutine: [
        '5 min easy cardio (walk, bike, jump rope) to raise core temp',
        'Hip circles × 10 each direction',
        'Arm circles × 10 each direction',
        'Bodyweight squats × 10',
        'Shoulder dislocates with band/PVC × 10',
      ],
      cooldownRoutine: [
        '5 min walk to bring HR down',
        'Hamstring stretch 30s each side',
        'Hip flexor stretch 30s each side',
        'Chest doorway stretch 30s each side',
        'Box breathing 4-4-4-4 × 10 cycles',
      ],
      progressionNotes: 'Add 2.5kg or 1 rep weekly on lifts. Bump cardio duration 5 min/week until you hit 45-60 min comfortably. Deload week every 6 weeks (drop volume 40%).',
      generalRecommendations: [
        'Warm up 5 min before any heavy work — never cold sets',
        'Progressive overload is the core principle: add 2.5kg or 1 rep weekly. If you stall 2 weeks, deload and rebuild',
        'Zone 2 = nasal-breathing pace. If you\'re mouth-breathing, slow down. Use a chest strap HRM if you have one',
        'Strength BEFORE cardio if same day — protects nervous system output for lifting',
        'Sleep 8h on training days — that\'s when adaptation happens, not in the gym',
        'Rest 48h between same muscle group — pushing daily wrecks recovery',
        'Track lifts in a notebook or app — what gets measured improves',
        'Don\'t skip leg day — quads + glutes drive metabolic health more than any other muscle group',
        'Cap cardio at 300 min/week — beyond that you\'re into overtraining territory unless you\'re an athlete',
      ],
    },
    sleep: {
      targetBedtime: idealBedtime,
      targetWakeTime: idealWakeTime,
      targetDuration: computeSleepDuration(idealBedtime, idealWakeTime),
      idealBedtime,
      idealWakeTime,
      windDownRoutine: [
        { time: '-90 min', action: 'Dim all lights to <50% brightness, screens off or strict night-mode' },
        { time: '-60 min', action: 'Hot shower or bath (10 min) — body cools after, signals sleep' },
        { time: '-45 min', action: 'Magnesium glycinate 400mg + L-theanine 200mg if stressed' },
        { time: '-30 min', action: 'Read fiction (paper book) or do box breathing 5 min' },
        { time: '0 min', action: 'Lights out, room cool, phone in another room or face-down on airplane mode' },
      ],
      environment: [
        { item: 'Temperature 18-20°C', why: 'Core body temp must drop ~1°C to fall asleep — cool room is essential' },
        { item: 'Total darkness (blackout curtains or sleep mask)', why: 'Even small light hits the optic nerve and suppresses melatonin' },
        { item: 'Quiet or white noise machine', why: 'Random sounds cause unremembered micro-arousals' },
      ],
      bedroomChecklist: [
        { item: 'Blackout curtains OR a quality sleep mask', why: 'Eliminates streetlight bleed; deepens REM' },
        { item: 'Room temperature 18-20°C (64-68°F)', why: 'Cool air helps core body temp drop — required to fall AND stay asleep' },
        { item: 'No phone in bedroom (or airplane mode + face-down across the room)', why: 'Removes 3 AM scroll temptation; eliminates notification disruption' },
        { item: 'White noise machine or earplugs if any street noise', why: 'Random sounds cause micro-arousals you don\'t remember' },
        { item: 'Bedroom for sleep + sex only (not work, not Netflix)', why: 'Trains brain to associate the room with shutdown' },
        { item: 'Mouth tape if snoring (cheap test before sleep study)', why: 'Forces nasal breathing; can dramatically improve quality' },
        { item: 'Mattress + pillow correct for your sleep posture', why: 'Pain wakes you mid-cycle; if you wake up sore, the bed is wrong' },
      ],
      supplementsForSleep: profile.sleepQuality && profile.sleepQuality < 6 ? ['Magnesium Glycinate 400mg', 'L-Theanine 200mg if stressed', 'Glycine 3g'] : [],
      morningLightMinutes: 10,
      morningRoutine: [
        '10 min direct sunlight (no sunglasses) within 30 min of waking — anchors circadian',
        'Hydrate 500ml water with pinch of sea salt + lemon',
        'Box breathing 4-4-4-4 × 5 cycles to wake nervous system',
        'Cold water on face or 30 sec cold shower for alertness',
      ],
      caffeineLimit: profile.caffeineMgPerDay && profile.caffeineMgPerDay > 200
        ? `Currently ${profile.caffeineMgPerDay}mg/day — consider tapering to 200mg max, all before noon (caffeine half-life is 5-6h)`
        : 'Keep caffeine ≤200mg/day, last cup before noon',
      generalRecommendations: [
        'Same bedtime AND wake time within 30 min — including weekends. Circadian rhythm hates randomness',
        'No screens 90 min before bed — blue light suppresses melatonin by ~50%',
        'No food 3+ hours before bed — digestion fragments deep sleep cycles',
        'No alcohol 4+ hours before bed — collapses deep sleep by ~40% even at small amounts',
        'Caffeine cut-off ~10 hours before bed (half-life ~5-6h compounds)',
        'Get 10-30 min direct sunlight within 1h of waking — anchors circadian, improves next-night sleep',
        'Hot shower 90 min before bed — body cools after, signals sleep',
        'If you can\'t sleep in 20 min, get up and read in dim light. Don\'t lie there anxious',
        'Wear blue-light glasses after sunset if you can\'t avoid screens',
      ],
    },
    tracking: {
      daily: ['Weight (morning)', 'Sleep hours and quality', 'Steps', 'Mood/energy (1-10)'],
      weekly: ['Waist measurement', 'Workout completion'],
      retestSchedule: classified.filter(b => b.classification !== 'OPTIMAL').slice(0, 5).map(b => {
        const ref = BIOMARKER_DB.find(r => r.code === b.code);
        return { marker: ref?.shortName || b.code, weeks: ref?.retestIntervalWeeks || 12, why: `Currently ${b.classification}, retest to track improvement` };
      }),
    },
    doctorDiscussion: {
      rxSuggestions: [],
      specialistReferrals: patterns.filter(p => p.severity === 'high' || p.severity === 'critical').map(p => `Discuss ${p.name} pattern with your doctor`),
      redFlags: criticalCount > 0 ? classified.filter(b => b.classification === 'CRITICAL').map(b => {
        const ref = BIOMARKER_DB.find(r => r.code === b.code);
        return `${ref?.shortName || b.code} = ${b.value} ${b.unit} — URGENT review needed`;
      }) : [],
      testsToOrder: classified.length === 0 ? ['Full blood panel: CBC, CMP, lipids, HbA1c, TSH, Vitamin D'] : [],
    },
    costBreakdown: {
      monthlySupplements: 155,
      monthlyFood: 800,
      oneTimeEquipment: 0,
      quarterlyTesting: 400,
      totalMonthlyOngoing: 955,
      currency: 'RON',
    },
    universalTips: [
      { category: 'Movement', tips: [
        { tip: 'Walk 8,000+ steps daily', why: 'Strongest predictor of mortality — 51% reduction vs 4k steps', difficulty: 'easy' },
        { tip: 'Strength train 2-3x/week', why: 'Prevents sarcopenia, 20% mortality reduction', difficulty: 'medium' },
        { tip: 'Walk 10 min after every meal', why: 'Reduces post-meal glucose spike by 30%', difficulty: 'easy' },
      ]},
      { category: 'Sleep', tips: [
        { tip: 'Same bedtime ±30 min nightly', why: 'Sleep consistency matters as much as duration', difficulty: 'medium' },
        { tip: 'Morning sunlight 10-15 min', why: 'Anchors circadian rhythm', difficulty: 'easy' },
        { tip: 'No screens 60 min before bed', why: 'Blue light delays melatonin by 90 min', difficulty: 'hard' },
      ]},
      { category: 'Nutrition', tips: [
        { tip: 'Eat 30+ different plants per week', why: 'Microbiome diversity = metabolic health', difficulty: 'medium' },
        { tip: '2-3 tbsp olive oil daily', why: 'Polyphenols — 19% mortality reduction', difficulty: 'easy' },
        { tip: 'Minimize ultra-processed food', why: 'Strongest dietary mortality risk factor', difficulty: 'hard' },
      ]},
      { category: 'Mindset', tips: [
        { tip: 'Daily stress management (5-10 min)', why: 'Lowers cortisol 25%, improves sleep', difficulty: 'easy' },
        { tip: 'Maintain social connections', why: 'Loneliness = 15 cigarettes/day mortality', difficulty: 'medium' },
      ]},
    ],
    dailySchedule: buildFallbackDailySchedule(profile, buildFallbackSupplements(profile, classified)),
    bryanComparison: buildFallbackBryanComparison(classified),
    dailyBriefing: {
      morningPriorities: [
        'Morning sunlight 10 min + glass of water',
        'Take Vitamin D3 + K2 with breakfast',
        'Plan today\'s 8,000 steps',
      ],
      eveningReview: [
        'Did I hit my step goal?',
        'How was my energy at 2 PM?',
        'Screens off 60 min before bed — done?',
      ],
    },
    painPointSolutions: buildPainPoints(profile),
    flexRules: buildFlexRules(profile),
  };
}

function buildFallbackBryanComparison(classified: BiomarkerValue[]) {
  return classified
    .filter(b => {
      const ref = BIOMARKER_DB.find(r => r.code === b.code);
      return ref?.bryanJohnsonValue !== undefined;
    })
    .slice(0, 8)
    .map(b => {
      const ref = BIOMARKER_DB.find(r => r.code === b.code)!;
      const bryanVal = ref.bryanJohnsonValue!;
      const gap = Math.abs(b.value - bryanVal);
      const lowerBetter = ['LDL', 'TRIG', 'HSCRP', 'HOMOCYS', 'HBA1C', 'GLUC', 'INSULIN', 'ALT', 'AST', 'GGT'].includes(b.code);
      const ahead = lowerBetter ? b.value <= bryanVal : b.value >= bryanVal;
      const close = gap < (bryanVal * 0.15);
      const verdict = ahead ? 'Ahead of Bryan' : close ? 'Close to Bryan' : b.classification === 'CRITICAL' || b.classification === 'DEFICIENT' || b.classification === 'EXCESS' ? 'Priority gap' : 'Work needed';
      return { marker: ref.shortName || ref.name, yourValue: b.value, bryanValue: bryanVal, gap, verdict };
    });
}

type ScheduleEntry = {
  time: string;
  activity: string;
  category: string;
  duration: string;
  notes: string;
  isBlock?: boolean;
  anchorRef?: string;
};
type SupplementEntry = {
  name: string;
  dose: string;
  timing: string;
  timeOfDay?: 'morning' | 'lunch' | 'afternoon' | 'evening' | 'bedtime';
  anchorMeal?: string;
  whyThisTime?: string;
};

// Build a rich 15-25 entry schedule that includes EVERY supplement at its
// explicit time, plus meals, movement breaks, exercise, wind-down, bedtime.
// Supplements that share a timing get stacked into one entry (saves clutter
// and gives the user a realistic "take these 3 together" prompt).
function buildFallbackDailySchedule(profile: UserProfile, supplements: Array<Record<string, unknown>>) {
  const od = (profile as UserProfile & { onboardingData?: Record<string, unknown> }).onboardingData || {};
  const wakeTime = (od.idealWakeTime as string) || profile.wakeTime || '07:00';
  const idealBed = (od.idealBedtime as string) || profile.bedtime || '22:30';

  const fmt = (h: number, m = 0) => `${String((h + 24) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  const parse = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return { h: Number.isFinite(h) ? h : 7, m: Number.isFinite(m) ? m : 0 };
  };
  const w = parse(wakeTime);
  const b = parse(idealBed);

  const workStart = (profile.workStart as string) || (od.workStart as string) || '';
  const workEnd = (profile.workEnd as string) || (od.workEnd as string) || '';
  const scheduleType = od.scheduleType as 'school' | 'work' | 'both' | 'freelance' | 'none' | undefined;
  const isStudent = scheduleType === 'school' || scheduleType === 'both' || (!scheduleType && (profile.age || 30) < 22);
  const noSchedule = scheduleType === 'none';
  const blockLabel = scheduleType === 'school' ? 'School' : scheduleType === 'both' ? 'School + work' : scheduleType === 'freelance' ? 'Focus block' : 'Work';
  const blockCategory = isStudent ? 'school' : 'work';

  // Group supplements by their `timing` (HH:MM) so multiple get combined
  const supsByTime: Record<string, SupplementEntry[]> = {};
  for (const s of supplements as SupplementEntry[]) {
    const t = (s.timing && /^\d{2}:\d{2}$/.test(s.timing)) ? s.timing : '07:30';
    if (!supsByTime[t]) supsByTime[t] = [];
    supsByTime[t].push({ ...s, timing: t });
  }

  const schedule: ScheduleEntry[] = [];

  // ── MORNING ────────────────────────────────────────────────────────────
  schedule.push({ time: fmt(w.h, w.m), activity: 'Wake up', category: 'wake', duration: '0 min', notes: 'Stay off phone for 10 min. No caffeine yet.' });
  schedule.push({
    time: fmt(w.h, w.m + 2),
    activity: 'FASTED measurements — before water + food',
    category: 'tracking',
    duration: '5 min',
    notes: 'Weight + body fat + muscle + visceral fat + body water + basal body temp + antioxidants + morning BP + resting HR. All readings are most accurate fasted — water alone changes weight 0.5-1kg and BIA body-fat by 2-3%.',
  });
  schedule.push({ time: fmt(w.h, w.m + 8), activity: '500ml water (first hydration)', category: 'hydration', duration: '2 min', notes: 'Pinch of sea salt + lemon optional — replaces overnight sodium loss.' });
  schedule.push({ time: fmt(w.h, w.m + 15), activity: 'Morning sunlight walk', category: 'mindset', duration: '10 min', notes: 'Anchors circadian; improves night-time melatonin secretion. No sunglasses for first 10 min.' });
  schedule.push({ time: fmt(w.h + 1), activity: 'Breakfast — protein-forward (≥30g)', category: 'meal', duration: '20 min', notes: 'Eat protein first — blunts glucose spike. 3 eggs + oats + berries is a strong default.' });

  // ── SUPPLEMENT BLOCKS — merge per-time ─────────────────────────────────
  for (const time of Object.keys(supsByTime).sort()) {
    const items = supsByTime[time];
    const [hh, mm] = time.split(':').map(Number);
    const names = items.map(s => `${s.name} ${s.dose}`).join(' + ');
    const firstWhy = items[0]?.whyThisTime || 'See supplement card for mechanism.';
    const bucket = items[0]?.timeOfDay || 'morning';
    // Skip if this is extremely close to wake/breakfast/bedtime events already handled
    const isMorning = bucket === 'morning';
    const isBedtime = bucket === 'bedtime';
    schedule.push({
      time: fmt(hh, mm),
      activity: `Take: ${names}`,
      category: 'supplements',
      duration: '2 min',
      notes: firstWhy + (items.length > 1 ? ` (${items.length} items stacked at this time)` : ''),
      anchorRef: items[0]?.name,
    });
    // Hydration anchor after morning supplement block
    if (isMorning && !schedule.some(e => e.category === 'hydration')) {
      schedule.push({ time: fmt(hh, mm + 5), activity: 'Hydrate 300ml water', category: 'hydration', duration: '1 min', notes: '' });
    }
    // Wind-down start anchor before bedtime supplements
    if (isBedtime && !schedule.some(e => e.category === 'wind-down')) {
      schedule.push({ time: fmt(hh, mm - 30), activity: 'Wind-down — dim lights, screens off', category: 'wind-down', duration: '30 min', notes: 'Read fiction, stretch, talk with family. No blue light.' });
    }
  }

  // ── WORK/SCHOOL BLOCK ──────────────────────────────────────────────────
  if (workStart && workEnd && !noSchedule) {
    schedule.push({ time: `${workStart} - ${workEnd}`, activity: blockLabel, category: blockCategory, duration: '', notes: 'Stand + walk 5 min every hour. Ergonomic posture check every 2h.', isBlock: true });
    // Mid-morning movement reminder
    const [wsH] = workStart.split(':').map(Number);
    schedule.push({ time: fmt(wsH + 2), activity: 'Movement break — 5 min walk', category: 'movement-break', duration: '5 min', notes: 'Fight the sitting — lymphatic + glucose reset.' });
  }

  // ── MIDDAY ─────────────────────────────────────────────────────────────
  schedule.push({ time: '13:00', activity: 'Lunch — biggest meal', category: 'meal', duration: '30 min', notes: '10 min walk after — drops post-prandial glucose ~20%.' });
  schedule.push({ time: '13:40', activity: 'Post-lunch walk', category: 'movement-break', duration: '10 min', notes: 'Glucose AUC -20% per Diabetes Care 2016.' });

  // ── AFTERNOON SNACK (optional, only if long workday) ──────────────────
  if (workEnd && workEnd >= '17:00') {
    schedule.push({ time: '15:30', activity: 'Snack — protein + fat (handful of nuts + yogurt)', category: 'snack', duration: '5 min', notes: 'Bridges the energy dip; keeps dinner portion controlled.' });
  }

  // ── EXERCISE ───────────────────────────────────────────────────────────
  const exerciseHour = profile.exerciseWindow === 'morning' ? Math.max(w.h - 1, 5)
                      : profile.exerciseWindow === 'lunch' ? 12
                      : 17;
  if (profile.exerciseWindow !== 'morning' || !workStart) {
    schedule.push({ time: fmt(exerciseHour), activity: 'Exercise — see weekly plan', category: 'exercise', duration: '45 min', notes: 'Warm up 5 min. Progressive overload weekly.', isBlock: true });
  }

  // ── EVENING ────────────────────────────────────────────────────────────
  const dinnerH = b.h - 3;
  schedule.push({ time: fmt(dinnerH), activity: 'Dinner — lighter, lower-carb', category: 'meal', duration: '30 min', notes: 'Last meal 3h+ before bed for clean overnight digestion + deep sleep.' });

  // Ensure wind-down + bedtime exist even without bedtime supplements
  if (!schedule.some(e => e.category === 'wind-down')) {
    schedule.push({ time: fmt(b.h - 1, 30), activity: 'Wind-down — dim lights, screens off', category: 'wind-down', duration: '60 min', notes: 'Read fiction, stretch. No blue light after sunset.' });
  }
  schedule.push({ time: fmt(b.h, b.m - 10), activity: 'Sleep hygiene — room 18-20°C, phone out of bedroom, blackout', category: 'wind-down', duration: '5 min', notes: 'Single highest-ROI sleep upgrade is room temperature.' });
  schedule.push({ time: fmt(b.h, b.m), activity: 'Lights out — bed', category: 'sleep', duration: computeSleepDuration(idealBed, wakeTime), notes: '18-20°C, total darkness, phone in another room.' });

  // Dedupe if two entries share the same time + activity
  const seen = new Set<string>();
  const deduped = schedule.filter(e => {
    const k = `${e.time}|${e.activity}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  deduped.sort((a, c) => {
    const aTime = a.time.split(' - ')[0];
    const cTime = c.time.split(' - ')[0];
    return aTime.localeCompare(cTime);
  });
  return deduped;
}

function buildFallbackMeals(dietType: string, calories: number) {
  const pct = (x: number) => Math.round(calories * x);

  if (dietType === 'vegan') {
    return [
      { name: 'Breakfast', time: '10:00', calories: pct(0.3), description: 'Plant protein + complex carbs + healthy fats', recipe: 'Tofu scramble 150g, oats 60g, berries 100g, walnuts 30g, chia 1 tbsp' },
      { name: 'Lunch', time: '13:00', calories: pct(0.4), description: 'Legume bowl with grains and roasted vegetables', recipe: 'Black lentils 80g dry, quinoa 60g dry, roasted broccoli + cauliflower 200g, tahini 2 tbsp, olive oil 1 tbsp' },
      { name: 'Dinner', time: '17:30', calories: pct(0.3), description: 'Tempeh or tofu stir-fry with greens', recipe: 'Tempeh 150g, brown rice 80g dry, mixed greens, ginger-soy sauce, avocado half' },
    ];
  }
  if (dietType === 'vegetarian') {
    return [
      { name: 'Breakfast', time: '10:00', calories: pct(0.3), description: 'Eggs + whole grains + fruit', recipe: '3 eggs, oats 60g, berries, Greek yogurt 150g, almonds 20g' },
      { name: 'Lunch', time: '13:00', calories: pct(0.4), description: 'Legume + grain bowl with vegetables', recipe: 'Lentils 80g dry, quinoa 60g, roasted vegetables, feta 40g, olive oil' },
      { name: 'Dinner', time: '17:30', calories: pct(0.3), description: 'Halloumi or paneer with vegetables', recipe: 'Halloumi 120g, sweet potato 200g, large salad with olive oil' },
    ];
  }
  if (dietType === 'keto') {
    return [
      { name: 'Breakfast', time: '10:00', calories: pct(0.3), description: 'High-fat, zero-carb start', recipe: '3 eggs + bacon 60g, avocado half, spinach sautéed in butter' },
      { name: 'Lunch', time: '13:00', calories: pct(0.4), description: 'Fatty protein + non-starchy vegetables', recipe: 'Salmon 200g, large salad with olive oil + avocado, macadamia nuts 30g' },
      { name: 'Dinner', time: '17:30', calories: pct(0.3), description: 'Ribeye or fatty fish with leafy greens', recipe: 'Ribeye 200g, broccoli in butter, asparagus' },
    ];
  }
  if (dietType === 'carnivore') {
    return [
      { name: 'Breakfast', time: '10:00', calories: pct(0.35), description: 'Animal protein + eggs', recipe: '4 eggs, bacon 80g, liver 50g once weekly' },
      { name: 'Lunch', time: '13:00', calories: pct(0.35), description: 'Red meat with animal fat', recipe: 'Ribeye or ground beef 250g, tallow' },
      { name: 'Dinner', time: '17:30', calories: pct(0.3), description: 'Fatty fish or lamb', recipe: 'Salmon 200g or lamb chops, bone broth' },
    ];
  }
  if (dietType === 'mediterranean') {
    return [
      { name: 'Breakfast', time: '10:00', calories: pct(0.3), description: 'Greek-style breakfast', recipe: 'Greek yogurt 200g, berries, walnuts, olive oil drizzle, whole-grain bread 1 slice' },
      { name: 'Lunch', time: '13:00', calories: pct(0.4), description: 'Fish + legumes + vegetables', recipe: 'Sardines or grilled fish 150g, chickpeas 100g, Greek salad, olive oil 2 tbsp' },
      { name: 'Dinner', time: '17:30', calories: pct(0.3), description: 'Lean protein + whole grains', recipe: 'Grilled chicken 150g or fish, farro 80g, roasted vegetables' },
    ];
  }
  return [
    { name: 'Breakfast', time: '10:00', calories: pct(0.3), description: 'Protein + complex carbs + healthy fats', recipe: '3 eggs, oats 60g, berries, almonds 20g' },
    { name: 'Lunch', time: '13:00', calories: pct(0.4), description: 'Main meal: lean protein + vegetables + complex carbs', recipe: 'Chicken 200g, rice 150g, broccoli, olive oil 1 tbsp' },
    { name: 'Dinner', time: '17:30', calories: pct(0.3), description: 'Light protein + vegetables', recipe: 'Salmon 150g, sweet potato 200g, large green salad' },
  ];
}

function buildFallbackMealOptions(dietType: string, dailyCalories: number, allergies: string[]) {
  const cal = (pct: number) => Math.round(dailyCalories * pct);
  const skip = (foods: string[], opts: { name: string }[]) =>
    opts.filter(o => !foods.some(f => o.name.toLowerCase().includes(f)));

  const isPlant = dietType === 'vegan' || dietType === 'vegetarian';
  const noEggs = allergies.some(a => /egg/i.test(a));
  const noDairy = allergies.some(a => /dairy|lactose/i.test(a)) || dietType === 'vegan';
  const noGluten = allergies.some(a => /gluten|wheat/i.test(a));

  const breakfast = [
    !isPlant && !noEggs ? { name: '3 eggs + smashed avocado on rye', description: 'High-protein anchor; keeps you full until lunch', calories: cal(0.25), protein_g: 22, carbs_g: 25, fat_g: 22, fiber_g: 8, sugar_g: 3, sodium_mg: 450, prepMinutes: 8, ingredients: ['3 eggs', '½ avocado', '2 slices rye bread', 'olive oil 1 tsp'], whyForYou: 'Protein-first anchors blood sugar for the day' } : null,
    !noDairy ? { name: 'Greek yogurt + berries + walnuts + honey', description: 'Probiotic + polyphenols + omega-3 fats', calories: cal(0.20), protein_g: 25, carbs_g: 30, fat_g: 12, fiber_g: 7, sugar_g: 18, sodium_mg: 80, prepMinutes: 3, ingredients: ['Greek yogurt 200g', 'mixed berries 100g', 'walnuts 20g', 'raw honey 1 tsp'], whyForYou: 'Live cultures support gut microbiome diversity' } : null,
    { name: 'Overnight oats with chia + banana + almond butter', description: 'Slow carbs + plant omega-3; prep night before', calories: cal(0.22), protein_g: 14, carbs_g: 55, fat_g: 14, fiber_g: 12, sugar_g: 14, sodium_mg: 30, prepMinutes: 5, ingredients: ['oats 60g', 'chia 2 tbsp', 'banana ½', 'almond butter 1 tbsp', 'oat milk 200ml'], whyForYou: 'Beta-glucan in oats lowers LDL over weeks' },
    isPlant ? { name: 'Tofu scramble + sourdough + tomato', description: 'Plant-protein swap for eggs', calories: cal(0.25), protein_g: 24, carbs_g: 30, fat_g: 14, fiber_g: 6, sugar_g: 4, sodium_mg: 480, prepMinutes: 10, ingredients: ['firm tofu 200g', 'sourdough 2 slices', 'tomato 1', 'turmeric + black pepper'], whyForYou: 'Phytoestrogens + complete protein without animal source' } : null,
  ].filter(Boolean).slice(0, 3) as Array<{ name: string }>;

  const lunch = [
    !isPlant ? { name: 'Grilled chicken breast + quinoa + roasted veg', description: 'Lean protein anchor + complete carb + fiber', calories: cal(0.35), protein_g: 45, carbs_g: 55, fat_g: 12, fiber_g: 11, sugar_g: 6, sodium_mg: 380, prepMinutes: 25, ingredients: ['chicken breast 200g', 'quinoa 80g dry', 'broccoli + peppers 200g', 'olive oil 1 tbsp'], whyForYou: 'Quinoa is a complete protein and pairs gluten-free with chicken' } : null,
    !isPlant ? { name: 'Wild salmon + sweet potato + dark greens', description: 'Omega-3 EPA/DHA + complex carb + nitrates', calories: cal(0.35), protein_g: 38, carbs_g: 50, fat_g: 18, fiber_g: 9, sugar_g: 12, sodium_mg: 320, prepMinutes: 20, ingredients: ['salmon 180g', 'sweet potato 200g', 'kale 100g', 'lemon + olive oil'], whyForYou: 'Salmon hits Omega-3 Index targets faster than any supplement' } : null,
    { name: 'Lentil + chickpea power bowl', description: 'Plant protein, fiber, sustained energy', calories: cal(0.35), protein_g: 28, carbs_g: 75, fat_g: 14, fiber_g: 18, sugar_g: 8, sodium_mg: 420, prepMinutes: 15, ingredients: ['lentils 80g cooked', 'chickpeas 100g', 'mixed veg 200g', 'tahini 1 tbsp', 'lemon'], whyForYou: 'Soluble fiber drops LDL and feeds gut bacteria' },
    isPlant ? { name: 'Tempeh stir-fry with brown rice', description: 'Fermented plant protein; gut-friendly', calories: cal(0.35), protein_g: 32, carbs_g: 65, fat_g: 16, fiber_g: 10, sugar_g: 6, sodium_mg: 600, prepMinutes: 18, ingredients: ['tempeh 150g', 'brown rice 80g dry', 'mixed veg 250g', 'tamari + sesame oil'], whyForYou: 'Fermentation increases B12 + bioavailable amino acids' } : null,
  ].filter(Boolean).slice(0, 3) as Array<{ name: string }>;

  const dinner = [
    !isPlant ? { name: 'Cod or white fish + roasted vegetables', description: 'Light protein + low-cal volume; easy on digestion before bed', calories: cal(0.28), protein_g: 35, carbs_g: 30, fat_g: 10, fiber_g: 8, sugar_g: 8, sodium_mg: 280, prepMinutes: 20, ingredients: ['cod 200g', 'mixed roasted veg 300g', 'olive oil 1 tbsp', 'lemon + herbs'], whyForYou: 'White fish is light and fast-digesting — won\'t fragment sleep' } : null,
    { name: 'Veggie + bean chili (batch-cookable)', description: 'Plant-forward, fiber-rich, satisfying', calories: cal(0.28), protein_g: 22, carbs_g: 50, fat_g: 8, fiber_g: 16, sugar_g: 12, sodium_mg: 520, prepMinutes: 35, ingredients: ['kidney + black beans 200g', 'tomato sauce 200g', 'onion + pepper + garlic', 'spices'], whyForYou: 'Make a big pot Sunday, eat through the week — easy adherence' },
    !isPlant && !noDairy ? { name: 'Turkey + cauliflower mash + green beans', description: 'High-protein, low-carb if managing weight', calories: cal(0.28), protein_g: 42, carbs_g: 18, fat_g: 14, fiber_g: 8, sugar_g: 6, sodium_mg: 400, prepMinutes: 25, ingredients: ['turkey breast 200g', 'cauliflower 300g', 'butter 1 tbsp', 'green beans 150g'], whyForYou: 'Lower-carb dinner = better fasting glucose tomorrow morning' } : null,
    { name: 'Mediterranean traybake (fish OR halloumi + olives + tomatoes)', description: 'One-pan, nutrient-dense, weeknight-fast', calories: cal(0.28), protein_g: 30, carbs_g: 25, fat_g: 22, fiber_g: 7, sugar_g: 8, sodium_mg: 580, prepMinutes: 30, ingredients: ['fish or halloumi 180g', 'cherry tomatoes 200g', 'olives 50g', 'red onion + olive oil'], whyForYou: 'Mediterranean pattern has the strongest mortality data' },
  ].filter(Boolean).slice(0, 3) as Array<{ name: string }>;

  const snacks = [
    { name: 'Apple + 2 tbsp almond butter', description: 'Fiber + healthy fat; satisfies sweet cravings', calories: 250, protein_g: 7, carbs_g: 28, fat_g: 16, fiber_g: 7, sugar_g: 19, sodium_mg: 5, prepMinutes: 1, ingredients: ['apple 1 medium', 'almond butter 2 tbsp'], whyForYou: 'Polyphenols + monounsaturated fat — slow energy release' },
    !noDairy ? { name: 'Cottage cheese + cucumber + black pepper', description: 'High-protein savory snack', calories: 180, protein_g: 22, carbs_g: 8, fat_g: 6, fiber_g: 1, sugar_g: 6, sodium_mg: 380, prepMinutes: 2, ingredients: ['cottage cheese 200g', 'cucumber ½', 'black pepper'], whyForYou: 'Slow-digesting casein keeps you satiated' } : null,
    { name: 'Hummus + raw veg sticks (carrot, pepper, celery)', description: 'Crunch + plant protein + fiber', calories: 200, protein_g: 8, carbs_g: 22, fat_g: 10, fiber_g: 7, sugar_g: 5, sodium_mg: 320, prepMinutes: 3, ingredients: ['hummus 80g', 'mixed raw veg 200g'], whyForYou: 'Chickpea fiber + raw veg — feeds gut bacteria' },
    { name: 'Hard-boiled eggs (2) + cherry tomatoes', description: 'Portable protein anywhere', calories: 180, protein_g: 14, carbs_g: 6, fat_g: 11, fiber_g: 2, sugar_g: 4, sodium_mg: 200, prepMinutes: 1, ingredients: ['2 eggs (boiled in advance)', 'cherry tomatoes 100g'], whyForYou: 'Choline from yolk supports brain + liver' },
  ].filter(Boolean).slice(0, 3) as Array<{ name: string }>;

  const stripGluten = (arr: Array<{ name: string; ingredients?: string[] }>) =>
    noGluten ? skip(['rye', 'sourdough'], arr as Array<{ name: string }>) : arr;

  return {
    breakfast: stripGluten(breakfast as Array<{ name: string; ingredients?: string[] }>),
    lunch: stripGluten(lunch as Array<{ name: string; ingredients?: string[] }>),
    dinner: stripGluten(dinner as Array<{ name: string; ingredients?: string[] }>),
    snacks: stripGluten(snacks as Array<{ name: string; ingredients?: string[] }>),
  };
}

function buildFallbackSupplements(profile: UserProfile, classified: BiomarkerValue[]) {
  const current = (profile.currentSupplements || []).map(s => s.toLowerCase());
  const has = (kw: string) => current.some(c => c.includes(kw));
  const lowVitD = classified.some(b => b.code === 'VITD' && b.classification !== 'OPTIMAL');

  // Rule-based timing map for common user-mentioned supplements — prevents
  // vague "(when you currently take it)" fallback for well-known compounds.
  const SUPP_TIMING_RULES: Array<{
    match: RegExp;
    timing: string;
    timeOfDay: 'morning' | 'lunch' | 'afternoon' | 'evening' | 'bedtime';
    anchorMeal: string;
    withFood: boolean;
    howToTake: string;
    whyThisTime: string;
  }> = [
    { match: /b[- ]?12|methylcobalamin|cyanocobalamin/i, timing: '07:30', timeOfDay: 'morning', anchorMeal: 'breakfast', withFood: true, howToTake: 'Sublingual 60 sec under tongue then swallow — absorption ~3× higher than pills.', whyThisTime: 'B12 is stimulating — morning only; taking it late disrupts sleep.' },
    { match: /b[- ]?complex/i, timing: '07:30', timeOfDay: 'morning', anchorMeal: 'breakfast', withFood: true, howToTake: 'With breakfast — B-vitamins need food to prevent mild nausea + maximize absorption.', whyThisTime: 'All B-vitamins are stimulating; never take after 14:00.' },
    { match: /zinc/i, timing: '12:30', timeOfDay: 'lunch', anchorMeal: 'lunch', withFood: true, howToTake: 'With lunch + 250ml water. Zinc picolinate/bisglycinate are best absorbed. Avoid with coffee within 1h.', whyThisTime: 'Zinc on empty stomach = nausea for most. Lunch also gives it distance from AM iron/multivitamin.' },
    { match: /iron|fier/i, timing: '10:00', timeOfDay: 'morning', anchorMeal: 'none (empty stomach)', withFood: false, howToTake: 'Empty stomach with 200ml water + vitamin C (100mg). No coffee/tea/dairy within 2h — cuts absorption 40-80%.', whyThisTime: 'Iron needs acidic empty stomach for absorption; separate from calcium/zinc by 2h.' },
    { match: /calcium|calciu/i, timing: '18:30', timeOfDay: 'evening', anchorMeal: 'dinner', withFood: true, howToTake: 'Split doses ≤500mg per serving. Take with dinner — never with iron (blocks each other).', whyThisTime: 'Split across meals; evening dose helps overnight bone remodeling.' },
    { match: /ashwagandha/i, timing: '20:30', timeOfDay: 'evening', anchorMeal: 'dinner', withFood: true, howToTake: 'KSM-66 or Sensoril extract 300-600mg with dinner. Consistency over 4-6 weeks for full cortisol benefit.', whyThisTime: 'Lowers evening cortisol + improves sleep onset — not stimulating, ideal evening use.' },
    { match: /l[- ]?theanine|theanine/i, timing: '21:30', timeOfDay: 'bedtime', anchorMeal: 'bedtime', withFood: false, howToTake: '200mg sublingual or capsule 60 min before bed. Pairs synergistically with magnesium glycinate.', whyThisTime: 'Boosts GABA + alpha-waves without sedation — enables sleep onset without drowsiness next day.' },
    { match: /coq10|ubiquinol/i, timing: '08:00', timeOfDay: 'morning', anchorMeal: 'breakfast', withFood: true, howToTake: 'Ubiquinol form (100-200mg) with fatty meal — it is fat-soluble. Dry stomach wastes it.', whyThisTime: 'Mitochondrial support for daytime energy; taking at night can disrupt sleep.' },
    { match: /nac|n-acetyl/i, timing: '16:00', timeOfDay: 'afternoon', anchorMeal: 'none (empty stomach)', withFood: false, howToTake: 'Empty stomach 600-1200mg. Smells of sulfur — unavoidable. With 300ml water.', whyThisTime: 'Glutathione precursor; afternoon dose matches daytime oxidative load without disrupting sleep.' },
    { match: /curcumin|turmeric|curcuma/i, timing: '18:30', timeOfDay: 'evening', anchorMeal: 'dinner', withFood: true, howToTake: 'With dinner + black pepper (piperine) + 10g+ fat. Without piperine, absorption is <1%.', whyThisTime: 'Dinner has highest fat; anti-inflammatory effect works overnight on joints/vascular tissue.' },
    { match: /probiotics?|probiot/i, timing: '10:30', timeOfDay: 'morning', anchorMeal: 'none (empty stomach)', withFood: false, howToTake: 'Empty stomach between meals, 20+ billion CFU, refrigerated brands only. Store in fridge.', whyThisTime: 'Empty stomach = less acid to kill bacteria during transit.' },
    { match: /collagen/i, timing: '15:00', timeOfDay: 'afternoon', anchorMeal: 'none (empty stomach)', withFood: false, howToTake: 'Mix 10-20g hydrolyzed peptides in water or coffee. Type I + III for skin/joints.', whyThisTime: 'Any time works but AFT tea/coffee adds habit anchor.' },
    { match: /ashwag|rhodiola/i, timing: '07:30', timeOfDay: 'morning', anchorMeal: 'breakfast', withFood: true, howToTake: 'Rhodiola 200-400mg with breakfast. Start 4 weeks, assess.', whyThisTime: 'Rhodiola is stimulating — morning only.' },
    { match: /5[- ]?htp|tryptophan/i, timing: '21:30', timeOfDay: 'bedtime', anchorMeal: 'bedtime', withFood: false, howToTake: '100-200mg 30-60 min before bed, empty stomach. NOT if on SSRIs/MAOIs.', whyThisTime: 'Serotonin precursor → melatonin; takes 30-60 min to cross BBB.' },
    { match: /melatonin|melatonina/i, timing: '21:30', timeOfDay: 'bedtime', anchorMeal: 'bedtime', withFood: false, howToTake: 'Start with 0.3mg (not 5mg). Sublingual 30 min before bed.', whyThisTime: 'Pharmacologic doses suppress endogenous production; micro-dose is all that works.' },
    { match: /protein|whey|casein/i, timing: '10:30', timeOfDay: 'morning', anchorMeal: 'post-workout', withFood: false, howToTake: 'Mix 25-40g in 300ml water or milk. Within 2h of workout is the synthesis window.', whyThisTime: 'Post-workout MPS window.' },
    { match: /pre[- ]?workout/i, timing: '16:30', timeOfDay: 'afternoon', anchorMeal: 'pre-workout', withFood: false, howToTake: '20-30 min before training, with 300ml water. Cap caffeine at 200mg.', whyThisTime: 'Peak stimulant effect aligns with workout window.' },
  ];

  function inferTiming(name: string): {
    timing: string; timeOfDay: 'morning' | 'lunch' | 'afternoon' | 'evening' | 'bedtime';
    anchorMeal: string; withFood: boolean; howToTake: string; whyThisTime: string;
  } {
    for (const rule of SUPP_TIMING_RULES) if (rule.match.test(name)) return rule;
    // Safe default: morning with breakfast
    return {
      timing: '07:30',
      timeOfDay: 'morning',
      anchorMeal: 'breakfast',
      withFood: true,
      howToTake: `Take with breakfast + 250ml water. If it causes nausea on empty stomach, always pair with food.`,
      whyThisTime: 'Morning with food is the safest default — adjust after 2 weeks if your body reacts differently.',
    };
  }

  const stack: Array<Record<string, unknown>> = [
    {
      name: 'Vitamin D3 + K2-MK7',
      dose: lowVitD ? '5000 IU D3 + 200mcg K2' : '4000 IU D3 + 200mcg K2',
      timing: '07:30',
      timeOfDay: 'morning',
      anchorMeal: 'breakfast',
      form: 'softgel',
      withFood: true,
      withWaterMl: 250,
      howToTake: 'Swallow with 250ml water + a fatty meal (10g+ fat) — D3 and K2 are fat-soluble, dry stomach wastes 70% of dose.',
      whyThisTime: 'D3 morning aligns with natural diurnal rhythm; K2 prevents arterial calcification + directs calcium to bones.',
      alreadyTaking: has('d3') || has('vitamin d') || has('vit d'),
      justification: lowVitD ? 'Your vitamin D is below optimal. D3 4000-5000 IU + K2 directs calcium to bones (not arteries). 70% of Europeans are deficient.' : 'Foundation for immunity, bone density, hormones. K2 prevents arterial calcification. Bryan takes 5000 IU D3.',
      interactions: [],
      monthlyCostRon: 40,
      priority: 'MUST',
      emagSearchQuery: 'Vitamin D3 K2 5000 IU',
      stackWithOthers: ['Omega-3 EPA/DHA'],
    },
    {
      name: 'Omega-3 EPA/DHA',
      dose: '2g EPA+DHA combined daily',
      timing: '18:30',
      timeOfDay: 'evening',
      anchorMeal: 'dinner',
      form: 'triglyceride form softgel',
      withFood: true,
      withWaterMl: 250,
      howToTake: 'Take with the fattiest meal of the day — boosts EPA/DHA absorption ~2-3×. Refrigerate to prevent oxidation.',
      whyThisTime: 'Dinner is typically highest-fat meal; fat co-ingestion multiplies EPA/DHA bioavailability.',
      alreadyTaking: has('omega') || has('fish oil'),
      justification: 'Reduces systemic inflammation (target hsCRP <1). Cardiovascular protection. Aim Omega-3 Index >8% (current Western avg 4-5%).',
      interactions: ['Mild blood-thinning effect — discuss with doctor if on warfarin/NOACs'],
      monthlyCostRon: 60,
      priority: 'MUST',
      emagSearchQuery: 'Omega 3 EPA DHA triglyceride',
    },
    {
      name: 'Magnesium Glycinate',
      dose: '400mg elemental',
      timing: '21:30',
      timeOfDay: 'bedtime',
      anchorMeal: 'bedtime',
      form: 'capsule (glycinate, NOT oxide)',
      withFood: false,
      withWaterMl: 250,
      howToTake: 'Take with 250ml water 30-60 min before bed. Glycinate form is calming + bioavailable. Avoid oxide form — mostly excreted unused.',
      whyThisTime: 'Glycine (from glycinate) supports GABA activity + lowers core body temp for sleep onset. Never AM — defeats the point.',
      alreadyTaking: has('magnesium') || has('magneziu'),
      justification: '300+ enzymatic reactions. Sleep architecture, stress, muscle recovery. Glycinate calms; citrate moves bowels.',
      interactions: ['Take 2h apart from antibiotics + bisphosphonates'],
      monthlyCostRon: 30,
      priority: 'MUST',
      emagSearchQuery: 'Magnesium glycinate 400mg',
      stackWithOthers: ['L-Theanine'],
    },
    {
      name: 'Creatine Monohydrate',
      dose: '5g daily',
      timing: '08:00',
      timeOfDay: 'morning',
      anchorMeal: 'breakfast',
      form: 'micronized powder',
      withFood: false,
      withWaterMl: 300,
      howToTake: 'Mix 5g in 300ml water or smoothie with breakfast. Same time each day to build habit. No loading phase needed.',
      whyThisTime: 'Consistency matters more than timing — morning anchors it to an unbreakable routine.',
      alreadyTaking: has('creatine'),
      justification: 'Most-studied supplement. Strength +5-15%, cognition (especially under sleep deprivation), longevity signals.',
      interactions: [],
      monthlyCostRon: 25,
      priority: 'STRONG',
      emagSearchQuery: 'Creatine monohydrate micronized',
    },
  ];

  const known = stack.map(s => (s.name as string).toLowerCase());
  for (const cs of profile.currentSupplements || []) {
    if (!cs) continue;
    if (known.some(k => cs.toLowerCase().includes(k.split(' ')[0].toLowerCase()))) continue;
    // Infer timing from name rather than dumping a vague "anytime" placeholder
    const t = inferTiming(cs);
    stack.push({
      name: cs,
      dose: '(your current dose)',
      timing: t.timing,
      timeOfDay: t.timeOfDay,
      anchorMeal: t.anchorMeal,
      form: '',
      withFood: t.withFood,
      withWaterMl: 250,
      howToTake: t.howToTake,
      whyThisTime: t.whyThisTime,
      alreadyTaking: true,
      justification: `You're already taking ${cs} — kept in the stack. The timing here follows evidence-based rules for this compound; adjust if your doctor advised differently.`,
      interactions: [],
      monthlyCostRon: 0,
      priority: 'OPTIONAL',
      emagSearchQuery: cs,
    });
  }

  return stack;
}

function buildFallbackExerciseWeek(gymAccess: 'gym' | 'home' | 'none') {
  if (gymAccess === 'home') {
    return [
      { day: 'Monday',    activity: 'Push (calisthenics)', exercises: ['Push-ups 4×AMRAP', 'Pike push-ups 3×8-10', 'Dips on chair 3×10', 'Plank 3×60s'], duration: '40 min', intensity: 'Moderate', notes: 'Substitute pike push-ups for shoulder press' },
      { day: 'Tuesday',   activity: 'Zone 2 cardio (walk/bike)', exercises: ['Brisk walk OR easy bike 45 min'], duration: '45 min', intensity: 'Zone 2', notes: 'Nasal-breathing pace; chat-able' },
      { day: 'Wednesday', activity: 'Pull + Legs (calisthenics)', exercises: ['Pull-ups or rows 4×AMRAP', 'Bulgarian split squat 3×10', 'Glute bridge 3×15', 'Hollow body hold 3×30s'], duration: '45 min', intensity: 'Moderate', notes: 'Use door-frame bar or backpack for resistance' },
      { day: 'Thursday',  activity: 'Zone 2 cardio', exercises: ['Walk/bike 45 min'], duration: '45 min', intensity: 'Zone 2', notes: '' },
      { day: 'Friday',    activity: 'Full body + HIIT finisher', exercises: ['Burpees 5×30s', 'Mountain climbers 5×30s', 'Air squats 3×20', 'Push-ups 3×AMRAP'], duration: '40 min', intensity: 'High', notes: '4 min HIIT after main work' },
      { day: 'Saturday',  activity: 'Long walk or hike', exercises: ['60-90 min outdoor walk'], duration: '60+ min', intensity: 'Zone 2', notes: 'Sunlight + nature compounds the benefit' },
      { day: 'Sunday',    activity: 'Mobility + recovery', exercises: ['10 min foam roll', 'Yoga flow 20 min', 'Box breathing 5 min'], duration: '30 min', intensity: 'Recovery', notes: 'Deload weekly volume here' },
    ];
  }
  if (gymAccess === 'gym') {
    return [
      { day: 'Monday',    activity: 'Upper body strength', exercises: ['Bench press 4×6-8', 'Pull-ups or lat pulldown 4×6-10', 'OHP 3×8', 'Barbell row 3×8', 'Curls + tricep ext 3×12'], duration: '60 min', intensity: 'Heavy', notes: 'Add 2.5kg or 1 rep weekly. Rest 2-3 min between heavy sets.' },
      { day: 'Tuesday',   activity: 'Zone 2 cardio (bike/row)', exercises: ['Erg bike OR rower 45 min @ 130-145 bpm'], duration: '45 min', intensity: 'Zone 2', notes: 'Conversational pace, nasal breathing' },
      { day: 'Wednesday', activity: 'Lower body strength', exercises: ['Back squat 4×6-8', 'Romanian deadlift 3×8', 'Walking lunge 3×10/leg', 'Leg curl 3×12', 'Calf raise 3×15'], duration: '60 min', intensity: 'Heavy', notes: 'Squat depth = thighs at least parallel' },
      { day: 'Thursday',  activity: 'Zone 2 cardio', exercises: ['Bike or jog 45 min easy'], duration: '45 min', intensity: 'Zone 2', notes: '' },
      { day: 'Friday',    activity: 'Full body + HIIT finisher', exercises: ['Deadlift 3×5', 'Pull-up 3×AMRAP', 'Push-up 3×AMRAP', 'Assault bike 8×30s sprint / 90s easy'], duration: '60 min', intensity: 'High', notes: 'Save HIIT for the end' },
      { day: 'Saturday',  activity: 'Long walk/hike outside', exercises: ['90 min hike or brisk walk'], duration: '90 min', intensity: 'Zone 2', notes: 'Sunlight + nature' },
      { day: 'Sunday',    activity: 'Active recovery', exercises: ['Sauna 20 min if available', 'Mobility + yoga 20 min', 'Walk 30 min'], duration: '60 min', intensity: 'Recovery', notes: 'Sauna 20 min × 4/week is associated with -40% all-cause mortality' },
    ];
  }
  return [
    { day: 'Monday',    activity: 'Bodyweight circuit', exercises: ['Squats 3×15', 'Push-ups 3×AMRAP', 'Plank 3×45s', 'Glute bridge 3×15'], duration: '30 min', intensity: 'Moderate', notes: 'No equipment needed' },
    { day: 'Tuesday',   activity: 'Walk', exercises: ['Walk 45-60 min'], duration: '45 min', intensity: 'Zone 2', notes: '' },
    { day: 'Wednesday', activity: 'Bodyweight circuit', exercises: ['Lunges 3×10/leg', 'Pike push-ups 3×8', 'Dead bug 3×10', 'Side plank 3×30s'], duration: '30 min', intensity: 'Moderate', notes: '' },
    { day: 'Thursday',  activity: 'Walk', exercises: ['Walk 45 min'], duration: '45 min', intensity: 'Zone 2', notes: '' },
    { day: 'Friday',    activity: 'HIIT (bodyweight)', exercises: ['Burpees 5×30s', 'Jump squats 5×30s', 'Mountain climbers 5×30s', 'Push-ups 5×30s'], duration: '25 min', intensity: 'High', notes: '30s on / 30s off' },
    { day: 'Saturday',  activity: 'Long walk or hike', exercises: ['60-90 min outdoor walk'], duration: '60 min', intensity: 'Zone 2', notes: '' },
    { day: 'Sunday',    activity: 'Stretch + rest', exercises: ['Stretch 20 min', 'Walk 20 min'], duration: '40 min', intensity: 'Recovery', notes: '' },
  ];
}

function computeSleepDuration(bedtime: string, wakeTime: string): string {
  if (!bedtime || !wakeTime) return '8h 0m';
  const [bH, bM] = bedtime.split(':').map(Number);
  const [wH, wM] = wakeTime.split(':').map(Number);
  if (Number.isNaN(bH) || Number.isNaN(wH)) return '8h 0m';
  const bMinutes = bH * 60 + (bM || 0);
  const wMinutes = wH * 60 + (wM || 0);
  let diff = wMinutes - bMinutes;
  if (diff < 0) diff += 24 * 60;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return `${h}h ${m}m`;
}

function buildFallbackFoodsToAdd(dietType: string) {
  const base = [
    { food: 'Berries daily (2 cups)', why: 'Polyphenols for anti-aging + low glycemic load' },
    { food: 'Extra virgin olive oil 2-3 tbsp', why: 'Polyphenols, heart health (Bryan takes 45ml/day)' },
    { food: 'Dark leafy greens daily', why: 'Folate, magnesium, nitrates for cardiovascular health' },
    { food: 'Nuts (walnuts, almonds) 30g/day', why: 'Omega-3, magnesium, satiety' },
  ];
  if (dietType === 'vegan') {
    return [
      { food: 'Ground flax or chia seeds 2 tbsp/day', why: 'Plant omega-3 (ALA). Pair with algal DHA/EPA supplement.' },
      ...base,
      { food: 'Legumes 3-4 servings/week', why: 'Fiber + plant protein for longevity' },
      { food: 'Fermented foods (tempeh, kimchi, sauerkraut)', why: 'Gut microbiome diversity' },
    ];
  }
  if (dietType === 'keto' || dietType === 'carnivore') {
    return [
      { food: 'Fatty fish (salmon, sardines) 3x/week', why: 'Omega-3 EPA/DHA, vitamin D' },
      ...base.filter(b => !b.food.includes('Berries')),
      { food: 'Organ meats (liver, heart) weekly', why: 'Micronutrient density, B12, retinol' },
      { food: 'Fermented dairy if tolerated', why: 'Gut microbiome' },
    ];
  }
  return [
    { food: 'Fatty fish (salmon, sardines) 3x/week', why: 'Omega-3 for inflammation and heart health' },
    ...base,
    { food: 'Fermented foods (yogurt, kimchi, kefir)', why: 'Gut microbiome diversity' },
  ];
}
