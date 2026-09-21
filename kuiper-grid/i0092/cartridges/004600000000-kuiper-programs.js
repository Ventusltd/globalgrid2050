'use strict';
// kuiper-programs.js - a cartridge of the Kuiper shell. Cut from the whole page with no change of behaviour;
// replaced, when it is, by a newer file the pointer names and the composer checks by its hash.
let ASM = null, gatherAnim = null, homeAnim = null;
// ===== THE BODY: a smaller Kuiper of one application's own work =====================================
let body = null, bodyAnim = null, BP = null, bodyBuf = null;
// THE PALETTE OF THE ONE PULSE. The ring that sweeps the disc is white and ice blue; what it leaves lit is
// the same light, at full brightness. No second look: the saturated green was one, and it is gone.
const FARADAY = [0.80, 0.96, 1.0];
// THE BODY FILLS THE INNER DISC, so a third of the gap is a bigger dot and the body reads from across a
// room without a single dot breaking the rule that makes it a population and not a patch.
const BODY_RADIUS = 0.55, BODY_RADIUS_MAX = 0.92, DOT_MAX_PX = 5, DOT_MIN_PX = 1.0;
const VS_BODY = `#version 300 es
precision highp float;
in vec2 a_pos; uniform float u_zoom, u_size, u_sld; uniform vec2 u_center, u_res; uniform vec4 u_val[224]; out float v_val;
void main(){ gl_Position = vec4((a_pos - u_center) * u_zoom / (0.5*u_res), 0.0, 1.0); gl_PointSize = u_size;
  int i = min(gl_VertexID, 895); v_val = u_sld > 0.5 ? u_val[i >> 2][i & 3] : 1.0; }`;
// A DOT IS A DISC WITH A HARD EDGE, AND IT IS NOT ADDED TO WHAT IS UNDER IT. Light that adds is how
// neighbours merge into a white patch; here a dot covers what it covers and nothing more.
const FS_BODY = `#version 300 es
precision highp float; uniform vec3 u_on; uniform float u_sld; in float v_val; out vec4 o;
// A DIAGRAM'S DOT CARRIES A VALUE: under 0 disconnected, 0 to 1 how bright, about 1.25 the front of a pulse, 2 over a limit.
void main(){ if (length(gl_PointCoord - 0.5) > 0.5) discard; vec3 c = u_on;
  if (u_sld > 0.5) { c = v_val < 0.0 ? vec3(0.09, 0.12, 0.15) : v_val > 1.6 ? vec3(1.0, 0.62, 0.15) : v_val > 1.1 ? vec3(1.0) : mix(vec3(0.10, 0.16, 0.20), u_on, v_val); }
  o = vec4(c, 1.0); }`;
// THE GAP, MEASURED. The nearest two centres among the places the module returned, found with a grid
// so a large application costs no more than a small one. Nothing here is judged by eye.
function closestPair(pos){
  const m = pos.length / 2; if (m < 2) return Infinity;
  let x0 = 1e300, x1 = -1e300, y0 = 1e300, y1 = -1e300;
  for (let q = 0; q < pos.length; q += 2) { x0 = Math.min(x0, pos[q]); x1 = Math.max(x1, pos[q]); y0 = Math.min(y0, pos[q+1]); y1 = Math.max(y1, pos[q+1]); }
  const cell = Math.max(1e-9, Math.sqrt(Math.max(1e-18, (x1 - x0) * (y1 - y0)) / m)), grid = new Map();
  let best = Infinity;
  for (let j = 0; j < m; j++) { const gx = Math.floor((pos[2*j] - x0) / cell), gy = Math.floor((pos[2*j+1] - y0) / cell);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { const cellm = grid.get((gx + dx) + ':' + (gy + dy)); if (!cellm) continue;
      for (const k of cellm) { const d = Math.hypot(pos[2*j] - pos[2*k], pos[2*j+1] - pos[2*k+1]); if (d < best) best = d; } }
    const key = gx + ':' + gy; (grid.get(key) || grid.set(key, []).get(key)).push(j); }
  return best;
}
// THE BLACK SKY RULE, as one question any body can be asked: are all centres at least three dot radii
// apart? It is the same function the page obeys and the test plants a too tight body against.
function blackSky(pos, dotRadius){ const gap = closestPair(pos); return { gap, dotRadius, ok: gap >= 3 * dotRadius * (1 - 1e-4) }; }   // exactly a third is allowed; the margin is for rounding, not for squeezing
function nameInLines(words){ const w = String(words).split(' '); if (String(words).length <= 9 || w.length < 2) return String(words);
  const half = Math.ceil(w.length / 2); return w.slice(0, half).join(' ') + ' / ' + w.slice(half).join(' '); }
function makeBody(st){
  if (!ASM || !st.idx.length) return null;
  if (st.prog.sld) { const d = makeSldBody(st); if (d) return d; }
  const seq = (st.prog.on.sequence && st.prog.on.sequence.length) ? st.prog.on.sequence : (st.prog.on.shape ? [{ shape:st.prog.on.shape }] : []);
  if (!seq.length) return null;
  const m = st.idx.length, R = Math.sqrt(SPACE), from = new Float32Array(2 * m);
  // ONE DOT FOR EVERY PIECE OF WORK, IN ORDER OF KEY: the module puts dot j at place j, and place 0 is
  // the middle, so the oldest work is the middle of the small Kuiper and the newest is its rim.
  st.idx.forEach((ci, j) => { const c0 = commits[ci], p = keyPlace(c0.k0 + Math.floor((c0.k1 - c0.k0) / 2)); from[2*j] = p[0]; from[2*j+1] = p[1]; });
  // THE SIZE THE SHOW WILL REALLY BE SEEN AT. On a phone the short tile rises under the picture and the
  // disc is refitted smaller above it, so what resolves is decided for THAT size, not for the empty screen.
  const zHome = homeCamera().z * (narrow() ? 0.62 : 1), states = [];
  for (const step of seq) { const shape = step.shape === 'text' ? 'text:' + nameInLines(st.app.button) : step.shape;
    // A NAME NEEDS ENOUGH DOTS TO BE A NAME: about six to a letter. Nine pieces of work cannot spell
    // two words, and a scatter that means nothing is worse than the small Kuiper it would replace.
    // A NAME ONLY WHEN IT CAN BE READ. A letter is a shape of squares and needs a dot for every one of them;
    // with fewer, letters lose strokes (85 pieces of work spelt CABL S). Counted from the module's own
    // lettering, not estimated.
    if (step.shape === 'text') { const ink = ASM.raster ? ASM.raster(nameInLines(st.app.button)) : null;
      const squares = ink ? ink.on.reduce((t, v) => t + v, 0) : 1e9; if (m < squares) continue; }
    let unit; try { unit = ASM.targets(shape, m); } catch (e) { continue; }
    const unitGap = closestPair(unit);
    // large enough that a dot a third of the gap wide is at least a pixel; never larger than the disc
    let frac = BODY_RADIUS; const need = DOT_MIN_PX * 3 / Math.max(1e-12, unitGap * R * zHome);
    if (need > frac) frac = Math.min(BODY_RADIUS_MAX, need);
    const to = new Float32Array(unit.length); for (let q = 0; q < unit.length; q++) to[q] = unit[q] * R * frac;
    const gap = unitGap * R * frac;
    const unresolved = gap * zHome / 3 < DOT_MIN_PX * 0.999;
    // WHAT CANNOT BE RESOLVED IS NOT SHOWN AS IF IT COULD. A state that would need dots under a pixel is
    // left out, and the show ends on the last state that does resolve: the work gathers and STAYS, it
    // is never simply gone from the middle of the disc, which is what a phone showed.
    if (unresolved && states.length) continue;
    states.push({ shape, to, gap, frac, hold:step.hold_ms || 0, unresolved }); }
  if (!states.length) return null;
  return { n:m, from, pos:new Float32Array(from), states, k:-1, gap:0, shown:false };
}
function bodyTo(arr){ if (body) body.live = closestPair(arr);
  if (!BP) { BP = prog(VS_BODY, FS_BODY); bodyBuf = gl.createBuffer(); }
  gl.bindBuffer(gl.ARRAY_BUFFER, bodyBuf); gl.bufferData(gl.ARRAY_BUFFER, arr, gl.DYNAMIC_DRAW); gl.bindBuffer(gl.ARRAY_BUFFER, null);
  sldUniforms(); if (body && body.sld) sldStart(); }
function labels(show){ const o = document.getElementById('o'); if (o) o.style.visibility = show ? 'visible' : 'hidden'; }
function bodyJump(k){ if (!body) return; labels(false); const stt = body.states[k]; body.pos.set(stt.to); body.k = k; body.gap = stt.gap; body.shown = true; bodyAnim = null; bodyTo(body.pos); dirty = true; }
function bodyMove(k){ if (!body) return; labels(false); bodyAnim = { k, t0:performance.now(), from:new Float32Array(body.pos), gap0:body.shown ? body.gap : body.states[k].gap, phase:'move' };
  body.shown = true; dirty = true; }
// the dot's radius ON THE SCREEN, from the measured gap and the zoom of this moment: a third of the
// gap, never more, however the visitor zooms
// THE SIZE FOLLOWS THE CANVAS, NOT THE SCREEN. This canvas is as many pixels as the window is wide, so a
// point size is already in the units the gap is measured in. Multiplying by the screen's pixel ratio
// drew every dot at twice its size on a real screen and at its right size in every test.
function bodyDrawnDiameter(){ return Math.max(1, 2 * bodyDotPx() * (cv.width / Math.max(1, innerWidth))); }
// A THIRD OF THE GAP AS THE DOTS ARE NOW. At rest the gap is the state's own; in flight it is measured
// from where the dots are at that frame, because leaving the rim they are almost on top of one another
// and no resting spacing describes them.
function bodyDotPx(){ const gap = body.sld ? body.sldGap : body.live !== undefined ? body.live : body.gap;   // a diagram's dot is sized by the spacing along its lines, where a junction would make every dot a speck      // measured every time the dots are placed
  return Math.max(0.5, Math.min(DOT_MAX_PX, gap * zoom / 3)); }
// BESIDE THE SHELL, NOT BESIDE THIS FILE. Released, this part lives in a folder of parts and the module lives
// beside the shell; a script asks for a module relative to its own address, so './assemble.mjs' asked for a
// file that is not there. The page's base address is the shell's folder, with the composer or without it.
// AND A FAILED LOAD SAYS SO. The catch used to swallow it, and on the live address the dots simply never
// gathered, with nothing on the page or in the console to say why.
let asmWhy = null;
const asmReady = import(new URL('assemble.mjs', document.baseURI).href).then(m => { ASM = m; })
  .catch(e => { ASM = null; asmWhy = String(e && e.message || e); console.error('[kuiper] the gathering animation could not be loaded:', asmWhy); });
