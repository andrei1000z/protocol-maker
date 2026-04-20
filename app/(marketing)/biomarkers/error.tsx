'use client';
import { RouteError } from '@/components/layout/RouteError';
export default function BiomarkersError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <RouteError
      {...props}
      scope="biomarkers"
      title="Couldn't load the biomarker reference"
      body="The engine data failed to load. Refresh and try again."
      backHref="/"
      backLabel="Home"
    />
  );
}
