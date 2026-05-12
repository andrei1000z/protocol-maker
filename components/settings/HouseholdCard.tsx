'use client';

// Family-mode roster UI in Settings.
//
// Lists everyone currently in the user's household (owner + members), lets
// the owner invite by email and remove members, lets a member leave on
// their own. Backed by /api/household which uses the admin client for the
// cross-user read but keeps the result scoped to the caller's household.

import { useEffect, useState, useCallback } from 'react';
import { Users, UserPlus, X, Loader2 } from 'lucide-react';

interface Member {
  id: string;
  name: string | null;
  role: 'owner' | 'member' | null;
  isYou: boolean;
  createdAt: string | null;
}

interface HouseholdResponse {
  ownerId: string;
  role: 'owner' | 'member' | 'owner_or_solo' | null;
  members: Member[];
}

export function HouseholdCard() {
  const [data, setData] = useState<HouseholdResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/household');
      if (!res.ok) {
        // 0006 migration may not be applied yet — keep silent rather than spam.
        setData(null);
        return;
      }
      const j = (await res.json()) as HouseholdResponse;
      setData(j);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const invite = async () => {
    if (!email || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/household', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setEmail('');
      setInviteOpen(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'A apărut o eroare');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (memberId: string) => {
    if (!confirm('Sigur vrei să elimini acest membru din gospodărie?')) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/household?memberId=${encodeURIComponent(memberId)}`, { method: 'DELETE' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eliminarea a eșuat');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="glass-card rounded-2xl p-5 animate-fade-in-up">
        <div className="flex items-center gap-3">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Se încarcă gospodăria…</span>
        </div>
      </div>
    );
  }

  // Pre-migration / no household: render the upsell only.
  if (!data) {
    return (
      <div className="glass-card rounded-2xl p-5 space-y-3.5 animate-fade-in-up">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/25 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Mod familie</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Funcția va fi activă după aplicarea migrării 0006_household. Permite invitarea partenerului sau copiilor pe același cont, fiecare cu protocol și tracking propriu.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isOwnerOrSolo = data.role === 'owner' || data.role === 'owner_or_solo';
  const memberCount = data.members.filter(m => m.role === 'member').length;

  return (
    <div className="glass-card rounded-2xl p-5 space-y-3.5 animate-fade-in-up">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/25 flex items-center justify-center shrink-0">
          <Users className="w-5 h-5 text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Gospodărie</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            {memberCount === 0
              ? 'Doar contul tău, momentan. Invită partenerul sau copiii — fiecare cu protocol și date proprii.'
              : `${memberCount + 1} ${memberCount === 0 ? 'cont' : 'conturi'} legate. Fiecare are propriul protocol; tu poți trece între ele.`}
          </p>
        </div>
      </div>

      <ul className="space-y-1.5">
        {data.members
          .sort((a, b) => (a.role === 'owner' ? -1 : 1) - (b.role === 'owner' ? -1 : 1))
          .map((m) => (
            <li key={m.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-surface-2 border border-card-border">
              <span className="flex-1 text-sm truncate">
                {m.name || 'Cont fără nume'}
                {m.isYou && <span className="text-xs text-muted-foreground ml-2">(tu)</span>}
              </span>
              <span className={`text-xs font-mono px-2 py-0.5 rounded-full border ${
                m.role === 'owner' ? 'bg-accent/10 text-accent border-accent/25' : 'bg-surface-3 text-muted border-card-border'
              }`}>
                {m.role === 'owner' ? 'proprietar' : 'membru'}
              </span>
              {(isOwnerOrSolo || m.isYou) && !m.isYou && m.role !== 'owner' && (
                <button
                  onClick={() => remove(m.id)}
                  disabled={busy}
                  className="p-1 rounded-lg text-muted-foreground hover:text-danger transition-colors disabled:opacity-50"
                  aria-label={`Elimină ${m.name || 'membru'}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              {m.isYou && m.role === 'member' && (
                <button
                  onClick={() => remove(m.id)}
                  disabled={busy}
                  className="text-xs text-muted-foreground hover:text-danger transition-colors disabled:opacity-50 px-2 py-1"
                >
                  Ieși
                </button>
              )}
            </li>
          ))}
      </ul>

      {error && <p className="text-xs text-danger">{error}</p>}

      {isOwnerOrSolo && (
        inviteOpen ? (
          <div className="rounded-xl bg-surface-2 border border-card-border p-3 space-y-2">
            <p className="text-xs font-semibold">Invită un cont existent</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Persoana trebuie să aibă deja un cont Protocol. Trimite-i link-ul de referință din Settings ca să-și creeze unul dacă nu există încă.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(null); }}
                placeholder="email@exemplu.com"
                className="flex-1 rounded-xl bg-surface-3 border border-card-border px-3 py-2 text-sm outline-none focus:border-accent"
                disabled={busy}
              />
              <button
                onClick={invite}
                disabled={busy || !email}
                className="px-3 py-2 rounded-xl bg-accent text-black text-xs font-semibold hover:bg-accent-bright disabled:opacity-50 transition-colors"
              >
                {busy ? 'Trimit…' : 'Invită'}
              </button>
              <button
                onClick={() => { setInviteOpen(false); setError(null); setEmail(''); }}
                disabled={busy}
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setInviteOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-accent text-black font-semibold hover:bg-accent-bright transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Invită un membru
          </button>
        )
      )}
    </div>
  );
}
