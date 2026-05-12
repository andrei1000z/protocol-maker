'use client';

// Onboarding step 4 — day-to-day schedule + gym access + screen time + pain
// points. State stays in the parent; setters arrive as named props.

import clsx from 'clsx';

export type ScheduleType = 'school' | 'work' | 'both' | 'freelance' | 'none';
export type WorkLocation = 'home' | 'office' | 'hybrid';
export type GymAccess = 'full_gym' | 'home_gym' | 'minimal' | 'none';
export type ExerciseWindow = 'morning' | 'lunch' | 'evening' | 'weekends' | 'inconsistent';

export interface Step4ScheduleProps {
  scheduleType: ScheduleType;
  setScheduleType: (v: ScheduleType) => void;
  workStart: string;
  setWorkStart: (v: string) => void;
  workEnd: string;
  setWorkEnd: (v: string) => void;
  workLocation: WorkLocation;
  setWorkLocation: (v: WorkLocation) => void;
  activeDays: string[];
  setActiveDays: React.Dispatch<React.SetStateAction<string[]>>;
  gymAccess: GymAccess;
  setGymAccess: (v: GymAccess) => void;
  gymEquipment: string[];
  setGymEquipment: React.Dispatch<React.SetStateAction<string[]>>;
  sittingHours: number;
  setSittingHours: (v: number) => void;
  exerciseWindow: ExerciseWindow;
  setExerciseWindow: (v: ExerciseWindow) => void;
  screenTime: number;
  setScreenTime: (v: number) => void;
  painPoints: string;
  setPainPoints: (v: string) => void;
  nonNegotiables: string;
  setNonNegotiables: (v: string) => void;
}

const DAYS = ['Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm', 'Dum'];

