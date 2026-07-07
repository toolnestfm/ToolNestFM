'use client';

import { aiComplete } from '@/lib/ai';

/* ─── Open-Meteo — free, no API key, CORS-enabled ─────────────────────── */

const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const AQI_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';

const FAV_KEY = 'toolnest_weather_favorites';
const RECENT_KEY = 'toolnest_weather_recent';

export interface WeatherLocation {
  id: number;
  name: string;
  region: string;
  country: string;
  countryCode: string;
  lat: number;
  lon: number;
  timezone: string;
  slug: string;
  elevation?: number;
}

export interface CurrentWeather {
  time: string;
  tempC: number;
  feelsLikeC: number;
  humidity: number;
  weatherCode: number;
  condition: string;
  icon: WeatherIconKey;
  windKph: number;
  windDir: number;
  windGustKph: number;
  pressureMb: number;
  cloudPct: number;
  precipMm: number;
  isDay: boolean;
  uv?: number;
}

export interface HourlyForecast {
  time: string;
  tempC: number;
  humidity: number;
  precipProb: number;
  weatherCode: number;
  condition: string;
  icon: WeatherIconKey;
  windKph: number;
}

export interface DailyForecast {
  date: string;
  tempMaxC: number;
  tempMinC: number;
  weatherCode: number;
  condition: string;
  icon: WeatherIconKey;
  sunrise: string;
  sunset: string;
  precipProbMax: number;
  uvMax: number;
  windMaxKph: number;
}

export interface AirQuality {
  aqi: number;
  status: string;
  recommendation: string;
  pm25: number;
  pm10: number;
  ozone: number;
  no2: number;
}

export interface AstronomyInfo {
  sunrise: string;
  sunset: string;
  goldenMorning: string;
  goldenEvening: string;
  blueMorning: string;
  blueEvening: string;
  solarNoon: string;
  dayLength: string;
  moonPhase: string;
  moonIllumination: number;
  moonEmoji: string;
  moonrise?: string;
  moonset?: string;
}

export interface WeatherAlert {
  headline: string;
  event: string;
  severity: string;
  areas: string;
  desc: string;
  effective?: string;
}

export interface WeatherBundle {
  location: WeatherLocation;
  current: CurrentWeather;
  hourly: HourlyForecast[];
  daily: DailyForecast[];
  airQuality: AirQuality | null;
  astronomy: AstronomyInfo;
  alerts: WeatherAlert[];
  fetchedAt: number;
}

export type WeatherIconKey = 'clear' | 'partly' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'storm' | 'night';

/* ─── WMO weather codes → human labels ──────────────────────────────────── */

const WMO: Record<number, { label: string; icon: WeatherIconKey }> = {
  0: { label: 'Clear sky', icon: 'clear' },
  1: { label: 'Mainly clear', icon: 'partly' },
  2: { label: 'Partly cloudy', icon: 'partly' },
  3: { label: 'Overcast', icon: 'cloudy' },
  45: { label: 'Foggy', icon: 'fog' },
  48: { label: 'Depositing rime fog', icon: 'fog' },
  51: { label: 'Light drizzle', icon: 'rain' },
  53: { label: 'Moderate drizzle', icon: 'rain' },
  55: { label: 'Dense drizzle', icon: 'rain' },
  56: { label: 'Freezing drizzle', icon: 'rain' },
  57: { label: 'Dense freezing drizzle', icon: 'rain' },
  61: { label: 'Slight rain', icon: 'rain' },
  63: { label: 'Moderate rain', icon: 'rain' },
  65: { label: 'Heavy rain', icon: 'rain' },
  66: { label: 'Freezing rain', icon: 'rain' },
  67: { label: 'Heavy freezing rain', icon: 'rain' },
  71: { label: 'Slight snow', icon: 'snow' },
  73: { label: 'Moderate snow', icon: 'snow' },
  75: { label: 'Heavy snow', icon: 'snow' },
  77: { label: 'Snow grains', icon: 'snow' },
  80: { label: 'Slight rain showers', icon: 'rain' },
  81: { label: 'Moderate rain showers', icon: 'rain' },
  82: { label: 'Violent rain showers', icon: 'storm' },
  85: { label: 'Slight snow showers', icon: 'snow' },
  86: { label: 'Heavy snow showers', icon: 'snow' },
  95: { label: 'Thunderstorm', icon: 'storm' },
  96: { label: 'Thunderstorm with hail', icon: 'storm' },
  99: { label: 'Thunderstorm with heavy hail', icon: 'storm' },
};

