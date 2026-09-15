/* Ten Laws — one estate, ten placement physics, and the change between them.
 *
 * The estate's 250,174 permanently numbered lines are drawn ten times, under
 * ten different laws taken from real physics. The laws live in physics.mjs and
 * this file only loads data, builds the attributes each law reads, and draws.
 *
 * THE POINT OF THE TWEEN. Switching law does not reload or redraw from scratch:
 * every point travels from where one law put it to where the next law puts it.
 * That journey is the finding. A cluster that holds together across two laws is
 * a property of the code; a cluster that only exists under one is a property of
 * that law. Watching which is which is the whole instrument.
 *
 * WHAT IS LOADED, AND WHEN. Before the first paint: the numbered keys, their
 * lengths, and whether any family carries them. That is enough for four of the
 * ten laws. After the first paint: the families and the line ranges, which give
 * family membership, fanout, category and age, and unlock the other six. A law
 * that cannot be drawn yet says so rather than drawing something wrong.
 */

import { LAWS, byId, phase } from './physics.mjs';

const DATA = '../202609142202/data/';
const $ = id => document.getElementById(id);
const fmt = n => Number(n).toLocaleString('en-GB');
let stage = $('stage');

const U = { keys: null, lens: null, inFam: null, n: 0, meta: null,
            families: null, famLines: null,
            family: null, inFamily: null, famCount: null, fanout: null,
            cat: null, catCount: 0, ageDays: null, tier2: false };

const view = { x: 0, y: 0, zoom: 1, w: 0, h: 0, dpr: 1,
               law: 'wafer', from: null, to: null, mix: 1, beamR: 0 };

/* ── loading ─────────────────────────────────────────────────────────────── */

async function bin(name, K) {
  const r = await fetch(DATA + name, { cache: 'default' });
  if (!r.ok) throw new Error(DATA + name + ' returned HTTP ' + r.status);
  return new K(await r.arrayBuffer());
}

async function tier1() {
  const [meta, keys, lens, inFam] = await Promise.all([
    fetch(DATA + 'all-lines.meta.json').then(r => r.json()),
    bin('all-lines.bin', Uint32Array),
    bin('all-lines.len.bin', Uint16Array),
    bin('all-lines.family.bin', Uint8Array)
  ]);
  Object.assign(U, { meta, keys, lens, inFam, n: keys.length });
  $('count').textContent = `${fmt(U.n)} numbered lines · ten laws · one estate`;
  $('prov').textContent =
    `numbered database built ${meta.built_utc.slice(0, 16).replace('T', ' ')} UTC · pack ${meta.source.sha256.slice(0, 12)}`;
}

async function tier2() {
  const [families, famLines] = await Promise.all([
    fetch(DATA + 'families.json').then(r => r.json()),
    bin('lines.bin', Uint32Array)
  ]);
  U.families = families; U.famLines = famLines;

  const idx = new Map();                       /* key -> row in U.keys */
  for (let i = 0; i < U.n; i++) idx.set(U.keys[i], i);

  U.family = new Int32Array(U.n).fill(-1);
  U.inFamily = new Uint32Array(U.n);
  U.famCount = new Uint32Array(U.n);
  U.fanout = new Uint16Array(U.n);
  U.cat = new Int16Array(U.n).fill(-1);
  U.ageDays = new Float32Array(U.n).fill(-1);

  const cats = new Map();
  for (const f of families) {
    const c = f.category ?? '(none)';
    if (!cats.has(c)) cats.set(c, cats.size);
  }
  U.catCount = cats.size;
  const now = Date.now();

  for (let fi = 0; fi < families.length; fi++) {
    const f = families[fi];
    const c = cats.get(f.category ?? '(none)');
    const age = f.first_written ? (now - Date.parse(f.first_written)) / 86400000 : -1;
    for (let j = 0; j < f.lineCount; j++) {
      const row = idx.get(U.famLines[f.lineOffset + j]);
      if (row === undefined) continue;
      if (U.fanout[row] < 65535) U.fanout[row]++;
      if (U.family[row] === -1) {                 /* first family wins the seat */
        U.family[row] = fi; U.inFamily[row] = j; U.famCount[row] = f.lineCount;
        U.cat[row] = c; U.ageDays[row] = age;
      }
    }
  }
  U.tier2 = true;
  $('count').textContent =
    `${fmt(U.n)} numbered lines · ${fmt(families.length)} families · ${fmt(U.catCount)} categories · ten laws`;
  document.querySelectorAll('.law[data-needs2]').forEach(b => b.disabled = false);
  if (byId[view.law].needsTier2) apply(view.law, true);
}

