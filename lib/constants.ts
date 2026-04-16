import { QuickMeal, SupplementInfo, WatchMetric } from './types';

export const GOALS = [
  'Slăbire',
  'Masă musculară',
  'Menținere',
  'Energie & Focus',
  'Sănătate generală',
  'Performanță sportivă',
  'Somn mai bun',
  'Reducere stres',
] as const;

export const QUICK_MEALS: QuickMeal[] = [
  { name: '2 ouă (scrambled)', cal: 180, protein: 12, carbs: 2, fat: 14 },
  { name: 'Ovăz + lapte', cal: 350, protein: 12, carbs: 55, fat: 8 },
  { name: 'Piept pui + orez', cal: 450, protein: 40, carbs: 50, fat: 5 },
  { name: 'Pui + cartofi', cal: 420, protein: 35, carbs: 45, fat: 8 },
  { name: 'Somon + legume', cal: 380, protein: 35, carbs: 10, fat: 22 },
  { name: 'Iaurt grecesc + miere', cal: 200, protein: 15, carbs: 25, fat: 5 },
  { name: 'Protein shake', cal: 250, protein: 30, carbs: 15, fat: 5 },
  { name: 'Salată ton', cal: 300, protein: 30, carbs: 10, fat: 15 },
  { name: 'Paste + sos carne', cal: 500, protein: 25, carbs: 60, fat: 15 },
  { name: 'Sandwich curcan', cal: 350, protein: 25, carbs: 35, fat: 12 },
  { name: 'Orez + fasole', cal: 400, protein: 15, carbs: 65, fat: 5 },
  { name: 'Banană + unt arahide', cal: 280, protein: 8, carbs: 35, fat: 14 },
];

export const SUPPLEMENTS: SupplementInfo[] = [
  {
    name: 'Vitamina D3',
    description: 'Esențial pentru oase, imunitate și energie. Majoritatea oamenilor sunt deficienți.',
    dose: '2000-4000 IU/zi',
    timing: 'Dimineața, cu mâncare grasă',
    category: 'essential',
  },
  {
    name: 'Omega-3',
    description: 'Acizi grași esențiali pentru creier, inimă și reducerea inflamației.',
    dose: '1000-2000mg EPA+DHA/zi',
    timing: 'Cu masa principală',
    category: 'essential',
  },
  {
    name: 'Magneziu',
    description: 'Relaxare musculară, somn mai bun, reducere crampe și anxietate.',
    dose: '200-400mg/zi (bisglycinat)',
    timing: 'Seara, înainte de culcare',
    category: 'essential',
  },
  {
    name: 'Creatină',
    description: 'Cel mai studiat supliment. Crește forța, masa musculară și funcția cognitivă.',
    dose: '5g/zi (monohidrat)',
    timing: 'Oricând, zilnic',
    category: 'recommended',
  },
  {
    name: 'Zinc',
    description: 'Important pentru imunitate, testosteron și vindecare rănilor.',
    dose: '15-30mg/zi',
    timing: 'Cu mâncare, seara',
    category: 'recommended',
  },
  {
    name: 'Vitamina C',
    description: 'Antioxidant puternic, suport imunitar și producție colagen.',
    dose: '500-1000mg/zi',
    timing: 'Dimineața',
    category: 'recommended',
  },
  {
    name: 'Ashwagandha',
    description: 'Adaptogen care reduce cortizolul, stresul și îmbunătățește somnul.',
    dose: '300-600mg/zi (KSM-66)',
    timing: 'Seara',
    category: 'optional',
  },
  {
    name: 'Vitamina B Complex',
    description: 'Energie celulară, metabolism și funcție nervoasă.',
    dose: '1 capsulă/zi',
    timing: 'Dimineața, cu mâncare',
    category: 'optional',
  },
  {
    name: 'Coenzima Q10',
    description: 'Energie celulară și antioxidant. Important peste 30 ani.',
    dose: '100-200mg/zi',
    timing: 'Cu mâncare grasă',
    category: 'optional',
  },
  {
    name: 'Cafeină',
    description: 'Stimulant pentru focus și performanță fizică. Atenție la dozare.',
    dose: '100-200mg (1-2 cafele)',
    timing: 'Dimineața, nu după ora 14',
    category: 'advanced',
    ageRestriction: 16,
  },
  {
    name: 'L-Theanină',
    description: 'Aminoacid din ceai verde. Calm fără sedare, sinergic cu cafeina.',
    dose: '100-200mg/zi',
    timing: 'Cu cafeina sau seara',
    category: 'advanced',
    ageRestriction: 16,
  },
  {
    name: 'Rhodiola Rosea',
    description: 'Adaptogen pentru rezistență la stres fizic și mental.',
    dose: '200-400mg/zi',
    timing: 'Dimineața, pe stomacul gol',
    category: 'advanced',
    ageRestriction: 16,
  },
];

export const WATCH_METRICS: WatchMetric[] = [
  { id: 'sleepScore', name: 'Sleep Score', unit: 'pts', target: 85, min: 0, max: 100, group: 'sleep' },
  { id: 'deepSleep', name: 'Deep Sleep', unit: 'min', target: 90, min: 0, max: 240, group: 'sleep' },
  { id: 'rem', name: 'REM', unit: 'min', target: 90, min: 0, max: 240, group: 'sleep' },
  { id: 'sleepDuration', name: 'Durată Somn', unit: 'ore', target: 8, min: 0, max: 14, group: 'sleep' },
  { id: 'restingHR', name: 'Resting HR', unit: 'bpm', target: 60, min: 30, max: 120, group: 'cardio' },
  { id: 'hrv', name: 'HRV', unit: 'ms', target: 50, min: 0, max: 200, group: 'cardio' },
  { id: 'vo2max', name: 'VO2 Max', unit: 'ml/kg', target: 45, min: 15, max: 80, group: 'cardio' },
  { id: 'cardioRecovery', name: 'Cardio Recovery', unit: 'bpm', target: 30, min: 0, max: 80, group: 'cardio' },
  { id: 'steps', name: 'Pași', unit: '', target: 10000, min: 0, max: 50000, group: 'activity' },
  { id: 'activeMinutes', name: 'Minute Active', unit: 'min', target: 60, min: 0, max: 300, group: 'activity' },
  { id: 'caloriesBurned', name: 'Calorii Arse', unit: 'kcal', target: 500, min: 0, max: 3000, group: 'activity' },
  { id: 'bodyBattery', name: 'Body Battery', unit: 'pts', target: 80, min: 0, max: 100, group: 'wellness' },
  { id: 'spo2', name: 'SpO2', unit: '%', target: 97, min: 80, max: 100, group: 'wellness' },
  { id: 'skinTemp', name: 'Skin Temp', unit: '°C', target: 33, min: 28, max: 40, group: 'wellness' },
  { id: 'antioxidants', name: 'Antioxidanți', unit: 'pts', target: 70, min: 0, max: 100, group: 'wellness' },
];

export const SUPPLEMENT_CATEGORY_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  essential: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Esențial' },
  recommended: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Recomandat' },
  optional: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Opțional' },
  advanced: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Avansat 16+' },
};

export const METRIC_GROUP_LABELS: Record<string, string> = {
  sleep: 'Somn',
  cardio: 'Cardio',
  activity: 'Activitate',
  wellness: 'Wellness',
};

export const DEFAULT_MACRO_TARGETS = {
  calories: 2200,
  protein: 150,
  carbs: 250,
  fat: 70,
};
