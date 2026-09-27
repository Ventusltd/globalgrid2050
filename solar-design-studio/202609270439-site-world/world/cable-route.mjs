// Cable route: a buried cable laid along a plan polyline. Pure: no imports, no DOM, no WebGL.
// Local east (x), north (y), up (z), metres, as camera.mjs.
//
// routeCable({ points, minBendRadius, depthBelowGround, groundAt, formation, spacing, step })
//   points          [[x, y], ...] plan vertices (at least two)
//   minBendRadius   every corner is replaced by a circular arc of this radius (a fillet)
//   depthBelowGround the centreline sits this far below groundAt(x, y)
//   groundAt        (x, y) -> ground height; default flat at 0
//   formation       'flat' (three cores side by side, centre to centre = spacing) or
//                   'trefoil' (three touching cores, centre to centre = spacing = core diameter)
//   step            sampling interval along the route, metres (default 1)
//
// A corner whose legs are too short for the requested radius is still filleted, with the largest radius the
// legs allow, and reported in violations: { index, requestedRadius, available }. Nothing is silently accepted.
// length2d is exact (straights plus arcs). length3d walks the samples with the exact plan distance between
// them and the ground-following height change, so on flat ground length3d equals length2d.

const EPS = 1e-9;

function sub(a, b) { return [a[0] - b[0], a[1] - b[1]]; }
function norm(v) { return Math.hypot(v[0], v[1]); }
function unit(v) { const l = norm(v); return [v[0] / l, v[1] / l]; }

// Signed turn from direction d1 to d2, radians, left (anticlockwise) positive.
function turn(d1, d2) { return Math.atan2(d1[0] * d2[1] - d1[1] * d2[0], d1[0] * d2[0] + d1[1] * d2[1]); }

// Build the plan geometry: straights and arcs, with fitted radii and violations.
function planSegments(pts, R) {
  const n = pts.length;
  const legs = [];
  for (let k = 0; k < n - 1; k++) {
    const v = sub(pts[k + 1], pts[k]);
    legs.push({ len: norm(v), dir: norm(v) > EPS ? unit(v) : null });
  }
  // Requested tangent length at each vertex (0 at the ends and at straight-through vertices).
  const theta = new Array(n).fill(0);
  const want = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    const a = legs[i - 1].dir, b = legs[i].dir;
    if (!a || !b) continue;
    theta[i] = turn(a, b);
    const half = Math.abs(theta[i]) / 2;
    if (half < EPS) continue;
    want[i] = Math.PI / 2 - half < EPS ? Infinity : R * Math.tan(half);
  }
  // Each leg must hold the tangents of both its ends; share a short leg in proportion to what each end asks.
  const cap = want.slice();
  for (let k = 0; k < n - 1; k++) {
    const t0 = want[k], t1 = want[k + 1], len = legs[k].len;
    if (t0 + t1 <= len) continue;
    if (!isFinite(t0) && !isFinite(t1)) { cap[k] = Math.min(cap[k], len / 2); cap[k + 1] = Math.min(cap[k + 1], len / 2); continue; }
    const f0 = !isFinite(t0) ? 1 : !isFinite(t1) ? 0 : t0 / (t0 + t1);
    cap[k] = Math.min(cap[k], len * f0);
    cap[k + 1] = Math.min(cap[k + 1], len * (1 - f0));
  }
  const violations = [];
  const corners = [];
  for (let i = 1; i < n - 1; i++) {
    if (want[i] === 0) continue;
    const half = Math.abs(theta[i]) / 2;
    const reversal = Math.PI / 2 - half < EPS;
    const t = reversal ? 0 : cap[i];
    const r = reversal ? 0 : t / Math.tan(half);
    if (r < R * (1 - 1e-9)) violations.push({ index: i, requestedRadius: R, available: r });
    if (r > EPS) corners.push({ index: i, t, r, theta: theta[i] });
  }
  // Walk the route: straight to each tangent point, arc round, carry on.
  const segs = [];
  let cur = pts[0].slice(0, 2), s = 0;
  const line = (a, b) => {
    const len = norm(sub(b, a));
    if (len < EPS) return;
    segs.push({ type: 'line', a, b, dir: unit(sub(b, a)), len, s0: s, s1: s + len });
    s += len;
  };
  for (const c of corners) {
    const d1 = legs[c.index - 1].dir, d2 = legs[c.index].dir, p = pts[c.index];
    const A = [p[0] - d1[0] * c.t, p[1] - d1[1] * c.t];
    const B = [p[0] + d2[0] * c.t, p[1] + d2[1] * c.t];
    line(cur, A);
    const side = Math.sign(c.theta);
    const centre = [A[0] - d1[1] * c.r * side, A[1] + d1[0] * c.r * side];
    const a0 = Math.atan2(A[1] - centre[1], A[0] - centre[0]);
    const len = c.r * Math.abs(c.theta);
    segs.push({ type: 'arc', centre, r: c.r, a0, theta: c.theta, h0: Math.atan2(d1[1], d1[0]), len, s0: s, s1: s + len, index: c.index });
    s += len;
    cur = B;
  }
  line(cur, pts[n - 1].slice(0, 2));
  return { segs, violations, length2d: s };
}

