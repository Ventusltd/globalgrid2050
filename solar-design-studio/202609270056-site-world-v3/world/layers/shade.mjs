// Layer: shade. Short hatching on ground that lies in terrain shadow for the chosen sun position.
// Off by default: until setEnabled(true) (or api.config.enabled) it fetches nothing and draws nothing.
// The sun comes from setSun({ azimuth, elevation }) in degrees (azimuth clockwise from GRID north; the page
// computes it with web/world/sun.mjs and subtracts the grid convergence), or from ctx.sun when the
// substrate passes one. Horizon angles come from .ghz tiles written by the lidar pipeline
// (lidar/src/horizon_tiles.py: 32 azimuths per 4 m cell, a GPU ray march paired against a max-pyramid
// sampling, CPU witness), fetched through the substrate's hash check (api.fetchVerified). Ground is shaded
// where the sun's elevation is below the horizon angle in the sun's azimuth (Dozier and Frew, IEEE TGRS
// 28(5), 1990). The source is a bare-earth model: hedges, trees and buildings cast no shadow here.
//
// Tile format (.ghz, little-endian). 32-byte header:
//   0 magic "GHZ1" | 4 u16 version=1 | 6 u16 samples=65 | 8 u16 spacing_mm=4000 | 10 u16 azimuths=32
//   12 i32 origin_e_m | 16 i32 origin_n_m (south-west corner) | 20 u16 unit=100 (value / unit = degrees)
//   22 u16 min_reach_m | 24 u32 nodata_count | 28 i16 max_value | 30 u16 reserved
//   Body: samples*samples*azimuths i16; rows south to north, west to east, azimuth k at k*360/azimuths
//   degrees clockwise from grid north. -32768 is no data (the ray left the site too soon): never shaded.

const INDEX_PATH = 'horizon/horizon-tiles.json';
// Filled by the build tool with the SHA-256 of horizon-tiles.json. Until then the layer loads nothing.
let INDEX_SHA256 = '__HORIZON_TILES_SHA256__';
export function setIndexSha(sha) { INDEX_SHA256 = sha; }

// Said in the status (tester 3): the horizons come from the bare-earth EA LIDAR DTM 1 m only.
export const CAVEAT = 'computed from the EA LIDAR terrain only; hedges, trees and buildings cast no shadow';
export const HEADER_BYTES = 32, NODATA = -32768;
export const LOAD_RADIUS = 300, MAX_IN_FLIGHT = 2, MAX_TILES = 16;
export const HATCH_M = 1.6, LIFT_M = 0.1;             // one stroke per 4 m cell, 1.6 m long, 10 cm above ground
export const COLOR = [0.46, 0.54, 0.74, 0.5];          // quiet blue-grey on a dark background

// Pure: bytes -> { samples, spacing, azimuths, unit, e0, n0, minReach, nodata, maxValue, h }.
export function decodeHorizonTile(buffer) {
  const bytes = buffer instanceof ArrayBuffer ? buffer : buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  if (bytes.byteLength < HEADER_BYTES) throw Error('horizon tile shorter than its header');
  const dv = new DataView(bytes);
  const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
  if (magic !== 'GHZ1') throw Error(`horizon tile magic "${magic}" is not GHZ1`);
  const version = dv.getUint16(4, true);
  if (version !== 1) throw Error(`horizon tile version ${version} is not 1`);
  const samples = dv.getUint16(6, true), spacingMm = dv.getUint16(8, true), azimuths = dv.getUint16(10, true);
  const unit = dv.getUint16(20, true);
  if (samples < 2 || spacingMm === 0 || azimuths < 4 || unit === 0) throw Error('horizon tile has no usable grid');
  const n = samples * samples * azimuths;
  if (bytes.byteLength !== HEADER_BYTES + 2 * n) throw Error(`horizon tile is ${bytes.byteLength} bytes, expected ${HEADER_BYTES + 2 * n}`);
  const h = new Int16Array(n);
  for (let k = 0; k < n; k++) h[k] = dv.getInt16(HEADER_BYTES + 2 * k, true);   // little-endian on any machine
  return {
    samples, spacing: spacingMm / 1000, azimuths, unit, e0: dv.getInt32(12, true), n0: dv.getInt32(16, true),
    minReach: dv.getUint16(22, true), nodata: dv.getUint32(24, true), maxValue: dv.getInt16(28, true), h
  };
}

// Pure: horizon angle in degrees at cell (i, j) towards azimuth az (degrees), linear between the two
// neighbouring azimuths. NaN when either neighbour is no data.
export function horizonAt(t, i, j, az) {
  const f = ((az % 360) + 360) % 360 / (360 / t.azimuths), k0 = Math.floor(f) % t.azimuths, k1 = (k0 + 1) % t.azimuths;
  const w = f - Math.floor(f), base = (j * t.samples + i) * t.azimuths;
  const a = t.h[base + k0], b = t.h[base + k1];
  if (a === NODATA || b === NODATA) return NaN;
  return (a * (1 - w) + b * w) / t.unit;
}

