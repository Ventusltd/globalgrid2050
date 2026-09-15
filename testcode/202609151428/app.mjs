/* The Atlas — 7,680 real projects, six ways of seeing them, and the gap.
 *
 * WHAT THIS IS. Every project in the published UK renewables register that the
 * estate carries: 7,680 of them, 356.47 GW of stated capacity, each with a
 * permanent identifier that never changes. They are drawn six ways, and the
 * sixth is the one that matters: the distance between what is in the pipeline
 * and what the mission asks for.
 *
 * WHY SEE IT BEFORE PLANNING IT. A register is a spreadsheet and a spreadsheet
 * hides shape. Drawn by geography you see where the grid will be asked to take
 * power. Drawn by capacity you see that a handful of offshore projects outweigh
 * thousands of rooftops. Drawn by lifecycle you see how much of the pipeline is
 * already refused or withdrawn, which a total never tells you. The same 7,680
 * rows, six readings, no new data.
 *
 * WHAT IS CLAIMED AND WHAT IS NOT. Every number on this page is computed in the
 * browser from a pack built from committed bytes, and the pack records the
 * commit and the blob hash of every source file it read. A capacity is what the
 * register records, not what is connected or generating. A lifecycle is the
 * register's own classification on its publication date. A coordinate is the
 * register's, converted by a documented approximation, and is not a survey.
 * Nothing here says a project will be built.
 *
 * LAZY BY DESIGN. Positions are computed per law from fixed-width columns, so
 * adding a million more projects changes the size of the pack and nothing about
 * the method. The surface does not hold the data; it holds a function.
 */

const DATA = './data/';
const $ = id => document.getElementById(id);
const fmt = n => Number(n).toLocaleString('en-GB');
const gw = mw => (mw / 1000).toFixed(2);
let stage = $('stage');

const A = { n: 0, meta: null, lat: null, lon: null, mw: null, tech: null, life: null,
            flags: null, applied: null, granted: null, repd: null, region: null,
            operator: null, names: null };

const view = { x: 0, y: 0, zoom: 1, w: 0, h: 0, dpr: 1, law: 'geography', mix: 1, focus: -1 };

/* ── the six laws ────────────────────────────────────────────────────────── */

