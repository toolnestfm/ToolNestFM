import { apiErr, apiOk } from '@/lib/api-response';
import { createRouteHandlerClient } from '@/lib/supabase/route-handler';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSupabaseEnv } from '@/lib/supabase/env';
import { generateApiKey } from '@/lib/credits';
import { clientIp, rateLimit, rateLimitResponse } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const MAX_ACTIVE_KEYS = 5;

async function getUserId(): Promise<string | null> {
  const { supabase } = await createRouteHandlerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/** GET /api/keys — list the signed-in user's API keys (never the key itself). */
export async function GET() {
  if (!getSupabaseEnv()) return apiOk({ keys: [] });

  const { supabase } = await createRouteHandlerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiErr('Sign in to manage API keys', 401);

  const { data, error } = await supabase
    .from('api_keys')
    .select('id, name, prefix, last_used_at, revoked_at, created_at')
    .order('created_at', { ascending: false });

  if (error) return apiErr('Could not load API keys', 500);
  return apiOk({ keys: data ?? [] });
}

/** POST /api/keys — create a key. The full key is returned ONCE. */
export async function POST(req: Request) {
  const rl = rateLimit(`keys:${clientIp(req)}`, 10, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds);

  if (!getSupabaseEnv()) return apiErr('Auth is not configured', 503);
  const userId = await getUserId();
  if (!userId) return apiErr('Sign in to create API keys', 401);

  let body: { name?: string };
  try {
    body = (await req.json()) as { name?: string };
  } catch {
    return apiErr('Invalid request body', 400);
  }
  const name = body.name?.trim().slice(0, 60);
  if (!name) return apiErr('Key name is required', 400);

  const admin = createAdminClient();
  if (!admin) return apiErr('API keys are not available', 503);

  const { count } = await admin
    .from('api_keys')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('revoked_at', null);
  if ((count ?? 0) >= MAX_ACTIVE_KEYS) {
    return apiErr(`Maximum ${MAX_ACTIVE_KEYS} active keys — revoke one first`, 400);
  }

  const { key, hash, prefix } = generateApiKey();
  const { data, error } = await admin
    .from('api_keys')
    .insert({ user_id: userId, name, key_hash: hash, prefix })
    .select('id, name, prefix, created_at')
    .single();

  if (error) {
    console.error('[keys] create failed:', error.message);
    return apiErr('Could not create API key', 500);
  }

  return apiOk({ ...data, key }); // full key — shown once, never retrievable again
}

/** DELETE /api/keys?id= — revoke one of the signed-in user's keys. */
export async function DELETE(req: Request) {
  if (!getSupabaseEnv()) return apiErr('Auth is not configured', 503);
  const userId = await getUserId();
  if (!userId) return apiErr('Sign in to manage API keys', 401);

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return apiErr('Key id is required', 400);

  const admin = createAdminClient();
  if (!admin) return apiErr('API keys are not available', 503);

  const { error } = await admin
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId);

  if (error) return apiErr('Could not revoke key', 500);
  return apiOk({ revoked: true });
}
