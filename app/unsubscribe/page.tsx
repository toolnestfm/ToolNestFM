'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import PageShell from '@/components/content/PageShell';
import { useUI } from '@/components/GlobalUI';

function UnsubscribeContent() {
  const { toast } = useUI();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const unsubscribe = async () => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      toast('Please enter a valid email address', 'error');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/newsletter/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const json = (await res.json()) as { success: boolean; error?: string | null };
      if (!json.success) throw new Error(json.error || 'Could not unsubscribe');
      setDone(true);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not unsubscribe', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <p>✅ You&apos;ve been unsubscribed. Sorry to see you go — you can re-subscribe anytime from the homepage.</p>
    );
  }

  return (
    <>
      <p>Enter your email address to stop receiving the ToolNest newsletter.</p>
      <div className="field mb-4 mt-6">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </div>
      <button className="btn btn-primary" onClick={() => void unsubscribe()} disabled={busy}>
        {busy ? 'Unsubscribing…' : 'Unsubscribe'}
      </button>
    </>
  );
}

export default function UnsubscribePage() {
  return (
    <PageShell title="Unsubscribe" subtitle="Manage your newsletter subscription">
      <Suspense fallback={<p>Loading…</p>}>
        <UnsubscribeContent />
      </Suspense>
    </PageShell>
  );
}
