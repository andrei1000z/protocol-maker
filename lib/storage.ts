import { createClient } from '@/lib/supabase/client';
import { DailyLog, GeneratedProtocol, UserProfile, MacroTargets } from './types';
import { getTodayKey } from './utils';
import { DEFAULT_MACRO_TARGETS } from './constants';

function getSupabase() {
  return createClient();
}

async function getUserId(): Promise<string | null> {
  try {
    const supabase = getSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id ?? null;
  } catch {
    return null;
  }
}

function createEmptyLog(date: string): DailyLog {
  return {
    date,
    tasks: [],
    supplements: [],
    meals: [],
    water: 0,
    mood: 0,
    energy: 0,
    focus: 0,
    notes: '',
    watchMetrics: {},
  };
}

export const storage = {
  async getProfile(): Promise<UserProfile | null> {
    try {
      const userId = await getUserId();
      if (!userId) return null;

      const supabase = getSupabase();
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (!data) return null;

      return {
        name: data.name,
        age: data.age,
        sex: data.sex as 'M' | 'F',
        height: data.height,
        weight: data.weight,
        goals: data.goals || [],
        fitnessLevel: data.fitness_level as UserProfile['fitnessLevel'],
        macroTargets: (data.macro_targets as MacroTargets) || DEFAULT_MACRO_TARGETS,
        onboardingCompleted: data.onboarding_completed,
      };
    } catch {
      return null;
    }
  },

  async saveProfile(profile: UserProfile): Promise<void> {
    const userId = await getUserId();
    if (!userId) return;

    const supabase = getSupabase();
    const { error } = await supabase.from('profiles').update({
      name: profile.name,
      age: profile.age,
      sex: profile.sex,
      height: profile.height,
      weight: profile.weight,
      goals: profile.goals,
      fitness_level: profile.fitnessLevel,
      macro_targets: profile.macroTargets,
      onboarding_completed: profile.onboardingCompleted,
    }).eq('id', userId);

    if (error) {
      console.error('saveProfile error:', error);
    }
  },

  async getProtocol(): Promise<GeneratedProtocol | null> {
    try {
      const userId = await getUserId();
      if (!userId) return null;

      const supabase = getSupabase();
      const { data } = await supabase
        .from('protocols')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!data) return null;

      return {
        macroTargets: data.macro_targets as MacroTargets,
        dailyTasks: data.daily_tasks as { name: string; category: string }[],
        supplements: data.supplements as { name: string; dose: string; timing: string }[],
        tips: data.tips || [],
        warnings: data.warnings || [],
        summary: data.summary,
      };
    } catch {
      return null;
    }
  },

  async saveProtocol(protocol: GeneratedProtocol): Promise<void> {
    const userId = await getUserId();
    if (!userId) {
      console.error('saveProtocol: no userId');
      return;
    }

    const supabase = getSupabase();
    const { error } = await supabase.from('protocols').insert({
      user_id: userId,
      macro_targets: protocol.macroTargets,
      daily_tasks: protocol.dailyTasks,
      supplements: protocol.supplements,
      tips: protocol.tips,
      warnings: protocol.warnings,
      summary: protocol.summary,
    });

    if (error) {
      console.error('saveProtocol error:', error);
    }
  },

  async getDailyLog(date?: string): Promise<DailyLog> {
    const key = date || getTodayKey();
    try {
      const userId = await getUserId();
      if (!userId) return createEmptyLog(key);

      const supabase = getSupabase();
      const { data } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('user_id', userId)
        .eq('date', key)
        .single();

      if (!data) return createEmptyLog(key);

      return {
        date: data.date,
        tasks: data.tasks as DailyLog['tasks'],
        supplements: data.supplements as DailyLog['supplements'],
        meals: data.meals as DailyLog['meals'],
        water: data.water,
        mood: data.mood,
        energy: data.energy,
        focus: data.focus,
        notes: data.notes,
        watchMetrics: (data.watch_metrics as Record<string, number>) || {},
        weight: data.weight ?? undefined,
      };
    } catch {
      return createEmptyLog(key);
    }
  },

  async saveDailyLog(log: DailyLog): Promise<void> {
    const userId = await getUserId();
    if (!userId) return;

    const supabase = getSupabase();
    await supabase.from('daily_logs').upsert(
      {
        user_id: userId,
        date: log.date,
        tasks: log.tasks,
        supplements: log.supplements,
        meals: log.meals,
        water: log.water,
        mood: log.mood,
        energy: log.energy,
        focus: log.focus,
        notes: log.notes,
        watch_metrics: log.watchMetrics,
        weight: log.weight ?? null,
      },
      { onConflict: 'user_id,date' }
    );
  },

  async getLogRange(startDate: string, endDate: string): Promise<DailyLog[]> {
    try {
      const userId = await getUserId();
      if (!userId) return [];

      const supabase = getSupabase();
      const { data } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date');

      if (!data) return [];

      const logsMap = new Map<string, DailyLog>();
      for (const row of data) {
        logsMap.set(row.date, {
          date: row.date,
          tasks: row.tasks as DailyLog['tasks'],
          supplements: row.supplements as DailyLog['supplements'],
          meals: row.meals as DailyLog['meals'],
          water: row.water,
          mood: row.mood,
          energy: row.energy,
          focus: row.focus,
          notes: row.notes,
          watchMetrics: (row.watch_metrics as Record<string, number>) || {},
          weight: row.weight ?? undefined,
        });
      }

      const result: DailyLog[] = [];
      const start = new Date(startDate + 'T00:00:00');
      const end = new Date(endDate + 'T00:00:00');
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = d.toISOString().split('T')[0];
        result.push(logsMap.get(key) || createEmptyLog(key));
      }
      return result;
    } catch {
      return [];
    }
  },

  async getUserConfig(): Promise<{ tasks: { name: string; category: string }[]; supplements: string[] } | null> {
    try {
      const userId = await getUserId();
      if (!userId) return null;

      const supabase = getSupabase();
      const { data } = await supabase
        .from('user_configs')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (!data) return null;
      return {
        tasks: data.tasks as { name: string; category: string }[],
        supplements: data.supplements || [],
      };
    } catch {
      return null;
    }
  },

  async saveUserConfig(config: { tasks: { name: string; category: string }[]; supplements: string[] }): Promise<void> {
    const userId = await getUserId();
    if (!userId) return;

    const supabase = getSupabase();
    const { error } = await supabase.from('user_configs').upsert(
      {
        user_id: userId,
        tasks: config.tasks,
        supplements: config.supplements,
      },
      { onConflict: 'user_id' }
    );

    if (error) {
      console.error('saveUserConfig error:', error);
    }
  },

  async exportAll(): Promise<string> {
    const profile = await this.getProfile();
    const protocol = await this.getProtocol();
    const config = await this.getUserConfig();
    const today = getTodayKey();
    const start = new Date();
    start.setDate(start.getDate() - 90);
    const logs = await this.getLogRange(start.toISOString().split('T')[0], today);
    return JSON.stringify({ profile, protocol, config, logs }, null, 2);
  },

  async resetAll(): Promise<void> {
    const userId = await getUserId();
    if (!userId) return;

    const supabase = getSupabase();
    await Promise.all([
      supabase.from('daily_logs').delete().eq('user_id', userId),
      supabase.from('protocols').delete().eq('user_id', userId),
      supabase.from('user_configs').delete().eq('user_id', userId),
      supabase.from('profiles').update({ onboarding_completed: false }).eq('id', userId),
    ]);
  },

  async initializeDailyLog(protocol: GeneratedProtocol): Promise<DailyLog> {
    const date = getTodayKey();
    const existing = await this.getDailyLog(date);
    if (existing.tasks.length > 0 || existing.supplements.length > 0) {
      return existing;
    }

    const config = await this.getUserConfig();
    const tasks = (config?.tasks || protocol.dailyTasks).map((t, i) => ({
      id: `task_${i}`,
      name: t.name,
      category: t.category,
      done: false,
    }));

    const supplementNames = config?.supplements || protocol.supplements.map((s) => s.name);
    const supplements = supplementNames.map((name, i) => ({
      id: `sup_${i}`,
      name,
      taken: false,
    }));

    const log: DailyLog = {
      ...createEmptyLog(date),
      tasks,
      supplements,
    };
    await this.saveDailyLog(log);
    return log;
  },
};
