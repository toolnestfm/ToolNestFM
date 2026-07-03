'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminPageHeader } from '@/components/admin/AdminPage';
import { useUI } from '@/components/GlobalUI';
import { useAuth } from '@/components/providers/AuthProvider';
import { adminFetch } from '@/lib/admin-client';

type TeamMember = {
  id: string;
  full_name: string | null;
  email: string;
  plan: string;
  role: string;
  created_at: string;
};

const permissions = [
  { role: 'USER', users: false, settings: false, team: false, createAdmin: false },
  { role: 'ADMIN', users: true, settings: true, team: true, createAdmin: false },
  { role: 'SUPER_ADMIN', users: true, settings: true, team: true, createAdmin: true },
];

export default function AdminTeamPage() {
  const { toast } = useUI();
  const { user } = useAuth();
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [promoteId, setPromoteId] = useState('');
  const [promoteRole, setPromoteRole] = useState('ADMIN');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminFetch<{ team: TeamMember[] }>('/api/admin/team');
      setTeam(data.team);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const promote = async () => {
    if (!promoteId.trim()) { toast('Enter user UUID', 'error'); return; }
    try {
      await adminFetch('/api/admin/team', {
        method: 'POST',
        body: JSON.stringify({ action: 'promote', user_id: promoteId.trim(), role: promoteRole }),
      });
      toast('User promoted', 'success');
      setPromoteId('');
      void load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed', 'error');
    }
  };

  return (
    <div>
      <AdminPageHeader title="Admin Team" subtitle="Manage administrators and role permissions" />

      <section className="admin-panel glass mb-4">
        <h2>Team members</h2>
        {loading ? <div className="spinner" style={{ margin: 30 }} /> : (
          <table className="admin-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Plan</th><th>Joined</th></tr></thead>
            <tbody>
              {team.map((m) => (
                <tr key={m.id}>
                  <td><b>{m.full_name}</b>{m.id === user?.id && <span className="pill pill-sm"> you</span>}</td>
                  <td>{m.email}</td>
                  <td><span className="pill pill-admin">{m.role}</span></td>
                  <td>{m.plan}</td>
                  <td className="muted">{new Date(m.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="admin-panel glass mb-4">
        <h2>Promote existing user</h2>
        <div className="admin-toolbar" style={{ padding: 0, background: 'none', marginTop: 12 }}>
          <input className="admin-input" placeholder="User UUID…" value={promoteId} onChange={(e) => setPromoteId(e.target.value)} />
          <select className="admin-select" value={promoteRole} onChange={(e) => setPromoteRole(e.target.value)}>
            <option value="ADMIN">ADMIN</option>
            <option value="SUPER_ADMIN">SUPER_ADMIN</option>
            <option value="USER">USER (demote)</option>
          </select>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => void promote()}>Promote</button>
        </div>
      </section>

      <section className="admin-panel glass">
        <h2>Permissions matrix</h2>
        <table className="admin-table">
          <thead><tr><th>Role</th><th>Users</th><th>Settings</th><th>Team</th><th>Create Admin</th></tr></thead>
          <tbody>
            {permissions.map((p) => (
              <tr key={p.role}>
                <td><span className="pill pill-admin">{p.role}</span></td>
                <td>{p.users ? '✓' : '—'}</td>
                <td>{p.settings ? '✓' : '—'}</td>
                <td>{p.team ? '✓' : '—'}</td>
                <td>{p.createAdmin ? '✓' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
