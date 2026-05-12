// FHIR R4 → BIOMARKER_DB mapping.
//
// Most EU lab networks (Synevo, Bioclinica, Regina Maria when integrated)
// can export individual lab results as a FHIR Observation resource or a
// Bundle of them. The shape is open standard and stable.
//
// Why this exists: PDF parsing is fragile and slow (10 MB cap, Groq API
// call, OCR if scanned). When a user can hand us a FHIR JSON export
// instead, we skip that whole path and get exact values with units already
// normalized.
//
// Map: LOINC codes → our biomarker.code identifiers. The LOINC codes we
// support today are the 40 biomarkers in lib/engine/biomarkers.ts; anything
// else in the bundle is silently ignored (logged in summary).
//
// Reference: https://www.hl7.org/fhir/observation.html

export interface FhirObservation {
  resourceType?: 'Observation';
  status?: string;
  code?: {
    coding?: Array<{ system?: string; code?: string; display?: string }>;
  };
  valueQuantity?: { value?: number; unit?: string; code?: string };
  effectiveDateTime?: string;
  issued?: string;
}

export interface FhirBundle {
  resourceType?: 'Bundle';
  type?: string;
  entry?: Array<{ resource?: FhirObservation }>;
}

export interface ParsedBiomarker {
  code: string;       // our internal biomarker code
  value: number;
  unit: string;
  takenAt?: string;   // ISO timestamp from effectiveDateTime/issued
}

// LOINC → internal code. Conservative: only the markers we trust the
// mapping for end up here. Add more as we verify they line up with our
// BIOMARKER_DB unit conventions. Sources: loinc.org, FHIR mappings,
// Synevo XML exports.
const LOINC_TO_BIOMARKER: Record<string, string> = {
  '2093-3': 'chol_total',
  '2085-9': 'hdl',
  '2089-1': 'ldl',
  '13457-7': 'ldl',          // calculated LDL
  '2571-8': 'triglycerides',
  '49136-9': 'apob',
  '4548-4': 'hba1c',
  '1558-6': 'fasting_glucose',
  '14749-6': 'fasting_glucose',
  '14647-2': 'cholesterol',
  '30522-7': 'hscrp',         // high-sensitivity CRP
  '76485-2': 'hscrp',
  '1988-5': 'crp',
  '15067-2': 'homocysteine',
  '2986-8': 'testosterone',
  '14635-7': 'shbg',
  '2243-4': 'estradiol',
  '14723-6': 'estradiol',
  '14920-8': 'free_t4',
  '14999-2': 'free_t4',
  '11580-8': 'tsh',
  '14999-2-alt': 'free_t3',
  '14928-1': 'vitamin_d',
  '1989-3': 'vitamin_d',
  '49498-9': 'ferritin',
  '2276-4': 'ferritin',
  '787-2': 'mcv',
  '789-8': 'rbc',
  '718-7': 'hemoglobin',
  '4544-3': 'hematocrit',
  '777-3': 'platelets',
  '6690-2': 'wbc',
  '777-3-alt': 'platelets',
  '3016-3': 'tsh',
  '14627-4': 'free_t3',
  '1742-6': 'alt',
  '1920-8': 'ast',
  '6768-6': 'alkaline_phosphatase',
  '1751-7': 'albumin',
  '14937-2': 'creatinine',
  '2160-0': 'creatinine',
  '2823-3': 'potassium',
  '2951-2': 'sodium',
  '2075-0': 'chloride',
  '14685-7': 'b12',
  '2132-9': 'b12',
  '2284-8': 'folate',
};

// Pull every Observation out of the bundle. Each observation is required
// to have a coded value and a numeric quantity. Anything missing those
// silently drops out.
export function extractObservations(input: FhirBundle | FhirObservation | FhirObservation[]): FhirObservation[] {
  if (Array.isArray(input)) return input;
  if (input.resourceType === 'Bundle') {
    const entries = (input as FhirBundle).entry || [];
    return entries.map(e => e.resource).filter((r): r is FhirObservation => !!r && r.resourceType === 'Observation');
  }
  return [input as FhirObservation];
}

export interface ParseResult {
  biomarkers: ParsedBiomarker[];
  unmapped: Array<{ loinc?: string; display?: string }>;
}

export function parseFhirObservations(input: FhirBundle | FhirObservation | FhirObservation[]): ParseResult {
  const observations = extractObservations(input);
  const biomarkers: ParsedBiomarker[] = [];
  const unmapped: Array<{ loinc?: string; display?: string }> = [];

  for (const obs of observations) {
    const coding = obs.code?.coding || [];
    const loincEntry = coding.find(c => /loinc/i.test(c.system || '')) || coding[0];
    const loinc = loincEntry?.code;
    const display = loincEntry?.display;

    if (!loinc) continue;
    const internal = LOINC_TO_BIOMARKER[loinc];
    if (!internal) {
      unmapped.push({ loinc, display });
      continue;
    }

    const q = obs.valueQuantity;
    if (!q || typeof q.value !== 'number' || !Number.isFinite(q.value)) continue;

    biomarkers.push({
      code: internal,
      value: q.value,
      unit: q.unit || q.code || '',
      takenAt: obs.effectiveDateTime || obs.issued,
    });
  }

  return { biomarkers, unmapped };
}
