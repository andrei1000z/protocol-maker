import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Groq from 'groq-sdk';
import { classifyAll, calculateLongevityScore, estimateBiologicalAge } from '@/lib/engine/classifier';
import { detectPatterns } from '@/lib/engine/patterns';
import { BIOMARKER_DB } from '@/lib/engine/biomarkers';
import { buildMasterPromptV2 as buildMasterPrompt } from '@/lib/engine/master-prompt';
import { BiomarkerValue } from '@/lib/types';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { profile, biomarkers } = await request.json();
    const biomarkerValues: BiomarkerValue[] = biomarkers || [];

    // Classify biomarkers
    const classified = classifyAll(biomarkerValues);
    const patterns = detectPatterns(classified);
    const longevityScore = calculateLongevityScore(classified);
    const biologicalAge = estimateBiologicalAge(profile.age, classified);

    // Build master prompt
    const prompt = buildMasterPrompt(profile, classified, patterns, BIOMARKER_DB, longevityScore, biologicalAge);

    // Call Groq
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'Ești un expert în longevitate. Răspunzi DOAR cu JSON valid. Niciun text suplimentar, niciun markdown, niciun backtick. DOAR JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 8000,
    });

    const text = completion.choices[0]?.message?.content || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
    }

    const protocolJson = JSON.parse(jsonMatch[0]);

    // Add biomarker readout from our classifier (more reliable than AI)
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
