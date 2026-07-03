'use client';

import { useCallback, useEffect, useState } from 'react';
import { useUI } from '@/components/GlobalUI';
import { adminFetch } from '@/lib/admin-client';

type UserRow = {
  id: string;
  full_name: string | null;
  email: string;
  plan: string;
  role: string;
  credits: number;
  tools_used_today: number;
  created_at: string;
};

export default function AdminUsersPage() {
  const { toast } = useUI();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [q, setQ] = useState('');
  const [plan, setPlan] = useState('');
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (q) params.set('q', q);
      if (plan) params.set('plan', plan);
      if (role) params.set('role', role);
      const data = await adminFetch<{ users: UserRow[]; total: number; pages: number }>(
        `/api/admin/users?${params}`,
      );
      setUsers(data.users);
      setTotal(data.total);
      setPages(data.pages);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Load failed', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, q, plan, role, toast]);

  useEffect(() => { void load(); }, [load]);

  const updateUser = async (id: string, patch: { plan?: string; role?: string }) => {
    try {
      await adminFetch('/api/admin/users', {
        method: 'PATCH',
        body: JSON.stringify({ id, ...patch }),
      });
      toast('User updated', 'success');
      void load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Update failed', 'error');
    }
  };

  const grantCredits = async (id: string) => {
    const input = prompt('Credits to add (negative to deduct):', '100');
    if (input === null) return;
    const amount = Number(input);
    if (!Number.isInteger(amount) || amount === 0) { toast('Enter a whole number', 'error'); return; }
    try {
      const data = await adminFetch<{ balance: number }>('/api/admin/credits', {
        method: 'POST',
        body: JSON.stringify({ userId: id, amount, note: 'Quick adjust from Users page' }),
      });
      toast(`Credits updated — new balance: ${data.balance}`, 'success');
      void load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Credit update failed', 'error');
    }
  };

  return (
    <div>
      <header className="admin-header">
        <div>
          <h1 className="admin-title">Users</h1>
          <p className="muted">{total.toLocaleString()} registered users</p>
        </div>
      </header>

      <div className="admin-toolbar glass">
        <input
          className="admin-input"
          placeholder="Search name or user ID…"
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
        />
        <select className="admin-select" value={plan} onChange={(e) => { setPlan(e.target.value); setPage(1); }}>
          <option value="">All plans</option>
          <option value="FREE">Free</option>
          <option value="PRO">Pro</option>
          <option value="ENTERPRISE">Enterprise</option>
        </select>
        <select className="admin-select" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}>
          <option value="">All roles</option>
          <option value="USER">User</option>
          <option value="ADMIN">Admin</option>
          <option value="SUPER_ADMIN">Super Admin</option>
        </select>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void load()}>Refresh</button>
      </div>

      <div className="admin-panel glass">
        {loading ? (
          <div className="spinner" style={{ margin: '40px auto' }} />
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Plan</th>
                  <th>Role</th>
                  <th>Credits</th>
                  <th>Tools today</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <b>{u.full_name || '—'}</b>
                      <div className="muted" style={{ fontSize: 12 }}>{u.email}</div>
                    </td>
                    <td>
                      <select
                        className="admin-select admin-select-sm"
                        value={u.plan}
                        onChange={(e) => void updateUser(u.id, { plan: e.target.value })}
                      >
                        <option value="FREE">FREE</option>
                        <option value="PRO">PRO</option>
                        <option value="ENTERPRISE">ENTERPRISE</option>
                      </select>
                    </td>
                    <td>
                      <select
                        className="admin-select admin-select-sm"
                        value={u.role}
                        onChange={(e) => void updateUser(u.id, { role: e.target.value })}
                      >
                        <option value="USER">USER</option>
                        <option value="ADMIN">ADMIN</option>
                        <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                      </select>
                    </td>
                    <td>
                      <b>{(u.credits ?? 0).toLocaleString()}</b>{' '}
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => void grantCredits(u.id)}>±</button>
                    </td>
                    <td>{u.tools_used_today}</td>
                    <td className="muted">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => { navigator.clipboard.writeText(u.id); toast('ID copied', 'success'); }}
                      >
                        Copy ID
                      </button>
                    </td>
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
