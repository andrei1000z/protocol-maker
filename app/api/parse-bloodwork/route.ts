import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Groq from 'groq-sdk';
import { buildGroqParsingPrompt } from '@/lib/engine/master-prompt';
import { logger, describeError } from '@/lib/logger';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    // Extract text from PDF
    const buffer = Buffer.from(await file.arrayBuffer());
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse');
    const pdf = await pdfParse(buffer);
    const pdfText = pdf.text;

    if (!pdfText || pdfText.trim().length < 50) {
      return NextResponse.json({ error: 'Could not extract text from PDF. Try manual entry.' }, { status: 400 });
    }

    // Send to Groq for structured extraction
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const prompt = buildGroqParsingPrompt(pdfText);

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'You are a medical lab report parser. Return ONLY a JSON array. No other text.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 4000,
    });

    const text = completion.choices[0]?.message?.content || '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);

    if (!jsonMatch) {
      return NextResponse.json({ error: 'Could not parse biomarkers from PDF' }, { status: 500 });
    }

    const parsedBiomarkers = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ biomarkers: parsedBiomarkers, rawTextLength: pdfText.length });
  } catch (err) {
    logger.error('parse_bloodwork.failed', { errorMessage: describeError(err) });
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
