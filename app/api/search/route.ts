import { apiErr, apiOk } from '@/lib/api-response';
import { searchTools } from '@/data/tools';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim() || '';
  const category = searchParams.get('category')?.trim() || '';
  const limit = Math.min(Number(searchParams.get('limit') || 20), 50);

  if (!q) return apiErr('Query parameter "q" is required', 400);

  let results = searchTools(q);
  if (category) results = results.filter((t) => t.category === category);

  // Best-effort search analytics — never blocks or fails the response.
  const supabase = createAdminClient();
  if (supabase) {
    const { error } = await supabase
      .from('search_logs')
      .insert({ query: q.slice(0, 200), results_count: results.length });
    if (error) console.error('[search] log failed:', error.message);
  }

  return apiOk({
    query: q,
    count: results.length,
    results: results.slice(0, limit).map((t) => ({
      slug: t.slug,
      name: t.name,
      description: t.description,
      category: t.category,
      badge: t.badge ?? null,
      href: `/tools/${t.category}/${t.slug}`,
    })),
  });
}
