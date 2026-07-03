'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminPageHeader } from '@/components/admin/AdminPage';
import { useUI } from '@/components/GlobalUI';
import { adminFetch } from '@/lib/admin-client';

type ToolRow = { slug: string; name: string; category: string; description: string; enabled: boolean };

export default function AdminToolsPage() {
  const { toast } = useUI();
  const [tools, setTools] = useState<ToolRow[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminFetch<{ tools: ToolRow[] }>('/api/admin/tools');
      setTools(data.tools);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const toggle = async (slug: string, enabled: boolean) => {
    try {
      await adminFetch('/api/admin/tools', { method: 'PATCH', body: JSON.stringify({ slug, enabled }) });
      setTools((prev) => prev.map((t) => (t.slug === slug ? { ...t, enabled } : t)));
      toast(enabled ? 'Tool enabled' : 'Tool disabled', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed', 'error');
    }
  };

  const filtered = tools.filter((t) =>
    !q || t.name.toLowerCase().includes(q.toLowerCase()) || t.slug.includes(q.toLowerCase()),
  );

  return (
    <div>
      <AdminPageHeader title="Tools" subtitle="Enable or disable tools across the platform" />
      <div className="admin-toolbar glass">
        <input className="admin-input" placeholder="Search tools…" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="muted">{filtered.filter((t) => !t.enabled).length} disabled</span>
      </div>
      <div className="admin-panel glass">
        {loading ? <div className="spinner" style={{ margin: 40 }} /> : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Tool</th><th>Category</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.slug}>
                    <td><b>{t.name}</b><div className="muted" style={{ fontSize: 11 }}>{t.slug}</div></td>
                    <td><span className="pill pill-sm">{t.category}</span></td>
                    <td><span className={`status-pill ${t.enabled ? 'status-completed' : 'status-failed'}`}>{t.enabled ? 'Enabled' : 'Disabled'}</span></td>
                    <td>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => void toggle(t.slug, !t.enabled)}>
                        {t.enabled ? 'Disable' : 'Enable'}
                      </button>
                    </td>
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
