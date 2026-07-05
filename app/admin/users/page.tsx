'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import { BanModal, ConfirmModal, CreditsModal, EditUserModal, NotifyModal } from '@/components/admin/UserAdminModals';
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
  is_banned: boolean;
  ban_reason: string | null;
  created_at: string;
};

type ModalTarget = UserRow | null;

export default function AdminUsersPage() {
  const { toast } = useUI();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [q, setQ] = useState('');
  const [plan, setPlan] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const [editTarget, setEditTarget] = useState<ModalTarget>(null);
  const [creditsTarget, setCreditsTarget] = useState<ModalTarget>(null);
  const [banTarget, setBanTarget] = useState<ModalTarget>(null);
  const [notifyTarget, setNotifyTarget] = useState<ModalTarget>(null);
  const [resetTarget, setResetTarget] = useState<ModalTarget>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (q) params.set('q', q);
      if (plan) params.set('plan', plan);
      if (role) params.set('role', role);
      if (status) params.set('status', status);
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
  }, [page, q, plan, role, status, toast]);

  useEffect(() => { void load(); }, [load]);

  const runAction = async (id: string, action: string, payload?: Record<string, unknown>) => {
    await adminFetch(`/api/admin/users/${id}/actions`, {
      method: 'POST',
      body: JSON.stringify({ action, ...payload }),
    });
  };

  const saveEdit = async (data: {
    full_name: string;
    plan: string;
    role: string;
    admin_notes: string;
    daily_tool_limit: number | null;
  }) => {
    if (!editTarget) return;
    await adminFetch(`/api/admin/users/${editTarget.id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    toast('User updated', 'success');
    void load();
  };

  const adjustCredits = async (amount: number, note: string) => {
    if (!creditsTarget) return;
    const data = await adminFetch<{ balance: number }>('/api/admin/credits', {
      method: 'POST',
      body: JSON.stringify({ userId: creditsTarget.id, amount, note: note || 'Admin adjustment' }),
    });
    toast(`Credits updated — balance: ${data.balance.toLocaleString()}`, 'success');
    void load();
  };

  const handleBan = async (reason: string) => {
    if (!banTarget) return;
    if (banTarget.is_banned) {
      await runAction(banTarget.id, 'unban');
      toast('User unbanned', 'success');
    } else {
      await runAction(banTarget.id, 'ban', { reason });
      toast('User banned', 'success');
    }
    void load();
  };

  const handleNotify = async (title: string, body: string, href: string) => {
    if (!notifyTarget) return;
    await runAction(notifyTarget.id, 'notify', { title, body, href });
    toast('Notification sent', 'success');
  };

  const handleResetQuota = async () => {
    if (!resetTarget) return;
    await runAction(resetTarget.id, 'reset_quota');
    toast('Daily tool quota reset', 'success');
    void load();
  };

  const copyText = (text: string, label: string) => {
    void navigator.clipboard.writeText(text);
    toast(`${label} copied`, 'success');
    setOpenMenu(null);
  };

  return (
    <div>
      <header className="admin-header">
        <div>
          <h1 className="admin-title">Users</h1>
          <p className="muted">{total.toLocaleString()} registered users — search by name, email, or UUID</p>
        </div>
        <Link href="/admin/audit" className="btn btn-ghost btn-sm">View audit log</Link>
      </header>

      <div className="admin-stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 16 }}>
        <div className="admin-stat-card glass accent-blue">
          <span className="muted">Total users</span>
          <b>{total.toLocaleString()}</b>
        </div>
        <div className="admin-stat-card glass accent-green">
          <span className="muted">On this page</span>
          <b>{users.length}</b>
        </div>
        <div className="admin-stat-card glass accent-orange">
          <span className="muted">Banned (visible)</span>
          <b>{users.filter((u) => u.is_banned).length}</b>
        </div>
      </div>

      <div className="admin-toolbar glass">
        <input
          className="admin-input"
          style={{ flex: 1, minWidth: 200 }}
          placeholder="Search name, email, or user ID…"
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
        />
        <select className="admin-select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All status</option>
          <option value="active">Active</option>
          <option value="banned">Banned</option>
        </select>
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
        ) : users.length === 0 ? (
          <p className="muted" style={{ textAlign: 'center', padding: 40 }}>No users match your filters.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Status</th>
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
                  <tr key={u.id} className={u.is_banned ? 'admin-row-banned' : ''}>
                    <td>
                      <Link href={`/admin/users/${u.id}`} className="admin-user-link-inline">
                        <b>{u.full_name || '—'}</b>
                      </Link>
                      <div className="muted" style={{ fontSize: 12 }}>{u.email}</div>
                      <div className="mono muted" style={{ fontSize: 10 }}>{u.id.slice(0, 8)}…</div>
                    </td>
                    <td>
                      {u.is_banned ? (
                        <span className="status-pill status-failed" title={u.ban_reason ?? ''}>Banned</span>
                      ) : (
                        <span className="status-pill status-completed">Active</span>
                      )}
                    </td>
                    <td><span className={`pill pill-sm pill-plan-${u.plan.toLowerCase()}`}>{u.plan}</span></td>
                    <td><span className="pill pill-sm">{u.role.replace('_', ' ')}</span></td>
                    <td><b>{(u.credits ?? 0).toLocaleString()}</b></td>
                    <td>{u.tools_used_today}</td>
                    <td className="muted">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td>
                      <div className="admin-actions-menu-wrap">
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => setOpenMenu(openMenu === u.id ? null : u.id)}
                          aria-expanded={openMenu === u.id}
                        >
                          Actions <Icon name="chevron-down" size={14} />
                        </button>
                        {openMenu === u.id && (
                          <>
                            <div className="admin-actions-backdrop" onClick={() => setOpenMenu(null)} />
                            <div className="admin-actions-menu glass">
                              <Link href={`/admin/users/${u.id}`} className="admin-actions-item" onClick={() => setOpenMenu(null)}>
                                <Icon name="user" size={14} /> View details
                              </Link>
                              <button type="button" className="admin-actions-item" onClick={() => { setEditTarget(u); setOpenMenu(null); }}>
                                <Icon name="pen" size={14} /> Edit user
                              </button>
                              <button type="button" className="admin-actions-item" onClick={() => { setCreditsTarget(u); setOpenMenu(null); }}>
                                <Icon name="zap" size={14} /> Adjust credits
                              </button>
                              <button type="button" className="admin-actions-item" onClick={() => { setResetTarget(u); setOpenMenu(null); }}>
                                <Icon name="refresh" size={14} /> Reset daily quota
                              </button>
                              <button type="button" className="admin-actions-item" onClick={() => { setNotifyTarget(u); setOpenMenu(null); }}>
                                <Icon name="bell" size={14} /> Send notification
                              </button>
                              <button type="button" className="admin-actions-item" onClick={() => { setBanTarget(u); setOpenMenu(null); }}>
                                <Icon name="shield" size={14} /> {u.is_banned ? 'Unban user' : 'Ban user'}
                              </button>
                              <button type="button" className="admin-actions-item" onClick={() => copyText(u.id, 'User ID')}>
                                <Icon name="copy" size={14} /> Copy ID
                              </button>
                              <button type="button" className="admin-actions-item" onClick={() => copyText(u.email, 'Email')}>
                                <Icon name="mail" size={14} /> Copy email
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="admin-pagination">
          <button type="button" className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
          <span className="muted">Page {page} / {pages || 1}</span>
          <button type="button" className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      </div>

      {editTarget && (
        <EditUserModal
          key={editTarget.id}
          open
          initial={{
            full_name: editTarget.full_name ?? '',
            plan: editTarget.plan,
            role: editTarget.role,
            admin_notes: '',
            daily_tool_limit: '',
          }}
          onClose={() => setEditTarget(null)}
          onSubmit={saveEdit}
        />
      )}
      {creditsTarget && (
        <CreditsModal
          open
          userName={creditsTarget.full_name || creditsTarget.email}
          onClose={() => setCreditsTarget(null)}
          onSubmit={adjustCredits}
        />
      )}
      {banTarget && (
        <BanModal
          open
          userName={banTarget.full_name || banTarget.email}
          isBanned={banTarget.is_banned}
          onClose={() => setBanTarget(null)}
          onSubmit={handleBan}
        />
      )}
      {notifyTarget && (
        <NotifyModal
          open
          userName={notifyTarget.full_name || notifyTarget.email}
          onClose={() => setNotifyTarget(null)}
          onSubmit={handleNotify}
        />
      )}
      {resetTarget && (
        <ConfirmModal
          open
          title="Reset daily quota"
          message={`Reset tools_used_today to 0 for ${resetTarget.full_name || resetTarget.email}?`}
          confirmLabel="Reset quota"
          onClose={() => setResetTarget(null)}
          onConfirm={handleResetQuota}
        />
      )}
    </div>
  );
}
