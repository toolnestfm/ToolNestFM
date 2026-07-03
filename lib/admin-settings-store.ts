import type { SupabaseClient } from '@supabase/supabase-js';
import { defaultAdminSettings, mergeSettings, type AdminSettings } from '@/lib/admin-settings';

const SETTINGS_KEY = 'global';
const FALLBACK_EVENT = '__admin_settings__';

export async function getAdminSettings(admin: SupabaseClient): Promise<AdminSettings> {
  const { data, error } = await admin.from('admin_settings').select('value').eq('key', SETTINGS_KEY).maybeSingle();
  if (!error && data?.value && typeof data.value === 'object') {
    return mergeSettings(data.value as Partial<AdminSettings>);
  }

  // Fallback when admin_settings table is not migrated yet
  const { data: rows } = await admin
    .from('analytics_events')
    .select('props')
    .eq('event', FALLBACK_EVENT)
    .order('created_at', { ascending: false })
    .limit(1);

  const props = rows?.[0]?.props;
  if (props && typeof props === 'object') {
    return mergeSettings(props as Partial<AdminSettings>);
  }

  return defaultAdminSettings;
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

  if (!error) return merged;

  // Fallback: store latest settings snapshot in analytics_events
  await admin.from('analytics_events').insert({
    event: FALLBACK_EVENT,
    props: merged,
    user_id: userId,
  });

  return merged;
}
