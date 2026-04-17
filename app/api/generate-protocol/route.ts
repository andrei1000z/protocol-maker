import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Groq from 'groq-sdk';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { classifyAll, calculateLongevityScore, estimateBiologicalAge, estimateAgingPace } from '@/lib/engine/classifier';
import { detectPatterns } from '@/lib/engine/patterns';
import { BIOMARKER_DB } from '@/lib/engine/biomarkers';
import { buildMasterPromptV2 } from '@/lib/engine/master-prompt';
import { BiomarkerValue, UserProfile } from '@/lib/types';
import { getProtocolRateLimit, checkRateLimit } from '@/lib/rate-limit';

export const maxDuration = 60;

// Loose Zod schema — accept what AI returns, normalize what we care about
const ProtocolShape = z.object({
  diagnostic: z.object({
    biologicalAge: z.number().optional(),
    chronologicalAge: z.number().optional(),
    longevityScore: z.number().optional(),
    topWins: z.array(z.string()).optional(),
    topRisks: z.array(z.string()).optional(),
  }).passthrough().optional(),
  nutrition: z.object({
    dailyCalories: z.number().optional(),
    macros: z.object({ protein: z.number(), carbs: z.number(), fat: z.number() }).optional(),
  }).passthrough().optional(),
  supplements: z.array(z.object({
    name: z.string(),
    dose: z.string().optional(),
    timing: z.string().optional(),
    priority: z.string().optional(),
  }).passthrough()).optional(),
}).passthrough();

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    // Rate limiting: 3 protocol generations per day per user (no-op if Upstash not configured)
    const limiter = getProtocolRateLimit();
    const { allowed, remaining, reset } = await checkRateLimit(limiter, user.id);
    if (!allowed) {
      const resetIn = reset ? Math.ceil((reset - Date.now()) / 3600000) : 24;
      return NextResponse.json({
        error: `Rate limit: 3 protocols per day. Try again in ${resetIn}h.`,
        rateLimited: true,
      }, { status: 429 });
    }

    const { profile: rawProfile, biomarkers } = await request.json();
    const biomarkerValues: BiomarkerValue[] = biomarkers || [];

    // Flatten onboardingData into top-level fields for the prompt's pick() helper
    // (it checks top-level first, then onboardingData, so this preserves typed fields)
    const onboardingData = rawProfile.onboardingData || {};
    const profile = { ...onboardingData, ...rawProfile };

    // Local classification (instant, never fails)
    const classified = classifyAll(biomarkerValues);
    const patterns = detectPatterns(classified);
    const longevityScore = calculateLongevityScore(classified);
    const biologicalAge = estimateBiologicalAge(profile, classified);
    const agingPace = estimateAgingPace(profile, classified);

    // Try AI generation, fallback to deterministic protocol if fails
    let protocolJson: Record<string, unknown>;
    let modelUsed = 'llama-3.3-70b-versatile';
    let aiError: string | null = null;

    const prompt = buildMasterPromptV2(profile, classified, patterns, BIOMARKER_DB, longevityScore, biologicalAge);

    // Try Claude Opus first (best medical reasoning), fallback to Groq, then deterministic
    try {
      if (process.env.ANTHROPIC_API_KEY) {
        try {
          protocolJson = await generateWithClaude(prompt);
          modelUsed = 'claude-sonnet-4-5';
        } catch (claudeErr) {
          console.warn('Claude failed, trying Groq:', claudeErr);
          protocolJson = await generateWithGroq(prompt);
          modelUsed = 'llama-3.3-70b-versatile';
        }
      } else {
        protocolJson = await generateWithGroq(prompt);
        modelUsed = 'llama-3.3-70b-versatile';
      }

      // Zod validation on final output
      const validated = ProtocolShape.safeParse(protocolJson);
      if (!validated.success) {
        console.error('AI output failed Zod validation:', validated.error.flatten());
        throw new Error('AI returned malformed JSON structure');
      }
    } catch (err) {
      aiError = err instanceof Error ? err.message : String(err);
      console.error('All AI providers failed, using deterministic fallback:', aiError);
      protocolJson = buildFallbackProtocol(profile, biologicalAge, longevityScore, classified, patterns);
      modelUsed = 'fallback';
    }

    // Inject our authoritative numeric biological age + aging pace into the AI output's diagnostic block.
    // AI may hallucinate these; our lifestyle-aware calculation is the source of truth.
    const existingDiag = (protocolJson.diagnostic as Record<string, unknown> | undefined) || {};
    protocolJson.diagnostic = {
      ...existingDiag,
      biologicalAge,
      agingVelocityNumber: agingPace,
      agingVelocity: agingPace < 0.95 ? 'decelerated' : agingPace > 1.05 ? 'accelerated' : 'steady',
      chronologicalAge: Number(profile.age) || existingDiag.chronologicalAge,
      longevityScore,
    };

    // Always add biomarker readout from our classifier
    protocolJson.biomarkerReadout = classified.map((b) => {
      const ref = BIOMARKER_DB.find((r) => r.code === b.code);
      return {
        code: b.code,
        name: ref?.name || b.code,
        shortName: ref?.shortName || b.code,
        value: b.value,
        unit: b.unit,
        classification: b.classification,
        longevityOptimalRange: ref ? [ref.longevityOptimalLow, ref.longevityOptimalHigh] : [0, 0],
        labRange: ref ? [ref.populationAvgLow, ref.populationAvgHigh] : [0, 0],
        bryanValue: ref?.bryanJohnsonValue,
        gap: b.longevityGap || 0,
      };
    });

    // Save to DB (non-fatal)
    const { error: dbError } = await supabase.from('protocols').insert({
      user_id: user.id,
      protocol_json: protocolJson,
      classified_biomarkers: classified,
      detected_patterns: patterns,
      longevity_score: longevityScore,
      biological_age: Math.round(biologicalAge),
      model_used: modelUsed,
    });

    if (dbError) {
      console.error('DB save error (non-fatal):', dbError);
      return NextResponse.json({ error: `Database error: ${dbError.message}` }, { status: 500 });
    }

    return NextResponse.json({ protocol: protocolJson, longevityScore, biologicalAge, agingPace, patterns, modelUsed, aiError });
  } catch (err) {
    console.error('Protocol generation error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

async function generateWithClaude(prompt: string): Promise<Record<string, unknown>> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY missing');

  const anthropic = new Anthropic({ apiKey });

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 16000,
    messages: [
      { role: 'user', content: prompt + '\n\nRespond with ONLY the JSON object. No markdown, no backticks, no explanation. Start your response with { and end with }.' },
    ],
  });

  const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
  if (!text) throw new Error('Empty response from Claude');

  // Claude sometimes wraps in markdown despite instructions
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Try to extract JSON object if prefixed with explanation
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Claude returned non-JSON response');
  }
}

