'use client';
import { RouteError } from '@/components/layout/RouteError';
export default function BiomarkersError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <RouteError
      {...props}
      scope="biomarkers"
      title="Ghidul biomarkerilor nu s-a încărcat"
      body="Datele engine-ului nu au putut fi încărcate. Reîmprospătează și încearcă din nou."
      backHref="/"
      backLabel="Acasă"
    />
  );
}
