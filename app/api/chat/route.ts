import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Groq from 'groq-sdk';
import Anthropic from '@anthropic-ai/sdk';
import { getChatRateLimit, checkRateLimit } from '@/lib/rate-limit';

export const maxDuration = 60;
export const runtime = 'nodejs';

interface ChatMessage { role: 'user' | 'assistant'; content: string; }

// ─────────────────────────────────────────────────────────────────────────────
// Context builder — pulls everything we know about the user and formats it
// densely for the model. Claude/Groq both handle 10k+ tokens here easily.
// ─────────────────────────────────────────────────────────────────────────────
type Supabase = Awaited<ReturnType<typeof createClient>>;

async function buildContext(supabase: Supabase, userId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const twoWeeksAgo = new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10);

  const [profileRes, protocolRes, bloodTestRes, metricsRes, complianceRes, historyRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase.from('protocols').select('*').eq('user_id', userId).is('deleted_at', null).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('blood_tests').select('biomarkers, taken_at').eq('user_id', userId).is('deleted_at', null).order('taken_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('daily_metrics').select('*').eq('user_id', userId).gte('date', twoWeeksAgo).lte('date', today).order('date', { ascending: true }),
    supabase.from('compliance_logs').select('item_type, item_name, completed, date').eq('user_id', userId).gte('date', new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10)).lte('date', today),
    supabase.from('protocols').select('created_at, longevity_score, biological_age_decimal, aging_pace').eq('user_id', userId).is('deleted_at', null).order('created_at', { ascending: true }),
  ]);

  const profile = profileRes.data;
  const protocol = protocolRes.data;
  const bloodTest = bloodTestRes.data;
  const metrics = (metricsRes.data || []) as Record<string, unknown>[];
  const compliance = complianceRes.data || [];
  const protocolHistory = (historyRes.data || []) as Array<{ created_at: string; longevity_score: number | null; biological_age_decimal: number | null; aging_pace: number | null }>;

  // Profile snapshot
  const od = (profile?.onboarding_data || {}) as Record<string, unknown>;
  const str = (k: string) => (od[k] === undefined || od[k] === null || od[k] === '') ? null : String(od[k]);
  const arr = (k: string) => Array.isArray(od[k]) ? (od[k] as unknown[]).filter(x => typeof x === 'string') as string[] : [];

  const bmi = profile?.weight_kg && profile?.height_cm
    ? (profile.weight_kg / ((profile.height_cm / 100) ** 2)).toFixed(1)
    : null;

  // Recent metric averages (last 7 days) — only from logged values
  const last7 = metrics.slice(-7);
  const avg = (k: string) => {
    const vals = last7.map(r => r[k]).filter((v): v is number => typeof v === 'number');
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };

  const recentAverages = {
    sleepHours:     avg('sleep_hours'),
    sleepQuality:   avg('sleep_quality'),
    sleepScore:     avg('sleep_score'),
    deepSleepMin:   avg('deep_sleep_min'),
    remSleepMin:    avg('rem_sleep_min'),
    restingHR:      avg('resting_hr'),
    hrv:            avg('hrv'),
    hrvSleep:       avg('hrv_sleep_avg'),
    bloodO2:        avg('blood_oxygen_avg_sleep'),
    bpSysMorning:   avg('bp_systolic_morning'),
    bpDiaMorning:   avg('bp_diastolic_morning'),
    steps:          avg('steps'),
    activeMin:      avg('active_time_min'),
    mood:           avg('mood'),
    energy:         avg('energy'),
    stress:         avg('stress_level'),
    weight:         avg('weight_kg'),
  };

  // Adherence stats
  const totalItems = compliance.length;
  const completedItems = compliance.filter(c => c.completed).length;
  const adherenceRate = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : null;
  const recentMisses = compliance
    .filter(c => !c.completed)
    .reduce<Record<string, number>>((acc, c) => {
      acc[`${c.item_type}:${c.item_name}`] = (acc[`${c.item_type}:${c.item_name}`] || 0) + 1;
      return acc;
    }, {});
  const topMissed = Object.entries(recentMisses).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Protocol diagnostic summary
  const pj = protocol?.protocol_json as Record<string, unknown> | undefined;
  const diag = pj?.diagnostic as Record<string, unknown> | undefined;
  const supplements = (pj?.supplements as Array<{ name: string; dose?: string; timing?: string; priority?: string; justification?: string }> | undefined) || [];
  const bryanComp = (pj?.bryanComparison as Array<{ marker: string; yourValue: unknown; bryanValue: unknown; verdict: string }> | undefined) || [];
  const organs = (diag?.organSystemsDetailed as Array<{ label: string; score: number; drivers: string[]; improvers: string[] }> | undefined) || [];

  // Protocol progression (if ≥2 protocols)
  const firstProto = protocolHistory[0];
  const latestProto = protocolHistory[protocolHistory.length - 1];
  let progression: string | null = null;
  if (firstProto && latestProto && protocolHistory.length >= 2 && firstProto !== latestProto) {
    const scoreDelta = (latestProto.longevity_score ?? 0) - (firstProto.longevity_score ?? 0);
    const bioDelta = (latestProto.biological_age_decimal ?? 0) - (firstProto.biological_age_decimal ?? 0);
    const days = Math.round((new Date(latestProto.created_at).getTime() - new Date(firstProto.created_at).getTime()) / 864e5);
    progression = `Score changed ${scoreDelta >= 0 ? '+' : ''}${scoreDelta} points and bio age ${bioDelta >= 0 ? '+' : ''}${bioDelta.toFixed(1)}y over ${days} days.`;
  }

  // Format
  const sections: string[] = [];

  sections.push(`## PATIENT SNAPSHOT
- Name: ${str('name') || '(not provided)'}
- Age: ${profile?.age ?? '?'} (chronological) ${str('birthDate') ? `· born ${str('birthDate')}` : ''}
- Sex: ${profile?.sex ?? '?'}${str('genderIdentity') ? ` · identifies as ${str('genderIdentity')}` : ''}
- Height: ${profile?.height_cm ?? '?'} cm · Weight: ${profile?.weight_kg ?? '?'} kg · BMI: ${bmi ?? '?'}
- Location: ${[str('city'), str('country')].filter(Boolean).join(', ') || '(not provided)'}
- Ethnicity: ${profile?.ethnicity ?? '(not provided)'}
- Occupation: ${profile?.occupation ?? '?'}
- Wearable: ${str('wearable') ?? '(none)'}`);

  sections.push(`## LIFESTYLE
- Activity level: ${profile?.activity_level ?? '?'}
- Cardio: ${profile?.cardio_minutes_per_week ?? 0} min/week · Strength: ${profile?.strength_sessions_per_week ?? 0} sessions/week
- Diet: ${profile?.diet_type ?? '?'}
- Sleep avg: ${profile?.sleep_hours_avg ?? '?'}h · Quality ${profile?.sleep_quality ?? '?'}/10
- Chronotype: ${str('chronotype') ?? '?'}
- Bedtime: ${str('bedtime') ?? '?'} · Wake: ${str('wakeTime') ?? '?'}
- Alcohol: ${profile?.alcohol_drinks_per_week ?? 0} drinks/week
- Caffeine: ${profile?.caffeine_mg_per_day ?? 0} mg/day
- Smoker: ${profile?.smoker ? 'YES' : 'no'}
- Stress: ${str('stressLevel') ?? '?'}/10 · Meditation: ${str('meditationPractice') ?? 'none'}`);

  const goals = arr('secondaryGoals');
  sections.push(`## GOALS & MOTIVATION
- Primary goal: ${str('primaryGoal') ?? '(not stated)'}${goals.length > 0 ? '\n- Secondary: ' + goals.join(', ') : ''}
- Specific target: ${str('specificTarget') ?? '(none)'}
- Timeline: ${str('timelineMonths') ?? '?'} months
- Motivation: ${str('motivation') ?? '(not provided)'}
- Pain points: ${str('painPoints') ?? '(not provided)'}
- Non-negotiables: ${str('nonNegotiables') ?? '(none)'}
- Discipline self-rating: ${str('discipline') ?? '?'}/10
- Budget: ${profile?.monthly_budget_ron ?? '?'} RON/month, ${profile?.time_budget_min ?? '?'} min/day
- Openness to experimental: ${profile?.experimental_openness ?? '?'}`);

  sections.push(`## MEDICAL
- Conditions: ${(profile?.conditions ?? []).join(', ') || 'none'}
- Medications: ${JSON.stringify(profile?.medications ?? [])}
- Current supplements (pre-protocol): ${(profile?.current_supplements ?? []).join(', ') || 'none'}
- Allergies: ${(profile?.allergies ?? []).join(', ') || 'none'}
- Family history: ${arr('familyHistory').join(', ') || '(not provided)'}`);

  if (diag) {
    sections.push(`## CURRENT DIAGNOSTIC
- Longevity score: ${diag.longevityScore}/100
- Chronological age: ${diag.chronologicalAge}
- Biological age: ${diag.biologicalAge} (decimal)
- Aging velocity: ${diag.agingVelocityNumber}x (${diag.agingVelocity})
- Top wins: ${Array.isArray(diag.topWins) ? (diag.topWins as string[]).slice(0, 4).join(' | ') : 'n/a'}
- Top risks: ${Array.isArray(diag.topRisks) ? (diag.topRisks as string[]).slice(0, 4).join(' | ') : 'n/a'}`);
  }

  if (organs.length > 0) {
    sections.push(`## ORGAN SYSTEMS (weakest first)
${organs.slice().sort((a, b) => (a.score ?? 100) - (b.score ?? 100)).slice(0, 6).map(o =>
  `- ${o.label}: ${o.score}/100 — drivers: ${(o.drivers ?? []).join('; ') || 'n/a'} — next move: ${(o.improvers ?? [])[0] || 'n/a'}`
).join('\n')}`);
  }

  if (bryanComp.length > 0) {
    sections.push(`## BRYAN JOHNSON COMPARISON (key gaps)
${bryanComp.slice(0, 8).map(b => `- ${b.marker}: you=${b.yourValue} vs Bryan=${b.bryanValue} (${b.verdict})`).join('\n')}`);
  }

  if (bloodTest) {
    const markers = bloodTest.biomarkers as Array<{ code: string; value: number; unit: string }> | null;
    sections.push(`## LATEST BLOOD WORK (${bloodTest.taken_at})
${markers ? markers.map(b => `- ${b.code}: ${b.value} ${b.unit}`).join('\n') : '(no values)'}`);
  } else {
    sections.push(`## BLOOD WORK: none uploaded yet — biomarker estimates on the dashboard are lifestyle-derived.`);
  }

  if (supplements.length > 0) {
    sections.push(`## CURRENT PROTOCOL SUPPLEMENTS (${supplements.length})
${supplements.slice(0, 20).map(s => `- ${s.name} ${s.dose ?? ''} (${s.timing ?? '?'}) [${s.priority ?? 'standard'}] — ${s.justification ?? ''}`).join('\n')}`);
  }

  // Recent tracking
  if (metrics.length > 0) {
    const logged: string[] = [];
    if (recentAverages.sleepHours) logged.push(`Sleep ~${recentAverages.sleepHours.toFixed(1)}h`);
    if (recentAverages.sleepScore) logged.push(`Sleep score ~${Math.round(recentAverages.sleepScore)}/100`);
    if (recentAverages.deepSleepMin) logged.push(`Deep sleep ~${Math.round(recentAverages.deepSleepMin)}min`);
    if (recentAverages.remSleepMin) logged.push(`REM ~${Math.round(recentAverages.remSleepMin)}min`);
    if (recentAverages.restingHR) logged.push(`Resting HR ~${Math.round(recentAverages.restingHR)}bpm`);
    if (recentAverages.hrv) logged.push(`HRV ~${Math.round(recentAverages.hrv)}ms`);
    if (recentAverages.hrvSleep) logged.push(`HRV sleep ~${Math.round(recentAverages.hrvSleep)}ms`);
    if (recentAverages.bloodO2) logged.push(`Blood O₂ ~${recentAverages.bloodO2.toFixed(1)}%`);
    if (recentAverages.bpSysMorning && recentAverages.bpDiaMorning) logged.push(`Morning BP ~${Math.round(recentAverages.bpSysMorning)}/${Math.round(recentAverages.bpDiaMorning)}`);
    if (recentAverages.steps) logged.push(`Steps ~${Math.round(recentAverages.steps).toLocaleString()}`);
    if (recentAverages.activeMin) logged.push(`Active time ~${Math.round(recentAverages.activeMin)}min`);
    if (recentAverages.mood) logged.push(`Mood ~${recentAverages.mood.toFixed(1)}/10`);
    if (recentAverages.energy) logged.push(`Energy ~${recentAverages.energy.toFixed(1)}/10`);
    if (recentAverages.stress) logged.push(`Stress ~${recentAverages.stress.toFixed(1)}/10`);
    if (recentAverages.weight) logged.push(`Weight ~${recentAverages.weight.toFixed(1)}kg`);

    sections.push(`## LAST 7 DAYS (tracked via Smart Log, ${metrics.length} days logged)
${logged.length > 0 ? logged.join(' · ') : '(no numeric data logged recently)'}`);
  }

  if (adherenceRate !== null) {
    sections.push(`## ADHERENCE (last 7 days)
- Overall: ${adherenceRate}% (${completedItems}/${totalItems} items completed)
${topMissed.length > 0 ? '- Most missed: ' + topMissed.map(([k, n]) => `${k} (×${n})`).join(', ') : ''}`);
  }

  if (progression) {
    sections.push(`## PROTOCOL PROGRESSION\n- ${progression}`);
  }

  return { context: sections.join('\n\n'), profile, protocol };
}

