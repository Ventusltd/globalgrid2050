// Sun mode, pure parts: site clock (a named time zone), direct sun over a day against a terrain horizon,
// and the per-batch light factor that makes grid lines a little brighter on sunlit slopes and dimmer in shadow.
// No DOM, no clock reads. Times are UTC milliseconds; azimuths are degrees clockwise from north.

import { solarPosition } from './sun.mjs';

const RAD = Math.PI / 180, MINUTE_MS = 60000;
export const SITE_ZONE = 'Europe/London';

// ---------------------------------------------------------------- site clock
const formatters = new Map();
function formatter(timeZone) {
  if (!formatters.has(timeZone)) {
    formatters.set(timeZone, new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'short' }));
  }
  return formatters.get(timeZone);
}

// Wall-clock fields in the zone for a moment: { year, month, day, hour, minute, minuteOfDay, offset (min), zone }.
export function zoneParts(ms, timeZone = SITE_ZONE) {
  const p = {};
  for (const { type, value } of formatter(timeZone).formatToParts(new Date(ms))) p[type] = value;
  const year = +p.year, month = +p.month, day = +p.day, hour = +p.hour % 24, minute = +p.minute;
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const offset = Math.round((wall - Math.floor(ms / MINUTE_MS) * MINUTE_MS) / MINUTE_MS);
  return { year, month, day, hour, minute, minuteOfDay: hour * 60 + minute, offset, zone: p.timeZoneName || 'UTC' };
}

// The UTC moment for a wall-clock date and minute of day in the zone (the later reading in a repeated hour).
export function zonedToUtc(year, month, day, minuteOfDay, timeZone = SITE_ZONE) {
  const wall = Date.UTC(year, month - 1, day, 0, minuteOfDay);
  let t = wall - zoneParts(wall, timeZone).offset * MINUTE_MS;
  t = wall - zoneParts(t, timeZone).offset * MINUTE_MS;
  return t;
}

// The zone's local day around a moment, as UTC milliseconds [start, end).
export function zoneDay(ms, timeZone = SITE_ZONE) {
  const p = zoneParts(ms, timeZone);
  const start = zonedToUtc(p.year, p.month, p.day, 0, timeZone);
  const next = new Date(Date.UTC(p.year, p.month - 1, p.day + 1));
  return { start, end: zonedToUtc(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), 0, timeZone), key: `${p.year}-${p.month}-${p.day}` };
}

// "yyyy-mm-dd" and "hh:mm" in the zone, for inputs and captions.
export function zoneLabel(ms, timeZone = SITE_ZONE) {
  const p = zoneParts(ms, timeZone), d = v => String(v).padStart(2, '0');
  return { date: `${p.year}-${d(p.month)}-${d(p.day)}`, time: `${d(p.hour)}:${d(p.minute)}`, zone: p.zone, parts: p };
}

// ---------------------------------------------------------------- horizon and direct sun
// A horizon profile: n angles (degrees) at azimuths k * 360 / n clockwise from grid north; NaN is no data.
// Returns az (grid degrees) -> angle, linear between neighbours; unknown directions count as a flat horizon.
export function horizonFunction(profile) {
  if (!profile || !profile.length) return () => 0;
  const n = profile.length;
  return az => {
    const f = ((az % 360) + 360) % 360 / (360 / n), k0 = Math.floor(f) % n, k1 = (k0 + 1) % n, w = f - Math.floor(f);
    const a = profile[k0], b = profile[k1];
    if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.isFinite(a) ? a : Number.isFinite(b) ? b : 0;
    return a * (1 - w) + b * w;
  };
}

// Is the sun above the local horizon at this moment? convergence: true north minus grid north (degrees).
export function directAt(lat, lon, ms, horizon, convergence = 0) {
  const s = solarPosition(lat, lon, ms);
  return s.elevation > 0 && s.elevation > horizon(s.azimuth - convergence);
}

// Direct sun across [start, end): hours in direct sun, hours of daylight (sun above a flat horizon),
// and the first and last moments of direct sun (to the minute), or null when there is none.
export function directSunDay(lat, lon, start, end, horizon = () => 0, { stepMinutes = 5, convergence = 0 } = {}) {
  const step = stepMinutes * MINUTE_MS, flat = () => 0;
  let direct = 0, daylight = 0, first = null, last = null, prev = false, prevT = start;
  for (let t = start; t < end; t += step) {
    const mid = Math.min(t + step / 2, end - 1), dt = Math.min(step, end - t);
    const on = directAt(lat, lon, mid, horizon, convergence);
    if (on) direct += dt;
    if (directAt(lat, lon, mid, flat)) daylight += dt;
    if (on && !prev) { const c = edge(lat, lon, prevT, mid, horizon, convergence, true); if (first === null) first = c; }
    if (!on && prev) last = edge(lat, lon, prevT, mid, horizon, convergence, false);
    prev = on; prevT = mid;
  }
  if (prev) last = end;
  return { directHours: direct / 3600000, daylightHours: daylight / 3600000, first, last };
}