// Pure: is cell (i, j) in terrain shadow for this sun? No data is never shaded; a sun at or below the
// horizon line (elevation <= 0) is night, handled by the caller, not here.
export function inShadow(t, i, j, sun) {
  const h = horizonAt(t, i, j, sun.azimuth);
  return Number.isFinite(h) && sun.elevation < h;
}

// Pure: the cells of one tile in shadow, as a Uint8Array mask (row-major, south row first) and a count.
export function shadowMask(t, sun) {
  const s = t.samples, mask = new Uint8Array(s * s);
  let count = 0;
  for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) if (inShadow(t, i, j, sun)) { mask[j * s + i] = 1; count++; }
  return { mask, count };
}

// Pure: hatch strokes for one tile, one per shaded cell, pointing away from the sun (the way the shadow
// falls). x0, y0: the tile's south-west corner in local metres; positions relative to origin.
export function hatches(t, x0, y0, sun, heightAt, { length = HATCH_M, lift = LIFT_M, origin = [0, 0, 0] } = {}) {
  const { mask, count } = shadowMask(t, sun), s = t.samples, out = new Float32Array(count * 6);
  const a = sun.azimuth * Math.PI / 180, dx = -Math.sin(a) * length / 2, dy = -Math.cos(a) * length / 2;
  let p = 0;
  for (let j = 0; j < s; j++) {
    for (let i = 0; i < s; i++) {
      if (!mask[j * s + i]) continue;
      const x = x0 + i * t.spacing, y = y0 + j * t.spacing;
      const ax = x - dx, ay = y - dy, bx = x + dx, by = y + dy;
      out[p++] = ax - origin[0]; out[p++] = ay - origin[1]; out[p++] = finite(heightAt(ax, ay)) + lift - origin[2];
      out[p++] = bx - origin[0]; out[p++] = by - origin[1]; out[p++] = finite(heightAt(bx, by)) + lift - origin[2];
    }
  }
  return out;
}

// Pure: a sun position from anything offering azimuth and elevation in degrees, or null.
export function readSun(s) {
  if (!s || !Number.isFinite(s.azimuth) || !Number.isFinite(s.elevation)) return null;
  return { azimuth: ((s.azimuth % 360) + 360) % 360, elevation: s.elevation };
}

const finite = h => (Number.isFinite(h) ? h : 0);
const rectDist = (x, y, x0, y0, x1, y1) => Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(y0 - y, 0, y - y1));

