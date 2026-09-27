// road.mjs: an access road as a function over the ground, never a stored mesh (the sibling of trench.mjs).
//
// Local metres: x east, y north, z up. The ground is any function groundAt(x, y).
// A road is a centreline in plan, a carriageway width, a surface build-up and a crossfall. Its design
// level follows the ground along the centreline, smoothed: grade points (PVIs) sit at equal spacing,
// each at the mean ground level over its spacing (the two ends tie in to the ground), joined by straight
// grades with a symmetric parabolic vertical curve at every interior grade point. A designer may give
// the grade points instead (profile: [[chainage, level], ...]).
// Across the road the finished surface falls from the centreline by the crossfall (a crown) or falls
// one way. The earthworks surface is the formation (finished level less the build-up) under the
// carriageway, and a side slope (batter) from each finished edge until it meets the ground: down at
// 1 in fillSlope where the road stands above the ground, up at 1 in cutSlope where it sits below.
// Lines for drawing (edges, batters, steep runs) are in road-lines.mjs.
// Offsets are measured to the nearest point of the centreline, so the outside of a bend is rounded.
// Ends are square; the ends tie in to the ground, so there is no step there.
//
// Sources and assumed values (assumed = typical, to be confirmed by the designer for a real scheme):
// - Crossfall 2.5 % from the centre of a single carriageway: DMRB CD 109 (Highway link design).
// - Crossfall 4 % on an unbound (gravel) surface: ASSUMED, steeper than CD 109 to shed water off stone.
// - Maximum gradient 1 in 10 (10 %): ASSUMED design limit for heavy delivery vehicles. NatureScot,
//   "Constructed tracks in the Scottish Uplands" (2015), gives 8 % to 10 % for tracks used by heavy
//   vehicles; Approved Document B allows 1 in 4 only for fire appliance access, far too steep here.
// - Layer build-ups below: ASSUMED typical light-duty values. Mix names follow BS EN 13108-1 / PD 6691;
//   Type 1 unbound mixture is the Specification for Highway Works, Series 800, clause 803.
// - Side slopes 1 in 2 for both fill and cut: ASSUMED for firm soils, no geotechnical data held; the same
//   value the pad cartridge assumes, so a road and a pad meet on one batter.
// - Grade-point spacing 20 m and vertical curve length 20 m: ASSUMED; they set how closely the road hugs
//   the ground. Neither is a design speed check.
//
// No DOM. Pure functions of their inputs. Batters, the daylight search, the volume integration and the ground with
// roads in it come from the shared earthworks engine (lib/earthworks.mjs), which the trench and pad cartridges use too.

import { inv, batterZ, composeGround as compose } from './lib/earthworks.mjs';

export const SURFACES = Object.freeze({
  tarmac: Object.freeze({
    crossfall: 0.025,
    layers: Object.freeze([
      Object.freeze({ name: 'surface course', material: 'AC 10 close surf', thickness: 0.04 }),
      Object.freeze({ name: 'binder course', material: 'AC 20 dense bin', thickness: 0.06 }),
      Object.freeze({ name: 'sub-base', material: 'Type 1 unbound mixture', thickness: 0.15 }),
    ]),
  }),
  gravel: Object.freeze({
    crossfall: 0.04,
    layers: Object.freeze([
      Object.freeze({ name: 'wearing course', material: 'crushed rock 0/32 (to dust)', thickness: 0.1 }),
      Object.freeze({ name: 'sub-base', material: 'Type 1 unbound mixture', thickness: 0.25 }),
    ]),
  }),
});
export const DEFAULTS = Object.freeze({
  width: 4, surface: 'gravel', fall: 'crown', maxGradient: 0.1, spacing: 20, curveLength: 20,
  fillSlope: 2, cutSlope: 2, step: 1, cell: 0.25,
});
const EPS = 1e-9;
const MAX_REACH = 80; // metres beyond the edge a batter may run before it is reported as not meeting the ground

/**
 * createRoad({ path, groundAt, width, surface, crossfall, fall, maxGradient, spacing, curveLength,
 *              fillSlope, cutSlope, profile, step, cell })
 * path: [[x, y], ...], at least two distinct points. groundAt is required: the design follows it.
 * fall: 'crown' (both ways from the centre), 'left' or 'right' (one way, towards that side).
 */
