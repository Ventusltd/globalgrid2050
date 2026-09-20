'use strict';
// kuiper-programs.js - a cartridge of the Kuiper shell. Cut from the whole page with no change of behaviour;
// replaced, when it is, by a newer file the pointer names and the composer checks by its hash.
let ASM = null, gatherAnim = null, homeAnim = null;
// the live answer window and the way back to a preset: declared here because the bar is built long
// before the part of this file that uses them has run
let fireLive = null, fireAgain = null;
// CHANGE ONE INPUT AND FIRE AGAIN, keeping everything else the reader has set. The view buttons use it.
function reFire(extra){
  if (!fireLive || !fireLive.boxes) return;
  Object.assign(fireLive.boxes.vals, extra);
  fireCommand(fireLive.boxes.cmd(), fireLive.rec, true);
}
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
  if (u_sld > 0.5 && v_val < -1.5) discard;          // melted away: a solid shapes drawing keeps no loose dots
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
                // THE TABLE ITSELF. One module high in portrait on a fixed tilt is the old row, exactly.
                mounting: 'fixed', orientation: 'portrait', modules_high: 1, routing: '', view: 'wiring', sheet: 0,
                // A RETURN TIER IS MOUNTED THE OTHER WAY ROUND, and that is not a detail. Going back along
                // the upper row, the + box of one module has to reach the - box of the one to its LEFT, so
                // the link is a pitch PLUS the box spacing instead of a pitch minus it: 2.16 m where 0.48 m
                // was expected. Turning every module in the return rows end for end puts it back to 0.48 m,
                // and that is what is actually done on a table. It is an input because it is a decision.
                turn_alternate_rows: 0,
                // A JUMPER IS WHAT IS REALLY DONE when two leads do not meet: a short cable is made up on
                // site and spliced between them, which closes the circuit and costs cable and one more
                // mated pair at that link. Without this the model says the string is open, which is the
                // truth about the LEADS and not about the finished job. Off by default, because a jumper
                // is a decision somebody has to take and pay for.
                jumpers: 0,
                gap_up_m: 0.02, ridge_gap_m: 0.15, tube_gap_m: 0.12,
                gap_m: 0.02, box_spacing_m: 0.84, wiring: 'leapfrog', turn_every_second: 0,
                leads: 'reach', lead_slack_m: 0.20, lead_plus_m: null, lead_minus_m: null, lead_mm2: 4, cable_mm2: 6, near_end_m: 59, amps: 17.35,
                // TWO CONDUCTORS IN TWO PLACES AT TWO TEMPERATURES. A module lead is clipped to the back of a
                // module in the sun; the site cable is in a tray or a trench. One figure for both was always a
                // simplification, and it flattered whichever of the two was hotter. conductor_c is kept as the
                // NAME FOR BOTH: give it and both take it, so every command ever written still means what it
                // said, and equal temperatures reproduce the old model to the digit.
                conductor_c: null, t_lead_c: 80, t_site_c: 55, rating_c: 90,
                // HOW FAR APART THE TWO HOME RUNS ARE LAID. The array's own loop is one thing; the pair of
                // cables running back to the inverter is another, and on a long home run it is the bigger of
                // the two. It has NO DEFAULT, on purpose: nobody can know from a drawing whether that pair
                // was bundled or run in two trays, and the difference moves the answer more than the wiring
                // choice does. Until it is given, the home run loop and the total are NOT REPORTED. A model
                // that guesses a number like that is worse than a model that says it does not know.
                home_separation_m: null,
                // SLACK AT EVERY LINK. A lead is not a straight line: it is clipped, it drops and it comes
                // back. The distance a link has to span is the straight distance between the two boxes PLUS
                // whatever allowance the installer is told to leave. Zero is the geometric case.
                slack_m: 0,
                contact_milliohm: 0.35, return_offset_m: 0.3, lead_gap_m: 0.05 };
  const rnd = (x, n) => { const k = Math.pow(10, n); return Math.round(x * k) / k; };
  const ROUTE_WORDS = { 'one-after-another':'one after another, with a cable to bring the far end home',
    'serpentine':'along and back, out along one row and back along the next',
    'leapfrog':'leapfrog inside each row', 'zigzag':'zigzag between two rows' };
  const LAYOUT_WORDS = g => { const o = g.port ? 'portrait' : 'landscape';
    const m = g.mount === 'east-west' ? 'east and west facing, ' + g.high + ' in ' + o + ' on each face'
      : g.mount === 'tracker' ? 'a tracker, ' + g.rows + ' in ' + o
      : 'fixed tilt, ' + g.rows + ' in ' + o + (g.rows > 1 ? ' high' : '');
    return m; };

  // ===== THE TABLE. A string is not a row; a row is a table one module high. =====================
  // A module's two boxes sit at MID LENGTH OF ITS LONG SIDE, spread along its SHORT axis. That is one
  // rule and it settles both orientations without a special case: in PORTRAIT the long side is upright,
  // so the - and the + sit side by side ALONG the table; in LANDSCAPE the module is turned a quarter
  // turn, the long side is now horizontal, and the two boxes sit one ABOVE the other. Everything else -
  // where the modules are, how far a link has to reach, what is laid on site - follows from that and
  // from the grid. A table one module high in portrait reproduces the old row model to the digit, which
  // is asserted rather than hoped for.
  function build(inp) {
    const c = Object.assign({}, DEF, inp || {}), N = Math.max(2, Math.min(60, Math.round(c.modules)));
    const port = String(c.orientation || 'portrait').toLowerCase() !== 'landscape';
    const wX = port ? c.width_m : c.module_height_m, wY = port ? c.module_height_m : c.width_m;
    const pitch = wX + c.gap_m, pitchY = wY + c.gap_up_m;
    const mount = String(c.mounting || 'fixed').toLowerCase();
    const high = Math.max(1, Math.min(6, Math.round(c.modules_high)));
    const faces = mount === 'east-west' ? 2 : 1, rows = high * faces;
    const cols = Math.max(1, Math.ceil(N / rows));
    // WHAT STANDS BETWEEN TWO ROWS: nothing on a plain table, the ridge on an east west table, the torque
    // tube down the middle of a tracker.
    const extraAfter = r => (faces === 2 && r === high - 1) ? c.ridge_gap_m
      : (mount === 'tracker' && r === Math.floor(rows / 2) - 1) ? c.tube_gap_m : 0;
    const rowY = []; { let yy = 0; for (let r = 0; r < rows; r++) { rowY.push(yy); yy += pitchY + extraAfter(r); } }
    // ROUTING is what the old "wiring" input was asking, and it is kept as a name for it.
    let routing = String(c.routing || '').toLowerCase();
    if (!routing) routing = String(c.wiring).toLowerCase() === 'sequential' ? 'one-after-another' : 'leapfrog';
    if (routing === 'along-and-back' || routing === 'sequential-u') routing = 'serpentine';
    if (routing === 'sequential') routing = 'one-after-another';
    if (routing === 'zigzag' && rows < 2) routing = 'one-after-another';
    if (routing === 'serpentine' && rows < 2) routing = 'one-after-another';
    c.routing = routing;
    const leap = routing === 'leapfrog';
    // THE DEFAULT STRING IS A COMPLETE STRING. Nobody builds an array and leaves half its links open;
    // a drawing that opens by default is a drawing of a mistake. So unless a lead length is typed, the
    // leads are THE PAIR THAT REACHES for the wiring chosen - the longest link plus the slack allowance
    // - and the answer says what pair that is, to be ordered against what the module is supplied with.
    // Ask for "supplied" instead and you get the factory portrait leads and, with them, the shortfall.
    const leadsAre = String(c.leads || 'reach').toLowerCase();
    const typedLeads = c.lead_plus_m !== null || c.lead_minus_m !== null;
    if (leadsAre === 'supplied' && !typedLeads) { c.lead_plus_m = 0.35; c.lead_minus_m = 0.28; }
    const rowOf0 = k => Math.min(rows - 1, Math.floor((k - 1) / cols)), colOf = k => (k - 1) % cols;
    const turned = k => (!!c.turn_every_second && k % 2 === 0) !== (!!c.turn_alternate_rows && rowOf0(k) % 2 === 1);
    const rowOf = rowOf0;
    const x0 = k => colOf(k) * pitch, y0 = k => rowY[rowOf(k)];
    const s2 = c.box_spacing_m / 2;
    const ptAt = (k, want, t) => { const cxm = x0(k) + wX / 2, cym = y0(k) + wY / 2, d = (want === '+' ? 1 : -1) * (t ? -1 : 1) * s2;
      return port ? [cxm + d, cym] : [cxm, cym + d]; };
    const minusPt = k => ptAt(k, '-', turned(k)), plusPt = k => ptAt(k, '+', turned(k));
    const minus = k => minusPt(k)[0], plus = k => plusPt(k)[0];           // the drawing reads x from these
    // THE ORDER THE STRING IS WIRED IN, over the grid of modules. The modules themselves never move.
    const inRow = r => { const out = []; for (let k = 1; k <= N; k++) if (rowOf(k) === r) out.push(k); return out; };
    const order = [];
    if (routing === 'leapfrog') { for (let r = 0; r < rows; r++) { const q = inRow(r); if (!q.length) continue;
        const fwd = r % 2 === 0 ? q : q.slice().reverse();
        for (let i = 0; i < fwd.length; i += 2) order.push(fwd[i]);
        for (let i = (fwd.length % 2 ? fwd.length - 2 : fwd.length - 1); i >= 1; i -= 2) order.push(fwd[i]); } }
    else if (routing === 'serpentine') { for (let r = 0; r < rows; r++) { const q = inRow(r); if (!q.length) continue;
        order.push(...(r % 2 === 0 ? q : q.slice().reverse())); } }
    else if (routing === 'zigzag') { const a0 = inRow(0), a1 = inRow(1);
        for (let i = 0; i < Math.max(a0.length, a1.length); i++) { const up = i % 2 === 0;
          if (up) { if (a0[i] !== undefined) order.push(a0[i]); if (a1[i] !== undefined) order.push(a1[i]); }
          else { if (a1[i] !== undefined) order.push(a1[i]); if (a0[i] !== undefined) order.push(a0[i]); } }
        for (let r = 2; r < rows; r++) { const q = inRow(r); order.push(...(r % 2 === 0 ? q : q.slice().reverse())); } }
    else for (let k = 1; k <= N; k++) order.push(k);
    // HOW FAR EACH LINK HAS TO REACH IS GEOMETRY, and it does not depend on what lead is fitted: so the
    // needs are measured first, and only then is the lead pair settled.
    const links = [];
    for (let i = 0; i + 1 < order.length; i++) { const from = order[i], to = order[i + 1];
      const A = plusPt(from), B = minusPt(to);
      const need = Math.hypot(A[0] - B[0], A[1] - B[1]) + (+c.slack_m || 0);
      links.push({ from, to, need, back: to < from, cross: rowOf(from) !== rowOf(to),
                   x_from: A[0], x_to: B[0], y_from: A[1], y_to: B[1] }); }
    const longest = links.length ? Math.max(...links.map(l => l.need)) : 0;
    if (c.lead_plus_m === null || c.lead_minus_m === null) {
      const want = longest + (c.lead_slack_m === undefined ? 0.20 : +c.lead_slack_m);
      // the + lead keeps the box spacing it really has and the - lead makes up the rest, which is how
      // a module maker quotes an unequal pair
      const lpWant = Math.min(want * 0.5, c.box_spacing_m);
      if (c.lead_plus_m === null) c.lead_plus_m = Math.round(lpWant * 1000) / 1000;
      if (c.lead_minus_m === null) c.lead_minus_m = Math.round((want - c.lead_plus_m) * 1000) / 1000; }
    const pair = c.lead_plus_m + c.lead_minus_m;
    for (const l of links) { l.reaches = pair + 1e-9 >= l.need;
      l.jumper = !l.reaches && !!c.jumpers ? l.need - pair : 0; }
    const last = order[order.length - 1], row = cols * pitch;
    // HOW FAR A FREE END IS FROM THE NEAR CORNER, along the structure: a cable is clipped to steel, it
    // does not fly. Both ends land at the near end when the + end is in the near half of the table.
    const yBase = rowY[0] + wY / 2;
    const run = q => Math.abs(q[0]) + Math.abs(q[1] - yBase);
    const endRun = run(plusPt(last)), bothNear = endRun <= row / 2;
    const ret = bothNear ? 0 : endRun;
    // conductor_c, when it is given, is the name for both: it sets the lead and the site cable together.
    if (c.conductor_c !== null && c.conductor_c !== undefined && c.conductor_c !== '') { c.t_lead_c = +c.conductor_c; c.t_site_c = +c.conductor_c; }
    const fLead = 1 + 0.00393 * (c.t_lead_c - 20), fSite = 1 + 0.00393 * (c.t_site_c - 20);
    // A JUMPER IS SITE CABLE AND ONE MORE MATED PAIR, at the link it is spliced into.
    const jumpers = links.filter(l => l.jumper > 0), jumper_m = jumpers.reduce((t, l) => t + l.jumper, 0);
    const lead_m = N * pair, field_m = 2 * c.near_end_m + run(minusPt(order[0])) + endRun + jumper_m;
    const pairs = links.length + 2 + (bothNear ? 0 : 1) + jumpers.length;
    // A SITE MADE END is a connector fitted to a cut cable by a person on the table: the two home runs
    // always, and the far end return cable's two, when one is laid.
    const siteEnds = 2 + (bothNear ? 0 : 2);
    const ohmLead = (R20[c.lead_mm2] || 5.09) * lead_m * fLead / 1000;
    const ohmSite = (R20[c.cable_mm2] || 3.39) * field_m * fSite / 1000;
    const ohm = ohmLead + ohmSite + pairs * c.contact_milliohm / 1000;
    const short = links.filter(l => !l.reaches && !l.jumper), needs = links.map(l => l.need);
    // THREE LOOPS, NOT ONE. The array's own loop is what the wiring choice changes; the home run pair is
    // its own loop and on a long run it is the larger; a nearby stroke couples into the SUM of them.
    const arrayLoop = bothNear ? row * c.lead_gap_m : row * c.return_offset_m;
    const sep = (c.home_separation_m === null || c.home_separation_m === undefined || c.home_separation_m === '') ? null : +c.home_separation_m;
    const homeLoop = sep === null ? null : c.near_end_m * sep;
    const loop = homeLoop === null ? null : arrayLoop + homeLoop;
    // A CONDUCTOR OVER ITS RATING IS SAID IN WORDS AND NEVER QUIETLY COSTED.
    const hot = [];
    if (c.t_lead_c > c.rating_c) hot.push('the module leads at ' + c.t_lead_c + ' C are over the ' + c.rating_c + ' C the cable is rated for');
    if (c.t_site_c > c.rating_c) hot.push('the site cable at ' + c.t_site_c + ' C is over the ' + c.rating_c + ' C it is rated for');
    // WHAT IS NOT LAID ON SITE, against ONE stated baseline: the same row wired one after another, no
    // module turned, with its far end brought home. Closed form, so it can be checked by hand:
    // plain leapfrog saves (N-2) pitches; turning every second module saves (N-2) pitches and the box
    // spacing as well, because the last module's + box has moved to the near side of its own module.
    const baseEnd = Math.abs(ptAt(N, '+', false)[0]) + Math.abs(ptAt(N, '+', false)[1] - yBase);
    const baseField = 2 * c.near_end_m + Math.abs(ptAt(1, '-', false)[0]) + Math.abs(ptAt(1, '-', false)[1] - yBase) + baseEnd;
    const saved = baseField - field_m;
    const smallest = needs.length ? Math.max(...needs) : 0;
    return { c, N, pitch, pitchY, wX, wY, port, rows, cols, rowY, mount, high, faces, routing, leap, order, links,
             row, pair, lead_m, field_m, pairs, siteEnds, ohm, ohmLead, ohmSite, bothNear, endRun, ret,
             short, needs, smallest, jumpers, jumper_m, loop, arrayLoop, homeLoop, sep, saved, hot, fLead, fSite,
             minusPt, plusPt, minus, plus, rowOf, colOf, x0, y0, turned };
  }
  function run(inp) {
    const g = build(inp), c = g.c, worst = g.short.length ? Math.max(...g.short.map(l => l.need - g.pair)) : 0;
    const name = LAYOUT_WORDS(g) + ', ' + (ROUTE_WORDS[g.routing] || g.routing)
      + (c.turn_every_second ? ', every second module turned end for end' : '');
    // A SERIES CIRCUIT IS OPEN OR IT IS NOT. One pair of connectors that does not meet and the whole
    // string carries nothing: not a warm link, not a derated string, NOTHING, anywhere in it.
    const open = g.short.length > 0, amps = open ? 0 : c.amps;
    // AN OPEN STRING IS NOT A DEAD STRING. No current flows, and that is the whole of what "open" means;
    // the modules go on making their open circuit voltage, so the full string voltage stands across a
    // break, and an open connector under that voltage is exactly where a direct current arc begins.
    const voc = g.N * c.module_voc;
    const order = g.order.map(k => 'M' + k).join(' → ');
    const hotWords = g.hot.length ? ' RATING CHECK FAILED: ' + g.hot.join('; ') + '. ' : '';
    const loopWords = g.sep === null
      ? ' The whole loop needs the home run separation: it moves the answer more than the wiring does, so only the array loop is given.'
      : ' Loop ' + g.loop.toFixed(1) + ' m2 in all, of which the home run pair is ' + g.homeLoop.toFixed(1) + ' m2.';
    const said = hotWords + name + ': ' + g.N + ' modules over ' + g.rows + (g.rows === 1 ? ' row' : ' rows') + ' of ' + g.cols + ', ' + g.links.length + ' links from ' + Math.min(...g.needs).toFixed(2) + ' to ' + Math.max(...g.needs).toFixed(2) + ' m against a lead pair of ' + g.pair.toFixed(2) + ' m; '
      + (g.bothNear ? 'both free ends land at the near end, so no return cable is laid; ' : 'a return cable of ' + g.ret.toFixed(1) + ' m brings the far end home; ')
      + (g.jumpers.length ? g.jumpers.length + (g.jumpers.length === 1 ? ' link is' : ' links are') + ' made up with a jumper spliced in on site, ' + g.jumper_m.toFixed(1) + ' m of cable and ' + g.jumpers.length + ' more mated pairs; ' : '')
      + (open ? 'THE CIRCUIT IS OPEN AND BOTH ENDS ARE LIVE: ' + g.short.length + ' links do not reach (short by up to ' + worst.toFixed(2) + ' m), so no current flows anywhere, but up to '
                + voc.toFixed(0) + ' V stands across a break and an open connector at that voltage is where a direct current arc starts'
              : 'every link reaches, so the loop closes and ' + c.amps + ' A flows all the way round it')
      + '; ' + g.lead_m.toFixed(1) + ' m of module lead and ' + g.field_m.toFixed(1) + ' m of cable laid on site; '
      + loopWords + ' '
      + (open ? g.ohm.toFixed(3) + ' ohm IF IT WERE CLOSED, and ' + (c.amps * c.amps * g.ohm).toFixed(0) + ' W lost at ' + c.amps + ' A: nothing is lost in it now because nothing flows in it'
              : g.ohm.toFixed(3) + ' ohm, ' + (amps * amps * g.ohm).toFixed(0) + ' W lost at ' + amps + ' A');
    // THE CONNECTION LIST, in the order the current runs, terminal by terminal. It is the same walk the
    // checks make, so what a reader sees in words is what the drawing was built from.
    const connections = [{ from:'INV\u2212', to:'M' + g.order[0] + '\u2212', metres:c.near_end_m, home:true, node:'home-' }];
    g.links.forEach((l, i) => connections.push({ node:'L' + i, from:'M' + l.from + '+', to:'M' + l.to + '\u2212',
      needed:rnd(l.need, 2), pair:rnd(g.pair, 2), reaches:l.reaches, jumper:rnd(l.jumper || 0, 2) }));
    connections.push({ from:'M' + g.order[g.order.length - 1] + '+', to:'INV+', metres:c.near_end_m, home:true, node:'home+' });
    return { connections, numbers: { circuit: open ? 'OPEN, both ends live' : 'closed', current_a: rnd(amps, 2),
               open_circuit_volts_at_25c: rnd(voc, 0), volts_across_a_break: open ? rnd(voc, 0) : 0, links: g.links.length,
               shortest_link_m: rnd(Math.min(...g.needs), 3), longest_link_m: rnd(Math.max(...g.needs), 3), lead_pair_m: rnd(g.pair, 3),
               links_that_do_not_reach: g.short.length, worst_shortfall_m: rnd(worst, 3), module_lead_m: rnd(g.lead_m, 1), cable_laid_on_site_m: rnd(g.field_m, 1),
               total_conductor_m: rnd(g.lead_m + g.field_m, 1), connector_pairs: g.pairs, string_resistance_ohm: rnd(g.ohm, 4), loss_w: rnd(amps * amps * g.ohm, 1),
               volt_drop_v: rnd(amps * g.ohm, 2), row_length_m: rnd(g.row, 2), string_volts_at_vmp: rnd(g.N * c.module_vmp, 0),
               loss_w_if_it_were_closed: rnd(c.amps * c.amps * g.ohm, 1),
               volts_to_earth_each_end: '−' + rnd(g.N * c.module_vmp / 2, 0) + ' to +' + rnd(g.N * c.module_vmp / 2, 0),
               routing: g.routing, rows_of_modules: g.rows, columns_of_modules: g.cols,
               modules_in_the_last_column: g.N - (g.cols - 1) * g.rows > 0 ? Math.min(g.rows, g.N - (g.cols - 1) * g.rows) : g.rows,
               both_ends_at_the_near_end: g.bothNear, return_cable_m: rnd(g.ret, 2),
               smallest_lead_pair_that_reaches_m: rnd(g.smallest, 3),
               lead_pair_to_order_m: rnd(g.pair, 3),
               connectors_fitted_on_site: g.siteEnds + 2 * g.jumpers.length,
               jumpers_made_on_site: g.jumpers.length, jumper_cable_m: rnd(g.jumper_m, 2),
               array_loop_m2_rough: rnd(g.arrayLoop, 2),
               home_run_loop_m2_rough: g.homeLoop === null ? null : rnd(g.homeLoop, 2),
               total_loop_m2_rough: g.loop === null ? null : rnd(g.loop, 2),
               site_cable_saved_m: rnd(g.saved, 2),
               lead_resistance_ohm: rnd(g.ohmLead, 4), site_cable_resistance_ohm: rnd(g.ohmSite, 4),
               rating_check: g.hot.length ? 'FAILED: ' + g.hot.join('; ') : 'passed, both conductors at or under ' + c.rating_c + ' C' },
             said, electrical_order: order,
             how: 'geometry only: module ' + c.width_m + ' m wide by ' + c.module_height_m + ' m tall in portrait, ' + c.cell_cols + ' by ' + c.cell_rows
               + ' half cells, junction boxes ' + c.box_spacing_m + ' m apart at mid height, a link is the distance between the boxes it joins; leads ' + c.lead_mm2 + ' mm2, site cable ' + c.cable_mm2
               + ' mm2, copper, the leads at ' + c.t_lead_c + ' C and the site cable at ' + c.t_site_c + ' C (give conductor_c and both take that figure); near end ' + c.near_end_m + ' m from the inverter. '
               + 'The site cable temperature is an assumption and it matters: buried is about 30 C, clipped along the structure is near the lead temperature; ' + c.t_site_c + ' C was used here. '
               + 'A link has to span the STRAIGHT DISTANCE IN THE PLANE between the two boxes plus the slack allowance, ' + (+c.slack_m || 0) + ' m here. '
               + 'The boxes sit at mid length of the module\u2019s long side, spread along its short axis, so in portrait they are side by side along the table and in landscape one above the other. '
               + 'A cable to a free end is counted along the structure, not across the diagonal. '
               + 'The loop is in two parts, both rough: the ARRAY loop is the row length times a stated gap, and the HOME RUN loop is the run times how far apart the two cables are laid. '
               + 'Bundling the home run pair shrinks the loop more than the wiring choice does, for either wiring. '
               + 'Site cable not laid, against the same row wired one after another with no module turned and its far end brought home: ' + g.saved.toFixed(2) + ' m. '
               + 'Electrical order ' + order + '. Colour is the POTENTIAL RELATIVE TO THE MINUS TERMINAL, not to earth: the array floats, so either terminal may sit at up to half the '
               + 'array voltage with respect to earth, and a black line does not mean an earthed one. The line does not thicken or thin along the string, because a series circuit carries one current. '
               + 'The moving highlight is the INSTANT THE CIRCUIT CLOSES; after that the current is the same all the way round and nothing travels along the wire. An open string carries no current and is NOT safe: up to '
               + rnd(voc, 0) + ' V at 25 C stands across a break, more when it is cold. '
               + 'Every input can be changed. An estimate, not a study.', string: g, inputs_used: Object.assign({}, c) };
  }
  // WHAT A READER MAY TURN, in plain words with its unit. The window makes a box out of each of these.
  const BOXES = [
    { key:'mounting', label:'mounting', kind:'choice', choices:[['fixed', 'fixed tilt'], ['east-west', 'east and west facing'], ['tracker', 'single axis tracker']] },
    { key:'orientation', label:'modules', kind:'choice', choices:[['portrait', 'portrait'], ['landscape', 'landscape']] },
    { key:'modules_high', label:'modules high (each face)', kind:'number', min:1, max:6, step:1 },
    { key:'turn_alternate_rows', label:'return rows turned round', kind:'choice', choices:[[0, 'no'], [1, 'yes']] },
    { key:'jumpers', label:'jumper where leads fall short', kind:'choice', choices:[[0, 'no, say it is open'], [1, 'yes, splice one in']] },
    { key:'view', label:'drawn as', kind:'choice', choices:[['wiring', 'the back, wiring'], ['scale', 'modules to scale']] },
    { key:'sheet', label:'on', kind:'choice', choices:[[0, 'the night sky'], [1, 'a drawing sheet']] },
    { key:'routing', label:'routing', kind:'choice', choices:[
      ['one-after-another', 'one after another, with a return cable'],
      ['serpentine', 'along and back, no return cable'],
      ['leapfrog', 'leapfrog inside each row'],
      ['zigzag', 'zigzag between two rows']] },
    { key:'turn_every_second', label:'every second module turned', kind:'choice', choices:[[0, 'no'], [1, 'yes']] },
    { key:'modules', label:'modules', kind:'number', min:2, max:40, step:1 },
    { key:'width_m', label:'module width', unit:'m', kind:'number', min:0.4, max:3, step:0.001 },
    { key:'module_height_m', label:'module height', unit:'m', kind:'number', min:0.4, max:4, step:0.001 },
    { key:'gap_m', label:'gap along the table', unit:'m', kind:'number', min:0, max:1, step:0.005 },
    { key:'gap_up_m', label:'gap up the table', unit:'m', kind:'number', min:0, max:1, step:0.005 },
    { key:'ridge_gap_m', label:'gap at the ridge', unit:'m', kind:'number', min:0, max:2, step:0.01 },
    { key:'tube_gap_m', label:'gap at the torque tube', unit:'m', kind:'number', min:0, max:2, step:0.01 },
    { key:'box_spacing_m', label:'junction boxes apart', unit:'m', kind:'number', min:0.05, max:2, step:0.01 },
    { key:'leads', label:'leads', kind:'choice', choices:[['reach', 'the pair that reaches'], ['supplied', 'as supplied, portrait']] },
    { key:'lead_slack_m', label:'slack in the lead pair', unit:'m', kind:'number', min:0, max:2, step:0.01 },
    { key:'lead_plus_m', label:'+ lead', unit:'m', kind:'number', min:0.05, max:8, step:0.01 },
    { key:'lead_minus_m', label:'− lead', unit:'m', kind:'number', min:0.05, max:8, step:0.01 },
    { key:'lead_mm2', label:'lead size', unit:'mm2', kind:'choice', choices:[[2.5, '2.5'], [4, '4'], [6, '6'], [10, '10']] },
    { key:'cable_mm2', label:'site cable', unit:'mm2', kind:'choice', choices:[[4, '4'], [6, '6'], [10, '10']] },
    { key:'near_end_m', label:'near end from the inverter', unit:'m', kind:'number', min:0, max:400, step:1 },
    { key:'amps', label:'current', unit:'A', kind:'number', min:0.1, max:40, step:0.01 },
    { key:'t_lead_c', label:'module lead temperature', unit:'C', kind:'number', min:-25, max:140, step:1 },
    { key:'t_site_c', label:'site cable temperature', unit:'C', kind:'number', min:-25, max:140, step:1,
      hint:'buried is about 30, clipped along the structure is near the lead temperature' },
    { key:'rating_c', label:'cable rated for', unit:'C', kind:'number', min:60, max:140, step:5 },
    { key:'home_separation_m', label:'home run cables apart', unit:'m', kind:'number', min:0, max:2, step:0.01,
      optional:true, hint:'bundled about 0.02, separate trays about 0.3' },
    { key:'slack_m', label:'slack allowed at each link', unit:'m', kind:'number', min:0, max:2, step:0.01 },
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
// ===== ONE COMPLETE INVERTER BLOCK: fire block ==================================================
// 24 x strings of 30 modules in series x 24 strings per inverter. ALL STRINGS SHOW PER INVERTER:
// 24 of 24, 720 modules, 48 home runs, each landing on its OWN named inverter input terminal.
// THE MATHS AND THE GEOMETRY BELOW ARE COPIED, NOT REWRITTEN, from the tested library
//   E:\kuiper-iterations\LIB\solar-block\block.mjs  (solar-block/1.0.0, 68 of 68 assertions pass in
//   its own test.mjs). Copied verbatim, with the ES module `export` keywords removed so a classic
//   script can carry them: r/p2/dist/polyLength/dedupe, MODULE_CLASSES, ARRANGEMENTS,
//   INVERTER_CLASS, INPUTS, DEFAULTS, PRESETS, stringComponent, buildBlock. Nothing in them is
//   changed here; what is new is blockDrawing(), which turns that library's output into this
//   engine's shape data, and nothing else.
(function (root) {
  const F = root.FIRE; if (!F) return;

  /* ---- copied from block.mjs: helpers ---- */
  const r = (v, n = 3) => Math.round(v * 10 ** n) / 10 ** n;
  const p2 = (n) => String(n).padStart(2, '0');
  const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  function polyLength(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += dist(pts[i - 1], pts[i]); return L; }
  function dedupe(pts) { const out = [];
    for (const q of pts) { const last = out[out.length - 1];
      if (!last || Math.abs(last[0] - q[0]) > 1e-9 || Math.abs(last[1] - q[1]) > 1e-9) out.push(q); }
    return out; }

  /* ---- copied from block.mjs: module classes ---- */
  const MODULE_CLASSES = {
    C495: { id:'C495', label:'495 W class bifacial module, 166 mm half-cell, 144 cells', wp:495,
      Voc_V:45.9, Vmp_V:38.1, Imp_A:12.98, Isc_A:13.65, beta_Voc_pct_per_K:-0.25, gamma_Vmp_pct_per_K:-0.34,
      alpha_Isc_pct_per_K:0.045, Ir_A:20, width_m:1.038, length_m:2.094, bifaciality:0.7 },
    C660: { id:'C660', label:'660 W class bifacial module, 210 mm half-cell, 132 cells', wp:660,
      Voc_V:45.3, Vmp_V:38.0, Imp_A:17.37, Isc_A:18.4, beta_Voc_pct_per_K:-0.25, gamma_Vmp_pct_per_K:-0.34,
      alpha_Isc_pct_per_K:0.045, Ir_A:30, width_m:1.303, length_m:2.384, bifaciality:0.8 },
  };

  /* ---- copied from block.mjs: inverter DC arrangements ---- */
  const ARRANGEMENTS = {
    '12x2': { id:'12x2', label:'12 trackers x 2 inputs = 24 strings', trackers:12, inputs_per_tracker:2,
      inputs:24, A_per_tracker:40, A_per_input:30, Isc_per_tracker_A:60, strings_in_parallel_per_tracker:2,
      fuse_words:'At two strings in parallel on one tracker the worst-case fault current into a faulted ' +
        'string is (2-1) x 1.25 x Isc, which sits below the module reverse-current rating. ' +
        'STRING FUSES ARE NOT REQUIRED in this arrangement - but only on the parallel-string ' +
        'term. The inverter backfeed contribution is not published anywhere, so the verdict is ' +
        'conditional and the check is returned twice: once with the inputs blocking reverse ' +
        'current and once without.' },
    '6x5': { id:'6x5', label:'6 trackers x 5 inputs = 30 strings', trackers:6, inputs_per_tracker:5,
      inputs:30, A_per_tracker:75, A_per_input:30, Isc_per_tracker_A:125, strings_in_parallel_per_tracker:5,
      fuse_words:'STRING FUSES ARE REQUIRED in this arrangement. Five strings in parallel on one tracker ' +
        'drive (5-1) x 1.25 x Isc into a faulted string - about 68 A on the default class - which ' +
        'is far above any module reverse-current rating. Every string needs its own fuse, or a ' +
        'fused combiner, before the tracker.' },
  };

  /* ---- copied from block.mjs: the inverter class ---- */
  const INVERTER_CLASS = { id:'INV352', label:'352 kVA class 1500 V string inverter', S_kVA_at_30C:352,
    S_kVA_at_40C:320, S_kVA_at_50C:295, max_pv_input_voltage_V:1500, mppt_min_V:500, mppt_max_V:1500,
    startup_V:550, width_m:1.136, depth_m:0.361 };

  /* ---- copied from block.mjs: every declared input ---- */
  const INPUTS = [
    { key:'block_id', label:'block id', kind:'text', default:'B1' },
    { key:'module_class', label:'module class', kind:'choice', choices:['C495', 'C660'], default:'C495' },
    { key:'strings_per_inverter', label:'strings per inverter', unit:'strings', kind:'int', min:1, max:30, step:1, default:24 },
    { key:'modules_per_string', label:'modules per string', unit:'modules', kind:'int', min:1, max:40, step:1, default:30 },
    { key:'arrangement', label:'inverter DC arrangement', kind:'choice', choices:['12x2', '6x5', 'auto'], default:'auto' },
    { key:'table_format', label:'table format', kind:'choice', choices:['1-string-2-tier', '1-string-1-tier', '2-string-2-tier'], default:'1-string-2-tier' },
    { key:'tables_per_row', label:'tables per row', unit:'tables', kind:'int', min:1, max:12, step:1, default:4 },
    { key:'row_pitch_m', label:'row pitch', unit:'m', kind:'number', min:3, max:20, step:0.1, default:9.0 },
    { key:'table_gap_m', label:'gap between tables in a row', unit:'m', kind:'number', min:0, max:10, step:0.1, default:1.0 },
    { key:'module_gap_m', label:'gap between modules', unit:'m', kind:'number', min:0, max:0.2, step:0.005, default:0.02 },
    { key:'tier_gap_m', label:'gap between tiers', unit:'m', kind:'number', min:0, max:0.5, step:0.005, default:0.02 },
    { key:'inverter_position', label:'inverter position', kind:'choice', choices:['west-centre', 'east-centre', 'south-centre', 'north-centre', 'west-quarter', 'typed'], default:'west-centre' },
    { key:'inverter_xy', label:'inverter x,y when typed', unit:'m', kind:'pair', default:null },
    { key:'inverter_standoff_m', label:'inverter standoff from the block', unit:'m', kind:'number', min:1, max:60, step:0.5, default:6.0 },
    { key:'corridor_offset_m', label:'gathering corridor offset from the row ends', unit:'m', kind:'number', min:0.5, max:20, step:0.5, default:3.0 },
    { key:'corridor_lane_pitch_m', label:'lane pitch in the gathering corridor', unit:'m', kind:'number', min:0, max:1, step:0.01, default:0.12 },
    { key:'pairing', label:'string pairing on a tracker', kind:'choice', choices:['long-short', 'sequential'], default:'long-short' },
    { key:'home_separation_m', label:'separation of the two home-run conductors', unit:'m', kind:'number', min:0, max:1, step:0.01, default:0.1 },
    { key:'ambient_min_C', label:'lowest expected ambient', unit:'C', kind:'number', min:-40, max:20, step:0.5, default:-10 },
    { key:'cold_allowance_K', label:'allowance added to the lowest ambient for the cold design temperature', unit:'K', kind:'number', min:0, max:20, step:1, default:10 },
    { key:'hot_cell_C', label:'hot design cell temperature', unit:'C', kind:'number', min:40, max:90, step:1, default:70 },
    { key:'bifacial_factor', label:'bifacial current factor on Isc', kind:'number', min:1, max:1.3, step:0.01, default:1.1 },
    { key:'design_current_factor', label:'design current factor on Isc', kind:'number', min:1, max:1.5, step:0.05, default:1.25 },
    { key:'module_max_series_fuse_A', label:'module maximum series fuse rating', unit:'A', kind:'number', min:5, max:40, step:1, default:30 },
    { key:'inputs_block_reverse_current', label:'inverter inputs confirmed to block reverse current', kind:'choice', choices:['yes','unconfirmed'], default:'unconfirmed' },
  ];
  const DEFAULTS = Object.fromEntries(INPUTS.map((i) => [i.key, i.default]));

  /* ---- copied from block.mjs: the single-string component ---- */
  function stringComponent(cfg) {
    const { modules_per_string, tiers, cols, mod, module_gap_m, tier_gap_m } = cfg;
    const pitchX = mod.width_m + module_gap_m;
    const pitchY = mod.length_m + tier_gap_m;
    const modules = [];
    for (let j = 0; j < modules_per_string; j++) {
      const tier = tiers === 1 ? 0 : Math.floor(j / cols);
      const within = j - tier * cols;
      const col = tier % 2 === 0 ? within : cols - 1 - within;
      const x = col * pitchX;
      const y = tier * pitchY;
      modules.push({ j, tier, col,
        rect: [r(x), r(y), r(mod.width_m), r(mod.length_m)],
        box: { minus: [r(x + mod.width_m * 0.35), r(y + mod.length_m * 0.5)],
               plus: [r(x + mod.width_m * 0.65), r(y + mod.length_m * 0.5)] } });
    }
    const links = [];
    for (let j = 0; j < modules_per_string - 1; j++) links.push({ j, from: modules[j].box.plus, to: modules[j + 1].box.minus });
    return { modules, links, start: modules[0].box.minus, end: modules[modules_per_string - 1].box.plus,
      width_m: r((cols - 1) * pitchX + mod.width_m), depth_m: r((tiers - 1) * pitchY + mod.length_m) };
  }

  /* ---- copied from block.mjs: the build ---- */
  function buildBlock(typed = {}) {
    const typedKeys = new Set(Object.keys(typed).filter((k) => typed[k] !== undefined && typed[k] !== null));
    const I = { ...DEFAULTS, ...Object.fromEntries([...typedKeys].map((k) => [k, typed[k]])) };
    const st = (...keys) => (keys.every((k) => typedKeys.has(k)) ? 'TYPED' : 'ASSUMED');
    const B = I.block_id;
    const mod = MODULE_CLASSES[I.module_class];
    if (!mod) throw new Error(`unknown module class ${I.module_class}`);
    const N = I.strings_per_inverter;
    const M = I.modules_per_string;
    const arrKey = I.arrangement === 'auto' ? (N <= 24 ? '12x2' : '6x5') : I.arrangement;
    const arr = ARRANGEMENTS[arrKey];
    if (!arr) throw new Error(`unknown arrangement ${arrKey}`);
    if (N > arr.inputs) throw new Error(`${N} strings will not fit ${arr.label}`);
    const fmt = I.table_format;
    const stringsPerTable = fmt === '2-string-2-tier' ? 2 : 1;
    const tiers = fmt === '1-string-1-tier' ? 1 : 2;
    const colsPerString = fmt === '1-string-2-tier' ? Math.ceil(M / 2) : M;
    const tiersPerString = fmt === '1-string-2-tier' ? 2 : 1;
    const comp = stringComponent({ modules_per_string: M, tiers: tiersPerString, cols: colsPerString,
      mod, module_gap_m: I.module_gap_m, tier_gap_m: I.tier_gap_m });
    const pitchY = mod.length_m + I.tier_gap_m;
    const tableWidth = comp.width_m;
    const tableDepth = (tiers - 1) * pitchY + mod.length_m;
    const nTables = Math.ceil(N / stringsPerTable);
    const tablesPerRow = Math.min(I.tables_per_row, nTables);
    const nRows = Math.ceil(nTables / tablesPerRow);
    const rowPitch = Math.max(I.row_pitch_m, tableDepth + 0.5);
    const strings = [];
    for (let i = 0; i < N; i++) {
      const t = Math.floor(i / stringsPerTable);
      const slotInTable = i % stringsPerTable;
      const row = Math.floor(t / tablesPerRow);
      const col = t % tablesPerRow;
      const ox = col * (tableWidth + I.table_gap_m);
      const oy = row * rowPitch + (stringsPerTable === 2 ? slotInTable * pitchY : 0);
      strings.push({ i, table: t, row, col, ox, oy, tierBase: stringsPerTable === 2 ? slotInTable : 0 });
    }
    const blockX0 = 0;
    const blockX1 = tablesPerRow * tableWidth + (tablesPerRow - 1) * I.table_gap_m;
    const blockY0 = 0;
    const blockY1 = (nRows - 1) * rowPitch + tableDepth;
    const midX = (blockX0 + blockX1) / 2;
    const midY = (blockY0 + blockY1) / 2;
    const so = I.inverter_standoff_m;
    let inv;
    switch (I.inverter_position) {
      case 'east-centre': inv = [blockX1 + so, midY]; break;
      case 'south-centre': inv = [midX, blockY0 - so]; break;
      case 'north-centre': inv = [midX, blockY1 + so]; break;
      case 'west-quarter': inv = [blockX0 - so, blockY0 + (blockY1 - blockY0) * 0.25]; break;
      case 'typed': inv = I.inverter_xy ? [I.inverter_xy[0], I.inverter_xy[1]] : [blockX0 - so, midY]; break;
      default: inv = [blockX0 - so, midY];
    }
    const [invX, invY] = inv;
    const corridorX = invX <= midX ? blockX0 - I.corridor_offset_m : blockX1 + I.corridor_offset_m;
    const invW = INVERTER_CLASS.width_m;
    const invD = INVERTER_CLASS.depth_m;
    const faceY = invY - invD / 2;
    const nInputs = arr.inputs;
    const trackers = [];
    const inputsById = new Map();
    for (let t = 0; t < arr.trackers; t++) {
      const tr = { id: `${B}.INV.T${p2(t + 1)}`, t, inputs: [] };
      for (let a = 0; a < arr.inputs_per_tracker; a++) {
        const idx = a * arr.trackers + t;
        const x = invX - invW / 2 + ((idx + 1) * invW) / (nInputs + 1);
        const id = `${tr.id}.in${a + 1}`;
        const input = { id, tracker: t, a, order: idx,
          terminals: { plus: { id: `${id}+`, xy: [r(x + 0.012), r(faceY)] },
                       minus: { id: `${id}-`, xy: [r(x - 0.012), r(faceY)] } },
          used_by: null, lod: 'box' };
        tr.inputs.push(input);
        inputsById.set(id, input);
      }
      trackers.push(tr);
    }
    const slots = [];
    for (let a = 0; a < arr.inputs_per_tracker; a++) for (let t = 0; t < arr.trackers; t++) slots.push(trackers[t].inputs[a]);
    const provisional = (s) => { const bx = s.ox + comp.start[0], by = s.oy + comp.start[1];
      return Math.abs(corridorX - bx) + Math.abs(invY - by) + Math.abs(invX - corridorX); };
    for (const s of strings) s.prov = provisional(s);
    const order = [...strings];
    if (I.pairing === 'long-short') order.sort((a, b) => b.prov - a.prov || a.i - b.i);
    let lo = 0, hi = order.length - 1;
    const taken = [];
    for (let k = 0; k < slots.length && lo <= hi; k++) {
      const a = slots[k].a;
      const s = I.pairing === 'long-short' && a % 2 === 1 ? order[hi--] : order[lo++];
      taken.push([slots[k], s]);
    }
    for (const [slot, s] of taken) { slot.used_by = `${B}.S${p2(s.i + 1)}`; s.input = slot; }
    const modules = [];
    const conductors = [];
    const outStrings = [];
    for (const s of strings) {
      const sid = `${B}.S${p2(s.i + 1)}`;
      const sMods = comp.modules.map((m) => {
        const mid = `${sid}.M${p2(m.j + 1)}`;
        const rec = { id: mid, string: s.i, j: m.j, tier: m.tier + s.tierBase, col: m.col,
          rect: [r(s.ox + m.rect[0]), r(s.oy + m.rect[1]), m.rect[2], m.rect[3]],
          box: { id: `${mid}.box`,
            plus: { id: `${mid}.box+`, xy: [r(s.ox + m.box.plus[0]), r(s.oy + m.box.plus[1])] },
            minus: { id: `${mid}.box-`, xy: [r(s.ox + m.box.minus[0]), r(s.oy + m.box.minus[1])] } },
          alias: `block.string[${s.i}].module[${m.j}]`, lod: 'module' };
        modules.push(rec); return rec; });
      for (const l of comp.links) {
        const from = sMods[l.j].box.plus, to = sMods[l.j + 1].box.minus;
        const pts = dedupe([from.xy, to.xy]);
        conductors.push({ id: `${sid}.L${p2(l.j + 1)}`, kind: 'link', string: s.i, from: from.id, to: to.id,
          polyline: pts, length_m: r(polyLength(pts)), reach: r(dist(from.xy, to.xy)),
          alias: `block.string[${s.i}].link[${l.j}]`, lod: 'string' });
      }
      const laneSign = corridorX <= midX ? -1 : +1;
      const laneX = corridorX + laneSign * s.input.order * I.corridor_lane_pitch_m;
      const sep = I.home_separation_m / 2;
      const ends = [
        { pole: 'plus', sign: '+', box: sMods[M - 1].box.plus, term: s.input.terminals.plus, off: +sep },
        { pole: 'minus', sign: '-', box: sMods[0].box.minus, term: s.input.terminals.minus, off: -sep },
      ];
      const homeRuns = [];
      for (const e of ends) {
        const [bx, by] = e.box.xy, [tx, ty] = e.term.xy, gx = laneX + e.off;
        const pts = dedupe([[bx, by], [r(gx), by], [r(gx), r(ty)], [tx, ty]]);
        const hr = { id: `${sid}.HR${e.sign}`, kind: 'home_run', pole: e.pole, string: s.i,
          from: e.box.id, to: e.term.id, input: s.input.id, tracker: s.input.tracker,
          polyline: pts, length_m: r(polyLength(pts)), reach: r(dist([bx, by], [tx, ty])),
          alias: `block.string[${s.i}].home.${e.pole}`, lod: 'block' };
        conductors.push(hr); homeRuns.push(hr);
      }
      outStrings.push({ id: sid, index: s.i, alias: `block.string[${s.i}]`,
        placement: { table: s.table, row: s.row, col: s.col, tier_base: s.tierBase, tiers: tiersPerString,
          cols: colsPerString, origin: [r(s.ox), r(s.oy)],
          outline: [r(s.ox), r(s.oy), comp.width_m, r(comp.depth_m)] },
        tracker: s.input.tracker, input: s.input.id, modules: sMods.map((m) => m.id),
        home_runs: homeRuns.map((h) => h.id),
        home_run_length_m: r(homeRuns[0].length_m + homeRuns[1].length_m), lod: 'string' });
    }
    const T_cold = I.ambient_min_C + I.cold_allowance_K;
    const T_hot = I.hot_cell_C;
    const bVoc = mod.beta_Voc_pct_per_K / 100;
    const gVmp = mod.gamma_Vmp_pct_per_K / 100;
    const Voc_stc = M * mod.Voc_V;
    const Voc_cold = M * mod.Voc_V * (1 + bVoc * (T_cold - 25));
    const Vmp_stc = M * mod.Vmp_V;
    const Vmp_hot = M * mod.Vmp_V * (1 + gVmp * (T_hot - 25));
    const Imp = mod.Imp_A, Isc = mod.Isc_A;
    const I_design = I.design_current_factor * I.bifacial_factor * Isc;
    const P_string = M * mod.Vmp_V * mod.Imp_A;
    const P_block = N * P_string;
    const perTracker = new Map();
    for (let t = 0; t < arr.trackers; t++) perTracker.set(t, 0);
    for (const s of outStrings) perTracker.set(s.tracker, perTracker.get(s.tracker) + 1);
    const maxStringsOnATracker = Math.max(...perTracker.values());
    const minStringsOnATracker = Math.min(...perTracker.values());
    const I_tracker = maxStringsOnATracker * I_design;
    const Isc_tracker = maxStringsOnATracker * I.bifacial_factor * Isc;
    /* Fuses rest on the strings ACTUALLY paralleled on the fullest tracker, never on the
       nominal strings-in-parallel of the arrangement. */
    const Np = maxStringsOnATracker;
    const Np_nominal = arr.strings_in_parallel_per_tracker;
    const fuseRating = I.module_max_series_fuse_A;
    const faultNoBackfeed = (Np - 1) * I.design_current_factor * Isc;
    const countRuleFires = Np >= 3;
    const currentRuleFires = faultNoBackfeed > fuseRating;
    const fusesRequired = countRuleFires || currentRuleFires;
    const fuseRuleFired = countRuleFires ? (currentRuleFires ? 'count and current' : 'count') : (currentRuleFires ? 'current' : 'none');
    const backfeedUnconfirmed = I.inputs_block_reverse_current !== 'yes';
    const faultTerm = `(${Np} - 1) x ${I.design_current_factor} x Isc = ${r(faultNoBackfeed, 2)} A`;
    const askMaker = backfeedUnconfirmed
      ? ' The inverter inputs are NOT confirmed to block reverse current, so the backfeed contribution to a faulted string is unknown and no maker publishes it: ASK THE INVERTER MAKER. That term is separate from the parallel-string term above and can only make the case for fuses stronger, never weaker.'
      : ' The inverter inputs are declared to block reverse current, so the parallel-string term above is the whole of the fault current.';
    const fuseWords = (countRuleFires
      ? `STRING FUSES ARE REQUIRED. ${Np} strings sit in parallel on the fullest tracker and the COUNT rule fires at three or more: the healthy strings can drive ${faultTerm} into a faulted one, against a ${fuseRating} A module maximum series fuse rating. Every string needs its own fuse, or a fused combiner, ahead of the tracker.` + (currentRuleFires ? ' The CURRENT rule fires on the same block.' : '')
      : currentRuleFires
        ? `STRING FUSES ARE NOT REQUIRED by the count rule - only ${Np} strings are paralleled on the fullest tracker - but the CURRENT rule fires: ${faultTerm} is above the ${fuseRating} A module maximum series fuse rating, so fuses are needed on that term.`
        : `STRING FUSES ARE NOT REQUIRED on the parallel-string term. ${Np} strings are paralleled on the fullest tracker, so the count rule (three or more) does not fire, and ${faultTerm} stays at or below the ${fuseRating} A module maximum series fuse rating, so the current rule does not fire either.`)
      + (Np === Np_nominal ? '' : ` The ${arr.label} arrangement would nominally hold ${Np_nominal} strings on a tracker; this block only fills ${Np}, and the verdict follows the actual count.`)
      + askMaker;
    const otherKey = arrKey === '12x2' ? '6x5' : '12x2';
    const otherArr = ARRANGEMENTS[otherKey];
    const faultOther = (otherArr.strings_in_parallel_per_tracker - 1) * I.design_current_factor * Isc;
    const kWp = P_block / 1000;
    const insulation = { clause: 'IEC 62446-1:2016, 6.7.2 and Table 3', value_Mohm: 1, test_V: 500 };
    const V = [];
    const push = (label, value, unit, limit, verdict, status, note) =>
      V.push({ label, value: typeof value === 'number' ? r(value, 2) : value, unit, limit, verdict, status, note });
    push('string Voc at STC', Voc_stc, 'V', INVERTER_CLASS.max_pv_input_voltage_V,
      Voc_stc <= 1500 ? 'pass' : 'fail', st('modules_per_string', 'module_class'), `${M} x ${mod.Voc_V} V`);
    push(`string Voc at the cold design temperature (${r(T_cold, 1)} C)`, Voc_cold, 'V',
      INVERTER_CLASS.max_pv_input_voltage_V, Voc_cold <= 1500 ? 'pass' : 'fail',
      st('ambient_min_C', 'cold_allowance_K', 'modules_per_string'),
      `lowest ambient ${I.ambient_min_C} C plus a ${I.cold_allowance_K} K allowance; beta_Voc ${mod.beta_Voc_pct_per_K} %/K`);
    push('margin to the 1500 V limit at the cold design temperature', 1500 - Voc_cold, 'V', 0,
      1500 - Voc_cold >= 0 ? 'pass' : 'fail', st('ambient_min_C', 'cold_allowance_K'), null);
    push('string Vmp at STC', Vmp_stc, 'V', `${INVERTER_CLASS.mppt_min_V}-${INVERTER_CLASS.mppt_max_V}`,
      Vmp_stc >= 500 && Vmp_stc <= 1500 ? 'pass' : 'fail', st('modules_per_string', 'module_class'), null);
    push(`string Vmp at the hot design cell temperature (${T_hot} C)`, Vmp_hot, 'V',
      INVERTER_CLASS.mppt_min_V, Vmp_hot >= INVERTER_CLASS.mppt_min_V ? 'pass' : 'fail',
      st('hot_cell_C', 'modules_per_string'), 'against the MPPT minimum');
    push('string Imp at STC', Imp, 'A', null, null, st('module_class'), null);
    push('string Isc at STC', Isc, 'A', null, null, st('module_class'), null);
    push('string design current, factor x bifacial factor x Isc', I_design, 'A', null, null,
      st('design_current_factor', 'bifacial_factor', 'module_class'),
      `${I.design_current_factor} x ${I.bifacial_factor} x ${Isc} A`);
    push('current into each inverter input', I_design, 'A', arr.A_per_input,
      I_design <= arr.A_per_input ? 'pass' : 'fail', st('design_current_factor', 'bifacial_factor'), 'one string per input');
    push('current into each tracker', I_tracker, 'A', arr.A_per_tracker,
      I_tracker <= arr.A_per_tracker ? 'pass' : 'fail', st('design_current_factor', 'bifacial_factor'),
      `${maxStringsOnATracker} strings on the fullest tracker`);
    push('Isc into each tracker', Isc_tracker, 'A', arr.Isc_per_tracker_A,
      Isc_tracker <= arr.Isc_per_tracker_A ? 'pass' : 'fail', st('bifacial_factor'), null);
    push('DC power per string at STC', P_string / 1000, 'kW', null, null, st('module_class', 'modules_per_string'), null);
    push('DC power of the block at STC', kWp, 'kW', null, null,
      st('module_class', 'modules_per_string', 'strings_per_inverter'),
      `${N} strings x ${M} modules x ${r(mod.Vmp_V * mod.Imp_A, 3)} W`);
    push('DC/AC ratio against 352 kVA at 30 C', kWp / INVERTER_CLASS.S_kVA_at_30C, 'ratio', null, null,
      st('module_class', 'strings_per_inverter'), null);
    push('DC/AC ratio against 320 kVA at 40 C', kWp / INVERTER_CLASS.S_kVA_at_40C, 'ratio', null, null,
      st('module_class', 'strings_per_inverter'), null);
    push('DC/AC ratio against 295 kVA at 50 C', kWp / INVERTER_CLASS.S_kVA_at_50C, 'ratio', null, null,
      st('module_class', 'strings_per_inverter'), null);
    push('strings in parallel on the fullest tracker', Np, 'strings', Np_nominal, null,
      st('strings_per_inverter', 'arrangement'),
      `actual count on this block; the ${arr.label} arrangement would nominally hold ${Np_nominal}`);
    push('fault current into one string, inputs DO block reverse current', faultNoBackfeed, 'A', fuseRating,
      faultNoBackfeed <= fuseRating ? 'pass' : 'fail', st('module_max_series_fuse_A', 'design_current_factor'),
      `(${Np} - 1) x ${I.design_current_factor} x Isc against the ${fuseRating} A module maximum series fuse rating; rule fired: ${fuseRuleFired}`);
    push('fault current into one string, inputs do NOT block reverse current', faultNoBackfeed, 'A', fuseRating,
      backfeedUnconfirmed ? null : (faultNoBackfeed <= fuseRating ? 'pass' : 'fail'),
      st('inputs_block_reverse_current'),
      backfeedUnconfirmed
        ? 'the inverter backfeed contribution must be added and no maker publishes it, so the verdict is null by rule rather than invented: ASK THE INVERTER MAKER.'
        : 'the inputs are declared to block reverse current, so this equals the term above.');
    push(`the same check in the ${otherArr.label} world`, faultOther, 'A', mod.Ir_A,
      faultOther <= mod.Ir_A ? 'pass' : 'fail', 'ASSUMED', otherArr.fuse_words);
    push('insulation resistance threshold for this block', insulation.value_Mohm, 'Mohm', insulation.value_Mohm,
      null, 'ASSUMED',
      `${insulation.clause}: system voltage above 500 V, test at ${insulation.test_V} V d.c. ` +
      `Block is ${r(kWp, 2)} kWp; the clause is measured per string or sub-array, not across the block.`);
    const hrs = conductors.filter((c) => c.kind === 'home_run');
    const hrLen = hrs.map((h) => h.length_m);
    push('total home-run conductor', hrLen.reduce((a, b) => a + b, 0), 'm', null, null, st('inverter_position'), null);
    push('longest home run', Math.max(...hrLen), 'm', null, null, st('inverter_position'), null);
    push('shortest home run', Math.min(...hrLen), 'm', null, null, st('inverter_position'), null);
    return {
      schema: 'solar-block/v1', version: 'solar-block/1.0.0', id: B, inputs: I, typed: [...typedKeys],
      module_class: mod, inverter_class: INVERTER_CLASS,
      arrangement: { ...arr, strings_fitted: N, inputs_free: arr.inputs - N,
        strings_on_fullest_tracker: maxStringsOnATracker, strings_on_emptiest_tracker: minStringsOnATracker,
        strings_in_parallel_per_tracker: Np,
        strings_in_parallel_nominal: Np_nominal,
        module_max_series_fuse_A: fuseRating,
        fuses_required: fusesRequired,
        fuse_rule_fired: fuseRuleFired,
        ask_the_inverter_maker: backfeedUnconfirmed,
        fuse_words: fuseWords },
      geometry: { bbox: [r(blockX0), r(blockY0), r(blockX1), r(blockY1)], rows: nRows, tables: nTables,
        tables_per_row: tablesPerRow, table_format: fmt, table_width_m: tableWidth, table_depth_m: r(tableDepth),
        row_pitch_m: r(rowPitch), corridor_x: r(corridorX), corridor_lane_pitch_m: I.corridor_lane_pitch_m,
        corridor_far_x: r(corridorX + (corridorX <= midX ? -1 : 1) * (N - 1) * I.corridor_lane_pitch_m) },
      inverter: { id: `${B}.INV`, xy: [r(invX), r(invY)],
        rect: [r(invX - invW / 2), r(invY - invD / 2), r(invW), r(invD)],
        trackers, inputs: [...inputsById.values()], lod: 'block' },
      strings: outStrings, modules, conductors,
      counts: { strings: outStrings.length, modules: modules.length,
        links: conductors.filter((c) => c.kind === 'link').length, home_runs: hrs.length,
        inputs: nInputs, inputs_used: [...inputsById.values()].filter((i2) => i2.used_by).length },
      values: V,
      notes: [ fuseWords,
        'Metres throughout. The ground plan is a plan projection; tilt is not modelled.',
        'Every home run is a three-leg orthogonal route: along the row end, up the gathering ' +
        'corridor, then onto its own named inverter input terminal.',
        'DEVELOPMENT ENVIRONMENT. Not a warranted design.' ],
    };
  }
  /* ---- end of the copy from block.mjs ---- */

  // ===== THE BLOCK AS THIS ENGINE'S SHAPE DATA ===================================================
  // FINE PENCIL, NO FILLS. Module outlines are the thinnest line on the page; each string carries its
  // own outline so twenty-four of them can be told apart at macro; the two home runs are red for + and
  // light for −, and each one ends ON ITS OWN NAMED INVERTER INPUT TERMINAL, which is drawn and named.
  // MACRO BY DEFAULT: the whole block is laid out at once and the view opens on all of it; the module
  // rectangles, the module labels and the input names only come up as the reader zooms in.
  // THE VALUES LIST IS NOT WRITTEN ON THE DRAWING. It is the answer, and it belongs in the window.
  function blockDrawing(BK) {
    const shapes = [], marks = [], words = [], conns = [], terminals = [];
    const put = o => { if (o.pot === undefined) o.pot = 0; if (o.node === undefined) o.node = null; shapes.push(o); return o; };
    const poly = (role, o, pts, extra) => put(Object.assign({ role, order:o, pot:0, pts, weight:1 }, extra || {}));
    const box = (role, o, x0, y0, x1, y1, extra) => poly(role, o, [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]], extra);
    const nS = Math.max(1, BK.strings.length);
    const byId = {};
    for (const s of BK.strings) byId[s.index] = s;

    // ---- the inverter, with its twenty-four named input pairs
    const ir = BK.inverter.rect;
    box('inverter', 0, ir[0], ir[1], ir[0] + ir[2], ir[1] + ir[3], { fill:SHAPE_FILL, node:'inv' });
    marks.push({ x:ir[0] + ir[2] / 2, y:ir[1] - 1.1, text:BK.inverter.id + '  ' + BK.inverter_class.label,
      size:11, colour:SHAPE_INK, minPx:0, mid:true, rank:0 });
    for (const inp of BK.inverter.inputs) {
      const P = inp.terminals.plus.xy, Mn = inp.terminals.minus.xy;
      poly('terminal', 0, [[P[0], P[1]], [P[0], P[1] - 0.22]], { node:inp.id, pot:1 });
      put({ role:'terminal', order:0, pot:1, node:inp.id, pts:[[P[0], P[1]]], dot:0.05 });
      poly('terminal', 0, [[Mn[0], Mn[1]], [Mn[0], Mn[1] - 0.22]], { node:inp.id, pot:0 });
      put({ role:'terminal', order:0, pot:0, node:inp.id, pts:[[Mn[0], Mn[1]]], dot:0.05 });
      terminals.push({ id:inp.terminals.plus.id, x:P[0], y:P[1], kind:'inv+', module:0 });
      terminals.push({ id:inp.terminals.minus.id, x:Mn[0], y:Mn[1], kind:'inv-', module:0 });
      marks.push({ x:(P[0] + Mn[0]) / 2, y:P[1] - 0.40,
        text:inp.id.replace(BK.id + '.INV.', '') + (inp.used_by ? ' \u2190 ' + inp.used_by.replace(BK.id + '.', '') : ' free'),
        size:9, colour:SHAPE_EDGE, minPx:34, mid:true, rank:2, dodge:true });
    }

    // ---- every string: its own outline, its modules, its links, its two home runs
    for (const s of BK.strings) {
      const ol = s.placement.outline, o = (s.index + 1) / nS;
      box('module', o, ol[0] - 0.12, ol[1] - 0.12, ol[0] + ol[2] + 0.12, ol[1] + ol[3] + 0.12,
        { node:s.id, weight:0.9, says:s.id + ', ' + s.modules.length + ' modules in series onto ' + s.input });
      marks.push({ x:ol[0] + ol[2] / 2, y:ol[1] + ol[3] + 0.42, text:s.id.replace(BK.id + '.', ''),
        size:10, colour:SHAPE_INK, minPx:16, mid:true, rank:1, dodge:true });
    }
    for (const m of BK.modules) {
      const o = (m.string + 1) / nS;
      box('module', o, m.rect[0], m.rect[1], m.rect[0] + m.rect[2], m.rect[1] + m.rect[3],
        { node:m.id, weight:0.7, lod:m.lod });
    }
    for (const cd of BK.conductors) {
      const o = (cd.string + 1) / nS;
      if (cd.kind === 'link') {
        poly('lead', o, cd.polyline, { node:cd.id, pot:o, plus:false, weight:0.7, hit:true,
          from:cd.from, to:cd.to, metres:cd.length_m,
          says:cd.from + ' to ' + cd.to + ', ' + cd.length_m.toFixed(2) + ' m' });
      } else {
        const plus = cd.pole === 'plus';
        poly('cable', o, cd.polyline, { node:cd.id, pot:plus ? 1 : 0, plus, weight:plus ? 1.2 : 0.9, hit:true,
          from:cd.from, to:cd.to, metres:cd.length_m,
          says:cd.id + ': ' + cd.length_m.toFixed(1) + ' m onto ' + cd.to });
        conns.push({ node:cd.id, from:cd.from, to:cd.to, needed:cd.length_m, pair:null, reaches:true, home:true });
      }
    }

    // ---- the words. The key and the owner's own sentence, pinned to the screen, never in the picture.
    words.push({ pinned:3, note:true, off:true,
      text:BK.counts.strings + ' strings of ' + BK.strings[0].modules.length + ' modules in series \u00b7 '
        + BK.counts.modules + ' modules \u00b7 ' + BK.counts.home_runs + ' home runs onto '
        + BK.counts.inputs_used + ' of ' + BK.counts.inputs + ' named inverter inputs',
      small:BK.counts.strings + ' strings \u00b7 ' + BK.counts.modules + ' modules \u00b7 '
        + BK.counts.home_runs + ' home runs \u00b7 ' + BK.counts.inputs_used + '/' + BK.counts.inputs + ' inputs' });
    words.push({ pinned:4, danger:true, text:DEV_WARNING, small:DEV_WARNING_SHORT });
    words.push({ pinned:1, note:true, narrow:true,
      text:'red +, light \u2212 \u00b7 every string shows, and every home run lands on its own named input' });
    words.push({ pinned:0, note:true, wide:true,
      text:'all ' + BK.counts.strings + ' strings per inverter are drawn, each with its own two home runs onto its own named input; '
        + 'the numbers are in the window, not on the drawing',
      small:'all ' + BK.counts.strings + ' strings show, each onto its own named input' });

    // ---- measured, then laid out the way the row is: as tall as the disc, as wide as it needs to be
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    const see = (x, y) => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; };
    for (const s of shapes) { if (s.pts) for (const p of s.pts) see(p[0], p[1]); }
    for (const m of marks) see(m.x, m.y);
    for (const t2 of terminals) see(t2.x, t2.y);
    const S = 1.85 / Math.max(0.5, y1 - y0), my = (y0 + y1) / 2, mx = x0;
    const U = (x, y) => [(x - mx) * S - 0.95, (y - my) * S];
    for (const s of shapes) { if (s.pts) s.pts = s.pts.map(p => U(p[0], p[1])); if (s.mid) s.mid = U(s.mid[0], s.mid[1]); }
    for (const m of marks) { const u = U(m.x, m.y); m.x = u[0]; m.y = u[1]; }
    for (const t2 of terminals) { const u = U(t2.x, t2.y); t2.x = u[0]; t2.y = u[1]; }
    for (const w of words) { if (w.pinned !== undefined) continue; const u = U(w.x, w.y); w.x = u[0]; w.y = u[1]; }
    for (const s of shapes) s.breaks = [];
    const volts = BK.strings[0].modules.length * BK.module_class.Vmp_V;
    return { kind:'string', shapes, marks, words, conns, terminals, wiring:true, crossings:[], perM:S,
      open:false, g:null, firstModuleX:U(0, 0)[0], volts, volts_open:BK.strings[0].modules.length * BK.module_class.Voc_V,
      earth_node:'earth', bounds:{ x0:U(x0, y0)[0], y0:U(x0, y0)[1], x1:U(x1, y1)[0], y1:U(x1, y1)[1] },
      near:{ x:U(BK.inverter.xy[0], BK.inverter.xy[1])[0], y:U(BK.inverter.xy[0], BK.inverter.xy[1])[1] },
      mPerUnit:1 / S, amps:BK.module_class.Imp_A, front:-1, head:-1, walk:null, t0:0 };
  }

  const key = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  function run(inp) {
    const BK = buildBlock(inp || {});
    const D = blockDrawing(BK);
    // the pseudo string the engine's dot layout and renderer read: the drawing is already made, so
    // nothing here is ever asked to build it a second time.
    const g = { c:{ sheet:(inp && inp.sheet) ? 1 : 0, view:'wiring' }, N:BK.counts.modules, short:[], links:[],
      rows:BK.geometry.rows, cols:BK.geometry.tables_per_row, rowY:[0], order:[], bothNear:true, ret:0,
      row:BK.geometry.bbox[2], lead_m:0, field_m:0, ohm:0, __draw:D };
    D.g = g;
    const V = BK.values;
    const numbers = { strings_per_inverter:BK.counts.strings, modules_per_string:BK.strings[0].modules.length,
      modules_in_the_block:BK.counts.modules, links_between_modules:BK.counts.links,
      home_run_cables:BK.counts.home_runs, inverter_inputs:BK.counts.inputs, inverter_inputs_used:BK.counts.inputs_used,
      inverter_dc_arrangement:BK.arrangement.label, string_fuses_required:BK.arrangement.fuses_required ? 'YES' : 'no, on the parallel-string term only',
      module_class:BK.module_class.label, block_width_m:BK.geometry.bbox[2], block_depth_m:BK.geometry.bbox[3],
      rows_of_tables:BK.geometry.rows, tables:BK.geometry.tables };
    // THE VALUES LIST GOES IN THE ANSWER, not on the picture: label, value, unit, limit and verdict.
    for (const v of V) numbers[key(v.label)] = v.value + (v.unit ? ' ' + v.unit : '')
      + (v.limit !== null && v.limit !== undefined ? ' (limit ' + v.limit + ')' : '')
      + (v.verdict ? ' ' + v.verdict.toUpperCase() : v.limit !== null && v.limit !== undefined ? ' verdict withheld' : '')
      + ' [' + v.status + ']';
    const said = 'ONE COMPLETE INVERTER BLOCK: ' + BK.counts.strings + ' strings of '
      + BK.strings[0].modules.length + ' modules in series, ' + BK.counts.modules + ' modules, '
      + BK.counts.strings + ' strings on one inverter and every one of them drawn - '
      + BK.counts.home_runs + ' home runs, each landing on its own named inverter input ('
      + BK.counts.inputs_used + ' of ' + BK.counts.inputs + ' inputs used, ' + BK.arrangement.label + '). '
      + 'Block ' + BK.geometry.bbox[2].toFixed(1) + ' m by ' + BK.geometry.bbox[3].toFixed(1) + ' m over '
      + BK.geometry.rows + ' rows of ' + BK.geometry.tables_per_row + ' tables. '
      + V[12].value + ' kW at STC against the ' + BK.inverter_class.S_kVA_at_30C + ' kVA class. '
      + BK.notes[0];
    return { connections:null, numbers, said,
      electrical_order:BK.strings.map(s => s.id.replace(BK.id + '.', '') + '\u2192' + s.input.replace(BK.id + '.INV.', '')).join('  '),
      how:'Every number and every point here comes from the tested library solar-block/1.0.0 '
        + '(block.mjs, 68 of 68 assertions), copied into this cartridge unchanged; only the conversion '
        + 'to this engine\u2019s shape data is new. Metres, volts, amps, watts. The ground plan is a plan '
        + 'projection and tilt is not modelled. ' + BK.notes[2] + ' '
        + 'Everything is ASSUMED unless every input feeding it was typed, and each line of the values '
        + 'list says which it is. The module class, the cold and hot design temperatures, the bifacial '
        + 'and design-current factors and the geometry are all inputs: change any of them and the checks '
        + 'move. The one number the model cannot close is the inverter backfeed contribution to a string '
        + 'fault, which no maker publishes, so that verdict is returned null rather than invented. '
        + BK.notes[3], block:g, values:V, inputs_used:Object.assign({}, BK.inputs) };
  }
  // WHAT A READER MAY TURN: every input the library declares, made into a box.
  const BOXES = INPUTS.filter(i => i.kind !== 'pair' && i.kind !== 'text').map(i => {
    const b = { key:i.key, label:i.label };
    if (i.unit) b.unit = i.unit;
    if (i.kind === 'choice') { b.kind = 'choice'; b.choices = i.choices.map(c => [c, c]); }
    else { b.kind = 'number'; if (i.min !== undefined) b.min = i.min; if (i.max !== undefined) b.max = i.max;
      b.step = i.step === undefined ? 1 : i.step; }
    return b; });
  F.register('block', 'STRINGS', run, BOXES);
  F.block = { buildBlock, blockDrawing, INPUTS, DEFAULTS, MODULE_CLASSES, ARRANGEMENTS, INVERTER_CLASS };
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
const FIRE_DRAWS = ['site-pulse', 'network', 'string', 'block'];          // the commands whose network the dots draw
const CHIPS_SHOWN = 8;                                   // the best few as chips, the way the wafer pins its best few
const PICKER_SHOWN = 100;                                // the pinned hundred in the picker; the rest by typing
// THE STRING TESTS live in this file: they are geometry, they need no bench run, and they are shown first.
const STRING_TESTS = [
  { family:'STRINGS', pin:-12, name:'A tracker, two in portrait, along and back', chip:'2P along-and-back', sentence:'Single axis tracker, two modules in portrait, out along the lower row and back along the upper: both ends at the near end and no return cable', command:'fire string {"mounting":"tracker","modules_high":2,"routing":"serpentine","turn_alternate_rows":1,"jumpers":1,"lead_plus_m":0.35,"lead_minus_m":0.28}' },
  { family:'STRINGS', pin:-11, name:'A tracker, two in portrait, leapfrog in each row', chip:'2P leapfrog', sentence:'Single axis tracker, two in portrait, every other module on the way out and the rest on the way back inside each row', command:'fire string {"mounting":"tracker","modules_high":2,"routing":"leapfrog","turn_every_second":1,"lead_plus_m":0.84,"lead_minus_m":1.166,"jumpers":1}' },
  { family:'STRINGS', pin:-10, name:'A tracker, two in portrait, one after another', chip:'2P sequential', sentence:'Single axis tracker, two in portrait, each module to the next with a cable to bring the far end home', command:'fire string {"mounting":"tracker","modules_high":2,"routing":"one-after-another","jumpers":1,"lead_plus_m":0.35,"lead_minus_m":0.28}' },
  { family:'STRINGS', pin:-9, name:'Fixed tilt, one in portrait, leapfrog', chip:'1P leapfrog', sentence:'A single row of thirty modules, every other one joined on the way out, the rest on the way back', command:'fire string {"mounting":"fixed","modules_high":1,"routing":"leapfrog"}' },
  { family:'STRINGS', pin:-8, name:'Fixed tilt, one in portrait, one after another', chip:'1P sequential', sentence:'A single row, each module to the next, and one cable the length of the row to bring the far end home', command:'fire string {"mounting":"fixed","modules_high":1,"routing":"one-after-another"}' },
  { family:'STRINGS', pin:-7, name:'Fixed tilt, two in portrait, along and back', chip:'2P fixed U', sentence:'A table two modules high, out along the lower tier and back along the upper: no return cable is laid', command:'fire string {"mounting":"fixed","modules_high":2,"routing":"serpentine","turn_alternate_rows":1,"jumpers":1,"lead_plus_m":0.35,"lead_minus_m":0.28}' },
  { family:'STRINGS', pin:-6, name:'Fixed tilt, three in portrait, along and back', chip:'3P fixed', sentence:'A table three modules high, wired row by row, turning at the end of each', command:'fire string {"mounting":"fixed","modules_high":3,"routing":"serpentine","turn_alternate_rows":1,"jumpers":1,"lead_plus_m":0.35,"lead_minus_m":0.28}' },
  { family:'STRINGS', pin:-5, name:'Fixed tilt, four in portrait, along and back', chip:'4P fixed', sentence:'A table four modules high, wired row by row', command:'fire string {"mounting":"fixed","modules_high":4,"routing":"serpentine","turn_alternate_rows":1,"jumpers":1,"lead_plus_m":0.35,"lead_minus_m":0.28}' },
  { family:'STRINGS', pin:-4, name:'East and west facing, five in portrait each face', chip:'5P east-west', sentence:'Two faces back to back with a ridge between them, five modules in portrait on each, wired row by row', command:'fire string {"mounting":"east-west","modules_high":5,"routing":"serpentine","turn_alternate_rows":1,"jumpers":1,"lead_plus_m":0.35,"lead_minus_m":0.28}' },
  { family:'STRINGS', pin:-3, name:'Fixed tilt landscape, three high', chip:'3L landscape', sentence:'Modules laid on their side, three high: the two junction boxes now sit one above the other', command:'fire string {"mounting":"fixed","orientation":"landscape","modules_high":3,"routing":"serpentine","turn_alternate_rows":1,"jumpers":1,"lead_plus_m":0.35,"lead_minus_m":0.28}' },
  { family:'STRINGS', pin:-2, name:'Fixed tilt landscape, six high', chip:'6L landscape', sentence:'Modules on their side, six high, wired row by row', command:'fire string {"mounting":"fixed","orientation":"landscape","modules_high":6,"routing":"serpentine","turn_alternate_rows":1,"jumpers":1,"lead_plus_m":0.35,"lead_minus_m":0.28}' },
  { family:'STRINGS', pin:-1, name:'Leapfrog turned, every second module end for end', chip:'1P leapfrog turned', sentence:'Turning every second module end for end makes every link the short kind', command:'fire string {"wiring":"leapfrog","turn_every_second":1,"lead_plus_m":0.84,"lead_minus_m":1.166}' },
  { family:'STRINGS', pin:1, name:'One whole inverter block, every string on it', chip:'inverter block', sentence:'Twenty-four strings of thirty modules in series on one inverter: all twenty-four drawn, each with its own two home runs landing on its own named inverter input', command:'fire block {}' },
  { family:'STRINGS', pin:0, name:'A tracker, two in portrait, zigzag between the rows', chip:'2P zigzag', sentence:'Single axis tracker, two in portrait, up one column and along, down the next and along', command:'fire string {"mounting":"tracker","modules_high":2,"routing":"zigzag","jumpers":1,"lead_plus_m":0.84,"lead_minus_m":1.166}' },
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
  if (c && c.chip) return String(c.chip);                 // a name short enough to tell eight presets apart
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
    + '#say.min{height:auto!important;max-height:none;min-height:0;resize:none;width:min(48ch,84vw)} #say.min #saybody{display:none}'
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
    + '#saybody .conns{max-height:11rem;overflow:auto;border:1px solid #1b2030;border-radius:4px;margin:.2rem 0 .5rem}'
    + '#saybody .conns button{display:block;width:100%;text-align:left;background:none;border:0;border-bottom:1px solid #141a26;'
    + 'color:#a8b6c8;font:11px ui-monospace,Menlo,Consolas,monospace;padding:3px 7px;cursor:pointer}'
    + '#saybody .conns button:hover,#saybody .conns button:focus-visible{background:#131a26;color:#eaf6ff;outline:none}'
    + '#saybody .conns button.bad{color:#ffb454}'
    + '#saybody p.danger{color:#ff5a4f;font-weight:600;font-size:12px;letter-spacing:.04em;margin:.1rem 0 .5rem;'
    + 'border:1px solid #5a2620;border-radius:4px;padding:5px 8px;background:#1a0d0b}'
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
      // NEVER OVER THE CHIPS. Collapsed, this window used to sit on top of the row of presets and hide
      // the very things a reader taps next.
      sayEl.style.top = Math.round(Math.max(8, chipsBottom + 8)) + 'px';
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
    if (x !== undefined && x !== null) v[b.key] = x; else if (b.optional) v[b.key] = null;
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
    // A BOX MAY BE EMPTY ON PURPOSE. Some inputs have no honest default; the box is shown, blank, with a
    // hint of what a sensible figure looks like, and the model refuses the figures that depend on it
    // rather than guessing one. That refusal is part of the protocol, not a gap in it.
    const empty = vals[spec.key] === undefined || vals[spec.key] === null;
    if (empty && !spec.optional) continue;
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
      inp.value = empty ? '' : String(vals[spec.key]);
      if (spec.hint) { inp.placeholder = spec.hint; inp.title = spec.hint; }
      let good = empty ? null : vals[spec.key];
      const take = () => { const n = Number(inp.value);
        if (String(inp.value).trim() === '' && spec.optional) { inp.classList.remove('bad'); good = null; delete vals[spec.key]; return true; }
        if (String(inp.value).trim() === '' || !isFinite(n)
            || (spec.min !== undefined && n < spec.min) || (spec.max !== undefined && n > spec.max)) {
          inp.classList.add('bad'); return false; }
        inp.classList.remove('bad'); good = n; vals[spec.key] = n; return true; };
      inp.addEventListener('input', () => { if (take()) later(); });
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); if (take()) goNow(); } });
      inp.addEventListener('blur', () => { if (inp.classList.contains('bad')) { inp.value = good === null ? '' : String(good); inp.classList.remove('bad'); } });
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
    const nodes = [];
    if (out.family === 'STRINGS' || out.family === 'FARM') { const d2 = el('p', 'danger', DEV_WARNING); nodes.push(d2); }
    nodes.push(bold(title), el('p', null, out.said));
    const saidP = nodes[1];
    const leadBox = el('div'); leadBox.append(table(lead.slice(0, 4))); nodes.push(leadBox);
    const hidden = el('div'); hidden.style.display = 'none'; hidden.append(...restBits());
    const more = el('button', 'more', 'more, and show the command'); more.type = 'button';
    more.addEventListener('click', () => { const on = hidden.style.display === 'none';
      hidden.style.display = on ? 'block' : 'none'; more.textContent = on ? 'less' : 'more, and show the command'; });
    // A ROW OF THIRTY MODULES IS WIDER THAN ANY SCREEN. Two presses: the near end, where the inverter and
    // the first modules can be read, and the whole row, which is every one of the thirty at once.
    if (out.name === 'string') { const row = el('div', 'viewrow');
      for (const [words, go] of [['the near end', () => stringNearView()], ['the whole row', () => stringWholeView()],
        ['the modules to scale', () => reFire({ view:'scale' })], ['back to the wiring', () => reFire({ view:'wiring' })]]) {
        const b = el('button', null, words); b.type = 'button';
        b.addEventListener('click', e => { e.stopPropagation(); try { go(); } catch (_) {} }); row.append(b); }
      nodes.push(row);
      // THE CONNECTION LIST IN WORDS, beside the picture: every hop from the inverter's minus terminal
      // round to its plus, in the order the current runs. Touch a line and that one cable lights up.
      if (out.connections) { const list = el('div', 'conns');
        for (const q of out.connections) { const b2 = el('button', null,
            q.from + ' \u2192 ' + q.to + (q.home ? '  (' + q.metres + ' m of site cable)'
              : '  (' + q.needed.toFixed(2) + ' m needed, ' + q.pair.toFixed(2) + ' m of lead'
                + (q.reaches ? '' : q.jumper ? ', ' + q.jumper.toFixed(2) + ' m jumper' : ', DOES NOT REACH') + ')'));
          b2.type = 'button'; if (!q.reaches && !q.jumper) b2.className = 'bad';
          b2.addEventListener('click', e => { e.stopPropagation();
            shapeHover = q.node; if (sldShapes) sldShapes.saying = q.from + ' to ' + q.to; dirty = true;
            try { placeSldNames(); } catch (_) {} });
          list.append(b2); }
        nodes.push(el('p', 'dimtext', 'Every connection, in the order the current runs:'), list); } }
    const orderP = el('p', 'dimtext', out.electrical_order ? 'Electrical order: ' + out.electrical_order : '');
    nodes.push(orderP);
    let boxes = null;
    if (out.boxes && out.boxes.length) { boxes = makeBoxes(out, rec); nodes.push(boxes.wrap); }
    nodes.push(more, hidden);
    open(title, nodes);
    fireLive = { name:out.name, said:saidP, leadBox, hidden, order:orderP, boxes, rec };
  }
  lastFire = { ran:true, name:out.name, family:out.family, numbers:out.numbers };
  try { const fp = FIRE_PROGRAM;
    if (out.name === 'site-pulse' || out.name === 'network' || out.name === 'string' || out.name === 'block') {
      // THE BLOCK IS DRAWN BY THE SAME PASS AS THE STRING. Its drawing is already made and carried on
      // out.block.__draw, so it is handed over as the same kind and nothing downstream changes.
      fp.sld = (out.name === 'string' || out.name === 'block') ? { kind:'string', g:(out.string || out.block) } : out.name === 'network' ? { kind:'network', net:out.net, solved:out.solved, inputs:c0(text) } : c0(text);
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
  if (sldShapes) { sldShapes.front = -1; sldShapes.head = -1; sldShapes.walk = null; sldShapes.t0 = 0; shapeHover = null; }
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
      + '#sldnames span.danger{color:#ff5a4f;font-size:10.5px;font-weight:600;letter-spacing:.05em}'
      // A PINNED LINE MAY WRAP. It is a sentence, not a name, and on a telephone it is longer than the
      // screen; a key that runs off the edge is a key nobody reads.
      + '#sldnames span.pinned{white-space:normal;text-align:center;transform:translate(-50%,-100%);line-height:1.35}'
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
    const out = d.words.map(w => ({ x:w.x, y:w.y, dy:0, dx:0, text:w.text, small:w.small, warn:!!w.warnLine, note:!!w.note, danger:!!w.danger,
      wide:!!w.wide, narrow:!!w.narrow, off:!!w.off, pinned:w.pinned }));
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
  const small = innerWidth < 760;
  // A LINE THAT BELONGS TO ONE SIZE OF SCREEN IS NOT BUILT FOR THE OTHER.
  if (sldNames.some(n => n.wide || n.narrow || n.off)) sldNames = sldNames.filter(n => !n.off && (small ? !n.wide : !n.narrow));
  if (el.childElementCount !== list.length || el.dataset.said !== String(said) || el.dataset.small !== String(small)) {
    el.dataset.said = String(said); el.dataset.small = String(small);
    el.replaceChildren(...list.map(n => { const sp = document.createElement('span');
      sp.textContent = (small && n.small) ? n.small : n.text;
      if (n.danger) sp.className = 'danger'; else if (n.warn) sp.className = 'warn'; else if (n.note) sp.className = 'note';
      else if (n.hover) sp.className = 'said';
      if (n.pinned !== undefined) sp.className += ' pinned'; return sp; }));
  }
  const pinBand = (sldShapes && sldShapes.kind === 'string') ? shapeBand() : null;
  list.forEach((n, i) => { const sp = el.children[i]; if (!sp) return;
    if (n.hover) { sp.style.left = Math.round(innerWidth / 2) + 'px';
      sp.style.top = Math.round(Math.min(innerHeight - 120, innerHeight * 0.80)) + 'px'; return; }
    // A PINNED LINE SITS AT THE FOOT OF THE BAND. Where exactly is settled in one pass afterwards,
    // because these lines WRAP and a stack of guessed heights is a stack of sentences on top of
    // each other, which is what a first attempt at this looked like.
    if (n.pinned !== undefined && pinBand) { sp.style.visibility = '';
      sp.style.left = Math.round((pinBand.left + pinBand.right) / 2) + 'px';
      sp.style.maxWidth = Math.round(Math.min(900, pinBand.right - pinBand.left - 8)) + 'px';
      return; }
    const wx = (n.x + (n.dx || 0)) * R * frac, wy = (n.y + (n.dy || 0)) * R * frac;
    const px0 = Math.round((wx - cx) * zoom + innerWidth / 2), py0 = Math.round(innerHeight / 2 - (wy - cy) * zoom);
    // A WORD OFF THE SCREEN IS NOT LAID OUT. Thirty modules is several screens wide and the browser
    // should not be asked to place what nobody can see; and text is put on whole pixels so it is crisp.
    const bd = (sldShapes && sldShapes.kind === 'string') ? shapeBand(true) : { left:-260, right:innerWidth + 260, top:-60, bottom:innerHeight + 60 };
    if (px0 < bd.left - 6 || px0 > bd.right + 6 || py0 < bd.top - 4 || py0 > bd.bottom + 4) { sp.style.visibility = 'hidden'; return; }
    sp.style.visibility = ''; sp.style.left = px0 + 'px'; sp.style.top = py0 + 'px';
    // A WORD IS NOT ALLOWED UNDER THE WINDOW EITHER, wherever the reader has put it.
    const w2 = sayRect();
    if (w2) { const b2 = sp.getBoundingClientRect();
      if (b2.width > 0 && b2.right > w2.left && b2.left < w2.right && b2.bottom > w2.top && b2.top < w2.bottom) sp.style.visibility = 'hidden'; } });
  // THE PINNED LINES ARE STACKED FROM THE BOTTOM UP, each one measured after it has wrapped.
  if (pinBand) { const pins = [];
    list.forEach((n, i) => { if (n.pinned !== undefined && el.children[i]) pins.push([n.pinned, el.children[i]]); });
    pins.sort((a, b) => a[0] - b[0]);
    let y = pinBand.bottom - 4;
    for (const [, sp] of pins) { sp.style.top = Math.round(y) + 'px'; y -= (sp.offsetHeight || 14) + 2; }
    pinHeight = Math.max(0, pinBand.bottom - 4 - y); }
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
    // each dot goes out at its own moment, so the drawing is uncovered rather than switched off
    if (!S.melt) { S.melt = new Float32Array(m); for (let j = 0; j < m; j++) S.melt[j] = 0.15 + 0.8 * ((j * 2654435761) % 1000) / 1000; }
    const f = (t < 0 || !live) ? -1 : Math.min(1, t / T2);
    sldShapes.front = f;
    // THE NEON FRONT RUNS ON THIS SAME CLOCK. Not a second animation: the head is set here, beside the
    // fuse front, and the shape pass draws it. One head, steady speed, running the ELECTRICAL WALK the
    // model already names - inverter - round through every module to inverter +. An open string is
    // given no head at all, because it carries nothing.
    sldShapes.head = (live && t >= 0) ? ((t / 3.6) % 1) : -1;
    for (let j = 0; j < m; j++) { const o = S.lay.dist[j], base = S.final[j];
      if (t < 0) { S.vals[j] = 0.55; continue; }
      if (f < 0) { S.vals[j] = base; continue; }
      // AND THEN THEY ARE GONE. The dots are the way in - the work flies from the record and settles
      // along the drawing - and once the line is there they melt away completely, because a drawing
      // made of fine lines with dots scattered over it is two drawings. A value under -1.5 is thrown
      // away by the shader, so nothing at all is left behind.
      const gone = Math.min(1, Math.max(0, (t - 0.25) / 0.9));
      const reach = Math.abs(o - 0.5) <= f * 0.5 + 1e-6;
      const atFront = Math.abs(Math.abs(o - 0.5) - f * 0.5) < 0.035;
      const still = atFront ? 1.25 : (reach ? 0.10 : base);
      S.vals[j] = (gone >= 1 || (S.melt && S.melt[j] <= gone)) ? -2 : still; }
    sldUniforms(); placeSldNames();
    if (arrived && !S.placed) { S.placed = true; try { if (window.__placeSay) window.__placeSay(); } catch (_) {}
      try { stringOpenView(); } catch (_) {} }
    dirty = true;
    if (live || t < Math.max(T2, 1.2) + 0.5) sldLoop = requestAnimationFrame(sldTick);
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
let pinHeight = 0;                                       // what the pinned key took last time it was laid out
function shapeBand(reserve){
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
  // THE KEY IS NOT PART OF THE PICTURE AND THE PICTURE DOES NOT RUN UNDER IT. What the key took last
  // time is kept out of the band the drawing is laid into and clipped to; the key itself is placed
  // against the band that has NOT been shortened, or it would walk up the screen a line a frame.
  if (reserve && pinHeight > 0) bottom = Math.max(top + 120, bottom - pinHeight - 6);
  return { left, right, top, bottom };
}
function stringPlaceView(spanM, whole){
  const D = sldShapes; if (!D || typeof flyTo !== 'function') return;
  const R = Math.sqrt(SPACE), f = BODY_RADIUS_MAX, b = shapeBand(true);
  if (whole) { const bb = D.bounds, w = Math.max(1e-6, bb.x1 - bb.x0), h = Math.max(1e-6, bb.y1 - bb.y0);
    const z = Math.max(1e-9, Math.min((b.right - b.left) * 0.98 / (w * R * f), (b.bottom - b.top) * 0.92 / (h * R * f)));
    flyTo((bb.x0 + bb.x1) / 2 * R * f - ((b.left + b.right) / 2 - innerWidth / 2) / z,
          (bb.y0 + bb.y1) / 2 * R * f + ((b.top + b.bottom) / 2 - innerHeight / 2) / z, z); return; }
  // THE NEAR VIEW FILLS THE BAND, in both directions. It used to be set by width alone, so on a
  // telephone a two tier table sat in a third of the screen with empty dark above and below it. The
  // zoom is now whichever of the two fits - the whole drawing's height into the band's height, or
  // three modules across its width - so the picture is as large as it can be and still legible, and it
  // starts at M1 rather than at the inverter, because the modules are what is being read.
  const hUnits = Math.max(1e-6, D.bounds.y1 - D.bounds.y0);
  const zH = (b.bottom - b.top) * 0.97 / (hUnits * R * f);
  const wantM = Math.max(3.1, Math.min(6, innerWidth / 95)) * D.g.pitch;
  const zW = (b.right - b.left) * 0.97 / (wantM * D.perM * R * f);
  const z = Math.max(1e-9, Math.min(zH, zW));
  const firstX = D.firstModuleX !== undefined ? D.firstModuleX : D.near.x;
  flyTo(firstX * R * f - (b.left + 6 - innerWidth / 2) / z,
        (D.bounds.y0 + D.bounds.y1) / 2 * R * f + ((b.top + b.bottom) / 2 - innerHeight / 2) / z, z);
}
function stringOpenView(){ const D = sldShapes; if (!D || D.opened) return; D.opened = true; stringPlaceView(stringViewSpanM(), false); }
function stringWholeView(){ stringPlaceView(0, true); }
function stringNearView(){ const D = sldShapes; if (!D) return; D.opened = false; stringOpenView(); }
function sldStart(){ if (!sldLoop) sldLoop = requestAnimationFrame(sldTick); }
// THE ELECTRICAL WALK, READ OFF THE DRAWING ITSELF. Nothing is measured or placed here: every
// conductor shape already says which terminal it leaves and which it joins, so the order is found by
// following those names from INV- to INV+, and each leg's share of the walk is the TRUE LENGTH of the
// polyline that was drawn for it. A module is a leg too - the walk goes in at its - box and out at its
// + box. Returns false, and no neon runs, if any link is open or the chain does not close.
function buildStringWalk(D){
  const byFrom = new Map(), mods = new Map();
  for (const s of D.shapes) {
    if ((s.role === 'lead' || s.role === 'cable') && s.from && s.to && s.pts && s.pts.length > 1) {
      if (s.open) return false;                          // a break: the string carries nothing
      if (!byFrom.has(s.from)) byFrom.set(s.from, s); }
    else if (s.role === 'module' && s.module !== undefined && s.pts && s.pts.length > 1) mods.set(+s.module, s); }
  const legs = []; let at = 'INV-', guard = 0;
  while (guard++ < 500 && at !== 'INV+') {
    const s = byFrom.get(at);
    if (s) { legs.push({ s, len:Math.max(1e-6, polyLen(s.pts).total) }); at = s.to; continue; }
    const m = /^M(\d+)-$/.exec(at); if (!m) return false;
    const box = mods.get(+m[1]);
    const bb = box ? box.pts : null;
    let len = 0.6;
    if (bb) { let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const p of bb) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
      len = Math.max(1e-6, (x1 - x0) + (y1 - y0)) * 0.5; }
    legs.push({ mod:box, len }); at = 'M' + m[1] + '+'; }
  if (at !== 'INV+' || !legs.length) return false;
  let total = 0; for (const L of legs) total += L.len;
  let c = 0; for (const L of legs) { L.u0 = c / total; c += L.len; L.u1 = c / total; }
  return { legs, total };
}

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
// THE LINE THAT HAS TO BE THERE EVERY TIME, in red, wherever an answer of this family is shown. It is
// not closable and it does not scroll away: this page is a place to think in, not a design.
const DEV_WARNING = 'Not real cable or array sizing - consult a design engineer. DEVELOPMENT ENVIRONMENT: estimates from a model, nothing measured.';
const DEV_WARNING_SHORT = 'Not real cable or array sizing - consult a design engineer.';
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
  const wX = g.wX, wY = g.wY, port = g.port, rows = g.rows, cols = g.cols, tableTop = g.rowY[rows - 1] + wY;
  const cellCols = Math.max(1, Math.round(c.cell_cols === undefined ? 6 : c.cell_cols));
  const cellRows = Math.max(2, Math.round(c.cell_rows === undefined ? 22 : c.cell_rows));
  // TWO VIEWS OF THE SAME STRING, and the WIRING one is what anybody actually asks a drawing for.
  // Looking at the BACK of the modules: plain backs, no cell grid, the junction boxes drawn several
  // times their real size because what is being read is WHICH BOX JOINS WHICH, and a true-to-scale box
  // at row zoom is three pixels of nothing. Every cable is a line you can follow with a finger from one
  // box terminal to the next. The other view keeps the module to scale with its cells, for when the
  // question is how big the thing is rather than how it is wired.
  const wiring = String(c.view || 'wiring').toLowerCase() !== 'scale';
  // PLAIN SMALL BOXES, the same in both views. Drawn several times life size the boxes became a strip
  // of black rectangles across the module and the drawing stopped looking like a drawing.
  const boxW = port ? 0.24 : 0.16, boxH = port ? 0.16 : 0.24;
  const boxY = g.rowY[0] + wY / 2;
  // EVERY TERMINAL IS DECLARED, by name, once. A cable may begin and end nowhere else, and that is
  // checked rather than trusted: this list is what the checks walk.
  const terminals = [];
  const term = (id, x, y, kind, module) => { terminals.push({ id, x, y, kind, module }); return [x, y]; };
  const vmp = c.module_vmp === undefined ? 38.1 : +c.module_vmp, vString = N * vmp;
  const vOpen = N * (c.module_voc === undefined ? 45.9 : +c.module_voc);
  const shapes = [], marks = [], words = [], conns = [];
  const chain = 2 * N;                                              // home-, module, link, module ... home+
  let put = o => { shapes.push(o); return o; };
  const put0 = put;
  put = o => { if (o.pot === undefined) o.pot = 0; o.volts = o.pot * vString; o.earth_v = (o.pot - 0.5) * vString;
    if (o.node === undefined) o.node = null; return put0(o); };
  const poly = (role, o, pts, extra) => put(Object.assign({ role, order:o, pot:0, pts, weight:1 }, extra || {}));
  const box = (role, o, x0, y0, x1, y1, extra) => poly(role, o, [[x0,y0],[x1,y0],[x1,y1],[x0,y1],[x0,y0]], extra);

  // ---- the inverter: a filled block with a - terminal and a + terminal, both marked
  const invW = 3.0, standOff = 2.2;
  const invX1 = -standOff, invX0 = invX1 - invW, invY0 = boxY - 1.14, invY1 = boxY + 1.14;
  const negY = invY1 - (invY1 - invY0) * 0.26, posY = invY0 + (invY1 - invY0) * 0.26;
  box('inverter', 0, invX0, invY0, invX1, invY1, { fill:SHAPE_FILL, node:'inv' });
  for (const [y, sign] of [[negY, '−'], [posY, '+']]) {
    poly('terminal', 0, [[invX1, y], [invX1 + 0.16, y]], { node:'inv' });
    term(sign === '+' ? 'INV+' : 'INV-', invX1 + 0.16, y, sign === '+' ? 'inv+' : 'inv-', 0);
    put({ role:'terminal', order:0, pot:sign === '+' ? 1 : 0, node:'inv', pts:[[invX1 + 0.16, y]], dot:0.10 });
    marks.push({ x:invX1 - 0.30, y, text:sign, size:12, colour:sign === '+' ? SHAPE_RED : SHAPE_EDGE, minPx:14 }); }

  // ---- the modules, to true proportion, with their cells and their two boxes
  const turned = k => g.turned(k);
  for (let k = 1; k <= N; k++) {
    const x0 = g.x0(k), x1 = x0 + wX, yb = g.y0(k), yt = yb + wY;
    const o = (2 * g.order.indexOf(k) + 1) / chain, pot = (g.order.indexOf(k) + 1) / N;
    box('module', o, x0, yb, x1, yt, { fill:'#0c1119', node:'M' + k, weight:1 });
    // THE CELLS. This module class is cols x rows half cells with the break across the middle where the
    // two halves meet. They are hairlines and they are dropped entirely when they would turn to mush.
    // THE CELLS FOLLOW THE MODULE ROUND. A module laid on its side has its columns of cells across the
    // table and its rows up it: the count belongs to the module, not to the table.
    // EVERY CELL IS A THING, not a stripe of a pattern. The grid is carried as DATA - how many across
    // and up, the gap between cells, the wider gap where the two halves of the module meet, and for
    // every cell which cell string it is in and which bypass diode guards it - because what comes next
    // is lighting, shading and faulting cells one at a time. The lines drawn from it are quiet: they sit
    // UNDER the cables, and they are only drawn when a cell is wide enough on the screen to be a cell.
    const cA = port ? cellCols : cellRows, cB = port ? cellRows : cellCols;
    const gapC = 0.002, midG = 0.012;                       // between cells, and across the middle of the module
    const cw = (wX - gapC * (cA - 1)) / cA, ch = (wY - gapC * (cB - 1) - midG) / cB;
    const cellX = i2 => x0 + i2 * (cw + gapC);
    const cellY = j2 => yb + j2 * (ch + gapC) + (j2 >= cB / 2 ? midG : 0);
    put({ role:'cells', order:o, pot, node:'M' + k, module:k, pts:[[x0, yb], [x1, yt]],
          grid:{ across:cA, up:cB, cell_w:cw, cell_h:ch, gap:gapC, mid_gap:midG, x0, y0:yb,
                 cell_strings:3, diodes:3, per_string:Math.round(cA * cB / 3) } });
    // THREE SPLIT BOXES ON THE MID LINE, which is what a modern module really has: the two outer ones
    // carry the leads, one - and one +, and the middle one carries a bypass diode and nothing else.
    // Each lead leaves its box SIDEWAYS along that line and ends in a connector you can see.
    const midPt = [(g.minusPt(k)[0] + g.plusPt(k)[0]) / 2, (g.minusPt(k)[1] + g.plusPt(k)[1]) / 2];
    box('box', o, midPt[0] - boxW / 2, midPt[1] - boxH / 2, midPt[0] + boxW / 2, midPt[1] + boxH / 2,
      { fill:'#060a10', node:'M' + k, weight:1, big:wiring, diodeOnly:true });
    for (const [pt, sign] of [[g.minusPt(k), '−'], [g.plusPt(k), '+']]) {
      box('box', o, pt[0] - boxW / 2, pt[1] - boxH / 2, pt[0] + boxW / 2, pt[1] + boxH / 2,
        { fill:'#060a10', node:'M' + k, weight:1, big:wiring, diode:true });
      term('M' + k + (sign === '+' ? '+' : '-'), pt[0], pt[1], sign === '+' ? 'module+' : 'module-', k);
      marks.push({ x:pt[0] + (port ? 0 : boxW * 0.5 + 0.17), y:pt[1] - (port ? boxH / 2 + 0.17 : 0),
        text:sign, size:11, colour:sign === '+' ? SHAPE_RED : SHAPE_INK, minPx:22, mid:port, rank:0 }); }
    marks.push({ x:(x0 + x1) / 2, y:yb - 0.34, text:'M' + k, size:11, colour:SHAPE_INK, minPx:18, mid:true, rank:0, dodge:true });
    if (turned(k)) marks.push({ x:(x0 + x1) / 2, y:yb - 0.62, text:'rear', size:9, colour:SHAPE_EDGE, minPx:60, mid:true, dodge:true, rank:3 });
  }
  // WHAT HOLDS THE TABLE UP, where it changes the geometry: the ridge of an east west table and the
  // torque tube of a tracker are each drawn as the one fine line they are.
  for (let r = 0; r + 1 < rows; r++) { const gapTop = g.rowY[r + 1], gapBot = g.rowY[r] + wY;
    if (gapTop - gapBot > c.gap_up_m + 1e-6) poly('tube', 0, [[-0.4, (gapTop + gapBot) / 2], [cols * g.pitch + 0.2, (gapTop + gapBot) / 2]], { node:'tube' }); }

  // ---- the links: a curve from the + box of one module to the - box of the next, made of two leads
  let laneHi = tableTop, laneLo = g.rowY[0];
  // A LEAD IS NOT AN ARCH. It leaves its own box, runs behind the modules and plugs into the box it
  // mates with, and the line drawn here is THAT ROUTE, AT ITS TRUE LENGTH: 0.84 m of lead is 0.84 m of
  // line at this drawing's scale. The tall arches this picture used to have were readable, and they
  // were three times as long as the cable they stood for, which is not a drawing of anything. What
  // tells two links apart now is a small lane offset - out of the row one way and back the other - the
  // tick where the two leads mate, and the numbers written on the link itself.
  // A LINK IS FOUR THINGS YOU CAN SEE: a lead out of one box, a PLUG, a SOCKET it clicks into, and a
  // lead into the next box. The two leads leave their boxes sideways along the mid line of the module,
  // the way they really do, and the cable between them is a smooth curve with sag - arching ABOVE the
  // mid line on the way out and sweeping BELOW it on the way back - so that two cables crossing can
  // still be told apart. Colour stays with POLARITY, not with direction: red is the + lead and black
  // the -, whichever way round the curve goes.
  // A STRAIGHT RUN OUT OF THE BOX FIRST. Curving away the instant it leaves made the whole row read as
  // one wave passing through the modules; a short straight stub, clear of the box outline and along the
  // mid line, is what makes the eye see a cable LEAVING THAT BOX. Where two boxes sit side by side at a
  // module boundary, the stubs are what say which tube belongs to which.
  // THE ONE THING THAT WAS WRONG: a cable that begins in the air. Each one now starts on the EDGE of
  // its own box, on the side facing where it is going, with a small dot to mark the landing, runs a
  // short straight way clear of the box, and then curves to the edge of the box it joins.
  const stub = Math.max(0.13, wX * 0.22), lip = boxW * 0.60;
  const faceX = (bx, towards) => bx + (towards >= bx ? 1 : -1) * boxW / 2;
  const faceY = (by, towards) => by + (towards >= by ? 1 : -1) * boxH / 2;
  // EVERY CONDUCTOR RUNS BETWEEN THE TWO TERMINALS THE MODEL SAYS IT JOINS, and nowhere else. The link
  // list is the netlist: out along the odd modules, M1+ to M3-, M3+ to M5-, and back through the even
  // ones. Nothing is drawn from a module to itself, nothing leaves the middle box - the middle box has
  // no lead, it holds a diode - and nothing is invented to make the picture tidy.
  //
  // AND EVERY LEAD IS ITS TRUE LENGTH. The drawing is to scale, so a lead of 0.30 m is 0.30 m of line.
  // Two leads that reach are drawn as one curve whose ARC LENGTH is the two lead lengths added: the
  // spare cable shows as the gentle bow it really makes, not as a decorative arch. Two leads that do
  // NOT reach are drawn straight out from their own boxes, each to its own length, each ending in its
  // connector, with nothing at all between them. The gap IS the message: no dashes, no dots, no amber
  // line pretending a cable is there.
  g.links.forEach((l, i) => {
    const Ac = g.plusPt(l.from), Bc = g.minusPt(l.to);
    const A = port ? [faceX(Ac[0], Bc[0]), Ac[1]] : [Ac[0], faceY(Ac[1], Bc[1])];
    const B = port ? [faceX(Bc[0], Ac[0]), Bc[1]] : [Bc[0], faceY(Bc[1], Ac[1])];
    const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.max(1e-6, Math.hypot(dx, dy));
    // OUT ABOVE, RETURN BELOW. A link on the way out bows ABOVE the box line and a link on the way
    // back bows BELOW it, so two cables sharing a module are told apart by which side they sit on and
    // not by a guess. The perpendicular is taken to the run and then its sign is settled by direction.
    const ux = dx / L, uy = dy / L;
    let nx = -uy, ny = ux;
    const want = l.back ? -1 : 1;
    if (Math.abs(ny) < 1e-6) { if (nx * want < 0) { nx = -nx; ny = -ny; } }
    else if (ny * want < 0) { nx = -nx; ny = -ny; }
    const o = (2 * i + 2) / chain, pot = (i + 1) / N;
    const lp = c.lead_plus_m, lm = c.lead_minus_m, pair = lp + lm;
    const fromId = 'M' + l.from + '+', toId = 'M' + l.to + '-';
    const node = 'L' + i;
    const says = fromId + ' to ' + toId + ', needs ' + l.need.toFixed(2) + ' m, leads ' + pair.toFixed(2) + ' m'
               + (l.reaches ? '' : ', short by ' + (l.need - pair).toFixed(2) + ' m');
    conns.push({ node, from:fromId, to:toId, needed:l.need, pair, reaches:l.reaches, jumper:l.jumper || 0 });
    if (pair >= L) {
      // A CURVE WHOSE ARC LENGTH IS THE CABLE THERE REALLY IS. For a shallow parabola of sag h over a
      // span L the arc is about L(1 + 8h^2/3L^2), so the sag that spends exactly the spare cable is
      // h = L * sqrt(3(pair/L - 1) / 8). With no spare it is a straight line, which is the truth.
      const h = L * Math.sqrt(Math.max(0, 3 * (pair / L - 1) / 8));
      // NO ARC LEAVES ITS OWN MODULE. A bow that climbs off the module back is a drawing of a cable
      // hanging in the sky. The boxes sit on the mid line, so the room there is half a module either
      // way, less a margin for the edge; a cubic with both handles at 2h peaks at 1.5h, so the bow is
      // clamped to that room. The cable that the clamp does not spend is not lost: it shows as the
      // SMALL LOOP a jointer leaves at the connector, which is where the spare really sits.
      const roomY = Math.max(0.02, wY / 2 - 0.06);
      const hMax = (Math.abs(ny) < 1e-6) ? h : roomY / 1.5 / Math.max(1e-6, Math.abs(ny));
      const hUse = Math.min(h, hMax), spare = Math.max(0, h - hUse);
      const cp = [(A[0] + B[0]) / 2 + nx * hUse * 2, (A[1] + B[1]) / 2 + ny * hUse * 2];
      const pts = bez(A, cp, cp, B, 24);
      for (const q of pts) { laneHi = Math.max(laneHi, q[1]); laneLo = Math.min(laneLo, q[1]); }
      const t = Math.min(0.92, Math.max(0.08, lp / pair)), m2 = polyLen(pts);
      poly('lead', o, polySlice(pts, 0, t), { node, pot, plus:true, link:l, says, hit:true, from:fromId, to:'mate' + i, metres:lp });
      poly('lead', o, polySlice(pts, t, 1), { node, pot, plus:false, link:l, says, hit:true, from:'mate' + i, to:toId, metres:lm });
      const j = polyAt(pts, m2.cum, m2.total, t), tan = polyAt(pts, m2.cum, m2.total, Math.min(1, t + 0.02));
      put({ role:'mate', order:o, pot, node, pts:[[j[0], j[1]]], link:l, says, mated:true,
            along:[tan[0] - j[0], tan[1] - j[1]] });
    } else {
      // NEITHER LEAD REACHES. Each is drawn straight out from its own box, at its own length, and stops.
      const Pa = [A[0] + ux * lp, A[1] + uy * lp], Pb = [B[0] - ux * lm, B[1] - uy * lm];
      poly('lead', o, [A, Pa], { node, pot, plus:true, link:l, says, hit:true, open:true, from:fromId, to:'open' + i, metres:lp });
      poly('lead', o, [Pb, B], { node, pot, plus:false, link:l, says, hit:true, open:true, from:'open' + i, to:toId, metres:lm });
      put({ role:'plug', order:o, pot, node, pts:[[Pa[0], Pa[1]]], male:true, along:[ux, uy] });
      put({ role:'plug', order:o, pot, node, pts:[[Pb[0], Pb[1]]], male:false, along:[ux, uy] });
      laneHi = Math.max(laneHi, A[1], B[1]); laneLo = Math.min(laneLo, A[1], B[1]);
    }
  });

  // ---- the two home runs, above everything and below everything, so they never cross a module
  const first = g.order[0], last = g.order[g.order.length - 1];
  laneHi = Math.max(laneHi, tableTop); laneLo = Math.min(laneLo, g.rowY[0]);
  const topLane = laneHi + 0.70, botLane = laneLo - 0.70;
  const nP = g.minusPt(first), pP = g.plusPt(last), xn = nP[0], xp = pP[0];
  // ROUNDED, like every other cable here: a square corner is a busbar, not a cable.
  const round4 = (pp, r2) => { const out = [pp[0]];
    for (let i2 = 1; i2 + 1 < pp.length; i2++) { const a2 = pp[i2 - 1], b2 = pp[i2], c2 = pp[i2 + 1];
      const u1 = [a2[0] - b2[0], a2[1] - b2[1]], u2 = [c2[0] - b2[0], c2[1] - b2[1]];
      const L1 = Math.max(1e-6, Math.hypot(u1[0], u1[1])), L2 = Math.max(1e-6, Math.hypot(u2[0], u2[1]));
      const k1 = Math.min(r2, L1 * 0.45), k2 = Math.min(r2, L2 * 0.45);
      const s1 = [b2[0] + u1[0] / L1 * k1, b2[1] + u1[1] / L1 * k1], s2 = [b2[0] + u2[0] / L2 * k2, b2[1] + u2[1] / L2 * k2];
      out.push(s1); for (let q = 1; q < 6; q++) { const t2 = q / 6, w2 = (1 - t2) * (1 - t2), m2 = 2 * (1 - t2) * t2, e2 = t2 * t2;
        out.push([w2 * s1[0] + m2 * b2[0] + e2 * s2[0], w2 * s1[1] + m2 * b2[1] + e2 * s2[1]]); }
      out.push(s2); }
    out.push(pp[pp.length - 1]); return out; };
  const nEdge = port ? [xn, nP[1] + boxH / 2] : [xn - boxW / 2, nP[1]];
  const pEdge = port ? [xp, pP[1] - boxH / 2] : [xp - boxW / 2, pP[1]];

  const homeNeg = round4([[invX1 + 0.16, negY], [invX1 + 0.70, negY], [invX1 + 0.70, topLane], [xn, topLane], nEdge], 0.45);
  conns.unshift({ node:'home-', from:'INV-', to:'M' + first + '-', needed:c.near_end_m, pair:null, reaches:true, home:true });
  conns.push({ node:'home+', from:'M' + last + '+', to:'INV+', needed:c.near_end_m, pair:null, reaches:true, home:true });
  poly('cable', 0, homeNeg, { node:'home-', pot:0, plus:false, weight:1.2, from:'INV-', to:'M' + first + '-', says:'the home run to the string’s − end' });
  // DRAWN THE WAY THE CURRENT GOES, from the string's + terminal back to the inverter's, so that the
  // line's first point IS the terminal it says it starts at. It ran the other way, and the check that
  // asks "does every cable begin on the terminal it names" found it at once.
  const homePos = round4([pEdge, [xp, botLane], [invX1 + 0.55, botLane], [invX1 + 0.55, posY], [invX1 + 0.16, posY]], 0.45);
  poly('cable', 1, homePos, { node:'home+', pot:1, plus:true, weight:1.2, from:'M' + last + '+', to:'INV+',
    says:g.bothNear ? 'the home run from the string’s + end' : 'the far end return: one more cable, ' + g.ret.toFixed(1) + ' m of it' });

  // ---- the loop the string encloses: what a nearby stroke couples into
  const loopPts = [[xn, nP[1]], [xp, pP[1]], [xp, botLane], [invX1 + 0.55, botLane], [invX1 + 0.70, topLane], [xn, topLane], [xn, nP[1]]];
  put({ role:'loop', order:0, pot:0, pts:loopPts, closed:true });

  // ---- the words the drawing needs, in the page's own overlay
  words.push({ x:(invX0 + invX1) / 2, y:invY1 + 0.55, text:'INVERTER' });
  words.push({ x:xn, y:topLane + 0.40, text:'inverter − to M' + first + '−' });
  words.push({ x:xp, y:botLane - 0.30, text:'M' + last + '+ to inverter +' });

  if (!g.bothNear) words.push({ x:g.row / 2, y:botLane - 0.62, text:'additional far end return, about ' + g.ret.toFixed(1) + ' m' });
  // THE KEY IS PINNED TO THE SCREEN, NOT LAID OUT IN THE DRAWING. It was written into the picture under
  // the row, which meant that the moment a reader zoomed in to read a module - the whole point of the
  // near view - the key was a hundred metres below the bottom of the screen and nobody ever saw it. A
  // key is not part of the thing it explains: it stays at the foot of the band, at every zoom, at every
  // size, without scrolling and without opening anything. The warning sits above it, in the same place.
  // EVERY LINE HAS A SHORT FORM. On a telephone the long forms wrapped into four paragraphs that took
  // half the screen and sat on the drawing, which is worse than not showing them at all. Each line is
  // written twice, and the narrow screen gets the short one, on one line.
  if (g.short.length) words.push({ pinned:2, warnLine:true,
    text:'the circuit is open and BOTH ENDS ARE LIVE: ' + g.short.length + ' links do not reach, so no current flows, but up to '
      + Math.round(vOpen) + ' V stands across a break and that is where an arc starts',
    small:'OPEN and LIVE: ' + g.short.length + ' links short, up to ' + Math.round(vOpen) + ' V across a break' });
  // THE NOTE ITSELF IS NEVER SHORTENED. Those are the owner's words and they are short enough already.
  // ONE LINE OF ARITHMETIC UNDER THE PICTURE, so the whole answer is on the page without opening a thing.
  words.push({ pinned:3, note:true, off:true,
    text:(g.links.length - g.short.length) + ' of ' + g.links.length + ' links reach \u00b7 ' + g.lead_m.toFixed(1)
      + ' m of module lead \u00b7 ' + g.field_m.toFixed(1) + ' m of site cable \u00b7 ' + g.ohm.toFixed(3)
      + ' ohm with the leads at ' + c.t_lead_c + ' C and the cable at ' + c.t_site_c + ' C',
    small:(g.links.length - g.short.length) + '/' + g.links.length + ' reach \u00b7 ' + g.lead_m.toFixed(0)
      + ' m lead \u00b7 ' + g.field_m.toFixed(0) + ' m cable \u00b7 ' + g.ohm.toFixed(3) + ' ohm' });
  words.push({ pinned:4, danger:true, text:DEV_WARNING, small:DEV_WARNING_SHORT });
  // ON A TELEPHONE THE KEY IS ONE LINE. Four lines of grey took a quarter of the screen off the
  // drawing, which is the thing the reader came for; the owner's own words are kept inside that line.
  words.push({ pinned:1, note:true, narrow:true,
    text:CABLE_NOTE + ' · red +, black − · the back of the modules, boxes and cables enlarged' });
  if (wiring) words.push({ pinned:2, note:true, wide:true,
    text:'you are looking at the BACK of the modules; the junction boxes are drawn larger than life and the cables longer than life, so that which box joins which can be followed',
    small:'the back of the modules; boxes and cables enlarged so the wiring can be followed' });
  words.push({ pinned:1, text:CABLE_NOTE, note:true, wide:true });
  words.push({ pinned:0, note:true, wide:true,
    text:'red is the + conductor and black the \u2212; the array floats, so either terminal may sit at up to half the array voltage to earth, and black does not mean earthed',
    small:'red is +, black is \u2212; the array floats, so black is not earthed' });
  words.push({ pinned:-1, note:true, wide:true,
    text:'the moving highlight shows the instant the circuit closes; after that the current is the same all the way round, so the line does not thicken or thin',
    small:'the highlight is the instant the circuit closes; after it, one current all the way round' });

  // ---- everything measured, then put into the page's units with the row laid out LARGE
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  const see = (x, y) => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; };
  for (const s of shapes) { if (s.pts) for (const p of s.pts) see(p[0], p[1]); if (s.lines) for (const l of s.lines) { see(l[0][0], l[0][1]); see(l[1][0], l[1][1]); } }
  for (const m of marks) see(m.x, m.y); for (const t2 of terminals) see(t2.x, t2.y);
  for (const w of words) if (w.pinned === undefined) see(w.x, w.y);
  // THE DRAWING IS NOT SQUEEZED INTO THE DISC. It is as tall as the disc and as wide as it needs to be,
  // which for thirty modules is several screens: the view opens on the near end and the reader drags.
  const S = 1.85 / Math.max(0.5, y1 - y0), my = (y0 + y1) / 2, mx = x0;
  const U = (x, y) => [(x - mx) * S - 0.95, (y - my) * S];
  for (const s of shapes) { if (s.pts) s.pts = s.pts.map(p => U(p[0], p[1]));
    if (s.split) s.split = s.split.map(p => U(p[0], p[1]));
    if (s.lines) s.lines = s.lines.map(l => [U(l[0][0], l[0][1]), U(l[1][0], l[1][1])]);
    if (s.mid) s.mid = U(s.mid[0], s.mid[1]); }
  for (const m of marks) { const u = U(m.x, m.y); m.x = u[0]; m.y = u[1]; }
  for (const t2 of terminals) { const u = U(t2.x, t2.y); t2.x = u[0]; t2.y = u[1]; }
  for (const w of words) { if (w.pinned !== undefined) continue; const u = U(w.x, w.y); w.x = u[0]; w.y = u[1]; }
  const open = g.short.length > 0;
  // WHERE ONE CABLE CROSSES ANOTHER, worked out once from the geometry and written down. A wiring
  // drawing has always done this: the cable on top keeps its line unbroken and the one underneath is
  // broken for a few pixels each side, so the eye can follow either through the crossing. Which is on
  // top is decided by where they sit on the electrical path, so it is the same picture every time.
  const crossings = [];
  { const cab = shapes.filter(q => (q.role === 'lead' || q.role === 'cable') && q.pts && q.pts.length > 1);
    const box2 = q => { let a = 1e9, b = 1e9, c2 = -1e9, d2 = -1e9;
      for (const z of q.pts) { a = Math.min(a, z[0]); c2 = Math.max(c2, z[0]); b = Math.min(b, z[1]); d2 = Math.max(d2, z[1]); }
      return [a, b, c2, d2]; };
    const bb = cab.map(box2), cum = cab.map(q => polyLen(q.pts));
    for (const q of cab) q.breaks = [];
    for (let a = 0; a < cab.length; a++) for (let b = a + 1; b < cab.length; b++) {
      if (cab[a].node === cab[b].node) continue;
      const A2 = bb[a], B2 = bb[b];
      if (A2[0] > B2[2] || A2[2] < B2[0] || A2[1] > B2[3] || A2[3] < B2[1]) continue;
      const pa = cab[a].pts, pb = cab[b].pts;
      for (let i2 = 1; i2 < pa.length; i2++) for (let j2 = 1; j2 < pb.length; j2++) {
        const x1 = pa[i2-1][0], y1 = pa[i2-1][1], x2 = pa[i2][0], y2 = pa[i2][1];
        const x3 = pb[j2-1][0], y3 = pb[j2-1][1], x4 = pb[j2][0], y4 = pb[j2][1];
        const den = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3);
        if (Math.abs(den) < 1e-12) continue;
        const t = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / den;
        const u = ((x3 - x1) * (y2 - y1) - (y3 - y1) * (x2 - x1)) / den;
        if (t < 0 || t > 1 || u < 0 || u > 1) continue;
        const ua = (cum[a].cum[i2-1] + (cum[a].cum[i2] - cum[a].cum[i2-1]) * t) / Math.max(1e-9, cum[a].total);
        const ub = (cum[b].cum[j2-1] + (cum[b].cum[j2] - cum[b].cum[j2-1]) * u) / Math.max(1e-9, cum[b].total);
        if (ua < 0.03 || ua > 0.97 || ub < 0.03 || ub > 0.97) continue;
        const overA = (cab[a].order || 0) >= (cab[b].order || 0);
        (overA ? cab[b] : cab[a]).breaks.push(overA ? ub : ua);
        crossings.push({ x:x1 + (x2 - x1) * t, y:y1 + (y2 - y1) * t,
          over:(overA ? cab[a] : cab[b]).node, under:(overA ? cab[b] : cab[a]).node,
          u_over:overA ? ua : ub, u_under:overA ? ub : ua });
      } } }
  return { kind:'string', shapes, marks, words, conns, terminals, wiring, crossings, perM:S, open, g,
           firstModuleX:U(-0.06, 0)[0], volts:vString, volts_open:vOpen, earth_node:'earth',
           bounds:{ x0:U(x0, y0)[0], y0:U(x0, y0)[1], x1:U(x1, y1)[0], y1:U(x1, y1)[1] },
           near:{ x:U(invX0, boxY)[0], y:U(invX0, boxY)[1] }, mPerUnit:1 / S,
           amps:open ? 0 : c.amps, front:-1, head:-1, walk:null, t0:0 };
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
    if (s.role === 'tube') { line('mod', s.order, s.pts[0], s.pts[1]); continue; }
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
  // THE SAME DRAWING ON PAPER. A wiring drawing has been read on white for a very long time and it is
  // easier to read there; the night is the wafer's own and stays the default. Nothing moves between the
  // two: only the ink changes.
  const SHEET = !!(D.g && D.g.c && String(D.g.c.sheet) === '1');
  const band = shapeBand(true), win = sayRect();
  if (SHEET) { ctx.fillStyle = '#eef1f5';
    ctx.fillRect(band.left, band.top, band.right - band.left, band.bottom - band.top); }
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
  const fine = 1.15, hair = 0.7;
  const INK = SHEET ? '#10151c' : SHAPE_INK, PENCIL = SHEET ? '#55606e' : SHAPE_PENCIL,
        FAINT = SHEET ? '#b9c2cd' : SHAPE_FAINT, EDGE2 = SHEET ? '#6c7886' : SHAPE_EDGE,
        BODY = SHEET ? '#e3e7ec' : '#0c1119', BOXFILL = SHEET ? '#cdd4dc' : '#05080d';
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
  // 2. THE MODULE BACKS FIRST, because everything else is clipped TO them and must be drawn ON them.
  for (const s of D.shapes) {
    if (s.role === 'module' || s.role === 'inverter') { if (!onScreen(s.pts)) continue;
      path(s.pts); ctx.closePath(); if (s.fill) { ctx.fillStyle = s.role === 'module' ? BODY : (SHEET ? '#e6eaef' : s.fill); ctx.fill(); }
      ctx.lineWidth = fine * 0.8; ctx.strokeStyle = s.role === 'inverter' ? INK : PENCIL; ctx.stroke(); continue; }
    // THE CELLS, from the grid the module carries. Each one is drawn as the cell it is, with the real
    // gap between cells and the wider gap across the middle where the two halves meet. They appear as
    // soon as a cell is wide enough on the screen to BE a cell, and they fade in rather than arriving as
    // a moire; they are quiet, because the cables are what is being followed.
    if (s.role === 'cells' && s.grid) { if (!onScreen(s.pts)) continue;
      const G = s.grid, cwPx = G.cell_w * perM, chPx = G.cell_h * perM;
      if (Math.min(cwPx, chPx) < 1.3) continue;                 // a cell that cannot be a cell is left out
      const fade = Math.min(1, (Math.min(cwPx, chPx) - 1.3) / 2.2);
      ctx.globalAlpha = 0.85 * fade; ctx.lineWidth = hair; ctx.strokeStyle = FAINT;
      ctx.beginPath();
      for (let j2 = 0; j2 < G.up; j2++) for (let i2 = 0; i2 < G.across; i2++) {
        const x2 = G.x0 + i2 * (G.cell_w + G.gap), y2 = G.y0 + j2 * (G.cell_h + G.gap) + (j2 >= G.up / 2 ? G.mid_gap : 0);
        const a = S([x2, y2]), b = S([x2 + G.cell_w, y2 + G.cell_h]);
        ctx.rect(a[0], b[1], b[0] - a[0], a[1] - b[1]); }
      ctx.stroke(); ctx.globalAlpha = 1; } }
  // 3. THE CONDUCTORS, on top of the backs. Fused behind the front, pencil ahead of it; a gap is a gap.
  for (const s of D.shapes) {
    if (s.role !== 'lead' && s.role !== 'cable') continue;
    if (!s.pts.length || !onScreen(s.pts)) continue;
    // THE FRONT LEAVES THE MODULES AND REACHES THE INVERTER LAST, on both conductors at once.
    const fused = front >= 0 && Math.abs((s.order === undefined ? 0.5 : s.order) - 0.5) <= front * 0.5 + 1e-6;
    const lit = shapeHover && shapeHover === s.node;
    const w = fine * (s.weight || 1) * (fused ? 1 + 0.45 * Math.min(1, (D.amps || 0) / 20) : 1);
    // POLARITY IS THE COLOUR, AND NOTHING ELSE IS. The minus conductor is a BLACK cable: a dark core
    // with ONE hairline of light round it, because black on a near black sky is otherwise nothing at
    // all, and a pale grey line would be a lie about what is in the trench. The plus conductor is ONE
    // CLEAR RED all the way along. Shading it by how far up the string each point sits was mine, and it
    // was wrong: thirty steps of red do not read as voltage, they read as shading, and the first thing
    // a reader must get is which conductor is which. The potential is still carried on every shape, for
    // the earth fault work, and it is said in words instead of being hinted at in a colour.
    // CURRENT decides the WEIGHT, not the colour, so a fused line is the same conductor, thicker and
    // brighter edged, and never a different cable.
    // AN OPEN LEAD IS NOT DIMMED. It carries no current, so it is drawn thin; it carries the full open
    // circuit voltage right up to the break, so it keeps its colour and its polarity, and the break
    // itself is marked amber. A stub drawn faint would say "safe", and it is the opposite of safe.
    // A BLACK CABLE ON A BLACK MODULE BACK IS NOTHING AT ALL. On the wiring drawing the negative is
    // given a pale body with a dark centre line down it - which is how a black cable actually catches
    // the light - and the pale part is at least a whole pixel each side on a telephone. The positive is
    // red and thick enough to follow with a finger. On the scale drawing, where the cable is a pencil
    // line beside a cell grid, the older fine treatment is kept.
    // A CABLE IS A TUBE. A light edge with a dark core is how a cable catches the light, and it is the
    // only way a BLACK cable on a dark module back can be seen at all: what the eye follows is the pair
    // of bright edges. Never thinner than five pixels in all, at any zoom, so a finger can follow it.
    if (D.wiring) {
      // A THIN, SHARP LINE with a dark casing under it, so it reads over the cell grid without being a
      // tube. The negative is the pale one with a dark centre - which is how a black cable catches the
      // light - and the positive is red. Broken where another cable passes over it.
      const core = Math.max(1.5, Math.min(3.2, perM * 0.022));
      const ink = lit ? '#eaf6ff' : s.open ? SHAPE_WARN : (s.plus ? (SHEET ? '#c0271a' : '#ff4b3a') : (SHEET ? '#8a94a2' : '#aebdd0'));
      const casing = SHEET ? '#f2f4f7' : '#05070b';
      const gaps = (s.breaks && s.breaks.length) ? s.breaks : null;
      const total = polyLen(s.pts).total * px, runs = [];
      if (!gaps) runs.push([0, 1]);
      else { const hw = Math.min(0.2, (core * 3.4) / Math.max(1e-6, total));
        const cut = gaps.map(u => [Math.max(0, u - hw), Math.min(1, u + hw)]).sort((a, b) => a[0] - b[0]);
        let at = 0;
        for (const [c0, c1] of cut) { if (c0 > at) runs.push([at, c0]); at = Math.max(at, c1); }
        if (at < 1) runs.push([at, 1]); }
      for (const [r0, r1] of runs) { const seg = polySlice(s.pts, r0, r1); if (seg.length < 2) continue;
        // THE CASING IS WHAT MAKES A THIN LINE READ OVER A CELL GRID: 1.5 px wider each side than the
        // line itself, laid down first along the same path, so the eye always sees the cable against
        // its own dark ground and never against a grid line. Still a line, not a tube.
        path(seg); ctx.lineWidth = core + 3.0; ctx.strokeStyle = casing; ctx.stroke();
        path(seg); ctx.lineWidth = core; ctx.strokeStyle = ink; ctx.stroke();
        if (!s.plus && !s.open) { path(seg); ctx.lineWidth = Math.max(0.6, core * 0.4);
          ctx.strokeStyle = SHEET ? '#20262f' : '#14181f'; ctx.stroke(); } }
      continue; }
    const core = s.plus ? SHAPE_RED : SHAPE_BLACK;
    const rim = lit ? '#eaf6ff' : s.open ? SHAPE_WARN : (s.plus ? (fused ? '#933428' : '#552722') : (fused ? '#a3b4c9' : SHAPE_EDGE));
    const grow = lit ? 1.7 : 1.0;
    path(s.pts); ctx.lineWidth = w + grow; ctx.strokeStyle = rim; ctx.stroke();
    path(s.pts); ctx.lineWidth = w; ctx.strokeStyle = fused ? core : dimColour(core, 0.62); ctx.stroke(); }
  // 3b. THE NEON HEAD, on the conductors that were actually drawn. The walk is not invented here: every
  //     conductor already carries the two terminals it joins, so the chain is followed from INV- by
  //     name - home run, lead, mate, lead, and box to box across each module - to INV+. If the chain
  //     breaks anywhere, or any lead is open, there is no walk and NOTHING lights: an open string
  //     carries no current, and a neon running over a break would be a lie. Speed is steady (the head
  //     is the sldTick clock); WEIGHT is the current, never the colour.
  if (D.head >= 0 && !D.open) {
    if (D.walk === null || D.walk === undefined) D.walk = buildStringWalk(D);
    const W = D.walk;
    if (W) {
      const hl = 0.055, h1 = D.head, spans = h1 - hl < 0 ? [[0, h1], [1 + h1 - hl, 1]] : [[h1 - hl, h1]];
      const amps = 1 + 0.5 * Math.min(1, (D.amps || 0) / 20);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.shadowColor = '#7ff0ff';
      for (const L of W.legs) for (const [a0, a1] of spans) {
        const a = Math.max(L.u0, a0), b = Math.min(L.u1, a1);
        if (b <= a) continue;
        if (L.s) { const d = Math.max(1e-9, L.u1 - L.u0);
          const seg = polySlice(L.s.pts, (a - L.u0) / d, (b - L.u0) / d);
          if (seg.length < 2 || !onScreen(seg)) continue;
          const wN = Math.max(2.2, (D.wiring ? Math.max(1.5, Math.min(3.2, perM * 0.022)) : fine * (L.s.weight || 1)) * 1.1) * amps;
          ctx.shadowBlur = wN * 2.6;
          path(seg); ctx.lineWidth = wN * 2.1; ctx.strokeStyle = 'rgba(86,214,255,0.22)'; ctx.stroke();
          path(seg); ctx.lineWidth = wN; ctx.strokeStyle = 'rgba(224,250,255,0.92)'; ctx.stroke(); }
        else if (L.mod && onScreen(L.mod.pts)) {      // box to box THROUGH the module: its own outline lights
          ctx.shadowBlur = 7 * amps;
          path(L.mod.pts); ctx.closePath(); ctx.lineWidth = Math.max(1.4, fine * 1.2) * amps;
          ctx.strokeStyle = 'rgba(120,232,255,0.55)'; ctx.stroke(); } }
      ctx.restore(); ctx.shadowBlur = 0; }
  }
  // 3. THE GAP, and what it is short by, said in metres
  for (const s of D.shapes) { if (s.role !== 'gap' || !onScreen(s.pts) || true) continue;
    const a = S(s.pts[0]), b = S(s.pts[1]);
    ctx.setLineDash([2.5, 3.5]); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
    ctx.lineWidth = hair; ctx.strokeStyle = SHAPE_WARN; ctx.stroke(); ctx.setLineDash([]);
    for (const p of [a, b]) { ctx.beginPath(); ctx.arc(p[0], p[1], 1.9, 0, 6.2832); ctx.fillStyle = SHAPE_WARN; ctx.fill(); }
    // WHAT IT IS SHORT BY, only when there is room for it to be read and never over a module's name.
    if (false) {
      } }
  // 5. THE BOXES AND WHAT SITS ON THEM, over the cable ends, so a cable is seen to enter its box.
  for (const s of D.shapes) {
    if (s.role === 'box') { if (!onScreen(s.pts)) continue;
      path(s.pts); ctx.closePath(); ctx.fillStyle = BOXFILL; ctx.fill();
      ctx.lineWidth = fine; ctx.strokeStyle = INK; ctx.stroke();
      // THE MIDDLE BOX HAS NO CABLE: it carries a bypass diode, and it is drawn as one so that nobody
      // takes it for a third connection.
      // EACH OF THE THREE BOXES HOLDS ONE BYPASS DIODE, one per cell string. The two outer boxes carry a
      // smaller mark of the same symbol, kept clear of the box edge where the lead lands.
      if (s.diodeOnly || s.diode) { const a = S(s.pts[0]), b = S(s.pts[2]);
        const cxm = (a[0] + b[0]) / 2, cym = (a[1] + b[1]) / 2, r2 = Math.min(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) * (s.diodeOnly ? 0.30 : 0.22);
        if (r2 > 2) { ctx.beginPath(); ctx.moveTo(cxm - r2, cym - r2); ctx.lineTo(cxm - r2, cym + r2); ctx.lineTo(cxm + r2, cym);
          ctx.closePath(); ctx.lineWidth = Math.max(0.8, fine * 0.6); ctx.strokeStyle = EDGE2; ctx.stroke();
          ctx.beginPath(); ctx.moveTo(cxm + r2, cym - r2); ctx.lineTo(cxm + r2, cym + r2); ctx.stroke(); } }
      continue; }
    if (s.role === 'terminal' && s.pts.length > 1) { if (!onScreen(s.pts)) continue;
      path(s.pts); ctx.lineWidth = fine; ctx.strokeStyle = INK; ctx.stroke(); continue; }
    if (s.role === 'tube') { if (!onScreen(s.pts)) continue;
      path(s.pts); ctx.lineWidth = hair; ctx.strokeStyle = EDGE2; ctx.stroke(); continue; }
    if (s.role === 'landing' && false) { const q = S(s.pts[0]);
      if (q[0] < -20 || q[0] > innerWidth + 20 || q[1] < -20 || q[1] > innerHeight + 20) continue;
      // THE DOT ON THE BOX where the cable lands. Small, but it is the difference between a cable that
      // joins a box and a line that happens to pass near one.
      const r2 = Math.max(1.6, Math.min(4, perM * 0.018));
      ctx.beginPath(); ctx.arc(q[0], q[1], r2, 0, 6.2832);
      ctx.fillStyle = s.plus ? (SHEET ? '#c0271a' : SHAPE_RED) : (SHEET ? '#20262f' : '#cfe0ee'); ctx.fill(); continue; }
    if (s.role === 'plug') { const q = S(s.pts[0]);
      if (q[0] < -20 || q[0] > innerWidth + 20 || q[1] < -20 || q[1] > innerHeight + 20) continue;
      // A CONNECTOR IS AN OBJECT, and the two halves are different objects: a plug is a barrel with a
      // collar, a socket is a sleeve with two latches. Facing each other across a gap, they say what is
      // wrong better than any words: these two were meant to meet and they do not.
      const a2 = s.along || [1, 0], L2 = Math.max(1e-6, Math.hypot(a2[0], a2[1]));
      const ux = a2[0] / L2, uy = a2[1] / L2, nx = -uy, ny = ux;
      const len = Math.max(7, Math.min(26, perM * 0.16)), rad = len * 0.30;
      const put2 = (px2, py2) => [q[0] + ux * px2 + nx * py2, q[1] + uy * px2 + ny * py2];
      ctx.lineWidth = Math.max(0.8, fine * 0.7); ctx.strokeStyle = INK; ctx.fillStyle = SHEET ? '#f3f5f8' : '#10151d';
      ctx.beginPath();
      if (s.male) { const a = put2(0, -rad), b = put2(len * 0.75, -rad * 0.55), c2 = put2(len * 0.75, rad * 0.55), d2 = put2(0, rad);
        ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c2[0], c2[1]); ctx.lineTo(d2[0], d2[1]); ctx.closePath(); }
      else { const a = put2(0, -rad), b = put2(-len * 0.8, -rad), c2 = put2(-len * 0.8, rad), d2 = put2(0, rad);
        ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c2[0], c2[1]); ctx.lineTo(d2[0], d2[1]); ctx.closePath(); }
      ctx.fill(); ctx.stroke();
      { const e = s.male ? put2(len * 0.3, 0) : put2(-len * 0.45, 0), f = s.male ? put2(len * 0.3, 0) : put2(-len * 0.45, 0);
        ctx.beginPath(); ctx.moveTo(e[0] + nx * rad, e[1] + ny * rad); ctx.lineTo(f[0] - nx * rad, f[1] - ny * rad);
        ctx.lineWidth = Math.max(0.8, fine * 0.5); ctx.strokeStyle = SHAPE_EDGE; ctx.stroke(); }
      continue; }
    if (s.role === 'mate') { const q = S(s.pts[0]);
      if (q[0] < -20 || q[0] > innerWidth + 20 || q[1] < -20 || q[1] > innerHeight + 20) continue;
      // WHERE RED BECOMES BLACK: the mated pair, as a small lozenge across the cable, so a reader can
      // see that two leads meet here rather than one cable changing its mind about its colour.
      const a2 = s.along || [1, 0], L2 = Math.max(1e-6, Math.hypot(a2[0], a2[1]));
      const ux = a2[0] / L2, uy = -a2[1] / L2, r2 = Math.max(2.6, Math.min(7, perM * 0.035)), r3 = r2 * 0.5;
      ctx.beginPath();
      ctx.moveTo(q[0] + ux * r2, q[1] + uy * r2); ctx.lineTo(q[0] - uy * r3, q[1] + ux * r3);
      ctx.lineTo(q[0] - ux * r2, q[1] - uy * r2); ctx.lineTo(q[0] + uy * r3, q[1] - ux * r3);
      ctx.closePath(); ctx.fillStyle = SHEET ? '#f3f5f8' : '#0a0d13'; ctx.fill();
      ctx.lineWidth = Math.max(0.8, fine * 0.8); ctx.strokeStyle = INK; ctx.stroke(); continue; }
    if (s.role === 'slack') { if (!onScreen(s.pts)) continue;
      path(s.pts); ctx.lineWidth = fine + 0.9; ctx.strokeStyle = SHAPE_EDGE; ctx.stroke();
      path(s.pts); ctx.lineWidth = fine; ctx.strokeStyle = SHAPE_BLACK; ctx.stroke(); continue; }
    if (s.role === 'joint' && perM > 18) { const p = S(s.pts[0]);
      if (p[0] < -20 || p[0] > innerWidth + 20) continue;
      ctx.beginPath(); ctx.arc(p[0], p[1], 1.7, 0, 6.2832); ctx.fillStyle = '#0a0d13'; ctx.fill();
      ctx.lineWidth = hair; ctx.strokeStyle = SHAPE_INK; ctx.stroke(); } }
  // 5. THE MARKS: - and + beside every box and terminal, and the module's name under it, on whole pixels
  // WORDS ARE DROPPED, NEVER OVERLAPPED. The polarity marks and the module names go down first, then
  // the numbers on the links, nearest the near end first; anything that would land on something already
  // written is simply not written. A crowded drawing loses labels; it never turns into a smear.
  ctx.textBaseline = 'middle';
  const placed = [];
  const order2 = D.marks.map((m, i) => [m, i]).sort((a, b) => ((a[0].rank || 0) - (b[0].rank || 0)) || (a[0].x - b[0].x));
  for (const [m] of order2) { if (perM < (m.minPx || 0)) continue;
    const p = S([m.x, m.y]); if (p[0] < -40 || p[0] > innerWidth + 40 || p[1] < -20 || p[1] > innerHeight + 20) continue;
    ctx.font = '600 ' + m.size + 'px ui-monospace,Menlo,Consolas,monospace';
    const w2 = ctx.measureText(m.text).width, h2 = m.size + 3;
    const x0 = Math.round(p[0]) - (m.mid ? w2 / 2 : 0), y0 = Math.round(p[1]) - h2 / 2;
    const box2 = [x0 - 1, y0, x0 + w2 + 1, y0 + h2];
    if (m.dodge) { let clash = false;
      for (const q of placed) if (box2[0] < q[2] && box2[2] > q[0] && box2[1] < q[3] && box2[3] > q[1]) { clash = true; break; }
      if (clash) continue; }
    placed.push(box2);
    ctx.textAlign = m.mid ? 'center' : 'left';
    ctx.fillStyle = SHEET ? (m.colour === SHAPE_RED ? '#b3271a' : m.colour === SHAPE_WARN ? '#8a6100' : '#10151c') : m.colour;
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
