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
function unisolate(quiet){ labels(true); sldNow = null; sldNames = null; { const el = document.getElementById('sldnames'); if (el) el.replaceChildren(); }
  if (sldLoop) { cancelAnimationFrame(sldLoop); sldLoop = 0; } iso = null; isoAnim = null; gatherAnim = null; homeAnim = null; body = null; bodyAnim = null; pulse = -1;
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
  for (let i = 0; i < commands.length && out.length < 200; i++) {
    const c = commands[i];
    if (!c) continue;
    const hay = ((c.family || '') + ' ' + (c.kind || '') + ' ' + (c.name || '') + ' ' + (c.sentence || '')).toLowerCase();
    let all = true;
    for (let w = 0; w < words.length; w++) if (hay.indexOf(words[w]) < 0) { all = false; break; }
    if (all) out.push(c);
  }
  return out;
}
// ===== THE FACE: THE DISC, ONE EMPTY BAR, AND A POP-UP FOR EVERYTHING ELSE =======================
// Vikram, 20 September, 04:05: "ALL CLUTTER TEXT AND BUTTON GONE, USE POP UP FOR EVERYTHING AND PIN THE
// BEST ONES NEAR THE TOP OR ALLOW IT TO BE TYPED BUT DONT SHOW PRESET TYPED TEXT IN THE SEARCH BAR ITS
// CLUTTER AND DAUNTING TO NON TECH", and, of the list itself: "clear out duplicate and clutter nonsense
// tests from the pop up".
//
// So the face is the disc and ONE BAR, and the bar is empty, with a short plain sentence in it and no
// command, no JSON and no example. Everything that used to sit on the face - the list of tests, the row
// of applications, the four view commands, the note saying where the list came from - is in one pop-up
// that opens when the bar is touched and closes with Escape, with its cross, or with a tap on the dark.
// A dozen tests are pinned at the top under names a banker can read; the rest of the published thousand
// are reached only by typing in the bar; the command itself is not shown until a reader asks to see it.
const FIRE_CONFIG = 'https://ventusltd.github.io/faraday/bench/results/commands/';
const FIRE_DRAWS = ['site-pulse', 'network'];            // the commands whose network the dots draw
const PINNED_SHOWN = 12;                                 // the curated few; the rest of the pinned hundred behind MORE, everything else by search alone
const FIRE_FALLBACK = [
  { family:'NETWORKS', name:'A chain of substations on full solar', sentence:'A chain of substations, full solar, light load', command:'fire network {"seed":5,"solar":1,"generator":0,"load":0.3}' },
  { family:'NETWORKS', name:'A tree of substations with its generator running', sentence:'A tree of substations, full solar, generator running', command:'fire network {"seed":11,"solar":1,"generator":1,"load":0.3}' },
  { family:'NETWORKS', name:'A factory of seven substations at full load, no solar', sentence:'Sub-boards, seven substations, full load, no solar', command:'fire network {"seed":2026,"solar":0,"generator":0,"load":1}' },
  { family:'NETWORKS', name:'The same factory at the end of a weak grid', sentence:'The same sub-boards on a weak grid', command:'fire network {"seed":2026,"variant":2,"solar":1,"generator":0,"load":0.3}' },
  { family:'NETWORKS', name:'The same factory with every cable three times as long', sentence:'The same sub-boards with every cable three times as long', command:'fire network {"seed":2026,"variant":3,"solar":1,"generator":0,"load":1}' },
  { family:'SITE PULSE', name:'A works with its own solar at full output', sentence:'Site pulse: solar at full output, no generator, load 30%', command:'fire site-pulse {"scenario":3,"load_share":0.3}' },
  { family:'SITE PULSE', name:'The same works with one substation disconnected', sentence:'Site pulse: solar at full output, the tenant substation disconnected', command:'fire site-pulse {"scenario":7,"load_share":0.3}' } ];

