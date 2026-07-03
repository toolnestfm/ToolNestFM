import type { SupabaseClient } from '@supabase/supabase-js';
import { apiErr } from '@/lib/api-response';
import { createAdminClient } from '@/lib/supabase/admin';
import { createRouteHandlerClient } from '@/lib/supabase/route-handler';

export type AdminRole = 'USER' | 'ADMIN' | 'SUPER_ADMIN';

const AUDIT_FALLBACK_EVENT = '__admin_audit__';

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
  const { error } = await admin.from('admin_audit_log').insert({
    actor_id: actorId,
    action,
    target: target ?? null,
    meta: meta ?? {},
  });

  if (!error) return;

  // Fallback when admin_audit_log table is not migrated yet
  await admin.from('analytics_events').insert({
    event: AUDIT_FALLBACK_EVENT,
    user_id: actorId,
    props: { action, target: target ?? null, meta: meta ?? {}, actor_id: actorId },
  });
}

export async function listAdminAuditLogs(
  admin: SupabaseClient,
  opts: { page: number; limit: number; actorId?: string },
) {
  const from = (opts.page - 1) * opts.limit;
  const to = from + opts.limit - 1;

  let query = admin
    .from('admin_audit_log')
    .select('id, actor_id, action, target, meta, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (opts.actorId) query = query.eq('actor_id', opts.actorId);

  const { data, error, count } = await query;
  if (!error) {
    return { logs: data ?? [], total: count ?? 0, page: opts.page, pages: Math.ceil((count ?? 0) / opts.limit) };
  }

  // Fallback: analytics_events
  let fb = admin
    .from('analytics_events')
    .select('id, user_id, props, created_at', { count: 'exact' })
    .eq('event', AUDIT_FALLBACK_EVENT)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (opts.actorId) fb = fb.eq('user_id', opts.actorId);

  const { data: rows, count: fbCount } = await fb;
  const logs = (rows ?? []).map((r) => {
    const props = (r.props ?? {}) as Record<string, unknown>;
    return {
      id: r.id as string,
      actor_id: (props.actor_id as string) || (r.user_id as string) || '',
      action: (props.action as string) || 'unknown',
      target: (props.target as string) || null,
      meta: (props.meta as Record<string, unknown>) || {},
      created_at: r.created_at as string,
    };
  });

  return {
    logs,
    total: fbCount ?? 0,
    page: opts.page,
    pages: Math.ceil((fbCount ?? 0) / opts.limit),
  };
}
