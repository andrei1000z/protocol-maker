import { Metadata } from 'next';
import Link from 'next/link';
import { SITE_URL } from '@/lib/config';
import PrintButton from './PrintButton';

// ─────────────────────────────────────────────────────────────────────────────
// Clinical share view — designed to be printable and read by a Romanian GP
// who hasn't heard of Peter Attia or Bryan Johnson.
// ─────────────────────────────────────────────────────────────────────────────
// Same /api/share backing as the marketing share, but:
//   • no "longevity score", no PhenoAge, no Bryan benchmark — those frames
//     can read as alternative-medicine adjacent to a clinical reviewer
//   • biomarkers shown with reference ranges (lab range, not longevity range)
//   • medications + supplements as a single combined regimen list
//   • detected patterns shown as plain-language findings, not "patterns"
//   • clean print stylesheet so File → Print produces a one-pager handout

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Sumar clinic — ${slug.slice(0, 6)}`,
    description: 'Rezumat al analizelor și regimului curent — vedere clinică pentru consultația cu medicul.',
    robots: 'noindex, nofollow',  // don't index — links are private by design
  };
}

interface BiomarkerReadout {
  code?: string;
  name?: string;
  shortName?: string;
  value?: number;
  unit?: string;
  classification?: string;
  longevityOptimalRange?: [number, number];
  labRange?: [number, number];
}

interface SupplementEntry {
  name?: string;
  dose?: string;
  timing?: string;
  form?: string;
  withFood?: boolean;
  justification?: string;
  priority?: string;
  interactions?: string[];
}

interface ProtocolJson {
  biomarkerReadout?: BiomarkerReadout[];
  supplements?: SupplementEntry[];
  diagnostic?: { chronologicalAge?: number };
}

interface ShareData {
  protocol_json: ProtocolJson;
  biological_age?: number;
  longevity_score?: number;
}

async function getSharedProtocol(slug: string): Promise<ShareData | null> {
  try {
    const res = await fetch(`${SITE_URL}/api/share?slug=${slug}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as ShareData;
  } catch {
    return null;
  }
}

// Romanian translation of the engine's classification labels — keeps the
// clinical view consistent with how a Romanian medic would phrase a finding.
function classificationRo(c?: string): string {
  if (!c) return '—';
  const map: Record<string, string> = {
    'optimal': 'optim',
    'sub_optimal': 'suboptim',
    'deficient': 'deficient',
    'critical': 'critic',
    'high': 'crescut',
    'low': 'scăzut',
    'borderline': 'la limită',
  };
  return map[c] || c.replace(/_/g, ' ');
}

function classificationColor(c?: string): string {
  if (!c) return 'text-muted-foreground';
  if (c === 'optimal') return 'text-emerald-600';
  if (c === 'sub_optimal' || c === 'borderline') return 'text-amber-600';
  if (c === 'deficient' || c === 'high' || c === 'low') return 'text-orange-600';
  if (c === 'critical') return 'text-red-600';
  return 'text-muted-foreground';
}

