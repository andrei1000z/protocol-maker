'use client';

// Onboarding step 5 — goals + budget + experimental openness.
// State lives in the parent page so existing flow (save, restore, validate)
// stays untouched. Setters arrive as named props.

import clsx from 'clsx';
import { GOALS } from '@/lib/engine/onboarding-options';

export interface Step5GoalsProps {
  primaryGoal: string;
  setPrimaryGoal: (v: string) => void;
  secondaryGoals: string[];
  setSecondaryGoals: React.Dispatch<React.SetStateAction<string[]>>;
  specificTarget: string;
  setSpecificTarget: (v: string) => void;
  timelineMonths: number;
  setTimelineMonths: (v: number) => void;
  timeBudget: number;
  setTimeBudget: (v: number) => void;
  monthlyBudget: number;
  setMonthlyBudget: (v: number) => void;
  experimental: string;
  setExperimental: (v: string) => void;
  error?: string;
}

export function Step5Goals({
  primaryGoal, setPrimaryGoal,
  secondaryGoals, setSecondaryGoals,
  specificTarget, setSpecificTarget,
  timelineMonths, setTimelineMonths,
  timeBudget, setTimeBudget,
  monthlyBudget, setMonthlyBudget,
  experimental, setExperimental,
  error,
}: Step5GoalsProps) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Obiectivele tale</h1>
        <p className="text-muted-foreground text-sm mt-1">Ce contează cel mai mult?</p>
      </div>

      <div>
        <label className="text-xs text-muted-foreground mb-2 block">Obiectiv principal (alege UNUL)</label>
        <div className="grid grid-cols-2 gap-2">
          {GOALS.map(g => (
            <button
              key={g}
              onClick={() => setPrimaryGoal(g)}
              className={clsx(
                'p-3 rounded-xl text-sm text-left transition-all',
                primaryGoal === g
                  ? 'bg-accent/10 border border-accent/50 text-accent'
                  : 'bg-card border border-card-border text-muted-foreground'
              )}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs text-muted-foreground mb-2 block">Obiective secundare (max 3)</label>
        <div className="grid grid-cols-2 gap-2">
          {GOALS.filter(g => g !== primaryGoal).map(g => (
            <button
              key={g}
              onClick={() => {
                if (secondaryGoals.includes(g)) setSecondaryGoals(p => p.filter(x => x !== g));
                else if (secondaryGoals.length < 3) setSecondaryGoals(p => [...p, g]);
              }}
              className={clsx(
                'p-2 rounded-xl text-xs text-left transition-all',
                secondaryGoals.includes(g)
                  ? 'bg-accent/10 border border-accent/50 text-accent'
                  : 'bg-card border border-card-border text-muted-foreground'
              )}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs text-muted-foreground">Țintă specifică (opțional)</label>
        <input
          type="text"
          value={specificTarget}
          onChange={e => setSpecificTarget(e.target.value)}
          placeholder="ex: -10kg până la vară, HbA1c < 5.3"
          className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent"
        />
      </div>

      <div>
        <label className="text-xs text-muted-foreground mb-2 block">Orizont de angajament</label>
        <div className="grid grid-cols-5 gap-2">
          {[{ v: 1, l: '1 lună' }, { v: 3, l: '3 luni' }, { v: 6, l: '6 luni' }, { v: 12, l: '1 an' }, { v: 120, l: 'continuu' }].map(({ v, l }) => (
            <button
              key={v}
              onClick={() => setTimelineMonths(v)}
              className={clsx(
                'py-2 rounded-xl text-xs font-medium transition-all',
                timelineMonths === v ? 'bg-accent text-black' : 'bg-card border border-card-border text-muted-foreground'
              )}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs text-muted-foreground mb-2 block">Timp disponibil pe zi</label>
        <div className="flex gap-2">
          {[{ v: 30, l: '<30 min' }, { v: 60, l: '30-60' }, { v: 120, l: '1-2h' }, { v: 180, l: '2+h' }].map(({ v, l }) => (
            <button
              key={v}
              onClick={() => setTimeBudget(v)}
              className={clsx(
                'flex-1 py-2 rounded-xl text-xs font-medium transition-all',
                timeBudget === v ? 'bg-accent text-black' : 'bg-card border border-card-border text-muted-foreground'
              )}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs text-muted-foreground mb-2 block">Buget lunar (RON)</label>
        <div className="flex gap-2">
          {[{ v: 200, l: '<200' }, { v: 500, l: '200-500' }, { v: 1500, l: '500-1500' }, { v: 5000, l: '1500+' }].map(({ v, l }) => (
            <button
              key={v}
              onClick={() => setMonthlyBudget(v)}
              className={clsx(
                'flex-1 py-2 rounded-xl text-xs font-medium transition-all',
                monthlyBudget === v ? 'bg-accent text-black' : 'bg-card border border-card-border text-muted-foreground'
              )}
            >
              {l} RON
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs text-muted-foreground mb-2 block">Deschiderea ta experimentală</label>
        <div className="space-y-2">
          {[
            { v: 'otc_only', l: 'Doar OTC', d: 'Numai suplimente fără rețetă' },
            { v: 'open_rx', l: 'Deschis la Rx', d: 'Inclusiv discuții despre medicație cu prescripție' },
            { v: 'open_experimental', l: 'Experimental', d: 'Peptide, terapii avansate, off-label' },
          ].map(({ v, l, d }) => (
            <button
              key={v}
              onClick={() => setExperimental(v)}
              className={clsx(
                'w-full p-3 rounded-xl text-left transition-all',
                experimental === v ? 'bg-accent/10 border border-accent/50' : 'bg-card border border-card-border'
              )}
            >
              <span className={clsx('text-sm font-medium', experimental === v ? 'text-accent' : '')}>{l}</span>
              <span className="text-xs text-muted-foreground ml-2">{d}</span>
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
