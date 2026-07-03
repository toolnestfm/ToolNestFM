'use client';

import { useCallback, useEffect, useState } from 'react';
import { useUI } from '@/components/GlobalUI';
import { adminFetch } from '@/lib/admin-client';
import type { AdminSettings } from '@/lib/admin-settings';

export function useAdminSettings() {
  const { toast } = useUI();
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminFetch<AdminSettings>('/api/admin/settings');
      setSettings(data);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to load settings', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  const save = async (patch: Partial<AdminSettings>) => {
    const data = await adminFetch<AdminSettings>('/api/admin/settings', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    setSettings(data);
    toast('Settings saved', 'success');
    return data;
  };

  return { settings, loading, save, reload: load };
}
