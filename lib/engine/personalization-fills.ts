// ============================================================================
// Pain-point + flex-rule generators — rich fallbacks used by BOTH
// /api/generate-protocol (manual regen) and /api/cron/daily-regenerate (3 AM).
// Keeps the two code paths in sync so the dashboard sections never go empty.
// ============================================================================

import type { UserProfile } from '@/lib/types';

export interface PainPointEntry {
  problem: string;
  likelyCause: string;
  solution: string;
  supportingBiomarkers: string[];
  expectedTimeline: string;
  checkpoints: string[];
}

export interface FlexRuleEntry {
  scenario: string;
  strategy: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pain-point classifier + catalog
// ─────────────────────────────────────────────────────────────────────────────
function classifyConcern(concern: string): string {
  const l = concern.toLowerCase();
  if (/energy|crash|tired|fog|lethargic|sluggish/.test(l)) return 'energy';
  if (/sleep|insomnia|fall asleep|wake up|restless/.test(l)) return 'sleep';
  if (/back|stiff|joint|knee|shoulder|neck|pain/.test(l)) return 'pain';
  if (/anxiety|stressed|anxious|overwhelm|burn/.test(l)) return 'stress';
  if (/mood|sad|depressed|unmotivated|down/.test(l)) return 'mood';
  if (/weight|fat|belly|heavy/.test(l)) return 'weight';
  if (/skin|acne|hair|brittle/.test(l)) return 'skin';
  if (/digest|bloat|stomach|gut|constip|ibs/.test(l)) return 'digestion';
  if (/libido|erection|sex/.test(l)) return 'libido';
  if (/hrv|recovery|overtrain/.test(l)) return 'recovery';
  return 'generic';
}

function painPointFromKind(kind: string, label: string): PainPointEntry {
  switch (kind) {
    case 'energy': return {
      problem: label,
      likelyCause: 'Post-meal glucose spikes + under-fueled mornings + cumulative sleep debt. Afternoon crashes are almost always blood-sugar + circadian driven, not caffeine withdrawal.',
      solution: 'Protein-first breakfast (≥30g). 10-min walk after every meal — drops glucose AUC ~20%. Drop ultra-processed carbs at lunch. Get 10 min direct sunlight within 30 min of waking. Magnesium glycinate 400mg at night if sleep is sub-optimal.',
      supportingBiomarkers: ['GLUC', 'HBA1C', 'INSULIN', 'VITD'],
      expectedTimeline: 'First change in 7-10 days (energy smoother), 4 weeks for full resolution',
      checkpoints: ['Rate 2-4 PM energy 1-10 daily in Smart Log', 'Compare week-1 vs week-4 averages in /statistics'],
    };
    case 'sleep': return {
      problem: label,
      likelyCause: 'Elevated evening cortisol + blue light suppressing melatonin + inconsistent bedtime. Adenosine receptors stay busy if caffeine is close to bed.',
      solution: 'Fixed bedtime ±30 min (weekends too). Screens off 90 min before bed. Magnesium glycinate 400mg + L-theanine 200mg 60 min before bed. Room cool (18-20°C), blackout dark, phone outside bedroom.',
      supportingBiomarkers: ['CORTISOL', 'MAGNE'],
      expectedTimeline: '3-7 days for first improvements, 3 weeks for stable pattern',
      checkpoints: ['Time-to-fall-asleep via Smart Log', 'Sleep score from wearable daily', 'Weekly average deep + REM minutes'],
    };
    case 'pain': return {
      problem: label,
      likelyCause: 'Prolonged sitting + weak posterior chain + suboptimal omega-3 intake driving low-grade inflammation. Pain at a single site usually traces to the opposing muscle group being weak.',
      solution: 'Hip flexor + thoracic stretch 2×/day (5 min each). Hourly stand+walk break while working. Strengthen posterior chain (deadlifts, rows, face pulls) 2×/week. Omega-3 2-3g EPA+DHA daily. Massage gun or tennis ball work on trigger points nightly.',
      supportingBiomarkers: ['HSCRP', 'OMEGA3'],
      expectedTimeline: '2-3 weeks for noticeable reduction, 8 weeks for structural improvement',
      checkpoints: ['Morning stiffness 1-10 daily', 'Pain-free range of motion test weekly'],
    };
    case 'stress': return {
      problem: label,
      likelyCause: 'Sympathetic nervous system stuck "on" — usually from chronic work stress, poor sleep, or unresolved conflict. Cortisol stays elevated, recovery stalls.',
      solution: 'Daily 10-min box breathing (4-4-4-4) in afternoon dip. Cut caffeine after 11 AM. Physiological sigh (2 inhales + long exhale) 3×/day when overwhelmed. Ashwagandha 600mg at night for 8 weeks. Hard boundary on work after dinner.',
      supportingBiomarkers: ['CORTISOL', 'HSCRP', 'HRV (wearable)'],
      expectedTimeline: '1-2 weeks noticeable, 8 weeks for HPA axis recalibration',
      checkpoints: ['Stress 1-10 daily in Smart Log', 'HRV trend via wearable', 'Resting HR AM'],
    };
    case 'mood': return {
      problem: label,
      likelyCause: 'Likely multi-factorial — some combo of: low vitamin D, sunlight deficit, gut microbiome (90% serotonin produced in gut), omega-3 deficiency, social isolation, sleep debt.',
      solution: '10-30 min morning sunlight daily. Vitamin D3 5000 IU + K2 with breakfast. Omega-3 2-3g. 3×/week cardio 30+ min. Weekly 1:1 with a human you trust. If sustained >2 weeks, consider therapy (not weakness — maintenance).',
      supportingBiomarkers: ['VITD', 'OMEGA3', 'B12', 'FOLAT'],
      expectedTimeline: '2-4 weeks, faster if vitamin D is corrected',
      checkpoints: ['Mood 1-10 daily', 'Weekly average'],
    };
    case 'weight': return {
      problem: label,
      likelyCause: 'Small chronic caloric surplus + low protein percentage + late-evening eating + low NEAT (non-exercise activity). Not about willpower — about environment + metabolic setup.',
      solution: 'Protein 1.6g per kg bodyweight daily, every meal. Eating window 10h (e.g. 10 AM - 8 PM). 8-10k steps daily minimum. Strength train 3×/week to protect muscle while losing fat. Track weight daily (morning, no clothes) — trend matters, not daily fluctuation.',
      supportingBiomarkers: ['INSULIN', 'HBA1C', 'TRIG', 'HDL'],
      expectedTimeline: '0.5-1% bodyweight per week sustainable, 12+ weeks for visible change',
      checkpoints: ['Daily weight (track 7-day average)', 'Waist circumference weekly', 'Progress photo every 4 weeks'],
    };
    case 'skin': return {
      problem: label,
      likelyCause: 'Usually gut-skin axis (microbiome imbalance), omega-3 deficiency, or chronic dehydration + low collagen-supporting micronutrients.',
      solution: 'Zinc 15mg + Vitamin C 500mg + collagen 10g daily. Omega-3 2-3g. Hydrate 3L+ water. Cut ultra-processed + high-sugar. Retinoid at night (0.025% start). SPF 30+ daily.',
      supportingBiomarkers: ['ZINC', 'VITC', 'OMEGA3'],
      expectedTimeline: '4-6 weeks for turnover to show new skin',
      checkpoints: ['Weekly photo same lighting', 'Breakout frequency'],
    };
    case 'digestion': return {
      problem: label,
      likelyCause: 'Low fiber diversity, chronic stress (gut-brain axis), possible food sensitivities, or stomach acid dysfunction.',
      solution: '30+ different plants per week (microbiome diversity). Fermented foods daily (kefir, kimchi, sauerkraut). Chew each bite 20+ times. No water 30 min around meals. Digestive enzymes if post-meal bloat. Elimination trial: dairy + gluten for 3 weeks if persistent.',
      supportingBiomarkers: ['HSCRP'],
      expectedTimeline: '2-4 weeks for noticeable change, 8+ weeks for microbiome remodeling',
      checkpoints: ['Bristol stool chart daily', 'Bloat severity 1-10'],
    };
    case 'libido': return {
      problem: label,
      likelyCause: 'Usually: low testosterone (men) / low estrogen-progesterone (women) / chronic stress + sleep debt. Not a standalone issue — tracks full metabolic + hormonal picture.',
      solution: 'Sleep 7.5-9h (testosterone peak is overnight). Strength train 3×/week (raises T short-term). Zinc 15mg + Vitamin D optimized. Reduce alcohol to <7/week. Check thyroid + sex hormones via lab panel.',
      supportingBiomarkers: ['TESTO', 'ESTRA', 'TSH', 'SHBG'],
      expectedTimeline: '4-8 weeks with full protocol',
      checkpoints: ['Libido 1-10 weekly', 'Morning erection frequency (males)'],
    };
    case 'recovery': return {
      problem: label,
      likelyCause: 'Overreaching from training load + under-recovery — sleep debt, low protein, high stress, or inadequate de-load cadence.',
      solution: 'Deload week every 6 weeks (-40% volume). Protein 1.8g/kg on training days. Prioritize sleep over an extra workout — always. Sauna 20 min 2-3×/week. Cold exposure NOT within 4h of strength training.',
      supportingBiomarkers: ['HSCRP', 'CK'],
      expectedTimeline: '2-4 weeks for HRV + RHR to normalize',
      checkpoints: ['HRV + RHR AM via wearable', 'Subjective recovery 1-10'],
    };
    default: return {
      problem: label,
      likelyCause: 'Could be multi-factorial — likely tied to sleep, stress, or metabolic signals. Track 2 weeks to find the trigger pattern.',
      solution: 'Nail the fundamentals first: sleep 7-9h, protein each meal, 30 min movement daily, stress management. Then use /statistics trends to isolate specific levers.',
      supportingBiomarkers: [],
      expectedTimeline: '4-8 weeks',
      checkpoints: ['Daily severity 1-10 in Smart Log', 'Weekly review trends'],
    };
  }
}

export function buildPainPoints(profile: UserProfile): PainPointEntry[] {
  const results: PainPointEntry[] = [];
  const od = (profile as UserProfile & { onboardingData?: Record<string, unknown> }).onboardingData || {};

  // 1) User-typed pain points — classify each and give deep solution
  if (profile.painPoints && profile.painPoints.trim().length > 0) {
    profile.painPoints.split(/[,.\n]+/).map(s => s.trim()).filter(s => s.length > 5).slice(0, 5).forEach(concern => {
      results.push(painPointFromKind(classifyConcern(concern), concern));
    });
  }

  // 2) Inferred issues from profile
  const bmi = profile.weightKg && profile.heightCm ? profile.weightKg / ((profile.heightCm / 100) ** 2) : 0;
  const sleep = profile.sleepHoursAvg ?? Number(od.sleepHours) ?? 7;
  const sleepQ = profile.sleepQuality ?? Number(od.sleepQuality) ?? 7;
  const stress = Number(od.stressLevel) || 5;
  const sitting = Number(od.sittingHours) || 6;
  const cardio = profile.cardioMinutesPerWeek ?? Number(od.cardioMin) ?? 90;
  const alc = profile.alcoholDrinksPerWeek ?? Number(od.alcoholPerWeek) ?? 0;
  const ultra = Number(od.ultraProcessedPerWeek) || 0;
  const smoker = profile.smoker ?? Boolean(od.smoker);
  const mood = Number(od.happinessScore) || 7;
  const energy = Number(od.energyLevel) || 7;

  const inferred: Array<{ kind: string; label: string }> = [];
  if (sleep < 6.5 || sleepQ <= 5) inferred.push({ kind: 'sleep', label: sleepQ <= 5 ? `Low sleep quality (you rated it ${sleepQ}/10)` : `Short sleep — averaging ${sleep}h/night` });
  if (stress >= 7) inferred.push({ kind: 'stress', label: `Chronic stress (you rated ${stress}/10)` });
  if (sitting >= 8) inferred.push({ kind: 'pain', label: `${sitting} hours of sitting daily — back and posture at risk` });
  if (cardio < 75) inferred.push({ kind: 'energy', label: `Low aerobic base (${cardio} min cardio/week) — energy + recovery suffer` });
  if (bmi >= 27) inferred.push({ kind: 'weight', label: `BMI ${bmi.toFixed(1)} — body composition optimization recommended` });
  if (ultra >= 10) inferred.push({ kind: 'energy', label: `${ultra} ultra-processed meals/week — blood sugar volatility likely` });
  if (alc >= 14) inferred.push({ kind: 'sleep', label: `${alc} drinks/week — alcohol collapsing deep sleep ~40%` });
  if (smoker) inferred.push({ kind: 'recovery', label: 'Nicotine use — driving inflammation + restricting recovery capacity' });
  if (mood <= 4) inferred.push({ kind: 'mood', label: `Low mood self-rating (${mood}/10)` });
  if (energy <= 4) inferred.push({ kind: 'energy', label: `Low energy self-rating (${energy}/10)` });

  const usedKinds = new Set(results.map(r => classifyConcern(r.problem)));
  for (const inf of inferred) {
    if (results.length >= 5) break;
    if (usedKinds.has(inf.kind)) continue;
    results.push(painPointFromKind(inf.kind, inf.label));
    usedKinds.add(inf.kind);
  }

  // 3) Universal fallback if still empty
  if (results.length === 0) {
    results.push(painPointFromKind('energy', 'Afternoon energy dip around 2-3 PM (universal)'));
    results.push(painPointFromKind('sleep', 'Inconsistent bedtime — easy win'));
    results.push(painPointFromKind('stress', 'Modern baseline stress — almost everyone benefits'));
  }

  return results.slice(0, 5);
}

// ─────────────────────────────────────────────────────────────────────────────
// Flex rule catalog
// ─────────────────────────────────────────────────────────────────────────────
const FLEX_TEMPLATES: Record<string, FlexRuleEntry> = {
  pizza: { scenario: 'Pizza night', strategy: 'Eat a protein-rich snack 30 min before (eggs, yogurt, protein shake) to kill the slice-eating drive. Start with salad at the table. 20-min walk before + 15-min walk after. Drink 500ml water between slices. Next day: 14h overnight fast + extra fiber + skip alcohol.' },
  burger: { scenario: 'Burger / fast food', strategy: 'Order single patty (not double), skip the bun if low-carb, ditch the fries for side salad or extra veggies. Walk 15 min after. Drink water, not soda. Next meal: plant-forward + high fiber to rebalance microbiome.' },
  coffee: { scenario: 'Morning coffee ritual', strategy: 'Keep it — no shame. Drink WITH breakfast (not before — coffee on empty spikes cortisol for some). Cutoff by 10-12 AM max (half-life 5-6h). Add L-theanine 200mg to smooth the peak. If you feel jittery: reduce dose before eliminating.' },
  alcohol: { scenario: 'Drinks with friends / wine with dinner', strategy: '1 glass water between each drink. Eat before drinking (protein + fat slow absorption). Cap at 2 drinks total. NAC 600mg + B-complex before bed to support liver. Skip sugary mixers — tonic, soda, juice. Zero drinks 4h before bed (alcohol collapses deep sleep ~40%).' },
  weekend: { scenario: 'Weekend social drinks', strategy: 'Front-load protein at lunch/dinner before going out. Alternate alcoholic + water drinks. Stop by 10 PM if possible. Next morning: 30 min walk in sunlight + electrolytes + skip the heavy workout.' },
  dinner_out: { scenario: 'Restaurant dinner', strategy: 'Check menu in advance if possible — pick your order before arriving. Start with a vegetable starter or salad (fiber first). Protein + vegetables is always the safe base. Ask for sauces on the side. Skip the bread basket. One dessert bite instead of the full slice — satisfies the craving.' },
  travel: { scenario: 'Travel days', strategy: 'Pre-pack: travel bottle of water, protein bar, nuts, electrolyte packets. Compression socks + walk every 1-2h on long flights. Land → 10 min sunlight immediately to reset circadian. First meal local time. Supplements in pill organizer — don\'t skip. Sleep pattern matters more than diet during travel.' },
  family_meal: { scenario: 'Family dinners (no menu control)', strategy: 'Eat protein + vegetables first — fill your plate before carbs hit. Small dessert portion if refusing is a social cost. Skip seconds. Walk after the meal (offer to help clean up → you\'re moving, not sitting). Next meal: return to plan, no guilt.' },
  stress: { scenario: 'High-stress work week', strategy: 'DOUBLE DOWN on basics: sleep 7.5+ h, protein each meal, 20-min walk even if no gym. Drop cardio intensity (Zone 2 only, no HIIT). Extra magnesium at night. Box breathing 5 min every 2h. Don\'t add new interventions during stress peaks — consistency > perfection.' },
  burnout: { scenario: 'Low-motivation / burnout days', strategy: 'Rule: do ONE thing from the protocol, even if small. A 10-min walk + protein breakfast + going to bed on time = a "win". Zero guilt. Don\'t try to compensate for missed workouts by doubling up — that leads to skipping more. Reset tomorrow.' },
  sweet: { scenario: 'Sweet tooth / dessert cravings', strategy: 'Eat one serving with a meal (not on empty stomach — spikes glucose worse). Dark chocolate 85%+ is a free pass in moderation. Frozen berries + Greek yogurt is a dessert that doesn\'t wreck you. If cravings are daily: check protein intake + sleep quality — low in either drives cravings.' },
  sodas: { scenario: 'Sodas / sweetened drinks', strategy: 'Transition step: swap regular for sparkling water + lemon. Or diet soda as middle ground. Liquid calories are the easiest win in the entire protocol — 1 can/day is ~500 kcal/week of pure sugar.' },
  late_eating: { scenario: 'Late dinner (work / social reality)', strategy: 'Keep it smaller + lighter than lunch. Stop 2.5-3h before bed minimum. Focus protein + vegetables — skip heavy carbs late. Walk 10 min after. Next day: push breakfast 1-2h later to extend the overnight fast.' },
  smoking: { scenario: 'Smoking / vaping', strategy: 'Goal is ZERO — no safe level. In the meantime: NAC 600mg daily (protects liver + lungs), extra vitamin C + E (antioxidants), avoid smoking 2h before bed (nicotine is a stimulant). Real win is quit — consider nicotine replacement therapy or Allen Carr\'s Easy Way book.' },
  generic: { scenario: '', strategy: 'Enjoy mindfully. Pair with protein + fiber to blunt glucose. Walk 10 min after. Return to normal protocol next meal. No guilt cycle.' },
};

function matchFlexTemplate(text: string): FlexRuleEntry | null {
  const l = text.toLowerCase();
  if (/pizza/.test(l)) return FLEX_TEMPLATES.pizza;
  if (/burger|fast food|mcdonald|kfc/.test(l)) return FLEX_TEMPLATES.burger;
  if (/coffee|caffeine|espresso/.test(l)) return FLEX_TEMPLATES.coffee;
  if (/wine|beer|alcohol|drinks|drink/.test(l)) return FLEX_TEMPLATES.alcohol;
  if (/weekend/.test(l)) return FLEX_TEMPLATES.weekend;
  if (/restaurant|eat out|dining/.test(l)) return FLEX_TEMPLATES.dinner_out;
  if (/travel|flight|plane|trip/.test(l)) return FLEX_TEMPLATES.travel;
  if (/family|mom|parents|dinner/.test(l)) return FLEX_TEMPLATES.family_meal;
  if (/stress|work|deadline/.test(l)) return FLEX_TEMPLATES.stress;
  if (/sweet|dessert|sugar|chocolate/.test(l)) return FLEX_TEMPLATES.sweet;
  if (/soda|cola|pepsi|sprite/.test(l)) return FLEX_TEMPLATES.sodas;
  if (/smok|cigarette|vape|tobacco/.test(l)) return FLEX_TEMPLATES.smoking;
  if (/late|evening meal/.test(l)) return FLEX_TEMPLATES.late_eating;
  return null;
}

export function buildFlexRules(profile: UserProfile): FlexRuleEntry[] {
  const results: FlexRuleEntry[] = [];
  const used = new Set<string>();
  const add = (entry: FlexRuleEntry) => {
    const key = entry.scenario.toLowerCase().slice(0, 20);
    if (used.has(key) || !entry.scenario) return;
    used.add(key);
    results.push(entry);
  };

  // 1) User-typed non-negotiables
  if (profile.nonNegotiables && profile.nonNegotiables.trim().length > 0) {
    profile.nonNegotiables.split(/[,.\n]+/).map(s => s.trim()).filter(s => s.length > 3).slice(0, 5).forEach(item => {
      const tpl = matchFlexTemplate(item);
      const scenario = item.charAt(0).toUpperCase() + item.slice(1);
      add({ scenario, strategy: tpl ? tpl.strategy : FLEX_TEMPLATES.generic.strategy });
    });
  }

  // 2) Profile-inferred
  const od = (profile as UserProfile & { onboardingData?: Record<string, unknown> }).onboardingData || {};
  const alc = profile.alcoholDrinksPerWeek ?? Number(od.alcoholPerWeek) ?? 0;
  const caff = profile.caffeineMgPerDay ?? 0;
  const smoker = profile.smoker ?? Boolean(od.smoker);
  const stress = Number(od.stressLevel) || 5;

  if (alc >= 3) add(FLEX_TEMPLATES.alcohol);
  if (caff > 0) add(FLEX_TEMPLATES.coffee);
  if (smoker) add(FLEX_TEMPLATES.smoking);
  if (stress >= 7) add(FLEX_TEMPLATES.stress);

  // 3) Universal high-frequency scenarios everyone benefits from
  add(FLEX_TEMPLATES.dinner_out);
  add(FLEX_TEMPLATES.travel);
  add(FLEX_TEMPLATES.family_meal);
  add(FLEX_TEMPLATES.burnout);
  add(FLEX_TEMPLATES.late_eating);

  return results.slice(0, 6);
}
