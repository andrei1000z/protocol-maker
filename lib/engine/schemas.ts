// Zod schemas for JSONB persistence boundaries.
//
// Problem these solve: AI returns nested JSON, we persist it directly to
// `protocols.protocol_json`. Without validation, a new AI hallucination —
// renamed field, wrong type, omitted required section — lands in the DB and
// downstream code reads `undefined` silently. The UI shows a blank card,
// the user doesn't know why, and we can't distinguish "AI didn't say" from
// "AI drifted to a new field name".
//
// Design:
//   - Every section is `.passthrough()`. We keep any extra fields the AI
//     emits so we don't lose signal; we just validate the shape of what we
//     KNOW we want.
//   - Every section is `.optional()`. The legal-empty protocol is "nothing";
//     the enrichment layer in generate-protocol/route.ts already merges
//     missing sections from the deterministic fallback.
//   - Parsing is ADVISORY only (safeParse + log). We do NOT fail the user's
//     request on a schema mismatch — that would leak AI flakiness into the
//     user's face. Instead we emit `protocol.zod_shape_drift` with the
//     rejecting paths so ops can see new shapes in near-real-time.

import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Primitives / reusable blocks
// ─────────────────────────────────────────────────────────────────────────────

/** Non-empty string with a sensible upper bound. AI hallucination sometimes
 *  writes essays into a "dose" field — cap to keep the DB row sane. */
const shortString = z.string().min(1).max(600);

/** A supplement as emitted by the master prompt. Required: name. Everything
 *  else is optional because the fallback may produce sparser entries. */
const SupplementSchema = z.object({
  name: shortString,
  dose: z.string().max(200).optional(),
  timing: z.string().max(400).optional(),
  whyThisTime: z.string().max(600).optional(),
  priority: z.string().max(40).optional(),
  mechanism: z.string().max(800).optional(),
  cost: z.union([z.string().max(40), z.number().finite()]).optional(),
  emagSearchQuery: z.string().max(200).optional(),
  stackWithOthers: z.array(z.string().max(120)).max(20).optional(),
  warnings: z.array(z.string().max(600)).max(20).optional(),
  interactions: z.array(z.string().max(600)).max(20).optional(),
}).passthrough();

const MacrosSchema = z.object({
  protein: z.number().finite().optional(),
  carbs: z.number().finite().optional(),
  fat: z.number().finite().optional(),
}).passthrough();

const DiagnosticSchema = z.object({
  biologicalAge: z.number().finite().optional(),
  chronologicalAge: z.number().finite().optional(),
  longevityScore: z.number().finite().optional(),
  agingVelocity: z.string().max(40).optional(),
  agingVelocityNumber: z.number().finite().optional(),
  topWins: z.array(z.string().max(600)).max(20).optional(),
  topRisks: z.array(z.string().max(600)).max(20).optional(),
  wearableSignalDays: z.number().int().min(0).max(500).optional(),
  organSystemScores: z.record(z.string(), z.number().finite()).optional(),
  organSystemsDetailed: z.array(z.record(z.string(), z.unknown())).optional(),
  adherenceScore30d: z.number().nullable().optional(),
  protocolVersion: z.number().int().min(0).optional(),
  previousProtocolId: z.string().uuid().nullable().optional(),
  estimatedBiomarkers: z.array(z.record(z.string(), z.unknown())).optional(),
  bryanSummary: z.unknown().optional(),
}).passthrough();

const NutritionSchema = z.object({
  dailyCalories: z.number().finite().optional(),
  macros: MacrosSchema.optional(),
  eatingWindow: z.string().max(120).optional(),
  waterLitersPerDay: z.number().finite().optional(),
  fiberGrams: z.number().finite().optional(),
  proteinGrams: z.number().finite().optional(),
  vegetableServingsPerDay: z.number().finite().optional(),
  fruitServingsPerDay: z.number().finite().optional(),
  mealsPerDay: z.number().int().optional(),
  alcoholDrinksPerWeek: z.number().finite().optional(),
  caffeineCutoffTime: z.string().max(20).optional(),
}).passthrough();

const SleepSchema = z.object({
  targetBedtime: z.string().max(20).optional(),
  targetWakeTime: z.string().max(20).optional(),
  idealBedtime: z.string().max(20).optional(),
  idealWakeTime: z.string().max(20).optional(),
  targetHours: z.number().finite().optional(),
  caffeineLimit: z.string().max(200).optional(),
  morningLightMinutes: z.number().int().min(0).max(500).optional(),
  windDownStart: z.string().max(20).optional(),
  screenCutoff: z.string().max(20).optional(),
}).passthrough();

const ExerciseSchema = z.object({
  dailyStepsTarget: z.number().int().min(0).max(200000).optional(),
  // AI sometimes returns "150 bpm" (string) and the fallback returns 150
  // (number). Accept either — downstream consumers cast as needed.
  zone2Target: z.union([z.string().max(200), z.number().finite()]).optional(),
  zone2MinutesPerWeek: z.number().int().min(0).max(5000).optional(),
  strengthSessions: z.union([z.number().int().min(0).max(21), z.string().max(60)]).optional(),
  strengthSessionsPerWeek: z.number().int().min(0).max(21).optional(),
  hiitSessions: z.union([z.number().int().min(0).max(14), z.string().max(60)]).optional(),
  hiitMinutesPerWeek: z.number().int().min(0).max(2000).optional(),
  cardioMinutesPerWeek: z.number().int().min(0).max(5000).optional(),
  cardioSessions: z.union([z.number().int().min(0).max(21), z.string().max(60)]).optional(),
  yogaMobilityMinutes: z.number().int().min(0).max(2000).optional(),
  restDays: z.union([z.number().int().min(0).max(7), z.string().max(60)]).optional(),
}).passthrough();

