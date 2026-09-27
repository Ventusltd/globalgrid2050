// Binoculars, the lens: magnification and field of view, the rangefinder under the reticle, and what it reads in words.
// Named as in Ventusltd/binoculars: a lens (this file, /src/lenses) and a mount (binoculars-mount.mjs, /src/mounts).
// Pure: no DOM, no WebGL. The mount (binoculars-mount.mjs) steadies the look, adds the horizon profile and draws the page.
// Local east (x), north (y), up (z) metres from the site origin; heights are metres above Ordnance Datum Newlyn (the
// terrain layers' own datum). Grid north is +y. The camera is camera.mjs's: yaw 0 north, +π/2 east, pitch up +.
//
// What the rangefinder rests on (nothing is guessed):
//   ground: measuredAt(x, y), the measured LiDAR tiles (1 m, and the far ring's 8 and 16 m tiles); NaN = not measured.
//   Past measured ground the reading is "beyond measured ground", never an extrapolated hill.
//   Earth curvature with standard refraction: drop = d²(1 − k) / 2R, R 6,371 km, k 0.13 (ASSUMED coefficient; the real
//   one varies with the air). It matters past a few kilometres: 1.7 m at 5 km, 6.8 m at 10 km.
//   Things: the lines drawn in the last frame (grid, national, water, roads, design tables), matched by batch key.

import { direction } from './camera.mjs';
import { tmInverse } from './bng.mjs';

export const STEPS = Object.freeze([7, 10]);            // magnification steps (×)
export const BASE_FOV = 70 * Math.PI / 180;             // the world's own vertical field of view (substrate.mjs)
export const EARTH_R = 6371000, REFRACTION_K = 0.13;
export const SKY_AOD_M = 1400;                          // above any ground in Great Britain (Ben Nevis 1,345 m)
export const MAX_RANGE_M = 40000;
export const GAP_M = 60;                                // a LiDAR void (water, a missing tile) shorter than this is crossed

// The narrow field of view for magnification m: the same scene m times larger in the middle of the screen.
export const fovFor = (m, base = BASE_FOV) => 2 * Math.atan(Math.tan(base / 2) / Math.max(1, m));
// The next step up or down (wheel, pinch, typed zoom).
export function stepZoom(m, dir) {
  const i = STEPS.indexOf(m);
  if (i < 0) return STEPS[0];
  return STEPS[Math.max(0, Math.min(STEPS.length - 1, i + Math.sign(dir)))];
}
export const curvatureDrop = (d, k = REFRACTION_K, R = EARTH_R) => (d * d * (1 - k)) / (2 * R);

// Grid convergence at national grid (e, n), radians: true bearing = grid bearing + γ. Transverse Mercator,
// γ = atan(tan Δλ · sin φ) on the Airy latitude (to about 0.001° over Great Britain); central meridian 2° W.
export function convergence(e, n) {
  const { lat, lon } = tmInverse(e, n), dl = lon + 2 * Math.PI / 180;
  return Math.atan(Math.tan(dl) * Math.sin(lat));
}
export const bearingDeg = yaw => ((yaw * 180 / Math.PI) % 360 + 360) % 360;

// March a ray from eye along dir against measured ground. Returns
//   { kind: 'ground', d, point, horizontal } | { kind: 'beyond', d (last measured), reached } | { kind: 'sky', d }
export function rangeAlong(eye, dir, measuredAt, { maxM = MAX_RANGE_M, k = REFRACTION_K } = {}) {
  const hz = Math.hypot(dir[0], dir[1]);
  const at = d => [eye[0] + dir[0] * d, eye[1] + dir[1] * d, eye[2] + dir[2] * d];
  // How far the ray is above the ground at d (positive = above), NaN where the ground is not measured.
  const above = d => { const p = at(d), g = measuredAt(p[0], p[1]); return Number.isFinite(g) ? p[2] - (g - curvatureDrop(d * hz, k)) : NaN; };
  let d = 0.3, prev = null, lastMeasured = null, gapFrom = null;
  while (d <= maxM) {
    const a = above(d);
    if (Number.isFinite(a)) {
      gapFrom = null;
      if (a <= 0) {
        let lo = prev ?? 0, hi = d;                                           // bisect to 1 cm or better
        for (let i = 0; i < 24 && hi - lo > 0.01; i++) { const m = (lo + hi) / 2, am = above(m); if (Number.isFinite(am) && am <= 0) hi = m; else lo = m; }
        return { kind: 'ground', d: hi, point: at(hi), horizontal: hi * hz };
      }
      prev = d; lastMeasured = d;
    } else {
      if (gapFrom === null) gapFrom = d;
      if (d - gapFrom > GAP_M) return { kind: 'beyond', d: lastMeasured, reached: gapFrom };
    }
    if (dir[2] > 0 && at(d)[2] > SKY_AOD_M) return { kind: 'sky', d };
    d += Math.min(25, 0.25 + d * 0.004);
  }
  return { kind: 'beyond', d: lastMeasured, reached: maxM };
}

