import { NextResponse } from 'next/server';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import Groq from 'groq-sdk';
import { createClient } from '@/lib/supabase/server';
import { logger, describeError } from '@/lib/logger';
import { checkRateLimit, getComplianceRateLimit } from '@/lib/rate-limit';
import { getAnthropicKey } from '@/lib/anthropic-key';

export const runtime = 'nodejs';
export const maxDuration = 30;

// F4 — Voice log
// ─────────────────────────────────────────────────────────────────────────────
// User on /tracking dictates a freeform sentence:
//   "Am dormit 7 ore, am mers 8000 de pași și mi-am luat magneziul de seară"
// The client transcribes it via Web Speech API and POSTs the transcript here.
// We pass it through Claude (with Groq fallback) using a strict, narrowly-
// scoped prompt that returns ONLY a daily_metrics-shaped JSON object — no
// chat, no explanation, no extra fields.
//
// The shape returned matches what /api/daily-metrics expects so the client
// can chain a save without further translation. We don't write to the DB
// from here — preview-before-save is the explicit pattern, matching the
// MealLogger UX.

const BodySchema = z.object({
  transcript: z.string().min(2).max(2000),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const PARSE_PROMPT_SYSTEM = `Ești un parser care convertește o propoziție liberă în română sau engleză într-un obiect JSON cu metrici zilnice.

Câmpuri permise (toate opționale, returnează doar pe cele detectate):
- weight_kg: number (kg)
- sleep_hours: number (ore, 0-14)
- sleep_quality: integer 1-10
- mood: integer 1-10
- energy: integer 1-10
- stress_level: integer 1-10
- hrv: number (ms)
- resting_hr: number (bpm)
- steps: integer
- workout_done: boolean
- workout_minutes: integer
- workout_intensity: 'low'|'medium'|'high'
- notes: string (max 200 chars)
- habits_completed: string[] (denumiri scurte de obiceiuri menționate)

REGULI STRICTE:
- Returnează DOAR JSON valid, fără markdown, fără comentarii.
- Nu inventa câmpuri. Nu inventa valori.
- Dacă propoziția nu descrie nimic relevant, returnează {}.
- "Am dormit prost" → sleep_quality: 3-4. "Am dormit excelent" → 9.
- "Am mers 8 mii de pași" → steps: 8000.
- "M-am antrenat" fără durată → workout_done: true (fără workout_minutes).
- "Sunt stresat" → stress_level: 7-8.

Răspunde DOAR cu obiectul JSON, începând cu { și terminând cu }.`;

interface ParsedMetrics {
  weight_kg?: number;
  sleep_hours?: number;
  sleep_quality?: number;
  mood?: number;
  energy?: number;
  stress_level?: number;
  hrv?: number;
  resting_hr?: number;
  steps?: number;
  workout_done?: boolean;
  workout_minutes?: number;
  workout_intensity?: string;
  notes?: string;
  habits_completed?: string[];
}

function parseJsonLoose(text: string): Record<string, unknown> {
  const cleaned = text.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim();
  try { return JSON.parse(cleaned); } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON in response');
    return JSON.parse(match[0]);
  }
}

// Strip nonsense fields the model may have hallucinated.
const ALLOWED_KEYS = new Set([
  'weight_kg', 'sleep_hours', 'sleep_quality', 'mood', 'energy',
  'stress_level', 'hrv', 'resting_hr', 'steps', 'workout_done',
  'workout_minutes', 'workout_intensity', 'notes', 'habits_completed',
]);

function sanitize(parsed: Record<string, unknown>): ParsedMetrics {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed)) {
    if (!ALLOWED_KEYS.has(k)) continue;
    if (v === null || v === undefined) continue;
    out[k] = v;
  }
  return out as ParsedMetrics;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    // Reuse the compliance limiter (200/h) — voice logs are an alternate path
    // to the same target table; same protection ceiling makes sense.
    const { allowed, reset } = await checkRateLimit(getComplianceRateLimit(), user.id, user.email);
    if (!allowed) {
      const resetIn = reset ? Math.max(1, Math.ceil((reset - Date.now()) / 60000)) : 60;
      return NextResponse.json({ error: `Prea multe cereri. Încearcă în ${resetIn}m.`, rateLimited: true }, { status: 429 });
    }

    const raw = await request.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'transcript required (2-2000 chars)' }, { status: 400 });
    }
    const { transcript } = parsed.data;

    // Try Claude (with BYOK if user set one), fall back to Groq.
    const anthropicResolved = await getAnthropicKey(supabase, user.id);
    let parsedJson: Record<string, unknown> | null = null;
    let modelUsed: string | null = null;

    if (anthropicResolved.key) {
      try {
        const anthropic = new Anthropic({ apiKey: anthropicResolved.key });
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-5',
          max_tokens: 600,
          system: PARSE_PROMPT_SYSTEM,
          messages: [{ role: 'user', content: transcript }],
        });
        const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
        parsedJson = parseJsonLoose(text);
        modelUsed = 'claude-sonnet-4-5';
      } catch (err) {
        logger.warn('voice_log.claude_failed', { errorMessage: describeError(err) });
      }
    }

    if (!parsedJson && process.env.GROQ_API_KEY) {
      try {
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        const completion = await groq.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: PARSE_PROMPT_SYSTEM },
            { role: 'user', content: transcript },
          ],
          temperature: 0.2,
          max_tokens: 600,
          response_format: { type: 'json_object' },
        });
        const text = completion.choices[0]?.message?.content || '';
        parsedJson = parseJsonLoose(text);
        modelUsed = 'llama-3.3-70b-versatile';
      } catch (err) {
        logger.warn('voice_log.groq_failed', { errorMessage: describeError(err) });
      }
    }

    if (!parsedJson) {
      return NextResponse.json({ error: 'Niciun model AI disponibil. Configurează ANTHROPIC_API_KEY sau GROQ_API_KEY.' }, { status: 503 });
    }

    const metrics = sanitize(parsedJson);
    return NextResponse.json({ metrics, model: modelUsed });
  } catch (err) {
    logger.error('voice_log.handler_failed', { errorMessage: describeError(err) });
    return NextResponse.json({ error: describeError(err) }, { status: 500 });
  }
}
