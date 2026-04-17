import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #34d399 0%, #10b981 60%, #059669 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui',
          color: '#0b0d11',
          borderRadius: 40,
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 40,
            background: 'radial-gradient(ellipse at top left, rgba(255,255,255,0.2) 0%, transparent 60%)',
          }}
        />
        <div
          style={{
            fontSize: 120,
            fontWeight: 900,
            letterSpacing: -6,
            lineHeight: 1,
            zIndex: 1,
          }}
        >
          P
        </div>
      </div>
    ),
    size
  );
}
