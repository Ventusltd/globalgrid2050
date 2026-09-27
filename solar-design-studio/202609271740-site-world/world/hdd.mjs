// hdd.mjs: a horizontal directional drill (HDD) crossing under a road, watercourse or hedge. Pure: no DOM.
// Local east (x), north (y), up (z), metres. Output lines are gl.LINES pairs: x,y,z, x,y,z per segment.
//
// The plan line is straight, from `from` to `to`. Chainage s is horizontal distance along it from `from`.
// The vertical profile follows the plan line: entry tangent - arc - level straight - arc - exit tangent.
// The level straight sits deep enough for the required cover under the obstacle, and runs at least
// `margin` beyond each side of it before the bore starts to rise.
//
// designBore(opts) -> { entry, exit, depth, segments, boreLength, zAt, pointAt, samples, checks, pits, lines }
// compareCrossing(opts) -> open-cut trench against HDD for the same crossing (lengths, spoil, flags)
//
// EVERY DEFAULT BELOW IS A TYPICAL OR ASSUMED VALUE, NOT A DESIGN. Ground conditions, the asset owner's
// cover rule and the drilling contractor's rig set the real figures.

import { createTrench } from './trench.mjs';

const RAD = Math.PI / 180, G = 9.81;

// Entry and exit angles. ASTM F1962-20 section 7.4.2: entry 8 to 20 degrees, preferably 12 to 15; section 7.4.3:
// exit angles "should be relatively shallow, preferably less than 10°". Outside ANGLE_TYPICAL a warning is given;
// outside ANGLE_LIMIT the check fails (20 degrees exit kept as the hard limit, assumed). See also PRCI "Installation
// of Pipelines by Horizontal Directional Drilling: an Engineering Design Guide" (PR-227-9424, 1995; 2015 update PR-277-144507).
export const ANGLE_TYPICAL = { entry: [8, 20], exit: [5, 10] };
export const ANGLE_LIMIT = { entry: [8, 20], exit: [5, 20] };

// Minimum radius, as multiples of outside diameter:
//  - drill pipe (rod): (Rrod)min = 1200 Drod, ASTM F1962-20 section 7.2, Eq. 1 ("100 feet per inch");
//  - steel product pipe: 1200 x nominal diameter (PRCI design guide above; typical);
//  - polyethylene pipe or duct: ASTM F1962-20 section 8.2.5, Note 7, "approximately 40 or 50 to 1 during pull-back";
//    40, the lower end, is used here;
//  - cable in the duct: 20 x cable OD, the verified 33 kV single-core installation rule in data/cables.json (S2/S3).
export const RADIUS_MULTIPLE = { rod: 1200, steel: 1200, pe: 40, cable: 20 };

// Cable installation bend radius by voltage and install method, as multiples of the cable OD (data/cables.json rules):
//  - up to 33 kV single core: 20 x OD during installation. Manufacturer UK installation note (2022), BS 7870-4.10/4.11
//    dynamic 20 x OD; source S3 (a network operator cable policy, docs/trench-sources.md) Table 8 gives about 20 x OD for 33 kV 300-630 mm2.
//  - 66 and 132 kV single core with a metallic sheath: S3 Table 8, 35 x OD pulled into ducts, 30 x OD laid direct.
// A drilled crossing always pulls into ducts.
export const CABLE_BEND = Object.freeze({
  mv: { maxKv: 33, duct: 20, direct: 20, source: 'up to 33 kV: 20 x OD during installation (manufacturer UK note 2022; S3 Table 8)' },
  hv: { maxKv: 132, duct: 35, direct: 30, source: '66-132 kV: 35 x OD pulled into ducts, 30 x OD laid direct (S3 Table 8)' },
});
export function cableBendMultiple(voltageKv = 33, method = 'duct') {
  const band = Number(voltageKv) > CABLE_BEND.mv.maxKv ? CABLE_BEND.hv : CABLE_BEND.mv;
  return { multiple: method === 'direct' ? band.direct : band.duct, method, source: band.source };
}

