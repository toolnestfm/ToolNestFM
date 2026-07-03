import { apiErr, apiOk } from '@/lib/api-response';
import { createAdminClient } from '@/lib/supabase/admin';
import { createRouteHandlerClient } from '@/lib/supabase/route-handler';
import { getSupabaseEnv } from '@/lib/supabase/env';
import { clientIp, rateLimit, rateLimitResponse } from '@/lib/rate-limit';

/**
 * POST /api/account/delete — permanently delete the signed-in user's account.
 * Profile, jobs and all owned rows are removed via ON DELETE CASCADE.
 */
export async function POST(req: Request) {
  const rl = rateLimit(`account-delete:${clientIp(req)}`, 3, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds);

  if (!getSupabaseEnv()) return apiErr('Auth is not configured', 503);

  const { supabase } = await createRouteHandlerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiErr('Sign in to delete your account', 401);

  const admin = createAdminClient();
  if (!admin) {
    return apiErr('Account deletion is not available — contact support@toolnestfm.com', 503);
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error('[account] delete failed:', error.message);
    return apiErr('Could not delete account — contact support@toolnestfm.com', 500);
  }

  return apiOk({ deleted: true });
}
