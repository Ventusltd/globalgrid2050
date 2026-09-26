// Layer: grid. Overhead lines from a per-site file and substations from the national index, drawn as quiet wireframe.
// Self-contained: no imports (it runs from a blob URL). The towers and conductors come from the shared overhead
// builder the substrate hands in as api.lib.overhead.buildOverhead; without it the layer draws nothing and says so.
//
// Config (manifest): { path, sha256 } of the site file, and national: { index, sha256 } of the national substation
// index (tools/features/substation-index.mjs: every substation, 20 km tiles, each tile's hash in the index). Either
// may be given alone; everything is fetched through the substrate's hash check. The tiles within 30 km of the viewer
// are read as it moves; nearestSubstation(e, n) reads further tiles, nearest first, until the answer is certain.
// Site file format:
//   { licence, attribution,
//     lines: [{ voltage_kv, operator, points: [[e, n], ...], towers: [indices into points] }],
//     substations: [{ e, n, voltage_kv, operator }] }
// in British National Grid metres. Positions are turned into local metres with api.origin(). Where a line gives
// no towers, every point is a tower. Points that are not towers are ignored: a span runs straight tower to tower.
//
// Towers stand on the ground (ctx.heightAt). Clearance is measured against the same ground, 1 m along each
// conductor, and the lowest per span is shown in layer.status. Towers and compounds are solids (walkers and the
// drone are blocked). The geometry is rebuilt when the ground or the origin changes.
//
// Substations within 2 km of the viewer are drawn as fenced compounds (solids); others within 30 km as a mast marker.
// TOWER SHAPES, SAG AND COMPOUND SIZES ARE ASSUMED (typical, not surveyed). Positions and voltages are the file's.

// Voltage class from a nominal kV. Bands: >= 345 is 400 kV, >= 220 is 275 kV, >= 66 is 132 kV, else 33 kV.
export function voltageClass(kv) {
  const v = Number(kv);
  if (!(v > 0)) return '33kV';
  return v >= 345 ? '400kV' : v >= 220 ? '275kV' : v >= 66 ? '132kV' : '33kV';
}

// Quiet colours on the dark background, by class. Blue for 400 and red for 275 follow the usual UK map convention.
export const COLORS = {
  '400kV': [0.55, 0.66, 1.00, 0.62],
  '275kV': [1.00, 0.56, 0.56, 0.55],
  '132kV': [1.00, 0.80, 0.48, 0.50],
  '33kV': [0.56, 0.86, 0.62, 0.45],
};

// Compound footprint (east-west by north-south, metres) and fence height by class. ASSUMED: typical outdoor
// air-insulated compounds, proportioned by eye, not from any survey or public source checked in this session.
export const COMPOUND = {
  '400kV': { w: 300, d: 200 },
  '275kV': { w: 220, d: 150 },
  '132kV': { w: 90, d: 60 },
  '33kV': { w: 30, d: 20 },
};
export const FENCE_H = 2.4;       // assumed palisade fence height, metres
const FENCE_STEP = 10;            // fence line drapes on the ground every 10 m or less
const LIST_MAX = 30;              // spans listed by name in the status line
export const NEAR_M = 2000;       // substations nearer the viewer than this are drawn as compounds, the rest as markers
const MARKER_H = 40, MARKER_W = 8; // marker mast height and top square, metres (a symbol, not a structure)
const SAME_SUB_M = 30;            // a site-file substation this close to an index one is the same substation
export const LOAD_M = 30000;      // national tiles within this of the viewer are read, and their substations drawn
const TIERS = { T: 'transmission', D: 'distribution' };

const finite = (h, d = 0) => (Number.isFinite(h) ? h : d);
const isPt = p => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]);

