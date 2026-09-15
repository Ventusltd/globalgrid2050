/* Star Generator — gl.js (GRAMMAR §1.5). One WebGL2 context, buffers uploaded once; only lit, positions and the
 * per-focus edge/geometry instance lists are re-uploaded. Two lens programs (points, segments) shared by every lens —
 * a lens cannot add one — plus one shell-owned program (lines) that keeps all 664,940 numbered-line instances
 * resident on the GPU once and draws them around their families. 2D-canvas fallback when WebGL2 is absent.
 */
import { PAL, REL, REL_WORDS } from './core.js';

const hex = h => { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

const VS_POINTS = `#version 300 es
precision highp float;
layout(location=0) in vec2 a_quad; layout(location=1) in vec2 a_posA; layout(location=2) in vec2 a_posB;
layout(location=3) in uvec4 a_meta; layout(location=4) in float a_mass; layout(location=5) in vec2 a_orb;
uniform mat3 u_view; uniform vec2 u_res; uniform float u_mix, u_time, u_dpr, u_orbit; uniform float u_base[5]; uniform float u_gain[5];
out vec2 v_uv; flat out uint v_cat; flat out uint v_cls; flat out uint v_lit; out float v_light;
float lightOf(uint lit){ float l = 0.35; if((lit&8u)!=0u) l = max(l,0.7); if((lit&1u)!=0u) l = max(l,0.8); if((lit&4u)!=0u) l = max(l,0.9); if((lit&2u)!=0u) l = 1.0; if((lit&32u)!=0u) l *= 0.4; return l; }
void main(){
  float t = u_mix; t = t < .5 ? 4.*t*t*t : 1. - pow(-2.*t + 2., 3.)/2.;
  vec2 A = a_posA, B = a_posB; bool na = A.x != A.x, nb = B.x != B.x;
  vec2 p = na && nb ? vec2(0.) : na ? B : nb ? A : mix(A, B, t);
  float fade = (na && nb) ? 0. : na ? t : nb ? (1. - t) : 1.;
  if (u_orbit > 0.5 && a_orb.x >= 0.0) { float ring = a_orb.x; float ang = a_orb.y + u_time * 0.25 / (ring + 1.0); p += vec2(cos(ang), sin(ang)) * (16.0 + ring * 18.0); }
  uint cls = a_meta.y; v_lit = a_meta.z; float light = lightOf(a_meta.z);
  float size = clamp(u_base[cls] + u_gain[cls] * sqrt(a_mass), 2.0, 14.0);
  if ((a_meta.z & 2u) != 0u) size *= 1.5; else if (light >= 0.8) size *= 1.3;
  vec3 s = u_view * vec3(p, 1.0);
  vec2 css = s.xy + a_quad * size * 0.5;
  vec2 clip = (css / u_res * 2.0 - 1.0) * vec2(1.0, -1.0);
  gl_Position = fade <= 0.0 ? vec4(2.0, 2.0, 2.0, 1.0) : vec4(clip, 0.0, 1.0);
  v_uv = a_quad; v_cat = a_meta.x; v_cls = cls; v_light = light * fade;
}`;
const FS_POINTS = `#version 300 es
precision highp float;
in vec2 v_uv; flat in uint v_cat; flat in uint v_cls; flat in uint v_lit; in float v_light;
uniform vec3 u_catColour[21]; uniform vec3 u_ring; uniform float u_dpr;
out vec4 o;
void main(){
  float d = v_cls == 4u ? max(abs(v_uv.x), abs(v_uv.y)) : length(v_uv);
  float edge = fwidth(d) * 1.2;
  float a = 1.0 - smoothstep(0.85 - edge, 0.85 + edge, d);
  vec3 c = u_catColour[min(v_cat, 12u)];
  float alpha = (0.18 + 0.82 * v_light) * a;
  if ((v_lit & 4u) != 0u) { float r = smoothstep(0.75 - edge, 0.75, d) * (1.0 - smoothstep(0.95, 0.95 + edge, d)); c = mix(c, u_ring, r); alpha = max(alpha, r * 0.95); }
  if ((v_lit & 8u) != 0u && (v_lit & 4u) == 0u) { float ang = atan(v_uv.y, v_uv.x); float dot_ = step(0.5, fract(ang / 6.2832 * 8.0)); float r = smoothstep(0.78 - edge, 0.78, d) * (1.0 - smoothstep(0.95, 0.95 + edge, d)) * dot_; c = mix(c, u_ring, r); alpha = max(alpha, r * 0.9); }
  if (alpha <= 0.003) discard;
  o = vec4(c, alpha);
}`;
const VS_SEG = `#version 300 es
precision highp float;
layout(location=0) in vec2 a_a0; layout(location=1) in vec2 a_a1; layout(location=2) in vec2 a_ac;
layout(location=3) in vec2 a_b0; layout(location=4) in vec2 a_b1; layout(location=5) in vec2 a_bc;
layout(location=6) in vec4 a_style; layout(location=7) in float a_flags;
uniform mat3 u_view; uniform vec2 u_res; uniform float u_mix, u_dpr, u_zoom;
out float v_t; flat out float v_kind; flat out float v_cls; flat out float v_light; flat out float v_flags;
void main(){
  float m = u_mix; m = m < .5 ? 4.*m*m*m : 1. - pow(-2.*m + 2., 3.)/2.;
  int i = gl_VertexID / 2; float side = float(gl_VertexID % 2) * 2.0 - 1.0; float t = float(i) / 16.0;
  int flags = int(a_flags); bool arrow = (flags & 2) != 0; bool rev = (flags & 4) != 0;
  if (rev) t = 1.0 - t;
  vec2 p0 = mix(a_a0, a_b0, m), p1 = mix(a_a1, a_b1, m), pc = mix(a_ac, a_bc, m);
  bool bad = p0.x != p0.x || p1.x != p1.x || pc.x != pc.x;
  vec2 P = (1.-t)*(1.-t)*p0 + 2.*(1.-t)*t*pc + t*t*p1;
  vec2 T = 2.*(1.-t)*(pc - p0) + 2.*t*(p1 - pc); if (length(T) < 1e-4) T = p1 - p0; vec2 Ts = normalize((u_view * vec3(T, 0.0)).xy); vec2 Nn = vec2(-Ts.y, Ts.x);   // the normal in screen space, so rotation and zoom keep widths in CSS px
  float w = a_style.x;
  if (arrow) { int j = rev ? 16 - i : i; if (j == 15) w = max(w * 3.0, 5.0); else if (j == 16) w = 0.05; }   // arrowhead = the last two vertices widened
  vec3 s = u_view * vec3(P, 1.0);
  vec2 css = s.xy + Nn * side * w * 0.5;
  vec2 clip = (css / u_res * 2.0 - 1.0) * vec2(1.0, -1.0);
  gl_Position = bad ? vec4(2.,2.,2.,1.) : vec4(clip, 0.0, 1.0);
  v_t = t; v_kind = a_style.y; v_cls = a_style.w; v_light = a_style.z; v_flags = a_flags;
}`;
const FS_SEG = `#version 300 es
precision highp float;
in float v_t; flat in float v_kind; flat in float v_cls; flat in float v_light; flat in float v_flags;
uniform vec3 u_catColour[21]; uniform vec3 u_relColour[8]; uniform float u_kindsOn[8]; uniform float u_faint; uniform float u_geomFade;
out vec4 o;
void main(){
  int flags = int(v_flags); bool geom = (flags & 1) != 0; int k = int(v_kind);
  vec3 c; float alpha;
  if (geom) { c = u_catColour[min(k, 20)]; alpha = (v_cls < 1.5 ? 0.3 : 0.9 * v_light) * u_geomFade; }
  else { if (u_kindsOn[k] < 0.5) discard; c = u_relColour[k]; alpha = v_cls < 1.5 ? u_faint : 0.9 * v_light; }
  if (k == 5 && !geom) { if (fract(v_t * 40.0) > 0.45) discard; }
  if (k == 6 && !geom) { if (fract(v_t * 20.0) > 0.6) discard; }
  if (k == 7 && !geom) { if (fract(v_t * 24.0) > 0.5) discard; alpha = 0.6; }
  if ((flags & 8) != 0) { if (fract(v_t * 20.0) > 0.6) discard; }
  o = vec4(c, alpha);
}`;
const VS_LINES = `#version 300 es
precision highp float;
layout(location=0) in uint a_fam; layout(location=1) in float a_ord; layout(location=2) in float a_shared;
uniform sampler2D u_pos; uniform sampler2D u_meta; uniform mat3 u_view; uniform vec2 u_res; uniform float u_mix, u_dpr, u_zoom;
flat out uint v_cat; out float v_light; flat out float v_shared;
void main(){
  float m = u_mix; m = m < .5 ? 4.*m*m*m : 1. - pow(-2.*m + 2., 3.)/2.;
  if (a_fam == 0xffffffffu) { gl_Position = vec4(2.,2.,2.,1.); gl_PointSize = 1.0; return; }
  int f = int(a_fam); ivec2 tc = ivec2(f % 256, f / 256);
  vec4 ab = texelFetch(u_pos, tc, 0); vec4 meta = texelFetch(u_meta, tc, 0);
  vec2 A = ab.xy, B = ab.zw; bool na = A.x != A.x, nb = B.x != B.x;
  if (na && nb) { gl_Position = vec4(2.,2.,2.,1.); gl_PointSize = 1.0; return; }
  vec2 p = na ? B : nb ? A : mix(A, B, m); float fade = na ? m : nb ? 1. - m : 1.;
  float r = 5.0 + 1.3 * sqrt(a_ord); float ang = a_ord * 2.39996;
  p += vec2(cos(ang), sin(ang)) * r / max(u_zoom, 0.5);
  uint lit = uint(meta.z * 255.0 + 0.5); float light = 0.35; if((lit&8u)!=0u) light=0.7; if((lit&1u)!=0u) light=0.8; if((lit&4u)!=0u) light=0.9; if((lit&2u)!=0u) light=1.0; if((lit&32u)!=0u) light*=0.4;
  vec3 s = u_view * vec3(p, 1.0); vec2 clip = (s.xy / u_res * 2.0 - 1.0) * vec2(1.0, -1.0);
  gl_Position = vec4(clip, 0.0, 1.0); gl_PointSize = 1.5 * u_dpr;
  v_cat = uint(meta.x * 255.0 + 0.5); v_light = light * fade; v_shared = a_shared;
}`;
const FS_LINES = `#version 300 es
precision highp float;
flat in uint v_cat; in float v_light; flat in float v_shared;
uniform vec3 u_catColour[21]; uniform vec3 u_shared;
out vec4 o;
void main(){ vec3 c = v_shared > 0.5 ? u_shared : u_catColour[min(v_cat, 12u)]; float a = (0.18 + 0.82 * v_light) * 0.55; if (a < 0.01) discard; o = vec4(c, a); }`;

function compile(gl, vs, fs) {
  const mk = (t, s) => { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(sh)); return sh; };
  const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
  const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < n; i++) { const inf = gl.getActiveUniform(p, i); u[inf.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, inf.name); }
  return { p, u };
}

