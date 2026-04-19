// Device catalog — maps wearable brands to their popular models + what each
// model can actually measure. The onboarding UI lets users pick a brand → model,
// and the master prompt receives the capability list so it knows what the user
// can track daily (e.g. "user has Oura Ring Gen 4 — can surface HRV + deep sleep").
//
// Capabilities use the same metric keys we store in daily_metrics, so tracking
// forms can be auto-populated based on device support.

export type MetricCapability =
  | 'heart_rate'
  | 'resting_hr'
  | 'hrv'
  | 'sleep_stages'
  | 'sleep_score'
  | 'blood_oxygen'
  | 'skin_temp'
  | 'steps'
  | 'active_time'
  | 'vo2max'
  | 'stress'
  | 'ecg'
  | 'body_battery'
  | 'respiration_rate'
  | 'cycle_tracking'
  | 'calories_burned'
  | 'floors_climbed'
  | 'gps_workouts'
  | 'blood_pressure'
  | 'afib_detection'
  | 'fall_detection'
  | 'glucose_trends';

export interface DeviceModel {
  name: string;
  capabilities: MetricCapability[];
}

export interface DeviceBrand {
  name: string;
  models: DeviceModel[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Capability presets — reduce repetition, keep declarations readable
// ─────────────────────────────────────────────────────────────────────────────
const BASIC: MetricCapability[] = [
  'heart_rate', 'resting_hr', 'sleep_stages', 'sleep_score', 'steps', 'active_time', 'calories_burned',
];
const MID: MetricCapability[] = [
  ...BASIC, 'hrv', 'blood_oxygen', 'vo2max', 'stress', 'respiration_rate',
];
const FLAGSHIP: MetricCapability[] = [
  ...MID, 'ecg', 'skin_temp', 'floors_climbed', 'gps_workouts',
];
const ULTRA: MetricCapability[] = [
  ...FLAGSHIP, 'afib_detection', 'fall_detection', 'body_battery',
];
const RING_CORE: MetricCapability[] = [
  'heart_rate', 'resting_hr', 'hrv', 'sleep_stages', 'sleep_score', 'skin_temp', 'respiration_rate', 'cycle_tracking',
];
const RING_PLUS: MetricCapability[] = [
  ...RING_CORE, 'blood_oxygen', 'stress',
];

// ─────────────────────────────────────────────────────────────────────────────
// SMARTWATCHES
// ─────────────────────────────────────────────────────────────────────────────
export const SMARTWATCH_BRANDS: DeviceBrand[] = [
  {
    name: 'Apple Watch',
    models: [
      { name: 'Ultra 3 (2025)',            capabilities: [...ULTRA, 'blood_pressure'] },
      { name: 'Ultra 2',                   capabilities: ULTRA },
      { name: 'Ultra (1st gen)',           capabilities: ULTRA },
      { name: 'Series 10',                 capabilities: [...FLAGSHIP, 'afib_detection', 'fall_detection'] },
      { name: 'Series 9',                  capabilities: [...FLAGSHIP, 'afib_detection', 'fall_detection'] },
      { name: 'Series 8',                  capabilities: [...FLAGSHIP, 'afib_detection', 'fall_detection'] },
      { name: 'Series 7',                  capabilities: [...FLAGSHIP, 'fall_detection'] },
      { name: 'Series 6',                  capabilities: [...FLAGSHIP, 'fall_detection'] },
      { name: 'Series 5',                  capabilities: MID },
      { name: 'Series 4',                  capabilities: [...MID, 'ecg'] },
      { name: 'Series 3',                  capabilities: BASIC },
      { name: 'SE (3rd gen, 2025)',        capabilities: FLAGSHIP },
      { name: 'SE (2nd gen)',              capabilities: MID },
      { name: 'SE (1st gen)',              capabilities: BASIC },
    ],
  },
  {
    name: 'Samsung Galaxy Watch',
    models: [
      { name: 'Galaxy Watch 8 Ultra',      capabilities: [...FLAGSHIP, 'afib_detection', 'blood_pressure', 'body_battery'] },
      { name: 'Galaxy Watch 8',            capabilities: [...FLAGSHIP, 'afib_detection', 'blood_pressure'] },
      { name: 'Galaxy Watch 8 Classic',    capabilities: [...FLAGSHIP, 'afib_detection', 'blood_pressure'] },
      { name: 'Galaxy Watch 7 Ultra',      capabilities: [...FLAGSHIP, 'afib_detection', 'blood_pressure'] },
      { name: 'Galaxy Watch 7',            capabilities: [...FLAGSHIP, 'afib_detection', 'blood_pressure'] },
      { name: 'Galaxy Watch 7 FE',         capabilities: FLAGSHIP },
      { name: 'Galaxy Watch 6',            capabilities: [...FLAGSHIP, 'blood_pressure'] },
      { name: 'Galaxy Watch 6 Classic',    capabilities: [...FLAGSHIP, 'blood_pressure'] },
      { name: 'Galaxy Watch 5',            capabilities: [...MID, 'ecg', 'skin_temp', 'blood_pressure'] },
      { name: 'Galaxy Watch 5 Pro',        capabilities: [...MID, 'ecg', 'skin_temp', 'blood_pressure'] },
      { name: 'Galaxy Watch 4',            capabilities: [...MID, 'ecg', 'blood_pressure'] },
      { name: 'Galaxy Watch 4 Classic',    capabilities: [...MID, 'ecg', 'blood_pressure'] },
      { name: 'Galaxy Watch Active 2',     capabilities: MID },
      { name: 'Galaxy Watch 3',            capabilities: [...MID, 'blood_pressure'] },
      { name: 'Galaxy Fit 3',              capabilities: BASIC },
      { name: 'Galaxy Fit 2',              capabilities: BASIC },
    ],
  },
  {
    name: 'Google Pixel Watch',
    models: [
      { name: 'Pixel Watch 3 (XL 45mm)',   capabilities: [...FLAGSHIP, 'afib_detection', 'fall_detection'] },
      { name: 'Pixel Watch 3 (41mm)',      capabilities: [...FLAGSHIP, 'afib_detection', 'fall_detection'] },
      { name: 'Pixel Watch 2',             capabilities: [...FLAGSHIP, 'fall_detection'] },
      { name: 'Pixel Watch (1st gen)',     capabilities: [...MID, 'ecg', 'fall_detection'] },
    ],
  },
  {
    name: 'Garmin',
    models: [
      { name: 'Fenix 8',                   capabilities: [...FLAGSHIP, 'body_battery', 'afib_detection'] },
      { name: 'Fenix 8 Solar',             capabilities: [...FLAGSHIP, 'body_battery', 'afib_detection'] },
      { name: 'Fenix 7',                   capabilities: [...FLAGSHIP, 'body_battery'] },
      { name: 'Fenix 7 Pro',               capabilities: [...FLAGSHIP, 'body_battery'] },
      { name: 'Fenix 7X',                  capabilities: [...FLAGSHIP, 'body_battery'] },
      { name: 'Fenix 6',                   capabilities: [...MID, 'body_battery', 'gps_workouts'] },
      { name: 'Fenix 6 Pro',               capabilities: [...MID, 'body_battery', 'gps_workouts'] },
      { name: 'Fenix 5',                   capabilities: [...BASIC, 'gps_workouts'] },
      { name: 'Epix Pro (Gen 2)',          capabilities: [...FLAGSHIP, 'body_battery'] },
      { name: 'Epix (Gen 2)',              capabilities: [...FLAGSHIP, 'body_battery'] },
      { name: 'Enduro 3',                  capabilities: [...FLAGSHIP, 'body_battery'] },
      { name: 'Enduro 2',                  capabilities: [...MID, 'body_battery', 'gps_workouts'] },
      { name: 'Tactix 7',                  capabilities: [...FLAGSHIP, 'body_battery'] },
      { name: 'Forerunner 965',            capabilities: [...FLAGSHIP, 'body_battery'] },
      { name: 'Forerunner 955',            capabilities: [...FLAGSHIP, 'body_battery'] },
      { name: 'Forerunner 945',            capabilities: [...MID, 'body_battery', 'gps_workouts'] },
      { name: 'Forerunner 570',            capabilities: [...FLAGSHIP, 'body_battery'] },
      { name: 'Forerunner 265',            capabilities: [...MID, 'body_battery', 'gps_workouts'] },
      { name: 'Forerunner 255',            capabilities: [...MID, 'body_battery', 'gps_workouts'] },
      { name: 'Forerunner 165',            capabilities: [...MID, 'body_battery'] },
      { name: 'Forerunner 55',             capabilities: [...BASIC, 'gps_workouts'] },
      { name: 'Forerunner 45',             capabilities: [...BASIC, 'gps_workouts'] },
      { name: 'Venu 3',                    capabilities: [...MID, 'body_battery', 'ecg'] },
      { name: 'Venu 2 Plus',               capabilities: [...MID, 'body_battery'] },
      { name: 'Venu 2',                    capabilities: [...MID, 'body_battery'] },
      { name: 'Venu Sq 2',                 capabilities: [...BASIC, 'body_battery'] },
      { name: 'Vivoactive 5',              capabilities: [...MID, 'body_battery'] },
      { name: 'Vivoactive 4',              capabilities: [...BASIC, 'body_battery'] },
      { name: 'Vivomove Sport',            capabilities: BASIC },
      { name: 'Instinct 2',                capabilities: [...BASIC, 'body_battery', 'gps_workouts'] },
      { name: 'Instinct 2X Solar',         capabilities: [...BASIC, 'body_battery', 'gps_workouts'] },
      { name: 'Instinct Crossover',        capabilities: [...BASIC, 'body_battery'] },
      { name: 'Lily 2',                    capabilities: BASIC },
      { name: 'Vivosmart 5',               capabilities: [...BASIC, 'stress'] },
    ],
  },
  {
    name: 'Fitbit',
    models: [
      { name: 'Sense 3',                   capabilities: [...MID, 'ecg', 'skin_temp'] },
      { name: 'Sense 2',                   capabilities: [...MID, 'ecg', 'skin_temp'] },
      { name: 'Sense',                     capabilities: [...MID, 'ecg', 'skin_temp'] },
      { name: 'Versa 4',                   capabilities: MID },
      { name: 'Versa 3',                   capabilities: MID },
      { name: 'Versa 2',                   capabilities: BASIC },
      { name: 'Charge 6',                  capabilities: [...MID, 'ecg'] },
      { name: 'Charge 5',                  capabilities: [...MID, 'ecg', 'skin_temp'] },
      { name: 'Charge 4',                  capabilities: [...BASIC, 'blood_oxygen'] },
      { name: 'Inspire 3',                 capabilities: BASIC },
      { name: 'Inspire 2',                 capabilities: BASIC },
      { name: 'Luxe',                      capabilities: BASIC },
      { name: 'Ace LTE (kids)',            capabilities: ['heart_rate', 'steps', 'active_time'] },
    ],
  },
  {
    name: 'WHOOP',
    models: [
      { name: 'WHOOP 5.0',                 capabilities: ['heart_rate', 'resting_hr', 'hrv', 'sleep_stages', 'sleep_score', 'blood_oxygen', 'skin_temp', 'respiration_rate', 'stress', 'ecg'] },
      { name: 'WHOOP MG (Medical)',        capabilities: ['heart_rate', 'resting_hr', 'hrv', 'sleep_stages', 'sleep_score', 'blood_oxygen', 'skin_temp', 'respiration_rate', 'stress', 'ecg', 'afib_detection', 'blood_pressure'] },
      { name: 'WHOOP 4.0',                 capabilities: ['heart_rate', 'resting_hr', 'hrv', 'sleep_stages', 'sleep_score', 'blood_oxygen', 'skin_temp', 'respiration_rate', 'stress'] },
      { name: 'WHOOP 3.0',                 capabilities: ['heart_rate', 'resting_hr', 'hrv', 'sleep_stages', 'sleep_score', 'respiration_rate'] },
    ],
  },
  {
    name: 'Polar',
    models: [
      { name: 'Vantage V3',                capabilities: [...FLAGSHIP, 'body_battery'] },
      { name: 'Vantage V2',                capabilities: [...MID, 'gps_workouts'] },
      { name: 'Vantage M3',                capabilities: [...MID, 'gps_workouts'] },
      { name: 'Vantage M2',                capabilities: [...BASIC, 'gps_workouts'] },
      { name: 'Grit X2 Pro',               capabilities: [...FLAGSHIP, 'body_battery'] },
      { name: 'Grit X Pro',                capabilities: [...MID, 'gps_workouts'] },
      { name: 'Pacer Pro',                 capabilities: [...MID, 'gps_workouts'] },
      { name: 'Pacer',                     capabilities: [...BASIC, 'gps_workouts'] },
      { name: 'Ignite 3',                  capabilities: MID },
      { name: 'Ignite 2',                  capabilities: BASIC },
      { name: 'Unite',                     capabilities: BASIC },
    ],
  },
  {
    name: 'Coros',
    models: [
      { name: 'Apex 2 Pro',                capabilities: [...FLAGSHIP, 'gps_workouts'] },
      { name: 'Apex 2',                    capabilities: [...MID, 'gps_workouts'] },
      { name: 'Pace 3',                    capabilities: [...MID, 'gps_workouts'] },
      { name: 'Pace 2',                    capabilities: [...BASIC, 'gps_workouts'] },
      { name: 'Vertix 2S',                 capabilities: [...FLAGSHIP, 'gps_workouts'] },
      { name: 'Vertix 2',                  capabilities: [...FLAGSHIP, 'gps_workouts'] },
      { name: 'Dura',                      capabilities: [...MID, 'gps_workouts'] },
    ],
  },
  {
    name: 'Suunto',
    models: [
      { name: 'Race S',                    capabilities: [...FLAGSHIP, 'gps_workouts'] },
      { name: 'Race',                      capabilities: [...FLAGSHIP, 'gps_workouts'] },
      { name: 'Vertical',                  capabilities: [...FLAGSHIP, 'gps_workouts'] },
      { name: 'Ocean',                     capabilities: [...FLAGSHIP, 'gps_workouts'] },
      { name: '9 Peak Pro',                capabilities: [...MID, 'gps_workouts'] },
      { name: '9 Peak',                    capabilities: [...MID, 'gps_workouts'] },
      { name: '5 Peak',                    capabilities: [...BASIC, 'gps_workouts'] },
    ],
  },
  {
    name: 'Xiaomi / Amazfit',
    models: [
      { name: 'Amazfit T-Rex 3',           capabilities: [...FLAGSHIP, 'gps_workouts'] },
      { name: 'Amazfit T-Rex Ultra',       capabilities: [...MID, 'gps_workouts'] },
      { name: 'Amazfit Balance',           capabilities: [...MID, 'stress'] },
      { name: 'Amazfit Cheetah Pro',       capabilities: [...MID, 'gps_workouts'] },
      { name: 'Amazfit Active Edge',       capabilities: MID },
      { name: 'Amazfit Active 2',          capabilities: MID },
      { name: 'Amazfit GTR Mini',          capabilities: MID },
      { name: 'Amazfit GTR 4',             capabilities: MID },
      { name: 'Amazfit GTS 4',             capabilities: MID },
      { name: 'Amazfit Bip 5 Unity',       capabilities: BASIC },
      { name: 'Amazfit Bip 5',             capabilities: BASIC },
      { name: 'Mi Band 9 Pro',             capabilities: MID },
      { name: 'Mi Band 9',                 capabilities: BASIC },
      { name: 'Mi Band 8 Pro',             capabilities: BASIC },
      { name: 'Mi Band 8',                 capabilities: BASIC },
      { name: 'Xiaomi Watch S3',           capabilities: MID },
      { name: 'Xiaomi Watch 2 Pro',        capabilities: MID },
    ],
  },
  {
    name: 'Huawei',
    models: [
      { name: 'Watch GT 5 Pro',            capabilities: [...FLAGSHIP, 'skin_temp'] },
      { name: 'Watch GT 5',                capabilities: [...MID, 'skin_temp'] },
      { name: 'Watch GT 4',                capabilities: [...MID, 'skin_temp'] },
      { name: 'Watch GT 3 Pro',            capabilities: [...MID, 'ecg', 'skin_temp'] },
      { name: 'Watch GT 3',                capabilities: MID },
      { name: 'Watch 4 Pro',               capabilities: [...MID, 'ecg', 'skin_temp', 'blood_pressure'] },
      { name: 'Watch 4',                   capabilities: [...MID, 'ecg'] },
      { name: 'Watch D',                   capabilities: [...MID, 'ecg', 'blood_pressure'] },
      { name: 'Band 9',                    capabilities: BASIC },
      { name: 'Band 8',                    capabilities: BASIC },
    ],
  },
  {
    name: 'Withings',
    models: [
      { name: 'ScanWatch Nova',            capabilities: [...MID, 'ecg', 'skin_temp', 'afib_detection'] },
      { name: 'ScanWatch 2',               capabilities: [...MID, 'ecg', 'skin_temp', 'afib_detection'] },
      { name: 'ScanWatch Horizon',         capabilities: [...MID, 'ecg', 'afib_detection'] },
      { name: 'ScanWatch Light',           capabilities: BASIC },
      { name: 'Steel HR',                  capabilities: BASIC },
    ],
  },
  {
    name: 'TicWatch (Mobvoi)',
    models: [
      { name: 'TicWatch Pro 5 Enduro',     capabilities: [...MID, 'ecg', 'skin_temp'] },
      { name: 'TicWatch Pro 5',            capabilities: [...MID, 'ecg', 'skin_temp'] },
      { name: 'TicWatch Pro 3 Ultra',      capabilities: MID },
      { name: 'TicWatch Atlas',            capabilities: [...MID, 'ecg'] },
      { name: 'TicWatch GTH 2',            capabilities: BASIC },
    ],
  },
  {
    name: 'OnePlus / Oppo Watch',
    models: [
      { name: 'OnePlus Watch 3',           capabilities: [...MID, 'ecg', 'skin_temp'] },
      { name: 'OnePlus Watch 2',           capabilities: [...MID, 'ecg'] },
      { name: 'OnePlus Watch (1st gen)',   capabilities: BASIC },
      { name: 'Oppo Watch X',              capabilities: [...MID, 'ecg'] },
    ],
  },
  {
    name: 'Casio G-Shock',
    models: [
      { name: 'G-Shock G-Squad DW-H5600',  capabilities: [...BASIC, 'gps_workouts'] },
      { name: 'G-Shock MOVE GBD-H2000',    capabilities: [...BASIC, 'gps_workouts'] },
      { name: 'G-Shock MOVE GBD-H1000',    capabilities: [...BASIC, 'gps_workouts'] },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SMART RINGS
// ─────────────────────────────────────────────────────────────────────────────
export const SMART_RING_BRANDS: DeviceBrand[] = [
  {
    name: 'Oura',
    models: [
      { name: 'Oura Ring 4',               capabilities: [...RING_PLUS, 'blood_pressure'] },
      { name: 'Oura Ring Gen 3 Horizon',   capabilities: RING_PLUS },
      { name: 'Oura Ring Gen 3 Heritage',  capabilities: RING_PLUS },
      { name: 'Oura Ring Gen 2',           capabilities: RING_CORE },
    ],
  },
  {
    name: 'Samsung Galaxy Ring',
    models: [
      { name: 'Galaxy Ring',               capabilities: RING_PLUS },
    ],
  },
  {
    name: 'Ultrahuman',
    models: [
      { name: 'Ultrahuman Ring AIR',       capabilities: [...RING_CORE, 'blood_oxygen'] },
      { name: 'Ultrahuman Rare',           capabilities: RING_PLUS },
      { name: 'Ultrahuman Ring (1st gen)', capabilities: RING_CORE },
    ],
  },
  {
    name: 'RingConn',
    models: [
      { name: 'RingConn Gen 2 Air',        capabilities: RING_PLUS },
      { name: 'RingConn Gen 2',            capabilities: RING_PLUS },
      { name: 'RingConn Gen 1',            capabilities: RING_CORE },
    ],
  },
  {
    name: 'Amazfit',
    models: [
      { name: 'Amazfit Helio Ring',        capabilities: [...RING_CORE, 'blood_oxygen'] },
    ],
  },
  {
    name: 'Circular',
    models: [
      { name: 'Circular Slim Ring',        capabilities: RING_CORE },
    ],
  },
  {
    name: 'Movano Evie',
    models: [
      { name: 'Evie Ring',                 capabilities: [...RING_CORE, 'blood_oxygen'] },
    ],
  },
  {
    name: 'Boat',
    models: [
      { name: 'Boat Smart Ring',           capabilities: RING_CORE },
    ],
  },
  {
    name: 'Noise',
    models: [
      { name: 'Noise Luna Ring',           capabilities: [...RING_CORE, 'blood_oxygen'] },
    ],
  },
  {
    name: 'Pi Ring',
    models: [
      { name: 'Pi Ring',                   capabilities: RING_CORE },
    ],
  },
  {
    name: 'Rogbid',
    models: [
      { name: 'Rogbid Smart Ring',         capabilities: RING_CORE },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// HOME EQUIPMENT — ownership matters for what the protocol can recommend.
// Each device has a reasonable Romanian-market price hint.
// ─────────────────────────────────────────────────────────────────────────────
export interface HomeEquipmentItem {
  key: string;
  label: string;
  icon: string;
  whyItMatters: string;
  priceHintRon?: number;
  buyQuery?: string;   // eMAG search query if they want to buy
}

export const HOME_EQUIPMENT: HomeEquipmentItem[] = [
  // ══ MEASUREMENT ══
  {
    key: 'bathroom_scale',
    label: 'Bathroom scale',
    icon: '⚖️',
    whyItMatters: 'Weight trend (morning, no clothes) is a weekly signal — more reliable than daily.',
    priceHintRon: 80,
    buyQuery: 'Cantar personal digital',
  },
  {
    key: 'smart_scale',
    label: 'Smart scale (body fat %)',
    icon: '📊',
    whyItMatters: 'Body composition > total weight. Catches muscle vs fat shifts invisible on a regular scale.',
    priceHintRon: 250,
    buyQuery: 'Cantar smart bluetooth body composition',
  },
  {
    key: 'bp_monitor',
    label: 'Blood pressure monitor (arm cuff)',
    icon: '🩺',
    whyItMatters: 'Morning BP is a cardio risk factor. Pharmacy measurements miss white-coat syndrome and daily variance.',
    priceHintRon: 200,
    buyQuery: 'Tensiometru electronic brat',
  },
  {
    key: 'body_thermometer',
    label: 'Body thermometer',
    icon: '🌡️',
    whyItMatters: 'Basal temp tracks metabolic health + (for women) cycle phase. Fever detection catches infections early.',
    priceHintRon: 60,
    buyQuery: 'Termometru digital corp',
  },
  {
    key: 'continuous_glucose_monitor',
    label: 'CGM (continuous glucose monitor)',
    icon: '🩸',
    whyItMatters: 'Reveals meal glucose spikes and morning fasting trends. One of the highest-info wearables for metabolic health.',
    priceHintRon: 400,
    buyQuery: 'Monitor glicemie continuu FreeStyle Libre',
  },
  {
    key: 'glucose_meter',
    label: 'Glucose meter (finger prick)',
    icon: '💉',
    whyItMatters: 'Cheaper than CGM — lets you spot-check fasting glucose weekly or post-meal spikes.',
    priceHintRon: 120,
    buyQuery: 'Glucometru OneTouch Accu-Chek',
  },
  {
    key: 'pulse_oximeter',
    label: 'Pulse oximeter',
    icon: '🫁',
    whyItMatters: 'Spot-check SpO2 when you suspect sleep apnea or after heavy altitude/cardio.',
    priceHintRon: 70,
    buyQuery: 'Pulsoximetru deget',
  },
  {
    key: 'hrv_chest_strap',
    label: 'HRV chest strap (Polar H10, Garmin HRM)',
    icon: '💓',
    whyItMatters: 'Medical-grade HRV + zone-2 heart rate. Gold standard for cardio zones (wrist PPG is noisy).',
    priceHintRon: 350,
    buyQuery: 'Polar H10 chest strap HRM',
  },
  {
    key: 'spirometer',
    label: 'Spirometer / peak flow meter',
    icon: '🌬️',
    whyItMatters: 'VO2-adjacent. Tracks lung function over time — flags asthma, smoker-era damage reversal.',
    priceHintRon: 150,
    buyQuery: 'Spirometru peak flow meter',
  },
  {
    key: 'antioxidant_scanner',
    label: 'Antioxidant scanner (Veggie Meter / SCiO)',
    icon: '🥬',
    whyItMatters: 'Non-invasive skin carotenoid score — proxies plant intake + oxidative stress.',
    priceHintRon: 2000,
    buyQuery: 'Veggie meter scanner antioxidanti',
  },
  {
    key: 'sleep_mat',
    label: 'Under-mattress sleep tracker (Withings)',
    icon: '🛏️',
    whyItMatters: 'Sleep stages + apnea detection without wearing anything. Partner-friendly.',
    priceHintRon: 750,
    buyQuery: 'Withings Sleep Analyzer mat',
  },

  // ══ ENVIRONMENT ══
  {
    key: 'air_purifier',
    label: 'HEPA air purifier',
    icon: '🌬️',
    whyItMatters: 'PM2.5 from cooking, traffic, mold — shown to drop BP + inflammation markers when air is filtered.',
    priceHintRon: 600,
    buyQuery: 'Purificator aer HEPA',
  },
  {
    key: 'air_quality_monitor',
    label: 'Air quality monitor (PM2.5 / CO2 / VOC)',
    icon: '🟢',
    whyItMatters: 'Quantifies indoor air quality. Tells you WHEN to run the purifier and WHEN to ventilate.',
    priceHintRon: 400,
    buyQuery: 'Monitor calitate aer PM2.5 CO2',
  },
  {
    key: 'water_filter',
    label: 'Water filter (tap or pitcher)',
    icon: '💧',
    whyItMatters: 'Reduces chlorine, heavy metals, microplastics. Romanian tap water quality varies by city.',
    priceHintRon: 150,
    buyQuery: 'Filtru apa robinet',
  },
  {
    key: 'humidifier',
    label: 'Humidifier',
    icon: '💨',
    whyItMatters: 'Winter air under 40% humidity irritates airways + skin. 45-55% is the sleep sweet spot.',
    priceHintRon: 250,
    buyQuery: 'Umidificator aer camera',
  },
  {
    key: 'blackout_curtains',
    label: 'Blackout curtains or blinds',
    icon: '🌃',
    whyItMatters: 'Even small light hitting the optic nerve suppresses melatonin. The single highest-ROI sleep upgrade.',
    priceHintRon: 300,
    buyQuery: 'Draperii blackout opace dormitor',
  },
  {
    key: 'blue_light_glasses',
    label: 'Blue-light blocking glasses (amber)',
    icon: '🕶️',
    whyItMatters: 'Worn after sunset if you can\'t avoid screens. Orange lens blocks ~95% of melatonin-suppressing wavelengths.',
    priceHintRon: 120,
    buyQuery: 'Ochelari blue light blocker amber',
  },
  {
    key: 'light_therapy_lamp',
    label: 'Light therapy lamp (10,000 lux)',
    icon: '☀️',
    whyItMatters: 'Morning bright light anchors circadian rhythm — critical for night owls + winter SAD.',
    priceHintRon: 400,
    buyQuery: 'Lampa terapie lumina 10000 lux SAD',
  },

  // ══ RECOVERY / LIFESTYLE ══
  {
    key: 'red_light_panel',
    label: 'Red light therapy panel',
    icon: '🔴',
    whyItMatters: 'Near-IR wavelengths (660/850nm) — preliminary data on skin, recovery, mitochondrial function.',
    priceHintRon: 1500,
    buyQuery: 'Panou terapie lumina rosie 660nm 850nm',
  },
  {
    key: 'sauna',
    label: 'Sauna (infrared or traditional)',
    icon: '🔥',
    whyItMatters: 'Sauna 4×/week is associated with ~40% lower all-cause mortality (Laukkanen et al). Huge cardio benefit.',
    priceHintRon: 5000,
    buyQuery: 'Sauna infrarosu',
  },
  {
    key: 'cold_plunge',
    label: 'Cold plunge / ice bath setup',
    icon: '🧊',
    whyItMatters: '2-3 min at 10-15°C bumps dopamine for hours, may improve cold tolerance + brown fat activation.',
    priceHintRon: 2500,
    buyQuery: 'Cada cold plunge ice bath',
  },
  {
    key: 'weighted_blanket',
    label: 'Weighted blanket (7-10 kg)',
    icon: '🛌',
    whyItMatters: 'Deep-pressure stimulation lowers cortisol, helps anxiety-driven insomnia. 10% body weight is the rule.',
    priceHintRon: 400,
    buyQuery: 'Patura cu greutate weighted blanket',
  },
  {
    key: 'massage_gun',
    label: 'Massage gun / percussion therapy',
    icon: '💪',
    whyItMatters: 'Cuts DOMS recovery time, useful for desk-job trigger points. 1-2 min per muscle group post-workout.',
    priceHintRon: 500,
    buyQuery: 'Massage gun percussion Theragun',
  },
  {
    key: 'foam_roller',
    label: 'Foam roller',
    icon: '🎯',
    whyItMatters: 'Self-myofascial release. $20 item that saves your low back if you sit >6h/day.',
    priceHintRon: 80,
    buyQuery: 'Foam roller fitness spuma',
  },
  {
    key: 'meditation_app',
    label: 'Meditation app subscription (Waking Up / Calm / Headspace)',
    icon: '🧘',
    whyItMatters: '10 min/day guided meditation lowers cortisol + improves HRV within 8 weeks.',
    priceHintRon: 300,
    buyQuery: 'Waking Up meditation app',
  },

  // ══ FITNESS ══
  {
    key: 'standing_desk',
    label: 'Standing desk (electric height-adjustable)',
    icon: '🧑‍💻',
    whyItMatters: 'Alternating sit/stand reduces back pain + post-prandial glucose spikes. Don\'t stand ALL day — alternate.',
    priceHintRon: 1500,
    buyQuery: 'Birou electric reglabil inaltime',
  },
  {
    key: 'walking_pad',
    label: 'Walking pad / under-desk treadmill',
    icon: '🚶',
    whyItMatters: 'Adds 3000-5000 steps while you work. Pairs with standing desk for zone 1 all day.',
    priceHintRon: 1800,
    buyQuery: 'Walking pad banda alergat sub birou',
  },
  {
    key: 'home_gym',
    label: 'Home gym (rack + barbell + plates)',
    icon: '🏋️',
    whyItMatters: 'Zero friction to train. Rack + barbell + 100kg plates covers 95% of strength programming for years.',
    priceHintRon: 4500,
    buyQuery: 'Rack squat home gym set',
  },
  {
    key: 'dumbbells',
    label: 'Adjustable dumbbells (PowerBlock/Bowflex-style)',
    icon: '🏋️‍♂️',
    whyItMatters: 'One pair replaces 10-20 fixed dumbbells. 2-40 kg range covers strength + conditioning.',
    priceHintRon: 2000,
    buyQuery: 'Gantere reglabile adjustable dumbbells',
  },
  {
    key: 'kettlebells',
    label: 'Kettlebells (12/16/24 kg)',
    icon: '🏐',
    whyItMatters: 'Swings + Turkish get-ups = full-body conditioning in 15 min. Indestructible, zero maintenance.',
    priceHintRon: 600,
    buyQuery: 'Gantere kettlebell 16kg 24kg',
  },
  {
    key: 'pull_up_bar',
    label: 'Pull-up bar (doorframe or wall-mount)',
    icon: '🙆',
    whyItMatters: 'Best upper-body builder on earth. $30 bar = unlimited pull work for life.',
    priceHintRon: 130,
    buyQuery: 'Bara tractiuni pull up',
  },
  {
    key: 'resistance_bands',
    label: 'Resistance bands set',
    icon: '🎚️',
    whyItMatters: 'Cheap, travel-friendly, covers full-body strength if no rack. Pair with doorframe anchor for pull work.',
    priceHintRon: 120,
    buyQuery: 'Benzi elastice fitness set',
  },
  {
    key: 'yoga_mat',
    label: 'Yoga / stretching mat',
    icon: '🧎',
    whyItMatters: 'Mobility + core work daily. 10 min/morning prevents back issues that compound over decades.',
    priceHintRon: 150,
    buyQuery: 'Yoga mat saltea fitness',
  },
  {
    key: 'indoor_bike',
    label: 'Indoor exercise bike (spin / smart)',
    icon: '🚲',
    whyItMatters: 'Weather-proof zone 2 cardio. Smart bikes (Wahoo/Zwift) add gamification that 4× adherence.',
    priceHintRon: 3000,
    buyQuery: 'Bicicleta fitness indoor spinning',
  },
  {
    key: 'rowing_machine',
    label: 'Rowing machine',
    icon: '🚣',
    whyItMatters: 'Full-body zone 2. 20 min at moderate pace = cardio + strength + posture all in one.',
    priceHintRon: 2500,
    buyQuery: 'Aparat canotaj rowing machine',
  },
];
