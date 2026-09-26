// Sun position for a place and a moment, the sun's direction in the world's axes, and a date/time model.
// Pure module: no DOM, no clock reads, no imports. Every function takes its time as UTC milliseconds.
//
// Method: the NOAA Global Monitoring Laboratory solar calculator equations, which follow J. Meeus,
// "Astronomical Algorithms" (2nd ed., Willmann-Bell, 1998), chapters 22, 25 and 28:
//   https://gml.noaa.gov/grad/solcalc/calcdetails.html  (NOAA_Solar_Calculations_day.xls)
// NOAA states the equations are accurate to about 0.01 degree for dates 1800-2100 (before refraction).
// Tests check the result against the worked example of the NREL Solar Position Algorithm
// (I. Reda and A. Andreas, "Solar Position Algorithm for Solar Radiation Applications",
// NREL/TP-560-34302, 2003, rev. 2008, Table A4.1), whose stated uncertainty is 0.0003 degree.
// The NOAA equations use UT throughout; the difference to Terrestrial Time (about 69 s) moves the sun
// by under 0.001 degree, which is below the method's accuracy.
//
// World axes: x east, y north, z up (local metres), as in web/world. Azimuth is clockwise from true
// north. Grid north on the national grid differs from true north by up to about 3.5 degrees across Great Britain
// (about 3 in East Anglia, 3.5 in western Scotland); callers that
// need grid azimuth subtract the grid convergence at the site (see gridConvergence below).

const RAD = Math.PI / 180, DEG = 180 / Math.PI;
const DAY_MS = 86400000, MINUTE_MS = 60000;
export const MIN_MS = Date.UTC(1800, 0, 1), MAX_MS = Date.UTC(2100, 11, 31, 23, 59);

const fix360 = a => ((a % 360) + 360) % 360;

// Julian day from UTC milliseconds (Unix epoch = JD 2440587.5).
export const julianDay = ms => ms / DAY_MS + 2440587.5;

// The sun's apparent place for a moment: declination (degrees) and equation of time (minutes).
export function sunPlace(ms) {
  const T = (julianDay(ms) - 2451545) / 36525;                                  // Julian centuries from J2000.0
  const L0 = fix360(280.46646 + T * (36000.76983 + T * 0.0003032));              // geometric mean longitude
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);                       // mean anomaly
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);                  // orbit eccentricity
  const Mr = M * RAD;
  const C = Math.sin(Mr) * (1.914602 - T * (0.004817 + 0.000014 * T))
    + Math.sin(2 * Mr) * (0.019993 - 0.000101 * T) + Math.sin(3 * Mr) * 0.000289; // equation of centre
  const omega = (125.04 - 1934.136 * T) * RAD;
  const lambda = (L0 + C - 0.00569 - 0.00478 * Math.sin(omega)) * RAD;          // apparent longitude
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = (eps0 + 0.00256 * Math.cos(omega)) * RAD;                          // corrected obliquity
  const decl = Math.asin(Math.sin(eps) * Math.sin(lambda)) * DEG;
  const y = Math.tan(eps / 2) ** 2, L0r = L0 * RAD;
  const eot = 4 * DEG * (y * Math.sin(2 * L0r) - 2 * e * Math.sin(Mr) + 4 * e * y * Math.sin(Mr) * Math.cos(2 * L0r)
    - 0.5 * y * y * Math.sin(4 * L0r) - 1.25 * e * e * Math.sin(2 * Mr));
  return { declination: decl, equationOfTime: eot, julianCentury: T };
}

// Atmospheric refraction in degrees for a true elevation in degrees (NOAA's piecewise fit, standard
// atmosphere at 1010 hPa and 10 C). pressure (hPa) and temperature (C) scale it as Meeus eq. 16.4 does.
export function refraction(elevation, { pressure = 1010, temperature = 10 } = {}) {
  if (!Number.isFinite(elevation) || elevation > 85) return 0;
  const t = Math.tan(elevation * RAD);
  let arcsec;
  if (elevation > 5) arcsec = 58.1 / t - 0.07 / t ** 3 + 0.000086 / t ** 5;
  else if (elevation > -0.575) arcsec = 1735 + elevation * (-518.2 + elevation * (103.4 + elevation * (-12.79 + elevation * 0.711)));
  else arcsec = -20.772 / t;
  return (arcsec / 3600) * (pressure / 1010) * (283 / (273 + temperature));
}

// Solar position for latitude and longitude (degrees, east positive) at UTC milliseconds.
// Returns { azimuth, elevation, zenith, trueElevation, hourAngle, declination, equationOfTime } in degrees
// (equation of time in minutes). elevation includes refraction unless opts.refraction === false.
export function solarPosition(lat, lon, ms, opts = {}) {
  if (![lat, lon, ms].every(Number.isFinite)) throw Error('solar position needs a finite latitude, longitude and time');
  if (Math.abs(lat) > 90) throw Error(`latitude ${lat} is outside -90..90`);
  const { declination, equationOfTime } = sunPlace(ms);
  const minutes = (((ms % DAY_MS) + DAY_MS) % DAY_MS) / MINUTE_MS;               // minutes past 00:00 UTC
  const tst = ((minutes + equationOfTime + 4 * lon) % 1440 + 1440) % 1440;        // true solar time
  const H = tst / 4 - 180;                                                        // hour angle, noon = 0
  const la = lat * RAD, de = declination * RAD, h = H * RAD;
  const cosZ = Math.min(1, Math.max(-1, Math.sin(la) * Math.sin(de) + Math.cos(la) * Math.cos(de) * Math.cos(h)));
  const zenithTrue = Math.acos(cosZ) * DEG;
  // atan2 form of the azimuth (Meeus eq. 13.5, turned to count from north): well defined at the poles too
  const azimuth = fix360(Math.atan2(Math.sin(h), Math.cos(h) * Math.sin(la) - Math.tan(de) * Math.cos(la)) * DEG + 180);
  const trueElevation = 90 - zenithTrue;
  const elevation = opts.refraction === false ? trueElevation : trueElevation + refraction(trueElevation, opts);
  return { azimuth, elevation, zenith: 90 - elevation, trueElevation, hourAngle: H, declination, equationOfTime };
}

