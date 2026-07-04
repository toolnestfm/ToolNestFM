import { getCloudTokens } from './google-drive';

export async function getValidDropboxAccessToken(userId: string): Promise<string | null> {
  const row = await getCloudTokens(userId, 'dropbox');
  if (!row) return null;
  return row.access_token;
}

export async function exchangeDropboxCode(code: string, redirectUri: string) {
  const appKey = process.env.DROPBOX_APP_KEY;
  const appSecret = process.env.DROPBOX_APP_SECRET;
  if (!appKey || !appSecret) throw new Error('Dropbox not configured');

  const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      client_id: appKey,
      client_secret: appSecret,
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) throw new Error('Dropbox token exchange failed');
  return (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };
}

export async function uploadToDropbox(
  accessToken: string,
  fileName: string,
  body: ArrayBuffer,
): Promise<{ path: string }> {
  const path = `/ToolNest/${fileName}`;
  const res = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify({ path, mode: 'add', autorename: true }),
    },
    body,
  });
  if (!res.ok) throw new Error('Dropbox upload failed');
  const json = (await res.json()) as { path_display?: string };
  return { path: json.path_display ?? path };
}

export interface DropboxFileMeta {
  id: string;
  name: string;
  path_lower: string;
  size: number;
  server_modified?: string;
}

export async function listDropboxFiles(accessToken: string): Promise<DropboxFileMeta[]> {
  const res = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: '', limit: 25 }),
  });
  if (!res.ok) throw new Error('Could not list Dropbox files');
  const json = (await res.json()) as { entries?: Array<DropboxFileMeta & { '.tag': string }> };
  return (json.entries ?? []).filter((e) => e['.tag'] === 'file');
}

export async function downloadDropboxFile(accessToken: string, path: string): Promise<Response> {
  const res = await fetch('https://content.dropboxapi.com/2/files/download', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Dropbox-API-Arg': JSON.stringify({ path }),
    },
  });
  if (!res.ok) throw new Error('Could not download the file from Dropbox');
  return res;
}
