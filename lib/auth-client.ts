import type { User } from '@/lib/auth';
import { profileToUser, type ProfileRow } from '@/lib/auth';
import { createClient } from '@/lib/supabase/client';

export async function fetchCurrentUser(): Promise<User | null> {
  const supabase = createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser?.email) return null;

  try {
    const res = await fetch('/api/me', { cache: 'no-store' });
    if (res.ok) {
      const json = (await res.json()) as { success: boolean; data?: { user: User } };
      if (json.success && json.data?.user) return json.data.user;
    }
  } catch {
    /* fall through */
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, plan, role, tools_used_today, is_banned')
    .eq('id', authUser.id)
    .maybeSingle();

  let row = profile;
  if (error || !row) {
    const { data: legacy } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, plan, role, tools_used_today')
      .eq('id', authUser.id)
      .maybeSingle();
    row = legacy ? { ...legacy, is_banned: false } : null;
  }

  if (row?.is_banned) {
    await supabase.auth.signOut();
    return null;
  }

  if (row) return profileToUser(row as ProfileRow, authUser.email);

  return profileToUser(
    {
      id: authUser.id,
      full_name: authUser.user_metadata?.full_name ?? authUser.user_metadata?.name ?? null,
      avatar_url: authUser.user_metadata?.avatar_url ?? null,
      plan: 'FREE',
      role: 'USER',
      tools_used_today: 0,
    },
    authUser.email,
  );
}

export async function signOut(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
}
