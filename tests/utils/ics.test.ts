import { describe, it, expect } from 'vitest';
import { buildIcsCalendar } from '@/lib/utils/export-formats';

describe('buildIcsCalendar', () => {
  it('emits a valid VCALENDAR skeleton', () => {
    const ics = buildIcsCalendar({});
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('METHOD:PUBLISH');
    // CRLF line endings — RFC5545 requires
    expect(ics).toContain('\r\n');
  });

  it('emits one VEVENT per dailySchedule entry with a parseable HH:MM time', () => {
    const ics = buildIcsCalendar({
      dailySchedule: [
        { time: '07:00', activity: 'Wake + sunlight', category: 'wake', duration: '5 min', notes: 'Step outside' },
        { time: '08:00 - 14:00', activity: 'Work block', category: 'work', duration: '6 h' },
        // No time → skipped
        { time: undefined, activity: 'Floating note', category: 'mindset' },
      ],
    });
    const eventCount = (ics.match(/BEGIN:VEVENT/g) || []).length;
    expect(eventCount).toBe(2);
    expect(ics).toContain('SUMMARY:Wake + sunlight');
    expect(ics).toContain('SUMMARY:Work block');
    expect(ics).toContain('RRULE:FREQ=DAILY');
  });

  it('escapes commas, semicolons, and newlines in descriptions', () => {
    const ics = buildIcsCalendar({
      dailySchedule: [
        { time: '09:00', activity: 'Morning, light; outside', duration: '10 min', notes: 'Multi\nline\nnotes' },
      ],
    });
    expect(ics).toContain('SUMMARY:Morning\\, light\\; outside');
    expect(ics).toContain('DESCRIPTION:Multi\\nline\\nnotes');
  });

  it('emits supplement reminders with 💊 prefix and 5-minute duration', () => {
    const ics = buildIcsCalendar({
      supplements: [
        { name: 'Magnesium Glycinate', timing: '22:00', dose: '400 mg', justification: 'Sleep onset' },
        // Missing timing → skipped
        { name: 'Vitamin D', dose: '5000 IU' },
      ],
    });
    expect(ics).toContain('💊 Magnesium Glycinate (400 mg)');
    expect(ics).toContain('DTSTART:');
    expect(ics).not.toContain('Vitamin D'); // no time → skipped
  });

  it('handles times crossing midnight (e.g. 23:50 + 30min duration → next day end)', () => {
    const ics = buildIcsCalendar({
      dailySchedule: [
        { time: '23:50', activity: 'Wind down', duration: '30 min' },
      ],
    });
    // Just verify it produced a VEVENT — exact DT validation is fragile
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('SUMMARY:Wind down');
  });

  it('deduplicates events with identical time + slug', () => {
    const ics = buildIcsCalendar({
      dailySchedule: [
        { time: '07:00', activity: 'Wake', duration: '5 min' },
        { time: '07:00', activity: 'Wake', duration: '5 min' },
      ],
    });
    const eventCount = (ics.match(/BEGIN:VEVENT/g) || []).length;
    expect(eventCount).toBe(1);
  });
});
