// roads.mjs: road-build simulation, a world layer pack (world.pack.v1). ILLUSTRATIVE. It shows the order of work
// and the quantities that a design road line implies. It is not a programme, a method statement or a design.
// Self-contained: no imports. Local metres from the site origin: x east, y north, z up.
//
// The pack takes a design road line and works out a cross-section every `section` metres. Quantities between two
// sections use the average end area method. The stages, in the order they are built:
//   1 strip             topsoil stripped over the works footprint plus a working margin each side
//   2 earthworks        cut and fill from the stripped ground to formation, with batters out to daylight
//   3 geotextile        a separator laid on the formation under the carriageway
//   4 sub-base          stone laid on the geotextile
//   5 compact-sub-base  rolled in passes
//   6 surface           the upper course or courses
//   7 compact-surface   rolled in passes
//   8 drainage          swales along runs in cut, and culverts where the road crosses a low point on fill
// Each stage runs along the road from chainage 0 at an illustrative output rate, and its front advances in
// proportion to the work done, so it moves slowly through heavy cut and quickly where there is little to do.
//
// Design rules follow the world's road cartridge and its shared earthworks engine: grade points at equal spacing,
// each at the mean ground level over its spacing, with the ends tied in to the ground; straight grades joined by
// symmetric parabolic vertical curves; a crown or one-way cross-fall; formation at the finished level less the
// build-up; batters from each finished edge at 1 in n until they meet the ground (the same batter rule as batterZ in
// the world's lib/earthworks.mjs). Volumes are bank measure, with no bulking or shrinkage.
//
// Sources and assumed values (ASSUMED means a typical value that a designer must confirm for a real scheme):
// - Cross-fall 2.5 % on a bound surface: DMRB CD 109. Cross-fall 4 % on an unbound surface: ASSUMED.
// - Maximum gradient 10 %: ASSUMED design limit for heavy vehicles on a site access road.
// - Build-ups: ASSUMED light-duty values. Unbound sub-base as Specification for Highway Works Series 800 cl. 803;
//   bound mixtures named as BS EN 13108-1.
// - Batters 1 in 2 in cut and fill, topsoil 0.30 m, working margin 0.5 m each side: ASSUMED.
// - Compaction: 6 passes a layer, ASSUMED. The method table in SHW Series 800 (Table 8/1) sets real values by
//   roller type and layer thickness.
// - Swale 0.4 m deep with sides at 1 in 3, and a culvert where a ground low point at least 0.2 m deep lies under
//   fill: ASSUMED.
// - Output rates per hour, the 10-hour working day and the minimum longitudinal fall in cut (0.5 %): ASSUMED,
//   for illustration only.
// Known simplifications: sections are square to the segment they fall on, so a bend is not integrated exactly; the
// topsoil is not put back on the batters; geotextile laps and haul are not counted.

const EPS = 1e-9;

export const SURFACES = Object.freeze({
  gravel: Object.freeze({ crossfall: 0.04, subBase: 0.25, surface: 0.10, surfaceName: 'crushed rock wearing course' }),
  tarmac: Object.freeze({ crossfall: 0.025, subBase: 0.15, surface: 0.10, surfaceName: 'asphalt surface and binder courses' })
});

export const STAGES = Object.freeze([
  { id: 'strip', title: 'Strip topsoil', unit: 'm3', rate: 60, machines: ['dozer', 'excavator', 'dump truck'], colour: [0.55, 0.40, 0.25, 0.9] },
  { id: 'earthworks', title: 'Cut and fill to formation', unit: 'm3', rate: 80, machines: ['excavator', 'dump truck', 'dozer'], colour: [0.85, 0.62, 0.35, 0.9] },
  { id: 'geotextile', title: 'Lay geotextile', unit: 'm2', rate: 400, machines: ['loader'], colour: [0.92, 0.92, 0.86, 0.9] },
  { id: 'sub-base', title: 'Lay sub-base stone', unit: 'm3', rate: 50, machines: ['dump truck', 'grader'], colour: [0.62, 0.62, 0.66, 0.9] },
  { id: 'compact-sub-base', title: 'Compact sub-base', unit: 'm2 passes', rate: 3000, machines: ['roller'], colour: [0.45, 0.47, 0.52, 0.95] },
  { id: 'surface', title: 'Lay surface course', unit: 'm3', rate: 40, machines: ['dump truck', 'paver', 'grader'], colour: [0.78, 0.74, 0.66, 0.95] },
  { id: 'compact-surface', title: 'Compact surface', unit: 'm2 passes', rate: 3000, machines: ['roller'], colour: [0.56, 0.54, 0.50, 1] },
  { id: 'drainage', title: 'Drainage: swales and culverts', unit: 'h', rate: 1, machines: ['excavator'], colour: [0.35, 0.65, 0.95, 0.95] }
].map(s => Object.freeze({ ...s, machines: Object.freeze(s.machines), colour: Object.freeze(s.colour) })));

