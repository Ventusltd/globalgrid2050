// Overhead line zones: corridors on the ground either side of each overhead line, and the design checks against them.
// Pure: no DOM. Local metres (x east, y north, z up). The conductors come from the grid layer (layer.wires()):
//   [{ line, cls, support: 'pole' | 'tower', span, conductor, from, to, a: [x, y, z], b: [x, y, z], param }]
// where a and b are the conductor's ends on the towers and param its catenary parameter (overhead.mjs).
// Tower heights and sag are ASSUMED by the grid layer, so every zone and flag here is illustrative. The distances
// and their sources are in ohl-gs6.mjs. A place with no flag is NOT ASSESSED: nothing here says a place is free of danger.
//
// Zone of a span: the plan outline of its two outermost conductors (a four-sided area), grown by
//   distance + sway + position allowance
// where distance is the barrier (GS6 para 19) or the zone (GS6 para 11, and the earlier edition's figure by support,
// whichever is larger), sway is sag x sin(swing) (assumed), and the position allowance covers inferred tower positions.

import { catenarySpan, levelSag } from './overhead.mjs';
import { geometryDistance, distToGeometry, insideStretches } from './clash.mjs';
import { offsetUnion } from './offset.mjs';
import { ZONES, SWAY, POSITION_ALLOWANCE, ITEM_HALF, PAD_RADIUS_M, ACTION, zoneDistance, exclusionFor } from './ohl-gs6.mjs';

export const SAMPLE_M = 2;        // design items are sampled this often for the working-height check
export const WIRE_STEP_M = 1;     // conductors are sampled this often near a sample point
const r1 = v => Math.round(v * 10) / 10;

// Pure: the sideways swing allowance of a conductor: its level-span mid sag x sin(swing), never under SWAY.minM.
export function swayOf(w) {
  const L = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
  if (!(L > 0) || !(w.param > 0)) return SWAY.minM;
  return Math.max(SWAY.minM, levelSag(L, w.param) * Math.sin(SWAY.swingDeg * Math.PI / 180));
}

// Pure: wires -> spans [{ id, line, span, cls, support, from, to, wires, quad, sway, barrierReach, zoneReach, exclusion }].
// quad: the plan outline of the two outermost conductors (a to a, b to b); a single conductor gives a segment.
export function buildSpans(wires) {
  const by = new Map();
  for (const w of Array.isArray(wires) ? wires : []) {
    if (!w || !Array.isArray(w.a) || !Array.isArray(w.b)) continue;
    const k = `${w.line}/${w.span}`;
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(w);
  }
  return [...by.values()].map(ws => {
    const w0 = ws[0], dx = w0.b[0] - w0.a[0], dy = w0.b[1] - w0.a[1], L = Math.hypot(dx, dy) || 1;
    const side = w => ((w.a[0] + w.b[0]) / 2 - w0.a[0]) * (-dy / L) + ((w.a[1] + w.b[1]) / 2 - w0.a[1]) * (dx / L);
    const sorted = ws.slice().sort((p, q) => side(p) - side(q)), lo = sorted[0], hi = sorted[sorted.length - 1];
    const quad = lo === hi ? { pts: [lo.a.slice(0, 2), lo.b.slice(0, 2)], closed: false, area: false }
      : { pts: [lo.a.slice(0, 2), lo.b.slice(0, 2), hi.b.slice(0, 2), hi.a.slice(0, 2)], closed: true, area: true };
    const sway = Math.max(...ws.map(swayOf)), extra = sway + POSITION_ALLOWANCE.m;
    return { id: `${w0.from}-${w0.to}`, line: w0.line, span: w0.span, cls: w0.cls, support: w0.support, from: w0.from, to: w0.to,
      wires: ws, quad, sway, barrierReach: ZONES.barrier.m + extra, zoneReach: zoneDistance(w0.support) + extra, exclusion: exclusionFor(w0.cls) };
  });
}

// Pure: the rings to draw, per line: { line, cls, zone: rings, barrier: rings }. The union of every span's grown quad.
export function zoneRings(spans, { segments = 16 } = {}) {
  const lines = new Map();
  for (const s of spans) { if (!lines.has(s.line)) lines.set(s.line, []); lines.get(s.line).push(s); }
  return [...lines.values()].map(ss => {
    const parts = key => ss.map(s => ({ pts: s.quad.pts, closed: s.quad.closed, area: s.quad.area, d: s[key] }));
    return { line: ss[0].line, cls: ss[0].cls, support: ss[0].support,
      zone: offsetUnion(parts('zoneReach'), { segments }).rings, barrier: offsetUnion(parts('barrierReach'), { segments }).rings };
  });
}

