'use client';

// Pre-OAuth explainer modal.
//
// Users tap "Connect Oura" → get punted to oura.com → face a permissions
// screen that's sometimes opaque ("allow readonly access to all data"). They
// bounce. This modal shows FIRST, on OUR domain, explaining:
//   - exactly which data categories we read
//   - what we DON'T do (no writes, no sharing, no ads)
//   - where tokens are stored (encrypted at rest via Supabase)
//
// After Continue, the component triggers the provider's /connect endpoint.
//
// Scopes are hard-coded per provider because each OAuth client is registered
// with a fixed scope set in the provider console — the string displayed here
// must reflect what's in /lib/integrations/<provider>.ts. If you change the
// scopes in the integration module, update this map.

import { useEffect } from 'react';
import { X, Shield, Eye, Ban } from 'lucide-react';

export interface OAuthPermissionsModalProps {
  open: boolean;
  provider: 'oura' | 'fitbit' | 'withings' | 'whoop' | 'google_fit';
  providerName: string;
  /** URL to redirect to after user accepts. Usually `/api/integrations/<p>/connect`. */
  connectUrl: string;
  onClose: () => void;
}

// Per-provider data categories we actually read. Sourced from each
// integration module's scopes + API paths we hit in lib/integrations/<p>.ts.
const PROVIDER_SCOPES: Record<OAuthPermissionsModalProps['provider'], { reads: string[]; scope: string }> = {
  oura: {
    reads: ['Sleep score + stages', 'HRV + resting heart rate', 'Skin temperature deviation', 'SpO₂ (overnight)', 'Activity (steps, calories)', 'Readiness score'],
    scope: 'daily, heartrate, personal, sleep, spo2, tag, workout, session, ring_configuration',
  },
  fitbit: {
    reads: ['Sleep duration + stages', 'Resting heart rate', 'Activity (steps, active minutes)', 'Weight (if logged)', 'Readiness score (if available)'],
    scope: 'activity, heartrate, sleep, weight, profile',
  },
  withings: {
    reads: ['Weight + body composition', 'Blood pressure readings (if you own the cuff)', 'Sleep cycles', 'Heart rate'],
    scope: 'user.info, user.metrics, user.activity',
  },
  whoop: {
    reads: ['Recovery score', 'Strain + day score', 'Sleep performance', 'HRV + resting heart rate'],
    scope: 'read:recovery, read:cycles, read:sleep, read:workout, read:profile',
  },
  google_fit: {
    reads: ['Steps + active time', 'Resting heart rate', 'Sleep segments', 'Weight (if synced)'],
    scope: 'fitness.activity.read, fitness.heart_rate.read, fitness.sleep.read, fitness.body.read',
  },
};

export function OAuthPermissionsModal({ open, provider, providerName, connectUrl, onClose }: OAuthPermissionsModalProps) {
  // ESC to close. Only attach the listener while open to avoid background cost.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const scopes = PROVIDER_SCOPES[provider];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="oauth-perms-title"
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center animate-fade-in"
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface-1 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg mx-0 sm:mx-4 p-6 sm:p-7 space-y-5 border border-card-border animate-fade-in-up">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-accent/10 border border-accent/25 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h2 id="oauth-perms-title" className="text-lg font-semibold tracking-tight">Connecting {providerName}</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">Review what we&apos;ll read before you continue.</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <section className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-accent">
            <Eye className="w-3.5 h-3.5" />
            We&apos;ll READ
          </div>
          <ul className="space-y-1.5 pl-1">
            {scopes.reads.map(r => (
              <li key={r} className="text-sm text-foreground/90 flex items-start gap-2">
                <span className="text-accent mt-1 shrink-0">•</span>{r}
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Ban className="w-3.5 h-3.5" />
            We will NEVER
          </div>
          <ul className="space-y-1.5 pl-1 text-sm text-muted-foreground">
            <li className="flex items-start gap-2"><span className="text-muted mt-1 shrink-0">•</span>Write back to your {providerName} account — the connection is one-way.</li>
            <li className="flex items-start gap-2"><span className="text-muted mt-1 shrink-0">•</span>Share your data with advertisers, insurers, or third parties.</li>
            <li className="flex items-start gap-2"><span className="text-muted mt-1 shrink-0">•</span>Keep your tokens if you disconnect — they&apos;re deleted immediately.</li>
          </ul>
        </section>

        <p className="text-[10px] text-muted leading-relaxed font-mono break-all">
          OAuth scope: {scopes.scope}
        </p>

        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-surface-3 border border-card-border text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <a
            href={connectUrl}
            className="flex-1 py-3 rounded-xl bg-accent text-black font-semibold text-sm text-center hover:bg-accent-bright transition-colors"
          >
            Continue to {providerName}
          </a>
        </div>

        <p className="text-[10px] text-muted text-center leading-relaxed">
          You&apos;ll complete the authorization on {providerName}&apos;s site, then return here automatically.
        </p>
      </div>
    </div>
  );
}
