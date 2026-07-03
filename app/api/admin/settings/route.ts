import { apiErr, apiOk } from '@/lib/api-response';
import { logAdminAction, requireAdmin } from '@/lib/admin-auth';
import { getAdminSettings, saveAdminSettings } from '@/lib/admin-settings-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const settings = await getAdminSettings(auth.ctx.admin);
  return apiOk(settings);
}

export async function PATCH(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return apiErr('Invalid body', 400);
  }

  try {
    const settings = await saveAdminSettings(auth.ctx.admin, auth.ctx.userId, body);
    await logAdminAction(auth.ctx.admin, auth.ctx.userId, 'settings.update', 'global', body);
    return apiOk(settings);
  } catch (e) {
    return apiErr(e instanceof Error ? e.message : 'Save failed', 500);
  }
}