const GATHER_RADIUS = 0.30;                      // of the record's own radius: a body, with the dark disc still around it
function sheet(title, sub){
  const mine = ++cardToken;
  card.classList.remove('short');
  card.replaceChildren();
  card.style.display = 'block';
  card.scrollTop = 0;
  const x = el('button', 'cc-x', '\u00d7'); x.type = 'button'; x.setAttribute('aria-label', 'close');
  x.addEventListener('click', closeCard);
  card.append(x, el('span', 'cc-title', title));
  if (sub) card.append(el('span', 'cc-grey', sub));
  const tagLine = el('div', 'cc-tagline'), tag = el('span', 'cc-tag'), msg = el('span', 'cc-grey');
  tagLine.append(tag, msg); card.append(tagLine);
  const body = el('div', 'cc-body'); card.append(body);
  // THE SINGLE WRITER OF THE STATE. Nothing else touches the chip, and a writer for a card that has
  // been replaced does nothing at all.
  const setTag = (st, text) => { if (mine !== cardToken) return false;
    tag.dataset.s = st; tag.textContent = st; if (text != null) msg.textContent = text; return true; };
  dirty = true;
  return { mine, body, setTag, live: () => mine === cardToken };
}
function revealCode(){
  const w = cardShown && cardShown.window; if (!w) return;
  const cr = card.getBoundingClientRect(), pr = w.node.getBoundingClientRect();
  if (pr.bottom > cr.bottom - 4) card.scrollTop += pr.bottom - cr.bottom + 8;
  else if (pr.top < cr.top) card.scrollTop -= cr.top - pr.top + 8;
  w.scrollToTarget();
}
function sparksTo(arr){ ensureGlow(); gl.bindBuffer(gl.ARRAY_BUFFER, glowBuf);
  gl.bufferData(gl.ARRAY_BUFFER, arr, gl.DYNAMIC_DRAW); gl.bindBuffer(gl.ARRAY_BUFFER, null); }
function ensureGlow(){ if (!PG) { PG = prog(VS_GLOW, FS_GLOW); glowBuf = gl.createBuffer(); } }
// ===== ISOLATE AN APPLICATION =================================================================
// ===== THE MENU: BUTTONS ADDED AS DATA =========================================================
// The shell's own buttons come from cosmos/apps.tsv and cosmos/programs.json, which are inside the frozen shell.
// A button added after the shell was frozen is ONE ENTRY HERE: the same two records the shell reads, and nothing
// else. select.repository lights every piece of work of that repository that is on this record.
const MENU = [
  { app: { app:'tests', button:'TESTS', repo:'ventusltd/faraday', prefixes:[], live:'https://ventusltd.github.io/faraday/' },
    program: { name:'tests', button:'TESTS', select:{ app:'tests', repository:'faraday' }, pulse:{ origin:'centre', seconds:1.5 }, off:{ dim:0.1 },
               on:{ colour:[0.80,0.96,1.0], size:0, bright:0, sparks:1, sequence:[{ shape:'cluster', hold_ms:1500 }, { shape:'text', hold_ms:900 }] },
               end:{ tile:'https://ventusltd.github.io/faraday/' },
               says:'Every test we have run. Choose a sentence in the bar below and it runs again here, on your device.' } },
  // A CORRECTION TO A BUTTON THE SHELL CARRIES. The shell's REAL SYSTEMS row points at a folder two builds old, and its sentence
  // ("a single line view of a real system") describes a different page from the one that opens. The work it lights stays the nine
  // pieces the frozen record holds for it; that is put right when the record is next cut, not here.
  { override:true,
    app: { app:'real-systems', live:'https://globalgrid2050.com/testcode/wafer-development-environment/202609192215-proof-s0004/' },
    program: { name:'real-systems', end:{ tile:'https://globalgrid2050.com/testcode/wafer-development-environment/202609192215-proof-s0004/' },
               says:'The wafer development environment: every numbered line of the estate, and a box that draws the grid, a substation or a fault study from one sentence.' } }
];
// THE PROGRAM A FIRED COMMAND RUNS: no button of its own and no tile; its shape is the network of the command that fired it.
// It is in the list of programs only for the moment it is started, so the row of buttons and its checks never see it.
const FIRE_PROGRAM = { name:'fire', button:'TESTS', select:{ app:'tests', repository:'faraday' }, pulse:{ origin:'centre', seconds:1.0 }, off:{ dim:0.06 },
  on:{ colour:[0.80,0.96,1.0], size:0, bright:0, sparks:0, sequence:[{ shape:'sld', hold_ms:0 }] }, end:{} };
function mergeMenu(){
  for (const m of MENU) {
    if (m.override) { const a = apps.find(x => x.app === m.app.app), p = programs.find(x => x.name === m.program.name);
      if (a) Object.assign(a, m.app); if (p && m.program.end) p.end = m.program.end;
      if (a && m.program.says) whatItDoes[a.live] = m.program.says.replace(/\.$/, ''); continue; }
    if (!apps.find(x => x.app === m.app.app)) apps.push(m.app);
    if (!programs.find(x => x.name === m.program.name)) programs.push(m.program);
    if (m.program.says && !whatItDoes[m.app.live]) whatItDoes[m.app.live] = m.program.says.replace(/\.$/, '');
    if (!(appWork[m.app.app] || []).length) { const ri = repos.findIndex(r => r.name === m.program.select.repository);
      appWork[m.app.app] = ri < 0 ? [] : commits.filter(c => c.repo === ri).map(c => c.sha); }
  }
}
function makeAppButtons(){
  mergeMenu();
  const bar = document.getElementById('apps'); bar.replaceChildren();
  for (const pr of programs) { const ap = apps.find(x => x.app === pr.select.app);
    if (!ap || !(appWork[ap.app] || []).length) continue;        // nothing of it on this record: no button
    const b = el('button', null, pr.button); b.type = 'button'; b.setAttribute('data-app', pr.name);
    b.addEventListener('click', e => { e.stopPropagation(); isolate(pr.name); }); bar.append(b); }
  if (typeof layout === 'function') layout();
  makeFireBar();
}
// THE STATE ITSELF, with no animation, so it can be arrived at by a link and asked for by a test.
function isolateNow(name, front){
  const asData = programs.find(x => x.name === name); if (!asData) return null;
  const prog = Object.assign({}, asData, { on:Object.assign({}, asData.on, { colour:FARADAY }) });
  const ap = apps.find(x => x.app === prog.select.app); if (!ap) return null;
  name = ap.app;
  const idx = []; for (const sha of (appWork[name] || [])) { const i = bySha.get(sha); if (i !== undefined) idx.push(i); }
  idx.sort((x, y) => x - y);
  litRepo = -1; litK = [-1,-1]; litCi = null; newFrom = -1; flash = 0; litPath = null; target = null; arrow = null;
  iso = { app:ap, prog, front:front === undefined ? 1e30 : front, idx, set:new Set(idx), lit:idx.length, dark:commits.length - idx.length,
          first:idx.length ? commits[idx[0]].unix : 0, last:idx.length ? commits[idx[idx.length - 1]].unix : 0 };
  raiseFlags(idx);
  { // A FEW SPARKS FOR EVERY PIECE OF WORK, spread through its own lines so a big piece of work is a
    // scatter around its ring and a small one a point or two. Never more than the program allows.
    const per = Math.max(1, Math.min(24, (prog.on.sparks | 0) || 8)), pts = [];
    for (const i of idx) { const c0 = commits[i], len = Math.max(1, c0.k1 - c0.k0), take = Math.min(per, len);
      for (let j = 0; j < take; j++) { const p = keyPlace(c0.k0 + Math.floor((j + 0.5) * len / take)); pts.push(p[0], p[1]); } }
    ensureGlow();
    iso.from = new Float32Array(pts); iso.pos = iso.from; iso.to = null;
    glowCount = pts.length / 2; iso.sparks = glowCount; sparksTo(iso.from); }
  body = makeBody(iso);
  // arrived at by a link, or asked for outright: the END of the program, with no waiting
  if (front === undefined && body) bodyJump(body.states.length - 1);
  for (const b of document.querySelectorAll('#apps button')) b.classList.toggle('on', b.getAttribute('data-app') === prog.name);
  if (front === undefined) raiseTile();
  dirty = true;
  return iso;
}
// PRESS: the pulse runs out through the record, which on this picture is forward through time, and
// where it has passed the rest goes dark. The pulse is the page's own; nothing new is animated.
function isolate(name){
  const prog = programs.find(x => x.name === name); if (!prog) return;
  closeCard(); { const fc = document.getElementById('firecard'); if (fc && name !== 'fire') fc.style.display = 'none'; }   // the answer of a fired command leaves with it
  unisolate(true); anim = null; flash = 0; newFrom = -1; target = null; arrow = null;
  { const h = homeCamera(); cx = h.x; cy = h.y; zoom = h.z; tween = null; atHome = true; }
  // the selection is made at once and the FRONT starts at the origin with nothing switched; each dot
  // switches when the front reaches it, so the darkening is seen to travel
  if (!isolateNow(name, 0)) return;
  bodyAnim = null; if (body) body.shown = false;
  isoAnim = { name, t0:performance.now(), R:Math.sqrt(SPACE), ms:Math.max(200, (prog.pulse.seconds || 1.5) * 1000) }; dirty = true;
}
function raiseTile(){ if (!iso || !(iso.prog.end && iso.prog.end.tile)) return;
  appCard(iso); if (atHome) { const h = homeCamera(); flyTo(h.x, h.y, h.z); } dirty = true; }
// ANY OTHER ACTION FIRST ENDS THE ISOLATE. Called by everything that shows something else, before it
// does anything, so the darkening can never outlive the thing it was for.
function endIsolate(){ if (iso || isoAnim || bodyAnim) { unisolate(true); closeCard(); } }
function unisolate(quiet){ labels(true); sldNow = null; if (sldLoop) { cancelAnimationFrame(sldLoop); sldLoop = 0; } iso = null; isoAnim = null; gatherAnim = null; homeAnim = null; body = null; bodyAnim = null; pulse = -1;
  for (const b of document.querySelectorAll('#apps button')) b.classList.remove('on');
  if (!quiet) dirty = true; }
// THE TILE OF AN ISOLATED APPLICATION: its name, what it does for a project, OPEN. Then how much of
// the record is lit and how much has gone dark, because the two must make the whole.
function appCard(st){
  cardToken++; cardShown = null; card.replaceChildren(); card.style.display = 'block'; card.scrollTop = 0;
  card.classList.add('short');
  const x = el('button', 'cc-x', '\u00d7'); x.type = 'button'; x.setAttribute('aria-label', 'close');
  x.addEventListener('click', () => { card.style.display = 'none'; dirty = true; });
  const t = el('a', 'cc-tile cc-app'); t.href = st.app.live; t.target = '_blank'; t.rel = 'noopener'; t.setAttribute('data-app', st.app.app);
  t.append(el('div', 'cc-tile-name', st.app.button));
  if (whatItDoes[st.app.live]) t.append(el('div', 'cc-tile-what', whatItDoes[st.app.live] + '.'));
  t.append(el('span', 'cc-tile-open', 'OPEN ' + st.app.button));
  const brand = el('div', 'scada-brand'), inner = el('div');
  inner.append(el('div', 'scada-brand-main', 'Ventus'), el('div', 'scada-brand-sub', 'Cables & Connectivity\u00ae')); brand.append(inner);
  const plain = el('div', 'cc-plain cc-count', fmt(st.lit) + ' pieces of work lit, ' + fmt(st.dark) + ' gone dark, '
    + fmt(st.lit + st.dark) + ' in all \u00b7 ' + day(st.first) + ' to ' + day(st.last));
  card.append(x, t, brand, plain);
  if (!ASM && asmWhy) card.append(el('div', 'cc-refuse', 'The gathering could not be loaded, so this work stays where it is: ' + asmWhy));
  if (typeof layout === 'function') layout();
}
function closeCard(){ cardToken++; card.style.display = 'none'; card.replaceChildren();
  target = null; cardShown = null; dirty = true; }
