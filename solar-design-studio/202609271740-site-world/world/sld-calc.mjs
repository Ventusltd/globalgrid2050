// sld-calc.mjs: load flow, fault level and readouts on the single-line network (sld-graph.mjs), in the page.
//
// The network runs radially (open ties and open ring hops carry nothing), so it is solved by a back/forward sweep
// from the grid source: inverters inject their rated output at the export power factor; the back sweep adds the
// currents up towards the grid; the forward sweep walks the voltages out from the source, until they settle.
// Fault level at each node by the simple impedance method (IEC 60909 style: c = 1.1, pre-fault load and the inverters'
// own contribution neglected): Zth = source + the series impedance on the path to the grid. The GPU pair
// (tools/gpu/sld_pair.py) solves the same graph two other ways; the tests hold these readouts to them.
// Every value is illustrative, not a design for any site. Pure.

import { C } from './sld-rules.mjs';

/** The tree: BFS from GRID over closed branches. Throws on a closed loop; lists nodes the grid cannot reach. */
export function treeOf(g) {
  const adj = new Map(g.nodes.map(n => [n.id, []]));
  for (const b of g.branches) if (!b.open) { adj.get(b.from).push(b); adj.get(b.to).push(b); }
  const parent = new Map([['GRID', null]]), via = new Map(), order = ['GRID'], depth = new Map([['GRID', 0]]);
  for (let i = 0; i < order.length; i++) {
    const u = order[i];
    for (const b of adj.get(u)) {
      if (b === via.get(u)) continue;
      const v = b.from === u ? b.to : b.from;
      if (parent.has(v)) throw Error(`sld: closed loop through ${b.id}`);
      parent.set(v, u); via.set(v, b); depth.set(v, depth.get(u) + 1); order.push(v);
    }
  }
  const unreached = g.nodes.map(n => n.id).filter(id => !parent.has(id));
  return { parent, via, order, depth, unreached };
}

/**
 * solve(g) -> { V: Map id -> [re, im] pu, J: Map branchId -> current pu towards the grid (grid side of any tap),
 * Zth: Map id -> [r, x], iterations }. A branch with tap t (an on-load tap changer at its lower-voltage end, the
 * `to` node) is an ideal 1:t ratio behind its series impedance: V_to = t (V_from + z t J), J_from = t J.
 */
export function solve(g, { tol = 1e-12, maxIter = 100 } = {}) {
  const t = treeOf(g), S = new Map(g.nodes.map(n => [n.id, n.s])), V = new Map(t.order.map(id => [id, [1, 0]]));
  const J = new Map(), Zth = new Map([['GRID', [0, 0]]]), tap = id => t.via.get(id).tap || 1;
  for (const id of t.order.slice(1)) { const k = tap(id); Zth.set(id, C.mul([k * k, 0], C.add(Zth.get(t.parent.get(id)), t.via.get(id).z))); }
  let it = 0;
  for (; it < maxIter; it++) {
    const acc = new Map();
    for (let i = t.order.length - 1; i > 0; i--) {                 // back sweep: injections summed towards the grid
      const id = t.order[i], s = S.get(id), own = s[0] || s[1] ? C.conj(C.div(s, V.get(id))) : [0, 0];
      const I = C.mul([tap(id), 0], C.add(own, acc.get(id) || [0, 0])), up = t.parent.get(id);
      J.set(t.via.get(id).id, I); acc.set(up, C.add(acc.get(up) || [0, 0], I));
    }
    let worst = 0;
    for (const id of t.order.slice(1)) {                            // forward sweep: export raises the far end
      const v = C.mul([tap(id), 0], C.add(V.get(t.parent.get(id)), C.mul(t.via.get(id).z, J.get(t.via.get(id).id))));
      worst = Math.max(worst, C.abs(C.sub(v, V.get(id)))); V.set(id, v);
    }
    if (worst < tol) break;
  }
  for (const b of g.branches) if (b.open) J.set(b.id, [0, 0]);
  return { V, J, Zth, iterations: it + 1, tree: t };
}

const iBaseKA = (sb, kv) => sb / (Math.sqrt(3) * kv);
// The grid transformers' on-load taps hold the MV boards near 1.0 pu; station transformer taps are off-load and left at
// nominal, so a node more than this far above the landing is still flagged (inverters trip near 1.1 pu).
export const RISE_FLAG_PCT = 5;
export const RISE_NOTE = 'more than 5 % above the landing: station off-load taps (left at nominal here) would be set to bring it down';

/**
 * readouts(g, sol) -> { nodes: Map id -> {...}, branches: Map id -> {...} }, all illustrative:
 * node: kv, vPu, riseToLandingPct (above the landing, as the plant exports), faultKA, faultMVA
 * branch: loadMVA, currentA, areaMm2, lengthM, dropPct (along it, towards the grid), ratingA, utilisation
 */
