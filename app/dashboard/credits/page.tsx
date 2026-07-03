'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useUI } from '@/components/GlobalUI';

interface LedgerRow {
  id: string;
  amount: number;
  balance_after: number;
  reason: string;
  created_at: string;
}

const reasonLabel: Record<string, string> = {
  signup_bonus: '🎁 Signup bonus',
  admin_grant: '👑 Granted by admin',
  admin_deduct: 'Adjusted by admin',
  ai_chat: '✨ AI chat message',
  api_call: '🔌 API call',
  purchase: '💳 Purchased',
};

const packs = [
  { id: 'starter', name: 'Starter', credits: 100, price: '$5' },
  { id: 'plus', name: 'Plus', credits: 500, price: '$20' },
  { id: 'mega', name: 'Mega', credits: 2000, price: '$60' },
];

function CreditsContent() {
  const { toast } = useUI();
  const searchParams = useSearchParams();
  const [balance, setBalance] = useState<number | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [buying, setBuying] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/credits');
      const json = (await res.json()) as { success: boolean; data?: { balance: number; ledger: LedgerRow[] }; error?: string | null };
      if (!json.success) throw new Error(json.error || 'Could not load credits');
      setBalance(json.data?.balance ?? 0);
      setLedger(json.data?.ledger ?? []);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not load credits', 'error');
      setBalance(0);
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const checkout = searchParams.get('checkout');
    if (checkout === 'success') toast('🎉 Payment received! Credits are being added.', 'success');
    else if (checkout === 'cancelled') toast('Checkout cancelled — no charge was made.', 'info');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const buy = async (pack: string) => {
    setBuying(pack);
    try {
      const res = await fetch('/api/billing/credits-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pack }),
      });
      const json = (await res.json()) as { success: boolean; data?: { url: string }; error?: string | null };
      if (!json.success || !json.data?.url) throw new Error(json.error || 'Could not start checkout');
      window.location.href = json.data.url;
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not start checkout', 'error');
      setBuying('');
    }
  };

  return (
    <div>
      <h1 className="dash-title">Credits</h1>
      <p className="muted mb-6">Credits power AI chat beyond the free daily limit and the ToolNest developer API (1 credit per call).</p>

      <div className="dash-stats">
        <div className="dash-stat glass">
          <span className="muted">Balance</span>
          <b style={{ fontSize: 28 }}>{balance === null ? '…' : balance.toLocaleString()} ⚡</b>
        </div>
        {packs.map((p) => (
          <div key={p.id} className="dash-stat glass">
            <span className="muted">{p.name}</span>
            <b>{p.credits.toLocaleString()} credits — {p.price}</b>
            <button className="btn btn-primary btn-sm mt-2" onClick={() => void buy(p.id)} disabled={!!buying}>
              {buying === p.id ? 'Redirecting…' : 'Buy'}
            </button>
          </div>
        ))}
      </div>

      <h2 className="dash-section-title">Transaction history</h2>
      {ledger.length === 0 ? (
        <div className="glass dash-empty"><p>No transactions yet. New accounts get 25 free credits on signup.</p></div>
      ) : (
        <div className="glass" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left' }}>
                <th style={{ padding: '12px 16px' }}>What</th>
                <th style={{ padding: '12px 16px' }}>Amount</th>
                <th style={{ padding: '12px 16px' }}>Balance</th>
                <th style={{ padding: '12px 16px' }}>When</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((row) => (
                <tr key={row.id} style={{ borderTop: '1px solid var(--border-subtle, #2A2A3C)' }}>
                  <td style={{ padding: '12px 16px' }}>{reasonLabel[row.reason] ?? row.reason}</td>
                  <td style={{ padding: '12px 16px', color: row.amount > 0 ? 'var(--success-green, #22C55E)' : undefined }}>
                    {row.amount > 0 ? `+${row.amount}` : row.amount}
                  </td>
                  <td style={{ padding: '12px 16px' }} className="muted">{row.balance_after}</td>
                  <td style={{ padding: '12px 16px' }} className="muted">{new Date(row.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function CreditsPage() {
  return (
    <Suspense fallback={<div className="glass dash-empty"><p>Loading credits…</p></div>}>
      <CreditsContent />
    </Suspense>
  );
}