// Pure: the file -> { lines: [{ cls, operator, towers: [{ id, e, n }] }], substations: [{ cls, e, n, operator }] }.
// Throws on a file that is not the expected shape; skips individual entries that are unusable.
export function parseGridFile(j) {
  if (!j || typeof j !== 'object' || !Array.isArray(j.lines)) throw Error('grid file has no lines list');
  const lines = [];
  j.lines.forEach((l, i) => {
    const pts = Array.isArray(l?.points) ? l.points : [];
    let idx = Array.isArray(l?.towers) && l.towers.length ? l.towers : pts.map((_, k) => k);
    idx = [...new Set(idx.filter(k => Number.isInteger(k) && k >= 0 && k < pts.length && isPt(pts[k])))].sort((a, b) => a - b);
    if (!idx.length) return;
    const cls = voltageClass(l.voltage_kv);
    // surveyed: true only when the file vouches for tower heights and sag (the operator's own line data). Absent or
    // anything else: tower heights and sag are this tool's typical values, and no clearance is judged against a rule.
    lines.push({ cls, kv: l.voltage_kv, operator: l.operator || '', surveyed: l.surveyed === true,
      towers: idx.map(k => ({ id: `L${i}T${k}`, e: pts[k][0], n: pts[k][1] })) });
  });
  const substations = (Array.isArray(j.substations) ? j.substations : [])
    .filter(s => s && Number.isFinite(s.e) && Number.isFinite(s.n))
    .map((s, i) => ({ id: `S${i}`, cls: voltageClass(s.voltage_kv), kv: s.voltage_kv, operator: s.operator || '', e: s.e, n: s.n }));
  return { lines, substations, licence: j.licence || '', attribution: j.attribution || '' };
}

// Pure: the national index -> { tileM, tiles: [{ key, e0, n0, count, sha256, file }] }. Throws unless licensed.
export function parseNationalIndex(j) {
  if (!j || typeof j !== 'object' || !Array.isArray(j.tiles)) throw Error('substation index has no tiles list');
  if (!j.licence) throw Error('substation index has no licence');
  const tileM = Number(j.tile_m) > 0 ? Number(j.tile_m) : 20000;
  const tiles = j.tiles.filter(t => Array.isArray(t) && Number.isFinite(t[0]) && Number.isFinite(t[1]) && /^[0-9a-f]{64}$/.test(t[3]))
    .map(([e0, n0, count, sha256]) => ({ key: `${e0 / 1000}_${n0 / 1000}`, e0, n0, count, sha256, file: `tiles/${e0 / 1000}_${n0 / 1000}.odbl.json` }));
  return { tileM, tiles };
}

// Pure: one tile's rows -> [{ id, cls, kv, tier, e, n }]. No operator: the screen shows the network tier only.
export function parseNationalTile(j, key) {
  if (!j || !Array.isArray(j.rows)) throw Error(`substation tile ${key} has no rows`);
  return j.rows.filter(r => Array.isArray(r) && Number.isFinite(r[0]) && Number.isFinite(r[1])).map((r, i) => ({
    id: `N${key}_${i}`, cls: voltageClass(r[2]), kv: r[2] ?? null, tier: TIERS[r[3]] || null, e: r[0], n: r[1] }));
}

// Pure: plan distance from (e, n) to a tile's square (0 inside it).
export const tileDistance = (t, tileM, e, n) =>
  Math.hypot(Math.max(t.e0 - e, 0, e - t.e0 - tileM), Math.max(t.n0 - n, 0, n - t.n0 - tileM));

// Pure: the index's substations, plus any from the site file that the index does not already hold.
export function mergeSubstations(fromFile, fromIndex) {
  const extra = fromFile.filter(s => !fromIndex.some(t => Math.hypot(t.e - s.e, t.n - s.n) <= SAME_SUB_M));
  return [...fromIndex, ...extra];
}

// Pure: which substations are within `within` (plan metres from the viewer, local): compounds by default.
export function nearSet(model, origin, pos = [0, 0], within = NEAR_M) {
  return model.substations.map((s, i) => (Math.hypot(s.e - origin.e - pos[0], s.n - origin.n - pos[1]) <= within ? i : -1))
    .filter(i => i >= 0);
}

// Pure: a far substation's marker as line pairs relative to o: a mast with a square on top.
export function marker(x, y, z, o) {
  const P = (dx, dy, up) => [x + dx - o[0], y + dy - o[1], z + up - o[2]], out = [], h = MARKER_W / 2;
  const L = (a, b) => out.push(...a, ...b);
  L(P(0, 0, 0), P(0, 0, MARKER_H));
  const sq = [[-h, -h], [h, -h], [h, h], [-h, h]];
  for (let k = 0; k < 4; k++) L(P(...sq[k], MARKER_H), P(...sq[(k + 1) % 4], MARKER_H));
  return out;
}

