import { BiomarkerValue, DetectedPattern } from '../types';

type PatternRule = {
  name: string;
  description: string;
  check: (markers: Map<string, BiomarkerValue>) => { triggered: boolean; severity: DetectedPattern['severity']; triggeringMarkers: string[] };
  recommendations: string[];
};

const PATTERNS: PatternRule[] = [
  {
    name: 'Sindrom Metabolic',
    description: 'Cluster de risc: glicemie crescută + trigliceride mari + HDL scăzut. Predictor puternic de diabet tip 2 și boli cardiovasculare.',
    check: (m) => {
      const markers: string[] = [];
      let count = 0;
      const gluc = m.get('GLUC');
      if (gluc && gluc.value > 100) { count++; markers.push('GLUC'); }
      const trig = m.get('TRIG');
      if (trig && trig.value > 150) { count++; markers.push('TRIG'); }
      const hdl = m.get('HDL');
      if (hdl && hdl.value < 40) { count++; markers.push('HDL'); }
      const insulin = m.get('INSULIN');
      if (insulin && insulin.value > 10) { count++; markers.push('INSULIN'); }
      const hba1c = m.get('HBA1C');
      if (hba1c && hba1c.value > 5.6) { count++; markers.push('HBA1C'); }
      return {
        triggered: count >= 2,
        severity: count >= 4 ? 'critical' : count >= 3 ? 'high' : 'moderate',
        triggeringMarkers: markers,
      };
    },
    recommendations: [
      'Prioritate #1: reducerea rezistenței la insulină',
      'Time-restricted eating (16:8)',
      'Exerciții zilnice: mers 30 min după mese + forță 3x/săpt',
      'Berberină 1000mg/zi + Magneziu 400mg seara',
      'Discută metformină cu medicul',
    ],
  },
  {
    name: 'Cluster Inflamator',
    description: 'Inflamație sistemică cronică — accelerează dramatic îmbătrânirea și crește riscul de cancer, boli cardiovasculare și neurodegenerative.',
    check: (m) => {
      const markers: string[] = [];
      let count = 0;
      const hscrp = m.get('HSCRP');
      if (hscrp && hscrp.value > 1.0) { count++; markers.push('HSCRP'); }
      const wbc = m.get('WBC');
      if (wbc && wbc.value > 7.0) { count++; markers.push('WBC'); }
      const homocys = m.get('HOMOCYS');
      if (homocys && homocys.value > 10) { count++; markers.push('HOMOCYS'); }
      const ferritin = m.get('FERRITIN');
      if (ferritin && ferritin.value > 200) { count++; markers.push('FERRITIN'); }
      return {
        triggered: count >= 2,
        severity: count >= 3 ? 'high' : 'moderate',
        triggeringMarkers: markers,
      };
    },
    recommendations: [
      'Protocol anti-inflamator intensiv',
      'Omega-3 EPA/DHA 3g/zi',
      'Curcumină 1000mg cu piperină',
      'Eliminare alimente procesate 30 zile',
      'Verifică surse ascunse: dentare, intestinale, articulare',
    ],
  },
  {
    name: 'Disfuncție Tiroidiană',
    description: 'Indicii de hipotiroidism subclinic — afectează metabolismul, energia, greutatea și dispoziția.',
    check: (m) => {
      const markers: string[] = [];
      const tsh = m.get('TSH');
      if (tsh && tsh.value > 2.5) { markers.push('TSH'); }
      return {
        triggered: markers.length > 0,
        severity: tsh && tsh.value > 4.0 ? 'high' : 'moderate',
        triggeringMarkers: markers,
      };
    },
    recommendations: [
      'Panel tiroidian complet: FT3, FT4, anti-TPO, anti-TG',
      'Seleniu 200mcg/zi + Zinc 25mg/zi',
      'Verifică iod (analiza urinară)',
      'Consultație endocrinolog',
    ],
  },
  {
    name: 'Deficiențe Nutritive Multiple',
    description: 'Mai multe vitamine/minerale sub optimal — sugerează dietă inadecvată sau probleme de absorbție.',
    check: (m) => {
      const markers: string[] = [];
      const vitd = m.get('VITD');
      if (vitd && vitd.value < 30) markers.push('VITD');
      const b12 = m.get('B12');
      if (b12 && b12.value < 400) markers.push('B12');
      const ferritin = m.get('FERRITIN');
      if (ferritin && ferritin.value < 30) markers.push('FERRITIN');
      const folat = m.get('FOLAT');
      if (folat && folat.value < 10) markers.push('FOLAT');
      const magne = m.get('MAGNE');
      if (magne && magne.value < 1.8) markers.push('MAGNE');
      return {
        triggered: markers.length >= 2,
        severity: markers.length >= 4 ? 'high' : markers.length >= 3 ? 'moderate' : 'low',
        triggeringMarkers: markers,
      };
    },
    recommendations: [
      'Evaluare dietă curentă — posibilă malnutriție',
      'Verifică sănătatea intestinală (absorbție)',
      'Suplimentare țintită bazată pe deficiențe specifice',
      'Diversifică dieta: organ meats, leguminoase, vegetale colorate',
    ],
  },
  {
    name: 'Risc Cardiovascular Crescut',
    description: 'Profil lipidic suboptimal combinat cu inflamație — predictor puternic al evenimentelor cardiovasculare.',
    check: (m) => {
      const markers: string[] = [];
      let count = 0;
      const ldl = m.get('LDL');
      if (ldl && ldl.value > 130) { count++; markers.push('LDL'); }
      const trig = m.get('TRIG');
      if (trig && trig.value > 150) { count++; markers.push('TRIG'); }
      const hdl = m.get('HDL');
      if (hdl && hdl.value < 45) { count++; markers.push('HDL'); }
      const hscrp = m.get('HSCRP');
      if (hscrp && hscrp.value > 1.5) { count++; markers.push('HSCRP'); }
      const homocys = m.get('HOMOCYS');
      if (homocys && homocys.value > 12) { count++; markers.push('HOMOCYS'); }
      return {
        triggered: count >= 2,
        severity: count >= 4 ? 'critical' : count >= 3 ? 'high' : 'moderate',
        triggeringMarkers: markers,
      };
    },
    recommendations: [
      'Calcul scor ASCVD cu medicul',
      'Test ApoB + Lp(a) pentru profil complet',
      'Fibre 30g/zi + Omega-3 2g/zi',
      'Exerciții aerobice 150+ min/săpt',
      'Discută statin dacă scor ASCVD >7.5%',
    ],
  },
];

export function detectPatterns(biomarkers: BiomarkerValue[]): DetectedPattern[] {
  const markerMap = new Map<string, BiomarkerValue>();
  for (const b of biomarkers) markerMap.set(b.code, b);

  const detected: DetectedPattern[] = [];
  for (const pattern of PATTERNS) {
    const result = pattern.check(markerMap);
    if (result.triggered) {
      detected.push({
        name: pattern.name,
        severity: result.severity,
        description: pattern.description,
        triggeringMarkers: result.triggeringMarkers,
        recommendations: pattern.recommendations,
      });
    }
  }
  return detected.sort((a, b) => {
    const severityOrder = { critical: 0, high: 1, moderate: 2, low: 3 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}
