// Layer: flow. The natural drainage lines: every cell whose log-accumulation class is at or above a chosen
// class, drawn as a short downhill segment to the cell it drains into (D8), draped just above the ground,
// brighter as the flow grows. Ponding hollows are outlined: the pipeline's kept hollows (flow-hollows.json and its
// hollows/<key>.gph depth masks, lidar lane-gpu/src/flow_hollows.py) when configured, else the tile's own mask body.
// COMPUTED FROM LIDAR, NOT AN OFFICIAL FLOOD MAP: every status, batch and label says so.
// Off by default: until setEnabled(true) (or api.config.enabled) it fetches nothing and draws nothing.
// Tiles come from the lidar pipeline (lidar/src/flow_tiles.py) and every file is fetched through the
// substrate's hash check (api.fetchVerified). Heights come from ctx.heightAt, the ground.
//
// Tile format (expected .gfl, little-endian), laid out like the .gst slope tile. 32-byte header:
//   0 magic "GGF?" | 4 u16 version=1 | 6 u16 samples (257 node grid or 256 cell grid) | 8 u16 spacing_mm
//   10 u16 flags | 12 i32 origin_e_m | 16 i32 origin_n_m (south-west corner) | 20 u8 log_scale (10: k = floor(10 log10 m2))
//   21 u8 method (1 = D8) | 22 u16 channel_m2 | 24 u32 nodata_count | 28 u32 channel_count
//   Body: n u8 accumulation class, then n u8 D8 direction, optionally n u8 hollow mask; rows south to
//   north, west to east. Class 255 = no data.
//   Direction, compass code: 0..7 = N NE E SE S SW W NW, 8 = no downhill step (the pipeline: outlet at the site
//   edge), 255 no data. Code 8 is never drawn as a hollow: hollows come only from the mask body.
//   Direction, ESRI code: 1 E, 2 SE, 4 S, 8 SW, 16 W, 32 NW, 64 N, 128 NE, 0 = pit, 255 no data.
// The decoder is tolerant: any magic starting "GGF", a header of another length when the body fixes the
// grid, and the direction code from the index (dir_encoding) or the values themselves, never from the header
// (byte 21 is the method, 1 = D8, which an ESRI flag would misread).

export const LABEL = 'computed from LiDAR (D8 on a filled surface), not an official flood map';
export const HOLLOW_LABEL = 'ponding hollows: computed from LiDAR, not an official flood map';
export const GPH_MAGIC = 'GGP1', GPH_NODATA = 255;
const INDEX_PATH = 'flow/flow-tiles.json';
// Filled by the build tool with the SHA-256 of flow-tiles.json. Until then the layer loads nothing.
let INDEX_SHA256 = '__FLOW_TILES_SHA256__';
export function setIndexSha(sha) { INDEX_SHA256 = sha; }

export const HEADER_BYTES = 32, NODATA = 255, PIT = 8;
export const DEFAULT_MIN_CLASS = 8, MIN_HOLLOW_CELLS = 4;
export const LOAD_RADIUS = 300, MAX_IN_FLIGHT = 2, MAX_TILES = 32; // flow and hollow tiles together
export const LIFT_M = 0.12, HOLLOW_LIFT_M = 0.1;       // above the slope hachures (8 cm)
export const HOLLOW_COLOR = [0.62, 0.74, 0.86, 0.45];
const ESRI = { 64: 0, 128: 1, 1: 2, 2: 3, 4: 4, 8: 5, 16: 6, 32: 7 };  // ESRI power of two -> compass octant

