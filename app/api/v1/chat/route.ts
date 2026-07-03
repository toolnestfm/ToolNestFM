import { apiErr } from '@/lib/api-response';
import type { ChatMessage } from '@/lib/ai';
import { geminiCompleteServer } from '@/lib/gemini/server';
import { readJson, requireApiKey, withCredits } from '@/lib/api-v1';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/chat — AI chat completion. 1 credit.
 * Auth:   Authorization: Bearer tn_live_...
 * Body:   { "messages": [{ "role": "user", "content": "..." }], "system"?: "...", "model"?: "gemini-..." }
 */
export async function POST(req: Request) {
  const gate = await requireApiKey(req, 30);
  if (!gate.ok) return gate.response;

  const body = await readJson<{ messages?: ChatMessage[]; system?: string; model?: string }>(req);
  if (!body) return apiErr('Invalid JSON body', 400);

  if (!body.messages?.length) return apiErr('messages array is required', 400);
  if (body.messages.length > 50) return apiErr('Too many messages (max 50)', 400);
  const totalChars = body.messages.reduce((n, m) => n + (m.content?.length || 0), 0);
  if (totalChars > 100_000) return apiErr('Message content too large', 400);

  if (!process.env.GEMINI_API_KEY) return apiErr('AI backend is not configured', 503);

  const model = body.model && /^gemini-[a-z0-9.-]{1,40}$/.test(body.model) ? body.model : undefined;
  const system = (body.system || 'You are a helpful assistant.').slice(0, 4000);

  return withCredits(gate.ctx, 1, async () => {
    const reply = await geminiCompleteServer(body.messages!, system, model);
    return { reply };
  });
}
