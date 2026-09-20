'use strict';
// kuiper-programs.js - a cartridge of the Kuiper shell. Cut from the whole page with no change of behaviour;
// replaced, when it is, by a newer file the pointer names and the composer checks by its hash.
let ASM = null, gatherAnim = null, homeAnim = null;
// the live answer window and the way back to a preset: declared here because the bar is built long
// before the part of this file that uses them has run
let fireLive = null, fireAgain = null;
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
  body.shown = true; dirty = true;
  // A ROW SEVERAL SCREENS WIDE IS SHOWN WHOLE WHILE THE WORK GATHERS ALONG IT, and only then is the
  // reader taken to the near end, where the inverter and the first modules can actually be read.
  if (body.sld && sldShapes && sldShapes.kind === 'string') { try { stringWholeView(); } catch (_) {} } }
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
  // A WIRING DRAWING'S DOTS ARE THE ENTRANCE AND NOTHING MORE, so they are held to a fine weight: on a
  // drawing several screens wide the same rule would grow them into discs sitting on top of the words.
  const cap = (body.sld && body.fineDots) ? 1.6 : DOT_MAX_PX;
  return Math.max(0.5, Math.min(cap, gap * zoom / 3)); }
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
  if (typeof shapesGone === 'function') shapesGone();
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
  function fire(text) { const c = parse(text), f = RUN[c.name]; if (!f) return { name: c.name, inputs: c.inputs, ran: false }; const o = f.run(c.inputs); return Object.assign({ name: c.name, inputs: c.inputs, ran: true, family: f.family, boxes: f.inputs || null }, o); }
  // another file may add commands:  FIRE.register('site-pulse', 'SITE PULSE', inputs => ({ numbers, said, how }), boxes)
  // EVERY COMMAND DECLARES ITS OWN INPUTS, and that declaration is part of the protocol, not an extra:
  //   { key, label, unit, kind:'number'|'choice', min, max, step, choices:[[value, words], ...] }
  // The window builds a labelled box for each one, so a command written next year gets its boxes free.
  function register(name, family, run, inputs) { RUN[name] = { family, run, inputs: inputs || null }; }
  root.FIRE = { fire, parse, register, inputsOf: n => (RUN[n] && RUN[n].inputs) || null, get names() { return Object.keys(RUN); } };
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
// ===== ONE SOLAR STRING, WIRED TWO WAYS: fire string {"wiring":"leapfrog"} =======================
// A row of modules in series. SEQUENTIAL joins each module to the next and needs one more cable the length of the row to bring the
// far end home. LEAPFROG joins every other module on the way out and the ones between on the way back, so both ends finish at the
// near end and that cable is not laid: the return travels in the modules' own leads. Whether the leads REACH is geometry: the two
// junction boxes sit a stated distance apart on every module, so a link on the way out is two pitches LESS that distance and a link
// on the way back is two pitches MORE. Every length here is counted from stated inputs; every figure is an estimate. No real site.
(function (root) {
  const F = root.FIRE; if (!F) return;
  const R20 = { 2.5: 8.21, 4: 5.09, 6: 3.39, 10: 1.95 };                                    // milliohm per metre at 20 C, tinned copper, class 5
  const DEF = { modules: 30, width_m: 1.303, module_height_m: 2.384, cell_cols: 6, cell_rows: 22, module_vmp: 38.1, module_voc: 45.9,
                gap_m: 0.02, box_spacing_m: 0.84, wiring: 'leapfrog', turn_every_second: 0,
                lead_plus_m: null, lead_minus_m: null, lead_mm2: 4, cable_mm2: 6, near_end_m: 59, amps: 17.35, conductor_c: 70,
                contact_milliohm: 0.35, return_offset_m: 0.3, lead_gap_m: 0.05 };
  const rnd = (x, n) => { const k = Math.pow(10, n); return Math.round(x * k) / k; };
  function build(inp) {
    const c = Object.assign({}, DEF, inp || {}), N = Math.max(2, Math.min(40, Math.round(c.modules))), pitch = c.width_m + c.gap_m, a = (c.width_m - c.box_spacing_m) / 2;
    const leap = String(c.wiring).toLowerCase() !== 'sequential';
    if (c.lead_plus_m === null) c.lead_plus_m = leap ? 0.84 : 0.35;
    if (c.lead_minus_m === null) c.lead_minus_m = leap ? 1.89 : 0.28;
    const turned = k => !!c.turn_every_second && k % 2 === 0, x0 = k => (k - 1) * pitch;
    const minus = k => x0(k) + a + (turned(k) ? c.box_spacing_m : 0), plus = k => x0(k) + a + (turned(k) ? 0 : c.box_spacing_m);
    const order = []; if (leap) { for (let k = 1; k <= N; k += 2) order.push(k); for (let k = (N % 2 ? N - 1 : N); k >= 2; k -= 2) order.push(k); } else for (let k = 1; k <= N; k++) order.push(k);
    const pair = c.lead_plus_m + c.lead_minus_m, links = [];
    for (let i = 0; i + 1 < order.length; i++) { const from = order[i], to = order[i + 1], need = Math.abs(plus(from) - minus(to));
      links.push({ from, to, need, reaches: pair + 1e-9 >= need, back: to < from, x_from: plus(from), x_to: minus(to) }); }
    const last = order[order.length - 1], row = N * pitch, ret = leap ? 0 : plus(last), f = 1 + 0.00393 * (c.conductor_c - 20);
    const lead_m = N * pair, field_m = 2 * c.near_end_m + minus(order[0]) + (leap ? plus(last) : 0) + ret;
    const pairs = links.length + 2 + (leap ? 0 : 1);
    const ohm = ((R20[c.lead_mm2] || 5.09) * lead_m + (R20[c.cable_mm2] || 3.39) * field_m) / 1000 * f + pairs * c.contact_milliohm / 1000;
    const short = links.filter(l => !l.reaches), needs = links.map(l => l.need);
    const loop = leap ? row * c.lead_gap_m : row * c.return_offset_m;
    return { c, N, pitch, a, leap, order, links, row, pair, lead_m, field_m, pairs, ohm, short, needs, loop, minus, plus, turned };
  }
  function run(inp) {
    const g = build(inp), c = g.c, worst = g.short.length ? Math.max(...g.short.map(l => l.need - g.pair)) : 0;
    const name = (g.leap ? 'Leapfrog' : 'Sequential') + (c.turn_every_second ? ', every second module turned end for end' : '');
    // A SERIES CIRCUIT IS OPEN OR IT IS NOT. One pair of connectors that does not meet and the whole
    // string carries nothing: not a warm link, not a derated string, NOTHING, anywhere in it.
    const open = g.short.length > 0, amps = open ? 0 : c.amps;
    // AN OPEN STRING IS NOT A DEAD STRING. No current flows, and that is the whole of what "open" means;
    // the modules go on making their open circuit voltage, so the full string voltage stands across a
    // break, and an open connector under that voltage is exactly where a direct current arc begins.
    const voc = g.N * c.module_voc;
    const order = g.order.map(k => 'M' + k).join(' → ');
    const said = name + ': ' + g.N + ' modules, ' + g.links.length + ' links from ' + Math.min(...g.needs).toFixed(2) + ' to ' + Math.max(...g.needs).toFixed(2) + ' m against a lead pair of ' + g.pair.toFixed(2) + ' m; '
      + (open ? 'THE CIRCUIT IS OPEN AND BOTH ENDS ARE LIVE: ' + g.short.length + ' links do not reach (short by up to ' + worst.toFixed(2) + ' m), so no current flows anywhere, but up to '
                + voc.toFixed(0) + ' V stands across a break and an open connector at that voltage is where a direct current arc starts'
              : 'every link reaches, so the loop closes and ' + c.amps + ' A flows all the way round it')
      + '; ' + g.lead_m.toFixed(1) + ' m of module lead and ' + g.field_m.toFixed(1) + ' m of cable laid on site; ' + g.ohm.toFixed(3) + ' ohm, ' + (amps * amps * g.ohm).toFixed(0) + ' W lost at ' + amps + ' A';
    return { numbers: { circuit: open ? 'OPEN, both ends live' : 'closed', current_a: rnd(amps, 2),
               open_circuit_volts_at_25c: rnd(voc, 0), volts_across_a_break: open ? rnd(voc, 0) : 0, links: g.links.length,
               shortest_link_m: rnd(Math.min(...g.needs), 3), longest_link_m: rnd(Math.max(...g.needs), 3), lead_pair_m: rnd(g.pair, 3),
               links_that_do_not_reach: g.short.length, worst_shortfall_m: rnd(worst, 3), module_lead_m: rnd(g.lead_m, 1), cable_laid_on_site_m: rnd(g.field_m, 1),
               total_conductor_m: rnd(g.lead_m + g.field_m, 1), connector_pairs: g.pairs, string_resistance_ohm: rnd(g.ohm, 4), loss_w: rnd(amps * amps * g.ohm, 1),
               volt_drop_v: rnd(amps * g.ohm, 2), row_length_m: rnd(g.row, 2), string_volts_at_vmp: rnd(g.N * c.module_vmp, 0),
               volts_to_earth_each_end: '−' + rnd(g.N * c.module_vmp / 2, 0) + ' to +' + rnd(g.N * c.module_vmp / 2, 0),
               enclosed_loop_area_m2_rough: rnd(g.loop, 1) },
             said, electrical_order: order,
             how: 'geometry only: module ' + c.width_m + ' m wide by ' + c.module_height_m + ' m tall in portrait, ' + c.cell_cols + ' by ' + c.cell_rows
               + ' half cells, junction boxes ' + c.box_spacing_m + ' m apart at mid height, a link is the distance between the boxes it joins; leads ' + c.lead_mm2 + ' mm2, site cable ' + c.cable_mm2
               + ' mm2, copper at ' + c.conductor_c + ' C; near end ' + c.near_end_m + ' m from the inverter; the enclosed loop is row length x a stated gap, rough, and is what a nearby stroke couples into. '
               + 'Electrical order ' + order + '. Colour is the POTENTIAL RELATIVE TO THE MINUS TERMINAL, not to earth: the array floats, so either terminal may sit at up to half the '
               + 'array voltage with respect to earth, and a black line does not mean an earthed one. The line does not thicken or thin along the string, because a series circuit carries one current. '
               + 'The sweep round the loop is the INSTANT OF CLOSURE; in steady direct current nothing travels along the wire. An open string carries no current and is NOT safe: up to '
               + rnd(voc, 0) + ' V at 25 C stands across a break, more when it is cold. '
               + 'Every input can be changed. An estimate, not a study.', string: g, inputs_used: Object.assign({}, c) };
  }
  // WHAT A READER MAY TURN, in plain words with its unit. The window makes a box out of each of these.
  const BOXES = [
    { key:'wiring', label:'wiring', kind:'choice', choices:[['leapfrog', 'leapfrog'], ['sequential', 'one after another']] },
    { key:'turn_every_second', label:'every second module turned', kind:'choice', choices:[[0, 'no'], [1, 'yes']] },
    { key:'modules', label:'modules', kind:'number', min:2, max:40, step:1 },
    { key:'width_m', label:'module width', unit:'m', kind:'number', min:0.4, max:3, step:0.001 },
    { key:'module_height_m', label:'module height', unit:'m', kind:'number', min:0.4, max:4, step:0.001 },
    { key:'gap_m', label:'gap between modules', unit:'m', kind:'number', min:0, max:1, step:0.005 },
    { key:'box_spacing_m', label:'junction boxes apart', unit:'m', kind:'number', min:0.05, max:2, step:0.01 },
    { key:'lead_plus_m', label:'+ lead', unit:'m', kind:'number', min:0.05, max:8, step:0.01 },
    { key:'lead_minus_m', label:'− lead', unit:'m', kind:'number', min:0.05, max:8, step:0.01 },
    { key:'lead_mm2', label:'lead size', unit:'mm2', kind:'choice', choices:[[2.5, '2.5'], [4, '4'], [6, '6'], [10, '10']] },
    { key:'cable_mm2', label:'site cable', unit:'mm2', kind:'choice', choices:[[4, '4'], [6, '6'], [10, '10']] },
    { key:'near_end_m', label:'near end from the inverter', unit:'m', kind:'number', min:0, max:400, step:1 },
    { key:'amps', label:'current', unit:'A', kind:'number', min:0.1, max:40, step:0.01 },
    { key:'conductor_c', label:'conductor temperature', unit:'C', kind:'number', min:-25, max:120, step:1 },
    { key:'module_vmp', label:'module at most power', unit:'V', kind:'number', min:5, max:100, step:0.1 },
    { key:'module_voc', label:'module open circuit', unit:'V', kind:'number', min:5, max:120, step:0.1 },
    // ROOM LEFT HERE, deliberately, for inputs already agreed and not yet built: how far apart the two
    // home runs are laid (which decides the home run's own loop area separately from the array's), and
    // the lead temperature and the site cable temperature as two figures, with the single conductor
    // temperature kept as the name for both.
    { key:'cell_cols', label:'cells across', kind:'number', min:1, max:24, step:1 },
    { key:'cell_rows', label:'cells up', kind:'number', min:2, max:48, step:2 }
  ];
  F.register('string', 'STRINGS', run, BOXES);
  F.string = { build, DEF };
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
// ===== THE WAFER'S OWN BAR AND WINDOW, LIFTED ONTO THE KUIPER ====================================
// Vikram, on seeing the pop-up this replaced: "You've killed the preset wafer lifted popup bar". His
// standing rule is that the wafer development environment page IS the look and every feature evolves
// that renderer; a list pop-up of my own invention is a new look, and it went. What is here is the
// wafer's own component, taken from
// globalgrid2050.com/testcode/wafer-development-environment/202609192215-proof-s0004/ (pilot.mjs), with
// its own ids, its own classes and its own proportions kept, so the two bars are one component:
//
//   #pilot   one full width typed bar across the very bottom, with #pin in it
//   #eg      the examples picker just above it on the right: "EXAMPLES: PICK ONE, IT LANDS IN THE BOX,
//            PRESS ENTER" over "- choose an example sentence -"
//   #presets the preset chips along the top left, the way the wafer carries home, the grid, 400 kV
//   #say     the window: #saybar with the title and minimise, maximise and close, #saybody under it,
//            dragged by its bar, resized from its corner
//
// What the owner asked for on top of the wafer, and what is his and not the wafer's:
//   - choosing a preset FIRES it. The bar then shows its plain NAME, never the JSON.
//   - the command text is shown only when it is asked for, inside the window, where it can be edited
//     and fired again.
//   - typing in the bar searches the published thousand by their plain words; the picker becomes the
//     list of what matched, and Enter fires the first of them.
//   - nothing is offered twice (see fireKey above), and the face carries nothing else at all.
const FIRE_CONFIG = 'https://ventusltd.github.io/faraday/bench/results/commands/';
const FIRE_DRAWS = ['site-pulse', 'network', 'string'];            // the commands whose network the dots draw
const CHIPS_SHOWN = 8;                                   // the best few as chips, the way the wafer pins its best few
const PICKER_SHOWN = 100;                                // the pinned hundred in the picker; the rest by typing
// THE STRING TESTS live in this file: they are geometry, they need no bench run, and they are shown first.
const STRING_TESTS = [
  { family:'STRINGS', pin:-3, name:'A leapfrog string, do the leads reach?', sentence:'Thirty modules, every other one joined on the way out, the rest on the way back', command:'fire string {"wiring":"leapfrog"}' },
  { family:'STRINGS', pin:-2, name:'Leapfrog turned, every second module end for end', sentence:'Turning every second module end for end makes every link the short kind', command:'fire string {"wiring":"leapfrog","turn_every_second":1,"lead_plus_m":0.84,"lead_minus_m":1.13}' },
  { family:'STRINGS', pin:-1, name:'A sequential string, one more cable brings the far end home', sentence:'Each module to the next, and one cable the length of the row to bring the far end home', command:'fire string {"wiring":"sequential"}' },
];
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
// that arrives is older than that, a set is chosen here that is visibly different: no two the same shape,
// the same size of network and the same thing being tested.
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
// a chip is a short word, so a chip takes the head of the name and nothing else
function chipWords(c){
  const n = plainName(c), at = n.indexOf(',');
  const head = at > 4 ? n.slice(0, at) : n;
  return head.length > 30 ? head.slice(0, 29) + '…' : head;
}

let fireBarMade = false;
let closeFireMenu = null;                                // set when the bar is built: an answer always shuts the picker's list
let sayOpen = null;                                      // set when the bar is built: open the window on some words
function makeFireBar(){
  if (fireBarMade) return; fireBarMade = true;
  if (!document.body) return;
  const st = document.createElement('style');
  // The wafer's own rules, kept: the bottom of the screen is a stack, not a pile.
  st.textContent = ':root{--cmd:56px;--footh:34px;--stack:calc(var(--cmd) + var(--footh) + 8px);--egh:0px;--above:calc(var(--stack) + 8px)}'
    // THE BAR IS INSIDE THE SHELL'S OWN FOOT, not fixed on top of it. The wafer's bar is the last thing at
    // the bottom of its page, under the one line that says what the page is not, and the Kuiper's shell
    // measures its foot to decide how big the disc is and where the work card sits. A bar fixed over the
    // foot was a bar the shell could not see: the card checks read the card as off the screen at 390. So
    // the same component is built as the last child of #foot, and the picker as its first, and everything
    // the shell does about height goes on working.
    + '#pilot{display:flex;gap:8px;margin-top:7px;padding-top:7px;border-top:1px solid #1b2030}'
    + '#pilot input{flex:1;min-width:0;font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:#11151f;color:#cfe3f2;'
    + 'border:1px solid #1b2030;border-radius:6px;padding:.6rem .9rem}'
    + '#pilot input:focus{outline:1px solid #5ec8f2}'
    + '#pilot input::placeholder{color:#5b6377}'
    // THE BAND IS FILLED, NOT SHORTENED. The examples box sat against the right edge and left a wide strip
    // of empty dark beside it, between the rule at the top of the foot and the bar. Making the box one line
    // shorter closed the strip and ALSO made the foot shorter, and the page's own checks refused that at
    // once: the shell measures its foot to decide how big the disc is, where the work card sits and where
    // every gathered dot lands, and three checks that had passed all night failed. So the box keeps its
    // height to the pixel and is widened to the whole line instead: the strip is the box now.
    + '#eg{margin:0 0 6px;width:auto;max-width:none;background:#0e121b;border:1px solid #1b2030;'
    + 'border-radius:8px;padding:.45rem .7rem;display:flex;flex-direction:column;gap:4px}'
    + '#eg select{align-self:flex-end;width:min(30rem,70vw)}'
    + '#eg label{font:11px ui-monospace,Menlo,Consolas,monospace;letter-spacing:.08em;text-transform:uppercase;color:#8b93a7}'
    + '#eg select{font:12px ui-monospace,Menlo,Consolas,monospace;background:#11151f;color:#cfe3f2;border:1px solid #1b2030;border-radius:6px;padding:.45rem .7rem;max-width:44vw}'
    + '#presets{position:fixed;left:12px;top:12px;z-index:19;display:flex;gap:6px;flex-wrap:wrap;max-width:min(62vw,calc(100% - 24px))}'
    + '#presets button{font:11px/1.6 ui-monospace,Menlo,Consolas,monospace;color:#8b93a7;background:#0b0e14;border:1px solid #232a3a;'
    + 'border-radius:4px;padding:2px 9px;cursor:pointer}'
    + '#presets button:hover,#presets button:focus-visible{color:#e6e9f0;border-color:#4a5573;outline:none}'
    + '#say{position:fixed;left:50%;top:20px;transform:translateX(-50%);width:min(72ch,84vw);'
    + 'max-height:calc(100vh - var(--footh) - 56px);min-width:280px;min-height:64px;background:#0e121bf2;'
    + 'border:1px solid #1b2030;border-radius:8px;padding:0;font:14px/1.5 ui-monospace,Menlo,Consolas,monospace;color:#cfe3f2;'
    + 'z-index:21;resize:both;overflow:hidden;display:none;flex-direction:column}'
    + '#say.open{display:flex}'
    + '#say.max{left:12px;top:12px;right:12px;bottom:calc(var(--footh) + 12px);transform:none;width:auto;max-height:none;height:auto}'
    + '#say.min{height:auto!important;max-height:none;resize:none;width:min(48ch,84vw)} #say.min #saybody{display:none}'
    + '#saybar{display:flex;align-items:center;gap:6px;padding:4px 8px;border-bottom:1px solid #1b2030;background:#11151f;'
    + 'cursor:move;user-select:none;font-size:11px;color:#8b93a7;letter-spacing:.06em;text-transform:uppercase}'
    + '#saybar span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '#saybar button{font:12px ui-monospace,Menlo,Consolas,monospace;background:#0e121b;color:#cfe3f2;border:1px solid #1b2030;'
    + 'border-radius:4px;width:24px;height:22px;cursor:pointer;padding:0}'
    + '#saybar button:hover,#saybar button:focus-visible{border-color:#5ec8f2;outline:none}'
    + '#saybody{padding:.8rem 1.1rem;overflow:auto;flex:1}'
    + '#saybody b{color:#5ec8f2;font-weight:600}#saybody i{color:#f2b05e;font-style:normal}'
    + '#saybody p{margin:.45rem 0}#saybody .dimtext{color:#8b93a7;font-size:12px;line-height:1.45}'
    + '#saybody table{border-collapse:collapse;width:100%;margin:.5rem 0}'
    + '#saybody td{padding:2px 0;border-bottom:1px solid #1b2030;font-size:12.5px}#saybody td+td{text-align:right;color:#fff}'
    + '#saybody code{display:block;background:#11151f;border:1px solid #1b2030;border-radius:4px;padding:4px 7px;color:#cfe3f2;'
    + 'margin:6px 0;font-size:11.5px;word-break:break-all}'
    + '#saybody .more,#saybody .edit{background:none;border:0;color:#8b93a7;font:inherit;font-size:11.5px;text-decoration:underline;cursor:pointer;padding:4px 0}'
    + '#saybody .more:hover,#saybody .edit:hover{color:#5ec8f2}'
    + '#saybody #apps{display:flex;flex-wrap:wrap;gap:6px;margin:.4rem 0 .2rem}'
    + '#saybody .viewrow{display:flex;flex-wrap:wrap;gap:6px;margin:.4rem 0 .2rem}'
    + '#saybody .viewrow button{font:11px/1.6 ui-monospace,Menlo,Consolas,monospace;color:#8b93a7;background:#0b0e14;'
    + 'border:1px solid #232a3a;border-radius:4px;padding:3px 9px;cursor:pointer}'
    + '#saybody .boxes{display:grid;grid-template-columns:1fr 1fr;gap:3px 12px;margin:.5rem 0 .2rem;'
    + 'border-top:1px solid #1b2030;padding-top:.5rem}'
    + '#saybody .boxrow{display:flex;align-items:center;gap:6px;min-width:0}'
    + '#saybody .boxlab{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'
    + 'font:11px ui-monospace,Menlo,Consolas,monospace;color:#8b93a7}'
    + '#saybody .boxrow input,#saybody .boxrow select{width:5.4rem;flex:none;font:11.5px ui-monospace,Menlo,Consolas,monospace;'
    + 'background:#11151f;color:#cfe3f2;border:1px solid #1b2030;border-radius:4px;padding:2px 5px}'
    + '#saybody .boxrow input:focus,#saybody .boxrow select:focus{outline:1px solid #5ec8f2;border-color:#5ec8f2}'
    + '#saybody .boxrow input.bad{border-color:#ffb454;color:#ffb454}'
    + '#saybody .boxes button.edit{grid-column:1/-1;text-align:left}'
    // THE BOTTOM OF THE SCREEN IS A STACK, NOT A PILE - the wafer's own rule, and the Kuiper's card has to
    // obey it too. On a phone the shell puts its work card at the very bottom, where the bar and the
    // examples picker now are, and the page's own card checks caught it: four of them read the card as
    // off the screen. The card is lifted to the top of the measured stack instead.
    + '@media (max-width:700px){#pilot input{font-size:16px;min-height:44px}'

    + '#eg{padding:.35rem .6rem}#eg label{font-size:10px}#eg select{align-self:stretch;width:auto;max-width:none;min-height:40px}'
    + '#presets{max-width:calc(100% - 24px)}#presets button{min-height:32px;padding:4px 9px}'
    + '#say{left:8px;right:8px;transform:none;width:auto;max-height:52vh}'
    + '#saybody .boxes{grid-template-columns:1fr}#saybody .boxrow input,#saybody .boxrow select{min-height:34px;font-size:16px;width:6.5rem}'
    + '#saybar button{width:32px;height:30px}}';
  document.head.append(st);

  // ---- the window ------------------------------------------------------------------------------
  const sayEl = document.createElement('div'); sayEl.id = 'say';
  sayEl.setAttribute('role', 'dialog'); sayEl.setAttribute('aria-label', 'the answer');
  sayEl.innerHTML = '<div id="saybar"><span id="saytitle">card</span>'
    + '<button id="saymin" type="button" title="minimise" aria-label="minimise">–</button>'
    + '<button id="saymax" type="button" title="maximise" aria-label="maximise">▢</button>'
    + '<button id="sayclose" type="button" title="close" aria-label="close">×</button></div>'
    + '<div id="saybody"></div>';
  document.body.append(sayEl);
  const $ = id => document.getElementById(id);
  const sayBody = $('saybody');
  // ONLY A FIRED ANSWER IS MOVED OUT OF THE WAY. The applications and the help are not about the drawing,
  // nothing is behind them, and the window they open in is the wafer's own, in the middle at the top.
  const showSay = (title, nodes, beside) => { $('saytitle').textContent = title;
    sayBody.replaceChildren(...nodes); sayEl.classList.remove('min'); sayEl.classList.add('open');
    if (beside) placeSay(); else { sayEl.style.left = ''; sayEl.style.top = ''; sayEl.style.width = '';
      sayEl.style.maxHeight = ''; sayEl.style.transform = ''; } };
  const shutSay = () => sayEl.classList.remove('open', 'max', 'min');
  // WHERE A FIRED ANSWER OPENS. It used to open in the middle of the top of the page, which is where the
  // drawing is: the grid symbol and the word GRID were behind it, and on a wide screen it lay over the
  // preset chips as well. An answer nobody can read beside the thing it is about is not an answer.
  //
  // The picture is a disc in the middle, so on a wide screen there is a band of empty dark down each side:
  // the window is put in the wider of the two, narrowed to fit it, under the chips on the left and at the
  // top on the right. On a phone there is no band, so it opens as its title bar alone, above the picture,
  // and one tap on that bar opens it. If the visitor has dragged the window anywhere, it is left exactly
  // where they put it, this firing and every firing after it.
  let sayMoved = false;
  const discBox = () => {
    if (typeof SPACE === 'undefined' || !SPACE || typeof zoom === 'undefined') return null;
    if (typeof body !== 'undefined' && body && body.sld && body.shown && body.pos) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let j = 0; j < body.n; j++) {
        const x = (body.pos[2*j] - cx) * zoom + innerWidth / 2, y = innerHeight / 2 - (body.pos[2*j+1] - cy) * zoom;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (isFinite(x0)) return { x0, y0, x1, y1 };
    }
    const R = Math.sqrt(SPACE) * zoom, mx = (0 - cx) * zoom + innerWidth / 2, my = innerHeight / 2 + cy * zoom;
    return { x0:mx - R, y0:my - R, x1:mx + R, y1:my + R };
  };
  const placeSay = () => {
    if (sayMoved || !sayEl.classList.contains('open') || sayEl.classList.contains('max')) return;
    const b = discBox(); if (!b) return;
    const foot = document.getElementById('foot');
    const footH = foot ? foot.getBoundingClientRect().height : 0;
    const chips = document.getElementById('presets');
    const chipsBottom = chips ? chips.getBoundingClientRect().bottom : 12;
    const gap = 12, left = Math.max(0, b.x0 - gap), right = Math.max(0, innerWidth - b.x1 - gap);
    const roomy = Math.max(left, right) - 2 * gap;
    if (innerWidth > 700 && roomy >= 280) {
      const w = Math.min(560, roomy);
      const onLeft = left >= right;
      const top = Math.round(onLeft ? chipsBottom + 10 : 12);
      sayEl.classList.remove('min');
      sayEl.style.transform = 'none';
      sayEl.style.left = Math.round(onLeft ? gap : innerWidth - w - gap) + 'px';
      sayEl.style.top = top + 'px';
      sayEl.style.width = Math.round(w) + 'px';
      sayEl.style.maxHeight = Math.max(120, Math.round(innerHeight - top - footH - 16)) + 'px';
    } else if (innerWidth > 700) {
      // A DRAWING THAT FILLS THE WIDTH leaves no band, and an answer nobody can read is no answer: on a
      // screen with room the window goes to the top right at its own width instead of shutting itself.
      sayEl.classList.remove('min');
      const w = Math.min(460, Math.max(300, innerWidth * 0.34));
      sayEl.style.transform = 'none';
      sayEl.style.left = Math.round(innerWidth - w - gap) + 'px';
      sayEl.style.top = '12px';
      sayEl.style.width = Math.round(w) + 'px';
      sayEl.style.maxHeight = Math.max(120, Math.round(innerHeight - 12 - footH - 16)) + 'px';
    } else {
      // no band to put it in: the title bar alone, above the picture, and a tap opens it
      sayEl.classList.add('min');
      sayEl.style.transform = 'none';
      sayEl.style.left = '8px';
      sayEl.style.top = Math.round(Math.max(8, Math.min(chipsBottom + 8, Math.max(8, b.y0 - 42)))) + 'px';
      sayEl.style.width = Math.round(innerWidth - 16) + 'px';
      sayEl.style.maxHeight = '';
    }
  };
  // THE DRAWING IS REPAINTED WHENEVER THIS WINDOW MOVES, OPENS, GROWS OR CLOSES. The layer under it is
  // clipped to what the window is NOT covering, so a clip one frame late is a picture showing through
  // the window: on a telephone, where the window opens over the row, that is exactly what happened.
  try { const kick = () => { if (typeof dirty !== 'undefined') dirty = true; };
    new ResizeObserver(kick).observe(sayEl);
    new MutationObserver(kick).observe(sayEl, { attributes:true, attributeFilter:['class', 'style'] }); } catch (_) {}
  sayOpen = showSay;
  $('saymin').onclick = e => { e.stopPropagation(); sayEl.classList.toggle('min'); };
  $('saymax').onclick = e => { e.stopPropagation(); sayEl.classList.remove('min'); sayEl.classList.toggle('max'); };
  $('sayclose').onclick = e => { e.stopPropagation(); shutSay(); };
  $('saybar').ondblclick = () => sayEl.classList.toggle('min');
  $('saytitle').addEventListener('click', e => { e.stopPropagation(); sayEl.classList.toggle('min'); });
  (() => { let d = null; const bar = $('saybar');
    bar.addEventListener('pointerdown', e => { if (e.target.tagName === 'BUTTON' || sayEl.classList.contains('max')) return;
      const r = sayEl.getBoundingClientRect(); d = { x:e.clientX - r.left, y:e.clientY - r.top };
      sayEl.style.transform = 'none'; sayEl.style.left = r.left + 'px'; sayEl.style.top = r.top + 'px';
      try { bar.setPointerCapture(e.pointerId); } catch (_) {} });
    bar.addEventListener('pointermove', e => { if (!d) return; sayMoved = true;
      sayEl.style.left = Math.max(0, Math.min(innerWidth - 60, e.clientX - d.x)) + 'px';
      sayEl.style.top = Math.max(0, Math.min(innerHeight - 40, e.clientY - d.y)) + 'px'; });
    // THE WINDOW LETS GO. The wafer's own bar releases on pointerup; it is released on cancel and on a
    // lost capture too, because a window that keeps the mouse is the fault this night began with.
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) bar.addEventListener(ev, () => { d = null; });
  })();

  // ---- the chips, the picker and the bar -------------------------------------------------------
  const chips = document.createElement('nav'); chips.id = 'presets'; chips.setAttribute('aria-label', 'presets');
  const eg = document.createElement('div'); eg.id = 'eg';
  const egLabel = document.createElement('label'); egLabel.htmlFor = 'egs';
  egLabel.textContent = 'examples: pick one, it fires';
  const egs = document.createElement('select'); egs.id = 'egs'; egs.setAttribute('aria-label', 'choose an example sentence');
  eg.append(egLabel, egs);
  const pilot = document.createElement('div'); pilot.id = 'pilot';
  const pin = document.createElement('input'); pin.id = 'pin'; pin.type = 'text'; pin.autocomplete = 'off'; pin.spellcheck = false;
  pin.placeholder = 'type a sentence or a command: tree of 12 · on its export limit · the most solar that fits · apps · help';
  pin.setAttribute('aria-label', 'type a sentence or a command');
  pilot.append(pin);
  const foot = document.getElementById('foot');
  document.body.append(chips);
  if (foot) { foot.prepend(eg); foot.append(pilot); } else document.body.append(eg, pilot);

  // the applications and the four view commands keep their own elements; they are not on the face,
  // they are what the window shows when it is asked for them
  const appsEl = document.getElementById('apps');
  const holder = document.createElement('div'); holder.style.display = 'none'; document.body.append(holder);
  if (appsEl) holder.append(appsEl);
  const viewRow = document.createElement('div'); viewRow.className = 'viewrow';
  for (const [k, words] of [['n', 'new code'], ['r', 'random line'], ['/', 'find'], ['Backspace', 'whole view']]) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = words; b.setAttribute('data-k', k);
    b.addEventListener('click', () => { shutSay(); dispatchEvent(new KeyboardEvent('keydown', { key:k })); });
    viewRow.append(b);
  }
  holder.append(viewRow);

  // THE STACK IS MEASURED, NOT GUESSED, exactly as the wafer measures it, so the picker never sits on
  // the bar and the window never sits on the picker.
  const setStack = () => { const r = document.documentElement.style;
    r.setProperty('--footh', Math.ceil((foot ? foot.getBoundingClientRect().height : 0)) + 'px');
    if (typeof layout === 'function') layout(); };
  setStack();
  try { if (foot) new ResizeObserver(setStack).observe(foot); } catch (_) {}
  addEventListener('resize', () => { setStack(); placeSay(); });
  addEventListener('orientationchange', () => { setStack(); placeSay(); });
  window.__placeSay = placeSay;                                   // the drawing lands a second after the answer opens

  // ---- the list itself -------------------------------------------------------------------------
  // WHETHER A COMMAND DRAWS, WITHOUT WAITING FOR THE ENGINE TO BE THERE. The bar is built as soon as this
  // file runs, which can be before window.FIRE exists; asking the engine and giving up on the exception
  // left the chips and the picker empty, and the page's own check caught it. The engine answers when it
  // is there, and the name is read off the command itself when it is not.
  function runsHere(c){
    try { if (window.FIRE && window.FIRE.parse) return FIRE_DRAWS.includes(window.FIRE.parse(c.command).name); } catch (_) {}
    const m = /^fire\s+([a-z][a-z-]*)/i.exec(String((c && c.command) || ''));
    return !!m && FIRE_DRAWS.includes(m[1].toLowerCase());
  }
  let ALL = STRING_TESTS.concat(dedupeCommands(FIRE_FALLBACK.filter(runsHere))), PINS = STRING_TESTS.concat(curateCommands(ALL.slice(STRING_TESTS.length), PICKER_SHOWN));
  let SAID = 'the few tests kept inside this page are listed while the published list is read';

  const fill = list => { egs.replaceChildren(new Option(list.length ? '— choose an example sentence —' : '— nothing matches —', ''));
    for (const c of list) { const o = new Option(plainName(c), c.command); o.title = c.sentence || ''; egs.append(o); } };
  const shownList = () => { const q = pin.value.trim();
    if (!q || /^fire\s+\S/i.test(q)) return PINS.slice(0, PICKER_SHOWN);
    return dedupeCommands(searchCommands(ALL, q)).slice(0, PICKER_SHOWN); };
  const refresh = () => { fill(shownList()); };
  const drawChips = () => { chips.replaceChildren();
    for (const c of PINS.slice(0, CHIPS_SHOWN)) { const b = document.createElement('button'); b.type = 'button';
      b.textContent = chipWords(c); b.title = c.sentence || plainName(c);
      b.addEventListener('click', e => { e.stopPropagation(); runIt(c); }); chips.append(b); }
    const a = document.createElement('button'); a.type = 'button'; a.textContent = 'apps'; a.id = 'chipapps';
    a.addEventListener('click', e => { e.stopPropagation(); openApps(); }); chips.append(a); };

  function findByCommand(cmd){ return ALL.find(c => c.command === cmd) || PINS.find(c => c.command === cmd) || null; }
  // CHOOSING A PRESET FIRES IT, AND THE BAR KEEPS ITS NAME, NOT ITS JSON.
  function runIt(c){ const cmd = typeof c === 'string' ? c : c.command;
    const rec = typeof c === 'string' ? findByCommand(cmd) : c;
    pin.value = rec ? plainName(rec) : '';
    fireCommand(cmd, rec);
  }
  closeFireMenu = () => { egs.selectedIndex = 0; };
  fireAgain = runIt;                                       // a window may ask for its preset back

  function openApps(){
    const wrap = [];
    const h = document.createElement('p'); h.innerHTML = '<b>The applications</b>'; wrap.push(h);
    if (appsEl) wrap.push(appsEl);
    const p2 = document.createElement('p'); p2.innerHTML = '<b>The view</b>'; wrap.push(p2, viewRow);
    const note = document.createElement('p'); note.className = 'dimtext'; note.textContent = SAID; wrap.push(note);
    showSay('apps', wrap);
  }

  loadFireConfig(FIRE_CONFIG).then(r => {
    if (r.ok) {
      const listed = dedupeCommands(r.commands.filter(runsHere));
      if (listed.length) {
        const dropped = r.commands.filter(runsHere).length - listed.length;
        ALL = STRING_TESTS.concat(listed);
        const pinned = listed.filter(c => typeof c.pin === 'number').sort((a, b) => a.pin - b.pin);
        PINS = STRING_TESTS.concat(pinned.length ? pinned : curateCommands(listed, PICKER_SHOWN));
        SAID = listed.length + ' tests, list ' + r.generation + ', fetched with no cache and hashed here'
             + (dropped ? '; ' + dropped + ' repeats of another test left out' : '');
      } else SAID = 'the published list holds nothing this device can run, so the few kept in this page are listed';
    } else SAID = 'the published list was not used (' + r.reason + '), so the few kept in this page are listed';
    drawChips(); refresh();
  }).catch(e => { SAID = 'the published list was not used (' + (e && e.message ? e.message : e) + '), so the few kept in this page are listed';
    drawChips(); refresh(); });
  drawChips(); refresh();

  // KEYS TYPED IN THE BAR STAY IN THE BAR, and a press inside the window never reaches the disc behind
  // it. Escape is not a key they keep: it closes the window and hands the keyboard back.
  const stop = e => {
    if (e.type === 'keydown' && e.key === 'Escape') { e.stopPropagation(); shutSay(); pin.blur(); return; }
    e.stopPropagation();
  };
  for (const x of [pin, eg, chips, sayEl]) for (const ev of ['keydown', 'keyup', 'keypress', 'pointerdown', 'mousedown', 'touchstart', 'wheel', 'click']) x.addEventListener(ev, stop);
  egs.addEventListener('change', e => { const v = e.target.value; if (v) runIt(v); e.target.selectedIndex = 0; });
  pin.addEventListener('input', refresh);
  pin.addEventListener('keydown', e => {
    if (e.key === 'Escape') { shutSay(); pin.blur(); return; }
    if (e.key !== 'Enter') return;
    const q = pin.value.trim(); if (!q) return;
    if (/^fire\s+\S/i.test(q)) { fireCommand(q, findByCommand(q)); return; }
    if (/^apps?$/i.test(q)) { openApps(); return; }
    if (/^help$/i.test(q)) { const p = document.createElement('p');
      p.innerHTML = '<b>How this bar works</b>'; const q2 = document.createElement('p'); q2.className = 'dimtext';
      q2.textContent = 'Type what you want to see in plain words - "tree of 12", "on its export limit", "the most solar that fits" - and press Enter: the first test that matches runs here, on your device, and the dots draw its network. Or pick one from the examples above. Type "apps" for the applications. Every command can be typed in full; press "show the command" in any answer to see and change the one that ran.';
      showSay('help', [p, q2]); return; }
    const first = shownList()[0];
    if (first) runIt(first);
    else { const p = document.createElement('p'); p.innerHTML = '<b>Nothing matches</b>';
      const d = document.createElement('p'); d.className = 'dimtext';
      d.textContent = 'No test in the published list has all of those words in it. Try fewer words, or a shape: chain, star, tree, sub-board.';
      showSay('nothing matches', [p, d]); }
  });
  addEventListener('keydown', e => { if (e.key === 'Escape' && sayEl.classList.contains('open')) { e.preventDefault(); shutSay(); pin.blur(); } });
  if (typeof layout === 'function') layout();
  // ?fire=<command> still runs a command on arrival: every firing is a link
  try { const q = new URLSearchParams(location.search).get('fire'); if (q) setTimeout(() => fireCommand(/^fire\s/i.test(q) ? q : 'fire ' + q), 600); } catch (_) {}
}
// SOMETHING IS ON THE SCREEN AT ONCE. The bar is built as soon as this file runs, not after the whole
// record has arrived, so a visitor on a slow line has the bar and the chips while the megabyte loads.
if (document.readyState === 'loading') addEventListener('DOMContentLoaded', () => { try { makeFireBar(); } catch (e) { console.error('the bar was not built: ' + (e && e.stack ? e.stack : e)); } });
else { try { makeFireBar(); } catch (e) { console.error('the bar was not built: ' + (e && e.stack ? e.stack : e)); } }