// Pure: a compound's fence as line pairs relative to o, draped on heightAt, plus its solid box (absolute local).
export function compound(x, y, cls, heightAt, o = [0, 0, 0]) {
  const { w, d } = COMPOUND[cls] || COMPOUND['33kV'];
  const c = [[x - w / 2, y - d / 2], [x + w / 2, y - d / 2], [x + w / 2, y + d / 2], [x - w / 2, y + d / 2]];
  const out = [], g = (px, py) => finite(heightAt(px, py), finite(heightAt(x, y)));
  let lo = Infinity, hi = -Infinity;
  const P = (px, py, up) => { const z = g(px, py); lo = Math.min(lo, z); hi = Math.max(hi, z); return [px - o[0], py - o[1], z + up - o[2]]; };
  const L = (a, b) => out.push(a[0], a[1], a[2], b[0], b[1], b[2]);
  for (let k = 0; k < 4; k++) {
    const [ax, ay] = c[k], [bx, by] = c[(k + 1) % 4];
    const m = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / FENCE_STEP));
    for (let i = 0; i < m; i++) {
      const f0 = i / m, f1 = (i + 1) / m;
      const x0 = ax + (bx - ax) * f0, y0 = ay + (by - ay) * f0, x1 = ax + (bx - ax) * f1, y1 = ay + (by - ay) * f1;
      L(P(x0, y0, 0), P(x1, y1, 0));                       // foot of the fence
      L(P(x0, y0, FENCE_H), P(x1, y1, FENCE_H));           // top rail
    }
    L(P(ax, ay, 0), P(ax, ay, FENCE_H));                   // corner post
  }
  // A cross at the centre marks the compound from the air.
  const s = Math.min(w, d) * 0.15;
  L(P(x - s, y, 0.2), P(x + s, y, 0.2)); L(P(x, y - s, 0.2), P(x, y + s, 0.2));
  return { positions: out, solid: { min: [x - w / 2, y - d / 2, lo], max: [x + w / 2, y + d / 2, hi + FENCE_H] } };
}

// Pure: tower ground from measured LiDAR where it exists; elsewhere interpolated along the line between the nearest
// measured towers (never the viewer's last-known height), and only as a last resort the substrate's ground.
export function towerGrounds(towers, measuredAt, heightAt) {
  const m = towers.map(t => measuredAt(t.x, t.y));
  const known = m.map((h, i) => (Number.isFinite(h) ? i : -1)).filter(i => i >= 0);
  return towers.map((t, i) => {
    if (Number.isFinite(m[i])) return { ...t, ground: m[i], groundMeasured: true };
    const a = known.filter(k => k < i).pop(), b = known.find(k => k > i);
    let g;
    if (a !== undefined && b !== undefined) g = m[a] + (m[b] - m[a]) * (i - a) / (b - a);
    else if (a !== undefined || b !== undefined) g = m[a ?? b];
    else g = finite(heightAt(t.x, t.y));
    return { ...t, ground: g, groundMeasured: false };
  });
}

// Pure: for each span, true when both towers and every point under it (5 m steps) have measured ground.
export function measuredSpans(towers, measuredAt) {
  const out = [];
  for (let k = 0; k + 1 < towers.length; k++) {
    const A = towers[k], B = towers[k + 1], n = Math.max(2, Math.ceil(Math.hypot(B.x - A.x, B.y - A.y) / 5));
    let ok = true;
    for (let s = 0; s <= n && ok; s++) ok = Number.isFinite(measuredAt(A.x + (B.x - A.x) * s / n, A.y + (B.y - A.y) * s / n));
    out.push(ok);
  }
  return out;
}

