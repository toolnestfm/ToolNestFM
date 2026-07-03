import { createHash } from 'crypto';
import { apiErr, apiOk } from '@/lib/api-response';
import { readJson, requireApiKey } from '@/lib/api-v1';

export const dynamic = 'force-dynamic';

const ALGORITHMS = ['md5', 'sha1', 'sha256', 'sha512'] as const;

/**
 * POST /api/v1/hash — hash text. Free (API key required).
 * Body: { "text": "...", "algorithm"?: "sha256" }
 */
export async function POST(req: Request) {
  const gate = await requireApiKey(req, 60);
  if (!gate.ok) return gate.response;

  const body = await readJson<{ text?: string; algorithm?: string }>(req);
  if (!body) return apiErr('Invalid JSON body', 400);

  if (typeof body.text !== 'string' || body.text.length === 0) {
    return apiErr('text is required', 400);
  }
  if (body.text.length > 1_000_000) return apiErr('text too large (max 1 MB)', 400);

  const algorithm = (body.algorithm || 'sha256').toLowerCase();
  if (!ALGORITHMS.includes(algorithm as (typeof ALGORITHMS)[number])) {
    return apiErr(`algorithm must be one of: ${ALGORITHMS.join(', ')}`, 400);
  }

  const hash = createHash(algorithm).update(body.text).digest('hex');
  return apiOk({ algorithm, hash });
}
