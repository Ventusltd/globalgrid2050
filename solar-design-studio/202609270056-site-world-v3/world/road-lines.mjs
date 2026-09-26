// road-lines.mjs: lines for drawing a road made by createRoad (road.mjs). No imports, no DOM.
//
// Every function takes the road object and returns a Float32Array of line pairs (x, y, z, x, y, z) in
// local metres, ready for a line batch. Edge offset lines are mitred on the inside of a bend and follow
// an arc round the outside, matching the road's nearest-point rule (the outside of a bend is rounded).

export const STEEP_NOTE = 'grade over the limit (10 % assumed unless set)';
export const DRAIN_NOTE = 'edge in cut: needs a side drain';

function frame(road) {
  const pts = road.path, segs = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], len = Math.hypot(bx - ax, by - ay);
    segs.push({ dx: (bx - ax) / len, dy: (by - ay) / len, nx: -(by - ay) / len, ny: (bx - ax) / len });
  }
  return { pts, segs };
}

// Offset line at signed distance h (positive to the left of the direction of travel).
export function offsetLine(road, h) {
  const { pts, segs } = frame(road);
  const out = [[pts[0][0] + segs[0].nx * h, pts[0][1] + segs[0].ny * h]];
  for (let k = 1; k < pts.length - 1; k++) {
    const a = segs[k - 1], b = segs[k], turn = a.dx * b.dy - a.dy * b.dx; // > 0 turns left
    const [vx, vy] = pts[k];
    if (turn * h > 0 || Math.abs(turn) < 1e-9) {                        // inside (or straight): mitre
      const c = 1 + a.nx * b.nx + a.ny * b.ny;
      out.push([vx + (a.nx + b.nx) / c * h, vy + (a.ny + b.ny) / c * h]);
    } else {                                                            // outside: arc
      const a0 = Math.atan2(a.ny, a.nx);
      let da = Math.atan2(b.ny, b.nx) - a0;
      if (da > Math.PI) da -= 2 * Math.PI;
      if (da < -Math.PI) da += 2 * Math.PI;
      const m = Math.max(2, Math.ceil(Math.abs(da) / 0.2));
      for (let q = 0; q <= m; q++) { const t = a0 + da * q / m; out.push([vx + Math.cos(t) * h, vy + Math.sin(t) * h]); }
    }
  }
  const e = segs[segs.length - 1], last = pts[pts.length - 1];
  out.push([last[0] + e.nx * h, last[1] + e.ny * h]);
  return out;
}

function densify(line, every) {
  const out = [line[0]];
  for (let k = 1; k < line.length; k++) {
    const [ax, ay] = line[k - 1], [bx, by] = line[k], m = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / every));
    for (let q = 1; q <= m; q++) out.push([ax + (bx - ax) * q / m, ay + (by - ay) * q / m]);
  }
  return out;
}

// Finished level at a plan point, clamped to the carriageway.
const finishedAtPoint = (road, x, y) => {
  const p = road.locate(x, y), half = road.width / 2;
  return p ? road.finishedAt(p.s, Math.max(-half, Math.min(half, p.off))) : road.designLevel(0);
};

// The two carriageway edges, the centreline and the square ends, at finished level.
export function edgeLines(road) {
  const v = [], half = road.width / 2, { segs } = frame(road);
  const run = (line) => {
    for (let k = 1; k < line.length; k++) {
      const [ax, ay] = line[k - 1], [bx, by] = line[k];
      v.push(ax, ay, finishedAtPoint(road, ax, ay), bx, by, finishedAtPoint(road, bx, by));
    }
  };
  run(densify(offsetLine(road, half), 1)); run(densify(offsetLine(road, -half), 1)); run(densify(offsetLine(road, 0), 1));
  for (const [s, g] of [[0, segs[0]], [road.length2d, segs[segs.length - 1]]]) {
    const [cx, cy] = road.pointAt(s);
    run(densify([[cx + g.nx * half, cy + g.ny * half], [cx - g.nx * half, cy - g.ny * half]], 0.5));
  }
  return new Float32Array(v);
}