export const DEFAULTS = Object.freeze({
  path: Object.freeze([[0, 0], [60, 10], [120, 40], [180, 45]]),
  width: 4, surface: 'gravel', fall: 'crown', maxGradient: 0.10, spacing: 20, curveLength: 20,
  fillSlope: 2, cutSlope: 2, topsoil: 0.3, margin: 0.5, section: 2, du: 0.1, passes: 6,
  swaleDepth: 0.4, swaleSide: 3, swaleRate: 40, culvertHours: 4, culvertDepth: 0.2, culvertReach: 20,
  hoursPerDay: 10, minCrossfall: 0.025, maxCrossfall: 0.08, minGradeInCut: 0.005, playSeconds: 60
});
const MAX_REACH = 80;          // metres beyond an edge a batter may run
const DRAW_SECTIONS = 120;     // most cross-sections drawn
const DRAW_SEGS = 24;          // segments across one drawn section, outside the carriageway

// The world's batter rule (lib/earthworks.mjs batterZ): the ground, clamped between the fill batter falling from the
// edge and the cut batter rising from it. inv(h) turns 1 in h into vertical per horizontal.
export const inv = h => (h > 0 ? 1 / h : Infinity);
export const batterZ = (g, level, d, invCut, invFill) => Math.min(Math.max(g, level - d * invFill), level + d * invCut);

// Checks and merges settings; throws in words on a bad value.
export function settings(given = {}) {
  const o = { ...DEFAULTS, ...(given || {}) };
  const pos = k => { if (!(Number.isFinite(o[k]) && o[k] > 0)) throw Error(`${k} must be a positive number`); };
  ['width', 'maxGradient', 'spacing', 'curveLength', 'fillSlope', 'cutSlope', 'margin', 'section', 'du', 'passes',
    'swaleDepth', 'swaleSide', 'swaleRate', 'culvertHours', 'culvertDepth', 'culvertReach', 'hoursPerDay', 'playSeconds'].forEach(pos);
  if (!(Number.isFinite(o.topsoil) && o.topsoil >= 0)) throw Error('topsoil must be zero or more metres');
  if (!SURFACES[o.surface]) throw Error(`surface must be one of ${Object.keys(SURFACES).join(', ')}`);
  if (!['crown', 'left', 'right'].includes(o.fall)) throw Error('fall must be crown, left or right');
  if (o.crossfall !== undefined && !(Number.isFinite(o.crossfall) && o.crossfall >= 0)) throw Error('crossfall must be zero or more');
  if (!Array.isArray(o.path) || o.path.length < 2 || o.path.some(p => !Array.isArray(p) || !Number.isFinite(+p[0]) || !Number.isFinite(+p[1])))
    throw Error('path must be two or more [x, y] points in local metres');
  if (o.section < o.du * 4) throw Error('section spacing must be at least four sample widths');
  return o;
}

/**
 * planRoad(settings, groundAt) -> the build plan: design, sections, stage quantities (with cumulative totals per
 * section interval, for the moving fronts), drainage and checks. Pure: the same inputs give the same plan.
 */
