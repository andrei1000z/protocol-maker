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
        // Never retry on statuses where the server has already told us "no":
        //   401 — not authenticated; the user needs to re-login, retrying
        //         just consumes session churn.
        //   403 — forbidden; retrying won't grant permission.
        //   404 — resource does not exist; pointless to hammer.
        //   429 — rate limited; retrying BURNS more of the same quota AND
        //         delays the reset window. User will see a proper error.
        //   410 — Gone (share links); retry won't un-revoke.
        shouldRetryOnError: (err: unknown) => {
          const status = (err as { status?: number } | null)?.status;
          if (status === 401 || status === 403 || status === 404 || status === 410 || status === 429) return false;
          return true;
        },
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
