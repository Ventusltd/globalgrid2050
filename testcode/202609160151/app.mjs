/* The Line Wafer.
 *
 * WHAT THIS IS. Every line of code in the estate that has been given a
 * permanent number is one point on one surface. There are 250,174 of them and
 * they are numbered 1 to 342,795: the number is the line's permanent key, it
 * never changes and it is never reused, and numbers missing from the sequence
 * were never issued. Those gaps are drawn as gaps.
 *
 * WHY THE NUMBER IS THE ADDRESS. A point's position here is a pure function of
 * its own permanent key and of nothing else:
 *
 *     r = SPACING * sqrt(key)        theta = key * GOLDEN
 *
 * so line 8,285 is in the same place on every device, in every session, for
 * ever, and the surface can be reconstituted from the numbers alone. Nothing
 * about a position is stored, fetched or remembered. That is what makes the
 * surface unbounded rather than large: the estate can issue line 400,000
 * tomorrow and the wafer already has somewhere to put it.
 *
 * THE BEAM. The camera is a beam. It steers over the wafer and focuses, and
 * where it focuses the structure resolves — one line, its length, whether any
 * function family carries it, and which. Focus is the only instrument; there
 * are no levels and nothing is pre-rendered.
 *
 * THE RULE THIS PAGE EXISTS TO MEET. It must be able to connect any two
 * uniquely numbered lines in the estate. Type two numbers and it answers: the
 * families that carry both, or a refusal naming which of the two no family
 * carries.
 *
 * TWO RELATIONS, AND THE FIRST VERSION OF THIS PAGE CONFUSED THEM.
 * FANOUT is one number appearing in several families: the same text sitting in
 * several places, which is duplication. CO-MEMBERSHIP is two different numbers
 * appearing in one family: two lines of the same function, which is
 * neighbourhood and is NOT the same text. Connecting uses co-membership, so a
 * line carried by exactly one family is perfectly connectable — to another line
 * of that family. The page originally claimed the opposite and a reviewer was
 * right to reject it. See lib.mjs.
 *
 * WHAT IS NOT CLAIMED. Neither relation is a dependency and neither means one
 * line calls the other. Triviality is visible rather than hidden: a line's
 * fanout is printed, so line 2, an empty line in 2,281 families, looks exactly
 * as meaningless as it is.
 */

import { place, placeAll, parseKey, indexOfKey as findKey, ownersOf, fanoutCount,
         connectAnswer, esc, fmt, SPACING } from './lib.mjs';
import { buildPickIndex, nearestAt } from './pick.mjs';
import { openLineStore } from './read.mjs';
import * as SEL from './select.mjs';

const DATA = '../202609142202/data/';

const $ = id => document.getElementById(id);
let stage = $("stage");

const U = {
  fanout: null,        /* lines carried by MORE THAN ONE family; counted, never typed */
  keys: null,        /* Uint32Array, sorted: every permanent line number issued */
  lens: null,        /* Uint16Array: characters in that line */
  inFam: null,       /* Uint8Array: 1 when at least one family carries it */
  pos: null,         /* Float32Array 2N: the pure function of the key */
  n: 0,
  families: null,    /* tier 2 */
  famLines: null,
  ownerOf: null,     /* Map<key, number[]> family indexes, built once on demand */
  meta: null
};

const view = { x: 0, y: 0, zoom: 1, w: 0, h: 0, dpr: 1, focus: -1, link: null };

/* ── the surface ─────────────────────────────────────────────────────────── */

const placeOne = place;                       /* where a number sits, issued or not */
const indexOfKey = key => findKey(U.keys, key);

/* ── loading ─────────────────────────────────────────────────────────────── */

async function bin(name, Kind) {
  const r = await fetch(DATA + name, { cache: 'default' });
  if (!r.ok) throw new Error(DATA + name + ' returned HTTP ' + r.status);
  return new Kind(await r.arrayBuffer());
}

