// Engine helper: turn recent supplement_feedback rows into a prompt-ready
// paragraph that tells the AI what the user reacted to so the next regen
// routes around it.
//
// Schema mirror of the DB row. Kept narrow so `describeFeedbackForPrompt`
// can run on a `supabase.from('supplement_feedback').select('*')` result
// without a type assertion.

export interface SupplementFeedbackRow {
  id: string;
  user_id: string;
  supplement_name: string;
  categories: string[];
  notes: string | null;
  reported_at: string;
  protocol_id?: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  digestive: 'digestive issues',
  sleep:     'sleep disruption',
  energy:    'energy / jitters',
  mood:      'mood change',
  skin:      'skin reaction',
  headache:  'headaches',
  other:     'other reaction',
};

/**
 * Render a compact string the AI can read before the next regen. The caller
 * passes the last 30 days (or whatever window) so we don't weight a year-old
 * "bloating on creatine" against a new protocol where the user quit creatine
 * long ago.
 *
 * Output shape:
 *   "User reported side effects on:
 *    · Magnesium Glycinate — digestive issues (3d ago). Notes: 'bloating 2h after dose'.
 *    · Caffeine + L-Theanine — energy / jitters (6d ago).
 *   Avoid these supplements or pick alternatives when possible."
 *
 * Returns null if `rows` is empty so the prompt can skip the section.
 */
export function describeFeedbackForPrompt(rows: SupplementFeedbackRow[] | null | undefined): string | null {
  if (!rows || rows.length === 0) return null;

  // Collapse duplicate reports — same supplement reported twice in the
  // window just gets merged-category treatment. Most recent reported_at wins.
  const byName = new Map<string, { categories: Set<string>; latest: Date; notes?: string }>();
  for (const r of rows) {
    const name = r.supplement_name.trim();
    if (!name) continue;
    const entry = byName.get(name) ?? { categories: new Set<string>(), latest: new Date(0) };
    for (const c of r.categories || []) entry.categories.add(c);
    const t = new Date(r.reported_at);
    if (t > entry.latest) {
      entry.latest = t;
      if (r.notes && r.notes.trim()) entry.notes = r.notes.trim();
    }
    byName.set(name, entry);
  }

  if (byName.size === 0) return null;

  const now = Date.now();
  const lines: string[] = [];
  for (const [name, entry] of byName) {
    const cats = [...entry.categories].map(c => CATEGORY_LABELS[c] ?? c).join(', ');
    const daysAgo = Math.max(0, Math.round((now - entry.latest.getTime()) / (24 * 3600_000)));
    const ago = daysAgo <= 0 ? 'today' : daysAgo === 1 ? 'yesterday' : `${daysAgo}d ago`;
    const notePart = entry.notes ? ` Notes: "${entry.notes.slice(0, 180)}".` : '';
    lines.push(`· ${name} — ${cats} (${ago}).${notePart}`);
  }

  return [
    'User reported side effects on recent supplements:',
    ...lines,
    'Avoid these supplements in the new protocol or swap them for better-tolerated alternatives (for example: magnesium glycinate → malate for GI; 5-HTP → L-tryptophan for anxious; high-dose D3 → lower daily with K2).',
  ].join('\n');
}
