import { apiErr, apiOk } from '@/lib/api-response';
import { profileToUser, type ProfileRow } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { createRouteHandlerClient } from '@/lib/supabase/route-handler';
import { getSupabaseEnv } from '@/lib/supabase/env';

export const dynamic = 'force-dynamic';

const PROFILE_FIELDS = 'id, full_name, avatar_url, plan, role, tools_used_today, is_banned, storage_used_mb';

async function loadProfile(userId: string) {
  const admin = createAdminClient();
  if (admin) {
    const { data } = await admin.from('profiles').select(PROFILE_FIELDS).eq('id', userId).maybeSingle();
    if (data) return data;
  }

  const { supabase } = await createRouteHandlerClient();
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_FIELDS)
    .eq('id', userId)
    .maybeSingle();

  if (data) return data;

  if (error) {
    const { data: legacy } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, plan, role, tools_used_today')
      .eq('id', userId)
      .maybeSingle();
    return legacy ? { ...legacy, is_banned: false, storage_used_mb: 0 } : null;
  }

  return null;
}

/** GET /api/me — signed-in user profile with authoritative role from DB. */
export async function GET() {
  if (!getSupabaseEnv()) return apiErr('Auth not configured', 503);

  const { supabase } = await createRouteHandlerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return apiErr('Unauthorized', 401);

  const row = await loadProfile(user.id);

  if ((row as { is_banned?: boolean } | null)?.is_banned) {
    await supabase.auth.signOut();
    return apiErr('Account suspended', 403);
  }

  if (row) {
    const storageUsedMb = (row as { storage_used_mb?: number }).storage_used_mb ?? 0;
    return apiOk({
      user: profileToUser(row as ProfileRow, user.email, storageUsedMb),
    });
  }

  return apiOk({
    user: profileToUser(
      {
        id: user.id,
        full_name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
        avatar_url: user.user_metadata?.avatar_url ?? null,
        plan: 'FREE',
        role: 'USER',
        tools_used_today: 0,
      },
      user.email,
    ),
  });
}