export function readouts(g, sol) {
  const sb = g.params.sBaseMVA, c = g.params.c, vl = C.abs(sol.V.get('LAND')), nodes = new Map(), branches = new Map();
  for (const n of g.nodes) {
    const v = sol.V.get(n.id), z = sol.Zth.get(n.id), f = z && C.abs(z) > 0 ? c / C.abs(z) : Infinity;
    nodes.set(n.id, { kv: n.kv, vPu: v ? C.abs(v) : null, riseToLandingPct: v ? (C.abs(v) - vl) * 100 : null,
      faultKA: v ? f * iBaseKA(sb, n.kv) : null, faultMVA: v ? f * sb : null, label: n.label,
      high: !!v && (C.abs(v) - vl) * 100 > RISE_FLAG_PCT });
  }
  for (const b of g.branches) {
    const j = sol.J.get(b.id) || [0, 0], down = sol.tree.parent.get(b.to) === b.from ? b.to : b.from, up = down === b.to ? b.from : b.to;
    const vd = sol.V.get(down), vu = sol.V.get(up), I = C.abs(j) * iBaseKA(sb, b.kv) * 1000;
    branches.set(b.id, { kv: b.kv, open: b.open, loadMVA: vd ? C.abs(vd) * C.abs(j) / (b.tap || 1) * sb : 0, tap: b.tap ?? null, currentA: I, areaMm2: b.areaMm2 ?? null,
      lengthM: b.lengthM ?? null, dropPct: vd && vu && !b.open ? (C.abs(vd) - C.abs(vu)) * 100 : 0, ratingA: b.ratingA ?? null,
      utilisation: b.ratingA ? I / b.ratingA : null, label: b.label || b.kind, down, up });
  }
  return { nodes, branches };
}

/**
 * setTaps(g): each branch with an on-load tap changer (oltc: { range, step, target }) gets the tap, in whole steps
 * within its range, that holds its lower-voltage end nearest the target (the MV board at 1.0 pu). Written to b.tap.
 */
export function setTaps(g) {
  const list = g.branches.filter(b => b.oltc);
  for (const b of list) b.tap = 1;
  for (let pass = 0; list.length && pass < 12; pass++) {
    const sol = solve(g);
    let moved = false;
    for (const b of list) {
      const { range, step, target } = b.oltc, vInt = C.abs(sol.V.get(b.to)) / b.tap;
      const k = Math.max(-Math.round(range / step), Math.min(Math.round(range / step), Math.round((target / vInt - 1) / step)));
      const next = Math.round((1 + k * step) * 1e6) / 1e6;
      if (next !== b.tap) { b.tap = next; moved = true; }
    }
    if (!moved) break;
  }
  return g;
}

/** The path from a node up to the landing: [{ node, branch }] from the node itself to LAND (branch into each node). */
export function tracePath(g, sol, id) {
  const t = sol.tree, out = [];
  if (!t.parent.has(id)) return out;
  for (let u = id; u && u !== 'GRID'; u = t.parent.get(u)) out.push({ node: u, branch: u === 'LAND' ? null : t.via.get(u).id });
  return out;
}

/**
 * checkGraph(g) -> { ok, problems, stations, reachOnce } : every station's inverters reach the landing over exactly one
 * closed path (a tree, no loops, nothing stranded), every ring has exactly one open hop, every tie is open.
 */
export function checkGraph(g) {
  const problems = [];
  let t = null;
  try { t = treeOf(g); } catch (e) { problems.push(e.message); }
  if (t && t.unreached.length) problems.push(`not connected: ${t.unreached.slice(0, 5).join(', ')}`);
  const feeders = new Map();
  for (const b of g.branches.filter(x => x.kind === 'feeder-cable')) { const f = feeders.get(b.feeder) || { open: 0, hops: 0 }; f.hops++; f.open += b.open; feeders.set(b.feeder, f); }
  const rings = [...feeders].filter(([, f]) => f.open);
  for (const [id, f] of rings) if (f.open !== 1) problems.push(`${id}: ${f.open} open hops`);
  if (g.branches.some(b => b.kind === 'bus-tie' && !b.open)) problems.push('a bus tie is closed');
  const inv = g.nodes.filter(n => n.kind === 'inverter');
  const reachOnce = t ? inv.every(n => { let k = 0; for (let u = n.id; u; u = t.parent.get(u)) if (u === 'LAND') k++; return k === 1; }) : false;
  if (!reachOnce) problems.push('an inverter does not reach the landing exactly once');
  return { ok: !problems.length, problems, stations: g.nodes.filter(n => n.kind === 'rmu').length, inverters: inv.length, reachOnce,
    rings: rings.length };
}
