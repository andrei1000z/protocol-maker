'use client';

import { useState } from 'react';
import { WatchMetric } from '@/lib/types';
import { getMetricColor, getMetricStatus } from '@/lib/utils';
import clsx from 'clsx';

export function MetricCard({
  metric,
  value,
  onChange,
}: {
  metric: WatchMetric;
  value: number;
  onChange: (value: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const isLowerBetter = metric.id === 'restingHR';
  const color = value > 0 ? getMetricColor(value, metric.target, isLowerBetter) : 'text-muted';
  const status = value > 0 ? getMetricStatus(value, metric.target, isLowerBetter) : '-';

  const handleSave = () => {
    const num = parseFloat(inputValue);
    if (!isNaN(num) && num >= metric.min && num <= metric.max) {
      onChange(num);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="bg-background rounded-xl border border-primary p-3">
        <p className="text-xs text-muted-foreground mb-1">{metric.name}</p>
        <div className="flex gap-2">
          <input
            type="number"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            autoFocus
            min={metric.min}
            max={metric.max}
            step={metric.id === 'sleepDuration' || metric.id === 'skinTemp' ? 0.1 : 1}
            className="flex-1 bg-card rounded-lg px-2 py-1 text-sm outline-none border border-card-border"
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
          <button onClick={handleSave} className="text-xs text-primary font-medium">OK</button>
          <button onClick={() => setEditing(false)} className="text-xs text-muted">X</button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => {
        setInputValue(value > 0 ? String(value) : '');
        setEditing(true);
      }}
      className="bg-background rounded-xl border border-card-border p-3 text-left active:scale-[0.97] transition-transform w-full"
    >
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-muted-foreground">{metric.name}</p>
        <span className={clsx('text-[10px] font-medium', color)}>{status}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className={clsx('text-lg font-bold', color)}>{value > 0 ? value : '-'}</span>
        <span className="text-[10px] text-muted">{metric.unit}</span>
      </div>
      <p className="text-[10px] text-muted mt-0.5">Target: {metric.target}{metric.unit}</p>
    </button>
  );
}