// What kind of thing a drawn batch is, by its key; null for ground drapes that describe the ground itself.
export function kindOfKey(key) {
  if (/^grid\/substation\/|^national\/[^/]+\/sub\//.test(key)) return 'substation';
  if (/^grid\/line\/|^national\/[^/]+\/power\//.test(key)) return 'line';
  if (/^(plant|block):T/.test(key) || /^module-/.test(key)) return 'table';
  if (/^water\/line\//.test(key)) return 'water';
  if (/^national\/[^/]+\/rail$/.test(key) || /\/rail$/.test(key)) return 'railway';
  if (/^ways\/|^national\/[^/]+\/roads\//.test(key)) return 'road';
  if (/^canopy\/(tree|hedge)/.test(key)) return 'hedge or tree';
  return null;
}
const STANDING = new Set(['substation', 'line', 'table', 'hedge or tree']);
const DRAPED = { water: 3, road: 4, railway: 3 };   // metres either side of the drawn line that still count as on it

// Closest approach of the ray (eye, unit dir) to segment a-b: { t along the ray, miss metres }.
function rayToSegment(eye, dir, a, b) {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [eye[0] - a[0], eye[1] - a[1], eye[2] - a[2]];
  const A = 1, B = dir[0] * u[0] + dir[1] * u[1] + dir[2] * u[2], C = u[0] * u[0] + u[1] * u[1] + u[2] * u[2];
  const D = dir[0] * w[0] + dir[1] * w[1] + dir[2] * w[2], E = u[0] * w[0] + u[1] * w[1] + u[2] * w[2];
  const den = A * C - B * B;
  let s = den > 1e-12 ? (A * E - B * D) / den : 0; s = Math.max(0, Math.min(1, s));
  const t = Math.max(0, B * s - D);
  const p = [eye[0] + dir[0] * t, eye[1] + dir[1] * t, eye[2] + dir[2] * t], q = [a[0] + u[0] * s, a[1] + u[1] * s, a[2] + u[2] * s];
  return { t, miss: Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]), q };
}

// The nearest drawn thing standing in the reticle before maxD: { kind, key, t, point, color } or null.
// tol: radians either side of the centre that still count (a couple of screen pixels at the current zoom).
export function thingOnRay(batches, eye, dir, maxD, tol, { budget = 400000 } = {}) {
  let best = null, seen = 0;
  for (const b of batches) {
    const kind = b && !b.occluder && b.positions && kindOfKey(String(b.key || ''));
    if (!kind || !STANDING.has(kind)) continue;
    const o = b.origin || [0, 0, 0], P = b.positions;
    for (let i = 0; i + 5 < P.length && seen < budget; i += 6, seen++) {
      const a = [P[i] + o[0], P[i + 1] + o[1], P[i + 2] + o[2]], c = [P[i + 3] + o[0], P[i + 4] + o[1], P[i + 5] + o[2]];
      const r = rayToSegment(eye, dir, a, c);
      if (r.t < 1 || r.t > maxD || r.miss > Math.max(0.3, r.t * tol)) continue;
      if (!best || r.t < best.t) best = { kind, key: b.key, t: r.t, point: r.q, color: b.color, vertical: Math.abs(c[2] - a[2]) };
    }
  }
  return best;
}

// Which draped thing (water, road, railway) lies under a ground point, by plan distance to the drawn lines.
export function drapeAt(batches, p) {
  let best = null;
  for (const b of batches) {
    const kind = b && !b.occluder && b.positions && kindOfKey(String(b.key || ''));
    if (!kind || !(kind in DRAPED)) continue;
    const o = b.origin || [0, 0, 0], P = b.positions, x = p[0] - o[0], y = p[1] - o[1], r = DRAPED[kind];
    for (let i = 0; i + 5 < P.length; i += 6) {
      const ax = P[i], ay = P[i + 1], bx = P[i + 3], by = P[i + 4];
      if (Math.max(ax, bx) < x - r || Math.min(ax, bx) > x + r || Math.max(ay, by) < y - r || Math.min(ay, by) > y + r) continue;
      const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy, s = L > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L)) : 0;
      const m = Math.hypot(ax + dx * s - x, ay + dy * s - y);
      if (m <= r && (!best || m < best.m)) best = { kind, key: b.key, m };
    }
  }
  return best;
}