// One duct per single-core cable. Size: the smallest stock PE duct whose bore (SDR 11: OD x 9/11) is at least
// 1.5 x the cable OD (ASSUMED pulling clearance), and not below 160 mm, the duct source S3 Table 5
// gives for 33 kV and 132 kV. The drilling contractor and network operator set the real size.
export const DUCT_SIZES_MM = Object.freeze([110, 125, 160, 180, 200, 225, 250, 280, 315, 355]);
export const DUCT_MIN_MM = 160, DUCT_BORE_RATIO = 1.5, SDR = 11;
export function ductForCable({ odMm, voltageKv = 33, cores = 3, circuits = 1 } = {}) {
  const need = DUCT_BORE_RATIO * (Number(odMm) || CABLE_ASSUMED.odMm);
  const size = DUCT_SIZES_MM.find(d => d >= DUCT_MIN_MM && d * (1 - 2 / SDR) >= need) ?? DUCT_SIZES_MM[DUCT_SIZES_MM.length - 1];
  return { ducts: cores * circuits, odMm: size, voltageKv, basis: `one duct per single-core cable (${cores} x ${circuits} circuit); `
    + `${size} mm SDR ${SDR} PE: bore at least ${DUCT_BORE_RATIO} x cable OD and at least ${DUCT_MIN_MM} mm (assumed; S3 Table 5)` };
}

// Required cover below the bottom of the obstacle to the crown of the product. ASSUMED placeholders: the
// highway authority, the flood risk regulator or the tree adviser sets the real figure for each crossing.
// Watercourse cover allows for bed scour; hedge cover clears the main root zone.
export const COVER_ASSUMED = { road: 1.5, watercourse: 2.0, hedge: 1.5 };
// ASSUMED depth of the obstacle bottom below the ground either side (carriageway build-up, channel bed).
export const OBSTACLE_DEPTH_ASSUMED = { road: 0.6, watercourse: 1.5, hedge: 0 };

// Reamed hole diameter: "typically 50 % greater than the outer diameter", ASTM F1962-20 section 9.3.
export const REAM_FACTOR = 1.5;

// ASSUMED pit size, metres: a small launch / reception pit to hold returned drilling fluid.
export const PIT_ASSUMED = { length: 3, width: 2, depth: 1.2 };
// ASSUMED least ground over the product crown anywhere between the pits (no source): the bore must not daylight.
export const CLEARANCE_ASSUMED = 0.1;
// Step for the cover and clearance checks, metres: much finer than the 1 m LiDAR cells, so a low point between
// samples cannot hide more than a millimetre or so of cover.
const CHECK_STEP = 0.05;

// Cable pull-in, ASSUMED, no public source: duct friction 0.35, and the pulling-eye limit on the conductors of
// 50 N/mm2 for copper and 30 N/mm2 for aluminium. The cable maker's figure for each cable governs over these.
// Per single-core cable, pulled alone into its own duct.
export const CABLE_ASSUMED = { massKgPerM: 2, odMm: 51.5, conductorMm2: 300, material: 'al', friction: 0.35, voltageKv: 33 };
export const PULL_STRESS = { cu: 50, al: 30 };  // N/mm2

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function lineOf(from, to) {
  const L = Math.hypot(to[0] - from[0], to[1] - from[1]);
  if (!(L > 0)) throw Error('hdd: the plan line needs two distinct points');
  const d = [(to[0] - from[0]) / L, (to[1] - from[1]) / L];
  return { L, d, xy: (s) => [from[0] + d[0] * s, from[1] + d[1] * s] };
}

// Horizontal run and slant tangent length to go from ground height zg down to level zb at angle a, radius R.
function side(zg, zb, a, R) {
  const drop = zg - zb, arcDrop = R * (1 - Math.cos(a));
  const tangent = (drop - arcDrop) / Math.sin(a);
  return { tangent, run: tangent * Math.cos(a) + R * Math.sin(a), arcRun: R * Math.sin(a) };
}

/**
 * designBore({ from, to, groundAt, obstacle, entryAngleDeg, exitAngleDeg, radius, rodOdMm, product, fit, cable })
 * obstacle: { kind: 'road'|'watercourse'|'hedge', from, to (chainages), depth?, cover?, margin? }
 * product: { material: 'pe'|'steel', odMm }. radius defaults to the largest required minimum radius.
 * fit: true moves entry and exit along the line to the shortest bore that clears the obstacle;
 * otherwise entry is at `from` and exit at `to`.
 */
