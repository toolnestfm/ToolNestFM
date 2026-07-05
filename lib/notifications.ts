import type { SupabaseClient } from '@supabase/supabase-js';

export type NotificationType = 'system' | 'job' | 'billing' | 'announcement';

export type NotificationPayload = {
  type?: NotificationType;
  title: string;
  body?: string | null;
  href?: string | null;
};

export type BroadcastTarget =
  | { kind: 'all' }
  | { kind: 'plan'; plan: 'FREE' | 'PRO' | 'ENTERPRISE' }
  | { kind: 'user'; userId: string };

const VALID_TYPES = new Set<NotificationType>(['system', 'job', 'billing', 'announcement']);

export function sanitizeNotification(input: NotificationPayload) {
  const type = VALID_TYPES.has(input.type as NotificationType) ? (input.type as NotificationType) : 'system';
  const title = input.title.trim().slice(0, 120);
  const body = input.body?.trim().slice(0, 1000) || null;
  const href = input.href?.trim().startsWith('/') ? input.href.trim().slice(0, 500) : null;
  return { type, title, body, href };
}

/** Insert a notification for one user. Works with service role or user session (RLS). */
export async function createNotification(
  client: SupabaseClient,
  userId: string,
  input: NotificationPayload,
): Promise<boolean> {
  const { type, title, body, href } = sanitizeNotification(input);
  if (!title) return false;

  const { error } = await client.from('notifications').insert({
    user_id: userId,
    type,
    title,
    body,
    href,
  });
  return !error;
}

/** Broadcast to many users; records audit row in notification_broadcasts. */
export async function broadcastNotifications(
  admin: SupabaseClient,
  actorId: string,
  target: BroadcastTarget,
  input: NotificationPayload,
): Promise<{ sent: number; error?: string }> {
  const { title, body, href } = sanitizeNotification(input);
  if (!title) return { sent: 0, error: 'Title is required' };

  let query = admin.from('profiles').select('id');
  if (target.kind === 'plan') query = query.eq('plan', target.plan);
  if (target.kind === 'user') query = query.eq('id', target.userId);

  const { data: profiles, error: fetchErr } = await query;
  if (fetchErr) return { sent: 0, error: fetchErr.message };
  if (!profiles?.length) return { sent: 0, error: 'No users match this target' };

  const rows = profiles.map((p) => ({
    user_id: p.id,
    type: 'announcement' as const,
    title,
    body,
    href,
  }));

  const chunkSize = 100;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await admin.from('notifications').insert(chunk);
    if (error) return { sent: i, error: error.message };
  }

  const targetType = target.kind === 'all' ? 'all' : target.kind === 'plan' ? 'plan' : 'user';
  const targetValue =
    target.kind === 'plan' ? target.plan : target.kind === 'user' ? target.userId : null;

  try {
    await admin.from('notification_broadcasts').insert({
      actor_id: actorId,
      title,
      body,
      href,
      target_type: targetType,
      target_value: targetValue,
      sent_count: rows.length,
    });
  } catch {
    /* audit table optional */
  }

  return { sent: rows.length };
}

/** Alert user when a tool job finishes or fails. */
export async function notifyJobResult(
  client: SupabaseClient,
  userId: string,
  toolName: string,
  category: string,
  toolSlug: string,
  status: 'completed' | 'failed',
): Promise<void> {
  const failed = status === 'failed';
  await createNotification(client, userId, {
    type: 'job',
    title: failed ? `${toolName} failed` : `${toolName} completed ✓`,
    body: failed
      ? 'Something went wrong. Open the tool and try again with your file.'
      : 'Your processing finished successfully. Tap to open the tool again.',
    href: `/tools/${category}/${toolSlug}`,
  });
}

/** One-time welcome notification for new users. */
export async function ensureWelcomeNotification(
  client: SupabaseClient,
  userId: string,
): Promise<void> {
  const { count } = await client
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if ((count ?? 0) > 0) return;

  await createNotification(client, userId, {
    type: 'system',
    title: 'Welcome to ToolNest 🎉',
    body: 'Explore 120+ tools — PDF, Image, AI and more. Your files and history live in your dashboard.',
    href: '/tools',
  });
}