// Pure: bytes -> { samples, nodeGrid, spacing, size, e0, n0, classes, nodata, channels, acc, dir, hollow }.
// dir is always returned in the compass code (0..7, PIT, NODATA).
export function decodeFlowTile(buffer, { encoding } = {}) {
  const bytes = buffer instanceof ArrayBuffer ? buffer : buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  if (bytes.byteLength < 16) throw Error('flow tile shorter than its header');
  const dv = new DataView(bytes);
  const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
  if (!magic.startsWith('GGF')) throw Error(`flow tile magic "${magic}" is not GGF*`);
  const version = dv.getUint16(4, true);
  if (version !== 1) throw Error(`flow tile version ${version} is not 1`);
  let samples = dv.getUint16(6, true), header = HEADER_BYTES, bodies = 0;
  const spacingMm = dv.getUint16(8, true);
  if (spacingMm === 0) throw Error('flow tile has no usable grid');
  const fits = (s, h) => { for (const b of [2, 3]) if (bytes.byteLength === h + b * s * s) return b; return 0; };
  bodies = samples >= 2 ? fits(samples, header) : 0;
  if (!bodies) { // the header may be another length: let the body fix the grid
    for (const s of [samples, 257, 256]) {
      for (const b of [2, 3]) {
        const h = bytes.byteLength - b * s * s;
        if (s >= 2 && h >= 16 && h <= 256) { samples = s; header = h; bodies = b; break; }
      }
      if (bodies) break;
    }
  }
  if (!bodies) throw Error(`flow tile is ${bytes.byteLength} bytes, which fits no ${samples}-sample grid`);
  const n = samples * samples, spacing = spacingMm / 1000, nodeGrid = samples % 2 === 1;
  const acc = new Uint8Array(bytes, header, n), raw = new Uint8Array(bytes, header + n, n);
  const hollow = bodies === 3 ? new Uint8Array(bytes, header + 2 * n, n) : null;
  const esri = encoding ? encoding === 'esri' : looksEsri(raw);
  const dir = new Uint8Array(n);
  for (let k = 0; k < n; k++) {
    const d = raw[k];
    dir[k] = d === NODATA ? NODATA : esri ? (d === 0 ? PIT : ESRI[d] ?? NODATA) : (d <= PIT ? d : NODATA);
  }
  return {
    samples, nodeGrid, spacing, size: (nodeGrid ? samples - 1 : samples) * spacing,
    e0: dv.getInt32(12, true), n0: dv.getInt32(16, true), logScale: header >= 21 ? dv.getUint8(20) : 0,
    nodata: header >= 28 ? dv.getUint32(24, true) : 0, channels: header >= 32 ? dv.getUint32(28, true) : 0,
    esri, acc, dir, hollow
  };
}

// ESRI codes 16..128 cannot be compass octants; 1/2/4 alone can, so they decide nothing.
function looksEsri(raw) {
  for (let k = 0; k < raw.length; k++) { const d = raw[k]; if (d !== NODATA && d > PIT) return true; }
  return false;
}

// Unit step (east, north) in cells for a compass octant.
export const STEP = [[0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1]];

// Colour for an accumulation class: a quiet grey-blue that brightens and firms up as the flow grows.
export function colorFor(c, minClass, maxClass) {
  const f = maxClass > minClass ? Math.min(1, Math.max(0, (c - minClass) / (maxClass - minClass))) : 1;
  return [0.30 + 0.30 * f, 0.50 + 0.30 * f, 0.72 + 0.20 * f, 0.30 + 0.55 * f];
}

// Pure: downhill segments for one tile, grouped by class. x0, y0: the tile's south-west corner in local
// metres; positions relative to origin. Each segment runs from a cell centre to the centre of the cell it
// drains into (so a channel reads as a continuous line). Returns { [class]: Float32Array }.
export function segments(t, x0, y0, minClass, heightAt, { lift = LIFT_M, origin = [0, 0, 0] } = {}) {
  const out = {}, s = t.samples, h = t.spacing, off = t.nodeGrid ? 0 : h / 2;
  for (let j = 0; j < s; j++) {
    for (let i = 0; i < s; i++) {
      const k = j * s + i, c = t.acc[k], d = t.dir[k];
      if (c === NODATA || c < minClass || d >= PIT) continue;
      const ax = x0 + off + i * h, ay = y0 + off + j * h, bx = ax + STEP[d][0] * h, by = ay + STEP[d][1] * h;
      (out[c] ||= []).push(
        ax - origin[0], ay - origin[1], finite(heightAt(ax, ay)) + lift - origin[2],
        bx - origin[0], by - origin[1], finite(heightAt(bx, by)) + lift - origin[2]);
    }
  }
  for (const c in out) out[c] = new Float32Array(out[c]);
  return out;
}

