import { apiErr, apiOk } from '@/lib/api-response';
import { requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { admin } = auth.ctx;

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get('page') || 1));
  const limit = 40;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error, count } = await admin
    .from('admin_audit_log')
    .select('id, actor_id, action, target, meta, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) return apiErr(error.message, 500);

  return apiOk({ logs: data ?? [], total: count ?? 0, page, pages: Math.ceil((count ?? 0) / limit) });
}