export function createShade() {
  let api = null, origin = { e: 0, n: 0 }, enabled = false, sun = null;
  let index = null, indexState = 'idle'; // idle | loading | ready | failed
  const loaded = new Map();   // key -> { tile, x0, y0, size, used, cache }
  const inFlight = new Set(), failed = new Set();
  let clock = 0, lastPos = null, problem = '';
  const stats = { requested: [], evicted: [] };

  // The site origin is set after init and moves as the viewer walks: tiles are placed from it when it changes.
  function follow() {
    const o = typeof api?.origin === 'function' ? api.origin() : null;
    if (!o || (o.e === origin.e && o.n === origin.n)) return;
    origin = { e: o.e, n: o.n };
    for (const t of index || []) { t.x0 = t.e0 - origin.e; t.y0 = t.n0 - origin.n; }
    for (const t of loaded.values()) { t.x0 = t.tile.e0 - origin.e; t.y0 = t.tile.n0 - origin.n; t.cache = null; }
  }

  function loadIndex() {
    if (indexState !== 'idle' || !api || !enabled) return;
    follow();
    const sha = api.config?.sha256 || INDEX_SHA256;
    const path = api.config?.index || INDEX_PATH;
    if (!sha || sha.startsWith('__')) { indexState = 'failed'; layer.status = problem = 'no horizon-tiles.json hash configured'; return; }
    indexState = 'loading';
    Promise.resolve().then(() => api.fetchJSON(path, sha)).then(j => {
      if (!j || !Array.isArray(j.tiles)) throw Error('horizon-tiles.json has no tiles list');
      const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '';
      index = j.tiles.map(t => ({ ...t, path: dir + t.file, x0: t.e0 - origin.e, y0: t.n0 - origin.n, size: j.tile_m || 256 }));
      indexState = 'ready';
      layer.status = describe();
      pump();
      api.invalidate({ ground: false });
    }).catch(e => { indexState = 'failed'; layer.status = problem = 'horizon-tiles.json failed: ' + e.message; });
  }

  function describe() {
    if (!enabled) return 'off';
    if (indexState === 'failed') return problem;
    if (!sun) return 'on: no sun position set';
    if (sun.elevation <= 0) return 'sun below the horizon: no terrain shadow drawn';
    const where = indexState === 'ready' ? `${index.length} horizon tiles` : 'loading';
    return `sun ${sun.elevation.toFixed(1)} deg up, bearing ${sun.azimuth.toFixed(1)} deg; ${where}; ${CAVEAT}${problem ? '; ' + problem : ''}`;
  }

  function wanted(x, y) {
    if (!index) return [];
    return index
      .map(t => ({ t, d: rectDist(x, y, t.x0, t.y0, t.x0 + t.size, t.y0 + t.size) }))
      .filter(o => o.d <= LOAD_RADIUS)
      .sort((a, b) => a.d - b.d)
      .map(o => o.t);
  }

  function request(entry) {
    inFlight.add(entry.key);
    stats.requested.push(entry.key);
    Promise.resolve().then(() => api.fetchVerified(entry.path, entry.sha256)).then(buf => {
      const tile = decodeHorizonTile(buf);
      loaded.set(entry.key, { tile, x0: tile.e0 - origin.e, y0: tile.n0 - origin.n, size: (tile.samples - 1) * tile.spacing, used: ++clock, cache: null });
      evict();
      api.invalidate({ ground: false });
    }).catch(e => { failed.add(entry.key); layer.status = problem = `horizon tile ${entry.key} failed: ${e.message}`; })
      .finally(() => { inFlight.delete(entry.key); pump(); });
  }

  function pump() {
    if (!lastPos || indexState !== 'ready' || !enabled) return;
    for (const t of wanted(lastPos[0], lastPos[1])) {
      if (inFlight.size >= MAX_IN_FLIGHT) break;
      if (loaded.has(t.key)) { loaded.get(t.key).used = ++clock; continue; }
      if (inFlight.has(t.key) || failed.has(t.key)) continue;
      request(t);
    }
  }

  function evict() {
    while (loaded.size > MAX_TILES) {
      let oldest = null;
      for (const [k, v] of loaded) if (!oldest || v.used < loaded.get(oldest).used) oldest = k;
      loaded.delete(oldest);
      stats.evicted.push(oldest);
    }
  }

  const layer = {
    id: 'shade',
    status: 'off',
    init(a) {
      api = a;
      const o = typeof a.origin === 'function' ? a.origin() : null;
      if (o) origin = { e: o.e, n: o.n };
      if (a.config?.sun) sun = readSun(a.config.sun);
      if (a.config?.enabled) layer.setEnabled(true);
    },
    setEnabled(on) {
      enabled = !!on;
      layer.status = describe();
      if (enabled) loadIndex();
      api?.invalidate({ ground: false });
      return enabled;
    },
    // sun: { azimuth (grid, degrees clockwise from north), elevation (degrees, refraction included) }
    setSun(s) {
      const next = readSun(s);
      if (!next) throw Error('sun needs a finite azimuth and elevation in degrees');
      sun = next;
      layer.status = describe();
      api?.invalidate({ ground: false });
      return sun;
    },
    get enabled() { return enabled; },
    get sun() { return sun; },
    // ctx: { pos, heightAt, groundVersion, sun? }
    lines(ctx) {
      if (!api || !enabled) return [];
      if (ctx.sun) { const s = readSun(ctx.sun); if (s) sun = s; }
      follow();
      lastPos = ctx.pos;
      if (indexState === 'idle') loadIndex();
      pump();
      layer.status = describe();
      if (!sun || sun.elevation <= 0) return [];
      const version = `${sun.azimuth.toFixed(2)}/${sun.elevation.toFixed(2)}@${ctx.groundVersion || 0}`, out = [];
      for (const [key, t] of loaded) {
        if (rectDist(ctx.pos[0], ctx.pos[1], t.x0, t.y0, t.x0 + t.size, t.y0 + t.size) > LOAD_RADIUS) continue;
        if (!t.cache || t.cache.version !== version || t.cache.heightAt !== ctx.heightAt) {
          const cx = t.x0 + t.size / 2, cy = t.y0 + t.size / 2, o = [cx, cy, finite(ctx.heightAt(cx, cy))];
          const positions = hatches(t.tile, t.x0, t.y0, sun, ctx.heightAt, { origin: o });
          t.cache = { version, heightAt: ctx.heightAt,
            batches: positions.length ? [{ key: `shade/${key}`, version, origin: o, color: COLOR, positions }] : [] };
        }
        t.used = ++clock;
        out.push(...t.cache.batches);
      }
      return out;
    },
    // For tests and the console.
    debug: () => ({ loaded: [...loaded.keys()], inFlight: [...inFlight], failed: [...failed], indexState, enabled, sun, ...stats })
  };
  return layer;
}

export default createShade();
