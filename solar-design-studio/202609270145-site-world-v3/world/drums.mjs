// Drums: split a cable route into drum lengths, place joint bays, and produce a drum schedule.
// Pure: no DOM, no WebGL; imports only the shared cable allowances from boq-assumptions.mjs. Local east (x), north (y), up (z), metres, as cable-route.mjs.
//
// planDrums({ route, cable, rules, crossings, groundAt, options })
//   route      the object returned by routeCable() in cable-route.mjs
//   cable      one entry of web/world/data/cables.json "cables"
//   rules      the "rules" array of the same file (used for the drum barrel bend check); optional
//   crossings  [{ at }] or [{ from, to }] plan chainages (metres) of roads, pipes, ditches; optional
//   groundAt   (x, y) -> ground height, for the top of the drawn joint bays; optional
//   options    overrides for any value in ASSUMED below, plus drums (a drum table) and maxDrumLength
//
// Lengths are true 3D lengths along each core (the three cores differ slightly in bends), plus allowances.
// Every figure not taken from cables.json is an assumption, listed in ASSUMED with its basis, and
// returned in the schedule so nobody mistakes it for a measured value.

import { CABLE_ALLOWANCES } from './boq-assumptions.mjs';

// Termination tail and snaking come from CABLE_ALLOWANCES, the one set the bill of quantities uses too.
export const ASSUMED = {
  terminationAllowance: { value: CABLE_ALLOWANCES.terminationM.value, unit: CABLE_ALLOWANCES.terminationM.unit, basis: CABLE_ALLOWANCES.terminationM.basis },
  jointAllowance: { value: 1.5, unit: 'm per core per cable end at a joint', basis: 'Assumed: overlap and cut-back needed in the bay to make the joint.' },
  snaking: { value: CABLE_ALLOWANCES.snakingPct.value / 100, unit: 'fraction of 3D route length', basis: CABLE_ALLOWANCES.snakingPct.basis },
  drumEndWaste: { value: 2, unit: 'm per drum', basis: 'Assumed: inner end left on the drum for sealing and testing, and the damaged pulling end.' },
  orderIncrement: { value: 10, unit: 'm', basis: 'Assumed: each drum length is ordered rounded up to this step.' },
  freeboard: { value: 0.075, unit: 'm', basis: 'Assumed: clearance between the outer layer and the flange rim, at least one cable diameter.' },
  maxFlange: { value: 4.3, unit: 'm', basis: 'Assumed: on a low-loader deck of about 0.5 m the loaded height stays below 5.03 m '
    + '(16 ft 6 in), the GB bridge height below which bridges carry height signs; there is no general legal height limit.' },
  maxPullLength: { value: 1000, unit: 'm per section', basis: 'Assumed cap on one pull, no source: stands in for a pulling-tension '
    + 'and sidewall-pressure check, which this module does not yet make. Drum capacity alone would allow pulls of 2 km or more.' },
  maxPayload: { value: 25, unit: 't cable per drum', basis: 'Assumed: a 44 t six-axle articulated vehicle (GB authorised weight) less tractor, trailer and drum.' },
  bayLength: { value: 8, unit: 'm (33 kV); 10 m above 66 kV', basis: 'Assumed typical joint bay length for three single-core joints side by side.' },
  bayWidth: { value: 1.8, unit: 'm (33 kV); 2.5 m above 66 kV', basis: 'Assumed typical joint bay width.' },
  bayFloorBelowCable: { value: 0.3, unit: 'm', basis: 'Assumed: working space below the cable in the bay.' },
  bayMargin: { value: 3, unit: 'm', basis: 'Assumed: straight run needed beyond each end of the bay before a bend starts.' },
  maxBaySlope: { value: 0.05, unit: 'rise over run', basis: 'Assumed 1 in 20: bays are kept near level so the joint sits flat and water drains away.' },
  crossingClearance: { value: 10, unit: 'm', basis: 'Assumed: keep a bay this far from any crossing so the crossing is not re-excavated.' },
  coverIfNoGround: { value: 1.0, unit: 'm', basis: 'Assumed: drawn bay rim height above the cable when no ground function is given.' },
  endClearance: { value: 20, unit: 'm', basis: 'Assumed: keep a bay this far from either end of the route.' },
  densityAl: { value: 1.6, unit: 't/m3 over the outer diameter', basis: 'Assumed equivalent density to estimate mass per metre of an aluminium cable when none is given.' },
  densityCu: { value: 2.5, unit: 't/m3 over the outer diameter', basis: 'Assumed; close to the 2.5-2.7 implied by the purchaser figures (S7) in cables.json.' },
  densityOther: { value: 2.2, unit: 't/m3 over the outer diameter', basis: 'Assumed for a conductor metal not stated.' },
};

