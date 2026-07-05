import type { User } from '@/lib/auth';
import { createClient } from '@/lib/supabase/client';
import { profileToUser, type ProfileRow } from '@/lib/auth';

export async function fetchCurrentUser(): Promise<User | null> {
  const supabase = createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser?.email) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, plan, role, tools_used_today, is_banned')
    .eq('id', authUser.id)
    .maybeSingle();

  if (profile?.is_banned) {
    await supabase.auth.signOut();
    return null;
  }

  if (profile) {
    return profileToUser(profile as ProfileRow, authUser.email);
  }

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
