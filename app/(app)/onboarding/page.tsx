'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { BIOMARKER_DB, BIG_11_CODES, BIOMARKER_CATEGORIES, CATEGORY_LABELS } from '@/lib/engine/biomarkers';
import { classifyBiomarker } from '@/lib/engine/classifier';
import { SMARTWATCH_BRANDS, SMART_RING_BRANDS, HOME_EQUIPMENT } from '@/lib/engine/device-catalog';
import { CONDITIONS, FAMILY_CONDITIONS, GOALS, SLEEP_ISSUES } from '@/lib/engine/onboarding-options';
import { GeneratingScreen } from '@/components/protocol/GeneratingScreen';
import { DevicePicker } from '@/components/onboarding/DevicePicker';
import { EquipmentRow } from '@/components/onboarding/EquipmentRow';
import { CollapseSection } from '@/components/onboarding/CollapseSection';
import { Step1Basics } from '@/components/onboarding/Step1Basics';
import { Step2Biomarkers } from '@/components/onboarding/Step2Biomarkers';
import { Step3Lifestyle } from '@/components/onboarding/Step3Lifestyle';
import { Step4Schedule } from '@/components/onboarding/Step4Schedule';
import { Step5Goals } from '@/components/onboarding/Step5Goals';
import { Upload, FileText, ChevronDown, ChevronUp, Plus, X } from 'lucide-react';
import clsx from 'clsx';

const STEPS = ['De bază', 'Analize', 'Stil de viață', 'Rutină zilnică', 'Obiective'];

// Auto-save draft key — versioned so a future schema rename invalidates
// old drafts safely instead of trying to parse them against a new shape.
const ONBOARDING_DRAFT_KEY = 'protocol:onboarding-draft:v1';

// DevicePicker, EquipmentRow, CollapseSection are now in components/onboarding/.
// They're imported at the top of this file.

