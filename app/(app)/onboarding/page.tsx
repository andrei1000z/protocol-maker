'use client';

import { useState, useRef, useEffect } from 'react';
import { BIOMARKER_DB, BIG_11_CODES, BIOMARKER_CATEGORIES, CATEGORY_LABELS } from '@/lib/engine/biomarkers';
import { classifyBiomarker } from '@/lib/engine/classifier';
import { GeneratingScreen } from '@/components/protocol/GeneratingScreen';
import { Upload, FileText, ChevronDown, ChevronUp, Plus, X } from 'lucide-react';
import clsx from 'clsx';

const CONDITIONS = ['Type 2 Diabetes', 'Hypertension', 'Dyslipidemia', 'Thyroid', 'Autoimmune', 'Cardiovascular', 'Depression/Anxiety', 'Sleep Apnea', 'PCOS', 'Obesity'];
const FAMILY_CONDITIONS = ['Diabetes', 'Heart disease', 'Cancer', "Alzheimer's", 'Autoimmune', 'Mental illness', 'None known'];
const GOALS = ['Longevity / Healthspan', 'Body Composition', 'Cognitive Performance', 'Skin / Hair', 'Energy / Mood', 'Athletic Performance', 'Fertility', 'Fitness Recovery', 'Sleep', 'Mental Health'];
const SLEEP_ISSUES = ['Trouble falling asleep', 'Waking in the night', 'Wake up unrested', 'Snoring', 'Restless legs', 'None'];
const STEPS = ['Basics', 'Blood Work', 'Lifestyle', 'Day-to-Day', 'Goals'];

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

  // Step 1 — Smartwatch / ring
  const [wearable, setWearable] = useState('none');

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
  const [basicsExpanded, setBasicsExpanded] = useState({ location: false, identity: false, measurements: false, family: false, motivation: false });

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
  const [lifestyleExpanded, setLifestyleExpanded] = useState({ sleep: false, diet: false, exercise: false, mental: false, medical: false, environment: false, social: false });

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
  const [workStart, setWorkStart] = useState('09:00');
  const [workEnd, setWorkEnd] = useState('18:00');
  const [workLocation, setWorkLocation] = useState<'home' | 'office' | 'hybrid'>('hybrid');
  const [sittingHours, setSittingHours] = useState(6);
  const [exerciseWindow, setExerciseWindow] = useState<'morning' | 'lunch' | 'evening' | 'weekends' | 'inconsistent'>('evening');
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
  const [experimental, setExperimental] = useState('otc_only');

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
        setStr(od.workStart, setWorkStart); setStr(od.workEnd, setWorkEnd);
        if (od.workLocation) setWorkLocation(od.workLocation);
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
      setRestored(true);
    }).catch(() => setRestored(true));
  }, [restored]);

  const activityLabels = ['Sedentary', 'Light', 'Moderate', 'Active', 'Athlete'];

  const updateBiomarker = (code: string, val: string) => setBiomarkers(prev => ({ ...prev, [code]: val }));
  const toggle = <T,>(setter: (f: (p: T[]) => T[]) => void, val: T) => setter(prev => prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val]);
  const getLiveClassification = (code: string, val: string) => {
    if (!val || parseFloat(val) <= 0) return null;
    const ref = BIOMARKER_DB.find(b => b.code === code);
    if (!ref) return null;
    return classifyBiomarker({ code, value: parseFloat(val), unit: ref.unit }).classification;
  };

  const handlePdfUpload = async (file: File) => {
    setPdfParsing(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/parse-bloodwork', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('PDF parsing failed');
      const { biomarkers: parsed } = await res.json();
      const newBiomarkers: Record<string, string> = {};
      for (const b of parsed) {
        if (b.code && b.code !== 'UNKNOWN' && b.value) newBiomarkers[b.code] = String(b.value);
      }
      setBiomarkers(prev => ({ ...prev, ...newBiomarkers }));
      setPdfParsed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse PDF');
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
    workStart, workEnd, workLocation, sittingHours, exerciseWindow, screenTime,
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

  const saveProgress = async (stepNum: number) => {
    await fetch('/api/save-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildProfileData(false, stepNum)),
    });
  };

  const handleNext = async () => {
    if (step === 0 && hasBloodWork === false) { await saveProgress(0); setStep(2); return; }
    await saveProgress(step + 1);
    setStep(step + 1);
  };

  const handleBack = () => {
    if (step === 2 && hasBloodWork === false) { setStep(0); return; }
    setStep(Math.max(0, step - 1));
  };

  const handleFinish = async () => {
    setLoading(true);
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
        throw new Error(err.error || `Protocol generation failed (${genRes.status})`);
      }
      window.location.href = '/dashboard';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error. Try again.');
      setLoading(false);
    }
  };

  const addMedication = () => setMedications(prev => [...prev, { name: '', dose: '', frequency: 'daily' }]);
  const updateMed = (i: number, field: keyof Medication, val: string) => setMedications(prev => prev.map((m, idx) => idx === i ? { ...m, [field]: val } : m));
  const removeMed = (i: number) => setMedications(prev => prev.filter((_, idx) => idx !== i));

  if (loading) return <GeneratingScreen />;
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
              <span className={clsx('text-[9px]', i <= step ? 'text-accent' : 'text-muted')}>{s}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 px-6 pb-40 max-w-2xl mx-auto w-full overflow-y-auto">
        {/* STEP 0 — Basics */}
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold">The Basics</h1>
              <p className="text-muted-foreground text-sm mt-1">Only age, height, and weight are required. Everything else is optional — the more you share, the more personalized your protocol.</p>
            </div>

            {/* Required fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Name (optional)</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Alex" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Age <span className="text-accent">*</span></label>
                <input type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="25" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" />
                <p className="text-[9px] text-muted mt-1">Or choose birth date below for precision</p>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">Birth date (optional — more precise than age alone)</label>
                <input type="date" value={birthDate} onChange={e => { setBirthDate(e.target.value); if (e.target.value) { const yrs = Math.floor((Date.now() - new Date(e.target.value).getTime()) / (365.25 * 24 * 3600 * 1000)); setAge(String(yrs)); } }} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Height (cm) <span className="text-accent">*</span></label>
                <input type="number" value={heightCm} onChange={e => setHeightCm(e.target.value)} placeholder="180" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" />
                <p className="text-[9px] text-muted mt-1">Recommended: measure now for accuracy</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Weight (kg) <span className="text-accent">*</span></label>
                <input type="number" step="0.1" value={weightKg} onChange={e => setWeightKg(e.target.value)} placeholder="80" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" />
                <p className="text-[9px] text-muted mt-1">Recommended: weigh now, morning, no clothes</p>
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Activity Level: <span className="text-accent font-medium">{activityLabels[activityLevel]}</span></label>
              <input type="range" min={0} max={4} value={activityLevel} onChange={e => setActivityLevel(parseInt(e.target.value))} className="w-full h-2 bg-card-border rounded-lg appearance-none cursor-pointer accent-[#00ff88]" />
              <div className="flex justify-between text-[9px] text-muted mt-1">{activityLabels.map(l => <span key={l}>{l}</span>)}</div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Do you have recent blood work?</label>
              <div className="flex gap-3">
                {[{ v: true, l: 'Yes, I have results' }, { v: false, l: 'No, skip this' }].map(({ v, l }) => (
                  <button key={String(v)} onClick={() => setHasBloodWork(v)} className={clsx('flex-1 py-3 rounded-xl text-sm font-medium transition-all', hasBloodWork === v ? 'bg-accent text-black' : 'bg-card border border-card-border text-muted-foreground')}>{l}</button>
                ))}
              </div>
            </div>

            {/* Identity & sex (collapsible) */}
            <CollapseSection title="🧬 Identity & Biology (optional)" expanded={basicsExpanded.identity} onToggle={() => setBasicsExpanded(p => ({ ...p, identity: !p.identity }))}>
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Biological sex</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['male', 'female', 'intersex'] as const).map(s => (
                    <button key={s} onClick={() => setSex(s)} className={clsx('py-2.5 rounded-xl text-sm font-medium capitalize transition-all', sex === s ? 'bg-accent text-black' : 'bg-card border border-card-border text-muted-foreground')}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              {sex === 'intersex' && (
                <div>
                  <label className="text-xs text-muted-foreground">Chromosomes (if known)</label>
                  <select value={chromosomes} onChange={e => setChromosomes(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent">
                    <option value="">Prefer not to say</option>
                    <option value="XX">XX</option>
                    <option value="XY">XY</option>
                    <option value="XXY">XXY (Klinefelter)</option>
                    <option value="X0">X0 (Turner)</option>
                    <option value="XYY">XYY</option>
                    <option value="mosaic">Mosaic / other</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs text-muted-foreground">Gender identity (optional)</label>
                <input type="text" value={genderIdentity} onChange={e => setGenderIdentity(e.target.value)} placeholder="e.g. man, woman, non-binary, trans man, trans woman" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent" />
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setTransitioning(!transitioning)} className={clsx('w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0', transitioning ? 'bg-accent border-accent' : 'border-card-border')}>{transitioning && <span className="text-black text-xs">✓</span>}</button>
                <span className="text-sm">Currently transitioning / considering transitioning</span>
              </div>
              {transitioning && (
                <div>
                  <label className="text-xs text-muted-foreground">Transitioning to (affects hormone protocol)</label>
                  <select value={transitionTo} onChange={e => setTransitionTo(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent">
                    <option value="">Select...</option>
                    <option value="male">Masculinizing (HRT → male)</option>
                    <option value="female">Feminizing (HRT → female)</option>
                    <option value="non-binary">Non-binary / micro-dosing</option>
                    <option value="exploring">Exploring options</option>
                  </select>
                </div>
              )}
              {sex === 'female' && (
                <>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setPregnant(!pregnant)} className={clsx('w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0', pregnant ? 'bg-warning border-warning' : 'border-card-border')}>{pregnant && <span className="text-black text-xs">✓</span>}</button>
                    <span className="text-sm">Pregnant</span>
                  </div>
                  {pregnant && (
                    <div>
                      <label className="text-xs text-muted-foreground">How many weeks?</label>
                      <input type="number" value={pregnancyWeeks} onChange={e => setPregnancyWeeks(e.target.value)} placeholder="12" min={0} max={45} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" />
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <button onClick={() => setBreastfeeding(!breastfeeding)} className={clsx('w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0', breastfeeding ? 'bg-warning border-warning' : 'border-card-border')}>{breastfeeding && <span className="text-black text-xs">✓</span>}</button>
                    <span className="text-sm">Breastfeeding</span>
                  </div>
                </>
              )}
              <div>
                <label className="text-xs text-muted-foreground">Ethnicity / heritage (affects some biomarker ranges)</label>
                <select value={ethnicity} onChange={e => setEthnicity(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent">
                  <option value="">Select...</option>
                  <option value="european">European</option>
                  <option value="african">African</option>
                  <option value="asian_east">East Asian</option>
                  <option value="asian_south">South Asian</option>
                  <option value="hispanic">Hispanic/Latino</option>
                  <option value="middle_eastern">Middle Eastern</option>
                  <option value="mixed">Mixed / Other</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Occupation type</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['desk', 'physical', 'shift', 'mixed'] as const).map(o => (
                    <button key={o} onClick={() => setOccupation(o)} className={clsx('py-2 rounded-xl text-xs font-medium capitalize transition-all', occupation === o ? 'bg-accent text-black' : 'bg-card border border-card-border text-muted-foreground')}>{o}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Resting HR (if known, morning bpm)</label>
                <input type="number" value={restingHR} onChange={e => setRestingHR(e.target.value)} placeholder="65" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Smartwatch / smart ring (for accurate sleep, HRV, steps)</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {['none', 'Galaxy Watch', 'Apple Watch', 'Oura Ring', 'WHOOP', 'Garmin', 'Fitbit', 'Other'].map(w => (
                    <button key={w} onClick={() => setWearable(w)} className={clsx('py-2 rounded-xl text-xs font-medium transition-all', wearable === w ? 'bg-accent text-black' : 'bg-card border border-card-border text-muted-foreground')}>{w}</button>
                  ))}
                </div>
              </div>
            </CollapseSection>

            {/* Location */}
            <CollapseSection title="🌍 Location (optional — affects climate, pollution, food culture)" expanded={basicsExpanded.location} onToggle={() => setBasicsExpanded(p => ({ ...p, location: !p.location }))}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Country of residence</label>
                  <input type="text" value={country} onChange={e => setCountry(e.target.value)} placeholder="Romania" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">City</label>
                  <input type="text" value={city} onChange={e => setCity(e.target.value)} placeholder="București" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Country of birth</label>
                  <input type="text" value={birthCountry} onChange={e => setBirthCountry(e.target.value)} placeholder="Romania" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">City of birth</label>
                  <input type="text" value={birthCity} onChange={e => setBirthCity(e.target.value)} placeholder="Cluj-Napoca" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent" />
                </div>
              </div>
            </CollapseSection>

            {/* Body measurements (deep optional) */}
            <CollapseSection title="📏 Body Measurements & Fitness Tests (all optional)" expanded={basicsExpanded.measurements} onToggle={() => setBasicsExpanded(p => ({ ...p, measurements: !p.measurements }))}>
              <p className="text-[10px] text-muted-foreground">The more you fill in, the more precise your protocol. Skip anything you don&apos;t have.</p>
              <p className="text-[10px] text-accent uppercase tracking-wider mt-2">Circumference (cm)</p>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-[10px] text-muted">Waist</label><input type="number" value={waistCm} onChange={e => setWaistCm(e.target.value)} placeholder="85" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2 text-xs outline-none focus:border-accent font-mono" /></div>
                <div><label className="text-[10px] text-muted">Hip</label><input type="number" value={hipCm} onChange={e => setHipCm(e.target.value)} placeholder="95" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2 text-xs outline-none focus:border-accent font-mono" /></div>
                <div><label className="text-[10px] text-muted">Arm</label><input type="number" value={armCm} onChange={e => setArmCm(e.target.value)} placeholder="32" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2 text-xs outline-none focus:border-accent font-mono" /></div>
                <div><label className="text-[10px] text-muted">Thigh</label><input type="number" value={thighCm} onChange={e => setThighCm(e.target.value)} placeholder="55" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2 text-xs outline-none focus:border-accent font-mono" /></div>
              </div>
              <p className="text-[10px] text-accent uppercase tracking-wider mt-2">Body composition</p>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-[10px] text-muted">Body fat %</label><input type="number" step="0.1" value={bodyFatPct} onChange={e => setBodyFatPct(e.target.value)} placeholder="18" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2 text-xs outline-none focus:border-accent font-mono" /></div>
                <div><label className="text-[10px] text-muted">VO2 Max (ml/kg)</label><input type="number" step="0.1" value={vo2Max} onChange={e => setVo2Max(e.target.value)} placeholder="42" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2 text-xs outline-none focus:border-accent font-mono" /></div>
              </div>
              <p className="text-[10px] text-accent uppercase tracking-wider mt-2">Cardiovascular</p>
              <div className="grid grid-cols-3 gap-2">
                <div><label className="text-[10px] text-muted">BP Sys</label><input type="number" value={bloodPressureSys} onChange={e => setBloodPressureSys(e.target.value)} placeholder="120" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2 text-xs outline-none focus:border-accent font-mono" /></div>
                <div><label className="text-[10px] text-muted">BP Dia</label><input type="number" value={bloodPressureDia} onChange={e => setBloodPressureDia(e.target.value)} placeholder="80" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2 text-xs outline-none focus:border-accent font-mono" /></div>
                <div><label className="text-[10px] text-muted">HRV (ms)</label><input type="number" value={hrv} onChange={e => setHrv(e.target.value)} placeholder="55" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2 text-xs outline-none focus:border-accent font-mono" /></div>
              </div>
              <p className="text-[10px] text-accent uppercase tracking-wider mt-2">Fitness tests</p>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-[10px] text-muted">Grip strength (kg)</label><input type="number" step="0.5" value={gripStrength} onChange={e => setGripStrength(e.target.value)} placeholder="40" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2 text-xs outline-none focus:border-accent font-mono" /></div>
                <div><label className="text-[10px] text-muted">Cooper test (m in 12 min)</label><input type="number" value={cooperTest} onChange={e => setCooperTest(e.target.value)} placeholder="2400" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2 text-xs outline-none focus:border-accent font-mono" /></div>
                <div><label className="text-[10px] text-muted">Max push-ups / 1 min</label><input type="number" value={maxPushups} onChange={e => setMaxPushups(e.target.value)} placeholder="30" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2 text-xs outline-none focus:border-accent font-mono" /></div>
                <div><label className="text-[10px] text-muted">Max plank (sec)</label><input type="number" value={plankSec} onChange={e => setPlankSec(e.target.value)} placeholder="90" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2 text-xs outline-none focus:border-accent font-mono" /></div>
                <div><label className="text-[10px] text-muted">Max squats / 1 min</label><input type="number" value={maxSquats} onChange={e => setMaxSquats(e.target.value)} placeholder="40" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2 text-xs outline-none focus:border-accent font-mono" /></div>
                <div><label className="text-[10px] text-muted">Sit-and-reach (cm)</label><input type="number" value={sitReachCm} onChange={e => setSitReachCm(e.target.value)} placeholder="5" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2 text-xs outline-none focus:border-accent font-mono" /></div>
                <div className="col-span-2"><label className="text-[10px] text-muted">Balance — one-leg stand, eyes closed (sec, &gt;30 = good)</label><input type="number" value={balanceSec} onChange={e => setBalanceSec(e.target.value)} placeholder="45" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2 text-xs outline-none focus:border-accent font-mono" /></div>
              </div>
              <p className="text-[10px] text-accent uppercase tracking-wider mt-2">Weight history</p>
              <div className="grid grid-cols-3 gap-2">
                <div><label className="text-[10px] text-muted">1 year ago (kg)</label><input type="number" step="0.1" value={weightOneYearAgo} onChange={e => setWeightOneYearAgo(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2 text-xs outline-none focus:border-accent font-mono" /></div>
                <div><label className="text-[10px] text-muted">Min as adult</label><input type="number" step="0.1" value={weightMinAdult} onChange={e => setWeightMinAdult(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2 text-xs outline-none focus:border-accent font-mono" /></div>
                <div><label className="text-[10px] text-muted">Max as adult</label><input type="number" step="0.1" value={weightMaxAdult} onChange={e => setWeightMaxAdult(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2 text-xs outline-none focus:border-accent font-mono" /></div>
              </div>
            </CollapseSection>

            {/* Family history */}
            <CollapseSection title="🧬 Family History (drives preventive priorities)" expanded={basicsExpanded.family} onToggle={() => setBasicsExpanded(p => ({ ...p, family: !p.family }))}>
              <div>
                <label className="text-xs text-muted-foreground">Parents & grandparents — alive? If passed, at what age and from what?</label>
                <textarea value={parentsAlive} onChange={e => setParentsAlive(e.target.value)} rows={3} placeholder="e.g. Dad passed at 67 from heart attack, Mom alive 72. Grandfathers both passed in 80s from cancer." className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-xs outline-none focus:border-accent resize-none" />
              </div>
              <p className="text-xs text-muted-foreground">Family members (parents, siblings, grandparents) with these conditions:</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { val: familyCardio, set: setFamilyCardio, label: '❤️ Heart disease / stroke' },
                  { val: familyCancer, set: setFamilyCancer, label: '🎗️ Cancer' },
                  { val: familyDiabetes, set: setFamilyDiabetes, label: '🩸 Diabetes' },
                  { val: familyAlzheimers, set: setFamilyAlzheimers, label: '🧠 Alzheimer\'s / dementia' },
                  { val: familyAutoimmune, set: setFamilyAutoimmune, label: '🛡️ Autoimmune' },
                  { val: familyMental, set: setFamilyMental, label: '💭 Mental illness' },
                ].map(({ val, set, label }) => (
                  <button key={label} onClick={() => set(!val)} className={clsx('flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-left transition-all', val ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50' : 'bg-card border border-card-border text-muted-foreground')}>
                    <div className={clsx('w-4 h-4 rounded border-2 flex items-center justify-center text-[10px]', val ? 'bg-amber-500 border-amber-500 text-black' : 'border-card-border')}>{val ? '✓' : ''}</div>
                    {label}
                  </button>
                ))}
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Have you done a genetic test?</label>
                <select value={geneticTestDone} onChange={e => setGeneticTestDone(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent">
                  <option value="">Not yet</option>
                  <option value="23andme">23andMe</option>
                  <option value="myheritage">MyHeritage</option>
                  <option value="nebula">Nebula Genomics</option>
                  <option value="ancestry">Ancestry DNA</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </CollapseSection>

            {/* Motivation */}
            <CollapseSection title="🎯 Motivation & Context (helps the AI coach you right)" expanded={basicsExpanded.motivation} onToggle={() => setBasicsExpanded(p => ({ ...p, motivation: !p.motivation }))}>
              <div>
                <label className="text-xs text-muted-foreground">WHY do you want this protocol? Top 3 reasons + what triggered you NOW?</label>
                <textarea value={motivation} onChange={e => setMotivation(e.target.value)} rows={4} placeholder="e.g. Dad had heart attack at 67 — I want to avoid that. I turned 35 and energy dropped. I want to be present for my kids long-term." className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent resize-none" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">How disciplined do you consider yourself? <span className="text-accent">{discipline}/10</span></label>
                <input type="range" min={1} max={10} value={discipline} onChange={e => setDiscipline(parseInt(e.target.value))} className="w-full h-2 bg-card-border rounded-lg appearance-none cursor-pointer accent-[#00ff88]" />
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setSupportSystem(!supportSystem)} className={clsx('w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0', supportSystem ? 'bg-accent border-accent' : 'border-card-border')}>{supportSystem && <span className="text-black text-xs">✓</span>}</button>
                <span className="text-sm">I have support from family/partner (critical for long-term success)</span>
              </div>
            </CollapseSection>
          </div>
        )}

        {/* STEP 1 — Blood Work */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl font-bold">Your Blood Work</h1>
              <p className="text-muted-foreground text-sm mt-1">Upload a PDF or enter manually.</p>
            </div>
            <div className={clsx('border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer hover:border-accent/50', pdfParsed ? 'border-accent/50 bg-accent/5' : 'border-card-border')} onClick={() => fileInputRef.current?.click()}>
              <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={e => e.target.files?.[0] && handlePdfUpload(e.target.files[0])} />
              {pdfParsing ? <div className="space-y-3"><div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" /><p className="text-sm text-accent">Parsing with AI...</p></div>
                : pdfParsed ? <div className="space-y-2"><FileText className="w-10 h-10 text-accent mx-auto" /><p className="text-sm text-accent font-medium">{filledCount} biomarkers detected</p></div>
                : <div className="space-y-3"><Upload className="w-10 h-10 text-muted-foreground mx-auto" /><p className="text-sm font-medium">Drop lab report PDF</p><p className="text-xs text-muted-foreground">Synevo, Regina Maria, MedLife, LabCorp, Quest</p></div>}
            </div>
            <p className="text-[10px] text-accent uppercase tracking-wider">Core markers (Big 11)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {markersToShowBig11.map(b => {
                const cls = getLiveClassification(b.code, biomarkers[b.code] || '');
                return (
                  <div key={b.code} className="flex items-center gap-2 rounded-xl border border-card-border p-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{b.shortName}</p>
                      <p className="text-[10px] text-muted">Optimal: {b.longevityOptimalLow}-{b.longevityOptimalHigh}</p>
                    </div>
                    <input type="number" value={biomarkers[b.code] || ''} onChange={e => updateBiomarker(b.code, e.target.value)} placeholder={b.bryanJohnsonValue ? String(b.bryanJohnsonValue) : ''} step="0.1" className="w-20 rounded-lg bg-background border border-card-border px-2 py-1.5 text-sm text-right outline-none focus:border-accent font-mono" />
                    <span className="text-[10px] text-muted w-14">{b.unit}</span>
                    {cls && <span className={clsx('w-2 h-2 rounded-full', cls === 'OPTIMAL' ? 'bg-accent' : cls.includes('SUBOPTIMAL') ? 'bg-amber-400' : 'bg-red-400')} />}
                  </div>
                );
              })}
            </div>
            <button onClick={() => setShowAllMarkers(!showAllMarkers)} className="flex items-center gap-1 text-xs text-accent hover:underline mx-auto">
              {showAllMarkers ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}{showAllMarkers ? 'Show less' : `Show all ${BIOMARKER_DB.length} markers`}
            </button>
            {showAllMarkers && BIOMARKER_CATEGORIES.map(cat => {
              const catMarkers = BIOMARKER_DB.filter(b => b.category === cat && !BIG_11_CODES.includes(b.code));
              if (catMarkers.length === 0) return null;
              return (
                <div key={cat} className="space-y-2">
                  <p className="text-[10px] text-accent uppercase tracking-wider">{CATEGORY_LABELS[cat] || cat}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {catMarkers.map(b => {
                      const cls = getLiveClassification(b.code, biomarkers[b.code] || '');
                      return (
                        <div key={b.code} className="flex items-center gap-2 bg-card rounded-xl border border-card-border p-2.5">
                          <div className="flex-1 min-w-0"><p className="text-xs font-medium truncate">{b.shortName}</p><p className="text-[10px] text-muted">{b.longevityOptimalLow}-{b.longevityOptimalHigh} {b.unit}</p></div>
                          <input type="number" value={biomarkers[b.code] || ''} onChange={e => updateBiomarker(b.code, e.target.value)} step="0.1" className="w-20 rounded-lg bg-background border border-card-border px-2 py-1.5 text-sm text-right outline-none focus:border-accent font-mono" />
                          <span className="text-[10px] text-muted w-12">{b.unit}</span>
                          {cls && <span className={clsx('w-2 h-2 rounded-full', cls === 'OPTIMAL' ? 'bg-accent' : cls.includes('SUBOPTIMAL') ? 'bg-amber-400' : 'bg-red-400')} />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* STEP 2 — Lifestyle */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold">Your Lifestyle</h1>
              <p className="text-muted-foreground text-sm mt-1">~90 seconds. Shapes protocol as much as blood work.</p>
            </div>

            {/* Sleep */}
            <CollapseSection title="😴 Sleep" expanded={lifestyleExpanded.sleep} onToggle={() => setLifestyleExpanded(p => ({ ...p, sleep: !p.sleep }))}>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-muted-foreground">Hours/night (avg)</label><input type="number" value={sleepHours} onChange={e => setSleepHours(e.target.value)} step="0.5" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
                <div><label className="text-xs text-muted-foreground">Quality (1-10)</label>
                  <div className="flex gap-1 mt-1">{[...Array(10)].map((_, i) => (
                    <button key={i} onClick={() => setSleepQuality(i + 1)} className={clsx('flex-1 h-9 rounded-lg text-xs font-mono transition-all', sleepQuality === i + 1 ? 'bg-accent text-black' : i + 1 <= sleepQuality ? 'bg-accent/20 text-accent' : 'bg-card border border-card-border text-muted')}>{i + 1}</button>
                  ))}</div>
                </div>
                <div><label className="text-xs text-muted-foreground">Typical bedtime</label><input type="time" value={bedtime} onChange={e => setBedtime(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
                <div><label className="text-xs text-muted-foreground">Typical wake time</label><input type="time" value={wakeTime} onChange={e => setWakeTime(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
                <div><label className="text-xs text-muted-foreground">Ideal bedtime</label><input type="time" value={idealBedtime} onChange={e => setIdealBedtime(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
                <div><label className="text-xs text-muted-foreground">Ideal wake time</label><input type="time" value={idealWakeTime} onChange={e => setIdealWakeTime(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
              </div>

              {wearable && wearable !== 'none' && (
                <div>
                  <p className="text-[10px] text-accent uppercase tracking-wider mt-2">Last 3 nights (from your {wearable})</p>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {[
                      { label: 'Last night', h: lastNight1Hours, sH: setLastNight1Hours, sc: lastNight1Score, sSc: setLastNight1Score },
                      { label: '2 nights ago', h: lastNight2Hours, sH: setLastNight2Hours, sc: lastNight2Score, sSc: setLastNight2Score },
                      { label: '3 nights ago', h: lastNight3Hours, sH: setLastNight3Hours, sc: lastNight3Score, sSc: setLastNight3Score },
                    ].map(n => (
                      <div key={n.label} className="space-y-1">
                        <p className="text-[10px] text-muted">{n.label}</p>
                        <input type="number" step="0.1" value={n.h} onChange={e => n.sH(e.target.value)} placeholder="hrs" className="w-full rounded-lg bg-card border border-card-border px-2 py-1.5 text-xs outline-none focus:border-accent font-mono" />
                        <input type="number" value={n.sc} onChange={e => n.sSc(e.target.value)} placeholder="score 0-100" className="w-full rounded-lg bg-card border border-card-border px-2 py-1.5 text-xs outline-none focus:border-accent font-mono" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div><label className="text-xs text-muted-foreground mb-2 block">Chronotype</label>
                <div className="flex gap-2">
                  {([{ v: 'morning', l: '🌅 Morning person' }, { v: 'neutral', l: '😐 Neutral' }, { v: 'night', l: '🌙 Night owl' }] as const).map(({ v, l }) => (
                    <button key={v} onClick={() => setChronotype(v)} className={clsx('flex-1 py-2 rounded-xl text-xs font-medium transition-all', chronotype === v ? 'bg-accent text-black' : 'bg-card border border-card-border text-muted-foreground')}>{l}</button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-muted-foreground">Time to fall asleep (min)</label><input type="number" value={timeToFallAsleep} onChange={e => setTimeToFallAsleep(e.target.value)} placeholder="15" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
                <div><label className="text-xs text-muted-foreground">Wake-ups per night</label><input type="number" value={wakeUpsPerNight} onChange={e => setWakeUpsPerNight(e.target.value)} placeholder="1" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
                <div><label className="text-xs text-muted-foreground">Naps per day</label><input type="number" value={napsDaily} onChange={e => setNapsDaily(e.target.value)} placeholder="0" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
                <div><label className="text-xs text-muted-foreground">Bedroom temp (°C)</label><input type="number" value={bedroomTemp} onChange={e => setBedroomTemp(e.target.value)} placeholder="19" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Sleep apnea checked?</label>
                <select value={sleepApneaChecked} onChange={e => setSleepApneaChecked(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent">
                  <option value="">Not sure / prefer not to say</option>
                  <option value="never">Never tested</option>
                  <option value="negative">Tested — negative</option>
                  <option value="positive_cpap">Tested positive, using CPAP</option>
                  <option value="positive_no_cpap">Tested positive, no CPAP</option>
                </select>
              </div>

              <div className="flex items-center gap-3"><button onClick={() => setPhoneInBedroom(!phoneInBedroom)} className={clsx('w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0', phoneInBedroom ? 'bg-warning border-warning' : 'border-card-border')}>{phoneInBedroom && <span className="text-black text-xs">✓</span>}</button><span className="text-sm">Phone in bedroom at night</span></div>

              <div><label className="text-xs text-muted-foreground mb-2 block">Sleep issues</label>
                <div className="flex flex-wrap gap-2">
                  {SLEEP_ISSUES.map(si => (
                    <button key={si} onClick={() => toggle<string>(setSleepIssues as (f: (p: string[]) => string[]) => void, si)} className={clsx('px-3 py-1.5 rounded-xl text-xs transition-all', sleepIssues.includes(si) ? 'bg-warning/20 text-warning border border-warning/50' : 'bg-card border border-card-border text-muted-foreground')}>{si}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Other sleep issues (describe)</label>
                <textarea value={sleepIssuesCustom} onChange={e => setSleepIssuesCustom(e.target.value)} rows={2} placeholder="e.g. partner snoring wakes me, noisy street, worried mind, etc." className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-xs outline-none focus:border-accent resize-none" />
              </div>
            </CollapseSection>

            {/* Diet */}
            <CollapseSection title="🥗 Diet & Substances" expanded={lifestyleExpanded.diet} onToggle={() => setLifestyleExpanded(p => ({ ...p, diet: !p.diet }))}>
              <div><label className="text-xs text-muted-foreground mb-2 block">Diet type</label>
                <div className="flex flex-wrap gap-2">
                  {['omnivore', 'vegetarian', 'vegan', 'keto', 'carnivore', 'mediterranean', 'custom'].map(d => (
                    <button key={d} onClick={() => setDietType(d)} className={clsx('px-3 py-2 rounded-xl text-xs font-medium transition-all capitalize', dietType === d ? 'bg-accent text-black' : 'bg-card border border-card-border text-muted-foreground')}>{d}</button>
                  ))}
                </div>
              </div>
              {dietType === 'custom' && (
                <div>
                  <label className="text-xs text-muted-foreground">Describe your diet</label>
                  <input type="text" value={dietTypeCustom} onChange={e => setDietTypeCustom(e.target.value)} placeholder="e.g. pescatarian + gluten-free, paleo, Whole30..." className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent" />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-muted-foreground">Meals/day</label><input type="number" value={mealsPerDay} onChange={e => setMealsPerDay(parseInt(e.target.value) || 3)} min={1} max={6} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
                <div><label className="text-xs text-muted-foreground">Water (glasses/day)</label><input type="number" value={hydration} onChange={e => setHydration(parseInt(e.target.value) || 6)} min={0} max={20} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
                <div><label className="text-xs text-muted-foreground">First meal time</label><input type="time" value={firstMealTime} onChange={e => setFirstMealTime(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
                <div><label className="text-xs text-muted-foreground">Last meal time</label><input type="time" value={lastMealTime} onChange={e => setLastMealTime(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Describe a typical day of eating (optional but powerful)</label>
                <textarea value={typicalDay} onChange={e => setTypicalDay(e.target.value)} rows={3} placeholder="e.g. 8am coffee + oats w/ banana. 1pm chicken salad + rice. 7pm salmon + potatoes + wine." className="w-full rounded-xl bg-card border border-card-border px-3 py-2.5 text-xs outline-none focus:border-accent resize-none" />
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-2 block">% of meals cooked at home: <span className="text-accent font-medium">{cooksAtHome}%</span></label>
                <input type="range" min={0} max={100} step={5} value={cooksAtHome} onChange={e => setCooksAtHome(parseInt(e.target.value))} className="w-full h-2 bg-card-border rounded-lg appearance-none cursor-pointer accent-[#00ff88]" />
              </div>

              <p className="text-[10px] text-accent uppercase tracking-wider mt-2">Food frequencies</p>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-[10px] text-muted">Fruits / day</label><input type="number" value={fruitsPerDay} onChange={e => setFruitsPerDay(e.target.value)} placeholder="2" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2 text-xs outline-none focus:border-accent font-mono" /></div>
                <div><label className="text-[10px] text-muted">Veggies / day (servings)</label><input type="number" value={veggiesPerDay} onChange={e => setVeggiesPerDay(e.target.value)} placeholder="3" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2 text-xs outline-none focus:border-accent font-mono" /></div>
                <div><label className="text-[10px] text-muted">Fish / week</label><input type="number" value={fishPerWeek} onChange={e => setFishPerWeek(e.target.value)} placeholder="2" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2 text-xs outline-none focus:border-accent font-mono" /></div>
                <div><label className="text-[10px] text-muted">Red meat / week</label><input type="number" value={redMeatPerWeek} onChange={e => setRedMeatPerWeek(e.target.value)} placeholder="3" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2 text-xs outline-none focus:border-accent font-mono" /></div>
                <div><label className="text-[10px] text-muted">Ultra-processed / week</label><input type="number" value={ultraProcessedPerWeek} onChange={e => setUltraProcessedPerWeek(e.target.value)} placeholder="5" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2 text-xs outline-none focus:border-accent font-mono" /></div>
                <div><label className="text-[10px] text-muted">Fast food / week</label><input type="number" value={fastFoodPerWeek} onChange={e => setFastFoodPerWeek(e.target.value)} placeholder="1" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2 text-xs outline-none focus:border-accent font-mono" /></div>
              </div>

              <div><label className="text-xs text-muted-foreground mb-2 block">Food allergies/intolerances</label>
                <div className="flex flex-wrap gap-2">
                  {['gluten', 'dairy', 'nuts', 'seafood', 'eggs', 'soy', 'shellfish'].map(f => (
                    <button key={f} onClick={() => toggle<string>(setFoodAllergies as (f: (p: string[]) => string[]) => void, f)} className={clsx('px-3 py-1.5 rounded-xl text-xs capitalize transition-all', foodAllergies.includes(f) ? 'bg-warning/20 text-warning border border-warning/50' : 'bg-card border border-card-border text-muted-foreground')}>{f}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Other allergies / sensitivities</label>
                <input type="text" value={foodAllergiesCustom} onChange={e => setFoodAllergiesCustom(e.target.value)} placeholder="e.g. nightshades, FODMAPs, histamine..." className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent" />
              </div>

              <p className="text-[10px] text-accent uppercase tracking-wider mt-2">Caffeine, alcohol, intermittent fasting</p>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-muted-foreground">Alcohol (drinks/week)</label><input type="number" value={alcoholPerWeek} onChange={e => setAlcoholPerWeek(parseInt(e.target.value) || 0)} min={0} max={50} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
                <div><label className="text-xs text-muted-foreground">Caffeine (servings/day)</label><input type="number" value={caffeineServings} onChange={e => setCaffeineServings(parseInt(e.target.value) || 0)} min={0} max={10} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
                <div className="col-span-2"><label className="text-xs text-muted-foreground">Caffeine cutoff time (last coffee/tea)</label><input type="time" value={coffeeCutoffTime} onChange={e => setCoffeeCutoffTime(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
              </div>
              <div className="flex items-center gap-3"><button onClick={() => setTriedIF(!triedIF)} className={clsx('w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0', triedIF ? 'bg-accent border-accent' : 'border-card-border')}>{triedIF && <span className="text-black text-xs">✓</span>}</button><span className="text-sm">Practice intermittent fasting</span></div>
              {triedIF && (
                <div>
                  <label className="text-xs text-muted-foreground">Eating window</label>
                  <select value={ifWindow} onChange={e => setIfWindow(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent">
                    <option value="">Select...</option>
                    <option value="12:12">12:12</option>
                    <option value="14:10">14:10</option>
                    <option value="16:8">16:8</option>
                    <option value="18:6">18:6</option>
                    <option value="20:4">20:4 / OMAD</option>
                    <option value="extended">Extended fasts (24h+)</option>
                  </select>
                </div>
              )}

              <p className="text-[10px] text-accent uppercase tracking-wider mt-2">Smoking / vaping / substances</p>
              <div className="flex items-center gap-3"><button onClick={() => setSmoker(!smoker)} className={clsx('w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0', smoker ? 'bg-warning border-warning' : 'border-card-border')}>{smoker && <span className="text-black text-xs">✓</span>}</button><span className="text-sm">I smoke or vape nicotine</span></div>
              {smoker && (
                <>
                  <div><label className="text-xs text-muted-foreground mb-2 block">Type</label>
                    <div className="flex gap-2">
                      {([{ v: 'cigarettes', l: '🚬 Cigarettes' }, { v: 'vape', l: '💨 Vape' }, { v: 'both', l: 'Both' }] as const).map(({ v, l }) => (
                        <button key={v} onClick={() => setSmokingType(v)} className={clsx('flex-1 py-2 rounded-xl text-xs font-medium transition-all', smokingType === v ? 'bg-warning text-black' : 'bg-card border border-card-border text-muted-foreground')}>{l}</button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {(smokingType === 'cigarettes' || smokingType === 'both') && (
                      <div><label className="text-xs text-muted-foreground">Cigarettes/day</label><input type="number" value={cigarettesPerDay} onChange={e => setCigarettesPerDay(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
                    )}
                    {(smokingType === 'vape' || smokingType === 'both') && (
                      <div><label className="text-xs text-muted-foreground">Vape puffs/day (est.)</label><input type="number" value={vapePuffsPerDay} onChange={e => setVapePuffsPerDay(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
                    )}
                  </div>
                </>
              )}
              <div>
                <label className="text-xs text-muted-foreground">Recreational drugs (confidential — shapes interactions)</label>
                <input type="text" value={recreationalDrugs} onChange={e => setRecreationalDrugs(e.target.value)} placeholder="e.g. cannabis weekends, none, occasional psychedelics..." className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent" />
              </div>
            </CollapseSection>

            {/* Exercise */}
            <CollapseSection title="🏋️ Exercise & Movement" expanded={lifestyleExpanded.exercise} onToggle={() => setLifestyleExpanded(p => ({ ...p, exercise: !p.exercise }))}>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-muted-foreground">Cardio (min/week)</label><input type="number" value={cardioMin} onChange={e => setCardioMin(parseInt(e.target.value) || 0)} min={0} max={1000} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
                <div><label className="text-xs text-muted-foreground">Strength sessions/week</label><input type="number" value={strengthSessions} onChange={e => setStrengthSessions(parseInt(e.target.value) || 0)} min={0} max={7} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
                <div><label className="text-xs text-muted-foreground">Daily steps (avg)</label><input type="number" value={stepsPerDay} onChange={e => setStepsPerDay(e.target.value)} placeholder="8000" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
                <div><label className="text-xs text-muted-foreground">Self-rated fitness (1-10): <span className="text-accent font-medium">{fitnessLevel}</span></label><input type="range" min={1} max={10} value={fitnessLevel} onChange={e => setFitnessLevel(parseInt(e.target.value))} className="w-full mt-2 h-2 bg-card-border rounded-lg appearance-none cursor-pointer accent-[#00ff88]" /></div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Types of exercise you do</label>
                <div className="flex flex-wrap gap-2">
                  {['running', 'cycling', 'swimming', 'weights', 'calisthenics', 'HIIT', 'hiking', 'team sports', 'crossfit', 'martial arts', 'climbing', 'dance'].map(ex => (
                    <button key={ex} onClick={() => toggle<string>(setExercisesDone as (f: (p: string[]) => string[]) => void, ex)} className={clsx('px-3 py-1.5 rounded-xl text-xs capitalize transition-all', exercisesDone.includes(ex) ? 'bg-accent/20 text-accent border border-accent/50' : 'bg-card border border-card-border text-muted-foreground')}>{ex}</button>
                  ))}
                </div>
              </div>

              <p className="text-[10px] text-accent uppercase tracking-wider mt-2">Strength benchmarks (if lifting — optional)</p>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-[10px] text-muted">Max pull-ups</label><input type="number" value={maxPullups} onChange={e => setMaxPullups(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2 text-xs outline-none focus:border-accent font-mono" /></div>
                <div><label className="text-[10px] text-muted">Squat 1RM (kg)</label><input type="number" value={squatWeight} onChange={e => setSquatWeight(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2 text-xs outline-none focus:border-accent font-mono" /></div>
                <div><label className="text-[10px] text-muted">Bench 1RM (kg)</label><input type="number" value={benchWeight} onChange={e => setBenchWeight(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2 text-xs outline-none focus:border-accent font-mono" /></div>
                <div><label className="text-[10px] text-muted">Deadlift 1RM (kg)</label><input type="number" value={deadliftWeight} onChange={e => setDeadliftWeight(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2 text-xs outline-none focus:border-accent font-mono" /></div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => setYogaPilates(!yogaPilates)} className={clsx('p-3 rounded-xl text-xs text-center transition-all', yogaPilates ? 'bg-accent/20 text-accent border border-accent/50' : 'bg-card border border-card-border text-muted-foreground')}>🧘 Yoga / Pilates</button>
                <button onClick={() => setSauna(!sauna)} className={clsx('p-3 rounded-xl text-xs text-center transition-all', sauna ? 'bg-accent/20 text-accent border border-accent/50' : 'bg-card border border-card-border text-muted-foreground')}>🔥 Sauna regularly</button>
                <button onClick={() => setIceBath(!iceBath)} className={clsx('p-3 rounded-xl text-xs text-center transition-all', iceBath ? 'bg-accent/20 text-accent border border-accent/50' : 'bg-card border border-card-border text-muted-foreground')}>🧊 Cold plunge</button>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Current injuries / limitations</label>
                <textarea value={injuries} onChange={e => setInjuries(e.target.value)} rows={2} placeholder="e.g. right knee meniscus, shoulder impingement..." className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-xs outline-none focus:border-accent resize-none" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Chronic pain (location + severity)</label>
                <input type="text" value={chronicPain} onChange={e => setChronicPain(e.target.value)} placeholder="e.g. low back 4/10 after sitting" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent" />
              </div>
            </CollapseSection>

            {/* Mental/Stress */}
            <CollapseSection title="🧠 Mental Health & Stress" expanded={lifestyleExpanded.mental} onToggle={() => setLifestyleExpanded(p => ({ ...p, mental: !p.mental }))}>
              <div><label className="text-xs text-muted-foreground mb-2 block">Stress level (1-10): <span className="text-accent font-medium">{stressLevel}</span></label>
                <input type="range" min={1} max={10} value={stressLevel} onChange={e => setStressLevel(parseInt(e.target.value))} className="w-full h-2 bg-card-border rounded-lg appearance-none cursor-pointer accent-[#00ff88]" />
              </div>
              <div><label className="text-xs text-muted-foreground mb-2 block">Happiness / life satisfaction (1-10): <span className="text-accent font-medium">{happinessScore}</span></label>
                <input type="range" min={1} max={10} value={happinessScore} onChange={e => setHappinessScore(parseInt(e.target.value))} className="w-full h-2 bg-card-border rounded-lg appearance-none cursor-pointer accent-[#00ff88]" />
              </div>
              <div><label className="text-xs text-muted-foreground mb-2 block">Sense of purpose / meaning (1-10): <span className="text-accent font-medium">{lifeSenseOfPurpose}</span></label>
                <input type="range" min={1} max={10} value={lifeSenseOfPurpose} onChange={e => setLifeSenseOfPurpose(parseInt(e.target.value))} className="w-full h-2 bg-card-border rounded-lg appearance-none cursor-pointer accent-[#00ff88]" />
              </div>
              <div><label className="text-xs text-muted-foreground mb-2 block">Meditation / mindfulness</label>
                <div className="flex gap-2">
                  {(['none', 'occasional', 'daily'] as const).map(v => (
                    <button key={v} onClick={() => setMeditationPractice(v)} className={clsx('flex-1 py-2 rounded-xl text-xs font-medium capitalize transition-all', meditationPractice === v ? 'bg-accent text-black' : 'bg-card border border-card-border text-muted-foreground')}>{v}</button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setDepressionSymptoms(!depressionSymptoms)} className={clsx('p-3 rounded-xl text-xs text-left transition-all', depressionSymptoms ? 'bg-warning/20 text-warning border border-warning/50' : 'bg-card border border-card-border text-muted-foreground')}>
                  <div className={clsx('w-4 h-4 rounded border-2 inline-flex items-center justify-center mr-2 text-[10px]', depressionSymptoms ? 'bg-warning border-warning text-black' : 'border-card-border')}>{depressionSymptoms ? '✓' : ''}</div>
                  Current depression symptoms
                </button>
                <button onClick={() => setAnxietySymptoms(!anxietySymptoms)} className={clsx('p-3 rounded-xl text-xs text-left transition-all', anxietySymptoms ? 'bg-warning/20 text-warning border border-warning/50' : 'bg-card border border-card-border text-muted-foreground')}>
                  <div className={clsx('w-4 h-4 rounded border-2 inline-flex items-center justify-center mr-2 text-[10px]', anxietySymptoms ? 'bg-warning border-warning text-black' : 'border-card-border')}>{anxietySymptoms ? '✓' : ''}</div>
                  Current anxiety symptoms
                </button>
                <button onClick={() => setTherapyNow(!therapyNow)} className={clsx('p-3 rounded-xl text-xs text-left transition-all', therapyNow ? 'bg-accent/20 text-accent border border-accent/50' : 'bg-card border border-card-border text-muted-foreground')}>
                  <div className={clsx('w-4 h-4 rounded border-2 inline-flex items-center justify-center mr-2 text-[10px]', therapyNow ? 'bg-accent border-accent text-black' : 'border-card-border')}>{therapyNow ? '✓' : ''}</div>
                  Currently in therapy
                </button>
                <div className="col-span-1">
                  <label className="text-[10px] text-muted">Psych meds (if any)</label>
                  <input type="text" value={psychMeds} onChange={e => setPsychMeds(e.target.value)} placeholder="e.g. SSRI, ADHD meds..." className="w-full mt-1 rounded-lg bg-card border border-card-border px-2 py-2 text-xs outline-none focus:border-accent" />
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Top 3 stressors in your life</label>
                <textarea value={topStressors} onChange={e => setTopStressors(e.target.value)} rows={2} placeholder="e.g. work deadlines, finances, relationship with parents..." className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-xs outline-none focus:border-accent resize-none" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Flow activities (things that make you lose track of time)</label>
                <input type="text" value={flowActivities} onChange={e => setFlowActivities(e.target.value)} placeholder="e.g. coding, painting, climbing, gardening..." className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-muted-foreground">Total screen time (hrs/day)</label><input type="number" step="0.5" value={screenTimeDaily} onChange={e => setScreenTimeDaily(e.target.value)} placeholder="8" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
                <div><label className="text-xs text-muted-foreground">Social media (hrs/day)</label><input type="number" step="0.5" value={socialMediaDaily} onChange={e => setSocialMediaDaily(e.target.value)} placeholder="2" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
              </div>
            </CollapseSection>

            {/* Medical */}
            <CollapseSection title="⚕️ Medical" expanded={lifestyleExpanded.medical} onToggle={() => setLifestyleExpanded(p => ({ ...p, medical: !p.medical }))}>
              <div><label className="text-xs text-muted-foreground mb-2 block">Diagnosed conditions</label>
                <div className="flex flex-wrap gap-2">
                  {CONDITIONS.map(c => (
                    <button key={c} onClick={() => toggle<string>(setConditions as (f: (p: string[]) => string[]) => void, c)} className={clsx('px-3 py-1.5 rounded-xl text-xs transition-all', conditions.includes(c) ? 'bg-warning/20 text-warning border border-warning/50' : 'bg-card border border-card-border text-muted-foreground')}>{c}</button>
                  ))}
                </div>
              </div>
              <div><label className="text-xs text-muted-foreground mb-2 block">Family history</label>
                <div className="flex flex-wrap gap-2">
                  {FAMILY_CONDITIONS.map(c => (
                    <button key={c} onClick={() => toggle<string>(setFamilyHistory as (f: (p: string[]) => string[]) => void, c)} className={clsx('px-3 py-1.5 rounded-xl text-xs transition-all', familyHistory.includes(c) ? 'bg-accent/20 text-accent border border-accent/50' : 'bg-card border border-card-border text-muted-foreground')}>{c}</button>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-muted-foreground">Current medications</label>
                  <button onClick={addMedication} className="flex items-center gap-1 text-xs text-accent"><Plus className="w-3 h-3" /> Add</button>
                </div>
                {medications.length === 0 && <p className="text-[10px] text-muted">None. Click &quot;Add&quot; if you take any.</p>}
                <div className="space-y-2">
                  {medications.map((m, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input value={m.name} onChange={e => updateMed(i, 'name', e.target.value)} placeholder="Name (e.g. Metformin)" className="flex-1 rounded-lg bg-card border border-card-border px-2 py-1.5 text-xs outline-none focus:border-accent" />
                      <input value={m.dose} onChange={e => updateMed(i, 'dose', e.target.value)} placeholder="500mg" className="w-20 rounded-lg bg-card border border-card-border px-2 py-1.5 text-xs outline-none focus:border-accent" />
                      <select value={m.frequency} onChange={e => updateMed(i, 'frequency', e.target.value)} className="rounded-lg bg-card border border-card-border px-2 py-1.5 text-xs outline-none focus:border-accent">
                        <option value="daily">daily</option><option value="2x/day">2x/day</option><option value="weekly">weekly</option><option value="as needed">as needed</option>
                      </select>
                      <button onClick={() => removeMed(i)} className="p-1.5 text-muted hover:text-danger"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              </div>
              <div><label className="text-xs text-muted-foreground">Current supplements (comma-separated)</label>
                <input type="text" value={supplements} onChange={e => setSupplements(e.target.value)} placeholder="Vitamin D, Omega-3, Magnesium..." className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent" />
              </div>

              <p className="text-[10px] text-accent uppercase tracking-wider mt-2">History</p>
              <div>
                <label className="text-xs text-muted-foreground">Past surgeries or hospitalizations</label>
                <textarea value={surgeries} onChange={e => setSurgeries(e.target.value)} rows={2} placeholder="e.g. appendectomy 2015, knee arthroscopy 2022" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-xs outline-none focus:border-accent resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-muted-foreground">Last blood test</label><input type="date" value={lastBloodTestDate} onChange={e => setLastBloodTestDate(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
                <div><label className="text-xs text-muted-foreground">Last physical exam</label><input type="date" value={lastPhysicalDate} onChange={e => setLastPhysicalDate(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
              </div>

              <div className="flex items-center gap-3"><button onClick={() => setHadCovid(!hadCovid)} className={clsx('w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0', hadCovid ? 'bg-accent border-accent' : 'border-card-border')}>{hadCovid && <span className="text-black text-xs">✓</span>}</button><span className="text-sm">I&apos;ve had COVID-19</span></div>
              {hadCovid && (
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-muted-foreground">How many times?</label><input type="number" value={covidCount} onChange={e => setCovidCount(e.target.value)} placeholder="1" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
                  <div className="flex items-end"><label className="flex items-center gap-2 text-sm"><button onClick={() => setLongCovid(!longCovid)} className={clsx('w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0', longCovid ? 'bg-warning border-warning' : 'border-card-border')}>{longCovid && <span className="text-black text-xs">✓</span>}</button>Long COVID symptoms</label></div>
                </div>
              )}

              <div><label className="text-xs text-muted-foreground">Antibiotic courses in the last 12 months</label>
                <select value={antibioticsLastYear} onChange={e => setAntibioticsLastYear(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent">
                  <option value="">Select...</option>
                  <option value="0">None</option>
                  <option value="1">1 course</option>
                  <option value="2">2 courses</option>
                  <option value="3+">3 or more</option>
                </select>
              </div>

              <div><label className="text-xs text-muted-foreground">Vaccines up to date?</label>
                <select value={vaccinesUpToDate} onChange={e => setVaccinesUpToDate(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent">
                  <option value="">Select...</option>
                  <option value="yes">Yes, fully up to date</option>
                  <option value="mostly">Mostly — missing some</option>
                  <option value="no">No</option>
                  <option value="selective">Selective (covid/flu only)</option>
                </select>
              </div>

              <p className="text-[10px] text-accent uppercase tracking-wider mt-2">Sex & reproductive</p>
              <div><label className="text-xs text-muted-foreground mb-2 block">Libido (1-10): <span className="text-accent font-medium">{libidoScore}</span></label>
                <input type="range" min={1} max={10} value={libidoScore} onChange={e => setLibidoScore(parseInt(e.target.value))} className="w-full h-2 bg-card-border rounded-lg appearance-none cursor-pointer accent-[#00ff88]" />
              </div>

              {sex === 'male' && (
                <div>
                  <label className="text-xs text-muted-foreground">Morning erections — frequency</label>
                  <select value={morningErection} onChange={e => setMorningErection(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent">
                    <option value="">Select...</option>
                    <option value="daily">Daily / most mornings</option>
                    <option value="several_week">Several per week</option>
                    <option value="rare">Rare</option>
                    <option value="never">Never</option>
                  </select>
                </div>
              )}

              {sex === 'female' && (
                <>
                  <div><label className="text-xs text-muted-foreground">Menstrual cycle</label>
                    <select value={menstrualRegular} onChange={e => setMenstrualRegular(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent">
                      <option value="">Select...</option>
                      <option value="regular">Regular</option>
                      <option value="irregular">Irregular</option>
                      <option value="absent">Absent (not pregnant)</option>
                      <option value="menopause">Post-menopause</option>
                    </select>
                  </div>
                  <div><label className="text-xs text-muted-foreground mb-2 block">PMS severity (0-10): <span className="text-accent font-medium">{pmsSeverity}</span></label>
                    <input type="range" min={0} max={10} value={pmsSeverity} onChange={e => setPmsSeverity(parseInt(e.target.value))} className="w-full h-2 bg-card-border rounded-lg appearance-none cursor-pointer accent-[#00ff88]" />
                  </div>
                  <div><label className="text-xs text-muted-foreground">Menopause status</label>
                    <select value={menopauseStatus} onChange={e => setMenopauseStatus(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent">
                      <option value="">Not applicable</option>
                      <option value="pre">Pre-menopausal</option>
                      <option value="peri">Peri-menopausal</option>
                      <option value="post">Post-menopausal (on HRT)</option>
                      <option value="post_no_hrt">Post-menopausal (no HRT)</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-3"><button onClick={() => setHormonalContraception(!hormonalContraception)} className={clsx('w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0', hormonalContraception ? 'bg-accent border-accent' : 'border-card-border')}>{hormonalContraception && <span className="text-black text-xs">✓</span>}</button><span className="text-sm">Using hormonal contraception (pill, IUD, ring)</span></div>
                </>
              )}

              <div><label className="text-xs text-muted-foreground">Children</label>
                <select value={hadChildren} onChange={e => setHadChildren(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent">
                  <option value="">Prefer not to say</option>
                  <option value="none">None</option>
                  <option value="planning">Planning soon</option>
                  <option value="1">1 child</option>
                  <option value="2">2 children</option>
                  <option value="3+">3 or more</option>
                </select>
              </div>

              <p className="text-[10px] text-accent uppercase tracking-wider mt-2">Daily hygiene</p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setFlossDaily(!flossDaily)} className={clsx('p-3 rounded-xl text-xs text-center transition-all', flossDaily ? 'bg-accent/20 text-accent border border-accent/50' : 'bg-card border border-card-border text-muted-foreground')}>🦷 Floss daily</button>
                <button onClick={() => setSpfDaily(!spfDaily)} className={clsx('p-3 rounded-xl text-xs text-center transition-all', spfDaily ? 'bg-accent/20 text-accent border border-accent/50' : 'bg-card border border-card-border text-muted-foreground')}>☀️ SPF daily</button>
              </div>

              <p className="text-[10px] text-warning uppercase tracking-wider mt-2">⚠️ Acute red flags (check any that apply)</p>
              <div className="grid grid-cols-1 gap-2">
                {[
                  'Unexplained weight loss >5kg in 6 months',
                  'Blood in stool or urine',
                  'Chest pain on exertion',
                  'Severe headache / vision changes',
                  'Persistent fever > 2 weeks',
                  'New lumps or masses',
                  'Fainting / syncope',
                  'Shortness of breath at rest',
                ].map(f => (
                  <button key={f} onClick={() => toggle<string>(setRedFlagsAcute as (fn: (p: string[]) => string[]) => void, f)} className={clsx('flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-left transition-all', redFlagsAcute.includes(f) ? 'bg-danger/20 text-danger border border-danger/50' : 'bg-card border border-card-border text-muted-foreground')}>
                    <div className={clsx('w-4 h-4 rounded border-2 flex items-center justify-center text-[10px]', redFlagsAcute.includes(f) ? 'bg-danger border-danger text-black' : 'border-card-border')}>{redFlagsAcute.includes(f) ? '✓' : ''}</div>
                    {f}
                  </button>
                ))}
              </div>
              {redFlagsAcute.length > 0 && (
                <p className="text-[10px] text-danger p-2 rounded-lg bg-danger/10 border border-danger/30">⚠️ See a doctor promptly — these symptoms need medical evaluation, not a supplement protocol.</p>
              )}
            </CollapseSection>

            {/* Environment */}
            <CollapseSection title="🌍 Environment & Exposures" expanded={lifestyleExpanded.environment} onToggle={() => setLifestyleExpanded(p => ({ ...p, environment: !p.environment }))}>
              <div><label className="text-xs text-muted-foreground">Housing type</label>
                <select value={housingType} onChange={e => setHousingType(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent">
                  <option value="">Select...</option>
                  <option value="apartment_city">Apartment — city center</option>
                  <option value="apartment_suburb">Apartment — suburban</option>
                  <option value="house_suburb">House — suburban</option>
                  <option value="house_rural">House — rural</option>
                  <option value="house_mountain">House — mountain / clean air</option>
                </select>
              </div>
              <div><label className="text-xs text-muted-foreground">Air pollution level where you live</label>
                <select value={pollutionLevel} onChange={e => setPollutionLevel(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent">
                  <option value="">Not sure</option>
                  <option value="very_low">Very low (rural, coast, mountain)</option>
                  <option value="low">Low</option>
                  <option value="moderate">Moderate (most cities)</option>
                  <option value="high">High (industrial / megacity)</option>
                  <option value="very_high">Very high</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setMoldAtHome(!moldAtHome)} className={clsx('p-3 rounded-xl text-xs text-center transition-all', moldAtHome ? 'bg-warning/20 text-warning border border-warning/50' : 'bg-card border border-card-border text-muted-foreground')}>🧪 Visible mold at home</button>
                <button onClick={() => setAirPurifier(!airPurifier)} className={clsx('p-3 rounded-xl text-xs text-center transition-all', airPurifier ? 'bg-accent/20 text-accent border border-accent/50' : 'bg-card border border-card-border text-muted-foreground')}>💨 Air purifier</button>
                <button onClick={() => setTeflonNonstick(!teflonNonstick)} className={clsx('p-3 rounded-xl text-xs text-center transition-all', teflonNonstick ? 'bg-warning/20 text-warning border border-warning/50' : 'bg-card border border-card-border text-muted-foreground')}>🍳 Teflon non-stick</button>
                <div className="col-span-1">
                  <label className="text-[10px] text-muted">Water filter</label>
                  <select value={waterFilter} onChange={e => setWaterFilter(e.target.value)} className="w-full mt-1 rounded-lg bg-card border border-card-border px-2 py-2 text-xs outline-none focus:border-accent">
                    <option value="">Select</option>
                    <option value="none">None — tap</option>
                    <option value="carbon">Carbon / pitcher</option>
                    <option value="ro">Reverse osmosis</option>
                    <option value="bottled">Bottled only</option>
                  </select>
                </div>
              </div>
              <div><label className="text-xs text-muted-foreground">Plastic food contact (water bottles, containers)</label>
                <select value={plasticFoodContact} onChange={e => setPlasticFoodContact(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent">
                  <option value="">Select...</option>
                  <option value="minimal">Minimal — glass / steel</option>
                  <option value="some">Some plastic</option>
                  <option value="heavy">Heavy — bottled water, microwave plastic</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Daily outdoor sunlight (minutes)</label>
                <input type="number" value={sunlightMinutes} onChange={e => setSunlightMinutes(e.target.value)} placeholder="20" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" />
              </div>
            </CollapseSection>

            {/* Social */}
            <CollapseSection title="👥 Social & Relationships" expanded={lifestyleExpanded.social} onToggle={() => setLifestyleExpanded(p => ({ ...p, social: !p.social }))}>
              <div><label className="text-xs text-muted-foreground">Relationship status</label>
                <select value={relationshipStatus} onChange={e => setRelationshipStatus(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent">
                  <option value="">Prefer not to say</option>
                  <option value="single">Single</option>
                  <option value="dating">Dating</option>
                  <option value="partnered">In a relationship</option>
                  <option value="married">Married / civil partnership</option>
                  <option value="divorced">Divorced / separated</option>
                  <option value="widowed">Widowed</option>
                </select>
              </div>
              <div><label className="text-xs text-muted-foreground mb-2 block">Relationship satisfaction (1-10): <span className="text-accent font-medium">{relationshipSatisfaction}</span></label>
                <input type="range" min={1} max={10} value={relationshipSatisfaction} onChange={e => setRelationshipSatisfaction(parseInt(e.target.value))} className="w-full h-2 bg-card-border rounded-lg appearance-none cursor-pointer accent-[#00ff88]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Close friends count</label>
                  <input type="number" value={closeFriendsCount} onChange={e => setCloseFriendsCount(e.target.value)} placeholder="3" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-2 block">Loneliness (1-10): <span className="text-accent font-medium">{lonelinessLevel}</span></label>
                  <input type="range" min={1} max={10} value={lonelinessLevel} onChange={e => setLonelinessLevel(parseInt(e.target.value))} className="w-full mt-2 h-2 bg-card-border rounded-lg appearance-none cursor-pointer accent-[#00ff88]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setPet(!pet)} className={clsx('p-3 rounded-xl text-xs text-center transition-all', pet ? 'bg-accent/20 text-accent border border-accent/50' : 'bg-card border border-card-border text-muted-foreground')}>🐶 Have a pet</button>
                <button onClick={() => setHasCommunity(!hasCommunity)} className={clsx('p-3 rounded-xl text-xs text-center transition-all', hasCommunity ? 'bg-accent/20 text-accent border border-accent/50' : 'bg-card border border-card-border text-muted-foreground')}>🏘️ Community / group</button>
              </div>
            </CollapseSection>
          </div>
        )}

        {/* STEP 3 — Day-to-Day */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl font-bold">Your Day-to-Day</h1>
              <p className="text-muted-foreground text-sm mt-1">Helps us build a protocol that fits your actual life.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-muted-foreground">Work starts</label><input type="time" value={workStart} onChange={e => setWorkStart(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
              <div><label className="text-xs text-muted-foreground">Work ends</label><input type="time" value={workEnd} onChange={e => setWorkEnd(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
            </div>
            <div><label className="text-xs text-muted-foreground mb-2 block">Work location</label>
              <div className="flex gap-2">
                {(['home', 'office', 'hybrid'] as const).map(v => (
                  <button key={v} onClick={() => setWorkLocation(v)} className={clsx('flex-1 py-2 rounded-xl text-xs font-medium capitalize transition-all', workLocation === v ? 'bg-accent text-black' : 'bg-card border border-card-border text-muted-foreground')}>{v}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-muted-foreground">Sitting hours/day: <span className="text-accent">{sittingHours}</span></label><input type="range" min={0} max={16} value={sittingHours} onChange={e => setSittingHours(parseInt(e.target.value))} className="w-full mt-2 h-2 bg-card-border rounded-lg appearance-none cursor-pointer accent-[#00ff88]" /></div>
              <div><label className="text-xs text-muted-foreground">Screen time/day: <span className="text-accent">{screenTime}h</span></label><input type="range" min={1} max={16} value={screenTime} onChange={e => setScreenTime(parseInt(e.target.value))} className="w-full mt-2 h-2 bg-card-border rounded-lg appearance-none cursor-pointer accent-[#00ff88]" /></div>
            </div>
            <div><label className="text-xs text-muted-foreground mb-2 block">Best time for exercise</label>
              <div className="grid grid-cols-5 gap-2">
                {(['morning', 'lunch', 'evening', 'weekends', 'inconsistent'] as const).map(v => (
                  <button key={v} onClick={() => setExerciseWindow(v)} className={clsx('py-2 rounded-xl text-[10px] font-medium capitalize transition-all', exerciseWindow === v ? 'bg-accent text-black' : 'bg-card border border-card-border text-muted-foreground')}>{v}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Biggest pain points (what bothers you most?)</label>
              <textarea value={painPoints} onChange={e => setPainPoints(e.target.value)} rows={3} placeholder="e.g. Afternoon energy crash at 2 PM, brain fog in meetings, lower back stiffness, can't fall asleep..." className="w-full rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent resize-none" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Non-negotiables (things you won&apos;t give up)</label>
              <textarea value={nonNegotiables} onChange={e => setNonNegotiables(e.target.value)} rows={2} placeholder="e.g. Friday pizza night, morning coffee, weekend drinks..." className="w-full rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent resize-none" />
            </div>
          </div>
        )}

        {/* STEP 4 — Goals */}
        {step === 4 && (
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl font-bold">Your Goals</h1>
              <p className="text-muted-foreground text-sm mt-1">What matters most?</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Primary goal (pick ONE)</label>
              <div className="grid grid-cols-2 gap-2">
                {GOALS.map(g => (
                  <button key={g} onClick={() => setPrimaryGoal(g)} className={clsx('p-3 rounded-xl text-sm text-left transition-all', primaryGoal === g ? 'bg-accent/10 border border-accent/50 text-accent' : 'bg-card border border-card-border text-muted-foreground')}>{g}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Secondary goals (up to 3)</label>
              <div className="grid grid-cols-2 gap-2">
                {GOALS.filter(g => g !== primaryGoal).map(g => (
                  <button key={g} onClick={() => {
                    if (secondaryGoals.includes(g)) setSecondaryGoals(p => p.filter(x => x !== g));
                    else if (secondaryGoals.length < 3) setSecondaryGoals(p => [...p, g]);
                  }} className={clsx('p-2 rounded-xl text-xs text-left transition-all', secondaryGoals.includes(g) ? 'bg-accent/10 border border-accent/50 text-accent' : 'bg-card border border-card-border text-muted-foreground')}>{g}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Specific target (optional)</label>
              <input type="text" value={specificTarget} onChange={e => setSpecificTarget(e.target.value)} placeholder="e.g. Lose 10kg by summer, HbA1c < 5.3" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent" />
            </div>
            <div><label className="text-xs text-muted-foreground mb-2 block">Commitment horizon</label>
              <div className="grid grid-cols-5 gap-2">
                {[{ v: 1, l: '1 mo' }, { v: 3, l: '3 mo' }, { v: 6, l: '6 mo' }, { v: 12, l: '1 yr' }, { v: 120, l: 'ongoing' }].map(({ v, l }) => (
                  <button key={v} onClick={() => setTimelineMonths(v)} className={clsx('py-2 rounded-xl text-xs font-medium transition-all', timelineMonths === v ? 'bg-accent text-black' : 'bg-card border border-card-border text-muted-foreground')}>{l}</button>
                ))}
              </div>
            </div>
            <div><label className="text-xs text-muted-foreground mb-2 block">Time available per day</label>
              <div className="flex gap-2">
                {[{ v: 30, l: '<30 min' }, { v: 60, l: '30-60' }, { v: 120, l: '1-2h' }, { v: 180, l: '2+h' }].map(({ v, l }) => (
                  <button key={v} onClick={() => setTimeBudget(v)} className={clsx('flex-1 py-2 rounded-xl text-xs font-medium transition-all', timeBudget === v ? 'bg-accent text-black' : 'bg-card border border-card-border text-muted-foreground')}>{l}</button>
                ))}
              </div>
            </div>
            <div><label className="text-xs text-muted-foreground mb-2 block">Monthly budget (RON)</label>
              <div className="flex gap-2">
                {[{ v: 200, l: '<200' }, { v: 500, l: '200-500' }, { v: 1500, l: '500-1500' }, { v: 5000, l: '1500+' }].map(({ v, l }) => (
                  <button key={v} onClick={() => setMonthlyBudget(v)} className={clsx('flex-1 py-2 rounded-xl text-xs font-medium transition-all', monthlyBudget === v ? 'bg-accent text-black' : 'bg-card border border-card-border text-muted-foreground')}>{l} RON</button>
                ))}
              </div>
            </div>
            <div><label className="text-xs text-muted-foreground mb-2 block">Experimental openness</label>
              <div className="space-y-2">
                {[{ v: 'otc_only', l: 'OTC Only', d: 'Over-the-counter supplements only' }, { v: 'open_rx', l: 'Open to Rx', d: 'Including prescription medication discussion' }, { v: 'open_experimental', l: 'Experimental', d: 'Peptides, advanced therapies, off-label' }].map(({ v, l, d }) => (
                  <button key={v} onClick={() => setExperimental(v)} className={clsx('w-full p-3 rounded-xl text-left transition-all', experimental === v ? 'bg-accent/10 border border-accent/50' : 'bg-card border border-card-border')}>
                    <span className={clsx('text-sm font-medium', experimental === v ? 'text-accent' : '')}>{l}</span>
                    <span className="text-xs text-muted-foreground ml-2">{d}</span>
                  </button>
                ))}
              </div>
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-t border-card-border px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] flex gap-3 justify-center">
        <div className="max-w-2xl w-full flex gap-3">
        {step > 0 && (
          <button onClick={handleBack} className="px-4 py-3 rounded-xl bg-card border border-card-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">← Back</button>
        )}
        <button
          onClick={() => step < 4 ? handleNext() : handleFinish()}
          disabled={!canNext() || loading}
          className="flex-1 py-3 rounded-xl bg-accent text-black font-semibold text-sm transition-all hover:bg-accent-dim active:scale-[0.98] disabled:opacity-40">
          {step < 4 ? 'Continue →' : '⚡ Generate Protocol'}
        </button>
        </div>
      </div>
    </div>
  );
}

function CollapseSection({ title, expanded, onToggle, children }: { title: string; expanded: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-card border border-card-border overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between p-4 text-left hover:bg-background/50 transition-colors">
        <span className="text-sm font-semibold">{title}</span>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted" /> : <ChevronDown className="w-4 h-4 text-muted" />}
      </button>
      {expanded && <div className="px-4 pb-4 space-y-3 border-t border-card-border">{children}</div>}
    </div>
  );
}
