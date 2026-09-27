// lib/earthworks.mjs: the one cut and fill engine for trenches, roads and pads, and the one composer that puts
// every dig into the ground. Cartridges import it; layers reach it through api.lib.earthworks. No imports, no DOM.
//
// Local metres: x east, y north, z up. The ground is any function groundAt(x, y). Batters are horizontal metres
// per metre of height; the engine works with their inverses (vertical per horizontal), so a zero batter is a
// vertical face (inverse Infinity). Volumes are bank (in place) measure: no bulking or shrinkage.

const EPS = 1e-9;

// ---------------------------------------------------------------- batters

export const inv = h => (h > 0 ? 1 / h : Infinity);

// Surface d metres out from an edge at `level`: the ground, clamped between the fill batter falling from the
// edge and the cut batter rising from it. So a batter meets the ground at the daylight line and runs no further.
export const batterZ = (g, level, d, invCut, invFill) => Math.min(Math.max(g, level - d * invFill), level + d * invCut);

// Distance along a ray to where a batter meets the ground (the daylight point). met(t) says the batter has met
// the ground by t; the ray is walked in steps and the crossing bisected 30 times. With strict, a batter still
// working past `limit` is not met (null); otherwise the walk stops at limit and bisects what it has.
export function daylight(met, step, limit, { strict = false } = {}) {
  let a = 0, b = step;
  if (strict) { while (!met(b)) { a = b; b += step; if (b > limit) return null; } }
  else while (b < limit && !met(b)) { a = b; b += step; }
  for (let k = 0; k < 30; k++) { const m = (a + b) / 2; if (met(m)) b = m; else a = m; }
  return b;
}

// ---------------------------------------------------------------- footprints

export const polyArea = pts => {
  let a = 0;
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; }
  return Math.abs(a) / 2;
};

// The same even-odd crossing test as measure.mjs insidePoly and lidar/src/earthworks_pair.py inside_poly.
export function insidePoly(x, y, vx, vy) {
  let ins = false;
  for (let i = 0, n = vx.length; i < n; i++) {
    const j = (i - 1 + n) % n, x1 = vx[i], y1 = vy[i], x2 = vx[j], y2 = vy[j];
    if (y1 === y2) continue;
    if ((y1 > y) !== (y2 > y) && x < x1 + (y - y1) * (x2 - x1) / (y2 - y1)) ins = !ins;
  }
  return ins;
}

// Plan distance from a point to a closed polygon's boundary.
export function edgeDistance(x, y, pts) {
  let best = Infinity;
  for (let i = 0, n = pts.length; i < n; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % n], dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return best;
}

// ---------------------------------------------------------------- sampling and volumes

// Samples the ground once over a polygon grown by `reach`, on cell centres anchored as measure.mjs
// cutFillForPlatform (floor of min x and y, centres at (i + 0.5) cell). Per cell: ground z, distance d outside
// the polygon (0 inside) and the formation offset o from off(x, y).
export function sampleCells(pts, groundAt, cell, reach, off = () => 0) {
  const vx = pts.map(p => p[0]), vy = pts.map(p => p[1]);
  const pad = Math.ceil(reach / cell) * cell;                     // whole cells, so centres stay on measure's grid
  const x0 = Math.floor(Math.min(...vx)) - pad, y0 = Math.floor(Math.min(...vy)) - pad;
  const nx = Math.ceil((Math.max(...vx) + pad - x0) / cell), ny = Math.ceil((Math.max(...vy) + pad - y0) / cell);
  const z = [], d = [], o = [];
  for (let j = 0; j < ny; j++) {
    const y = y0 + (j + 0.5) * cell;
    for (let i = 0; i < nx; i++) {
      const x = x0 + (i + 0.5) * cell;
      const inside = insidePoly(x, y, vx, vy), dist = inside ? 0 : Math.max(edgeDistance(x, y, pts), EPS);
      if (!inside && dist > reach) continue;
      const g = groundAt(x, y);
      if (!Number.isFinite(g)) throw Error(`pad: no ground at ${x.toFixed(2)}, ${y.toFixed(2)}`);
      z.push(g); d.push(dist); o.push(off(x, y));
    }
  }
  return { z: Float64Array.from(z), d: Float64Array.from(d), o: Float64Array.from(o), cell, reach };
}

