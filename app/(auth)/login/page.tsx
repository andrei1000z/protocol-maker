'use client';

import { useState, useMemo, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BIOMARKER_DB } from '@/lib/engine/biomarkers';
import { PATTERN_COUNT } from '@/lib/engine/patterns';

const BIOMARKER_COUNT = BIOMARKER_DB.length;

type Mode = 'login' | 'register' | 'forgot';

// Password strength check — at least 8 chars + a letter + a digit
function passwordIssues(pw: string): string | null {
  if (pw.length < 8) return 'At least 8 characters';
  if (!/[a-zA-Z]/.test(pw)) return 'Needs at least one letter';
  if (!/\d/.test(pw)) return 'Needs at least one digit';
  return null;
}

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
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
      if (mode === 'forgot') {
        const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/api/auth/callback?next=/settings`,
        });
        if (err) setError(err.message);
        else setMessage('Check your email for a reset link.');
      } else if (mode === 'register') {
        const pwIssue = passwordIssues(password);
        if (pwIssue) { setError(pwIssue); setLoading(false); return; }
        if (!acceptedTerms) { setError('Please accept the Terms + Privacy to continue'); setLoading(false); return; }
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/api/auth/callback` },
        });
        if (err) setError(err.message);
        else setMessage('Check your email for confirmation.');
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) setError(err.message);
        else router.replace('/dashboard');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    }
    setLoading(false);
  };

  const handleGoogleOAuth = async () => {
    setOauthLoading(true);
    setError('');
    // On success, signInWithOAuth issues a redirect and this tab is replaced
    // before the promise resolves — so the finally would never run. On a
    // network hang, the promise also never resolves. Guard against both by
    // auto-clearing the loading state after 10s so the button is usable again.
    const timeoutId = window.setTimeout(() => {
      setOauthLoading(false);
      setError('Google took too long to respond. Try again or use email + password.');
    }, 10000);
    try {
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/api/auth/callback` },
      });
      if (err) {
        window.clearTimeout(timeoutId);
        setError(err.message);
        setOauthLoading(false);
      }
      // Success path: the redirect is imminent. Leave the timeout armed as a
      // safety net in case the browser blocks the navigation (e.g. popup
      // blocker in some embedded-webview contexts).
    } catch (e) {
      window.clearTimeout(timeoutId);
      setError(e instanceof Error ? e.message : 'OAuth failed');
      setOauthLoading(false);
    }
  };

  const submitDisabled =
    loading || oauthLoading
    || (mode === 'forgot' ? !email
        : mode === 'register' ? (!email || !!passwordIssues(password) || !acceptedTerms)
        : (!email || password.length < 1));

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm space-y-8">
        {/* Branding */}
        <div className="text-center space-y-3">
          <Link href="/" className="inline-block">
            {/* Brand mark — landing page already owns the canonical H1 for SEO,
                so login uses a styled <p> to avoid two H1s in a two-page SPA flow. */}
            <p className="text-4xl font-bold tracking-tight">
              <span className="text-accent">Protocol</span>
            </p>
          </Link>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            AI-powered longevity protocols calibrated to <span className="text-foreground">your</span> biomarkers.
          </p>
          <div className="flex items-center justify-center gap-3 text-xs text-muted">
            <span>🔬 {BIOMARKER_COUNT} biomarkers</span>
            <span>•</span>
            <span>🧬 {PATTERN_COUNT} patterns</span>
            <span>•</span>
            <span>⚡ 60 seconds</span>
          </div>
        </div>

        {/* Auth card */}
        <div className="rounded-2xl bg-card border border-card-border p-6 space-y-4">
          {mode !== 'forgot' && (
            <div className="flex rounded-xl bg-background p-1 border border-card-border">
              {(['login', 'register'] as const).map((m) => (
                <button key={m} onClick={() => { setMode(m); setError(''); setMessage(''); }}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${mode === m ? 'bg-accent text-black' : 'text-muted-foreground'}`}>
                  {m === 'login' ? 'Sign In' : 'Sign Up'}
                </button>
              ))}
            </div>
          )}
          {mode === 'forgot' && (
            <div className="text-center pb-1">
              <h2 className="text-base font-semibold tracking-tight">Reset password</h2>
              <p className="text-xs text-muted-foreground mt-1">We&apos;ll email you a magic link to set a new one.</p>
            </div>
          )}

          {/* Google OAuth — top of card for visibility */}
          {mode !== 'forgot' && (
            <>
              <button
                onClick={handleGoogleOAuth}
                disabled={oauthLoading || loading}
                className="w-full py-2.5 rounded-xl bg-background border border-card-border hover:border-accent/40 text-sm font-medium flex items-center justify-center gap-2.5 transition-all disabled:opacity-50"
              >
                {oauthLoading ? (
                  <span className="w-3.5 h-3.5 border-2 border-accent/40 border-t-accent rounded-full animate-spin" />
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                )}
                Continue with Google
              </button>
              <div className="flex items-center gap-3 text-xs text-muted">
                <div className="flex-1 h-px bg-card-border" />
                <span>or with email</span>
                <div className="flex-1 h-px bg-card-border" />
              </div>
            </>
          )}

          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
                className="w-full rounded-xl bg-background border border-card-border px-4 py-2.5 text-sm outline-none focus:border-accent transition-colors" />
            </div>
            {mode !== 'forgot' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-muted-foreground">Password</label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => { setMode('forgot'); setError(''); setMessage(''); setPassword(''); }}
                      className="text-[11px] text-accent hover:underline"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'min 8 chars, letter + digit' : '••••••••'}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  className="w-full rounded-xl bg-background border border-card-border px-4 py-2.5 text-sm outline-none focus:border-accent transition-colors font-mono"
                />
                {mode === 'register' && password.length > 0 && (
                  <p className={`text-xs mt-1 ${passwordIssues(password) ? 'text-amber-400' : 'text-accent'}`}>
                    {passwordIssues(password) || '✓ Strong enough'}
                  </p>
                )}
              </div>
            )}

            {mode === 'register' && (
              <label className="flex items-start gap-2.5 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-card-border accent-accent shrink-0"
                />
                <span className="text-[11px] text-muted-foreground leading-snug">
                  I agree to the <Link href="/terms" target="_blank" className="text-accent hover:underline">Terms</Link>
                  {' '}and <Link href="/privacy" target="_blank" className="text-accent hover:underline">Privacy Policy</Link>.
                  This is not medical advice — always consult a doctor.
                </span>
              </label>
            )}
          </div>

          {error && <p className="text-xs text-danger p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">{error}</p>}
          {message && <p className="text-xs text-accent p-2.5 rounded-lg bg-accent/10 border border-accent/20">{message}</p>}

          <button onClick={handleSubmit} disabled={submitDisabled}
            className="w-full py-3 rounded-xl bg-accent text-black font-semibold text-sm transition-all hover:bg-accent-bright active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed">
            {loading ? 'Working…' : mode === 'login' ? 'Sign In' : mode === 'register' ? 'Create Account' : 'Send reset link'}
          </button>

          {mode === 'forgot' && (
            <button
              type="button"
              onClick={() => { setMode('login'); setError(''); setMessage(''); }}
              className="w-full text-xs text-muted-foreground hover:text-accent"
            >
              ← Back to sign in
            </button>
          )}
        </div>

        <p className="text-xs text-center text-muted">
          <Link href="/" className="text-accent hover:underline">Back to home</Link>
        </p>
      </div>
    </div>
  );
}
