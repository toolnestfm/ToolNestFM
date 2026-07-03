import type { SupabaseClient } from '@supabase/supabase-js';
import { apiErr } from '@/lib/api-response';
import { createAdminClient } from '@/lib/supabase/admin';
import { createRouteHandlerClient } from '@/lib/supabase/route-handler';

export type AdminRole = 'USER' | 'ADMIN' | 'SUPER_ADMIN';

export function isAdminRole(role: string | null | undefined): boolean {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

type AdminContext = {
  userId: string;
  role: string;
  admin: SupabaseClient;
};

type RequireAdminResult =
  | { ok: true; ctx: AdminContext }
  | { ok: false; response: Response };

export async function requireAdmin(): Promise<RequireAdminResult> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, response: apiErr('Admin backend not configured', 503) };

  const { supabase } = await createRouteHandlerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, response: apiErr('Unauthorized', 401) };

  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || !isAdminRole(profile.role)) {
    return { ok: false, response: apiErr('Forbidden — admin access required', 403) };
  }

  return { ok: true, ctx: { userId: user.id, role: profile.role, admin } };
}

export async function logAdminAction(
  admin: SupabaseClient,
  actorId: string,
  action: string,
  target?: string,
  meta?: Record<string, unknown>,
): Promise<void> {
  try {
    await admin.from('admin_audit_log').insert({
      actor_id: actorId,
      action,
      target: target ?? null,
      meta: meta ?? {},
    });
  } catch {
    /* audit log is best-effort */
  }
}
