'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from '@/components/Icon';
import {
  type WeatherBundle,
  type WeatherLocation,
  type WeatherIconKey,
  type QuickCurrent,
  searchLocations,
  fetchWeatherBundle,
  fetchCurrentTemp,
  detectGpsLocation,
  detectIpLocation,
  generateWeatherSummary,
  generateClothingAdvice,
  getFavorites,
  getRecents,
  toggleFavorite,
  isFavorite,
  addRecent,
  bgPreset,
  windDirLabel,
} from '@/lib/engines/weather-engine';

const WEATHER_EMOJI: Record<WeatherIconKey, string> = {
  clear: '☀️',
  partly: '⛅',
  cloudy: '☁️',
  fog: '🌫️',
  rain: '🌧️',
  snow: '❄️',
  storm: '⛈️',
  night: '🌙',
};

/** Seed cities shown in the Favorite Cities rail before the user saves any. */
const DEFAULT_CITIES: WeatherLocation[] = [
  { id: 1275004, name: 'Kolkata', region: 'West Bengal', country: 'India', countryCode: 'IN', lat: 22.5626, lon: 88.363, timezone: 'Asia/Kolkata', slug: 'kolkata-west-bengal-in' },
  { id: 2643743, name: 'London', region: 'England', country: 'United Kingdom', countryCode: 'GB', lat: 51.5085, lon: -0.1257, timezone: 'Europe/London', slug: 'london-england-gb' },
  { id: 5128581, name: 'New York', region: 'New York', country: 'United States', countryCode: 'US', lat: 40.7143, lon: -74.006, timezone: 'America/New_York', slug: 'new-york-new-york-us' },
  { id: 292223, name: 'Dubai', region: 'Dubai', country: 'United Arab Emirates', countryCode: 'AE', lat: 25.0657, lon: 55.1713, timezone: 'Asia/Dubai', slug: 'dubai-dubai-ae' },
];

type ViewKey = 'dashboard' | 'hourly' | '7day' | '14day' | 'maps' | 'air' | 'alerts' | 'astro' | 'compare';

const NAV: Array<{ key: ViewKey; label: string; emoji: string; badge?: string }> = [
  { key: 'dashboard', label: 'Dashboard', emoji: '🏠' },
  { key: 'hourly', label: 'Hourly Forecast', emoji: '🕐' },
  { key: '7day', label: '7 Day Forecast', emoji: '📅' },
  { key: '14day', label: '14 Day Forecast', emoji: '🗓️' },
  { key: 'maps', label: 'Weather Maps', emoji: '🗺️', badge: 'NEW' },
  { key: 'air', label: 'Air Quality', emoji: '🫧' },
  { key: 'alerts', label: 'Alerts', emoji: '🔔' },
  { key: 'astro', label: 'Astronomy', emoji: '🌙' },
  { key: 'compare', label: 'Compare Cities', emoji: '🏙️' },
];

function formatHour(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', hour12: true }).replace(':00', '');
}

