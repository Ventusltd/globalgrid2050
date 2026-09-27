// Line renderer: raw WebGL 1, flat colour, lines fade with distance. No textures, no sky, no lighting.
// Survives a lost WebGL context: every buffer is rebuilt from the layers' own data on restore.
// Drawing is relative to the eye: the matrix is built with the eye at [0, 0, 0], and each batch is moved by
// u_off = (batch origin - eye), worked out in JavaScript doubles. A batch with an origin keeps its
// positions small, so 32-bit floats stay sharp however far the viewer walks from the site origin.
// Far ground drops with the earth's curvature and refraction (61 cm at 3 km): see VS and accuracy.mjs.
// Occlusion: batches marked { occluder: true, triangles } (a coarse ground mesh) are drawn first into the
// depth buffer only; then every line batch is depth tested against them, so lines behind a hill are hidden.
// Lines never write depth, so they never hide each other; only occluders hide anything.

// Earth curvature with refraction: ground d metres from the eye sits CURVATURE_PER_M2 * d^2 lower. A copy of
// accuracy.mjs CURVATURE_PER_M2 ((1 - 0.13) / 2R, R 6,378,137 m), kept here so the first frame waits on no extra file;
// tests/accuracy.test.mjs holds the two equal.
export const CURVATURE_PER_M2 = (1 - 0.13) / (2 * 6378137);
const VS = `attribute vec3 a_p; uniform mat4 u_m; uniform vec3 u_off; uniform float u_fade, u_curv; varying float v_a;
void main() { vec3 p = a_p + u_off; p.z -= u_curv * dot(p.xy, p.xy); gl_Position = u_m * vec4(p, 1.0); v_a = clamp(1.0 - length(p) / u_fade, 0.0, 1.0); }`;
const ZERO = [0, 0, 0];

// The offset from the eye to a batch's origin, in doubles; only the small result goes to the GPU.
export const offsetOf = (origin, eye) => {
  const o = origin || ZERO;
  return [o[0] - eye[0], o[1] - eye[1], o[2] - eye[2]];
};
const FS = `precision mediump float; uniform vec4 u_c; varying float v_a;
void main() { gl_FragColor = vec4(u_c.rgb, u_c.a * v_a); }`;

export const BACKGROUND = [10 / 255, 10 / 255, 10 / 255, 1]; // #0a0a0a

// Occluders first (depth only), then lines; order within each group is kept.
export const splitBatches = batches => {
  const occluders = [], lines = [];
  for (const b of batches) (b.occluder ? occluders : lines).push(b);
  return { occluders, lines };
};

// A coarse ground mesh around (x, y) for occlusion, as an occluder batch. Pure: it only calls heightAt.
// The centre snaps to the cell grid so the mesh does not swim as the viewer moves; positions are relative
// to that centre (the batch origin), so they stay small. sink lowers the mesh so lines lying on finer
// ground than these cells are not buried where the coarse surface cuts above the true one.
// Cells with a corner that has no finite height are left out (nothing is hidden there).
export function occluderMesh(heightAt, x, y, { cell = 8, radius = 400, sink = 0.5, key = 'occluder', version } = {}) {
  if (!(cell > 0) || !(radius > 0)) throw Error('occluderMesh needs a positive cell and radius');
  const cx = Math.round(x / cell) * cell, cy = Math.round(y / cell) * cell;
  const n = Math.ceil(radius / cell), side = 2 * n + 1;
  const h = new Float64Array(side * side);
  for (let j = 0; j < side; j++) for (let i = 0; i < side; i++) {
    const v = heightAt(cx + (i - n) * cell, cy + (j - n) * cell);
    h[j * side + i] = Number.isFinite(v) ? v - sink : NaN;
  }
  const out = new Float32Array((side - 1) * (side - 1) * 18);
  let k = 0;
  const put = (i, j) => { out[k++] = (i - n) * cell; out[k++] = (j - n) * cell; out[k++] = h[j * side + i]; };
  for (let j = 0; j < side - 1; j++) for (let i = 0; i < side - 1; i++) {
    const a = h[j * side + i], b = h[j * side + i + 1], c = h[(j + 1) * side + i], d = h[(j + 1) * side + i + 1];
    if (!Number.isFinite(a + b + c + d)) continue;
    put(i, j); put(i + 1, j); put(i + 1, j + 1);
    put(i, j); put(i + 1, j + 1); put(i, j + 1);
  }
  return { key, version: version ?? `${cx},${cy},${cell},${radius},${sink}`, occluder: true,
    triangles: out.subarray(0, k), origin: [cx, cy, 0] };
}

// Keeps one occluder mesh and rebuilds it only when the viewer has moved `every` metres from where it was
// built, or the ground has changed (groundVersion). Returns the same batch object while nothing changed.
export function occluderFollower({ every = 64, ...opts } = {}) {
  let last = null, at = null, gv;
  return (heightAt, pos, groundVersion = 0) => {
    if (!last || gv !== groundVersion || Math.hypot(pos[0] - at[0], pos[1] - at[1]) > every) {
      at = [pos[0], pos[1]]; gv = groundVersion;
      const m = occluderMesh(heightAt, pos[0], pos[1], opts);
      last = { ...m, version: `${m.version},g${groundVersion}` };
    }
    return last;
  };
}

