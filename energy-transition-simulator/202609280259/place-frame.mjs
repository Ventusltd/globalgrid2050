// place-frame.mjs: the one coordinate system between GridAtlas (the MapLibre map) and the 3D wireframe.
// Dependency-free, pure functions, no DOM. Every wireframe object is authored in metres around an anchor
// (a place key on a 100 m lattice); this file turns those metres into the Mercator vertices the overlay's
// custom layer draws, and turns map positions back into metres.
//
// WHAT IS EXACT, AND WHAT IS A CONVENTION
//   - Horizontal: exact WGS84 ellipsoid. A local point (x, y) is a point on the anchor's tangent plane
//     (x east, y north, through ECEF); its latitude and longitude are the foot of the ellipsoid normal
//     through it. So nothing is scaled by a sphere: the old overlay path (metres times
//     meterInMercatorCoordinateUnits) uses MapLibre's sphere of 6,371,008.8 m and ignores the ellipsoid,
//     which puts the far corner of a 200 m block a few decimetres off (the tests print the figure).
//   - Vertical: z is height above the ellipsoid at that point (the plane's curvature bump is dropped, so
//     z = 0 drapes on the map). In Mercator units z follows MapLibre's mercatorZfromAltitude, because the
//     map's own camera and extrusions use that convention; it is the map's rule, not the earth's.
//   - enu()/fromEnu() give the pure 3D ENU frame for anyone who needs it (no draping).
//   - toMercator/fromMercator/mercatorScale/mercatorZ copy MapLibre GL JS 4.7.1 (mercator_coordinate.ts)
//     term for term, so they match what the map does, not what the earth is.
// Agreement between these functions proves they are consistent with each other, never that the map
// imagery or grid layers are right on the ground.

// ---- WGS84 ----
export const WGS84 = { a: 6378137.0, f: 1 / 298.257223563 };
const A = WGS84.a, F = WGS84.f, E2 = F * (2 - F), RAD = Math.PI / 180;

/** Geodetic (degrees, metres) -> ECEF [X, Y, Z] in metres. */
export function ecef(lat, lon, h = 0) {
  const p = lat * RAD, l = lon * RAD, s = Math.sin(p), c = Math.cos(p);
  const N = A / Math.sqrt(1 - E2 * s * s);
  return [(N + h) * c * Math.cos(l), (N + h) * c * Math.sin(l), (N * (1 - E2) + h) * s];
}

/** ECEF -> { lat, lon, h } (degrees, metres). Fixed-point iteration, converged to 1e-15 rad. */
export function geodetic(X, Y, Z) {
  const p = Math.hypot(X, Y);
  let lat = Math.atan2(Z, p * (1 - E2)), h = 0;
  for (let k = 0; k < 20; k++) {
    const s = Math.sin(lat), N = A / Math.sqrt(1 - E2 * s * s);
    h = Math.abs(Math.cos(lat)) > 1e-9 ? p / Math.cos(lat) - N : Math.abs(Z) - N * (1 - E2);
    const next = Math.atan2(Z, p * (1 - E2 * N / (N + h)));
    const done = Math.abs(next - lat) < 1e-15;
    lat = next;
    if (done) break;
  }
  const s = Math.sin(lat), N = A / Math.sqrt(1 - E2 * s * s);
  h = Math.abs(Math.cos(lat)) > 1e-9 ? p / Math.cos(lat) - N : Math.abs(Z) - N * (1 - E2);
  return { lat: lat / RAD, lon: Math.atan2(Y, X) / RAD, h };
}

// Unit vectors of the local frame at (lat, lon): east, north, up (up is the ellipsoid normal).
function axes(lat, lon) {
  const p = lat * RAD, l = lon * RAD, sp = Math.sin(p), cp = Math.cos(p), sl = Math.sin(l), cl = Math.cos(l);
  return { e: [-sl, cl, 0], n: [-sp * cl, -sp * sl, cp], u: [cp * cl, cp * sl, sp] };
}
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// An anchor's frame, computed from its lat/lon (never stored in data; cached per object only).
const FRAMES = new WeakMap();
function frame(anchor) {
  let f = FRAMES.get(anchor);
  if (!f) { f = { o: ecef(anchor.lat, anchor.lon, 0), ...axes(anchor.lat, anchor.lon) }; FRAMES.set(anchor, f); }
  return f;
}

