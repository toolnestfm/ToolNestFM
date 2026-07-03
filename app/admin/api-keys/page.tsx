'use client';

import { useState } from 'react';
import { AdminPageHeader } from '@/components/admin/AdminPage';
import { useUI } from '@/components/GlobalUI';
import { useAdminSettings } from '@/lib/use-admin-settings';

export default function AdminApiKeysPage() {
  const { toast } = useUI();
  const { settings, loading, save } = useAdminSettings();
  const [name, setName] = useState('');

  if (loading || !settings) return <div className="spinner" style={{ margin: 60 }} />;

  const generate = () => {
    if (!name.trim()) { toast('Enter a key name', 'error'); return; }
    const prefix = `tn_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const entry = { id: crypto.randomUUID(), name: name.trim(), prefix: prefix.slice(0, 12) + '…', created_at: new Date().toISOString() };
    void save({ api_keys_meta: [...settings.api_keys_meta, entry] });
    setName('');
    toast(`Key created: ${prefix} (copy from server logs in production)`, 'success');
  };

  return (
    <div>
      <AdminPageHeader title="API Keys" subtitle="Pro API key management (metadata store — wire to DB in production)" />
      <div className="admin-toolbar glass">
        <input className="admin-input" placeholder="Key name…" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="button" className="btn btn-primary btn-sm" onClick={generate}>Generate Key</button>
      </div>
      <div className="admin-panel glass">
        {settings.api_keys_meta.length === 0 ? (
          <p className="muted">No API keys yet.</p>
        ) : (
          <table className="admin-table">
            <thead><tr><th>Name</th><th>Prefix</th><th>Created</th></tr></thead>
            <tbody>
              {settings.api_keys_meta.map((k) => (
                <tr key={k.id}><td>{k.name}</td><td className="mono">{k.prefix}</td><td className="muted">{new Date(k.created_at).toLocaleString()}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
