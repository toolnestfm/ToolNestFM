import QRCode from 'qrcode';
import { apiErr, apiOk } from '@/lib/api-response';
import { readJson, requireApiKey } from '@/lib/api-v1';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/qr — generate a QR code. Free (API key required).
 * Body: { "text": "...", "size"?: 512, "format"?: "png" | "svg" }
 * Returns: { dataUrl } (png) or { svg } (svg)
 */
export async function POST(req: Request) {
  const gate = await requireApiKey(req, 60);
  if (!gate.ok) return gate.response;

  const body = await readJson<{ text?: string; size?: number; format?: string }>(req);
  if (!body) return apiErr('Invalid JSON body', 400);

  const text = body.text?.trim();
  if (!text) return apiErr('text is required', 400);
  if (text.length > 2000) return apiErr('text too large (max 2,000 characters)', 400);

  const size = Number.isInteger(body.size) && body.size! >= 64 && body.size! <= 2048 ? body.size! : 512;
  const format = body.format === 'svg' ? 'svg' : 'png';

  try {
    if (format === 'svg') {
      const svg = await QRCode.toString(text, { type: 'svg', width: size, margin: 2 });
      return apiOk({ svg, format });
    }
    const dataUrl = await QRCode.toDataURL(text, { width: size, margin: 2 });
    return apiOk({ dataUrl, format });
  } catch (err) {
    return apiErr(err instanceof Error ? err.message : 'QR generation failed', 500);
  }
}
