// Layer: imagery. A satellite picture of the site laid on the ground, under every other line, in the Map
// and Drone views only (never Walk). Off by default: until setEnabled(true) it fetches and draws nothing.
//
// Frames, in date order, chosen with a slider:
//   season   cloud-free composite of one meteorological season (median of the clear looks, GPU-checked)
//   date     one clear Sentinel-2 date (measured box cloud <= 1 %), the best one a month, for a time lapse
// Frames come from the site's imagery/index.json, written by the lidar pipeline and staged by
// tools/stage-imagery.mjs. Each image is fetched through the substrate's hash check. Open data only
// (Copernicus Sentinel); no keyed or licensed basemap is used (docs/imagery-licences.md).
//
// The world draws lines only, so the picture is drawn as lines too: every pixel row becomes east-west runs
// of one colour, a short lift above the ground, so the design and the grid lines are drawn over it. The
// colours are reduced to a palette of PALETTE colours fitted to each picture (k-means, seeded by luminance rank,
// no randomness), so the whole picture is at most PALETTE batches and keeps its true colours.
// Self-contained: no imports (the loader runs it from a blob URL).

export const LIFT_M = 0.03, ALPHA = 0.8, PALETTE = 48, RUN_MAX_PX = 4, ROWS_PER_PX = 4, FADE_M = 6000;
export const SHOWN_IN = Object.freeze(['aerial', 'map']);          // Drone and Map, never Walk ('standing')
export const CREDIT = 'Contains modified Copernicus Sentinel data';
const SEASON_WORD = { winter: 'Winter', spring: 'Spring', summer: 'Summer', autumn: 'Autumn' };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Pure: the frames of an imagery index, oldest first.
export function framesOf(index) {
  const out = [];
  for (const c of index?.composites || []) {
    if (!c.file || !/^[0-9a-f]{64}$/i.test(c.sha256 || '')) continue;
    const [s, y] = String(c.season).split('-');
    out.push({ id: 'season:' + c.season, kind: 'season', key: c.start, file: c.file, sha256: c.sha256,
      label: `${SEASON_WORD[s] || s} ${y} composite · ${c.looks} clear looks` });
  }
  for (const d of index?.dates || []) {
    if (!d.file || !/^[0-9a-f]{64}$/i.test(d.sha256 || '')) continue;
    const [y, m, dd] = d.date.split('-');
    out.push({ id: 'date:' + d.date, kind: 'date', key: d.date, file: d.file, sha256: d.sha256,
      label: `${Number(dd)} ${MONTHS[Number(m) - 1]} ${y} · cloud ${(100 * (d.box_cloud || 0)).toFixed(1)} %` });
  }
  out.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.kind === 'season' ? -1 : 1));
  return out;
}

// Pure: the credit line a frame needs on screen.
export function creditFor(frame, index) {
  if (!frame) return '';
  const c = index?.licence?.credit;
  return typeof c === 'string' && c.startsWith(CREDIT) ? c : CREDIT;
}

// Pure: the slider's state for frame i.
export function sliderModel(frames, i, index) {
  const n = frames.length, v = n ? Math.max(0, Math.min(n - 1, i | 0)) : 0;
  return { min: 0, max: Math.max(0, n - 1), value: v, label: n ? frames[v].label : 'No imagery for this site', credit: creditFor(frames[v], index) };
}

