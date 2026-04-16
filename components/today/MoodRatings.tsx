'use client';

import { Card } from '@/components/ui/Card';
import { Slider } from '@/components/ui/Slider';
import { Heart } from 'lucide-react';

export function MoodRatings({
  mood,
  energy,
  focus,
  onMood,
  onEnergy,
  onFocus,
}: {
  mood: number;
  energy: number;
  focus: number;
  onMood: (v: number) => void;
  onEnergy: (v: number) => void;
  onFocus: (v: number) => void;
}) {
  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <Heart className="w-4 h-4 text-pink-400" />
        <h3 className="text-sm font-medium">Stare</h3>
      </div>
      <div className="space-y-4">
        <Slider label="Mood" value={mood} onChange={onMood} />
        <Slider label="Energie" value={energy} onChange={onEnergy} />
        <Slider label="Focus" value={focus} onChange={onFocus} />
      </div>
    </Card>
  );
}
