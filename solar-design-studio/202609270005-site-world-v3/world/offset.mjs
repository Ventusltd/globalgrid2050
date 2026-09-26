// Offsetting of points, polylines and polygons: the zone of all ground within d metres of a feature.
// Pure: no imports, no DOM. Coordinates are local metres (x east, y north); any consistent plane works.
//
// Method: the zone is the union of convex pieces, one disc at every vertex and one rectangle along every
// segment (plus the polygon itself for an area). Every piece edge is split where it crosses an edge of another
// piece; a split piece is kept when its midpoint lies strictly inside no other piece. The kept pieces are then
// chained into rings. This never forms an offset by moving edges and mitring corners, so concave corners,
// notches narrower than 2d, hairpins, self-crossing lines and holes all come out right with no special cases.
//
// Discs are regular polygons circumscribed about the true circle (every edge touches it), so the drawn zone
// always contains the exact zone and is at most d * (1 / cos(pi / segments) - 1) larger: 0.48 % of d at 32.
// The arc vertices sit on one grid of angles rotated by ANGLE_PHASE, so two discs never share an edge by
// chance and square, axis-aligned input never lines up with an arc edge. Rings: outer anticlockwise, holes clockwise.

export const ARC_SEGMENTS = 32;
export const ANGLE_PHASE = 0.1234567;
const EPS = 1e-9;

const cross = (ax, ay, bx, by) => ax * by - ay * bx;
const isPt = p => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]);

// Pure: signed area of a ring (anticlockwise positive). The ring is not closed by repeating its first point.
export function ringArea(ring) {
  let s = 0;
  for (let i = 0, n = ring.length; i < n; i++) { const a = ring[i], b = ring[(i + 1) % n]; s += a[0] * b[1] - b[0] * a[1]; }
  return s / 2;
}

// Pure: even-odd point in ring.
export function pointInRing(ring, x, y) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Pure: drops non-finite and repeated points and straight-through middle points. A closed ring loses a repeated
// closing point. A doubling-back point (a spike) is kept: it is a real turn.
export function cleanPath(pts, closed = false) {
  let p = (Array.isArray(pts) ? pts : []).filter(isPt).map(q => [+q[0], +q[1]]);
  p = p.filter((q, i) => i === 0 || Math.hypot(q[0] - p[i - 1][0], q[1] - p[i - 1][1]) > EPS);
  if (closed && p.length > 1 && Math.hypot(p[0][0] - p[p.length - 1][0], p[0][1] - p[p.length - 1][1]) <= EPS) p.pop();
  let changed = true;
  while (changed && p.length > 2) {
    changed = false;
    const n = p.length;
    for (let i = closed ? 0 : 1; i < (closed ? n : n - 1); i++) {
      const a = p[(i - 1 + n) % n], b = p[i], c = p[(i + 1) % n];
      const ux = b[0] - a[0], uy = b[1] - a[1], vx = c[0] - b[0], vy = c[1] - b[1];
      const lu = Math.hypot(ux, uy), lv = Math.hypot(vx, vy);
      if (Math.abs(cross(ux, uy, vx, vy)) <= EPS * lu * lv && ux * vx + uy * vy > 0) { p.splice(i, 1); changed = true; break; }
    }
  }
  return p;
}

// Convex anticlockwise piece: { pts, box, id }. Region: a non-convex area polygon, tested even-odd.
function piece(pts, id) {
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  return { pts, id, box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] };
}

function disc(c, d, n) {
  const R = d / Math.cos(Math.PI / n), out = [];
  for (let k = 0; k < n; k++) { const a = ANGLE_PHASE + (2 * Math.PI * k) / n; out.push([c[0] + R * Math.cos(a), c[1] + R * Math.sin(a)]); }
  return out;
}

function rect(a, b, d) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = -(b[1] - a[1]) / L * d, ny = (b[0] - a[0]) / L * d;
  return [[a[0] - nx, a[1] - ny], [b[0] - nx, b[1] - ny], [b[0] + nx, b[1] + ny], [a[0] + nx, a[1] + ny]];
}

