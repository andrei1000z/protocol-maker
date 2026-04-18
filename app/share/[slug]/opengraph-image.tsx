import { ImageResponse } from 'next/og';

export const alt = 'Shared longevity protocol';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

interface SharedProtocol {
  longevity_score?: number | null;
  biological_age?: number | null;
  protocol_json?: { diagnostic?: { biologicalAge?: number; chronologicalAge?: number; agingVelocityNumber?: number; bryanSummary?: { bioAgePctDifference?: number } } };
}

async function fetchShared(slug: string): Promise<SharedProtocol | null> {
  const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://protocol-tawny.vercel.app';
  try {
    const res = await fetch(`${base}/api/share?slug=${slug}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

export default async function ShareOG({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await fetchShared(slug);

  // Resolve display values
  const score = data?.longevity_score ?? null;
  const bioAge = (data?.protocol_json?.diagnostic?.biologicalAge as number | undefined) ?? data?.biological_age ?? null;
  const chronoAge = data?.protocol_json?.diagnostic?.chronologicalAge ?? null;
  const pace = data?.protocol_json?.diagnostic?.agingVelocityNumber ?? null;
  const bioPct = data?.protocol_json?.diagnostic?.bryanSummary?.bioAgePctDifference ?? null;

  // Compute the bio-age display
  const bioYears = bioAge ? Math.floor(bioAge) : null;
  const bioMonths = bioAge ? Math.round((bioAge - Math.floor(bioAge)) * 12) : null;
  const bioLabel = bioYears !== null ? `${bioYears}y ${bioMonths}m` : '—';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#08090d',
          display: 'flex',
          flexDirection: 'column',
          padding: '64px 72px',
          fontFamily: 'system-ui',
          color: '#ecedef',
          position: 'relative',
        }}
      >
        {/* Ambient glow */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse at 80% 10%, rgba(52, 211, 153, 0.22) 0%, transparent 55%), radial-gradient(ellipse at 5% 95%, rgba(96, 165, 250, 0.10) 0%, transparent 50%)',
          }}
        />

        {/* Wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, zIndex: 1 }}>
          <div
            style={{
              width: 48, height: 48, borderRadius: 12,
              background: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 900, fontSize: 28, color: '#0b0d11',
            }}
          >P</div>
          <div style={{ fontSize: 26, fontWeight: 600, color: '#34d399' }}>Protocol</div>
          <div style={{ marginLeft: 'auto', fontSize: 14, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 2 }}>SHARED PROTOCOL</div>
        </div>

        {/* Headline */}
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 48, zIndex: 1 }}>
          <div style={{ fontSize: 52, fontWeight: 700, lineHeight: 1.1, letterSpacing: -1.5 }}>
            Longevity score
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 28, marginTop: 8 }}>
            <div style={{ fontSize: 168, fontWeight: 800, lineHeight: 1, letterSpacing: -8, color: '#34d399' }}>{score ?? '—'}</div>
            <div style={{ fontSize: 56, color: '#71717a', fontWeight: 500 }}>/ 100</div>
          </div>
        </div>

        {/* Bottom metric strip */}
        <div style={{ display: 'flex', gap: 18, marginTop: 'auto', zIndex: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column', padding: '20px 26px', background: 'rgba(19, 22, 28, 0.85)', border: '1px solid rgba(52, 211, 153, 0.18)', borderRadius: 18, flex: 1 }}>
            <div style={{ fontSize: 13, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1.5 }}>Bio age</div>
            <div style={{ fontSize: 42, fontWeight: 700, color: '#34d399', marginTop: 4 }}>{bioLabel}</div>
            {chronoAge && (
              <div style={{ fontSize: 14, color: '#9ca3af', marginTop: 2 }}>{`vs ${chronoAge}y chronological`}</div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', padding: '20px 26px', background: 'rgba(19, 22, 28, 0.85)', border: '1px solid rgba(52, 211, 153, 0.18)', borderRadius: 18, flex: 1 }}>
            <div style={{ fontSize: 13, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1.5 }}>Aging speed</div>
            <div style={{ fontSize: 42, fontWeight: 700, color: pace && pace < 0.95 ? '#34d399' : pace && pace > 1.05 ? '#f87171' : '#ecedef', marginTop: 4 }}>{pace ? `${pace.toFixed(2)}×` : '—'}</div>
            <div style={{ fontSize: 14, color: '#9ca3af', marginTop: 2 }}>vs Bryan&apos;s 0.64×</div>
          </div>
          {bioPct !== null && (
            <div style={{ display: 'flex', flexDirection: 'column', padding: '20px 26px', background: 'rgba(19, 22, 28, 0.85)', border: '1px solid rgba(52, 211, 153, 0.18)', borderRadius: 18, flex: 1 }}>
              <div style={{ fontSize: 13, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1.5 }}>vs chronological</div>
              <div style={{ fontSize: 42, fontWeight: 700, color: bioPct > 0 ? '#34d399' : '#f87171', marginTop: 4 }}>{bioPct > 0 ? '−' : '+'}{Math.abs(bioPct)}%</div>
              <div style={{ fontSize: 14, color: '#9ca3af', marginTop: 2 }}>{bioPct > 0 ? 'younger' : 'older'}</div>
            </div>
          )}
        </div>
      </div>
    ),
    size
  );
}
