// Overhead lines: lattice towers, wood poles and catenary conductors as light wireframe. Pure: no imports, no DOM.
// Local east (x), north (y), up (z), metres. Output lines are gl.LINES pairs: x,y,z, x,y,z per segment.
//
// buildOverhead(towers, opts) -> { lines: Float32Array, solids: [{ min, max }],
//   clearances: [{ span, minClearance, at, conductor, required, requiredOverRoad, source, basis }],
//   wires: [{ span, conductor, a: [x, y, z], b: [x, y, z], param }] }  each conductor's ends and catenary parameter
//   basis always reads "at an assumed 3.5 % sag, not the sag at maximum conductor temperature" (or the sag given).
//   towers: [{ id, x, y, ground, type?: '400kV'|'275kV'|'132kV'|'33kV' }] in order along the line
//   opts.groundAt(x, y): ground height under the span (default: straight between the two tower grounds)
//   opts.tensionPerWeight: catenary parameter a = H/w in metres (horizontal tension over weight per metre); wins if given
//   opts.sagRatio: mid-span sag / span on the equivalent level span (default SAG_TO_SPAN); a is solved from it
//   opts.step: conductor sample spacing in metres (default 5)
//
// EVERY DIMENSION BELOW IS TYPICAL, NOT SURVEYED. They draw a believable outline; they are not a design of any real line.

// Default sag: 3.5 % of span. Typical, not surveyed. UK 400 kV spans of ~360 m commonly sag 10-13 m at maximum
// design temperature, i.e. roughly 3-4 %. No single public source was checked for this figure in this session.
export const SAG_TO_SPAN = 0.035;
export const STEP = 5;          // conductor sample spacing, metres
const CLEAR_STEP = 1;           // clearance search spacing, metres (finer than the drawing, so a hill top is not missed)

// Minimum height of a bare overhead conductor above ground, metres, by nominal voltage: the Electricity Safety,
// Quality and Continuity Regulations 2002 (SI 2002/2665), regulation 17 and Schedule 2. Schedule 2 gives one column
// over roads and one for other locations: not exceeding 33 kV 5.8 m over a road, 5.2 m elsewhere; above 33 kV up to
// 66 kV 6.0 m both; up to 132 kV 6.7 m; up to 275 kV 7.0 m; up to 400 kV 7.3 m. Quoted from the Schedule as commonly
// reproduced, not re-read against the legislation.gov.uk text in this session: check before use.
export const ESQCR_SOURCE = 'ESQCR 2002 (SI 2002/2665) Schedule 2';
export const MIN_CLEARANCE = { '400kV': 7.3, '275kV': 7.0, '132kV': 6.7, '33kV': 5.2 };          // other locations
export const MIN_CLEARANCE_OVER_ROAD = { '400kV': 7.3, '275kV': 7.0, '132kV': 6.7, '33kV': 5.8 };  // over roads
// Every clearance here is worked out on the drawn sag, which is assumed, so every clearance carries this label.
export const clearanceBasis = (sagRatio = SAG_TO_SPAN) =>
  `at an assumed ${Number((sagRatio * 100).toFixed(2))} % sag, not the sag at maximum conductor temperature`;

// Tower classes. Typical, not surveyed. z = height above the tower's ground; half = half-width across the line.
// arms: cross-arm levels, each carrying one phase per side (double circuit). insulator: string length hanging below the arm.
// Public context (not re-checked in this session):
//  - 400 kV: National Grid describes its standard lattice pylons (L6, and the later L12) as about 50 m tall,
//    with a typical span of about 360 m. Arm widths here are proportioned by eye from published elevations.
//  - 275 kV: the L2 design (1950s) is a smaller double-circuit lattice, commonly given as about 40-45 m.
//  - 132 kV: the PL1 / PL16 family is commonly given as about 26-27 m, spans about 250-300 m.
//  - 33 kV: wood poles, commonly 10-13 m long with about 1.5-2 m in the ground, spans about 80-120 m.
export const TOWER_TYPES = {
  '400kV': { kind: 'lattice', height: 50, baseHalf: 4.5, topHalf: 1.0, peakHalf: 0.4, insulator: 5.0,
    arms: [{ z: 44, half: 6.1 }, { z: 35.5, half: 7.9 }, { z: 27, half: 6.9 }] },
  '275kV': { kind: 'lattice', height: 41, baseHalf: 3.8, topHalf: 0.9, peakHalf: 0.35, insulator: 3.5,
    arms: [{ z: 36, half: 5.2 }, { z: 29, half: 6.4 }, { z: 22, half: 5.6 }] },
  '132kV': { kind: 'lattice', height: 27, baseHalf: 2.5, topHalf: 0.7, peakHalf: 0.3, insulator: 1.8,
    arms: [{ z: 24, half: 3.4 }, { z: 20, half: 3.8 }, { z: 16, half: 3.4 }] },
  '33kV': { kind: 'pole', height: 9.5, radius: 0.15, armZ: 8.9, armHalf: 1.2, pin: 0.3 },
};
const DEFAULT_TYPE = '400kV';

// ---- catenary maths -------------------------------------------------------------------------------------------------

