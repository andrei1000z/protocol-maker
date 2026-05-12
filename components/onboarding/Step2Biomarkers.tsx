'use client';

// Onboarding step 2 — biomarker entry: PDF upload (parsed by Groq) + manual
// numeric inputs grouped by Big 11 priority then by category. Live
// classification dots reflect each value vs the longevity-optimal range.
// Derived data + handlers come from the parent page so the state machine
// and the PDF upload pipeline stay untouched.

import clsx from 'clsx';
import { Upload, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { BIOMARKER_DB, BIG_11_CODES, BIOMARKER_CATEGORIES, CATEGORY_LABELS } from '@/lib/engine/biomarkers';

type LiveClassification = string | null | undefined;

export interface Step2BiomarkersProps {
  biomarkers: Record<string, string>;
  showAllMarkers: boolean;
  setShowAllMarkers: (v: boolean) => void;
  pdfParsing: boolean;
  pdfParsed: boolean;
  filledCount: number;
  markersToShowBig11: typeof BIOMARKER_DB;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handlePdfUpload: (file: File) => void;
  updateBiomarker: (code: string, value: string) => void;
  getLiveClassification: (code: string, value: string) => LiveClassification;
}

export function Step2Biomarkers(p: Step2BiomarkersProps) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Analizele tale</h1>
        <p className="text-muted-foreground text-sm mt-1">Încarcă un PDF sau introdu manual.</p>
      </div>

      <div
        className={clsx(
          'border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer hover:border-accent/50',
          p.pdfParsed ? 'border-accent/50 bg-accent/5' : 'border-card-border',
        )}
        onClick={() => p.fileInputRef.current?.click()}
      >
        <input
          ref={p.fileInputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={e => e.target.files?.[0] && p.handlePdfUpload(e.target.files[0])}
        />
        {p.pdfParsing ? (
          <div className="space-y-3">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-accent">Procesare cu AI...</p>
          </div>
        ) : p.pdfParsed ? (
          <div className="space-y-2">
            <FileText className="w-10 h-10 text-accent mx-auto" />
            <p className="text-sm text-accent font-medium">{p.filledCount} biomarkeri detectați</p>
          </div>
        ) : (
          <div className="space-y-3">
            <Upload className="w-10 h-10 text-muted-foreground mx-auto" />
            <p className="text-sm font-medium">Aruncă PDF-ul analizelor aici</p>
            <p className="text-xs text-muted-foreground">Synevo, Regina Maria, MedLife, Bioclinica, LabCorp, Quest</p>
          </div>
        )}
      </div>

      <p className="text-xs text-accent uppercase tracking-wider">Markeri esențiali (Big 11)</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {p.markersToShowBig11.map(b => {
          const cls = p.getLiveClassification(b.code, p.biomarkers[b.code] || '');
          return (
            <div key={b.code} className="flex items-center gap-2 rounded-xl border border-card-border p-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{b.shortName}</p>
                <p className="text-xs text-muted">Optim: {b.longevityOptimalLow}-{b.longevityOptimalHigh}</p>
              </div>
              <input
                type="number"
                value={p.biomarkers[b.code] || ''}
                onChange={e => p.updateBiomarker(b.code, e.target.value)}
                placeholder={b.bryanJohnsonValue ? String(b.bryanJohnsonValue) : ''}
                step="0.1"
                className="w-20 rounded-lg bg-background border border-card-border px-2 py-1.5 text-sm text-right outline-none focus:border-accent font-mono"
              />
              <span className="text-xs text-muted w-14">{b.unit}</span>
              {cls && (
                <span className={clsx(
                  'w-2 h-2 rounded-full',
                  cls === 'OPTIMAL' ? 'bg-accent' : cls.includes('SUBOPTIMAL') ? 'bg-amber-400' : 'bg-red-400',
                )} />
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={() => p.setShowAllMarkers(!p.showAllMarkers)}
        className="flex items-center gap-1 text-xs text-accent hover:underline mx-auto"
      >
        {p.showAllMarkers ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {p.showAllMarkers ? 'Arată mai puțin' : `Arată toți cei ${BIOMARKER_DB.length} markeri`}
      </button>

      {p.showAllMarkers && BIOMARKER_CATEGORIES.map(cat => {
        const catMarkers = BIOMARKER_DB.filter(b => b.category === cat && !BIG_11_CODES.includes(b.code));
        if (catMarkers.length === 0) return null;
        return (
          <div key={cat} className="space-y-2">
            <p className="text-xs text-accent uppercase tracking-wider">{CATEGORY_LABELS[cat] || cat}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {catMarkers.map(b => {
                const cls = p.getLiveClassification(b.code, p.biomarkers[b.code] || '');
                return (
                  <div key={b.code} className="flex items-center gap-2 bg-card rounded-xl border border-card-border p-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{b.shortName}</p>
                      <p className="text-xs text-muted">{b.longevityOptimalLow}-{b.longevityOptimalHigh} {b.unit}</p>
                    </div>
                    <input
                      type="number"
                      value={p.biomarkers[b.code] || ''}
                      onChange={e => p.updateBiomarker(b.code, e.target.value)}
                      step="0.1"
                      className="w-20 rounded-lg bg-background border border-card-border px-2 py-1.5 text-sm text-right outline-none focus:border-accent font-mono"
                    />
                    <span className="text-xs text-muted w-12">{b.unit}</span>
                    {cls && (
                      <span className={clsx(
                        'w-2 h-2 rounded-full',
                        cls === 'OPTIMAL' ? 'bg-accent' : cls.includes('SUBOPTIMAL') ? 'bg-amber-400' : 'bg-red-400',
                      )} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