addEventListener('keydown', e => {
  if (e.key === 'Escape' && card.style.display !== 'none') { e.preventDefault(); closeCard(); } });

function codeWindow(lines, a, b, at){
  const pre = el('pre', 'cc-code');
  pre.setAttribute('aria-label', 'the code around this line');
  const bar = el('div', 'cc-hi cc-hi-target');
  const out = [];
  for (let i = a; i <= b; i++) out.push(String(i).padStart(6) + '  ' + lines[i - 1]);
  pre.append(bar, document.createTextNode(out.join('\n')));
  const lh = () => parseFloat(getComputedStyle(pre).lineHeight) || 16;
  const padTop = () => parseFloat(getComputedStyle(pre).paddingTop) || 0;
  const place = () => { bar.style.top = (padTop() + (at - a) * lh()) + 'px'; bar.style.height = lh() + 'px'; };
  return { node:pre, bar, place, first:a, last:b, at,
    scrollToTarget(){ place(); pre.scrollTop = Math.max(0, (at - a) * lh() - pre.clientHeight/2 + lh()/2); } };
}

// WHAT A TAP OPENS. One way in for every kind of answer: the work and the day it was done, a state
// chip saying how much of it is proved, and, where the code for that line is carried on this site,
// the code itself with the tapped line marked. Nothing here sends a reader to GitHub to READ code;
// the link is there for the detail and the history, which is what GitHub is good for.

// ===== THE COMMANDS THAT RUN ON THE VISITOR'S DEVICE: Ventusltd/faraday bench/fire.js and bench/fire_site.js, carried whole ==========
// Checked against every saved record by faraday bench/fire_check.mjs (2,278 of 2,278). Carried inside this file so the pointer's hash covers them.
// bench/fire.js - the pop commands that RUN IN THE VISITOR'S BROWSER. Plain JavaScript, no library, nothing leaves the device.
// Each function is a port of the Python in bench/*_cases.py and is checked against the saved records by bench/fire_check.mjs:
// same inputs, same numbers, or the port is wrong. A command is:  fire <name> {inputs as JSON}
(function (root) {
  const R20 = { al: { 50: 0.641, 70: 0.443, 95: 0.320, 120: 0.253, 150: 0.206, 185: 0.164, 240: 0.125, 300: 0.100, 400: 0.0778, 500: 0.0605, 630: 0.0469 },
                cu: { 50: 0.387, 70: 0.268, 95: 0.193, 120: 0.153, 150: 0.124, 185: 0.0991, 240: 0.0754, 300: 0.0601, 400: 0.0470, 500: 0.0366, 630: 0.0283 } };
  const K = { al: 94.0, cu: 143.0 }, ALPHA = { al: 0.00403, cu: 0.00393 };
  const RATE_AL = { 50: 150, 70: 185, 95: 220, 120: 250, 150: 280, 185: 320, 240: 370, 300: 420, 400: 480, 500: 545, 630: 615 };
  const rate = (m, s) => m === 'al' ? RATE_AL[s] : Math.round(RATE_AL[s] * 1.28);
  // as Python's round(): the number as it is actually held decides; only an EXACT half goes to the even side
  const r = (x, d) => { const up = Number(x.toFixed(d)), t = Math.abs(x).toFixed(d + 25), tail = t.slice(t.indexOf('.') + 1 + d);
    if (!/^50*$/.test(tail)) return up;
    const k = Math.pow(10, d), n = Math.round(Math.abs(up) * k); return n % 2 === 0 ? up : Number((up - Math.sign(x) / k).toFixed(d)); };
  const need = (o, keys) => { for (const k of keys) if (o[k] === undefined) throw new Error('this command needs "' + k + '"'); };

  const RUN = {
    'cable-withstand': { family: 'CABLE CHECK', run(i) { need(i, ['metal', 'size_mm2', 'seconds', 'fault_ka']);
      if (!K[i.metal]) throw new Error('metal is "al" or "cu"');
      const limit = K[i.metal] * i.size_mm2 / Math.sqrt(i.seconds) / 1000, ok = i.fault_ka <= limit;
      return { numbers: { withstand_ka: r(limit, 2), fault_ka: i.fault_ka, margin_pct: r((limit / i.fault_ka - 1) * 100, 1) },
               said: 'withstands ' + limit.toFixed(2) + ' kA; asked for ' + i.fault_ka + ' kA: ' + (ok ? 'survives' : 'DOES NOT SURVIVE: a larger conductor or faster protection'),
               how: 'adiabatic rule: k x area / square root of time, k = ' + K[i.metal] }; } },
    'cable-run': { family: 'CABLE CHECK', run(i) { need(i, ['metal', 'size_mm2', 'amps', 'metres', 'kv', 'derate']);
      if (!R20[i.metal] || !R20[i.metal][i.size_mm2]) throw new Error('sizes: ' + Object.keys(R20.al).join(', ') + ' mm2; metal "al" or "cu"');
      const rh = R20[i.metal][i.size_mm2] * (1 + ALPHA[i.metal] * 70), x = 0.08;
      const vd = Math.sqrt(3) * i.amps * (rh * 0.95 + x * Math.sqrt(1 - 0.95 * 0.95)) * i.metres / 1000, pct = vd / (i.kv * 1000) * 100;
      const use = i.amps / (rate(i.metal, i.size_mm2) * i.derate) * 100, flags = [];
      if (use > 100) flags.push('over its derated rating'); else if (use > 85) flags.push('within 15 per cent of its derated rating: commission a buried cable thermal study');
      if (pct > 1.5) flags.push('voltage drop ' + pct.toFixed(2) + '% is over 1.5%');
      return { numbers: { volt_drop_pct: r(pct, 3), loading_pct: r(use, 1), loss_kw: r(3 * i.amps * i.amps * rh * i.metres / 1000 / 1000, 2) },
               said: 'drop ' + pct.toFixed(2) + '%, loaded to ' + use.toFixed(0) + '% of its derated rating; ' + (flags.length ? flags.join('; ') : 'inside both limits'),
               how: 'resistance at 20 C raised to 90 C; drop = root three x amps x (r cos + x sin) x length; rating x derating (ratings are CANDIDATE round figures)' }; } },
    'national-day': { family: 'NATIONAL DAY', run(i) { need(i, ['firm_gw', 'round_trip']);
      const raw = []; for (let h = 0; h < 48; h++) raw.push(24.25 + 6.25 * Math.sin(Math.PI * (h / 2 - 7) / 12));
      const k = 604 / (raw.reduce((a, b) => a + b, 0) / 2), d = raw.map(v => v * k);
      const short = d.reduce((a, v) => a + Math.max(0, v - i.firm_gw), 0) / 2, spare = d.reduce((a, v) => a + Math.max(0, i.firm_gw - v), 0) / 2, inp = short / i.round_trip;
      return { numbers: { storage_delivers_gwh: r(short, 1), must_be_put_in_gwh: r(inp, 1), spare_generation_that_day_gwh: r(spare, 1), day_low_gw: r(Math.min(...d), 1), day_high_gw: r(Math.max(...d), 1) },
               said: 'storage delivers ' + short.toFixed(0) + ' GWh and needs ' + inp.toFixed(0) + ' GWh put in; the steady generation has ' + spare.toFixed(0) + ' GWh to spare that day: ' + (spare >= inp ? 'enough to refill it' : 'NOT enough to refill it'),
               how: '48 half hours of a 604 GWh spring day; demand above the steady generation comes from storage' }; } },
    'dc-traction-chain': { family: 'DC TRACTION', run(i) { need(i, ['inverter', 'transformer', 'rectifier', 'dc_converter']);
      const ac = i.inverter * i.transformer * i.rectifier, s = i.dc_converter - ac;
      return { numbers: { reaches_rail_by_ac_route_pct: r(ac * 100, 2), reaches_rail_by_dc_route_pct: r(i.dc_converter * 100, 2), saved_pct_of_the_solar: r(s * 100, 2) },
               said: (ac * 100).toFixed(1) + '% arrives by the usual route, ' + (i.dc_converter * 100).toFixed(1) + '% by the direct route: ' + (s * 100).toFixed(1) + '% of the SOLAR is saved',
               how: 'multiplied the efficiencies along each route' }; } },
    'dc-traction-scale': { family: 'DC TRACTION', run(i) { need(i, ['solar_gwh', 'saving_share']);
      const traction = 1216 * 0.825, saved = i.solar_gwh * i.saving_share;
      return { numbers: { traction_gwh: r(traction, 1), saved_gwh: r(saved, 2), solar_share_of_traction_pct: r(i.solar_gwh / traction * 100, 1), average_kw_per_substation: Math.round(traction * 1e6 / 300 / 8760) },
               said: 'saves ' + saved.toFixed(1) + ' GWh a year; the solar is ' + (i.solar_gwh / traction * 100).toFixed(1) + '% of traction energy',
               how: 'traction = total x 82.5%; saving = solar x share saved' }; } },
  };

  function parse(text) {
    const m = String(text).trim().match(/^fire\s+([a-z0-9-]+)\s*(\{[\s\S]*\})?\s*$/i);
    if (!m) throw new Error('a command looks like:  fire cable-withstand {"metal":"al","size_mm2":185,"seconds":1,"fault_ka":16}');
    let inputs = {}; if (m[2]) { try { inputs = JSON.parse(m[2]); } catch (e) { throw new Error('the part in { } is not valid: ' + e.message); } }
    return { name: m[1].toLowerCase(), inputs };
  }
  function fire(text) { const c = parse(text), f = RUN[c.name]; if (!f) return { name: c.name, inputs: c.inputs, ran: false }; const o = f.run(c.inputs); return Object.assign({ name: c.name, inputs: c.inputs, ran: true, family: f.family }, o); }
  // another file may add commands:  FIRE.register('site-pulse', 'SITE PULSE', inputs => ({ numbers, said, how }))
  function register(name, family, run) { RUN[name] = { family, run }; }
  root.FIRE = { fire, parse, register, get names() { return Object.keys(RUN); } };
  if (typeof module !== 'undefined') module.exports = root.FIRE;
})(typeof window !== 'undefined' ? window : globalThis);

