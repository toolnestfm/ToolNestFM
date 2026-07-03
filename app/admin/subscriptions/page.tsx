'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminPageHeader } from '@/components/admin/AdminPage';
import { adminFetch } from '@/lib/admin-client';

type SubUser = { id: string; full_name: string | null; email: string; plan: string; stripe_customer_id?: string; stripe_subscription_id?: string; created_at: string };

export default function AdminSubscriptionsPage() {
  const [users, setUsers] = useState<SubUser[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminFetch<{ users: SubUser[] }>('/api/admin/users?plan=PRO&page=1');
      const ent = await adminFetch<{ users: SubUser[] }>('/api/admin/users?plan=ENTERPRISE&page=1');
      setUsers([...data.users, ...ent.users]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div>
      <AdminPageHeader title="Subscriptions" subtitle="Stripe subscriptions and paid plans" />
      <div className="admin-panel glass">
        {loading ? <div className="spinner" style={{ margin: 40 }} /> : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>User</th><th>Plan</th><th>Stripe Customer</th><th>Subscription</th><th>Since</th></tr></thead>
              <tbody>
                {users.length === 0 && <tr><td colSpan={5} className="muted">No paid subscribers yet</td></tr>}
                {users.map((u) => (
                  <tr key={u.id}>
                    <td><b>{u.full_name}</b><div className="muted" style={{ fontSize: 12 }}>{u.email}</div></td>
                    <td><span className="pill pill-pro">{u.plan}</span></td>
                    <td className="mono muted" style={{ fontSize: 11 }}>{(u as SubUser & { stripe_customer_id?: string }).stripe_customer_id?.slice(0, 12) ?? '—'}</td>
                    <td className="mono muted" style={{ fontSize: 11 }}>{(u as SubUser & { stripe_subscription_id?: string }).stripe_subscription_id?.slice(0, 12) ?? '—'}</td>
                    <td className="muted">{new Date(u.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