export function wmoInfo(code: number, isDay = true): { label: string; icon: WeatherIconKey } {
  const info = WMO[code] || { label: 'Unknown', icon: 'cloudy' as WeatherIconKey };
  if (!isDay && (info.icon === 'clear' || info.icon === 'partly')) {
    return { label: info.label, icon: 'night' };
  }
  return info;
}

export function windDirLabel(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}

function slugify(name: string, region: string, cc: string): string {
  const s = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return [s(name), s(region), s(cc)].filter(Boolean).join('-');
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function addMinutes(iso: string, mins: number): string {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() + mins);
  return formatTime(d.toISOString());
}

function aqiCategory(aqi: number): { status: string; recommendation: string } {
  if (aqi <= 50) return { status: 'Good', recommendation: 'Ideal for outdoor activity' };
  if (aqi <= 100) return { status: 'Moderate', recommendation: 'Sensitive groups should reduce prolonged exertion' };
  if (aqi <= 150) return { status: 'Unhealthy (Sensitive)', recommendation: 'Children and elderly should limit outdoor time' };
  if (aqi <= 200) return { status: 'Unhealthy', recommendation: 'Everyone should reduce prolonged outdoor exertion' };
  if (aqi <= 300) return { status: 'Very Unhealthy', recommendation: 'Avoid outdoor activity' };
  return { status: 'Hazardous', recommendation: 'Stay indoors, use air purifier' };
}

function moonInfo(date: Date): { label: string; illumination: number; emoji: string } {
  const synodic = 29.530588853;
  const ref = new Date('2000-01-06T18:14:00Z').getTime();
  let age = ((date.getTime() - ref) / 86400000) % synodic;
  if (age < 0) age += synodic;
  // Illuminated fraction of the disc: 0 at new, 100 at full.
  const illumination = Math.round(((1 - Math.cos((2 * Math.PI * age) / synodic)) / 2) * 100);
  let label: string;
  let emoji: string;
  if (age < 1.85) { label = 'New Moon'; emoji = '🌑'; }
  else if (age < 7.38) { label = 'Waxing Crescent'; emoji = '🌒'; }
  else if (age < 11.07) { label = 'First Quarter'; emoji = '🌓'; }
  else if (age < 14.77) { label = 'Waxing Gibbous'; emoji = '🌔'; }
  else if (age < 18.45) { label = 'Full Moon'; emoji = '🌕'; }
  else if (age < 22.14) { label = 'Waning Gibbous'; emoji = '🌖'; }
  else if (age < 25.83) { label = 'Last Quarter'; emoji = '🌗'; }
  else { label = 'Waning Crescent'; emoji = '🌘'; }
  return { label, illumination, emoji };
}

function buildAstronomy(sunrise: string, sunset: string): AstronomyInfo {
  const sr = new Date(sunrise);
  const ss = new Date(sunset);
  const moon = moonInfo(sr);
  const noon = new Date((sr.getTime() + ss.getTime()) / 2);
  const dayMs = ss.getTime() - sr.getTime();
  const hrs = Math.floor(dayMs / 3600000);
  const mins = Math.round((dayMs % 3600000) / 60000);

  return {
    sunrise: formatTime(sunrise),
    sunset: formatTime(sunset),
    goldenMorning: `${formatTime(sunrise)} – ${addMinutes(sunrise, 60)}`,
    goldenEvening: `${addMinutes(sunset, -60)} – ${formatTime(sunset)}`,
    blueMorning: `${addMinutes(sunrise, -30)} – ${formatTime(sunrise)}`,
    blueEvening: `${formatTime(sunset)} – ${addMinutes(sunset, 30)}`,
    solarNoon: formatTime(noon.toISOString()),
    dayLength: `${hrs}h ${mins}m`,
    moonPhase: moon.label,
    moonIllumination: moon.illumination,
    moonEmoji: moon.emoji,
  };
}

/* ─── API calls ─────────────────────────────────────────────────────────── */

