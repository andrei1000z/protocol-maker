import { ImageResponse } from 'next/og';
import { BIOMARKER_DB } from '@/lib/engine/biomarkers';
import { PATTERN_COUNT } from '@/lib/engine/patterns';

const BIOMARKER_COUNT = BIOMARKER_DB.length;

export const alt = 'Protocol — AI Longevity Engine';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#08090d',
          display: 'flex',
          flexDirection: 'column',
          padding: '72px 88px',
          fontFamily: 'system-ui',
          color: '#ecedef',
          position: 'relative',
        }}
      >
        {/* Ambient radial gradients */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse at 80% 10%, rgba(52, 211, 153, 0.25) 0%, transparent 55%), radial-gradient(ellipse at 5% 95%, rgba(96, 165, 250, 0.12) 0%, transparent 50%)',
          }}
        />

        {/* Wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, zIndex: 1 }}>
          <div
            style={{
              width: 52,
              height: 52,
              background: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              fontSize: 32,
              color: '#0b0d11',
              letterSpacing: -2,
            }}
          >
            P
          </div>
          <div style={{ fontSize: 28, fontWeight: 600, color: '#34d399', letterSpacing: -0.5 }}>Protocol</div>
        </div>

        {/* Headline */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginTop: 68,
            zIndex: 1,
          }}
        >
          <div
            style={{
              fontSize: 84,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: -3,
              color: '#ecedef',
            }}
          >
            Your blood work.
          </div>
          <div
            style={{
              fontSize: 84,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: -3,
              marginTop: 6,
              background: 'linear-gradient(90deg, #34d399 0%, #6ee7b7 50%, #34d399 100%)',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            Your longevity protocol.
          </div>
        </div>

        {/* Subline */}
        <div
          style={{
            fontSize: 28,
            color: '#9ca3af',
            marginTop: 36,
            lineHeight: 1.4,
            maxWidth: 880,
            zIndex: 1,
          }}
        >
          {`${BIOMARKER_COUNT} biomarkers analyzed. ${PATTERN_COUNT} health patterns detected. Personalized protocol in 60 seconds — calibrated to YOU, not Bryan Johnson.`}
        </div>

        {/* Metrics strip */}
        <div
          style={{
            display: 'flex',
            gap: 28,
            marginTop: 'auto',
            zIndex: 1,
          }}
        >
          {[
            { n: String(BIOMARKER_COUNT), l: 'biomarkers' },
            { n: String(PATTERN_COUNT), l: 'patterns' },
            { n: '8', l: 'organ systems' },
            { n: '60s', l: 'analysis' },
          ].map((m) => (
            <div
              key={m.l}
              style={{
                display: 'flex',
                flexDirection: 'column',
                padding: '18px 22px',
                background: 'rgba(19, 22, 28, 0.8)',
                border: '1px solid rgba(52, 211, 153, 0.18)',
                borderRadius: 16,
              }}
            >
              <div
                style={{
                  fontSize: 40,
                  fontWeight: 700,
                  color: '#34d399',
                  letterSpacing: -1.5,
                  lineHeight: 1,
                }}
              >
                {m.n}
              </div>
              <div style={{ fontSize: 14, color: '#9ca3af', marginTop: 6, textTransform: 'uppercase', letterSpacing: 1.5 }}>
                {m.l}
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    size
  );
}
