// Picking: which point on the ground is under a pixel. Pure: no imports, no DOM, no WebGL.
// Conventions match camera.mjs: local east (x), north (y), up (z), metres; yaw 0 looks north (+y),
// yaw +π/2 looks east (+x); pitch up is positive. The view is built at the eye (eye-relative drawing),
// so the ray starts at the eye in local metres. Pixels: (0, 0) is the top-left corner of the canvas,
// px grows right and py grows down, as in DOM mouse events (use offsetX / offsetY scaled to canvas size).

// A ray through the centre of pixel position (px, py) on a width x height canvas. fovy in radians.
// Returns { origin: [x, y, z], dir: [x, y, z] } with dir of unit length.
export function rayFromScreen(px, py, width, height, eye, yaw, pitch, fovy) {
  const c = Math.cos(pitch);
  const f = [Math.sin(yaw) * c, Math.cos(yaw) * c, Math.sin(pitch)];   // camera.mjs direction()
  const r = [Math.cos(yaw), -Math.sin(yaw), 0];                         // camera.mjs view() right
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]]; // r x f
  const t = Math.tan(fovy / 2), aspect = width / height;
  const nx = (2 * px) / width - 1, ny = 1 - (2 * py) / height;          // normalised device coordinates
  const a = nx * t * aspect, b = ny * t;
  const d = [f[0] + r[0] * a + u[0] * b, f[1] + r[1] * a + u[1] * b, f[2] + r[2] * a + u[2] * b];
  const len = Math.hypot(d[0], d[1], d[2]);
  return { origin: [eye[0], eye[1], eye[2]], dir: [d[0] / len, d[1] / len, d[2] / len] };
}

// First point where the ray meets the ground, or null if it meets none within maxDistance metres.
// groundAt(x, y) -> ground height in metres. The ray is marched in steps of `step` metres; the first
// step that ends at or below the ground is bisected until the bracket is under 1 cm along the ray.
// Returns [x, y, groundAt(x, y)] so the point sits on the ground. A ray that starts below ground: null.
export function pickGround(ray, groundAt, { maxDistance = 2000, step = 0.5 } = {}) {
  const { origin: o, dir: d } = ray;
  if (!(step > 0) || !(maxDistance > 0)) return null;
  const below = t => o[2] + d[2] * t <= groundAt(o[0] + d[0] * t, o[1] + d[1] * t);
  if (below(0)) return null;
  let lo = 0, hi = -1;
  for (let t = step; ; t += step) {
    const s = Math.min(t, maxDistance);
    if (below(s)) { hi = s; break; }
    lo = s;
    if (s >= maxDistance) return null;
  }
  while (hi - lo > 0.01) {
    const mid = (lo + hi) / 2;
    if (below(mid)) hi = mid; else lo = mid;
  }
  const t = (lo + hi) / 2, x = o[0] + d[0] * t, y = o[1] + d[1] * t;
  return [x, y, groundAt(x, y)];
}

// Snaps a point's x and y to the nearest multiple of spacing metres; z is kept as given
// (re-read the ground height afterwards if the snapped point must sit on the ground).
export function snapToGrid(point, spacing) {
  if (!(spacing > 0)) return [point[0], point[1], point[2]];
  const snap = v => Math.round(v / spacing) * spacing + 0; // + 0 turns -0 into 0
  return [snap(point[0]), snap(point[1]), point[2]];
}