/* One entity, as the laws want it. Built per point rather than stored, because
   250,174 objects is a quarter of a million allocations and this runs on a
   phone. */
function ent(i) {
  return {
    key: U.keys[i],
    chars: U.lens[i],
    family: U.family ? (U.family[i] === -1 ? null : U.family[i]) : null,
    inFamily: U.inFamily ? U.inFamily[i] : 0,
    famCount: U.famCount ? U.famCount[i] : 0,
    fanout: U.fanout ? U.fanout[i] : (U.inFam[i] ? 1 : 0),
    cat: U.cat ? (U.cat[i] === -1 ? 0 : U.cat[i]) : 0,
    catCount: U.catCount || 1,
    ageDays: U.ageDays ? (U.ageDays[i] < 0 ? null : U.ageDays[i]) : null
  };
}

function positions(lawId) {
  const law = byId[lawId], p = new Float32Array(U.n * 2);
  for (let i = 0; i < U.n; i++) {
    const [x, y] = law.place(ent(i));
    p[i * 2] = Number.isFinite(x) ? x : 0;
    p[i * 2 + 1] = Number.isFinite(y) ? y : 0;
  }
  return p;
}

/* ── drawing ─────────────────────────────────────────────────────────────── */

const VS = `#version 300 es
precision highp float;
in vec2 a_from; in vec2 a_to; in float a_len; in float a_fam; in float a_key;
uniform vec2 u_res; uniform vec2 u_cam; uniform float u_zoom, u_dpr, u_mix, u_beam, u_beamOn;
out float v_fam; out float v_dev;
void main(){
  float t = u_mix; t = t < .5 ? 4.*t*t*t : 1. - pow(-2.*t + 2., 3.)/2.;
  vec2 p = (mix(a_from, a_to, t) - u_cam) * u_zoom;
  gl_Position = vec4(p / (u_res * 0.5), 0.0, 1.0);
  gl_PointSize = clamp((1.0 + min(a_len, 120.0) * 0.012) * sqrt(u_zoom) * u_dpr, 1.0, 24.0 * u_dpr);
  v_fam = a_fam;
  v_dev = u_beamOn < 0.5 ? 1.0 : (sqrt(a_key) <= u_beam ? 1.0 : 0.0);
}`;

const FS = `#version 300 es
precision highp float;
in float v_fam; in float v_dev;
out vec4 o;
void main(){
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d);
  if (r > 0.5) discard;
  float edge = smoothstep(0.5, 0.42, r);
  vec3 c = mix(vec3(0.30,0.34,0.44), vec3(0.84,0.87,0.94), v_fam);
  float a = edge * (0.30 + 0.70 * v_fam) * mix(0.06, 1.0, v_dev);
  o = vec4(c, a);
}`;

let gl = null, prog = null, loc = {}, buf = {}, ctx2d = null, posA = null, posB = null;