// bench/fire_site.js - SITE PULSE in the visitor's browser: a port of solve() and record() in bench/site_cases.py.
// Plain JavaScript, no library. JavaScript has no complex numbers, so every volt, amp and ohm is a pair [re, im].
// Checked against every saved SITE PULSE and SITE SURVEY record by bench/fire_check.mjs. Load after fire.js.
(function (root) {
  const CANDIDATE = { kv: 11.0, grid_fault_mva: 150.0, grid_x_over_r: 10.0, hv_cable_r: 0.20, hv_cable_x: 0.09, tx_z_pct: 5.5, tx_x_over_r: 5.0,
                      load_pf: 0.90, gen_pf: 0.95, pv_pf: 1.0, volts_high_pu: 1.06, volts_low_pu: 0.94, inverter_fault_x_rated: 1.1, generator_subtransient_pu: 0.15 };
  const SCENARIOS = { 1: ['no solar, no generator', 0.0, false, []], 2: ['no solar, generator running', 0.0, true, []],
                      3: ['solar at full output, no generator', 1.0, false, []], 4: ['solar at full output, generator running', 1.0, true, []],
                      5: ['solar at half output, no generator', 0.5, false, []], 6: ['solar at half output, generator running', 0.5, true, []],
                      7: ['solar at full output, the tenant substation disconnected', 1.0, false, ['tenant']],
                      8: ['solar at full output, the tenant substation and the load beside the solar both disconnected', 1.0, false, ['tenant', 'pvload']] };
  const standardSite = () => ({ intake_cable_km: 0.6, export_limit_kw: 500.0, generator_kw: 500.0, pv_kw: 1000.0, pv_on: 4,
    subs: [{ n: 1, kva: 1600, load_kw: 900, km: 0.15 }, { n: 2, kva: 1000, load_kw: 550, km: 0.25 }, { n: 3, kva: 1000, load_kw: 500, km: 0.35 },
           { n: 4, kva: 1000, load_kw: 350, km: 0.45 }, { n: 5, kva: 800, load_kw: 300, km: 0.30, tenant: true }] });

  // pairs
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]], sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const mul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
  const div = (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };
  const conj = a => [a[0], -a[1]], scale = (a, k) => [a[0] * k, a[1] * k], mag = a => Math.hypot(a[0], a[1]);
  const rnd = (x, d) => Number(x.toFixed(d));                        // decimal rounding of the value held, as Python's round does

  function solve(site, pvShare, genOn, off, loadShare, c, tol) {
    c = c || CANDIDATE; tol = tol || 1e-9; off = off || []; if (loadShare === undefined) loadShare = 1.0;
    const vb = c.kv * 1000 / Math.sqrt(3);
    const zsMag = (c.kv ** 2) / c.grid_fault_mva, xr = c.grid_x_over_r, rs = zsMag / Math.sqrt(1 + xr * xr);
    const Z = { poc: [rs, rs * xr], board: scale([c.hv_cable_r, c.hv_cable_x], site.intake_cable_km) };
    const parent = { grid: null, poc: 'grid', board: 'poc' }, S = {}, kva = {};
    const tanl = Math.tan(Math.acos(c.load_pf)), tang = Math.tan(Math.acos(c.gen_pf));
    if (genOn) S.board = scale([site.generator_kw, site.generator_kw * tang], -1000 / 3);
    for (const s of site.subs) {
      if (off.includes('tenant') && s.tenant) continue;                // a disconnected substation is not in the network at all
      const hv = 'hv' + s.n, lv = 'lv' + s.n; parent[hv] = 'board'; parent[lv] = hv;
      Z[hv] = scale([c.hv_cable_r, c.hv_cable_x], s.km);
      const zt = c.tx_z_pct / 100 * (c.kv ** 2) / (s.kva / 1000), txr = c.tx_x_over_r, rt = zt / Math.sqrt(1 + txr * txr);
      Z[lv] = [rt, rt * txr]; kva[lv] = s.kva;
      const kw = (off.includes('pvload') && s.n === site.pv_on) ? 0.0 : s.load_kw * loadShare;
      let p = [kw, kw * tanl];
      if (s.n === site.pv_on) p = sub(p, [site.pv_kw * pvShare, 0]);
      S[lv] = scale(p, 1000 / 3);
    }
    const kids = {};
    for (const n of Object.keys(parent)) if (parent[n] !== null) (kids[parent[n]] = kids[parent[n]] || []).push(n);
    const order = ['grid'];
    for (let i = 0; i < order.length; i++) order.push(...(kids[order[i]] || []));
    let V = {}; for (const n of order) V[n] = [vb, 0];
    let rounds = 0, J;
    for (;;) {
      rounds++;
      J = {}; for (const n of order) J[n] = S[n] ? conj(div(S[n], V[n])) : [0, 0];
      for (let i = order.length - 1; i >= 0; i--) { const n = order[i]; if (parent[n] !== null) J[parent[n]] = add(J[parent[n]], J[n]); }   // PULSE ONE: currents sum back toward the grid
      const nv = { grid: [vb, 0] };
      for (const n of order.slice(1)) nv[n] = sub(nv[parent[n]], mul(J[n], Z[n]));                                                        // PULSE TWO: volts fall (or rise) out from the grid
      let step = 0; for (const n of order) step = Math.max(step, mag(sub(nv[n], V[n])));
      V = nv;
      if (step < tol || rounds > 300) break;
    }
    const sPoc = scale(mul(V.poc, conj(J.poc)), 3);                   // + import, - export, in volt amperes
    let loss = 0; for (const n of order.slice(1)) loss += mag(J[n]) ** 2 * Z[n][0]; loss *= 3;
    let net = 0; for (const n of Object.keys(S)) net += S[n][0]; net *= 3;
    const source = mul(V.grid, conj(J.poc))[0] * 3;
    const tx = {}; for (const n of Object.keys(kva)) tx[n] = mag(scale(mul(V[n], conj(J[n])), 3)) / 1000 / kva[n] * 100;
    const lv = 'lv' + site.pv_on; let faultKa = null;
    if (Z[lv]) {
      const zpath = add(add(Z.poc, Z.board), add(Z['hv' + site.pv_on], Z[lv]));
      const iGrid = vb / mag(zpath);
      const iPv = c.inverter_fault_x_rated * site.pv_kw * pvShare * 1000 / (Math.sqrt(3) * c.kv * 1000);
      const iGen = genOn ? (site.generator_kw / c.gen_pf * 1000 / (Math.sqrt(3) * c.kv * 1000) / c.generator_subtransient_pu) : 0.0;
      faultKa = { grid_only: rnd(iGrid * c.kv / 0.4 / 1000, 2), with_sources: rnd((iGrid + iPv + iGen) * c.kv / 0.4 / 1000, 2) };
    }
    const Vpu = {}; for (const n of order) Vpu[n] = mag(V[n]) / vb;
    return { V: Vpu, p_poc_kw: sPoc[0] / 1000, q_poc_kvar: sPoc[1] / 1000, loss_kw: loss / 1000, tx_loading_pct: tx, rounds,
             balance: Math.abs(source - net - loss) / Math.max(Math.abs(net), 1.0), fault_ka: faultKa };
  }

  function sitePulse(i) {
    if (i.scenario === undefined) throw new Error('this command needs "scenario" (1 to 8)');
    const sc = SCENARIOS[i.scenario]; if (!sc) throw new Error('scenario is a number from 1 to 8');
    const site = i.site || standardSite(), loadShare = i.load_share === undefined ? 1.0 : i.load_share, c = CANDIDATE;
    const r = solve(site, sc[1], sc[2], sc[3], loadShare);
    const exp = Math.max(0.0, -r.p_poc_kw), over = Math.max(0.0, exp - site.export_limit_kw);
    const vs = Object.values(r.V), vmax = Math.max(...vs), vmin = Math.min(...vs), worst = Math.max(...Object.values(r.tx_loading_pct));
    const flags = [];
    if (over > 0) flags.push('export ' + exp.toFixed(0) + ' kW is ' + over.toFixed(0) + ' kW over the ' + site.export_limit_kw.toFixed(0) + ' kW limit: the solar must be held back');
    if (vmax > c.volts_high_pu) flags.push('highest voltage ' + vmax.toFixed(3) + ' of nominal is over ' + c.volts_high_pu.toFixed(2));
    if (vmin < c.volts_low_pu) flags.push('lowest voltage ' + vmin.toFixed(3) + ' of nominal is under ' + c.volts_low_pu.toFixed(2));
    if (worst > 100) flags.push('a transformer is at ' + worst.toFixed(0) + '% of its rating');
    const signed = (x) => (x < 0 ? '-' : '+') + Math.abs(x).toFixed(0);
    return { numbers: { connection_point_kw: rnd(r.p_poc_kw, 1), connection_point_kvar: rnd(r.q_poc_kvar, 1), export_kw: rnd(exp, 1), over_limit_kw: rnd(over, 1),
                        losses_kw: rnd(r.loss_kw, 2), highest_volts_pu: rnd(vmax, 4), lowest_volts_pu: rnd(vmin, 4), worst_transformer_pct: rnd(worst, 1),
                        rounds: r.rounds, fault_level_beside_solar_ka: r.fault_ka },
             said: sc[0] + ', load ' + Math.round(loadShare * 100) + '%: connection point ' + signed(r.p_poc_kw) + ' kW (plus is import), ' + signed(r.q_poc_kvar) + ' kvar; volts ' + vmin.toFixed(3) + ' to ' + vmax.toFixed(3) +
                   '; busiest transformer ' + worst.toFixed(0) + '%; ' + (flags.length ? flags.join('; ') : 'inside every limit'),
             how: 'two pulses per round until the volts stop moving: currents summed back to the grid, volts dropped or raised out from it. A GENERIC site, no real one; every electrical figure is a CANDIDATE. An estimate, not a study.' };
  }

  const F = root.FIRE || (typeof require !== 'undefined' ? require('./fire.js') : null);
  if (!F) throw new Error('fire_site.js needs fire.js loaded first');
  F.register('site-pulse', 'SITE PULSE', sitePulse);
  F.sitePulse = { solve, standardSite, SCENARIOS, CANDIDATE };
})(typeof window !== 'undefined' ? window : globalThis);