// Pure: the convex pieces and area regions whose union is the zone of the given parts.
// part: { pts, closed?: bool, area?: bool, d } (area implies closed; a single point is a disc).
export function pieces(parts, { segments = ARC_SEGMENTS } = {}) {
  const out = [], areas = [];
  for (const part of parts) {
    const d = +part.d, closed = !!(part.closed || part.area);
    if (!(d > 0)) continue;
    const p = cleanPath(part.pts, closed);
    if (!p.length) continue;
    for (const v of p) out.push(piece(disc(v, d, segments), out.length));
    const m = closed && p.length > 2 ? p.length : p.length - 1;
    for (let i = 0; i < m; i++) out.push(piece(rect(p[i], p[(i + 1) % p.length], d), out.length));
    if (part.area && p.length > 2) areas.push(ringArea(p) >= 0 ? p : p.slice().reverse());
  }
  return { pieces: out, areas };
}

// Where is (x, y) against a convex anticlockwise piece? 1 strictly inside, 0 outside, or the edge it lies on.
function locate(pc, x, y) {
  const P = pc.pts, n = P.length;
  if (x < pc.box[0] - EPS || x > pc.box[2] + EPS || y < pc.box[1] - EPS || y > pc.box[3] + EPS) return 0;
  let on = null;
  for (let i = 0; i < n; i++) {
    const a = P[i], b = P[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const sd = cross(b[0] - a[0], b[1] - a[1], x - a[0], y - a[1]) / L;
    if (sd < -EPS) return 0;
    if (sd <= EPS) on = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
  }
  return on || 1;
}

// A uniform grid over boxes, so each lookup meets only nearby edges and pieces.
function makeGrid(h) {
  const cells = new Map(), key = (i, j) => i * 1e6 + j;
  const range = (lo, hi) => [Math.floor(lo / h), Math.floor(hi / h)];
  return {
    h, cells,
    add(box, v) {
      const [i0, i1] = range(box[0], box[2]), [j0, j1] = range(box[1], box[3]);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
        const k = key(i, j); let c = cells.get(k); if (!c) cells.set(k, c = []); c.push(v);
      }
    },
    at(x, y) { return cells.get(key(Math.floor(x / h), Math.floor(y / h))) || []; },
    cellOf(x, y) { return key(Math.floor(x / h), Math.floor(y / h)); }
  };
}

function segHit(e, f) {
  const rx = e.b[0] - e.a[0], ry = e.b[1] - e.a[1], sx = f.b[0] - f.a[0], sy = f.b[1] - f.a[1];
  const den = cross(rx, ry, sx, sy);
  if (Math.abs(den) < EPS * Math.hypot(rx, ry) * Math.hypot(sx, sy)) return null; // parallel: no single crossing
  const qx = f.a[0] - e.a[0], qy = f.a[1] - e.a[1], t = cross(qx, qy, sx, sy) / den, u = cross(qx, qy, rx, ry) / den;
  if (t < -EPS || t > 1 + EPS || u < -EPS || u > 1 + EPS) return null;
  return { t: Math.min(1, Math.max(0, t)), u: Math.min(1, Math.max(0, u)), p: [e.a[0] + rx * t, e.a[1] + ry * t] };
}

