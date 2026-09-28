// COPIED UNCHANGED from world/v12 block-build.mjs at v12 commit 3adcee9 (file last changed 604729d). Modular star family: public #146332 padEarthworks.
// Do not edit here: change the source and re-copy. Everything below this header is byte-identical to the source.
// block-build.mjs: the owner's 10 MVA solar block (station.mjs, ported from his explorer) placed on the measured
// ground, with the 33 kV rings to the grid (block-mv.mjs), as line groups ordered for the build sequence.
//
// Station 1 is drawn in full: 23 paired tables whose frames follow the ground (the frame height is the ground
// averaged across the table at every pile line, so it rides the terrain gently), piles from the frame down to the
// ground measured at each pile, every string's 30 modules in series, 28 pole inverters, the 1,344 DC home cables and
// 84 AC phase cables along his routes, lowered into the trenches at his depths, and the two 5 MVA transformers on a
// levelled pad. Stations 2 to N are the same block, drawn as table outlines, pad and transformers.
// Positions are national-grid metres (e, n, height); each group keeps them relative to its own base point.
// marks[i] is the vertex count once item i is drawn, so the sequence shows a prefix without copying anything.
// Pure: no DOM. ground(e, n) is the measured ground (NaN where none); fallback(e, n) answers there instead.

import { station, tableShape, tableOrigin, dcHomeRoutes, STATION_DEFAULTS as SD } from './station.mjs';
import { mvChain } from './block-mv.mjs';
import { build as cableBuild } from './cable-rating.mjs';
import { EQUIPMENT } from './mv-network.mjs';
import { planPiles } from './piles.mjs';
import { PILE_RULES as PR, revealBand } from './pile-rules.mjs';
import { blockTrenches, BLOCK_DC_ISC_A } from './block-trenches.mjs';

export { BLOCK_DC_ISC_A };

const PILE_LINES = 19;            // pile lines along a table, every 5 modules
const PAD_MARGIN = 12;            // station pad: 12 m round the transformers (the explorer's compound)

function group() { return { base: null, v: [], marks: [] }; }
const put = (G, p) => { if (!G.base) G.base = [p[0], p[1], p[2]]; G.v.push(p[0] - G.base[0], p[1] - G.base[1], p[2] - G.base[2]); };
const seg = (G, a, b) => { put(G, a); put(G, b); };
const poly = (G, pts) => { for (let i = 1; i < pts.length; i++) seg(G, pts[i - 1], pts[i]); };
const mark = G => G.marks.push(G.v.length / 3);
const box = (G, [x, y, z], w, d, h) => {
  const c = [[x - w / 2, y - d / 2], [x + w / 2, y - d / 2], [x + w / 2, y + d / 2], [x - w / 2, y + d / 2]];
  for (let i = 0; i < 4; i++) { const a = c[i], b = c[(i + 1) % 4]; seg(G, [...a, z], [...b, z]); seg(G, [...a, z + h], [...b, z + h]); seg(G, [...a, z], [...a, z + h]); }
};
const median = a => { const s = a.filter(Number.isFinite).sort((p, q) => p - q); return s.length ? s[Math.floor(s.length / 2)] : NaN; };

// The block's pile totals for the readout and the bill (embedment provisional).
const pileTotals = P => ({ revealAdjust: P.summary.revealAdjust, outsideBand: P.summary.revealHigh + P.summary.revealLow,
  twistTables: P.summary.twistTables, gradingTables: P.summary.tablesNeedingGrading, cutM3: P.summary.cutM3, fillM3: P.summary.fillM3,
  totalPileLengthM: P.summary.totalPileLengthM, embeddedM: P.piles.reduce((t, p) => t + p.embed, 0), embedM: P.assumed.embedMin,
  revealAdjustM: P.assumed.revealAdjust, twistTolDeg: P.assumed.twistTolDeg });

