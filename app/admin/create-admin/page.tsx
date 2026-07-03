'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminFieldRow, AdminPageHeader } from '@/components/admin/AdminPage';
import { useUI } from '@/components/GlobalUI';
import { useAuth } from '@/components/providers/AuthProvider';
import { adminFetch } from '@/lib/admin-client';

export default function CreateAdminPage() {
  const { toast } = useUI();
  const { user } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '', full_name: '', role: 'ADMIN' });
  const [busy, setBusy] = useState(false);

  if (user?.role !== 'super_admin') {
    return (
      <div className="admin-alert error">
        Only <b>SUPER_ADMIN</b> can create new admin accounts. Ask a super admin or promote your account in Supabase.
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await adminFetch('/api/admin/team', {
        method: 'POST',
        body: JSON.stringify({ action: 'create', ...form }),
      });
      toast('Admin account created', 'success');
      router.push('/admin/team');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <AdminPageHeader title="Create Admin" subtitle="Create a new email + password admin account" />
      <form className="admin-panel glass" style={{ maxWidth: 480 }} onSubmit={(e) => void submit(e)}>
        <AdminFieldRow label="Email">
          <input type="email" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
        </AdminFieldRow>
        <AdminFieldRow label="Password (8+ chars)">
          <input type="password" required minLength={8} value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
        </AdminFieldRow>
        <AdminFieldRow label="Full name">
          <input value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
        </AdminFieldRow>
        <AdminFieldRow label="Role">
          <select className="admin-select w-full" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
            <option value="ADMIN">ADMIN</option>
            <option value="SUPER_ADMIN">SUPER_ADMIN</option>
          </select>
        </AdminFieldRow>
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create Admin'}</button>
      </form>
    </div>
  );
}
