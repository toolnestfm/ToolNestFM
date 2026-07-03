'use client';

import { useCallback, useEffect, useState } from 'react';
import { useUI } from '@/components/GlobalUI';
import { adminFetch } from '@/lib/admin-client';

type Message = {
  id: string;
  name: string;
  email: string;
  message: string;
  status: string;
  admin_note: string | null;
  created_at: string;
};

export default function AdminContactPage() {
  const { toast } = useUI();
  const [messages, setMessages] = useState<Message[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [status, setStatus] = useState('new');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Message | null>(null);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (status) params.set('status', status);
    try {
      const data = await adminFetch<{ messages: Message[]; pages: number }>(`/api/admin/contact?${params}`);
      setMessages(data.messages);
      setPages(data.pages);
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => { void load(); }, [load]);

  const update = async (id: string, patch: { status?: string; admin_note?: string }) => {
    try {
      await adminFetch('/api/admin/contact', { method: 'PATCH', body: JSON.stringify({ id, ...patch }) });
      toast('Updated', 'success');
      setSelected(null);
      void load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed', 'error');
    }
  };

  return (
    <div>
      <header className="admin-header">
        <h1 className="admin-title">Contact Messages</h1>
        <p className="muted">Messages from the contact form</p>
      </header>

      <div className="admin-toolbar glass">
        <select className="admin-select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All</option>
          <option value="new">New</option>
          <option value="read">Read</option>
          <option value="replied">Replied</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      <div className="admin-split">
        <div className="admin-panel glass admin-inbox-list">
          {loading ? <div className="spinner" style={{ margin: '40px auto' }} /> : messages.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`admin-inbox-item ${selected?.id === m.id ? 'active' : ''}`}
              onClick={() => { setSelected(m); setNote(m.admin_note ?? ''); }}
            >
              <b>{m.name}</b>
              <span className="muted">{m.email}</span>
              <p>{m.message.slice(0, 72)}…</p>
              <span className={`status-pill status-${m.status}`}>{m.status}</span>
            </button>
          ))}
        </div>

        <div className="admin-panel glass admin-inbox-detail">
          {selected ? (
            <>
              <h2>{selected.name}</h2>
              <p className="muted mb-4"><a href={`mailto:${selected.email}`}>{selected.email}</a> · {new Date(selected.created_at).toLocaleString()}</p>
              <p className="admin-message-body">{selected.message}</p>
              <div className="field mt-4">
                <label>Admin note</label>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
              </div>
              <div className="admin-actions-row">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => void update(selected.id, { status: 'read' })}>Mark read</button>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => void update(selected.id, { status: 'replied', admin_note: note })}>Mark replied</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => void update(selected.id, { status: 'archived', admin_note: note })}>Archive</button>
              </div>
            </>
          ) : (
            <p className="muted" style={{ padding: 40, textAlign: 'center' }}>Select a message</p>
          )}
        </div>
      </div>

      <div className="admin-pagination">
        <button type="button" className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
        <span className="muted">Page {page} / {pages}</span>
        <button type="button" className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
      </div>
    </div>
  );
}
