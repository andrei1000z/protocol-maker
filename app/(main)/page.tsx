'use client';

import { useDailyLog } from '@/lib/hooks/useDailyLog';
import { SummaryCards } from '@/components/today/SummaryCards';
import { WaterTracker } from '@/components/today/WaterTracker';
import { TaskList } from '@/components/today/TaskList';
import { SupplementList } from '@/components/today/SupplementList';
import { MoodRatings } from '@/components/today/MoodRatings';
import { DailyNotes } from '@/components/today/DailyNotes';
import { DEFAULT_MACRO_TARGETS } from '@/lib/constants';
import { formatDate, getTodayKey } from '@/lib/utils';

export default function TodayPage() {
  const {
    log, profile, hydrated,
    toggleTask, toggleSupplement,
    setWater, setMood, setEnergy, setFocus, setNotes,
  } = useDailyLog();

  if (!hydrated || !log) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const macroTargets = profile?.macroTargets || DEFAULT_MACRO_TARGETS;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Salut, {profile?.name || 'User'}!</h1>
        <p className="text-sm text-muted-foreground">{formatDate(getTodayKey())}</p>
      </div>
      <SummaryCards log={log} macroTargets={macroTargets} />
      <WaterTracker water={log.water} onSetWater={setWater} />
      <TaskList tasks={log.tasks} onToggle={toggleTask} />
      <SupplementList supplements={log.supplements} onToggle={toggleSupplement} />
      <MoodRatings mood={log.mood} energy={log.energy} focus={log.focus} onMood={setMood} onEnergy={setEnergy} onFocus={setFocus} />
      <DailyNotes notes={log.notes} onNotesChange={setNotes} />
    </div>
  );
}