async function tier1() {
  const [meta, keys, lens, inFam] = await Promise.all([
    fetch(DATA + 'all-lines.meta.json').then(r => r.json()),
    bin('all-lines.bin', Uint32Array),
    bin('all-lines.len.bin', Uint16Array),
    bin('all-lines.family.bin', Uint8Array)
  ]);
  U.meta = meta; U.keys = keys; U.lens = lens; U.inFam = inFam; U.n = keys.length;
  U.pos = placeAll(keys);
  U.pick = buildPickIndex(U.pos, U.n, SPACING);

  let carried = 0;
  for (let i = 0; i < inFam.length; i++) carried += inFam[i];
  $('count').textContent =
    `${fmt(U.n)} numbered lines · 1 to ${fmt(meta.max)} · ${fmt(carried)} carried by a family`;
  $('prov').textContent =
    `numbered database built ${meta.built_utc.slice(0, 16).replace('T', ' ')} UTC · pack ${meta.source.sha256.slice(0, 12)}`;
}

async function tier2() {
  const [families, famLines] = await Promise.all([
    fetch(DATA + 'families.json').then(r => r.json()),
    bin('lines.bin', Uint32Array)
  ]);
  U.families = families; U.famLines = famLines;
  const owner = ownersOf(families, famLines);
  U.ownerOf = owner;
  U.fanout = fanoutCount(owner);
  if (view.focus >= 0) paintPanel(view.focus);
  if (view.link) connect(view.link[0], view.link[1]);
}

/* ── drawing ─────────────────────────────────────────────────────────────── */

const VS = `#version 300 es
precision highp float;
in vec2 a_pos; in float a_len; in float a_fam;
uniform vec2 u_res; uniform vec2 u_cam; uniform float u_zoom; uniform float u_dpr;
uniform float u_focusKey;
out float v_fam; out float v_len; out float v_focus;
void main(){
  vec2 p = (a_pos - u_cam) * u_zoom;
  gl_Position = vec4(p / (u_res * 0.5), 0.0, 1.0);
  float base = 1.0 + min(a_len, 120.0) * 0.012;
  gl_PointSize = clamp(base * sqrt(u_zoom) * u_dpr, 1.0, 26.0 * u_dpr);
  v_fam = a_fam; v_len = a_len; v_focus = 0.0;
}`;

const FS = `#version 300 es
precision highp float;
in float v_fam; in float v_len; in float v_focus;
out vec4 o;
void main(){
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d);
  if (r > 0.5) discard;
  float edge = smoothstep(0.5, 0.42, r);
  vec3 carried = vec3(0.84, 0.87, 0.94);
  vec3 alone   = vec3(0.30, 0.34, 0.44);
  vec3 c = mix(alone, carried, v_fam);
  o = vec4(c, edge * (0.30 + 0.70 * v_fam));
}`;

let gl = null, prog = null, loc = {}, vao = null, ctx2d = null;