// Typical drum sizes, rounded; assumed, not copied from any maker's table. Check against the supplier's drum schedule.
export const DRUMS = [
  { id: 'D18', flange: 1.8, barrel: 1.0, width: 1.1, tare: 0.35 },
  { id: 'D22', flange: 2.2, barrel: 1.3, width: 1.3, tare: 0.6 },
  { id: 'D26', flange: 2.6, barrel: 1.6, width: 1.5, tare: 0.9 },
  { id: 'D30', flange: 3.0, barrel: 1.8, width: 1.8, tare: 1.4 },
  { id: 'D36', flange: 3.6, barrel: 2.2, width: 2.2, tare: 2.2 },
  { id: 'D40', flange: 4.0, barrel: 2.4, width: 2.4, tare: 3.0 },
  { id: 'D43', flange: 4.3, barrel: 2.8, width: 2.4, tare: 3.6 },
];

const val = (opts, k) => (opts[k] !== undefined ? opts[k] : ASSUMED[k].value);

// Mass per metre: the catalogue figure if cables.json gives one, else estimated from the outer diameter.
export function massPerMetre(cable, opts = {}) {
  if (cable.mass_kg_m > 0) return { kgPerM: cable.mass_kg_m, basis: 'cables.json mass_kg_m' };
  const k = cable.conductor === 'Al' ? 'densityAl' : cable.conductor === 'Cu' ? 'densityCu' : 'densityOther';
  const d = cable.od_mm / 1000;
  return { kgPerM: val(opts, k) * 1000 * Math.PI * d * d / 4, basis: `estimated from OD with ${k} (assumed)` };
}

// The static (final position) bend multiple from cables.json that sets the drum barrel: barrel >= 2 x multiple x OD,
// i.e. 30 x OD for a 33 kV single core. ASSUMED AND CONSERVATIVE: drum packaging rules allow tighter barrels (NEMA WC 26
// Table 3-1, as reported by the tester: 12 x OD for extruded wire-shielded cable over 2 kV, 14 x OD tape-shielded; more
// for metallic sheaths), because a cable wound slowly on a supported drum may bend tighter than when installed.
// The maker's drum schedule governs.
export function barrelRule(cable, rules = []) {
  const armoured = /armoured/.test(cable.id);
  const want = cable.voltage_kv > 66 ? 'single_core_metallic_sheath' : armoured ? 'single_core_armoured' : 'single_core_unarmoured';
  const fits = rules.filter((r) => r.voltage_kv === cable.voltage_kv && r.when === 'final' && r.status === 'verified' && r.multiple_of_od > 0);
  const pool = fits.filter((r) => r.construction === want).length ? fits.filter((r) => r.construction === want) : fits;
  if (!pool.length) return { multiple: 15, source: 'No verified static rule in cables.json for this cable; 15 x OD assumed.' };
  const r = pool.reduce((a, b) => (b.multiple_of_od < a.multiple_of_od ? b : a));
  return { multiple: r.multiple_of_od, source: r.source };
}

// Length a drum can hold, square-wound layers: each layer i holds floor(width / OD) turns at diameter barrel + (2i - 1) OD.
export function drumCapacity(drum, odM, freeboard) {
  const layers = Math.floor((drum.flange - drum.barrel - 2 * Math.max(freeboard, odM)) / (2 * odM));
  const turns = Math.floor(drum.width / odM);
  let len = 0;
  for (let i = 1; i <= layers; i++) len += Math.PI * (drum.barrel + (2 * i - 1) * odM) * turns;
  return Math.max(0, len);
}

