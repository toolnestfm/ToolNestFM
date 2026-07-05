'use client';

import { useState } from 'react';
import AdminModal from '@/components/admin/AdminModal';

export function CreditsModal({
  open,
  userName,
  onClose,
  onSubmit,
}: {
  open: boolean;
  userName: string;
  onClose: () => void;
  onSubmit: (amount: number, note: string) => Promise<void>;
}) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const n = Number(amount);
    if (!Number.isInteger(n) || n === 0) return;
    setBusy(true);
    try {
      await onSubmit(n, note);
      setAmount('');
      setNote('');
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminModal
      open={open}
      title="Adjust credits"
      subtitle={`Grant or deduct credits for ${userName}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => void submit()} disabled={busy}>
            {busy ? 'Saving…' : 'Apply'}
          </button>
        </>
      }
    >
      <div className="field mb-4">
        <label>Amount</label>
        <input
          className="admin-input w-full"
          type="number"
          placeholder="e.g. 100 or -50"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>Positive to grant, negative to deduct (max ±1,000,000)</p>
      </div>
      <div className="field">
        <label>Note (optional)</label>
        <input
          className="admin-input w-full"
          placeholder="Reason for adjustment…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
    </AdminModal>
  );
}

export function EditUserModal({
  open,
  initial,
  onClose,
  onSubmit,
}: {
  open: boolean;
  initial: { full_name: string; plan: string; role: string; admin_notes: string; daily_tool_limit: string };
  onClose: () => void;
  onSubmit: (data: {
    full_name: string;
    plan: string;
    role: string;
    admin_notes: string;
    daily_tool_limit: number | null;
  }) => Promise<void>;
}) {
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const limit = form.daily_tool_limit.trim();
      await onSubmit({
        ...form,
        daily_tool_limit: limit === '' ? null : Number(limit),
      });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminModal
      open={open}
      title="Edit user"
      subtitle="Update plan, role, and admin settings"
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => void submit()} disabled={busy}>
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </>
      }
    >
      <div className="admin-form-grid">
        <div className="field">
          <label>Display name</label>
          <input className="admin-input w-full" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        </div>
        <div className="field">
          <label>Plan</label>
          <select className="admin-select w-full" value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}>
            <option value="FREE">FREE</option>
            <option value="PRO">PRO</option>
            <option value="ENTERPRISE">ENTERPRISE</option>
          </select>
        </div>
        <div className="field">
          <label>Role</label>
          <select className="admin-select w-full" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="USER">USER</option>
            <option value="ADMIN">ADMIN</option>
            <option value="SUPER_ADMIN">SUPER_ADMIN</option>
          </select>
        </div>
        <div className="field">
          <label>Daily tool limit override</label>
          <input
            className="admin-input w-full"
            type="number"
            min={0}
            placeholder="Leave empty for plan default"
            value={form.daily_tool_limit}
            onChange={(e) => setForm({ ...form, daily_tool_limit: e.target.value })}
          />
        </div>
        <div className="field admin-form-span-2">
          <label>Admin notes (internal)</label>
          <textarea
            className="admin-textarea w-full"
            rows={3}
            placeholder="Private notes visible only to admins…"
            value={form.admin_notes}
            onChange={(e) => setForm({ ...form, admin_notes: e.target.value })}
          />
        </div>
      </div>
    </AdminModal>
  );
}

export function BanModal({
  open,
  userName,
  isBanned,
  onClose,
  onSubmit,
}: {
  open: boolean;
  userName: string;
  isBanned: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await onSubmit(reason);
      setReason('');
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminModal
      open={open}
      title={isBanned ? 'Unban user' : 'Ban user'}
      subtitle={isBanned ? `Restore access for ${userName}` : `Block ${userName} from signing in and using tools`}
      onClose={onClose}
      danger={!isBanned}
      footer={
        <>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} disabled={busy}>Cancel</button>
          <button
            type="button"
            className={`btn btn-sm ${isBanned ? 'btn-primary' : 'btn-danger'}`}
            onClick={() => void submit()}
            disabled={busy}
          >
            {busy ? 'Working…' : isBanned ? 'Unban user' : 'Ban user'}
          </button>
        </>
      }
    >
      {!isBanned && (
        <div className="field">
          <label>Ban reason</label>
          <textarea
            className="admin-textarea w-full"
            rows={3}
            placeholder="e.g. Terms violation, spam, abuse…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
      )}
      {isBanned && <p className="muted">This will restore the user&apos;s login and tool access immediately.</p>}
    </AdminModal>
  );
}

export function NotifyModal({
  open,
  userName,
  onClose,
  onSubmit,
}: {
  open: boolean;
  userName: string;
  onClose: () => void;
  onSubmit: (title: string, body: string, href: string) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [href, setHref] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await onSubmit(title.trim(), body.trim(), href.trim());
      setTitle('');
      setBody('');
      setHref('');
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminModal
      open={open}
      title="Send notification"
      subtitle={`In-app notification for ${userName}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => void submit()} disabled={busy || !title.trim()}>
            {busy ? 'Sending…' : 'Send'}
          </button>
        </>
      }
    >
      <div className="field mb-4">
        <label>Title</label>
        <input className="admin-input w-full" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Notification title" />
      </div>
      <div className="field mb-4">
        <label>Message</label>
        <textarea className="admin-textarea w-full" rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Optional message body…" />
      </div>
      <div className="field">
        <label>Link (optional)</label>
        <input className="admin-input w-full" value={href} onChange={(e) => setHref(e.target.value)} placeholder="/dashboard or /tools/…" />
      </div>
    </AdminModal>
  );
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  danger,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminModal
      open={open}
      title={title}
      subtitle={message}
      onClose={onClose}
      danger={danger}
      footer={
        <>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} disabled={busy}>Cancel</button>
          <button
            type="button"
            className={`btn btn-sm ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => void confirm()}
            disabled={busy}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      {danger && <div className="admin-alert error">This action cannot be undone.</div>}
    </AdminModal>
  );
}