export function planRoad(given, groundAt) {
  if (typeof groundAt !== 'function') throw Error('no ground to build on');
  const o = settings(given), spec = SURFACES[o.surface];
  const crossfall = o.crossfall ?? spec.crossfall, build = spec.subBase + spec.surface, half = o.width / 2, t = o.topsoil;
  const G = (x, y) => { const z = groundAt(x, y); if (!Number.isFinite(z)) throw Error(`no ground at ${x.toFixed(1)}, ${y.toFixed(1)}`); return z; };

  // ---- the line in plan
  const pts = [];
  for (const p of o.path) { const q = [+p[0], +p[1]], l = pts[pts.length - 1]; if (!l || Math.hypot(q[0] - l[0], q[1] - l[1]) > 1e-6) pts.push(q); }
  if (pts.length < 2) throw Error('the road line needs two distinct points');
  const segs = [];
  let L = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], len = Math.hypot(bx - ax, by - ay);
    segs.push({ ax, ay, dx: (bx - ax) / len, dy: (by - ay) / len, len, s0: L });
    L += len;
  }
  const segAt = s => segs.find(g => s <= g.s0 + g.len + EPS) || segs[segs.length - 1];
  const pointAt = s => { const c = Math.min(Math.max(s, 0), L), g = segAt(c), u = Math.min(Math.max(c - g.s0, 0), g.len); return [g.ax + g.dx * u, g.ay + g.dy * u]; };

  // ---- vertical alignment: grade points, straight grades, parabolic curves (as the world's road cartridge)
  const n0 = Math.max(1, Math.round(L / o.spacing)), d0 = L / n0, zAt = s => { const [x, y] = pointAt(s); return G(x, y); };
  const pvi = [];
  for (let i = 0; i <= n0; i++) {
    const s = i * d0;
    if (i === 0 || i === n0) { pvi.push([s, zAt(s)]); continue; }
    const k = Math.max(4, Math.ceil(d0));
    let sum = 0;
    for (let j = 0; j < k; j++) sum += zAt(s - d0 / 2 + (j + 0.5) * d0 / k);
    pvi.push([s, sum / k]);
  }
  const grades = [];
  for (let i = 0; i < pvi.length - 1; i++) grades.push((pvi[i + 1][1] - pvi[i][1]) / (pvi[i + 1][0] - pvi[i][0]));
  const curves = [];
  for (let i = 1; i < pvi.length - 1; i++) {
    const Lc = Math.min(o.curveLength, pvi[i][0] - pvi[i - 1][0], pvi[i + 1][0] - pvi[i][0]);
    if (Lc > 0) curves.push({ i, s: pvi[i][0], Lc, g1: grades[i - 1], g2: grades[i] });
  }
  function level(s) {
    const c = Math.min(Math.max(s, 0), L);
    for (const v of curves) {
      const x = c - (v.s - v.Lc / 2);
      if (x >= 0 && x <= v.Lc) { const r = (v.g2 - v.g1) / v.Lc; return [pvi[v.i][1] - v.g1 * v.Lc / 2 + v.g1 * x + r * x * x / 2, v.g1 + r * x]; }
    }
    let i = 0;
    while (i < grades.length - 1 && c > pvi[i + 1][0]) i++;
    return [pvi[i][1] + grades[i] * (c - pvi[i][0]), grades[i]];
  }
  const designLevel = s => level(s)[0], gradeAt = s => level(s)[1];
  const fallAt = off => (o.fall === 'crown' ? Math.abs(off) : o.fall === 'left' ? off : -off) * crossfall;
  const finishedAt = (s, off) => designLevel(s) - fallAt(off);

  // ---- stations
  const n = Math.max(1, Math.ceil(L / o.section)), stations = [];
  for (let k = 0; k <= n; k++) stations.push(k * L / n);
  let maxDiff = 0;
  for (const s of stations) maxDiff = Math.max(maxDiff, Math.abs(designLevel(s) - zAt(s)));
  const ratio = Math.max(o.fillSlope, o.cutSlope);
  const reach = Math.min(ratio * (maxDiff + build + crossfall * half + t + 2) * 2, MAX_REACH);
  const R = half + reach, invCut = inv(o.cutSlope), invFill = inv(o.fillSlope);

  // Earthworks surface at offset u of a section at s, against stripped ground gs.
  const surfaceAt = (s, u, gs) => Math.abs(u) <= half + EPS ? finishedAt(s, u) - build
    : batterZ(gs, finishedAt(s, Math.sign(u) * half), Math.abs(u) - half, invCut, invFill);

  // ---- sections
  // Samples across a section: the carriageway and each side are sampled apart, so the edges and the crown fall on
  // sample boundaries and the carriageway areas are exact (midpoint rule on straight falls).
  const mC = 2 * Math.ceil(half / o.du), wC = 2 * half / mC, mS = Math.ceil(reach / o.du), wS = reach / mS, offs = [];
  for (let j = 0; j < mS; j++) offs.push([-R + (j + 0.5) * wS, wS, j === 0]);
  for (let j = 0; j < mC; j++) offs.push([-half + (j + 0.5) * wC, wC, false]);
  for (let j = 0; j < mS; j++) offs.push([half + (j + 0.5) * wS, wS, j === mS - 1]);
  const sections = stations.map(s => {
    const [x, y] = pointAt(s), g = segAt(s), nx = -g.dy, ny = g.dx;
    let cut = 0, fill = 0, worked = 0, uMin = -half, uMax = half, edge = false;
    for (const [u, du, outer] of offs) {
      const gs = G(x + nx * u, y + ny * u) - t, e = surfaceAt(s, u, gs), d = gs - e;
      if (d > 0) cut += d * du; else fill -= d * du;
      if (Math.abs(u) <= half || Math.abs(d) > EPS) { worked += du; uMin = Math.min(uMin, u - du / 2); uMax = Math.max(uMax, u + du / 2); if (outer) edge = true; }
    }
    const inCut = [1, -1].map(side => finishedAt(s, side * half) < G(x + nx * side * (half + 0.1), y + ny * side * (half + 0.1)) - 1e-6);
    return { s, x, y, nx, ny, cut, fill, worked, strip: worked + 2 * o.margin, uMin: uMin - o.margin, uMax: uMax + o.margin, edge,
      gc: G(x, y), zc: designLevel(s), grade: gradeAt(s), cutSides: (inCut[0] ? 1 : 0) + (inCut[1] ? 1 : 0), inCut };
  });

  // ---- culverts: a ground low point under the centreline, on fill, at least culvertDepth below the ground either side
  const culverts = [];
  const win = Math.max(1, Math.round(o.culvertReach / (L / n)));
  for (let k = 1; k < n; k++) {
    const c = sections[k];
    if (!(c.gc < sections[k - 1].gc && c.gc <= sections[k + 1].gc && c.zc > c.gc + 0.05)) continue;
    let hiL = -Infinity, hiR = -Infinity;
    for (let j = Math.max(0, k - win); j < k; j++) hiL = Math.max(hiL, sections[j].gc);
    for (let j = k + 1; j <= Math.min(n, k + win); j++) hiR = Math.max(hiR, sections[j].gc);
    if (Math.min(hiL, hiR) - c.gc < o.culvertDepth) continue;
    if (culverts.length && c.s - culverts[culverts.length - 1].s < o.culvertReach) continue;
    culverts.push({ k, s: c.s, x: c.x, y: c.y, length: c.uMax - c.uMin, invert: c.gc });
  }
  const culvertAt = new Map(culverts.map(c => [Math.min(c.k, n - 1), c]));

  // ---- quantities per interval, average end areas
  const swaleArea = o.swaleDepth * o.swaleDepth * o.swaleSide;       // a V with sides 1 in swaleSide
  const q = STAGES.map(() => new Float64Array(n));
  let topsoil = 0, cutM3 = 0, fillM3 = 0, length3d = 0, swaleLength = 0, swaleM3 = 0;
  for (let k = 0; k < n; k++) {
    const a = sections[k], b = sections[k + 1], ds = b.s - a.s, l3 = Math.hypot(ds, b.zc - a.zc);
    const top = (a.strip + b.strip) / 2 * t * ds, cut = (a.cut + b.cut) / 2 * ds, fill = (a.fill + b.fill) / 2 * ds;
    const sw = (a.cutSides + b.cutSides) / 2 * ds;
    topsoil += top; cutM3 += cut; fillM3 += fill; length3d += l3; swaleLength += sw; swaleM3 += sw * swaleArea;
    q[0][k] = top;
    q[1][k] = cut + fill;
    q[2][k] = o.width * l3;
    q[3][k] = o.width * spec.subBase * l3;
    q[4][k] = o.width * l3 * o.passes;
    q[5][k] = o.width * spec.surface * l3;
    q[6][k] = o.width * l3 * o.passes;
    q[7][k] = sw * swaleArea / o.swaleRate + (culvertAt.has(k) ? o.culvertHours : 0);
  }
  const stages = STAGES.map((st, i) => {
    const cum = new Float64Array(n + 1);
    for (let k = 0; k < n; k++) cum[k + 1] = cum[k] + q[i][k];
    return { ...st, total: cum[n], cum, hours: cum[n] / st.rate };
  });

  // ---- checks
  const maxGrade = grades.reduce((mx, g) => Math.max(mx, Math.abs(g)), 0);
  let steepM = 0, flatCutM = 0;
  for (let k = 0; k < n; k++) {
    const a = sections[k], b = sections[k + 1], ds = b.s - a.s, g = Math.abs(gradeAt((a.s + b.s) / 2));
    if (g > o.maxGradient + 1e-12) steepM += ds;
    if (g < o.minGradeInCut && (a.cutSides || b.cutSides)) flatCutM += ds;
  }
  const checks = {
    maxGrade, maxGradient: o.maxGradient, gradeOk: maxGrade <= o.maxGradient + 1e-12, steepM,
    crossfall, minCrossfall: o.minCrossfall, maxCrossfall: o.maxCrossfall,
    crossfallOk: crossfall >= o.minCrossfall - 1e-12 && crossfall <= o.maxCrossfall + 1e-12,
    flatCutM, minGradeInCut: o.minGradeInCut, drainageOk: flatCutM === 0, reachLimited: sections.some(c => c.edge)
  };

  // ---- drawing samples at up to DRAW_SECTIONS stations
  const every = Math.max(1, Math.ceil((n + 1) / DRAW_SECTIONS)), draw = [];
  for (let k = 0; k <= n; k += every) draw.push(k);
  if (draw[draw.length - 1] !== n) draw.push(n);
  for (const k of draw) {
    const c = sections[k], us = [], g = [], gs = [], e = [];
    const add = u => { const z = G(c.x + c.nx * u, c.y + c.ny * u); us.push(u); g.push(z); gs.push(z - t); e.push(surfaceAt(c.s, u, z - t)); };
    const outer = (a, b) => { const k2 = Math.max(1, Math.ceil(DRAW_SEGS * (b - a) / Math.max(EPS, c.uMax - c.uMin - 2 * half))); for (let i = 0; i <= k2; i++) add(a + (b - a) * i / k2); };
    outer(c.uMin, -half - 1e-6);
    for (let i = 0; i <= 8; i++) add(-half + i * half / 4);
    outer(half + 1e-6, c.uMax);
    c.draw = { u: us, g, gs, e };
  }
  const totalHours = stages.reduce((h, st) => h + st.hours, 0);
  return {
    settings: o, surface: spec, crossfall, build, half, L, length3d, pts, pointAt, designLevel, gradeAt, finishedAt,
    stations, sections, draw, stages, culverts, checks, totalHours,
    totals: { topsoilM3: topsoil, cutM3, fillM3, geotextileM2: q[2].reduce((a, b) => a + b, 0), subBaseM3: stages[3].total,
      surfaceM3: stages[5].total, swaleLength, swaleM3, culverts: culverts.length },
    headingAt: s => { const g = segAt(Math.min(Math.max(s, 0), L)); return Math.atan2(g.dy, g.dx); }
  };
}