export function designBore(opts) {
  const { from, to, groundAt, obstacle } = opts;
  if (typeof groundAt !== 'function') throw Error('hdd: groundAt(x, y) is required');
  if (!obstacle || !(obstacle.to > obstacle.from)) throw Error('hdd: obstacle needs from < to chainages');
  const kind = obstacle.kind || 'road';
  if (!(kind in COVER_ASSUMED)) throw Error(`hdd: unknown obstacle kind ${kind}`);
  const line = lineOf(from, to), g = (s) => groundAt(...line.xy(s));
  const aE = (opts.entryAngleDeg ?? 12) * RAD, aX = (opts.exitAngleDeg ?? 10) * RAD;
  if (!(aE > 0 && aE < Math.PI / 2 && aX > 0 && aX < Math.PI / 2)) throw Error('hdd: angles must be between 0 and 90 degrees');
  const product = { material: 'pe', odMm: 125, ...(opts.product || {}) };
  const rodOdMm = opts.rodOdMm ?? 60.3;                         // ASSUMED: 2 3/8 inch rod of a small to mid-size rig
  const od = product.odMm / 1000;
  const minR = {
    rod: RADIUS_MULTIPLE.rod * rodOdMm / 1000,
    product: (RADIUS_MULTIPLE[product.material] ?? RADIUS_MULTIPLE.pe) * od,
  };
  const required = Math.max(minR.rod, minR.product);
  const R = opts.radius ?? required;
  const oDepth = obstacle.depth ?? OBSTACLE_DEPTH_ASSUMED[kind];
  const cover = obstacle.cover ?? COVER_ASSUMED[kind];
  const margin = obstacle.margin ?? 2;                         // ASSUMED level run beyond each side

  // Level of the straight: the lowest obstacle bottom, less cover, less half the product (cover is to its crown).
  let bottom = Infinity;
  const nObs = Math.max(4, Math.ceil((obstacle.to - obstacle.from) / CHECK_STEP));
  for (let i = 0; i <= nObs; i++) bottom = Math.min(bottom, g(obstacle.from + (obstacle.to - obstacle.from) * i / nObs) - oDepth);
  const zb = Math.min(bottom - cover - od / 2, opts.level ?? Infinity);

  const base = { kind, depth: { level: zb, obstacleBottom: bottom, cover, obstacleDepth: oDepth, margin }, radius: R, product,
    reamedDiameter: REAM_FACTOR * od };
  if (!Number.isFinite(zb)) return noLayout(base, 'no ground under the obstacle (off the loaded terrain)');
  // Entry and exit chainages: given, or fitted so the straight just spans the obstacle plus margins. Each side is a
  // root of f(s) = s +- run(ground(s)) - target, found by scanning out from the obstacle and bisecting, so the root
  // taken is the one nearest the obstacle. No root on the drawn line means no valid layout, and it says so.
  let sE = 0, sX = line.L, fit = null;
  if (opts.fit) {
    const a = rootOut((s) => s + side(g(s), zb, aE, R).run - (obstacle.from - margin), obstacle.from - margin, 0,
      (s) => side(g(s), zb, aE, R).tangent >= 0);
    const b = rootOut((s) => s - side(g(s), zb, aX, R).run - (obstacle.to + margin), obstacle.to + margin, line.L,
      (s) => side(g(s), zb, aX, R).tangent >= 0);
    if (a.s === null || b.s === null) {
      return noLayout(base, `no valid layout on the drawn line: the ${a.s === null ? 'entry' : 'exit'} pit would fall `
        + `${a.nan || b.nan ? 'off the loaded ground' : 'beyond the end of the line'}; draw a longer line or steepen the angles`);
    }
    sE = a.s; sX = b.s;
    fit = { converged: true, residual: Math.max(Math.abs(a.residual), Math.abs(b.residual)) };
  }
  const zE = g(sE), zX = g(sX), half = PIT_ASSUMED.length / 2;
  const pitGround = [sE - half, sE + half, sX - half, sX + half].every((t) => Number.isFinite(g(t)));
  if (!Number.isFinite(zE) || !Number.isFinite(zX) || !pitGround) return noLayout(base, 'a pit falls off the loaded ground');
  const e = side(zE, zb, aE, R), x = side(zX, zb, aX, R);
  // Breakpoints along the chainage.
  const s1 = sE + Math.max(0, e.tangent) * Math.cos(aE), s2 = s1 + e.arcRun;
  const s4 = sX - Math.max(0, x.tangent) * Math.cos(aX), s3 = s4 - x.arcRun;
  const c1 = { s: s2, z: zb + R }, c2 = { s: s3, z: zb + R };
  const zAt = (s) => {
    const c = clamp(s, sE, sX);
    if (c <= s1) return zE - (c - sE) * Math.tan(aE);
    if (c <= s2) return c1.z - Math.sqrt(Math.max(0, R * R - (c - c1.s) ** 2));
    if (c <= s3) return zb;
    if (c <= s4) return c2.z - Math.sqrt(Math.max(0, R * R - (c - c2.s) ** 2));
    return zX - (sX - c) * Math.tan(aX);
  };
  const pointAt = (s) => [...line.xy(s), zAt(s)];
  const straight = s3 - s2;
  const segments = [
    { kind: 'tangent', s0: sE, s1, length: Math.max(0, e.tangent) },
    { kind: 'arc', s0: s1, s1: s2, length: R * aE },
    { kind: 'straight', s0: s2, s1: s3, length: Math.max(0, straight) },
    { kind: 'arc', s0: s3, s1: s4, length: R * aX },
    { kind: 'tangent', s0: s4, s1: sX, length: Math.max(0, x.tangent) },
  ];
  // When the profile does not fit, the tangents are clamped and the drawn line is not a bore: no length is given.
  let boreLength = segments.reduce((t, sg) => t + sg.length, 0);

  // Samples along the bore: every 0.5 m and every breakpoint.
  const marks = new Set([sE, s1, s2, s3, s4, sX]);
  const n = Math.max(2, Math.ceil((sX - sE) / 0.5));
  for (let i = 0; i <= n; i++) marks.add(sE + (sX - sE) * i / n);
  const ss = [...marks].filter((s) => s >= sE && s <= sX).sort((a, b) => a - b);
  const samples = ss.map((s) => ({ s, z: zAt(s), ground: g(s) }));

  // ---- checks ---------------------------------------------------------------------------------------------------
  const checks = [];
  const fits = e.tangent >= -1e-9 && x.tangent >= -1e-9 && straight >= -1e-9;
  const spans = s2 <= obstacle.from - margin + 1e-3 && s3 >= obstacle.to + margin - 1e-3; // 1 mm
  checks.push({ id: 'profile', ok: fits && spans, value: straight, unit: 'm',
    note: !fits ? 'entry and exit too close, too shallow for this angle and radius, or the obstacle too deep: move the pits or change the angles'
      : !spans ? `the level straight does not span the obstacle plus ${margin} m each side: move the pits apart or steepen the angles`
        : 'tangent-arc-straight-arc-tangent fits, and the level straight spans the obstacle plus margins' });

  if (!(fits && spans)) boreLength = null;
  let minCover = Infinity, at = null;
  const nCov = Math.max(4, Math.ceil((obstacle.to - obstacle.from) / CHECK_STEP));
  for (let i = 0; i <= nCov; i++) {
    const s = obstacle.from + (obstacle.to - obstacle.from) * i / nCov;
    const c = g(s) - oDepth - (zAt(s) + od / 2);
    if (c < minCover) { minCover = c; at = pointAt(s); }
  }
  checks.push({ id: 'cover', ok: minCover >= cover - 1e-6, value: minCover, required: cover, unit: 'm', at,
    note: `cover from the obstacle bottom (${oDepth} m below ground, ${obstacle.depth == null ? 'assumed' : 'given'}) `
      + `to the product crown; required ${cover} m is ${obstacle.cover == null ? 'an assumed placeholder' : 'given'}` });

  checks.push({ id: 'radius', ok: R >= required - 1e-6, value: R, required, unit: 'm', minR,
    note: `rod ${minR.rod.toFixed(1)} m (${RADIUS_MULTIPLE.rod} x ${rodOdMm} mm), product ${minR.product.toFixed(1)} m `
      + `(${RADIUS_MULTIPLE[product.material] ?? RADIUS_MULTIPLE.pe} x ${product.odMm} mm): typical rules, not a rig or pipe maker figure` });

  // Clearance: the product crown stays at least CLEARANCE_ASSUMED under the ground everywhere between the pits.
  let minClear = Infinity, clearAt = null;
  const k0 = Math.min(sE + half, sX), k1 = Math.max(sX - half, k0), nCl = Math.max(1, Math.ceil((k1 - k0) / CHECK_STEP));
  for (let i = 0; i <= nCl; i++) {
    const s = k0 + (k1 - k0) * i / nCl, c = g(s) - (zAt(s) + od / 2);
    if (c < minClear) { minClear = c; clearAt = pointAt(s); }
  }
  checks.push({ id: 'clearance', ok: minClear >= CLEARANCE_ASSUMED - 1e-9, value: minClear, required: CLEARANCE_ASSUMED, unit: 'm',
    at: clearAt, note: minClear < 0 ? `the bore comes out of the ground (${(-minClear).toFixed(2)} m above it) between the pits`
      : `least ground over the product crown between the pits; ${CLEARANCE_ASSUMED} m required (assumed, no source)` });

  const inRange = (a, [lo, hi]) => a >= lo - 1e-9 && a <= hi + 1e-9;
  const eDeg = aE / RAD, xDeg = aX / RAD;
  const usual = inRange(eDeg, ANGLE_TYPICAL.entry) && inRange(xDeg, ANGLE_TYPICAL.exit);
  checks.push({ id: 'angles', ok: inRange(eDeg, ANGLE_LIMIT.entry) && inRange(xDeg, ANGLE_LIMIT.exit), warn: !usual,
    value: [eDeg, xDeg], required: [ANGLE_LIMIT.entry, ANGLE_LIMIT.exit], preferred: [ANGLE_TYPICAL.entry, ANGLE_TYPICAL.exit],
    unit: 'degrees', note: usual ? 'entry 8-20 degrees (ASTM F1962-20 7.4.2), exit 10 degrees or less (7.4.3)'
      : 'outside the preferred range: ASTM F1962-20 7.4.3 prefers an exit under 10 degrees; entry 8-20 (7.4.2)' });

  const pull = cablePull(samples, { ...CABLE_ASSUMED, ...(opts.cable || {}) });
  checks.push({ id: 'tension', ok: pull.best <= pull.allowable, value: pull.best, required: pull.allowable, unit: 'N', pull,
    note: 'cable pull-in estimate from ASSUMED friction, cable mass and conductor stress limit; '
      + 'the duct pullback itself needs its own calculation (for example ASTM F1962)' });

  const bend = cableBendMultiple(opts.cable?.voltageKv ?? CABLE_ASSUMED.voltageKv, 'duct');
  const cableOd = opts.cable?.odMm ?? CABLE_ASSUMED.odMm, cableR = bend.multiple * cableOd / 1000;
  checks.push({ id: 'cable-bend', ok: R >= cableR, value: R, required: cableR, unit: 'm', multiple: bend.multiple,
    note: `bore radius against the cable installation bend radius (${bend.multiple} x ${cableOd} mm OD, pulled into ducts; ${bend.source})` });

  // ---- pits and drawing ---------------------------------------------------------------------------------------------
  const pitOf = (s, name) => {
    const trench = createTrench({ path: [line.xy(s - half), line.xy(s + half)], width: PIT_ASSUMED.width,
      depth: PIT_ASSUMED.depth, groundAt });
    return { name, at: pointAt(s), trench };
  };
  const pits = [pitOf(sE, 'entry'), pitOf(sX, 'exit')];
  const seg = [];
  for (let i = 1; i < samples.length; i++) {
    const a = line.xy(samples[i - 1].s), b = line.xy(samples[i].s);
    seg.push(a[0], a[1], samples[i - 1].z, b[0], b[1], samples[i].z);
  }
  for (const p of pits) for (const v of p.trench.wallLines(groundAt)) seg.push(v);

  return {
    ...base, layout: true, fit, entry: { s: sE, point: pointAt(sE), angleDeg: eDeg }, exit: { s: sX, point: pointAt(sX), angleDeg: xDeg },
    segments, boreLength, planLength: sX - sE,
    zAt, pointAt, samples, checks, ok: checks.every((c) => c.ok), pits, lines: new Float32Array(seg),
  };
}

