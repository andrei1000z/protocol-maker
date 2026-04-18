import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import Anthropic from '@anthropic-ai/sdk';
import { createAdminClient } from '@/lib/supabase/admin';
import { classifyAll, calculateLongevityScore, estimateBiologicalAge, estimateAgingPace } from '@/lib/engine/classifier';
import { detectPatterns } from '@/lib/engine/patterns';
import { BIOMARKER_DB } from '@/lib/engine/biomarkers';
import { buildMasterPromptV2 } from '@/lib/engine/master-prompt';
import { computeOrganSystems, generateTopWins, generateTopRisks, estimateBiomarkers, buildBryanSummary } from '@/lib/engine/lifestyle-diagnostics';
import { buildPainPoints, buildFlexRules } from '@/lib/engine/personalization-fills';
import type { BiomarkerValue, UserProfile } from '@/lib/types';

// Cron jobs can run up to 300s on Vercel Pro. Hobby is 60s — we batch small.
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

// Concurrency: process N users in parallel. Higher = faster but more AI rate pressure.
const BATCH_CONCURRENCY = 3;

// ─────────────────────────────────────────────────────────────────────────────
// GET handler — Vercel Cron calls this
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  // Vercel auto-injects Authorization: Bearer $CRON_SECRET on scheduled runs.
  // Manual calls from Vercel Dashboard also include it. Reject anything else.
  const authHeader = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const supabase = createAdminClient();

  // Fetch all users with completed onboarding. These are the only ones with
  // enough data to generate a protocol from.
  const { data: users, error: usersErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('onboarding_completed', true)
    .is('deleted_at', null);

  if (usersErr) return NextResponse.json({ error: `Profile fetch failed: ${usersErr.message}` }, { status: 500 });
  if (!users || users.length === 0) return NextResponse.json({ ok: true, processed: 0, note: 'No onboarded users' });

  const results = { total: users.length, success: 0, failed: 0, skipped: 0, errors: [] as { userId: string; err: string }[] };

  // Process in small batches to respect AI rate limits + Vercel timeout
  for (let i = 0; i < users.length; i += BATCH_CONCURRENCY) {
    const batch = users.slice(i, i + BATCH_CONCURRENCY);
    const outcomes = await Promise.allSettled(batch.map(u => regenerateForUser(u.id)));
    outcomes.forEach((o, idx) => {
      const userId = batch[idx].id;
      if (o.status === 'fulfilled') {
        if (o.value.skipped) results.skipped++;
        else results.success++;
      } else {
        results.failed++;
        results.errors.push({ userId, err: o.reason?.message || String(o.reason) });
      }
    });

    // Time check — bail early if we're approaching maxDuration (leave 20s buffer)
    if (Date.now() - startTime > 280_000) {
      results.errors.push({ userId: 'timeout', err: `Stopped at user ${i + BATCH_CONCURRENCY}/${users.length}` });
      break;
    }
  }

  return NextResponse.json({
    ok: true,
    ...results,
    durationMs: Date.now() - startTime,
    ranAt: new Date().toISOString(),
  });
}

// Manual trigger: POST works too (for Vercel dashboard "Run Now")
export const POST = GET;

