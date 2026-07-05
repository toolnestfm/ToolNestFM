import { apiErr, apiOk } from '@/lib/api-response';
import { logAdminAction, requireAdmin } from '@/lib/admin-auth';
import { broadcastNotifications, createNotification, sanitizeNotification } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

/** GET /api/admin/notifications — broadcast history + platform stats. */
export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { admin } = auth.ctx;

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get('page') || 1));
  const limit = 20;
  const from = (page - 1) * limit;

  const [broadcastsRes, totalNotifs, unreadNotifs, userCount] = await Promise.all([
    admin
      .from('notification_broadcasts')
      .select('id, actor_id, title, body, href, target_type, target_value, sent_count, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, from + limit - 1),
    admin.from('notifications').select('id', { count: 'exact', head: true }),
    admin.from('notifications').select('id', { count: 'exact', head: true }).eq('read', false),
    admin.from('profiles').select('id', { count: 'exact', head: true }),
  ]);

  if (broadcastsRes.error) {
    return apiOk({
      broadcasts: [],
      stats: {
        totalNotifications: totalNotifs.count ?? 0,
        unreadNotifications: unreadNotifs.count ?? 0,
        totalUsers: userCount.count ?? 0,
      },
      page,
      pages: 0,
    });
  }

  return apiOk({
    broadcasts: broadcastsRes.data ?? [],
    stats: {
      totalNotifications: totalNotifs.count ?? 0,
      unreadNotifications: unreadNotifs.count ?? 0,
      totalUsers: userCount.count ?? 0,
    },
    page,
    pages: Math.ceil((broadcastsRes.count ?? 0) / limit),
  });
}

/** POST /api/admin/notifications — send broadcast or single-user notification. */
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { admin, userId: actorId } = auth.ctx;

  let body: {
    title?: string;
    body?: string;
    href?: string;
    target?: 'all' | 'FREE' | 'PRO' | 'ENTERPRISE' | string;
    userId?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return apiErr('Invalid body', 400);
  }

  const payload = sanitizeNotification({
    title: body.title ?? '',
    body: body.body,
    href: body.href,
    type: 'announcement',
  });
  if (!payload.title) return apiErr('Title is required', 400);

  if (body.userId) {
    const ok = await createNotification(admin, body.userId, payload);
    if (!ok) return apiErr('Failed to send notification', 500);
    await logAdminAction(admin, actorId, 'notifications.send', body.userId, { title: payload.title });
    return apiOk({ sent: 1, target: 'user' });
  }

  const targetPlan = body.target && ['FREE', 'PRO', 'ENTERPRISE'].includes(body.target) ? body.target : null;
  const result = await broadcastNotifications(
    admin,
    actorId,
    targetPlan
      ? { kind: 'plan', plan: targetPlan as 'FREE' | 'PRO' | 'ENTERPRISE' }
      : { kind: 'all' },
    payload,
  );

  if (result.error) return apiErr(result.error, 500);

  await logAdminAction(admin, actorId, 'notifications.broadcast', undefined, {
    title: payload.title,
    target: targetPlan ?? 'all',
    sent: result.sent,
  });

  return apiOk({ sent: result.sent, target: targetPlan ?? 'all' });
}
