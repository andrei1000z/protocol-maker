// Device catalog — maps wearable brands to their popular models + what each
// model can actually measure. The onboarding UI lets users pick a brand → model,
// and the master prompt receives the capability list so it knows what the user
// can track daily (e.g. "user has Oura Ring Gen 3 — can surface HRV + deep sleep").
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
  | 'gps_workouts';

export interface DeviceModel {
  name: string;
  capabilities: MetricCapability[];
}

export interface DeviceBrand {
  name: string;
  models: DeviceModel[];
}

// ─────────────────────────────────────────────────────────────────────────────
// SMARTWATCHES
// ─────────────────────────────────────────────────────────────────────────────
const UNIVERSAL_WATCH: MetricCapability[] = [
  'heart_rate', 'resting_hr', 'sleep_stages', 'sleep_score', 'steps', 'active_time', 'calories_burned',
];
const PREMIUM_WATCH: MetricCapability[] = [
  ...UNIVERSAL_WATCH, 'hrv', 'blood_oxygen', 'vo2max', 'stress', 'respiration_rate',
];
const FLAGSHIP_WATCH: MetricCapability[] = [
  ...PREMIUM_WATCH, 'ecg', 'skin_temp', 'floors_climbed', 'gps_workouts',
];

export const SMARTWATCH_BRANDS: DeviceBrand[] = [
  {
    name: 'Apple Watch',
    models: [
      { name: 'Series 10',             capabilities: FLAGSHIP_WATCH },
      { name: 'Series 9',              capabilities: FLAGSHIP_WATCH },
      { name: 'Series 8',              capabilities: FLAGSHIP_WATCH },
      { name: 'Series 7',              capabilities: FLAGSHIP_WATCH },
      { name: 'Series 6',              capabilities: FLAGSHIP_WATCH },
      { name: 'Series 5',              capabilities: PREMIUM_WATCH },
      { name: 'Series 4',              capabilities: PREMIUM_WATCH },
      { name: 'Ultra 2',               capabilities: [...FLAGSHIP_WATCH, 'body_battery'] },
      { name: 'Ultra (1st gen)',       capabilities: FLAGSHIP_WATCH },
      { name: 'SE (2nd gen)',          capabilities: PREMIUM_WATCH },
      { name: 'SE (1st gen)',          capabilities: UNIVERSAL_WATCH },
    ],
  },
  {
    name: 'Samsung Galaxy Watch',
    models: [
      { name: 'Galaxy Watch 7',        capabilities: FLAGSHIP_WATCH },
      { name: 'Galaxy Watch 6',        capabilities: FLAGSHIP_WATCH },
      { name: 'Galaxy Watch 6 Classic',capabilities: FLAGSHIP_WATCH },
      { name: 'Galaxy Watch 5',        capabilities: [...PREMIUM_WATCH, 'ecg', 'skin_temp'] },
      { name: 'Galaxy Watch 5 Pro',    capabilities: [...PREMIUM_WATCH, 'ecg', 'skin_temp'] },
      { name: 'Galaxy Watch 4',        capabilities: [...PREMIUM_WATCH, 'ecg'] },
      { name: 'Galaxy Watch Active 2', capabilities: PREMIUM_WATCH },
      { name: 'Galaxy Watch 3',        capabilities: PREMIUM_WATCH },
      { name: 'Galaxy Fit 3',          capabilities: UNIVERSAL_WATCH },
    ],
  },
  {
    name: 'Garmin',
    models: [
      { name: 'Fenix 8',               capabilities: [...FLAGSHIP_WATCH, 'body_battery'] },
      { name: 'Fenix 7',               capabilities: [...FLAGSHIP_WATCH, 'body_battery'] },
      { name: 'Fenix 6',               capabilities: [...PREMIUM_WATCH, 'body_battery', 'gps_workouts'] },
      { name: 'Epix Pro',              capabilities: [...FLAGSHIP_WATCH, 'body_battery'] },
      { name: 'Forerunner 965',        capabilities: [...FLAGSHIP_WATCH, 'body_battery'] },
      { name: 'Forerunner 955',        capabilities: [...FLAGSHIP_WATCH, 'body_battery'] },
      { name: 'Forerunner 265',        capabilities: [...PREMIUM_WATCH, 'body_battery'] },
      { name: 'Forerunner 165',        capabilities: [...PREMIUM_WATCH, 'body_battery'] },
      { name: 'Venu 3',                capabilities: [...PREMIUM_WATCH, 'body_battery'] },
      { name: 'Venu 2',                capabilities: [...PREMIUM_WATCH, 'body_battery'] },
      { name: 'Vivoactive 5',          capabilities: [...PREMIUM_WATCH, 'body_battery'] },
      { name: 'Instinct 2',            capabilities: [...UNIVERSAL_WATCH, 'body_battery', 'gps_workouts'] },
    ],
  },
  {
    name: 'Fitbit',
    models: [
      { name: 'Sense 2',               capabilities: [...PREMIUM_WATCH, 'ecg', 'skin_temp'] },
      { name: 'Sense',                 capabilities: [...PREMIUM_WATCH, 'ecg', 'skin_temp'] },
      { name: 'Versa 4',               capabilities: PREMIUM_WATCH },
      { name: 'Versa 3',               capabilities: PREMIUM_WATCH },
      { name: 'Charge 6',              capabilities: [...PREMIUM_WATCH, 'ecg'] },
      { name: 'Charge 5',              capabilities: [...PREMIUM_WATCH, 'ecg', 'skin_temp'] },
      { name: 'Inspire 3',             capabilities: UNIVERSAL_WATCH },
      { name: 'Luxe',                  capabilities: UNIVERSAL_WATCH },
    ],
  },
  {
    name: 'WHOOP',
    models: [
      { name: 'WHOOP 4.0',             capabilities: ['heart_rate', 'resting_hr', 'hrv', 'sleep_stages', 'sleep_score', 'blood_oxygen', 'skin_temp', 'respiration_rate', 'stress'] },
      { name: 'WHOOP 3.0',             capabilities: ['heart_rate', 'resting_hr', 'hrv', 'sleep_stages', 'sleep_score', 'respiration_rate'] },
    ],
  },
  {
    name: 'Polar',
    models: [
      { name: 'Vantage V3',             capabilities: [...FLAGSHIP_WATCH, 'body_battery'] },
      { name: 'Vantage V2',             capabilities: [...PREMIUM_WATCH, 'gps_workouts'] },
      { name: 'Grit X2 Pro',            capabilities: [...FLAGSHIP_WATCH, 'body_battery'] },
      { name: 'Pacer Pro',              capabilities: [...PREMIUM_WATCH, 'gps_workouts'] },
      { name: 'Ignite 3',               capabilities: [...PREMIUM_WATCH] },
    ],
  },
  {
    name: 'Xiaomi / Amazfit',
    models: [
      { name: 'Mi Band 9',              capabilities: UNIVERSAL_WATCH },
      { name: 'Mi Band 8',              capabilities: UNIVERSAL_WATCH },
      { name: 'Amazfit GTR Mini',       capabilities: PREMIUM_WATCH },
      { name: 'Amazfit T-Rex Ultra',    capabilities: PREMIUM_WATCH },
      { name: 'Amazfit Active Edge',    capabilities: UNIVERSAL_WATCH },
    ],
  },
  {
    name: 'Huawei',
    models: [
      { name: 'Watch GT 4',             capabilities: PREMIUM_WATCH },
      { name: 'Watch GT 3',             capabilities: PREMIUM_WATCH },
      { name: 'Watch 4 Pro',            capabilities: [...PREMIUM_WATCH, 'ecg', 'skin_temp'] },
      { name: 'Band 9',                 capabilities: UNIVERSAL_WATCH },
    ],
  },
  {
    name: 'Withings',
    models: [
      { name: 'ScanWatch 2',            capabilities: [...PREMIUM_WATCH, 'ecg', 'skin_temp'] },
      { name: 'ScanWatch Nova',         capabilities: [...PREMIUM_WATCH, 'ecg', 'skin_temp'] },
      { name: 'Steel HR',               capabilities: UNIVERSAL_WATCH },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SMART RINGS
// ─────────────────────────────────────────────────────────────────────────────
const RING_CORE: MetricCapability[] = [
  'heart_rate', 'resting_hr', 'hrv', 'sleep_stages', 'sleep_score', 'skin_temp', 'respiration_rate', 'cycle_tracking',
];

export const SMART_RING_BRANDS: DeviceBrand[] = [
  {
    name: 'Oura',
    models: [
      { name: 'Oura Ring Gen 4',        capabilities: [...RING_CORE, 'blood_oxygen', 'stress'] },
      { name: 'Oura Ring Gen 3 Horizon',capabilities: [...RING_CORE, 'blood_oxygen', 'stress'] },
      { name: 'Oura Ring Gen 3 Heritage',capabilities: [...RING_CORE, 'blood_oxygen', 'stress'] },
      { name: 'Oura Ring Gen 2',        capabilities: RING_CORE },
    ],
  },
  {
    name: 'Samsung Galaxy Ring',
    models: [
      { name: 'Galaxy Ring',            capabilities: [...RING_CORE, 'blood_oxygen', 'stress'] },
    ],
  },
  {
    name: 'Ultrahuman',
    models: [
      { name: 'Ultrahuman Ring AIR',    capabilities: [...RING_CORE, 'blood_oxygen'] },
      { name: 'Ultrahuman Ring',        capabilities: RING_CORE },
    ],
  },
  {
    name: 'RingConn',
    models: [
      { name: 'RingConn Gen 2',         capabilities: [...RING_CORE, 'blood_oxygen', 'stress'] },
      { name: 'RingConn Gen 1',         capabilities: RING_CORE },
    ],
  },
  {
    name: 'Amazfit',
    models: [
      { name: 'Amazfit Helio Ring',     capabilities: [...RING_CORE, 'blood_oxygen'] },
    ],
  },
  {
    name: 'Circular',
    models: [
      { name: 'Circular Ring Slim',     capabilities: RING_CORE },
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
    key: 'pulse_oximeter',
    label: 'Pulse oximeter',
    icon: '🫁',
    whyItMatters: 'Spot-check SpO2 when you suspect sleep apnea or after heavy altitude/cardio.',
    priceHintRon: 70,
    buyQuery: 'Pulsoximetru deget',
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
    key: 'air_purifier',
    label: 'HEPA air purifier',
    icon: '🌬️',
    whyItMatters: 'PM2.5 from cooking, traffic, mold — shown to drop BP + inflammation markers when air is filtered.',
    priceHintRon: 600,
    buyQuery: 'Purificator aer HEPA',
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
    key: 'home_gym',
    label: 'Home gym (rack + barbell + dumbbells)',
    icon: '🏋️',
    whyItMatters: 'Zero friction to train. Rack + barbell + 100kg plates covers 95% of strength programming for years.',
    priceHintRon: 4500,
    buyQuery: 'Rack squat home gym set',
  },
  {
    key: 'resistance_bands',
    label: 'Resistance bands set',
    icon: '🎚️',
    whyItMatters: 'Cheap, travel-friendly, covers full-body strength if no rack. Pair with doorframe anchor for pull work.',
    priceHintRon: 120,
    buyQuery: 'Benzi elastice fitness set',
  },
];