export async function searchLocations(query: string): Promise<WeatherLocation[]> {
  if (!query.trim()) return [];
  const params = new URLSearchParams({
    name: query.trim(),
    count: '10',
    language: 'en',
    format: 'json',
  });
  const res = await fetch(`${GEO_URL}?${params}`);
  if (!res.ok) throw new Error('Location search failed');
  const data = await res.json() as {
    results?: Array<{
      id: number; name: string; latitude: number; longitude: number;
      country: string; country_code: string; admin1?: string;
      timezone: string; elevation?: number;
    }>;
  };
  return (data.results || []).map((r) => ({
    id: r.id,
    name: r.name,
    region: r.admin1 || '',
    country: r.country,
    countryCode: r.country_code,
    lat: r.latitude,
    lon: r.longitude,
    timezone: r.timezone,
    elevation: r.elevation,
    slug: slugify(r.name, r.admin1 || '', r.country_code),
  }));
}

/** Lightweight current-conditions fetch for favorite-city list tiles. */
export interface QuickCurrent {
  tempC: number;
  icon: WeatherIconKey;
  condition: string;
}

export async function fetchCurrentTemp(loc: WeatherLocation): Promise<QuickCurrent> {
  const params = new URLSearchParams({
    latitude: String(loc.lat),
    longitude: String(loc.lon),
    timezone: 'auto',
    current: 'temperature_2m,weather_code,is_day',
  });
  const res = await fetch(`${FORECAST_URL}?${params}`);
  if (!res.ok) throw new Error('Quick weather unavailable');
  const data = await res.json() as { current: Record<string, number> };
  const code = Number(data.current.weather_code);
  const isDay = Number(data.current.is_day) === 1;
  const info = wmoInfo(code, isDay);
  return { tempC: Number(data.current.temperature_2m), icon: info.icon, condition: info.label };
}