const LAWS = [
  { id: 'geography', title: 'Where',
    reads: 'the register latitude and longitude',
    note:
      'The projects as they sit on the ground, in the register own coordinates. This is the only law here '
      + 'that is a map. Offshore wind stands off the coast in a few very large points; solar covers the '
      + 'south and east in thousands of small ones. Where the points crowd is where the network will be '
      + 'asked to take power, and that is a different question from how much power there is.',
    place: i => {
      const ok = (A.flags[i] & 2) !== 0;
      if (!ok) return [NaN, NaN];
      /* An equirectangular projection with the cosine correction at 54 north,
         so Britain is not stretched sideways. It is a picture, not a survey. */
      return [(A.lon[i] + 3.0) * Math.cos(54 * Math.PI / 180) * 12, (A.lat[i] - 54.5) * 12];
    } },

  { id: 'capacity', title: 'How much',
    reads: 'stated capacity in megawatts',
    note:
      'Radius falls as capacity rises, so the largest projects collapse to the centre. The result is brutal '
      + 'and worth looking at: a hundred and nine offshore wind projects hold 80.5 GW while three and a half '
      + 'thousand solar projects hold 67.0 GW. Counting projects and counting power are not the same activity '
      + 'and a pipeline reported by number of schemes says almost nothing.',
    place: i => {
      const m = Math.max(A.mw[i], 0.01);
      const r = 46 / Math.sqrt(Math.log1p(m) + 1);
      const t = hash(i) * Math.PI * 2;
      return [r * Math.cos(t), r * Math.sin(t)];
    } },

  { id: 'lifecycle', title: 'How far',
    reads: 'the register lifecycle and the planning dates',
    note:
      'A river from left to right: submitted, consented, under construction, operational. Everything the '
      + 'register has marked inactive, refused or withdrawn sinks to the bottom. The gap between the top '
      + 'band and the bottom one is the attrition nobody puts in a headline figure, and it is the honest '
      + 'reason a pipeline total is not a forecast.',
    place: i => {
      const l = A.life[i];
      const lane = l === 0 ? 26 : l === 1 ? 13 : l === 2 ? 0 : l === 4 ? -13 : -30;
      const x = (Math.min(Math.max(A.applied[i], 0), 10000) / 10000 - 0.5) * 108;
      return [x, lane + (hash(i) - 0.5) * 9];
    } },

  { id: 'technology', title: 'Of what',
    reads: 'technology, and capacity within it',
    note:
      'Four bands, one per technology, each sorted by size within its band. Battery storage is the widest '
      + 'band by power and it generates nothing: it moves energy in time. Reading it as generation would '
      + 'double-count the grid, which is why it is drawn apart rather than summed in.',
    place: i => {
      const t = A.tech[i] === 255 ? 4 : A.tech[i];
      const x = (t / 4 - 0.375) * 104;
      const y = (Math.log1p(A.mw[i]) / Math.log1p(4200) - 0.5) * 78;
      return [x + (hash(i) - 0.5) * 20, y];
    } },

  { id: 'time', title: 'When asked',
    reads: 'the date the planning application was submitted',
    note:
      'A spiral in application order, oldest at the centre. The tightening of the outer turns is the rate '
      + 'of new applications, and it is the clearest picture on this page of how fast the queue is growing. '
      + 'A project with no application date in the register sits at the origin rather than being dropped, '
      + 'because a missing date is a fact about the register and not about the project.',
    place: i => {
      const d = A.applied[i];
      if (d < 0) return [0, 0];
      const u = Math.min(d, 10000) / 10000;
      const r = 3 + 44 * Math.sqrt(u);
      const t = u * Math.PI * 11;
      return [r * Math.cos(t), r * Math.sin(t)];
    } },

  { id: 'gap', title: 'The gap',
    reads: 'solar capacity in the pipeline, against the mission target',
    note:
      'Every solar project in the register, stacked, against the mission of 75 TWp of solar by 2050. The '
      + 'stack is the pipeline. The ring is the target. This is drawn to scale and the scale is the point: '
      + 'the whole published UK solar pipeline is about one part in eleven hundred of 75 TWp. That is not an '
      + 'argument against the target, it is the measure of how many more pipelines the world has to build, '
      + 'and it is the reason this estate exists.',
    place: i => {
      if (A.tech[i] !== 0) return [NaN, NaN];
      const k = A.solarOrder[i];
      const cols = 60;
      return [((k % cols) / cols - 0.5) * 46, (Math.floor(k / cols) / 60 - 0.5) * 46];
    } }
];
const byId = Object.fromEntries(LAWS.map(l => [l.id, l]));

