import type { SupabaseClient } from '@supabase/supabase-js';
import { apiErr, apiOk } from '@/lib/api-response';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  adjustCredits,
  authenticateApiKey,
  InsufficientCreditsError,
  type ApiKeyAuth,
} from '@/lib/credits';
import { clientIp, rateLimit, rateLimitResponse } from '@/lib/rate-limit';

/** Shared plumbing for the ToolNest public API (/api/v1/*). */

export interface V1Context {
  admin: SupabaseClient;
  auth: ApiKeyAuth;
}

type RequireKeyResult = { ok: true; ctx: V1Context } | { ok: false; response: Response };

/** Rate-limit by IP, then resolve the Bearer API key. */
export async function requireApiKey(req: Request, limitPerMin = 60): Promise<RequireKeyResult> {
  const rl = rateLimit(`v1:${clientIp(req)}`, limitPerMin, 60_000);
  if (!rl.allowed) return { ok: false, response: rateLimitResponse(rl.retryAfterSeconds) };

  const admin = createAdminClient();
  if (!admin) return { ok: false, response: apiErr('API is not configured', 503) };

  const auth = await authenticateApiKey(admin, req);
  if (!auth) {
    return {
      ok: false,
      response: apiErr('Invalid or revoked API key. Pass it as: Authorization: Bearer tn_live_...', 401),
    };
  }

  return { ok: true, ctx: { admin, auth } };
}

/**
 * Run a credit-charged operation: spend first (atomic), refund if the
 * operation throws. On success responds with { ...result, credits }.
 */
export async function withCredits(
  ctx: V1Context,
  cost: number,
  fn: () => Promise<Record<string, unknown>>,
): Promise<Response> {
  let balance: number;
  try {
    balance = await adjustCredits(ctx.admin, ctx.auth.userId, -cost, 'api_call', undefined, {
      key_id: ctx.auth.keyId,
    });
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return apiErr('Insufficient credits. Buy more at toolnestfm.com/dashboard/credits', 402);
    }
    return apiErr('Credit check failed — try again', 500);
  }

  try {
    const result = await fn();
    return apiOk({ ...result, credits: { spent: cost, remaining: balance } });
  } catch (err) {
    await adjustCredits(ctx.admin, ctx.auth.userId, cost, 'api_call', undefined, {
      key_id: ctx.auth.keyId,
      refund: true,
    }).catch(() => undefined);
    const message = err instanceof Error ? err.message : 'Operation failed';
    return apiErr(message, 502);
  }
}

/** Parse a JSON body; returns null on malformed input. */
export async function readJson<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}