// Pure: palette index of an sRGB colour (0..255 each).
// Pure: a palette of up to k colours fitted to the opaque pixels (Lloyd's k-means, 8 rounds, on at most
// about 8000 evenly spaced pixels; seeds at evenly spaced luminance ranks). Returns [[r, g, b], ...] 0..255.
export function paletteOf(img, k = PALETTE) {
  const d = img.data, n = img.width * img.height, opaque = [];
  for (let p = 0; p < n; p++) if (d[4 * p + 3] >= 128) opaque.push(p);
  if (!opaque.length) return [];
  const step = Math.max(1, Math.floor(opaque.length / 8000)), S = opaque.filter((_, i) => i % step === 0);
  const lum = p => 0.299 * d[4 * p] + 0.587 * d[4 * p + 1] + 0.114 * d[4 * p + 2];
  S.sort((a, b) => lum(a) - lum(b) || a - b);
  const m = Math.min(k, S.length);
  let C = Array.from({ length: m }, (_, i) => { const p = S[Math.floor((i + 0.5) * S.length / m)]; return [d[4 * p], d[4 * p + 1], d[4 * p + 2]]; });
  for (let round = 0; round < 8; round++) {
    const sum = C.map(() => [0, 0, 0, 0]);
    for (const p of S) { const c = nearest(C, d[4 * p], d[4 * p + 1], d[4 * p + 2]), t = sum[c]; t[0] += d[4 * p]; t[1] += d[4 * p + 1]; t[2] += d[4 * p + 2]; t[3]++; }
    C = C.map((c, i) => (sum[i][3] ? [sum[i][0] / sum[i][3], sum[i][1] / sum[i][3], sum[i][2] / sum[i][3]] : c));
  }
  return C;
}
export function nearest(C, r, g, b) {
  let best = 0, bd = Infinity;
  for (let i = 0; i < C.length; i++) { const q = C[i], e = (q[0] - r) ** 2 + (q[1] - g) ** 2 + (q[2] - b) ** 2; if (e < bd) { bd = e; best = i; } }
  return best;
}
// Pure: palette index per pixel, -1 where the pixel is clear (alpha < 128).
export function indexPixels(img, C) {
  const d = img.data, n = img.width * img.height, out = new Int16Array(n);
  for (let p = 0; p < n; p++) out[p] = d[4 * p + 3] < 128 || !C.length ? -1 : nearest(C, d[4 * p], d[4 * p + 1], d[4 * p + 2]);
  return out;
}

// Pure: heights at the pixel corners of a w x h picture over the square box ((w + 1) x (h + 1), row 0 north).
// box: { x0, y0, size } local metres, south-west corner; row 0 of the picture is the north edge.
// known(x, y), if given, says where ground is measured; elsewhere the corner is NaN and nothing is drawn on it
// (v05: no picture laid on the flat last-known height past the loaded terrain).
const finite = v => (Number.isFinite(v) ? v : 0);
export function heightGrid(w, h, box, heightAt, known = null) {
  const px = box.size / w, py = box.size / h, H = new Float32Array((w + 1) * (h + 1));
  for (let j = 0; j <= h; j++) {
    const y = box.y0 + box.size - j * py;
    for (let i = 0; i <= w; i++) {
      const x = box.x0 + i * px, z = known && !known(x, y) ? NaN : heightAt(x, y);
      H[j * (w + 1) + i] = Number.isFinite(z) ? z : known ? NaN : 0;
    }
  }
  return H;
}

// Pure: the drape. px: { width, height, idx } (indexPixels). Returns { [palette index]: Float32Array of x,y,z pairs }
// relative to origin. Runs of one colour are merged up to RUN_MAX_PX pixels so the lines follow the ground;
// each pixel row is drawn as `rows` lines (heights interpolated between its corners) so the picture reads solid.
// A pixel with an unmeasured (NaN) corner is left out, and no run crosses one.
export function drapeImage(img, box, H, { lift = LIFT_M, origin = [0, 0, 0], rows = ROWS_PER_PX } = {}) {
  const w = img.width, h = img.height, px = box.size / w, py = box.size / h, out = {}, q = img.idx, W = w + 1;
  for (let j = 0; j < h; j++) {
    const ok = k => Number.isFinite(H[j * W + k]) && Number.isFinite(H[(j + 1) * W + k]);
    let i = 0;
    while (i < w) {
      const pal = q[j * w + i];
      if (pal < 0 || !ok(i)) { i++; continue; }
      let e = i + 1;
      while (e < w && e - i < RUN_MAX_PX && q[j * w + e] === pal && ok(e)) e++;
      if (!ok(e)) { if (e - 1 > i) e--; else { i = e; continue; } }
      const o = (out[pal] ||= []), xa = box.x0 + i * px - origin[0], xb = box.x0 + e * px - origin[0];
      for (let r = 0; r < rows; r++) {
        const t = (r + 0.5) / rows, y = box.y0 + box.size - (j + t) * py - origin[1];
        const za = H[j * W + i] * (1 - t) + H[(j + 1) * W + i] * t, zb = H[j * W + e] * (1 - t) + H[(j + 1) * W + e] * t;
        o.push(xa, y, za + lift - origin[2], xb, y, zb + lift - origin[2]);
      }
      i = e;
    }
  }
  for (const k in out) out[k] = new Float32Array(out[k]);
  return out;
}