// A crossing with no valid layout: one failing check that says why, nothing to draw and no length.
function noLayout(base, note) {
  return { ...base, layout: false, fit: { converged: false, residual: null }, entry: null, exit: null, segments: [],
    boreLength: null, planLength: null, samples: [], checks: [{ id: 'layout', ok: false, note }], ok: false, pits: [],
    lines: new Float32Array(0) };
}

// Scans from `start` towards `end` in 0.1 m steps for the first sign change of f, then bisects to 1e-9 m.
// f is positive on the obstacle side of the root. A root where valid(s) is false (the ground there is too low for the
// arc, so the tangent would be negative) is passed over. Returns { s, residual }, or { s: null, nan } with no root.
function rootOut(f, start, end, valid = () => true) {
  const dir = end < start ? -1 : 1, n = Math.max(1, Math.ceil(Math.abs(end - start) / 0.1));
  const h = (s) => dir * -f(s);   // entry side: f > 0 at the obstacle; exit side: f < 0 at the obstacle
  let a = start, ha = h(a);
  if (!Number.isFinite(ha)) return { s: null, nan: true };
  if (ha <= 0 && valid(a)) return { s: a, residual: f(a) };
  for (let i = 1; i <= n; i++) {
    const b = i === n ? end : start + dir * 0.1 * i, hb = h(b);
    if (!Number.isFinite(hb)) return { s: null, nan: true };
    if (hb <= 0 && ha > 0) {
      let lo = a, hi = b;
      for (let k = 0; k < 80 && Math.abs(hi - lo) > 1e-9; k++) { const m = (lo + hi) / 2; if (h(m) > 0) lo = m; else hi = m; }
      if (valid(hi)) return { s: hi, residual: f(hi) };
    }
    a = b; ha = hb;
  }
  return { s: null, nan: false };
}

