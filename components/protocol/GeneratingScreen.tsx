'use client';

import { useEffect, useState } from 'react';

const STEPS = [
  { text: 'Analizez profilul tău...', duration: 1500 },
  { text: 'Clasificarea biomarkerilor vs range-uri longevitate...', duration: 2000 },
  { text: 'Detectez pattern-uri: metabolic, inflamator, hormonal...', duration: 2500 },
  { text: 'Calculez vârsta biologică estimată...', duration: 1000 },
  { text: 'Consult AI pentru sinteză protocol...', duration: 3000 },
  { text: 'Cross-referencing 312 intervenții...', duration: 5000 },
  { text: 'Personalizez pentru biomarkerii, bugetul și obiectivele tale...', duration: 5000 },
  { text: 'Generez planul nutrițional...', duration: 3000 },
  { text: 'Calculez stack-ul de suplimente...', duration: 3000 },
  { text: 'Construiesc roadmap-ul pe 12 săptămâni...', duration: 2000 },
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
          <h2 className="text-xl font-bold">Generez protocolul tău</h2>
          <p className="text-sm text-muted-foreground">Acest proces durează 30-60 secunde</p>
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
