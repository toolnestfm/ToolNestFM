'use client';

import { useCallback, useEffect, useState } from 'react';
import { useUI } from '@/components/GlobalUI';

interface KeyRow {
  id: string;
  name: string;
  prefix: string;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export default function ApiKeysPage() {
  const { toast } = useUI();
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [name, setName] = useState('');
  const [newKey, setNewKey] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/keys');
      const json = (await res.json()) as { success: boolean; data?: { keys: KeyRow[] }; error?: string | null };
      if (!json.success) throw new Error(json.error || 'Could not load keys');
      setKeys(json.data?.keys ?? []);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not load keys', 'error');
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  const create = async () => {
    if (!name.trim()) { toast('Enter a key name', 'error'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const json = (await res.json()) as { success: boolean; data?: { key: string }; error?: string | null };
      if (!json.success || !json.data?.key) throw new Error(json.error || 'Could not create key');
      setNewKey(json.data.key);
      setName('');
      void load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not create key', 'error');
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    if (!confirm('Revoke this key? Apps using it will stop working immediately.')) return;
    try {
      const res = await fetch(`/api/keys?id=${id}`, { method: 'DELETE' });
      const json = (await res.json()) as { success: boolean; error?: string | null };
      if (!json.success) throw new Error(json.error || 'Could not revoke key');
      toast('Key revoked', 'success');
      void load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not revoke key', 'error');
    }
  };

  const curlExample = `curl -X POST https://toolnestfm.com/api/v1/chat \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"messages":[{"role":"user","content":"Hello!"}]}'`;

  return (
    <div>
      <h1 className="dash-title">API Keys</h1>
      <p className="muted mb-6">Use the ToolNest API in your own apps. Each call costs 1 credit — check your balance on the Credits page.</p>

      {newKey && (
        <div className="glass settings-block mb-4" style={{ borderColor: 'var(--success-green, #22C55E)' }}>
          <h3>🎉 Your new API key — copy it now, it won&apos;t be shown again</h3>
          <code style={{ display: 'block', padding: '12px', wordBreak: 'break-all', userSelect: 'all' }}>{newKey}</code>
          <button
            className="btn btn-primary btn-sm mt-2"
            onClick={() => { void navigator.clipboard.writeText(newKey); toast('Copied!', 'success'); }}
          >
            Copy key
          </button>
          <button className="btn btn-ghost btn-sm mt-2" onClick={() => setNewKey('')} style={{ marginLeft: 8 }}>Done</button>
        </div>
      )}

      <div className="glass settings-block mb-4">
        <h3>Create a key</h3>
        <div className="field mb-4">
          <label htmlFor="key-name">Key name</label>
          <input
            id="key-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. My App"
            onKeyDown={(e) => e.key === 'Enter' && void create()}
          />
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => void create()} disabled={busy}>
          {busy ? 'Creating…' : 'Generate API key'}
        </button>
        <p className="muted mt-2" style={{ fontSize: 13 }}>Maximum 5 active keys.</p>
      </div>

      <div className="glass settings-block mb-4">
        <h3>Your keys</h3>
        {keys.length === 0 ? (
          <p className="muted">No API keys yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px' }}>Name</th>
                  <th style={{ padding: '10px 12px' }}>Key</th>
                  <th style={{ padding: '10px 12px' }}>Last used</th>
                  <th style={{ padding: '10px 12px' }}>Status</th>
                  <th style={{ padding: '10px 12px' }} />
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id} style={{ borderTop: '1px solid var(--border-subtle, #2A2A3C)' }}>
                    <td style={{ padding: '10px 12px' }}><b>{k.name}</b></td>
                    <td style={{ padding: '10px 12px' }}><code>{k.prefix}</code></td>
                    <td style={{ padding: '10px 12px' }} className="muted">
                      {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : 'Never'}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {k.revoked_at ? <span className="muted">Revoked</span> : <span style={{ color: 'var(--success-green, #22C55E)' }}>Active</span>}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {!k.revoked_at && (
                        <button className="btn btn-ghost btn-sm" onClick={() => void revoke(k.id)}>Revoke</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="glass settings-block">
        <h3>Quick start</h3>
        <p className="muted mb-2">
          AI: /api/v1/chat, /summarize, /translate, /write (1 credit each) · Free: /qr, /hash, /uuid, /me, /usage —{' '}
          <a href="/developers">full API documentation →</a>
        </p>
        <pre style={{ overflowX: 'auto', padding: 12, fontSize: 13 }}><code>{curlExample}</code></pre>
      </div>
    </div>
  );
}
