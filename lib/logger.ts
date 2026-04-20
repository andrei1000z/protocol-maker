// Structured server-side logger.
//
// Why: API routes were peppered with `console.error('Chat error:', err)` which
// dumps the full Error object — including its `cause` chain that often carries
// raw request bodies, system prompt fragments, and user PII. Vercel logs are
// kept ~30 days and auto-indexed, so this becomes a privacy + searchable-leak
// problem fast.
//
// This wrapper produces JSON lines that are:
//   - structured (event name + scope + ctx fields, not free-form text)
//   - PII-redacted by an explicit allowlist of safe fields
//   - greppable by event name in Vercel/Logtail/Sentry
//   - cheap (no extra deps, just JSON.stringify with sentinel keys redacted)
//
// Usage:
//   logger.error('chat.stream_failed', { userId: user.id, errorMessage: err.message });
//   logger.warn('cron.user_skipped',   { userId, reason: 'inactive_7d' });
//   logger.info('protocol.generated',  { userId, durationMs, source: 'claude' });
//
// Log sink: Vercel Functions ship console.* to its log stream, which is
// easy to tail in the dashboard and cheap to forward to Logtail / Datadog /
// Better Stack via Vercel Log Drains. No third-party SDK is wired here
// intentionally — when we want Sentry or similar, add it here and keep the
// redaction step above intact.

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Fields that are NEVER serialized — even if you accidentally pass them in.
// Add anything that could carry credentials, raw prompts, or full bodies.
const REDACTED_KEYS = new Set([
  'password', 'token', 'authorization', 'cookie', 'secret',
  'apiKey', 'api_key', 'serviceRoleKey', 'service_role_key',
  'prompt', 'systemPrompt', 'context', 'rawBody', 'body',
  // Anthropic + Groq response shapes that include the full reply
  'completion', 'choices', 'content',
]);

function redact(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (depth > 3) return '[depth-limit]';
  if (typeof value === 'string') {
    return value.length > 500 ? value.slice(0, 500) + `…(+${value.length - 500} chars)` : value;
  }
  if (Array.isArray(value)) return value.slice(0, 20).map(v => redact(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (REDACTED_KEYS.has(k.toLowerCase())) { out[k] = '[redacted]'; continue; }
      out[k] = redact(v, depth + 1);
    }
    return out;
  }
  return value;
}

function emit(level: LogLevel, event: string, ctx?: Record<string, unknown>) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    ...((ctx ? redact(ctx) : {}) as Record<string, unknown>),
  };
  // Vercel Functions ship console.* to its log stream automatically. JSON
  // lines are parseable downstream by Logtail / Datadog / Better Stack.
  const line = JSON.stringify(payload);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (event: string, ctx?: Record<string, unknown>) => emit('debug', event, ctx),
  info:  (event: string, ctx?: Record<string, unknown>) => emit('info',  event, ctx),
  warn:  (event: string, ctx?: Record<string, unknown>) => emit('warn',  event, ctx),
  error: (event: string, ctx?: Record<string, unknown>) => emit('error', event, ctx),
};

// Convenience: turn an unknown caught error into a redacted one-liner.
// Use this instead of passing the raw `err` to logger.error.
export function describeError(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  if (typeof err === 'string') return err.slice(0, 300);
  try { return JSON.stringify(redact(err)).slice(0, 300); } catch { return '[unserializable]'; }
}
