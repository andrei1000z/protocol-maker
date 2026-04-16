'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { GOALS } from '@/lib/constants';
import { UserProfile } from '@/lib/types';
import { calculateBMI, getBMICategory } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Sparkles, Loader2 } from 'lucide-react';
import clsx from 'clsx';

const FITNESS_LEVELS = [
  { value: 'beginner', label: 'Începător', desc: 'Abia încep sau reîncep' },
  { value: 'intermediate', label: 'Intermediar', desc: 'Antrenament regulat 3-4x/săpt' },
  { value: 'advanced', label: 'Avansat', desc: 'Antrenament zilnic, experiență' },
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<'M' | 'F'>('M');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [goals, setGoals] = useState<string[]>([]);
  const [fitnessLevel, setFitnessLevel] = useState<string>('');

  const toggleGoal = (goal: string) => {
    setGoals((prev) => (prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]));
  };

  const canNext = () => {
    switch (step) {
      case 0: return name.trim().length >= 2;
      case 1: return age && parseInt(age) >= 10 && parseInt(age) <= 100;
      case 2: return height && weight && parseFloat(height) > 100 && parseFloat(weight) > 30;
      case 3: return goals.length > 0;
      case 4: return fitnessLevel !== '';
      default: return false;
    }
  };

  const handleFinish = async () => {
    setLoading(true);
    setError('');

    const profileData = {
      name: name.trim(),
      age: parseInt(age),
      sex,
      height: parseFloat(height),
      weight: parseFloat(weight),
      goals,
      fitnessLevel,
    };

    try {
      // Step 1: Generate protocol with AI
      const res = await fetch('/api/generate-protocol', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData),
      });

      if (!res.ok) throw new Error('AI API error: ' + res.status);
      const protocol = await res.json();

      // Step 2: Save everything server-side (avoids RLS issues)
      const profile: UserProfile = {
        ...profileData,
        fitnessLevel: profileData.fitnessLevel as UserProfile['fitnessLevel'],
        macroTargets: protocol.macroTargets,
        onboardingCompleted: true,
      };

      const config = {
        tasks: protocol.dailyTasks,
        supplements: protocol.supplements.map((s: { name: string }) => s.name),
      };

      const saveRes = await fetch('/api/save-onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile, protocol, config }),
      });

      if (!saveRes.ok) {
        const err = await saveRes.json();
        throw new Error(err.details || err.error || 'Save failed');
      }

      window.location.href = '/';
    } catch (err) {
      console.error('Onboarding error:', err);
      setError(err instanceof Error ? err.message : 'Eroare la generarea protocolului. Încearcă din nou.');
      setLoading(false);
    }
  };

  const bmi = height && weight ? calculateBMI(parseFloat(weight), parseFloat(height)) : 0;

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      {/* Progress */}
      <div className="px-6 pt-8 pb-4">
        <div className="flex gap-1.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={clsx(
                'h-1 flex-1 rounded-full transition-all',
                i <= step ? 'bg-primary' : 'bg-card-border'
              )}
            />
          ))}
        </div>
        <p className="text-xs text-muted mt-2">Pas {step + 1} din 5</p>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 pb-6">
        {step === 0 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold">Bine ai venit!</h1>
              <p className="text-muted-foreground mt-1">Cum te numești?</p>
            </div>
            <Input
              label="Numele tău"
              value={name}
              onChange={setName}
              placeholder="ex: Andrei"
            />
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold">Despre tine</h1>
              <p className="text-muted-foreground mt-1">Vârstă și sex</p>
            </div>
            <Input
              label="Vârstă"
              type="number"
              value={age}
              onChange={setAge}
              placeholder="ex: 25"
              min={10}
              max={100}
            />
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">Sex</label>
              <div className="flex gap-3">
                {(['M', 'F'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSex(s)}
                    className={clsx(
                      'flex-1 py-3 rounded-xl font-medium transition-all active:scale-95',
                      sex === s
                        ? 'bg-primary text-white'
                        : 'bg-card border border-card-border text-muted-foreground'
                    )}
                  >
                    {s === 'M' ? 'Masculin' : 'Feminin'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold">Măsurători</h1>
              <p className="text-muted-foreground mt-1">Înălțime și greutate</p>
            </div>
            <Input
              label="Înălțime (cm)"
              type="number"
              value={height}
              onChange={setHeight}
              placeholder="ex: 180"
              min={100}
              max={250}
            />
            <Input
              label="Greutate (kg)"
              type="number"
              value={weight}
              onChange={setWeight}
              placeholder="ex: 80"
              min={30}
              max={300}
            />
            {bmi > 0 && (
              <Card className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">BMI</p>
                  <p className="text-lg font-bold">{bmi}</p>
                </div>
                <span className={clsx(
                  'text-sm font-medium px-3 py-1 rounded-full',
                  bmi < 18.5 ? 'bg-blue-500/20 text-blue-400' :
                  bmi < 25 ? 'bg-emerald-500/20 text-emerald-400' :
                  bmi < 30 ? 'bg-amber-500/20 text-amber-400' :
                  'bg-red-500/20 text-red-400'
                )}>
                  {getBMICategory(bmi)}
                </span>
              </Card>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold">Obiective</h1>
              <p className="text-muted-foreground mt-1">Ce vrei să atingi? (alege cel puțin 1)</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {GOALS.map((goal) => (
                <button
                  key={goal}
                  onClick={() => toggleGoal(goal)}
                  className={clsx(
                    'p-3 rounded-xl text-sm font-medium text-left transition-all active:scale-95',
                    goals.includes(goal)
                      ? 'bg-primary/20 text-primary border border-primary/50'
                      : 'bg-card border border-card-border text-muted-foreground'
                  )}
                >
                  {goal}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold">Nivel fitness</h1>
              <p className="text-muted-foreground mt-1">Unde te situezi acum?</p>
            </div>
            <div className="space-y-3">
              {FITNESS_LEVELS.map(({ value, label, desc }) => (
                <button
                  key={value}
                  onClick={() => setFitnessLevel(value)}
                  className={clsx(
                    'w-full p-4 rounded-xl text-left transition-all active:scale-[0.98]',
                    fitnessLevel === value
                      ? 'bg-primary/20 border border-primary/50'
                      : 'bg-card border border-card-border'
                  )}
                >
                  <p className={clsx('font-medium', fitnessLevel === value ? 'text-primary' : 'text-foreground')}>
                    {label}
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">{desc}</p>
                </button>
              ))}
            </div>

            {error && (
              <p className="text-sm text-danger">{error}</p>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="px-6 pb-8 flex gap-3">
        {step > 0 && (
          <Button variant="secondary" onClick={() => setStep(step - 1)} className="flex items-center gap-1">
            <ChevronLeft className="w-4 h-4" /> Înapoi
          </Button>
        )}
        <div className="flex-1">
          {step < 4 ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={!canNext()}
              className="w-full flex items-center justify-center gap-1"
            >
              Continuă <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={handleFinish}
              disabled={!canNext() || loading}
              className="w-full flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Generez protocolul...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" /> Generează Protocol AI
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
