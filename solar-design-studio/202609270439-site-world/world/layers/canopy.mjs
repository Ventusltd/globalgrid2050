// Layer: canopy. Hedges and tree canopies as sparse vertical ticks, each from the ground up to the real canopy
// height measured by the Environment Agency LiDAR (first-return surface minus bare earth). Hedges are also solids:
// a walker cannot pass through one, the drone can fly over it. Off by default: until setEnabled(true) (or
// api.config.enabled) it fetches nothing and draws nothing. Tiles and hedge lines come from the lidar pipeline
// (lidar/src/canopy_tiles.py: two classification methods paired on the GPU, a CPU witness); every file is
// fetched through the substrate's hash check (api.fetchVerified). Heights of the ground come from ctx.heightAt.
//
// RULE: no buildings are shown. Only classes 1 (hedge) and 2 (tree) are ever drawn; class 3 (structure) and
// class 4 (uncertain: the two methods disagree, or vegetation on the rim of a structure) are skipped here even
// if a tile were to carry a height for them.
// TOWERS: a steel lattice tower returns first and last pulses like a tree, so the classifier can call it one. Every
// known tower (the grid layer's and the national layer's, from api.towers()) masks tree cells within TOWER_MASK_M.
//
// Tile format (.gcn, little-endian). 32-byte header:
//   0 magic "GGC1" | 4 u16 version=1 | 6 u16 samples=257 | 8 u16 spacing_mm | 10 u16 flags
//   12 i32 origin_e_m | 16 i32 origin_n_m (south-west corner) | 20 u16 height_step_mm (200) | 22 u16 reserved
//   24 u32 nodata_count | 28 u32 shown_count (classes 1 and 2)
//   Body: samples*samples u8 class, then samples*samples u8 canopy height in steps; rows south to north, west to east.
// Index (canopy-tiles.json): { tiles: [{ key, file, sha256, e0, n0, hedge, tree }], hedges: { file, sha256 } }.
// hedges.json: { lines: [{ id, pts: [[e, n, height_m], ...], width_m }] } in British National Grid metres.

const INDEX_PATH = 'canopy/canopy-tiles.json';
// Filled by the build tool with the SHA-256 of canopy-tiles.json. Until then the layer loads nothing.
let INDEX_SHA256 = '__CANOPY_TILES_SHA256__';
export function setIndexSha(sha) { INDEX_SHA256 = sha; }

export const HEADER_BYTES = 32, NODATA = 255, HEDGE = 1, TREE = 2, SHOWN = Object.freeze([HEDGE, TREE]);
export const LOAD_RADIUS = 300, MAX_IN_FLIGHT = 2, MAX_TILES = 16;
export const TOWER_MASK_M = 12;     // a 400 kV lattice base is about 8 to 10 m square; its arms reach further up
export const STRIDE = 4;            // one tree tick per 4 m square, at a fixed pseudo-random cell inside it
export const HEDGE_STEP = 1.5;      // metres between hedge ticks along a line
export const SOLID_STEP = 1, SOLID_RADIUS = 60, SOLID_MIN_HALF = 0.5, SOLID_MAX_HALF = 1.5, SOLID_SINK = 0.5;
export const COLORS = { tree: [0.50, 0.72, 0.52, 0.44], hedge: [0.78, 0.84, 0.52, 0.62], hedgeTop: [0.74, 0.80, 0.50, 0.30] };

// Pure: bytes -> { samples, spacing, e0, n0, step, nodata, shown, cls, h }.
export function decodeCanopyTile(buffer) {
  const bytes = buffer instanceof ArrayBuffer ? buffer : buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  if (bytes.byteLength < HEADER_BYTES) throw Error('canopy tile shorter than its header');
  const dv = new DataView(bytes);
  const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
  if (magic !== 'GGC1') throw Error(`canopy tile magic "${magic}" is not GGC1`);
  const version = dv.getUint16(4, true);
  if (version !== 1) throw Error(`canopy tile version ${version} is not 1`);
  const samples = dv.getUint16(6, true), spacingMm = dv.getUint16(8, true), stepMm = dv.getUint16(20, true);
  if (samples < 2 || spacingMm === 0 || stepMm === 0) throw Error('canopy tile has no usable grid');
  const n = samples * samples;
  if (bytes.byteLength !== HEADER_BYTES + 2 * n) throw Error(`canopy tile is ${bytes.byteLength} bytes, expected ${HEADER_BYTES + 2 * n}`);
  return {
    samples, spacing: spacingMm / 1000, e0: dv.getInt32(12, true), n0: dv.getInt32(16, true), step: stepMm / 1000,
    nodata: dv.getUint32(24, true), shown: dv.getUint32(28, true),
    cls: new Uint8Array(bytes, HEADER_BYTES, n), h: new Uint8Array(bytes, HEADER_BYTES + n, n)
  };
}

