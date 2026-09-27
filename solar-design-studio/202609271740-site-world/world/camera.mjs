// Camera maths. Pure: no DOM, no WebGL. Local east (x), north (y), up (z), metres.
// Matrices are column-major Float32Array(16), as WebGL expects.

export function direction(yaw, pitch) {
  // yaw 0 looks north (+y), yaw +π/2 looks east (+x); pitch +π/2 looks straight up
  const c = Math.cos(pitch);
  return [Math.sin(yaw) * c, Math.cos(yaw) * c, Math.sin(pitch)];
}

export function perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2), m = new Float32Array(16);
  m[0] = f / aspect; m[5] = f;
  m[10] = (far + near) / (near - far); m[11] = -1;
  m[14] = (2 * far * near) / (near - far);
  return m;
}

export function view(pos, yaw, pitch) {
  const f = direction(yaw, pitch);
  const r = [Math.cos(yaw), -Math.sin(yaw), 0];
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const m = new Float32Array(16);
  m[0] = r[0]; m[4] = r[1]; m[8] = r[2]; m[12] = -dot(r, pos);
  m[1] = u[0]; m[5] = u[1]; m[9] = u[2]; m[13] = -dot(u, pos);
  m[2] = -f[0]; m[6] = -f[1]; m[10] = -f[2]; m[14] = dot(f, pos);
  m[15] = 1;
  return m;
}

export function multiply(a, b) {
  const m = new Float32Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      m[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return m;
}
