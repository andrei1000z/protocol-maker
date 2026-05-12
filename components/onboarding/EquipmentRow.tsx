'use client';

// Tri-state Yes / No / Will buy row for home equipment items (filter,
// scale, sleep mask, etc.). When status='yes' shows an optional notes
// field; when status='will_buy' shows an eMAG search deeplink.
//
// Extracted from the onboarding page so the step component that owns
// equipment selection can render this without lugging the 60-line
// implementation around.

import clsx from 'clsx';
import type { HOME_EQUIPMENT } from '@/lib/engine/device-catalog';

export interface EquipmentRowProps {
  item: (typeof HOME_EQUIPMENT)[number];
  status: 'yes' | 'no' | 'will_buy' | undefined;
  note: string;
  onStatus: (s: 'yes' | 'no' | 'will_buy') => void;
  onNote: (s: string) => void;
}

export function EquipmentRow({ item, status, note, onStatus, onNote }: EquipmentRowProps) {
  return (
    <div className="p-3 rounded-xl bg-card border border-card-border space-y-2.5">
      <div className="flex items-start gap-3">
        <span className="text-lg shrink-0 mt-0.5">{item.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{item.label}</p>
          <p className="text-xs text-muted-foreground leading-snug mt-0.5">{item.whyItMatters}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {([
          { v: 'yes',       l: 'Am' },
          { v: 'no',        l: 'Nu am' },
          { v: 'will_buy',  l: 'Voi cumpăra' },
        ] as const).map(opt => (
          <button
            key={opt.v}
            onClick={() => onStatus(opt.v)}
            className={clsx('py-1.5 rounded-lg text-xs font-medium transition-all',
              status === opt.v
                ? opt.v === 'yes' ? 'bg-accent text-black'
                  : opt.v === 'will_buy' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  : 'bg-surface-3 text-foreground border border-card-border'
                : 'bg-background border border-card-border text-muted-foreground hover:border-accent/30')}
          >
            {opt.l}
          </button>
        ))}
      </div>
      {status === 'yes' && (
        <input
          type="text"
          value={note}
          onChange={e => onNote(e.target.value)}
          placeholder={'Opțional: marcă, model, câte (ex. „Dyson Pure Cool — 2 buc, dormitor + living")'}
          className="w-full rounded-lg bg-background border border-card-border px-3 py-1.5 text-xs outline-none focus:border-accent"
        />
      )}
      {status === 'will_buy' && item.buyQuery && (
        <a
          href={`https://www.emag.ro/search/${encodeURIComponent(item.buyQuery)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-xs text-accent hover:underline"
        >
          🛒 Caută pe eMAG {item.priceHintRon ? `(~${item.priceHintRon} RON)` : ''} ↗
        </a>
      )}
    </div>
  );
}
