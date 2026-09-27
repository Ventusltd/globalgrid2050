// plant-lod.mjs: a large plant drawn from its pack (plant-pack.mjs) at the detail the distance allows.
//
//   L0 outline      eye over 3 km above the plant (leave under 2.4 km): the used land as one hull
//   L1 blocks       below that: one rectangle per block, the stations and the feeder graph to the compound (hidden under 300 m)
//   L2 table runs   a 250 m cell within 2 km of the eye (leave beyond 2.4 km): the tables of a row merged into one run
//   L3 tables       a cell within 600 m (leave beyond 720 m): every table's outline, ridge or tube
//   L4 full table   a 50 m sub-cell within 80 m (leave beyond 100 m): the module grid on the table, and extra(i) (the piles)
// The level is decided inside the draw from the camera, with 20 % hysteresis, so a still camera decides nothing (0 fps).
// A cell keeps drawing its old level until the new one is built; building is capped per frame, and the rest waits for the
// next frame (onPending asks for one). Built batches live in a least-recently-used cache; an evicted batch's GPU buffer is
// freed through release(key) (lines.mjs). Positions are relative to each batch's own base, so floats stay small.
// Pure apart from the clock: no DOM, no WebGL.

import { axesOf, cornersOf, cellTables } from './plant-pack.mjs';

export const PLANT_BANDS = Object.freeze({ outline: [3000, 2400], blocks: [300, 250] }); // [enter, leave] eye height (m)
export const CELL_BANDS = Object.freeze([[600, 3], [2000, 2]]);                         // [enter distance (m), level]
export const DETAIL = Object.freeze({ subM: 50, enterM: 80, leaveM: 100 });
export const HYSTERESIS = 1.2;
export const BUILD_MS = 6;
const GROUP = 4; // cells a side in one L2 batch

// Plant-wide: 0 outline, 1 blocks, 2 blocks hidden (close to the ground), from the eye height above the plant.
export function plantLevel(h, prev = null) {
  const [oIn, oOut] = PLANT_BANDS.outline, [bIn, bOut] = PLANT_BANDS.blocks;
  if (h > oIn || (prev === 0 && h > oOut)) return 0;
  if (h > bIn || (prev === 1 && h > bOut)) return 1;
  return 2;
}

// A cell's level from its distance: the most detailed band it is inside; a more detailed previous level is kept until
// the distance passes its band times the hysteresis. 1 = nothing drawn per cell (the blocks cover it).
export function cellLevel(dist, prev = 1, bands = CELL_BANDS) {
  let level = 1;
  for (const [enter, l] of bands) if (dist < enter) { level = Math.max(level, l); }
  if (prev > level) { const b = bands.find(([, l]) => l === prev); if (b && dist < b[0] * HYSTERESIS) return prev; }
  return level;
}

// Distance from a point to an axis-aligned box.
export const boxDistance = (p, [x0, y0, z0, x1, y1, z1]) =>
  Math.hypot(Math.max(x0 - p[0], 0, p[0] - x1), Math.max(y0 - p[1], 0, p[1] - y1), Math.max(z0 - p[2], 0, p[2] - z1));

// Height on a table's module surface at local (a along, d across): the corners bilinear, an east-west ridge rising in the middle.
function surfaceOf(pack, i) {
  const T = pack.types[pack.type[i]], C = cornersOf(pack, i), L = T.lenU / 2, D = T.depth / 2, { ax, dx } = axesOf(pack.heading[i]);
  const ridge = T.faces === 2 ? T.rise : 0, x = pack.x[i], y = pack.y[i];
  return (a, d) => {
    const s = (a + L) / (2 * L), t = (d + D) / (2 * D);
    const z = (1 - t) * ((1 - s) * C[0][2] + s * C[1][2]) + t * ((1 - s) * C[3][2] + s * C[2][2]) + ridge * (1 - Math.abs(d) / D);
    return [x + a * ax[0] + d * dx[0], y + a * ax[1] + d * dx[1], z];
  };
}

