'use client';
import { RouteError } from '@/components/layout/RouteError';
export default function MarketingError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <RouteError
      {...props}
      scope="marketing"
      title="Couldn't load the page"
      body="Something on our end hiccuped. Refresh and it should be back."
      backHref="/"
      backLabel="Home"
    />
  );
}