// Pure: a .gph ponding-hollow tile (flow_hollows.py): 32-byte header "GGP1" | u16 version=1 | u16 samples |
// u16 spacing_mm | u16 unit_mm | i32 origin_e_m | i32 origin_n_m (SW) | u32 wet_count | u32 hollows | u32 0, then
// samples^2 u8 depth in unit_mm steps (1..254 inside a kept hollow, 0 dry, 255 no data), rows south to north.
// Returned shaped like a flow tile (samples, spacing, nodeGrid, hollow) so hollowOutline draws it.
export function decodeHollowTile(buffer) {
  const bytes = buffer instanceof ArrayBuffer ? buffer : buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  if (bytes.byteLength < HEADER_BYTES) throw Error('hollow tile shorter than its header');
  const dv = new DataView(bytes);
  const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
  const samples = dv.getUint16(6, true), spacingMm = dv.getUint16(8, true);
  if (magic !== GPH_MAGIC || dv.getUint16(4, true) !== 1) throw Error(`hollow tile "${magic}" is not GGP1 version 1`);
  if (!spacingMm || bytes.byteLength !== HEADER_BYTES + samples * samples) throw Error(`hollow tile is ${bytes.byteLength} bytes, not a ${samples}-sample grid`);
  const spacing = spacingMm / 1000, nodeGrid = samples % 2 === 1;
  return { samples, nodeGrid, spacing, size: (nodeGrid ? samples - 1 : samples) * spacing, unitM: dv.getUint16(10, true) / 1000,
    e0: dv.getInt32(12, true), n0: dv.getInt32(16, true), wet: dv.getUint32(20, true), hollows: dv.getUint32(24, true),
    hollow: new Uint8Array(bytes, HEADER_BYTES, samples * samples) };
}

// Pure: which cells are hollows (flagged in the optional mask body), kept only in
// 4-connected groups of at least minCells. Returns a Uint8Array mask.
export function hollowMask(t, minCells = MIN_HOLLOW_CELLS) {
  const s = t.samples, n = s * s, raw = new Uint8Array(n), keep = new Uint8Array(n), seen = new Uint8Array(n);
  if (!t.hollow) return keep; // no mask written: no hollows are claimed
  for (let k = 0; k < n; k++) raw[k] = t.hollow[k] !== 0 && t.hollow[k] !== NODATA ? 1 : 0;
  const stack = [];
  for (let k0 = 0; k0 < n; k0++) {
    if (!raw[k0] || seen[k0]) continue;
    const group = [];
    stack.push(k0); seen[k0] = 1;
    while (stack.length) {
      const k = stack.pop(), i = k % s, j = (k - i) / s;
      group.push(k);
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const a = i + di, b = j + dj, q = b * s + a;
        if (a < 0 || b < 0 || a >= s || b >= s || !raw[q] || seen[q]) continue;
        seen[q] = 1; stack.push(q);
      }
    }
    if (group.length >= minCells) for (const k of group) keep[k] = 1;
  }
  return keep;
}

// Pure: the outline of the hollows as cell-edge segments (each cell a square of side spacing about its
// centre), draped. Returns a Float32Array of segments.
// openEdges: a neighbour beyond the tile counts as inside (a .gph hollow runs on into the next tile; no seam line).
export function hollowOutline(t, x0, y0, heightAt, { minCells = MIN_HOLLOW_CELLS, lift = HOLLOW_LIFT_M, origin = [0, 0, 0], openEdges = false } = {}) {
  const m = hollowMask(t, minCells), s = t.samples, h = t.spacing, off = t.nodeGrid ? 0 : h / 2, out = [];
  const inside = (i, j) => (i < 0 || j < 0 || i >= s || j >= s) ? openEdges : m[j * s + i] === 1;
  const seg = (ax, ay, bx, by) => out.push(
    ax - origin[0], ay - origin[1], finite(heightAt(ax, ay)) + lift - origin[2],
    bx - origin[0], by - origin[1], finite(heightAt(bx, by)) + lift - origin[2]);
  for (let j = 0; j < s; j++) {
    for (let i = 0; i < s; i++) {
      if (!m[j * s + i]) continue;
      const cx = x0 + off + i * h, cy = y0 + off + j * h, w = cx - h / 2, e = cx + h / 2, so = cy - h / 2, no = cy + h / 2;
      if (!inside(i, j - 1)) seg(w, so, e, so);
      if (!inside(i, j + 1)) seg(w, no, e, no);
      if (!inside(i - 1, j)) seg(w, so, w, no);
      if (!inside(i + 1, j)) seg(e, so, e, no);
    }
  }
  return new Float32Array(out);
}

const finite = h => (Number.isFinite(h) ? h : 0);
const rectDist = (x, y, x0, y0, x1, y1) => Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(y0 - y, 0, y - y1));