// Point and heading at parameter u in [0, 1] along a segment.
function at(seg, u) {
  if (seg.type === 'line') {
    return { x: seg.a[0] + (seg.b[0] - seg.a[0]) * u, y: seg.a[1] + (seg.b[1] - seg.a[1]) * u, h: Math.atan2(seg.dir[1], seg.dir[0]) };
  }
  const ang = seg.a0 + seg.theta * u;
  return { x: seg.centre[0] + seg.r * Math.cos(ang), y: seg.centre[1] + seg.r * Math.sin(ang), h: seg.h0 + seg.theta * u };
}

// Lateral (left of travel) and vertical offsets of the three cores from the centreline.
function coreOffsets(formation, spacing) {
  if (formation === 'trefoil') {
    const rc = spacing / Math.sqrt(3); // circumradius of the touching triangle
    return [[0, rc], [-spacing / 2, -rc / 2], [spacing / 2, -rc / 2]];
  }
  return [[spacing, 0], [0, 0], [-spacing, 0]];
}

export function routeCable({
  points, minBendRadius = 0, depthBelowGround = 0, groundAt = () => 0,
  formation = 'flat', spacing = 0, step = 1,
} = {}) {
  if (!Array.isArray(points) || points.length < 2) throw Error('routeCable needs at least two points');
  if (formation !== 'flat' && formation !== 'trefoil') throw Error(`unknown formation: ${formation}`);
  if (!(step > 0)) throw Error('step must be positive');
  const R = Math.max(0, minBendRadius);
  const { segs, violations, length2d } = planSegments(points, R);
  const zAt = (x, y) => groundAt(x, y) - depthBelowGround;

  // Samples along the centreline: plan point, heading, chainage, and the segment they belong to.
  const samples = [];
  segs.forEach((seg, si) => {
    let pieces = Math.max(1, Math.ceil(seg.len / step));
    if (seg.type === 'arc') pieces = Math.max(pieces, Math.ceil(Math.abs(seg.theta) / (Math.PI / 36)));
    for (let j = si === 0 ? 0 : 1; j <= pieces; j++) {
      const u = j / pieces;
      samples.push({ ...at(seg, u), s: seg.s0 + seg.len * u, seg: si });
    }
  });
  if (!samples.length) { const p = points[0]; samples.push({ x: p[0], y: p[1], h: 0, s: 0, seg: -1 }); }

  // Walk one line of samples, offset laterally by `lat` and vertically by `vert`, measuring as we go.
  const walk = (lat, vert) => {
    const poly = [];
    let len2 = 0, len3 = 0;
    for (let k = 0; k < samples.length; k++) {
      const q = samples[k];
      const x = q.x - Math.sin(q.h) * lat, y = q.y + Math.cos(q.h) * lat;
      const z = zAt(q.x, q.y) + vert;
      if (k > 0) {
        const prev = samples[k - 1], seg = segs[q.seg];
        // Exact plan distance: an offset arc has radius r - lat for a left turn, r + lat for a right turn.
        const scale = seg.type === 'arc' ? (seg.r - Math.sign(seg.theta) * lat) / seg.r : 1;
        const ds = (q.s - prev.s) * scale, dz = z - poly[k - 1][2];
        len2 += ds; len3 += Math.hypot(ds, dz);
      }
      poly.push([x, y, z]);
    }
    return { polyline: poly, length2d: len2, length3d: len3 };
  };

  const centre = walk(0, 0);
  const names = formation === 'trefoil' ? ['top', 'left', 'right'] : ['left', 'centre', 'right'];
  const cores = coreOffsets(formation, spacing).map(([lat, vert], i) => {
    const w = walk(lat, vert);
    return { name: names[i], lateral: lat, vertical: vert, polyline: w.polyline, length2d: w.length2d, length3d: w.length3d };
  });

  // A core on the inside of a bend whose offset exceeds the bend radius would fold back on itself.
  const maxLat = Math.max(...cores.map((c) => Math.abs(c.lateral)));
  for (const seg of segs) {
    if (seg.type === 'arc' && seg.r <= maxLat && !violations.some((v) => v.index === seg.index)) {
      violations.push({ index: seg.index, requestedRadius: R, available: seg.r, reason: 'inner core offset exceeds bend radius' });
    }
  }
  violations.sort((a, b) => a.index - b.index);

  const bendRadiusAt = (chainage) => {
    for (const seg of segs) {
      if (chainage >= seg.s0 - EPS && chainage <= seg.s1 + EPS && seg.type === 'arc') return seg.r;
    }
    return Infinity;
  };

  const drawLines = ({ includeCores = true, includeCentreline = true } = {}) => {
    const lines = [];
    if (includeCentreline) lines.push(centre.polyline);
    if (includeCores) for (const c of cores) lines.push(c.polyline);
    let count = 0;
    for (const l of lines) count += Math.max(0, l.length - 1);
    const out = new Float32Array(count * 6);
    let o = 0;
    for (const l of lines) {
      for (let k = 1; k < l.length; k++) {
        out[o++] = l[k - 1][0]; out[o++] = l[k - 1][1]; out[o++] = l[k - 1][2];
        out[o++] = l[k][0]; out[o++] = l[k][1]; out[o++] = l[k][2];
      }
    }
    return out;
  };

  return {
    centreline: centre.polyline,
    segments: segs.map((g) => (g.type === 'arc'
      ? { type: 'arc', centre: g.centre, radius: g.r, turn: g.theta, s0: g.s0, s1: g.s1, index: g.index }
      : { type: 'line', from: g.a, to: g.b, s0: g.s0, s1: g.s1 })),
    violations,
    length2d,
    length3d: centre.length3d,
    formation,
    cores,
    bendRadiusAt,
    drawLines,
  };
}
