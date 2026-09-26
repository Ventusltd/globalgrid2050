// Layer: terrain. Ground heights from LiDAR tiles (.ght, written by the lidar pipeline). It draws no lines
// of its own: the ground grid drapes on heightAt. Each frame's lines(ctx) call only asks for the tiles
// within LOAD_RADIUS of the viewer, nearest first, a couple at a time, and forgets the least recently used
// when it holds too many. Every file is fetched through the substrate's hash check (api.fetchVerified).
// Heights are in local metres from the site origin; tiles are placed in British National Grid metres.
//
// Tile format (.ght, little-endian). 32-byte header:
//   0 magic "GGH1" | 4 u16 version=1 | 6 u16 samples=257 | 8 u16 spacing_mm | 10 u16 flags
//   12 i32 origin_e_m | 16 i32 origin_n_m (south-west corner) | 20 i32 base_cm | 24 u16 min_q | 26 u16 max_q
//   28 u32 nodata_count. Body: samples*samples u16, rows south to north, each row west to east.
//   height_m = (base_cm + q) / 100; q = 0xFFFF is no data.

const INDEX_PATH = 'terrain/tiles.json';
// Filled by the build tool with the SHA-256 of tiles.json. Until then the layer loads nothing.
let INDEX_SHA256 = '__TERRAIN_TILES_SHA256__';
export function setIndexSha(sha) { INDEX_SHA256 = sha; }

export const HEADER_BYTES = 32;
export const NODATA = 0xffff;
export const LOAD_RADIUS = 350, MAX_IN_FLIGHT = 2, MAX_TILES = 48;

// Pure: bytes -> { version, samples, spacing, flags, e0, n0, baseCm, minQ, maxQ, nodata, q: Uint16Array }.
export function decodeTile(buffer) {
  const bytes = buffer instanceof ArrayBuffer ? buffer : buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  if (bytes.byteLength < HEADER_BYTES) throw Error('terrain tile shorter than its header');
  const dv = new DataView(bytes);
  const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
  if (magic !== 'GGH1') throw Error(`terrain tile magic "${magic}" is not GGH1`);
  const version = dv.getUint16(4, true);
  if (version !== 1) throw Error(`terrain tile version ${version} is not 1`);
  const samples = dv.getUint16(6, true), spacingMm = dv.getUint16(8, true);
  if (samples < 2 || spacingMm === 0) throw Error('terrain tile has no usable grid');
  const need = HEADER_BYTES + samples * samples * 2;
  if (bytes.byteLength !== need) throw Error(`terrain tile is ${bytes.byteLength} bytes, expected ${need}`);
  const q = new Uint16Array(samples * samples);
  for (let i = 0; i < q.length; i++) q[i] = dv.getUint16(HEADER_BYTES + 2 * i, true); // endian-safe copy
  return {
    version, samples, spacing: spacingMm / 1000, flags: dv.getUint16(10, true),
    e0: dv.getInt32(12, true), n0: dv.getInt32(16, true), baseCm: dv.getInt32(20, true),
    minQ: dv.getUint16(24, true), maxQ: dv.getUint16(26, true), nodata: dv.getUint32(28, true), q
  };
}

// Pure: bilinear height at a point given in the tile's own metres (0..size from the south-west corner).
// NaN outside the tile, or where a sample that carries weight has no data.
export function sampleTile(t, u, v) {
  const s = t.samples - 1, gx = u / t.spacing, gy = v / t.spacing;
  if (!(gx >= 0 && gy >= 0 && gx <= s && gy <= s)) return NaN;
  const i = Math.min(Math.floor(gx), s - 1), j = Math.min(Math.floor(gy), s - 1);
  const fx = gx - i, fy = gy - j;
  const w = [(1 - fx) * (1 - fy), fx * (1 - fy), (1 - fx) * fy, fx * fy];
  const k = [j * t.samples + i, j * t.samples + i + 1, (j + 1) * t.samples + i, (j + 1) * t.samples + i + 1];
  let sum = 0;
  for (let c = 0; c < 4; c++) {
    if (w[c] === 0) continue;
    const q = t.q[k[c]];
    if (q === NODATA) return NaN;
    sum += w[c] * q;
  }
  return (t.baseCm + sum) / 100;
}

