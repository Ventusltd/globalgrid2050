// Quantum Twin Star — testcode/202609142202 — ES module, WebGL2 only, no CDN, no framework.
// Every number shown comes from ./data/* (built by build_state.mjs) or from a live fetch whose URL is recorded in data/provenance.json.

const $ = s => document.querySelector(s);
const fmt = n => Number(n).toLocaleString('en-GB');
const PI = Math.PI;
const PHONE = matchMedia('(max-width:430px)').matches;
const DPR = Math.min(devicePixelRatio || 1, PHONE ? 2 : 3);
const params = new URLSearchParams(location.search);
const SEED_STRING = params.get('seed') || '2026-09-14';
const KINDCOL = { ENTANGLED_MAYBE: [0, .9, 1], MIGHT_TOUCH: [.55, .58, .65], RHYMES_WITH: [.7, .49, 1], WHAT_IF: [.22, .83, .33], COULD_REPLACE: [1, .62, .26], REMINDS_OF: [.97, .56, .7], SOUL: [0, .9, 1], VALENCE: [1, .83, .29], CHANCE: [.5, .5, .5] };

function fail(msg) {
  const d = document.createElement('div'); d.className = 'u-fail'; d.textContent = msg;
  $('#count').after(d);
}
function hex(h) { return [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255); }
function hash32(str) { // FNV-1a
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}
function mulberry32(a) {
  return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function soulNum(key) { const m = /^#(\d+)\s/.exec(key); return m ? +m[1] : null; }
function soulName(key) { const m = /^#\d+\s+(.*)$/.exec(key); if (!m) return null; const s = m[1]; const i = s.lastIndexOf('/'); return i >= 0 ? s.slice(i + 1) : s; }

// ---------- shaders ----------
const SEA_VS = `#version 300 es
precision highp float; precision highp int;
layout(location=0) in uint a_key; layout(location=1) in uint a_family; layout(location=2) in uint a_idx;
layout(location=3) in uint a_block; layout(location=4) in uint a_cat; layout(location=5) in uint a_seed;
uniform highp sampler2D u_fam;
uniform vec2 u_res; uniform float u_dpr; uniform float u_time;
uniform vec2 u_c0; uniform vec2 u_c1; uniform float u_R; uniform vec3 u_view; uniform float u_spiral;
uniform uint u_focusKey; uniform uint u_focusFamily; uniform uint u_twinKey; uniform uint u_twinFamily;
uniform int u_focusBlock; uniform int u_focusCat; uniform float u_collapseT; uniform float u_size; uniform float u_alpha;
uniform vec3 u_pal[13]; uniform int u_pick;
out vec4 v_col; flat out uint v_key; flat out uint v_fam; flat out uint v_inst;
const float PI=3.14159265358979;
void main(){
  vec4 t = texelFetch(u_fam, ivec2(int(a_family & 127u), int(a_family >> 7u)), 0);
  float ang = t.x;
  float fi = float(a_idx);
  vec2 p = vec2(cos(ang), sin(ang))*t.y + u_spiral*sqrt(fi)*vec2(cos(fi*2.39996323), sin(fi*2.39996323));
  if (gl_InstanceID==1) p = -p; // the twin: every point reflected through the centre (angle + PI, same radius, spiral offset reflected too)
  vec2 c = gl_InstanceID==1 ? u_c1 : u_c0;
  vec2 px = c + p*u_R*u_view.z + u_view.xy;
  float br = u_time + float(a_seed)*0.1;
  px += 0.6*u_dpr*vec2(sin(br), cos(br));
  gl_Position = vec4(px.x/u_res.x*2.0-1.0, 1.0-px.y/u_res.y*2.0, 0.0, 1.0);
  float size = u_size*u_dpr; float alpha = u_alpha*clamp(sqrt(40.0/max(t.w, 1.0)), 0.12, 1.0); // large families drawn fainter so a 6,518-entry family does not white out its neighbours
  bool focused = (u_focusBlock >= 0) || (u_focusCat >= 0);
  if (focused) { alpha *= 0.2; if (int(a_block)==u_focusBlock || int(a_cat)==u_focusCat) alpha = 0.8; }
  if (a_family == u_focusFamily) { size = 3.0*u_dpr; alpha = 0.9; }
  if (a_key == u_focusKey) { size = 6.0*u_dpr; alpha = 1.0; }
  if (u_collapseT > 0.0 && a_family != u_focusFamily && a_key != u_focusKey) alpha *= mix(1.0, 0.55, u_collapseT);
  if (gl_InstanceID == 1) {
    alpha *= 0.4;
    if (a_family == u_twinFamily) { size = 3.0*u_dpr; alpha = 0.9; }
    if (a_key == u_twinKey && u_twinKey != 0u) { size = 6.0*u_dpr; alpha = 1.0; }
  }
  if (u_pick == 1) size = max(size, 4.0*u_dpr);
  gl_PointSize = size;
  vec3 col = u_pal[int(min(a_cat, 12u))];
  v_col = vec4(col, alpha); v_key = a_key; v_fam = a_family; v_inst = uint(gl_InstanceID);
}`;
const SEA_FS = `#version 300 es
precision mediump float; in vec4 v_col; out vec4 o;
void main(){ vec2 d = gl_PointCoord-0.5; float r = length(d)*2.0; float a = 1.0-smoothstep(0.55,1.0,r); o = vec4(v_col.rgb*v_col.a*a, v_col.a*a); }`;
const PICK_FS = `#version 300 es
precision highp float; precision highp int; flat in uint v_key; flat in uint v_fam; flat in uint v_inst; in vec4 v_col; layout(location=0) out uvec2 o;
void main(){ if (length(gl_PointCoord-0.5) > 0.5) discard; o = uvec2(v_key, (v_fam + 1u) | (v_inst << 16u)); }`;
// generic 2D program: px space (u_space 0) or star space (u_space 1, instance 1 mirrored to the twin)
const GEN_VS = `#version 300 es
precision highp float;
in vec2 a_p; in vec4 a_c; in float a_t; in float a_f;
uniform vec2 u_res; uniform vec2 u_org; uniform vec2 u_c0; uniform vec2 u_c1; uniform float u_R; uniform vec3 u_view;
uniform int u_space; uniform float u_time; uniform float u_size; uniform int u_orbit; uniform float u_dpr;
out vec4 v_c; out float v_t;
void main(){
  vec2 px;
  if (u_space == 0) { px = u_org + a_p; if (a_f > 0.5) px.y += sin(20.0*u_time)*u_dpr; }
  else { vec2 p = a_p; bool twin = (a_f > 0.5) || (gl_InstanceID == 1); if (gl_InstanceID == 1) p = -p; vec2 c = twin ? u_c1 : u_c0; px = c + p*u_R*u_view.z + u_view.xy;
         if (u_orbit == 1) px += (1.0-a_c.a)*24.0*u_dpr*vec2(cos(u_time*0.7+a_t*6.2831853), sin(u_time*0.7+a_t*6.2831853)); }
  gl_Position = vec4(px.x/u_res.x*2.0-1.0, 1.0-px.y/u_res.y*2.0, 0.0, 1.0);
  gl_PointSize = u_size*u_dpr; v_c = a_c; v_t = a_t;
}`;
const GEN_FS = `#version 300 es
precision highp float; in vec4 v_c; in float v_t; uniform int u_dash; uniform int u_round; uniform float u_time; uniform float u_cut; out vec4 o;
void main(){
  if (v_t > u_cut) discard;
  if (u_dash == 1 && fract(v_t*0.08 - u_time*0.6) > 0.5) discard;
  float a = v_c.a;
  if (u_round == 1) { float r = length(gl_PointCoord-0.5)*2.0; a *= 1.0-smoothstep(0.6,1.0,r); }
  o = vec4(v_c.rgb*a, a);
}`;
const ELEC_VS = `#version 300 es
precision highp float;
in float a_i;
uniform vec2 u_res; uniform vec2 u_org; uniform float u_r; uniform vec3 u_counts; uniform float u_stride; uniform float u_time; uniform float u_dpr;
uniform float u_collapseT; uniform float u_outcome; uniform float u_flash; uniform vec3 u_col;
out vec4 v_c;
void main(){
  int s = gl_InstanceID; // instance 0 = K, 1 = L, 2 = M: drawArraysInstanced(POINTS, 0, 512, 3)
  float count = s==0 ? u_counts.x : (s==1 ? u_counts.y : u_counts.z);
  float k = a_i*u_stride;
  if (k >= count) { gl_Position = vec4(2.0,2.0,2.0,1.0); gl_PointSize = 0.0; v_c = vec4(0); return; }
  float rad = (s==0 ? 0.55 : (s==1 ? 0.85 : 1.25))*u_r; float w = s==0 ? 1.0 : (s==1 ? 0.6 : 0.35);
  float ang = 6.2831853*k/count + w*u_time;
  vec2 px = u_org + rad*vec2(cos(ang), sin(ang));
  gl_Position = vec4(px.x/u_res.x*2.0-1.0, 1.0-px.y/u_res.y*2.0, 0.0, 1.0);
  gl_PointSize = 2.6*u_dpr; float a = 0.9; vec3 col = u_col;
  if (u_outcome >= 0.0) { bool win = (u_outcome > 0.5) ? (s==2) : (s<2); if (win) col = mix(col, vec3(1.0), u_flash); else a = mix(0.9, 0.15, u_collapseT); }
  v_c = vec4(col, a);
}`;
const BLOCH_VS = `#version 300 es
precision highp float;
in vec3 a_p; uniform mat3 u_rot; uniform vec2 u_org; uniform float u_r; uniform vec2 u_res; uniform int u_mode;
uniform float u_theta; uniform float u_phi; uniform float u_collapseT; uniform float u_outcome; uniform float u_size;
out float v_depth; const float PI=3.14159265358979;
void main(){
  vec3 p = a_p;
  if (u_mode == 1) { float th = mix(u_theta, u_outcome > 0.5 ? PI : 0.0, smoothstep(0.0, 1.0, u_collapseT)); vec3 d = vec3(sin(th)*cos(u_phi), sin(th)*sin(u_phi), cos(th)); p = a_p.x*d; }
  vec3 q = u_rot*p; vec2 px = u_org + vec2(q.x, -q.z)*u_r; v_depth = q.y;
  gl_Position = vec4(px.x/u_res.x*2.0-1.0, 1.0-px.y/u_res.y*2.0, 0.0, 1.0); gl_PointSize = u_size;
}`;
const BLOCH_FS = `#version 300 es
precision mediump float; in float v_depth; uniform vec4 u_col; uniform int u_round; out vec4 o;
void main(){ float a = u_col.a*(v_depth < 0.0 ? 0.35 : 1.0); if (u_round==1){ float r=length(gl_PointCoord-0.5)*2.0; a*=1.0-smoothstep(0.6,1.0,r);} o = vec4(u_col.rgb*a, a); }`;

// ---------- WebGL helpers ----------
function makeProgram(gl, vs, fs) {
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(o)); return o; };
  const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
  const U = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const u = gl.getActiveUniform(p, i); U[u.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, u.name); }
  return { p, U };
}

// ---------- main ----------
const D = {};              // data
const S = {                // state
  famIdx: -1, atom: null, key: 0, famJoinNote: '', focusBlock: -1, focusCat: -1,
  theta: 0, phi: 0, dataTheta: 0, hand: null, relaxFrom: null, hold: false,
  collapse: null, outcome: -1, reprepareAt: 0, twin: null, twinKey: 0, twinFamily: 0xFFFF,
  measurements: [], hist: new Map(), lastQuery: '', lastActivity: performance.now(),
  seedString: SEED_STRING, seedNote: '', cable: null, msg: '', fpsSamples: [], drawCalls: 0,
  view: { x: 0, y: 0, z: 1 }, bandPos: 0, phoneMode: ''
};

