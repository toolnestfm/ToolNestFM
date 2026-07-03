import { apiErr, apiOk } from '@/lib/api-response';
import { requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { admin } = auth.ctx;

  const url = new URL(req.url);
  const activeOnly = url.searchParams.get('active') !== 'false';
  const page = Math.max(1, Number(url.searchParams.get('page') || 1));
  const limit = 40;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = admin
    .from('newsletter_subscribers')
    .select('id, email, source, subscribed_at, unsubscribed_at', { count: 'exact' })
    .order('subscribed_at', { ascending: false })
    .range(from, to);

  if (activeOnly) query = query.is('unsubscribed_at', null);

  const { data, error, count } = await query;
  if (error) return apiErr(error.message, 500);

  return apiOk({ subscribers: data ?? [], total: count ?? 0, page, pages: Math.ceil((count ?? 0) / limit) });
}