// Pure: a design item's plan geometry. items: [{ id, kind, pts: [[x, y], ...], area?, closed?, half? }] in local metres.
// area: a filled outline (a pad); closed: an outline only (a fence); neither: a path (trench, cable, road, piles, hdd).
export function itemShape(it) {
  const pts = (it.pts || []).filter(p => Number.isFinite(p?.[0]) && Number.isFinite(p?.[1])).map(p => [p[0], p[1]]);
  const area = !!it.area && pts.length > 2;
  let half = Number.isFinite(it.half) ? it.half : ITEM_HALF[it.kind] ?? 0.5;
  if (it.kind === 'pad' && pts.length < 3) half = Math.max(half, PAD_RADIUS_M); // a pad drawn by its centre: a disc
  return { core: { pts: it.kind === 'pad' && pts.length === 2 ? [pts[0]] : pts, closed: area || (!!it.closed && pts.length > 2), area }, half };
}

// Pure: sample points along an item every step metres (vertices included; a pad centre adds a ring of eight).
export function samplePoints(it, step = SAMPLE_M) {
  const { core, half } = itemShape(it), p = core.pts, out = [];
  if (p.length === 1) {
    out.push(p[0]);
    for (let k = 0; k < 8 && half > 0; k++) out.push([p[0][0] + half * Math.cos(k * Math.PI / 4), p[0][1] + half * Math.sin(k * Math.PI / 4)]);
    return out;
  }
  const n = core.closed ? p.length : p.length - 1;
  for (let i = 0; i < n; i++) {
    const a = p[i], b = p[(i + 1) % p.length], m = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let k = 0; k < m; k++) out.push([a[0] + (b[0] - a[0]) * k / m, a[1] + (b[1] - a[1]) * k / m]);
  }
  if (!core.closed) out.push(p[p.length - 1]);
  return out;
}

const cross2 = (a, b, c, d) => {
  const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
};
// Pure: where an item's path first crosses under a conductor of the span, or null.
export function crossingOf(core, span) {
  const n = core.closed ? core.pts.length : core.pts.length - 1;
  for (let i = 0; i < n; i++) {
    const a = core.pts[i], b = core.pts[(i + 1) % core.pts.length];
    for (const w of span.wires) if (cross2(a, b, w.a, w.b)) return [a, b];
  }
  return null;
}

// Pure: points at chainages along a polyline.
function pointAtChainage(pts, s) {
  let run = 0;
  for (let i = 1; i < pts.length; i++) {
    const L = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (run + L >= s || i === pts.length - 1) { const f = L > 0 ? Math.min(1, Math.max(0, (s - run) / L)) : 0;
      return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f]; }
    run += L;
  }
  return pts[0];
}

// Pure: goalpost positions for a road crossing a span: where its centreline (plus half-width) enters and leaves
// the barrier zone, one pair per passage. [{ at: [x, y], end: 'enter' | 'leave' }].
export function goalpostsFor(core, half, span) {
  const st = insideStretches(core.pts, span.quad, span.barrierReach + half);
  return st.flatMap(r => [{ at: pointAtChainage(core.pts, r.from_m), end: 'enter' }, { at: pointAtChainage(core.pts, r.to_m), end: 'leave' }]);
}

