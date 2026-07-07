import { apiErr, apiOk } from '@/lib/api-response';
import { clientIp, rateLimit, rateLimitResponse } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * GET /api/weather/enrich?lat=&lon=
 * Server-side WeatherAPI.com proxy (key never reaches the client) that returns
 * severe-weather alerts + moonrise/moonset — the pieces Open-Meteo doesn't give.
 * If WEATHERAPI_KEY is unset it returns an empty payload so the tool degrades
 * gracefully (still fully usable via Open-Meteo).
 */
export async function GET(req: Request) {
  const rl = rateLimit(`wx:${clientIp(req)}`, 60, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds);

  const url = new URL(req.url);
  const lat = Number(url.searchParams.get('lat'));
  const lon = Number(url.searchParams.get('lon'));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return apiErr('lat and lon required', 400);

  const key = process.env.WEATHERAPI_KEY;
  if (!key) return apiOk({ alerts: [], moonrise: null, moonset: null });

  try {
    const wxUrl = `https://api.weatherapi.com/v1/forecast.json?key=${key}&q=${lat},${lon}&days=1&aqi=no&alerts=yes`;
    const res = await fetch(wxUrl, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return apiOk({ alerts: [], moonrise: null, moonset: null });

    const json = (await res.json()) as {
      forecast?: { forecastday?: Array<{ astro?: { moonrise?: string; moonset?: string } }> };
      alerts?: { alert?: Array<{ headline?: string; event?: string; severity?: string; areas?: string; desc?: string; effective?: string }> };
    };

    const astro = json.forecast?.forecastday?.[0]?.astro;
    const alerts = (json.alerts?.alert ?? [])
      .filter((a) => a.headline || a.event)
      .slice(0, 5)
      .map((a) => ({
        headline: a.headline ?? a.event ?? 'Weather alert',
        event: a.event ?? 'Alert',
        severity: a.severity ?? 'Moderate',
        areas: a.areas ?? '',
        desc: (a.desc ?? '').slice(0, 600),
        effective: a.effective,
      }));

    return apiOk({
      alerts,
      moonrise: astro?.moonrise ?? null,
      moonset: astro?.moonset ?? null,
    });
  } catch {
    return apiOk({ alerts: [], moonrise: null, moonset: null });
  }
}
