import { apiErr, apiOk } from '@/lib/api-response';
import { createAdminClient } from '@/lib/supabase/admin';
import { clientIp, rateLimit, rateLimitResponse } from '@/lib/rate-limit';

/** Fire-and-forget event tracking. Always returns 200 quickly; storage is best-effort. */
export async function POST(req: Request) {
  const rl = rateLimit(`analytics:${clientIp(req)}`, 60, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds);

  let body: { event?: string; props?: Record<string, unknown>; userId?: string };
  try {
    body = (await req.json()) as { event?: string; props?: Record<string, unknown>; userId?: string };
  } catch {
    return apiErr('Invalid request body', 400);
  }

  const event = body.event?.trim().slice(0, 80);
  if (!event || !/^[a-z0-9_.:-]+$/i.test(event)) {
    return apiErr('A valid "event" name is required', 400);
  }

  const supabase = createAdminClient();
  if (supabase) {
    const { error } = await supabase.from('analytics_events').insert({
      event,
      props: body.props && typeof body.props === 'object' ? body.props : {},
      user_id: body.userId || null,
    });
    if (error) console.error('[analytics] insert failed:', error.message);
  }

  return apiOk({ tracked: true });
}
