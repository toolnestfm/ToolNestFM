import { apiErr, apiOk } from '@/lib/api-response';
import type { ChatMessage } from '@/lib/ai';
import { geminiCompleteServer } from '@/lib/gemini/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { adjustCredits, authenticateApiKey, InsufficientCreditsError } from '@/lib/credits';
import { clientIp, rateLimit, rateLimitResponse } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const CREDITS_PER_CALL = 1;

/**
 * POST /api/v1/chat — ToolNest public AI API.
 * Auth:   Authorization: Bearer tn_live_...
 * Cost:   1 credit per call.
 * Body:   { "messages": [{ "role": "user", "content": "..." }], "system"?: "..." }
 */
export async function POST(req: Request) {
  const rl = rateLimit(`v1:${clientIp(req)}`, 30, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds);

  const admin = createAdminClient();
  if (!admin) return apiErr('API is not configured', 503);

  const auth = await authenticateApiKey(admin, req);
  if (!auth) {
    return apiErr('Invalid or revoked API key. Pass it as: Authorization: Bearer tn_live_...', 401);
  }

  let body: { messages?: ChatMessage[]; system?: string; model?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return apiErr('Invalid JSON body', 400);
  }

  if (!body.messages?.length) return apiErr('messages array is required', 400);
  if (body.messages.length > 50) return apiErr('Too many messages (max 50)', 400);
  const totalChars = body.messages.reduce((n, m) => n + (m.content?.length || 0), 0);
  if (totalChars > 100_000) return apiErr('Message content too large', 400);

  if (!process.env.GEMINI_API_KEY) return apiErr('AI backend is not configured', 503);

  const model = body.model && /^gemini-[a-z0-9.-]{1,40}$/.test(body.model) ? body.model : undefined;
  const system = (body.system || 'You are a helpful assistant.').slice(0, 4000);

  // Spend first (atomic) — refund on AI failure.
  let balance: number;
  try {
    balance = await adjustCredits(admin, auth.userId, -CREDITS_PER_CALL, 'api_call', undefined, {
      key_id: auth.keyId,
    });
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return apiErr('Insufficient credits. Buy more at toolnestfm.com/dashboard/credits', 402);
    }
    return apiErr('Credit check failed — try again', 500);
  }

  try {
    const reply = await geminiCompleteServer(body.messages, system, model);
    return apiOk({ reply, credits: { spent: CREDITS_PER_CALL, remaining: balance } });
  } catch (err) {
    // Refund the credit — the call did not produce a result.
    await adjustCredits(admin, auth.userId, CREDITS_PER_CALL, 'api_call', undefined, {
      key_id: auth.keyId,
      refund: true,
    }).catch(() => undefined);
    const message = err instanceof Error ? err.message : 'AI generation failed';
    return apiErr(message, 502);
  }
}