/** Level pad over a rectangle: the median ground, and cut and fill on a 1 m grid (bank m3). */
export function padEarthworks(g, e0, n0, e1, n1, level = null) {
  const hs = [];
  for (let n = n0 + 0.5; n < n1; n += 1) for (let e = e0 + 0.5; e < e1; e += 1) hs.push(g(e, n));
  const z = level ?? median(hs);
  let cut = 0, fill = 0, unmeasured = 0;
  for (const h of hs) { if (!Number.isFinite(h)) { unmeasured++; continue; } if (h > z) cut += h - z; else fill += z - h; }
  return { level: z, cut, fill, unmeasured, area: (e1 - e0) * (n1 - n0) };
}

/**
 * buildBlock({ anchor: [e, n], ground, fallback, stations, pocKv, towers, gpuPads, trench }) -> { groups, cables, trenches, summary }
 * towers: [{ e, n, kv }] grid towers to connect to; gpuPads: [{ poly: [[e, n]...], level, cut, fill }] optional.
 * trench: { soilKmW, load, split: { dc, branch, collector, mv }, cover: { dc, lv, mv }, drumM, ring } for sizing the trenches by rating
 * (block-trenches.mjs); defaults when left out.
 */
export function buildBlock({ anchor, ground, fallback = () => NaN, stations = 4, pocKv = 400, towers = [], gpuPads = [], topology = 'radial',
  connection = 'cable', modulesPerString = SD.modulesPerString, trench = {} }) {
  const [E, N] = anchor;
  let unmeasured = 0;
  const g = (e, n) => { const h = ground(e, n); if (Number.isFinite(h)) return h; unmeasured++; const f = fallback(e, n); return Number.isFinite(f) ? f : 0; };
  // Modules in series are the owner's to change: each table row keeps its three strings, so the table is 3 strings long.
  const mps = Math.round(modulesPerString) || SD.modulesPerString, s = { ...SD, modulesPerString: mps, columns: mps * SD.columns / SD.modulesPerString };
  const st = station(s, { corners: false }), T = tableShape(s), t = s.tilt * Math.PI / 180;
  const mv = mvChain({ stations, stationMVA: st.inventory.aggregateInverterMVA, pocKv, topology });
  const G = {}; for (const k of ['outline', 'tables', 'strings', 'inverters', 'station', 'others', 'rmu', 'grid', 'open']) G[k] = group();

  // ---- tables: frame height per pile line from the ground across the table, piles to the ground at each pile ----
  const zLocal = x => { const d = Math.abs(x) - T.halfRidgeGap; return s.height + Math.max(0, T.depth - d) * Math.tan(t); };
  const frames = [], piles = { count: 0, min: Infinity, max: -Infinity }, lowEdge = { min: Infinity };
  for (let n = 0; n < s.tables; n++) {
    const [x0, y0] = tableOrigin(n, s), ys = Array.from({ length: PILE_LINES }, (_, k) => y0 + k * T.span / (PILE_LINES - 1));
    // The frame sits on the highest ground under either low edge or the ridge, so the lowest module edge keeps its
    // height at every pile line; smoothing may only raise it, never drop an edge towards the ground.
    const edge = T.halfRidgeGap + T.depth, raw = ys.map(y => Math.max(g(E + x0 - edge, N + y), g(E + x0 + edge, N + y), g(E + x0, N + y)));
    const sm = raw.map((_, k) => Math.max(raw[k], (raw[Math.max(0, k - 1)] + raw[k] + raw[Math.min(raw.length - 1, k + 1)]) / 3));
    frames.push({ x0, y0, ys, sm });
  }
  const baseOf = (n, y) => {
    const F = frames[n], u = Math.min(Math.max((y - F.y0) / T.span, 0), 1) * (PILE_LINES - 1), k = Math.min(PILE_LINES - 2, Math.floor(u));
    return F.sm[k] + (F.sm[k + 1] - F.sm[k]) * (u - k);
  };
  const onTable = (n, x, y) => [E + x, N + y, baseOf(n, y) + zLocal(x - frames[n].x0)];
  // Piles, automatic, on the shared rules (pile-rules.mjs): each post line under the owner's frame, its tops where the
  // frame puts them, checked for reveal (band and head adjustment), grading, embedment and twist by piles.mjs.
  const gq = (e, n) => { const h = ground(e, n); if (Number.isFinite(h)) return h; const f = fallback(e, n); return Number.isFinite(f) ? f : 0; };
  const pileRows = [];
  frames.forEach((F, n) => { for (const side of [-1, 1]) [0.2, 0.8].forEach((k, j) => {
    const x = side * (T.halfRidgeGap + T.depth * k), top = y => baseOf(n, y) + zLocal(x) - 0.12, id = `${n}:${side}:${j}`;
    pileRows.push({ id, line: [[E + F.x0 + x, N + F.ys[0]], [E + F.x0 + x, N + F.ys[PILE_LINES - 1]]], tops: F.ys.map(top),
      reveal: revealBand(zLocal(x) - 0.12), ...(j ? {} : { pair: { with: `${n}:${side}:1`, depth: T.depth * 0.6 } }) });
  }); });
  const plan = planPiles({ rows: pileRows, groundAt: gq, system: 'fixed', tableLength: T.span, tableGap: 0, pileSpacing: T.span / (PILE_LINES - 1) * (1 - 1e-12),
    embedMin: PR.embedM, embedToReveal: PR.embedToReveal, gradingWidth: PR.gradingWidthM, revealAdjust: PR.revealAdjustM, twistTolDeg: PR.twistTolDeg, limits: { along: 'ns' } });
  frames.forEach((F, n) => {
    const at = (x, y, z) => [E + F.x0 + x, N + y, baseOf(n, y) + z];
    for (const side of [-1, 1]) {
      const edge = (off, dz) => F.ys.map(y => at(side * off, y, dz)), g2 = T.halfRidgeGap;
      for (let r = 0; r <= s.rows; r++) {                       // outer low edge, row joints, ridge edge
        const v = r * (s.moduleLength + s.moduleGap) - (r ? s.moduleGap / 2 : 0), off = g2 + T.depth - v * Math.cos(t);
        poly(G.tables, edge(off, s.height + v * Math.sin(t)));
      }
      for (let c = 0; c <= s.columns; c++) {                    // module joints across the face
        const y = F.y0 + Math.min(T.span, c * (s.moduleWidth + s.moduleGap));
        seg(G.tables, at(side * (g2 + T.depth), y, s.height), at(side * g2, y, T.ridge));
      }
      for (const j of [0, 1]) for (const p of plan.rows.find(r => r.id === `${n}:${side}:${j}`).tables[0].piles) { // front, rear posts
        g(p.x, p.y); seg(G.tables, [p.x, p.y, Math.min(p.ground, p.finishedGround)], [p.x, p.y, p.top]);
        piles.count++; piles.min = Math.min(piles.min, p.reveal); piles.max = Math.max(piles.max, p.reveal);
      }
      for (const y of F.ys) { const p = at(side * (g2 + T.depth), y, s.height); lowEdge.min = Math.min(lowEdge.min, p[2] - g(p[0], p[1])); }
    }
    mark(G.tables);
  });

  // ---- strings: 30 modules in series through their terminals, in build order (table by table) ----
  for (const x of st.strings) { poly(G.strings, x.modules.map(m => onTable(x.table, m.terminal[0], m.terminal[1]))); mark(G.strings); }

  // ---- inverters on poles: box, pole to the ground ----
  const invBase = st.inverters.map(i => g(E + i.point[0], N + i.point[1]));
  st.inverters.forEach((inv, i) => {
    const [x, y, z] = inv.point, b = invBase[i];
    box(G.inverters, [E + x, N + y, b + z - 1], 1, 0.5, 1); seg(G.inverters, [E + x, N + y + 0.3, b], [E + x, N + y + 0.3, b + z]); mark(G.inverters);
  });

  // ---- station pads (level, cut and fill), transformers and RMUs; stations 2..N as outlines ----
  const txs = s.transformers, px0 = Math.min(...txs.map(p => p[0])) - PAD_MARGIN, px1 = Math.max(...txs.map(p => p[0])) + PAD_MARGIN;
  const py0 = Math.min(...txs.map(p => p[1])) - PAD_MARGIN, py1 = Math.max(...txs.map(p => p[1])) + PAD_MARGIN;
  const pads = mv.stations.map(S => {
    const [ox, oy] = S.offset, pad = padEarthworks(g, E + ox + px0, N + oy + py0, E + ox + px1, N + oy + py1);
    const L = S.index ? G.others : G.station, z = pad.level;
    const q = [[px0, py0], [px1, py0], [px1, py1], [px0, py1]].map(([x, y]) => [E + ox + x, N + oy + y, z]);
    for (let i = 0; i < 4; i++) { seg(L, q[i], q[(i + 1) % 4]); seg(L, [q[i][0], q[i][1], z + 2.4], [q[(i + 1) % 4][0], q[(i + 1) % 4][1], z + 2.4]); }
    for (const p of txs) box(L, [E + ox + p[0], N + oy + p[1], z], 4, 4, 3);
    box(G.rmu, [E + S.rmu[0], N + S.rmu[1], z], EQUIPMENT.rmu.w, EQUIPMENT.rmu.d, EQUIPMENT.rmu.h); mark(G.rmu);
    if (S.index) for (const F of frames) for (const side of [-1, 1]) {
      const a = [F.x0 + side * (T.halfRidgeGap + T.depth), F.x0 + side * T.halfRidgeGap], yy = [F.y0, F.y0 + T.span / 2, F.y0 + T.span];
      const at = (x, y, h) => [E + ox + x, N + oy + y, g(E + ox + x, N + oy + y) + h];
      poly(L, yy.map(y => at(a[0], y, s.height))); poly(L, yy.map(y => at(a[1], y, T.ridge)));
      seg(L, at(a[0], yy[0], s.height), at(a[1], yy[0], T.ridge)); seg(L, at(a[0], yy[2], s.height), at(a[1], yy[2], T.ridge));
    }
    if (!S.index) mark(G.station);
    return { id: S.id, ...pad };
  });
  const padOf = S => pads[S.index].level;

  // ---- cables: his routes, lifted onto the tables, into the trench (depth below the ground) and up the poles ----
  // Along a trench the cable follows the ground at its depth: a point every 5 m.
  const buried = (a, b) => { const k = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 5)), out = [];
    for (let j = 1; j < k; j++) { const x = a[0] + (b[0] - a[0]) * j / k, y = a[1] + (b[1] - a[1]) * j / k; out.push([E + x, N + y, g(E + x, N + y) + a[2]]); }
    return out; };
  const lift = (pts, table, inv, endZ) => pts.flatMap((p, i) => {
    const pre = i && p[2] < 0 && pts[i - 1][2] < 0 ? buried(pts[i - 1], p) : [];
    if (p[2] < 0) return [...pre, [E + p[0], N + p[1], g(E + p[0], N + p[1]) + p[2]]];
    if (inv != null && (i >= pts.length - 2 || Math.hypot(p[0] - st.inverters[inv].point[0], p[1] - st.inverters[inv].point[1]) < 0.8))
      return [[E + p[0], N + p[1], invBase[inv] + p[2]]];
    if (table != null) return [[E + p[0], N + p[1], baseOf(table, p[1]) + p[2]]];
    return [[E + p[0], N + p[1], endZ + p[2]]];
  });
  const byIndex = new Map(st.strings.map(x => [x.index, x]));
  const dc = dcHomeRoutes(st.strings, st.inverters.map(i => i.point), s).map(r => ({ id: r.id, inverter: r.inverter,
    points: lift(r.points, byIndex.get(r.string).table, r.inverter) }));
  const ac = st.acCables.map((c, i) => { const inv = Math.floor(i / 3), p = c.points, first = [E + p[0][0], N + p[0][1], invBase[inv] + p[0][2]];
    return { id: c.id, inverter: inv, points: [first, ...lift(p.slice(1), null, null, padOf(mv.stations[0]))] }; });
  const odMv = a => cableBuild(a).od;
  const mvCables = mv.circuits.map(cc => {
    const pts = [];
    for (let i = 1; i < cc.plan.length; i++) {
      const [a, b] = [cc.plan[i - 1], cc.plan[i]], k = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 10));
      for (let j = i === 1 ? 0 : 1; j <= k; j++) { const x = a[0] + (b[0] - a[0]) * j / k, y = a[1] + (b[1] - a[1]) * j / k; pts.push([E + x, N + y, g(E + x, N + y) - 0.85]); }
    }
    return { id: cc.id, ring: cc.ring, normallyOpen: cc.normallyOpen, areaMm2: cc.areaMm2, points: pts };
  });
  // Normally-open points: a ring on the RMU switch that is left open.
  for (const r of mv.rings.filter(x => x.openAt)) { const S = mv.stations.find(x => x.id === r.openAt), z = padOf(S) + EQUIPMENT.rmu.h;
    for (const h of [2.5, 4]) box(G.open, [E + S.rmu[0], N + S.rmu[1], z + h - 0.75], 0.8, 0.8, 0.75); mark(G.open); }

  // ---- substation compound: switchroom, grid transformer(s) in bunds, connection structure (line tee as an option) ----
  const C = mv.compound, cE = E + C.x, cN = N + C.y;
  const gpu = gpuPads.find(p => inside(p.poly, cE, cN));
  const cpad = padEarthworks(g, cE - C.w / 2, cN - C.d / 2, cE + C.w / 2, cN + C.d / 2, gpu ? gpu.level : null);
  if (gpu) Object.assign(cpad, { cut: gpu.cut, fill: gpu.fill, source: 'GPU pad run (read-only)' });
  const cz = cpad.level, fence = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [cE + a * C.w / 2, cN + b * C.d / 2, cz]);
  for (let i = 0; i < 4; i++) { seg(G.grid, fence[i], fence[(i + 1) % 4]); seg(G.grid, [...fence[i].slice(0, 2), cz + 2.4], [...fence[(i + 1) % 4].slice(0, 2), cz + 2.4]); }
  const sw = EQUIPMENT.switchboard; box(G.grid, [E + mv.board[0], N + mv.board[1], cz], sw.d, sw.w, sw.h);
  const gt = EQUIPMENT['grid-transformer'];
  for (const [x, y] of mv.grid.at) { box(G.grid, [E + x, N + y, cz], gt.w, gt.d, gt.h); box(G.grid, [E + x, N + y, cz], gt.bund.w, gt.bund.d, gt.bund.h); }
  const P = [E + mv.poc.at[0], N + mv.poc.at[1]], poc = EQUIPMENT.poc; box(G.grid, [...P, cz], poc.w, poc.d, poc.h);
  // The HV connection runs as a fully ducted cable: down from the transformer, buried, and up the connection structure.
  for (const [x, y] of mv.grid.at) poly(G.grid, [[E + x + gt.w / 2, N + y, cz + gt.h - 1], [E + x + gt.w / 2, N + y, cz - 1.1], [P[0], P[1], cz - 1.1], [P[0], P[1], cz + poc.h]]);
  const line = towers.filter(w => w.kv >= pocKv).map(w => ({ ...w, d: Math.hypot(w.e - P[0], w.n - P[1]) })).sort((a, b) => a.d - b.d)[0] || null;
  // The default landing is a ducted HV cable to the substation's bay (drawn by the single-line diagram, sld-symbols.mjs);
  // the overhead tee into the nearest tower is an option, off by default.
  if (connection === 'ohl-tee' && line && line.d <= 3000) for (const o of [-3, 0, 3]) seg(G.grid, [P[0] + o, P[1], cz + poc.h], [line.e + o, line.n, g(line.e, line.n) + 28]);
  mark(G.grid);

  // ---- outline of the whole plant (pegged out before the build starts) ----
  const W = Math.max(...frames.map(F => F.x0)) + T.depth + 1, H = Math.max(...frames.map(F => F.y0)) + T.span + 1;
  for (const S of mv.stations) {
    const [ox, oy] = S.offset, q = [[-T.depth - 1, -3], [W, -3], [W, H], [-T.depth - 1, H]].map(([x, y]) => [E + ox + x, N + oy + y]);
    for (let i = 0; i < 4; i++) { const a = q[i], b = q[(i + 1) % 4]; seg(G.outline, [...a, g(...a) + 0.3], [...b, g(...b) + 0.3]); }
  }
  mark(G.outline);
  const ohl = overheadClearance(anchor, mv.stations, towers);

  const works = blockTrenches(st, mv, E, N, odMv, trench, s), trenches = works.items;
  const groups = {};
  for (const [k, L] of Object.entries(G)) groups[k] = { base: L.base || [E, N, 0], v: new Float32Array(L.v), marks: L.marks };
  const inv = st.inventory;
  return { groups, cables: { dc, ac, mv: mvCables }, trenches, trenchPlan: works.plan, mv, station: st, pads, compoundPad: cpad, connection: line, onTable, // onTable: module detail
    summary: { inventory: inv, blockKwp: inv.installedModules * s.moduleW / 1000, piles: { ...piles, ...pileTotals(plan) }, lowEdgeMin: lowEdge.min,
      unmeasured, pads, compoundPad: cpad, connection: line ? { kv: line.kv, distanceM: line.d } : null, overhead: ohl } };
}