// Cut and fill (m³) for a formation level over sampled cells, split into platform (inside) and batters.
export function volumesAt(cells, level0, invCut, invFill) {
  let pc = 0, pf = 0, bc = 0, bf = 0, n = 0, edge = 0, worked = 0, gMax = -Infinity;
  const { z, d, o, cell, reach } = cells;
  for (let k = 0; k < z.length; k++) {
    const g = z[k], level = level0 + o[k];
    if (d[k] === 0) { n++; gMax = Math.max(gMax, g); if (g > level) pc += g - level; else pf += level - g; continue; }
    const dz = g - batterZ(g, level, d[k], invCut, invFill);
    if (dz !== 0) worked++;
    if (dz > 0) bc += dz; else bf -= dz;
    if (dz !== 0 && d[k] > reach - 2 * cell) edge++;             // batter still working at the edge of the sample
  }
  const a = cell * cell;
  return { platformCut: pc * a, platformFill: pf * a, batterCut: bc * a, batterFill: bf * a, cells: n, area: n * a, edge,
    footprint: (n + worked) * a, gMax };
}

// Formation level where cut equals fill (bisection: cut - fill falls as the level rises).
export function balance(cells, invCut, invFill) {
  let lo = Infinity, hi = -Infinity;
  cells.z.forEach((g, k) => { lo = Math.min(lo, g - cells.o[k]); hi = Math.max(hi, g - cells.o[k]); });
  for (let it = 0; it < 80 && hi - lo > 1e-7; it++) {
    const mid = (lo + hi) / 2, v = volumesAt(cells, mid, invCut, invFill);
    if (v.platformCut + v.batterCut > v.platformFill + v.batterFill) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// Adaptive midpoint integration over nx x ny cells from (x0, y0): visit(x, y, w) at each cell centre (w = 1), or,
// where split(x, y, i, j) says a face or an end crosses the cell, at sub x sub points (w = 1 / sub²).
export function gridIntegrate({ x0, y0, nx, ny, cell, sub = 8, split, visit }) {
  const h = cell / sub, w = 1 / (sub * sub);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = x0 + (i + 0.5) * cell, y = y0 + (j + 0.5) * cell;
    if (!split(x, y, i, j)) { visit(x, y, 1); continue; }
    for (let b = 0; b < sub; b++) for (let a = 0; a < sub; a++) visit(x - cell / 2 + (a + 0.5) * h, y - cell / 2 + (b + 0.5) * h, w);
  }
}

// Volume dug by a vertical-walled cut of the given width and depth below the ground along a path: integrated along
// strips that follow each segment from mitre line to mitre line, so the walls fall on strip edges and nothing
// aliases with a lattice (checked 26 Sept: worst 0.021 %, 73 x faster than a 0.25 m grid, which was up to 4 %
// out on trenches running along a grid axis).
export function stripVolume(path, width, depth, g, { nt = 6, du = 0.25 } = {}) {
  const p = [];
  for (const q of path) { const l = p[p.length - 1]; if (!l || Math.hypot(q[0] - l[0], q[1] - l[1]) > 1e-6) p.push([+q[0], +q[1]]); }
  const segs = [];
  for (let i = 0; i < p.length - 1; i++) {
    const len = Math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]);
    segs.push({ a: p[i], dx: (p[i + 1][0] - p[i][0]) / len, dy: (p[i + 1][1] - p[i][1]) / len, len });
  }
  const bis = (s, t) => { const x = s.dx + t.dx, y = s.dy + t.dy, l = Math.hypot(x, y); return l < 1e-6 ? [s.dx, s.dy] : [x / l, y / l]; };
  let vol = 0;
  segs.forEach((s, i) => {
    const nx = -s.dy, ny = s.dx;
    const mS = i === 0 ? null : bis(segs[i - 1], s), mE = i === segs.length - 1 ? null : bis(s, segs[i + 1]);
    for (let k = 0; k < nt; k++) {
      const t = ((k + 0.5) / nt - 0.5) * width;
      const u0 = mS ? -t * (nx * mS[0] + ny * mS[1]) / (s.dx * mS[0] + s.dy * mS[1]) : 0;
      const u1 = mE ? s.len - t * (nx * mE[0] + ny * mE[1]) / (s.dx * mE[0] + s.dy * mE[1]) : s.len;
      const m = Math.max(1, Math.ceil((u1 - u0) / du)), h = (u1 - u0) / m;
      for (let j = 0; j < m; j++) {
        const u = u0 + (j + 0.5) * h, uc = Math.min(Math.max(u, 0), s.len);
        const x = s.a[0] + s.dx * u + nx * t, y = s.a[1] + s.dy * u + ny * t;
        const floor = g(s.a[0] + s.dx * uc, s.a[1] + s.dy * uc) - depth;
        vol += Math.max(0, g(x, y) - floor) * h;
      }
    }
  });
  return vol * width / nt;
}

