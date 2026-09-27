// mv-network.mjs: the medium-voltage network from the stations to the grid, as equipment outlines with solids
// and cable routes, placed on the ground by the user.
//
// Input is a block diagram (plant-template.mjs: nodes and links) and, optionally, a route file in DRAWING
// coordinates (schema mv-routes.v1: node positions and cable polylines in the units of some drawing). This module
// never knows where a real site is: the user places the drawing with a transform (a point on the ground, metres
// per drawing unit, a rotation). Without a route file the diagram is laid out on a plain grid instead.
//
// Equipment sizes are generic and rounded (ring main unit, station skid, switchroom, grid transformer in its bund,
// cable sealing-end structure at the connection); they are outlines for scale, not any maker's product.
// Pure: no DOM. Imports only the placement helper.

import { placer } from './station.mjs';
import { layoutDiagram } from './plant-template.mjs';

export const ROUTES_SCHEMA = 'mv-routes.v1';

// Footprint w (across) x d (along) and height h, metres.
export const EQUIPMENT = Object.freeze({
  rmu: { w: 1.6, d: 0.9, h: 1.8, label: 'ring main unit' },
  station: { w: 6.1, d: 2.5, h: 2.9, label: 'station skid: transformer, LV and MV switchgear' },
  switchboard: { w: 20, d: 8, h: 4.5, label: 'MV switchroom' },
  'grid-transformer': { w: 10, d: 6, h: 7, label: 'grid transformer', bund: { w: 16, d: 12, h: 0.6 } },
  poc: { w: 4, d: 4, h: 9, label: 'connection structure (cable sealing ends)' }
});

/** Solids for one item: the body, plus a bund wall ring where the kind has one. */
export function equipmentSolids(kind, at = [0, 0, 0], heading = 0, id = kind) {
  const e = EQUIPMENT[kind];
  if (!e) throw new Error(`mv-network: unknown equipment kind ${kind}`);
  const P = placer(at, heading), out = [];
  const box = (part, min, max) => out.push(P.box({ kind, part, id, min, max }));
  box('body', [-e.w / 2, -e.d / 2, 0], [e.w / 2, e.d / 2, e.h]);
  if (e.bund) {                                        // four low walls round the transformer, 0.25 m thick
    const { w, d, h } = e.bund, t = 0.25, x = w / 2, y = d / 2;
    box('bund', [-x, -y, 0], [x, -y + t, h]); box('bund', [-x, y - t, 0], [x, y, h]);
    box('bund', [-x, -y, 0], [-x + t, y, h]); box('bund', [x - t, -y, 0], [x, y, h]);
  }
  return out;
}

/** Edge lines (x, y, z pairs) of placed solids: the rotated footprint at the base and the top, and the uprights. */
export function solidLines(solids) {
  const v = [];
  for (const s of solids) {
    const q = s.quad, z0 = s.min[2], z1 = s.max[2];
    for (let i = 0; i < 4; i++) {
      const a = q[i], b = q[(i + 1) % 4];
      v.push(a[0], a[1], z0, b[0], b[1], z0, a[0], a[1], z1, b[0], b[1], z1, a[0], a[1], z0, a[0], a[1], z1);
    }
  }
  return new Float32Array(v);
}

/** Validate a route file. Returns { units, nodes: Map(id -> [x, y]), links: [{ from, to, points }] } or throws. */
export function readRoutes(json) {
  if (!json || json.schema !== ROUTES_SCHEMA) throw new Error(`mv-network: route file schema must be "${ROUTES_SCHEMA}"`);
  const pt = p => Array.isArray(p) && p.length >= 2 && p.every(Number.isFinite);
  const nodes = new Map();
  for (const [id, p] of Object.entries(json.nodes || {})) { if (!pt(p)) throw new Error(`mv-network: node ${id} needs [x, y]`); nodes.set(id, [p[0], p[1]]); }
  const links = (json.links || []).map((l, i) => {
    if (!l || typeof l.from !== 'string' || typeof l.to !== 'string') throw new Error(`mv-network: link ${i + 1} needs from and to`);
    const points = l.points || [];
    if (!points.every(pt)) throw new Error(`mv-network: link ${i + 1} has a bad point`);
    return { from: l.from, to: l.to, points: points.map(p => [p[0], p[1]]) };
  });
  return { units: String(json.units || 'drawing'), yDown: json.y_down === true, nodes, links };
}

