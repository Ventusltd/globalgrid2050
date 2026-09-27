// buggy-physics.mjs: the site buggy, a generic utility vehicle, as a small rigid body on the measured ground.
// Pure: no DOM, no WebGL. The same state, inputs, ground and solids give the same result, bit for bit.
//
// The engine (kept simple, robust and cheap, the way small vehicle games do it):
//  * four wheel contacts sample the ground at the wheel positions; the plane through them gives the gradient
//    along the heading (sA, rise over run) and across it (sS, left side higher is positive);
//  * planar motion: speed v along the ground, a kinematic bicycle for the heading (turning circle turnCircleM,
//    the yaw rate capped by grip so a fast turn understeers), gravity along the slope (slows it uphill, rolls it
//    downhill), drive force limited by power and by grip (mu x normal load), so a slope steeper than the grip
//    or the engine can take stalls it and it rolls back; brakes and an automatic park brake, also grip-limited;
//  * sideways: a side slope steeper than the grip makes it slide downhill (u, to the right), else it holds;
//  * suspension: a spring-damper per wheel on the body's height, pitch and roll (small angles), for the view;
//  * fixed steps at hz (120) whatever the frame rate; a hold latch parks it exactly (no creep), and a parked,
//    settled buggy asks for no frames at all.
// Numbers are ASSUMED typical values for a two-seat utility vehicle on site, illustrative, not a make or model.
// The GPU pair check (tools/gpu/buggy_pair.py) runs this same model with two integrators on real ground.

import { blocked } from './views.mjs';

export const G = 9.81;
export const BUGGY = Object.freeze({
  mass: 700, wheelbase: 2.0, track: 1.3, length: 2.9, width: 1.5, // kg (with driver), metres
  turnCircleM: 7.0, maxKmh: 25, reverseKmh: 8,                      // kerb-to-kerb diameter; governed speeds
  driveG: 0.4, powerW: 12000, brakeG: 0.8, engineBrake: 0.6,        // drive force cap (x m g), power, brakes (x g), m/s2
  k: 15500, damp: 1320, rideM: 0.45, Iyy: 400, Ixx: 150,            // per-wheel spring N/m and damper N s/m; inertias kg m2
  steerRate: 5, slideDamp: 3, hz: 960,                              // 1/s steering lag, 1/s sliding friction, physics steps/s
  cgM: 0.75, dragK: 0.05, slideCapKmh: 30,                          // centre of mass height (m); ploughing drag (1/m); slide cap
  riskMargin: 0.6                                                   // "Rollover risk" at this fraction of the tip limit
});
// Grip (friction coefficient mu) and rolling resistance per surface: ASSUMED typical values, editable ("buggy grip 0.4").
export const GROUNDS = Object.freeze({
  grass: { mu: 0.45, crr: 0.06, label: 'dry grass' },
  wet: { mu: 0.3, crr: 0.07, label: 'wet grass' },
  gravel: { mu: 0.6, crr: 0.03, label: 'gravel track' }
});
// A typical side-slope limit printed in utility-vehicle handbooks: 15 degrees (about 27 %). Illustrative only.
export const SIDE_WARN_DEG = 15;
// Tip-over (static stability, ASSUMED centre of mass): it rolls when the sideways pull (gravity across the slope plus
// the turn) over the normal pull passes track / (2 cgM), and pitches over when the slope passes (wheelbase / 2) / cgM.
// Past the limit it stops tipped (no flying); getting on again rights it. Illustrative, not a rollover simulation.

// State vector: positions X Y PSI Z TH PH, velocities V U D VZ WTH WPH (D is the steering angle, lagged).
export const X = 0, Y = 1, PSI = 2, V = 3, U = 4, D = 5, Z = 6, VZ = 7, TH = 8, WTH = 9, PH = 10, WPH = 11, N = 12;
const VEL = [V, U, D, VZ, WTH, WPH], POS = [X, Y, PSI, Z, TH, PH];
// Wheels: front-left, front-right, rear-left, rear-right; a forward of the centre, b to the right.
const wheels = P => { const a = P.wheelbase / 2, b = P.track / 2; return [[a, -b], [a, b], [-a, -b], [-a, b]]; };
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export function params(over = {}) {
  const P = { ...BUGGY, ...GROUNDS.grass, ...over };
  P.vmax = P.maxKmh / 3.6; P.vrev = P.reverseKmh / 3.6;
  // turning circle: the outer front wheel's path, kerb to kerb; the body's centre (the reference point, moving along
  // the heading) turns on radius Rc = wheelbase / tan(steer)
  const Rc = Math.sqrt((P.turnCircleM / 2) ** 2 - (P.wheelbase / 2) ** 2) - P.track / 2;
  P.deltaMax = Math.atan(P.wheelbase / Rc);
  P.rest = P.rideM + (P.mass * G) / (4 * P.k);                            // unloaded spring: loaded, the body sits at rideM
  P.dt = 1 / P.hz; P.vcap = P.slideCapKmh / 3.6;
  P.tipSide = P.track / (2 * P.cgM); P.tipAlong = P.wheelbase / 2 / P.cgM;
  return P;
}