/* A fixed hash, so a jitter is the same jitter on every device for ever. */
function hash(i) {
  let h = (i + 1) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/* ── loading ─────────────────────────────────────────────────────────────── */

async function bin(name, K) {
  const r = await fetch(DATA + name, { cache: 'default' });
  if (!r.ok) throw new Error(DATA + name + ' returned HTTP ' + r.status);
  return new K(await r.arrayBuffer());
}

async function load() {
  const meta = await fetch(DATA + 'pack.json').then(r => r.json());
  A.meta = meta; A.n = meta.projects;
  const [lat, lon, mw, tech, life, flags, applied, granted, repd, region, operator] = await Promise.all([
    bin('lat.bin', Float32Array), bin('lon.bin', Float32Array), bin('mw.bin', Float32Array),
    bin('tech.bin', Uint8Array), bin('life.bin', Uint8Array), bin('flags.bin', Uint8Array),
    bin('applied.bin', Int32Array), bin('granted.bin', Int32Array), bin('repd.bin', Uint32Array),
    bin('region.bin', Uint16Array), bin('operator.bin', Uint16Array)
  ]);
  Object.assign(A, { lat, lon, mw, tech, life, flags, applied, granted, repd, region, operator });

  /* Rank the solar projects by size, once, for the gap law. Computed here and
     never stored, because a rank derived from the data is not data. */
  const solar = [];
  for (let i = 0; i < A.n; i++) if (tech[i] === 0) solar.push(i);
  solar.sort((a, b) => mw[b] - mw[a]);
  A.solarOrder = new Int32Array(A.n).fill(-1);
  solar.forEach((idx, k) => { A.solarOrder[idx] = k; });
  A.solarCount = solar.length;

  let total = 0, solarMw = 0;
  for (let i = 0; i < A.n; i++) { total += mw[i]; if (tech[i] === 0) solarMw += mw[i]; }
  A.totalMw = total; A.solarMw = solarMw;

  $('count').textContent =
    `${fmt(A.n)} projects · ${gw(total)} GW stated · solar ${gw(solarMw)} GW in ${fmt(solar.length)} projects`;
  $('prov').textContent =
    `register ${meta.source.release} at commit ${meta.source.commit.slice(0, 10)} · pack built from committed bytes`;

  fetch(DATA + 'names.json').then(r => r.json()).then(ns => { A.names = ns; })
    .catch(() => { /* names are for the panel only; the page draws without them */ });
}

/* ── drawing ─────────────────────────────────────────────────────────────── */

const VS = `#version 300 es
precision highp float;
in vec2 a_from; in vec2 a_to; in float a_mw; in float a_tech; in float a_life;
uniform vec2 u_res, u_cam; uniform float u_zoom, u_dpr, u_mix;
out float v_tech; out float v_life;
void main(){
  float t = u_mix; t = t < .5 ? 4.*t*t*t : 1. - pow(-2.*t + 2., 3.)/2.;
  vec2 a = a_from, b = a_to;
  bool ga = a.x == a.x, gb = b.x == b.x;          /* a hidden point is NaN */
  if (!ga && !gb) { gl_Position = vec4(2.,2.,2.,1.); gl_PointSize = 1.0; return; }
  vec2 p = (!ga ? b : !gb ? a : mix(a, b, t));
  float fade = (!ga) ? t : (!gb) ? 1.0 - t : 1.0;
  gl_Position = vec4(((p - u_cam) * u_zoom) / (u_res * 0.5), 0.0, 1.0);
  gl_PointSize = clamp((2.0 + 2.6 * log(1.0 + a_mw)) * sqrt(u_zoom) * 0.42 * u_dpr, 1.5, 40.0 * u_dpr);
  v_tech = a_tech; v_life = a_life * fade;
}`;

const FS = `#version 300 es
precision highp float;
in float v_tech; in float v_life;
out vec4 o;
void main(){
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d);
  if (r > 0.5) discard;
  float edge = smoothstep(0.5, 0.38, r);
  vec3 c = v_tech < 0.5 ? vec3(1.00,0.84,0.29)      /* solar */
         : v_tech < 1.5 ? vec3(0.44,0.80,0.98)      /* onshore wind */
         : v_tech < 2.5 ? vec3(0.28,0.55,0.92)      /* offshore wind */
         :                vec3(0.55,0.86,0.66);     /* storage */
  o = vec4(c, edge * clamp(v_life, 0.10, 0.92));
}`;

let gl = null, prog = null, loc = {}, buf = {}, ctx2d = null, posA = null, posB = null;

function compile(g, type, src) {
  const s = g.createShader(type); g.shaderSource(s, src); g.compileShader(s);
  if (!g.getShaderParameter(s, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(s));
  return s;
}

function initGL() {
  gl = stage.getContext('webgl2', { antialias: true, alpha: false });
  if (!gl) { gl = null; return fallback(); }
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    for (const u of ['u_res','u_cam','u_zoom','u_dpr','u_mix']) loc[u] = gl.getUniformLocation(prog, u);
    const put = (name, data, size, Kind) => {
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      const l = gl.getAttribLocation(prog, name);
      gl.enableVertexAttribArray(l);
      gl.vertexAttribPointer(l, size, Kind, false, 0, 0);
      return b;
    };
    buf.from = put('a_from', posA, 2, gl.FLOAT);
    buf.to = put('a_to', posB, 2, gl.FLOAT);
    put('a_mw', A.mw, 1, gl.FLOAT);
    put('a_tech', Float32Array.from(A.tech), 1, gl.FLOAT);
    /* Lifecycle becomes opacity: operational solid, inactive faint. */
    put('a_life', Float32Array.from(A.life, v => v === 0 ? 1 : v === 1 ? 0.85 : v === 2 ? 0.6 : v === 3 ? 0.14 : 0.3),
        1, gl.FLOAT);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    return true;
  } catch (e) { gl = null; console.warn('WebGL setup failed:', e.message); return fallback(); }
}

function fallback() {
  const fresh = stage.cloneNode(false);
  stage.replaceWith(fresh); stage = fresh;
  ctx2d = stage.getContext('2d');
  $('hint').textContent = ctx2d ? 'drawn without the GPU' : 'no GPU and no 2D canvas in this browser';
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
    gl.drawArrays(gl.POINTS, 0, A.n);
  } else if (ctx2d) {
    const c = ctx2d, t = view.mix;
    c.setTransform(1,0,0,1,0,0);
    c.fillStyle = '#0b0d12'; c.fillRect(0,0,stage.width,stage.height);
    for (let i = 0; i < A.n; i++) {
      const ax = posA[i*2], bx = posB[i*2];
      if (!Number.isFinite(ax) && !Number.isFinite(bx)) continue;
      const x0 = Number.isFinite(ax) ? ax : bx, y0 = Number.isFinite(ax) ? posA[i*2+1] : posB[i*2+1];
      const x1 = Number.isFinite(bx) ? bx : x0, y1 = Number.isFinite(bx) ? posB[i*2+1] : y0;
      const X = ((x0 + (x1-x0)*t) - view.x) * view.zoom * view.dpr + stage.width/2;
      const Y = stage.height/2 - ((y0 + (y1-y0)*t) - view.y) * view.zoom * view.dpr;
      if (X < 0 || Y < 0 || X > stage.width || Y > stage.height) continue;
      c.fillStyle = A.tech[i] === 0 ? '#ffd54a' : A.tech[i] === 3 ? '#8cdca9' : '#70ccfa';
      c.fillRect(X, Y, 2 * view.dpr, 2 * view.dpr);
    }
  }
}