function countryFlag(cc: string): string {
  if (!cc || cc.length !== 2) return '🌍';
  return cc.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

function aqiColor(aqi: number): string {
  if (aqi <= 50) return 'var(--success-green)';
  if (aqi <= 100) return '#eab308';
  if (aqi <= 150) return '#f97316';
  if (aqi <= 200) return '#ef4444';
  return '#991b1b';
}

function uvLabel(uv: number): string {
  if (uv <= 2) return 'Low';
  if (uv <= 5) return 'Moderate';
  if (uv <= 7) return 'High';
  if (uv <= 10) return 'Very High';
  return 'Extreme';
}

function scoreLabel(score: number): { label: string; color: string } {
  if (score >= 70) return { label: 'Good', color: 'var(--success-green)' };
  if (score >= 45) return { label: 'Moderate', color: '#eab308' };
  return { label: 'Poor', color: '#f97316' };
}

function windyUrl(lat: number, lon: number, overlay = 'rain'): string {
  return `https://embed.windy.com/embed2.html?lat=${lat}&lon=${lon}&detailLat=${lat}&detailLon=${lon}&zoom=6&level=surface&overlay=${overlay}&menu=&message=&marker=true&calendar=&pressure=&type=map&location=coordinates&detail=&metricWind=km%2Fh&metricTemp=%C2%B0C&radarRange=-1`;
}

/** Deterministic outdoor-activity scores from temp/wind/rain/aqi. */
function activityIndex(b: WeatherBundle): Array<{ name: string; icon: string; score: number }> {
  const t = b.current.tempC;
  const wind = b.current.windKph;
  const rain = b.hourly.slice(0, 6).reduce((m, h) => Math.max(m, h.precipProb), 0);
  const aqi = b.airQuality?.aqi ?? 40;
  const clamp = (n: number) => Math.max(5, Math.min(100, Math.round(n)));
  const tempComfort = (ideal: number, spread: number) => 100 - Math.abs(t - ideal) * (100 / spread);
  const aqiPenalty = aqi <= 50 ? 0 : (aqi - 50) * 0.5;
  const rainPenalty = rain * 0.6;
  return [
    { name: 'Running', icon: '🏃', score: clamp(tempComfort(16, 22) - wind * 0.8 - rainPenalty - aqiPenalty) },
    { name: 'Cycling', icon: '🚴', score: clamp(tempComfort(20, 24) - wind * 1.1 - rainPenalty - aqiPenalty) },
    { name: 'Hiking', icon: '🥾', score: clamp(tempComfort(18, 26) - wind * 0.5 - rainPenalty * 0.8 - aqiPenalty) },
    { name: 'Fishing', icon: '🎣', score: clamp(tempComfort(22, 30) - wind * 0.7 - rainPenalty * 0.4) },
    { name: 'Camping', icon: '⛺', score: clamp(tempComfort(21, 28) - wind * 0.9 - rainPenalty - aqiPenalty * 0.5) },
  ];
}

export default function WeatherRunner() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<WeatherLocation[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [bundle, setBundle] = useState<WeatherBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [favCities, setFavCities] = useState<WeatherLocation[]>([]);
  const [favTemps, setFavTemps] = useState<Record<string, QuickCurrent>>({});
  const [fav, setFav] = useState(false);
  const [aiSummary, setAiSummary] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [localTime, setLocalTime] = useState('');
  const [unit, setUnit] = useState<'c' | 'f'>('c');
  const [view, setView] = useState<ViewKey>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mapOverlay, setMapOverlay] = useState('rain');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const tp = useCallback((c: number) => (unit === 'f' ? Math.round((c * 9) / 5 + 32) : Math.round(c)), [unit]);
  const uSym = unit === 'f' ? '°F' : '°C';

  const loadLocation = useCallback(async (loc: WeatherLocation) => {
    setLoading(true);
    setError('');
    setSearchOpen(false);
    setQuery('');
    setSuggestions([]);
    setAiSummary('');
    setView('dashboard');
    setSidebarOpen(false);
    try {
      const data = await fetchWeatherBundle(loc);
      setBundle(data);
      addRecent(loc);
      setFav(isFavorite(loc.slug));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load weather');
    } finally {
      setLoading(false);
    }
  }, []);

  // Build the favorite-cities rail (saved favorites first, seeded defaults after).
  const refreshFavRail = useCallback(() => {
    const saved = getFavorites();
    const recents = getRecents();
    const merged: WeatherLocation[] = [];
    const seen = new Set<string>();
    for (const l of [...saved, ...recents, ...DEFAULT_CITIES]) {
      if (!seen.has(l.slug)) { seen.add(l.slug); merged.push(l); }
      if (merged.length >= 6) break;
    }
    setFavCities(merged);
    void Promise.all(
      merged.map(async (l) => {
        try { return [l.slug, await fetchCurrentTemp(l)] as const; }
        catch { return null; }
      }),
    ).then((rows) => {
      const map: Record<string, QuickCurrent> = {};
      for (const r of rows) if (r) map[r[0]] = r[1];
      setFavTemps(map);
    });
  }, []);

  // GPS first, then IP-based fallback, then a sensible default city.
  const detectLocation = useCallback(async () => {
    setError('');
    try {
      await loadLocation(await detectGpsLocation());
      return true;
    } catch { /* try IP next */ }
    try {
      await loadLocation(await detectIpLocation());
      return true;
    } catch {
      setError('Could not detect your location automatically — search your city above.');
      return false;
    }
  }, [loadLocation]);

  useEffect(() => {
    refreshFavRail();
    void (async () => {
      try { await loadLocation(await detectGpsLocation()); return; } catch { /* GPS denied/timeout */ }
      try { await loadLocation(await detectIpLocation()); return; } catch { /* IP failed */ }
      void loadLocation(DEFAULT_CITIES[0]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!bundle?.location.timezone) return;
    const tick = () => {
      setLocalTime(
        new Date().toLocaleString('en-US', {
          timeZone: bundle.location.timezone,
          weekday: 'long', day: '2-digit', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        }),
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [bundle?.location.timezone]);

  useEffect(() => {
    if (!query.trim()) { setSuggestions([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchLocations(query);
        setSuggestions(results);
        setSearchOpen(true);
      } catch { setSuggestions([]); }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const handleFavorite = () => {
    if (!bundle) return;
    toggleFavorite(bundle.location);
    setFav(isFavorite(bundle.location.slug));
    refreshFavRail();
  };

  const loadAi = useCallback(async () => {
    if (!bundle) return;
    setAiLoading(true);
    try { setAiSummary(await generateWeatherSummary(bundle)); }
    finally { setAiLoading(false); }
  }, [bundle]);

  useEffect(() => {
    if (bundle && !aiSummary && !aiLoading) void loadAi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundle]);

  const clothing = bundle ? generateClothingAdvice(bundle) : '';
  const bgClass = bundle ? bgPreset(bundle.current.icon) : 'wx-bg-cloudy';
  const activities = useMemo(() => (bundle ? activityIndex(bundle) : []), [bundle]);

  /* ── render helpers ─────────────────────────────────────────────────── */

  const HourStrip = (limit: number) => (
    <div className="wxp-hourly-scroll">
      {bundle!.hourly.slice(0, limit).map((h, i) => (
        <div key={h.time} className={`wxp-hour${i === 0 ? ' now' : ''}`}>
          <span className="wxp-hour-t">{i === 0 ? 'Now' : formatHour(h.time)}</span>
          <span className="wxp-hour-em">{WEATHER_EMOJI[h.icon]}</span>
          <strong>{tp(h.tempC)}°</strong>
          <span className="wxp-hour-rain">💧 {h.precipProb}%</span>
        </div>
      ))}
    </div>
  );

  const DailyStrip = (days: number, cols = false) => (
    <div className={cols ? 'wxp-daily-grid' : 'wxp-daily-list'}>
      {bundle!.daily.slice(0, days).map((d, i) => {
        const label = i === 0 ? 'Today' : new Date(d.date + 'T12:00:00').toLocaleDateString([], { weekday: cols ? 'short' : 'long' });
        const dm = new Date(d.date + 'T12:00:00').toLocaleDateString([], { day: 'numeric', month: 'short' });
        if (cols) {
          return (
            <div key={d.date} className="wxp-dday">
              <span className="wxp-dow">{label}</span>
              <span className="wxp-dom">{dm}</span>
              <span className="wxp-day-em">{WEATHER_EMOJI[d.icon]}</span>
              <span className="wxp-day-temps"><b>{tp(d.tempMaxC)}°</b> <em>{tp(d.tempMinC)}°</em></span>
              <span className="wxp-day-rain">💧 {d.precipProbMax}%</span>
            </div>
          );
        }
        return (
          <div key={d.date} className="wxp-drow">
            <span className="wxp-drow-day"><b>{label}</b><em>{dm}</em></span>
            <span className="wxp-day-em">{WEATHER_EMOJI[d.icon]}</span>
            <span className="wxp-drow-cond">{d.condition}</span>
            <span className="wxp-drow-rain">💧 {d.precipProbMax}%</span>
            <span className="wxp-drow-wind">💨 {Math.round(d.windMaxKph)}</span>
            <span className="wxp-drow-temps"><b>{tp(d.tempMaxC)}°</b> <em>{tp(d.tempMinC)}°</em></span>
          </div>
        );
      })}
    </div>
  );

  const AqiCard = () => bundle!.airQuality && (
    <div className="wxp-card wxp-aqi-card">
      <h3 className="wxp-card-h">Air Quality Index</h3>
      <div className="wxp-aqi-body">
        <div className="wxp-aqi-gauge" style={{ '--aqi-color': aqiColor(bundle!.airQuality.aqi) } as React.CSSProperties}>
          <span className="wxp-aqi-num">{bundle!.airQuality.aqi}</span>
          <span className="wxp-aqi-status">{bundle!.airQuality.status}</span>
        </div>
        <div className="wxp-pollutants">
          {[
            { label: 'PM2.5', value: bundle!.airQuality.pm25 },
            { label: 'PM10', value: bundle!.airQuality.pm10 },
            { label: 'O₃', value: bundle!.airQuality.ozone },
            { label: 'NO₂', value: bundle!.airQuality.no2 },
          ].map((p) => (
            <div key={p.label} className="wxp-pollutant"><span>{p.label}</span><b>{Math.round(p.value)}</b></div>
          ))}
        </div>
      </div>
      <p className="wxp-aqi-rec">{bundle!.airQuality.recommendation}</p>
    </div>
  );

  const AlertCard = () => (
    <div className="wxp-card wxp-alert-card">
      <h3 className="wxp-card-h"><span>⚠️</span> Weather Alert</h3>
      {bundle!.alerts.length > 0 ? (
        bundle!.alerts.slice(0, 3).map((a, i) => (
          <div key={i} className="wxp-alert">
            <b>{a.event}</b>
            {a.areas && <span className="wxp-alert-area">{a.areas}</span>}
            <p>{a.headline || a.desc}</p>
          </div>
        ))
      ) : (
        <p className="wxp-empty">✓ No active weather alerts for this area.</p>
      )}
    </div>
  );

  const DetailsCard = () => (
    <div className="wxp-card">
      <h3 className="wxp-card-h">Details</h3>
      <div className="wxp-details">
        {[
          { ic: '💧', label: 'Humidity', value: `${bundle!.current.humidity}%` },
          { ic: '💨', label: 'Wind', value: `${Math.round(bundle!.current.windKph)} km/h ${windDirLabel(bundle!.current.windDir)}` },
          { ic: '🌡️', label: 'Pressure', value: `${Math.round(bundle!.current.pressureMb)} mb` },
          { ic: '☁️', label: 'Cloud Cover', value: `${bundle!.current.cloudPct}%` },
          { ic: '☀️', label: 'UV Index', value: `${bundle!.current.uv ?? '—'} · ${uvLabel(bundle!.current.uv ?? 0)}` },
          { ic: '🌬️', label: 'Gusts', value: `${Math.round(bundle!.current.windGustKph)} km/h` },
        ].map((d) => (
          <div key={d.label} className="wxp-detail">
            <span className="wxp-detail-ic">{d.ic}</span>
            <span className="wxp-detail-label">{d.label}</span>
            <b className="wxp-detail-val">{d.value}</b>
          </div>
        ))}
      </div>
    </div>
  );

  /* ── main view switch ───────────────────────────────────────────────── */

  const renderView = () => {
    if (!bundle) return null;
    const loc = bundle.location;

    switch (view) {
      case 'hourly':
        return (
          <div className="wxp-view">
            <h2 className="wxp-view-title">Hourly Forecast · Next 48 Hours</h2>
            <div className="wxp-card">{HourStrip(48)}</div>
          </div>
        );
      case '7day':
        return (
          <div className="wxp-view">
            <h2 className="wxp-view-title">7 Day Forecast</h2>
            <div className="wxp-card">{DailyStrip(7)}</div>
          </div>
        );
      case '14day':
        return (
          <div className="wxp-view">
            <h2 className="wxp-view-title">14 Day Forecast</h2>
            <div className="wxp-card">{DailyStrip(14)}</div>
          </div>
        );
      case 'maps':
        return (
          <div className="wxp-view">
            <div className="wxp-map-head">
              <h2 className="wxp-view-title">Weather Map</h2>
              <div className="wxp-map-layers">
                {['rain', 'wind', 'temp', 'clouds', 'pressure'].map((o) => (
                  <button key={o} type="button" className={`wxp-layer${mapOverlay === o ? ' active' : ''}`}
                    onClick={() => setMapOverlay(o)}>{o[0].toUpperCase() + o.slice(1)}</button>
                ))}
              </div>
            </div>
            <div className="wxp-card wxp-map-full">
              <iframe title="Weather map" src={windyUrl(loc.lat, loc.lon, mapOverlay)} loading="lazy" />
            </div>
          </div>
        );
      case 'air':
        return (
          <div className="wxp-view">
            <h2 className="wxp-view-title">Air Quality · {loc.name}</h2>
            {AqiCard()}
          </div>
        );
      case 'alerts':
        return (
          <div className="wxp-view">
            <h2 className="wxp-view-title">Weather Alerts · {loc.name}</h2>
            {AlertCard()}
          </div>
        );
      case 'astro':
        return (
          <div className="wxp-view">
            <h2 className="wxp-view-title">Astronomy · {loc.name}</h2>
            <div className="wxp-astro-grid">
              <div className="wxp-card">
                <h3 className="wxp-card-h">☀️ Sun</h3>
                <div className="wxp-astro-rows">
                  <div><span>Sunrise</span><b>{bundle.astronomy.sunrise}</b></div>
                  <div><span>Sunset</span><b>{bundle.astronomy.sunset}</b></div>
                  <div><span>Solar noon</span><b>{bundle.astronomy.solarNoon}</b></div>
                  <div><span>Day length</span><b>{bundle.astronomy.dayLength}</b></div>
                  <div><span>Golden hour</span><b>{bundle.astronomy.goldenEvening}</b></div>
                  <div><span>Blue hour</span><b>{bundle.astronomy.blueEvening}</b></div>
                </div>
              </div>
              <div className="wxp-card">
                <h3 className="wxp-card-h">🌙 Moon</h3>
                <div className="wxp-moon-big">
                  <span className="wxp-moon-emoji">{bundle.astronomy.moonEmoji}</span>
                  <div>
                    <b>{bundle.astronomy.moonPhase}</b>
                    <span>{bundle.astronomy.moonIllumination}% illuminated</span>
                  </div>
                </div>
                <div className="wxp-astro-rows">
                  {bundle.astronomy.moonrise && <div><span>Moonrise</span><b>{bundle.astronomy.moonrise}</b></div>}
                  {bundle.astronomy.moonset && <div><span>Moonset</span><b>{bundle.astronomy.moonset}</b></div>}
                </div>
              </div>
            </div>
          </div>
        );
      case 'compare':
        return (
          <div className="wxp-view">
            <h2 className="wxp-view-title">Compare Cities</h2>
            <div className="wxp-compare-grid">
              {favCities.map((c) => {
                const q = favTemps[c.slug];
                return (
                  <button key={c.slug} type="button" className="wxp-compare-card" onClick={() => void loadLocation(c)}>
                    <span className="wxp-compare-flag">{countryFlag(c.countryCode)}</span>
                    <span className="wxp-compare-name">{c.name}</span>
                    <span className="wxp-compare-region">{c.country}</span>
                    <span className="wxp-compare-em">{q ? WEATHER_EMOJI[q.icon] : '⏳'}</span>
                    <strong className="wxp-compare-temp">{q ? `${tp(q.tempC)}${uSym}` : '…'}</strong>
                    <span className="wxp-compare-cond">{q?.condition ?? 'Loading…'}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      default:
        return renderDashboard();
    }
  };

  const renderDashboard = () => {
    if (!bundle) return null;
    return (
      <div className="wxp-dash">
        <div className="wxp-dash-left">
          {/* Hero */}
          <div className={`wxp-hero ${bgClass}`}>
            <div className="wxp-hero-top">
              <div>
                <h2 className="wxp-hero-city">
                  {bundle.location.name}
                  {bundle.location.region && <span>, {bundle.location.region}</span>}
                  <button type="button" className={`wxp-star${fav ? ' on' : ''}`} onClick={handleFavorite}
                    aria-label={fav ? 'Remove favorite' : 'Add favorite'}>{fav ? '★' : '☆'}</button>
                </h2>
                <p className="wxp-hero-date">{localTime}</p>
              </div>
              <span className="wxp-live"><i /> LIVE</span>
            </div>

            <div className="wxp-hero-body">
              <div className="wxp-hero-main">
                <span className="wxp-hero-em">{WEATHER_EMOJI[bundle.current.icon]}</span>
                <div>
                  <span className="wxp-temp">{tp(bundle.current.tempC)}<sup>{uSym}</sup></span>
                  <p className="wxp-cond">{bundle.current.condition}</p>
                  <p className="wxp-feels">Feels like {tp(bundle.current.feelsLikeC)}{uSym}</p>
                </div>
              </div>

              <div className="wxp-moon-panel">
                <div className="wxp-moon-row"><span>🌅 Sunrise</span><b>{bundle.astronomy.sunrise}</b></div>
                <div className="wxp-moon-row"><span>🌇 Sunset</span><b>{bundle.astronomy.sunset}</b></div>
                {bundle.astronomy.moonrise && <div className="wxp-moon-row"><span>🌘 Moonrise</span><b>{bundle.astronomy.moonrise}</b></div>}
                {bundle.astronomy.moonset && <div className="wxp-moon-row"><span>🌒 Moonset</span><b>{bundle.astronomy.moonset}</b></div>}
                <div className="wxp-moon-phase">
                  <span className="wxp-moon-emoji">{bundle.astronomy.moonEmoji}</span>
                  <div><b>{bundle.astronomy.moonPhase}</b><span>{bundle.astronomy.moonIllumination}% illuminated</span></div>
                </div>
              </div>
            </div>

            <div className="wxp-hero-mini">
              {bundle.airQuality && (
                <div className="wxp-mini">
                  <span className="wxp-mini-badge" style={{ background: aqiColor(bundle.airQuality.aqi) }}>{bundle.airQuality.aqi}</span>
                  <div><b>AQI</b><span>{bundle.airQuality.status}</span></div>
                </div>
              )}
              <div className="wxp-mini"><span className="wxp-mini-ic">☀️</span><div><b>UV {bundle.current.uv ?? '—'}</b><span>{uvLabel(bundle.current.uv ?? 0)}</span></div></div>
              <div className="wxp-mini"><span className="wxp-mini-ic">💨</span><div><b>{Math.round(bundle.current.windKph)} km/h</b><span>{windDirLabel(bundle.current.windDir)}</span></div></div>
            </div>
          </div>

          {/* Hourly */}
          <div className="wxp-card">
            <div className="wxp-card-h-row">
              <h3 className="wxp-card-h">Hourly Forecast</h3>
              <button type="button" className="wxp-link" onClick={() => setView('hourly')}>View Full Hourly →</button>
            </div>
            {HourStrip(12)}
          </div>

          {/* 7-day */}
          <div className="wxp-card">
            <div className="wxp-card-h-row">
              <h3 className="wxp-card-h">7 Day Forecast</h3>
              <button type="button" className="wxp-link" onClick={() => setView('7day')}>View Full 7 Days →</button>
            </div>
            {DailyStrip(7, true)}
          </div>

          {/* Bottom row */}
          <div className="wxp-bottom-row">
            <div className="wxp-card">
              <h3 className="wxp-card-h">✨ AI Weather Summary <span className="wxp-beta">BETA</span></h3>
              {aiLoading && <p className="wxp-empty">Generating…</p>}
              {aiSummary && <p className="wxp-ai-text">{aiSummary}</p>}
              {clothing && <p className="wxp-ai-clothing">👕 {clothing}</p>}
            </div>

            <div className="wxp-card">
              <h3 className="wxp-card-h">Outdoor Activity Index</h3>
              <div className="wxp-activities">
                {activities.map((a) => {
                  const s = scoreLabel(a.score);
                  return (
                    <div key={a.name} className="wxp-activity">
                      <span className="wxp-act-ic">{a.icon}</span>
                      <span className="wxp-act-name">{a.name}</span>
                      <b style={{ color: s.color }}>{a.score}</b>
                      <span className="wxp-act-label" style={{ color: s.color }}>{s.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {DetailsCard()}
          </div>
        </div>

        {/* Right rail */}
        <div className="wxp-dash-right">
          {AlertCard()}
          {AqiCard()}
          <div className="wxp-card wxp-map-card">
            <div className="wxp-card-h-row">
              <h3 className="wxp-card-h">Weather Map</h3>
              <button type="button" className="wxp-link" onClick={() => setView('maps')}>View Full Map →</button>
            </div>
            <div className="wxp-map-embed">
              <iframe title="Weather map preview" src={windyUrl(bundle.location.lat, bundle.location.lon)} loading="lazy" />
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ── shell ──────────────────────────────────────────────────────────── */

  return (
    <div className="wxp-tool">
      {sidebarOpen && <div className="wxp-backdrop" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`wxp-sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="wxp-brand">
          <span className="wxp-brand-ic">⛅</span>
          <div><b>World Weather</b><span>by ToolNest</span></div>
        </div>

        <div className="wxp-loc-card">
          <div className="wxp-loc-head"><Icon name="globe" size={16} /> My Location</div>
          <b className="wxp-loc-name">{bundle ? `${bundle.location.name}${bundle.location.region ? ', ' + bundle.location.region : ''}` : '—'}</b>
          <button type="button" className="wxp-detect" onClick={() => void detectLocation()}>
            <Icon name="refresh" size={14} /> Detect Location
          </button>
        </div>

        <nav className="wxp-nav">
          {NAV.map((n) => (
            <button key={n.key} type="button" className={`wxp-nav-item${view === n.key ? ' active' : ''}`}
              onClick={() => { setView(n.key); setSidebarOpen(false); }}>
              <span className="wxp-nav-em">{n.emoji}</span>
              <span className="wxp-nav-label">{n.label}</span>
              {n.badge && <span className="wxp-nav-badge">{n.badge}</span>}
            </button>
          ))}
        </nav>

        <div className="wxp-fav">
          <div className="wxp-fav-head">Favorite Cities</div>
          {favCities.map((c) => {
            const q = favTemps[c.slug];
            return (
              <button key={c.slug} type="button" className="wxp-fav-item" onClick={() => void loadLocation(c)}>
                <span className="wxp-fav-flag">{countryFlag(c.countryCode)}</span>
                <span className="wxp-fav-txt"><b>{c.name}</b><em>{c.country}</em></span>
                <span className="wxp-fav-em">{q ? WEATHER_EMOJI[q.icon] : ''}</span>
                <span className="wxp-fav-temp">{q ? `${tp(q.tempC)}°` : '…'}</span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Main */}
      <div className="wxp-main">
        <header className="wxp-header">
          <button type="button" className="wxp-menu-btn" aria-label="Menu" onClick={() => setSidebarOpen((v) => !v)}>
            <Icon name="menu" size={20} />
          </button>

          <div className="wxp-search" ref={searchRef}>
            <Icon name="search" size={16} />
            <input
              type="search"
              aria-label="Search city"
              placeholder="Search city, state, country or ZIP code…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => suggestions.length > 0 && setSearchOpen(true)}
            />
            {searchOpen && suggestions.length > 0 && (
              <ul className="wxp-suggestions" role="listbox">
                {suggestions.map((s) => (
                  <li key={s.slug}>
                    <button type="button" onClick={() => void loadLocation(s)}>
                      <span className="wxp-sug-flag">{countryFlag(s.countryCode)}</span>
                      <span className="wxp-sug-name">{s.name}</span>
                      <span className="wxp-sug-meta">{[s.region, s.country].filter(Boolean).join(', ')}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="wxp-header-actions">
            <button type="button" className="wxp-unit" onClick={() => setUnit((u) => (u === 'c' ? 'f' : 'c'))} aria-label="Toggle temperature unit">
              {uSym} <span>▾</span>
            </button>
            <button type="button" className="wxp-icon-btn" aria-label="Refresh" onClick={() => bundle && void loadLocation(bundle.location)}>
              <Icon name="refresh" size={18} />
            </button>
            <button type="button" className="wxp-icon-btn wxp-bell" aria-label="Alerts" onClick={() => setView('alerts')}>
              <Icon name="bell" size={18} />
              {bundle && bundle.alerts.length > 0 && <span className="wxp-bell-dot">{bundle.alerts.length}</span>}
            </button>
          </div>
        </header>

        <div className="wxp-content">
          {error && <div className="error-box">{error}</div>}
          {loading && <div className="wxp-loading">Loading weather data…</div>}
          {!loading && bundle && renderView()}
          <p className="wxp-credit">
            Powered by <a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer">Open-Meteo</a> · map by Windy · free, no signup
          </p>
        </div>
      </div>
    </div>
  );
}
