import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { BIOMARKER_DB } from '@/lib/engine/biomarkers';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id1 = searchParams.get('id1');
    const id2 = searchParams.get('id2');

    if (!id1 || !id2) return NextResponse.json({ error: 'Need id1 and id2' }, { status: 400 });

    const [res1, res2] = await Promise.all([
      supabase.from('blood_tests').select('*').eq('id', id1).eq('user_id', user.id).single(),
      supabase.from('blood_tests').select('*').eq('id', id2).eq('user_id', user.id).single(),
    ]);

    if (!res1.data || !res2.data) return NextResponse.json({ error: 'Blood test not found' }, { status: 404 });

    const markers1 = new Map((res1.data.biomarkers as { code: string; value: number }[]).map(b => [b.code, b.value]));
    const markers2 = new Map((res2.data.biomarkers as { code: string; value: number }[]).map(b => [b.code, b.value]));
    const allCodes = [...new Set([...markers1.keys(), ...markers2.keys()])];

    const lowerBetter = new Set(['LDL', 'TRIG', 'HSCRP', 'HOMOCYS', 'HBA1C', 'GLUC', 'INSULIN', 'ALT', 'AST', 'GGT', 'CREAT', 'URIC_ACID', 'WBC', 'CORTISOL']);

    const comparison = allCodes.map(code => {
      const ref = BIOMARKER_DB.find(r => r.code === code);
      const v1 = markers1.get(code);
      const v2 = markers2.get(code);
      const delta = v1 !== undefined && v2 !== undefined ? v2 - v1 : null;
      const improved = delta !== null ? (lowerBetter.has(code) ? delta < 0 : delta > 0) : null;

      return {
        code,
        name: ref?.shortName || code,
        unit: ref?.unit || '',
        value1: v1,
        value2: v2,
        delta,
        improved,
        optimalLow: ref?.longevityOptimalLow,
        optimalHigh: ref?.longevityOptimalHigh,
      };
    });

    return NextResponse.json({
      test1: { date: res1.data.taken_at, markerCount: res1.data.biomarkers.length },
      test2: { date: res2.data.taken_at, markerCount: res2.data.biomarkers.length },
      comparison,
      summary: {
        improved: comparison.filter(c => c.improved === true).length,
        worsened: comparison.filter(c => c.improved === false).length,
        stable: comparison.filter(c => c.delta === 0).length,
        total: comparison.length,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