function compile(g, type, src) {
  const s = g.createShader(type); g.shaderSource(s, src); g.compileShader(s);
  if (!g.getShaderParameter(s, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(s));
  return s;
}

/* If anything after acquiring the context fails — a shader that will not compile
   on some driver, a program that will not link — the page must fall back, not
   half-run. A canvas cannot hand out a 2D context once it has given out a WebGL
   one, so the canvas itself is replaced. The first version left `gl` non-null on
   failure and then asked the same canvas for a 2D context, which returns null:
   the fallback it advertised did not exist. */
function initGL() {
  gl = stage.getContext('webgl2', { antialias: true, alpha: false });
  if (!gl) { gl = null; return fallback2d(); }
  try { return buildGL(); }
  catch (e) { gl = null; console.warn('WebGL setup failed, falling back:', e.message); return fallback2d(); }
}

function fallback2d() {
  const fresh = stage.cloneNode(false);
  stage.replaceWith(fresh);
  stage = fresh;
  ctx2d = stage.getContext('2d');
  $('hint').textContent = ctx2d
    ? 'drawn without the GPU: at low zoom one line in seven is plotted'
    : 'this browser gave neither a GPU nor a 2D canvas; nothing can be drawn';
  return false;
}

function buildGL() {
  prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  for (const u of ['u_res', 'u_cam', 'u_zoom', 'u_dpr', 'u_focusKey']) loc[u] = gl.getUniformLocation(prog, u);

  vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const put = (data, name, size, Kind, norm) => {
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    const l = gl.getAttribLocation(prog, name);
    gl.enableVertexAttribArray(l);
    gl.vertexAttribPointer(l, size, Kind, !!norm, 0, 0);
  };
  put(U.pos, 'a_pos', 2, gl.FLOAT, false);
  put(U.lens, 'a_len', 1, gl.UNSIGNED_SHORT, false);
  put(U.inFam, 'a_fam', 1, gl.UNSIGNED_BYTE, false);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  return true;
}

function resize() {
  view.dpr = Math.min(window.devicePixelRatio || 1, 2);
  view.w = stage.clientWidth; view.h = stage.clientHeight;
  stage.width = Math.round(view.w * view.dpr);
  stage.height = Math.round(view.h * view.dpr);
  if (gl) gl.viewport(0, 0, stage.width, stage.height);
}

let overlay = null;
function ensureOverlay() {
  if (overlay) return overlay;
  overlay = document.createElement('canvas');
  overlay.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:1';
  document.body.appendChild(overlay);
  return overlay;
}

function drawMarks() {
  const o = ensureOverlay();
  o.width = stage.width; o.height = stage.height;
  const c = o.getContext('2d');
  c.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  c.clearRect(0, 0, view.w, view.h);
  const toScreen = ([x, y]) => [
    (x - view.x) * view.zoom + view.w / 2,
    view.h / 2 - ((y - view.y) * view.zoom)
  ];
  SEL.drawSet(c, view);
  if (view.link) {
    const [ka, kb] = view.link;
    const A = toScreen(placeOne(ka)), B = toScreen(placeOne(kb));
    c.strokeStyle = '#ff2bd6'; c.lineWidth = 1.6; c.setLineDash([5, 4]);
    c.beginPath(); c.moveTo(A[0], A[1]);
    c.quadraticCurveTo((A[0] + B[0]) / 2, (A[1] + B[1]) / 2 - 40, B[0], B[1]);
    c.stroke(); c.setLineDash([]);
    for (const P of [A, B]) {
      c.strokeStyle = '#ff2bd6'; c.beginPath(); c.arc(P[0], P[1], 9, 0, 6.2832); c.stroke();
    }
  }
  if (view.focus >= 0) {
    const P = toScreen(placeOne(view.focus));
    c.strokeStyle = '#ffd54a'; c.lineWidth = 1.4;
    c.beginPath(); c.arc(P[0], P[1], 11, 0, 6.2832); c.stroke();
    c.beginPath(); c.moveTo(P[0] - 18, P[1]); c.lineTo(P[0] - 13, P[1]);
    c.moveTo(P[0] + 13, P[1]); c.lineTo(P[0] + 18, P[1]);
    c.moveTo(P[0], P[1] - 18); c.lineTo(P[0], P[1] - 13);
    c.moveTo(P[0], P[1] + 13); c.lineTo(P[0], P[1] + 18);
    c.stroke();
  }
}

function render() {
  if (gl) {
    gl.clearColor(0.043, 0.051, 0.071, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(prog); gl.bindVertexArray(vao);
    gl.uniform2f(loc.u_res, stage.width, stage.height);
    gl.uniform2f(loc.u_cam, view.x, view.y);
    gl.uniform1f(loc.u_zoom, view.zoom * view.dpr);
    gl.uniform1f(loc.u_dpr, view.dpr);
    gl.uniform1f(loc.u_focusKey, view.focus);
    gl.drawArrays(gl.POINTS, 0, U.n);
  } else if (ctx2d) {
    const c = ctx2d;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#0b0d12'; c.fillRect(0, 0, stage.width, stage.height);
    c.fillStyle = '#7d8598';
    const step = view.zoom < 0.5 ? 7 : 1;
    for (let i = 0; i < U.n; i += step) {
      const x = (U.pos[i * 2] - view.x) * view.zoom * view.dpr + stage.width / 2;
      const y = stage.height / 2 - (U.pos[i * 2 + 1] - view.y) * view.zoom * view.dpr;
      if (x < 0 || y < 0 || x > stage.width || y > stage.height) continue;
      c.fillRect(x, y, view.dpr, view.dpr);
    }
  }
  drawMarks();
}

let pending = false;
function draw() { if (!pending) { pending = true; requestAnimationFrame(() => { pending = false; render(); }); } }

/* ── the beam: steering and focusing ─────────────────────────────────────── */

function home() {
  const maxR = SPACING * Math.sqrt(U.meta.max);
  view.x = 0; view.y = 0;
  view.zoom = Math.min(view.w, view.h) / (maxR * 2.15);
  draw();
}

function flyTo(key, zoom) {
  const [x, y] = placeOne(key);
  const z0 = view.zoom, x0 = view.x, y0 = view.y;
  const z1 = zoom ?? Math.max(view.zoom, 9);
  const t0 = performance.now(), ms = 620;
  (function step(t) {
    const u = Math.min(1, (t - t0) / ms);
    const e = u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
    view.x = x0 + (x - x0) * e; view.y = y0 + (y - y0) * e;
    view.zoom = Math.exp(Math.log(z0) + (Math.log(z1) - Math.log(z0)) * e);
    render();
    if (u < 1) requestAnimationFrame(step);
  })(t0);
}

/* The line under the finger. Until iteration 49 this compared the tap with
   every point in the estate: 250,174 distance tests per tap then, 283,231 by
   the next build, and the one cost in the design that grew with the estate on
   the very gesture the page exists for. The grid in pick.mjs returns the same
   answer — proved against the full scan in proof/pick-index.check.mjs — about
   two hundred times faster. */
function nearestKeyAt(cx, cy) {
  const wx = (cx - view.w / 2) / view.zoom + view.x;
  const wy = (view.h / 2 - cy) / view.zoom + view.y;
  const reach = 22 / view.zoom;
  const i = U.pick ? nearestAt(U.pick, wx, wy, reach) : -1;
  return i < 0 ? -1 : U.keys[i];
}

/* ── reading the line itself ─────────────────────────────────────────────── */

/* The store is opened on the first click, not at load: a session that only
   looks at the wafer never fetches the index, and one that reads a line pays
   9 KB for the index and about 45 KB for the block that answers it. */
let READER = null, readerWhy = 'not opened yet';
function reader() {
  if (!READER) READER = openLineStore({
    indexUrl: 'line-index.json',
    onStatus: st => { readerWhy = st.why; }
  }).catch(e => { readerWhy = 'the index could not be opened: ' + (e.message || e); return null; });
  return READER;
}

/* One line's code, written into an element that is already on screen, so the
   panel appears immediately and the text lands when the network answers. The
   key is checked against the row before anything is shown: a stale index
   produces a stated refusal, never another line's code pretending to be this
   one. */
async function getText(key) {
  const store = await reader();
  if (!store) return { key, text: null, why: readerWhy };
  return store.get(key);
}

async function fillCode(el, key) {
  const store = await reader();
  if (!store) { el.className = 'code refuse'; el.textContent = readerWhy; return; }
  const got = await store.get(key);
  if (Number(el.dataset.key) !== key) return;          /* the beam moved on */
  if (got.text === null) { el.className = 'code refuse'; el.textContent = got.why; return; }
  el.className = 'code';
  el.textContent = got.text === '' ? '' : got.text;
  el.dataset.empty = got.text.trim() === '' ? '1' : '';
  const s = store.stats();
  setStoreLine(`${fmt(s.bytes)} bytes read in ${s.requests} request${s.requests === 1 ? '' : 's'} · ` +
    `${s.blocksHeld} block${s.blocksHeld === 1 ? '' : 's'} held · ${store.drifted ? 'offsets by search' : 'offsets exact'}`);
}

function setStoreLine(text) {
  const el = $('storeline');
  if (el) el.textContent = text;
}

/* ── the panel: what the beam found ──────────────────────────────────────── */

function famsOf(key) {
  if (!U.ownerOf) return null;
  return U.ownerOf.get(key) || [];
}

function paintPanel(key) {
  const i = indexOfKey(key);
  const p = $('panelbody');
  if (i < 0) {
    p.innerHTML =
      `<h2>Line <span class="n">${fmt(key)}</span></h2>
       <p class="refuse">This number was never issued. The numbering runs 1 to ${fmt(U.meta.max)} and
       ${fmt(U.meta.max - U.n)} of those numbers were skipped, so a gap is a real answer rather than a
       missing record. The surface still has a place for it, and the beam is pointing at it.</p>`;
    $('panel').hidden = false; return;
  }
  const chars = U.lens[i], carried = U.inFam[i] === 1;
  const fams = famsOf(key);
  let body =
    `<h2>Line <span class="n">${fmt(key)}</span></h2>
     <pre class="code loading" data-key="${key}">reading this line from the numbered database…</pre>
     <dl>
       <dt>characters</dt><dd>${chars === 65535
          ? 'at least 65,535 — the pack stores this in sixteen bits and this line reaches the ceiling, so its true length is not known here'
          : fmt(chars) + (chars === 0 ? ' (an empty line)' : '')}</dd>
       <dt>permanent</dt><dd>this number is never reused, so it means this line for ever</dd>
       <dt>carried by</dt><dd>${carried ? 'at least one function family' : 'no function family'}</dd>
     </dl>`;
  if (!carried) {
    body += `<p class="refuse">Nothing can be connected to this line. It is numbered and it exists, but no
      function family in the estate carries it, so it has no partner to join it to.</p>`;
  } else if (fams === null) {
    body += `<p class="dim">The family index is still loading; the families carrying this line will appear here.</p>`;
  } else if (fams.length === 0) {
    body += `<p class="refuse">The pack marks this line as carried, but no family range in this build
      contains it. That disagreement is shown rather than smoothed over.</p>`;
  } else {
    const show = fams.slice(0, 12);
    body += `<p>Carried by <span class="fam">${fmt(fams.length)}</span> ${fams.length === 1 ? 'family' : 'families'}${fams.length > 12 ? ', first twelve' : ''}:</p><ul>` +
      show.map(f => {
        const fa = U.families[f];
        const cat = fa.category ?? 'no category recorded';
        return `<li><button type="button" class="famopen" data-fam="${f}">` +
          `<span class="fam">${esc(fa.name)}</span> <span class="dim">#${fmt(fa.n)} · ${esc(fa.kind)} · ` +
          `${esc(cat)} · ${fmt(fa.lineCount)} lines</span></button></li>`;
      }).join('') + `</ul>`;
    if (fams.length > 60) {
      body += `<p class="dim">A line carried by this many families is almost certainly trivial: a brace, a
        blank, an import. Its connection count is drawn here rather than hidden, so you can see that for
        yourself.</p>`;
    }
  }
  body += `<p class="setrow"><button type="button" id="setadd" data-key="${key}">${SEL.has(key) ? 'remove from the set' : 'add to the set'}</button></p>`;
  body += `<p id="storeline" class="dim"></p>`;
  p.innerHTML = body;
  $('panel').hidden = false;
  const code = p.querySelector('.code[data-key]');
  if (code) fillCode(code, key);
}

/* ── a family, as a block of code ────────────────────────────────────────────
   CO-MEMBERSHIP MADE READABLE. A family is the lines of one function, in
   numbering order, and until now the page could only say how many there were.
   Each line is read on its own and they arrive together, because lines of one
   function are numbered near each other and therefore sit in the same block of
   the document: opening a family is usually the one request that opening any
   one of its lines would have cost anyway. Every row is itself a line number,
   so every row is clickable and the wafer flies there. */
async function openFamily(fIdx) {
  const fa = U.families?.[fIdx];
  const host = $('panelbody')?.querySelector('.famblock[data-fam="' + fIdx + '"]');
  if (!fa || !host) return;
  const keys = [];
  for (let i = fa.lineOffset; i < fa.lineOffset + fa.lineCount; i++) keys.push(U.famLines[i]);
  host.innerHTML = '<p class="dim">reading ' + fmt(keys.length) + ' lines…</p>';
  const store = await reader();
  if (!store) { host.innerHTML = '<p class="refuse">' + esc(readerWhy) + '</p>'; return; }
  const rows = await Promise.all(keys.map(k => store.get(k)));
  if (!host.isConnected) return;
  host.innerHTML =
    '<div class="famhead">' + esc(fa.name) + ' <span class="dim">' + esc(fa.kind) +
    ' · ' + fmt(fa.lineCount) + ' lines · in ' + fmt(fa.files) + ' files across ' + fmt(fa.repos) + ' repos</span></div>' +
    '<ol class="block">' + rows.map(r =>
      '<li><button type="button" class="blockline" data-key="' + r.key + '">' +
      '<span class="n">' + fmt(r.key) + '</span>' +
      '<code>' + (r.text === null ? '<span class="refuse">' + esc(r.why) + '</span>' : esc(r.text) || '&nbsp;') + '</code>' +
      '</button></li>').join('') + '</ol>';
  const st = store.stats();
  setStoreLine(fmt(st.bytes) + ' bytes read in ' + st.requests + ' request' + (st.requests === 1 ? '' : 's') +
    ' · ' + st.blocksHeld + ' block' + (st.blocksHeld === 1 ? '' : 's') + ' held');
}

/* One delegated listener for the whole panel: opening a family, and flying to a
   line from inside a block. */
document.addEventListener('click', e => {
  const add = e.target.closest?.('#setadd');
  if (add) {
    const key = Number(add.dataset.key);
    if (!SEL.toggle(key)) { add.textContent = 'the set is full'; return; }
    add.textContent = SEL.has(key) ? 'remove from the set' : 'add to the set';
    SEL.render(getText); draw();
    return;
  }
  const drop = e.target.closest?.('.setdrop');
  if (drop) { SEL.toggle(Number(drop.dataset.key)); SEL.render(getText); draw(); return; }
  const go = e.target.closest?.('.setgo');
  if (go) {
    const key = Number(go.dataset.key);
    view.focus = key; view.link = null;
    paintPanel(key); flyTo(key);
    return;
  }
  const open = e.target.closest?.('.famopen');
  if (open) {
    const fIdx = Number(open.dataset.fam);
    const li = open.closest('li');
    let host = li.querySelector('.famblock');
    if (host) { host.remove(); open.classList.remove('open'); return; }
    host = document.createElement('div');
    host.className = 'famblock';
    host.dataset.fam = String(fIdx);
    li.appendChild(host);
    open.classList.add('open');
    openFamily(fIdx);
    return;
  }
  const row = e.target.closest?.('.blockline');
  if (row) {
    const key = Number(row.dataset.key);
    view.focus = key; view.link = null;
    paintPanel(key); flyTo(key); writeURL(key, null);
  }
});

function connect(ka, kb) {
  view.link = [ka, kb];
  const p = $('panelbody');
  const head = `<h2>Connect <span class="n">${fmt(ka)}</span> to <span class="n">${fmt(kb)}</span></h2>`;

  /* The index is the only thing that can be missing; everything else is decided
     by lib.mjs so the page cannot disagree with the proofs. */
  if (!U.ownerOf) {
    p.innerHTML = head + `<p class="dim">The family index is still loading. The answer will appear here
      without another tap.</p>`;
    $('panel').hidden = false; draw(); return;
  }

  const a = connectAnswer(ka, kb, { keys: U.keys, owner: U.ownerOf });
  const famLine = f => {
    const fa = U.families[f];
    return `<li><span class="fam">${esc(fa.name)}</span> <span class="dim">#${fmt(fa.n)} · ${esc(fa.category ?? 'no category recorded')}</span></li>`;
  };
  let body = head;

  if (a.verdict === 'absent') {
    body += `<p class="refuse">${a.absent.map(fmt).join(' and ')} ${a.absent.length > 1 ? 'were' : 'was'}
      never issued in this numbering, so there is nothing at that address to connect.</p>`;

  } else if (a.verdict === 'same-line') {
    body += `<p class="refuse">Those are the same line. A line is not connected to itself, and reporting
      that it is would be the page agreeing with you rather than answering you.</p>` +
      (a.both.length
        ? `<p>Line ${fmt(ka)} is carried by ${fmt(a.both.length)} ${a.both.length === 1 ? 'family' : 'families'}.</p>`
        : `<p>No family carries line ${fmt(ka)}.</p>`);

  } else if (a.verdict === 'no-family') {
    body += `<p class="refuse">${a.without.map(fmt).join(' and ')} ${a.without.length > 1 ? 'are' : 'is'}
      carried by no function family at all, so ${a.without.length > 1 ? 'they have' : 'it has'} nothing to be
      joined through.</p>`;

  } else if (a.verdict === 'joined') {
    body += `<p>Joined by <span class="fam">${fmt(a.both.length)}</span>
      ${a.both.length === 1 ? 'family that carries' : 'families that carry'} both lines${a.both.length > 12 ? ', first twelve' : ''}:</p>
      <ul>${a.both.slice(0, 12).map(famLine).join('')}</ul>
      <p class="dim">This is co-membership: two different lines sitting in one function. It is not the same
      text in two places, and it is not a dependency. Either line may be carried by only that one family and
      still connect perfectly well through it.</p>`;

  } else {
    body += `<p class="refuse">No family carries both lines, so these two are not joined.</p>
      <dl><dt>${fmt(ka)}</dt><dd>${a.A.length ? fmt(a.A.length) + ' ' + (a.A.length === 1 ? 'family' : 'families') : 'no family'}</dd>
          <dt>${fmt(kb)}</dt><dd>${a.B.length ? fmt(a.B.length) + ' ' + (a.B.length === 1 ? 'family' : 'families') : 'no family'}</dd></dl>
      <p class="dim">An unjoined pair is the ordinary case: most lines of the estate sit in unrelated
      functions. This is not about fanout. ${fmt(U.fanout)} of the ${fmt(U.n)} numbered lines appear in more
      than one family, which is duplication; joining two numbers asks the different question of whether one
      family holds them both.</p>`;
  }

  p.innerHTML = body;
  $('panel').hidden = false;

  /* Frame both ends. */
  const [ax, ay] = placeOne(ka), [bx, by] = placeOne(kb);
  view.x = (ax + bx) / 2; view.y = (ay + by) / 2;
  const span = Math.max(Math.hypot(bx - ax, by - ay), 4);
  view.zoom = Math.min(view.w, view.h) / (span * 1.8);
  draw();
}

/* ── gestures ────────────────────────────────────────────────────────────── */

function gestures() {
  let down = null, moved = 0, pinch = null;
  const pts = new Map();
  stage.addEventListener('pointerdown', e => {
    stage.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 1) { down = [e.clientX, e.clientY]; moved = 0; }
    if (pts.size === 2) {
      const [p, q] = [...pts.values()];
      pinch = { d: Math.hypot(p[0] - q[0], p[1] - q[1]), z: view.zoom };
    }
  });
  stage.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    const prev = pts.get(e.pointerId);
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2 && pinch) {
      const [p, q] = [...pts.values()];
      const d = Math.hypot(p[0] - q[0], p[1] - q[1]);
      if (pinch.d > 0) view.zoom = Math.max(0.02, Math.min(4000, pinch.z * (d / pinch.d)));
      draw(); return;
    }
    if (pts.size === 1) {
      const dx = e.clientX - prev[0], dy = e.clientY - prev[1];
      moved += Math.abs(dx) + Math.abs(dy);
      view.x -= dx / view.zoom; view.y += dy / view.zoom;
      draw();
    }
  });
  const up = e => {
    if (pts.size === 1 && down && moved < 7) {
      const key = nearestKeyAt(e.clientX, e.clientY);
      if (key >= 0) { view.focus = key; paintPanel(key); view.link = null; draw(); }
    }
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = null;
    if (pts.size === 0) down = null;
  };
  stage.addEventListener('pointerup', up);
  stage.addEventListener('pointercancel', e => { pts.delete(e.pointerId); pinch = null; down = null; });
  stage.addEventListener('wheel', e => {
    e.preventDefault();
    const f = Math.exp(-e.deltaY * 0.0016);
    view.zoom = Math.max(0.02, Math.min(4000, view.zoom * f));
    draw();
  }, { passive: false });
  stage.addEventListener('dblclick', () => { view.focus = -1; view.link = null; $('panel').hidden = true; home(); });
}

