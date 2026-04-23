import { describe, test, expect } from 'vitest';
import {
  WORKOUT_PRESETS,
  getWorkoutPreset,
  suggestWorkouts,
  intensityRpe,
} from '@/lib/engine/workouts';

describe('WORKOUT_PRESETS', () => {
  test('every preset has id, title, category, intensity, durationMin', () => {
    for (const w of WORKOUT_PRESETS) {
      expect(w.id).toBeTruthy();
      expect(w.title.length).toBeGreaterThan(2);
      expect(['strength', 'cardio', 'mobility', 'mixed', 'walk']).toContain(w.category);
      expect(['light', 'moderate', 'hard', 'max']).toContain(w.intensity);
      expect(w.durationMin).toBeGreaterThan(0);
    }
  });

  test('preset ids are unique', () => {
    const seen = new Set<string>();
    for (const w of WORKOUT_PRESETS) {
      expect(seen.has(w.id), `duplicate ${w.id}`).toBe(false);
      seen.add(w.id);
    }
  });
});

describe('getWorkoutPreset', () => {
  test('finds known id', () => {
    expect(getWorkoutPreset('walk-30')?.title).toBe('Brisk walk');
  });
  test('returns undefined for unknown id', () => {
    expect(getWorkoutPreset('nonexistent')).toBeUndefined();
  });
});

describe('suggestWorkouts', () => {
  test('always includes walk + mobility', () => {
    const out = suggestWorkouts({});
    expect(out.find(w => w.id === 'walk-30')).toBeTruthy();
    expect(out.find(w => w.id === 'mobility-15')).toBeTruthy();
  });

  test('strength-focused user gets strength presets', () => {
    const gym = suggestWorkouts({ strengthSessionsPerWeek: 4, hasGym: true });
    expect(gym.find(w => w.id === 'push-day')).toBeTruthy();
    expect(gym.find(w => w.id === 'leg-day')).toBeTruthy();
  });

  test('home strength user gets bodyweight + kettlebell', () => {
    const home = suggestWorkouts({ strengthSessionsPerWeek: 3, hasGym: false });
    expect(home.find(w => w.id === 'full-body-home')).toBeTruthy();
    expect(home.find(w => w.id === 'kettlebell-30')).toBeTruthy();
  });

  test('cardio-focused user gets zone2 + hiit', () => {
    const cardio = suggestWorkouts({ cardioMinutesPerWeek: 180 });
    expect(cardio.find(w => w.id === 'zone2-45')).toBeTruthy();
    expect(cardio.find(w => w.id === 'hiit-20')).toBeTruthy();
  });

  test('caps at 6 suggestions', () => {
    const out = suggestWorkouts({ strengthSessionsPerWeek: 5, cardioMinutesPerWeek: 300, hasGym: true });
    expect(out.length).toBeLessThanOrEqual(6);
  });
});

describe('intensityRpe', () => {
  test('returns RPE band per intensity', () => {
    expect(intensityRpe('light')).toMatch(/RPE 3-4/);
    expect(intensityRpe('max')).toMatch(/RPE 9-10/);
  });
});