const coshm1 = (u) => { const s = Math.sinh(u / 2); return 2 * s * s; }; // cosh(u) - 1 without cancellation

// Mid-span sag of a level span of horizontal length L with parameter a: a (cosh(L / 2a) - 1).
export const levelSag = (L, a) => a * coshm1(L / (2 * a));

// The catenary parameter a whose level span of length L sags sagRatio * L. Sag falls as a grows, so bisect (in log a).
export function paramFromSag(L, sagRatio) {
  if (!(L > 0) || !(sagRatio > 0)) throw Error('span and sag ratio must be positive');
  const target = sagRatio * L;
  let lo = Math.log(L * 1e-3), hi = Math.log(L * 1e7);
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (levelSag(L, Math.exp(mid)) > target) lo = mid; else hi = mid;
  }
  return Math.exp((lo + hi) / 2);
}

// A span of horizontal length L from height h1 (s = 0) to h2 (s = L). The curve is z = zLow + a (cosh((s - s0) / a) - 1),
// i.e. y = a cosh(x / a) shifted so its vertex sits at (s0, zLow). Solving both end conditions gives
//   s0 = L/2 - a asinh((h2 - h1) / (2 a sinh(L / 2a)))
// so the vertex moves toward the lower support, and past it when the slope is steep (then s0 < 0 or s0 > L).
export function catenarySpan(L, h1, h2, a) {
  const s0 = L / 2 - a * Math.asinh((h2 - h1) / (2 * a * Math.sinh(L / (2 * a))));
  const zLow = h1 - a * coshm1(s0 / a);
  const z = (s) => zLow + a * coshm1((s - s0) / a);
  const sMin = Math.min(L, Math.max(0, s0)); // lowest point actually on the wire
  return { s0, zLow, z, sMin, zMin: z(sMin) };
}

// ---- tower geometry ------------------------------------------------------------------------------------------------

const unit = (dx, dy) => { const l = Math.hypot(dx, dy); return l > 0 ? [dx / l, dy / l] : [0, 0]; };

// Line direction at tower k: the bisector of the incoming and outgoing spans (a single tower faces north).
function directionAt(towers, k) {
  let dx = 0, dy = 0;
  if (k > 0) { const u = unit(towers[k].x - towers[k - 1].x, towers[k].y - towers[k - 1].y); dx += u[0]; dy += u[1]; }
  if (k < towers.length - 1) { const u = unit(towers[k + 1].x - towers[k].x, towers[k + 1].y - towers[k].y); dx += u[0]; dy += u[1]; }
  const d = unit(dx, dy);
  return d[0] === 0 && d[1] === 0 ? [0, 1] : d;
}

function specOf(t) {
  const spec = TOWER_TYPES[t.type || DEFAULT_TYPE];
  if (!spec) throw Error(`unknown tower type ${t.type} on ${t.id}`);
  return spec;
}

// Conductor attachment points in world coordinates, in a fixed order so phase j meets phase j on the next tower.
function attachments(t, spec, d, p) {
  const at = (across, z) => [t.x + p[0] * across, t.y + p[1] * across, t.ground + z];
  if (spec.kind === 'pole') {
    const z = spec.armZ + spec.pin;
    return [at(-spec.armHalf, z), at(0, spec.height), at(spec.armHalf, z)];
  }
  const out = [];
  for (const side of [-1, 1]) for (const arm of spec.arms) out.push(at(side * arm.half, arm.z - spec.insulator));
  return out;
}

// Wireframe for one tower into seg (flat array of x,y,z pairs). d = along the line, p = across it.
function drawTower(seg, t, spec, d, p) {
  const P = (along, across, z) => [t.x + d[0] * along + p[0] * across, t.y + d[1] * along + p[1] * across, t.ground + z];
  const L = (a, b) => seg.push(a[0], a[1], a[2], b[0], b[1], b[2]);
  if (spec.kind === 'pole') {
    L(P(0, 0, 0), P(0, 0, spec.height));
    L(P(0, -spec.armHalf, spec.armZ), P(0, spec.armHalf, spec.armZ));
    L(P(0, -spec.armHalf * 0.6, spec.armZ), P(0, 0, spec.armZ - 0.8)); // crossarm braces
    L(P(0, spec.armHalf * 0.6, spec.armZ), P(0, 0, spec.armZ - 0.8));
    return;
  }
  // Body: a square tapering from baseHalf at the ground to topHalf at the top arm, then a peak for the earth wire.
  const topZ = spec.arms[0].z, halfAt = (z) => spec.baseHalf + (spec.topHalf - spec.baseHalf) * Math.min(1, z / topZ);
  const levels = [0, ...spec.arms.map((a) => a.z).sort((a, b) => a - b)];
  if (levels[1] > 10) levels.splice(1, 0, levels[1] * 0.45); // a waist panel below the lowest arm
  const corners = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  const ring = (z) => corners.map(([i, j]) => P(i * halfAt(z), j * halfAt(z), z));
  for (let n = 0; n < levels.length; n++) {
    const r = ring(levels[n]);
    for (let c = 0; c < 4; c++) L(r[c], r[(c + 1) % 4]);              // horizontal ring
    if (n === 0) continue;
    const q = ring(levels[n - 1]);
    for (let c = 0; c < 4; c++) {
      L(q[c], r[c]);                                                   // leg
      L(q[c], r[(c + 1) % 4]); L(q[(c + 1) % 4], r[c]);                // X bracing on each face
    }
  }
  const top = ring(topZ), peak = P(0, 0, spec.height);
  for (let c = 0; c < 4; c++) L(top[c], peak);
  // Cross-arms: a triangle each side, top chord level, bottom chord rising to the tip; a short line for the insulator.
  for (const arm of spec.arms) {
    const h = halfAt(arm.z), depth = Math.min(3, arm.half * 0.35);
    for (const side of [-1, 1]) {
      const tip = P(0, side * arm.half, arm.z);
      for (const along of [-1, 1]) {
        L(P(along * h, side * h, arm.z), tip);
        L(P(along * h, side * h, arm.z - depth), tip);
      }
      L(tip, P(0, side * arm.half, arm.z - spec.insulator));
    }
  }
}