// A fixed pseudo-random offset per block, so ticks do not stand in rows but are the same every frame.
export function blockOffset(bi, bj, stride) {
  let x = (Math.imul(bi, 73856093) ^ Math.imul(bj, 19349663)) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 2246822519) >>> 0; x = (x ^ (x >>> 13)) >>> 0;
  return [x % stride, (x >>> 8) % stride];
}

// Pure: vertical tree ticks for one tile. x0, y0: the tile's south-west corner in local metres. Only class 2.
// Returns Float32Array of segments (6 floats each) relative to origin.
// mask: tower positions [[x, y], ...] in the same local metres; tree cells within maskM of one are not drawn.
export function treeTicks(t, x0, y0, heightAt, { stride = STRIDE, origin = [0, 0, 0], mask = [], maskM = TOWER_MASK_M } = {}) {
  const out = [], s = t.samples, last = s - 1, size = last * t.spacing; // the last row and column belong to the next tile
  const m = mask.filter(([mx, my]) => mx > x0 - maskM && mx < x0 + size + maskM && my > y0 - maskM && my < y0 + size + maskM);
  for (let bj = 0; bj * stride < last; bj++) {
    for (let bi = 0; bi * stride < last; bi++) {
      const [oi, oj] = blockOffset(bi + Math.round(t.e0 / stride), bj + Math.round(t.n0 / stride), stride);
      const i = bi * stride + oi, j = bj * stride + oj;
      if (i >= last || j >= last) continue;
      const k = j * s + i;
      if (t.cls[k] !== TREE || t.h[k] === 0) continue;
      const x = x0 + i * t.spacing, y = y0 + j * t.spacing;
      if (m.length && m.some(([mx, my]) => (x - mx) ** 2 + (y - my) ** 2 <= maskM * maskM)) continue;
      const g = finite(heightAt(x, y));
      out.push(x - origin[0], y - origin[1], g - origin[2], x - origin[0], y - origin[1], g + t.h[k] * t.step - origin[2]);
    }
  }
  return new Float32Array(out);
}

// Points every `step` metres along a polyline [[x, y, h], ...] (local metres), height interpolated. Pure.
export function along(pts, step) {
  const out = [];
  for (let k = 0; k + 1 < pts.length; k++) {
    const [ax, ay, ah] = pts[k], [bx, by, bh] = pts[k + 1], L = Math.hypot(bx - ax, by - ay);
    const n = Math.max(1, Math.ceil(L / step));
    for (let m = k === 0 ? 0 : 1; m <= n; m++) { const f = m / n; out.push([ax + (bx - ax) * f, ay + (by - ay) * f, ah + (bh - ah) * f]); }
  }
  return out;
}

// Pure: hedge ticks, a faint top line and solid boxes. lines: hedges.json lines; en: site origin { e, n }.
// Returns { ticks: Float32Array, tops: Float32Array, solids: [{ min, max, line }] } (ticks/tops relative to origin).
export function hedgeGeometry(lines, en, heightAt, { step = HEDGE_STEP, solidStep = SOLID_STEP, origin = [0, 0, 0] } = {}) {
  const ticks = [], tops = [], solids = [];
  for (const l of lines || []) {
    if (!Array.isArray(l.pts) || l.pts.length < 2) continue;
    const pts = l.pts.map(([e, n, h]) => [e - en.e, n - en.n, Math.max(0, +h || 0)]);
    let prev = null;
    for (const [x, y, h] of along(pts, step)) {
      const g = finite(heightAt(x, y)), top = [x - origin[0], y - origin[1], g + h - origin[2]];
      ticks.push(x - origin[0], y - origin[1], g - origin[2], ...top);
      if (prev) tops.push(...prev, ...top);
      prev = top;
    }
    const half = Math.min(SOLID_MAX_HALF, Math.max(SOLID_MIN_HALF, (+l.width_m || 1) / 2));
    for (const [x, y, h] of along(pts, solidStep)) {
      if (!(h > 0)) continue;
      const g = finite(heightAt(x, y));
      solids.push({ min: [x - half, y - half, g - SOLID_SINK], max: [x + half, y + half, g + h], line: l.id });
    }
  }
  return { ticks: new Float32Array(ticks), tops: new Float32Array(tops), solids };
}

const finite = h => (Number.isFinite(h) ? h : 0);
// The layer: tiles come through the shared loader (api.lib.tiles), which the substrate hash-checks.
export const LIB_VERSION = 1;

