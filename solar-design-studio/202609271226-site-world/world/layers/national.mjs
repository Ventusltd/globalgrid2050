// Layer: national. Roads, mainline railways, overhead lines with their towers, and every substation in Great Britain,
// from GridAtlas's national files (OpenStreetMap, ODbL), cut into 10 km tiles by tools/features/cut_national.py;
// B and minor roads (kind osroads) from OS Open Roads (OGL), in their own files, as GridAtlas has none.
// Self-contained: no imports (it runs from a blob URL). Towers and conductors come from api.lib.overhead.
//
// Only what lies inside a circle of the chosen range around the viewer is loaded and drawn: 2, 5 or 10 miles
// (config.range_miles, then layer.setRange(miles)). Files are fetched through the substrate's hash check:
//   index.json (config.index + config.sha256) -> squares/*.json (one per 100 km) -> tiles/<kind>/*.odbl.json
// nearest first, at most MAX_IN_FLIGHT at a time, least recently used forgotten past the cache size.
//
// Drawing, by distance from the viewer:
//   roads      one centreline per carriageway, by class (motorway, trunk, primary; B and minor from osroads)
//   rail       two rails at standard gauge within TWIN_RAIL_M, one line beyond (the pair is under a pixel there)
//   power      within NEAR_LINE_M: towers, insulators and sagging conductors (api.lib.overhead.buildOverhead);
//              beyond: a plain line at the lowest typical attachment height
//   substation within NEAR_SUB_M: a fenced compound (a solid); beyond: a mast marker
// Heights: measured ground (ctx.measuredAt) where terrain tiles are loaded within MEASURE_M of the viewer, draped every
// DRAPE_STEP m within DRAPE_M; elsewhere the height of the ground under the viewer, NOT measured there (the status says
// how many points). Terrain tiles only stream in near the viewer, so asking further out would cost time for nothing.
// Batches are placed relative to an origin at the viewer (local metres), so positions stay small on the GPU.
// ASSUMED: tower positions (inferred from OpenStreetMap vertices), tower shapes, sag, compound and marker sizes.

export const MILE_M = 1609.344;
export const RANGES_MI = [2, 5, 10];
export const NEAR_LINE_M = 2000, NEAR_SUB_M = 1000, TWIN_RAIL_M = 1000, DRAPE_M = 400, DRAPE_STEP = 10, MEASURE_M = 1000;
export const BAND_M = NEAR_LINE_M; // the near band: everything whose look depends on the ground or on being close
export const MAX_IN_FLIGHT = 2, MIN_CACHE = 48, GROUND_REBUILD_MS = 3000, GROUND_SETTLE_FRAMES = 2;
// The drawing is rebuilt after the viewer moves this far: a twentieth of the range, 160-400 m.
export const rebuildStep = rangeM => Math.min(400, Math.max(160, rangeM / 20));
export const GAUGE_M = 1.435, FENCE_H = 2.4;
export const KINDS = ['roads', 'osroads', 'rail', 'power', 'substations'];

export const COLORS = {
  motorway: [0.80, 0.80, 0.80, 0.60], trunk: [0.72, 0.72, 0.72, 0.50], primary: [0.64, 0.64, 0.64, 0.42],
  B: [0.58, 0.58, 0.58, 0.36], minor: [0.50, 0.50, 0.50, 0.30],
  rail: [0.66, 0.64, 0.61, 0.50],
  '400kV': [0.55, 0.66, 1.00, 0.62], '275kV': [1.00, 0.56, 0.56, 0.55], '132kV': [1.00, 0.80, 0.48, 0.50],
  '33kV': [0.56, 0.86, 0.62, 0.45]
};
// Compound footprint east-west by north-south (m) and far marker height (m) by class. ASSUMED, not surveyed.
export const COMPOUND = { '400kV': [300, 200, 60], '275kV': [220, 150, 50], '132kV': [90, 60, 35], '33kV': [30, 20, 20] };
const PLAIN_LIFT = { '400kV': 22, '275kV': 18.5, '132kV': 14, '33kV': 8.9 }; // used when the library has no tower table