// Chainage reached by `done` units of stage i on plan p.
export function frontOf(p, i, done) {
  if (i >= STAGES.length) return p.L;
  const cum = p.stages[i].cum, n = cum.length - 1;
  if (!(cum[n] > 0)) return p.L;
  if (done <= 0) return 0;
  let lo = 0, hi = n;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] < done) lo = mid; else hi = mid; }
  const a = cum[lo], b = cum[hi], f = b > a ? Math.min(1, (done - a) / (b - a)) : 1;
  return p.stations[lo] + f * (p.stations[hi] - p.stations[lo]);
}

// ---------------------------------------------------------------- the pack's state

let api = null, on = true, given = {}, cfgVersion = 0, plan = null, planKey = null, problem = null, planId = 0;
let playing = false, stage = 0, done = 0, hours = 0, speedMul = 1, pace = {}, lastEmit = -Infinity, announced = -1;
let cache = { built: null, builtKey: '', front: null, frontKey: '', design: null, designKey: '' };

const emit = (topic, payload) => { try { api?.events?.emit(topic, payload); } catch (e) { api?.log?.(`emit ${topic}: ${e.message}`); } };
const fmt = v => Math.round(v).toLocaleString('en-GB');
const pct = v => (v * 100).toFixed(1);

function ensurePlan(ctx) {
  const h = ctx && ctx.heightAt;
  if (typeof h !== 'function') return plan;
  const key = `${ctx.groundVersion ?? 0}|${cfgVersion}`;
  if (planKey === key) return plan;
  const frac = plan && stage < STAGES.length && plan.stages[stage].total > 0 ? done / plan.stages[stage].total : 0;
  planKey = key;
  try { plan = planRoad(given, h); problem = null; planId++; }
  catch (e) { plan = null; problem = e.message; playing = false; return null; }
  if (stage < STAGES.length) done = frac * plan.stages[stage].total;
  return plan;
}