export default async function ClinicalSharePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getSharedProtocol(slug);

  if (!data || !data.protocol_json) {
    return (
      <div className="min-h-dvh flex items-center justify-center px-6">
        <div className="text-center space-y-4">
          <p className="text-xl font-bold">Link expirat sau invalid</p>
          <p className="text-sm text-muted-foreground">Cere pacientului să genereze un nou link.</p>
          <Link href="/" className="inline-block px-6 py-3 bg-accent text-black rounded-xl font-semibold text-sm">Vezi Protocol</Link>
        </div>
      </div>
    );
  }

  const p = data.protocol_json;
  const biomarkers = p.biomarkerReadout || [];
  const supplements = p.supplements || [];
  const today = new Date().toLocaleDateString('ro-RO', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-7 print:py-4 print:space-y-4">
      {/* Print-time stylesheet — strip background, tighten margins, force black text */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: A4; margin: 14mm 16mm; }
          body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
          .print-card { border: 1px solid #ddd !important; background: white !important; box-shadow: none !important; }
          a { color: inherit !important; text-decoration: none !important; }
        }
      ` }} />

      <header className="space-y-3 pb-4 border-b border-card-border">
        <div className="flex items-center justify-between no-print">
          <Link href="/" className="text-accent font-bold text-lg">Protocol</Link>
          <PrintButton />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Sumar clinic</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Document generat pe {today} pentru consultația cu medicul de familie. Pacient identificat doar prin link privat.
          </p>
        </div>
      </header>

      {/* Snapshot */}
      <section className="rounded-2xl bg-card border border-card-border p-5 print-card">
        <h2 className="text-base font-semibold mb-3">Date generale</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          {typeof p.diagnostic?.chronologicalAge === 'number' && (
            <div>
              <dt className="text-xs text-muted-foreground">Vârstă</dt>
              <dd className="font-mono font-semibold">{p.diagnostic.chronologicalAge} ani</dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-muted-foreground">Nr. biomarkeri analizați</dt>
            <dd className="font-mono font-semibold">{biomarkers.length}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Nr. suplimente recomandate</dt>
            <dd className="font-mono font-semibold">{supplements.length}</dd>
          </div>
        </dl>
      </section>

      {/* Biomarkers */}
      {biomarkers.length > 0 && (
        <section className="rounded-2xl bg-card border border-card-border p-5 print-card">
          <h2 className="text-base font-semibold mb-3">Buletin analize</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b border-card-border">
                <tr>
                  <th className="text-left py-2 pr-3 font-medium">Marker</th>
                  <th className="text-right py-2 px-3 font-medium">Valoare</th>
                  <th className="text-left py-2 px-3 font-medium">Unitate</th>
                  <th className="text-left py-2 px-3 font-medium">Interval lab</th>
                  <th className="text-left py-2 pl-3 font-medium">Interpretare</th>
                </tr>
              </thead>
              <tbody>
                {biomarkers.map((b, i) => (
                  <tr key={`${b.code || b.name}-${i}`} className="border-b border-card-border last:border-0">
                    <td className="py-2 pr-3 font-medium">{b.name || b.shortName || b.code}</td>
                    <td className="py-2 px-3 text-right font-mono">{b.value ?? '—'}</td>
                    <td className="py-2 px-3 text-xs text-muted-foreground">{b.unit || ''}</td>
                    <td className="py-2 px-3 text-xs text-muted-foreground font-mono">
                      {b.labRange ? `${b.labRange[0]}–${b.labRange[1]}` : '—'}
                    </td>
                    <td className={`py-2 pl-3 text-xs font-medium ${classificationColor(b.classification)}`}>
                      {classificationRo(b.classification)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Combined regimen — supplements + how to take */}
      {supplements.length > 0 && (
        <section className="rounded-2xl bg-card border border-card-border p-5 print-card">
          <h2 className="text-base font-semibold mb-3">Regim curent (suplimente)</h2>
          <p className="text-xs text-muted-foreground mb-3">
            Nicio prescripție medicală sub acest titlu. Toate aceste produse sunt suplimente alimentare disponibile fără rețetă.
          </p>
          <ul className="space-y-2.5">
            {supplements.map((s, i) => (
              <li key={`${s.name}-${i}`} className="text-sm flex items-baseline gap-2">
                <span className="font-medium">{s.name}</span>
                <span className="text-xs text-muted-foreground">
                  {[s.dose, s.timing, s.form, s.withFood ? 'cu mâncare' : null].filter(Boolean).join(' · ')}
                </span>
              </li>
            ))}
          </ul>
          {supplements.some(s => s.interactions && s.interactions.length > 0) && (
            <div className="mt-4 pt-3 border-t border-card-border">
              <p className="text-xs font-semibold mb-2">Interacțiuni notabile</p>
              <ul className="space-y-1">
                {supplements
                  .filter(s => s.interactions && s.interactions.length > 0)
                  .map((s, i) => (
                    <li key={i} className="text-xs text-muted-foreground">
                      <strong className="text-foreground">{s.name}:</strong> {s.interactions!.join('; ')}
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <footer className="pt-4 border-t border-card-border space-y-2 text-xs text-muted-foreground">
        <p>
          <strong className="text-foreground">Important pentru medic:</strong> Acest document este generat automat de o aplicație de optimizare a stilului de viață.
          Nu reprezintă un diagnostic medical și nu prescrie medicație. Decizia clinică finală aparține medicului.
        </p>
        <p>
          Pacientul poate revoca acest link în orice moment din aplicație. Link-ul nu este indexat de motoarele de căutare.
        </p>
        <p className="text-center pt-3">
          Generat de <Link href="/" className="text-accent">Protocol</Link> · {today}
        </p>
      </footer>
    </div>
  );
}