/* ── URL state: the whole of it, in permanent numbers ────────────────────── */

function readURL() {
  const q = new URLSearchParams(location.search);
  const pa = parseKey(q.get('line') ?? ''), pb = parseKey(q.get('to') ?? '');
  if (!pa.ok) { if (q.get('line')) refuse(`The link carried a line number this page cannot use: ${pa.why}.`); return; }
  $('a').value = String(pa.key);
  const rawTo = q.get('to');
  if (pb.ok) { $('b').value = String(pb.key); view.link = [pa.key, pb.key]; connect(pa.key, pb.key); }
  else if (rawTo !== null && rawTo.trim() !== '') {
    /* focus stays unset: tier 2 repaints the panel for a focused key when it
       lands, which would silently replace this refusal with an ordinary card. */
    refuse(`The link asked to connect to "${rawTo}", which is not a line number: ${pb.why}. `
         + `Line ${pa.key} is where the beam is pointing.`);
    flyTo(pa.key);
  }
  else { view.focus = pa.key; paintPanel(pa.key); flyTo(pa.key); }
}

/* One refusal path, so a bad number is always visible rather than ignored. */
function refuse(sentence) {
  $('panelbody').replaceChildren();
  const h = document.createElement('h2'); h.textContent = 'Refused';
  const p2 = document.createElement('p'); p2.className = 'refuse'; p2.textContent = sentence;
  $('panelbody').append(h, p2);
  $('panel').hidden = false;
}
function writeURL(a, b) {
  const q = new URLSearchParams();
  if (a) q.set('line', String(a));
  if (b) q.set('to', String(b));
  history.replaceState(null, '', q.toString() ? '?' + q : location.pathname);
}