const BiomarkerReadoutSchema = z.object({
  code: z.string().min(1).max(40),
  name: z.string().max(200).optional(),
  shortName: z.string().max(60).optional(),
  value: z.number().finite().optional().nullable(),
  unit: z.string().max(40).optional(),
  classification: z.string().max(40).optional(),
  longevityOptimalRange: z.array(z.number().finite()).max(2).optional(),
  labRange: z.array(z.number().finite()).max(2).optional(),
  bryanValue: z.union([z.number().finite(), z.string().max(60)]).optional().nullable(),
  gap: z.number().finite().optional(),
}).passthrough();

// ─────────────────────────────────────────────────────────────────────────────
// Top-level ProtocolJson schema — matches the 17-section contract in the
// master prompt. Anything not listed still passes through via `.passthrough()`.
// ─────────────────────────────────────────────────────────────────────────────
export const ProtocolJsonSchema = z.object({
  diagnostic: DiagnosticSchema.optional(),
  nutrition: NutritionSchema.optional(),
  supplements: z.array(SupplementSchema).max(60).optional(),
  // Can be either a bullet-list (array of strings, fallback style) or a
  // structured object (section map, AI style). Both render the same way.
  supplementsHowTo: z.union([
    z.array(z.string().max(600)),
    z.record(z.string(), z.unknown()),
  ]).optional(),
  exercise: ExerciseSchema.optional(),
  sleep: SleepSchema.optional(),
  tracking: z.record(z.string(), z.unknown()).optional(),
  doctorDiscussion: z.record(z.string(), z.unknown()).optional(),
  dailySchedule: z.union([z.array(z.record(z.string(), z.unknown())), z.record(z.string(), z.unknown())]).optional(),
  // Array of per-biomarker rows (fallback + some AI outputs) or a grouped
  // object with narrative text (other AI outputs). UI handles both.
  bryanComparison: z.union([
    z.array(z.record(z.string(), z.unknown())),
    z.record(z.string(), z.unknown()),
  ]).optional(),
  universalTips: z.union([z.array(z.record(z.string(), z.unknown())), z.record(z.string(), z.unknown())]).optional(),
  dailyBriefing: z.record(z.string(), z.unknown()).optional(),
  costBreakdown: z.record(z.string(), z.unknown()).optional(),
  painPointSolutions: z.array(z.record(z.string(), z.unknown())).optional(),
  flexRules: z.array(z.record(z.string(), z.unknown())).optional(),
  biomarkerReadout: z.array(BiomarkerReadoutSchema).max(100).optional(),
  mindset: z.record(z.string(), z.unknown()).optional(),
}).passthrough();

export type ProtocolJson = z.infer<typeof ProtocolJsonSchema>;

/** Summarize parse failures into a small, PII-free bag of field paths + codes.
 *  Safe to emit to structured logs — never contains raw values. */
export interface ProtocolShapeDrift {
  issueCount: number;
  issues: Array<{ path: string; code: string }>;
}

/** Advisory parse: never throws. Returns either `{ ok: true }` or
 *  `{ ok: false, drift }`. Caller decides what to log / whether to salvage.
 *
 *  We intentionally don't return the parsed object — we want the ORIGINAL
 *  protocolJson to persist (it may have fields not in the schema that the
 *  enrichment path or UI can still render). The check is purely observability. */
export function inspectProtocolShape(json: unknown): { ok: true } | { ok: false; drift: ProtocolShapeDrift } {
  const res = ProtocolJsonSchema.safeParse(json);
  if (res.success) return { ok: true };
  return {
    ok: false,
    drift: {
      issueCount: res.error.issues.length,
      issues: res.error.issues.slice(0, 12).map(i => ({
        path: i.path.join('.') || '<root>',
        code: i.code,
      })),
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Onboarding data — the free-form jsonb blob stored in profiles.onboarding_data
// ─────────────────────────────────────────────────────────────────────────────

/** Shape the UI writes when the user completes onboarding. Conservative: any
 *  field absent is fine. Pass-through so future steps don't need schema bumps. */
export const OnboardingDataSchema = z.object({
  name: z.string().max(200).optional(),
  birthDate: z.string().max(40).optional(),
  city: z.string().max(120).optional(),
  country: z.string().max(80).optional(),
  devices: z.record(z.string(), z.unknown()).optional(),
  equipment: z.record(z.string(), z.unknown()).optional(),
  chronotype: z.string().max(40).optional(),
  stressLevel: z.number().int().min(1).max(10).optional(),
  familyHistory: z.array(z.string().max(120)).max(40).optional(),
  sleepIssues: z.array(z.string().max(120)).max(20).optional(),
  otherCondition: z.string().max(200).optional(),
}).passthrough();

export type OnboardingData = z.infer<typeof OnboardingDataSchema>;