// A new buggy at (x, y) facing yaw (0 north, +pi/2 east), settled on the ground.
export function createBuggy(x, y, yaw, heightAt, over = {}) {
  const P = params(over), s = new Float64Array(N);
  s[X] = x; s[Y] = y; s[PSI] = yaw;
  const c = contacts(s, P, heightAt);
  s[Z] = c.mean + P.rideM;
  s[TH] = Math.atan(c.sA); s[PH] = Math.atan(c.sS); // lean with the ground: nose up on a rise, left side up on a side slope
  const bug = { P, s, held: true, uHeld: true, acc: 0, steps: 0, stalled: false, gripLimited: false, hit: false, last: null,
    tipped: false, risk: 0, capped: false };
  deriv(s, { t: 0, steer: 0, b: 0 }, bug, heightAt);
  return bug;
}

// Ground under the four wheels, and the plane through them.
export function contacts(s, P, heightAt) {
  const sp = Math.sin(s[PSI]), cp = Math.cos(s[PSI]), h = [0, 0, 0, 0];
  const W = wheels(P);
  for (let i = 0; i < 4; i++) {
    const [a, b] = W[i];
    h[i] = heightAt(s[X] + a * sp + b * cp, s[Y] + a * cp - b * sp);
  }
  const sA = ((h[0] + h[1]) - (h[2] + h[3])) / (2 * P.wheelbase), sS = ((h[0] + h[2]) - (h[1] + h[3])) / (2 * P.track);
  return { h, sA, sS, mean: (h[0] + h[1] + h[2] + h[3]) / 4 };
}

// Driver input to the model's controls: forward in [-1, 1], steer in [-1, 1], brake 0 or 1. Pulling back while
// rolling forward (or pushing while rolling back) brakes first; from rest it reverses.
export function controls(v, forward, steer, brake) {
  let t = clamp(forward, -1, 1), b = brake ? 1 : 0;
  if ((t < 0 && v > 0.3) || (t > 0 && v < -0.3)) { b = Math.max(b, Math.abs(t)); t = 0; }
  if (b) t = 0;
  return { t, steer: clamp(steer, -1, 1), b };
}

// The continuous model: d(state)/dt, with the controls held for the step. held / uHeld pin v / u at zero.
export function deriv(s, c, bug, heightAt, out = new Float64Array(N)) {
  const P = bug.P, k = contacts(s, P, heightAt);
  const cosA = 1 / Math.sqrt(1 + k.sA * k.sA), sinA = k.sA * cosA, cosB = 1 / Math.sqrt(1 + k.sS * k.sS), sinB = k.sS * cosB;
  const gN = G * cosA * cosB, muN = P.mu * gN, v = s[V];
  // along the ground: drive (power and governor limited), resistance, grip cap, gravity
  let F = 0;
  if (c.t > 0) F = c.t * Math.min(P.driveG * G, P.powerW / (P.mass * Math.max(Math.abs(v), 1))) * clamp((P.vmax - v) / 0.25, 0, 1);
  else if (c.t < 0) F = c.t * P.driveG * G * clamp((P.vrev + v) / 0.25, 0, 1);
  const R = c.b * P.brakeG * G + (c.t === 0 ? P.engineBrake : 0) + P.crr * gN;
  const gov = Math.max(0, Math.abs(v) - P.vmax) * 6 * Math.sign(v); // held at the governed speed downhill too
  const Fx = clamp(F - R * clamp(v / 0.1, -1, 1) - gov, -muN, muN);
  // Past the governed speed the grip has gone (the governor holds it otherwise): the tyres plough (ground drag, dragK
  // times the excess squared, assumed) and past the slide cap a stiff pull holds it there, so a slide stays physical.
  const drag = (w, from) => { const e = Math.max(0, Math.abs(w) - from); return (P.dragK * e * e + Math.max(0, Math.abs(w) - P.vcap) * 60) * Math.sign(w); };
  out[V] = bug.held ? 0 : Fx - G * sinA - drag(v, P.vmax);
  // across: a side slope past the grip slides it downhill; sliding friction settles it
  const ex = Math.max(0, Math.abs(sinB) - P.mu * cosB) * G * Math.sign(k.sS);
  out[U] = bug.uHeld ? 0 : ex - P.slideDamp * s[U] - drag(s[U], 0);
  out[D] = P.steerRate * (c.steer * P.deltaMax - s[D]);
  // heading: kinematic bicycle, capped where the turn would need more grip than the ground has
  const vh = v * cosA, cap = muN / Math.max(Math.abs(vh), 0.5);
  const r = clamp(vh * Math.tan(s[D]) / P.wheelbase, -cap, cap);
  const sp = Math.sin(s[PSI]), cp = Math.cos(s[PSI]);
  out[X] = vh * sp + s[U] * cp; out[Y] = vh * cp - s[U] * sp; out[PSI] = r;
  // suspension: four spring-dampers push the body up; small angles
  const W = wheels(P);
  let Fz = 0, Mt = 0, Mp = 0;
  for (let i = 0; i < 4; i++) {
    const [a, b] = W[i];
    const comp = k.h[i] + P.rest - (s[Z] + a * s[TH] - b * s[PH]);
    const rate = s[VZ] + a * s[WTH] - b * s[WPH];
    const f = Math.max(0, P.k * comp - P.damp * rate);
    Fz += f; Mt += a * f; Mp -= b * f;
  }
  out[Z] = s[VZ]; out[VZ] = Fz / P.mass - G;
  out[TH] = s[WTH]; out[WTH] = Mt / P.Iyy;
  out[PH] = s[WPH]; out[WPH] = Mp / P.Ixx;
  bug.last = { k, cosA, sinA, sinB, gN, muN, Fx, F, R, ex, r, vh };
  return out;
}