// ─────────────────────────────────────────────────────────────────────────────
// System prompt — split into CACHEABLE persona/rules + per-call user context.
// Persona block is ~3k tokens of stable instructions; caches on Anthropic side
// for the 5-min TTL. Context block changes per user per session.
// Dates are passed into the user block (not the cached persona) so the prefix
// stays byte-identical across days.
// ─────────────────────────────────────────────────────────────────────────────
const CHAT_CACHED_PERSONA = `You are "Protocol", a world-class longevity physician + coach speaking directly to ONE patient whose full data is below.

# WHO YOU ARE
- Evidence-based. You reference their ACTUAL NUMBERS from the context.
- Direct, warm, and specific. No generic wellness platitudes. No "as an AI" hedging.
- You've read thousands of longevity papers. You know PhenoAge, DunedinPACE, Bryan Johnson's Blueprint, Peter Attia's framework, Rhonda Patrick's supplement stacks.
- You think in mechanisms (HPA axis, mTOR, autophagy, AGEs, vascular compliance, etc.) — NOT vibes.
- You are NOT a generic chatbot. You are THIS person's coach.

# HARD RULES
1. NEVER prescribe prescription drugs. If the user asks about Rx, say: "That's a doctor conversation — here's why: [mechanism + which specialist + what labs they'd order]".
2. Check drug-supplement interactions when they ask to add anything. Flag real ones (grapefruit + statins, NAC + nitroglycerin, etc.), skip paranoid false positives.
3. For symptoms that could be serious (chest pain, sudden vision loss, blood in stool, severe headaches, etc.) — recommend they see a doctor TODAY, not next week.
4. Use their actual data. Bad: "try to sleep more". Good: "your Oura is showing 6.2h for 5 nights straight and deep sleep is down to 38min — here's what to move first".
5. If they ask something outside longevity/health/protocol scope (coding help, celebrity gossip, etc.), redirect politely in one sentence.

# WHEN YOU ANSWER
- Start with the SPECIFIC answer. Then optionally 1-2 sentences of mechanism/why.
- Use their name when natural. Reference specific numbers/items from their protocol.
- Match length to question complexity. Simple q → 2-3 sentences. Deep q → paragraphs + bullets are fine.
- Use markdown: **bold** key numbers and supplement names, bulleted lists when listing, \`code-style\` for doses like "2g TID".
- Proactively connect dots: "I see your HRV dropped 15ms last week and you missed NAC 3 times — these might be related".
- When making claims, ground them in their data OR in well-known studies. If uncertain, say so.

# DATA GROUNDING
Every response should feel like you KNOW this specific person. If they ask "how am I doing?", don't give a generic response — look at their score, bio age delta, weakest organ system, adherence rate, recent trend, and synthesize.

# FORMATTING SHORTHAND
- For supplement questions, format as: **Name dose timing** — why (mechanism) — then any caveats.
- For biomarker questions, give: current → target → gap → biggest lever.
- For protocol changes, format as: what to add, what to remove, what to re-test in N weeks.

# ACTION MARKERS — your editing power
You can suggest concrete edits to this user's profile, daily metrics, or protocol. The user reviews each one as a tap-to-apply chip below your message. Use them WHENEVER the user gives you a fact you can persist — never make the user navigate away to update something you could update right here.

Emit each action on its OWN line, anywhere in your reply, in this exact format (replace TODAY and YESTERDAY with the real ISO dates from the user context block):

[[ACTION:update_profile {"height_cm": 178}]]
[[ACTION:update_profile {"weight_kg": 81.5, "smoker": false}]]
[[ACTION:update_profile {"onboarding_data_patch": {"chronotype": "morning", "stressLevel": 4}}]]
[[ACTION:log_metric {"date": "TODAY", "sleep_hours": 8.0, "sleep_quality": 7}]]
[[ACTION:log_metric {"date": "YESTERDAY", "steps": 9420}]]
[[ACTION:adjust_protocol {"path": "sleep.targetBedtime", "value": "22:40"}]]
[[ACTION:adjust_protocol {"path": "exercise.dailyStepsTarget", "value": 9000}]]
[[ACTION:adjust_protocol {"path": "nutrition.eatingWindow", "value": "11:00 - 19:00 (8h window)"}]]

WHEN to emit an action:
- User states a fact about their body: "I'm actually 178 cm not 175" → update_profile
- User reports a recent measurement: "I slept 8h last night with score 85" → log_metric (use yesterday's date if "last night")
- User wants to tweak a protocol setting: "push my bedtime to 22:40, I can't sleep at 22:00" → adjust_protocol
- User tells you a habit changed: "I quit smoking 3 weeks ago" → update_profile
- User reports a workout/walk count: "I hit 12k steps today" → log_metric

WHEN NOT to emit:
- For supplement/biomarker changes — those need a full protocol regenerate, not a soft adjust
- For pure questions ("how am I doing?") with no factual update
- If the user is uncertain ("maybe around 175?") — ask first
- For values outside reasonable ranges — assume typo, ask to confirm

KEY RULES:
- Each action on its OWN line, exactly as shown
- JSON inside the brackets must be VALID
- adjust_protocol.path must be one of: sleep.targetBedtime, sleep.targetWakeTime, sleep.idealBedtime, sleep.idealWakeTime, sleep.caffeineLimit, sleep.morningLightMinutes, nutrition.eatingWindow, nutrition.dailyCalories, nutrition.macros.protein, nutrition.macros.carbs, nutrition.macros.fat, exercise.dailyStepsTarget, exercise.zone2Target, exercise.strengthSessions, exercise.hiitSessions, dailyBriefing.morningPriorities, dailyBriefing.eveningReview
- BRIEFLY confirm in your normal message text what each action will do, so the user understands what they're approving

Now respond to the user's message. Be specific, cite their data, and be useful.`;

