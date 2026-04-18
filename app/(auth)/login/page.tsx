'use client';

import { useState, useMemo, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  // Prefetch dashboard + onboarding so navigation after sign-in is instant
  useEffect(() => {
    router.prefetch('/dashboard');
    router.prefetch('/onboarding');
  }, [router]);

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      if (mode === 'register') {
        const { error: err } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } });
        if (err) setError(err.message);
        else setMessage('Check your email for confirmation.');
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) setError(err.message);
        else router.replace('/dashboard');
      }
    } catch { setError('Connection error.'); }
    setLoading(false);
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-8">
        {/* Branding */}
        <div className="text-center space-y-3">
          <Link href="/" className="inline-block">
            <h1 className="text-4xl font-bold tracking-tight">
              <span className="text-accent">Protocol</span>
            </h1>
          </Link>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            AI-powered longevity protocols calibrated to <span className="text-foreground">your</span> biomarkers.
          </p>
          <div className="flex items-center justify-center gap-4 text-[10px] text-muted">
            <span>🔬 37 biomarkers</span>
            <span>•</span>
            <span>🧬 12 patterns</span>
            <span>•</span>
            <span>⚡ 60 seconds</span>
          </div>
        </div>

        {/* Auth card */}
        <div className="rounded-2xl bg-card border border-card-border p-6 space-y-5">
          <div className="flex rounded-xl bg-background p-1 border border-card-border">
            {(['login', 'register'] as const).map((m) => (
              <button key={m} onClick={() => { setMode(m); setError(''); setMessage(''); }}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${mode === m ? 'bg-accent text-black' : 'text-muted-foreground'}`}>
                {m === 'login' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
                className="w-full rounded-xl bg-background border border-card-border px-4 py-2.5 text-sm outline-none focus:border-accent transition-colors" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="min. 6 characters"
                className="w-full rounded-xl bg-background border border-card-border px-4 py-2.5 text-sm outline-none focus:border-accent transition-colors" />
            </div>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}
          {message && <p className="text-sm text-accent">{message}</p>}

          <button onClick={handleSubmit} disabled={loading || !email || password.length < 6}
            className="w-full py-3 rounded-xl bg-accent text-black font-semibold text-sm transition-all hover:bg-accent-dim active:scale-[0.98] disabled:opacity-40">
            {loading ? 'Processing...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </div>

        <p className="text-[10px] text-center text-muted">
          By continuing you agree this is not medical advice.{' '}
          <Link href="/" className="text-accent hover:underline">Back to home</Link>
        </p>
      </div>
    </div>
  );
}
