// Layer: slope. Short downslope tick marks (hachures) draped on the ground, drawn only where the slope
// exceeds a chosen limit (default 10 %). Off by default: until setEnabled(true) (or api.config.enabled)
// it fetches nothing and draws nothing. Slope classes come from .gst tiles written by the lidar pipeline
// (lidar/src/slope_tiles.py, Horn's method, paired on the GPU against Zevenbergen-Thorne); every file is
// fetched through the substrate's hash check (api.fetchVerified). Heights come from ctx.heightAt, the ground.
//
// Tile format (.gst, little-endian). 32-byte header:
//   0 magic "GGS1" | 4 u16 version=1 | 6 u16 samples=257 | 8 u16 spacing_mm | 10 u16 flags
//   12 i32 origin_e_m | 16 i32 origin_n_m (south-west corner) | 20 u8 classes=6 | 21 u8 method=1 (Horn)
//   22 u16 reserved | 24 u32 nodata_count | 28 u32 steep_count (class >= 3)
//   Body: samples*samples u8 slope class, then samples*samples u8 aspect; rows south to north, west to east.
//   Class 0: 0-2 %, 1: 2-5, 2: 5-10, 3: 10-15, 4: 15-25, 5: >25; 255 no data.
//   Aspect: 0..7 = downslope N NE E SE S SW W NW; 8 flat; 255 no data.

const INDEX_PATH = 'slope/slope-tiles.json';
// Filled by the build tool with the SHA-256 of slope-tiles.json. Until then the layer loads nothing.
let INDEX_SHA256 = '__SLOPE_TILES_SHA256__';
export function setIndexSha(sha) { INDEX_SHA256 = sha; }

export const HEADER_BYTES = 32, NODATA = 255, FLAT = 8;
export const LOWER = [0, 2, 5, 10, 15, 25];            // lower edge of each class, percent
export const DEFAULT_LIMIT = 10;
export const LOAD_RADIUS = 300, MAX_IN_FLIGHT = 2, MAX_TILES = 16;
export const STRIDE = 3, TICK_M = 1.4, LIFT_M = 0.08;  // one tick every 3 m, 1.4 m long, 8 cm above ground
// Quiet colours for a dark background: sage, olive, ochre, clay, muted red; alpha rises with the slope.
export const COLORS = [null,
  [0.56, 0.66, 0.58, 0.22], [0.66, 0.68, 0.48, 0.28], [0.78, 0.67, 0.42, 0.34],
  [0.84, 0.56, 0.38, 0.42], [0.84, 0.44, 0.40, 0.52]];

// Pure: bytes -> { samples, spacing, e0, n0, classes, method, nodata, steep, cls, asp }.
export function decodeSlopeTile(buffer) {
  const bytes = buffer instanceof ArrayBuffer ? buffer : buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  if (bytes.byteLength < HEADER_BYTES) throw Error('slope tile shorter than its header');
  const dv = new DataView(bytes);
  const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
  if (magic !== 'GGS1') throw Error(`slope tile magic "${magic}" is not GGS1`);
  const version = dv.getUint16(4, true);
  if (version !== 1) throw Error(`slope tile version ${version} is not 1`);
  const samples = dv.getUint16(6, true), spacingMm = dv.getUint16(8, true);
  if (samples < 2 || spacingMm === 0) throw Error('slope tile has no usable grid');
  const n = samples * samples;
  if (bytes.byteLength !== HEADER_BYTES + 2 * n) throw Error(`slope tile is ${bytes.byteLength} bytes, expected ${HEADER_BYTES + 2 * n}`);
  return {
    samples, spacing: spacingMm / 1000, e0: dv.getInt32(12, true), n0: dv.getInt32(16, true),
    classes: dv.getUint8(20), method: dv.getUint8(21), nodata: dv.getUint32(24, true), steep: dv.getUint32(28, true),
    cls: new Uint8Array(bytes, HEADER_BYTES, n), asp: new Uint8Array(bytes, HEADER_BYTES + n, n)
  };
}

// Pure: the first class that lies wholly at or above the limit (a limit between edges snaps up).
export function classForLimit(pct) {
  if (!(pct > 0)) return 1;
  for (let k = 1; k < LOWER.length; k++) if (LOWER[k] >= pct - 1e-9) return k;
  return LOWER.length; // above 25 %: nothing the classes can promise
}

