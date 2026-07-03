import { apiErr, apiOk } from '@/lib/api-response';
import { logAdminAction, requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { admin } = auth.ctx;

  const url = new URL(req.url);
  const status = url.searchParams.get('status') ?? '';
  const page = Math.max(1, Number(url.searchParams.get('page') || 1));
  const limit = 25;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = admin
    .from('contact_messages')
    .select('id, name, email, message, status, admin_note, created_at, updated_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (status) query = query.eq('status', status);

  const { data, error, count } = await query;
  if (error) return apiErr(error.message, 500);

  return apiOk({ messages: data ?? [], total: count ?? 0, page, pages: Math.ceil((count ?? 0) / limit) });
}

export async function PATCH(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { admin, userId } = auth.ctx;

  let body: { id?: string; status?: string; admin_note?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return apiErr('Invalid body', 400);
  }

  if (!body.id) return apiErr('Message id required', 400);

  const updates: Record<string, string> = { updated_at: new Date().toISOString() };
  if (body.status && ['new', 'read', 'replied', 'archived'].includes(body.status)) {
    updates.status = body.status;
  }
  if (body.admin_note !== undefined) updates.admin_note = body.admin_note;

  const { error } = await admin.from('contact_messages').update(updates).eq('id', body.id);
  if (error) return apiErr(error.message, 500);

  await logAdminAction(admin, userId, 'contact.update', body.id, updates);
  return apiOk({ updated: true });
}
