// Centralized AI-cost accounting. The providers return raw usage counts
// (tokens in / tokens out / cache read / cache creation); translating those
// into dollars-per-call belongs in one place so a pricing change means one
// edit instead of five.
//
// Every AI route (generate-protocol, cron daily-regenerate, chat, parse-bloodwork)
// emits a structured log event via `logAiTokens` so ops can grep:
//   logger event = ai.tokens
//   fields:       userId, model, op, inputTokens, outputTokens, cacheRead,
//                 cacheCreate, estCostUsd, latencyMs
//
// Those events are the ONLY way to see real per-user cost and prompt-cache
// hit-rate. Without them, AI spend spirals invisibly until the credit-card
// bill lands.

import { logger } from '@/lib/logger';

// Current list prices (USD per million tokens) as of 2026-Q1. If Anthropic or
// Groq update pricing, change these and every downstream cost estimate stays
// accurate.
//
// Anthropic: https://www.anthropic.com/pricing
// Groq:     https://groq.com/pricing
export const AI_PRICING: Record<string, { input: number; output: number; cacheRead?: number; cacheCreate?: number }> = {
  // Claude Sonnet 4.5: cache writes cost 1.25× base input, cache reads cost 0.1×.
  'claude-sonnet-4-5':        { input: 3.00, output: 15.00, cacheRead: 0.30, cacheCreate: 3.75 },
  // Groq inference is substantially cheaper and does not support caching.
  'llama-3.3-70b-versatile':  { input: 0.59, output: 0.79 },
  // Llama 4 Scout — Groq's multimodal model used as meal-vision fallback.
  'meta-llama/llama-4-scout-17b-16e-instruct': { input: 0.11, output: 0.34 },
  // Deterministic fallback is free — logging it keeps the event shape uniform.
  'fallback':                 { input: 0, output: 0 },
};

export interface AiTokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
}

/** Compute USD cost from a usage record + model price table. Rounds to 6dp
 *  so summations stay exact down to 1e-6 (one token on the cheapest model
 *  costs ~6e-7 USD; rounding to 6dp is the right granularity). */
export function estimateCostUsd(model: string, usage: AiTokenUsage): number {
  const price = AI_PRICING[model];
  if (!price) return 0;
  const input       = (usage.inputTokens         || 0) * price.input        / 1_000_000;
  const output      = (usage.outputTokens        || 0) * price.output       / 1_000_000;
  const cacheRead   = (usage.cacheReadTokens     || 0) * (price.cacheRead   ?? price.input) / 1_000_000;
  const cacheCreate = (usage.cacheCreationTokens || 0) * (price.cacheCreate ?? price.input) / 1_000_000;
  return Math.round((input + output + cacheRead + cacheCreate) * 1_000_000) / 1_000_000;
}

interface LogAiTokensArgs extends AiTokenUsage {
  /** Which endpoint made the call — e.g. 'protocol.generate', 'cron.regen', 'chat.stream'. */
  op: string;
  /** Model name as reported by the provider ('claude-sonnet-4-5' etc). */
  model: string;
  /** End-user the call was made on behalf of (null for system calls). */
  userId?: string | null;
  /** Wall-clock latency for the call, if available. */
  latencyMs?: number;
  /** Optional extra context — endpoint-specific flags that help debugging. */
  extra?: Record<string, unknown>;
}

/** Emit a single `ai.tokens` log line per AI call. Call at the end of the
 *  request path, AFTER the provider returned usage (don't block the response
 *  on it). Never throws — logging failures must not break the user flow. */
export function logAiTokens(args: LogAiTokensArgs): void {
  try {
    const estCostUsd = estimateCostUsd(args.model, args);
    logger.info('ai.tokens', {
      op:               args.op,
      model:            args.model,
      userId:           args.userId ?? null,
      inputTokens:      args.inputTokens,
      outputTokens:     args.outputTokens,
      cacheReadTokens:  args.cacheReadTokens ?? 0,
      cacheCreateTokens: args.cacheCreationTokens ?? 0,
      estCostUsd,
      latencyMs:        args.latencyMs,
      ...(args.extra || {}),
    });
  } catch { /* logging must never throw — swallow */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider-shape adapters — each SDK hands back usage in a slightly different
// shape. These helpers normalize to our AiTokenUsage so callers don't repeat
// the conditionals.
// ─────────────────────────────────────────────────────────────────────────────

/** Anthropic Messages API usage — optional cache_* fields appear only when
 *  cache_control was set on a system block. */
export function usageFromAnthropic(usage: {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
} | undefined | null): AiTokenUsage {
  return {
    inputTokens:         usage?.input_tokens ?? 0,
    outputTokens:        usage?.output_tokens ?? 0,
    cacheReadTokens:     usage?.cache_read_input_tokens ?? 0,
    cacheCreationTokens: usage?.cache_creation_input_tokens ?? 0,
  };
}

/** Groq / OpenAI-style usage — flat prompt_tokens + completion_tokens. */
export function usageFromGroq(usage: {
  prompt_tokens?: number;
  completion_tokens?: number;
} | undefined | null): AiTokenUsage {
  return {
    inputTokens:  usage?.prompt_tokens ?? 0,
    outputTokens: usage?.completion_tokens ?? 0,
  };
}
