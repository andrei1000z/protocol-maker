import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 8,
          fontFamily: 'system-ui',
          fontWeight: 900,
          fontSize: 22,
          color: '#0b0d11',
          letterSpacing: -1,
        }}
      >
        P
      </div>
    ),
    size
  );
}
