// Layer: contours. Contour lines draped 5 cm above the ground at a chosen interval (0.5, 1 or 5 m; default
// 1 m), with every 5 m line (an index contour) drawn slightly brighter. Optional height labels on index
// contours. Off by default: until setEnabled(true) (or api.config.enabled) it fetches nothing and draws
// nothing. Lines come from ggc1 tiles written by the lidar pipeline (lidar/src/contour_tiles.py: every
// 0.5 m level traced twice on the GPU, marching squares against row and column crossings, with a CPU
// witness; Douglas-Peucker simplified at 0.25 m). Every file is fetched through the substrate's hash check
// (api.fetchJSON with the sha256 from the index). Heights for draping come from ctx.heightAt, the ground.
//
// Tile (ggc1 JSON): { format: 'ggc1', e0, n0, tile_m: 256, unit_m: 0.01, dp_tol_m,
//   levels: [{ z: metres, lines: [[x0, y0, x1, y1, ...], ...] }] }  x, y whole centimetres from the tile's
//   south-west corner (British National Grid metres = e0 + x * unit_m). Heights: metres above ODN.

const INDEX_PATH = 'contours/contour-tiles.json';
// Filled by the build tool with the SHA-256 of contour-tiles.json. Until then the layer loads nothing.
let INDEX_SHA256 = '__CONTOUR_TILES_SHA256__';
// Said wherever the layer's status is shown (tester 3): what the lines are drawn from, and how far they may sit
// from the true level in plan after simplification.
export const CAVEAT = 'from the bare-earth EA LIDAR DTM 1 m, heights in metres above Ordnance Datum Newlyn; simplified, ' +
  'so a line may sit up to about 0.6 m off the true contour in plan';

export function setIndexSha(sha) { INDEX_SHA256 = sha; }

export const INTERVALS = [0.5, 1, 5], DEFAULT_INTERVAL = 1, INDEX_EVERY = 5;
export const LIFT_M = 0.05, STEP_M = 2;                      // 5 cm above ground; re-drape at least every 2 m
export const LOAD_RADIUS = 300, MAX_IN_FLIGHT = 2, MAX_TILES = 16;
export const LABEL_MIN_M = 40, MAX_LABELS = 48;
// Quiet on a dark background: minor lines a pale sage, index lines a little brighter and firmer.
export const COLORS = { minor: [0.62, 0.68, 0.60, 0.30], index: [0.80, 0.84, 0.74, 0.52] };

const multiple = (z, step) => Math.abs(z / step - Math.round(z / step)) < 1e-9;
export const isIndex = z => multiple(z, INDEX_EVERY);
export const onInterval = (z, iv) => multiple(z, iv);

// Pure: checks a parsed ggc1 tile and returns it with numbers in metres ready to use.
export function decodeContourTile(doc) {
  if (!doc || doc.format !== 'ggc1') throw Error(`contour tile format "${doc && doc.format}" is not ggc1`);
  if (!Number.isFinite(doc.e0) || !Number.isFinite(doc.n0)) throw Error('contour tile has no south-west corner');
  const unit = doc.unit_m ?? 0.01;
  if (!(unit > 0)) throw Error('contour tile has no unit');
  if (!Array.isArray(doc.levels)) throw Error('contour tile has no levels list');
  for (const lv of doc.levels) {
    if (!Number.isFinite(lv.z) || !Array.isArray(lv.lines)) throw Error('contour level without z or lines');
    for (const l of lv.lines) if (!Array.isArray(l) || l.length % 2 || l.length < 4) throw Error(`contour line at ${lv.z} m is not a list of x, y pairs`);
  }
  return { e0: doc.e0, n0: doc.n0, unit, size: doc.tile_m || 256, tol: doc.dp_tol_m, levels: doc.levels };
}

// Pure: line segments for one tile at one interval, as { minor, index } Float32Arrays of segment pairs.
// x0, y0: the tile's south-west corner in local metres. Each stored segment is split so no drawn piece is
// longer than `step`, and every vertex is draped at heightAt + lift. Positions are relative to origin.
export function segments(t, x0, y0, interval, heightAt, { lift = LIFT_M, step = STEP_M, origin = [0, 0, 0] } = {}) {
  const out = { minor: [], index: [] }, u = t.unit;
  for (const lv of t.levels) {
    if (!onInterval(lv.z, interval)) continue;
    const dst = isIndex(lv.z) ? out.index : out.minor;
    for (const l of lv.lines) {
      let px = x0 + l[0] * u, py = y0 + l[1] * u, pz = drape(heightAt, px, py, lift);
      for (let k = 2; k < l.length; k += 2) {
        const qx = x0 + l[k] * u, qy = y0 + l[k + 1] * u, n = Math.max(1, Math.ceil(Math.hypot(qx - px, qy - py) / step));
        let ax = px, ay = py, az = pz;
        for (let s = 1; s <= n; s++) {
          const x = s === n ? qx : px + (qx - px) * s / n, y = s === n ? qy : py + (qy - py) * s / n, z = drape(heightAt, x, y, lift);
          dst.push(ax - origin[0], ay - origin[1], az - origin[2], x - origin[0], y - origin[1], z - origin[2]);
          ax = x; ay = y; az = z;
        }
        px = qx; py = qy; pz = az;
      }
    }
  }
  return { minor: new Float32Array(out.minor), index: new Float32Array(out.index) };
}