/** SEG layout: 17 floats per instance = a0(2) a1(2) ac(2) b0(2) b1(2) bc(2) style(width, kindOrCat, light, cls) flags */
export const SEG_STRIDE = 17;

export function createGL(canvas, core) {
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, premultipliedAlpha: false });
  const N = core.N;
  const G = { gl, N, ok: !!gl, mix: 1, tweenStart: 0, tweenMs: 600, time0: performance.now(), orbit: 0, geomFade: 1, faint: 0.12, kindsOn: 0x7f, view: { pan: [0, 0], zoom: 1, rotate: 0 }, w: 1, h: 1, dpr: 1, posA: new Float32Array(2 * N).fill(NaN), posB: new Float32Array(2 * N).fill(NaN), orb: new Float32Array(2 * N).fill(-1), meta: new Uint8Array(4 * N), edgeCount: 0, geomCount: 0, journeyCount: 0, linesCount: 0, frames: 0, slow: 0, litOnly: false };
  for (let i = 0; i < N; i++) { G.meta[4 * i] = core.cat[i] === 255 ? 12 : core.cat[i]; G.meta[4 * i + 1] = core.cls[i]; }
  const catColours = new Float32Array(21 * 3); core.U.cats.forEach((c, i) => catColours.set(hex(c.colour || PAL.muted), i * 3)); catColours.set(hex(PAL.muted), 36); REL_WORDS.forEach((w, i) => catColours.set(hex(REL[w]), (13 + i) * 3)); catColours.set(hex(PAL.busbar), 60);
  const relColours = new Float32Array(8 * 3); REL_WORDS.forEach((w, i) => relColours.set(hex(REL[w]), i * 3)); relColours.set(hex(PAL.accent), 21);
  G.catColours = catColours; G.relColours = relColours;
  if (!gl) { G.ctx2d = canvas.getContext('2d'); return G; }

  const P = compile(gl, VS_POINTS, FS_POINTS), S = compile(gl, VS_SEG, FS_SEG), L = compile(gl, VS_LINES, FS_LINES);
  const buf = (data, usage = gl.STATIC_DRAW) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, usage); return b; };
  const quad = buf(new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]));
  const bPosA = buf(G.posA, gl.DYNAMIC_DRAW), bPosB = buf(G.posB, gl.DYNAMIC_DRAW), bMeta = buf(G.meta, gl.DYNAMIC_DRAW), bMass = buf(core.mass, gl.DYNAMIC_DRAW), bOrb = buf(G.orb, gl.DYNAMIC_DRAW);
  // points VAO
  const vaoP = gl.createVertexArray(); gl.bindVertexArray(vaoP);
  gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const inst = (loc, b, size, type, isInt) => { gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.enableVertexAttribArray(loc); if (isInt) gl.vertexAttribIPointer(loc, size, type, 0, 0); else gl.vertexAttribPointer(loc, size, type, false, 0, 0); gl.vertexAttribDivisor(loc, 1); };
  inst(1, bPosA, 2, gl.FLOAT); inst(2, bPosB, 2, gl.FLOAT); inst(3, bMeta, 4, gl.UNSIGNED_BYTE, true); inst(4, bMass, 1, gl.FLOAT); inst(5, bOrb, 2, gl.FLOAT);
  // segments VAO (edges, geometry, journey share one layout; three dynamic buffers)
  const mkSeg = () => { const b = gl.createBuffer(); const vao = gl.createVertexArray(); gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, b); const st = SEG_STRIDE * 4; const offs = [0, 2, 4, 6, 8, 10]; offs.forEach((o, i) => { gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, 2, gl.FLOAT, false, st, o * 4); gl.vertexAttribDivisor(i, 1); }); gl.enableVertexAttribArray(6); gl.vertexAttribPointer(6, 4, gl.FLOAT, false, st, 48); gl.vertexAttribDivisor(6, 1); gl.enableVertexAttribArray(7); gl.vertexAttribPointer(7, 1, gl.FLOAT, false, st, 64); gl.vertexAttribDivisor(7, 1); return { b, vao, n: 0 }; };
  const segEdges = mkSeg(), segGeom = mkSeg(), segJourney = mkSeg();
  // textures for the lines program: family positions (RGBA32F: ax ay bx by) and meta (RGBA8)
  const TH = Math.ceil(N / 256);
  const tex = (internal, fmt, type, data) => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); gl.texImage2D(gl.TEXTURE_2D, 0, internal, 256, TH, 0, fmt, type, data); return t; };
  const posTex4 = new Float32Array(256 * TH * 4).fill(NaN), metaTex = new Uint8Array(256 * TH * 4);
  const tPos = tex(gl.RGBA32F, gl.RGBA, gl.FLOAT, posTex4), tMeta = tex(gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, metaTex);
  let vaoL = null, bLinesFam = null;

  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.disable(gl.DEPTH_TEST);
  const bg = hex(PAL.body); gl.clearColor(bg[0], bg[1], bg[2], 1);

  const syncPosTex = () => { for (let i = 0; i < N; i++) { posTex4[4 * i] = G.posA[2 * i]; posTex4[4 * i + 1] = G.posA[2 * i + 1]; posTex4[4 * i + 2] = G.posB[2 * i]; posTex4[4 * i + 3] = G.posB[2 * i + 1]; } gl.bindTexture(gl.TEXTURE_2D, tPos); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, TH, gl.RGBA, gl.FLOAT, posTex4); };
  const syncMetaTex = () => { metaTex.set(G.meta); gl.bindTexture(gl.TEXTURE_2D, tMeta); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, TH, gl.RGBA, gl.UNSIGNED_BYTE, metaTex); };

  /** begin a tween: current interpolated positions become A, `target` becomes B */
  G.setPositions = function (target) {
    const t = ease(Math.min(1, G.mix));
    for (let i = 0; i < 2 * N; i++) { const a = G.posA[i], b = G.posB[i]; G.posA[i] = (a !== a) ? b : (b !== b) ? a : a + (b - a) * t; }
    G.posB.set(target);
    gl.bindBuffer(gl.ARRAY_BUFFER, bPosA); gl.bufferSubData(gl.ARRAY_BUFFER, 0, G.posA); gl.bindBuffer(gl.ARRAY_BUFFER, bPosB); gl.bufferSubData(gl.ARRAY_BUFFER, 0, G.posB);
    syncPosTex(); G.mix = 0; G.tweenStart = performance.now();
  };
  G.setLit = function (lit) { for (let i = 0; i < N; i++) G.meta[4 * i + 2] = lit[i]; gl.bindBuffer(gl.ARRAY_BUFFER, bMeta); gl.bufferSubData(gl.ARRAY_BUFFER, 0, G.meta); syncMetaTex(); };
  G.setMass = function () { gl.bindBuffer(gl.ARRAY_BUFFER, bMass); gl.bufferSubData(gl.ARRAY_BUFFER, 0, core.mass); };
  G.setOrbit = function (orb, on) { G.orb.set(orb); G.orbit = on ? 1 : 0; gl.bindBuffer(gl.ARRAY_BUFFER, bOrb); gl.bufferSubData(gl.ARRAY_BUFFER, 0, G.orb); };
  const upload = (seg, data, count) => { gl.bindBuffer(gl.ARRAY_BUFFER, seg.b); gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, count * SEG_STRIDE), gl.DYNAMIC_DRAW); seg.n = count; };
  G.setEdges = (data, n) => { upload(segEdges, data, n); G.edgeCount = n; };
  G.setGeometry = (data, n) => { upload(segGeom, data, n); G.geomCount = n; };
  G.setJourney = (data, n) => { upload(segJourney, data, n); G.journeyCount = n; };
  /** all line instances resident once: fam index (uint32), ordinal within family (float32), shared flag (uint8) */
  G.setLines = function (lineFam, lineOrd, lineShared) {
    vaoL = gl.createVertexArray(); gl.bindVertexArray(vaoL);
    bLinesFam = buf(lineFam); gl.enableVertexAttribArray(0); gl.vertexAttribIPointer(0, 1, gl.UNSIGNED_INT, 0, 0);
    buf(lineOrd); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 0, 0);
    buf(lineShared); gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 1, gl.UNSIGNED_BYTE, false, 0, 0);
    G.linesCount = lineFam.length; G.linesBytes = lineFam.byteLength + lineOrd.byteLength + lineShared.byteLength;
  };
  G.resize = function (w, h, dpr) { G.w = w; G.h = h; G.dpr = dpr; canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); gl.viewport(0, 0, canvas.width, canvas.height); };
  G.viewMatrix = function () { const { pan, zoom, rotate } = G.view, cx = G.w / 2, cy = G.h / 2, c = Math.cos(rotate) * zoom, s = Math.sin(rotate) * zoom; return new Float32Array([c, s, 0, -s, c, 0, cx + pan[0] - c * cx + s * cy, cy + pan[1] - s * cx - c * cy, 1]); };
  G.toScreen = function (x, y) { const m = G.viewMatrix(); return [m[0] * x + m[3] * y + m[6], m[1] * x + m[4] * y + m[7]]; };
  G.toLayout = function (sx, sy) { const m = G.viewMatrix(); const det = m[0] * m[4] - m[3] * m[1]; const dx = sx - m[6], dy = sy - m[7]; return [(m[4] * dx - m[3] * dy) / det, (-m[1] * dx + m[0] * dy) / det]; };
  G.curPos = function (i) { const t = ease(Math.min(1, G.mix)); const ax = G.posA[2 * i], ay = G.posA[2 * i + 1], bx = G.posB[2 * i], by = G.posB[2 * i + 1]; if (bx !== bx) return ax !== ax ? null : [ax, ay]; if (ax !== ax) return [bx, by]; return [ax + (bx - ax) * t, ay + (by - ay) * t]; };
  const base = new Float32Array([5, 4, 3.2, 2.5, 3]), gain = new Float32Array([0.6, 0.6, 0.35, 0.3, 0.12]);
  G.frame = function () {
    const now = performance.now(); const t0 = now;
    if (G.mix < 1) G.mix = Math.min(1, (now - G.tweenStart) / G.tweenMs);
    const time = (now - G.time0) / 1000, view = G.viewMatrix();
    gl.clear(gl.COLOR_BUFFER_BIT);
    const kinds = new Float32Array(8); for (let k = 0; k < 7; k++) kinds[k] = (G.kindsOn >> k) & 1; kinds[7] = 1;
    // segments: geometry first, then edges, then the journey on top
    gl.useProgram(S.p); gl.uniformMatrix3fv(S.u.u_view, false, view); gl.uniform2f(S.u.u_res, G.w, G.h); gl.uniform1f(S.u.u_mix, G.mix); gl.uniform1f(S.u.u_dpr, G.dpr); gl.uniform1f(S.u.u_zoom, G.view.zoom);
    gl.uniform3fv(S.u.u_catColour, catColours); gl.uniform3fv(S.u.u_relColour, relColours); gl.uniform1fv(S.u.u_kindsOn, kinds); gl.uniform1f(S.u.u_faint, G.litOnly ? 0 : G.faint); gl.uniform1f(S.u.u_geomFade, G.geomFade);
    for (const seg of [segGeom, segEdges]) if (seg.n) { gl.bindVertexArray(seg.vao); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 34, seg.n); }
    // lines (the sea around each positioned family)
    if (vaoL && G.linesCount) { gl.useProgram(L.p); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tPos); gl.uniform1i(L.u.u_pos, 0); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tMeta); gl.uniform1i(L.u.u_meta, 1); gl.uniformMatrix3fv(L.u.u_view, false, view); gl.uniform2f(L.u.u_res, G.w, G.h); gl.uniform1f(L.u.u_mix, G.mix); gl.uniform1f(L.u.u_dpr, G.dpr); gl.uniform1f(L.u.u_zoom, G.view.zoom); gl.uniform3fv(L.u.u_catColour, catColours); gl.uniform3fv(L.u.u_shared, hex(REL['shared line'])); gl.bindVertexArray(vaoL); gl.drawArrays(gl.POINTS, 0, G.linesCount); }
    // points
    gl.useProgram(P.p); gl.uniformMatrix3fv(P.u.u_view, false, view); gl.uniform2f(P.u.u_res, G.w, G.h); gl.uniform1f(P.u.u_mix, G.mix); gl.uniform1f(P.u.u_time, time); gl.uniform1f(P.u.u_dpr, G.dpr); gl.uniform1f(P.u.u_orbit, G.orbit);
    gl.uniform1fv(P.u.u_base, base); gl.uniform1fv(P.u.u_gain, gain); gl.uniform3fv(P.u.u_catColour, catColours); gl.uniform3fv(P.u.u_ring, hex(PAL.text));
    gl.bindVertexArray(vaoP); gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, N);
    if (segJourney.n) { gl.useProgram(S.p); gl.bindVertexArray(segJourney.vao); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 34, segJourney.n); }
    gl.bindVertexArray(null);
    // frame-time guard (§8): 30 consecutive frames > 24 ms drops faint edges first
    const dt = performance.now() - t0; G.frames++; if (dt > 24) { if (++G.slow >= 30 && !G.litOnly) { G.litOnly = true; G.onLitOnly && G.onLitOnly(); } } else G.slow = 0;
    return time;
  };
  return G;
}

