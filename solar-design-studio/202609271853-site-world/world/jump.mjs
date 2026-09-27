// Jump in Walk (Space): real gravity, a short hold for a little more height, landing on measured ground and on solids.
// Pure and deterministic: time is the sum of the frame steps it is given, never a wall clock, so tests replay exactly.
// Local east (x), north (y), up (z) metres, like views.mjs; a walker's eye is VIEWS.standing.eye above its feet.
//
// Numbers (SI):
//   G 9.81 m/s² (standard gravity). V0 3.0 m/s take-off: apex V0²/2G = 0.459 m, air time 2·V0/G = 0.612 s (a tap).
//   Held past GRACE_S (0.1 s), the legs keep pushing at PUSH m/s² until the predicted apex reaches MAX_APEX_M (0.60 m):
//   a full hold of about 0.22 s. COYOTE_S 0.1 s: a jump still starts just after walking off an edge. BUFFER_S 0.1 s:
//   a press just before landing jumps again on touchdown. Landing dips the eye by about 1.2 cm per m/s of impact
//   (cap 6 cm) and brings it back critically damped (OMEGA 45 rad/s: deepest at 22 ms, within 7 % by 120 ms).
// Solids are the substrate's boxes [{ min, max }]; standing on one means the feet on its top (table tops, compounds).

import { VIEWS, step as walkStep, blocked, speedOf } from './views.mjs';

export const G = 9.81, V0 = 3.0, GRACE_S = 0.1, PUSH = 6.0, MAX_HOLD_S = 0.35, MAX_APEX_M = 0.6;
export const COYOTE_S = 0.1, BUFFER_S = 0.1;
export const OMEGA = 45, DIP_PER_MS = 1.43, DIP_MAX_M = 0.06, SETTLE_S = 0.15;
export const STEP_UP_M = 0.05;   // a top this far above the feet still counts as underfoot (no stepping up onto a table)
export const TOP_GAP_M = 1e-4;   // stand this far above a solid's top, so the body never counts as inside it
const TELEPORT_M = 5;            // a pose moved further than this between frames (Find, a tour) starts on the ground

// Apex height and air time (back to the take-off level) of a jump at take-off speed v under gravity g, no push.
export const apexOf = (v = V0, g = G) => (v * v) / (2 * g);
export const airTimeOf = (v = V0, g = G) => (2 * v) / g;
// The eye's landing dip d(t) (m, negative = down) at t s after touchdown with impact speed vi (m/s).
export function dipAt(t, vi) {
  if (!(t >= 0)) return 0;
  const v0 = Math.min(DIP_PER_MS * Math.abs(vi), DIP_MAX_M * OMEGA * Math.E);
  return -v0 * t * Math.exp(-OMEGA * t);
}

// The height the feet rest on at (x, y): the ground, or the highest solid top under the body's footprint that is not
// above the feet by more than STEP_UP_M. feetZ: where the feet are now (Infinity: any top counts).
export function supportAt(x, y, feetZ, heightAt, solids = [], radius = VIEWS.standing.body.radius) {
  let s = heightAt(x, y), onSolid = false;
  for (const b of solids) {
    if (x <= b.min[0] - radius || x >= b.max[0] + radius || y <= b.min[1] - radius || y >= b.max[1] + radius) continue;
    const top = b.max[2] + TOP_GAP_M;
    if (top > s && top <= feetZ + STEP_UP_M) { s = top; onSolid = true; }
  }
  return { z: s, onSolid };
}

