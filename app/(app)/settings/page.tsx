'use client';

import { useEffect, useState, useRef } from 'react';
import { useMyData, invalidate } from '@/lib/hooks/useApiData';
import clsx from 'clsx';
import {
  Share2, Download, RotateCcw, LogOut, Copy, Check, FileText, User, Heart,
  Edit2, Save, Trash2, AlertTriangle, Target, Sparkles,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface Profile {
  age?: number;
  sex?: string;
  height_cm?: number;
  weight_kg?: number;
  ethnicity?: string;
  occupation?: string;
  activity_level?: string;
  sleep_hours_avg?: number;
  diet_type?: string;
  alcohol_drinks_per_week?: number;
  caffeine_mg_per_day?: number;
  smoker?: boolean;
  cardio_minutes_per_week?: number;
  strength_sessions_per_week?: number;
  conditions?: string[];
  medications?: { name: string; dose: string; frequency: string }[];
  current_supplements?: string[];
  allergies?: string[];
  goals?: string[];
  time_budget_min?: number;
  monthly_budget_ron?: number;
  experimental_openness?: string;
  onboarding_data?: Record<string, unknown>;
}

interface BloodTest { id: string; taken_at: string; biomarkers: unknown[]; }

// ─────────────────────────────────────────────────────────────────────────────
// Small reusable UI pieces
// ─────────────────────────────────────────────────────────────────────────────
function SettingsCard({ icon: Icon, title, subtitle, action, children }: {
  icon: React.ElementType; title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="glass-card rounded-2xl p-5 sm:p-6 space-y-4 animate-fade-in-up">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base sm:text-lg font-semibold tracking-tight">{title}</h2>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="metric-tile text-center">
      <p className="text-lg sm:text-xl font-bold font-mono tabular-nums">{value}</p>
      <p className="text-[10px] text-muted uppercase tracking-widest mt-1">{label}</p>
    </div>
  );
}

function Pair({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '' || value === '-') return null;
  return (
    <div className="p-3 rounded-xl bg-surface-2 border border-card-border">
      <p className="text-[10px] text-muted uppercase tracking-wider">{label}</p>
      <p className="text-sm font-medium mt-0.5 break-words">{value}</p>
    </div>
  );
}

function Chip({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'amber' | 'accent' | 'danger' }) {
  const map = {
    neutral: 'bg-surface-3 text-muted-foreground border-card-border',
    amber: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    accent: 'bg-accent/12 text-accent border-accent/25',
    danger: 'bg-red-500/10 text-danger border-red-500/20',
  } as const;
  return <span className={clsx('text-[11px] px-2.5 py-1 rounded-full border', map[tone])}>{children}</span>;
}

// ─────────────────────────────────────────────────────────────────────────────
// RetestUploader — feedback loop: upload new lab PDF/biomarkers → auto-regen
// protocol. The "where's the data that proves it works" fix from the audit.
// ─────────────────────────────────────────────────────────────────────────────
function RetestUploader({ bloodTestsCount }: { bloodTestsCount: number }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setBusy(true); setError(''); setStatus('Parsing PDF…');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const parseRes = await fetch('/api/parse-bloodwork', { method: 'POST', body: fd });
      if (!parseRes.ok) throw new Error('PDF parsing failed — try entering biomarkers manually from /onboarding');
      const { biomarkers: parsed } = await parseRes.json();
      const biomarkers = (parsed || []).filter((b: { code?: string; value?: number }) => b.code && b.code !== 'UNKNOWN' && b.value);
      if (biomarkers.length === 0) throw new Error('No biomarkers detected in PDF — use /onboarding to enter manually');

      setStatus(`Regenerating with ${biomarkers.length} markers…`);
      const retestRes = await fetch('/api/retest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ biomarkers, labName: file.name.slice(0, 80) }),
      });
      if (!retestRes.ok) {
        const err = await retestRes.json().catch(() => ({}));
        throw new Error(err.error || `Regen failed (${retestRes.status})`);
      }
      setStatus('New protocol generated — refreshing…');
      invalidate.all();
      setTimeout(() => window.location.href = '/dashboard', 600);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
      setStatus('');
    }
  };

  return (
    <div className="space-y-2">
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        className="w-full p-4 rounded-xl border border-dashed border-accent/40 bg-accent/[0.03] hover:bg-accent/[0.06] hover:border-accent/60 transition-all flex items-center gap-3 text-left disabled:opacity-60 disabled:cursor-wait"
      >
        <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/25 flex items-center justify-center shrink-0">
          {busy ? (
            <span className="w-4 h-4 border-2 border-accent/40 border-t-accent rounded-full animate-spin" />
          ) : (
            <FileText className="w-4 h-4 text-accent" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-accent">{bloodTestsCount === 0 ? 'Upload first blood test' : '+ Upload new blood test + regenerate'}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {busy
              ? (status || 'Working…')
              : bloodTestsCount === 0
                ? 'PDF from Synevo, Regina Maria, MedLife, LabCorp, Quest'
                : 'Auto-generates Protocol v' + (bloodTestsCount + 1) + ' with diff vs current'}
          </p>
        </div>
        <span className="text-accent">→</span>
      </button>
      {error && <p className="text-xs text-danger p-2 rounded-lg bg-red-500/10 border border-red-500/20">{error}</p>}
      <button
        onClick={async () => { await fetch('/api/reset-onboarding', { method: 'POST' }); window.location.href = '/onboarding'; }}
        className="text-[11px] text-muted-foreground hover:text-accent underline"
      >
        Or re-do onboarding from scratch →
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete account confirmation modal
// ─────────────────────────────────────────────────────────────────────────────
function DeleteAccountModal({ open, onClose, onConfirm, onExport }: { open: boolean; onClose: () => void; onConfirm: () => Promise<void>; onExport: () => Promise<void> }) {
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exported, setExported] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const handleExport = async () => {
    try { await onExport(); setExported(true); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };

  const handleDelete = async () => {
    setLoading(true); setError('');
    try { await onConfirm(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center animate-fade-in" onClick={loading ? undefined : onClose}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div className="relative glass-card rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md mx-0 sm:mx-4 overflow-hidden animate-fade-in-up" onClick={e => e.stopPropagation()}>
        <div className="p-6 sm:p-7 space-y-5">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-danger" />
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Delete your account?</h2>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              This is <strong className="text-foreground">permanent</strong>. Your account, profile, protocols, blood work, tracking history, and shared links will all be gone. We can&apos;t recover them.
            </p>
          </div>

          {/* GDPR: offer data export before delete */}
          <button
            onClick={handleExport}
            disabled={loading}
            className={clsx('w-full p-3.5 rounded-xl border text-left transition-colors flex items-center gap-3',
              exported
                ? 'bg-accent/10 border-accent/30 text-accent'
                : 'bg-surface-2 border-card-border hover:border-accent/30 hover:text-accent')}
          >
            <Download className="w-4 h-4 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{exported ? 'Data exported ✓' : 'Export my data first (GDPR)'}</p>
              <p className="text-[11px] text-muted-foreground">{exported ? 'Downloaded as JSON' : 'JSON backup of everything — recommended before deleting'}</p>
            </div>
          </button>

          <label className={clsx('flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors',
            checked ? 'bg-red-500/10 border-red-500/40' : 'bg-surface-2 border-card-border hover:border-card-border-hover')}>
            <div className={clsx('mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all',
              checked ? 'bg-danger border-danger' : 'border-card-border')}>
              {checked && <Check className="w-3.5 h-3.5 text-black" />}
            </div>
            <span className="text-xs leading-relaxed">
              I understand all my saved data (profile, protocols, blood tests, daily tracking, shared links) will be <strong>permanently deleted</strong>.
            </span>
            <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} className="sr-only" />
          </label>

          {error && <p className="text-xs text-danger p-2 rounded-lg bg-red-500/10 border border-red-500/20">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-3 rounded-xl bg-surface-3 text-foreground text-sm font-medium hover:bg-card-hover transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={!checked || loading}
              className="flex-1 py-3 rounded-xl bg-danger text-black text-sm font-semibold hover:bg-red-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-black/40 border-t-black rounded-full animate-spin" />
                  Deleting…
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Delete forever
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { data: myData, isLoading: loading } = useMyData();

  const profile = (myData?.profile as Profile | null) ?? null;
  const bloodTests = (myData?.bloodTests as BloodTest[] | undefined) ?? [];
  const protocolId = myData?.protocol?.id ?? '';

  const [shareUrl, setShareUrl] = useState('');
  const [shareError, setShareError] = useState('');
  const [shareBusy, setShareBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Editable fields — hydrate from SWR data when it lands
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [age, setAge] = useState('');
  const [monthlyBudget, setMonthlyBudget] = useState('');
  const [timeBudget, setTimeBudget] = useState('');

  useEffect(() => {
    if (!profile) return;
    setWeight(String(profile.weight_kg ?? ''));
    setHeight(String(profile.height_cm ?? ''));
    setAge(String(profile.age ?? ''));
    setMonthlyBudget(String(profile.monthly_budget_ron ?? ''));
    setTimeBudget(String(profile.time_budget_min ?? ''));
  }, [profile]);

  const handleSave = async () => {
    if (!profile) return;
    const res = await fetch('/api/save-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        age: parseInt(age) || profile.age,
        heightCm: parseFloat(height) || profile.height_cm,
        weightKg: parseFloat(weight) || profile.weight_kg,
        monthlyBudgetRon: parseInt(monthlyBudget) || profile.monthly_budget_ron,
        timeBudgetMin: parseInt(timeBudget) || profile.time_budget_min,
        sex: profile.sex,
        activityLevel: profile.activity_level,
        dietType: profile.diet_type,
        conditions: profile.conditions,
        medications: profile.medications,
        currentSupplements: profile.current_supplements,
        goals: profile.goals,
        experimentalOpenness: profile.experimental_openness,
        onboardingData: profile.onboarding_data,
        onboardingCompleted: true,
        onboardingStep: 5,
      }),
    });
    if (res.ok) {
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 2000);
      invalidate.myData(); // SWR revalidates in background — no manual state plumbing
    }
  };

  const handleShare = async () => {
    setShareError(''); setShareBusy(true); setShareUrl('');
    try {
      if (!protocolId) {
        setShareError('Generate a protocol first (complete onboarding).');
        return;
      }
      const res = await fetch('/api/share', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ protocolId }) });
      const json = await res.json();
      if (!res.ok || !json.slug) {
        setShareError(json.error || `Share failed (${res.status}).`);
        return;
      }
      setShareUrl(`${window.location.origin}/share/${json.slug}`);
    } catch (err) {
      setShareError(err instanceof Error ? err.message : String(err));
    } finally {
      setShareBusy(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = async () => {
    const res = await fetch('/api/my-data');
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `protocol-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    invalidate.all();
    window.location.replace('/login');  // replace (not href assignment) — doesn't push a history entry we'd bounce back to
  };

  const handleDeleteAccount = async () => {
    const res = await fetch('/api/delete-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: true }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error || `Delete failed (${res.status})`);
    }
    invalidate.all();
    window.location.replace('/');
  };

  if (loading) return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="rounded-2xl bg-surface-1 border border-card-border p-6 animate-pulse">
          <div className="h-5 w-48 bg-surface-3 rounded mb-4" />
          <div className="h-4 w-full bg-surface-3 rounded mb-2" />
          <div className="h-20 w-full bg-surface-3 rounded-xl" />
        </div>
      ))}
    </div>
  );

  const bmi = profile?.weight_kg && profile?.height_cm
    ? (profile.weight_kg / ((profile.height_cm / 100) ** 2)).toFixed(1)
    : '-';
  const od = (profile?.onboarding_data || {}) as Record<string, unknown>;
  const str = (k: string) => {
    const v = od[k];
    return (v === undefined || v === null || v === '') ? null : String(v);
  };
  const arr = (k: string): string[] => {
    const v = od[k];
    return Array.isArray(v) ? v.filter(x => typeof x === 'string') as string[] : [];
  };

  const name = str('name') || 'Your profile';
  const birthDate = str('birthDate');
  const country = str('country');
  const city = str('city');
  const wearable = str('wearable');
  const primaryGoal = str('primaryGoal');
  const motivation = str('motivation');
  const painPoints = str('painPoints');
  const nonNegotiables = str('nonNegotiables');
  const chronotype = str('chronotype');
  const familyHx = arr('familyHistory');
  const secondaryGoals = arr('secondaryGoals');

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
      {/* Page header */}
      <div className="flex items-end justify-between gap-4 animate-fade-in">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Your profile, history, and account controls.</p>
        </div>
      </div>

      {/* ═══════════ IDENTITY + BODY SNAPSHOT ═══════════ */}
      {profile && (
        <SettingsCard
          icon={User}
          title={name}
          subtitle={birthDate ? `Born ${new Date(birthDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : (country || city) ? [city, country].filter(Boolean).join(', ') : 'Profile overview'}
          action={editing ? (
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="text-xs px-3 py-1.5 rounded-lg bg-surface-3 text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
              <button onClick={handleSave} className="text-xs px-3 py-1.5 rounded-lg bg-accent text-black font-semibold flex items-center gap-1.5">
                <Save className="w-3.5 h-3.5" />Save
              </button>
            </div>
          ) : (
            <button onClick={() => setEditing(true)} className="text-xs px-3 py-1.5 rounded-lg bg-surface-2 border border-card-border text-muted-foreground hover:text-accent hover:border-accent/40 flex items-center gap-1.5 transition-all">
              <Edit2 className="w-3.5 h-3.5" />Edit
            </button>
          )}
        >
          {saved && <p className="text-xs text-accent flex items-center gap-1.5"><Check className="w-3.5 h-3.5" /> Saved</p>}

          {editing ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: 'Age', value: age, set: setAge, unit: 'yr' },
                { label: 'Height', value: height, set: setHeight, unit: 'cm' },
                { label: 'Weight', value: weight, set: setWeight, unit: 'kg', step: '0.1' },
                { label: 'Budget', value: monthlyBudget, set: setMonthlyBudget, unit: 'RON/mo' },
                { label: 'Time', value: timeBudget, set: setTimeBudget, unit: 'min/day' },
              ].map(f => (
                <div key={f.label}>
                  <label className="text-[10px] text-muted uppercase tracking-widest">{f.label}</label>
                  <div className="relative mt-1">
                    <input
                      type="number" step={f.step} value={f.value} onChange={e => f.set(e.target.value)}
                      className="w-full rounded-xl bg-surface-2 border border-card-border px-3 py-2.5 text-sm font-mono outline-none focus:border-accent transition-colors pr-12"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted">{f.unit}</span>
                  </div>
                </div>
              ))}
              <div className="col-span-2 sm:col-span-3 p-3 rounded-xl bg-surface-2 border border-dashed border-card-border">
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  For deeper changes (goals, conditions, medications, lifestyle) use <span className="text-accent font-medium">Regenerate protocol</span> below to re-run onboarding.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Top stats row */}
              <div className="grid grid-cols-4 gap-2 sm:gap-3">
                <Stat label="Age" value={profile.age ?? '—'} />
                <Stat label="Sex" value={profile.sex ? (profile.sex === 'male' ? 'M' : profile.sex === 'female' ? 'F' : 'I') : '—'} />
                <Stat label="BMI" value={bmi} />
                <Stat label="Activity" value={<span className="capitalize text-sm">{profile.activity_level || '—'}</span>} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Pair label="Height" value={profile.height_cm ? `${profile.height_cm} cm` : null} />
                <Pair label="Weight" value={profile.weight_kg ? `${profile.weight_kg} kg` : null} />
              </div>

              {(birthDate || country || city || profile.ethnicity || wearable) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Pair label="Birth date" value={birthDate && new Date(birthDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} />
                  <Pair label="Ethnicity" value={profile.ethnicity && <span className="capitalize">{profile.ethnicity.replace('_', ' ')}</span>} />
                  <Pair label="Location" value={[city, country].filter(Boolean).join(', ') || null} />
                  <Pair label="Wearable" value={wearable !== 'none' ? wearable : null} />
                </div>
              )}

              {/* Diet / budget / openness */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Pair label="Diet" value={profile.diet_type && <span className="capitalize">{profile.diet_type}</span>} />
                <Pair label="Budget" value={profile.monthly_budget_ron ? `${profile.monthly_budget_ron} RON / month` : null} />
                <Pair label="Time/day" value={profile.time_budget_min ? `${profile.time_budget_min} min` : null} />
              </div>

              {/* Goals */}
              {(primaryGoal || secondaryGoals.length > 0) && (
                <div className="rounded-xl bg-surface-2 border border-card-border p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Target className="w-3.5 h-3.5 text-accent" />
                    <p className="text-[10px] text-muted uppercase tracking-widest">Goals</p>
                  </div>
                  {primaryGoal && <p className="text-sm font-medium">🎯 {primaryGoal}</p>}
                  {secondaryGoals.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {secondaryGoals.map(g => <Chip key={g} tone="accent">{g}</Chip>)}
                    </div>
                  )}
                </div>
              )}

              {/* Motivation */}
              {motivation && (
                <div className="rounded-xl bg-gradient-to-br from-accent/[0.04] to-transparent border border-accent/15 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-3.5 h-3.5 text-accent" />
                    <p className="text-[10px] text-accent uppercase tracking-widest">Why you're here</p>
                  </div>
                  <p className="text-xs text-foreground/90 leading-relaxed italic">&ldquo;{motivation}&rdquo;</p>
                </div>
              )}

              {/* Pain points + non-negotiables */}
              {(painPoints || nonNegotiables) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {painPoints && (
                    <div className="p-4 rounded-xl bg-surface-2 border border-card-border">
                      <p className="text-[10px] text-amber-400 uppercase tracking-widest mb-1.5">Pain points</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{painPoints}</p>
                    </div>
                  )}
                  {nonNegotiables && (
                    <div className="p-4 rounded-xl bg-surface-2 border border-card-border">
                      <p className="text-[10px] text-accent uppercase tracking-widest mb-1.5">Non-negotiables</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{nonNegotiables}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Conditions / meds / supplements / allergies / family hx */}
              {((profile.conditions?.length || 0) > 0
                 || (profile.medications?.filter(m => m.name)?.length || 0) > 0
                 || (profile.current_supplements?.length || 0) > 0
                 || familyHx.length > 0
                 || (profile.allergies?.length || 0) > 0) && (
                <div className="space-y-3">
                  {(profile.conditions?.length || 0) > 0 && (
                    <div>
                      <p className="text-[10px] text-muted uppercase tracking-widest mb-1.5">Conditions</p>
                      <div className="flex flex-wrap gap-1.5">{profile.conditions!.map(c => <Chip key={c} tone="amber">{c}</Chip>)}</div>
                    </div>
                  )}
                  {(profile.medications?.filter(m => m.name)?.length || 0) > 0 && (
                    <div>
                      <p className="text-[10px] text-muted uppercase tracking-widest mb-1.5">Medications</p>
                      <div className="space-y-1">
                        {profile.medications!.filter(m => m.name).map((m, i) => (
                          <p key={i} className="text-xs text-muted-foreground">· <span className="text-foreground">{m.name}</span> {m.dose} ({m.frequency})</p>
                        ))}
                      </div>
                    </div>
                  )}
                  {(profile.current_supplements?.length || 0) > 0 && (
                    <div>
                      <p className="text-[10px] text-muted uppercase tracking-widest mb-1.5">Current supplements</p>
                      <div className="flex flex-wrap gap-1.5">{profile.current_supplements!.map(s => <Chip key={s}>{s}</Chip>)}</div>
                    </div>
                  )}
                  {(profile.allergies?.length || 0) > 0 && (
                    <div>
                      <p className="text-[10px] text-muted uppercase tracking-widest mb-1.5">Allergies</p>
                      <div className="flex flex-wrap gap-1.5">{profile.allergies!.map(a => <Chip key={a} tone="danger">{a}</Chip>)}</div>
                    </div>
                  )}
                  {familyHx.length > 0 && (
                    <div>
                      <p className="text-[10px] text-muted uppercase tracking-widest mb-1.5">Family history</p>
                      <div className="flex flex-wrap gap-1.5">{familyHx.map(f => <Chip key={f} tone="amber">{f}</Chip>)}</div>
                    </div>
                  )}
                </div>
              )}

              {chronotype && (
                <Pair label="Chronotype" value={<span className="capitalize">🕐 {chronotype} person</span>} />
              )}
            </>
          )}
        </SettingsCard>
      )}

      {/* ═══════════ BLOOD TEST HISTORY ═══════════ */}
      <SettingsCard icon={Heart} title="Blood test history" subtitle={bloodTests.length > 0 ? `${bloodTests.length} test${bloodTests.length === 1 ? '' : 's'} on file` : 'No tests uploaded'}>
        {bloodTests.length === 0 ? (
          <p className="text-sm text-muted-foreground">Upload a lab report PDF during onboarding or regenerate protocol to add.</p>
        ) : (
          <div className="space-y-2">
            {bloodTests.map((test, i) => (
              <div key={test.id || i} className="flex items-center gap-3 p-3 rounded-xl bg-surface-2 border border-card-border">
                <div className="w-10 h-10 rounded-lg bg-surface-3 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{new Date(test.taken_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  <p className="text-[11px] text-muted-foreground">{Array.isArray(test.biomarkers) ? test.biomarkers.length : 0} biomarkers measured</p>
                </div>
              </div>
            ))}
          </div>
        )}
        <RetestUploader bloodTestsCount={bloodTests.length} />
      </SettingsCard>

      {/* ═══════════ SHARE PROTOCOL ═══════════ */}
      <SettingsCard icon={Share2} title="Share protocol" subtitle="Public read-only link to your diagnostic + protocol">
        {!shareUrl ? (
          <>
            <button
              onClick={handleShare}
              disabled={!protocolId || shareBusy}
              className={clsx('w-full py-3.5 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2',
                !protocolId
                  ? 'bg-surface-3 text-muted cursor-not-allowed'
                  : 'bg-accent/10 border border-accent/30 text-accent hover:bg-accent/15 hover:border-accent/50')}
            >
              {shareBusy ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-accent/40 border-t-accent rounded-full animate-spin" />
                  Generating link…
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4" />
                  Generate public link
                </>
              )}
            </button>
            {!protocolId && <p className="text-xs text-muted-foreground">Complete onboarding to generate a protocol first.</p>}
            {shareError && (
              <p className="text-xs text-danger p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                {shareError}
              </p>
            )}
          </>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input readOnly value={shareUrl} className="flex-1 rounded-xl bg-surface-2 border border-card-border px-3 py-2.5 text-xs font-mono truncate outline-none focus:border-accent" />
              <button onClick={handleCopy} className="shrink-0 p-2.5 rounded-xl bg-accent text-black hover:bg-accent-bright transition-colors">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Anyone with this link sees a read-only version — no personal data other than what&apos;s in your protocol.
            </p>
          </div>
        )}
      </SettingsCard>

      {/* ═══════════ ACTIONS (no heading per user request) ═══════════ */}
      <div className="glass-card rounded-2xl p-2 space-y-0.5 animate-fade-in-up">
        {[
          {
            icon: RotateCcw,
            label: 'Regenerate protocol',
            desc: 'Re-run onboarding with fresh data',
            tone: 'accent' as const,
            onClick: async () => { await fetch('/api/reset-onboarding', { method: 'POST' }); window.location.href = '/onboarding'; },
          },
          {
            icon: Download,
            label: 'Export all data',
            desc: 'JSON backup of profile + protocols + tests',
            tone: 'neutral' as const,
            onClick: handleExport,
          },
          {
            icon: LogOut,
            label: 'Log out',
            desc: 'Sign out of this device',
            tone: 'neutral' as const,
            onClick: handleLogout,
          },
          {
            icon: Trash2,
            label: 'Delete account',
            desc: 'Permanently erase account and all data',
            tone: 'danger' as const,
            onClick: () => setDeleteOpen(true),
          },
        ].map(a => {
          const Icon = a.icon;
          const toneClass = a.tone === 'accent' ? 'text-accent' : a.tone === 'danger' ? 'text-danger' : 'text-foreground';
          const iconBg = a.tone === 'accent' ? 'bg-accent/10 border-accent/20' : a.tone === 'danger' ? 'bg-red-500/10 border-red-500/20' : 'bg-surface-3 border-card-border';
          return (
            <button
              key={a.label}
              onClick={a.onClick}
              className="w-full flex items-center gap-3 p-3 sm:p-4 rounded-xl hover:bg-surface-2 active:bg-surface-3 transition-colors text-left group"
            >
              <div className={clsx('w-10 h-10 rounded-xl border flex items-center justify-center shrink-0', iconBg)}>
                <Icon className={clsx('w-4 h-4', toneClass)} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={clsx('text-sm font-medium', toneClass)}>{a.label}</p>
                <p className="text-[11px] text-muted-foreground">{a.desc}</p>
              </div>
              <span className="text-muted-foreground group-hover:text-foreground transition-colors text-sm">→</span>
            </button>
          );
        })}
      </div>

      <DeleteAccountModal open={deleteOpen} onClose={() => setDeleteOpen(false)} onConfirm={handleDeleteAccount} onExport={handleExport} />

      <p className="text-[11px] text-center text-muted pt-2">Protocol v3 · Not medical advice · Always consult a doctor</p>
    </div>
  );
}
