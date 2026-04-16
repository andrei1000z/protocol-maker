'use client';

import { useEffect, useState } from 'react';
import { ProtocolOutput, Classification } from '@/lib/types';
import { getClassificationColor, getClassificationBg } from '@/lib/engine/classifier';
import clsx from 'clsx';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer,
} from 'recharts';

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-card border border-card-border p-5 space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <span>{icon}</span> {title}
      </h2>
      {children}
    </div>
  );
}

function Badge({ classification }: { classification: Classification }) {
  return (
    <span className={clsx('text-[10px] font-mono px-2 py-0.5 rounded-full border', getClassificationBg(classification), getClassificationColor(classification))}>
      {classification}
    </span>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<{ protocol: ProtocolOutput; longevityScore: number; biologicalAge: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/my-data')
      .then((r) => r.json())
      .then((d) => {
        if (d.protocol) {
          setData({
            protocol: d.protocol.protocol_json,
            longevityScore: d.protocol.longevity_score,
            biologicalAge: d.protocol.biological_age,
          });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center min-h-dvh">
      <div className="text-center space-y-4">
        <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-muted-foreground">Loading protocol...</p>
      </div>
    </div>
  );

  if (!data) return (
    <div className="flex items-center justify-center min-h-dvh px-6">
      <div className="text-center space-y-4">
        <p className="text-xl">No protocol generated yet.</p>
        <a href="/onboarding" className="inline-block px-6 py-3 bg-accent text-black rounded-xl font-semibold">Generate Protocol</a>
      </div>
    </div>
  );

  const { protocol: p, longevityScore, biologicalAge } = data;
  const diag = p.diagnostic;
  const radarData = diag?.organSystemScores
    ? Object.entries(diag.organSystemScores).map(([key, val]) => ({ name: key, score: val as number }))
    : [];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold"><span className="text-accent">Protocol</span></h1>
        <p className="text-sm text-muted-foreground">Your personalized longevity protocol</p>
      </div>

      {/* Section 1 — Diagnostic Summary */}
      <Section title="Diagnostic" icon="🎯">
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-4 rounded-xl bg-background border border-card-border">
            <p className="text-3xl font-bold font-mono text-accent">{longevityScore}</p>
            <p className="text-[10px] text-muted mt-1">LONGEVITY SCORE</p>
          </div>
          <div className="text-center p-4 rounded-xl bg-background border border-card-border">
            <p className="text-3xl font-bold font-mono">{biologicalAge}</p>
            <p className="text-[10px] text-muted mt-1">BIOLOGICAL AGE</p>
          </div>
          <div className="text-center p-4 rounded-xl bg-background border border-card-border">
            <p className="text-3xl font-bold font-mono">{diag?.chronologicalAge}</p>
            <p className="text-[10px] text-muted mt-1">CHRONOLOGICAL AGE</p>
          </div>
        </div>
        {diag?.topWins && (
          <div>
            <p className="text-xs text-accent font-medium mb-1">✅ Top Wins</p>
            {diag.topWins.map((w, i) => <p key={i} className="text-sm text-muted-foreground">• {w}</p>)}
          </div>
        )}
        {diag?.topRisks && (
          <div>
            <p className="text-xs text-danger font-medium mb-1">⚠️ Top Risks</p>
            {diag.topRisks.map((r, i) => <p key={i} className="text-sm text-muted-foreground">• {r}</p>)}
          </div>
        )}
        {radarData.length > 0 && (
          <ResponsiveContainer width="100%" height={250}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#1a1a1a" />
              <PolarAngleAxis dataKey="name" tick={{ fontSize: 10, fill: '#a1a1aa' }} />
              <Radar dataKey="score" stroke="#00ff88" fill="#00ff88" fillOpacity={0.15} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        )}
      </Section>

      {/* Section 2 — Biomarkers */}
      {p.biomarkerReadout && p.biomarkerReadout.length > 0 && (
        <Section title="Biomarkers" icon="🔬">
          <div className="space-y-2">
            {p.biomarkerReadout.map((b) => (
              <div key={b.code} className="flex items-center justify-between p-3 rounded-xl bg-background border border-card-border">
                <div>
                  <p className="text-sm font-medium">{(b as Record<string, unknown>).shortName as string || b.name}</p>
                  <p className="text-[10px] text-muted">Optimal: {b.longevityOptimalRange[0]}-{b.longevityOptimalRange[1]} {b.unit} {b.bryanValue ? `| Bryan: ${b.bryanValue}` : ''}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={clsx('text-lg font-bold font-mono', getClassificationColor(b.classification))}>{b.value}</span>
                  <span className="text-xs text-muted">{b.unit}</span>
                  <Badge classification={b.classification} />
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Section 3 — Nutrition */}
      {p.nutrition && (
        <Section title="Nutrition" icon="🥗">
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="p-3 rounded-xl bg-background border border-card-border">
              <p className="text-xl font-bold font-mono">{p.nutrition.dailyCalories}</p>
              <p className="text-[10px] text-muted">kcal/day</p>
            </div>
            <div className="p-3 rounded-xl bg-background border border-card-border">
              <p className="text-xl font-bold font-mono text-red-400">{p.nutrition.macros?.protein}g</p>
              <p className="text-[10px] text-muted">Protein</p>
            </div>
            <div className="p-3 rounded-xl bg-background border border-card-border">
              <p className="text-xl font-bold font-mono text-blue-400">{p.nutrition.macros?.carbs}g</p>
              <p className="text-[10px] text-muted">Carbs</p>
            </div>
            <div className="p-3 rounded-xl bg-background border border-card-border">
              <p className="text-xl font-bold font-mono text-amber-400">{p.nutrition.macros?.fat}g</p>
              <p className="text-[10px] text-muted">Fats</p>
            </div>
          </div>
          {p.nutrition.eatingWindow && <p className="text-sm text-muted-foreground">Eating window: <span className="text-accent font-mono">{p.nutrition.eatingWindow}</span></p>}
          {p.nutrition.meals?.map((m, i) => (
            <div key={i} className="p-3 rounded-xl bg-background border border-card-border">
              <p className="text-sm font-medium">{m.name}</p>
              <p className="text-xs text-muted-foreground mt-1">{m.description}</p>
            </div>
          ))}
          {p.nutrition.foodsToAdd?.length > 0 && (
            <div>
              <p className="text-xs text-accent font-medium mb-1">+ Add to diet</p>
              {p.nutrition.foodsToAdd.map((f, i) => <p key={i} className="text-xs text-muted-foreground">• <span className="text-foreground">{f.food}</span> — {f.why}</p>)}
            </div>
          )}
        </Section>
      )}

      {/* Section 4 — Supplements */}
      {p.supplements && p.supplements.length > 0 && (
        <Section title="Supplements" icon="💊">
          <div className="space-y-3">
            {p.supplements.map((s, i) => (
              <div key={i} className={clsx('p-4 rounded-xl border', s.priority === 'MUST' ? 'bg-accent/5 border-accent/30' : s.priority === 'STRONG' ? 'bg-blue-500/5 border-blue-500/30' : 'bg-card border-card-border')}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold">{s.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.dose} • {s.timing} • {s.form}</p>
                  </div>
                  <div className="text-right">
                    <span className={clsx('text-[10px] font-mono px-2 py-0.5 rounded-full', s.priority === 'MUST' ? 'bg-accent/20 text-accent' : s.priority === 'STRONG' ? 'bg-blue-500/20 text-blue-400' : 'bg-card-border text-muted')}>{s.priority}</span>
                    {s.monthlyCostRon > 0 && <p className="text-[10px] text-muted mt-1">{s.monthlyCostRon} RON/mo</p>}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">{s.justification}</p>
                <a href={`https://www.emag.ro/search/${encodeURIComponent(s.name + ' ' + (s.form || ''))}`}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-2 text-[10px] text-accent hover:underline">
                  🛒 Find on eMAG
                </a>
              </div>
            ))}
            <p className="text-xs text-muted text-right">
              Estimated total: {p.supplements.reduce((sum, s) => sum + (s.monthlyCostRon || 0), 0)} RON/mo
            </p>
          </div>
        </Section>
      )}

      {/* Section 5 — Exercise */}
      {p.exercise && (
        <Section title="Exercise" icon="🏋️">
          {p.exercise.weeklyPlan?.map((d, i) => (
            <div key={i} className="flex items-center gap-3 p-2 rounded-xl bg-background border border-card-border">
              <span className="text-xs font-mono text-accent w-14">{d.day}</span>
              <span className="text-sm flex-1">{d.activity}</span>
              <span className="text-xs text-muted">{d.duration}</span>
            </div>
          ))}
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>Zone 2: <span className="text-accent font-mono">{p.exercise.zone2Target} min/week</span></span>
            <span>Strength: <span className="text-accent font-mono">{p.exercise.strengthSessions}x/week</span></span>
          </div>
        </Section>
      )}

      {/* Section 6 — Sleep */}
      {p.sleep && (
        <Section title="Sleep" icon="🌙">
          <p className="text-sm">Bedtime target: <span className="text-accent font-mono">{p.sleep.targetBedtime}</span></p>
          <p className="text-sm">Morning light: <span className="text-accent font-mono">{p.sleep.morningLightMinutes} min</span></p>
          {p.sleep.windDownRoutine?.map((s, i) => <p key={i} className="text-xs text-muted-foreground">• {typeof s === 'string' ? s : `${s.time}: ${s.action}`}</p>)}
        </Section>
      )}

      {/* Section 7 — Tracking */}
      {p.tracking && (
        <Section title="What to Track" icon="📊">
          {p.tracking.daily && <div><p className="text-xs text-accent font-medium mb-1">Daily</p>{p.tracking.daily.map((d, i) => <p key={i} className="text-xs text-muted-foreground">• {d}</p>)}</div>}
          {p.tracking.retestSchedule && (
            <div><p className="text-xs text-accent font-medium mb-1">Retest Schedule</p>
              {p.tracking.retestSchedule.map((r, i) => <p key={i} className="text-xs text-muted-foreground">• <span className="text-foreground">{r.marker}</span> în {r.weeks} weeks — {r.why}</p>)}
            </div>
          )}
        </Section>
      )}

      {/* Section 8 — Doctor Discussion */}
      {p.doctorDiscussion && (
        <Section title="Doctor Discussion" icon="👨‍⚕️">
          <div className="rounded-xl bg-warning/10 border border-warning/30 p-3">
            <p className="text-xs text-warning font-medium mb-2">⚠️ Warning: These recommendations do NOT replace medical consultation.</p>
            {p.doctorDiscussion.redFlags?.map((f, i) => <p key={i} className="text-xs text-danger">🚩 {f}</p>)}
            {p.doctorDiscussion.rxSuggestions?.map((r, i) => <p key={i} className="text-xs text-muted-foreground mt-1">💊 {r}</p>)}
            {p.doctorDiscussion.specialistReferrals?.map((s, i) => <p key={i} className="text-xs text-muted-foreground mt-1">🏥 {s}</p>)}
          </div>
        </Section>
      )}

      {/* Section 9 — Roadmap */}
      {p.roadmap && (
        <Section title="12-Week Roadmap" icon="🗺️">
          {p.roadmap.map((r, i) => (
            <div key={i} className="flex gap-3">
              <div className="w-1 rounded-full bg-accent/30 shrink-0" />
              <div>
                <p className="text-sm font-medium text-accent">{r.week}</p>
                {r.actions.map((a, j) => <p key={j} className="text-xs text-muted-foreground">• {a}</p>)}
              </div>
            </div>
          ))}
        </Section>
      )}

      {/* Section 10 — Shopping List */}
      {p.shoppingList && (
        <Section title="Shopping List" icon="🛒">
          {p.shoppingList.map((cat, i) => (
            <div key={i}>
              <p className="text-xs text-accent font-medium mb-1">{cat.category}</p>
              {cat.items?.map((item, j) => (
                <div key={j} className="flex items-center justify-between py-1.5 text-xs border-b border-card-border last:border-0">
                  <a href={`https://www.emag.ro/search/${encodeURIComponent(item.name)}`} target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors">{item.name} ↗</a>
                  <span className="text-muted font-mono shrink-0 ml-2">{item.estimatedCostRon} RON</span>
                </div>
              ))}
            </div>
          ))}
        </Section>
      )}

      {/* Footer */}
      <div className="text-center py-8 space-y-2">
        <p className="text-xs text-muted">Generated by <span className="text-accent">Protocol AI Engine</span></p>
        <p className="text-[10px] text-muted">Disclaimer: This is not medical advice. Consult a doctor before making changes.</p>
        <a href="/onboarding" className="text-xs text-accent underline">Regenerate protocol</a>
      </div>
    </div>
  );
}
