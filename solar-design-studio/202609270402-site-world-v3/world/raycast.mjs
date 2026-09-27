// Solid ground on the viewer's own GPU: a WebGL2 ray cast through the height field, drawn behind the lines.
// OPTIONAL and OFF by default. substrate.mjs imports this module only when "Solid ground (GPU)" is first switched
// on, so the first frame never waits for it. Where WebGL2 is missing (or its context fails) mountRaycast returns
// null and the world carries on in WebGL1 exactly as before. It draws only inside the substrate's own frames, so
// a still view stays at 0 fps; a new ground grid is gathered in slices between frames and asks for one frame.
//
// The method is the "positron" of the GPU night render pair (gw-lidar src/render_pair.py): a maximum-mipmap
// traversal (Tevs, Ihrke and Seidel 2008), 16 samples and 30 bisections in the 1-cell step, bilinear ground in
// lerp form. Its CuPy twin and its exact-quadratic partner are the witness; tests/raycast-vector.json holds a
// case computed there, tests/raycast.test.mjs checks the pure parts and tests/raycast-browser.cjs the shader.
// What it adds to the wireframe: the TRUE horizon (ground that is not measured is not drawn: a ray that finds no
// measured ground is sky, never a guessed plateau), sun shadows (one shadow ray per pixel, toward the sun of the
// sun control) and, when a target is set, a sightline tint (ground from which a person 1.7 m tall sees it).
// Local east (x), north (y), up (z) metres, the camera of camera.mjs / pick.mjs (yaw 0 north, pitch up +).

export const DEFAULTS = Object.freeze({ nodes: 1025, spacing: 2, farNodes: 1025, farSpacing: 8, scale: 0.5, sliceMs: 6, person: 1.7 });
export const NO_GROUND = -1e4;              // a node with no measured height: far below anything, so rays pass
const K = 16, BIS = 30, PROBE = 1e-3;

// Maximum-mipmap levels of a node grid (n = 2^k + 1 nodes a side): level 0 holds the highest of each cell's four
// nodes, level L the highest of each 2x2 block of level L-1. Pure.
export function buildPyramid(h, n) {
  const c = n - 1;
  if (c & (c - 1)) throw Error('buildPyramid needs 2^k + 1 nodes a side');
  let lv = new Float32Array(c * c);
  for (let j = 0; j < c; j++) for (let i = 0; i < c; i++)
    lv[j * c + i] = Math.max(h[j * n + i], h[j * n + i + 1], h[(j + 1) * n + i], h[(j + 1) * n + i + 1]);
  const levels = [lv];
  for (let m = c / 2; m >= 1; m /= 2) {
    const p = levels[levels.length - 1], w = m * 2, nx = new Float32Array(m * m);
    for (let j = 0; j < m; j++) for (let i = 0; i < m; i++)
      nx[j * m + i] = Math.max(p[2 * j * w + 2 * i], p[2 * j * w + 2 * i + 1], p[(2 * j + 1) * w + 2 * i], p[(2 * j + 1) * w + 2 * i + 1]);
    levels.push(nx);
  }
  return levels;
}

// Camera basis of camera.mjs view(): forward, right, up. Pure.
export function basis(yaw, pitch) {
  const c = Math.cos(pitch), f = [Math.sin(yaw) * c, Math.cos(yaw) * c, Math.sin(pitch)], r = [Math.cos(yaw), -Math.sin(yaw), 0];
  return { f, r, u: [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]] };
}

// Unit vector toward the sun from grid azimuth and elevation (degrees), as sun-mode.mjs reports them. Pure.
export function sunVector({ azimuth, elevation }) {
  const a = azimuth * Math.PI / 180, e = elevation * Math.PI / 180;
  return [Math.sin(a) * Math.cos(e), Math.cos(a) * Math.cos(e), Math.sin(e)];
}

