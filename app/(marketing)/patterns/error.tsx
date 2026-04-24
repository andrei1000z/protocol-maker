'use client';
import { RouteError } from '@/components/layout/RouteError';
export default function PatternsError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <RouteError
      {...props}
      scope="patterns"
      title="Ghidul tiparelor nu s-a încărcat"
      body="Datele detectorului de tipare nu au putut fi încărcate. Reîmprospătează și încearcă din nou."
      backHref="/"
      backLabel="Acasă"
    />
  );
}
