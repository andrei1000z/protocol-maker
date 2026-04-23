'use client';

import { useEffect, useState, useRef } from 'react';
import { useMyData, invalidate } from '@/lib/hooks/useApiData';
import clsx from 'clsx';
import {
  Share2, Download, RotateCcw, LogOut, Copy, Check, FileText, User, Heart,
  Edit2, Save, Trash2, AlertTriangle, Target, Sparkles, X, Clock, Link2, Unlink,
} from 'lucide-react';
import { OAuthPermissionsModal } from '@/components/settings/OAuthPermissionsModal';
import { NotificationPrefs } from '@/components/settings/NotificationPrefs';
import { ThemePicker } from '@/components/settings/ThemePicker';
import { LanguagePicker } from '@/components/settings/LanguagePicker';
import {
  buildBiomarkersCsv,
  buildDailyMetricsCsv,
  buildProtocolHistoryCsv,
  buildDoctorMarkdown,
  downloadBlob,
} from '@/lib/utils/export-formats';

interface ShareLinkRow {
  slug: string;
  created_at: string;
  expires_at: string | null;
  view_count: number;
  protocol_id: string;
}

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
  referral_code?: string | null;
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
// Shared wearable-provider row — one per OAuth integration we ship. Status
// / connect / sync / disconnect all hit /api/integrations/[providerKey].
// Handles three states: configured+connected, configured-not-connected,
// not-configured (admin hasn't set env vars). Reads the OAuth-callback
// redirect params for its specific providerKey.
interface WearableRowProps {
  providerKey: 'oura' | 'fitbit' | 'withings' | 'whoop' | 'google_fit';
  name: string;
  tagline: string;
  emoji: string;
  accentBg: string;      // e.g. 'bg-purple-500/10 border-purple-500/25'
  envVar: string;        // first env var name, for the "configure in env" hint
  registerUrl: string;
  syncLookbackLabel?: string;
}
function WearableRow({ providerKey, name, tagline, emoji, accentBg, envVar, registerUrl, syncLookbackLabel }: WearableRowProps) {
  const [status, setStatus] = useState<{
    configured: boolean;
    connected: boolean;
    lastSyncedAt: string | null;
    lastSyncError: string | null;
  } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [banner, setBanner] = useState<{ tone: 'ok' | 'err'; msg: string } | null>(null);
  // Gate the actual OAuth redirect behind an explainer modal so users see
  // what we'll read BEFORE they land on the provider's consent screen.
  const [permsOpen, setPermsOpen] = useState(false);

  const load = async () => {
    try {
      const res = await fetch(`/api/integrations/${providerKey}`);
      if (res.ok) setStatus(await res.json());
    } catch { /* ignore */ }
  };

  useEffect(() => {
    load();
    if (typeof window === 'undefined') return;
    const qs = new URLSearchParams(window.location.search);
    if (qs.get('integration') === providerKey) {
      if (qs.get('connected') === '1') setBanner({ tone: 'ok', msg: `${name} connected. Next morning's readings land automatically.` });
      else if (qs.get('error')) setBanner({ tone: 'err', msg: `${name} connect failed: ${qs.get('error')}` });
      const url = new URL(window.location.href);
      url.searchParams.delete('integration'); url.searchParams.delete('connected'); url.searchParams.delete('error');
      window.history.replaceState({}, '', url.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerKey]);

  const connect = () => setPermsOpen(true);
  const syncNow = async () => {
    setSyncing(true); setBanner(null);
    try {
      const res = await fetch(`/api/integrations/${providerKey}`, { method: 'POST' });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setBanner({ tone: 'ok', msg: `Synced ${j.daysFetched} days · ${j.rowsWritten} rows updated` });
      load();
    } catch (e) {
      setBanner({ tone: 'err', msg: e instanceof Error ? e.message : String(e) });
    } finally { setSyncing(false); }
  };
  const disconnect = async () => {
    if (!window.confirm(`Disconnect ${name}? Your stored tokens will be deleted; past data stays.`)) return;
    await fetch(`/api/integrations/${providerKey}`, { method: 'DELETE' });
    setBanner({ tone: 'ok', msg: `${name} disconnected.` });
    load();
  };

  const loading = !status;
  const configured = status?.configured;
  const connected = status?.connected;

  const lastSync = status?.lastSyncedAt ? new Date(status.lastSyncedAt) : null;
  const lastSyncStr = lastSync
    ? `${Math.max(0, Math.floor((Date.now() - lastSync.getTime()) / 3600_000))}h ago`
    : 'never';

  return (
    <div className="rounded-xl p-4 bg-surface-2 border border-card-border space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={clsx('w-10 h-10 rounded-xl border flex items-center justify-center shrink-0', accentBg)}>
            <span className="text-lg">{emoji}</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{name}</p>
            <p className="text-[11px] text-muted-foreground truncate">{tagline}</p>
          </div>
        </div>
        <span className={clsx('text-[10px] font-mono px-2 py-0.5 rounded-full border shrink-0',
          loading ? 'bg-surface-3 text-muted border-card-border'
          : !configured ? 'bg-surface-3 text-muted border-card-border'
          : connected ? 'bg-accent/10 text-accent border-accent/25'
          : 'bg-surface-3 text-muted border-card-border')}>
          {loading ? '…' : !configured ? 'Not configured' : connected ? 'Connected' : 'Not connected'}
        </span>
      </div>

      {configured && connected && (
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span>Last sync: {lastSyncStr}{syncLookbackLabel ? ` · ${syncLookbackLabel}` : ''}</span>
          {status?.lastSyncError && (
            <span className="inline-flex items-center gap-1 text-danger">
              <AlertTriangle className="w-3 h-3" /> Sync error
            </span>
          )}
        </div>
      )}
      {configured && status?.lastSyncError && (
        <p className="text-[10px] text-danger/80 bg-red-500/5 border border-red-500/15 rounded-lg px-2 py-1.5">
          {status.lastSyncError}
        </p>
      )}

      {configured === false && (
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          This server doesn&apos;t have the OAuth credentials yet. Admin: register at{' '}
          <a href={registerUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline font-mono">{registerUrl.replace(/^https?:\/\//, '')}</a>
          {' '}and set <span className="font-mono">{envVar}</span> in env.
        </p>
      )}

      {configured && (
        <div className="flex gap-2 flex-wrap">
          {!connected ? (
            <button
              onClick={connect}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl bg-accent text-black hover:bg-accent-bright transition-colors"
            >
              <Link2 className="w-3.5 h-3.5" /> Connect {name.split(' ')[0]}
            </button>
          ) : (
            <>
              <button
                onClick={syncNow}
                disabled={syncing}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl bg-accent text-black hover:bg-accent-bright disabled:opacity-60 transition-colors"
              >
                {syncing ? <span className="w-3 h-3 border-2 border-black/40 border-t-black rounded-full animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                {syncing ? 'Syncing…' : 'Sync now'}
              </button>
              <button
                onClick={disconnect}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3.5 py-2 rounded-xl bg-surface-3 border border-card-border text-muted-foreground hover:text-danger hover:border-red-500/30 transition-colors"
              >
                <Unlink className="w-3.5 h-3.5" /> Disconnect
              </button>
            </>
          )}
        </div>
      )}

      {banner && (
        <p className={clsx('text-[11px] p-2 rounded-lg border',
          banner.tone === 'ok' ? 'bg-accent/5 text-accent border-accent/25' : 'bg-red-500/5 text-danger border-red-500/20')}>
          {banner.msg}
        </p>
      )}

      <OAuthPermissionsModal
        open={permsOpen}
        provider={providerKey}
        providerName={name}
        connectUrl={`/api/integrations/${providerKey}/connect`}
        onClose={() => setPermsOpen(false)}
      />
    </div>
  );
}

// Samsung Health + Apple HealthKit — these genuinely don't have web OAuth.
// Render a transparent "native-only" row so users don't wonder why they're
// missing. Includes Google Fit as the escape hatch (Samsung Galaxy Watch data
// can flow Samsung Health → Health Connect → Google Fit → our API).
function NativeOnlyRow({ name, emoji, accentBg, note }: { name: string; emoji: string; accentBg: string; note: string }) {
  return (
    <div className="rounded-xl p-4 bg-surface-2/50 border border-card-border border-dashed space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={clsx('w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 opacity-70', accentBg)}>
            <span className="text-lg">{emoji}</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{name}</p>
            <p className="text-[11px] text-muted-foreground truncate">{note}</p>
          </div>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border bg-surface-3 text-muted border-card-border shrink-0">
          Mobile only
        </span>
      </div>
    </div>
  );
}

function WearableIntegrationsCard() {
  return (
    <SettingsCard icon={Link2} title="Wearable integrations" subtitle="Auto-sync your daily metrics from connected devices">
      <div className="space-y-2.5">
        <WearableRow
          providerKey="oura"
          name="Oura Ring"
          tagline="Sleep stages, HRV, body temp, readiness, SpO₂"
          emoji="💍"
          accentBg="bg-purple-500/10 border-purple-500/25"
          envVar="OURA_CLIENT_ID + OURA_CLIENT_SECRET"
          registerUrl="https://cloud.ouraring.com/oauth/applications"
        />
        <WearableRow
          providerKey="fitbit"
          name="Fitbit"
          tagline="Activity, sleep, heart rate, SpO₂, skin temp — Charge / Sense / Versa / Pixel Watch"
          emoji="⌚"
          accentBg="bg-cyan-500/10 border-cyan-500/25"
          envVar="FITBIT_CLIENT_ID + FITBIT_CLIENT_SECRET"
          registerUrl="https://dev.fitbit.com/apps/new"
        />
        <WearableRow
          providerKey="withings"
          name="Withings"
          tagline="Smart scale body comp (fat %, muscle, water, bone, BMR) + ScanWatch"
          emoji="⚖️"
          accentBg="bg-emerald-500/10 border-emerald-500/25"
          envVar="WITHINGS_CLIENT_ID + WITHINGS_CLIENT_SECRET"
          registerUrl="https://account.withings.com/partner/dashboard_oauth2"
          syncLookbackLabel="7-day lookback"
        />
        <WearableRow
          providerKey="whoop"
          name="WHOOP"
          tagline="Recovery, HRV (continuous overnight), strain, sleep stages, RHR"
          emoji="🏋️"
          accentBg="bg-amber-500/10 border-amber-500/25"
          envVar="WHOOP_CLIENT_ID + WHOOP_CLIENT_SECRET"
          registerUrl="https://developer.whoop.com/"
        />
        <WearableRow
          providerKey="google_fit"
          name="Google Fit"
          tagline="Wear OS + Android watches that sync to Fit (Pixel Watch, Amazfit, MiBand via bridges)"
          emoji="🤖"
          accentBg="bg-blue-500/10 border-blue-500/25"
          envVar="GOOGLE_FIT_CLIENT_ID + GOOGLE_FIT_CLIENT_SECRET"
          registerUrl="https://console.cloud.google.com/apis/credentials"
        />
        <NativeOnlyRow
          name="Samsung Galaxy Watch / Ring / Samsung Health"
          emoji="📱"
          accentBg="bg-blue-500/10 border-blue-500/25"
          note="No web OAuth — Samsung Health is Android-only. Coming in the mobile app."
        />
        <NativeOnlyRow
          name="Apple Watch / Apple Health"
          emoji="🍎"
          accentBg="bg-gray-500/10 border-gray-500/25"
          note="Apple HealthKit is iOS-only. Coming in the mobile app."
        />
      </div>
    </SettingsCard>
  );
}

// Referral card — surfaces the user's personal referral code + share CTA.
// Code is generated server-side (see scripts/upgrade.sql: ensure_referral_code
// trigger) so by the time settings loads, profiles.referral_code is populated.
function ReferralCard({ referralCode }: { referralCode?: string | null }) {
  const [copied, setCopied] = useState(false);
  if (!referralCode) {
    return null;  // Backfilled post-migration; don't render empty state pre-migration
  }
  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/r/${referralCode}`
    : `/r/${referralCode}`;
  const shareText = `Check out Protocol — it built me a personalized longevity protocol in under a minute. Use my code ${referralCode} to skip the waitlist.`;

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <SettingsCard icon={Sparkles} title="Invite a friend" subtitle="Your referral code — share with anyone interested">
      <div className="rounded-xl p-4 bg-gradient-to-br from-accent/[0.06] via-accent/[0.02] to-transparent border border-accent/25 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[10px] uppercase tracking-widest text-muted">Your code</span>
          <code className="text-lg font-mono font-bold tracking-widest text-accent bg-accent/10 px-3 py-1 rounded-lg border border-accent/25">
            {referralCode}
          </code>
        </div>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={shareUrl}
            className="flex-1 rounded-xl bg-surface-2 border border-card-border px-3 py-2 text-xs font-mono truncate outline-none focus:border-accent"
          />
          <button
            onClick={copyLink}
            className="shrink-0 p-2 rounded-xl bg-accent text-black hover:bg-accent-bright transition-colors"
            aria-label="Copy referral link"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-xs font-medium px-3 py-2 rounded-xl bg-surface-3 border border-card-border hover:border-accent/40 text-muted-foreground hover:text-accent transition-colors"
          >
            WhatsApp
          </a>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Anyone who signs up with your link gets attributed to you. Referral rewards come with the paid tier launch.
        </p>
      </div>
    </SettingsCard>
  );
}

function DeleteAccountModal({ open, onClose, onConfirm, onExport }: { open: boolean; onClose: () => void; onConfirm: () => Promise<void>; onExport: () => Promise<void> }) {
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exported, setExported] = useState(false);
  const [error, setError] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);

  // Focus trap + ESC-to-close + restore focus on close. Without this, tab
  // cycles through the page behind the overlay and ESC does nothing —
  // accessibility + keyboard-user frustration issue on a destructive action.
  useEffect(() => {
    if (!open) return;
    prevFocusRef.current = document.activeElement as HTMLElement | null;

    const dialog = dialogRef.current;
    // Move focus into the dialog on open
    const focusable = () =>
      dialog?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input:not([disabled]), select, [tabindex]:not([tabindex="-1"])'
      );
    setTimeout(() => focusable()?.[0]?.focus(), 0);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) { e.preventDefault(); onClose(); return; }
      if (e.key !== 'Tab') return;
      const items = focusable();
      if (!items || items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
      else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prevFocusRef.current?.focus();
    };
  }, [open, loading, onClose]);

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
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-account-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center animate-fade-in"
      onClick={loading ? undefined : onClose}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div
        ref={dialogRef}
        className="relative glass-card rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md mx-0 sm:mx-4 overflow-hidden animate-fade-in-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 sm:p-7 space-y-5">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-danger" />
          </div>
          <div>
            <h2 id="delete-account-title" className="text-xl font-semibold tracking-tight">Delete your account?</h2>
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
  const [shareLinks, setShareLinks] = useState<ShareLinkRow[]>([]);
  const [shareLinksLoaded, setShareLinksLoaded] = useState(false);

  // Load the user's active share links. Refreshed after every mutate
  // (create/revoke/expire-set) by calling refreshShareLinks() explicitly.
  const refreshShareLinks = async () => {
    try {
      const res = await fetch('/api/share?mine=1');
      if (!res.ok) return;
      const j = await res.json();
      setShareLinks(Array.isArray(j.links) ? j.links : []);
    } catch { /* ignore — list stays empty */ }
    finally { setShareLinksLoaded(true); }
  };
  useEffect(() => { refreshShareLinks(); }, []);
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
      refreshShareLinks();
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

  const handleRevokeLink = async (slug: string) => {
    if (!window.confirm('Revoke this link? Anyone with the URL will get a 404.')) return;
    try {
      await fetch(`/api/share?slug=${encodeURIComponent(slug)}`, { method: 'DELETE' });
    } finally { refreshShareLinks(); }
  };

  const handleSetExpiration = async (slug: string, days: number | null) => {
    const body = days === null
      ? { expiresAt: null }
      : { expiresAt: new Date(Date.now() + days * 86400000).toISOString() };
    await fetch(`/api/share?slug=${encodeURIComponent(slug)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    refreshShareLinks();
  };

  const handleCopyLinkSlug = (slug: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/share/${slug}`);
  };

  const handleExport = async () => {
    // ?full=1 → complete GDPR archive (daily_metrics, compliance_logs,
    // share_links, protocol history). Plain /api/my-data is the lean
    // page-hydration shape and would be an incomplete Article 15 response.
    const res = await fetch('/api/my-data?full=1');
    const data = await res.json();
    downloadBlob(JSON.stringify(data, null, 2),
      `protocol-export-${new Date().toISOString().split('T')[0]}.json`,
      'application/json');
  };

  // Format-specific exports — same `?full=1` archive, transformed client-side.
  // Biomarkers + daily metrics go out as CSV (doctor/Excel friendly) and
  // the Markdown doctor snapshot is a narrative summary for a consult.
  const handleExportBiomarkersCsv = async () => {
    const res = await fetch('/api/my-data?full=1');
    const data = await res.json();
    downloadBlob(buildBiomarkersCsv(data),
      `biomarkers-${new Date().toISOString().split('T')[0]}.csv`,
      'text/csv;charset=utf-8');
  };
  const handleExportMetricsCsv = async () => {
    const res = await fetch('/api/my-data?full=1');
    const data = await res.json();
    downloadBlob(buildDailyMetricsCsv(data),
      `daily-metrics-${new Date().toISOString().split('T')[0]}.csv`,
      'text/csv;charset=utf-8');
  };
  const handleExportProtocolHistoryCsv = async () => {
    const res = await fetch('/api/my-data?full=1');
    const data = await res.json();
    downloadBlob(buildProtocolHistoryCsv(data),
      `protocol-history-${new Date().toISOString().split('T')[0]}.csv`,
      'text/csv;charset=utf-8');
  };
  const handleExportDoctorMd = async () => {
    const res = await fetch('/api/my-data?full=1');
    const data = await res.json();
    downloadBlob(buildDoctorMarkdown(data),
      `doctor-snapshot-${new Date().toISOString().split('T')[0]}.md`,
      'text/markdown;charset=utf-8');
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
          subtitle={birthDate ? `Born ${new Date(birthDate).toLocaleDateString('ro-RO', { month: 'short', day: 'numeric', year: 'numeric' })}` : (country || city) ? [city, country].filter(Boolean).join(', ') : 'Profile overview'}
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
                  <Pair label="Birth date" value={birthDate && new Date(birthDate).toLocaleDateString('ro-RO', { month: 'short', day: 'numeric', year: 'numeric' })} />
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
                  <p className="text-sm font-medium">{new Date(test.taken_at).toLocaleDateString('ro-RO', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  <p className="text-[11px] text-muted-foreground">{Array.isArray(test.biomarkers) ? test.biomarkers.length : 0} biomarkers measured</p>
                </div>
              </div>
            ))}
          </div>
        )}
        <RetestUploader bloodTestsCount={bloodTests.length} />
      </SettingsCard>

      {/* ═══════════ WEARABLES — Oura, Fitbit, Withings + native-only notices ═══════════ */}
      <WearableIntegrationsCard />

      {/* ═══════════ REFERRAL ═══════════ */}
      <ReferralCard referralCode={(profile?.onboarding_data as Record<string, unknown> | undefined)?.referral_code as string | undefined ?? (myData?.profile as { referral_code?: string } | null)?.referral_code ?? null} />

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

        {/* Active links list — revoke + expiration management. Only rendered
            once the list has loaded AND the user actually has links. */}
        {shareLinksLoaded && shareLinks.length > 0 && (
          <div className="mt-5 pt-5 border-t border-card-border space-y-2">
            <p className="text-[10px] uppercase tracking-widest text-muted font-mono mb-2">
              Your active links ({shareLinks.length})
            </p>
            {shareLinks.map(link => {
              const expired = link.expires_at && new Date(link.expires_at) < new Date();
              const expiresIn = link.expires_at
                ? Math.ceil((new Date(link.expires_at).getTime() - Date.now()) / 86400000)
                : null;
              return (
                <div key={link.slug} className="rounded-xl bg-surface-2 border border-card-border p-2.5 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs truncate flex-1 text-muted-foreground">
                      /share/{link.slug}
                    </span>
                    <span className="text-[10px] font-mono text-muted shrink-0">
                      {link.view_count} {link.view_count === 1 ? 'view' : 'views'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={clsx('inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border',
                      expired ? 'bg-red-500/10 text-danger border-red-500/25'
                      : expiresIn !== null ? 'bg-amber-500/10 text-amber-400 border-amber-500/25'
                      : 'bg-surface-3 text-muted border-card-border'
                    )}>
                      <Clock className="w-2.5 h-2.5" />
                      {expired ? 'Expired'
                        : expiresIn !== null ? `Expires in ${expiresIn}d`
                        : 'No expiry'}
                    </span>
                    <button
                      onClick={() => handleCopyLinkSlug(link.slug)}
                      className="text-[10px] px-2 py-1 rounded-lg bg-surface-3 hover:bg-accent/10 text-muted-foreground hover:text-accent transition-colors"
                    >
                      Copy URL
                    </button>
                    <select
                      value=""
                      onChange={e => {
                        const v = e.target.value;
                        if (v === '') return;
                        if (v === 'none') handleSetExpiration(link.slug, null);
                        else handleSetExpiration(link.slug, parseInt(v, 10));
                        e.currentTarget.value = '';
                      }}
                      className="text-[10px] px-2 py-1 rounded-lg bg-surface-3 border border-card-border text-muted-foreground"
                    >
                      <option value="">Set expiry…</option>
                      <option value="7">7 days</option>
                      <option value="30">30 days</option>
                      <option value="90">90 days</option>
                      <option value="none">Never</option>
                    </select>
                    <button
                      onClick={() => handleRevokeLink(link.slug)}
                      className="ml-auto inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-red-500/10 text-danger border border-red-500/25 hover:bg-red-500/15 transition-colors"
                    >
                      <X className="w-3 h-3" /> Revoke
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SettingsCard>

      {/* Theme picker — system / light / dark. Writes localStorage; the
          boot script in app/layout.tsx applies pre-hydration to avoid the
          dark→light flash. */}
      <ThemePicker />

      {/* Language picker — EN / RO scaffolded. Uses the i18n module's
          dictionary lookup; new strings flow through `t()` in components. */}
      <LanguagePicker />

      {/* Notification preferences — writes through /api/save-profile with
          a partial payload so toggling a switch doesn't null unrelated
          profile columns. Defaults to "protocol regen alerts on" only. */}
      <NotificationPrefs
        initial={{
          weeklyDigest:     (profile as Record<string, unknown>).notif_weekly_digest as boolean | null | undefined,
          protocolRegen:    (profile as Record<string, unknown>).notif_protocol_regen as boolean | null | undefined,
          retestReminders:  (profile as Record<string, unknown>).notif_retest_reminders as boolean | null | undefined,
          streakMilestones: (profile as Record<string, unknown>).notif_streak_milestones as boolean | null | undefined,
        }}
      />

      {/* ═══════════ DATA EXPORT ═══════════
          Four format-specific exports beyond the GDPR JSON archive below.
          CSV lands in Excel/Sheets in one paste; Markdown snapshot is meant
          for sending to a doctor during a consult. All pull from the same
          /api/my-data?full=1 endpoint — transforms happen client-side. */}
      <div className="glass-card rounded-2xl p-5 space-y-3 animate-fade-in-up">
        <div>
          <p className="text-sm font-semibold">Download your data</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">Everything here comes from your own records, unredacted. Open the CSVs in Excel or Sheets.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { label: 'Biomarkers (CSV)',       desc: 'Every lab value you\'ve uploaded.', onClick: handleExportBiomarkersCsv },
            { label: 'Daily metrics (CSV)',    desc: 'Sleep, HRV, steps — last month.',    onClick: handleExportMetricsCsv },
            { label: 'Protocol history (CSV)', desc: 'Every regeneration with scores.',    onClick: handleExportProtocolHistoryCsv },
            { label: 'Doctor summary (.md)',   desc: 'One-pager to show your GP.',         onClick: handleExportDoctorMd },
          ].map(x => (
            <button
              key={x.label}
              onClick={x.onClick}
              className="flex items-start gap-3 p-3 rounded-xl bg-surface-2 border border-card-border hover:border-accent/30 hover:text-accent transition-colors text-left"
            >
              <Download className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold">{x.label}</p>
                <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">{x.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ═══════════ ACTIONS (no heading per user request) ═══════════ */}
      <div className="glass-card rounded-2xl p-2 space-y-0.5 animate-fade-in-up">
        {[
          {
            icon: RotateCcw,
            label: 'Rebuild my protocol from scratch',
            desc: 'Walks you through onboarding again with fresh answers',
            tone: 'accent' as const,
            onClick: async () => { await fetch('/api/reset-onboarding', { method: 'POST' }); window.location.href = '/onboarding'; },
          },
          {
            icon: Download,
            label: 'Full data archive (JSON)',
            desc: 'Everything in one file — GDPR Article 15',
            tone: 'neutral' as const,
            onClick: handleExport,
          },
          {
            icon: LogOut,
            label: 'Sign out',
            desc: 'Sign out of this device only',
            tone: 'neutral' as const,
            onClick: handleLogout,
          },
          {
            icon: Trash2,
            label: 'Delete my account',
            desc: 'Permanent. Wipes profile, labs, protocols, chat.',
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
