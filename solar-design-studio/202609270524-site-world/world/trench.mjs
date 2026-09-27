// trench.mjs: a trench is a function laid over the ground, never a stored mesh.
//
// Local metres: x east, y north, z up. The ground is any function groundAt(x, y).
// A trench is a centreline path with a floor width and a depth. The floor follows
// the ground profile along the centreline, lowered by the depth, so a trench on a
// hillside keeps a constant depth down its length. Walls are vertical unless a
// benchSlope (horizontal metres per metre of height) gives them a batter.
//
// Corners are mitred: each segment owns the strip between the bisector lines at
// its two ends, so the outside of a bend is a sharp corner, not a rounded one.
// Ends are cut square. Where two trenches (or two parts of one) overlap, the
// lowest surface wins. Nothing here fills ground: the cut never rises above it.
//
// No DOM. Pure functions of their inputs. Volumes and the ground with trenches in it come from the shared
// earthworks engine (lib/earthworks.mjs), which the road and pad cartridges use too.

import { stripVolume, gridIntegrate, composeGround as compose } from './lib/earthworks.mjs';

const GRID = 0.25;          // integration cell for spoil volume, metres
const STEP = 0.25;          // sampling step along the centreline, metres
const EPS = 1e-9;

/**
 * createTrench({ path, width, depth, benchSlope = 0, groundAt? })
 * path: [[x, y], ...] with at least two distinct points.
 * groundAt is optional; when given, length3d and spoilVolumeM3 are numbers.
 */