// TWO TESTS ARE THE SAME TEST when they draw the same picture and end on the same numbers. The picture is
// the seed and the variant; the numbers are the row the bench recorded when it solved the case. Of the
// 1,000 networks published at 04:06 on 20 September, 102 were another entry word for word in everything a
// reader can see - the same seed at the same solar and the same load, with the generator called on and
// then off, which on those networks moves no dot and no figure - and a list like that reads as nonsense.
// Nothing is offered twice. Where the bench recorded no row, the command itself is the key.
function fireKey(c){
  const r = c && c.row, cmd = String((c && c.command) || '');
  if (!r || typeof r !== 'object') return cmd;
  const seed = /"seed"\s*:\s*(-?\d+)/.exec(cmd), variant = /"variant"\s*:\s*(\d+)/.exec(cmd);
  return [seed ? seed[1] : '?', variant ? variant[1] : '0', r.p_kw, r.vmax_pu, r.vmin_pu, r.worst_tx_pct, r.flags].join('|');
}
function dedupeCommands(list){
  const seen = new Set(), out = [];
  for (const c of (Array.isArray(list) ? list : [])) { const k = fireKey(c); if (seen.has(k)) continue; seen.add(k); out.push(c); }
  return out;
}
// A NAME A BANKER CAN READ. The published list carries one; an older list does not, and then the first
// half of the sentence, up to the colon, is the plain name and the whole sentence is the detail under it.
function plainName(c){
  if (c && c.name) return String(c.name);
  const s = String((c && c.sentence) || (c && c.command) || '');
  const at = s.indexOf(':');
  return at > 8 ? s.slice(0, at) : s;
}
// WHAT TO PIN WHEN NOTHING IS PINNED. The published list says which hundred are worth showing; if the list
// that arrives is older than that, a dozen are chosen here that are visibly different from one another:
// no two the same shape, the same size of network and the same thing being tested.
function curateCommands(list, want){
  const out = [], taken = new Set();
  for (const c of list) {
    const m = /^A ([a-z-]+(?: network)?) of (\d+)/.exec(String(c.sentence || ''));
    const shape = m ? m[1] : (c.family || 'other'), n = m ? +m[2] : 0;
    const band = n <= 3 ? 'small' : (n <= 8 ? 'middling' : 'large');
    const key = shape + '|' + band + '|' + (c.kind || c.family || '');
    if (taken.has(key)) continue;
    taken.add(key); out.push(c);
    if (out.length >= want) break;
  }
  return out;
}

