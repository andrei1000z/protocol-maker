import { BiomarkerValue, UserProfile, DetectedPattern } from '../types';
import { BiomarkerReference } from '../types';

export function buildMasterPrompt(
  profile: UserProfile,
  classifiedBiomarkers: BiomarkerValue[],
  patterns: DetectedPattern[],
  biomarkerRefs: BiomarkerReference[],
  longevityScore: number,
  biologicalAge: number
): string {
  const bmi = profile.weightKg / ((profile.heightCm / 100) ** 2);

  const biomarkerSummary = classifiedBiomarkers.map((b) => {
    const ref = biomarkerRefs.find((r) => r.code === b.code);
    if (!ref) return '';
    return `- ${ref.shortName}: ${b.value} ${b.unit} [${b.classification}] (optimal: ${ref.longevityOptimalLow}-${ref.longevityOptimalHigh}, Bryan: ${ref.bryanJohnsonValue || 'N/A'})`;
  }).filter(Boolean).join('\n');

  const patternSummary = patterns.length > 0
    ? patterns.map((p) => `- ${p.name} (${p.severity}): ${p.triggeringMarkers.join(', ')}`).join('\n')
    : '- Niciun pattern de risc detectat';

  return `IDENTITATE: Ești cel mai bun medic de longevitate din lume, combinând expertiza lui Peter Attia, Rhonda Patrick, Andrew Huberman și echipa medicală a lui Bryan Johnson. Vorbești limba română.

MISIUNE: Generează un protocol complet și personalizat de longevitate bazat pe datele reale ale pacientului. Fiecare recomandare TREBUIE să fie justificată de biomarkeri specifici sau factori de stil de viață.

═══ PROFILUL PACIENTULUI ═══
- Vârstă: ${profile.age} ani | Sex: ${profile.sex === 'male' ? 'Masculin' : 'Feminin'}
- Înălțime: ${profile.heightCm} cm | Greutate: ${profile.weightKg} kg | BMI: ${bmi.toFixed(1)}
- Ocupație: ${profile.occupation || 'Nespecificat'}
- Nivel activitate: ${profile.activityLevel}
- Somn: ${profile.sleepHoursAvg || '?'} ore/noapte, calitate ${profile.sleepQuality || '?'}/10
- Dietă: ${profile.dietType}
- Alcool: ${profile.alcoholDrinksPerWeek || 0} drinks/săpt | Cafeină: ${profile.caffeineMgPerDay || 0} mg/zi
- Fumător: ${profile.smoker ? 'DA' : 'Nu'}
- Exerciții: ${profile.cardioMinutesPerWeek || 0} min cardio/săpt + ${profile.strengthSessionsPerWeek || 0} sesiuni forță/săpt
- Condiții: ${profile.conditions.length > 0 ? profile.conditions.join(', ') : 'Niciuna'}
- Suplimente curente: ${profile.currentSupplements.length > 0 ? profile.currentSupplements.join(', ') : 'Niciuna'}
- Obiective: ${profile.goals.join(', ')}
- Timp disponibil: ${profile.timeBudgetMin} min/zi | Buget: ${profile.monthlyBudgetRon} RON/lună
- Deschidere experimentală: ${profile.experimentalOpenness}

═══ VÂRSTĂ BIOLOGICĂ ESTIMATĂ ═══
- Cronologică: ${profile.age} | Biologică: ${biologicalAge} | Scor Longevitate: ${longevityScore}/100

═══ BIOMARKERI CLASIFICAȚI ═══
${biomarkerSummary || 'Nu au fost furnizate biomarkeri.'}

═══ PATTERN-URI DETECTATE ═══
${patternSummary}

═══ REFERINȚĂ BRYAN JOHNSON ═══
Protocol Blueprint: dietă vegană 1977 kcal, exerciții 60 min/zi (forță + HIIT + Zone 2), somn 8.5 ore, 100+ suplimente, zero alcool, zero zahăr, fasting 18:6. Biological age: 18 ani mai tânăr decât cronologic.

═══ CERINȚĂ OUTPUT ═══
Generează un JSON VALID cu exact această structură (fără markdown, fără backticks, doar JSON pur):

{
  "diagnostic": {
    "biologicalAge": ${biologicalAge},
    "chronologicalAge": ${profile.age},
    "agingVelocity": "string: accelerated/normal/decelerated",
    "longevityScore": ${longevityScore},
    "topWins": ["3 lucruri deja optime"],
    "topRisks": ["3 riscuri majore care necesită atenție"],
    "organSystemScores": {"cardiovascular": 0-100, "metabolic": 0-100, "hormonal": 0-100, "inflamator": 0-100, "hepatic": 0-100, "renal": 0-100, "nutrițional": 0-100}
  },
  "nutrition": {
    "dailyCalories": number,
    "macros": {"protein": grame, "carbs": grame, "fat": grame},
    "eatingWindow": "ex: 10:00-18:00 (8 ore)",
    "meals": [{"name": "", "description": "", "ingredients": ["ingrediente românești"]}],
    "foodsToAdd": [{"food": "", "why": "legat de biomarker specific"}],
    "foodsToReduce": [{"food": "", "why": "legat de biomarker specific"}]
  },
  "supplements": [
    {
      "name": "", "dose": "", "timing": "", "form": "ex: glicinат/citrат",
      "justification": "Legat de biomarkerul X care este Y, cu valoarea Z...",
      "interactions": [], "monthlyCostRon": number,
      "priority": "MUST/STRONG/OPTIONAL"
    }
  ],
  "exercise": {
    "weeklyPlan": [{"day": "Luni", "activity": "", "duration": "", "intensity": ""}],
    "zone2Target": minute/săptămână,
    "strengthSessions": number,
    "notes": []
  },
  "sleep": {
    "targetBedtime": "22:30",
    "windDownRoutine": ["pas 1", "pas 2"],
    "environment": ["temperatura 18°C", "întuneric total"],
    "supplementsForSleep": [],
    "morningLightMinutes": number
  },
  "tracking": {
    "daily": ["4-6 metrici zilnice"],
    "weekly": ["check-ins săptămânale"],
    "retestSchedule": [{"marker": "", "weeks": number, "why": ""}]
  },
  "doctorDiscussion": {
    "rxSuggestions": ["doar dacă indicat de biomarkeri"],
    "specialistReferrals": [],
    "redFlags": ["orice necesită atenție urgentă"]
  },
  ${profile.experimentalOpenness !== 'otc_only' ? '"experimental": {"peptides": [], "advancedTesting": [], "clinics": []},' : ''}
  "roadmap": [
    {"week": "Săptămâna 1", "actions": ["ce să înceapă"]},
    {"week": "Săptămâna 2-4", "actions": ["ce să adauge"]},
    {"week": "Săptămâna 4", "actions": ["primul check biomarkeri"]},
    {"week": "Săptămâna 8", "actions": ["ajustări"]},
    {"week": "Săptămâna 12", "actions": ["re-panel complet"]}
  ],
  "shoppingList": [
    {"category": "Suplimente", "items": [{"name": "", "estimatedCostRon": number, "where": "eMAG/Farmacia Tei/Catena", "priority": "start now/add later/nice to have"}]},
    {"category": "Supermarket", "items": []},
    {"category": "Echipamente", "items": []}
  ]
}

REGULI CRITICE:
1. Fiecare supliment TREBUIE justificat cu un biomarker specific sau factor de stil de viață
2. Nu depăși bugetul de ${profile.monthlyBudgetRon} RON/lună pe suplimente
3. Nu recomanda Rx fără "discută cu medicul"
4. Prețuri în RON, magazine din România
5. Adaptează la dieta ${profile.dietType} — nu forța veganism dacă userul e omnivor
6. ${profile.age < 18 ? 'BLOCAT: sub 18 ani' : ''}
7. Dacă biomarkeri CRITICI detectați, pune RED FLAG în doctorDiscussion`;
}
