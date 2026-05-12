'use client';

// Bring-your-own-key card. Power users plug an Anthropic API key here so
// protocol generation + chat use their billing instead of the platform's.
//
// We never echo the saved key back to the client — `hasKey` is the only
// signal the server returns. To replace, type a new key; to clear, hit
// "Șterge cheia". Validation happens server-side in /api/save-profile,
// which only persists strings matching the sk-... shape.

import { useState } from 'react';
import { Key, Eye, EyeOff, Trash2, Check } from 'lucide-react';

export interface AnthropicByokCardProps {
  hasKey: boolean;
}

export function AnthropicByokCard({ hasKey: initialHasKey }: AnthropicByokCardProps) {
  const [hasKey, setHasKey] = useState(initialHasKey);
  const [value, setValue] = useState('');
  const [reveal, setReveal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const save = async () => {
    if (!value || saving) return;
    if (!value.startsWith('sk-') || value.length < 20) {
      setError('Cheia trebuie să înceapă cu sk- și să aibă cel puțin 20 caractere.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/save-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anthropicApiKey: value }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Salvarea a eșuat (${res.status})`);
      }
      setHasKey(true);
      setValue('');
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Salvarea a eșuat');
    } finally {
      setSaving(false);
    }
  };

  const clear = async () => {
    if (!confirm('Sigur vrei să ștergi cheia? Vei reveni la cheia platformei (cu limite zilnice).')) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/save-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anthropicApiKey: '' }),
      });
      if (!res.ok) throw new Error(`Ștergerea a eșuat (${res.status})`);
      setHasKey(false);
      setValue('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ștergerea a eșuat');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass-card rounded-2xl p-5 space-y-3.5 animate-fade-in-up">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/25 flex items-center justify-center shrink-0">
          <Key className="w-5 h-5 text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold">Cheia ta Anthropic (BYOK)</p>
            {hasKey && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/25">
                <Check className="w-3 h-3" /> Activă
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Adaugă cheia ta de la <a href="https://console.anthropic.com/" target="_blank" rel="noreferrer" className="text-accent hover:underline">console.anthropic.com</a> ca să folosești Claude pe banii tăi. Nu mai treci prin limitele zilnice ale platformei. Cheia se stochează server-side; nu o vezi după salvare.
          </p>
        </div>
      </div>

      <div className="flex items-stretch gap-2">
        <div className="relative flex-1">
          <input
            type={reveal ? 'text' : 'password'}
            value={value}
            onChange={e => { setValue(e.target.value); setError(null); }}
            placeholder={hasKey ? 'sk-ant-… (introdu o nouă cheie ca să o înlocuiești)' : 'sk-ant-…'}
            className="w-full pr-10 px-3 py-2 rounded-xl bg-surface-2 border border-card-border focus:border-accent/50 outline-none text-sm font-mono"
            disabled={saving}
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={() => setReveal(r => !r)}
            aria-label={reveal ? 'Ascunde cheia' : 'Afișează cheia'}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
          >
            {reveal ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <button
          onClick={save}
          disabled={saving || !value}
          className="px-4 rounded-xl bg-accent text-black text-xs font-semibold hover:bg-accent-bright disabled:opacity-50 transition-colors shrink-0"
        >
          {saving ? 'Salvez…' : savedFlash ? 'Salvat ✓' : 'Salvează'}
        </button>
      </div>

      {error && (
        <p className="text-xs text-danger">{error}</p>
      )}

      {hasKey && (
        <button
          onClick={clear}
          disabled={saving}
          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-danger border border-red-500/25 hover:bg-red-500/15 transition-colors disabled:opacity-50"
        >
          <Trash2 className="w-3.5 h-3.5" /> Șterge cheia
        </button>
      )}

      <p className="text-xs text-muted-foreground leading-relaxed">
        Folosirea cheii tale înseamnă plățile merg direct la Anthropic (factura ta), nu prin platformă. Aplicația continuă să folosească Groq ca fallback dacă Anthropic eșuează.
      </p>
    </div>
  );
}
