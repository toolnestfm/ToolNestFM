import { apiErr } from '@/lib/api-response';
import { geminiCompleteServer } from '@/lib/gemini/server';
import { readJson, requireApiKey, withCredits } from '@/lib/api-v1';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/write — generate content from a brief. 1 credit.
 * Body: { "brief": "...", "tone"?: "professional", "format"?: "blog post", "words"?: 300 }
 */
export async function POST(req: Request) {
  const gate = await requireApiKey(req, 30);
  if (!gate.ok) return gate.response;

  const body = await readJson<{ brief?: string; tone?: string; format?: string; words?: number }>(req);
  if (!body) return apiErr('Invalid JSON body', 400);

  const brief = body.brief?.trim();
  if (!brief) return apiErr('brief is required', 400);
  if (brief.length > 20_000) return apiErr('brief too large (max 20,000 characters)', 400);
  if (!process.env.GEMINI_API_KEY) return apiErr('AI backend is not configured', 503);

  const tone = (body.tone || 'professional').slice(0, 40);
  const format = (body.format || 'article').slice(0, 60);
  const words = Number.isInteger(body.words) && body.words! >= 50 && body.words! <= 3000 ? body.words : 300;

  const system = `You are an expert content writer. Write a ${format} in a ${tone} tone, roughly ${words} words. Return only the content — no preamble.`;

  return withCredits(gate.ctx, 1, async () => {
    const content = await geminiCompleteServer([{ role: 'user', content: brief }], system);
    return { content };
  });
}