export function voltageClass(kv) {
  const v = Number(kv);
  if (!(v > 0)) return '33kV';
  return v >= 345 ? '400kV' : v >= 220 ? '275kV' : v >= 66 ? '132kV' : '33kV';
}

// Pure: the part [t0, t1] of segment a->b inside the circle (c, r), or null.
export function clipToCircle(ax, ay, bx, by, cx, cy, r) {
  const dx = bx - ax, dy = by - ay, fx = ax - cx, fy = ay - cy;
  const A = dx * dx + dy * dy, B = 2 * (fx * dx + fy * dy), C = fx * fx + fy * fy - r * r;
  if (A === 0) return C <= 0 ? [0, 1] : null;
  const disc = B * B - 4 * A * C;
  if (disc < 0) return null;
  const s = Math.sqrt(disc), lo = Math.max(0, (-B - s) / (2 * A)), hi = Math.min(1, (-B + s) / (2 * A));
  return lo < hi ? [lo, hi] : null;
}

// Distance from (x, y) to the box [e0, n0, e1, n1] (0 inside).
export const boxDist = (x, y, b) => Math.hypot(Math.max(b[0] - x, 0, x - b[2]), Math.max(b[1] - y, 0, y - b[3]));

// Pure: the files needed for a circle at national-grid (e, n), nearest first.
// squares: the top index's list. tiles: entries from loaded square files. kinds: the kinds switched on.
export function wantedFiles(squares, tiles, kinds, e, n, r) {
  const out = [];
  for (const s of squares) {
    const d = boxDist(e, n, [s.e0, s.n0, s.e0 + 100000, s.n0 + 100000]);
    if (d <= r) out.push({ id: 'sq/' + s.key, type: 'square', path: s.file, sha256: s.sha256, d, bytes: s.bytes });
  }
  for (const t of tiles) for (const k of kinds) {
    const f = t.files?.[k];
    if (!f) continue;
    const d = boxDist(e, n, f.bbox);
    if (d <= r) out.push({ id: `${k}/${t.key}`, type: 'tile', kind: k, e0: t.e0, n0: t.n0, path: f.file, sha256: f.sha256, d, bytes: f.bytes });
  }
  return out.sort((a, b) => (a.type === b.type ? a.d - b.d : a.type === 'square' ? -1 : 1));
}

// The box [x0, y0, x1, y1] of a flat point list in tile metres, worked out once per list (tiles are immutable).
const BOXES = new WeakMap();
export function boxOf(p) {
  let b = BOXES.get(p);
  if (!b) {
    b = [Infinity, Infinity, -Infinity, -Infinity];
    for (let i = 0; i < p.length; i += 2) { b[0] = Math.min(b[0], p[i]); b[1] = Math.min(b[1], p[i + 1]); b[2] = Math.max(b[2], p[i]); b[3] = Math.max(b[3], p[i + 1]); }
    BOXES.set(p, b);
  }
  return b;
}