function compile(g, type, src) {
  const s = g.createShader(type); g.shaderSource(s, src); g.compileShader(s);
  if (!g.getShaderParameter(s, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(s));
  return s;
}

function initGL() {
  gl = stage.getContext('webgl2', { antialias: true, alpha: false });
  if (!gl) { gl = null; return fallback2d(); }
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    for (const u of ['u_res','u_cam','u_zoom','u_dpr','u_mix','u_beam','u_beamOn']) {
      loc[u] = gl.getUniformLocation(prog, u);
    }
    const attach = (name, data, size, Kind) => {
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      const l = gl.getAttribLocation(prog, name);
      gl.enableVertexAttribArray(l);
      gl.vertexAttribPointer(l, size, Kind, false, 0, 0);
      return b;
    };
    buf.from = attach('a_from', posA, 2, gl.FLOAT);
    buf.to   = attach('a_to',   posB, 2, gl.FLOAT);
    attach('a_len', U.lens, 1, gl.UNSIGNED_SHORT);
    attach('a_fam', U.inFam, 1, gl.UNSIGNED_BYTE);
    attach('a_key', Float32Array.from(U.keys), 1, gl.FLOAT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    return true;
  } catch (e) {
    gl = null;
    console.warn('WebGL setup failed, falling back:', e.message);
    return fallback2d();
  }
}

function fallback2d() {
  const fresh = stage.cloneNode(false);
  stage.replaceWith(fresh); stage = fresh;
  ctx2d = stage.getContext('2d');
  $('hint').textContent = ctx2d
    ? 'drawn without the GPU: at low zoom one point in seven is plotted'
    : 'this browser gave neither a GPU nor a 2D canvas';
  return false;
}

function resize() {
  view.dpr = Math.min(window.devicePixelRatio || 1, 2);
  view.w = stage.clientWidth; view.h = stage.clientHeight;
  stage.width = Math.round(view.w * view.dpr);
  stage.height = Math.round(view.h * view.dpr);
  if (gl) gl.viewport(0, 0, stage.width, stage.height);
}

function render() {
  if (gl) {
    gl.clearColor(0.043, 0.051, 0.071, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(loc.u_res, stage.width, stage.height);
    gl.uniform2f(loc.u_cam, view.x, view.y);
    gl.uniform1f(loc.u_zoom, view.zoom * view.dpr);
    gl.uniform1f(loc.u_dpr, view.dpr);
    gl.uniform1f(loc.u_mix, view.mix);
    gl.uniform1f(loc.u_beam, view.beamR);
    gl.uniform1f(loc.u_beamOn, view.law === 'beam' ? 1 : 0);
    gl.drawArrays(gl.POINTS, 0, U.n);
  } else if (ctx2d) {
    const c = ctx2d, t = view.mix;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#0b0d12'; c.fillRect(0, 0, stage.width, stage.height);
    c.fillStyle = '#8b93a7';
    const step = view.zoom < 0.6 ? 7 : 1;
    for (let i = 0; i < U.n; i += step) {
      const ax = posA[i*2], ay = posA[i*2+1], bx = posB[i*2], by = posB[i*2+1];
      const x = ((ax + (bx-ax)*t) - view.x) * view.zoom * view.dpr + stage.width/2;
      const y = stage.height/2 - ((ay + (by-ay)*t) - view.y) * view.zoom * view.dpr;
      if (x < 0 || y < 0 || x > stage.width || y > stage.height) continue;
      c.fillRect(x, y, view.dpr, view.dpr);
    }
  }
}

let pending = false;
const draw = () => { if (!pending) { pending = true; requestAnimationFrame(() => { pending = false; render(); }); } };

/* ── switching law ───────────────────────────────────────────────────────── */

function frame(p) {
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  for (let i = 0; i < p.length; i += 2) {
    if (p[i] < minx) minx = p[i]; if (p[i] > maxx) maxx = p[i];
    if (p[i+1] < miny) miny = p[i+1]; if (p[i+1] > maxy) maxy = p[i+1];
  }
  const w = Math.max(maxx - minx, 1e-6), h = Math.max(maxy - miny, 1e-6);
  return { cx: (minx + maxx) / 2, cy: (miny + maxy) / 2,
           zoom: Math.min(view.w / (w * 1.12), view.h / (h * 1.12)) };
}

function apply(lawId, instant) {
  const law = byId[lawId];
  view.law = lawId;
  document.querySelectorAll('.law').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.law === lawId)));
  $('lawTitle').textContent = law.title;
  $('lawBorrows').textContent = law.borrows;
  $('lawReads').textContent = 'reads: ' + law.reads;
  $('lawNote').textContent = law.note;
  $('beamRow').hidden = lawId !== 'beam';

  posA = posB ? Float32Array.from(posB) : positions(lawId);
  posB = positions(lawId);
  if (gl) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.from); gl.bufferSubData(gl.ARRAY_BUFFER, 0, posA);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.to);   gl.bufferSubData(gl.ARRAY_BUFFER, 0, posB);
  }
  const f = frame(posB);
  const z0 = view.zoom, x0 = view.x, y0 = view.y;
  const t0 = performance.now(), ms = instant ? 0 : 1100;
  view.mix = 0;
  history.replaceState(null, '', '?law=' + lawId);
  (function step(t) {
    const u = ms === 0 ? 1 : Math.min(1, (t - t0) / ms);
    view.mix = u;
    view.x = x0 + (f.cx - x0) * u; view.y = y0 + (f.cy - y0) * u;
    view.zoom = Math.exp(Math.log(z0) + (Math.log(f.zoom) - Math.log(z0)) * u);
    render();
    if (u < 1) requestAnimationFrame(step);
  })(t0);
}

