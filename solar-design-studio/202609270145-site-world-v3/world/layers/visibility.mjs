// Layer: visibility. Faint diagonal hatching draped on the ground wherever a target of the stated height
// (default 3 m, a panel top) could be seen by at least one observer standing on a road or footpath (eye
// height 1.7 m). Off by default: until setEnabled(true) (or api.config.enabled) it fetches nothing and draws
// nothing. Visibility comes from .gvs tiles written by the lidar pipeline (lidar/src/viewshed.py: an exact
// sight line per cell, paired on the GPU against a radial sweep, with Earth curvature and refraction);
// every file is fetched through the substrate's hash check (api.fetchVerified). Heights come from
// ctx.heightAt, the ground.
//
// Unless the index says canopy heights were used, the layer carries the caveat CAVEAT: the answer is from
// bare-earth terrain only, so hedges, trees and buildings that would hide a target are not included.
//
// Tile format (.gvs, little-endian). 32-byte header:
//   0 magic "GGV1" | 4 u16 version=1 | 6 u16 samples | 8 u16 spacing_mm | 10 u16 flags (bit 0 curvature,
//   bit 1 canopy) | 12 i32 origin_e_m | 16 i32 origin_n_m (south-west corner) | 20 u16 eye_mm | 22 u16 target_mm
//   24 u32 visible_count | 28 u32 nodata_count
//   Body: samples*samples u8; rows south to north, west to east. 0 hidden from every observer; 1..254 the
//   number of observers who see it (254 = 254 or more); 255 no data.

const INDEX_PATH = 'visibility/visibility-tiles.json';
// Filled by the build tool with the SHA-256 of visibility-tiles.json. Until then the layer loads nothing.
let INDEX_SHA256 = '__VISIBILITY_TILES_SHA256__';
export function setIndexSha(sha) { INDEX_SHA256 = sha; }

export const LABEL = 'Visibility from roads and paths';
export const CAVEAT = 'computed from the EA LIDAR terrain only (thinned to 2 m); hedges, trees and buildings not included';
export const CAVEAT_CANOPY = 'computed from terrain and canopy heights';
export const HEADER_BYTES = 32, NODATA = 255;
export const LOAD_RADIUS = 300, MAX_IN_FLIGHT = 2, MAX_TILES = 16;
export const STRIDE = 3, LIFT_M = 0.12;               // a hatch lattice every 3 samples, 12 cm above ground
export const COLOR = [0.82, 0.88, 0.94, 0.16];      // faint: pale grey-blue, low alpha

// Pure: bytes -> { samples, spacing, flags, curvature, canopy, e0, n0, eye, target, visible, nodata, v }.
export function decodeVisibilityTile(buffer) {
  const bytes = buffer instanceof ArrayBuffer ? buffer : buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  if (bytes.byteLength < HEADER_BYTES) throw Error('visibility tile shorter than its header');
  const dv = new DataView(bytes);
  const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
  if (magic !== 'GGV1') throw Error(`visibility tile magic "${magic}" is not GGV1`);
  const version = dv.getUint16(4, true);
  if (version !== 1) throw Error(`visibility tile version ${version} is not 1`);
  const samples = dv.getUint16(6, true), spacingMm = dv.getUint16(8, true), flags = dv.getUint16(10, true);
  if (samples < 2 || spacingMm === 0) throw Error('visibility tile has no usable grid');
  const n = samples * samples;
  if (bytes.byteLength !== HEADER_BYTES + n) throw Error(`visibility tile is ${bytes.byteLength} bytes, expected ${HEADER_BYTES + n}`);
  return {
    samples, spacing: spacingMm / 1000, flags, curvature: !!(flags & 1), canopy: !!(flags & 2),
    e0: dv.getInt32(12, true), n0: dv.getInt32(16, true), eye: dv.getUint16(20, true) / 1000,
    target: dv.getUint16(22, true) / 1000, visible: dv.getUint32(24, true), nodata: dv.getUint32(28, true),
    v: new Uint8Array(bytes, HEADER_BYTES, n)
  };
}

// Pure: the caveat for an index (or null before one has loaded).
export function caveatFor(index) { return index && index.canopy === true ? CAVEAT_CANOPY : CAVEAT; }

const seen = c => c >= 1 && c !== NODATA;

// Pure: hatch strokes for one tile. A lattice every `stride` samples, aligned to the national grid so
// neighbouring tiles line up; from each visible lattice node whose north-east lattice neighbour is also
// visible, a stroke runs to that neighbour, bent once at its middle to follow the ground. Strokes on the
// tile's last row or column are left to the neighbouring tile (they share that edge).
// x0, y0: the tile's south-west corner in local metres. Returns a Float32Array of segments (6 floats each).
export function hatch(t, x0, y0, heightAt, { stride = STRIDE, lift = LIFT_M, origin = [0, 0, 0] } = {}) {
  const out = [], s = t.samples, sp = t.spacing;
  const gi0 = Math.round(t.e0 / sp), gj0 = Math.round(t.n0 / sp);
  const off = g => ((stride - (g % stride)) % stride + stride) % stride;   // first lattice index in the tile
  const z = (x, y) => finite(heightAt(x, y)) + lift - origin[2];
  for (let j = off(gj0); j + stride < s; j += stride) {
    for (let i = off(gi0); i + stride < s; i += stride) {
      if (!seen(t.v[j * s + i]) || !seen(t.v[(j + stride) * s + i + stride])) continue;
      const ax = x0 + i * sp, ay = y0 + j * sp, d = stride * sp, mx = ax + d / 2, my = ay + d / 2;
      const bx = ax + d, by = ay + d, mz = z(mx, my);
      out.push(ax - origin[0], ay - origin[1], z(ax, ay), mx - origin[0], my - origin[1], mz,
               mx - origin[0], my - origin[1], mz, bx - origin[0], by - origin[1], z(bx, by));
    }
  }
  return new Float32Array(out);
}