// ---- the place key: a 100 m lattice ----
// Rows: latitude = j * STEP_LAT, with STEP_LAT = 100 / 111320 degrees (the overlay's constant, so row j is
// the overlay's own rounding). On the ellipsoid a row step is 99.3 m at the equator to 100.1 m at 61 N.
// Columns: along each row, exactly 100 m of parallel arc on WGS84 at the row's latitude:
// STEP_LON(j) = 100 / (N(lat_j) cos(lat_j)) radians. So a key is two integers; its anchor is computed.
export const STEP_LAT = 100 / 111320;
export const LAT_LIMIT = 85.0511287798066; // MapLibre's Mercator edge
function stepLon(latRow) {
  const s = Math.sin(latRow * RAD), N = A / Math.sqrt(1 - E2 * s * s);
  return 100 / (N * Math.cos(latRow * RAD)) / RAD;
}

/** The anchor for key 'pf:j:i' (or { j, i }): { key, j, i, lat, lon }. */
export function anchorFromKey(key) {
  let j, i;
  if (typeof key === 'string') {
    const m = /^pf:(-?\d+):(-?\d+)$/.exec(key);
    if (!m) throw new Error(`not a place key: ${key}`);
    j = Number(m[1]); i = Number(m[2]);
  } else ({ j, i } = key);
  const lat = j * STEP_LAT, lon = i * stepLon(lat);
  return { key: `pf:${j}:${i}`, j, i, lat, lon };
}

/** The anchor nearest (lat, lon) on the 100 m lattice. */
export function placeKey(lat, lon) {
  if (!(Math.abs(lat) < LAT_LIMIT) || !Number.isFinite(lon)) throw new Error(`no place key at ${lat}, ${lon}`);
  const w = ((lon + 180) % 360 + 360) % 360 - 180; // longitude in [-180, 180)
  const j = Math.round(lat / STEP_LAT);
  return anchorFromKey({ j, i: Math.round(w / stepLon(j * STEP_LAT)) });
}

// ---- local metres <-> WGS84 ----

/** Pure ENU: WGS84 (lat, lon, h) -> { x, y, z } in the anchor's east-north-up frame, via ECEF. */
export function enu(anchor, lat, lon, h = 0) {
  const f = frame(anchor), g = ecef(lat, lon, h), d = [g[0] - f.o[0], g[1] - f.o[1], g[2] - f.o[2]];
  return { x: dot(f.e, d), y: dot(f.n, d), z: dot(f.u, d) };
}

/** Pure ENU inverse: { lat, lon, h }. */
export function fromEnu(anchor, x, y, z = 0) {
  const f = frame(anchor), P = [0, 1, 2].map(k => f.o[k] + x * f.e[k] + y * f.n[k] + z * f.u[k]);
  return geodetic(P[0], P[1], P[2]);
}

/** Wireframe metres from WGS84: (x, y) where the ellipsoid normal through (lat, lon) meets the anchor's
 *  tangent plane; z = h, height above the ellipsoid. Exact inverse of fromLocal. */
export function toLocal(anchor, lat, lon, h = 0) {
  const f = frame(anchor), g = ecef(lat, lon, 0), nrm = axes(lat, lon).u;
  const d = [g[0] - f.o[0], g[1] - f.o[1], g[2] - f.o[2]];
  const t = -dot(f.u, d) / dot(f.u, nrm); // along the normal to the plane
  const P = [d[0] + t * nrm[0], d[1] + t * nrm[1], d[2] + t * nrm[2]];
  return { x: dot(f.e, P), y: dot(f.n, P), z: h };
}

/** WGS84 { lat, lon, h } of wireframe metres (x, y on the tangent plane, z above the ellipsoid). */
export function fromLocal(anchor, x, y, z = 0) {
  const g = fromEnu(anchor, x, y, 0);
  return { lat: g.lat, lon: g.lon, h: z, planeHeight: g.h };
}

// ---- MapLibre's Mercator (maplibre-gl 4.7.1, copied term for term) ----
export const MAPLIBRE_EARTH_RADIUS = 6371008.8;
const CIRC = 2 * Math.PI * MAPLIBRE_EARTH_RADIUS;
export const mercatorX = lng => (180 + lng) / 360;
export const mercatorY = lat => (180 - (180 / Math.PI * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)))) / 360;
export const lngFromMercatorX = x => x * 360 - 180;
export const latFromMercatorY = y => 360 / Math.PI * Math.atan(Math.exp((180 - y * 360) * Math.PI / 180)) - 90;
export const circumferenceAtLatitude = lat => CIRC * Math.cos(lat * Math.PI / 180);
export const mercatorZ = (alt, lat) => alt / circumferenceAtLatitude(lat);
/** MapLibre's mercatorScale(lat) = 1 / cos(lat). */
export const mercatorScale = lat => 1 / Math.cos(lat * Math.PI / 180);
/** MapLibre's MercatorCoordinate.meterInMercatorCoordinateUnits() at latitude lat (sphere, 6,371,008.8 m). */
export const meterInMercator = lat => 1 / CIRC * mercatorScale(latFromMercatorY(mercatorY(lat)));