async function loadData() {
  const get = async (f, bin) => { const r = await fetch('./data/' + f, { cache: 'no-cache' }); if (!r.ok) throw new Error(f + ' HTTP ' + r.status); return bin ? r.arrayBuffer() : r.json(); };
  const [lines, families, blocks, electron, random, entangled, provenance] = await Promise.all([
    get('lines.bin', true), get('families.json'), get('blocks.json'), get('electron.json'), get('random.json'), get('entangled.json'), get('provenance.json')]);
  const expected = provenance.outputs.find(o => o.file === 'lines.bin').bytes;
  if (lines.byteLength !== expected) throw new Error(`pack mismatch: expected ${fmt(expected)} bytes, got ${fmt(lines.byteLength)}`);
  Object.assign(D, { lines, families, blocks, electron, random, entangled, provenance });
  D.keys = new Uint32Array(lines);
  D.N = D.keys.length;
  D.famByN = new Map(families.map((f, i) => [f.n, i]));
  D.famByName = new Map(); families.forEach((f, i) => { if (!D.famByName.has(f.name)) D.famByName.set(f.name, []); D.famByName.get(f.name).push(i); });
  D.atomByN = new Map(electron.atoms.map(a => [a.n, a]));
  D.atomByName = new Map(); electron.atoms.forEach(a => { if (!D.atomByName.has(a.name)) D.atomByName.set(a.name, []); D.atomByName.get(a.name).push(a); });
  D.entByN = new Map(entangled.entanglements.map(e => [e.n, e]));
  D.repoIdx = new Map(electron.repos.map((r, i) => [r.repo, i]));
  D.bondsByAtom = new Map(); electron.bonds.forEach(b => { if (!D.bondsByAtom.has(b.atom)) D.bondsByAtom.set(b.atom, []); D.bondsByAtom.get(b.atom).push(b.repo); });
  // distinct line numbers and how many families each appears in (one pass, once)
  const cnt = new Map(); for (let i = 0; i < D.N; i++) { const k = D.keys[i]; cnt.set(k, (cnt.get(k) || 0) + 1); }
  D.keyCount = cnt; D.distinct = cnt.size;
  // conduction band order: ELECTRON.md's "## Conduction band" list as shipped in electron.json (amend_pack.mjs), then the alkali by n
  const cond = (electron.conduction_band_electron_md || []).map(c => c.n).filter(n => D.atomByN.has(n) && D.atomByN.get(n).class === 'conductor');
  D.band = cond.concat(electron.atoms.filter(a => a.class === 'alkali').map(a => a.n).sort((a, b) => a - b));
  D.bandNote = `${cond.length} conductors in ELECTRON.md order (${electron.conduction_band_electron_md ? 'shipped in electron.json' : 'not shipped'}), then ${D.band.length - cond.length} alkali by n`;
  // default focus: electron/graph.json focus_default, shipped verbatim (e.g. "#2039 Number"); null when not shipped
  D.focusDefault = soulNum(electron.focus_default || '');
  D.bucketSize = provenance.checks && Number.isInteger(provenance.checks.index_bucket_size) ? provenance.checks.index_bucket_size : null;
  // one-time census facts printed as caveats (computed, not typed)
  D.measurableFamilies = families.filter(f => D.atomByName.has(f.name)).length;
  D.atomsWithM = electron.atoms.filter(a => a.shells && a.shells.M > 0).length;
  D.atomsNoHome = electron.atoms.filter(a => a.shells && a.shells.K + a.shells.L === 0).length;
}

// Layout of the sea: sectors per category, arcs per block (width ∝ blocks[].families), families spread inside their block.
function buildLayout() {
  const { blocks, families } = D;
  const cats = blocks.categories; const catIdx = new Map(cats.map((c, i) => [c.id, i]));
  const blkIdx = new Map(blocks.blocks.map((b, i) => [b.symbol, i]));
  const gap = 0.004; const minArc = 0.002;
  const perCat = cats.map(() => 0); blocks.blocks.forEach(b => { perCat[catIdx.get(b.category)] += b.families; });
  const totalFam = perCat.reduce((a, b) => a + b, 0);
  const usable = 2 * PI - gap * blocks.blocks.length - minArc * blocks.blocks.length;
  const blockAng = new Float32Array(211 * 2); const catAng = [];
  let a = -PI / 2;
  cats.forEach((c, ci) => {
    const catW = usable * perCat[ci] / totalFam; const a0 = a;
    const inCat = blocks.blocks.map((b, i) => [b, i]).filter(([b]) => b.category === c.id);
    inCat.forEach(([b, i]) => { const w = (perCat[ci] ? catW * b.families / perCat[ci] : 0) + minArc; blockAng[i * 2] = a; blockAng[i * 2 + 1] = a + w; a += w + gap; });
    catAng.push([a0, a]);
  });
  blockAng[210 * 2] = -PI / 2; blockAng[210 * 2 + 1] = 3 * PI / 2;
  D.blockAng = blockAng; D.catAng = catAng; D.catIdx = catIdx; D.blkIdx = blkIdx;
  // per-family texture: x angle, y radius (star space, outer ring = 1), z spread, w lineCount
  const tex = new Float32Array(128 * 128 * 4);
  const famBlock = new Uint8Array(families.length), famCat = new Uint8Array(families.length);
  const perBlock = new Map();
  families.forEach((f, i) => { const bi = blkIdx.has(f.block) ? blkIdx.get(f.block) : 210; famBlock[i] = bi; famCat[i] = f.category != null && catIdx.has(f.category) ? catIdx.get(f.category) : 12; if (!perBlock.has(bi)) perBlock.set(bi, []); perBlock.get(bi).push(i); });
  const rin = D.rin;
  perBlock.forEach((list, bi) => {
    list.sort((x, y) => families[x].n - families[y].n);
    const a0 = blockAng[bi * 2], a1 = blockAng[bi * 2 + 1];
    list.forEach((fi, k) => {
      const h = (hash32('fam' + families[fi].n) % 1000) / 1000;
      const ang = a0 + (k + 0.5) / list.length * (a1 - a0);
      const r = bi === 210 ? 1.04 + h * 0.09 : rin + h * (1 - rin) * 0.97;
      tex[fi * 4] = ang; tex[fi * 4 + 1] = r; tex[fi * 4 + 2] = (a1 - a0) / list.length; tex[fi * 4 + 3] = families[fi].lineCount;
    });
  });
  D.famTex = tex; D.famBlock = famBlock; D.famCat = famCat;
  D.offTable = families.filter(f => !blkIdx.has(f.block)).length;
}

function familyPos(fi) { const a = D.famTex[fi * 4], r = D.famTex[fi * 4 + 1]; return [Math.cos(a) * r, Math.sin(a) * r]; }

// ---------- GL setup ----------
let gl, canvas, P = {}, B = {}, VAO = {}, pick = {};
function initGL() {
  canvas = $('#gl');
  gl = canvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: true, preserveDrawingBuffer: true });
  if (!gl) return false;
  P.sea = makeProgram(gl, SEA_VS, SEA_FS); P.pick = makeProgram(gl, SEA_VS, PICK_FS);
  P.gen = makeProgram(gl, GEN_VS, GEN_FS); P.elec = makeProgram(gl, ELEC_VS, ELEC_FS_SRC()); P.bloch = makeProgram(gl, BLOCH_VS, BLOCH_FS);
  // count draw calls
  const da = gl.drawArrays.bind(gl), dai = gl.drawArraysInstanced.bind(gl);
  gl.drawArrays = (...a) => { S.drawCalls++; da(...a); }; gl.drawArraysInstanced = (...a) => { S.drawCalls++; dai(...a); };
  // --- the sea: one interleaved VBO, 12 bytes per entry, uploaded once ---
  const N = D.N; const buf = new ArrayBuffer(N * 12); const dv = new DataView(buf); const u32 = new Uint32Array(buf); const u16 = new Uint16Array(buf); const u8 = new Uint8Array(buf);
  const fams = D.families; let e = 0;
  for (let fi = 0; fi < fams.length; fi++) {
    const f = fams[fi]; const bl = D.famBlock[fi], ct = D.famCat[fi];
    for (let j = 0; j < f.lineCount; j++, e++) {
      const o = e * 12; u32[o >> 2] = D.keys[e]; u16[(o >> 1) + 2] = fi; u16[(o >> 1) + 3] = Math.min(j, 65535);
      u8[o + 8] = bl; u8[o + 9] = ct; u8[o + 10] = (Math.imul(D.keys[e] ^ Math.imul(j + 1, 0x9E3779B1), 0x85EBCA6B) >>> 24) & 255; u8[o + 11] = 0;
    }
  }
  if (e !== N) throw new Error('family lineCounts sum to ' + e + ', lines.bin has ' + N);
  void dv;
  B.sea = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, B.sea); gl.bufferData(gl.ARRAY_BUFFER, buf, gl.STATIC_DRAW);
  const err = gl.getError();
  S.seaBytes = gl.getBufferParameter(gl.ARRAY_BUFFER, gl.BUFFER_SIZE);
  S.seaDrawn = N; S.seaStride = 1;
  if (err === gl.OUT_OF_MEMORY || S.seaBytes !== N * 12) {
    // only if the full allocation fails: every 4th entry (never by guess)
    const sub = new Uint8Array(buf); const q = new Uint8Array(Math.ceil(N / 4) * 12); let m = 0;
    for (let i = 0; i < N; i += 4, m++) q.set(sub.subarray(i * 12, i * 12 + 12), m * 12);
    gl.bufferData(gl.ARRAY_BUFFER, q, gl.STATIC_DRAW); S.seaBytes = gl.getBufferParameter(gl.ARRAY_BUFFER, gl.BUFFER_SIZE); S.seaDrawn = m; S.seaStride = 4; S.phoneMode = 'phone mode: 1 in 4 drawn';
  }
  VAO.sea = gl.createVertexArray(); gl.bindVertexArray(VAO.sea); gl.bindBuffer(gl.ARRAY_BUFFER, B.sea);
  gl.enableVertexAttribArray(0); gl.vertexAttribIPointer(0, 1, gl.UNSIGNED_INT, 12, 0);
  gl.enableVertexAttribArray(1); gl.vertexAttribIPointer(1, 1, gl.UNSIGNED_SHORT, 12, 4);
  gl.enableVertexAttribArray(2); gl.vertexAttribIPointer(2, 1, gl.UNSIGNED_SHORT, 12, 6);
  gl.enableVertexAttribArray(3); gl.vertexAttribIPointer(3, 1, gl.UNSIGNED_BYTE, 12, 8);
  gl.enableVertexAttribArray(4); gl.vertexAttribIPointer(4, 1, gl.UNSIGNED_BYTE, 12, 9);
  gl.enableVertexAttribArray(5); gl.vertexAttribIPointer(5, 1, gl.UNSIGNED_BYTE, 12, 10);
  gl.bindVertexArray(null);
  S.keySum = 0; for (let i = 0; i < N; i++) S.keySum += D.keys[i];
  // family texture
  B.famTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, B.famTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 128, 128, 0, gl.RGBA, gl.FLOAT, D.famTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  // generic buffers (a_p vec2, a_c vec4, a_t, a_f = 8 floats = 32 bytes)
  const genVAO = (buf) => { const v = gl.createVertexArray(); gl.bindVertexArray(v); gl.bindBuffer(gl.ARRAY_BUFFER, buf); const L = (n, sz, off) => { const l = gl.getAttribLocation(P.gen.p, n); if (l < 0) return; gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, sz, gl.FLOAT, false, 32, off); }; L('a_p', 2, 0); L('a_c', 4, 8); L('a_t', 1, 24); L('a_f', 1, 28); gl.bindVertexArray(null); return v; };
  for (const name of ['tether', 'cloud', 'journey', 'atomLines', 'atomDots', 'ring', 'cable']) {
    B[name] = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, B[name]);
    const cap = name === 'journey' ? 4096 : name === 'atomLines' ? 512 : name === 'ring' ? 130 : 64;
    gl.bufferData(gl.ARRAY_BUFFER, cap * 32, gl.DYNAMIC_DRAW); VAO[name] = genVAO(B[name]); B[name + 'N'] = 0;
  }
  // re-prepare ring: 64 segments, a_t = fraction 0..1
  { const a = new Float32Array(128 * 8); for (let i = 0; i < 128; i++) { const t = Math.floor(i / 2) / 64 + (i % 2) / 64; const an = -PI / 2 + t * 2 * PI; a.set([Math.cos(an), Math.sin(an), 0, .9, 1, .8, t, 0], i * 8); } gl.bindBuffer(gl.ARRAY_BUFFER, B.ring); gl.bufferSubData(gl.ARRAY_BUFFER, 0, a); B.ringN = 128; }
  // electrons: 512 vertices (index only); the shell is gl_InstanceID of a 3-instance draw (K, L, M)
  { const a = new Float32Array(512); for (let i = 0; i < 512; i++) a[i] = i; B.elec = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, B.elec); gl.bufferData(gl.ARRAY_BUFFER, a, gl.STATIC_DRAW); VAO.elec = gl.createVertexArray(); gl.bindVertexArray(VAO.elec); const li = gl.getAttribLocation(P.elec.p, 'a_i'); gl.enableVertexAttribArray(li); gl.vertexAttribPointer(li, 1, gl.FLOAT, false, 4, 0); gl.bindVertexArray(null); }
  // Bloch wireframe: 2 great circles × 36 segments (equator, meridian) + axis
  { const v = []; const seg = 36; for (let i = 0; i < seg; i++) { const a0 = i / seg * 2 * PI, a1 = (i + 1) / seg * 2 * PI; v.push(Math.cos(a0), Math.sin(a0), 0, Math.cos(a1), Math.sin(a1), 0); v.push(Math.cos(a0), 0, Math.sin(a0), Math.cos(a1), 0, Math.sin(a1)); } v.push(0, 0, -1.15, 0, 0, 1.15); B.wireN = v.length / 3; B.wire = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, B.wire); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW); VAO.wire = gl.createVertexArray(); gl.bindVertexArray(VAO.wire); const l = gl.getAttribLocation(P.bloch.p, 'a_p'); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 3, gl.FLOAT, false, 0, 0); gl.bindVertexArray(null);
    B.state = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, B.state); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 0, 1, 0, 0, 1, 0, 0]), gl.STATIC_DRAW); VAO.state = gl.createVertexArray(); gl.bindVertexArray(VAO.state); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 3, gl.FLOAT, false, 0, 0); gl.bindVertexArray(null); }
  // pick framebuffer (RG32UI: key, family+1)
  pick.tex = gl.createTexture(); pick.fbo = gl.createFramebuffer();
  gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  return true;
}
function ELEC_FS_SRC() { return `#version 300 es
precision mediump float; in vec4 v_c; out vec4 o; void main(){ float r=length(gl_PointCoord-0.5)*2.0; float a=v_c.a*(1.0-smoothstep(0.5,1.0,r)); o=vec4(v_c.rgb*a,a); }`; }

