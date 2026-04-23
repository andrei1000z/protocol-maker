'use client';

// Full-screen loader for protocol generation.
//
// The AI call takes anywhere from 3s (Groq fallback, small profile) to 60s
// (Claude on a full profile + wearable 7-day aggregate). A purely time-based
// progress bar would desync hard in both directions — slow on fast responses
// ("stuck at 20% then suddenly done") and stuck at 100% on slow ones.
//
// Fix: two modes.
//   - While the server is still working (`completed === false`), advance
//     through the step list on the fixed per-step durations BUT cap the max
//     step at STEPS.length - 2 so the final "Your Protocol is ready." step
//     never fires until the server actually confirms.
//   - Once the parent flips `completed` to true, fast-forward through any
//     remaining steps in ~800ms with a quick polish, land on the final step,
//     hold for ~600ms so the user reads "Your Protocol is ready.", then fire
//     `onDone`.

import { useEffect, useRef, useState } from 'react';

const STEPS = [
  { text: 'Analyzing your profile...', duration: 1500 },
  { text: 'Classifying biomarkers against longevity-optimal ranges...', duration: 2000 },
  { text: 'Detecting patterns: metabolic, inflammatory, hormonal...', duration: 2500 },
  { text: 'Calculating estimated biological age...', duration: 1500 },
  { text: 'Consulting AI for deep protocol synthesis...', duration: 4000 },
  { text: 'Cross-referencing 312 longevity interventions...', duration: 5000 },
  { text: 'Personalizing for your biomarkers, budget, and goals...', duration: 4000 },
  { text: 'Generating nutrition plan with macro targets...', duration: 3000 },
  { text: 'Calculating supplement stack and costs...', duration: 3000 },
  { text: 'Building your 12-week roadmap...', duration: 2000 },
  { text: "Comparing against Bryan Johnson's Blueprint...", duration: 2000 },
  { text: 'Your Protocol is ready.', duration: 2000 },
];

const FUN_FACTS = [
  'Bryan Johnson sleeps at 8:30 PM every night and wakes at 5:00 AM without an alarm.',
  'The average person has a biological age 3-8 years older than their chronological age.',
  'Walking 8,000 steps/day reduces all-cause mortality by 51% compared to 4,000 steps.',
  'hsCRP below 0.5 mg/L is associated with the lowest cardiovascular risk.',
  'Strength training 2x/week reduces all-cause mortality by 20%.',
  "Bryan Johnson takes over 100 supplements daily — we'll calculate which ones YOU need.",
  'The Omega-3 Index is one of the strongest modifiable predictors of heart disease.',
  'Consistent bedtime (±30 min) is as important for longevity as sleep duration.',
  'Fasting insulin is the earliest marker of metabolic dysfunction.',
  '70% of Europeans are deficient in Vitamin D.',
];

export interface GeneratingScreenProps {
  /** True once the server has confirmed the protocol is saved. Flipping this
   *  to true triggers the fast-forward animation. Leave undefined / false
   *  while the network request is in flight. */
  completed?: boolean;
  /** Fired once the fast-forward finishes and the final "ready" step has
   *  been held long enough for the user to read it. The parent should
   *  navigate to the dashboard here. */
  onDone?: () => void;
}

// Hard cap during the waiting phase — never cross into the last step until
// the server flips `completed`. This is what stops the UI from saying
// "Your Protocol is ready." while the POST is still in flight.
const PENULTIMATE = STEPS.length - 2;
const FAST_FORWARD_MS = 800;
const READY_HOLD_MS = 600;

