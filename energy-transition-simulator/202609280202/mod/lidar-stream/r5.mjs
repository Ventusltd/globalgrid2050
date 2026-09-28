// R5 site tile, the pure part: lattice maths, the two EA WCS source cards, the GeoTIFF decoder, the coverage test
// and the receipt hash. No DOM, no network. Used by mod/lidar-stream.js in the browser and by tests/lidar-stream.cjs.
//
// decodeGeoTiff is copied from the lidar-wire repo, web/world/wcs-terrain.mjs at commit 4da605f (26 Sept 2026),
// which reads exactly what the EA WCS sends (classic TIFF, one 32-bit float band, uncompressed or deflate).

export const TILE_M = 2048; // R5 rule 1: fixed 2,048 m tiles on a 2,048 m lattice of EPSG:27700
export const GAP_MS = 40000, DAY_CAP = 16, PAUSE_MS = 300000, PAUSE_MAX_MS = 3600000; // R5 rule 3
export const LICENCE = 'Contains Environment Agency information © Environment Agency and database right. Open Government Licence v3.0.';

// Source cards. Envelopes are from the services' own GetCapabilities (EPSG:27700). The DSM URL and coverage id
// were read from the data.gov.uk catalogue and the service's GetCapabilities on 27 Sept 2026 (the earlier guess
// .../lidar-composite-first-return-digital-surface-model-fz-dsm-1m/wcs answered 404).
export const SOURCES = Object.freeze({
  dtm: Object.freeze({
    product: 'LIDAR Composite DTM 1 m', release: 'composite (release not stated by the service)',
    url: 'https://environment.data.gov.uk/spatialdata/lidar-composite-digital-terrain-model-dtm-1m/wcs',
    coverage: '13787b9a-26a4-4775-8523-806d13af58fc__Lidar_Composite_Elevation_DTM_1m',
    env: Object.freeze({ e0: 80000, n0: 4000, e1: 656000, n1: 665000 })
  }),
  dsm: Object.freeze({
    product: 'LIDAR Composite First Return DSM 1 m', release: 'composite (release not stated by the service)',
    url: 'https://environment.data.gov.uk/spatialdata/lidar-composite-digital-surface-model-first-return-dsm-1m/wcs',
    coverage: 'df4e3ec3-315e-48aa-aaaf-b5ae74d7b2bb__Lidar_Composite_Elevation_FZ_DSM_1m',
    env: Object.freeze({ e0: 133000, n0: 11000, e1: 656000, n1: 657601 })
  })
});

// The lattice tile holding (e, n): south-west corner on the 2,048 m lattice. Cell k: SW corner e0 + k, centre e0 + k + 0.5.
export function tileOf(e, n) {
  const e0 = Math.floor(e / TILE_M) * TILE_M, n0 = Math.floor(n / TILE_M) * TILE_M;
  return { key: `${e0}_${n0}`, e0, n0, e1: e0 + TILE_M, n1: n0 + TILE_M };
}
// The tile clipped to a service envelope (whole metres), or null when nothing is left.
export function clip(t, env) {
  const e0 = Math.max(t.e0, Math.ceil(env.e0)), n0 = Math.max(t.n0, Math.ceil(env.n0));
  const e1 = Math.min(t.e1, Math.floor(env.e1)), n1 = Math.min(t.n1, Math.floor(env.n1));
  return e1 > e0 && n1 > n0 ? { e0, n0, e1, n1 } : null;
}
export function wcsUrl(src, b) {
  return `${src.url}?service=WCS&version=2.0.1&request=GetCoverage&CoverageId=${src.coverage}` +
    `&subset=E(${b.e0},${b.e1})&subset=N(${b.n0},${b.n1})&format=image/tiff`;
}

// Measured-cell test (R5 rule 10): nodata, non-finite and absurd values are not ground. Without a nodata tag, a run
// of ZERO_RUN or more exact zeros along a row (sea, not flown, a border) is not ground either; a whole box of
// zeros therefore has no measured ground at all. Never 0 m.
export const ZERO_RUN = 16;
export function measuredMask(geo) {
  const { data, width: w, height: h } = geo, m = new Uint8Array(w * h);
  const bad = v => !Number.isFinite(v) || (geo.hasNodata && v === geo.nodata) || v < -1e30 || v > 1e5;
  for (let r = 0; r < h; r++) {
    let run = 0;
    for (let c = 0; c <= w; c++) {
      const v = c < w ? data[r * w + c] : NaN;
      if (c < w && v === 0 && !geo.hasNodata) { run++; continue; }
      if (run) { const keep = run < ZERO_RUN ? 1 : 0; for (let k = c - run; k < c; k++) m[r * w + k] = keep; run = 0; }
      if (c < w) m[r * w + c] = bad(v) ? 0 : 1;
    }
  }
  let valid = 0; for (const x of m) valid += x;
  return { mask: m, valid, frac: valid / (w * h) };
}

