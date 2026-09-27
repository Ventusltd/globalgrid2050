// Lightning pack (world.pack.v1). An ILLUSTRATIVE lightning simulation for a site world:
//   - a strike map from ground flash density Ng (flashes per km2 per year), with the collection-area method of
//     IEC 62305-2 for each object and an electro-geometric (rolling sphere) share of the flashes per ground cell;
//   - the rolling-sphere method with the radius set by lightning protection level (IEC 62305-3), rolled over the
//     terrain, tables, stations and towers, to show which points the sphere touches and which it does not;
//   - an animated strike (stepped leader, final jump, return stroke) with a peak current drawn from a seeded
//     log-normal distribution, and, when an earthing grid is known (from the earthing pack or the pin's config),
//     equipotential rings on the ground around that grid.
// It is a picture to reason with. It is not a lightning protection design, a risk assessment or a statement that
// anything is protected or safe. Self-contained ES module: no imports. Deterministic: seeded numbers, fixed steps.

// ------------------------------------------------------------------ published figures (cited by number)

// Rolling-sphere radius r (m) by lightning protection level, IEC 62305-3.
export const LPL_RADIUS = Object.freeze({ I: 20, II: 30, III: 45, IV: 60 });
// Minimum peak current (kA) intercepted at each level, IEC 62305-1; r = 10 * I^0.65 links the two.
export const LPL_MIN_KA = Object.freeze({ I: 3, II: 5, III: 10, IV: 16 });
// Location factor CD, IEC 62305-2 Annex A.
export const LOCATION_FACTOR = Object.freeze({ surrounded_taller: 0.25, surrounded: 0.5, isolated: 1, hilltop: 2 });
// Typical lowland UK ground flash density used when the world gives none (flashes / km2 / year). An editable
// assumption: take the site's value from the national annex map of IEC 62305-2 (or from 0.1 x thunderstorm days).
export const DEFAULT_NG = 0.5;
// First negative stroke peak current, modelled as log-normal with 50 % value 20 kA and 5 % value 90 kA
// (the percentiles tabulated in IEC 62305-1 Annex A). Sigma follows from those two points.
export const STROKE = Object.freeze({ medianKA: 20, p5KA: 90, sigma: Math.log(90 / 20) / 1.6448536269514722 });

// Striking distance (m) for peak current I (kA): r = 10 I^0.65 (IEC 62305-1 Annex A).
export const strikeDistance = kA => 10 * Math.pow(kA, 0.65);
// Ground flash density from thunderstorm days per year: Ng = 0.1 Td (IEC 62305-2 Annex A).
export const ngFromThunderDays = td => 0.1 * td;
// Collection area (m2) of an isolated rectangular structure L x W x H (IEC 62305-2 Annex A); L = W = 0 gives a mast.
export const collectionArea = (L, W, H) => L * W + 2 * (3 * H) * (L + W) + Math.PI * (3 * H) ** 2;
// Expected dangerous flashes per year to a structure: ND = Ng x AD x CD x 1e-6.
export const expectedFlashes = (ng, ad, cd = 1) => ng * ad * cd * 1e-6;
// Ground radius the rolling sphere leaves untouched round a thin mast of height H (flat ground): sqrt(H (2r - H)).
export const mastShadowRadius = (H, r) => (H >= r ? r : Math.sqrt(H * (2 * r - H)));
// Hemispherical electrode in uniform soil: resistance rho / (2 pi a); potential falls as 1/r outside it.
export const hemisphereResistance = (rho, a) => rho / (2 * Math.PI * a);
export const equivalentRadius = (rho, R) => rho / (2 * Math.PI * R);
export const potentialAt = (gpr, req, r) => (r <= req ? gpr : gpr * req / r);
export const stepVoltage = (gpr, req, r, step = 1) => potentialAt(gpr, req, r) - potentialAt(gpr, req, r + step);

export function levelOf(word) {
  const w = String(word ?? '').toUpperCase();
  const map = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', I: 'I', II: 'II', III: 'III', IV: 'IV' };
  return map[w] ?? null;
}

// Seeded pseudo-random numbers (mulberry32).
export function rng(seed = 1) {
  let a = seed >>> 0;
  const f = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return f;
}

// A peak current (kA) from two uniform numbers in (0, 1): log-normal, clamped to 2-300 kA.
export function peakCurrent(u1, u2) {
  const z = Math.sqrt(-2 * Math.log(Math.max(u1, 1e-12))) * Math.cos(2 * Math.PI * u2);
  return Math.min(300, Math.max(2, STROKE.medianKA * Math.exp(STROKE.sigma * z)));
}

