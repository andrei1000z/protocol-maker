'use client';

import { useState, useEffect, useCallback } from 'react';

interface ComplianceItem {
  type: string;
  name: string;
  completed: boolean;
}

export function useCompliance(date: string) {
  const [items, setItems] = useState<ComplianceItem[]>([]);
  const [protocolId, setProtocolId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [dataRes, compRes] = await Promise.all([
        fetch('/api/my-data').then(r => r.json()),
        fetch(`/api/compliance?date=${date}`).then(r => r.json()),
      ]);

      if (!dataRes.protocol) { setLoading(false); return; }

      setProtocolId(dataRes.protocol.id);
      const protocol = dataRes.protocol.protocol_json;
      const completedSet = new Set(
        (compRes.logs || []).filter((l: { completed: boolean }) => l.completed)
          .map((l: { item_type: string; item_name: string }) => `${l.item_type}::${l.item_name}`)
      );

      const allItems: ComplianceItem[] = [];

      if (protocol.supplements) {
        protocol.supplements.forEach((s: { name: string }) => {
          allItems.push({ type: 'SUPPLEMENT', name: s.name, completed: completedSet.has(`SUPPLEMENT::${s.name}`) });
        });
      }

      if (protocol.exercise?.weeklyPlan) {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const today = dayNames[new Date(date).getDay()];
        protocol.exercise.weeklyPlan
          .filter((d: { day: string }) => d.day.toLowerCase() === today.toLowerCase())
          .forEach((d: { activity: string }) => {
            allItems.push({ type: 'EXERCISE', name: d.activity, completed: completedSet.has(`EXERCISE::${d.activity}`) });
          });
      }

      if (protocol.sleep?.windDownRoutine) {
        protocol.sleep.windDownRoutine.forEach((s: string | { action: string }) => {
          const name = typeof s === 'string' ? s : s.action;
          allItems.push({ type: 'SLEEP', name, completed: completedSet.has(`SLEEP::${name}`) });
        });
      }

      if (protocol.nutrition?.meals) {
        protocol.nutrition.meals.forEach((m: { name: string }) => {
          allItems.push({ type: 'NUTRITION', name: m.name, completed: completedSet.has(`NUTRITION::${m.name}`) });
        });
      }

      setItems(allItems);
      setLoading(false);
    }
    load();
  }, [date]);

  const toggle = useCallback(async (index: number) => {
    const item = items[index];
    const newCompleted = !item.completed;
    setItems(prev => prev.map((it, i) => i === index ? { ...it, completed: newCompleted } : it));
    await fetch('/api/compliance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemType: item.type, itemName: item.name, date, completed: newCompleted, protocolId }),
    });
  }, [items, date, protocolId]);

  const completed = items.filter(i => i.completed).length;
  const total = items.length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return { items, loading, toggle, completed, total, percent };
}
