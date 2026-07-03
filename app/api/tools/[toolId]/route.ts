import { apiErr, apiOk } from '@/lib/api-response';
import { getTool } from '@/data/tools';

/** GET /api/tools/[toolId] — single tool metadata by slug. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ toolId: string }> },
) {
  const { toolId } = await params;
  const tool = getTool(toolId);
  if (!tool) return apiErr(`Tool "${toolId}" not found`, 404);

  return apiOk({
    slug: tool.slug,
    name: tool.name,
    description: tool.description,
    category: tool.category,
    badge: tool.badge ?? null,
    href: `/tools/${tool.category}/${tool.slug}`,
  });
}
