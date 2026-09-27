// Walk and drone, and one movement step. Pure: the same state, input, time and solids give the same result.
// eye: metres above the ground (null = drone, free height). speed and slow: metres per second, normal
// and with the precise key held. fps and slowFps: frame targets while moving.
// body: the space the viewer occupies, so nothing passes through a solid a real person or drone could not.

export const VIEWS = Object.freeze({
  standing: { label: 'Walk', eye: 1.7, speed: 8, slow: 1.4, fps: 30, slowFps: 20, body: { radius: 0.3, below: 1.7, above: 0.1 } },
  aerial:   { label: 'Drone', eye: null, speed: 25, slow: 5, fps: 30, slowFps: 20, body: { radius: 0.25, below: 0.15, above: 0.15 } }
});

export const AERIAL_MIN_CLEARANCE = 0.3; // low enough to pass under a table, never into the ground
export const PITCH_LIMIT = Math.PI / 2 - 0.01;

export const speedOf = (view, slow) => (slow ? view.slow : view.speed);
export const fpsOf = (view, slow) => (slow ? view.slowFps : view.fps);

// solids: [{ min: [x, y, z], max: [x, y, z] }] boxes in local metres (tables, stations, fences).
// A move that would put the body inside a solid slides along it if it can, otherwise it stops.
export function step(state, input, dt, heightAt, solids = []) {
  const view = VIEWS[state.view] || VIEWS.standing;
  const fwd = clamp(input.forward || 0, -1, 1), side = clamp(input.strafe || 0, -1, 1);
  const speed = speedOf(view, input.slow), len = Math.hypot(fwd, side) || 1, k = (speed * dt) / Math.max(1, len);
  const s = Math.sin(state.yaw), c = Math.cos(state.yaw);
  const [x0, y0, z0] = state.pos;
  const x1 = x0 + (s * fwd + c * side) * k, y1 = y0 + (c * fwd - s * side) * k;
  const rise = view.eye === null ? clamp(input.rise || 0, -1, 1) * speed * dt : 0;
  const at = (x, y, z) => {
    const ground = heightAt(x, y);
    return view.eye === null ? [x, y, Math.max(ground + AERIAL_MIN_CLEARANCE, z)] : [x, y, ground + view.eye];
  };
  const tries = [at(x1, y1, z0 + rise), at(x1, y0, z0 + rise), at(x0, y1, z0 + rise), at(x1, y1, z0), at(x0, y0, z0 + rise)];
  for (const p of tries) if (!blocked(p, view.body, solids)) return { ...state, pos: p };
  return state;
}

export function blocked([x, y, z], body, solids) {
  for (const b of solids) {
    if (x > b.min[0] - body.radius && x < b.max[0] + body.radius &&
        y > b.min[1] - body.radius && y < b.max[1] + body.radius &&
        z - body.below < b.max[2] && z + body.above > b.min[2]) return true;
  }
  return false;
}

export function look(state, dYaw, dPitch) {
  return { ...state, yaw: wrap(state.yaw + dYaw), pitch: clamp(state.pitch + dPitch, -PITCH_LIMIT, PITCH_LIMIT) };
}

// Changing view snaps to the new eye height; the drone keeps its height unless that is below the ground.
export function setView(state, view, heightAt) {
  const v = VIEWS[view];
  if (!v) throw Error('Unknown view ' + view);
  const ground = heightAt(state.pos[0], state.pos[1]);
  const z = v.eye === null ? Math.max(ground + AERIAL_MIN_CLEARANCE, state.pos[2]) : ground + v.eye;
  return { ...state, view, pos: [state.pos[0], state.pos[1], z] };
}

// Pressing the drone key again returns to walking.
export const toggle = (current, wanted) => (current === wanted ? 'standing' : wanted);

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
