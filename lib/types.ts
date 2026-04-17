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
  occupationType?: 'desk' | 'physical' | 'shift' | 'mixed';
  restingHR?: number;
  activityLevel: ActivityLevel;
  sleepHoursAvg?: number;
  sleepQuality?: number;
  bedtime?: string;
  wakeTime?: string;
  chronotype?: 'morning' | 'neutral' | 'night';
  sleepIssues?: string[];
  dietType: DietType;
  mealsPerDay?: number;
  hydrationGlasses?: number;
  foodAllergies?: string[];
  alcoholDrinksPerWeek?: number;
  caffeineMgPerDay?: number;
  smoker: boolean;
  cardioMinutesPerWeek?: number;
  strengthSessionsPerWeek?: number;
  stressLevel?: number;
  meditationPractice?: 'none' | 'occasional' | 'daily';
  conditions: string[];
  familyHistory?: string[];
  medications: { name: string; dose: string; frequency: string }[];
  currentSupplements: string[];
  allergies: string[];
  workStart?: string;
  workEnd?: string;
  workLocation?: 'home' | 'office' | 'hybrid';
  sittingHours?: number;
  exerciseWindow?: 'morning' | 'lunch' | 'evening' | 'weekends' | 'inconsistent';
  screenTime?: number;
  painPoints?: string;
  nonNegotiables?: string;
  primaryGoal?: string;
  secondaryGoals?: string[];
  specificTarget?: string;
  timelineMonths?: number;
  goals: string[];
  timeBudgetMin: number;
  monthlyBudgetRon: number;
  experimentalOpenness: ExperimentalLevel;
  onboardingCompleted: boolean;
  onboardingData?: Record<string, unknown>;
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
  sexSpecific?: boolean;
  ageAdjusted?: boolean;
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
    agingVelocityNumber?: number;
    longevityScore: number;
    summary?: string;
    topWins: string[];
    topRisks: string[];
    organSystemScores: Record<string, number>;
    organSystemsDetailed?: {
      key: string;
      label: string;
      description: string;
      score: number;
      estimated: boolean;
      drivers: string[];
      improvers: string[];
    }[];
    bryanSummary?: {
      longevityScoreGap: number;
      agingPaceGap: number;
      bioAgePctDifference: number;
      verdict: string;
      keyGaps: { marker: string; your: number | string; bryan: number | string }[];
    };
    estimatedBiomarkers?: {
      code: string;
      shortName: string;
      unit: string;
      estimatedLow: number;
      estimatedHigh: number;
      expectedClassification: 'likely_optimal' | 'likely_borderline' | 'likely_off';
      rationale: string;
    }[];
  };
  biomarkerReadout: {
    code: string;
    name: string;
    shortName?: string;
    value: number;
    unit: string;
    classification: Classification;
    longevityOptimalRange: [number, number];
    labRange: [number, number];
    bryanValue?: number;
    whyItMatters?: string;
    gap: number;
  }[];
  bryanComparison?: {
    marker: string;
    yourValue: number;
    bryanValue: number;
    gap: number;
    verdict: string;
  }[];
  nutrition: {
    dailyCalories: number;
    macros: { protein: number; carbs: number; fat: number };
    proteinPerKg?: number;
    eatingWindow: string;
    meals: { name: string; time?: string; calories?: number; description: string; recipe?: string; keyNutrients?: string; ingredients?: string[] }[];
    foodsToAdd: { food: string; why: string; frequency?: string }[];
    foodsToReduce: { food: string; why: string }[];
    hydrationLiters?: number;
    groceryListWeekly?: string[];
  };
  supplements: {
    name: string;
    dose: string;
    timing: string;
    form: string;
    withFood?: boolean;
    justification: string;
    interactions: string[];
    warnings?: string;
    monthlyCostRon: number;
    emagSearchQuery?: string;
    priority: 'MUST' | 'STRONG' | 'OPTIONAL' | 'AVOID';
    startWeek?: number;
  }[];
  exercise: {
    weeklyPlan: { day: string; activity: string; exercises?: string[]; duration: string; intensity: string; notes?: string }[];
    zone2Target: number;
    strengthSessions: number;
    hiitSessions?: number;
    dailyStepsTarget?: number;
    warmupRoutine?: string[];
    cooldownRoutine?: string[];
    progressionNotes?: string;
    notes?: string[];
  };
  sleep: {
    targetBedtime: string;
    targetWakeTime?: string;
    targetDuration?: string;
    windDownRoutine: (string | { time: string; action: string })[];
    environment: (string | { item: string; why: string; emagQuery?: string })[];
    supplementsForSleep: string[];
    morningLightMinutes: number;
    morningRoutine?: string[];
    caffeineLimit?: string;
  };
  universalTips?: {
    category: string;
    tips: { tip: string; why: string; difficulty: 'easy' | 'medium' | 'hard' }[];
  }[];
  dailySchedule?: {
    time: string;
    activity: string;
    category: string;
    duration: string;
    notes: string;
  }[];
  tracking: {
    daily: string[];
    weekly: string[];
    devices?: { name: string; why: string; estimatedCostRon: number; emagQuery?: string; priority: string }[];
    retestSchedule: { marker: string; weeks: number; why: string }[];
  };
  doctorDiscussion: {
    rxSuggestions: string[];
    specialistReferrals: string[];
    redFlags: string[];
    testsToOrder?: string[];
  };
  experimental?: {
    peptides: string[];
    advancedTesting: string[];
    clinics: string[];
  };
  roadmap: {
    week: string;
    title?: string;
    actions: string[];
  }[];
  shoppingList: {
    category: string;
    items: { name: string; estimatedCostRon: number; where: string; emagQuery?: string; priority: string; oneTimeOrMonthly?: string }[];
  }[];
  costBreakdown?: {
    monthlySupplements: number;
    monthlyFood: number;
    oneTimeEquipment: number;
    quarterlyTesting: number;
    totalMonthlyOngoing: number;
    currency: string;
  };
  painPointSolutions?: {
    problem: string;
    likelyCause: string;
    solution: string;
    expectedTimeline: string;
  }[];
  flexRules?: {
    scenario: string;
    strategy: string;
  }[];
  weekByWeekPlan?: {
    week: number;
    focus: string;
    mondayActions?: string[];
    wednesdayActions?: string[];
    fridayActions?: string[];
    weekendActions?: string[];
    endOfWeekCheck?: string[];
  }[];
  doctorQuestions?: string[];
  dailyBriefing?: {
    morningPriorities: string[];
    eveningReview: string[];
  };
  adherenceScore?: number;
}
