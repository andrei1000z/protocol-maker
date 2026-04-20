'use client';
import { RouteError } from '@/components/layout/RouteError';
export default function ShareError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <RouteError
      {...props}
      scope="share"
      title="Couldn't load this shared protocol"
      body="The link may have expired, been revoked, or the protocol was deleted by its owner."
      backHref="/"
      backLabel="Home"
    />
  );
}
