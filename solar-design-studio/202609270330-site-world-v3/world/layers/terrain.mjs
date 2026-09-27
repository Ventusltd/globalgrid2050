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

// The layer: tiles come through the shared loader (api.lib.tiles), which the substrate hash-checks.
export const LIB_VERSION = 1;

export function createTerrain() {
  let api = null, tl = null;
  const layer = {
    id: 'terrain',
    status: 'waiting for init',
    init(a) {
      api = a;
      if (!a.lib?.tiles) { layer.status = 'refused: api.lib.tiles not provided'; api = null; return; }
      tl = a.lib.tiles.createTileLoader(a, {
        file: 'tiles.json', path: INDEX_PATH, sha: () => INDEX_SHA256, tileNoun: 'tile', decode: decodeTile,
        radius: LOAD_RADIUS, maxInFlight: MAX_IN_FLIGHT, maxTiles: MAX_TILES, tieCentre: true, ground: true, pumpOnReady: false,
        say: t => { layer.status = t; }, onReady: () => { layer.status = `index: ${tl.index.length} tiles`; },
        onIndexError: e => { layer.status = `index failed, no ground: tiles.json refused (${e.message})`; }
      });
      layer.status = 'ready to load';
      tl.load();
    },
    // Finest loaded tile containing the point wins; NaN where no tile is loaded (the substrate falls back).
    heightAt(x, y) {
      if (!tl) return NaN;
      tl.follow();
      let best = null;
      for (const t of tl.loaded.values()) {
        if (x < t.x0 || y < t.y0 || x > t.x0 + t.size || y > t.y0 + t.size) continue;
        if (!best || t.tile.spacing < best.tile.spacing) best = t;
      }
      if (!best) return NaN;
      tl.touch(best);
      return sampleTile(best.tile, x - best.x0, y - best.y0);
    },
    lines(ctx) {
      if (!api) return [];
      tl.frame(ctx.pos);
      return [];
    },
    // For the plan inset: every tile in the index, and whether it is loaded now. Local metres.
    plan() {
      if (!tl?.index) return null;
      tl.follow();
      return { tiles: tl.index.map(t => ({ x0: t.x0, y0: t.y0, size: t.size, loaded: tl.loaded.has(t.key) })) };
    },
    // For tests and the console.
    debug: () => ({ ...tl?.debug(), ...tl?.stats })
  };
  return layer;
}

export default createTerrain();