// Choose the drum that carries the longest length within the flange, payload and barrel limits.
export function chooseDrum(cable, rules, opts = {}) {
  const od = cable.od_mm / 1000;
  const mass = massPerMetre(cable, opts);
  const bend = barrelRule(cable, rules);
  const minBarrel = 2 * bend.multiple * od;
  const table = opts.drums || DRUMS;
  let best = null;
  const rejected = [];
  for (const d of table) {
    if (d.flange > val(opts, 'maxFlange') + 1e-9) { rejected.push({ id: d.id, reason: 'flange above the transport limit' }); continue; }
    if (d.barrel < minBarrel - 1e-9) { rejected.push({ id: d.id, reason: `barrel below ${minBarrel.toFixed(2)} m (2 x ${bend.multiple} x OD, assumed conservative)` }); continue; }
    const capacity = drumCapacity(d, od, val(opts, 'freeboard'));
    const byWeight = Math.max(0, (val(opts, 'maxPayload') - (d.tare || 0)) * 1000 / mass.kgPerM);
    let maxLength = Math.min(capacity, byWeight);
    let governs = capacity <= byWeight ? 'drum capacity' : 'payload weight';
    const cap = val(opts, 'maxPullLength');
    if (cap > 0 && cap < maxLength) { maxLength = cap; governs = 'pulling length cap (assumed)'; }
    if (opts.maxDrumLength > 0 && opts.maxDrumLength < maxLength) { maxLength = opts.maxDrumLength; governs = 'maxDrumLength option'; }
    const c = { ...d, capacity, byWeight, maxLength, governs };
    if (!best || c.maxLength > best.maxLength) best = c;
  }
  return { drum: best, rejected, mass, bend, minBarrel };
}

// Per-sample arrays along the route: plan chainage, 3D distance, and 3D length of each core.
function profile(route) {
  const cl = route.centreline;
  const n = cl.length;
  const plan = [0], d3 = [0];
  for (let k = 1; k < n; k++) {
    const dx = cl[k][0] - cl[k - 1][0], dy = cl[k][1] - cl[k - 1][1], dz = cl[k][2] - cl[k - 1][2];
    plan.push(plan[k - 1] + Math.hypot(dx, dy));
    d3.push(d3[k - 1] + Math.hypot(dx, dy, dz));
  }
  // Chords are a hair shorter than arcs; scale so the plan chainage matches the route's exact length2d.
  const f = plan[n - 1] > 0 ? route.length2d / plan[n - 1] : 1;
  for (let k = 0; k < n; k++) plan[k] *= f;
  const cores = (route.cores && route.cores.length ? route.cores : [{ polyline: cl }]).map((c) => {
    const acc = [0];
    for (let k = 1; k < n; k++) {
      const p = c.polyline[k], q = c.polyline[k - 1];
      acc.push(acc[k - 1] + Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]));
    }
    return acc;
  });
  return { cl, plan, d3, cores, n, xs: cl.map((p) => p[0]), ys: cl.map((p) => p[1]), zs: cl.map((p) => p[2]) };
}

// Linear interpolation of any per-sample array at 3D distance t.
function interp(pr, arr, t) {
  const { d3, n } = pr;
  if (t <= 0) return arr[0];
  if (t >= d3[n - 1]) return arr[n - 1];
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (d3[m] <= t) lo = m; else hi = m; }
  const u = (t - d3[lo]) / (d3[hi] - d3[lo] || 1);
  return arr[lo] + (arr[hi] - arr[lo]) * u;
}

function pointAt(pr, t) {
  return [interp(pr, pr.xs, t), interp(pr, pr.ys, t), interp(pr, pr.zs, t)];
}

// Why a bay centred at 3D distance t is not acceptable; empty when it is.
function bayProblems(pr, route, t, cfg, crossings) {
  const out = [];
  const total = pr.d3[pr.n - 1];
  const half = cfg.bayLength / 2;
  if (t - half < cfg.endClearance || t + half > total - cfg.endClearance) out.push('too near a route end');
  const s = interp(pr, pr.plan, t);
  const a = interp(pr, pr.plan, t - half) - cfg.bayMargin, b = interp(pr, pr.plan, t + half) + cfg.bayMargin;
  for (const g of route.segments) if (g.type === 'arc' && g.s1 > a && g.s0 < b) { out.push('on or near a bend'); break; }
  const za = interp(pr, pr.zs, t - half), zb = interp(pr, pr.zs, t + half);
  const run = interp(pr, pr.plan, t + half) - interp(pr, pr.plan, t - half);
  if (run > 0 && Math.abs(zb - za) / run > cfg.maxBaySlope) out.push('slope above the limit');
  for (const c of crossings) {
    const lo = (c.from !== undefined ? c.from : c.at) - cfg.crossingClearance - half;
    const hi = (c.to !== undefined ? c.to : c.at) + cfg.crossingClearance + half;
    if (s > lo && s < hi) { out.push('near a crossing'); break; }
  }
  return out;
}

