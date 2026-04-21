// Serializers for "Export my data" in settings.
//
// Three formats are offered:
//   1. JSON — full GDPR archive (the existing /api/my-data?full=1 response).
//   2. CSV  — flat biomarker table + flat tracking table. Biggest demand
//             came from users wanting to drop readings into Excel/Sheets.
//   3. Markdown — human-readable summary. Useful for sending a snapshot
//             to a doctor or putting it in a Notion journal.
//
// None of these hit the network — they're pure transforms over the
// response already downloaded by handleExport. Keeping them here lets the
// UI stay simple ("download" → browser save) while also being testable.

interface FullExport {
  profile?: Record<string, unknown>;
  protocol?: Record<string, unknown> | null;
  bloodTests?: Array<{
    taken_at: string;
    biomarkers: Array<{ code: string; value: number; unit?: string }>;
  }>;
  dailyMetrics?: Array<Record<string, unknown>>;
  complianceLogs?: Array<Record<string, unknown>>;
  protocolHistory?: Array<{
    id?: string;
    created_at: string;
    longevity_score?: number | null;
    biological_age_decimal?: number | null;
    biological_age?: number | null;
    aging_pace?: number | null;
    model_used?: string | null;
    generation_source?: string | null;
  }>;
  chatMessages?: Array<{ role: string; content: string; created_at: string }>;
  shareLinks?: Array<Record<string, unknown>>;
  [k: string]: unknown;
}

/** Escape a CSV cell per RFC 4180 — wraps in quotes + doubles any internal
 *  quotes whenever the value contains a comma, quote, newline, or tab. */
function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'string' ? v : (typeof v === 'number' || typeof v === 'boolean') ? String(v) : JSON.stringify(v);
  if (/[",\n\t]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Biomarkers CSV — one row per (test_date × biomarker_code). Long-format
 *  so Excel/Sheets users can pivot without wrestling with a wide header. */
export function buildBiomarkersCsv(exp: FullExport): string {
  const rows: string[] = ['taken_at,code,value,unit'];
  for (const t of exp.bloodTests ?? []) {
    for (const b of t.biomarkers ?? []) {
      rows.push([t.taken_at, b.code, b.value, b.unit ?? ''].map(csvCell).join(','));
    }
  }
  return rows.join('\n');
}

/** Daily metrics CSV — one row per day, columns auto-derived from the
 *  union of keys present in the response. Flat dump for trend analysis. */
export function buildDailyMetricsCsv(exp: FullExport): string {
  const rows = exp.dailyMetrics ?? [];
  if (rows.length === 0) return 'date\n';
  const keys = Array.from(new Set(rows.flatMap(r => Object.keys(r)))).sort((a, b) => {
    // Put 'date' first for readability; everything else alphabetical.
    if (a === 'date') return -1;
    if (b === 'date') return 1;
    return a.localeCompare(b);
  });
  const header = keys.join(',');
  const body = rows.map(r => keys.map(k => csvCell(r[k])).join(',')).join('\n');
  return `${header}\n${body}`;
}

/** Protocol history CSV — one row per regeneration. Useful for seeing
 *  score / bio-age movement in a spreadsheet. */
export function buildProtocolHistoryCsv(exp: FullExport): string {
  const rows = exp.protocolHistory ?? [];
  const header = 'created_at,longevity_score,biological_age,aging_pace,model_used,generation_source';
  const body = rows.map(r => [
    r.created_at,
    r.longevity_score ?? '',
    r.biological_age_decimal ?? r.biological_age ?? '',
    r.aging_pace ?? '',
    r.model_used ?? '',
    r.generation_source ?? '',
  ].map(csvCell).join(',')).join('\n');
  return `${header}\n${body}`;
}

/** Markdown "doctor snapshot" — profile + latest scores + latest biomarkers
 *  + brief trend note. Format targets read-aloud brevity; no tables. */
export function buildDoctorMarkdown(exp: FullExport): string {
  const today = new Date().toISOString().slice(0, 10);
  const lines: string[] = [];
  lines.push(`# Longevity Protocol Snapshot — ${today}`);
  lines.push('');

  const p = exp.profile as Record<string, unknown> | undefined;
  if (p) {
    lines.push('## Profile');
    if (p.age) lines.push(`- Age: ${p.age}`);
    if (p.sex) lines.push(`- Sex: ${p.sex}`);
    if (p.height_cm && p.weight_kg) {
      const bmi = (Number(p.weight_kg) / ((Number(p.height_cm) / 100) ** 2)).toFixed(1);
      lines.push(`- Height: ${p.height_cm} cm · Weight: ${p.weight_kg} kg · BMI: ${bmi}`);
    }
    if (Array.isArray(p.conditions) && p.conditions.length > 0) lines.push(`- Conditions: ${(p.conditions as string[]).join(', ')}`);
    if (Array.isArray(p.medications) && p.medications.length > 0) {
      const meds = (p.medications as Array<{ name?: string; dose?: string; frequency?: string }>)
        .map(m => [m.name, m.dose, m.frequency].filter(Boolean).join(' '))
        .filter(Boolean);
      if (meds.length) lines.push(`- Medications: ${meds.join('; ')}`);
    }
    lines.push('');
  }

  const proto = exp.protocol as Record<string, unknown> | null | undefined;
  if (proto) {
    lines.push('## Latest protocol');
    const d = proto.diagnostic as Record<string, unknown> | undefined;
    if (d) {
      if (typeof d.longevityScore === 'number') lines.push(`- Longevity score: ${d.longevityScore}/100`);
      if (typeof d.biologicalAge === 'number') lines.push(`- Biological age: ${d.biologicalAge.toFixed(1)}y (chronological ${d.chronologicalAge ?? '?'})`);
      if (typeof d.agingVelocityNumber === 'number') lines.push(`- Aging pace: ${d.agingVelocityNumber.toFixed(2)}× clock`);
    }
    lines.push('');
  }

  const latestTest = (exp.bloodTests ?? []).slice().sort((a, b) => new Date(b.taken_at).getTime() - new Date(a.taken_at).getTime())[0];
  if (latestTest) {
    lines.push(`## Latest lab panel — ${latestTest.taken_at}`);
    for (const b of latestTest.biomarkers ?? []) {
      lines.push(`- **${b.code}**: ${b.value}${b.unit ? ` ${b.unit}` : ''}`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('_Generated by Protocol · not medical advice · always discuss with a physician._');
  return lines.join('\n');
}

/** Download a blob to the user's device without opening a new tab. Safe
 *  to call from a click handler. */
export function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  // Release the URL after a frame so the browser has time to start the
  // download. Skipping this leaks the object URL until page navigation.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