/* ── start ───────────────────────────────────────────────────────────────── */

(async function start() {
  try {
    await tier1();
  } catch (e) {
    $('count').textContent = 'Could not load the numbered database: ' + e.message
      + '. Check the internet connection and reload.';
    return;
  }
  resize();
  try { initGL(); } catch (e) {
    ctx2d = stage.getContext('2d');
    $('hint').textContent = 'GPU not available: drawn without animation';
  }
  home();
  gestures();
  window.addEventListener('resize', () => { resize(); draw(); });

  $('beam').addEventListener('submit', e => {
    e.preventDefault();
    const pa = parseKey($('a').value), pb = parseKey($('b').value);
    if (!pa.ok) { refuse(`That is not a line number: ${pa.why}.`); return; }
    if ($('b').value.trim() && !pb.ok) { refuse(`Second number: ${pb.why}.`); return; }
    if (pb.ok) { view.focus = -1; connect(pa.key, pb.key); writeURL(pa.key, pb.key); }
    else { view.focus = pa.key; view.link = null; paintPanel(pa.key); flyTo(pa.key); writeURL(pa.key, null); }
    document.activeElement?.blur();
  });
  $('close').addEventListener('click', () => { $('panel').hidden = true; view.focus = -1; view.link = null; draw(); });

  readURL();
  /* The set is mounted and restored before the family index arrives: a link to a
     named set must light up its lines from the placement law alone, with nothing
     fetched. The text follows when the reader answers. */
  SEL.mountCard();
  if (SEL.readURL()) { SEL.render(getText); draw(); }
  tier2().catch(e => { $('prov').textContent = 'family index unavailable: ' + e.message; });
})();
