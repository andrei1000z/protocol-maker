import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { buildProtocolPrompt } from '@/lib/protocol-generator';
import { GeneratedProtocol, MacroTargets } from '@/lib/types';
import { DEFAULT_MACRO_TARGETS } from '@/lib/constants';

export async function POST(request: Request) {
  const body = await request.json();
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return NextResponse.json(generateFallbackProtocol(body));
  }

  try {
    const client = new Groq({ apiKey });
    const prompt = buildProtocolPrompt(body);

    const completion = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'Ești un nutriționist și trainer personal expert. Răspunzi DOAR cu JSON valid, fără markdown, fără backticks, fără explicații suplimentare.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const text = completion.choices[0]?.message?.content || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(generateFallbackProtocol(body));
    }

    const protocol: GeneratedProtocol = JSON.parse(jsonMatch[0]);

    if (!protocol.macroTargets || !protocol.dailyTasks) {
      return NextResponse.json(generateFallbackProtocol(body));
    }

    return NextResponse.json(protocol);
  } catch (err) {
    console.error('Groq API error:', err);
    return NextResponse.json(generateFallbackProtocol(body));
  }
}

function generateFallbackProtocol(data: {
  age: number;
  sex: string;
  weight: number;
  height: number;
  goals: string[];
  fitnessLevel: string;
}): GeneratedProtocol {
  const isLoss = data.goals.some((g: string) => g.includes('Slăbire'));
  const isGain = data.goals.some((g: string) => g.includes('Masă'));
  const multiplier = isLoss ? 22 : isGain ? 32 : 26;
  const calories = Math.round(data.weight * multiplier);
  const protein = Math.round(data.weight * (isGain ? 2.2 : 1.8));

  const macros: MacroTargets = {
    calories,
    protein,
    fat: Math.round((calories * 0.25) / 9),
    carbs: Math.round((calories - protein * 4 - Math.round((calories * 0.25) / 9) * 9) / 4),
  };

  return {
    macroTargets: macros.calories > 0 ? macros : DEFAULT_MACRO_TARGETS,
    dailyTasks: [
      { name: 'Bea un pahar de apă la trezire', category: 'dimineață' },
      { name: '5 min stretching', category: 'dimineață' },
      { name: 'Mic dejun bogat în proteine', category: 'nutriție' },
      { name: 'Antrenament 45-60 min', category: 'antrenament' },
      { name: 'Post-workout protein shake', category: 'antrenament' },
      { name: '10.000 pași', category: 'antrenament' },
      { name: 'Prânz echilibrat', category: 'nutriție' },
      { name: 'Gustare sănătoasă', category: 'nutriție' },
      { name: 'Cină ușoară', category: 'nutriție' },
      { name: 'Meditație/Journaling 10 min', category: 'seară' },
      { name: 'Oprire ecrane cu 1h înainte de somn', category: 'seară' },
      { name: '7-9 ore somn', category: 'sănătate' },
      { name: 'Tracked toate mesele', category: 'sănătate' },
    ],
    supplements: [
      { name: 'Vitamina D3', dose: '2000 IU', timing: 'Dimineața' },
      { name: 'Omega-3', dose: '1000mg', timing: 'Cu masa' },
      { name: 'Magneziu', dose: '300mg', timing: 'Seara' },
      { name: 'Creatină', dose: '5g', timing: 'Oricând' },
      { name: 'Vitamina C', dose: '500mg', timing: 'Dimineața' },
    ],
    tips: [
      'Bea cel puțin 8 pahare de apă pe zi',
      'Mănâncă proteină la fiecare masă principală',
      'Dormitul suficient e la fel de important ca antrenamentul',
      'Consistența bate perfecțiunea - fă puțin în fiecare zi',
    ],
    warnings:
      data.age < 16
        ? ['Sub 16 ani - evită suplimentele avansate și consultă un medic']
        : [],
    summary: `Protocol personalizat pentru ${data.goals.join(' și ').toLowerCase()}. Focus pe ${calories} kcal/zi cu ${protein}g proteine, antrenament regulat și recuperare adecvată.`,
  };
}
