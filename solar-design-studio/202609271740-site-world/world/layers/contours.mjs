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
// Said wherever the layer's status is shown: what the lines are drawn from, and how far they may sit
// from the true level in plan (the index's dp_tol_basis: traced chords plus simplification, 0.553 m measured), then
// the Environment Agency's credit (the index's attribution when it carries one).
export const CAVEAT = 'computed from the EA LIDAR terrain; up to about 0.55 m from the true contour between vertices; ' +
  'heights in metres above Ordnance Datum Newlyn';
export const EA_CREDIT = '© Environment Agency copyright and/or database right 2022. All rights reserved.';
export const statusLine = (tiles, credit = EA_CREDIT) => `index: ${tiles} contour tiles; ${CAVEAT}. ${credit || EA_CREDIT}`;

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
const ivKey = iv => iv.toFixed(1);   // the index writes by_interval keys as "0.5", "1.0", "5.0"

// The layer: tiles come through the shared loader (api.lib.tiles), which the substrate hash-checks.
export const LIB_VERSION = 1;

export function createContours() {
  let api = null, tl = null, enabled = false, interval = DEFAULT_INTERVAL, labelsOn = false, credit = EA_CREDIT;
  const ready = () => statusLine(tl.index.length, credit);

  const layer = {
    id: 'contours',
    status: 'off',
    init(a) {
      if (!a.lib?.tiles) { layer.status = 'refused: api.lib.tiles not provided'; return; }
      api = a;
      tl = a.lib.tiles.createTileLoader(a, {
        file: 'contour-tiles.json', path: INDEX_PATH, sha: () => INDEX_SHA256, tileNoun: 'contour tile', json: true,
        decode: decodeContourTile, size: t => t.size, radius: LOAD_RADIUS, maxInFlight: MAX_IN_FLIGHT, maxTiles: MAX_TILES,
        active: () => enabled, keep: t => (t.by_interval?.[ivKey(interval)]?.lines ?? 1) > 0,
        say: t => { layer.status = t; }, onReady: () => { layer.status = ready(); },
        onIndex: j => { if (typeof j?.attribution === 'string' && /Environment Agency/.test(j.attribution)) credit = j.attribution; },
        onMove: () => { for (const t of tl.loaded.values()) t.labels = null; }
      });
      if (INTERVALS.includes(a.config?.interval)) interval = a.config.interval;
      if (a.config?.labels) labelsOn = true;
      if (a.config?.enabled) layer.setEnabled(true);
    },
    setEnabled(on) {
      enabled = !!on;
      layer.status = enabled ? (tl?.state === 'ready' ? ready() : 'on') : 'off';
      if (enabled) tl?.load();
      api?.invalidate({ ground: false });
      return enabled;
    },
    setInterval(m) {
      if (!INTERVALS.includes(m)) throw Error(`contour interval must be one of ${INTERVALS.join(', ')} m`);
      interval = m;
      tl?.pump();
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
      tl.frame(ctx.pos);
      const gv = ctx.groundVersion || 0, out = [], version = `${interval}@${gv}`;
      for (const [key, t] of tl.near(ctx.pos)) {
        if (!t.cache || t.cache.version !== version || t.cache.heightAt !== ctx.heightAt) {
          const cx = t.x0 + t.size / 2, cy = t.y0 + t.size / 2, o = [cx, cy, drape(ctx.heightAt, cx, cy, 0)];
          const s = segments(t.tile, t.x0, t.y0, interval, ctx.heightAt, { origin: o });
          t.cache = { version, heightAt: ctx.heightAt, batches: ['minor', 'index'].filter(k => s[k].length).map(k => ({
            key: `contours/${key}/${k}`, version, origin: o, color: COLORS[k], positions: s[k] })) };
        }
        tl.touch(t);
        out.push(...t.cache.batches);
      }
      return out;
    },
    // Optional height labels on index contours, nearest tiles first: [{ pos, text, z, angle }]. Empty
    // unless setLabels(true); the renderer needs a text overlay to show them.
    labels(ctx) {
      if (!api || !enabled || !labelsOn) return [];
      const out = [], gv = ctx.groundVersion || 0;
      for (const [, t] of tl.near(ctx.pos)) {
        if (!t.labels || t.labels.gv !== gv || t.labels.heightAt !== ctx.heightAt) {
          t.labels = { gv, heightAt: ctx.heightAt, list: labelsFor(t.tile, t.x0, t.y0, ctx.heightAt) };
        }
        out.push(...t.labels.list);
      }
      const d = l => Math.hypot(l.pos[0] - ctx.pos[0], l.pos[1] - ctx.pos[1]);
      return out.sort((a, b) => d(a) - d(b)).slice(0, MAX_LABELS);
    },
    // For tests and the console.
    debug: () => ({ ...tl?.debug(), enabled, interval, labelsOn, ...tl?.stats })
  };
  return layer;
}

export default createContours();
