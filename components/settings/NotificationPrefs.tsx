'use client';

// Notification preferences card.
//
// Writes through /api/save-profile with a partial payload (notif_* fields
// only) so toggling a switch doesn't need to re-send the entire profile.
// The save route already supports partial updates — see its mapping table.
//
// Copy on each row names the specific trigger ("when your longevity score
// shifts by ≥3 points") instead of vague "Updates" language, so users can
// predict exactly what will arrive.

import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import clsx from 'clsx';
import { invalidate } from '@/lib/hooks/useApiData';

export interface NotificationPrefsProps {
  initial: {
    weeklyDigest?: boolean | null;
    protocolRegen?: boolean | null;
    retestReminders?: boolean | null;
    streakMilestones?: boolean | null;
  };
}

const ROWS: Array<{
  key: keyof NotificationPrefsProps['initial'];
  apiKey: string;
  label: string;
  desc: string;
  defaultOn: boolean;
}> = [
  {
    key: 'protocolRegen',
    apiKey: 'notifProtocolRegen',
    label: 'When my protocol changes',
    desc: 'Get notified when your score or biological age moves after an update.',
    defaultOn: true,
  },
  {
    key: 'weeklyDigest',
    apiKey: 'notifWeeklyDigest',
    label: 'Weekly Monday recap',
    desc: 'A short email Monday morning with best day, worst day, and what\'s trending.',
    defaultOn: false,
  },
  {
    key: 'retestReminders',
    apiKey: 'notifRetestReminders',
    label: 'Lab retest reminders',
    desc: 'Nudge me when a biomarker has been off for a while and it\'s time to retest.',
    defaultOn: false,
  },
  {
    key: 'streakMilestones',
    apiKey: 'notifStreakMilestones',
    label: 'Streak milestones',
    desc: 'Quick note at 7, 30, and 100-day streaks.',
    defaultOn: false,
  },
];

export function NotificationPrefs({ initial }: NotificationPrefsProps) {
  // Seed state from `initial`; fall back to per-row default if the column
  // is null (new users before the migration ran). Keeps first render stable.
  const [state, setState] = useState(() => {
    const out: Record<string, boolean> = {};
    for (const r of ROWS) {
      const v = initial[r.key];
      out[r.key] = v === null || v === undefined ? r.defaultOn : !!v;
    }
    return out;
  });
  const [saving, setSaving] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ tone: 'ok' | 'err'; msg: string } | null>(null);

  // If the initial snapshot loads late (SWR hydration), sync once.
  useEffect(() => {
    setState(prev => {
      const next = { ...prev };
      let changed = false;
      for (const r of ROWS) {
        const v = initial[r.key];
        if (v !== null && v !== undefined && !!v !== next[r.key]) {
          next[r.key] = !!v;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [initial]);

  const toggle = async (row: (typeof ROWS)[number]) => {
    const nextVal = !state[row.key];
    setState(s => ({ ...s, [row.key]: nextVal }));
    setSaving(row.key);
    setBanner(null);
    try {
      const res = await fetch('/api/save-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [row.apiKey]: nextVal }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Failed (${res.status})`);
      }
      // Re-hydrate so any other component reading from /api/my-data reflects
      // the change without a manual refresh.
      invalidate.myData();
    } catch (e) {
      // Revert optimistic toggle + surface an error banner.
      setState(s => ({ ...s, [row.key]: !nextVal }));
      setBanner({ tone: 'err', msg: e instanceof Error ? e.message : 'Save failed' });
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4 animate-fade-in-up">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/25 flex items-center justify-center">
          <Bell className="w-4 h-4 text-accent" />
        </div>
        <div>
          <p className="text-sm font-semibold">What should I tell you about?</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">Pick what you want alerts for. Email delivery ships with the mobile app.</p>
        </div>
      </div>

      {banner && (
        <p className={clsx('text-[11px] p-2 rounded-lg border',
          banner.tone === 'ok' ? 'bg-accent/5 text-accent border-accent/25' : 'bg-red-500/5 text-danger border-red-500/20')}>
          {banner.msg}
        </p>
      )}

      <div className="space-y-2">
        {ROWS.map(row => (
          <label key={row.key} className="flex items-start gap-3 p-3 rounded-xl bg-surface-2 border border-card-border hover:border-card-border-hover transition-colors cursor-pointer">
            <div className="flex-1 min-w-0 pr-2">
              <p className="text-sm font-medium">{row.label}</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{row.desc}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={state[row.key]}
              aria-label={`Toggle ${row.label}`}
              onClick={() => toggle(row)}
              disabled={saving === row.key}
              className={clsx('relative w-10 h-6 rounded-full transition-colors shrink-0 mt-0.5',
                state[row.key] ? 'bg-accent' : 'bg-surface-3 border border-card-border')}
            >
              <span
                className={clsx('absolute top-0.5 w-5 h-5 rounded-full bg-background transition-all',
                  state[row.key] ? 'left-[18px]' : 'left-0.5')}
              />
            </button>
          </label>
        ))}
      </div>
    </div>
  );
}
