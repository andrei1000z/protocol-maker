'use client';

// F4 — Voice log entry point.
//
// User taps the mic, dictates a freeform sentence ("Am dormit 7 ore, am mers
// 8000 de pași, m-am antrenat 45 minute"), Web Speech API transcribes it
// locally (no audio leaves the device), we POST the transcript to
// /api/voice-log which returns a daily_metrics-shaped JSON the user reviews
// before save. The save itself goes through the existing /api/daily-metrics
// route so RLS + validation stay consistent with the manual entry path.

import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Check, X, AlertCircle } from 'lucide-react';

// Web Speech API isn't in the stock DOM types. Keep a narrow local interface
// instead of `any`; tolerant of Chrome's `webkitSpeechRecognition` prefix.
interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: { transcript: string };
}
interface SpeechRecognitionEvent extends Event {
  results: { length: number; [index: number]: SpeechRecognitionResult };
}
interface SpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: Event & { error?: string }) => void) | null;
  onend: (() => void) | null;
}

type ParsedMetrics = Record<string, string | number | boolean | string[] | null | undefined>;

export function VoiceLogButton({ onApplied }: { onApplied?: () => void }) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const W = window as Window & {
      SpeechRecognition?: new () => SpeechRecognition;
      webkitSpeechRecognition?: new () => SpeechRecognition;
    };
    setSupported(!!(W.SpeechRecognition || W.webkitSpeechRecognition));
  }, []);

  const start = () => {
    if (typeof window === 'undefined') return;
    const W = window as Window & {
      SpeechRecognition?: new () => SpeechRecognition;
      webkitSpeechRecognition?: new () => SpeechRecognition;
    };
    const Ctor = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.lang = 'ro-RO';
    recognition.interimResults = true;
    recognition.continuous = false;
    let accumulated = '';
    recognition.onresult = (e) => {
      let text = '';
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        const t = r[0]?.transcript || '';
        text += t;
        if (r.isFinal) accumulated += t;
      }
      setTranscript(accumulated || text);
    };
    recognition.onerror = (e) => {
      const code = e.error || 'unknown';
      const msg = code === 'not-allowed'
        ? 'Microfonul e blocat. Activează-l din browser și încearcă din nou.'
        : code === 'no-speech'
        ? 'Nu am auzit nimic. Încearcă din nou.'
        : `Eroare: ${code}`;
      setError(msg);
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setError(null);
    setTranscript('');
    setParsed(null);
    setListening(true);
    recognition.start();
  };

  const stop = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  const parse = async () => {
    if (!transcript.trim() || parsing) return;
    setParsing(true);
    setError(null);
    try {
      const res = await fetch('/api/voice-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `Parse failed (${res.status})`);
      if (!j.metrics || Object.keys(j.metrics).length === 0) {
        setError('Nu am detectat metrici clare. Reformulează cu valori concrete (ore de somn, pași, minute de antrenament…).');
        return;
      }
      setParsed(j.metrics);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Procesarea a eșuat');
    } finally {
      setParsing(false);
    }
  };

  const apply = async () => {
    if (!parsed || saving) return;
    setSaving(true);
    setError(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const res = await fetch('/api/daily-metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: today, ...parsed }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Save failed (${res.status})`);
      }
      // Reset UI and notify parent so it can refresh data hooks.
      setParsed(null);
      setTranscript('');
      if (onApplied) onApplied();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Salvarea a eșuat');
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setParsed(null);
    setTranscript('');
    setError(null);
  };

  // Render nothing on browsers without Web Speech (mainly iOS Safari pre-PWA).
  if (supported === null) return null;
  if (!supported) {
    return (
      <div className="rounded-2xl bg-surface-2 border border-card-border p-3 text-xs text-muted-foreground flex items-start gap-2">
        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>Dictarea vocală nu e disponibilă pe acest browser. Folosește Chrome sau Edge pe Android / desktop pentru a o activa.</span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-surface-2 border border-card-border p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Dictează ce ai făcut azi</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Exemplu: „Am dormit 7 ore, am mers 8 mii de pași, m-am antrenat 45 minute".
          </p>
        </div>
        {!listening ? (
          <button
            onClick={start}
            className="shrink-0 w-11 h-11 rounded-full bg-accent text-black flex items-center justify-center hover:bg-accent-bright active:scale-95 transition-all"
            aria-label="Începe înregistrarea"
          >
            <Mic className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={stop}
            className="shrink-0 w-11 h-11 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 active:scale-95 transition-all animate-pulse"
            aria-label="Oprește înregistrarea"
          >
            <Square className="w-4 h-4" />
          </button>
        )}
      </div>

      {transcript && (
        <div className="rounded-xl bg-background border border-card-border px-3 py-2 text-sm leading-relaxed italic">
          „{transcript}"
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 text-xs text-danger">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {transcript && !parsed && !listening && (
        <button
          onClick={parse}
          disabled={parsing}
          className="w-full px-3 py-2 rounded-xl bg-accent text-black text-sm font-semibold hover:bg-accent-bright disabled:opacity-50 transition-colors"
        >
          {parsing ? 'Se analizează…' : 'Analizează cu AI'}
        </button>
      )}

      {parsed && (
        <div className="rounded-xl bg-accent/5 border border-accent/25 p-3 space-y-2.5">
          <p className="text-xs font-semibold text-accent uppercase tracking-widest">Detectat</p>
          <ul className="text-sm space-y-1">
            {Object.entries(parsed).map(([k, v]) => (
              <li key={k} className="flex items-baseline gap-2">
                <span className="text-xs text-muted-foreground min-w-[110px] font-mono">{k}</span>
                <span className="font-medium">{Array.isArray(v) ? v.join(', ') : String(v)}</span>
              </li>
            ))}
          </ul>
          <div className="flex gap-2 pt-1">
            <button
              onClick={apply}
              disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-accent text-black text-xs font-semibold hover:bg-accent-bright disabled:opacity-50 transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              {saving ? 'Salvez…' : 'Salvează'}
            </button>
            <button
              onClick={reset}
              disabled={saving}
              className="px-3 py-2 rounded-lg bg-surface-3 border border-card-border text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
