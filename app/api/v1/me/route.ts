import { apiErr, apiOk } from '@/lib/api-response';
import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateApiKey, getBalance } from '@/lib/credits';
import { clientIp, rateLimit, rateLimitResponse } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/me — key info + credit balance. Free (no credits charged).
 * Auth: Authorization: Bearer tn_live_...
 */
export async function GET(req: Request) {
  const rl = rateLimit(`v1me:${clientIp(req)}`, 60, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds);

  const admin = createAdminClient();
  if (!admin) return apiErr('API is not configured', 503);

  const auth = await authenticateApiKey(admin, req);
  if (!auth) {
    return apiErr('Invalid or revoked API key. Pass it as: Authorization: Bearer tn_live_...', 401);
  }

  const balance = await getBalance(admin, auth.userId);
  return apiOk({ keyId: auth.keyId, credits: balance, pricing: { chat: 1 } });
}
