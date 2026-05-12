'use client';

// Onboarding step 3 — lifestyle deep dive: 7 collapsible panels (sleep,
// diet+substances, exercise, mental, medical, environment, social).
// ~100 state fields threaded as props so the parent's state machine
// (autosave, restore, validate) stays untouched.

import clsx from 'clsx';
import { CollapseSection } from './CollapseSection';
import { CONDITIONS, FAMILY_CONDITIONS, SLEEP_ISSUES } from '@/lib/engine/onboarding-options';
import { Plus, X } from 'lucide-react';

type Chronotype = 'morning' | 'neutral' | 'night';
type MeditationPractice = 'none' | 'occasional' | 'daily';
type SmokingType = 'cigarettes' | 'vape' | 'both' | '';
type LifestyleExpanded = {
  sleep: boolean; diet: boolean; exercise: boolean; mental: boolean;
  medical: boolean; environment: boolean; social: boolean;
};
interface Medication { name: string; dose: string; frequency: string; }

export interface Step3LifestyleProps {
  // Panel toggles
  lifestyleExpanded: LifestyleExpanded;
  setLifestyleExpanded: React.Dispatch<React.SetStateAction<LifestyleExpanded>>;

  // From step 1, used for "Last 3 nights" display
  wearable: string;
  // From step 1, used for sex-specific medical questions
  sex: 'male' | 'female' | 'intersex';

  // Helper passed from parent (toggles a string[] state)
  toggle: <T,>(setter: (f: (p: T[]) => T[]) => void, item: T) => void;

  // Sleep
  sleepHours: string; setSleepHours: (v: string) => void;
  sleepQuality: number; setSleepQuality: (v: number) => void;
  bedtime: string; setBedtime: (v: string) => void;
  wakeTime: string; setWakeTime: (v: string) => void;
  idealBedtime: string; setIdealBedtime: (v: string) => void;
  idealWakeTime: string; setIdealWakeTime: (v: string) => void;
  lastNight1Hours: string; setLastNight1Hours: (v: string) => void;
  lastNight1Score: string; setLastNight1Score: (v: string) => void;
  lastNight2Hours: string; setLastNight2Hours: (v: string) => void;
  lastNight2Score: string; setLastNight2Score: (v: string) => void;
  lastNight3Hours: string; setLastNight3Hours: (v: string) => void;
  lastNight3Score: string; setLastNight3Score: (v: string) => void;
  chronotype: Chronotype; setChronotype: (v: Chronotype) => void;
  timeToFallAsleep: string; setTimeToFallAsleep: (v: string) => void;
  wakeUpsPerNight: string; setWakeUpsPerNight: (v: string) => void;
  napsDaily: string; setNapsDaily: (v: string) => void;
  bedroomTemp: string; setBedroomTemp: (v: string) => void;
  sleepApneaChecked: string; setSleepApneaChecked: (v: string) => void;
  phoneInBedroom: boolean; setPhoneInBedroom: (v: boolean) => void;
  sleepIssues: string[]; setSleepIssues: React.Dispatch<React.SetStateAction<string[]>>;
  sleepIssuesCustom: string; setSleepIssuesCustom: (v: string) => void;

  // Diet + substances
  dietType: string; setDietType: (v: string) => void;
  dietTypeCustom: string; setDietTypeCustom: (v: string) => void;
  mealsPerDay: number; setMealsPerDay: (v: number) => void;
  hydration: number; setHydration: (v: number) => void;
  firstMealTime: string; setFirstMealTime: (v: string) => void;
  lastMealTime: string; setLastMealTime: (v: string) => void;
  typicalDay: string; setTypicalDay: (v: string) => void;
  cooksAtHome: number; setCooksAtHome: (v: number) => void;
  fruitsPerDay: string; setFruitsPerDay: (v: string) => void;
  veggiesPerDay: string; setVeggiesPerDay: (v: string) => void;
  fishPerWeek: string; setFishPerWeek: (v: string) => void;
  redMeatPerWeek: string; setRedMeatPerWeek: (v: string) => void;
  ultraProcessedPerWeek: string; setUltraProcessedPerWeek: (v: string) => void;
  fastFoodPerWeek: string; setFastFoodPerWeek: (v: string) => void;
  foodAllergies: string[]; setFoodAllergies: React.Dispatch<React.SetStateAction<string[]>>;
  foodAllergiesCustom: string; setFoodAllergiesCustom: (v: string) => void;
  alcoholPerWeek: number; setAlcoholPerWeek: (v: number) => void;
  caffeineServings: number; setCaffeineServings: (v: number) => void;
  coffeeCutoffTime: string; setCoffeeCutoffTime: (v: string) => void;
  triedIF: boolean; setTriedIF: (v: boolean) => void;
  ifWindow: string; setIfWindow: (v: string) => void;
  smoker: boolean; setSmoker: (v: boolean) => void;
  smokingType: SmokingType; setSmokingType: (v: SmokingType) => void;
  cigarettesPerDay: string; setCigarettesPerDay: (v: string) => void;
  vapePuffsPerDay: string; setVapePuffsPerDay: (v: string) => void;
  recreationalDrugs: string; setRecreationalDrugs: (v: string) => void;

  // Exercise
  cardioMin: number; setCardioMin: (v: number) => void;
  strengthSessions: number; setStrengthSessions: (v: number) => void;
  stepsPerDay: string; setStepsPerDay: (v: string) => void;
  fitnessLevel: number; setFitnessLevel: (v: number) => void;
  exercisesDone: string[]; setExercisesDone: React.Dispatch<React.SetStateAction<string[]>>;
  maxPullups: string; setMaxPullups: (v: string) => void;
  squatWeight: string; setSquatWeight: (v: string) => void;
  benchWeight: string; setBenchWeight: (v: string) => void;
  deadliftWeight: string; setDeadliftWeight: (v: string) => void;
  yogaPilates: boolean; setYogaPilates: (v: boolean) => void;
  sauna: boolean; setSauna: (v: boolean) => void;
  iceBath: boolean; setIceBath: (v: boolean) => void;
  injuries: string; setInjuries: (v: string) => void;
  chronicPain: string; setChronicPain: (v: string) => void;