// bench/fire_topo.js - NETWORKS FROM A SEED, in the visitor's browser: the same generator and the same two pulse sweep as
// bench/topo.py, draw for draw and sum for sum. Checked against every Python case by bench/topo_check.mjs. Load after fire.js.
//   fire network {"seed":123456,"solar":1,"generator":1,"load":0.3}
(function (root) {
  const C = { kv: 11.0, grid_x_over_r: 10.0, hv_cable_r: 0.20, hv_cable_x: 0.09, tx_z_pct: 5.5, tx_x_over_r: 5.0, load_pf: 0.90, gen_pf: 0.95, volts_high_pu: 1.06, volts_low_pu: 0.94 };
  const KVA = [500, 800, 1000, 1600, 2000], LIMITS = [0, 50, 200, 500, 1000], GENS = [0, 250, 500, 1000], FAULT = [100, 150, 250, 350, 500];
  const SHAPES = ['star', 'chain', 'tree', 'sub-boards'];
  const CASES = []; for (const ps of [0.0, 0.5, 1.0]) for (const g of [0, 1]) for (const ls of [1.0, 0.6, 0.3]) CASES.push([ps, g, ls]);
  function mulberry32(a) { a |= 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return (t ^ t >>> 14) >>> 0; }; }
  function network(seed, variant) {
    const g = mulberry32(Number((BigInt(seed) * 2654435761n + 777n) & 0xFFFFFFFFn)), pick = n => g() % n;
    const shape = pick(4), n = 2 + pick(11), fault = FAULT[pick(5)], intake = (10 + pick(191)) / 100, limit = LIMITS[pick(5)], subs = [];
    for (let k = 1; k <= n; k++) {
      const kva = KVA[pick(5)], load = Math.floor(kva * (25 + pick(56)) / 100), km = (5 + pick(76)) / 100; let parent;
      if (k === 1 || shape === 0) parent = 0; else if (shape === 1) parent = pick(10) < 8 ? k - 1 : 0; else if (shape === 2) parent = pick(k); else parent = k <= 3 ? 0 : 1 + pick(3);
      const pv = pick(10) < 3 ? Math.floor(kva * (30 + pick(121)) / 100) : 0;
      subs.push({ n: k, kva, load_kw: load, km, parent, pv_kw: pv });
    }
    const gen = GENS[pick(4)], genAt = pick(n + 1);
    // the same networks asked a different way, exactly as bench/topo.py: 1 more solar, 2 a weak grid, 3 long cables, 4 smaller transformers
    let fault2 = fault, intake2 = intake;
    if (variant === 1) for (const s of subs) s.pv_kw = Math.floor(s.pv_kw * 3 / 2);
    else if (variant === 2) fault2 = Math.floor(fault / 2);
    else if (variant === 3) { intake2 = intake * 3; for (const s of subs) s.km = s.km * 3; }
    else if (variant === 4) for (const s of subs) s.kva = KVA[Math.max(0, KVA.indexOf(s.kva) - 1)];
    return { seed, variant: variant || 0, shape: SHAPES[shape], fault_mva: fault2, intake_km: intake2, export_limit_kw: limit, generator_kw: gen, generator_at: genAt, subs };
  }
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]], sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const mul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
  const div = (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };
  const conj = a => [a[0], -a[1]], scale = (a, k) => [a[0] * k, a[1] * k], mag = a => Math.hypot(a[0], a[1]);
  function solve(net, pvShare, genOn, loadShare, tol) {
    tol = tol || 1e-9; const c = C, vb = c.kv * 1000 / Math.sqrt(3);
    const zs = (c.kv ** 2) / net.fault_mva, xr = c.grid_x_over_r, rs = zs / Math.sqrt(1 + xr * xr), cable = [c.hv_cable_r, c.hv_cable_x];
    const Z = { poc: [rs, rs * xr], board: scale(cable, net.intake_km) }, parent = { grid: null, poc: 'grid', board: 'poc' }, S = {}, kva = {};
    const tanl = Math.tan(Math.acos(c.load_pf)), tang = Math.tan(Math.acos(c.gen_pf));
    const gen = genOn ? [net.generator_kw, net.generator_kw * tang] : [0, 0];
    if (genOn && net.generator_at === 0) S.board = scale(gen, -1000 / 3);
    for (const s of net.subs) {
      const hv = 'hv' + s.n, lv = 'lv' + s.n; parent[hv] = s.parent === 0 ? 'board' : 'hv' + s.parent; parent[lv] = hv;
      Z[hv] = scale(cable, s.km);
      const zt = c.tx_z_pct / 100 * (c.kv ** 2) / (s.kva / 1000), txr = c.tx_x_over_r, rt = zt / Math.sqrt(1 + txr * txr);
      Z[lv] = [rt, rt * txr]; kva[lv] = s.kva;
      const kw = s.load_kw * loadShare; let p = sub([kw, kw * tanl], [s.pv_kw * pvShare, 0]);
      if (genOn && net.generator_at === s.n) p = sub(p, gen);
      S[lv] = scale(p, 1000 / 3);
    }
    const kids = {}; for (const n of Object.keys(parent)) if (parent[n] !== null) (kids[parent[n]] = kids[parent[n]] || []).push(n);
    const order = ['grid']; for (let i = 0; i < order.length; i++) order.push(...(kids[order[i]] || []));
    let V = {}; for (const n of order) V[n] = [vb, 0]; let rounds = 0, J;
    for (;;) {
      rounds++; J = {}; for (const n of order) J[n] = S[n] ? conj(div(S[n], V[n])) : [0, 0];
      for (let i = order.length - 1; i >= 0; i--) { const n = order[i]; if (parent[n] !== null) J[parent[n]] = add(J[parent[n]], J[n]); }
      const nv = { grid: [vb, 0] }; for (let i = 1; i < order.length; i++) { const n = order[i]; nv[n] = sub(nv[parent[n]], mul(J[n], Z[n])); }
      let step = 0; for (const n of order) step = Math.max(step, mag(sub(nv[n], V[n]))); V = nv;
      if (step < tol || rounds > 300) break;
    }
    const sPoc = scale(mul(V.poc, conj(J.poc)), 3);
    let loss = 0; for (let i = 1; i < order.length; i++) loss += mag(J[order[i]]) ** 2 * Z[order[i]][0]; loss *= 3;
    let netP = 0; for (const n of Object.keys(S)) netP += S[n][0]; netP *= 3;
    const source = mul(V.grid, conj(J.poc))[0] * 3;
    let tx = -Infinity, amps = -Infinity; const txEach = {}, ampsEach = {}, vEach = {};
    for (const n of Object.keys(kva)) { txEach[n] = mag(scale(mul(V[n], conj(J[n])), 3)) / 1000 / kva[n] * 100; tx = Math.max(tx, txEach[n]); }
    for (let i = 1; i < order.length; i++) { const n = order[i]; if (!(n in kva)) { ampsEach[n] = mag(J[n]); amps = Math.max(amps, ampsEach[n]); } }
    let vmax = -Infinity, vmin = Infinity; for (const n of order) { const v = mag(V[n]) / vb; vEach[n] = v; vmax = Math.max(vmax, v); vmin = Math.min(vmin, v); }
    return { p: sPoc[0] / 1000, q: sPoc[1] / 1000, loss: loss / 1000, vmax, vmin, tx, amps, rounds, balance: Math.abs(source - netP - loss) / Math.max(Math.abs(netP), 1.0),
             each: { volts: vEach, tx: txEach, amps: ampsEach }, parent };
  }
  const rnd = (x, d) => Number(x.toFixed(d));
  function run(i) {
    if (i.seed === undefined) throw new Error('this command needs "seed" (any whole number: each one is a different network)');
    const net = i.network || network(i.seed, i.variant || 0), ps = i.solar === undefined ? 1 : i.solar, g = i.generator === undefined ? 0 : i.generator, ls = i.load === undefined ? 1 : i.load;
    const r = solve(net, ps, !!g, ls), c = C, exp = Math.max(0, -r.p), over = Math.max(0, exp - net.export_limit_kw), flags = [];
    if (r.rounds > 300 || r.balance >= 1e-6) flags.push('THE SWEEP DID NOT CONVERGE: this network is beyond the method, and no number here should be used');
    if (over > 0) flags.push('export ' + exp.toFixed(0) + ' kW is ' + over.toFixed(0) + ' kW over the ' + net.export_limit_kw + ' kW limit');
    if (r.vmax > c.volts_high_pu) flags.push('highest voltage ' + r.vmax.toFixed(3) + ' is over ' + c.volts_high_pu);
    if (r.vmin < c.volts_low_pu) flags.push('lowest voltage ' + r.vmin.toFixed(3) + ' is under ' + c.volts_low_pu);
    if (r.tx > 100) flags.push('a transformer is at ' + r.tx.toFixed(0) + '% of its rating');
    const pv = net.subs.reduce((t, s) => t + s.pv_kw, 0), load = net.subs.reduce((t, s) => t + s.load_kw, 0);
    return { numbers: { substations: net.subs.length, load_kw: rnd(load * ls, 0), solar_kw: rnd(pv * ps, 0), generator_kw: g ? net.generator_kw : 0, export_limit_kw: net.export_limit_kw,
                        connection_point_kw: rnd(r.p, 1), connection_point_kvar: rnd(r.q, 1), losses_kw: rnd(r.loss, 2), highest_volts_pu: rnd(r.vmax, 4), lowest_volts_pu: rnd(r.vmin, 4),
                        worst_transformer_pct: rnd(r.tx, 1), busiest_cable_amps: rnd(r.amps, 1), rounds: r.rounds },
             said: 'A ' + net.shape + ' of ' + net.subs.length + ' substations behind a ' + net.fault_mva + ' MVA connection: ' + (r.p < 0 ? 'exports ' : 'imports ') + Math.abs(r.p).toFixed(0) + ' kW; volts ' + r.vmin.toFixed(3) + ' to ' + r.vmax.toFixed(3) +
                   '; busiest transformer ' + r.tx.toFixed(0) + '%; ' + (flags.length ? flags.join('; ') : 'inside every limit'),
             how: 'network number ' + net.seed + ' from a stated generator (no real site); two pulses per round until the volts stop moving; every figure a CANDIDATE. An estimate, not a study.', net, solved: r };
  }
  const F = root.FIRE || (typeof require !== 'undefined' ? require('./fire.js') : null);
  if (!F) throw new Error('fire_topo.js needs fire.js loaded first');
  F.register('network', 'NETWORKS', run);
  F.topo = { network, solve, CASES, C };
})(typeof window !== 'undefined' ? window : globalThis);
// ===== THE COMMAND LIST, READ THE WAY GRIDATLAS READS A COMPOSITION ===============================
// The sentences in the bar are not written into this page: the page fetches them. This is the reader, and it is built the way
// the Atlas reads atlas/current.json - a POINTER fetched with no cache at all, a schema that must be the one we know, a file
// named by the pointer, and the bytes that arrive RE-HASHED here and compared with the hash the pointer declared before one
// sentence is shown. Nothing is trusted because it arrived; it is trusted because it hashes to what was promised.
//
// ON ANY FAULT THE BAR SAYS THE EXACT REASON. A list that quietly falls back to a few built-in sentences teaches a reader
// nothing; "the list hashes to 9c1f6a and the pointer says 4749ae" tells them, and tells us, what actually happened.
//
// WHERE IT READS FROM: the faraday repository's Pages site. That is a DIFFERENT ORIGIN from the one this page is served from,
// for as long as the list is produced there: the fetch depends on that site's Access-Control-Allow-Origin header, which is not
// ours to promise, and a refusal is one of the faults the bar will name. The day the list is copied under this origin, pass
// that base in instead; the pointer, the hash and the checks are the same either way.
async function loadFireConfig(base) {
  const say = reason => ({ ok: false, reason: reason });
  const at = String(base || '');
  if (!at || at.slice(-1) !== '/') return say('the base address must end in a slash; it was "' + at + '"');
  if (typeof fetch !== 'function') return say('this browser has no fetch, so the list cannot be read');
  const subtle = (typeof crypto !== 'undefined' && crypto && crypto.subtle) ? crypto.subtle : null;
  if (!subtle) return say('this page cannot hash what it fetched (crypto.subtle is missing, which is what a page served over plain http gets), so nothing is trusted');
  let res;
  try { res = await fetch(at + 'current.json', { cache: 'no-store' }); }
  catch (e) { return say('the pointer ' + at + 'current.json could not be fetched: ' + (e && e.message ? e.message : e)); }
  if (!res.ok) return say('the pointer ' + at + 'current.json answered ' + res.status);
  let cur;
  try { cur = JSON.parse(await res.text()); }
  catch (e) { return say('the pointer is not valid JSON: ' + (e && e.message ? e.message : e)); }
  if (!cur || typeof cur !== 'object') return say('the pointer is not an object');
  if (cur.schema !== 'faraday.commands.current.v1') return say('the pointer says schema "' + cur.schema + '" and this page reads faraday.commands.current.v1');
  if (typeof cur.file !== 'string' || !cur.file) return say('the pointer names no file');
  if (typeof cur.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(cur.sha256)) return say('the pointer carries no sha256 for ' + cur.file);
  if (typeof cur.generation !== 'string' || !cur.generation) return say('the pointer carries no generation');
  let fres;
  try { fres = await fetch(at + cur.file, { cache: 'no-store' }); }
  catch (e) { return say('the list ' + cur.file + ' could not be fetched: ' + (e && e.message ? e.message : e)); }
  if (!fres.ok) return say('the list ' + cur.file + ' answered ' + fres.status);
  const buf = await fres.arrayBuffer();
  if (typeof cur.bytes === 'number' && buf.byteLength !== cur.bytes) return say('the list is ' + buf.byteLength + ' bytes and the pointer says ' + cur.bytes);
  const digest = await subtle.digest('SHA-256', buf);
  let hex = ''; const view = new Uint8Array(digest);
  for (let i = 0; i < view.length; i++) hex += view[i].toString(16).padStart(2, '0');
  if (hex !== cur.sha256) return say('the list hashes to ' + hex.slice(0, 12) + ' and the pointer says ' + cur.sha256.slice(0, 12) + ': these are not the bytes that were published');
  let list;
  try { list = JSON.parse(new TextDecoder('utf-8').decode(buf)); }
  catch (e) { return say('the list is not valid JSON: ' + (e && e.message ? e.message : e)); }
  if (!list || typeof list !== 'object') return say('the list is not an object');
  if (list.schema !== 'faraday.commands.v2') return say('the list says schema "' + list.schema + '" and this page reads faraday.commands.v2');
  if (list.generation !== cur.generation) return say('the list is generation ' + list.generation + ' and the pointer says ' + cur.generation);
  if (!Array.isArray(list.commands)) return say('the list carries no commands');
  if (typeof cur.count === 'number' && list.commands.length !== cur.count) return say('the pointer counts ' + cur.count + ' commands and the list holds ' + list.commands.length);
  if (!list.commands.length) return say('the list is empty');
  for (let i = 0; i < list.commands.length; i++) {
    const c = list.commands[i];
    if (!c || typeof c !== 'object') return say('command ' + i + ' is not an object');
    for (const k of ['family', 'kind', 'sentence', 'command']) if (typeof c[k] !== 'string' || !c[k]) return say('command ' + i + ' has no ' + k);
    if (c.seed !== null && c.seed !== undefined && typeof c.seed !== 'number') return say('command ' + i + ' has a seed that is not a number');
    if (c.case !== null && c.case !== undefined && typeof c.case !== 'number') return say('command ' + i + ' has a case that is not a number');
  }
  return { ok: true, generation: list.generation, commands: list.commands };
}
// A THOUSAND SENTENCES NEED A SEARCH BOX. Every word typed must appear somewhere in the family, the kind or the sentence, so
// "chain export 500" narrows to chains that export near a 500 kW limit. Case blind, and never more than fifty at once,
// because a list longer than a screen is a list nobody reads.
function searchCommands(commands, text) {
  const words = String(text === undefined || text === null ? '' : text).toLowerCase().split(/\s+/).filter(Boolean);
  const out = [];
  if (!Array.isArray(commands)) return out;
  for (let i = 0; i < commands.length && out.length < 50; i++) {
    const c = commands[i];
    if (!c) continue;
    const hay = ((c.family || '') + ' ' + (c.kind || '') + ' ' + (c.sentence || '')).toLowerCase();
    let all = true;
    for (let w = 0; w < words.length; w++) if (hay.indexOf(words[w]) < 0) { all = false; break; }
    if (all) out.push(c);
  }
  return out;
}
// ===== THE COMMAND BAR ============================================================================
// The wafer's bar, on the Kuiper: search a thousand solved networks, choose one or type a command, it RUNS ON THIS DEVICE (the
// FIRE commands above are part of this same hashed file), the pulse sweeps, the work that holds those tests lights, and a card
// gives the answer. Change the published list and the bar changes; nothing about the list is written here except the handful of
// sentences to fall back on, and the bar SAYS WHY whenever it had to fall back.
const FIRE_CONFIG = 'https://ventusltd.github.io/faraday/bench/results/commands/';
const FIRE_DRAWS = ['site-pulse', 'network'];            // the commands whose network the dots draw
const FIRE_FALLBACK = [
  { family:'NETWORKS', sentence:'A chain of substations, full solar, light load', command:'fire network {"seed":5,"solar":1,"generator":0,"load":0.3}' },
  { family:'NETWORKS', sentence:'A tree of substations, full solar, generator running', command:'fire network {"seed":11,"solar":1,"generator":1,"load":0.3}' },
  { family:'NETWORKS', sentence:'Sub-boards, seven substations, full load, no solar', command:'fire network {"seed":2026,"solar":0,"generator":0,"load":1}' },
  { family:'NETWORKS', sentence:'The same sub-boards on a weak grid', command:'fire network {"seed":2026,"variant":2,"solar":1,"generator":0,"load":0.3}' },
  { family:'NETWORKS', sentence:'The same sub-boards with every cable three times as long', command:'fire network {"seed":2026,"variant":3,"solar":1,"generator":0,"load":1}' },
  { family:'SITE PULSE', sentence:'Site pulse: solar at full output, no generator, load 30%', command:'fire site-pulse {"scenario":3,"load_share":0.3}' },
  { family:'SITE PULSE', sentence:'Site pulse: solar at full output, the tenant substation disconnected', command:'fire site-pulse {"scenario":7,"load_share":0.3}' } ];