export function createRoad(opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const { path, groundAt, width, fall, maxGradient, fillSlope, cutSlope, step, cell } = o;
  if (!Array.isArray(path)) throw new Error('road: path must be an array of [x, y]');
  if (typeof groundAt !== 'function') throw new Error('road: groundAt must be a function');
  if (!(width > 0)) throw new Error('road: width must be positive');
  const spec = SURFACES[o.surface];
  if (!spec) throw new Error(`road: surface must be one of ${Object.keys(SURFACES).join(', ')}`);
  if (!['crown', 'left', 'right'].includes(fall)) throw new Error('road: fall must be crown, left or right');
  if (!(fillSlope > 0) || !(cutSlope > 0)) throw new Error('road: side slopes must be positive');
  if (!(maxGradient > 0)) throw new Error('road: maxGradient must be positive');
  const crossfall = o.crossfall ?? spec.crossfall;
  const build = spec.layers.reduce((t, l) => t + l.thickness, 0);
  const half = width / 2;

  const pts = [];
  for (const p of path) {
    const q = [Number(p[0]), Number(p[1])];
    const last = pts[pts.length - 1];
    if (!last || Math.hypot(q[0] - last[0], q[1] - last[1]) > 1e-6) pts.push(q);
  }
  if (pts.length < 2) throw new Error('road: path needs two distinct points');
  const segs = [];
  let L = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], len = Math.hypot(bx - ax, by - ay);
    const dx = (bx - ax) / len, dy = (by - ay) / len;
    segs.push({ ax, ay, dx, dy, nx: -dy, ny: dx, len, s0: L });
    L += len;
  }
  const length2d = L;
  const pointAt = (s) => {
    const c = Math.min(Math.max(s, 0), L);
    for (const g of segs) if (c <= g.s0 + g.len + EPS || g === segs[segs.length - 1]) {
      const t = Math.min(Math.max(c - g.s0, 0), g.len);
      return [g.ax + g.dx * t, g.ay + g.dy * t];
    }
    return pts[pts.length - 1];
  };

  const segAt = (s) => segs.find((g) => s <= g.s0 + g.len + EPS) || segs[segs.length - 1];

  // ---- vertical alignment: grade points, straight grades, parabolic curves
  let pvi;
  if (o.profile) {
    pvi = o.profile.map(([s, z]) => [Number(s), Number(z)]).sort((a, b) => a[0] - b[0]);
    if (pvi.length < 2 || pvi.some(([s, z]) => !Number.isFinite(s) || !Number.isFinite(z)))
      throw new Error('road: profile needs two or more finite [chainage, level] points');
    if (Math.abs(pvi[0][0]) > 1e-6 || Math.abs(pvi[pvi.length - 1][0] - L) > 1e-6)
      throw new Error('road: profile must run from chainage 0 to the end of the path');
  } else {
    const n = Math.max(1, Math.round(L / o.spacing)), d = L / n;
    const zAt = (s) => { const [x, y] = pointAt(s); return groundAt(x, y); };
    pvi = [];
    for (let i = 0; i <= n; i++) {
      const s = i * d;
      if (i === 0 || i === n) { pvi.push([s, zAt(s)]); continue; }
      const k = Math.max(4, Math.ceil(d / step));    // mean over [s - d/2, s + d/2], midpoint rule
      let sum = 0;
      for (let j = 0; j < k; j++) sum += zAt(s - d / 2 + (j + 0.5) * d / k);
      pvi.push([s, sum / k]);
    }
  }
  const grades = [];
  for (let i = 0; i < pvi.length - 1; i++) {
    const ds = pvi[i + 1][0] - pvi[i][0];
    if (!(ds > 1e-6)) throw new Error('road: profile chainages must increase');
    grades.push((pvi[i + 1][1] - pvi[i][1]) / ds);
  }
  // Each interior curve is at most as long as the shorter grade either side, so curves never overlap.
  const curves = [];
  for (let i = 1; i < pvi.length - 1; i++) {
    const Lc = Math.min(o.curveLength, pvi[i][0] - pvi[i - 1][0], pvi[i + 1][0] - pvi[i][0]);
    if (Lc > 0) curves.push({ i, s: pvi[i][0], Lc, g1: grades[i - 1], g2: grades[i] });
  }
  function level(s) { // [design level, grade] at chainage s on the centreline
    const c = Math.min(Math.max(s, 0), L);
    for (const v of curves) {
      const x = c - (v.s - v.Lc / 2);
      if (x >= 0 && x <= v.Lc) {
        const r = (v.g2 - v.g1) / v.Lc;
        return [pvi[v.i][1] - v.g1 * v.Lc / 2 + v.g1 * x + r * x * x / 2, v.g1 + r * x];
      }
    }
    let i = 0;
    while (i < grades.length - 1 && c > pvi[i + 1][0]) i++;
    return [pvi[i][1] + grades[i] * (c - pvi[i][0]), grades[i]];
  }
  const designLevel = (s) => level(s)[0];
  const gradeAt = (s) => level(s)[1];
  // Finished level at chainage s and offset off (positive to the left of the direction of travel).
  const fallAt = (off) => (fall === 'crown' ? Math.abs(off) : fall === 'left' ? off : -off) * crossfall;
  const finishedAt = (s, off) => designLevel(s) - fallAt(off);

  // ---- gradient check on the design profile
  const nS = Math.max(1, Math.ceil(L / step)), stations = [];
  for (let k = 0; k <= nS; k++) stations.push(k * L / nS);
  let maxDiff = 0;
  for (const s of stations) { const [x, y] = pointAt(s); maxDiff = Math.max(maxDiff, Math.abs(designLevel(s) - groundAt(x, y))); }
  // The grade diagram is piecewise linear and reaches every tangent grade at a curve end, so the steepest
  // grade is exactly the steepest tangent; the curve ends join the stations so no steep run is missed.
  const maxGrade = grades.reduce((m, g) => Math.max(m, Math.abs(g)), 0);
  const checks = [...new Set([...stations, ...curves.flatMap((c) => [c.s - c.Lc / 2, c.s + c.Lc / 2])])].sort((a, b) => a - b);
  const steepSections = [];
  let open = null;
  for (const s of checks) {
    const g = gradeAt(s);
    if (Math.abs(g) > maxGradient + 1e-12) {
      if (!open) open = { from: s, to: s, maxGrade: 0 };
      open.to = s; open.maxGrade = Math.max(open.maxGrade, Math.abs(g));
    } else if (open) { steepSections.push(open); open = null; }
  }
  if (open) steepSections.push(open);
  // Straight grades are exact: widen each flagged run to where the grade really crosses the limit.
  for (const sec of steepSections) sec.from = edgeOfLimit(sec.from, -1);
  for (const sec of steepSections) sec.to = edgeOfLimit(sec.to, 1);
  function edgeOfLimit(s, dir) {
    let a = s, b = Math.min(Math.max(s + dir * L / nS, 0), L);
    if (Math.abs(gradeAt(b)) > maxGradient) return b;
    for (let k = 0; k < 40; k++) { const m = (a + b) / 2; if (Math.abs(gradeAt(m)) > maxGradient) a = m; else b = m; }
    return a;
  }

  const ratio = Math.max(fillSlope, cutSlope);
  const reach = Math.min(half + ratio * (maxDiff + build + crossfall * half + 2) * 2, half + MAX_REACH);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of pts) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  const bbox = { minX: minX - reach, minY: minY - reach, maxX: maxX + reach, maxY: maxY + reach };

  // Nearest point of the centreline: chainage, signed offset, foot. null past a square end.
  function locate(x, y) {
    let best = null;
    for (let i = 0; i < segs.length; i++) {
      const g = segs[i], px = x - g.ax, py = y - g.ay, t = px * g.dx + py * g.dy;
      if ((i === 0 && t < -EPS) || (i === segs.length - 1 && t > g.len + EPS)) {
        if (!best) best = { d: Infinity, end: true };
        continue;
      }
      const tc = Math.min(Math.max(t, 0), g.len), fx = g.ax + g.dx * tc, fy = g.ay + g.dy * tc;
      const d = Math.hypot(x - fx, y - fy);
      if (!best || d < best.d - EPS) {
        let off = px * g.nx + py * g.ny;
        if (tc !== t) off = Math.sign(off || 1) * d;  // round the outside of a bend
        best = { d, s: g.s0 + tc, off, fx, fy, end: false };
      }
    }
    // A point beyond an end whose nearest in-range foot is farther than the end itself is past the end.
    return best && !best.end && Number.isFinite(best.d) ? best : null;
  }
  const inBox = (x, y) => x >= bbox.minX && x <= bbox.maxX && y >= bbox.minY && y <= bbox.maxY;

  // Batter surface d metres beyond an edge at level zE, against ground g: fill down, cut up, else ground.
  const invCut = inv(cutSlope), invFill = inv(fillSlope);
  const batter = (zE, d, g) => batterZ(g, zE, d, invCut, invFill);

  // Finished surface: what walkers and the drone stand on. g is the ground function to build on.
  function roadHeight(x, y, g = groundAt) {
    const ground = g(x, y);
    if (!inBox(x, y)) return ground;
    const p = locate(x, y);
    if (!p || Math.abs(p.off) > reach) return ground;
    if (Math.abs(p.off) <= half + 1e-9) return finishedAt(p.s, p.off);
    const side = Math.sign(p.off), zE = finishedAt(p.s, side * half);
    return batter(zE, Math.abs(p.off) - half, ground);
  }
  // Earthworks surface at a located point: the formation under the carriageway, the batters beside it.
  function earthworksOf(p, gz) {
    if (Math.abs(p.off) <= half) return finishedAt(p.s, p.off) - build;
    const side = Math.sign(p.off);
    return batter(finishedAt(p.s, side * half), Math.abs(p.off) - half, gz);
  }
  // The same for a plan point; NaN where the road does not touch the ground.
  function earthworksAt(x, y, g = groundAt) {
    const p = inBox(x, y) ? locate(x, y) : null;
    return !p || Math.abs(p.off) > reach ? NaN : earthworksOf(p, g(x, y));
  }
  function onRoad(x, y) {
    const p = inBox(x, y) ? locate(x, y) : null;
    return !!p && Math.abs(p.off) <= half;
  }

  // Cut and fill between the ground and the earthworks surface, one jittered sample per cell. The
  // jitter (a fixed hash of the cell) keeps the sum unbiased and stops a road that runs along the grid
  // axes from aliasing its edges, where the formation steps up to the batter, onto the cell rows.
  function earthworksOn(g = groundAt) {
    const nx = Math.ceil((bbox.maxX - bbox.minX) / cell), ny = Math.ceil((bbox.maxY - bbox.minY) / cell);
    let cut = 0, fill = 0, area = 0;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const x = bbox.minX + (i + jitter(i, j, 0)) * cell, y = bbox.minY + (j + jitter(i, j, 1)) * cell;
      const p = locate(x, y);
      if (!p || Math.abs(p.off) > reach) continue;
      const gz = g(x, y), d = gz - earthworksOf(p, gz);
      if (d > 0) cut += d; else fill -= d;
      if (d !== 0) area++;
    }
    const a = cell * cell;
    return { cutM3: cut * a, fillM3: fill * a, footprintM2: area * a };
  }

  // Where a finished edge sits below the ground just beyond it, the crossfall sheds water against the
  // cut batter: that run needs a side drain. Runs of at least one station, per side, in chainage metres.
  const drainSections = [];
  for (const side of [1, -1]) {
    let run = null;
    for (const s of stations) {
      const [cx, cy] = pointAt(s), gs = segAt(s), off = side * (half + 0.1);
      const inCut = finishedAt(s, side * half) < groundAt(cx + gs.nx * off, cy + gs.ny * off) - 1e-6;
      if (inCut) { if (!run) run = { side: side > 0 ? 'left' : 'right', from: s, to: s }; run.to = s; }
      else if (run) { drainSections.push(run); run = null; }
    }
    if (run) drainSections.push(run);
  }

  // Length along the finished centreline and the pavement materials, layer by layer.
  let length3d = 0;
  for (let k = 1; k < stations.length; k++) {
    const [ax, ay] = pointAt(stations[k - 1]), [bx, by] = pointAt(stations[k]);
    length3d += Math.hypot(bx - ax, by - ay, designLevel(stations[k]) - designLevel(stations[k - 1]));
  }
  const materials = spec.layers.map((l) => ({ ...l, volumeM3: l.thickness * width * length3d }));

  const road = {
    path: pts.map((p) => [...p]), width, surface: o.surface, crossfall, fall, maxGradient, fillSlope, cutSlope,
    buildUp: build, length2d, length3d, bbox, reach, pvi: pvi.map((p) => [...p]),
    curves: curves.map((c) => ({ s: c.s, length: c.Lc, g1: c.g1, g2: c.g2 })),
    maxGrade, steepSections, drainSections, materials, groundAt,
    pointAt, designLevel, gradeAt, finishedAt, locate, onRoad, roadHeight, earthworksAt, earthworksOn,
  };
  let ew = null;
  for (const k of ['cutM3', 'fillM3', 'footprintM2']) {
    Object.defineProperty(road, k, { enumerable: true, get: () => (ew ?? (ew = earthworksOn(groundAt)))[k] });
  }
  return road;
}

// A fixed pseudo-random offset in [0, 1) for cell (i, j), component k (an integer hash, no state).
function jitter(i, j, k) {
  let h = Math.imul(i + 0x9e37, 0x85ebca6b) ^ Math.imul(j + 0x7f4a, 0xc2b2ae35) ^ Math.imul(k + 1, 0x27d4eb2f);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h = Math.imul(h ^ (h >>> 12), 0x297a2d39); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/**
 * composeRoadGround(groundAt, roads) -> a new heightAt with every road built on the ground (lib/earthworks.mjs).
 * Where roads overlap, the one on the carriageway wins; between batters, the first road listed wins.
 */
export const composeRoadGround = (groundAt, roads) => compose(groundAt, { roads: [...roads] });
