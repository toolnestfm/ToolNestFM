import { apiErr } from '@/lib/api-response';
import { clientIp, rateLimit, rateLimitResponse } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 50 * 1024 * 1024; // 50MB ceiling for remote PDFs

/** GET /api/fetch-pdf?url=... — server-side proxy so the browser can import a
 *  PDF from a remote URL without hitting CORS. Streams the file back. */
export async function GET(req: Request) {
  const rl = rateLimit(`fetchpdf:${clientIp(req)}`, 15, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds);

  const raw = new URL(req.url).searchParams.get('url');
  if (!raw) return apiErr('url is required', 400);

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return apiErr('Invalid URL', 400);
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    return apiErr('Only http/https URLs are supported', 400);
  }
  // Block obvious SSRF targets (localhost / private ranges by hostname).
  const host = target.hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local') || /^(10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) {
    return apiErr('That host is not allowed', 400);
  }

  let upstream: Response;
  try {
    upstream = await fetch(target.toString(), {
      redirect: 'follow',
      headers: { 'User-Agent': 'ToolNestFM-PDF-Fetcher/1.0' },
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return apiErr('Could not reach that URL', 502);
  }

  if (!upstream.ok) return apiErr(`Remote server returned ${upstream.status}`, 502);

  const type = upstream.headers.get('content-type') ?? '';
  const len = Number(upstream.headers.get('content-length') ?? 0);
  if (len && len > MAX_BYTES) return apiErr('Remote file exceeds 50MB', 413);

  const buf = new Uint8Array(await upstream.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) return apiErr('Remote file exceeds 50MB', 413);

  // Confirm it is actually a PDF (header check), regardless of content-type.
  const isPdf = type.includes('application/pdf') || (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46);
  if (!isPdf) return apiErr('That URL is not a PDF file', 415);

  const name = decodeURIComponent(target.pathname.split('/').pop() || 'document.pdf').replace(/[^\w.-]/g, '_');

  return new Response(buf, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${name.endsWith('.pdf') ? name : name + '.pdf'}"`,
      'Cache-Control': 'no-store',
    },
  });
}