export function createTrench({ path, width, depth, benchSlope = 0, groundAt = null }) {
  if (!Array.isArray(path)) throw new Error('trench: path must be an array of [x, y]');
  if (!(width > 0) || !(depth > 0)) throw new Error('trench: width and depth must be positive');
  if (!(benchSlope >= 0)) throw new Error('trench: benchSlope must be zero or positive');

  // Drop repeated points so every segment has a direction.
  const pts = [];
  for (const p of path) {
    const q = [Number(p[0]), Number(p[1])];
    const last = pts[pts.length - 1];
    if (!last || Math.hypot(q[0] - last[0], q[1] - last[1]) > 1e-6) pts.push(q);
  }
  if (pts.length < 2) throw new Error('trench: path needs two distinct points');

  const half = width / 2;
  // How far out the batter may reach. The cut is clipped by the ground anyway, so
  // this only bounds the search; three depths covers steep side slopes.
  const reach = half + benchSlope * depth * 3;

  // Segments: start, unit direction, left normal, length, chainage at start.
  const segs = [];
  let s0 = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const len = Math.hypot(bx - ax, by - ay);
    const dx = (bx - ax) / len, dy = (by - ay) / len;
    segs.push({ ax, ay, bx, by, dx, dy, nx: -dy, ny: dx, len, s0 });
    s0 += len;
  }
  const length2d = s0;
  const n = segs.length;

  // Cut lines at each end of each segment. At a path end the cut is square to the
  // segment; at a bend it is the bisector, so neighbours share the mitre line.
  for (let i = 0; i < n; i++) {
    const g = segs[i];
    g.first = i === 0;
    g.last = i === n - 1;
    g.mStart = g.first ? [g.dx, g.dy] : bisector(segs[i - 1], g);
    g.mEnd = g.last ? [g.dx, g.dy] : bisector(g, segs[i + 1]);
  }

  // Bounding box of everything the trench can touch, for quick rejection.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of pts) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  // A mitre can reach reach / cos(half the turn); cap the allowance at four times.
  const pad = reach * 4;
  const bbox = { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };

  function pointAt(s) {
    const c = Math.min(Math.max(s, 0), length2d);
    for (const g of segs) {
      if (c <= g.s0 + g.len || g.last) {
        const t = Math.min(Math.max(c - g.s0, 0), g.len);
        return [g.ax + g.dx * t, g.ay + g.dy * t];
      }
    }
    return pts[pts.length - 1];
  }

  // Every segment region the point falls in: chainage, lateral offset and how far
  // it lies beyond the floor edge (0 on the floor itself).
  function candidates(x, y, limit) {
    const out = [];
    if (x < bbox.minX || x > bbox.maxX || y < bbox.minY || y > bbox.maxY) return out;
    for (const g of segs) {
      const px = x - g.ax, py = y - g.ay;
      const t = px * g.dx + py * g.dy;
      const off = px * g.nx + py * g.ny;
      if (Math.abs(off) > limit + EPS) continue;
      let endExcess = 0;
      if (g.first) { if (t < -EPS) endExcess = -t; } // round-off at the square end stays inside (review B, 1a)
      else if (px * g.mStart[0] + py * g.mStart[1] < -EPS) continue;
      const qx = x - g.bx, qy = y - g.by;
      if (g.last) { if (t > g.len + EPS) endExcess = t - g.len; }
      else if (qx * g.mEnd[0] + qy * g.mEnd[1] > EPS) continue;
      const excess = Math.max(Math.abs(off) - half, endExcess, 0);
      if (excess > limit - half + EPS) continue;
      out.push({ s: g.s0 + Math.min(Math.max(t, 0), g.len), off, excess });
    }
    return out;
  }

  const floorAt = (s, g = groundAt) => {
    if (!g) throw new Error('trench: floorAt needs a ground function');
    const [x, y] = pointAt(s);
    return g(x, y) - depth;
  };

  const inside = (x, y) => candidates(x, y, half).some((c) => c.excess === 0);

  function cutHeight(x, y, g = groundAt) {
    const ground = g(x, y);
    const cs = candidates(x, y, benchSlope > 0 ? reach : half);
    let z = ground;
    for (const c of cs) {
      let surface = floorAt(c.s, g);
      if (c.excess > 0) {
        if (benchSlope === 0) continue;
        surface += c.excess / benchSlope;
      }
      if (surface < z) z = surface;
    }
    return z;
  }

  // Chainage of the nearest point on the centreline (inside or not).
  function chainage(x, y) {
    let best = Infinity, bestS = 0;
    for (const g of segs) {
      const t = Math.min(Math.max((x - g.ax) * g.dx + (y - g.ay) * g.dy, 0), g.len);
      const d = Math.hypot(x - (g.ax + g.dx * t), y - (g.ay + g.dy * t));
      if (d < best - EPS) { best = d; bestS = g.s0 + t; }
    }
    return bestS;
  }

  function length3dOn(g) {
    let total = 0, [px, py] = pointAt(0), pz = g(px, py);
    const steps = Math.max(1, Math.ceil(length2d / STEP));
    // Sample every vertex exactly as well as the regular steps.
    const marks = new Set();
    for (let k = 0; k <= steps; k++) marks.add(Math.min(k * length2d / steps, length2d));
    for (const sg of segs) marks.add(sg.s0);
    const ss = [...marks].sort((a, b) => a - b);
    for (let k = 1; k < ss.length; k++) {
      const [x, y] = pointAt(ss[k]);
      const z = g(x, y);
      total += Math.hypot(x - px, y - py, z - pz);
      px = x; py = y; pz = z;
    }
    return total;
  }

  // Excavated volume: ground minus cut surface, summed over a 0.25 m grid of cell
  // centres across the trench's reach, for this trench alone.
  function spoilVolumeOn(g) {
    if (benchSlope === 0) return stripVolume(pts, width, depth, g); // vertical walls: exact strips, no grid aliasing
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of mitredOutline(benchSlope > 0 ? reach : half)) {
      x0 = Math.min(x0, x); x1 = Math.max(x1, x);
      y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    const nx = Math.ceil((x1 - x0) / GRID - 1e-9), ny = Math.ceil((y1 - y0) / GRID - 1e-9);
    const dig = (x, y) => Math.max(0, g(x, y) - cutHeight(x, y, g));
    // Cell corners, computed once. A cell whose corners disagree on whether they
    // are dug straddles a wall, so it is split 8 x 8 to find where the wall runs.
    const cw = nx + 1, corner = new Float64Array(cw * (ny + 1));
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) corner[j * cw + i] = dig(x0 + i * GRID, y0 + j * GRID);
    const straddles = (x, y, i, j) => {
      const dug = [corner[j * cw + i], corner[j * cw + i + 1], corner[(j + 1) * cw + i], corner[(j + 1) * cw + i + 1]].filter((d) => d > 0).length;
      return dug !== 0 && dug !== 4;
    };
    let vol = 0;
    gridIntegrate({ x0, y0, nx, ny, cell: GRID, split: straddles, visit: (x, y, w) => { vol += dig(x, y) * w * GRID * GRID; } });
    return vol;
  }

  // Offset polyline at signed distance h, with mitred vertices.
  function offsetLine(h) {
    const out = [];
    for (let k = 0; k <= n; k++) {
      let mx, my;
      if (k === 0) { mx = segs[0].nx; my = segs[0].ny; }
      else if (k === n) { mx = segs[n - 1].nx; my = segs[n - 1].ny; }
      else {
        const a = segs[k - 1], b = segs[k];
        const c = 1 + a.nx * b.nx + a.ny * b.ny;
        if (c < 1e-3) { mx = b.nx; my = b.ny; }            // a U-turn: no finite mitre
        else { mx = (a.nx + b.nx) / c; my = (a.ny + b.ny) / c; }
      }
      const s = k === n ? length2d : segs[k].s0;
      out.push([pts[k][0] + mx * h, pts[k][1] + my * h, s]);
    }
    return out;
  }

  function mitredOutline(h) {
    const L = offsetLine(h), R = offsetLine(-h);
    const e = benchSlope > 0 ? reach : half;
    const a = segs[0], b = segs[n - 1];
    // Square ends pushed out by the batter reach beyond the floor.
    const ext = e - half;
    const pad = (p, g, sign) => [p[0] + g.dx * ext * sign, p[1] + g.dy * ext * sign];
    return [...L, ...R, pad(L[0], a, -1), pad(R[0], a, -1), pad(L[n], b, 1), pad(R[n], b, 1)];
  }

  // Line pairs (x, y, z, x, y, z) for both floor edges, both wall tops, the uprights
  // at bends and ends, and the square end lines across the floor.
  function wallLines(g = groundAt) {
    if (!g) throw new Error('trench: wallLines needs a ground function');
    const v = [];
    const push = (a, b) => v.push(a[0], a[1], a[2], b[0], b[1], b[2]);
    const topAt = (x, y, floor) => {
      // With a batter the wall top sits out from the floor edge by depth * slope.
      return [x, y, Math.max(g(x, y), floor)];
    };
    for (const side of [1, -1]) {
      const edge = offsetLine(side * half);
      const top = benchSlope > 0 ? offsetLine(side * (half + benchSlope * depth)) : edge;
      for (let k = 0; k < n; k++) {
        const len = segs[k].len;
        const steps = Math.max(1, Math.ceil(len / 1));
        let prevF = null, prevT = null;
        for (let j = 0; j <= steps; j++) {
          const f = j / steps;
          const s = edge[k][2] + (edge[k + 1][2] - edge[k][2]) * f;
          const floor = floorAt(s, g);
          const ex = edge[k][0] + (edge[k + 1][0] - edge[k][0]) * f;
          const ey = edge[k][1] + (edge[k + 1][1] - edge[k][1]) * f;
          const tx = top[k][0] + (top[k + 1][0] - top[k][0]) * f;
          const ty = top[k][1] + (top[k + 1][1] - top[k][1]) * f;
          const F = [ex, ey, floor], T = topAt(tx, ty, floor);
          if (prevF) { push(prevF, F); push(prevT, T); }
          if (j === 0 || j === steps) push(F, T);
          prevF = F; prevT = T;
        }
      }
    }
    // Square end lines across the floor.
    for (const s of [0, length2d]) {
      const g0 = s === 0 ? segs[0] : segs[n - 1];
      const [cx, cy] = pointAt(s);
      const z = floorAt(s, g);
      push([cx + g0.nx * half, cy + g0.ny * half, z], [cx - g0.nx * half, cy - g0.ny * half, z]);
    }
    return new Float32Array(v);
  }

  const trench = {
    path: pts, width, depth, benchSlope, length2d, bbox,
    cutHeight, inside, floorAt, chainage, wallLines, pointAt,
    length3dOn, spoilVolumeOn,
  };
  let len3 = null, vol = null;
  Object.defineProperty(trench, 'length3d', {
    enumerable: true,
    get() {
      if (!groundAt) throw new Error('trench: length3d needs groundAt; use length3dOn(g)');
      return len3 ?? (len3 = length3dOn(groundAt));
    },
  });
  Object.defineProperty(trench, 'spoilVolumeM3', {
    enumerable: true,
    get() {
      if (!groundAt) throw new Error('trench: spoilVolumeM3 needs groundAt; use spoilVolumeOn(g)');
      return vol ?? (vol = spoilVolumeOn(groundAt));
    },
  });
  return trench;
}

// Unit normal of the mitre line between two segments: the sum of their directions.
// For a U-turn the sum vanishes, so fall back to the incoming direction.
function bisector(a, b) {
  const x = a.dx + b.dx, y = a.dy + b.dy, l = Math.hypot(x, y);
  return l < 1e-6 ? [a.dx, a.dy] : [x / l, y / l];
}

/**
 * composeGround(groundAt, trenches) -> a new heightAt with every trench cut in (lib/earthworks.mjs composeGround).
 * Each trench cuts against the original ground; where they overlap the lowest wins.
 */
export const composeGround = (groundAt, trenches) => compose(groundAt, { trenches: [...trenches] });

/**
 * floorGround(trench, groundAt) -> (x, y) -> the trench's own floor level at the nearest point of its centreline.
 * A cable lies on its trench floor even where its bend fillet cuts the corner wider than half the trench, so it
 * never climbs onto the natural ground at a bend (review B, finding 1b).
 */
export const floorGround = (trench, groundAt) => (x, y) => trench.floorAt(trench.chainage(x, y), groundAt);
