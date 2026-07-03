'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import { useUI } from '@/components/GlobalUI';
import { createClient } from '@/lib/supabase/client';
import { getAuthCallbackUrl } from '@/lib/supabase/auth-url';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useUI();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const redirect = searchParams.get('redirect') || '/dashboard';
  const urlError = searchParams.get('error');

  useEffect(() => {
    if (urlError) toast(decodeURIComponent(urlError), 'error');
  }, [urlError, toast]);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast('Enter email and password', 'error');
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast(error.message, 'error');
      return;
    }
    toast('Welcome back!', 'success');
    router.push(redirect);
    router.refresh();
  };

  const oauth = async (provider: 'google' | 'github') => {
    const supabase = createClient();
    const callbackUrl = getAuthCallbackUrl(window.location.origin, redirect);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: callbackUrl },
    });
    if (error) toast(error.message, 'error');
  };

  return (
    <div className="container auth-page">
      <div className="auth-card glass">
        <div className="auth-head">
          <span className="logo-mark"><Icon name="hexagon" size={22} /></span>
          <h1>Welcome back</h1>
          <p className="muted">Sign in to your ToolNest account</p>
        </div>
        <form onSubmit={(e) => void login(e)}>
          <div className="field mb-4">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
          </div>
          <div className="field mb-4">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
          </div>
          <button type="submit" className="btn btn-primary w-full" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
        <div className="auth-divider"><span>or continue with</span></div>
        <div className="auth-oauth">
          <button type="button" className="btn btn-ghost" onClick={() => void oauth('google')}>Google</button>
          <button type="button" className="btn btn-ghost" onClick={() => void oauth('github')}>GitHub</button>
        </div>
        <p className="auth-foot muted">No account? <Link href="/signup">Sign up free</Link></p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="container auth-page"><div className="spinner" style={{ margin: '80px auto' }} /></div>}>
      <LoginForm />
    </Suspense>
  );
}