/* ── gestures ────────────────────────────────────────────────────────────── */

function gestures() {
  const pts = new Map(); let pinch = null;
  stage.addEventListener('pointerdown', e => {
    stage.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2) { const [p, q] = [...pts.values()];
      pinch = { d: Math.hypot(p[0]-q[0], p[1]-q[1]), z: view.zoom }; }
  });
  stage.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    const prev = pts.get(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2 && pinch) {
      const [p, q] = [...pts.values()], d = Math.hypot(p[0]-q[0], p[1]-q[1]);
      if (pinch.d > 0) view.zoom = Math.max(0.02, Math.min(4000, pinch.z * (d / pinch.d)));
      draw(); return;
    }
    view.x -= (e.clientX - prev[0]) / view.zoom;
    view.y += (e.clientY - prev[1]) / view.zoom;
    draw();
  });
  const up = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; };
  stage.addEventListener('pointerup', up);
  stage.addEventListener('pointercancel', up);
  stage.addEventListener('wheel', e => {
    e.preventDefault();
    view.zoom = Math.max(0.02, Math.min(4000, view.zoom * Math.exp(-e.deltaY * 0.0016)));
    draw();
  }, { passive: false });
  window.addEventListener('keydown', e => {
    const n = Number(e.key);
    if (n >= 1 && n <= 9) apply(LAWS[n - 1].id);
    else if (e.key === '0') apply(LAWS[9].id);
  });
}

/* ── start ───────────────────────────────────────────────────────────────── */

(async function start() {
  const bar = $('laws');
  LAWS.forEach((l, i) => {
    const b = document.createElement('button');
    b.className = 'law'; b.dataset.law = l.id; b.type = 'button';
    b.setAttribute('aria-pressed', String(i === 0));
    b.innerHTML = `<span class="num">${(i + 1) % 10}</span>${l.title}`;
    b.addEventListener('click', () => apply(l.id));
    bar.appendChild(b);
  });

  try { await tier1(); }
  catch (e) {
    $('count').textContent = 'Could not load the numbered database: ' + e.message
      + '. Check the internet connection and reload.';
    return;
  }

  resize();
  posB = positions('wafer'); posA = Float32Array.from(posB);
  initGL();
  const want = new URLSearchParams(location.search).get('law');
  apply(byId[want] ? want : 'wafer', true);
  gestures();
  window.addEventListener('resize', () => { resize(); draw(); });
  $('beam').addEventListener('input', e => {
    view.beamR = Number(e.target.value) / 100 * Math.sqrt(U.meta.max);
    $('beamOut').textContent = `beam at radius ${Math.round(view.beamR)}`;
    draw();
  });

  tier2().catch(e => { $('prov').textContent = 'family index unavailable: ' + e.message; });
})();
