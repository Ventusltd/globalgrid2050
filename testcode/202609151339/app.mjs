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
 * families that carry both, or an honest refusal naming which of the two is
 * carried by no family at all. Only a line carried by more than one family has
 * anything to be joined to, and how many those are is counted from the data
 * when the index loads. It is never typed here: the first time it was, it was
 * wrong by a thousand.
 *
 * WHAT IS NOT CLAIMED. A shared line number means two families contain the same
 * line of text. It does not mean one calls the other, and it is not a
 * dependency. The most-shared line in the estate is line 2, an empty line,
 * carried by 2,281 families. Triviality is visible here, not hidden: a line's
 * connection count is drawn, so the meaningless ones look exactly as
 * meaningless as they are.
 */

const DATA = '../202609142202/data/';
const GOLDEN = Math.PI * (3 - Math.sqrt(5));   /* the golden angle, 2.39996… rad */
const SPACING = 1.0;

const $ = id => document.getElementById(id);
const stage = $('stage');
const fmt = n => n.toLocaleString('en-GB');

const U = {
  connectable: null,   /* counted when the family index lands, never typed */
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

function place(keys) {
  const n = keys.length, p = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const k = keys[i], r = SPACING * Math.sqrt(k), t = k * GOLDEN;
    p[i * 2] = r * Math.cos(t);
    p[i * 2 + 1] = r * Math.sin(t);
  }
  return p;
}

/* Where a number WOULD sit, whether or not it was ever issued. The gaps have
   addresses too; that is the point of an unbounded surface. */
function placeOne(key) {
  const r = SPACING * Math.sqrt(key), t = key * GOLDEN;
  return [r * Math.cos(t), r * Math.sin(t)];
}

function indexOfKey(key) {
  const a = U.keys; let lo = 0, hi = a.length - 1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (a[m] === key) return m;
    if (a[m] < key) lo = m + 1; else hi = m - 1;
  }
  return -1;
}

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
  U.pos = place(keys);

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
  const owner = new Map();
  for (let f = 0; f < families.length; f++) {
    const { lineOffset: o, lineCount: c } = families[f];
    for (let i = o; i < o + c; i++) {
      const k = famLines[i];
      const cur = owner.get(k);
      if (cur === undefined) owner.set(k, [f]);
      else if (cur[cur.length - 1] !== f) cur.push(f);
    }
  }
  U.ownerOf = owner;
  let many = 0;
  for (const v of owner.values()) if (v.length > 1) many++;
  U.connectable = many;
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