// Pure: one label per index contour line at least LABEL_MIN_M long, at the vertex nearest its middle,
// turned along the line. Local metres (not origin-relative); the host's text overlay draws them.
export function labelsFor(t, x0, y0, heightAt, { lift = LIFT_M, minLen = LABEL_MIN_M } = {}) {
  const out = [], u = t.unit;
  for (const lv of t.levels) {
    if (!isIndex(lv.z)) continue;
    for (const l of lv.lines) {
      const cum = [0];
      for (let k = 2; k < l.length; k += 2) cum.push(cum[cum.length - 1] + Math.hypot(l[k] - l[k - 2], l[k + 1] - l[k - 1]) * u);
      const len = cum[cum.length - 1];
      if (len < minLen) continue;
      let m = 0;
      for (let i = 1; i < cum.length; i++) if (Math.abs(cum[i] - len / 2) < Math.abs(cum[m] - len / 2)) m = i;
      const j = Math.min(m + 1, cum.length - 1), i = j - 1;
      const x = x0 + l[2 * m] * u, y = y0 + l[2 * m + 1] * u;
      out.push({ pos: [x, y, drape(heightAt, x, y, lift)], text: `${fmt(lv.z)} m`, z: lv.z,
        angle: Math.atan2(l[2 * j + 1] - l[2 * i + 1], l[2 * j] - l[2 * i]) });
    }
  }
  return out;
}

const fmt = z => (Number.isInteger(z) ? String(z) : z.toFixed(1));
const drape = (h, x, y, lift) => { const v = h(x, y); return (Number.isFinite(v) ? v : 0) + lift; };
const rectDist = (x, y, x0, y0, x1, y1) => Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(y0 - y, 0, y - y1));
const ivKey = iv => iv.toFixed(1);   // the index writes by_interval keys as "0.5", "1.0", "5.0"