let fireBarMade = false;
function makeFireBar(){
  if (fireBarMade) return; fireBarMade = true;
  const foot = document.getElementById('foot'); if (!foot) return;
  const st = document.createElement('style');
  st.textContent = '#firebar{display:flex;gap:6px;margin-bottom:6px;align-items:stretch}'
    + '#firebar select,#firebar input,#firebar button{background:#061018;color:#cfeaf2;border:1px solid #1d6470;padding:7px 8px;font:inherit;font-size:11px;min-width:0}'
    + '#firebar select{flex:0 1 19rem}#firebar input{flex:1 1 10rem}#firebar button{color:#00ffff;letter-spacing:.08em;cursor:pointer}'
    + '#firebar button:hover{border-color:#00ffff}'
    + '#firecard{position:fixed;z-index:11;left:14px;top:14px;width:19rem;max-width:calc(100vw - 28px);max-height:70vh;overflow:auto;background:#040a10f2;'
    + 'border:1px solid #1d6470;color:#cfeaf2;padding:12px 14px;font-size:12px;line-height:1.45;display:none}'
    + '#firecard h4{margin:0 0 6px;color:#00ffff;font-size:11px;letter-spacing:.12em;font-weight:normal}#firecard .said{color:#fff;margin:0 0 8px}'
    + '#firecard table{border-collapse:collapse;width:100%;margin:0 0 8px}#firecard td{padding:2px 0;border-bottom:1px solid #12303a}#firecard td+td{text-align:right;color:#fff}'
    + '#firecard .small{color:#7f98a3;font-size:10.5px}#firecard .x{position:absolute;right:8px;top:6px;background:none;border:0;color:#7f98a3;font:inherit;cursor:pointer}'
    + '#firenote{color:#7d8799;font-size:10px;line-height:1.35;margin:-2px 0 6px}#firenote b{color:#8fb3bd;font-weight:600}'
    // A THUMB IS NOT A MOUSE POINTER. Every control in this bar is at least 44 px high on a phone, which is the size the rest of
    // the estate already uses; the bar wraps to three full width lines rather than squeezing four controls onto one.
    + '@media (max-width:700px){#firebar{flex-wrap:wrap;gap:5px}#firebar select,#firebar #firesearch{flex:1 1 100%}'
    + '#firebar select,#firebar input,#firebar button{min-height:44px;padding:10px 10px;font-size:12px}'
    + '#firecard{left:8px;right:8px;top:auto;bottom:150px;width:auto;max-height:34vh}}';
  document.head.append(st);
  const bar = document.createElement('div'); bar.id = 'firebar';
  const find = document.createElement('input'); find.id = 'firesearch'; find.type = 'search'; find.autocomplete = 'off'; find.spellcheck = false;
  find.setAttribute('aria-label', 'search the sentences'); find.placeholder = 'search the list:  chain export 500';
  const sel = document.createElement('select'); sel.setAttribute('aria-label', 'choose an example sentence');
  const box = document.createElement('input'); box.autocomplete = 'off'; box.spellcheck = false; box.placeholder = 'type a command:  fire cable-withstand {"metal":"al","size_mm2":185,"seconds":1,"fault_ka":16}';
  const go = document.createElement('button'); go.type = 'button'; go.textContent = 'FIRE';
  bar.append(find, sel, box, go);
  const note = document.createElement('div'); note.id = 'firenote';
  foot.prepend(note); foot.prepend(bar);
  const card = document.createElement('div'); card.id = 'firecard'; document.body.append(card);
  // THE SENTENCES ARE GROUPED BY WHAT THEY ARE ABOUT, not by which file they came from: a thousand networks under one heading
  // is a wall. The kind a case was kept for is its heading, and the site pulse sentences stay together at the end.
  const fill = (list, first) => { sel.replaceChildren(new Option(first, ''));
    const groups = new Map();
    for (const c of list) { const key = (c.family === 'NETWORKS' && c.kind) ? c.kind.toUpperCase() : c.family;
      if (!groups.has(key)) groups.set(key, []); groups.get(key).push(c); }
    const keys = Array.from(groups.keys()).filter(k => k !== 'SITE PULSE').concat(groups.has('SITE PULSE') ? ['SITE PULSE'] : []);
    for (const k of keys) { const g = document.createElement('optgroup'); g.label = k;
      for (const c of groups.get(k)) g.append(new Option(c.sentence, c.command)); sel.append(g); } };
  // ONLY WHAT RUNS HERE AND DRAWS ITS NETWORK IS LISTED. A command that gives numbers and no drawing is kept out of this list
  // until it has one (it still runs if typed). No sentence fires a blank.
  const runsHere = c => { try { return FIRE_DRAWS.includes(window.FIRE.parse(c.command).name); } catch (_) { return false; } };
  let ALL = FIRE_FALLBACK.filter(runsHere), STATE = 'the sentences kept in this file are listed while the published list is read';
  const show = () => { const q = find.value, shown = searchCommands(ALL, q);
    fill(shown, shown.length ? '- choose an example sentence -' : '- nothing in the list matches "' + q + '" -');
    note.replaceChildren();
    const b = document.createElement('b'); b.textContent = shown.length + ' of ' + ALL.length;
    note.append(b, document.createTextNode('  ·  ' + STATE)); };
  show();
  loadFireConfig(FIRE_CONFIG).then(r => {
    if (r.ok) { const listed = r.commands.filter(runsHere);
      if (!listed.length) { STATE = 'the published list holds nothing this device can run: the sentences kept in this file are listed instead'; return show(); }
      ALL = listed; STATE = 'list ' + r.generation + ', fetched with no cache and hashed on this device'; }
    else STATE = 'THE PUBLISHED LIST WAS NOT USED: ' + r.reason + '. The sentences kept in this file are listed instead.';
    show(); }).catch(e => { STATE = 'THE PUBLISHED LIST WAS NOT USED: ' + (e && e.message ? e.message : e) + '. The sentences kept in this file are listed instead.'; show(); });
  const stop = e => e.stopPropagation();
  for (const x of [find, sel, box, go, card]) for (const ev of ['keydown', 'keyup', 'keypress', 'pointerdown', 'mousedown', 'touchstart', 'wheel', 'click']) x.addEventListener(ev, stop);
  sel.addEventListener('change', () => { if (sel.value) { box.value = sel.value; fireCommand(box.value); } });
  go.addEventListener('click', () => fireCommand(box.value));
  box.addEventListener('keydown', e => { if (e.key === 'Enter') fireCommand(box.value); });
  find.addEventListener('input', show);
  // Enter in the search box fires the first sentence it found, so a search can be run without reaching for the list
  find.addEventListener('keydown', e => { if (e.key !== 'Enter') return;
    const first = searchCommands(ALL, find.value)[0]; if (!first) return;
    sel.value = first.command; box.value = first.command; fireCommand(first.command); });
  if (typeof layout === 'function') layout();
  try { const q = new URLSearchParams(location.search).get('fire'); if (q) { box.value = /^fire\s/i.test(q) ? q : 'fire ' + q; setTimeout(() => fireCommand(box.value), 600); } } catch (_) {}
}
let lastFire = null;
const c0 = text => { try { return window.FIRE.parse(text).inputs; } catch (_) { return {}; } };
function fireCommand(text){
  const card = document.getElementById('firecard'); if (!card) return null;
  const F = (typeof window !== 'undefined' && window.FIRE) || null;
  const close = () => { const b = document.createElement('button'); b.className = 'x'; b.type = 'button'; b.textContent = 'close'; b.addEventListener('click', () => { card.style.display = 'none'; }); return b; };
  const line = (tag, cls, t) => { const e = document.createElement(tag); if (cls) e.className = cls; e.textContent = t; return e; };
  card.replaceChildren(close()); card.style.display = 'block';
  // ON A PHONE THE ANSWER SITS ON TOP OF THE BAR THAT ASKED FOR IT. The bar is three full width lines of 44 px now, so the
  // card is placed against the real height of the foot as it stands, rather than a number written down when it was shorter.
  if (innerWidth <= 700) { const f = document.getElementById('foot'); if (f) card.style.bottom = Math.round(f.getBoundingClientRect().height + 8) + 'px'; }
  let out;
  try { if (!F) throw new Error('the commands did not load'); out = F.fire(text); }
  catch (e) { card.append(line('h4', null, 'NOT RUN'), line('p', 'said', String(e.message || e))); lastFire = { ran:false, error:String(e.message || e) }; return lastFire; }
  if (!out.ran) { card.append(line('h4', null, 'NOT RUN'), line('p', 'said', 'No command called "' + out.name + '" runs here yet. These do: ' + F.names.join(', ') + '.')); lastFire = { ran:false, name:out.name }; return lastFire; }
  card.append(line('h4', null, out.family + '  ·  RAN ON YOUR DEVICE'), line('p', 'said', out.said));
  const tb = document.createElement('table');
  const row = (k, v) => { const tr = document.createElement('tr'); tr.append(line('td', null, k.replace(/_/g, ' ')), line('td', null, v === null ? 'none' : String(v))); tb.append(tr); };
  for (const [k, v] of Object.entries(out.numbers)) { if (v && typeof v === 'object') for (const [k2, v2] of Object.entries(v)) row(k + ' ' + k2, v2); else row(k, v); }
  card.append(tb, line('p', 'small', 'How: ' + out.how),
    line('p', 'small', 'Every input is a public estimate. Change any number in the command and fire again: it runs here and nothing you type leaves this device. An estimate, not a study; provided as is, without warranty of any kind.'));
  lastFire = { ran:true, name:out.name, family:out.family, numbers:out.numbers };
  try { const fp = FIRE_PROGRAM;
    if (out.name === 'site-pulse' || out.name === 'network') { fp.sld = out.name === 'network' ? { kind:'network', net:out.net, solved:out.solved, inputs:c0(text) } : c0(text); if (typeof unisolate === 'function' && iso) unisolate(true);
      programs.push(fp); try { isolate('fire'); } finally { const at = programs.indexOf(fp); if (at >= 0) programs.splice(at, 1); } }      // THE DOTS DRAW THE NETWORK OF THIS COMMAND
    else if (programs.find(p => p.name === 'tests')) isolate('tests'); } catch (e) { console.warn('fire: the dots did not respond', e); }   // THE DOTS RESPOND: the pulse sweeps and the work that holds the tests lights
  return lastFire;
}

