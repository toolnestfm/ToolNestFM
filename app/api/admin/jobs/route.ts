import { apiErr, apiOk } from '@/lib/api-response';
import { requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { admin } = auth.ctx;

  const url = new URL(req.url);
  const status = url.searchParams.get('status') ?? '';
  const userId = url.searchParams.get('userId')?.trim() ?? '';
  const q = url.searchParams.get('q')?.trim() ?? '';
  const page = Math.max(1, Number(url.searchParams.get('page') || 1));
  const limit = 30;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = admin
    .from('jobs')
    .select('id, user_id, tool_slug, tool_name, category, status, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (status) query = query.eq('status', status);
  if (userId) query = query.eq('user_id', userId);
  if (q) query = query.or(`tool_name.ilike.%${q}%,tool_slug.ilike.%${q}%,category.ilike.%${q}%`);

  const { data, error, count } = await query;
  if (error) return apiErr(error.message, 500);

  return apiOk({ jobs: data ?? [], total: count ?? 0, page, pages: Math.ceil((count ?? 0) / limit) });
}
