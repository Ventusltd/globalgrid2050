// Live terrain: Environment Agency LIDAR Composite DTM 1 m, fetched from the EA's public WCS 2.0.1 in the
// browser, for anywhere the staged (hash-checked) tiles do not reach. The service sends
// Access-Control-Allow-Origin: *, so no proxy is needed.
//
// What the service actually returns (inspected 26 Sept 2026, see docs/integration/terrain-anywhere.md):
// a classic big-endian TIFF ("MM", 42), one band of 32-bit float (SampleFormat 3), no compression, no
// predictor, 256 x 256 internal tiles (small requests come back as strips), pixel-is-area with a
// ModelTransformation tag, and nodata -3.4028234663852886E38 in GDAL_NODATA. A box outside the survey but
// inside the service's extent (open sea) comes back as exact zeros with no nodata tag; a box outside its
// extent (Scotland) is answered with HTTP 500 and a JSON error. The decoder below reads exactly that and refuses anything else by
// name; deflate (compression 8 / 32946) is read with DecompressionStream in case the service ever switches.
//
// A 256 m box at 1 m is 256 x 256 pixels whose centres sit at e0 + 0.5 ... e0 + 255.5. It is held in the
// terrain layer's own tile shape ({ samples, spacing, baseCm, q: Uint16Array rows south to north }), and a
// point within half a metre of the box edge takes the edge pixel, so neighbouring boxes meet with no gap.

import { sampleTile, NODATA } from './layers/terrain.mjs';

export const WCS = Object.freeze({
  url: 'https://environment.data.gov.uk/spatialdata/lidar-composite-digital-terrain-model-dtm-1m/wcs',
  coverage: '13787b9a-26a4-4775-8523-806d13af58fc__Lidar_Composite_Elevation_DTM_1m'
});
// The coverage's envelope from DescribeCoverage (EPSG:27700). A box crossing it is answered with HTTP 500 and
// no CORS header, so only boxes wholly inside are asked for. Inside it, Wales and Scotland come back as zeros.
export const EXTENT = Object.freeze({ e0: 80000, n0: 4000, e1: 656000, n1: 665000 });
export const inExtent = (e0, n0, size = BOX_M) => e0 >= EXTENT.e0 && n0 >= EXTENT.n0 && e0 + size <= EXTENT.e1 && n0 + size <= EXTENT.n1;
export const BOX_M = 256, LOAD_RADIUS = 300, MAX_IN_FLIGHT = 2, MAX_TILES = 36, RETRY_MS = 60000;
export const LIVE_LABEL = 'live from the EA service';

export function wcsUrl(e0, n0, size = BOX_M) {
  return `${WCS.url}?service=WCS&version=2.0.1&request=GetCoverage&CoverageId=${WCS.coverage}` +
    `&subset=E(${e0},${e0 + size})&subset=N(${n0},${n0 + size})&format=image/tiff`;
}

// ---- GeoTIFF: only what the EA service sends --------------------------------------------------
const TYPE_BYTES = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };

function readTags(dv, little) {
  if (dv.byteLength < 8) throw Error('GeoTIFF shorter than its header');
  const order = String.fromCharCode(dv.getUint8(0), dv.getUint8(1));
  if (order !== (little ? 'II' : 'MM')) throw Error(`GeoTIFF byte order "${order}" not recognised`);
  const magic = dv.getUint16(2, little);
  if (magic === 43) throw Error('BigTIFF is not supported (the EA service sends classic TIFF)');
  if (magic !== 42) throw Error(`TIFF magic ${magic} is not 42`);
  const ifd = dv.getUint32(4, little), count = dv.getUint16(ifd, little), tags = new Map();
  for (let i = 0; i < count; i++) {
    const p = ifd + 2 + 12 * i, tag = dv.getUint16(p, little), type = dv.getUint16(p + 2, little), n = dv.getUint32(p + 4, little);
    const bytes = (TYPE_BYTES[type] || 1) * n, at = bytes <= 4 ? p + 8 : dv.getUint32(p + 8, little);
    if (at + bytes > dv.byteLength) throw Error(`TIFF tag ${tag} runs past the end of the file`);
    const vals = [];
    for (let k = 0; k < n; k++) {
      const q = at + k * (TYPE_BYTES[type] || 1);
      vals.push(type === 3 ? dv.getUint16(q, little) : type === 4 ? dv.getUint32(q, little)
        : type === 12 ? dv.getFloat64(q, little) : type === 11 ? dv.getFloat32(q, little)
          : type === 5 ? dv.getUint32(q, little) / dv.getUint32(q + 4, little) : dv.getUint8(q));
    }
    tags.set(tag, type === 2 ? String.fromCharCode(...vals).replace(/\0+$/, '') : vals);
  }
  return tags;
}

async function inflate(bytes) {
  if (typeof DecompressionStream !== 'function') throw Error('this browser cannot inflate deflate-compressed GeoTIFF');
  const s = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}