// ---------- geometry of the stage ----------
const G = {}; // W,H,c0,c1,R,rin,sphereR,pal
function resize() {
  const rect = canvas.getBoundingClientRect(); const W = Math.max(1, Math.round(rect.width * DPR)), H = Math.max(1, Math.round(rect.height * DPR));
  if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; if (pick.tex) { gl.bindTexture(gl.TEXTURE_2D, pick.tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32UI, W, H, 0, gl.RG_INTEGER, gl.UNSIGNED_INT, null); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); gl.bindFramebuffer(gl.FRAMEBUFFER, pick.fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, pick.tex, 0); pick.ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE; gl.bindFramebuffer(gl.FRAMEBUFFER, null); } }
  G.W = W; G.H = H; G.cssW = rect.width; G.cssH = rect.height;
  if (PHONE) { G.c0 = [W / 2, H / 4]; G.c1 = [W / 2, 3 * H / 4]; G.avail = Math.min(W, H / 2.2); G.R = G.avail * 0.40; } else { G.c0 = [W * 0.30, H / 2]; G.c1 = [W * 0.76, H / 2]; G.avail = Math.min(W / 2, H); G.R = G.avail * 0.37; }
  G.sphereR = (PHONE ? 60 : 90) * DPR;
  const innerPx = Math.max(G.sphereR * 1.95, G.R * 0.42); G.rin = Math.min(0.7, innerPx / G.R);
  if (D.rin !== G.rin) { D.rin = G.rin; buildLayout(); if (B.famTex) { gl.bindTexture(gl.TEXTURE_2D, B.famTex); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 128, 128, gl.RGBA, gl.FLOAT, D.famTex); } }
  G.spiral = 0.04 / Math.sqrt(D.maxLC || 1);
  const h = $('#sphereHandle'); const r = G.sphereR / DPR; h.style.left = (G.c0[0] / DPR - r) + 'px'; h.style.top = (G.c0[1] / DPR - r) + 'px'; h.style.width = h.style.height = (2 * r) + 'px';
  placeLabels();
}

// ---------- focus, qubit, twin ----------
function atomTheta(a) { const K = a.shells.K, L = a.shells.L, M = a.shells.M, T = K + L + M; if (T === 0) return NaN; return 2 * Math.asin(Math.sqrt(M / T)); }
function setFocus({ famIdx, atom, key, note }, keepTwin) {
  S.famJoinNote = note || ''; S.lastQuery = '';
  if (famIdx != null && famIdx >= 0 && atom === undefined) {
    const f = D.families[famIdx]; const list = D.atomByName.get(f.name) || [];
    if (list.length === 1) { atom = list[0]; S.famJoinNote = `atom joined by name only (soul numbers and family keys are different numberings)`; }
    else if (list.length > 1) { atom = list[0]; S.famJoinNote = `${list.length} atoms carry the name "${f.name}"; showing soul #${atom.n} (first by record order); joined by name only`; }
    else atom = null;
  }
  if (atom && (famIdx == null || famIdx < 0)) {
    const list = D.famByName.get(atom.name) || [];
    if (list.length) { famIdx = list[0]; S.famJoinNote = `family joined by name only: ${list.length === 1 ? 'one family' : list.length + ' families'} named "${atom.name}", showing family #${D.families[famIdx].n}` + (list.length > 1 ? ' (first by key)' : ''); }
    else { famIdx = -1; S.famJoinNote = `no family in families.json carries the name "${atom.name}": the sea has nothing to highlight`; }
  }
  S.famIdx = famIdx == null ? -1 : famIdx; S.atom = atom || null; S.key = key || 0;
  S.outcome = -1; S.collapse = null; S.reprepareAt = 0; S.hand = null; S.relaxFrom = null; S.cable = null; S.litRepo = null; S.measuredTheta = null;
  if (S.atom) { const th = atomTheta(S.atom); S.dataTheta = isNaN(th) ? 0 : th; S.theta = S.dataTheta; S.phi = 0; } else { S.dataTheta = 0; S.theta = 0; S.phi = 0; }
  if (!keepTwin) { S.tetherDissolved = false; S.twinNote = ''; buildTwin(); }
  buildAtomGeometry(); placeLabels(); renderLinesPanel(); S.lastActivity = performance.now(); updateHUD(true);
}

function buildTwin() {
  const a = S.atom; const cands = []; let tier = '', tierLabel = '', kind = 'CHANCE', soulEdge = null;
  if (a && D.entByN.has(a.n)) {
    // conditional rule, printed as used: on TUNNEL the twin is the defining repository (q=1); on HOME one of the called_from repositories, 1/N each
    const e = D.entByN.get(a.n); tier = 'SOUL'; kind = 'SOUL'; S.soulDef = e.defined_in; const defRepo = e.defined_in.split('/')[0];
    tierLabel = `SOUL entanglement (${D.entangled.soul_md.entanglements_listed} listed of ${D.entangled.soul_md.entanglements_stated} stated) · rule: on TUNNEL the twin is the defining repository ${defRepo} (q=1); on HOME one of the ${e.called_from.length} called_from repositories (1/${e.called_from.length} each, index drawn with a printed r)`;
    cands.push({ label: 'repo ' + defRepo + ' (on TUNNEL)', repo: defRepo, q: 1, kind: 'SOUL', cond: 'TUNNEL' });
    e.called_from.forEach(r => cands.push({ label: 'repo ' + r + ' (on HOME)', repo: r, q: 1 / e.called_from.length, kind: 'SOUL', cond: 'HOME' }));
  } else if (a) {
    const edges = D.random.edges.filter(ed => soulNum(ed.from) === a.n || soulNum(ed.to) === a.n);
    if (edges.length) {
      tier = 'RANDOM'; const maker = edges.filter(ed => ed.p != null);
      const use = maker.length ? maker : edges; const sum = use.reduce((s, ed) => s + (ed.p != null ? ed.p : 1), 0);
      use.forEach(ed => { const other = soulNum(ed.from) === a.n ? ed.to : ed.from; const w = ed.p != null ? ed.p : 1; cands.push({ label: other, repo: /^repo /.test(other) ? other.slice(5) : null, soul: soulNum(other), name: soulName(other), q: w / sum, kind: ed.kind, p: ed.p, src: ed.src }); });
      tierLabel = maker.length ? `Random star edges (maker draw, seed ${D.random.sources.find(s => s.src === 'maker').seed}): published p, renormalised to sum to 1 (classical weights q=p/Σp)` : `Random star edges (stars draw, seed ${D.random.sources.find(s => s.src === 'stars').seed}): p not published for this draw: uniform`;
      const em = use.find(ed => ed.kind === 'ENTANGLED_MAYBE' && ed.p != null); if (em) soulEdge = em;
      kind = use[0].kind;
    } else if (a.valence_repos && a.valence_repos.length) {
      tier = 'VALENCE'; kind = 'VALENCE'; tierLabel = `M shell: ${a.valence} repositories call it without holding a copy, 1/${a.valence} each (K${a.shells.K} L${a.shells.L} M${a.shells.M})`;
      a.valence_repos.forEach(r => cands.push({ label: 'repo ' + r, repo: r, q: 1 / a.valence, kind: 'VALENCE' }));
    }
  }
  if (!cands.length) { tier = 'CHANCE'; kind = 'CHANCE'; tierLabel = a ? 'no link, no valence: twin is pure chance' : 'no electron record: twin is pure chance'; }
  S.twin = { tier, tierLabel, cands: cands.slice(0, 8), all: cands, kind, soulEdge, chosen: null };
  // sample up to 8 candidates for the cloud; positions: mirror of the focused family's position, or the centre when there is none
  const base = S.famIdx >= 0 ? familyPos(S.famIdx).map(v => -v) : [0, 0];
  const cloud = new Float32Array(8 * 8); let n = 0;
  S.twin.cands.forEach((c, i) => { const col = KINDCOL[c.kind] || KINDCOL.CHANCE; cloud.set([base[0], base[1], col[0], col[1], col[2], Math.max(0.05, c.q), (hash32('cloud' + i + (S.atom ? S.atom.n : 0)) % 1000) / 1000, 1], n * 8); n++; });
  if (tier === 'CHANCE') { // pure chance: one grey point whose orbit is wide
    cloud.set([base[0], base[1], .5, .5, .5, 0.05, 0.37, 1], 0); n = 1;
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, B.cloud); gl.bufferSubData(gl.ARRAY_BUFFER, 0, cloud); B.cloudN = n;
  // twin highlights on the twin star: a candidate that is a soul with a family of the same name, or a line key
  S.twinKey = 0; S.twinFamily = 0xFFFF;
  const withFam = S.twin.cands.find(c => c.name && D.famByName.has(c.name)); if (withFam) S.twinFamily = D.famByName.get(withFam.name)[0];
  buildTether(base);
}
function buildTether(base) {
  const cands = S.twin.cands; const arr = new Float32Array(16 * 8); let n = 0;
  const p0 = S.famIdx >= 0 ? familyPos(S.famIdx) : [0, 0];
  const lenPx = Math.hypot(G.c1[0] - G.c0[0], G.c1[1] - G.c0[1]) + 2 * G.R;
  const m = Math.max(1, Math.min(cands.length, 8));
  for (let i = 0; i < m; i++) { const c = cands[i] || { kind: 'CHANCE', q: 1 }; const col = KINDCOL[c.kind] || KINDCOL.CHANCE; const a = 0.25 + 0.6 * (c.q || 0); arr.set([p0[0], p0[1], col[0], col[1], col[2], a, 0, 0], n * 8); n++; arr.set([base[0], base[1], col[0], col[1], col[2], a, lenPx, 1], n * 8); n++; }
  gl.bindBuffer(gl.ARRAY_BUFFER, B.tether); gl.bufferSubData(gl.ARRAY_BUFFER, 0, arr); B.tetherN = n;
}

