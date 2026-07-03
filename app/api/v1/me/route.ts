import { apiOk } from '@/lib/api-response';
import { requireApiKey } from '@/lib/api-v1';
import { getBalance } from '@/lib/credits';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/me — key info + credit balance. Free (API key required).
 */
export async function GET(req: Request) {
  const gate = await requireApiKey(req, 60);
  if (!gate.ok) return gate.response;
  const { admin, auth } = gate.ctx;

  const balance = await getBalance(admin, auth.userId);
  return apiOk({
    keyId: auth.keyId,
    credits: balance,
    pricing: { chat: 1, summarize: 1, translate: 1, write: 1, qr: 0, hash: 0, uuid: 0, tools: 0, usage: 0 },
  });
}
