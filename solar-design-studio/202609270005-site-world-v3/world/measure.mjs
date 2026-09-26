// measure.mjs: what the design tools and panels say about the real ground.
//
// Local metres: x east, y north, z up, as camera.mjs. The ground is any function
// groundAt(x, y). Every function here is pure: no imports, no DOM, no WebGL.
// Callers pass in what they have: a groundAt, a trench from trench.mjs, a route
// from cable-route.mjs, the parsed web/world/data/cables.json.
//
// Numbers come back raw (metres, cubic metres, fractions). measure-format.mjs
// turns them into plain British English lines, joined with " · ", for example
//   "Trench 124.6 m (3D 125.1 m) · spoil 98.4 m³ · 1 bend below 1.05 m"

const EPS = 1e-9;

// ---------------------------------------------------------------- distances

/** Plan distance between [x, y(, z)] points. */
export function distance2d(a, b) {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

/** Slope distance between [x, y, z] points (a missing z counts as 0). */
export function distance3d(a, b) {
  return Math.hypot(b[0] - a[0], b[1] - a[1], (b[2] ?? 0) - (a[2] ?? 0));
}

/** Plan length of a polyline [[x, y], ...]. */
export function polylineLength2d(points) {
  let s = 0;
  for (let k = 1; k < points.length; k++) s += distance2d(points[k - 1], points[k]);
  return s;
}

// ---------------------------------------------------------------- areas

/** Signed plan area by the shoelace formula: positive anticlockwise. */
export function signedArea(polygon) {
  let a = 0;
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const p = polygon[i], q = polygon[(i + 1) % n];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

/** Plan area of a simple polygon [[x, y], ...], either winding, closed or not. */
export function areaOfPolygon(polygon) {
  const pts = openRing(polygon);
  if (pts.length < 3) return 0;
  return Math.abs(signedArea(pts));
}

// Drop a repeated closing vertex so the ring is listed once.
function openRing(polygon) {
  const pts = polygon.map((p) => [Number(p[0]), Number(p[1])]);
  if (pts.length > 1) {
    const a = pts[0], b = pts[pts.length - 1];
    if (Math.abs(a[0] - b[0]) < EPS && Math.abs(a[1] - b[1]) < EPS) pts.pop();
  }
  return pts;
}

// Even-odd point in polygon, the same crossing test as lidar/src/earthworks_pair.py
// inside_poly: edge (i, i-1), skip horizontal edges, count crossings to the right.
function insidePoly(x, y, vx, vy) {
  let ins = false;
  const n = vx.length;
  for (let i = 0; i < n; i++) {
    const j = (i - 1 + n) % n;
    const x1 = vx[i], y1 = vy[i], x2 = vx[j], y2 = vy[j];
    if (y1 === y2) continue;
    if ((y1 > y) !== (y2 > y) && x < x1 + (y - y1) * (x2 - x1) / (y2 - y1)) ins = !ins;
  }
  return ins;
}

// ---------------------------------------------------------------- profiles

/**
 * profile(groundAt, points, step = 1)
 * Samples the ground along a plan polyline every `step` metres and at every
 * vertex. Returns
 *   samples   [{ chainage, x, y, z }]
 *   pairs     [[chainage, z]]
 *   length2d, length3d (along the sampled ground)
 *   min, max  lowest and highest ground, with chainageOfMin / chainageOfMax
 *   start, end, rise (total climbing), fall (total descending, positive)
 *   gradient  { net, maxUp, maxDown, max }: fractions (0.05 = 5 %); net is
 *             (end - start) / length2d, maxUp the steepest climb between two
 *             samples, maxDown the steepest descent (positive), max the larger.
 */
export function profile(groundAt, points, step = 1) {
  if (typeof groundAt !== 'function') throw new Error('profile: groundAt must be a function');
  if (!Array.isArray(points) || points.length < 2) throw new Error('profile: needs at least two points');
  if (!(step > 0)) throw new Error('profile: step must be positive');

  const samples = [];
  let s0 = 0;
  for (let k = 0; k < points.length - 1; k++) {
    const a = points[k], b = points[k + 1];
    const len = distance2d(a, b);
    if (len < EPS) continue;
    const pieces = Math.max(1, Math.ceil(len / step - 1e-9));
    for (let j = samples.length ? 1 : 0; j <= pieces; j++) {
      const u = j / pieces;
      const x = a[0] + (b[0] - a[0]) * u, y = a[1] + (b[1] - a[1]) * u;
      samples.push({ chainage: s0 + len * u, x, y, z: groundAt(x, y) });
    }
    s0 += len;
  }
  if (!samples.length) throw new Error('profile: path needs two distinct points');

  let min = Infinity, max = -Infinity, sMin = 0, sMax = 0;
  let rise = 0, fall = 0, maxUp = 0, maxDown = 0, len3 = 0;
  for (let k = 0; k < samples.length; k++) {
    const p = samples[k];
    if (p.z < min) { min = p.z; sMin = p.chainage; }
    if (p.z > max) { max = p.z; sMax = p.chainage; }
    if (k === 0) continue;
    const q = samples[k - 1];
    const ds = p.chainage - q.chainage, dz = p.z - q.z;
    len3 += Math.hypot(ds, dz);
    if (dz > 0) rise += dz; else fall -= dz;
    if (ds > EPS) {
      const g = dz / ds;
      if (g > maxUp) maxUp = g;
      if (-g > maxDown) maxDown = -g;
    }
  }
  const start = samples[0].z, end = samples[samples.length - 1].z;
  return {
    samples,
    pairs: samples.map((p) => [p.chainage, p.z]),
    length2d: s0,
    length3d: len3,
    min, max, chainageOfMin: sMin, chainageOfMax: sMax,
    start, end, rise, fall,
    gradient: { net: s0 > 0 ? (end - start) / s0 : 0, maxUp, maxDown, max: Math.max(maxUp, maxDown) },
  };
}

/**
 * slopeAlong(groundAt, at, direction, h = 0.5)
 * Ground gradient at plan point `at` = [x, y] in plan direction `direction` =
 * [dx, dy] (any length), by central difference over +/- h metres. Positive
 * means the ground climbs that way. A fraction: 0.05 is 5 %, 1 in 20.
 */
export function slopeAlong(groundAt, at, direction, h = 0.5) {
  const l = Math.hypot(direction[0], direction[1]);
  if (!(l > 0)) throw new Error('slopeAlong: direction must be non-zero');
  if (!(h > 0)) throw new Error('slopeAlong: h must be positive');
  const ux = direction[0] / l, uy = direction[1] / l;
  const zf = groundAt(at[0] + ux * h, at[1] + uy * h);
  const zb = groundAt(at[0] - ux * h, at[1] - uy * h);
  return (zf - zb) / (2 * h);
}

// ---------------------------------------------------------------- platforms

/**
 * cutFillForPlatform(groundAt, polygon, level, cell = 0.5) -> { cut, fill, area, ... }
 * A flat platform at `level` over a plan polygon. Ground above the level is cut,
 * ground below is filled. Midpoint rule over square cells of side `cell`.
 *
 * The same shape as the electron count in lidar/src/earthworks_pair.py
 * platform_pair, so the browser and the GPU agree when the cell matches its
 * step (CELL / SUB = 0.025 m): grid anchored at floor(min x), floor(min y);
 * nx = ceil((max x - x0) / cell) columns; cell centres at x0 + (i + 0.5) cell;
 * the same even-odd crossing test; cut = sum max(ground - level, 0) x cell²,
 * fill = sum max(level - ground, 0) x cell².
 *
 * Returns cut and fill (m³), area (m², the counted cells, the plan area the
 * volumes stand on), polygonArea (exact shoelace), cells, meanGround, level.
 */
export function cutFillForPlatform(groundAt, polygon, level, cell = 0.5) {
  if (typeof groundAt !== 'function') throw new Error('cutFillForPlatform: groundAt must be a function');
  if (!Number.isFinite(level)) throw new Error('cutFillForPlatform: level must be a number');
  if (!(cell > 0)) throw new Error('cutFillForPlatform: cell must be positive');
  const pts = openRing(polygon);
  if (pts.length < 3) throw new Error('cutFillForPlatform: polygon needs three points');
  const vx = pts.map((p) => p[0]), vy = pts.map((p) => p[1]);
  const x0 = Math.floor(Math.min(...vx)), y0 = Math.floor(Math.min(...vy));
  const nx = Math.ceil((Math.max(...vx) - x0) / cell), ny = Math.ceil((Math.max(...vy) - y0) / cell);
  let cut = 0, fill = 0, cells = 0, sumZ = 0;
  for (let j = 0; j < ny; j++) {
    const y = y0 + (j + 0.5) * cell;
    for (let i = 0; i < nx; i++) {
      const x = x0 + (i + 0.5) * cell;
      if (!insidePoly(x, y, vx, vy)) continue;
      const z = groundAt(x, y);
      const dz = z - level;
      if (dz > 0) cut += dz; else fill -= dz;
      sumZ += z;
      cells++;
    }
  }
  const a = cell * cell;
  return {
    cut: cut * a,
    fill: fill * a,
    area: cells * a,
    polygonArea: Math.abs(signedArea(pts)),
    cells,
    cell,
    level,
    meanGround: cells ? sumZ / cells : NaN,
  };
}

// ---------------------------------------------------------------- trenches

// Plan turn at each interior vertex of a path, degrees (0 = straight on).
function pathBends(path) {
  const bends = [];
  for (let i = 1; i < path.length - 1; i++) {
    const a = path[i - 1], b = path[i], c = path[i + 1];
    const d1x = b[0] - a[0], d1y = b[1] - a[1], d2x = c[0] - b[0], d2y = c[1] - b[1];
    if (Math.hypot(d1x, d1y) < EPS || Math.hypot(d2x, d2y) < EPS) continue;
    const t = Math.atan2(d1x * d2y - d1y * d2x, d1x * d2x + d1y * d2y);
    const deg = Math.abs(t) * 180 / Math.PI;
    if (deg > 1e-6) bends.push({ index: i, turnDeg: deg, direction: t > 0 ? 'left' : 'right' });
  }
  return bends;
}

/**
 * trenchSummary(trench, groundAt?) using createTrench from trench.mjs.
 * groundAt defaults to the one the trench was made with; without either, the
 * 3D length and spoil come back null rather than guessed.
 * Returns { length2d, length3d, width, depth, benchSlope, spoil, floorArea, bends }.
 * Bends are the mitred plan corners of the centreline (a trench has no radius).
 */
export function trenchSummary(trench, groundAt = null) {
  if (!trench || !Array.isArray(trench.path)) throw new Error('trenchSummary: needs a trench from createTrench');
  let length3d = null, spoil = null;
  if (groundAt) {
    length3d = trench.length3dOn(groundAt);
    spoil = trench.spoilVolumeOn(groundAt);
  } else {
    try { length3d = trench.length3d; spoil = trench.spoilVolumeM3; } catch { /* no ground: leave null */ }
  }
  return {
    length2d: trench.length2d,
    length3d,
    width: trench.width,
    depth: trench.depth,
    benchSlope: trench.benchSlope,
    spoil,
    floorArea: trench.length2d * trench.width,
    bends: pathBends(trench.path),
  };
}

// ---------------------------------------------------------------- cables

/**
 * bendRule(cables, { voltageKv, construction?, when, odMm })
 * The governing (largest) minimum bend radius from cables.json rules that match
 * the voltage and the chosen stage. `when` must be 'final' or 'installation';
 * there is no default, because the two differ by a third or more.
 * With no construction, every construction at that voltage is considered and
 * the largest wins (the safe side). Rules with no multiple are listed as skipped.
 */
export function bendRule(cables, { voltageKv, construction = null, when, odMm }) {
  if (when !== 'final' && when !== 'installation') {
    throw new Error("bendRule: choose when: 'final' or 'installation'");
  }
  if (!(odMm > 0)) throw new Error('bendRule: odMm must be positive');
  const rules = (cables && cables.rules) || [];
  const match = rules.filter((r) => r.voltage_kv === voltageKv && r.when === when
    && (construction == null || r.construction === construction));
  const usable = match.filter((r) => Number.isFinite(r.multiple_of_od));
  const skipped = match.filter((r) => !Number.isFinite(r.multiple_of_od));
  if (!usable.length) return { when, multiple: null, radius: null, rule: null, considered: 0, skipped };
  const rule = usable.reduce((a, b) => (b.multiple_of_od > a.multiple_of_od ? b : a));
  return {
    when,
    multiple: rule.multiple_of_od,
    radius: rule.multiple_of_od * odMm / 1000,
    rule,
    considered: usable.length,
    skipped,
  };
}

/**
 * cableSummary(route, { cables, cableId | (voltageKv, odMm), construction?, when })
 * route: the output of routeCable in cable-route.mjs.
 * cables: the parsed web/world/data/cables.json.
 * when: 'final' or 'installation', required.
 * Each arc is checked at its tightest core axis (the centreline radius less the
 * core offset on the inside of the turn) and at the centreline. A bend is below
 * the rule when its tightest core radius is under the required radius.
 * Returns { length2d, length3d, formation, cable, required, bends, below, compliant,
 *           routeViolations }. compliant is null when no rule applies.
 */
export function cableSummary(route, opts = {}) {
  if (!route || !Array.isArray(route.segments)) throw new Error('cableSummary: needs a route from routeCable');
  const { cables = null, cableId = null, construction = null, when } = opts;
  if (when !== 'final' && when !== 'installation') {
    throw new Error("cableSummary: choose when: 'final' or 'installation'");
  }
  let cable = null;
  if (cableId != null) {
    cable = ((cables && cables.cables) || []).find((c) => c.id === cableId) || null;
    if (!cable) throw new Error(`cableSummary: unknown cable ${cableId}`);
  }
  const voltageKv = opts.voltageKv ?? cable?.voltage_kv;
  const odMm = opts.odMm ?? cable?.od_mm;
  const required = (voltageKv != null && odMm > 0)
    ? bendRule(cables, { voltageKv, construction, when, odMm })
    : { when, multiple: null, radius: null, rule: null, considered: 0, skipped: [] };

  const cores = route.cores || [];
  const leftMost = Math.max(0, ...cores.map((c) => c.lateral));
  const rightMost = Math.max(0, ...cores.map((c) => -c.lateral));
  const bends = route.segments.filter((g) => g.type === 'arc').map((g) => {
    const inner = g.radius - (g.turn > 0 ? leftMost : rightMost);
    const ok = required.radius == null ? null : inner >= required.radius - 1e-9;
    return {
      index: g.index,
      chainage: (g.s0 + g.s1) / 2,
      turnDeg: Math.abs(g.turn) * 180 / Math.PI,
      radius: g.radius,
      innerRadius: inner,
      ok,
    };
  });
  const below = bends.filter((b) => b.ok === false);
  return {
    length2d: route.length2d,
    length3d: route.length3d,
    formation: route.formation,
    cable: cable ? { id: cable.id, voltageKv: cable.voltage_kv, csaMm2: cable.csa_mm2, odMm: cable.od_mm, odStatus: cable.od_status }
      : { id: null, voltageKv: voltageKv ?? null, csaMm2: null, odMm: odMm ?? null, odStatus: null },
    required,
    bends,
    below,
    compliant: required.radius == null ? null : below.length === 0,
    routeViolations: route.violations || [],
  };
}
