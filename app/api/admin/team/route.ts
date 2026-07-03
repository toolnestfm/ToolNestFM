import { apiErr, apiOk } from '@/lib/api-response';
import { logAdminAction, requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { admin } = auth.ctx;

  const { data: admins, error } = await admin
    .from('profiles')
    .select('id, full_name, avatar_url, plan, role, created_at')
    .in('role', ['ADMIN', 'SUPER_ADMIN'])
    .order('created_at', { ascending: true });

  if (error) return apiErr(error.message, 500);

  const withEmail = await Promise.all(
    (admins ?? []).map(async (a) => {
      const { data: u } = await admin.auth.admin.getUserById(a.id);
      return { ...a, email: u?.user?.email ?? '—' };
    }),
  );

  return apiOk({ team: withEmail });
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { admin, userId, role: actorRole } = auth.ctx;

  let body: {
    action?: 'create' | 'promote';
    email?: string;
    password?: string;
    full_name?: string;
    user_id?: string;
    role?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return apiErr('Invalid body', 400);
  }

  if (body.action === 'create') {
    if (actorRole !== 'SUPER_ADMIN') return apiErr('Only super admins can create accounts', 403);
    if (!body.email || !body.password || body.password.length < 8) {
      return apiErr('Email and password (8+ chars) required', 400);
    }

    const { data, error } = await admin.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: { full_name: body.full_name ?? body.email.split('@')[0] },
    });
    if (error || !data.user) return apiErr(error?.message ?? 'Create failed', 500);

    const newRole = body.role?.toUpperCase() === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'ADMIN';
    await admin.from('profiles').upsert({
      id: data.user.id,
      full_name: body.full_name ?? body.email.split('@')[0],
      role: newRole,
      plan: 'ENTERPRISE',
      updated_at: new Date().toISOString(),
    });

    await logAdminAction(admin, userId, 'admin.create', data.user.id, { email: body.email, role: newRole });
    return apiOk({ id: data.user.id, email: body.email });
  }

  if (body.action === 'promote') {
    if (!body.user_id) return apiErr('user_id required', 400);
    const newRole = body.role?.toUpperCase();
    if (!newRole || !['ADMIN', 'SUPER_ADMIN', 'USER'].includes(newRole)) {
      return apiErr('Invalid role', 400);
    }
    if (newRole === 'SUPER_ADMIN' && actorRole !== 'SUPER_ADMIN') {
      return apiErr('Only super admins can promote to SUPER_ADMIN', 403);
    }

    const { error } = await admin.from('profiles').update({ role: newRole, updated_at: new Date().toISOString() }).eq('id', body.user_id);
    if (error) return apiErr(error.message, 500);

    await logAdminAction(admin, userId, 'admin.promote', body.user_id, { role: newRole });
    return apiOk({ promoted: true });
  }

  return apiErr('Unknown action', 400);
}
