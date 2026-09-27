// Headset view pose maths. Pure: no DOM, no WebXR objects, only plain numbers and arrays.
// WebXR reference space: x right, y up, z towards the viewer (right-handed), metres.
// World: x east, y north, z up, metres (as camera.mjs). The rig is where the reference space's origin
// sits in the world, in float64, plus a yaw (as views.mjs: 0 looks north, +π/2 looks east).
// The headset reports the head and each eye relative to the rig; the thumbstick and snap turn move the rig.
// Drawing stays camera-relative per eye: each eye gets a rotation-only matrix and its own world position,
// and lines.mjs moves each batch by (batch origin - that eye) in doubles, exactly as on the flat screen.

import { VIEWS, step, AERIAL_MIN_CLEARANCE, PITCH_LIMIT } from './views.mjs';
import { multiply } from './camera.mjs';
import { initialBudget, adjust } from './device-budget.mjs';

export const SNAP = Math.PI / 6;       // 30 degrees per flick: a common comfortable snap
export const SNAP_ON = 0.7, SNAP_OFF = 0.3; // flick past 0.7 to turn; return inside 0.3 before the next
export const DEADZONE = 0.15;
export const MIN_FRAME_RATE = 72;      // the lowest rate headsets treat as comfortable

// Reference-space axes to world axes: right stays east, up becomes z, towards-the-viewer becomes south.
export const xrToWorld = ([x, y, z]) => [x, -z, y];

// Turns a world vector clockwise seen from above by yaw, so north becomes (sin yaw, cos yaw).
export function rotYaw(yaw, [x, y, z]) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return [c * x + s * y, -s * x + c * y, z];
}

// Rotates vector v by unit quaternion q = [x, y, z, w].
export function rotate([qx, qy, qz, qw], [vx, vy, vz]) {
  const tx = 2 * (qy * vz - qz * vy), ty = 2 * (qz * vx - qx * vz), tz = 2 * (qx * vy - qy * vx);
  return [vx + qw * tx + (qy * tz - qz * ty), vy + qw * ty + (qz * tx - qx * tz), vz + qw * tz + (qx * ty - qy * tx)];
}

// A direction in the reference space as a world direction.
export const dirToWorld = (rig, v) => rotYaw(rig.yaw, xrToWorld(v));

// A point in the reference space as world metres, in doubles.
export function toWorld(rig, p) {
  const d = dirToWorld(rig, p);
  return [rig.pos[0] + d[0], rig.pos[1] + d[1], rig.pos[2] + d[2]];
}

// The matrix for one eye: its projection times a rotation-only view (the eye sits at [0, 0, 0]).
// Rows of the view are the eye's right, up and back axes in world terms, the layout camera.mjs view() uses.
export function eyeMatrix(projection, rig, orientation) {
  const r = dirToWorld(rig, rotate(orientation, [1, 0, 0]));
  const u = dirToWorld(rig, rotate(orientation, [0, 1, 0]));
  const b = dirToWorld(rig, rotate(orientation, [0, 0, 1]));
  const v = new Float32Array(16);
  v[0] = r[0]; v[4] = r[1]; v[8] = r[2];
  v[1] = u[0]; v[5] = u[1]; v[9] = u[2];
  v[2] = b[0]; v[6] = b[1]; v[10] = b[2];
  v[15] = 1;
  return multiply(projection, v);
}

// Where the head looks, as views.mjs yaw and pitch in the world.
export function headLook(rig, orientation) {
  const f = dirToWorld(rig, rotate(orientation, [0, 0, -1]));
  const pitch = Math.asin(Math.max(-1, Math.min(1, f[2])));
  return { yaw: Math.atan2(f[0], f[1]), pitch: Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch)) };
}

// Turns the rig by dYaw about the head, so the head stays exactly where it is in the world.
export function turnAbout(rig, head, dYaw) {
  const h = toWorld(rig, head), yaw = wrap(rig.yaw + dYaw), d = rotYaw(yaw, xrToWorld(head));
  return { ...rig, yaw, pos: [h[0] - d[0], h[1] - d[1], rig.pos[2]] };
}

// Snap turning with hysteresis: one step per flick, re-armed only once the stick is back near the centre.
// Stick right (x > 0) turns right, i.e. yaw increases. Returns { armed, turn } with turn in radians.
export function snapTurn(armed, x, { step: size = SNAP, on = SNAP_ON, off = SNAP_OFF } = {}) {
  if (armed && Math.abs(x) >= on) return { armed: false, turn: Math.sign(x) * size };
  if (!armed && Math.abs(x) < off) return { armed: true, turn: 0 };
  return { armed, turn: 0 };
}

// Rescales past the dead zone so a small drift reads 0 and full tilt still reads 1.
export function deadzone(v, dz = DEADZONE) {
  if (!Number.isFinite(v) || Math.abs(v) <= dz) return 0;
  return Math.sign(v) * Math.min(1, (Math.abs(v) - dz) / (1 - dz));
}