const VS = `#version 300 es
in vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }`;
const FS = `#version 300 es
precision highp float; precision highp int; precision highp sampler2D;
uniform sampler2D uH, uP, uH1, uP1; uniform int n, top, n1, top1, useFar, mode, useSun, useTarget; uniform vec2 size, g0, g01;
uniform float sp, sp1, tanHalf, aspect, person; uniform vec3 eye, cf, cr, cu, sun, target, bg, light;
out vec4 o;
const int K = ${K}, BIS = ${BIS}, MAX_ITER = 60000; const float PROBE = ${PROBE}, INF = 1e30;
float hz(sampler2D H, int i, int j) { return texelFetch(H, ivec2(i, j), 0).r - eye.z; }
float lerpH(sampler2D H, int ci, int cj, float u, float v) {
  float s0 = hz(H, ci, cj) * (1.0 - u) + hz(H, ci + 1, cj) * u, s1 = hz(H, ci, cj + 1) * (1.0 - u) + hz(H, ci + 1, cj + 1) * u;
  return s0 * (1.0 - v) + s1 * v; }
float cl(float x) { return min(max(x, 0.0), 1.0); }
// the positron on one grid, in its cells: origin o (local x, y metres; z metres above the eye), unit d, to tfar
float trace(sampler2D H, sampler2D P, int n, int top, float sp, vec2 g0, vec3 o, vec3 d, float tfar, out int hci, out int hcj) {
  float ex = (o.x - g0.x) / sp, ey = (o.y - g0.y) / sp, oz = o.z;
  float dx = d.x / sp, dy = d.y / sp, dz = d.z, X1 = float(n - 1);
  float tx = dx > 0.0 ? (X1 - ex) / dx : (dx < 0.0 ? -ex / dx : INF);
  float ty = dy > 0.0 ? (X1 - ey) / dy : (dy < 0.0 ? -ey / dy : INF);
  float tExit = min(tfar, min(tx, ty)), t = 0.0; int L = top; hci = 0; hcj = 0;
  if (ex < 0.0 || ey < 0.0 || ex > X1 || ey > X1) return INF;
  for (int it = 0; it < MAX_ITER; it++) {
    if (!(t < tExit)) break;
    float te = t + PROBE, qx = ex + dx * te, qy = ey + dy * te;
    int sz = 1 << L, w = (n - 1) >> L;
    int ci = int(floor(qx / float(sz))), cj = int(floor(qy / float(sz)));
    if (dx < 0.0 && float(ci * sz) == qx) ci -= 1;
    if (dy < 0.0 && float(cj * sz) == qy) cj -= 1;
    ci = clamp(ci, 0, w - 1); cj = clamp(cj, 0, w - 1);
    float x0 = float(ci * sz), y0 = float(cj * sz);
    float cx = dx > 0.0 ? (x0 + float(sz) - ex) / dx : (dx < 0.0 ? (x0 - ex) / dx : INF);
    float cy = dy > 0.0 ? (y0 + float(sz) - ey) / dy : (dy < 0.0 ? (y0 - ey) / dy : INF);
    float tc = min(min(cx, cy), tExit);
    if (tc <= t) tc = t + PROBE;
    if (min(oz + dz * t, oz + dz * tc) > texelFetch(P, ivec2(ci, cj), L).r - eye.z) { t = tc; if (L < top) L++; continue; }
    if (L > 0) { L--; continue; }
    float fx = float(ci), fy = float(cj), lo = t, hi = -1.0;
    if ((oz + dz * t) - lerpH(H, ci, cj, cl(ex + dx * t - fx), cl(ey + dy * t - fy)) <= 0.0) hi = t;
    else {
      for (int k = 1; k <= K; k++) {
        float tq = t + (tc - t) * (float(k) / float(K));
        if ((oz + dz * tq) - lerpH(H, ci, cj, cl(ex + dx * tq - fx), cl(ey + dy * tq - fy)) <= 0.0) { hi = tq; break; }
        lo = tq;
      }
      if (hi >= 0.0) for (int b = 0; b < BIS; b++) {
        float m = 0.5 * (lo + hi);
        if ((oz + dz * m) - lerpH(H, ci, cj, cl(ex + dx * m - fx), cl(ey + dy * m - fy)) <= 0.0) hi = m; else lo = m;
      }
    }
    if (hi >= 0.0) { hci = ci; hcj = cj; return hi; }
    t = tc; if (L < top) L++;
  }
  return INF;
}
// near grid first; a ray that leaves it without a hit carries on in the far grid from where it left
float castAll(vec3 o, vec3 d, float tfar, out int which, out int ci, out int cj) {
  which = 0; float t = trace(uH, uP, n, top, sp, g0, o, d, tfar, ci, cj);
  if (t < INF || useFar == 0) return t;
  vec2 lo = g0, hi = g0 + sp * float(n - 1); float tn = 0.0;
  if (all(greaterThanEqual(o.xy, lo)) && all(lessThanEqual(o.xy, hi))) {
    float ax = d.x > 0.0 ? (hi.x - o.x) / d.x : (d.x < 0.0 ? (lo.x - o.x) / d.x : INF);
    float ay = d.y > 0.0 ? (hi.y - o.y) / d.y : (d.y < 0.0 ? (lo.y - o.y) / d.y : INF);
    tn = min(ax, ay);
  }
  if (!(tn < tfar)) return INF;
  which = 1; t = trace(uH1, uP1, n1, top1, sp1, g01, o + d * tn, d, tfar - tn, ci, cj);
  return t < INF ? tn + t : INF;
}
vec3 normalAt(int which, int ci, int cj, vec3 P) {    // central differences in the hit cell of the grid it was found in
  float s = which == 0 ? sp : sp1; vec2 g = which == 0 ? g0 : g01;
  float uh = cl((P.x - g.x) / s - float(ci)), vh = cl((P.y - g.y) / s - float(cj));
  const float h = 0.015625;
  float ua = min(max(uh, h), 1.0 - h), va = min(max(vh, h), 1.0 - h), gx, gy;
  if (which == 0) { gx = lerpH(uH, ci, cj, ua + h, vh) - lerpH(uH, ci, cj, ua - h, vh); gy = lerpH(uH, ci, cj, uh, va + h) - lerpH(uH, ci, cj, uh, va - h); }
  else { gx = lerpH(uH1, ci, cj, ua + h, vh) - lerpH(uH1, ci, cj, ua - h, vh); gy = lerpH(uH1, ci, cj, uh, va + h) - lerpH(uH1, ci, cj, uh, va - h); }
  return normalize(vec3(-gx / (2.0 * h * s), -gy / (2.0 * h * s), 1.0));
}
void main() {
  vec2 ndc = 2.0 * gl_FragCoord.xy / size - 1.0;                 // pixel centres, as pick.mjs rayFromScreen
  vec3 d = normalize(cf + cr * (ndc.x * tanHalf * aspect) + cu * (ndc.y * tanHalf));
  int which, ci, cj, w2, si, sj;
  float T = castAll(vec3(eye.xy, 0.0), d, INF, which, ci, cj), shadow = -1.0, seen = -1.0, lam = 0.0;
  if (T < INF) {
    vec3 P = vec3(eye.xy, 0.0) + d * T, nrm = normalAt(which, ci, cj, P);   // local x, y; z above the eye
    if (useSun == 1) {
      shadow = castAll(P + nrm * 0.1, sun, INF, w2, si, sj) < INF ? 1.0 : 0.0;
      lam = max(dot(nrm, sun), 0.0);
    } else lam = 0.25 + 0.75 * max(dot(nrm, light), 0.0);     // no sun control on: a plain hillshade light
    if (useTarget == 1) {
      vec3 a = P + vec3(0.0, 0.0, person), v = vec3(target.xy, target.z - eye.z) - a; float L = length(v);
      seen = castAll(a, v / L, max(L - 1.0, 0.01), w2, si, sj) < INF ? 0.0 : 1.0;
    }
  }
  if (mode == 1) { o = vec4(T, shadow, seen, lam); return; }
  if (!(T < INF)) { o = vec4(bg, 1.0); return; }
  vec3 c = vec3(0.30, 0.37, 0.27) * (0.30 + 0.75 * (shadow > 0.5 ? 0.0 : lam));
  if (shadow > 0.5) c *= vec3(0.9, 0.95, 1.15);
  if (seen > 0.5) c = mix(c, vec3(0.2, 0.75, 0.85), 0.35);
  o = vec4(mix(c, bg, min(T / 3000.0, 0.8)), 1.0);
}`;