// Clearance is an estimate: shown to the nearest 0.5 m, never finer than the assumed geometry allows.
export const CLEARANCE_STEP = 0.5;
export const ESTIMATE = 'estimate, assumed tower heights and sag';
export const roundClearance = v => Math.round(v / CLEARANCE_STEP) * CLEARANCE_STEP;
// A span is judged against the statutory figure only where the ground under it is measured AND the line's own
// tower heights and sag are real (surveyed). Everywhere else the number is an estimate and carries no verdict.
export const judged = c => Number.isFinite(c.minClearance) && c.surveyed === true;

// Pure: the status line from per-span clearances.
export function clearanceStatus(model, clearances) {
  const nT = model.lines.reduce((s, l) => s + l.towers.length, 0);
  const head = `grid: ${model.lines.length} lines, ${nT} towers, ${model.substations.length} substations`;
  if (!clearances.length) return `${head}; no spans; tower and compound sizes assumed`;
  const fmt = c => (Number.isFinite(c.minClearance)
    ? roundClearance(c.minClearance).toFixed(1) + (judged(c) && c.minClearance < c.required ? '!' : '') : 'not measured');
  const shown = clearances.slice(0, LIST_MAX).map(c => `${c.from}-${c.to} ${fmt(c)}`);
  if (clearances.length > LIST_MAX) shown.push(`+${clearances.length - LIST_MAX} more`);
  const measured = clearances.filter(c => Number.isFinite(c.minClearance));
  const ASSUMED = 'assumed: tower positions inferred from OpenStreetMap, attachment heights and sag typical, compound sizes';
  if (!measured.length) return `${head}; clearance not measured yet (walk or fly near the line so its ground loads); ${ASSUMED}`;
  const low = measured.reduce((a, b) => (b.minClearance < a.minClearance ? b : a));
  const real = measured.filter(judged), below = real.filter(c => c.minClearance < c.required).length;
  const estimate = measured.length > real.length ? ` (${ESTIMATE})` : '';
  const verdict = real.length
    ? `; ${below} surveyed span${below === 1 ? '' : 's'} below the statutory figure (ESQCR Sch 2; confirm with the network operator)`
    : '; not checked against the statutory figure: confirm clearance with the network operator';
  return `${head}; min ground clearance per span (m)${estimate}: ${shown.join(', ')}; lowest ${fmt(low)} on ${low.from}-${low.to}` +
    `${verdict}; ${ASSUMED}`;
}

// Ground on the straight line between the tower grounds of the span nearest (x, y).
function straightGround(towers, x, y) {
  if (towers.length < 2) return towers[0]?.ground ?? 0;
  let best = Infinity, h = towers[0].ground;
  for (let k = 0; k + 1 < towers.length; k++) {
    const A = towers[k], B = towers[k + 1], dx = B.x - A.x, dy = B.y - A.y, L2 = dx * dx + dy * dy || 1;
    const f = Math.min(1, Math.max(0, ((x - A.x) * dx + (y - A.y) * dy) / L2));
    const d = Math.hypot(A.x + dx * f - x, A.y + dy * f - y);
    if (d < best) { best = d; h = A.ground + (B.ground - A.ground) * f; }
  }
  return h;
}