// Controllers as plain objects: [{ handedness, gamepad: { axes, buttons: [{ pressed }] } }].
// The xr-standard mapping puts the thumbstick on axes 2 and 3 (0 and 1 are a touchpad); a two-axis pad is
// read from 0 and 1. Stick up reads negative. Returns sticks per hand and the buttons that matter.
export function readControllers(sources) {
  const out = { left: [0, 0], right: [0, 0], toggle: false, slow: false };
  for (const s of sources || []) {
    const g = s && s.gamepad;
    if (!g || (s.handedness !== 'left' && s.handedness !== 'right')) continue;
    const a = g.axes || [], i = a.length >= 4 ? 2 : 0;
    out[s.handedness] = [deadzone(a[i]), deadzone(a[i + 1])];
    const pressed = n => !!(g.buttons && g.buttons[n] && g.buttons[n].pressed);
    if (s.handedness === 'right' && pressed(4)) out.toggle = true; // A: Walk / Drone
    if (s.handedness === 'left' && pressed(1)) out.slow = true;    // left grip: slow and precise
  }
  return out;
}

// Controllers to the same movement input the flat screen uses. Left stick walks and strafes; in Drone the
// right stick's up and down climbs and descends. Turning is by snap only, so it is not part of this.
export function movementInput(c, view) {
  return {
    forward: -c.left[1], strafe: c.left[0], slow: c.slow,
    rise: VIEWS[view] && VIEWS[view].eye === null ? -c.right[1] : 0
  };
}

// The rig's height rule. lift: how far the reference origin sits above the ground in Walk (0 for a floor-
// level space, the standing eye height for a head-level one). Walk is ground-locked under the head; a drone
// keeps its height but never lets the head come closer to the ground than the drone's clearance.
export function settle(rig, head, view, heightAt, lift) {
  const h = toWorld(rig, head), g = heightAt(h[0], h[1]);
  if (!Number.isFinite(g)) return rig;
  if (VIEWS[view].eye !== null) return { ...rig, pos: [rig.pos[0], rig.pos[1], g + lift] };
  const low = g + AERIAL_MIN_CLEARANCE - h[2];
  return low > 0 ? { ...rig, pos: [rig.pos[0], rig.pos[1], rig.pos[2] + low] } : rig;
}

// One movement step, reusing views.mjs step(): same speeds (Walk 8 m/s, Drone 25 m/s), same solids and
// sliding. Movement follows where the head looks; the rig moves by however far step() moved the head.
export function locomote(rig, head, orientation, input, dt, view, heightAt, solids = [], lift = 0) {
  if (!(dt > 0) || !(input.forward || input.strafe || input.rise)) return settle(rig, head, view, heightAt, lift);
  const h = toWorld(rig, head), v = VIEWS[view], { yaw } = headLook(rig, orientation);
  const from = [h[0], h[1], v.eye === null ? h[2] : heightAt(h[0], h[1]) + v.eye];
  const next = step({ view, pos: from, yaw, pitch: 0 }, input, dt, heightAt, solids).pos;
  const dz = v.eye === null ? next[2] - from[2] : 0;
  const moved = { ...rig, pos: [rig.pos[0] + next[0] - from[0], rig.pos[1] + next[1] - from[1], rig.pos[2] + dz] };
  return settle(moved, head, view, heightAt, lift);
}

// Entering: the head appears where the flat-screen viewer stood, looking the same way.
export function enterRig(state, head, orientation, heightAt, lift) {
  const local = headLook({ pos: [0, 0, 0], yaw: 0 }, orientation).yaw;
  const yaw = wrap(state.yaw - local), d = rotYaw(yaw, xrToWorld(head));
  const rig = { pos: [state.pos[0] - d[0], state.pos[1] - d[1], state.pos[2] - d[2]], yaw };
  return settle(rig, head, state.view, heightAt, lift);
}

// Leaving: the flat-screen viewer takes over where the head was, looking where it looked.
export function leaveRig(rig, head, orientation, view) {
  const { yaw, pitch } = headLook(rig, orientation);
  return { view, pos: toWorld(rig, head), yaw, pitch };
}

// Frame rate: the lowest the headset offers at or above 72 Hz (less heat, more time per frame);
// null to leave the headset's own choice when it offers none.
export function chooseFrameRate(supported, floor = MIN_FRAME_RATE) {
  const rates = Array.from(supported || []).filter(r => Number.isFinite(r) && r > 0).sort((a, b) => a - b);
  if (!rates.length) return null;
  return rates.find(r => r >= floor) ?? rates[rates.length - 1];
}

// Resolution budget for a headset: a headset must get a frame every refresh, so frames are never skipped;
// instead the eye buffers shrink (down to half) when frames run late and grow back when they keep up.
// Reuses device-budget.mjs with a cap of the headset's own recommended size (scale 1).
export const headsetBudget = () => initialBudget(1);
export const adjustHeadset = (b, intervalMs, frameRate) => adjust(b, intervalMs, 1000 / (frameRate || MIN_FRAME_RATE));

const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