// Where a batter meets the ground, going outward from an edge point along (ux, uy). null if not met.
function daylight(road, x, y, ux, uy, zE, g) {
  const { fillSlope, cutSlope } = road, limit = road.reach - road.width / 2;
  const g0 = g(x, y);
  if (Math.abs(zE - g0) < 1e-6) return { d: 0, z: g0 };
  const fillSide = zE > g0, sgn = fillSide ? 1 : -1;
  const raw = (d) => (fillSide ? zE - d / fillSlope : zE + d / cutSlope) - g(x + ux * d, y + uy * d);
  let a = 0, b = 0.25;
  while (sgn * raw(b) > 0) { a = b; b += 0.25; if (b > limit) return null; }
  for (let k = 0; k < 30; k++) { const m = (a + b) / 2; if (sgn * raw(m) > 0) a = m; else b = m; }
  return { d: b, z: fillSide ? zE - b / fillSlope : zE + b / cutSlope };
}

// The daylight line (top of cut, toe of fill) along each side and a hatch line from the edge to it every
// `tick` metres. The result's .unmet counts edge points whose batter did not reach the ground within the
// road's reach (a hillside steeper than the batter).
export function batterLines(road, g = road.groundAt, { tick = 5 } = {}) {
  const v = [], half = road.width / 2;
  let unmet = 0;
  for (const side of [1, -1]) {
    const edge = densify(offsetLine(road, side * half), 1);
    let prev = null, run = 0, lastTick = -Infinity;
    for (let k = 0; k < edge.length; k++) {
      const [x, y] = edge[k], p = road.locate(x, y);
      if (k > 0) run += Math.hypot(x - edge[k - 1][0], y - edge[k - 1][1]);
      if (!p) { prev = null; continue; }
      const ux = (x - p.fx) / (p.d || 1), uy = (y - p.fy) / (p.d || 1), zE = road.finishedAt(p.s, side * half);
      const hit = daylight(road, x, y, ux, uy, zE, g);
      if (!hit) { unmet++; prev = null; continue; }
      const q = [x + ux * hit.d, y + uy * hit.d, hit.z];
      if (prev) v.push(...prev, ...q);
      if (hit.d > 0.05 && run - lastTick >= tick - 1e-9) { v.push(x, y, zE, ...q); lastTick = run; }
      prev = q;
    }
  }
  const out = new Float32Array(v);
  out.unmet = unmet;
  return out;
}

// A line over each chainage run in `sections` ([{ from, to, side? }]), lifted by `lift` metres so it reads
// above the surface: on the centreline, or along the named edge when a run has a side ('left' | 'right').
// Draw steepSections in red with STEEP_NOTE, drainSections with DRAIN_NOTE.
export function sectionLines(road, sections, { lift = 0.05, every = 1 } = {}) {
  const v = [], { segs } = frame(road), half = road.width / 2;
  const at = (s, off) => {
    const [x, y] = road.pointAt(s);
    let i = 0, s0 = 0;
    for (; i < segs.length - 1; i++) {
      const [ax, ay] = road.path[i], [bx, by] = road.path[i + 1], len = Math.hypot(bx - ax, by - ay);
      if (s <= s0 + len) break;
      s0 += len;
    }
    return [x + segs[i].nx * off, y + segs[i].ny * off, road.finishedAt(s, off) + lift];
  };
  for (const { from, to, side } of sections) {
    const off = side === 'left' ? half : side === 'right' ? -half : 0;
    const m = Math.max(1, Math.ceil((to - from) / every));
    for (let k = 0; k < m; k++) v.push(...at(from + (to - from) * k / m, off), ...at(from + (to - from) * (k + 1) / m, off));
  }
  return new Float32Array(v);
}