// atom geometry (nucleus, repo ring, bonds, spin arrows, dials): rebuilt on re-target only
function buildAtomGeometry() {
  const a = S.atom; const lines = []; const dots = []; const r = G.sphereR;
  const repoAngle = i => PI * 0.55 + (i / (D.electron.repos.length - 1)) * PI * 0.9; // an arc below the sphere
  const repoR = r * 1.6;
  const catCol = () => { const c = S.famIdx >= 0 ? D.famCat[S.famIdx] : 12; return G.pal[Math.min(c, 12)]; };
  // repo dots: white = the chosen twin's repository; red-orange = the one valence repository lit by a TUNNEL outcome (S.litRepo, monogamy);
  // amber = a bonded repository (electron.json.bonds); after HOME all bond dots are dimmed; grey = the rest
  const homeDim = S.outcome === 0;
  D.electron.repos.forEach((rp, i) => { const an = repoAngle(i); const bonded = a && (D.bondsByAtom.get(a.n) || []).includes(rp.repo); const tw = S.twin && S.twin.chosen && S.twin.chosen.repo === rp.repo; const lit = S.litRepo === rp.repo; const c = tw ? [1, 1, 1, 1] : lit ? [1, .45, .2, 1] : bonded ? [1, .83, .29, homeDim ? 0.25 : 0.95] : [.35, .4, .5, .6]; dots.push([Math.cos(an) * repoR, Math.sin(an) * repoR, ...c, 0, 0]); if (lit) { const m = r * 1.25; lines.push([Math.cos(an) * m, Math.sin(an) * m, 1, .45, .2, 1, 0, 0], [Math.cos(an) * repoR, Math.sin(an) * repoR, 1, .45, .2, 1, 0, 0]); } });
  if (a) {
    const cc = catCol(); dots.push([0, 0, cc[0], cc[1], cc[2], 1, 0, 0]); // nucleus at the sphere centre
    const bonds = D.bondsByAtom.get(a.n) || []; const trem = a.class === 'alkali' ? 1 : 0;
    bonds.forEach(rp => { const i = D.repoIdx.get(rp); if (i == null) return; const an = repoAngle(i); const m = r * 1.25; const col = trem ? [1, .3, .3, .9] : [1, .83, .29, .55]; lines.push([Math.cos(an) * m, Math.sin(an) * m, ...col, 0, trem], [Math.cos(an) * repoR, Math.sin(an) * repoR, ...col, 0, trem]); });
    if (S.twin && S.twin.tier === 'SOUL') { (D.entByN.get(a.n).called_from).forEach(rp => { const i = D.repoIdx.get(rp); if (i == null) return; const an = repoAngle(i); lines.push([Math.cos(an) * repoR - 6 * DPR, Math.sin(an) * repoR, 0, .9, 1, .8, 0, 0], [Math.cos(an) * repoR + 6 * DPR, Math.sin(an) * repoR, 0, .9, 1, .8, 0, 0]); }); }
    // spin arrows: paired two opposed, unpaired one
    const sx = r * 1.42, sy = -r * 1.1; const arrow = (x, y, dir, col) => { lines.push([x, y - 10 * DPR * dir, ...col, 0, 0], [x, y + 10 * DPR * dir, ...col, 0, 0], [x, y + 10 * DPR * dir, ...col, 0, 0], [x - 4 * DPR, y + 5 * DPR * dir, ...col, 0, 0], [x, y + 10 * DPR * dir, ...col, 0, 0], [x + 4 * DPR, y + 5 * DPR * dir, ...col, 0, 0]); };
    if (a.spin === 'paired') { arrow(sx - 5 * DPR, sy, -1, [0, .9, 1, .9]); arrow(sx + 5 * DPR, sy, 1, [0, .9, 1, .9]); } else arrow(sx, sy, -1, [1, .83, .29, 1]);
  }
  const L = new Float32Array(512 * 8); lines.slice(0, 512).forEach((v, i) => L.set(v, i * 8)); gl.bindBuffer(gl.ARRAY_BUFFER, B.atomLines); gl.bufferSubData(gl.ARRAY_BUFFER, 0, L); B.atomLinesN = Math.min(lines.length, 512);
  const Dd = new Float32Array(64 * 8); dots.slice(0, 64).forEach((v, i) => Dd.set(v, i * 8)); gl.bindBuffer(gl.ARRAY_BUFFER, B.atomDots); gl.bufferSubData(gl.ARRAY_BUFFER, 0, Dd); B.atomDotsN = Math.min(dots.length, 64);
  S.nucleusSize = a ? Math.min(10, Math.max(2, Math.log2(Math.max(1, a.lines)) + 2)) : 0;
  const mx = a ? Math.max(a.shells.K, a.shells.L, a.shells.M) : 0; S.elecStride = mx > 512 ? Math.ceil(mx / 512) : 1; // per shell: 512 vertices per ring
}

// DOM labels: at most 12, updated on re-target/resize only
function placeLabels() {
  const box = $('#labels'); box.textContent = ''; const items = [];
  const c0 = G.c0.map(v => v / DPR), c1 = G.c1.map(v => v / DPR), r = G.sphereR / DPR, R = G.R / DPR;
  const add = (x, y, text, cls) => { if (items.length >= 12) return; items.push(1); const d = document.createElement('div'); d.className = 'lb ' + (cls || ''); d.style.left = x + 'px'; d.style.top = y + 'px'; d.textContent = text; box.appendChild(d); };
  add(c0[0], c0[1] - r - 12, '|0> HOME'); add(c0[0], c0[1] + r + 12, '|1> TUNNEL', 'amber');
  const a = S.atom;
  // on desktop the atom badge starts at the sphere's left edge (class "left": no centring) so the HUD in the top-left corner does not cover it; on a phone the HUD sits below the canvas, so labels are centred
  const bx = PHONE ? c0[0] : c0[0] - r, bl = PHONE ? '' : ' left';
  if (a) {
    add(bx, c0[1] - r * 1.25 - 26, `#${a.n} ${a.name} · ${a.kind} · ${a.lines} lines · homes ${a.homes.join(', ')}`, 'badge' + bl);
    add(c0[0] + r * 0.55, c0[1] + 6, 'K same dir', 'dim'); add(c0[0] + r * 0.85 + 22, c0[1] - 8, 'L same repo', 'dim'); add(c0[0], c0[1] + r * 1.25 + 14, 'M other repos (valence)', 'dim');
    const cl = D.electron.totals.classes_electron_md; add(c0[0] + r * 1.42, c0[1] - r * 1.1 - 18, `class ${a.class} (${fmt(cl[a.class] != null ? cl[a.class] : '?')} in ELECTRON.md)`, 'badge');
    if (S.elecStride > 1) add(bx, c0[1] + r * 1.25 + 30, `1 in ${S.elecStride} electrons drawn`, 'dim' + bl);
    if (a.spin === 'unpaired' && (D.bondsByAtom.get(a.n) || []).length) add(bx, c0[1] + r * 1.6 + 16, 'unpaired and bonded across repos: no test guards this tunnel', 'red' + bl);
    else if (a.class === 'alkali') add(bx, c0[1] + r * 1.6 + 16, 'one bond: breaks if the home changes', 'red' + bl);
  } else if (S.famIdx >= 0) add(bx, c0[1] - r * 1.25 - 26, `family #${D.families[S.famIdx].n} ${D.families[S.famIdx].name}: no electron record`, 'badge' + bl);
  add(c1[0], c1[1] + (PHONE ? -1 : 1) * (R * 1.15 + 10), 'twin star: the same points at angle + π. In a real singlet, up along n here means down along n there; here the twin is a mirror, not a second qubit.', 'dim wrap'); // above the twin on a phone (the HUD sits below the canvas there)
  add((c0[0] + c1[0]) / 2, (c0[1] + c1[1]) / 2 + (PHONE ? -30 : 14), 'the dashes drift, nothing rides them', 'dim');
  // off-table label: below the principal star on desktop, starting right of the HUD column; above it on a phone (centred)
  if (PHONE) add(c0[0], c0[1] - (R * 1.15 + 10), `off table (${fmt(D.blocks.symbols_off_table.length)} symbols, ${fmt(D.offTable)} families): grey outer band`, 'dim wrap');
  else add(c0[0] - R * 0.3, c0[1] + R * 1.15 + 10, `off table (${fmt(D.blocks.symbols_off_table.length)} symbols, ${fmt(D.offTable)} families): grey outer band`, 'dim wrap left');
}

