'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { UserProfile } from '@/lib/types';
import { User, Save } from 'lucide-react';

export function ProfileForm({ profile, onSave }: { profile: UserProfile; onSave: (p: UserProfile) => void }) {
  const [name, setName] = useState(profile.name);
  const [age, setAge] = useState(String(profile.age));
  const [weight, setWeight] = useState(String(profile.weight));
  const [height, setHeight] = useState(String(profile.height));
  const [calories, setCalories] = useState(String(profile.macroTargets.calories));
  const [protein, setProtein] = useState(String(profile.macroTargets.protein));
  const [carbs, setCarbs] = useState(String(profile.macroTargets.carbs));
  const [fat, setFat] = useState(String(profile.macroTargets.fat));
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (saved) {
      const t = setTimeout(() => setSaved(false), 2000);
      return () => clearTimeout(t);
    }
  }, [saved]);

  const handleSave = () => {
    onSave({
      ...profile,
      name,
      age: parseInt(age) || profile.age,
      weight: parseFloat(weight) || profile.weight,
      height: parseFloat(height) || profile.height,
      macroTargets: {
        calories: parseInt(calories) || profile.macroTargets.calories,
        protein: parseInt(protein) || profile.macroTargets.protein,
        carbs: parseInt(carbs) || profile.macroTargets.carbs,
        fat: parseInt(fat) || profile.macroTargets.fat,
      },
    });
    setSaved(true);
  };

  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <User className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-medium">Profil</h3>
      </div>
      <div className="space-y-3">
        <Input label="Nume" value={name} onChange={setName} />
        <div className="grid grid-cols-3 gap-2">
          <Input label="Vârstă" type="number" value={age} onChange={setAge} />
          <Input label="Înălțime" type="number" value={height} onChange={setHeight} />
          <Input label="Greutate" type="number" value={weight} onChange={setWeight} />
        </div>
        <p className="text-xs text-muted-foreground mt-2">Macro Targets</p>
        <div className="grid grid-cols-4 gap-2">
          <Input label="Cal" type="number" value={calories} onChange={setCalories} />
          <Input label="P (g)" type="number" value={protein} onChange={setProtein} />
          <Input label="C (g)" type="number" value={carbs} onChange={setCarbs} />
          <Input label="F (g)" type="number" value={fat} onChange={setFat} />
        </div>
        <Button onClick={handleSave} className="w-full flex items-center justify-center gap-1">
          {saved ? 'Salvat!' : <><Save className="w-4 h-4" /> Salvează</>}
        </Button>
      </div>
    </Card>
  );
}