  // Mental
  stressLevel: number; setStressLevel: (v: number) => void;
  happinessScore: number; setHappinessScore: (v: number) => void;
  lifeSenseOfPurpose: number; setLifeSenseOfPurpose: (v: number) => void;
  meditationPractice: MeditationPractice; setMeditationPractice: (v: MeditationPractice) => void;
  depressionSymptoms: boolean; setDepressionSymptoms: (v: boolean) => void;
  anxietySymptoms: boolean; setAnxietySymptoms: (v: boolean) => void;
  therapyNow: boolean; setTherapyNow: (v: boolean) => void;
  psychMeds: string; setPsychMeds: (v: string) => void;
  topStressors: string; setTopStressors: (v: string) => void;
  flowActivities: string; setFlowActivities: (v: string) => void;
  screenTimeDaily: string; setScreenTimeDaily: (v: string) => void;
  socialMediaDaily: string; setSocialMediaDaily: (v: string) => void;

  // Medical
  conditions: string[]; setConditions: React.Dispatch<React.SetStateAction<string[]>>;
  familyHistory: string[]; setFamilyHistory: React.Dispatch<React.SetStateAction<string[]>>;
  medications: Medication[];
  addMedication: () => void;
  removeMed: (idx: number) => void;
  updateMed: (idx: number, key: keyof Medication, value: string) => void;
  supplements: string; setSupplements: (v: string) => void;
  surgeries: string; setSurgeries: (v: string) => void;
  lastBloodTestDate: string; setLastBloodTestDate: (v: string) => void;
  lastPhysicalDate: string; setLastPhysicalDate: (v: string) => void;
  hadCovid: boolean; setHadCovid: (v: boolean) => void;
  covidCount: string; setCovidCount: (v: string) => void;
  longCovid: boolean; setLongCovid: (v: boolean) => void;
  antibioticsLastYear: string; setAntibioticsLastYear: (v: string) => void;
  vaccinesUpToDate: string; setVaccinesUpToDate: (v: string) => void;
  libidoScore: number; setLibidoScore: (v: number) => void;
  morningErection: string; setMorningErection: (v: string) => void;
  menstrualRegular: string; setMenstrualRegular: (v: string) => void;
  pmsSeverity: number; setPmsSeverity: (v: number) => void;
  menopauseStatus: string; setMenopauseStatus: (v: string) => void;
  hormonalContraception: boolean; setHormonalContraception: (v: boolean) => void;
  hadChildren: string; setHadChildren: (v: string) => void;
  flossDaily: boolean; setFlossDaily: (v: boolean) => void;
  spfDaily: boolean; setSpfDaily: (v: boolean) => void;
  redFlagsAcute: string[]; setRedFlagsAcute: React.Dispatch<React.SetStateAction<string[]>>;

  // Environment
  housingType: string; setHousingType: (v: string) => void;
  pollutionLevel: string; setPollutionLevel: (v: string) => void;
  moldAtHome: boolean; setMoldAtHome: (v: boolean) => void;
  airPurifier: boolean; setAirPurifier: (v: boolean) => void;
  teflonNonstick: boolean; setTeflonNonstick: (v: boolean) => void;
  waterFilter: string; setWaterFilter: (v: string) => void;
  plasticFoodContact: string; setPlasticFoodContact: (v: string) => void;
  sunlightMinutes: string; setSunlightMinutes: (v: string) => void;

  // Social
  relationshipStatus: string; setRelationshipStatus: (v: string) => void;
  relationshipSatisfaction: number; setRelationshipSatisfaction: (v: number) => void;
  closeFriendsCount: string; setCloseFriendsCount: (v: string) => void;
  lonelinessLevel: number; setLonelinessLevel: (v: number) => void;
  pet: boolean; setPet: (v: boolean) => void;
  hasCommunity: boolean; setHasCommunity: (v: boolean) => void;
}