/**
 * cablePull(samples, cable) pulls the cable through the bore polyline both ways. For each step:
 * T <- T e^(mu |dtheta|) + w ds (mu cos theta + sin theta), theta the rise in the direction of pull.
 * The capstan term is the sidewall friction round the vertical bends. Returns newtons.
 */
export function cablePull(samples, cable = CABLE_ASSUMED) {
  const c = { ...CABLE_ASSUMED, ...cable }, mu = c.friction, w = c.massKgPerM * G;
  const run = (pts) => {
    let T = 0, prev = null;
    for (let i = 1; i < pts.length; i++) {
      const ds = Math.hypot(pts[i].s - pts[i - 1].s, pts[i].z - pts[i - 1].z);
      if (!(ds > 0)) continue;
      const th = Math.atan2(pts[i].z - pts[i - 1].z, Math.abs(pts[i].s - pts[i - 1].s));
      if (prev !== null) T *= Math.exp(mu * Math.abs(th - prev));
      T = Math.max(0, T + w * ds * (mu * Math.cos(th) + Math.sin(th)));
      prev = th;
    }
    return T;
  };
  const forward = run(samples), backward = run([...samples].reverse());
  const allowable = (PULL_STRESS[c.material] ?? PULL_STRESS.al) * c.conductorMm2;
  return { forward, backward, best: Math.min(forward, backward),
    feedFrom: forward <= backward ? 'entry' : 'exit', allowable, assumed: c };
}