// ---- builders: each writes x,y,z pairs (relative to base) into an array ----
function outlineOf(pack, i, v, base) {
  const T = pack.types[pack.type[i]], P = surfaceOf(pack, i), L = T.lenU / 2, D = T.depth / 2;
  const seg = (a, b) => { for (const p of [a, b]) v.push(p[0] - base[0], p[1] - base[1], p[2] - base[2]); };
  const A = P(-L, -D), B = P(L, -D), C = P(L, D), E = P(-L, D);
  if (T.faces === 2) {                                        // east-west: both low edges, the ridge, and the gables
    const M = P(-L, 0), N = P(L, 0);
    seg(A, B); seg(E, C); seg(M, N); seg(A, M); seg(M, E); seg(B, N); seg(N, C);
  } else {
    seg(A, B); seg(B, C); seg(C, E); seg(E, A);
    if (T.tracker) seg(P(-L, 0), P(L, 0));                    // the torque tube
  }
}

export function moduleGridOf(pack, i, v, base) {
  const T = pack.types[pack.type[i]], P = surfaceOf(pack, i), L = T.lenU / 2, D = T.depth / 2;
  const seg = (a, b) => { for (const p of [a, b]) v.push(p[0] - base[0], p[1] - base[1], p[2] - base[2]); };
  const cols = T.tracker ? T.modules : T.modules / 2;
  const bands = T.faces === 2 ? [[-D, 0], [0, D]] : [[-D, D]];
  for (const [d0, d1] of bands) for (let c = 0; c <= cols; c++) { const a = -L + 2 * L * c / cols; seg(P(a, d0), P(a, d1)); }
  if (T.south) seg(P(-L, 0), P(L, 0));                        // two modules up the slope: the line between them
}

// Tables of a cell merged into runs: same heading, same row (across position within 0.1 m), gaps under 1 m.
export function runsOf(pack, ids) {
  const rows = new Map();
  for (const i of ids) {
    const { ax, dx } = axesOf(pack.heading[i]), a = pack.x[i] * ax[0] + pack.y[i] * ax[1], d = pack.x[i] * dx[0] + pack.y[i] * dx[1];
    const k = `${pack.heading[i]}:${pack.type[i]}:${Math.round(d * 10)}`;
    if (!rows.has(k)) rows.set(k, []);
    rows.get(k).push([a, i]);
  }
  const runs = [];
  for (const list of rows.values()) {
    list.sort((p, q) => p[0] - q[0]);
    let cur = null;
    for (const [a, i] of list) {
      const L = pack.types[pack.type[i]].lenU / 2;
      if (cur && a - L - cur.a1 < 1) { cur.a1 = a + L; cur.last = i; cur.n++; } else runs.push(cur = { a0: a - L, a1: a + L, first: i, last: i, n: 1 });
    }
  }
  return runs;
}
function runOutline(pack, run, v, base) {
  const T = pack.types[pack.type[run.first]], D = T.depth / 2, L = T.lenU / 2;
  const P0 = surfaceOf(pack, run.first), P1 = surfaceOf(pack, run.last);
  const A = P0(-L, -D), E = P0(-L, D), B = P1(L, -D), C = P1(L, D);
  for (const [p, q] of [[A, B], [B, C], [C, E], [E, A]]) for (const s of [p, q]) v.push(s[0] - base[0], s[1] - base[1], s[2] - base[2]);
}

// Convex hull (monotone chain) of 2-D points.
export function hull(pts) {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]), cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo.at(-2), lo.at(-1), q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (hi.length >= 2 && cross(hi.at(-2), hi.at(-1), q) <= 0) hi.pop(); hi.push(q); }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
}

