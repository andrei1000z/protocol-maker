'use client';

import { useEffect, useState } from 'react';

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
  { text: 'Comparing against Bryan Johnson\'s Blueprint...', duration: 2000 },
  { text: 'Your Protocol is ready.', duration: 2000 },
];

const FUN_FACTS = [
  'Bryan Johnson sleeps at 8:30 PM every night and wakes at 5:00 AM without an alarm.',
  'The average person has a biological age 3-8 years older than their chronological age.',
  'Walking 8,000 steps/day reduces all-cause mortality by 51% compared to 4,000 steps.',
  'hsCRP below 0.5 mg/L is associated with the lowest cardiovascular risk.',
  'Strength training 2x/week reduces all-cause mortality by 20%.',
  'Bryan Johnson takes over 100 supplements daily — we\'ll calculate which ones YOU need.',
  'The Omega-3 Index is one of the strongest modifiable predictors of heart disease.',
  'Consistent bedtime (±30 min) is as important for longevity as sleep duration.',
  'Fasting insulin is the earliest marker of metabolic dysfunction.',
  '70% of Europeans are deficient in Vitamin D.',
];

export function GeneratingScreen() {
  const [currentStep, setCurrentStep] = useState(0);
  const [fact, setFact] = useState('');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setFact(FUN_FACTS[Math.floor(Math.random() * FUN_FACTS.length)]);
    const factInterval = setInterval(() => {
      setFact(FUN_FACTS[Math.floor(Math.random() * FUN_FACTS.length)]);
    }, 8000);
    return () => clearInterval(factInterval);
  }, []);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const totalDuration = STEPS.reduce((s, step) => s + step.duration, 0);
    let elapsed = 0;
    const advance = (step: number) => {
      if (step < STEPS.length - 1) {
        timeout = setTimeout(() => {
          elapsed += STEPS[step].duration;
          setProgress(Math.round((elapsed / totalDuration) * 100));
          setCurrentStep(step + 1);
          advance(step + 1);
        }, STEPS[step].duration);
      }
    };
    advance(0);
    return () => clearTimeout(timeout);
  }, []);

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
          <p className="text-sm text-muted-foreground">This takes 30-60 seconds</p>
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="h-1.5 bg-card-border rounded-full overflow-hidden">
            <div className="h-full bg-accent rounded-full transition-all duration-1000" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex justify-between text-[10px] text-muted">
            <span>{progress}%</span>
            <span>~{Math.max(0, Math.round((100 - progress) * 0.45))}s remaining</span>
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-1.5">
          {STEPS.map((step, i) => (
            <div key={i} className={`flex items-center gap-3 py-1.5 px-3 rounded-xl transition-all duration-500 ${
              i < currentStep ? 'opacity-40' : i === currentStep ? 'bg-accent/5 border border-accent/20' : 'opacity-15'
            }`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] transition-all ${
                i < currentStep ? 'bg-accent text-black' : i === currentStep ? 'border-2 border-accent' : 'border border-card-border'
              }`}>
                {i < currentStep ? '✓' : ''}
              </div>
              <span className={`text-xs ${i === currentStep ? 'text-accent font-medium' : 'text-muted-foreground'}`}>{step.text}</span>
              {i === currentStep && <div className="ml-auto w-3 h-3 border border-accent border-t-transparent rounded-full animate-spin" />}
            </div>
          ))}
        </div>

        {/* Fun fact */}
        <div className="rounded-xl bg-card border border-card-border p-4">
          <p className="text-[10px] text-accent font-medium mb-1">💡 Did you know?</p>
          <p className="text-xs text-muted-foreground leading-relaxed transition-all duration-500">{fact}</p>
        </div>
      </div>
    </div>
  );
}