export function GeneratingScreen({ completed = false, onDone }: GeneratingScreenProps = {}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [fact, setFact] = useState('');
  const [progress, setProgress] = useState(0);
  const [fastForwarding, setFastForwarding] = useState(false);
  // Track whether we've already fired onDone so double-flips don't call it twice.
  const doneFiredRef = useRef(false);

  useEffect(() => {
    setFact(FUN_FACTS[Math.floor(Math.random() * FUN_FACTS.length)]);
    const factInterval = setInterval(() => {
      setFact(FUN_FACTS[Math.floor(Math.random() * FUN_FACTS.length)]);
    }, 8000);
    return () => clearInterval(factInterval);
  }, []);

  // Waiting-phase timer. Walks through the step list on per-step durations,
  // but stops at the penultimate step until the server confirms. If
  // `completed` is already true on mount, skip this and go straight to
  // fast-forward.
  useEffect(() => {
    if (completed) return;
    let timeout: ReturnType<typeof setTimeout>;
    const totalDuration = STEPS.reduce((s, step) => s + step.duration, 0);
    let elapsed = 0;
    const advance = (step: number) => {
      if (step >= PENULTIMATE) return;   // hold at penultimate
      timeout = setTimeout(() => {
        elapsed += STEPS[step].duration;
        setProgress(Math.round((elapsed / totalDuration) * 100));
        setCurrentStep(step + 1);
        advance(step + 1);
      }, STEPS[step].duration);
    };
    advance(0);
    return () => clearTimeout(timeout);
  }, [completed]);

  // Fast-forward + finish when completed flips true. Each remaining step
  // gets an equal slice of FAST_FORWARD_MS so the user sees the checkmarks
  // cascade instead of a single snap-to-done.
  useEffect(() => {
    if (!completed) return;
    const remaining = STEPS.length - 1 - currentStep;
    const sliceMs = remaining > 0 ? Math.floor(FAST_FORWARD_MS / remaining) : 0;
    setFastForwarding(true);

    const timeouts: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i <= remaining; i++) {
      timeouts.push(setTimeout(() => {
        setCurrentStep(prev => Math.max(prev, currentStep + i));
        setProgress(Math.round(((currentStep + i) / (STEPS.length - 1)) * 100));
      }, sliceMs * i));
    }
    // Hold on the final step, then fire onDone.
    timeouts.push(setTimeout(() => {
      setProgress(100);
      if (!doneFiredRef.current) {
        doneFiredRef.current = true;
        onDone?.();
      }
    }, FAST_FORWARD_MS + READY_HOLD_MS));

    return () => timeouts.forEach(clearTimeout);
    // We intentionally exclude `currentStep` from deps — the fast-forward
    // should run exactly once per completed-flip, not restart each step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completed, onDone]);

  const remainingSec = fastForwarding ? 0 : Math.max(0, Math.round((100 - progress) * 0.45));

  return (
    <div className="min-h-dvh flex items-center justify-center px-6 bg-background">
      <div className="max-w-md w-full space-y-8">
        {/* DNA Animation */}
        <div className="flex justify-center">
          <div className="relative w-24 h-24">
            <div className="absolute inset-0 border-2 border-accent/10 rounded-full" />
            <div className="absolute inset-0 border-2 border-accent border-t-transparent rounded-full animate-spin" style={{ animationDuration: '2s' }} />
            <div className="absolute inset-2 border-2 border-accent/40 border-b-transparent rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '3s' }} />
            <div className="absolute inset-4 border-2 border-accent/20 border-t-transparent rounded-full animate-spin" style={{ animationDuration: '4s' }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl">🧬</span>
            </div>
          </div>
        </div>

        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold">Generating your protocol</h2>
          <p className="text-sm text-muted-foreground">
            {fastForwarding ? 'Finalizing…' : 'This takes 30-60 seconds'}
          </p>
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="h-1.5 bg-card-border rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all"
              style={{
                width: `${progress}%`,
                transitionDuration: fastForwarding ? '400ms' : '1000ms',
                transitionTimingFunction: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted">
            <span>{progress}%</span>
            {remainingSec > 0 && <span>~{remainingSec}s remaining</span>}
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-1.5">
          {STEPS.map((step, i) => (
            <div key={i} className={`flex items-center gap-3 py-1.5 px-3 rounded-xl transition-all duration-500 ${
              i < currentStep ? 'opacity-40' : i === currentStep ? 'bg-accent/5 border border-accent/20' : 'opacity-15'
            }`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-xs transition-all ${
                i < currentStep ? 'bg-accent text-black' : i === currentStep ? 'border-2 border-accent' : 'border border-card-border'
              }`}>
                {i < currentStep ? '✓' : ''}
              </div>
              <span className={`text-xs ${i === currentStep ? 'text-accent font-medium' : 'text-muted-foreground'}`}>{step.text}</span>
              {i === currentStep && !fastForwarding && <div className="ml-auto w-3 h-3 border border-accent border-t-transparent rounded-full animate-spin" />}
            </div>
          ))}
        </div>

        {/* Fun fact */}
        <div className="rounded-xl bg-card border border-card-border p-4">
          <p className="text-xs text-accent font-medium mb-1">💡 Did you know?</p>
          <p className="text-xs text-muted-foreground leading-relaxed transition-all duration-500">{fact}</p>
        </div>
      </div>
    </div>
  );
}
