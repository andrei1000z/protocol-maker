// Drug-supplement interaction database
// Sources: examine.com, drugs.com, clinical guidelines

interface Interaction {
  supplement: string;
  drug: string;
  severity: 'mild' | 'moderate' | 'severe';
  description: string;
}

const INTERACTIONS: Interaction[] = [
  // Blood thinners
  { supplement: 'Omega-3', drug: 'warfarin', severity: 'moderate', description: 'May increase bleeding risk. Monitor INR closely.' },
  { supplement: 'Omega-3', drug: 'aspirin', severity: 'mild', description: 'Additive antiplatelet effect. Usually safe at normal doses.' },
  { supplement: 'Vitamin E', drug: 'warfarin', severity: 'severe', description: 'Significantly increases bleeding risk. Avoid combination.' },
  { supplement: 'Curcumin', drug: 'warfarin', severity: 'moderate', description: 'May enhance anticoagulant effect. Monitor INR.' },
  { supplement: 'Ginkgo', drug: 'warfarin', severity: 'severe', description: 'Significantly increases bleeding risk. Contraindicated.' },

  // Diabetes medications
  { supplement: 'Berberine', drug: 'metformin', severity: 'moderate', description: 'Both lower blood sugar. Risk of hypoglycemia. Start low, monitor glucose.' },
  { supplement: 'Chromium', drug: 'metformin', severity: 'mild', description: 'Additive glucose-lowering effect. Monitor blood sugar.' },
  { supplement: 'Magnesium', drug: 'metformin', severity: 'mild', description: 'Metformin depletes magnesium. Supplementation is actually recommended.' },

  // Thyroid medications
  { supplement: 'Iron', drug: 'levothyroxine', severity: 'moderate', description: 'Iron blocks thyroid hormone absorption. Take 4+ hours apart.' },
  { supplement: 'Calcium', drug: 'levothyroxine', severity: 'moderate', description: 'Calcium blocks absorption. Take 4+ hours apart.' },
  { supplement: 'Magnesium', drug: 'levothyroxine', severity: 'mild', description: 'May reduce absorption. Take 4+ hours apart.' },

  // Blood pressure medications
  { supplement: 'Potassium', drug: 'lisinopril', severity: 'severe', description: 'ACE inhibitors raise potassium. Adding potassium risks hyperkalemia.' },
  { supplement: 'CoQ10', drug: 'lisinopril', severity: 'mild', description: 'CoQ10 may lower blood pressure further. Monitor.' },
  { supplement: 'Magnesium', drug: 'amlodipine', severity: 'mild', description: 'Additive blood pressure lowering. Usually beneficial.' },

  // Statins
  { supplement: 'CoQ10', drug: 'atorvastatin', severity: 'mild', description: 'Statins deplete CoQ10. Supplementation is recommended.' },
  { supplement: 'CoQ10', drug: 'rosuvastatin', severity: 'mild', description: 'Statins deplete CoQ10. Supplementation is recommended.' },
  { supplement: 'Red yeast rice', drug: 'atorvastatin', severity: 'severe', description: 'Contains lovastatin. Double statin dosing risk. Contraindicated.' },
  { supplement: 'Niacin', drug: 'atorvastatin', severity: 'moderate', description: 'Increased risk of myopathy. Use with caution.' },

  // SSRIs
  { supplement: '5-HTP', drug: 'sertraline', severity: 'severe', description: 'Risk of serotonin syndrome. Contraindicated.' },
  { supplement: 'St. John\'s Wort', drug: 'sertraline', severity: 'severe', description: 'Risk of serotonin syndrome. Contraindicated.' },
  { supplement: 'SAMe', drug: 'sertraline', severity: 'moderate', description: 'May increase serotonergic activity. Use with caution.' },
  { supplement: 'Ashwagandha', drug: 'sertraline', severity: 'mild', description: 'May enhance calming effect. Generally safe.' },

  // General
  { supplement: 'Vitamin K', drug: 'warfarin', severity: 'severe', description: 'Vitamin K directly counteracts warfarin. Keep intake consistent.' },
  { supplement: 'NAC', drug: 'nitroglycerin', severity: 'moderate', description: 'NAC can enhance hypotensive effects of nitrates.' },
  { supplement: 'Melatonin', drug: 'immunosuppressants', severity: 'moderate', description: 'Melatonin can stimulate immune function, potentially counteracting immunosuppression.' },
];

export function checkInteractions(supplements: string[], medications: { name: string }[]): Interaction[] {
  const found: Interaction[] = [];
  const medNames = medications.map(m => m.name.toLowerCase());

  for (const interaction of INTERACTIONS) {
    const supMatch = supplements.some(s => s.toLowerCase().includes(interaction.supplement.toLowerCase()));
    const drugMatch = medNames.some(m => m.includes(interaction.drug.toLowerCase()));

    if (supMatch && drugMatch) {
      found.push(interaction);
    }
  }

  return found.sort((a, b) => {
    const order = { severe: 0, moderate: 1, mild: 2 };
    return order[a.severity] - order[b.severity];
  });
}