// ---------- measurement ----------
// Model: a real projective collapse. After a measurement the state IS the pole (θ = 0 or π, φ kept); a repeat measurement inside the
// window compares r against P(tunnel) = 0 or 1 and so reproduces the outcome with certainty; re-preparation (the 8 s ring, or the
// button) restores θ to the data value. Only measurements made on the prepared data state are counted in the histogram.
const deg = t => (t * 180 / PI).toFixed(1);
function reprepare(note) {
  S.collapse = null; S.outcome = -1; S.collapseT = 0; S.reprepareAt = 0; S.litRepo = null; S.measuredTheta = null; S.hand = null; S.relaxFrom = null;
  S.theta = S.dataTheta; S.tetherDissolved = true; buildTwin(); buildAtomGeometry();
  S.twinNote = note || 're-prepared: θ back to the data value, cloud re-expanded, shells restored'; S.lastActivity = performance.now(); updateHUD(true);
}
function measure() {
  const a = S.atom; S.lastActivity = performance.now();
  if (!a) { S.msg = `nothing to measure: no electron record for this focus (${fmt(D.electron.totals.atoms_shipped)} of ${fmt(D.electron.totals.atoms_in_star)} atoms carry records)`; updateHUD(true); return; }
  const T = a.shells.K + a.shells.L + a.shells.M; if (T === 0) { S.msg = 'no electrons: nothing to measure'; updateHUD(true); return; }
  const collapsed = S.outcome >= 0 && !!S.collapse;
  const h = S.hist.get(a.n) || { n: 0, home: 0, tunnel: 0, skipped: 0 }; S.hist.set(a.n, h);
  const count = h.n + h.skipped; // every draw advances the seed, counted or not
  const seed = hash32(S.seedString + '|' + a.n + '|' + count); const rng = mulberry32(seed);
  const theta = S.hand ? S.hand.theta : S.theta; const pT = Math.sin(theta / 2) ** 2;
  const r = rng(); const outcome = r < pT ? 1 : 0;
  const prepared = !collapsed && !S.hand && !S.relaxFrom && Math.abs(theta - S.dataTheta) < 1e-9;
  const how = collapsed ? 'repeat on the collapsed state, not counted' : S.hand ? 'prepared by hand, not counted' : S.relaxFrom ? 'during relaxation, θ≠data, not counted' : 'prepared data state, counted';
  if (prepared) { h.n++; if (outcome) h.tunnel++; else h.home++; } else h.skipped++;
  if (collapsed) {
    S.born = `repeat measurement #${a.n} ${a.name}: ${outcome ? 'TUNNEL' : 'HOME'} again · r=${r.toFixed(3)} ${outcome ? '<' : '≥'} P(tunnel)=${pT.toFixed(3)} (certain: the state sits at the pole until re-prepared) · seed ${seed} = hash("${S.seedString}", ${a.n}, ${count})`;
    S.flashAt = performance.now(); updateHUD(true); return;
  }
  let born = `measured #${a.n} ${a.name}: ${outcome ? 'TUNNEL' : 'HOME'} · r=${r.toFixed(3)} ${outcome ? '<' : '≥'} sin²(θ/2)=${pT.toFixed(3)} at θ=${deg(theta)}° (${how}) · seed ${seed} = hash("${S.seedString}", ${a.n}, ${count})`;
  S.measuredTheta = theta; S.measuredHow = how; if (S.hand) S.phi = S.hand.phi;
  S.theta = outcome ? PI : 0; // projective collapse: the state is now the pole; φ is kept
  S.outcome = outcome; S.collapse = performance.now(); S.flashAt = S.collapse; S.hand = null; S.relaxFrom = null; S.reprepareAt = performance.now() + 8000;
  if (S.twin && S.twin.chosen) { S.msg = 'earlier pair dissolved: one twin per measurement'; }
  // stage 2: the twin, same frame, from the stated distribution
  const tw = S.twin; let chosen = null, twinNote = '';
  if (tw.tier === 'SOUL') {
    if (outcome) { chosen = tw.all.find(c => c.cond === 'TUNNEL'); twinNote = `twin fixed by SOUL entanglement: TUNNEL → tunnelled from ${S.soulDef} (q=1, no draw)`; }
    else { const list = tw.all.filter(c => c.cond === 'HOME'); const r2 = rng(); const i = Math.floor(r2 * list.length); chosen = list[i]; twinNote = `twin fixed by SOUL entanglement: HOME → local copy or dead · called_from index ${i} of ${list.length} drawn with r=${r2.toFixed(3)} → ${chosen.label} (1/${list.length})`; }
  }
  else if (tw.tier === 'CHANCE') { const i = Math.floor(rng() * D.N); const k = D.keys[i]; let fi = 0; { let lo = 0, hi = D.families.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (D.families[m].lineOffset <= i) lo = m; else hi = m - 1; } fi = lo; } chosen = { label: `line #${k} in family #${D.families[fi].n} ${D.families[fi].name}`, key: k, famIdx: fi, kind: 'CHANCE', q: 1 / D.N }; twinNote = `twin drew uniformly over ${fmt(D.N)} entries: ${chosen.label}`; }
  else {
    const r2 = rng(); const em = tw.soulEdge; const partner = em ? tw.all.find(c => c.kind === 'ENTANGLED_MAYBE' && c.p === em.p) : null;
    if (em && r2 < em.p) { chosen = partner; twinNote = `twin fixed by ENTANGLED_MAYBE (p=${em.p}) · r=${r2.toFixed(3)} < p`; }
    else { const r3 = em ? rng() : r2; let acc = 0; chosen = tw.all[tw.all.length - 1]; for (const c of tw.all) { acc += c.q; if (r3 < acc) { chosen = c; break; } } twinNote = (em ? `twin drew independently (1−p, r=${r2.toFixed(3)} ≥ ${em.p}) · ` : 'twin drew from q · ') + `${chosen.label} q=${chosen.q.toFixed(3)} r=${r3.toFixed(3)}`; }
    if (em && partner) twinNote += ` · effective P(partner)=p+(1−p)·q=${(em.p + (1 - em.p) * partner.q).toFixed(3)} (the independent draw still includes the partner)`;
  }
  tw.chosen = chosen; S.twinNote = twinNote;
  S.twinKey = chosen && chosen.key ? chosen.key : 0; S.twinFamily = chosen && chosen.famIdx != null ? chosen.famIdx : (chosen && chosen.name && D.famByName.has(chosen.name) ? D.famByName.get(chosen.name)[0] : 0xFFFF);
  // monogamy: TUNNEL lights exactly one valence repo with probability 1/valence; HOME dims all bond dots
  S.litRepo = null;
  if (outcome && a.valence_repos && a.valence_repos.length) { const r4 = rng(); const i = Math.floor(r4 * a.valence_repos.length); S.litRepo = a.valence_repos[i]; born += ` · TUNNEL lit valence repo ${S.litRepo} (index ${i} of ${a.valence_repos.length}, 1/${a.valence_repos.length}, r=${r4.toFixed(3)})`; }
  else if (outcome) born += ' · no valence_repos listed: no repo lit';
  else born += ' · HOME: all bond dots dimmed';
  S.born = born;
  buildAtomGeometry(); buildTwinPost();
  // journey: one vertex per collapse (cap 4096), plus the record strip
  const p = S.famIdx >= 0 ? familyPos(S.famIdx) : [0, 0]; const n = B.journeyN; if (n < 4096) { const prev = S.journeyLast || p; S.journeyLen = (S.journeyLen || 0) + Math.hypot(p[0] - prev[0], p[1] - prev[1]) * G.R; gl.bindBuffer(gl.ARRAY_BUFFER, B.journey); gl.bufferSubData(gl.ARRAY_BUFFER, n * 32, new Float32Array([p[0], p[1], outcome ? 1 : 0, outcome ? .83 : .9, outcome ? .29 : 1, .9, S.journeyLen, 0])); B.journeyN = n + 1; S.journeyLast = p; }
  if (S.measurements.length < 4096) { const m = { i: S.measurements.length + 1, n: a.n, name: a.name, outcome, famIdx: S.famIdx }; S.measurements.push(m); appendRecord(m); }
  // the classical cable is opt-in: no automatic external request unless the "cable" toggle is on (then at most one fetch per bucket, cached)
  if (S.cableOn) setTimeout(cableFetch, 400); else S.cableNote = 'cable off: nothing fetched after this measurement (turn "cable" on to fetch the family record from the URL in provenance.json, at most once per bucket)';
  updateHUD(true);
}
function buildTwinPost() { // repo twin lights the repo dot; key twins spark on the twin star (uniforms already set)
  const ch = S.twin.chosen; if (!ch) return;
  const base = S.famIdx >= 0 ? familyPos(S.famIdx).map(v => -v) : [0, 0]; const col = KINDCOL[ch.kind] || KINDCOL.CHANCE;
  const cloud = new Float32Array(8); cloud.set([ch.famIdx != null ? -familyPos(ch.famIdx)[0] : base[0], ch.famIdx != null ? -familyPos(ch.famIdx)[1] : base[1], col[0], col[1], col[2], 1, 0, 1]);
  gl.bindBuffer(gl.ARRAY_BUFFER, B.cloud); gl.bufferSubData(gl.ARRAY_BUFFER, 0, cloud); B.cloudN = 1;
  const p0 = S.famIdx >= 0 ? familyPos(S.famIdx) : [0, 0]; const t = new Float32Array(16); const lenPx = Math.hypot(G.c1[0] - G.c0[0], G.c1[1] - G.c0[1]);
  t.set([p0[0], p0[1], col[0], col[1], col[2], .9, 0, 0, cloud[0], cloud[1], col[0], col[1], col[2], .9, lenPx, 1]); gl.bindBuffer(gl.ARRAY_BUFFER, B.tether); gl.bufferSubData(gl.ARRAY_BUFFER, 0, t); B.tetherN = 2;
}
// bucket JSON: fetched at most once per bucket for the life of the page; the received bytes are hashed and compared with provenance.sources[].sha256
const bucketCache = new Map();
const hexOf = buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
function bucketOf(n) { return D.bucketSize ? Math.floor(n / D.bucketSize) : null; }
function getBucket(bucket) {
  if (bucketCache.has(bucket)) return bucketCache.get(bucket).then(b => ({ ...b, cached: true }));
  const src = D.provenance.sources.find(s => s.url.endsWith(`/code/f/${bucket}.json`)); if (!src) return Promise.reject(new Error(`bucket ${bucket} is not in provenance.json: no fetch`));
  const p = (async () => {
    const t0 = performance.now(); const r = await fetch(src.url, { cache: 'no-cache' }); if (!r.ok) throw new Error(`HTTP ${r.status} for ${src.url}`);
    const buf = await r.arrayBuffer(); const ms = Math.round(performance.now() - t0);
    let sha = null; try { sha = hexOf(await crypto.subtle.digest('SHA-256', buf)); } catch (e) { sha = null; }
    const json = JSON.parse(new TextDecoder().decode(buf));
    return { json, ms, bytes: buf.byteLength, sha, match: sha === src.sha256, src, cached: false };
  })();
  bucketCache.set(bucket, p); p.catch(() => bucketCache.delete(bucket)); return p;
}
const shaNote = b => b.sha ? (b.match ? `sha256 matches provenance (pack fetch ${b.src.fetched_utc})` : `sha256 MISMATCH: live ${b.sha.slice(0, 12)}… vs pack ${b.src.sha256.slice(0, 12)}… (fetched ${b.src.fetched_utc})`) : 'sha256 unavailable in this browser';
async function cableFetch() {
  if (S.famIdx < 0) { S.cableNote = 'no family key for this soul: nothing to fetch down the cable'; updateHUD(true); return; }
  const f = D.families[S.famIdx]; const bucket = bucketOf(f.n);
  if (bucket == null) { S.cableNote = 'bucket size not shipped in provenance.json: no fetch'; updateHUD(true); return; }
  const src = D.provenance.sources.find(s => s.url.endsWith(`/code/f/${bucket}.json`));
  if (!src) { S.cableNote = `bucket ${bucket} is not in provenance.json: no fetch`; updateHUD(true); return; }
  const had = bucketCache.has(bucket);
  S.cable = { t0: performance.now(), done: false }; S.cableNote = had ? `bucket ${bucket} already fetched by this page: reading the cached record` : `fetching ${src.url} …`; updateHUD(true);
  try {
    const b = await getBucket(bucket); const rec = b.json[String(f.n)];
    S.cableNote = rec ? `live bucket ${bucket}: #${rec.n} ${rec.names[0]} · ${fmt(rec.lines.length)} lines · ${rec.repos.length} repos · ${b.cached ? 'from this page\'s cache (fetched once, ' + b.ms + ' ms then)' : 'came down the cable in ' + b.ms + ' ms'} · ${fmt(b.bytes)} bytes · ${shaNote(b)} · the collapse is a 120 ms animation; the record came down the cable in ${b.ms} ms · no information travelled by entanglement` : `live bucket ${bucket} has no record for #${f.n} (${b.ms} ms)`;
    S.liveRec = rec ? { n: f.n, rec } : null; S.cable.done = true; renderLinesPanel();
  } catch (e) { S.cableNote = 'cable fetch failed: ' + e.message; S.cable.done = true; }
  updateHUD(true);
}

// ---------- lines panel (family keys from lines.bin; line text only on demand from GitHub at the pinned commit) ----------
function el(tag, cls, text) { const d = document.createElement(tag); if (cls) d.className = cls; if (text != null) d.textContent = text; return d; }
function renderLinesPanel() {
  const box = $('#lines'); if (S.famIdx < 0) { box.hidden = true; return; } box.hidden = false; box.textContent = '';
  const f = D.families[S.famIdx]; const keys = Array.from(D.keys.subarray(f.lineOffset, f.lineOffset + f.lineCount));
  const h = el('div'); h.appendChild(el('span', 'u-h', `#${f.n} ${f.name}`)); h.appendChild(document.createTextNode(' '));
  h.appendChild(el('span', 'u-muted', `${f.kind} · ${fmt(f.lineCount)} numbered lines · in ${f.repos} repositories · ${f.files} files · ${f.standalone ? 'self-contained' : 'needs context'} · block ${f.block}${f.category ? ' (' + f.category + ')' : ' (off table)'}`)); box.appendChild(h);
  const links = el('div'); const a1 = el('a', 'u-chip', 'Function page ↗'); a1.href = D.provenance.stars_base + 'code.html?family=' + f.n; a1.target = '_blank'; a1.rel = 'noopener'; links.appendChild(a1);
  if (D.blkIdx.has(f.block)) { const a2 = el('a', 'u-chip', 'Block page ↗'); a2.href = D.provenance.stars_base + 'table.html?block=' + f.block; a2.target = '_blank'; a2.rel = 'noopener'; links.appendChild(a2); }
  const b = el('button', 'u-chip', 'fetch line text (classical, GitHub at the pinned commit)'); b.onclick = () => fetchLineText(f, keys, code); links.appendChild(b); box.appendChild(links);
  const code = el('div', 'u-code'); box.appendChild(code);
  let shown = 0; const page = 200; const more = el('button', 'u-chip');
  const show = () => { const end = Math.min(keys.length, shown + page); for (let i = shown; i < end; i++) { const d = el('div', 'u-line'); d.appendChild(el('span', 'u-key', String(keys[i]))); d.appendChild(document.createTextNode(' │ ')); d.appendChild(el('span', 'u-muted', `appears in ${fmt(D.keyCount.get(keys[i]))} families`)); code.appendChild(d); } shown = end; more.textContent = `show ${Math.min(page, keys.length - shown)} more (${fmt(keys.length - shown)} left)`; more.hidden = shown >= keys.length; };
  more.onclick = show; show(); box.appendChild(more);
}
async function fetchLineText(f, keys, code) {
  const bucket = bucketOf(f.n); const note = el('div', 'u-muted'); code.prepend(note);
  if (bucket == null) { note.textContent = 'bucket size not shipped in provenance.json: no fetch'; return; }
  try {
    note.textContent = 'fetching the family record (bucket JSON, once per bucket) …'; const b = await getBucket(bucket); const rec = b.json[String(f.n)];
    if (!rec || !rec.places || !rec.places.length) { note.textContent = '(source not yet known: no place recorded)'; return; }
    const pl = rec.places[0]; const raw = `https://raw.githubusercontent.com/${pl.repo}/${pl.commit}/${pl.path.split('/').map(encodeURIComponent).join('/')}`;
    note.textContent = `fetching ${raw} …`; const t0 = performance.now(); const rr = await fetch(raw, { cache: 'no-cache' }); if (!rr.ok) throw new Error(`HTTP ${rr.status}`); const txt = await rr.text(); const ms = Math.round(performance.now() - t0);
    const lines = txt.split('\n').slice(pl.first - 1, pl.last); code.querySelectorAll('.u-line').forEach(x => x.remove());
    rec.lines.forEach((k, i) => { const d = el('div', 'u-line'); d.appendChild(el('span', 'u-key', String(k))); d.appendChild(document.createTextNode(' │ ' + (lines[i] != null ? lines[i] : '(line not in the fetched range)'))); code.appendChild(d); });
    note.textContent = `came down the cable in ${ms} ms from `; const a = el('a', '', `${pl.repo}@${pl.commit.slice(0, 7)} ${pl.path} L${pl.first}-L${pl.last}`);
    a.href = `https://github.com/${pl.repo}/blob/${pl.commit}/${pl.path}#L${pl.first}-L${pl.last}`; a.target = '_blank'; a.rel = 'noopener'; note.appendChild(a);
    note.appendChild(document.createTextNode(` · bucket ${bucket}: ${shaNote(b)} · no information travelled by entanglement`));
  } catch (e) { note.textContent = `The code could not be fetched (${e.message}); the line keys are shown above.`; }
}
const RECORD_DOM_CAP = 200; // chips kept in the DOM (the journey buffer keeps up to 4,096 vertices; S.measurements keeps every record)
function appendRecord(m) {
  const box = $('#record'); if (S.measurements.length === 1) box.textContent = '';
  const c = el('button', 'u-chip', `${m.i} #${m.n} ${m.name} ${m.outcome ? 'TUNNEL' : 'HOME'}`); c.title = 're-steer (does not measure)';
  c.onclick = () => { setFocus({ atom: D.atomByN.get(m.n), famIdx: m.famIdx }); }; box.appendChild(c);
  const chips = box.querySelectorAll('button'); if (chips.length > RECORD_DOM_CAP) { chips[0].remove(); let e = box.querySelector('.earlier'); if (!e) { e = el('span', 'earlier u-muted'); box.prepend(e); } e.textContent = `… ${fmt(S.measurements.length - RECORD_DOM_CAP)} earlier not shown · `; }
}
function renderRecord() { const box = $('#record'); box.textContent = ''; if (!S.measurements.length) box.textContent = 'record strip: no measurement yet'; else S.measurements.slice(-RECORD_DOM_CAP).forEach(appendRecord); }

