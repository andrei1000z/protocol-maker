export type Sex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'elite';
export type DietType = 'omnivore' | 'vegetarian' | 'vegan' | 'keto' | 'carnivore' | 'mediterranean' | 'other';
export type ExperimentalLevel = 'otc_only' | 'open_rx' | 'open_experimental';
export type Classification = 'OPTIMAL' | 'SUBOPTIMAL_LOW' | 'SUBOPTIMAL_HIGH' | 'DEFICIENT' | 'EXCESS' | 'CRITICAL';

export interface UserProfile {
  age: number;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  ethnicity?: string;
  latitude?: number;
  occupation?: string;
  activityLevel: ActivityLevel;
  sleepHoursAvg?: number;
  sleepQuality?: number;
  dietType: DietType;
  alcoholDrinksPerWeek?: number;
  caffeineMgPerDay?: number;
  smoker: boolean;
  cardioMinutesPerWeek?: number;
  strengthSessionsPerWeek?: number;
  conditions: string[];
  medications: { name: string; dose: string; frequency: string }[];
  currentSupplements: string[];
  allergies: string[];
  goals: string[];
  timeBudgetMin: number;
  monthlyBudgetRon: number;
  experimentalOpenness: ExperimentalLevel;
  onboardingCompleted: boolean;
}

export interface BiomarkerValue {
  code: string;
  value: number;
  unit: string;
  classification?: Classification;
  longevityGap?: number;
}

export interface BiomarkerReference {
  code: string;
  name: string;
  shortName: string;
  category: string;
  unit: string;
  longevityOptimalLow: number;
  longevityOptimalHigh: number;
  populationAvgLow: number;
  populationAvgHigh: number;
  bryanJohnsonValue?: number;
  description: string;
  interventionsIfLow: InterventionSet;
  interventionsIfHigh: InterventionSet;
  retestIntervalWeeks: number;
}

export interface InterventionSet {
  lifestyle: string[];
  supplements: { name: string; dose: string; priority: 'MUST' | 'STRONG' | 'OPTIONAL' }[];
  foods_add: string[];
  foods_avoid: string[];
  medical: string[];
}

export interface DetectedPattern {
  name: string;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  description: string;
  triggeringMarkers: string[];
  recommendations: string[];
}

export interface ProtocolOutput {
  diagnostic: {
    biologicalAge: number;
    chronologicalAge: number;
    agingVelocity: string;
    longevityScore: number;
    topWins: string[];
    topRisks: string[];
    organSystemScores: Record<string, number>;
  };
  biomarkerReadout: {
    code: string;
    name: string;
    value: number;
    unit: string;
    classification: Classification;
    longevityOptimalRange: [number, number];
    labRange: [number, number];
    bryanValue?: number;
    whyItMatters: string;
    gap: number;
  }[];
  nutrition: {
    dailyCalories: number;
    macros: { protein: number; carbs: number; fat: number };
    eatingWindow: string;
    meals: { name: string; description: string; ingredients: string[] }[];
    foodsToAdd: { food: string; why: string }[];
    foodsToReduce: { food: string; why: string }[];
  };
  supplements: {
    name: string;
    dose: string;
    timing: string;
    form: string;
    justification: string;
    interactions: string[];
    monthlyCostRon: number;
    priority: 'MUST' | 'STRONG' | 'OPTIONAL' | 'AVOID';
  }[];
  exercise: {
    weeklyPlan: { day: string; activity: string; duration: string; intensity: string }[];
    zone2Target: number;
    strengthSessions: number;
    notes: string[];
  };
  sleep: {
    targetBedtime: string;
    windDownRoutine: string[];
    environment: string[];
    supplementsForSleep: string[];
    morningLightMinutes: number;
  };
  tracking: {
    daily: string[];
    weekly: string[];
    retestSchedule: { marker: string; weeks: number; why: string }[];
  };
  doctorDiscussion: {
    rxSuggestions: string[];
    specialistReferrals: string[];
    redFlags: string[];
  };
  experimental?: {
    peptides: string[];
    advancedTesting: string[];
    clinics: string[];
  };
  roadmap: {
    week: string;
    actions: string[];
  }[];
  shoppingList: {
    category: string;
    items: { name: string; estimatedCostRon: number; where: string; priority: string }[];
  }[];
}
