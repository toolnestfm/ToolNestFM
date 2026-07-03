'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { useUI } from '@/components/GlobalUI';

const plans = [
  { id: 'free', name: 'Free', price: '$0', features: ['5 jobs/day per tool', '500 MB storage', '10 AI messages/day', '25 MB file limit'] },
  { id: 'pro', name: 'Pro', price: '$9/mo', features: ['Unlimited jobs', '100 GB storage', 'Unlimited AI', '2 GB files', 'No watermarks', 'Batch processing'] },
];

function BillingContent() {
  const { user, refresh } = useAuth();
  const { toast } = useUI();
  const searchParams = useSearchParams();
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    const checkout = searchParams.get('checkout');
    if (checkout === 'success') {
      toast('🎉 Welcome to Pro! Your plan is being activated.', 'success');
      void refresh();
    } else if (checkout === 'cancelled') {
      toast('Checkout cancelled — no charge was made.', 'info');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const upgrade = async () => {
    setUpgrading(true);
    try {
      const res = await fetch('/api/billing/checkout', { method: 'POST' });
      const json = (await res.json()) as { success: boolean; data?: { url: string }; error?: string | null };
      if (!json.success || !json.data?.url) throw new Error(json.error || 'Could not start checkout');
      window.location.href = json.data.url;
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not start checkout', 'error');
      setUpgrading(false);
    }
  };

  return (
    <div>
      <h1 className="dash-title">Billing</h1>
      <p className="muted mb-6">Current plan: <b>{user?.plan === 'pro' ? 'Pro 👑' : user?.plan === 'enterprise' ? 'Enterprise' : 'Free'}</b></p>
      <div className="billing-grid">
        {plans.map((p) => (
          <div key={p.id} className={`billing-card glass ${user?.plan === p.id ? 'active' : ''}`}>
            <h3>{p.name}</h3>
            <div className="billing-price">{p.price}</div>
            <ul>{p.features.map((f) => <li key={f}>✓ {f}</li>)}</ul>
            {p.id === 'pro' && user?.plan === 'free' && (
              <button className="btn btn-primary w-full" onClick={() => void upgrade()} disabled={upgrading}>
                {upgrading ? 'Redirecting to Stripe…' : 'Upgrade to Pro'}
              </button>
            )}
            {user?.plan === p.id && <span className="billing-current">Current plan</span>}
          </div>
        ))}
      </div>
      <p className="muted mt-6">Payments are processed securely by Stripe. Cancel anytime.</p>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={<div className="glass dash-empty"><p>Loading billing…</p></div>}>
      <BillingContent />
    </Suspense>
  );
}