export function planDrums({ route, cable, rules = [], crossings = [], groundAt = null, options = {} } = {}) {
  if (!route || !Array.isArray(route.centreline) || route.centreline.length < 2) throw Error('planDrums needs a route from routeCable');
  if (!cable || !(cable.od_mm > 0)) throw Error('planDrums needs a cable with od_mm');
  const opts = options;
  const hv = cable.voltage_kv > 66;
  const cfg = {};
  for (const k of Object.keys(ASSUMED)) cfg[k] = val(opts, k);
  if (opts.bayLength === undefined && hv) cfg.bayLength = 10;
  if (opts.bayWidth === undefined && hv) cfg.bayWidth = 2.5;
  const pick = chooseDrum(cable, rules, opts);
  if (!pick.drum) throw Error('no drum in the table meets the flange, barrel and payload limits');
  const maxL = pick.drum.maxLength;
  const pr = profile(route);
  const total = pr.d3[pr.n - 1];
  const step = opts.searchStep || 1;
  const coreLen = (t0, t1) => Math.max(...pr.cores.map((c) => interp(pr, c, t1) - interp(pr, c, t0)));
  // Ordered length of one core for the section between 3D distances t0 and t1 (before rounding).
  const need = (t0, t1) => {
    const ends = (t0 <= 0 ? cfg.terminationAllowance : cfg.jointAllowance) + (t1 >= total ? cfg.terminationAllowance : cfg.jointAllowance);
    return coreLen(t0, t1) * (1 + cfg.snaking) + ends + cfg.drumEndWaste;
  };
  const fits = (t0, t1) => Math.ceil(need(t0, t1) / cfg.orderIncrement - 1e-9) * cfg.orderIncrement <= maxL + 1e-9;
  // Farthest end t1 reachable from t0 on one drum (bisection on the monotone need()).
  const reach = (t0) => {
    if (fits(t0, total)) return total;
    let lo = t0, hi = total;
    for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (fits(t0, m)) lo = m; else hi = m; }
    return lo;
  };
  const issues = [];
  let joints = [];
  // Fewest drums first, then balance: aim each joint at an equal share of what is left, move it to the nearest
  // acceptable spot that the drum can still reach. Add a drum and retry when the balanced plan does not close.
  const n0 = Math.max(1, Math.ceil(total * (1 + cfg.snaking) / maxL));
  for (let n = n0; ; n++) {
    if (n > n0 + 200) { issues.push('no balanced plan found within 200 extra drums per core'); break; }
    const placed = [];
    let prev = 0;
    for (let k = 1; k < n; k++) {
      const far = reach(prev);
      const target = prev + (total - prev) / (n - k + 1);
      let best = null;
      for (let d = 0; d <= far - prev; d += step) {
        for (const t of d === 0 ? [target] : [target - d, target + d]) {
          if (t <= prev + cfg.bayLength || t > far) continue;
          if (!bayProblems(pr, route, t, cfg, crossings).length) { best = t; break; }
        }
        if (best !== null) break;
      }
      if (best === null) { best = Math.min(target, far); placed.push({ t: best, forced: true }); } else placed.push({ t: best, forced: false });
      prev = best;
    }
    joints = placed;
    if (fits(prev, total)) break; // the last section ends at the termination: test it with that allowance
  }
  const cuts = [0, ...joints.map((j) => j.t), total];
  const cores = pr.cores.length;
  const sections = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const t0 = cuts[i], t1 = cuts[i + 1];
    const len = coreLen(t0, t1);
    const ordered = Math.ceil(need(t0, t1) / cfg.orderIncrement - 1e-9) * cfg.orderIncrement;
    sections.push({
      index: i + 1, from: t0, to: t1, fromChainage: interp(pr, pr.plan, t0), toChainage: interp(pr, pr.plan, t1),
      routeLength3d: t1 - t0, coreLength3d: len, snaking: len * cfg.snaking,
      endAllowances: need(t0, t1) - len * (1 + cfg.snaking) - cfg.drumEndWaste, drumEndWaste: cfg.drumEndWaste,
      orderedPerCore: ordered, drums: cores, withinDrum: ordered <= maxL + 1e-9,
    });
  }
  const bays = joints.map((j, i) => {
    const [x, y, z] = pointAt(pr, j.t);
    const q = pointAt(pr, Math.min(total, j.t + 0.5)), p = pointAt(pr, Math.max(0, j.t - 0.5));
    const problems = bayProblems(pr, route, j.t, cfg, crossings);
    if (problems.length) issues.push(`joint bay ${i + 1} at ${interp(pr, pr.plan, j.t).toFixed(1)} m: ${problems.join(', ')}`);
    return { index: i + 1, distance3d: j.t, chainage: interp(pr, pr.plan, j.t), x, y, z, heading: Math.atan2(q[1] - p[1], q[0] - p[0]), problems };
  });
  for (const s of sections) if (!s.withinDrum) issues.push(`section ${s.index} needs ${s.orderedPerCore} m per core, over the ${maxL.toFixed(0)} m drum limit`);
  const installed = sections.reduce((a, s) => a + s.coreLength3d * (1 + cfg.snaking), 0) * cores;
  const ordered = sections.reduce((a, s) => a + s.orderedPerCore, 0) * cores;
  const schedule = {
    cable: { id: cable.id, od_mm: cable.od_mm, massKgPerM: pick.mass.kgPerM, massBasis: pick.mass.basis },
    drum: { id: pick.drum.id, flange: pick.drum.flange, barrel: pick.drum.barrel, width: pick.drum.width, capacity: pick.drum.capacity,
      byWeight: pick.drum.byWeight, maxLength: maxL, governs: pick.drum.governs, minBarrel: pick.minBarrel, barrelRule: pick.bend, rejected: pick.rejected,
      basis: opts.drums ? 'drum table passed in' : "assumed typical drum sizes, not a maker's table" },
    sections,
    joints: bays,
    totals: {
      routeLength3d: total, cores, drums: sections.length * cores, jointBays: bays.length, joints: bays.length * cores,
      orderedPerCore: ordered / cores, orderedTotal: ordered, installedTotal: installed, waste: ordered - installed,
      wasteFraction: ordered > 0 ? (ordered - installed) / ordered : 0,
    },
    assumptions: Object.keys(ASSUMED).map((k) => ({ name: k, value: cfg[k], unit: ASSUMED[k].unit, basis: ASSUMED[k].basis, overridden: opts[k] !== undefined })),
    issues,
  };
  schedule.drawLines = () => drawJointBays(bays, cfg, groundAt);
  return schedule;
}