// Pure: every batch and solid for the loaded tiles. v: { x, y, r, kinds: Set, o: { e, n }, band? } in local metres.
// band 'near' draws only inside BAND_M of (x, y) (towers, compounds, measured ground), 'far' only outside it,
// 'all' (default) both: the two bands meet exactly, so the near one can be rebuilt alone when new ground arrives.
// ground: { at(x, y) -> measured height or NaN, fallback: metres }. lib: api.lib.overhead (may be null).
// memo: a Map the caller keeps while the origin stays the same; towers and wires on unchanged ground are reused.
export function buildNational(tiles, v, ground, lib, memo = new Map()) {
  const bo = [Math.round(v.x / 100) * 100, Math.round(v.y / 100) * 100, ground.fallback], band = v.band || 'all';
  const groups = {}, solids = [], towers = [], count = { measured: 0, fallback: 0, features: 0 }, used = new Set();
  const zAt = (x, y) => {
    const h = (x - v.x) ** 2 + (y - v.y) ** 2 <= MEASURE_M * MEASURE_M ? ground.at(x, y) : NaN; // terrain streams near the viewer
    if (Number.isFinite(h)) { count.measured++; return h; }
    count.fallback++; return ground.fallback;
  };
  const out = g => (groups[g] ||= []);
  const seg = (a, ax, ay, az, bx, by, bz) => a.push(ax - bo[0], ay - bo[1], az - bo[2], bx - bo[0], by - bo[1], bz - bo[2]);
  const r2 = (x, y) => Math.hypot(x - v.x, y - v.y);
  // A line whose box lies wholly outside this band is skipped without looking at its segments.
  const reach = band === 'near' ? Math.min(BAND_M, v.r) : v.r;
  const skip = (p, tx, ty) => {
    const b = boxOf(p), cx = v.x - tx, cy = v.y - ty;
    if (boxDist(cx, cy, b) > reach) return true;
    if (band !== 'far') return false;
    const fx = Math.max(Math.abs(cx - b[0]), Math.abs(cx - b[2])), fy = Math.max(Math.abs(cy - b[1]), Math.abs(cy - b[3]));
    return Math.hypot(fx, fy) < BAND_M; // wholly inside the near band
  };

  // A straight run, clipped to the circle, shifted sideways by `side` m, draped near the viewer.
  function run(a, ax, ay, bx, by, lift, side = 0) {
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, nx = -dy / L * side, ny = dx / L * side;
    for (const c of pieces(ax, ay, bx, by)) {
      const x0 = ax + dx * c[0] + nx, y0 = ay + dy * c[0] + ny, x1 = ax + dx * c[1] + nx, y1 = ay + dy * c[1] + ny;
      const near = Math.min(r2(x0, y0), r2(x1, y1)) < DRAPE_M;
      const k = near ? Math.max(1, Math.ceil(L * (c[1] - c[0]) / DRAPE_STEP)) : 1;
      let px = x0, py = y0, pz = zAt(x0, y0) + lift;
      for (let j = 1; j <= k; j++) {
        const x = x0 + (x1 - x0) * j / k, y = y0 + (y1 - y0) * j / k, z = zAt(x, y) + lift;
        seg(a, px, py, pz, x, y, z); px = x; py = y; pz = z;
      }
    }
  }
  // The parts [t0, t1] of a->b in this band: inside the range, and inside or outside the near circle.
  function pieces(ax, ay, bx, by) {
    const c = clipToCircle(ax, ay, bx, by, v.x, v.y, v.r);
    if (!c || band === 'all') return c ? [c] : [];
    const h = clipToCircle(ax, ay, bx, by, v.x, v.y, BAND_M);
    if (band === 'near') return h && Math.min(c[1], h[1]) > Math.max(c[0], h[0]) ? [[Math.max(c[0], h[0]), Math.min(c[1], h[1])]] : [];
    if (!h) return [c];
    return [[c[0], Math.min(c[1], Math.max(c[0], h[0]))], [Math.max(c[0], Math.min(c[1], h[1])), c[1]]].filter(q => q[1] - q[0] > 1e-9);
  }
  function polyline(a, p, tx, ty, lift, from = 0, to = p.length / 2 - 1, twin = false) {
    for (let i = from; i < to; i++) {
      const ax = tx + p[2 * i], ay = ty + p[2 * i + 1], bx = tx + p[2 * i + 2], by = ty + p[2 * i + 3];
      if (twin && r2((ax + bx) / 2, (ay + by) / 2) < TWIN_RAIL_M) { run(a, ax, ay, bx, by, lift, GAUGE_M / 2); run(a, ax, ay, bx, by, lift, -GAUGE_M / 2); }
      else run(a, ax, ay, bx, by, lift);
    }
  }
  const types = lib?.TOWER_TYPES;
  const plainLift = cls => {
    const s = types?.[cls];
    if (!s) return PLAIN_LIFT[cls];
    return s.kind === 'pole' ? s.armZ : Math.min(...s.arms.map(a => a.z)) - s.insulator;
  };

  function power(f, tx, ty, id) {
    const cls = voltageClass(f.kv), a = out('power/' + cls), p = f.p, n = p.length / 2;
    const idx = Array.isArray(f.t) && f.t.length ? f.t : [...Array(n).keys()];
    const T = idx.map(i => ({ i, x: tx + p[2 * i], y: ty + p[2 * i + 1] }));
    const lift = plainLift(cls), canSag = band !== 'far' && typeof lib?.buildOverhead === 'function';
    const isNear = t => canSag && r2(t.x, t.y) <= NEAR_LINE_M;
    if (band !== 'far') for (const t of T) if (r2(t.x, t.y) <= BAND_M) towers.push({ e: v.o.e + t.x, n: v.o.n + t.y, kv: f.kv }); // for the canopy mask
    polyline(a, p, tx, ty, lift, 0, idx[0]);             // before the first tower and after the last: plain
    polyline(a, p, tx, ty, lift, idx[idx.length - 1]);
    let group = [];
    const flush = () => {
      if (!group.length) return;
      const towers = group.map((t, k) => ({ id: `T${k}`, x: t.x, y: t.y, ground: zAt(t.x, t.y), type: cls }));
      const mk = `${id}|${group[0].i}|${towers.map(t => t.ground.toFixed(2)).join(',')}`; // same towers on the same ground
      const o = memo.get(mk) || lib.buildOverhead(towers, { step: 10 });
      memo.set(mk, o); used.add(mk);
      for (let k = 0; k < o.lines.length; k += 3) a.push(o.lines[k] - bo[0], o.lines[k + 1] - bo[1], o.lines[k + 2] - bo[2]);
      solids.push(...o.solids);
      group = [];
    };
    for (let k = 0; k < T.length; k++) {
      if (isNear(T[k])) { group.push(T[k]); }
      else flush();
      if (k + 1 < T.length && !(isNear(T[k]) && isNear(T[k + 1]))) { flush(); polyline(a, p, tx, ty, lift, T[k].i, T[k + 1].i); }
    }
    flush();
  }

  function substation(f, tx, ty) {
    const x = tx + f.x, y = ty + f.y, d = r2(x, y), cls = voltageClass(f.kv);
    if (d > v.r || (band === 'near' && d > BAND_M) || (band === 'far' && d <= BAND_M)) return;
    const [w, dd, mast] = COMPOUND[cls], a = out('sub/' + cls), g = zAt(x, y);
    if (d > NEAR_SUB_M) { // a mast with a diamond on top, seen from far off
      const s = mast / 6;
      seg(a, x, y, g, x, y, g + mast);
      const P = [[x + s, y, g + mast], [x, y + s, g + mast + s], [x - s, y, g + mast], [x, y - s, g + mast - s]];
      for (let k = 0; k < 4; k++) seg(a, ...P[k], ...P[(k + 1) % 4]);
      return;
    }
    const c = [[x - w / 2, y - dd / 2], [x + w / 2, y - dd / 2], [x + w / 2, y + dd / 2], [x - w / 2, y + dd / 2]];
    let lo = Infinity, hi = -Infinity;
    for (let k = 0; k < 4; k++) {
      const [ax, ay] = c[k], [bx, by] = c[(k + 1) % 4], m = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 10));
      for (let i = 0; i < m; i++) {
        const x0 = ax + (bx - ax) * i / m, y0 = ay + (by - ay) * i / m, x1 = ax + (bx - ax) * (i + 1) / m, y1 = ay + (by - ay) * (i + 1) / m;
        const z0 = zAt(x0, y0), z1 = zAt(x1, y1);
        lo = Math.min(lo, z0, z1); hi = Math.max(hi, z0, z1);
        seg(a, x0, y0, z0, x1, y1, z1); seg(a, x0, y0, z0 + FENCE_H, x1, y1, z1 + FENCE_H);
      }
      const z = zAt(ax, ay);
      seg(a, ax, ay, z, ax, ay, z + FENCE_H);
    }
    solids.push({ min: [x - w / 2, y - dd / 2, lo], max: [x + w / 2, y + dd / 2, hi + FENCE_H] });
  }

  for (const t of tiles) {
    if (!v.kinds.has(t.kind)) continue;
    const doc = t.doc, tx = doc.e0 - v.o.e, ty = doc.n0 - v.o.n;
    if (boxDist(v.x, v.y, [tx, ty, tx + (doc.size || 10000), ty + (doc.size || 10000)]) > reach) continue; // tile outside this band
    if (t.kind === 'roads' || t.kind === 'osroads' || t.kind === 'rail') {
      for (const [cls, list] of Object.entries(doc.lines || {})) {
        const a = out(t.kind === 'rail' ? 'rail' : 'roads/' + cls);
        for (const p of list) { if (skip(p, tx, ty)) continue; polyline(a, p, tx, ty, 0.1, 0, p.length / 2 - 1, t.kind === 'rail'); count.features++; }
      }
    } else if (t.kind === 'power') (doc.features || []).forEach((f, i) => { if (skip(f.p, tx, ty)) return; power(f, tx, ty, `${t.id}#${i}`); count.features++; });
    else for (const f of doc.features || []) { substation(f, tx, ty); count.features++; }
  }
  if (band !== 'far' && v.kinds.has('power')) for (const k of memo.keys()) if (!used.has(k)) memo.delete(k); // forget lines no longer near
  const batches = Object.entries(groups).filter(([, a]) => a.length).map(([g, a]) => ({
    key: `national/${band}/${g}`, origin: bo, color: COLORS[g.split('/').pop()] || COLORS.primary, positions: new Float32Array(a) }));
  return { batches, solids, towers, count };
}

