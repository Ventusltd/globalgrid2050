// sld-symbols.mjs: the single-line diagram drawn in the world, as line groups in national-grid metres.
//
// Each element of the network graph (sld-graph.mjs) gets a small single-line symbol standing on a thin mast above
// where it is: a station's RMU with its three ways (incomer, outgoer, transformer breaker), its transformer (two
// circles) and LV board; the MV board sections with their bus ties (an open blade, drawn red), earthing transformer and
// NER; the grid transformers; the HV bay (disconnector, earth switch, surge arrester) and the landing bay. Feeder chains
// run RMU to RMU along the cable routes just above the ground; a normally-open point is marked red over its RMU; the
// HV connection runs to the landing. Symbols stand in a vertical plane facing the plan's south (x east, z up).
// Illustrative, not a design for any site. Pure: no DOM; groundAt(e, n) gives the ground (m).

import { rgba } from './elec-style.mjs';

const RING = 16;
// Colours by voltage level from the one table (elec-style.mjs).
const COLOUR = Object.freeze({ hv: rgba('hv'), mv: rgba('mv'), lv: rgba('lv'), open: rgba('open'), earth: rgba('earth') });

function group() { return { base: null, v: [] }; }
const put = (G, p) => { if (!G.base) G.base = [p[0], p[1], p[2]]; G.v.push(p[0] - G.base[0], p[1] - G.base[1], p[2] - G.base[2]); };
const seg = (G, a, b) => { put(G, a); put(G, b); };
const poly = (G, pts) => { for (let i = 1; i < pts.length; i++) seg(G, pts[i - 1], pts[i]); };

// Drawing in a symbol's own plane: (x, z) metres from its anchor [e, n, z0].
const pen = (G, [e, n, z0]) => ({
  line: (x0, z0a, x1, z1) => seg(G, [e + x0, n, z0 + z0a], [e + x1, n, z0 + z1]),
  circle: (x, z, r) => poly(G, Array.from({ length: RING + 1 }, (_, k) => [e + x + r * Math.cos(2 * Math.PI * k / RING), n, z0 + z + r * Math.sin(2 * Math.PI * k / RING)])),
  box: (x, z, w, h) => poly(G, [[e + x, n, z0 + z], [e + x + w, n, z0 + z], [e + x + w, n, z0 + z + h], [e + x, n, z0 + z + h], [e + x, n, z0 + z]]),
  zig: (x, z0b, z1, k = 6, w = 0.25) => poly(G, Array.from({ length: k + 1 }, (_, i) => [e + x + (i % 2 ? w : -w) * (i && i < k ? 1 : 0), n, z0 + z0b + (z1 - z0b) * i / k]))
});
// A switch in a vertical way from z0 to z1 at x: closed is a straight line; open is a blade swung aside.
function sw(P, x, za, zb, open, breaker = false) {
  const m = (za + zb) / 2;
  P.line(x, za, x, m - 0.25); P.line(x, m + 0.25, x, zb);
  if (open) P.line(x, m - 0.25, x + 0.35, m + 0.2); else P.line(x, m - 0.25, x, m + 0.25);
  if (breaker) P.box(x - 0.15, m - 0.15, 0.3, 0.3);
}
const earth = (P, x, z) => { P.line(x - 0.3, z, x + 0.3, z); P.line(x - 0.2, z - 0.12, x + 0.2, z - 0.12); P.line(x - 0.1, z - 0.24, x + 0.1, z - 0.24); };

/**
 * symbolGroups(graph, { groundAt, mast = 6 }) -> { mv, hv, lv, open, earth }: each { base: [e, n, z] | null, v: [] }.
 * Nodes without a position are left out (a generic plant has none until it is laid out).
 */