// Distance from a point to an axis-aligned rectangle (0 inside).
const rectDist = (x, y, x0, y0, x1, y1) => Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(y0 - y, 0, y - y1));

export function createTerrain() {
  let api = null, origin = { e: 0, n: 0 };
  let index = null, indexState = 'idle'; // idle | loading | ready | failed
  const loaded = new Map();   // key -> { tile, x0, y0, size, used }
  const inFlight = new Set(); // keys
  const failed = new Set();   // keys never retried this session
  let clock = 0;
  // Local position of a tile, read from the live origin every time, so it stays right when the origin moves.
  const now = () => (api && typeof api.origin === 'function' ? api.origin() : origin);
  const place = o => Object.defineProperties(o, {
    x0: { get: () => o.e0 - now().e, enumerable: true }, y0: { get: () => o.n0 - now().n, enumerable: true } });
  const stats = { requested: [], evicted: [] };

  function loadIndex() {
    if (indexState !== 'idle' || !api) return;
    const sha = api.config?.sha256 || INDEX_SHA256;
    const path = api.config?.index || INDEX_PATH;
    if (!sha || sha.startsWith('__')) { indexState = 'failed'; layer.status = 'no tiles.json hash configured'; return; }
    indexState = 'loading';
    Promise.resolve().then(() => api.fetchJSON(path, sha)).then(j => {
      if (!j || !Array.isArray(j.tiles)) throw Error('tiles.json has no tiles list');
      const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '';
      index = j.tiles.map(t => ({
        ...t, path: dir + t.file,
        size: j.tile_m || 256
      })).map(place);
      indexState = 'ready';
      layer.status = `index: ${index.length} tiles`;
      api.invalidate();
    }).catch(e => { indexState = 'failed'; layer.status = 'tiles.json failed: ' + e.message; });
  }

  // Tiles within LOAD_RADIUS of (x, y), nearest first (edge distance, then centre distance).
  function wanted(x, y) {
    if (!index) return [];
    return index
      .map(t => ({ t, d: rectDist(x, y, t.x0, t.y0, t.x0 + t.size, t.y0 + t.size),
        c: Math.hypot(x - t.x0 - t.size / 2, y - t.y0 - t.size / 2) }))
      .filter(o => o.d <= LOAD_RADIUS)
      .sort((a, b) => a.d - b.d || a.c - b.c)
      .map(o => o.t);
  }

  function request(entry) {
    inFlight.add(entry.key);
    stats.requested.push(entry.key);
    Promise.resolve().then(() => api.fetchVerified(entry.path, entry.sha256)).then(buf => {
      const tile = decodeTile(buf);
      const size = (tile.samples - 1) * tile.spacing;
      loaded.set(entry.key, place({ tile, e0: tile.e0, n0: tile.n0, size, used: ++clock }));
      evict();
      api.invalidate();
    }).catch(e => { failed.add(entry.key); layer.status = `tile ${entry.key} failed: ${e.message}`; })
      .finally(() => { inFlight.delete(entry.key); pump(); });
  }

  let lastPos = null;
  function pump() {
    if (!lastPos || indexState !== 'ready') return;
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
    id: 'terrain',
    status: 'waiting for init',
    init(a) {
      api = a;
      const o = typeof a.origin === 'function' ? a.origin() : null;
      if (o) origin = { e: o.e, n: o.n };
      layer.status = 'ready to load';
      loadIndex();
    },
    // Finest loaded tile containing the point wins; NaN where no tile is loaded (the substrate falls back).
    heightAt(x, y) {
      let best = null;
      for (const t of loaded.values()) {
        if (x < t.x0 || y < t.y0 || x > t.x0 + t.size || y > t.y0 + t.size) continue;
        if (!best || t.tile.spacing < best.tile.spacing) best = t;
      }
      if (!best) return NaN;
      best.used = ++clock;
      return sampleTile(best.tile, x - best.x0, y - best.y0);
    },
    lines(ctx) {
      if (!api) return [];
      lastPos = ctx.pos;
      if (indexState === 'idle') loadIndex();
      pump();
      return [];
    },
    // For tests and the console.
    debug: () => ({ loaded: [...loaded.keys()], inFlight: [...inFlight], failed: [...failed], indexState, ...stats })
  };
  return layer;
}

export default createTerrain();
