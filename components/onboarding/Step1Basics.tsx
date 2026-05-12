'use client';

// Onboarding step 1 — basics: required (age, height, weight) + activity +
// wearables + home equipment + bloodwork choice + motivation + four
// collapsible panels (identity, location, measurements, family).
//
// State stays in the parent page so auto-save / localStorage restore /
// validation stays untouched. ~55 fields threaded as props.

import clsx from 'clsx';
import { DevicePicker } from './DevicePicker';
import { EquipmentRow } from './EquipmentRow';
import { CollapseSection } from './CollapseSection';
import { SMARTWATCH_BRANDS, SMART_RING_BRANDS, HOME_EQUIPMENT } from '@/lib/engine/device-catalog';

type OwnershipStatus = 'yes' | 'no' | 'will_buy';
type Sex = 'male' | 'female' | 'intersex';
type BasicsExpanded = { location: boolean; identity: boolean; measurements: boolean; family: boolean };

export interface Step1BasicsProps {
  // Required
  name: string; setName: (v: string) => void;
  age: string; setAge: (v: string) => void;
  birthDate: string; setBirthDate: (v: string) => void;
  heightCm: string; setHeightCm: (v: string) => void;
  weightKg: string; setWeightKg: (v: string) => void;
  stepErrors: Record<string, string>;
  setStepErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  // Activity
  activityLevel: number; setActivityLevel: (v: number) => void;
  activityLabels: string[];
  // Wearables
  wearable: string; setWearable: (v: string) => void;
  smartwatchBrand: string; setSmartwatchBrand: (v: string) => void;
  smartwatchModel: string; setSmartwatchModel: (v: string) => void;
  smartwatchOther: string; setSmartwatchOther: (v: string) => void;
  smartRingBrand: string; setSmartRingBrand: (v: string) => void;
  smartRingModel: string; setSmartRingModel: (v: string) => void;
  smartRingOther: string; setSmartRingOther: (v: string) => void;
  // Equipment
  equipmentOwnership: Record<string, OwnershipStatus>;
  setEquipmentOwnership: React.Dispatch<React.SetStateAction<Record<string, OwnershipStatus>>>;
  equipmentNotes: Record<string, string>;
  setEquipmentNotes: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  // Bloodwork
  hasBloodWork: null | boolean; setHasBloodWork: (v: boolean) => void;
  // Motivation
  motivation: string; setMotivation: (v: string) => void;
  discipline: number; setDiscipline: (v: number) => void;
  supportSystem: boolean; setSupportSystem: (v: boolean) => void;
  // Collapsibles
  basicsExpanded: BasicsExpanded;
  setBasicsExpanded: React.Dispatch<React.SetStateAction<BasicsExpanded>>;
  // Identity panel
  sex: Sex; setSex: (v: Sex) => void;
  chromosomes: string; setChromosomes: (v: string) => void;
  genderIdentity: string; setGenderIdentity: (v: string) => void;
  transitioning: boolean; setTransitioning: (v: boolean) => void;
  transitionTo: string; setTransitionTo: (v: string) => void;
  pregnant: boolean; setPregnant: (v: boolean) => void;
  pregnancyWeeks: string; setPregnancyWeeks: (v: string) => void;
  breastfeeding: boolean; setBreastfeeding: (v: boolean) => void;
  ethnicity: string; setEthnicity: (v: string) => void;
  occupation: string; setOccupation: (v: string) => void;
  restingHR: string; setRestingHR: (v: string) => void;
  // Location panel
  country: string; setCountry: (v: string) => void;
  city: string; setCity: (v: string) => void;
  birthCountry: string; setBirthCountry: (v: string) => void;
  birthCity: string; setBirthCity: (v: string) => void;
  // Measurements panel
  waistCm: string; setWaistCm: (v: string) => void;
  hipCm: string; setHipCm: (v: string) => void;
  armCm: string; setArmCm: (v: string) => void;
  thighCm: string; setThighCm: (v: string) => void;
  bodyFatPct: string; setBodyFatPct: (v: string) => void;
  vo2Max: string; setVo2Max: (v: string) => void;
  bloodPressureSys: string; setBloodPressureSys: (v: string) => void;
  bloodPressureDia: string; setBloodPressureDia: (v: string) => void;
  hrv: string; setHrv: (v: string) => void;
  gripStrength: string; setGripStrength: (v: string) => void;
  cooperTest: string; setCooperTest: (v: string) => void;
  maxPushups: string; setMaxPushups: (v: string) => void;
  plankSec: string; setPlankSec: (v: string) => void;
  maxSquats: string; setMaxSquats: (v: string) => void;
  sitReachCm: string; setSitReachCm: (v: string) => void;
  balanceSec: string; setBalanceSec: (v: string) => void;
  weightOneYearAgo: string; setWeightOneYearAgo: (v: string) => void;
  weightMinAdult: string; setWeightMinAdult: (v: string) => void;
  weightMaxAdult: string; setWeightMaxAdult: (v: string) => void;
  // Family panel
  parentsAlive: string; setParentsAlive: (v: string) => void;
  familyCardio: boolean; setFamilyCardio: (v: boolean) => void;
  familyCancer: boolean; setFamilyCancer: (v: boolean) => void;
  familyDiabetes: boolean; setFamilyDiabetes: (v: boolean) => void;
  familyAlzheimers: boolean; setFamilyAlzheimers: (v: boolean) => void;
  familyAutoimmune: boolean; setFamilyAutoimmune: (v: boolean) => void;
  familyMental: boolean; setFamilyMental: (v: boolean) => void;
  geneticTestDone: string; setGeneticTestDone: (v: string) => void;
}