let fireBarMade = false;
let closeFireMenu = null;                                  // set when the bar is built; see runIt
function makeFireBar(){
  if (fireBarMade) return; fireBarMade = true;
  const foot = document.getElementById('foot'); if (!foot) return;
  const st = document.createElement('style');
  st.textContent = '#firebar{display:flex;margin-bottom:6px}'
    + '#firebox{flex:1 1 auto;min-width:0;background:#061018;color:#cfeaf2;border:1px solid #1d6470;padding:9px 10px;font:inherit;font-size:12px}'
    + '#firebox:focus{outline:none;border-color:#00ffff}'
    + '#firebox::placeholder{color:#5f7783}'
    + '#fireshade{position:fixed;inset:0;z-index:9;background:#00000066;display:none}'   // under the foot, which keeps its own taps, and over the disc, so a tap on the dark closes the pop-up
    + '#firemenu{position:fixed;z-index:13;left:50%;transform:translateX(-50%);bottom:64px;width:min(44rem,calc(100vw - 28px));'
    + 'max-height:min(70vh,620px);overflow:auto;background:#040a10f7;border:1px solid #1d6470;color:#cfeaf2;font-size:12px;display:none}'
    + '#firemenu.open{display:block}'
    + '.fm-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 14px;border-bottom:1px solid #12303a;'
    + 'position:sticky;top:0;background:#040a10;z-index:1}'
    + '.fm-title{color:#00ffff;letter-spacing:.12em;font-size:11px}'
    + '.fm-x{background:none;border:0;color:#7f98a3;font:inherit;font-size:11px;cursor:pointer;padding:5px 6px}'
    + '.fm-x:hover,.fm-x:focus{color:#00ffff;outline:none}'
    + '.fm-sec{padding:10px 14px 4px;color:#7f98a3;font-size:10px;letter-spacing:.12em}'
    + '.fm-item{border-top:1px solid #0e2630}'
    + '.fm-row{display:block;width:100%;text-align:left;background:none;border:0;color:#cfeaf2;font:inherit;font-size:12px;padding:9px 14px;cursor:pointer}'
    + '.fm-row:hover,.fm-row:focus{background:#0b1f28;outline:1px solid #1d6470;outline-offset:-1px}'
    + '.fm-name{color:#e8f6fa}'
    + '.fm-said{color:#7f98a3;font-size:10.5px;margin-top:2px;line-height:1.35}'
    + '.fm-cmd{display:none;width:100%;text-align:left;background:none;border:0;color:#5f7783;font:inherit;font-size:10px;'
    + 'padding:0 14px 8px;word-break:break-all;cursor:text}'
    + '#firemenu.rawon .fm-cmd{display:block}'
    + '.fm-cmd:hover,.fm-cmd:focus{color:#8fb3bd;outline:none}'
    + '.fm-note{padding:8px 14px 10px;color:#7f98a3;font-size:10.5px;line-height:1.4}'
    + '.fm-foot{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;padding:9px 14px;'
    + 'border-top:1px solid #12303a;color:#5f7783;font-size:10px;line-height:1.4}'
    + '.fm-link{background:none;border:0;color:#7f98a3;font:inherit;font-size:10px;cursor:pointer;text-decoration:underline;padding:4px 0}'
    + '.fm-link:hover,.fm-link:focus{color:#00ffff;outline:none}'
    + '#firemenu #apps{display:flex;flex-wrap:wrap;gap:6px;padding:4px 14px 10px;margin:0}'
    + '#firemenu .fm-view{display:flex;flex-wrap:wrap;gap:6px;padding:4px 14px 10px}'
    + '#firecard{position:fixed;z-index:11;left:14px;top:14px;width:19rem;max-width:calc(100vw - 28px);max-height:70vh;overflow:auto;'
    + 'background:#040a10f2;border:1px solid #1d6470;color:#cfeaf2;padding:12px 14px;font-size:12px;line-height:1.45;display:none}'
    + '#firecard h4{margin:0 0 6px;color:#00ffff;font-size:11px;letter-spacing:.12em;font-weight:normal}#firecard .said{color:#fff;margin:0 0 8px}'
    + '#firecard table{border-collapse:collapse;width:100%;margin:0 0 8px}#firecard td{padding:2px 0;border-bottom:1px solid #12303a}'
    + '#firecard td+td{text-align:right;color:#fff}'
    + '#firecard .small{color:#7f98a3;font-size:10.5px}'
    + '#firecard .x{position:absolute;right:8px;top:6px;background:none;border:0;color:#7f98a3;font:inherit;cursor:pointer}'
    + '#firecard .more{background:none;border:0;color:#7f98a3;font:inherit;font-size:10.5px;text-decoration:underline;cursor:pointer;padding:4px 0}'
    // A THUMB IS NOT A MOUSE POINTER: every control a finger uses is at least 44 px on a phone.
    + '@media (max-width:700px){#firebox{min-height:44px;font-size:13px}'
    + '#firemenu{left:8px;right:8px;transform:none;width:auto;bottom:58px;max-height:64vh}'
    + '.fm-row{min-height:44px;padding:11px 14px}.fm-x{min-height:44px;min-width:44px}'
    + '#firecard{left:8px;right:8px;top:auto;bottom:150px;width:auto;max-height:36vh}}';
  document.head.append(st);

  const bar = document.createElement('div'); bar.id = 'firebar';
  const box = document.createElement('input'); box.id = 'firebox'; box.type = 'text'; box.autocomplete = 'off'; box.spellcheck = false;
  // THE BAR IS EMPTY AND STAYS EMPTY. No command, no JSON, no example: one plain sentence that says what
  // the bar is for, and nothing at all once a reader starts typing.
  box.placeholder = 'Search the tests, or type a command';
  box.setAttribute('aria-label', 'search the tests, or type a command');
  box.setAttribute('aria-expanded', 'false');
  box.setAttribute('aria-controls', 'firemenu');
  bar.append(box); foot.prepend(bar);

  const shade = document.createElement('div'); shade.id = 'fireshade';
  const menu = document.createElement('div'); menu.id = 'firemenu';
  menu.setAttribute('role', 'dialog'); menu.setAttribute('aria-label', 'the tests, the applications and the view');
  document.body.append(shade, menu);
  // THE APPLICATIONS LEAVE THE FACE AT ONCE, not at the first time the pop-up is opened, or the row would
  // still be sitting under the disc until somebody touched the bar.
  const appsFirst = document.getElementById('apps'); if (appsFirst) menu.append(appsFirst);
  const card = document.createElement('div'); card.id = 'firecard'; document.body.append(card);

  // the applications keep their own element, so the record's own checks still find them; it is simply
  // not on the face any more, it is in this pop-up
  const appsEl = document.getElementById('apps');
  const viewEl = document.createElement('div'); viewEl.className = 'fm-view';
  for (const [k, words] of [['n', 'NEW CODE'], ['r', 'RANDOM LINE'], ['/', 'FIND'], ['Backspace', 'WHOLE VIEW']]) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = words; b.setAttribute('data-k', k);
    b.addEventListener('click', () => { close(); dispatchEvent(new KeyboardEvent('keydown', { key:k })); });
    viewEl.append(b);
  }

  let ALL = dedupeCommands(FIRE_FALLBACK.filter(runsHere)), PINS = curateCommands(ALL, PINNED_SHOWN);
  let SAID = 'the few tests kept inside this page are listed while the published list is read';
  let allPinned = false, rawOn = false;

  function runsHere(c){ try { return FIRE_DRAWS.includes(window.FIRE.parse(c.command).name); } catch (_) { return false; } }
  // THE POP-UP SITS ABOVE THE BAR, WHATEVER HEIGHT THE BAR IS. Its lower edge was a number written down
  // once (64 px), and at 1366x900 the foot is taller than that, so the last row of the list sat behind the
  // bar. The foot is measured instead, every time the pop-up is opened and every time the window changes,
  // and the pop-up is given whatever height is left above it, so it scrolls inside rather than overlapping.
  const fitMenu = () => { const f = document.getElementById('foot');
    const h = f ? Math.round(f.getBoundingClientRect().height) : 56;
    menu.style.bottom = (h + 10) + 'px';
    menu.style.maxHeight = Math.max(160, innerHeight - h - 28) + 'px'; };
  const open = () => { if (menu.classList.contains('open')) { fitMenu(); render(); return; }
    menu.classList.add('open'); shade.style.display = 'block'; box.setAttribute('aria-expanded', 'true'); fitMenu(); render(); };
  const close = () => { menu.classList.remove('open'); shade.style.display = 'none'; box.setAttribute('aria-expanded', 'false'); allPinned = false; };
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

  function runIt(command){
    close();
    box.value = '';                                       // THE BAR GOES BACK TO EMPTY: a fired command is not left sitting in it
    fireCommand(command);
  }
  // AN ANSWER ALWAYS SHUTS THE LIST, whichever way the command was fired: from a row, from the bar, from a
  // ?fire= address, or from a script. The list is what you ask with; the diagram is the answer, and the
  // answer must not arrive behind the question.
  closeFireMenu = () => { close(); box.value = ''; };
  function itemOf(c){
    const wrap = el('div', 'fm-item');
    const b = el('button', 'fm-row'); b.type = 'button';
    b.append(el('div', 'fm-name', plainName(c)));
    if (c.sentence && c.sentence !== plainName(c)) b.append(el('div', 'fm-said', c.sentence));
    b.addEventListener('click', () => runIt(c.command));
    const raw = el('button', 'fm-cmd', c.command); raw.type = 'button';
    raw.title = 'put this command in the bar, to change a number and fire it again';
    raw.addEventListener('click', e => { e.stopPropagation(); box.value = c.command; close(); box.focus(); });
    wrap.append(b, raw);
    return wrap;
  }
  function render(){
    const q = box.value.trim();
    const typed = /^fire\s+\S/i.test(q);
    menu.replaceChildren();
    const head = el('div', 'fm-head');
    head.append(el('div', 'fm-title', typed ? 'A COMMAND' : (q ? 'WHAT MATCHES' : 'TESTS')));
    const x = el('button', 'fm-x', 'close'); x.type = 'button'; x.setAttribute('aria-label', 'close');
    x.addEventListener('click', () => { close(); box.blur(); });
    head.append(x); menu.append(head);
    if (typed) {
      menu.append(el('div', 'fm-sec', 'RUN WHAT IS TYPED'));
      const wrap = el('div', 'fm-item'), b = el('button', 'fm-row'); b.type = 'button';
      b.append(el('div', 'fm-name', q));
      b.append(el('div', 'fm-said', 'runs on this device; nothing you type leaves it'));
      b.addEventListener('click', () => runIt(q));
      wrap.append(b); menu.append(wrap);
    } else if (q) {
      const hits = dedupeCommands(searchCommands(ALL, q));
      menu.append(el('div', 'fm-sec', hits.length ? hits.length + ' OF ' + ALL.length : 'NOTHING MATCHES'));
      if (!hits.length) menu.append(el('div', 'fm-note', 'No test in the published list has all of those words in it. Try fewer words, or a shape: chain, star, tree, sub-board.'));
      for (const c of hits.slice(0, 40)) menu.append(itemOf(c));
    } else {
      menu.append(el('div', 'fm-sec', 'PINNED'));
      const show = allPinned ? PINS : PINS.slice(0, PINNED_SHOWN);
      for (const c of show) menu.append(itemOf(c));
      if (PINS.length > show.length) {
        const wrap = el('div', 'fm-item'), more = el('button', 'fm-row'); more.type = 'button';
        more.append(el('div', 'fm-name', 'More pinned tests (' + (PINS.length - show.length) + ')'));
        more.append(el('div', 'fm-said', 'every other test is reached by typing in the bar above'));
        more.addEventListener('click', () => { allPinned = true; render(); });
        wrap.append(more); menu.append(wrap);
      }
    }
    menu.append(el('div', 'fm-sec', 'THE APPLICATIONS'));
    if (appsEl) menu.append(appsEl);
    menu.append(el('div', 'fm-sec', 'THE VIEW'));
    menu.append(viewEl);
    const foot2 = el('div', 'fm-foot');
    const toggle = el('button', 'fm-link', rawOn ? 'hide the commands' : 'show the commands'); toggle.type = 'button';
    toggle.addEventListener('click', () => { rawOn = !rawOn; menu.classList.toggle('rawon', rawOn); toggle.textContent = rawOn ? 'hide the commands' : 'show the commands'; });
    foot2.append(el('div', null, SAID), toggle);
    menu.append(foot2);
  }

  // the list itself, fetched and hashed the way GridAtlas reads a composition
  loadFireConfig(FIRE_CONFIG).then(r => {
    if (r.ok) {
      const listed = dedupeCommands(r.commands.filter(runsHere));
      if (!listed.length) { SAID = 'the published list holds nothing this device can run, so the few kept in this page are listed'; return render(); }
      const dropped = r.commands.filter(runsHere).length - listed.length;
      ALL = listed;
      const pinned = listed.filter(c => typeof c.pin === 'number').sort((a, b) => a.pin - b.pin);
      PINS = pinned.length ? pinned : curateCommands(listed, 100);
      SAID = listed.length + ' tests, list ' + r.generation + ', fetched with no cache and hashed here'
           + (dropped ? '; ' + dropped + ' repeats of another test left out' : '');
    } else SAID = 'the published list was not used (' + r.reason + '), so the few kept in this page are listed';
    if (menu.classList.contains('open')) render();
  }).catch(e => { SAID = 'the published list was not used (' + (e && e.message ? e.message : e) + '), so the few kept in this page are listed';
    if (menu.classList.contains('open')) render(); });

  // KEYS TYPED IN THE BOX STAY IN THE BOX, and a press inside the pop-up never reaches the disc behind it.
  // BUT ESCAPE IS NOT A KEY THE POP-UP KEEPS. Driving the face found this: tab into the bar, which opens the
  // pop-up, walk into the list, and press Escape - nothing happened, because this very line swallowed it
  // before the window listener that closes the pop-up could hear it. From then on every key belonged to a
  // list the reader thought was shut: / did not open the find box and WHOLE VIEW did not bring the disc
  // back. Escape now closes the pop-up wherever it is pressed inside it, and hands the keyboard back.
  const stop = e => {
    if (e.type === 'keydown' && e.key === 'Escape') { e.stopPropagation(); close(); box.blur(); return; }
    e.stopPropagation();
  };
  for (const x of [box, menu, card]) for (const ev of ['keydown', 'keyup', 'keypress', 'pointerdown', 'mousedown', 'touchstart', 'wheel', 'click']) x.addEventListener(ev, stop);
  box.addEventListener('focus', open);
  box.addEventListener('click', open);
  box.addEventListener('input', () => { if (menu.classList.contains('open')) render(); else open(); });
  box.addEventListener('keydown', e => {
    if (e.key === 'Escape') { close(); box.blur(); return; }
    if (e.key !== 'Enter') return;
    const q = box.value.trim(); if (!q) return;
    if (/^fire\s+\S/i.test(q)) return runIt(q);
    const first = dedupeCommands(searchCommands(ALL, q))[0];
    if (first) runIt(first.command);
  });
  shade.addEventListener('pointerdown', e => { e.stopPropagation(); close(); box.blur(); });
  addEventListener('resize', () => { if (menu.classList.contains('open')) fitMenu(); });
  addEventListener('orientationchange', () => { if (menu.classList.contains('open')) fitMenu(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && menu.classList.contains('open')) { e.preventDefault(); close(); box.blur(); } });
  if (typeof layout === 'function') layout();
  // ?fire=<command> still runs a command on arrival: every firing is a link
  try { const q = new URLSearchParams(location.search).get('fire'); if (q) setTimeout(() => fireCommand(/^fire\s/i.test(q) ? q : 'fire ' + q), 600); } catch (_) {}
}
// SOMETHING IS ON THE SCREEN AT ONCE. The bar used to be built only after the whole record had loaded and
// the application buttons had been made, so a visitor on a slow line saw a black page with nothing on it
// while a megabyte arrived. It is built as soon as this file runs.
if (document.readyState === 'loading') addEventListener('DOMContentLoaded', () => { try { makeFireBar(); } catch (_) {} });
else { try { makeFireBar(); } catch (_) {} }