export function createFlow() {
  let api = null, enabled = false, minClass = DEFAULT_MIN_CLASS, userClass = false, encoding;
  let index = null, indexState = 'idle', maxClass = 0; // idle | loading | ready | failed
  let pond = null; // the pipeline's hollows: { count, tiles } once flow-hollows.json is verified
  const loaded = new Map();   // key -> { tile, e0, n0, size, used, cache }
  const inFlight = new Set(), failed = new Set();
  let clock = 0, lastPos = null;
  const stats = { requested: [], evicted: [] };
  const now = () => (api && typeof api.origin === 'function' ? api.origin() || { e: 0, n: 0 } : { e: 0, n: 0 });
  const say = s => { layer.status = `${s} (${LABEL})`; };

  function loadIndex() {
    if (indexState !== 'idle' || !api || !enabled) return;
    const sha = api.config?.sha256 || INDEX_SHA256;
    const path = api.config?.index || INDEX_PATH;
    if (!sha || sha.startsWith('__')) { indexState = 'failed'; say('no flow-tiles.json hash configured'); return; }
    indexState = 'loading';
    Promise.resolve().then(() => api.fetchJSON(path, sha)).then(j => {
      if (!j || !Array.isArray(j.tiles)) throw Error('flow-tiles.json has no tiles list');
      const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '';
      encoding = j.dir_encoding || j.direction_encoding || undefined;
      // Drainage lines start at the index's default class, else its channel area (k = floor(10 log10 m2)): class 8
      // (about 6 m2) would draw 44 % of the site.
      if (!userClass && Number.isFinite(j.default_class)) minClass = j.default_class;
      else if (!userClass && j.channel_m2 > 0) minClass = Math.floor(10 * Math.log10(j.channel_m2));
      if (Number.isFinite(j.classes)) maxClass = j.classes - 1;
      for (const t of j.tiles) if (Number.isFinite(t.max_log_class)) maxClass = Math.max(maxClass, t.max_log_class);
      index = j.tiles.map(t => ({ ...t, path: dir + t.file, size: j.tile_m || 256 }));
      return loadHollows();
    }).then(() => {
      indexState = 'ready';
      say(ready());
      pump();
      api.invalidate({ ground: false });
    }).catch(e => { indexState = 'failed'; say('flow-tiles.json failed: ' + e.message); });
  }

  // flow-hollows.json (config.hollows = { path, sha256 }): its tiles join the flow tiles, keyed h:<key>. A bad or
  // missing index leaves the drainage lines drawn and says so; the tile mask body is then not used either.
  function loadHollows() {
    const h = api.config?.hollows;
    if (!h?.path || !h?.sha256) return null;
    return Promise.resolve().then(() => api.fetchJSON(h.path, h.sha256)).then(j => {
      if (!j || !Array.isArray(j.tiles) || !Array.isArray(j.hollows)) throw Error('no tiles or hollows list');
      const dir = h.path.includes('/') ? h.path.slice(0, h.path.lastIndexOf('/') + 1) : '';
      pond = { count: j.hollows.length, tiles: j.tiles.map(t => ({ ...t, key: 'h:' + t.key, hollowTile: true, path: dir + t.file, size: j.tile_m || 256 })) };
    }).catch(e => { pond = { count: 0, tiles: [], error: 'flow-hollows.json failed: ' + e.message }; });
  }
  const ready = () => `index: ${index.length} flow tiles` + (!pond ? '' : pond.error ? `; ${pond.error}`
    : `; ${pond.count} ponding hollows (${HOLLOW_LABEL})`);

  // A tile the index says has no channel cells at all is never fetched.
  const empty = t => [t.channels, t.channel_count, t.drain].some(v => v === 0);

  function wanted(x, y) {
    if (!index) return [];
    const o = now();
    return [...index, ...(pond ? pond.tiles : [])]
      .map(t => ({ t, d: rectDist(x, y, t.e0 - o.e, t.n0 - o.n, t.e0 - o.e + t.size, t.n0 - o.n + t.size) }))
      .filter(v => v.d <= LOAD_RADIUS && !empty(v.t))
      .sort((a, b) => a.d - b.d)
      .map(v => v.t);
  }

  function request(entry) {
    inFlight.add(entry.key);
    stats.requested.push(entry.key);
    Promise.resolve().then(() => api.fetchVerified(entry.path, entry.sha256)).then(buf => {
      const tile = entry.hollowTile ? decodeHollowTile(buf) : decodeFlowTile(buf, { encoding });
      loaded.set(entry.key, { tile, e0: tile.e0, n0: tile.n0, size: tile.size, used: ++clock, cache: null });
      evict();
      api.invalidate({ ground: false });
    }).catch(e => { failed.add(entry.key); say(`flow tile ${entry.key} failed: ${e.message}`); })
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
    id: 'flow',
    label: `Drainage lines and ponding hollows: ${LABEL}`,
    status: `off (${LABEL})`,
    init(a) {
      api = a;
      if (Number.isFinite(a.config?.minClass)) { minClass = a.config.minClass; userClass = true; }
      if (a.config?.encoding) encoding = a.config.encoding;
      if (a.config?.enabled) layer.setEnabled(true);
    },
    setEnabled(on) {
      enabled = !!on;
      say(enabled ? (indexState === 'ready' ? ready() : 'on') : 'off');
      if (enabled) loadIndex();
      api?.invalidate({ ground: false });
      return enabled;
    },
    // The smallest accumulation class drawn as a drainage line.
    setMinClass(c) {
      if (!Number.isInteger(c) || c < 0 || c > 254) throw Error('flow class must be an integer 0..254');
      minClass = c; userClass = true;
      api?.invalidate({ ground: false });
      return minClass;
    },
    get enabled() { return enabled; },
    get minClass() { return minClass; },
    // ctx: { pos, heightAt, groundVersion }
    lines(ctx) {
      if (!api || !enabled) return [];
      lastPos = ctx.pos;
      if (indexState === 'idle') loadIndex();
      pump();
      // One tile is rebuilt per frame: when new ground arrives while walking, the others keep their last lines a
      // frame or two longer instead of every tile in reach rebuilding at once (a phone then drops below 30 fps).
      const gv = ctx.groundVersion || 0, o = now(), out = [];
      let rebuilt = 0, deferred = false;
      for (const [key, t] of loaded) {
        const x0 = t.e0 - o.e, y0 = t.n0 - o.n;
        if (rectDist(ctx.pos[0], ctx.pos[1], x0, y0, x0 + t.size, y0 + t.size) > LOAD_RADIUS) continue;
        const version = key.startsWith('h:') ? `h@${gv}@${x0},${y0}` : `${minClass}@${gv}@${x0},${y0}`;
        if ((!t.cache || t.cache.version !== version || t.cache.heightAt !== ctx.heightAt) && rebuilt++ > 0) {
          deferred = true;
          if (t.cache) { t.used = ++clock; out.push(...t.cache.batches); }
          continue;
        }
        if (!t.cache || t.cache.version !== version || t.cache.heightAt !== ctx.heightAt) {
          const cx = x0 + t.size / 2, cy = y0 + t.size / 2, org = [cx, cy, finite(ctx.heightAt(cx, cy))];
          if (key.startsWith('h:')) { // a pipeline hollow tile: every kept hollow, whole, outlined
            const rim = hollowOutline(t.tile, x0, y0, ctx.heightAt, { origin: org, minCells: 1, openEdges: true });
            t.cache = { version, heightAt: ctx.heightAt, batches: rim.length ? [{ key: `flow/hollows/${key.slice(2)}`, version,
              origin: org, color: HOLLOW_COLOR, positions: rim, label: HOLLOW_LABEL }] : [] };
            t.used = ++clock; out.push(...t.cache.batches); continue;
          }
          const top = Math.max(maxClass, minClass + 1);
          const byClass = segments(t.tile, x0, y0, minClass, ctx.heightAt, { origin: org });
          const batches = Object.keys(byClass).map(c => ({
            key: `flow/${key}/${c}`, version, origin: org, color: colorFor(+c, minClass, top),
            positions: byClass[c], label: LABEL }));
          const rim = pond ? new Float32Array(0) : hollowOutline(t.tile, x0, y0, ctx.heightAt, { origin: org });
          if (rim.length) batches.push({ key: `flow/${key}/hollows`, version, origin: org, color: HOLLOW_COLOR, positions: rim, label: LABEL });
          t.cache = { version, heightAt: ctx.heightAt, batches };
        }
        t.used = ++clock;
        out.push(...t.cache.batches);
      }
      if (deferred) api.invalidate({ ground: false }); // another frame finishes the rest
      return out;
    },
    // For tests and the console.
    debug: () => ({ loaded: [...loaded.keys()], inFlight: [...inFlight], failed: [...failed], indexState, enabled, minClass, maxClass, encoding, label: LABEL,
      hollows: pond ? pond.count : null, ...stats })
  };
  return layer;
}

export default createFlow();
