'use client';

// Tiny modal the user opens from a supplement card when something went
// wrong. Two inputs only: category checkboxes + optional free-text note.
// No "severity 1-10" slider, no "frequency" picker — the less friction, the
// more reports land. The master-prompt context builder reads the last 30
// days and tells the AI to avoid-or-switch on the next regen.

import { useEffect, useState } from 'react';
import { AlertTriangle, X, Check } from 'lucide-react';
import clsx from 'clsx';
import { toast } from '@/lib/toast';

interface CategoryDef { key: string; label: string; description: string; }

// Keep the UI-level shape aligned with the API enum in route.ts. Adding a
// category here means adding it there too.
const CATEGORIES: CategoryDef[] = [
  { key: 'digestive', label: 'Digestiv',    description: 'Balonare, diaree, greață, constipație' },
  { key: 'sleep',     label: 'Somn',        description: 'Insomnie, vise intense, treziri' },
  { key: 'energy',    label: 'Energie',     description: 'Jittery, crash, oboseală neobișnuită' },
  { key: 'mood',      label: 'Dispoziție',  description: 'Iritabil, anxios, plat' },
  { key: 'skin',      label: 'Piele',       description: 'Acnee, rash, prurit' },
  { key: 'headache',  label: 'Dureri de cap', description: 'Migrenă, tensiune' },
  { key: 'other',     label: 'Altceva',     description: 'Ceva care nu e în listă' },
];

export interface SupplementFeedbackModalProps {
  supplementName: string;
  protocolId?: string | null;
  onClose: () => void;
}

export function SupplementFeedbackModal({ supplementName, protocolId, onClose }: SupplementFeedbackModalProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const toggle = (key: string) => setSelected(s => s.includes(key) ? s.filter(k => k !== key) : [...s, key]);

  const handleSubmit = async () => {
    if (selected.length === 0) {
      setError('Alege cel puțin o categorie.');
      return;
    }
    setSubmitting(true); setError(null);
    try {
      const res = await fetch('/api/supplement-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplement_name: supplementName,
          categories: selected,
          notes: notes.trim() || null,
          protocol_id: protocolId ?? null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Nu am putut salva (${res.status})`);
      }
      toast({
        tone: 'success',
        title: 'Raport înregistrat',
        description: `${supplementName} va fi ajustat la următoarea regenerare.`,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Eroare la trimitere.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sfb-title"
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center animate-fade-in"
    >
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full sm:max-w-md bg-surface-1 border border-card-border rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 animate-fade-in-up max-h-[90dvh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Închide"
          className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 text-amber-400 text-xs font-mono uppercase tracking-widest mb-2">
          <AlertTriangle className="w-3.5 h-3.5" />
          Raport efect secundar
        </div>

        <h2 id="sfb-title" className="text-lg font-bold tracking-tight">
          Ceva nu a mers cu <span className="text-accent">{supplementName}</span>?
        </h2>
        <p className="text-xs text-muted-foreground leading-relaxed mt-1">
          Bifează ce ai simțit. La următoarea regenerare, protocolul evită sau schimbă doza.
        </p>

        <div className="mt-4 space-y-2">
          {CATEGORIES.map(cat => {
            const isOn = selected.includes(cat.key);
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => toggle(cat.key)}
                className={clsx(
                  'w-full text-left flex items-start gap-3 p-3 rounded-xl border transition-colors',
                  isOn
                    ? 'bg-accent/10 border-accent/40'
                    : 'bg-surface-2 border-card-border hover:border-card-border-hover',
                )}
                aria-pressed={isOn}
              >
                <span
                  className={clsx(
                    'w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5',
                    isOn ? 'bg-accent border-accent text-black' : 'border-card-border',
                  )}
                >
                  {isOn && <Check className="w-3.5 h-3.5" />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium">{cat.label}</span>
                  <span className="block text-xs text-muted-foreground mt-0.5">{cat.description}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-4">
          <label htmlFor="sfb-notes" className="block text-xs text-muted-foreground mb-1.5">
            Detalii (opțional)
          </label>
          <textarea
            id="sfb-notes"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="Ex: simptome 2h după priză, dispărut după 2 zile fără pauză..."
            className="w-full rounded-xl bg-surface-2 border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent/50 resize-none"
          />
          <p className="text-xs text-muted mt-1 text-right">{notes.length}/1000</p>
        </div>

        {error && (
          <p className="text-xs text-danger bg-red-500/5 border border-red-500/20 rounded-lg p-2 mt-3">
            {error}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="py-2.5 rounded-xl bg-surface-3 border border-card-border text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Renunță
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || selected.length === 0}
            className="py-2.5 rounded-xl bg-accent text-black font-semibold text-sm hover:bg-accent-bright disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-1.5"
          >
            {submitting ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-black/40 border-t-black rounded-full animate-spin" />
                Trimit…
              </>
            ) : (
              'Trimite raport'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