// ---------------------------------------------------------------- the ground with the digs in it

/** Finished height of a pad (from createPad) at (x, y): top of stone on it, the batter beside it, the ground beyond. */
export function padHeight(pad, x, y, groundAt) {
  const vx = pad.polygon.map(p => p[0]), vy = pad.polygon.map(p => p[1]);
  const o = pad.off ? pad.off(x, y) : 0;
  if (insidePoly(x, y, vx, vy)) return pad.top + o;
  const g = groundAt(x, y);
  if (!Number.isFinite(g)) return g;
  return batterZ(g, pad.level + o, Math.max(edgeDistance(x, y, pad.polygon), EPS), inv(pad.cutBatter), inv(pad.fillBatter));
}

// Inside the pad's grown box (a cheap reject before the exact test).
export function nearPad(p, x, y) {
  if (!p.box) {
    const xs = p.polygon.map(q => q[0]), ys = p.polygon.map(q => q[1]), r = p.reach + p.cell;
    p.box = [Math.min(...xs) - r, Math.min(...ys) - r, Math.max(...xs) + r, Math.max(...ys) + r];
  }
  return x >= p.box[0] && y >= p.box[1] && x <= p.box[2] && y <= p.box[3];
}

const inBox = (b, x, y) => !(x < b.minX || x > b.maxX || y < b.minY || y > b.maxY);

/**
 * composeGround(groundAt, { roads, pads, trenches }) -> heightAt with every dig in the ground, in that order:
 *   roads     built on the ground; on a carriageway that road wins, between batters the first road listed wins
 *   pads      pressed into the ground with the roads; the first pad whose box holds the point wins
 *   trenches  cut last, each against the ground under it; where they overlap the lowest surface wins
 * With nothing to put in, the ground itself comes back.
 */
export function composeGround(groundAt, { roads = [], pads = [], trenches = [] } = {}) {
  let ground = groundAt;
  if (roads.length) ground = withRoads(ground, [...roads]);
  if (pads.length) ground = withPads(ground, [...pads]);
  if (trenches.length) ground = withTrenches(ground, [...trenches]);
  return ground;
}

function withRoads(groundAt, list) {
  return function heightAt(x, y) {
    let side = null, ground = null;
    for (const r of list) {
      if (!inBox(r.bbox, x, y)) continue;
      if (r.onRoad(x, y)) return r.roadHeight(x, y, groundAt);
      if (side !== null) continue;
      if (ground === null) ground = groundAt(x, y);
      const h = r.roadHeight(x, y, groundAt);
      if (h !== ground) side = h;
    }
    return side ?? ground ?? groundAt(x, y);
  };
}

function withPads(groundAt, list) {
  return (x, y) => {
    for (const p of list) if (nearPad(p, x, y)) return padHeight(p, x, y, groundAt);
    return groundAt(x, y);
  };
}

function withTrenches(groundAt, list) {
  return function heightAt(x, y) {
    let z = groundAt(x, y);
    for (const t of list) {
      if (!inBox(t.bbox, x, y)) continue;
      const c = t.cutHeight(x, y, groundAt);
      if (c < z) z = c;
    }
    return z;
  };
}