// Pure: the boundary of the union of convex pieces (and area regions), as rings. With inside (a ring), the
// result is instead that ring minus the union: an inward offset.
export function unionRings({ pieces: pcs, areas = [] }, { inside = null } = {}) {
  if (!pcs.length) return [];
  // Grid cell: the median piece size, so long rectangles span several cells but discs sit in one or two.
  const sizes = pcs.map(pc => Math.max(pc.box[2] - pc.box[0], pc.box[3] - pc.box[1])).sort((a, b) => a - b);
  const span = sizes[sizes.length >> 1];
  const edges = [];
  for (const pc of pcs) pc.pts.forEach((a, i) => {
    const b = pc.pts[(i + 1) % pc.pts.length];
    edges.push({ a, b, id: pc.id, cuts: [], box: [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])] });
  });
  const eg = makeGrid(Math.max(span, 1e-6)), pg = makeGrid(Math.max(span, 1e-6));
  edges.forEach((e, i) => eg.add(e.box, i));
  pcs.forEach(pc => pg.add(pc.box, pc.id));
  // Split every edge where it crosses an edge of another piece. Each crossing is recorded once: in the cell
  // that holds the crossing point, which is the same point object on both edges.
  for (const [cell, list] of eg.cells) {
    for (let x = 0; x < list.length; x++) for (let y = x + 1; y < list.length; y++) {
      const e = edges[list[x]], f = edges[list[y]];
      if (e.id === f.id || e.box[0] > f.box[2] || f.box[0] > e.box[2] || e.box[1] > f.box[3] || f.box[1] > e.box[3]) continue;
      const hit = segHit(e, f);
      if (!hit || eg.cellOf(hit.p[0], hit.p[1]) !== cell) continue;
      e.cuts.push([hit.t, hit.p]); f.cuts.push([hit.u, hit.p]);
    }
  }
  const kept = [];
  for (const e of edges) {
    const cuts = e.cuts.sort((p, q) => p[0] - q[0]), pts = [e.a, ...cuts.map(c => c[1]), e.b];
    const dx = e.b[0] - e.a[0], dy = e.b[1] - e.a[1], L = Math.hypot(dx, dy);
    for (let i = 0; i < pts.length - 1; i++) {
      const p = pts[i], q = pts[i + 1];
      if (Math.hypot(q[0] - p[0], q[1] - p[1]) <= EPS) continue;
      const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
      let covered = areas.some(r => pointInRing(r, mx, my));
      for (const id of covered ? [] : pg.at(mx, my)) {
        if (id === e.id) continue;
        const w = locate(pcs[id], mx, my);
        // On another piece's edge: running the same way, the lower id keeps it; running the other way, the
        // two pieces meet there and it is interior to the union.
        if (w === 1 || (w && (w[0] * dx + w[1] * dy < 0 || id < e.id))) { covered = true; break; }
      }
      if (covered) continue;
      if (inside) { if (pointInRing(inside, mx, my)) kept.push([q, p]); }
      else kept.push([p, q]);
    }
  }
  return chain(kept);
}

const k = p => p[0] + ',' + p[1];

// Pure: joins directed pieces [start, end] into closed rings. An open chain (a numerical dead end) is dropped.
function chain(segs) {
  const from = new Map();
  segs.forEach((s, i) => { const key = k(s[0]); if (!from.has(key)) from.set(key, []); from.get(key).push(i); });
  const used = new Uint8Array(segs.length), rings = [];
  for (let s = 0; s < segs.length; s++) {
    if (used[s]) continue;
    const ring = [], startKey = k(segs[s][0]);
    let i = s, ok = false;
    while (i !== undefined) {
      used[i] = 1; ring.push(segs[i][0]);
      const endKey = k(segs[i][1]);
      if (endKey === startKey) { ok = true; break; }
      i = (from.get(endKey) || []).find(j => !used[j]);
    }
    if (ok && ring.length >= 3) rings.push(cleanPath(ring, true));
  }
  return rings.filter(r => r.length >= 3 && Math.abs(ringArea(r)) > EPS);
}

// Pure: the zone within d of a polyline (closed: false), a closed outline (closed: true, the band either side)
// or an area (area: true, the polygon and all within d of it). A single point gives a disc.
// d < 0 with area: true shrinks the polygon instead (an inward setback). Returns { rings, area }.
export function offset(pts, d, { closed = false, area = false, segments = ARC_SEGMENTS } = {}) {
  let rings;
  if (d < 0) {
    if (!area) throw Error('offset: a negative distance needs an area');
    const ring = cleanPath(pts, true), r = ringArea(ring) >= 0 ? ring : ring.slice().reverse();
    rings = unionRings(pieces([{ pts: r, closed: true, d: -d }], { segments }), { inside: r });
  } else {
    rings = unionRings(pieces([{ pts, closed, area, d }], { segments }));
  }
  return { rings, area: rings.reduce((s, r) => s + ringArea(r), 0) };
}

// Pure: the union of several parts, each with its own distance d. Returns { rings, area }.
export function offsetUnion(parts, { segments = ARC_SEGMENTS } = {}) {
  const rings = unionRings(pieces(parts, { segments }));
  return { rings, area: rings.reduce((s, r) => s + ringArea(r), 0) };
}
