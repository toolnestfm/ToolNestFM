'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '@/components/Icon';
import {
  type WeatherBundle,
  type WeatherLocation,
  type WeatherIconKey,
  searchLocations,
  fetchWeatherBundle,
  detectGpsLocation,
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

const QUICK_CITIES = ['London', 'New York', 'Tokyo', 'Dhaka', 'Dubai', 'Sydney'];

function formatHour(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
  const [favorites, setFavorites] = useState<WeatherLocation[]>([]);
  const [recents, setRecents] = useState<WeatherLocation[]>([]);
  const [fav, setFav] = useState(false);
  const [aiSummary, setAiSummary] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [localTime, setLocalTime] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const loadLocation = useCallback(async (loc: WeatherLocation) => {
    setLoading(true);
    setError('');
    setSearchOpen(false);
    setQuery('');
    setSuggestions([]);
    setAiSummary('');
    try {
      const data = await fetchWeatherBundle(loc);
      setBundle(data);
      addRecent(loc);
      setRecents(getRecents());
      setFav(isFavorite(loc.slug));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load weather');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setFavorites(getFavorites());
    setRecents(getRecents());
    void detectGpsLocation()
      .then(loadLocation)
      .catch(() => { /* user can search manually */ });
  }, [loadLocation]);

  useEffect(() => {
    if (!bundle?.location.timezone) return;
    const tick = () => {
      setLocalTime(
        new Date().toLocaleTimeString('en-US', {
          timeZone: bundle.location.timezone,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [bundle?.location.timezone]);

  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchLocations(query);
        setSuggestions(results);
        setSearchOpen(true);
      } catch {
        setSuggestions([]);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const handleFavorite = () => {
    if (!bundle) return;
    const next = toggleFavorite(bundle.location);
    setFavorites(next);
    setFav(isFavorite(bundle.location.slug));
  };

  const loadAi = async () => {
    if (!bundle || aiSummary) return;
    setAiLoading(true);
    try {
      const text = await generateWeatherSummary(bundle);
      setAiSummary(text);
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    if (bundle && !aiSummary && !aiLoading) void loadAi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundle]);

  const clothing = bundle ? generateClothingAdvice(bundle) : '';
  const bgClass = bundle ? bgPreset(bundle.current.icon) : 'wx-bg-cloudy';
  const activities = bundle ? activityIndex(bundle) : [];

  return (
    <div className={`weather-tool ${bgClass}`}>
      <div className="weather-inner">
        {/* Search */}
        <div className="weather-search-wrap" ref={searchRef}>
          <div className="weather-search-bar">
            <Icon name="search" size={18} />
            <input
              type="search"
              role="combobox"
              aria-expanded={searchOpen && suggestions.length > 0}
              aria-controls="weather-suggestions-list"
              aria-autocomplete="list"
              aria-label="Search city or location"
              placeholder="Search any city… (London, Dhaka, Tokyo)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => suggestions.length > 0 && setSearchOpen(true)}
            />
            <button
              type="button"
              className="weather-gps-btn"
              aria-label="Use my location"
              onClick={() => void detectGpsLocation().then(loadLocation).catch(() => setError('Could not detect location'))}
            >
              <Icon name="globe" size={16} />
            </button>
          </div>
          {searchOpen && suggestions.length > 0 && (
            <ul className="weather-suggestions" role="listbox" id="weather-suggestions-list">
              {suggestions.map((s) => (
                <li key={s.slug}>
                  <button type="button" role="option" aria-selected={false} onClick={() => void loadLocation(s)}>
                    <span className="weather-sug-name">{s.name}</span>
                    <span className="weather-sug-meta">{[s.region, s.country].filter(Boolean).join(', ')}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Quick chips */}
        {!bundle && !loading && (
          <div className="weather-chips">
            <span className="weather-chips-label">Popular:</span>
            {QUICK_CITIES.map((c) => (
              <button
                key={c}
                type="button"
                className="weather-chip"
                onClick={async () => {
                  const r = await searchLocations(c);
                  if (r[0]) void loadLocation(r[0]);
                }}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {/* Favorites & recents */}
        {(favorites.length > 0 || recents.length > 0) && !bundle && (
          <div className="weather-saved">
            {favorites.length > 0 && (
              <div>
                <p className="weather-saved-label">★ Favorites</p>
                <div className="weather-chips">
                  {favorites.map((f) => (
                    <button key={f.slug} type="button" className="weather-chip" onClick={() => void loadLocation(f)}>
                      {f.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {recents.length > 0 && (
              <div>
                <p className="weather-saved-label">Recent</p>
                <div className="weather-chips">
                  {recents.slice(0, 5).map((r) => (
                    <button key={r.slug} type="button" className="weather-chip" onClick={() => void loadLocation(r)}>
                      {r.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {error && <div className="error-box">{error}</div>}
        {loading && <div className="weather-loading">Loading weather data…</div>}

        {bundle && !loading && (
          <>
            {/* Hero */}
            <div className="weather-hero">
              <div className="weather-hero-top">
                <div>
                  <h2 className="weather-city">{bundle.location.name}</h2>
                  <p className="weather-region">
                    {[bundle.location.region, bundle.location.country].filter(Boolean).join(', ')}
                  </p>
                  {localTime && <p className="weather-clock">{localTime} local</p>}
                </div>
                <button
                  type="button"
                  className={`weather-fav-btn${fav ? ' active' : ''}`}
                  aria-label={fav ? 'Remove from favorites' : 'Add to favorites'}
                  onClick={handleFavorite}
                >
                  {fav ? '★' : '☆'}
                </button>
              </div>
              <div className="weather-hero-body">
                <div className="weather-hero-main">
                  <span className="weather-emoji" aria-hidden>{WEATHER_EMOJI[bundle.current.icon]}</span>
                  <div>
                    <span className="weather-temp">{Math.round(bundle.current.tempC)}<sup>°C</sup></span>
                    <p className="weather-condition">{bundle.current.condition}</p>
                    <p className="weather-feels">Feels like {Math.round(bundle.current.feelsLikeC)}°C</p>
                  </div>
                </div>

                {/* Moon panel inset (like the mockup) */}
                <div className="weather-moon-panel">
                  <div className="weather-moon-row">
                    <span>🌅 Sunrise</span><b>{bundle.astronomy.sunrise}</b>
                  </div>
                  <div className="weather-moon-row">
                    <span>🌇 Sunset</span><b>{bundle.astronomy.sunset}</b>
                  </div>
                  {bundle.astronomy.moonrise && (
                    <div className="weather-moon-row"><span>🌘 Moonrise</span><b>{bundle.astronomy.moonrise}</b></div>
                  )}
                  {bundle.astronomy.moonset && (
                    <div className="weather-moon-row"><span>🌒 Moonset</span><b>{bundle.astronomy.moonset}</b></div>
                  )}
                  <div className="weather-moon-phase">
                    <span className="weather-moon-emoji" aria-hidden>{bundle.astronomy.moonEmoji}</span>
                    <div>
                      <b>{bundle.astronomy.moonPhase}</b>
                      <span>{bundle.astronomy.moonIllumination}% illuminated</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* mini stat row */}
              <div className="weather-hero-mini">
                {bundle.airQuality && (
                  <div className="weather-mini">
                    <span className="weather-mini-badge" style={{ background: aqiColor(bundle.airQuality.aqi) }}>{bundle.airQuality.aqi}</span>
                    <div><b>AQI</b><span>{bundle.airQuality.status}</span></div>
                  </div>
                )}
                <div className="weather-mini">
                  <span className="weather-mini-ic">☀️</span>
                  <div><b>UV {bundle.current.uv ?? bundle.daily[0]?.uvMax ?? '—'}</b><span>{uvLabel(bundle.current.uv ?? bundle.daily[0]?.uvMax ?? 0)}</span></div>
                </div>
                <div className="weather-mini">
                  <span className="weather-mini-ic">💨</span>
                  <div><b>{Math.round(bundle.current.windKph)} km/h</b><span>{windDirLabel(bundle.current.windDir)}</span></div>
                </div>
              </div>
            </div>

            {/* Dashboard grid */}
            <div className="weather-grid">
              {/* Alerts */}
              {bundle.alerts.length > 0 && (
                <div className="weather-card weather-alert-card">
                  <h3 className="weather-card-h"><span className="weather-alert-ic">⚠️</span> Weather Alert</h3>
                  {bundle.alerts.slice(0, 2).map((a, i) => (
                    <div key={i} className="weather-alert">
                      <b>{a.event}</b>
                      {a.areas && <span className="weather-alert-area">{a.areas}</span>}
                      <p>{a.headline}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Hourly */}
              <div className="weather-card weather-hourly-card">
                <h3 className="weather-card-h">Hourly Forecast</h3>
                <div className="weather-hourly-scroll">
                  {bundle.hourly.slice(0, 24).map((h, i) => (
                    <div key={h.time} className={`weather-hour-card${i === 0 ? ' now' : ''}`}>
                      <span>{i === 0 ? 'Now' : formatHour(h.time)}</span>
                      <span className="weather-hour-emoji">{WEATHER_EMOJI[h.icon]}</span>
                      <strong>{Math.round(h.tempC)}°</strong>
                      <span className="weather-hour-rain">💧 {h.precipProb}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* AQI */}
              {bundle.airQuality && (
                <div className="weather-card weather-aqi-card">
                  <h3 className="weather-card-h">Air Quality Index</h3>
                  <div className="weather-aqi-body">
                    <div className="weather-aqi-gauge" style={{ '--aqi-color': aqiColor(bundle.airQuality.aqi), '--aqi-color-deg': `${Math.min(360, (bundle.airQuality.aqi / 300) * 360)}deg` } as React.CSSProperties}>
                      <span className="weather-aqi-num">{bundle.airQuality.aqi}</span>
                      <span className="weather-aqi-status">{bundle.airQuality.status}</span>
                    </div>
                    <div className="weather-pollutants">
                      {[
                        { label: 'PM2.5', value: bundle.airQuality.pm25 },
                        { label: 'PM10', value: bundle.airQuality.pm10 },
                        { label: 'O₃', value: bundle.airQuality.ozone },
                        { label: 'NO₂', value: bundle.airQuality.no2 },
                      ].map((p) => (
                        <div key={p.label} className="weather-pollutant">
                          <span>{p.label}</span>
                          <b>{Math.round(p.value)}</b>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="weather-aqi-rec">{bundle.airQuality.recommendation}</p>
                </div>
              )}

              {/* 7-day */}
              <div className="weather-card weather-daily-card">
                <h3 className="weather-card-h">7-Day Forecast</h3>
                <div className="weather-daily-strip">
                  {bundle.daily.map((d, i) => (
                    <div key={d.date} className="weather-dday">
                      <span className="weather-dow">{i === 0 ? 'Today' : new Date(d.date + 'T12:00:00').toLocaleDateString([], { weekday: 'short' })}</span>
                      <span className="weather-dom">{new Date(d.date + 'T12:00:00').toLocaleDateString([], { day: 'numeric', month: 'short' })}</span>
                      <span className="weather-day-emoji">{WEATHER_EMOJI[d.icon]}</span>
                      <span className="weather-day-temps"><b>{Math.round(d.tempMaxC)}°</b> <em>{Math.round(d.tempMinC)}°</em></span>
                      <span className="weather-day-rain">💧 {d.precipProbMax}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI summary */}
              <div className="weather-card weather-ai-card">
                <h3 className="weather-card-h">✨ AI Weather Summary <span className="weather-beta">BETA</span></h3>
                {aiLoading && <p className="weather-loading">Generating…</p>}
                {aiSummary && <p className="weather-ai-text">{aiSummary}</p>}
                {clothing && <p className="weather-ai-clothing">👕 {clothing}</p>}
                <button type="button" className="btn btn-ghost btn-sm mt-2" onClick={() => { setAiSummary(''); void loadAi(); }}>Regenerate</button>
              </div>

              {/* Outdoor activity index */}
              <div className="weather-card weather-activity-card">
                <h3 className="weather-card-h">Outdoor Activity Index</h3>
                <div className="weather-activities">
                  {activities.map((a) => {
                    const s = scoreLabel(a.score);
                    return (
                      <div key={a.name} className="weather-activity">
                        <span className="weather-act-ic">{a.icon}</span>
                        <span className="weather-act-name">{a.name}</span>
                        <b style={{ color: s.color }}>{a.score}</b>
                        <span className="weather-act-label" style={{ color: s.color }}>{s.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Details */}
              <div className="weather-card weather-details-card">
                <h3 className="weather-card-h">Details</h3>
                <div className="weather-details">
                  {[
                    { ic: '💧', label: 'Humidity', value: `${bundle.current.humidity}%` },
                    { ic: '💨', label: 'Wind', value: `${Math.round(bundle.current.windKph)} km/h ${windDirLabel(bundle.current.windDir)}` },
                    { ic: '🌡️', label: 'Pressure', value: `${Math.round(bundle.current.pressureMb)} mb` },
                    { ic: '☁️', label: 'Cloud Cover', value: `${bundle.current.cloudPct}%` },
                    { ic: '☀️', label: 'UV Index', value: `${bundle.current.uv ?? bundle.daily[0]?.uvMax ?? '—'} · ${uvLabel(bundle.current.uv ?? bundle.daily[0]?.uvMax ?? 0)}` },
                    { ic: '🌇', label: 'Day length', value: bundle.astronomy.dayLength },
                  ].map((d) => (
                    <div key={d.label} className="weather-detail">
                      <span className="weather-detail-ic">{d.ic}</span>
                      <span className="weather-detail-label">{d.label}</span>
                      <b className="weather-detail-val">{d.value}</b>
                    </div>
                  ))}
                </div>
                <div className="weather-golden">
                  <span>🌅 Golden hour: {bundle.astronomy.goldenMorning} · {bundle.astronomy.goldenEvening}</span>
                </div>
              </div>
            </div>

            <p className="weather-credit">
              Powered by <a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer">Open-Meteo</a>
              {bundle.alerts.length >= 0 ? ' + WeatherAPI' : ''} · free, no signup
            </p>
          </>
        )}
      </div>
    </div>
  );
}
