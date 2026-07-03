import type { SupabaseClient } from '@supabase/supabase-js';
import { defaultAdminSettings, mergeSettings, type AdminSettings } from '@/lib/admin-settings';

const SETTINGS_KEY = 'global';

export async function getAdminSettings(admin: SupabaseClient): Promise<AdminSettings> {
  const { data } = await admin.from('admin_settings').select('value').eq('key', SETTINGS_KEY).maybeSingle();
  if (!data?.value || typeof data.value !== 'object') return defaultAdminSettings;
  return mergeSettings(data.value as Partial<AdminSettings>);
}

export async function saveAdminSettings(
  admin: SupabaseClient,
  userId: string,
  patch: Partial<AdminSettings>,
): Promise<AdminSettings> {
  const current = await getAdminSettings(admin);
  const merged = mergeSettings({ ...current, ...patch });
  const { error } = await admin.from('admin_settings').upsert({
    key: SETTINGS_KEY,
    value: merged,
    updated_at: new Date().toISOString(),
    updated_by: userId,
  });
  if (error) throw new Error(error.message);
  return merged;
}