// Between steps: the hold latches (park brake and side grip), so a parked buggy stays exactly put. bug.last is the
// model at the current place. Before a step a latch lets go (throttle, or a pull past the hold); after it, one engages.
export function release(bug, c) {
  const { sinA, muN, ex } = bug.last, P = bug.P;
  if (bug.held && (c.t !== 0 || G * Math.abs(sinA) >= Math.min(P.brakeG * G, muN))) bug.held = false;
  if (bug.uHeld && ex !== 0) bug.uHeld = false;
}
export function engage(bug, c) {
  const { sinA, muN, ex, Fx } = bug.last, s = bug.s, P = bug.P;
  if (!bug.held && c.t === 0 && Math.abs(s[V]) < 0.05 && G * Math.abs(sinA) < Math.min(P.brakeG * G, muN)) { bug.held = true; s[V] = 0; }
  if (!bug.uHeld && ex === 0 && Math.abs(s[U]) < 0.02) { bug.uHeld = true; s[U] = 0; }
  bug.gripLimited = !bug.held && muN > 0 && Math.abs(Fx) >= muN - 1e-9;
  bug.capped = Math.hypot(s[V], s[U]) > P.vcap - 0.1;
  tipCheck(bug);
}
// Tip-over from the centre of mass and the track: margin 1 is the limit; past it the buggy stops, tipped.
export function tipCheck(bug) {
  const { sinA, sinB, gN, r, vh } = bug.last, s = bug.s, P = bug.P;
  const side = (G * sinB - vh * r) / gN, along = G * sinA / gN; // + right; a right turn throws the load left
  const mSide = Math.abs(side) / P.tipSide, mAlong = Math.abs(along) / P.tipAlong;
  bug.risk = Math.max(mSide, mAlong);
  if (bug.risk < 1) return false;
  bug.tipped = true; bug.held = bug.uHeld = true;
  s[V] = s[U] = s[VZ] = s[WTH] = s[WPH] = s[D] = 0;
  if (mSide >= mAlong) s[PH] = 1.2 * Math.sign(side || 1); else s[TH] = 1.2 * Math.sign(along || 1); // on its side, or its nose / tail
  return true;
}

const k1 = new Float64Array(N), k2 = new Float64Array(N);
// One fixed step, semi-implicit (symplectic) Euler: velocities first, then positions with the new velocities.
export function stepEuler(bug, c, heightAt) {
  const s = bug.s, dt = bug.P.dt;
  bug.steps++;
  if (bug.tipped) return; // lies where it tipped until someone rights it
  release(bug, c);
  deriv(s, c, bug, heightAt, k1);
  for (const i of VEL) s[i] += dt * k1[i];
  deriv(s, c, bug, heightAt, k2);
  for (const i of POS) s[i] += dt * k2[i];
  s[PSI] = Math.atan2(Math.sin(s[PSI]), Math.cos(s[PSI]));
  deriv(s, c, bug, heightAt, k1); // bug.last at the new place: for the latches and the readout
  engage(bug, c);
}

