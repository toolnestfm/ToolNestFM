'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminPageHeader } from '@/components/admin/AdminPage';
import { useUI } from '@/components/GlobalUI';
import { adminFetch } from '@/lib/admin-client';

type LedgerRow = {
  id: string;
  user_id: string;
  amount: number;
  balance_after: number;
  reason: string;
  actor_id: string | null;
  meta: Record<string, unknown>;
  created_at: string;
};

export default function AdminCreditsPage() {
  const { toast } = useUI();
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [filterUser, setFilterUser] = useState('');
  const [loading, setLoading] = useState(true);

  const [userId, setUserId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (filterUser) params.set('userId', filterUser);
      const data = await adminFetch<{ ledger: LedgerRow[]; pages: number }>(`/api/admin/credits?${params}`);
      setLedger(data.ledger);
      setPages(data.pages || 1);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Load failed', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, filterUser, toast]);

  useEffect(() => { void load(); }, [load]);

  const adjust = async (sign: 1 | -1) => {
    const n = Math.abs(Number(amount));
    if (!userId.trim()) { toast('Enter a user ID (copy it from the Users page)', 'error'); return; }
    if (!Number.isInteger(n) || n === 0) { toast('Enter a whole-number amount', 'error'); return; }
    setSaving(true);
    try {
      const data = await adminFetch<{ balance: number }>('/api/admin/credits', {
        method: 'POST',
        body: JSON.stringify({ userId: userId.trim(), amount: sign * n, note }),
      });
      toast(`Done — new balance: ${data.balance}`, 'success');
      setAmount('');
      setNote('');
      void load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Adjustment failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <AdminPageHeader title="Credits" subtitle="Grant or deduct ToolNest credits and audit every transaction" />

      <div className="admin-panel glass mb-4">
        <h2>Adjust credits</h2>
        <div className="admin-toolbar" style={{ padding: 0, marginTop: 12 }}>
          <input className="admin-input" placeholder="User ID (uuid)…" value={userId} onChange={(e) => setUserId(e.target.value)} />
          <input className="admin-input" style={{ maxWidth: 120 }} type="number" min="1" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <input className="admin-input" placeholder="Note (optional)…" value={note} onChange={(e) => setNote(e.target.value)} />
          <button type="button" className="btn btn-primary btn-sm" disabled={saving} onClick={() => void adjust(1)}>+ Grant</button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={saving} onClick={() => void adjust(-1)}>− Deduct</button>
        </div>
      </div>

      <div className="admin-toolbar glass">
        <input className="admin-input" placeholder="Filter by user ID…" value={filterUser} onChange={(e) => { setFilterUser(e.target.value); setPage(1); }} />
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void load()}>Refresh</button>
      </div>

      <div className="admin-panel glass">
        {loading ? (
          <div className="spinner" style={{ margin: '40px auto' }} />
        ) : ledger.length === 0 ? (
          <p className="muted">No credit transactions yet.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>User</th><th>Amount</th><th>Balance</th><th>Reason</th><th>Note</th><th>When</th></tr>
              </thead>
              <tbody>
                {ledger.map((row) => (
                  <tr key={row.id}>
                    <td className="mono" style={{ fontSize: 12 }}>{row.user_id.slice(0, 8)}…</td>
                    <td style={{ color: row.amount > 0 ? 'var(--success-green, #22C55E)' : undefined }}>
                      {row.amount > 0 ? `+${row.amount}` : row.amount}
                    </td>
                    <td>{row.balance_after}</td>
                    <td>{row.reason}</td>
                    <td className="muted">{typeof row.meta?.note === 'string' ? row.meta.note : '—'}</td>
                    <td className="muted">{new Date(row.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="admin-pagination">
          <button type="button" className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
          <span className="muted">Page {page} / {pages}</span>
          <button type="button" className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      </div>
    </div>
  );
}