function announce() {
  if (!plan || stage >= STAGES.length || announced === stage) return;
  announced = stage;
  const st = plan.stages[stage];
  emit('stage', { stage: st.id, index: stage, title: st.title });
  emit('task', { stage: st.id, title: st.title, machines: [...st.machines], from: 0, to: plan.L, quantity: st.total, unit: st.unit, hours: st.hours });
}

function advanceHours(h) {
  while (h > 0 && stage < STAGES.length) {
    const st = plan.stages[stage], rate = st.rate * (pace[st.id] ?? 1), need = Math.max(0, st.total - done) / rate;
    if (need <= h) { h -= need; hours += need; done = 0; stage++; if (stage < STAGES.length) announce(); }
    else { done += h * rate; hours += h; h = 0; }
  }
  if (stage >= STAGES.length && playing) { playing = false; emit('done', { hours, length: plan.L }); }
}

function progress(force) {
  const s = frontOf(plan, stage, done);
  if (!force && Math.abs(s - lastEmit) < 1) return;
  lastEmit = s;
  const [x, y] = plan.pointAt(s);
  emit('progress', { stage: STAGES[Math.min(stage, STAGES.length - 1)].id, chainage: s, x, y, z: plan.designLevel(s), heading: plan.headingAt(s), complete: stage >= STAGES.length });
}

const reset = () => { stage = 0; done = 0; hours = 0; lastEmit = -Infinity; announced = -1; playing = false; };

// ---------------------------------------------------------------- drawing

