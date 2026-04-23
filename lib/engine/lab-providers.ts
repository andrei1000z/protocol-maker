// Romanian lab providers — preset list with their typical naming
// conventions so the bloodwork parser + manual entry can suggest the
// right BIOMARKER_DB code from a provider's PDF or web result.
//
// "Preset" here means: when a user picks "Synevo", we know that "TGP"
// on their report is what we call ALT, "TGO" is AST, etc. Saves the
// user from manually mapping every line.
//
// All five major Romanian providers covered. International users can
// pick "Other" and parse generically — the AI parse-bloodwork route
// handles unknown formats anyway.

export interface LabProvider {
  id: string;
  name: string;
  /** Marketing URL — surfaces on the upload screen as "View provider's site". */
  url: string;
  /** Country code; we only ship RO for now but the column is here for
   *  when we add MD / DE / FR partners. */
  country: 'RO' | 'INT';
  /** Common provider-specific test names → our BIOMARKER_DB codes.
   *  Lookup is case-insensitive on the PDF text; partial-match wins.
   *  Empty for "Other" — the AI parser handles unknown formats. */
  aliases: Record<string, string>;
  /** Free-text note shown beneath the provider card — typical price band,
   *  panel name, scheduling tip. Helps users decide. */
  note?: string;
}

export const LAB_PROVIDERS: LabProvider[] = [
  {
    id: 'synevo',
    name: 'Synevo',
    url: 'https://www.synevo.ro',
    country: 'RO',
    aliases: {
      // Lipids
      'colesterol total':                'CHOL',
      'colesterol ldl':                  'LDL',
      'ldl colesterol':                  'LDL',
      'colesterol hdl':                  'HDL',
      'hdl colesterol':                  'HDL',
      'trigliceride':                    'TRIG',
      'apolipoproteina b':               'APOB',
      'lipoproteina a':                  'LPA',
      // Glucose / insulin
      'glicemie':                        'GLUC',
      'glucoza':                         'GLUC',
      'insulina':                        'INSULIN',
      'hemoglobina glicata':             'HBA1C',
      'hba1c':                           'HBA1C',
      // Inflammation
      'proteina c reactiva':             'HSCRP',
      'crp ultrasensibil':               'HSCRP',
      'crp hs':                          'HSCRP',
      'homocisteina':                    'HOMOCYS',
      // Liver
      'tgp':                             'ALT',
      'alt':                             'ALT',
      'tgo':                             'AST',
      'ast':                             'AST',
      'gamma gt':                        'GGT',
      'ggt':                             'GGT',
      'bilirubina totala':               'BILI',
      'fosfataza alcalina':              'ALP',
      'alp':                             'ALP',
      'albumina':                        'ALBUMIN',
      // Kidney
      'creatinina':                      'CREAT',
      'acid uric':                       'URIC_ACID',
      // Vitamins / minerals
      '25 oh vitamina d':                'VITD',
      'vitamina d 25 oh':                'VITD',
      'vitamina b12':                    'B12',
      'b12':                             'B12',
      'acid folic':                      'FOLAT',
      'folat':                           'FOLAT',
      'feritina':                        'FERRITIN',
      'fier':                            'IRON',
      'sideremie':                       'IRON',
      'magneziu':                        'MAGNE',
      // Hematology
      'hemoglobina':                     'HGB',
      'hematii':                         'RBC',
      'leucocite':                       'WBC',
      'trombocite':                      'PLT',
      'vem':                             'MCV',
      'mcv':                             'MCV',
      'rdw':                             'RDW',
      'limfocite':                       'LYMPH_PCT',
      // Thyroid + hormones
      'tsh':                             'TSH',
      'ft4':                             'FT4',
      'free t4':                         'FT4',
      'anti tpo':                        'ANTI_TPO',
      'testosteron':                     'TESTO',
      'estradiol':                       'ESTRADIOL',
      'cortizol':                        'CORTISOL',
      'dhea s':                          'DHEAS',
      'dhea-s':                          'DHEAS',
    },
    note: 'Largest network. Big-9 panel ~250 RON, comprehensive ~600 RON. Same-day results.',
  },
  {
    id: 'bioclinica',
    name: 'Bioclinica',
    url: 'https://www.bioclinica.ro',
    country: 'RO',
    aliases: {
      'colesterol total':                'CHOL',
      'ldl colesterol':                  'LDL',
      'hdl colesterol':                  'HDL',
      'trigliceride':                    'TRIG',
      'apo b':                           'APOB',
      'apolipoproteina b':               'APOB',
      'glicemie':                        'GLUC',
      'insulina':                        'INSULIN',
      'hemoglobina glicozilata':         'HBA1C',
      'crp hs':                          'HSCRP',
      'crp ultrasensibil':               'HSCRP',
      'homocisteina':                    'HOMOCYS',
      'alat':                            'ALT',
      'asat':                            'AST',
      'gama gt':                         'GGT',
      'creatinina serica':               'CREAT',
      'acid uric':                       'URIC_ACID',
      'vitamina d':                      'VITD',
      '25oh vitamina d':                 'VITD',
      'vitamina b12':                    'B12',
      'feritina':                        'FERRITIN',
      'sideremie':                       'IRON',
      'magneziu':                        'MAGNE',
      'tsh':                             'TSH',
      'ft4':                             'FT4',
      'testosteron total':               'TESTO',
      'estradiol':                       'ESTRADIOL',
      'cortizol matinal':                'CORTISOL',
      'hemograma':                       '',  // panel — needs further parsing
      'hemoglobina':                     'HGB',
      'leucocite':                       'WBC',
    },
    note: 'Strong on advanced cardio panels. ApoB included in standard lipid profile.',
  },
  {
    id: 'medlife',
    name: 'MedLife',
    url: 'https://www.medlife.ro',
    country: 'RO',
    aliases: {
      'colesterol total':                'CHOL',
      'ldl-c':                           'LDL',
      'hdl-c':                           'HDL',
      'trigliceride':                    'TRIG',
      'glicemie':                        'GLUC',
      'insulina serica':                 'INSULIN',
      'hba1c':                           'HBA1C',
      'crp':                             'HSCRP',
      'tgp (alt)':                       'ALT',
      'tgo (ast)':                       'AST',
      'ggt':                             'GGT',
      'creatinina':                      'CREAT',
      'acid uric':                       'URIC_ACID',
      '25-oh vitamina d':                'VITD',
      'vitamina b12':                    'B12',
      'feritina':                        'FERRITIN',
      'tsh':                             'TSH',
      'ft4':                             'FT4',
    },
    note: 'Clinic chain — convenient if you also want a follow-up consultation.',
  },
  {
    id: 'regina-maria',
    name: 'Regina Maria',
    url: 'https://www.reginamaria.ro',
    country: 'RO',
    aliases: {
      'colesterol total':                'CHOL',
      'ldl colesterol':                  'LDL',
      'hdl colesterol':                  'HDL',
      'trigliceride':                    'TRIG',
      'glicemie a jeun':                 'GLUC',
      'insulina':                        'INSULIN',
      'hba1c':                           'HBA1C',
      'crp hs':                          'HSCRP',
      'alt':                             'ALT',
      'ast':                             'AST',
      'gama-glutamil transferaza':       'GGT',
      'creatinina serica':               'CREAT',
      'acid uric':                       'URIC_ACID',
      'vitamina d 25-oh':                'VITD',
      'tsh ultrasensibil':               'TSH',
      'free t4':                         'FT4',
      'testosteron':                     'TESTO',
      'cortizol':                        'CORTISOL',
    },
    note: 'Premium provider — slightly higher price, includes home phlebotomy in Bucharest.',
  },
  {
    id: 'other',
    name: 'Other / international',
    url: '',
    country: 'INT',
    aliases: {},
    note: 'AI parser handles arbitrary formats — works on Quest, LabCorp, Synlab, NHS, etc.',
  },
];

/** Find a provider by id; defaults to "other" so callers don't need to null-check. */
export function getLabProvider(id: string): LabProvider {
  return LAB_PROVIDERS.find(p => p.id === id) ?? LAB_PROVIDERS[LAB_PROVIDERS.length - 1];
}

/** Map a provider's free-text test name to a BIOMARKER_DB code. Returns
 *  null when no alias matches — the AI parser is the fallback. */
export function resolveBiomarkerCode(providerId: string, testName: string): string | null {
  const provider = getLabProvider(providerId);
  const needle = testName.toLowerCase().trim();
  if (!needle) return null;

  // Exact match first.
  if (provider.aliases[needle]) return provider.aliases[needle] || null;

  // Substring match — handles "ldl colesterol direct" matching "ldl colesterol".
  for (const [key, code] of Object.entries(provider.aliases)) {
    if (key.length >= 4 && needle.includes(key)) return code || null;
  }
  return null;
}
