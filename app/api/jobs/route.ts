import { apiErr, apiOk } from '@/lib/api-response';
import { createRouteHandlerClient } from '@/lib/supabase/route-handler';
import { getSupabaseEnv } from '@/lib/supabase/env';
import { getTool } from '@/data/tools';
import { clientIp, rateLimit, rateLimitResponse } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/** GET /api/jobs — the signed-in user's tool history (latest 50) + today's count. */
export async function GET() {
  if (!getSupabaseEnv()) return apiOk({ jobs: [], todayCount: 0 });

  const { supabase } = await createRouteHandlerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiErr('Sign in to view your history', 401);

  const { data: jobs, error } = await supabase
    .from('jobs')
    .select('id, tool_slug, tool_name, category, status, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[jobs] fetch failed:', error.message);
    return apiErr('Could not load history', 500);
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const { count } = await supabase
    .from('jobs')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', startOfDay.toISOString());

  return apiOk({ jobs: jobs ?? [], todayCount: count ?? 0 });
}

/** POST /api/jobs — record a tool run for the signed-in user. */
export async function POST(req: Request) {
  const rl = rateLimit(`jobs:${clientIp(req)}`, 30, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds);

  if (!getSupabaseEnv()) return apiOk({ recorded: false });

  let body: { toolSlug?: string; status?: string };
  try {
    body = (await req.json()) as { toolSlug?: string; status?: string };
  } catch {
    return apiErr('Invalid request body', 400);
  }

  const tool = body.toolSlug ? getTool(body.toolSlug) : undefined;
  if (!tool) return apiErr('Unknown tool', 400);

  const status = ['used', 'completed', 'failed'].includes(body.status || '')
    ? (body.status as string)
    : 'used';

  const { supabase } = await createRouteHandlerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiOk({ recorded: false }); // anonymous usage is not tracked

  const { error } = await supabase.from('jobs').insert({
    user_id: user.id,
    tool_slug: tool.slug,
    tool_name: tool.name,
    category: tool.category,
    status,
  });

  if (error) {
    console.error('[jobs] insert failed:', error.message);
    return apiErr('Could not record job', 500);
  }

  return apiOk({ recorded: true });
}