// The ray caster on a WebGL2 context: upload a grid, render a pose to the canvas or read back distances.
export function createRaycaster(gl) {
  if (!gl.getExtension('EXT_color_buffer_float')) throw Error('EXT_color_buffer_float is missing');
  const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x);
    if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(x)); return x; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(prog));
  const U = {}; for (const k of ['uH', 'uP', 'uH1', 'uP1', 'n', 'top', 'n1', 'top1', 'useFar', 'mode', 'useSun', 'useTarget', 'size', 'g0', 'g01',
    'sp', 'sp1', 'tanHalf', 'aspect', 'person', 'eye', 'cf', 'cr', 'cu', 'sun', 'target', 'bg', 'light']) U[k] = gl.getUniformLocation(prog, k);
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const pl = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(pl); gl.vertexAttribPointer(pl, 2, gl.FLOAT, false, 0, 0);
  const grids = [null, null], texs = [[null, null], [null, null]]; let dataFb = null, dataTex = null, dataSize = [0, 0];
  const tex = () => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); return t; };
  // g: { h: Float32Array n*n (rows south to north), n, spacing, x0, y0 } local metres; level 0 near, 1 far (or null)
  function upload(g, level = 0) {
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    for (const t of texs[level]) if (t) gl.deleteTexture(t);
    if (!g) { grids[level] = null; texs[level] = [null, null]; return; }
    gl.activeTexture(gl.TEXTURE0); const texH = tex(); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.R32F, g.n, g.n); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, g.n, g.n, gl.RED, gl.FLOAT, g.h);
    const levels = buildPyramid(g.h, g.n), c = g.n - 1;
    gl.activeTexture(gl.TEXTURE1); const texP = tex(); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_NEAREST);
    gl.texStorage2D(gl.TEXTURE_2D, levels.length, gl.R32F, c, c);
    levels.forEach((lv, l) => gl.texSubImage2D(gl.TEXTURE_2D, l, 0, 0, c >> l, c >> l, gl.RED, gl.FLOAT, lv));
    grids[level] = { ...g, top: levels.length - 1 }; texs[level] = [texH, texP];
  }
  // p: { eye: [x, y, z], yaw, pitch, fovy, width, height, sun?: [x, y, z], target?: [x, y, z], bg?: [r, g, b] }
  function setup(p, mode) {
    const b = basis(p.yaw, p.pitch);
    gl.useProgram(prog); gl.bindVertexArray(vao);
    const g = grids[0], f = grids[1] || grids[0], tf = grids[1] ? texs[1] : texs[0];
    [texs[0][0], texs[0][1], tf[0], tf[1]].forEach((t, k) => { gl.activeTexture(gl.TEXTURE0 + k); gl.bindTexture(gl.TEXTURE_2D, t); });
    gl.uniform1i(U.uH, 0); gl.uniform1i(U.uP, 1); gl.uniform1i(U.uH1, 2); gl.uniform1i(U.uP1, 3);
    gl.uniform1i(U.n, g.n); gl.uniform1i(U.top, g.top); gl.uniform1i(U.n1, f.n); gl.uniform1i(U.top1, f.top);
    gl.uniform1i(U.useFar, grids[1] ? 1 : 0); gl.uniform1i(U.mode, mode);
    gl.uniform2f(U.g01, f.x0, f.y0); gl.uniform1f(U.sp1, f.spacing);
    gl.uniform1i(U.useSun, p.sun ? 1 : 0); gl.uniform1i(U.useTarget, p.target ? 1 : 0);
    gl.uniform2f(U.size, p.width, p.height); gl.uniform2f(U.g0, g.x0, g.y0); gl.uniform1f(U.sp, g.spacing);
    gl.uniform1f(U.tanHalf, Math.tan(p.fovy / 2)); gl.uniform1f(U.aspect, p.width / p.height); gl.uniform1f(U.person, p.person ?? DEFAULTS.person);
    gl.uniform3fv(U.eye, p.eye); gl.uniform3fv(U.cf, b.f); gl.uniform3fv(U.cr, b.r); gl.uniform3fv(U.cu, b.u);
    gl.uniform3fv(U.sun, p.sun || [0, 0, 1]); gl.uniform3fv(U.target, p.target || [0, 0, 0]); gl.uniform3fv(U.bg, p.bg || [0.04, 0.04, 0.04]);
    gl.uniform3fv(U.light, sunVector({ azimuth: 315, elevation: 45 }));
    gl.viewport(0, 0, p.width, p.height); gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
  }
  return {
    ready: () => !!grids[0], grid: (level = 0) => grids[level], upload,
    render(p) { if (!grids[0]) return false; gl.bindFramebuffer(gl.FRAMEBUFFER, null); setup(p, 0); gl.drawArrays(gl.TRIANGLES, 0, 3); return true; },
    // Per pixel, rows from the TOP: [distance (1e30 sky), shadow (1, 0, -1 no ground), seen (1, 0, -1), sun term].
    readData(p) {
      if (!grids[0]) return null;
      if (!dataFb || dataSize[0] !== p.width || dataSize[1] !== p.height) {
        if (dataTex) gl.deleteTexture(dataTex);
        gl.activeTexture(gl.TEXTURE4); dataTex = tex(); gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, p.width, p.height);
        dataFb = dataFb || gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, dataFb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, dataTex, 0); dataSize = [p.width, p.height];
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, dataFb); setup(p, 1); gl.drawArrays(gl.TRIANGLES, 0, 3);
      const raw = new Float32Array(p.width * p.height * 4), out = new Float32Array(raw.length);
      gl.readPixels(0, 0, p.width, p.height, gl.RGBA, gl.FLOAT, raw); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      const row = p.width * 4;
      for (let y = 0; y < p.height; y++) out.set(raw.subarray((p.height - 1 - y) * row, (p.height - y) * row), y * row);
      return out;
    }
  };
}

