'use client';

import { useEffect, useState } from 'react';
import { FileText, TrendingUp, TrendingDown, Minus, Calendar } from 'lucide-react';
import { BIOMARKER_DB } from '@/lib/engine/biomarkers';
import clsx from 'clsx';

interface BloodTest {
  id: string;
  taken_at: string;
  biomarkers: { code: string; value: number; unit: string }[];
}

export default function HistoryPage() {
  const [tests, setTests] = useState<BloodTest[]>([]);
  const [selected, setSelected] = useState<[string | null, string | null]>([null, null]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/my-data').then(r => r.json()).then(d => {
      setTests(d.bloodTests || []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>;

  const getTest = (id: string) => tests.find(t => t.id === id);
  const test1 = selected[0] ? getTest(selected[0]) : null;
  const test2 = selected[1] ? getTest(selected[1]) : null;

  const toggleSelect = (id: string) => {
    if (selected[0] === id) setSelected([null, selected[1]]);
    else if (selected[1] === id) setSelected([selected[0], null]);
    else if (!selected[0]) setSelected([id, selected[1]]);
    else if (!selected[1]) setSelected([selected[0], id]);
    else setSelected([selected[1], id]);
  };

  const compareMarkers = () => {
    if (!test1 || !test2) return [];
    const map1 = new Map(test1.biomarkers.map(b => [b.code, b.value]));
    const map2 = new Map(test2.biomarkers.map(b => [b.code, b.value]));
    const allCodes = [...new Set([...map1.keys(), ...map2.keys()])];

    return allCodes.map(code => {
      const ref = BIOMARKER_DB.find(r => r.code === code);
      const v1 = map1.get(code);
      const v2 = map2.get(code);
      const delta = v1 !== undefined && v2 !== undefined ? v2 - v1 : null;
      const isLowerBetter = ['LDL', 'TRIG', 'HSCRP', 'HOMOCYS', 'HBA1C', 'GLUC', 'INSULIN', 'ALT', 'AST', 'GGT', 'CREAT', 'URIC_ACID', 'WBC', 'CORTISOL'].includes(code);
      const improved = delta !== null ? (isLowerBetter ? delta < 0 : delta > 0) : null;

      return { code, name: ref?.shortName || code, v1, v2, delta, improved, unit: ref?.unit || '' };
    });
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Blood Test History</h1>
        <p className="text-sm text-muted-foreground mt-1">Track your biomarkers over time. Select two tests to compare.</p>
      </div>

      {tests.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <FileText className="w-12 h-12 text-muted mx-auto" />
          <p className="text-muted-foreground">No blood tests uploaded yet.</p>
          <a href="/onboarding" className="text-accent text-sm hover:underline">Upload your first panel</a>
        </div>
      ) : (
        <>
          {/* Test list */}
          <div className="space-y-2">
            {tests.map(test => (
              <button key={test.id} onClick={() => toggleSelect(test.id)}
                className={clsx('w-full flex items-center gap-3 p-4 rounded-xl border transition-all text-left',
                  selected.includes(test.id) ? 'bg-accent/5 border-accent/30' : 'bg-card border-card-border hover:border-card-border')}>
                <Calendar className={clsx('w-5 h-5', selected.includes(test.id) ? 'text-accent' : 'text-muted')} />
                <div className="flex-1">
                  <p className="text-sm font-medium">{new Date(test.taken_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  <p className="text-[10px] text-muted">{test.biomarkers.length} biomarkers</p>
                </div>
                {selected.includes(test.id) && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/20 text-accent">
                    {selected[0] === test.id ? 'Older' : 'Newer'}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Comparison view */}
          {test1 && test2 && (
            <div className="rounded-2xl bg-card border border-card-border p-5 space-y-4">
              <h2 className="text-sm font-semibold">Comparison</h2>
              <div className="grid grid-cols-4 text-[10px] text-muted font-medium py-2 border-b border-card-border">
                <span>Marker</span>
                <span className="text-center">{new Date(test1.taken_at).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}</span>
                <span className="text-center">{new Date(test2.taken_at).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}</span>
                <span className="text-right">Change</span>
              </div>
              {compareMarkers().map(m => (
                <div key={m.code} className="grid grid-cols-4 items-center py-1.5 text-xs border-b border-card-border last:border-0">
                  <span className="font-medium">{m.name}</span>
                  <span className="text-center font-mono text-muted">{m.v1 ?? '-'}</span>
                  <span className="text-center font-mono">{m.v2 ?? '-'}</span>
                  <div className="flex items-center justify-end gap-1">
                    {m.delta !== null && (
                      <>
                        {m.improved === true && <TrendingUp className="w-3 h-3 text-accent" />}
                        {m.improved === false && <TrendingDown className="w-3 h-3 text-red-400" />}
                        {m.delta === 0 && <Minus className="w-3 h-3 text-muted" />}
                        <span className={clsx('font-mono', m.improved === true ? 'text-accent' : m.improved === false ? 'text-red-400' : 'text-muted')}>
                          {m.delta > 0 ? '+' : ''}{m.delta.toFixed(1)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