// Pure: build every batch, solid and clearance for the model at the given origin and ground.
export function buildGrid(model, origin, heightAt, buildOverhead, measuredAt = heightAt, near = null, shown = null) {
  const batches = [], solids = [], clearances = [];
  const local = (e, n) => [e - origin.e, n - origin.n];
  model.lines.forEach((l, i) => {
    const towers = towerGrounds(l.towers.map(t => { const [x, y] = local(t.e, t.n); return { id: t.id, x, y, type: l.cls }; }),
      measuredAt, heightAt);
    const known = measuredSpans(towers, measuredAt);
    // Off the loaded ground, clearance is measured to the straight line between the nearest span's tower grounds.
    const out = buildOverhead(towers, {
      groundAt: (x, y) => { const h = heightAt(x, y); return Number.isFinite(h) ? h : straightGround(towers, x, y); }
    });
    const o = [towers[0].x, towers[0].y, towers[0].ground], pos = new Float32Array(out.lines.length);
    for (let k = 0; k < pos.length; k += 3) { pos[k] = out.lines[k] - o[0]; pos[k + 1] = out.lines[k + 1] - o[1]; pos[k + 2] = out.lines[k + 2] - o[2]; }
    batches.push({ key: `grid/line/${i}`, origin: o, color: COLORS[l.cls], positions: pos });
    solids.push(...out.solids);
    // Clearance is only reported where the whole span stands on measured LiDAR ground; elsewhere it is not measured.
    clearances.push(...out.clearances.map(c => (known[c.span] ? { ...c, line: i, cls: l.cls, surveyed: l.surveyed === true }
      : { ...c, minClearance: NaN, at: null, line: i, cls: l.cls, surveyed: l.surveyed === true, note: 'ground not measured under this span' })));
  });
  const close = new Set(near ?? model.substations.map((_, i) => i));
  model.substations.forEach((s, i) => {
    if (shown && !shown.has(i) && !close.has(i)) return;
    const [x, y] = local(s.e, s.n), o = [x, y, finite(heightAt(x, y))];
    if (!close.has(i)) {
      batches.push({ key: `grid/substation/${i}`, origin: o, color: COLORS[s.cls], positions: new Float32Array(marker(x, y, o[2], o)) });
      return;
    }
    const c = compound(x, y, s.cls, heightAt, o);
    batches.push({ key: `grid/substation/${i}`, origin: o, color: COLORS[s.cls], positions: new Float32Array(c.positions) });
    solids.push(c.solid);
  });
  return { batches, solids, clearances };
}