export function createCanopy() {
  let api = null, tl = null, enabled = false;
  let hedgeLines = null, hedgeBuilt = null;  // hedgeBuilt: { version, heightAt, batches, solids }

  function statusLine() {
    const n = tl?.index ? tl.index.length : 0, h = hedgeLines ? hedgeLines.length : 0;
    return `${n} canopy tiles, ${h} hedge lines; structures and uncertain cells hidden`;
  }

  // The hedge lines come with the index: fetched once it has arrived, through the same hash check.
  function loadHedges(j, dir) {
    if (!j.hedges?.file || !j.hedges?.sha256) return;
    return api.fetchJSON(dir + j.hedges.file, j.hedges.sha256).then(hj => {
      if (!hj || !Array.isArray(hj.lines)) throw Error('hedges.json has no lines list');
      hedgeLines = hj.lines;
      layer.status = statusLine();
      api.invalidate({ ground: false });
    });
  }

  function hedges(ctx) {
    if (!hedgeLines) return null;
    const origin = tl.origin, version = `${ctx.groundVersion || 0}@${origin.e},${origin.n}`;
    if (!hedgeBuilt || hedgeBuilt.version !== version || hedgeBuilt.heightAt !== ctx.heightAt) {
      const o = [0, 0, finite(ctx.heightAt(0, 0))];
      const g = hedgeGeometry(hedgeLines, origin, ctx.heightAt, { origin: o });
      hedgeBuilt = { version, heightAt: ctx.heightAt, solids: g.solids, batches: [
        { key: 'canopy/hedge-ticks', version, origin: o, color: COLORS.hedge, positions: g.ticks },
        { key: 'canopy/hedge-tops', version, origin: o, color: COLORS.hedgeTop, positions: g.tops }] };
    }
    return hedgeBuilt;
  }

  const layer = {
    id: 'canopy',
    status: 'off',
    init(a) {
      if (!a.lib?.tiles) { layer.status = 'refused: api.lib.tiles not provided'; return; }
      api = a;
      tl = a.lib.tiles.createTileLoader(a, {
        file: 'canopy-tiles.json', path: INDEX_PATH, sha: () => INDEX_SHA256, tileNoun: 'canopy tile', decode: decodeCanopyTile,
        radius: LOAD_RADIUS, maxInFlight: MAX_IN_FLIGHT, maxTiles: MAX_TILES, active: () => enabled, keep: t => t.tree !== 0,
        say: t => { layer.status = t; }, onReady: () => { layer.status = statusLine(); }, afterReady: loadHedges,
        onIndexError: (e, whileLoading) => { layer.status = (whileLoading ? 'canopy-tiles.json' : 'hedges.json') + ' failed: ' + e.message; },
        onMove: () => { hedgeBuilt = null; }
      });
      if (a.config?.enabled) layer.setEnabled(true);
    },
    setEnabled(on) {
      enabled = !!on;
      layer.status = enabled ? (tl?.state === 'ready' ? statusLine() : 'on') : 'off';
      if (enabled) tl?.load();
      api?.invalidate({ ground: false });
      return enabled;
    },
    get enabled() { return enabled; },
    // ctx: { pos, heightAt, groundVersion }
    lines(ctx) {
      if (!api || !enabled) return [];
      tl.frame(ctx.pos);
      const gv = ctx.groundVersion || 0, out = [], o0 = tl.origin;
      const mask = (typeof api.towers === 'function' ? api.towers() : []).filter(p => Number.isFinite(p?.e) && Number.isFinite(p?.n))
        .map(p => [p.e - o0.e, p.n - o0.n]);
      for (const [key, t] of tl.near(ctx.pos)) {
        const size = (t.tile.samples - 1) * t.tile.spacing, pad = TOWER_MASK_M;
        const mine = mask.filter(([x, y]) => x > t.x0 - pad && x < t.x0 + size + pad && y > t.y0 - pad && y < t.y0 + size + pad);
        const version = mine.length ? `${gv}|${mine.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(';')}` : `${gv}`; // new towers, new ticks
        if (!t.cache || t.cache.version !== version || t.cache.heightAt !== ctx.heightAt) {
          const cx = t.x0 + t.size / 2, cy = t.y0 + t.size / 2, o = [cx, cy, finite(ctx.heightAt(cx, cy))];
          const positions = treeTicks(t.tile, t.x0, t.y0, ctx.heightAt, { origin: o, mask: mine });
          t.cache = { version, heightAt: ctx.heightAt, batch: { key: `canopy/tree/${key}`, version, origin: o, color: COLORS.tree, positions } };
        }
        tl.touch(t);
        if (t.cache.batch.positions.length) out.push(t.cache.batch);
      }
      const h = hedges(ctx);
      if (h) out.push(...h.batches.filter(b => b.positions.length));
      return out;
    },
    // Hedge boxes near the viewer (built with the ground the last lines() call saw). Walkers are blocked;
    // each box stops at the hedge top, so the drone passes over.
    solids(ctx) {
      if (!enabled || !hedgeBuilt || !ctx?.pos) return [];
      const [x, y] = ctx.pos;
      const d = api.lib.tiles.rectDist;
      return hedgeBuilt.solids.filter(b => d(x, y, b.min[0], b.min[1], b.max[0], b.max[1]) <= SOLID_RADIUS);
    },
    // For tests and the console.
    debug: () => ({ ...tl?.debug(), enabled,
      hedgeLines: hedgeLines ? hedgeLines.length : 0, solids: hedgeBuilt ? hedgeBuilt.solids.length : 0, ...tl?.stats })
  };
  return layer;
}

export default createCanopy();