// ===== THE SINGLE LINE DIAGRAM, DRAWN BY THE DOTS ================================================
// A site pulse has a real network: grid, connection point, intake cable, busbar, generator, feeders, transformers, loads, solar.
// The lines of the repository that holds the tests leave their places and BECOME that diagram: one dot a line of code, placed along
// the busbar, the feeders and the transformer rings. Then the two pulses of the method run on it: currents summed back to the
// grid, volts out from it; what is over a limit ends amber; what is disconnected ends dark. The engine computes (FIRE.sitePulse.solve);
// the dots show and switch. Values ride in a uniform array read by dot number, so the shell's one draw call is unchanged.
const SLD_MAX = 896;                                  // 224 four-number uniforms: inside what every WebGL 2 device must offer
let sldNow = null, sldLoop = 0;
function sldNetwork(inputs){
  const SP = window.FIRE && window.FIRE.sitePulse; if (!SP) return null;
  const sc = SP.SCENARIOS[inputs.scenario]; if (!sc) return null;
  const site = inputs.site || SP.standardSite(), share = inputs.load_share === undefined ? 1 : inputs.load_share;
  const r = SP.solve(site, sc[1], sc[2], sc[3], share), c = SP.CANDIDATE;
  return { site, r, c, pvShare:sc[1], genOn:sc[2], off:sc[3], over: Math.max(0, -r.p_poc_kw) > site.export_limit_kw };
}
// every piece of the drawing: a list of [x0,y0,x1,y1] lines and [cx,cy,r] rings, each with a tag and its distance from the grid
function sldPieces(net){
  const P = [], subs = net.site.subs, n = subs.length, kmMax = Math.max(...subs.map(s => s.km));
  const line = (tag, d, x0, y0, x1, y1) => P.push({ tag, d, kind:'line', x0, y0, x1, y1, len:Math.hypot(x1 - x0, y1 - y0) });
  const ring = (tag, d, cx, cy, r) => P.push({ tag, d, kind:'ring', cx, cy, r, len:2 * Math.PI * r });
  ring('grid', 0, 0, 0.88, 0.07);
  line('poc', 0.07, 0, 0.80, 0, 0.62); line('poc', 0.25, -0.07, 0.61, 0.07, 0.61);
  line('board', 0.27, 0, 0.59, 0, 0.44);
  line('bus', 0.45, -0.92, 0.42, 0.92, 0.42); line('bus', 0.45, -0.92, 0.395, 0.92, 0.395);
  line('gen', 0.45, -0.62, 0.445, -0.62, 0.57); ring('gen', 0.6, -0.62, 0.65, 0.075);
  subs.forEach((s, i) => { const x = n === 1 ? 0 : -0.8 + 1.6 * i / (n - 1), dx = 0.45 + Math.abs(x), L = 0.12 + 0.2 * s.km / kmMax;
    const t = 'f' + s.n, yT = 0.37 - L;
    line(t, dx, x, 0.37, x, yT);
    ring(t, dx + L, x, yT - 0.06, 0.05); ring(t, dx + L + 0.1, x, yT - 0.175, 0.05);
    const yL = yT - 0.235; line(t, dx + L + 0.2, x, yL, x, yL - 0.12);
    line('load' + s.n, dx + L + 0.32, x - 0.045, yL - 0.13, x, yL - 0.2); line('load' + s.n, dx + L + 0.32, x + 0.045, yL - 0.13, x, yL - 0.2);
    if (s.n === net.site.pv_on) { const sx = x + (x > 0.5 ? -0.13 : 0.13); line('pv', dx + L + 0.26, x + Math.sign(sx - x) * 0.015, yL - 0.05, sx - Math.sign(sx - x) * 0.05, yL - 0.05);
      ring('pv', dx + L + 0.4, sx, yL - 0.05, 0.045); ring('pv', dx + L + 0.4, sx, yL - 0.05, 0.016); } });
  return P;
}
function sldLayout(net, m){
  const P = net.kind === 'network' ? netPieces(net.net) : sldPieces(net), total = P.reduce((t, p) => t + p.len, 0), s = total / m;
  let counts = P.map(p => Math.max(p.kind === 'ring' ? 5 : 2, Math.round(p.len / s)));
  let diff = m - counts.reduce((a, b) => a + b, 0);
  const order = P.map((p, i) => i).sort((a, b) => P[b].len - P[a].len);          // the rounding is taken up by the longest pieces
  for (let q = 0; diff !== 0 && q < 10 * m; q++) { const i = order[q % order.length]; if (diff > 0) { counts[i]++; diff--; } else if (counts[i] > 3) { counts[i]--; diff++; } }
  const unit = new Float32Array(2 * m), tag = new Array(m), dist = new Float32Array(m); let j = 0, dMax = 0;
  P.forEach((p, i) => { for (let q = 0; q < counts[i] && j < m; q++, j++) { const u = (q + 0.5) / counts[i];
    if (p.kind === 'line') { unit[2*j] = p.x0 + (p.x1 - p.x0) * u; unit[2*j+1] = p.y0 + (p.y1 - p.y0) * u; dist[j] = p.d + p.len * u; }
    else { const a = 2 * Math.PI * u + i; unit[2*j] = p.cx + p.r * Math.cos(a); unit[2*j+1] = p.cy + p.r * Math.sin(a); dist[j] = p.d + p.r; }
    tag[j] = p.tag; dMax = Math.max(dMax, dist[j]); } });
  for (; j < m; j++) { unit[2*j] = unit[0]; unit[2*j+1] = unit[1]; tag[j] = 'grid'; }
  return { unit, tag, dist, dMax, spacing:s };
}
// what each dot ends as: 0..1 brightness, 2 = over a limit (amber), -1 = disconnected (dark)
function sldFinal(net, tag){
  const r = net.r, c = net.c, vs = Object.values(r.V), vBad = Math.max(...vs) > c.volts_high_pu || Math.min(...vs) < c.volts_low_pu;
  return tag.map(t => {
    if (t === 'grid') return 0.95; if (t === 'poc') return net.over ? 2 : 0.95; if (t === 'board') return 0.9; if (t === 'bus') return vBad ? 2 : 0.95;
    if (t === 'gen') return net.genOn ? 1 : -1; if (t === 'pv') return net.pvShare > 0 ? 1 : -1;
    const k = +t.replace(/\D/g, ''), load = r.tx_loading_pct['lv' + k];
    if (load === undefined) return -1;                                               // a disconnected substation
    if (t[0] === 'l') return (net.off.includes('pvload') && k === net.site.pv_on) ? -1 : 0.85;
    return load > 100 ? 2 : 0.3 + 0.65 * Math.min(1, load / 100); });
}
function makeSldBody(st){
  const net = (st.prog.sld && st.prog.sld.kind === 'network') ? st.prog.sld : sldNetwork(st.prog.sld || {}); if (!net) return null;
  // EVERY DOT OF THE SKY CAN BE CALLED: the diagram's dots are lines of code from the whole record, evenly through all the keys,
  // so they leave from everywhere on the disc at once.
  // EVERY DOT OF THE DIAGRAM IS A REAL LINE OF CODE, AND SAYS WHOSE. The shell answers a tap on dot j with the piece of work
  // st.idx[j]; a diagram has more dots than the application has pieces of work, so a tap found nothing, threw, and never let the
  // mouse go. So dot j is given the piece of work that issued its key (commits are in key order: a halving search), its place is
  // that work's own middle line, and a tap on the diagram opens that work.
  const m = SLD_MAX, from = new Float32Array(2 * m), owner = new Array(m);
  for (let j = 0; j < m; j++) { const key = Math.floor((j + 0.5) * SPACE / m); let lo = 0, hi = commits.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (commits[mid].k1 > key) hi = mid; else lo = mid + 1; }
    owner[j] = lo; const c0 = commits[lo], p = keyPlace(Math.min(Math.max(key, c0.k0), Math.max(c0.k0, c0.k1 - 1))); from[2*j] = p[0]; from[2*j+1] = p[1]; }
  st.idx = owner;
  const lay = sldLayout(net, m), R = Math.sqrt(SPACE), frac = BODY_RADIUS_MAX, to = new Float32Array(2 * m);
  for (let q = 0; q < 2 * m; q++) to[q] = lay.unit[q] * R * frac;
  const gap = closestPair(lay.unit) * R * frac;
  sldNow = { net, lay, final:net.kind === 'network' ? netFinal(net, lay.tag) : sldFinal(net, lay.tag), t0:0, vals:new Float32Array(SLD_MAX) };
  return { n:m, from, pos:new Float32Array(from), states:[{ shape:'sld', to, gap, frac, hold:0, unresolved:false }], k:-1, gap:0, shown:false, sld:true, sldGap:lay.spacing * R * frac };
}
function sldUniforms(){
  if (!BP) return; gl.useProgram(BP);
  const on = !!(body && body.sld && sldNow);
  gl.uniform1f(gl.getUniformLocation(BP, 'u_sld'), on ? 1 : 0);
  if (on) gl.uniform4fv(gl.getUniformLocation(BP, 'u_val[0]'), sldNow.vals);
}
function sldTick(now){
  sldLoop = 0; if (!(body && body.sld && sldNow)) return;
  const S = sldNow, m = body.n, arrived = !bodyAnim && body.shown;
  if (arrived && !S.t0) S.t0 = now;
  const t = S.t0 ? (now - S.t0) / 1000 : -1, T = 1.5, D = S.lay.dMax, w = D * 0.06;
  for (let j = 0; j < m; j++) { const d = S.lay.dist[j], f = S.final[j]; let v;
    if (t < 0) v = 0.55;                                                              // in flight: every dot alike
    else if (t < T) { const front = D * (1 - t / T); v = Math.abs(d - front) < w ? 1.25 : (d > front ? 0.5 : 0.22); }      // PULSE ONE: back toward the grid
    else if (t < 2 * T) { const front = D * (t / T - 1); v = Math.abs(d - front) < w ? 1.25 : (d < front ? f : 0.22); }     // PULSE TWO: out from the grid, leaving the answer
    else v = f;
    S.vals[j] = v; }
  sldUniforms(); dirty = true;
  if (t < 2 * T + 0.2) sldLoop = requestAnimationFrame(sldTick);
}
function sldStart(){ if (!sldLoop) sldLoop = requestAnimationFrame(sldTick); }