export function createJump() {
  const W = VIEWS.standing, eye = W.eye;
  let t = 0;                 // simulation time, s: the sum of the frame steps (frozen while nothing moves)
  let air = null;            // { vx, vy, vz, t0, feet0, coyote } while off the ground
  let pressT = -Infinity, holding = false, dip = null, last = null, jumps = 0;
  const landings = [];

  const reset = () => { air = null; dip = null; pressT = -Infinity; };
  const dipNow = () => (dip ? dipAt(t - dip.t0, dip.vi) : 0);
  const carried = (yaw, i) => { const sp = speedOf(W, i.slow), f = Math.max(-1, Math.min(1, i.forward || 0)); return [Math.sin(yaw) * f * sp, Math.cos(yaw) * f * sp]; };
  // Leaves the ground at the start of this frame (time t), with the walking speed and heading of the moment.
  const takeOff = (state, i) => {
    const feet = state.pos[2] - eye - (air ? 0 : dipNow()), [vx, vy] = air ? [air.vx, air.vy] : carried(state.yaw, i); // off an edge: keep going
    air = { vx, vy, vz: V0, t0: t, feet0: feet, coyote: false, top: 0 };
    pressT = -Infinity; dip = null; jumps++;
  };
  // One frame in the air, from t to t + dt: gravity (and the push while held), carried momentum, solids, touchdown.
  function fly(state, dt, heightAt, solids) {
    const a = air, since = t - a.t0, feet = state.pos[2] - eye;
    let acc = -G;
    if (holding && !a.coyote && a.vz > 0 && since >= GRACE_S && since < MAX_HOLD_S && feet - a.feet0 + a.vz * a.vz / (2 * G) < MAX_APEX_M) acc += PUSH;
    let vz = a.vz + acc * dt, z = state.pos[2] + a.vz * dt + 0.5 * acc * dt * dt;
    if (acc > -G && vz > 0) {                                                 // pushing: never past MAX_APEX_M
      const over = z - eye - a.feet0 + vz * vz / (2 * G) - MAX_APEX_M;
      if (over > 0) vz = Math.sqrt(Math.max(0, vz * vz - 2 * G * over));
    }
    let [x, y] = state.pos;
    const nx = x + a.vx * dt, ny = y + a.vy * dt;
    if (!blocked([nx, ny, z], W.body, solids)) { x = nx; y = ny; }
    else if (!blocked([nx, y, z], W.body, solids)) { x = nx; a.vy = 0; }
    else if (!blocked([x, ny, z], W.body, solids)) { y = ny; a.vx = 0; }
    else { a.vx = 0; a.vy = 0; }
    if (vz > 0 && blocked([x, y, z], W.body, solids)) { z = state.pos[2]; vz = 0; } // head against something above
    a.top = Math.max(a.top, z - eye - a.feet0);
    const s = supportAt(x, y, Math.max(feet, z - eye), heightAt, solids);
    if (vz <= 0 && z - eye <= s.z) {                                         // touchdown on the ground or a solid top
      air = null; z = s.z + eye; dip = { t0: t + dt, vi: -vz };
      landings.push({ t: t + dt, airTime: t + dt - a.t0, apex: a.top, vi: -vz, onSolid: s.onSolid, feet: s.z });
      if (landings.length > 8) landings.shift();
    } else a.vz = vz;
    return { ...state, pos: [x, y, z] };
  }

  return {
    // Space went down: a jump at the next frame if on the ground (or just off an edge), else remembered for BUFFER_S.
    press() { holding = true; pressT = t; },
    release() { holding = false; },
    // One frame: in Walk the jump owns the height; in Drone it hands over to views.step untouched.
    step(state, input, dt, heightAt, solids = []) {
      if (state.view !== 'standing') { reset(); return walkStep(state, input, dt, heightAt, solids); }
      if (last && Math.hypot(state.pos[0] - last[0], state.pos[1] - last[1]) > TELEPORT_M) reset();
      const i = input || {}, t1 = t + dt;
      if (t1 - pressT <= BUFFER_S && (!air || (air.coyote && pressT - air.t0 <= COYOTE_S))) takeOff(state, i);
      if (air) {
        state = fly(state, dt, heightAt, solids); t = t1;
        if (!air && t - pressT <= BUFFER_S) takeOff(state, i);                // pressed just before touchdown
        last = state.pos; return state;
      }
      t = t1;
      // On the ground: the usual walk, standing on whatever is underfoot.
      const feet = state.pos[2] - eye - dipNow();
      const under = (x, y) => supportAt(x, y, feet, heightAt, solids).z;
      const next = walkStep({ ...state, pos: [state.pos[0], state.pos[1], feet + eye] }, i, dt, under, solids);
      const s = supportAt(next.pos[0], next.pos[1], feet, heightAt, solids);
      const moved = Math.hypot(next.pos[0] - state.pos[0], next.pos[1] - state.pos[1]);
      if (feet - s.z > 0.3 + moved) {                                        // walked off an edge: fall, with coyote time
        const [vx, vy] = carried(state.yaw, i);
        air = { vx, vy, vz: 0, t0: t, feet0: feet, coyote: true, top: 0 };
        state = { ...next, pos: [next.pos[0], next.pos[1], feet + eye] };
      } else state = { ...next, pos: [next.pos[0], next.pos[1], s.z + eye + dipNow()] };
      last = state.pos;
      return state;
    },
    // Every frame, moving or not: the walker's eye on what is underfoot (ground can stream in late), plus the dip.
    hold(state, heightAt, solids = []) {
      if (state.view !== 'standing') { reset(); return state; }
      if (air) return state;
      if (dip && t - dip.t0 > SETTLE_S) dip = null;
      const feet = state.pos[2] - eye - dipNow(), s = supportAt(state.pos[0], state.pos[1], feet, heightAt, solids);
      const z = s.z + eye + dipNow();
      return Math.abs(z - state.pos[2]) > 1e-6 ? { ...state, pos: [state.pos[0], state.pos[1], z] } : state;
    },
    // Frames are needed in the air, while a press waits to be used, and while the eye settles after a landing.
    busy: () => !!air || t - pressT <= BUFFER_S || (!!dip && t - dip.t0 <= SETTLE_S),
    airborne: () => !!air,
    reset,
    debug: () => ({ t, airborne: !!air, vz: air ? air.vz : 0, holding, jumps, dip: dipNow(), landings: landings.slice() })
  };
}