export function symbolGroups(g, { groundAt = () => 0, mast = 6 } = {}) {
  const G = { mv: group(), hv: group(), lv: group(), open: group(), earth: group() };
  const at = (n, h = mast) => { const [e, nn] = n.at; return [e, nn, groundAt(e, nn) + h]; };
  const stem = (L, n, h = mast) => { const [e, nn] = n.at, z = groundAt(e, nn); seg(L, [e, nn, z], [e, nn, z + h]); };
  const byId = new Map(g.nodes.map(n => [n.id, n]));
  const openAt = new Set(g.branches.filter(b => b.kind === 'feeder-cable' && b.open).flatMap(b => [b.from, b.to]));
  for (const n of g.nodes) {
    if (!n.at) continue;
    if (n.kind === 'rmu') {                                     // box, incomer / outgoer switches, transformer breaker
      stem(G.mv, n); const P = pen(G.mv, at(n));
      P.box(-1.2, 0, 2.4, 1.8); P.line(-1.2, 1.4, 1.2, 1.4);
      sw(P, -0.8, 0, 1.4, false); sw(openAt.has(n.id) ? pen(G.open, at(n)) : P, 0, 0, 1.4, openAt.has(n.id)); sw(P, 0.8, 0, 1.4, false, true);
      if (openAt.has(n.id)) { const Q = pen(G.open, at(n)); Q.box(-1.4, -0.2, 2.8, 2.2); }
    } else if (n.kind === 'st-hv') {                           // transformer: two circles, then the LV board bar below
      const P = pen(G.mv, at(n, mast + 3)), L = pen(G.lv, at(n, mast + 3));
      stem(G.mv, n, mast + 2); P.circle(0, 1.3, 0.6); L.circle(0, 0.5, 0.6); L.line(-1, -0.3, 1, -0.3); L.line(0, -0.1, 0, -0.3);
      for (const x of [-0.8, -0.3, 0.2, 0.7]) L.line(x, -0.3, x, -0.8);
    } else if (n.kind === 'mv-board') {                         // busbar, ways dropping, earthing on the left
      stem(G.mv, n, mast + 2); const P = pen(G.mv, at(n, mast + 2)), E = pen(G.earth, at(n, mast + 2));
      P.line(-3, 0, 3, 0);
      for (let x = -2; x <= 2; x += 1) sw(P, x, -1.6, 0, false, true);
      E.line(-3, 0, -3.6, 0); E.zig(-3.6, -0.2, -1.4); E.box(-3.8, -2.2, 0.4, 0.7); earth(E, -3.6, -2.4);
    } else if (n.kind === 'gt-lv') {
      stem(G.hv, n, mast + 4); const P = pen(G.hv, at(n, mast + 4)), M = pen(G.mv, at(n, mast + 4));
      P.circle(0, 1.2, 1); M.circle(0, 0, 1);
    } else if (n.kind === 'hv-bay') {                          // disconnector, earth switch, surge arrester
      const P = pen(G.hv, at(n, mast + 9)), E = pen(G.earth, at(n, mast + 9));
      sw(P, 0, 0, 2.4, false); P.line(0, 1.9, 0.9, 1.9); sw(E, 0.9, 0.6, 1.9, true); earth(E, 0.9, 0.6);
      P.line(0, 0.5, -0.9, 0.5); E.box(-1.1, -0.5, 0.4, 0.8); earth(E, -0.9, -0.6);
    } else if (['gis-bay', 'tower', 'dno-sub', 'none'].includes(n.kind)) {
      stem(G.hv, n, mast + 12); const P = pen(G.hv, at(n, mast + 12)); P.box(-1.5, 0, 3, 2.4); sw(P, 0, 0, 2.4, false, true);
    } else if (n.kind === 'hv-bus') { stem(G.hv, n, mast + 11); pen(G.hv, at(n, mast + 11)).line(-2, 0, 2, 0); }
  }
  // Ties between board sections: an open blade between neighbouring bus ends.
  for (const b of g.branches.filter(x => x.kind === 'bus-tie')) {
    const a = byId.get(b.from), c = byId.get(b.to);
    if (!a?.at || !c?.at) continue;
    const pa = at(a, mast + 2), pc = at(c, mast + 2), m = [(pa[0] + pc[0]) / 2, (pa[1] + pc[1]) / 2, pa[2] + 0.6];
    poly(G.open, [pa, [m[0] - 0.3, m[1], m[2]]]); seg(G.open, [m[0] - 0.3, m[1], m[2]], [m[0] + 0.3, m[1], m[2] + 0.5]); poly(G.open, [[m[0] + 0.3, m[1], m[2]], pc]);
  }
  // Feeder chains and the HV connection just above the ground along their routes (straight where no route is known).
  const lift = (pts, h) => pts.map(q => [q[0], q[1], groundAt(q[0], q[1]) + h]);
  for (const b of g.branches) {
    const a = byId.get(b.from), c = byId.get(b.to);
    if (b.kind === 'feeder-cable') { const pts = b.path ? lift(b.path, 0.4) : a?.at && c?.at ? lift([a.at, c.at], 0.4) : null; if (pts) poly(b.open ? G.open : G.mv, pts); }
    if ((b.kind === 'hv-cable' || b.kind === 'ohl-tee') && a?.at && c?.at) poly(G.hv, lift(b.path || [a.at, c.at], b.kind === 'ohl-tee' ? 28 : 0.4));
    if (b.kind === 'hv-bay' || b.kind === 'mv-incomer' || b.kind === 'rmu-tx') {
      if (a?.at && c?.at && Math.hypot(a.at[0] - c.at[0], a.at[1] - c.at[1]) > 1) poly(b.kind === 'rmu-tx' ? G.mv : G.hv, lift([a.at, c.at], 0.4));
    }
  }
  return G;
}

/** The Follow path as one glowing line, plus a marker over the current stop. */
export function glowGroup(points, marker = null) {
  const G = group();
  poly(G, points.map(q => [q[0], q[1], q[2] + 0.15]));
  if (marker) { const [e, n, z] = marker; seg(G, [e, n, z], [e, n, z + 8]); for (let k = 0; k < RING; k++) {
    const a = 2 * Math.PI * k / RING, b = 2 * Math.PI * (k + 1) / RING; seg(G, [e + 1.2 * Math.cos(a), n + 1.2 * Math.sin(a), z + 8], [e + 1.2 * Math.cos(b), n + 1.2 * Math.sin(b), z + 8]); } }
  return G;
}

export const SYMBOL_COLOURS = COLOUR;
export const GLOW = rgba('glow');
