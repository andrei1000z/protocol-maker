import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Diff two protocols (current vs previous) for the v1 → v2 banner on /history.
 * Compares: longevity score, bio age, aging pace, supplement stack changes
 * (added / removed / kept), days between protocols.
 *
 * Default behavior (no params): diff the latest protocol vs the one before it.
 * Override with ?current=ID&previous=ID for arbitrary comparisons.
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const currentId = searchParams.get('current');
    const previousId = searchParams.get('previous');

    let curr, prev;
    if (currentId && previousId) {
      const { data } = await supabase
        .from('protocols')
        .select('id, created_at, protocol_json, longevity_score, biological_age_decimal, aging_pace')
        .in('id', [currentId, previousId])
        .eq('user_id', user.id)
        .is('deleted_at', null);
      if (!data || data.length !== 2) return NextResponse.json({ diff: null }, { status: 200 });
      curr = data.find(d => d.id === currentId);
      prev = data.find(d => d.id === previousId);
    } else {
      const { data } = await supabase
        .from('protocols')
        .select('id, created_at, protocol_json, longevity_score, biological_age_decimal, aging_pace')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(2);
      if (!data || data.length < 2) return NextResponse.json({ diff: null }, { status: 200 });
      [curr, prev] = data;
    }

    if (!curr || !prev) return NextResponse.json({ diff: null });

    const currJson = curr.protocol_json as Record<string, unknown>;
    const prevJson = prev.protocol_json as Record<string, unknown>;

    type SupShape = { name: string; dose?: string; priority?: string };
    const currSupps = ((currJson?.supplements as SupShape[] | undefined) || []).map(s => s.name);
    const prevSupps = ((prevJson?.supplements as SupShape[] | undefined) || []).map(s => s.name);

    const added = currSupps.filter(s => !prevSupps.includes(s));
    const removed = prevSupps.filter(s => !currSupps.includes(s));
    const kept = currSupps.filter(s => prevSupps.includes(s));

    const daysBetween = Math.max(1, Math.floor((new Date(curr.created_at).getTime() - new Date(prev.created_at).getTime()) / 864e5));

    return NextResponse.json({
      diff: {
        currentId: curr.id,
        previousId: prev.id,
        currentDate: curr.created_at,
        previousDate: prev.created_at,
        daysBetween,
        score: { prev: prev.longevity_score, curr: curr.longevity_score, delta: (curr.longevity_score ?? 0) - (prev.longevity_score ?? 0) },
        bioAge: { prev: prev.biological_age_decimal, curr: curr.biological_age_decimal, delta: +((curr.biological_age_decimal ?? 0) - (prev.biological_age_decimal ?? 0)).toFixed(2) },
        agingPace: { prev: prev.aging_pace, curr: curr.aging_pace, delta: +((curr.aging_pace ?? 0) - (prev.aging_pace ?? 0)).toFixed(2) },
        supplements: { added, removed, kept, addedCount: added.length, removedCount: removed.length, keptCount: kept.length },
        totalChanges: added.length + removed.length,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
