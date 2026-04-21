import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Groq from 'groq-sdk';
import { buildGroqParsingPrompt } from '@/lib/engine/master-prompt';
import { logger, describeError } from '@/lib/logger';
import { getParseBloodworkRateLimit, checkRateLimit } from '@/lib/rate-limit';
import { logAiTokens, usageFromGroq } from '@/lib/ai-costs';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    // Rate limit: 20/hour. Groq parse is the most expensive unmetered surface
    // (~$0.01/call). Without this, an attacker can burn ~$10 per 1000 retries.
    // 20/h is far above legit use (quarterly retest = 1-2 PDFs), so false
    // positives are effectively zero.
    const { allowed, reset } = await checkRateLimit(getParseBloodworkRateLimit(), user.id, user.email);
    if (!allowed) {
      const resetIn = reset ? Math.max(1, Math.ceil((reset - Date.now()) / 60000)) : 60;
      return NextResponse.json({ error: `Too many uploads. Try again in ${resetIn}m.`, rateLimited: true }, { status: 429 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    // Upper bound on the raw PDF: most lab reports are 1–8 pages / <2 MB. A
    // 10 MB cap is generous but stops someone from uploading a junk gigabyte
    // doc to burn Groq tokens or OOM the parser.
    const MAX_PDF_BYTES = 10 * 1024 * 1024;
    if (file.size > MAX_PDF_BYTES) {
      return NextResponse.json({ error: `PDF too large (${Math.round(file.size / 1024 / 1024)} MB, max 10 MB). Please upload the lab report only, not a full medical record archive.` }, { status: 413 });
    }

    // Extract text from PDF
    const buffer = Buffer.from(await file.arrayBuffer());
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse');
    const pdf = await pdfParse(buffer);
    const pdfText: string = pdf.text;

    if (!pdfText || pdfText.trim().length < 50) {
      return NextResponse.json({ error: 'Could not extract text from PDF. Try manual entry.' }, { status: 400 });
    }

    // Groq's Llama 3.3 context window is 128k tokens (~480k chars). Anything
    // past ~80k chars is almost certainly a scanned document or multi-report
    // dump — reject with a helpful message instead of paying for a failed
    // extraction attempt and showing the user an opaque Groq error.
    const MAX_PDF_TEXT_CHARS = 80_000;
    if (pdfText.length > MAX_PDF_TEXT_CHARS) {
      return NextResponse.json({
        error: `Lab report text is too long (${pdfText.length.toLocaleString()} chars, max ${MAX_PDF_TEXT_CHARS.toLocaleString()}). Upload a single lab report — scanned PDFs / multi-report archives aren't supported yet.`,
      }, { status: 413 });
    }

    // Send to Groq for structured extraction
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const prompt = buildGroqParsingPrompt(pdfText);

    const aiStartMs = Date.now();
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
    const usage = usageFromGroq(completion.usage);
    logAiTokens({
      op: 'parse_bloodwork',
      model: 'llama-3.3-70b-versatile',
      userId: user.id,
      latencyMs: Date.now() - aiStartMs,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      extra: { pdfChars: pdfText.length },
    });
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