// Helper: clear a stepErrors entry when the field's value changes.
function clearError(setStepErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>, key: string) {
  setStepErrors(prev => {
    if (!prev[key]) return prev;
    const next = { ...prev };
    delete next[key];
    return next;
  });
}

export function Step1Basics(props: Step1BasicsProps) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Datele de bază</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Doar vârsta, înălțimea și greutatea sunt obligatorii. Restul e opțional —
          cu cât împărtășești mai multe, cu atât protocolul e mai personalizat.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Nume (opțional)</label>
          <input
            type="text"
            value={props.name}
            onChange={e => props.setName(e.target.value)}
            placeholder="Alex"
            className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent"
          />
        </div>
        <div>
          <label htmlFor="onb-age" className="text-xs text-muted-foreground">Vârstă <span className="text-accent">*</span></label>
          <input
            id="onb-age"
            type="number"
            value={props.age}
            onChange={e => { props.setAge(e.target.value); clearError(props.setStepErrors, 'onb-age'); }}
            aria-invalid={!!props.stepErrors['onb-age']}
            aria-describedby={props.stepErrors['onb-age'] ? 'onb-age-err' : undefined}
            placeholder="25"
            className={clsx('w-full mt-1 rounded-xl bg-card border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono',
              props.stepErrors['onb-age'] ? 'border-danger' : 'border-card-border')}
          />
          {props.stepErrors['onb-age']
            ? <p id="onb-age-err" className="text-xs text-danger mt-1">{props.stepErrors['onb-age']}</p>
            : <p className="text-xs text-muted mt-1">Sau alege data nașterii mai jos pentru precizie</p>}
        </div>
        <div className="col-span-2">
          <label className="text-xs text-muted-foreground">Data nașterii (opțional — mai precis decât doar vârsta)</label>
          <input
            type="date"
            value={props.birthDate}
            onChange={e => {
              props.setBirthDate(e.target.value);
              if (e.target.value) {
                const yrs = Math.floor((Date.now() - new Date(e.target.value).getTime()) / (365.25 * 24 * 3600 * 1000));
                props.setAge(String(yrs));
              }
            }}
            className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono"
          />
        </div>
        <div>
          <label htmlFor="onb-height" className="text-xs text-muted-foreground">Înălțime (cm) <span className="text-accent">*</span></label>
          <input
            id="onb-height"
            type="number"
            value={props.heightCm}
            onChange={e => { props.setHeightCm(e.target.value); clearError(props.setStepErrors, 'onb-height'); }}
            aria-invalid={!!props.stepErrors['onb-height']}
            aria-describedby={props.stepErrors['onb-height'] ? 'onb-height-err' : undefined}
            placeholder="180"
            className={clsx('w-full mt-1 rounded-xl bg-card border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono',
              props.stepErrors['onb-height'] ? 'border-danger' : 'border-card-border')}
          />
          {props.stepErrors['onb-height']
            ? <p id="onb-height-err" className="text-xs text-danger mt-1">{props.stepErrors['onb-height']}</p>
            : <p className="text-xs text-muted mt-1">Măsoară acum pentru acuratețe</p>}
        </div>
        <div>
          <label htmlFor="onb-weight" className="text-xs text-muted-foreground">Greutate (kg) <span className="text-accent">*</span></label>
          <input
            id="onb-weight"
            type="number"
            step="0.1"
            value={props.weightKg}
            onChange={e => { props.setWeightKg(e.target.value); clearError(props.setStepErrors, 'onb-weight'); }}
            aria-invalid={!!props.stepErrors['onb-weight']}
            aria-describedby={props.stepErrors['onb-weight'] ? 'onb-weight-err' : undefined}
            placeholder="80"
            className={clsx('w-full mt-1 rounded-xl bg-card border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono',
              props.stepErrors['onb-weight'] ? 'border-danger' : 'border-card-border')}
          />
          {props.stepErrors['onb-weight']
            ? <p id="onb-weight-err" className="text-xs text-danger mt-1">{props.stepErrors['onb-weight']}</p>
            : <p className="text-xs text-muted mt-1">Cântărește-te dimineața, pe nemâncate</p>}
        </div>
      </div>

      <div>
        <label className="text-xs text-muted-foreground mb-2 block">
          Nivel de activitate: <span className="text-accent font-medium">{props.activityLabels[props.activityLevel]}</span>
        </label>
        <input
          type="range"
          min={0}
          max={4}
          value={props.activityLevel}
          onChange={e => props.setActivityLevel(parseInt(e.target.value))}
          className="w-full h-2 bg-card-border rounded-lg appearance-none cursor-pointer accent-[#34d399]"
        />
        <div className="flex justify-between text-xs text-muted mt-1">
          {props.activityLabels.map(l => <span key={l}>{l}</span>)}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">⌚ Wearables</h3>
          <p className="text-xs text-muted-foreground">AI-ul folosește capabilitățile dispozitivului ca să știe ce poți măsura zilnic.</p>
        </div>
        <DevicePicker
          label="Smartwatch"
          icon="⌚"
          brands={SMARTWATCH_BRANDS}
          brand={props.smartwatchBrand}
          model={props.smartwatchModel}
          other={props.smartwatchOther}
          onBrandChange={v => {
            props.setSmartwatchBrand(v);
            if (v !== 'none') props.setWearable(v);
            else if (props.smartRingBrand === 'none') props.setWearable('none');
          }}
          onModelChange={props.setSmartwatchModel}
          onOtherChange={props.setSmartwatchOther}
        />
        <DevicePicker
          label="Inel smart"
          icon="💍"
          brands={SMART_RING_BRANDS}
          brand={props.smartRingBrand}
          model={props.smartRingModel}
          other={props.smartRingOther}
          onBrandChange={v => {
            props.setSmartRingBrand(v);
            if (v !== 'none' && props.smartwatchBrand === 'none') props.setWearable(v);
          }}
          onModelChange={props.setSmartRingModel}
          onOtherChange={props.setSmartRingOther}
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">🏠 Echipamente acasă</h3>
          <p className="text-xs text-muted-foreground">Ce poți măsura acasă? Determină ce te sugerăm să tracking-uiești.</p>
        </div>
        <div className="space-y-2">
          {HOME_EQUIPMENT.map(item => (
            <EquipmentRow
              key={item.key}
              item={item}
              status={props.equipmentOwnership[item.key]}
              note={props.equipmentNotes[item.key] || ''}
              onStatus={s => props.setEquipmentOwnership(prev => ({ ...prev, [item.key]: s }))}
              onNote={n => props.setEquipmentNotes(prev => ({ ...prev, [item.key]: n }))}
            />
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs text-muted-foreground mb-2 block">Ai analize de sânge recente?</label>
        <div className="flex gap-3">
          {[{ v: true, l: 'Da, am rezultate' }, { v: false, l: 'Nu, sari peste' }].map(({ v, l }) => (
            <button
              key={String(v)}
              onClick={() => props.setHasBloodWork(v)}
              className={clsx('flex-1 py-3 rounded-xl text-sm font-medium transition-all',
                props.hasBloodWork === v ? 'bg-accent text-black' : 'bg-card border border-card-border text-muted-foreground')}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-accent/5 border border-accent/20 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎯</span>
          <h3 className="text-sm font-semibold">„De ce" — cel mai important câmp</h3>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Motivele principale + ce te-a determinat ACUM?</label>
          <textarea
            value={props.motivation}
            onChange={e => props.setMotivation(e.target.value)}
            rows={3}
            placeholder="ex: tata a avut infarct la 67 — vreau să evit asta. Am împlinit 35 și mi-a scăzut energia. Vreau să fiu prezent pentru copii pe termen lung."
            className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent resize-none"
          />
          <p className="text-xs text-muted-foreground mt-1">AI-ul folosește asta ca să calibreze tonul de coaching și să prioritizeze intervențiile potrivite pentru tine.</p>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-2 block">Cât de disciplinat ești cu obiceiurile? <span className="text-accent">{props.discipline}/10</span></label>
          <input
            type="range" min={1} max={10}
            value={props.discipline}
            onChange={e => props.setDiscipline(parseInt(e.target.value))}
            className="w-full h-2 bg-card-border rounded-lg appearance-none cursor-pointer accent-[#34d399]"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => props.setSupportSystem(!props.supportSystem)}
            className={clsx('w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0',
              props.supportSystem ? 'bg-accent border-accent' : 'border-card-border')}
          >
            {props.supportSystem && <span className="text-black text-xs">✓</span>}
          </button>
          <span className="text-sm">Am sprijinul familiei / partenerului</span>
        </div>
      </div>

      <CollapseSection title="🧬 Identitate și biologie (opțional)" expanded={props.basicsExpanded.identity} onToggle={() => props.setBasicsExpanded(prev => ({ ...prev, identity: !prev.identity }))}>
        <div>
          <label className="text-xs text-muted-foreground mb-2 block">Sex biologic</label>
          <div className="grid grid-cols-3 gap-2">
            {(['male', 'female', 'intersex'] as const).map(s => (
              <button
                key={s}
                onClick={() => props.setSex(s)}
                className={clsx('py-2.5 rounded-xl text-sm font-medium capitalize transition-all',
                  props.sex === s ? 'bg-accent text-black' : 'bg-card border border-card-border text-muted-foreground')}
              >
                {s === 'male' ? 'bărbat' : s === 'female' ? 'femeie' : 'intersex'}
              </button>
            ))}
          </div>
        </div>
        {props.sex === 'intersex' && (
          <div>
            <label className="text-xs text-muted-foreground">Cromozomi (dacă știi)</label>
            <select
              value={props.chromosomes}
              onChange={e => props.setChromosomes(e.target.value)}
              className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent"
            >
              <option value="">Prefer să nu spun</option>
              <option value="XX">XX</option>
              <option value="XY">XY</option>
              <option value="XXY">XXY (Klinefelter)</option>
              <option value="X0">X0 (Turner)</option>
              <option value="XYY">XYY</option>
              <option value="mosaic">Mosaic / altele</option>
              <option value="unknown">Nu știu</option>
            </select>
          </div>
        )}
        <div>
          <label className="text-xs text-muted-foreground">Identitate de gen (opțional)</label>
          <input
            type="text"
            value={props.genderIdentity}
            onChange={e => props.setGenderIdentity(e.target.value)}
            placeholder="ex: bărbat, femeie, non-binar, trans"
            className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => props.setTransitioning(!props.transitioning)}
            className={clsx('w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0',
              props.transitioning ? 'bg-accent border-accent' : 'border-card-border')}
          >
            {props.transitioning && <span className="text-black text-xs">✓</span>}
          </button>
          <span className="text-sm">În tranziție sau analizez tranziția</span>
        </div>
        {props.transitioning && (
          <div>
            <label className="text-xs text-muted-foreground">În tranziție către (afectează protocolul hormonal)</label>
            <select
              value={props.transitionTo}
              onChange={e => props.setTransitionTo(e.target.value)}
              className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent"
            >
              <option value="">Selectează...</option>
              <option value="male">Masculinizare (HRT → bărbat)</option>
              <option value="female">Feminizare (HRT → femeie)</option>
              <option value="non-binary">Non-binar / micro-dozaj</option>
              <option value="exploring">Analizez opțiunile</option>
            </select>
          </div>
        )}
        {props.sex === 'female' && (
          <>
            <div className="flex items-center gap-3">
              <button
                onClick={() => props.setPregnant(!props.pregnant)}
                className={clsx('w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0',
                  props.pregnant ? 'bg-warning border-warning' : 'border-card-border')}
              >
                {props.pregnant && <span className="text-black text-xs">✓</span>}
              </button>
              <span className="text-sm">Însărcinată</span>
            </div>
            {props.pregnant && (
              <div>
                <label className="text-xs text-muted-foreground">Câte săptămâni?</label>
                <input
                  type="number"
                  value={props.pregnancyWeeks}
                  onChange={e => props.setPregnancyWeeks(e.target.value)}
                  placeholder="12" min={0} max={45}
                  className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono"
                />
              </div>
            )}
            <div className="flex items-center gap-3">
              <button
                onClick={() => props.setBreastfeeding(!props.breastfeeding)}
                className={clsx('w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0',
                  props.breastfeeding ? 'bg-warning border-warning' : 'border-card-border')}
              >
                {props.breastfeeding && <span className="text-black text-xs">✓</span>}
              </button>
              <span className="text-sm">Alăptez</span>
            </div>
          </>
        )}
        <div>
          <label className="text-xs text-muted-foreground">Etnie / moștenire (afectează unele intervale de biomarkeri)</label>
          <select
            value={props.ethnicity}
            onChange={e => props.setEthnicity(e.target.value)}
            className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent"
          >
            <option value="">Selectează...</option>
            <option value="european">Europeană</option>
            <option value="african">Africană</option>
            <option value="asian_east">Est-asiatică</option>
            <option value="asian_south">Sud-asiatică</option>
            <option value="hispanic">Hispanic/Latino</option>
            <option value="middle_eastern">Orientul Mijlociu</option>
            <option value="mixed">Mixtă / altele</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-2 block">Tipul de muncă</label>
          <div className="grid grid-cols-4 gap-2">
            {(['desk', 'physical', 'shift', 'mixed'] as const).map(o => (
              <button
                key={o}
                onClick={() => props.setOccupation(o)}
                className={clsx('py-2 rounded-xl text-xs font-medium capitalize transition-all',
                  props.occupation === o ? 'bg-accent text-black' : 'bg-card border border-card-border text-muted-foreground')}
              >
                {o === 'desk' ? 'birou' : o === 'physical' ? 'fizică' : o === 'shift' ? 'în ture' : 'mixtă'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Puls de repaus (dacă știi, bpm dimineața)</label>
          <input
            type="number"
            value={props.restingHR}
            onChange={e => props.setRestingHR(e.target.value)}
            placeholder="65"
            className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono"
          />
        </div>
      </CollapseSection>

      <CollapseSection title="🌍 Locație (opțional — afectează clima, poluarea, cultura alimentară)" expanded={props.basicsExpanded.location} onToggle={() => props.setBasicsExpanded(prev => ({ ...prev, location: !prev.location }))}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Țara de reședință</label>
            <input type="text" value={props.country} onChange={e => props.setCountry(e.target.value)} placeholder="România" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Oraș</label>
            <input type="text" value={props.city} onChange={e => props.setCity(e.target.value)} placeholder="București" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Țara nașterii</label>
            <input type="text" value={props.birthCountry} onChange={e => props.setBirthCountry(e.target.value)} placeholder="România" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Orașul nașterii</label>
            <input type="text" value={props.birthCity} onChange={e => props.setBirthCity(e.target.value)} placeholder="Cluj-Napoca" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent" />
          </div>
        </div>
      </CollapseSection>

      <CollapseSection title="📏 Măsurători corporale și teste fitness (toate opționale)" expanded={props.basicsExpanded.measurements} onToggle={() => props.setBasicsExpanded(prev => ({ ...prev, measurements: !prev.measurements }))}>
        <p className="text-xs text-muted-foreground">Cu cât completezi mai multe, cu atât protocolul e mai precis. Sari peste orice nu ai.</p>
        <p className="text-xs text-accent uppercase tracking-wider mt-2">Circumferințe (cm)</p>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="text-xs text-muted">Talie</label><input type="number" value={props.waistCm} onChange={e => props.setWaistCm(e.target.value)} placeholder="85" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2 text-xs outline-none focus:border-accent font-mono" /></div>
          <div><label className="text-xs text-muted">Șold</label><input type="number" value={props.hipCm} onChange={e => props.setHipCm(e.target.value)} placeholder="95" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2 text-xs outline-none focus:border-accent font-mono" /></div>
          <div><label className="text-xs text-muted">Braț</label><input type="number" value={props.armCm} onChange={e => props.setArmCm(e.target.value)} placeholder="32" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2 text-xs outline-none focus:border-accent font-mono" /></div>
          <div><label className="text-xs text-muted">Coapsă</label><input type="number" value={props.thighCm} onChange={e => props.setThighCm(e.target.value)} placeholder="55" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2 text-xs outline-none focus:border-accent font-mono" /></div>
        </div>
        <p className="text-xs text-accent uppercase tracking-wider mt-2">Compoziție corporală</p>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="text-xs text-muted">% grăsime corporală</label><input type="number" step="0.1" value={props.bodyFatPct} onChange={e => props.setBodyFatPct(e.target.value)} placeholder="18" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2 text-xs outline-none focus:border-accent font-mono" /></div>
          <div><label className="text-xs text-muted">VO2 Max (ml/kg)</label><input type="number" step="0.1" value={props.vo2Max} onChange={e => props.setVo2Max(e.target.value)} placeholder="42" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2 text-xs outline-none focus:border-accent font-mono" /></div>
        </div>
        <p className="text-xs text-accent uppercase tracking-wider mt-2">Cardiovascular</p>
        <div className="grid grid-cols-3 gap-2">
          <div><label className="text-xs text-muted">TA sist.</label><input type="number" value={props.bloodPressureSys} onChange={e => props.setBloodPressureSys(e.target.value)} placeholder="120" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2 text-xs outline-none focus:border-accent font-mono" /></div>
          <div><label className="text-xs text-muted">TA diast.</label><input type="number" value={props.bloodPressureDia} onChange={e => props.setBloodPressureDia(e.target.value)} placeholder="80" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2 text-xs outline-none focus:border-accent font-mono" /></div>
          <div><label className="text-xs text-muted">HRV (ms)</label><input type="number" value={props.hrv} onChange={e => props.setHrv(e.target.value)} placeholder="55" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2 text-xs outline-none focus:border-accent font-mono" /></div>
        </div>
        <p className="text-xs text-accent uppercase tracking-wider mt-2">Teste fitness</p>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="text-xs text-muted">Forța de prindere (kg)</label><input type="number" step="0.5" value={props.gripStrength} onChange={e => props.setGripStrength(e.target.value)} placeholder="40" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2 text-xs outline-none focus:border-accent font-mono" /></div>
          <div><label className="text-xs text-muted">Test Cooper (m în 12 min)</label><input type="number" value={props.cooperTest} onChange={e => props.setCooperTest(e.target.value)} placeholder="2400" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2 text-xs outline-none focus:border-accent font-mono" /></div>
          <div><label className="text-xs text-muted">Max flotări / 1 min</label><input type="number" value={props.maxPushups} onChange={e => props.setMaxPushups(e.target.value)} placeholder="30" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2 text-xs outline-none focus:border-accent font-mono" /></div>
          <div><label className="text-xs text-muted">Max plank (sec)</label><input type="number" value={props.plankSec} onChange={e => props.setPlankSec(e.target.value)} placeholder="90" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2 text-xs outline-none focus:border-accent font-mono" /></div>
          <div><label className="text-xs text-muted">Max genuflexiuni / 1 min</label><input type="number" value={props.maxSquats} onChange={e => props.setMaxSquats(e.target.value)} placeholder="40" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2 text-xs outline-none focus:border-accent font-mono" /></div>
          <div><label className="text-xs text-muted">Sit-and-reach (cm)</label><input type="number" value={props.sitReachCm} onChange={e => props.setSitReachCm(e.target.value)} placeholder="5" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2 text-xs outline-none focus:border-accent font-mono" /></div>
          <div className="col-span-2"><label className="text-xs text-muted">Echilibru — un picior, ochi închiși (sec, &gt;30 = bine)</label><input type="number" value={props.balanceSec} onChange={e => props.setBalanceSec(e.target.value)} placeholder="45" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2 text-xs outline-none focus:border-accent font-mono" /></div>
        </div>
        <p className="text-xs text-accent uppercase tracking-wider mt-2">Istoric greutate</p>
        <div className="grid grid-cols-3 gap-2">
          <div><label className="text-xs text-muted">Acum 1 an (kg)</label><input type="number" step="0.1" value={props.weightOneYearAgo} onChange={e => props.setWeightOneYearAgo(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2 text-xs outline-none focus:border-accent font-mono" /></div>
          <div><label className="text-xs text-muted">Min ca adult</label><input type="number" step="0.1" value={props.weightMinAdult} onChange={e => props.setWeightMinAdult(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2 text-xs outline-none focus:border-accent font-mono" /></div>
          <div><label className="text-xs text-muted">Max ca adult</label><input type="number" step="0.1" value={props.weightMaxAdult} onChange={e => props.setWeightMaxAdult(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2 text-xs outline-none focus:border-accent font-mono" /></div>
        </div>
      </CollapseSection>

      <CollapseSection title="🧬 Istoric familial (determină prioritățile preventive)" expanded={props.basicsExpanded.family} onToggle={() => props.setBasicsExpanded(prev => ({ ...prev, family: !prev.family }))}>
        <div>
          <label className="text-xs text-muted-foreground">Părinți și bunici — în viață? Dacă au murit, la ce vârstă și din ce cauză?</label>
          <textarea
            value={props.parentsAlive}
            onChange={e => props.setParentsAlive(e.target.value)}
            rows={3}
            placeholder="ex: Tata mort la 67 din infarct, mama trăiește 72. Bunicii pe linie paternă morți în 80 din cancer."
            className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-xs outline-none focus:border-accent resize-none"
          />
        </div>
        <p className="text-xs text-muted-foreground">Membri familie (părinți, frați, bunici) cu aceste condiții:</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { val: props.familyCardio, set: props.setFamilyCardio, label: '❤️ Boli inimă / AVC' },
            { val: props.familyCancer, set: props.setFamilyCancer, label: '🎗️ Cancer' },
            { val: props.familyDiabetes, set: props.setFamilyDiabetes, label: '🩸 Diabet' },
            { val: props.familyAlzheimers, set: props.setFamilyAlzheimers, label: '🧠 Alzheimer / demență' },
            { val: props.familyAutoimmune, set: props.setFamilyAutoimmune, label: '🛡️ Autoimune' },
            { val: props.familyMental, set: props.setFamilyMental, label: '💭 Boală mentală' },
          ].map(({ val, set, label }) => (
            <button
              key={label}
              onClick={() => set(!val)}
              className={clsx('flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-left transition-all',
                val ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50' : 'bg-card border border-card-border text-muted-foreground')}
            >
              <div className={clsx('w-4 h-4 rounded border-2 flex items-center justify-center text-xs',
                val ? 'bg-amber-500 border-amber-500 text-black' : 'border-card-border')}>
                {val ? '✓' : ''}
              </div>
              {label}
            </button>
          ))}
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Ai făcut un test genetic?</label>
          <select
            value={props.geneticTestDone}
            onChange={e => props.setGeneticTestDone(e.target.value)}
            className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent"
          >
            <option value="">Încă nu</option>
            <option value="23andme">23andMe</option>
            <option value="myheritage">MyHeritage</option>
            <option value="nebula">Nebula Genomics</option>
            <option value="ancestry">Ancestry DNA</option>
            <option value="other">Altul</option>
          </select>
        </div>
      </CollapseSection>
    </div>
  );
}
