import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Groq from 'groq-sdk';
import { z } from 'zod';
import { classifyAll, calculateLongevityScore, estimateBiologicalAge } from '@/lib/engine/classifier';
import { detectPatterns } from '@/lib/engine/patterns';
import { BIOMARKER_DB } from '@/lib/engine/biomarkers';
import { buildMasterPromptV2 } from '@/lib/engine/master-prompt';
import { BiomarkerValue } from '@/lib/types';

export const maxDuration = 60;

// Minimal Zod schema for protocol validation
const ProtocolSchema = z.object({
  diagnostic: z.object({
    biologicalAge: z.number(),
    chronologicalAge: z.number(),
    longevityScore: z.number(),
    topWins: z.array(z.string()).default([]),
    topRisks: z.array(z.string()).default([]),
  }).passthrough(),
  nutrition: z.object({
    dailyCalories: z.number(),
    macros: z.object({ protein: z.number(), carbs: z.number(), fat: z.number() }),
  }).passthrough(),
  supplements: z.array(z.object({
    name: z.string(),
    dose: z.string(),
    priority: z.string(),
  }).passthrough()).default([]),
}).passthrough();

export async function POST(request: Request) {
  const startTime = Date.now();

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { profile, biomarkers } = await request.json();
    const biomarkerValues: BiomarkerValue[] = biomarkers || [];

    // Local classification (instant)
    const classified = classifyAll(biomarkerValues);
    const patterns = detectPatterns(classified);
    const longevityScore = calculateLongevityScore(classified);
    const biologicalAge = estimateBiologicalAge(profile.age, classified);

    // Build master prompt
    const prompt = buildMasterPromptV2(profile, classified, patterns, BIOMARKER_DB, longevityScore, biologicalAge);
    const promptHash = simpleHash(prompt);

    let protocolJson: Record<string, unknown>;
    let modelUsed = 'llama-3.3-70b-versatile';

    // Try Claude Opus first if API key available
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const { default: Anthropic } = await import('@anthropic-ai/sdk');
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        modelUsed = 'claude-sonnet-4-20250514';

        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 16000,
          messages: [{ role: 'user', content: prompt }],
        });

        const text = response.content[0].type === 'text' ? response.content[0].text : '';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON in Claude response');
        protocolJson = JSON.parse(jsonMatch[0]);
      } catch (claudeErr) {
        console.error('Claude failed, falling back to Groq:', claudeErr);
        protocolJson = await generateWithGroq(prompt);
        modelUsed = 'llama-3.3-70b-versatile';
      }
    } else {
      protocolJson = await generateWithGroq(prompt);
    }

    // Validate with Zod (lenient — passthrough unknown fields)
    const validation = ProtocolSchema.safeParse(protocolJson);
    if (!validation.success) {
      console.warn('Protocol validation warnings:', validation.error.issues.map(i => i.message));
      // Don't fail — use what we have, the AI output is "good enough"
    }

    // Always add biomarker readout from our classifier (more reliable than AI)
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

    const generationTime = Date.now() - startTime;

    // Save to database
    await supabase.from('protocols').insert({
      user_id: user.id,
      protocol_json: protocolJson,
      classified_biomarkers: classified,
      detected_patterns: patterns,
      longevity_score: longevityScore,
      biological_age: biologicalAge,
      model_used: modelUsed,
      prompt_hash: promptHash,
      generation_time_ms: generationTime,
    });

    return NextResponse.json({ protocol: protocolJson, longevityScore, biologicalAge, patterns, generationTime, modelUsed });
  } catch (err) {
    console.error('Protocol generation error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

async function generateWithGroq(prompt: string): Promise<Record<string, unknown>> {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: 'You are a longevity medicine expert. Respond ONLY with valid JSON. No markdown, no backticks, no explanation — ONLY the JSON object. Ensure all JSON is properly formatted with no trailing commas.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
    max_tokens: 16000,
  });

  const text = completion.choices[0]?.message?.content || '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found in Groq response');
  return JSON.parse(jsonMatch[0]);
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}