export function createLines(canvas, { onRestore = () => {} } = {}) {
  let gl, prog, loc, lost = false, scale = 0, backdrop = null;
  const cache = new Map(); // batch key -> { buf, version, count }

  function init() {
    gl = canvas.getContext('webgl', { antialias: true, alpha: false, depth: true, powerPreference: 'low-power' });
    if (!gl) throw Error('WebGL is not available in this browser');
    prog = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, FS]]) {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) throw Error(gl.getShaderInfoLog(s));
      gl.attachShader(prog, s);
    }
    gl.linkProgram(prog);
    loc = { p: gl.getAttribLocation(prog, 'a_p'), m: gl.getUniformLocation(prog, 'u_m'), off: gl.getUniformLocation(prog, 'u_off'),
      fade: gl.getUniformLocation(prog, 'u_fade'), c: gl.getUniformLocation(prog, 'u_c'),
      curv: gl.getUniformLocation(prog, 'u_curv') };
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthFunc(gl.LEQUAL); gl.clearDepth(1);
    cache.clear();
  }

  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); lost = true; cache.clear(); });
  canvas.addEventListener('webglcontextrestored', () => { init(); lost = false; scale = 0; onRestore(); });
  init();

  // Uploads a batch's data once per version and binds it; returns its vertex count.
  function bind(b, data) {
    let c = cache.get(b.key);
    if (!c || c.version !== b.version) {
      if (!c) c = { buf: gl.createBuffer() };
      gl.bindBuffer(gl.ARRAY_BUFFER, c.buf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      c.version = b.version; c.count = data.length / 3; cache.set(b.key, c);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, c.buf); gl.vertexAttribPointer(loc.p, 3, gl.FLOAT, false, 0, 0);
    return c.count;
  }

  return {
    lost: () => lost,
    context: () => gl, // the headset view shares this context
    // Frees a batch's GPU buffer (a streamed batch the caller will not draw again soon); drawn again, it is uploaded afresh.
    // Returns true when there was a buffer to free.
    release(key) {
      const c = cache.get(key);
      if (!c) return false;
      cache.delete(key);
      if (!lost) gl.deleteBuffer(c.buf);
      return true;
    },
    cached: () => cache.size,
    setBackdrop(fn) { backdrop = typeof fn === 'function' ? fn : null; }, // painted after the clear, before occluders and lines

    // returns true when the drawing buffer changed size
    resize(nextScale) {
      const w = Math.max(1, Math.round(canvas.clientWidth * nextScale)), h = Math.max(1, Math.round(canvas.clientHeight * nextScale));
      if (canvas.width === w && canvas.height === h && scale === nextScale) return false;
      canvas.width = w; canvas.height = h; scale = nextScale;
      return true;
    },
    // matrix: projection times the view built at the eye, i.e. view([0, 0, 0], yaw, pitch).
    // eye: the viewer's position in local metres (doubles). fade: distance in metres where lines vanish.
    // batches: [{ key, version, positions: Float32Array of x,y,z pairs, color: [r,g,b,a], origin?: [x,y,z], fade?: metres }]
    //   (a batch's own fade replaces the viewer's: the imagery drape stays readable from a drone's height)
    //   and occluders: { key, version, occluder: true, triangles: Float32Array of x,y,z triples, origin? }
    // target (headset view only): { framebuffer, viewport: [x, y, w, h], clear } draws one eye into the
    //   headset's framebuffer; clear: false keeps what the first eye drew. Without it, the canvas as before.
    // Returns the number of line vertices drawn (occluder vertices are not counted).
    draw(matrix, eye, fade, batches, target) {
      if (lost) return 0;
      const { occluders, lines } = splitBatches(batches);
      gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.framebuffer : null);
      if (target) gl.viewport(...target.viewport); else gl.viewport(0, 0, canvas.width, canvas.height);
      gl.depthMask(true);
      if (!target || target.clear !== false) { gl.clearColor(...BACKGROUND); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); }
      if (backdrop && !target) backdrop(gl, canvas.width, canvas.height); // optional solid ground (raycast.mjs), flat screen only
      gl.useProgram(prog);
      gl.uniformMatrix4fv(loc.m, false, matrix); gl.uniform1f(loc.fade, fade); gl.uniform1f(loc.curv, CURVATURE_PER_M2);
      gl.enableVertexAttribArray(loc.p);
      gl.enable(gl.DEPTH_TEST);
      // Depth only: no colour, pushed slightly back so lines lying on the surface do not z-fight with it.
      gl.colorMask(false, false, false, false);
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1, 4);
      for (const b of occluders) {
        const count = bind(b, b.triangles);
        gl.uniform3fv(loc.off, offsetOf(b.origin, eye));
        gl.drawArrays(gl.TRIANGLES, 0, count);
      }
      gl.disable(gl.POLYGON_OFFSET_FILL);
      gl.colorMask(true, true, true, true);
      gl.depthMask(false); // lines are tested against the ground but never hide each other
      let vertices = 0;
      for (const b of lines) {
        const count = bind(b, b.positions);
        gl.uniform3fv(loc.off, offsetOf(b.origin, eye));
        gl.uniform1f(loc.fade, b.fade > 0 ? b.fade : fade);
        gl.uniform4fv(loc.c, b.color); gl.drawArrays(gl.LINES, 0, count);
        vertices += count;
      }
      gl.depthMask(true);
      return vertices;
    }
  };
}
