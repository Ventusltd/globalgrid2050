// build-geom.mjs: what build mode draws, as line groups in national-grid metres ({ base: [e, n, z], v: Float32Array
// relative to base }), and the piles of the built tables on the plant's own engine (plant-piles.mjs). Pure: no DOM.
// ground(e, n) is the ground to draw on (the design's ground; never NaN). Light: a table is 15 segments, a pile 1.

import { planTables, pileSummary, STRIDE } from './plant-piles.mjs';
import { tableOf } from './build-rules.mjs';

function group() { return { base: null, v: [] }; }
const put = (G, p) => { if (!G.base) G.base = [p[0], p[1], p[2]]; G.v.push(p[0] - G.base[0], p[1] - G.base[1], p[2] - G.base[2]); };
const seg = (G, a, b) => { put(G, a); put(G, b); };
const done = G => ({ base: G.base || [0, 0, 0], v: new Float32Array(G.v), count: G.v.length / 3 });

/** A table's frame on the ground: low edge, high edge, end rafters, the row joint (one string a row), posts at the ends. */
export function tableFrame(G, t, T, ground) {
  const e0 = t.e, e1 = t.e + T.len, n0 = t.n, n1 = t.n + T.depth, xs = [0, 0.25, 0.5, 0.75, 1].map(k => e0 + (e1 - e0) * k);
  const low = xs.map(e => [e, n0, ground(e, n0) + T.lowEdge]), high = xs.map(e => [e, n1, ground(e, n0) + T.lowEdge + T.rise]);
  const mid = xs.map((e, i) => [e, (n0 + n1) / 2, (low[i][2] + high[i][2]) / 2]);
  for (let i = 1; i < xs.length; i++) { seg(G, low[i - 1], low[i]); seg(G, high[i - 1], high[i]); seg(G, mid[i - 1], mid[i]); }
  for (const i of [0, xs.length - 1]) {
    seg(G, low[i], high[i]);
    seg(G, [xs[i], n0 + 0.2 * T.depth, ground(xs[i], n0 + 0.2 * T.depth)], [xs[i], n0 + 0.2 * T.depth, low[i][2] + 0.2 * T.rise]);
  }
}
/** A string inverter on its pole: a 1 x 0.5 x 1 m box, top 2.2 m up. */
export function inverterBox(G, v, ground) {
  const g = ground(v.e, v.n), z0 = g + 1.2, z1 = g + 2.2, c = [[-0.5, -0.25], [0.5, -0.25], [0.5, 0.25], [-0.5, 0.25]].map(([x, y]) => [v.e + x, v.n + y]);
  for (let i = 0; i < 4; i++) { const a = c[i], b = c[(i + 1) % 4]; seg(G, [...a, z0], [...b, z0]); seg(G, [...a, z1], [...b, z1]); seg(G, [...a, z0], [...a, z1]); }
  seg(G, [v.e, v.n + 0.3, g], [v.e, v.n + 0.3, z0]);
}
/** A plan outline a little above the ground (the ghost's footprint). */
export function outline(G, rect, ground, lift = 0.15) {
  const q = [[rect[0], rect[1]], [rect[2], rect[1]], [rect[2], rect[3]], [rect[0], rect[3]]];
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4], k = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 8));
    for (let j = 0; j < k; j++) {
      const p = [a[0] + (b[0] - a[0]) * j / k, a[1] + (b[1] - a[1]) * j / k], r = [a[0] + (b[0] - a[0]) * (j + 1) / k, a[1] + (b[1] - a[1]) * (j + 1) / k];
      seg(G, [...p, ground(...p) + lift], [...r, ground(...r) + lift]);
    }
  }
}
/** A home run on the ground (the DC trench line), a point every 5 m. */
export function run(G, pts, ground) {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], k = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 5));
    for (let j = 0; j < k; j++) {
      const p = [a[0] + (b[0] - a[0]) * j / k, a[1] + (b[1] - a[1]) * j / k], r = [a[0] + (b[0] - a[0]) * (j + 1) / k, a[1] + (b[1] - a[1]) * (j + 1) / k];
      seg(G, [...p, ground(...p) + 0.05], [...r, ground(...r) + 0.05]);
    }
  }
}

/**
 * sceneGroups(items, W, P, ground) -> { tables, inverters, strings, loose, runs } groups. strings: each connected string along its row;
 * loose: the strings of tables no inverter took (drawn red); runs: home runs to the inverters.
 */
export function sceneGroups(items, W, P, ground) {
  const T = tableOf(P), G = { tables: group(), inverters: group(), strings: group(), loose: group(), runs: group() };
  const byId = new Map(W.tables.map(t => [t.id, t]));
  for (const it of items) {
    if (it.kind === 'inverter') { inverterBox(G.inverters, it, ground); continue; }
    tableFrame(G.tables, it, T, ground);
    const w = byId.get(it.id), L = w && w.inverter !== null ? G.strings : G.loose;
    for (let r = 0; r < T.strings; r++) {                          // a string a row, 5 cm above the module face
      const f = (r + 0.5) / Math.max(1, T.strings), n = it.n + f * T.depth, z = e => ground(e, it.n) + T.lowEdge + f * T.rise + 0.05;
      seg(L, [it.e + 0.3, n, z(it.e)], [it.e + T.len - 0.3, n, z(it.e + T.len)]);
    }
    if (w?.run) run(G.runs, w.run, ground);
  }
  return Object.fromEntries(Object.entries(G).map(([k, g]) => [k, done(g)]));
}
/** The ghost: its footprint and, for a table, its frame. */
export function ghostGroup(check, P, ground) {
  const G = group();
  outline(G, check.rect, ground);
  if (check.kind === 'table') tableFrame(G, { e: check.at.e, n: check.at.n }, tableOf(P), ground);
  else inverterBox(G, check.at, ground);
  return done(G);
}

/**
 * Piles for the built tables on the plant's rules (plant-piles.mjs planTables: front and rear posts, reveal band, grading,
 * twist). measured(e, n): NaN where the ground is not measured (flagged, never filled in). Returns { summary, groups: { ok, flagged } }.
 */
export function builtPiles(items, P, measured) {
  const T = tableOf(P), tabs = items.filter(i => i.kind === 'table');
  if (!tabs.length) return null;
  const input = tabs.map(t => ({ length: T.len, depth: T.depth, rise: T.rise, lowEdgeM: T.lowEdge, eastWest: false, key: [t.n, t.e, t.e + T.len],
    lineAt: f => [[t.e, t.n + f * T.depth], [t.e + T.len, t.n + f * T.depth]] }));
  const it = planTables(input, { groundAt: measured, system: 'fixed', posts: 2, along: 'ew' });
  let r = it.next();
  while (!r.done) r = it.next();
  const res = r.value, summary = pileSummary(res, { mwp: tabs.length * T.kWp / 1000 }), ok = group(), flagged = group();
  for (const t of res.tables) for (let i = 0; i < t.n; i++) {
    const o = i * STRIDE, a = t.pa;
    seg(t.pf[i] & ~8 ? flagged : ok, [a[o], a[o + 1], a[o + 4]], [a[o], a[o + 1], a[o + 3]]); // 8: lengthened for lateral load, routine
  }
  return { summary, groups: { ok: done(ok), flagged: done(flagged) } };
}
