'use client';

// Brand → model picker for wearable / equipment onboarding.
//
// Three states: 'none' (I don't have one), a brand name (reveals model
// dropdown searchable by name), or 'Other' (free-text input). Each state
// resets the next-level value so partial selections don't leak between
// brands.
//
// Extracted from the onboarding page so it can be reused for any
// brand/model selector and so the page state machine can be split into
// step components without dragging this large helper along.

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import type { DeviceBrand } from '@/lib/engine/device-catalog';

export interface DevicePickerProps {
  label: string;
  icon: string;
  brands: DeviceBrand[];
  brand: string;
  model: string;
  other: string;
  onBrandChange: (v: string) => void;
  onModelChange: (v: string) => void;
  onOtherChange: (v: string) => void;
}

export function DevicePicker({
  label, icon, brands, brand, model, other,
  onBrandChange, onModelChange, onOtherChange,
}: DevicePickerProps) {
  const [search, setSearch] = useState('');
  const currentBrand = brands.find(b => b.name === brand);
  const filteredModels = useMemo(() => {
    if (!currentBrand) return [];
    const q = search.toLowerCase().trim();
    if (!q) return currentBrand.models;
    return currentBrand.models.filter(m => m.name.toLowerCase().includes(q));
  }, [currentBrand, search]);

  return (
    <div className="rounded-2xl bg-card border border-card-border p-3 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-base">{icon}</span>
        <label className="text-xs font-medium">{label}</label>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
        <button
          onClick={() => { onBrandChange('none'); onModelChange(''); onOtherChange(''); }}
          className={clsx('py-2 rounded-xl text-xs font-medium transition-all',
            brand === 'none' ? 'bg-accent text-black' : 'bg-background border border-card-border text-muted-foreground hover:border-accent/40')}
        >
          Nu am
        </button>
        {brands.map(b => (
          <button
            key={b.name}
            onClick={() => { onBrandChange(b.name); onModelChange(''); onOtherChange(''); setSearch(''); }}
            className={clsx('py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap',
              brand === b.name ? 'bg-accent text-black' : 'bg-background border border-card-border text-muted-foreground hover:border-accent/40')}
          >
            {b.name}
          </button>
        ))}
        <button
          onClick={() => { onBrandChange('Other'); onModelChange(''); }}
          className={clsx('py-2 rounded-xl text-xs font-medium transition-all',
            brand === 'Other' ? 'bg-accent text-black' : 'bg-background border border-card-border text-muted-foreground hover:border-accent/40')}
        >
          Alta
        </button>
      </div>

      {currentBrand && (
        <div className="space-y-2">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Caută modele ${currentBrand.name}…`}
            className="w-full rounded-xl bg-background border border-card-border px-3 py-2 text-xs outline-none focus:border-accent"
          />
          <div className="max-h-40 overflow-y-auto space-y-1 scrollbar-thin">
            {filteredModels.length === 0 ? (
              <p className="text-xs text-muted-foreground px-2 py-1.5">Niciun rezultat — alege „Alta" și scrie modelul.</p>
            ) : filteredModels.map(m => (
              <button
                key={m.name}
                onClick={() => onModelChange(m.name)}
                className={clsx('w-full text-left px-3 py-2 rounded-lg text-xs transition-colors',
                  model === m.name ? 'bg-accent/15 text-accent border border-accent/30' : 'bg-background border border-card-border text-foreground/80 hover:border-accent/30')}
              >
                {m.name}
                {model === m.name && <span className="ml-2 text-xs text-accent">✓ selectat</span>}
              </button>
            ))}
          </div>
          {model && (
            <p className="text-xs text-accent">
              ✓ {currentBrand.name} {model} — AI va folosi capabilitățile lui în setup-ul tău de tracking.
            </p>
          )}
        </div>
      )}

      {brand === 'Other' && (
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Spune-ne marca + modelul:</label>
          <input
            type="text"
            value={other}
            onChange={e => onOtherChange(e.target.value)}
            placeholder="ex. Coros Pace 3 · Suunto Ocean · ceas custom"
            className="w-full rounded-xl bg-background border border-card-border px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <p className="text-xs text-muted-foreground">AI-ul va deduce ce măsoară din numele modelului.</p>
        </div>
      )}
    </div>
  );
}
