export interface UniversalTip {
  category: string;
  tip: string;
  why: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export const UNIVERSAL_TIPS: UniversalTip[] = [
  // Movement
  { category: 'Movement', tip: 'Walk 8,000+ steps daily', why: 'Strongest single predictor of all-cause mortality. 51% reduction vs 4,000 steps.', difficulty: 'easy' },
  { category: 'Movement', tip: 'Strength train 2-3x/week', why: 'Prevents sarcopenia (age-related muscle loss). 20% mortality reduction.', difficulty: 'medium' },
  { category: 'Movement', tip: '150 min/week Zone 2 cardio', why: 'Builds mitochondrial health. Bryan does backward sled + walks for this.', difficulty: 'medium' },
  { category: 'Movement', tip: 'Walk 5-10 min after every meal', why: 'Reduces post-meal glucose spike by up to 30%. Bryan walks after lunch.', difficulty: 'easy' },
  { category: 'Movement', tip: 'Stand up every 30 min if desk job', why: 'Sitting >8 hrs/day = same mortality risk as smoking.', difficulty: 'easy' },

  // Sleep
  { category: 'Sleep', tip: '7-9 hours every night, same time ±30 min', why: 'Sleep consistency matters as much as duration. Bryan: 8:30 PM every night.', difficulty: 'medium' },
  { category: 'Sleep', tip: 'Morning sunlight 10-15 min within first hour', why: 'Anchors circadian rhythm. Bryan uses 10,000 lux light therapy.', difficulty: 'easy' },
  { category: 'Sleep', tip: 'Screens off 60 min before bed', why: 'Blue light delays melatonin by 90 minutes. Bryan: screens off 7:30 PM.', difficulty: 'hard' },
  { category: 'Sleep', tip: 'Bedroom: 18-20°C, total darkness, quiet', why: 'Core body temp must drop 1°C to initiate sleep. Bryan uses Eight Sleep Pod.', difficulty: 'medium' },
  { category: 'Sleep', tip: 'Stop caffeine by 2 PM', why: 'Caffeine half-life is 5-7 hours. Even at 10 PM, half your noon coffee remains.', difficulty: 'medium' },
  { category: 'Sleep', tip: 'Last meal 3+ hours before bed', why: 'Digestion raises core temperature, opposing sleep onset. Bryan stops eating at 11 AM.', difficulty: 'medium' },

  // Nutrition
  { category: 'Nutrition', tip: 'Eat 30+ different plants per week', why: 'Gut microbiome diversity is the strongest predictor of metabolic health.', difficulty: 'medium' },
  { category: 'Nutrition', tip: '2-3 tbsp extra virgin olive oil daily', why: '400+ mg polyphenols/kg. Bryan takes 45ml/day. Reduces all-cause mortality 19%.', difficulty: 'easy' },
  { category: 'Nutrition', tip: 'Protein: 1.6-2.2g per kg body weight', why: 'Maintains muscle mass during aging. Most people under-eat protein.', difficulty: 'medium' },
  { category: 'Nutrition', tip: '25-35g fiber daily', why: 'Most people get 15g. Fiber feeds beneficial gut bacteria and lowers inflammation.', difficulty: 'medium' },
  { category: 'Nutrition', tip: 'Minimize ultra-processed food (<10% of calories)', why: 'Strongest dietary risk factor for all-cause mortality. Every 10% increase = 14% higher mortality.', difficulty: 'hard' },
  { category: 'Nutrition', tip: 'Hydrate: 2-3L water daily', why: 'Even mild dehydration impairs cognition and raises cortisol.', difficulty: 'easy' },

  // Mindset
  { category: 'Mindset', tip: 'Daily stress management (meditation, breathwork)', why: 'Chronic stress = elevated cortisol = accelerated aging. 10 min meditation lowers cortisol 25%.', difficulty: 'medium' },
  { category: 'Mindset', tip: 'Maintain social connections', why: 'Loneliness has the mortality equivalent of 15 cigarettes/day.', difficulty: 'medium' },
  { category: 'Mindset', tip: 'Nature exposure 120+ min/week', why: 'Reduces cortisol, blood pressure, and inflammatory markers.', difficulty: 'easy' },

  // Environment
  { category: 'Environment', tip: 'Air purifier with HEPA filter', why: 'Indoor air is often 2-5x more polluted than outdoor. PM2.5 accelerates aging.', difficulty: 'easy' },
  { category: 'Environment', tip: 'Minimize plastic food contact', why: 'BPA and phthalates are endocrine disruptors. Use glass/steel containers.', difficulty: 'easy' },
  { category: 'Environment', tip: 'Red/amber lighting 1-2 hours before bed', why: 'Prevents blue light melatonin suppression without losing functionality.', difficulty: 'medium' },

  // Oral Health
  { category: 'Oral Health', tip: 'Floss daily', why: 'Gum disease (P. gingivalis) is directly linked to cardiovascular disease and Alzheimer\'s.', difficulty: 'easy' },
  { category: 'Oral Health', tip: 'Dentist 2x/year minimum', why: 'Periodontal disease raises hsCRP and cardiovascular risk.', difficulty: 'easy' },

  // Substances
  { category: 'Substances', tip: 'Minimize alcohol (ideally zero)', why: 'No safe dose for longevity. Even 1 drink/day reduces deep sleep by ~80%.', difficulty: 'hard' },
  { category: 'Substances', tip: 'Absolute zero smoking', why: 'Single worst modifiable longevity factor. Accelerates epigenetic aging 2-3x.', difficulty: 'hard' },
];

export function getTipsByCategory(): Record<string, UniversalTip[]> {
  return UNIVERSAL_TIPS.reduce<Record<string, UniversalTip[]>>((acc, tip) => {
    (acc[tip.category] = acc[tip.category] || []).push(tip);
    return acc;
  }, {});
}