export async function fetchWeatherBundle(loc: WeatherLocation): Promise<WeatherBundle> {
  const fp = new URLSearchParams({
    latitude: String(loc.lat),
    longitude: String(loc.lon),
    timezone: 'auto',
    forecast_days: '14',
    current: [
      'temperature_2m', 'relative_humidity_2m', 'apparent_temperature', 'is_day',
      'precipitation', 'weather_code', 'cloud_cover', 'pressure_msl',
      'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m',
    ].join(','),
    hourly: [
      'temperature_2m', 'relative_humidity_2m', 'precipitation_probability',
      'weather_code', 'wind_speed_10m',
    ].join(','),
    daily: [
      'weather_code', 'temperature_2m_max', 'temperature_2m_min',
      'sunrise', 'sunset', 'precipitation_probability_max',
      'uv_index_max', 'wind_speed_10m_max',
    ].join(','),
  });

  const [forecastRes, aqiRes] = await Promise.all([
    fetch(`${FORECAST_URL}?${fp}`),
    fetch(`${AQI_URL}?${new URLSearchParams({
      latitude: String(loc.lat),
      longitude: String(loc.lon),
      timezone: 'auto',
      current: 'us_aqi,pm2_5,pm10,ozone,nitrogen_dioxide',
    })}`),
  ]);

  if (!forecastRes.ok) throw new Error('Weather data unavailable');
  const fc = await forecastRes.json() as {
    current: Record<string, number | string>;
    current_units: Record<string, string>;
    hourly: Record<string, (number | string)[]>;
    daily: Record<string, (number | string)[]>;
  };

  const curCode = Number(fc.current.weather_code);
  const isDay = Number(fc.current.is_day) === 1;
  const curInfo = wmoInfo(curCode, isDay);

  const current: CurrentWeather = {
    time: String(fc.current.time),
    tempC: Number(fc.current.temperature_2m),
    feelsLikeC: Number(fc.current.apparent_temperature),
    humidity: Number(fc.current.relative_humidity_2m),
    weatherCode: curCode,
    condition: curInfo.label,
    icon: curInfo.icon,
    windKph: Number(fc.current.wind_speed_10m),
    windDir: Number(fc.current.wind_direction_10m),
    windGustKph: Number(fc.current.wind_gusts_10m),
    pressureMb: Number(fc.current.pressure_msl),
    cloudPct: Number(fc.current.cloud_cover),
    precipMm: Number(fc.current.precipitation),
    isDay,
  };

  const hourly: HourlyForecast[] = (fc.hourly.time as string[]).slice(0, 48).map((t, i) => {
    const code = Number(fc.hourly.weather_code[i]);
    const hr = new Date(t).getHours();
    const day = hr >= 6 && hr < 20;
    const info = wmoInfo(code, day);
    return {
      time: t,
      tempC: Number(fc.hourly.temperature_2m[i]),
      humidity: Number(fc.hourly.relative_humidity_2m[i]),
      precipProb: Number(fc.hourly.precipitation_probability[i]),
      weatherCode: code,
      condition: info.label,
      icon: info.icon,
      windKph: Number(fc.hourly.wind_speed_10m[i]),
    };
  });

  const daily: DailyForecast[] = (fc.daily.time as string[]).map((date, i) => {
    const code = Number(fc.daily.weather_code[i]);
    const info = wmoInfo(code, true);
    return {
      date,
      tempMaxC: Number(fc.daily.temperature_2m_max[i]),
      tempMinC: Number(fc.daily.temperature_2m_min[i]),
      weatherCode: code,
      condition: info.label,
      icon: info.icon,
      sunrise: String(fc.daily.sunrise[i]),
      sunset: String(fc.daily.sunset[i]),
      precipProbMax: Number(fc.daily.precipitation_probability_max[i]),
      uvMax: Number(fc.daily.uv_index_max[i]),
      windMaxKph: Number(fc.daily.wind_speed_10m_max[i]),
    };
  });

  let airQuality: AirQuality | null = null;
  if (aqiRes.ok) {
    const aq = await aqiRes.json() as { current: Record<string, number> };
    const aqi = Math.round(Number(aq.current.us_aqi) || 0);
    const cat = aqiCategory(aqi);
    airQuality = {
      aqi,
      status: cat.status,
      recommendation: cat.recommendation,
      pm25: Number(aq.current.pm2_5) || 0,
      pm10: Number(aq.current.pm10) || 0,
      ozone: Number(aq.current.ozone) || 0,
      no2: Number(aq.current.nitrogen_dioxide) || 0,
    };
  }

  const astronomy = buildAstronomy(String(fc.daily.sunrise[0]), String(fc.daily.sunset[0]));

  if (daily[0]) current.uv = daily[0].uvMax;

  // Best-effort enrichment (moonrise/moonset + severe alerts) via WeatherAPI.
  // Degrades silently if the WEATHERAPI_KEY env is not configured.
  let alerts: WeatherAlert[] = [];
  try {
    const enrichRes = await fetch(`/api/weather/enrich?lat=${loc.lat}&lon=${loc.lon}`);
    if (enrichRes.ok) {
      const enr = await enrichRes.json() as {
        success: boolean;
        data?: { alerts: WeatherAlert[]; moonrise?: string; moonset?: string };
      };
      if (enr.success && enr.data) {
        alerts = enr.data.alerts ?? [];
        if (enr.data.moonrise) astronomy.moonrise = enr.data.moonrise;
        if (enr.data.moonset) astronomy.moonset = enr.data.moonset;
      }
    }
  } catch { /* enrichment is optional */ }

  return { location: loc, current, hourly, daily, airQuality, astronomy, alerts, fetchedAt: Date.now() };
}

export async function detectGpsLocation(): Promise<WeatherLocation> {
  const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) reject(new Error('Geolocation not supported'));
    else navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 12000 });
  });
  const { latitude, longitude } = pos.coords;
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    language: 'en',
    format: 'json',
  });
  const res = await fetch(`${GEO_URL}?${params}`);
  if (!res.ok) throw new Error('Could not resolve your location');
  const data = await res.json() as { results?: Array<{ id: number; name: string; latitude: number; longitude: number; country: string; country_code: string; admin1?: string; timezone: string }> };
  const r = data.results?.[0];
  if (!r) {
    return {
      id: 0,
      name: 'My Location',
      region: '',
      country: '',
      countryCode: '',
      lat: latitude,
      lon: longitude,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      slug: 'my-location',
    };
  }
  return {
    id: r.id,
    name: r.name,
    region: r.admin1 || '',
    country: r.country,
    countryCode: r.country_code,
    lat: r.latitude,
    lon: r.longitude,
    timezone: r.timezone,
    slug: slugify(r.name, r.admin1 || '', r.country_code),
  };
}

/* ─── AI summary (free chain via ToolNest AI) ───────────────────────────── */