function toBatch(key, version, segs, colour, origin) {
  const p = new Float32Array(segs.length);
  for (let i = 0; i < segs.length; i += 3) { p[i] = segs[i] - origin[0]; p[i + 1] = segs[i + 1] - origin[1]; p[i + 2] = segs[i + 2] - origin[2]; }
  return { key, version, positions: p, color: [...colour], origin: [...origin] };
}
const seg = (out, a, b) => out.push(a[0], a[1], a[2], b[0], b[1], b[2]);
const at = (c, u, z) => [c.x + c.nx * u, c.y + c.ny * u, z];
function poly(out, c, us, zs) { for (let i = 1; i < us.length; i++) seg(out, at(c, us[i - 1], zs[i - 1]), at(c, us[i], zs[i])); }

// The cross-section as built up to and including stage `top` (an index into STAGES). Swales go to `drain`.
function sectionLines(out, c, top, drain) {
  const d = c.draw, p = plan, half = p.half, sub = p.surface.subBase;
  if (top === 0) { poly(out, c, d.u, d.gs); return; }
  const outside = d.u.map((u, i) => Math.abs(u) > half + 1e-9 ? i : -1).filter(i => i >= 0);
  const left = outside.filter(i => d.u[i] < 0), right = outside.filter(i => d.u[i] > 0);
  poly(out, c, left.map(i => d.u[i]), left.map(i => d.e[i]));
  poly(out, c, right.map(i => d.u[i]), right.map(i => d.e[i]));
  const cw = [], form = [];
  for (let i = 0; i <= 8; i++) { const u = -half + i * half / 4; cw.push(u); form.push(p.finishedAt(c.s, u) - p.build); }
  if (top >= 1) poly(out, c, cw, form);
  if (top === 2) poly(out, c, cw, form.map(z => z + 0.02));
  const upper = top >= 5 ? cw.map(u => p.finishedAt(c.s, u)) : top >= 3 ? form.map(z => z + sub) : null;
  if (upper) {
    poly(out, c, cw, upper);
    seg(out, at(c, -half, form[0]), at(c, -half, upper[0]));
    seg(out, at(c, half, form[8]), at(c, half, upper[8]));
  }
  if (top >= 7 && c.inCut) {
    const w = p.settings.swaleDepth * p.settings.swaleSide;
    c.inCut.forEach((inCut, i) => {
      if (!inCut) return;
      const side = i === 0 ? 1 : -1, u0 = side * (half + 0.1), z0 = p.finishedAt(c.s, side * half) - p.build;
      seg(drain, at(c, u0, z0), at(c, u0 + side * w / 2, z0 - p.settings.swaleDepth));
      seg(drain, at(c, u0 + side * w / 2, z0 - p.settings.swaleDepth), at(c, u0 + side * w, z0));
    });
  }
}

function builtBatches(front) {
  const p = plan, frontIdx = p.draw.filter(k => p.sections[k].s <= front + 1e-9).length;
  const key = `${planId}:${stage}:${frontIdx}`;
  if (cache.builtKey === key) return cache.built;
  const groups = STAGES.map(() => []), origin = originOf();
  let prevTop = null, prevC = null;
  for (let j = 0; j < p.draw.length; j++) {
    const c = p.sections[p.draw[j]], completed = Math.min(STAGES.length, stage + (j < frontIdx ? 1 : 0));
    const top = completed - 1;
    if (top >= 0) {
      sectionLines(groups[Math.min(top, 6)], c, top, groups[7]);
      if (prevTop === top && prevC) {       // carriageway edges between neighbouring sections at the same state
        const zOf = (cc, u) => top >= 5 ? p.finishedAt(cc.s, u) : top >= 3 ? p.finishedAt(cc.s, u) - p.build + p.surface.subBase
          : top >= 1 ? p.finishedAt(cc.s, u) - p.build : null;
        for (const u of [-p.half, p.half]) {
          const z0 = zOf(prevC, u), z1 = zOf(c, u);
          if (z0 !== null) seg(groups[Math.min(top, 6)], at(prevC, u, z0), at(c, u, z1));
        }
      }
    }
    prevTop = top; prevC = c;
  }
  if (stage >= STAGES.length) for (const cv of p.culverts) {
    const c = p.sections[cv.k];
    for (const off of [-0.3, 0.3]) {
      const a = [c.x + c.nx * c.uMin + c.ny * off, c.y + c.ny * c.uMin - c.nx * off, cv.invert + 0.3];
      const b = [c.x + c.nx * c.uMax + c.ny * off, c.y + c.ny * c.uMax - c.nx * off, cv.invert + 0.3];
      seg(groups[7], a, b);
    }
  }
  const out = [];
  groups.forEach((g, i) => { if (g.length) out.push(toBatch('built-' + STAGES[i].id, `${key}:${i}`, g, STAGES[i].colour, origin)); });
  cache.built = out; cache.builtKey = key;
  return out;
}