/**
 * Overhead lines over the field: the closest any table corner of any station comes to a span (consecutive towers
 * of one voltage, under 600 m apart). stations: mvChain(...).stations or a count. Null when no span is loaded.
 */
export function overheadClearance([E, N], stations, towers) {
  const T = tableShape(SD), list = typeof stations === 'number' ? mvChain({ stations }).stations : stations;
  const spans = towers.slice(1).map((w, i) => [towers[i], w]).filter(([a, b]) => a.kv === b.kv && Math.hypot(b.e - a.e, b.n - a.n) < 600);
  let best = null;
  for (const S of list) for (let n = 0; n < SD.tables; n++) for (const [x, y] of [[-1, 0], [1, 0], [-1, 1], [1, 1]]) {
    const [x0, y0] = tableOrigin(n, SD), pe = E + S.offset[0] + x0 + x * (T.depth + T.halfRidgeGap), pn = N + S.offset[1] + y0 + y * T.span;
    for (const [a, b] of spans) {
      const dx = b.e - a.e, dy = b.n - a.n, k = Math.min(1, Math.max(0, ((pe - a.e) * dx + (pn - a.n) * dy) / (dx * dx + dy * dy)));
      const d = Math.hypot(pe - a.e - k * dx, pn - a.n - k * dy);
      if (!best || d < best.distanceM) best = { kv: a.kv, distanceM: d };
    }
  }
  return best;
}

/** The counts readout for one block, as the owner's explorer states them, plus the MV chain. */
export function blockCounts(b) {
  const i = b.summary.inventory;
  return { tables: i.tables, tableKwp: i.tableKwp, blockKwp: b.summary.blockKwp, strings: i.totalStrings, connectedStrings: i.connectedStrings,
    spareStrings: i.spareStrings, inverters: i.inverters, stringsPerInverter: [...new Set(i.stringsPerInverter)], inverterKVA: i.inverterKVA,
    transformers: i.transformers, transformerMVA: i.transformerMVA, stationMVA: i.aggregateTransformerMVA, acPhaseCables: i.acPhaseCables,
    dcHomeCables: i.dcHomeCables, dcRoutes: b.cables.dc.length, acRoutes: b.cables.ac.length, stations: b.mv.stations.length,
    rings: b.mv.rings.length, gridTransformers: b.mv.grid.units, gridMVA: b.mv.grid.mva, pocKv: b.mv.poc.kv };
}

const inside = (poly, x, y) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
};
