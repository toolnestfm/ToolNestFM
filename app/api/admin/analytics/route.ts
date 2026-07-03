import { apiErr, apiOk } from '@/lib/api-response';
import { requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { admin } = auth.ctx;

  const url = new URL(req.url);
  const event = url.searchParams.get('event') ?? '';
  const page = Math.max(1, Number(url.searchParams.get('page') || 1));
  const limit = 40;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = admin
    .from('analytics_events')
    .select('id, event, props, user_id, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (event) query = query.eq('event', event);

  const { data, error, count } = await query;
  if (error) return apiErr(error.message, 500);

  return apiOk({ events: data ?? [], total: count ?? 0, page, pages: Math.ceil((count ?? 0) / limit) });
}
