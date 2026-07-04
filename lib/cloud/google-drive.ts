import { createAdminClient } from '@/lib/supabase/admin';

export type CloudProvider = 'google' | 'dropbox';

export async function getCloudTokens(userId: string, provider: CloudProvider) {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data } = await admin
    .from('user_cloud_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .eq('provider', provider)
    .maybeSingle();
  return data;
}

export async function saveCloudTokens(
  userId: string,
  provider: CloudProvider,
  accessToken: string,
  refreshToken: string | null,
  expiresAt: Date | null,
  scope?: string,
) {
  const admin = createAdminClient();
  if (!admin) throw new Error('Database not configured');
  const { error } = await admin.from('user_cloud_tokens').upsert(
    {
      user_id: userId,
      provider,
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: expiresAt?.toISOString() ?? null,
      scope,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,provider' },
  );
  if (error) throw new Error(error.message);
}

export async function refreshGoogleToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Google Drive not configured');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error('Failed to refresh Google token');
  return (await res.json()) as { access_token: string; expires_in: number };
}

export async function getValidGoogleAccessToken(userId: string): Promise<string | null> {
  const row = await getCloudTokens(userId, 'google');
  if (!row) return null;

  const expires = row.expires_at ? new Date(row.expires_at).getTime() : 0;
  if (expires > Date.now() + 60_000) return row.access_token;

  if (!row.refresh_token) return row.access_token;
  const refreshed = await refreshGoogleToken(row.refresh_token);
  const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000);
  await saveCloudTokens(userId, 'google', refreshed.access_token, row.refresh_token, expiresAt);
  return refreshed.access_token;
}

export async function uploadToGoogleDrive(
  accessToken: string,
  fileName: string,
  mimeType: string,
  body: ArrayBuffer,
): Promise<{ id: string; webViewLink?: string }> {
  const metadata = { name: fileName, mimeType };
  const boundary = 'toolnest_boundary';
  const metaPart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`;
  const filePart = `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`;
  const end = `\r\n--${boundary}--`;

  const encoder = new TextEncoder();
  const metaBytes = encoder.encode(metaPart);
  const fileHeader = encoder.encode(filePart);
  const endBytes = encoder.encode(end);
  const combined = new Uint8Array(metaBytes.length + fileHeader.length + body.byteLength + endBytes.length);
  combined.set(metaBytes, 0);
  combined.set(fileHeader, metaBytes.length);
  combined.set(new Uint8Array(body), metaBytes.length + fileHeader.length);
  combined.set(endBytes, metaBytes.length + fileHeader.length + body.byteLength);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: combined,
    },
  );
  if (!res.ok) throw new Error('Google Drive upload failed');
  return (await res.json()) as { id: string; webViewLink?: string };
}

export interface DriveFileMeta {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
}

export async function listGoogleDriveFiles(accessToken: string, query = ''): Promise<DriveFileMeta[]> {
  const params = new URLSearchParams({
    pageSize: '25',
    orderBy: 'modifiedTime desc',
    fields: 'files(id,name,mimeType,size,modifiedTime)',
    q: query
      ? `name contains '${query.replace(/['"\\]/g, '')}' and trashed=false`
      : 'trashed=false and mimeType != "application/vnd.google-apps.folder"',
  });
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Could not list Google Drive files');
  const json = (await res.json()) as { files?: DriveFileMeta[] };
  return json.files ?? [];
}

export async function downloadGoogleDriveFile(
  accessToken: string,
  fileId: string,
): Promise<Response> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) throw new Error('Could not download the file from Google Drive');
  return res;
}