function originOf() { const c = plan.sections[0]; return [Math.round(c.x), Math.round(c.y), Math.round(c.zc)]; }

function designBatch() {
  const key = `design:${planId}`;
  if (cache.designKey === key) return cache.design;
  const p = plan, out = [];
  for (let j = 1; j < p.draw.length; j++) {
    const a = p.sections[p.draw[j - 1]], b = p.sections[p.draw[j]];
    for (const u of [-p.half, 0, p.half]) seg(out, at(a, u, p.finishedAt(a.s, u)), at(b, u, p.finishedAt(b.s, u)));
  }
  cache.design = toBatch('design', key, out, [1, 1, 1, 0.35], originOf()); cache.designKey = key;
  return cache.design;
}

function frontBatch(front) {
  const i = Math.min(stage, STAGES.length - 1), key = `front:${planId}:${stage}:${Math.round(front * 10)}`;
  if (cache.frontKey === key) return cache.front;
  const p = plan, [x, y] = p.pointAt(front), z = p.designLevel(front), h = p.headingAt(front), nx = -Math.sin(h), ny = Math.cos(h), w = p.half + 1;
  const out = [];
  seg(out, [x, y, z], [x, y, z + 4]);
  seg(out, [x - nx * w, y - ny * w, z + 0.5], [x + nx * w, y + ny * w, z + 0.5]);
  seg(out, [x, y, z + 4], [x + Math.cos(h) * 1.5, y + Math.sin(h) * 1.5, z + 3.5]);
  cache.front = toBatch('front', key, out, STAGES[i].colour, originOf()); cache.frontKey = key;
  return cache.front;
}

// ---------------------------------------------------------------- the pack

const STAGE_IDS = STAGES.map(s => s.id);
const HELP = 'road play · pause · toggle · step · reset · speed <x> · stage <name> · line <x y ...> · width <m> · surface gravel|tarmac · report · check';