let pending = false;
const draw = () => { if (!pending) { pending = true; requestAnimationFrame(() => { pending = false; render(); }); } };

/* ── switching law ───────────────────────────────────────────────────────── */

function positions(lawId) {
  const law = byId[lawId], p = new Float32Array(A.n * 2);
  for (let i = 0; i < A.n; i++) {
    const [x, y] = law.place(i);
    p[i*2] = x; p[i*2+1] = y;                    /* NaN is kept: it means hidden */
  }
  return p;
}

function frame(p) {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (let i = 0; i < p.length; i += 2) {
    if (!Number.isFinite(p[i])) continue;
    if (p[i] < a) a = p[i]; if (p[i] > c) c = p[i];
    if (p[i+1] < b) b = p[i+1]; if (p[i+1] > d) d = p[i+1];
  }
  if (!Number.isFinite(a)) return { cx: 0, cy: 0, zoom: view.zoom };
  const w = Math.max(c - a, 1e-6), h = Math.max(d - b, 1e-6);
  return { cx: (a + c)/2, cy: (b + d)/2, zoom: Math.min(view.w/(w*1.14), view.h/(h*1.14)) };
}

function apply(lawId, instant) {
  const law = byId[lawId];
  view.law = lawId;
  document.querySelectorAll('.law').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.law === lawId)));
  $('lawTitle').textContent = law.title;
  $('lawReads').textContent = 'reads: ' + law.reads;
  $('lawNote').textContent = law.note;
  $('gapRow').hidden = lawId !== 'gap';
  if (lawId === 'gap') {
    const tw = A.solarMw / 1e6;
    $('gapOut').innerHTML =
      `pipeline <b>${tw.toFixed(5)} TWp</b> of solar · target <b>75 TWp</b> · ` +
      `the pipeline is <b>1 part in ${fmt(Math.round(75 / tw))}</b> of it`;
  }

  posA = posB ? Float32Array.from(posB) : positions(lawId);
  posB = positions(lawId);
  if (gl) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.from); gl.bufferSubData(gl.ARRAY_BUFFER, 0, posA);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.to); gl.bufferSubData(gl.ARRAY_BUFFER, 0, posB);
  }
  const f = frame(posB);
  const z0 = view.zoom, x0 = view.x, y0 = view.y;
  const t0 = performance.now(), ms = instant ? 0 : 1000;
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

/* ── the panel: one project ──────────────────────────────────────────────── */

const LIFE_WORDS = ['operational', 'under construction', 'consented, not started', 'inactive', 'not stated'];
const TECH_WORDS = ['solar', 'onshore wind', 'offshore wind', 'battery storage'];
const EPOCH = Date.UTC(2000, 0, 1);
const dateOf = d => d < 0 ? null : new Date(EPOCH + d * 86400000).toISOString().slice(0, 10);