// ---- the level-of-detail drawer ----
// opts: { colours: { outline, blocks, stations, runs, tables, detail }, release(key), onPending(), extra(i, v, base) more L4 lines,
//   maxBytes: the cache size, now() }
export function createLod(pack, { colours, release = () => {}, onPending = () => {}, extra = null, maxBytes = 24 << 20, now = () => performance.now(), version = 0 } = {}) {
  const G = pack.grid, cache = new Map(), levels = new Map(), detailOn = new Set(), lastRuns = new Map();
  let plant = null, frame = 0, bytes = 0;
  const stats = { built: 0, evicted: 0, pending: 0, batches: 0, vertices: 0, levels: [0, 0, 0, 0, 0] };
  const zMean = pack.n ? pack.z.reduce((t, z) => t + z, 0) / pack.n : 0;
  const cellBox = c => { const i = c % G.cols, j = Math.floor(c / G.cols);
    return [G.x0 + i * G.cellM, G.y0 + j * G.cellM, G.zMin[c], G.x0 + (i + 1) * G.cellM, G.y0 + (j + 1) * G.cellM, G.zMax[c]]; };
  let budgetEnd = 0;
  // A batch for key, built by fill(v, base) once per version; null while over this frame's build budget.
  function get(key, base, colour, fill) {
    let e = cache.get(key);
    if (!e) {
      if (now() > budgetEnd) { stats.pending++; return null; }
      const v = []; fill(v, base);
      e = { key, base, colour, positions: new Float32Array(v) }; cache.set(key, e); bytes += e.positions.byteLength; stats.built++;
    }
    e.used = frame;
    return e;
  }
  function evict() {
    if (bytes <= maxBytes) return;
    for (const e of [...cache.values()].sort((a, b) => a.used - b.used)) {
      if (bytes <= maxBytes || e.used === frame) break;
      cache.delete(e.key); bytes -= e.positions.byteLength; release(e.key); stats.evicted++;
    }
  }
  const K = s => `plant-lod-${version}-${s}`;

  // eye: [x, y, z] in pack coordinates; toOrigin(base) -> the batch origin the renderer wants. Returns line batches.
  function batches(eye, toOrigin) {
    frame++; budgetEnd = now() + BUILD_MS; stats.pending = 0; stats.levels = [0, 0, 0, 0, 0];
    const out = [], push = (e, colour) => { if (e && e.positions.length >= 6) out.push({ key: e.key, version: 0, positions: e.positions, color: colour, origin: toOrigin(e.base) }); };
    plant = plantLevel(eye[2] - zMean, plant);
    const base0 = [0, 0, zMean];
    if (plant === 0) {
      stats.levels[0] = 1;
      push(get(K('outline'), base0, colours.outline, (v, b) => {
        const H = hull(pack.blocks.flatMap(k => k.rect));
        H.forEach((p, k) => { const q = H[(k + 1) % H.length]; v.push(p[0] - b[0], p[1] - b[1], 1, q[0] - b[0], q[1] - b[1], 1); });
      }), colours.outline);
    }
    if (plant === 1) {
      stats.levels[1] = 1;
      push(get(K('blocks'), base0, colours.blocks, (v, b) => {
        for (const k of pack.blocks) k.rect.forEach((p, m) => { const q = k.rect[(m + 1) % 4]; v.push(p[0] - b[0], p[1] - b[1], k.z - b[2] + 2, q[0] - b[0], q[1] - b[1], k.z - b[2] + 2); });
      }), colours.blocks);
      push(get(K('graph'), base0, colours.stations, (v, b) => {
        const g = pack.graph, S = g?.stations || [], lift = 6, r = 12;
        for (const s of S) { const [x, y] = s.at, z = (pack.blocks[s.block]?.z ?? b[2]) - b[2] + lift;
          v.push(x - r - b[0], y - b[1], z, x + r - b[0], y - b[1], z, x - b[0], y - r - b[1], z, x - b[0], y + r - b[1], z); }
        if (g?.compound) for (const f of g.feeders) {                 // each feeder's chain of stations, then home to the compound
          const pts = [...f.stations.map(k => S[k]?.at).filter(Boolean), g.compound.at];
          for (let m = 1; m < pts.length; m++) v.push(pts[m - 1][0] - b[0], pts[m - 1][1] - b[1], lift, pts[m][0] - b[0], pts[m][1] - b[1], lift);
        }
      }), colours.stations);
    }
    // Cells within reach of the eye: L2 runs, L3 tables.
    const reach = CELL_BANDS.at(-1)[0] * HYSTERESIS;
    const i0 = Math.max(0, Math.floor((eye[0] - reach - G.x0) / G.cellM)), i1 = Math.min(G.cols - 1, Math.floor((eye[0] + reach - G.x0) / G.cellM));
    const j0 = Math.max(0, Math.floor((eye[1] - reach - G.y0) / G.cellM)), j1 = Math.min(G.rows - 1, Math.floor((eye[1] + reach - G.y0) / G.cellM));
    // L3 is one batch a cell; L2 runs are merged into one batch per 1 km group of 4 x 4 cells (draw calls stay under 80).
    const seen = new Set(), groups = new Map();
    const toGroup = c => { const g = Math.floor(Math.floor(c / G.cols) / GROUP) * 65536 + Math.floor((c % G.cols) / GROUP);
      if (!groups.has(g)) groups.set(g, []); groups.get(g).push(c); };
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const c = j * G.cols + i, ids = cellTables(pack, c);
      if (!ids.length) continue;
      seen.add(c);
      const box = cellBox(c), old = levels.get(c) ?? 1, want = cellLevel(boxDistance(eye, box), old);
      let shown = want;
      if (want === 3) {
        const e = get(K(`L3-${c}`), [box[0], box[1], box[2]], colours.tables, (v, b) => { for (const t of ids) outlineOf(pack, t, v, b); });
        if (e) { push(e, colours.tables); stats.levels[3]++; } else shown = old === 3 ? 1 : old; // keep the runs until the tables are built
      }
      if (shown === 2) toGroup(c);
      levels.set(c, shown);
    }
    for (const [g, cells] of groups) {
      cells.sort((a, b) => a - b);
      const gi = g % 65536, gj = Math.floor(g / 65536), base = [G.x0 + gi * GROUP * G.cellM, G.y0 + gj * GROUP * G.cellM, zMean];
      let e = get(K(`L2-${g}-${cells.join('.')}`), base, colours.runs, (v, b) => { for (const c of cells) for (const r of runsOf(pack, cellTables(pack, c))) runOutline(pack, r, v, b); });
      if (e) lastRuns.set(g, e.key); else if ((e = cache.get(lastRuns.get(g)) || null)) e.used = frame;   // the group's last runs until rebuilt
      if (e) { push(e, colours.runs); stats.levels[2] += cells.length; }
    }
    for (const c of [...levels.keys()]) if (!seen.has(c)) levels.delete(c);
    // L4: 50 m sub-cells near the eye, the module grid (and extra lines) of every table whose centre is inside.
    const S = DETAIL.subM, r4 = DETAIL.leaveM, hAbove = eye[2] - zMean;
    if (hAbove < r4 + 50) for (let sj = Math.floor((eye[1] - r4) / S); sj <= Math.floor((eye[1] + r4) / S); sj++)
      for (let si = Math.floor((eye[0] - r4) / S); si <= Math.floor((eye[0] + r4) / S); si++) {
        const key = `${si},${sj}`, box = [si * S, sj * S, zMean - 50, (si + 1) * S, (sj + 1) * S, zMean + 50], d = boxDistance(eye, box);
        const on = d < DETAIL.enterM || (detailOn.has(key) && d < DETAIL.leaveM);
        if (!on) { detailOn.delete(key); continue; }
        const ci = Math.floor((si * S + S / 2 - G.x0) / G.cellM), cj = Math.floor((sj * S + S / 2 - G.y0) / G.cellM);
        if (ci < 0 || cj < 0 || ci >= G.cols || cj >= G.rows) continue;
        const ids = [...cellTables(pack, cj * G.cols + ci)].filter(t => pack.x[t] >= box[0] && pack.x[t] < box[3] && pack.y[t] >= box[1] && pack.y[t] < box[4]);
        if (!ids.length) continue;
        const e = get(K(`L4-${key}`), [box[0], box[1], zMean], colours.detail, (v, b) => { for (const t of ids) { moduleGridOf(pack, t, v, b); extra?.(t, v, b); } });
        if (e) { detailOn.add(key); push(e, colours.detail); stats.levels[4]++; }
      }
    evict();
    stats.batches = out.length; stats.vertices = out.reduce((t, b) => t + b.positions.length / 3, 0); stats.bytes = bytes;
    if (stats.pending) onPending();
    return out;
  }
  // Frees every cached buffer (a new layout, or the plant cleared).
  function dispose() { for (const k of cache.keys()) release(k); cache.clear(); levels.clear(); detailOn.clear(); lastRuns.clear(); bytes = 0; }
  return { batches, dispose, stats: () => ({ ...stats, plantLevel: plant, cached: cache.size }) };
}
