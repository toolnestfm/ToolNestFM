'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminPageHeader } from '@/components/admin/AdminPage';
import { useUI } from '@/components/GlobalUI';
import { adminFetch } from '@/lib/admin-client';

type KeyRow = {
  id: string;
  user_id: string;
  owner: string;
  name: string;
  prefix: string;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

export default function AdminApiKeysPage() {
  const { toast } = useUI();
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminFetch<{ keys: KeyRow[]; total: number; pages: number }>(
        `/api/admin/keys?page=${page}`,
      );
      setKeys(data.keys);
      setTotal(data.total);
      setPages(data.pages || 1);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Load failed', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, toast]);

  useEffect(() => { void load(); }, [load]);

  const revoke = async (id: string) => {
    if (!confirm('Revoke this key? The owner\'s apps using it will stop working immediately.')) return;
    try {
      await adminFetch(`/api/admin/keys?id=${id}`, { method: 'DELETE' });
      toast('Key revoked', 'success');
      void load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Revoke failed', 'error');
    }
  };

  return (
    <div>
      <AdminPageHeader
        title="API Keys"
        subtitle={`${total.toLocaleString()} keys across all users — users create keys from their dashboard; each API call costs 1 credit`}
      />
      <div className="admin-panel glass">
        {loading ? (
          <div className="spinner" style={{ margin: '40px auto' }} />
        ) : keys.length === 0 ? (
          <p className="muted">No API keys yet. Users can create keys at /dashboard/api-keys.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>Owner</th><th>Name</th><th>Key</th><th>Last used</th><th>Status</th><th>Created</th><th /></tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id}>
                    <td>
                      <b>{k.owner}</b>
                      <div className="muted mono" style={{ fontSize: 11 }}>{k.user_id.slice(0, 8)}…</div>
                    </td>
                    <td>{k.name}</td>
                    <td className="mono">{k.prefix}</td>
                    <td className="muted">{k.last_used_at ? new Date(k.last_used_at).toLocaleString() : 'Never'}</td>
                    <td>{k.revoked_at ? <span className="muted">Revoked</span> : <span style={{ color: 'var(--success-green, #22C55E)' }}>Active</span>}</td>
                    <td className="muted">{new Date(k.created_at).toLocaleDateString()}</td>
                    <td>
                      {!k.revoked_at && (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void revoke(k.id)}>Revoke</button>
                      )}
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