let lastFire = null;
const c0 = text => { try { return window.FIRE.parse(text).inputs; } catch (_) { return {}; } };
// THE FIGURES A READER ACTUALLY WANTS, in the order an engineer would read them out. Everything else is
// behind MORE: the card used to be a table of fourteen rows and a paragraph, which is a page, not an answer.
const CARD_FIRST = ['connection point kw', 'lowest volts pu', 'highest volts pu', 'worst transformer pct', 'busiest cable amps',
                    'p poc kw', 'worst tx pct', 'export limit kw'];
// ===== THE INPUTS AS BOXES ======================================================================
// A COMMAND IS A SENTENCE UNTIL SOMEBODY WANTS TO TRY A DIFFERENT NUMBER, and then it has to be a set
// of boxes. Every command declares its own inputs (key, label, unit, kind, min, max, step, choices) and
// the window builds one labelled box for each: a number box with its range and its step, or a small
// list for a choice. Changing a box FIRES THE COMMAND AGAIN at once - a third of a second after the
// last keystroke, or straight away on Enter - and the sentence, the figures and the drawing all move
// together, IN PLACE: the work does not fly home and gather again for a changed decimal.
// A box that is empty or outside its range is refused QUIETLY: the last good value is kept, the box is
// marked, and nothing is thrown. Presets still fill every box and fire; after an edit the bar carries
// the preset's plain name with "(changed)" after it, never the command itself, and one press puts the
// preset back. The command in full stays under "more", and it always says what the boxes now say, so
// it can be copied, shared and pasted back into the bar.
function boxValues(out){
  const v = {};
  for (const b of (out.boxes || [])) {
    let x = (out.inputs_used && out.inputs_used[b.key] !== undefined && out.inputs_used[b.key] !== null)
      ? out.inputs_used[b.key] : (out.inputs ? out.inputs[b.key] : undefined);
    if (x !== undefined && x !== null) v[b.key] = x;
  }
  return v;
}
function makeBoxes(out, rec){
  const el = (tag, cls, t) => { const e = document.createElement(tag); if (cls) e.className = cls; if (t !== undefined) e.textContent = t; return e; };
  const vals = boxValues(out), wrap = el('div', 'boxes');
  let timer = 0;
  const cmd = () => 'fire ' + out.name + ' ' + JSON.stringify(vals);
  const goNow = () => { clearTimeout(timer);
    const bar = document.getElementById('pin');
    if (bar) bar.value = (rec ? plainName(rec) : out.family) + ' (changed)';
    fireCommand(cmd(), rec, true); };
  const later = () => { clearTimeout(timer); timer = setTimeout(goNow, 300); };
  for (const spec of out.boxes) {
    if (vals[spec.key] === undefined) continue;
    const id = 'box-' + out.name + '-' + spec.key;
    const row = el('div', 'boxrow'), lab = el('label', 'boxlab', spec.label + (spec.unit ? ' (' + spec.unit + ')' : ''));
    lab.htmlFor = id;
    let inp;
    if (spec.kind === 'choice') {
      inp = document.createElement('select');
      for (const c of spec.choices) inp.append(new Option(c[1], String(c[0])));
      inp.value = String(vals[spec.key]);
      inp.addEventListener('change', () => { const hit = spec.choices.find(c => String(c[0]) === inp.value);
        if (!hit) return; vals[spec.key] = hit[0]; goNow(); });
    } else {
      inp = document.createElement('input'); inp.type = 'number'; inp.inputMode = 'decimal';
      if (spec.min !== undefined) inp.min = spec.min;
      if (spec.max !== undefined) inp.max = spec.max;
      if (spec.step !== undefined) inp.step = spec.step;
      inp.value = String(vals[spec.key]);
      let good = vals[spec.key];
      const take = () => { const n = Number(inp.value);
        if (String(inp.value).trim() === '' || !isFinite(n)
            || (spec.min !== undefined && n < spec.min) || (spec.max !== undefined && n > spec.max)) {
          inp.classList.add('bad'); return false; }
        inp.classList.remove('bad'); good = n; vals[spec.key] = n; return true; };
      inp.addEventListener('input', () => { if (take()) later(); });
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); if (take()) goNow(); } });
      inp.addEventListener('blur', () => { if (inp.classList.contains('bad')) { inp.value = String(good); inp.classList.remove('bad'); } });
    }
    inp.id = id; row.append(lab, inp); wrap.append(row);
  }
  if (rec) { const back = el('button', 'edit', 'back to the preset'); back.type = 'button';
    back.addEventListener('click', e => { e.stopPropagation(); if (fireAgain) fireAgain(rec); });
    wrap.append(back); }
  return { wrap, vals, cmd };
}
function fireCommand(text, rec, inPlace){
  if (closeFireMenu) { try { closeFireMenu(); } catch (_) {} }
  const F = (typeof window !== 'undefined' && window.FIRE) || null;
  const el = (tag, cls, t) => { const e = document.createElement(tag); if (cls) e.className = cls; if (t !== undefined) e.textContent = t; return e; };
  const bold = t => { const p = document.createElement('p'); const b = document.createElement('b'); b.textContent = t; p.append(b); return p; };
  const open = (title, nodes) => { if (sayOpen) sayOpen(title, nodes, true); };
  let out;
  try { if (!F) throw new Error('the commands did not load'); out = F.fire(text); }
  catch (e) { open('not run', [bold('Not run'), el('p', 'dimtext', String(e.message || e))]);
    lastFire = { ran:false, error:String(e.message || e) }; return lastFire; }
  if (!out.ran) { open('not run', [bold('Not run'),
      el('p', 'dimtext', 'No command called "' + out.name + '" runs here yet. These do: ' + F.names.join(', ') + '.')]);
    lastFire = { ran:false, name:out.name }; return lastFire; }
  const title = rec ? plainName(rec) : out.family;
  const rows = [];
  for (const [k, v] of Object.entries(out.numbers)) { if (v && typeof v === 'object') for (const [k2, v2] of Object.entries(v)) rows.push([k + ' ' + k2, v2]); else rows.push([k, v]); }
  const label = k => k.replace(/_/g, ' ');
  const lead = [], rest = [];
  for (const r of rows) (CARD_FIRST.includes(label(r[0])) ? lead : rest).push(r);
  while (lead.length < 4 && rest.length) lead.push(rest.shift());
  const table = list => { const tb = document.createElement('table');
    for (const [k, v] of list) { const tr = document.createElement('tr');
      tr.append(el('td', null, label(k)), el('td', null, v === null ? 'none' : String(v))); tb.append(tr); }
    return tb; };
  const restBits = () => { const bits = [table(lead.slice(4).concat(rest)), el('p', 'dimtext', 'How: ' + out.how),
      el('p', 'dimtext', 'The command that ran:'), el('code', null, text)];
    const edit = el('button', 'edit', 'put this command in the bar, to change a number and fire it again'); edit.type = 'button';
    edit.addEventListener('click', () => { const b = document.getElementById('pin'); if (b) { b.value = text; b.focus(); } });
    bits.push(edit, el('p', 'dimtext', 'Every input is a public estimate. It runs here and nothing you type leaves this device. An estimate, not a study; provided as is, without warranty of any kind.'));
    return bits; };
  // A CHANGED BOX DOES NOT REBUILD THE WINDOW. What the reader is typing in stays exactly where it is,
  // with the caret still in it; only the sentence, the figures and the working are written again.
  if (inPlace && fireLive && fireLive.name === out.name && fireLive.said && fireLive.said.isConnected) {
    fireLive.said.textContent = out.said;
    fireLive.leadBox.replaceChildren(table(lead.slice(0, 4)));
    if (fireLive.order) fireLive.order.textContent = out.electrical_order ? 'Electrical order: ' + out.electrical_order : '';
    fireLive.hidden.replaceChildren(...restBits());
  } else {
    const nodes = [bold(title), el('p', null, out.said)];
    const saidP = nodes[1];
    const leadBox = el('div'); leadBox.append(table(lead.slice(0, 4))); nodes.push(leadBox);
    const hidden = el('div'); hidden.style.display = 'none'; hidden.append(...restBits());
    const more = el('button', 'more', 'more, and show the command'); more.type = 'button';
    more.addEventListener('click', () => { const on = hidden.style.display === 'none';
      hidden.style.display = on ? 'block' : 'none'; more.textContent = on ? 'less' : 'more, and show the command'; });
    // A ROW OF THIRTY MODULES IS WIDER THAN ANY SCREEN. Two presses: the near end, where the inverter and
    // the first modules can be read, and the whole row, which is every one of the thirty at once.
    if (out.name === 'string') { const row = el('div', 'viewrow');
      for (const [words, go] of [['the near end', () => stringNearView()], ['the whole row', () => stringWholeView()]]) {
        const b = el('button', null, words); b.type = 'button';
        b.addEventListener('click', e => { e.stopPropagation(); try { go(); } catch (_) {} }); row.append(b); }
      nodes.push(row); }
    const orderP = el('p', 'dimtext', out.electrical_order ? 'Electrical order: ' + out.electrical_order : '');
    nodes.push(orderP);
    let boxes = null;
    if (out.boxes && out.boxes.length) { boxes = makeBoxes(out, rec); nodes.push(boxes.wrap); }
    nodes.push(more, hidden);
    open(title, nodes);
    fireLive = { name:out.name, said:saidP, leadBox, hidden, order:orderP, boxes };
  }
  lastFire = { ran:true, name:out.name, family:out.family, numbers:out.numbers };
  try { const fp = FIRE_PROGRAM;
    if (out.name === 'site-pulse' || out.name === 'network' || out.name === 'string') {
      fp.sld = out.name === 'string' ? { kind:'string', g:out.string } : out.name === 'network' ? { kind:'network', net:out.net, solved:out.solved, inputs:c0(text) } : c0(text);
      // THE WORK DOES NOT FLY HOME FOR A CHANGED DECIMAL. The same dots are given the new places at once,
      // the camera is left exactly where the reader put it, and the front runs again over the new drawing.
      // THE ISOLATE HOLDS ITS OWN COPY OF THE PROGRAM, so the new drawing has to be put there too or
      // the dots would be laid out along the drawing before the change.
      if (iso && iso.prog) iso.prog.sld = fp.sld;
      const live = inPlace && iso && body && body.sld && sldNow && !bodyAnim && ASM;
      let moved = false;
      if (live) { const nb = makeSldBody(iso);
        if (nb) { body = nb; body.shown = true; body.k = 0; body.gap = body.states[0].gap;
          body.pos.set(body.states[0].to); bodyTo(body.pos); bodyAnim = null;
          sldNow.t0 = 0; sldNow.placed = true; if (sldShapes) sldShapes.opened = true;
          sldStart(); dirty = true; moved = true; } }
      if (!moved) { if (typeof unisolate === 'function' && iso) unisolate(true);
        programs.push(fp); try { isolate('fire'); } finally { const at = programs.indexOf(fp); if (at >= 0) programs.splice(at, 1); } } }
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
  const P = net.kind === 'string' ? stringPieces(net.g) : net.kind === 'network' ? netPieces(net.net) : sldPieces(net), total = P.reduce((t, p) => t + p.len, 0), s = total / m;
  // A SYMBOL IS NOT A LENGTH. Dots were handed out in proportion to how long each piece is, so a cable
  // hundreds of units long took hundreds of dots and the generator - one short stub and a circle two
  // hundredths of the drawing across - got the floor of five, which is a faint pentagon nobody can find.
  // The Supervisor looked at a tree of twelve with its generator RUNNING and could not see a generator.
  // The pieces that are SYMBOLS (the grid, the generator, the solar) are given enough dots to read as the
  // thing they are; the long cables give them up, which costs a cable nothing.
  const SYMBOL = t => t === 'grid' || t === 'gen' || t === 'inv' || t.startsWith('pv');
  let counts = P.map(p => Math.max(SYMBOL(p.tag) ? (p.kind === 'ring' ? 16 : 6) : (p.kind === 'ring' ? 5 : 2), Math.round(p.len / s)));
  let diff = m - counts.reduce((a, b) => a + b, 0);
  const order = P.map((p, i) => i).sort((a, b) => P[b].len - P[a].len);          // the rounding is taken up by the longest pieces
  for (let q = 0; diff !== 0 && q < 10 * m; q++) { const i = order[q % order.length]; if (diff > 0) { counts[i]++; diff--; }
    else if (counts[i] > (SYMBOL(P[i].tag) ? (P[i].kind === 'ring' ? 16 : 6) : 3)) { counts[i]--; diff++; } }
  const unit = new Float32Array(2 * m), tag = new Array(m), dist = new Float32Array(m); let j = 0, dMax = 0;
  P.forEach((p, i) => { for (let q = 0; q < counts[i] && j < m; q++, j++) { const u = (q + 0.5) / counts[i];
    // A PIECE THAT CARRIES ITS OWN PLACE ALONG THE ELECTRICAL PATH keeps it: a wiring drawing numbers its
    // pieces 0 at the - end and 1 at the +, and adding the piece's own length to that would mean nothing.
    // A CURVE IS NOT A CHORD. A piece that carries a whole path puts its dots ON that path, so a dot of
    // a cable that bends is never left sitting off the line it belongs to.
    if (p.kind === 'path') { const q = polyAt(p.pts, p.cum, p.len, u); unit[2*j] = q[0]; unit[2*j+1] = q[1]; dist[j] = p.flat ? p.d : p.d + p.len * u; }
    else if (p.kind === 'line') { unit[2*j] = p.x0 + (p.x1 - p.x0) * u; unit[2*j+1] = p.y0 + (p.y1 - p.y0) * u; dist[j] = p.flat ? p.d : p.d + p.len * u; }
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
  const net = (st.prog.sld && (st.prog.sld.kind === 'network' || st.prog.sld.kind === 'string')) ? st.prog.sld : sldNetwork(st.prog.sld || {}); if (!net) return null;
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
  // A ROW OF THIRTY MODULES IS NOT A DISC AND IS NOT SQUEEZED INTO ONE. A wiring drawing is laid out in
  // its own units, as tall as the disc and as wide as it needs to be, and the reader drags along it; a
  // network, which really is a picture, is still fitted to the disc as it always was.
  if (net.kind !== 'string') {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
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
  sldNow = { net, lay, final:net.kind === 'string' ? stringFinal(net, lay.tag) : net.kind === 'network' ? netFinal(net, lay.tag) : sldFinal(net, lay.tag), t0:0, vals:new Float32Array(SLD_MAX) };
  // THE SOLID DRAWING COMES FROM THE SAME DESCRIPTION THE DOTS CAME FROM, so the two can never disagree.
  shapeLayer(); sldShapes = net.kind === 'string' ? (net.g.__draw || stringDrawing(net.g)) : null;
  if (sldShapes) { sldShapes.front = -1; sldShapes.t0 = 0; shapeHover = null; }
  nameLayer();
  sldNames = makeSldNames(lay, net);
  if (net.kind !== 'string') { const amber = addAmberName(lay, sldNow.final); if (amber) sldNames.push(amber); }
  return { n:m, from, pos:new Float32Array(from), states:[{ shape:'sld', to, gap, frac, hold:0, unresolved:false }], k:-1, gap:0, shown:false, sld:true, fineDots:net.kind === 'string', sldGap:lay.spacing * R * frac };
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
      + '#sldnames span.note{color:#7f8899;font-size:10px;letter-spacing:.04em}'
      + '#sldnames span.said{color:#eaf6ff;font-size:11.5px;background:#0b0f16e8;border:1px solid #2a3444;'
      + 'border-radius:4px;padding:3px 8px;letter-spacing:.03em}'
      + '@media (max-width:700px){#sldnames span{font-size:9.5px}#sldnames span.note{font-size:9px}}';
    document.head.append(st); document.body.append(el); }
  return el;
}
const AMBER_WORDS = { bus:'volts outside the band', poc:'over the export limit', grid:'', board:'' };
function amberName(tag){
  if (!tag) return '';
  if (AMBER_WORDS[tag] !== undefined) return AMBER_WORDS[tag];
  // A SERIES STRING WITH ONE LINK THAT DOES NOT MEET IS NOT "AMBER THERE". It carries no current at all.
  if (tag.startsWith('short')) return 'open here, and live: no current, full open circuit voltage across the break';
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
  // A WIRING DRAWING CARRIES ITS OWN WORDS, and they were written when it was described: the inverter,
  // the two free ends, what a sequential string lays extra, and the one note about red and black. Red
  // and black here are how the drawing is READ; in the field both conductors are black cable and only
  // the polarity marking tells them apart.
  if (net.kind === 'string') { const d = net.g.__draw || stringDrawing(net.g);
    const out = d.words.map(w => ({ x:w.x, y:w.y, dy:0, dx:0, text:w.text, warn:!!w.warnLine, note:!!w.note }));
    // A SERIES STRING WITH ONE LINK THAT DOES NOT MEET IS DEAD ALL THE WAY ROUND, and that is said once,
    // under the drawing, not thirty times along it.
    return out; }
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
  // WHAT A TAP OR A HOVER HAS FOUND is one more word, and it comes and goes, so the list is rebuilt
  // whenever its length changes and no sooner.
  const said = sldShapes && shapeHover ? sldShapes.saying : null;
  const list = said ? sldNames.concat([{ x:0, y:0, text:said, hover:true }]) : sldNames;
  if (el.childElementCount !== list.length || el.dataset.said !== String(said)) {
    el.dataset.said = String(said);
    el.replaceChildren(...list.map(n => { const sp = document.createElement('span');
      sp.textContent = n.text; if (n.warn) sp.className = 'warn'; else if (n.note) sp.className = 'note';
      else if (n.hover) sp.className = 'said'; return sp; }));
  }
  list.forEach((n, i) => { const sp = el.children[i]; if (!sp) return;
    if (n.hover) { sp.style.left = Math.round(innerWidth / 2) + 'px';
      sp.style.top = Math.round(Math.min(innerHeight - 120, innerHeight * 0.80)) + 'px'; return; }
    const wx = (n.x + (n.dx || 0)) * R * frac, wy = (n.y + (n.dy || 0)) * R * frac;
    const px0 = Math.round((wx - cx) * zoom + innerWidth / 2), py0 = Math.round(innerHeight / 2 - (wy - cy) * zoom);
    // A WORD OFF THE SCREEN IS NOT LAID OUT. Thirty modules is several screens wide and the browser
    // should not be asked to place what nobody can see; and text is put on whole pixels so it is crisp.
    const bd = (sldShapes && sldShapes.kind === 'string') ? shapeBand() : { left:-260, right:innerWidth + 260, top:-60, bottom:innerHeight + 60 };
    if (px0 < bd.left - 6 || px0 > bd.right + 6 || py0 < bd.top - 4 || py0 > bd.bottom + 4) { sp.style.visibility = 'hidden'; return; }
    sp.style.visibility = ''; sp.style.left = px0 + 'px'; sp.style.top = py0 + 'px';
    // A WORD IS NOT ALLOWED UNDER THE WINDOW EITHER, wherever the reader has put it.
    const w2 = sayRect();
    if (w2) { const b2 = sp.getBoundingClientRect();
      if (b2.width > 0 && b2.right > w2.left && b2.left < w2.right && b2.bottom > w2.top && b2.top < w2.bottom) sp.style.visibility = 'hidden'; } });
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
  const t = S.t0 ? (now - S.t0) / 1000 : -1;
  // A WIRING DRAWING HAS ITS OWN TIMING: the dots settle, and then, ONLY IF THE LOOP IS CLOSED, one
  // wavefront leaves the modules and runs out along both conductors to the inverter. Behind it the
  // pencil line fuses solid and the dots under it MELT AWAY, because the line is the drawing now.
  // An open string never starts: no current anywhere, so nothing to run.
  if (S.net.kind === 'string' && sldShapes) {
    const T2 = 1.3, live = !sldShapes.open;
    const f = (t < 0 || !live) ? -1 : Math.min(1, t / T2);
    sldShapes.front = f;
    for (let j = 0; j < m; j++) { const o = S.lay.dist[j], base = S.final[j];
      if (t < 0) { S.vals[j] = 0.55; continue; }
      if (f < 0) { S.vals[j] = base; continue; }
      const reach = Math.abs(o - 0.5) <= f * 0.5 + 1e-6;                        // the front, measured the same way the line is
      const atFront = Math.abs(Math.abs(o - 0.5) - f * 0.5) < 0.035;
      S.vals[j] = atFront ? 1.25 : (reach ? 0.10 : base); }
    sldUniforms(); placeSldNames();
    if (arrived && !S.placed) { S.placed = true; try { if (window.__placeSay) window.__placeSay(); } catch (_) {}
      try { stringOpenView(); } catch (_) {} }
    dirty = true;
    if (t < T2 + 0.4) sldLoop = requestAnimationFrame(sldTick);
    return;
  }
  const T = 1.5, D = S.lay.dMax, w = D * 0.06;
  for (let j = 0; j < m; j++) { const d = S.lay.dist[j], f = S.final[j]; let v;
    if (t < 0) v = 0.55;                                                              // in flight: every dot alike
    else if (t < T) { const front = D * (1 - t / T); v = Math.abs(d - front) < w ? 1.25 : (d > front ? 0.5 : 0.22); }      // PULSE ONE: back toward the grid
    else if (t < 2 * T) { const front = D * (t / T - 1); v = Math.abs(d - front) < w ? 1.25 : (d < front ? f : 0.22); }     // PULSE TWO: out from the grid, leaving the answer
    else v = f;
    S.vals[j] = v; }
  sldUniforms(); placeSldNames();
  if (arrived && !S.placed) { S.placed = true; try { if (window.__placeSay) window.__placeSay(); } catch (_) {} }
  dirty = true;
  if (t < 2 * T + 0.2) sldLoop = requestAnimationFrame(sldTick);
}
// WHERE THE VIEW OPENS. A thirty module row is several screens wide, so the reader is put at the NEAR
// END, with the inverter and the first few modules big enough to read on a phone, and drags along the
// row for the rest. The whole row is one press away.
function stringViewSpanM(){ return Math.max(9.5, Math.min(17, innerWidth / 40)); }
// THE BAND THE DRAWING LIVES IN. The answer window must never cover a shape or a word, so the free part
// of the screen is measured - what the foot takes, what the chips take, and where the window is docked -
// the row is laid out INTO that band, and the drawing layer is CLIPPED to it. A row several screens long
// would otherwise run on under the window, and a drawing nobody can read is not a drawing.
function sayRect(){ const el = document.getElementById('say');
  if (!el || !el.classList.contains('open')) return null;
  const r = el.getBoundingClientRect();
  return (r.width > 8 && r.height > 8) ? r : null; }
function shapeBand(){
  let left = 14, right = innerWidth - 14, top = 14, bottom = innerHeight - 14;
  const foot = document.getElementById('foot');
  if (foot) { const r = foot.getBoundingClientRect(); if (r.height > 2) bottom = Math.min(bottom, r.top - 10); }
  { const r = sayRect();
    if (r) { if (r.width > innerWidth * 0.7) top = Math.max(top, r.bottom + 10);     // across the top: go under it
      else if (r.left > innerWidth * 0.5) right = Math.min(right, r.left - 12);      // docked to the right
      else left = Math.max(left, r.right + 12); } }
  const chips = document.getElementById('presets');
  if (chips) { const c = chips.getBoundingClientRect(); if (c.height > 2 && c.left < right) top = Math.max(top, c.bottom + 10); }
  if (right - left < 220) { left = 14; right = innerWidth - 14; }
  if (bottom - top < 150) { top = 14; bottom = innerHeight - 14; }
  return { left, right, top, bottom };
}
function stringPlaceView(spanM, whole){
  const D = sldShapes; if (!D || typeof flyTo !== 'function') return;
  const R = Math.sqrt(SPACE), f = BODY_RADIUS_MAX, b = shapeBand();
  if (whole) { const bb = D.bounds, w = Math.max(1e-6, bb.x1 - bb.x0), h = Math.max(1e-6, bb.y1 - bb.y0);
    const z = Math.max(1e-9, Math.min((b.right - b.left) * 0.98 / (w * R * f), (b.bottom - b.top) * 0.92 / (h * R * f)));
    flyTo((bb.x0 + bb.x1) / 2 * R * f - ((b.left + b.right) / 2 - innerWidth / 2) / z,
          (bb.y0 + bb.y1) / 2 * R * f + ((b.top + b.bottom) / 2 - innerHeight / 2) / z, z); return; }
  const span = spanM * D.perM, z = Math.max(1e-9, (b.right - b.left) * 0.98 / (span * R * f));
  flyTo(D.near.x * R * f - (b.left + 6 - innerWidth / 2) / z,
        D.near.y * R * f + ((b.top + b.bottom) / 2 - innerHeight / 2) / z, z);
}
function stringOpenView(){ const D = sldShapes; if (!D || D.opened) return; D.opened = true; stringPlaceView(stringViewSpanM(), false); }
function stringWholeView(){ stringPlaceView(0, true); }
function stringNearView(){ const D = sldShapes; if (!D) return; D.opened = false; stringOpenView(); }
function sldStart(){ if (!sldLoop) sldLoop = requestAnimationFrame(sldTick); }

// ===== SOLID SHAPES: THE WAY THIS PAGE DRAWS A WIRING DIAGRAM ===================================
// WHY THERE ARE TWO WAYS OF DRAWING AND NOT ONE. Dots are right for the MACRO view: a population of
// work, a whole estate, a field of addresses. They are wrong for a drawing somebody has to READ. At
// module level a cable made of dots is a smear, and no reader can tell which box joins which. So a
// diagram is described ONCE, as SHAPES, and the shapes are drawn as fine vector lines on one layer
// that follows the camera exactly. Vectors stay sharp at any zoom and on any screen.
//
// A SHAPE IS DATA, NOT A DRAWING INSTRUCTION:
//   { role, node, order, pot, volts, earth_v, pts, closed, fill, weight, dash, gap, says }
//   role     what it is: inverter, terminal, module, cells, box, lead, cable, loop, mark
//   node     the conductor or electrical node it belongs to, so a tap can light one whole link
//   order    its place along the electrical path, 0 at the - end of the string, 1 at the + end
//   pot      the potential at that point, 0 at the - end and 1 at the + end, one module's volts a module
//   volts    that potential in volts above the - end
//   earth_v  the same point's volts TO EARTH. A floating array on a transformerless inverter sits
//            roughly symmetric about earth, so this is about minus half to plus half of the string
//            voltage end to end. It is carried now, unused, because an earth fault study needs it: the
//            FIRST fault pins one point to earth and re-references every other potential (the far end
//            rises toward the whole string voltage: insulation stress, little current), and a SECOND
//            fault closes a loop through earth that bypasses the modules between and drives their short
//            circuit current round it. Nothing of that is computed here; the model is ready for it.
// The dot pieces are produced from the SAME list, so the dots and the drawing can never disagree.
//
// THREE STATES, AND THE PHYSICS DECIDES WHICH ONE IS SHOWN:
//   DRAWN      the pencil drawing, grey. What was designed, before any question of current.
//   OPEN       a series string with ONE link whose leads do not meet carries NO current ANYWHERE. Not
//              "that link is amber": the whole string is dead. Every gap is drawn as the gap it is,
//              with its shortfall in metres beside it, and nothing fuses.
//   ENERGISED  the loop is closed. A WAVEFRONT starts AT THE MODULES and runs out along both
//              conductors TO THE INVERTER, which is the way the power goes, and behind the front the
//              pencil line FUSES into a solid one. The front is fast because energy arrives as a field,
//              at a large fraction of the speed of light; the electrons themselves drift about a fifth
//              of a millimetre a second at 17 A in 6 mm2, which is why nothing crawls along a wire in
//              this drawing. The fused line's WEIGHT is the current, the same all round a series string
//              because charge is conserved at every node, and it would ADD where two strings meet. Its
//              COLOUR is the POTENTIAL at that point: black at the - end, red at the + end, one
//              module's voltage higher at each module, so only the two home runs are fully - and + .
// CLARITY OVER FANCY. The pencil drawing, the marked boxes, the module names and the followable cables
// are what the picture is for. The fusing, the potential colour and the loop shading are drawn UNDER
// them and never over a label or a box.
const SHAPE_PENCIL = '#94a2b5', SHAPE_FAINT = '#333c49', SHAPE_FILL = '#111823', SHAPE_INK = '#d5e4f0',
      SHAPE_RED = '#ff4b3a', SHAPE_BLACK = '#080b11', SHAPE_EDGE = '#6d7d92', SHAPE_WARN = '#ffb454';
const CABLE_NOTE = 'black cables only with polarity marking in the field';
let sldShapes = null;                                  // the prepared drawing now on the screen
let shapeHover = null;                                 // the link the pointer is over, if any
// ---- the layer -------------------------------------------------------------------------------
function shapeLayer(){
  let el = document.getElementById('sldshapes');
  if (!el) { el = document.createElement('canvas'); el.id = 'sldshapes'; el.setAttribute('aria-hidden', 'true');
    const st = document.createElement('style');
    st.textContent = '#sldshapes{position:fixed;inset:0;z-index:2;pointer-events:none}';
    document.head.append(st);
    const c = document.getElementById('c');
    if (c && c.parentNode) c.parentNode.insertBefore(el, c.nextSibling); else document.body.append(el); }
  return el;
}
// the drawing's own units to the screen, by the same arithmetic the words overlay uses
function shapeScale(){ return Math.sqrt(SPACE) * BODY_RADIUS_MAX * zoom; }
function shapePoint(p){ const R = Math.sqrt(SPACE), f = BODY_RADIUS_MAX;
  return [(p[0] * R * f - cx) * zoom + innerWidth / 2, innerHeight / 2 - (p[1] * R * f - cy) * zoom]; }
function shapesGone(){ sldShapes = null; shapeHover = null;
  const el = document.getElementById('sldshapes'); if (!el) return;
  const ctx = el.getContext && el.getContext('2d');
  if (ctx) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, el.width, el.height); } }
// ---- polyline arithmetic ---------------------------------------------------------------------
function polyLen(pts){ let t = 0; const cum = [0];
  for (let i = 1; i < pts.length; i++) { t += Math.hypot(pts[i][0] - pts[i-1][0], pts[i][1] - pts[i-1][1]); cum.push(t); }
  return { total:t, cum }; }
function polyAt(pts, cum, total, u){ const want = Math.max(0, Math.min(1, u)) * total;
  for (let i = 1; i < pts.length; i++) if (cum[i] >= want || i === pts.length - 1) {
    const seg = (cum[i] - cum[i-1]) || 1, t = Math.min(1, Math.max(0, (want - cum[i-1]) / seg));
    return [pts[i-1][0] + (pts[i][0] - pts[i-1][0]) * t, pts[i-1][1] + (pts[i][1] - pts[i-1][1]) * t, i]; }
  return [pts[0][0], pts[0][1], 1]; }
function polySlice(pts, u0, u1){ const m = polyLen(pts); if (m.total < 1e-12 || u1 <= u0 + 1e-9) return [];
  const a = polyAt(pts, m.cum, m.total, u0), b = polyAt(pts, m.cum, m.total, u1), out = [[a[0], a[1]]];
  for (let i = a[2]; i < b[2]; i++) out.push(pts[i]);
  out.push([b[0], b[1]]); return out; }
function polyThin(pts, n){ const m = polyLen(pts), out = [];               // the same curve, fewer points
  for (let i = 0; i <= n; i++) { const p = polyAt(pts, m.cum, m.total, i / n); out.push([p[0], p[1]]); }
  return out; }
function bez(p0, c0, c1, p1, n){ const out = [];
  for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t, a = u*u*u, b = 3*u*u*t, c = 3*u*t*t, d = t*t*t;
    out.push([a*p0[0] + b*c0[0] + c*c1[0] + d*p1[0], a*p0[1] + b*c0[1] + c*c1[1] + d*p1[1]]); }
  return out; }
// THE POTENTIAL AS A COLOUR: black at the - end of the string, red at the +. Nothing in between is
// either, which is the point: only the two home runs are at a whole polarity.
function potColour(t){ const u = Math.max(0, Math.min(1, t));
  const r = Math.round(10 + 245 * Math.pow(u, 0.75)), g = Math.round(12 + 63 * u * u), b = Math.round(18 + 40 * u * u);
  return 'rgb(' + r + ',' + g + ',' + b + ')'; }
function dimColour(css, k){ const m = /rgb\((\d+),(\d+),(\d+)\)/.exec(css);
  return m ? 'rgb(' + Math.round(m[1] * k) + ',' + Math.round(m[2] * k) + ',' + Math.round(m[3] * k) + ')' : css; }

// ===== ONE STRING, DRAWN AS A WIRING DRAWING ===================================================
// The row as it really stands: every module a rectangle of its true proportions with its cells in
// hairlines, its two junction boxes where they truly are (a split box at mid height on the back,
// box_spacing_m apart, centred on the width), each box MARKED - or + in text and not by colour alone,
// its lead leaving it at the lead's own length and ending in a connector. Where two connectors do not
// meet, the gap between them is the shortfall, drawn as a gap and given in metres.
function stringDrawing(g){
  const c = g.c, N = g.N, pitch = g.pitch;
  const wM = c.width_m, hM = (c.module_height_m === undefined ? 2.384 : +c.module_height_m);
  const cols = Math.max(1, Math.round(c.cell_cols === undefined ? 6 : c.cell_cols));
  const rows = Math.max(2, Math.round(c.cell_rows === undefined ? 22 : c.cell_rows));
  const boxW = 0.22, boxH = 0.15, boxY = hM / 2;
  const vmp = c.module_vmp === undefined ? 38.1 : +c.module_vmp, vString = N * vmp;
  const vOpen = N * (c.module_voc === undefined ? 45.9 : +c.module_voc);
  const shapes = [], marks = [], words = [];
  const chain = 2 * N;                                              // home-, module, link, module ... home+
  let put = o => { shapes.push(o); return o; };
  const put0 = put;
  put = o => { if (o.pot === undefined) o.pot = 0; o.volts = o.pot * vString; o.earth_v = (o.pot - 0.5) * vString;
    if (o.node === undefined) o.node = null; return put0(o); };
  const poly = (role, o, pts, extra) => put(Object.assign({ role, order:o, pot:0, pts, weight:1 }, extra || {}));
  const box = (role, o, x0, y0, x1, y1, extra) => poly(role, o, [[x0,y0],[x1,y0],[x1,y1],[x0,y1],[x0,y0]], extra);

  // ---- the inverter: a filled block with a - terminal and a + terminal, both marked
  const invW = 3.0, standOff = 2.2;
  const invX1 = -standOff, invX0 = invX1 - invW, invY0 = 0.05, invY1 = hM - 0.05;
  const negY = invY1 - (invY1 - invY0) * 0.26, posY = invY0 + (invY1 - invY0) * 0.26;
  box('inverter', 0, invX0, invY0, invX1, invY1, { fill:SHAPE_FILL, node:'inv' });
  for (const [y, sign] of [[negY, '−'], [posY, '+']]) {
    poly('terminal', 0, [[invX1, y], [invX1 + 0.16, y]], { node:'inv' });
    put({ role:'terminal', order:0, pot:sign === '+' ? 1 : 0, node:'inv', pts:[[invX1 + 0.16, y]], dot:0.10 });
    marks.push({ x:invX1 - 0.30, y, text:sign, size:12, colour:sign === '+' ? SHAPE_RED : SHAPE_EDGE, minPx:14 }); }

  // ---- the modules, to true proportion, with their cells and their two boxes
  const turned = k => g.turned(k);
  for (let k = 1; k <= N; k++) {
    const x0 = (k - 1) * pitch, x1 = x0 + wM, o = (2 * g.order.indexOf(k) + 1) / chain, pot = (g.order.indexOf(k) + 1) / N;
    box('module', o, x0, 0, x1, hM, { fill:'#0c1119', node:'M' + k, weight:1 });
    // THE CELLS. This module class is cols x rows half cells with the break across the middle where the
    // two halves meet. They are hairlines and they are dropped entirely when they would turn to mush.
    const cl = [];
    for (let i = 1; i < cols; i++) cl.push([[x0 + wM * i / cols, 0], [x0 + wM * i / cols, hM]]);
    for (let j = 1; j < rows; j++) if (j !== rows / 2) cl.push([[x0, hM * j / rows], [x1, hM * j / rows]]);
    put({ role:'cells', order:o, pot, node:'M' + k, lines:cl, pts:[[x0, 0], [x1, hM]],
          split:[[x0, hM / 2], [x1, hM / 2]] });                       // where the two halves of the module meet
    for (const [bx, sign] of [[g.minus(k), '−'], [g.plus(k), '+']]) {
      box('box', o, bx - boxW / 2, boxY - boxH / 2, bx + boxW / 2, boxY + boxH / 2, { fill:'#060a10', node:'M' + k, weight:1 });
      marks.push({ x:bx, y:boxY - boxH / 2 - 0.16, text:sign, size:11, colour:sign === '+' ? SHAPE_RED : SHAPE_INK, minPx:26, mid:true }); }
    marks.push({ x:(x0 + x1) / 2, y:-0.34, text:'M' + k, size:11, colour:SHAPE_INK, minPx:18, mid:true });
    if (turned(k)) marks.push({ x:(x0 + x1) / 2, y:-0.62, text:'turned end for end', size:9, colour:SHAPE_EDGE, minPx:44, mid:true });
  }

  // ---- the links: a curve from the + box of one module to the - box of the next, made of two leads
  let laneHi = hM, laneLo = 0;
  g.links.forEach((l, i) => {
    const xa = l.x_from, xb = l.x_to, span = Math.abs(xb - xa), dir = l.back ? -1 : 1;
    const lane = (l.back ? 2.30 : 2.05) + span * 0.30 + (i % 3) * 0.26;
    const ctrl = boxY + dir * lane, apex = boxY + dir * 0.75 * lane;
    laneHi = Math.max(laneHi, apex); laneLo = Math.min(laneLo, apex);
    const pts = bez([xa, boxY + dir * boxH / 2], [xa, ctrl], [xb, ctrl], [xb, boxY + dir * boxH / 2], 26);
    const o = (2 * i + 2) / chain, pot = (i + 1) / N;
    const need = Math.max(1e-6, l.need), lp = c.lead_plus_m, lm = c.lead_minus_m;
    const says = 'M' + l.from + '+ to M' + l.to + '−, needs ' + l.need.toFixed(2) + ' m, leads ' + g.pair.toFixed(2) + ' m'
               + (l.reaches ? '' : ', short by ' + (l.need - g.pair).toFixed(2) + ' m');
    const node = 'L' + i;
    if (l.reaches) { const t = Math.min(0.92, Math.max(0.08, lp / Math.max(1e-6, g.pair)));
      poly('lead', o, polySlice(pts, 0, t), { node, pot, plus:true, link:l, says, hit:true });
      poly('lead', o, polySlice(pts, t, 1), { node, pot, plus:false, link:l, says, hit:true });
      const m = polyLen(pts), j = polyAt(pts, m.cum, m.total, t);
      put({ role:'joint', order:o, pot, node, pts:[[j[0], j[1]]], link:l, says }); }
    else { const a = Math.min(0.86, Math.max(0.06, lp / need)), b = Math.min(0.96, Math.max(a + 0.04, 1 - lm / need));
      poly('lead', o, polySlice(pts, 0, a), { node, pot, plus:true, link:l, says, hit:true, open:true });
      poly('lead', o, polySlice(pts, b, 1), { node, pot, plus:false, link:l, says, hit:true, open:true });
      const m = polyLen(pts), p0 = polyAt(pts, m.cum, m.total, a), p1 = polyAt(pts, m.cum, m.total, b);
      put({ role:'gap', order:o, pot, node, pts:[[p0[0], p0[1]], [p1[0], p1[1]]], link:l, says,
            short:l.need - g.pair, volts_across:vOpen, mid:[(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2] }); }
  });

  // ---- the two home runs, above everything and below everything, so they never cross a module
  const first = g.order[0], last = g.order[g.order.length - 1];
  const topLane = laneHi + 0.70, botLane = laneLo - 0.70;
  const xn = g.minus(first), xp = g.plus(last);
  const homeNeg = [[invX1 + 0.16, negY], [invX1 + 0.70, negY], [invX1 + 0.70, topLane], [xn, topLane], [xn, boxY + boxH / 2]];
  poly('cable', 0, homeNeg, { node:'home-', pot:0, plus:false, weight:1.2, says:'the home run to the string’s − end' });
  const homePos = [[invX1 + 0.16, posY], [invX1 + 0.55, posY], [invX1 + 0.55, botLane], [xp, botLane], [xp, boxY - boxH / 2]];
  poly('cable', 1, homePos, { node:'home+', pot:1, plus:true, weight:1.2,
    says:g.leap ? 'the home run from the string’s + end' : 'the far end return: one more cable, the length of the row' });

  // ---- the loop the string encloses: what a nearby stroke couples into
  const loopPts = [[xn, boxY], [xp, boxY], [xp, botLane], [invX1 + 0.55, botLane], [invX1 + 0.70, topLane], [xn, topLane], [xn, boxY]];
  put({ role:'loop', order:0, pot:0, pts:loopPts, closed:true });

  // ---- the words the drawing needs, in the page's own overlay
  words.push({ x:(invX0 + invX1) / 2, y:invY1 + 0.55, text:'INVERTER' });
  words.push({ x:xn, y:topLane + 0.40, text:'FREE − M' + first + '−' });
  words.push({ x:xp, y:botLane - 0.30, text:'FREE + M' + last + '+' });
  if (!g.leap) words.push({ x:g.row / 2, y:botLane - 0.62, text:'additional far end return, about ' + g.row.toFixed(1) + ' m' });
  // THE KEY, ONE LINE UNDER ANOTHER WITH ROOM BETWEEN THEM, so that at whole row zoom they are three
  // readable lines and not one grey smear. The warning, when there is one, goes ABOVE them.
  if (g.short.length) words.push({ x:g.row / 2, y:botLane - 0.75, warnLine:true,
    text:'the circuit is open and BOTH ENDS ARE LIVE: ' + g.short.length + ' links do not reach, so no current flows, but up to '
      + Math.round(vOpen) + ' V stands across a break and that is where an arc starts' });
  words.push({ x:g.row / 2, y:botLane - 1.55, text:CABLE_NOTE, note:true });
  words.push({ x:g.row / 2, y:botLane - 2.25, note:true,
    text:'colour is the potential relative to the \u2212 terminal; the array floats, and either terminal may sit at up to half the array voltage to earth' });
  words.push({ x:g.row / 2, y:botLane - 2.95, note:true,
    text:'the line does not thicken or thin along the string, because a series circuit carries one current; the sweep is the instant the loop closes, not a flow' });

  // ---- everything measured, then put into the page's units with the row laid out LARGE
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  const see = (x, y) => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; };
  for (const s of shapes) { if (s.pts) for (const p of s.pts) see(p[0], p[1]); if (s.lines) for (const l of s.lines) { see(l[0][0], l[0][1]); see(l[1][0], l[1][1]); } }
  for (const m of marks) see(m.x, m.y); for (const w of words) see(w.x, w.y);
  // THE DRAWING IS NOT SQUEEZED INTO THE DISC. It is as tall as the disc and as wide as it needs to be,
  // which for thirty modules is several screens: the view opens on the near end and the reader drags.
  const S = 1.85 / Math.max(0.5, y1 - y0), my = (y0 + y1) / 2, mx = x0;
  const U = (x, y) => [(x - mx) * S - 0.95, (y - my) * S];
  for (const s of shapes) { if (s.pts) s.pts = s.pts.map(p => U(p[0], p[1]));
    if (s.split) s.split = s.split.map(p => U(p[0], p[1]));
    if (s.lines) s.lines = s.lines.map(l => [U(l[0][0], l[0][1]), U(l[1][0], l[1][1])]);
    if (s.mid) s.mid = U(s.mid[0], s.mid[1]); }
  for (const m of marks) { const u = U(m.x, m.y); m.x = u[0]; m.y = u[1]; }
  for (const w of words) { const u = U(w.x, w.y); w.x = u[0]; w.y = u[1]; }
  const open = g.short.length > 0;
  return { kind:'string', shapes, marks, words, perM:S, open, g, volts:vString, volts_open:vOpen, earth_node:'earth',
           bounds:{ x0:U(x0, y0)[0], y0:U(x0, y0)[1], x1:U(x1, y1)[0], y1:U(x1, y1)[1] },
           near:{ x:U(invX0, boxY)[0], y:U(invX0, boxY)[1] }, mPerUnit:1 / S,
           amps:open ? 0 : c.amps, front:-1, t0:0 };
}
// THE DOTS COME FROM THE SAME DRAWING. They are the entrance and nothing else: they fly in from the
// record, settle along the conductors and the frames, and melt away under the line as it fuses. They
// are kept off the cells, the boxes and the words, where they would sit on top of what must be read.
function stringPieces(g){
  const d = g.__draw || (g.__draw = stringDrawing(g)), P = [];
  const line = (tag, o, a, b) => { const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len > 1e-7) P.push({ tag, d:o, flat:true, kind:'line', x0:a[0], y0:a[1], x1:b[0], y1:b[1], len }); };
  const ring = (tag, o, cx0, cy0, r) => P.push({ tag, d:o, flat:true, kind:'ring', cx:cx0, cy:cy0, r, len:2 * Math.PI * r });
  const track = (tag, o, pts) => { if (!pts || pts.length < 2) return; const m = polyLen(pts);
    if (m.total > 1e-7) P.push({ tag, d:o, flat:true, kind:'path', pts, cum:m.cum, len:m.total }); };
  for (const s of d.shapes) {
    if (s.role === 'inverter') { const c0 = [(s.pts[0][0] + s.pts[1][0]) / 2, (s.pts[0][1] + s.pts[2][1]) / 2];
      ring('inv', 0, c0[0], c0[1], Math.abs(s.pts[2][1] - s.pts[0][1]) * 0.32); continue; }
    if (s.role === 'module') { line('mod', s.order, s.pts[0], s.pts[1]); line('mod', s.order, s.pts[2], s.pts[3]); continue; }
    if (s.role === 'lead') { track((s.open ? 'short' : 'lead') + s.node, s.order, s.pts); continue; }
    if (s.role === 'cable') { track(s.node === 'home+' ? 'ret' : 'home', s.order, s.pts); continue; }
  }
  return P;
}
function stringFinal(net, tag){
  return tag.map(t => t === 'inv' ? 0.95 : t === 'home' || t === 'ret' ? 0.9 : t === 'mod' ? 0.30
    : t.indexOf('short') === 0 ? 2 : 0.95);
}
// ---- the renderer -----------------------------------------------------------------------------
// One pass, back to front: the loop shading, then the fused conductors, then the pencil drawing, then
// the boxes and the words. Nothing that is only decoration is ever drawn over something that must be
// read. Everything is in device pixels and every word is put on a whole pixel.
function drawSldShapes(){
  const el = document.getElementById('sldshapes'); if (!el) return;
  const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  const W = Math.max(1, Math.round(innerWidth * dpr)), H = Math.max(1, Math.round(innerHeight * dpr));
  if (el.width !== W || el.height !== H) { el.width = W; el.height = H; }
  const ctx = el.getContext('2d'); if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, innerWidth, innerHeight);
  const D = sldShapes; if (!D) return;
  if (typeof body === 'undefined' || !body || !body.sld || !body.shown || bodyAnim || !sldNow) return;
  // THE BAND, LESS THE WINDOW ITSELF. Laying the row out beside the window is not enough on its own:
  // the row is several screens long, and a reader may open, drag or grow the window over it. So the
  // window's own box is cut OUT of what may be drawn. The picture then ends where the window begins,
  // at any zoom and after any drag, instead of showing faintly through it.
  const band = shapeBand(), win = sayRect();
  ctx.save(); ctx.beginPath(); ctx.rect(band.left, band.top, band.right - band.left, band.bottom - band.top);
  // ONLY THE PART OF THE WINDOW THAT IS INSIDE THE BAND IS CUT OUT. Two rules cross here and the first
  // draft got it wrong: an even-odd path adds a second rectangle that lies OUTSIDE the first instead of
  // taking it away, so a window docked beyond the band quietly opened that strip up and the row painted
  // straight through it. The overlap is taken, a hair larger than the window so the soft edge of the cut
  // falls on the window and not on the picture, and only then subtracted.
  if (win) { const l = Math.max(band.left, win.left - 2), t = Math.max(band.top, win.top - 2),
    r2 = Math.min(band.right, win.right + 2), b2 = Math.min(band.bottom, win.bottom + 2);
    if (r2 > l && b2 > t) ctx.rect(l, t, r2 - l, b2 - t); }
  ctx.clip('evenodd');
  const px = shapeScale();                                     // screen pixels to one drawing unit
  const perM = D.perM * px;                                    // screen pixels to one metre
  const fine = 1.1, hair = 0.7;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const S = p => shapePoint(p);
  const path = pts => { const s = pts.map(S); ctx.beginPath(); ctx.moveTo(s[0][0], s[0][1]);
    for (let i = 1; i < s.length; i++) ctx.lineTo(s[i][0], s[i][1]); return s; };
  const onScreen = pts => { for (const p of pts) { const s = S(p);
    if (s[0] > -60 && s[0] < innerWidth + 60 && s[1] > -60 && s[1] < innerHeight + 60) return true; } return false; };
  const front = D.front;
  // 1. THE LOOP THE STRING ENCLOSES, very faintly. The band between the conductor going out and the
  //    conductor coming back is where the energy actually travels, and it is the same area a nearby
  //    lightning stroke couples into: a long open ribbon for a sequential string, a sliver for leapfrog.
  for (const s of D.shapes) if (s.role === 'loop' && onScreen(s.pts)) {
    path(s.pts); ctx.closePath(); ctx.fillStyle = 'rgba(94,200,242,0.035)'; ctx.fill(); }
  // 2. THE CONDUCTORS. Fused behind the front, pencil ahead of it; a gap is always a gap.
  for (const s of D.shapes) {
    if (s.role !== 'lead' && s.role !== 'cable') continue;
    if (!s.pts.length || !onScreen(s.pts)) continue;
    // THE FRONT LEAVES THE MODULES AND REACHES THE INVERTER LAST, on both conductors at once.
    const fused = front >= 0 && Math.abs((s.order === undefined ? 0.5 : s.order) - 0.5) <= front * 0.5 + 1e-6;
    const lit = shapeHover && shapeHover === s.node;
    const w = fine * (s.weight || 1) * (fused ? 1 + 0.45 * Math.min(1, (D.amps || 0) / 20) : 1);
    // POLARITY IS THE COLOUR, IN BOTH STATES. The minus conductor is a BLACK cable: a dark core with ONE
    // hairline of light round it, because black on a near black sky is otherwise nothing at all, and a
    // pale grey line would be a lie about what is in the trench. The plus conductor is red, and how deep
    // the red is says how far up the string that point sits: only the two home runs are at a whole
    // polarity. CURRENT decides the WEIGHT, not the colour, so a fused line is the same conductor,
    // thicker and brighter edged, and never a different cable.
    // AN OPEN LEAD IS NOT DIMMED. It carries no current, so it is drawn thin; it carries the full open
    // circuit voltage right up to the break, so it keeps its colour and its polarity, and the break
    // itself is marked amber. A stub drawn faint would say "safe", and it is the opposite of safe.
    const core = s.plus ? potColour(Math.max(0.22, s.pot === undefined ? 1 : s.pot)) : SHAPE_BLACK;
    const rim = lit ? '#eaf6ff' : s.open ? SHAPE_WARN : (s.plus ? (fused ? '#8a3228' : '#552722') : (fused ? '#a3b4c9' : SHAPE_EDGE));
    path(s.pts); ctx.lineWidth = w + (lit ? 1.7 : 1.0); ctx.strokeStyle = rim; ctx.stroke();
    path(s.pts); ctx.lineWidth = w; ctx.strokeStyle = fused ? core : dimColour(core, 0.62); ctx.stroke(); }
  // 3. THE GAP, and what it is short by, said in metres
  for (const s of D.shapes) { if (s.role !== 'gap' || !onScreen(s.pts)) continue;
    const a = S(s.pts[0]), b = S(s.pts[1]);
    ctx.setLineDash([2.5, 3.5]); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
    ctx.lineWidth = hair; ctx.strokeStyle = SHAPE_WARN; ctx.stroke(); ctx.setLineDash([]);
    for (const p of [a, b]) { ctx.beginPath(); ctx.arc(p[0], p[1], 1.9, 0, 6.2832); ctx.fillStyle = SHAPE_WARN; ctx.fill(); }
    // WHAT IT IS SHORT BY, only when there is room for it to be read and never over a module's name.
    if (perM > 46) { const m = S(s.mid); ctx.font = '600 10px ui-monospace,Menlo,Consolas,monospace';
      ctx.textAlign = 'center'; ctx.fillStyle = SHAPE_WARN;
      ctx.fillText(s.short.toFixed(2) + ' m short', Math.round(m[0]), Math.round(m[1]) - 7);
      if (s.volts_across) ctx.fillText('up to ' + Math.round(s.volts_across) + ' V across it', Math.round(m[0]), Math.round(m[1]) + 12); } }
  // 4. THE MODULES: the frame, a quiet fill so it reads as a body, and the cells in hairlines
  for (const s of D.shapes) {
    if (s.role === 'module' || s.role === 'inverter') { if (!onScreen(s.pts)) continue;
      path(s.pts); ctx.closePath(); if (s.fill) { ctx.fillStyle = s.fill; ctx.fill(); }
      ctx.lineWidth = fine; ctx.strokeStyle = s.role === 'inverter' ? SHAPE_INK : SHAPE_PENCIL; ctx.stroke(); continue; }
    // THE CELLS THIN OUT BEFORE THEY TURN TO MUSH. At whole row zoom they are not drawn at all; they
    // appear when a reader is close enough for them to be crisp, and never as a grey wash.
    if (s.role === 'cells') { if (perM < 34 || !onScreen(s.pts)) continue;
      ctx.lineWidth = hair; ctx.strokeStyle = SHAPE_FAINT; ctx.beginPath();
      for (const l of s.lines) { const a = S(l[0]), b = S(l[1]); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
      ctx.stroke();
      if (s.split) { const a = S(s.split[0]), b = S(s.split[1]);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
        ctx.lineWidth = 1; ctx.strokeStyle = SHAPE_EDGE; ctx.stroke(); }
      continue; }
    if (s.role === 'box') { if (!onScreen(s.pts)) continue;
      path(s.pts); ctx.closePath(); ctx.fillStyle = '#05080d'; ctx.fill();
      ctx.lineWidth = fine; ctx.strokeStyle = SHAPE_INK; ctx.stroke(); continue; }
    if (s.role === 'terminal' && s.pts.length > 1) { if (!onScreen(s.pts)) continue;
      path(s.pts); ctx.lineWidth = fine; ctx.strokeStyle = SHAPE_INK; ctx.stroke(); continue; }
    if (s.role === 'joint' && perM > 18) { const p = S(s.pts[0]);
      if (p[0] < -20 || p[0] > innerWidth + 20) continue;
      ctx.beginPath(); ctx.arc(p[0], p[1], 1.7, 0, 6.2832); ctx.fillStyle = '#0a0d13'; ctx.fill();
      ctx.lineWidth = hair; ctx.strokeStyle = SHAPE_INK; ctx.stroke(); } }
  // 5. THE MARKS: - and + beside every box and terminal, and the module's name under it, on whole pixels
  ctx.textBaseline = 'middle';
  for (const m of D.marks) { if (perM < (m.minPx || 0)) continue;
    const p = S([m.x, m.y]); if (p[0] < -40 || p[0] > innerWidth + 40 || p[1] < -20 || p[1] > innerHeight + 20) continue;
    ctx.font = '600 ' + m.size + 'px ui-monospace,Menlo,Consolas,monospace';
    ctx.textAlign = m.mid ? 'center' : 'left'; ctx.fillStyle = m.colour;
    ctx.fillText(m.text, Math.round(p[0]), Math.round(p[1])); }
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.restore();
}
// ---- what the pointer is over -----------------------------------------------------------------
// A HOVER OR A TAP LIGHTS ONE WHOLE LINK AND NAMES IT. It never takes the pointer: this layer has no
// pointer events at all, the window listens, and the shell's own tap on a dot is untouched.
function shapeAsk(px0, py0){
  const D = sldShapes; if (!D) return null;
  let best = null, bd = 14;
  for (const s of D.shapes) { if (!s.hit || !s.pts || s.pts.length < 2) continue;
    const pts = s.pts.map(shapePoint);
    for (let i = 1; i < pts.length; i++) { const a = pts[i-1], b = pts[i];
      const dx = b[0] - a[0], dy = b[1] - a[1], L = dx*dx + dy*dy;
      let t = L > 0 ? ((px0 - a[0]) * dx + (py0 - a[1]) * dy) / L : 0; t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(px0 - (a[0] + t*dx), py0 - (a[1] + t*dy));
      if (d < bd) { bd = d; best = s; } } }
  return best;
}
function shapeTrack(e){
  if (!sldShapes || !body || !body.sld || !body.shown || bodyAnim) { if (shapeHover) { shapeHover = null; dirty = true; } return; }
  const s = shapeAsk(e.clientX, e.clientY), node = s ? s.node : null;
  if (node === shapeHover) return;
  shapeHover = node; sldShapes.saying = s ? s.says : null; dirty = true; placeSldNames();
}
addEventListener('pointermove', shapeTrack, { passive:true });
addEventListener('pointerdown', shapeTrack, { passive:true });
// AFTER EVERY FRAME THE SHELL DRAWS, not on a loop of this file's own and not on a guessed list of
// events: the shell says it has drawn, and the words and the drawing are put where the dots are.
try { if (window.__wafer && window.__wafer.onDraw) window.__wafer.onDraw.add(function(){ try { placeSldNames(); drawSldShapes(); } catch (_) {} }); } catch (_) {}
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