// Disruption flags by obstacle, for each method. Plain statements, advisory only.
const FLAGS = {
  road: {
    open: ['carriageway closed or narrowed under traffic management', 'road opening notice and reinstatement to the highway specification'],
    hdd: ['pits and rig sit off the carriageway', 'ground heave or settlement under the road to be monitored'],
  },
  watercourse: {
    open: ['works in the channel: damming and over-pumping', 'permit for works in or near the watercourse likely',
      'silt release and bed and bank reinstatement'],
    hdd: ['drilling fluid breakout into the watercourse is the main risk: fluid pressure plan needed', 'permit may still be needed'],
  },
  hedge: {
    open: ['hedge section removed and replanted; hedgerow protection rules may apply', 'nesting season limits the time of year'],
    hdd: ['hedge and root zone left intact'],
  },
};
const HDD_COMMON = ['specialist rig, fluid handling and working areas at both pits', 'ground investigation needed: rock, gravel or voids can stop a bore'];

/**
 * compareCrossing({ from, to, groundAt, obstacle, trench?: { width, depth }, ...designBore options })
 * Open cut: a trench over the same plan length as the bore, dug to the normal depth on the approaches and
 * to obstacle depth + cover + product OD across the obstacle (plus margins). Spoil from trench.mjs.
 * HDD: cuttings from the reamed hole plus the two pits. Returns both and an advisory preference with reasons.
 */