// ------------------------------------------------------------------ the rolling sphere on a height field

// Height field over a rectangle of cells (size h, centres at x0 + (i + 0.5) h). top = ground or the tallest object
// in the cell; owner = the object's index, or -1 for bare ground.
export function buildField(area, h, heightAt, objects = []) {
  const nx = Math.max(1, Math.round((area.max[0] - area.min[0]) / h)), ny = Math.max(1, Math.round((area.max[1] - area.min[1]) / h));
  const x0 = area.min[0], y0 = area.min[1], n = nx * ny;
  const ground = new Float64Array(n), top = new Float64Array(n), owner = new Int32Array(n).fill(-1);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i, z = heightAt(x0 + (i + 0.5) * h, y0 + (j + 0.5) * h);
    ground[k] = top[k] = Number.isFinite(z) ? z : 0;
  }
  objects.forEach((o, idx) => {
    const lo = o.min ?? [o.x, o.y], hi = o.max ?? [o.x, o.y];
    let i0 = Math.floor((lo[0] - x0) / h), i1 = Math.floor((hi[0] - x0) / h), j0 = Math.floor((lo[1] - y0) / h), j1 = Math.floor((hi[1] - y0) / h);
    if (o.min) { // a box covers the cells whose centres fall inside it (at least the cell holding its middle)
      i0 = Math.ceil((lo[0] - x0) / h - 0.5); i1 = Math.floor((hi[0] - x0) / h - 0.5); j0 = Math.ceil((lo[1] - y0) / h - 0.5); j1 = Math.floor((hi[1] - y0) / h - 0.5);
      if (i1 < i0) i0 = i1 = Math.floor(((lo[0] + hi[0]) / 2 - x0) / h);
      if (j1 < j0) j0 = j1 = Math.floor(((lo[1] + hi[1]) / 2 - y0) / h);
    }
    for (let j = Math.max(0, j0); j <= Math.min(ny - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(nx - 1, i1); i++) {
      const k = j * nx + i, t = ground[k] + o.h;
      if (t > top[k]) { top[k] = t; owner[k] = idx; }
    }
  });
  return { nx, ny, h, x0, y0, ground, top, owner };
}

// Offsets within the sphere radius (strictly), nearest first, with the height sqrt(r^2 - d^2) of the sphere there.
function kernel(r, h) {
  const m = Math.ceil(r / h), out = [];
  for (let dj = -m; dj <= m; dj++) for (let di = -m; di <= m; di++) {
    const d = h * Math.hypot(di, dj);
    if (d < r) out.push([di, dj, Math.sqrt(r * r - d * d), d]);
  }
  out.sort((a, b) => a[3] - b[3] || a[1] - b[1] || a[0] - b[0]);
  return out;
}

// Electro-geometric model: a leader descending vertically over cell c meets the first surface within r. The height
// of its tip then is zc[c] (the lowest the sphere centre can sit over c) and the point struck is arg[c]. A cell that
// is struck from somewhere is touched by the rolling sphere; count[k] is how many cells' worth of flashes it takes.
export function rollSphere(field, r) {
  const { nx, ny, top } = field, n = nx * ny, K = kernel(r, field.h), m = K.length;
  const DI = Int32Array.from(K, q => q[0]), DJ = Int32Array.from(K, q => q[1]), S = Float64Array.from(K, q => q[2]);
  const zc = new Float64Array(n), arg = new Int32Array(n), count = new Int32Array(n);
  const reach = K.reduce((a, q) => Math.max(a, Math.abs(q[0]), Math.abs(q[1])), 0), OFF = Int32Array.from(K, q => q[1] * nx + q[0]);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const c = j * nx + i, inside = i >= reach && j >= reach && i < nx - reach && j < ny - reach;
    let best = -Infinity, bk = -1;
    if (inside) {
      for (let q = 0; q < m; q++) { const k = c + OFF[q], v = top[k] + S[q]; if (v > best + 1e-9) { best = v; bk = k; } }
    } else {
      for (let q = 0; q < m; q++) {
        const ii = i + DI[q], jj = j + DJ[q];
        if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue;
        const k = jj * nx + ii, v = top[k] + S[q];
        if (v > best + 1e-9) { best = v; bk = k; }
      }
    }
    zc[c] = best; arg[c] = bk; count[bk]++;
  }
  return { r, zc, arg, count };
}