export function createGrid() {
  let api = null, model = null, state = 'idle'; // idle | loading | ready | failed
  let built = { version: null, batches: [], solids: [], clearances: [] };

  // National index: tiles read on demand, each checked against its hash in the (hash-checked) index.
  const nat = { index: null, dir: '', ready: null, error: '', loaded: new Map(), pending: new Map(), at: '' };
  let fileSubs = [], subsVersion = 0;
  function loadTile(t) {
    if (nat.loaded.has(t.key)) return Promise.resolve(nat.loaded.get(t.key));
    if (!nat.pending.has(t.key)) {
      nat.pending.set(t.key, Promise.resolve().then(() => api.fetchJSON(nat.dir + t.file, t.sha256)).then(j => {
        const subs = parseNationalTile(j, t.key);
        nat.loaded.set(t.key, subs); nat.pending.delete(t.key);
        if (model) { model.substations = mergeSubstations(fileSubs, [...nat.loaded.values()].flat()); subsVersion++; }
        api.invalidate({ ground: false });
        return subs;
      }, e => { nat.pending.delete(t.key); throw e; }));
    }
    return nat.pending.get(t.key);
  }
  // The tiles round the viewer, read once it has moved 2 km or more since the last look.
  function around(e, n) {
    const k = `${Math.round(e / 2000)},${Math.round(n / 2000)}`;
    if (!nat.index || nat.at === k) return;
    nat.at = k;
    for (const t of nat.index.tiles) if (tileDistance(t, nat.index.tileM, e, n) <= LOAD_M) loadTile(t).catch(() => {});
  }
  // Nearest substation anywhere: tiles in order of distance, stopping once the next tile is further than the best.
  async function nearestSubstation(e, n) {
    if (!nat.ready) return null;
    await nat.ready;
    if (!nat.index) return null;
    const order = nat.index.tiles.map(t => ({ t, d: tileDistance(t, nat.index.tileM, e, n) })).sort((a, b) => a.d - b.d);
    let best = null, bd = Infinity;
    for (const { t, d } of order) {
      if (d > bd) break;
      for (const s of await loadTile(t)) { const ds = Math.hypot(s.e - e, s.n - n); if (ds < bd) { best = s; bd = ds; } }
    }
    const extra = mergeSubstations(fileSubs, [...nat.loaded.values()].flat()).filter(s => fileSubs.includes(s));
    for (const s of extra) { const ds = Math.hypot(s.e - e, s.n - n); if (ds < bd) { best = s; bd = ds; } }
    const tier = best?.tier || (best?.kv >= 200 ? 'transmission' : best?.kv > 0 ? 'distribution' : null);
    return best && { kind: 'substation', e: best.e, n: best.n, kv: best.kv ?? null, tier, id: best.id };
  }

  function load() {
    if (state !== 'idle' || !api) return;
    const path = api.config?.path, sha = api.config?.sha256, ni = api.config?.national;
    const hasNational = !!(ni?.index && ni?.sha256);
    if (!(path && sha) && !hasNational) { state = 'failed'; layer.status = 'no grid file configured (config.path and config.sha256)'; return; }
    state = 'loading'; layer.status = 'loading ' + [path, ni?.index].filter(Boolean).join(' and ');
    if (hasNational) {
      nat.dir = ni.index.includes('/') ? ni.index.slice(0, ni.index.lastIndexOf('/') + 1) : '';
      nat.ready = Promise.resolve().then(() => api.fetchJSON(ni.index, ni.sha256)).then(j => { nat.index = parseNationalIndex(j); },
        e => { nat.error = e.message; });
    }
    Promise.resolve().then(() => Promise.all([path && sha ? api.fetchJSON(path, sha) : { lines: [] }, nat.ready])).then(([j]) => {
      model = parseGridFile(j);
      fileSubs = model.substations;
      model.substations = mergeSubstations(fileSubs, [...nat.loaded.values()].flat());
      state = 'ready';
      layer.status = `grid file loaded: ${model.lines.length} lines` + (nat.error ? `; national substation index failed: ${nat.error}` : '');
      api.invalidate({ ground: false });
    }).catch(e => { state = 'failed'; layer.status = 'grid file failed: ' + e.message; });
  }

  const layer = {
    id: 'grid',
    status: 'waiting for init',
    clearances: [],
    init(a) { api = a; layer.status = 'ready to load'; load(); },
    lines(ctx) {
      if (!api) return [];
      if (state === 'idle') load();
      if (state !== 'ready') return [];
      const lib = api.lib?.overhead;
      if (!lib || typeof lib.buildOverhead !== 'function') { layer.status = 'waiting: api.lib.overhead.buildOverhead not provided'; return []; }
      const o = typeof api.origin === 'function' ? api.origin() : { e: 0, n: 0, id: 0 };
      const heightAt = typeof ctx.heightAt === 'function' ? ctx.heightAt : () => NaN;
      const pos = ctx.pos || [0, 0];
      around(o.e + pos[0], o.n + pos[1]);
      const near = nearSet(model, o, pos), shown = new Set(nearSet(model, o, pos, LOAD_M));
      const version = `${o.e},${o.n},${o.id}@${ctx.groundVersion ?? 0}#${near.join('.')}~${subsVersion}:${shown.size}`;
      if (built.version === version && built.heightAt === heightAt) return built.batches;
      try {
        const measured = typeof ctx.measuredAt === 'function' ? ctx.measuredAt : heightAt;
        const g = buildGrid(model, o, heightAt, lib.buildOverhead, measured, near, shown);
        built = { version, heightAt, ...g, batches: g.batches.map(b => ({ ...b, version })) };
        layer.clearances = g.clearances;
        const towers = model.lines.reduce((s, l) => s + l.towers.length, 0);
        layer.summary = `${model.lines.length} lines, ${towers} towers, ${shown.size} substations near. Clearances are illustrative: `
          + 'towers from OpenStreetMap, heights and sag assumed; confirm with the network operator.';
        layer.status = clearanceStatus(model, g.clearances) + `; substations within ${NEAR_M / 1000} km drawn as fenced`
          + ` compounds (${near.length}, sizes assumed), others within ${LOAD_M / 1000} km as markers (${shown.size - near.length})`
          + (nat.index ? `; national substation index: ${nat.loaded.size} of ${nat.index.tiles.length} tiles read` : '')
          + (nat.error ? `; national substation index failed: ${nat.error}` : '');
      } catch (e) {
        built = { version, heightAt, batches: [], solids: [], clearances: [] };
        layer.status = 'grid build failed: ' + e.message;
      }
      return built.batches;
    },
    // Boxes from the last build (towers and compounds). Empty until the first frame has drawn the grid.
    solids() { return built.solids; },
    nearestSubstation,
    debug: () => ({ state, model, version: built.version, nationalTiles: nat.loaded.size })
  };
  return layer;
}

export default createGrid();
