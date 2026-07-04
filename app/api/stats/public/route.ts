import { apiOk } from '@/lib/api-response';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/** GET /api/stats/public[?tool=slug] — real platform counts (no auth). */
export async function GET(req: Request) {
  const admin = createAdminClient();
  if (!admin) return apiOk({ users: null, jobs: null, toolUses: null });

  const tool = new URL(req.url).searchParams.get('tool');

  const [usersRes, jobsRes] = await Promise.all([
    admin.from('profiles').select('id', { count: 'exact', head: true }),
    admin.from('jobs').select('id', { count: 'exact', head: true }),
  ]);

  let toolUses: number | null = null;
  if (tool) {
    const { count } = await admin
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('tool_slug', tool.slice(0, 80));
    toolUses = count ?? 0;
  }

  return new Response(
    JSON.stringify({
      success: true,
      data: { users: usersRes.count ?? 0, jobs: jobsRes.count ?? 0, toolUses },
      error: null,
      meta: { requestId: crypto.randomUUID(), timestamp: new Date().toISOString() },
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        // Real counts change slowly — let the CDN serve them for 5 minutes.
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    },
  );
}
