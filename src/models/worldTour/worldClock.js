// One clock and one sky for the whole world. Time of day follows Philippine time (Asia/Manila, UTC+8, no daylight
// saving) and the sun's real position over Manila. Weather is a pure function of the moment, so every city and every
// player sees the same conditions at the same time: when it rains, it rains everywhere. No network is needed.
export const PH_OFFSET_HOURS = 8;
const MANILA = { lat: 14.5995, lon: 120.9842 }, DEG = Math.PI / 180, HOUR = 3600000;
const clamp01 = n => Math.max(0, Math.min(1, n));
export const smoothstep = (a, b, n) => { const t = clamp01((n - a) / (b - a)); return t * t * (3 - 2 * t); };

// Philippine wall-clock parts for an epoch time in milliseconds.
export function philippineTime(ms) {
  const d = new Date(ms + PH_OFFSET_HOURS * HOUR);
  const hours = d.getUTCHours(), minutes = d.getUTCMinutes();
  return { year: d.getUTCFullYear(), month: d.getUTCMonth(), day: d.getUTCDate(), hours, minutes, seconds: d.getUTCSeconds(), hour: hours + minutes / 60 + d.getUTCSeconds() / 3600 };
}
export function formatClock({ hours, minutes }) {
  return `${(hours % 12) || 12}:${String(minutes).padStart(2, '0')} ${hours < 12 ? 'AM' : 'PM'}`;
}

// Solar elevation and azimuth (degrees) over Manila, from the NOAA approximation; accurate to well under a degree.
export function sunPosition(ms) {
  const date = new Date(ms), start = Date.UTC(date.getUTCFullYear(), 0, 1);
  const dayOfYear = Math.floor((ms - start) / 86400000) + 1, hourUtc = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const g = 2 * Math.PI / 365 * (dayOfYear - 1 + (hourUtc - 12) / 24);
  const eqTime = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const solarMinutes = hourUtc * 60 + eqTime + 4 * MANILA.lon, hourAngle = (solarMinutes / 4 - 180) * DEG, lat = MANILA.lat * DEG;
  const cosZenith = Math.max(-1, Math.min(1, Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(hourAngle)));
  const zenith = Math.acos(cosZenith);
  const cosAzimuth = (Math.sin(decl) - Math.sin(lat) * cosZenith) / (Math.cos(lat) * Math.sin(zenith) || 1e-9);
  let azimuth = Math.acos(Math.max(-1, Math.min(1, cosAzimuth))) / DEG; // from north, clockwise
  if (hourAngle > 0) azimuth = 360 - azimuth;
  return { elevation: 90 - zenith / DEG, azimuth };
}

// Smooth deterministic noise over time: the same value for every player at the same moment.
function hash(n) { let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; }
function valueNoise(t, period, salt) {
  const u = t / period, i = Math.floor(u), f = u - i, k = f * f * (3 - 2 * f);
  return hash(i * 31 + salt) * (1 - k) + hash((i + 1) * 31 + salt) * k;
}
export const WEATHER_KINDS = ['clear', 'cloudy', 'rain', 'storm'];
const FORCED = { clear: 0.1, cloudy: 0.5, rain: 0.72, storm: 0.97 };
// 0 (clear skies) … 1 (thunderstorm). The Philippine wet season (June–November) and its afternoon storms make rain likelier.
export function weatherFront(ms) {
  const minutes = ms / 60000, { month, hour } = philippineTime(ms);
  const wet = month >= 5 && month <= 10, afternoon = Math.exp(-(((hour - 15.5) / 2.5) ** 2));
  const base = valueNoise(minutes, 45, 7) * 0.65 + valueNoise(minutes, 170, 19) * 0.35;
  return clamp01(base + (wet ? 0.07 + afternoon * 0.08 : -0.04));
}

// Everything the renderer and HUD need to know about the sky right now. `override` may fix the weather kind
// (clear/cloudy/rain/storm) for previews.
export function worldConditions(ms, override = null) {
  const sun = sunPosition(ms), clock = philippineTime(ms);
  const front = override && FORCED[override] !== undefined ? FORCED[override] : weatherFront(ms);
  const clouds = smoothstep(0.3, 0.62, front), rain = smoothstep(0.58, 0.8, front), storm = smoothstep(0.8, 0.92, front);
  const daylight = smoothstep(-7, 8, sun.elevation), golden = sun.elevation > -7 ? Math.exp(-(((sun.elevation - 3) / 7) ** 2)) : 0;
  const kind = storm > 0.5 ? 'storm' : rain > 0.35 ? 'rain' : clouds > 0.5 ? 'cloudy' : 'clear';
  const phase = sun.elevation < -7 ? 'night' : sun.elevation < 8 ? clock.hour < 12 ? 'dawn' : 'dusk' : 'day';
  return { time: ms, clock, sun, daylight, night: 1 - daylight, golden, front, clouds, rain, storm, kind, phase, wind: 0.3 + clouds * 0.7 };
}
export function weatherLabel(c) {
  if (c.kind === 'storm') return 'Thunderstorm';
  if (c.kind === 'rain') return c.rain > 0.8 ? 'Heavy rain' : 'Light rain';
  if (c.kind === 'cloudy') return c.phase === 'night' ? 'Cloudy night' : 'Overcast';
  return c.phase === 'night' ? 'Clear night' : c.phase === 'day' ? 'Sunny' : c.phase === 'dawn' ? 'Sunrise' : 'Sunset';
}

// Preview overrides from the page address, e.g. ?clock=21:30&weather=rain. The clock then runs on from that time.
// ?bosstest joins the world boss test mode, when the site owner has switched it on (supabase/world-boss.sql).
export function parseEnvironmentOverride(search, now) {
  const params = new URLSearchParams(search || ''), result = { offset: 0, weather: null, bossTest: params.has('bosstest') };
  const match = /^(\d{1,2}):(\d{2})$/.exec(params.get('clock') || '');
  if (match && +match[1] < 24 && +match[2] < 60) {
    const current = philippineTime(now), wanted = +match[1] + +match[2] / 60;
    result.offset = Math.round((wanted - (current.hours + current.minutes / 60)) * HOUR);
  }
  if (WEATHER_KINDS.includes(params.get('weather'))) result.weather = params.get('weather');
  return result;
}
