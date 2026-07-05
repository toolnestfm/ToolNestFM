import { apiErr, apiOk } from '@/lib/api-response';
import { logAdminAction, requireAdmin, requireSuperAdmin } from '@/lib/admin-auth';
import { isMissingColumnError, normalizeProfileRow, PROFILE_SELECT_FALLBACKS } from '@/lib/admin-users';

export const dynamic = 'force-dynamic';

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: RouteCtx) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { admin } = auth.ctx;
  const { id } = await ctx.params;

  // Progressive select so the page works before 06_user_admin.sql has run.
  let profileRaw: Record<string, unknown> | null = null;
  for (const select of PROFILE_SELECT_FALLBACKS) {
    const { data, error } = await admin.from('profiles').select(select).eq('id', id).maybeSingle();
    if (!error) { profileRaw = data as Record<string, unknown> | null; break; }
    if (!isMissingColumnError(error.message)) return apiErr(error.message, 500);
  }
  if (!profileRaw) return apiErr('User not found', 404);
  const profile = normalizeProfileRow(profileRaw);

  const { data: authData, error: authErr } = await admin.auth.admin.getUserById(id);
  if (authErr || !authData?.user) return apiErr('Auth user not found', 404);

  const authUser = authData.user;
  const email = profile.email ?? authUser.email ?? '—';

  const [
    jobsRes,
    ledgerRes,
    keysRes,
    notifRes,
    auditRes,
    jobTotalRes,
    jobFailedRes,
  ] = await Promise.all([
    admin.from('jobs').select('id, tool_slug, tool_name, category, status, created_at', { count: 'exact' })
      .eq('user_id', id).order('created_at', { ascending: false }).limit(15),
    admin.from('credit_ledger').select('id, amount, balance_after, reason, actor_id, meta, created_at', { count: 'exact' })
      .eq('user_id', id).order('created_at', { ascending: false }).limit(15),
    admin.from('api_keys').select('id, name, prefix, last_used_at, revoked_at, created_at')
      .eq('user_id', id).order('created_at', { ascending: false }),
    admin.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', id),
    admin.from('admin_audit_log').select('id, actor_id, action, meta, created_at')
      .eq('target', id).order('created_at', { ascending: false }).limit(10),
    admin.from('jobs').select('*', { count: 'exact', head: true }).eq('user_id', id),
    admin.from('jobs').select('*', { count: 'exact', head: true }).eq('user_id', id).eq('status', 'failed'),
  ]);

  const jobTotal = jobTotalRes.count ?? 0;
  const jobFailed = jobFailedRes.count ?? 0;
  const jobStats = { total: jobTotal, failed: jobFailed, completed: jobTotal - jobFailed };

  const providers = authUser.identities?.map((i) => i.provider) ?? [];

  return apiOk({
    profile: { ...profile, email, is_banned: profile.is_banned ?? false },
    auth: {
      email,
      email_confirmed: !!authUser.email_confirmed_at,
      last_sign_in_at: authUser.last_sign_in_at ?? null,
      created_at: authUser.created_at,
      banned_until: authUser.banned_until ?? null,
      providers,
    },
    stats: {
      jobs: jobStats,
      credits: profile.credits ?? 0,
      tools_used_today: profile.tools_used_today ?? 0,
      notifications: notifRes.count ?? 0,
      api_keys: (keysRes.data ?? []).filter((k) => !k.revoked_at).length,
    },
    recent_jobs: jobsRes.data ?? [],
    credit_ledger: ledgerRes.data ?? [],
    api_keys: keysRes.data ?? [],
    audit_logs: auditRes.data ?? [],
  });
}

export async function PATCH(req: Request, ctx: RouteCtx) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { admin, userId: actorId } = auth.ctx;
  const { id } = await ctx.params;

  let body: {
    plan?: string;
    role?: string;
    full_name?: string;
    admin_notes?: string;
    daily_tool_limit?: number | null;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return apiErr('Invalid body', 400);
  }

  if (id === actorId && body.role) {
    return apiErr('You cannot change your own role', 400);
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.plan && ['FREE', 'PRO', 'ENTERPRISE'].includes(body.plan.toUpperCase())) {
    updates.plan = body.plan.toUpperCase();
  }
  if (body.role && ['USER', 'ADMIN', 'SUPER_ADMIN'].includes(body.role.toUpperCase())) {
    if (body.role.toUpperCase() === 'SUPER_ADMIN' && auth.ctx.role !== 'SUPER_ADMIN') {
      return apiErr('Only super admins can assign SUPER_ADMIN', 403);
    }
    updates.role = body.role.toUpperCase();
  }
  if (typeof body.full_name === 'string') {
    updates.full_name = body.full_name.trim().slice(0, 120) || null;
  }
  if (typeof body.admin_notes === 'string') {
    updates.admin_notes = body.admin_notes.trim().slice(0, 2000) || null;
  }
  if (body.daily_tool_limit === null) {
    updates.daily_tool_limit = null;
  } else if (typeof body.daily_tool_limit === 'number' && body.daily_tool_limit >= 0 && body.daily_tool_limit <= 10000) {
    updates.daily_tool_limit = Math.floor(body.daily_tool_limit);
  }

  if (Object.keys(updates).length === 1) return apiErr('Nothing to update', 400);

  const { error } = await admin.from('profiles').update(updates).eq('id', id);
  if (error) return apiErr(error.message, 500);

  await logAdminAction(admin, actorId, 'user.update', id, updates);
  return apiOk({ updated: true });
}

export async function DELETE(_req: Request, ctx: RouteCtx) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;
  const { admin, userId: actorId } = auth.ctx;
  const { id } = await ctx.params;

  if (id === actorId) return apiErr('You cannot delete your own account from admin', 400);

  const { data: target } = await admin.from('profiles').select('role, email').eq('id', id).maybeSingle();
  if (!target) return apiErr('User not found', 404);
  if (target.role === 'SUPER_ADMIN') {
    return apiErr('Cannot delete a super admin account', 403);
  }

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return apiErr(error.message, 500);

  await logAdminAction(admin, actorId, 'user.delete', id, { email: target.email });
  return apiOk({ deleted: true });
}
