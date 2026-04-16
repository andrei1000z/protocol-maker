'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Meal } from '@/lib/types';
import { Plus } from 'lucide-react';

export function ManualMealForm({ onAdd }: { onAdd: (meal: Omit<Meal, 'id'>) => void }) {
  const [name, setName] = useState('');
  const [cal, setCal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');

  const handleSubmit = () => {
    if (!name.trim() || !cal) return;
    onAdd({
      name: name.trim(),
      cal: parseInt(cal) || 0,
      protein: parseInt(protein) || 0,
      carbs: parseInt(carbs) || 0,
      fat: parseInt(fat) || 0,
    });
    setName('');
    setCal('');
    setProtein('');
    setCarbs('');
    setFat('');
  };

  return (
    <Card>
      <h3 className="text-sm font-medium mb-3">Adaugă manual</h3>
      <div className="space-y-2">
        <Input label="Nume" value={name} onChange={setName} placeholder="ex: Salată Caesar" />
        <div className="grid grid-cols-4 gap-2">
          <Input label="Cal" type="number" value={cal} onChange={setCal} placeholder="0" />
          <Input label="P (g)" type="number" value={protein} onChange={setProtein} placeholder="0" />
          <Input label="C (g)" type="number" value={carbs} onChange={setCarbs} placeholder="0" />
          <Input label="F (g)" type="number" value={fat} onChange={setFat} placeholder="0" />
        </div>
        <Button onClick={handleSubmit} disabled={!name.trim() || !cal} className="w-full flex items-center justify-center gap-1">
          <Plus className="w-4 h-4" /> Adaugă
        </Button>
      </div>
    </Card>
  );
}
