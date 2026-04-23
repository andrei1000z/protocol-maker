import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import Anthropic from '@anthropic-ai/sdk';
import { createAdminClient } from '@/lib/supabase/admin';
import { classifyAll, calculateLongevityScore, estimateBiologicalAge, estimateAgingPace } from '@/lib/engine/classifier';
import { detectPatterns } from '@/lib/engine/patterns';
import { BIOMARKER_DB } from '@/lib/engine/biomarkers';
import { buildMasterPromptV2, CACHEABLE_SYSTEM_PREFIX } from '@/lib/engine/master-prompt';
import { summarizeRecentMetrics, refineAgingPace, refineBiologicalAge, refineLongevityScore, describeRecentSignals, type RecentMetricRow } from '@/lib/engine/wearable-refinement';
import { computeOrganSystems, generateTopWins, generateTopRisks, estimateBiomarkers, buildBryanSummary } from '@/lib/engine/lifestyle-diagnostics';
import { buildPainPoints, buildFlexRules } from '@/lib/engine/personalization-fills';
import { buildFallbackProtocol } from '@/lib/engine/fallback-protocol';
import { logger } from '@/lib/logger';
import { logAiTokens, usageFromAnthropic, usageFromGroq, type AiTokenUsage } from '@/lib/ai-costs';
import { inspectProtocolShape } from '@/lib/engine/schemas';
import { describeMealsForPrompt, type MealRow } from '@/lib/engine/meals';
import { syncProvider } from '@/lib/integrations/sync';
import { isConfigured as ouraConfigured } from '@/lib/integrations/oura';
import { isConfigured as fitbitConfigured } from '@/lib/integrations/fitbit';
import { isConfigured as withingsConfigured } from '@/lib/integrations/withings';
import { isConfigured as whoopConfigured } from '@/lib/integrations/whoop';
import { isConfigured as googleFitConfigured } from '@/lib/integrations/google-fit';
import type { ProviderKey } from '@/lib/integrations/base';
import type { BiomarkerValue, UserProfile } from '@/lib/types';

