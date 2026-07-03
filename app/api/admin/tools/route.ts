import { apiErr, apiOk } from '@/lib/api-response';
import { logAdminAction, requireAdmin } from '@/lib/admin-auth';
import { getAdminSettings } from '@/lib/admin-settings-store';
import { tools } from '@/data/tools';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const settings = await getAdminSettings(auth.ctx.admin);
  const list = tools.map((t) => ({
    slug: t.slug,
    name: t.name,
    category: t.category,
    description: t.description,
    badge: t.badge,
    enabled: !settings.disabled_tools.includes(t.slug),
  }));

  return apiOk({ tools: list, disabledCount: settings.disabled_tools.length });
}

export async function PATCH(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let body: { slug?: string; enabled?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return apiErr('Invalid body', 400);
  }

  if (!body.slug || typeof body.enabled !== 'boolean') {
    return apiErr('slug and enabled required', 400);
  }

  const settings = await getAdminSettings(auth.ctx.admin);
  const disabled = new Set(settings.disabled_tools);
  if (body.enabled) disabled.delete(body.slug);
  else disabled.add(body.slug);

  const { saveAdminSettings } = await import('@/lib/admin-settings-store');
  const updated = await saveAdminSettings(auth.ctx.admin, auth.ctx.userId, {
    disabled_tools: [...disabled],
  });

  await logAdminAction(auth.ctx.admin, auth.ctx.userId, 'tool.toggle', body.slug, { enabled: body.enabled });
  return apiOk({ disabled_tools: updated.disabled_tools });
}
