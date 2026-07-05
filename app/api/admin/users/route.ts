import { apiErr, apiOk } from '@/lib/api-response';
import { logAdminAction, requireAdmin } from '@/lib/admin-auth';
import {
  escapeIlike,
  isMissingColumnError,
  normalizeProfileRow,
  PROFILE_SELECT_FALLBACKS,
} from '@/lib/admin-users';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { admin } = auth.ctx;

  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.trim() ?? '';
  const plan = url.searchParams.get('plan') ?? '';
  const role = url.searchParams.get('role') ?? '';
  const status = url.searchParams.get('status') ?? '';
  const page = Math.max(1, Number(url.searchParams.get('page') || 1));
  const limit = 25;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  // Progressive select: full column set first; if a column from a not-yet-run
  // migration is missing, retry with smaller legacy sets so the page still works.
  let rows: Record<string, unknown>[] | null = null;
  let count: number | null = null;
  let lastError = '';

  for (let attempt = 0; attempt < PROFILE_SELECT_FALLBACKS.length; attempt++) {
    const select = PROFILE_SELECT_FALLBACKS[attempt];
    const hasBanCol = attempt === 0;
    const hasEmailCol = attempt === 0;

    let query = admin
      .from('profiles')
      .select(select, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (plan) query = query.eq('plan', plan.toUpperCase());
    if (role) query = query.eq('role', role.toUpperCase());
    if (hasBanCol && status === 'banned') query = query.eq('is_banned', true);
    if (hasBanCol && status === 'active') query = query.eq('is_banned', false);

    if (q) {
      const safe = escapeIlike(q);
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q);
      if (isUuid) {
        query = query.eq('id', q);
      } else if (q.includes('@') && hasEmailCol) {
        query = query.ilike('email', `%${safe}%`);
      } else if (hasEmailCol) {
        query = query.or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%`);
      } else {
        query = query.ilike('full_name', `%${safe}%`);
      }
    }

    const res = await query;
    if (!res.error) {
      rows = (res.data ?? []) as unknown as Record<string, unknown>[];
      count = res.count ?? 0;
      break;
    }
    lastError = res.error.message;
    if (!isMissingColumnError(res.error.message)) return apiErr(res.error.message, 500);
  }

  if (rows === null) return apiErr(lastError || 'Could not load users', 500);
  const normalized = rows.map(normalizeProfileRow);
  const missingEmailIds = normalized.filter((p) => !p.email).map((p) => p.id);
  const emails: Record<string, string> = {};
  if (missingEmailIds.length) {
    await Promise.all(
      missingEmailIds.map(async (id) => {
        const { data: u } = await admin.auth.admin.getUserById(id);
        if (u?.user?.email) emails[id] = u.user.email;
      }),
    );
  }

  const users = normalized.map((p) => ({
    ...p,
    email: p.email ?? emails[p.id] ?? '—',
  }));

  return apiOk({ users, total: count ?? 0, page, pages: Math.ceil((count ?? 0) / limit) });
}

export async function PATCH(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { admin, userId } = auth.ctx;

  let body: {
    id?: string;
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

  if (!body.id) return apiErr('User id required', 400);
  if (body.id === userId && body.role && body.role.toUpperCase() !== auth.ctx.role) {
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

  const { error } = await admin.from('profiles').update(updates).eq('id', body.id);
  if (error) return apiErr(error.message, 500);

  await logAdminAction(admin, userId, 'user.update', body.id, updates);
  return apiOk({ updated: true });
}
