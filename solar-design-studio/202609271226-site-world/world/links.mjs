// Links out of the world and back in. Pure: no DOM, no fetch; only bng.mjs and origin.mjs.
//
// OUT: gridAtlasUrl opens GridAtlas at the spot the viewer stands. It carries only latitude,
//   longitude and zoom, the location half of the MAP-button contract
//   (ventus-grid-engine deeplink/contract.js PARAMS). It never sends repd_ref: the world does not
//   know which project, if any, the viewer stands on, and an invented identity is worse than none.
// IN: worldUrl / parseWorldUrl are the world's own landing link, so GridAtlas (or anyone) can
//   send a reader back to stand on the same ground. lat/lon win over e/n when both are present.
//
// Coordinates are rounded to 6 decimal places (about 0.11 m north-south), finer than the 3-5 m the
// Helmert transform in bng.mjs is good for against the real National Grid. A round trip therefore
// closes to about 0.1 m, which proves the pair are consistent, not that either spot is surveyed.

import { bngToWgs84, wgs84ToBng } from './bng.mjs';
import { toBng } from './origin.mjs';

// Same value as CANONICAL_RECEIVER in ventus-grid-engine deeplink/contract.js. Copied, not imported,
// because the two repos do not import each other; tests/links.test.mjs pins the string.
export const GRIDATLAS_RECEIVER = 'https://ventusltd.github.io/gridatlas/atlas/';
const RETIRED = ['https://globalgrid2050.com/repd_grid_atlasv8'];

export const DEFAULT_ZOOM = 15;
export const WORLD_VIEWS = Object.freeze(['standing', 'aerial']);

const round = (v, dp) => { const k = 10 ** dp; const r = Math.round(v * k) / k; return r === 0 ? 0 : r; };
const onGrid = (e, n) => Number.isFinite(e) && Number.isFinite(n) && e >= 0 && e < 700000 && n >= 0 && n < 1300000;
// Great Britain and its waters, generously. Anything outside is a broken number, not a place.
const inBritain = (lat, lon) => lat >= 49 && lat <= 61.5 && lon >= -9.5 && lon <= 2.5;
const strip = s => String(s).split('?')[0].split('#')[0].replace(/\/+$/, '');

/**
 * The GridAtlas link for where the viewer stands, or null when the world is not placed.
 * origin: { e, n } British National Grid metres; pos: local [x, y, ...] metres from it.
 * Returns null (never a link to the sea off Scilly) when no site has set the origin (0, 0),
 * or when the point is off the National Grid.
 */
export function gridAtlasUrl({ origin, pos, zoom = DEFAULT_ZOOM, base = GRIDATLAS_RECEIVER } = {}) {
  if (!origin || !Array.isArray(pos)) return null;
  if (origin.e === 0 && origin.n === 0) return null; // the unplaced world: 0, 0 is the grid's false origin
  if (RETIRED.includes(strip(base))) throw new Error(`gridAtlasUrl: ${base} is a retired receiver`);
  const { e, n } = toBng(origin, pos[0], pos[1]);
  if (!onGrid(e, n)) return null;
  const { lat, lon } = bngToWgs84(e, n);
  const z = Number.isFinite(zoom) ? Math.min(22, Math.max(0, zoom)) : DEFAULT_ZOOM;
  const url = new URL(base);
  url.search = '';
  url.searchParams.set('latitude', String(round(lat, 6)));
  url.searchParams.set('longitude', String(round(lon, 6)));
  url.searchParams.set('zoom', String(round(z, 2)));
  return url.href;
}

/**
 * The world's landing link. base: the world page URL. yaw in radians (as state.yaw), written as
 * degrees 0-360 to 1 dp; alt: metres above the ground, drone only, 1 dp; gen: the world generation.
 * Absent or non-finite fields are left out rather than written as NaN.
 */
export function worldUrl(base, { lat, lon, view, yaw, alt, gen } = {}) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error('worldUrl needs finite lat and lon');
  const url = new URL(base);
  url.search = '';
  url.searchParams.set('lat', String(round(lat, 6)));
  url.searchParams.set('lon', String(round(lon, 6)));
  if (WORLD_VIEWS.includes(view)) url.searchParams.set('view', view);
  if (Number.isFinite(yaw)) {
    const deg = ((yaw * 180 / Math.PI) % 360 + 360) % 360;
    url.searchParams.set('yaw', String(round(deg, 1) % 360));
  }
  if (Number.isFinite(alt) && view === 'aerial') url.searchParams.set('alt', String(round(Math.max(0, alt), 1)));
  if (gen != null && gen !== '') url.searchParams.set('gen', String(gen));
  return url.href;
}

/**
 * Read a landing link's query string ('?lat=..' or 'lat=..' or a URLSearchParams).
 * Returns null when it names no usable place. Otherwise { lat, lon, e, n, view, yaw, alt, gen }:
 * both coordinate pairs are always filled, from lat/lon when those are valid, else from e/n.
 * yaw comes back in radians; view, yaw, alt and gen are null when absent or unusable.
 */
export function parseWorldUrl(search) {
  const q = search instanceof URLSearchParams ? search : new URLSearchParams(String(search ?? ''));
  const num = k => { const s = q.get(k); if (s === null || s.trim() === '') return NaN; return Number(s); };
  let lat = num('lat'), lon = num('lon'), e, n;
  if (Number.isFinite(lat) && Number.isFinite(lon) && inBritain(lat, lon)) {
    ({ e, n } = wgs84ToBng(lat, lon));
    if (!onGrid(e, n)) return null;
  } else {
    e = num('e'); n = num('n');
    if (!onGrid(e, n)) return null;
    ({ lat, lon } = bngToWgs84(e, n));
  }
  const view = WORLD_VIEWS.includes(q.get('view')) ? q.get('view') : null;
  const yawDeg = num('yaw'), altM = num('alt');
  return {
    lat: round(lat, 6), lon: round(lon, 6), e, n, view,
    yaw: Number.isFinite(yawDeg) ? ((yawDeg % 360 + 360) % 360) * Math.PI / 180 : null,
    alt: Number.isFinite(altM) && altM >= 0 ? altM : null,
    gen: q.get('gen') || null
  };
}
