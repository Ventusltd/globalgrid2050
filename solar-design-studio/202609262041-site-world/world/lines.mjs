// Line renderer: raw WebGL 1, flat colour, lines fade with distance. No textures, no sky, no lighting.
// Survives a lost WebGL context: every buffer is rebuilt from the layers' own data on restore.
// Drawing is relative to the eye: the matrix is built with the eye at [0, 0, 0], and each batch is moved by
// u_off = (batch origin - eye), worked out in JavaScript doubles. A batch with an origin keeps its
// positions small, so 32-bit floats stay sharp however far the viewer walks from the site origin.

const VS = `attribute vec3 a_p; uniform mat4 u_m; uniform vec3 u_off; uniform float u_fade; varying float v_a;
void main() { vec3 p = a_p + u_off; gl_Position = u_m * vec4(p, 1.0); v_a = clamp(1.0 - length(p) / u_fade, 0.0, 1.0); }`;
const ZERO = [0, 0, 0];

// The offset from the eye to a batch's origin, in doubles; only the small result goes to the GPU.
export const offsetOf = (origin, eye) => {
  const o = origin || ZERO;
  return [o[0] - eye[0], o[1] - eye[1], o[2] - eye[2]];
};
const FS = `precision mediump float; uniform vec4 u_c; varying float v_a;
void main() { gl_FragColor = vec4(u_c.rgb, u_c.a * v_a); }`;

export const BACKGROUND = [10 / 255, 10 / 255, 10 / 255, 1]; // #0a0a0a

export function createLines(canvas, { onRestore = () => {} } = {}) {
  let gl, prog, loc, lost = false, scale = 0;
  const cache = new Map(); // batch key -> { buf, version, count }

  function init() {
    gl = canvas.getContext('webgl', { antialias: true, alpha: false, powerPreference: 'low-power' });
    if (!gl) throw Error('WebGL is not available in this browser');
    prog = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, FS]]) {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) throw Error(gl.getShaderInfoLog(s));
      gl.attachShader(prog, s);
    }
    gl.linkProgram(prog);
    loc = { p: gl.getAttribLocation(prog, 'a_p'), m: gl.getUniformLocation(prog, 'u_m'), off: gl.getUniformLocation(prog, 'u_off'),
      fade: gl.getUniformLocation(prog, 'u_fade'), c: gl.getUniformLocation(prog, 'u_c') };
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    cache.clear();
  }

  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); lost = true; cache.clear(); });
  canvas.addEventListener('webglcontextrestored', () => { init(); lost = false; scale = 0; onRestore(); });
  init();

  return {
    lost: () => lost,
    // returns true when the drawing buffer changed size
    resize(nextScale) {
      const w = Math.max(1, Math.round(canvas.clientWidth * nextScale)), h = Math.max(1, Math.round(canvas.clientHeight * nextScale));
      if (canvas.width === w && canvas.height === h && scale === nextScale) return false;
      canvas.width = w; canvas.height = h; scale = nextScale;
      return true;
    },
    // matrix: projection times the view built at the eye, i.e. view([0, 0, 0], yaw, pitch).
    // eye: the viewer's position in local metres (doubles). fade: distance in metres where lines vanish.
    // batches: [{ key, version, positions: Float32Array of x,y,z pairs, color: [r,g,b,a], origin?: [x,y,z] }]
    draw(matrix, eye, fade, batches) {
      if (lost) return 0;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(...BACKGROUND); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(prog);
      gl.uniformMatrix4fv(loc.m, false, matrix); gl.uniform1f(loc.fade, fade);
      gl.enableVertexAttribArray(loc.p);
      let vertices = 0;
      for (const b of batches) {
        let c = cache.get(b.key);
        if (!c || c.version !== b.version) {
          if (!c) c = { buf: gl.createBuffer() };
          gl.bindBuffer(gl.ARRAY_BUFFER, c.buf); gl.bufferData(gl.ARRAY_BUFFER, b.positions, gl.STATIC_DRAW);
          c.version = b.version; c.count = b.positions.length / 3; cache.set(b.key, c);
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, c.buf); gl.vertexAttribPointer(loc.p, 3, gl.FLOAT, false, 0, 0);
        gl.uniform3fv(loc.off, offsetOf(b.origin, eye));
        gl.uniform4fv(loc.c, b.color); gl.drawArrays(gl.LINES, 0, c.count);
        vertices += c.count;
      }
      return vertices;
    }
  };
}