// bytes -> { width, height, data: Float32Array rows north to south, nodata, west, north, res }.
export async function decodeGeoTiff(buffer) {
  const ab = buffer instanceof ArrayBuffer ? buffer : buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const dv = new DataView(ab), little = dv.byteLength > 1 && dv.getUint8(0) === 0x49;
  const tags = readTags(dv, little), one = (t, d) => (tags.has(t) ? tags.get(t)[0] : d);
  const width = one(256), height = one(257), bits = one(258, 1), comp = one(259, 1);
  const spp = one(277, 1), fmt = one(339, 1), predictor = one(317, 1), planar = one(284, 1);
  if (!(width > 0 && height > 0)) throw Error('GeoTIFF has no size');
  if (bits !== 32 || fmt !== 3 || spp !== 1) throw Error(`GeoTIFF is ${spp} x ${bits}-bit format ${fmt}; expected one 32-bit float band`);
  if (predictor !== 1 || planar !== 1) throw Error(`GeoTIFF predictor ${predictor} / planar ${planar} is not supported`);
  if (![1, 8, 32946].includes(comp)) throw Error(`GeoTIFF compression ${comp} is not supported`);
  const tiled = tags.has(322);
  const bw = tiled ? one(322) : width, bh = tiled ? one(323) : one(278, height);
  const offsets = tags.get(tiled ? 324 : 273), counts = tags.get(tiled ? 325 : 279);
  if (!offsets || !counts || offsets.length !== counts.length) throw Error('GeoTIFF has no pixel blocks');
  const across = tiled ? Math.ceil(width / bw) : 1, data = new Float32Array(width * height);
  for (let b = 0; b < offsets.length; b++) {
    if (offsets[b] + counts[b] > ab.byteLength) throw Error('GeoTIFF block runs past the end of the file');
    let raw = new Uint8Array(ab, offsets[b], counts[b]);
    if (comp !== 1) raw = await inflate(raw);
    const bdv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
    const bx = (b % across) * bw, by = Math.floor(b / across) * bh, rows = Math.min(bh, height - by);
    const need = (tiled ? bh : rows) * bw * 4;
    if (raw.byteLength < Math.min(need, rows * bw * 4)) throw Error(`GeoTIFF block ${b} is ${raw.byteLength} bytes, expected ${need}`);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < bw && bx + c < width; c++) data[(by + r) * width + bx + c] = bdv.getFloat32((r * bw + c) * 4, little);
    }
  }
  let west, north, res;
  if (tags.has(34264)) { const m = tags.get(34264); [res, west, north] = [m[0], m[3], m[7]]; if (Math.abs(m[5] + res) > 1e-9) throw Error('GeoTIFF pixels are not square'); }
  else if (tags.has(33550) && tags.has(33922)) { const s = tags.get(33550), t = tags.get(33922); [res, west, north] = [s[0], t[3] - t[0] * s[0], t[4] + t[1] * s[1]]; }
  else throw Error('GeoTIFF has no georeference');
  const nd = tags.has(42113) ? Number(tags.get(42113)) : NaN;
  return { width, height, data, nodata: nd, hasNodata: tags.has(42113), west, north, res };
}

// A decoded box -> the terrain layer's tile shape. The first sample sits half a metre in from the south-west
// corner (pixel centre). Heights go to centimetres above the box's lowest point; no data becomes NODATA.
export function toTile(geo) {
  const { width: w, height: h, data, res } = geo;
  if (w !== h) throw Error(`live box is ${w} x ${h} pixels; expected a square`);
  // Outside the survey (open sea, say) the service sends a box of exact zeros with no nodata tag at all.
  const blank = !geo.hasNodata && data.every(v => v === 0);
  const isNo = v => blank || !Number.isFinite(v) || v === geo.nodata || v < -1e30 || v > 1e5;
  let min = Infinity, max = -Infinity, nodata = 0;
  for (const v of data) { if (isNo(v)) { nodata++; continue; } if (v < min) min = v; if (v > max) max = v; }
  const baseCm = Number.isFinite(min) ? Math.floor(min * 100) : 0;
  if (max * 100 - baseCm > 0xfffe) throw Error('live box spans more than 655 m of height');
  const q = new Uint16Array(w * h);
  for (let r = 0; r < h; r++) { // TIFF rows run north to south; tile rows run south to north
    for (let c = 0; c < w; c++) { const v = data[r * w + c]; q[(h - 1 - r) * w + c] = isNo(v) ? NODATA : Math.round(v * 100 - baseCm); }
  }
  return { version: 1, samples: w, spacing: res, flags: 0, e0: geo.west + res / 2, n0: geo.north - h * res + res / 2,
    baseCm, minQ: 0, maxQ: Number.isFinite(max) ? Math.round(max * 100 - baseCm) : 0, nodata, q };
}

// Height inside a live box at (u, v) metres from its south-west corner: edge pixels hold out to the box edge.
export function sampleBox(tile, u, v) {
  const s = (tile.samples - 1) * tile.spacing, half = tile.spacing / 2;
  if (!(u >= 0 && v >= 0 && u <= s + tile.spacing && v <= s + tile.spacing)) return NaN;
  return sampleTile(tile, Math.min(Math.max(u - half, 0), s), Math.min(Math.max(v - half, 0), s));
}