// Mirrors the classifier in /api/generate-protocol — short codes so ops can
// grep `firstProviderErrorCode=rate_limit` to spot Claude/Groq degradation.
function classifyProviderError(err: unknown): string {
  const msg = (err instanceof Error ? err.message : String(err || '')).toLowerCase();
  if (!msg) return 'unknown';
  if (msg.includes('rate') && (msg.includes('limit') || msg.includes('429'))) return 'rate_limit';
  if (msg.includes('401') || msg.includes('unauthoriz') || msg.includes('invalid api key')) return 'auth';
  if (msg.includes('timeout') || msg.includes('etimedout')) return 'timeout';
  if (msg.includes('network') || msg.includes('fetch failed')) return 'network';
  if (msg.includes('overload') || msg.includes('529') || msg.includes('503')) return 'provider_overload';
  if (msg.includes('malformed') || msg.includes('non-json') || msg.includes('empty response')) return 'parse';
  return 'unknown';
}

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
  //
  // SECURITY: earlier version did `if (secret && authHeader !== ...)` which
  // silently allowed ALL unauthenticated traffic when CRON_SECRET was unset
  // or empty. Now we REQUIRE the secret to be configured AND to match.
  // If the env var is missing in prod, the cron is disabled — fail closed.
  const authHeader = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
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

  const results = {
    total: users.length,
    success: 0,
    failed: 0,
    skipped: 0,
    skippedInactive: 0,
    skippedIncomplete: 0,
    errors: [] as { userId: string; err: string }[],
  };

  // Process in small batches to respect AI rate limits + Vercel timeout
  for (let i = 0; i < users.length; i += BATCH_CONCURRENCY) {
    const batch = users.slice(i, i + BATCH_CONCURRENCY);
    const outcomes = await Promise.allSettled(batch.map(u => regenerateForUser(u.id)));
    outcomes.forEach((o, idx) => {
      const userId = batch[idx].id;
      if (o.status === 'fulfilled') {
        if (o.value.skipped) {
          results.skipped++;
          if (o.value.skippedReason === 'inactive_7d') results.skippedInactive++;
          else if (o.value.skippedReason === 'incomplete_profile') results.skippedIncomplete++;
        } else {
          results.success++;
        }
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

  // Retention housekeeping — prune chat messages older than 90 days. Called
  // inside the daily cron so it piggy-backs on an already-scheduled run
  // instead of needing its own trigger. Silent on pre-migration DBs.
  let chatPruned: number | null = null;
  try {
    const { data } = await supabase.rpc('prune_old_chat_messages', { p_days: 90 });
    if (typeof data === 'number') chatPruned = data;
  } catch { /* function not migrated yet — ignore */ }

  // Wearable sync — pull recent data for every connected user across every
  // configured provider so tomorrow morning's regen sees fresh readings.
  // Providers without env credentials are silently skipped. Loop order does
  // not matter — daily_metrics is keyed by (user, date) and merges cleanly.
  const syncStats: Record<string, { attempted: number; ok: number; failed: number; rowsWritten: number }> = {};
  const providers: Array<{ key: ProviderKey; enabled: boolean }> = [
    { key: 'oura',       enabled: ouraConfigured() },
    { key: 'fitbit',     enabled: fitbitConfigured() },
    { key: 'withings',   enabled: withingsConfigured() },
    { key: 'whoop',      enabled: whoopConfigured() },
    { key: 'google_fit', enabled: googleFitConfigured() },
  ];

  for (const { key: providerKey, enabled } of providers) {
    if (!enabled) continue;
    const stats = { attempted: 0, ok: 0, failed: 0, rowsWritten: 0 };
    syncStats[providerKey] = stats;
    try {
      const { data: connected } = await supabase
        .from('oauth_connections')
        .select('user_id')
        .eq('provider', providerKey);
      if (!Array.isArray(connected) || connected.length === 0) continue;

      // Withings wants a longer lookback — scale weigh-ins are sparse.
      const lookbackDays = providerKey === 'withings' ? 7 : 3;

      for (let i = 0; i < connected.length; i += BATCH_CONCURRENCY) {
        if (Date.now() - startTime > 290_000) break;
        const batch = connected.slice(i, i + BATCH_CONCURRENCY);
        const outcomes = await Promise.allSettled(
          batch.map(c => syncProvider(supabase, c.user_id, providerKey, { lookbackDays }))
        );
        outcomes.forEach(o => {
          stats.attempted++;
          if (o.status === 'fulfilled' && o.value.ok) {
            stats.ok++;
            stats.rowsWritten += o.value.rowsWritten;
          } else {
            stats.failed++;
          }
        });
      }
    } catch (err) {
      logger.warn(`cron.${providerKey}_batch_failed`, {
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    ok: true,
    ...results,
    chatMessagesPruned: chatPruned,
    wearableSync: syncStats,
    durationMs: Date.now() - startTime,
    ranAt: new Date().toISOString(),
  });
}

// Manual trigger: POST works too (for Vercel dashboard "Run Now")
export const POST = GET;

// ─────────────────────────────────────────────────────────────────────────────
// Per-user regeneration — mirrors /api/generate-protocol but service-role auth
// ─────────────────────────────────────────────────────────────────────────────
async function regenerateForUser(userId: string): Promise<{ skipped?: boolean; skippedReason?: string; protocolId?: string }> {
  const supabase = createAdminClient();

  const sevenDaysAgo = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);

  // Load profile + latest bloodtest + last 30d daily metrics + last 30d
  // compliance rows. The compliance rows (full data, not just count) now
  // also feed the adherence-aware prompt below, so there's no extra query.
  const [profileRes, bloodRes, metricsRes, complianceRows30Res] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase.from('blood_tests').select('*').eq('user_id', userId).is('deleted_at', null).order('taken_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('daily_metrics').select('*').eq('user_id', userId).gte('date', thirtyDaysAgo),
    supabase.from('compliance_logs').select('item_type, item_name, completed, date').eq('user_id', userId).gte('date', thirtyDaysAgo),
  ]);

  if (profileRes.error || !profileRes.data) throw new Error(`profile load: ${profileRes.error?.message}`);
  const dbProfile = profileRes.data;

  // Skip users who haven't actually filled anything meaningful
  if (!dbProfile.age || !dbProfile.height_cm || !dbProfile.weight_kg) {
    return { skipped: true, skippedReason: 'incomplete_profile' };
  }

  // INACTIVE USER SKIP: if the user hasn't logged any daily_metric in the last
  // 7 days AND hasn't checked off any compliance task, regenerating their
  // protocol burns ~$0.08 for zero signal change. Skip. They'll get a fresh
  // protocol the moment they log again (dashboard has its own regen trigger,
  // and the next cron run after their first log will pick them up).
  const metricsLast7d = (metricsRes.data || []).filter((m: { date: string }) => m.date >= sevenDaysAgo);
  const hasRecentMetrics = metricsLast7d.length > 0;
  const complianceRows = (complianceRows30Res.data || []) as Array<{ item_type: string; item_name: string; completed: boolean; date: string }>;
  const hasRecentCompliance = complianceRows.some(r => r.date >= sevenDaysAgo && r.completed);
  if (!hasRecentMetrics && !hasRecentCompliance) {
    return { skipped: true, skippedReason: 'inactive_7d' };
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
  const patterns = detectPatterns(classified, (mergedProfile.medications as Array<{ name?: string | null } | string> | null));
  const baseLongevityScore = calculateLongevityScore(classified, mergedProfile);
  const baseBiologicalAge = estimateBiologicalAge(mergedProfile, classified);
  const baseAgingPace = estimateAgingPace(mergedProfile, classified);
  const chronoAge = Number(mergedProfile.age) || 35;

  // Refine baselines with the last 30 days of daily_metrics we already loaded
  // above (metricsRes.data). Keeps aging speed / bio age anchored to REAL data
  // — not just the profile snapshot captured at onboarding.
  const recentSignals = summarizeRecentMetrics(
    (metricsRes.data || []) as RecentMetricRow[],
    { age: chronoAge, sex: String(mergedProfile.sex || 'male') }
  );
  const longevityScore = refineLongevityScore(baseLongevityScore, recentSignals);
  const biologicalAge = refineBiologicalAge(baseBiologicalAge, chronoAge, recentSignals);
  const agingPace = refineAgingPace(baseAgingPace, recentSignals);
  const recentSignalsSummary = describeRecentSignals(recentSignals);

  // Adherence signal for the master prompt — same shape the interactive
  // /api/generate-protocol path uses. Keeps cron regens from prescribing
  // items the user has been silently skipping for 30 days.
  const activeDates = new Set<string>();
  const missCounts = new Map<string, number>();
  let totalRows = 0, completedRows = 0;
  for (const r of complianceRows) {
    totalRows++;
    if (r.completed) { completedRows++; activeDates.add(r.date); }
    else {
      const k = `${r.item_type}:${r.item_name}`;
      missCounts.set(k, (missCounts.get(k) || 0) + 1);
    }
  }
  const adherenceRate30d = totalRows > 0 ? Math.round((completedRows / totalRows) * 100) : null;
  const adherenceTopMissed = [...missCounts.entries()]
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([k, n]) => `${k.split(':').slice(1).join(':')} (skipped ${n}×)`);

  // Try AI, fall back deterministically so the cron never crashes a user
  let protocolJson: Record<string, unknown>;
  let modelUsed = 'fallback';
  let firstProviderTried: 'claude' | 'groq' = 'groq';
  let firstProviderOutcome: 'ok' | 'failed' | 'skipped_no_key' = 'skipped_no_key';
  let firstProviderErrorCode: string | null = null;
  let tokenUsage: AiTokenUsage | null = null;
  const aiStartMs = Date.now();
  // 7-day meal summary. Same pattern as the interactive route — silent
  // failure if the table isn't migrated yet.
  let mealsSummary: string | null = null;
  try {
    const since = new Date(Date.now() - 7 * 864e5).toISOString();
    const { data: mealRows } = await supabase.from('meals')
      .select('*').eq('user_id', userId).gte('eaten_at', since)
      .order('eaten_at', { ascending: false }).limit(100);
    if (Array.isArray(mealRows) && mealRows.length > 0) {
      mealsSummary = describeMealsForPrompt(mealRows as MealRow[], 7);
    }
  } catch { /* ignore */ }

  const prompt = buildMasterPromptV2(
    mergedProfile as UserProfile, classified, patterns, BIOMARKER_DB,
    longevityScore, biologicalAge, recentSignalsSummary,
    { rate30d: adherenceRate30d, topMissedItems: adherenceTopMissed, activeDays: activeDates.size },
    mealsSummary ?? undefined,
  );

  try {
    if (process.env.ANTHROPIC_API_KEY) {
      firstProviderTried = 'claude';
      try {
        const r = await generateWithClaude(prompt);
        protocolJson = r.json;
        tokenUsage = r.usage;
        modelUsed = 'claude-sonnet-4-5';
        firstProviderOutcome = 'ok';
      } catch (claudeErr) {
        firstProviderOutcome = 'failed';
        firstProviderErrorCode = classifyProviderError(claudeErr);
        const r = await generateWithGroq(prompt);
        protocolJson = r.json;
        tokenUsage = r.usage;
        modelUsed = 'llama-3.3-70b-versatile';
      }
    } else {
      const r = await generateWithGroq(prompt);
      protocolJson = r.json;
      tokenUsage = r.usage;
      modelUsed = 'llama-3.3-70b-versatile';
    }
  } catch {
    // BUG FIX: previously set protocolJson to `{diagnostic: {}, _fallback: true}`
    // which wrote an EMPTY protocol to the DB overnight. Users woke up to a
    // dashboard with missing Nutrition / Supplements / Daily Schedule sections.
    // Now uses the real deterministic fallback so the worst case is a protocol
    // built from rules, not silence.
    protocolJson = buildFallbackProtocol(mergedProfile as UserProfile, biologicalAge, longevityScore, classified, patterns);
    modelUsed = 'fallback';
  }

  logger.info('cron.user_generate_done', {
    userId,
    model: modelUsed,
    firstProviderTried,
    firstProviderOutcome,
    firstProviderErrorCode,
    latencyMs: Date.now() - aiStartMs,
    biomarkerCount: classified.length,
    recentMetricDays: recentSignals.days,
  });

  // Per-user cost log. Cron processes N users back-to-back so these events
  // form the daily cost time-series; sum by date to get run totals.
  if (tokenUsage) {
    logAiTokens({
      op: 'cron.regen',
      model: modelUsed,
      userId,
      latencyMs: Date.now() - aiStartMs,
      inputTokens: tokenUsage.inputTokens,
      outputTokens: tokenUsage.outputTokens,
      cacheReadTokens: tokenUsage.cacheReadTokens,
      cacheCreationTokens: tokenUsage.cacheCreationTokens,
      extra: { firstProviderTried, firstProviderOutcome },
    });
  }

  // Defense: if AI returned a VALID but SPARSE protocol, merge missing
  // sections from the deterministic fallback. Same fix as the main
  // generate-protocol route — without this, a truncated or lazy AI response
  // writes a dashboard with empty section cards.
  const REQUIRED_SECTIONS = [
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
  if (missingSections.length > 0 && modelUsed !== 'fallback') {
    const deterministic = buildFallbackProtocol(mergedProfile as UserProfile, biologicalAge, longevityScore, classified, patterns);
    for (const key of missingSections) {
      if (deterministic[key] !== undefined) protocolJson[key] = deterministic[key];
    }
    if (missingSections.length >= 4) modelUsed = `${modelUsed}+fallback`;
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
    // Signal density used to refine bio-age + pace. Dashboard renders a
    // confidence chip based on this so users understand WHY the number moved.
    wearableSignalDays: recentSignals.days,
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

  // Advisory schema check — see /api/generate-protocol for rationale. Cron
  // runs across the entire user base daily, so any shape drift shows up
  // quickly in log aggregates.
  const shape = inspectProtocolShape(protocolJson);
  if (!shape.ok) {
    logger.warn('protocol.zod_shape_drift', {
      userId,
      op: 'cron',
      model: modelUsed,
      issueCount: shape.drift.issueCount,
      issues: shape.drift.issues,
    });
  }

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
async function generateWithClaude(prompt: string): Promise<{ json: Record<string, unknown>; usage: AiTokenUsage }> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  // Cached system prefix — cron processes N users back-to-back, so after the
  // first user the prefix is a cache-hit for every remaining user in the batch.
  // Biggest cost win in the whole pipeline.
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 16000,
    system: [
      { type: 'text', text: CACHEABLE_SYSTEM_PREFIX, cache_control: { type: 'ephemeral' } },
    ],
    messages: [{ role: 'user', content: prompt + '\n\nRespond with ONLY the JSON object. Start with { and end with }.' }],
  });
  const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
  return { json: parseJsonLoose(text), usage: usageFromAnthropic(response.usage) };
}

async function generateWithGroq(prompt: string): Promise<{ json: Record<string, unknown>; usage: AiTokenUsage }> {
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
  return { json: parseJsonLoose(text), usage: usageFromGroq(completion.usage) };
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