function initGL() {
  gl = stage.getContext('webgl2', { antialias: true, alpha: false });
  if (!gl) { ctx2d = stage.getContext('2d'); return false; }
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
  if (view.link) {
    const [ka, kb] = view.link;
    const A = toScreen(placeOne(ka)), B = toScreen(placeOne(kb));
    c.strokeStyle = '#5ec8f2'; c.lineWidth = 1.2; c.setLineDash([5, 4]);
    c.beginPath(); c.moveTo(A[0], A[1]);
    c.quadraticCurveTo((A[0] + B[0]) / 2, (A[1] + B[1]) / 2 - 40, B[0], B[1]);
    c.stroke(); c.setLineDash([]);
    for (const P of [A, B]) {
      c.strokeStyle = '#5ec8f2'; c.beginPath(); c.arc(P[0], P[1], 9, 0, 6.2832); c.stroke();
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

function nearestKeyAt(cx, cy) {
  const wx = (cx - view.w / 2) / view.zoom + view.x;
  const wy = (view.h / 2 - cy) / view.zoom + view.y;
  const reach = 22 / view.zoom;
  let best = -1, bestD = reach * reach;
  for (let i = 0; i < U.n; i++) {
    const dx = U.pos[i * 2] - wx, dy = U.pos[i * 2 + 1] - wy;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best < 0 ? -1 : U.keys[best];
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
        return `<li><span class="fam">${fa.name}</span> <span class="dim">#${fa.n} · ${fa.kind} · ${cat} · ${fmt(fa.lineCount)} lines</span></li>`;
      }).join('') + `</ul>`;
    if (fams.length > 60) {
      body += `<p class="dim">A line carried by this many families is almost certainly trivial: a brace, a
        blank, an import. Its connection count is drawn here rather than hidden, so you can see that for
        yourself.</p>`;
    }
  }
  p.innerHTML = body;
  $('panel').hidden = false;
}

function connect(ka, kb) {
  view.link = [ka, kb];
  const p = $('panelbody');
  const ia = indexOfKey(ka), ib = indexOfKey(kb);
  const missing = [];
  if (ia < 0) missing.push(ka);
  if (ib < 0) missing.push(kb);
  if (missing.length) {
    p.innerHTML = `<h2>Connect <span class="n">${fmt(ka)}</span> to <span class="n">${fmt(kb)}</span></h2>
      <p class="refuse">${missing.map(fmt).join(' and ')} ${missing.length > 1 ? 'were' : 'was'} never issued as
      ${missing.length > 1 ? 'numbers' : 'a number'}, so there is nothing at that address to connect.</p>`;
    $('panel').hidden = false; draw(); return;
  }
  const A = famsOf(ka), B = famsOf(kb);
  if (A === null || B === null) {
    p.innerHTML = `<h2>Connect <span class="n">${fmt(ka)}</span> to <span class="n">${fmt(kb)}</span></h2>
      <p class="dim">The family index is still loading. The answer will appear here without another tap.</p>`;
    $('panel').hidden = false; draw(); return;
  }
  const setB = new Set(B);
  const both = A.filter(f => setB.has(f));
  let body = `<h2>Connect <span class="n">${fmt(ka)}</span> to <span class="n">${fmt(kb)}</span></h2>`;
  if (both.length) {
    body += `<p>Joined by <span class="fam">${fmt(both.length)}</span> ${both.length === 1 ? 'family that carries' : 'families that carry'} both lines:</p><ul>` +
      both.slice(0, 12).map(f => {
        const fa = U.families[f];
        return `<li><span class="fam">${fa.name}</span> <span class="dim">#${fa.n} · ${fa.category ?? 'no category recorded'}</span></li>`;
      }).join('') + `</ul>
      <p class="dim">Both lines appear inside the same function family. That means the same text sits in both
      places. It does not mean one calls the other.</p>`;
  } else {
    body += `<p class="refuse">No family carries both lines, so these two are not joined.</p>
      <dl><dt>${fmt(ka)}</dt><dd>${A.length ? fmt(A.length) + ' ' + (A.length === 1 ? 'family' : 'families') : 'no family'}</dd>
          <dt>${fmt(kb)}</dt><dd>${B.length ? fmt(B.length) + ' ' + (B.length === 1 ? 'family' : 'families') : 'no family'}</dd></dl>
      <p class="dim">An unjoined pair is the ordinary case. ${fmt(U.connectable)} of the ${fmt(U.n)} numbered
      lines are carried by more than one family; every other line has nothing to be joined to.</p>`;
  }
  p.innerHTML = body;
  $('panel').hidden = false;

  /* Frame both ends of the connection. */
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
  const a = Number(q.get('line')), b = Number(q.get('to'));
  if (Number.isInteger(a) && a > 0) {
    $('a').value = String(a);
    if (Number.isInteger(b) && b > 0) { $('b').value = String(b); view.link = [a, b]; connect(a, b); }
    else { view.focus = a; paintPanel(a); flyTo(a); }
  }
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
    const a = parseInt($('a').value, 10), b = parseInt($('b').value, 10);
    if (!Number.isInteger(a) || a < 1) return;
    if (Number.isInteger(b) && b >= 1) { view.focus = -1; connect(a, b); writeURL(a, b); }
    else { view.focus = a; view.link = null; paintPanel(a); flyTo(a); writeURL(a, null); }
    document.activeElement?.blur();
  });
  $('close').addEventListener('click', () => { $('panel').hidden = true; view.focus = -1; view.link = null; draw(); });

  readURL();
  tier2().catch(e => { $('prov').textContent = 'family index unavailable: ' + e.message; });
})();