// Joint bays as small outlined pits: rim rectangle at ground, floor rectangle, four corner edges. Float32Array of x,y,z pairs.
export function drawJointBays(bays, cfg = {}, groundAt = null) {
  const L = cfg.bayLength || ASSUMED.bayLength.value, W = cfg.bayWidth || ASSUMED.bayWidth.value;
  const below = cfg.bayFloorBelowCable !== undefined ? cfg.bayFloorBelowCable : ASSUMED.bayFloorBelowCable.value;
  const cover = cfg.coverIfNoGround !== undefined ? cfg.coverIfNoGround : ASSUMED.coverIfNoGround.value;
  const out = new Float32Array(bays.length * 12 * 6);
  let o = 0;
  const seg = (a, b) => { out[o++] = a[0]; out[o++] = a[1]; out[o++] = a[2]; out[o++] = b[0]; out[o++] = b[1]; out[o++] = b[2]; };
  for (const b of bays) {
    const c = Math.cos(b.heading), s = Math.sin(b.heading);
    const corners = [[-L / 2, -W / 2], [L / 2, -W / 2], [L / 2, W / 2], [-L / 2, W / 2]].map(([u, v]) => [b.x + u * c - v * s, b.y + u * s + v * c]);
    const floor = b.z - below;
    const top = corners.map(([x, y]) => [x, y, groundAt ? groundAt(x, y) : b.z + cover]);
    const bot = corners.map(([x, y]) => [x, y, floor]);
    for (let i = 0; i < 4; i++) { seg(top[i], top[(i + 1) % 4]); seg(bot[i], bot[(i + 1) % 4]); seg(top[i], bot[i]); }
  }
  return out;
}
