// Arrival: fly the camera from where it is now to hover above a target, looking down on it.
// Pure: no imports, no DOM. The caller supplies time; this only says where the camera should be.

// Matches views.mjs PITCH_LIMIT, so the pose we finish in is one the look controls can hold.
const DOWN = -(Math.PI / 2 - 0.01);

// Smooth start and smooth stop: zero speed and zero acceleration at both ends.
const ease = u => u * u * u * (u * (u * 6 - 15) + 10);

// The shortest way round from one heading to another, in radians.
const turn = (from, to) => {
  const d = (to - from) % (2 * Math.PI);
  return d > Math.PI ? d - 2 * Math.PI : d < -Math.PI ? d + 2 * Math.PI : d;
};

// state: { pos: [x, y, z], yaw, pitch }. target: local [x, y] or [x, y, groundZ].
// Returns pose(t) for t in seconds since the arrival began, giving { pos, yaw, pitch }.
// pose.done(t) says whether it has finished; pose.end is the exact final pose.
// The heading is kept by default, so the ground does not spin under the viewer.
export function arrive(state, target, { height = 120, seconds = 3, yaw = state.yaw, pitch = DOWN } = {}) {
  const from = { pos: [...state.pos], yaw: state.yaw, pitch: state.pitch };
  const end = Object.freeze({ pos: Object.freeze([target[0], target[1], (target[2] ?? 0) + height]), yaw, pitch });
  const dyaw = turn(from.yaw, yaw);
  const finished = t => !(seconds > 0) || t >= seconds;
  const pose = t => {
    if (finished(t)) return { pos: [...end.pos], yaw: end.yaw, pitch: end.pitch };
    const k = ease(Math.max(0, t) / seconds);
    return {
      pos: from.pos.map((p, i) => p + (end.pos[i] - p) * k),
      yaw: from.yaw + dyaw * k,
      pitch: from.pitch + (end.pitch - from.pitch) * k
    };
  };
  pose.done = finished;
  pose.end = end;
  pose.seconds = seconds;
  return pose;
}