// Collisions: the buggy's outline (corners and mid-sides) against solid boxes (tables, compounds, fences).
export function hits(s, P, heightAt, solids) {
  if (!solids?.length) return false;
  const sp = Math.sin(s[PSI]), cp = Math.cos(s[PSI]), a = P.length / 2, b = P.width / 2;
  const body = { radius: 0.15, below: -0.15, above: 1.9 }; // from 0.15 m above the ground to 2.05 m (roll cage)
  for (const [f, r] of [[a, -b], [a, 0], [a, b], [0, -b], [0, b], [-a, -b], [-a, 0], [-a, b]]) {
    const x = s[X] + f * sp + r * cp, y = s[Y] + f * cp - r * sp;
    if (blocked([x, y, heightAt(x, y)], body, solids)) return true;
  }
  return false;
}

// Advances the buggy by a frame of dtS seconds in fixed steps (at most 0.1 s a frame). A step that would put it
// into a solid is undone and the buggy stops against it. Returns the number of steps taken.
export function advance(bug, input, dtS, heightAt, solids = []) {
  bug.acc += Math.min(Math.max(dtS, 0), 0.1) * bug.P.hz; // counted in steps, so 30 and 120 fps frames give the same steps
  const steps = Math.floor(bug.acc + 1e-9);
  bug.acc = Math.max(0, bug.acc - steps);
  const prev = new Float64Array(N);
  let n = 0;
  for (; n < steps; n++) {
    const c = controls(bug.s[V], input.forward || 0, input.steer || 0, input.brake);
    prev.set(bug.s);
    stepEuler(bug, c, heightAt);
    bug.stalled = (input.forward || 0) > 0 && bug.s[V] < -0.05; // pressing on, rolling back
    bug.hit = hits(bug.s, bug.P, heightAt, solids);
    if (bug.hit) {
      bug.s[X] = prev[X]; bug.s[Y] = prev[Y]; bug.s[PSI] = prev[PSI];
      bug.s[V] = 0; bug.s[U] = 0; bug.held = c.t === 0; bug.uHeld = true;
      deriv(bug.s, c, bug, heightAt);
    }
  }
  return n;
}

// Parked: held on both axes, steering still and the suspension settled. Then no frame is needed.
export function parked(bug, input = {}) {
  const s = bug.s, q = 2e-3;
  if (bug.tipped) return true;
  return bug.held && bug.uHeld && !input.forward && !input.steer &&
    Math.abs(s[VZ]) < q && Math.abs(s[WTH]) < q && Math.abs(s[WPH]) < q && Math.abs(s[D]) < q;
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
// What the driver reads: speed, heading, the gradient under the wheels, and the warnings.
export function readout(bug) {
  const s = bug.s, k = bug.last?.k || { sA: 0, sS: 0 };
  const deg = ((s[PSI] * 180 / Math.PI) % 360 + 360) % 360;
  const along = 100 * k.sA * Math.sign(s[V] || 1), side = 100 * Math.abs(k.sS);
  const sideDeg = Math.atan(Math.abs(k.sS)) * 180 / Math.PI;
  const warn = [];
  if (sideDeg > SIDE_WARN_DEG) warn.push(`Side slope ${Math.round(side)} % (${sideDeg.toFixed(0)}°) is past a typical ${SIDE_WARN_DEG}° utility-vehicle limit (illustrative)`);
  if (bug.stalled) warn.push('Stalled: too steep for the grip or the engine, rolling back');
  else if (!bug.uHeld) warn.push('Sliding sideways: the side slope is steeper than the grip');
  else if (bug.gripLimited && !bug.held) warn.push('Wheels at the grip limit');
  if (bug.capped) warn.push(`Sliding at the ${bug.P.slideCapKmh} km/h slide cap (illustrative)`);
  if (bug.hit) warn.push('Stopped against a solid');
  const danger = bug.tipped ? ['Rolled over: the buggy is on its side. Get off (E) and on again to right it']
    : bug.risk >= bug.P.riskMargin ? [`Rollover risk: ${Math.round(100 * bug.risk)} % of the tip limit (illustrative)`] : [];
  return {
    danger, risk: bug.risk, tipped: bug.tipped, kmh: Math.hypot(s[V], s[U]) * 3.6, heading: deg, compass: COMPASS[Math.round(deg / 45) % 8],
    gradient: 100 * Math.hypot(k.sA, k.sS), along, side, sideDeg, warn
  };
}
