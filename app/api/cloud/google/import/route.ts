import { apiErr, apiOk } from '@/lib/api-response';
import { getCallerPlan, isProPlan } from '@/lib/share';
import {
  downloadGoogleDriveFile,
  getValidGoogleAccessToken,
  listGoogleDriveFiles,
} from '@/lib/cloud/google-drive';

export const dynamic = 'force-dynamic';

/** GET /api/cloud/google/import — list Drive files, or ?fileId= to download one (Pro). */
export async function GET(req: Request) {
  const { userId, plan } = await getCallerPlan();
  if (!userId || !isProPlan(plan)) return apiErr('Google Drive requires Pro', 403);

  const accessToken = await getValidGoogleAccessToken(userId);
  if (!accessToken) return apiErr('Connect Google Drive first', 401);

  const url = new URL(req.url);
  const fileId = url.searchParams.get('fileId');

  try {
    if (!fileId) {
      const files = await listGoogleDriveFiles(accessToken, url.searchParams.get('q') ?? '');
      return apiOk({ files });
    }

    const upstream = await downloadGoogleDriveFile(accessToken, fileId);
    return new Response(upstream.body, {
      headers: {
        'Content-Type': upstream.headers.get('Content-Type') ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return apiErr(e instanceof Error ? e.message : 'Google Drive import failed', 500);
  }
}
