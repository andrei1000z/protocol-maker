import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { DEFAULT_MACRO_TARGETS } from '@/lib/constants';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const rangeStart = searchParams.get('rangeStart');
    const rangeEnd = searchParams.get('rangeEnd');

    const [profileRes, protocolRes, logRes, configRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('protocols').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).single(),
      supabase.from('daily_logs').select('*').eq('user_id', user.id).eq('date', date).single(),
      supabase.from('user_configs').select('*').eq('user_id', user.id).single(),
    ]);

    const profile = profileRes.data ? {
      name: profileRes.data.name,
      age: profileRes.data.age,
      sex: profileRes.data.sex,
      height: profileRes.data.height,
      weight: profileRes.data.weight,
      goals: profileRes.data.goals || [],
      fitnessLevel: profileRes.data.fitness_level,
      macroTargets: profileRes.data.macro_targets || DEFAULT_MACRO_TARGETS,
      onboardingCompleted: profileRes.data.onboarding_completed,
    } : null;

    const protocol = protocolRes.data ? {
      macroTargets: protocolRes.data.macro_targets,
      dailyTasks: protocolRes.data.daily_tasks,
      supplements: protocolRes.data.supplements,
      tips: protocolRes.data.tips,
      warnings: protocolRes.data.warnings,
      summary: protocolRes.data.summary,
    } : null;

    const emptyLog = { date, tasks: [] as unknown[], supplements: [] as unknown[], meals: [] as unknown[], water: 0, mood: 0, energy: 0, focus: 0, notes: '', watchMetrics: {} as Record<string, unknown>, weight: null as number | null };
    let log = logRes.data ? {
      date: logRes.data.date,
      tasks: logRes.data.tasks,
      supplements: logRes.data.supplements,
      meals: logRes.data.meals,
      water: logRes.data.water,
      mood: logRes.data.mood,
      energy: logRes.data.energy,
      focus: logRes.data.focus,
      notes: logRes.data.notes,
      watchMetrics: logRes.data.watch_metrics || {},
      weight: logRes.data.weight,
    } : emptyLog;

    // Initialize daily log from protocol if empty
    if (log.tasks.length === 0 && protocol) {
      const config = configRes.data;
      const taskSource = config?.tasks || protocol.dailyTasks;
      const supSource = config?.supplements || protocol.supplements.map((s: { name: string }) => s.name);
      log = {
        ...emptyLog,
        tasks: (taskSource as { name: string; category: string }[]).map((t: { name: string; category: string }, i: number) => ({ id: `task_${i}`, name: t.name, category: t.category, done: false })),
        supplements: (supSource as string[]).map((name: string, i: number) => ({ id: `sup_${i}`, name, taken: false })),
      };
      // Save initialized log
      await supabase.from('daily_logs').upsert({
        user_id: user.id,
        date,
        tasks: log.tasks,
        supplements: log.supplements,
        meals: [],
        water: 0, mood: 0, energy: 0, focus: 0,
        notes: '',
        watch_metrics: {},
      }, { onConflict: 'user_id,date' });
    }

    // Range logs for stats
    let rangeLogs = null;
    if (rangeStart && rangeEnd) {
      const { data } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', rangeStart)
        .lte('date', rangeEnd)
        .order('date');
      rangeLogs = (data || []).map((r: Record<string, unknown>) => ({
        date: r.date,
        tasks: r.tasks,
        supplements: r.supplements,
        meals: r.meals,
        water: r.water,
        mood: r.mood,
        energy: r.energy,
        focus: r.focus,
        notes: r.notes,
        watchMetrics: r.watch_metrics || {},
        weight: r.weight,
      }));
    }

    return NextResponse.json({ profile, protocol, log, rangeLogs });
  } catch (err) {
    console.error('my-data error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