function solidOf(t, spec) {
  const r = spec.kind === 'pole' ? spec.radius : spec.baseHalf; // an axis-aligned box that covers the base at any heading
  const h = spec.kind === 'pole' ? spec.height : spec.arms[spec.arms.length - 1].z;
  return { min: [t.x - r, t.y - r, t.ground], max: [t.x + r, t.y + r, t.ground + h] };
}

// ---- the line --------------------------------------------------------------------------------------------------------

export function buildOverhead(towers, opts = {}) {
  const step = opts.step > 0 ? opts.step : STEP;
  const seg = [], solids = [], clearances = [], hangs = [], wires = [];
  towers.forEach((t, k) => {
    const spec = specOf(t), d = directionAt(towers, k), p = [d[1], -d[0]]; // p points to the right of travel
    drawTower(seg, t, spec, d, p);
    solids.push(solidOf(t, spec));
    hangs.push(attachments(t, spec, d, p));
  });

  for (let k = 0; k + 1 < towers.length; k++) {
    const A = towers[k], B = towers[k + 1];
    const groundAt = typeof opts.groundAt === 'function' ? opts.groundAt : (x, y) => {
      const L = Math.hypot(B.x - A.x, B.y - A.y) || 1, f = ((x - A.x) * (B.x - A.x) + (y - A.y) * (B.y - A.y)) / (L * L);
      return A.ground + (B.ground - A.ground) * Math.min(1, Math.max(0, f));
    };
    const need = (t) => Math.max(t[A.type || DEFAULT_TYPE], t[B.type || DEFAULT_TYPE]);
    const required = need(MIN_CLEARANCE), requiredOverRoad = need(MIN_CLEARANCE_OVER_ROAD);
    const basis = opts.tensionPerWeight > 0
      ? `at an assumed catenary parameter ${opts.tensionPerWeight} m, not the sag at maximum conductor temperature`
      : clearanceBasis(opts.sagRatio > 0 ? opts.sagRatio : SAG_TO_SPAN);
    let best = { span: k, from: A.id, to: B.id, minClearance: Infinity, at: null, conductor: -1, required, requiredOverRoad,
      source: ESQCR_SOURCE, basis };
    const n = Math.min(hangs[k].length, hangs[k + 1].length);
    for (let j = 0; j < n; j++) {
      const a0 = hangs[k][j], b0 = hangs[k + 1][j];
      const L = Math.hypot(b0[0] - a0[0], b0[1] - a0[1]);
      if (!(L > 0)) continue;
      const a = opts.tensionPerWeight > 0 ? opts.tensionPerWeight : paramFromSag(L, opts.sagRatio > 0 ? opts.sagRatio : SAG_TO_SPAN);
      const c = catenarySpan(L, a0[2], b0[2], a);
      wires.push({ span: k, conductor: j, a: [...a0], b: [...b0], param: a });
      const xy = (s) => [a0[0] + (b0[0] - a0[0]) * s / L, a0[1] + (b0[1] - a0[1]) * s / L];
      const m = Math.max(1, Math.ceil(L / step - 1e-9));                  // samples no more than `step` apart
      let prev = [a0[0], a0[1], a0[2]];
      for (let i = 1; i <= m; i++) {
        const s = L * i / m, [x, y] = xy(s), cur = [x, y, i === m ? b0[2] : c.z(s)];
        seg.push(prev[0], prev[1], prev[2], cur[0], cur[1], cur[2]);
        prev = cur;
      }
      const mc = Math.max(1, Math.ceil(L / CLEAR_STEP)), check = (s) => {
        const [x, y] = xy(s), z = c.z(s), gap = z - groundAt(x, y);
        if (gap < best.minClearance) best = { ...best, minClearance: gap, at: [x, y, z], conductor: j };
      };
      for (let i = 0; i <= mc; i++) check(L * i / mc);
      check(c.sMin);                                                     // the exact lowest point of the wire
    }
    clearances.push(best);
  }
  return { lines: new Float32Array(seg), solids, clearances, wires };
}
