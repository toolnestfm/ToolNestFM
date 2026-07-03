import { apiErr, apiOk } from '@/lib/api-response';
import { requireApiKey } from '@/lib/api-v1';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/uuid?count=5 — generate UUID v4s. Free (API key required).
 */
export async function GET(req: Request) {
  const gate = await requireApiKey(req, 60);
  if (!gate.ok) return gate.response;

  const count = Math.min(Math.max(Number(new URL(req.url).searchParams.get('count') || 1), 1), 100);
  if (!Number.isFinite(count)) return apiErr('count must be a number between 1 and 100', 400);

  const uuids = Array.from({ length: count }, () => crypto.randomUUID());
  return apiOk({ uuids, count: uuids.length });
}
