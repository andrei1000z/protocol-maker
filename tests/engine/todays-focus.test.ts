import { describe, test, expect } from 'vitest';
import { pickTodaysFocus, type ScheduleEntry } from '@/lib/engine/todays-focus';

const sched = (rows: ScheduleEntry[]): ScheduleEntry[] => rows;

describe('pickTodaysFocus', () => {
  test('returns [] for missing / empty schedule', () => {
    expect(pickTodaysFocus(null, '10:00')).toEqual([]);
    expect(pickTodaysFocus(undefined, '10:00')).toEqual([]);
    expect(pickTodaysFocus([], '10:00')).toEqual([]);
  });

  test('returns [] when now-time cannot be parsed', () => {
    expect(pickTodaysFocus([{ time: '10:00', activity: 'Take D3' }], 'not-a-time')).toEqual([]);
  });

  test('picks entries within the time window (−2h to +3h)', () => {
    const s = sched([
      { time: '05:00', activity: 'Way too early' },
      { time: '09:30', activity: 'Recent past' },
      { time: '10:15', activity: 'Happening now' },
      { time: '12:00', activity: 'Upcoming' },
      { time: '20:00', activity: 'Way later' },
    ]);
    const picks = pickTodaysFocus(s, '10:00', 5);
    const titles = picks.map(p => p.title);
    expect(titles).toContain('Recent past');
    expect(titles).toContain('Happening now');
    expect(titles).toContain('Upcoming');
    expect(titles).not.toContain('Way too early');
    expect(titles).not.toContain('Way later');
  });

  test('urgency classification: now / soon / upcoming', () => {
    const s = sched([
      { time: '09:59', activity: 'Just passed' },           // delta = -1 → now
      { time: '10:15', activity: 'Imminent' },              // delta = 15 → soon
      { time: '11:30', activity: 'Later today' },           // delta = 90 → upcoming
    ]);
    const picks = pickTodaysFocus(s, '10:00', 3);
    const byTitle: Record<string, string> = {};
    for (const p of picks) byTitle[p.title] = p.urgency;
    expect(byTitle['Just passed']).toBe('now');
    expect(byTitle['Imminent']).toBe('soon');
    expect(byTitle['Later today']).toBe('upcoming');
  });

  test('priority ranking: MUST beats STRONG beats lower priority', () => {
    const s = sched([
      { time: '10:10', activity: 'Optional', priority: 'OPTIONAL' },
      { time: '10:20', activity: 'Must do',  priority: 'MUST' },
      { time: '10:30', activity: 'Strong',   priority: 'STRONG' },
    ]);
    const picks = pickTodaysFocus(s, '10:00', 2);
    expect(picks[0].title).toBe('Must do');
    expect(picks[1].title).toBe('Strong');
  });

  test('category ranking kicks in when priority ties', () => {
    const s = sched([
      { time: '10:10', activity: 'Hydration break', category: 'hydration' },
      { time: '10:20', activity: 'Take supplement', category: 'supplements' },
    ]);
    const picks = pickTodaysFocus(s, '10:00', 2);
    expect(picks[0].title).toBe('Take supplement');
  });

  test('falls back to next upcoming when nothing in the window', () => {
    // It's 03:00 AM — way before typical schedule. Should still surface the
    // next few upcoming entries so the block isn't empty.
    const s = sched([
      { time: '07:00', activity: 'Morning routine' },
      { time: '08:00', activity: 'Breakfast' },
      { time: '12:00', activity: 'Lunch' },
    ]);
    const picks = pickTodaysFocus(s, '03:00', 2);
    expect(picks.length).toBeGreaterThan(0);
    expect(picks[0].title).toBe('Morning routine');
  });

  test('handles block times (HH:MM - HH:MM) by reading the start', () => {
    const s = sched([{ time: '10:00 - 14:00', activity: 'Deep work' }]);
    const picks = pickTodaysFocus(s, '10:30', 2);
    expect(picks[0]?.title).toBe('Deep work');
  });

  test('respects the limit parameter', () => {
    const s = sched(Array.from({ length: 6 }, (_, i) => ({
      time: `10:${String(i * 5).padStart(2, '0')}`,
      activity: `Entry ${i}`,
    })));
    expect(pickTodaysFocus(s, '10:00', 2).length).toBe(2);
    expect(pickTodaysFocus(s, '10:00', 4).length).toBe(4);
  });
});
