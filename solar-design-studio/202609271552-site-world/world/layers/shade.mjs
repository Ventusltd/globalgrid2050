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

// Said in the status: the horizons come from the bare-earth EA LIDAR DTM 1 m only.
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
// The layer: tiles come through the shared loader (api.lib.tiles), which the substrate hash-checks.
export const LIB_VERSION = 1;

export function createShade() {
  let api = null, tl = null, enabled = false, sun = null, problem = '';
  // The loaded tile holding local point (x, y), as a cell: the Sun readout asks for horizons here.
  function cellAt(x, y) {
    tl?.follow();
    for (const t of tl?.loaded?.values() || []) {
      if (x < t.x0 || y < t.y0 || x > t.x0 + t.size || y > t.y0 + t.size) continue;
      const s = t.tile.samples - 1;
      return { t: t.tile, i: Math.min(s, Math.round((x - t.x0) / t.tile.spacing)), j: Math.min(s, Math.round((y - t.y0) / t.tile.spacing)) };
    }
    return null;
  }

  function describe() {
    if (!enabled) return 'off';
    if (tl?.state === 'failed') return problem;
    if (!sun) return 'on: no sun position set';
    if (sun.elevation <= 0) return 'sun below the horizon: no terrain shadow drawn';
    const where = tl?.state === 'ready' ? `${tl.index.length} horizon tiles` : 'loading';
    return `sun ${sun.elevation.toFixed(1)} deg up, bearing ${sun.azimuth.toFixed(1)} deg; ${where}; ${CAVEAT}${problem ? '; ' + problem : ''}`;
  }

  const layer = {
    id: 'shade',
    status: 'off',
    init(a) {
      if (!a.lib?.tiles) { layer.status = 'refused: api.lib.tiles not provided'; return; }
      api = a;
      tl = a.lib.tiles.createTileLoader(a, {
        file: 'horizon-tiles.json', path: INDEX_PATH, sha: () => INDEX_SHA256, tileNoun: 'horizon tile', decode: decodeHorizonTile,
        radius: LOAD_RADIUS, maxInFlight: MAX_IN_FLIGHT, maxTiles: MAX_TILES, active: () => enabled,
        say: t => { layer.status = problem = t; }, onReady: () => { layer.status = describe(); }
      });
      if (a.config?.sun) sun = readSun(a.config.sun);
      if (a.config?.enabled) layer.setEnabled(true);
    },
    setEnabled(on) {
      enabled = !!on;
      layer.status = describe();
      if (enabled) tl?.load();
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
      tl.frame(ctx.pos);
      layer.status = describe();
      if (!sun || sun.elevation <= 0) return [];
      const version = `${sun.azimuth.toFixed(2)}/${sun.elevation.toFixed(2)}@${ctx.groundVersion || 0}o${api.origin?.().id || 0}`, out = [];
      for (const [key, t] of tl.near(ctx.pos)) {
        if (!t.cache || t.cache.version !== version || t.cache.heightAt !== ctx.heightAt) {
          const cx = t.x0 + t.size / 2, cy = t.y0 + t.size / 2, o = [cx, cy, finite(ctx.heightAt(cx, cy))];
          const positions = hatches(t.tile, t.x0, t.y0, sun, ctx.heightAt, { origin: o });
          t.cache = { version, heightAt: ctx.heightAt,
            batches: positions.length ? [{ key: `shade/${key}`, version, origin: o, color: COLOR, positions }] : [] };
        }
        tl.touch(t);
        out.push(...t.cache.batches);
      }
      return out;
    },
    // The horizon at the nearest 4 m cell to local point (x, y): an array of angles (degrees, NaN = no data)
    // at k * 360 / n clockwise from grid north, or null where no tile is loaded. Used by the Sun readout.
    horizonProfile(x, y) {
      const c = cellAt(x, y);
      if (!c) return null;
      const n = c.t.azimuths, base = (c.j * c.t.samples + c.i) * n, out = new Array(n);
      for (let k = 0; k < n; k++) { const v = c.t.h[base + k]; out[k] = v === NODATA ? NaN : v / c.t.unit; }
      return out;
    },
    // Horizon angle (degrees) at (x, y) towards grid azimuth az; NaN where unknown.
    horizonAngle(x, y, az) {
      const c = cellAt(x, y);
      return c ? horizonAt(c.t, c.i, c.j, az) : NaN;
    },
    // For tests and the console.
    debug: () => ({ ...tl?.debug(), enabled, sun, ...tl?.stats })
  };
  return layer;
}

export default createShade();