// Unit vector (east, north) pointing downslope for an aspect octant.
export function downslope(o) {
  const a = o * Math.PI / 4;
  return [Math.round(Math.sin(a) * 1e12) / 1e12, Math.round(Math.cos(a) * 1e12) / 1e12];
}

// Pure: tick segments for one tile, grouped by class. x0, y0: the tile's south-west corner in local metres.
// Positions are relative to origin. Returns { [class]: Float32Array } for classes with ticks.
export function ticks(t, x0, y0, minClass, heightAt, { stride = STRIDE, tick = TICK_M, lift = LIFT_M, origin = [0, 0, 0] } = {}) {
  const out = {}, half = tick / 2, s = t.samples;
  for (let j = 0; j < s; j += stride) {
    for (let i = 0; i < s; i += stride) {
      const k = j * s + i, c = t.cls[k], o = t.asp[k];
      if (c === NODATA || c < minClass || o >= FLAT) continue;
      const [dx, dy] = downslope(o), x = x0 + i * t.spacing, y = y0 + j * t.spacing;
      const ax = x - dx * half, ay = y - dy * half, bx = x + dx * half, by = y + dy * half;
      (out[c] ||= []).push(
        ax - origin[0], ay - origin[1], finite(heightAt(ax, ay)) + lift - origin[2],
        bx - origin[0], by - origin[1], finite(heightAt(bx, by)) + lift - origin[2]);
    }
  }
  for (const c in out) out[c] = new Float32Array(out[c]);
  return out;
}

const finite = h => (Number.isFinite(h) ? h : 0);
// The layer: tiles come through the shared loader (api.lib.tiles), which the substrate hash-checks.
export const LIB_VERSION = 1;

export function createSlope() {
  let api = null, tl = null, enabled = false, limit = DEFAULT_LIMIT;
  const ready = () => `index: ${tl.index.length} slope tiles`;

  const layer = {
    id: 'slope',
    status: 'off',
    init(a) {
      if (!a.lib?.tiles) { layer.status = 'refused: api.lib.tiles not provided'; return; }
      api = a;
      tl = a.lib.tiles.createTileLoader(a, {
        file: 'slope-tiles.json', path: INDEX_PATH, sha: () => INDEX_SHA256, tileNoun: 'slope tile', decode: decodeSlopeTile,
        radius: LOAD_RADIUS, maxInFlight: MAX_IN_FLIGHT, maxTiles: MAX_TILES, active: () => enabled, keep: t => t.steep !== 0,
        say: t => { layer.status = t; }, onReady: () => { layer.status = ready(); }
      });
      if (Number.isFinite(a.config?.limit)) limit = a.config.limit;
      if (a.config?.enabled) layer.setEnabled(true);
    },
    setEnabled(on) {
      enabled = !!on;
      layer.status = enabled ? (tl?.state === 'ready' ? ready() : 'on') : 'off';
      if (enabled) tl?.load();
      api?.invalidate({ ground: false });
      return enabled;
    },
    setLimit(pct) {
      if (!Number.isFinite(pct)) throw Error('slope limit must be a number of percent');
      limit = pct;
      api?.invalidate({ ground: false });
      return classForLimit(limit);
    },
    get enabled() { return enabled; },
    get limit() { return limit; },
    // ctx: { pos, heightAt, groundVersion }
    lines(ctx) {
      if (!api || !enabled) return [];
      tl.frame(ctx.pos);
      const minClass = classForLimit(limit), gv = ctx.groundVersion || 0, out = [];
      if (minClass >= LOWER.length) return out;
      for (const [key, t] of tl.near(ctx.pos)) {
        const version = `${minClass}@${gv}`;
        if (!t.cache || t.cache.version !== version || t.cache.heightAt !== ctx.heightAt) {
          const cx = t.x0 + t.size / 2, cy = t.y0 + t.size / 2, o = [cx, cy, finite(ctx.heightAt(cx, cy))];
          const byClass = ticks(t.tile, t.x0, t.y0, minClass, ctx.heightAt, { origin: o });
          t.cache = { version, heightAt: ctx.heightAt, batches: Object.keys(byClass).map(c => ({
            key: `slope/${key}/${c}`, version, origin: o, color: COLORS[c], positions: byClass[c] })) };
        }
        tl.touch(t);
        out.push(...t.cache.batches);
      }
      return out;
    },
    // For tests and the console.
    debug: () => ({ ...tl?.debug(), enabled, limit, ...tl?.stats })
  };
  return layer;
}

export default createSlope();
