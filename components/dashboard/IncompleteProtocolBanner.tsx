'use client';

// Banner shown when the stored protocol_json is missing required sections
// (older AI response or partial fallback). Tight UX: one sentence + one
// "regenerate now" button which POSTs an empty body to /api/generate-protocol
// (server hydrates profile + biomarkers from the user's row).

import { useState } from 'react';

export function IncompleteProtocolBanner({ missing }: { missing: string[] }) {
  const [regenerating, setRegenerating] = useState(false);
  const doRegen = async () => {
    setRegenerating(true);
    try {
      const res = await fetch('/api/generate-protocol', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: {}, biomarkers: [] }),
      });
      if (res.ok) { window.location.href = '/dashboard'; return; }
    } catch { /* fall through */ }
    window.location.href = '/onboarding';
  };
  return (
    <div className="rounded-2xl bg-amber-500/6 border border-amber-500/30 p-4 flex items-start gap-3 animate-fade-in-up">
      <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
        <span className="text-base">⚠️</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-warning">Protocolul tău e incomplet — lipsesc {missing.join(' + ')}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
          AI-ul a returnat un răspuns parțial. Un singur tap regenerează tot din profil și biomarkerii tăi.
        </p>
      </div>
      <button
        onClick={doRegen}
        disabled={regenerating}
        className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-black text-xs font-semibold hover:bg-accent-bright disabled:opacity-60 transition-colors"
      >
        {regenerating ? 'Regenerez…' : '↻ Regenerează'}
      </button>
    </div>
  );
}