// Unit vector towards the sun in world axes (x east, y north, z up).
export function sunDirection({ azimuth, elevation }) {
  const a = azimuth * RAD, e = elevation * RAD;
  return [Math.sin(a) * Math.cos(e), Math.cos(a) * Math.cos(e), Math.sin(e)];
}

// Solar noon at a longitude on the UTC day containing ms, as UTC milliseconds (two passes, since the
// equation of time is taken at noon itself).
export function solarNoon(lon, ms) {
  const day = Math.floor(ms / DAY_MS) * DAY_MS;
  let noon = day + (720 - 4 * lon) * MINUTE_MS;
  for (let k = 0; k < 2; k++) noon = day + (720 - 4 * lon - sunPlace(noon).equationOfTime) * MINUTE_MS;
  return Math.round(noon);
}

// Grid convergence (degrees) of a transverse Mercator grid at (lat, lon): true north minus grid north,
// first-order term gamma = (lon - lon0) * sin(lat). lon0 = -2 for the British national grid.
// Accurate to about 0.01 degree over Great Britain; grid azimuth = true azimuth - gamma.
export const gridConvergence = (lat, lon, lon0 = -2) => (lon - lon0) * Math.sin(lat * RAD);

// ---------------------------------------------------------------- date and time model (pure)
// State: { utcMs, stepMinutes }. Every action returns a new state; the input is never changed.
// Times are clamped to MIN_MS..MAX_MS, the range the method is stated for.
const clampMs = ms => Math.min(MAX_MS, Math.max(MIN_MS, Math.round(ms)));

export function timeState(utcMs, stepMinutes = 15) {
  if (!Number.isFinite(utcMs)) throw Error('time state needs UTC milliseconds');
  if (!(stepMinutes > 0)) throw Error('step must be a positive number of minutes');
  return Object.freeze({ utcMs: clampMs(utcMs), stepMinutes });
}

// actions: { type: 'set', utcMs } | { type: 'date', year, month (1-12), day } keeps the time of day
//          | { type: 'minuteOfDay', minute } keeps the date | { type: 'step', count } moves by count steps
//          | { type: 'days', count } | { type: 'stepSize', minutes } | { type: 'solarNoon', lon }
export function applyTime(state, action = {}) {
  const ms = state.utcMs, day = Math.floor(ms / DAY_MS) * DAY_MS, tod = ms - day;
  const num = (v, what) => { if (!Number.isFinite(v)) throw Error(`${what} must be a number`); return v; };
  switch (action.type) {
    case 'set': return timeState(num(action.utcMs, 'time'), state.stepMinutes);
    case 'date': {
      const y = num(action.year, 'year'), m = num(action.month, 'month'), d = num(action.day, 'day');
      if (m < 1 || m > 12 || d < 1 || d > 31) throw Error(`date ${y}-${m}-${d} is not a calendar date`);
      const start = Date.UTC(y, m - 1, d);
      if (new Date(start).getUTCDate() !== d) throw Error(`date ${y}-${m}-${d} does not exist`);
      return timeState(start + tod, state.stepMinutes);
    }
    case 'minuteOfDay': {
      const minute = Math.min(1439, Math.max(0, Math.round(num(action.minute, 'minute'))));
      return timeState(day + minute * MINUTE_MS, state.stepMinutes);
    }
    case 'step': return timeState(ms + num(action.count ?? 1, 'count') * state.stepMinutes * MINUTE_MS, state.stepMinutes);
    case 'days': return timeState(ms + num(action.count ?? 1, 'count') * DAY_MS, state.stepMinutes);
    case 'stepSize': return timeState(ms, num(action.minutes, 'step'));
    case 'solarNoon': return timeState(solarNoon(num(action.lon, 'longitude'), ms), state.stepMinutes);
    default: throw Error(`unknown time action "${action.type}"`);
  }
}

// What a date/time control shows: fields for inputs and a plain label.
export function timeView(state) {
  const d = new Date(state.utcMs), p = (v, n = 2) => String(v).padStart(n, '0');
  const year = d.getUTCFullYear(), month = d.getUTCMonth() + 1, day = d.getUTCDate();
  const minuteOfDay = d.getUTCHours() * 60 + d.getUTCMinutes();
  const dayOfYear = Math.floor((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 1)) / DAY_MS) + 1;
  const date = `${p(year, 4)}-${p(month)}-${p(day)}`, time = `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
  return { year, month, day, minuteOfDay, dayOfYear, date, time, label: `${date} ${time} UTC` };
}

// Everything the world needs for one moment at one place: position, direction and a status line.
export function sunAt(lat, lon, state, opts = {}) {
  const pos = solarPosition(lat, lon, state.utcMs, opts);
  const up = pos.elevation > 0;
  const status = up
    ? `sun ${pos.elevation.toFixed(1)} deg up, bearing ${pos.azimuth.toFixed(1)} deg (${timeView(state).label})`
    : `sun below the horizon (${timeView(state).label})`;
  return { ...pos, direction: sunDirection(pos), up, status };
}