async function generateWithGroq(prompt: string): Promise<Record<string, unknown>> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY missing');

  const groq = new Groq({ apiKey });

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: 'You are a longevity expert. Respond ONLY with valid JSON — no markdown, no backticks, no explanation. Just the JSON object.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
    max_tokens: 8000,
    response_format: { type: 'json_object' },
  });

  const text = completion.choices[0]?.message?.content || '';
  if (!text) throw new Error('Empty response from Groq');

  try {
    return JSON.parse(text);
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in Groq response');
    return JSON.parse(jsonMatch[0]);
  }
}

function buildFallbackProtocol(profile: UserProfile, bioAge: number, score: number, classified: BiomarkerValue[], patterns: { name: string; severity: string }[]): Record<string, unknown> {
  const criticalCount = classified.filter(b => b.classification === 'CRITICAL').length;
  const isLoss = profile.goals?.some((g: string) => g.toLowerCase().includes('composition') || g.toLowerCase().includes('loss'));
  const isGain = profile.goals?.some((g: string) => g.toLowerCase().includes('athletic') || g.toLowerCase().includes('muscle'));
  const multiplier = isLoss ? 24 : isGain ? 34 : 28;
  const calories = Math.round(profile.weightKg * multiplier);
  const protein = Math.round(profile.weightKg * (isGain ? 2.2 : 1.8));
  const fat = Math.round((calories * 0.3) / 9);
  const carbs = Math.round((calories - protein * 4 - fat * 9) / 4);

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
      foodsToAdd: buildFallbackFoodsToAdd(profile.dietType),
      foodsToReduce: [
        { food: 'Processed foods', why: 'Drive inflammation and metabolic dysfunction' },
        { food: 'Refined sugar', why: 'Spikes insulin and glucose' },
        { food: 'Seed oils (sunflower, corn, soybean)', why: 'Omega-6 inflammation' },
      ],
    },
    supplements: [
      { name: 'Vitamin D3 + K2-MK7', dose: '4000 IU D3 + 200mcg K2', timing: 'morning with fat', form: 'capsule', justification: 'Foundation for immunity, bone health, hormones. 70% of Europeans are deficient.', interactions: [], monthlyCostRon: 40, priority: 'MUST' },
      { name: 'Omega-3 EPA/DHA', dose: '2g daily', timing: 'with meals', form: 'softgel', justification: 'Reduces inflammation, cardiovascular protection. Target Omega-3 Index >8%.', interactions: [], monthlyCostRon: 60, priority: 'MUST' },
      { name: 'Magnesium Glycinate', dose: '400mg', timing: 'evening', form: 'capsule', justification: 'Sleep, stress, 300+ enzymatic reactions. 50% deficient.', interactions: [], monthlyCostRon: 30, priority: 'MUST' },
      { name: 'Creatine Monohydrate', dose: '5g daily', timing: 'anytime', form: 'powder', justification: 'Most studied supplement. Strength, cognition, longevity.', interactions: [], monthlyCostRon: 25, priority: 'STRONG' },
    ],
    exercise: {
      weeklyPlan: [
        { day: 'Monday', activity: 'Strength training (upper body)', duration: '45 min', intensity: 'Moderate' },
        { day: 'Tuesday', activity: 'Zone 2 cardio (walk/bike)', duration: '45 min', intensity: 'Zone 2' },
        { day: 'Wednesday', activity: 'Strength training (lower body)', duration: '45 min', intensity: 'Moderate' },
        { day: 'Thursday', activity: 'Zone 2 cardio', duration: '45 min', intensity: 'Zone 2' },
        { day: 'Friday', activity: 'Strength + HIIT finisher', duration: '60 min', intensity: 'High' },
        { day: 'Saturday', activity: 'Long walk or hike', duration: '60+ min', intensity: 'Zone 2' },
        { day: 'Sunday', activity: 'Rest or mobility', duration: '20 min', intensity: 'Recovery' },
      ],
      zone2Target: 150,
      strengthSessions: 3,
      hiitSessions: 1,
      dailyStepsTarget: 8000,
    },
    sleep: {
      targetBedtime: '22:30',
      targetWakeTime: '06:30',
      targetDuration: '8 hours',
      windDownRoutine: [
        { time: '-90 min', action: 'Dim lights, screens off' },
        { time: '-60 min', action: 'Hot shower or bath' },
        { time: '-30 min', action: 'Reading or meditation' },
      ],
      environment: [
        { item: 'Temperature 18-20°C', why: 'Core body temp must drop for sleep' },
        { item: 'Total darkness (blackout curtains)', why: 'Any light disrupts melatonin' },
        { item: 'Quiet or white noise', why: 'Stable sound environment' },
      ],
      supplementsForSleep: profile.sleepQuality && profile.sleepQuality < 6 ? ['Magnesium Glycinate 400mg', 'L-Theanine 200mg if stressed'] : [],
      morningLightMinutes: 10,
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
    roadmap: [
      { week: 'Week 1', title: 'Foundation', actions: ['Start Vitamin D3 + Omega-3 + Magnesium', 'Track sleep and steps', 'Set bedtime schedule'] },
      { week: 'Week 2-3', title: 'Build habits', actions: ['Add strength training 3x/week', 'Hit 8000 steps daily', 'Morning sunlight 10 min'] },
      { week: 'Week 4', title: 'First checkpoint', actions: ['Measure weight/waist', 'Review compliance', 'Adjust if needed'] },
      { week: 'Week 8', title: 'Mid-point', actions: ['Add HIIT 1x/week', 'Review supplement tolerance'] },
      { week: 'Week 12', title: 'Full re-panel', actions: ['Complete blood work retest', 'Compare to baseline', 'Update protocol'] },
    ],
    shoppingList: [
      { category: 'Supplements', items: [
        { name: 'Vitamin D3 + K2', estimatedCostRon: 40, where: 'eMAG', priority: 'buy now' },
        { name: 'Omega-3 EPA/DHA 2g', estimatedCostRon: 60, where: 'eMAG', priority: 'buy now' },
        { name: 'Magnesium Glycinate', estimatedCostRon: 30, where: 'eMAG', priority: 'buy now' },
        { name: 'Creatine Monohydrate', estimatedCostRon: 25, where: 'eMAG', priority: 'buy now' },
      ]},
    ],
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
    dailySchedule: buildFallbackDailySchedule(profile),
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
    painPointSolutions: buildFallbackPainPoints(profile),
    flexRules: buildFallbackFlexRules(profile),
    weekByWeekPlan: [
      { week: 1, focus: 'Foundation',
        mondayActions: ['Start Vitamin D3 + Omega-3 + Magnesium with breakfast'],
        wednesdayActions: ['First strength session (30 min upper body)'],
        fridayActions: ['Track sleep with phone or app'],
        weekendActions: ['Prep meals for next week', 'Morning sunlight walk 15 min'],
        endOfWeekCheck: ['Did I hit 5 days of supplements?', 'Any side effects?'],
      },
      { week: 2, focus: 'Build habits',
        mondayActions: ['Add walk after lunch (10 min)'],
        wednesdayActions: ['Strength session (lower body)'],
        fridayActions: ['Zone 2 cardio 30 min'],
        weekendActions: ['Long walk or hike 45+ min'],
        endOfWeekCheck: ['Are habits feeling automatic?'],
      },
      { week: 3, focus: 'Layer intensity',
        mondayActions: ['Add 1 HIIT session this week'],
        wednesdayActions: ['Full strength session 45 min'],
        fridayActions: ['Zone 2 + strength combo'],
        weekendActions: ['Track a full day of food'],
        endOfWeekCheck: ['Am I recovering between workouts?'],
      },
      { week: 4, focus: 'First checkpoint',
        mondayActions: ['Measure weight + waist'],
        wednesdayActions: ['Review supplement adherence — any missed doses?'],
        fridayActions: ['Check sleep data — avg hours + quality trend'],
        weekendActions: ['Plan weeks 5-8 based on progress'],
        endOfWeekCheck: ['Book retest for hsCRP if elevated'],
      },
    ],
    doctorQuestions: [
      ...(classified.filter(b => b.classification === 'CRITICAL').map(b => {
        const ref = BIOMARKER_DB.find(r => r.code === b.code);
        return `My ${ref?.shortName || b.code} is ${b.value} ${b.unit} — is this concerning and what should we do?`;
      })),
      'Based on my biomarkers, what annual screenings do you recommend?',
      'Are there any drug-supplement interactions I should know about?',
      'Given my family history, when should I start preventive testing (coronary calcium, colonoscopy, etc.)?',
    ].slice(0, 5),
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

function buildFallbackDailySchedule(profile: UserProfile) {
  const wakeTime = profile.wakeTime || '07:00';
  const [wh] = wakeTime.split(':').map(Number);
  const bedHour = (wh - 8.5 + 24) % 24;

  return [
    { time: wakeTime, activity: 'Wake, get morning sunlight outside', category: 'mindset', duration: '10 min', notes: 'No phone yet. Cold splash on face.' },
    { time: `${String(wh).padStart(2, '0')}:10`, activity: 'Glass of water + Vitamin D3 with breakfast fat', category: 'supplements', duration: '2 min', notes: '' },
    { time: `${String((wh + 1) % 24).padStart(2, '0')}:00`, activity: profile.exerciseWindow === 'morning' ? 'Exercise window' : 'Breakfast (protein-forward)', category: profile.exerciseWindow === 'morning' ? 'exercise' : 'nutrition', duration: '45 min', notes: '' },
    { time: '13:00', activity: 'Lunch — main meal', category: 'nutrition', duration: '30 min', notes: 'Walk 10 min after' },
    { time: '17:00', activity: profile.exerciseWindow === 'evening' ? 'Exercise window' : 'Snack + supplements', category: profile.exerciseWindow === 'evening' ? 'exercise' : 'supplements', duration: '45 min', notes: '' },
    { time: '18:30', activity: 'Dinner — lighter', category: 'nutrition', duration: '30 min', notes: 'Last meal 3h before bed' },
    { time: `${String((Math.floor(bedHour) - 1 + 24) % 24).padStart(2, '0')}:00`, activity: 'Wind-down: dim lights, screens off', category: 'sleep', duration: '60 min', notes: 'Reading, stretching' },
    { time: `${String(Math.floor(bedHour)).padStart(2, '0')}:30`, activity: 'Take Magnesium Glycinate', category: 'supplements', duration: '2 min', notes: '' },
    { time: `${String(Math.floor(bedHour)).padStart(2, '0')}:45`, activity: 'Bed — lights out', category: 'sleep', duration: '8h', notes: '18-20°C, total darkness' },
  ];
}

function buildFallbackPainPoints(profile: UserProfile) {
  const painPoints = profile.painPoints;
  if (!painPoints || painPoints.trim().length === 0) return [];

  // Split by line/comma and create an entry per distinct concern
  const concerns = painPoints.split(/[,.\n]+/).map(s => s.trim()).filter(s => s.length > 5).slice(0, 5);
  return concerns.map(concern => {
    const lower = concern.toLowerCase();
    if (lower.includes('energy') || lower.includes('crash') || lower.includes('tired') || lower.includes('fog')) {
      return {
        problem: concern,
        likelyCause: 'Post-meal glucose spike + insufficient protein breakfast + possible sleep debt',
        solution: 'Higher-protein breakfast (35g+), 10 min walk after meals, avoid refined carbs at lunch, optimize sleep first',
        supportingBiomarkers: ['GLUC', 'INSULIN', 'HBA1C'],
        expectedTimeline: '1-2 weeks for first improvements, 4 weeks for full resolution',
        checkpoints: ['Track 2 PM energy 1-10 daily', 'Compare week 1 vs week 4 averages'],
      };
    }
    if (lower.includes('sleep') || lower.includes('insomnia') || lower.includes('fall asleep')) {
      return {
        problem: concern,
        likelyCause: 'Elevated evening cortisol, blue light exposure, or inconsistent bedtime',
        solution: 'Magnesium Glycinate 400mg 60 min before bed, no screens 90 min before, consistent bedtime ±30 min, bedroom at 18-19°C',
        supportingBiomarkers: ['CORTISOL'],
        expectedTimeline: '3-7 days for first improvements, 3 weeks for stable pattern',
        checkpoints: ['Time-to-sleep tracked nightly', 'Morning readiness score'],
      };
    }
    if (lower.includes('back') || lower.includes('stiff') || lower.includes('pain') || lower.includes('joint')) {
      return {
        problem: concern,
        likelyCause: 'Prolonged sitting + low omega-3 + possible inflammation',
        solution: 'Hip flexor stretches 2x/day, hourly movement breaks, Omega-3 2-3g/day, strengthen posterior chain',
        supportingBiomarkers: ['HSCRP'],
        expectedTimeline: '2-3 weeks',
        checkpoints: ['Morning stiffness 1-10 daily', 'Weekly flexibility test'],
      };
    }
    return {
      problem: concern,
      likelyCause: 'Multi-factorial — consult detected patterns and biomarker trends',
      solution: 'Track daily for 2 weeks to identify triggers, address root causes (sleep, stress, nutrition) systematically',
      supportingBiomarkers: [],
      expectedTimeline: '4-8 weeks depending on root cause',
      checkpoints: ['Daily severity tracking 1-10', 'Weekly pattern review'],
    };
  });
}

function buildFallbackFlexRules(profile: UserProfile) {
  const nonNegotiables = profile.nonNegotiables;
  if (!nonNegotiables || nonNegotiables.trim().length === 0) return [];

  const items = nonNegotiables.split(/[,.\n]+/).map(s => s.trim()).filter(s => s.length > 3).slice(0, 5);
  return items.map(item => {
    const lower = item.toLowerCase();
    if (lower.includes('pizza') || lower.includes('burger') || lower.includes('fast food')) {
      return {
        scenario: item,
        strategy: '20 min walk before meal + 15 min walk after. Berberine 500mg with meal. Drink water between slices. Extend overnight fast to 14h the next day.',
        damageControl: 'Day-after: light eating, extra fiber, skip alcohol.',
        frequency: 'Up to 1x/week without penalty',
      };
    }
    if (lower.includes('coffee') || lower.includes('caffeine')) {
      return {
        scenario: item,
        strategy: 'Keep your morning coffee. Cutoff by 12:00. L-Theanine 200mg with coffee to smooth out peak.',
        damageControl: 'If consumed late: magnesium at bedtime, chamomile tea',
        frequency: 'Daily OK if before noon',
      };
    }
    if (lower.includes('alcohol') || lower.includes('wine') || lower.includes('beer') || lower.includes('drink')) {
      return {
        scenario: item,
        strategy: 'Hydrate 1 glass water between drinks. Eat before drinking. Take NAC 600mg before bed. Avoid sugary mixers.',
        damageControl: 'Day-after: electrolytes, skip workout, hydrate aggressively',
        frequency: 'Up to 2 drinks, 1-2x/week max',
      };
    }
    return {
      scenario: item,
      strategy: 'Enjoy mindfully. Pair with protein+fiber to blunt glucose. Walk 10 min after.',
      damageControl: 'Return to normal protocol next meal',
      frequency: 'Within reason',
    };
  });
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
  // Default: omnivore
  return [
    { name: 'Breakfast', time: '10:00', calories: pct(0.3), description: 'Protein + complex carbs + healthy fats', recipe: '3 eggs, oats 60g, berries, almonds 20g' },
    { name: 'Lunch', time: '13:00', calories: pct(0.4), description: 'Main meal: lean protein + vegetables + complex carbs', recipe: 'Chicken 200g, rice 150g, broccoli, olive oil 1 tbsp' },
    { name: 'Dinner', time: '17:30', calories: pct(0.3), description: 'Light protein + vegetables', recipe: 'Salmon 150g, sweet potato 200g, large green salad' },
  ];
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