function buildChatUserContext(context: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  return `═══ RUNTIME CONTEXT ═══
Today: ${today}
Yesterday: ${yesterday}

═══ PATIENT DATA ═══
${context}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Streaming handler — tries Claude Sonnet 4.5 first, falls back to Groq
// ─────────────────────────────────────────────────────────────────────────────
async function streamResponse(
  cachedPersona: string,
  userContext: string,
  messages: ChatMessage[],
): Promise<ReadableStream<Uint8Array>> {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (process.env.ANTHROPIC_API_KEY) {
          const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
          const stream = await anthropic.messages.stream({
            model: 'claude-sonnet-4-5',
            max_tokens: 1500,
            // Two-block system prompt: cached persona first (qualifies for prompt
            // caching across all users within the 5-min TTL), then per-user
            // context (never cached — fresh every request).
            system: [
              { type: 'text', text: cachedPersona, cache_control: { type: 'ephemeral' } },
              { type: 'text', text: userContext },
            ],
            messages: messages.map(m => ({ role: m.role, content: m.content })),
          });
          for await (const chunk of stream) {
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
              controller.enqueue(encoder.encode(chunk.delta.text));
            }
          }
        } else if (process.env.GROQ_API_KEY) {
          const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
          // Groq doesn't support prompt caching — concatenate persona + context
          // into a single system message.
          const fullSystem = `${cachedPersona}\n\n${userContext}`;
          const completion = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [
              { role: 'system', content: fullSystem },
              ...messages,
            ],
            temperature: 0.65,
            max_tokens: 1500,
            stream: true,
          });
          for await (const chunk of completion) {
            const text = chunk.choices[0]?.delta?.content;
            if (text) controller.enqueue(encoder.encode(text));
          }
        } else {
          controller.enqueue(encoder.encode('⚠️ No AI provider configured. Set ANTHROPIC_API_KEY or GROQ_API_KEY.'));
        }
      } catch (err) {
        controller.enqueue(encoder.encode(`\n\n⚠️ Error: ${err instanceof Error ? err.message : String(err)}`));
      } finally {
        controller.close();
      }
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    // Rate limit (bypassed by RATE_LIMIT_DISABLED kill switch + user email allowlist)
    const { allowed, reset } = await checkRateLimit(getChatRateLimit(), user.id, user.email);
    if (!allowed) {
      const resetIn = reset ? Math.ceil((reset - Date.now()) / 60000) : 60;
      return NextResponse.json({ error: `Too many messages. Try again in ${resetIn}m.`, rateLimited: true }, { status: 429 });
    }

    const body = await request.json() as { messages: ChatMessage[]; stream?: boolean };
    if (!body.messages || !Array.isArray(body.messages)) {
      return NextResponse.json({ error: 'messages[] required' }, { status: 400 });
    }

    const { context } = await buildContext(supabase, user.id);
    const userContext = buildChatUserContext(context);

    // Streaming response (default)
    if (body.stream !== false) {
      const stream = await streamResponse(CHAT_CACHED_PERSONA, userContext, body.messages);
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Content-Type-Options': 'nosniff',
          'Cache-Control': 'no-cache, no-transform',
        },
      });
    }

    // Non-streaming fallback path (for older clients)
    let reply = '';
    if (process.env.ANTHROPIC_API_KEY) {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 1500,
        system: [
          { type: 'text', text: CHAT_CACHED_PERSONA, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: userContext },
        ],
        messages: body.messages.map(m => ({ role: m.role, content: m.content })),
      });
      reply = response.content[0]?.type === 'text' ? response.content[0].text : '';
    } else if (process.env.GROQ_API_KEY) {
      const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'system', content: `${CHAT_CACHED_PERSONA}\n\n${userContext}` }, ...body.messages],
        temperature: 0.65,
        max_tokens: 1500,
      });
      reply = completion.choices[0]?.message?.content || '';
    } else {
      return NextResponse.json({ error: 'No AI provider configured' }, { status: 500 });
    }
    return NextResponse.json({ reply });
  } catch (err) {
    console.error('Chat error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