// Gathers the measured ground around (cx, cy) into a node grid, a few rows per slice, then calls done(grid).
// Unmeasured nodes get NO_GROUND. Returns a cancel function.
export function gatherGrid(measuredAt, cx, cy, { nodes = DEFAULTS.nodes, spacing = DEFAULTS.spacing, sliceMs = DEFAULTS.sliceMs } = {}, done, later = f => setTimeout(f, 0)) {
  const half = (nodes - 1) / 2 * spacing, x0 = Math.round((cx - half) / spacing) * spacing, y0 = Math.round((cy - half) / spacing) * spacing;
  const h = new Float32Array(nodes * nodes); let j = 0, cancelled = false, measured = 0;
  const slice = () => {
    if (cancelled) return;
    const t0 = performance.now();
    do {                                    // at least one row a slice, however small the budget
      for (let i = 0; i < nodes; i++) { const v = measuredAt(x0 + i * spacing, y0 + j * spacing); if (Number.isFinite(v)) { h[j * nodes + i] = v; measured++; } else h[j * nodes + i] = NO_GROUND; }
      j++;
    } while (j < nodes && performance.now() - t0 < sliceMs);
    if (j < nodes) later(slice); else done({ h, n: nodes, spacing, x0, y0, measured });
  };
  later(slice);
  return () => { cancelled = true; };
}