// Lowest height on the side of the column in cell k that the sphere touches: min zc over the ring of cells at
// horizontal distance r to r + 1.5h (their zc leaves the column out). Infinity when the ring is off the field.
export function sideTouchFrom(field, roll, k) {
  const { nx, ny, h } = field, i = k % nx, j = (k - i) / nx, r = roll.r, m = Math.ceil((r + 1.5 * h) / h);
  let lo = Infinity;
  for (let dj = -m; dj <= m; dj++) for (let di = -m; di <= m; di++) {
    const d = h * Math.hypot(di, dj);
    if (d < r || d >= r + 1.5 * h) continue;
    const ii = i + di, jj = j + dj;
    if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue;
    lo = Math.min(lo, roll.zc[jj * nx + ii]);
  }
  return lo;
}

// The point a leader over (x, y) strikes with striking distance r: the surface cell within r that the leader tip
// reaches first, or the ground straight below when no cell is nearer. Returns { x, y, z, k, tip }.
export function strikePoint(field, x, y, r, heightAt) {
  const gz = heightAt(x, y), g = Number.isFinite(gz) ? gz : 0;
  let best = { x, y, z: g, k: -1, tip: g + r };
  if (!field) return best;
  const { nx, ny, h, x0, y0, top } = field, m = Math.ceil(r / h);
  const ci = Math.floor((x - x0) / h), cj = Math.floor((y - y0) / h);
  for (let jj = Math.max(0, cj - m); jj <= Math.min(ny - 1, cj + m); jj++) for (let ii = Math.max(0, ci - m); ii <= Math.min(nx - 1, ci + m); ii++) {
    const cx = x0 + (ii + 0.5) * h, cy = y0 + (jj + 0.5) * h, d = Math.hypot(cx - x, cy - y);
    if (d >= r) continue;
    const k = jj * nx + ii, v = top[k] + Math.sqrt(r * r - d * d);
    if (v > best.tip + 1e-9) best = { x: cx, y: cy, z: top[k], k, tip: v };
  }
  return best;
}

// ------------------------------------------------------------------ drawing helpers

const COLOUR = Object.freeze({
  area: [0.62, 0.66, 0.74, 0.5],
  untouched: [0.45, 0.72, 1, 0.7],     // the sphere does not touch these ground points
  touched: [1, 0.72, 0.25, 0.9],       // raised points the sphere touches (they take more than their own area's flashes)
  high: [1, 0.35, 0.28, 1],            // ten or more cells' worth of flashes, and exposed sides of tall objects
  leader: [0.72, 0.78, 1, 0.65],
  stroke: [1, 1, 1, 1],
  grid: [0.55, 0.9, 0.6, 0.9],
  ring: [0.55, 0.9, 0.6, 0.75]
});

function crosses(cells, size) {
  const p = new Float32Array(cells.length * 12);
  cells.forEach(([x, y, z], i) => p.set([x - size, y, z, x + size, y, z, x, y - size, z, x, y + size, z], i * 12));
  return p;
}

function circle(cx, cy, r, zAt, n = 48) {
  const p = new Float32Array(n * 6);
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * 2 * Math.PI, a1 = ((i + 1) / n) * 2 * Math.PI;
    const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0), x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    p.set([x0, y0, zAt(x0, y0), x1, y1, zAt(x1, y1)], i * 6);
  }
  return p;
}

const polyline = pts => { const p = new Float32Array(Math.max(0, pts.length - 1) * 6); for (let i = 1; i < pts.length; i++) p.set([...pts[i - 1], ...pts[i]], (i - 1) * 6); return p; };
const fmt = (v, d = 0) => (Number.isFinite(v) ? v.toFixed(d) : '-');
const years = nd => (nd > 0 ? `1 in ${nd >= 1 ? fmt(1 / nd, 2) : Math.round(1 / nd)} yr` : 'none');

// ------------------------------------------------------------------ the pack

const T_LEADER = 0.9, T_STROKE = 0.15, T_FADE = 0.6, T_RINGS = 1.2; // seconds of the illustrative animation
const MAX_CELLS = 120;                                               // per side of the map