// Boxes (south-west corners on the 256 m national-grid lattice) within radius of (e, n), nearest first.
export function boxesNear(e, n, radius = LOAD_RADIUS, size = BOX_M) {
  const out = [];
  for (let i = Math.floor((e - radius) / size); i <= Math.floor((e + radius) / size); i++) {
    for (let j = Math.floor((n - radius) / size); j <= Math.floor((n + radius) / size); j++) {
      const e0 = i * size, n0 = j * size;
      const d = Math.hypot(Math.max(e0 - e, 0, e - e0 - size), Math.max(n0 - n, 0, n - n0 - size));
      if (d <= radius) out.push({ key: `${e0}_${n0}`, e0, n0, d, c: Math.hypot(e - e0 - size / 2, n - n0 - size / 2) });
    }
  }
  return out.sort((a, b) => a.d - b.d || a.c - b.c);
}

// The live layer. opts: origin() -> { e, n }; invalidate(); skip(e0, n0, size) -> true where staged tiles
// cover the box; fetchImpl, clock (ms) for tests. It behaves like a manifest layer: status, heightAt, lines.
export function createLiveTerrain({ origin, invalidate = () => {}, skip = () => false, fetchImpl, clock = () => Date.now() } = {}) {
  const get = fetchImpl || ((u, o) => fetch(u, o));
  const loaded = new Map(), inFlight = new Set(), failed = new Map(); // failed: key -> retry-after ms
  const stats = { requested: [], evicted: [], bytes: 0, ms: [], empty: 0 };
  let used = 0, lastPos = null, lastError = '', outside = false;
  const o = () => origin();

  function describe() {
    const n = loaded.size, fly = inFlight.size;
    if (outside && !n && !fly) return 'outside the EA LiDAR coverage (England only); the ground here is shown flat';
    if (lastError && !n) return `EA LiDAR service failed (${lastError}); the ground here is shown flat`;
    if (!n && !fly) return 'no live EA LiDAR needed here yet';
    const empty = [...loaded.values()].filter(b => b.tile.nodata === b.tile.q.length).length;
    return `${n} box${n === 1 ? '' : 'es'} ${LIVE_LABEL}${fly ? `, ${fly} loading` : ''}` +
      `${empty ? `; ${empty} with no survey (sea or not flown), shown flat` : ''}${lastError ? ` (last failure: ${lastError})` : ''}`;
  }

  function request(b) {
    inFlight.add(b.key); stats.requested.push(b.key);
    const t0 = clock();
    layer.status = describe();
    Promise.resolve().then(() => get(wcsUrl(b.e0, b.n0), { mode: 'cors' })).then(async res => {
      if (!res.ok) throw Error(`HTTP ${res.status}${res.status >= 500 ? ', outside England or the service is down' : ''}`);
      const buf = await res.arrayBuffer();
      stats.bytes += buf.byteLength;
      const tile = toTile(await decodeGeoTiff(buf));
      stats.ms.push(clock() - t0);
      if (tile.nodata === tile.q.length) stats.empty++;
      loaded.set(b.key, { tile, e0: b.e0, n0: b.n0, size: BOX_M, used: ++used });
      lastError = '';
      while (loaded.size > MAX_TILES) {
        let old = null;
        for (const [k, v] of loaded) if (!old || v.used < loaded.get(old).used) old = k;
        loaded.delete(old); stats.evicted.push(old);
      }
      invalidate();
    }).catch(e => { lastError = e instanceof TypeError ? `network: ${e.message}` : e.message; failed.set(b.key, clock() + RETRY_MS); })
      .finally(() => { inFlight.delete(b.key); layer.status = describe(); pump(); });
  }

  function pump() {
    if (!lastPos) return;
    const { e, n } = o(), now = clock(), near = boxesNear(e + lastPos[0], n + lastPos[1]);
    const wasOutside = outside;
    outside = !near.some(b => inExtent(b.e0, b.n0));
    if (outside !== wasOutside) layer.status = describe();
    for (const b of near) {
      if (!inExtent(b.e0, b.n0)) continue;
      if (inFlight.size >= MAX_IN_FLIGHT) break;
      if (loaded.has(b.key)) { loaded.get(b.key).used = ++used; continue; }
      if (inFlight.has(b.key) || (failed.get(b.key) ?? 0) > now || skip(b.e0, b.n0, BOX_M)) continue;
      request(b);
    }
  }

  const layer = {
    id: 'terrain-live',
    status: 'waiting',
    // Local metres in, metres above datum out; NaN where no live box is held or the box has no data there.
    heightAt(x, y) {
      const { e, n } = o(), pe = e + x, pn = n + y;
      const b = loaded.get(`${Math.floor(pe / BOX_M) * BOX_M}_${Math.floor(pn / BOX_M) * BOX_M}`);
      if (!b) return NaN;
      b.used = ++used;
      return sampleBox(b.tile, pe - b.e0, pn - b.n0);
    },
    lines(ctx) { lastPos = ctx.pos; pump(); return []; },
    debug: () => ({ loaded: [...loaded.keys()], inFlight: [...inFlight], failed: [...failed.keys()], lastError, ...stats })
  };
  return layer;
}
