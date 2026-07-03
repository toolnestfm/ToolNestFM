import { apiErr, apiOk } from '@/lib/api-response';
import { requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { admin } = auth.ctx;

  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.trim() ?? '';
  const page = Math.max(1, Number(url.searchParams.get('page') || 1));
  const limit = 40;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = admin
    .from('search_logs')
    .select('id, query, results_count, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (q) query = query.ilike('query', `%${q}%`);

  const { data, error, count } = await query;
  if (error) return apiErr(error.message, 500);

  const { data: allQueries } = await admin
    .from('search_logs')
    .select('query')
    .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString())
    .limit(5000);

  const freq = new Map<string, number>();
  (allQueries ?? []).forEach((row) => {
    const k = row.query.toLowerCase().trim();
    if (k) freq.set(k, (freq.get(k) ?? 0) + 1);
  });
  const popular = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([query, count]) => ({ query, count }));

  return apiOk({
    logs: data ?? [],
    total: count ?? 0,
    page,
    pages: Math.ceil((count ?? 0) / limit),
    popular: popular ?? [],
  });
}
