import { apiErr, apiOk } from '@/lib/api-response';
import { getCallerPlan, isProPlan } from '@/lib/share';
import {
  downloadDropboxFile,
  getValidDropboxAccessToken,
  listDropboxFiles,
} from '@/lib/cloud/dropbox';

export const dynamic = 'force-dynamic';

/** GET /api/cloud/dropbox/import — list files, or ?path= to download one (Pro). */
export async function GET(req: Request) {
  const { userId, plan } = await getCallerPlan();
  if (!userId || !isProPlan(plan)) return apiErr('Dropbox requires Pro', 403);

  const accessToken = await getValidDropboxAccessToken(userId);
  if (!accessToken) return apiErr('Connect Dropbox first', 401);

  const url = new URL(req.url);
  const path = url.searchParams.get('path');

  try {
    if (!path) {
      const files = await listDropboxFiles(accessToken);
      return apiOk({ files });
    }

    const upstream = await downloadDropboxFile(accessToken, path);
    return new Response(upstream.body, {
      headers: {
        'Content-Type': upstream.headers.get('Content-Type') ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return apiErr(e instanceof Error ? e.message : 'Dropbox import failed', 500);
  }
}