/** 2D fallback: the same layout() output on a 2D canvas, no tween */
export function draw2D(G, core, edges, edgeN) {
  const c = G.ctx2d, dpr = G.dpr; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.fillStyle = PAL.body; c.fillRect(0, 0, G.w, G.h);
  const m = G.viewMatrix(); c.setTransform(m[0] * dpr, m[1] * dpr, m[3] * dpr, m[4] * dpr, m[6] * dpr, m[7] * dpr);
  for (let e = 0; e < edgeN; e++) { const o = e * SEG_STRIDE; const k = edges[o + 13] | 0, geom = (edges[o + 16] | 0) & 1; c.strokeStyle = geom ? core.colour(k < 12 ? core.range.cat[0] + k : -1) : REL[REL_WORDS[k]] || PAL.accent; c.globalAlpha = edges[o + 15] < 1.5 ? 0.12 : 0.9 * edges[o + 14]; c.lineWidth = edges[o + 12]; c.beginPath(); c.moveTo(edges[o + 6], edges[o + 7]); c.quadraticCurveTo(edges[o + 10], edges[o + 11], edges[o + 8], edges[o + 9]); c.stroke(); }
  c.globalAlpha = 1;
  for (let i = 0; i < G.N; i++) { const x = G.posB[2 * i], y = G.posB[2 * i + 1]; if (x !== x) continue; const lit = G.meta[4 * i + 2]; const light = lit & 2 ? 1 : lit & 4 ? .9 : lit & 1 ? .8 : lit & 8 ? .7 : .35; c.globalAlpha = 0.18 + 0.82 * light; c.fillStyle = core.colour(i); const s = Math.min(14, Math.max(2, 3 + 0.3 * Math.sqrt(core.mass[i]))) * (lit & 2 ? 1.5 : 1); if (core.cls[i] === 4) c.fillRect(x - s / 2, y - s / 2, s, s); else { c.beginPath(); c.arc(x, y, s / 2, 0, 6.2832); c.fill(); } }
  c.globalAlpha = 1;
}
