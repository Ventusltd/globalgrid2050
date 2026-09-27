// Clash check: where a drawn trench, road, pad or table enters a buffer zone, with the rule and its sources.
// Pure: no DOM. Zones come from buildZones (buffers.mjs). The check is exact: it measures the true distance
// from the item to the zone's feature and compares it with the zone distance plus the item's half-width. The
// drawn zone outline is a polygon a little outside the exact zone (see offset.mjs), so an item that just
// touches the dashed line may pass here; the numbers here are the ones to trust.
//
// Items: { id, kind: 'trench' | 'road', points: [[x, y], ...], width? }  a path with a width
//        { id, kind: 'pad' | 'table', points: [[x, y], ...] }          a footprint outline
// Widths missing from a path fall back to ITEM_WIDTH, flagged as assumed in the report.

import { cleanPath, pointInRing } from './offset.mjs';

export const ITEM_WIDTH = { trench: 0.6, road: 4 };  // ASSUMED widths of drawn items without one, metres
export const STEP_M = 0.5;                           // path sampling for entry and exit chainages
const AREA_KINDS = new Set(['pad', 'table']);

function closestOnSeg(px, py, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
  const t = L2 ? Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / L2)) : 0;
  return [a[0] + dx * t, a[1] + dy * t];
}

function segsCross(a, b, c, d) {
  const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}

function segsOf(g) {
  const p = g.pts, closed = g.closed || g.area, out = [];
  if (p.length === 1) return [[p[0], p[0]]];
  for (let i = 0; i < (closed ? p.length : p.length - 1); i++) out.push([p[i], p[(i + 1) % p.length]]);
  return out;
}

// Pure: distance from a point to a geometry { pts, closed?, area? } (0 inside an area).
export function distToGeometry(g, x, y) {
  if (g.area && g.pts.length > 2 && pointInRing(g.pts, x, y)) return 0;
  let best = Infinity;
  for (const [a, b] of segsOf(g)) { const c = closestOnSeg(x, y, a, b); best = Math.min(best, Math.hypot(x - c[0], y - c[1])); }
  return best;
}

// Pure: least distance between two geometries, and the point on the first where it is reached.
export function geometryDistance(g, h) {
  const A = segsOf(g), B = segsOf(h);
  for (const [a, b] of A) for (const [c, d] of B) if (segsCross(a, b, c, d)) return { d: 0, at: crossing(a, b, c, d) };
  if (h.area && h.pts.length > 2 && pointInRing(h.pts, g.pts[0][0], g.pts[0][1])) return { d: 0, at: g.pts[0] };
  if (g.area && g.pts.length > 2 && pointInRing(g.pts, h.pts[0][0], h.pts[0][1])) return { d: 0, at: h.pts[0] };
  let best = { d: Infinity, at: null };
  const take = (dd, at) => { if (dd < best.d) best = { d: dd, at }; };
  for (const [a, b] of A) for (const [c, d] of B) {
    for (const p of [a, b]) { const q = closestOnSeg(p[0], p[1], c, d); take(Math.hypot(p[0] - q[0], p[1] - q[1]), p); }
    for (const p of [c, d]) { const q = closestOnSeg(p[0], p[1], a, b); take(Math.hypot(p[0] - q[0], p[1] - q[1]), q); }
  }
  return best;
}

function crossing(a, b, c, d) {
  const rx = b[0] - a[0], ry = b[1] - a[1], sx = d[0] - c[0], sy = d[1] - c[1];
  const t = ((c[0] - a[0]) * sy - (c[1] - a[1]) * sx) / (rx * sy - ry * sx);
  return [a[0] + rx * t, a[1] + ry * t];
}

// Pure: an item's core geometry and half-width. Paths keep their centreline; pads and tables their outline.
export function itemGeometry(item) {
  const area = AREA_KINDS.has(item.kind);
  const pts = cleanPath((item.points || item.pts || []).map(p => [p[0], p[1]]), area);
  if (area) return { core: { pts, closed: true, area: true }, half: 0, widthAssumed: false };
  const given = +item.width > 0, width = given ? +item.width : ITEM_WIDTH[item.kind] ?? ITEM_WIDTH.trench;
  return { core: { pts, closed: false, area: false }, half: width / 2, width, widthAssumed: !given };
}