// ---------- search ----------
function doSearch(q) {
  q = q.trim(); if (!q) return; S.lastActivity = performance.now();
  const again = q === S.lastQuery; // setFocus clears lastQuery, so "Enter again" only measures the focus this same search steered to
  if (again && S.atom) { measure(); return; }
  if (again) { S.msg = 'nothing to measure: this focus has no electron record (search steered, it did not collapse)'; updateHUD(true); return; }
  const m = /^#?(\d+)$/.exec(q);
  if (m) {
    const n = +m[1];
    if (D.famByN.has(n)) { const fi = D.famByN.get(n); const f = D.families[fi]; setFocus({ famIdx: fi }); S.msg = `family #${n} ${f.name} · block ${f.block} · ${fmt(f.lineCount)} entries · search steers, it does not measure: Enter again or tap to collapse`; }
    else if (D.keyCount.has(n)) { setFocus({ famIdx: -1, atom: null, key: n }); S.msg = `line #${n} · appears in ${fmt(D.keyCount.get(n))} families (${fmt(D.keyCount.get(n))} points lit) · search steers, it does not measure`; }
    else if (D.atomByN.has(n)) { setFocus({ atom: D.atomByN.get(n) }); S.msg = `soul #${n} ${D.atomByN.get(n).name} (electron census numbering) · search steers, it does not measure: Enter again or tap to collapse`; }
    else S.msg = `#${n} is neither a family key, a line number nor a shipped soul number.`;
  } else {
    const fams = D.famByName.get(q), atoms = D.atomByName.get(q);
    if (fams) { setFocus({ famIdx: fams[0] }); S.msg = `${fams.length} famil${fams.length === 1 ? 'y' : 'ies'} named "${q}" · showing #${D.families[fams[0]].n} · search steers, it does not measure: Enter again or tap to collapse`; }
    else if (atoms) { setFocus({ atom: atoms[0] }); S.msg = `${atoms.length} soul${atoms.length === 1 ? '' : 's'} named "${q}" · search steers, it does not measure`; }
    else S.msg = `no family or shipped soul is named "${q}"`;
  }
  S.lastQuery = q; updateHUD(true);
}

// ---------- pick ----------
function pickAt(cssX, cssY) {
  if (!pick.ok) { S.msg = 'pick framebuffer unavailable'; return; }
  const x = Math.round(cssX * DPR), y = Math.round(G.H - cssY * DPR); const sz = PHONE ? 8 : 1; const half = Math.floor(sz / 2);
  gl.bindFramebuffer(gl.FRAMEBUFFER, pick.fbo); gl.viewport(0, 0, G.W, G.H); gl.disable(gl.BLEND); gl.enable(gl.SCISSOR_TEST); gl.scissor(x - half, y - half, sz, sz);
  gl.clearBufferuiv(gl.COLOR, 0, new Uint32Array([0, 0, 0, 0]));
  gl.useProgram(P.pick.p); setSeaUniforms(P.pick, 1); gl.bindVertexArray(VAO.sea); gl.drawArraysInstanced(gl.POINTS, 0, S.seaDrawn, 2); // both stars are pickable
  const out = new Uint32Array(sz * sz * 4); gl.readPixels(x - half, y - half, sz, sz, gl.RGBA_INTEGER, gl.UNSIGNED_INT, out);
  gl.disable(gl.SCISSOR_TEST); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.enable(gl.BLEND);
  let best = null, bd = 1e9; for (let j = 0; j < sz; j++) for (let i = 0; i < sz; i++) { const o = (j * sz + i) * 4; if (out[o]) { const d = (i - half) ** 2 + (j - half) ** 2; if (d < bd) { bd = d; best = [out[o], (out[o + 1] & 0xFFFF) - 1, out[o + 1] >>> 16]; } } }
  if (!best) { S.msg = 'tap hit no entry'; updateHUD(true); return; }
  const fi = best[1]; const f = D.families[fi]; setFocus({ famIdx: fi, key: best[0] });
  const bi = D.famBlock[fi]; const bl = bi < 210 ? D.blocks.blocks[bi] : null;
  S.msg = `${best[2] === 1 ? 'twin star: ' : ''}#${best[0]} · family #${f.n} ${f.name} · block ${bl ? bl.symbol + ' (' + bl.category + ')' : f.block + ' (off table)'} · line #${best[0]} appears in ${fmt(D.keyCount.get(best[0]))} families${best[2] === 1 ? ' (the twin is the same entry mirrored; the pick steers the principal)' : ''}`; updateHUD(true);
}

// ---------- HUD ----------
let hudDirty = true, hudLast = 0;
function updateHUD(force) { if (force) hudDirty = true; }
function stateText() {
  const a = S.atom; if (!a) return S.famIdx >= 0 ? `shells not shipped for this soul (${fmt(D.electron.totals.atoms_shipped)} of ${fmt(D.electron.totals.atoms_in_star)} atoms carry records): tap steers, nothing to measure` : 'no focus';
  const T = a.shells.K + a.shells.L + a.shells.M; if (T === 0) return 'no electrons: nothing to measure';
  const th = S.hand ? S.hand.theta : S.theta, ph = S.hand ? S.hand.phi : S.phi; const c = Math.cos(th / 2), s = Math.sin(th / 2);
  const collapsed = S.outcome >= 0 && !!S.collapse;
  const st = collapsed ? (S.outcome ? 'collapsed |1> TUNNEL' : 'collapsed |0> HOME') : S.hand ? 'prepared by hand' : S.relaxFrom ? 'relaxing to the data state' : (th < 1e-6 ? 'pure |0>' : Math.abs(th - PI) < 1e-6 ? 'pure |1>' : 'superposition (data state)');
  return `state: ${st} · θ=${deg(th)}° φ=${deg(ph)}° · P(home)=${(c * c).toFixed(3)} P(tunnel)=${(s * s).toFixed(3)} · |α|²+|β|²=1 by construction (Bloch angles)`
    + (collapsed ? ` · measured at θ=${deg(S.measuredTheta)}° (${S.measuredHow}) · data θ=${deg(S.dataTheta)}° · a repeat measurement now reproduces the outcome until re-prepared` : '')
    + ` · K${a.shells.K} L${a.shells.L} M${a.shells.M} → sin²(θ/2)=M/(K+L+M)=${(Math.sin(S.dataTheta / 2) ** 2).toFixed(3)} · φ ${a.spin === 'unpaired' ? 'precessing (decorative: precession marks "no test or proof calls this")' : 'still (paired)'}` + (a.class === 'ambiguous' ? ` · Pauli: this name is bound to more than one soul; only soul ${a.soul} is shipped` : '');
}
function renderHUD(now) {
  if (!hudDirty && now - hudLast < 250) return; hudLast = now; hudDirty = false;
  const L = []; const x = 'x';
  L.push(['', `renderer: ${S.renderer}`]);
  L.push(['', `on GPU: ${fmt(S.seaDrawn)} line entries · ${fmt(D.distinct)} distinct permanent numbers · index.json states ${fmt(D.provenance.checks.index_lines)} (not reproducible from the published buckets; both printed, neither invented)` + (S.phoneMode ? ' · ' + S.phoneMode : '')]);
  L.push([x, `fps ${(S.fps || 0).toFixed(0)} (1 s mean) · draw calls ${S.lastDrawCalls} · DPR ${DPR}`]);
  L.push([x, `seed "${S.seedString}"${S.seedNote ? ' · ' + S.seedNote : ''} · PRNG mulberry32(hash(seed, soul, measurementCount))`]);
  L.push([x, stateText()]);
  L.push([x, `Born audit: ${S.born || 'no measurement yet'}`]);
  const tw = S.twin; if (tw) { const probs = tw.cands.map(c => `${c.label} q=${c.q.toFixed(3)}${c.p != null ? ' p=' + c.p : ''}`).join(' · '); L.push([x, `twin tier: ${tw.tierLabel}${tw.cands.length ? ' · ' + probs : ''}${tw.all.length > 8 ? ` · ${tw.all.length - 8} more candidates not drawn` : ''}${S.twinNote ? ' · ' + S.twinNote : ''}`]); }
  const rp = S.reprepareAt ? Math.max(0, (S.reprepareAt - now) / 1000) : 0;
  L.push([x, S.hold ? 'hold: state frozen' : S.reprepareAt ? `re-prepare in ${rp.toFixed(1)} s` : 'prepared (data state)']);
  const t = D.electron.totals; L.push([x, `data caveats: atoms with records ${fmt(t.atoms_shipped)}/${fmt(t.atoms_in_star)} · entangled souls listed ${D.entangled.soul_md.entanglements_listed}/${D.entangled.soul_md.entanglements_stated} · random p on ${D.random.edges.filter(e => e.p != null).length}/${D.random.edges.length} edges · shipped atoms with M>0: ${fmt(D.atomsWithM)}/${fmt(t.atoms_shipped)} (the census ships tunnelling atoms only; no pure |0> data state can appear) · K+L=0 (never at home): ${fmt(D.atomsNoHome)} · families with a name-matched atom (measurable): ${fmt(D.measurableFamilies)}/${fmt(D.families.length)}`]);
  if (S.famJoinNote) L.push([x, `join: ${S.famJoinNote}`]);
  L.push([x, `cable: ${S.cableOn ? 'on' : 'off'}${S.cableNote ? ' · ' + S.cableNote : ' · no automatic external request; line text only on demand'}`]);
  const a = S.atom; if (a) { const h = S.hist.get(a.n); if (h && h.n >= 20) { const c = Math.cos(S.dataTheta / 2) ** 2; L.push([x, `histogram #${a.n} (prepared data state only): HOME ${h.home}/${h.n}=${(h.home / h.n).toFixed(3)} vs cos²(θ/2)=${c.toFixed(3)} · TUNNEL ${h.tunnel}/${h.n}=${(h.tunnel / h.n).toFixed(3)} vs sin²=${(1 - c).toFixed(3)} · ${h.skipped} draws not counted (repeats on a collapsed state, by hand, or during relaxation)`]); } }
  if (now - S.lastActivity > 20000 && !S.collapse) L.push([x, 'unitary evolution, nothing measured']);
  if (S.msg) L.push(['', S.msg]);
  if (S.prove) L.push(['', S.prove]);
  const hud = $('#hud'); hud.textContent = ''; L.forEach(([cls, txt]) => { const d = document.createElement('div'); d.className = cls; d.textContent = txt; hud.appendChild(d); });
  if (PHONE) { const t = document.createElement('div'); t.className = 'k'; t.textContent = hud.classList.contains('collapsed') ? '▸ tap to expand' : '▾ tap to collapse'; hud.appendChild(t); }
}

// ---------- draw ----------
function setSeaUniforms(prog, pickMode) {
  const U = prog.U; gl.uniform1i(U.u_fam, 0); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, B.famTex);
  gl.uniform2f(U.u_res, G.W, G.H); gl.uniform1f(U.u_dpr, DPR); gl.uniform1f(U.u_time, S.time); gl.uniform2f(U.u_c0, G.c0[0], G.c0[1]); gl.uniform2f(U.u_c1, G.c1[0], G.c1[1]);
  gl.uniform1f(U.u_R, G.R); gl.uniform3f(U.u_view, S.view.x, S.view.y, S.view.z); gl.uniform1f(U.u_spiral, G.spiral);
  gl.uniform1ui(U.u_focusKey, S.key >>> 0); gl.uniform1ui(U.u_focusFamily, S.famIdx >= 0 ? S.famIdx : 0xFFFF); gl.uniform1ui(U.u_twinKey, S.twinKey >>> 0); gl.uniform1ui(U.u_twinFamily, S.twinFamily);
  gl.uniform1i(U.u_focusBlock, S.focusBlock); gl.uniform1i(U.u_focusCat, S.focusCat); gl.uniform1f(U.u_collapseT, S.collapseT || 0);
  gl.uniform1f(U.u_size, PHONE ? 1.0 : 1.2); gl.uniform1f(U.u_alpha, PHONE ? 0.5 : 0.35); gl.uniform3fv(U.u_pal, G.palFlat); gl.uniform1i(U.u_pick, pickMode);
}
function genUniforms(space, opts = {}) {
  const U = P.gen.U; gl.useProgram(P.gen.p); gl.uniform2f(U.u_res, G.W, G.H); gl.uniform2f(U.u_org, G.c0[0], G.c0[1]); gl.uniform2f(U.u_c0, G.c0[0], G.c0[1]); gl.uniform2f(U.u_c1, G.c1[0], G.c1[1]);
  gl.uniform1f(U.u_R, G.R); gl.uniform3f(U.u_view, S.view.x, S.view.y, S.view.z); gl.uniform1i(U.u_space, space); gl.uniform1f(U.u_time, S.time); gl.uniform1f(U.u_dpr, DPR);
  gl.uniform1f(U.u_size, opts.size || 4); gl.uniform1i(U.u_orbit, opts.orbit ? 1 : 0); gl.uniform1i(U.u_dash, opts.dash ? 1 : 0); gl.uniform1i(U.u_round, opts.round ? 1 : 0); gl.uniform1f(U.u_cut, opts.cut != null ? opts.cut : 2);
}
function rotMat() { const t = -0.45; const c = Math.cos(t), s = Math.sin(t); // tilt about x so the pole leans toward the viewer
  return new Float32Array([1, 0, 0, 0, c, s, 0, -s, c]); }