export async function generateWeatherSummary(bundle: WeatherBundle): Promise<string> {
  const { location, current, daily, airQuality } = bundle;
  const today = daily[0];
  const payload = {
    city: `${location.name}, ${location.country}`,
    now: `${current.tempC}°C, ${current.condition}, feels like ${current.feelsLikeC}°C`,
    wind: `${current.windKph} km/h ${windDirLabel(current.windDir)}`,
    humidity: `${current.humidity}%`,
    today: today ? `high ${today.tempMaxC}°C, low ${today.tempMinC}°C, rain ${today.precipProbMax}%` : '',
    aqi: airQuality ? `${airQuality.aqi} (${airQuality.status})` : 'unavailable',
  };

  try {
    return await aiComplete(
      [{ role: 'user', content: `Write a 1-2 sentence friendly weather summary for a user. Data: ${JSON.stringify(payload)}` }],
      'You are a weather assistant. Be concise, practical, no markdown, no bullet points.',
    );
  } catch {
    return `${location.name}: ${current.tempC}°C and ${current.condition.toLowerCase()}. Feels like ${current.feelsLikeC}°C with ${current.humidity}% humidity.${today ? ` Today ${today.tempMinC}–${today.tempMaxC}°C.` : ''}`;
  }
}

export function generateClothingAdvice(bundle: WeatherBundle): string {
  const t = bundle.current.feelsLikeC;
  const rain = bundle.daily[0]?.precipProbMax ?? 0;
  const wind = bundle.current.windKph;
  let base: string;
  if (t >= 30) base = 'Light breathable clothing, hat and sunscreen recommended.';
  else if (t >= 22) base = 'T-shirt and light layers — comfortable for most activities.';
  else if (t >= 15) base = 'Long sleeves or a light jacket advised.';
  else if (t >= 5) base = 'Warm jacket and layers — it will feel chilly.';
  else if (t >= -5) base = 'Heavy coat, gloves and warm layers essential.';
  else base = 'Extreme cold gear — minimize exposed skin.';
  if (rain > 50) base += ' Bring an umbrella or rain jacket.';
  if (wind > 40) base += ' Windproof outer layer recommended.';
  return base;
}

export function outdoorScore(bundle: WeatherBundle): { score: number; reason: string } {
  let score = 70;
  const { current, daily } = bundle;
  const rain = daily[0]?.precipProbMax ?? 0;
  if (rain > 70) score -= 30;
  else if (rain > 40) score -= 15;
  if (current.weatherCode >= 95) score -= 40;
  if (current.tempC < 0 || current.tempC > 38) score -= 20;
  if (bundle.airQuality && bundle.airQuality.aqi > 100) score -= 25;
  if (current.windKph > 50) score -= 15;
  score = Math.max(0, Math.min(100, score));
  const reason = score >= 80 ? 'Great conditions for outdoor activities'
    : score >= 60 ? 'Acceptable — check rain and wind'
    : score >= 40 ? 'Fair — consider indoor alternatives'
    : 'Poor — better to stay indoors';
  return { score, reason };
}

/* ─── Favorites & recents (localStorage) ────────────────────────────────── */

export function getFavorites(): WeatherLocation[] {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY) || '[]') as WeatherLocation[];
  } catch { return []; }
}

export function toggleFavorite(loc: WeatherLocation): WeatherLocation[] {
  const list = getFavorites();
  const idx = list.findIndex((f) => f.slug === loc.slug);
  const next = idx >= 0 ? list.filter((_, i) => i !== idx) : [loc, ...list].slice(0, 10);
  localStorage.setItem(FAV_KEY, JSON.stringify(next));
  return next;
}

export function isFavorite(slug: string): boolean {
  return getFavorites().some((f) => f.slug === slug);
}

export function getRecents(): WeatherLocation[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') as WeatherLocation[];
  } catch { return []; }
}

export function addRecent(loc: WeatherLocation): void {
  const list = getRecents().filter((r) => r.slug !== loc.slug);
  list.unshift(loc);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 10)));
}

export function bgPreset(icon: WeatherIconKey): string {
  const map: Record<WeatherIconKey, string> = {
    clear: 'wx-bg-clear',
    partly: 'wx-bg-partly',
    cloudy: 'wx-bg-cloudy',
    fog: 'wx-bg-fog',
    rain: 'wx-bg-rain',
    snow: 'wx-bg-snow',
    storm: 'wx-bg-storm',
    night: 'wx-bg-night',
  };
  return map[icon] || 'wx-bg-cloudy';
}
