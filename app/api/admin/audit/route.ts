import { apiOk } from '@/lib/api-response';
import { listAdminAuditLogs, requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { admin } = auth.ctx;

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get('page') || 1));
  const limit = 40;

  const result = await listAdminAuditLogs(admin, { page, limit });
  return apiOk(result);
}