let lastT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = lastT ? (now - lastT) / 1000 : 0; lastT = now; S.time = now / 1000; S.drawCalls = 0;
  S.fpsSamples.push(now); while (S.fpsSamples.length && S.fpsSamples[0] < now - 1000) S.fpsSamples.shift();
  S.fps = S.fpsSamples.length > 1 ? (S.fpsSamples.length - 1) * 1000 / (now - S.fpsSamples[0]) : 0; void dt;
  // qubit evolution
  const a = S.atom; if (a && a.spin === 'unpaired' && !S.hand && S.outcome < 0) S.phi = (2 * PI * S.time / 8) % (2 * PI);
  if (S.relaxFrom && !S.hand) { const k = Math.min(1, (now - S.relaxFrom.t0) / 2000); S.theta = S.relaxFrom.theta + (S.dataTheta - S.relaxFrom.theta) * k; if (!(a && a.spin === 'unpaired')) S.phi = S.relaxFrom.phi * (1 - k); if (k >= 1) S.relaxFrom = null; }
  if (S.collapse) { const k = Math.min(1, (now - S.collapse) / 120); S.collapseT = k; S.flash = Math.max(0, 1 - (now - (S.flashAt || S.collapse)) / 400); if (!S.hold && S.reprepareAt && now >= S.reprepareAt) reprepare(); }
  else S.collapseT = 0;
  if (S.hold && S.reprepareAt) S.reprepareAt = now + 8000;
  gl.viewport(0, 0, G.W, G.H); gl.clearColor(0.028, 0.035, 0.05, 1); gl.clear(gl.COLOR_BUFFER_BIT);
  // 1. the sea, both stars, one call
  gl.blendFunc(gl.ONE, gl.ONE); gl.useProgram(P.sea.p); setSeaUniforms(P.sea, 0); gl.bindVertexArray(VAO.sea); gl.drawArraysInstanced(gl.POINTS, 0, S.seaDrawn, 2);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  // 2. journey (both stars, mirrored) as a dashed strip + beads
  if (B.journeyN > 1) { genUniforms(1, { dash: true }); gl.bindVertexArray(VAO.journey); gl.drawArraysInstanced(gl.LINE_STRIP, 0, B.journeyN, 2); }
  if (B.journeyN > 0) { genUniforms(1, { round: true, size: 5 }); gl.bindVertexArray(VAO.journey); gl.drawArraysInstanced(gl.POINTS, 0, B.journeyN, 2); }
  // 3. tether (dashed) principal → twin
  if (B.tetherN > 0 && !S.tetherDissolved) { genUniforms(1, { dash: true }); gl.bindVertexArray(VAO.tether); gl.drawArrays(gl.LINES, 0, B.tetherN); }
  // 4. twin cloud
  if (B.cloudN > 0) { genUniforms(1, { round: true, size: 7, orbit: !S.twin.chosen }); gl.bindVertexArray(VAO.cloud); gl.drawArrays(gl.POINTS, 0, B.cloudN); }
  // 5. atom lines (bonds, spin arrows, dials) and dots (repo ring, nucleus)
  if (B.atomLinesN > 0) { genUniforms(0); gl.bindVertexArray(VAO.atomLines); gl.drawArrays(gl.LINES, 0, B.atomLinesN); }
  if (B.atomDotsN > 0) { genUniforms(0, { round: true, size: 4 }); gl.bindVertexArray(VAO.atomDots); gl.drawArrays(gl.POINTS, 0, B.atomDotsN - (S.atom ? 1 : 0)); if (S.atom) { genUniforms(0, { round: true, size: S.nucleusSize }); gl.drawArrays(gl.POINTS, B.atomDotsN - 1, 1); } }
  // 6. electrons in K/L/M shells
  if (a) { const U = P.elec.U; gl.useProgram(P.elec.p); gl.uniform2f(U.u_res, G.W, G.H); gl.uniform2f(U.u_org, G.c0[0], G.c0[1]); gl.uniform1f(U.u_r, G.sphereR); gl.uniform3f(U.u_counts, a.shells.K, a.shells.L, a.shells.M); gl.uniform1f(U.u_stride, S.elecStride); gl.uniform1f(U.u_time, S.time); gl.uniform1f(U.u_dpr, DPR); gl.uniform1f(U.u_collapseT, S.collapseT || 0); gl.uniform1f(U.u_outcome, S.outcome); gl.uniform1f(U.u_flash, S.flash || 0); const c = G.pal[Math.min(S.famIdx >= 0 ? D.famCat[S.famIdx] : 12, 12)]; gl.uniform3f(U.u_col, c[0], c[1], c[2]); gl.bindVertexArray(VAO.elec); gl.drawArraysInstanced(gl.POINTS, 0, 512, 3); }
  // 7. Bloch wireframe, state arrow and dot
  { const U = P.bloch.U; gl.useProgram(P.bloch.p); gl.uniformMatrix3fv(U.u_rot, false, rotMat()); gl.uniform2f(U.u_org, G.c0[0], G.c0[1]); gl.uniform1f(U.u_r, G.sphereR); gl.uniform2f(U.u_res, G.W, G.H); gl.uniform1i(U.u_mode, 0); gl.uniform1i(U.u_round, 0); gl.uniform1f(U.u_size, 1);
    const dark = a && (a.shells.K + a.shells.L + a.shells.M === 0); const empty = !a;
    gl.uniform4f(U.u_col, 0, .9, 1, dark ? 0.12 : empty ? 0.3 : 0.7); gl.bindVertexArray(VAO.wire); gl.drawArrays(gl.LINES, 0, B.wireN);
    if (a && a.class === 'ambiguous') { gl.uniform2f(U.u_org, G.c0[0] + 8 * DPR, G.c0[1] + 6 * DPR); gl.uniform4f(U.u_col, 1, .83, .29, 0.35); gl.drawArrays(gl.LINES, 0, B.wireN); gl.uniform2f(U.u_org, G.c0[0], G.c0[1]); }
    if (a && !dark) { const th = S.hand ? S.hand.theta : (S.collapse && S.measuredTheta != null ? S.measuredTheta : S.theta), ph = S.hand ? S.hand.phi : S.phi; gl.uniform1i(U.u_mode, 1); // while collapsing the shader mixes from the measured θ to the pole gl.uniform1f(U.u_theta, th); gl.uniform1f(U.u_phi, ph); gl.uniform1f(U.u_collapseT, S.collapseT || 0); gl.uniform1f(U.u_outcome, Math.max(0, S.outcome));
      gl.uniform4f(U.u_col, 1, 1, 1, 0.9); gl.bindVertexArray(VAO.state); gl.drawArrays(gl.LINES, 0, 2); gl.uniform1i(U.u_round, 1); gl.uniform1f(U.u_size, 9 * DPR); const oc = S.outcome === 1 ? [1, .83, .29] : [0, .9, 1]; gl.uniform4f(U.u_col, S.outcome >= 0 ? oc[0] : 1, S.outcome >= 0 ? oc[1] : 1, S.outcome >= 0 ? oc[2] : 1, 1); gl.drawArrays(gl.POINTS, 1, 1); }
  }
  // 8. re-preparation ring
  if (S.reprepareAt && !S.hold) { const frac = Math.max(0, (S.reprepareAt - now) / 8000); genUniforms(0, { cut: frac }); gl.bindVertexArray(VAO.ring); gl.bindBuffer(gl.ARRAY_BUFFER, B.ring); const rr = G.sphereR * 1.08;
    if (S.ringScale !== rr) { /* ring vertices are re-uploaded only when the sphere radius changes (resize) */ const arr = new Float32Array(128 * 8); for (let i = 0; i < 128; i++) { const t = Math.floor(i / 2) / 64 + (i % 2) / 64; const an = -PI / 2 + t * 2 * PI; arr.set([Math.cos(an) * rr, Math.sin(an) * rr, 0, .9, 1, .8, t, 0], i * 8); } gl.bufferSubData(gl.ARRAY_BUFFER, 0, arr); S.ringScale = rr; }
    gl.drawArrays(gl.LINES, 0, 128); }
  // 9. the classical cable: a bead travelling from the sea point to the sphere while a fetch is in flight
  if (S.cable && !S.cable.done && S.famIdx >= 0) { const p = familyPos(S.famIdx); const k = ((now - S.cable.t0) / 600) % 1; const arr = new Float32Array([p[0] * (1 - k), p[1] * (1 - k), .5, .6, .7, 1, 0, 0]); gl.bindBuffer(gl.ARRAY_BUFFER, B.cable); gl.bufferSubData(gl.ARRAY_BUFFER, 0, arr); genUniforms(1, { round: true, size: 6 }); gl.bindVertexArray(VAO.cable); gl.drawArrays(gl.POINTS, 0, 1); }
  gl.bindVertexArray(null);
  S.lastDrawCalls = S.drawCalls; renderHUD(now);
}

// ---------- interaction ----------
function wireUI() {
  const search = $('#search'); search.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(search.value); });
  $('#measure').onclick = () => measure();
  $('#reprepare').onclick = () => { if (S.outcome >= 0 || S.hand || S.relaxFrom) reprepare('re-prepared by the button: θ back to the data value'); else { S.msg = 'already in the prepared data state'; updateHUD(true); } };
  $('#cable').onclick = e => { S.cableOn = !S.cableOn; e.target.classList.toggle('on', S.cableOn); e.target.textContent = 'cable: ' + (S.cableOn ? 'on' : 'off'); S.cableNote = S.cableOn ? 'on: after a measurement the family record is fetched from the bucket URL in provenance.json (once per bucket, sha256 checked)' : 'off: no automatic external request'; updateHUD(true); };
  $('#hold').onclick = e => { S.hold = !S.hold; e.target.classList.toggle('on', S.hold); updateHUD(true); };
  $('#newseed').onclick = () => { S.seedString = new Date().toISOString().slice(0, 10); S.seedNote = 'this is not a finding'; updateHUD(true); };
  $('#about').onclick = () => { const p = $('#aboutPanel'); p.hidden = !p.hidden; };
  $('#prove').onclick = async () => {
    let sha = 'sha256 unavailable'; try { const h = await crypto.subtle.digest('SHA-256', D.lines); sha = Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join(''); } catch (e) { sha = 'sha256 unavailable: ' + e.message; }
    const prov = D.provenance.outputs.find(o => o.file === 'lines.bin');
    S.prove = `prove it: VBO ${fmt(S.seaBytes)} bytes (${fmt(S.seaDrawn)} entries × 12) · drawArraysInstanced(POINTS, 0, ${fmt(S.seaDrawn)}, 2) each frame · CPU sum of keys ${fmt(S.keySum)} · sha256(lines.bin in memory) ${sha} · provenance sha256 ${prov.sha256} ${sha === prov.sha256 ? '(match)' : '(MISMATCH)'}`; updateHUD(true);
  };
  if (PHONE) { const hud = $('#hud'); hud.classList.add('collapsed'); hud.addEventListener('click', () => { hud.classList.toggle('collapsed'); updateHUD(true); }); }
  // sphere handle: drag prepares by hand (unitary), tap measures
  const h = $('#sphereHandle'); let drag = null;
  h.addEventListener('pointerdown', e => { h.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY, moved: false, th: S.hand ? S.hand.theta : S.theta, ph: S.hand ? S.hand.phi : S.phi }; S.lastActivity = performance.now(); });
  h.addEventListener('pointermove', e => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.hypot(dx, dy) > 3) drag.moved = true; if (drag.moved && S.atom) { S.hand = { theta: Math.min(PI, Math.max(0, drag.th - dy * 0.012)), phi: (drag.ph + dx * 0.012 + 4 * PI) % (2 * PI) }; if (S.outcome >= 0) { S.outcome = -1; S.collapse = null; S.collapseT = 0; S.reprepareAt = 0; S.litRepo = null; S.measuredTheta = null; buildAtomGeometry(); } updateHUD(true); } }); // a drag is a unitary rotation by hand: from the pole after a collapse, or from the data state
  const up = e => { if (!drag) return; if (!drag.moved) measure(); else if (S.hand && !S.hold) { S.relaxFrom = { t0: performance.now(), theta: S.hand.theta, phi: S.hand.phi }; S.theta = S.hand.theta; S.phi = S.hand.phi; S.hand = null; } drag = null; updateHUD(true); };
  h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
  // canvas: tap picks an entry; horizontal swipe walks the conduction band; wheel zooms; mouse drag pans
  let cd = null; canvas.addEventListener('pointerdown', e => { cd = { x: e.clientX, y: e.clientY, moved: false, vx: S.view.x, vy: S.view.y, t: performance.now() }; });
  canvas.addEventListener('pointermove', e => { if (!cd) return; const dx = e.clientX - cd.x, dy = e.clientY - cd.y; if (Math.hypot(dx, dy) > 6) cd.moved = true; if (cd.moved && e.pointerType === 'mouse') { S.view.x = cd.vx + dx * DPR; S.view.y = cd.vy + dy * DPR; } });
  canvas.addEventListener('pointerup', e => { if (!cd) return; const dx = e.clientX - cd.x, dy = e.clientY - cd.y; const rect = canvas.getBoundingClientRect(); if (!cd.moved) pickAt(e.clientX - rect.left, e.clientY - rect.top); else if (e.pointerType !== 'mouse' && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) walkBand(dx < 0 ? 1 : -1); cd = null; });
  canvas.addEventListener('wheel', e => { e.preventDefault(); const f = Math.exp(-e.deltaY * 0.001); S.view.z = Math.min(8, Math.max(0.5, S.view.z * f)); }, { passive: false });
  window.addEventListener('keydown', e => { if (e.target === search) return; if (e.key === 'ArrowRight') walkBand(1); else if (e.key === 'ArrowLeft') walkBand(-1); else if (e.key === 'Enter' && S.atom) measure(); });
  window.addEventListener('resize', () => { resize(); buildAtomGeometry(); if (S.twin) { if (S.twin.chosen) buildTwinPost(); else buildTwin(); } }); // a resize during a collapse keeps the chosen twin
}
function walkBand(dir) { S.bandPos = (S.bandPos + dir + D.band.length) % D.band.length; const a = D.atomByN.get(D.band[S.bandPos]); setFocus({ atom: a }); S.msg = `conduction band ${S.bandPos + 1}/${D.band.length}: #${a.n} ${a.name} (${a.class})`; updateHUD(true); }

