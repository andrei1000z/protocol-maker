import { describe, test, expect } from 'vitest';
import { buildAgenda, summarizeAgenda } from '@/lib/engine/agenda';

describe('buildAgenda', () => {
  test('returns empty when protocol has nothing actionable', () => {
    expect(buildAgenda({ protocolJson: {} })).toEqual([]);
  });

  test('groups supplements per time bucket', () => {
    const out = buildAgenda({
      protocolJson: {
        supplements: [
          { name: 'Vitamin D', timing: 'morning' },
          { name: 'Omega-3', timing: 'with dinner' },
          { name: 'Magnesium', timing: 'before bed' },
        ],
      },
      nowHour: 10,
    });
    expect(out.find(i => i.id === 'sup-morning')).toBeTruthy();
    expect(out.find(i => i.id === 'sup-evening')).toBeTruthy();
    expect(out.find(i => i.id === 'sup-bedtime')).toBeTruthy();
  });

  test('marks past-bucket items as overdue', () => {
    const out = buildAgenda({
      protocolJson: { supplements: [{ name: 'Vitamin D', timing: 'morning' }] },
      nowHour: 16,
    });
    const morning = out.find(i => i.id === 'sup-morning');
    expect(morning?.status).toBe('overdue');
  });

  test('marks current-bucket items as "now"', () => {
    const out = buildAgenda({
      protocolJson: { supplements: [{ name: 'Vitamin D', timing: 'morning' }] },
      nowHour: 8,
    });
    expect(out.find(i => i.id === 'sup-morning')?.status).toBe('now');
  });

  test('skips meal nudge when bucket already has logged meals', () => {
    const out = buildAgenda({
      protocolJson: {},
      nowHour: 12,
      todayMealCount: { morning: 1, midday: 1, evening: 0 },
    });
    expect(out.find(i => i.id === 'meal-morning')).toBeFalsy();
    expect(out.find(i => i.id === 'meal-midday')).toBeFalsy();
  });

  test('marks workout done when reported', () => {
    const out = buildAgenda({
      protocolJson: { exercise: { strengthSessionsPerWeek: 3 } },
      workoutDoneToday: true,
      nowHour: 12,
    });
    const workout = out.find(i => i.id === 'workout');
    expect(workout?.done).toBe(true);
    expect(workout?.status).toBe('done');
  });

  test('overdue retest sorts to the top', () => {
    const out = buildAgenda({
      protocolJson: { supplements: [{ name: 'Vitamin D', timing: 'morning' }] },
      retestDue: [{ shortName: 'LDL', weeksOverdue: 4 }],
      nowHour: 14,
    });
    expect(out[0].category).toBe('retest');
  });

  test('done items still appear in the list', () => {
    const out = buildAgenda({
      protocolJson: { sleep: { targetBedtime: '22:30', targetHours: 8 } },
      sleepLoggedToday: true,
      nowHour: 9,
    });
    expect(out.find(i => i.category === 'sleep')?.done).toBe(true);
  });
});

describe('summarizeAgenda', () => {
  test('counts pending / done / overdue separately', () => {
    const out = summarizeAgenda([
      { id: 'a', category: 'supplement', title: 'x', bucket: 'morning', status: 'overdue' },
      { id: 'b', category: 'sleep', title: 'y', bucket: 'bedtime', status: 'now' },
      { id: 'c', category: 'workout', title: 'z', bucket: 'midday', status: 'done', done: true },
    ]);
    expect(out).toEqual({ pending: 1, done: 1, overdue: 1 });
  });
});
