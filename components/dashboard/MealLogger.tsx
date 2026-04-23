'use client';

// Meal logger card — dashboard.
//
// Flow: user taps "Log a meal" → modal opens with photo input (with camera
// capture on mobile via `capture="environment"`), text field, and time
// picker. Tapping "Analyze" calls /api/meals/analyze and renders a preview
// card with macros + verdict. User can edit the title before confirming;
// "Save" posts to /api/meals. Recent meals show as a compact timeline
// underneath. A regen now includes these meals in the master prompt.
//
// Design choices:
//   - Preview-before-save so typos in user text or AI hallucinations don't
//     land in the DB. Edits to the title are persisted verbatim.
//   - Photo is never stored server-side — the preview is the only place it
//     exists. If the user navigates away with an unsaved analysis, we lose
//     the image. That's intentional: zero photo storage, minimal GDPR.
//   - Time picker defaults to NOW with three quick-shift buttons so a user
//     logging brunch at 3pm can pick "2h ago" in one tap.

import { useRef, useState } from 'react';
import Image from 'next/image';
import clsx from 'clsx';
import {
  Camera, Upload, Type, Clock, X, Check, RefreshCw, Trash2, Utensils, Sparkles,
  ChevronDown, ChevronUp, Flame,
} from 'lucide-react';
import { useMeals, invalidate } from '@/lib/hooks/useApiData';
import type { MealAnalysis } from '@/lib/engine/meals';

// Vision models don't benefit from images larger than ~1600px on the long
// edge. Downscale in-browser before upload so we never hit the 3.5MB server
// cap (or Vercel's 4.5MB platform cap, which returns 413 before our handler
// runs). iPhone JPEGs are typically 3-8MB raw; this brings them to ~200-500KB.
const MAX_EDGE_PX = 1600;
const JPEG_QUALITY = 0.82;

async function compressImageForUpload(file: File): Promise<File> {
  // Non-image files (if any slip through) and already-small images skip the
  // canvas round-trip — no point re-encoding a 200KB photo.
  if (!file.type.startsWith('image/')) return file;
  if (file.size < 900 * 1024) return file;

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Read failed'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = document.createElement('img');
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Image decode failed'));
    el.src = dataUrl;
  });

  const scale = Math.min(1, MAX_EDGE_PX / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, w, h);

  const blob = await new Promise<Blob | null>(resolve =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
  );
  if (!blob) return file;

  // Fall back to the original if compression somehow made it bigger (rare —
  // usually when input was already heavily compressed small JPEG).
  if (blob.size >= file.size) return file;

  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });
}

interface AnalysisResponse {
  analysis: MealAnalysis;
  source: 'photo' | 'text' | 'photo_with_text';
  eatenAt: string;
  userText: string | null;
  model: string;
}

type TimePreset = { label: string; offsetMin: number };
const TIME_PRESETS: TimePreset[] = [
  { label: 'Now',        offsetMin: 0 },
  { label: '30m ago',    offsetMin: -30 },
  { label: '1h ago',     offsetMin: -60 },
  { label: '2h ago',     offsetMin: -120 },
  { label: 'Breakfast',  offsetMin: -9999 }, // resolved at submit time
  { label: 'Lunch',      offsetMin: -9999 },
  { label: 'Dinner',     offsetMin: -9999 },
];

