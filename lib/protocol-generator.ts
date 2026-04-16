import { calculateBMI, getBMICategory } from './utils';

export function buildProtocolPrompt(data: {
  name: string;
  age: number;
  sex: string;
  height: number;
  weight: number;
  goals: string[];
  fitnessLevel: string;
}) {
  const bmi = calculateBMI(data.weight, data.height);
  const bmiCategory = getBMICategory(bmi);

  return `Ești un nutriționist și trainer personal expert. Generează un protocol personalizat de sănătate și fitness.

PROFIL:
- Nume: ${data.name}
- Vârstă: ${data.age} ani
- Sex: ${data.sex === 'M' ? 'Masculin' : 'Feminin'}
- Înălțime: ${data.height} cm
- Greutate: ${data.weight} kg
- BMI: ${bmi} (${bmiCategory})
- Nivel fitness: ${data.fitnessLevel}
- Obiective: ${data.goals.join(', ')}

INSTRUCȚIUNI:
1. Calculează macro-uri zilnice target (calorii, proteine, carbohidrați, grăsimi) bazate pe profil și obiective
2. Generează o listă de task-uri zilnice organizate pe categorii (dimineață, antrenament, nutriție, seară, sănătate)
3. Recomandă suplimente potrivite cu doze și timing
4. Oferă 3-5 tips personalizate
5. Adaugă warning-uri medicale dacă e cazul (vârstă, BMI, restricții)
6. Scrie un sumar de 2-3 propoziții despre protocol

Răspunde STRICT în acest format JSON (fără markdown, fără backticks):
{
  "macroTargets": {
    "calories": number,
    "protein": number (grame),
    "carbs": number (grame),
    "fat": number (grame)
  },
  "dailyTasks": [
    { "name": "descriere task", "category": "dimineață|antrenament|nutriție|seară|sănătate" }
  ],
  "supplements": [
    { "name": "nume supliment", "dose": "doză", "timing": "când" }
  ],
  "tips": ["tip1", "tip2"],
  "warnings": ["warning dacă e cazul"],
  "summary": "sumar protocol"
}`;
}
