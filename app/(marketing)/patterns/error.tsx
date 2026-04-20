'use client';
import { RouteError } from '@/components/layout/RouteError';
export default function PatternsError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <RouteError
      {...props}
      scope="patterns"
      title="Couldn't load the pattern reference"
      body="The pattern detector data failed to load. Refresh and try again."
      backHref="/"
      backLabel="Home"
    />
  );
}