interface Medication { name: string; dose: string; frequency: string; }

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [restored, setRestored] = useState(false);

  // Step 1 — Basics
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [sex, setSex] = useState<'male' | 'female' | 'intersex'>('male');
  const [chromosomes, setChromosomes] = useState('');
  const [genderIdentity, setGenderIdentity] = useState('');
  const [transitioning, setTransitioning] = useState(false);
  const [transitionTo, setTransitionTo] = useState('');
  const [pregnant, setPregnant] = useState(false);
  const [pregnancyWeeks, setPregnancyWeeks] = useState('');
  const [breastfeeding, setBreastfeeding] = useState(false);
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [activityLevel, setActivityLevel] = useState(3);
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [birthCountry, setBirthCountry] = useState('');
  const [birthCity, setBirthCity] = useState('');
  const [ethnicity, setEthnicity] = useState('');
  const [occupation, setOccupation] = useState('desk');
  const [restingHR, setRestingHR] = useState('');
  const [hasBloodWork, setHasBloodWork] = useState<null | boolean>(null);

  // Step 1 — Optional body measurements
  const [waistCm, setWaistCm] = useState('');
  const [hipCm, setHipCm] = useState('');
  const [armCm, setArmCm] = useState('');
  const [thighCm, setThighCm] = useState('');
  const [bodyFatPct, setBodyFatPct] = useState('');
  const [bloodPressureSys, setBloodPressureSys] = useState('');
  const [bloodPressureDia, setBloodPressureDia] = useState('');
  const [hrv, setHrv] = useState('');
  const [vo2Max, setVo2Max] = useState('');
  const [gripStrength, setGripStrength] = useState('');
  const [cooperTest, setCooperTest] = useState('');
  const [maxPushups, setMaxPushups] = useState('');
  const [plankSec, setPlankSec] = useState('');
  const [maxSquats, setMaxSquats] = useState('');
  const [sitReachCm, setSitReachCm] = useState('');
  const [balanceSec, setBalanceSec] = useState('');

  // Step 1 — Smartwatch / ring (separate questions, each with brand + model + optional "other" free text)
  const [wearable, setWearable] = useState('none'); // legacy field, keeps existing prompt wiring working
  const [smartwatchBrand, setSmartwatchBrand] = useState('none'); // 'none' | brand name | 'Other'
  const [smartwatchModel, setSmartwatchModel] = useState('');
  const [smartwatchOther, setSmartwatchOther] = useState('');
  const [smartRingBrand, setSmartRingBrand] = useState('none');
  const [smartRingModel, setSmartRingModel] = useState('');
  const [smartRingOther, setSmartRingOther] = useState('');

  // Step 1 — Home equipment ownership (per item: 'yes' | 'no' | 'will_buy' | undefined)
  type OwnershipStatus = 'yes' | 'no' | 'will_buy';
  const [equipmentOwnership, setEquipmentOwnership] = useState<Record<string, OwnershipStatus>>({});
  // Free-text details per item (e.g. "2 purifiers, bedroom + living room")
  const [equipmentNotes, setEquipmentNotes] = useState<Record<string, string>>({});

  // Step 1 — Weight history
  const [weightOneYearAgo, setWeightOneYearAgo] = useState('');
  const [weightMinAdult, setWeightMinAdult] = useState('');
  const [weightMaxAdult, setWeightMaxAdult] = useState('');

  // Step 1 — Family history (deep)
  const [parentsAlive, setParentsAlive] = useState('');
  const [familyCardio, setFamilyCardio] = useState(false);
  const [familyCancer, setFamilyCancer] = useState(false);
  const [familyDiabetes, setFamilyDiabetes] = useState(false);
  const [familyAlzheimers, setFamilyAlzheimers] = useState(false);
  const [familyAutoimmune, setFamilyAutoimmune] = useState(false);
  const [familyMental, setFamilyMental] = useState(false);
  const [geneticTestDone, setGeneticTestDone] = useState('');

  // Step 1 — Motivation
  const [motivation, setMotivation] = useState('');
  const [discipline, setDiscipline] = useState(5);
  const [supportSystem, setSupportSystem] = useState(false);

  // Step 1 — basics expanded panels
  const [basicsExpanded, setBasicsExpanded] = useState({ location: false, identity: false, measurements: false, family: false });

  // Step 2 — Biomarkers
  const [biomarkers, setBiomarkers] = useState<Record<string, string>>({});
  const [showAllMarkers, setShowAllMarkers] = useState(false);
  const [pdfParsing, setPdfParsing] = useState(false);
  const [pdfParsed, setPdfParsed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 3 — Lifestyle
  const [sleepHours, setSleepHours] = useState('7');
  const [sleepQuality, setSleepQuality] = useState(7);
  const [bedtime, setBedtime] = useState('23:00');
  const [wakeTime, setWakeTime] = useState('07:00');
  const [chronotype, setChronotype] = useState<'morning' | 'neutral' | 'night'>('neutral');
  const [sleepIssues, setSleepIssues] = useState<string[]>([]);
  const [dietType, setDietType] = useState('omnivore');
  const [mealsPerDay, setMealsPerDay] = useState(3);
  const [hydration, setHydration] = useState(6);
  const [foodAllergies, setFoodAllergies] = useState<string[]>([]);
  const [alcoholPerWeek, setAlcoholPerWeek] = useState(0);
  const [caffeineServings, setCaffeineServings] = useState(2);
  const [smoker, setSmoker] = useState(false);
  const [cardioMin, setCardioMin] = useState(90);
  const [strengthSessions, setStrengthSessions] = useState(2);
  const [stressLevel, setStressLevel] = useState(5);
  const [meditationPractice, setMeditationPractice] = useState<'none' | 'occasional' | 'daily'>('none');
  const [conditions, setConditions] = useState<string[]>([]);
  const [familyHistory, setFamilyHistory] = useState<string[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [supplements, setSupplements] = useState('');
  // Pre-open sleep + diet: biggest levers, highest drop-off if hidden
  const [lifestyleExpanded, setLifestyleExpanded] = useState({ sleep: true, diet: true, exercise: false, mental: false, medical: false, environment: false, social: false });

  // Sleep deep
  const [lastNight1Hours, setLastNight1Hours] = useState('');
  const [lastNight1Score, setLastNight1Score] = useState('');
  const [lastNight2Hours, setLastNight2Hours] = useState('');
  const [lastNight2Score, setLastNight2Score] = useState('');
  const [lastNight3Hours, setLastNight3Hours] = useState('');
  const [lastNight3Score, setLastNight3Score] = useState('');
  const [idealBedtime, setIdealBedtime] = useState('');
  const [idealWakeTime, setIdealWakeTime] = useState('');
  const [sleepIssuesCustom, setSleepIssuesCustom] = useState('');
  const [timeToFallAsleep, setTimeToFallAsleep] = useState('');
  const [wakeUpsPerNight, setWakeUpsPerNight] = useState('');
  const [napsDaily, setNapsDaily] = useState('');
  const [sleepApneaChecked, setSleepApneaChecked] = useState('');
  const [bedroomTemp, setBedroomTemp] = useState('');
  const [phoneInBedroom, setPhoneInBedroom] = useState(false);

  // Diet deep
  const [dietTypeCustom, setDietTypeCustom] = useState('');
  const [foodAllergiesCustom, setFoodAllergiesCustom] = useState('');
  const [typicalDay, setTypicalDay] = useState('');
  const [firstMealTime, setFirstMealTime] = useState('');
  const [lastMealTime, setLastMealTime] = useState('');
  const [cooksAtHome, setCooksAtHome] = useState(50);
  const [fruitsPerDay, setFruitsPerDay] = useState('');
  const [veggiesPerDay, setVeggiesPerDay] = useState('');
  const [fishPerWeek, setFishPerWeek] = useState('');
  const [redMeatPerWeek, setRedMeatPerWeek] = useState('');
  const [ultraProcessedPerWeek, setUltraProcessedPerWeek] = useState('');
  const [fastFoodPerWeek, setFastFoodPerWeek] = useState('');
  const [coffeeCutoffTime, setCoffeeCutoffTime] = useState('');
  const [triedIF, setTriedIF] = useState(false);
  const [ifWindow, setIfWindow] = useState('');

  // Smoking / vaping / drugs
  const [smokingType, setSmokingType] = useState<'cigarettes' | 'vape' | 'both' | ''>('');
  const [cigarettesPerDay, setCigarettesPerDay] = useState('');
  const [vapePuffsPerDay, setVapePuffsPerDay] = useState('');
  const [recreationalDrugs, setRecreationalDrugs] = useState('');

  // Exercise deep
  const [fitnessLevel, setFitnessLevel] = useState(5);
  const [exercisesDone, setExercisesDone] = useState<string[]>([]);
  const [maxPullups, setMaxPullups] = useState('');
  const [squatWeight, setSquatWeight] = useState('');
  const [benchWeight, setBenchWeight] = useState('');
  const [deadliftWeight, setDeadliftWeight] = useState('');
  const [stepsPerDay, setStepsPerDay] = useState('');
  const [yogaPilates, setYogaPilates] = useState(false);
  const [injuries, setInjuries] = useState('');
  const [chronicPain, setChronicPain] = useState('');
  const [sauna, setSauna] = useState(false);
  const [iceBath, setIceBath] = useState(false);

  // Mental deep
  const [happinessScore, setHappinessScore] = useState(7);
  const [depressionSymptoms, setDepressionSymptoms] = useState(false);
  const [anxietySymptoms, setAnxietySymptoms] = useState(false);
  const [therapyNow, setTherapyNow] = useState(false);
  const [psychMeds, setPsychMeds] = useState('');
  const [topStressors, setTopStressors] = useState('');
  const [flowActivities, setFlowActivities] = useState('');
  const [lifeSenseOfPurpose, setLifeSenseOfPurpose] = useState(7);
  const [screenTimeDaily, setScreenTimeDaily] = useState('');
  const [socialMediaDaily, setSocialMediaDaily] = useState('');

  // Medical deep
  const [surgeries, setSurgeries] = useState('');
  const [hadCovid, setHadCovid] = useState(false);
  const [covidCount, setCovidCount] = useState('');
  const [longCovid, setLongCovid] = useState(false);
  const [lastBloodTestDate, setLastBloodTestDate] = useState('');
  const [lastPhysicalDate, setLastPhysicalDate] = useState('');
  const [libidoScore, setLibidoScore] = useState(5);
  const [morningErection, setMorningErection] = useState('');
  const [menstrualRegular, setMenstrualRegular] = useState('');
  const [pmsSeverity, setPmsSeverity] = useState(0);
  const [menopauseStatus, setMenopauseStatus] = useState('');
  const [hormonalContraception, setHormonalContraception] = useState(false);
  const [hadChildren, setHadChildren] = useState('');
  const [flossDaily, setFlossDaily] = useState(false);
  const [spfDaily, setSpfDaily] = useState(false);
  const [vaccinesUpToDate, setVaccinesUpToDate] = useState('');
  const [antibioticsLastYear, setAntibioticsLastYear] = useState('');
  const [redFlagsAcute, setRedFlagsAcute] = useState<string[]>([]);

  // Environment
  const [housingType, setHousingType] = useState('');
  const [pollutionLevel, setPollutionLevel] = useState('');
  const [moldAtHome, setMoldAtHome] = useState(false);
  const [airPurifier, setAirPurifier] = useState(false);
  const [waterFilter, setWaterFilter] = useState('');
  const [sunlightMinutes, setSunlightMinutes] = useState('');
  const [teflonNonstick, setTeflonNonstick] = useState(false);
  const [plasticFoodContact, setPlasticFoodContact] = useState('');

  // Social
  const [relationshipStatus, setRelationshipStatus] = useState('');
  const [relationshipSatisfaction, setRelationshipSatisfaction] = useState(7);
  const [closeFriendsCount, setCloseFriendsCount] = useState('');
  const [lonelinessLevel, setLonelinessLevel] = useState(3);
  const [pet, setPet] = useState(false);
  const [hasCommunity, setHasCommunity] = useState(false);

  // Step 4 — Day-to-Day
  const [scheduleType, setScheduleType] = useState<'school' | 'work' | 'both' | 'freelance' | 'none'>('work');
  const [workStart, setWorkStart] = useState('09:00');
  const [workEnd, setWorkEnd] = useState('18:00');
  const [workLocation, setWorkLocation] = useState<'home' | 'office' | 'hybrid'>('hybrid');
  const [activeDays, setActiveDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  const [sittingHours, setSittingHours] = useState(6);
  const [exerciseWindow, setExerciseWindow] = useState<'morning' | 'lunch' | 'evening' | 'weekends' | 'inconsistent'>('evening');
  const [gymAccess, setGymAccess] = useState<'full_gym' | 'home_gym' | 'minimal' | 'none'>('full_gym');
  const [gymEquipment, setGymEquipment] = useState<string[]>([]);
  const [screenTime, setScreenTime] = useState(6);
  const [painPoints, setPainPoints] = useState('');
  const [nonNegotiables, setNonNegotiables] = useState('');

  // Step 5 — Goals
  const [primaryGoal, setPrimaryGoal] = useState('Longevity / Healthspan');
  const [secondaryGoals, setSecondaryGoals] = useState<string[]>([]);
  const [specificTarget, setSpecificTarget] = useState('');
  const [timelineMonths, setTimelineMonths] = useState(3);
  const [timeBudget, setTimeBudget] = useState(60);
  const [monthlyBudget, setMonthlyBudget] = useState(500);
  // Default 'open_rx' so AI can discuss Rx like metformin/HRT — user can dial down to OTC-only.
  // Previous default 'otc_only' silently excluded prescription discussion (Bryan-tier protocols not available).
  const [experimental, setExperimental] = useState('open_rx');

  // Restore saved state on mount
  useEffect(() => {
    if (restored) return;
    fetch('/api/my-data').then(r => r.json()).then(d => {
      if (d.profile?.onboarding_data) {
        const od = d.profile.onboarding_data;
        const setStr = (v: unknown, setter: (s: string) => void) => { if (v !== undefined && v !== null && v !== '') setter(String(v)); };
        const setBool = (v: unknown, setter: (b: boolean) => void) => { if (typeof v === 'boolean') setter(v); };

        // Identity
        setStr(od.name, setName); setStr(od.age, setAge); setStr(od.birthDate, setBirthDate);
        if (od.sex) setSex(od.sex);
        setStr(od.chromosomes, setChromosomes); setStr(od.genderIdentity, setGenderIdentity);
        setBool(od.transitioning, setTransitioning); setStr(od.transitionTo, setTransitionTo);
        setBool(od.pregnant, setPregnant); setStr(od.pregnancyWeeks, setPregnancyWeeks);
        setBool(od.breastfeeding, setBreastfeeding);
        setStr(od.heightCm, setHeightCm); setStr(od.weightKg, setWeightKg);
        if (od.activityLevel !== undefined) setActivityLevel(od.activityLevel);
        setStr(od.country, setCountry); setStr(od.city, setCity);
        setStr(od.birthCountry, setBirthCountry); setStr(od.birthCity, setBirthCity);
        setStr(od.ethnicity, setEthnicity); setStr(od.occupation, setOccupation);
        setStr(od.restingHR, setRestingHR);
        if (od.hasBloodWork !== undefined) setHasBloodWork(od.hasBloodWork);

        // Measurements & fitness tests
        setStr(od.waistCm, setWaistCm); setStr(od.hipCm, setHipCm);
        setStr(od.armCm, setArmCm); setStr(od.thighCm, setThighCm);
        setStr(od.bodyFatPct, setBodyFatPct);
        setStr(od.bloodPressureSys, setBloodPressureSys); setStr(od.bloodPressureDia, setBloodPressureDia);
        setStr(od.hrv, setHrv); setStr(od.vo2Max, setVo2Max);
        setStr(od.gripStrength, setGripStrength); setStr(od.cooperTest, setCooperTest);
        setStr(od.maxPushups, setMaxPushups); setStr(od.plankSec, setPlankSec);
        setStr(od.maxSquats, setMaxSquats); setStr(od.sitReachCm, setSitReachCm);
        setStr(od.balanceSec, setBalanceSec);
        setStr(od.wearable, setWearable);
        setStr(od.smartwatchBrand, setSmartwatchBrand);
        setStr(od.smartwatchModel, setSmartwatchModel);
        setStr(od.smartwatchOther, setSmartwatchOther);
        setStr(od.smartRingBrand, setSmartRingBrand);
        setStr(od.smartRingModel, setSmartRingModel);
        setStr(od.smartRingOther, setSmartRingOther);
        if (od.equipmentOwnership && typeof od.equipmentOwnership === 'object') setEquipmentOwnership(od.equipmentOwnership as Record<string, OwnershipStatus>);
        if (od.equipmentNotes && typeof od.equipmentNotes === 'object') setEquipmentNotes(od.equipmentNotes as Record<string, string>);
        setStr(od.weightOneYearAgo, setWeightOneYearAgo);
        setStr(od.weightMinAdult, setWeightMinAdult); setStr(od.weightMaxAdult, setWeightMaxAdult);

        // Family history
        setStr(od.parentsAlive, setParentsAlive);
        setBool(od.familyCardio, setFamilyCardio); setBool(od.familyCancer, setFamilyCancer);
        setBool(od.familyDiabetes, setFamilyDiabetes); setBool(od.familyAlzheimers, setFamilyAlzheimers);
        setBool(od.familyAutoimmune, setFamilyAutoimmune); setBool(od.familyMental, setFamilyMental);
        setStr(od.geneticTestDone, setGeneticTestDone);

        // Motivation
        setStr(od.motivation, setMotivation);
        if (typeof od.discipline === 'number') setDiscipline(od.discipline);
        setBool(od.supportSystem, setSupportSystem);

        // Biomarkers
        if (od.biomarkers) setBiomarkers(od.biomarkers);

        // Sleep
        setStr(od.sleepHours, setSleepHours);
        if (typeof od.sleepQuality === 'number') setSleepQuality(od.sleepQuality);
        setStr(od.bedtime, setBedtime); setStr(od.wakeTime, setWakeTime);
        if (od.chronotype) setChronotype(od.chronotype);
        if (Array.isArray(od.sleepIssues)) setSleepIssues(od.sleepIssues);
        setStr(od.lastNight1Hours, setLastNight1Hours); setStr(od.lastNight1Score, setLastNight1Score);
        setStr(od.lastNight2Hours, setLastNight2Hours); setStr(od.lastNight2Score, setLastNight2Score);
        setStr(od.lastNight3Hours, setLastNight3Hours); setStr(od.lastNight3Score, setLastNight3Score);
        setStr(od.idealBedtime, setIdealBedtime); setStr(od.idealWakeTime, setIdealWakeTime);
        setStr(od.sleepIssuesCustom, setSleepIssuesCustom);
        setStr(od.timeToFallAsleep, setTimeToFallAsleep); setStr(od.wakeUpsPerNight, setWakeUpsPerNight);
        setStr(od.napsDaily, setNapsDaily); setStr(od.sleepApneaChecked, setSleepApneaChecked);
        setStr(od.bedroomTemp, setBedroomTemp); setBool(od.phoneInBedroom, setPhoneInBedroom);

        // Diet
        setStr(od.dietType, setDietType); setStr(od.dietTypeCustom, setDietTypeCustom);
        if (typeof od.mealsPerDay === 'number') setMealsPerDay(od.mealsPerDay);
        if (typeof od.hydration === 'number') setHydration(od.hydration);
        if (Array.isArray(od.foodAllergies)) setFoodAllergies(od.foodAllergies);
        setStr(od.foodAllergiesCustom, setFoodAllergiesCustom);
        setStr(od.typicalDay, setTypicalDay);
        setStr(od.firstMealTime, setFirstMealTime); setStr(od.lastMealTime, setLastMealTime);
        if (typeof od.cooksAtHome === 'number') setCooksAtHome(od.cooksAtHome);
        setStr(od.fruitsPerDay, setFruitsPerDay); setStr(od.veggiesPerDay, setVeggiesPerDay);
        setStr(od.fishPerWeek, setFishPerWeek); setStr(od.redMeatPerWeek, setRedMeatPerWeek);
        setStr(od.ultraProcessedPerWeek, setUltraProcessedPerWeek); setStr(od.fastFoodPerWeek, setFastFoodPerWeek);
        setStr(od.coffeeCutoffTime, setCoffeeCutoffTime);
        setBool(od.triedIF, setTriedIF); setStr(od.ifWindow, setIfWindow);
        if (typeof od.alcoholPerWeek === 'number') setAlcoholPerWeek(od.alcoholPerWeek);
        if (typeof od.caffeineServings === 'number') setCaffeineServings(od.caffeineServings);
        setBool(od.smoker, setSmoker);
        if (od.smokingType) setSmokingType(od.smokingType);
        setStr(od.cigarettesPerDay, setCigarettesPerDay); setStr(od.vapePuffsPerDay, setVapePuffsPerDay);
        setStr(od.recreationalDrugs, setRecreationalDrugs);

        // Exercise
        if (typeof od.cardioMin === 'number') setCardioMin(od.cardioMin);
        if (typeof od.strengthSessions === 'number') setStrengthSessions(od.strengthSessions);
        if (typeof od.fitnessLevel === 'number') setFitnessLevel(od.fitnessLevel);
        if (Array.isArray(od.exercisesDone)) setExercisesDone(od.exercisesDone);
        setStr(od.maxPullups, setMaxPullups); setStr(od.squatWeight, setSquatWeight);
        setStr(od.benchWeight, setBenchWeight); setStr(od.deadliftWeight, setDeadliftWeight);
        setStr(od.stepsPerDay, setStepsPerDay);
        setBool(od.yogaPilates, setYogaPilates);
        setStr(od.injuries, setInjuries); setStr(od.chronicPain, setChronicPain);
        setBool(od.sauna, setSauna); setBool(od.iceBath, setIceBath);

        // Mental
        if (typeof od.stressLevel === 'number') setStressLevel(od.stressLevel);
        if (od.meditationPractice) setMeditationPractice(od.meditationPractice);
        if (typeof od.happinessScore === 'number') setHappinessScore(od.happinessScore);
        setBool(od.depressionSymptoms, setDepressionSymptoms);
        setBool(od.anxietySymptoms, setAnxietySymptoms);
        setBool(od.therapyNow, setTherapyNow);
        setStr(od.psychMeds, setPsychMeds); setStr(od.topStressors, setTopStressors);
        setStr(od.flowActivities, setFlowActivities);
        if (typeof od.lifeSenseOfPurpose === 'number') setLifeSenseOfPurpose(od.lifeSenseOfPurpose);
        setStr(od.screenTimeDaily, setScreenTimeDaily); setStr(od.socialMediaDaily, setSocialMediaDaily);

        // Medical
        if (Array.isArray(od.conditions)) setConditions(od.conditions);
        if (Array.isArray(od.familyHistory)) setFamilyHistory(od.familyHistory);
        if (Array.isArray(od.medications)) setMedications(od.medications);
        setStr(od.supplements, setSupplements);
        setStr(od.surgeries, setSurgeries);
        setBool(od.hadCovid, setHadCovid); setStr(od.covidCount, setCovidCount);
        setBool(od.longCovid, setLongCovid);
        setStr(od.lastBloodTestDate, setLastBloodTestDate);
        setStr(od.lastPhysicalDate, setLastPhysicalDate);
        if (typeof od.libidoScore === 'number') setLibidoScore(od.libidoScore);
        setStr(od.morningErection, setMorningErection);
        setStr(od.menstrualRegular, setMenstrualRegular);
        if (typeof od.pmsSeverity === 'number') setPmsSeverity(od.pmsSeverity);
        setStr(od.menopauseStatus, setMenopauseStatus);
        setBool(od.hormonalContraception, setHormonalContraception);
        setStr(od.hadChildren, setHadChildren);
        setBool(od.flossDaily, setFlossDaily); setBool(od.spfDaily, setSpfDaily);
        setStr(od.vaccinesUpToDate, setVaccinesUpToDate);
        setStr(od.antibioticsLastYear, setAntibioticsLastYear);
        if (Array.isArray(od.redFlagsAcute)) setRedFlagsAcute(od.redFlagsAcute);

        // Environment
        setStr(od.housingType, setHousingType); setStr(od.pollutionLevel, setPollutionLevel);
        setBool(od.moldAtHome, setMoldAtHome); setBool(od.airPurifier, setAirPurifier);
        setStr(od.waterFilter, setWaterFilter); setStr(od.sunlightMinutes, setSunlightMinutes);
        setBool(od.teflonNonstick, setTeflonNonstick); setStr(od.plasticFoodContact, setPlasticFoodContact);

        // Social
        setStr(od.relationshipStatus, setRelationshipStatus);
        if (typeof od.relationshipSatisfaction === 'number') setRelationshipSatisfaction(od.relationshipSatisfaction);
        setStr(od.closeFriendsCount, setCloseFriendsCount);
        if (typeof od.lonelinessLevel === 'number') setLonelinessLevel(od.lonelinessLevel);
        setBool(od.pet, setPet); setBool(od.hasCommunity, setHasCommunity);

        // Work / day-to-day
        if (od.scheduleType) setScheduleType(od.scheduleType);
        setStr(od.workStart, setWorkStart); setStr(od.workEnd, setWorkEnd);
        if (od.workLocation) setWorkLocation(od.workLocation);
        if (Array.isArray(od.activeDays)) setActiveDays(od.activeDays);
        if (od.gymAccess) setGymAccess(od.gymAccess);
        if (Array.isArray(od.gymEquipment)) setGymEquipment(od.gymEquipment);
        if (typeof od.sittingHours === 'number') setSittingHours(od.sittingHours);
        if (od.exerciseWindow) setExerciseWindow(od.exerciseWindow);
        if (typeof od.screenTime === 'number') setScreenTime(od.screenTime);
        setStr(od.painPoints, setPainPoints); setStr(od.nonNegotiables, setNonNegotiables);

        // Goals
        setStr(od.primaryGoal, setPrimaryGoal);
        if (Array.isArray(od.secondaryGoals)) setSecondaryGoals(od.secondaryGoals);
        setStr(od.specificTarget, setSpecificTarget);
        if (typeof od.timelineMonths === 'number') setTimelineMonths(od.timelineMonths);
        if (typeof od.timeBudget === 'number') setTimeBudget(od.timeBudget);
        if (typeof od.monthlyBudget === 'number') setMonthlyBudget(od.monthlyBudget);
        setStr(od.experimental, setExperimental);

        if (typeof d.profile.onboarding_step === 'number' && d.profile.onboarding_step < 5) {
          setStep(d.profile.onboarding_step);
        }
      }

      // ── localStorage draft restore ──
      // If there's a newer locally-saved draft than the server copy (user filled
      // fields since the last server-sync), merge it in. Handles the common case:
      // user fills Step 2, browser crashes before they hit Next.
      try {
        const raw = localStorage.getItem(ONBOARDING_DRAFT_KEY);
        if (raw && d.profile?.onboarding_completed !== true) {
          const draft = JSON.parse(raw) as { savedAt: number; step?: number; data?: Record<string, unknown> };
          const serverSavedAt = d.profile?.updated_at ? new Date(d.profile.updated_at).getTime() : 0;
          // Only restore if draft is strictly newer than server (so server saves win on a reset flow)
          if (draft?.data && draft.savedAt > serverSavedAt) {
            const od = draft.data;
            const setStr = (v: unknown, setter: (s: string) => void) => { if (v !== undefined && v !== null && v !== '') setter(String(v)); };
            const setBool = (v: unknown, setter: (b: boolean) => void) => { if (typeof v === 'boolean') setter(v); };
            // Replay the same setters against the draft — the catalog above is the authoritative list
            setStr(od.name, setName); setStr(od.age, setAge); setStr(od.birthDate, setBirthDate);
            if (od.sex) setSex(od.sex as typeof sex);
            setStr(od.chromosomes, setChromosomes); setStr(od.genderIdentity, setGenderIdentity);
            setBool(od.transitioning, setTransitioning); setStr(od.transitionTo, setTransitionTo);
            setBool(od.pregnant, setPregnant); setStr(od.pregnancyWeeks, setPregnancyWeeks);
            setBool(od.breastfeeding, setBreastfeeding);
            setStr(od.heightCm, setHeightCm); setStr(od.weightKg, setWeightKg);
            if (typeof od.activityLevel === 'number') setActivityLevel(od.activityLevel);
            setStr(od.country, setCountry); setStr(od.city, setCity);
            setStr(od.birthCountry, setBirthCountry); setStr(od.birthCity, setBirthCity);
            setStr(od.ethnicity, setEthnicity); setStr(od.occupation, setOccupation);
            setStr(od.restingHR, setRestingHR);
            if (typeof od.hasBloodWork === 'boolean') setHasBloodWork(od.hasBloodWork);
            // Motivation (the field with highest drop-off)
            setStr(od.motivation, setMotivation);
            if (typeof od.discipline === 'number') setDiscipline(od.discipline);
            setBool(od.supportSystem, setSupportSystem);
            // Step marker — pick whichever is further along
            if (typeof draft.step === 'number' && draft.step > step) setStep(draft.step);
            if (typeof window !== 'undefined') console.info('[onboarding] restored local draft from', new Date(draft.savedAt).toISOString());
          }
        }
      } catch { /* ignore corrupt draft */ }

      setRestored(true);
    }).catch(() => setRestored(true));
  }, [restored, step]);

  // ── Auto-save draft to localStorage (debounced) ──
  // Runs after every render once hydrated. The empty-dep timer cancels on the
  // next render, so the actual write happens ~800ms after the user stops typing.
  // Key is shared across tabs so two tabs don't fight — last writer wins.
  useEffect(() => {
    if (!restored) return;
    const t = setTimeout(() => {
      try {
        const draft = {
          savedAt: Date.now(),
          step,
          data: buildOnboardingData(),
        };
        localStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify(draft));
      } catch { /* quota exceeded or SSR — silently ignore */ }
    }, 800);
    return () => clearTimeout(t);
  });  // intentionally no deps — debounces every render

  // Clear the draft on successful completion so the user doesn't see stale data
  // if they come back to /onboarding after finishing.
  const clearDraft = () => {
    try { localStorage.removeItem(ONBOARDING_DRAFT_KEY); } catch { /* ignore */ }
  };

  const activityLabels = ['Sedentar', 'Ușor', 'Moderat', 'Activ', 'Atlet'];

  const updateBiomarker = (code: string, val: string) => setBiomarkers(prev => ({ ...prev, [code]: val }));
  const toggle = <T,>(setter: (f: (p: T[]) => T[]) => void, val: T) => setter(prev => prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val]);
  const getLiveClassification = (code: string, val: string) => {
    if (!val || parseFloat(val) <= 0) return null;
    const ref = BIOMARKER_DB.find(b => b.code === code);
    if (!ref) return null;
    return classifyBiomarker({ code, value: parseFloat(val), unit: ref.unit }).classification;
  };

  const handlePdfUpload = async (file: File) => {
    setError('');
    // Validate: only PDFs, max 10MB (Groq parse cost protection + sanity)
    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Suportăm doar fișiere PDF. Încearcă un buletin Synevo / Regina Maria / MedLife.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError(`PDF-ul are ${(file.size / 1024 / 1024).toFixed(1)}MB — maxim 10MB. Încearcă varianta "compact" sau "rezumat" de la laborator.`);
      return;
    }
    if (file.size < 1024) {
      setError('PDF-ul pare prea mic (sub 1KB) — posibil corupt. Re-descarcă din portalul laboratorului.');
      return;
    }
    setPdfParsing(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/parse-bloodwork', { method: 'POST', body: formData });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'PDF parsing failed — try a different file or enter values manually below');
      }
      const { biomarkers: parsed } = await res.json();
      const newBiomarkers: Record<string, string> = {};
      for (const b of parsed || []) {
        if (b.code && b.code !== 'UNKNOWN' && b.value) newBiomarkers[b.code] = String(b.value);
      }
      if (Object.keys(newBiomarkers).length === 0) {
        throw new Error('No recognizable biomarkers found in PDF. Enter values manually below — we have detailed input fields.');
      }
      setBiomarkers(prev => ({ ...prev, ...newBiomarkers }));
      setPdfParsed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nu am putut parsa PDF-ul');
    }
    setPdfParsing(false);
  };

  const canNext = () => {
    switch (step) {
      case 0: return !!(age && parseInt(age) >= 10 && heightCm && weightKg);
      case 1: case 2: case 3: case 4: return true;
      default: return false;
    }
  };

  // Per-step validation — returns { ok, errors, firstFieldId } so we can block
  // handleNext + scroll/focus to the first broken field. Keeps error copy in RO
  // (primary locale) + child-friendly; no "must match /\d+/" jargon.
  //
  // Error keys are the DOM id attributes of the corresponding input, so
  // validateAndFocusStep can just querySelector them without any lookup table.
  const validateStep = (stepIdx: number): { ok: boolean; errors: Record<string, string>; firstFieldId?: string } => {
    const errors: Record<string, string> = {};
    if (stepIdx === 0) {
      const ageNum = parseInt(age);
      const heightNum = parseFloat(heightCm);
      const weightNum = parseFloat(weightKg);
      if (!age) errors['onb-age'] = 'Vârsta e necesară ca să ajustăm protocolul.';
      else if (!Number.isFinite(ageNum) || ageNum < 13 || ageNum > 110) errors['onb-age'] = 'Vârsta trebuie să fie între 13 și 110.';
      if (!heightCm) errors['onb-height'] = 'Înălțimea în cm e necesară.';
      else if (!Number.isFinite(heightNum) || heightNum < 100 || heightNum > 250) errors['onb-height'] = 'Înălțimea trebuie să fie între 100 și 250 cm.';
      if (!weightKg) errors['onb-weight'] = 'Greutatea în kg e necesară.';
      else if (!Number.isFinite(weightNum) || weightNum < 25 || weightNum > 350) errors['onb-weight'] = 'Greutatea trebuie să fie între 25 și 350 kg.';
    }
    // Steps 1-4 are self-contained — current flow has no hard-required fields
    // beyond step 0, and we keep it that way to minimize drop-off.
    const firstFieldId = Object.keys(errors)[0];
    return { ok: Object.keys(errors).length === 0, errors, firstFieldId };
  };

  const [stepErrors, setStepErrors] = useState<Record<string, string>>({});

  // Real completion % — counts filled fields across the whole form, not the
  // raw step index. Users see "68% completat" instead of "Step 3/5" which
  // doesn't reflect that step 2 has 40 fields and step 3 has 12.
  const completionPct = useMemo(() => {
    // Flat list of "is this filled?" checks across all meaningful fields.
    // Not exhaustive — some exotic fields like pregnancyWeeks are scoped and
    // shouldn't count against users who aren't pregnant.
    const filled = [
      !!age, !!heightCm, !!weightKg, !!country, !!city, !!ethnicity,              // basics core
      !!restingHR, !!waistCm, !!bodyFatPct, !!bloodPressureSys, !!vo2Max,          // optional measurements
      Object.values(biomarkers).filter(Boolean).length >= 3,                        // bloodwork (≥3 = worth counting)
      !!sleepHours, !!bedtime, !!wakeTime, sleepIssues.length > 0,                  // sleep
      !!dietType, !!typicalDay, !!firstMealTime, fruitsPerDay !== '' || veggiesPerDay !== '',  // diet
      cardioMin > 0, strengthSessions > 0, fitnessLevel > 0,                        // exercise
      stressLevel > 0, !!meditationPractice, happinessScore > 0,                    // mental
      conditions.length > 0, familyHistory.length > 0,                              // medical
      !!scheduleType, activeDays.length > 0, !!gymAccess,                           // schedule
      !!primaryGoal, secondaryGoals.length > 0, !!motivation, timelineMonths > 0,   // goals
      !!smartwatchBrand && smartwatchBrand !== 'none',                              // wearables
    ];
    const total = filled.length;
    const done = filled.filter(Boolean).length;
    return Math.round((done / total) * 100);
  }, [
    age, heightCm, weightKg, country, city, ethnicity, restingHR, waistCm, bodyFatPct, bloodPressureSys, vo2Max,
    biomarkers, sleepHours, bedtime, wakeTime, sleepIssues.length, dietType, typicalDay, firstMealTime,
    fruitsPerDay, veggiesPerDay, cardioMin, strengthSessions, fitnessLevel, stressLevel, meditationPractice,
    happinessScore, conditions.length, familyHistory.length, scheduleType, activeDays.length, gymAccess,
    primaryGoal, secondaryGoals.length, motivation, timelineMonths, smartwatchBrand,
  ]);

  const buildOnboardingData = () => ({
    // Identity
    name, age: parseInt(age) || 25, birthDate, sex, chromosomes, genderIdentity, transitioning, transitionTo,
    pregnant, pregnancyWeeks, breastfeeding,
    heightCm: parseFloat(heightCm) || 175, weightKg: parseFloat(weightKg) || 75,
    country, city, birthCountry, birthCity, ethnicity,
    activityLevel, occupation, restingHR: restingHR ? parseInt(restingHR) : null, hasBloodWork,
    // Optional measurements
    waistCm, hipCm, armCm, thighCm, bodyFatPct,
    bloodPressureSys, bloodPressureDia, hrv, vo2Max, gripStrength,
    cooperTest, maxPushups, plankSec, maxSquats, sitReachCm, balanceSec,
    wearable,
    // New structured wearable fields (AI reads these for capability-aware tracking)
    smartwatchBrand, smartwatchModel, smartwatchOther,
    smartRingBrand, smartRingModel, smartRingOther,
    // Home equipment ownership + notes (keys map to HOME_EQUIPMENT)
    equipmentOwnership, equipmentNotes,
    weightOneYearAgo, weightMinAdult, weightMaxAdult,
    // Family history
    parentsAlive, familyCardio, familyCancer, familyDiabetes, familyAlzheimers,
    familyAutoimmune, familyMental, geneticTestDone,
    // Motivation
    motivation, discipline, supportSystem,
    // Biomarkers
    biomarkers,
    // Sleep (core + deep)
    sleepHours: parseFloat(sleepHours), sleepQuality, bedtime, wakeTime, chronotype, sleepIssues,
    lastNight1Hours, lastNight1Score, lastNight2Hours, lastNight2Score, lastNight3Hours, lastNight3Score,
    idealBedtime, idealWakeTime, sleepIssuesCustom, timeToFallAsleep, wakeUpsPerNight, napsDaily,
    sleepApneaChecked, bedroomTemp, phoneInBedroom,
    // Diet (core + deep)
    dietType, dietTypeCustom, mealsPerDay, hydration, foodAllergies, foodAllergiesCustom,
    typicalDay, firstMealTime, lastMealTime, cooksAtHome,
    fruitsPerDay, veggiesPerDay, fishPerWeek, redMeatPerWeek, ultraProcessedPerWeek, fastFoodPerWeek,
    coffeeCutoffTime, triedIF, ifWindow,
    alcoholPerWeek, caffeineServings, smoker, smokingType, cigarettesPerDay, vapePuffsPerDay, recreationalDrugs,
    // Exercise (core + deep)
    cardioMin, strengthSessions, fitnessLevel, exercisesDone,
    maxPullups, squatWeight, benchWeight, deadliftWeight, stepsPerDay, yogaPilates,
    injuries, chronicPain, sauna, iceBath,
    // Mental
    stressLevel, meditationPractice, happinessScore, depressionSymptoms, anxietySymptoms,
    therapyNow, psychMeds, topStressors, flowActivities, lifeSenseOfPurpose,
    screenTimeDaily, socialMediaDaily,
    // Medical
    conditions, familyHistory, medications, supplements,
    surgeries, hadCovid, covidCount, longCovid,
    lastBloodTestDate, lastPhysicalDate,
    libidoScore, morningErection, menstrualRegular, pmsSeverity, menopauseStatus,
    hormonalContraception, hadChildren, flossDaily, spfDaily,
    vaccinesUpToDate, antibioticsLastYear, redFlagsAcute,
    // Environment
    housingType, pollutionLevel, moldAtHome, airPurifier, waterFilter, sunlightMinutes,
    teflonNonstick, plasticFoodContact,
    // Social
    relationshipStatus, relationshipSatisfaction, closeFriendsCount, lonelinessLevel, pet, hasCommunity,
    // Work / Day-to-day
    scheduleType, workStart, workEnd, workLocation, activeDays, gymAccess, gymEquipment,
    sittingHours, exerciseWindow, screenTime,
    painPoints, nonNegotiables,
    // Goals
    primaryGoal, secondaryGoals, specificTarget, timelineMonths,
    timeBudget, monthlyBudget, experimental,
  });

  const buildProfileData = (completed = false, stepNum = step) => {
    const data = buildOnboardingData();
    return {
      age: data.age, sex, heightCm: data.heightCm, weightKg: data.weightKg,
      activityLevel: ['sedentary', 'light', 'moderate', 'active', 'elite'][activityLevel],
      occupation, ethnicity,
      sleepHoursAvg: data.sleepHours, sleepQuality, dietType,
      alcoholDrinksPerWeek: alcoholPerWeek, caffeineMgPerDay: caffeineServings * 80,
      smoker, cardioMinutesPerWeek: cardioMin, strengthSessionsPerWeek: strengthSessions,
      conditions,
      medications: medications.filter(m => m.name.trim()),
      currentSupplements: supplements.split(',').map(s => s.trim()).filter(Boolean),
      allergies: foodAllergies,
      goals: [primaryGoal, ...secondaryGoals].filter(Boolean),
      timeBudgetMin: timeBudget, monthlyBudgetRon: monthlyBudget,
      experimentalOpenness: experimental,
      onboardingCompleted: completed, onboardingStep: stepNum,
      onboardingData: data,
    };
  };

  // Auto-save toast — flashes "Saved ✓" after each Next so users see the system is capturing their answers
  const [savedToast, setSavedToast] = useState(false);
  const triggerSaved = () => { setSavedToast(true); setTimeout(() => setSavedToast(false), 1800); };

  const saveProgress = async (stepNum: number) => {
    await fetch('/api/save-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildProfileData(false, stepNum)),
    });
  };

  const handleNext = async () => {
    // Validate BEFORE we save — no point persisting an invalid state only to
    // bounce the user back with an error. Scrolls + focuses the first broken
    // field so the user doesn't have to hunt for what's wrong.
    const { ok, errors, firstFieldId } = validateStep(step);
    setStepErrors(errors);
    if (!ok) {
      if (firstFieldId) {
        const el = document.getElementById(firstFieldId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          (el as HTMLInputElement).focus({ preventScroll: true });
        }
      }
      return;
    }
    if (step === 0 && hasBloodWork === false) { await saveProgress(0); setStep(2); triggerSaved(); return; }
    await saveProgress(step + 1);
    setStep(step + 1);
    triggerSaved();
  };

  const handleBack = () => {
    if (step === 2 && hasBloodWork === false) { setStep(0); return; }
    setStep(Math.max(0, step - 1));
  };

  // Red-flag hard-stop: if user reported acute symptoms, block finish until they
  // explicitly acknowledge that an AI protocol is NOT a substitute for a doctor.
  const [redFlagAck, setRedFlagAck] = useState(false);
  const [showRedFlagModal, setShowRedFlagModal] = useState(false);

  // Review-before-generate modal. Users spend 10+ minutes filling onboarding
  // and then a single click fires off an expensive AI call — a review step
  // catches typos (age 3 vs 30), missing sleep data, and forgotten meds
  // before the first protocol is written. Opens on the last-step CTA.
  const [showReview, setShowReview] = useState(false);

  // `generationComplete` drives GeneratingScreen's fast-forward. Flipping it
  // to true tells the loader the server confirmed the save, so it should
  // cascade the remaining steps and fire onDone. Without this coupling the
  // user would see "100% done" while the POST is still in flight (or "33%"
  // long after it returned) depending on Claude's latency.
  const [generationComplete, setGenerationComplete] = useState(false);

  const handleFinish = async () => {
    // Hard-stop check before anything else
    if (redFlagsAcute.length > 0 && !redFlagAck) {
      setShowRedFlagModal(true);
      return;
    }
    setLoading(true);
    setGenerationComplete(false);
    setError('');

    const biomarkerValues = Object.entries(biomarkers)
      .filter(([, v]) => v && parseFloat(v) > 0)
      .map(([code, v]) => {
        const ref = BIOMARKER_DB.find(b => b.code === code);
        return { code, value: parseFloat(v), unit: ref?.unit || '' };
      });

    const profileData = buildProfileData(true, 5);

    try {
      await fetch('/api/save-profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profileData) });
      if (biomarkerValues.length > 0) {
        await fetch('/api/save-bloodtest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ biomarkers: biomarkerValues }) });
      }
      const genRes = await fetch('/api/generate-protocol', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: profileData, biomarkers: biomarkerValues }),
      });
      if (!genRes.ok) {
        const err = await genRes.json().catch(() => ({}));
        throw new Error(err.error || `Generarea protocolului a eșuat (${genRes.status})`);
      }
      // Clear the local draft so a subsequent visit to /onboarding starts fresh
      // rather than rehydrating completed-state answers.
      clearDraft();
      // Tell GeneratingScreen to fast-forward; it will fire onDone once the
      // final "ready" step has been held long enough to read.
      setGenerationComplete(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eroare. Încearcă din nou.');
      setLoading(false);
      setGenerationComplete(false);
    }
  };

  const addMedication = () => setMedications(prev => [...prev, { name: '', dose: '', frequency: 'daily' }]);
  const updateMed = (i: number, field: keyof Medication, val: string) => setMedications(prev => prev.map((m, idx) => idx === i ? { ...m, [field]: val } : m));
  const removeMed = (i: number) => setMedications(prev => prev.filter((_, idx) => idx !== i));

  if (loading) return (
    <GeneratingScreen
      completed={generationComplete}
      onDone={() => { window.location.href = '/dashboard'; }}
    />
  );
  if (!restored) return <div className="flex items-center justify-center min-h-dvh"><div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>;

  const markersToShowBig11 = BIOMARKER_DB.filter(b => BIG_11_CODES.includes(b.code));
  const filledCount = Object.values(biomarkers).filter(Boolean).length;

  return (
    <div className="min-h-dvh flex flex-col">
      <div className="px-6 pt-6 pb-4 max-w-2xl mx-auto w-full">
        <div className="flex gap-1">
          {STEPS.map((s, i) => (
            <div key={s} className="flex-1 flex flex-col items-center gap-1">
              <div className={clsx('h-1 w-full rounded-full transition-all', i <= step ? 'bg-accent' : 'bg-card-border')} />
              <span className={clsx('text-xs', i <= step ? 'text-accent' : 'text-muted')}>{s}</span>
            </div>
          ))}
        </div>
        {/* Real completion % — counts filled fields across all 5 steps. Gives
            the user something more honest than "step 3 of 5" (which would say
            60% while step 2 has 40 fields unfilled). */}
        <p className="text-xs text-muted mt-2 font-mono">{completionPct}% completat</p>
      </div>

      <div className="flex-1 px-6 pb-40 max-w-2xl mx-auto w-full overflow-y-auto">
        {/* STEP 0 — Basics */}
        {step === 0 && (
          <Step1Basics
            name={name} setName={setName}
            age={age} setAge={setAge}
            birthDate={birthDate} setBirthDate={setBirthDate}
            heightCm={heightCm} setHeightCm={setHeightCm}
            weightKg={weightKg} setWeightKg={setWeightKg}
            stepErrors={stepErrors} setStepErrors={setStepErrors}
            activityLevel={activityLevel} setActivityLevel={setActivityLevel}
            activityLabels={activityLabels}
            wearable={wearable} setWearable={setWearable}
            smartwatchBrand={smartwatchBrand} setSmartwatchBrand={setSmartwatchBrand}
            smartwatchModel={smartwatchModel} setSmartwatchModel={setSmartwatchModel}
            smartwatchOther={smartwatchOther} setSmartwatchOther={setSmartwatchOther}
            smartRingBrand={smartRingBrand} setSmartRingBrand={setSmartRingBrand}
            smartRingModel={smartRingModel} setSmartRingModel={setSmartRingModel}
            smartRingOther={smartRingOther} setSmartRingOther={setSmartRingOther}
            equipmentOwnership={equipmentOwnership} setEquipmentOwnership={setEquipmentOwnership}
            equipmentNotes={equipmentNotes} setEquipmentNotes={setEquipmentNotes}
            hasBloodWork={hasBloodWork} setHasBloodWork={setHasBloodWork}
            motivation={motivation} setMotivation={setMotivation}
            discipline={discipline} setDiscipline={setDiscipline}
            supportSystem={supportSystem} setSupportSystem={setSupportSystem}
            basicsExpanded={basicsExpanded} setBasicsExpanded={setBasicsExpanded}
            sex={sex} setSex={setSex}
            chromosomes={chromosomes} setChromosomes={setChromosomes}
            genderIdentity={genderIdentity} setGenderIdentity={setGenderIdentity}
            transitioning={transitioning} setTransitioning={setTransitioning}
            transitionTo={transitionTo} setTransitionTo={setTransitionTo}
            pregnant={pregnant} setPregnant={setPregnant}
            pregnancyWeeks={pregnancyWeeks} setPregnancyWeeks={setPregnancyWeeks}
            breastfeeding={breastfeeding} setBreastfeeding={setBreastfeeding}
            ethnicity={ethnicity} setEthnicity={setEthnicity}
            occupation={occupation} setOccupation={setOccupation}
            restingHR={restingHR} setRestingHR={setRestingHR}
            country={country} setCountry={setCountry}
            city={city} setCity={setCity}
            birthCountry={birthCountry} setBirthCountry={setBirthCountry}
            birthCity={birthCity} setBirthCity={setBirthCity}
            waistCm={waistCm} setWaistCm={setWaistCm}
            hipCm={hipCm} setHipCm={setHipCm}
            armCm={armCm} setArmCm={setArmCm}
            thighCm={thighCm} setThighCm={setThighCm}
            bodyFatPct={bodyFatPct} setBodyFatPct={setBodyFatPct}
            vo2Max={vo2Max} setVo2Max={setVo2Max}
            bloodPressureSys={bloodPressureSys} setBloodPressureSys={setBloodPressureSys}
            bloodPressureDia={bloodPressureDia} setBloodPressureDia={setBloodPressureDia}
            hrv={hrv} setHrv={setHrv}
            gripStrength={gripStrength} setGripStrength={setGripStrength}
            cooperTest={cooperTest} setCooperTest={setCooperTest}
            maxPushups={maxPushups} setMaxPushups={setMaxPushups}
            plankSec={plankSec} setPlankSec={setPlankSec}
            maxSquats={maxSquats} setMaxSquats={setMaxSquats}
            sitReachCm={sitReachCm} setSitReachCm={setSitReachCm}
            balanceSec={balanceSec} setBalanceSec={setBalanceSec}
            weightOneYearAgo={weightOneYearAgo} setWeightOneYearAgo={setWeightOneYearAgo}
            weightMinAdult={weightMinAdult} setWeightMinAdult={setWeightMinAdult}
            weightMaxAdult={weightMaxAdult} setWeightMaxAdult={setWeightMaxAdult}
            parentsAlive={parentsAlive} setParentsAlive={setParentsAlive}
            familyCardio={familyCardio} setFamilyCardio={setFamilyCardio}
            familyCancer={familyCancer} setFamilyCancer={setFamilyCancer}
            familyDiabetes={familyDiabetes} setFamilyDiabetes={setFamilyDiabetes}
            familyAlzheimers={familyAlzheimers} setFamilyAlzheimers={setFamilyAlzheimers}
            familyAutoimmune={familyAutoimmune} setFamilyAutoimmune={setFamilyAutoimmune}
            familyMental={familyMental} setFamilyMental={setFamilyMental}
            geneticTestDone={geneticTestDone} setGeneticTestDone={setGeneticTestDone}
          />
        )}

        {/* STEP 1 — Blood Work */}
        {step === 1 && (
          <Step2Biomarkers
            biomarkers={biomarkers}
            showAllMarkers={showAllMarkers}
            setShowAllMarkers={setShowAllMarkers}
            pdfParsing={pdfParsing}
            pdfParsed={pdfParsed}
            filledCount={filledCount}
            markersToShowBig11={markersToShowBig11}
            fileInputRef={fileInputRef}
            handlePdfUpload={handlePdfUpload}
            updateBiomarker={updateBiomarker}
            getLiveClassification={getLiveClassification}
          />
        )}

        {/* STEP 2 — Lifestyle */}
        {step === 2 && (
          <Step3Lifestyle
            lifestyleExpanded={lifestyleExpanded} setLifestyleExpanded={setLifestyleExpanded}
            wearable={wearable}
            sex={sex}
            toggle={toggle}
            sleepHours={sleepHours} setSleepHours={setSleepHours}
            sleepQuality={sleepQuality} setSleepQuality={setSleepQuality}
            bedtime={bedtime} setBedtime={setBedtime}
            wakeTime={wakeTime} setWakeTime={setWakeTime}
            idealBedtime={idealBedtime} setIdealBedtime={setIdealBedtime}
            idealWakeTime={idealWakeTime} setIdealWakeTime={setIdealWakeTime}
            lastNight1Hours={lastNight1Hours} setLastNight1Hours={setLastNight1Hours}
            lastNight1Score={lastNight1Score} setLastNight1Score={setLastNight1Score}
            lastNight2Hours={lastNight2Hours} setLastNight2Hours={setLastNight2Hours}
            lastNight2Score={lastNight2Score} setLastNight2Score={setLastNight2Score}
            lastNight3Hours={lastNight3Hours} setLastNight3Hours={setLastNight3Hours}
            lastNight3Score={lastNight3Score} setLastNight3Score={setLastNight3Score}
            chronotype={chronotype} setChronotype={setChronotype}
            timeToFallAsleep={timeToFallAsleep} setTimeToFallAsleep={setTimeToFallAsleep}
            wakeUpsPerNight={wakeUpsPerNight} setWakeUpsPerNight={setWakeUpsPerNight}
            napsDaily={napsDaily} setNapsDaily={setNapsDaily}
            bedroomTemp={bedroomTemp} setBedroomTemp={setBedroomTemp}
            sleepApneaChecked={sleepApneaChecked} setSleepApneaChecked={setSleepApneaChecked}
            phoneInBedroom={phoneInBedroom} setPhoneInBedroom={setPhoneInBedroom}
            sleepIssues={sleepIssues} setSleepIssues={setSleepIssues}
            sleepIssuesCustom={sleepIssuesCustom} setSleepIssuesCustom={setSleepIssuesCustom}
            dietType={dietType} setDietType={setDietType}
            dietTypeCustom={dietTypeCustom} setDietTypeCustom={setDietTypeCustom}
            mealsPerDay={mealsPerDay} setMealsPerDay={setMealsPerDay}
            hydration={hydration} setHydration={setHydration}
            firstMealTime={firstMealTime} setFirstMealTime={setFirstMealTime}
            lastMealTime={lastMealTime} setLastMealTime={setLastMealTime}
            typicalDay={typicalDay} setTypicalDay={setTypicalDay}
            cooksAtHome={cooksAtHome} setCooksAtHome={setCooksAtHome}
            fruitsPerDay={fruitsPerDay} setFruitsPerDay={setFruitsPerDay}
            veggiesPerDay={veggiesPerDay} setVeggiesPerDay={setVeggiesPerDay}
            fishPerWeek={fishPerWeek} setFishPerWeek={setFishPerWeek}
            redMeatPerWeek={redMeatPerWeek} setRedMeatPerWeek={setRedMeatPerWeek}
            ultraProcessedPerWeek={ultraProcessedPerWeek} setUltraProcessedPerWeek={setUltraProcessedPerWeek}
            fastFoodPerWeek={fastFoodPerWeek} setFastFoodPerWeek={setFastFoodPerWeek}
            foodAllergies={foodAllergies} setFoodAllergies={setFoodAllergies}
            foodAllergiesCustom={foodAllergiesCustom} setFoodAllergiesCustom={setFoodAllergiesCustom}
            alcoholPerWeek={alcoholPerWeek} setAlcoholPerWeek={setAlcoholPerWeek}
            caffeineServings={caffeineServings} setCaffeineServings={setCaffeineServings}
            coffeeCutoffTime={coffeeCutoffTime} setCoffeeCutoffTime={setCoffeeCutoffTime}
            triedIF={triedIF} setTriedIF={setTriedIF}
            ifWindow={ifWindow} setIfWindow={setIfWindow}
            smoker={smoker} setSmoker={setSmoker}
            smokingType={smokingType} setSmokingType={setSmokingType}
            cigarettesPerDay={cigarettesPerDay} setCigarettesPerDay={setCigarettesPerDay}
            vapePuffsPerDay={vapePuffsPerDay} setVapePuffsPerDay={setVapePuffsPerDay}
            recreationalDrugs={recreationalDrugs} setRecreationalDrugs={setRecreationalDrugs}
            cardioMin={cardioMin} setCardioMin={setCardioMin}
            strengthSessions={strengthSessions} setStrengthSessions={setStrengthSessions}
            stepsPerDay={stepsPerDay} setStepsPerDay={setStepsPerDay}
            fitnessLevel={fitnessLevel} setFitnessLevel={setFitnessLevel}
            exercisesDone={exercisesDone} setExercisesDone={setExercisesDone}
            maxPullups={maxPullups} setMaxPullups={setMaxPullups}
            squatWeight={squatWeight} setSquatWeight={setSquatWeight}
            benchWeight={benchWeight} setBenchWeight={setBenchWeight}
            deadliftWeight={deadliftWeight} setDeadliftWeight={setDeadliftWeight}
            yogaPilates={yogaPilates} setYogaPilates={setYogaPilates}
            sauna={sauna} setSauna={setSauna}
            iceBath={iceBath} setIceBath={setIceBath}
            injuries={injuries} setInjuries={setInjuries}
            chronicPain={chronicPain} setChronicPain={setChronicPain}
            stressLevel={stressLevel} setStressLevel={setStressLevel}
            happinessScore={happinessScore} setHappinessScore={setHappinessScore}
            lifeSenseOfPurpose={lifeSenseOfPurpose} setLifeSenseOfPurpose={setLifeSenseOfPurpose}
            meditationPractice={meditationPractice} setMeditationPractice={setMeditationPractice}
            depressionSymptoms={depressionSymptoms} setDepressionSymptoms={setDepressionSymptoms}
            anxietySymptoms={anxietySymptoms} setAnxietySymptoms={setAnxietySymptoms}
            therapyNow={therapyNow} setTherapyNow={setTherapyNow}
            psychMeds={psychMeds} setPsychMeds={setPsychMeds}
            topStressors={topStressors} setTopStressors={setTopStressors}
            flowActivities={flowActivities} setFlowActivities={setFlowActivities}
            screenTimeDaily={screenTimeDaily} setScreenTimeDaily={setScreenTimeDaily}
            socialMediaDaily={socialMediaDaily} setSocialMediaDaily={setSocialMediaDaily}
            conditions={conditions} setConditions={setConditions}
            familyHistory={familyHistory} setFamilyHistory={setFamilyHistory}
            medications={medications} addMedication={addMedication}
            removeMed={removeMed} updateMed={updateMed}
            supplements={supplements} setSupplements={setSupplements}
            surgeries={surgeries} setSurgeries={setSurgeries}
            lastBloodTestDate={lastBloodTestDate} setLastBloodTestDate={setLastBloodTestDate}
            lastPhysicalDate={lastPhysicalDate} setLastPhysicalDate={setLastPhysicalDate}
            hadCovid={hadCovid} setHadCovid={setHadCovid}
            covidCount={covidCount} setCovidCount={setCovidCount}
            longCovid={longCovid} setLongCovid={setLongCovid}
            antibioticsLastYear={antibioticsLastYear} setAntibioticsLastYear={setAntibioticsLastYear}
            vaccinesUpToDate={vaccinesUpToDate} setVaccinesUpToDate={setVaccinesUpToDate}
            libidoScore={libidoScore} setLibidoScore={setLibidoScore}
            morningErection={morningErection} setMorningErection={setMorningErection}
            menstrualRegular={menstrualRegular} setMenstrualRegular={setMenstrualRegular}
            pmsSeverity={pmsSeverity} setPmsSeverity={setPmsSeverity}
            menopauseStatus={menopauseStatus} setMenopauseStatus={setMenopauseStatus}
            hormonalContraception={hormonalContraception} setHormonalContraception={setHormonalContraception}
            hadChildren={hadChildren} setHadChildren={setHadChildren}
            flossDaily={flossDaily} setFlossDaily={setFlossDaily}
            spfDaily={spfDaily} setSpfDaily={setSpfDaily}
            redFlagsAcute={redFlagsAcute} setRedFlagsAcute={setRedFlagsAcute}
            housingType={housingType} setHousingType={setHousingType}
            pollutionLevel={pollutionLevel} setPollutionLevel={setPollutionLevel}
            moldAtHome={moldAtHome} setMoldAtHome={setMoldAtHome}
            airPurifier={airPurifier} setAirPurifier={setAirPurifier}
            teflonNonstick={teflonNonstick} setTeflonNonstick={setTeflonNonstick}
            waterFilter={waterFilter} setWaterFilter={setWaterFilter}
            plasticFoodContact={plasticFoodContact} setPlasticFoodContact={setPlasticFoodContact}
            sunlightMinutes={sunlightMinutes} setSunlightMinutes={setSunlightMinutes}
            relationshipStatus={relationshipStatus} setRelationshipStatus={setRelationshipStatus}
            relationshipSatisfaction={relationshipSatisfaction} setRelationshipSatisfaction={setRelationshipSatisfaction}
            closeFriendsCount={closeFriendsCount} setCloseFriendsCount={setCloseFriendsCount}
            lonelinessLevel={lonelinessLevel} setLonelinessLevel={setLonelinessLevel}
            pet={pet} setPet={setPet}
            hasCommunity={hasCommunity} setHasCommunity={setHasCommunity}
          />
        )}

        {/* STEP 3 — Day-to-Day */}
        {step === 3 && (
          <Step4Schedule
            scheduleType={scheduleType}
            setScheduleType={setScheduleType}
            workStart={workStart}
            setWorkStart={setWorkStart}
            workEnd={workEnd}
            setWorkEnd={setWorkEnd}
            workLocation={workLocation}
            setWorkLocation={setWorkLocation}
            activeDays={activeDays}
            setActiveDays={setActiveDays}
            gymAccess={gymAccess}
            setGymAccess={setGymAccess}
            gymEquipment={gymEquipment}
            setGymEquipment={setGymEquipment}
            sittingHours={sittingHours}
            setSittingHours={setSittingHours}
            exerciseWindow={exerciseWindow}
            setExerciseWindow={setExerciseWindow}
            screenTime={screenTime}
            setScreenTime={setScreenTime}
            painPoints={painPoints}
            setPainPoints={setPainPoints}
            nonNegotiables={nonNegotiables}
            setNonNegotiables={setNonNegotiables}
          />
        )}

        {/* STEP 4 — Goals */}
        {step === 4 && (
          <Step5Goals
            primaryGoal={primaryGoal}
            setPrimaryGoal={setPrimaryGoal}
            secondaryGoals={secondaryGoals}
            setSecondaryGoals={setSecondaryGoals}
            specificTarget={specificTarget}
            setSpecificTarget={setSpecificTarget}
            timelineMonths={timelineMonths}
            setTimelineMonths={setTimelineMonths}
            timeBudget={timeBudget}
            setTimeBudget={setTimeBudget}
            monthlyBudget={monthlyBudget}
            setMonthlyBudget={setMonthlyBudget}
            experimental={experimental}
            setExperimental={setExperimental}
            error={error}
          />
        )}
      </div>

      {/* Auto-save toast — brief pulse after each Next so the user sees their progress is saved */}
      {savedToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[55] bg-accent/15 border border-accent/40 text-accent text-xs font-medium px-3.5 py-1.5 rounded-full backdrop-blur-sm animate-fade-in-up pointer-events-none">
          ✓ Salvat
        </div>
      )}

      {/* Keyboard-inset-aware footer: iOS Safari overlays the keyboard on top
          of fixed-bottom elements — without env(keyboard-inset-height), the
          Next/Generate button on the last step gets occluded by the keyboard
          while the user is still editing the previous input. Compose with
          safe-area so notch-devices keep their bottom padding. */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-t border-card-border px-6 py-4 flex gap-3 justify-center"
        style={{ paddingBottom: 'calc(1rem + max(env(keyboard-inset-height, 0px), env(safe-area-inset-bottom, 0px)))' }}
      >
        <div className="max-w-2xl w-full flex gap-3">
        {step > 0 && (
          <button onClick={handleBack} className="px-4 py-3 rounded-xl bg-card border border-card-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">← Înapoi</button>
        )}
        <button
          onClick={() => step < 4 ? handleNext() : setShowReview(true)}
          disabled={!canNext() || loading}
          className="flex-1 py-3 rounded-xl bg-accent text-black font-semibold text-sm transition-all hover:bg-accent-dim active:scale-[0.98] disabled:opacity-40">
          {step < 4 ? 'Continuă →' : 'Verifică răspunsurile →'}
        </button>
        </div>
      </div>

      {/* RED FLAG HARD-STOP MODAL — legal + ethical block before AI protocol if user reported acute symptoms */}
      {showRedFlagModal && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center animate-fade-in">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowRedFlagModal(false)} />
          <div className="relative bg-surface-1 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md mx-0 sm:mx-4 p-6 sm:p-7 space-y-5 border border-card-border animate-fade-in-up">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
              <span className="text-2xl">⚠️</span>
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Du-te întâi la medic</h2>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                Ai raportat {redFlagsAcute.length === 1 ? 'un simptom care are' : `${redFlagsAcute.length} simptome care au`} nevoie de evaluare medicală reală:
              </p>
              <ul className="mt-3 space-y-1 pl-1">
                {redFlagsAcute.map(f => (
                  <li key={f} className="text-xs text-foreground/95 flex gap-1.5"><span className="text-danger">·</span>{f}</li>
                ))}
              </ul>
              <p className="text-sm text-foreground/95 mt-4 leading-relaxed">
                An AI protocol is <strong>not</strong> a substitute for a doctor when symptoms like these are present. Please book an appointment <strong>this week</strong>.
              </p>
            </div>

            <label className={clsx('flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors',
              redFlagAck ? 'bg-amber-500/10 border-amber-500/40' : 'bg-surface-2 border-card-border hover:border-card-border-hover')}>
              <div className={clsx('mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all',
                redFlagAck ? 'bg-warning border-warning' : 'border-card-border')}>
                {redFlagAck && <span className="text-black text-xs font-bold">✓</span>}
              </div>
              <span className="text-xs leading-relaxed">
                Înțeleg. Voi merge la medic pentru aceste simptome. Vreau să folosesc acest protocol AI doar ca <strong>ghidaj complementar pentru stilul de viață</strong>, nu ca înlocuire a îngrijirii medicale.
              </span>
              <input type="checkbox" checked={redFlagAck} onChange={(e) => setRedFlagAck(e.target.checked)} className="sr-only" />
            </label>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => { setShowRedFlagModal(false); setRedFlagAck(false); }}
                className="flex-1 py-3 rounded-xl bg-surface-3 text-foreground text-sm font-medium hover:bg-card-hover transition-colors"
              >
                Mă duc la medic întâi
              </button>
              <button
                onClick={() => { setShowRedFlagModal(false); handleFinish(); }}
                disabled={!redFlagAck}
                className="flex-1 py-3 rounded-xl bg-accent text-black text-sm font-semibold hover:bg-accent-bright transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Am înțeles, continuă
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REVIEW BEFORE GENERATE — surfaces the answers that drive the protocol
          so the user can catch typos before an expensive AI call. Fields shown
          are the ones with the highest protocol-impact: demographics, lifestyle
          loads, pillar-relevant habits, supplements, and filled biomarker count.
          Conditions + meds are included because they gate safety-critical
          interventions downstream. */}
      {showReview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="review-title"
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center animate-fade-in"
        >
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowReview(false)} />
          <div className="relative bg-surface-1 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg mx-0 sm:mx-4 max-h-[88dvh] overflow-y-auto border border-card-border animate-fade-in-up">
            <div className="sticky top-0 bg-surface-1/95 backdrop-blur-lg border-b border-card-border p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-mono uppercase tracking-widest text-accent">Aproape gata</p>
                <h2 id="review-title" className="text-lg font-semibold mt-0.5">Arată bine?</h2>
              </div>
              <button onClick={() => setShowReview(false)} aria-label="Închide review" className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-sm">
              {/* Dense two-column summary — keeps the modal short enough to
                  scan in 10 seconds. A 30-row table would defeat the purpose. */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div>
                  <p className="text-xs text-muted uppercase tracking-widest">Vârstă</p>
                  <p className="font-medium">{age || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted uppercase tracking-widest">Sex</p>
                  <p className="font-medium capitalize">{sex || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted uppercase tracking-widest">Înălțime / Greutate</p>
                  <p className="font-medium">{heightCm || '—'} cm · {weightKg || '—'} kg</p>
                </div>
                <div>
                  <p className="text-xs text-muted uppercase tracking-widest">Activitate</p>
                  <p className="font-medium">{activityLevel || '—'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted uppercase tracking-widest">Somn</p>
                  <p className="font-medium">{sleepHours ? `${sleepHours}h mediu` : '—'} · calitate {sleepQuality ?? '—'}/10</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted uppercase tracking-widest">Încărcare exercițiu</p>
                  <p className="font-medium">{cardioMin || 0} min cardio · {strengthSessions || 0} forță/săpt.</p>
                </div>
                <div>
                  <p className="text-xs text-muted uppercase tracking-widest">Alcool</p>
                  <p className="font-medium">{alcoholPerWeek ?? 0} băuturi/săpt.</p>
                </div>
                <div>
                  <p className="text-xs text-muted uppercase tracking-widest">Cafeină</p>
                  <p className="font-medium">{caffeineServings ?? 0} porții/zi</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted uppercase tracking-widest">Fumător</p>
                  <p className="font-medium">{smoker ? 'Da' : 'Nu'}</p>
                </div>
              </div>

              {conditions.length > 0 && (
                <div className="pt-3 border-t border-card-border">
                  <p className="text-xs text-muted uppercase tracking-widest mb-1">Condiții</p>
                  <p className="text-[13px] leading-relaxed">{conditions.join(' · ')}</p>
                </div>
              )}

              {medications.filter(m => m.name.trim()).length > 0 && (
                <div className="pt-3 border-t border-card-border">
                  <p className="text-xs text-muted uppercase tracking-widest mb-1">Medicamente</p>
                  <ul className="space-y-1 text-[13px]">
                    {medications.filter(m => m.name.trim()).map((m, i) => (
                      <li key={i} className="leading-relaxed">
                        <span className="font-medium">{m.name}</span>
                        {m.dose && <span className="text-muted-foreground"> · {m.dose}</span>}
                        {m.frequency && <span className="text-muted-foreground"> · {m.frequency}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(primaryGoal || secondaryGoals.length > 0) && (
                <div className="pt-3 border-t border-card-border">
                  <p className="text-xs text-muted uppercase tracking-widest mb-1">Obiective</p>
                  <p className="text-[13px] leading-relaxed">{[primaryGoal, ...secondaryGoals].filter(Boolean).join(' · ')}</p>
                </div>
              )}

              <div className="pt-3 border-t border-card-border">
                <p className="text-xs text-muted uppercase tracking-widest mb-1">Biomarkeri introduși</p>
                <p className="text-[13px] leading-relaxed">
                  <span className="font-mono font-medium">{filledCount}</span> din {BIG_11_CODES.length} markeri de bază.
                  {filledCount === 0 && <span className="text-muted-foreground"> Protocolul va estima din stilul tău de viață — urcă un PDF cu analize mai târziu pentru precizie.</span>}
                </p>
              </div>

              <p className="text-[11px] text-muted-foreground leading-relaxed pt-3 border-t border-card-border">
                Durează cam 15 secunde. Poți edita orice mai târziu din Setări.
              </p>
            </div>

            <div className="sticky bottom-0 bg-surface-1/95 backdrop-blur-lg border-t border-card-border p-4 flex gap-2">
              <button
                onClick={() => setShowReview(false)}
                className="flex-1 py-3 rounded-xl bg-surface-3 border border-card-border text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Înapoi la editare
              </button>
              <button
                onClick={() => { setShowReview(false); handleFinish(); }}
                className="flex-1 py-3 rounded-xl bg-accent text-black font-semibold text-sm hover:bg-accent-bright transition-colors"
              >
                Construiește protocolul →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// CollapseSection moved to components/onboarding/CollapseSection.tsx
