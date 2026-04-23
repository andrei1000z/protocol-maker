// POST /api/meals/analyze — vision + text meal analysis.
//
// Input: multipart form with any combination of:
//   - `file`:      image of the meal (JPEG / PNG / WebP, ≤ 8MB)
//   - `userText`:  free-text description ("chicken rice + avocado")
//   - `eatenAt`:   ISO timestamp (defaults to now)
// At least one of `file` or `userText` is required.
//
// Output: structured JSON (title / ingredients / macros / verdict / reasons).
// The row is NOT persisted here — caller reviews the analysis, edits if
// needed, then POSTs the confirmed shape to /api/meals to save.
//
// Photo is discarded after the Claude call. Zero photo storage, minimal
// GDPR surface. Users re-photograph to re-analyze.
//
// Rate-limited aggressively (30/day) because vision is the single most
// expensive call in the app.

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import Groq from 'groq-sdk';
import { createClient } from '@/lib/supabase/server';
import { getMealAnalyzeRateLimit, checkRateLimit } from '@/lib/rate-limit';
import { logger, describeError } from '@/lib/logger';
import { logAiTokens, usageFromAnthropic, usageFromGroq } from '@/lib/ai-costs';
import { MealAnalysisSchema, parseMealJson } from '@/lib/engine/meals';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Keep the upload cap well under Anthropic's 5MB-per-image limit to account
// for base64 overhead (~33%). 3.5MB raw ≈ 4.6MB base64 — safe.
const MAX_IMAGE_BYTES = 3.5 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    // Rate limit first — before any multipart parsing, so an abuser can't
    // even make us read the upload body past the 429 line.
    const { allowed, reset } = await checkRateLimit(getMealAnalyzeRateLimit(), user.id, user.email);
    if (!allowed) {
      const resetIn = reset ? Math.max(1, Math.ceil((reset - Date.now()) / 3600_000)) : 24;
      return NextResponse.json({ error: `Meal analysis limit reached (30/day). Try again in ${resetIn}h.`, rateLimited: true }, { status: 429 });
    }

    let formData: FormData;
    try { formData = await request.formData(); }
    catch { return NextResponse.json({ error: 'Invalid multipart form body' }, { status: 400 }); }

    const file = formData.get('file');
    const userText = String(formData.get('userText') ?? '').trim();
    const eatenAtRaw = String(formData.get('eatenAt') ?? '');
    // Validate eatenAt — rejecting garbage here is cheaper than passing it
    // through the AI call and discovering at DB insert time.
    const eatenAt = eatenAtRaw && !Number.isNaN(Date.parse(eatenAtRaw))
      ? new Date(eatenAtRaw).toISOString()
      : new Date().toISOString();

    const hasImage = file instanceof File && file.size > 0;
    if (!hasImage && !userText) {
      return NextResponse.json({ error: 'Send at least a photo or a text description' }, { status: 400 });
    }

    let imageBase64: string | null = null;
    let imageMime: string | null = null;
    if (hasImage) {
      if (!ALLOWED_MIME.has(file.type)) {
        return NextResponse.json({ error: `Unsupported image type: ${file.type}` }, { status: 415 });
      }
      if (file.size > MAX_IMAGE_BYTES) {
        return NextResponse.json({ error: `Image too large (${(file.size / 1024 / 1024).toFixed(1)}MB, max 3.5MB)` }, { status: 413 });
      }
      // HEIC comes out of iOS cameras by default; Anthropic accepts it via
      // media_type image/heic, so we let it through without conversion.
      imageBase64 = Buffer.from(await file.arrayBuffer()).toString('base64');
      imageMime = file.type;
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;
    if (!anthropicKey && !groqKey) {
      return NextResponse.json({ error: 'AI provider not configured (set ANTHROPIC_API_KEY or GROQ_API_KEY).' }, { status: 500 });
    }

    const source: 'photo' | 'text' | 'photo_with_text' =
      hasImage && userText ? 'photo_with_text' : hasImage ? 'photo' : 'text';

    // Prompt is identical for both providers — Groq's OpenAI-style messages
    // API puts the system prompt in a "system" role instead of Anthropic's
    // top-level `system` field, but the text is the same.
    const SYSTEM_PROMPT = `You are a nutrition-aware meal analyzer. A user is logging what they just ate — either a photo, a short text description, or both.

Return ONE JSON object, and nothing else (no markdown, no preamble, no trailing commentary). Start with { and end with }.

Required shape:
{
  "title": "short, specific meal name (e.g. 'Grilled salmon with quinoa and broccoli', not 'Dinner')",
  "description": "1-2 sentences describing what's on the plate and how it was prepared",
  "ingredients": ["array", "of", "visible", "or", "stated", "ingredients"],
  "calories":  number (kcal — best estimate for the portion visible),
  "protein_g": number,
  "carbs_g":   number,
  "fat_g":     number,
  "fiber_g":   number,
  "verdict":   "good" | "mixed" | "bad",
  "verdict_reasons": ["short punchy reasons", "max 5"]
}

Verdict criteria (be decisive — avoid hedging):
- "good":  whole-food, balanced macros, minimal ultra-processed ingredients, appropriate portion for the time of day
- "mixed": has real nutritional value but something specific is off (too low protein, excess added sugar, fried prep, big oil content, heavy sodium)
- "bad":   predominantly ultra-processed, very high sugar/sodium/saturated fat, or low nutritional density for the calories

Rules:
- If macros are uncertain (e.g. a salad with unclear dressing), use population-typical values for that dish — don't refuse to estimate.
- If you cannot identify the meal at all (blurry photo, empty plate, non-food image), return verdict:"mixed" with title:"Unclear" and explain in verdict_reasons.
- NEVER include markdown, \`\`\` fences, or text outside the JSON object.
- Keep verdict_reasons short: 5-15 words each, specific not generic ("Low protein relative to carbs" > "Could be more balanced").`;

    const userTextBody = userText
      ? `User's description: ${userText}\n\nAnalyze and return the JSON.`
      : 'Analyze the photo and return the JSON.';

    const aiStartMs = Date.now();
    let rawText = '';
    let modelUsed: 'claude-sonnet-4-5' | 'meta-llama/llama-4-scout-17b-16e-instruct' = 'claude-sonnet-4-5';
    let tokenUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 };
    let lastError: unknown = null;

    // Try Claude first — better vision + JSON reliability. Fall back to Groq
    // (Llama 4 Scout, multimodal) if Claude is missing or fails. If Claude
    // isn't configured at all, skip straight to Groq.
    if (anthropicKey) {
      try {
        const anthropic = new Anthropic({ apiKey: anthropicKey });
        const userContent: Anthropic.MessageParam['content'] = [];
        if (imageBase64 && imageMime) {
          userContent.push({
            type: 'image',
            source: { type: 'base64', media_type: imageMime as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif', data: imageBase64 },
          });
        }
        userContent.push({ type: 'text', text: userTextBody });

        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-5',
          max_tokens: 1500,
          // Cache the system prompt across meals for this user. At ~700 tokens
          // cached × 3-5 meals/day, saves ~3000 tokens/user/day on input.
          system: [
            { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
          ],
          messages: [{ role: 'user', content: userContent }],
        });

        const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
        if (!textBlock?.text) throw new Error('Claude returned empty response');
        rawText = textBlock.text;
        const usage = usageFromAnthropic(response.usage);
        tokenUsage = {
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          cacheReadTokens: usage.cacheReadTokens ?? 0,
          cacheCreationTokens: usage.cacheCreationTokens ?? 0,
        };
      } catch (err) {
        lastError = err;
        logger.warn('meal_analyze.claude_failed_fallback_groq', {
          userId: user.id,
          errorMessage: describeError(err),
          hasGroqKey: !!groqKey,
        });
      }
    }

    // Groq fallback — Llama 4 Scout is multimodal and handles base64 images
    // via OpenAI-style `image_url` content. Only used if Claude failed or is
    // not configured.
    if (!rawText && groqKey) {
      try {
        const groq = new Groq({ apiKey: groqKey });
        // Groq accepts OpenAI-style content arrays; images go in as data URLs.
        const userContent: Groq.Chat.ChatCompletionContentPart[] = [];
        if (imageBase64 && imageMime) {
          userContent.push({
            type: 'image_url',
            image_url: { url: `data:${imageMime};base64,${imageBase64}` },
          });
        }
        userContent.push({ type: 'text', text: userTextBody });

        const completion = await groq.chat.completions.create({
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          max_tokens: 1500,
          temperature: 0.3,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userContent },
          ],
        });
        const text = completion.choices[0]?.message?.content?.trim() ?? '';
        if (!text) throw new Error('Groq returned empty response');
        rawText = text;
        modelUsed = 'meta-llama/llama-4-scout-17b-16e-instruct';
        const usage = usageFromGroq(completion.usage);
        tokenUsage = {
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          cacheReadTokens: 0,
          cacheCreationTokens: 0,
        };
      } catch (err) {
        lastError = err;
        logger.error('meal_analyze.groq_failed', { userId: user.id, errorMessage: describeError(err) });
      }
    }

    if (!rawText) {
      logger.error('meal_analyze.all_providers_failed', { userId: user.id, errorMessage: describeError(lastError) });
      return NextResponse.json({ error: 'Analysis failed. Try again in a moment.' }, { status: 502 });
    }

    logAiTokens({
      op: 'meal_analyze',
      model: modelUsed,
      userId: user.id,
      latencyMs: Date.now() - aiStartMs,
      inputTokens: tokenUsage.inputTokens,
      outputTokens: tokenUsage.outputTokens,
      cacheReadTokens: tokenUsage.cacheReadTokens,
      cacheCreationTokens: tokenUsage.cacheCreationTokens,
      extra: { source, hasImage, hasText: userText.length > 0 },
    });

    let parsed: unknown;
    try { parsed = parseMealJson(rawText); }
    catch (err) {
      logger.warn('meal_analyze.parse_failed', { userId: user.id, model: modelUsed, errorMessage: describeError(err) });
      return NextResponse.json({ error: 'Could not parse AI response. Try again.' }, { status: 502 });
    }

    const validated = MealAnalysisSchema.safeParse(parsed);
    if (!validated.success) {
      logger.warn('meal_analyze.schema_drift', {
        userId: user.id,
        model: modelUsed,
        issues: validated.error.issues.slice(0, 5).map(i => ({ path: i.path.join('.'), code: i.code })),
      });
      return NextResponse.json({ error: 'AI response shape invalid. Try again.' }, { status: 502 });
    }

    return NextResponse.json({
      analysis: validated.data,
      source,
      eatenAt,
      userText: userText || null,
      model: modelUsed,
      tokens: {
        input: tokenUsage.inputTokens,
        output: tokenUsage.outputTokens,
        cacheRead: tokenUsage.cacheReadTokens,
      },
    });
  } catch (err) {
    logger.error('meal_analyze.handler_failed', { errorMessage: describeError(err) });
    return NextResponse.json({ error: describeError(err) }, { status: 500 });
  }
}
