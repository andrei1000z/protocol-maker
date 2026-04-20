'use client';
import { RouteError } from '@/components/layout/RouteError';
export default function LoginError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <RouteError
      {...props}
      scope="login"
      title="Login page crashed"
      body="This is on us. Try once more — your account is fine."
      backHref="/"
      backLabel="Home"
    />
  );
}