export function compareCrossing(opts) {
  const bore = designBore({ fit: true, ...opts });
  const advisory = 'a screening comparison on assumed values; not a method statement or a cost estimate';
  if (!bore.layout || bore.boreLength === null) {
    return { kind: bore.kind, openCut: null, hdd: { boreLength: null, bore, flags: [] }, preferred: 'open-cut', advisory,
      reasons: [`HDD has no valid layout: ${bore.checks.find((c) => !c.ok).note}`] };
  }
  const { groundAt, obstacle } = opts;
  const line = lineOf(opts.from, opts.to);
  const width = opts.trench?.width ?? 0.6, normal = opts.trench?.depth ?? 1.2;   // ASSUMED cable trench
  const od = bore.product.odMm / 1000;
  const deep = bore.depth.obstacleDepth + bore.depth.cover + od;
  const a = obstacle.from - bore.depth.margin, b = obstacle.to + bore.depth.margin;
  const parts = [[bore.entry.s, a, normal], [a, b, Math.max(normal, deep)], [b, bore.exit.s, normal]]
    .filter(([p, q]) => q - p > 1e-6)
    .map(([p, q, depth]) => createTrench({ path: [line.xy(p), line.xy(q)], width, depth, groundAt }));
  const openSpoil = parts.reduce((t, tr) => t + tr.spoilVolumeOn(groundAt), 0);
  const openLength = parts.reduce((t, tr) => t + tr.length2d, 0);
  const cuttings = Math.PI * (bore.reamedDiameter / 2) ** 2 * bore.boreLength;
  const pitSpoil = bore.pits.reduce((t, p) => t + p.trench.spoilVolumeOn(groundAt), 0);
  const kind = bore.kind, flags = FLAGS[kind];

  const reasons = [];
  let preferred;
  if (!bore.ok) {
    preferred = 'open-cut';
    reasons.push(`HDD fails: ${bore.checks.filter((c) => !c.ok).map((c) => c.id).join(', ')}`);
  } else if (kind === 'hedge' && openLength < 30) {
    preferred = 'open-cut';
    reasons.push('short hedge crossing: open cut is simpler if the hedge may be cut and replanted');
  } else {
    preferred = 'hdd';
    reasons.push(kind === 'watercourse' ? 'avoids works in the channel' : kind === 'road' ? 'keeps the road open' : 'keeps the hedge intact');
    reasons.push(`spoil ${Math.round(cuttings + pitSpoil)} m3 against ${Math.round(openSpoil)} m3 open cut`);
  }
  return {
    kind,
    openCut: { length: openLength, spoilM3: openSpoil, trenches: parts, flags: flags.open, deepDepth: deep },
    hdd: { boreLength: bore.boreLength, planLength: bore.planLength, spoilM3: cuttings + pitSpoil, cuttingsM3: cuttings,
      pitSpoilM3: pitSpoil, flags: [...flags.hdd, ...HDD_COMMON], bore },
    preferred, reasons, advisory,
  };
}