/**
 * drawingToGround({ at, metresPerUnit, heading, yDown }) -> (x, y) -> [east, north] local metres.
 * The drawing's first axis runs along the heading's right-hand side; y down (as in PDF sheets) is flipped.
 */
export function drawingToGround({ at = [0, 0], metresPerUnit = 1, heading = 0, yDown = false } = {}) {
  const c = Math.cos(heading), s = Math.sin(heading);
  return (x, y) => {
    const u = x * metresPerUnit, v = (yDown ? -y : y) * metresPerUnit;
    return [at[0] + u * c + v * s, at[1] - u * s + v * c];
  };
}

/**
 * placeNetwork(diagram, { routes, at, heading, metresPerUnit, spacing, groundAt })
 * -> { equipment: [{ id, kind, label, solids }], cables: [{ from, to, kv, mva, normallyOpen, points: [[x, y, z]] }], missing }
 * With routes: node positions and polylines from the file. Without: layoutDiagram on a `spacing` metre grid.
 */
export function placeNetwork(diagram, { routes = null, at = [0, 0], heading = 0, metresPerUnit = 1, spacing = 40, groundAt = () => 0 } = {}) {
  const map = routes
    ? drawingToGround({ at, metresPerUnit, heading, yDown: routes.yDown })
    : drawingToGround({ at, metresPerUnit: spacing, heading, yDown: true });
  const where = new Map(), missing = [];
  if (routes) for (const [id, p] of routes.nodes) where.set(id, map(p[0], p[1]));
  else for (const n of layoutDiagram(diagram)) where.set(n.id, map(n.x, n.y));
  const kindOf = n => (n.kind in EQUIPMENT ? n.kind : null);
  const equipment = [];
  for (const n of diagram.nodes) {
    const k = kindOf(n), p = where.get(n.id);
    if (!k) continue;
    if (!p) { missing.push(n.id); continue; }
    equipment.push({ id: n.id, kind: k, label: n.label, solids: equipmentSolids(k, [p[0], p[1], groundAt(p[0], p[1])], heading, n.id) });
  }
  const drawn = new Map();
  if (routes) for (const l of routes.links) drawn.set(`${l.from}>${l.to}`, l.points);
  const cables = [];
  for (const l of diagram.links) {
    const a = where.get(l.from), b = where.get(l.to);
    if (!a || !b) continue;
    const path = drawn.get(`${l.from}>${l.to}`) || [...(drawn.get(`${l.to}>${l.from}`) || [])].reverse();
    const plan = path.length ? path.map(p => map(p[0], p[1])) : [a, b];
    const depth = l.kv >= 100 ? 1.2 : 0.9;
    cables.push({ from: l.from, to: l.to, kind: l.kind, kv: l.kv, mva: l.mva, normallyOpen: !!l.normallyOpen,
      points: plan.map(([x, y]) => [x, y, groundAt(x, y) - (l.kind === 'mv-bus' || l.kind === 'station-tee' ? 0 : depth)]) });
  }
  return { equipment, cables, missing };
}

/** Line pairs for the cables of a placed network (optionally only one kind). */
export function cableLines(cables, kind = null) {
  const v = [];
  for (const c of cables) {
    if (kind && c.kind !== kind) continue;
    for (let i = 1; i < c.points.length; i++) v.push(...c.points[i - 1], ...c.points[i]);
  }
  return new Float32Array(v);
}
