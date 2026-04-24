'use client';

// Today's Agenda — single timeline of every actionable item for today.
// Pulls from the protocol, today's meals, today's daily-metrics row, and
// the retest-due list, then renders chronologically with status pills.

import Link from 'next/link';
import { useMemo } from 'react';
import clsx from 'clsx';
import { CalendarCheck, ChevronRight } from 'lucide-react';
import { useMyData, useMeals } from '@/lib/hooks/useApiData';
import { useDailyMetrics } from '@/lib/hooks/useDailyMetrics';
import { computeRetestDue } from '@/lib/engine/biomarker-trends';
import { buildAgenda, summarizeAgenda, type AgendaCategory } from '@/lib/engine/agenda';
import { BUCKET_LABELS } from '@/lib/engine/supplement-timing';

const CATEGORY_EMOJI: Record<AgendaCategory, string> = {
  supplement: '💊',
  workout:    '🏋️',
  sleep:      '🌙',
  meal:       '🍽',
  retest:     '🧪',
  mindset:    '🧘',
};

export function TodaysAgenda() {
  const { data: myData } = useMyData();
  const { data: mealsData } = useMeals(1);
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const { metrics: todayMetrics } = useDailyMetrics(todayIso);

  // Bucket today's meals by hour-of-day so the agenda can hide nudges for
  // meals already logged this morning / midday / evening.
  const todayMealCount = useMemo(() => {
    const out = { morning: 0, midday: 0, evening: 0 };
    for (const m of mealsData?.meals ?? []) {
      const h = new Date(m.eaten_at).getHours();
      if (h < 11) out.morning++;
      else if (h < 17) out.midday++;
      else out.evening++;
    }
    return out;
  }, [mealsData?.meals]);

  // Retest list — same primitive the dashboard biomarker section uses.
  const retestDue = useMemo(() => {
    const tests = (myData?.bloodTests ?? []) as NonNullable<Parameters<typeof computeRetestDue>[0]>[];
    const sorted = [...tests].sort((a, b) => new Date(b.taken_at).getTime() - new Date(a.taken_at).getTime());
    return computeRetestDue(sorted[0] ?? null);
  }, [myData?.bloodTests]);

  const items = useMemo(() => {
    return buildAgenda({
      protocolJson: (myData?.protocol?.protocol_json as Record<string, unknown>) ?? null,
      todayMealCount,
      workoutDoneToday: !!todayMetrics?.workout_done,
      sleepLoggedToday: typeof todayMetrics?.sleep_hours === 'number',
      retestDue: retestDue.slice(0, 1),
    });
  }, [myData?.protocol?.protocol_json, todayMealCount, todayMetrics?.workout_done, todayMetrics?.sleep_hours, retestDue]);

  if (items.length === 0) return null;

  const summary = summarizeAgenda(items);

  return (
    <section className="rounded-3xl bg-surface-1 border border-card-border p-5 sm:p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-accent/10 border border-accent/25 flex items-center justify-center shrink-0">
            <CalendarCheck className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-semibold tracking-tight">Ce faci azi</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
              {summary.overdue > 0 && <span className="text-amber-400">{summary.overdue} în urmă · </span>}
              {summary.pending === 0 && summary.overdue === 0
                ? <span className="text-accent">Gata — bravo.</span>
                : <><span>{summary.pending} rămase</span>{summary.done > 0 && <span className="text-accent"> · {summary.done} gata</span>}</>}
            </p>
          </div>
        </div>
      </div>

      <ol className="space-y-1.5">
        {items.map(item => {
          const tone = item.done
            ? 'opacity-60 bg-surface-2/60 border-card-border'
            : item.status === 'overdue'
              ? 'bg-amber-500/[0.05] border-amber-500/25'
              : item.status === 'now'
                ? 'bg-accent/[0.05] border-accent/25'
                : 'bg-surface-2 border-card-border';
          const bucketLabel = BUCKET_LABELS[item.bucket].title;
          const Wrapper = ({ children }: { children: React.ReactNode }) =>
            item.href
              ? <Link href={item.href} className="block">{children}</Link>
              : <div>{children}</div>;
          return (
            <li key={item.id}>
              <Wrapper>
                <div className={clsx('flex items-center gap-3 p-3 rounded-xl border transition-colors',
                  item.href && !item.done && 'hover:border-card-border-hover', tone)}>
                  <span className="text-lg shrink-0" aria-hidden>{CATEGORY_EMOJI[item.category]}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={clsx('text-sm font-medium truncate', item.done && 'line-through')}>{item.title}</p>
                      <span className={clsx('text-[11px] font-medium font-mono uppercase tracking-widest px-1.5 py-0.5 rounded-full border shrink-0',
                        item.status === 'overdue' ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
                        : item.status === 'now' ? 'text-accent bg-accent/10 border-accent/30'
                        : item.status === 'done' ? 'text-muted-foreground bg-surface-3 border-card-border'
                        : 'text-muted bg-surface-3/60 border-card-border')}>
                        {item.status === 'now' ? 'fă acum' : item.status === 'overdue' ? 'pierdut' : item.status === 'done' ? 'gata' : bucketLabel.toLowerCase()}
                      </span>
                    </div>
                    {item.detail && (
                      <p className="text-[11px] text-muted-foreground leading-snug mt-0.5 truncate">{item.detail}</p>
                    )}
                  </div>
                  {item.href && !item.done && (
                    <ChevronRight className="w-4 h-4 text-muted shrink-0" />
                  )}
                </div>
              </Wrapper>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