function createPack() {
  let api = null, on = true, offs = [];
  let ng = DEFAULT_NG, level = 'III', seed = 62305, rand = rng(seed), cloud = 600, towerH = 25, cellWanted = 0, side = 160;
  let areaSet = null, userObjects = [], configObjects = [], earthGrids = [], configGrids = [];
  let lastCtx = null, lastPos = [0, 0, 0];
  let map = null, mapWanted = false, mapGroundVersion = null;
  let strike = null, pendingStrike = null;

  const heightAt = () => (lastCtx && typeof lastCtx.heightAt === 'function' ? lastCtx.heightAt : () => 0);
  const see = ctx => { if (ctx && typeof ctx === 'object') { lastCtx = ctx; if (Array.isArray(ctx.pos)) lastPos = ctx.pos; } };

  function area() {
    if (areaSet) return areaSet;
    const cx = Math.round(lastPos[0] ?? 0), cy = Math.round(lastPos[1] ?? 0);
    return { min: [cx - side / 2, cy - side / 2], max: [cx + side / 2, cy + side / 2] };
  }
  function cellSize(a) {
    const span = Math.max(a.max[0] - a.min[0], a.max[1] - a.min[1]);
    return Math.max(cellWanted || Math.max(1, span / 80), span / MAX_CELLS);
  }
  function towersFromWorld() {
    let t = [];
    try { t = api?.towers?.() ?? []; } catch { t = []; }
    const o = api?.origin?.() ?? { e: 0, n: 0 };
    return (Array.isArray(t) ? t : []).filter(p => Number.isFinite(p?.e) && Number.isFinite(p?.n))
      .map((p, i) => ({ kind: 'tower', name: `grid tower ${i + 1}`, x: p.e - o.e, y: p.n - o.n, h: Number.isFinite(p.h) ? p.h : towerH, cd: LOCATION_FACTOR.isolated, assumedHeight: !Number.isFinite(p.h) }));
  }
  const objects = () => [...configObjects, ...towersFromWorld(), ...userObjects];

  function computeMap() {
    const a = area(), h = cellSize(a), objs = objects(), r = LPL_RADIUS[level];
    // The field reaches r beyond the area, so leaders from just outside it still count for cells near its edge.
    const pad = Math.ceil(r / h) * h;
    const field = buildField({ min: [a.min[0] - pad, a.min[1] - pad], max: [a.max[0] + pad, a.max[1] + pad] }, h, heightAt(), objs), roll = rollSphere(field, r);
    const { nx, ny, x0, y0, ground, top, owner } = field;
    const untouched = [], touched = [], high = [], sides = [];
    const perObject = objs.map(() => 0);
    let nUntouched = 0, cells = 0;
    for (let k = 0; k < nx * ny; k++) {
      const i = k % nx, j = (k - i) / nx, x = x0 + (i + 0.5) * h, y = y0 + (j + 0.5) * h, c = roll.count[k];
      if (owner[k] >= 0) perObject[owner[k]] += c;
      if (x < a.min[0] || y < a.min[1] || x > a.max[0] || y > a.max[1]) continue;
      cells++;
      if (c === 0) { nUntouched++; untouched.push([x, y, top[k] + 0.05]); }
      else if (owner[k] >= 0 || c > 1) (c >= 10 ? high : touched).push([x, y, top[k] + 0.05]);
      if (owner[k] >= 0 && top[k] - ground[k] > h) {
        const from = sideTouchFrom(field, roll, k);
        if (from < top[k] - 0.1) sides.push([x, y, Math.max(from, ground[k]), top[k]]);
      }
    }
    const stats = objs.map((o, idx) => {
      const L = o.min ? o.max[0] - o.min[0] : 0, W = o.min ? o.max[1] - o.min[1] : 0, ad = collectionArea(L, W, o.h);
      const cd = Number.isFinite(o.cd) ? o.cd : o.kind === 'table' ? LOCATION_FACTOR.surrounded : LOCATION_FACTOR.isolated;
      return { name: o.name ?? `${o.kind} ${idx + 1}`, kind: o.kind, h: o.h, ad, cd, nd: expectedFlashes(ng, ad, cd), sphereNd: expectedFlashes(ng, perObject[idx] * h * h), assumedHeight: !!o.assumedHeight };
    });
    const size = Math.min(0.4 * h, 1.5), key = `${level}@${ng}@${h}@${nx}x${ny}@${objs.length}@${a.min.join(',')}`;
    map = {
      level, r, h, nx: Math.round((a.max[0] - a.min[0]) / h), ny: Math.round((a.max[1] - a.min[1]) / h), area: a, stats, nUntouched, cells, field, sides, key,
      origin: [(a.min[0] + a.max[0]) / 2, (a.min[1] + a.max[1]) / 2, 0],
      batches: []
    };
    const o = map.origin, rel = pts => pts.map(p => [p[0] - o[0], p[1] - o[1], p[2]]);
    const b = (name, colour, positions) => positions.length && map.batches.push({ key: name, version: key, origin: o, color: colour, positions });
    b('area', COLOUR.area, polyline(rel([[a.min[0], a.min[1], heightAt()(a.min[0], a.min[1]) || 0], [a.max[0], a.min[1], heightAt()(a.max[0], a.min[1]) || 0], [a.max[0], a.max[1], heightAt()(a.max[0], a.max[1]) || 0], [a.min[0], a.max[1], heightAt()(a.min[0], a.max[1]) || 0], [a.min[0], a.min[1], heightAt()(a.min[0], a.min[1]) || 0]])));
    b('untouched', COLOUR.untouched, crosses(rel(untouched), size));
    b('touched', COLOUR.touched, crosses(rel(touched), size));
    b('high', COLOUR.high, new Float32Array([...crosses(rel(high), size), ...sides.flatMap(([x, y, z0, z1]) => [x - o[0], y - o[1], z0, x - o[0], y - o[1], z1])]));
    mapGroundVersion = lastCtx?.groundVersion ?? null;
    map.noGround = !lastCtx;
    api?.events?.emit('exposure', { level, radius: r, ng, cell: h, cells, untouched: nUntouched, sideExposed: sides.length });
    return map;
  }

  // ---------------------------------------------------------------- the animated strike

  function planStrike(req) {
    const a = area(), hA = heightAt();
    const lx = req.x ?? a.min[0] + rand() * (a.max[0] - a.min[0]);
    const ly = req.y ?? a.min[1] + rand() * (a.max[1] - a.min[1]);
    const kA = req.kA ?? peakCurrent(rand(), rand());
    const r = strikeDistance(kA);
    let field = map?.field;
    const inside = field && lx >= a.min[0] && ly >= a.min[1] && lx <= a.max[0] && ly <= a.max[1];
    if (!inside) {
      const h = Math.max(1, (2 * r + 2) / 100);
      field = buildField({ min: [lx - r - h, ly - r - h], max: [lx + r + h, ly + r + h] }, h, hA, objects());
    }
    const p = strikePoint(field, lx, ly, r, hA), objs = objects();
    const hit = p.k >= 0 && field.owner[p.k] >= 0 ? objs[field.owner[p.k]] : null;
    if (hit && !hit.min) { p.x = hit.x; p.y = hit.y; } // a mast is struck at its top, not at its cell's centre
    // Leader path: from the cloud over (lx, ly) down to the tip at height p.tip, then the final jump to the point.
    const top = p.tip + cloud, N = 48, pts = [], lat = [0, 0];
    for (let s = 0; s <= N; s++) {
      const f = s / N;
      if (s > 0 && s < N) { lat[0] += (rand() - 0.5) * 0.7 * (cloud / N); lat[1] += (rand() - 0.5) * 0.7 * (cloud / N); }
      const decay = s === N ? 0 : 1 - f * 0.6;
      pts.push([lx + lat[0] * decay - p.x, ly + lat[1] * decay - p.y, top + (p.tip - top) * f - p.z]);
    }
    pts.push([0, 0, 0]);
    const branches = [];
    for (let b = 0; b < 4; b++) {
      const at = 4 + Math.floor(rand() * (N * 0.7)), dir = rand() * 2 * Math.PI, len = 5 + Math.floor(rand() * 6), br = [pts[at]];
      for (let s = 1; s <= len; s++) {
        const q = br[s - 1], step = cloud / N;
        br.push([q[0] + Math.cos(dir) * step * 0.6 + (rand() - 0.5) * step * 0.4, q[1] + Math.sin(dir) * step * 0.6 + (rand() - 0.5) * step * 0.4, q[2] - step * (0.6 + rand() * 0.4)]);
      }
      branches.push({ at, pts: br });
    }
    // Rings from the earthing grid the point lies on (with a small margin), if one is known.
    const grids = [...configGrids, ...earthGrids], margin = 2;
    const g = grids.find(q => p.x >= q.min[0] - margin && p.y >= q.min[1] - margin && p.x <= q.max[0] + margin && p.y <= q.max[1] + margin) ?? null;
    let rings = null;
    if (g) {
      const gx = (g.min[0] + g.max[0]) / 2, gy = (g.min[1] + g.max[1]) / 2, halfDiag = Math.hypot(g.max[0] - g.min[0], g.max[1] - g.min[1]) / 2;
      const req = equivalentRadius(g.rho, g.resistance), gpr = kA * g.resistance; // kV, if the whole stroke current enters this grid
      const zr = (x, y) => { const z = hA(x, y); return (Number.isFinite(z) ? z : p.z) + 0.1 - p.z; };
      const levels = [0.5, 0.25, 0.1, 0.05].map(f => ({ f, r: req / f })).filter(q => q.r > halfDiag);
      rings = {
        gpr, req, grid: g, levels: levels.map(q => ({ f: q.f, r: q.r, step: stepVoltage(gpr * 1000, req, q.r) })),
        outline: polyline([[g.min[0], g.min[1]], [g.max[0], g.min[1]], [g.max[0], g.max[1]], [g.min[0], g.max[1]], [g.min[0], g.min[1]]].map(([x, y]) => [x - p.x, y - p.y, zr(x, y)])),
        circles: levels.map(q => circle(gx - p.x, gy - p.y, q.r, (x, y) => zr(x + p.x, y + p.y)))
      };
    }
    strike = { kA, r, leader: [lx, ly], point: p, hit, pts, branches, rings, t: 0, emitted: false, n: (strike?.n ?? 0) + 1 };
  }

  const strikeDone = () => !strike || strike.t >= T_LEADER + T_STROKE + T_FADE + T_RINGS;

  function strikeBatches() {
    if (!strike) return [];
    const s = strike, o = [s.point.x, s.point.y, s.point.z], t = s.t, out = [], N = s.pts.length - 1;
    const tag = `${s.n}@${Math.min(Math.round(t / (1 / 60)), 1e6)}`;
    if (t < T_LEADER + T_STROKE + T_FADE) {
      const k = t < T_LEADER ? Math.max(1, Math.floor((t / T_LEADER) * (N - 1))) : N;
      const channel = polyline(s.pts.slice(0, k + 1));
      const br = s.branches.filter(b => b.at < k).flatMap(b => [...polyline(b.pts.slice(0, Math.min(b.pts.length, k - b.at + 1)))]);
      let colour = COLOUR.leader;
      if (t >= T_LEADER && t < T_LEADER + T_STROKE) colour = COLOUR.stroke;
      else if (t >= T_LEADER + T_STROKE) colour = [1, 1, 1, Math.max(0.05, 1 - (t - T_LEADER - T_STROKE) / T_FADE)];
      out.push({ key: 'channel', version: tag, origin: o, color: colour, positions: new Float32Array([...channel, ...br]) });
    }
    if (s.rings && t >= T_LEADER) {
      const grow = Math.min(1, (t - T_LEADER) / T_RINGS), shown = Math.max(1, Math.ceil(grow * s.rings.circles.length));
      const pos = new Float32Array([...s.rings.outline, ...s.rings.circles.slice(0, shown).flatMap(c => [...c])]);
      out.push({ key: 'rings', version: `${s.n}@${shown}`, origin: o, color: COLOUR.ring, positions: pos });
    }
    out.push({ key: 'point', version: `${s.n}`, origin: o, color: COLOUR.high, positions: crosses([[0, 0, 0.1]], 1.5) });
    return out;
  }

  // ---------------------------------------------------------------- commands

  function report() {
    const m = map ?? computeMap();
    if (!m.stats.length) return `No objects in the area. Ng ${ng}/km2/yr, LPL ${level}, sphere ${m.r} m (illustrative).`;
    return m.stats.map(s => `${s.name} ${fmt(s.h, 1)} m${s.assumedHeight ? ' (height assumed)' : ''}: AD ${fmt(s.ad)} m2, CD ${s.cd}, ND ${s.nd.toExponential(2)}/yr (${years(s.nd)}); sphere-model share ${s.sphereNd.toExponential(2)}/yr`).join('\n') +
      `\nIEC 62305-2 collection areas and an illustrative sphere model; not a risk assessment and not a statement of safety.`;
  }

  const num = (w, what) => { const v = Number(w); if (!Number.isFinite(v)) throw Error(`${what} must be a number`); return v; };

  function run(args) {
    const w = (args[0] || 'help').toLowerCase(), a = args.slice(1);
    if (w === 'help') return 'lightning map · lpl I-IV · ng 0.5 · strike [x y [kA]] · add tower x y h · add table|station x0 y0 x1 y1 h · area 200 · report · clear';
    if (w === 'map') {
      if (a[0]) { const l = levelOf(a[0]); if (!l) throw Error('the level is I, II, III or IV'); level = l; }
      mapWanted = true; const m = computeMap();
      return `LPL ${m.level}: sphere ${m.r} m over ${m.nx} x ${m.ny} cells of ${fmt(m.h, 1)} m; ${m.nUntouched} not touched, ${m.sides.length} exposed sides (illustrative)`;
    }
    if (w === 'lpl') {
      const l = levelOf(a[0]); if (!l) throw Error('the level is I, II, III or IV: lightning lpl III');
      level = l; if (map) computeMap();
      return `LPL ${l}: rolling sphere ${LPL_RADIUS[l]} m (IEC 62305-3), minimum peak current ${LPL_MIN_KA[l]} kA`;
    }
    if (w === 'ng') {
      const v = num(a[0], 'Ng'); if (v <= 0 || v > 100) throw Error('Ng is flashes per km2 per year, above 0 and at most 100');
      ng = v; if (map) computeMap();
      return `Ng ${v} flashes/km2/yr (take the site value from the national annex of IEC 62305-2)`;
    }
    if (w === 'area') {
      if (a.length === 1) { const s = num(a[0], 'the side'); if (s < 10 || s > 2000) throw Error('the side is 10 to 2000 m'); side = s; areaSet = null; }
      else if (a.length === 4) {
        const [x0, y0, x1, y1] = a.map(v => num(v, 'a corner'));
        if (x1 - x0 < 10 || y1 - y0 < 10 || x1 - x0 > 2000 || y1 - y0 > 2000) throw Error('the area is 10 to 2000 m a side, lower-left corner first');
        areaSet = { min: [x0, y0], max: [x1, y1] };
      } else throw Error('lightning area 200 (a square round you) or lightning area x0 y0 x1 y1');
      if (map) computeMap();
      const ar = area(); return `area ${fmt(ar.max[0] - ar.min[0])} x ${fmt(ar.max[1] - ar.min[1])} m`;
    }
    if (w === 'add') {
      const kind = (a[0] || '').toLowerCase(), v = a.slice(1).map(x => num(x, 'each value'));
      if (kind === 'tower' && v.length === 3) {
        if (v[2] <= 0 || v[2] > 400) throw Error('a tower is 0 to 400 m tall');
        userObjects.push({ kind, name: `tower ${userObjects.length + 1}`, x: v[0], y: v[1], h: v[2], cd: LOCATION_FACTOR.isolated });
      } else if ((kind === 'table' || kind === 'station') && v.length === 5) {
        const [x0, y0, x1, y1, h] = v;
        if (!(x1 > x0 && y1 > y0) || h <= 0 || h > 100) throw Error(`lightning add ${kind} x0 y0 x1 y1 h (lower-left corner first, height 0 to 100 m)`);
        userObjects.push({ kind, name: `${kind} ${userObjects.length + 1}`, min: [x0, y0], max: [x1, y1], h, cd: kind === 'table' ? LOCATION_FACTOR.surrounded : LOCATION_FACTOR.isolated });
      } else throw Error('lightning add tower x y h  or  lightning add table|station x0 y0 x1 y1 h');
      if (map) computeMap();
      return `added ${userObjects[userObjects.length - 1].name}`;
    }
    if (w === 'strike') {
      const v = a.map(x => num(x, 'each value'));
      if (v.length !== 0 && v.length !== 2 && v.length !== 3) throw Error('lightning strike, lightning strike x y, or lightning strike x y kA');
      if (v.length === 3 && (v[2] < 2 || v[2] > 300)) throw Error('the peak current is 2 to 300 kA');
      pendingStrike = v.length ? { x: v[0], y: v[1], kA: v[2] } : {};
      planStrike(pendingStrike); pendingStrike = null;
      const s = strike;
      api?.invalidate?.({ ground: false });
      return `illustrative strike ${fmt(s.kA, 1)} kA (striking distance ${fmt(s.r)} m) at ${fmt(s.point.x)} ${fmt(s.point.y)} m${s.hit ? ' on ' + (s.hit.name ?? s.hit.kind) : ''}`;
    }
    if (w === 'report') return report();
    if (w === 'seed') { seed = Math.trunc(num(a[0], 'the seed')) >>> 0; rand = rng(seed); return `seed ${seed}`; }
    if (w === 'clear') { userObjects = []; map = null; mapWanted = false; strike = null; return 'lightning cleared'; }
    throw Error('lightning help lists the words');
  }

  return {
    init(a) {
      api = a;
      const c = a.config || {};
      if (Number.isFinite(c.ng) && c.ng > 0) ng = c.ng;
      else if (Number.isFinite(c.thunderDays) && c.thunderDays > 0) ng = ngFromThunderDays(c.thunderDays);
      if (levelOf(c.lpl)) level = levelOf(c.lpl);
      if (Number.isInteger(c.seed)) { seed = c.seed >>> 0; rand = rng(seed); }
      if (Number.isFinite(c.cloud) && c.cloud > 50) cloud = c.cloud;
      if (Number.isFinite(c.towerHeight) && c.towerHeight > 0) towerH = c.towerHeight;
      if (Number.isFinite(c.cell) && c.cell > 0) cellWanted = c.cell;
      if (Number.isFinite(c.side) && c.side >= 10) side = c.side;
      if (c.area && Array.isArray(c.area.min) && Array.isArray(c.area.max)) areaSet = { min: [...c.area.min], max: [...c.area.max] };
      if (Array.isArray(c.objects)) configObjects = c.objects.filter(o => o && Number.isFinite(o.h) && o.h > 0 && (Array.isArray(o.min) ? Array.isArray(o.max) : Number.isFinite(o.x) && Number.isFinite(o.y)))
        .map((o, i) => ({ ...o, kind: String(o.kind ?? 'object'), name: String(o.name ?? `${o.kind ?? 'object'} ${i + 1}`).slice(0, 24) }));
      configGrids = readGrids(c.earthing);
      if (c.map === true) mapWanted = true;
      if (c.strike) pendingStrike = typeof c.strike === 'object' ? { x: c.strike.x, y: c.strike.y, kA: c.strike.kA } : {};
      offs.push(a.events.on('world/pose', p => { if (Array.isArray(p?.pos)) lastPos = [...p.pos]; }));
      offs.push(a.events.on('earthing/grid', p => { earthGrids = readGrids(p); }));
      try { a.events.emit('need-earthing', { from: 'lightning' }); } catch { /* nobody has to answer */ }
    },
    setEnabled(v) { on = !!v; },
    step(dt, ctx) {
      see(ctx);
      if (pendingStrike) { planStrike(pendingStrike); pendingStrike = null; }
      if (!strike || strikeDone()) return;
      strike.t += dt;
      if (!strike.emitted && strike.t >= T_LEADER) {
        strike.emitted = true;
        api?.events?.emit('strike', { x: strike.point.x, y: strike.point.y, peakKA: Math.round(strike.kA * 10) / 10, illustrative: true });
      }
    },
    active() { return on && !!strike && !strikeDone(); },
    lines(ctx) {
      see(ctx);
      if (mapWanted && !map) computeMap(); // once; a later ground change is shown in the HUD, not recomputed in a frame
      if (pendingStrike) { planStrike(pendingStrike); pendingStrike = null; }
      return [...(map ? map.batches : []), ...strikeBatches()];
    },
    hud() {
      const out = [{ id: 'level', text: `Ng ${ng}/km2/yr · LPL ${level} · sphere ${LPL_RADIUS[level]} m` + (map ? ` · ${map.nUntouched}/${map.cells} not touched` : '') }];
      if (map && lastCtx && (map.noGround || (lastCtx.groundVersion ?? null) !== mapGroundVersion)) out[0] = { id: 'level', text: `ground ${map.noGround ? 'was not known' : 'has changed'} when mapped: type lightning map to redraw` };
      if (map && map.stats.length) {
        const s = map.stats.reduce((x, y) => (y.nd > x.nd ? y : x));
        out.push({ id: 'object', text: `${s.name} ${fmt(s.h)} m: ND ${s.nd.toExponential(1)}/yr (${years(s.nd)}), IEC 62305-2` });
      }
      if (strike) {
        out.push({ id: 'strike', text: `strike ${fmt(strike.kA, 1)} kA, r ${fmt(strike.r)} m, at ${fmt(strike.point.x)} ${fmt(strike.point.y)} m${strike.hit ? ' on ' + (strike.hit.name ?? strike.hit.kind) : ''}` });
        const R = strike.rings;
        out.push({ id: 'rings', text: R ? `GPR ${fmt(R.gpr, 1)} kV if all current enters grid; rings ${R.levels.map(q => q.f * 100).join('/')} % of GPR` : 'no earthing grid under the point: no rings' });
      }
      return out.map(h => ({ id: h.id, text: h.text.slice(0, 80) }));
    },
    commands() { return [{ verb: 'lightning', run }]; },
    dispose() {
      while (offs.length) { try { offs.pop()(); } catch { /* already gone */ } }
      api = null; map = null; strike = null; pendingStrike = null; userObjects = []; earthGrids = []; lastCtx = null;
    }
  };
}

// Earthing grids as { min: [x, y], max: [x, y], resistance (ohm), rho (ohm m) } in local metres. Anything else is skipped.
function readGrids(p) {
  const list = Array.isArray(p) ? p : Array.isArray(p?.grids) ? p.grids : [];
  return list.filter(g => g && Array.isArray(g.min) && Array.isArray(g.max) && [...g.min, ...g.max].every(Number.isFinite) &&
    g.max[0] > g.min[0] && g.max[1] > g.min[1] && Number.isFinite(g.resistance) && g.resistance > 0 && Number.isFinite(g.rho) && g.rho > 0)
    .map(g => ({ id: String(g.id ?? ''), min: [g.min[0], g.min[1]], max: [g.max[0], g.max[1]], resistance: g.resistance, rho: g.rho }));
}

export { createPack };
export default createPack();
