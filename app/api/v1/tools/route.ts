import { apiOk } from '@/lib/api-response';
import { tools } from '@/data/tools';
import { clientIp, rateLimit, rateLimitResponse } from '@/lib/rate-limit';

/**
 * GET /api/v1/tools?category= — public tool catalog. No API key required.
 */
export async function GET(req: Request) {
  const rl = rateLimit(`v1tools:${clientIp(req)}`, 60, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds);

  const category = new URL(req.url).searchParams.get('category')?.trim() || '';

  let list = tools;
  if (category) list = list.filter((t) => t.category === category);

  return apiOk({
    count: list.length,
    tools: list.map((t) => ({
      slug: t.slug,
      name: t.name,
      description: t.description,
      category: t.category,
      badge: t.badge ?? null,
      url: `https://toolnestfm.com/tools/${t.category}/${t.slug}`,
    })),
  });
}
