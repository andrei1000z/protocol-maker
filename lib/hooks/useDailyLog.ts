'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { DailyLog, Meal, UserProfile } from '../types';
import { getTodayKey, generateId } from '../utils';

export function useDailyLog(date?: string) {
  const [log, setLog] = useState<DailyLog | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const targetDate = date || getTodayKey();
  const saveTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/my-data?date=${targetDate}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setLog(data.log || { date: targetDate, tasks: [], supplements: [], meals: [], water: 0, mood: 0, energy: 0, focus: 0, notes: '', watchMetrics: {} });
        setProfile(data.profile);
        setHydrated(true);
      })
      .catch(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => { cancelled = true; };
  }, [targetDate]);

  const debouncedSave = useCallback((updatedLog: DailyLog) => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      fetch('/api/save-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedLog),
      });
    }, 500);
  }, []);

  const updateLog = useCallback(
    (updater: (prev: DailyLog) => DailyLog) => {
      setLog((prev) => {
        if (!prev) return prev;
        const updated = updater(prev);
        debouncedSave(updated);
        return updated;
      });
    },
    [debouncedSave]
  );

  const toggleTask = useCallback((taskId: string) => {
    updateLog((prev) => ({ ...prev, tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t)) }));
  }, [updateLog]);

  const toggleSupplement = useCallback((supId: string) => {
    updateLog((prev) => ({ ...prev, supplements: prev.supplements.map((s) => (s.id === supId ? { ...s, taken: !s.taken } : s)) }));
  }, [updateLog]);

  const addMeal = useCallback((meal: Omit<Meal, 'id'>) => {
    updateLog((prev) => ({ ...prev, meals: [...prev.meals, { ...meal, id: generateId() }] }));
  }, [updateLog]);

  const removeMeal = useCallback((mealId: string) => {
    updateLog((prev) => ({ ...prev, meals: prev.meals.filter((m) => m.id !== mealId) }));
  }, [updateLog]);

  const setWater = useCallback((count: number) => { updateLog((prev) => ({ ...prev, water: count })); }, [updateLog]);
  const setMood = useCallback((mood: number) => { updateLog((prev) => ({ ...prev, mood })); }, [updateLog]);
  const setEnergy = useCallback((energy: number) => { updateLog((prev) => ({ ...prev, energy })); }, [updateLog]);
  const setFocus = useCallback((focus: number) => { updateLog((prev) => ({ ...prev, focus })); }, [updateLog]);
  const setNotes = useCallback((notes: string) => { updateLog((prev) => ({ ...prev, notes })); }, [updateLog]);
  const setWatchMetric = useCallback((metricId: string, value: number) => {
    updateLog((prev) => ({ ...prev, watchMetrics: { ...prev.watchMetrics, [metricId]: value } }));
  }, [updateLog]);
  const setWeight = useCallback((weight: number) => { updateLog((prev) => ({ ...prev, weight })); }, [updateLog]);

  return { log, profile, hydrated, toggleTask, toggleSupplement, addMeal, removeMeal, setWater, setMood, setEnergy, setFocus, setNotes, setWatchMetric, setWeight, updateLog };
}