function resolvePresetTime(label: string): Date {
  const d = new Date();
  const byMeal: Record<string, [number, number]> = {
    'Breakfast': [8, 0],
    'Lunch':     [13, 0],
    'Dinner':    [19, 30],
  };
  if (byMeal[label]) {
    const [h, m] = byMeal[label];
    d.setHours(h, m, 0, 0);
    return d;
  }
  const preset = TIME_PRESETS.find(p => p.label === label);
  d.setMinutes(d.getMinutes() + (preset?.offsetMin ?? 0));
  return d;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
}
function fmtRelative(iso: string): string {
  const hours = Math.round((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}

export function MealLogger() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { data: mealsData, isLoading } = useMeals(7);

  const recent = mealsData?.meals ?? [];
  const todaysMeals = recent.filter(m => {
    const d = new Date(m.eaten_at);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  });
  const todaysCalories = todaysMeals.reduce((sum, m) => sum + (m.calories || 0), 0);

  return (
    <section className="rounded-3xl bg-surface-1 border border-card-border p-5 sm:p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-accent/10 border border-accent/25 flex items-center justify-center shrink-0">
            <Utensils className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-semibold tracking-tight">What you ate</h2>
            <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
              {todaysMeals.length === 0
                ? 'Take a photo of your plate. Get calories, protein, verdict in 5 seconds.'
                : `${todaysMeals.length} meal${todaysMeals.length === 1 ? '' : 's'} today · ~${Math.round(todaysCalories)} kcal so far.`}
            </p>
          </div>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="shrink-0 inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold px-3.5 py-2 rounded-xl bg-accent text-black hover:bg-accent-bright transition-colors"
        >
          <Camera className="w-4 h-4" />
          Add meal
        </button>
      </div>

      {/* Recent meals — compact list. Shows up to 3 without expanding. */}
      {isLoading ? (
        <div className="h-16 rounded-xl bg-surface-3/40 animate-pulse" />
      ) : recent.length === 0 ? (
        <p className="text-[11px] text-muted-foreground italic">
          Nothing logged yet. What you eat over the next week shapes your next protocol update.
        </p>
      ) : (
        <>
          <ul className="space-y-1.5">
            {(expanded ? recent : recent.slice(0, 3)).map(m => (
              <MealRow key={m.id} meal={m} />
            ))}
          </ul>
          {recent.length > 3 && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="text-[11px] text-muted-foreground hover:text-accent transition-colors inline-flex items-center gap-1"
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded ? 'Show less' : `Show ${recent.length - 3} more from last 7 days`}
            </button>
          )}
        </>
      )}

      {open && <MealLoggerModal onClose={() => setOpen(false)} />}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Single-meal row in the timeline. Click to delete (confirm prompt).
// ─────────────────────────────────────────────────────────────────────────────
function MealRow({ meal }: { meal: NonNullable<ReturnType<typeof useMeals>['data']>['meals'][number] }) {
  const verdictColor =
    meal.verdict === 'good' ? 'text-accent bg-accent/10 border-accent/25'
    : meal.verdict === 'bad' ? 'text-danger bg-red-500/10 border-red-500/25'
    : 'text-amber-400 bg-amber-500/10 border-amber-500/25';

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${meal.title}"?`)) return;
    await fetch(`/api/meals?id=${encodeURIComponent(meal.id)}`, { method: 'DELETE' });
    invalidate.meals();
  };

  return (
    <li className="group flex items-center justify-between gap-2.5 p-2.5 rounded-xl bg-surface-2 border border-card-border">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-[13px] font-medium truncate">{meal.title}</p>
          {meal.verdict && (
            <span className={clsx('text-[9px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded-full border shrink-0', verdictColor)}>
              {meal.verdict}
            </span>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate">
          {fmtRelative(meal.eaten_at)} · {fmtTime(meal.eaten_at)}
          {meal.calories ? ` · ${meal.calories}kcal` : ''}
          {meal.protein_g ? ` · ${Math.round(meal.protein_g)}p` : ''}
          {meal.carbs_g ? `/${Math.round(meal.carbs_g)}c` : ''}
          {meal.fat_g ? `/${Math.round(meal.fat_g)}f` : ''}
        </p>
      </div>
      <button
        onClick={handleDelete}
        aria-label={`Delete ${meal.title}`}
        className="p-1.5 rounded-lg text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-danger hover:bg-surface-3 transition-all shrink-0"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </li>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal — photo + text + time picker → analysis preview → save.
// ─────────────────────────────────────────────────────────────────────────────
function MealLoggerModal({ onClose }: { onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [userText, setUserText] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<string>('Now');
  const [customTime, setCustomTime] = useState<string>('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [editableTitle, setEditableTitle] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [compressing, setCompressing] = useState(false);
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.files?.[0] ?? null;
    setError(null);
    if (!raw) {
      setFile(null);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(null);
      return;
    }
    setCompressing(true);
    try {
      const compressed = await compressImageForUpload(raw);
      setFile(compressed);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(URL.createObjectURL(compressed));
    } catch {
      // If compression failed for any reason, fall back to the raw file —
      // the server will still reject at 3.5MB but with a clear message.
      setFile(raw);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(URL.createObjectURL(raw));
    } finally {
      setCompressing(false);
    }
  };

  const resolveEatenAt = (): string => {
    if (customTime) {
      const parsed = new Date(customTime);
      if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
    }
    return resolvePresetTime(selectedPreset).toISOString();
  };

  const handleAnalyze = async () => {
    if (!file && !userText.trim()) {
      setError('Add a photo, type what you ate, or both.');
      return;
    }
    setAnalyzing(true); setError(null); setAnalysis(null);
    try {
      const fd = new FormData();
      if (file) fd.append('file', file);
      if (userText.trim()) fd.append('userText', userText.trim());
      fd.append('eatenAt', resolveEatenAt());

      const res = await fetch('/api/meals/analyze', { method: 'POST', body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        if (res.status === 413) {
          throw new Error('Photo still too big after shrinking. Try a smaller photo or describe the meal in text.');
        }
        throw new Error(j.error || `Couldn't read the plate (${res.status}). Try again.`);
      }
      const data = (await res.json()) as AnalysisResponse;
      setAnalysis(data);
      setEditableTitle(data.analysis.title);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSave = async () => {
    if (!analysis) return;
    setSaving(true); setError(null);
    try {
      const res = await fetch('/api/meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis: { ...analysis.analysis, title: editableTitle.trim() || analysis.analysis.title },
          source: analysis.source,
          eatenAt: analysis.eatenAt,
          userText: analysis.userText,
          model: analysis.model,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Save failed (${res.status})`);
      }
      invalidate.meals();
      // Nutrition inputs will change on the next regen — prompt that too.
      invalidate.liveScores();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleRetry = () => {
    setAnalysis(null);
    setEditableTitle('');
    setError(null);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="meal-logger-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center animate-fade-in"
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative bg-surface-1 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto border border-card-border animate-fade-in-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header — sticky so "Close" stays reachable while scrolling the preview */}
        <div className="sticky top-0 z-10 bg-surface-1/95 backdrop-blur-lg border-b border-card-border p-5 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-accent">
              {analysis ? 'Check this looks right' : 'Add a meal'}
            </p>
            <h2 id="meal-logger-title" className="text-lg font-semibold mt-0.5">
              {analysis ? editableTitle : 'Snap it or describe it'}
            </h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Input phase — shown before analysis completes */}
        {!analysis && (
          <div className="p-5 space-y-4">
            {/* Photo picker. On iOS the capture attr opens the camera
                directly; desktop browsers show a file picker. Both supported. */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted mb-2">1. Photo <span className="text-muted/60 font-normal normal-case tracking-normal">(fastest option)</span></p>
              {preview ? (
                <div className="relative rounded-2xl overflow-hidden border border-card-border">
                  <Image src={preview} alt="Meal preview" width={800} height={600} className="w-full max-h-72 object-cover" unoptimized />
                  <button
                    onClick={() => { setFile(null); if (preview) URL.revokeObjectURL(preview); setPreview(null); }}
                    aria-label="Remove photo"
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-white hover:bg-black/80"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  {file && (
                    <span className="absolute bottom-2 left-2 text-[10px] font-mono px-2 py-0.5 rounded-full bg-black/60 text-white">
                      {(file.size / 1024).toFixed(0)} KB
                    </span>
                  )}
                </div>
              ) : compressing ? (
                <div className="rounded-2xl border border-card-border bg-surface-2 p-6 flex flex-col items-center gap-2">
                  <span className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                  <p className="text-[11px] text-muted-foreground">Shrinking photo…</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <label className="rounded-xl bg-surface-2 border border-card-border hover:border-accent/40 p-4 text-center cursor-pointer transition-colors">
                    <Camera className="w-5 h-5 mx-auto text-accent" />
                    <p className="text-[11px] font-medium mt-1.5">Open camera</p>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </label>
                  <label className="rounded-xl bg-surface-2 border border-card-border hover:border-accent/40 p-4 text-center cursor-pointer transition-colors">
                    <Upload className="w-5 h-5 mx-auto text-muted-foreground" />
                    <p className="text-[11px] font-medium mt-1.5">Choose file</p>
                    <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                  </label>
                </div>
              )}
            </div>

            {/* Text */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted mb-2 flex items-center gap-1.5">
                <Type className="w-3 h-3" /> 2. Or type what you ate <span className="text-muted/60 font-normal normal-case tracking-normal">(skip if you added a photo)</span>
              </p>
              <textarea
                value={userText}
                onChange={e => setUserText(e.target.value)}
                placeholder="chicken with rice, avocado, olive oil"
                rows={3}
                className="w-full rounded-xl bg-surface-2 border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent/50 placeholder:text-muted-foreground/50 resize-none"
              />
            </div>

            {/* Time picker */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted mb-2 flex items-center gap-1.5">
                <Clock className="w-3 h-3" /> 3. When did you eat?
              </p>
              <div className="flex flex-wrap gap-1.5">
                {TIME_PRESETS.map(p => (
                  <button
                    key={p.label}
                    onClick={() => { setSelectedPreset(p.label); setCustomTime(''); }}
                    className={clsx('text-[11px] px-2.5 py-1 rounded-full border transition-colors',
                      selectedPreset === p.label && !customTime
                        ? 'bg-accent/10 text-accent border-accent/30'
                        : 'bg-surface-2 text-muted-foreground border-card-border hover:text-foreground')}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <input
                type="datetime-local"
                value={customTime}
                onChange={e => { setCustomTime(e.target.value); setSelectedPreset('__custom'); }}
                className="mt-2 w-full rounded-xl bg-surface-2 border border-card-border px-3 py-2 text-sm outline-none focus:border-accent/50"
                aria-label="Custom time"
              />
            </div>

            {error && (
              <p className="text-[11px] text-danger bg-red-500/5 border border-red-500/20 rounded-lg p-2">{error}</p>
            )}

            <button
              onClick={handleAnalyze}
              disabled={analyzing || compressing || (!file && !userText.trim())}
              className="w-full py-3 rounded-xl bg-accent text-black font-semibold text-sm hover:bg-accent-bright disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-2"
            >
              {analyzing ? (
                <>
                  <span className="w-4 h-4 border-2 border-black/40 border-t-black rounded-full animate-spin" />
                  Reading the plate…
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  See what's in it
                </>
              )}
            </button>
            <p className="text-[10px] text-center text-muted">
              Your photo isn't saved — only the title, macros, and verdict.
            </p>
          </div>
        )}

        {/* Preview phase — rendered after analyze succeeds */}
        {analysis && (
          <div className="p-5 space-y-4">
            <input
              value={editableTitle}
              onChange={e => setEditableTitle(e.target.value)}
              className="w-full rounded-xl bg-surface-2 border border-card-border px-3 py-2.5 text-base font-medium outline-none focus:border-accent/50"
              aria-label="Meal title"
            />

            <VerdictPill verdict={analysis.analysis.verdict} reasons={analysis.analysis.verdict_reasons} />

            {/* Macro pills — compact row. Missing values simply don't render. */}
            <MacrosRow analysis={analysis.analysis} />

            {analysis.analysis.description && (
              <p className="text-[13px] text-foreground/90 leading-relaxed">{analysis.analysis.description}</p>
            )}

            {analysis.analysis.ingredients.length > 0 && (
              <div>
                <p className="text-[10px] font-mono uppercase tracking-widest text-muted mb-1.5">Ingredients</p>
                <div className="flex flex-wrap gap-1">
                  {analysis.analysis.ingredients.map(ing => (
                    <span key={ing} className="text-[11px] px-2 py-0.5 rounded-full bg-surface-2 border border-card-border text-foreground/90">
                      {ing}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="text-[10px] text-muted pt-2 border-t border-card-border">
              Eaten at {fmtTime(analysis.eatenAt)}
            </div>

            {error && (
              <p className="text-[11px] text-danger bg-red-500/5 border border-red-500/20 rounded-lg p-2">{error}</p>
            )}

            <div className="grid grid-cols-[auto_1fr] gap-2">
              <button
                onClick={handleRetry}
                disabled={saving}
                className="px-4 py-3 rounded-xl bg-surface-3 border border-card-border text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Try again
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="py-3 rounded-xl bg-accent text-black font-semibold text-sm hover:bg-accent-bright disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-1.5"
              >
                {saving ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-black/40 border-t-black rounded-full animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Looks right — save
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function VerdictPill({ verdict, reasons }: { verdict: MealAnalysis['verdict']; reasons: string[] }) {
  const toneMap = {
    good:  { bg: 'bg-accent/5 border-accent/25',        text: 'text-accent',       label: 'Solid meal' },
    mixed: { bg: 'bg-amber-500/5 border-amber-500/25',  text: 'text-amber-400',    label: 'Decent — a few things to tweak' },
    bad:   { bg: 'bg-red-500/5 border-red-500/20',      text: 'text-danger',       label: 'Not your best' },
  } as const;
  const tone = toneMap[verdict];
  return (
    <div className={clsx('rounded-xl p-3 border', tone.bg)}>
      <p className={clsx('text-xs font-semibold', tone.text)}>{tone.label}</p>
      {reasons.length > 0 && (
        <ul className="mt-1.5 space-y-0.5">
          {reasons.slice(0, 5).map((r, i) => (
            <li key={i} className="text-[11px] text-foreground/80 leading-relaxed">· {r}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MacrosRow({ analysis }: { analysis: MealAnalysis }) {
  const items: Array<{ label: string; value: number | null | undefined; unit: string; icon?: React.ElementType }> = [
    { label: 'kcal',    value: analysis.calories,  unit: '',  icon: Flame },
    { label: 'Protein', value: analysis.protein_g, unit: 'g' },
    { label: 'Carbs',   value: analysis.carbs_g,   unit: 'g' },
    { label: 'Fat',     value: analysis.fat_g,     unit: 'g' },
    { label: 'Fiber',   value: analysis.fiber_g,   unit: 'g' },
  ];
  const filled = items.filter(i => typeof i.value === 'number');
  if (filled.length === 0) return null;
  return (
    <div className="grid grid-cols-5 gap-2">
      {filled.map(it => {
        const Icon = it.icon;
        return (
          <div key={it.label} className="metric-tile text-center p-2">
            {Icon && <Icon className="w-3 h-3 mx-auto text-accent mb-0.5" />}
            <p className="text-sm font-bold font-mono tabular-nums">
              {Math.round(it.value as number)}
              {it.unit && <span className="text-[9px] text-muted ml-0.5">{it.unit}</span>}
            </p>
            <p className="text-[9px] text-muted uppercase tracking-widest mt-0.5">{it.label}</p>
          </div>
        );
      })}
    </div>
  );
}