export function Step3Lifestyle(props: Step3LifestyleProps) {
  const p = props;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Stilul tău de viață</h1>
        <p className="text-muted-foreground text-sm mt-1">~90 secunde. Modelează protocolul la fel de mult ca analizele.</p>
      </div>

      {/* Sleep */}
      <CollapseSection title="😴 Somn" expanded={p.lifestyleExpanded.sleep} onToggle={() => p.setLifestyleExpanded(prev => ({ ...prev, sleep: !prev.sleep }))}>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-muted-foreground">Ore/noapte (medie)</label><input type="number" value={p.sleepHours} onChange={e => p.setSleepHours(e.target.value)} step="0.5" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
          <div>
            <label className="text-xs text-muted-foreground">Calitate (1-10)</label>
            <div className="flex gap-1 mt-1">
              {[...Array(10)].map((_, i) => (
                <button key={i} onClick={() => p.setSleepQuality(i + 1)} className={clsx('flex-1 h-9 rounded-lg text-xs font-mono transition-all', p.sleepQuality === i + 1 ? 'bg-accent text-black' : i + 1 <= p.sleepQuality ? 'bg-accent/20 text-accent' : 'bg-card border border-card-border text-muted')}>{i + 1}</button>
              ))}
            </div>
          </div>
          <div><label className="text-xs text-muted-foreground">Ora de culcare obișnuită</label><input type="time" value={p.bedtime} onChange={e => p.setBedtime(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
          <div><label className="text-xs text-muted-foreground">Ora de trezire obișnuită</label><input type="time" value={p.wakeTime} onChange={e => p.setWakeTime(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
          <div><label className="text-xs text-muted-foreground">Ora ideală de culcare</label><input type="time" value={p.idealBedtime} onChange={e => p.setIdealBedtime(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
          <div><label className="text-xs text-muted-foreground">Ora ideală de trezire</label><input type="time" value={p.idealWakeTime} onChange={e => p.setIdealWakeTime(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
        </div>

        {p.wearable && p.wearable !== 'none' && (
          <div>
            <p className="text-xs text-accent uppercase tracking-wider mt-2">Ultimele 3 nopți (de pe {p.wearable})</p>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {[
                { label: 'Aseară', h: p.lastNight1Hours, sH: p.setLastNight1Hours, sc: p.lastNight1Score, sSc: p.setLastNight1Score },
                { label: '2 nopți în urmă', h: p.lastNight2Hours, sH: p.setLastNight2Hours, sc: p.lastNight2Score, sSc: p.setLastNight2Score },
                { label: '3 nopți în urmă', h: p.lastNight3Hours, sH: p.setLastNight3Hours, sc: p.lastNight3Score, sSc: p.setLastNight3Score },
              ].map(n => (
                <div key={n.label} className="space-y-1">
                  <p className="text-xs text-muted">{n.label}</p>
                  <input type="number" step="0.1" value={n.h} onChange={e => n.sH(e.target.value)} placeholder="ore" className="w-full rounded-lg bg-card border border-card-border px-2 py-1.5 text-xs outline-none focus:border-accent font-mono" />
                  <input type="number" value={n.sc} onChange={e => n.sSc(e.target.value)} placeholder="scor 0-100" className="w-full rounded-lg bg-card border border-card-border px-2 py-1.5 text-xs outline-none focus:border-accent font-mono" />
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="text-xs text-muted-foreground mb-2 block">Cronotip</label>
          <div className="flex gap-2">
            {([{ v: 'morning', l: '🌅 Persoană de dimineață' }, { v: 'neutral', l: '😐 Neutru' }, { v: 'night', l: '🌙 Bufniță de noapte' }] as const).map(({ v, l }) => (
              <button key={v} onClick={() => p.setChronotype(v)} className={clsx('flex-1 py-2 rounded-xl text-xs font-medium transition-all', p.chronotype === v ? 'bg-accent text-black' : 'bg-card border border-card-border text-muted-foreground')}>{l}</button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-muted-foreground">Timp până adormi (min)</label><input type="number" value={p.timeToFallAsleep} onChange={e => p.setTimeToFallAsleep(e.target.value)} placeholder="15" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
          <div><label className="text-xs text-muted-foreground">Treziri pe noapte</label><input type="number" value={p.wakeUpsPerNight} onChange={e => p.setWakeUpsPerNight(e.target.value)} placeholder="1" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
          <div><label className="text-xs text-muted-foreground">Sieste pe zi</label><input type="number" value={p.napsDaily} onChange={e => p.setNapsDaily(e.target.value)} placeholder="0" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
          <div><label className="text-xs text-muted-foreground">Temperatura dormitor (°C)</label><input type="number" value={p.bedroomTemp} onChange={e => p.setBedroomTemp(e.target.value)} placeholder="19" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Verificat pentru apnee de somn?</label>
          <select value={p.sleepApneaChecked} onChange={e => p.setSleepApneaChecked(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent">
            <option value="">Nu știu / prefer să nu spun</option>
            <option value="never">Niciodată</option>
            <option value="negative">Testat — negativ</option>
            <option value="positive_cpap">Pozitiv, folosesc CPAP</option>
            <option value="positive_no_cpap">Pozitiv, fără CPAP</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => p.setPhoneInBedroom(!p.phoneInBedroom)} className={clsx('w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0', p.phoneInBedroom ? 'bg-warning border-warning' : 'border-card-border')}>
            {p.phoneInBedroom && <span className="text-black text-xs">✓</span>}
          </button>
          <span className="text-sm">Telefonul în dormitor noaptea</span>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-2 block">Probleme de somn</label>
          <div className="flex flex-wrap gap-2">
            {SLEEP_ISSUES.map(si => (
              <button key={si} onClick={() => p.toggle<string>(p.setSleepIssues as (f: (prev: string[]) => string[]) => void, si)} className={clsx('px-3 py-1.5 rounded-xl text-xs transition-all', p.sleepIssues.includes(si) ? 'bg-warning/20 text-warning border border-warning/50' : 'bg-card border border-card-border text-muted-foreground')}>{si}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Alte probleme de somn (descrie)</label>
          <textarea value={p.sleepIssuesCustom} onChange={e => p.setSleepIssuesCustom(e.target.value)} rows={2} placeholder="ex: partenerul sforăie și mă trezește, stradă zgomotoasă, mintea îngrijorată..." className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-xs outline-none focus:border-accent resize-none" />
        </div>
      </CollapseSection>

      {/* Diet */}
      <CollapseSection title="🥗 Dietă și substanțe" expanded={p.lifestyleExpanded.diet} onToggle={() => p.setLifestyleExpanded(prev => ({ ...prev, diet: !prev.diet }))}>
        <div>
          <label className="text-xs text-muted-foreground mb-2 block">Tipul dietei</label>
          <div className="flex flex-wrap gap-2">
            {['omnivore', 'vegetarian', 'vegan', 'keto', 'carnivore', 'mediterranean', 'custom'].map(d => (
              <button key={d} onClick={() => p.setDietType(d)} className={clsx('px-3 py-2 rounded-xl text-xs font-medium transition-all capitalize', p.dietType === d ? 'bg-accent text-black' : 'bg-card border border-card-border text-muted-foreground')}>{d}</button>
            ))}
          </div>
        </div>
        {p.dietType === 'custom' && (
          <div>
            <label className="text-xs text-muted-foreground">Descrie dieta ta</label>
            <input type="text" value={p.dietTypeCustom} onChange={e => p.setDietTypeCustom(e.target.value)} placeholder="ex: pescatarian + fără gluten, paleo, Whole30..." className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent" />
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-muted-foreground">Mese/zi</label><input type="number" value={p.mealsPerDay} onChange={e => p.setMealsPerDay(parseInt(e.target.value) || 3)} min={1} max={6} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
          <div><label className="text-xs text-muted-foreground">Apă (pahare/zi)</label><input type="number" value={p.hydration} onChange={e => p.setHydration(parseInt(e.target.value) || 6)} min={0} max={20} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
          <div><label className="text-xs text-muted-foreground">Prima masă</label><input type="time" value={p.firstMealTime} onChange={e => p.setFirstMealTime(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
          <div><label className="text-xs text-muted-foreground">Ultima masă</label><input type="time" value={p.lastMealTime} onChange={e => p.setLastMealTime(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-2 block">Descrie o zi tipică de mâncare (opțional dar puternic)</label>
          <textarea value={p.typicalDay} onChange={e => p.setTypicalDay(e.target.value)} rows={3} placeholder="ex: 8:00 cafea + ovăz cu banană. 13:00 piept de pui + orez. 19:00 somon + cartofi + vin." className="w-full rounded-xl bg-card border border-card-border px-3 py-2.5 text-xs outline-none focus:border-accent resize-none" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-2 block">% din mese gătite acasă: <span className="text-accent font-medium">{p.cooksAtHome}%</span></label>
          <input type="range" min={0} max={100} step={5} value={p.cooksAtHome} onChange={e => p.setCooksAtHome(parseInt(e.target.value))} className="w-full h-2 bg-card-border rounded-lg appearance-none cursor-pointer accent-[#34d399]" />
        </div>
        <p className="text-xs text-accent uppercase tracking-wider mt-2">Frecvențe alimente</p>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="text-xs text-muted">Fructe / zi</label><input type="number" value={p.fruitsPerDay} onChange={e => p.setFruitsPerDay(e.target.value)} placeholder="2" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2 text-xs outline-none focus:border-accent font-mono" /></div>
          <div><label className="text-xs text-muted">Legume / zi (porții)</label><input type="number" value={p.veggiesPerDay} onChange={e => p.setVeggiesPerDay(e.target.value)} placeholder="3" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2 text-xs outline-none focus:border-accent font-mono" /></div>
          <div><label className="text-xs text-muted">Pește / săptămână</label><input type="number" value={p.fishPerWeek} onChange={e => p.setFishPerWeek(e.target.value)} placeholder="2" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2 text-xs outline-none focus:border-accent font-mono" /></div>
          <div><label className="text-xs text-muted">Carne roșie / săpt.</label><input type="number" value={p.redMeatPerWeek} onChange={e => p.setRedMeatPerWeek(e.target.value)} placeholder="3" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2 text-xs outline-none focus:border-accent font-mono" /></div>
          <div><label className="text-xs text-muted">Ultra-procesat / săpt.</label><input type="number" value={p.ultraProcessedPerWeek} onChange={e => p.setUltraProcessedPerWeek(e.target.value)} placeholder="5" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2 text-xs outline-none focus:border-accent font-mono" /></div>
          <div><label className="text-xs text-muted">Fast food / săpt.</label><input type="number" value={p.fastFoodPerWeek} onChange={e => p.setFastFoodPerWeek(e.target.value)} placeholder="1" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2 text-xs outline-none focus:border-accent font-mono" /></div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-2 block">Alergii / intoleranțe alimentare</label>
          <div className="flex flex-wrap gap-2">
            {['gluten', 'lactate', 'nuci', 'fructe de mare', 'ouă', 'soia', 'crustacee'].map(f => (
              <button key={f} onClick={() => p.toggle<string>(p.setFoodAllergies as (fn: (prev: string[]) => string[]) => void, f)} className={clsx('px-3 py-1.5 rounded-xl text-xs capitalize transition-all', p.foodAllergies.includes(f) ? 'bg-warning/20 text-warning border border-warning/50' : 'bg-card border border-card-border text-muted-foreground')}>{f}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Alte alergii / sensibilități</label>
          <input type="text" value={p.foodAllergiesCustom} onChange={e => p.setFoodAllergiesCustom(e.target.value)} placeholder="ex: nightshades, FODMAPs, histamină..." className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent" />
        </div>
        <p className="text-xs text-accent uppercase tracking-wider mt-2">Cofeină, alcool, post intermitent</p>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-muted-foreground">Alcool (porții/săpt.)</label><input type="number" value={p.alcoholPerWeek} onChange={e => p.setAlcoholPerWeek(parseInt(e.target.value) || 0)} min={0} max={50} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
          <div><label className="text-xs text-muted-foreground">Cofeină (porții/zi)</label><input type="number" value={p.caffeineServings} onChange={e => p.setCaffeineServings(parseInt(e.target.value) || 0)} min={0} max={10} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
          <div className="col-span-2"><label className="text-xs text-muted-foreground">Ora limită cofeină (ultima cafea/ceai)</label><input type="time" value={p.coffeeCutoffTime} onChange={e => p.setCoffeeCutoffTime(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => p.setTriedIF(!p.triedIF)} className={clsx('w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0', p.triedIF ? 'bg-accent border-accent' : 'border-card-border')}>
            {p.triedIF && <span className="text-black text-xs">✓</span>}
          </button>
          <span className="text-sm">Practic post intermitent</span>
        </div>
        {p.triedIF && (
          <div>
            <label className="text-xs text-muted-foreground">Fereastră de alimentație</label>
            <select value={p.ifWindow} onChange={e => p.setIfWindow(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent">
              <option value="">Selectează...</option>
              <option value="12:12">12:12</option>
              <option value="14:10">14:10</option>
              <option value="16:8">16:8</option>
              <option value="18:6">18:6</option>
              <option value="20:4">20:4 / OMAD</option>
              <option value="extended">Post prelungit (24h+)</option>
            </select>
          </div>
        )}
        <p className="text-xs text-accent uppercase tracking-wider mt-2">Fumat / vapat / substanțe</p>
        <div className="flex items-center gap-3">
          <button onClick={() => p.setSmoker(!p.smoker)} className={clsx('w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0', p.smoker ? 'bg-warning border-warning' : 'border-card-border')}>
            {p.smoker && <span className="text-black text-xs">✓</span>}
          </button>
          <span className="text-sm">Fumez sau vapez nicotină</span>
        </div>
        {p.smoker && (
          <>
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Tip</label>
              <div className="flex gap-2">
                {([{ v: 'cigarettes', l: '🚬 Țigări' }, { v: 'vape', l: '💨 Vape' }, { v: 'both', l: 'Ambele' }] as const).map(({ v, l }) => (
                  <button key={v} onClick={() => p.setSmokingType(v)} className={clsx('flex-1 py-2 rounded-xl text-xs font-medium transition-all', p.smokingType === v ? 'bg-warning text-black' : 'bg-card border border-card-border text-muted-foreground')}>{l}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(p.smokingType === 'cigarettes' || p.smokingType === 'both') && (
                <div><label className="text-xs text-muted-foreground">Țigări/zi</label><input type="number" value={p.cigarettesPerDay} onChange={e => p.setCigarettesPerDay(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
              )}
              {(p.smokingType === 'vape' || p.smokingType === 'both') && (
                <div><label className="text-xs text-muted-foreground">Pufuri vape/zi (estimat)</label><input type="number" value={p.vapePuffsPerDay} onChange={e => p.setVapePuffsPerDay(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
              )}
            </div>
          </>
        )}
        <div>
          <label className="text-xs text-muted-foreground">Substanțe recreaționale (confidențial — afectează interacțiunile)</label>
          <input type="text" value={p.recreationalDrugs} onChange={e => p.setRecreationalDrugs(e.target.value)} placeholder="ex: cannabis în weekend, niciuna, ocazional psihedelice..." className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent" />
        </div>
      </CollapseSection>

      {/* Exercise */}
      <CollapseSection title="🏋️ Exerciții și mișcare" expanded={p.lifestyleExpanded.exercise} onToggle={() => p.setLifestyleExpanded(prev => ({ ...prev, exercise: !prev.exercise }))}>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-muted-foreground">Cardio (min/săpt.)</label><input type="number" value={p.cardioMin} onChange={e => p.setCardioMin(parseInt(e.target.value) || 0)} min={0} max={1000} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
          <div><label className="text-xs text-muted-foreground">Sesiuni de forță/săpt.</label><input type="number" value={p.strengthSessions} onChange={e => p.setStrengthSessions(parseInt(e.target.value) || 0)} min={0} max={7} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
          <div><label className="text-xs text-muted-foreground">Pași zilnici (medie)</label><input type="number" value={p.stepsPerDay} onChange={e => p.setStepsPerDay(e.target.value)} placeholder="8000" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
          <div><label className="text-xs text-muted-foreground">Fitness auto-evaluat (1-10): <span className="text-accent font-medium">{p.fitnessLevel}</span></label><input type="range" min={1} max={10} value={p.fitnessLevel} onChange={e => p.setFitnessLevel(parseInt(e.target.value))} className="w-full mt-2 h-2 bg-card-border rounded-lg appearance-none cursor-pointer accent-[#34d399]" /></div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-2 block">Tipuri de exerciții pe care le faci</label>
          <div className="flex flex-wrap gap-2">
            {['alergare', 'ciclism', 'înot', 'haltere', 'calistenie', 'HIIT', 'drumeție', 'sporturi de echipă', 'crossfit', 'arte marțiale', 'escaladă', 'dans'].map(ex => (
              <button key={ex} onClick={() => p.toggle<string>(p.setExercisesDone as (fn: (prev: string[]) => string[]) => void, ex)} className={clsx('px-3 py-1.5 rounded-xl text-xs capitalize transition-all', p.exercisesDone.includes(ex) ? 'bg-accent/20 text-accent border border-accent/50' : 'bg-card border border-card-border text-muted-foreground')}>{ex}</button>
            ))}
          </div>
        </div>
        <p className="text-xs text-accent uppercase tracking-wider mt-2">Benchmarkuri forță (dacă ridici — opțional)</p>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="text-xs text-muted">Max tracțiuni</label><input type="number" value={p.maxPullups} onChange={e => p.setMaxPullups(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2 text-xs outline-none focus:border-accent font-mono" /></div>
          <div><label className="text-xs text-muted">Genuflexiuni 1RM (kg)</label><input type="number" value={p.squatWeight} onChange={e => p.setSquatWeight(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2 text-xs outline-none focus:border-accent font-mono" /></div>
          <div><label className="text-xs text-muted">Bench 1RM (kg)</label><input type="number" value={p.benchWeight} onChange={e => p.setBenchWeight(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2 text-xs outline-none focus:border-accent font-mono" /></div>
          <div><label className="text-xs text-muted">Îndreptări 1RM (kg)</label><input type="number" value={p.deadliftWeight} onChange={e => p.setDeadliftWeight(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2 text-xs outline-none focus:border-accent font-mono" /></div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => p.setYogaPilates(!p.yogaPilates)} className={clsx('p-3 rounded-xl text-xs text-center transition-all', p.yogaPilates ? 'bg-accent/20 text-accent border border-accent/50' : 'bg-card border border-card-border text-muted-foreground')}>🧘 Yoga / Pilates</button>
          <button onClick={() => p.setSauna(!p.sauna)} className={clsx('p-3 rounded-xl text-xs text-center transition-all', p.sauna ? 'bg-accent/20 text-accent border border-accent/50' : 'bg-card border border-card-border text-muted-foreground')}>🔥 Saună regulat</button>
          <button onClick={() => p.setIceBath(!p.iceBath)} className={clsx('p-3 rounded-xl text-xs text-center transition-all', p.iceBath ? 'bg-accent/20 text-accent border border-accent/50' : 'bg-card border border-card-border text-muted-foreground')}>🧊 Baie de gheață</button>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Accidentări curente / limitări</label>
          <textarea value={p.injuries} onChange={e => p.setInjuries(e.target.value)} rows={2} placeholder="ex: menisc genunchi drept, impingement umăr..." className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-xs outline-none focus:border-accent resize-none" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Durere cronică (locație + severitate)</label>
          <input type="text" value={p.chronicPain} onChange={e => p.setChronicPain(e.target.value)} placeholder="ex: zona lombară 4/10 după stat pe scaun" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent" />
        </div>
      </CollapseSection>

      {/* Mental */}
      <CollapseSection title="🧠 Sănătate mentală și stres" expanded={p.lifestyleExpanded.mental} onToggle={() => p.setLifestyleExpanded(prev => ({ ...prev, mental: !prev.mental }))}>
        <div><label className="text-xs text-muted-foreground mb-2 block">Nivel de stres (1-10): <span className="text-accent font-medium">{p.stressLevel}</span></label>
          <input type="range" min={1} max={10} value={p.stressLevel} onChange={e => p.setStressLevel(parseInt(e.target.value))} className="w-full h-2 bg-card-border rounded-lg appearance-none cursor-pointer accent-[#34d399]" />
        </div>
        <div><label className="text-xs text-muted-foreground mb-2 block">Fericire / satisfacție de viață (1-10): <span className="text-accent font-medium">{p.happinessScore}</span></label>
          <input type="range" min={1} max={10} value={p.happinessScore} onChange={e => p.setHappinessScore(parseInt(e.target.value))} className="w-full h-2 bg-card-border rounded-lg appearance-none cursor-pointer accent-[#34d399]" />
        </div>
        <div><label className="text-xs text-muted-foreground mb-2 block">Sens / scop în viață (1-10): <span className="text-accent font-medium">{p.lifeSenseOfPurpose}</span></label>
          <input type="range" min={1} max={10} value={p.lifeSenseOfPurpose} onChange={e => p.setLifeSenseOfPurpose(parseInt(e.target.value))} className="w-full h-2 bg-card-border rounded-lg appearance-none cursor-pointer accent-[#34d399]" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-2 block">Meditație / mindfulness</label>
          <div className="flex gap-2">
            {(['none', 'occasional', 'daily'] as const).map(v => (
              <button key={v} onClick={() => p.setMeditationPractice(v)} className={clsx('flex-1 py-2 rounded-xl text-xs font-medium capitalize transition-all', p.meditationPractice === v ? 'bg-accent text-black' : 'bg-card border border-card-border text-muted-foreground')}>
                {v === 'none' ? 'deloc' : v === 'occasional' ? 'ocazional' : 'zilnic'}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => p.setDepressionSymptoms(!p.depressionSymptoms)} className={clsx('p-3 rounded-xl text-xs text-left transition-all', p.depressionSymptoms ? 'bg-warning/20 text-warning border border-warning/50' : 'bg-card border border-card-border text-muted-foreground')}>
            <div className={clsx('w-4 h-4 rounded border-2 inline-flex items-center justify-center mr-2 text-xs', p.depressionSymptoms ? 'bg-warning border-warning text-black' : 'border-card-border')}>{p.depressionSymptoms ? '✓' : ''}</div>
            Simptome depresive curente
          </button>
          <button onClick={() => p.setAnxietySymptoms(!p.anxietySymptoms)} className={clsx('p-3 rounded-xl text-xs text-left transition-all', p.anxietySymptoms ? 'bg-warning/20 text-warning border border-warning/50' : 'bg-card border border-card-border text-muted-foreground')}>
            <div className={clsx('w-4 h-4 rounded border-2 inline-flex items-center justify-center mr-2 text-xs', p.anxietySymptoms ? 'bg-warning border-warning text-black' : 'border-card-border')}>{p.anxietySymptoms ? '✓' : ''}</div>
            Simptome de anxietate curente
          </button>
          <button onClick={() => p.setTherapyNow(!p.therapyNow)} className={clsx('p-3 rounded-xl text-xs text-left transition-all', p.therapyNow ? 'bg-accent/20 text-accent border border-accent/50' : 'bg-card border border-card-border text-muted-foreground')}>
            <div className={clsx('w-4 h-4 rounded border-2 inline-flex items-center justify-center mr-2 text-xs', p.therapyNow ? 'bg-accent border-accent text-black' : 'border-card-border')}>{p.therapyNow ? '✓' : ''}</div>
            Sunt în terapie acum
          </button>
          <div>
            <label className="text-xs text-muted">Medicație psihiatrică (dacă e)</label>
            <input type="text" value={p.psychMeds} onChange={e => p.setPsychMeds(e.target.value)} placeholder="ex: SSRI, ADHD meds..." className="w-full mt-1 rounded-lg bg-card border border-card-border px-2 py-2 text-xs outline-none focus:border-accent" />
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Top 3 surse de stres din viața ta</label>
          <textarea value={p.topStressors} onChange={e => p.setTopStressors(e.target.value)} rows={2} placeholder="ex: deadline-uri muncă, finanțe, relația cu părinții..." className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-xs outline-none focus:border-accent resize-none" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Activități în flow (lucruri care te fac să pierzi noțiunea timpului)</label>
          <input type="text" value={p.flowActivities} onChange={e => p.setFlowActivities(e.target.value)} placeholder="ex: programare, pictură, escaladă, grădinărit..." className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-muted-foreground">Total timp pe ecran (h/zi)</label><input type="number" step="0.5" value={p.screenTimeDaily} onChange={e => p.setScreenTimeDaily(e.target.value)} placeholder="8" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
          <div><label className="text-xs text-muted-foreground">Social media (h/zi)</label><input type="number" step="0.5" value={p.socialMediaDaily} onChange={e => p.setSocialMediaDaily(e.target.value)} placeholder="2" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
        </div>
      </CollapseSection>

      {/* Medical */}
      <CollapseSection title="⚕️ Medical" expanded={p.lifestyleExpanded.medical} onToggle={() => p.setLifestyleExpanded(prev => ({ ...prev, medical: !prev.medical }))}>
        <div>
          <label className="text-xs text-muted-foreground mb-2 block">Condiții diagnosticate</label>
          <div className="flex flex-wrap gap-2">
            {CONDITIONS.map(c => (
              <button key={c} onClick={() => p.toggle<string>(p.setConditions as (fn: (prev: string[]) => string[]) => void, c)} className={clsx('px-3 py-1.5 rounded-xl text-xs transition-all', p.conditions.includes(c) ? 'bg-warning/20 text-warning border border-warning/50' : 'bg-card border border-card-border text-muted-foreground')}>{c}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-2 block">Istoric familial</label>
          <div className="flex flex-wrap gap-2">
            {FAMILY_CONDITIONS.map(c => (
              <button key={c} onClick={() => p.toggle<string>(p.setFamilyHistory as (fn: (prev: string[]) => string[]) => void, c)} className={clsx('px-3 py-1.5 rounded-xl text-xs transition-all', p.familyHistory.includes(c) ? 'bg-accent/20 text-accent border border-accent/50' : 'bg-card border border-card-border text-muted-foreground')}>{c}</button>
            ))}
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-muted-foreground">Medicații curente</label>
            <button onClick={p.addMedication} className="flex items-center gap-1 text-xs text-accent"><Plus className="w-3 h-3" /> Adaugă</button>
          </div>
          {p.medications.length === 0 && <p className="text-xs text-muted">Niciuna. Apasă „Adaugă" dacă iei.</p>}
          <div className="space-y-2">
            {p.medications.map((m, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input value={m.name} onChange={e => p.updateMed(i, 'name', e.target.value)} placeholder="Nume (ex. Metformină)" className="flex-1 rounded-lg bg-card border border-card-border px-2 py-1.5 text-xs outline-none focus:border-accent" />
                <input value={m.dose} onChange={e => p.updateMed(i, 'dose', e.target.value)} placeholder="500mg" className="w-20 rounded-lg bg-card border border-card-border px-2 py-1.5 text-xs outline-none focus:border-accent" />
                <select value={m.frequency} onChange={e => p.updateMed(i, 'frequency', e.target.value)} className="rounded-lg bg-card border border-card-border px-2 py-1.5 text-xs outline-none focus:border-accent">
                  <option value="daily">zilnic</option>
                  <option value="2x/day">de 2x/zi</option>
                  <option value="3x/day">de 3x/zi</option>
                  <option value="every other day">o zi da, o zi nu</option>
                  <option value="weekly">săptămânal</option>
                  <option value="monthly">lunar</option>
                  <option value="as needed">la nevoie</option>
                </select>
                <button onClick={() => p.removeMed(i)} aria-label={`Elimină medicația ${m.name || i + 1}`} className="p-2.5 text-muted hover:text-danger"><X className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Suplimente curente (separate prin virgulă)</label>
          <input type="text" value={p.supplements} onChange={e => p.setSupplements(e.target.value)} placeholder="Vitamina D, Omega-3, Magneziu..." className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent" />
        </div>
        <p className="text-xs text-accent uppercase tracking-wider mt-2">Istoric</p>
        <div>
          <label className="text-xs text-muted-foreground">Operații sau spitalizări trecute</label>
          <textarea value={p.surgeries} onChange={e => p.setSurgeries(e.target.value)} rows={2} placeholder="ex: apendicectomie 2015, artroscopie genunchi 2022" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-xs outline-none focus:border-accent resize-none" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-muted-foreground">Ultima analiză de sânge</label><input type="date" value={p.lastBloodTestDate} onChange={e => p.setLastBloodTestDate(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
          <div><label className="text-xs text-muted-foreground">Ultimul control fizic</label><input type="date" value={p.lastPhysicalDate} onChange={e => p.setLastPhysicalDate(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => p.setHadCovid(!p.hadCovid)} className={clsx('w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0', p.hadCovid ? 'bg-accent border-accent' : 'border-card-border')}>
            {p.hadCovid && <span className="text-black text-xs">✓</span>}
          </button>
          <span className="text-sm">Am avut COVID-19</span>
        </div>
        {p.hadCovid && (
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-muted-foreground">De câte ori?</label><input type="number" value={p.covidCount} onChange={e => p.setCovidCount(e.target.value)} placeholder="1" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm">
                <button onClick={() => p.setLongCovid(!p.longCovid)} className={clsx('w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0', p.longCovid ? 'bg-warning border-warning' : 'border-card-border')}>
                  {p.longCovid && <span className="text-black text-xs">✓</span>}
                </button>
                Simptome long COVID
              </label>
            </div>
          </div>
        )}
        <div>
          <label className="text-xs text-muted-foreground">Antibiotice în ultimele 12 luni</label>
          <select value={p.antibioticsLastYear} onChange={e => p.setAntibioticsLastYear(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent">
            <option value="">Selectează...</option>
            <option value="0">Niciuna</option>
            <option value="1">1 cură</option>
            <option value="2">2 cure</option>
            <option value="3+">3 sau mai multe</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Vaccinurile la zi?</label>
          <select value={p.vaccinesUpToDate} onChange={e => p.setVaccinesUpToDate(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent">
            <option value="">Selectează...</option>
            <option value="yes">Da, complet la zi</option>
            <option value="mostly">Mai ales — lipsesc câteva</option>
            <option value="no">Nu</option>
            <option value="selective">Selectiv (doar covid/gripă)</option>
          </select>
        </div>
        <p className="text-xs text-accent uppercase tracking-wider mt-2">Sex și reproductiv</p>
        <div>
          <label className="text-xs text-muted-foreground mb-2 block">Libido (1-10): <span className="text-accent font-medium">{p.libidoScore}</span></label>
          <input type="range" min={1} max={10} value={p.libidoScore} onChange={e => p.setLibidoScore(parseInt(e.target.value))} className="w-full h-2 bg-card-border rounded-lg appearance-none cursor-pointer accent-[#34d399]" />
        </div>
        {p.sex === 'male' && (
          <div>
            <label className="text-xs text-muted-foreground">Erecții matinale — frecvență</label>
            <select value={p.morningErection} onChange={e => p.setMorningErection(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent">
              <option value="">Selectează...</option>
              <option value="daily">Zilnic / majoritatea dimineților</option>
              <option value="several_week">Câteva pe săptămână</option>
              <option value="rare">Rar</option>
              <option value="never">Niciodată</option>
            </select>
          </div>
        )}
        {p.sex === 'female' && (
          <>
            <div>
              <label className="text-xs text-muted-foreground">Ciclul menstrual</label>
              <select value={p.menstrualRegular} onChange={e => p.setMenstrualRegular(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent">
                <option value="">Selectează...</option>
                <option value="regular">Regulat</option>
                <option value="irregular">Neregulat</option>
                <option value="absent">Absent (nu sunt însărcinată)</option>
                <option value="menopause">Post-menopauză</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Severitate PMS (0-10): <span className="text-accent font-medium">{p.pmsSeverity}</span></label>
              <input type="range" min={0} max={10} value={p.pmsSeverity} onChange={e => p.setPmsSeverity(parseInt(e.target.value))} className="w-full h-2 bg-card-border rounded-lg appearance-none cursor-pointer accent-[#34d399]" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Status menopauză</label>
              <select value={p.menopauseStatus} onChange={e => p.setMenopauseStatus(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent">
                <option value="">Nu se aplică</option>
                <option value="pre">Pre-menopauză</option>
                <option value="peri">Peri-menopauză</option>
                <option value="post">Post-menopauză (cu HRT)</option>
                <option value="post_no_hrt">Post-menopauză (fără HRT)</option>
              </select>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => p.setHormonalContraception(!p.hormonalContraception)} className={clsx('w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0', p.hormonalContraception ? 'bg-accent border-accent' : 'border-card-border')}>
                {p.hormonalContraception && <span className="text-black text-xs">✓</span>}
              </button>
              <span className="text-sm">Folosesc contracepție hormonală (pilulă, sterilet, inel)</span>
            </div>
          </>
        )}
        <div>
          <label className="text-xs text-muted-foreground">Copii</label>
          <select value={p.hadChildren} onChange={e => p.setHadChildren(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent">
            <option value="">Prefer să nu spun</option>
            <option value="none">Niciunul</option>
            <option value="planning">Plănuiesc curând</option>
            <option value="1">1 copil</option>
            <option value="2">2 copii</option>
            <option value="3+">3 sau mai mulți</option>
          </select>
        </div>
        <p className="text-xs text-accent uppercase tracking-wider mt-2">Igienă zilnică</p>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => p.setFlossDaily(!p.flossDaily)} className={clsx('p-3 rounded-xl text-xs text-center transition-all', p.flossDaily ? 'bg-accent/20 text-accent border border-accent/50' : 'bg-card border border-card-border text-muted-foreground')}>🦷 Floss zilnic</button>
          <button onClick={() => p.setSpfDaily(!p.spfDaily)} className={clsx('p-3 rounded-xl text-xs text-center transition-all', p.spfDaily ? 'bg-accent/20 text-accent border border-accent/50' : 'bg-card border border-card-border text-muted-foreground')}>☀️ SPF zilnic</button>
        </div>
        <p className="text-xs text-warning uppercase tracking-wider mt-2">⚠️ Semne de alarmă acute (bifează ce ți se aplică)</p>
        <div className="grid grid-cols-1 gap-2">
          {[
            'Scădere inexplicabilă în greutate >5kg în 6 luni',
            'Sânge în scaun sau urină',
            'Durere în piept la efort',
            'Cefalee severă / modificări de vedere',
            'Febră persistentă > 2 săptămâni',
            'Mase sau noduli noi',
            'Leșin / sincopă',
            'Dispnee în repaus',
          ].map(f => (
            <button key={f} onClick={() => p.toggle<string>(p.setRedFlagsAcute as (fn: (prev: string[]) => string[]) => void, f)} className={clsx('flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-left transition-all', p.redFlagsAcute.includes(f) ? 'bg-danger/20 text-danger border border-danger/50' : 'bg-card border border-card-border text-muted-foreground')}>
              <div className={clsx('w-4 h-4 rounded border-2 flex items-center justify-center text-xs', p.redFlagsAcute.includes(f) ? 'bg-danger border-danger text-black' : 'border-card-border')}>
                {p.redFlagsAcute.includes(f) ? '✓' : ''}
              </div>
              {f}
            </button>
          ))}
        </div>
        {p.redFlagsAcute.length > 0 && (
          <p className="text-xs text-danger p-2 rounded-lg bg-danger/10 border border-danger/30">
            ⚠️ Vezi un medic urgent — aceste simptome au nevoie de evaluare medicală, nu de un protocol de suplimente.
          </p>
        )}
      </CollapseSection>

      {/* Environment */}
      <CollapseSection title="🌍 Mediu și expuneri" expanded={p.lifestyleExpanded.environment} onToggle={() => p.setLifestyleExpanded(prev => ({ ...prev, environment: !prev.environment }))}>
        <div>
          <label className="text-xs text-muted-foreground">Tipul locuinței</label>
          <select value={p.housingType} onChange={e => p.setHousingType(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent">
            <option value="">Selectează...</option>
            <option value="apartment_city">Apartament — centru oraș</option>
            <option value="apartment_suburb">Apartament — periferie</option>
            <option value="house_suburb">Casă — periferie</option>
            <option value="house_rural">Casă — rural</option>
            <option value="house_mountain">Casă — munte / aer curat</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Nivel de poluare a aerului unde locuiești</label>
          <select value={p.pollutionLevel} onChange={e => p.setPollutionLevel(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent">
            <option value="">Nu știu</option>
            <option value="very_low">Foarte scăzut (rural, mare, munte)</option>
            <option value="low">Scăzut</option>
            <option value="moderate">Moderat (majoritatea orașelor)</option>
            <option value="high">Înalt (industrial / megapolă)</option>
            <option value="very_high">Foarte înalt</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => p.setMoldAtHome(!p.moldAtHome)} className={clsx('p-3 rounded-xl text-xs text-center transition-all', p.moldAtHome ? 'bg-warning/20 text-warning border border-warning/50' : 'bg-card border border-card-border text-muted-foreground')}>🧪 Mucegai vizibil acasă</button>
          <button onClick={() => p.setAirPurifier(!p.airPurifier)} className={clsx('p-3 rounded-xl text-xs text-center transition-all', p.airPurifier ? 'bg-accent/20 text-accent border border-accent/50' : 'bg-card border border-card-border text-muted-foreground')}>💨 Purificator aer</button>
          <button onClick={() => p.setTeflonNonstick(!p.teflonNonstick)} className={clsx('p-3 rounded-xl text-xs text-center transition-all', p.teflonNonstick ? 'bg-warning/20 text-warning border border-warning/50' : 'bg-card border border-card-border text-muted-foreground')}>🍳 Teflon non-stick</button>
          <div>
            <label className="text-xs text-muted">Filtru apă</label>
            <select value={p.waterFilter} onChange={e => p.setWaterFilter(e.target.value)} className="w-full mt-1 rounded-lg bg-card border border-card-border px-2 py-2 text-xs outline-none focus:border-accent">
              <option value="">Selectează</option>
              <option value="none">Niciunul — robinet</option>
              <option value="carbon">Carbon / carafă</option>
              <option value="ro">Osmoză inversă</option>
              <option value="bottled">Doar îmbuteliată</option>
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Contact plastic cu alimente (sticle de apă, recipiente)</label>
          <select value={p.plasticFoodContact} onChange={e => p.setPlasticFoodContact(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent">
            <option value="">Selectează...</option>
            <option value="minimal">Minim — sticlă / inox</option>
            <option value="some">Ceva plastic</option>
            <option value="heavy">Mult — apă îmbuteliată, microunde cu plastic</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Soare zilnic afară (minute)</label>
          <input type="number" value={p.sunlightMinutes} onChange={e => p.setSunlightMinutes(e.target.value)} placeholder="20" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" />
        </div>
      </CollapseSection>

      {/* Social */}
      <CollapseSection title="👥 Social și relații" expanded={p.lifestyleExpanded.social} onToggle={() => p.setLifestyleExpanded(prev => ({ ...prev, social: !prev.social }))}>
        <div>
          <label className="text-xs text-muted-foreground">Status relație</label>
          <select value={p.relationshipStatus} onChange={e => p.setRelationshipStatus(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent">
            <option value="">Prefer să nu spun</option>
            <option value="single">Singur</option>
            <option value="dating">Întâlniri</option>
            <option value="partnered">Într-o relație</option>
            <option value="married">Căsătorit / parteneriat civil</option>
            <option value="divorced">Divorțat / separat</option>
            <option value="widowed">Văduv</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-2 block">Satisfacție relație (1-10): <span className="text-accent font-medium">{p.relationshipSatisfaction}</span></label>
          <input type="range" min={1} max={10} value={p.relationshipSatisfaction} onChange={e => p.setRelationshipSatisfaction(parseInt(e.target.value))} className="w-full h-2 bg-card-border rounded-lg appearance-none cursor-pointer accent-[#34d399]" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Număr prieteni apropiați</label>
            <input type="number" value={p.closeFriendsCount} onChange={e => p.setCloseFriendsCount(e.target.value)} placeholder="3" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-2 block">Singurătate (1-10): <span className="text-accent font-medium">{p.lonelinessLevel}</span></label>
            <input type="range" min={1} max={10} value={p.lonelinessLevel} onChange={e => p.setLonelinessLevel(parseInt(e.target.value))} className="w-full mt-2 h-2 bg-card-border rounded-lg appearance-none cursor-pointer accent-[#34d399]" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => p.setPet(!p.pet)} className={clsx('p-3 rounded-xl text-xs text-center transition-all', p.pet ? 'bg-accent/20 text-accent border border-accent/50' : 'bg-card border border-card-border text-muted-foreground')}>🐶 Am animal de companie</button>
          <button onClick={() => p.setHasCommunity(!p.hasCommunity)} className={clsx('p-3 rounded-xl text-xs text-center transition-all', p.hasCommunity ? 'bg-accent/20 text-accent border border-accent/50' : 'bg-card border border-card-border text-muted-foreground')}>🏘️ Comunitate / grup</button>
        </div>
      </CollapseSection>
    </div>
  );
}