export default {
  id: 'roads',
  init(a) {
    api = a;
    given = settings(a.config || {});
    if (a.config && a.config.play === true) playing = true;
    if (a.config && Number.isFinite(a.config.speed) && a.config.speed > 0) speedMul = a.config.speed;
    a.events.on('machinery/pace', p => {
      if (p && STAGE_IDS.includes(p.stage) && Number.isFinite(p.factor) && p.factor > 0 && p.factor <= 10) pace[p.stage] = p.factor;
    });
  },
  setEnabled(v) { on = !!v; if (!on) playing = false; },
  // One fixed step. Deterministic: simulated hours advance by dt times the speed, with no clock and no randomness.
  step(dt, ctx) {
    if (!ensurePlan(ctx) || !playing) return;
    announce();
    advanceHours(dt * plan.totalHours / plan.settings.playSeconds * speedMul);
    progress(false);
  },
  active() { return on && playing && !!plan && stage < STAGES.length; },
  lines(ctx) {
    if (!ensurePlan(ctx)) return [];
    const front = frontOf(plan, stage, done);
    return [designBatch(), ...builtBatches(front), ...(stage < STAGES.length ? [frontBatch(front)] : [])];
  },
  hud(ctx) {
    ensurePlan(ctx);
    if (!plan) return [{ id: 'stage', text: `Road build: ${problem || 'waiting for ground'}`.slice(0, 80) }];
    const p = plan, c = p.checks, T = p.totals, front = frontOf(p, stage, done);
    const st = stage < STAGES.length ? p.stages[stage] : null;
    const frac = st && st.total > 0 ? done / st.total : 0;
    const day = Math.floor(hours / p.settings.hoursPerDay) + 1;
    return [
      { id: 'stage', text: st ? `Stage ${stage + 1}/8 ${st.title}, ${Math.round(frac * 100)} % at ch ${front.toFixed(0)} m` : `Build complete, ${p.L.toFixed(0)} m of road` },
      { id: 'volumes', text: `Topsoil ${fmt(T.topsoilM3)} m3, cut ${fmt(T.cutM3)} m3, fill ${fmt(T.fillM3)} m3` },
      { id: 'checks', text: `Grade ${pct(c.maxGrade)} % ${c.gradeOk ? 'ok' : 'over ' + pct(c.maxGradient)}; cross-fall ${pct(c.crossfall)} % ${c.crossfallOk ? 'ok' : 'out'}${c.drainageOk ? '' : `; ${c.flatCutM.toFixed(0)} m flat in cut`}` },
      { id: 'clock', text: `Day ${day}, ${hours.toFixed(1)} h worked, ${playing ? 'playing' : 'paused'} x${speedMul}` }
    ];
  },
  commands() {
    return [{ verb: 'road', run }];
    function run(args, io) {
        const w = (args[0] || '').toLowerCase(), say = t => { try { io?.say?.(t); } catch { /* the answer still returns */ } };
        const need = () => { if (!plan) throw Error(problem ? `no plan: ${problem}` : 'no plan yet: the ground has not been drawn'); return plan; };
        if (w === 'play') { need(); if (stage >= STAGES.length) reset(); playing = true; announce(); return `road build playing, stage ${stage + 1}/8 ${STAGES[stage].id}`; }
        if (w === 'pause') { playing = false; return 'road build paused'; }
        if (w === 'toggle') return run([playing ? 'pause' : 'play'], io);
        if (w === 'reset') { reset(); return 'road build reset to stage 1, strip topsoil'; }
        if (w === 'step') {
          const p = need();
          if (stage >= STAGES.length) return 'the build is complete; road reset starts again';
          playing = false; announce(); hours += Math.max(0, p.stages[stage].total - done) / p.stages[stage].rate;
          done = 0; stage++; announce(); progress(true);
          return stage < STAGES.length ? `stage ${stage + 1}/8 ${STAGES[stage].id} next` : 'build complete';
        }
        if (w === 'speed') {
          const x = Number(args[1]);
          if (!(Number.isFinite(x) && x > 0 && x <= 100)) throw Error('road speed needs a number above 0 and at most 100: road speed 2');
          speedMul = x; return `road build speed x${x}`;
        }
        if (w === 'stage') {
          const p = need(), a = (args[1] || '').toLowerCase(), i = /^\d+$/.test(a) ? Number(a) - 1 : STAGE_IDS.indexOf(a);
          if (!(i >= 0 && i < STAGES.length)) throw Error(`road stage needs 1 to 8 or one of ${STAGE_IDS.join(', ')}`);
          stage = i; done = 0; hours = p.stages.slice(0, i).reduce((h, s) => h + s.hours, 0); announced = -1; announce(); progress(true);
          return `stage ${i + 1}/8 ${STAGES[i].id} from chainage 0`;
        }
        if (w === 'line') {
          const v = args.slice(1).map(Number);
          if (v.length < 4 || v.length % 2 || !v.every(Number.isFinite)) throw Error('road line needs pairs of numbers in local metres: road line 0 0 100 20 200 20');
          const path = []; for (let i = 0; i < v.length; i += 2) path.push([v[i], v[i + 1]]);
          given = settings({ ...given, path }); cfgVersion++; reset();
          return `design line of ${path.length} points set; the plan is worked out on the next frame`;
        }
        if (w === 'width' || w === 'surface') {
          const val = w === 'width' ? Number(args[1]) : (args[1] || '').toLowerCase();
          given = settings({ ...given, [w]: val }); cfgVersion++; reset();
          return `${w} ${val}${w === 'width' ? ' m' : ''} set`;
        }
        if (w === 'report') {
          const p = need(), T = p.totals;
          p.stages.forEach((s, i) => say(`${i + 1} ${s.title}: ${fmt(s.total)} ${s.unit}, ${s.hours.toFixed(1)} h`));
          say(`Swales ${fmt(T.swaleLength)} m (${fmt(T.swaleM3)} m3), culverts ${T.culverts}; geotextile ${fmt(T.geotextileM2)} m2`);
          return `${p.L.toFixed(0)} m road: topsoil ${fmt(T.topsoilM3)} m3, cut ${fmt(T.cutM3)} m3, fill ${fmt(T.fillM3)} m3, ${p.totalHours.toFixed(0)} h in all (illustrative)`;
        }
        if (w === 'check') {
          const c = need().checks;
          if (c.reachLimited) say(`a batter runs past ${MAX_REACH} m from the edge somewhere; volumes there are cut short`);
          return `grade max ${pct(c.maxGrade)} % (limit ${pct(c.maxGradient)} %, ${c.steepM.toFixed(0)} m over); cross-fall ${pct(c.crossfall)} % (${pct(c.minCrossfall)} to ${pct(c.maxCrossfall)} %) ${c.crossfallOk ? 'ok' : 'out'}; ${c.flatCutM.toFixed(0)} m in cut flatter than ${pct(c.minGradeInCut)} %`;
        }
        throw Error(HELP);
    }
  },
  dispose() {
    try { api?.events?.offAll?.(); } catch { /* already gone */ }
    api = null; plan = null; planKey = null; problem = null; given = {}; pace = {}; speedMul = 1; reset();
    cache = { built: null, builtKey: '', front: null, frontKey: '', design: null, designKey: '' };
  }
};