// Pure: chainages along a path; the point at chainage s.
function chainage(pts) {
  const c = [0];
  for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return c;
}
function pointAt(pts, cum, s) {
  let i = 1;
  while (i < pts.length - 1 && cum[i] < s) i++;
  const f = cum[i] > cum[i - 1] ? Math.max(0, Math.min(1, (s - cum[i - 1]) / (cum[i] - cum[i - 1]))) : 0;
  return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f];
}

// Pure: stretches of a path whose centreline comes within reach of the geometry: [{ from_m, to_m }].
// Sampled every step metres (and at every vertex), each end refined by bisection to a millimetre.
export function insideStretches(pts, g, reach, step = STEP_M) {
  const cum = chainage(pts), L = cum[cum.length - 1];
  const f = s => { const p = pointAt(pts, cum, s); return distToGeometry(g, p[0], p[1]) - reach; };
  const ss = new Set(cum);
  for (let s = 0; s < L; s += step) ss.add(s);
  // The distance can dip below reach only around its minima: where a feature vertex projects onto the path, or
  // where a feature edge crosses it. Sampling those too means no narrow zone slips between two steps.
  const G = segsOf(g);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], len = cum[i] - cum[i - 1];
    if (!(len > 0)) continue;
    const at = q => ss.add(cum[i - 1] + Math.hypot(q[0] - a[0], q[1] - a[1]));
    for (const p of g.pts) at(closestOnSeg(p[0], p[1], a, b));
    for (const [c, d] of G) if (segsCross(a, b, c, d)) at(crossing(a, b, c, d));
  }
  const S = [...ss].sort((a, b) => a - b);
  const edge = (lo, hi) => { let flo = f(lo) < 0; while (hi - lo > 1e-3) { const m = (lo + hi) / 2; if ((f(m) < 0) === flo) lo = m; else hi = m; } return (lo + hi) / 2; };
  const out = [];
  let open = f(0) < 0 ? 0 : null;
  for (let i = 1; i < S.length; i++) {
    const inNow = f(S[i]) < 0;
    if (open === null && inNow) open = edge(S[i - 1], S[i]);
    else if (open !== null && !inNow) { out.push({ from_m: open, to_m: edge(S[i - 1], S[i]) }); open = null; }
  }
  if (open !== null) out.push({ from_m: open, to_m: L });
  return out.map(r => ({ ...r, at: pointAt(pts, cum, r.from_m) }));
}

const r2 = v => Math.round(v * 100) / 100;

// Pure: every place a drawn item enters a zone. A drawn item's own zone is skipped.
// Returns [{ item, itemKind, zone, layer, rule, kind, required_m, clearance_m, intrusion_m, at, stretches, parts,
//            sources, note, widthAssumed, message }], deepest first per item.
export function checkClashes(items, zones, { step = STEP_M } = {}) {
  const out = [];
  for (const item of Array.isArray(items) ? items : []) {
    if (!item) continue;
    const { core, half, widthAssumed } = itemGeometry(item);
    if (!core.pts.length) continue;
    const found = [];
    for (const z of zones) {
      if (z.layer === 'drawn' && String(z.feature) === String(item.id)) continue;
      const reach = z.distance + half, g = geometryDistance(core, z.geometry);
      if (!(g.d < reach - 1e-9)) continue;
      const stretches = core.area ? [] : insideStretches(core.pts, z.geometry, reach, step);
      const at = stretches.length ? stretches[0].at : g.at;
      const clearance = Math.max(0, g.d - half);
      const sources = [...new Set(z.parts.map(p => p.source))];
      const where = stretches.length ? ` from ${r2(stretches[0].from_m)} m to ${r2(stretches[0].to_m)} m along it` : '';
      found.push({
        item: item.id, itemKind: item.kind, zone: z.id, layer: z.layer, rule: z.rule, kind: z.kind,
        required_m: r2(z.distance), clearance_m: r2(clearance), intrusion_m: r2(reach - g.d), at: [r2(at[0]), r2(at[1])], stretches,
        parts: z.parts, sources, note: z.note, widthAssumed,
        message: `${item.kind || 'item'} ${item.id ?? ''} enters the ${z.rule} zone of ${z.id}${where}: ${r2(clearance)} m from the feature, `
          + `${r2(z.distance)} m required (${z.kind}; ${z.parts.map(p => `${p.m} m ${p.what}, ${p.kind}`).join('; ')})`
          + (widthAssumed ? '. Item width assumed' : '')
      });
    }
    out.push(...found.sort((a, b) => b.intrusion_m - a.intrusion_m));
  }
  return out;
}
