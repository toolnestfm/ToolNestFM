'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import { AdminPageHeader } from '@/components/admin/AdminPage';
import {
  BanModal,
  ConfirmModal,
  CreditsModal,
  EditUserModal,
  NotifyModal,
} from '@/components/admin/UserAdminModals';
import { useUI } from '@/components/GlobalUI';
import { useAuth } from '@/components/providers/AuthProvider';
import { adminFetch } from '@/lib/admin-client';
import { initials } from '@/lib/auth';

type UserDetail = {
  profile: {
    id: string;
    full_name: string | null;
    email: string;
    plan: string;
    role: string;
    credits: number;
    tools_used_today: number;
    is_banned: boolean;
    banned_at: string | null;
    ban_reason: string | null;
    admin_notes: string | null;
    storage_used_mb: number;
    daily_tool_limit: number | null;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    created_at: string;
    updated_at: string;
  };
  auth: {
    email: string;
    email_confirmed: boolean;
    last_sign_in_at: string | null;
    created_at: string;
    banned_until: string | null;
    providers: string[];
  };
  stats: {
    jobs: { total: number; failed: number; completed: number };
    credits: number;
    tools_used_today: number;
    notifications: number;
    api_keys: number;
  };
  recent_jobs: Array<{
    id: string;
    tool_slug: string;
    tool_name: string;
    category: string;
    status: string;
    created_at: string;
  }>;
  credit_ledger: Array<{
    id: string;
    amount: number;
    balance_after: number;
    reason: string;
    created_at: string;
  }>;
  api_keys: Array<{
    id: string;
    name: string;
    prefix: string;
    last_used_at: string | null;
    revoked_at: string | null;
    created_at: string;
  }>;
  audit_logs: Array<{
    id: string;
    actor_id: string;
    action: string;
    meta: Record<string, unknown>;
    created_at: string;
  }>;
};

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useUI();
  const { user: adminUser } = useAuth();
  const [data, setData] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'jobs' | 'credits' | 'keys' | 'audit'>('overview');

  const [showEdit, setShowEdit] = useState(false);
  const [showCredits, setShowCredits] = useState(false);
  const [showBan, setShowBan] = useState(false);
  const [showNotify, setShowNotify] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetLink, setResetLink] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const detail = await adminFetch<UserDetail>(`/api/admin/users/${id}`);
      setData(detail);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to load user', 'error');
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => { void load(); }, [load]);

  const runAction = async (action: string, payload?: Record<string, unknown>) => {
    const result = await adminFetch<Record<string, unknown>>(`/api/admin/users/${id}/actions`, {
      method: 'POST',
      body: JSON.stringify({ action, ...payload }),
    });
    return result;
  };

  if (loading) {
    return <div className="spinner" style={{ margin: '80px auto' }} />;
  }

  if (!data) {
    return (
      <div className="admin-panel glass">
        <p className="muted">User not found.</p>
        <Link href="/admin/users" className="btn btn-ghost btn-sm mt-4">← Back to users</Link>
      </div>
    );
  }

  const { profile, auth, stats } = data;
  const displayName = profile.full_name || profile.email.split('@')[0];
  const isSuperAdmin = adminUser?.role === 'super_admin';

  return (
    <div>
      <AdminPageHeader
        title={displayName}
        subtitle={profile.email}
        action={
          <Link href="/admin/users" className="btn btn-ghost btn-sm">← Back to users</Link>
        }
      />

      <div className="admin-profile-hero glass">
        <span className="user-avatar admin-profile-avatar">{initials(displayName)}</span>
        <div className="admin-profile-meta">
          <h2>{displayName}</h2>
          <div className="admin-profile-badges">
            <span className={`pill pill-sm pill-plan-${profile.plan.toLowerCase()}`}>{profile.plan}</span>
            <span className="pill pill-sm">{profile.role.replace('_', ' ')}</span>
            {profile.is_banned ? (
              <span className="status-pill status-failed">Banned</span>
            ) : (
              <span className="status-pill status-completed">Active</span>
            )}
            {auth.email_confirmed && <span className="pill pill-sm">Email verified</span>}
          </div>
          <p className="muted mono" style={{ fontSize: 12 }}>{profile.id}</p>
          {profile.is_banned && profile.ban_reason && (
            <p className="admin-alert error" style={{ marginTop: 12, marginBottom: 0 }}>
              Ban reason: {profile.ban_reason}
            </p>
          )}
        </div>
        <div className="admin-actions-row" style={{ marginLeft: 'auto', marginTop: 0 }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowEdit(true)}>Edit</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowCredits(true)}>Credits</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowNotify(true)}>Notify</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowReset(true)}>Reset quota</button>
          <button
            type="button"
            className={`btn btn-sm ${profile.is_banned ? 'btn-primary' : 'btn-danger'}`}
            onClick={() => setShowBan(true)}
          >
            {profile.is_banned ? 'Unban' : 'Ban'}
          </button>
          {isSuperAdmin && profile.role !== 'SUPER_ADMIN' && (
            <button type="button" className="btn btn-danger btn-sm" onClick={() => setShowDelete(true)}>Delete</button>
          )}
        </div>
      </div>

      <div className="admin-stats-grid">
        <div className="admin-stat-card glass accent-violet">
          <span className="muted">Credits</span>
          <b>{stats.credits.toLocaleString()}</b>
        </div>
        <div className="admin-stat-card glass accent-green">
          <span className="muted">Jobs total</span>
          <b>{stats.jobs.total.toLocaleString()}</b>
        </div>
        <div className="admin-stat-card glass accent-orange">
          <span className="muted">Tools today</span>
          <b>{stats.tools_used_today}</b>
        </div>
        <div className="admin-stat-card glass accent-blue">
          <span className="muted">API keys active</span>
          <b>{stats.api_keys}</b>
        </div>
      </div>

      <div className="admin-tab-bar glass">
        {(['overview', 'jobs', 'credits', 'keys', 'audit'] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={`admin-tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="admin-profile-grid">
          <div className="admin-panel glass">
            <h2>Account info</h2>
            <dl className="admin-dl">
              <dt>Email</dt><dd>{auth.email}</dd>
              <dt>Providers</dt><dd>{auth.providers.join(', ') || 'email'}</dd>
              <dt>Joined</dt><dd>{new Date(auth.created_at).toLocaleString()}</dd>
              <dt>Last sign-in</dt><dd>{auth.last_sign_in_at ? new Date(auth.last_sign_in_at).toLocaleString() : 'Never'}</dd>
              <dt>Storage used</dt><dd>{profile.storage_used_mb} MB</dd>
              <dt>Daily limit override</dt><dd>{profile.daily_tool_limit ?? 'Plan default'}</dd>
              <dt>Stripe customer</dt><dd className="mono">{profile.stripe_customer_id ?? '—'}</dd>
            </dl>
            <div className="admin-actions-row">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => void navigator.clipboard.writeText(profile.id).then(() => toast('ID copied', 'success'))}
              >
                Copy user ID
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={async () => {
                  try {
                    const res = await runAction('password_reset');
                    setResetLink((res.reset_link as string) ?? null);
                    toast('Password reset link generated', 'success');
                  } catch (e) {
                    toast(e instanceof Error ? e.message : 'Failed', 'error');
                  }
                }}
              >
                Generate password reset link
              </button>
            </div>
            {resetLink && (
              <div className="admin-reset-link-box">
                <input className="admin-input w-full" readOnly value={resetLink} />
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => void navigator.clipboard.writeText(resetLink).then(() => toast('Link copied', 'success'))}
                >
                  Copy link
                </button>
              </div>
            )}
          </div>
          <div className="admin-panel glass">
            <h2>Admin notes</h2>
            <p className="admin-notes-body">{profile.admin_notes || 'No internal notes yet.'}</p>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowEdit(true)}>Edit notes</button>
          </div>
          <div className="admin-panel glass">
            <h2>Recent jobs</h2>
            {data.recent_jobs.length === 0 ? (
              <p className="muted">No jobs yet.</p>
            ) : (
              <ul className="admin-rank-list">
                {data.recent_jobs.slice(0, 5).map((j) => (
                  <li key={j.id}>
                    <span>{j.tool_name}</span>
                    <span className={`status-pill status-${j.status === 'failed' ? 'failed' : 'completed'}`}>{j.status}</span>
                  </li>
                ))}
              </ul>
            )}
            <Link href={`/admin/files`} className="btn btn-ghost btn-sm mt-2">View files</Link>
          </div>
        </div>
      )}

      {tab === 'jobs' && (
        <div className="admin-panel glass">
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>Tool</th><th>Category</th><th>Status</th><th>Time</th></tr>
              </thead>
              <tbody>
                {data.recent_jobs.map((j) => (
                  <tr key={j.id}>
                    <td><b>{j.tool_name}</b><div className="muted mono" style={{ fontSize: 11 }}>{j.tool_slug}</div></td>
                    <td>{j.category}</td>
                    <td><span className={`status-pill status-${j.status === 'failed' ? 'failed' : 'completed'}`}>{j.status}</span></td>
                    <td className="muted">{new Date(j.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'credits' && (
        <div className="admin-panel glass">
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>Amount</th><th>Balance after</th><th>Reason</th><th>Time</th></tr>
              </thead>
              <tbody>
                {data.credit_ledger.map((row) => (
                  <tr key={row.id}>
                    <td style={{ color: row.amount >= 0 ? 'var(--success-green)' : '#ef4444' }}>
                      {row.amount >= 0 ? '+' : ''}{row.amount}
                    </td>
                    <td>{row.balance_after.toLocaleString()}</td>
                    <td><span className="pill pill-sm">{row.reason}</span></td>
                    <td className="muted">{new Date(row.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'keys' && (
        <div className="admin-panel glass">
          {data.api_keys.length === 0 ? (
            <p className="muted">No API keys.</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>Name</th><th>Prefix</th><th>Status</th><th>Last used</th><th>Created</th></tr>
                </thead>
                <tbody>
                  {data.api_keys.map((k) => (
                    <tr key={k.id}>
                      <td><b>{k.name}</b></td>
                      <td className="mono">{k.prefix}…</td>
                      <td>{k.revoked_at ? <span className="status-pill status-failed">Revoked</span> : <span className="status-pill status-completed">Active</span>}</td>
                      <td className="muted">{k.last_used_at ? new Date(k.last_used_at).toLocaleString() : 'Never'}</td>
                      <td className="muted">{new Date(k.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'audit' && (
        <div className="admin-panel glass">
          {data.audit_logs.length === 0 ? (
            <p className="muted">No admin actions logged for this user.</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>Action</th><th>Actor</th><th>Meta</th><th>Time</th></tr>
                </thead>
                <tbody>
                  {data.audit_logs.map((l) => (
                    <tr key={l.id}>
                      <td><span className="pill pill-sm">{l.action}</span></td>
                      <td className="mono muted" style={{ fontSize: 11 }}>{l.actor_id.slice(0, 8)}…</td>
                      <td className="mono muted" style={{ fontSize: 10 }}>{JSON.stringify(l.meta).slice(0, 60)}</td>
                      <td className="muted">{new Date(l.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Link href="/admin/audit" className="btn btn-ghost btn-sm mt-4">Full audit log</Link>
        </div>
      )}

      <EditUserModal
        key={profile.updated_at}
        open={showEdit}
        initial={{
          full_name: profile.full_name ?? '',
          plan: profile.plan,
          role: profile.role,
          admin_notes: profile.admin_notes ?? '',
          daily_tool_limit: profile.daily_tool_limit != null ? String(profile.daily_tool_limit) : '',
        }}
        onClose={() => setShowEdit(false)}
        onSubmit={async (form) => {
          await adminFetch(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(form) });
          toast('User updated', 'success');
          setShowEdit(false);
          void load();
        }}
      />
      <CreditsModal
        open={showCredits}
        userName={displayName}
        onClose={() => setShowCredits(false)}
        onSubmit={async (amount, note) => {
          await adminFetch('/api/admin/credits', {
            method: 'POST',
            body: JSON.stringify({ userId: id, amount, note }),
          });
          toast('Credits updated', 'success');
          void load();
        }}
      />
      <BanModal
        open={showBan}
        userName={displayName}
        isBanned={profile.is_banned}
        onClose={() => setShowBan(false)}
        onSubmit={async (reason) => {
          if (profile.is_banned) {
            await runAction('unban');
            toast('User unbanned', 'success');
          } else {
            await runAction('ban', { reason });
            toast('User banned', 'success');
          }
          setShowBan(false);
          void load();
        }}
      />
      <NotifyModal
        open={showNotify}
        userName={displayName}
        onClose={() => setShowNotify(false)}
        onSubmit={async (title, body, href) => {
          await runAction('notify', { title, body, href });
          toast('Notification sent', 'success');
        }}
      />
      <ConfirmModal
        open={showReset}
        title="Reset daily quota"
        message={`Reset tools_used_today to 0 for ${displayName}?`}
        confirmLabel="Reset quota"
        onClose={() => setShowReset(false)}
        onConfirm={async () => {
          await runAction('reset_quota');
          toast('Quota reset', 'success');
          void load();
        }}
      />
      <ConfirmModal
        open={showDelete}
        title="Delete user permanently"
        message={`This will permanently delete ${displayName} and all their data. This cannot be undone.`}
        confirmLabel="Delete user"
        danger
        onClose={() => setShowDelete(false)}
        onConfirm={async () => {
          await adminFetch(`/api/admin/users/${id}`, { method: 'DELETE' });
          toast('User deleted', 'success');
          router.push('/admin/users');
        }}
      />
    </div>
  );
}