export function Step4Schedule(p: Step4ScheduleProps) {
  const isSchool = p.scheduleType === 'school';
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Programul tău</h1>
        <p className="text-muted-foreground text-sm mt-1">Ne ajută să construim un protocol care se potrivește vieții tale reale.</p>
      </div>

      <div>
        <label className="text-xs text-muted-foreground mb-2 block">Cum arată ziua ta de lucru?</label>
        <div className="grid grid-cols-5 gap-2">
          {([
            { v: 'school',    l: '🎓 Școală' },
            { v: 'work',      l: '💼 Muncă' },
            { v: 'both',      l: 'Ambele' },
            { v: 'freelance', l: 'Freelance' },
            { v: 'none',      l: 'Niciuna' },
          ] as const).map(({ v, l }) => (
            <button
              key={v}
              onClick={() => p.setScheduleType(v)}
              className={clsx('py-2 rounded-xl text-xs font-medium transition-all',
                p.scheduleType === v ? 'bg-accent text-black' : 'bg-card border border-card-border text-muted-foreground')}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {p.scheduleType !== 'none' && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">{isSchool ? 'Școala' : 'Munca'} începe</label>
              <input
                type="time"
                value={p.workStart}
                onChange={e => p.setWorkStart(e.target.value)}
                className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{isSchool ? 'Școala' : 'Munca'} se termină</label>
              <input
                type="time"
                value={p.workEnd}
                onChange={e => p.setWorkEnd(e.target.value)}
                className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-2 block">
              Zile active (apasă zilele când ai {isSchool ? 'școală' : 'muncă'})
            </label>
            <div className="grid grid-cols-7 gap-1.5">
              {DAYS.map(d => {
                const on = p.activeDays.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => p.setActiveDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])}
                    className={clsx('py-2 rounded-xl text-xs font-medium transition-all',
                      on ? 'bg-accent text-black' : 'bg-card border border-card-border text-muted-foreground hover:border-accent/30')}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted mt-1.5">
              {p.activeDays.length === 7
                ? 'Toată săptămâna'
                : p.activeDays.length === 0
                  ? 'Nicio zi activă — complet liber'
                  : `Libere: ${DAYS.filter(d => !p.activeDays.includes(d)).join(', ')}`}
            </p>
          </div>

          {p.scheduleType !== 'school' && (
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Locație muncă</label>
              <div className="flex gap-2">
                {(['home', 'office', 'hybrid'] as const).map(v => (
                  <button
                    key={v}
                    onClick={() => p.setWorkLocation(v)}
                    className={clsx('flex-1 py-2 rounded-xl text-xs font-medium capitalize transition-all',
                      p.workLocation === v ? 'bg-accent text-black' : 'bg-card border border-card-border text-muted-foreground')}
                  >
                    {v === 'home' ? 'acasă' : v === 'office' ? 'birou' : 'hibrid'}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div>
        <label className="text-xs text-muted-foreground mb-2 block">Ai acces la sală?</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {([
            { v: 'full_gym',  l: '🏋️ Sală completă', d: 'Bare, racuri, aparate' },
            { v: 'home_gym',  l: '🏠 Sală acasă',    d: 'Greutăți, benzi' },
            { v: 'minimal',   l: '🤸 Doar calistenie', d: 'Greutate corp + benzi' },
            { v: 'none',      l: 'Niciuna',          d: 'Mers + greutate corp' },
          ] as const).map(({ v, l, d }) => (
            <button
              key={v}
              onClick={() => p.setGymAccess(v)}
              className={clsx('py-3 px-3 rounded-xl text-xs font-medium transition-all text-left',
                p.gymAccess === v ? 'bg-accent/10 border border-accent/50 text-accent' : 'bg-card border border-card-border text-muted-foreground hover:border-accent/30')}
            >
              <p className="font-semibold">{l}</p>
              <p className="text-xs text-muted mt-0.5 normal-case">{d}</p>
            </button>
          ))}
        </div>
        {(p.gymAccess === 'home_gym' || p.gymAccess === 'minimal') && (
          <div className="mt-2">
            <p className="text-xs text-muted-foreground mb-1.5">Ce echipament ai?</p>
            <div className="flex flex-wrap gap-1.5">
              {['gantere', 'bară haltere', 'kettlebell', 'bară tracțiuni', 'benzi elastice', 'bancă', 'bicicletă/bandă', 'TRX/inele'].map(e => {
                const on = p.gymEquipment.includes(e);
                return (
                  <button
                    key={e}
                    type="button"
                    onClick={() => p.setGymEquipment(prev => prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e])}
                    className={clsx('px-3 py-1 rounded-lg text-xs capitalize transition-all',
                      on ? 'bg-accent/15 text-accent border border-accent/30' : 'bg-card border border-card-border text-muted-foreground hover:border-accent/30')}
                  >
                    {e}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Ore de șezut/zi: <span className="text-accent">{p.sittingHours}</span></label>
          <input
            type="range" min={0} max={16}
            value={p.sittingHours}
            onChange={e => p.setSittingHours(parseInt(e.target.value))}
            className="w-full mt-2 h-2 bg-card-border rounded-lg appearance-none cursor-pointer accent-[#34d399]"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Timp pe ecran/zi: <span className="text-accent">{p.screenTime}h</span></label>
          <input
            type="range" min={1} max={16}
            value={p.screenTime}
            onChange={e => p.setScreenTime(parseInt(e.target.value))}
            className="w-full mt-2 h-2 bg-card-border rounded-lg appearance-none cursor-pointer accent-[#34d399]"
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-muted-foreground mb-2 block">Cel mai bun moment pentru exerciții</label>
        <div className="grid grid-cols-5 gap-2">
          {(['morning', 'lunch', 'evening', 'weekends', 'inconsistent'] as const).map(v => (
            <button
              key={v}
              onClick={() => p.setExerciseWindow(v)}
              className={clsx('py-2 rounded-xl text-xs font-medium capitalize transition-all',
                p.exerciseWindow === v ? 'bg-accent text-black' : 'bg-card border border-card-border text-muted-foreground')}
            >
              {v === 'morning' ? 'dimineața' : v === 'lunch' ? 'prânz' : v === 'evening' ? 'seara' : v === 'weekends' ? 'weekend' : 'inconsistent'}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Probleme principale (ce te deranjează cel mai mult?)</label>
        <textarea
          value={p.painPoints}
          onChange={e => p.setPainPoints(e.target.value)}
          rows={3}
          placeholder="ex: cădere de energie la 2 după-amiaza, ceață mentală în ședințe, rigiditate lombară, nu pot adormi..."
          className="w-full rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent resize-none"
        />
      </div>

      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Non-negociabile (la ce NU renunți)</label>
        <textarea
          value={p.nonNegotiables}
          onChange={e => p.setNonNegotiables(e.target.value)}
          rows={2}
          placeholder="ex: pizza de vineri, cafeaua de dimineață, băutură în weekend..."
          className="w-full rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent resize-none"
        />
      </div>
    </div>
  );
}