export function createNational() {
  let api = null, rangeM = 5 * MILE_M, kinds = new Set(KINDS);
  let index = null, indexState = 'idle', dataVersion = 0, clock = 0, lastPos = null;
  const squares = new Map(), files = new Map(), inFlight = new Set(), failed = new Set();
  const stats = { requested: [], evicted: [], bytes: 0, buildMs: 0, builds: [] }; // builds: the last 20 [when, ms, why]
  // The far band is built one kind per frame into `next` and swapped in whole; the near band (towers, compounds,
  // measured ground) is rebuilt alone when new ground arrives. Both share one centre, so they meet exactly.
  const zero = () => ({ measured: 0, fallback: 0, features: 0 });
  let centre = { key: null, at: null, fallback: 0 }, next = null, memo = { key: null, map: new Map() };
  let nextNear = null; // { far?, todo, batches, solids, count, gv, t, why, ms }: the near band being built
  const startNear = (farNext, gv, t, why) => ({ far: farNext, todo: [...kinds], batches: [], solids: [], towers: [], count: zero(), gv, t, why, ms: 0 });
  let gvSeen = { gv: null, frames: 0 }; // new ground is drawn under the lines a couple of frames after it arrives, not in its frame
  let far = { batches: [], count: zero() }, near = { batches: [], solids: [], towers: [], count: zero(), gv: -1, t: -Infinity }, all = [];
  const now = () => (api && typeof api.origin === 'function' ? api.origin() : { e: 0, n: 0, id: 0 });
  const clockMs = () => (globalThis.performance ? performance.now() : Date.now());

  function loadIndex() {
    if (indexState !== 'idle' || !api) return;
    const path = api.config?.index, sha = api.config?.sha256;
    if (!path || !sha) { indexState = 'failed'; layer.status = 'no national index configured (config.index and config.sha256)'; return; }
    indexState = 'loading';
    Promise.resolve().then(() => api.fetchJSON(path, sha)).then(j => {
      if (!j || !Array.isArray(j.squares)) throw Error('index.json has no squares list');
      const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '';
      index = { ...j, dir };
      indexState = 'ready'; dataVersion++;
      api.invalidate({ ground: false });
    }).catch(e => { indexState = 'failed'; layer.status = 'national index failed: ' + e.message; });
  }

  let want = { key: null, list: [] }; // worked out again only after a 50 m move or new data
  function wanted() {
    if (!index || !lastPos) return [];
    const o = now(), e = o.e + lastPos[0], n = o.n + lastPos[1];
    const key = `${Math.round(e / 50)},${Math.round(n / 50)}|${dataVersion}|${squares.size}`;
    if (want.key === key) return want.list;
    const tiles = [...squares.values()].flatMap(s => s.doc.tiles || []);
    want = { key, list: wantedFiles(index.squares, tiles, [...kinds], e, n, rangeM) };
    return want.list;
  }

  function request(w) {
    inFlight.add(w.id); stats.requested.push(w.id);
    Promise.resolve().then(() => api.fetchJSON(index.dir + w.path, w.sha256)).then(doc => {
      stats.bytes += w.bytes || 0;
      (w.type === 'square' ? squares : files).set(w.id, { doc, kind: w.kind, used: ++clock });
      dataVersion++; evict();
      api.invalidate({ ground: false });
    }).catch(e => { failed.add(w.id); layer.status = `national ${w.id} failed: ${e.message}`; })
      .finally(() => { inFlight.delete(w.id); pump(); });
  }

  function pump() {
    if (indexState !== 'ready') return;
    for (const w of wanted()) {
      const have = (w.type === 'square' ? squares : files).get(w.id);
      if (have) { have.used = ++clock; continue; }
      if (inFlight.size >= MAX_IN_FLIGHT) break;
      if (!inFlight.has(w.id) && !failed.has(w.id)) request(w);
    }
  }

  function evict() {
    const need = new Set(wanted().map(w => w.id));
    for (const [map, cap] of [[files, Math.max(MIN_CACHE, need.size + 16)], [squares, 8]]) {
      while (map.size > cap) {
        let oldest = null;
        for (const [k, v] of map) if (!need.has(k) && (!oldest || v.used < map.get(oldest).used)) oldest = k;
        if (!oldest) break;
        map.delete(oldest); stats.evicted.push(oldest);
      }
    }
  }

  function writeStatus(count) {
    const want = wanted().filter(w => w.type === 'tile'), have = want.filter(w => files.has(w.id)).length;
    const all = count.measured + count.fallback, pct = all ? Math.round(100 * count.measured / all) : 0;
    layer.status = `range ${(rangeM / MILE_M).toFixed(0)} miles; ${have}/${want.length} tiles loaded` +
      `${inFlight.size ? ` (${inFlight.size} loading)` : ''}; ${count.features} features; ${pct}% of points on measured ground,` +
      ` the rest at ${Number(centre.fallback).toFixed(1)} m, the ground under the viewer (not measured there);` +
      ' assumed: towers inferred from OpenStreetMap, tower shapes, sag, compound and marker sizes';
  }

  const layer = {
    id: 'national',
    status: 'waiting for init',
    init(a) {
      api = a;
      const mi = Number(a.config?.range_miles);
      if (RANGES_MI.includes(mi)) rangeM = mi * MILE_M;
      if (Array.isArray(a.config?.kinds)) kinds = new Set(a.config.kinds.filter(k => KINDS.includes(k))); // e.g. roads and rail only
      layer.status = 'ready to load'; loadIndex();
    },
    setRange(miles) {
      if (!RANGES_MI.includes(Number(miles))) throw Error(`range must be one of ${RANGES_MI.join(', ')} miles`);
      if (rangeM === Number(miles) * MILE_M) return rangeM;
      rangeM = Number(miles) * MILE_M; dataVersion++; pump(); api?.invalidate({ ground: false });
      return rangeM;
    },
    range: () => rangeM,
    setKinds(list) { kinds = new Set([...list].filter(k => KINDS.includes(k))); dataVersion++; pump(); api?.invalidate({ ground: false }); },
    lines(ctx) {
      if (!api) return [];
      if (indexState === 'idle') loadIndex();
      lastPos = ctx.pos;
      pump();
      const o = now(), t = clockMs(), gv = ctx.groundVersion ?? 0, key = `${o.id}|${dataVersion}|${rangeM}`;
      gvSeen = gvSeen.gv === gv ? { gv, frames: gvSeen.frames + 1 } : { gv, frames: 0 };
      const lib = api.lib?.overhead || null, at = [ctx.pos[0], ctx.pos[1]];
      const tiles = k => [...files.entries()].filter(([, f]) => k.includes(f.kind)).map(([id, f]) => ({ id, kind: f.kind, doc: f.doc }));
      const view = (k, band, c) => ({ x: c[0], y: c[1], r: rangeM, kinds: new Set(k), o, band });
      if (!next && !nextNear?.far && (centre.key !== key || !centre.at || Math.hypot(at[0] - centre.at[0], at[1] - centre.at[1]) > rebuildStep(rangeM))) {
        const fb = typeof ctx.heightAt === 'function' ? ctx.heightAt(at[0], at[1]) : 0;
        next = { key, at, fallback: Number.isFinite(fb) ? fb : 0, todo: [...kinds], batches: [], count: zero(), ms: 0 };
      }
      // One kind per frame, far band first, then the near band; both are swapped in together, so they always meet.
      let worked = false;
      if (next) {
        const k = next.todo.shift();
        if (k) {
          const g = buildNational(tiles([k]), view([k], 'far', next.at), { at: () => NaN, fallback: next.fallback }, lib);
          next.batches.push(...g.batches.map(b => ({ ...b, version: `${key}@f${t.toFixed(0)}` })));
          for (const c in g.count) next.count[c] += g.count[c];
          next.ms += clockMs() - t; worked = true;
        }
        if (!next.todo.length) { nextNear = startNear(next, gv, t, 'moved or data'); next = null; }
      } else if (!nextNear && centre.at && gv !== near.gv && gvSeen.frames >= GROUND_SETTLE_FRAMES && t - near.t > GROUND_REBUILD_MS) {
        nextNear = startNear(null, gv, t, 'ground');
      }
      if (nextNear && !worked) {
        const t0 = clockMs(), c = nextNear.far || { ...far, ...centre }, k = nextNear.todo.shift();
        if (memo.key !== o.id) memo = { key: o.id, map: new Map() }; // local positions change with the origin
        if (k) {
          const measured = typeof ctx.measuredAt === 'function' ? ctx.measuredAt : () => NaN;
          const g = buildNational(tiles([k]), view([k], 'near', c.at), { at: measured, fallback: c.fallback }, lib, memo.map);
          nextNear.batches.push(...g.batches.map(b => ({ ...b, version: `${key}@n${t.toFixed(0)}` })));
          nextNear.solids.push(...g.solids); nextNear.towers.push(...g.towers);
          for (const q in g.count) nextNear.count[q] += g.count[q];
          nextNear.ms += clockMs() - t0;
        }
        if (!nextNear.todo.length) {
          const n = nextNear;
          if (n.far) { centre = { key: n.far.key, at: n.far.at, fallback: n.far.fallback }; far = n.far; }
          near = { batches: n.batches, solids: n.solids, towers: n.towers, count: n.count, gv: n.gv, t: n.t };
          nextNear = null;
          stats.buildMs = n.ms + (n.far ? n.far.ms : 0);
          stats.builds = [...stats.builds.slice(-19), [Math.round(t), +stats.buildMs.toFixed(1), n.why]];
          all = near.batches.concat(far.batches);
          const count = zero();
          for (const q in count) count[q] = near.count[q] + far.count[q];
          writeStatus(count);
        }
      }
      return all;
    },
    solids() { return near.solids; },
    // Tower positions in the near band, national grid metres: the canopy masks them (a lattice is not a tree).
    towers: () => near.towers,
    debug: () => ({ indexState, rangeM, kinds: [...kinds], files: [...files.keys()], squares: [...squares.keys()],
      inFlight: [...inFlight], failed: [...failed], ...stats, count: { near: near.count, far: far.count } })
  };
  return layer;
}

export default createNational();