/** = MercatorCoordinate.fromLngLat([lon, lat], alt): { x, y, z }. */
export function toMercator(lat, lon, alt = 0) {
  return { x: mercatorX(lon), y: mercatorY(lat), z: mercatorZ(alt, lat) };
}
/** Inverse: { lat, lon, alt }. */
export function fromMercator(x, y, z = 0) {
  const lat = latFromMercatorY(y);
  return { lat, lon: lngFromMercatorX(x), alt: z * circumferenceAtLatitude(lat) };
}

// ---- wireframe <-> map ----

/** The Mercator vertex for wireframe metres (x, y, z) around anchor: { x, y, z } for the custom layer, plus
 *  dx, dy, dz relative to the anchor's own Mercator point. Upload dx/dy/dz as float32 and put the anchor in
 *  the matrix: absolute float32 Mercator near 0.3 has a step of 3e-8, about 1.2 m on the ground. */
export function wireToMap(anchor, x, y, z = 0) {
  const g = fromLocal(anchor, x, y, z), m = toMercator(g.lat, g.lon, z), o = toMercator(anchor.lat, anchor.lon, 0);
  return { x: m.x, y: m.y, z: m.z, dx: m.x - o.x, dy: m.y - o.y, dz: m.z };
}

/** Inverse of wireToMap: Mercator (x, y, z) -> wireframe metres { x, y, z } around anchor. */
export function mapToWire(anchor, mx, my, mz = 0) {
  const g = fromMercator(mx, my, mz);
  return toLocal(anchor, g.lat, g.lon, g.alt);
}

/** A whole line list [[x0,y0,z0,x1,y1,z1], ...] -> Float32Array of anchor-relative Mercator vertices. */
export function wireBuffer(anchor, lines) {
  const out = new Float32Array(lines.length * 6);
  lines.forEach((L, k) => {
    for (let v = 0; v < 2; v++) {
      const w = wireToMap(anchor, L[3 * v], L[3 * v + 1], L[3 * v + 2]);
      out.set([w.dx, w.dy, w.dz], 6 * k + 3 * v);
    }
  });
  return out;
}

// ---- Inside GB: the world's National Grid ----
// Injected, so this file stays dependency-free and the world's own code is the one that runs:
//   useWorld(await import('.../world/bng.mjs'), { blocks, etrsToBng, bngToEtrs })   // second argument optional
// With OSTN15 blocks loaded for the place, toBng/fromBng use OSTN15 (the OS definitive transformation, about
// 0.1 m) and report the Helmert gap; elsewhere they return the Helmert answer, flagged. GPS/WGS84 is taken as
// ETRS89 here: the two part by about 0.9 m by 2026 (plate motion), which is a stated, known error.
let WORLD = null;
export function useWorld(bng, ostn = null) {
  if (!bng || typeof bng.wgs84ToBng !== 'function' || typeof bng.bngToWgs84 !== 'function') throw new Error('useWorld needs the world bng.mjs');
  WORLD = { bng, ostn };
}
const needWorld = () => { if (!WORLD) throw new Error('call useWorld(bng) first'); return WORLD; };

/** WGS84 -> National Grid { e, n, engine, helmert, gapToOstn15 } (gap in metres, null if no OSTN15 here). */
export function toBng(lat, lon) {
  const W = needWorld(), h = W.bng.wgs84ToBng(lat, lon);
  const o = W.ostn ? W.ostn.etrsToBng(W.ostn.blocks, lat, lon) : null;
  if (o) return { e: o.e, n: o.n, engine: 'OSTN15', helmert: h, gapToOstn15: Math.hypot(h.e - o.e, h.n - o.n) };
  return { e: h.e, n: h.n, engine: 'Helmert', helmert: h, gapToOstn15: null };
}

/** National Grid -> WGS84 { lat, lon, engine }. */
export function fromBng(e, n) {
  const W = needWorld(), o = W.ostn ? W.ostn.bngToEtrs(W.ostn.blocks, e, n) : null;
  if (o) return { lat: o.lat, lon: o.lon, engine: 'OSTN15' };
  const h = W.bng.bngToWgs84(e, n);
  return { lat: h.lat, lon: h.lon, engine: 'Helmert' };
}

/** Wireframe metres -> National Grid, and back: the two places tied by the same key must agree. */
export const wireToBng = (anchor, x, y) => { const g = fromLocal(anchor, x, y, 0); return toBng(g.lat, g.lon); };
export const bngToWire = (anchor, e, n) => { const g = fromBng(e, n); return toLocal(anchor, g.lat, g.lon, 0); };