const finite = h => (Number.isFinite(h) ? h : 0);
const rectDist = (x, y, x0, y0, x1, y1) => Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(y0 - y, 0, y - y1));

export function createVisibility() {
  let api = null, origin = { e: 0, n: 0 }, enabled = false;
  let index = null, indexMeta = null, indexState = 'idle'; // idle | loading | ready | failed
  const loaded = new Map();   // key -> { tile, x0, y0, size, used, cache }
  const inFlight = new Set(), failed = new Set();
  let clock = 0, lastPos = null;
  const stats = { requested: [], evicted: [] };

  const describe = () => {
    const what = indexMeta ? `target ${indexMeta.target_m} m, eye ${indexMeta.eye_m} m, ${(indexMeta.observers || []).length} observers` : '';
    return [what, `${caveatFor(indexMeta)}`].filter(Boolean).join('; ');
  };

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
    if (!sha || sha.startsWith('__')) { indexState = 'failed'; layer.status = 'no visibility-tiles.json hash configured'; return; }
    indexState = 'loading';
    Promise.resolve().then(() => api.fetchJSON(path, sha)).then(j => {
      if (!j || !Array.isArray(j.tiles)) throw Error('visibility-tiles.json has no tiles list');
      const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '';
      indexMeta = j;
      index = j.tiles.map(t => ({ ...t, path: dir + t.file, x0: t.e0 - origin.e, y0: t.n0 - origin.n, size: j.tile_m || 256 }));
      indexState = 'ready';
      layer.status = `index: ${index.length} visibility tiles; ${describe()}`;
      pump();
      api.invalidate({ ground: false });
    }).catch(e => { indexState = 'failed'; layer.status = 'visibility-tiles.json failed: ' + e.message; });
  }

  // Tiles within LOAD_RADIUS of (x, y) with any visible ground, nearest first.
  function wanted(x, y) {
    if (!index) return [];
    return index
      .map(t => ({ t, d: rectDist(x, y, t.x0, t.y0, t.x0 + t.size, t.y0 + t.size) }))
      .filter(o => o.d <= LOAD_RADIUS && o.t.visible !== 0)
      .sort((a, b) => a.d - b.d)
      .map(o => o.t);
  }

  function request(entry) {
    inFlight.add(entry.key);
    stats.requested.push(entry.key);
    Promise.resolve().then(() => api.fetchVerified(entry.path, entry.sha256)).then(buf => {
      const tile = decodeVisibilityTile(buf);
      loaded.set(entry.key, { tile, x0: tile.e0 - origin.e, y0: tile.n0 - origin.n, size: (tile.samples - 1) * tile.spacing, used: ++clock, cache: null });
      evict();
      api.invalidate({ ground: false });
    }).catch(e => { failed.add(entry.key); layer.status = `visibility tile ${entry.key} failed: ${e.message}`; })
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
    id: 'visibility',
    label: LABEL,
    status: 'off',
    get caveat() { return caveatFor(indexMeta); },
    init(a) {
      api = a;
      const o = typeof a.origin === 'function' ? a.origin() : null;
      if (o) origin = { e: o.e, n: o.n };
      if (a.config?.enabled) layer.setEnabled(true);
    },
    setEnabled(on) {
      enabled = !!on;
      layer.status = enabled ? (indexState === 'ready' ? `index: ${index.length} visibility tiles; ${describe()}` : `on; ${caveatFor(indexMeta)}`) : 'off';
      if (enabled) loadIndex();
      api?.invalidate({ ground: false });
      return enabled;
    },
    get enabled() { return enabled; },
    // ctx: { pos, heightAt, groundVersion }
    lines(ctx) {
      if (!api || !enabled) return [];
      follow();
      lastPos = ctx.pos;
      if (indexState === 'idle') loadIndex();
      pump();
      const gv = ctx.groundVersion || 0, out = [];
      for (const [key, t] of loaded) {
        if (rectDist(ctx.pos[0], ctx.pos[1], t.x0, t.y0, t.x0 + t.size, t.y0 + t.size) > LOAD_RADIUS) continue;
        const version = `v@${gv}`;
        if (!t.cache || t.cache.version !== version || t.cache.heightAt !== ctx.heightAt) {
          const cx = t.x0 + t.size / 2, cy = t.y0 + t.size / 2, o = [cx, cy, finite(ctx.heightAt(cx, cy))];
          const positions = hatch(t.tile, t.x0, t.y0, ctx.heightAt, { origin: o });
          t.cache = { version, heightAt: ctx.heightAt,
            batch: positions.length ? { key: `visibility/${key}`, version, origin: o, color: COLOR, positions } : null };
        }
        t.used = ++clock;
        if (t.cache.batch) out.push(t.cache.batch);
      }
      return out;
    },
    // For tests and the console.
    debug: () => ({ loaded: [...loaded.keys()], inFlight: [...inFlight], failed: [...failed], indexState, enabled, ...stats })
  };
  return layer;
}

export default createVisibility();