// A public-infrastructure label only (never a project, owner or person): voltage class for lines and substations,
// road class for roads.
export function labelFor(thing, { lineClass = () => null } = {}) {
  if (!thing) return 'ground';
  const cls = (/\/(400kV|275kV|132kV|33kV)$/.exec(thing.key) || [])[1] || lineClass(thing.key);
  const kv = cls ? ` (${cls.replace('kV', ' kV')})` : '';
  if (thing.kind === 'line') return (thing.pylon ? 'pylon' : 'overhead line') + kv;
  if (thing.kind === 'substation') return 'substation' + kv;
  if (thing.kind === 'table') return 'solar table (design)';
  if (thing.kind === 'road') { const c = (/roads\/([^/]+)$/.exec(thing.key) || [])[1]; return c && /^(A|B|motorway)$/.test(c) ? `${c === 'motorway' ? 'motorway' : c + ' road'}` : 'road'; }
  if (thing.kind === 'water') return 'water (watercourse)';
  return thing.kind;
}

// One full rangefinder reading for a pose: distance, bearings, angle, height and what it is. Pure but for the inputs.
// w: { pos, yaw, pitch, origin: { e, n }, measuredAt, batches, tol, towers: [[x, y]] local, lineClass(key), gpuDistance? }
export function reading(w) {
  const dir = direction(w.yaw, w.pitch), eye = w.pos;
  const r = rangeAlong(eye, dir, w.measuredAt);
  const reach = r.kind === 'ground' ? r.d : r.kind === 'beyond' ? (r.reached ?? MAX_RANGE_M) : MAX_RANGE_M;
  let thing = thingOnRay(w.batches || [], eye, dir, reach + 1, w.tol ?? 0.002);
  if (thing?.kind === 'line') thing.pylon = (w.towers || []).some(([x, y]) => Math.hypot(thing.point[0] - x, thing.point[1] - y) < 8) || thing.vertical > 3;
  const gpu = Number.isFinite(w.gpuDistance) && w.gpuDistance < 1e29 ? w.gpuDistance : null;
  let d = null, point = null, source = null;
  if (thing) { d = thing.t; point = thing.point; source = 'drawn line'; }
  else if (r.kind === 'ground') {
    d = r.d; point = r.point; source = 'terrain tiles';
    if (gpu !== null && Math.abs(gpu - r.d) < Math.max(5, r.d * 0.02)) { d = gpu; source = 'GPU ray cast (WebGL2), tiles agree'; }
    else if (gpu !== null) source = `terrain tiles (GPU ray cast says ${Math.round(gpu)} m)`;
    const drape = drapeAt(w.batches || [], point);
    if (drape) thing = drape;
  }
  const o = w.origin || { e: 0, n: 0 }, gridB = bearingDeg(w.yaw);
  let gamma = 0;
  try { gamma = convergence(o.e + eye[0], o.n + eye[1]) * 180 / Math.PI; } catch { gamma = 0; }
  const out = { status: d === null ? r.kind : 'hit', gridBearing: gridB, trueBearing: ((gridB + gamma) % 360 + 360) % 360, convergence: gamma,
    angle: w.pitch * 180 / Math.PI, what: d === null ? null : labelFor(thing, w), distance: d, horizontal: d === null ? null : d * Math.hypot(dir[0], dir[1]),
    aod: point ? point[2] : null, point, source, lastMeasured: r.kind === 'beyond' ? r.d : null };
  return out;
}

const deg = (v, dp = 1) => `${v.toFixed(dp)}°`;
export const distanceText = d => (d >= 10000 ? `${(d / 1000).toFixed(2)} km` : d >= 1000 ? `${(d / 1000).toFixed(3)} km` : `${d.toFixed(d < 100 ? 1 : 0)} m`);
// The reading in the words the reticle box shows, one line each.
export function readingLines(r) {
  const ang = r.angle >= 0 ? `elevation +${deg(r.angle, 2)}` : `depression ${deg(-r.angle, 2)}`;
  const bear = `bearing ${deg(r.trueBearing)} true · ${deg(r.gridBearing)} grid`;
  if (r.status === 'sky') return ['sky: no ground on this line', bear, ang];
  if (r.status !== 'hit') return [`beyond measured ground${r.lastMeasured ? ` (measured to ${distanceText(r.lastMeasured)})` : ''}`, bear, ang];
  return [`${r.what} · ${distanceText(r.distance)}`, bear, `${ang} · ${r.aod.toFixed(1)} m AOD`, `from ${r.source}`];
}
