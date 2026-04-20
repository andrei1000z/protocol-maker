// Client → server log relay. The global error boundary fires here so client-
// side unhandled exceptions show up in Vercel logs next to API errors.
// Intentionally unauthenticated (errors can happen on the marketing / login
// pages, before a session exists) but rate-limit-friendly because the
// handler is tiny, writes nothing to DB, and caps payload size.
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') return NextResponse.json({ ok: false }, { status: 400 });

    const { event, digest, message, name, url } = body as Record<string, unknown>;
    // Safe subset — anything else is silently dropped. Prevents clients from
    // using this endpoint as a generic log-spray surface.
    logger.error(String(event || 'client.unknown_error'), {
      digest:  typeof digest  === 'string' ? digest.slice(0, 100)  : null,
      message: typeof message === 'string' ? message.slice(0, 500) : null,
      name:    typeof name    === 'string' ? name.slice(0, 60)     : null,
      url:     typeof url     === 'string' ? url.slice(0, 300)     : null,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
