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

// ─────────────────────────────────────────────────────────────────────────────
// iCalendar (.ics) — daily schedule + supplements as a subscribable calendar.
// ─────────────────────────────────────────────────────────────────────────────
// Strategy: emit one VEVENT per daily-schedule entry, repeating daily with
// RRULE:FREQ=DAILY so the user just imports once. Times are "floating local"
// (no TZID) — that way Apple/Google/Outlook all interpret them in whatever
// timezone the user's device is in, which matches what they expect when a
// protocol says "take Mg at 22:00".
//
// Supplements are derived from `supplementsHowTo` entries that have a clear
// time on the supplement card; agenda items come from `dailySchedule`. We
// emit only entries with a parseable HH:MM start.

interface ProtocolJsonForIcs {
  dailySchedule?: Array<{
    time?: string;
    activity?: string;
    category?: string;
    duration?: string;
    notes?: string;
    anchorRef?: string;
  }>;
  supplements?: Array<{
    name?: string;
    timing?: string;
    dose?: string;
    form?: string;
    howToTake?: string;
    justification?: string;
  }>;
}

// Pull "07:00" or "22:30" out of strings like "22:00", "08:00 - 14:00", "with breakfast 08:00".
// Returns [hh, mm] for the *start* time; null when nothing usable is found.
function parseHHMM(s: string | undefined): [number, number] | null {
  if (!s) return null;
  const m = s.match(/\b(\d{1,2}):(\d{2})\b/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return [hh, mm];
}

// Parse a duration string ("30 min", "1 h", "20m") to minutes. Defaults to 15.
function parseDurationMin(s: string | undefined): number {
  if (!s) return 15;
  const trimmed = s.toLowerCase();
  const hourMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*h/);
  if (hourMatch) return Math.round(Number(hourMatch[1]) * 60);
  const minMatch = trimmed.match(/(\d+)\s*m/);
  if (minMatch) return Number(minMatch[1]);
  return 15;
}

// RFC5545 line folding — fields can't exceed 75 octets per line; longer lines
// must be split with CRLF + a single space. We approximate by char count.
function foldLine(line: string): string {
  if (line.length <= 73) return line;
  const chunks: string[] = [];
  let i = 0;
  while (i < line.length) {
    chunks.push(line.slice(i, i + 73));
    i += 73;
  }
  return chunks.join('\r\n ');
}

// Escape per RFC5545 — commas, semicolons, backslashes, newlines.
function escIcs(s: string | undefined | null): string {
  if (!s) return '';
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function pad2(n: number): string { return n.toString().padStart(2, '0'); }

// Format a Date as iCalendar UTC timestamp "YYYYMMDDTHHMMSSZ" — used for DTSTAMP only.
function icsUtc(d: Date): string {
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`;
}

// Format a floating-local date+time "YYYYMMDDTHHMMSS" (no Z, no TZID).
// startDate is the calendar date the recurring rule anchors to.
function icsFloating(date: Date, hh: number, mm: number): string {
  return `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}T${pad2(hh)}${pad2(mm)}00`;
}

export function buildIcsCalendar(protocolJson: ProtocolJsonForIcs, opts?: { calName?: string; anchorDate?: Date }): string {
  const calName = opts?.calName || 'Protocol — agenda zilnică';
  const anchor = opts?.anchorDate || new Date();
  // Anchor on today; events repeat indefinitely until the user updates the
  // calendar feed. Calendar apps cap recurring expansion (Apple: 2 years,
  // Google: ~2 years), so users will re-import after a major protocol change.
  const dtstamp = icsUtc(new Date());
  const lines: string[] = [];
  lines.push('BEGIN:VCALENDAR');
  lines.push('VERSION:2.0');
  lines.push('PRODID:-//Protocol//Longevity Agenda//RO');
  lines.push('CALSCALE:GREGORIAN');
  lines.push('METHOD:PUBLISH');
  lines.push(`X-WR-CALNAME:${escIcs(calName)}`);
  lines.push('X-WR-TIMEZONE:Europe/Bucharest');

  let eventCount = 0;
  const seenUids = new Set<string>();

  const pushEvent = (params: {
    uid: string; hh: number; mm: number; durationMin: number;
    summary: string; description?: string;
  }) => {
    // Dedupe in case the schedule has duplicates with the same time + activity.
    if (seenUids.has(params.uid)) return;
    seenUids.add(params.uid);
    const startMin = params.hh * 60 + params.mm;
    const endMin = startMin + params.durationMin;
    const endHH = Math.floor(endMin / 60) % 24;
    const endMM = endMin % 60;
    const crossesMidnight = endMin >= 1440;
    const endDate = crossesMidnight
      ? new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + 1)
      : anchor;
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${params.uid}`);
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`DTSTART:${icsFloating(anchor, params.hh, params.mm)}`);
    lines.push(`DTEND:${icsFloating(endDate, endHH, endMM)}`);
    lines.push('RRULE:FREQ=DAILY');
    lines.push(foldLine(`SUMMARY:${escIcs(params.summary)}`));
    if (params.description) lines.push(foldLine(`DESCRIPTION:${escIcs(params.description)}`));
    lines.push('END:VEVENT');
    eventCount++;
  };

  // Daily schedule items first — they're the user's full day plan.
  for (const item of protocolJson.dailySchedule || []) {
    const t = parseHHMM(item.time);
    if (!t) continue;
    const summary = item.activity || item.category || 'Protocol';
    const description = [item.notes, item.anchorRef ? `Supliment: ${item.anchorRef}` : null].filter(Boolean).join(' · ');
    const slug = (item.activity || item.category || 'event').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
    // UID is deterministic (time + slug) so identical entries dedupe via seenUids.
    const uid = `${pad2(t[0])}${pad2(t[1])}-${slug}@protocol`;
    pushEvent({
      uid,
      hh: t[0], mm: t[1],
      durationMin: parseDurationMin(item.duration),
      summary,
      description,
    });
  }

  // Supplements whose card carries a parseable timing — adds a separate reminder
  // event so the user gets a notification, not just a passing schedule entry.
  for (const sup of protocolJson.supplements || []) {
    if (!sup.name) continue;
    const t = parseHHMM(sup.timing);
    if (!t) continue;
    const summary = `💊 ${sup.name}${sup.dose ? ` (${sup.dose})` : ''}`;
    const description = [sup.howToTake, sup.justification, sup.form].filter(Boolean).join(' · ');
    const slug = sup.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
    const uid = `sup-${pad2(t[0])}${pad2(t[1])}-${slug}@protocol`;
    pushEvent({
      uid,
      hh: t[0], mm: t[1],
      durationMin: 5,
      summary,
      description,
    });
  }

  lines.push('END:VCALENDAR');
  // RFC5545 requires CRLF line endings; calendar parsers are strict.
  return lines.join('\r\n');
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
