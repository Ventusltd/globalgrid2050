// Viewpoints and one movement step. Pure: the same state, input and time give the same result.
// eye: metres above the ground (null = aerial, no ground lock). speed and slow: metres per second,
// normal and with the precise key held. fps and slowFps: frame targets while moving.

export const VIEWS = Object.freeze({
  standing: { label: 'Standing', eye: 1.7, speed: 25, slow: 1.4, fps: 30, slowFps: 20 },
  crouched: { label: 'Crouched', eye: 0.6, speed: 1.5, slow: 0.5, fps: 20, slowFps: 20 },
  raised:   { label: 'Raised 4 m', eye: 4.0, speed: 25, slow: 1.4, fps: 30, slowFps: 20 },
  aerial:   { label: 'Aerial', eye: null, speed: 25, slow: 5, fps: 30, slowFps: 20 }
});

export const AERIAL_MIN_CLEARANCE = 0.5;
export const PITCH_LIMIT = Math.PI / 2 - 0.01;

export const speedOf = (view, slow) => (slow ? view.slow : view.speed);
export const fpsOf = (view, slow) => (slow ? view.slowFps : view.fps);

// input: forward and strafe in [-1, 1]; rise in [-1, 1] (aerial only); slow = precise key held.
export function step(state, input, dt, heightAt) {
  const view = VIEWS[state.view] || VIEWS.standing;
  const fwd = clamp(input.forward || 0, -1, 1), side = clamp(input.strafe || 0, -1, 1);
  const speed = speedOf(view, input.slow), len = Math.hypot(fwd, side) || 1, k = (speed * dt) / Math.max(1, len);
  const s = Math.sin(state.yaw), c = Math.cos(state.yaw);
  const x = state.pos[0] + (s * fwd + c * side) * k;
  const y = state.pos[1] + (c * fwd - s * side) * k;
  const ground = heightAt(x, y);
  const z = view.eye === null
    ? Math.max(ground + AERIAL_MIN_CLEARANCE, state.pos[2] + clamp(input.rise || 0, -1, 1) * speed * dt)
    : ground + view.eye;
  return { ...state, pos: [x, y, z] };
}

export function look(state, dYaw, dPitch) {
  return { ...state, yaw: wrap(state.yaw + dYaw), pitch: clamp(state.pitch + dPitch, -PITCH_LIMIT, PITCH_LIMIT) };
}

// Changing view snaps to the new eye height; aerial keeps its height unless that is below the ground.
export function setView(state, view, heightAt) {
  const v = VIEWS[view];
  if (!v) throw Error('Unknown view ' + view);
  const ground = heightAt(state.pos[0], state.pos[1]);
  const z = v.eye === null ? Math.max(ground + AERIAL_MIN_CLEARANCE, state.pos[2]) : ground + v.eye;
  return { ...state, view, pos: [state.pos[0], state.pos[1], z] };
}

// Pressing a view's key again returns to standing.
export const toggle = (current, wanted) => (current === wanted ? 'standing' : wanted);

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