// The optional layer. w: { lines, canvas, state, FOV, measuredAt, groundVersion, origin, sun, invalidate, doc }.
// Returns null (and the caller hides the switch) where WebGL2 cannot run it.
export function mountRaycast(w, opts = {}) {
  const o = { ...DEFAULTS, ...opts }, doc = w.doc || document;
  let gl2 = null, rc = null;
  const off = doc.createElement('canvas');
  try { gl2 = off.getContext('webgl2', { antialias: false, depth: false, alpha: false }); if (gl2) rc = createRaycaster(gl2); } catch { rc = null; }
  if (!rc) return null;
  let on = false, cancel = null, built = null, target = null, lastGv = -1, lastMs = 0, frames = 0, gatherMs = 0;
  const gl1 = w.lines.context(), T1 = gl1.createTexture(), B1 = gl1.createBuffer();
  gl1.bindTexture(gl1.TEXTURE_2D, T1);
  for (const [k, v] of [[gl1.TEXTURE_MIN_FILTER, gl1.LINEAR], [gl1.TEXTURE_MAG_FILTER, gl1.LINEAR],
    [gl1.TEXTURE_WRAP_S, gl1.CLAMP_TO_EDGE], [gl1.TEXTURE_WRAP_T, gl1.CLAMP_TO_EDGE]]) gl1.texParameteri(gl1.TEXTURE_2D, k, v);
  gl1.bindBuffer(gl1.ARRAY_BUFFER, B1); gl1.bufferData(gl1.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl1.STATIC_DRAW);
  const q = gl1.createProgram();
  for (const [t, s] of [[gl1.VERTEX_SHADER, 'attribute vec2 p; varying vec2 v; void main() { v = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }'],
    [gl1.FRAGMENT_SHADER, 'precision mediump float; uniform sampler2D t; varying vec2 v; void main() { gl_FragColor = texture2D(t, v); }']]) {
    const s1 = gl1.createShader(t); gl1.shaderSource(s1, s); gl1.compileShader(s1); gl1.attachShader(q, s1);
  }
  gl1.linkProgram(q);
  const qp = gl1.getAttribLocation(q, 'p'), qt = gl1.getUniformLocation(q, 't');
  // Grids are anchored in national-grid metres, so an origin move does not shift the ground under the viewer.
  // The near grid (1025 nodes at 2 m) comes first and is drawn at once; the far grid (1025 at 8 m, where the
  // far-ring tiles give ground past the 1 m tiles) follows. A far node with no measured ground stays NO_GROUND.
  let farBuilt = null;
  function gather() {
    const s = w.state(), og = w.origin(); cancel?.(); const t0 = performance.now();
    cancel = gatherGrid(w.measuredAt, s.pos[0], s.pos[1], o, g => {
      gatherMs = performance.now() - t0; lastMs = performance.now();
      rc.upload(g, 0); built = { e0: g.x0 + og.e, n0: g.y0 + og.n, measured: g.measured, cx: s.pos[0] + og.e, cy: s.pos[1] + og.n };
      w.invalidate({ ground: false });
      cancel = gatherGrid(w.measuredAt, s.pos[0], s.pos[1], { ...o, nodes: o.farNodes, spacing: o.farSpacing }, f => {
        cancel = null;
        // a far grid that measured nothing past the near one adds nothing: leave the far grid off
        const beyond = f.measured > g.measured / ((o.farSpacing / o.spacing) ** 2) * 1.05;
        rc.upload(beyond ? f : null, 1); farBuilt = beyond ? { e0: f.x0 + og.e, n0: f.y0 + og.n, measured: f.measured } : null;
        w.invalidate({ ground: false });
      });
    });
  }
  function stale() {
    if (!built) return !cancel;
    const s = w.state(), og = w.origin(), reach = (o.nodes - 1) * o.spacing / 4;
    if (Math.hypot(s.pos[0] + og.e - built.cx, s.pos[1] + og.n - built.cy) > reach) return true;
    return w.groundVersion() !== lastGv && performance.now() - lastMs > 1500;
  }
  // Called by lines.draw right after it clears: ray cast into the WebGL2 canvas, then paint it as the backdrop.
  function backdrop(gl, width, height) {
    if (!on) return;
    if (stale() && !cancel) { lastGv = w.groundVersion(); gather(); }
    if (!rc.ready() || !built) return;
    const s = w.state(), og = w.origin(), sunNow = w.sun?.();
    rc.grid(0).x0 = built.e0 - og.e; rc.grid(0).y0 = built.n0 - og.n;
    if (farBuilt && rc.grid(1)) { rc.grid(1).x0 = farBuilt.e0 - og.e; rc.grid(1).y0 = farBuilt.n0 - og.n; }
    const W = Math.max(1, Math.round(width * o.scale)), H = Math.max(1, Math.round(height * o.scale));
    if (off.width !== W || off.height !== H) { off.width = W; off.height = H; }
    rc.render({ eye: s.pos, yaw: s.yaw, pitch: s.pitch, fovy: w.FOV, width: W, height: H,
      sun: sunNow && sunNow.elevation > 0 ? sunVector(sunNow) : null, target: target ? [target[0] - w.origin().e, target[1] - w.origin().n, target[2]] : null });
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, T1);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);          // a canvas's top row is the texture's last
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, off); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.useProgram(q); gl.bindBuffer(gl.ARRAY_BUFFER, B1); gl.enableVertexAttribArray(qp); gl.vertexAttribPointer(qp, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1i(qt, 0);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.depthMask(false);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.BLEND); gl.depthMask(true);
    frames++;
  }
  return {
    set(v) { on = !!v; w.lines.setBackdrop(on ? backdrop : null); if (!on) { cancel?.(); cancel = null; } w.invalidate({ ground: false }); },
    on: () => on,
    // A point in national-grid metres (e, n, height m) to test sightlines to; null clears it.
    setTarget(t) { target = t; w.invalidate({ ground: false }); },
    readData: p => rc.readData(p), grid: () => rc.grid(),
    debug: () => ({ on, ready: rc.ready(), gathering: !!cancel, frames, gatherMs: Math.round(gatherMs), measured: built?.measured ?? 0,
      far: farBuilt ? { measured: farBuilt.measured, nodes: o.farNodes, spacing: o.farSpacing } : null,
      nodes: o.nodes, spacing: o.spacing, scale: o.scale, sun: !!w.sun?.(), target })
  };
}