async function browserDecode(bytes) {
  const bmp = await createImageBitmap(new Blob([bytes]));
  const c = new OffscreenCanvas(bmp.width, bmp.height), g = c.getContext('2d');
  g.drawImage(bmp, 0, 0);
  const im = g.getImageData(0, 0, bmp.width, bmp.height);
  bmp.close?.();
  return { width: im.width, height: im.height, data: im.data };
}

export function createImagery({ decode = browserDecode, doc = globalThis.document } = {}) {
  let api = null, enabled = false, index = null, indexState = 'idle', frames = [], pick = 0, view = null;
  const images = new Map();   // frame id -> { width, height, data }
  const pending = new Set();
  let heights = null, cache = null, ui = null;

  const origin = () => (api?.origin ? api.origin() : { e: 0, n: 0, id: 0 });
  const box = () => { const o = origin(), b = index.box; return { x0: b.origin_e - o.e, y0: b.origin_n - o.n, size: b.size_m }; };

  function loadIndex() {
    if (indexState !== 'idle' || !api || !enabled) return;
    const path = api.config?.index, sha = api.config?.sha256;
    if (!path || !/^[0-9a-f]{64}$/i.test(sha || '')) { indexState = 'failed'; layer.status = 'no imagery staged for this site'; sync(); return; }
    indexState = 'loading';
    Promise.resolve().then(() => api.fetchJSON(path, sha)).then(j => {
      if (!j?.box || !Number.isFinite(j.box.size_m)) throw Error('imagery index has no box');
      index = { ...j, dir: path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '' };
      frames = framesOf(index);
      pick = Math.max(0, frames.findLastIndex(f => f.kind === 'season'));
      indexState = 'ready';
      layer.status = `${frames.length} frames`;
      sync(); request();
    }).catch(e => { indexState = 'failed'; layer.status = 'imagery index failed: ' + e.message; sync(); });
  }

  function request() {
    const f = frames[pick];
    if (!f || images.has(f.id) || pending.has(f.id) || !enabled) return;
    pending.add(f.id);
    Promise.resolve().then(() => api.fetchVerified(index.dir + f.file, f.sha256)).then(b => decode(b)).then(img => { images.set(f.id, img); api.invalidate({ ground: false }); })
      .catch(e => { layer.status = `${f.label}: ${e.message}`; sync(); })
      .finally(() => pending.delete(f.id));
  }

  function sync() {
    if (!ui) return;
    const m = sliderModel(frames, pick, index), show = enabled && SHOWN_IN.includes(view);
    ui.root.hidden = !show;
    ui.range.min = m.min; ui.range.max = m.max; ui.range.value = m.value; ui.range.disabled = frames.length < 2;
    ui.label.textContent = indexState === 'ready' ? m.label : layer.status;
    ui.credit.textContent = m.credit;
  }

  const layer = {
    id: 'imagery',
    status: 'off',
    init(a) { api = a; if (a.config?.enabled) layer.setEnabled(true); },
    setEnabled(on) {
      enabled = !!on;
      layer.status = enabled ? (indexState === 'ready' ? `${frames.length} frames` : 'on') : 'off';
      if (enabled) { loadIndex(); request(); }
      sync();
      api?.invalidate({ ground: false });
      return enabled;
    },
    get enabled() { return enabled; },
    frames: () => frames.map(f => ({ id: f.id, kind: f.kind, label: f.label })),
    get selected() { return pick; },
    select(i) {
      if (!frames.length) return pick;
      pick = Math.max(0, Math.min(frames.length - 1, i | 0));
      request(); sync(); api?.invalidate({ ground: false });
      return pick;
    },
    // attribution.json layer keys for what is on screen now: none, or 'imagery' (Copernicus).
    creditKeys: () => (!enabled || !SHOWN_IN.includes(view) || !frames[pick] || !images.has(frames[pick].id) ? [] : ['imagery']),
    credit: () => creditFor(frames[pick], index),
    // A slider, its label and the credit, shown only while the layer is on in Map or Drone.
    mountControls(container) {
      if (!doc || !container || ui) return ui?.root || null;
      const root = doc.createElement('div'), range = doc.createElement('input'), label = doc.createElement('p'), credit = doc.createElement('p');
      root.id = 'imagery-controls'; root.hidden = true;
      root.style.cssText = 'position:fixed;left:8px;bottom:64px;width:min(300px,calc(100vw - 16px));box-sizing:border-box;padding:6px 10px;' +
        'background:var(--panel,rgba(10,10,10,0.86));border:1px solid var(--edge,#1c2c3a);border-radius:6px;color:var(--text,#cfe9ff);font-size:12px';
      range.type = 'range'; range.step = 1; range.style.width = '100%'; range.setAttribute('aria-label', 'Imagery date');
      label.style.margin = '2px 0 0'; credit.style.cssText = 'margin:2px 0 0;font-size:10px;color:var(--dim,#6f8ea6)';
      range.addEventListener('input', () => layer.select(Number(range.value)));
      root.append(range, label, credit); container.appendChild(root);
      ui = { root, range, label, credit }; sync();
      return root;
    },
    // ctx: { pos, heightAt, groundVersion, view }
    lines(ctx) {
      if (view !== ctx.view) { view = ctx.view; sync(); }
      if (!api || !enabled || !SHOWN_IN.includes(ctx.view)) return [];
      if (indexState === 'idle') loadIndex();
      const f = frames[pick], img = f && images.get(f.id);
      if (!img) { request(); return []; }
      const o = origin(), gv = ctx.groundVersion || 0, b = box();
      const hk = `${img.width}x${img.height}@${gv}/${o.id}`;
      if (!heights || heights.key !== hk || heights.heightAt !== ctx.heightAt) heights = { key: hk, heightAt: ctx.heightAt, H: heightGrid(img.width, img.height, b, ctx.heightAt,
        typeof ctx.known === 'function' ? ctx.known : null) };
      const version = `${f.id}/${hk}`;
      if (!cache || cache.version !== version) {
        const hc = heights.H[(img.height >> 1) * (img.width + 1) + (img.width >> 1)];
        const c = [b.x0 + b.size / 2, b.y0 + b.size / 2, Number.isFinite(hc) ? hc : finite(ctx.heightAt(b.x0 + b.size / 2, b.y0 + b.size / 2))];
        img.C ||= paletteOf(img); img.idx ||= indexPixels(img, img.C);
        const byPal = drapeImage(img, b, heights.H, { origin: c });
        cache = { version, batches: Object.keys(byPal).map(k => ({ key: `imagery/${k}`, version, origin: c, fade: FADE_M,
          color: [...img.C[k].map(v => v / 255), ALPHA], positions: byPal[k] })) };
      }
      return cache.batches;
    },
    debug: () => ({ indexState, enabled, view, pick, frames: frames.length, images: [...images.keys()], pending: [...pending] })
  };
  return layer;
}

export default createImagery();
