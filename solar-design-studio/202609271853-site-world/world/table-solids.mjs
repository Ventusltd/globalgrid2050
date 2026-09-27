// Design tables as solids: land on a table's face when jumping (jump.mjs supportAt), never walk or fly through one
// (views.mjs blocked). Each table of the plant layout is cut into STRIPS thin slabs across its depth; a slab's top is
// the highest point of the module face over that strip, THICK_M deep, so the feet follow the tilt to within a strip.
// Axis-aligned boxes fit exactly in plan: the layout frame is north-south or east-west (plant-layout.mjs frameOf).
// Near the viewer only: tables are indexed once per layout in CELL_M cells and a frame asks for those within RADIUS_M,
// so a 500 MW plant costs a few dozen boxes a frame. Face heights: the piles' fitted surface where piled, else the
// drawn rule (low edge over the ground, the rise to the high edge), as plant-ui.mjs draws them. ILLUSTRATIVE geometry.

import { trackerHub } from './pile-rules.mjs';

export const STRIPS = 4, THICK_M = 0.08, RADIUS_M = 40, CELL_M = 50;

// Heights of the face at the low edge (a), the middle (m) and the far edge (b) of a table, each [at ua, at ub].
function edgesOf(r, q, hub) {
  const T = r.table, P = r.params, t = r.tables, lo = P.lowEdgeM, hi = lo + T.rise, pr = r.piles?.tables?.[q / 6];
  const [h0, h1, h2, h3] = [t[q + 2], t[q + 3], t[q + 4], t[q + 5]];
  if (pr?.edges) return pr.edges;
  if (T.tracker) { const z = [(h0 + h3) / 2 + hub, (h1 + h2) / 2 + hub]; return [z, z, z]; }
  return [[h0 + lo, h1 + lo], [(h0 + h3) / 2 + hi, (h1 + h2) / 2 + hi], T.south ? [h3 + hi, h2 + hi] : [h3 + lo, h2 + lo]];
}

// The face height at fraction fu along the row and fv across it: linear low to high edge (south), up to the ridge and
// down again (east-west), flat (tracker at stow).
function faceAt(T, [Ea, Em, Eb], fu, fv) {
  const at = E => E[0] + (E[1] - E[0]) * fu;
  if (T.south) return at(Ea) + (at(Eb) - at(Ea)) * fv;
  return fv <= 0.5 ? at(Ea) + (at(Em) - at(Ea)) * fv * 2 : at(Em) + (at(Eb) - at(Em)) * (fv - 0.5) * 2;
}

/** tableSlabs(r, { hub }) -> Float64Array of slabs [e0, n0, e1, n1, top] in national-grid metres (plan box and top). */
export function tableSlabs(r, { hub = trackerHub().hub, strips = STRIPS } = {}) {
  const T = r?.table, t = r?.tables, F = r?.frame;
  if (!T || !t || !F) return new Float64Array(0);
  const out = new Float64Array(t.length / 6 * strips * 5);
  let k = 0;
  for (let q = 0; q < t.length; q += 6) {
    const ua = t[q], va = t[q + 1], ub = ua + (r.tableLen?.[q / 6] ?? T.lenU), E = edgesOf(r, q, hub);
    for (let s = 0; s < strips; s++) {
      const f0 = s / strips, f1 = (s + 1) / strips, v0 = va + T.depth * f0, v1 = va + T.depth * f1;
      const top = Math.max(...[f0, f1, 0.5].filter(f => f >= f0 && f <= f1).flatMap(f => [faceAt(T, E, 0, f), faceAt(T, E, 1, f)]));
      const [e0, n0] = F.en(ua, v0), [e1, n1] = F.en(ub, v1);
      out.set([Math.min(e0, e1), Math.min(n0, n1), Math.max(e0, e1), Math.max(n0, n1), top], k); k += 5;
    }
  }
  return out;
}

/** createIndex(slabs) -> near(e, n, radius) -> the slab offsets (into slabs) whose plan box comes within radius. */
export function createIndex(slabs, cell = CELL_M) {
  const cells = new Map(), key = (i, j) => `${i},${j}`;
  for (let k = 0; k < slabs.length; k += 5) {
    for (let i = Math.floor(slabs[k] / cell); i <= Math.floor(slabs[k + 2] / cell); i++)
      for (let j = Math.floor(slabs[k + 1] / cell); j <= Math.floor(slabs[k + 3] / cell); j++) {
        const c = cells.get(key(i, j)); if (c) c.push(k); else cells.set(key(i, j), [k]);
      }
  }
  return (e, n, radius) => {
    const seen = new Set();
    for (let i = Math.floor((e - radius) / cell); i <= Math.floor((e + radius) / cell); i++)
      for (let j = Math.floor((n - radius) / cell); j <= Math.floor((n + radius) / cell); j++)
        for (const k of cells.get(key(i, j)) || [])
          if (slabs[k] <= e + radius && slabs[k + 2] >= e - radius && slabs[k + 1] <= n + radius && slabs[k + 3] >= n - radius) seen.add(k);
    return [...seen];
  };
}

/** Boxes { min, max } in local metres (x = e - origin.e, y = n - origin.n; z absolute) within radius of local (x, y). */
export function boxesNear(slabs, near, origin, [x, y], radius = RADIUS_M) {
  return near(x + origin.e, y + origin.n, radius).map(k => ({
    min: [slabs[k] - origin.e, slabs[k + 1] - origin.n, slabs[k + 4] - THICK_M],
    max: [slabs[k + 2] - origin.e, slabs[k + 3] - origin.n, slabs[k + 4]], kind: 'table' }));
}

/** mountTableSolids({ api, plant }): adds the plant's tables to the substrate's solids (api.hooks.solids). */
export function mountTableSolids({ api, plant, hub = trackerHub().hub }) {
  let built = { version: -1, slabs: null, near: null };
  const source = pos => {
    const v = plant?.version?.() ?? 0, r = plant?.result?.();
    if (!r) return [];
    if (built.version !== v) { const slabs = tableSlabs(r, { hub }); built = { version: v, slabs, near: createIndex(slabs) }; }
    return boxesNear(built.slabs, built.near, api.origin(), pos);
  };
  (api.hooks.solids ||= new Set()).add(source);
  return { source, slabs: () => built.slabs };
}
