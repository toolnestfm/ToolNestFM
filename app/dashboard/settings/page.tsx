'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useUI } from '@/components/GlobalUI';
import { useAuth } from '@/components/providers/AuthProvider';
import { createClient } from '@/lib/supabase/client';

export default function SettingsPage() {
  const router = useRouter();
  const { toast } = useUI();
  const { user, refresh, signOut } = useAuth();
  const [name, setName] = useState('');

  useEffect(() => {
    if (user) setName(user.fullName);
  }, [user]);

  const save = async () => {
    if (!user || !name.trim()) return;
    const supabase = createClient();
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: name.trim(), updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (error) {
      toast(error.message, 'error');
      return;
    }
    await refresh();
    toast('Profile updated', 'success');
  };

  const logout = async () => {
    await signOut();
    toast('Signed out', 'info');
    router.push('/');
    router.refresh();
  };

  const deleteAccount = async () => {
    if (!confirm('Delete your account permanently? All your data (profile, history) will be erased. This cannot be undone.')) return;
    try {
      const res = await fetch('/api/account/delete', { method: 'POST' });
      const json = (await res.json()) as { success: boolean; error?: string | null };
      if (!json.success) throw new Error(json.error || 'Could not delete account');
      await signOut();
      toast('Your account has been permanently deleted.', 'success');
      router.push('/');
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not delete account', 'error');
    }
  };

  return (
    <div>
      <h1 className="dash-title">Settings</h1>
      <div className="glass settings-block">
        <h3>Profile</h3>
        <div className="field mb-4">
          <label>Full name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field mb-4">
          <label>Email</label>
          <input value={user?.email ?? ''} disabled />
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => void save()}>Save changes</button>
      </div>
      <div className="glass settings-block mt-4">
        <h3>Session</h3>
        <button className="btn btn-ghost btn-sm" onClick={() => void logout()}>Sign out</button>
      </div>
      <div className="glass settings-block mt-4 danger-zone">
        <h3>Danger zone</h3>
        <button className="btn btn-sm" style={{ borderColor: 'var(--danger-red)', color: 'var(--danger-red)' }} onClick={() => void deleteAccount()}>Delete account</button>
      </div>
    </div>
  );
}