// ─────────────────────────────────────────────────────────────────────────────
// Per-user regeneration — mirrors /api/generate-protocol but service-role auth
// ─────────────────────────────────────────────────────────────────────────────
async function regenerateForUser(userId: string): Promise<{ skipped?: boolean; protocolId?: string }> {
  const supabase = createAdminClient();

  // Load profile, latest bloodtest, last 30d daily metrics, last 7d compliance
  const [profileRes, bloodRes, metricsRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase.from('blood_tests').select('*').eq('user_id', userId).is('deleted_at', null).order('taken_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('daily_metrics').select('*').eq('user_id', userId).gte('date', new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)),
  ]);

  if (profileRes.error || !profileRes.data) throw new Error(`profile load: ${profileRes.error?.message}`);
  const dbProfile = profileRes.data;

  // Skip users who haven't actually filled anything meaningful
  if (!dbProfile.age || !dbProfile.height_cm || !dbProfile.weight_kg) {
    return { skipped: true };
  }

  // Roll 7-day averages from daily_metrics back into the profile before regen.
  // That's the user's request: "noile date introduse pe parcursul zilei" should
  // actually influence the protocol.
  const recent = (metricsRes.data || []).filter(m => m.date >= new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10));
  const avg = (key: string): number | null => {
    const vals = recent.map((r: Record<string, unknown>) => r[key]).filter((v): v is number => typeof v === 'number');
    return vals.length >= 3 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };
  const avgWeight = avg('weight_kg');
  const avgSleep = avg('sleep_hours');
  const avgSleepQ = avg('sleep_quality');
  const avgStress = avg('stress_level');
  const avgHRV = avg('hrv');
  const avgRHR = avg('resting_hr');

  // Merge DB profile shape + onboarding_data blob + rolled averages
  const onboardingData = (dbProfile.onboarding_data || {}) as Record<string, unknown>;
  const mergedProfile = {
    ...onboardingData,
    ...dbProfile,
    // Normalize to UserProfile shape (typed fields > onboardingData > defaults)
    age: dbProfile.age,
    sex: dbProfile.sex || onboardingData.sex || 'male',
    heightCm: dbProfile.height_cm,
    weightKg: avgWeight || dbProfile.weight_kg,
    ethnicity: dbProfile.ethnicity,
    occupation: dbProfile.occupation,
    activityLevel: dbProfile.activity_level,
    sleepHoursAvg: avgSleep || dbProfile.sleep_hours_avg,
    sleepQuality: avgSleepQ || dbProfile.sleep_quality,
    dietType: dbProfile.diet_type,
    alcoholDrinksPerWeek: dbProfile.alcohol_drinks_per_week,
    caffeineMgPerDay: dbProfile.caffeine_mg_per_day,
    smoker: dbProfile.smoker,
    cardioMinutesPerWeek: dbProfile.cardio_minutes_per_week,
    strengthSessionsPerWeek: dbProfile.strength_sessions_per_week,
    conditions: dbProfile.conditions || [],
    medications: dbProfile.medications || [],
    currentSupplements: dbProfile.current_supplements || [],
    allergies: dbProfile.allergies || [],
    goals: dbProfile.goals || [],
    timeBudgetMin: dbProfile.time_budget_min,
    monthlyBudgetRon: dbProfile.monthly_budget_ron,
    experimentalOpenness: dbProfile.experimental_openness,
    stressLevel: avgStress || onboardingData.stressLevel || 5,
    hrv: avgHRV || onboardingData.hrv,
    restingHR: avgRHR || onboardingData.restingHR,
    onboardingData,
  };

  // Build biomarkers from latest blood test
  let biomarkerValues: BiomarkerValue[] = [];
  if (bloodRes.data && Array.isArray(bloodRes.data.biomarkers)) {
    biomarkerValues = (bloodRes.data.biomarkers as Array<{ code: string; value: number; unit: string }>).map(b => ({
      code: b.code,
      value: b.value,
      unit: b.unit,
    }));
  }

  const classified = classifyAll(biomarkerValues);
  const patterns = detectPatterns(classified);
  const longevityScore = calculateLongevityScore(classified, mergedProfile);
  const biologicalAge = estimateBiologicalAge(mergedProfile, classified);
  const agingPace = estimateAgingPace(mergedProfile, classified);
  const chronoAge = Number(mergedProfile.age) || 35;

  // Try AI, fall back deterministically so the cron never crashes a user
  let protocolJson: Record<string, unknown>;
  let modelUsed = 'fallback';
  const prompt = buildMasterPromptV2(mergedProfile as UserProfile, classified, patterns, BIOMARKER_DB, longevityScore, biologicalAge);

  try {
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        protocolJson = await generateWithClaude(prompt);
        modelUsed = 'claude-sonnet-4-5';
      } catch {
        protocolJson = await generateWithGroq(prompt);
        modelUsed = 'llama-3.3-70b-versatile';
      }
    } else {
      protocolJson = await generateWithGroq(prompt);
      modelUsed = 'llama-3.3-70b-versatile';
    }
  } catch {
    protocolJson = { diagnostic: {}, _fallback: true };
    modelUsed = 'fallback';
  }

  // Inject authoritative numbers + lifestyle diagnostics (same as main route)
  const organSystems = computeOrganSystems(mergedProfile, classified);
  const topWins = generateTopWins(mergedProfile, classified, organSystems);
  const topRisks = generateTopRisks(mergedProfile, classified, organSystems);
  const bryanSummary = buildBryanSummary(longevityScore, agingPace, chronoAge, biologicalAge);
  const estimatedBm = classified.length === 0 ? estimateBiomarkers(mergedProfile) : [];

  const existingDiag = (protocolJson.diagnostic as Record<string, unknown> | undefined) || {};
  const aiBioAge = Number(existingDiag.biologicalAge);
  const aiPace = Number(existingDiag.agingVelocityNumber);
  const aiScore = Number(existingDiag.longevityScore);

  const maxDriftUp = chronoAge < 18 ? 5 : chronoAge < 25 ? 10 : 18;
  const maxDriftDown = chronoAge < 18 ? 3 : chronoAge < 25 ? 6 : 14;
  const bioMin = Math.max(5, chronoAge - maxDriftDown);
  const bioMax = chronoAge + maxDriftUp;

  const finalBioAge = Number.isFinite(aiBioAge) && aiBioAge >= bioMin && aiBioAge <= bioMax
    ? Math.round((aiBioAge * 0.6 + biologicalAge * 0.4) * 10) / 10
    : biologicalAge;
  const finalPace = Number.isFinite(aiPace) && aiPace >= 0.55 && aiPace <= 1.6
    ? Math.round((aiPace * 0.6 + agingPace * 0.4) * 100) / 100
    : agingPace;
  const finalScore = Number.isFinite(aiScore) && aiScore >= 0 && aiScore <= 100
    ? Math.round(aiScore * 0.5 + longevityScore * 0.5)
    : longevityScore;

  const organScoresMap: Record<string, number> = {};
  organSystems.forEach(o => { organScoresMap[o.key] = o.score; });

  protocolJson.diagnostic = {
    ...existingDiag,
    biologicalAge: finalBioAge,
    agingVelocityNumber: finalPace,
    agingVelocity: finalPace < 0.95 ? 'decelerated' : finalPace > 1.05 ? 'accelerated' : 'steady',
    chronologicalAge: chronoAge,
    longevityScore: finalScore,
    topWins: Array.isArray(existingDiag.topWins) && existingDiag.topWins.length >= 2
      ? [...(existingDiag.topWins as string[]).slice(0, 2), ...topWins.slice(0, 2)]
      : topWins,
    topRisks: Array.isArray(existingDiag.topRisks) && existingDiag.topRisks.length >= 2
      ? [...(existingDiag.topRisks as string[]).slice(0, 2), ...topRisks.slice(0, 2)]
      : topRisks,
    organSystemScores: organScoresMap,
    organSystemsDetailed: organSystems,
    bryanSummary,
    estimatedBiomarkers: estimatedBm,
  };

  // Ensure painPointSolutions + flexRules are populated, mirroring the /api/generate-protocol route
  const existingPP = Array.isArray(protocolJson.painPointSolutions) ? (protocolJson.painPointSolutions as unknown[]) : [];
  if (existingPP.length < 2) {
    protocolJson.painPointSolutions = buildPainPoints(mergedProfile as UserProfile);
  }
  const existingFlex = Array.isArray(protocolJson.flexRules) ? (protocolJson.flexRules as unknown[]) : [];
  if (existingFlex.length < 2) {
    protocolJson.flexRules = buildFlexRules(mergedProfile as UserProfile);
  }

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

  const { data: inserted, error: insertErr } = await supabase.from('protocols').insert({
    user_id: userId,
    protocol_json: protocolJson,
    classified_biomarkers: classified,
    detected_patterns: patterns,
    longevity_score: finalScore,
    biological_age: Math.round(finalBioAge),
    biological_age_decimal: finalBioAge,
    aging_pace: finalPace,
    model_used: modelUsed,
    generation_source: modelUsed === 'claude-sonnet-4-5' ? 'claude' : modelUsed === 'fallback' ? 'fallback' : 'groq',
  }).select('id').single();

  if (insertErr) throw new Error(`insert: ${insertErr.message}`);
  return { protocolId: inserted?.id };
}

// ─────────────────────────────────────────────────────────────────────────────
// AI helpers (simpler versions — no streaming, no markdown stripping beyond basics)
// ─────────────────────────────────────────────────────────────────────────────
async function generateWithClaude(prompt: string): Promise<Record<string, unknown>> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 16000,
    messages: [{ role: 'user', content: prompt + '\n\nRespond with ONLY the JSON object. Start with { and end with }.' }],
  });
  const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
  return parseJsonLoose(text);
}

async function generateWithGroq(prompt: string): Promise<Record<string, unknown>> {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });
  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: 'You output ONLY valid JSON. No markdown, no prose.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.4,
    max_tokens: 8000,
    response_format: { type: 'json_object' },
  });
  const text = completion.choices[0]?.message?.content || '';
  return parseJsonLoose(text);
}

function parseJsonLoose(text: string): Record<string, unknown> {
  if (!text) throw new Error('empty AI response');
  const cleaned = text.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim();
  try { return JSON.parse(cleaned); } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('no JSON in AI response');
    return JSON.parse(match[0]);
  }
}
