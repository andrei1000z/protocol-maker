// ============================================================================
// BRYAN JOHNSON BENCHMARK — single source of truth for the entire app.
// ----------------------------------------------------------------------------
// Update this ONE file when Bryan publishes new biomarkers / supplement
// changes / age. Everything else (dashboard, OG image, master prompt,
// landing comparison) reads from here.
// ============================================================================

export const BRYAN = {
  // Personal stats (April 2026)
  chronoAge: 48,           // born Aug 1977 → 48.7y as of April 2026
  bioAge: 42.0,            // epigenetic age from his published tests (Horvath DNAm)
  longevityScore: 94,      // our scoring methodology → Bryan tier
  agingPace: 0.64,         // DunedinPACE self-reported

  // Spend / scope (used in landing copy)
  annualSpendUSD: 2_000_000,
  medicalTeamSize: 30,
} as const;

// Convenience: bio age delta as % younger than chronological
export const BRYAN_BIO_AGE_PCT_YOUNGER = +(((BRYAN.chronoAge - BRYAN.bioAge) / BRYAN.chronoAge) * 100).toFixed(1);