// Pure: the least distance from plant of height H standing at (x, y) on ground g to a span's conductors, allowing
// for sway and position (horizontal distance reduced by both). { d, wire, s } or null when no conductor is near.
export function plantReach(x, y, g, H, span, step = WIRE_STEP_M) {
  const slack = span.sway + POSITION_ALLOWANCE.m, top = g + H;
  let best = null;
  for (const w of span.wires) {
    const L = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
    if (!(L > 0)) continue;
    const ux = (w.b[0] - w.a[0]) / L, uy = (w.b[1] - w.a[1]) / L;
    const s0 = (x - w.a[0]) * ux + (y - w.a[1]) * uy, off = Math.abs((x - w.a[0]) * -uy + (y - w.a[1]) * ux);
    // Horizontal distance to any point of the wire is at least off, and more than window away along it is further.
    const window = span.exclusion + slack + step;
    if (off - slack >= span.exclusion || s0 < -window || s0 > L + window) continue;
    const c = catenarySpan(L, w.a[2], w.b[2], w.param);
    const lo = Math.max(0, s0 - window), hi = Math.min(L, s0 + window);
    for (let s = lo; s <= hi + 1e-9; s += step) {
      const cx = w.a[0] + ux * s, cy = w.a[1] + uy * s, z = c.z(s);
      const dh = Math.max(0, Math.hypot(x - cx, y - cy) - slack), dz = z > top ? z - top : z < g ? g - z : 0;
      const d = Math.hypot(dh, dz);
      if (!best || d < best.d) best = { d, wire: w, s, z };
    }
  }
  return best;
}

// Pure: every flag for the design. items as itemShape takes; spans from buildSpans; measuredAt(x, y) -> ground or NaN.
// opts.height: working height (user-set, metres). Returns { flags, goalposts, unmeasured } where each flag is
// { item, kind, flag: 'inside' | 'crosses' | 'height', span, at, message }.
export function checkDesign(items, spans, measuredAt = () => NaN, { height = 0 } = {}) {
  const flags = [], goalposts = [];
  let unmeasured = 0;
  for (const it of Array.isArray(items) ? items : []) {
    const { core, half } = itemShape(it);
    if (!core.pts.length) continue;
    const name = `${it.kind} ${it.id}`;
    for (const sp of spans) {
      const g = geometryDistance(core, sp.quad);
      if (!(g.d < sp.zoneReach + half)) continue;
      const path = !core.area && core.pts.length > 1, crossing = path ? crossingOf(core, sp) : null;
      flags.push({ item: it.id, kind: it.kind, flag: crossing ? 'crosses' : 'inside', span: sp.id, at: g.at || core.pts[0],
        message: `${name} ${crossing ? 'crosses under' : 'is inside'} the overhead line zone of span ${sp.id} (${sp.cls}): ${ACTION}` });
      if (crossing && it.kind === 'road') {
        for (const gp of goalpostsFor(core, half, sp)) goalposts.push({ item: it.id, span: sp.id, ...gp });
      }
    }
    if (!(height > 0)) continue;
    let worst = null;
    for (const p of samplePoints(it)) {
      const near = spans.filter(sp => distToGeometry(sp.quad, p[0], p[1]) < sp.zoneReach + height + sp.exclusion);
      if (!near.length) continue;
      const gz = measuredAt(p[0], p[1]);
      if (!Number.isFinite(gz)) { unmeasured++; continue; }
      for (const sp of near) {
        const r = plantReach(p[0], p[1], gz, height, sp);
        if (r && r.d < sp.exclusion && (!worst || r.d < worst.d)) worst = { ...r, sp, at: p };
      }
    }
    if (worst) flags.push({ item: it.id, kind: it.kind, flag: 'height', span: worst.sp.id, at: worst.at, reach_m: r1(worst.d),
      message: `${name}: plant ${r1(height)} m tall (user-set) would come within the ${worst.sp.exclusion} m exclusion distance `
        + `of a conductor on span ${worst.sp.id} (${worst.sp.cls}, conductor height assumed): ${ACTION}` });
  }
  return { flags, goalposts, unmeasured };
}

// Pure: the design snapshot (design-ui snapshot, national-grid metres) -> items in local metres.
export function designItems(design, origin) {
  const L = path => (path || []).filter(p => Number.isFinite(p?.e) && Number.isFinite(p?.n)).map(p => [p.e - origin.e, p.n - origin.n]);
  const out = [];
  (design?.trenches || []).forEach((t, i) => out.push({ id: `trench-${i + 1}`, kind: 'trench', pts: L(t.path) }));
  (design?.cables || []).forEach((c, i) => out.push({ id: `cable-${i + 1}`, kind: 'cable', pts: L(c.path) }));
  (design?.works || []).forEach((w, i) => {
    const pts = L(w.path), id = `${w.kind}-${i + 1}`;
    out.push({ id, kind: w.kind, pts, area: w.kind === 'pad' && pts.length > 2, closed: w.kind === 'fence' });
  });
  return out.filter(it => it.pts.length >= 1);
}
