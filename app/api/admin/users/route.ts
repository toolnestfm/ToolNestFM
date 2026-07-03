import { apiErr, apiOk } from '@/lib/api-response';
import { logAdminAction, requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { admin } = auth.ctx;

  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.trim() ?? '';
  const plan = url.searchParams.get('plan') ?? '';
  const role = url.searchParams.get('role') ?? '';
  const page = Math.max(1, Number(url.searchParams.get('page') || 1));
  const limit = 25;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = admin
    .from('profiles')
    .select('id, full_name, avatar_url, plan, role, credits, tools_used_today, stripe_customer_id, stripe_subscription_id, created_at, updated_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (plan) query = query.eq('plan', plan.toUpperCase());
  if (role) query = query.eq('role', role.toUpperCase());
  if (q) query = query.or(`full_name.ilike.%${q}%,id.eq.${q}`);

  const { data, error, count } = await query;
  if (error) return apiErr(error.message, 500);

  const ids = (data ?? []).map((p) => p.id);
  const emails: Record<string, string> = {};
  await Promise.all(
    ids.map(async (id) => {
      const { data: u } = await admin.auth.admin.getUserById(id);
      if (u?.user?.email) emails[id] = u.user.email;
    }),
  );

  const users = (data ?? []).map((p) => ({ ...p, email: emails[p.id] ?? '—' }));

  return apiOk({ users, total: count ?? 0, page, pages: Math.ceil((count ?? 0) / limit) });
}

export async function PATCH(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { admin, userId } = auth.ctx;

  let body: { id?: string; plan?: string; role?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return apiErr('Invalid body', 400);
  }

  if (!body.id) return apiErr('User id required', 400);

  const updates: Record<string, string> = { updated_at: new Date().toISOString() };
  if (body.plan && ['FREE', 'PRO', 'ENTERPRISE'].includes(body.plan.toUpperCase())) {
    updates.plan = body.plan.toUpperCase();
  }
  if (body.role && ['USER', 'ADMIN', 'SUPER_ADMIN'].includes(body.role.toUpperCase())) {
    if (body.role.toUpperCase() === 'SUPER_ADMIN' && auth.ctx.role !== 'SUPER_ADMIN') {
      return apiErr('Only super admins can assign SUPER_ADMIN', 403);
    }
    updates.role = body.role.toUpperCase();
  }

  if (Object.keys(updates).length === 1) return apiErr('Nothing to update', 400);

  const { error } = await admin.from('profiles').update(updates).eq('id', body.id);
  if (error) return apiErr(error.message, 500);

  await logAdminAction(admin, userId, 'user.update', body.id, updates);
  return apiOk({ updated: true });
}
