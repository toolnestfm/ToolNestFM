'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AdminPageHeader, AdminQuickGrid } from '@/components/admin/AdminPage';
import { useUI } from '@/components/GlobalUI';
import { useAuth } from '@/components/providers/AuthProvider';
import { adminQuickLinks } from '@/lib/admin-nav';
import { adminFetch } from '@/lib/admin-client';
import { initials } from '@/lib/auth';
import { createClient } from '@/lib/supabase/client';

type ProfileData = {
  profile: { full_name: string | null; avatar_url: string | null; plan: string; role: string; created_at: string } | null;
  email: string;
  lastSignIn: string | null;
  recentActivity: { id: string; action: string; target: string | null; created_at: string }[];
};

export default function AdminProfilePage() {
  const { user, refresh } = useAuth();
  const { toast, theme, toggleTheme } = useUI();
  const [data, setData] = useState<ProfileData | null>(null);
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState({ current: '', next: '', confirm: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    adminFetch<ProfileData>('/api/admin/profile').then((d) => {
      setData(d);
      setFullName(d.profile?.full_name ?? '');
    }).catch(() => {});
  }, []);

  const saveProfile = async () => {
    setBusy(true);
    try {
      await adminFetch('/api/admin/profile', { method: 'PATCH', body: JSON.stringify({ full_name: fullName }) });
      await refresh();
      toast('Profile saved', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Save failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const updatePassword = async () => {
    if (password.next.length < 8) { toast('Password must be 8+ characters', 'error'); return; }
    if (password.next !== password.confirm) { toast('Passwords do not match', 'error'); return; }
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: password.next });
    setBusy(false);
    if (error) { toast(error.message, 'error'); return; }
    toast('Password updated', 'success');
    setPassword({ current: '', next: '', confirm: '' });
  };

  const sendReset = async () => {
    if (!data?.email) return;
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(data.email);
    if (error) toast(error.message, 'error');
    else toast('Reset email sent', 'success');
  };

  if (!user) return null;

  return (
    <div>
      <AdminPageHeader
        title="Admin Profile"
        subtitle="Manage your account, security, and quick access to all admin controls."
      />

      <div className="admin-profile-hero glass">
        <span className="user-avatar admin-profile-avatar">{initials(user.fullName)}</span>
        <div className="admin-profile-meta">
          <h2>{user.fullName}</h2>
          <div className="admin-profile-badges">
            <span className="pill pill-admin">{user.role.replace('_', ' ').toUpperCase()}</span>
            <span className="pill pill-pro">{user.plan.toUpperCase()} plan</span>
          </div>
          <p className="muted">{data?.email ?? user.email}</p>
          <p className="muted" style={{ fontSize: 12 }}>
            {data?.profile?.created_at && <>Member since {new Date(data.profile.created_at).toLocaleDateString()}</>}
            {data?.lastSignIn && <> · Last sign in {new Date(data.lastSignIn).toLocaleString()}</>}
          </p>
        </div>
      </div>

      <div className="admin-profile-grid">
        <section className="admin-panel glass">
          <h2>Profile Details</h2>
          <div className="field mb-4">
            <label>Email</label>
            <input value={data?.email ?? user.email} readOnly disabled />
          </div>
          <div className="field mb-4">
            <label>Full Name</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void saveProfile()}>
            Save Profile
          </button>
        </section>

        <section className="admin-panel glass">
          <h2>Security</h2>
          <div className="field mb-4">
            <label>New Password</label>
            <input type="password" value={password.next} onChange={(e) => setPassword((p) => ({ ...p, next: e.target.value }))} placeholder="Min. 8 characters" />
          </div>
          <div className="field mb-4">
            <label>Confirm New Password</label>
            <input type="password" value={password.confirm} onChange={(e) => setPassword((p) => ({ ...p, confirm: e.target.value }))} />
          </div>
          <div className="admin-actions-row">
            <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void updatePassword()}>Update Password</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void sendReset()}>Send Reset Email</button>
          </div>
        </section>

        <section className="admin-panel glass">
          <h2>Preferences</h2>
          <label className="admin-toggle-row">
            <div>
              <b>Admin theme</b>
              <p className="muted">Switch between light and dark mode</p>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={toggleTheme}>
              {theme === 'dark' ? 'Dark' : 'Light'}
            </button>
          </label>
        </section>
      </div>

      <section className="admin-panel glass mt-4">
        <div className="admin-header" style={{ marginBottom: 12 }}>
          <h2>Admin Team Management</h2>
          <p className="muted">Add new admins, promote users, change roles</p>
        </div>
        <div className="admin-team-cards">
          <Link href="/admin/create-admin" className="admin-team-card">
            <b>Create New Admin</b>
            <span className="muted">Email + password account</span>
          </Link>
          <Link href="/admin/team" className="admin-team-card">
            <b>Promote User</b>
            <span className="muted">Upgrade existing user</span>
          </Link>
          <Link href="/admin/team" className="admin-team-card">
            <b>Permissions</b>
            <span className="muted">Role access matrix</span>
          </Link>
        </div>
      </section>

      <AdminQuickGrid items={adminQuickLinks} />

      <section className="admin-panel glass mt-4">
        <div className="admin-header" style={{ marginBottom: 12 }}>
          <h2>My Recent Activity</h2>
          <Link href="/admin/audit" className="btn btn-ghost btn-sm">View full audit log</Link>
        </div>
        {!data?.recentActivity?.length ? (
          <p className="muted">No recorded actions yet.</p>
        ) : (
          <ul className="admin-rank-list">
            {data.recentActivity.map((a) => (
              <li key={a.id}>
                <span>{a.action}{a.target ? ` → ${a.target.slice(0, 8)}…` : ''}</span>
                <span className="muted">{new Date(a.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
