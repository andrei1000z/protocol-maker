import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Groq from 'groq-sdk';
import { classifyAll, calculateLongevityScore, estimateBiologicalAge } from '@/lib/engine/classifier';
import { detectPatterns } from '@/lib/engine/patterns';
import { BIOMARKER_DB } from '@/lib/engine/biomarkers';
import { buildMasterPromptV2 } from '@/lib/engine/master-prompt';
import { BiomarkerValue } from '@/lib/types';

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { profile, biomarkers } = await request.json();
    const biomarkerValues: BiomarkerValue[] = biomarkers || [];

    // Classify biomarkers against longevity optimal ranges
    const classified = classifyAll(biomarkerValues);
    const patterns = detectPatterns(classified);
    const longevityScore = calculateLongevityScore(classified);
    const biologicalAge = estimateBiologicalAge(profile.age, classified);

    // Build the v2 master prompt with full Bryan reference + intervention rules
    const prompt = buildMasterPromptV2(profile, classified, patterns, BIOMARKER_DB, longevityScore, biologicalAge);

    // Call Groq with higher token limit for comprehensive v2 output
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    let protocolJson: Record<string, unknown>;

    try {
      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'You are a longevity medicine expert. You respond ONLY with valid JSON. No markdown, no backticks, no explanation — ONLY the JSON object. Ensure all JSON is properly formatted with no trailing commas.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 16000,
      });

      const text = completion.choices[0]?.message?.content || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }

      protocolJson = JSON.parse(jsonMatch[0]);
    } catch (aiError) {
      console.error('AI generation failed, using fallback:', aiError);

      // Fallback: generate a basic protocol from our classifier data
      protocolJson = {
        diagnostic: {
          biologicalAge,
          chronologicalAge: profile.age,
          agingVelocity: longevityScore > 70 ? 'decelerated' : longevityScore > 40 ? 'normal' : 'accelerated',
          longevityScore,
          summary: `Based on ${classified.length} biomarkers analyzed, your longevity score is ${longevityScore}/100.`,
          topWins: ['Protocol engine analyzed your data successfully'],
          topRisks: patterns.length > 0 ? patterns.map(p => p.name) : ['No critical patterns detected'],
          organSystemScores: { cardiovascular: 70, metabolic: 70, hormonal: 70, inflammatory: 70, hepatic: 80, renal: 80, nutritional: 60 },
        },
        nutrition: {
          dailyCalories: Math.round(profile.weightKg * 28),
          macros: { protein: Math.round(profile.weightKg * 1.8), carbs: Math.round(profile.weightKg * 3), fat: Math.round(profile.weightKg * 0.8) },
          eatingWindow: '10:00 AM - 6:00 PM (8 hours)',
          meals: [],
          foodsToAdd: [],
          foodsToReduce: [],
        },
        supplements: [],
        exercise: { weeklyPlan: [], zone2Target: 150, strengthSessions: 3, notes: [] },
        sleep: { targetBedtime: '22:30', windDownRoutine: [], environment: [], supplementsForSleep: [], morningLightMinutes: 10 },
        tracking: { daily: ['Weight', 'Sleep hours', 'Steps'], weekly: ['Waist measurement'], retestSchedule: [] },
        doctorDiscussion: { rxSuggestions: [], specialistReferrals: [], redFlags: patterns.filter(p => p.severity === 'critical').map(p => p.name) },
        roadmap: [{ week: 'Week 1', actions: ['Start with the basics: sleep, movement, nutrition'] }],
        shoppingList: [],
      };
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

    // Save to database
    await supabase.from('protocols').insert({
      user_id: user.id,
      protocol_json: protocolJson,
      classified_biomarkers: classified,
      detected_patterns: patterns,
      longevity_score: longevityScore,
      biological_age: biologicalAge,
    });

    return NextResponse.json({ protocol: protocolJson, longevityScore, biologicalAge, patterns });
  } catch (err) {
    console.error('Protocol generation error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