// ===== ANY RADIAL NETWORK, DRAWN BY THE DOTS: fire network {"seed":N} ==========================
// The generator's network (a star, a chain, a tree, sub-boards) laid out as a single line diagram: the busbar on top, every
// substation in its own column, a branch leaving its parent's tee sideways and then down, so no two lines ever share a place.
function netPieces(net){
  const P = [], subs = net.subs, n = subs.length, kids = {}; subs.forEach(s => (kids[s.parent] = kids[s.parent] || []).push(s.n));
  const col = {}, depth = {}; let c = 0;
  (function walk(p, d){ for (const k of (kids[p] || [])) { col[k] = c++; depth[k] = d; walk(k, d + 1); } })(0, 1);
  const maxD = Math.max(...Object.values(depth)), dy = Math.min(0.17, 1.05 / maxD), X = k => n === 1 ? 0 : -0.9 + 1.8 * col[k] / (n - 1), Y = k => 0.37 - dy * (depth[k] - 1) - 0.05;
  const line = (tag, d, x0, y0, x1, y1) => { const len = Math.hypot(x1 - x0, y1 - y0); if (len > 1e-6) P.push({ tag, d, kind:'line', x0, y0, x1, y1, len }); return d + len; };
  const ring = (tag, d, cx, cy, r) => P.push({ tag, d, kind:'ring', cx, cy, r, len:2 * Math.PI * r });
  ring('grid', 0, 0, 0.9, 0.06); let d0 = line('poc', 0.06, 0, 0.83, 0, 0.66); line('poc', d0, -0.06, 0.65, 0.06, 0.65); d0 = line('board', d0, 0, 0.63, 0, 0.45);
  line('bus', d0, -0.95, 0.43, 0.95, 0.43); line('bus', d0, -0.95, 0.405, 0.95, 0.405);
  const teeD = { 0: d0 };
  const sym = (tagT, tagL, tagP, d, x, y, s, r) => {                     // transformer, load and any solar, hanging from (x, y)
    let dd = line(tagT, d, x, y - 0.012, x, y - 0.04); ring(tagT, dd, x, y - 0.04 - r, r); ring(tagT, dd + 0.05, x, y - 0.04 - 3 * r - 0.012, r);
    const yl = y - 0.04 - 4 * r - 0.024; dd = line(tagT, dd + 0.1, x, yl, x, yl - 0.05);
    line(tagL, dd, x - 0.03, yl - 0.06, x, yl - 0.105); line(tagL, dd, x + 0.03, yl - 0.06, x, yl - 0.105);
    if (s.pv_kw > 0) { const sx = x + 0.06; line(tagP, dd, x + 0.012, yl - 0.025, sx - 0.03, yl - 0.025); ring(tagP, dd + 0.05, sx, yl - 0.025, 0.026); ring(tagP, dd + 0.05, sx, yl - 0.025, 0.009); }
    if (net.generator_at === s.n && net.generator_kw > 0) { const gx = x - 0.06; line('gen', dd, x - 0.012, yl - 0.025, gx + 0.03, yl - 0.025); ring('gen', dd + 0.05, gx, yl - 0.025, 0.028); } };
  if (net.generator_at === 0 && net.generator_kw > 0) { line('gen', d0, -0.75, 0.455, -0.75, 0.56); ring('gen', d0 + 0.15, -0.75, 0.62, 0.06); }
  const r = Math.min(0.032, 0.6 / n / 2.4 + 0.012);
  (function walk(p){ for (const k of (kids[p] || [])) { const s = subs[k - 1], x = X(k), y = Y(k), t = 'hv' + k; let d;
      if (p === 0) d = line(t, teeD[0] + Math.abs(x), x, 0.393, x, y);
      else { d = line(t, teeD[p], X(p) + 0.012, Y(p), x, Y(p)); d = line(t, d, x, Y(p) - 0.012, x, y); }
      teeD[k] = d; sym('tx' + k, 'load' + k, 'pv' + k, d, x, y, s, r); walk(k); } })(0);
  let far = 0; for (const p of P) far = Math.max(far, p.kind === 'ring' ? Math.hypot(p.cx, p.cy) + p.r : Math.max(Math.hypot(p.x0, p.y0), Math.hypot(p.x1, p.y1)));
  const k = 0.98 / Math.max(0.98, far);                                   // the whole drawing inside the disc
  for (const p of P) { if (p.kind === 'ring') { p.cx *= k; p.cy *= k; p.r *= k; } else { p.x0 *= k; p.y0 *= k; p.x1 *= k; p.y1 *= k; } p.len *= k; }
  return P;
}
function netFinal(model, tag){
  const net = model.net, r = model.solved, e = r.each, c = window.FIRE.topo.C, over = Math.max(0, -r.p) > net.export_limit_kw, aMax = Math.max(1e-9, r.amps);
  const bad = v => v > c.volts_high_pu || v < c.volts_low_pu;
  return tag.map(t => { if (t === 'grid') return 0.95; if (t === 'poc') return over ? 2 : 0.95; if (t === 'board') return 0.9; if (t === 'bus') return bad(e.volts.board) ? 2 : 0.95;
    if (t === 'gen') return model.inputs.generator ? 1 : -1;
    const k = t.replace(/\D/g, '');
    if (t.startsWith('pv')) return (model.inputs.solar === undefined ? 1 : model.inputs.solar) > 0 ? 1 : -1;
    if (t.startsWith('load')) return bad(e.volts['lv' + k]) ? 2 : 0.85;
    if (t.startsWith('tx')) return e.tx['lv' + k] > 100 ? 2 : 0.3 + 0.65 * Math.min(1, e.tx['lv' + k] / 100);
    return bad(e.volts['hv' + k]) ? 2 : 0.3 + 0.65 * Math.min(1, e.amps['hv' + k] / aMax); });
}

// ===== THE POINTER IS ALWAYS LET GO ==============================================================
// THE FAULT: the shell answers a tap on body dot j with commits[iso.idx[j]] and calls pointerGone(e)
// AFTERWARDS. A drawn diagram has 896 dots and an application has however many pieces of work it has,
// so for most dots iso.idx[j] was undefined, reading .k0 of undefined threw, pointerGone never ran,
// the pointer stayed in the map and the disc went on following a mouse whose button was up. The cure
// above gives every diagram dot its own piece of work, so nothing throws. THIS is the second belt:
// whatever any handler does, the pointer is let go. A listener added here runs AFTER the shell's own
// (they are on the same target in the same phase, and an exception in one listener never stops the
// next), so a throw anywhere in the shell's answer can no longer leave a button pressed for ever.
// It is registered from a timer so that it is registered after the shell's, whatever the load order.
setTimeout(function(){
  var net = function(e){ try { if (typeof pointerGone === 'function') pointerGone(e); } catch (_) {} };
  addEventListener('pointerup', net);
  addEventListener('pointercancel', net);
  addEventListener('pointerout', function(e){ if (e.pointerType === 'mouse' && !e.relatedTarget && e.buttons === 0) net(e); });
  addEventListener('blur', function(){ try { if (typeof pts !== 'undefined' && pts.clear) pts.clear();
    if (typeof drag !== 'undefined') drag = null; if (typeof pinch !== 'undefined') pinch = null; } catch (_) {} });
}, 0);
