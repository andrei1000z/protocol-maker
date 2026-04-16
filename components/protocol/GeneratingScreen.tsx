'use client';

import { useEffect, useState } from 'react';

const STEPS = [
  { text: 'Analyzing your profile...', duration: 1500 },
  { text: 'Classifying biomarkers against longevity ranges...', duration: 2000 },
  { text: 'Detecting patterns: metabolic, inflammatory, hormonal...', duration: 2500 },
  { text: 'Calculating estimated biological age...', duration: 1000 },
  { text: 'Consulting AI for protocol synthesis...', duration: 3000 },
  { text: 'Cross-referencing 312 interventions...', duration: 5000 },
  { text: 'Personalizing for your biomarkers, budget, and goals...', duration: 5000 },
  { text: 'Generating nutrition plan...', duration: 3000 },
  { text: 'Calculating supplement stack...', duration: 3000 },
  { text: 'Building 12-week roadmap...', duration: 2000 },
];

export function GeneratingScreen() {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const advance = (step: number) => {
      if (step < STEPS.length - 1) {
        timeout = setTimeout(() => {
          setCurrentStep(step + 1);
          advance(step + 1);
        }, STEPS[step].duration);
      }
    };
    advance(0);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <div className="min-h-dvh flex items-center justify-center px-6">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center space-y-3">
          <div className="relative mx-auto w-20 h-20">
            <div className="absolute inset-0 border-2 border-accent/20 rounded-full" />
            <div className="absolute inset-0 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <div className="absolute inset-3 border-2 border-accent/40 border-b-transparent rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
          </div>
          <h2 className="text-xl font-bold">Generating your protocol</h2>
          <p className="text-sm text-muted-foreground">This takes 30-60 seconds</p>
        </div>

        <div className="space-y-2">
          {STEPS.map((step, i) => (
            <div key={i} className={`flex items-center gap-3 py-2 px-3 rounded-xl transition-all duration-500 ${
              i < currentStep ? 'opacity-50' : i === currentStep ? 'bg-accent/5 border border-accent/20' : 'opacity-20'
            }`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] ${
                i < currentStep ? 'bg-accent text-black' : i === currentStep ? 'border-2 border-accent' : 'border border-card-border'
              }`}>
                {i < currentStep ? '✓' : ''}
              </div>
              <span className={`text-xs ${i === currentStep ? 'text-accent' : 'text-muted-foreground'}`}>{step.text}</span>
              {i === currentStep && <div className="ml-auto w-3 h-3 border border-accent border-t-transparent rounded-full animate-spin" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
