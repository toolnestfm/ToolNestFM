import { randomBytes } from 'crypto';
import { apiErr, apiOk } from '@/lib/api-response';
import { createAdminClient } from '@/lib/supabase/admin';
import { clientIp, rateLimit, rateLimitResponse } from '@/lib/rate-limit';
import {
  deviceHint,
  getCallerPlan,
  hashSharePassword,
  sharePublicUrl,
} from '@/lib/share';

export const dynamic = 'force-dynamic';

const MAX_SHARE_BYTES = 25 * 1024 * 1024;
const EXPIRY_HOURS = new Set([1, 24, 168, 720]);

/** GET /api/share — list current user's active share links. */
export async function GET(req: Request) {
  const { userId } = await getCallerPlan();
  if (!userId) return apiErr('Sign in to view your share links', 401);

  const admin = createAdminClient();
  if (!admin) return apiErr('Sharing is not configured', 503);

  const { data, error } = await admin
    .from('shares')
    .select('token, file_name, file_size, expires_at, max_downloads, downloads, tool_slug, created_at')
    .eq('user_id', userId)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return apiErr('Could not load shares', 500);

  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
  const shares = (data ?? []).map((s) => ({
    ...s,
    url: sharePublicUrl(origin, s.token),
  }));

  return apiOk({ shares });
}

/** POST /api/share — upload a processed file and get a secure share link (free, sign-in required). */
export async function POST(req: Request) {
  const rl = rateLimit(`share:${clientIp(req)}`, 10, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds);

  const { userId } = await getCallerPlan();
  if (!userId) {
    return apiErr('Sign in to create share links — it is free.', 401);
  }

  const admin = createAdminClient();
  if (!admin) return apiErr('Sharing is not configured on this server', 503);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return apiErr('Expected multipart form data', 400);
  }

  const file = form.get('file');
  if (!(file instanceof File)) return apiErr('file is required', 400);
  if (file.size === 0) return apiErr('File is empty', 400);
  if (file.size > MAX_SHARE_BYTES) return apiErr('File too large — share links support up to 25MB', 413);

  const hours = Number(form.get('expiresInHours') ?? 24);
  const expiresInHours = EXPIRY_HOURS.has(hours) ? hours : 24;
  const oneTime = form.get('oneTime') === 'true';
  const password = String(form.get('password') ?? '').trim();
  const toolSlug = String(form.get('toolSlug') ?? '').trim().slice(0, 80) || null;

  let maxDownloads: number | null = oneTime ? 1 : null;
  const limitRaw = form.get('downloadLimit');
  if (limitRaw !== null && limitRaw !== '') {
    const n = Number(limitRaw);
    if (Number.isFinite(n) && n >= 1 && n <= 100) maxDownloads = Math.floor(n);
  }

  const token = randomBytes(16).toString('base64url');
  const safeName = file.name.replace(/[^\w.\-()\s]/g, '_').slice(0, 120) || 'file';
  const storagePath = `${token}/${safeName}`;

  const { error: uploadError } = await admin.storage
    .from('shares')
    .upload(storagePath, file, { contentType: file.type || 'application/octet-stream' });
  if (uploadError) {
    console.error('[share] upload failed:', uploadError.message);
    return apiErr('Could not store the file for sharing', 500);
  }

  const expiresAt = new Date(Date.now() + expiresInHours * 3600_000).toISOString();
  const passwordHash = password.length >= 4 ? hashSharePassword(password) : null;

  const { error: insertError } = await admin.from('shares').insert({
    token,
    user_id: userId,
    file_name: file.name,
    file_size: file.size,
    mime_type: file.type || 'application/octet-stream',
    storage_path: storagePath,
    expires_at: expiresAt,
    max_downloads: maxDownloads,
    password_hash: passwordHash,
    tool_slug: toolSlug,
    device_hint: deviceHint(req),
    share_events: [{ type: 'share_created', at: new Date().toISOString() }],
  });
  if (insertError) {
    console.error('[share] insert failed:', insertError.message);
    await admin.storage.from('shares').remove([storagePath]);
    return apiErr('Could not create share link', 500);
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
  return apiOk({
    token,
    url: sharePublicUrl(origin, token),
    expiresAt,
    hasPassword: !!passwordHash,
  });
}
