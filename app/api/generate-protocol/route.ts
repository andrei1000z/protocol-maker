import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Groq from 'groq-sdk';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { classifyAll, calculateLongevityScore, estimateBiologicalAge, estimateAgingPace } from '@/lib/engine/classifier';
import { summarizeRecentMetrics, refineAgingPace, refineBiologicalAge, refineLongevityScore, describeRecentSignals, type RecentMetricRow } from '@/lib/engine/wearable-refinement';
import { computeOrganSystems, generateTopWins, generateTopRisks, estimateBiomarkers, buildBryanSummary } from '@/lib/engine/lifestyle-diagnostics';
import { buildPainPoints, buildFlexRules } from '@/lib/engine/personalization-fills';
import { detectPatterns } from '@/lib/engine/patterns';
import { BIOMARKER_DB } from '@/lib/engine/biomarkers';
import { buildMasterPromptV2, CACHEABLE_SYSTEM_PREFIX } from '@/lib/engine/master-prompt';
import { buildFallbackProtocol } from '@/lib/engine/fallback-protocol';
import { BiomarkerValue, UserProfile } from '@/lib/types';
import { getProtocolRateLimit, checkRateLimit } from '@/lib/rate-limit';
import { logger, describeError } from '@/lib/logger';

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

    // Rate limiting: 3 protocol generations per day per user (no-op if Upstash not configured).
    // Bypassed for founders/admins in RATE_LIMIT_BYPASS_USER_IDS / _EMAILS env vars.
    const limiter = getProtocolRateLimit();
    const { allowed, remaining, reset } = await checkRateLimit(limiter, user.id, user.email);
    if (!allowed) {
      const resetIn = reset ? Math.ceil((reset - Date.now()) / 3600000) : 24;
      return NextResponse.json({
        error: `Rate limit: 3 protocols per day. Try again in ${resetIn}h.`,
        rateLimited: true,
      }, { status: 429 });
    }

    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const rawProfileFromClient = (body as { profile?: Record<string, unknown> }).profile || {};
    const biomarkersFromClient = (body as { biomarkers?: BiomarkerValue[] }).biomarkers;

    // Server-side profile hydration — when the client sends an empty/sparse
    // profile (e.g. regenerate-banner on dashboard), load the user's saved
    // profile + latest bloodwork from Supabase. This makes regenerate work
    // with just a POST and no body, so any page can trigger it safely.
    let rawProfile: Record<string, unknown> = rawProfileFromClient;
    let biomarkerValues: BiomarkerValue[] = biomarkersFromClient || [];
    const clientSparse = !rawProfileFromClient || Object.keys(rawProfileFromClient).length < 3;

    if (clientSparse) {
      const [{ data: dbProfile }, { data: latestBT }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).is('deleted_at', null).maybeSingle(),
        supabase.from('blood_tests').select('biomarkers').eq('user_id', user.id).is('deleted_at', null).order('taken_at', { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (dbProfile) {
        const od = (dbProfile.onboarding_data || {}) as Record<string, unknown>;
        // Reshape DB row → UserProfile shape the prompt expects
        rawProfile = {
          ...od,
          age: dbProfile.age, sex: dbProfile.sex,
          heightCm: dbProfile.height_cm, weightKg: dbProfile.weight_kg,
          ethnicity: dbProfile.ethnicity, occupation: dbProfile.occupation,
          activityLevel: dbProfile.activity_level,
          sleepHoursAvg: dbProfile.sleep_hours_avg, sleepQuality: dbProfile.sleep_quality,
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
          onboardingData: od,
        };
      }
      // Load biomarkers only if client didn't send any
      if (!biomarkersFromClient && latestBT?.biomarkers) {
        biomarkerValues = latestBT.biomarkers as BiomarkerValue[];
      }
    }

    // Flatten onboardingData into top-level fields for the prompt's pick() helper
    // (it checks top-level first, then onboardingData, so this preserves typed fields).
    // Keep as a flexible flattened record — downstream helpers take UserProfile
    // or Record<string, unknown> via cast where needed, and all have defaults
    // for missing fields at runtime.
    const onboardingData = (rawProfile.onboardingData || {}) as Record<string, unknown>;
    const profile = { ...onboardingData, ...rawProfile } as UserProfile & Record<string, unknown>;

    // Local classification (instant, never fails)
    const classified = classifyAll(biomarkerValues);
    const patterns = detectPatterns(classified);
    const baselineLongevityScore = calculateLongevityScore(classified, profile);
    const baselineBiologicalAge = estimateBiologicalAge(profile, classified);
    const baselineAgingPace = estimateAgingPace(profile, classified);
    const chronoAge = Number(profile.age) || 35;

    // ── Fetch last 30 days of daily_metrics so we can refine the baselines with
    // real wearable/self-log signal. Aging pace should be REAL — a user with
    // elite resting HR + HRV + consistent sleep shouldn't get the same pace as
    // one who only filled out the onboarding form. Failure to read metrics
    // never blocks generation; we just fall back to the profile-only estimates.
    let recentMetrics: RecentMetricRow[] = [];
    try {
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
      const cutoffStr = cutoff.toISOString().slice(0, 10);
      const { data: rows } = await supabase.from('daily_metrics')
        .select('resting_hr, hrv, hrv_sleep_avg, sleep_hours, sleep_score, steps, active_time_min, stress_level, stress_level_avg, bp_systolic_morning, body_fat_pct, body_score')
        .eq('user_id', user.id)
        .gte('date', cutoffStr)
        .order('date', { ascending: false })
        .limit(60);
      if (Array.isArray(rows)) recentMetrics = rows as RecentMetricRow[];
    } catch { /* no metrics → refinement is a no-op */ }

    const recentSignals = summarizeRecentMetrics(recentMetrics, { age: chronoAge, sex: String(profile.sex || 'male') });
    const longevityScore = refineLongevityScore(baselineLongevityScore, recentSignals);
    const biologicalAge = refineBiologicalAge(baselineBiologicalAge, chronoAge, recentSignals);
    const agingPace = refineAgingPace(baselineAgingPace, recentSignals);

    // Adherence score — 30-day compliance % calculated via existing SQL function
    // (get_adherence_rate was added in scripts/upgrade.sql). Snapshot at generation
    // time so you can see "v1 had 72% adherence, v2 had 85% → regenerate working".
    let adherenceScore30d: number | null = null;
    try {
      const { data: ad } = await supabase.rpc('get_adherence_rate', { p_user_id: user.id, p_days: 30 });
      if (typeof ad === 'number') adherenceScore30d = ad;
    } catch { /* RPC may not exist yet — gracefully null */ }

    // Previous protocol ID for diff comparison on history page
    let previousProtocolId: string | null = null;
    try {
      const { data: prev } = await supabase.from('protocols')
        .select('id').eq('user_id', user.id).is('deleted_at', null)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      previousProtocolId = prev?.id ?? null;
    } catch { /* no prior protocol */ }

    // Try AI generation, fallback to deterministic protocol if fails
    let protocolJson: Record<string, unknown>;
    let modelUsed = 'llama-3.3-70b-versatile';
    let aiError: string | null = null;
    // Track which provider was TRIED first vs succeeded, so we can tell
    // "Claude down → Groq rescued" apart from "no API key configured".
    let firstProviderTried: 'claude' | 'groq' = 'groq';
    let firstProviderOutcome: 'ok' | 'failed' | 'skipped_no_key' = 'skipped_no_key';
    let firstProviderErrorCode: string | null = null;
    const aiStartMs = Date.now();

    const recentSignalsSummary = describeRecentSignals(recentSignals);
    const prompt = buildMasterPromptV2(profile, classified, patterns, BIOMARKER_DB, longevityScore, biologicalAge, recentSignalsSummary);

    // Try Claude Opus first (best medical reasoning), fallback to Groq, then deterministic
    try {
      if (process.env.ANTHROPIC_API_KEY) {
        firstProviderTried = 'claude';
        try {
          protocolJson = await generateWithClaude(prompt);
          modelUsed = 'claude-sonnet-4-5';
          firstProviderOutcome = 'ok';
        } catch (claudeErr) {
          firstProviderOutcome = 'failed';
          // Classify the failure so ops can grep: rate_limit / auth / timeout / network / parse / other.
          // Keeps the historical warn log but adds a structured reason.
          firstProviderErrorCode = classifyProviderError(claudeErr);
          logger.warn('protocol.claude_failed_fallback_groq', {
            errorMessage: describeError(claudeErr),
            reason: firstProviderErrorCode,
          });
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
        // Log only the issue paths + count, not the full malformed JSON (PII risk).
        const issues = validated.error.issues.slice(0, 8).map(i => ({ path: i.path.join('.'), code: i.code }));
        logger.error('protocol.ai_output_zod_failed', { userId: user.id, issueCount: validated.error.issues.length, issues });
        throw new Error('AI returned malformed JSON structure');
      }
    } catch (err) {
      aiError = err instanceof Error ? err.message : String(err);
      const fallbackReason = classifyProviderError(err);
      logger.error('protocol.all_ai_failed_using_fallback', {
        userId: user.id,
        errorMessage: aiError,
        reason: fallbackReason,
        firstProviderTried,
        firstProviderErrorCode,
      });
      protocolJson = buildFallbackProtocol(profile, biologicalAge, longevityScore, classified, patterns);
      modelUsed = 'fallback';
    }

    // Single summary event per generation — the one line ops greps to see the
    // Claude/Groq/fallback distribution without parsing warn/error logs.
    logger.info('protocol.generate_done', {
      userId: user.id,
      model: modelUsed,
      firstProviderTried,
      firstProviderOutcome,
      firstProviderErrorCode,
      latencyMs: Date.now() - aiStartMs,
      hasBiomarkers: classified.length > 0,
      biomarkerCount: classified.length,
      patternCount: patterns.length,
      recentMetricDays: recentSignals.days,
    });

    // Defense: if AI returned a VALID but SPARSE protocol (missing nutrition,
    // supplements, dailySchedule, exercise, sleep, tracking, or doctorDiscussion)
    // fill the gaps from the deterministic fallback. This was a real user-facing
    // bug: Zod schema made every section optional, so an AI that only produced
    // `{diagnostic:{...}}` would pass validation and save a dashboard with
    // empty Nutrition / Supplements / Daily Schedule cards.
    const REQUIRED_SECTIONS: string[] = [
      'nutrition', 'supplements', 'supplementsHowTo', 'exercise', 'sleep',
      'tracking', 'doctorDiscussion', 'dailySchedule', 'bryanComparison',
      'universalTips', 'dailyBriefing', 'costBreakdown',
    ];
    const missingSections = REQUIRED_SECTIONS.filter(k => {
      const v = protocolJson[k];
      if (v === undefined || v === null) return true;
      if (Array.isArray(v) && v.length === 0) return true;
      if (typeof v === 'object' && Object.keys(v).length === 0) return true;
      return false;
    });
    if (missingSections.length > 0) {
      logger.warn('protocol.ai_sparse_merging_fallback', { userId: user.id, missing: missingSections, source: modelUsed });
      const deterministic = buildFallbackProtocol(profile, biologicalAge, longevityScore, classified, patterns);
      for (const key of missingSections) {
        if (deterministic[key] !== undefined) protocolJson[key] = deterministic[key];
      }
      // If we merged ≥4 sections, mark the source as 'hybrid' so downstream
      // tracking can see we patched a weak AI output with real data.
      if (missingSections.length >= 4 && modelUsed !== 'fallback') {
        modelUsed = `${modelUsed}+fallback`;
      }
    }

    // Blend AI output with our deterministic baseline. AI gets trust within sanity bounds;
    // outliers get clamped toward baseline. Provides best-of-both: lifestyle-aware reasoning
    // plus guardrails against AI hallucination.
    const existingDiag = (protocolJson.diagnostic as Record<string, unknown> | undefined) || {};
    const aiBioAge = Number(existingDiag.biologicalAge);
    const aiPace = Number(existingDiag.agingVelocityNumber);
    const aiScore = Number(existingDiag.longevityScore);

    // Bio age: accept AI if within reasonable bounds of chrono age (age-scaled). Else blend 50/50.
    const maxDriftUp = chronoAge < 18 ? 5 : chronoAge < 25 ? 10 : 18;
    const maxDriftDown = chronoAge < 18 ? 3 : chronoAge < 25 ? 6 : 14;
    const bioMin = Math.max(5, chronoAge - maxDriftDown);
    const bioMax = chronoAge + maxDriftUp;
    let finalBioAge: number;
    if (Number.isFinite(aiBioAge) && aiBioAge >= bioMin && aiBioAge <= bioMax) {
      // Blend AI (60%) + deterministic (40%) for precision
      finalBioAge = Math.round((aiBioAge * 0.6 + biologicalAge * 0.4) * 10) / 10;
    } else {
      finalBioAge = biologicalAge;
    }

    // Pace: accept AI if in plausible range, else use deterministic
    let finalPace: number;
    if (Number.isFinite(aiPace) && aiPace >= 0.55 && aiPace <= 1.6) {
      finalPace = Math.round((aiPace * 0.6 + agingPace * 0.4) * 100) / 100;
    } else {
      finalPace = agingPace;
    }

    // Longevity score: AI may be more/less optimistic — blend 50/50 if reasonable
    let finalScore: number;
    if (Number.isFinite(aiScore) && aiScore >= 0 && aiScore <= 100) {
      finalScore = Math.round(aiScore * 0.5 + longevityScore * 0.5);
    } else {
      finalScore = longevityScore;
    }

    // Compute rich lifestyle-based diagnostics (organ systems, wins, risks, bryan)
    // These ensure dashboard always has real data to render, even when AI is sparse or
    // when the user has no bloodwork yet.
    const organSystems = computeOrganSystems(profile, classified);
    const topWins = generateTopWins(profile, classified, organSystems);
    const topRisks = generateTopRisks(profile, classified, organSystems);
    const bryanSummary = buildBryanSummary(finalScore, finalPace, chronoAge, finalBioAge);
    const estimatedBiomarkers = classified.length === 0 ? estimateBiomarkers(profile) : [];

    // Build organ scores object keyed by system (for radar chart)
    const organScoresMap: Record<string, number> = {};
    organSystems.forEach(o => { organScoresMap[o.key] = o.score; });

    protocolJson.diagnostic = {
      ...existingDiag,
      biologicalAge: finalBioAge,
      agingVelocityNumber: finalPace,
      agingVelocity: finalPace < 0.95 ? 'decelerated' : finalPace > 1.05 ? 'accelerated' : 'steady',
      chronologicalAge: chronoAge,
      longevityScore: finalScore,
      adherenceScore30d,          // % of protocol items completed last 30d
      previousProtocolId,          // for v1 vs v2 diff in /history
      protocolVersion: (existingDiag.protocolVersion as number ?? 0) + 1,
      // Always-populated sections (merge AI's if provided, else use our lifestyle-based)
      topWins: Array.isArray(existingDiag.topWins) && existingDiag.topWins.length >= 2
        ? [...(existingDiag.topWins as string[]).slice(0, 2), ...topWins.slice(0, 2)]
        : topWins,
      topRisks: Array.isArray(existingDiag.topRisks) && existingDiag.topRisks.length >= 2
        ? [...(existingDiag.topRisks as string[]).slice(0, 2), ...topRisks.slice(0, 2)]
        : topRisks,
      organSystemScores: organScoresMap,
      organSystemsDetailed: organSystems,  // full objects with descriptions + drivers + improvers
      bryanSummary,
      estimatedBiomarkers,
    };

    // Ensure painPointSolutions + flexRules are ALWAYS populated, even when AI skips them.
    // If AI returned some, keep them; otherwise fall back to our enriched catalog.
    const existingPP = Array.isArray(protocolJson.painPointSolutions) ? (protocolJson.painPointSolutions as unknown[]) : [];
    if (existingPP.length < 2) {
      protocolJson.painPointSolutions = buildPainPoints(profile);
    }
    const existingFlex = Array.isArray(protocolJson.flexRules) ? (protocolJson.flexRules as unknown[]) : [];
    if (existingFlex.length < 2) {
      protocolJson.flexRules = buildFlexRules(profile);
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
      longevity_score: finalScore,
      biological_age: Math.round(finalBioAge),
      biological_age_decimal: finalBioAge,
      aging_pace: finalPace,
      model_used: modelUsed,
      generation_source: modelUsed === 'claude-sonnet-4-5' ? 'claude' : modelUsed === 'fallback' ? 'fallback' : 'groq',
    });

    if (dbError) {
      logger.error('protocol.db_insert_failed', { userId: user.id, errorMessage: dbError.message });
      return NextResponse.json({ error: `Database error: ${dbError.message}` }, { status: 500 });
    }

    return NextResponse.json({ protocol: protocolJson, longevityScore: finalScore, biologicalAge: finalBioAge, agingPace: finalPace, patterns, modelUsed, aiError });
  } catch (err) {
    logger.error('protocol.handler_failed', { errorMessage: describeError(err) });
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

// Classify an AI-provider error into a short code so ops can distinguish
// rate_limit / auth / timeout / network / parse / unknown. Logged alongside
// the error message so a search for `reason=rate_limit` surfaces real signal.
function classifyProviderError(err: unknown): string {
  const msg = (err instanceof Error ? err.message : String(err || '')).toLowerCase();
  if (!msg) return 'unknown';
  if (msg.includes('rate') && (msg.includes('limit') || msg.includes('429'))) return 'rate_limit';
  if (msg.includes('401') || msg.includes('unauthoriz') || msg.includes('invalid api key') || msg.includes('authentication')) return 'auth';
  if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('etimedout')) return 'timeout';
  if (msg.includes('enotfound') || msg.includes('econnrefused') || msg.includes('network') || msg.includes('fetch failed')) return 'network';
  if (msg.includes('malformed') || msg.includes('non-json') || msg.includes('empty response') || msg.includes('no json found')) return 'parse';
  if (msg.includes('overload') || msg.includes('529') || msg.includes('503') || msg.includes('service unavailable')) return 'provider_overload';
  return 'unknown';
}

async function generateWithClaude(prompt: string): Promise<Record<string, unknown>> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY missing');

  const anthropic = new Anthropic({ apiKey });

  // PROMPT CACHING: the system prefix is ~15k tokens of identical reference data
  // across every user (Bryan's blueprint, intervention rules, budget tables, tips,
  // and global output contract). Anthropic charges 1.25× on first write but only
  // 0.1× on subsequent reads within the 5-min TTL. Post first call of the day,
  // every generate saves ~90% of input-token cost on the cached portion.
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 16000,
    system: [
      { type: 'text', text: CACHEABLE_SYSTEM_PREFIX, cache_control: { type: 'ephemeral' } },
    ],
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