// Receipt hash (R5 rule 4): sha256 of the decoded cell values (Float32, little-endian, rows north to south),
// not of the file bytes. subtle: a SubtleCrypto (browser crypto.subtle, or node's webcrypto.subtle).
export async function cellSha256(data, subtle) {
  const u = new Uint8Array(data.length * 4), dv = new DataView(u.buffer);
  for (let i = 0; i < data.length; i++) dv.setFloat32(i * 4, data[i], true);
  const d = await subtle.digest('SHA-256', u);
  return [...new Uint8Array(d)].map(x => x.toString(16).padStart(2, '0')).join('');
}

// Polite pace (R5 rule 3), shared by both products: one at a time, GAP_MS apart, DAY_CAP a day, a doubling
// pause on refusal, and a stop that needs a person after a refusal at the longest pause.
export function createPacer({ clock = () => Date.now(), used = 0 } = {}) {
  const s = { inFlight: false, next: 0, pausedUntil: 0, pause: PAUSE_MS, stopped: false, used };
  return {
    state: s,
    why(now = clock()) {
      if (s.stopped) return 'stopped after repeated refusals; a person must restart it';
      if (s.used >= DAY_CAP) return `daily cap of ${DAY_CAP} requests reached`;
      if (s.inFlight) return 'another request is in flight';
      if (now < s.pausedUntil) return `paused ${Math.ceil((s.pausedUntil - now) / 60000)} min after a refusal`;
      if (now < s.next) return `waiting ${Math.ceil((s.next - now) / 1000)} s (40 s gap)`;
      return '';
    },
    take() { const now = clock(); if (this.why(now)) return false; s.inFlight = true; s.used++; return true; },
    done(status) {
      const now = clock(); s.inFlight = false; s.next = now + GAP_MS;
      if (status === 403 || status === 429) {
        if (s.pause > PAUSE_MAX_MS) s.stopped = true;
        s.pausedUntil = now + Math.min(s.pause, PAUSE_MAX_MS); s.pause *= 2;
      } else if (status >= 200 && status < 300) s.pause = PAUSE_MS;
    }
  };
}

// ---- GeoTIFF (copied, see header) ----------------------------------------------------------------
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
// bytes -> { width, height, data: Float32Array rows north to south, nodata, hasNodata, west, north, res }.
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

// A synthetic GeoTIFF in the EA's form (big-endian, one strip, float32, ModelPixelScale + ModelTiepoint, and
// GDAL_NODATA unless nodata is null), for tests only. fn(i, j): height of cell column i, row j (row 0 = north edge).
export function synthTiff(west, north, w, h, fn, nodata = '-3.4028234663852886E38') {
  const nd = nodata == null ? null : nodata + '\0';
  const tags = [[256, 4, [w]], [257, 4, [h]], [258, 3, [32]], [259, 3, [1]], [262, 3, [1]], [273, 4, [0]], [277, 3, [1]],
    [278, 4, [h]], [279, 4, [w * h * 4]], [339, 3, [3]], [33550, 12, [1, 1, 0]], [33922, 12, [0, 0, 0, west, north, 0]]];
  if (nd) tags.push([42113, 2, [...nd].map(c => c.charCodeAt(0))]);
  const sz = { 2: 1, 3: 2, 4: 4, 12: 8 }, ifdAt = 8, ifdLen = 2 + tags.length * 12 + 4;
  let extra = ifdAt + ifdLen;
  const ext = tags.map(([, t, v]) => { const n = sz[t] * v.length; if (n <= 4) return -1; const a = extra; extra += n; return a; });
  const pix = extra, buf = new ArrayBuffer(pix + w * h * 4), dv = new DataView(buf);
  dv.setUint8(0, 0x4d); dv.setUint8(1, 0x4d); dv.setUint16(2, 42); dv.setUint32(4, ifdAt); dv.setUint16(ifdAt, tags.length);
  tags.forEach(([tag, t, v], k) => {
    const p = ifdAt + 2 + k * 12, vals = tag === 273 ? [pix] : v;
    dv.setUint16(p, tag); dv.setUint16(p + 2, t); dv.setUint32(p + 4, vals.length);
    let at = ext[k] < 0 ? p + 8 : ext[k];
    if (ext[k] >= 0) dv.setUint32(p + 8, at);
    for (const x of vals) { if (t === 2) dv.setUint8(at, x); else if (t === 3) dv.setUint16(at, x); else if (t === 4) dv.setUint32(at, x); else dv.setFloat64(at, x); at += sz[t]; }
  });
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) dv.setFloat32(pix + (j * w + i) * 4, fn(i, j));
  return new Uint8Array(buf);
}
