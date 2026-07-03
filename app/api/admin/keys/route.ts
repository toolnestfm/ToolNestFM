import { apiErr, apiOk } from '@/lib/api-response';
import { logAdminAction, requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

/** GET /api/admin/keys — list all API keys across users. */
export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { admin } = auth.ctx;

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get('page') || 1));
  const limit = 25;
  const from = (page - 1) * limit;

  const { data, error, count } = await admin
    .from('api_keys')
    .select('id, user_id, name, prefix, last_used_at, revoked_at, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + limit - 1);

  if (error) return apiErr(error.message, 500);

  // Attach owner names for display.
  const userIds = [...new Set((data ?? []).map((k) => k.user_id))];
  const owners: Record<string, string> = {};
  if (userIds.length) {
    const { data: profiles } = await admin.from('profiles').select('id, full_name').in('id', userIds);
    for (const p of profiles ?? []) owners[p.id] = p.full_name || p.id.slice(0, 8);
  }

  const keys = (data ?? []).map((k) => ({ ...k, owner: owners[k.user_id] ?? k.user_id.slice(0, 8) }));
  return apiOk({ keys, total: count ?? 0, page, pages: Math.ceil((count ?? 0) / limit) });
}

/** DELETE /api/admin/keys?id= — revoke any user's key. */
export async function DELETE(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { admin, userId: actorId } = auth.ctx;

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return apiErr('Key id is required', 400);

  const { error } = await admin
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return apiErr(error.message, 500);

  await logAdminAction(admin, actorId, 'apikey.revoke', id);
  return apiOk({ revoked: true });
}
