'use client';

import { SWRConfig } from 'swr';

// Global SWR configuration — one fetcher, sensible defaults applied everywhere.
// Individual hooks in lib/hooks/useApiData.ts override per-endpoint.
const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: 'same-origin' });
  if (!res.ok) {
    const info = await res.json().catch(() => ({}));
    const err = new Error(info?.error || `HTTP ${res.status}`);
    // Attach status so components can branch on 401 etc.
    (err as Error & { status: number }).status = res.status;
    throw err;
  }
  return res.json();
};

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher,
        shouldRetryOnError: true,
        errorRetryCount: 2,
        errorRetryInterval: 1500,
        revalidateOnFocus: false,       // default off — pages can opt in
        revalidateOnReconnect: true,
        dedupingInterval: 20_000,       // 20s default dedup window
        keepPreviousData: true,
      }}
    >
      {children}
    </SWRConfig>
  );
}
