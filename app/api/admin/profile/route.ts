import { apiErr, apiOk } from '@/lib/api-response';
import { listAdminAuditLogs, logAdminAction, requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { admin, userId } = auth.ctx;

  const { data: profile } = await admin
    .from('profiles')
    .select('id, full_name, avatar_url, plan, role, created_at, updated_at')
    .eq('id', userId)
    .single();

  const { data: authUser } = await admin.auth.admin.getUserById(userId);

  const activity = await listAdminAuditLogs(admin, { page: 1, limit: 8, actorId: userId });

  return apiOk({
    profile: profile ?? null,
    email: authUser?.user?.email ?? '',
    lastSignIn: authUser?.user?.last_sign_in_at ?? null,
    recentActivity: activity.logs,
  });
}

export async function PATCH(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { admin, userId } = auth.ctx;

  let body: { full_name?: string; avatar_url?: string | null };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return apiErr('Invalid body', 400);
  }

  const updates: Record<string, string | null> = { updated_at: new Date().toISOString() };
  if (body.full_name !== undefined) updates.full_name = body.full_name.trim();
  if (body.avatar_url !== undefined) updates.avatar_url = body.avatar_url;

  const { error } = await admin.from('profiles').update(updates).eq('id', userId);
  if (error) return apiErr(error.message, 500);

  await logAdminAction(admin, userId, 'profile.update', userId, updates);
  return apiOk({ updated: true });
}
