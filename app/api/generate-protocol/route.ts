import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Groq from 'groq-sdk';
import { classifyAll, calculateLongevityScore, estimateBiologicalAge } from '@/lib/engine/classifier';
import { detectPatterns } from '@/lib/engine/patterns';
import { BIOMARKER_DB } from '@/lib/engine/biomarkers';
import { buildMasterPromptV2 } from '@/lib/engine/master-prompt';
import { BiomarkerValue, UserProfile } from '@/lib/types';

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { profile, biomarkers } = await request.json();
    const biomarkerValues: BiomarkerValue[] = biomarkers || [];

    // Local classification (instant, never fails)
    const classified = classifyAll(biomarkerValues);
    const patterns = detectPatterns(classified);
    const longevityScore = calculateLongevityScore(classified);
    const biologicalAge = estimateBiologicalAge(profile.age, classified);

    // Try AI generation, fallback to deterministic protocol if fails
    let protocolJson: Record<string, unknown>;
    let modelUsed = 'llama-3.3-70b-versatile';
    let aiError: string | null = null;

    try {
      const prompt = buildMasterPromptV2(profile, classified, patterns, BIOMARKER_DB, longevityScore, biologicalAge);
      protocolJson = await generateWithGroq(prompt);
    } catch (err) {
      aiError = err instanceof Error ? err.message : String(err);
      console.error('AI generation failed, using fallback:', aiError);
      protocolJson = buildFallbackProtocol(profile, biologicalAge, longevityScore, classified, patterns);
      modelUsed = 'fallback';
    }

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
      biological_age: biologicalAge,
      model_used: modelUsed,
    });

    if (dbError) {
      console.error('DB save error (non-fatal):', dbError);
      return NextResponse.json({ error: `Database error: ${dbError.message}` }, { status: 500 });
    }

    return NextResponse.json({ protocol: protocolJson, longevityScore, biologicalAge, patterns, modelUsed, aiError });
  } catch (err) {
    console.error('Protocol generation error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
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
      meals: [
        { name: 'Breakfast', time: '10:00', calories: Math.round(calories * 0.3), description: 'Protein + complex carbs + healthy fats', recipe: '3 eggs, oats 60g, berries, almonds' },
        { name: 'Lunch', time: '13:00', calories: Math.round(calories * 0.4), description: 'Main meal: protein + vegetables + complex carbs', recipe: 'Chicken 200g, rice 150g, broccoli, olive oil 1 tbsp' },
        { name: 'Dinner', time: '17:30', calories: Math.round(calories * 0.3), description: 'Light protein + vegetables', recipe: 'Salmon 150g, sweet potato 200g, green salad' },
      ],
      foodsToAdd: [
        { food: 'Fatty fish (salmon, sardines) 3x/week', why: 'Omega-3 for inflammation and heart health' },
        { food: 'Berries daily', why: 'Polyphenols for anti-aging' },
        { food: 'Extra virgin olive oil 2-3 tbsp', why: 'Polyphenols, heart health (Bryan takes 45ml/day)' },
      ],
      foodsToReduce: [
        { food: 'Processed foods', why: 'Drive inflammation and metabolic dysfunction' },
        { food: 'Refined sugar', why: 'Spikes insulin and glucose' },
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
      ]},
      { category: 'Sleep', tips: [
        { tip: 'Same bedtime ±30 min nightly', why: 'Sleep consistency matters as much as duration', difficulty: 'medium' },
        { tip: 'Morning sunlight 10-15 min', why: 'Anchors circadian rhythm', difficulty: 'easy' },
      ]},
    ],
  };
}
