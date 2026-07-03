'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Icon from '@/components/Icon';
import { useUI } from '@/components/GlobalUI';
import { createClient } from '@/lib/supabase/client';
import { getAuthCallbackUrl } from '@/lib/supabase/auth-url';

export default function SignupPage() {
  const router = useRouter();
  const { toast } = useUI();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const signup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || password.length < 6) {
      toast('Fill all fields — password must be 6+ characters', 'error');
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name.trim() } },
    });
    setBusy(false);
    if (error) {
      toast(error.message, 'error');
      return;
    }
    if (data.user && !data.session) {
      toast('Check your email to confirm your account', 'success');
      return;
    }
    toast('Account created! Welcome to ToolNest 🎉', 'success');
    router.push('/dashboard');
    router.refresh();
  };

  const oauth = async (provider: 'google' | 'github') => {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: getAuthCallbackUrl(window.location.origin, '/dashboard') },
    });
    if (error) toast(error.message, 'error');
  };

  return (
    <div className="container auth-page">
      <div className="auth-card glass">
        <div className="auth-head">
          <span className="logo-mark"><Icon name="hexagon" size={22} /></span>
          <h1>Create your account</h1>
          <p className="muted">Free forever · 130+ tools · No credit card</p>
        </div>
        <form onSubmit={(e) => void signup(e)}>
          <div className="field mb-4">
            <label htmlFor="name">Full name</label>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Faruk Mondal" autoComplete="name" />
          </div>
          <div className="field mb-4">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
          </div>
          <div className="field mb-4">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 6 characters" autoComplete="new-password" />
          </div>
          <button type="submit" className="btn btn-primary w-full" disabled={busy}>
            {busy ? 'Creating account…' : 'Create Account'}
          </button>
        </form>
        <div className="auth-divider"><span>or continue with</span></div>
        <div className="auth-oauth">
          <button type="button" className="btn btn-ghost" onClick={() => void oauth('google')}>Google</button>
          <button type="button" className="btn btn-ghost" onClick={() => void oauth('github')}>GitHub</button>
        </div>
        <p className="auth-foot muted">By signing up you agree to our <Link href="/terms-of-service">Terms</Link> and <Link href="/privacy-policy">Privacy Policy</Link>.</p>
        <p className="auth-foot muted">Already have an account? <Link href="/login">Sign in</Link></p>
      </div>
    </div>
  );
}