export function createContours() {
  let api = null, origin = { e: 0, n: 0 }, enabled = false, interval = DEFAULT_INTERVAL, labelsOn = false;
  let index = null, indexState = 'idle'; // idle | loading | ready | failed
  const loaded = new Map();   // key -> { tile, x0, y0, size, used, cache, labels }
  const inFlight = new Set(), failed = new Set();
  let clock = 0, lastPos = null;
  const stats = { requested: [], evicted: [] };

  // The site origin is set after init and moves as the viewer walks: tiles are placed from it when it changes.
  function follow() {
    const o = typeof api?.origin === 'function' ? api.origin() : null;
    if (!o || (o.e === origin.e && o.n === origin.n)) return;
    origin = { e: o.e, n: o.n };
    for (const t of index || []) { t.x0 = t.e0 - origin.e; t.y0 = t.n0 - origin.n; }
    for (const t of loaded.values()) { t.x0 = t.tile.e0 - origin.e; t.y0 = t.tile.n0 - origin.n; t.cache = null; t.labels = null; }
  }

  function loadIndex() {
    if (indexState !== 'idle' || !api || !enabled) return;
    follow();
    const sha = api.config?.sha256 || INDEX_SHA256;
    const path = api.config?.index || INDEX_PATH;
    if (!sha || sha.startsWith('__')) { indexState = 'failed'; layer.status = 'no contour-tiles.json hash configured'; return; }
    indexState = 'loading';
    Promise.resolve().then(() => api.fetchJSON(path, sha)).then(j => {
      if (!j || !Array.isArray(j.tiles)) throw Error('contour-tiles.json has no tiles list');
      const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '';
      index = j.tiles.map(t => ({ ...t, path: dir + t.file, x0: t.e0 - origin.e, y0: t.n0 - origin.n, size: j.tile_m || 256 }));
      indexState = 'ready';
      layer.status = `index: ${index.length} contour tiles; ${CAVEAT}`;
      pump();
      api.invalidate({ ground: false });
    }).catch(e => { indexState = 'failed'; layer.status = 'contour-tiles.json failed: ' + e.message; });
  }

  // Tiles within LOAD_RADIUS of (x, y) with any line at the current interval, nearest first.
  function wanted(x, y) {
    if (!index) return [];
    return index
      .filter(t => (t.by_interval?.[ivKey(interval)]?.lines ?? 1) > 0)
      .map(t => ({ t, d: rectDist(x, y, t.x0, t.y0, t.x0 + t.size, t.y0 + t.size) }))
      .filter(o => o.d <= LOAD_RADIUS)
      .sort((a, b) => a.d - b.d)
      .map(o => o.t);
  }

  function request(entry) {
    inFlight.add(entry.key);
    stats.requested.push(entry.key);
    Promise.resolve().then(() => api.fetchJSON(entry.path, entry.sha256)).then(doc => {
      const tile = decodeContourTile(doc);
      loaded.set(entry.key, { tile, x0: tile.e0 - origin.e, y0: tile.n0 - origin.n, size: tile.size, used: ++clock, cache: null, labels: null });
      evict();
      api.invalidate({ ground: false });
    }).catch(e => { failed.add(entry.key); layer.status = `contour tile ${entry.key} failed: ${e.message}`; })
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

  function near(ctx) {
    return [...loaded].filter(([, t]) => rectDist(ctx.pos[0], ctx.pos[1], t.x0, t.y0, t.x0 + t.size, t.y0 + t.size) <= LOAD_RADIUS);
  }

  const layer = {
    id: 'contours',
    status: 'off',
    init(a) {
      api = a;
      const o = typeof a.origin === 'function' ? a.origin() : null;
      if (o) origin = { e: o.e, n: o.n };
      if (INTERVALS.includes(a.config?.interval)) interval = a.config.interval;
      if (a.config?.labels) labelsOn = true;
      if (a.config?.enabled) layer.setEnabled(true);
    },
    setEnabled(on) {
      enabled = !!on;
      layer.status = enabled ? (indexState === 'ready' ? `index: ${index.length} contour tiles; ${CAVEAT}` : 'on') : 'off';
      if (enabled) loadIndex();
      api?.invalidate({ ground: false });
      return enabled;
    },
    setInterval(m) {
      if (!INTERVALS.includes(m)) throw Error(`contour interval must be one of ${INTERVALS.join(', ')} m`);
      interval = m;
      pump();
      api?.invalidate({ ground: false });
      return interval;
    },
    setLabels(on) { labelsOn = !!on; api?.invalidate({ ground: false }); return labelsOn; },
    get enabled() { return enabled; },
    get interval() { return interval; },
    get labelsOn() { return labelsOn; },
    // ctx: { pos, heightAt, groundVersion }
    lines(ctx) {
      if (!api || !enabled) return [];
      follow();
      lastPos = ctx.pos;
      if (indexState === 'idle') loadIndex();
      pump();
      const gv = ctx.groundVersion || 0, out = [], version = `${interval}@${gv}`;
      for (const [key, t] of near(ctx)) {
        if (!t.cache || t.cache.version !== version || t.cache.heightAt !== ctx.heightAt) {
          const cx = t.x0 + t.size / 2, cy = t.y0 + t.size / 2, o = [cx, cy, drape(ctx.heightAt, cx, cy, 0)];
          const s = segments(t.tile, t.x0, t.y0, interval, ctx.heightAt, { origin: o });
          t.cache = { version, heightAt: ctx.heightAt, batches: ['minor', 'index'].filter(k => s[k].length).map(k => ({
            key: `contours/${key}/${k}`, version, origin: o, color: COLORS[k], positions: s[k] })) };
        }
        t.used = ++clock;
        out.push(...t.cache.batches);
      }
      return out;
    },
    // Optional height labels on index contours, nearest tiles first: [{ pos, text, z, angle }]. Empty
    // unless setLabels(true); the renderer needs a text overlay to show them.
    labels(ctx) {
      if (!api || !enabled || !labelsOn) return [];
      const out = [], gv = ctx.groundVersion || 0;
      for (const [, t] of near(ctx)) {
        if (!t.labels || t.labels.gv !== gv || t.labels.heightAt !== ctx.heightAt) {
          t.labels = { gv, heightAt: ctx.heightAt, list: labelsFor(t.tile, t.x0, t.y0, ctx.heightAt) };
        }
        out.push(...t.labels.list);
      }
      const d = l => Math.hypot(l.pos[0] - ctx.pos[0], l.pos[1] - ctx.pos[1]);
      return out.sort((a, b) => d(a) - d(b)).slice(0, MAX_LABELS);
    },
    // For tests and the console.
    debug: () => ({ loaded: [...loaded.keys()], inFlight: [...inFlight], failed: [...failed], indexState, enabled, interval, labelsOn, ...stats })
  };
  return layer;
}

export default createContours();