function legend() {
  const el = $('#legend'); el.textContent = '';
  const all = document.createElement('button'); all.className = 'u-chip on'; all.textContent = 'all'; all.onclick = () => { S.focusCat = -1; S.focusBlock = -1; sel.value = ''; el.querySelectorAll('.u-chip').forEach(c => c.classList.remove('on')); all.classList.add('on'); }; el.appendChild(all);
  D.blocks.categories.forEach((c, i) => { const b = document.createElement('button'); b.className = 'u-chip'; const sw = document.createElement('i'); sw.style.background = c.colour; b.appendChild(sw); b.appendChild(document.createTextNode(`${c.id} (${fmt(D.blocks.blocks.filter(x => x.category === c.id).reduce((s, x) => s + x.families, 0))})`)); b.title = c.title; b.onclick = () => { S.focusCat = i; S.focusBlock = -1; sel.value = ''; el.querySelectorAll('.u-chip').forEach(x => x.classList.remove('on')); b.classList.add('on'); }; el.appendChild(b); });
  const off = document.createElement('button'); off.className = 'u-chip'; const osw = document.createElement('i'); osw.style.background = '#8b93a7'; off.appendChild(osw); off.appendChild(document.createTextNode(`off table (${fmt(D.offTable)})`)); off.onclick = () => { S.focusCat = 12; S.focusBlock = -1; el.querySelectorAll('.u-chip').forEach(x => x.classList.remove('on')); off.classList.add('on'); }; el.appendChild(off);
  const sel = document.createElement('select'); sel.setAttribute('aria-label', 'focus a block'); const o0 = document.createElement('option'); o0.value = ''; o0.textContent = 'focus a block…'; sel.appendChild(o0);
  D.blocks.blocks.forEach((b, i) => { const o = document.createElement('option'); o.value = i; o.textContent = `${b.symbol} ${b.title} (${b.families})`; sel.appendChild(o); });
  sel.onchange = () => { if (sel.value === '') { S.focusBlock = -1; return; } S.focusBlock = +sel.value; S.focusCat = -1; el.querySelectorAll('.u-chip').forEach(x => x.classList.remove('on')); }; el.appendChild(sel);
}
function aboutPanel() {
  const p = $('#aboutPanel'); const t = D.electron.totals; const sm = D.entangled.soul_md;
  p.innerHTML = `<b>What is exact and what is a picture.</b>
<div class="u-sub" style="margin-top:6px">Exact</div>
<ul style="margin:4px 0 4px 18px;padding:0">
<li>One normalised qubit cos(θ/2)|0&gt; + e<sup>iφ</sup> sin(θ/2)|1&gt; with θ from the real shell census of the focused atom: sin²(θ/2) = M/(K+L+M); it is parameterised on the Bloch sphere, so it is normalised by construction. The Born rule is applied with an auditable r from a seeded PRNG (mulberry32). A measurement collapses the state to the pole: a repeat measurement reproduces the outcome with certainty until re-preparation; measurements on the prepared data state converge to cos²/sin² and the HUD shows that histogram after 20 of them.</li>
<li>The twin is sampled from a stated, seeded distribution; the page prints its tier, the rule and every probability used, including the effective probability of an ENTANGLED_MAYBE partner. Random-star weights are published p renormalised to sum to 1 (classical weights, nothing squared).</li>
<li>SOUL entanglements are one definition called from other repositories: perfect correlation by construction, no signal needed. ${fmt(sm.entanglements_listed)} are listed of ${fmt(sm.entanglements_stated)} stated in SOUL.md. Twin rule: on TUNNEL the defining repository (q=1); on HOME one of the called_from repositories, 1/N each.</li>
<li>Every line entry the buckets publish (${fmt(D.N)}) is resident on the GPU in one buffer and drawn every frame, twice (principal and twin).</li>
</ul>
<div class="u-sub">Picture</div>
<ul style="margin:4px 0 4px 18px;padding:0">
<li>The twin star is the same buffer drawn point-by-point reflected through the centre (angle + π, same radius): a mirror image, deterministic. It is a picture of the singlet's antipodal correlation (spin up along n on one particle means spin down along n on the other); no second qubit is modelled and no measurement is made on the twin, so no correlation is computed.</li>
<li>φ is decorative: precession only marks "no test or proof calls this" (unpaired spin).</li>
<li>Shells are directory/repo layers (K same directory, L same repository, M other repositories); "tunnelling" is a name for a call from a repository holding no copy.</li>
<li>The 8-second timer is re-preparation, not decoherence.</li>
<li>No Bell test exists here: one qubit, one measurement basis, no second party; nothing on this page tests quantum mechanics.</li>
<li>The electron census ships tunnelling atoms only: ${fmt(D.atomsWithM)} of ${fmt(t.atoms_shipped)} shipped atoms have M&gt;0 and ${fmt(D.atomsNoHome)} have K+L=0, so no pure |0&gt; data state can appear. Only families whose name matches a shipped atom can be measured: ${fmt(D.measurableFamilies)} of ${fmt(D.families.length)}; the rest can be steered to, not measured, because their shells are not in the pack and θ is never synthesised.</li>
<li>Random Star edges are prompts, not findings; p exists on ${D.random.edges.filter(e => e.p != null).length} of ${D.random.edges.length} edges.</li>
<li>Only ${fmt(t.atoms_shipped)} of ${fmt(t.atoms_in_star)} atoms and ${fmt(sm.entanglements_listed)} of ${fmt(sm.entanglements_stated)} entanglements are shipped. Soul numbers (electron census) and family keys (code buckets) are different numberings; this page joins them by name only and says so in the HUD.</li>
<li>${fmt(D.provenance.checks.index_lines)} is index.json's figure for unique numbered lines; it could not be reproduced from the published buckets (${fmt(D.N)} entries, ${fmt(D.distinct)} distinct numbers). Both are printed; neither is invented.</li>
<li>Line text is never shown unless fetched from GitHub at the pinned commit on demand (the classical cable).</li>
</ul>`;
}

// ---------- no WebGL2: 2D fallback ----------
function fallback2D(reason) {
  const old = $('#gl'); const c = document.createElement('canvas'); c.id = 'fallback'; old.replaceWith(c); // a canvas that has given out a webgl2 context cannot give out a 2d one
  const ctx = c.getContext('2d'); const rect = c.getBoundingClientRect(); c.width = rect.width * DPR; c.height = rect.height * DPR;
  console.error('WebGL2 path failed:', reason);
  const cx = c.width / 2, cy = c.height / 2, r = 90 * DPR; ctx.fillStyle = '#07090d'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = '#00e5ff'; ctx.lineWidth = DPR; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 2 * PI); ctx.stroke(); ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.35, 0, 0, 2 * PI); ctx.stroke();
  const a = (D.focusDefault != null && D.atomByN.get(D.focusDefault)) || D.electron.atoms[0]; const th = atomTheta(a) || 0; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx + Math.sin(th) * r, cy - Math.cos(th) * r, 5 * DPR, 0, 2 * PI); ctx.fill();
  [[0.55, a.shells.K], [0.85, a.shells.L], [1.25, a.shells.M]].forEach(([k, n]) => { ctx.strokeStyle = '#385464'; ctx.beginPath(); ctx.arc(cx, cy, r * k, 0, 2 * PI); ctx.stroke(); ctx.fillStyle = '#ffd54a'; for (let i = 0; i < Math.min(n, 512); i++) { const an = 2 * PI * i / n; ctx.beginPath(); ctx.arc(cx + Math.cos(an) * r * k, cy + Math.sin(an) * r * k, 2 * DPR, 0, 2 * PI); ctx.fill(); } });
  ctx.fillStyle = '#d8dee9'; ctx.font = `${12 * DPR}px ui-monospace,Menlo,Consolas,monospace`; ctx.textAlign = 'center';
  ctx.fillText(`#${a.n} ${a.name} · K${a.shells.K} L${a.shells.L} M${a.shells.M} · θ=${(th * 180 / PI).toFixed(1)}° · ${a.class} · spin ${a.spin}`, cx, cy + r * 1.5 + 20 * DPR);
  ctx.fillText(`The sea of ${fmt(D.N)} line entries needs WebGL2 (${reason}). This 2D canvas shows only the focus atom.`, cx, cy + r * 1.5 + 40 * DPR);
  $('#hud').textContent = `renderer: none (WebGL2 unavailable: ${reason}) · on GPU: 0 line entries · the sea needs WebGL2`;
  $('#sphereHandle').hidden = true;
}

// ---------- boot ----------
(async function main() {
  try {
    await loadData();
    D.maxLC = Math.max(...D.families.map(f => f.lineCount));
    $('#count').textContent = `${fmt(D.blocks.blocks.length)} named blocks · ${fmt(D.families.length)} function families · ${fmt(D.N)} line entries in ${fmt(D.provenance.checks.buckets_fetched)} buckets · ${fmt(D.distinct)} distinct numbered lines · index.json states ${fmt(D.provenance.checks.index_lines)} unique numbered lines`;
    G.pal = D.blocks.categories.map(c => hex(c.colour)).concat([hex('#8b93a7')]); G.palFlat = new Float32Array(G.pal.flat());
    aboutPanel(); renderRecord();
    const am = D.provenance.amendments && D.provenance.amendments.length ? D.provenance.amendments[D.provenance.amendments.length - 1].utc : null;
    $('#foot').textContent = `202609142202 quantum-twin-star · pack built ${D.provenance.built_utc}${am ? ' · pack amended ' + am : ''} from ${D.provenance.stars_base} and raw.githubusercontent.com/Ventusltd/star-maker@${D.provenance.star_maker_commit.slice(0, 7)} · GLOBALGRID2050`;
    canvas = $('#gl');
    let ok = false, why = '';
    try { D.rin = 0.5; buildLayout(); legend(); ok = initGL(); if (!ok) why = 'getContext("webgl2") returned null'; } catch (e) { why = e.message; ok = false; }
    if (!ok) { fallback2D(why); return; }
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    S.renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : (gl.getParameter(gl.RENDERER) || 'renderer masked by browser');
    S.lastDrawCalls = 0;
    resize(); wireUI();
    const def = D.focusDefault != null ? D.atomByN.get(D.focusDefault) : null;
    if (def) { setFocus({ atom: def }); S.bandPos = Math.max(0, D.band.indexOf(def.n)); S.msg = `default focus: soul #${def.n} ${def.name} (electron/graph.json focus_default "${D.electron.focus_default}", shipped in electron.json) · band: ${D.bandNote}`; }
    else { setFocus({ famIdx: 0 }); S.msg = `no focus_default shipped in electron.json (${JSON.stringify(D.electron.focus_default)}): showing the first family`; }
    requestAnimationFrame(frame);
    window.__qts = { S, G, D, B, familyPos, DPR }; // lab handle for the headless proof script; reads only
    // deep link
    if (location.hash.startsWith('#family=')) doSearch('#' + location.hash.slice(8));
  } catch (e) { fail(`Could not load live data: ${e.message}. Check the internet connection and reload.`); $('#count').textContent = 'pack could not be loaded'; console.error(e); }
})();