// Bisection to the minute between a and b, where direct sun switches on (rising) or off.
function edge(lat, lon, a, b, horizon, convergence, rising) {
  while (b - a > MINUTE_MS) {
    const m = (a + b) / 2, on = directAt(lat, lon, m, horizon, convergence);
    if (on === rising) b = m; else a = m;
  }
  return Math.round((a + b) / 2 / MINUTE_MS) * MINUTE_MS;
}

// ---------------------------------------------------------------- light cue for grid lines
export const LIGHT = Object.freeze({ min: 0.72, max: 1.22, night: 0.8, patch: 64, wrap: 16 });

// Upward unit normal of the ground around (x, y) from four heights `half` metres away; null without ground.
export function groundNormal(heightAt, x, y, half = LIGHT.patch / 2) {
  const e = heightAt(x + half, y), w = heightAt(x - half, y), n = heightAt(x, y + half), s = heightAt(x, y - half);
  if (![e, w, n, s].every(Number.isFinite)) return null;
  const gx = (e - w) / (2 * half), gy = (n - s) / (2 * half), len = Math.hypot(gx, gy, 1);
  return [-gx / len, -gy / len, 1 / len];
}

// Colour factor for a patch. sun: { direction: [x, y, z] in world axes, elevation }. normal: ground normal or
// null (flat assumed). shadowed: fraction 0..1 of the patch in terrain shadow. Flat sunlit ground gives 1;
// slopes facing the sun are brighter, slopes facing away and shadow dimmer, within LIGHT.min..LIGHT.max.
export function lightFactor(sun, normal, shadowed = 0) {
  if (!sun || !(sun.elevation > 0)) return LIGHT.night;
  const n = normal || [0, 0, 1], d = sun.direction;
  const cosI = Math.max(0, n[0] * d[0] + n[1] * d[1] + n[2] * d[2]);
  const ratio = Math.min(2, cosI / Math.max(Math.sin(sun.elevation * RAD), 0.1)); // 1 on flat ground
  const lit = 1 + 0.22 * Math.max(-1, Math.min(1, ratio - 1));
  const f = lit * (1 - shadowed) + LIGHT.min * shadowed;
  return Math.min(LIGHT.max, Math.max(LIGHT.min, f));
}

export const scaleColour = (c, f) => [Math.min(1, c[0] * f), Math.min(1, c[1] * f), Math.min(1, c[2] * f), Math.min(1, c[3] * f)];

// Splits a line batch into square patches of `size` metres by segment midpoint (in local metres), so each
// patch can take its own colour factor. Keys wrap every `wrap` patches, so the set of GPU buffers stays
// bounded however far the viewer walks. Returns [{ ix, iy, cx, cy, key, version, origin, positions }].
export function splitIntoPatches(batch, size = LIGHT.patch, wrap = LIGHT.wrap) {
  const p = batch.positions, o = batch.origin || [0, 0, 0], bins = new Map();
  for (let k = 0; k + 5 < p.length; k += 6) {
    const mx = (p[k] + p[k + 3]) / 2 + o[0], my = (p[k + 1] + p[k + 4]) / 2 + o[1];
    const ix = Math.floor(mx / size), iy = Math.floor(my / size), id = ix + ',' + iy;
    let bin = bins.get(id);
    if (!bin) bins.set(id, bin = { ix, iy, idx: [] });
    bin.idx.push(k);
  }
  const out = [], m = v => ((v % wrap) + wrap) % wrap;
  for (const { ix, iy, idx } of bins.values()) {
    const positions = new Float32Array(idx.length * 6);
    idx.forEach((k, i) => positions.set(p.subarray(k, k + 6), i * 6));
    out.push({ ix, iy, cx: (ix + 0.5) * size, cy: (iy + 0.5) * size, key: `${batch.key}#${m(ix)},${m(iy)}`,
      version: `${batch.version}#${ix},${iy}`, origin: batch.origin, positions });
  }
  return out;
}