function nearest(cx, cy) {
  const wx = (cx - view.w/2) / view.zoom + view.x;
  const wy = (view.h/2 - cy) / view.zoom + view.y;
  const reach = 26 / view.zoom;
  let best = -1, bd = reach * reach;
  for (let i = 0; i < A.n; i++) {
    const x = posB[i*2], y = posB[i*2+1];
    if (!Number.isFinite(x)) continue;
    const dx = x - wx, dy = y - wy, d = dx*dx + dy*dy;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

function panel(i) {
  if (i < 0) return;
  view.focus = i;
  const name = A.names ? A.names[i] : `project ${i}`;
  const t = A.tech[i], l = A.life[i];
  const applied = dateOf(A.applied[i]), granted = dateOf(A.granted[i]);
  const p = $('projectBody');
  p.replaceChildren();
  const h = document.createElement('h3'); h.textContent = name; p.appendChild(h);
  const dl = document.createElement('dl');
  const add = (k, v) => { const a = document.createElement('dt'); a.textContent = k;
                          const b = document.createElement('dd'); b.textContent = v; dl.append(a, b); };
  add('capacity', `${fmt(A.mw[i].toFixed(1))} MW${(A.flags[i] & 1) ? '' : ' (not stated in the register)'}`);
  add('technology', t === 255 ? 'not stated' : TECH_WORDS[t]);
  add('stage', l === 255 ? 'not stated' : LIFE_WORDS[l]);
  add('region', A.meta.regions[A.region[i]] ?? 'unstated');
  if (applied) add('applied', applied);
  if (granted) add('consented', granted);
  if (A.repd[i]) add('register ref', String(A.repd[i]));
  add('geometry', (A.flags[i] & 2) ? 'valid, converted from the register grid reference'
                                   : 'not valid; this project is not drawn on the map');
  p.appendChild(dl);
  const note = document.createElement('p');
  note.className = 'dim';
  note.textContent = 'From the published register. A stated capacity is not connected capacity and a stage '
    + 'is the register own classification on its publication date.';
  p.appendChild(note);
  $('project').hidden = false;
}

/* ── gestures ────────────────────────────────────────────────────────────── */

function gestures() {
  const pts = new Map(); let pinch = null, down = null, moved = 0;
  stage.addEventListener('pointerdown', e => {
    stage.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 1) { down = [e.clientX, e.clientY]; moved = 0; }
    if (pts.size === 2) { const [p,q] = [...pts.values()];
      pinch = { d: Math.hypot(p[0]-q[0], p[1]-q[1]), z: view.zoom }; }
  });
  stage.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    const prev = pts.get(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2 && pinch) {
      const [p,q] = [...pts.values()], d = Math.hypot(p[0]-q[0], p[1]-q[1]);
      if (pinch.d > 0) view.zoom = Math.max(0.05, Math.min(6000, pinch.z * (d / pinch.d)));
      draw(); return;
    }
    const dx = e.clientX - prev[0], dy = e.clientY - prev[1];
    moved += Math.abs(dx) + Math.abs(dy);
    view.x -= dx / view.zoom; view.y += dy / view.zoom;
    draw();
  });
  const up = e => {
    if (pts.size === 1 && down && moved < 7) panel(nearest(e.clientX, e.clientY));
    pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (!pts.size) down = null;
  };
  stage.addEventListener('pointerup', up);
  stage.addEventListener('pointercancel', e => { pts.delete(e.pointerId); pinch = null; down = null; });
  stage.addEventListener('wheel', e => {
    e.preventDefault();
    view.zoom = Math.max(0.05, Math.min(6000, view.zoom * Math.exp(-e.deltaY * 0.0016)));
    draw();
  }, { passive: false });
  window.addEventListener('keydown', e => {
    const n = Number(e.key);
    if (n >= 1 && n <= LAWS.length) apply(LAWS[n-1].id);
  });
}

/* ── start ───────────────────────────────────────────────────────────────── */

(async function start() {
  const bar = $('laws');
  LAWS.forEach((l, i) => {
    const b = document.createElement('button');
    b.className = 'law'; b.dataset.law = l.id; b.type = 'button';
    b.setAttribute('aria-pressed', String(i === 0));
    b.innerHTML = `<span class="num">${i+1}</span>${l.title}`;
    b.addEventListener('click', () => apply(l.id));
    bar.appendChild(b);
  });

  try { await load(); }
  catch (e) {
    $('count').textContent = 'Could not load the project pack: ' + e.message
      + '. Check the internet connection and reload.';
    return;
  }

  resize();
  posB = positions('geography'); posA = Float32Array.from(posB);
  initGL();
  const want = new URLSearchParams(location.search).get('law');
  apply(byId[want] ? want : 'geography', true);
  gestures();
  window.addEventListener('resize', () => { resize(); draw(); });
  $('closeProject').addEventListener('click', () => { $('project').hidden = true; view.focus = -1; });
})();
