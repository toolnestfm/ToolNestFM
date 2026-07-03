import { apiErr, apiOk } from '@/lib/api-response';
import { logAdminAction, requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

type ContactRow = {
  id: string;
  name: string;
  email: string;
  message: string;
  status?: string;
  admin_note?: string | null;
  created_at: string;
  updated_at?: string;
};

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

  // Prefer full columns; fall back if migration not applied yet
  let query = admin
    .from('contact_messages')
    .select('id, name, email, message, status, admin_note, created_at, updated_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (status) query = query.eq('status', status);

  let { data, error, count } = await query;

  if (error) {
    const basic = await admin
      .from('contact_messages')
      .select('id, name, email, message, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (basic.error) return apiErr(basic.error.message, 500);
    data = (basic.data ?? []).map((m) => ({
      ...m,
      status: 'new',
      admin_note: null,
      updated_at: m.created_at,
    }));
    count = basic.count;
    error = null;
  }

  const messages = ((data ?? []) as ContactRow[]).map((m) => ({
    ...m,
    status: m.status ?? 'new',
    admin_note: m.admin_note ?? null,
    updated_at: m.updated_at ?? m.created_at,
  }));

  return apiOk({ messages, total: count ?? 0, page, pages: Math.ceil((count ?? 0) / limit) });
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
  if (error) {
    // Columns missing — log action only so inbox still works
    await logAdminAction(admin, userId, 'contact.update', body.id, { ...updates, deferred: true });
    return apiOk({ updated: true, deferred: true });
  }

  await logAdminAction(admin, userId, 'contact.update', body.id, updates);
  return apiOk({ updated: true });
}