let lastFire = null;
const c0 = text => { try { return window.FIRE.parse(text).inputs; } catch (_) { return {}; } };
// THE FIGURES A READER ACTUALLY WANTS, in the order an engineer would read them out. Everything else is
// behind MORE: the card used to be a table of fourteen rows and a paragraph, which is a page, not an answer.
const CARD_FIRST = ['connection point kw', 'lowest volts pu', 'highest volts pu', 'worst transformer pct', 'busiest cable amps',
                    'p poc kw', 'worst tx pct', 'export limit kw'];
function fireCommand(text){
  if (closeFireMenu) { try { closeFireMenu(); } catch (_) {} }
  const card = document.getElementById('firecard'); if (!card) return null;
  const F = (typeof window !== 'undefined' && window.FIRE) || null;
  const close = () => { const b = document.createElement('button'); b.className = 'x'; b.type = 'button'; b.textContent = 'close';
    b.setAttribute('aria-label', 'close this answer'); b.addEventListener('click', () => { card.style.display = 'none'; }); return b; };
  const line = (tag, cls, t) => { const e = document.createElement(tag); if (cls) e.className = cls; e.textContent = t; return e; };
  card.replaceChildren(close()); card.style.display = 'block';
  // ON A PHONE THE ANSWER SITS ABOVE THE BAR THAT ASKED FOR IT, against the real height of the foot.
  if (innerWidth <= 700) { const f = document.getElementById('foot'); if (f) card.style.bottom = Math.round(f.getBoundingClientRect().height + 8) + 'px'; }
  let out;
  try { if (!F) throw new Error('the commands did not load'); out = F.fire(text); }
  catch (e) { card.append(line('h4', null, 'NOT RUN'), line('p', 'said', String(e.message || e))); lastFire = { ran:false, error:String(e.message || e) }; return lastFire; }
  if (!out.ran) { card.append(line('h4', null, 'NOT RUN'), line('p', 'said', 'No command called "' + out.name + '" runs here yet. These do: ' + F.names.join(', ') + '.')); lastFire = { ran:false, name:out.name }; return lastFire; }
  card.append(line('h4', null, out.family + '  ·  RAN ON YOUR DEVICE'), line('p', 'said', out.said));
  // one flat list of every figure, then the few that lead
  const rows = [];
  for (const [k, v] of Object.entries(out.numbers)) { if (v && typeof v === 'object') for (const [k2, v2] of Object.entries(v)) rows.push([k + ' ' + k2, v2]); else rows.push([k, v]); }
  const label = k => k.replace(/_/g, ' ');
  const lead = [], rest = [];
  for (const r of rows) (CARD_FIRST.includes(label(r[0])) ? lead : rest).push(r);
  while (lead.length < 4 && rest.length) lead.push(rest.shift());
  const table = list => { const tb = document.createElement('table');
    for (const [k, v] of list) { const tr = document.createElement('tr');
      tr.append(line('td', null, label(k)), line('td', null, v === null ? 'none' : String(v))); tb.append(tr); }
    return tb; };
  card.append(table(lead.slice(0, 4)));
  if (rest.length || lead.length > 4) {
    const more = line('button', 'more', 'more (' + (rest.length + Math.max(0, lead.length - 4)) + ' figures, and how)'); more.type = 'button';
    const box = document.createElement('div'); box.style.display = 'none';
    box.append(table(lead.slice(4).concat(rest)), line('p', 'small', 'How: ' + out.how),
      line('p', 'small', 'Every input is a public estimate. Change any number in the command and fire again: it runs here and nothing you type leaves this device. An estimate, not a study; provided as is, without warranty of any kind.'));
    more.addEventListener('click', () => { const on = box.style.display === 'none'; box.style.display = on ? 'block' : 'none';
      more.textContent = on ? 'less' : 'more (' + (rest.length + Math.max(0, lead.length - 4)) + ' figures, and how)'; });
    card.append(more, box);
  }
  lastFire = { ran:true, name:out.name, family:out.family, numbers:out.numbers };
  try { const fp = FIRE_PROGRAM;
    if (out.name === 'site-pulse' || out.name === 'network') { fp.sld = out.name === 'network' ? { kind:'network', net:out.net, solved:out.solved, inputs:c0(text) } : c0(text); if (typeof unisolate === 'function' && iso) unisolate(true);
      programs.push(fp); try { isolate('fire'); } finally { const at = programs.indexOf(fp); if (at >= 0) programs.splice(at, 1); } }      // THE DOTS DRAW THE NETWORK OF THIS COMMAND
    else if (programs.find(p => p.name === 'tests')) isolate('tests'); } catch (e) { console.warn('fire: the dots did not respond', e); }
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
  // A SYMBOL IS NOT A LENGTH. Dots were handed out in proportion to how long each piece is, so a cable
  // hundreds of units long took hundreds of dots and the generator - one short stub and a circle two
  // hundredths of the drawing across - got the floor of five, which is a faint pentagon nobody can find.
  // The Supervisor looked at a tree of twelve with its generator RUNNING and could not see a generator.
  // The pieces that are SYMBOLS (the grid, the generator, the solar) are given enough dots to read as the
  // thing they are; the long cables give them up, which costs a cable nothing.
  const SYMBOL = t => t === 'grid' || t === 'gen' || t.startsWith('pv');
  let counts = P.map(p => Math.max(SYMBOL(p.tag) ? (p.kind === 'ring' ? 16 : 6) : (p.kind === 'ring' ? 5 : 2), Math.round(p.len / s)));
  let diff = m - counts.reduce((a, b) => a + b, 0);
  const order = P.map((p, i) => i).sort((a, b) => P[b].len - P[a].len);          // the rounding is taken up by the longest pieces
  for (let q = 0; diff !== 0 && q < 10 * m; q++) { const i = order[q % order.length]; if (diff > 0) { counts[i]++; diff--; }
    else if (counts[i] > (SYMBOL(P[i].tag) ? (P[i].kind === 'ring' ? 16 : 6) : 3)) { counts[i]--; diff++; } }
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
  // THE DRAWING FILLS THE DISC. Each drawing was laid out in its own units and then scaled by how far its
  // farthest point lay FROM THE ORIGIN, which is not where the drawing is: a network whose busbar sits high
  // and whose loads hang low was pushed off centre and left using about half the disc, with a ring of empty
  // dark around it. Its own extent is found, its middle is moved to the middle of the disc, and it is blown
  // up until its farthest dot is at the rim. Nothing about the drawing changes but its size and its place.
  { let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let j = 0; j < m; j++) { const x = lay.unit[2*j], y = lay.unit[2*j+1];
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    let far = 0;
    for (let j = 0; j < m; j++) { const d = Math.hypot(lay.unit[2*j] - mx, lay.unit[2*j+1] - my); if (d > far) far = d; }
    const k = far > 1e-9 ? 0.97 / far : 1;
    for (let j = 0; j < m; j++) { lay.unit[2*j] = (lay.unit[2*j] - mx) * k; lay.unit[2*j+1] = (lay.unit[2*j+1] - my) * k; }
    lay.spacing *= k; }
  for (let q = 0; q < 2 * m; q++) to[q] = lay.unit[q] * R * frac;
  const gap = closestPair(lay.unit) * R * frac;
  sldNow = { net, lay, final:net.kind === 'network' ? netFinal(net, lay.tag) : sldFinal(net, lay.tag), t0:0, vals:new Float32Array(SLD_MAX) };
  nameLayer();
  sldNames = makeSldNames(lay, net);
  { const amber = addAmberName(lay, sldNow.final); if (amber) sldNames.push(amber); }
  return { n:m, from, pos:new Float32Array(from), states:[{ shape:'sld', to, gap, frac, hold:0, unresolved:false }], k:-1, gap:0, shown:false, sld:true, sldGap:lay.spacing * R * frac };
}
// ===== THE FEWEST WORDS A DIAGRAM NEEDS ==========================================================
// A picture of nine substations with no word on it anywhere is a pattern, not a single line diagram, to
// anybody who is not an engineer. Three words are added, and no more: GRID where the grid is, what the
// connection point is doing (exports 50 kW, or imports 1,649 kW) where the connection point is, and the
// name of whatever ended AMBER, because amber is the only thing on the picture that is a warning and a
// colour nobody can look up. They are drawn as plain text over the canvas, no boxes and no lines, at the
// place the drawing itself puts them, and they appear only once the dots have landed.
let sldNames = null;
function nameLayer(){
  let el = document.getElementById('sldnames');
  if (!el) { el = document.createElement('div'); el.id = 'sldnames';
    const st = document.createElement('style');
    st.textContent = '#sldnames{position:fixed;inset:0;z-index:4;pointer-events:none}'
      + '#sldnames span{position:absolute;transform:translate(-50%,-50%);color:#cfeaf2;font-size:10.5px;letter-spacing:.06em;'
      + 'white-space:nowrap;text-shadow:0 0 6px #000,0 0 3px #000}'
      + '#sldnames span.warn{color:#ffb454}'
      + '@media (max-width:700px){#sldnames span{font-size:9.5px}}';
    document.head.append(st); document.body.append(el); }
  return el;
}
const AMBER_WORDS = { bus:'volts outside the band', poc:'over the export limit', grid:'', board:'' };
function amberName(tag){
  if (!tag) return '';
  if (AMBER_WORDS[tag] !== undefined) return AMBER_WORDS[tag];
  if (tag.startsWith('tx')) return 'transformer over its rating';
  if (tag.startsWith('load')) return 'volts outside the band at the load';
  if (tag.startsWith('hv')) return 'volts outside the band on this cable';
  if (tag.startsWith('f')) return 'transformer over its rating';
  return '';
}
// WHAT THE CONNECTION POINT IS DOING, in the words the bench itself uses: minus is out to the grid.
function pocWords(net){
  let kw = null;
  if (net.kind === 'network' && net.solved) kw = net.solved.p;
  else if (net.r && net.r.p_poc_kw !== undefined) kw = net.r.p_poc_kw;
  if (kw === null || kw === undefined || !isFinite(kw)) return '';
  const n = Math.abs(Math.round(kw));
  return (kw < 0 ? 'exports ' : 'imports ') + (typeof fmt === 'function' ? fmt(n) : String(n)) + ' kW';
}
// the places, in the drawing's own units AFTER it has been fitted to the disc, so they follow the dots
function makeSldNames(lay, net){
  const want = [], first = tag => { for (let j = 0; j < lay.tag.length; j++) if (lay.tag[j] === tag) return j; return -1; };
  const at = j => ({ x:lay.unit[2*j], y:lay.unit[2*j+1] });
  const g = first('grid'); if (g >= 0) want.push(Object.assign(at(g), { text:'GRID', dy:-0.10, warn:false }));
  const pc = first('poc'), words = pocWords(net);
  if (pc >= 0 && words) want.push(Object.assign(at(pc), { text:words, dy:0, dx:0.22, warn:false }));
  return want;
}
function addAmberName(lay, final){
  const seen = new Set();
  for (let j = 0; j < final.length; j++) {
    if (final[j] !== 2) continue;
    const words = amberName(lay.tag[j]);
    if (!words || seen.has(words)) continue;
    seen.add(words);
    return { x:lay.unit[2*j], y:lay.unit[2*j+1], text:words, dy:-0.06, warn:true };
  }
  return null;
}
// THE WORDS FOLLOW THE PICTURE. They are put where they belong every time the camera moves, and nowhere
// else: no animation loop of their own is started, because a loop that runs for ever to move three words
// is a loop that runs for ever.
function placeSldNames(){
  const el = document.getElementById('sldnames');
  if (!el) return;
  if (!sldNames || !body || !body.sld || !body.shown || bodyAnim || !sldNow) { el.replaceChildren(); return; }
  const R = Math.sqrt(SPACE), frac = BODY_RADIUS_MAX;
  if (el.childElementCount !== sldNames.length) {
    el.replaceChildren(...sldNames.map(n => { const sp = document.createElement('span');
      sp.textContent = n.text; if (n.warn) sp.className = 'warn'; return sp; }));
  }
  sldNames.forEach((n, i) => { const sp = el.children[i]; if (!sp) return;
    const wx = (n.x + (n.dx || 0)) * R * frac, wy = (n.y + (n.dy || 0)) * R * frac;
    sp.style.left = ((wx - cx) * zoom + innerWidth / 2) + 'px';
    sp.style.top = (innerHeight / 2 - (wy - cy) * zoom) + 'px'; });
}
addEventListener('wheel', placeSldNames, { passive:true });
addEventListener('pointermove', placeSldNames);
addEventListener('pointerup', placeSldNames);
addEventListener('resize', placeSldNames);
addEventListener('orientationchange', placeSldNames);

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
  sldUniforms(); placeSldNames(); dirty = true;
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
