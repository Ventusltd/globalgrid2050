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

// ===== THE SYSTEMS OF THE ESTATE: A PULSE FOR EACH ===========================================
// The soul of the grid, isolated: a local run over the whole estate found the systems, and each one is
// DATA here, exactly as the menu above is data. A system is a set of FILES, and a body on this disc is a
// piece of work, so a system's bodies are the work whose repository is one of the system's repositories
// AND that touched a file under one of that repository's folders. Nothing is animated here: the pulse,
// the dimming, the lit colour and the ending card are the engine's own (isolate / isolateNow / appCard).
// WHAT I ADDED AND WHY. The frozen record on the disc holds, per body: repository index, commit id, lines,
// day. It holds NO path, so the menu's select.repository can only light a WHOLE repository. The paths are
// in the estate's own table kuiper-work.mjs (commit id -> the files it changed), which the card part already
// loads on demand through workTable(). So the one hook is: select.prefixes, honoured where a system's work
// list is built (systemWork below), by reading that same table. No other selection path is touched.
const SYSTEMS = [
  { id:"030-network-topology", system:"network topology graphs: nodes, edges, buses, branches", kind:"electrical", connected:true, files_total:1706, button:"NETWORK TOPOLOGY GRAPH", says:"These files describe how the grid joins up: the nodes, the busbars and the branches that connect them into one network.", author:"opus agent 30 of 100, 20 Sept 2026",
    repos:[{ repo:"globalgrid2050", files:747, prefixes:["testcode/202609052011","testcode/202609052015","testcode/202609052020","testcode/202609052023","testcode/202609052008","testcode/202609051958"] }, { repo:"testcode", files:528, prefixes:["sandbox/202609052028","sandbox/202609052011","sandbox/202609052015","sandbox/202609052020","sandbox/202609052023","sandbox/202609052008"] }, { repo:"solar-electrical-topology-analysis-engine-text-based", files:374, prefixes:["src/solar_topology","docs/quantum-spawn","v10-development/recovery","docs/trueself","docs/refinement",".github/workflows"] }] },
  { id:"013-single-line-diagrams", system:"single line diagrams (SLD) and schematic drawing code", kind:"electrical", connected:true, files_total:1557, button:"SINGLE LINE DIAGRAMS (", says:"These files are the single line and schematic drawings that show how the electrical system is wired together.", author:"opus agent 13 of 100, 20 Sept 2026",
    repos:[{ repo:"globalgrid2050", files:531, prefixes:["testcode/202609052011","testcode/202609052015","testcode/202609052020","testcode/202609052023",".github/workflows","testcode/202609051905"] }, { repo:"particle-physics-drawing-engine", files:465, prefixes:["results/msi","results/20260918T0056Z","results/20260918T0101Z","results/20260918T0118Z","results/20260918T0125Z","results/20260918T0127Z"] }, { repo:"testcode", files:327, prefixes:["sandbox/202609052028","sandbox/202609052011","sandbox/202609052015","sandbox/202609052020","sandbox/202609052023","sandbox/202609051905"] }] },
  { id:"010-primary-substations", system:"primary substations 33/11 kV", kind:"electrical", connected:true, files_total:1503, button:"PRIMARY SUBSTATIONS 33", says:"These files describe the primary substations that step 33 kV down to 11 kV and feed the local distribution network.", author:"opus agent 10 of 100, 20 Sept 2026",
    repos:[{ repo:"globalgrid2050", files:657, prefixes:["testcode/202609052011","testcode/202609052015","testcode/202609052020","testcode/202609052023",".github/workflows","testcode/202609051905"] }, { repo:"testcode", files:384, prefixes:["sandbox/202609052028","sandbox/202609052011","sandbox/202609052015","sandbox/202609052020","sandbox/202609052023","sandbox/202609051905"] }, { repo:"gridatlas", files:270, prefixes:["atlas/cartridges","atlas/manifests","tools/proofs","atlas/parts","atlas/releases","atlas/modules"] }] },
  { id:"033-inverters", system:"solar and battery inverters, MPPT, PCS", kind:"electrical", connected:true, files_total:1430, button:"SOLAR AND BATTERY INVE", says:"These files describe the machines that turn solar and battery direct current into grid alternating current, and how they are sized, grouped and controlled.", author:"opus agent 33 of 100, 20 Sept 2026",
    repos:[{ repo:"globalgrid2050", files:810, prefixes:["testcode/202609052011","testcode/202609052015","testcode/202609052020","testcode/202609052023","testcode/202609052008","testcode/202609051958"] }, { repo:"testcode", files:528, prefixes:["sandbox/202609052028","sandbox/202609052011","sandbox/202609052015","sandbox/202609052020","sandbox/202609052023","sandbox/202609052008"] }, { repo:"chatgpt-audits", files:29, prefixes:["202608310033-study/PROJECT-STUDIES"] }] },
  { id:"100-cosmos-galaxies", system:"stars, galaxies and cosmic structure models (non-grid connected systems)", kind:"physics", connected:true, files_total:917, button:"STARS, GALAXIES AND CO", says:"These lit files hold the star, galaxy and cosmic structure models that draw the sky the disc sits in.", author:"opus agent 100 of 100, 20 Sept 2026",
    repos:[{ repo:"galaxies-wafers", files:735, prefixes:["iterations/12-visibility-lab","layers/modules","iterations/22-fast-zoom","layers/tiles","iterations/11-the-bond","iterations/14-electrical-hops"] }, { repo:"Kuiper-belt", files:169, prefixes:["cosmos/commits","data/20260918T234405Z","data/20260918T234855Z","data/20260919T001154Z","data/20260918T231829Z","data/20260918T234128Z"] }, { repo:"kuiper-belt", files:9, prefixes:[".gitattributes","ABOUT.md","EVIDENCE.md","LAWS.md","LICENSE","README.md"] }] },
  { id:"099-particle-physics", system:"particle tracks, detectors and physics drawing systems (non-grid connected systems)", kind:"physics", connected:true, files_total:468, button:"PARTICLE TRACKS, DETEC", says:"These lit files are the particle and physics drawing code: the engines that draw moving points, tracks and detector pictures.", author:"opus agent 99 of 100, 20 Sept 2026",
    repos:[{ repo:"particle-physics-drawing-engine", files:465, prefixes:["results/msi","results/20260918T0056Z","results/20260918T0101Z","results/20260918T0118Z","results/20260918T0125Z","results/20260918T0127Z"] }, { repo:"globalgrid2050", files:2, prefixes:["testcode/202609142225","testcode/202609160224"] }, { repo:"galaxies-wafers", files:1, prefixes:["iterations/03-code-particle"] }] },
  { id:"032-solar-dc-strings", system:"PV DC strings, modules, junction boxes, string wiring", kind:"electrical", connected:true, files_total:443, button:"PV DC STRINGS, MODULES", says:"These files describe the DC side of a solar farm: the panels, how they are wired into strings, and the boxes where those strings come together.", author:"opus agent 32 of 100, 20 Sept 2026",
    repos:[{ repo:"chatgpt-audits", files:161, prefixes:["202608310033-study/PROJECT-STUDIES"] }, { repo:"globalgrid2050", files:145, prefixes:["testcode/202609051958","testcode/202609052008","testcode/202609052011","testcode/202609052015","testcode/202609052020","testcode/202609052023"] }, { repo:"testcode", files:119, prefixes:["sandbox/202609051958","sandbox/202609052008","sandbox/202609052011","sandbox/202609052015","sandbox/202609052020","sandbox/202609052023"] }] },
  { id:"005-distribution-33kv", system:"33 kV circuits and primary networks", kind:"electrical", connected:true, files_total:196, button:"33 KV CIRCUITS AND PRI", says:"These files describe the 33 kV primary network: the feeders, cables, switchgear and primary substations that carry power from bulk supply points down to the 11 kV network.", author:"opus agent 5 of 100, 20 Sept 2026",
    repos:[{ repo:"globalgrid2050", files:129, prefixes:["repd_grid_atlasv6/data","repd_grid_atlasv7/data","repd_grid_atlasv8/data","pipelinenews_intelligence/202608311858","pipelinenews_intelligence/202608312037","pipelinenews_intelligence/202608312056"] }, { repo:"pipelinenews", files:66, prefixes:["releases/202608311858-pipelinenews","releases/202608312018-pipelinenews","releases/202608312037-pipelinenews","releases/202608312056-pipelinenews","releases/202608312109-pipelinenews","releases/202608312114-pipelinenews"] }, { repo:"chatgpt-audits", files:1, prefixes:["202608310033-study/PROJECT-STUDIES"] }] },
  { id:"064-rivers", system:"rivers and watercourses", kind:"water", connected:true, files_total:172, button:"RIVERS AND WATERCOURSE", says:"These lit files map the rivers, streams and watercourses the network must cross, follow or keep clear of.", author:"opus agent 64 of 100, 20 Sept 2026",
    repos:[{ repo:"teleprinter", files:98, prefixes:["drivers/codex","drivers/gridatlas"] }, { repo:"chatgpt-audits", files:37, prefixes:["202608310033-study/PROJECT-STUDIES"] }, { repo:"gpu-drivers-for-global-grid", files:29, prefixes:["claude/results",".gitattributes",".github/workflows",".gitignore","README.md","claude/README.md"] }] },
  { id:"016-overhead-lines", system:"overhead lines, conductors, towers, spans, sag", kind:"electrical", connected:true, files_total:145, button:"OVERHEAD LINES, CONDUC", says:"These files describe the overhead lines that carry power through the air: the conductors, the towers that hold them and how far each span is allowed to sag.", author:"opus agent 16 of 100, 20 Sept 2026",
    repos:[{ repo:"globalgrid2050", files:63, prefixes:["repd_grid_atlasv6/data","repd_grid_atlasv7/data","repd_grid_atlasv8/data","testcode/202609051901","testcode/202609051905","testcode/202609051906"] }, { repo:"testcode", files:51, prefixes:["sandbox/202609051901","sandbox/202609051905","sandbox/202609051906","sandbox/202609051927","sandbox/202609051932","sandbox/202609051936"] }, { repo:"gridatlas", files:12, prefixes:["atlas/releases","atlas/world","governance/202609011515-400kv-customer-substation-study.md"] }] },
  { id:"009-grid-supply-points", system:"grid supply points and bulk supply points", kind:"electrical", connected:true, files_total:142, button:"GRID SUPPLY POINTS AND", says:"These files are the high voltage supply points where the transmission network hands power to the local distribution network.", author:"opus agent 9 of 100, 20 Sept 2026",
    repos:[{ repo:"globalgrid2050", files:63, prefixes:["repd_grid_atlasv6/data","repd_grid_atlasv7/data","repd_grid_atlasv8/data","testcode/202609051901","testcode/202609051905","testcode/202609051906"] }, { repo:"testcode", files:51, prefixes:["sandbox/202609051901","sandbox/202609051905","sandbox/202609051906","sandbox/202609051927","sandbox/202609051932","sandbox/202609051936"] }, { repo:"gridatlas", files:12, prefixes:["atlas/releases","atlas/world","governance/202609011515-400kv-customer-substation-study.md"] }] },
  { id:"018-subsea-cables", system:"subsea and offshore export cables", kind:"electrical", connected:true, files_total:125, button:"SUBSEA AND OFFSHORE EX", says:"These files describe the cables that carry power under the sea from offshore generation to the shore.", author:"opus agent 18 of 100, 20 Sept 2026",
    repos:[{ repo:"globalgrid2050", files:98, prefixes:["uk_energy_tracking_v6/generation_history","uk_renewables_pipeline/202609071221","uk_renewables_pipeline/202609081016","uk_renewables_pipeline/202609082224",".github/workflows","data_science_protocol/audit_reports"] }, { repo:"data-interconnectors", files:11, prefixes:[".gitattributes",".github/workflows","CHANGELOG.md","DATA_SOURCES.md","DEPENDENCIES.md","IMPLEMENTATION.md"] }, { repo:"gridatlas", files:6, prefixes:["atlas/data","tools/interconnectors","atlas/interconnectors.config.json"] }] },
  { id:"017-underground-cables", system:"underground cable routes, ducts, joints, trenches", kind:"electrical", connected:true, files_total:110, button:"UNDERGROUND CABLE ROUT", says:"These files trace the buried cable routes, their ducts, trenches and joint bays that carry power out of sight beneath the ground.", author:"opus agent 17 of 100, 20 Sept 2026",
    repos:[{ repo:"particle-physics-drawing-engine", files:60, prefixes:["results/msi","results/20260918T0056Z","results/20260918T0101Z","results/20260918T0118Z","results/20260918T0125Z","results/20260918T0127Z"] }, { repo:"cable-trench-or-drill", files:36, prefixes:["releases/202609052001","releases/202609051921",".github/workflows","src/route-constraints",".gitattributes","DEVELOPMENT-PLAN.md"] }, { repo:"globalgrid2050", files:12, prefixes:["gridbot_reports/v4_pinned_cable_route_tool_rollback.md","london_underground.geojson","repd_grid_atlasv6/data","repd_grid_atlasv6/scripts","repd_grid_atlasv7/data","repd_grid_atlasv7/scripts"] }] },
  { id:"015-hvdc", system:"HVDC links and converter stations", kind:"electrical", connected:true, files_total:96, button:"HVDC LINKS AND CONVERT", says:"These files describe the direct current links and the converter stations at each end that move bulk power between distant parts of the grid.", author:"opus agent 15 of 100, 20 Sept 2026",
    repos:[{ repo:"globalgrid2050", files:71, prefixes:["uk_energy_tracking_v6/generation_history","uk_renewables_pipeline/202609071221","uk_renewables_pipeline/202609081016","uk_renewables_pipeline/202609082224",".github/workflows","data_science_protocol/audit_reports"] }, { repo:"data-interconnectors", files:11, prefixes:[".gitattributes",".github/workflows","CHANGELOG.md","DATA_SOURCES.md","DEPENDENCIES.md","IMPLEMENTATION.md"] }, { repo:"gridatlas", files:5, prefixes:["atlas/data","tools/interconnectors","atlas/interconnectors.config.json"] }] },
  { id:"006-distribution-11kv", system:"11 kV feeders and ring mains", kind:"electrical", connected:true, files_total:62, button:"11 KV FEEDERS AND RING", says:"These files are the medium-voltage distribution layer: the 11 kV feeders, ring mains and the substations they link.", author:"opus agent 6 of 100, 20 Sept 2026",
    repos:[{ repo:"globalgrid2050", files:36, prefixes:["repd_grid_atlasv6/data","repd_grid_atlasv6/scripts","repd_grid_atlasv7/data","repd_grid_atlasv7/scripts","repd_grid_atlasv8/data","repd_grid_atlasv8/scripts"] }, { repo:"testcode", files:17, prefixes:["sandbox/202609051901","sandbox/202609051905","sandbox/202609051906","sandbox/202609051927","sandbox/202609051932","sandbox/202609051936"] }, { repo:"galaxies-wafers", files:3, prefixes:["iterations/25-one-feeder"] }] },
  { id:"004-distribution-66kv", system:"66 kV circuits", kind:"electrical", connected:true, files_total:44, button:"66 KV CIRCUITS", says:"These lit files are the 66 kV circuits: the sub-transmission layer that carries power from the big grid substations out to the local distribution network.", author:"opus agent 4 of 100, 20 Sept 2026",
    repos:[{ repo:"globalgrid2050", files:24, prefixes:["grid_66kv.geojson","repd_grid_atlasv6/data","repd_grid_atlasv6/scripts","repd_grid_atlasv7/data","repd_grid_atlasv7/scripts","repd_grid_atlasv8/data"] }, { repo:"testcode", files:17, prefixes:["sandbox/202609051901","sandbox/202609051905","sandbox/202609051906","sandbox/202609051927","sandbox/202609051932","sandbox/202609051936"] }, { repo:"gridatlas", files:3, prefixes:["atlas/releases"] }] },
  { id:"057-a-roads", system:"A roads and primary routes", kind:"transport", connected:true, files_total:38, button:"A ROADS AND PRIMARY RO", says:"These files trace the main roads and primary routes the grid must follow, cross or avoid.", author:"opus agent 57 of 100, 20 Sept 2026",
    repos:[{ repo:"chatgpt-audits", files:16, prefixes:["202608310033-study/PROJECT-STUDIES"] }, { repo:"globalgrid2050", files:16, prefixes:[".github/workflows","motorway_services.geojson","repd_grid_atlasv6/.github","repd_grid_atlasv6/data","repd_grid_atlasv6/scripts","repd_grid_atlasv7/.github"] }, { repo:"data-gridatlas", files:3, prefixes:["202608291237-data-gridatlas/data"] }] },
  { id:"056-motorways", system:"motorways and the strategic road network", kind:"transport", connected:true, files_total:26, button:"MOTORWAYS AND THE STRA", says:"These files describe the motorway and main road network, its junctions, crossings and verges, and where cables and routes follow or cross it.", author:"opus agent 56 of 100, 20 Sept 2026",
    repos:[{ repo:"globalgrid2050", files:14, prefixes:[".github/workflows","motorway_services.geojson","repd_grid_atlasv6/.github","repd_grid_atlasv6/data","repd_grid_atlasv6/scripts","repd_grid_atlasv7/.github"] }, { repo:"chatgpt-audits", files:10, prefixes:["202608310033-study/PROJECT-STUDIES"] }, { repo:"data-gridatlas", files:2, prefixes:["202608291237-data-gridatlas/data"] }] },
  { id:"051-railway-lines", system:"railway lines and track geometry", kind:"transport", connected:true, files_total:20, button:"RAILWAY LINES AND TRAC", says:"These lit files describe railway routes, track alignment and the equipment that runs along the line.", author:"opus agent 51 of 100, 20 Sept 2026",
    repos:[{ repo:"globalgrid2050", files:11, prefixes:["repd_grid_atlasv8/scripts",".github/workflows","railways.geojson","repd_grid_atlasv6/data","repd_grid_atlasv6/scripts","repd_grid_atlasv7/data"] }, { repo:"chatgpt-audits", files:5, prefixes:["202608310033-study/PROJECT-STUDIES"] }, { repo:"gridatlas", files:3, prefixes:["atlas/releases"] }] }
];
// ONE MENU-STYLE ENTRY PER SYSTEM, made when it is fired and not before, so the face keeps its own few
// buttons and 19 more are never drawn on it.
function systemFind(q){ q = String(q || '').trim().toLowerCase(); if (!q) return null;
  return SYSTEMS.find(s => s.id.toLowerCase() === q) || SYSTEMS.find(s => s.system.toLowerCase() === q)
      || SYSTEMS.find(s => s.id.toLowerCase().startsWith(q)) || SYSTEMS.find(s => s.system.toLowerCase().startsWith(q))
      || SYSTEMS.find(s => s.system.toLowerCase().includes(q)) || null; }
// THE SELECTION: the work of this system's repositories whose changed files sit under this system's folders.
function systemWork(sys, W){ const out = [];
  for (const r of sys.repos) { const ri = repos.findIndex(x => x.name === r.repo); if (ri < 0) continue;
    for (const c of commits) { if (c.repo !== ri) continue;
      const w = W && W[c.sha]; if (!w) continue;                     // no file list for it: it is not claimed
      let hit = false;
      for (let i = 2; i < w.length && !hit; i++) { const p = w[i] && w[i][0];
        if (p) for (const pre of r.prefixes) if (p.indexOf(pre) === 0) { hit = true; break; } }
      if (hit) out.push(c.sha); } }
  return out; }
function systemProgram(sys){
  const name = 'sys-' + sys.id;
  if (!apps.find(x => x.app === name)) apps.push({ app:name, button:sys.button, repo:sys.repos[0] ? sys.repos[0].repo : '', prefixes:sys.repos[0] ? sys.repos[0].prefixes : [], live:'' });
  if (!programs.find(x => x.name === name)) programs.push({ name, button:sys.button,
    select:{ app:name, repository:sys.repos[0] ? sys.repos[0].repo : '', prefixes:sys.repos.map(r => ({ repo:r.repo, prefixes:r.prefixes })) },
    pulse:{ origin:'centre', seconds:1.5 }, off:{ dim:0.1 },
    on:{ colour:[0.80,0.96,1.0], size:0, bright:0, sparks:6, sequence:[{ shape:'cluster', hold_ms:1200 }] },
    end:{ tile:'system' }, says:sys.says });
  return name; }
// FIRE A SYSTEM: read the estate's file table, make the selection, then hand it to the engine's own pulse.
let systemShown = null;
function fireSystem(q){ const sys = systemFind(q); if (!sys) return Promise.resolve(null);
  const name = systemProgram(sys);
  return (typeof workTable === 'function' ? workTable() : Promise.resolve(null)).then(W => {
    appWork[name] = systemWork(sys, W);
    systemShown = sys; isolate(name);
    return { id:sys.id, lit:appWork[name].length, files_total:sys.files_total }; }); }
// THE CARD AT THE END OF THE PULSE: the engine's own card, then the system's plain words under it. Where no
// address is known for a system, the OPEN tile is taken off rather than a link invented.
function systemCard(st, sys){ appCard(st);
  const tile = card.querySelector('.cc-tile'); if (tile && !st.app.live) tile.remove();
  const put = (s, cls) => card.append(el('div', cls || 'cc-plain', s));
  put(sys.system, 'cc-title'); put(sys.kind + ' · ' + fmt(st.lit) + ' pieces of work lit · the run counted ' + fmt(sys.files_total) + ' files in all');
  for (const r of sys.repos) put(r.repo + ' · ' + fmt(r.files) + ' files · ' + r.prefixes.join('  '));
  if (sys.says) put(sys.says);
  put('found by: ' + sys.author);
  if (typeof layout === 'function') layout(); }
// THE TYPED WORDS. "systems" lists them in plain text; "system <id or name>" fires that one.
function systemsList(){ return SYSTEMS.map(s => s.id + '  ' + s.system + '  · ' + s.files_total + ' files').join(String.fromCharCode(10)); }
if (typeof window !== 'undefined') { window.KUIPER_SYSTEMS = { all:SYSTEMS, list:systemsList, fire:fireSystem, find:systemFind };
  try { if (window.FIRE && window.FIRE.register) {
    window.FIRE.register('systems', 'THE ESTATE', () => ({ numbers:{ systems:SYSTEMS.length }, said:systemsList(), how:'found by a run over every file of the estate' }));
    window.FIRE.register('system', 'THE ESTATE', i => { const s = systemFind(i && (i.id || i.name)); if (!s) throw new Error('no such system; type "systems" for the list');
      fireSystem(s.id); return { numbers:{ files:s.files_total }, said:s.system + ' — its pulse is running on the disc', how:'the work of ' + s.repos.map(r => r.repo).join(', ') + ' under the folders of this system' }; }); } } catch (_) {}
}

// ===== GRID TUBE MAP: START =====================================================================
// WHAT THIS IS FOR. Not a single line diagram. A commercial and financial modelling picture of the
// energy transition, drawn the way an underground map is drawn: a traveller does not need to know
// how a train works to use the map to travel. So there are no inverters, no transformers and no
// surge arresters here. TWO SYSTEMS ONLY: every substation with a real coordinate, and the 132 kV
// network that joins them. ONE CLICK puts a Faraday CAGE around what we need to look at; TWO CLICKS
// open the card that says, in words, what that station is.
// WHAT IS REUSED AND WHAT IS NEW. The camera, the zoom and the nine pixel text floor are the
// engine's (shapePoint / shapeScale / TEXT_FLOOR_PX); the layer is made the way shapeLayer makes
// one; the frame pump is the shell's own onDraw, so there is NO second animation system here - the
// sweep advances on the frames the wafer already draws and asks for the next by setting dirty. The
// card is the engine's card element and its own classes. The palette adds five colours and no more.
/* TUBE-DATA:START */ const TUBE_DATA = {"attribution":"Contains open map data \u00a9 OpenStreetMap contributors, available under the Open Database License (ODbL) v1.0. Any derived database must be shared alike under the same licence. https://www.openstreetmap.org/copyright","made":"2026-09-20T16:47:38Z","source":"open map data substations + 132 kV lines; topology only, no capacity","kvOrder":[400,275,220,132,66],"snapToleranceM":2000,"defaults":{"index":61556604,"pitch_m":6500,"rotation_deg":30.0,"label_slot_order":[1,0,3,2],"collision_order":7,"offset_x_16ths":1,"offset_y_16ths":10,"hops":2,"simplify_km":0.0,"mean_score":36.0},"stationFields":["id","lon","lat","kvClass","degree","name"],"stations":[["s3e0f4836990",1.62211,51.43742,132,1,null],["sc55b55ddf85",1.2384,51.7298,132,1,null],["s062d1e84bf5",-3.27011,53.98746,132,0,"Substation for Barrow Windfarm"],["sc20c3633550",-3.41119,54.07852,132,1,null],["se16d0e7f343",-4.44699,50.91624,33,0,"East Youlstone 33kv WFarm"],["s670fdf69e38",0.30288,51.45251,33,0,"Swanscombe"],["sf62948051a5",0.3029,51.45248,33,0,"APCM Swanscombe"],["sd958f90e36f",-4.92647,50.46389,33,0,"Winnards Perch 33kv Solar"],["s1f444ef47cb",-2.05493,53.00165,33,0,"Heywood Grange Farm"],["sb7ffd20f76f",-2.24527,53.0329,33,0,"Staunch Standby"],["s9216912a9d8",-2.11521,52.67264,33,0,"Four Ashes EFW"],["sc08c5192a59",-3.99182,51.69623,33,0,"Gelliwern Isaf PV Substation"],["s48b63328179",-4.0318,51.78462,33,0,"Pen y Cae Solar Farm Substation"],["sc6191443780",-4.02132,51.79653,33,0,"Saron Solar Farm Substation"],["s7e510b36fa4",-5.18373,50.19813,33,0,"Pencoose 33kv Solar Park"],["s02de4a20b5f",-5.13124,50.17681,33,0,"Roskrow Barton 33kv Solar"],["sf56c1c702c1",-5.1862,50.1523,33,0,"Little Trevease Fm Solar"],["s932c2a03a3e",-5.18152,50.15775,33,0,"Nancrossa 33kv Solar Park"],["s0aa31bfbc98",-5.36842,50.20998,33,0,"Hope 33kV Solar Park"],["s8cb7850ca55",-5.36519,50.2161,33,0,"Churchtown Farm 33kv Solar"],["s28ef4914eeb",-4.83953,50.32496,33,0,"Ninnis 33kV Solar Park"],["s5a5ab2d4fce",-4.94622,50.36446,33,0,"Burthy 33kv Solar Park"],["sc1a4991a618",-4.90442,50.35809,33,0,"St Stephen 33kV Solar Park"],["s141ead51136",-5.12825,50.29345,33,0,"Garvinack Farm 33kv Solar"],["s6eba29b1f21",-5.11425,50.28547,33,0,"Causilgey 33kV Solar Park"],["s4cfd082aeb0",-5.01536,50.30449,33,0,"Tregassow 33kV Solar Farm"],["s9512cd5be11",-5.13827,50.30269,33,0,"Fourburrows Pendown"],["s8109aa0d8e7",-5.20006,50.29064,33,0,"Gover Park 33kV Solar Park"],["s5bd31f1f086",-4.1194,50.81601,33,0,"Willsland 33kV Solar Park"],["s819abe7a677",-4.41901,50.89408,33,0,"Forestmoor Windfarm"],["s73049e73ff2",-4.43255,50.81811,33,0,"Pitworthy 33kV Solar Park"],["sad739c002aa",-4.34743,50.97402,33,0,"Walland Farm 33kv Solar Pk"],["s29b59e21bea",-4.44016,50.86774,33,0,"East Langford 33kv Solar"],["s0082c3b203c",-4.03846,50.92144,33,0,"Beaford 33kV Solar Farm"],["sff481d5c406",-4.4396,50.78112,33,0,"Bradford Manor 33kV Solar"],["sd876c4c7cd8",-4.29789,50.80217,33,0,"Foxcombe 33kV Solar Park"],["se519ac74371",-4.14246,51.00354,33,0,"Cleave Farm 33kV Solar Pk"],["s3221d4750c3",-4.23245,50.68592,33,0,"Rexon Cross Farm Solar Pk"],["s9b080d5239e",-4.1208,50.98576,33,0,"Knockworthy Farm Solar Pk"],["sae92aab9b54",-4.30166,50.75566,33,0,"Ashwater Solar Park"],["sc77d2108b1f",-4.40343,50.78959,33,0,"Crinacott Farm Solar"],["s5b0b0c67312",-4.11761,50.95323,33,0,"Week Farm 33kV Solar Park"],["sf24341b6178",-4.36977,50.79964,33,0,"Derriton Fields Solar"],["s42a96265d7d",-4.33375,50.77326,33,0,"Eastacombe Fm Solar"],["sdb273db38d1",-4.94895,50.49457,33,0,"Trenouth Farm 33kv Solar"],["sd1e4f4ccd6d",-4.23705,50.44631,33,0,"North Wayton 33kV Solar Pk"],["sa347dc17d97",-4.925,50.42379,33,0,"Trekenning Farm 33kV Solar"],["s203cce856af",-4.44829,50.40851,33,0,"Trewidland Farm 33kV Solar"],["s22b20c6aedc",-4.01132,50.38826,33,0,"Langage Energy Centre"],["s2e0fd75b3f3",-3.64555,50.35833,33,0,"Yonder Park 33kV Solar Pk"],["sf5bea63d252",-3.58947,50.423,33,0,"Alders Way 33kv Stor"],["s16b5a1f4048",-3.72926,50.44072,33,0,"Bidwell 33kv Solar Park"],["sf9a71d651b2",-3.74715,50.35669,33,0,"Place Barton Farm 33kv"],["s3e5505b0635",-4.59542,50.39164,33,0,"Langunnett Farm Solar Pk"],["s639cb3fefa6",-4.02529,50.43017,33,0,"Portworthy Dams 33kv Solar"],["s9e3dbfe2fd5",-4.69879,50.47036,33,0,"Tulip"],["s6f3748c757e",-4.80722,50.42298,33,0,"Woodland Barton Solar Pk"],["sa690b40459c",-4.37971,50.47201,33,0,"Ford Farm 33kV Solar Park"],["s042d1a0d6e6",-4.37466,50.40279,33,0,"Wilton Farm 33kv Solar Pk"],["s67d103afcf8",-4.02827,50.36071,33,0,"Balls Wood 33kv Solar Park"],["s2bc7260e365",-3.61111,50.57258,33,2,"Heathfield Landfill Substation"],["s40e332b9354",-4.73538,50.48479,33,0,"Bodiniel 33kV Solar Park"],["s051951513ad",-4.29337,50.44654,33,0,"Howton Farm 33kv Solar Pk"],["s13f5151768c",-4.31415,50.47602,33,0,"Newton Barton 33kv Solar P"],["sc8a915bb590",-3.76671,50.29645,33,0,"Slade Farm 33kV Solar Park"],["sd45a936229f",-3.76225,50.38864,33,0,"Coombeshead Farm 33kv Solar"],["s59179e5e205",-4.81557,50.44057,33,0,"Kerriers 33kV Solar Park"],["s30dc1b49a5f",-4.3582,50.40078,33,0,"Trerule 33kv Solar Park"],["s2aee212fac6",-3.79467,50.42716,33,0,"Marley Thatch Farm Solar"],["sb0ecdca0691",-3.63234,50.50716,33,0,"Rydon Farm Solar Park"],["sc506c6a1d51",-4.80253,50.52395,33,0,"Middle Treworder Farm Solar"],["s053ced640e2",-4.73278,50.48418,33,0,"Outlands Wood Solar"],["se8eb99c54d9",-4.3789,50.40358,33,0,"Wilton Farm Wind Farm Substation"],["s767371a9241",-3.68064,51.01723,33,0,"Bommertown Solar Park"],["s861d9d498af",-3.66119,50.35188,33,0,"Old Stone Farm Solar"],["s94bfc615072",-4.56665,50.43319,33,0,"Connon Bridge Landfill"],["s16e73a11ecc",-4.96409,50.46675,33,0,"Denzell Downs Wind Farm Substation"],["sbaba25c3cc2",-4.34799,50.54253,33,0,"Trefinnick Farm Solar Farm"],["s8cc0027824c",-3.74579,50.50487,33,0,"Parkview 33kv Solar Park"],["s18cbdb66093",-4.94988,50.4709,33,0,"Bears Down Wind Farm"],["sb51eff9b495",-4.42553,50.45274,33,0,"Higher Trevartha Solar Fm"],["scca3e9f6977",-3.76218,50.42119,33,0,"Hazard Farm 33kV Solar Pk"],["sb5c0222a037",-3.32518,51.41222,33,2,"Derwyn 33kV Solar Farm"],["s3d760829c0c",-2.98916,51.11263,33,0,"Huntworth Generator"],["se0994e657af",-2.93012,50.78208,33,0,"Wyld Meadow 33kv Solar Pk"],["s3fef02a8088",-2.8691,50.93879,33,0,"Hurcott 33kv Solar Park"],["sc17d5fb82cb",-3.38305,50.65018,33,0,"Bystock Farm 33kv Solar Pk"],["s9569c799fb8",-2.58548,51.20923,33,0,"Pitts Fm. Solar Park"],["se60d6438450",-3.25692,51.40134,33,0,"Barry Dock Biomass Substation"],["s6f955fa264e",-2.81683,51.115,33,0,"Redlands Fm 33kV Solar Pk"],["scb191f28dc5",-2.92519,50.78871,33,0,"Beechgrove Farm Solar Park Substation"],["seb4ceb73252",-2.85883,50.84517,33,0,"Higher Berechapel Farm ADP"],["s18f3188d0f1",-2.7731,50.89868,33,0,"Crewkerne 33kv Solar Park"],["sc78004ea234",-2.81078,51.29761,33,0,"Frys Hill Radio Station"],["s0330c3ad9a7",-3.32704,51.41841,33,0,"Sutton Farm 33kV Solar Pk"],["sf8c96627934",-2.85562,51.35136,33,0,"Rookery Farm 33kV Solar Pk"],["s7d5b07c700e",-2.96602,51.18586,33,0,"Withy Drove 33kv Solar Pk"],["s86376a26c96",-2.52347,51.26822,33,0,"Whitchurch Solar Farm Substation"],["sa119540aa84",-2.98206,51.28288,33,0,"Wick Farm West 33kv Solar"],["s77fd6b7074a",-2.92671,51.18091,33,0,"Woolavington 33kV Solar Pk"],["s2a9428b35ca",-2.90901,50.87384,33,0,"Cricket St Thomas Solar Pk"],["s190c0840736",-3.29894,50.95503,33,0,"Red Hill 33kv Solar Park"],["s78a6f48eade",-3.22977,51.41114,33,0,"Sully Stor 33Kv Sw Stn Substation"],["sf3773ff8b53",-2.98218,51.28293,33,0,"Wick Farm 33kv Solar Park"],["s6e77d0be3a9",-2.94994,50.77606,33,0,"Newlands Farm Solar Park"],["se445752e999",-3.30982,51.41681,33,2,"Jesus College PV Gen"],["s4cc3d003f95",-2.79257,51.35804,33,0,"Iwood Lane 33kV Solar Park"],["s1a601e306f9",-3.46825,51.39809,33,0,"Rosedew 33kV Solar Farm"],["s02b3d062e5f",-2.94376,51.2257,33,0,"Watchfield Lawn 33kV Solar"],["s74025b0e84a",-2.98146,51.17096,33,0,"Puriton Landfill 33kV Solar"],["se6c47b17a12",-2.92027,50.78549,33,0,"Stonebarrow Fm 33kV Solar"],["sfe3cbe783f9",-4.11651,51.11124,33,0,"Luscott Barton 33kv Solar"],["sdd0d9b4ccec",-2.82341,51.34865,33,0,"Carditch Drove 33kV Solar"],["sef26fcad826",-3.35987,51.17117,33,0,"Higher Bye Farm 33kV Solar"],["sb03556bb70d",-2.88757,50.94244,33,0,"Parsonage Barn 33kV Solar"],["s7f7bcae40a9",-3.91921,51.12795,33,0,"Bratton Fleming Solar Park"],["s1ec3e23a173",-3.35011,50.73103,33,2,"Great Houndbeare Solar Park"],["sfcc54690205",-2.53775,51.19819,33,0,"New Row Farm Solar Park"],["s0c47fe1b26a",-2.76199,51.22497,33,0,"Hawkers Fm 33kv Solar Park"],["sdb76ac2d4aa",-4.13602,51.77505,33,0,"Pont Andrew PV Generation"],["s77b136b93d2",-3.23266,51.80045,33,0,"Ogmore Power Rassau"],["s2f13c66cc49",-4.03211,51.7649,33,0,"Clawdd Ddu Solar Farm"],["s8d76dc89119",-4.98347,51.77195,33,0,"North Tenement Solar Park"],["s16c8d722f00",-2.40494,51.64197,33,0,"Upper Huntingford Solar Farm Substation"],["s168cdb75d76",-2.2921,51.79218,33,0,"EFW Javelin Park Substation"],["s0bbf4300c9b",-4.85324,51.81985,33,0,"Oak Cottage Solar Farm"],["s1cf861ef4f2",-4.00858,51.63677,33,0,"Cockett Valley Solar Park"],["s29a85c213e4",-3.34071,51.58384,33,0,"Berthllwyd Solar Park Gen"],["s0865f24019b",-2.40301,51.66634,33,0,"Upper Wick Solar Farm Substation"],["sc528fafca32",-3.39285,51.45237,33,0,"Garn Farm 33kv Solar Park"],["s99b5913d7c5",-3.85471,51.64948,33,0,"Llandarcy STOR Generation"],["s4537dc063fb",-3.14977,51.47156,33,0,"Trident Park Generation"],["se774d718c7d",-5.0107,51.67102,33,0,"Hoplass Solar Farm Pv Gen"],["s38f6eb461f5",-2.73085,51.63273,33,0,"Rhewl Farm Solar Park"],["s9057f159d6e",-3.316,51.74651,33,0,"Cwmbargoed Coal Washery"],["se1480507be1",-3.53234,51.74372,33,0,"Rhigos Road Gas Gen"],["s92e6c502f18",-3.6127,51.52461,33,0,"Court Coleman Pv Gen Substation"],["sb36cf7c025c",-4.61907,52.09224,33,0,"Crugmore Solar Park Substation"],["sca3534b868d",-4.95065,51.64359,33,0,"Yerbeston Chapel Hill"],["sc53a54b33f0",-4.01525,51.64856,33,0,"Gowerton STOR Substation"],["s3f97f5b64a1",-5.01326,51.66437,33,0,"Little Neath Solar Farm"],["s85fd7d6bb56",-3.95497,51.7,33,0,"Abergelli Pv Generation"],["s51229f1b634",-4.92074,51.81831,33,0,"Fenton Farm PV Generation"],["s1dc5765d3de",-3.93541,51.6937,33,0,"Cefn Betingau Solar PV Gen"],["seba9bc8d8f8",-4.18248,51.70906,33,5,"Brynteg Solar Farm"],["sd3079b1256b",-3.83155,51.61244,33,0,"Baglan Bay PV Generation"],["s54c9fc468ef",-4.52524,52.11003,33,0,"Llwyn Du Solar Farm"],["se25bf3616f5",-4.28111,51.83297,33,0,"Bryncyrnau Isaf Solar Park"],["s8a6b122f04b",-4.90093,51.69972,33,2,"West Farm Pv Generation"],["s6aaa72f5ca0",-3.94179,51.697,33,0,"Rhyd Y Pandy Solar Park"],["s9156922b75c",-4.13026,52.14956,33,0,"Nathenfoel Solar Park"],["s136a3c6775c",-3.41591,51.6975,33,0,"Aberdare Power Station"],["s348900c479d",-3.16699,51.70014,33,3,"Manmoel Solar Park"],["s8522670420b",-2.169,51.84454,33,0,"STADCO"],["s09ac0255645",-2.53308,51.74196,33,0,"Yorkley Solar Farm Substation"],["s428bb3088d8",-2.44548,51.77245,33,0,"Hall Farm PV Substation"],["s1f87f9dce04",-2.41859,51.68047,33,0,"Actree Solar Farm Substation"],["sfeb689724b0",-0.81084,52.15286,33,0,"Eakley Lanes North PV"],["s8c7bbf5409e",-0.73833,52.00464,33,0,"Lyon Road Generation"],["s6f39dfee01d",-0.89843,52.04046,33,0,"Mount Mill Solar Park"],["sb083dcc9e61",-2.10832,52.58232,33,0,"Wolverhampton Power"],["s93dcf3ba7de",-0.64132,52.48743,33,0,"Weldon Shanks Generation"],["s76300d750c5",-0.65694,52.36272,33,0,"Burton Wold Wind Farm"],["s56c95a366fb",-0.6579,52.35341,33,0,"Burton Wold Wind Farm South"],["sf9c3abe9f9b",-0.61286,52.23177,33,0,"Airfield Farm Wind Farm"],["sb847c0b565d",-0.59202,52.26304,33,0,"Wykes Generation"],["s3df8a0b8c2a",-1.49073,52.39586,33,0,"Coventry Waste Reduction"],["s2d205e8ecc7",-0.58795,52.25323,33,0,"Glebe Farm Solar Park"],["s07cbe80d8ab",-0.65295,52.50278,33,0,"A B R Foods"],["sd0ff01dea54",-0.14222,52.77451,33,0,"Clay Lake Generation"],["s310e0aedcc8",-1.03231,52.84377,33,0,"Equitix ESI CHP Notts"],["sf60981c53da",-0.25983,50.69283,150,0,"Rampion Wind Farm Offshore Substation"],["sbf88eeb412f",-4.08727,56.75695,33,0,null],["s9b62ba43618",-3.79731,51.59285,33,0,"Afan Way STOR Generation"],["s470a0f970bd",-3.45482,51.62837,33,0,null],["seddead98f9a",-3.78885,52.09784,33,0,"Ystradffin Hydro Generation Switching Station"],["s7cf40eabeae",-3.76655,52.11961,33,0,"Llyn Brianne Substation"],["s494ee413f11",-0.03198,53.54683,33,0,"Wesley Crescent 7"],["s0b0661c411b",-1.60896,54.97185,33,0,"Pilgrim"],["s6a39e84a894",-1.90869,53.95784,33,0,"Chelker Reservoir Substation"],["s1aa07e34780",-3.93564,51.69349,33,0,"Afon Lan Solar Park"],["s4f8551a5ac4",-2.18428,53.44227,66,0,null],["sac63f039bb9",-3.22924,51.41062,33,2,"Peakgen Barry Stor 33Kv Sw Stn Substation"],["s477fac68d56",-2.15407,57.13149,33,1,"Craigiebuckler Primary Substation"],["sa2608c960d3",-1.03115,52.07457,33,0,"Silverstone Substation"],["s7143ba9a57b",-1.12969,52.66939,33,0,"Birstall Substation"],["sc8972da6342",-0.2005,51.98092,33,0,null],["sfade3a28bdc",-1.23254,50.88479,400,1,"Botley Wood"],["seaf468d6829",-0.34348,51.6604,400,5,"Elstree Substation"],["s112cb4c2185",-0.20913,51.61785,275,0,"Mill Hill Substation"],["s67484c33ea7",-0.38351,51.47576,33,0,null],["s3b795dd207f",-0.23354,51.40814,750,0,"Raynes Park TPH and HV Swt. Stn"],["s65b6378e9cb",-0.21082,51.66119,132,0,"Barnet Substation"],["sa236e70490a",0.32988,51.42831,400,4,"Northfleet East Substation"],["sf196f3cf046",-1.03976,50.91704,400,3,"Lovedean Substation"],["s198c47b2505",-0.20961,51.78788,132,0,"Welwyn Substation"],["s8b28cb969cd",-1.32494,50.90554,132,1,"Netley Common Substation"],["s564dfb9bcf0",-2.95999,53.26598,132,3,null],["s453345df0c5",-0.0116,51.71416,400,0,"Waltham Cross Substation"],["s49f116b137e",-1.44347,50.89734,132,2,"Marchwood Substation"],["sb8428a175b5",-1.46566,50.91821,132,2,"Millbrook Substation"],["sf248ab96bc6",-1.1905,51.71115,400,3,"Cowley Substation"],["s89d991984a6",-1.47861,53.37476,275,0,"Sheffield City Substation"],["saea5a2d31ae",-0.04759,51.60437,275,0,"Tottenham Substation"],["se0c9eab23fd",-2.94716,53.26747,400,6,"Capenhurst Substation"],["sbd9a98e44a6",-2.71618,53.30923,400,5,"Frodsham Substation"],["s6de31163fbe",-3.05484,53.23253,400,2,null],["sf7b2032560e",-1.41229,50.90594,132,1,"West Quay Substation"],["s4d2bdd18ebb",0.0011,51.51958,400,4,"West Ham Substation"],["sdc676a05873",-0.02449,51.66371,275,0,"Brimsdown Substation"],["s6bf9406e3d1",0.30071,51.55272,275,3,"Warley Substation"],["sb62dd7a8ed3",-0.50505,51.48019,132,1,"Longford Substation"],["sb96b446b629",-0.49789,51.5434,400,3,"Iver Substation"],["se892e74d03f",-0.49735,51.54168,132,6,"Iver Substation"],["s39d80addd66",-0.62367,51.5267,132,1,null],["sa7b741eb37c",-0.61428,51.50745,132,0,null],["s10113e12cba",-0.60716,51.50445,132,0,null],["sc6ec9a4c7d0",-0.40446,51.64263,275,3,"Watford South Substation"],["s82bed430b24",-1.17191,51.36029,33,0,null],["s195cb3b564f",-0.40773,51.64621,132,1,"Hollywell Grid"],["s59fb3b000cc",-0.38264,51.61637,132,1,"Hatch End Grid Substation"],["s22891173b19",-0.3669,51.58018,132,1,"Harrow North Grid Substation"],["s1f47ae336a8",-0.26917,51.63415,275,0,"Edgware Cable Compound"],["s20d7ad81c5b",-0.47026,51.42394,275,1,"Laleham Substation"],["s89ed3ef5831",-0.4964,51.43856,132,1,"Staines Substation"],["s7ab4d3fdb6f",-0.48082,51.39106,33,0,null],["s4c4c9fba9eb",-0.50743,51.33935,132,1,"Byfleet Substation"],["s2fa8c7cb15b",-0.54667,51.30228,33,0,null],["s11993e495e3",-0.48495,51.33246,132,2,null],["sb187d3731d0",-0.33266,51.30275,132,1,"Leatherhead Substation"],["s2948b510aa7",-0.12756,51.37331,400,2,"Beddington Substation"],["s6893572e6b2",-0.18818,51.43087,275,2,"Wimbledon Substation"],["s3ab3e8704f1",-0.11268,51.37679,132,1,"Croydon A Substation"],["s532d85584c1",-0.12312,51.3789,132,1,"Croydon B Substation"],["s51f4a5fc5bf",-0.00377,51.35189,400,0,"Rowdown Substation"],["sb09bf73dd3b",-1.29092,50.83487,400,0,"Chilling Headhouse"],["s4398864366d",-1.06617,50.86492,132,5,"Fort Widley"],["s1611288dce9",-0.32295,51.3437,275,1,"Chessington Substation"],["s034bcc5011e",-1.18894,51.72375,132,0,null],["s1ab16d7bf6b",-1.19856,50.83307,132,0,null],["s1a63bde6289",-1.85224,52.50686,275,8,"Nechells East Transmission Substation"],["s25de8d7c374",-1.16252,52.93185,132,5,"Nottingham Substation"],["s6cdd942f7dc",-3.07271,53.22715,132,6,"Deeside Substation"],["sd29922da375",-2.91264,53.21573,132,2,"Chester"],["se81811d5592",-3.0514,53.18611,132,1,"Hawarden"],["s7303de35de6",-1.03459,50.8788,33,0,null],["s3ac676b3061",-1.48721,50.94189,400,4,"Nursling Substation"],["s1139a6d9401",-1.47186,50.94965,132,2,null],["s1c86d723962",-0.24905,51.92771,400,2,"Wymondley Substation"],["sbc8de8346dc",-1.35678,50.8367,132,1,"Sub Station"],["sddc27e2b894",-1.37434,50.83859,132,2,"Sub Station"],["s64054d862c9",-1.37913,50.84667,132,4,null],["sd6da4975e20",0.29763,50.7833,132,1,"Eastbourne Grid132 KV"],["sdaf4c18e650",-1.39357,50.97023,132,1,"Templars Way"],["s1b773e2903d",-1.27815,53.72214,132,6,"Ferrybridge B Substation"],["sf79a09c271e",-1.46996,53.67433,132,5,"Wakefield B"],["s02d76ac3172",-1.50215,52.40956,33,0,"Cox Street Primary"],["s4e6fdc36d44",-1.51763,52.40861,33,0,"Spon Street Substation"],["s2167eaea89f",-1.21215,51.76958,132,1,null],["s15df60d0981",-1.66428,53.82121,132,1,"Rodley"],["s21a64d33648",-1.59798,53.80629,275,5,"Kirkstall A"],["sc129e2fc249",-0.82213,53.90034,400,0,"Thornton Substation"],["s172ff169a81",-2.0295,52.54214,275,2,"Ocker Hill Substation A"],["s9b3dac3eba3",-2.0328,52.54123,132,2,"Ocker Hill Transmission Station"],["s94bd25b44c3",0.35987,51.64053,132,1,"Shenfield Substation"],["s5d7b529d919",0.3126,52.28084,400,3,"Burwell Substation"],["s79b2c07a4f3",-0.77675,51.62235,132,1,null],["sd1c6bd98c35",-3.4662,50.72647,132,0,"Sowton Substation"],["sec8dfd03d8d",-3.4053,50.76758,400,1,"Exeter Substation"],["sa607d910f73",0.16712,52.23276,132,4,"Milton Substation"],["sed397a0c26f",-4.36474,55.82121,132,1,"Crookston Substation"],["s630c5fd71be",-0.13142,51.17769,132,2,"Smallfield Substation"],["s78d90674770",-0.21775,51.2019,132,1,"Leigh Substation"],["s4accf83c5a0",-0.16315,51.1148,132,3,"Three Bridges Main"],["s5f6a1db38b0",-0.1627,51.11736,132,1,"Three Bridges Local"],["s041eb122511",0.10241,52.2459,132,0,"Histon Substation"],["s48d9593ee50",-2.13355,52.97445,132,0,"Longton Bulk Supply Point"],["sb5c46b7f7d1",-3.73035,50.47168,400,3,"Abham Substation"],["s34c511d1cf4",-1.92608,52.42755,132,3,"Bournville Substation"],["s69b431bd67a",-3.16541,55.89154,275,0,"Kaimes Substation"],["s43f9fa6484d",-1.11017,51.27151,33,0,null],["sa4c5f7f9338",-3.30884,55.90229,275,2,"Currie Substation"],["scaafaea8fe3",-3.2095,51.4699,132,1,"Cardiff West Grid Substation"],["se58337a9f12",-1.84355,51.08204,132,3,"Salisbury Grid Substation"],["s97e691f2d31",-6.6534,54.3298,33,0,"Armagh 33 kV Substation"],["sff3a910cb00",-2.19334,53.48663,132,1,"Droylsden"],["s2178f82d676",-2.01334,52.43113,275,6,"Kitwell Substation"],["sfb4f5a50a76",-3.52839,50.71206,132,1,"Exeter City Substation"],["s78cd6a7ce61",1.16363,52.03555,132,1,"Cliff Quay Substation"],["s39a96099702",0.068,51.39193,132,0,"Bromley Substation"],["s93fb1ca6ef4",-2.66486,53.31159,132,3,"Dutton Substation"],["s0ed60cb9845",0.44855,50.88128,400,2,"Ninfield Substation"],["s297c53f1624",1.1361,52.05597,132,1,"Ipswich Grid (West End Road)"],["sff9bb1fb10e",-2.74455,53.31942,132,1,null],["s30c46440636",-2.75551,53.3323,132,2,"Percival Lane Substation"],["sd95c4c17925",0.56645,51.59379,400,4,"Rayleigh Main Substation"],["sa720d406bb6",0.59501,51.587,132,1,"Rayleigh Local Substation"],["s70d4c99756a",0.18698,52.18862,132,2,"Fulbourn Grid Substation"],["s3d500cd5a71",-3.66904,50.79062,33,0,"Crediton Substation"],["sda8dfffd370",1.38976,51.36804,132,1,"Thanet Grid"],["sa74583ed9d4",-1.26504,52.91635,132,1,"Toton Substation"],["sca83dff5757",-2.8483,53.46909,275,3,"Kirkby Substation"],["s7145db6c270",-1.78007,52.41473,132,1,"Solihull Local No 1"],["sdead4a78e7e",-0.1704,51.52755,400,5,"St John's Wood substation"],["s78170592d61",-2.69436,53.43395,132,3,"Bold Substation"],["sf60bf8fab4c",-2.62417,53.38253,132,3,"Sankey Bridges Substation"],["s262e7016f35",-1.96209,52.55321,400,6,"Bustleholme Substation"],["s97625f8a8db",-1.09059,51.27846,33,0,null],["s2b37dc2b524",-2.02824,52.49688,275,0,"Kitwell Oldbury cct 275kV Sealing End"],["s7b77783be93",-3.09166,51.02558,33,0,"Priorswood Substation"],["s21faab4c20d",1.30814,52.60771,132,3,"Trowse Grid Substation"],["sc282c64b451",-5.70972,57.28102,33,0,"Kyle Primary Subsation"],["s67beb4c0e67",1.22796,52.62965,132,1,"Earlham Grid"],["sd83d64d512c",-3.30518,55.92843,275,0,"Sighthilll Substation"],["s2206582947e",-1.06766,51.26981,132,0,null],["sdb0445c6189",1.27227,52.57403,400,4,"Norwich Main Substation"],["sd49fce9b1a6",-3.12454,55.95332,275,0,"Portobello Substation"],["sedcd896e2e3",1.2437,52.60565,33,0,"Cringleford Primary Substation TG1972 0581"],["s6d4f056fda4",0.9024,51.86258,33,2,"Berechurch Primary TL99942220"],["s3feab2a81de",0.15497,51.43281,400,1,"Hurst Substation"],["s30196008aaf",-1.71238,52.45186,132,4,"Elmdon Substation"],["sc1dfb1c097b",-0.99798,50.84675,132,1,"Havant BSP"],["sd652bef5e3b",-1.74906,52.4065,132,4,"Copt Heath Substation"],["s040fc552e08",-1.93822,52.44438,132,3,"Selly Oak Switching Station"],["s31541adc560",-1.07743,51.33644,400,2,"Bramley Substation"],["s28c168b40bf",-4.01125,56.70701,132,4,"Errochty Switching Station"],["s86e36c107b8",-0.27491,51.40654,750,0,"Norbiton DC Traction Substation"],["s1795056aa39",1.29026,52.60918,33,0,"Tuckswood Primary Substation"],["s6c47b3cad5a",0.88662,51.84454,132,2,"Abberton Grid"],["see856f0ddaa",-1.85947,52.4614,132,2,"Sparkbrook Substation"],["saec3e4ecef5",-0.41516,53.80046,400,1,"Creyke Beck Substation"],["sdb0c5dad852",-0.11542,51.55276,132,3,"Holloway Grid Substation"],["s245752253f2",-2.04663,52.4534,132,1,"Halesowen Substation"],["s95ef40cb022",-2.92445,50.78683,400,0,"Axminster Substation"],["sae9836725ec",-4.24255,50.4447,400,2,"Landulph Substation"],["s65c3cf2fcec",-1.97427,52.39624,132,5,"Longbridge Substation"],["s2f2f153e7e3",-4.05434,51.06757,132,2,"Barnstaple Substation"],["s6ce41047824",0.36778,52.60826,33,0,null],["s4360f1eb48a",-2.10728,51.46744,132,1,null],["safb487c9f4b",-1.75255,53.80253,132,3,"Bradford"],["sd2106ff849f",-2.56847,53.38894,132,3,"Warrington Substation"],["sada36612903",0.39971,52.75776,132,1,"Kings Lynn Grid"],["s6e667d3189b",-3.29124,50.70009,33,0,"Newton Poppleford Substation"],["sb2daf8fa309",-3.17049,55.87443,33,0,"Burghlee Primary"],["sbacd4b19d24",-2.99399,53.41845,132,0,"Burlington Street Substation"],["s3ea5a36941a",1.3865,52.55702,33,0,"Alpington Substation"],["s1387bbcba3d",-0.95611,53.33528,33,0,"Hallcroft Road Substation"],["s19965dc68a3",-2.95599,51.34526,132,1,"Weston Grid Substation"],["sf1a251453f0",-2.95621,51.34584,33,0,"Weston Locking Road Primary Substation"],["scb9f15e1800",1.71151,52.55521,33,1,null],["s670a8857575",0.19901,52.72691,400,7,"Walpole Substation"],["s0de2a0e316e",0.07976,51.45975,132,1,"Eltham Substation"],["se6e758f2c6a",-1.42312,53.67397,33,0,"Sharlston"],["sdf4e22280fd",1.3211,52.62199,132,0,"Thorpe Grid"],["s56286951088",-1.2707,50.87125,33,0,"Parkgate Primary Substation"],["s1e762a7a77e",1.51461,52.6222,33,0,"Beighton Primary Substation"],["sad11043e395",-3.32839,50.6564,33,0,"East Budleigh Substation"],["sdc2999d1173",-0.29594,51.50185,275,0,"Ealing Substation"],["s8634b10d5b2",-1.30077,51.80532,132,1,"Yarnton Substation"],["s97dd7aec29c",-2.35421,51.37827,132,1,"Dolemeads Substation"],["s0bfb0ff9b70",-3.49639,50.56108,33,0,"Higher Woodway Substation"],["s5c164300eb2",-0.65599,51.66493,400,2,"Amersham Main"],["s22ae5a894ee",-0.58972,51.72198,132,2,"Lye Green"],["s3b6f48768ab",-0.48332,51.77365,132,2,"Piccotts End Grid"],["s27759c9b44f",-0.88249,51.7518,132,1,"Ilmer Grid Substation"],["sbd5f7cb385c",-0.38152,51.67134,132,2,"Bushey Mill Substation"],["s04d74ed34e9",-0.74361,52.01093,132,2,"Bletchley Substation"],["sa19a9336aaf",-3.18623,55.94861,33,0,"Cowgate Primary"],["seec39252ac5",-0.77509,51.82541,132,0,"Aylesbury East Substation"],["sfc4b6fbe4ad",0.13102,52.23514,132,2,"Arbury Substation"],["se9d5370aa52",-1.56685,52.28614,132,7,"Warwick Substation 132kV"],["s52ab7b86ec2",-2.98117,51.58448,132,2,null],["s53ea015b378",-3.00476,51.56703,132,2,"Newport West Primary Substation"],["s4e000682656",-2.96873,51.56625,132,3,"Newport South Primary Substation"],["s22aff35e454",-2.71186,51.58589,132,2,"Sudbrook Primary Substation"],["s5d384f3d11b",-3.03102,51.54782,400,0,"Imperial Park Substation"],["s5b561932390",-3.01669,51.62903,132,1,"Llantarnam Grid Substation"],["s723c87a5b85",-2.98942,51.56869,132,2,"Simms Metal Primary Substation"],["s34486422f5b",-1.2378,54.60557,275,2,"Saltholme Substation"],["sf5ce7f4e6f3",-1.36462,54.59217,400,5,"Norton Substation"],["s522e4837afe",-4.24689,57.4539,132,3,"Inverness Substation"],["s82d726374eb",-2.48084,51.56946,275,6,"Iron Acton Substation"],["sdf546beae8c",-3.09923,51.51166,132,2,"Trowbridge Primary Substation"],["sb012100ab26",-1.97036,52.59813,132,2,"Rushall Substation"],["s586883880d8",-0.48759,51.54052,66,0,null],["scbd4f1b45be",-4.00002,50.73776,33,0,"Okehampton Substation"],["sd1b4a965448",0.14281,52.20369,33,1,"Sleaford Street Primary Substation"],["s111f7c071b8",-2.9657,51.11812,132,3,"Bridgwater Substation (BSP)"],["s0908e8fb79e",-2.96915,51.11731,400,4,"Bridgwater Substation"],["s06b718b5194",-1.21528,52.93018,33,0,"Beeston Substation"],["s7580e1b9dd8",-0.88257,53.37183,33,0,"North Wheatley Substation"],["s4f02274d157",0.49973,51.40011,132,4,"Strood Substation"],["s51d90792efa",-1.71425,52.53106,400,2,"Hams Hall Substation"],["s4253d229fce",-0.258,51.53389,400,5,"Willesden Substation"],["s350fd855ef8",-0.25509,51.53366,132,3,"Willesden Feeder Station"],["s86d877a9a63",-1.80618,52.39463,132,3,"Shirley Substation"],["s4f5488a81ef",-2.48754,50.62389,400,0,"Chickerell Substation"],["sb84c425e910",-4.95432,56.71473,132,1,null],["s4b452bdcce6",-2.16993,51.38378,132,1,"Norrington Substation"],["se30e992de9e",-5.93601,57.24802,132,2,"Broadford Substation"],["sdc710bac283",-1.59067,54.79946,132,1,"Potter House Substation"],["se067a578703",-2.20549,52.16771,132,1,"Timberdine Substation"],["s204c3392413",-2.18994,57.21576,132,2,"Dyce Grid Supply Point"],["s4a6d9c7ef5d",-2.13804,57.17422,132,0,"Persley Grid Supply Point"],["sb6e1b3da0b3",-2.15398,57.13117,132,3,"Craigiebuckler Grid Supply Point"],["s302f66b659b",-0.01681,51.46712,750,0,"Lewisham DC Traction Substation"],["s9dc3be9802e",-0.1043,52.43817,33,0,null],["s20fd6ac6cdc",-3.21878,55.83627,33,0,null],["s9c350e3bee7",-1.46349,52.45599,275,6,"Coventry Substation"],["s26c696326c1",-1.46782,52.45311,132,4,"Coventry North Substation"],["s5bddd8f2c2a",-3.48762,56.3967,132,0,"Burghmuir Substation"],["s165359012cf",-2.30791,52.38514,33,0,"Wribbenhall Substation"],["s8b749e1cf22",-2.83165,52.44097,33,0,"Craven Arms Substation"],["s71f95a7bb47",-2.30519,52.12639,132,2,"Malvern Substation"],["sbe86b9f5300",-1.52051,53.71728,33,0,"Kenmore Road"],["s43b1a673bc8",-0.17773,51.91913,33,2,null],["s7839a349227",-2.55988,51.54744,132,3,"Bradley Stoke Substation"],["s6902c4bdeb9",-3.201,56.20703,275,0,"Glenrothes Substation"],["sed6847cf8ba",-0.16051,51.18178,750,0,"Great Lake Farm DC Traction Substation"],["s3d965ab7318",-0.6165,51.19023,33,0,null],["s9239c812c5e",-1.73656,52.47973,132,4,"Chelmsley Wood Substation"],["s5359861fb52",-1.56191,52.28623,132,6,"Warwick Substation 11kV"],["s1d1fedc1520",-1.82071,52.46428,132,2,"Boughton Road Substation"],["s2411612fba1",-0.57845,51.2457,132,1,"Guildford Substation"],["s05532fd6b2b",-0.5826,51.2418,750,0,"Guildford DC Traction Substation"],["s39b5c28f77c",-0.41755,51.29287,750,0,"Effingham Junction DC Traction Substation"],["s5d53cea75f9",-1.31506,53.05643,33,0,"Westwood Substation"],["s2a7690816b6",1.14491,51.91912,33,0,"Wix Primary"],["s41ed1343045",-2.19386,52.21748,132,0,"Warndon Substation"],["sa935598155e",-2.96806,55.96675,275,0,"Cockenzie Substation"],["s8bdeb265337",-2.23639,52.19192,132,3,"Worcester Substation"],["s39e65d4935d",-4.49205,57.46773,400,3,"Beauly Substation"],["scd2531b915b",-1.55042,52.85559,400,6,"Willington Substation"],["s36ed75b89f4",-1.46127,52.88567,132,4,"Derby South Substation"],["sf332475ca1f",-1.87003,52.40424,132,3,"Highters Heath Substation"],["sc8bf50002ab",-3.23666,55.93592,132,2,"Gorgie Substation"],["sbcc78186e20",-4.05953,52.72485,33,0,null],["sac16dd9cc80",-1.10686,51.37237,33,0,null],["s6b91f15026d",-1.64283,52.07958,66,0,"Shipston Substation"],["s865adbe9500",-1.89906,52.48737,132,4,"Summer Lane Substation"],["s427988c66c1",-1.87954,52.47453,132,5,"Bordesley Substation"],["s76cda16ec84",-1.71018,52.63806,33,0,null],["s6ad50ed3602",-1.51066,53.71802,33,2,"Outwood"],["s82ee40c38a5",-3.76779,56.01379,132,1,"Bainsford"],["sefc9f39bf2a",-1.91591,52.47698,132,1,"Ladywood Substation"],["sb27437496e1",-3.69376,56.00454,275,0,"Grangemouth Substation"],["sf76636cddd0",0.11811,51.93513,400,3,"Stocking Pelham Substation"],["s04cd120d297",-0.10257,51.50463,750,0,"Southwark DC Traction Substation"],["sb034386da38",-1.81406,52.56218,132,1,"Sutton Coldfield Substation"],["s11175c3591f",-1.39089,50.97078,132,0,null],["s71df210b915",-0.74071,51.29906,750,0,"Sturt Lane DC Traction Substation"],["s5f6ebcac249",-1.58484,54.6101,33,0,"Newton Aycliffe South"],["s3e700e97ee3",-3.00983,53.47533,132,1,"Litherland Substation"],["sc7f99425f47",-2.94881,53.49101,132,4,"Aintree Substation"],["s3de54833bd1",-2.96103,53.6435,132,2,"Southport Substation"],["s4624d498ed0",-2.81953,53.56261,275,1,"Washway Farm Substation"],["s5c47a5adada",-2.25776,52.78214,33,0,"Gnosall"],["sfc61bcc31cc",-1.88112,52.49625,132,4,"Chester Street Substation"],["s08000be9b05",-0.3993,51.375,750,0,"Walton DC Traction Subtation"],["s7ada780e8b8",-4.37693,55.93002,400,6,"Windyhill Substation"],["sf6b1f1fe170",-4.18199,55.77537,33,0,null],["s90dcb3890b7",-1.31259,52.94793,132,0,"Stanton Substation"],["se451d53baf3",-0.71008,52.66816,132,0,"Oakham Substation"],["s5fd0d0bbd25",-1.65168,52.77324,400,4,"Drakelow Substation"],["s6c9af5a57ed",-2.08373,53.0407,400,4,"Cellarhead Substation"],["s584f13518e9",-2.0439,52.98004,132,2,"Forsbrook Substation"],["sa85b8e89048",-2.16762,52.92395,132,4,"Barlaston Substation"],["s5e8d20142e9",-3.14475,56.14564,132,3,"Redhouse Substation"],["s5c57e53f82b",-1.65669,52.60834,132,3,"Tamworth Substation"],["s5c79452bae7",-1.49893,53.68616,33,0,"York Street"],["s1b7567eb7a4",-0.26793,52.59858,132,2,"Bretton Substation"],["s3e98e2ce61d",-2.42026,51.6255,33,0,"Hammerley Down Substation"],["s164ebe0440b",1.09625,51.29379,400,3,"Canterbury North Substation"],["s9ffb22266d5",1.09416,51.29234,132,4,"Canterbury North Substation"],["s1165d042bfd",-2.32852,51.37666,33,0,"Bath University Substation"],["s74ef314e7da",-0.48334,52.12694,132,1,"Austin Cannon Substation"],["s95022adea03",-0.47469,52.15461,132,3,"Bedford (switching station)"],["s6504cf92bb5",-0.7277,52.24308,400,6,"Grendon Substation"],["s03d361bae70",-1.02443,52.53721,132,2,"Kibworth Substation"],["sadff47e9555",-0.8814,51.25092,400,4,"Fleet Substation"],["sa7226930434",-2.56584,51.50061,132,4,null],["s79063f40c23",-1.64426,53.90233,33,0,"Pool"],["s1550955bf5e",-1.7196,53.89148,33,0,"Chevin End"],["sd551ad1016a",-3.00072,54.95137,33,3,"Rockcliffe Substation SW"],["s78d0eb060e9",-4.33725,53.41104,132,1,"Amlwch Substation"],["s7892054f209",-2.92479,56.47519,132,3,"Milton of Craigie"],["s63c4ff54840",-4.31026,53.36805,33,0,"Llaneuddog Substation"],["s7050af4c978",-0.96142,51.1526,132,0,"Alton Substation"],["s4e3b3b092c8",-1.59656,55.10636,66,0,"Cramlington Substation"],["s05d592f4971",-0.30167,52.21462,400,3,"Eaton Socon substation"],["s67dd52c86df",-1.48808,53.39703,33,0,"Penistone Road"],["sac63da33337",-3.13683,53.16787,33,0,"Ponterwyl"],["safb31a646b8",-4.83167,57.61967,132,1,null],["s179a31565a5",-0.99691,53.30679,132,3,"Checkerhouse Substation"],["s142dc3db48a",-4.30912,53.2545,33,0,"Llangefni"],["s13b4ab5d2e5",-4.48028,53.41521,400,0,"Wylfa"],["se63d5b88661",-0.67763,51.90442,400,0,"Leighton Buzzard Substation"],["s9b577d101a8",-1.6572,55.34613,66,0,"Warkworth 66/20"],["s3f56425a109",-1.13348,52.63842,33,0,"Mansfield Street Substation"],["sd4f5a13a3e6",-3.95074,52.92897,132,1,null],["s2b4d9dea939",-3.94676,52.9271,400,0,"Trawsfynydd Substation"],["sa5b444f9844",-4.09014,52.92807,400,2,"Garth Cable Compound"],["s52044bb8bb6",-3.29292,56.10595,275,2,"Mossmorran Substation"],["sda4470cacfe",-3.27126,56.11122,132,3,"Glenniston  Substation"],["sae8dd908860",-1.25376,50.71002,132,2,"East Wootton Substation"],["s68541b72957",-3.44948,56.08964,132,2,null],["s8144430d45a",-3.73066,56.07508,275,0,"Kincardine Substation"],["s465f72f08c5",-3.32117,57.66475,132,2,"Elgin Grid Supply Point"],["sfc25fbb3397",-1.55155,51.03448,33,0,null],["sdbb411335f8",-3.67239,55.89965,132,1,"Bathgate"],["s72c80912509",-1.89532,50.84683,400,4,"Mannington Substation"],["s0d238206de2",-1.22764,54.15752,132,1,"Husthwaite Substation"],["sae84da5f547",-1.77954,50.73762,132,1,"Christchurch Substation"],["s79d08ec6e4a",-1.02305,53.95681,400,3,"Osbaldwick Grid Substation"],["s51b289c6ae6",-1.05873,53.95928,132,2,"Melrosegate"],["s85454483860",1.50935,52.43791,132,1,null],["s7828473a426",1.46876,52.39569,132,3,null],["s63835fd16d7",1.51015,52.35622,132,1,"Halesworth Substation"],["s477e76d8c59",-0.61401,52.31928,132,2,"Irthlingborough Substation"],["s8cb387d7957",-1.21682,52.59764,400,3,"Enderby Substation"],["s20cb652b32b",-1.20969,52.78665,132,0,"Loughborough Substation"],["s119d1ea2199",-1.44931,53.54842,132,1,"Hunningley"],["s742cbf649e0",-1.6045,53.48789,66,0,"Stocksbridge"],["sbfc3f3723b2",-1.51863,53.57289,66,0,"Barugh"],["s8e8b2f0989b",-1.51919,53.57359,132,2,"Barugh"],["s6332959acc4",-1.60189,53.48771,400,0,"Stocksbridge"],["s2589b9ab207",-1.35562,53.74947,66,2,"Ledston 1621"],["s810a454192d",-1.26641,53.75623,400,0,"Monk Fryston substation"],["s0edc255e60b",-1.26654,53.40487,66,0,"Thurcroft Substation"],["sb1744c16e2d",-1.10038,53.30608,132,1,"Worksop Substation"],["s3e3676a7d82",-1.08943,53.57554,400,0,"Thorpe Marsh Substation"],["se802d6fb67b",-1.26857,53.40485,275,0,"Thurcroft Substation"],["sd53673e9c42",-1.49858,53.70606,132,0,"Wakefield North"],["s6acc819ecf9",-1.05694,54.5425,66,0,"Guisborough Substation"],["se8074334974",-3.77954,56.13719,132,1,"Devonside Substation"],["sadcc0d606f1",-0.86811,53.07739,400,4,"Staythorpe Substation"],["sb807d177be9",-0.87552,52.99941,33,0,null],["s4c81adf4d75",-0.86412,53.07783,132,4,"Staythorpe B Substation"],["s97d61f909d5",-0.86549,53.07692,132,9,"Staythorpe C Substation"],["s77f45df0280",0.74165,51.36833,400,4,"Kemsley Substation"],["sb89f98e8fc9",0.39242,51.40502,400,0,"Singlewell Substation"],["s99716e5bcc8",0.34338,51.16808,132,3,"Pembury Grid Substation"],["sae04988e4e6",-0.64576,52.93809,33,0,null],["s2ef5e896f8f",-0.64655,52.93772,132,2,"Grantham North Substation"],["s56687ff85c2",-4.48288,55.90416,132,2,"Erskine Substation"],["seb20aa477e7",-1.53747,54.78341,66,0,"Belmont"],["sfab185cd032",-4.70883,55.91587,400,2,"Devol Moor Substation"],["se7fa4c1468f",0.75868,51.37945,132,4,"Ridham Dock Substation"],["s2bc2238a417",0.69708,51.34452,132,1,"Sittingbourne Substation"],["sd46bebec462",-0.23479,50.97526,400,6,"Bolney Substation"],["s7833d58d056",-4.79614,55.64701,132,0,"Saltcoats"],["s44e6a653a98",-4.68051,55.66525,132,1,"Kilwinning Substation"],["s437ac7bc1a3",-3.73192,57.25363,132,2,"Boat of Garten Substation"],["sdbfd3ad9c74",1.34336,51.22812,132,0,"Betteshanger Grid;Betteshanger Local"],["s80a60ef00ab",0.77491,51.03265,132,2,"Appledore Switching Station"],["sd3feaf44616",0.86684,51.14496,132,1,"Ashford Substation"],["s1b4ece7fbfc",1.14752,51.09797,132,0,"Eurotunnel Main Intake Substation"],["s40d1d17a8ce",0.46238,51.31439,132,3,"Burham Grid"],["s2a38876655a",-0.30889,51.51391,33,0,null],["s65ba41f4a52",0.46138,51.3526,132,2,"Medway Grid"],["sa458ee062bf",0.53366,51.27474,132,1,"Maidstone Grid"],["sea97a004351",0.3605,51.96563,132,1,"Boyton End Substation"],["s387ad301536",-1.52058,50.90752,33,0,"Fletchwood"],["sd5ccbd4cbd2",-0.4208,52.14995,132,1,"Edison Road Grid"],["s807b3ce5f3b",-0.36262,51.42212,33,0,"Hampton Substation"],["s6bf4a94890d",0.74377,52.41544,33,0,"Water Lane Primary Substation"],["s9a3abe1b2e6",-1.74317,54.97774,400,3,"Stella West Sub Station"],["se56a0ad7daf",-1.72603,53.88523,132,0,"Menston Substation"],["s5f597bbb059",-0.68073,52.50951,132,1,"Corby North Substation"],["sf16f9dd730e",-0.66944,52.49129,132,4,"Corby Substation"],["s24737f8c462",-1.68772,52.63233,132,1,"Tamworth Town Substation"],["sa1523f0b77d",0.53971,51.37789,132,1,"Chatham Grid;Chatham Hill"],["sd319b2d6e22",-2.11462,52.63634,275,3,"Bushbury 'D' Substation"],["s1f2b726e830",-2.11322,52.63357,132,1,"Bushbury B-C 132/33/11 kV Substation"],["sdcd767de8c3",-1.61357,52.38643,132,5,"Berkswell Substation"],["sce91549ba6b",-1.61549,52.38606,275,4,"Berkswell 275kV"],["s8bc64f7d079",-1.24469,53.08792,132,3,"Annesley Substation"],["se42a94f5026",-1.38794,53.22442,275,7,"Chesterfield Substation"],["sa90d6877c05",-0.90699,51.92633,400,3,"East Claydon Substation"],["sd0cd350bd6c",-1.14613,52.04916,132,2,"Brackley Substation"],["sa9b70bc91ee",-0.99896,52.69632,33,0,null],["s5b6c9ab6964",-2.1209,53.26863,400,0,"Macclesfield Substation"],["sb51b6272e1a",-1.38505,53.10889,132,1,"Alfreton Substation"],["s854c7708d3e",-2.19431,52.50559,132,3,"Hinksford Substatio"],["s35127d74fc6",-2.09214,52.55175,132,1,"Coseley Substation"],["s93f3a331a72",-2.20915,52.55647,400,6,"Penn Substation"],["s24d45d32e03",-2.2535,51.87933,400,3,"Walham Substation"],["s35dae05cdf6",-1.43067,51.60371,33,0,null],["sb04336cf286",-2.60458,51.88823,400,0,"Walford Substation"],["sd74d21b8bfc",-2.61974,52.05395,132,0,"Hereford"],["s1ea2efdb571",-2.37926,53.42596,400,1,"Daines Substation"],["sfa570bb4901",-2.32183,53.43247,132,1,"Sale BSP"],["sd4661f143fa",-2.27613,53.42105,275,0,"South Manchester Substation"],["s7e9e4613a19",-2.33619,53.08436,132,0,"Radway Green Substation"],["sac3621929eb",-1.56079,54.55546,132,2,"Darlington North Substation"],["sdc3f9c04276",-1.98661,52.44087,132,5,null],["s188dd767aa2",-2.16743,52.93161,132,1,"Meaford C Substation"],["sfa25a1c4237",-2.20384,53.16335,33,0,"Congleton Substation"],["s2a2f19b672d",-1.50933,53.80168,132,5,"Leeds East Substation"],["s5e980d9727d",-0.69029,50.85893,132,1,null],["s684da67460c",-0.83878,50.78853,33,0,null],["se52cf3af145",-0.76704,50.8167,33,0,null],["s8e8c9c0728f",-0.22416,51.52623,400,3,"Kensal Green Substation"],["sedd6b073b5c",-3.71671,56.09888,33,0,null],["s9a8c3160f3b",-3.52903,50.706,33,0,"Marsh Barton Substation"],["s4e77b679068",-2.12964,53.41473,275,0,"Bredbury Substation"],["se815f6fa84c",0.93074,51.87815,132,2,"Colchester Grid Substation"],["sb356273fe3d",-1.0024,51.42934,132,2,"Burghfield Substation"],["s9644ca36b62",0.56191,52.33606,33,0,null],["sb2f2b1640c3",0.59418,52.2469,33,0,null],["s02abf41dcad",0.49626,52.28804,33,0,null],["s1c6d55959b4",-1.15801,50.72429,33,0,"Ryde Substation"],["s5280f975027",-1.20204,50.71928,33,0,"Binstead Substation"],["s86084309ef9",-4.30588,53.24815,33,0,"Llangefni Industrial Estate"],["s39909023082",-2.73232,53.7571,132,2,"Ribble GSP Substation"],["s1cadd85f760",-3.15546,51.46566,132,3,"Cardiff South Primary Substation"],["se8a17fcd98a",-2.20818,53.08092,132,1,"Kidsgrove BR Substation"],["sb3b3f4564a4",-2.37353,53.29766,132,0,"Knutsford Substation"],["s9459dfd7da7",-2.01779,52.58057,132,1,"Bentley Substation"],["s9ff4b94b113",0.39131,51.46019,400,3,"Tilbury Substation"],["sea04e8f40c5",-1.89603,52.52703,275,1,"Perry Barr Substation"],["se346cab9fe7",-2.46256,53.2661,132,2,"Lostock Substation"],["s87a698d5d6e",-2.48076,53.26349,132,4,"ICI Wade Substation"],["s5ac25b6adfe",1.01826,52.17123,132,3,"Stowmarket Grid"],["s2bb730a2287",-3.07404,53.23113,400,0,null],["sbad215e0d21",-1.42301,50.69581,33,0,"Shalfleet Substation"],["s6c8959eda5c",0.8673,52.21338,33,0,null],["s9a4ab520455",-1.26701,54.58801,132,2,"North Tees Sub Station"],["s2b919d2b4d8",-2.12226,52.8102,132,2,"Stafford Substation"],["s16d2ff70aac",-2.06914,53.45763,132,1,"Hyde Grid Substation"],["sf88b2292a9d",-1.98425,53.35232,132,2,"New Mills Substation"],["sd67b52d176a",-1.88512,53.27596,132,1,"Buxton Substation"],["s3723ff50450",0.86618,52.32277,33,0,null],["s9de5b3334a0",-3.03495,53.23474,132,1,null],["s6a9315a2161",-3.03741,53.23444,132,1,null],["s87e77af7cc4",-2.00204,51.60758,400,16,"Minety Substation"],["sa52f4e47f6d",-1.96232,51.70202,132,1,"Cirencester Grid Substation (CIRE)"],["se17c0efb70a",-2.748,53.88638,132,1,null],["sf7be40f4bfb",-3.0606,53.0713,132,1,"Brymbo"],["s90ac20ec7d6",-3.0532,53.02878,400,6,"Legacy Substation"],["s97a045bd2c6",-3.30037,56.16427,275,3,"Westfield Substation"],["s191575e5270",-2.37937,51.37394,33,0,"Oldfield Park 33 kV Substation"],["s985ea3a9811",-0.20153,52.57596,132,3,"Peterborough Power Station Substation"],["s320a4bf4717",-1.23509,51.66224,132,0,null],["sddab8282745",-4.0155,51.64969,33,0,"Waunarlwydd Switching Station"],["sb62f30611de",-4.1323,51.67518,132,3,"Trostre Grid Substation"],["s565ea5b3dac",-4.01327,51.64621,132,1,"Gowerton East Grid Substation"],["s4f3adc2cd09",-3.91426,51.66724,132,2,"Morriston Substation"],["s23398651612",-3.3006,51.63577,400,4,"Cilfynydd Supergrid Substation"],["sb97e8eadf9a",-1.82838,52.51248,132,2,"Erdington Substation"],["s131650f2a4c",-2.09594,52.30934,132,1,"Upton Warren Substation"],["s9461f51b8a2",-3.75435,51.76281,132,2,"Ystradgynlais Grid Substation"],["s90ace3af2d7",-3.22616,51.80843,400,3,"Rassau Supergrid Substation"],["s3581e8644dd",-3.23736,51.79794,132,1,"Rassau West Primary Substation"],["s5abe516d53a",-2.63574,51.87685,400,0,"Brelston Green Supergrid Substation"],["sbe1c1cecdad",0.91164,52.24218,33,0,null],["s52cf9597f10",1.09278,51.8252,33,0,"Chisbon Heath Substation"],["s2026fc78e66",-3.15782,51.6745,400,3,"Crumlin Primary Substation"],["s3104bc53556",-3.02526,51.65348,132,0,"Cwmbran Primary Substation"],["sb91ca10abd3",-3.21783,51.66941,132,2,"Pengam Primary Substation"],["sc0dd6d0e995",-3.37163,51.66756,132,2,"Mountain Ash Grid Substation"],["sf78d07f09af",-2.2694,52.33759,132,3,"Stourport Substation"],["sb771fb4d1d5",-2.24229,52.31246,275,5,"Bishops Wood Substation"],["s5fa675eec2c",-1.97282,52.251,400,0,"Feckenham Substation"],["s0efbeb23ce1",-0.71135,52.15376,33,0,"Olney 33 11kv S Stn"],["sdb31a7f9b9c",-0.97478,51.45407,33,0,"The Mall Substation"],["sf9db450d6b8",-1.62363,52.81601,132,2,"Burton Substation"],["s1136ea32da0",-3.84842,57.57665,132,2,"Nairn Grid Substation"],["s2a88b872112",0.73826,52.38619,132,0,null],["s1995eca8a27",1.1492,51.08469,132,2,"Folkestone Grid 132kV 009920"],["s20730ff03cb",-1.50003,55.02372,275,3,"Tynemouth Substation"],["s7613491dd81",1.02337,51.93732,33,2,"Fox Ash Substation"],["s39267851c8c",0.90352,52.12244,33,0,null],["s8e79a3039ad",0.0918,51.49031,750,0,"Plumstead DC Traction Substation"],["s1bb6eafc01b",-3.03616,55.90857,400,1,"Smeaton Substation"],["sd535e278e23",-2.26233,52.07141,66,0,null],["s567fbed170b",-1.38482,53.68642,132,1,"Featherstone Substation"],["sac2ec505338",-1.42862,53.69507,33,0,null],["sed996fed3e4",-2.4199,55.95093,400,0,null],["s6004028ab8a",-2.41675,55.94882,400,0,"Branxton Substation"],["s948e7b5dafd",-2.57358,55.97732,132,0,"Dunbar Substation"],["s48dfb2c11dc",-1.11677,54.6065,275,0,"Tod Point Substation"],["s28a42fe5c59",-3.36838,51.72927,33,0,"Pentrebach Primary Substation"],["s42efa74e829",-3.16965,51.48031,33,0,"Sandon Street Primary Substation"],["sb8ffdfc17f7",-0.53214,53.72101,33,0,"Gibson Lane Substation"],["sf900d29f051",-0.49036,52.19619,132,1,"RAE Grid"],["s8dedc349052",-0.77072,51.2317,132,1,"Aldershot Grid Substation"],["s2f040b0c3c0",-2.35657,53.39772,132,1,null],["s45f4f4414d6",1.04959,51.94921,132,2,"Manningtree BR Substation"],["sa167e3a8b80",-1.51195,53.64834,33,0,"Durkar Low Lane Substation"],["se1b8d0519dc",-1.59371,53.63319,33,0,"Denby Grange Substation"],["s544a822100e",-1.03351,51.32154,33,0,null],["sa7862dedb33",-1.58472,51.65215,33,0,null],["s95b40d397eb",-3.13025,51.48193,275,0,"Tremorfa Substation"],["s9b39c2ee482",-4.1582,53.1875,400,2,"Pentir Substation"],["se13f8b58e04",0.27431,51.14542,132,2,"Tunbridge Wells Grid"],["s9d2ae1177da",0.99457,51.86107,33,0,"Alresford Substation"],["s8ed2bac6188",-0.76431,53.90834,66,0,"Hayton Substation"],["s5a1f6b5f025",-0.49063,51.98583,132,1,"Westoning Substation"],["s2ad1318d0a8",-4.93708,50.37541,132,5,"Fraddon Substation"],["s83d2e3cda6a",-0.68537,52.29185,132,1,"Wellingborough Substation"],["s212064337be",-4.7912,50.35507,132,1,"St Austell BSP Substation"],["s1cc642230ec",0.04123,50.88724,132,2,"Lewes Grid"],["s3bbefe304cd",-4.4081,50.79405,132,2,"Pyworthy Substation"],["s4684168f899",-4.13694,51.00588,400,4,"Alverdiscott Substation"],["s87dcbd00fbf",-4.46331,55.5763,400,0,"Kilmarnock South Substation"],["s01dc4c33cdc",-1.13177,54.57577,275,0,"Wilton Substation"],["se2373a18efc",-0.61235,54.47787,66,0,"Whitby"],["scf08af183e9",0.60072,50.87732,132,3,"Hastings Main"],["s56888147119",0.4551,51.50783,132,1,"London Gateway Substation"],["s848ee723db9",0.50673,51.51286,400,0,"Coryton South Substation"],["sbbd0b36477f",0.7337,51.57071,132,1,"Fleethall Substation"],["s1959643f297",0.65876,51.72524,132,2,"Maldon Substation"],["sb87b969ad02",0.51851,51.71601,132,3,"Chelmsford East Substation"],["s460a648351c",0.53209,51.76425,132,2,"Springfield BR Substation"],["s3e2e8bd322e",-0.65113,53.60258,132,4,"Scunthorpe North Substation"],["s83e7287e417",-0.59463,53.59626,33,0,null],["s5b815959793",-0.59395,53.5966,132,2,null],["s99f0208c6f0",-0.59039,53.56753,132,3,"Broughton GSP"],["sa49f5a29f3b",0.75385,51.36601,132,1,"Grovehurst Substation"],["s5dae6304dd2",0.74958,51.43673,132,2,"Sheerness Grid Substation"],["sd1b62762e3f",0.75223,51.43742,132,2,"Sheerness Steelworks"],["sacd19ca40d6",-1.60505,52.40169,33,0,"Coventry West 33kV"],["s6ffe3496397",0.485,51.59458,132,2,"Nevendon Substation"],["s0167f8f9ada",0.42869,52.7654,33,0,null],["sf7cff095d44",-1.48827,53.4061,400,0,"Neepsend Substation"],["sf540d59110e",-1.42737,53.39086,132,1,"Attercliffe Substation"],["s26f7295c749",-0.38429,52.76534,132,3,"Bourne Substation"],["s3c74d7f7edb",0.03183,52.75673,132,2,"South Holland Substation"],["s96629cdf104",-0.41972,52.76028,132,2,"Bourne West Substation"],["s3d6d430a67f",-0.58833,52.92468,132,2,"Grantham Substation"],["s8f2e4a2a2fa",-0.01478,52.96634,132,3,"Boston Substation"],["se50441ef218",-0.36448,52.75839,33,0,null],["s57f91904064",-1.37886,53.502,132,6,"West Melton Substation"],["s1a00956866f",-0.47098,52.65157,132,1,"Stamford Substation"],["s5e761f619ed",-3.27919,51.42242,132,3,"Brynhill Barry Grid Substation"],["sad6e1a8bb80",-0.86947,52.76473,132,1,"Melton Mowbray Substation"],["s6f8d0761919",-0.3012,52.67816,33,0,"Market Deeping Substation"],["s7af355c67fa",-1.41404,53.4158,275,0,"Wincobank Substation"],["scb0a5221052",-3.40703,51.48698,275,0,"Cowbridge Tee Substation"],["s0d62b290c1c",-1.43705,53.39525,33,0,"Stevenson Road"],["s6baba8eb808",0.06652,51.76381,132,1,"Harlow West Grid Substation"],["s165b92dbef2",0.02094,51.14891,132,0,"Dormansland Grid"],["sb90a1948a6d",-3.57851,51.51817,132,2,"Bridgend Grid Substation"],["s1f716b20310",-4.23975,55.85521,275,0,"Charlotte Street Substation"],["sffdcbbc274b",0.11916,51.70744,132,1,"Epping Grid Substation"],["s1fb73526cbe",-0.24654,51.98805,33,0,null],["sed93b5c05ba",-2.32962,55.6693,400,1,"Eccles Substation"],["sb8a4100e567",-2.32682,55.66876,33,0,null],["s28c510c26e7",-3.87492,58.01998,132,2,"Brora Substation"],["s3b897f8bf1a",-0.22323,51.90526,132,1,"Stevenage Substation"],["s24ed5161a8f",0.11422,51.52118,400,1,"Barking Substation"],["sa251ea6aea3",-0.46331,53.72325,132,1,null],["s4d85a61d11c",-1.53217,54.60966,66,0,"Skerneside Substation"],["s15d11df9135",0.05436,52.55266,132,3,null],["sc42ca7c53b1",-3.32843,57.63698,33,0,"Bilbohal Primary Substation"],["s228a0668e9c",-1.47495,53.37338,33,0,null],["s6fdc9fd3c68",-2.38882,51.39299,33,0,"Combe Park Substation"],["sd7b490ca1fa",0.2723,51.47371,400,0,"W Thurrock/Littlebrook Cable Compund"],["sc805fd1227b",0.28825,51.47105,400,0,"West Thurrock Substation"],["s3465e387f80",-2.33882,51.39707,33,2,"Bath Easton Substation"],["s43619e9140a",0.50449,51.5179,132,0,"Coryton Substation"],["sfc29a0eacc9",0.38028,51.46159,132,1,"Tilbury Local Substation"],["sd6cd294413c",0.36361,51.47814,33,0,null],["se6ec051a37a",0.4146,51.48287,33,0,null],["s477213a7ccc",-3.28662,50.74566,33,0,"Ottery St. Mary Substation"],["s2f0574d2a10",-3.41547,50.66697,33,0,"Woodbury Substation"],["s0d210f4b718",-1.59146,51.76819,33,0,null],["s8e046bd3697",0.4076,51.44231,400,0,null],["sab1e1a7bb0f",0.55754,51.54648,132,0,"South Benfleet Substation"],["se883a9b0551",-2.15067,51.39342,400,3,"Melksham Substation"],["sa51b3e247af",-2.41239,51.55274,132,1,"Chipping Sodbury Substation"],["s67f5aa57503",-2.41328,51.51212,33,0,"Wapley Substation"],["s7bed8d58448",-2.61549,51.60843,400,0,"Long Covert Cable Compoound"],["s8ade3694fdc",1.01889,51.91659,132,3,"Lawford Substation"],["scb5ce97a353",0.94429,51.95334,33,0,"Langham Substation"],["saab84d8dd97",0.70271,52.64264,132,0,null],["sc503336fa46",-1.46992,53.37561,33,0,"Arundel Street"],["s6ee46b73fcd",-2.52091,51.59412,33,0,"Alveston Substation"],["s209a24fadee",-1.41072,53.38522,33,0,"Darnall"],["s0f8f095f67c",1.1174,51.99819,33,0,null],["s6051b7b159a",-0.31851,50.89325,132,1,"Steyning Grid"],["sf85ae024c6b",-1.65265,51.33148,132,0,"West Grafton Substation"],["s9c28213ec84",1.25595,51.97175,33,0,null],["s0fb513bbc7b",0.87418,51.06208,132,1,"Ruckinge Grid"],["s15406af5033",-3.45365,55.91943,132,1,"Broxburn 132kV Substation"],["sb0ef4ed55c7",-3.185,55.96537,275,0,"Shrubhill"],["s4d89275573f",-2.40532,57.28519,33,0,"Inverurie Primary Substation"],["s2811dc602bf",-0.75021,51.43458,33,0,null],["s830501a1572",0.40289,52.73154,132,1,"Kings Lynn South Grid"],["s6316552bdeb",0.41252,52.66678,33,0,null],["se331d872b4c",-1.40951,50.90637,33,0,"Western Esplanade PSS"],["s5f2467d949c",0.6841,51.86288,33,0,"Coggeshall Substation"],["s7e50e132e00",-1.42681,53.39123,33,0,null],["s83e605e3877",0.74109,52.82982,33,0,"Coxford Primary"],["s5bb959f6a4b",-0.11412,51.49919,750,0,"Waterloo DC Traction Substation"],["s2859f15ffda",-1.60516,55.22825,132,1,"Linton Substation"],["sf06f0506bf3",-1.93469,52.44793,132,1,"University Of Birmingham Substation"],["s24bacbda8ac",-0.15153,51.51314,132,2,"Duke Street Substation"],["s85ae0246b12",0.84701,51.14643,33,0,"Singleton Primary"],["s98f072cc183",-3.38118,50.89589,132,1,"Tiverton Junction Substation"],["s785b3a3cac6",-1.92827,52.487,132,3,"Winson Green Substation"],["sb21166c44d7",-3.18426,55.65094,33,0,null],["s3a9b7dc5116",-1.28896,51.68087,33,0,null],["s5e1fa29087d",0.31788,52.27739,132,1,"Burwell Primary Substation"],["sfa917692b6f",0.37897,52.263,33,0,null],["s44f12a62a7e",0.67879,52.08551,33,0,null],["sc7e76f951b6",0.60575,52.0687,132,0,"Belchamp Substation"],["scbf9c874433",-0.73206,51.26062,750,0,"Ash Vale DC Traction Substation"],["s9c0f79546ba",-1.29556,53.023,33,0,"Moorgreen Substation"],["s69e4ad83ca5",1.14834,51.08467,33,1,"Folkstone 33 kV 00912"],["s8138a726045",1.18539,52.21843,33,0,null],["s3b29e50e87a",1.02634,52.2602,33,0,"Cotton Substation"],["s6b1471f8de7",0.71117,50.97446,132,2,"Rye Grid"],["sf1af81e6cb7",-4.36207,52.00581,132,3,"Rhos Primary Substation"],["sf35e343fbdd",-4.357,51.84781,132,7,"Carmarthen Grid Substation"],["s4c1aca54491",1.32505,52.2302,33,0,null],["sc3a15a00f64",1.36751,52.1875,132,0,"Wickham Market Substation"],["sa044c431bb9",-2.78909,51.35653,132,3,"Churchill Substation"],["s4e0e841ebd2",1.3475,52.3145,33,0,null],["se5e0eab2b99",1.38069,52.15789,33,0,null],["s2d6c7c89ff7",1.27514,52.57486,132,6,null],["s02a3891095c",-1.42327,53.39058,33,0,"Shirland Lane"],["s5957bf572c0",0.80797,52.34169,33,0,null],["s9cfb263a8f7",-4.25506,55.8737,275,0,"Port Dundas"],["s8bcb6f1495e",0.69998,51.42059,400,0,null],["s604ef0b28ba",0.7054,51.43584,400,0,null],["s6eb418467ec",0.71616,51.4405,450,0,"Grain Static Inverter Plant"],["se51a59ac867",-1.13151,53.97494,275,0,"Poppleton Substation"],["s356f04de433",-3.95309,52.02959,33,0,"Pont-Ar-Annell Primary Substation"],["s447ab29308e",-1.13167,54.56681,400,0,"Lackenby Substation"],["scada856e3ea",-2.24166,51.32498,33,0,null],["s331c6fefffb",0.70732,51.23933,33,0,"Harrietsham Primary"],["s157e85e2bb5",-1.55315,52.74073,33,0,"Moira Substation"],["s317d0c34737",-0.40109,51.87449,132,0,"Luton South Substation"],["s41b79d4a422",-0.5135,51.89628,132,0,null],["s16d3faf1f01",-1.43712,53.40014,33,0,"Newhall Road"],["s2049de2b01b",0.70876,52.26608,33,0,null],["s2b6d51b8e06",-0.24028,53.14207,33,0,null],["sac19652ef7c",-3.74718,52.62615,33,0,null],["s7711822e910",-3.83302,52.59082,33,0,null],["s3c51768df2e",-1.47468,52.07008,66,0,"Epwell Substation"],["scadede2826b",0.47913,52.10102,33,0,null],["sd8965f689d1",-2.9779,56.52128,275,4,"Tealing Substation"],["sdc4967d8cb8",-2.41034,55.96621,400,1,"Torness Substation"],["s69794981e8d",-3.49548,54.42486,132,2,null],["s6079995ee76",-4.04674,52.36114,33,0,null],["s8a361558732",-3.87867,52.41256,132,2,"Rhydlydan Substation"],["sf67878b2316",-0.14882,51.49061,132,0,"Ebury Bridge Substation"],["s652050463f4",-0.80513,53.05024,132,0,"Hawton Substation"],["s6344d4da11d",-0.13486,51.49009,132,1,"Moreton Street Substation"],["s4e29760e153",-0.27285,51.4885,33,0,null],["s9b6addf5ead",-0.48779,52.14427,132,4,"Cut Throat Lane Switching Station"],["se1921776616",1.09679,52.10975,33,0,null],["s4fa32129b46",-0.76712,51.04794,132,0,"Elmers Marsh substation"],["s5c1054d111e",0.50628,51.09341,132,0,"Hartley Grid"],["s9b4d3af4889",-3.21149,51.47829,400,0,"Sanatorium Primary Substation"],["s67f6fea8938",-1.53323,53.37237,33,0,"Snaithing Park Road"],["sbe51223b431",-1.13845,53.52682,132,1,"Doncaster Central 132/33/25kV"],["s5e2aa1ce057",-3.38969,56.04223,132,1,"Inverkeithing Substation"],["se174884011b",-2.17066,52.27389,66,1,"Droitwich Substation"],["s50a979e5658",-1.14312,52.95681,33,0,"St Ann's Substation"],["s556075bbe93",-4.743,56.01579,33,0,null],["sd18f0f1d463",-2.93834,57.5403,275,5,"Keith Substation"],["s89f01c1761d",-1.22826,51.66108,400,0,"Culham JET Substation"],["s04d3da04157",-1.32696,51.63123,132,2,"Steventon Substation"],["se63fdfc07d9",-1.31742,51.5796,132,1,null],["se5a1be53886",-2.27383,50.6782,132,1,null],["s9e262179621",-1.27621,51.75035,132,1,"West Oxford Substation"],["s4f0718531d8",-1.27616,51.74969,33,2,null],["s45c7babe4ae",-1.48528,51.77207,132,0,null],["sde1a254d913",-1.51747,51.7854,33,0,null],["s2488be94884",-1.23586,51.70595,132,1,null],["sf747f723eaf",-1.85757,52.50669,132,3,"Nechells West BSP"],["sfa87c08fc98",-1.40739,53.40796,33,0,"Tinsley Wire Industries"],["s9ee9e661e69",-1.39468,53.40118,275,0,"Tinsley Park Substation"],["sba318c448bf",-3.61929,57.61446,33,0,"Forres Primary 33/11kV Substation"],["s93b959d6107",-3.86642,57.58289,33,0,"Nairn Central 33/11kV Substation"],["s8120f29020d",-1.14922,54.58168,66,0,"Grangetown Substation"],["se632189c09e",1.09562,51.35359,132,1,"Herne Bay Substation"],["s528a63153c1",-4.06754,57.53981,33,0,"Dalcross 33/11kV Substation"],["s363471527c5",-1.44273,53.40127,33,0,null],["sa7b1bc9d19e",-1.44453,53.40105,33,0,null],["s1db79c88d62",-1.44366,53.40069,275,0,"Pitsmoor Substation"],["s8936f18dce8",-3.03917,56.19895,132,0,null],["s68a07c7fe32",-1.85823,53.72627,132,1,"Halifax substation"],["s478d202f128",-3.99178,57.59202,33,0,"McDermotts 33/11kV Substation"],["sc98e2f3c48d",-4.00039,57.57733,33,0,"Ardersier Primary 33/11kV Substation"],["s4ff40d7fcb8",-1.55474,54.00107,132,2,null],["s1439fba870c",-5.09659,51.88735,33,0,"Brawdy Primary Substation"],["s7ba17738610",-0.14174,51.5252,132,0,"Longford Street Substation"],["sf1761358a5a",-2.58985,51.92177,66,0,"Ross"],["s81598621e13",-1.14125,52.62254,132,5,"Leicester Substation"],["s986fa684a99",-4.14921,57.48147,33,0,"Culloden Primary 33/11kV Substation"],["s842b6e94a0b",-4.04766,51.58696,33,0,"Bishopston Primary Substation"],["s14dcc209a1d",-4.17634,51.60678,33,0,"Llanrhidian Primary Substation"],["s55d6f66590b",-4.01916,51.66176,33,0,"Garngoch Substation"],["sd847b8c8191",-1.409,53.35475,33,0,"Mansfield Road"],["s7a98d730db8",-4.17165,51.06822,132,2,"East Yelland Substation"],["s4470f5b926e",-3.80035,57.53448,33,0,"Lethen 33/11kV Substation"],["s7315fafd684",-4.38119,55.88082,132,4,"Braehead Park Substation"],["s34c8cf723e1",-1.78205,53.21508,33,0,"Flagg Substation"],["sad3c27a1b46",-1.70194,51.99408,66,0,"Moreton Substation"],["se5d286e344f",-4.51474,55.49356,33,0,"Mossblown Substation"],["s7c38829e6fa",-3.5644,57.63594,33,0,"Kinloss Primary Substation"],["s82c4447b502",-2.38145,57.21875,275,4,"Kintore Grid Supply Point"],["sdc609187b98",-4.38376,55.50899,33,0,null],["s0fd6d70e750",-0.14942,51.47341,750,0,"Queens Road DC Traction Substation"],["s931315864b8",-3.91936,56.11748,132,0,"Stirling"],["sc8f9fa8ed0f",-2.02999,53.73973,33,0,"Hebden Bridge"],["sf4daffa1678",-3.7184,56.08917,275,0,null],["s78c99afb330",-3.72154,56.08742,275,0,null],["sf99a7a4d01b",-4.07451,55.87908,275,0,"Easterhouse Substation"],["s03736a1a5fe",-4.14929,55.82285,275,0,"Clyde's Mill Substation"],["s6f4c83713a5",-4.20384,55.83544,275,3,"Dalmarnock"],["s2a0df3bf93b",-3.87786,56.27627,33,0,null],["s28e4282d5c5",0.73147,50.96112,33,0,"Rye Primary"],["s866fab99add",-3.15427,51.01707,400,3,"Taunton Substation"],["s5bc25d4ede5",0.60931,50.98718,33,0,"Northiam Primary"],["s456abd9c67d",-0.24324,52.56749,132,4,"Peterborough Central Substation"],["s15af65e2d84",-4.19122,51.86467,33,0,"Nantgaredig Primary Substation"],["sc7e475d5098",-4.20008,51.86091,33,0,"WGWB River Towy Intake Substation"],["se3d4405621d",-3.48898,51.52145,132,2,"Pencoed Primary Substation"],["sbd34bdf00e8",-1.48629,53.40371,33,0,"Neepsend"],["sed7ce6c1fdd",0.37041,51.25538,33,0,"Mereworth primary"],["s24904ad9858",0.54992,51.25191,33,0,"Shepway 33/11KV"],["s9fee4e9da71",1.08689,51.29085,132,4,"Canterbury South Substation"],["secfbbfa141d",-3.92017,51.62102,33,0,"Swansea Waterfront Primary Substation"],["se99a87cca11",-1.72453,54.97805,132,6,"Stella North Substation"],["s537a8807428",-1.51606,52.29648,33,0,"Campion Hills Substation"],["s92b64cd6a73",-3.75391,51.56291,275,2,"Margam Substation"],["s7facaa19d50",0.53229,52.39168,33,0,"Lakenheath Primary Substation"],["s3f3fca4b9fa",0.21997,51.58727,33,0,"Gidea Park Primary"],["s4924201c55e",-3.6878,51.53611,275,2,"Pyle Supergrid Substation"],["sa669650c944",-1.3183,54.5517,66,0,"Bowesfield"],["s01a300f5d8a",-1.31878,54.55266,132,1,"Bowesfield"],["saf93bb4e3a7",-3.21018,55.947,275,0,"Dewar Place Grid"],["s9f4d844e42f",-2.75292,51.13117,132,1,"Street Substation"],["s2ce5a4f8c3e",-1.32557,53.23529,33,0,"Bolsover Substation"],["s1cbd2d1d17e",-3.98141,51.62755,132,1,"Swansea West Grid Substation"],["sc7348992f9f",-3.12188,51.00137,33,0,null],["s1f21455834e",-1.4584,53.32967,275,0,"Jordanthorpe Substation"],["s406fc3953e1",-2.74496,51.48895,132,2,"Portishead Substation"],["s721563224f0",-2.92178,51.26085,33,0,"Brent Knoll Switching Site"],["sf03cc664091",-2.93233,51.21902,33,0,"Watchfield Substation"],["s08851498be8",-2.9669,51.18143,33,0,"Blackditch Substation"],["sa0bd1da43de",-2.98186,51.14161,33,0,"Bath Road Substation"],["sa3a96ab0bf7",-3.49268,55.88247,132,0,"Livingston East Substation"],["s47f0505d8df",-2.68952,53.61687,132,1,null],["sd1b4b34d3f9",-2.60393,53.44629,132,1,null],["s8ed7eebb94c",-1.5909,55.13278,66,0,"Bedlington Switching Station"],["se423842972c",-2.31921,50.99755,33,0,null],["s8199f8cfe68",-2.4307,51.31708,33,0,"Peasedown Substation"],["s95a4f03fe31",-4.58796,55.45735,275,0,"Ayr Substation"],["sa7571d67be8",-1.63125,50.7747,132,1,null],["s7e3ddf0a23f",-1.91326,50.73103,33,3,null],["sf5aefc185af",-1.9126,50.7315,132,5,null],["sa00dcdeb3e0",-3.90174,51.94275,33,0,"Llangadog Primary Substation"],["s4288d463984",-1.55069,50.77056,33,0,"SSE Lymington Substation"],["s49d553ace8a",-2.68516,55.45199,33,0,"Denholm Primary Substation"],["s1c818781e73",-2.9168,51.35089,33,0,"Lypstone Farm Primary Substation"],["s7f1b2c68f03",-4.16037,57.33615,132,1,"Farr Wind Farm Substation"],["s1d7e03dcba6",-4.47414,57.26859,275,0,"Foyers Substation"],["s9fdca6f89af",-2.693,52.70934,400,1,"Shrewsbury Substation"],["s02b740f682d",-0.01918,51.54339,132,2,"Kings Yard Substation"],["s94a5bf59402",-1.67425,50.75348,33,0,null],["sbc1e6b6f23f",-1.5649,52.25755,33,0,"Banbury Road Substation"],["s1c29c37628d",-2.7155,51.33696,33,0,"Blagdon Primary Substation"],["s8b740a996a5",-2.5565,51.50128,33,0,"Hewlett Packard Substation"],["s8c2336282d7",-2.30488,51.23106,132,1,null],["s8ab300f7641",0.14173,51.8783,132,1,"Bishop's Stortford Substation"],["s26838b7c3ad",-1.78173,52.52619,132,1,"Castle Bromwich Substation"],["sf7370f1edbc",-2.82756,51.03919,33,0,"North Street Langport Substation"],["sbcf66a28fcc",-2.09164,57.10847,132,2,"Redmoss Grid Supply Point"],["s2f3203da665",-2.50026,51.33011,33,0,"High Littleton Substation"],["s469d8774598",-2.50857,51.29076,132,1,"Radstock Substation"],["sb4c93d90f2b",-1.82333,51.06097,33,0,null],["sfcf5b5bc183",-4.41331,57.94324,132,2,"Shin"],["sd2698f556bc",-2.27299,51.73873,132,1,"Ryeford"],["sb0c0dd6e997",-3.58159,55.84894,33,0,null],["s74bfeba911d",0.29439,52.11937,33,0,null],["s88a855e3091",-2.98434,51.58708,132,1,"Newport East Primary Substation"],["s940d5d6634e",-4.36411,56.48463,132,1,"Lochay Substation"],["s9c423199ab1",-4.32949,56.47698,132,2,"Killin Substation"],["s5e3c7c94b39",-4.12352,56.39545,132,0,null],["s59c3ee9b21c",-1.81114,51.55425,132,0,null],["s95a2f39387d",-1.82177,51.58229,132,1,null],["s33a6ab4d7a2",-1.2295,52.91555,33,2,"Chilwell Substation"],["s48c66014ff3",-2.72098,51.12021,33,0,"Millfield Substation"],["se742b956dee",-4.23166,57.4827,33,0,"Waterloo Place 33/11kV Substation"],["sfabad0007cf",-2.92713,50.74514,33,0,"Penn Cross Substation"],["s7d2447c7f4c",0.2609,53.14055,132,3,"Skegness Substation"],["s8fce5ab7581",-3.03585,56.31357,132,1,"Cupar"],["s2a8b2aa54bb",0.12447,52.33929,33,0,"Aldreth Primary Substation"],["sd5d8e4f4bd1",-1.51889,54.97758,66,0,"Hebburn Primary"],["s1c982410d18",-1.53019,54.95896,66,0,"Wardley Primary"],["s621e3f90e12",0.07488,52.54825,132,1,null],["s56cfedd1c41",-2.67472,51.13916,33,0,"Edgarley Substation"],["safac6d9b914",0.34175,52.32597,33,0,null],["sc6bc3595b19",0.53471,52.37358,33,0,null],["s844a60e3ccf",-1.79932,57.47376,275,1,"Peterhead Substation"],["s65edd422827",-1.45981,51.40235,33,0,"Kintbury 33/11kV Substation"],["s6ccde89e62f",-2.29158,53.02131,33,0,"Scot Hay Substation"],["s9c61ece9fe4",0.15394,52.12291,33,0,"Sawston Primary"],["s3d4d9ee9aa9",-3.00258,56.21096,33,0,"Durie House Primary"],["s7837434b652",-0.38801,52.30321,33,0,null],["s50697fd8a78",-0.22642,52.28097,33,0,null],["sdd7404e2bb6",-4.26609,55.86323,275,0,"West George Street Substation"],["s5a04719be1b",-0.30612,52.28269,33,0,null],["s9738daf9c36",-0.07362,52.20113,33,0,"Bourn Primary Substation"],["s1d10207eaa6",-0.26365,52.20799,33,0,"Little Barford 33kV"],["sa99cba99234",-2.16721,53.52877,275,2,"Whitegate Substation"],["s759e155ebd7",-2.66513,50.91391,33,0,null],["s91f708b9747",0.07683,52.6183,33,0,null],["s50bbb927c97",1.39163,52.80496,33,0,"North Walsham 33kV Switching Station"],["s3497360f928",-2.80718,51.22943,33,0,null],["s271b506b90e",-0.02751,51.92142,33,0,null],["sa5cda9ceaa6",-5.77047,54.8432,275,0,"Ballycronan More HVDC Static Inverter Plant"],["sdfacb36ff21",-5.78406,54.8452,275,0,"Ballylumford 275kV Substation"],["se5222eccf17",0.03961,52.45577,33,0,"Chatteris Primary Substation"],["s874639318e4",-0.11708,52.26413,33,0,"Hilton Primary Substation"],["sf6af252159a",-1.02471,50.91646,132,4,null],["sec8f5da1237",1.41673,51.37179,33,0,"St Peters"],["sf78e8829ad5",-0.14206,52.77293,132,0,"Spalding Substation"],["s2527cbf68a3",-1.33558,52.07026,132,1,"Banbury Substation"],["sbf826e7234b",-3.33991,51.15859,132,1,"Bowhays Cross Substation"],["s4328383d145",-4.18362,57.38612,33,0,"Inverarnie 33/11kV substation"],["sc7bf22812d6",-5.08553,50.28427,132,2,"Truro Substation"],["s3b4c6046d68",-1.38442,53.35045,66,0,"Hackenthorpe"],["s654036a8351",-5.49128,50.19186,33,0,"St Ives Substation"],["sb55ce67bf11",0.39139,51.5656,132,2,"Basildon Grid"],["s750f41fe050",-0.08043,51.5023,750,0,"London Bridge DC Traction Substation"],["sde1300c23d5",-0.15766,50.96529,132,1,"Goddards Green Grid"],["s93142ff4988",0.30814,52.4612,33,0,"Littleport Primary Substation"],["s0e1cb039bbd",-6.16733,54.80147,275,0,"Kells 275kV Substation"],["s8a257f45773",-1.16072,54.52456,400,0,"Nunthorpe 400KV Cable Compound"],["s48bd7237242",-2.32131,53.33143,400,0,null],["sc67eeae43fa",-2.30745,53.328,400,0,null],["sb6af904129a",-2.98992,53.87962,132,5,"Stanah Substation"],["sb8749923bb4",-1.91497,52.75668,400,3,"Rugeley Substation"],["s2cc87be758c",-1.81745,52.69804,132,1,"Lichfield Substation"],["se4b343acaf3",0.39489,51.66945,33,0,"Ingatestone Substation"],["s755c275e87f",-2.38128,51.74152,132,3,"Cambridge Arms Switching Station"],["sa30aaa2543a",-1.86599,53.81037,400,6,"Bradford West Substation"],["sd2ddd6b1a68",-4.17045,53.15011,400,0,"Penisarwaun Cable Compound"],["sd382a05f89d",-4.16873,52.9391,400,2,"Wern 400KV Cable Compound"],["scaa73d5a0bf",-0.47308,52.49527,33,0,null],["s8e4dbcf0d04",0.18473,51.06666,33,0,"Steel Cross Primary"],["s0e5b4122a65",-1.36002,50.81016,132,2,"Langley Substation"],["sc14b73e7aa4",-1.35434,50.78581,132,3,null],["s6a5f67fd082",-2.89136,53.74992,240,0,null],["s149d53bd814",-4.43198,55.44682,275,0,"Coylton Substation"],["scfdbf4b703f",-4.44549,55.45627,275,0,null],["s916fef85426",-2.16392,55.01179,275,0,"Fourstones Substation"],["s3e48c143329",-3.8264,55.67153,132,1,"Linnmill Substation"],["s244242814bf",-3.86733,55.61536,400,1,"Coalburn Substation"],["s47586835abf",-4.08079,55.75364,275,0,"Strathaven Substation"],["sa1d839c4fc8",-4.49548,55.59784,275,0,"Kilmarnock Town Substation"],["scfe4cf76ce6",-4.68542,55.34225,132,0,"Maybole Substation"],["s29af15c595c",-4.47827,55.80899,275,2,"Neilston Substation"],["sba3803037ab",-5.50264,55.59026,132,1,"Carradale Substation"],["sac0096a4b3d",-5.35654,56.02831,132,1,"Port Ann Substation"],["s239e7327e52",-2.77753,54.66631,132,1,"Penrith Newtongate Substation"],["s5763dd780c5",-5.27984,50.22892,132,1,"Camborne Substation"],["s02d563dad77",-1.26495,53.8776,33,0,"Tadcaster"],["s2245b1da2e0",0.71579,51.44477,400,0,"Medway Substation"],["sfbf26ffe8c5",-1.67042,55.44046,66,0,"Denwick 66/20"],["s89a2fa1d5ec",0.37863,52.72652,132,2,"Kings Lynn Power Station"],["s2286153f69a",-0.79374,53.2281,400,0,"High Marnham Substation"],["s47fe2676a06",-0.21349,52.41338,33,0,null],["s3bf990dc21e",-3.02964,53.84937,132,2,"Bispham Substation"],["s64c250068fd",-5.07873,56.82095,132,1,"Fort William Substation"],["sec9184012c7",-4.71859,57.13685,132,6,"Fort Augustus Substation"],["sdf5d6b76b82",-0.53195,52.07756,33,0,"Marston Road Primary"],["s26dc1da66fa",-1.75543,51.59741,132,1,null],["s7823ea8d8eb",-0.40885,52.3684,33,0,null],["s2e34a6cdbbb",-2.12106,50.69562,132,4,null],["s5c794108cb5",0.3721,52.53498,33,0,null],["s6f43341d598",-1.93328,52.10961,66,0,"Evesham Substation"],["se8c9cff86b1",-1.27486,52.89819,33,0,"Long Eaton Substation"],["s738883b6527",-3.47815,50.73826,33,0,"Pinhoe Substation"],["sc11f9c6b0e3",-2.42918,55.60792,33,0,null],["s2f9f1362b2d",-1.9509,52.31307,66,0,"Redditch North Substation"],["sb78cd348365",-5.18445,50.1571,132,2,"Rame Substation"],["sbe6ba116b13",-1.58441,54.96573,66,0,"Gateshead East"],["sdd23a1019ca",-1.7325,54.97435,132,7,"Stella South Substation"],["s514a262fd32",-3.38811,52.2422,66,0,"Llandrindod Wells Substation"],["sd37da35d136",-3.01387,51.83884,132,0,"Abergavenny Grid Substation"],["sc647ec71a4a",-3.37288,52.15471,66,0,"Builth Wells Substation"],["s19dc67827fa",-1.79328,51.53207,33,0,null],["s4612b8eee40",-1.86756,53.83387,33,3,"Harden"],["s73d9f1107b6",-3.12062,51.02519,33,0,"Staplegrove Substation"],["sc8628bc29b5",-1.38663,53.41216,275,0,"Templeborough Substation"],["s9796b4fc838",-1.4344,53.81747,33,0,"Barwick Substation"],["s3ec23be001c",-1.28908,54.5717,66,0,"Malleable"],["s802e27d7959",-2.53049,50.7132,33,0,null],["s542ff2a1f5a",1.28343,51.35739,132,1,"Monkton Grid"],["sa7e510ee386",-5.87843,54.56294,275,0,"Castlereagh 275kV Substation"],["s57c89d9167f",-4.98076,55.0697,275,0,"Auchencrosh Static Inverter Plant"],["s2455563c118",-1.5651,53.41056,33,0,"Loxley Road"],["s18f7cc2a487",-3.48003,50.91691,33,0,"Tiverton Moorhayes Substation"],["s0c7518ac5d6",-0.00397,52.07499,132,1,"Melbourn Grid Substation"],["sf39de685a9b",-1.57556,52.50188,33,0,"Arley Substation"],["s9bd6dcc78af",-3.24778,50.99135,33,0,"Wellington Substation"],["sbf7ce6b3b94",0.57567,51.5236,33,0,"Canvey Substation"],["sb5eee8cbba6",-3.32728,50.94679,33,0,"Burlescombe Substation"],["se19d062758c",-2.42724,52.04605,66,0,"Ledbury Substation"],["s387c5caf1bf",-2.56934,51.55003,33,0,"Almondsbury Substation"],["s9f1a602dcdb",-2.17849,51.26254,33,0,"Westbury Substation"],["s77eb0c688f0",-1.50872,53.84707,33,0,"Roman Avenue Primary"],["s5470df354c2",0.03186,52.26579,33,0,"Longstanton Primary Substation"],["s4f80a1c5568",-2.84163,55.80481,132,2,"Dun Law Wind Farm Substation"],["s671e6d9d193",-1.53753,53.73275,132,3,"Station Lane"],["s0976be8fe3d",-2.02795,52.54322,275,0,null],["s6033bb05a72",-1.18389,52.95521,33,0,"Wollaton Road"],["sac04e685812",-1.37693,53.67851,33,0,"Commonside Lane Substation"],["secbbb93317a",-1.88778,52.47273,132,2,"Cheapside Substation"],["s69a1e6d1e59",-3.62567,50.58777,33,0,"Chudleigh Knighton Substation"],["s63ac009c07d",-1.90584,53.86481,132,2,"Keighley"],["sb0d74a04569",-1.88871,53.8703,33,4,"Airedale Road"],["sb208a5bec73",-0.40919,53.13506,33,0,"Metheringham Substation"],["s8bea11ef1f1",-2.28296,55.54609,33,0,null],["se0f2b91ed99",-2.10772,57.16374,33,0,"St Machar Primary Substation"],["s6fb387e5027",-3.54501,50.48761,132,1,"Torquay Substation"],["sf9669f1c461",-0.62137,53.57932,33,0,"Blast Furnaces"],["se5f46e39627",0.10457,53.16851,33,0,null],["sb2c10515352",0.30701,53.14281,33,0,"Warth Lane Substation"],["s45d38644e34",-1.54929,52.58484,33,0,"Atherstone Substation"],["s3740d436213",-1.71808,52.52461,132,4,"Hams Hall South Substation"],["s609288dc073",-1.24199,51.39451,132,0,"Thatcham Grid Substation"],["s5e987389ca5",-0.37988,53.73279,132,1,"Hull South Substation"],["s2c799a1eae8",-3.54895,53.29254,132,1,"Kinmel Bay Substation"],["se804925fbfa",-0.2428,53.73693,275,0,"Saltend South Substation"],["s937ae491d60",-0.23848,53.74199,275,0,"Saltend North Substation"],["se442c711145",-0.30474,53.78952,132,0,"Bransholme Substation"],["s7ac0548945a",-4.31631,55.86958,132,0,"Partick Substation"],["s50343e6d93a",-4.31595,55.86949,132,3,null],["s0c870f1ff66",-0.52188,53.22851,132,1,"Lincoln Local Substation"],["s891e4b3e74e",-0.51833,53.22864,132,3,"Lincoln Main Substation"],["sfe0be476dcd",-3.7747,55.6562,33,0,"Corra Linn Substation"],["s77dda9c7d06",-2.09953,52.50684,132,3,"Dudley Substation"],["s8ed7c2d63d8",0.01971,53.0885,33,0,"Stickney Substation"],["sadd0ad0bd1d",-2.12256,52.45973,132,1,"Lye Substation"],["s8ce8a87c6a7",-0.4058,52.99139,132,0,"Sleaford Substation"],["s721ff335dd4",-0.19224,53.61535,132,3,"Immingham Substation"],["s8358a705ecb",1.53622,52.10362,33,0,null],["se0fbef12e43",-3.06181,53.36581,275,1,"Birkenhead Substation"],["s3b8fb04fc57",-2.45932,51.53187,33,1,"Oxbridge"],["s3e099d545d0",-0.23458,52.53661,33,0,null],["s20a786e0458",-6.21468,54.81139,33,0,"Connor 33kV Substation"],["s62bf1ff4fbb",-0.69679,53.76583,33,0,"Newport Substation"],["s395c81b53a6",-2.73924,52.72013,33,0,"Spring Gardens Substation"],["seb42228b172",-2.74651,56.04869,33,0,null],["s03cd07e521a",-2.03258,50.74752,132,3,"Lytchett Substation"],["s4d5b16da268",-1.99883,50.71681,132,3,"Hamworthy Substation"],["s7f171d092b5",-2.22914,50.69017,33,0,null],["s243e0d0eadc",-2.07578,50.73188,132,3,"Organford off A35 near Upton"],["s2419485ce63",-2.57129,50.91327,132,1,null],["s8c125a8b7a2",-2.01888,50.71887,132,2,null],["s6ad27f6b2ba",-2.20877,51.01336,132,2,null],["s1fba6e7ed3d",-3.75642,51.76435,33,0,"Travellers Rest Primary Substation"],["s393f46792e6",-2.12045,51.90857,132,3,"Cheltenham substation"],["s1f28df5d271",-2.0825,51.91048,132,1,"Marle Hill Substation"],["sd0fded5f9ce",-1.61539,53.83629,132,1,"Ring Rd Horsforth"],["s36980a3ee93",-2.60677,55.02621,132,1,"Spadeadam Substation"],["s78774bc1100",-6.09936,54.79805,33,0,"Tildarg 33kV Substation"],["sc074b0c3778",-2.13041,51.78639,33,0,"Camp Substation"],["s43b167558d6",-1.7927,50.84985,33,0,"Mill Lane Substation"],["sfc2dc9af68f",-2.69662,53.7048,132,1,"Leyland Substation"],["s3271668bdfd",-2.69315,53.70393,33,0,"Carr Lane Substation"],["sf0f4e0a72fb",-3.69115,51.7945,33,0,"Abercrave Primary Substation"],["s8a85aa03a0f",-4.17368,51.67732,132,2,"Llanelli Primary Substation"],["s49bbbf76523",-2.40407,52.52518,33,0,"Star Aluminium"],["s8e9d5a0c444",-4.21715,55.85361,33,0,null],["sf48b4866cf3",1.15057,51.08549,132,0,"Morehall Grid"],["s4627ba8f1da",-1.80295,52.87877,33,0,"Marchington Substation"],["s116b78f1275",-3.46904,53.25655,132,3,"St Asaph Substation"],["s17639532fa7",-1.35125,53.4014,400,0,"Brinsworth Substation"],["se82126b314f",-1.98151,52.39705,132,6,"Rednal Substation"],["s250de9a2e30",-0.93476,54.2523,66,0,"Kirbymoorside Substation"],["s9aa80fbbaaa",-0.15146,53.56582,400,3,"Grimsby West Substation"],["sed74053cd5f",-3.05733,53.02364,132,2,"Legacy Grid Substation"],["sa7f2d0bd2b0",-0.99249,53.73622,400,4,"Drax"],["sa6c1f35a091",-1.14689,53.52598,132,2,"Doncaster B 132/66 kV"],["s38c9e252714",1.61088,52.20855,132,0,"Greater Gabbard Onshore Substation"],["s503803688c8",-1.32061,53.44549,275,0,"Aldwarke Substation"],["s8322994292b",-0.63761,53.56033,33,0,"Bottesford"],["s29abd43cbbe",-2.18595,52.57317,132,1,"Wolverhampton West Substation"],["s48e252c0ebf",-1.61281,52.61599,33,0,"Polesworth Substation"],["s3d30574a0f5",-4.26009,55.84419,132,2,"St Andrews Cross Substation"],["sea301cd98b8",-1.96944,52.50745,132,2,"Smethwick Substation"],["s808b5d2a91d",-3.39766,52.97975,33,0,"Corwen Substation"],["sbb961af3604",-3.6453,51.64253,66,0,"Caerau Primary Substation"],["see3da701c9a",0.30328,51.39868,33,0,"Longfield Primary"],["s62edd0652bd",-4.63817,55.58411,132,1,"Meadowhead"],["s1417af55001",-4.34924,55.91554,275,2,"Drumchapel"],["s6ec9f1ea8a5",-4.19717,55.85729,132,1,"Carntyne Substation"],["sfb5c0cad4d9",0.82522,51.62739,33,0,"Burnham Substation"],["s57ab2141ff0",-2.39682,51.38119,33,0,null],["s11622d30202",-1.36004,50.91542,33,0,"Bitterne Substation"],["sbf7425ba08a",-2.21591,53.62181,400,1,"Rochdale Substation"],["s9517de6c3ad",-2.44949,51.97029,66,0,"Dymock"],["secb518e3fdc",0.14039,51.34518,132,1,"Chelsfield Grid"],["s4c4a9e4e9c6",-3.21649,50.85608,33,0,"Dunkeswell Substation"],["s9ba989f2ece",-4.72445,56.32532,132,0,"Inverarnan Substation"],["s9ea01b6d4a0",-2.73861,52.85737,132,1,"Wem Substation"],["s0fed17cb3da",-1.82275,53.6944,275,5,"Elland Substation"],["s52bccf365b1",-1.92369,53.90897,132,2,"Silsden"],["s8b0cbd8900b",-1.87503,53.75069,132,1,"Holmfield"],["s88e846b08b1",-0.33767,51.75466,33,0,null],["sf2a87c404f2",-1.93324,53.91682,33,0,"Bolton Rd"],["s553c1ae31d5",-4.03515,54.86082,132,2,"Tongland Substation"],["sae836a61c15",-0.1871,51.35975,33,0,null],["s498fd9e5f61",-1.20994,53.56489,66,0,"Brodsworth"],["s9386d677c40",0.51998,51.6642,33,0,"West Hanningfield Substation"],["s02acf73c166",1.17756,52.91564,33,0,null],["s96ede92a42a",-4.26229,55.77433,275,0,"Busby Substation"],["sff80e764b04",-4.25673,55.90304,275,0,"Lambhill Substation"],["s573308f3347",-4.19388,55.78589,275,0,"East Kilbride Substation"],["s9928a6c58ac",-2.94854,57.52323,400,2,"Blackhillock Substation"],["se52c7dc2007",-6.02738,54.57476,275,0,"Hannahstown 275kV Substation"],["s57343bd52d4",-2.02264,52.49315,132,1,"Birchfield Lane Substation"],["s8890d85f4e2",-0.84744,51.05501,33,0,"Langley substation"],["s18532b3ce42",-3.06785,52.7248,33,0,null],["s7e3e886b46b",-2.02311,52.49863,400,3,"Oldbury A Transmission Compound (Oldbury Substation)"],["sc93e586e58b",-1.20857,54.62792,132,1,"Greatham Substation"],["s8bd5ba99bb6",-0.69285,51.61257,33,0,null],["se13a544af09",1.25055,51.83776,33,0,"Frinton Substation"],["sa69f1d26082",-3.31473,53.3411,33,0,null],["s9d0aad304ee",-2.42075,53.59131,132,1,"Union Road Substation"],["s1f851407adb",-1.52872,53.80267,33,0,"Burmantofts Primary"],["sf3ca524f102",-1.77266,53.65108,132,1,"St Andrews Road"],["sa5ff18eef38",-1.5309,53.59679,66,0,null],["sef0f50af874",-1.80165,53.60376,33,0,"Honley Substation"],["sa6e4ba96e08",-1.62208,53.58919,66,0,"Scissett Substation"],["sb93d908498b",-2.31093,52.22784,66,0,"Kenswick Substation"],["sdabe4a2387f",-2.48442,52.61047,33,0,"Broseley Substation"],["s8b26559023c",-1.58405,53.77608,33,1,"Beeston Royds Primary"],["s01432dd36a2",-1.58378,53.77586,132,3,"Beeston Royds Grid"],["sd955002f1a4",-0.05223,52.07708,33,0,null],["sa119891086c",-2.54552,51.19233,33,0,"Shepton Mallet Substation"],["s5b15876be91",-2.1403,52.0678,66,0,"Strensham Substation"],["s59cdc0591ff",-2.23958,53.47596,132,0,"BLOOM ST GRID"],["s7081e4524f8",-2.51209,53.51439,132,2,null],["sb18c3843e9a",-2.17717,53.59763,132,1,"Castleton"],["s41f50189241",-1.99828,51.99133,66,0,"Alderton Substation"],["s61af2a2d485",-0.88643,51.6428,33,0,null],["sc2fbe126f80",-4.44786,57.50322,33,0,"Muir of Ord 33/11KV substation"],["sbb5305942c8",-2.10415,53.0703,33,0,"Endon Substation"],["scb11782bf42",0.09596,53.66849,33,0,"Out Newton WF"],["s9010cd5c61d",-0.742,54.23106,66,0,"Thornton Dale"],["s21bf70c52c2",-0.59579,51.71551,33,0,null],["s4c220b2e4ca",-2.11491,53.56489,132,1,"Royton"],["sa283e62ab5e",-1.97354,50.61339,33,0,null],["s3dc6dfe2639",-4.32191,51.8631,33,0,"Trevaughan Substation"],["s8aa26d3fcb6",-3.39935,51.52872,132,2,"Pontyclun Primary Substation"],["s94d7936a3ed",-3.19048,54.10641,132,3,null],["s46507833469",-3.11253,54.19073,132,1,null],["saffca186f49",-2.7377,54.29146,132,3,null],["s5a77d16e298",-1.49539,51.21747,132,4,"Andover Grid Substation"],["s0f48a500592",-2.75542,51.42633,33,0,"Nailsea Primary Substation"],["s4eefcaac270",-2.3513,53.47103,132,0,null],["s23ef9f05e20",-3.58997,50.42128,132,0,"Paignton Substation"],["s3e47fea5428",-1.79043,53.79551,132,1,"Girlington"],["s8be00d84ce7",-1.74058,51.55926,33,0,"Park North Substation"],["s79ebb834ec1",-0.69246,51.36338,33,0,"Bagshot Substation"],["sa4596343f30",-0.92705,51.45879,132,0,"Reading Main Substation"],["s96fecf86eb8",-1.31883,51.57438,132,0,null],["s0a53719fcb3",-2.88927,54.02346,132,1,null],["s75843645b42",-3.72753,50.44393,132,2,"Totnes BSP Substation"],["s722facf2ef1",-4.98931,58.42968,33,0,null],["s4b7e2ca4846",-1.54194,53.81386,132,2,"Leeds North Substation"],["s941a03c16ad",-1.20797,52.17348,33,0,"Woodford Halse Primary Substation"],["sd15631e9ff4",-1.24108,52.07742,33,0,"Thenford Substation"],["s025a12e07f7",-1.74732,51.61713,33,0,null],["s9949969a9fe",-1.42405,53.90264,33,0,"Leeds Road"],["s492495b657d",-1.47635,52.92579,132,1,"Derby Substation"],["s2983b0cdac9",-1.16497,60.16571,33,0,null],["s94dd01a8908",-4.18819,50.4228,132,2,"Ernesettle Substation"],["s1e92942c047",-2.71913,52.70427,33,0,"Weir Hill Substation"],["sdd1ad4fd78a",-4.41013,55.9189,132,2,"Kilbowie"],["s8d7868cd695",-0.02631,51.50701,132,0,"Westferry Circus Substation"],["sed19d18ba3f",-0.73433,51.12058,33,0,"Hindhead"],["sdfd4e679c73",-2.25902,52.58985,33,0,"Pattingham"],["sda87c1c106e",-3.59572,50.4529,33,0,"Marldon Substation"],["s89f6a8bf290",-1.57491,52.79311,33,0,null],["s7ed58c5020e",-1.47079,54.94007,275,0,"West Boldon Substation"],["s32dc7f1c246",-4.72241,50.53534,132,2,"St Tudy Substation"],["s7378d4c4d8b",-4.75657,50.45649,33,0,"Treningle Switching Station"],["se64bce0786e",-0.06927,53.69895,33,0,"Patrington Road"],["scc5c01dd6b1",-2.36432,55.51896,33,0,null],["s568b0fe4a88",-1.44957,54.9734,275,0,"South Shields"],["s0edb13326f3",-3.69236,51.53406,33,0,"Pyle Primary Substation"],["s8aad9436f02",-3.75426,51.56018,66,0,"Grange Substation"],["sd5a9090d3a0",-2.09484,51.06155,33,2,null],["sc80a31d2143",-2.16027,50.84913,33,0,null],["sa4849290739",-2.21933,50.78236,33,0,"Winterborne Kingston 33/11kV"],["s1e616f95ecc",-2.2094,50.92212,33,0,null],["s6cd945ba567",-5.38949,56.45153,110,0,null],["s1abd3aed3ab",-2.03417,50.65152,33,2,"Bushey 33-11 KV S/S"],["s73ec43e51e3",-1.03581,54.0945,132,0,"Sheriff Hutton 1064"],["s659942881ea",0.44688,51.62194,33,0,"Billericay East Substation"],["s7f265e3c7af",-2.47737,51.44607,33,0,"Cowhorn Substation"],["s5359d22c15a",0.28619,51.48356,33,0,null],["s070a8432cd4",0.2367,52.54196,33,0,null],["s7c2d09dddd3",-0.64167,54.18167,132,0,"Knapton Substation"],["sf42420c9200",0.12454,52.19605,33,0,"St Anthony Street Primary Substation"],["seb7f31cb54a",-1.48763,54.03126,275,0,"Knaresborough"],["s5ae76d01be1",-1.52181,54.07492,132,2,"Wormald Green Substation"],["s99c4cf5fe7a",-0.79185,53.98145,66,0,"Belthorpe Lane"],["s772a511296f",-0.41676,53.99941,132,0,"Driffield Substation"],["s497d9f830b4",-0.5148,53.97817,66,0,"Kirkburn"],["s9d666570c35",-2.24105,53.36178,132,0,"Moss Nook"],["sddc29a492cd",-1.80093,50.93891,33,0,null],["sb5b08edf0ae",-1.33248,53.60111,66,0,"South Kirkby"],["s7464ae26880",-3.98841,51.89726,33,0,"Llandelio Primary Substation"],["s49a75544f17",-0.78128,54.15067,132,1,"Malton Substation"],["s3be0a8a8ac4",-0.83137,51.40423,750,0,"Wokingham DC Traction Substation"],["s0476442937b",-1.13055,51.1665,33,0,null],["sd12837e9fcd",-1.06446,53.76894,33,0,"Selby"],["sf1da35fd9fb",-1.05169,53.7857,33,0,"Olympia Mills"],["s13127172764",-0.08274,51.54709,132,0,"King Henry's Walk Substation"],["s8fccd328d41",-4.37323,50.41794,132,2,"St Germans Substation"],["se6b3ebed53e",-1.28196,53.58445,66,0,"South Elmsall"],["s4df878e1588",-3.16687,55.89972,33,0,"Frogston Road East New"],["s136c8affc75",-0.09556,51.44742,750,0,"West Dulwich DC Traction Substation"],["s5caab4000a9",-0.22093,52.9314,400,4,"Bicker Fen Substation"],["s1be07697ba4",-0.03291,52.97765,33,0,"Sleaford Road Boston Substation"],["s288a8ed70a3",-0.01346,52.96161,33,0,"Marsh Lane Substation"],["s011e581f107",-0.62336,51.30479,750,0,"Brookwood DC Traction Substation"],["s542b39f7db2",-3.55196,50.4843,33,0,"Lawes Bridge Substation"],["s2e23930476e",0.11564,53.66039,33,2,"Easington"],["s829c7adf9c1",-4.13311,55.866,33,0,"Bartiebeith Road"],["s45428194ecd",0.15135,51.86701,33,0,"Newtown Primary"],["s695cbdf162c",-1.11947,51.24801,33,0,null],["s5b0ba63c9cd",-1.55937,54.32778,132,1,"Leeming Bar"],["sd025db3f5a5",-0.85706,51.40251,132,3,null],["s04b486ed926",-1.28511,53.71559,400,0,null],["sbc87aaf8a9c",-1.29056,53.71573,400,2,null],["sb0f73e5dd03",-1.28201,53.72363,275,0,null],["s892e38f44c2",-1.32709,52.68827,132,1,"Coalville Substation"],["s31dece4d975",-1.28284,53.71789,275,1,"Ferrybridge C Substation"],["sc051c8405a2",-0.96231,51.43415,33,1,null],["sd972b08b319",0.30152,51.61404,33,0,"Rose Valley Substation"],["sfff89b39a4c",-2.84853,52.03622,66,0,"Madley Primary Substation"],["s90e9fd9054e",-1.04869,51.41423,33,0,null],["sba824456df5",0.99302,52.43103,33,0,"Kenninghall Primary Substation"],["sf1baa47b60c",-1.51019,53.78745,33,0,"Pontefract Lane Primary"],["s15cf815b6cf",-2.98194,53.75642,132,1,"Lytham Substation"],["s244d3275599",-2.97988,53.78105,132,3,null],["sbd3f0e58002",0.19194,51.46639,750,0,"Slade Green DC Traction Substation"],["s6ae639c925a",0.85422,52.03726,33,0,null],["s74d1b340367",0.18197,51.57494,33,0,"Romford Substation"],["sbcc505802ff",0.15926,51.56902,132,1,"Crowlands Substation"],["s17235fa2a9e",0.23811,51.59982,33,0,"Harold Wood Primary"],["s7d5f8650859",-1.45898,53.3819,33,0,"Park Hill"],["sa2b77b4b07f",-0.25765,51.59436,132,0,"Hendon Grid"],["sfa4a118ff1c",-0.258,51.59497,132,1,"Hendon 132kV"],["s58fe30ff1c1",1.44719,52.2745,33,0,null],["s10499edfc58",-2.40484,50.88389,33,0,null],["s0d09494caac",-0.68875,51.36514,750,0,"Bagshot DC Traction Substation"],["s6fcf94d6b67",-0.16959,53.47874,132,1,"Wold Newton"],["s1d422b508d4",-3.53755,51.74103,132,2,"Hirwaun Grid Substation"],["sb02a08fc5b9",-0.53575,53.17501,33,0,null],["s31a796fd439",-1.40487,54.80498,275,0,"Hawthorn Pit Substation"],["s9e28b8aeac8",-0.3538,50.82222,132,1,"Worthing Substation"],["s6c782e290f6",-1.45777,54.88094,275,0,"Offerton"],["s5f5c2b28ec3",-4.18203,56.95295,33,0,null],["s4f9f5ed662e",-0.99254,53.73249,132,3,"Drax"],["sc7b4e54078d",-1.52327,53.78014,132,2,"Low Road Grid"],["s0738c4c6a89",-1.74926,53.76668,132,0,"Staygate"],["s211a0f8b88a",-1.53381,53.91856,33,0,"Dunkeswick"],["sc501dab1266",-4.97187,51.97861,33,0,"Fishguard Primary Substation"],["s0a578744fe6",-1.79556,53.80018,33,0,"Four Lane Ends"],["sebdc15e97a7",-0.34379,53.76592,132,3,"Sculcoates B"],["sdacc733cee9",-1.53262,53.78707,33,0,"Brookfield Street"],["sbfdfddb837b",-1.33024,53.51118,66,0,"Darne Road"],["sd2a4c7d0399",1.73083,52.59175,132,0,"Great Yarmouth Grid Substation"],["sa93e481408b",-1.99762,53.73483,33,0,"Mytholmroyd"],["sabe67938c5e",-2.10328,53.70879,33,0,"Todmorden Substation"],["sef8ec84980f",-1.55225,54.93764,66,0,null],["s392249f538d",-1.58485,52.33705,33,0,"Kenilworth"],["sb0cea3860bd",-2.13738,53.62213,132,0,"Belfield"],["s9637a698799",-2.16603,53.61648,132,0,"Rochdale Central"],["s68d59250ccb",-2.56614,50.88978,33,0,null],["s43b20a694b8",-2.48177,50.80787,33,0,null],["s71ebdc8789f",-2.46462,50.73719,33,0,null],["s1baa98e5499",-2.76143,50.73689,33,0,"Bridport Substation"],["se52f672826d",-2.54976,53.23809,132,2,"Hartford Substation"],["sc982614d246",-1.90305,53.61434,33,0,null],["sf1b9c267935",-2.06002,52.57648,132,2,"Willenhall Substation"],["s0f6a4468635",-2.0493,52.57784,275,0,"Willenhall Substation"],["s9fa0e637c76",-4.14332,55.93134,33,0,null],["s01b4f7775ea",-1.60468,53.49555,132,2,"Hunshelf Substation"],["sc571c845364",0.81573,52.57593,33,0,null],["s40cd3befeda",0.77741,52.70905,33,0,"Kempstone Substation"],["sd21a016ee37",-2.47336,51.49798,33,2,"Emersons Green Substation"],["s8f9466f9455",-2.28687,53.46198,33,0,"Chester Road Network"],["s7e478f11603",-0.04875,53.5357,33,1,"Humberston Substation"],["s4b6e777b744",-0.10899,53.56581,132,2,"Yarborough Road Substation"],["s51f29273eaa",-0.25642,53.65581,400,0,"Killingholme Substation"],["s07192b9ac98",-0.71368,53.43576,132,0,"Blyton Substation"],["sbdd9b88657f",-0.81313,53.48546,33,0,"Haxey"],["sad1c59e5d39",-0.93393,53.63328,66,0,"Thorne"],["sfae762323cb",-4.38179,57.88464,33,1,null],["sbd768db9972",-0.86728,52.01846,132,2,"Stony Stratford Substation"],["s79e84f65ae4",-1.43669,51.26984,33,0,null],["s3bab20a8261",-0.90476,52.04785,33,0,"Wicken Substation"],["s7bc0cf709b5",-0.09988,53.53473,33,0,"Scartho 18"],["s13db0e78b30",0.09522,53.44265,33,0,"Grainthorpe Substation"],["s156b128ec37",-0.3211,53.49965,33,0,"Caistor"],["s7e20526410a",-1.53468,55.20565,66,0,null],["sc6685994ddc",-0.0367,53.56278,33,0,"Conyard Road"],["s795ce425d35",-0.08075,53.56319,132,1,"Moss Road Substation"],["sb85c60ba818",-0.08254,53.56254,33,0,"Doughty Road Substation"],["s5fc07039715",-0.06939,53.55774,33,0,"Convamore Road Substation"],["se14438460f7",-0.0566,53.57442,33,0,"Marsden Road Substation"],["sbcdfd7af520",-0.6085,53.40108,33,0,"Harpswell"],["sefa9fcf1905",-0.45772,53.38118,33,0,"Normanby"],["s2aefad2027e",-0.83405,53.29748,33,0,"Woodbeck Substation"],["s58a874f0da9",-3.59592,50.53084,132,0,"Newton Abbott Substation"],["s0a17ac79df1",-0.69455,53.32254,33,0,"Stow 84"],["sc6fe4c5c716",-0.75763,53.40521,33,0,"Corringham Rd 33kV"],["scf1f220005c",-1.09582,53.29445,33,0,"Manton Substation"],["s0583433b5cf",-0.94971,53.3128,33,0,"Ordsal Road Substation"],["s2ed830244b9",-6.37289,58.20407,33,0,null],["sed42ebdea0b",-0.96141,53.32501,132,2,"Retford Substation"],["sf5a83987d70",-0.30756,53.28659,33,0,"Wragby Substation"],["sf50fc7e532e",-0.96911,53.44808,33,0,null],["sc5f40cc502e",-1.11124,53.30838,33,0,"Kilton Road Substation"],["s2f8240daee5",-1.22716,53.27682,132,1,"Whitwell Substation"],["s29bf0d986fe",-2.08442,51.8928,132,1,"Montpellier Substation"],["s600b24715a5",-0.95993,53.26174,33,0,null],["s52154f7b67f",0.22495,51.55958,132,1,"Hornchurch Substation"],["s1d72e9d6fd2",-4.93373,51.80657,132,2,"Haverfordwest Grid Substation"],["s37204495e36",-0.41535,53.23811,33,0,null],["sab3b99b531c",-0.48995,53.25453,132,1,"North Greetwell Switching Station"],["s580f93c25e2",-0.53927,53.24254,33,0,"Anderson Lane Lincoln Substation"],["scc07b2efb18",-0.576,53.27258,33,0,"South Carlton Substation"],["sc3fc1b47d72",-5.23934,56.34643,132,0,null],["sca66ec83158",-5.21093,56.33796,132,0,null],["s1839bb76203",-0.84391,53.43412,33,0,null],["saf5892be47b",-3.75431,52.41269,132,1,null],["s8cff965a070",-0.58384,53.48765,33,0,"Hibaldstow"],["s69e4c4da9d8",-2.66834,55.63842,33,0,null],["s908690df478",-0.17675,53.62184,33,0,"Queens Road"],["sedf3332a767",-1.89181,51.52892,33,0,null],["sc4cf5035ac8",-0.53162,53.67139,33,0,"South Ferriby"],["s44a6acf260b",-0.42272,53.68823,33,0,"Pasture Rd South"],["scdc8a4abd54",-0.66514,53.61631,33,0,"Billet Lane"],["saf03ee48ede",-4.13286,50.95665,33,0,null],["secf503683f6",-1.55584,52.43782,33,0,"Jaguar Cars Browns Lane Substation"],["s112dc2e9499",-0.3616,53.6795,33,0,"Barrow"],["s5a545090fe6",-0.25846,53.64107,33,0,"Eastfield Road"],["sb011f476ee2",-1.4826,52.39348,132,2,"Whitley Substation"],["s7ae32866e8a",-1.44842,52.36741,33,0,"Ryton Substation"],["sea491c83ec0",-1.48415,52.4302,33,0,null],["sdaa523e43f9",-0.62266,53.57534,132,1,"Scunthorpe South"],["s220b9e07306",-0.07285,53.45428,33,0,"North Thoresby"],["s9409fe7f718",-1.43085,52.227,33,0,null],["s3715f73c75e",-1.43394,52.22776,132,2,"Harbury Grid Substation"],["s6b0b61a490a",-1.22952,54.5041,400,0,"Newby 400KV Cable Compound"],["sa01d04283ce",0.48869,51.71014,33,0,"Chelmsford South Substation"],["sdd24d49d7f1",-2.0375,52.5413,132,1,"Ocker Hill Substation B"],["s3952feb3b6c",-2.50882,55.99406,33,0,null],["scad622f6985",-2.53666,55.99483,33,0,null],["s76d91c57363",-0.76436,51.41726,132,0,"Bracknell Substation"],["s11fc78b1508",-1.27703,53.7198,132,2,"Kirkhaw Lane"],["scf0bcb62b88",-0.41569,53.82122,132,1,"Beverley"],["se8821acd8e6",-1.56062,52.44264,33,0,"Hawkesmill Lane Substation"],["s1d262aa9caf",-0.22097,53.90516,66,0,"Seaton"],["sed150ba2db7",-1.18296,53.48488,66,0,"Edlington"],["s2f6ef1aed48",-1.13356,53.50494,66,0,"Balby"],["sa72d8797d16",-1.0885,53.48003,66,0,"West End Lane"],["sc9dcd77eaeb",-0.82578,53.60612,66,0,"Crowle 45047"],["sc00b55d5ff8",-0.94474,53.68283,66,0,"Rawcliffe"],["s946bb823384",-1.14134,53.55872,33,0,"Bentley Substation"],["s10c7ca46296",-1.13833,53.52612,33,0,"Doncaster Central Substation"],["s3774b9ce16a",-3.71639,55.92659,33,0,null],["s964fbcf4ff6",-1.4025,53.41885,132,2,"Blackburn Meadows B"],["s2a3e08d4dbe",-1.37701,53.50156,275,3,"West Melton Substation"],["s169edbf1aea",-1.37373,53.43264,132,3,"Park Street Substation"],["s9ffc5172347",-1.35617,53.43644,132,3,"Rawmarsh Road Substation"],["s562957d63cb",-1.4065,53.41878,33,6,"Blackburn Meadows Substation"],["s7ea99cdedd8",-1.31679,53.46792,66,0,"Kilnhurst"],["scbb12285061",-1.04398,53.53968,66,0,"Armthorpe"],["s8a82fd8ff4d",-1.07583,53.55855,66,0,"Kirk Sandall"],["s8d9140a6d30",-1.07313,53.53663,66,0,"Markham Gates"],["s93c59524d90",-1.28921,53.52967,66,0,"Barnburgh"],["s105f83f01c2",-5.37938,55.59636,33,0,null],["s1b75775f855",-1.24063,53.27894,33,0,null],["s24c87f26b1c",-1.33008,53.50303,66,0,"Wath Upon Darne"],["sda14b21c931",-1.26402,53.49326,66,0,"Mexborough"],["sabd08eff3a7",-3.92847,55.76443,275,0,"Wishaw substation"],["sd4cde179dd6",-1.19977,53.27406,33,0,null],["s4aa95924eba",-1.36046,53.26952,33,0,null],["s696d385f634",-1.38566,53.26699,132,1,"Staveley Substation"],["s47ec0ddc701",-1.17006,53.42361,66,0,null],["sb86e30522fc",-1.16217,53.42308,66,0,"Tickhill Road"],["se159ed7e585",-1.25403,53.40223,66,0,"New Orchard Lane"],["s76272c391d5",-1.25985,53.33447,66,0,"Kiveton Park"],["s9e73d28d3c2",-1.22197,53.37528,66,0,"Dinnington"],["s3e27470151b",-1.12677,53.3697,66,0,"Costhorpe"],["s976bf82577c",-1.06369,53.41644,66,0,"Harworth"],["s6417d851930",-0.01452,52.96902,33,0,null],["sebce42333e6",1.38949,51.22627,33,0,"Deal Primary"],["s5cac1a4f6db",-3.05889,55.93159,33,0,null],["s2c61fcf10bc",-0.69526,53.61876,33,0,"Flixborough"],["s956ed5f326d",-0.29461,52.96848,33,0,"Great Hale Substation"],["s7c6a7fa537b",-4.18546,55.09916,132,3,"Glenlee Substation"],["sd8f6a0cf68e",-0.09583,53.77405,66,0,"Burton Pidsea 5620"],["s906424370de",-0.32693,54.1886,66,0,"Hunmanby"],["s3e6b8c52845",-3.10576,52.79897,33,0,null],["s92dc8bbea91",-1.11265,53.54046,66,0,"Wheatley Park Substation"],["s2b38fe47bf1",-1.08644,53.55432,66,0,"Rockware"],["sd20672e4368",-1.00061,51.42468,33,0,null],["s7d5fbf6530b",-2.66554,53.34409,132,2,"Moore Substation"],["s2941c85141d",0.18839,53.25445,33,0,"Alford Substation"],["s5b11b866674",0.26421,53.32567,33,0,"Trusthorpe Substation"],["s4d6e89466eb",-1.01976,53.5947,66,0,"Stainforth"],["s4b619694dbf",-1.15965,53.61881,66,0,"Askern"],["s18285b5901e",-1.53624,53.84932,33,0,"Fir Tree Lane"],["s14bfbd3fdee",-0.90988,54.56229,66,0,null],["s7443c6142f9",-1.06206,54.60029,66,0,"Redcar Substation"],["s7106d217aa9",-3.27348,56.53832,132,0,"Coupar Angus Substation"],["s893baaf653b",1.09516,51.35418,33,0,null],["s5ebee2fd351",-0.07589,53.57598,33,0,"Grimsby Docks Substation"],["s2e7f86e4b74",-0.07568,53.57598,33,0,"Grimsby Docks Substation"],["s1ad605e31c5",-1.56155,51.83532,33,0,null],["sa76ca6db5ef",-1.00093,53.72949,66,0,"Camblesforth Substation"],["s9871aec6cf0",-0.08404,52.12762,33,0,null],["s848cc6ab512",-1.69561,52.27666,33,0,"Claverdon Substation 33kV"],["s0d0dc1bda14",0.02926,53.72601,33,0,"Withernsea Substation"],["se193a789bfb",-0.90732,53.69358,66,0,"Guardian Glass"],["s8ca6e8c7012",-1.17335,52.9785,132,2,"Nottingham North Substation"],["s53d89f4ade7",-0.88642,53.70094,66,0,"Goole 3728"],["seacbffc5bc7",-0.32,53.3956,33,0,"Walesby"],["sc4a434c5279",-0.63814,52.90401,132,2,"Grantham South Substation"],["s357d9acea4f",0.25546,51.69695,33,0,"Ongar Primary"],["s675b895a545",-1.21342,52.9618,33,0,"Bilborough Substation"],["s02ed04b276d",1.71496,52.57431,33,0,null],["sd5eb7b244f6",-0.12865,53.57509,33,2,"Great Coates"],["s86b1764eebd",-0.62915,52.91319,33,2,"New Beacon Road Substation"],["s2b46b2da34d",-0.0575,52.92144,33,0,null],["se6035a62874",-0.79634,54.14205,66,0,null],["sd9ff64f23a3",-2.00611,52.53074,132,1,"Black Lake Substation"],["s04d90212a58",-1.19885,53.00219,33,0,"Bulwell Substation"],["s6b42aee2c3d",-0.55115,52.39196,33,0,"Thrapston Substation"],["s3b3cec15754",-1.12194,60.60349,33,0,null],["s77fc1266254",-2.39638,53.07335,33,0,null],["saf7ed91431b",-1.86518,51.63787,33,0,null],["s8911c42cfd8",-1.40162,54.80626,66,0,"Hawthorn Pit Grid"],["s7b63e699b98",-1.43522,54.69475,66,0,null],["s746565903c4",-1.39791,54.8062,66,0,"Hawthorn Pit"],["s258976ebcbd",-1.63,52.58211,33,0,"Wood End Substation"],["s54a15fd0e2a",-2.37992,52.91289,33,0,"Hookgate Substation"],["sdee6a5c0ab9",-1.71198,52.53417,400,2,null],["s1e3623c958c",-1.70239,54.67311,132,1,"Toronto Substation"],["sc94063ad29c",-1.91625,54.55371,66,0,null],["sf874493a00b",-2.08002,54.74192,66,0,"Eastgate Substation"],["sa6483cf6cc0",-1.87241,54.72731,66,0,null],["s801ee3fe5bd",-1.31691,54.63968,66,0,"Wynyard Substation"],["s7c610c72c6a",-1.57999,54.59259,33,0,"Heighington"],["s10707b8e259",-1.70192,54.41324,132,2,"Skeeby"],["s379f3fe2935",-2.36135,51.71295,33,0,"Coaley Substation"],["sf1794d41c4c",-2.34633,57.08544,0,0,"Park Primary Substation"],["s6cb245bcf64",-3.94578,55.8244,275,0,"Newarthill Substation"],["s95c24acae87",-1.2327,50.84815,33,0,null],["sed35067d526",-3.46699,57.70037,33,0,"Burghead Primary Substation"],["s0f0b4509d89",-0.41453,54.26488,132,1,null],["s61d0f57c3b6",-0.8426,51.59536,33,0,null],["s242f3b4b88c",-2.9591,54.89928,132,2,"Carlisle Grid"],["s04fab10c267",-3.14542,51.49511,275,4,"Cardiff East Grid Substation"],["sb6a876a1b8f",-4.49599,57.43699,33,0,"Kiltarlity 33/11KV Substation"],["s7146384e483",0.16125,51.32001,750,0,"Polhill DC Traction Substation"],["sf8e8cfb79b7",-0.39303,51.53698,132,0,null],["sf75f0b023d0",-0.34764,51.54139,33,0,null],["s745b16284ee",-0.08628,51.39289,33,0,"Selhurst Substation"],["sf293416b19a",-2.50048,52.18608,66,0,"Bromyard Substation"],["s4c925e57c8c",-3.34666,51.77011,132,1,"Dowlais Grid Substation"],["s22066ca3702",-3.36087,51.7572,132,1,"Merthyr East Primary Substation"],["s32fd5a95aef",-5.8969,54.62576,33,0,"North Foreshore 33 kV Substation"],["s488732b881d",-0.71935,51.51829,33,1,null],["s6194c4e71c9",0.02933,51.48674,750,0,"Charlton DC Traction Substation"],["sa94f8dfe51f",-1.04436,53.94913,33,0,"York University"],["sd7ba47bd663",-0.84451,53.75372,33,0,"Thorpe Road Substation"],["sf0b3e306855",-1.60517,55.00968,132,1,"Gosforth"],["sfc8e854cb46",-3.9939,51.61541,400,0,"Sketty Park Primary Substation"],["s2cffb0a11cd",-1.0021,53.72972,66,0,"Drax Primary 66kV"],["sde7f057d68b",-1.03903,53.75098,66,0,null],["sbefd8c9bf6d",-1.22867,53.80367,33,0,"Fenton Lane"],["sfe894c3656b",-0.41109,51.49988,275,0,"North Hyde Substation"],["s7fd10fb8036",-0.22343,51.50561,66,2,"Bulwer Street Substation"],["sd61692472c5",-3.93155,55.83076,33,0,null],["s4640f1d7dbc",-3.45149,56.35763,33,0,null],["s5ee9fe0a40e",-1.20989,53.70701,33,0,"Beal"],["s43020439e32",-1.12264,53.70474,66,0,"Eggborough 6073"],["s7477c2dd871",0.48836,51.96227,33,0,null],["s36080fde429",-1.67997,53.71143,132,0,"Heckmondwike Substation"],["sb2a7748836a",-1.47425,53.5734,66,0,"Smithy Green Substation"],["sca0889b59ee",-1.8117,53.83371,33,0,"Nabwood"],["s9cc5e9d2e5b",-1.70796,54.7199,66,0,"Brancepeth"],["s8876d630365",-1.20245,54.60713,132,1,"Seal Sands Substation"],["s2cf88ddecb4",-1.94377,52.17329,66,0,"Bevington Substation"],["sd86698965e7",-3.38985,51.9433,66,0,"Brecon Substation"],["sd1b7fbe2c95",-1.14881,54.58059,275,0,"Grangetown Substation"],["s2889ed26428",-1.5376,55.02241,66,0,"Benton Square Substation"],["s419e50a7bcc",-1.5577,55.01167,132,2,"Benton Rail"],["s9491ff45bf9",-0.1135,51.5615,400,1,"Highbury Substation"],["s92afdbc3e76",-6.42522,54.37009,275,0,"Tandragee 275kV Substation"],["se2f6f4e4052",-6.68168,54.51195,275,0,"Tamnamore 275kV Substation"],["s994f3f6292c",-4.29972,55.79861,275,0,"Giffnock Substation"],["sf0629458239",1.15294,52.77144,132,0,"Sheringham Shoal onshore substation"],["s61c51a4052c",-1.35547,54.76546,66,0,"Shotton"],["sa6a5eea46a6",-1.3586,54.81556,66,0,"Stoney Cut Substation"],["s34016ec78e3",0.53306,51.09507,33,0,"Cranbrook Primary 33kV Substation"],["s2af1ad4f4ea",-0.20464,54.08907,66,0,"Brett Street"],["s2ec846edf8f",-1.59112,55.13438,66,0,"Reservoir 66/22"],["sd72ec309858",-1.56954,55.17181,66,0,null],["sa4c9ed7d91e",-1.72432,54.9886,132,1,"Blucher"],["s1ed4ffc6095",-1.71744,54.9724,132,3,"Newburn Haugh"],["sdc65e4119e9",-1.54576,54.52891,33,0,null],["s496c7a4d9b1",-1.51528,55.12845,66,0,null],["se9523142ebc",-1.81086,54.93919,132,0,"Coalburns Substation"],["s9a3a7f7e88f",-1.59495,54.90881,132,0,"Ravensworth"],["s3b1c695e785",-1.54041,54.88398,132,1,"Harraton"],["s83990b08036",-1.58476,54.90092,66,0,"Birtley Grove"],["s2cbb11ee543",-3.22998,54.12348,132,1,"Barrow"],["s0e6f42634ef",-0.16066,53.33809,33,0,"Belmont Covert Substation"],["sb5b4fa89185",-0.01232,53.38206,33,0,"Louth Substation"],["sb0f1f5e3c83",-0.54301,52.63767,33,0,"Tinwell Road Substation"],["s7f97646cad3",-0.32706,51.56235,33,0,null],["sc671f1a6075",-4.53575,55.93795,33,0,null],["s96f7844088e",0.84588,52.83001,33,0,"Fakenham Substation"],["s4236d881f3f",-1.81132,52.23406,66,0,"Great Alne Substation"],["s34fd9fd7b51",-1.49676,54.91641,66,0,null],["s3ee44c8f956",-1.45225,54.93799,66,0,null],["s1d6987341a4",-1.48606,54.86807,66,0,null],["s5ce8c4e1be2",-0.0232,51.48459,132,1,"Deptford Substation"],["s259745f8db0",-6.61587,54.73025,275,0,"Magherafelt 275kV Substation"],["s29c182a804b",-0.10999,53.58287,33,0,null],["sb565d4cd806",-0.82616,51.1921,33,0,null],["sceb48fe5c27",-1.70193,54.88596,66,0,"Tanfield Substation"],["sf69968c216e",-1.73197,54.84978,132,0,"Annfield Substation"],["s9b49320e164",-1.3935,54.87305,66,0,"Tunstall Substation"],["se7e8783a062",-2.18114,52.99628,132,0,"Boothen Substation"],["s724c4a2edfb",-1.41572,54.92134,66,0,null],["s5229f50ce1d",-1.39407,54.91142,66,0,"Sunderland"],["sf7000421a06",-0.31356,50.89311,33,0,"Steyning"],["s63dad08a8e6",-4.2953,55.82869,33,0,"Haggs Road Primary Substation"],["s9c2945a972f",-1.57659,54.78107,66,0,"Durham East"],["s1eb62e25ac2",-3.95017,51.7737,132,3,"Betws Wind Farm Substation"],["s25cbd7d83fa",-0.77637,52.21741,33,0,"Denton Substation"],["se046c515657",-1.59026,54.86436,66,0,"High Flatts"],["s3957865d9e2",-1.81952,54.85444,66,0,"Consett Substation"],["se1cabab169b",-1.49935,52.4859,33,0,"Newdigate Substation"],["s36449aaeeb8",-4.05468,58.0431,275,0,"Kilbraur Wind Farm Substation"],["se83330ab2df",-4.44133,55.86111,33,0,null],["s6f5a3f80e2d",-1.27925,53.44049,66,0,"Silverwood"],["saa086d57757",-1.10308,53.16604,132,2,"Clipstone Substation"],["s0decfbedb4e",-1.07099,52.82619,132,2,"Willoughby Substation"],["s619d358ff1c",-1.07053,52.82603,33,1,"Willoughby Substation"],["s7e5784b700b",-3.77548,56.56361,132,0,"Griffin Wind Farm Substation"],["s7531d798326",-2.78727,57.15196,132,1,"Tarland Substation"],["s962d1913bb1",-2.8415,51.43221,33,0,"Clevedon Primary Substation"],["sa448562371f",-4.35601,50.62897,33,0,null],["s2448f83d090",-3.46102,50.73494,33,2,"Exeter Science Park Substation"],["saa3058afab1",-1.27626,52.4388,132,0,"Pailton Substation"],["s3329758a453",-2.89977,54.37768,33,0,null],["scd5cb649a36",-1.56262,53.80091,33,0,"Burley Street"],["s4b2b57315a6",-0.73829,52.40106,132,2,"Kettering Substation"],["sca663aebb81",-0.83668,52.24289,132,2,"Northampton East Substation"],["s8fcac41c1c7",-1.07987,52.86893,33,0,null],["s9145f94d4cb",-1.57143,53.79562,33,0,"Hedley Chase"],["sd00d2177b35",-1.34197,53.32816,33,0,"Halfway Substation"],["s394b8bb9984",-2.77134,55.61037,132,2,"Galashiels Substation"],["sb82c9bdeddc",0.69083,51.44499,33,0,"Grain Primary"],["s5b37121d470",-0.89095,52.15243,33,0,null],["s70a178ace63",-0.22456,50.83771,132,4,"Southern Cross Substation"],["s512d49f28a4",-3.52921,54.50339,132,1,"Egremont Substation"],["s2a87cd64e56",-0.48926,54.1315,66,0,"Butterwick"],["s56f8c30dc4a",-0.41783,54.27157,66,0,null],["se914f9686a6",-1.38174,53.57052,66,3,"Grimethorpe Substation"],["s2a9d044a1fe",-1.36004,51.03763,132,0,null],["s6e9df91bded",-4.26629,57.55878,33,0,"Muirend 33/11kV Substation"],["s24fd1a46c30",-1.74139,52.19439,66,0,"Stratford Substation"],["se8d691a62ec",-4.03031,51.77245,132,1,"Ammanford Grid Substation"],["sdca68ac0ddf",-2.34074,51.76207,33,0,"Netherhills Substation"],["s2ce2f0763f5",-1.94801,52.6801,132,3,"Burntwood Substation"],["s6712083720f",-1.21277,54.66518,66,0,"Brenda Trading"],["s11584e37aa9",-1.12476,54.57529,275,0,"Greystones A"],["s41a6954f6ed",-1.12927,54.57414,275,0,"Greystones B"],["sbf464538009",-2.6892,52.36668,132,1,"Ludlow Substation"],["s84cc93b0583",-1.38653,52.03129,66,0,"Bloxham Substation"],["s157b2c3b857",-1.48836,52.51153,132,1,"Nuneaton Substation"],["sceaf297d3b0",-1.3956,52.52874,132,2,"Hinckley Substation"],["s6150d72fc60",-1.15447,52.25935,132,1,"Daventry Substation"],["sf9d79b04403",-7.66298,54.3494,33,0,"Drumlyon 33kV Substation"],["sf0f9af6fb8f",-2.09788,52.1343,66,0,"Pershore Substation"],["s0a9beebd899",0.1012,51.75641,33,0,null],["s9764ae5e7d9",-3.28498,55.06602,132,1,"Ecclefechan"],["s65dfde13a64",-3.51174,51.61269,66,0,"Pant y Wal Wind Farm Substation"],["sa9f69bc9585",-1.85572,52.0545,66,0,"Broadway Substation"],["s63c4afc60d9",-2.48903,52.71873,132,2,"Hortonwood Substation"],["saaca2dc8bb8",-2.10642,52.79397,132,2,"Stafford South"],["sd57da889596",-0.18338,52.34123,132,0,"Huntingdon Substation"],["s2addf65fd34",-1.45847,50.983,33,0,null],["s9ea6ec4cef0",-2.67661,52.14878,66,0,"Bodenham Substation"],["s42ee33796f3",-2.7611,52.22867,66,0,"Leominster Primary Substation"],["sc9b1e44529b",-2.72714,52.30718,66,0,"Woofferton Substation"],["s7ecd55a3baf",-2.11698,52.48971,132,3,"Woodside Substation"],["s52beffc60a2",-0.22123,50.83463,132,2,"Fishersgate Substation"],["s45c1da3cb17",0.04691,51.45464,750,0,"Eltham (Well Hall) DC Traction Substation"],["s0f99c27a8be",-1.5265,52.45537,33,0,"Coventry Colliery Substation"],["sd169712804b",-1.53939,52.40521,132,2,"Coventry South Substation"],["s097bb227be8",-3.12943,51.86595,66,0,"Crickhowell Substation"],["se2bf34aa56f",-4.79311,57.32952,275,0,"Fasnakyle Substation"],["s7e4ce0fc1e0",-1.24846,51.92731,33,0,null],["s7f20539eff2",-2.99703,53.8824,132,1,null],["s6a5238dd5d6",-2.32201,52.42612,33,0,"Arley Substation"],["s733c5ba8945",-4.01112,53.06616,33,0,null],["sb7202dba867",-3.84218,53.19177,132,1,"Trefirw Substation"],["s1d656f1ff03",-4.10566,52.86363,33,0,null],["s6b5dde4e3f8",-0.26186,52.55614,132,1,"Peterborough South Substation"],["s6301f753e81",-1.51527,50.68117,33,0,"Freshwater Substation"],["s53f87bd7002",-2.3472,56.96445,275,1,"Fetteresso Substation"],["s552201a3f38",-3.00761,52.21206,400,0,"Kington Primary Substation"],["sddb811041c5",-1.82833,53.65548,132,1,"Lindley"],["sf09aee1dc1f",-1.65342,53.67775,132,4,"Thornhill 132"],["sa2391c38eeb",-0.74242,51.33667,750,0,"Camberley DC Traction Substation"],["sa5673b2a1cf",-0.30315,51.73722,132,2,null],["sfb52780cf7b",-0.31328,51.74492,132,1,"Cell Barnes Substation"],["s48e54705fd1",-4.30999,55.9033,132,1,"Killermont"],["s397fb632ff9",-7.66839,54.51643,33,0,"Barnalackan 33kV Substation"],["s6de447917ab",-4.4303,56.54746,33,0,null],["s401b4096f30",-1.94058,50.75556,33,3,null],["s77c384231bd",-1.1519,52.94904,33,0,"Castle Road Substation"],["s6e9d18140f7",-0.41718,53.83702,33,0,"Spark Mill Lane"],["s0c83885515a",0.00872,51.21381,33,0,"Crowhurst Primary"],["s565f3b222b7",-0.71307,52.4853,33,2,"Hazelwood Substation"],["s8fd9dc0d37a",-4.01236,50.3718,132,2,"Plympton Substation"],["s0615e68e4c3",-1.21307,51.36386,132,1,"Ashford Hill Compound"],["sc44236265f6",-3.78378,56.71701,132,2,"Clunie Substation"],["seee97ed72ae",-1.80885,50.72816,33,0,"Southbourne 33/11KV S/S"],["s217c7f94c3b",-1.13698,51.60074,33,0,null],["scb909accf05",-2.79901,53.5609,132,1,null],["sc75828571c7",-3.13349,55.91792,33,0,"Little France Primary"],["sec9d4124b14",-4.90792,51.68396,132,2,"Golden Hill Grid Substation"],["s0e15fb1114f",0.05625,50.79648,33,1,"Newhaven Town Primary"],["se877eaddaa8",-5.1085,57.0692,132,3,null],["sef18e4f066b",-1.16359,52.93485,33,0,"North Wilford Substation"],["s6625f972464",-3.20267,53.29307,33,0,"Greenfield"],["s5d007499973",-2.20211,53.05065,132,3,"Burslem Substation"],["s0717c5c4abb",-4.56179,55.96126,132,2,"Strathleven"],["s88ad906ca92",-0.23261,51.75349,33,0,null],["s1ae7b4fca9c",-1.39448,53.16346,33,0,"Danesmoor Substation"],["sb4bdc32211e",-0.25646,51.54519,132,2,null],["sf7f57e2d475",-0.2581,51.54507,132,2,"Leicester Road Grid Substation"],["s09afc198ea1",-0.61167,53.57828,33,0,"Seraphim"],["sb2640da6ec0",-0.62201,53.59113,33,0,"HPM 33"],["s02151debe08",-0.61205,53.59363,33,0,"DLCO"],["s0b7ad184e2c",-0.62534,53.5825,33,0,"SRM"],["s24e67d4068b",-2.2093,55.8034,33,0,null],["s13ab2c2a0da",-3.53456,55.89016,33,0,null],["sde6ee785016",-5.94746,56.51486,33,0,"Salen"],["s4665e285e06",-2.3479,51.69062,33,0,"Dursley Substation"],["sb103c2c143d",-0.45348,53.56001,33,0,"Wrawby"],["sd34e454fa30",-3.29481,56.34027,132,1,"Abernethy Substation"],["s44f7d3f061a",-0.88126,52.22941,132,3,"Northampton Substation"],["s02308a0ca9b",-1.65924,53.09482,33,0,"Longcliffe Substation"],["s15137121a9a",-0.67961,52.28735,33,0,"Little Irchester Substation"],["sd0a5966d3e7",-0.81502,52.44527,33,0,"Desborough Substation"],["s5aa27a45bd9",-0.33309,51.3826,750,0,"Hampton Court Junction DC Traction Substation"],["s99da8613370",-0.5342,52.0786,132,0,"Marston Grid"],["s8aceecf702b",-2.16938,57.14861,33,0,"Springhill Primary Substation"],["sa8b49fa636c",-3.00536,53.36421,132,0,"Rock Ferry Substation"],["s8c2632b070e",-4.1574,53.24224,33,0,null],["s7d836d03f16",-2.96349,53.33396,132,1,"Bromborough Substation"],["sb25e0f97f48",-2.89175,53.18832,33,0,"Grosvenor Street"],["sf4d96619257",-0.64229,53.58902,33,0,"Station Road"],["s23f173c41ec",-3.82591,50.4276,33,0,"South Brent Substation"],["s030aa8dccbd",-1.43257,53.60849,66,2,"Monckton"],["s390491bf61d",-1.37059,53.63549,66,0,"Hemsworth"],["s25702ddef49",-0.23841,53.63836,400,0,null],["s8352a1f9b99",-2.07815,52.96598,33,0,"Simplex Substation"],["sfc43033dc84",-1.50741,53.36214,33,0,"Marmion Road"],["s9ad805a04bc",-1.23175,53.12348,33,0,"Sutton Junction Substation"],["sd7e0798b198",-1.48299,54.40275,132,0,"Hutton Bonville Rail"],["sc5c6b276b4c",-2.91952,54.39768,33,0,null],["sa7199a192dd",-0.81148,51.28391,132,0,null],["s75a935745ac",-3.40343,50.85928,33,0,"Cullompton Primary"],["s36a677dcf87",0.43141,50.88634,33,0,"Ninfield Local Primary"],["s5f8045924f7",-1.58981,53.80677,132,2,"Kirkstall C"],["sfeca17d0688",-0.80718,51.50468,33,0,null],["s188331976a4",-0.7543,51.51143,132,0,null],["sd87cc9a2306",-0.23769,53.74426,33,0,"Yorkshire Water Hull Road Substation"],["sc410d5225d6",-3.52574,51.66962,33,0,"Ynysfeio Primary Substation"],["see006f2f265",-4.76631,55.1376,275,0,"Mark Hill Substation"],["s5360854070b",-1.17673,50.8036,33,0,null],["sfc2b6fbdc27",-3.95689,58.11428,275,0,"Gordonbush Wind Farm Substation"],["s83f92419ff7",-2.25731,51.86765,132,3,"Castle Meads Substation"],["s8b214fa575e",-4.22648,50.51974,33,0,"Gunnislake Substation"],["s0f165d61725",-3.40453,55.88941,33,0,null],["s7cac306eba7",-2.53977,55.91499,400,1,"Crystal Rig Substation"],["se91c3ca6f2e",-2.66491,55.82503,400,0,"Fallago Substation"],["s8d52b3c537c",-3.75778,51.5664,66,0,"Cefn Gwrgan Substation"],["s31f8571743f",-3.7566,51.56717,132,1,"Margam Grid Substation"],["sf9fdd88bfb5",-3.247,56.62037,33,0,null],["s21a0119b4f9",-1.2592,51.62565,400,0,"Didcot Substation"],["s8ab403fbf23",0.94753,50.91454,400,0,"Dungeness Substation"],["sb6afa31f1b0",0.94049,51.3382,400,0,"Cleve Hill 400kV Substation"],["s7a8ba8c2710",0.39264,51.45395,400,0,null],["s1a33f10e9ca",0.14109,50.86621,33,0,"Ripe Primary"],["s38c02e01aa3",0.0024,50.98232,33,0,"Newick"],["sf4cbddf45fb",0.24333,50.85845,33,0,"Lewes / Polegate Grid O/H - U/G termination"],["s5bff43f9b9a",0.09519,50.97028,33,0,"Uckfield Primary"],["s614ed746ab9",0.04312,51.58858,275,0,"Redbridge Substation"],["s8b421618909",1.61658,52.21502,400,2,"Sizewell B Substation"],["s46224185628",1.27592,52.57529,132,8,null],["sd9de68ff3d6",-2.42427,50.79702,33,0,null],["sb294e0ca38b",-2.36699,50.75456,33,0,"Puddletown"],["s1134dfb7473",-4.45164,50.44857,33,0,"Liskeard Substation"],["sbad2cc49ea9",-3.58766,55.90648,132,0,"Drumcross"],["s6f8e6085497",-0.61475,51.30942,33,0,null],["s309c97af3f9",-2.07864,55.77741,132,1,"Berwick"],["sbf01bc8d29f",-0.07073,51.51686,132,2,"Osborn Street Substation"],["sa224e51b58b",-2.22683,53.08281,33,0,"Goldenhill Bank Substation"],["s3fd39522c02",-2.00078,52.59775,132,3,"Wallsall Substation"],["s5084c116fbd",-3.94463,52.99369,33,0,null],["sd8e637ba89c",-3.93008,52.96902,33,0,null],["sf2fc9fc36c1",-1.09715,53.22552,33,0,null],["s4a5c826d03c",-3.05732,52.98687,33,0,"Cefn Mawr Substation"],["sfbc159f7eb6",-2.99099,53.07393,33,0,"Pandy"],["s096a8111567",-1.14044,53.21635,33,0,"Warsop Substation"],["sbf7eb590339",-3.41723,53.31008,33,0,null],["s6f468b8de8d",-1.07889,50.84486,132,4,"Wymering Grid Substation"],["sd6e8042f744",-2.89484,53.15991,33,0,"MBNA"],["s9e47dde6a77",-2.81129,53.27788,132,4,"Ince Substation"],["sd00b11300d1",-2.77695,53.2689,33,0,"Meres Edge"],["sc39a189fae9",-4.24127,56.93331,33,0,null],["sffb14bf88ec",-3.00704,53.34124,33,0,"Spital Primary"],["sd5f6181f707",-4.43489,56.06103,33,0,null],["s0ed664d28ae",-3.13138,54.60377,33,0,"Keswick Substation"],["se9b5377908d",-3.23675,55.93639,33,2,null],["s6c9c43cef02",-2.21463,52.44065,33,0,"Kinver"],["sce39ec3e2bc",-3.57246,53.29683,132,0,"Gwynt y mor Onshore Link"],["sace4c105c72",-3.47412,53.24998,400,3,"Bodelwyddan Substation"],["sbdac493b41b",-3.82208,51.62497,132,4,"Briton Ferry Grid Substation"],["s01dd05b9e46",-3.82405,51.62916,275,3,"Briton Ferry North CSE Compound"],["s13805068b00",-3.82342,51.62399,275,0,"Briton Ferry South CSE Compound"],["s2f1880f46e7",-3.82803,51.63355,400,0,"Wern Primary Substation"],["s365e2212019",-3.48465,53.30975,132,1,"Rhyl Substation"],["s189620c096b",-1.53482,53.79301,33,0,"Clarence Road Primary"],["sa087cbfd9e2",-4.65944,50.412,33,0,"Lostwithiel Substation"],["s741592e9156",-3.81974,53.29602,33,0,null],["sc77e26a3573",-3.76193,53.29683,132,0,"Colwyn Bay Substation"],["s09aae610717",-1.53804,53.5471,66,0,"Elmhirst Lane Substation"],["sc496f2d62ea",-1.59251,53.48498,66,0,"Hunshelf Bank Substation"],["s4a9915160f1",-1.35891,50.88724,33,0,"Weston PSS"],["s7bb81b8f108",0.53391,52.48627,33,0,null],["s3b20eae6c90",-3.67256,55.43736,400,0,"Elvanfoot Substation"],["se63b09bc055",-3.92464,53.2646,33,0,null],["sa2f2c5fea91",-3.8383,53.28397,33,0,null],["sf978c4996f8",-4.28495,53.21665,33,0,"Gaerwen View"],["s3b4c83d3b8f",-2.94358,53.27342,33,2,"Sutton Hall W.W.B"],["sc51b4e4d393",-0.9094,51.3858,33,1,null],["s72a077d0242",-0.93454,51.36978,33,0,null],["sdf6057fb57f",-6.83017,57.84559,132,1,"Harris Substation"],["s902f4ec2ead",-1.94804,52.28788,66,0,"Redditch South Substation"],["sb7ab912eff3",-4.15765,53.20994,33,0,null],["s3f5949770ec",-4.24546,53.16531,33,0,null],["sf2592d680b2",-7.73135,54.65387,110,0,"Magherakeel 110kV Substation"],["s2a4ae784f6e",-1.34421,53.1153,33,0,"Blackwell Substation"],["sca26d7d1269",-1.45921,53.83384,132,1,"Whinmoor"],["sa55fae3630e",-5.70064,57.28071,33,0,null],["sb248d6a0e81",-0.07976,51.51638,132,0,"Devonshire Square Substation"],["s758f0a10a4a",-0.55079,51.32451,33,0,null],["s4ce83534190",-2.99159,53.32083,33,0,"Dibbinsdale Primary"],["s08841853af2",-2.96853,53.3172,33,0,"Bridle Road Primary"],["s2bfe848ea1d",-4.72243,50.35405,33,0,"St Blazey Switching Station"],["seb7a1cc0e99",-2.61463,57.34694,33,0,null],["s3062593aa44",-0.05354,51.43314,132,0,"Sydenham Park Substation"],["sd55699bc4a5",-0.18245,51.47743,132,1,"Lots Road Substation"],["s826cb33a5cb",-0.74592,50.96877,33,0,null],["s09c9a3c5e35",0.01706,50.87341,33,2,"Lewes Central"],["sa76d666e6aa",-3.28075,53.25884,132,2,"Holywell Substation"],["sbe927c88839",1.21388,51.25199,33,0,"Wingham Primary"],["s23c3932bcf5",-2.33579,53.77562,132,1,null],["sf5db9ce2081",1.40766,52.71606,33,0,"Wroxham Primary Substation"],["s05b909f26c8",-0.27034,52.20692,132,3,"Little Barford Substation"],["s7f87c406951",-2.99442,52.49151,33,0,null],["s86284028c2b",-3.46883,53.28426,33,0,null],["sfe6c5962887",-3.13253,51.20609,275,0,"Hinkley Point A Substation"],["s27d61564a36",-3.12766,51.20678,400,0,"Hinkley Point B Substation"],["sbb5f54d18ea",-1.26168,51.62708,400,1,null],["sbdceec7827c",-1.268,51.62566,400,0,null],["sceffa2ab890",-2.15394,51.39514,275,2,null],["sae1d168b6d1",-2.67023,51.53676,400,4,"Seabank Substation"],["s12533d00d10",-2.90826,51.56623,33,0,null],["s1d3d446184c",-2.90922,51.5662,33,0,null],["s10a0679333c",-4.97282,51.7342,132,5,"Milford Haven Grid Substation"],["sec856217656",-3.19602,55.95441,33,0,"Thistle Court Primary"],["s7cd39103583",-4.83132,50.34493,33,0,"Blackpool Substation"],["s59b911d9c77",-6.53959,57.43264,132,2,"Dunvegan Substation"],["s3f241965611",-3.10507,58.44206,33,0,null],["s120db1c3449",-0.03312,51.35746,33,0,null],["s73422d9fa8b",-2.1466,51.67482,33,0,"Cherington Substation"],["sa3b0a094573",-3.56085,53.27535,33,0,null],["s8b3004c48cf",-3.05581,53.41301,132,1,"Wallasey Substation"],["s057c6dfddff",-2.81305,53.27715,33,3,null],["s0356017cb0f",-4.19564,57.47339,33,0,"Raigmore Primary"],["s947de573ccc",-1.46163,53.5175,66,0,"Worsbrough Park"],["s1cf08bbef44",-4.21319,57.46021,33,2,"Hilton Primary 33/11kV Substation"],["sb252b8be87b",-4.24349,57.4749,33,0,"Dalneigh Primary 33/11kV Substation"],["s145632f2d2f",-3.62433,53.43731,132,1,"Gwynt y M\u00f4r West OSP"],["s6806d062587",-3.54061,53.46572,132,1,"Gwynt y M\u00f4r East OSP"],["se5b8d155836",-4.32327,57.29261,33,2,"Dumnaglass 33/11kV substation"],["s37804428326",-4.49265,57.25518,33,0,"Foyers Substation"],["sefa6c37c227",-4.01031,57.34204,33,0,"Tomatin Substation"],["sb000ab7c21f",-4.25475,57.5062,33,0,"North Kessock Primary 33/11kV substation"],["s9865a0ac8ea",-5.42954,50.19261,132,0,"Hayle Substation"],["s911d02ea369",-3.56923,50.77513,33,0,"Newton St Cyres Substation"],["sd1c9cf5ec84",-2.83639,51.31828,33,0,"Winscombe Substation"],["sed5cb7dc049",-4.6894,57.57561,132,1,"Luichart Substation"],["s418e5147b1b",-4.79743,57.62854,132,0,null],["sd8d772c6c14",-1.36387,53.5471,66,0,"Houghton Main Substation"],["sc6e22dd9b66",-4.61614,57.55382,132,0,null],["s39f5f183dbc",-0.88402,51.95161,33,0,null],["sad608148370",-4.70271,57.42555,132,1,"Culligran Substation"],["sa80ed8bd58c",-4.8441,57.40737,132,1,"Deanie Substation"],["s5faef1beb51",-2.97166,51.54941,132,6,null],["s4c776a5818a",-3.38931,51.39583,132,2,"East Aberthaw Primary Substation"],["s593b5cce703",-4.07606,50.8173,33,0,"Hatherleigh Substation"],["sf37e9fdbcec",-3.8316,51.61615,275,0,null],["saf5050494d5",-3.83248,51.61699,275,0,"Baglan Bay Substation"],["s9701d06cfdf",-4.76901,57.63437,132,2,"Corriemoillie Substation"],["s6be332e9228",-4.25697,53.14765,132,1,"Caernarfon Substation"],["se69e63bfb36",-4.20145,53.12398,33,0,null],["s0b044082dcf",-4.59937,53.29504,132,1,"Penrhos"],["sb11962dfefd",-4.30118,53.05692,33,0,null],["sbb661bfc596",-4.40877,52.98388,33,0,null],["scd2bef4cee4",-4.38422,52.93149,132,1,"Y Ffor Substation"],["s859cb18a778",-4.24955,53.07557,33,0,null],["s006c6045501",-4.26133,52.94246,33,0,null],["s17c1d0b34b5",-4.41662,52.89441,33,0,null],["s02451bc13f8",-2.37693,53.19767,33,0,null],["s096ea54bf72",-1.48215,55.00368,132,1,"Flatworth"],["s6776d151749",-2.91058,52.65018,33,0,"Malehurst Substation"],["sd05fc0cdf4b",-0.6226,53.58209,33,0,"CMB 33kV"],["s03c139ddc19",-0.59975,53.57384,33,3,"MSM 33kV"],["s17d622b8d23",-4.89472,55.71806,600,0,"Western HVDC Converter Station"],["s46ecbd90cc6",-1.29881,53.54371,66,0,"Hickelton"],["s396c021e01e",-1.41285,53.4963,66,0,"Elsecar"],["s80f7cb2a8a2",-2.26344,53.0824,33,0,"Talke Substation"],["se2ad1af645e",-0.38965,53.7798,33,0,"Endike Lane Substation"],["s8ba960cfbe0",-0.35934,53.78135,33,2,"First Avenue Substation"],["s6de9cce26de",-4.18031,53.20955,132,0,"Bangor Substation"],["s7244edf100b",-6.64535,57.55442,132,1,"Ardmore Substation"],["s7a16b854489",-6.29982,57.29856,33,0,null],["s12aaf4a4db3",-3.1227,52.65342,132,1,"Welshpool Substation"],["s16ed6a787c7",-3.80275,55.76933,33,0,null],["sc060fbc6eaf",-3.33282,50.63034,33,0,"Budleigh Salterton Substation"],["s8bcbfc7b561",-3.40083,50.63092,132,1,"Exmouth Substation"],["s82aa10fca84",-3.24689,50.70188,33,0,"Core Hill Substation"],["s17e0a1cdd7a",-3.15272,50.79482,33,0,"Offwell Substation"],["s1024a2ec215",-4.88725,55.72004,400,0,"Hunterston East Substation"],["s5ba5a35997a",-0.39281,53.75733,33,0,"County Road North Substation"],["sbf57bdaced8",-4.11593,53.14306,33,0,null],["sd694cb4c013",-0.06825,51.53523,33,0,"Whiston Road Substation"],["sfa2fca69fb2",-6.42276,58.20334,132,1,"Stornoway Substation"],["s51eabc1558d",-3.43427,58.26561,132,2,"Dunbeath Substation"],["sd269434ff3c",-4.61814,50.65483,33,0,"Davidstow Substation"],["sc7bc9b0cc43",-4.11348,53.11505,33,0,null],["s9e79dc845a6",-1.07915,53.5855,66,0,"Trumfleet Generation"],["s9db896d47e4",-1.15819,50.81548,33,0,null],["sa184dad5828",-1.26228,52.38825,132,3,"Rugby Substation"],["sed279005ae4",-1.2554,52.38653,33,0,"Brownsover Substation"],["s66b28d9386c",-4.35704,50.80489,33,0,null],["s051ffdb8a31",-4.72924,58.1876,132,1,"Cassley Substation"],["s6aa1130405a",-4.27451,57.70825,132,2,"Alness Substation"],["s76f9a290e72",-4.3931,58.03054,132,1,"Lairg"],["s21a99748599",-0.32993,53.78943,33,0,"Tiverton Road Substation"],["sfa9857fcc42",-4.77387,57.07202,132,0,"Invergarry Substation"],["s8667970ab9e",-5.65907,56.88299,33,0,null],["s8992a298e67",-5.12318,57.06275,132,1,"Quoich Substation"],["sa507132789e",-1.84876,57.57406,132,1,"St Fergus Gas"],["s2345c60af32",-1.88139,57.5664,132,3,"St Fergus"],["s487979e9c37",-1.89435,57.42645,33,0,null],["s065edb49825",-3.32447,56.58579,33,0,null],["s8ba2a252502",-2.18005,57.12179,33,0,"Craigton Cults Primary Substation"],["sfc42b7e4dd2",-0.3325,53.80293,33,0,"Wawne Road Substation"],["s5c84b9aefc6",-4.93683,57.15411,132,1,null],["s0cc1ad600c3",-3.31597,57.41598,132,2,"Glenfarclas"],["s1f069da236b",-4.8698,57.15402,132,1,"Beinneun Substation"],["sb051605f9eb",-3.42033,57.55681,275,0,"Dallas"],["s78b317959ea",-2.55685,56.72038,132,1,"Bridge of Dun"],["s85aa88f56cc",-2.62817,56.74019,132,2,"Brechin Grid"],["s66e538d7258",-2.6196,56.56398,132,1,"Arbroath"],["s5161f795cdd",-2.30194,56.92459,132,2,"Fiddes"],["s66cd5308878",-2.02411,57.68626,132,0,"Fraserburgh"],["s912d1262ecc",-3.04484,56.47409,132,4,"Charleston"],["s1c23f9037f6",-2.07013,57.58613,132,0,"Strichen Substation"],["s9d9230999cc",-2.49853,57.66401,132,1,"Macduff"],["s67aa2fd2230",-2.81325,57.67245,132,2,"Lintmill Substation"],["s0ed68a4cdab",-1.80561,57.50864,132,2,"Peterhead Grange"],["se7380bfb694",-3.01745,56.48113,132,4,"Lyndhurst"],["s8dde42c6924",-2.2656,57.09869,33,0,"Culter Primary Substation"],["s4ffcc35bc57",-1.4425,50.9156,33,0,null],["s95707edc992",-1.05996,53.68071,33,0,"Pollington"],["scf495e795bf",-4.81374,50.52202,33,0,"Wadebridge Substation"],["s1173673fc50",-1.12903,51.37427,33,0,null],["s647913759bf",-4.71326,50.62677,33,0,"Delabole Substation"],["s20187f07b07",-4.53005,50.64426,33,0,null],["s084067439f0",-4.6998,50.4797,33,0,"Callywith Substation"],["s3f24da5b6c1",-4.95557,56.28703,132,1,null],["s435eef497fe",-5.04173,56.26189,132,3,"Inveraray Substation"],["s1f6e73057ba",-5.14499,56.1979,132,2,"An Suidhe Substation"],["sf89ca3f5c08",-4.92227,56.27711,132,1,"Ardkinglas Substation"],["sb8cb781afe9",-5.11281,56.40278,275,0,"Cruachan Substation"],["s695c54374e0",-4.94786,55.97566,132,1,"Dunoon Grid Substation"],["sa2cb3a99ba7",-4.84095,56.08964,132,2,"Whistlefield Substation"],["scead65e373a",-4.70868,56.02345,132,2,"Helensburgh"],["s25ee5235bac",-5.01344,56.42006,275,0,"Dalmally Substation"],["s801f2698a5e",-3.96385,55.94691,132,1,"Cumbernauld"],["s1664d5a975c",-1.29191,53.14842,33,0,"Teversal Substation"],["s8d419dbb1c9",-4.16327,55.74088,275,0,"East Kilbride South Substation"],["sd5d59fdebe6",-4.89081,55.72004,400,0,"Hunterston Substation"],["sb3a64cbc351",-4.41301,55.84042,132,2,"Paisley Substation"],["scd1234a2f64",-1.35439,50.968,33,0,null],["sf01846e2646",-4.01322,55.8512,275,0,"Coatbridge Substation"],["s0072f463987",-3.99295,55.82857,275,0,null],["s0171bfca967",-3.17863,55.90314,33,0,null],["s95e4e384b24",-2.96744,55.94441,33,0,null],["s36b994fd23e",-2.96627,55.96652,400,0,null],["s6f9b884f04d",-4.70701,55.25023,132,1,"Hadyard Hill Wind Farm Substation"],["sd29afdbd5b3",-4.68408,55.34204,132,1,"Auchenwynd Substation"],["s72da067a11c",-4.17134,55.69558,275,0,"Whitelee Wind Farm Substation"],["s038633abafa",-4.30358,55.68039,275,0,"Whitelee Wind Farm Extension Substation"],["s40e3d914331",-0.10755,51.4384,750,0,"Tulse Hill DC Traction Substation"],["se60e64e7479",-1.39007,51.69325,33,0,null],["s209c652adb4",-3.22964,55.01646,132,4,"Chapelcross Substation"],["sd78337ee147",-4.4989,54.95341,132,2,"Newton Stewart Substation"],["s3a59e6292dc",-3.59113,55.06765,132,2,"Dumfries"],["s04f80c9c72d",-4.80785,54.88212,132,1,"Glenluce Substation"],["sdee92b504b3",-4.19095,55.16367,132,2,"Kendoon Substation"],["saa195e80169",-2.80176,55.43298,132,1,"Hawick Substation"],["s9e982e1f6b9",-2.91293,54.03,400,4,null],["sc20e6828b87",-2.78689,54.06613,132,2,null],["s197a87cf3be",-2.98836,53.879,400,5,"Stanah Substation"],["s85f8867ff59",-1.53137,55.14117,400,0,"Blyth Substation"],["s1ec47b06127",-1.53272,55.19962,132,2,null],["sb84d88123c9",-1.71163,53.01398,33,0,"Ashbourne Substation"],["sbfe956fb4db",-1.90038,52.4891,132,3,"Hockley Substation"],["s055fcb4d0c2",-1.18326,54.63566,275,0,"Hartlepool"],["s568e7c7c41c",-3.80762,55.22917,33,0,"Penpont Substation"],["s7de677dfe01",-0.14623,53.60137,400,2,null],["se04da2762ec",-0.98089,51.42068,33,0,null],["s5eb59259445",-1.1299,53.71353,400,0,"Eggborough Substation"],["sffe911cb163",-0.0825,51.52107,132,1,"Finsbury Market Substation"],["sc6c9ead306d",-1.84081,53.85296,132,1,"Bingley Grid"],["sb78e58c27f4",-1.49595,53.77534,275,2,null],["sca493015a5a",-2.16334,53.53015,132,2,null],["sae47c746590",-0.78138,53.30075,400,0,"Cottam Substation"],["safa37a0bcbd",-0.80973,53.35732,400,2,null],["sa8ebfdd39b4",-0.79892,53.36256,400,0,null],["sf9c62b80785",-3.0665,55.86338,33,0,"Lady Victoria Primary"],["sc6e1a7d99d6",-1.00393,53.45924,66,0,"Austerfield"],["sa37a6faf1e6",-2.6888,53.37016,132,2,"Fiddlers Ferry Substation"],["sa9ffb3ab9d7",-2.86071,53.49094,132,2,"Simonswood Substation"],["sb9f021f846c",-2.68897,53.37142,275,1,"Fiddlers Ferry Substation"],["sc5705d2b2bd",-1.54309,53.81392,33,0,"Buslingthorpe Green Primary"],["s9db2bd05590",-4.88565,55.72142,400,0,"Hunterston North Substation"],["s9270b43c465",-1.57363,52.87421,132,2,"Burnaston Substation"],["s2a4c8f76837",-1.25681,52.86221,275,1,null],["s0d49d45ee31",-1.25704,52.86238,400,0,null],["sf188d6c1828",-0.2621,52.08093,33,0,null],["sd3f187b576f",-0.92902,52.78134,132,0,"Asfordby Substation"],["sc1f5ce09c3b",-1.06138,52.70056,33,0,null],["s40f962dd0a0",-0.5892,52.04128,33,0,"Brogborough Substation"],["sf734098e0c1",-1.07856,52.65869,33,0,"Hamilton Substation"],["s93c93f07726",-4.2965,55.83004,132,1,"Haggs Road Substation"],["s1fc8cb90873",-0.79631,52.04952,132,2,"Bradwell Abbey Substation"],["s976029668ef",-1.02321,53.19488,33,0,"Ollerton Substation"],["s2ca6c473058",-4.68766,55.74072,33,0,null],["s1d56cd29060",-1.04084,53.19836,33,0,"Thoresby Substation"],["s24d6185cf38",-0.36505,52.89491,33,0,"Billingborough Substation"],["sf42e2f9cd73",-1.22147,53.57105,66,0,"Hampole"],["sa18bf506025",-0.27627,52.84878,33,0,"Dowsby Fen Substation"],["sa0872b1788d",-0.39569,51.90136,33,0,null],["s572c17073d5",-0.4733,51.7424,33,0,null],["s8388da3ce26",-2.02605,52.49835,132,1,"Oldbury Substation"],["sbda92ecb0d3",-1.71457,52.53457,275,0,null],["s725e475f860",-1.71621,52.53148,275,2,null],["se51aa9f1a17",-3.03573,52.86809,132,5,"Oswestry Substation"],["sf381590a45d",-1.58983,53.47947,66,0,"Wheatacre Road Substation"],["s9d59935d34e",-2.82626,56.4916,33,0,"Ashludie"],["s18012284eb5",-2.0538,52.51986,132,1,"Tividale Substation 132kV"],["s2f9bad55171",-4.17408,55.11221,132,2,"Earlstoun"],["s3189b97fc89",-2.86692,53.2304,132,2,"Wervin"],["sd6dcfcf4b9f",-2.8752,53.21973,33,0,"Upton Heath"],["s469f24247fb",-3.60085,56.00958,33,0,"Gauze Road S/S"],["seffea730b23",-0.32131,51.06318,132,1,"Horsham Grid Substation"],["sc32b18c3576",-3.63375,53.26778,33,0,null],["s7440458ba2d",-1.10241,52.96513,132,3,"Nottingham East Substation"],["s61952d3d3bf",-1.20192,52.98801,33,0,"Cinderhill Substation"],["s182d63f6b5e",-2.59496,51.52866,33,0,"Cribbs Causeway Substation"],["s6a8c313ec29",-7.02191,55.0414,33,0,"Ballykelly 33kV Substation"],["s00ecff47bf9",-2.91068,53.25719,33,0,"Strawberry Roundabout"],["s43ae2a489ec",-3.21725,53.09766,33,0,null],["s96539d13be3",-3.51142,54.64941,33,2,"Stainburn Substation"],["scb74dd78a01",-3.46856,53.249,400,0,"Burbo Bank Offshore Wind Farm Substation"],["s4a3e86005c8",0.56161,52.5511,33,0,null],["sc4f25549014",-3.47214,54.40453,33,0,null],["s06e37f062ed",-2.18609,52.99978,33,0,"Yeaman Street District Substation"],["s9c6702f9425",-0.60233,50.97354,33,0,null],["s3b5f5784943",-0.19332,51.46109,132,3,"Wandsworth Grid Substation"],["sd61ae4b2c65",-0.57695,53.04592,33,0,null],["s9ac56fecf60",-2.02424,55.74977,33,0,null],["sa7e5d31475c",-2.24812,52.91149,33,0,"Cotes Heath Substation"],["s51c42b0a559",-2.11429,50.6866,33,0,"Wareham Town"],["se5c974844f3",-1.61646,53.52149,66,0,"Penistone Substation"],["s503be2618b0",-1.5663,53.5707,66,0,null],["sbb3dfa7697d",-1.73423,53.54026,33,0,"Hazelhead Substation"],["s54e0e401ccd",-1.75789,53.56309,33,0,"Scholes Substation"],["sfaed8df34df",-1.4401,53.55009,33,0,"Stairfoot Substation"],["se87ab33c767",-1.4388,53.57089,33,0,"Burton Road Substation"],["sa7e5877e175",-1.44054,53.58197,33,0,"Fish Dam Lane Substation"],["s0c3570d9f64",-1.01294,53.15141,33,0,"Bilsthorpe Substation"],["sec4acad30d3",-1.36626,53.3032,33,0,"Eckington Substation"],["s24e53270524",-2.27456,53.09757,33,0,null],["sa6ddddc0500",-2.65438,51.5291,33,0,"British Gas Hallen Substation"],["scf15323bc4e",-3.6038,55.46517,275,0,"Clyde Wind Farm North Substation"],["sdae2ed42bf3",-0.82838,51.78222,33,0,"Bishopstone Switching Station"],["s24b36faeff4",-1.16516,53.31327,33,0,"Home Carr Substation"],["sde85f3a7cf6",-2.44791,53.75895,132,2,"Blackburn Substation"],["s0836b0b9ae7",-3.91387,50.79604,132,1,"North Tawton Substation"],["sd113ab23450",-3.19446,51.50627,33,0,"Heath Hospital Primary Substation"],["s71d9fbc96cb",-5.76793,54.72713,275,0,"Kilroot 275kV Substation"],["s0dcee35d851",0.37696,52.7266,132,0,"Palm Paper 132kV Intake"],["sfcac03ccaf5",-3.43415,50.72913,33,0,"Clyst Honiton Substation"],["scabc258019a",-3.35157,50.73898,33,0,"Marsh Green Substation"],["s03334d2facc",-1.10982,53.13756,33,0,null],["s1c2deb11410",0.6524,51.03427,33,0,"Rolvenden Layne Switching Station"],["sb1c3949e8ef",-4.1228,53.27784,33,0,"Beaumaris"],["s2de53be7540",-6.73344,58.20272,33,0,"Calanais Substation"],["s578b212a219",-1.1496,51.08889,33,0,null],["s12b2b21be58",-2.31313,53.6952,33,0,null],["s3debacc8c0a",-2.30083,53.69418,132,1,null],["sea85399e637",-6.32469,54.18299,33,0,"Newry Substation"],["saac36f22763",-1.19861,53.04112,33,0,"Hucknall Substation"],["sd75af8545db",-4.32841,53.18747,230,0,"Llangaffo"],["s263f372057d",-1.48573,52.94392,33,0,"Darley Abbey Substation"],["sa4bed6215d5",-1.13108,52.97017,33,0,"Mapperley Substation"],["s850cc6b956d",-3.50976,55.89843,33,0,null],["sfaacf4cd768",-0.10704,51.37494,33,0,"Croydon Central Substation"],["s773b55ab776",-3.74724,51.55793,132,3,"BOC Margam Substation"],["sd6cb8d179af",-3.74577,51.56088,33,0,"BOC Biomass"],["sd593176d79b",-6.19724,57.4218,33,0,null],["sc41cc715bdc",-4.00548,55.39024,33,0,null],["s4916fc618cc",-2.94129,53.18132,132,0,null],["s8cf2852eba9",-3.17213,54.1583,33,3,null],["s9616a6d5452",-6.53027,55.2013,33,0,"Bushmills 33 kV Substation"],["s275afd51c2a",-3.86864,56.02663,33,1,"Todhill Wind Farm"],["sf391e5e740b",1.45044,52.65491,33,0,"Hemblington Primary Substation"],["sa7cdd6d3bb2",1.38348,52.81706,33,0,"North Walsham Primary Substation"],["sa4d05bd9e76",-2.43386,52.72641,33,0,"Donnington Primary Substation"],["s879a2c84a6c",-2.83505,53.26848,132,2,"Stanlow South Substation"],["s60fb7ead4c3",-3.30042,53.1224,33,0,"Ruthin Substation"],["s95cb9248e79",-0.74417,52.05112,33,0,"Campbell Park"],["s6c600c94bce",0.22238,51.9418,132,0,"BR Ugley Substation"],["s1924ee53e8e",-2.61706,54.20367,33,0,"Kirkby Lonsdale Substation"],["s3a67616116e",-3.82471,53.31378,33,0,null],["s35a39e145ee",-7.45224,54.73006,33,0,"Ardstraw 33kV Substation"],["s68590290aaa",-3.78247,53.13323,33,0,null],["s3ad536dbdc4",0.10529,52.21303,33,0,"Storeys Way Primary Substation"],["s31a74e73618",-1.7794,52.48399,132,3,"Kitts Green Substation"],["sd6716890269",0.10707,52.24364,33,2,"Histon Primary Substation"],["sd1616caeca2",0.14715,52.2298,33,0,"Milton Road Primary"],["s26c34bb77a6",0.11773,52.21039,33,0,"Thompsons Lane Primary Substation"],["s42f73390390",0.14786,52.21298,33,0,"Barnwell Primary"],["sd06088d5db2",0.08779,52.21297,33,0,"Madingley Road Primary Substation"],["sce80c8089f4",-2.756,53.33139,132,1,null],["sfac349e4452",-2.73841,53.42115,275,2,"Rainhill Substation"],["s1e6556abe99",-2.62973,53.53644,132,0,null],["s1d04a8162c9",-2.9775,53.78152,132,4,null],["s8e4654fc36d",-0.02598,52.00333,33,1,null],["sd2648353e6e",-1.73307,54.97593,132,3,null],["sac6e0473319",-1.73253,54.97509,132,7,null],["s5b87e0e9437",-1.73204,54.97586,132,3,null],["s0570c084589",-5.25346,51.88198,33,0,"St Davids Primary Substation"],["s1a73a6525b5",-1.4705,53.47828,66,0,"Tankersley 66KV"],["s424ad0691b8",0.03022,52.11357,33,0,"Shepreth Primary"],["s302fd4a0e8e",-1.97754,51.29171,33,0,null],["s254c574f3ed",-0.02158,52.05204,33,0,null],["s1ab0be7226b",-0.00292,52.0753,132,0,"Light Source Grid Site"],["s868644a9a5b",-0.00373,52.0752,33,0,"Melbourn Primary Substation"],["sf36c3d46003",-0.00301,52.07511,132,0,"Melbourn Solar"],["sb0676953bd0",-1.37584,53.10198,33,0,"Meadow Lane Substation"],["s1772c2972a9",-2.42737,51.46312,33,0,"Naishcombe Hill"],["s1cff3f795c0",1.73974,52.47894,132,0,"Lowestoft Grid Substation"],["s83f3f9b8a14",-0.81366,53.16848,33,0,"Carlton on Trent Substation"],["sc765dfe11f4",-1.80203,52.01957,66,0,"Northwick Generation Substation"],["s267dc1363b1",-0.17784,51.89781,33,0,"East Stevenage Primary"],["sa22df53e717",-3.67979,50.77597,33,0,"Folly Bridge Substation"],["s70fa89b7ce4",-0.04262,51.55901,400,1,"Hackney Substation"],["s16421792e56",-1.41371,52.96855,33,0,null],["s1c496355b04",-3.25251,51.52722,33,0,"Ironbridge Primary Substation"],["s91ab7f9da2e",-4.02684,50.32708,33,0,"Newton Ferrers Substation"],["sd4523f0c383",-3.7045,56.71094,33,0,null],["s08bf82e5361",-1.76909,51.18164,33,0,"Ratfyn"],["se9dcefc8bc9",-1.77464,51.18353,132,2,"Amesbury Bulk Supply Point"],["s3821747d027",-6.68739,55.10941,110,0,"Coleraine 110kV Substation"],["s9692e9d13b7",-3.03271,53.23044,600,0,"Flintshire Bridge Converter Station"],["s3083fc8df47",-3.00209,51.71391,132,0,"Pontypool North Primary Substation"],["s718c41eea71",-2.90208,53.19043,132,1,"Crane Bank"],["sfcef1e2dd5b",-0.13328,52.80579,400,0,"Spalding North Substation"],["s718fdce799b",-4.23617,53.28262,33,0,"Pentraeth"],["s64c1183f734",-0.79474,52.01885,33,0,"Shenley Wood Substation"],["s8d945f91c84",-0.2547,53.74882,132,1,"Hull East Substation"],["sde774db3ad6",-0.23814,53.74279,132,2,"Saltend North Substation"],["s5580692a7ad",-0.34473,53.76256,132,3,"Sculcoates A"],["s7605fbfcc37",-4.06081,52.94146,33,0,null],["s3720956127f",-4.21683,55.37786,33,0,"New Cumnock Substation"],["s9f6efaf6c12",-1.63984,53.12614,132,1,"Winster Substation"],["s6113075cd21",-1.60998,53.08881,33,0,"Hopton Substation"],["sa424fcd0f6a",-1.6162,53.15771,33,0,"Millclose Substation"],["s2b3aee47f21",1.17362,52.44546,33,0,"Tivetshall Primary Substation"],["s0c9007e7f6e",-0.35319,53.74596,33,0,"Clarendon Street Substation"],["s374ad52eb87",-0.26608,53.77394,33,0,"Holderness Substation"],["s4ad07555ccb",-0.29442,53.77853,33,0,"Saltshouse Road Substation"],["s01cd88043f5",-0.42583,53.77656,33,0,"Southwood Road Substation"],["s52a1c891ccc",-1.34778,60.40165,33,0,null],["s61adcb164cc",-0.10757,53.58198,33,0,null],["sa3d9fa2a239",-1.25589,60.34962,33,0,null],["s6bd541a1526",-2.51289,51.52434,33,4,"Winterbourne Substation"],["sb1d7f39bc73",1.14545,51.79088,33,0,"Old rd Primary 33/11kV"],["s9d0f9e91a1e",-1.23591,51.74952,33,0,null],["s319b08a9760",-4.84996,55.08404,132,0,"Arecleoch Wind Farm Substation"],["s7e46518bfc5",-2.99522,50.77997,33,0,"Axminster Substation"],["s5eb608b695e",-2.16288,51.98595,66,0,"Tewkesbury"],["s9b17275fbf1",-1.25647,60.1392,33,0,null],["s52eb3c42711",-3.92939,51.03663,33,0,null],["s70ffb52e621",-1.2028,60.44888,33,0,null],["s054ef50f8dc",0.31601,53.2253,33,0,"Chapel St. Leonards Substation"],["sf6f317ec577",-1.15386,50.66208,33,0,null],["s5742dbf0e7c",-3.58654,52.92018,33,0,"Bala Substation"],["s0c8dabc04b2",-3.87976,55.64195,33,0,null],["s07d33595b79",-1.58856,54.52976,33,2,"Darlington West"],["s26253f39e7e",0.29272,53.16075,132,2,"Middlemarsh Substation"],["s8afec37009a",-1.51814,54.51935,33,0,null],["s46c6fb5ca25",-1.54046,54.52618,132,1,"Darlington Central"],["s106bedd5974",-1.66637,53.82423,33,0,"Rodley Lane"],["s1665f9e1136",-0.23499,53.27006,132,1,"Hatton Gas Compressor Substation"],["sd7d49abaf64",0.0296,52.81675,33,0,"Holbeach Substation"],["s344865c590f",0.11376,52.77837,33,0,"Long Sutton Substation"],["sde288208713",-4.4259,57.56638,33,0,null],["s7b32f2066b8",-0.18889,52.91543,33,0,null],["s73eadb29239",-3.22715,55.90716,33,0,"Oxgangs Road Primary"],["sa46e1c7636e",-1.00371,60.67587,33,0,null],["s53c0f3e5608",-0.39705,51.59718,33,0,"Pinner Green Substation"],["s4c2415286a1",-0.70676,52.0477,33,0,"Fox Milne"],["s760499a3d7b",-0.76169,52.04482,33,0,"Portway Substation"],["sbba97480232",-0.77153,52.04068,33,0,"Elder Gate Substation"],["se21fca7c444",-0.76466,52.03325,33,0,"Childs Way Substation"],["s10eb1edc29d",0.1202,53.04092,33,0,null],["scfe23d4fc99",-1.11987,52.74137,33,0,"British Gypsum Substation"],["s317b6a1b0d6",-2.02618,52.51464,33,0,null],["s5bdae53317a",-1.54452,53.80552,33,0,"Carlton Hill Substation"],["s8628d968de7",-1.667,55.01479,66,0,null],["s8e0b0501575",-1.6329,55.06307,66,0,"Seaton Burn Substation"],["s15aa0ed461a",-3.45217,53.25239,33,0,null],["s76fb2572590",-3.26829,56.14821,33,0,null],["s92e887d0883",-1.59973,53.00049,33,0,"Ravensdale Park Substation"],["s55e8899d502",0.33147,53.18009,33,0,"Ingoldmells Substation"],["s8fbe2a1da8e",-2.41696,55.96162,132,1,null],["s41856ac9c2c",-1.4168,53.53343,66,0,"Aldham"],["s849b200ea53",-1.75627,51.57582,33,0,null],["s63a81e0f473",-1.50987,53.66611,132,1,"Wakefield Monckton Road"],["scfa7e0aba90",-3.17008,51.59516,33,0,"Trethomas Primary Substation"],["s1904aedd823",-1.85069,52.95001,33,0,"Rocester Substation"],["s59fd5e51173",-0.6465,51.84928,33,0,null],["s19fe10c6dfe",-2.51405,50.96168,33,0,"Sherborne Substation"],["s75854c802e5",0.59447,52.44724,33,0,null],["s562d8180ada",-0.2171,52.58724,132,1,"Peterborough East Substation"],["s86e2966750e",-0.17293,52.55678,33,0,"Funthams Lane Substation"],["s91028d400ef",-0.26682,52.5937,132,2,"Peterborough North Substation"],["s88817c0a43d",-0.1347,52.5507,33,0,"Whittlesey Substation"],["s0ef69960cfe",-5.84539,54.71281,33,0,"Carrickfergus West 33 kV Substation"],["sb2d643ea446",-3.0262,51.01561,33,0,"Creech St. Michael Substation"],["s61f35d6c8f4",-2.74143,51.05797,33,0,null],["s7a667f79d84",-3.3074,54.65241,33,0,"Embleton ESS"],["s6e9810b6975",-2.50746,51.07766,33,0,null],["s08828515e55",-3.14222,53.25246,33,0,"Flint"],["s1e7cdac4295",-1.83568,53.92696,33,0,null],["s4894e0a24d2",-6.20886,54.71563,33,0,"Antrim 33kV Substation"],["s57e95812929",-1.0412,53.53777,66,0,"West Moor Park"],["s3074f86212d",-5.29046,50.21346,33,0,null],["sd67a17837cf",-1.36278,53.02126,132,1,"Heanor Substation"],["s76f900f67ec",0.06756,51.85826,33,0,null],["s576ecd0e507",-1.6675,53.80386,33,0,"Varley Street"],["s890e906aa87",-2.84474,53.20513,132,1,"Guilden Sutton"],["sbdedcf1c829",-1.55999,53.80615,33,0,"Clarendon Road"],["s8677f14712d",-3.1221,55.95686,33,0,"Portobello Primary"],["seacaf29a9fd",-4.07035,53.17508,33,0,"Coed-y-parc Substation"],["scfad32cbe7e",-1.33845,52.58262,33,0,"Barwell Substation"],["sfdd13c85363",-7.24724,55.04241,275,0,"Coolkeeragh 275kV Substation"],["s40e61755378",0.10897,51.51764,33,2,"Barking West Substation"],["s7bf76ca37bf",-2.67532,52.97331,33,0,"Yockingsgate Substation"],["s0f4d3b5adf2",-2.60084,50.99233,33,0,null],["sdb2ea337f99",-1.56488,53.10217,33,0,"Cromford Substation"],["sd5a9a4bc108",-1.43239,53.11796,33,0,"Wessington Substation"],["sd1ea9a649b6",-2.29918,53.51241,132,2,null],["s534933c8007",-0.42253,51.05013,33,0,null],["s16b9001c5d9",-0.50406,51.1511,33,0,"Cranleigh Substation"],["s6fa157e1d22",-2.69717,50.95469,33,0,null],["s056cf49546c",-1.83562,51.08003,33,0,null],["s8d5a6dd5f28",-2.77339,50.96787,33,0,null],["sd2e3a39c010",-1.03083,52.92362,33,0,"Cotgrave Substation"],["s9cfb48ee3aa",-3.87227,52.74232,33,0,null],["s385bc6dd658",-3.05313,53.12044,33,0,null],["s27554a78fb3",-2.64972,51.20675,33,0,null],["s227217cf1de",-2.47016,56.70997,33,0,"Montrose Mill Rd Primary Substation"],["scf337fffe8b",-1.32717,53.35697,66,0,"Beighton Substation"],["se3dfcc6b3a8",-0.04017,51.58979,66,0,"Blackhorse Lane Substation"],["s9ad475bb63e",-2.86539,56.65442,132,1,"Lunanhead"],["s3ad2662a2d5",0.14281,52.67609,33,0,null],["sc2c8228541d",-1.01517,51.57563,33,0,null],["s7c7cda6bb7c",0.94539,52.68466,33,0,"East Dereham Primary Substaton"],["s86cdc87fdce",-2.07912,50.86506,33,0,null],["s1b56d760968",-2.05583,50.93011,33,0,null],["sb54026b2a55",-1.95831,50.91374,33,0,null],["s15ced59f7f8",-1.89149,50.89128,33,0,null],["sc0e75ff106a",-2.9687,53.03544,132,1,"Wrexham Substation"],["secd1ed3462b",-2.71995,56.58628,33,0,"Redford"],["s15736dc658a",-3.14609,52.58906,33,0,null],["sc336a7d72ee",-2.94657,53.10561,33,0,"Rossett Substation"],["s00220d3ac91",-1.71326,53.8732,33,0,"Hallam Street"],["sb683fc2ba50",-2.28291,56.84748,33,0,null],["s32c19ad4aa5",-3.88941,56.03949,400,1,"Denny North Substation"],["s704a6a32789",-2.47822,56.82984,33,0,null],["saa30cedbefd",-2.52636,57.15167,33,0,null],["s0cdc723cf66",-0.59572,52.66205,33,0,"Empingham Substation"],["sb5e1d4720e3",-1.66968,51.19277,33,0,"Park House Primary Substation"],["s2c0a1335f3c",-1.72932,50.98387,33,0,null],["see8f0c568c1",-0.11355,51.48553,33,0,"Montford Place Substation"],["sf06d45765a4",-5.53792,56.57082,33,0,null],["s7c15d7b69ab",-3.40521,54.37196,33,0,null],["sc3d1238273d",-6.18856,55.63154,33,0,null],["s5ee1c80dc97",-2.41071,51.04873,33,0,null],["sab431f62cfa",-2.3246,51.07138,33,0,null],["sc446a9c4f31",-3.84012,53.22817,33,0,null],["s216ab4cbd78",-0.16173,51.16008,33,0,null],["sfea134fe367",-1.08357,50.78411,33,0,"Brandon Road Substation"],["s2f0ab5b6015",-2.91459,56.41225,33,0,"Forgan"],["sff2a634078b",-1.51917,51.08415,33,0,null],["s11bb7d3fd93",-2.46023,53.72032,132,0,null],["s0fe85d12300",-1.61037,53.83977,33,0,"Iveson House"],["sa3f179ebf21",-1.59331,53.83861,33,0,"West Park"],["s2ba9196fd45",-3.38893,56.41391,33,0,null],["s05ee41c4114",-1.48608,53.6672,33,0,"Woodcock Street"],["s0c112fa6981",-3.4591,53.3304,220,0,null],["scc5b599d661",-1.38861,51.78936,33,0,"Eynsham"],["s5a1e9c17f30",-1.34329,51.23361,33,0,null],["s2805239f223",-1.39899,51.18208,33,0,null],["s605d769fac3",-1.55799,51.15954,33,0,null],["s076e6b33fed",-0.02567,51.44143,750,0,"Catford DC Traction Substation"],["sc72363021f6",-3.19842,52.03458,66,0,"Glasbury Substation"],["s2f25cfc2e99",-1.40509,51.59199,33,0,null],["sdb05aa3be3f",-1.16106,51.55799,33,0,null],["s0b6d7fa3b0c",-1.21541,51.60177,33,0,null],["se2da070b280",-1.41928,54.99634,33,0,"Westhoe Primary"],["sac3a52daae7",-1.36773,51.49579,33,0,null],["s34b6ea1b8c4",-3.20937,56.19679,33,0,null],["s4165d0e6204",-6.03479,54.51101,33,0,"Lisburn 33 kV Substation"],["sa02d9c65c7b",-7.20185,55.03623,33,0,"Donnybrewer 33kV Substation"],["s1b37feb9bb9",-7.20848,55.03692,33,0,"Campsie Central 33kV Substation"],["s744765efcb2",-1.15735,51.65468,33,0,null],["s84ba3c18365",-1.48712,54.95897,66,0,"HEDWORTH"],["s5d7ddbcc4b0",-1.11958,51.85799,33,0,"Arncott"],["s0bf1ce3fdbe",-1.52507,54.97193,66,0,"Hebburn West"],["scd01f36186e",-1.59075,51.73228,33,0,null],["s7a4573891e1",-4.66737,56.76528,33,0,"Loch Ossian 33kV substation"],["s8dd8ae91c6c",-1.59245,54.93027,66,0,"Harlow Green"],["sb8a6f046043",-1.5016,52.40295,33,0,"London Road Substation"],["s9a08a762c14",-6.68515,55.17808,33,0,"Portstewart 33 kV Substation"],["s13f1ee31a4e",-5.76477,54.72841,33,0,"Kilroot 33 kV Substation"],["s3268f1b4792",-1.37078,51.91549,33,0,"Kiddington"],["se83f22c9880",-1.32084,51.96934,33,0,null],["s7b8156d8276",-5.99531,54.97958,33,0,"Carnlough 33kV Substation"],["s9588b7cd74e",-5.82932,54.84614,33,0,"Larne 33kV Substation"],["s69fef609512",1.10627,52.56772,33,0,"Wymondham Primary Substation"],["se93c7148d35",1.02386,52.51268,33,0,"Attleborough Primary Substation"],["s22b40447148",-6.31112,54.19079,33,0,"Drumcashellone 33kV Substation"],["s835a2c4415d",-1.58121,54.94386,66,0,"Carr Hill"],["s5104060f7ba",-2.07069,52.59885,132,1,"Wednesfield Substation"],["s724b3653fad",-6.56555,54.19076,33,0,"Newtownhamilton 33kV Substation"],["se95e29c30f9",-2.70656,52.02919,66,0,"Hereford South Substation"],["sd9c1ccade48",-2.71459,52.07439,66,0,"Hereford North Substation"],["s3447668b8c3",-1.25564,51.25478,33,0,null],["sa2013dd24cd",-0.0797,51.52239,66,0,"Hearn Street Substation"],["s4b6d7fa96df",-0.06626,51.5096,132,0,"Wellclose Square Substation"],["scbc967dd446",-0.09327,51.5206,132,1,"Beech Street Substation"],["sb643222fbc5",-0.77018,51.22107,750,0,"Farnham DC Traction Substation"],["s36d7561a8fd",-1.61811,54.92705,66,0,"Team Valley"],["s503aae90ff8",-6.24407,55.02632,33,0,"Gruig 33 kV Substation"],["s12350407070",-7.61884,54.15688,33,0,"Tonymore 33kV Substation"],["s90e714bf4c9",-7.4029,54.6829,33,0,"Ballyrenan 33kV Substation"],["s284693f42a1",-7.02249,54.55349,33,0,"Crockagarran 33 kV Substation"],["s563d1496dfc",-7.61267,54.63437,33,0,"________ 33kV Substation"],["s105848eab28",-1.49887,53.6861,33,0,"York Street"],["sb7594eef041",-0.50468,53.54181,132,2,"Scawby Brook"],["s301dcc45939",-6.01038,54.76165,33,0,"Ballyclare 33kV Substation"],["s9d85be9684b",-2.52586,53.43253,132,0,"Risley Substation"],["s387cddab28f",1.25541,52.56405,33,0,"Mulbarton Primary Substation"],["sa8fb2425fad",1.21157,52.52104,33,0,"Hapton Primary Substation"],["sca068fa9834",-2.74002,53.46784,132,0,"Windle Substation"],["s3e65a1d5533",-2.39024,50.97205,33,0,null],["sec64f9cf12b",-2.80205,53.42237,132,0,"Prescot Substation"],["se59889b1ca7",-0.63518,54.48013,66,0,null],["s8b803034b30",-2.59497,53.47472,132,1,"Golborne Substation"],["s1ac4d460274",-2.45788,50.97619,33,0,null],["sc9ab9b222b4",-4.4825,50.34641,33,0,null],["s40e1e091fab",-0.29736,51.19912,750,0,"Blackbrook DC Traction Substation"],["s647b2659f33",-0.05906,51.48377,400,0,"New Cross Substation"],["s1ef83d93cf0",-0.10988,51.52289,132,3,"Back Hill Substation"],["s161745e39e0",-0.09585,51.53041,400,2,"City Road Substation"],["s984f470d77c",-0.10309,51.51484,132,1,"Limeburner Lane Substation"],["s83eef0720b3",-0.10045,51.51434,33,1,"Paternoster Substation"],["s7034a22b9eb",-2.8405,53.39247,132,1,"Gateacre Substation"],["s82c7a6aa5df",-0.09837,51.50721,132,2,"Bankside Substation"],["s8e35026ff83",-0.07399,51.51393,132,0,"Mansell Street BSP"],["s9936c353b33",-2.56071,51.02732,33,0,null],["se2d81722c0d",-0.17693,51.47057,66,0,"Lombard Road Substation"],["s866cffec279",-0.19281,51.45354,66,0,"Wandsworth Central Substation"],["s6fd340dbc69",-0.09682,51.4672,132,2,"Bengeworth Road Substation"],["s34805dd5676",-0.07636,51.4682,66,0,"Chadwick Road Substation"],["s3453df30052",-0.07454,51.45767,33,0,"North Cross Road Substation"],["s371102614b0",-0.11987,51.51838,33,1,"Fisher Street Substation"],["s80731555ac8",-0.11865,51.515,33,1,"Kingsway Substation"],["se2345c4cb4f",-0.11449,51.50584,66,0,"South Bank Substation"],["see32a62730b",-0.06484,51.48485,66,0,"Verney Road Substation"],["s06fa0186465",-0.02271,51.48367,132,1,"Deptford West Substation"],["sb1dcbdb5230",-0.02002,51.48143,132,0,"Stowage"],["se614d67f05d",-0.16657,51.51996,132,1,"Chapel Street Substation"],["sded18725b17",-0.1381,51.51326,66,0,"Carnaby Street Substation"],["s5ba63abadd1",-0.13011,51.51037,132,1,"Leicester Square Substation"],["s484c8ff0b71",-0.19469,51.48692,132,0,"Old Brompton Road Substation"],["sa620ce2e196",-0.14447,51.51158,66,2,"Bloomfield Place Substation"],["s348462fbef5",-0.13691,51.53932,132,1,"St Pancras Substation"],["s7f343d57f6f",-0.12625,51.5658,66,0,"Hatchard Road Substation"],["se15a487dc0e",-0.1157,51.55002,132,1,"Islington Substation"],["s05d70c785ba",-0.08303,51.56195,66,0,"Edward's Lane Substation"],["s1d946df0882",-0.02272,51.58178,66,0,"Walthamstow Tee Point"],["s0fbc6c069f7",-0.02379,51.57031,66,0,"Waterloo Road Substation"],["s3af62fb7d56",-0.18596,51.54881,66,0,"Lithos Road Substation"],["s105d3d8aef1",-0.19047,51.51264,66,0,"Moscow Road Substation"],["s67703202a04",0.00023,51.51008,132,0,"Brunswick Wharf Substation"],["s6e080a91697",0.00394,51.52115,132,1,"Stephenson Street Substation"],["s103d51a5f14",-0.05688,51.51156,750,0,"Shadwell DC Traction Substation"],["s78770377c14",0.06408,51.52087,132,2,"East Ham Tee Point"],["s5cd1ee02309",-0.01787,51.51961,66,0,"Glaucus Street Substation"],["see2d79ac2dc",0.05752,51.53257,66,0,"Nelson Street Substation"],["sa074b614113",0.07981,51.53577,33,0,"Axe Street Substation"],["sa1bfbd1ed29",0.11235,51.49759,33,0,"Sewell Road Substation"],["s7469320c4d3",-0.114,51.58487,132,1,"Hornsey Electricity Substation"],["s11bb55d7b07",-0.22173,51.49059,132,1,"Fulham Palace Road Substation"],["sb62add2808f",-0.25659,51.54603,132,1,"Gibbons Road Substation"],["s6b54ca50efb",-0.25217,51.55502,132,2,"Neasden Feeder Station"],["sa063ced6ac0",-0.11314,51.55262,132,0,"Holloway Substation"],["sbf51a68473a",-0.0481,51.48599,132,1,null],["s9ffce0fe0fa",-3.76884,50.48045,33,0,"Buckfastleigh Substation"],["sc8a87b3eb90",-1.62534,53.88253,33,0,"Bramhope"],["s7b98fde9d28",-1.37242,53.37746,33,0,"Orgreave"],["sdea381c4544",-0.34131,51.01861,33,0,"Southwater Primary Substation"],["sb39a653bcf0",-1.35076,51.85412,33,0,"Green Lane Electricity Substation"],["s2b72c4f0652",-0.25536,51.59234,132,1,"Colindale Grid Substation"],["sfaf5a99397a",-3.47238,53.25421,33,0,null],["s96e38db5823",-1.79266,51.70378,33,0,null],["s12cf39c21bc",-1.62843,51.90108,33,0,null],["s69ffda1c960",-1.47815,51.86254,33,0,"Charlbury"],["s9e9d6b902c2",-1.85579,54.96657,66,0,"Prudhoe West"],["s0397fce4e87",1.23083,52.68665,33,0,"Horsford Primary Substation"],["se4728949d87",-6.35961,54.4638,33,0,"Ballynamony 33kV Substation"],["sb1aec1c57ff",-0.05024,51.60399,132,1,null],["s72fe5da1525",-1.68142,51.70248,33,0,null],["s1d8dafc497f",-1.47024,55.04274,33,0,"Monkseaton Primary"],["s765ab513303",-2.2207,53.80641,132,0,null],["s59eebb8b38c",-4.46989,53.32806,33,0,"Llanddeusant"],["s1586d415d13",-1.5001,53.80147,33,0,"York Road Primary"],["s3299c90dc26",-2.63694,52.55201,33,0,"Easthope Substation"],["s6f658350d2a",-5.94042,54.62646,33,0,"Fortwilliam 33 kV Substation"],["s84271724c7c",-2.98313,59.15813,33,0,null],["sac0c03ad538",-4.97906,51.70185,33,0,"Wear Point Wind Farm Substation"],["s4177b812374",-5.07521,51.71917,132,1,"South Hook Substation"],["s6d4b0919cca",-5.6299,50.08277,33,0,"St Buryan Substation"],["s5564201be3b",-2.14395,51.3749,33,0,null],["sd3a1f591f91",-2.44823,51.2888,33,0,"Foxhills Substation"],["se4164ca406f",-6.53881,55.06364,33,0,"Ballymoney West 33 kV Substation"],["sb43ad203399",-0.58659,51.32286,132,0,null],["s83e9e1fa5ac",-0.79698,51.28074,33,0,null],["s664dc9313f1",-6.15688,54.53078,33,0,"Brookhill Central 33kV Substation"],["s3bfbba6b413",-6.0586,54.56178,33,0,"Mullaghglass 33kV Substation"],["sb3c6aff399d",-1.84272,52.44038,132,1,"Hall Green Substation"],["sdfae645804d",-1.66155,54.97245,66,2,"Benwell"],["sb21baa125eb",0.4829,51.58832,33,0,"Gardiners Lane"],["sff050daa29f",-3.84777,51.78022,33,0,"Mynydd y Gwrhyd Wind Farm Substation"],["s6b8aea8ee3e",-1.64522,53.80166,33,0,"Swinnow Moor"],["s0f36c8da4d7",-2.61253,51.45545,33,0,"Clifton Substation"],["sedd2192c44a",-1.48043,55.00137,33,0,"Flatworth Central Primary"],["s2d9a73d80be",-2.35856,51.37752,33,0,"Dorchester Street Substation"],["s658ddefc2aa",-1.36174,52.84103,33,0,"Castle Donington Substation"],["sbef4c8dd738",-2.96825,53.5602,33,3,"Haskayne Substation"],["sc5b8fb1971e",-1.5124,55.00294,33,0,"Willington Primary"],["sba2fd37b778",-3.27206,55.90867,33,0,"Colinton North Primary"],["seeaa5638193",-2.93701,53.60171,33,0,null],["sf9a2fe3b7ff",-1.58203,53.82798,33,0,"Moore Road Primary"],["s23c3232ed3e",-0.98504,52.79804,33,0,null],["sb1bef6dcd94",1.08719,52.69945,33,0,"Weston Longville Primary Substation"],["se7c03f7d62b",-5.43551,56.04038,33,1,null],["s15c68cf1a17",-4.40048,56.69313,132,1,"Rannoch Substation"],["s0fa78436e39",-1.56472,54.97974,66,0,"Fossway Substation"],["s06a1096e784",-1.01985,51.43664,33,0,null],["s57821587060",-1.6579,51.58961,33,0,null],["sc21caaafeea",-2.65837,53.791,33,0,"Preston East Substation"],["s06267abe92e",-2.7667,51.48469,33,0,"Gas Lane Substation"],["sf6ecf425a82",-5.08832,56.82817,33,0,"Inverlochy SubStation"],["sbdf80d9a336",-5.14197,56.84261,33,0,null],["sb4b58d2b8d3",-1.84952,57.58333,132,2,null],["s3a498342f7c",-0.81469,52.93056,33,0,null],["s3c058a773e2",-4.33685,52.90652,33,0,null],["sde02298e1fc",-5.05912,51.7408,132,3,"Robeston Substation"],["sab0e1758493",-0.10367,51.51261,750,1,"Ludgate Cellars DC Traction Substation"],["s8556eb7a4cd",-0.66708,50.79806,33,0,null],["sad08c6fe2f2",-5.87382,54.62267,33,0,"Moscow Road 33kV Substation"],["sdc3918eb54b",-1.19905,53.1553,132,2,"Mansfield Substation"],["s252308bc47c",-1.0505,52.95995,400,1,"Stoke Bardolph Substation"],["sd80cdd45c2d",-1.31228,54.63306,66,0,null],["s22c7ffd2a41",-1.2105,54.6529,66,0,"Hartlepool Steel Substation"],["sa600513244c",-3.60904,55.40465,275,0,"Clyde Wind Farm South Substation"],["s6c3820a0ca2",-4.5351,57.99591,33,0,null],["sefc961eeca8",-2.43866,50.71248,33,0,null],["sc888b0d6262",-3.00891,55.14952,33,0,null],["s96b7b124aa9",-2.81333,55.17397,33,0,null],["s4766bbddeae",-1.43213,50.92238,33,0,"Shirley PSS"],["sa4a7b5e0779",-1.79866,51.07318,33,0,"Longbarrow Junction Substation"],["s09a733357e2",-2.3676,51.39032,33,0,"Park Street Substation"],["s3505b2b5025",-4.82385,55.264,33,0,null],["s56b32baa0bf",-4.18956,55.14325,132,2,"Carsfad Substation"],["s068cc593b76",-4.0331,54.86024,33,0,null],["sba08b4643fb",-4.1864,54.88327,33,0,null],["sebce843c3c9",-3.80511,54.94514,33,0,null],["s9a2927b2249",-3.91156,54.93744,33,0,null],["sd907118767e",-4.11033,55.36693,33,0,null],["sb45c79e6352",-4.54742,55.67522,33,0,null],["s385da120bec",-4.48958,55.36403,33,0,null],["s3e9d7551dde",-6.01735,54.5583,33,0,"Dunmurry West 33 kV Substation"],["sc6f0fe99016",-3.36059,55.11455,33,0,null],["s914a79765b2",-2.02894,54.04689,33,0,null],["s00c7941a0b0",-1.47494,55.01567,33,0,"Billy Mill Primary"],["s6ebf0e50dac",-1.43758,51.7183,33,0,null],["s1e6e62b0210",-1.85748,52.90802,132,1,"Uttoxeter Substation"],["s5b144eb8322",-6.31723,54.7528,33,0,"Randalstown Central 33/11 kV Substation"],["s940baf9fa42",-5.89846,54.60388,33,0,"Airport Road 33 kV Substation"],["sc3ca3aabdac",-5.8844,54.6116,33,0,"33kV Substation"],["s62e4c4fc567",-5.90531,54.60954,33,0,"Queens Road 33kV Substation"],["se89691ab14e",-5.93558,54.59851,33,0,"King Street 33 kV Substation"],["s9f1371336f8",-5.91057,54.63129,33,0,"Dargan Road 33 kV Substation"],["sc5cd242b2d0",-5.92121,54.62203,33,0,"Skegoneill Street 33 kV Substation"],["s959d2809d8b",-5.9687,54.62853,33,0,"Carrs Glen 33kV Substation"],["s7c5bc794684",-5.92638,54.60292,33,0,"Talbot Street 33kV Substation"],["sd7a6b74e1e9",-5.96626,54.57472,33,0,"Bog Meadows 33 kV Substation"],["s0228ecd6c5c",-2.01875,52.68246,132,1,"Cannock Substation"],["s6c74051b11c",-0.02665,51.8147,33,0,"Ware Primary"],["s373928654f6",-1.71884,54.38419,33,0,"Hipswell"],["sfbb3c52d50f",-3.4201,52.52336,33,0,null],["s5b3e1c50793",-3.53579,52.45542,33,0,null],["scc7b0e1e319",-3.4464,52.46517,33,0,null],["s1f71d1db699",-3.29761,52.51717,132,1,"Newtown Sub-station"],["s066d2bc1e6d",-3.33634,52.50494,33,0,null],["sd2f21830eb0",-3.77372,55.76875,132,0,"Black Law Wind Farm Substation"],["sf98a7a6b488",-0.68117,50.80779,33,0,null],["s73434247e9f",-2.30114,53.45231,132,0,null],["s16b6d516439",-6.05737,55.0709,33,0,"Cushendall 33 kV Substation"],["sa5e9250d038",-7.31587,54.37899,33,0,"Fivemiletown 33kV Substation"],["s8c3272f1ad0",-2.73945,53.36065,132,0,"Widnes Substation"],["s030834988cc",0.17003,51.88266,33,0,"Hanger Lea Substation"],["s932b615ab5b",1.72893,52.63621,33,0,null],["s7b2b7345fa5",-2.48442,51.29048,33,0,"Midsomer Norton Substation"],["saf748477cef",-2.50959,51.31037,33,0,"Paulton Substation"],["seba78d36239",-1.07523,53.97678,33,0,"Haxby Road"],["sccc297790ab",-0.33254,51.44955,750,0,"Twickenham DC Traction Substation"],["se058f63992c",-7.04055,54.4596,33,0,"Ballygawley South 33 kV Substation"],["s1e62c8da1e9",-6.5155,54.96225,33,0,"Kilrea Central 33 kV Substation"],["s0b8ad59896c",-2.7044,53.61413,33,0,"Wrightington Primary"],["s03dfd07d8e0",-1.10175,50.79327,132,1,"Portsmouth Grid Substation"],["sb86d22aac64",-2.60371,51.47822,33,0,"Cairns Road Substation"],["sb09a92f17bf",-0.76804,51.31168,33,0,"Hawley Substation"],["s470984505c7",-1.4313,53.23337,33,0,"Queen's Park Substation"],["s9271d7835fe",-5.1198,56.00998,33,0,null],["s00d90c917a9",-1.09901,52.64648,33,0,"Salutation Substation"],["sd82e8771413",1.29597,52.10046,33,0,null],["sdded17ded08",-1.93486,52.7538,132,1,"Rugeley Town Substation"],["s538aec2d563",0.27192,51.19089,750,0,"Tonbridge DC Traction Substation"],["sf9269c39765",-2.83687,51.13404,33,0,"Shapwick Substation"],["s27cd08897ed",-2.1551,55.71766,33,0,null],["s15bbe0c31f4",-0.86225,51.28654,33,2,null],["s010dad2a010",-4.15577,50.4135,33,0,"Merrivale Substation"],["s557d6aacc5c",-1.49109,52.40734,33,0,"Gulson Road Substation"],["s9dbf8afe1dd",-2.97587,54.62932,33,0,null],["sd8223cbaac0",0.28441,51.49169,400,0,"Chafford West 400kV Sealing End Compound"],["saa2a0d85ea3",0.28647,51.49196,400,0,"Chafford East 400kV Sealing End Compound"],["sc8b6c7ad91d",-3.94735,56.26193,275,0,"Braco West Substation"],["sc1adca3fbc5",-4.02868,56.70689,275,2,"Tummel Substation"],["s055ddf1cbf8",0.43475,50.84349,33,0,"Little Common Primary"],["s237e16a829a",-3.45172,58.47899,275,2,"Spittal Substation"],["s62635d02519",-3.51273,58.56424,275,0,"Thurso South Substation"],["sb4190c05c10",-3.42366,58.44694,132,3,"Mybster Substation"],["s9d249536b5b",-3.45382,50.8011,33,0,null],["s94bdef287ae",-1.44637,52.42517,33,2,"Walsgrave Substation"],["sdc7526d0a34",-2.34488,53.42682,33,0,null],["sa586fcd400a",-0.00393,51.50775,132,1,"Blackwall Way Substation"],["s6c3ed3ef726",-1.15449,52.66919,33,0,"Beaumont Leys Substation"],["s2906d92d1fc",-5.98558,54.67432,33,0,"Mallusk 33kV Substation"],["see8ce358c17",-4.22825,51.68812,33,4,"New Lodge Primary Substation"],["sf6bc58366c7",-5.77642,56.72369,33,0,"Salen 2 Primary Substation"],["sc050a6fd2ec",-1.8797,50.76498,132,2,null],["s97cad219ea7",-1.1739,52.74878,33,0,"Quorn Substation"],["sdff6d87fffa",-2.66066,50.9499,33,0,null],["scf8df5e6b10",-4.17156,50.40219,33,0,"Weston Mill Substation"],["s7267c6bb2db",-7.46479,54.78558,33,0,"Sion Mills 33kV Substation"],["s56efc16f8b8",-1.62417,53.80668,33,0,"Bramley"],["s327f9d9d5c3",-2.98553,53.40199,132,0,"Paradise Street Substation"],["se1cb1a7b69e",-1.34103,53.7138,33,0,"Carr Lane"],["s2313188e540",-2.6674,54.51391,132,0,"Shap Substation"],["se838dcba40e",-0.07485,51.09164,33,0,"West Hoathly Primary"],["sfb4f88e3aab",0.64204,51.80888,33,0,null],["s9f9afe077df",-0.57967,51.75312,33,0,"Berkhamsted Primary"],["sda20b5277f9",-1.60293,53.79647,33,0,"Whingate"],["s4114358f5f3",-2.87286,51.94226,66,0,"Pontrilas Primary Substation"],["s80f550d99b9",-4.13454,52.93416,33,0,null],["s3c25adec0c7",-0.81826,51.83322,33,0,"Buckingham Road Substation"],["s879aa136734",-0.93969,51.85187,33,0,"Waddesdon Substation"],["s8e8947a3287",-1.48242,53.06287,33,0,"Ambergate Substation"],["s0fbbe7ebfd3",-0.80437,51.80312,33,0,"North Drive Substation"],["s0346a894cbd",-0.80703,51.81517,33,0,"Exchange Street Substation"],["s13e88b50fb5",-0.72581,52.07559,33,0,"Newport Pagnell"],["sc906c2d53fe",-1.55608,53.78889,33,0,"Sweet Street Primary"],["s56ca9c0aff1",-1.41469,52.33009,33,0,"Princethorpe Substation"],["s1afc142b0a7",-2.11295,51.58636,33,0,null],["s29b7b2c19f8",-1.99112,50.85374,33,0,"Hinton Matell 33KV SS"],["s2bccfe652a0",-3.33211,54.77344,132,0,null],["s89e28a41d0f",-3.15615,54.83868,33,0,null],["s9d88e56f9b0",-2.82125,54.19639,33,0,"Arnside Substation"],["sa3d91bc54e2",-2.75893,54.22649,33,0,null],["s901014337d3",-2.74108,54.31985,132,2,null],["s426f91599d9",-2.53702,54.32004,33,0,"Sedbergh Substation"],["sef16c74254a",-4.3366,55.60483,33,0,"Greenholm Substation"],["sf365fcc3a22",-4.65198,52.08385,33,0,"Cardigan Primary Substation"],["sfbe94b5c8b0",-1.38415,53.19989,33,1,"Grassmoor Substation"],["s3d831f85189",-0.19477,51.56736,33,0,"Golders Green Primary Substation"],["s5aa9586a629",-0.31263,51.60963,132,0,"Stanmore Grid Substation"],["s7ff59a4d14b",-0.11358,51.61557,132,0,"Palmers Green Grid Substation"],["s10f029333da",-0.18421,51.60063,132,0,"Finchley Grid Substation"],["s5e7141bdc10",-3.75658,55.14333,33,0,null],["s31127edba5e",-3.6076,55.6063,33,0,null],["saf902619e7d",-2.25746,54.00863,33,0,"Long Preston Substation"],["s51fa1f5a3a5",-3.00711,54.77453,33,0,null],["s5ec27b16249",-2.84274,54.74149,33,0,null],["s3e7606dd663",0.17809,51.482,33,0,"Erith Substation"],["s28b603cd476",-3.58508,51.70831,132,1,"Pen y Cymoedd Wind Farm Substation"],["s026c75c19c7",1.02269,52.60159,33,0,"Hardingham Primary Substation"],["s6368a9e27bb",-3.40612,50.76651,132,4,"Exeter Substation"],["s959c4f6122f",-0.34213,51.65917,132,7,null],["s03eebeb05ae",0.00345,51.75806,132,5,"Rye House Substation"],["s43664ab63b8",-0.26074,53.65822,400,0,"Hornsea Offshore Wind Farm Substation"],["sb5a95af7ba8",-0.01653,51.5316,400,0,"Pudding Mill Lane Substation"],["s8d936472684",-0.01217,51.53282,132,2,"Bow GIS"],["sb4e3c67ff04",-2.00905,55.7778,33,0,null],["s0d2ecb7f1a3",-1.08856,53.94342,33,0,"Campleshon Road"],["sa7813f17bf8",-0.07537,51.53149,750,0,"Hoxton GSP/DC Traction Substation"],["seacd4c83fed",-0.04075,51.55846,66,1,"Hackney C"],["s4823300c486",-0.14681,51.48613,750,0,"Victoria DC Traction Substation"],["s791f393be13",-3.05036,53.23659,400,0,"Shotton Converter Station"],["sb6b42d15421",-6.79655,54.34336,33,0,"Killylea West 33kV Substation"],["s11ce0fa33ea",-2.49447,53.19883,132,0,"Winsford Substation"],["sf0bd0a2919e",-4.13577,50.40816,33,0,"Alexandra Road Substation"],["s5041cc51c45",-1.22023,53.79278,33,0,"Sherburn"],["sbed1aed1d89",-1.4637,52.87905,33,4,"Infinity Park Substation"],["s420b8a22b47",-3.48642,50.89875,33,0,"Tiverton South Substation"],["sd4998b4ff04",-1.69206,53.67048,33,0,"Mirfield"],["s2dfec7499a4",-0.99886,52.2144,33,0,"Bugbrooke Substation"],["s0befb7f5e1f",0.75981,52.94515,33,0,null],["s1e9c6958194",-0.3331,51.29297,33,0,null],["sbdb99019f15",-4.38888,56.05051,33,0,null],["s0fa244eb2cf",-2.71635,52.05923,66,0,"Hereford Central Substation"],["s0b2fc791ac5",-1.05565,53.97921,33,0,"Huntington New Lane"],["s2ddba7d2359",-1.249,50.87649,33,0,null],["sdbaf4ca2a3b",-2.00481,53.36214,33,0,"Newtown"],["se0993cc770d",-3.23861,51.07978,33,0,"Lydeard St Lawrence Substation"],["s3cf4da5e232",-0.18538,51.24035,33,0,null],["se86c290318b",-5.00504,50.42697,33,0,"St Mawgan Substation"],["scd07bea6dcb",-3.20611,50.79115,33,0,"Honiton Heathfield Substation"],["sd61f9358356",-3.57406,52.55144,132,0,null],["s9cc2105509f",-2.12515,51.95665,132,0,"Troughton Farm"],["s57bc1ae108a",-4.2478,51.97255,132,1,"Alltwalis Wind Farm Substation"],["s8ece1d3793a",-5.03872,51.73839,132,0,"Tiers Cross Solar Park Substation"],["sfb2f3cbcabf",-0.31934,51.15949,33,0,"Capel Substation"],["s2fae0b28a9a",-3.12568,51.14795,33,0,"Nether Stowey Substation"],["se3c0b10125d",-3.19682,51.16887,33,0,"Holford Switching Station"],["s785e665dc7e",-4.45417,50.75062,132,0,"Northmoor Solar Farm Substation"],["sb62399e8bdc",-4.51506,50.71182,132,0,"Canworthy Solar Farm Substation"],["s006e0127325",-4.11484,51.10652,132,1,"Fullabrook Wind Farm Substation"],["s86c1e015c16",-1.69147,53.85858,33,0,"Rawdon"],["se03bc9d6db3",-2.56541,51.27169,33,0,"Chewton Mendip Substation"],["s8e92f7485e3",-0.93328,52.47093,33,0,"Farndon Road Substation"],["s7290376e0d0",-1.11619,52.48869,33,0,"Bruntingthorpe Substation"],["s7b352f864a1",-0.69527,52.36384,33,0,"Burton Latimer Substation"],["s6c086797b42",0.24988,51.45126,33,1,null],["s1a412c98c58",-4.05288,50.36975,33,0,"Sherford Substation"],["s6950c6e1188",1.35298,52.75849,33,0,null],["s5ae3fac7b6f",0.13571,51.50738,33,0,null],["scb8d9cd2666",-0.28083,52.12656,33,0,null],["s538379120bf",-4.01587,52.45242,33,0,null],["s39966f56ec5",-3.32956,53.10821,33,0,"Llanfwrog Substation"],["sb07c5f009f7",-4.0038,52.93559,132,0,"Maentwrog Substation"],["s4e39e375770",-3.46016,52.97142,33,0,"Glan yr Afon Substation"],["s9d637f2ae62",-3.3302,53.18112,33,0,"Llandyrnog Substation"],["s21781e5f3c5",-3.42803,53.17971,33,0,"Bryn Stanley Substation"],["se5002e4057d",-2.92038,53.03619,132,0,null],["s4a45436bbae",-2.40802,53.43589,400,5,"Carrington 400kV GIS"],["s4ab8db8d271",-2.60098,53.4119,132,0,"Dallam Substation"],["s3f6a86bab29",-2.51756,53.55847,132,1,"Westhoughton Substation"],["s62edc3761c0",-2.55343,55.47744,33,0,"Deans Close Primary Substation"],["sfb73f2acf92",-2.33617,52.57259,33,0,"Worfield Substation"],["sc016529922b",-0.43046,51.96624,33,0,"Barton Substation"],["s772a6c411cb",-0.47898,52.01615,33,0,"Ampthill Substation"],["s312a39ec75c",-0.97125,51.46157,132,0,"Reading Town Substation"],["se9106fedbb7",-2.49228,51.41166,33,0,null],["s4d04a7bb1da",-2.50643,51.41389,33,0,"Keynsham West Substation"],["s48e1634a559",-1.60075,50.73885,33,0,"Milford-on-sea substation"],["sa104fe0a9b1",-0.94446,51.00534,33,0,"Petersfield Substation"],["s4ebdecb003c",-1.64794,51.34087,33,0,"West Grafton Village"],["s571b90f22f4",-1.83367,51.03341,33,0,null],["s2791af527e2",-1.83587,50.95962,33,0,null],["sf2756c714f8",-1.80479,51.26411,33,0,null],["s531f283ea62",-3.66616,51.67235,66,0,"Ffynnon Oer Wind Farm Substation"],["s3bb05503eb5",-3.50625,51.72918,132,2,"Mynydd Bwllfa Wind Farm Substation"],["sa03349c90b6",-3.54827,51.74673,400,1,"Rhigos Supergrid Substation"],["s81b8ca2aaf3",-3.64645,51.76726,132,1,"Maesgwyn Wind Farm Substation"],["sb1ad6776611",-2.95082,50.84711,33,0,"Waterlake Substation"],["s2ab73b12f5a",-2.78295,51.27464,33,0,"Cheddar Substation"],["s1f4c3a0c6db",-2.81609,51.28546,33,0,"Axbridge Substation"],["sf00827ad852",-2.72587,50.91548,33,0,null],["s56ca64062a2",-2.76112,50.8116,33,0,null],["s6106dbb336c",-2.78523,50.88159,33,0,null],["s64dfe5ce028",-1.14448,53.08833,33,0,"Blidworth Substation"],["s728d89f33ce",-2.60029,51.46021,33,0,"Cotham Substation"],["s21102075e84",-2.39345,53.59439,33,0,"Harwood"],["s2227785101f",-1.49992,52.73282,33,0,"Willesley Substation"],["sc9974bd9446",0.20152,51.54532,33,0,null],["s90dc6cc0006",-3.36194,56.13789,33,0,null],["sb8217b8ab81",1.43371,52.85624,33,0,null],["s560a75e3cbb",-0.67973,51.52277,33,0,null],["s6403b0d4fdc",-5.04093,51.71478,33,0,"Milford Haven Primary Substation"],["s518d576ed74",-5.68742,54.47282,33,0,"Killinchy 33kV Substation"],["sac295fad33d",-2.63667,57.22462,33,0,null],["s3fd3d118686",-5.61265,55.42722,33,0,null],["s5f44fe8726f",-1.09075,52.98488,33,0,"Gedling Substation"],["s0b8b64a8787",1.26732,52.80203,33,0,"Aylsham Primary"],["s1bc04b1a436",-6.27261,55.76098,33,0,"Bowmore Substation"],["s8678d7a7ee1",-5.51556,56.69095,33,0,null],["sd4cdde8e5bd",-5.7768,56.54324,33,0,"Lochaline Substation"],["s54ef203582f",-5.31644,56.01071,33,0,null],["s3fc3b65b12a",-4.96294,55.98974,33,0,null],["s353f9db58c6",-5.25895,55.89103,33,0,null],["s3696199e707",-5.07469,55.84259,33,0,null],["sb8fa1cb78f9",-4.95816,55.89541,33,0,null],["s32d6932412a",-4.9905,56.39867,33,0,null],["s784d13e1b6d",-4.89878,56.17539,33,0,null],["s3ab3862e69c",-5.2143,56.43006,132,0,"Taynuilt Substation"],["s0e38cead3ef",-5.47015,56.39437,33,0,"Tullich Switching Station"],["sccc2f9e7acc",-4.72943,56.24548,132,2,"Sloy Switching Station"],["sef3a174d4bb",-3.40598,56.0298,33,0,null],["s7fd8bf4ae13",-4.71985,57.20175,132,1,"Glenmoriston Substation"],["s2057d26314a",-6.41393,57.41017,132,2,"Edinbane"],["s63ee2d57791",-5.28723,57.60801,33,0,null],["sda391c73a66",-5.42692,57.41854,33,0,"Achintee Regulator"],["s05a0788f9ef",-5.82617,56.98586,33,0,null],["s4c0fd170747",-5.88323,54.51466,33,0,"Carryduff 33kV Substation"],["s132400376e4",-4.44561,57.60349,33,0,"Dingwall Primary Substation"],["sefdea517401",1.35076,52.76423,33,0,"Scottow Primary Substation"],["s6e2ab8eea1e",-5.56401,54.64963,33,0,"Donaghadee 33 kV Substation"],["s8466156a142",-4.69872,57.57955,33,0,null],["s51337b60835",-1.02327,53.10465,33,0,"Farnsfield Substation"],["sbc3a0749e45",-3.50332,58.58963,33,0,null],["s0c76cefa54f",-3.87917,58.51212,275,1,"Connagill Substation"],["se1fe0b89b60",-4.02194,58.5104,132,1,"Dallangwell Substation"],["s2f4596a6948",-2.8005,54.04669,33,0,"Spring Garden Street"],["s82a5337eeb4",0.25763,51.47797,33,0,"Purfleet Substation"],["s55ac41f49ab",-1.04402,51.30224,33,0,null],["s3effea73d79",-4.04944,56.25926,33,0,null],["sd71a840281c",-4.50602,55.84528,132,1,"Johnstone"],["s985d694ad11",-4.46408,55.8406,132,2,"Elderslie"],["sdf08e003892",-4.4561,55.88279,132,3,null],["sb0dd4f961b2",-1.28815,52.37535,33,1,"Lawford Substation"],["se71def5872c",-1.36161,52.67633,33,0,"Nailstone Substation"],["s9cccdb01ba7",-1.3778,52.62882,33,0,"Osbaston Substation"],["s1753db758cc",-1.58996,52.75834,132,1,"Gresley Substation"],["s298d1bdf779",-1.85463,53.21158,33,0,"Hindlow Substation"],["seba26433ff4",-1.67316,53.28007,33,0,"Eyam Substation"],["s8bbbb9631ef",-2.38864,53.77221,33,2,null],["s88ef26d0df2",-0.72593,51.07816,33,0,null],["sa96fe504480",-0.66521,51.26746,33,0,"Normandy Substation"],["s364238a6a8b",-0.83008,51.27353,33,0,"Crookham"],["s2ba12ddf1ff",-2.05812,51.66264,33,0,null],["s8e43884c0fc",-1.97704,51.62642,33,0,null],["sf071a420393",-1.32643,51.05092,33,0,"St Cross Substation"],["se4c6de893df",-1.72402,51.41328,33,0,"Maybush"],["sd01b0f70a98",-1.78986,51.33201,33,0,null],["s974da150f00",-1.1061,53.97982,33,0,"Rawcliffe Lane"],["sfda2ff49857",-5.2307,50.24674,33,0,null],["s550a72ff7df",-0.38994,50.92758,33,0,"Ashington"],["sd175d2eef2c",-1.34554,51.0791,33,0,null],["se37313ce9db",-2.22559,51.41729,33,0,"Spring Quarry Primary Substation"],["s29743da35fd",-1.04383,50.83894,33,0,null],["sc35c352f7d9",-0.99438,50.8475,33,0,"Brockhampton Substation"],["sd9b5de92a9a",-2.27023,51.34401,33,0,null],["s4b288916a5b",-2.20166,51.34798,33,0,null],["sfe67885295f",-1.97131,51.72591,33,0,null],["s466af770367",-1.94482,51.87048,33,0,null],["s98e48db4f07",-1.84854,51.82694,33,0,null],["s71d7f40d497",-2.48197,52.90183,33,0,"Market Drayton Substation"],["sbda97479fa8",-2.68522,52.66575,33,0,"Berrington Substation"],["s78e87c04d0d",-2.71469,51.67787,33,0,"St Arvans Substation"],["sfcf50e01597",-0.99343,51.49838,33,0,null],["s380bf7d0ac4",-2.3859,53.88776,33,0,null],["s43b380b9ea9",-2.21406,53.84346,132,0,null],["se01ea6ce69e",-2.29183,54.1202,33,0,"Helwith Bridge"],["s9286541f468",-2.61195,54.13914,33,0,null],["s2c52872df3b",-2.47723,54.14585,33,0,null],["s7b56ccdbe94",-2.50846,54.12585,33,0,null],["sdfd66b668f9",-2.28255,54.06909,33,0,null],["sf7886252f0e",-2.19349,57.58357,33,0,null],["s99364ee6c85",-2.26444,57.56731,33,0,null],["s88733fcd6f5",-2.4627,57.5417,33,0,null],["s33e45116c32",-1.98669,57.5281,33,0,null],["s81236e165a2",-1.60485,53.74349,33,0,"Morley"],["sc1128e95bc3",-3.06206,53.05643,33,2,null],["s9bb4b995aef",-2.42181,52.30064,33,0,"Stockton"],["s3f8b4af1fe3",-2.76642,52.5784,33,0,"Leebotwood Substation"],["s9b53ba11114",-3.06302,52.74984,33,0,null],["s10dfd092139",-3.06263,52.8086,33,0,null],["se27346fddf5",-2.89758,52.91166,33,0,"Ellesmere Substation"],["scc8d7d7074a",-2.12989,52.00145,132,0,"Tewkesbury Grid Substation"],["s482d75a34ba",-3.0431,53.5549,132,1,"Formby Substation"],["se701db2c28c",-2.91777,53.29828,132,1,null],["s694e1182def",-2.18333,53.92429,33,0,"Barnoldswick"],["s83b0cc29ceb",1.60789,52.20756,400,1,"Galloper Onshore Substation"],["s38e5e696941",-2.93186,53.02835,33,0,null],["s8057a8af036",-2.5525,54.63371,33,0,"Kirkby Thore Substation"],["sb0dc4957187",-2.61222,54.58399,33,0,"Newby Substation"],["sfe93ff72767",-3.2028,54.10981,132,1,"Roosecote"],["s162eb32b5ae",-4.481,54.94921,33,0,null],["seded101de88",-4.37111,54.90699,33,0,null],["sd7e6a46341d",-4.45965,54.78188,33,0,null],["sf4267268237",0.40554,51.0468,33,0,"Ticehurst Primary"],["sed83a075287",-2.89242,53.19325,33,0,"Northgate Terrace"],["s2813e55a350",-2.88069,54.03508,400,0,"Walney Wind Farm Extension Substation"],["s9ca59ab77b7",-2.61559,53.66453,33,0,"Botany Bay Substation"],["s0ee3b0c48f9",-1.0841,53.95558,33,0,"Skeldergate"],["s063fb445875",-0.61928,50.80545,33,0,null],["s7ace205b57d",-2.62651,53.6481,33,0,"Chorley South"],["sc95b9c8a59c",-1.51243,53.39852,33,0,"Stannington Road"],["s8649560a552",-2.87697,53.28011,132,1,"Ellesmere Port Substation"],["scc4a9541820",-1.7825,52.10239,66,0,"Long Marston Substation"],["sc8201583f64",-3.50253,52.30151,400,0,"Rhayader 66Kv/11Kv Substation"],["sd4b3767da8b",-1.07177,53.9614,33,0,"Foss Islands"],["s6e7f42f68fc",-1.13542,53.11676,33,0,"Lindhurst Wind Farm Substation"],["sfb505ebcc9a",-0.66908,52.13472,33,0,"Petsoe Manor Wind Farm Substation"],["s14cfdabacbe",-0.1767,53.41978,33,0,"Binbrook"],["sdd9f8bb666c",-0.16734,51.21781,750,0,"Whitebrushes DC Traction Substation"],["s6323d4a91dd",-7.31516,54.23223,33,0,"Roslea Primary Substation"],["s692a2cc3244",-4.11868,50.97212,33,0,"Darracott Moor Windfarm"],["s73432d1027e",-1.03137,52.81044,33,0,"Old Dalby Lodge Wind Farm"],["s270b97bc88a",-0.40032,53.04453,33,0,"Ruskington Substation"],["s88959b85935",-2.18396,51.48048,33,0,null],["s14ca75686de",-3.20214,55.82817,33,0,null],["s629a7a364bf",-6.07249,54.52424,33,0,"Ballymacash 33 kV Substation"],["s2424bae766b",-0.60832,53.19887,33,0,"Lincoln Energy From Waste Substation"],["sddeaa5c691e",-0.5996,53.19249,33,0,"North Hykeham Substation"],["sec09e0d0999",-0.5613,53.2103,33,0,"Rookery Lane Lincoln Substation"],["s7220120d73d",-0.5526,53.22528,33,0,null],["s6c5f17c9317",-0.61555,53.20604,33,0,"Doddington park Substation"],["s8ba633fb43a",1.16071,52.32132,33,0,"Eye Substation"],["se220dd16cd5",-0.45695,53.17801,33,0,null],["sdb925ba57cd",-0.97993,52.12423,33,0,null],["s908cd82c5ec",-0.86183,52.16314,33,0,"Roade Wind Farm Substation"],["s6d393ea2bb3",-1.51475,52.52646,33,0,"Whittleford Substation"],["s958ea29a8ee",1.10593,52.37236,132,0,"Diss Substation"],["sc7fa7d3c8df",-0.10485,50.81691,33,0,"Kemptown Primary"],["sc8c53e8b011",-0.11896,50.84743,132,1,"MOULSECOOMB GRID 132 KV"],["s54b5f0fd86c",-6.08994,54.50803,33,0,"Knockmore Hill 33kV Substation"],["sba0f9822e5a",-1.3761,53.79265,33,0,"Ninelands Lane"],["s397289fe670",-1.54545,53.75133,33,0,"Middleton town street"],["s8a2d1e2e19a",-3.47627,53.11694,132,1,"Is-Orsaf Clocaenog Grid Substation"],["s2cdec79296b",-1.04536,51.19986,33,0,null],["sa5df0936ba0",-3.95343,51.69128,33,2,"Felindre Pumping Station Substation"],["s85c7be4c9ef",-1.53888,53.83053,33,0,"Allerton Hill Primary"],["se701c04bd20",-0.9915,53.0068,33,0,null],["s2e355988aea",0.54419,51.34725,33,0,"Lordswood Primary"],["sc97700784b7",-5.98557,54.58346,33,0,"Falls 33kV Substation"],["secd8809db2e",-2.80221,53.28027,33,1,null],["s0324e310434",-0.73852,52.99536,33,0,null],["s74351cf78f8",-0.79863,53.07825,33,0,null],["s0a645a0030e",-0.77721,53.04224,33,0,"Fernwood Substation"],["s4090a4c82d6",0.23743,53.14213,33,0,"The Hollies Wind Farm Substation"],["s41d42f96501",-3.243,55.9621,132,0,"Telford Road"],["s5922ecc55c1",-2.9887,51.11918,33,0,null],["s2cb87b56b22",-3.05171,53.80942,132,0,null],["s5c65bec7694",-2.91939,51.7154,66,0,"Usk Primary Substation"],["sdece94f2669",-3.16835,51.0327,33,0,"Montys Farm 33kV Solar Pk"],["saec01eaadac",-3.203,51.04765,33,0,"Halse 33kv Solar Farm"],["s9533c636326",-4.27456,57.94985,275,3,"Loch Buidhe Substation"],["s0d34cc2ba20",-3.7439,50.51938,33,0,"Ashburton Substation"],["s3b579458e9d",-3.22797,51.41237,132,3,"Sully Grid Substation"],["s112c4bf04f3",-4.8316,57.61913,132,0,null],["s9d386fdf68b",-4.65998,52.05018,33,0,"Bridell Primary Substation"],["sacd6200fd63",-0.15418,52.79581,33,0,"Spalding Substation"],["s44084cddfe5",-2.95851,54.89972,33,0,"Carlisle 33kV"],["sd5eee44156b",-4.23872,57.43046,275,2,null],["s07409aff3df",-0.14067,50.95295,33,0,"Burgess Hill Primary"],["s6ecb7533034",-4.29987,57.69892,275,3,"Fyrish Substation"],["sd8e9cae9b3c",-3.4007,50.76288,33,0,"Till House Solar Park Substation"],["s7bf28fa5ed8",-2.11052,55.74123,33,0,null],["sc95f1c7286f",-0.70683,51.70563,33,0,null],["sad1f6bf1cf4",-0.74365,51.75915,33,0,"Wendover Substation"],["s0cc2c3ea800",-2.9967,56.46178,132,3,"Glenagnes"],["s3594acc80b8",-2.97828,56.46322,132,2,"Dudhope"],["s91b222d8e2f",-0.18507,51.79927,132,0,"Black Fan Substation"],["s4a4b7720aee",-0.20236,51.70729,33,0,"West Potters Bar Substation"],["s54698f07cbc",0.70428,51.54194,132,0,"Southend Substation"],["s79b2ab73348",0.68597,51.56097,33,0,"Southend West Substation"],["sba94862429d",0.71045,51.55023,33,0,"Prittlewell Substation"],["sa28acf7fb3f",0.76438,51.53719,33,0,"Thorpe Bay Substation"],["sd2e9bc3f99e",0.83208,51.62313,33,0,"Burnham Switching Station"],["se9afa9e93c7",-0.91978,52.77522,33,0,"Holwell Substation"],["sb5969d880cd",-2.88849,56.38001,33,0,"Leuchars"],["s61359693c51",-2.96072,56.46582,33,0,"Constable Street"],["sc913c1b4207",-2.94068,56.47773,33,0,"Old Craigie Road"],["scd625ff13c0",-2.93097,56.49271,33,0,"Longhaugh"],["sba1cbe4d020",-2.88992,56.47828,33,0,"Baldovie Road"],["s87ac4d6b944",-2.0987,57.14011,132,1,"Clayhills Grid Supply Point"],["s0a515e3769c",-2.09994,57.14052,33,0,"Clayhills Primary Substation"],["s49047c18c60",-2.06685,57.138,33,0,"Balnagask Primary Substation"],["s18c20861538",-2.08934,57.12779,33,0,"Craiginches Primary Substation"],["s0356ff60f9f",-2.09351,57.12014,33,0,"Kincorth Primary Substation"],["sae146dfb582",-2.12429,57.12741,33,0,"Ruthrieston Primary Substation"],["s429ed0b022d",-2.13019,57.14332,33,0,"Queen's Lane North Primary Substation"],["sba0b7d0b021",-2.14613,57.15427,132,0,"Woodhill Grid Supply Point"],["s1b15d96a638",-2.14322,57.17229,33,0,"Haudagain Primary Substation"],["s67f4c74a033",-2.09721,57.15381,132,0,"Willowdale Grid Supply Point"],["s6f3e52d7553",-2.0954,57.15448,33,0,"Greyfriars Primary Substation"],["sea6f29a68de",-3.17271,55.94102,33,0,"Park Road Primary"],["sfc1a066e329",-3.1992,51.00765,33,0,"New Rendy Farm 33kV Solar"],["sa6b3446db9c",-3.22174,51.00968,33,0,"Grange Farm 33kV Solar Pk"],["s9ffd7f11985",-0.94912,53.92448,33,0,"Elvington"],["sbc3760cb838",-1.32484,52.97586,33,0,"Ilkeston Substation"],["sf0ad0874d1e",-1.50905,53.80159,33,0,"Leeds East 33KV Substation"],["s5b69c870f10",-1.12199,53.53833,66,0,"ICI Fibres"],["s59edbe775b1",-1.92973,52.0282,66,0,"Wormington Substation"],["s6c29b7c3406",-1.0552,52.29169,400,0,"Patford Bridge Substation"],["s32397ac8598",-2.72494,53.31499,400,3,"Rocksavage AIS Substation"],["s226f8a513e1",0.19103,52.75599,400,2,"Sutton Bridge Substation"],["s2c48a5a9f66",0.79381,52.6611,400,0,"Necton Substation"],["s2ba4803e070",0.79533,52.66224,400,0,null],["s42949d843ab",-0.4252,51.90778,132,1,"Luton North Substation"],["sdaa08b0c3e5",-5.06557,50.25729,33,0,"Truro Treyew Road Substation"],["sba6395219bf",-3.27496,53.48616,220,0,"Burbo Bank 2 Offshore Substation"],["s4aecf36365f",-2.88539,54.03487,400,0,"Middleton Substation"],["s8f3ba4de7a0",-2.89034,54.02978,400,0,"West of Duddon Sands Wind Farm Substation"],["se9e1883e44c",-0.22786,50.97482,400,6,"Rampion Wind Farm Onshore Substation"],["s8fa4b93cfd9",0.20245,52.72724,220,1,"Race Bank Onshore Connection Substation"],["s5383f2bbfd5",0.20167,52.72678,132,3,"Lincs Wind Farm Substation"],["sdda2c21ac1a",1.1519,52.77259,132,1,"Sall Grid Substation"],["s1988d694e7f",-2.79625,51.46374,33,0,"Weston-In-Gordano Substation"],["sc0f8dfe8485",-4.58942,51.9121,33,0,"Dyffryn Brodyn Substation"],["sbab5dcadba3",-3.61269,51.57109,66,0,"Llynfi Primary Substation"],["se183bd5012a",-1.28503,50.83564,400,0,"Chilling Lane Substation"],["s0d4fce0471e",-2.87263,57.26676,33,0,null],["s66251e41a45",-3.03145,57.06099,33,0,"Ballater Primary Substation"],["s7dbf21f9170",-2.50837,57.0567,33,0,null],["s460b6cae97d",-2.46018,56.9597,132,1,"Mid Hill Wind Farm Substation"],["sa0d18b12191",-4.81358,55.93675,132,1,"Spango Valley Substation"],["s35a401b692e",-2.29976,53.59665,132,1,"Bury GSP"],["secf51422a97",-3.5241,50.70645,132,3,"Marsh Barton Power Station Substation"],["s8bf81be2f92",-2.58037,50.778,33,0,null],["s57923bbd3ac",-0.4393,52.61153,33,0,"Wittering Substation"],["sc690916acf2",-0.53194,51.25786,750,0,"Merrow DC Traction Substation"],["s879df799596",-1.03173,53.69333,33,0,null],["s61d631879bb",-0.89884,53.91779,66,0,"Sandhill Lane"],["sca0f1a30af4",-2.21699,51.20014,33,0,null],["s0e1e51bc3cd",-2.17699,51.18924,33,0,null],["s6fb8492a271",-0.2451,53.74414,33,0,"Hedon Road Substation"],["s7346a5244be",-0.28531,53.74723,33,0,"King George Dock"],["s50f6b92d006",-0.30576,53.75966,33,0,"Westcott Street Substation"],["s91092ac3540",-0.33132,53.74507,33,0,"Alfred Gelder Street Substation"],["sa239ac51db3",-0.37468,53.73064,33,0,"West Docks Substation"],["s0b330bc6f35",-0.39618,53.7289,33,0,"Hessle Road Substation"],["s685f1a2613c",-0.37579,53.74008,33,0,"PLANGEO"],["sc356c817ac5",-0.38307,53.75516,33,0,"National Avenue Substation"],["s662df87bf9d",-2.57301,51.50939,33,0,"Filton DC Substation"],["sd7538c89cfc",-1.54036,55.14651,515,0,"Cambois Converter Station"],["s58bdc544069",-0.57431,53.72508,33,0,"Skillings Lane Substation"],["sa35abf87f5d",-0.03802,51.34356,132,1,"Addington Substation"],["s928b55deacd",-4.79281,52.01576,33,0,"Nevern Primary Substation"],["s2446ded8798",-2.58605,51.20752,33,0,"Dinder Substation"],["s9420eb4b0ae",-2.51025,51.14691,33,0,"Evercreech Substation"],["s9c617ffceac",-2.00032,51.34819,33,0,"Devizes 33/11Kv"],["s2a182f247fe",-6.82072,55.02703,33,0,"Rigged Hill 33kV Substation"],["sf06c189b028",-3.77985,50.28491,33,0,"Kingsbridge Substation"],["s0eabdf3a67f",-2.66869,51.5386,400,0,null],["s68bf7831792",-1.18393,50.6342,33,0,"Shanklin Substation"],["sa2b541ea5ab",-6.18953,54.0957,33,0,"Rostrevor 33kV Substation"],["sce7bcfa0e0d",-2.42555,53.19689,33,0,null],["s65aa628009c",-2.2692,53.64402,132,0,"Scout Moor Substation"],["sd39c10edae8",-3.77992,50.4209,33,0,"Hatchlands Farm 33kV Solar"],["s448cc4faecc",-1.4499,50.94247,33,0,"Lordshill"],["s26eb7a705fc",-1.13794,52.02703,33,2,"Brackley Town"],["sf8b56397ceb",-3.39575,50.82481,33,0,"Cullompton Solar Park Substation"],["s6b20100f4d9",-3.39492,50.65681,33,0,"COOMBE FARM 33KV SOLAR PARK"],["s49c64426225",-3.36515,50.63763,33,0,"Liverton Farm Solar Park Substation"],["s99f4dacc954",-0.82648,51.11055,33,0,null],["sb029d8c0317",-1.49115,50.91933,33,0,"Totton"],["sc1bcad497c1",-1.51443,53.81746,33,0,"Hillcrest Primary"],["sf1ccc415e94",-3.25946,55.92492,33,2,"Kingsknowe Road North New"],["s0de33785972",0.46133,51.35224,33,0,"Medway Local"],["sf61e79778ff",-3.18354,55.97982,33,0,"Ocean Drive Primary"],["s93b3f27d38a",-1.60711,54.76966,132,0,"Durham Rail"],["sba86a284132",-0.26002,51.33382,33,0,null],["s814c2345144",-1.52414,53.77244,33,0,"Leasowe Road Primary"],["s14ae92d0d66",-1.44739,53.82567,33,0,"Sledmere Garth"],["s80b7a27823d",-5.1007,50.1574,33,0,"Falmouth Bickland Hill Substation"],["scf84ade043a",-2.29755,52.95201,33,0,"Hill Chorlton Substation"],["sb781b22bc86",-3.12454,50.92715,33,0,"Culmhead 33kV Solar Park"],["sfb2371c9b6a",-0.69756,52.28183,33,0,"The Ridge Solar Park"],["s331d0abf4f1",-1.52356,53.42575,33,0,"Beeley Wood"],["s2bc2ec108e6",0.60158,51.42444,400,0,"Damhead Creek Substation"],["sd4d788813aa",-0.90241,52.47916,33,0,"Market Harborough Substation"],["s7164d4c7bd8",-4.19904,50.87089,33,0,"Shebbear Substation"],["s40c57b661f7",-2.99118,53.88056,132,1,"Walney II OWF grid connection"],["seec5e3790d7",-2.95818,50.87252,33,0,null],["s6ef70b39f06",-3.11194,50.9384,33,0,"Culmhead Substation"],["s5c1b9ab1e99",-2.4324,51.24875,33,0,"Newbury Substation"],["s1513c231383",-2.39954,51.20002,33,0,null],["sf51c749bac2",-2.02111,50.76419,33,2,null],["sccdedc777ad",-1.72897,51.51793,33,0,null],["s0b4c90fa046",-2.19567,51.27614,33,0,null],["sfffc3ccc353",-2.17194,51.27191,33,0,null],["sc3fd84e752a",-2.91482,50.91496,33,0,null],["s8707d0efd41",-2.64521,50.80976,33,0,null],["sdf58946dc09",-2.63992,50.80781,33,0,null],["sf17f23a580b",-3.82815,51.02631,33,0,"South Molton Substation"],["sb9521b65895",-3.52895,51.01445,33,0,null],["sdbb4fd0de48",-3.30904,51.03543,33,0,"Wiveliscombe Substation"],["sa84bf48c552",-3.4489,51.01792,33,0,"Quartley Switching Station"],["s74592e64ebd",-2.17886,51.89768,33,0,"Rotol Substationn"],["sac0cafc4b2a",-3.86786,50.71775,33,0,"Whiddon Down Substation"],["s16b51c12cb9",-4.50669,50.8267,33,0,"Stratton Substation"],["sb1c3ed13f59",-4.40479,50.98338,33,0,"Clovelly Substation"],["s3ea3edfce87",-4.19961,51.01139,33,0,"Bideford Main Substation"],["s2f4edaa723c",-2.98819,51.23813,33,0,"Burnham Substation"],["s76481a69fcb",-2.63808,51.37216,33,0,"Chew Stoke Primary Substation"],["s9dac1d175cc",-2.80291,51.37548,33,0,"Congresbury Substation"],["s351a00faa3c",-2.79366,51.33791,33,0,"Churchill Gate Primary Substation"],["s393379f4389",-2.37305,52.48075,33,0,"Quatt Substation"],["s6486ff9fc46",-4.01779,50.38533,33,0,"Langage Substation"],["sba415c6156c",-4.24206,50.44282,132,0,null],["sf902f22b3e3",-4.27063,50.64303,33,0,"Lifton Substation"],["sa258020ae0e",-4.16133,50.55296,33,0,null],["s7ac3df8bb31",-3.25168,50.91866,33,0,"Hemyock Substation"],["sf7ca0c3ff44",-3.67981,50.592,33,0,"Bovey Tracey Substation"],["sde61f19ba4a",-2.0033,51.07807,33,0,null],["sdef123652db",-0.6255,51.52346,132,0,null],["s8bb3afed9a2",-1.90314,51.13307,33,0,"Stapleford"],["s1ee1220fee2",-1.60692,51.44701,33,0,"Ramsbury S/S"],["s6f45077890f",-2.09661,51.51968,33,0,null],["s0b0a6a66cd1",-2.01041,51.52319,33,0,null],["sde138d54dc1",-2.46814,51.70176,33,0,"Berkeley Substation"],["s848b4ada2a8",-1.34539,52.85027,33,0,"Trent Lane Substation"],["s868cd0cf50f",-0.2405,50.98967,33,2,"Cowfold Primary"],["s6b8b3bb3cac",-0.60751,52.82777,33,0,"Easton Substation"],["s19a4a664bef",-0.66654,52.7587,33,0,"Market Overton Substation"],["s41fa05a1b99",-0.65255,52.68594,33,0,"Exton Substation"],["sbc02b22a22c",-0.71899,52.59542,33,0,"Uppingahm Substation"],["scb700b8a8e1",-3.46759,50.77202,33,0,"Francis Court Farm Substation"],["sd3d42cdfce1",-0.35597,52.67159,33,0,"West Deeping Substation"],["s694a7e369ce",0.47056,51.11345,33,0,"Goudhurst Primary"],["scf4a70e7c8a",0.47246,50.9865,33,0,null],["s282b4c0e7e4",0.50745,51.05184,33,0,null],["s2be282a7ea8",0.72721,51.0177,33,0,"Wittersham Primary"],["s10853d538c9",0.11182,51.22473,33,0,"Four Elms Primary"],["s6decb7ce73e",0.05366,51.21531,33,0,"Edenbridge Primary"],["s758a5be7886",0.0358,51.09778,33,0,"Forest Row Substation"],["sfb8228e8ad5",0.2964,50.98324,33,0,"Broadoak Primary & Switching Station"],["sc52a5f0d810",0.18044,51.03933,33,0,"Crowborough Switching Station"],["sd4a071c23e5",0.59051,50.86792,132,1,"Hastings Local"],["se16d46d11f5",0.29383,51.28415,132,0,null],["sde68def9ede",0.27954,50.81732,132,3,"Polegate Grid"],["s9b6f474ee3f",0.82246,50.96302,132,1,"Little Cheyne Court Substation"],["s38e5b23b52f",0.45393,50.9489,33,0,"Mountfield Primary"],["s87227fb033e",0.12736,50.98857,33,0,"Buxted Primary"],["s0edf350ff76",0.323,51.06668,33,0,null],["s53b5943ed1d",0.19321,51.04242,33,0,"Jarvis Brook Primary"],["sb6860237d37",0.2409,50.87978,33,0,"Horsebridge Primary"],["sb8008740d25",0.24487,50.9314,33,0,"Horam Primary"],["s93fab45b04b",-4.88423,50.30477,33,0,"Garlenick Wind Farm Substation"],["s459628218c9",-4.857,50.48525,33,0,"St Breock Windfarm"],["sa361b0e3ccb",1.21982,51.2091,33,0,"Lightweight Aggregates Primary"],["s3a168086456",0.68655,51.06639,33,0,"Tenterden Primary (substation)"],["s848bc2c0a10",0.7786,51.17949,33,0,"Little Chart Primary"],["sb4afbc3bce2",-0.17352,50.93254,33,0,"Hurstpierpoint Primary"],["sdca9c2e8230",0.21761,51.45232,33,2,null],["sf9f5ccd2896",-0.18876,51.35932,132,0,"Sutton Grid"],["s53c31d6dd59",0.37046,51.86789,33,0,"Dunmow Substation"],["sdf227622036",0.27403,51.79984,33,0,"White Roding Substation"],["sb7eebe34a71",0.26101,51.87215,33,0,"Takeley Substation"],["sc35df332312",-0.67658,52.81193,33,0,"Skillington Substation"],["sd9aeaef49ea",-0.71285,53.16737,33,0,null],["sf50c0d305cd",-0.90228,53.23426,33,0,"Tuxford Substation"],["sfd7e578ab5c",-0.3061,51.41458,132,0,"Kingston Grid Substation"],["s8f29c58f486",-0.33835,51.23367,33,0,null],["s1aeae9a6784",-0.22267,51.2456,33,0,"Colley Lane SW"],["s4eb954f55b8",-0.78251,51.41105,33,0,null],["s2fca9fd0ace",-1.1359,53.70948,66,0,"Eggborough Glass"],["sd10f47deb6b",-1.91125,52.75167,132,2,null],["s13b73c026b8",-1.91236,52.75372,132,4,"Rugeley Substation"],["s88f700cd298",-3.74873,51.56292,132,0,"Margam Biomass Generation Substation"],["seeb55138847",-2.43315,52.641,33,0,"Halesfield Substation"],["s53d699d0a50",-1.09657,53.57547,275,0,"Thorpe Marsh 275"],["sf1b02b88cd7",-1.27176,53.71944,66,0,"Ferrybridge A Substation"],["sb2df858d5c8",-1.27272,53.71977,275,0,null],["s05637f3a0cd",-1.28705,53.71698,132,3,"Fryston Lane"],["sfcab4a19743",-1.28433,53.72298,132,3,null],["s67a8f55a289",-0.15607,50.8539,33,0,"Withdean Primary"],["s042b6c32b9c",-2.44287,51.82105,33,0,"Elton Substation"],["sa475a7b81e8",-3.93693,51.12415,33,0,"Bratton Fleming Substation"],["sa55f2ad7cb7",-4.15822,50.38352,132,2,"Milehouse Substation"],["sd07a368dc1f",-1.00269,51.64296,33,0,null],["s868f1af0063",-0.71759,51.43923,33,0,null],["sbeb01e034b5",-0.90976,51.69567,33,0,null],["sac79e70c741",-0.52752,51.86634,33,0,null],["s26a3c9c25a8",-3.96949,52.46618,33,0,null],["s79a9b724b83",-3.68163,52.63678,33,0,null],["sae244aa73d1",0.26995,51.13972,132,1,"Tunbridge Wells Town"],["s16329d14dfb",-3.19142,58.93353,33,0,null],["sb00ff721cb5",-3.2084,58.83349,33,0,null],["sbf6caf6afe2",-3.12732,58.83333,33,0,null],["scafd32c61d6",-3.14672,59.11644,33,0,null],["sbcc68cd295d",-3.85525,58.01391,33,0,null],["s198d7d5638f",-3.9798,57.97599,33,0,null],["s5520b503e63",0.2289,51.14091,33,0,"Rusthall Primary"],["s63fc461c9cb",0.17662,51.15279,33,0,"Penshurst Primary"],["s247fc0b1ef4",1.40108,52.77315,33,0,"Worstead Primary Substation"],["s74df52495e2",-3.38463,50.87893,33,1,"Stoneshill Solar Park Substation"],["s977bc03b4f5",0.10566,51.04284,33,0,"DWS Primary"],["s4b274e913c4",-3.16231,52.6586,33,0,null],["s3d8fb81e179",0.16809,51.0481,33,0,"Crowborough Town Primary"],["sb173150c823",-3.31438,52.64542,33,0,null],["s8c227196e48",0.27183,51.19738,33,0,"Tonbridge Town Primary"],["s350f0efd689",0.10925,52.83812,33,0,null],["s47c67fee314",0.11305,53.3231,33,0,"South Reston"],["s191d16606a0",-0.12457,53.01196,33,0,null],["se6ac7ee396e",-0.22399,53.08643,33,0,"Tattershall Substation"],["s4749efea1ee",-0.20237,51.88143,33,0,null],["s135f8bd16aa",0.29414,51.20591,33,0,"Tonbridge East Primary"],["s553340a5f2e",-3.06638,52.93697,33,0,"Kronospan Chirk"],["s72890ea1e5d",-3.05554,53.16418,33,0,"Buckley"],["s8b4da3c2839",-3.06459,53.15191,33,0,"Castle Cement"],["sf22e374ea13",0.39257,51.17739,33,1,"Paddock Wood Primary"],["s1f1f2db0a4d",-2.70712,52.98047,132,0,"Whitchurch Substation"],["s1372eb2b370",0.49071,51.17583,33,0,"Marden Primary"],["s7b45d88eb97",-2.67901,52.7996,33,0,"Shawbury Substation"],["s7dc70c56653",-2.70892,52.86128,33,0,"Wem East Substation"],["sd0917d5a4f0",-2.5527,53.07698,33,2,"Acton"],["s10a85027af4",-2.63585,53.03326,33,0,"Newhall"],["sbd1e8522d8a",-2.75358,53.06073,33,0,"Duckington"],["sb468b373b4a",-2.90496,53.04379,33,0,null],["s974344897ab",-2.78868,53.1006,33,0,"Chowley"],["sba0b564aced",-2.67409,52.89746,33,0,"Prees Substation"],["s5edaec98026",-3.05464,52.84786,33,0,null],["sc0739c0f424",-3.24205,52.75765,33,0,null],["s2df9ab62fc0",-0.01467,51.12965,33,0,"East Grinstead Primary"],["s5a4bf83839e",-2.59,53.00048,33,0,null],["s8feada09677",-2.48915,52.99596,33,0,null],["s8ea51ebb2e0",-2.48574,53.05653,33,0,null],["sd3906f4c0b1",-3.72754,53.14024,33,0,null],["sed5605d86b6",-3.80147,53.09332,33,0,null],["saa267e275c2",-3.20229,53.22544,33,0,null],["s0a1a60e0cb1",-3.19847,53.16696,33,0,null],["s8d99ea0a698",-3.41081,53.1904,33,0,null],["sfb76df698cd",0.13388,51.27989,33,0,"Sundridge Primary"],["s3ab6336bdc6",0.47235,51.74481,132,1,"Chelmsford North Substation"],["s117a71cdb47",-2.58333,51.45916,132,1,"St Paul's Substation"],["s5fce9d32a3d",-2.72352,53.18065,33,0,"Duddon"],["s4f4baf7ebc7",0.18669,51.28703,33,0,"North Sevenoaks Primary"],["sd282f04bed8",-1.96939,53.00906,33,0,"Kingsley Holt Substation"],["s638051b2669",-1.87663,53.04369,33,0,"Cauldon Cement Substation"],["s60084cc835f",-1.88628,53.04106,33,0,"Cauldon Substation"],["s9e203947e96",-1.93363,53.00823,33,0,"Moneystone Quarry Substation"],["s5248bcc506e",-1.62296,52.81703,33,1,null],["s93f6a1c0542",-2.67047,53.15296,33,0,"Tarporley"],["s67fd79d41a6",0.00392,51.25529,33,0,"Oxted Primary"],["sdbf71c1ffc1",-0.23856,51.76478,33,0,null],["s8f07dd7fda4",-1.15276,51.89298,33,0,"Bicester Substation"],["s08b41049eba",-1.13343,51.90909,132,1,"Bicester North Substation"],["se30c3f26b8c",-3.25312,54.99413,33,2,null],["s9002a7082ac",-4.33577,55.46743,33,0,null],["se3d6d324322",-0.15013,51.23506,33,0,"Nutfield Primary"],["s4bc7b35ee5d",-3.95452,55.72084,33,0,null],["s97f128bcc01",-2.84487,55.58117,33,0,null],["sfdc3c3edc39",-2.47364,55.97872,33,0,null],["sdff0315672d",-7.79472,54.64759,33,0,"Crighshane 33kV Substation"],["s03403124962",-3.33751,55.75968,33,0,null],["se6166cbf1b2",-3.14908,55.75741,33,0,null],["s9e28401a6f6",-4.79586,57.64329,33,0,"Lochluichart Wind Farm Substation"],["scdca9e9c07d",-4.39171,57.72228,33,0,"Novar Wind Farm Substation"],["s8fa03324702",-4.25903,57.70103,33,0,null],["s2bdac670da9",-4.50122,58.0,33,0,null],["sc626f72cc2d",-3.42838,55.30085,400,0,"Moffat Substation"],["sdcba28dc8fa",-3.56176,55.26365,132,0,"Harestanes Wind Farm Substation"],["s59606d9d2bb",-4.76367,55.04936,275,0,"Kilgallioch Wind Farm Substation"],["sce7a4710c3c",-3.42894,55.32132,33,0,null],["sf13c2c8f03a",-4.60434,55.47979,33,0,null],["s92f96af6a9f",-4.33503,55.3445,275,3,"New Cumnock Substation"],["sbd5ec860086",-5.45814,55.69692,220,2,"Crossaig Substation"],["seed7dd8c670",-4.01275,50.38905,400,0,"Langage Substation"],["s3f3902878f9",-3.38949,51.54977,132,2,"Talbot Green Primary Substation"],["s3763bd06d62",-3.87238,51.62392,33,0,"Jersey Marine Primary Substation"],["s1c7d7fb7b43",-2.02773,55.80109,132,0,"Marshall Meadows"],["s7f0e9dd0da7",-2.59207,51.79563,33,0,"Bixhead Substation"],["s511347c6597",0.61271,51.59257,33,0,null],["s677d6a989bf",-1.4196,54.96246,66,0,"Temple Park"],["sab296a55c73",0.6659,52.1304,33,0,"Boxted Substation"],["sd444396dfd1",-0.00957,51.61937,33,0,null],["sbad83c419fa",-1.86097,52.89944,33,0,"Uttoxeter Church Street Substation"],["saca4735da3f",-6.53684,54.09912,33,0,"Silverbridge 33kV Substation"],["sce0f1545c05",-6.90956,54.93938,33,0,"Dungiven 33kV Substation"],["sc0dd9e6b3e5",-1.17944,50.83626,33,0,null],["sd5173f2363e",-1.4402,50.89835,400,0,null],["sabe46f33a44",-0.19535,51.80217,33,0,"Central Welwyn Primary"],["sc293e183422",1.54082,52.45344,33,0,null],["sef71a534e05",0.83123,52.90712,33,0,null],["scecef20b3db",-1.76704,53.69924,132,1,"Brighouse"],["s665f3fa3259",-1.53411,55.14363,66,1,"Blyth Offshore Demonstrator Wind Farm substation"],["s1f4b3e80c68",-3.17797,51.47708,33,2,"Wood St Primary Substation"],["s643f25cf57c",0.74201,52.04524,33,0,null],["s323104f394c",-0.10206,51.58943,33,0,null],["sb11db26308f",-6.78217,54.74119,33,0,"Crockandun Substation"],["s41f922e4d4d",-1.49033,53.81586,33,0,"Oakwood Lane"],["s83b0fa6ad80",-3.17071,55.96151,33,0,"Easter Road Primary"],["s0200c0223b6",-2.09401,51.37509,132,0,null],["s5bd1d38a571",-1.29207,50.70343,33,0,"Newport Substation"],["s2a5f5122e9e",-1.20803,50.59756,33,0,"Ventnor Substation"],["sd099d0bae7e",-1.14595,50.69208,33,0,null],["s2e9260c04c2",-1.15739,50.7238,33,0,null],["s2697297e1f9",-5.5618,50.10944,33,0,"Newlyn Substation"],["sf4b4c8df6e7",-5.55342,50.13195,33,0,"Penzance Heamoor Substation"],["sf9cbf91db2c",-5.37218,50.12607,33,0,null],["sdbaad2bdca3",-5.12782,50.05306,33,0,"St Keverne Substation"],["sd5f49d76371",-5.46414,50.13664,33,0,"Marazion Substation"],["s84f965d6153",-5.18511,50.12425,33,0,"Constantine Substation"],["s3b039917b2e",-5.11121,50.17789,33,0,"Penryn Substation"],["sed429914b1d",-5.057,50.15087,33,0,"Falmouth Docks Substation"],["see87a9969bb",-4.97847,50.19824,33,0,"Roseland Substation"],["s7b52df90029",-4.952,50.29811,33,0,"Probus Substation"],["se4a51ab1a47",-4.87509,50.36231,33,0,"Drinnick Substation"],["s9b4f812302c",-5.19724,50.20944,33,0,"Lanner Substation"],["s612f5dd64dd",-5.13457,50.23693,33,0,"Twelveheads Substation"],["s1af5bf4fdcb",-5.10041,50.21824,33,0,"Devoran Substation"],["s9d755604fbc",-5.07006,50.27808,33,0,"Truro Shortlanesend Substation"],["s52c6858803c",-2.5829,51.45857,33,0,"Broadweir Primary Substation"],["s9ffff5ff846",-2.72882,51.90957,66,0,"St Weonards Substation"],["s224b9ff8915",-4.58505,50.37827,33,0,"Lanreath Substation"],["s813f621f815",-4.79976,50.28553,33,0,"Mevagissey Substation"],["sac68e3ad47f",-4.7909,50.33178,33,0,"Sawles Road Substation"],["s5d72be52205",-4.3201,50.50424,33,0,"Callington Substation"],["s549c702a99c",-4.79473,50.3998,33,0,"Bugle Substation"],["se8098886f00",-4.73426,50.47382,33,0,null],["s34d88252911",-4.63529,50.65002,33,0,"Dairy Crest Davidstow Substation"],["scb539c81af4",-4.86737,50.56982,33,0,"Polzeath Substation"],["s9c93d90a739",-4.95218,50.5136,33,0,null],["s581588b8d3b",-4.48264,50.61775,33,0,"Laneast Substation"],["s20a0a391c8c",-4.26143,50.42201,33,0,"Saltash Whity Cross Substation"],["s0f87a4316d5",-4.21425,50.37696,33,0,"Torpoint Town Substation"],["s4b919f410e7",-4.1209,50.43247,33,0,"Southway Substation"],["se05236b180d",-4.25856,50.36568,33,0,"Torpoint Antony Substation"],["seaea09cf3ed",-4.21759,50.40814,33,0,"Saltash Dunheved Road Substation"],["s3325536950a",-4.40829,50.70375,33,0,null],["s44acf90665c",-4.42203,50.71208,33,0,null],["s0a80cd612af",-4.23828,50.6876,33,0,"Roadford Substation"],["s69d47f5ae5f",-4.29012,50.74222,33,0,"Ashwater Substation"],["s28e641cc547",-4.20819,50.52961,33,0,"Tamar Pumping Station Substation"],["s87b81eafd43",-4.0815,50.49452,33,0,"Yelverton Substation"],["s168c3be0ec8",-4.50424,50.90272,33,0,"Morwenstow Substation"],["s1bc58ddb585",-3.92659,50.88097,33,0,"Tinkers Cross Substation"],["s09808de2f7f",-4.05711,50.92905,33,0,null],["sa91dcbe8b45",-3.80971,50.85259,33,0,"Lapford Substation"],["sd810fda4357",-3.67485,50.73049,33,0,"Winslake Foot Substation"],["sd88ad1e2fc5",-3.70551,50.9036,33,0,"Witheridge Substation"],["sf21ff2a373f",-3.76637,50.65722,33,0,"Mortonhampstead Substation"],["s9976690fdb0",-3.92591,50.38651,33,0,"Ivybridge Substation"],["s6684fe05565",-4.3747,57.31756,275,2,"Farigaig Substation"],["s4bf0ebfc238",-4.3072,57.27074,132,0,"Dunmaglass Wind Farm Substation"],["sb30d7efe5f0",-4.40182,57.19212,132,0,"Corriegarth Wind Farm Substation"],["sbcae9fd6973",-4.43434,57.0938,132,1,"Stronelairg Wind Farm Substation"],["s8a8f7b5b60a",-4.47046,57.02728,400,1,"Melgarve Substation"],["s2a6fab36b97",-2.95518,57.52404,400,0,"Beatrice Wind Farm Substation"],["sc36643e76dd",1.05668,52.07393,400,0,"East Anglia ONE Substation"],["s897d00223d3",-0.09164,51.50676,750,0,"Cannon Street DC Traction Substation"],["sb03175bc741",-7.56012,54.18268,33,0,"Derrylin 33kV Substation"],["s7f98792be84",-4.56037,52.92063,33,0,null],["s796331a27be",-7.18461,54.91698,33,0,"Claudy Central 33kV Substation"],["s9ae6295e8c9",-0.14398,51.44125,750,0,"Balham DC Traction Substation"],["s5776fc09165",-0.24604,51.46784,750,0,"Barnes DC Traction Substation"],["sc1fe2552152",-3.20527,55.94307,33,0,"Martin Millar Primary S/S"],["sf25bc11678a",-6.94219,55.06975,33,0,"33kV Substation"],["s0d36e0686be",-6.94385,55.07426,33,0,"33kV Substation"],["s8a9f867af99",-1.47544,53.74639,33,0,"Royds Lane"],["s323dfa00d52",-0.13934,53.73849,33,0,"Ellifoot Lane Substation"],["sbcbe5313a33",-3.45005,50.73889,132,2,null],["sb5e7d65d570",-3.06651,51.72105,66,0,"Abersychan Primary Substation"],["s350b1a7d32a",-2.451,52.8367,33,0,"Hinstock Substation"],["s36b75b6d3cf",-2.32055,52.83195,33,0,"High Offley Substation"],["s4cfc8d83d7f",-0.26036,53.65678,400,0,"Hornsea Two Offshore Wind Farm Substation"],["sad695978e09",-1.11818,53.95945,33,0,"Severus Hill"],["sd207e0e503f",-0.80099,51.34119,33,0,"Sandhurst Substation"],["s89f49a72727",-2.73622,54.92971,33,0,null],["sa4f3f299ae9",-0.75917,51.58236,33,0,null],["s0abec882721",-1.36939,53.03031,132,2,"Loscoe Switching Station"],["sb0750ed5153",-2.06497,57.21577,132,1,"European Offshore Wind Deployment Centre Substation"],["sdb4e4dcdbfa",-7.71121,54.65061,33,0,"Church Hill 33kV Substation"],["s1cd22ab1309",-7.69682,54.65184,33,0,"Seegronan 33 kV Substation"],["s09cb0234c08",-6.2445,54.68131,33,0,"33kV Substation"],["s40c63b416ce",-2.67545,51.97081,66,0,"Witches Solar Park"],["s657ef25cbb6",-1.45477,50.93264,33,0,"Maybush"],["s394e4d16fa7",-1.10659,51.38985,33,0,null],["sb197b012a76",-5.50671,54.42515,33,0,"Cloghy Central 33 kV Substation"],["s1daa12c2464",-5.56229,54.57118,33,0,"Carrowdore Central 33 kV Substation"],["s75121862fe4",-1.46684,53.79652,33,0,"SELBY Rd"],["s94bd3d54037",-2.97231,53.1721,33,0,"Airbus East"],["sac358b312ca",-3.09827,51.76964,66,0,"Blaenavon Primary Substation"],["s737b0954068",-2.53156,53.34965,33,0,null],["sfefd509002d",-1.11395,53.50086,33,0,null],["sa76e0e585db",-1.52177,51.50177,33,0,null],["sb539a9a6462",0.89076,51.12835,33,0,"Sevington Primary"],["s033867d9f62",-0.97577,51.99583,33,0,null],["s8c7d50336b4",-2.14204,52.63043,33,0,"i54 Business Park Substation"],["sabdadbbfa8f",-3.66178,55.97741,33,0,"Manuel Substation"],["sfc9a8fcb1ec",-2.97136,53.33082,33,0,null],["sf1334497c55",-0.76145,51.24533,33,0,"Aldershot Switching Station"],["s8c1b1525661",-2.97575,53.33573,33,0,null],["sc46d1dbffcd",-1.20349,53.18064,33,0,"Littlewood Farm PV Substation"],["se2857971c05",-3.46489,51.56741,33,0,"Taff Ely Wind Farm Substation"],["sfd2b91d750e",-4.20178,51.95777,132,1,null],["saf5af187ce8",-6.77256,54.79508,33,0,"Draperstown 33 kV Substation"],["s288cf265fe8",-2.89541,53.35394,132,0,"Garston Substation"],["s6c1aa4b4f50",-2.49896,51.858,33,0,"Mitcheldean Substation"],["s6d6fcd4258e",-3.68158,56.05104,275,0,"Longannet Substation"],["sb6e0828a1af",-3.24315,56.28988,33,0,null],["s31fce9a63f2",0.75377,51.3415,33,0,"Sittingbourne Town Primary"],["sf3646326f78",-2.63226,51.48306,33,0,"Stoke Bishop Substation"],["s35358690298",-6.19586,56.58208,33,0,"Dervaig"],["sc2c1d715ff2",-1.37855,54.52432,33,0,"Urlay Nook"],["sbd93b228cbb",-1.56597,54.5868,33,0,"Aycliffe Forrest"],["s732248ac35d",-6.26332,55.03129,33,0,null],["s9971721cfc1",-1.65275,52.80241,33,0,"Wellington Street Substation"],["sb7719f5f6f8",-2.95444,52.04208,66,0,"Peterchurch Primary Substation"],["sab55587b9dd",-3.51254,51.69732,33,0,"Maerdy Wind Farm Substation"],["s2f564e9807a",-0.66635,51.80047,400,0,"Tring Primary"],["s640ca1799a8",-7.02668,54.54845,33,0,"Gortfinbar 33 kV Substation"],["sa35559284a8",0.59526,51.42175,132,0,"Kingsnorth Grid"],["sa7b65cc1353",-3.0985,57.37784,132,1,"Dorenell Wind Farm Substation"],["sf7ce56f586f",-6.66675,54.39041,33,0,"Tullygoonigan 33kV Substation"],["sf4fa17866cc",-6.65275,54.36012,33,0,"Armagh North 33kV Substation"],["s0037a411061",-6.71005,54.24611,33,0,"Keady 33kV Substation"],["s409d6b8c226",-6.37472,54.29106,33,0,"Poyntzpass 33kV Substation"],["s0e247ae0b0e",-6.51422,54.28863,33,0,"Markethill 33kV Substation"],["s7b55fbd8989",-6.53925,54.38513,33,0,"Richhill Central 33kV Substation"],["sd2396c0651d",-6.44447,55.00443,33,0,"33kV Substation"],["scffee7eff9a",-1.62839,53.82796,33,2,"Abbey Rd"],["s0a2d9ac060d",-1.18163,52.84343,33,0,"East Leake Substation"],["sea3d39ea9e8",-5.32318,50.22328,33,0,null],["s33beae47e58",-2.51012,51.82235,33,0,"Bilson"],["s268e295aeb2",-2.7066,51.38023,33,0,"Bristol Airport Primary Substation"],["s1247dd387d9",-3.52509,55.2558,33,0,"Minnygap Wind Farm Substation"],["s5687a5b4099",-3.35616,51.63646,33,0,"Lady Windsor Primary Substation"],["s71d5f7e776c",-0.14185,51.47594,132,0,"Stewarts Road Substation"],["s8e9c308b0d7",-1.11515,53.50166,33,0,null],["s9eb4e094f1d",1.35409,52.76077,33,0,null],["s8cdce01b8fb",1.36781,52.75332,33,0,null],["s9915e5ba072",-0.79782,53.65934,66,0,null],["s0955a353e5e",-0.79807,53.65937,33,0,null],["s7278c10d0ef",-2.67517,51.53476,33,0,"Avonmouth Windfarm Substation"],["sa359e6477aa",-3.52209,50.72372,33,0,"Athelstan Road Substation"],["s031cc86351d",-0.22506,51.51523,132,2,"White City Substation"],["sb8ccf500f82",-2.49294,51.48436,33,0,"Staple Hill Switching Station"],["sed13322dd02",-1.40259,54.89615,33,0,"Mount Road"],["s6f5a49a5e05",0.4886,50.8422,33,0,"Bexhill Town Primary"],["sda4f8e49c30",-2.68055,51.50219,132,1,"Avonmouth Substation"],["s6313cfb9d41",-1.41678,53.42931,33,3,"New Droppingwell Road"],["s757879c64f3",-5.78628,54.59619,33,0,"Dundonald East 33 kV Substation"],["sfbe0bd2817e",-1.12406,53.0076,33,0,"Arnold Substation"],["se5841c467de",-1.49524,53.78177,33,0,"Knostrop Primary"],["s1a9c084c388",-4.06661,57.3011,275,3,"Tomatin Substation"],["s28c1434cdb7",-0.11682,51.53176,132,0,"Calshot Street Substation"],["s87d89588517",0.49876,51.39491,750,0,"Strood DC Traction Substation"],["sa64c37dade0",-2.52502,53.38281,33,2,null],["s0e0771f8dcf",-0.0725,51.80078,33,0,"East Hertford Primary"],["s217adbaeb4b",-2.53777,51.71422,33,0,"Mead Lane Substation"],["s2dae0f45952",-0.64811,51.83033,33,0,"Pitstone Substation"],["s096b1428eaf",-1.4568,54.88246,33,0,"Offerton Substation"],["s526d006c0c7",1.34398,51.31131,400,1,"Richborough 400kV Substation"],["sfc5b243a248",-3.80619,51.98797,33,0,"Llandovery Substation"],["sad4bd454daf",-3.99945,51.77906,33,4,"Pantyffynon Primary Substation"],["seb0b824f6b9",-4.70548,51.70079,33,0,"Broadfield Primary Substation"],["s29cca633c35",-5.01894,51.72892,33,0,"Steynton Primary Substation"],["s0fc26d0ff75",-0.16396,52.68336,33,0,"Crowland Substation"],["s18dfd6f016e",-4.78199,51.68041,33,0,"St Florence Primary Substation"],["s43e9b58a165",-4.71004,51.67195,33,0,"Tenby Primary Substation"],["s30cb7a4ad93",-4.51905,51.74753,33,0,"Pendine Primary Substation"],["sc619626e4fb",-4.58815,51.94871,33,0,"Llanfyrnach Substation"],["se213069a1ce",-4.59668,51.83034,33,0,"Whitland Primary Substation"],["se8da06f4946",-4.49952,51.84482,33,0,"St Clears Primary Substation"],["s3883f1eaad4",-4.73082,51.82411,33,0,"Penblewin Primary Substation"],["s70b3d15cb1d",-4.1293,51.69971,33,4,"Westfa Primary Substation"],["s116362f0270",-0.66831,53.57149,33,0,null],["sa20424812a5",-1.259,53.48519,132,0,"Eland Road"],["sccee2b94394",-1.11424,53.50065,132,1,"Mallard Way Substation"],["s68534121ea8",-1.37349,50.89882,33,0,null],["sd0d0a182bb7",-0.14011,53.81978,66,0,"Tansterne Biomass"],["sd807a8b831c",-0.91935,53.62114,66,0,"TWIN BRIDGE WF"],["s182b7599bea",1.14473,51.09836,400,1,"Folkestone Converter Station"],["sa262869505c",-1.07204,52.80236,33,0,"Wymeswold Solar Farm"],["s86954ad8da6",-3.96053,51.685,33,19,"Bryn Whilach Solar Farm"],["s8eef4328a14",-0.87211,53.65759,66,0,"Goole Fields 1 WF"],["sb485b854d55",-2.91525,53.04178,132,1,"Marchwiel Grid Substation"],["s310ef0611d1",-1.08706,53.57921,66,0,"Thorpe Marsh"],["sc345b3fc70c",-1.13967,53.51144,33,0,"Belmont Avenue"],["s7aa6ede4a03",-1.13032,53.5176,33,0,"Jarrat Street"],["sf347aa9efba",-6.45533,54.40915,33,0,"_____ 33kV Substation"],["sec86386c180",-1.37917,53.50031,66,1,"West Melton Substation"],["s77fde404f96",-3.59932,57.50407,275,0,"Berry Burn"],["s5650e5b6049",-1.45215,53.44437,66,0,"Ecclesfield"],["s9a8b802245f",-1.4865,54.98332,33,0,"Ormonde Street Switching Station"],["s5c39fb603e1",-0.52327,51.43469,33,0,null],["s0af907eaf56",-1.50011,54.98021,33,0,"jarrow Primary"],["s6cd74ce6457",-1.4939,53.77853,132,10,"Skelton Grange"],["s21d7684f939",-0.59092,53.56726,33,1,null],["s58a369d9b69",-1.08574,53.57874,275,0,null],["sb68365f6751",-1.08887,53.57861,400,0,null],["sb469f73b0b6",-0.82896,53.52861,33,0,"Epworth"],["saf2599412e5",-0.78706,50.7416,33,0,null],["sb836e9e78d1",-0.79656,53.74062,33,0,null],["sce377872344",-1.95871,54.9513,66,0,"Riding Mill Pumps"],["se4282ffb53c",-1.83849,54.96491,66,0,"West Wylam"],["s415ee0d000e",-6.73571,54.47523,33,0,"Killyman Central 33 kV substation"],["s86c519ac342",-7.03208,54.98005,33,0,"Glenconway 33 kV Substation"],["sb1d91e5453c",-6.17655,54.77882,33,0,"Corby Knowe 33kV Substation"],["s0b9ea0b1ddc",-7.3194,54.99155,33,0,"Foyle Road 33 kV Substation"],["sbbb1207cbcb",-4.62086,55.80342,33,0,null],["sb5820830557",-1.47158,53.34859,275,0,"Norton Lees Substation"],["s7dba69b64f7",0.00748,51.51036,132,0,"Limmo Peninsula Substation"],["sec5be6fd1f1",0.00714,51.49499,132,0,"Greenwich Peninsula Substation"],["s17fd01eb899",-4.43362,51.99614,33,0,"Blaen Bowi Substation"],["s688510975cd",-0.21832,50.83065,33,0,"PORTSLADE 33KV"],["s26f262da5f0",-0.19791,50.8443,33,0,"Hangleton Substation"],["se544b09f834",-0.14107,50.82527,132,1,"BRIGHTON LOCAL"],["s3f3beaaee13",-0.1411,50.82541,33,0,"Brighton Town Substation"],["s19b61b0589d",-0.12461,50.8293,33,0,"Queens Park primary substation"],["sea1d8cc1910",-1.60662,50.80281,33,0,null],["sf16bf55ce69",-0.06272,50.81512,33,0,"Rottingdean Primary"],["s8f3b6697411",-0.22485,50.8386,33,2,"Southwick Substation"],["s87473ca74b8",-0.28307,50.83968,33,0,"North Shoreham Substation"],["s8ac386d91fb",-0.33746,50.83384,33,0,"Sompting Substation"],["sdc863cc8c7c",0.29712,50.78307,33,0,"Eastbourne Grid"],["sf8b221e14c4",-2.84251,52.16921,66,0,"Lower Chadnor Primary Substation"],["s787b305da86",-1.99337,50.74656,33,2,"Creekmoor"],["sb6edf88ca77",0.11158,51.50776,33,0,"Thamesmere Substation"],["s4c561c26868",-2.69204,51.47116,33,0,"Easton-in-Gordano Substation"],["s5e2c08c8550",-1.44825,53.36625,33,0,"Norfolk Park"],["sf43c2d4abdd",-1.42729,53.39093,33,2,null],["s07bfbbbb9e7",-5.79842,54.25119,33,0,"Ballykinler Central 33 kV Substation"],["s5711ed32fc3",-7.63105,54.34787,33,0,"Enniskillen Town Substation"],["sd51addc473e",-1.47495,53.37338,33,0,"Ellin Street"],["se9f115185ab",-1.43953,53.39095,33,0,"Stoke Street"],["s4791c176e5f",-1.44987,53.38646,33,0,"Bernard Road"],["s6890b654ed1",-1.44395,53.4261,33,0,"Bellhouse Road"],["s0c07cf13554",-1.45376,53.41108,33,0,"Barnsley Road"],["s34b1d9ce7df",-1.47613,53.3595,33,0,"Saxon Road"],["scb7181d37fc",-1.44334,53.34668,33,0,"Gleadless Valley"],["s8fad21f5100",-1.46466,53.30042,33,0,"Dronfield"],["s95a2d81e45b",-1.4646,53.3007,33,0,"Callywhite Lane"],["s61de55e6f9c",-1.37824,53.38474,33,0,"Waverley Business Park"],["s4cd32a04241",-1.41726,53.39872,33,0,"Tinsley Park Road"],["s75f62602a58",-3.13571,51.72745,400,0,"Abertillery Primary Substation"],["s17be2be1145",-0.66386,53.61261,33,0,"Foxhills 33"],["s67e34832fef",-1.37146,53.42182,33,0,"Templeborough Biomass"],["s2600f2e0684",-2.57531,52.70253,33,0,"Leaton Substation"],["s30b0e946e74",-5.92627,54.267,33,0,"Annsborough Central 33kV Substation"],["sbad1aedcafb",-1.47449,52.88747,33,4,"Sinfin Lane Substation"],["s2e27455eec7",-5.83516,54.30614,33,0,"Seaforde Central 33kV Substation"],["sf690c50622d",-2.76195,53.20002,33,0,"Tarvin Substation"],["s05b11487826",-0.75393,52.44708,33,0,"New Albion Wind Farm Substation"],["scdca85cc18b",-5.50911,54.48973,33,0,"Kircubbin East 33 kV Substation"],["sc0a6df0fec3",-1.22043,52.36675,33,0,"Hillmorton Substation"],["sec2df950d85",-0.91748,51.44203,33,0,null],["sfbc04c0f00f",-3.36392,56.10897,33,0,null],["s1528196ce91",-6.35924,54.45978,33,0,null],["se575d7cbb02",0.59854,51.41857,400,0,"Kingsnorth Substation"],["sd556c83fae1",-0.21476,53.63339,33,0,"Humber Road"],["s1e041983ecc",-0.87626,53.68188,66,0,"Goole Fields 2 WF"],["s30d1ea03606",-5.889,54.21847,33,0,null],["s7296dd7c370",-1.59557,53.80525,132,6,"Kirkstall B GSP"],["s119b986718c",-0.13429,51.58125,33,0,null],["s94bdf43133d",-4.18821,55.3179,132,0,"Blackhill Substation"],["s2e99fdf481f",-4.20334,55.31302,132,0,"Dun Hill Substation"],["sd798952b838",-3.7374,55.79237,132,0,"Black Law Extension Substation"],["s0f9b0b569f0",-4.01803,55.3371,132,1,"Glenglass Substation"],["sc979dce414e",-4.24577,57.42198,275,2,"Knocknagael Substation"],["sc83cd3c9adc",-2.28499,57.49095,400,0,"New Deer Substation"],["sc39f65b04d8",-2.51627,57.40996,400,0,"Rothienorman Substation"],["sc31548a9729",-1.03042,53.78792,132,0,"Osgodby"],["s9a3cde942ce",-8.01319,54.43856,33,0,"Callagheen 33 kV Substation"],["s235d36c631d",-4.11113,51.19953,33,0,"Ilfracombe Substation"],["s47ffce5d155",-3.61743,55.06676,33,0,null],["s4bf0b0d26c6",-1.66012,54.95941,132,1,"Dunston"],["sce582f8ba39",-1.62415,54.97488,132,1,"Barrack Road"],["s0c08ddb7239",-0.29301,51.32229,750,0,"Ashtead DC Traction Substation"],["sc267c166e1b",0.1344,51.43669,750,0,"Albany Park DC Traction Substation"],["scfffe7fb478",-2.24128,55.65343,33,0,null],["s108de86b4fa",-0.09982,53.71002,33,0,"Ottringham Rd"],["s79b466b8ed5",-0.18228,54.10352,66,0,"Martongate"],["sbae430e95be",-0.35379,53.86538,33,0,"Hall Farm WF Routh"],["s1ff92c551ec",-0.4244,53.85066,33,0,"Norwood"],["sded38ac04f3",0.01501,53.37723,33,0,"Keddington Road"],["s714fc8ba7ad",-1.36421,53.28103,33,0,"The Breck Solar Farm Substation"],["s04ae0de8fed",-0.47668,51.64078,132,0,"Rickmansworth Grid"],["s20e38631693",0.08249,51.56931,132,0,null],["s296b91917a6",-0.13723,51.38361,132,0,"Prologis Substation"],["s8690110f6cf",-0.34081,51.44759,132,0,null],["s0dca186aabb",-3.53164,51.61007,66,0,"Mynydd Yr Aber Wind Farm Substation"],["sef7e5d8bbe7",-3.6117,51.62771,66,0,"Llynfi Afan Wind Farm Substation"],["s2e7020f5199",-3.5445,51.60807,66,0,"Ogmore Vale Primary Substation"],["s548a0511235",-3.97447,51.75171,132,0,"Mynydd y Gwair Wind Farm Substation"],["s1d571a5fc55",-3.27469,52.41058,66,0,"Garreg Lwyd Wind Farm"],["s8025e54501d",-0.43189,51.41264,750,0,"Upper Halliford DC Traction Substation"],["s7d3bfa5c66c",-3.48838,51.68061,33,0,"Maerdy Primary Substation"],["s652c27a4ae9",-3.45627,51.66798,33,0,"Middle Fan Primary Substation"],["s569e95ad734",-3.64113,51.74183,33,0,null],["sf9677af9ead",-3.64021,51.7391,33,0,"Aberpergwm Primary Substation"],["s5c6ebd5cec7",-3.19395,51.5247,132,2,"Cardiff North Grid Substation"],["s95c8412f2e7",0.12546,51.41273,33,0,null],["s848cf9ab138",0.10772,51.38638,33,0,null],["s0a7c41b817a",-0.34231,51.30563,33,1,null],["sdb36f219c4c",-0.2902,51.32044,33,0,"Ashtead"],["s225ab0b3607",-0.15967,51.24849,33,0,"Redhill Primary"],["see85b8781d8",-0.56773,51.21548,33,0,"Shalford Substation"],["sc405802fd17",-2.60281,54.46127,33,0,null],["s35b43f6eebc",-2.46734,54.44666,33,0,null],["s885e6173a7f",-2.36316,54.47718,33,0,null],["s74731c612f1",-2.96294,54.42297,33,0,null],["s6883775a205",-1.47918,54.3468,33,0,"Northallerton"],["s48695bd1a0b",-1.59052,54.29009,33,0,"Bedale"],["s6559178506f",-1.10288,53.04709,33,0,"Calverton Substation"],["sd9b5662af9c",-3.55532,54.54404,33,0,null],["s083b21f85a2",-0.05696,51.42156,750,0,"Penge DC Traction Substation"],["s4ea568e6c15",-3.38311,54.86801,33,0,null],["se1ae6b22284",-3.5852,53.17904,33,0,"Llansannan"],["scfba3f2be74",-3.20389,54.18995,33,0,null],["s6147442e5e3",-3.08091,54.36933,33,0,null],["s8663e3fcde7",-3.13521,54.23728,33,0,null],["s5d7076dab06",-2.91758,54.19687,33,0,null],["s9167ac63889",-3.07977,54.19685,33,0,null],["s1d3e49fb506",-3.51986,54.61933,33,0,null],["s2ce33602241",-3.52277,54.6064,33,0,null],["sc7446dbff36",-3.56699,54.64663,33,0,null],["sb1f75dd66de",-2.87668,53.76919,33,0,null],["s4e85312f2d1",-1.62231,54.95229,66,0,"Bensham"],["s34151668943",-2.74416,54.17673,33,0,null],["s7d031c80f8c",-1.86713,53.29411,33,0,null],["s70681d55a52",-1.55094,53.13883,33,0,"Matlock Substation"],["s32d17bf5995",-2.17867,53.09867,33,0,"Knypersley Substation"],["s3c3b2f07dce",-2.03618,53.07117,33,0,"Cheddleton Substation"],["s1cad57fc5ce",-1.68162,52.86371,33,0,"Hatton Substation"],["sb428b972c90",-1.30295,53.10563,132,2,"Pinxton Substation"],["se48a13d314b",-1.15713,53.14751,33,0,"Crown Farm Substation"],["sf4ca5744962",-3.35062,50.92822,33,0,"Ayshford Court Farm Solar Park Substation"],["s23c27eecfae",-1.53183,52.7737,33,0,"Woodville Substation"],["s88209c116b0",-1.13422,52.99002,33,0,"Marlborough Road Substation"],["sb90a04b7e6e",-1.25026,53.00754,33,0,"Watnall Substation"],["sf5a9f3f865b",-1.14316,52.64683,132,1,"Leicester North Substation"],["s022c82011da",-1.14404,52.57728,132,0,"Wigston Substation"],["s693610e872f",-0.92738,52.29005,33,0,"Chapel Brampton Substation"],["se258f753a5b",-0.94314,52.40502,33,0,"Kelmarsh Wind Farm Substation"],["s80db799b875",-1.13255,52.7236,33,0,"Mountsorrel Substation"],["s160bf3f4fee",-1.1015,52.62972,132,1,"Leicester East Substation"],["s57e3107b3c2",-1.10184,52.58472,33,0,"Wigston Magna Substation"],["sdf22eb3749e",-1.20947,52.584,132,1,"Carlton Park Substation"],["s35a1409992c",0.21263,51.45025,132,0,"Dartford Grid Substation"],["s151692dc2ee",0.20734,51.45056,750,0,"Dartford DC Traction Substation"],["seb68ea5ba12",-1.01631,53.89095,33,0,"EX North Selby S/S"],["sa210bc257f8",0.54493,51.16692,33,0,"Staplehurst Primary 33kV"],["sadad9275c30",-1.9637,53.02231,33,0,"Froghall"],["s9edcf1f3119",-1.9905,52.95839,33,0,"Tean Substation"],["s5d7f68ee356",-2.00477,52.98128,33,0,"Cheadle Substation"],["sf39dea323cc",-4.91016,56.15462,33,0,"Douglas Pier Primary Substation"],["s696a6b2bdf3",-2.21407,53.50223,33,0,"QUEENS PK"],["s8a5823c3903",-2.98472,53.39852,132,0,"Sparling Street Substation"],["sba6f25e8f73",-0.68733,52.04106,33,0,"Kingston"],["s3f415b4ec67",-0.68808,52.02382,33,0,"Wavendon Gate"],["s6336e5d4605",-0.67715,52.03429,33,0,"Fen Farm"],["sa5fad536ee2",-0.74632,52.04113,33,0,"Secklow Gate Substation"],["s3ce0860e311",-0.75888,52.06198,33,0,"Marlborough Street"],["sb28fce35aac",-0.79858,51.28137,33,0,null],["s941f1e5f2b2",-0.4115,51.49849,66,0,"North Hyde Substation"],["s3c62caad1ee",-4.76611,57.6535,33,0,null],["s1a7a8088b2b",-3.94593,55.56282,132,0,"Galawhistle Wind Farm Substation"],["s4736608a5eb",-3.04207,52.33665,66,0,"Knighton Substattion"],["sa43a04d5f17",-5.95092,54.59313,33,0,null],["sae9e4aff7ec",-0.73738,52.00236,33,0,"Maxwell House Data Centre"],["s2447d5c30fa",-0.71866,51.99717,33,0,"Victoria Road"],["s14c19a1087b",-0.75295,51.99026,33,0,"Newton Road"],["s95bb917fb30",-0.82219,52.06321,33,0,"Wolverton"],["s185e4d6b0d0",-0.8255,52.04923,33,0,"Kiln Farm"],["sbc04d51551e",-2.41197,52.94729,33,0,"Bearstone P.S."],["s09853ce5abe",-2.2509,52.38275,132,1,"Kidderminster"],["sa64da963ffa",-2.48567,52.37625,33,0,"Cleobury Mortimer Substation"],["s5632a605602",-2.59395,52.31695,33,0,"Tenbury Substation"],["s4d02447c055",-2.98807,52.26483,66,0,"Presteigne Primary Substation"],["s2589d08aceb",-2.26233,52.07141,66,0,"Brotheridge Green"],["s11f2a036ae2",-2.07897,51.94712,66,0,"Bishops Cleeve Substation"],["se8632f65255",-2.22562,51.85499,132,1,"Eastern Avenue"],["s95456a90546",-2.24998,51.86447,132,1,"Commercial Road"],["sb75692cb93f",-4.05682,55.12877,132,1,"Blackcraig Substation"],["sf8eff23ca33",-2.26231,51.8371,33,0,"Tuffley Substation"],["s0cced1e5eba",-3.17843,55.14211,132,1,"Ewe Hill Wind Farm Substation"],["s7e1ef40d9cb",-3.60109,57.3172,33,2,null],["sa4a3a1e28a3",-3.79366,56.12661,33,0,null],["sed78d8c64e9",-2.70519,56.22362,33,0,"Anstruther Substation"],["sf79b754916e",-2.80499,56.32985,33,0,null],["s67b83bcc2ef",-2.56182,51.75438,33,0,"Princess Royal Substation"],["s9d2b0a08f13",-4.92295,57.15543,132,0,"Beinneun Wind Farm Substation"],["s4c6a301c2a2",-4.70336,57.24429,132,1,"Bhlaraidh Substation"],["s87dde570c27",-2.57802,51.85554,33,0,"Wyelands Substation"],["s483396a1a57",-2.59884,51.85448,33,0,"Stowfield Substation"],["s61f711f791a",-4.59472,55.51675,33,0,null],["s5f628c0c265",-4.87486,55.89822,33,0,null],["saa8f7b6e5f8",-2.55993,51.4116,33,0,"Whitchurch Substation"],["s94e258e4cce",-1.54755,52.28463,33,2,"Fords Car Park Substation"],["sc0abd041dfb",-1.53293,52.28314,33,0,"Wise Street Substation"],["sc4020c37913",-1.54033,52.27188,33,0,"Lockheed Substation"],["s6347632b8a7",-1.61116,52.26514,33,0,"Tournament Fields 33/11KV"],["sc58701071c0",-1.51235,52.4372,33,0,"Dunlop Substation"],["s6d88ba60624",-1.50719,52.43541,33,0,"Holbrook Lane"],["s4d243c2a54d",-1.49332,52.44969,33,0,"Coventry Arena Substation"],["see502eac65c",-1.57176,52.39917,33,0,"Torrington Avenue Substation"],["s0160e25b2b5",-1.50689,52.38816,33,0,"Dillotford Avenue Substation"],["s6259f694285",-1.40047,52.42986,33,0,"Ansty Substation"],["s55ef1925756",-1.51189,52.41754,33,0,"Sandy Lane Substation"],["s718971e4230",-1.50381,52.42451,33,0,"Courtaulds Substation"],["s9bc7a955076",-1.44367,52.50115,33,2,"Gipsy Lane Substation"],["s052c06e0284",-1.43647,52.52987,33,2,"Langdale Drive Substation"],["s134ecb98d1a",-0.17614,51.86854,33,0,"Knebworth Substation"],["s5c6f51f7581",-0.20689,51.89746,33,0,null],["s004879d2b86",-0.26236,51.95499,33,0,null],["sc5877548cb9",-0.67541,52.49842,33,0,"Corby Central"],["sa53da936ef3",-0.94577,52.21502,33,0,"Banbury Lane Substation"],["s9e98639672d",-0.95775,52.21753,33,0,"Pineham Substation"],["sf829c1e9c7e",-1.26148,52.86121,33,0,"Ratcliffe on Soar"],["s2d367bc2df0",-0.73377,51.27729,33,0,"Farnborough"],["sf98091fd11b",-0.75291,51.29342,33,0,"Queensmead Substation"],["s5b42c9e33d1",-0.75933,51.32817,132,0,"Camberley Substation"],["sc8ad78afdbd",-0.75947,51.32757,33,1,"Camberley Substation"],["s36b308b5a36",-0.74395,51.346,33,0,"Kings Ride Substation"],["s50a23f2b5ec",-0.78767,51.3723,33,0,"Crowthorne Substation"],["s657d810a88f",-0.76268,51.39714,33,0,"Easthampstead Substation"],["scda9f57c563",-0.47748,51.48034,33,0,"Bath Road West"],["sfb9a8d609e1",-0.51222,51.46929,33,0,"Poyle Substation"],["s80a0e0f021f",-0.47584,51.44388,33,0,"Stanwell Moor Substation"],["s5b0b8c9da64",-0.44138,51.45307,132,0,"East Bedfont Substation"],["s7a83a78baf5",-5.06874,54.91062,33,0,null],["s4ee264dbe67",-5.01313,54.89848,33,0,null],["s033af18a820",-5.08999,54.86461,33,0,null],["sc784fc10a69",-4.9433,54.75864,33,0,null],["scdda121c7ed",-5.26513,56.13186,132,2,"Crarae Substation"],["sa4026245c7f",-4.83033,56.08316,33,3,null],["s7e34a0afd17",-4.5342,55.82579,33,0,null],["sc75fab3bf96",-4.62036,55.89837,33,0,"Kilmalcolm Primary"],["sb493c6fa168",-4.57799,55.86685,33,0,"Girthill Primary"],["s526a8a2b637",-3.82238,54.93093,33,0,null],["s8bed66b968a",-0.76051,52.26251,33,0,"Earls Barton Substation"],["s6f71f40b02e",-2.7634,55.71856,33,0,null],["s218f4aa61d3",-2.82118,55.62493,33,0,null],["sc09d5ba656f",-2.78561,55.6075,33,0,null],["sc44395153b1",-2.83772,55.55595,33,0,null],["s0a662213661",-3.52425,55.62197,33,0,null],["s4f5be4a99a2",-3.44359,55.54361,33,0,null],["s2352d1b8f81",-0.60465,52.20627,33,0,"Harrold Substation"],["s34ef58bb74f",-0.66515,52.25984,33,0,"Irchester Road Substation"],["s9648e262922",-0.56533,52.22815,33,0,"Sharnbrook Substation"],["s7825767bb09",-0.89669,52.2428,33,0,"Campbell Street Substation"],["s119c594154d",-0.85138,52.25165,33,0,"Wellingborough Road Substation"],["sf3a8ead1618",-0.93151,52.24168,33,0,"Ellesmere Avenue Substation"],["s9584893d9de",-0.9137,52.24541,132,1,"Northampton West Substation"],["sd50c5a1339c",-0.8581,52.27135,33,0,"Boothville Substation"],["s96f59984a70",-0.86834,52.24961,33,0,"Abington Substation"],["s6e722d5ef65",-0.79926,52.1202,33,0,"Littlewood Farm Solar"],["sa9286d627e9",-0.80571,52.10631,33,0,"Hanslope Park"],["sb27500a0836",-0.75671,51.9803,33,0,"Bletchley Landfill Substation"],["s296aa68fd41",-0.79549,51.99995,33,2,"Tattenhoe Primary Substation"],["s58f8e7d4eb6",-2.09211,54.97711,66,0,"Hexham"],["s1c332332eda",-2.33148,55.77697,33,0,null],["s3e73e59815d",-2.12813,55.83828,33,0,null],["s5debf88ff43",-2.48662,55.90814,132,1,"Aikengall II Wind Farm Substation"],["sc93b884e16c",-2.52903,56.77031,33,0,null],["sb4d44dd6406",-2.47178,56.72242,33,0,"Montrose North Substation"],["sf302f022cbe",-2.72246,56.50856,33,0,"Carnoustie"],["sfd8f8f15d2f",-2.23344,56.96179,33,0,null],["sccb115e81a6",-2.79277,57.07708,33,0,null],["sf65e96891f0",-2.78893,57.4408,33,0,null],["sd50a9501ec8",-2.84987,57.45199,275,0,"Cairnford Substation"],["sa54c3abdc24",-2.87694,57.48011,33,0,null],["sa534425d647",-2.80163,57.5438,33,0,null],["s17f51a9cb7e",-2.63744,57.56547,33,0,null],["s4638120c4ee",-2.95232,57.66953,33,0,null],["s48df9c44094",-3.10945,57.62155,33,0,"Fochabers Primary Substation"],["s0e48bdbde3c",-2.44603,57.24118,33,0,null],["s12c0927487b",-2.07672,57.36086,33,0,null],["s785c9816b9a",-3.20866,57.63894,33,0,"Lhanbryde Primary Substation"],["sd988a2cf9aa",-3.30067,57.64247,33,0,"Ashgrove Primary Substation"],["s863d64bbb3b",-0.60382,53.84589,33,0,"Beverley Lane"],["s011e60d7780",-0.59914,53.84062,33,0,"Sober Hill"],["s8c303924059",-0.66133,53.86189,33,0,"Southgate"],["sef67606163a",-0.79625,53.80155,33,0,"Holme Upon Spalding Moor"],["s7b53455b3da",-3.82363,57.18026,33,0,null],["sc509371aeef",-4.05669,57.07787,33,0,null],["s652b78f0a17",-5.64304,57.68496,33,0,null],["s5bb8700973e",-4.57721,57.42874,33,0,"Aigas Substation"],["s5af7e7b6e04",-5.52611,57.40621,33,0,null],["s9b0960cd399",-5.43228,57.41621,33,0,null],["s1d296e8a8c4",-5.64741,57.50775,33,0,null],["sbe27fe49fba",-6.36736,57.5941,33,0,null],["s0468a773df3",-6.13741,57.35536,33,0,null],["s1ce0d1c23c5",-4.16994,57.69382,33,0,null],["sdcc82bb6bc8",-5.57004,56.69799,33,0,null],["sb0926cd11de",-5.242,56.45615,33,0,null],["s0b8b8378664",-5.31263,56.52746,33,0,"Barcaldine Primary Substation"],["saa144868125",-3.21441,55.94886,33,0,"William Street Primary"],["scec8ee31f21",-0.62366,51.48063,33,0,null],["s47fc290fe9d",0.20419,51.52074,33,0,"Rainham Substation"],["se02b709f6d6",-4.19678,53.22877,33,0,"Llanfair PG Substation"],["s45294335f84",-4.34336,53.37735,33,0,null],["s667da735c7c",-4.37196,53.25104,33,0,"Mona"],["se050835a5b4",-4.48248,53.22935,230,0,"Llanfaelog"],["s60599c292e5",0.61398,51.1696,33,0,"Headcorn Primary"],["s778a1b35299",-4.57951,52.84907,33,0,null],["sc048e8a7dcb",-4.49879,52.86887,33,0,null],["s3cae967758c",0.81149,51.05981,33,0,"Kenardington 33kV"],["s3c2b9d9cfe0",-3.51981,52.34102,66,0,"Bryn Titli Wind Farm Substation"],["s7b2757854d7",0.83616,51.06266,33,0,"Warehorne 33kV"],["s752b003a9c6",0.95863,50.99734,33,0,"Romney Warren 33kV"],["s16a6c7b6fee",-2.72975,51.80518,66,0,null],["sebc6384b00d",-2.92211,51.83265,66,0,null],["s70f50d7813d",1.00401,51.03576,33,0,"Dymchurch Primary 33kV"],["sd0e4ff6b3e4",-3.18185,51.61747,33,0,"Cwmfelinfach Primary Substation"],["s4580a6bfb0a",-4.23555,52.04716,33,0,"Llanllwni Substation"],["s09d8b073ea4",0.02171,50.88348,33,0,"Lewes Town Primary"],["s784bca05e9a",0.17264,50.85561,33,0,"Berwick inverter feed"],["sd402488d08e",-0.94129,53.0773,33,0,null],["sd7ea008b6a2",-1.46409,54.9736,33,0,"Simonside Primary"],["sc9714b7b90f",-1.92397,53.7088,132,1,"Sowerby Bridge"],["s35a2620ba55",-3.2628,58.52885,33,0,null],["s823df4bb724",0.28719,50.79836,33,0,"Hampden Park Primary"],["s76789176453",0.26478,50.7808,33,0,"Ocklynge Primary"],["se53f8de55df",0.24518,50.81692,33,0,"Polegate Town Primary"],["s97f65c2b7af",0.34064,50.81766,33,0,"Pevensey Bay Primary"],["s56170b0e7ac",1.42741,52.12997,33,0,null],["s74165c52cf9",-2.49149,52.33538,33,0,"High Point Solar PV Substation"],["s89c97041ca2",0.269,50.75838,33,0,"Meads Primary"],["s477dfb67580",0.10143,50.77449,33,0,"Seaford Primary"],["s4ff2babafc7",0.04943,50.80254,33,0,"Grid feed?"],["sa0ab4dc055c",-0.00916,50.79649,33,0,"Peacehaven Primary"],["s57d7f78b19c",-0.45232,52.6882,400,0,"Ryhall Substation"],["sb013c7889ad",0.23444,51.37999,33,0,"Farningham Primary"],["sc6a34bab018",-0.42069,51.48082,33,0,null],["s4e6f4478714",0.55005,50.88419,33,0,"Baldslow Primary"],["s602c028eb4c",-4.52514,52.11118,33,0,"Blaenporth Primary Substation"],["s0e07fb257cd",-1.93687,52.44432,132,4,"Selly Oak Transformer Station"],["s3f77dca2fa7",-1.80975,52.5098,132,2,"Dunlop Substation"],["s892b56a669f",-0.0769,51.58353,33,0,null],["s615ece85bc3",-1.6243,52.59181,33,0,"Birch Coppice Substation"],["sfa6924ea8b1",1.29225,52.39511,33,0,null],["s86806b43120",1.46938,52.20982,33,0,null],["sd937bbe17fa",1.43721,52.45303,33,0,null],["s9cb17891bff",1.66108,52.42231,33,0,null],["s317f5353d37",1.64673,52.34026,33,0,null],["se99b8c44319",1.12872,52.33469,33,0,"EPR Substation"],["s3191d4d69b5",0.51166,52.3539,33,0,null],["s4e1ee8cc144",1.27205,51.93491,33,0,"Dovercourt Substation"],["sf69e6bf09b1",0.96129,52.04514,33,0,null],["s0652e477ee9",1.31462,51.96552,33,0,null],["sab12fc692f6",1.555,52.1952,33,0,null],["sf240e42682c",0.19022,52.66102,132,2,"Walsoken Substation"],["s574737594fa",0.24457,52.62832,33,0,null],["s9b66de9ce6c",0.44531,52.55054,33,0,null],["s71313733c56",0.21756,52.73094,33,0,null],["sef02f848860",-0.06733,52.33484,33,0,null],["sdc6723ed652",0.52819,52.87472,33,0,null],["s5b2161ab10e",0.6586,52.78779,33,0,null],["s3fb382b4205",0.45,51.32644,33,0,"Townsend Hook Primary"],["s634b3cb0942",0.46081,51.30681,33,0,"Reeds Paper Mill Primary (Disused?)"],["s35e5572e55d",0.46713,51.30079,33,0,"Aylesford Primary"],["s1e1be1227e2",0.3363,51.30294,33,0,"Wrotham Primary"],["sa051177dc15",1.37654,52.63403,33,0,"Peachman Way Primary Substation"],["sea77b192aab",1.30502,52.91649,33,0,null],["s3609a242a75",1.51183,52.77365,33,0,"Stalham Primary Substation"],["s801193bb387",1.63609,52.70279,33,0,null],["s31a0967e9ea",1.68925,52.68091,33,0,null],["s3dc90f4b74b",-0.77419,53.39071,33,0,"Lea Road"],["s1006250d2c0",0.26113,52.02918,33,0,null],["s064da242824",0.2522,52.01844,33,0,null],["s9b1e1b5852a",0.3955,52.24226,33,0,null],["s006c3257c15",-0.39784,51.44987,750,0,"East Feltham DC Traction Substation"],["s123ed5fb063",0.49905,52.93676,33,0,null],["s2087f6eeaa5",-4.57687,56.88751,33,0,null],["scd54318bef3",0.25546,52.3979,33,0,null],["saecb3d0d6e7",-0.50774,53.54142,132,1,"SB Gen 3"],["s4cb14017ff9",-2.51316,51.34795,33,0,"Chelwood 33kV Solar Park"],["s4335eba0756",-7.27189,57.36443,33,0,null],["sc96ea1ea8c2",-7.36404,57.33637,33,0,null],["sba343603c99",-7.36865,57.1063,33,0,null],["s3438c0875aa",-7.32133,57.55694,33,0,null],["s301a7fe4893",-4.08531,50.3641,33,0,"Stentaway Substation"],["se70915f26bc",-4.06495,50.3888,33,0,"Linketty Lane Substation"],["s8e7843a7496",-2.41305,55.74746,33,0,null],["s2664255af61",-2.4598,55.8159,33,0,null],["sabced108f83",-2.46303,55.70838,33,0,null],["s367b2a0ccda",-2.55643,55.68443,33,0,null],["s1892f5e5c48",-0.18971,53.42766,33,0,"Kirkmond ISOL"],["s979d7c40a9f",-0.23762,53.4246,33,0,"STAINTON"],["sb7f51f6abab",-0.12489,53.39033,33,0,"Kelstern Grange"],["sc06389cebf7",-0.12269,53.39044,33,0,"Kelstern LSI"],["s47cee80189c",-0.12252,53.38492,33,0,"Calcethorpe"],["sd3f9c5703f8",-0.75587,53.38681,33,0,"Foxby Lane"],["s4aeeff03f22",-0.72755,53.36384,33,0,"Knaith Upton Road"],["sceeb03e221b",-0.24741,53.65482,33,0,"Clough Lane"],["s5a9cdd94e1a",-5.81904,54.86402,33,0,"Larne North 33kV Substation"],["sf8ba96df19b",-2.51681,51.47055,33,0,"Woodland Way Substation"],["s7eaffd5508b",-5.8809,57.23262,33,0,null],["s9fa3d12d806",-6.01034,56.37227,33,0,"Kinloch"],["s42e04d82f9f",-5.68604,56.44433,33,0,"Lochdonhead"],["sc6e3adc2e09",-6.1214,55.84344,33,0,null],["s98d40d185cc",0.18099,51.52221,33,0,null],["sbd2ff2b97f9",-4.06181,57.80622,33,0,null],["s47af8491436",-3.53666,58.58549,33,0,null],["s58faae3dd1b",-6.25184,54.10879,33,0,"Warrenpoint 33kV Substation"],["se1701475368",-3.20221,58.43809,33,0,null],["sad89e9380b1",-3.2508,58.44937,33,0,null],["sba1a6023de9",-4.22073,58.52358,33,0,null],["s3813cd4f4a9",-4.36658,58.50251,33,0,null],["s2f91420b6cf",-3.49033,58.50348,33,0,null],["s6e7dc6d14c3",-1.61446,54.9656,66,0,"Close"],["sff60d382d66",-2.90232,59.03821,33,0,null],["s5f215e9b796",-2.92192,58.89652,33,0,null],["se6b7e605b89",-3.28926,58.97441,33,0,"Electricity Distribution Centre"],["sb673ed16aee",-2.87439,59.23832,33,0,null],["s04a56c213f2",-2.76585,59.18527,33,0,null],["s988f750e91d",-2.68145,59.20699,33,0,null],["sf51bd066abc",-2.62112,59.12847,33,0,null],["s65513b88015",-2.96376,58.98293,33,0,null],["s45342fda6af",-6.40705,54.43594,33,0,null],["s8ae14065834",-3.04716,52.57589,33,0,"Priestweston Substation"],["s7faccd73a9b",-1.72102,54.41133,33,0,"Richmond"],["sea8ebfd9b86",-1.27223,60.4555,33,0,null],["sf3278f71a68",-1.22897,60.01618,33,0,null],["s42a97b10994",-1.39944,60.26314,33,0,null],["s37b53356624",-1.30463,59.89806,33,0,null],["s98dbbad7d75",-0.82629,60.79854,33,0,null],["s63257b94bcc",-2.48383,52.69401,132,2,"Ketley Substation"],["s157a6232395",0.44538,51.35998,33,0,"Halling 33/11KV"],["s98b083a2e39",0.4109,51.38364,33,0,"Cobhambury Switching station"],["s525ccb7e8aa",0.40438,51.39055,33,0,"Cobham Primary"],["s8e4e5b6f467",0.40228,51.40389,33,0,"Shornewood Switching Station"],["sdb0d8bac624",-4.89156,50.50663,33,0,null],["s6560c3d6bcf",-0.33194,51.42359,750,0,"Teddington DC Traction Substation"],["s6f4f4184f74",0.57121,51.43927,33,0,"Sharnal Street Primary"],["sdde3c9950e4",-5.67405,50.14816,33,0,"Geevor Substation"],["sf12ab831b42",-5.54915,50.08393,33,0,"Mousehole Substation"],["s53f1bfd48b6",-5.20894,50.02127,33,0,"Mullion Substation"],["s6a651c1d7a1",-4.91964,50.43754,33,0,null],["s1d41c8f4e95",-3.87532,51.02238,33,0,"Aaronsons Substation"],["s4605e61a2de",-0.65842,53.62461,33,0,"Bagmoor WF"],["s4150bcedf36",-4.26483,50.90799,132,0,"Galsworthy Wind Farm Substation"],["s187e5626dd4",-2.94138,52.70101,33,0,"Rowton Substation"],["s437c6bbb29b",0.51465,51.37738,33,0,"West Chatham Primary"],["s3b67f1070f4",-5.15539,50.32143,33,0,"Perranporth Substation"],["s2673020bc33",-5.19997,50.29673,33,0,"St Agnes Substation"],["sef9b317af57",-5.05719,50.41266,33,0,"Newquay Trencreek Lane Substation"],["sfa464bce130",-5.03604,50.35233,33,0,null],["s7a3305ae382",-5.07075,50.3971,33,0,"Newquay Trevemper Substation"],["s252990273a5",0.57815,51.36293,33,0,"Rainham Mark Primary"],["sd9274b2df8d",-4.1501,51.11476,33,0,"Braunton"],["s47519ed4472",-3.56356,51.13736,33,0,"Luckwell Bridge Substation"],["s891358cd3a9",-3.49731,51.20009,33,0,"Periton Substation"],["s0b7ab0166ac",-3.46511,51.19944,33,0,"Alcombe Substation"],["s7db37840f88",-4.06289,51.07953,33,2,"Barnstaple Quay Substation"],["s554b8fc768e",-3.84851,51.2213,33,0,"Lynton Substation"],["s982ed8c60e8",0.59746,51.3601,33,0,"Rainham Primary"],["s1b1eeee06ca",-3.6822,50.34737,33,0,null],["s6ac28308c8e",-3.68234,50.27476,33,0,"Stokenham Substation"],["s9403a410e29",-3.60254,50.34784,33,0,"Dartmouth Substation"],["sc8a49792844",-3.56596,50.40241,33,0,"Churston Substation"],["s2a65c585a24",0.91148,51.31258,33,0,"Faversham Primary"],["s0597307ab80",-4.55091,50.47811,33,0,"St Neot Substation"],["se29092a2ed4",-4.41216,50.50745,33,0,"Pensilva Substation"],["sb26bcbb32c8",-3.48042,50.57878,33,0,"Dawlish Substation"],["s557089f1cda",0.51862,51.27694,33,0,"Waterside Primary"],["sb28a679ca58",0.48813,51.26512,33,0,"Barming Primary"],["s9cce878bef4",-3.28997,55.92336,33,2,null],["s45e7a2dc1df",-3.07467,56.20287,132,3,null],["s4930ab44d54",-2.94486,50.98674,33,0,null],["scb4c3dad002",-2.3784,52.66552,33,0,"Shifnal Substation"],["s961eaf2c083",-1.54926,53.78705,33,0,"Holbeck Primary"],["s4b58deb6a29",-3.05651,50.72893,33,0,"Colyford Substation"],["s915ba0f9804",-1.77885,51.06315,33,0,null],["s1074f35f060",-0.61629,53.59361,33,0,"Firth brown"],["sc51da710a7c",-0.6509,53.60276,33,2,null],["s21c3842b2a6",-0.62206,53.57531,33,0,null],["s3e185e23729",-2.19142,51.42492,33,0,null],["s2647552eab2",-0.70034,53.62248,33,0,null],["s9647d39992e",-0.62753,53.63584,33,0,"Roxby"],["s970b85f4f5d",-0.19216,53.61567,33,0,null],["s237ffda9c93",-0.17766,53.61643,33,2,null],["s29aa1eb8b25",-0.17009,53.47891,33,0,null],["se18a456227c",-1.31655,53.30889,33,0,"Westhorpe Substation"],["s801225b2ca4",-2.76163,52.67629,33,0,"Bayston Hill Substation"],["scbb47018c93",-2.72879,52.73864,33,0,"Harlescott Substation"],["s10e2ee3d19c",-1.77279,52.19616,66,0,"Drayton Farm North Substation"],["s97e354e7fa4",-2.56175,51.52176,33,0,"Patchway Substation"],["s4ed23083d44",-2.69676,51.50481,33,0,"Avonmouth Substation"],["s519404f45df",-2.65023,51.54868,33,0,"Western Approach Substation"],["s2ea8846189c",-2.90866,51.56484,400,2,"Whitson Substation"],["sf4b8c3125a7",-2.66665,51.54067,132,3,null],["s5e074a50e68",-2.68402,51.51119,33,0,"Kingsweston Substation"],["sc569e6cd3c4",-3.17505,51.79617,33,0,"Brynmawr Primary Substation"],["sc6ed1821bf4",-3.53459,51.50024,132,3,"Waterton Industrial Primary Substation"],["se3492ccf842",-1.51152,51.41882,33,0,"Hungerford"],["s50ea3b3c277",-0.30023,51.58629,33,0,null],["s1852d6012be",-3.3197,51.52548,33,0,"Creigiau Primary Substation"],["sc6a3361c614",-0.24079,51.34584,750,0,"Ewell East DC Traction Substation"],["sea8464a82e5",-3.24816,56.06615,33,0,null],["sb3e0a0ee855",-1.45799,52.55226,33,0,"Wood Lane Substation"],["sebd3019acaf",-2.68505,53.69609,33,0,"Bow Lane Substation"],["s3cb473aa023",-1.72901,54.37489,33,0,"Catterick Camp"],["s26c5a6a3be0",-2.66187,53.73466,33,0,"Bamber Bridge Substation"],["s4f52b9ee187",-2.69957,53.72892,33,0,"Tardy Gate Substation"],["s00c3ea574bf",-2.72454,53.75663,33,0,"Holme Road Substation"],["se2ec39363ba",-2.65652,53.68662,33,0,"Buckshaw Substation"],["s266b68ebd54",-2.63817,53.74002,33,0,"Higher Walton Substation"],["sf024c68c113",-2.72606,53.7011,33,3,"Moss Side Leyland Substation"],["s455950c8aee",-2.71852,53.68919,33,0,"Seven Stars Substation"],["s9d5f12046a4",-2.98544,53.45651,132,0,"Bootle Substation"],["sab78fbd8e51",-2.92684,53.41136,132,0,"Edge Lane Substation"],["s0ad983573cc",-2.86068,53.4232,132,0,"Huyton Substation"],["sa6d88171a37",-3.06806,53.37274,132,0,null],["s1bee5c365ee",-1.75313,53.78281,33,0,"Spring Mill Street"],["s0debe0f9d91",0.15428,51.50479,132,0,null],["sb1212791602",-0.16713,53.84842,66,0,"Withernwick WF"],["s320e4b7c2f7",-0.32681,53.75608,132,1,"Cornwall Street"],["sdf79d5f0dab",-0.22647,52.94485,400,0,"Triton Knoll Wind Farm Substation"],["sd0a3cb1d135",-0.25029,51.3495,33,0,null],["sb02709cf2ef",-1.24199,53.70637,33,0,null],["s5054ca4f2c6",-1.68226,51.22753,33,0,null],["se986d6d23a6",-1.51921,51.09798,132,1,null],["sb12bfd5570f",-1.09469,51.48102,33,0,null],["s9c4511a6491",-1.75527,51.16843,33,0,"Boscombe Down Primary Substation"],["see11b59bbd2",-0.38179,53.00017,132,2,"Sleaford REP Substation"],["s38f8a32da2f",-2.42575,53.10624,132,0,"Coppenhall Substation"],["sc25ca66ccaf",-0.10265,51.46736,750,0,"Loughborough Junction DC Traction Substation"],["sbc86c01ee7c",-2.40922,53.16728,132,1,"Elworth Substation"],["s0c0fcb24df6",-2.4237,53.53024,33,0,null],["s3683ce9df80",-1.36698,53.41635,33,0,"Fullerton Road"],["sc98d10e49c9",-1.38663,53.41112,33,0,"BOC Brinsworth"],["sa649b923480",-1.38158,53.41771,33,0,"Templeborough"],["s58034d1a68b",-1.36835,53.35926,33,0,"Revill Lane"],["s23f7da6bc8e",-1.48488,53.32524,33,0,"Greenhill"],["s89b4c33c405",-1.52432,53.32026,33,0,"Baslow Road"],["s7dd29ba6ab8",-1.58744,53.48379,66,0,"Fox Ford Lane"],["s480485bc19d",-1.5898,53.47947,66,0,"Wheatacre Road"],["s92cd005b2a8",-1.75402,53.33907,66,0,"Hope Cement"],["s032071a2a03",-1.49012,53.38713,33,0,"Crookesmoore Road"],["sc14e5a4243f",-1.49558,53.41126,33,0,"Rawson Spring Road"],["s1906eb502bd",-1.50307,53.41737,33,0,"Clay wheels Lane"],["sc81ab82ae38",-1.4067,53.40293,33,0,"Shepcote Tinsley"],["saef2078a217",-1.12377,53.50211,33,0,"Balby Generation"],["sd9cd4b8738c",-1.47938,53.33955,33,0,"Woodseats"],["sc74fd7eb847",-1.4951,53.34571,33,0,"Millhouses"],["sfa0c200ef2c",-2.16477,53.90907,33,0,"Salterforth"],["sdbebd8cf47d",-3.20647,55.97507,33,0,"East Trinity Road"],["s84e9ef98830",-5.91755,54.68532,33,0,"Monkstown 33 kV Substation"],["s41b88854fec",-1.50809,53.66447,33,0,"Denby Dale Road"],["sb748ca29cd7",-0.59374,53.55934,33,0,"Mortal Ash Raventhorpe"],["s607ce3a8d69",-0.6724,53.61183,33,0,"Atkinsons Warren"],["sf24acbd3280",-2.24975,52.63721,33,0,"Albrighton Substation"],["s8511db533d5",1.32438,51.37523,33,0,"Westgate"],["sc2ef5242952",-2.20788,52.32656,66,0,"Hartlebury EFW"],["s935290dd423",-1.61153,54.74545,66,0,"Meadowfield"],["s273f58dfd5a",-1.58453,51.20939,33,0,null],["s6b317439fef",-0.06516,53.69792,33,0,null],["sdf24caa7412",-0.06941,53.69885,33,0,null],["sb46f3b21395",-4.46952,55.3191,132,1,"Dersalloch"],["s67233ccff63",0.15653,51.84785,33,0,"Thorley Substation"],["s1470e821ef9",-2.11404,52.58119,132,1,"Wolverhampton Substation"],["sc28895803bf",-2.25518,52.85265,33,0,"Eccleshall Primary"],["sacf4c854676",-2.03283,53.10195,33,0,"Leek Substation"],["se7d4d178e32",-2.7259,52.74265,33,0,"Battlefield Energy Recovery Facility Substation"],["s12cfbeb61b1",-2.70939,52.73286,33,0,"Sundorne Solar Farm Substation"],["s6d98b6e1058",-2.57851,52.70329,33,0,"Wrockwardine Solar Farm Substation"],["s616c1e14572",-2.53442,52.71666,33,0,"Dothill Substation"],["s4885a1a561a",-2.44226,52.68864,33,0,"Snedshill Substation"],["scc597829e63",-2.37424,52.70959,33,0,"Sheriffhales Solar Farm"],["se6bdcdd3ec9",-2.39485,52.76475,33,0,"Newport Substation"],["s5924e4dcfcb",-2.45357,52.65074,33,0,"Madeley Substation"],["sdad7e7b8eb7",-3.70342,55.85868,33,0,null],["s8b349cb606a",-1.47852,55.02585,132,1,"Chirton Grange"],["s22a1b7b2b5a",-2.65557,51.32493,33,0,"Compton Martin Primary Substation"],["s62e70fc9451",-2.71674,51.41647,33,0,"Stancombe Quarry Primary Substation"],["s496456fdc71",-0.1689,51.23399,750,0,"Redhill A DC Traction Substation"],["s078e1dadfce",-1.13256,52.94875,33,0,"Sneinton Substation"],["sb8d7c7c4cbc",-1.12934,52.30499,33,0,null],["s72d29be189a",-1.42996,53.0156,33,0,"Denby Substation"],["sfb31860ab7d",-1.47703,53.01554,33,0,"Belper Substation"],["s02608b5d20f",-1.40654,53.0575,33,0,"Ripley Primary Substation"],["sf7e46a33ccc",-1.95336,52.47341,132,1,"Chad Valley Substation"],["se1907c83178",-2.90632,52.79554,33,0,"Express Foods Substation"],["s7fe80061af3",-2.85778,52.80532,33,0,"Baschurch Substation"],["sa6e594abd50",-2.97415,52.83063,33,0,"West Felton Substation"],["s8799093771b",-3.00886,52.92844,33,0,"Ifton"],["sace09a406a4",-3.51444,52.57029,132,0,null],["s34bfabc0daa",-0.73513,52.42493,33,0,"Kettering North Substation"],["scf78e68017c",-0.65011,52.51663,33,0,"Rockingham Data Centre Substation"],["sf38b397f7df",-0.6969,52.51085,33,0,"Earlstrees Substation"],["s141de9e5bfa",0.94973,51.10607,33,0,"Smeeth Primary"],["s555c82f4a80",0.74442,51.14747,33,0,"Ashford West Primary"],["sdea5ccb7e91",0.71303,51.22804,33,0,"East Lenham Solar Farm"],["scc9a627ea74",-1.3194,53.69865,33,0,"Prince of Wales"],["s5de948b1fa6",-4.04341,57.76176,33,0,null],["sceccb27aaf4",-3.23651,55.9444,33,1,"Roseburn Primary"],["s2ec8cb11c03",-4.69335,55.35303,33,0,null],["sb100f85171e",-5.00568,55.02226,132,0,"Glen App Wind Farm Substation"],["sf09c04c5335",-4.8309,55.15217,33,0,null],["s8befea3c933",1.02398,51.25653,33,0,null],["se9a08764b9e",1.3465,51.29177,33,0,"Pfizers"],["s02d61daf86b",-1.8563,53.69656,33,0,null],["s254d36d1d3d",-1.97872,53.89594,33,0,"Crosshills"],["sa52662d05b6",-2.00326,53.95744,33,0,null],["s34f97149ae1",-1.83805,53.59582,33,0,null],["sd8ee0fde020",-1.85059,54.30799,33,0,"Wensleydale"],["s81e6d114741",-4.06065,52.54505,33,0,null],["sebc5f0b0f4d",-1.39174,51.36606,33,0,null],["s7b97ffcd0d1",-1.25534,51.3312,33,0,null],["s85d0455959b",-0.9585,51.73781,33,0,null],["sab9934b2b57",-1.24269,50.85918,33,0,"Plessey Titchfield Substation"],["sad62d1713a2",-3.22553,50.97855,33,0,"Wellington Town Substation"],["s3c53034181b",-3.49405,50.67579,33,0,"Exminster Substation"],["s63e36411a5a",-3.4113,50.71222,33,0,null],["s6feabba729a",0.91069,51.81445,33,0,null],["s06e56c5e131",0.86492,51.86977,33,0,"Shrub End Primary Substation"],["s746df16f658",-2.23842,51.74015,33,0,"Dudbridge Substation"],["s3a8c8aeba2e",-2.14977,51.63989,33,0,null],["s9a0c9a73a86",-1.99361,51.45117,33,0,null],["s3d105f324f4",-2.22281,51.55522,33,0,null],["s4cf8fa9a364",-1.54507,51.93863,33,0,null],["scdbd576ee82",-1.14181,51.97536,33,0,"Cottisford"],["s39c2bbe9d5d",-1.72244,51.8745,33,0,null],["s5a1e1d2eb7f",-1.62886,51.81063,33,0,null],["sfb90c97a3f1",-4.11954,51.78982,33,0,"Tumble Primary Substation"],["scde801956ed",-1.2286,51.46543,33,0,"Yattendon"],["s62b3ec8a9da",-3.2401,51.5924,132,1,"Energlyn Grid Substation"],["s49336a6f9d4",-0.43707,51.76418,33,0,null],["s625abd862d2",-0.42614,51.75312,33,0,null],["s39aaed0fe19",-0.60546,51.35957,33,0,null],["s5595dd430bd",-0.54813,51.43243,33,0,"Egham Substation"],["s8fac3436b2d",-0.59097,51.38425,33,0,null],["sd2c78b73c77",-0.653,51.3994,33,0,null],["se27ae449c97",-0.50391,51.43513,33,0,null],["s5fb6b160f4d",-0.46442,51.43432,33,0,null],["sdfad836f388",-0.97084,51.46144,33,0,null],["se7abe46fda4",-1.06976,51.43443,33,0,"Theale Substation"],["s5e2ca0d7eea",-3.16384,51.47793,132,3,"Cardiff Central Grid Substation"],["sb3a4dc9cf90",-4.64832,50.34081,33,0,null],["s84ac205b845",-4.76178,50.37457,33,0,null],["s6b3bc76c040",-4.78936,50.34978,33,0,"St Austell Substation"],["s4cdd06f4dfb",-5.38501,50.17803,33,0,null],["s92610842b90",-1.36476,53.72541,33,0,"Wellington Street"],["sf4691b48534",-4.89087,50.37736,132,1,"Cornwall Energy Recovery Centre Substation"],["sf8033ccbc93",-1.03246,53.82592,33,0,"Riccal"],["s1b351aa7fa8",-1.08323,53.85685,33,0,"STILLINGFLEET"],["sd927241572a",-0.99246,53.814,33,0,"WHITEMOOR"],["s0a626c0e4e9",-1.15749,53.77753,132,2,"Hambleton Crossing"],["sc23809d998e",1.06343,51.95669,33,0,null],["s0a17d972162",0.68418,51.73836,33,0,"Maldon Causeway Substation"],["s5e0603d73e6",0.86889,51.68959,33,0,"Tillingham Substation"],["se51fbf326e1",0.59488,51.65107,33,0,"South Woodham Substation"],["sc652b89e245",-4.25681,52.23329,33,0,"Aberaeron substation"],["s335c3743c07",0.537,51.76565,400,1,"Bull's Lodge Substation"],["seecc224dcc1",-0.3231,52.03297,33,0,null],["s2deb4a605bb",-0.20642,51.98384,33,0,null],["saa48fd79836",-1.12767,52.64439,33,0,"Lero Substation"],["s55ebc50038c",-0.22517,51.8269,33,0,null],["s5b799c8e202",-0.87429,52.20534,33,0,null],["s544170be081",-1.04565,52.35443,33,0,null],["s68f8b889612",-2.91609,53.01407,33,1,null],["sb0eb4a3ea55",-3.41391,51.63347,33,0,"Wattstown Primary Substation"],["sf217134ff6c",-3.31288,51.69966,33,0,"Nantwen Primary Substation"],["saac5ca7c3b1",-3.26613,51.74327,400,0,"Abertysswg Primary Substation"],["s2b76fbba087",-3.29461,51.64579,33,0,"Nelson Primary Substation"],["se0796a222a1",-3.45365,51.71333,33,0,"Aberdare Primary Substation"],["s354aeaef1c8",-3.85403,51.71815,33,0,"Pontardawe Primary Substation"],["sc21807fd081",-3.86829,51.78902,33,0,"Gwaun Cae Gurwen Primary Substation"],["s91800abe884",-4.02754,52.30734,33,0,null],["s8361216ace6",-4.15892,52.17648,400,0,"Llanfihangel Ystrad Substation"],["sc9aa9bf34df",-3.93692,52.21453,33,0,"Tregaron Substation"],["s006157b0887",-4.97683,51.79188,33,0,"Merlins Bridge Primary Substation"],["s14306c8d773",-4.95928,51.63935,33,0,"St Twynells Primary Substation"],["se365acc6b83",-4.96484,51.71732,33,0,"Neyland Primary Substation"],["s159695dd29e",-0.35125,53.67097,33,0,"Goxhill Road"],["sfb2b27f5efa",-0.28954,53.62998,33,0,"West Middlemere Rd"],["sadaf23bc9a6",-3.49846,53.27116,33,0,null],["sbc076095832",-0.41736,53.73531,33,0,"Elgar Road"],["s5e8bd99c28c",-4.07532,51.7858,33,0,"Cross Hands Primary Substation"],["sa113f4dff60",-4.24302,51.76915,33,0,"Meinciau Primary Substation"],["sc192802bf5d",-0.10921,51.70787,33,0,null],["s735509604aa",-4.28978,51.74287,33,2,"Kidwelly Primary Substation"],["sfb042a40dc6",-4.26336,51.72673,33,0,"Ffos Las PV Generation Substation"],["s2ad7e15e4b4",-3.03871,56.19773,33,0,null],["sc3664522cda",-4.13119,53.21632,33,0,null],["sf483e402028",-4.29929,51.83407,33,0,"Cwmffrwd Primary Substation"],["sb87a826c36a",-2.66907,51.62109,33,0,"Newhouse Substation"],["sfc83cff2110",-3.8517,51.64952,33,0,"Llandarcy Primary Substation"],["se4bf9b14738",-3.80823,51.66212,33,0,"Commercial St Neath Primary Substation"],["sbb08ffccfef",-3.46365,51.40635,33,0,"Boverton Primary Substation"],["s1bb68357d8c",-3.44694,51.46261,33,0,"Cowbridge Primary Substation"],["sdc642823db0",-3.53551,51.49476,132,1,"Ford Bridgend Substation"],["sb1e965ef30c",-2.68899,52.36838,33,0,"Rock Farm ESS Substation"],["s174a19f4f58",-5.45013,55.96988,110,0,null],["sa7320dd4e17",-5.42115,55.86177,110,0,null],["sa1cf83bfde9",-5.63803,55.68902,110,0,null],["s51a2843d9eb",-5.5426,56.07302,110,0,null],["sc20668d2ddc",-5.09265,56.68247,33,0,null],["sc6d13331fbf",-0.48809,50.95234,33,0,null],["s45c1526c489",-1.26107,53.07064,33,0,"Sherwood Park"],["s288f565ab32",0.24503,51.45986,132,1,"Littlebrook 132kV Substation"],["s9418e44f8b3",-2.96708,51.56639,33,7,"Traston Road Stor Gen"],["s5257b62d64d",-2.91074,50.97456,33,0,"Bradon Farm Gen"],["s05ade3230fc",-3.26935,51.56305,132,2,"Nantgarw Primary Substation"],["s842fe42917b",-3.21637,51.57761,400,0,"Caerphilly Primary Substation"],["se308e2d6b8d",-3.1076,51.5293,33,0,"St Mellons Primary Substation"],["sf469cd3d4bc",-3.0779,51.59887,66,0,"Rogerstone Primary Substation"],["s3ace1d00947",-2.94411,51.58668,33,0,"Ringland Newport Primary Substation"],["seb6bf6ffdb5",-3.30825,51.48344,33,0,"Morlanga Primary Substation"],["se36f9c4b705",-3.19203,51.46394,132,3,"Grangetown Primary Substation"],["sa4c633b9611",-3.1385,51.47349,132,2,"Rover Way Primary Substation"],["s11adc9f73d3",-3.18141,51.49651,33,2,"Crwys Road Primary Substation"],["sbadef411c07",-3.2005,51.44599,33,0,"Llandough Primary Substation"],["s8c7b7bdf8c6",-3.19856,51.50691,33,0,"Heath Primary Substation"],["s1b783b12d12",-3.19986,51.52612,33,2,"Birchgrove Primary Substation"],["s8d676cb9162",-3.21716,51.51745,400,2,"Ashgrove Primary Substation"],["sb2304f7e86b",-3.22386,51.48334,33,0,"Papermill Road Ely Primary Substation"],["s3554b0d865d",-3.20421,51.48479,33,0,"Canton Primary Substation"],["sc357f7f3d7c",-3.16169,51.51804,33,2,"Cyncoed Primary Substation"],["s9b8f502b097",-3.20526,51.53148,33,0,"Llanishen Primary Substation"],["sad7c4c3f5f8",-3.28602,51.39487,33,0,"Ship Hill Barry Primary Substation"],["scbe4552bf29",-3.27267,51.40328,33,0,"Broad St Barry Primary Substation"],["s19585992b78",-3.26181,51.41051,33,0,"Court Road Primary Substation"],["s4ff098f04cc",-3.18686,51.43066,33,0,"Penarth Primary Substation"],["s880cf35a660",-3.33912,51.60368,33,0,"Gas Yard Primary Substation"],["sb40ca2c597a",-3.24276,51.49305,33,0,"Fairwater Primary Substation"],["sd619b4cb193",-2.84471,51.58162,132,2,"Magor Primary Substation"],["s9c7401b9f50",-2.75431,51.58896,33,3,"Caldicot Substation"],["se5207e849a7",-3.60242,51.48077,33,0,"Schwyll Primary Substation"],["s1af48e2d8bd",-3.59975,51.51273,33,0,"Llangewydd Primary Substation"],["s4f465a47003",-3.57407,51.52351,33,0,"Litchard Primary Substation"],["s1798f70c76c",-3.79847,51.59359,33,0,"Victoria Road Substation"],["sd638dcca6f1",-3.77541,51.59693,33,0,"Ynys Street Primary Substation"],["sa4e0526a5ff",-3.70228,51.49099,33,0,"Nottage Primary Substation"],["se878b739bbf",-3.94069,51.62188,33,0,"Strand Swansea Substation"],["s9d3d1e6ee9c",-3.45499,51.62814,33,0,"Tonypandy Primary Substation"],["s1797f4dae2b",-3.43015,51.58213,400,0,"Mill St Tonyrefail Primary Substation"],["saef894f39dd",-3.56668,51.50313,33,0,"Bridgend Trading Estate Primary Substation"],["sce5bb681835",-3.39943,51.75196,33,0,"Swansea Road Merthyr Primary Substation"],["sa8ce5f8a4dd",-3.37487,51.67866,33,0,"Mountain Ash Primary Substation"],["s9f57df4d3b5",-3.18724,51.66163,33,0,"Pontllanffraith Primary Substation"],["s08462eacab9",-3.24164,51.77096,33,0,"Tredegar Primary Substation"],["s975bdcedc76",-3.94983,51.61745,33,0,"Gethin Street Swansea Primary Substation"],["s00526a09823",-3.92814,51.64043,33,0,"Upper Bank Primary Substation"],["s7b55e059e9c",-3.94514,51.66606,33,0,"Clase Primary Substation"],["sb40660038e4",-3.98947,51.646,33,3,"Swansea Trading Estate Primary Substation"],["s1437d42025c",-3.9719,51.64576,33,0,"Ravenhill Primary Substation"],["s2dbc76b909d",-4.03813,51.66839,33,0,"Lime Street Gorseinon Primary Substation"],["se760c3c254a",-4.0014,51.58783,33,0,"West Cross Primary Substation"],["sac2a501c20d",-3.9657,51.61761,33,0,"Uplands Swansea Primary Substation"],["s587bfe545bd",-4.05537,51.71205,33,0,"Hendy Primary Substation"],["s7ca09610f8e",-4.1272,51.67766,33,2,"Maesarddafen Primary Substation"],["sa816670e31c",-4.22646,51.75213,33,0,"Pontyates Primary Substation"],["s77491ac616c",-2.36451,51.36062,33,0,"Entry Hill Substation"],["s645564eb056",-2.5508,51.4683,33,0,"Eastville Substation"],["sce9f3464a86",-2.02785,52.53449,33,0,"Barton Abrasives Substation"],["sf08fbb3cbee",-1.88016,52.55538,132,1,"Kingstanding Substation"],["sdd46bd530f3",-1.91464,52.29589,66,0,"Ipsley Substation"],["s96fb95a9be9",-1.77009,51.92412,66,0,"Stow Substation"],["sc2ccdcad2eb",-2.2662,51.87165,132,5,"Port Ham Substation"],["s68f737defe7",-2.62152,52.05479,66,0,null],["s60f561b88a8",-2.80062,52.49185,33,0,"Henley Solar Farm Substation"],["sa935507490b",-4.96412,51.80254,33,0,"Haverfordwest Power Station Primary Substation"],["sfbfcb619790",-4.94951,51.85043,33,0,"Rudbaxton PV Farm Substation"],["sc26f0c72bd8",-4.9443,51.85519,33,0,"Withyhedges Landfill Substation"],["sfd3f8bdb2e9",-4.79409,51.67573,33,0,"Jordanston Farm PV Gen Substation"],["s54becc3cd0e",-2.56471,51.52685,132,1,"Rolls Royce Substation"],["sb0d8b8abc35",-2.68342,51.5203,33,0,"Rockingham Generation Station"],["sde5c95289ce",-2.70091,51.50395,33,0,"Avonmouth Docks Substation"],["see43157e985",-2.68805,51.51126,33,0,"Avonmouth Biogas Substation"],["s87d0848fd6c",-2.7232,51.49048,33,0,"West Dock Portbury Substation"],["sedff8e4a4cd",-2.66645,51.50649,33,2,"Lawrence Weston Solar Park Substation"],["s83e51f4e6b5",-2.49438,51.48618,33,0,"Mangotsfield Substation"],["sdb0db32c8db",-2.56151,51.50459,33,0,"Abbeywood Substation"],["s91cdb0c8d3c",-2.65969,51.54699,33,0,"Astra Zeneca Substation"],["s264a46c65b3",-2.59659,51.44167,33,0,"Bedminster Substation"],["sb6ce0157cf8",-2.60773,51.41492,33,0,"Bishopsworth Substation"],["s956f9bc9196",-2.67297,51.64157,33,0,"Chepstow Substation"],["sc7daa197471",-1.58469,52.57299,33,0,"Baddesley Energy Park Substation"],["s11ac63a1139",-1.46433,52.88411,132,1,null],["s85a4b61aa93",-1.44508,53.23304,132,1,"Goitside Substation"],["scb780899fe1",-1.58019,53.24357,33,0,"Robin Hood Substation"],["sbe5572cefea",-6.30963,49.91382,33,0,"Isles Of Scilly Primary Substation"],["s95c4ad65449",-3.10102,51.01714,33,0,"Taunton Local Substation"],["s0e74ec6f39a",-3.749,51.58545,33,0,"Mynydd Brombil Wind Farm Substation"],["s797968276ea",-3.76658,51.59992,33,0,"Pant y Moch Solar Farm Substation"],["s47b27081f77",-3.66459,51.50507,33,0,"Newton Down Wind Farm Substation"],["s9233e8d5d88",-3.67103,51.50827,33,0,"Cenin Energy Park 33Kv Sw Stn Substation"],["s7d0bec0b594",-3.66446,51.51168,33,0,"Stormy Down PV Generation Substation"],["sd1907acb539",-3.45372,51.56318,33,0,"St Peters Church Wind Farm Substation"],["s518413dd14b",-3.45758,51.56325,33,0,"Mynydd Portref Windfarm Substation"],["sb1a3de97ef6",-3.22459,51.80525,33,2,"Brecon Power STOR Substation"],["sb7f6e97d6ee",-3.45665,51.65326,33,0,"Ferndale Wind Farm Substation"],["se7e0e25376e",-3.69976,51.50695,33,0,"South Cornelly Substation"],["s8c32d19a578",-4.75387,50.40108,33,0,"Luxulyan Solar Park Substation"],["s2768e9a11dd",-4.71022,50.34341,33,0,"Par Harbour Substation"],["sc9d5ff98112",-5.14946,50.28861,33,0,"Four Burrows Blackdown Substation"],["s29b4b9ef217",-5.53926,50.1201,33,0,"Penzance Causewayhead Substation"],["s46dee64a738",-1.50734,52.42016,132,1,"Coventry Central Substation"],["s7332c4f6570",-1.46687,52.52127,33,0,"Coton Road Substation"],["s5443587623c",-0.10494,51.00007,33,0,"Haywards Heath Primary"],["sd588c03ce9c",-1.48091,52.75837,33,0,"Ashby de la Zouch Substation"],["s105cbc9f3e9",-1.49894,52.75261,33,0,"Prestop Fm Burton Rd Ashby Substation"],["s55636f3b7b8",-3.8218,56.01618,33,0,null],["sb595415a85a",1.04217,51.1084,33,0,"Stanford Primary"],["se0ceddad6c6",-2.19465,52.98638,33,0,"Substation 13"],["s8520fdabde4",-2.07719,53.54994,33,0,"Waterhead"],["s93c5745a68d",-3.86076,50.78473,33,0,"Den Brook Wind Farm Substation"],["s724dbfc06d9",-3.52296,50.7077,33,0,"Water Lane STOR Generation Substation"],["scdebf0d8f66",-3.49072,50.72051,33,0,"Heavitree Substation"],["sda3bcbb4a49",-3.49385,50.70144,33,2,"Countess Wear Substation"],["sc9224922501",-3.51422,50.69562,33,3,"Makro Exeter STOR Generator Substation"],["s826121d08da",-3.5462,50.7195,33,0,"St Thomas Substation"],["sbcdbe4eb452",-3.54163,50.73496,33,0,"Cowley Road Substation"],["s3d988670e04",-3.46442,50.68445,33,0,"Topsham Substation"],["s41c772ab07d",-4.08143,51.06316,33,0,"Roundswell Substation"],["s5aa43768353",-4.05337,51.06758,33,0,"Rock Park Substation"],["sd77d71e0ad6",-4.11218,51.06377,33,0,"Horsacott Solar Park Substation"],["sb5fa9d2ad84",-4.14581,51.06672,33,0,"Fremington Substation"],["s7d36f18b60e",-4.18962,50.42332,33,0,"Ernesettle B&S Substation"],["s5dc49f4bd4e",-4.18798,50.42125,33,0,"Ernesettle Lane STOR Substation"],["s5b60025bda5",-4.18715,50.42166,33,0,"Tamerton Bridge STOR Substation"],["s5d6bf52557f",1.09291,51.07293,33,0,"Hythe Main Primary"],["sf3682707852",-4.13682,50.38766,33,0,"Elim Terrace Substation"],["sfe4c129a5de",-4.08428,50.39272,33,0,"Longbridge Substation"],["s5aeb0d27235",-4.11188,50.40081,33,0,"Eggbuckland Substation"],["s3a7db94b1e1",-4.17195,50.3846,33,0,"St Levan Road Substation"],["s5437869670d",-4.18161,50.38628,33,0,"North Intake Substation"],["s39ba078eb81",-4.18065,50.37758,33,0,"Central Intake Substation"],["sec6c4b57a44",-4.16423,50.36791,33,0,"Newport Street Substation"],["s1d911805d15",-4.11981,50.38177,33,2,"Old Laira Road Substation"],["s6b6157b4367",-4.13526,50.37592,33,0,"Armada Street Substation"],["sea58f25a28d",-4.14874,50.36913,33,0,"Adelaide Road Substation"],["sf66032da467",-4.13802,50.3695,33,0,"Buckwell Street Substation"],["sa62e9443e1d",-4.17619,50.42716,33,3,"Warleigh Barton Solar Park Substation"],["s866ef7e3d86",-4.10137,50.35238,33,0,"Plymstock South Substation"],["se8ce174781f",-4.10071,50.37369,33,0,null],["s463ca555ae7",-4.03046,50.32876,33,0,"Newton Downs Solar Park Substation"],["s8d407c99302",-4.02511,50.4329,33,0,"Torycombe Substation"],["s228d1e35b4a",-4.01443,50.41338,33,0,"Hemerdon Mine Substation"],["s6f3395e49e0",-4.02891,50.40851,33,0,"Newnham Farm Solar Park Substation"],["s78c66e52032",-4.15458,50.38331,33,0,"Alma Road Substation"],["s18829e172a4",1.31076,51.12897,33,0,"Dover Primary"],["se0039b18138",-3.52429,50.38424,33,0,"Laywell Brixham Substation"],["sc52f276d2a8",-3.51601,50.54692,33,0,"Teignmouth Gasworks Substation"],["se57c081256e",-3.53649,50.48838,33,0,"Barton Substation"],["sb098873bd92",-3.52065,50.46119,33,0,"Torwood Substation"],["s15e7da31883",-3.55751,50.4532,33,0,"Hollicombe Substation"],["s3761e671264",-3.57082,50.43846,33,0,"Colley End Substation"],["s565f3e394c6",-3.68845,50.43343,33,0,"Totnes Substation"],["s8bfae51373b",-3.77812,50.23448,33,0,"Salcombe Substation"],["sdc25ac9cfa8",-3.89428,50.35123,33,0,"Modbury Substation"],["s94af812d87a",-2.95255,50.8132,33,0,"Axe View Solar Farm Substation"],["s31e326dbb4c",-4.21025,51.0417,33,0,"Northam Substation"],["s1511984f48a",-4.20711,51.02366,33,0,"Park Lane Substation"],["sf52c1a67138",-4.14149,51.14509,33,0,"West Hill Solar Farm Substation"],["s5f5764378d4",-4.17754,51.1511,33,0,"Georgeham Substation"],["s509dd34056c",-1.1988,54.01054,33,0,"Moor Monkton Pumps"],["se140c5b7feb",-3.34131,51.17781,33,0,"Wansbrough Paper Mills Substation"],["s37ef6311ed4",-2.95922,51.17249,33,0,"R.O.F. Power House Substation"],["s00163122c08",-3.00813,51.12918,33,0,"Bridgwater Local Substation"],["s68d10a7d7db",-4.26059,50.80635,33,0,"Dunsland Cross Wind Farm Substation"],["s19d51b4338c",-3.6913,50.98037,33,0,"Batsworthy Cross Wind Farm Substation"],["s13b126205c8",-3.86571,51.01865,33,0,"Kingsland Barton Solar Park Substation"],["sdddde5c48c0",-3.53151,50.58997,33,0,"Ashcombe Solar Park Substation"],["s35b1d737ff7",-5.2069,50.04005,33,0,"Goonhilly Solar Park Substation"],["see090d9ba02",-5.20285,50.04152,33,0,"Goonhilly Wind Farm Substation"],["sa9fbe08b450",-4.69167,50.42391,33,0,"Rew Farm Solar Park Substation"],["s7f12f0ec3d8",-4.32514,50.50914,33,0,"Haye Lane Solar Park Substation"],["se618fe42d9a",-4.36989,50.42531,33,0,"Trequite Solar Farm Substation"],["s75fb816db5b",-4.38026,50.43433,33,0,"Trehawke Farm Substation"],["s30eaa2f9f02",-2.09875,57.18245,33,0,"Bridge of Don Primary Substation"],["sa70f513fc28",-3.40584,50.6235,33,0,"Exmouth Works Substation"],["s135926ab742",-3.39387,50.63239,33,2,"Withycombe Raleigh Substation"],["s89d8bbf685e",-2.11295,52.63369,33,0,"Bushbury B 33kV"],["s1b795782bf1",-2.11701,52.67623,33,0,"Four Ashes Substation"],["s6f12bc38bc2",-1.56588,52.28578,33,3,"Warwick Substation 33kV"],["s249a6d791e8",-0.25887,51.34753,750,0,"Ewell West DC Traction Substation"],["s6dcbfa109a8",-2.3804,51.92867,66,0,"Newent 66kV"],["s5eda18e2933",-3.27525,51.67264,33,0,"Hendai Solar Farm Substation"],["s7dcb4388b51",-3.15932,51.67453,33,2,"Crumlin STOR Substation"],["s5a88d76d718",-3.16742,51.62289,33,0,"Hill Solar Farm Substation"],["s05b7d77d08d",-3.16293,51.63807,33,0,"Cwm Cae Singrug Solar Park Substation"],["sac76ac9dbae",-3.15973,51.72617,33,0,"Hafod-Y-Dafal Solar Park Substation"],["s603939d92a1",-4.79671,51.74731,33,0,"Yerbeston Solar Farm Substation"],["s6904430aa99",-1.27155,52.63942,33,0,"Desford Substation"],["sd2bfd28bf0c",-1.3214,52.6421,33,0,"Lindridge Farm Solar Park Substation"],["sc6df6988dcf",-1.29527,52.61031,33,0,"Caterpillar Desford Substation"],["sa905e256c95",-1.43366,52.80906,33,0,"Melbourne Substation"],["s0f6bd57491b",-1.37939,52.78255,33,0,"Worthington Substation"],["s9afd9ae812a",-1.37516,52.72652,33,0,"Mantle Lane Substation"],["se85b800ff36",-1.34787,52.71348,33,0,"Bardon Substation"],["s36dc9a70bda",-1.34654,52.69885,33,0,"Interlink Park Substation"],["s5dc2c7b56bb",-1.47453,52.71045,33,0,"Babelake Street Packington Substation"],["s620b27710fb",-5.12732,50.13196,33,0,"Higher Tregarne Solar Farm Substation"],["s84d391bd070",-2.11994,57.19025,33,0,"Whitestripes Primary Substation"],["s9294f0acc97",0.04912,51.54783,33,0,"Woodgrange Park Substation"],["sd23ed17a0f4",0.75809,51.36524,33,0,null],["s03966345fa2",-2.18809,53.41875,33,0,"Heaton Moor Electricity Substation"],["sbae7099e2c0",-1.68932,53.21642,33,0,"Bakewell Substation"],["s0284682b6c9",-3.42267,56.23005,33,0,null],["s64da0111ccc",-0.05188,52.69781,33,0,"Whaplode Drove Substation"],["s93fd100ad9f",-0.54477,52.64206,33,0,"Ketton Cement Substation"],["sc179446cd90",0.16262,52.75095,33,0,"The Grange Wind Farm Substation"],["s379515a42c6",-0.49836,53.03679,33,0,"Cranwell Substation"],["s63b500108ed",-1.40555,53.17393,33,0,"Biwater Substation"],["sd09496be9aa",-1.41979,53.20708,33,0,"Wingerworth Substation"],["s54c6618c7e0",-1.4425,53.27013,33,0,"Sheepbridge Substation"],["s6f68a70fe2c",-1.42567,53.24821,33,0,"Sheffield Road Substation"],["scd7a11ad557",-1.41948,53.23074,33,2,"Robert Hyde Substation"],["s37c4811acbf",-1.46605,53.2165,33,0,"Walton Substation"],["sf86baec5abb",-1.33316,53.25727,33,0,"Erin Road Substation"],["s58bbb369209",-1.13839,53.3143,33,0,"Worksop West Substation"],["s6407ee71a1a",-1.20843,53.19517,33,0,"Acreage Lane Substation"],["sd16f080dd4f",-1.01193,53.15146,33,0,"Stonish Hill Wind Farm Substation"],["s1c61f765f2a",-1.21752,53.13274,33,0,"Hermitage Lane Generation Substation"],["s794b70ea675",-1.19125,53.14137,33,0,"Lime Tree Place Substation"],["s0459e7887af",-1.21773,53.13771,33,0,"Skegby Lane Substation"],["s629652c318e",-1.29125,53.12692,33,0,"Huthwaite Substation"],["sbbe7bf359b7",-1.25483,52.53626,33,0,"Sapcote Substation"],["s6a51d0620ed",-1.21675,52.45526,33,0,"Lutterworth Substation"],["s8af7c8ac353",-1.25068,52.44911,33,0,"Magna Park Substation"],["sf2a24b40fc3",-1.27296,52.4152,33,0,"Churchover Substation"],["s889a1512c29",-1.10152,52.61594,33,0,"Stoneygate Substation"],["s9f643ecef5a",-1.16273,52.60983,33,4,"Braunstone Substation"],["sdfa02521916",-1.18755,52.63042,33,0,"Hockley Farm Road Substation"],["s24f1e5c50c0",-1.17302,52.65054,33,0,"Groby Road Substation"],["s5512dc74b39",-1.0943,52.66412,33,0,"Thurmaston Substation"],["sb4332034b61",-1.05264,52.63474,33,0,"Thurnby Substation"],["s73d7cc04278",-1.02787,52.45435,33,0,"Pebble Hall Generation Substation"],["see70d30fb1b",-1.20734,52.58308,33,0,"Alliance and Leicester Substation"],["s2f77518f77c",-1.1848,52.56767,33,0,"Whetstone Substation"],["s3142d92a2a6",-1.49246,52.89905,33,0,"Normanton Substation"],["s94f4bdc4aa1",-1.44097,52.92482,33,0,"Chaddesden Substation"],["s004b16545cf",-1.47431,52.89166,33,0,"Trafalgar Park Gas Peaking Substation"],["s5801fafadd7",-1.47947,52.89312,33,0,"Derby Waste Sinfin Lane Substation"],["sf2f63f69068",-1.45313,52.89419,33,0,"Allenton Substation"],["s44f450efd11",-1.46175,52.9047,33,0,"Bombardier Substation"],["sde8c59c4fce",-1.47151,52.91958,33,0,"Eagle Centre Substation"],["scd754937b37",-1.52015,52.92068,33,0,"Mackworth Substation"],["s1a818afbaec",-1.268,52.90087,33,1,"Nottingham Road STOR Substation"],["s00fa528bd99",-1.14063,52.94897,33,0,"London Road Heat Station Substation"],["s10ba815a062",-1.08041,52.96038,33,0,"Colwick Substation"],["s83d37ecc3fc",-1.07067,52.95707,33,0,null],["s6fffa1f1d71",-1.15449,52.95558,33,0,"Electricity Substation West Of Multi Storey Car Park"],["s6056cb2533b",-1.13986,52.92496,33,0,"West Bridgford Substation"],["s659dd43d056",-1.18895,52.94382,33,2,"Lenton Substation"],["s1a2d63601eb",-1.188,52.92394,33,4,"Boots Substation"],["s238e4fcf476",-1.17845,52.93408,33,0,"Redfield Road 2 STOR Substation"],["s070e4efca01",-1.17836,52.93411,33,0,"Redfield Road 1 STOR Substation"],["s55d09bca6fd",-1.29681,52.9225,33,0,"Sandiacre Substation"],["s9d43ee533bf",-1.30922,52.95957,33,0,"Little Hallam Substation"],["s91fb1c5fc57",-1.17847,52.90393,33,0,"Clifton Substation"],["s798a266abdf",-2.23421,53.49002,132,0,"Red Bank"],["sa6f3c042a35",-2.27626,53.48952,132,1,null],["sd9499b5cd27",-2.63156,53.53982,33,0,"Green Street"],["s1620c43038a",-4.45371,53.40662,33,2,"Cemaes Bay"],["s7c5eb9fca07",0.11024,51.7808,33,0,"New Harlow Primary"],["sfba4a486e54",-1.83052,53.68504,33,2,null],["s66bf1658813",0.06206,51.40079,750,0,"Chislehurst DC Traction Substation"],["s49d25c916f3",-2.36826,53.46758,33,1,null],["s9b27de58e45",-1.0613,52.36676,33,0,"Winwick Wind Farm Substation"],["s2fabace28fb",-2.41256,56.78107,33,0,null],["s3d03d3a7e14",1.37963,51.38111,33,0,"Margate"],["se6d87075061",1.36476,51.35301,33,0,"Manston"],["s7923775df2f",-0.69114,53.63196,33,0,"Grange WF"],["se287570c850",-0.1606,51.65551,33,0,null],["se64a14b4656",-0.19851,51.46022,750,0,"Point Pleasant Junction DC Traction Substation"],["sa987c5d6952",-2.79024,51.04337,33,0,"Tengore Lane Solar Park Substation"],["s70a76607e7e",-0.53253,51.57826,132,0,null],["s0c59fcc07c4",-0.48123,53.76721,33,0,null],["s593c48ec720",-0.47743,53.77071,33,0,null],["s9a2f6479a78",-0.39513,53.81813,33,0,null],["s6dbe4a5ee07",-0.39559,53.80284,33,0,null],["sca3e145f782",-0.67526,53.6117,33,0,null],["s32c0e609b1e",-0.48614,52.08672,33,0,null],["sc9c1daf3a91",0.13558,51.55304,33,0,"Cherry Tree Substation"],["s7d01c8d04cb",-2.12098,57.17084,33,0,"Hayton Primary Substation"],["s12a9957c7fa",-2.50318,51.35084,33,0,"Marksbury 33kV Solar Park"],["se3ce8df2885",-3.06898,54.98969,33,0,null],["sa5ed8994ad0",-0.59262,51.67201,33,0,"Amersham Substation"],["s7627dc18b64",-0.49921,51.61024,33,2,"Harefield Substation"],["se6a13301bad",-5.13493,50.29343,33,0,"Four Burrows Windfarm Substation"],["s7fdb4b71808",-4.60824,50.68227,132,0,"Otterham Wind Farm Substation"],["s27c8b96bc76",-3.61824,50.52912,33,0,"Bradley Lane Substation"],["s1290be21582",-3.59977,50.53282,33,0,"Newton Abbot Substation"],["s655f3a4973e",-3.12087,50.93472,33,0,"Tricky Warren Switching Station"],["sb3605430ab7",-2.79331,51.12965,33,0,"Whitley Farm 33kV Solar Fm"],["s74f1c61bbdb",-2.5875,51.24798,33,0,"Shooters Bottom Solar Park Substation"],["s272f2661a7a",-2.904,51.25741,33,0,"Ashlawn Farm Solar Park Substation"],["sd781cdc8199",-3.25224,50.98079,33,0,"Tonedale Farm Solar Park Substation"],["s0f3cb814921",-2.87222,51.05826,33,0,"Aller Court Solar Farm Substation"],["s6fa4569022d",-3.91344,51.1339,33,0,"Capelands Farm Solar Substation"],["s6d0d4bf0a41",-2.53089,51.14748,33,0,"Pylle Solar Park Substation"],["sc3175193a67",-2.92959,51.27711,33,0,"East Brent Substation"],["sdc663b70846",-3.39443,51.40829,33,0,"Llancadle Solar Farm Substation"],["s27af234e560",-2.97199,51.11861,33,0,"Park Wall Solar Park Substation"],["s7b5c08cf768",-2.97969,51.34565,33,0,"Weston Central Primary Substation"],["sad1ac9c4b42",-2.38841,51.22887,33,0,"Whatley Quarry Substation"],["s129211e827f",-3.53255,50.46912,33,0,"Upton Valley Substation"],["s14fe4f7c7a6",-3.40234,51.39596,33,0,"Loughor 33kV Solar Park"],["s4f78433efdc",-2.85249,51.33266,33,0,"Towerhead Farm Solar Park Substation"],["s1d251dc8a62",-3.12264,50.93489,33,0,"Tricky Warren 33kV Solar"],["s05a5285b036",-3.23862,50.68865,33,0,"Sidmouth Town Substation"],["s0d3d9b7618b",-2.87805,50.92181,33,0,"Hurcott Regulator"],["sb2bcb974878",-2.96573,51.32704,33,0,"Bournville Substation"],["s2eb8fd5d3fe",-3.40328,51.38534,132,1,"Aberthaw Substation"],["s222650e77a1",-2.67001,51.53289,33,0,"Viridor Waste Substation"],["sf69f51ab4aa",-2.36004,51.73821,33,0,"Cambridge Solar Panel Substation"],["sfe1ca304860",-3.63689,51.7665,33,1,"Maesgwyn Wind Farm Substation"],["s4e2d111eddd",-3.89057,51.69156,33,0,"Inco Europe South Substation"],["s229f46e09ef",-4.93433,51.81141,33,0,"Haverfordwest Solar Substation"],["sf2789065e7f",-2.7305,51.60659,33,0,"Oak Grove Farm Solar Gen Substation"],["s0f0d4f7d4b5",-1.91076,52.29028,66,0,"Howard Road STOR Substation"],["s7921e0c5b97",-2.50697,51.55975,132,4,"Old Green Substation"],["s4856730f4bf",-2.47519,51.59883,33,2,"Tower Hill Farm Substation"],["sa123c53d7ec",-4.63509,51.83075,33,0,"Whitland Solar Park Substation"],["sc4ab63f14cf",-3.95245,51.89792,33,0,"Manoravon Pumping Station Substation"],["sd5d74581df7",-2.97328,51.57233,33,0,"ORB Works No. 4"],["s2223c6875e9",-4.52621,51.75699,33,0,"Parc Cynog Wind Farm Substation"],["s9fb40e49101",-3.17124,51.49036,33,2,"Northcote Street Primary Substation"],["s8d99362c439",-2.26444,51.86501,33,1,"Sudmeadow Road STOR Substation"],["s6d7ca5270fc",-3.96413,51.68398,33,13,"Swansea North Local Substation"],["sdea971b6a68",-5.04294,51.71842,33,0,"Liddlestone Ridge PV Gen"],["s79e38475c15",-3.33757,51.77097,33,2,"Dowlais STOR West Substation"],["sd79e95cf449",-2.05155,52.15405,66,0,"Rotherdale Farm PV Substation"],["sb2c209c2454",-2.56602,51.5008,33,2,"Hewlett Packard Switching Station"],["s716debb92b5",-3.8781,51.62492,33,0,"Crymlyn Burrows Substation"],["s86d95068afe",-1.92882,52.05734,66,0,"Wickhamford Substation"],["s0653d2d5a2b",-3.1742,51.48353,33,0,"Park Lane Primary Substation"],["s3328e8b585a",-2.44659,51.52416,33,0,"Says Farm PV Substation"],["s9a7f6977bd3",-4.15815,51.75006,33,0,"Blaenlliedi Wind Farm Substationn"],["s3a4fbc9d015",-3.54072,51.74355,33,0,"Hirwaun STOR Generation Substation"],["s6797e796a97",-3.27801,51.77557,33,0,"Pen Bryn Oer Wind Farm Substation"],["s16b2679fc8f",-3.32005,51.44383,33,0,"Whitton Mawr Solar Park Substation"],["s12aec9819cd",-3.40848,51.43008,33,0,"Treguff Farm PV Generation Substation"],["s4821a6a2398",-3.38223,51.67048,33,0,"Pen Rhiw Caradog PV Substation"],["s0c033065230",-3.14131,51.47993,33,2,"GKN Rod Mil Primary Substation"],["s8763823f626",-2.94347,51.7326,66,0,"Lower House Solar Park Substation"],["s37dc693214a",-2.52964,51.54011,33,0,"Northwood Solar Park Substation"],["s7e2e01ba524",-2.16682,51.84496,33,0,"Brockworth Substation"],["s6f59266c2cd",-2.39785,51.49128,33,0,"Ring 'o' Bells Solar Farm Substation"],["sadb6dad39c8",-2.41779,51.4792,33,0,"Abson Substation"],["s578e3665ec7",-2.62684,51.44033,33,0,"Bower Ashton Substation"],["s19b4cf9cd40",-2.57867,51.54744,33,0,"Oakham Farm Solar Park Substation"],["s8e411d3e133",-1.00892,52.10215,33,0,"Whittlebury Road PV Substation"],["s51d2fe74ab0",-1.0016,51.98643,33,0,"Gawcott Fields Solar Park Substation"],["sf94781c740b",-0.68802,52.13495,33,0,"Emberton PV Substation"],["sd0a31d52a34",-0.86659,52.22366,33,0,"Brackmills Substation"],["sf1b6263d2f0",-0.80812,52.14753,33,0,"Eakley Lanes South PV"],["s94780c00973",-1.01832,52.10835,33,0,"Handley Park Solar Park"],["s1430b2414e1",-0.79892,52.11624,33,0,"Littlewood Farm Solar Substation"],["se9f7e1dcf17",-0.79549,52.20594,33,0,"Brafield on the Green PV Substation"],["se1d576ea8a4",-0.92078,52.10522,33,0,"Homestead Solar Park"],["s27c413c63ca",-0.77935,52.17289,33,0,"Manor Farm PV Horton"],["s8638860350e",-0.92783,52.00645,33,0,"Thornborough Grounds PV"],["s8042795ce11",-1.44361,52.21868,33,0,"Elms Fm Southam Solar Fm 33kV"],["s011b3344ed9",-1.11139,52.04365,33,2,"Turweston Airfield Solar Farm Substation"],["sc3b25eaf1bd",-0.97875,51.89572,33,0,"Greatmoor EFW Calvert Substation"],["se664316f979",-1.47782,52.19366,33,0,"Jaguar Land Rover Substation 33kV"],["s2df8eb1331b",-0.76469,51.97996,33,0,"Bletchley Landfill Substation"],["s5b65be6ccd4",-0.84462,52.13378,33,0,"Hartwell Road"],["sd7e23188382",-0.70833,52.17639,33,0,"Olney Hyde Farm Solar"],["s25273efaece",-1.68471,52.84237,33,0,"Rolleston Park Solar Farm"],["sd8ed42b23e5",-1.70449,52.75823,33,0,"Barton Under Needwood Substation"],["sb2538930a63",-1.74297,52.87975,33,0,"Aston House Solar Farm"],["sb06f762ec4a",-1.66679,52.77764,33,0,"Drakelow Solar Farm"],["sa96e3c7b902",-2.33495,52.46747,33,0,"Astley Solar Farm Substation"],["sd1313c28cee",-2.49482,52.52995,33,0,"Upper Meadowley PV Farm"],["s62fc133fd5d",-2.94289,52.68706,33,0,"Hayford Solar Farm"],["s0f409c10e06",-1.76866,52.87383,33,0,"Moat Farm Draycott Solar"],["s753c1474551",-2.75357,52.70952,33,0,"Roushill Substation"],["s082dae2dd88",-2.72756,52.74253,33,0,"Battlefield ERF Gen"],["s87cb415d0d8",-2.37729,52.54004,33,0,"Swancote Ad Generation"],["s8c8f3e7f184",-1.78423,52.87601,33,0,"Green Lane Marchington PV"],["s65aa89c3656",-1.61017,52.76768,33,0,"Breach Farm"],["s4ef79156022",-2.00932,52.58933,33,3,"Bloxwich ESS Substation"],["s12cd8c70913",-2.71555,52.62106,33,0,"Pitchford Solar Farm"],["s43ecee24703",-2.72673,52.65935,33,0,"Condover Solar Farm"],["s5b708502129",-1.63216,52.80414,33,0,"Station Street Substation"],["s8a165c90216",-1.46423,52.40287,33,0,"Copsewood Substation"],["sdebcf409e79",-1.25204,52.404,33,2,"Rugby Gateway Substation"],["s82c11514e4f",-1.40967,52.24549,33,0,"Fields Farm Southam Solar"],["sb629fa9768a",-1.16912,52.39039,33,0,"Lilbourne Wind Farm Substation"],["s57a078ae998",-0.5969,52.29522,33,0,"Rushden Substation"],["s5367491e542",-0.65257,52.26592,33,0,"Irchester Road Switching Station"],["s01b62ec7265",-1.5648,52.38372,33,0,"University Of Warwick Substation"],["s3dcf13bb195",-0.54834,52.34504,33,0,"Raunds Substation"],["sd7b753399f6",-1.54328,52.4169,33,0,"Holyhead Road Substation"],["s93123f22286",-0.90061,52.2643,33,0,"Kingsthorpe Substation"],["sde299148341",-0.72864,52.40265,33,0,"Field Street Substation"],["s34f97456418",-0.73887,52.29922,33,0,"Park Farm Substation"],["sf34c0404ff9",-0.52502,52.30846,33,0,"Chelveston Solar Park Substation"],["s3711d18bd3b",-1.28698,52.37759,33,0,"Rugby Portland Cement Substation"],["sdd492d38cdb",-1.27037,52.38014,33,0,"English Electric Substation"],["s725ce8b6961",-1.26571,52.36872,33,0,"Union Street Substation"],["s2ef3ef79f09",-1.48308,52.25529,33,0,"Fosse Way Radford Solar FM"],["s1c11371dea1",-1.08116,52.23468,33,0,"Weedon Substation"],["se916eb2a02f",-0.8765,52.24757,33,0,"Abington Substation"],["s4dff4b8f1de",-1.15331,52.36752,33,0,"Yelvertoft Wind Farm Substation"],["s8c11d4d419a",-0.80069,52.44562,33,0,"Pipewell Road PV"],["s4b4055bcf09",-0.77113,52.30777,33,0,"Sywell PV"],["s02d15f97f11",-1.17526,52.26098,33,0,"Braunston Road Substation"],["s78c5606e1b7",-0.72078,52.37448,33,0,"Pytchley Road Substation"],["s9f1a36d734f",-1.11481,52.3292,33,0,"Watford Lodge Windfarm Substation"],["sf7b0ce189b6",-1.1768,52.49884,33,0,"Low Spinney Wind Farm Substation"],["s02994147eba",-0.585,52.30765,33,0,"Higham Ferrers Switching Station"],["scbd973e01a6",-0.6391,52.37394,33,0,"Burton Wold North Substation"],["s977f6e27fc6",-0.67304,52.49826,33,0,"Corby Central Substation"],["s2daf3673142",-0.68913,52.30488,33,0,"Cannon Street Substation"],["s58b9444e811",-1.18183,52.56305,33,0,"G E C Test Bed Whetstone"],["s0dd99a337b0",-0.7307,52.46401,33,0,"Oakley Substation"],["s3adf3530581",-1.3744,52.55595,33,0,"Middlefield Substation"],["sd6ae691a609",-1.17308,52.43032,33,0,"Swinford Wind Farm Substation"],["sd4550144726",-0.90923,52.50483,33,0,"Meadow Farm Solar Substation"],["s61281b236d8",-1.44769,52.72482,33,0,"Hill Farm Battery Generation"],["s7efa738b30d",-1.21733,52.78827,33,0,"Astrazeneca Substation"],["s1b61d04c886",-0.13415,52.81347,33,0,"Wardentree Park Substation"],["s19ed3eb2212",-1.16456,52.62637,33,0,"Jupiter Substation"],["s23f267519d8",-1.56296,52.61053,33,0,"Atherstone Solar Farm Substation"],["sb4bf3973977",-1.56441,52.85025,33,0,"Trent Alloys Substation"],["s1e6dcabe99d",-0.10016,52.66495,33,0,"French Farm Windfarm Substation"],["sa0a82a6d63f",-1.13855,52.63379,33,0,"Redcross Street Substation"],["sc17d58ad9df",-1.34389,52.68983,33,0,"Victoria Road PV Ellistown"],["s14a16a7eea5",-1.11628,52.7397,33,0,"Gypsum Solar Farm"],["se8b404ad2d6",-0.87956,52.76359,33,0,"Regent Street Substation"],["s488069db7b0",-1.28517,52.76958,33,0,"Shepshed Substation"],["sa0d3ea1476d",-1.36358,52.62521,33,1,"Hall Farm Newbold Verdon"],["sc9afa8ac4d1",-1.13704,52.79756,33,0,"Wymeswold Solar Park Substation"],["sdc52c536b00",-0.59305,52.86819,33,0,"Mill Farm Solar Boothby"],["s9cd928b011f",-0.1348,52.69793,33,0,"Decoy Farm Generation"],["sb663cd06980",-1.19389,52.78131,33,0,"Brush Substation"],["s0a26bf7d3fe",-1.02697,52.77723,33,0,"Ragdale PV Solar Park"],["sf623f826572",-0.21728,52.72268,33,0,"Deeping St Nicholas Wind"],["s918305ae053",-0.95125,52.90013,33,0,"Langar Solar Switch Room"],["s1fb09ad88b1",0.0588,52.75108,33,0,"Horsemoor Drove Solar Park"],["se859d0da512",-1.12152,52.62919,33,0,"Highfields Substation"],["s2d8f2202c79",0.20948,53.14004,33,0,"Lincoln Farm Solar Park Substation"],["s11db4e9047c",0.23721,53.14508,33,0,"Croft End Solar Farm Substation"],["sac77efee94b",-0.10312,52.92379,33,0,"Nowhere Farm PV Substation"],["s0254b3d0fa5",-0.00616,52.96045,33,0,"Boston Biomass Generation Substation"],["sef286929369",-0.55383,53.26614,33,0,"Leverton Battery Storage Substation"],["s7053213b292",0.0636,53.02341,33,0,"Leverton Solar Park Substation"],["s2316a253a4c",-0.35614,52.97706,33,0,"Whitecross Lane Solar Park Burton Substation"],["sf324353a1f2",0.23784,53.31988,33,0,"Bambers Farm Wind Generation Substation"],["s32778f97b0b",-0.58443,53.02503,33,0,"Mill Farm Battery Storage Substation"],["s816584fcef4",-0.16098,53.14171,33,0,"Grange Farm Solar Kirkby on Bain Substation"],["sa720e8f0389",-0.22317,52.937,33,6,"Bicker Fen Wind Generation Substation"],["s57818bc707a",-0.42841,53.24334,33,0,"Fiskerton Solar Farm Substation"],["s2e796ff52b0",-0.39551,53.02982,33,0,"Deepdale Solar Farm"],["se38f1c4f74b",-0.50006,53.00861,33,0,"Ermine Farm Solar Farm"],["sd07addf0a76",-0.05525,53.01,33,0,"Canopus Solar Farm"],["se33012ff0cc",-0.73511,53.01917,33,0,"Copley Farm Solar Gen"],["s4ab207f0b87",-1.14783,53.22171,33,0,"Welbeck Collery Solar Gen"],["s2eca66876da",-0.88035,53.21117,33,0,"Cobb Farm Solar Farm"],["s1ca36fed405",-0.84028,52.96501,33,0,"Lodge Farm Solar Park"],["s65b94233cf2",-1.03532,53.36588,33,0,"Retfor Road Solar Gen"],["s5a171b360e3",-1.01598,53.15229,33,0,"Eakring Solar Farm"],["s2699ad27035",-0.94555,52.94883,33,0,"Bingham Substation"],["s23d3c8024d5",-0.99776,53.30823,33,2,"Walkers Wood Solar Farm"],["s4f64ccfb7c1",-1.04302,53.12836,33,0,"Bilsthorpe PV Generation"],["s4d96a715c2b",-1.01749,53.14355,33,0,"Bilsthorpe Solar Substation"],["sfdffad40f6f",-1.05226,52.92909,33,0,"Stragglethorpe Road PV Solar"],["s1f0e2d0f3d4",-0.95242,53.36296,33,0,"Low Farm AD Substation"],["s72a6ec72400",-1.08758,53.23135,33,0,"Thoresby Solar Farm"],["s719b3aaeae0",-0.92729,53.34536,33,0,"Tiln Solar Generation"],["sb7166cb3b9f",-0.99692,53.35669,33,0,"Moat Farm Solar Farm"],["s232a9ab371d",-0.84537,53.30024,33,0,"West End Farm Solar Gen"],["s941ab0a9296",-0.81252,53.03638,33,0,"Hawton Wind Farm Substation"],["s8f53d38b3d3",-0.85774,52.9477,33,2,"Shelton Lodge Solar Gen"],["sbfd8520e945",-0.80899,53.05101,33,1,"Bowbridge Generation STOR Substation"],["sfdb94928ccb",-1.10441,53.23619,33,0,"Welbeck Solar Farm Substation"],["s49801a9e651",-1.60554,53.01261,33,0,"Smith Hall Farm Solar Plant Substation"],["s498c0f7fc01",-1.66122,53.02432,33,0,"Dayfields Farm PV Substation"],["s176c802dc85",-1.31824,53.11592,33,0,"Twin Yards Solar Farm Substation"],["s30486a0e19e",-2.0188,52.9449,33,2,"Lower Newton Solar Farm Substation"],["s416eb582d35",-1.41398,53.06194,33,0,"Asher Lane STOR Substation"],["sd16a2afce64",-1.37294,53.08503,33,0,"Somercotes Substation"],["s305b9f52899",-1.39613,53.14842,33,0,"Averill Solar Farm Substation"],["sc2d8bc928f3",-1.36565,53.02321,33,0,"Taylor Lane STOR Substation"],["s8a997f7e3db",-1.24436,53.1961,33,0,"Shirebrook Substation"],["s0602c3a36c8",-1.37465,53.22861,33,0,"Lodge Farm Solar Substation"],["sf219c0e1a7f",-1.80512,52.8919,33,0,"Holtwood Farm Solar Park Substation"],["s4c0d6e904f0",-1.26982,53.09111,33,0,"Bentinck Generating Station Substation"],["s5e737a788c8",-1.25581,53.24129,33,0,"Bolsover Moor Quary Solar"],["s61e48673896",-1.36609,53.09038,33,0,"Garnham Close STOR Substation"],["sa0b2d32e045",-1.29873,53.2617,33,0,"Oxcroft Solar Farm Substation"],["sd7848a841aa",-1.81133,52.8957,33,0,"Twin Oaks"],["sffc09e114da",-1.34578,53.24589,33,0,"Arkwright Solar"],["s5549076cbc6",-1.00014,51.91443,33,0,"Shanks Generation Substation"],["s6d26af2400b",-1.27197,60.29377,320,0,"Kergord Converter Station"],["s96b70bf1649",-1.34108,53.71381,33,0,null],["sb783623074f",-2.10515,57.1519,33,0,"St Nicholas Primary Substation"],["sa007defafa1",-0.01235,51.53262,132,1,"Bow 11kV"],["s95ea2663927",-0.01239,51.53296,132,4,"Bow Network Rail"],["s3e8fcd64906",-2.84892,53.35294,132,1,"Speke Substation"],["sf889984f962",0.65046,51.56279,33,0,null],["s155c45b373e",-0.56605,51.66757,33,0,"Cokes Lane Substation"],["s225afe59fb4",-0.30654,51.49119,33,0,null],["s89bd098ceb7",-0.40242,51.27257,33,0,null],["s5eb74ece5c7",-4.15973,57.60393,33,0,null],["sf4866423252",-4.35804,51.84818,33,6,"Red Court Solar Farm Substationn"],["se09e1bb7bb5",-3.326,51.76096,33,0,"Trecatti Substation"],["sb7aaa717a86",-3.31203,51.7409,33,0,"Bargoed Solar Park Substation"],["s8d3f0f49e05",-6.82046,55.09744,33,0,"Dunmore 33 kV Substation"],["sfa358abcbb3",-3.33682,51.77092,33,2,"Dowlais STOR East Substation"],["s1fda0c4094a",-3.88543,51.76064,33,0,"Pwllfa Gwatkin Substation"],["s913f1fa6c48",-4.015,51.64935,33,0,"Waunarlwydd STOR Generation Substation"],["s9308cb4b7fd",-4.12325,51.75902,33,0,"Pentre Farm PV Generation"],["s6e6e7211e2f",-0.80708,50.85414,33,0,null],["s8e0ff6c7eac",-0.977,50.79422,33,0,null],["sa2133d3a794",-1.19408,50.94664,33,0,null],["sdcfb0426946",-1.3923,50.90478,33,0,"Chapel PSS"],["s880d644ca19",-1.37898,50.93687,33,0,"Woodmill Lane PSS"],["sebe467a04e6",-1.40036,50.94136,33,0,null],["s99b24ff8911",-0.08702,51.7919,33,0,"West Hertford Primary"],["s5749acf16a9",-2.75571,51.06922,33,0,"Somerton Door Solar Park Substation"],["s3b5e918f00c",-2.26288,51.84115,33,0,"Bristol Road Substation"],["sd351d013a89",-6.52048,58.34847,33,0,"Barvas Substation"],["sfca54a22e81",-5.15685,57.90141,33,0,null],["s5887b1b6a38",-5.74327,56.78411,33,0,null],["s307b253d484",-3.50656,55.91033,33,0,null],["sb7c7c755d7a",-3.57212,55.90346,33,0,"Deans Substation"],["sd7f27150c6a",-2.78918,55.96098,33,0,null],["sc72741304e9",-2.9025,55.90868,33,0,null],["s91ffd5f8389",-3.8381,55.79625,33,0,null],["s4aac012f8b9",-0.48807,50.81586,33,0,"Angmering 33kV"],["se2a97234c2e",0.18951,52.6607,33,0,null],["saf0d5f292cf",-5.91805,54.72422,33,0,null],["s72fccf4be27",-2.16323,57.03392,33,0,"Newtonhill Primary Substation"],["s1b53bf52d31",-7.10544,54.51385,33,0,null],["s7a3a14f0864",-7.11301,54.51986,33,0,null],["s426fe19e8e3",-7.10409,54.50361,33,0,null],["s0746e379229",-7.10109,54.49613,33,0,null],["se2cb06c374d",0.13417,51.52366,33,2,null],["s4cf3779c9c3",0.26186,51.4785,132,0,"Purfleet Substation"],["s4b191ebb350",0.31843,51.47697,33,0,null],["s267bc8c9284",0.44605,51.51367,33,0,null],["scf7a9e8c1ae",0.69211,51.5918,33,0,null],["s61dce372a85",0.03,51.62712,33,0,null],["s9ece14456b1",0.03225,51.62497,33,0,null],["s7a9a66f48eb",0.00314,51.63165,33,0,null],["sf8a94f8f6ba",-1.0716,52.82591,33,0,"Willoughby STOR Substation"],["sd694348a017",-7.46635,54.58521,33,0,"Cornavarrow 33kV Substation"],["s093fe06510a",-6.42794,54.98265,33,0,"33kV Substation"],["s284c21d7f16",-6.43185,54.97177,33,0,"_______ 33kV Substation"],["s0130b957f8d",-7.61797,54.63008,33,0,"_______ 33kV Substation"],["se55fd052df1",-7.62106,54.58914,33,0,"Thornog 33 kV Substation"],["s8a8918f34cc",-7.62705,54.19439,33,0,"____ 33kV Substation"],["s0edbb541284",-7.32665,54.91525,33,0,null],["sf86172cf496",-6.81083,55.08181,33,0,null],["s29a0b86bad1",-6.19901,54.93985,33,0,null],["sf4be1a54366",-6.21742,54.93453,33,0,null],["s294d930d51e",-7.43411,54.52123,33,0,"Dromore 33 kV Substation"],["s95df3d36148",-1.43296,52.22783,33,1,"Harbury 33kV"],["s4d8a977d3e0",-1.56494,54.61129,33,0,"Aycliffe Industrial"],["sbd864143ed9",-3.96164,56.76358,33,0,null],["sf5d523b9f64",-3.78417,56.72482,33,0,null],["s14680f90278",-6.27895,55.19711,33,0,"Ballycastle Central 33 kV Substation"],["s68514400211",-2.29953,53.59701,33,0,"Bury Grid"],["s8333cb68f60",-3.03917,56.19896,132,1,"Leven Substation"],["s21d8404dedf",-2.86664,56.21352,33,0,"Colinsburgh Substation"],["s551dd4bba06",-0.73608,51.23772,33,0,null],["s6b6422a5f78",-0.64637,51.17862,33,0,null],["s23c443e1826",-8.08681,54.47697,33,0,"Belleek South 33 kV Substation"],["s7cba8813a05",-0.54457,51.05699,33,0,null],["s380076985ae",-7.03683,54.51693,33,0,"Crockbaravally 33 kV Substation"],["s216a883c29a",-3.49953,56.44291,33,0,null],["sd75a448e86c",-6.67565,54.84938,33,0,"Maghera 33 kV Substation"],["s750c086d47c",-2.1822,57.205,33,2,"Dyce North Primary Substation"],["seb0e172e85c",-2.17898,57.19046,33,0,"Stoneywood Primary Subtation"],["sbac9c3ffc5b",-2.11743,53.61397,33,0,"Milnrow"],["s882a6f6142b",-1.53795,53.73299,132,4,"Scampston Drive"],["sd65cd80aa78",0.11429,51.51923,132,0,"Barking Riverside 132kV substation"],["sbf8af266eef",-6.79849,54.99325,33,0,"Craiggore 33 kV Substation"],["s9c5e40c2c5a",0.33179,51.44058,750,0,"Northfleet DC Traction Substation"],["sf4a3d3315ad",0.51372,51.27859,750,0,"Maidstone DC Traction Substation"],["sfc39191211a",-2.38868,57.42849,33,0,"Fyvie Primary Substation"],["s68f38d5e165",-7.29256,54.97736,33,0,"Drumahoe West 33 kV Substation"],["s8badf360db2",-2.8639,53.20704,33,0,"Mannings Lane"],["sc8c1a2d0b3d",-3.40239,51.38908,275,2,null],["s9dcb4645d13",-4.10935,57.64522,33,0,null],["s2c82ed95b64",-6.44482,54.4316,33,0,null],["sf61282cf18a",0.26776,51.55692,33,0,"Cranham Substation"],["s1f7c9dd558a",0.28768,51.55932,33,0,"Cranham Golf Club Solar Farm"],["sa0a2e33c6d8",0.33711,51.56782,33,0,"West Horndon Substation"],["s0917d6ddf97",0.47461,51.588,33,0,"Ford Tractor Substation"],["s37212185e9d",0.45121,51.58182,33,0,"The Limes"],["s74d14f6faba",0.45301,51.56745,33,0,"Kingswood Substation"],["s2fadbde5f5a",0.4175,51.56952,33,0,"Durham Road Substation"],["s669f4e8dbfb",0.23006,51.88754,33,0,"Stansted Airport Main Substation"],["sf46b5b377ab",0.66652,51.72481,33,0,"Maldon Wick Substation"],["s359fbd660df",0.53689,51.62063,132,2,null],["sfcabca78e4d",0.55562,51.60717,132,2,null],["s53faa17c8b6",1.17939,51.82587,132,2,"Clacton Substation"],["sa1410bee2c8",1.16457,51.8038,33,0,"Valleybridge Road Substation"],["sb0932fd9699",0.56583,51.87393,33,0,"Lake and Elliot Substation"],["s3e12c5703ac",0.57236,51.88243,33,0,"Braintree Depot Substation"],["sb4cc309f94f",-2.04639,53.49172,132,1,null],["sf23ba6b5620",-2.04123,53.49657,33,1,"Heyrod"],["s73d43a09345",-6.34103,54.50255,33,0,"Aghagallon 33 kV Substation"],["s288cecba753",-0.11262,51.59807,33,0,null],["s9b2152936f2",-6.41608,54.40993,33,0,"Carrickblacker Central 33 kV Substation"],["s9762738af24",-0.07606,51.59872,33,0,null],["s8ebd7ad0f4b",-0.15062,51.58601,33,0,null],["s6e72ff99e33",-0.32427,51.2423,750,0,"Dorking DC Traction Substation"],["s3fe552aa2da",-3.87738,56.61759,33,0,null],["sec4a99a504d",-6.00692,54.38085,33,0,"Dromara Central Substation"],["s21044423194",-3.4145,56.70707,33,0,null],["sca54ad31722",-7.24347,55.03118,33,0,"______ 33 kV Substation"],["s761c029da41",-2.99157,56.46119,33,0,null],["s7ea4d86482c",-6.23492,54.87346,33,0,"Ballymena East 33 kV Substation"],["sa1c3f6e13ef",-6.23247,54.8813,33,0,"Ballymena North 33 kV Substation"],["sf5e3cdd56d6",-3.25465,57.45201,33,0,null],["s54a40bf0b55",0.02391,51.42891,750,0,"Grove Park DC Traction Substation"],["s9c88faaf6f2",-3.13351,57.44275,33,2,null],["s1af377bfa5c",-6.02025,54.6873,33,0,"Roughfort Central 33 kV Substation"],["s4ba6748e309",-6.17312,54.51238,33,0,"Maghaberry 33 kV Substation"],["s7c90c4159b9",-6.25326,54.88053,33,0,"Ballygarvey Road 33 kV Substation"],["sbd88b0cb3f0",-6.83237,54.93957,33,0,"Evishagaran 33 kV Substation"],["sac0aab9eae6",0.31365,51.4313,132,4,"Ebbsfleet Grid"],["s183e62d69ab",-5.73595,54.7572,33,0,"Bentra Central 33 kV Substation"],["s717a4f8a987",-0.4677,51.37218,33,0,null],["s3960a7685c6",-6.75427,54.62492,33,0,"Cookstown South 33 kV Substation"],["s7a3d7f49967",-6.65547,55.10953,33,0,"Ulster Chipboard"],["s485ea33e5e6",-6.34584,54.84965,33,0,"Ahoghill Central 33kV Substation"],["s39b424f5266",-6.53854,54.61479,33,0,"Ardboe Central"],["sb34cc4ecfaf",-5.78276,54.50523,33,0,"Ballygowan Central 33 kV Substation"],["se9222ba7de2",-5.96384,54.69345,33,0,"Ballyhenry 33 kV Substation"],["sce75ee52227",-5.91074,54.5947,33,0,"______ 33 kV Substation"],["s43b6711d589",-5.90121,54.40584,33,0,"Ballynahinch North 33 kV Substation"],["sc5234468efe",-5.96336,54.6202,33,0,"Ballysillan 33kV Substation"],["s69341252192",-6.27735,54.86194,33,0,"Harryville 33 kV Substation"],["sb7869bc4929",-6.25706,54.40112,33,0,"Laurelhill 33 kV Substation"],["sdc2b623aa8e",-6.74076,54.49476,33,0,"_______ 33 kV Substation"],["sad11ca461c8",-5.6891,54.65665,33,0,"Bangor West 33 kV Substation"],["s17c20691742",-5.63514,54.65529,33,0,"Bangor East 33 kV Substation"],["s41bef7798f3",-5.6647,54.66191,33,0,"Bangor Central 33 kV Substation"],["sd2bbad45cec",-6.27923,54.35219,33,0,"Banbridge North 33 kV Substation"],["sa21047754dd",-7.62707,54.43141,33,0,"Ballinamallard West 33 kV Substation"],["sf811231db4a",-6.49486,54.43822,33,0,"Ballyfodrin Central 33 kV Substation"],["s55bc5499caa",-7.46698,54.81733,33,0,"Adria 33 kV Substation"],["sf1d74c21980",-5.80787,54.73633,33,0,"Carrickfergus North 33kV Substation"],["s4523181f242",-6.78238,54.4038,33,0,"Benburb Central 33 kV Substation"],["se0539c1fd95",-5.60959,54.3028,33,0,"Bishopscourt Central 33 kV Substation"],["sbda39b539e7",-5.68733,54.32267,33,0,"Downpatrick East 33 kV Substation"],["seba4e8a8fc0",-5.86811,54.57633,33,0,"Braniel 33 kV Substation"],["s096ffd5ac5a",-6.09054,54.90439,33,0,"Buckna Central 33 kV Substation"],["s70fcdf93e91",-6.39279,54.1853,33,0,"Bessbrook South 33kV Substation"],["s6012a6e6e3c",-6.36698,54.20602,33,0,"Bessbrook North 33kV Substation"],["s5b54c63d177",-5.72535,54.65465,33,0,"Cargos Hill 33 kV Substation"],["s565ee518f7a",-6.40976,54.45012,33,0,"Carn Central 33 kV Substation"],["s6854b79c1ce",-7.05093,54.61164,33,0,"Carrickmore North 33 kV Substation"],["s893d96aeae1",-7.59131,54.7051,33,0,"Castlederg South 33 kV Substation"],["sa17aa6d03b7",-7.27184,55.00472,33,0,"Caw 33 kV Substation"],["s7ec2e82bd7a",-5.93866,54.58739,33,0,"City Hospital 33 kV Substation"],["s164d63ca566",-6.3395,55.00268,33,0,"Cloghmills Central 33 kV Substation"],["sab7c333021f",-6.68693,54.66142,33,0,"Coagh West 33 kV Substation"],["sf21ddde4216",-5.87306,54.60802,33,0,"Sydenham 33kV Substation"],["s0845bcaa43c",-5.8116,54.59384,33,0,"Dundonald 33kV Substation"],["sc852c752807",-5.88705,54.59655,33,0,"Ballymacarrett 33kV Substation"],["s51e76cb3167",-5.96399,54.60079,33,0,"Springfield 33 kV Substation"],["sef8fb1bcf82",-5.95128,54.59482,33,0,"Mulhouse Road 33 kV Substation"],["secbd855e661",-5.94946,54.58134,33,0,"Malone 33 kV Substation"],["s39fde62476a",-5.97866,54.56533,33,0,"Balmoral 33 kV Substation"],["s5c989607116",-5.934,54.58845,33,0,"South Central 33 kV Substation"],["se1253a2b9b4",-5.92394,54.57447,33,0,"Ormeau 33 kV Substation"],["s5a3d940ec4a",-5.92344,54.54991,33,0,"Newtownbreda 33 kV Substation"],["s69d96844dca",-5.90068,54.59506,33,0,"Mountpottinger 33 kV Substation"],["s36123e951ca",-5.93677,54.66691,33,0,"Rathcoole 33 kV Substation"],["s63b42c7350b",-5.92271,54.65378,33,0,"Whitehouse 33 kV Substation"],["s61adc698e44",-5.94138,54.59991,33,0,"West Central 33 kV Substation"],["s713a892fdf6",-5.92586,54.59658,33,0,"East Central 33 kV Substation"],["sfc1d469f6d7",-5.9174,54.59659,33,0,"Laganside 33 kV Substation"],["sa2fc42168fe",-6.02145,54.54488,33,0,"Dunmurry South 33 kV Substation"],["sd86047edc27",-5.70169,54.58696,33,0,"Newtownards Central 33 kV Substation"],["sec84d7c3551",-2.34724,57.23114,33,0,"Torryburn Primary Substation"],["s947335a1875",-2.07553,57.25834,33,0,null],["sb2c72fbb38e",-2.30632,57.3364,33,0,"Oldmeldum Primary Substation"],["s1cfa534f36d",-5.81581,54.64542,33,0,"Holywood East 33 kV Substation"],["s79dc3276a11",-5.84575,54.63216,33,0,"Holywood West 33 kV Substation"],["s0648dadef10",-5.75008,54.54816,33,0,"Comber Central 33 kV Substation"],["sc5bc62c81cf",-5.66453,54.40831,33,0,"Shrigley 33kV Substation"],["s6145df8d4b4",-2.89996,51.28654,400,0,null],["sb0fe03022bc",-5.74764,54.39197,33,0,"Crossgar 33kV Substation"],["sa5eddfbd6b4",-5.73951,54.34262,33,0,"Downpatrick North 33 kV Substation"],["s386660eff2d",-6.33339,54.47114,33,0,"_______________ 33 kV Substation"],["saf7276de366",-1.04416,53.94913,33,2,"York University"],["s6813cfca4f9",-7.32051,55.03607,33,0,"Lenamore 33 kV Substation"],["s1884309bc0d",-7.32153,55.00134,33,0,"Strand Road 33 kV Substation"],["s16372083658",-7.25614,55.02894,33,0,"Maydown 33kV Substation"],["s2def5a18dbf",-7.57318,54.64805,33,0,"Slieveglass 11 kV Substation"],["sf0cf14d39e0",-7.5888,54.6258,33,0,"_______ 33kV Substation"],["s94fe523e8f9",-7.55037,54.55881,33,0,"Tappaghan 33kV Substation"],["s7ab6904d7df",-7.74753,54.64397,33,0,"Tievenamenta 33 kV Substation"],["s777d469ebd1",-2.24577,57.42162,33,0,"Methlick  Primary Substation"],["s44f00bfa184",-1.32471,53.87131,33,0,"Warren Lane"],["sd67e823862d",-1.32795,53.87194,132,2,"Bramham"],["s5d6134396f8",-1.37899,53.93308,33,0,"Audby Lane"],["s53282d8eb12",-6.2852,54.45943,33,0,"______ 33 kV Substation"],["sf12c30db739",-6.80653,54.49139,33,0,"______ 33 kV Substation"],["se3ad6c72d16",-2.44223,53.09429,33,0,"Electricity Street Substation"],["sca9e62b8b86",-2.52965,53.2676,132,1,"Winnington Substation"],["sa8c3cb977b7",-1.57924,53.68501,33,0,"Milton Place"],["s186cad50fed",-2.12636,57.51752,33,0,null],["s0bc93dbf5fa",-2.69197,52.96408,33,0,"Liverpool Road Substation"],["s03eb0da1b0c",-3.01285,53.3956,132,0,"Woodside Substation"],["s02f17b08247",-3.17597,53.39099,33,0,"Hoylake T2 Substation"],["s290534703f0",-3.17682,53.38968,132,0,"Hoylake T1 Substation"],["sb0909983de9",-3.07266,53.32821,132,0,"Hewswall Substation"],["s8746511ba68",0.3814,52.72615,33,0,"Power Station 33kV Aux"],["s576ca9b3034",-1.67853,54.03224,33,0,"Darley"],["s6492719222c",-7.45012,54.25844,33,0,null],["s1c549ec3274",-2.8977,53.46258,132,0,"Gillmoss Substation"],["s35b2c01d969",-3.03992,53.59225,33,0,"Pinfold Lane Primary Substation"],["sd7a4706abb3",-3.012,53.61951,33,0,"Grantham Close Primary Substation"],["sc2e67beefa0",-3.02146,53.62444,33,0,"Dover Road Primary Substation"],["s230b2e77432",-3.00616,53.64576,33,0,"Market Street Substation"],["s8ae8375adad",-7.57169,54.14241,33,0,"_____ 33kV Substation"],["s74cd04bcdfb",-2.95395,53.66665,33,0,"Mullards Balmoral Drive Substation"],["s351390dc327",-2.98677,53.64275,33,0,"Ivy Street Substation"],["s5425482352e",-3.007,53.63664,33,0,"Banastre Road Primary Substation"],["scdad1a6e58c",-2.99851,53.65084,33,0,"Lord Street Substation"],["s3d538ad0fd1",-3.01754,53.63457,33,0,"York Road Primary Substation"],["s3892a18caa8",-3.01228,53.65369,33,0,"Ocean Plaza Substation"],["s5102f770a1a",-3.00859,53.65003,33,0,"Neville Street Substation"],["s13d170da145",-3.03548,53.60301,33,0,"Ainsdale Primary Substation"],["s98dbe1ba5b6",-3.04623,53.60422,33,0,null],["s19bbc8f6b27",-2.98238,53.65676,33,0,"Cambridge Road Substation"],["s3b2d4c49a05",-2.97422,53.66498,33,0,"Marshside Substation"],["sc79f0a7ad0c",-2.94242,53.46096,132,0,"Fazakerley Substation"],["s6a1b10947fd",-2.74196,53.44548,132,0,"Ravenhead Substation"],["s764af91c9df",-2.75693,53.45215,132,0,"St Helen's Substation"],["se4f66fd09d8",-7.61971,54.16715,33,0,"_____ 33kV Substation"],["s8a5dcb85841",-7.60161,54.35667,33,0,null],["s176c78178c6",-7.34796,54.44257,33,0,"Hunter's Hill 33kV Substation"],["s981cb5e3c9d",-7.33109,54.45671,33,0,"Screggagh 33kV Substation"],["s2b4ac99d8bd",-7.32683,54.43749,33,0,"Lendrum's Bridge 33kV Substation"],["sef03e64776c",-7.47215,54.4219,33,0,null],["sde2e8a0a0d6",-7.87767,54.33365,33,0,null],["s4600b5902f4",-7.19225,54.54767,33,0,"_____ 33 kV Substation"],["s0cb5eee19ef",-2.90195,51.56305,132,2,"Llanwern 132Kv Solar Park Substation"],["sdbb83c0357d",0.01374,51.46695,750,0,"Blackheath DC Traction Substation"],["s6723d7db6df",-0.00434,51.45689,33,0,null],["s4e7fec18db6",-2.33502,53.31554,33,0,null],["s411e14ff5b6",-1.40669,54.03041,33,0,"Coneythorpe"],["s50ea7e19970",-1.414,54.08706,33,0,"Boroughbridge"],["s5ca03015000",-1.11268,53.50051,33,0,"Potteric Carr (SFC) FS"],["s6d4975fa952",-6.7328,54.62354,33,0,"_______ 33 kV Substation"],["s720277c843f",-6.84979,54.55238,33,0,"_____ 33 kV Substation"],["sfe4428b32f8",-0.4208,53.81101,400,0,"Dogger Bank A Wind Farm Converter station"],["sa2fd920eb0d",-7.22264,54.89312,33,0,"____ 33 kV Substation"],["sd9095465b82",-6.6605,54.57253,33,0,"____ 33 kV Substation"],["saad6ab6758b",-7.38018,54.68149,33,0,"Bessy Bell 33kV Substation"],["sfc4b5ef3944",-1.52171,54.13351,33,0,"Ripon"],["s124d66002d4",-7.06562,54.63695,33,0,null],["s927239b7e09",-6.99612,54.70448,33,0,null],["s88da9ac0f61",-6.62527,54.76073,33,0,"_____ 33 kV Substation"],["s00939f72566",-7.28162,54.58228,33,0,"Omagh South 33 kV Substation"],["s9315cb08b38",-7.31371,54.59842,33,0,"Omagh West 33 kV Substation"],["s3e313847aed",-7.28334,54.60832,33,0,"Omagh East 33 kV Substation"],["sad538180a99",-7.327,54.80496,33,0,"____ 33kV Substation"],["s41576356051",-7.26089,54.76816,33,0,"____ 33kV Substation"],["sd9e8cc98a02",-7.23691,55.02469,33,0,"_____ 33 kV Substation"],["sb3126eaacea",-6.76681,54.50919,33,0,"_______ 33 kV Substation"],["s698c3ffc1b5",-7.24023,55.03829,33,0,"______ 33 kV Substation"],["s9d6d64426c3",-7.3584,54.95697,33,0,"Newbuildings 33 kV Substation"],["s381f74ca8af",-6.94179,55.05008,33,0,"______ 33kV Substation"],["s5c28cefdde5",-6.65323,55.00058,33,0,"_______ 33 kV Substation"],["seb85f28b548",-6.69523,55.13416,33,0,"______ 33 kV Substation"],["s7fbbb92f07e",-6.65804,55.13359,33,0,"______ 33 kV Substation"],["s52d7fb51b1c",-6.27125,55.04052,33,0,"Gruig 33 kV Substation"],["sea13ce36bb3",-6.51862,54.7689,33,0,"Creagh Central 33 kV Substation"],["se972f1050dc",-2.64499,56.77833,33,0,null],["s29960f6df7c",-2.82951,53.35376,132,1,"Halewood Substation"],["se2bc6ec1fe0",-2.83042,53.35383,415,0,null],["s4e0adcbce6c",-2.8282,53.36118,33,2,"Kenton Road"],["s3e64d012004",-2.59946,56.82478,33,0,null],["s4796c6016a4",-2.99349,56.66551,33,0,null],["s021f3654536",-6.3393,54.89165,33,0,"_______ 33kV Substation"],["se019cdae3bf",-6.47189,54.82449,33,0,"______ 33kV Substation"],["s65ed31149f4",-6.33045,54.85924,33,0,"_______ 33 kV Substation"],["seb3e99f853e",-2.6726,56.63383,33,0,"Friockheim"],["s48c88ea52bd",-6.28494,54.87419,33,0,"____ 33 kV Substation"],["s16946cd47dd",0.35539,51.46298,33,0,"Selwyn Road Primary"],["s55c1452f65e",0.4077,51.5795,33,0,"Ford Dunton Primary"],["s112f0323beb",-6.26103,54.87268,33,0,"_______ 33 kV Substation"],["sb3f67dde35e",0.04359,51.5036,66,0,"Silvertown Substation"],["s45724ab6561",-1.4852,52.20149,33,0,"Gaydon 33kV"],["s9a5478ad47c",0.24529,50.85874,33,0,"Hailsham Primary"],["sa9242c0dfcc",-6.29507,54.76971,33,0,null],["s0291562c3d3",-6.39582,54.74035,33,0,"Toome East 33/11 kV Substation"],["s6732d24a3ac",-0.17716,51.63435,33,0,null],["sdbc60792c88",-1.39086,52.27306,33,0,"Southam Substation"],["sf5f3039e8be",-1.12094,51.74364,33,0,"Wheatley"],["s2b88f556696",-3.04251,56.51428,33,3,"Leoch Substation"],["s547b125e73c",-3.47716,56.54562,33,0,null],["s8fe2764c641",-1.60509,52.40099,132,2,"Coventry West Substation"],["s1c445cc08ee",-1.56444,52.38368,33,0,"University Of Warwick Substation"],["s9d7cefeebf0",-3.54604,56.34554,33,0,null],["sf9efeb1f196",0.11553,51.70436,33,0,"Lindsey Street Substation"],["sf92a14cdbb7",-4.21194,56.23647,33,0,null],["s93fbc58cefc",-4.15168,56.13473,33,0,null],["sfbbb71364f5",-4.35063,56.09475,33,0,null],["sce3eaef58c2",-4.55804,56.03241,33,0,null],["s29a97128f5c",-2.02419,55.75005,33,0,null],["s9f24719b6bf",-2.53955,55.91766,400,0,"Neart na Gaoithe Wind Farm Substation"],["s66e08fd75cd",-2.97367,56.52259,275,0,"Seagreen Wind Farm Substation"],["sac828a00c55",-0.2365,52.92099,525,0,"Viking Link Converter Station"],["s56a72277771",-3.83279,55.59121,132,0,"Douglas North"],["sc3292276bfa",-1.86855,50.74403,33,0,"Winton 33/11KV"],["s16008513c5f",-1.97218,50.79933,33,0,"Wimborne"],["s508d83cec61",-0.00165,51.51114,132,1,"Telehouse Substation"],["sb06e9c36985",0.1367,51.45697,33,0,null],["sbca0699b4f2",0.18057,51.45237,33,0,null],["s2fbb0966c18",0.14661,51.52963,33,0,null],["s41a29b064e8",0.14726,51.54215,33,0,null],["sea5a70a1b34",0.25466,51.44414,33,2,"Stone Marshes"],["s2b7d4161969",0.24436,51.44256,33,0,null],["sd8010adf91a",0.09025,51.56162,33,0,null],["s987ec7a3e8e",0.08433,51.56871,33,0,null],["s9773798c37a",0.02441,51.59539,33,0,null],["s818d97d7a71",-0.18102,51.61584,33,0,null],["s0f61b74e875",-0.04126,51.61527,33,0,null],["sf4bb99e2333",-0.25948,51.61491,33,0,null],["sd5fcf307d35",-0.2648,51.50372,33,0,null],["s11cbb085a3b",-3.969,56.19083,33,0,null],["s2aca8fe0929",-1.48337,50.94094,132,4,null],["s578f53c2c78",-0.39937,54.23704,33,0,null],["s946330208d3",-3.77596,50.8342,33,0,"Sharland Farm Solar Park Substation"],["s8d395175386",-5.28068,50.22825,33,0,"Carn Brea Substation"],["sc12ca307cce",-5.16138,50.22937,33,0,"St Day Landfill"],["sb0ddef5dcfe",-4.92482,50.34412,33,0,"Hewas Solar Farm Substation"],["sbdba6ea44cd",-4.92343,50.3315,33,0,"Carnemough Farm Solar Substation"],["s1e273cbcd50",-4.82932,50.33492,33,0,"Manor Farm 33kv Solar Pk"],["s57dda5889ce",-2.58608,51.20795,33,0,"Dinder Farm Solar Park Substation"],["s958dc357363",-2.58239,51.25472,33,0,"Shooters Bottom Wind Farm"],["s203381fa49f",-2.83948,51.34058,400,2,"Sandford Substation"],["s98a46b62de6",-3.4224,55.1983,33,0,null],["sf6660126086",-6.0572,54.51382,33,0,null],["s7ad5de97bd8",-3.22596,55.06913,33,0,null],["s8a5661d9ec5",-1.50518,52.42471,33,0,"Courtaulds 33KV/6.6KV Substation"],["s941528e9e2b",-2.63261,53.26143,33,0,"Crowton Substation"],["s42b24608aa9",-0.11225,53.21811,33,0,null],["s3ee09205401",-1.56762,53.6645,33,0,"Horbury"],["s9652367ddb2",-4.49018,55.60294,33,0,null],["sa42cda97e59",-3.1382,51.20325,400,0,"Shurton Substation"],["s6af32d01008",-1.73973,53.52015,400,0,"Wogden Foot Cable Sealing End Compound"],["s08fea5ca450",-1.28563,52.75936,132,1,"Shepshed Substation"],["s29a660c4c87",-6.14703,54.23325,33,0,"Rathfriland 33 kV Substation"],["s225eb097336",0.33513,51.47074,132,0,null],["sdc6168dd8bf",0.33438,51.46649,33,0,null],["s08281dfb6df",0.3499,51.46225,33,0,null],["s194f5350023",0.03746,51.47273,33,0,null],["sd7c9aa50a72",-0.2968,51.46384,750,0,"Richmond DC Traction Substation"],["sdbc95fb7036",-1.68069,54.6417,66,0,"Fylands Bridge"],["s07541289fc0",-2.88741,54.03276,132,4,"Ormonde onshore substation"],["see94601432d",-1.32218,53.13917,132,0,null],["sca1c22b3d56",-0.60079,53.56121,33,0,"Sweeting Thorns"],["sa817204b90c",-0.09267,51.35977,750,1,"South Croydon DC Traction Substation"],["s516873f8544",-4.55851,56.05194,33,0,null],["s8b23c5ded04",-0.75358,51.51126,132,0,null],["s02ebcdff01a",-3.83628,55.71185,33,0,null],["sfb9e4e1136f",-3.70491,55.76309,33,0,null],["s83d839b97ad",-3.98134,55.69578,33,0,null],["sae5b0ca9ed1",-3.97314,55.73693,33,0,null],["s16de7708dab",-3.79007,55.82167,33,0,null],["s819c2e0581f",-3.94581,55.86899,33,0,null],["s5a90ad1bc2d",-3.65333,55.05617,33,0,null],["s11bff423f45",-4.08723,57.31529,132,1,"Glen Kyllachy Substation"],["sccf4884841c",-3.20574,57.53163,33,0,null],["s7c0a1daa810",-2.00301,51.60624,132,1,null],["sbbe114edabd",-1.26716,54.58745,66,3,null],["sb81b0ecd32e",-1.26235,54.58985,66,0,null],["sca09dad4a8c",-0.04731,51.46571,750,0,"Nunhead DC Traction Substation"],["sdb36b4034b9",-3.31625,57.65013,33,0,"Cumming Street Primary Substation"],["s7721a5f1768",-0.0884,53.81287,132,1,null],["s3fdc193e0c8",-0.1674,51.51616,66,0,"Hyde Park Estate A"],["s99b9fc8d148",-1.28489,53.71734,400,0,"Knottingley Substation"],["sa0d7f0b5357",-1.60522,55.01023,33,0,"Gosforth Metro"],["s7d8c0c0f78c",-0.12361,51.51531,132,1,"Shorts Gardens Substation"],["s01ee8e108dc",-1.1332,54.56747,66,0,"Lackenby"],["s08df9f882f7",-1.21105,54.54227,66,0,"Prissick Substation"],["s3a390b19155",-0.18909,51.43222,400,1,"Wimbledon Substation"],["s6b495a9b896",-0.05849,51.48474,275,3,"New Cross Substation"],["s6ab28b04749",-0.05595,51.48422,33,1,"New Cross GSP"],["sf5493ec787f",-0.04055,51.45911,750,0,"Brockley DC Traction Substation"],["s6111d02976b",-0.16705,51.51592,66,0,"Hyde Park Estate B"],["sf10c721cbb7",-3.01574,53.07089,33,0,null],["sda5e43f0d70",-0.19255,51.52274,132,1,"Amberley Road B Substation"],["s553811878bb",-4.40409,58.05161,132,4,"Dalchork Substation"],["s95b5aa9efe4",-4.50368,58.21066,132,1,"Creag Riabhach Wind Farm Substation"],["sd979baeca0f",-0.12103,51.35904,33,0,"West Croydon Substation"],["s61debd12bd9",-0.12685,51.36467,750,0,"Waddon DC Traction Substation"],["s34c994a8088",-0.05048,51.37509,33,0,"Shirley Substation"],["s41e0ea19177",-0.07391,51.39203,132,0,"Ashburton Grid"],["sf81769b25dd",-0.07407,51.39223,33,0,null],["s27ea13db7b5",-0.11639,51.40282,33,0,"Norbury Substation"],["s4a99a87d2e9",-0.13697,51.38339,132,0,null],["s225ff8930aa",-0.11604,51.37668,132,0,"whitetower energy"],["sa7cb13f019e",-0.0765,51.39939,33,0,"Suffolk Road Substation"],["s4e13e0ec2cc",0.03253,51.3179,33,0,"Biggin Hill Substation"],["s63d16609811",-0.41153,53.80004,132,3,null],["s039ff66496c",-0.41881,53.79782,132,3,"Creyke Beck Power Substation"],["s1fff6834c84",-0.098,51.38318,33,0,"Spurgeons Bridge Substation"],["sb454a176ec7",0.06518,51.43852,750,0,"New Eltham DC Traction Substation"],["s32f183769f0",-0.11239,51.34012,33,0,null],["s10baeea19d4",-0.11301,51.33994,132,0,null],["s3fc7a26e132",-0.11285,51.33969,33,0,null],["s1b18661f9d9",0.1132,51.51816,132,0,"Barking Substation"],["sf2868f7fe07",0.28043,51.47095,33,0,"Daily Mail Switching Station"],["s5c00e93d63c",0.27149,51.48107,33,1,"Barclay Way Substation"],["sf9bfbda6684",-0.10397,51.43024,33,0,"West Norwood Substation"],["s4eaaa63a22f",-0.15764,51.43757,33,0,"Trinity Crescent Substation"],["se6a5089758e",-0.06095,51.44718,33,0,"Forest Hill Substation"],["s2dbbbafe323",-0.13647,51.46156,33,0,"Clapham Park Road Substation"],["s2764f4130e3",-0.02167,51.58201,66,0,"Exeter Road Substation"],["s32f0579a68a",-0.88563,52.46442,400,0,"Market Harborough Substation"],["s7b00ea42998",-2.165,53.53145,33,0,null],["s1ded4d80906",-2.19376,53.55012,33,0,null],["s4e65c71e502",-0.04467,51.40377,33,0,null],["s3a4ed7fc4bf",-2.94588,54.97119,33,0,null],["sb468ada7c78",-1.93897,53.8383,33,0,"Harworth 1690"],["sfa8c5217e73",-0.37424,54.14209,66,0,"North Burton"],["s01432709e4e",-0.3738,54.14003,66,0,"West Burton"],["s71666e979e5",-0.2718,54.07362,66,0,"Fraisthorpe Fields"],["s0b0a4f0d368",-0.58911,53.74493,33,0,"Brough Cave Road"],["s155128a0f27",-0.58844,53.73804,33,0,"Brough Brantingham Grange"],["s52f803d3936",-0.73905,53.90845,66,0,"Burnby Hayton"],["s3dfeb6a108a",-0.73643,53.90885,66,0,"Burnby Driffield"],["s87486918479",-0.73798,53.91138,66,0,"Burnby Belthorpe Lane"],["s33613dd4909",-0.4032,53.83491,33,0,"Figham Hull Road"],["s0db32fce435",-1.38856,54.23,33,0,"Thirsk"],["se954234b75b",-1.34791,54.22131,33,0,"Sowerby"],["s3a2bf1afa94",0.75652,51.41346,132,0,null],["s4e3c563175f",0.76805,51.40829,132,0,null],["s6faf5143b15",-0.17457,51.52544,132,0,"Aberdeen Place B Substation"],["s79f8ac09a55",-0.17431,51.52565,132,3,"Aberdeen Place A"],["sb658fbc39c6",-0.17368,51.5255,132,0,"St Marylebone Substation"],["s5946db474df",-4.98979,51.67526,400,0,"Penfro Converter Station"],["s3c2b1557fe9",-0.41346,53.80134,132,7,"Creyke Beck"],["s1ecfa7fdfd5",-0.74988,53.5973,132,9,"Keadby 1"],["sa3c95b2714c",-2.92633,53.41944,275,0,"Lister Drive Greener Grid Park"],["s84686f8c1c5",-2.94189,57.54027,132,1,"Keith Greener Grid Park"],["s58bd0da622d",-0.21268,51.57415,33,0,null],["see9c46c0658",-0.18624,51.46851,66,1,"Townmead Road Substation"],["s2f6c9e75aba",-1.21435,54.69656,66,0,"Amberton Road"],["s90e3bd1fb28",-1.77993,51.54899,33,0,"Quarry Road"],["s537d92e4728",-1.39641,54.92765,66,0,"Carley Hill Primary"],["se9fc521d6ef",-6.17554,54.71438,33,0,null],["s1a980ab71f2",-0.82172,53.02876,132,2,null],["s1cb406f57b1",0.08406,51.59316,33,0,"Fairlop Road Primary Substation"],["s81a2c4a9670",-1.15067,53.30908,33,0,"Rhodesia CO2 Capture"],["s49786dd4a05",-0.01669,51.3828,750,0,"West Wickham DC Traction Substation"],["seccc25da39c",-0.3548,51.81663,33,0,null],["sc337d23c921",-6.03935,54.53353,33,0,null],["s7841d19c72f",-3.62232,56.01368,33,0,"Bo'ness Kinneil Substation"],["s70fcd9f9d7e",-6.03965,54.07126,33,0,"Kilkeel 33kV Substation"],["s997fbf9e4a0",-2.80185,53.28078,132,1,null],["s2c53c5832a5",-6.285,54.17716,33,0,null],["sb02fb273c09",-2.10954,57.14789,33,0,"Denburn Primary Substation"],["s1ea8603669d",-2.08737,57.14739,33,0,"Commerce Street Primary Substation"],["se317c19a9e8",-6.14826,54.40189,33,0,"Dromore South 33kV Substation"],["s31161505277",-2.21716,57.19642,33,0,"Harvest Avenue Primary Substation"],["s5561da2d1a9",-6.27756,54.34375,33,0,null],["scb932759369",-6.26946,54.3471,33,0,null],["sd813e459ea4",-2.09165,57.10817,33,0,"Redmoss Primary Substation"],["s6f8919d708f",-1.73479,54.97409,132,1,null],["s04a200dfb5a",-1.73466,54.97384,132,5,null],["s14c8123cf2b",-6.26011,54.10272,33,0,null],["s8c4c224fea5",-6.26743,54.10429,33,0,null],["sbb48d01dd73",-1.59565,54.97258,66,0,"Breamish Street"],["s7aa1fa8d234",-6.97421,54.56132,33,0,null],["s1f980d7542f",-4.00606,56.67692,275,1,"Kinardochy Substation"],["sff1e2751433",1.31322,52.62107,33,0,"LS&E Primary Substation"],["s170dfc712cc",-6.34876,54.19486,33,0,null],["s475e1b5d73f",-2.93011,57.50011,400,0,"Whitehillock Substation"],["sd13ae629d6c",-3.29063,57.71254,33,0,"Lossiemouth Primary Substation"],["s5335ba8c04d",-6.28783,54.51265,33,0,null],["s27f7d1cb452",-0.32619,52.24522,132,0,null],["s2c2af1a1157",-0.81304,53.48565,33,0,"Haxey"],["sf89ce6f02ed",-6.25976,54.34344,33,0,"____ 33 kV Substation"],["s23b6ea4fb13",-2.52818,53.27741,33,0,"Anderton"],["sf8bd6a09f30",-2.28283,57.49017,220,0,"Moray East Onshore substation"],["s24107a2d48d",-1.48184,53.38088,33,0,"Victoria Street Substation"],["s58258d6fe47",-3.39557,55.98409,33,0,"South Queensferry S/S"],["s86b7dc8d788",-1.47562,53.38698,33,0,"Blue Boy Street Substation"],["s1152eaeee7d",-1.46527,53.38845,33,0,"Northern Powegrid- Stanley Street"],["s1031d30b620",-0.53145,53.71618,33,0,"Gibson Lane WF"],["sbf70a67ab5c",-1.61557,53.79057,33,0,"Farnley Crescent"],["sfc0ff3fb241",-1.55308,53.79501,33,0,"Whitehall Road Primary"],["s7c58f96f316",-1.57458,53.7693,33,2,"Sulzers"],["sa2aa4f868bc",-1.50309,53.78737,33,0,"New Market Approach Generation"],["s5c32a377108",-1.79453,54.33778,33,0,"Barden Friar"],["s350f7980c4b",-1.37515,53.70412,33,0,"Premier Way North 2"],["s12a85484687",-1.37854,53.70398,33,0,"Premier Way North 1"],["sf800d7524b2",-1.34252,53.7321,33,0,"Duke Street"],["s8e3e6a90788",-1.33873,53.73186,33,0,"Smith Street"],["s159d68b7d4c",-1.51966,53.68243,33,0,"Alverthorpe Rd"],["s4a9d1450a86",-1.68918,53.9091,33,0,"North Avenue"],["se10ecc43c74",-1.63515,53.75053,33,0,"Gildersome Bradford Rd"],["se3f3bc5a27f",-1.64332,53.73815,33,0,"Nab Lane"],["s5499905ffa6",-1.62732,53.70713,33,0,"Batley"],["sa191c569d40",-1.65444,53.67945,33,0,"Calder Wharf"],["s50370c049ef",-1.20302,53.78091,33,0,"Gascoigne Wood"],["saa5c7efff73",-1.54618,53.79906,33,0,"Upper Basinghall Street"],["sc9e0505812c",-1.52993,53.7907,33,0,"Armouries Drive"],["sc2a8264b1c9",-1.53437,53.8028,33,0,"Leylands Road Primary"],["sd474c186beb",-1.68868,53.73216,33,1,"Burnleyville"],["sc95fb0ce24e",-1.70585,53.72196,33,0,"Spenborough"],["s6afe34b895c",-1.72169,53.73186,33,0,"Snelsins Lane"],["sd700308e56d",-1.91313,53.8582,33,0,"South Street"],["se25eaa46e66",-0.00293,53.51533,33,0,"Bishopthorpe WF"],["saea3262ba2b",-0.75421,51.62897,33,0,"High Wycombe Town Substation"],["s48cbaccced0",-0.06727,53.74523,33,0,"Roos WF"],["sf9631e4fb0b",-0.23798,53.77562,33,0,"Bilton Generation"],["sa49bb25e6dd",-0.40197,53.95206,132,0,"Scurf Dyke Gen"],["s61b9eb1e00e",-3.96893,52.98078,275,0,"Ffestiniog Power Station Transformers"],["s05b3d20af85",-1.00483,51.45431,33,0,"Wilson Road Substation"],["s93a212def1c",-1.78493,50.84165,33,0,"New Street Substation"],["sc333b91e7f0",-1.71986,53.77052,33,0,"Tong Street"],["s4c168f0a491",0.38387,51.44141,33,0,null],["s23bf11b78a4",0.39224,51.44129,750,0,"Denton DC Traction Substation"],["s32a4a77d6a1",-4.81829,50.42354,33,2,"Victoria 33kV Wind Farm"],["sba2a29d20ff",-1.8007,57.47644,400,2,"Peterhead Substation"],["sa2ed1456d3c",-6.20054,54.66806,33,0,null],["sa6d5bf93867",-6.24504,54.58739,33,0,null],["s6d7a3f6f368",-1.05968,50.7872,33,0,"Eastney Substation"],["sd3936ab008e",-3.92552,55.58184,132,0,"Cumberhead Collector Substation"],["s0b1b27276c9",-1.99909,51.6079,132,1,null],["sd52edc40917",-2.47629,51.57586,132,1,null],["sbc88908edd8",-0.49426,50.96896,33,0,"Codmore Hill Substation"],["s8035ed71d0e",-6.98318,54.53929,33,0,"Eshmore Substation"],["s3699c80a7ef",0.0547,51.49128,750,0,"Woolwich Dockyard DC Traction Substation"],["sfdcd0894518",-1.45289,54.32679,33,0,"Romanby"],["se85370ad21b",-1.83635,50.73147,33,0,"Boscombe East 33/11kV"],["sc4ea6d89259",0.71281,51.4451,400,0,"Grain Synchronous Condenser"],["s6f3432d57e7",1.09788,51.29477,400,4,null],["s8bb6a2b7bc0",-2.04594,53.49205,132,6,null],["sed4141aefeb",-1.70584,52.51615,132,2,null],["seec7c9d617c",-1.71311,52.53283,275,2,null],["s1d3bc843593",-0.52879,52.05195,400,0,"Marston Vale Substation"],["s1eb8c8b88ba",-0.13579,53.53436,33,0,"Low Farm Solar 33kV"],["sf420953c86e",-0.45196,51.53417,66,0,null],["s4b7370f2fc1",-0.42343,51.5042,33,0,null],["s7ba9f9d8ce2",-3.16194,56.60975,275,0,"Alyth Substation"],["s485b5055d69",-1.85534,57.57503,132,3,"St Fergus East"],["sbb245e88986",-4.7888,55.23437,33,0,"Tralorg Wind Farm Substation"],["se5630884917",1.05858,52.0746,400,2,"East Anglia THREE Converter Station"],["s272dd4bda90",-1.03044,53.78791,132,1,null],["sfe659047ee3",-0.87009,53.78534,33,0,"Spaldington WF"],["s30e4ecc0577",-0.82221,51.29129,750,0,"Fleet DC Traction Substation"],["s2d881627bfb",-1.04319,53.77434,33,0,"Selby STOR"],["s6173c5f3846",-0.0252,51.68601,33,0,null],["s3fdfafecac8",-2.51997,57.41233,400,0,"Rothienorman Synchronous Condenser"],["sf90238e5521",-2.37987,57.21916,132,4,"Kintore Grid Supply Point"],["s828625e4f76",-2.38533,57.21876,400,0,"Kintore 400kV Substation"],["s12e19e2e8fe",-3.34236,57.65979,132,2,null],["sb66e294ccaf",-4.71826,57.13627,275,5,"Fort Augustus Substation"],["sc885b0e018d",-4.71823,57.13504,400,2,"Fort Augustus Substation"],["sd139bb05305",-4.47969,55.80803,400,0,"Neilston Substation"],["sfc7cd222054",-4.47504,55.80868,132,6,"Neilston Substation"],["s5208ac431fa",-4.4774,55.8096,132,5,"Neilston Substation"],["sfdf2b0c45d1",-0.25376,53.74891,33,2,"Great Field Lane Generation"],["sb5181c51673",-0.23195,53.74475,33,0,"Hull Reserve Power 57923"],["s6ebc065161a",-1.46901,54.91776,66,0,"Nissan"],["s85a666c6ac2",-1.70211,54.413,33,1,null],["sfb4748a110a",-1.57386,53.73178,33,0,"Tingley"],["s02386e1105d",-1.63234,53.68475,33,0,"Park Road"],["s46f1438883d",-1.6938,53.70803,33,2,"Liversedge"],["s1f92929db36",-1.76226,53.75474,33,0,"Low Moor"],["s58db40d01a7",-0.00213,51.45242,750,0,"Hither Green DC Traction Substation"],["sa75bfd2b8c6",-1.78171,51.56465,33,0,"Manchester Road"],["sd3c3d52f400",-1.26224,51.62483,132,0,null],["sc68b8e784ea",-2.00058,51.60726,132,19,null],["s4a32d3c52af",0.97468,51.10771,400,0,null],["s9ee7aeb8b09",0.97618,51.10662,400,0,"Sellindge Converter Station"],["s631682c24dd",0.9722,51.10571,400,0,"Sellindge Substation"],["sdaa2cf7c7f7",-0.64992,53.85708,33,0,null],["s1ffcc0f964b",-0.65175,53.85662,33,0,null],["s222d73bbfac",-1.80121,53.63509,33,0,"Yew Green Road"],["s3187fb5e856",-3.07937,53.23122,400,1,null],["s171cc48952f",-3.07877,53.23113,400,0,null],["sdbd31f2ad1c",-3.07402,53.22991,400,0,"Connahs Quay GIS Substation"],["s6ca1f0e9b47",-2.33633,57.42599,33,0,null],["s57ac7c3a183",-3.93085,55.76434,400,0,"Wishaw substation"],["s8ad72f95dc6",-1.23715,54.60541,400,3,"Saltholme Substation"],["s0f49c7f080a",0.23765,51.46363,400,1,"Littlebrook Substation"],["s67a59565ccb",-0.02544,51.49891,66,0,null],["s37fc9b4863b",-4.26825,55.81786,33,0,"Langside Substation"],["s7dce131d384",-0.19907,53.60343,33,0,"Mauxhall Farm"],["s3b7ac6dd79e",-0.90832,51.92797,132,7,null],["s0eb31f7f786",-4.2957,55.86246,33,0,"SEC Primary Substation"],["sdd5c5a1de85",-0.53594,54.43618,33,0,null],["sd924b05a044",-1.13107,54.57587,66,0,"Greystones 66KV Substation"],["s39a01152975",-2.02294,52.53943,132,0,"Forkers Yard Battery Storage Facility"],["s2e760f772ce",-4.131,55.50969,33,0,null],["sfa1e383efc8",-4.28897,55.32981,132,0,null],["sac933495c52",1.73402,52.58461,132,0,null],["s701afe26606",-1.46277,53.82678,33,0,"Seacroft"],["sb66f268212f",-1.42364,54.90947,33,0,"Pallion Trading"],["s0cf71a37bd1",-1.2907,54.70139,66,0,"Hartmoor"],["s00d94d0ff88",-1.29204,54.70066,275,0,"Hartmoor"],["sf556c5bc868",-2.96561,53.74007,33,0,"Lytham"],["s802114d5ed4",-1.64973,52.77201,132,5,null],["sfab7e3c28fd",-1.06277,50.79722,33,0,"Fratton Park Substation"],["s351a6192456",-1.0873,50.79768,33,0,"Greetham Street Substation"],["s848713f72ba",-4.24404,57.41998,275,0,null],["s539f9010472",-0.30486,51.48886,750,0,"Brentford DC Traction Substation"],["s891d8fc874d",0.14419,51.56836,33,0,null],["sf56674ee312",0.17323,51.54745,132,0,null],["s05cc61becc3",0.16883,51.54713,33,0,null],["s1992d25550c",0.29035,51.51384,33,0,null],["s34af80abe16",0.12934,51.76873,33,0,null],["s0a96b0a541d",-0.62211,51.52105,33,0,null],["s410a85b47a4",-0.62516,51.52328,33,0,null],["sf63742bae7e",-0.62542,51.52286,33,0,null],["s8d9839399c7",-0.61723,51.51828,33,2,null],["s252b595818e",-0.62027,51.5223,33,0,null],["s5faa76d3a1f",-0.62268,51.53657,33,0,null],["sa2361ec80e8",-0.58781,51.51323,33,0,null],["s73671d9a449",-0.54847,51.50493,132,0,null],["s4444666beb7",-0.0601,51.62611,33,0,null],["s6d6dbb861ac",-0.07292,51.63306,33,0,null],["se26139833f0",-0.04225,51.64235,33,0,null],["s8406a00c4ad",-0.02112,51.65836,132,0,"Brimsdown South"],["s126b776c281",-0.0569,51.65187,33,0,"East Enfield Primary"],["s6eb56b31190",-0.07273,51.65309,33,0,null],["sc3b62f43df7",-0.09607,51.66528,33,0,null],["sceaf27a30ed",-0.11271,51.6489,33,0,null],["s9d59fafd890",-0.17728,51.59022,33,0,null],["s13fb76b3b2e",-0.1992,51.65446,33,0,null],["saf1a6d7fba1",-0.33753,51.59426,33,0,null],["s319e3347ccc",-0.32974,51.59015,33,0,null],["s40fa1432f65",-0.27872,51.61232,33,0,null],["s230d459a737",-0.04046,51.62014,33,0,null],["s2321a5f23fe",-4.4872,57.24753,400,0,null],["s0b58c5fe23d",-4.37873,57.27373,33,0,"Errogie Primary 33/11kV substation"],["sb454e245e97",-0.43022,51.75688,33,0,null],["s30ac7ab2666",-0.41507,51.6282,33,0,null],["s51c0d47768c",-1.56349,53.98815,33,0,"Harrogate West"],["sfaf39c3e1cb",-1.53126,53.9768,33,0,"Oatlands"],["sa514b32b3bc",-1.3193,54.17418,33,0,"Sessay Bridge"],["s8d2ddd7de90",-1.559,54.54626,33,0,"Rise Carr"],["s9e802a28964",-1.55902,54.5463,33,0,"Rise Carr"],["s187fdbb3494",-1.35885,54.77275,66,0,"Peterlee Industrial"],["s48506203acd",-1.37164,54.75709,66,0,"Peterlee West"],["s675d4e091b9",-4.7246,56.3241,275,0,"Inverarnan Substation"],["s6542b137b32",-1.17274,54.60898,66,0,"Tees Industrial"],["s47fb83ef7d3",-1.28397,54.61603,66,0,"Billingham Marsh House"],["s248ff993a4f",-1.24851,54.56944,66,0,"Faraday Street"],["s3cfb162df4d",-1.1889,54.57191,66,0,"Spencerbeck"],["se96fdcc2d51",-1.24641,54.54774,33,0,"Acklam"],["se6526a07f3a",-1.29827,54.53982,33,0,"Millbank Lane"],["sdabc9effb28",-1.71008,55.03498,33,0,"Newcastle Airport"],["s6159df7656b",-1.60076,54.96038,33,0,"Gateshead Central"],["s12c3200dbf3",-1.62212,54.97344,33,0,"Corporation Street"],["sc9fee03a825",-1.60812,54.97937,33,0,"Educational Precinct"],["s7c01b351693",-1.61822,54.98207,33,0,"University"],["s69cd3f7e994",-3.58511,51.74146,33,2,"Hendre Fawr Solar Farm"],["s7ee8ffa85fe",-2.60434,56.56037,33,0,"Charles Avenue"],["sa9138a3333c",-4.12238,51.04565,132,3,null],["sf513ee296c1",0.31635,52.27887,132,0,null],["s104d2a3493d",-4.18022,53.20934,33,0,null],["sa7ae07bae24",-4.19695,53.22879,33,0,null],["s41aad59a3f1",1.61127,52.20807,132,3,"Leiston Substation"],["s015fe6e35a1",1.61219,52.20834,400,0,"NG Eastern SGT"],["s548f8d3644d",-3.13069,51.48173,33,0,"Tremorfa Substation"],["s2842b5ac048",-0.02775,51.71904,33,0,null],["sd042fec0245",-0.51107,53.54133,33,0,null],["sa9aa9ca53b8",-4.87489,50.35255,33,0,"Carloggas Farm 33kv Solar"],["sba714635c4a",-1.73433,53.82589,33,1,"Idle"],["s74e92078ba1",-1.7224,53.81435,33,0,"Moorside Rd"],["sffc2542d3ac",-1.71012,53.79858,33,0,"Thornbury"],["s9f7a1f9a678",-1.71911,53.79663,33,0,"Killinghall Rd"],["sd196d7f739b",-1.72917,53.78836,33,0,"Mount Street"],["s0abff439bd2",-1.72731,53.7749,33,0,"Dudley Hill"],["sd43eeeecd0d",-1.76235,53.76378,33,0,"Odsal"],["sdcc5675de56",-1.78435,53.76916,33,0,"Wibsey"],["s3844205511b",-1.78698,53.78048,33,0,"Saint Street"],["s06769edc43e",-1.78736,53.78908,33,0,"Legrams Mill Lane"],["s161465ff90e",-1.79145,53.81045,33,0,"Toller Lane"],["s597a9c72fe0",-1.76375,53.81988,33,0,"Gaisby Lane"],["s7fd03f159fa",-1.75874,53.79651,33,0,"Rawson Rd"],["saa92d3ebb00",-1.76832,53.79732,33,0,"Crown Street"],["sa7d7644e004",-1.74845,53.79738,33,0,"Balme Street"],["s8418a061450",-1.75513,53.78921,33,0,"Manchester Rd"],["sc12a0769a1f",-1.93155,53.91746,33,0,"Townhead"],["sd0b399f5c0f",-1.83239,53.79261,33,0,"Thornton"],["s66891c6d1ad",-1.89774,53.80487,33,0,"Denholme"],["s9fa7383c80b",-4.31589,55.8549,132,2,"Govan"],["s583d69b2045",-1.52017,52.25359,132,2,"Ashorne Solar Farm Substation (Under Construction)"],["s95ed13f2fb4",-1.27049,51.78975,33,0,"Lovelace Road"],["s7109d66f80a",-1.23906,54.60558,132,0,null],["s5748a7b9aeb",-1.20113,54.6072,66,1,"Seal sands"],["s041758b4a23",-4.3299,55.85045,33,0,"Cardonald Substation"],["sadf50bb1acf",-1.1317,51.54172,33,0,null],["s91490c0878d",-1.1651,51.41731,33,0,"Beenham"],["s463015ce112",-1.32096,51.41342,33,0,"Love Lane"],["s3bc8216dada",-1.284,51.37614,33,0,null],["s6ddac6be07f",-0.35113,51.34788,750,0,"Claygate DC Traction Substation"],["sbf5af8290a3",-0.44814,51.47928,33,0,null],["s76d3175fa14",-0.33471,51.29627,750,0,"Leatherhead DC Traction Substation"],["sef8b4b1afb9",-4.49791,55.59765,33,0,null],["s0379e3506c8",-1.35853,50.93074,33,0,"Townhill Park PSS"],["s25953a96997",1.2901,52.62493,33,0,"St Stephens Primary"],["s3eee58b687d",1.22811,52.63,110,1,"Earlham (Grid) Local"],["s3b2a6ee8c28",-1.27647,53.72001,33,2,null],["s3142b8f6cd3",-3.23351,51.80325,132,1,"Rassau Unit 18 Grid Substation"],["s94966bbfc15",1.32696,52.64148,33,0,"Mousehold Primary Substation"],["sb59043e8786",1.30406,52.63645,33,0,"Barrack Street Primary Substation"],["sbfab6ffe963",1.30098,52.65727,33,0,"George Hill Primary Substation"],["s0b5b2a46b0d",1.33688,52.65873,33,0,"Sprowston Primary Substation"],["sf8c82e3f5ec",1.15103,52.77334,33,0,"Sall Local 11kV"],["sdafe86731d7",-2.97659,53.15613,33,0,"Kinnerton Substation"],["s7f4c3f839c7",-2.92514,53.16919,33,0,"Lache"],["sae70257e1f9",-0.00325,51.40883,750,0,"Shortlands DC Traction Substation"],["sd76c0af9c53",-2.59823,53.2761,33,0,"Acton Bridge Substation"],["s68c81e4e7fc",-2.86679,53.16994,230,0,"LCWW Huntington"],["sd88a2b7b48f",-2.42123,53.17555,33,1,"Middlewich Salt Factory"],["sa4596edf61a",-1.48855,54.03127,132,1,"Knaresborough"],["s905277c6415",-2.72699,53.29742,33,0,null],["s58000924167",-2.88819,53.56681,415,0,null],["sb8c41edda2e",-2.9944,53.17514,230,0,"Mixalloy"],["s9a7b5eb73c7",-2.99508,53.20033,33,0,"Engineer Park"],["sfa570c3d088",-0.14818,53.52254,33,1,"Laceby Solar"],["s283d21d2087",-4.78642,50.36051,33,0,"West Carclaze 33kv Solar P"],["s15ca73c1188",-2.9737,53.1669,33,0,"Broughton Retail Park"],["s7cf0529dd61",-3.00462,53.10097,33,0,null],["s15f5142943b",-3.13173,53.15575,33,0,"Bromfield"],["s0fe4aff8d9a",-0.83281,51.2727,33,1,"Osbourne Drive"],["sd463c3ebbe6",-2.58624,56.56122,33,0,"Hume Street"],["sd3bbdbca7b3",-2.61568,56.55389,33,0,"Elliot Depot"],["sbbb76471f52",-3.16217,52.96562,33,0,"Llangollen"],["sdb724758cfb",-3.08213,52.9727,33,0,"Monsanto"],["s90bd8d0c5af",-3.15124,53.17743,33,0,"Synthite"],["s042ac22c7d0",-2.97521,53.05839,33,0,"Rhosnesni"],["s61cd87f104b",-1.15641,53.77748,132,2,"Hambleton Junction Feeder Station"],["s4cbb04122c3",-0.46865,51.459,33,0,null],["s76549ffd972",-0.38149,51.50316,33,0,null],["s260fb93d230",-2.8989,53.16218,33,0,"SMFS Kingsmeadow"],["s4d65f0bbbab",-2.90492,53.16134,33,0,"Herons Way"],["s99ff57e32b3",-2.92723,53.15426,33,0,"Bodfari Producers"],["s22f56a013cf",-2.85214,53.18989,33,0,"Great Boughton"],["s06dfdff4a3e",-2.853,53.20201,33,0,"Piper's Ash"],["s7b4a66f0dd4",-2.92646,53.19152,33,0,"Cocoa Barry"],["s0a67bddfe0c",-2.93138,53.21064,33,3,null],["sc240ff82ec9",-0.41375,53.99622,66,0,"Driffield Solar"],["sd026ff38234",-3.14963,51.47199,33,0,"Trident Park Waste Generation Substation"],["sf50042def2b",-3.2292,53.27633,33,0,"Holway Road"],["s0b40f1f1fcb",-2.88896,53.20079,33,0,"Brook Lane"],["s6be29975d2f",-2.89085,53.19688,33,0,"Newton Chester"],["sc39e702c407",-2.89398,53.18925,33,0,"Linehall Street"],["sebe26f07adb",-2.88134,53.19113,33,0,"Tomular Place"],["s8269b465b0a",-2.87419,53.19409,33,0,"Associated Lead"],["sf489fdd1979",-2.91693,53.19477,33,0,"Knutsford Way"],["s2129f025b29",-2.59729,53.1133,33,0,"North West Farmers"],["s822225ee934",-2.40464,53.16325,33,0,null],["s438a6c4ff5f",-1.94659,51.36595,400,0,null],["sda3b5eb44d9",-2.93275,53.24635,33,2,"Chester Gates"],["s51961d2f9ee",-2.92883,53.2456,33,0,"Unilever Dunkirk"],["s88b7d349597",-2.90928,53.27346,33,0,"Whitby Main"],["s26972e8a721",0.26495,51.45114,750,0,"Stone Crossing DC Traction Substation"],["s71afd011b2b",-1.4575,51.21572,33,1,"Andover East"],["s49b10fd597c",-1.50897,51.21206,33,0,"Portway"],["s5cfc3db3f03",-1.6562,51.24478,33,0,null],["s47538df53c1",-2.9751,51.15247,400,0,"VQ Transition West"],["sc1fe63bb730",-2.96983,51.15209,400,0,"VQ Transition East"],["s31e539a77b8",-2.55765,50.71989,400,0,null],["s2c8dabd09b5",-2.98643,53.32116,33,0,"BR Bromborough"],["s3911348f5c2",-2.47307,53.24886,33,0,"Morrisons Distribution Centre"],["s72a154231fd",-3.02641,53.62011,33,0,"Network Rail Hillside"],["s06b2da5950c",-2.99354,53.64449,33,0,"Kensington Road"],["s77a7690c2b4",1.27466,52.57517,132,4,"Trowse 2"],["s1ab664d48e2",1.2742,52.57555,132,2,"Earlham 2"],["s6ae0b87ed5c",1.27381,52.57534,132,3,"Earlham 1"],["s6544b46a4eb",1.06252,52.07252,132,3,null],["s7fc0a7b72c8",1.06095,52.07125,400,4,"Bramford Substation"],["sb93a1aaf92f",1.61835,52.20608,132,2,"Greater Gabbard & Galloper on-shore subsea transition bay"],["s372a166c1b2",-2.25316,56.27419,220,0,"Neart na Gaoithe Offshore Substation Platform North"],["s47b35905cb9",-2.23976,56.24358,220,0,"Neart na Gaoithe Offshore Substation Platform South"],["se0dc0a55f25",-3.01079,53.10172,230,0,"Llay Industrial Estate"],["s5749ea93534",1.1081,52.33191,400,0,"Yaxley Synchronous Condenser"],["s8a87df027ce",1.10529,52.33198,400,0,"Yaxley Substation"],["s287ef5f2e0b",1.10339,52.33287,400,0,null],["s90949f63d97",-3.50233,54.04463,132,3,"Walney I OSP"],["s183852a42a8",-3.57519,54.07955,132,1,"Walney II OSP"],["sa67120bf0d0",-1.40036,53.41996,33,0,"Alsing Rd"],["s6290fe21436",0.39351,51.46378,275,2,"Thurrock Flexible Generation"],["s2999d76ba45",-0.167,51.46566,750,0,"Clapham Junction DC Traction Substation"],["sca140882468",-0.1652,51.4472,750,0,"Wandsworth Common DC Traction Substation"],["s4c6e6dd3397",-0.08262,51.43375,750,0,"Sydenham Hill DC Traction Substation"],["s2c9e3f67b62",-3.57213,53.29696,132,4,"Gwynt y mor Onshore Link"],["s07b7c6fd27d",-3.53712,54.67728,132,3,"Robin Rigg OWF landfall"],["s6e6c2af928f",-3.69465,54.7466,132,1,"Robin Riggs East"],["sdbb244bbfad",-3.69469,54.74656,132,2,"Robin Riggs West"],["s8c8365229ab",0.49031,53.18855,132,1,"Lincs Wind Farm Substation"],["s57ec615309a",0.03332,51.44535,750,0,"Lee DC Traction Substation"],["sf11a12e0139",0.15065,51.49186,750,0,"Belvedere DC Traction Substation"],["s64a2c529239",1.12061,53.14415,132,0,"Sheringham Shoal Offshore Substation 1"],["s138b255b4bf",1.17583,53.12671,132,0,"Sheringham Shoal Offshore Substation 2"],["s9daf0b6492c",-2.38883,57.21803,275,0,null],["s96810d1592a",0.12495,51.46373,750,0,"Bexleyheath DC Traction Substation"],["sc068b12ec6a",0.08626,51.46018,750,0,"Falconwood DC Traction Substation"],["sb0bb0305611",-0.05776,51.49093,750,0,"South Bermondsey DC Traction Substation"],["sc9f2c841836",0.02933,51.48674,750,0,"Charlton DC Traction Substation"],["s6232ba2dc90",-0.03325,51.45391,750,0,"Crofton Park TPH"],["s8f66a7cd467",-0.04977,51.39766,750,0,"Elmers End DC Traction Substation"],["s93e23cfe624",0.20614,51.40255,750,0,"Tweed Hill DC Traction Substation"],["s2d95e5329ae",-0.18915,51.3592,750,0,"Sutton DC Traction Substation"],["s049b5735aa2",-0.13741,51.42083,750,0,"Streatham DC Traction Substation"],["sec28f03074a",-0.21518,51.41505,750,0,"Wimbledon DC Traction Substation"],["s0914e051c35",-0.18313,51.44682,750,0,"Earlsfield DC Traction Substation"],["s439e9735a5b",-0.19515,51.43378,750,0,"Durnsford Road DC Traction Substation"],["s0a54091d88b",-0.19638,51.38083,33,0,"St Helier Primary Substation"],["s951b36e4a4b",-0.19649,51.3806,750,0,"St Helier DC Traction Substation"],["s37511551167",0.1193,51.49085,750,0,"Abbey Wood DC Traction Substation"],["s5ffa81ec56d",0.25279,53.65854,132,1,"Humber Gateway Offshore Substation"],["s06c0649a6c8",-0.23172,53.74703,275,1,"Humber Gateway onshore substation"],["s9be73c5a65b",-0.23243,53.74665,275,0,"Westermost Rough OWF onshore substation"],["sa8ae0f57bd8",0.13315,53.80501,150,0,"Westermost Rough Offshore Substation"],["s3f383272cba",-1.098,54.61759,66,0,"Warrenby 66kV substation"],["seccb9eb5d5c",-2.32105,53.79536,400,0,"Padiham Substation"],["sb9b1d0cf16f",-2.32747,53.79454,132,3,"Padiham Substation"],["s7599ff8943b",0.00047,51.68346,33,0,"Waltham Abbey Primary"],["sb89102f5717",-0.04611,51.68377,132,0,"Waltham Park Grid"],["s1cfa072dc97",-2.92418,56.47569,33,3,"Milton of Craigie"],["sc30ae58b084",-2.97636,56.46863,33,0,null],["s5e33958abdb",-1.08185,50.81188,33,0,null],["scb07a44b9e7",-1.0656,50.81983,33,0,null],["seb65c705719",-0.07692,51.54804,750,0,"Kingsland DC Traction Substation"],["s443967a876b",-2.46353,53.69223,33,0,"India Street"],["se464211c68b",-1.98437,53.35158,33,0,"Gowhole"],["s73678f0047a",0.96388,50.9142,275,0,null],["s51c3848e047",-0.04995,51.69346,132,0,null],["s8ceeda6ffd3",-0.05314,51.48491,33,0,"Rotherhithe Switching Station"],["s332dba4b585",-0.27784,51.48682,750,0,"Chiswick DC Traction Substation"],["sd19b7dc21af",-0.34084,51.47287,750,0,"Isleworth DC Traction Substation"],["s5e12c2c0806",-0.37186,51.45427,750,0,"Hounslow Junction DC Traction Substation"],["s103a736599e",-0.26781,51.33515,750,0,"Epsom DC Traction Substation"],["sc7434d9c299",-0.0355,51.4129,750,0,"New Beckenham DC Traction Substation"],["scc9877f04f1",-2.22123,53.80628,33,0,null],["sbec5140276d",-0.24419,51.38327,750,0,"Worcester Park DC Traction Substation"],["s5dd00b804c4",-0.28251,51.37502,750,0,"Tolworth DC Traction Substation"],["s56db37ebc4e",-0.28023,51.39957,750,0,"Berrylands DC Traction Substation"],["se816bd27561",-0.30401,51.41319,750,0,"Kingston DC Traction Substation"],["s94df5ba7d5b",-0.34306,51.43534,750,0,"Fulwell DC Traction Substation"],["s312a737e17d",-0.37751,51.41634,750,0,"Hampton DC Traction Substation"],["s8e8f9a33a02",-0.40242,51.4495,750,0,"Feltham DC Traction Substation"],["s64be7f7aa78",-0.43443,51.44279,750,0,"Bedfont DC Traction Substation"],["s6eb3c19d810",-0.47052,51.43608,750,0,"Ashford DC Traction Substation"],["s2a8af79274a",-0.50604,51.43305,750,0,"Staines DC Traction Substation"],["s489c9ec2edb",-0.54632,51.42936,750,0,"Egham DC Traction Substation"],["s1d52a65fd23",-2.89578,58.25684,220,0,"Beatrice OWF OTM West"],["s0fc97142d3b",-2.88062,58.24995,220,0,"Beatrice OWF OTM 1"],["s9c0d61f2ab8",-0.39141,51.31703,750,0,"Cobham DC Traction Substation"],["s4c7f8e6df8e",-0.47485,51.26866,750,0,"East Clandon DC Traction Substation"],["sc50b6867630",-0.05175,50.81079,33,0,null],["sae29c4ce170",-0.05462,50.80794,33,0,null],["s88e1b96a17f",-0.05898,50.80507,33,0,"523014 : NEVILL ROAD"],["scb10df78765",-0.04111,50.80909,33,0,null],["s22bb132bb3a",-2.89595,56.64353,33,0,"Lochside"],["sd4150122db7",-0.43309,51.36904,750,0,"Oatlands DC Traction Substation"],["sfe2e0a51bb6",-0.46286,51.35866,750,0,"Weybridge DC Traction Substation"],["sa6fbb727838",-0.48393,51.34817,750,3,"New Haw DC Traction Substation"],["s1e0af4845a5",-0.51127,51.33728,750,0,"Byfleet DC Traction Substation"],["s8555e139c18",-0.53561,51.32704,750,0,"Sheerwater DC Traction Substation"],["s5b7cc09c30d",-0.5673,51.31407,750,0,"Woking DC Traction Substation"],["sae951225595",-0.58405,51.27863,750,0,"Worplesdon DC Traction Substation"],["se747da4652e",-5.46662,57.41911,33,0,null],["s2db0c3edea8",0.74725,51.41369,33,0,"Queenborough 33/6.6KV"],["s210181c28df",-2.59107,56.601,33,0,null],["sd55f4c80230",-0.6659,51.24478,750,0,"Wanborough DC Traction Substation"],["s5a9b13e18fb",-0.81238,51.20411,750,0,"Wrecclesham DC Traction Substation"],["sccf176f8234",-0.85071,51.18911,750,0,"Bentley DC Traction Substation"],["s9828eafc07a",-0.89005,51.17544,750,0,"Islington DC Traction Substation"],["se020c8dc7d9",-0.93327,51.16777,750,0,"Alton DC Traction Substation"],["s725190e5d87",-0.59687,51.30797,750,0,"St Johns DC Traction Substation"],["sf9ec2cb01e4",-0.6767,51.29919,750,0,"Pirbright DC Traction Substation"],["sb0e0baa8b22",-0.67263,51.40551,750,0,"Ascot DC Traction Substation"],["s455aa20e0ca",-0.63539,51.3928,750,0,"Sunningdale DC Traction Substation"],["s166431672ce",-0.49223,51.3777,750,0,"Addlestone DC Traction Substation"],["s4fbfe556e93",-0.52891,51.39173,750,0,"Chertsey DC Traction Substation"],["s9491ba7adcc",-0.56163,51.40342,750,0,"Virginia Water DC Traction Substation"],["sa030d55f24f",1.34588,51.30888,132,1,"Thanet Offshore Wind Farm onshore substation"],["sd3af94a1ae3",1.34588,51.30844,132,1,"Richborough Grid"],["s64b5114b2ae",-0.71037,51.40644,750,0,"Whitmoor DC Traction Substation"],["se948f8b0de2",-0.79279,51.40927,750,1,"Buckhurst DC Traction Substation"],["s36f57c180bf",-0.85954,51.4227,750,0,"Emmbrook DC Traction Substation"],["s3f5ddc8cb21",-0.89153,51.43682,750,2,"Winnersh DC Traction Substation"],["s80682e55a9e",-0.95922,51.4579,750,0,"Reading DC Traction Substation"],["s14638a1e430",-0.07038,51.40507,750,0,"Norwood Junction DC Traction Substation"],["sddd7b844c5f",-0.10205,51.40011,750,0,"Belle Vue DC Traction Substation"],["s416f8016267",-0.08404,51.38806,750,0,"Selhurst DC Traction Substation"],["s23341a8774f",-0.16165,51.35802,750,0,"Wallington DC Traction Substation"],["s952187d5d9b",-0.09301,51.3738,750,0,"East Croydon DC Traction Substation"],["s6878a02b4ff",0.94234,51.33812,132,0,"London Array OWF SVC pods"],["s187fa39d445",0.94234,51.33847,132,0,"London Array OWF SVC pods"],["s268ff226fc1",0.94172,51.33827,132,0,"London Array OWF SVC pods"],["s37175f29fa8",0.94126,51.33825,132,0,"London Array OWF SVC pods"],["s310978a67e9",0.94183,51.33767,400,0,"London Array OWF substation"],["sf74812c1b25",-0.11621,51.33512,750,0,"Purley DC Traction Substation"],["s22cf5d94894",-0.13609,51.31869,750,0,"Coulsdon North DC Traction Subtation"],["s766700a8c2a",-0.15091,51.29801,750,0,"Star Lane DC Traction Substation"],["sa6c1d2f1c88",-0.15003,51.26339,750,0,"Merstham DC Traction Substation"],["s4472196d4fc",-0.15078,51.27218,750,0,"Shepherds Hill DC Traction Substation"],["s36188d23d4b",-0.16008,51.24893,750,0,"Holmethorpe DC Traction Substation"],["s1801b9b55e2",-0.1622,51.20028,750,0,"Salfords DC Traction Substation"],["sf46ab1fcc35",-0.21852,51.32963,750,0,"Banstead DC Traction Substation"],["s3713fc2abc9",0.00279,51.21365,750,0,"Eden DC Traction Substation"],["se05928bd169",0.00788,51.21367,750,0,"Crowhurst Junction TPH and Switching Station"],["s9c99fa649c4",-0.27735,53.74657,33,0,"Northern Gateway Biomass"],["sca28a87183a",-0.16694,51.23559,750,0,"Redhill B DC Traction Substation"],["s37cd68de395",0.29939,51.18856,750,0,"Postern DC Traction Substation"],["sc018b489e10",0.32984,51.18644,750,0,"Tudeley DC Traction Substation"],["s4bdd777ddee",0.36214,51.18425,750,0,"Five Oak Green DC Traction Substation"],["sb66e26b7289",0.39375,51.1816,750,0,"Paddock Wood DC Traction Substation"],["sbc40ba09023",-0.16017,51.18165,33,0,"Horley Primary Substation"],["s6187c211ba3",-0.16882,51.13545,33,1,"Crawley Industrial East 33/11kV"],["scb7b6177c57",0.10083,51.39479,750,0,"St Mary Cray DC Traction Substation"],["se309b014f13",0.13859,51.39326,750,0,"Kevingtown DC Traction Substation"],["s0f71b9f5b9e",0.17039,51.39357,750,0,"Swanley DC Traction Substation"],["s85a62b4f924",0.2469,51.40107,750,0,"Darenth DC Traction Substation"],["sb8bfb53a4b2",0.28686,51.39948,750,0,"Fawkham DC Traction Substation"],["s7114e8afaae",0.32302,51.38981,750,0,"Hartley DC Traction Substation"],["s1042ca74e6c",0.35891,51.38659,750,0,"Meopham DC Traction Substation"],["s20b1303831c",0.43425,51.38023,750,0,"Lower Bush DC Traction Substation"],["s06fd24651f6",0.52242,51.37987,750,0,"Chatham DC Traction Substation"],["sa9d3edc5d7f",0.5584,51.38642,750,0,"Gillingham DC Traction Substation"],["s6bd732a9bc8",0.09087,51.3713,750,0,"Orpington DC Traction Substation"],["saccfb04127f",0.10908,51.35627,750,0,"Chelsfield DC Traction Substation"],["s09daf72e1a7",0.14207,51.3411,750,0,"Knockholt DC Traction Substation"],["sd82aab3aa19",0.18043,51.27924,750,0,"Sevenoaks DC Traction Substation"],["sb0ccf7a75e2",0.18477,51.27023,750,0,"Oakhill DC Traction Substation"],["s74159630cb8",0.20059,51.23638,750,0,"Weald DC Traction Substation"],["s79d4bc50c70",0.22803,51.21466,750,0,"Hildenborough DC Traction Substation"],["s84cc9f75fa1",0.25304,51.20392,750,0,"Hawden DC Traction Substation"],["s536056ef295",0.19962,51.37241,750,0,"Eynsford DC Traction Substation"],["scc21b940e47",0.19506,51.3486,750,0,"Lullingstone DC Traction Substation"],["s8f7f8497e0f",0.18838,51.324,750,0,"Greenhill DC Traction Substation"],["sfbc0d0650dc",0.19775,51.30292,750,0,"Otford Junction DC Traction Substation"],["s55cca60b82d",0.23275,51.29729,750,0,"Noahs Ark DC Traction Substation"],["sd61e233b51d",0.2731,51.29541,750,0,"Oldbury DC Traction Substation"],["sbfef3200ecb",0.31003,51.29336,750,0,"Borough Green DC Traction Substation"],["s9c2f58e5652",0.38408,51.30121,750,0,"Church Lane DC Traction Substation"],["sdf81c0d7c74",0.34725,51.29721,750,0,"Wrotham Heath DC Traction Substation"],["sab682a4bc9f",0.41798,51.29257,750,0,"(West) Malling DC Traction Substation"],["sa69a26903aa",0.45257,51.28388,750,0,"Ditton DC Traction Substation"],["s32ffd9af314",0.48828,51.28996,750,0,"Barming DC Traction Substation"],["s891355e58a3",0.54609,51.27086,750,0,"Mote Park DC Traction Substation"],["se1886169527",0.58286,51.27491,750,0,"Bearstead DC Traction Substation"],["s34884e40131",0.61789,51.3639,750,0,"Rainham DC Traction Substation"],["sf8ebbca71ba",0.41285,51.22809,750,0,"Yalding DC Traction Substation"],["s9a5232b66fc",0.46018,51.25963,750,0,"Teston DC Traction Substation"],["sc47d2e6461a",0.45819,51.30847,750,0,"New Hythe DC Traction Substation"],["s5876111ebe6",0.44527,51.35871,750,0,"Halling DC Traction Substation"],["sa80fdff7e22",0.48176,51.41486,750,0,"Tunnel DC Traction Substation"],["s0e36b5426f4",0.46104,51.43075,750,0,"Higham DC Traction Substation"],["s5a8036bb83b",0.42822,51.43767,750,0,"Uralite DC Traction Substation"],["sc0b060884b2",0.36,51.44022,750,0,"Gravesend DC Traction Substation"],["s8e0fe02c755",0.32085,51.44449,750,0,"Ebbsfleet DC Traction Substation"],["s98bd54ecb92",0.30314,51.44971,750,0,"Swanscombe DC Traction Substation"],["s03a44cfa4cb",0.30778,51.41398,750,2,"Hook Green DC Traction Substation"],["s8df2313bcf1",0.16062,51.46484,750,0,"Barnehurst DC Traction Substation"],["s7a72c54bfc3",0.1757,51.44761,750,0,"Crayford DC Traction Substation"],["s38e3f0695b8",-2.89642,51.34983,33,0,"West Wick Primary Substation"],["sf2b4d7ccde1",1.05099,52.07485,132,3,null],["s446534b5adc",-6.34535,54.45005,33,0,null],["sdb3661392a3",0.31894,51.44715,33,0,"Ebbsfleet Primary"],["s520b1badfd0",-2.66834,51.53969,400,0,null],["se2532c8777c",-3.45008,55.93685,33,0,null],["sfcf623d86a4",-3.60496,55.97416,33,0,"Linlithgow Substation"],["s97d4fda8bdf",-3.73147,55.99239,33,0,"Polmont Substation"],["sa07d23ed75c",-0.42244,53.81127,400,0,"Dogger Bank B Wind Farm Converter station"],["sb3cca575967",-1.11062,54.57509,400,0,"Dogger Bank C Wind Farm Converter station"],["sb0312fdfe72",-3.0024,53.06345,230,0,null],["sd49d521af16",-3.15533,53.39887,230,0,"Meols Substation"],["sbf8e6ad007b",-3.12568,53.39446,230,0,"Saughall Massie Substation"],["s80890cf11e5",-3.1105,53.40981,230,0,"Cadbury's"],["sc588cbf9b04",-3.09908,53.39836,230,0,"Hopfield Road Substation"],["sbd37008dc64",-4.28197,55.35409,132,1,"Enoch Hill substation"],["s5e61f55dbfe",-0.50555,52.10675,33,0,"West Bedford Primary"],["s32d3d2fcac2",-5.09774,50.3058,33,0,"Nanteague 33kv Solar Park"],["s5c7e71ad8ed",-5.07667,50.30237,33,0,"Penare Farm 33kV Solar Fm"],["sc1d20b46dc5",-1.49481,53.76495,132,1,"Stourton BSP"],["see91084218e",-1.49518,53.76503,33,4,"Stourton Primary"],["se5dda4e8585",0.56015,52.39701,33,0,"Lakenheath Gatehouse Primary Substation"],["s863703a0f05",-1.16002,53.61851,66,0,null],["sd1930b6f8dd",-0.74896,53.59678,132,7,"New Keadby 132kV GIS"],["se2c230bf88b",-2.44084,56.80286,33,0,null],["s217d97410ae",-0.23859,53.63839,400,0,null],["s1c36f237b69",0.93878,51.33974,400,0,"Cleve Hill Solar Park Substation"],["s07a394296b4",-1.40288,54.80536,400,0,"Hawthorn Pit Substation"],["se7d99d0779d",-0.41932,53.79778,132,0,null],["s656123efe66",-5.81642,56.8273,33,0,"Glenuig"],["sb15bc469516",-5.77488,56.8385,33,0,"Roshven 33kV Aerial Break"],["s275e289a8f0",-5.81497,56.80239,33,0,"Shona Beg 33kV/11kV Tx"],["saf072abe652",-3.74653,55.65692,33,0,"Hyndford Cemex Quarry Substation"],["s00caf870cb8",-0.01277,51.71523,275,0,null],["s618814632b4",-0.01263,51.71491,275,0,null],["sf5ce605496c",-0.00936,51.71461,275,0,null],["sf10875b3c94",-0.00972,51.71436,275,0,null],["sbc03d507f33",-0.02193,51.66366,275,0,null],["s83515dbc038",-0.02132,51.66356,275,0,null],["s6a3150b046d",-0.02214,51.66398,275,1,null],["s8752f4187be",-0.47456,52.15591,132,1,"ARA Grid"],["sb55803c3dae",-0.41171,51.79628,132,2,null],["sa5f5e20a182",-2.55272,51.5045,132,2,null],["s55181e37b6b",-2.51055,50.6603,400,0,null],["sfa77535cba6",-1.06633,53.13318,132,0,null],["sb413fb4ff0a",0.17536,51.44788,275,0,"Crayford Sealing End Compound"],["s4454cf3e952",-2.55586,51.50362,132,2,null],["s2a1bbcdcee4",-4.65069,53.30976,33,0,"Llaingoch"],["s86ff7089a1a",-4.62742,53.30394,33,0,"Holyhead"],["sf6f85430eca",-4.61789,53.29564,33,0,"Parc Cybi"],["s1333d2e58ae",-4.59622,53.29416,33,0,"Alpoco"],["s09316a4e25e",-4.48216,53.41359,132,1,"Wylfa"],["s4c8da881434",-2.0149,52.43216,275,1,null],["s82b51032bf4",-1.17951,52.8899,132,0,"Fairham Substation"],["s1a3e0f2b464",-3.13857,51.20327,400,0,null],["s91c74abb5ff",-1.04238,50.91687,400,1,null],["s1525fa32b92",-1.22659,50.89792,132,2,null],["se3db8db208f",-2.91428,51.58034,132,1,"Glan Llyn Grid Substation"],["sa4ac97791a1",-6.20517,54.63002,33,0,null],["s0e0f12d3638",-1.86709,52.51239,275,0,null],["se8160d09a95",-6.33861,54.1652,33,0,"__________ 33 kV Substation"],["sb7514f3f460",-4.28618,55.86343,132,1,"Finnieston Substation"],["sadb0bd2f678",-4.46028,55.90381,33,2,"Erskine Primary"],["s78ab99ba82a",-4.35427,55.9063,33,3,"Drumchapel Road Primary"],["s52b2277e48c",0.59667,51.41949,400,1,null],["s601b5728859",0.59627,51.42002,132,3,"Kingsnorth"],["s475b3493a58",-1.39454,50.9165,33,0,"Bevois Valley PSS"],["sd256b6bb887",-1.39546,50.89926,33,0,"Central Bridge PSS"],["s2befc8f3366",-1.39548,50.8961,33,0,"Old Docks PSS"],["sa5f21431c84",-1.32765,50.87659,33,0,"Hamble PSS"],["s1abee69914d",-2.06674,52.60522,275,2,null],["s94bab23fd62",-6.42929,54.44257,33,0,"______ 33 kV Substation"],["sba7d0bc84e5",-6.25107,54.46479,33,0,null],["saa508694e7a",-0.80911,53.35922,400,0,"West Burton Substation"],["s67cfc3c05e4",-0.80718,53.3604,132,2,"West Burton Substation"],["s0f861207082",-6.34256,54.48443,33,0,"___ 33 kV Substation"],["s437e8566959",-6.42399,54.44032,33,0,"______ 33 kV Substation"],["scbc2854da0e",-4.30357,55.27478,132,0,"Benbrack Windfarm Substation"],["s776c4a81a9c",-2.10388,53.64147,33,0,"Littleborough"],["s169199f4893",-2.73284,55.34239,33,0,"Pines Burn substation"],["sb17be0160d3",-1.44307,54.98626,33,0,"Garwood Street Primary"],["sdf4cf7a95cd",-1.43426,55.01277,33,0,"Tynemouth Central Primary"],["sb5c66630f61",-3.94683,52.92815,275,0,null],["sd407a96f876",-0.4558,51.51009,66,0,null],["sdb679a69145",-0.45538,51.50919,66,0,null],["sa8babc05237",-0.45447,51.51116,66,0,null],["sfe7ef7b129b",-3.40312,51.38838,275,3,"Aberthaw Substation"],["sdf0472ae326",-1.78795,53.6383,33,0,"Folly Hall"],["sd187f06c451",-1.78766,53.6433,33,0,"Grove Street"],["sd981a746ff4",0.36215,51.64007,132,0,null],["sb370145a496",-6.46159,54.87412,33,0,"Portglenone 33 kV Substation"],["sa35f8b1c55c",-2.14858,57.40454,33,0,null],["sbf6a9a780dc",0.01053,51.75862,400,4,"Rye House GIS"],["se675f0c164b",0.00859,51.75904,400,2,"Rye House AIS"],["s6f7dbad3c66",0.00799,51.75876,132,2,null],["s0183c9da07d",0.01056,51.76252,400,0,"Rye House Generation AIS"],["s8b50900bcc7",-6.94401,55.17458,33,0,"Magilligan Central 33 kV Substation"],["s0b16c1f091b",-2.35806,53.53929,132,6,null],["s6b9c0137705",-2.35798,53.53888,132,4,null],["s9845baf32ae",-6.9605,54.49403,33,0,"Tullyvannon 33 kV Substation"],["sd3f7b688cf0",-3.20156,55.93128,275,0,"Whitehouse"],["sba0a8f27b28",-0.34107,51.65969,275,9,null],["see7797cfd60",1.24607,52.63002,33,0,"Earlham West Primary Substation"],["s68c709ca096",-3.86071,56.0076,275,5,"Bonnybridge Substation"],["s0a862ad4443",1.27161,52.65581,33,0,"Boundary Park Primary Substation"],["s03289d9dd5d",-0.50137,51.93397,400,3,"Sundon Substation"],["sb83061c7219",0.57601,51.86578,400,1,"Braintree Substation"],["sdb3d249fb3f",0.72303,52.24,132,1,"Bury St Edmunds Substation"],["s1ff9b3e1de7",-2.60528,50.94982,132,1,"Yeovil Substation"],["s9f4a30671e3",-3.95865,51.68613,400,4,"Swansea North Supergrid Substation"],["sc18eb80584c",-4.08986,52.09514,132,2,"Lampeter Substation"],["sc97868348f9",-4.32153,52.18846,132,0,"Llanarth Substation"],["s327efc0a5ca",-0.4844,51.35061,400,0,"West Weybridge Substation"],["s5c3e6395e73",-2.92164,50.78701,132,1,"Woodcote Substation"],["s1bb5e494cc8",-0.75593,53.59805,400,3,"Keadby Substation"],["sd3fe12ecb87",-2.51243,52.63209,400,1,"Ironbridge Substation"],["s94d6767da70",-4.04769,52.41243,132,0,"Aberystwyth Substation"],["sa2d26d93461",-2.48447,53.10286,132,4,"Crewe Substation"],["sf66b30bc80b",-2.40216,53.43453,400,3,"Carrington AIS Substation"],["sd5c1ef98e5e",-4.07988,55.75179,400,0,"Strathaven Substation"],["s2b9dd94d871",-2.75654,53.74479,400,5,"Penwortham Substation"],["s0d5b48f1142",-3.75372,58.57573,275,0,"Dounreay Substation"],["sc587c8475df",-2.537,51.73654,132,0,"Lydney Substation"],["sc39d391add0",-1.0443,53.94914,33,0,"York University"],["sa265c1b505e",-0.2395,51.73634,132,3,"Hatfield Substation"],["sb87d21df09a",-2.57063,51.48556,132,4,"Lockleaze Substation"],["s98342a5675a",-4.98589,51.71028,132,1,"Waterston Substation"],["se779bb4b832",-2.92517,53.4187,275,0,"Lister Drive Substation"],["scac9265412d",-4.54346,53.27391,132,3,"Caergeiliog Substation"],["s2fc7b69316e",-3.87248,55.55786,33,0,"Douglas West Substation"],["sfe0237b048b",-1.32867,50.82169,400,1,"Fawley Substation"],["s880430926e9",-3.01679,51.67991,132,0,"Panteg Primary Substation"],["s03625413279",-1.28587,50.74582,132,2,"East Cowes Substation"],["s79c5d086d6d",-4.89967,50.39493,400,6,"Indian Queens Substation"],["s1b1d08a3189",-4.11235,50.36812,132,3,"Plymouth Substation"],["s3f1249c9850",-2.04334,53.49244,400,8,"Stalybridge Substation"],["sc3b1de27856",-3.05055,55.03265,400,2,"Gretna Substation"],["s52671f76cc5",1.34639,51.31004,400,0,"NEMO Link converter station"],["se93b4be054a",-1.4961,53.77714,275,1,"Skelton Grange"],["s2f00ab3b379",-2.67032,54.29774,400,2,"Hutton Substation"],["s6ce6e594a10",-1.55496,54.70579,400,2,"Spennymoor Substation"],["sc5f18ec7a58",-2.32539,55.66972,400,0,null],["s040ab262e15",0.82587,52.82894,132,0,"Hempton Substation"],["s00e39741be1",-0.99166,51.9286,33,2,null],["s460b6d8997d",-3.29896,51.57457,275,5,"Upper Boat Supergrid Substation"],["s77a2cb0de8d",-3.89822,51.62512,132,4,"Tir John Grid Substation"],["s23ecfa081f5",-5.0305,51.68145,132,2,"Texaco Substation"],["s380badc1ba5",-2.5653,51.44914,132,4,"Feeder Road Substation"],["s65e1731804b",-2.2424,53.02935,132,2,"Newcastle Substation"],["saa3d1796e79",-2.1768,53.08001,132,4,"Whitfield Substation"],["s16e446d888f",-2.1684,53.01286,132,2,"Stagefields Substation"],["s625da593bd7",-1.40057,52.90526,132,2,"Spondon Substation"],["se745a51b804",-4.98948,51.68216,400,3,"Pembroke Substation"],["sd596a403fec",-1.25508,52.86348,400,5,"Ratcliffe-on-Soar Substation"],["s73b2d23270e",-2.48025,52.71,33,2,"Sankey Substation"],["s474bcb0d083",-1.70864,52.52782,132,8,"Lea Marston Substation 132kV"],["sdfda179675f",-2.34017,53.55151,132,2,"Radcliffe Substation"],["sc09b503b26c",-0.01734,51.50821,132,0,null],["s9d044c75240",-1.51967,53.68242,33,0,"Alverthorpe Road"],["s83218e1ea84",-0.32175,51.51029,33,0,null],["scec8ddc5731",0.24922,51.46057,400,0,"Littlebrook/W Thurrock Cable Compound"],["sa92c3bb74e4",-2.96168,54.94244,400,4,"Harker Substation"],["sd1234de61bb",0.40475,51.63155,33,0,"Gooseberry Green Substation"],["sf4cd60ddadb",-3.07774,53.23064,400,1,"Connah's Quay 400kV AIS"],["s3618ae0a5e9",-0.74259,51.31399,33,0,"Frimley Substation"],["s5987bc8c2e1",-5.26899,50.11102,33,0,null],["s56e237076d4",-3.97699,51.60845,33,0,"Swansea University Primary Substation"],["scbf31d2c126",-3.19625,51.765,132,2,"Ebbw Vale Primary Substation"],["s93cdf96b4b0",-2.89034,54.03234,400,2,"Heysham Substation"],["s1394ab5fdd0",0.35877,51.41838,33,0,"Gravesend South"],["sc8f591ddf1b",-0.23123,53.74746,275,0,"Hedon 275kV Substation"],["s10544467d3e",-2.97737,51.54761,275,3,"Uskmouth Grid Substation"],["s9a1b3264ed4",-2.35796,53.53818,400,4,"Kearsley Substation"]],"linkFields":["fromIdx","toIdx","km","parallel"],"links132":[[0,5546,28.324,1],[1,4756,12.511,1],[3,2046,40.017,1],[60,277,14.156,1],[60,4273,19.359,1],[82,105,1.246,1],[82,1931,5.663,1],[105,735,2.014,1],[116,2671,6.737,1],[116,4335,11.427,1],[144,1171,1.087,1],[144,2623,3.96,2],[144,3434,3.36,2],[148,1747,2.384,1],[148,1900,8.16,1],[152,657,2.391,1],[152,659,5.652,1],[152,5794,8.646,1],[182,2924,0.366,2],[183,404,0.037,1],[187,5683,1.585,1],[188,365,2.871,1],[188,2672,0.189,2],[188,5728,0.017,2],[193,541,30.25,1],[193,557,16.31,1],[193,4782,1.112,2],[194,236,5.349,1],[194,1021,1.049,2],[196,5683,10.744,1],[197,204,1.264,2],[197,5421,3.409,1],[199,246,9.061,1],[199,251,6.209,1],[200,207,3.77,1],[200,4989,4.075,1],[201,266,35.346,1],[201,865,14.488,1],[201,872,3.609,1],[204,243,6.718,1],[204,1777,8.733,1],[204,1864,1.708,1],[204,1909,10.413,1],[205,290,2.798,1],[205,294,3.728,1],[205,1837,7.806,1],[205,2971,0.849,2],[206,242,0.775,1],[206,633,1.697,1],[208,2457,0.262,1],[208,2620,1.563,1],[208,2680,5.968,1],[208,4974,0.618,1],[210,264,13.379,1],[210,1433,5.239,1],[210,5073,11.262,1],[211,213,7.625,1],[212,213,0.198,3],[213,4443,9.04,1],[213,5279,11.622,1],[214,5279,1.739,1],[217,219,0.496,1],[217,221,7.696,1],[217,362,18.689,1],[220,5728,6.396,1],[223,224,2.298,1],[226,5526,1.702,1],[228,423,13.006,1],[228,5526,1.511,1],[229,237,5.851,1],[230,232,1.455,1],[230,233,0.673,1],[231,1882,5.192,1],[231,2115,3.81,1],[236,1835,1.703,3],[236,5682,5.315,1],[240,439,4.869,2],[240,457,2.407,2],[240,649,1.729,1],[240,873,0.305,2],[240,2052,4.809,1],[241,987,3.174,1],[241,2103,6.689,1],[241,4408,1.804,1],[241,4409,1.72,2],[242,244,8.063,1],[242,634,2.208,1],[242,639,21.578,1],[242,5408,10.682,1],[242,5790,0.379,1],[243,2098,3.612,1],[246,479,64.844,1],[246,4989,0.244,2],[247,253,6.706,1],[247,4989,1.729,1],[248,415,3.294,1],[248,750,3.322,1],[249,251,1.29,1],[250,251,1.145,2],[252,3107,3.477,1],[254,1467,0.27,2],[254,3141,1.301,1],[254,3142,0.585,2],[254,5369,0.441,1],[255,442,6.092,1],[255,524,12.638,1],[255,1728,15.19,1],[255,1781,9.758,1],[255,2277,3.346,1],[258,358,5.73,1],[259,3389,2.258,1],[260,1163,1.575,1],[260,1238,5.167,1],[260,3389,2.954,1],[260,3522,0.805,2],[262,263,0.416,1],[262,1545,2.242,1],[263,1463,0.34,1],[265,269,9.747,2],[265,804,0.545,1],[268,2671,0.189,1],[269,297,5.8,1],[269,369,2.51,1],[270,5223,12.584,1],[271,272,6.903,1],[271,2980,29.634,1],[273,274,0.323,1],[273,3089,18.115,1],[273,5580,2.308,1],[277,1123,14.44,1],[277,1269,2.248,1],[278,286,7.313,1],[278,434,1.501,1],[278,3797,0.541,1],[281,785,10.36,1],[281,3928,1.504,1],[282,4171,0.791,1],[283,510,27.056,1],[283,1294,21.744,1],[283,2210,11.489,1],[285,4760,12.244,1],[286,595,2.228,3],[286,1178,1.689,2],[287,2994,0.7,1],[288,688,12.959,1],[290,1388,9.857,1],[290,1516,2.58,1],[291,708,13.216,1],[291,3107,15.341,1],[292,5439,5.64,1],[293,2971,1.112,1],[294,2181,0.106,1],[295,296,2.238,1],[295,711,15.955,1],[295,723,4.961,1],[295,4755,1.445,1],[297,386,1.817,1],[299,1096,8.135,1],[300,5780,5.626,1],[301,304,15.693,1],[301,453,7.561,1],[301,2068,3.313,1],[302,322,2.726,1],[303,798,2.711,1],[303,2424,4.263,1],[303,5051,1.671,1],[303,5099,0.191,2],[304,340,15.678,1],[304,2182,3.612,1],[305,340,3.169,1],[305,1516,4.474,1],[305,2067,4.928,1],[306,383,6.325,1],[306,620,5.879,1],[306,801,10.075,1],[306,1190,4.634,2],[306,4218,7.165,1],[310,349,29.141,1],[310,821,4.337,1],[310,5435,4.328,1],[312,5437,7.699,1],[315,821,0.295,3],[315,1818,2.285,1],[318,328,1.828,1],[318,606,3.291,1],[319,351,6.667,1],[320,322,3.5,2],[320,420,1.352,1],[320,5782,7.524,1],[321,1021,9.131,1],[322,395,3.439,1],[323,595,3.413,1],[323,3797,0.092,2],[324,607,11.178,1],[324,1741,12.066,1],[325,983,36.81,1],[325,1742,15.149,1],[325,2612,0.75,1],[325,5135,5.038,1],[328,712,23.1,1],[329,422,3.653,1],[329,440,3.828,1],[330,5102,0.148,1],[331,1608,1.165,1],[331,2448,1.784,1],[331,2450,0.707,1],[332,5679,1.778,1],[334,1322,10.756,1],[334,4296,5.121,1],[335,395,10.94,1],[335,1178,0.404,4],[336,3915,2.249,1],[336,5323,5.947,1],[338,770,10.361,1],[339,1043,9.384,2],[339,5333,3.304,1],[340,3416,2.014,1],[341,350,18.628,1],[347,4999,9.299,1],[350,642,32.093,1],[350,728,11.314,1],[350,2972,2.241,1],[350,2982,0.125,2],[350,3812,7.842,1],[359,760,2.281,1],[361,364,19.95,1],[361,4443,12.141,1],[362,363,9.556,1],[363,5668,6.386,1],[365,5668,14.094,1],[366,2081,7.706,1],[366,3719,4.562,1],[369,2176,1.595,1],[370,421,0.437,5],[370,4338,0.077,2],[371,981,0.28,1],[371,4163,2.488,1],[372,377,1.22,1],[372,382,9.839,1],[373,377,1.505,1],[373,1930,2.406,1],[373,4163,0.219,1],[374,4189,0.179,2],[376,4163,12.494,1],[378,1225,4.193,1],[378,5248,0.057,1],[379,594,13.485,1],[379,935,5.244,1],[379,1335,34.259,1],[379,2250,12.365,1],[379,5034,8.53,1],[380,431,15.585,1],[380,1912,1.965,1],[380,3528,4.359,1],[381,416,6.072,1],[381,771,4.134,1],[381,4476,1.948,2],[381,4477,4.475,1],[381,5192,0.665,1],[382,1572,4.073,1],[383,1827,2.508,1],[387,388,0.329,2],[387,937,15.617,1],[388,917,19.339,2],[391,559,6.427,1],[391,571,3.955,1],[391,5692,7.69,2],[392,5202,0.032,1],[392,5782,0.559,1],[393,394,0.127,2],[393,602,2.229,1],[393,1757,1.367,1],[393,2467,2.388,1],[394,602,1.212,1],[395,434,2.384,1],[397,1071,22.43,1],[398,760,10.826,1],[399,1749,63.166,1],[399,2784,43.961,1],[400,5767,12.873,1],[401,413,8.343,1],[402,4731,1.983,1],[402,5217,10.588,1],[404,973,6.825,1],[404,1663,38.665,1],[408,409,0.328,3],[408,1694,6.089,1],[408,1975,15.515,1],[408,3670,6.582,1],[409,2618,4.257,1],[413,430,14.816,1],[415,446,22.159,1],[416,3952,7.351,1],[416,4228,3.366,1],[420,1128,6.862,1],[420,2175,4.005,1],[420,5201,2.243,1],[421,575,11.927,1],[422,2175,7.084,1],[430,662,13.653,2],[431,2929,16.692,1],[431,2931,28.186,1],[432,1276,12.354,1],[432,2072,2.828,1],[432,2223,34.723,1],[432,2687,6.992,1],[432,3509,4.495,2],[433,2687,0.6,1],[433,3509,2.802,2],[433,4241,0.333,1],[434,2502,5.161,1],[435,1843,0.454,1],[435,3034,1.222,1],[439,457,2.365,1],[439,2052,0.607,1],[440,457,1.11,1],[440,873,5.599,1],[440,1116,0.824,2],[442,2060,5.724,1],[443,5730,7.04,1],[444,801,1.712,1],[446,561,17.002,1],[446,970,5.771,1],[448,2092,7.443,1],[452,453,5.169,1],[453,2068,6.296,1],[453,2511,7.12,1],[454,2511,10.654,1],[454,5747,19.365,1],[455,1745,0.995,1],[459,1195,2.09,1],[459,1280,3.235,2],[459,1753,12.791,1],[459,2021,24.711,1],[459,5690,3.47,1],[463,666,4.952,1],[463,5266,0.273,3],[464,465,7.447,1],[464,1752,9.109,1],[464,5776,9.163,1],[464,5777,7.2,1],[465,4637,4.317,1],[466,596,1.03,1],[466,5744,38.355,1],[466,5775,15.857,1],[466,5777,11.903,1],[467,503,10.71,1],[467,640,10.18,1],[467,3929,8.621,1],[468,570,2.948,1],[468,1556,9.338,1],[468,5266,16.469,1],[470,734,16.429,1],[470,2285,0.849,1],[472,473,0.336,2],[472,5199,0.591,1],[473,926,0.588,2],[475,476,4.04,1],[476,563,4.577,1],[476,5667,0.145,1],[477,518,11.751,1],[477,700,6.395,1],[477,852,20.245,1],[477,1670,19.048,1],[477,1671,7.958,1],[477,1768,10.81,1],[478,892,16.883,1],[478,1739,22.588,1],[479,686,9.097,1],[479,2605,3.584,1],[479,5392,2.299,1],[480,2234,3.569,1],[480,4488,0.029,2],[480,5752,1.717,1],[483,3215,18.74,1],[483,5455,52.472,1],[483,5788,2.143,1],[484,4418,10.346,1],[485,2937,3.545,1],[485,5488,0.067,2],[489,852,14.106,1],[489,1889,1.129,2],[492,1935,4.145,1],[493,535,30.498,1],[493,1426,3.387,1],[493,4621,0.558,1],[499,501,9.937,1],[501,1045,5.534,1],[502,503,1.471,1],[502,505,10.521,1],[503,640,7.14,1],[504,1049,13.318,1],[504,5759,4.684,1],[505,859,7.655,1],[507,863,27.663,1],[507,5219,1.664,1],[509,5730,18.297,1],[510,956,15.665,1],[510,1735,10.816,1],[510,2625,9.548,1],[511,1308,22.631,1],[512,954,11.932,1],[513,514,1.505,2],[513,4849,2.628,1],[515,516,5.737,1],[516,517,5.278,1],[516,5210,47.109,1],[518,569,21.484,1],[519,3607,3.276,1],[519,4386,1.835,2],[521,1682,4.108,1],[524,1393,11.669,1],[526,3142,5.248,1],[526,4859,10.533,1],[529,4621,6.595,1],[534,640,31.508,1],[535,538,0.371,2],[535,1659,19.901,1],[537,538,0.162,3],[537,1537,28.492,1],[538,576,30.041,1],[538,4631,13.787,1],[538,4632,4.778,1],[538,5112,5.08,1],[539,547,2.062,2],[539,548,4.099,1],[539,719,0.335,1],[541,695,5.646,1],[541,3178,2.29,1],[543,1542,1.74,1],[543,5112,17.2,1],[544,546,17.279,1],[544,5689,1.968,1],[546,2992,7.301,1],[547,720,5.48,1],[547,721,5.544,1],[549,781,11.861,1],[549,2101,10.671,1],[549,2980,0.517,3],[549,3089,0.934,1],[551,1194,13.828,1],[552,3413,23.67,1],[552,3646,10.386,1],[554,813,8.056,1],[554,3108,6.588,1],[555,784,11.23,1],[557,559,4.527,1],[557,560,6.774,1],[566,1085,0.636,1],[566,2186,0.5,1],[566,2187,0.604,1],[568,569,2.72,1],[569,1670,10.406,1],[569,1739,1.737,1],[572,573,0.182,1],[572,628,22.557,1],[572,5697,4.069,1],[574,575,0.137,3],[574,4260,9.633,1],[574,4959,1.446,1],[576,3338,11.699,1],[576,3594,4.699,1],[577,582,13.111,1],[577,1430,14.36,1],[577,1496,5.107,1],[577,2534,16.565,1],[577,2658,0.507,1],[577,3594,15.568,1],[577,4371,1.684,1],[578,5253,0.227,3],[579,1024,14.852,1],[579,4519,2.264,1],[583,585,5.815,2],[583,1710,7.821,1],[584,585,9.551,1],[585,1140,10.394,2],[585,1187,2.488,1],[586,1161,10.871,1],[586,4221,1.771,2],[590,687,4.52,1],[591,5745,4.478,1],[594,2247,1.451,1],[595,4043,5.272,1],[598,1271,3.19,2],[598,3456,3.435,3],[599,1021,30.25,1],[602,3404,0.413,1],[606,774,7.609,1],[607,1342,2.665,1],[614,5747,1.842,2],[615,4099,1.535,1],[615,4171,3.233,1],[615,4172,1.726,1],[616,5776,2.273,1],[618,1827,2.382,1],[619,709,7.868,1],[619,762,0.858,1],[619,5450,1.376,1],[621,622,0.898,2],[622,2729,21.695,1],[622,4864,3.653,1],[623,5438,12.209,1],[623,5628,12.214,1],[623,5734,23.209,1],[627,5034,0.08,2],[628,1704,1.392,1],[629,5762,5.318,1],[630,631,13.244,1],[630,5762,16.118,1],[635,636,11.278,1],[635,5236,0.107,15],[637,2134,26.444,1],[638,2847,1.459,1],[639,1181,0.598,1],[639,2093,20.033,1],[639,2332,6.263,1],[639,2847,3.374,1],[639,3183,37.078,1],[642,919,1.871,1],[642,2283,0.753,1],[645,1171,2.511,1],[645,3443,14.179,1],[645,4213,0.469,1],[646,4207,1.465,1],[647,3443,4.384,1],[647,5772,7.327,1],[648,659,6.067,1],[648,660,7.177,1],[648,5771,5.6,2],[649,3798,0.914,1],[650,860,8.19,1],[651,1651,17.387,1],[651,5321,13.73,1],[652,653,1.679,1],[652,4253,0.171,1],[652,5794,7.706,1],[657,4342,0.103,2],[660,2746,12.413,1],[661,662,1.606,2],[661,3635,3.018,1],[662,1692,32.34,1],[666,3209,0.18,1],[667,1912,26.123,1],[667,5219,33.689,1],[669,810,0.106,1],[669,3441,2.454,1],[670,1607,2.985,1],[670,1946,3.104,1],[670,4034,1.537,1],[671,688,2.118,1],[671,774,2.571,1],[674,1111,17.812,1],[676,1338,7.14,1],[685,852,6.009,1],[694,1721,23.655,1],[694,1936,7.641,1],[695,3153,0.834,1],[698,5732,5.633,1],[699,1027,15.427,1],[699,1063,29.646,1],[699,1083,31.846,1],[699,5760,3.613,2],[701,5760,9.196,1],[702,1884,2.54,1],[702,3107,18.959,1],[703,704,32.423,1],[703,1287,39.069,1],[704,898,7.827,1],[704,2135,30.195,1],[704,5323,6.078,1],[708,813,13.595,1],[708,3105,1.334,1],[712,713,9.821,1],[713,4754,11.149,1],[713,5733,19.023,1],[714,3201,4.741,1],[714,4115,1.234,1],[715,1457,4.211,1],[715,3936,0.066,2],[715,5650,6.832,1],[717,718,3.876,1],[717,5650,13.119,1],[718,1949,1.683,1],[718,3457,0.046,1],[720,721,0.198,1],[723,1030,9.11,1],[726,3490,0.021,1],[727,728,28.833,1],[727,729,2.306,1],[727,1537,25.031,1],[729,3986,27.616,1],[730,1542,2.669,1],[730,4609,24.16,1],[731,991,29.195,1],[731,2972,32.209,1],[731,4609,15.252,1],[733,1393,19.556,1],[733,1480,0.354,2],[733,1682,6.193,1],[733,3409,10.379,1],[733,3437,21.733,1],[735,2924,4.528,1],[735,4177,11.945,1],[736,4631,23.283,1],[741,5719,3.775,1],[743,933,10.068,1],[743,3955,5.282,1],[745,5719,10.812,1],[747,1824,21.55,1],[749,1970,38.468,1],[749,2922,25.475,1],[751,4696,0.867,1],[752,5065,10.679,1],[754,919,19.995,1],[754,996,1.559,1],[754,3812,15.964,1],[770,1259,58.491,1],[770,1896,0.348,1],[774,4756,16.292,1],[789,1067,1.591,1],[796,2050,6.924,1],[797,3797,0.545,1],[798,2447,0.889,1],[800,3163,1.86,1],[801,2052,2.603,1],[814,2704,9.9,1],[814,4663,18.051,1],[814,5737,22.945,1],[815,1434,42.586,1],[815,2623,21.241,1],[815,4663,0.083,5],[818,942,18.653,1],[818,975,21.47,1],[818,4999,3.834,1],[821,1818,0.095,2],[843,1997,23.025,1],[843,2324,17.744,1],[843,4957,5.334,1],[843,5488,6.337,1],[844,2274,1.062,1],[845,1679,11.889,1],[845,2109,27.93,1],[847,1442,12.851,1],[847,5737,43.158,1],[850,2115,5.821,1],[852,5732,26.258,1],[858,1183,0.712,1],[863,1219,3.197,1],[863,2003,16.466,1],[863,4777,16.44,1],[863,5105,0.404,1],[865,866,6.207,1],[867,1076,12.824,1],[868,869,2.308,1],[869,1894,22.974,1],[879,5199,5.959,1],[885,1206,4.178,1],[888,1308,8.074,1],[888,5382,5.356,1],[892,3600,3.815,1],[892,3605,4.246,1],[892,4386,3.377,2],[898,5323,4.313,1],[900,2027,4.464,1],[900,2803,5.121,2],[900,5352,7.217,1],[905,1998,41.05,1],[905,5217,0.134,3],[914,1189,5.446,2],[914,1196,4.26,1],[917,1025,22.344,1],[919,1723,3.183,1],[919,2285,3.447,1],[922,1255,7.014,1],[922,3955,1.63,1],[926,5199,1.578,2],[928,1619,0.786,1],[928,1620,0.598,2],[928,2187,0.608,1],[928,2188,0.537,1],[928,2503,4.348,1],[930,1847,9.512,1],[930,2155,0.988,1],[933,2155,5.711,1],[939,4207,0.275,1],[942,1897,9.667,1],[948,3969,11.539,1],[949,2419,2.229,1],[955,956,0.071,3],[956,2625,9.634,1],[961,3413,7.149,1],[963,1703,14.727,1],[964,2204,2.375,1],[964,4656,1.252,1],[969,1896,22.575,1],[971,3798,3.19,1],[973,2951,3.632,1],[977,1404,6.166,1],[977,2922,7.403,1],[978,1042,7.585,1],[982,983,2.58,1],[986,5236,13.42,1],[987,4402,4.429,1],[991,2248,3.344,2],[992,3929,13.247,1],[1000,5186,0.832,1],[1011,2061,0.298,1],[1011,5200,12.124,1],[1027,1083,16.976,1],[1030,5450,10.723,1],[1032,2980,5.001,1],[1038,1718,0.772,1],[1038,2048,0.161,4],[1039,1704,15.715,1],[1039,3135,0.669,1],[1039,4637,22.825,1],[1040,3135,9.718,1],[1042,4221,17.251,1],[1042,4477,24.606,1],[1043,1090,3.884,1],[1043,1208,7.223,1],[1043,1263,5.364,1],[1043,2059,7.1,1],[1045,1941,18.043,1],[1048,1049,2.789,1],[1048,5757,2.549,1],[1049,5759,10.098,1],[1054,1055,5.794,1],[1059,5224,0.188,2],[1060,3234,13.151,1],[1061,2518,5.382,1],[1062,2654,48.802,1],[1067,2982,12.709,1],[1070,2048,5.666,1],[1070,2184,9.28,1],[1072,1749,28.362,1],[1072,5220,0.072,4],[1072,5221,0.16,1],[1074,5236,24.985,1],[1076,1156,5.321,1],[1076,1299,9.1,2],[1085,2187,0.098,3],[1085,5130,0.167,3],[1090,1118,1.873,1],[1090,1119,1.683,1],[1101,2185,9.338,1],[1111,1675,22.814,1],[1112,4734,0.372,2],[1112,5647,4.791,1],[1118,1119,1.656,1],[1119,1207,6.109,2],[1128,2175,7.942,1],[1128,5782,0.758,2],[1130,5102,8.193,1],[1131,5454,1.74,1],[1136,5688,2.783,1],[1136,5690,6.332,2],[1137,1138,0.236,1],[1138,3986,28.491,1],[1138,5701,29.329,1],[1140,1710,2.456,1],[1142,1710,2.712,1],[1144,2055,2.571,1],[1144,3942,2.324,2],[1146,1908,7.263,1],[1147,1396,5.959,1],[1153,1154,4.041,1],[1153,3054,1.985,1],[1153,3486,2.393,1],[1154,1158,1.43,1],[1154,1735,8.806,1],[1156,1157,43.337,1],[1156,1158,3.38,1],[1159,1294,9.257,1],[1159,3054,32.028,1],[1161,1162,3.821,1],[1161,1431,4.411,1],[1164,5788,25.612,1],[1168,3969,2.43,1],[1176,1846,1.031,1],[1176,1851,6.504,1],[1176,1885,14.013,1],[1180,1361,10.597,1],[1180,1541,1.226,1],[1180,2055,4.03,1],[1181,2093,19.112,1],[1182,1368,0.606,3],[1182,5211,6.584,1],[1183,1480,16.215,1],[1195,1732,3.901,1],[1200,1244,5.1,1],[1202,5624,16.003,1],[1205,2093,21.349,1],[1206,1728,15.597,1],[1206,3252,3.695,1],[1206,3780,6.207,1],[1206,4420,1.737,1],[1211,1509,33.023,1],[1211,2042,43.557,1],[1219,3381,23.099,1],[1221,1224,0.74,1],[1224,2090,0.409,1],[1224,2096,3.667,1],[1229,5725,10.061,1],[1231,1728,8.733,1],[1237,3522,4.073,1],[1238,3522,4.786,1],[1238,5153,1.985,1],[1243,2731,4.987,1],[1243,5799,12.065,1],[1252,2061,9.241,1],[1255,3236,3.014,1],[1256,2160,8.37,2],[1256,2861,0.916,1],[1257,1258,30.353,1],[1258,2047,26.37,1],[1258,5766,5.73,1],[1259,2210,24.146,1],[1259,3983,16.712,1],[1259,5425,2.059,1],[1268,5795,0.862,1],[1269,1740,23.61,1],[1278,3146,6.407,1],[1278,4296,0.629,1],[1287,5185,16.482,1],[1316,1569,27.226,1],[1322,5760,37.396,1],[1326,4609,0.203,4],[1331,5479,8.716,1],[1331,5480,29.634,1],[1336,1865,3.75,1],[1336,5549,4.848,1],[1336,5551,3.346,1],[1338,3141,0.821,1],[1340,5010,10.009,1],[1341,3141,0.392,1],[1348,1349,2.752,1],[1349,2184,0.195,2],[1353,4696,6.537,1],[1357,2467,4.488,1],[1362,2746,2.122,1],[1362,5321,3.441,1],[1365,1678,15.954,1],[1369,3456,2.256,2],[1374,1955,2.723,1],[1374,2220,0.694,2],[1388,5744,17.283,1],[1390,4022,2.745,1],[1390,4538,4.534,1],[1396,5774,16.204,1],[1398,5387,6.632,1],[1399,1413,2.363,1],[1399,1541,1.53,1],[1405,2081,6.208,1],[1405,5253,9.966,1],[1426,2063,10.167,1],[1434,1900,9.445,1],[1436,2252,19.622,1],[1454,1714,5.572,1],[1454,2618,7.243,1],[1460,4716,0.076,1],[1460,5353,8.52,1],[1468,5102,2.089,1],[1479,1483,0.326,2],[1481,1482,0.573,2],[1481,1483,3.743,1],[1482,3450,6.275,1],[1483,3409,0.563,2],[1483,3490,3.342,1],[1509,2041,29.974,1],[1509,2097,1.112,1],[1534,2103,7.207,1],[1534,4408,4.293,1],[1556,5782,0.661,1],[1557,5767,10.635,1],[1563,2247,17.325,1],[1563,5228,0.03,1],[1571,5788,5.42,2],[1572,4099,2.275,1],[1572,4482,0.795,1],[1572,4499,1.342,1],[1579,4486,0.498,1],[1580,4667,1.901,1],[1582,5551,14.562,1],[1586,1607,3.594,1],[1592,2465,1.885,1],[1592,3404,1.671,1],[1602,5248,2.174,1],[1620,3535,4.209,1],[1625,5130,17.797,1],[1627,2160,9.17,1],[1638,2441,0.401,1],[1651,3423,0.155,2],[1659,2534,6.9,1],[1660,1661,0.062,1],[1660,5780,13.421,1],[1666,2994,8.309,1],[1666,3329,1.214,1],[1671,1768,3.685,1],[1675,2045,20.004,1],[1678,1711,0.291,1],[1678,2980,15.583,1],[1678,3476,6.495,1],[1682,1781,5.186,1],[1686,3423,3.757,1],[1688,2571,3.741,1],[1688,3134,9.225,1],[1688,4538,12.192,1],[1695,3670,3.593,1],[1695,3671,1.89,1],[1696,4543,22.671,1],[1700,2040,6.586,1],[1703,5781,1.533,1],[1711,3481,0.642,1],[1714,4959,3.762,1],[1725,2991,8.06,1],[1727,4420,2.053,1],[1728,5231,4.08,1],[1730,1731,1.269,1],[1730,5751,3.23,1],[1735,3486,3.657,1],[1740,5761,7.512,1],[1742,4957,52.373,1],[1747,5779,6.933,1],[1748,1884,8.892,1],[1749,1984,1.151,1],[1752,5775,4.541,1],[1752,5776,4.573,1],[1753,2781,41.322,1],[1756,1757,0.114,1],[1756,2466,0.094,1],[1767,2000,24.359,1],[1768,3713,3.552,1],[1792,3522,0.447,2],[1800,3641,3.499,1],[1800,3642,1.284,1],[1800,4221,0.577,1],[1803,3723,3.955,1],[1806,2155,1.301,1],[1817,5327,0.822,2],[1818,5435,0.119,3],[1818,5436,0.137,1],[1818,5437,0.158,1],[1825,2058,1.538,1],[1825,5047,4.085,1],[1827,4538,0.932,1],[1835,2594,5.957,1],[1837,1909,0.82,2],[1837,2166,1.361,1],[1843,4057,1.58,1],[1846,2904,17.007,1],[1846,5454,10.708,1],[1847,1848,0.269,2],[1847,5772,9.188,1],[1848,5772,4.828,1],[1864,2855,3.097,1],[1867,1969,57.479,1],[1873,4859,7.91,1],[1885,5243,13.523,1],[1887,5485,2.229,1],[1889,2176,28.025,1],[1897,3952,0.707,2],[1897,4233,2.799,1],[1900,2530,5.871,2],[1900,5753,4.222,1],[1903,1957,17.895,1],[1903,2784,9.275,1],[1914,5454,18.376,1],[1915,5454,22.059,1],[1916,3311,4.066,2],[1923,1935,10.056,1],[1928,1929,8.926,1],[1930,3951,6.137,1],[1930,4163,3.801,2],[1930,5798,0.033,2],[1931,5713,1.481,1],[1938,5755,2.784,1],[1949,2410,7.548,1],[1949,5103,16.546,1],[1955,5064,3.898,1],[1959,2093,26.599,1],[1962,4335,0.782,1],[1970,2616,20.825,1],[1975,2804,4.078,1],[1975,4543,1.378,1],[1978,5052,24.262,1],[1979,2931,2.03,2],[1980,5052,3.588,1],[1985,1986,2.128,1],[1986,2004,6.021,1],[1986,5208,1.886,1],[1991,1993,3.666,1],[1992,3646,22.336,1],[1992,4777,12.852,1],[1995,1996,5.105,1],[1996,1998,30.107,1],[2000,2005,1.465,2],[2000,4957,3.787,1],[2002,2003,19.691,1],[2004,5186,6.148,1],[2005,2936,2.114,2],[2014,2015,7.069,1],[2015,2016,11.338,1],[2015,2017,8.302,1],[2016,3694,11.195,1],[2019,2020,18.826,1],[2020,3695,1.611,1],[2021,3695,10.161,1],[2023,5730,11.0,1],[2027,5223,8.263,1],[2034,2035,14.844,1],[2040,2042,26.945,1],[2040,3215,2.494,1],[2040,5763,12.865,1],[2041,2043,21.707,1],[2044,2547,1.898,1],[2044,3643,11.995,1],[2046,5018,2.619,2],[2046,5447,44.008,1],[2047,5018,8.811,1],[2050,3253,6.683,1],[2060,3456,1.212,1],[2063,5701,2.337,1],[2067,2069,0.692,1],[2072,2560,19.977,1],[2073,5780,0.535,1],[2080,5352,3.867,1],[2092,5782,1.1,1],[2093,2577,46.293,1],[2097,2547,4.171,1],[2098,2300,3.532,1],[2103,2535,5.723,1],[2109,5455,2.498,1],[2115,5107,0.021,1],[2134,2810,4.0,1],[2147,5485,12.061,1],[2162,5730,2.85,1],[2166,2873,5.257,1],[2182,4657,12.007,1],[2184,5747,15.461,1],[2186,2187,0.119,1],[2186,2188,0.066,1],[2187,2188,0.091,1],[2214,5408,4.477,1],[2218,5225,0.513,1],[2219,5038,13.642,1],[2219,5225,1.53,1],[2220,3978,1.052,1],[2234,4476,4.146,2],[2234,5669,2.39,1],[2297,3338,1.246,1],[2306,2459,2.665,2],[2311,4416,1.703,1],[2311,5799,3.353,1],[2338,5730,3.405,1],[2394,5697,0.825,1],[2401,2425,1.216,1],[2410,3836,0.223,1],[2424,2425,1.139,1],[2424,2429,2.769,1],[2426,2427,0.296,1],[2428,4938,3.206,1],[2429,5046,3.979,1],[2434,5045,7.485,1],[2434,5046,8.17,1],[2437,2438,0.423,1],[2443,5099,1.219,1],[2445,2447,1.1,1],[2464,2483,4.893,1],[2469,5046,1.728,1],[2475,2672,9.877,1],[2493,2530,2.048,1],[2503,3536,3.154,1],[2511,2854,4.237,1],[2519,2612,23.559,1],[2527,5208,0.968,2],[2531,5042,1.487,1],[2601,3135,3.556,1],[2605,3682,7.29,1],[2614,2616,3.848,2],[2623,4143,7.301,1],[2654,5766,5.354,1],[2669,2747,4.374,1],[2671,3329,4.403,1],[2671,4272,10.773,1],[2672,5728,0.093,4],[2673,5719,0.622,1],[2673,5720,0.488,2],[2673,5721,0.44,1],[2673,5751,19.756,1],[2676,4656,0.022,2],[2687,5778,5.485,2],[2711,3915,5.451,1],[2717,4979,0.699,1],[2729,3416,10.633,1],[2729,4422,2.764,1],[2729,5745,0.459,2],[2748,4471,1.098,1],[2781,3695,19.193,1],[2783,3652,7.523,1],[2795,2796,11.95,1],[2801,2802,2.566,1],[2802,5223,3.808,1],[2803,5689,1.115,1],[2807,5266,3.377,1],[2810,5485,5.196,1],[2857,5440,0.946,1],[2900,3481,7.972,1],[2906,3443,0.817,1],[2906,5736,0.216,1],[2911,5120,0.182,1],[2922,5052,16.102,1],[2929,3528,0.661,1],[2936,2937,1.208,1],[2975,5732,4.689,1],[2981,5458,59.562,1],[2983,5368,18.84,1],[2993,5783,6.069,1],[2994,4273,1.689,1],[3013,5021,2.325,1],[3027,4519,0.596,1],[3027,5253,19.796,1],[3034,3928,1.522,1],[3049,5447,40.394,1],[3121,4162,1.632,1],[3121,5249,1.251,1],[3134,3135,0.375,1],[3146,5761,4.729,1],[3183,5744,4.091,1],[3202,5774,2.277,1],[3214,5770,10.641,1],[3233,3527,27.677,1],[3233,4020,10.547,1],[3233,5642,4.755,1],[3234,3694,58.374,1],[3236,5771,7.557,1],[3254,4099,0.969,1],[3254,4171,0.928,1],[3314,3315,9.803,1],[3339,4731,7.807,1],[3363,4143,33.403,1],[3408,4233,2.417,1],[3413,5031,1.517,1],[3421,5547,0.377,1],[3423,4484,9.801,1],[3434,3443,12.649,1],[3434,4213,1.536,1],[3443,4207,4.178,1],[3443,4484,0.017,12],[3443,5736,0.636,2],[3445,4122,4.072,1],[3456,5646,1.542,1],[3456,5647,1.993,2],[3456,5765,0.194,1],[3560,4176,0.104,1],[3560,4180,0.967,1],[3563,5526,12.984,1],[3645,5763,15.757,1],[3658,4338,1.69,1],[3658,5353,3.22,1],[3671,4589,12.308,1],[3719,5253,10.326,1],[3888,5742,7.233,1],[3888,5781,1.568,1],[3929,4722,2.24,1],[3951,4903,0.344,1],[3955,4153,1.979,1],[3969,5747,3.587,1],[3989,5381,2.093,1],[4088,4165,1.404,1],[4105,5760,2.558,1],[4109,5369,11.14,1],[4109,5399,0.258,1],[4163,5684,3.264,1],[4163,5798,3.308,1],[4165,5771,2.516,1],[4172,4499,1.821,1],[4173,4180,1.063,1],[4173,4482,0.987,1],[4176,4177,0.145,1],[4188,4189,5.911,1],[4188,4903,4.437,1],[4221,4483,0.465,1],[4242,4371,2.63,1],[4253,5370,0.486,1],[4272,4273,1.92,1],[4292,4296,7.968,1],[4292,5761,2.109,1],[4409,5780,7.636,2],[4418,5755,17.519,1],[4468,5713,0.288,1],[4486,4667,0.123,1],[4655,4656,0.951,1],[4734,5153,4.099,1],[4734,5647,3.984,1],[4742,5713,0.074,1],[4742,5771,27.531,1],[4754,4755,1.978,1],[4761,5762,0.434,1],[4782,4979,3.635,1],[4782,5624,0.632,1],[4849,5399,20.495,1],[4936,4938,1.668,1],[5018,5795,0.174,1],[5033,5236,0.312,1],[5052,5053,23.379,1],[5064,5102,0.331,2],[5065,5102,0.585,2],[5103,5650,0.105,5],[5103,5741,0.503,3],[5129,5130,0.03,1],[5170,5231,6.267,1],[5185,5760,6.716,1],[5191,5236,0.211,1],[5200,5762,0.179,5],[5201,5782,3.315,1],[5202,5782,0.527,1],[5210,5439,1.442,1],[5220,5221,0.088,1],[5223,5224,0.149,3],[5248,5356,3.095,1],[5253,5770,6.351,1],[5327,5440,0.647,1],[5408,5421,2.652,1],[5436,5437,0.035,1],[5438,5439,0.072,1],[5438,5628,1.709,1],[5439,5628,1.577,1],[5447,5448,7.598,1],[5455,5457,12.888,1],[5456,5457,0.006,1],[5666,5728,24.079,1],[5669,5673,0.859,1],[5673,5752,2.672,1],[5678,5755,15.907,1],[5691,5692,0.102,1],[5719,5721,0.176,1],[5724,5725,0.046,3],[5724,5783,1.311,1],[5724,5799,0.881,2],[5728,5751,12.734,1],[5735,5740,33.997,1],[5736,5772,10.536,1],[5744,5776,24.534,1],[5752,5774,5.369,2],[5773,5779,3.435,2]],"cageK":2,"cages":{"3443":[[144,645,646,647,939,1171,2906,3423,3434,3443,4207,4213,4484,5736,5772],[[-4.1825,51.7091],[-4.1737,51.6773],[-3.9814,51.6275],[-3.8982,51.6251],[-3.9143,51.6672],[-3.9994,51.7791]]],"5236":[[635,636,986,1074,5033,5191,5236],[[-2.003,51.6062],[-1.8218,51.5823],[-1.7554,51.5974],[-1.9623,51.702]]],"635":[[635,636,986,1074,5033,5191,5236],[[-2.003,51.6062],[-1.8218,51.5823],[-1.7554,51.5974],[-1.9623,51.702]]],"4484":[[645,647,1651,1686,2906,3423,3434,3443,4207,4484,5736],[[-4.1323,51.6752],[-3.9895,51.646],[-3.9143,51.6672],[-3.9502,51.7737],[-3.9994,51.7791],[-4.0303,51.7725],[-4.1293,51.6997]]],"3456":[[442,598,1112,1271,1369,2060,3456,4734,5646,5647,5765],[[-1.5419,53.8139],[-1.5379,53.733],[-1.5375,53.7328],[-1.5107,53.718],[-1.4948,53.7649],[-1.4939,53.7785],[-1.5093,53.8017]]],"5103":[[715,717,718,1949,2410,5103,5650,5741],[[-0.7559,53.598],[-0.5047,53.5418],[-0.5939,53.5966],[-0.6511,53.6026]]],"538":[[493,535,537,538,543,576,736,1537,1659,3338,3594,4631,4632,5112],[[-1.3694,53.0303],[-0.8695,52.7647],[-0.6381,52.904],[-0.6465,52.9377],[-0.9969,53.3068],[-1.3029,53.1056]]],"5728":[[188,220,365,1730,2475,2672,2673,5666,5728,5751],[[-0.3826,51.6164],[-0.2554,51.5923],[-0.0221,51.664],[0.0034,51.7581],[-0.3032,51.7372],[-0.3815,51.6713]]],"240":[[240,439,440,457,649,801,873,2052,3798],[[-1.9283,52.487],[-1.8795,52.4745],[-1.8097,52.5098],[-1.8284,52.5125],[-1.8576,52.5067]]],"5762":[[629,630,631,1011,4761,5200,5762],[[-2.1672,53.5288],[-1.9843,53.3523],[-1.8851,53.276],[-2.0412,53.4966]]],"1818":[[310,312,315,821,1818,5435,5436,5437],[[1.228,52.6296],[1.2723,52.574],[1.2751,52.5749],[1.2759,52.5753],[1.3081,52.6077]]],"5782":[[320,322,392,420,448,468,1128,1556,2092,2175,5201,5202,5782],[[-1.8141,52.5622],[-1.7491,52.4065],[-1.7124,52.4519],[-1.6567,52.6083]]],"5253":[[366,578,1405,2081,3027,3214,3719,4519,5253,5770],[[-1.1379,52.027],[-1.1334,51.9091],[-0.907,51.9263],[-0.7436,52.0109],[-0.7963,52.0495],[-1.1114,52.0437]]],"5102":[[330,752,1130,1468,1955,5064,5065,5102],[[-0.4633,53.7232],[-0.3799,53.7328],[-0.3593,53.7813],[-0.4157,53.8212]]],"350":[[341,350,642,727,728,731,754,919,1067,2283,2972,2982,3812],[[-0.3843,52.7653],[-0.2432,52.5675],[0.0544,52.5527],[0.3786,52.7265],[0.3997,52.7578],[-0.0148,52.9663]]],"4163":[[371,373,376,377,981,1930,3951,4163,5684,5798],[[-3.0167,51.629],[-2.9894,51.5687],[-2.9774,51.5476],[-2.9087,51.5648],[-2.9143,51.5803]]],"2672":[[188,220,365,2475,2672,5666,5728,5751],[[-0.3826,51.6164],[-0.2554,51.5923],[-0.0221,51.664],[-0.2395,51.7363],[-0.3815,51.6713]]],"2187":[[566,928,1085,1619,1620,2186,2187,2188,2503,5130],[[-1.7432,54.9777],[-1.7347,54.9738],[-1.7174,54.9724],[-1.6616,54.9724],[-1.7243,54.9886]]],"5650":[[715,717,718,1457,1949,3936,5103,5650,5741],[[-0.7559,53.598],[-0.5904,53.5675],[-0.5939,53.5966],[-0.6509,53.6028]]],"1085":[[566,928,1085,1625,2186,2187,2188,5129,5130],[[-1.7432,54.9777],[-1.5404,54.884],[-1.7245,54.9781]]],"577":[[576,577,582,1430,1496,1659,2534,2658,3594,4242,4371],[[-1.4451,53.233],[-1.385,53.1089],[-1.2447,53.0879],[-1.1031,53.166],[-1.2272,53.2768],[-1.3857,53.267]]],"370":[[370,421,575,3658,4338],[[-1.6155,52.3861],[-1.5669,52.2861],[-1.5659,52.2858],[-1.5476,52.2846]]],"815":[[144,814,815,1434,1900,2623,4143,4663],[[-4.9728,51.7342],[-4.2282,51.6881],[-4.1825,51.7091],[-4.3621,52.0058],[-4.9337,51.8066]]],"5724":[[1229,1243,2311,2993,5724,5725,5783,5799],[[-2.5121,53.5144],[-2.2992,53.5124],[-2.2998,53.5967],[-2.4207,53.5913]]],"254":[[254,526,1338,1341,1467,3141,3142,4109,5369],[[-1.3556,53.7495],[-1.2906,53.7157],[-1.2828,53.7179],[-1.277,53.7198],[-1.2765,53.72],[-1.1575,53.7775]]],"286":[[278,286,323,335,434,595,1178,3797,4043],[[-2.0133,52.4311],[-1.9815,52.397],[-1.9743,52.3962],[-1.87,52.4042],[-1.9534,52.4734]]],"306":[[306,383,444,620,801,1190,1827,2052,4218],[[-2.0008,52.5978],[-1.9694,52.5075],[-1.9159,52.477],[-1.9004,52.4891],[-1.8802,52.5554],[-1.9704,52.5981]]],"821":[[310,315,349,821,1818,5435,5436,5437],[[1.2723,52.574],[1.7115,52.5552],[1.3081,52.6077]]],"421":[[370,421,574,575,4338],[[-1.6155,52.3861],[-1.5669,52.2861],[-1.5659,52.2858],[-1.5619,52.2862],[-1.6136,52.3864]]],"1483":[[726,733,1479,1481,1482,1483,3409,3490],[[-1.4274,53.3909],[-1.3562,53.4364],[-1.3789,53.502],[-1.4168,53.4293]]],"733":[[521,524,733,1183,1393,1480,1483,1682,1781,3409,3437],[[-1.6047,53.4956],[-1.4065,53.4188],[-1.1142,53.5006],[-1.1469,53.526],[-1.4326,53.6085],[-1.5192,53.5736]]],"1930":[[371,373,376,377,1930,3951,4163,4903,5684,5798],[[-3.0167,51.629],[-2.9894,51.5687],[-2.9774,51.5476],[-2.9019,51.563],[-2.9143,51.5803]]],"477":[[477,489,518,569,685,700,852,1670,1671,1768,3713,5732],[[-0.9137,52.2454],[-0.5014,51.934],[-0.3017,52.2146],[-0.6694,52.4913]]],"242":[[206,242,244,633,634,639,1181,2093,2214,2332,2847,3183,5408,5421,5790],[[-3.0777,53.2306],[-3.0621,53.0564],[-3.0357,52.8681],[-2.5527,53.077],[-2.9327,53.2463]]],"3522":[[260,1163,1237,1238,1792,3389,3522,5153],[[-1.6284,53.828],[-1.584,53.7761],[-1.5838,53.7759],[-1.5746,53.7693],[-1.5898,53.8068],[-1.6154,53.8363]]],"5760":[[334,699,701,1027,1063,1083,1287,1322,4105,5185,5760],[[-5.2798,50.2289],[-5.1845,50.1571],[-4.2426,50.4447],[-4.7224,50.5353]]],"459":[[459,1136,1195,1280,1732,1753,2021,2781,3695,5690],[[-4.8303,56.0832],[-4.7087,56.0235],[-4.5618,55.9613],[-4.3159,55.8695],[-4.31,55.9033],[-4.7294,56.2455]]],"381":[[381,416,771,1042,2234,3952,4228,4476,4477,5192],[[-2.6667,51.5407],[-2.5647,51.5269],[-2.5129,51.5243],[-2.4124,51.5527],[-2.3813,51.7415]]],"5200":[[629,630,1011,2061,4761,5200,5762],[[-2.1672,53.5288],[-1.9843,53.3523],[-2.0412,53.4966],[-2.1633,53.5302]]],"639":[[206,242,244,634,638,639,1181,1205,1959,2093,2332,2577,2847,3183,5408,5744,5790],[[-3.2976,52.5172],[-2.7386,52.8574],[-2.4845,53.1029],[-2.9314,53.2106],[-3.0374,53.2344],[-3.0777,53.2306]]],"585":[[583,584,585,1140,1187,1710],[[-2.2091,52.5565],[-2.1943,52.5056],[-2.117,52.4897],[-2.0995,52.5068],[-2.0921,52.5517],[-2.1859,52.5732]]],"408":[[408,409,1694,1695,1975,2618,2804,3670,4543],[[-1.4884,52.5115],[-1.4678,52.4531],[-1.4464,52.4252],[-1.2881,52.3754],[-1.2623,52.3882],[-1.252,52.404],[-1.3956,52.5287]]],"1043":[[339,1043,1090,1118,1119,1208,1263,2059,5333],[[-1.9058,53.8648],[-1.875,53.7507],[-1.7525,53.8025],[-1.7343,53.8259],[-1.8887,53.8703]]],"4609":[[730,731,991,1326,1542,2972,4609],[[-0.6292,52.9132],[0.191,52.756],[0.2609,53.1405],[-0.5883,52.9247]]],"432":[[432,433,1276,2072,2223,2560,2687,3509,5778],[[-1.8575,52.908],[-1.5504,52.8556],[-1.4637,52.879],[-1.4006,52.9053],[-1.6398,53.1261]]],"549":[[271,273,549,781,1032,1678,2101,2980,3089],[[-0.3213,51.0632],[-0.3185,50.8932],[-0.2246,50.8377],[-0.1577,50.9653],[-0.1314,51.1777]]],"204":[[197,204,243,1777,1837,1864,1909,2098,2855,5421],[[-2.9635,53.334],[-2.96,53.266],[-2.9126,53.2157],[-2.8669,53.2304],[-2.8113,53.2779]]],"1178":[[278,286,335,395,595,1178],[[-2.0133,52.4311],[-1.9815,52.397],[-1.9743,52.3962],[-1.8062,52.3946],[-1.9261,52.4276],[-1.9866,52.4409]]],"213":[[211,212,213,214,361,4443,5279],[[-0.656,51.6649],[-0.6237,51.5267],[-0.6172,51.5183],[-0.505,51.4802],[-0.4973,51.5417],[-0.4992,51.6102]]],"928":[[566,928,1085,1619,1620,2186,2187,2188,2503,3535,3536],[[-1.7432,54.9777],[-1.7325,54.9744],[-1.6601,54.9594],[-1.6242,54.9749],[-1.7243,54.9886]]],"2980":[[271,272,549,781,1032,1365,1678,1711,2101,2980,3089,3476],[[-0.3538,50.8222],[-0.1411,50.8253],[-0.1314,51.1777],[-0.2177,51.2019],[-0.3213,51.0632]]],"1072":[[399,1072,1749,1984,5220,5221],[[-5.936,57.248],[-5.1232,57.0628],[-4.7182,57.135],[-4.7183,57.1363],[-4.7186,57.1368]]],"4663":[[814,815,1434,2623,2704,4663,5737],[[-4.9337,51.8066],[-4.2282,51.6881],[-4.0899,52.0951],[-4.3621,52.0058]]],"5223":[[270,900,1059,2027,2801,2802,5223,5224],[[-4.506,55.8453],[-4.4783,55.809],[-4.475,55.8087],[-4.3647,55.8212],[-4.3812,55.8808]]],"2673":[[741,745,1730,2673,5719,5720,5721,5728,5751],[[-0.3411,51.6597],[0.1192,51.7074],[0.0665,51.7638],[-0.3032,51.7372]]],"5130":[[566,1085,1625,2187,5129,5130],[[-1.7432,54.9777],[-1.5404,54.884],[-1.7325,54.9751]]],"1206":[[255,885,1206,1231,1727,1728,3252,3780,4420,5231],[[-1.924,53.7088],[-1.8283,53.6555],[-1.7727,53.6511],[-1.47,53.6743],[-1.6938,53.708],[-1.8582,53.7263]]],"1900":[[148,815,1434,1747,1900,2493,2530,5753],[[-5.0752,51.7192],[-4.9079,51.684],[-4.357,51.8478],[-4.9337,51.8066],[-5.0591,51.7408]]],"2048":[[1038,1070,1718,2048,2184],[[-3.0296,53.8494],[-2.9775,53.7815],[-2.9884,53.879],[-2.9899,53.8796],[-2.997,53.8824]]],"260":[[259,260,1163,1237,1238,1792,3389,3522,5153],[[-1.6643,53.8212],[-1.5746,53.7693],[-1.5898,53.8068],[-1.6154,53.8363]]],"241":[[241,987,1534,2103,2535,4402,4408,4409,5780],[[-1.268,52.9009],[-1.2551,52.8635],[-1.0505,52.9599],[-1.1734,52.9785]]],"598":[[598,1271,1369,2060,3456,5646,5647,5765],[[-1.5419,53.8139],[-1.5233,53.7801],[-1.4952,53.765],[-1.4948,53.7649],[-1.4939,53.7785],[-1.5093,53.8017]]],"699":[[699,701,1027,1063,1083,1322,4105,5185,5760],[[-5.2798,50.2289],[-5.1845,50.1571],[-4.3732,50.4179],[-4.8183,50.4235],[-4.8997,50.3949]]],"5747":[[454,614,948,1070,1168,1349,2184,2511,3969,5747],[[-3.0296,53.8494],[-2.9683,53.5602],[-2.6895,53.6169],[-2.6966,53.7048],[-2.7323,53.7571]]],"393":[[393,394,602,1357,1756,1757,2467,3404],[[-0.2581,51.5451],[-0.258,51.5339],[-0.2251,51.5152],[-0.2242,51.5262],[-0.258,51.595]]],"440":[[240,329,422,439,440,457,873,1116],[[-1.8991,52.4874],[-1.8878,52.4727],[-1.8595,52.4614],[-1.8207,52.4643],[-1.8522,52.5069],[-1.8576,52.5067],[-1.8811,52.4962]]],"236":[[194,236,1021,1835,2594,5682],[[-1.1018,50.7933],[-1.0247,50.9165],[-1.0398,50.917],[-1.0424,50.9169],[-1.0789,50.8449]]],"5771":[[648,659,660,1255,3236,4088,4165,4742,5713,5771],[[-3.4031,51.3884],[-3.4024,51.3891],[-3.2401,51.5924],[-3.2178,51.6694],[-3.3716,51.6676],[-3.3993,51.5287]]],"2729":[[340,591,621,622,2729,3416,4422,4864,5745],[[-2.5685,53.3889],[-2.5296,53.2676],[-2.4808,53.2635],[-2.4626,53.2661],[-2.3218,53.4325],[-2.3683,53.4676]]],"5224":[[270,1059,2027,2802,5223,5224],[[-4.4783,55.809],[-4.475,55.8087],[-4.3647,55.8212],[-4.413,55.8404],[-4.4641,55.8406]]],"335":[[286,322,335,395,434,1178],[[-2.0133,52.4311],[-1.9815,52.397],[-1.9743,52.3962],[-1.8062,52.3946],[-1.7491,52.4065]]],"5730":[[443,509,2023,2162,2338,5730],[[-3.9638,55.9469],[-3.6724,55.8997],[-3.7678,56.0138],[-3.8894,56.0395]]],"5266":[[463,468,570,666,1556,2807,5266],[[-1.712,52.5342],[-1.6567,52.6083],[-1.59,52.7583],[-1.6236,52.816],[-1.6517,52.7732],[-1.6877,52.6323]]],"892":[[478,519,892,1739,3600,3605,4386],[[-1.2168,52.5976],[-1.0244,52.5372],[-0.7131,52.4853],[-1.1432,52.6468]]],"5220":[[1072,1749,5220,5221],[[-5.1085,57.0692],[-4.7182,57.135],[-4.7183,57.1363],[-4.7186,57.1368]]],"1038":[[1038,1070,1718,2048],[[-3.0296,53.8494],[-2.9884,53.879],[-2.9899,53.8796],[-2.997,53.8824]]],"662":[[413,430,661,662,1692,3635],[[-2.6892,52.3667],[-2.3052,52.1264],[-2.2364,52.1919],[-2.2423,52.3125],[-2.2509,52.3827]]],"205":[[205,290,293,294,1388,1516,1837,1909,2166,2181,2971],[[-2.835,53.2685],[-2.5498,53.2381],[-2.6655,53.3441],[-2.7555,53.3323]]],"4221":[[586,978,1042,1161,1800,3641,3642,4221,4477,4483],[[-2.4752,51.5988],[-2.273,51.7387],[-2.1204,51.9086],[-2.2535,51.8793],[-2.2662,51.8716],[-2.3813,51.7415]]],"863":[[507,863,1219,1992,2002,2003,3381,4777,5105,5219],[[-3.3424,57.6598],[-3.316,57.416],[-3.0985,57.3778],[-2.4985,57.664],[-2.8133,57.6724],[-3.3212,57.6648]]],"5780":[[241,300,1660,1661,2073,4409,5780],[[-1.265,52.9163],[-1.2568,52.8622],[-1.0705,52.826],[-1.1625,52.9318]]],"595":[[278,286,323,595,1178,3797,4043],[[-2.0133,52.4311],[-1.9815,52.397],[-1.9261,52.4276],[-1.9534,52.4734]]],"574":[[421,574,575,1714,4260,4959],[[-1.6155,52.3861],[-1.5619,52.2862],[-1.5073,52.4202],[-1.6051,52.401]]],"303":[[303,798,2424,2425,2429,2443,2447,5051,5099],[[-0.1926,51.5227],[-0.1515,51.5131],[-0.1445,51.5116],[-0.0984,51.5072],[-0.0958,51.5304],[-0.1704,51.5275]]],"2093":[[242,639,1181,1205,1959,2093,2332,2577,2847,3183],[[-3.2976,52.5172],[-2.7386,52.8574],[-2.5527,53.077],[-3.0727,53.2271]]],"188":[[188,220,365,2475,2672,5666,5668,5728,5751],[[-0.4117,51.7963],[-0.3826,51.6164],[-0.2554,51.5923],[-0.0221,51.664]]],"144":[[144,645,815,1171,2623,3434,3443,4143,4213],[[-4.357,51.8478],[-4.2898,51.7429],[-4.2282,51.6881],[-4.1737,51.6773],[-4.1323,51.6752],[-3.9605,51.685]]],"956":[[283,510,955,956,1735,2625],[[-1.9406,50.7556],[-1.9133,50.731],[-1.9126,50.7315],[-1.8797,50.765],[-1.8435,51.082]]],"379":[[379,594,627,935,1335,2247,2250,5034],[[-1.5886,54.5298],[-1.5594,54.3278],[-1.2672,54.5875],[-1.267,54.588],[-1.3646,54.5922],[-1.5608,54.5555]]],"255":[[255,442,524,1206,1231,1393,1682,1728,1781,2060,2277,5231],[[-1.8227,53.6944],[-1.6047,53.4956],[-1.3817,53.5705],[-1.496,53.7753]]],"1572":[[372,382,615,1572,3254,4099,4172,4173,4482,4499],[[-3.1814,51.4965],[-3.178,51.4771],[-3.1555,51.4657],[-3.1385,51.4735],[-3.0048,51.567]]],"5018":[[3,1258,1268,2046,2047,5018,5447,5795],[[-3.5023,54.0446],[-2.8893,54.0235],[-2.7869,54.0661],[-2.7377,54.2915],[-3.4112,54.0785]]],"388":[[387,388,917,937,1025],[[-3.3399,51.1586],[-3.1543,51.0171],[-2.7529,51.1312]]],"3797":[[278,286,323,434,595,797,3797],[[-2.0133,52.4311],[-1.87,52.4042],[-1.9347,52.4479],[-1.9866,52.4409]]],"3135":[[1039,1040,1688,1704,2601,3134,3135,4637],[[-2.1064,52.794],[-1.948,52.6801],[-1.8174,52.698],[-2.0188,52.9449]]],"4409":[[241,300,987,1660,2073,2103,4408,4409,5780],[[-1.265,52.9163],[-1.2568,52.8622],[-1.071,52.8262],[-1.1024,52.9651],[-1.189,52.9438]]],"2184":[[454,614,1070,1348,1349,2048,2184,3969,5747],[[-3.0296,53.8494],[-2.961,53.6435],[-2.7261,53.7011],[-2.7323,53.7571],[-2.9884,53.879]]],"2040":[[483,1211,1700,2040,2042,3215,3645,5763],[[-4.0352,54.8608],[-3.0007,54.9514],[-3.0505,55.0326],[-3.1784,55.1421],[-3.5911,55.0676]]],"648":[[152,648,659,660,2746,3236,4165,4742,5771],[[-3.5062,51.7292],[-3.4024,51.3891],[-3.2694,51.563],[-3.167,51.7001]]],"409":[[408,409,1454,1694,1975,2618,3670],[[-1.4884,52.5115],[-1.4826,52.3935],[-1.2623,52.3882],[-1.4437,52.5011]]],"325":[[325,982,983,1742,2519,2612,4957,5135],[[-4.4005,56.6931],[-4.3641,56.4846],[-4.3295,56.477],[-3.0425,56.5143],[-3.7838,56.717]]],"4989":[[199,200,207,246,247,253,479,4989],[[-1.4872,50.9419],[-1.4657,50.9182],[-1.4435,50.8973],[-1.4123,50.9059],[-0.8814,51.2509]]],"5454":[[1131,1176,1846,1914,1915,2904,5454],[[-3.6243,53.4373],[-3.5721,53.297],[-3.4763,53.1169],[-3.469,53.2566],[-3.5406,53.4657]]],"1076":[[867,1076,1156,1157,1158,1299],[[-2.5713,50.9133],[-2.2738,50.6782],[-2.0342,50.6515],[-2.0189,50.7189]]],"320":[[302,320,322,392,395,420,1128,1556,2092,2175,5201,5202,5782],[[-1.8062,52.3946],[-1.7491,52.4065],[-1.7124,52.4519],[-1.7058,52.5161],[-1.7086,52.5278],[-1.712,52.5342],[-1.7162,52.5315],[-1.7794,52.484]]],"433":[[432,433,2687,3509,4241,5778],[[-1.5504,52.8556],[-1.4637,52.879],[-1.4006,52.9053],[-1.4745,52.8875]]],"1128":[[320,392,420,422,1128,1556,2092,2175,5201,5202,5782],[[-1.8207,52.4643],[-1.7124,52.4519],[-1.7058,52.5161],[-1.7086,52.5278],[-1.712,52.5342],[-1.7162,52.5315]]],"5774":[[480,1147,1396,3202,5673,5752,5774],[[-2.5833,51.4592],[-2.5653,51.4491],[-2.4734,51.498],[-2.4593,51.5319],[-2.5559,51.5036],[-2.5658,51.5006]]],"246":[[199,200,246,247,251,479,686,2605,4989,5392],[[-1.4872,50.9419],[-1.4657,50.9182],[-1.4435,50.8973],[-1.3791,50.8467],[-0.7707,51.2317],[-0.8328,51.2727],[-0.8622,51.2865]]],"715":[[715,717,1457,3936,5103,5650],[[-0.7499,53.5973],[-0.749,53.5968],[-0.6227,53.5753],[-0.5939,53.5966],[-0.6509,53.6028]]],"919":[[350,470,642,754,919,996,1723,2283,2285,3812],[[-0.2679,52.5986],[-0.2619,52.5561],[0.0749,52.5483],[0.1902,52.661],[0.199,52.7269]]],"704":[[336,703,704,898,1287,2135,5323],[[-4.7224,50.5353],[-3.9139,50.796],[-4.0543,51.0676],[-4.1717,51.0682]]],"537":[[535,537,538,576,727,1537,4631,4632,5112],[[-1.2447,53.0879],[-0.3843,52.7653],[-0.809,53.051],[-0.8641,53.0778]]],"208":[[208,2457,2620,2680,4974],[[-0.0407,51.5585],[-0.0039,51.5078],[-0.0016,51.5111],[0.0039,51.5211]]],"391":[[391,557,559,571,5691,5692],[[0.4614,51.3526],[0.4624,51.3144],[0.5967,51.4195],[0.5963,51.42],[0.4997,51.4001]]],"5052":[[749,977,1978,1980,2922,5052,5053],[[-4.7292,58.1876],[-4.4133,57.9432],[-4.2746,57.9499],[-3.8749,58.02],[-4.5037,58.2107]]],"1259":[[283,338,770,1259,1896,2210,3983,5425],[[-2.1539,51.3951],[-1.8435,51.082],[-1.5192,51.098],[-1.4575,51.2157],[-2.1073,51.4674]]],"1326":[[730,731,1326,4609],[[-0.5883,52.9247],[-0.2209,52.9314],[-0.0148,52.9663]]],"463":[[463,468,666,2807,3209,5266],[[-1.6567,52.6083],[-1.59,52.7583],[-1.623,52.817],[-1.6236,52.816],[-1.6517,52.7732]]],"2671":[[116,268,1666,2671,3329,4272,4273,4335],[[-3.5142,50.6956],[-3.3939,50.6324],[-3.3501,50.731],[-3.4053,50.7676],[-3.461,50.7349]]],"251":[[199,246,249,250,251],[[-1.4872,50.9419],[-1.4435,50.8973],[-1.3743,50.8386],[-1.3568,50.8367]]],"5725":[[1229,5724,5725,5783,5799],[[-2.4207,53.5913],[-2.358,53.5382],[-2.3402,53.5515]]],"2234":[[381,480,2234,4476,4488,5669,5673,5752],[[-2.5706,51.4856],[-2.5129,51.5243],[-2.4808,51.5695],[-2.507,51.5597],[-2.566,51.5008]]],"464":[[464,465,466,616,1752,4637,5744,5775,5776,5777],[[-2.4845,53.1029],[-2.1676,52.9239],[-2.0188,52.9449],[-2.0837,53.0407],[-2.1768,53.08]]],"5199":[[472,473,879,926,5199],[[1.0869,51.2908],[1.0942,51.2923],[1.0979,51.2948],[1.0956,51.3536]]],"1835":[[194,236,1835,2594,5682],[[-1.1018,50.7933],[-1.0398,50.917],[-1.0424,50.9169],[-1.0789,50.8449]]],"1678":[[271,549,1032,1365,1678,1711,2980,3476,3481],[[-0.3538,50.8222],[-0.1411,50.8253],[-0.1314,51.1777]]],"3434":[[144,645,647,1171,2623,2906,3434,3443,4207,4213,4484,5736],[[-4.2282,51.6881],[-4.1737,51.6773],[-3.9895,51.646],[-3.9143,51.6672],[-3.9534,51.6913],[-4.1825,51.7091]]],"510":[[283,510,955,956,1154,1294,1735,2210,2625,3486],[[-2.0948,51.0615],[-1.9988,50.7168],[-1.9133,50.731],[-1.9126,50.7315],[-1.8797,50.765],[-1.7746,51.1835]]],"900":[[900,2027,2080,2803,5223,5352,5689],[[-4.475,55.8087],[-4.2965,55.83],[-4.3159,55.8549],[-4.3812,55.8808],[-4.4603,55.9038]]],"5772":[[647,930,1847,1848,2906,3443,5736,5772],[[-3.9605,51.685],[-3.8982,51.6251],[-3.7539,51.5629],[-3.824,51.6292],[-3.9534,51.6913]]],"5435":[[310,315,349,821,1818,5435,5436,5437],[[1.2723,52.574],[1.7115,52.5552],[1.3081,52.6077]]],"539":[[539,547,548,719,720,721],[[0.6971,51.3445],[0.7538,51.366],[0.7587,51.3794],[0.7522,51.4374],[0.7496,51.4367]]],"4476":[[381,416,480,771,2234,4476,4477,5192,5669],[[-2.5658,51.5006],[-2.5527,51.5045],[-2.4124,51.5527],[-2.4752,51.5988],[-2.5599,51.5474]]],"5439":[[292,516,623,5210,5438,5439,5628],[[1.0183,52.1712],[1.051,52.0748],[1.0609,52.0712],[1.1361,52.056],[1.4688,52.3957]]],"905":[[402,905,1996,1998,5217],[[-2.6282,56.7402],[-2.3019,56.9246],[-2.1899,57.2158],[-2.3799,57.2192],[-2.3815,57.2188]]],"439":[[240,439,440,457,649,801,873,2052],[[-1.9283,52.487],[-1.8795,52.4745],[-1.8284,52.5125],[-1.8576,52.5067]]],"622":[[621,622,2729,3416,4422,4864,5745],[[-2.5296,53.2676],[-2.4808,53.2635],[-2.4626,53.2661],[-2.3683,53.4676],[-2.525,53.3828]]],"4734":[[1112,1238,3456,4734,5153,5647],[[-1.5838,53.7759],[-1.5379,53.733],[-1.5375,53.7328],[-1.4952,53.765],[-1.4939,53.7785]]],"2000":[[843,1742,1767,2000,2005,2936,4957],[[-3.7838,56.717],[-3.2948,56.3403],[-2.9967,56.4618],[-2.9779,56.5213]]],"420":[[320,322,420,422,1128,2175,5201,5782],[[-1.8207,52.4643],[-1.7491,52.4065],[-1.7124,52.4519],[-1.7058,52.5161],[-1.7086,52.5278],[-1.7181,52.5246]]],"4656":[[964,2204,2676,4655,4656],[[-0.0426,51.559],[-0.0124,51.5326],[-0.0122,51.5328],[-0.0192,51.5434]]],"5799":[[1243,2311,2731,4416,5724,5725,5783,5799],[[-2.5176,53.5585],[-2.5121,53.5144],[-2.2763,53.4895],[-2.2992,53.5124],[-2.3402,53.5515]]],"852":[[477,489,518,685,698,700,852,1670,1671,1768,1889,2975,5732],[[-0.8813,52.2294],[-0.5014,51.934],[-0.4252,51.9078],[-0.2703,52.2069],[-0.7383,52.4011]]],"1837":[[204,205,290,294,1837,1909,2166,2873,2971],[[-2.9472,53.2675],[-2.835,53.2685],[-2.6649,53.3116],[-2.7555,53.3323]]],"2046":[[3,2046,2047,3049,5018,5447,5448,5795],[[-3.5752,54.0795],[-3.5023,54.0446],[-2.9912,53.8806],[-2.7869,54.0661],[-3.4112,54.0785]]],"5736":[[645,647,1847,1848,2906,3434,3443,4207,4484,5736,5772],[[-4.1323,51.6752],[-3.8982,51.6251],[-3.8221,51.625],[-3.824,51.6292],[-3.9534,51.6913],[-4.1293,51.6997]]],"4386":[[478,519,892,3600,3605,3607,4386],[[-1.2168,52.5976],[-1.2095,52.584],[-1.0244,52.5372],[-1.1015,52.6297],[-1.1432,52.6468]]],"926":[[472,473,879,926,5199],[[1.0869,51.2908],[1.0942,51.2923],[1.0979,51.2948],[1.0956,51.3536]]],"473":[[472,473,926,5199],[[1.0869,51.2908],[1.0942,51.2923],[1.0979,51.2948]]],"193":[[193,541,557,559,560,695,3178,4782,4979,5624],[[0.2547,51.4441],[0.2743,51.1454],[0.3926,51.1774],[0.5337,51.2747],[0.4614,51.3526],[0.3299,51.4283]]],"5744":[[290,464,466,596,616,639,1388,1752,3183,5744,5775,5776,5777],[[-3.0532,53.0288],[-2.1676,52.9239],[-2.0837,53.0407],[-2.6649,53.3116]]],"269":[[265,269,297,369,386,804,2176],[[0.1071,52.2436],[0.1428,52.2037],[0.187,52.1886],[0.3179,52.2774],[0.3126,52.2808]]],"480":[[480,2234,4476,4488,5669,5673,5752,5774],[[-2.5706,51.4856],[-2.5653,51.4491],[-2.5129,51.5243],[-2.507,51.5597],[-2.566,51.5008]]],"1182":[[1182,1368,5211],[[-1.0304,53.7879],[-0.9925,53.7325],[-0.9925,53.7362]]],"466":[[464,466,596,1388,1752,3183,5744,5775,5776,5777],[[-2.5527,53.077],[-2.1676,52.9239],[-2.0837,53.0407],[-2.5498,53.2381]]],"5788":[[483,1164,1571,3215,5455,5788],[[-3.5371,54.6773],[-2.6068,55.0262],[-3.2531,54.9941]]],"5776":[[464,465,466,616,1388,1752,3183,5744,5775,5776,5777],[[-2.5527,53.077],[-2.1676,52.9239],[-2.0439,52.98],[-2.0837,53.0407],[-2.5498,53.2381]]],"4782":[[193,541,557,1202,2717,4782,4979,5624],[[0.1404,51.3452],[0.3434,51.1681],[0.4624,51.3144],[0.3299,51.4283],[0.2499,51.4513]]],"3423":[[651,1651,1686,3423,3443,4484],[[-4.0303,51.7725],[-3.9641,51.684],[-3.9605,51.685],[-3.7543,51.7628],[-3.9994,51.7791]]],"535":[[493,535,537,538,576,1426,1659,2534,4621,4631,4632,5112],[[-1.2447,53.0879],[-0.8577,52.9477],[-0.809,53.051],[-0.9614,53.325],[-0.9978,53.3082],[-1.199,53.1553]]],"479":[[199,246,479,686,2605,3682,4989,5392],[[-1.4872,50.9419],[-1.4435,50.8973],[-0.7707,51.2317],[-0.7595,51.3276],[-0.8622,51.2865]]],"1897":[[416,818,942,1897,3408,3952,4233],[[-2.7891,51.3565],[-2.5599,51.5474],[-2.6667,51.5407],[-2.745,51.489]]],"1119":[[1043,1090,1118,1119,1207],[[-1.9237,53.909],[-1.9058,53.8648],[-1.866,53.8104],[-1.8676,53.8339],[-1.8887,53.8703]]],"5752":[[480,1396,2234,3202,4488,5669,5673,5752,5774],[[-2.5833,51.4592],[-2.5653,51.4491],[-2.4734,51.498],[-2.5129,51.5243],[-2.566,51.5008]]],"3509":[[432,433,1276,2072,2223,2687,3509,4241],[[-1.6398,53.1261],[-1.5736,52.8742],[-1.5504,52.8556],[-1.4637,52.879],[-1.4613,52.8857],[-1.4764,52.9258]]],"1847":[[647,930,1847,1848,2155,5736,5772],[[-3.9586,51.6861],[-3.8982,51.6251],[-3.7472,51.5579],[-3.824,51.6292]]],"2687":[[432,433,1276,2072,2223,2687,3509,4241,5778],[[-1.6398,53.1261],[-1.5736,52.8742],[-1.5504,52.8556],[-1.4637,52.879],[-1.4006,52.9053]]],"5719":[[741,745,2673,5719,5720,5721,5751],[[-0.2395,51.7363],[0.1192,51.7074],[0.0665,51.7638],[0.0086,51.759]]],"453":[[301,304,452,453,454,2068,2511,2854],[[-3.0431,53.5549],[-3.0098,53.4753],[-2.6944,53.434],[-2.961,53.6435]]],"575":[[370,421,574,575,4260,4959],[[-1.6155,52.3861],[-1.5669,52.2861],[-1.5619,52.2862],[-1.5073,52.4202],[-1.6051,52.401]]],"322":[[302,320,322,335,395,420,434,5782],[[-1.9743,52.3962],[-1.8062,52.3946],[-1.7491,52.4065],[-1.7124,52.4519],[-1.7086,52.5278]]],"843":[[485,843,1742,1997,2000,2324,4957,5488],[[-3.7838,56.717],[-3.0448,56.4741],[-2.9248,56.4752],[-2.6196,56.564],[-2.8654,56.6544]]],"295":[[295,296,711,723,1030,4754,4755],[[0.3914,51.5656],[0.7337,51.5707],[0.5369,51.6206]]],"315":[[310,315,821,1818,5435,5436,5437],[[1.2723,52.574],[1.2751,52.5749],[1.2759,52.5753],[1.3081,52.6077]]],"2005":[[1767,2000,2005,2936,2937,4957],[[-3.2948,56.3403],[-2.9783,56.4632],[-3.0425,56.5143]]],"547":[[539,547,548,719,720,721],[[0.6971,51.3445],[0.7538,51.366],[0.7587,51.3794],[0.7522,51.4374],[0.7496,51.4367]]],"2623":[[144,815,1171,1434,2623,3363,3434,4143,4663],[[-4.9337,51.8066],[-4.1737,51.6773],[-4.1293,51.6997],[-4.2018,51.9578]]],"5647":[[598,1112,1369,2060,3456,4734,5153,5646,5647,5765],[[-1.5746,53.7693],[-1.5379,53.733],[-1.5375,53.7328],[-1.4948,53.7649],[-1.4939,53.7785],[-1.5093,53.8017]]],"1728":[[255,442,524,885,1206,1231,1728,1781,2277,3252,3780,4420,5170,5231],[[-1.924,53.7088],[-1.7727,53.6511],[-1.5192,53.5736],[-1.4326,53.6085],[-1.47,53.6743],[-1.5107,53.718],[-1.6887,53.7322],[-1.8582,53.7263]]],"569":[[477,478,518,568,569,1670,1739],[[-1.0244,52.5372],[-0.7277,52.2431],[-0.614,52.3193],[-0.6694,52.4913],[-0.6807,52.5095]]],"1021":[[194,236,321,599,1021],[[-1.0662,50.8649],[-0.998,50.8468],[-0.6903,50.8589],[-1.0247,50.9165],[-1.0398,50.917]]],"5217":[[402,905,1998,4731,5217],[[-2.3815,57.2188],[-2.3019,56.9246],[-2.1822,57.205],[-2.1899,57.2158],[-2.3799,57.2192]]],"457":[[240,329,439,440,457,649,873,1116,2052],[[-1.9004,52.4891],[-1.8991,52.4874],[-1.8878,52.4727],[-1.8595,52.4614],[-1.8284,52.5125],[-1.8576,52.5067]]],"1238":[[260,1163,1237,1238,1792,3389,3522,4734,5153],[[-1.6284,53.828],[-1.584,53.7761],[-1.5379,53.733],[-1.5898,53.8068],[-1.6154,53.8363]]],"1848":[[647,930,1847,1848,5736,5772],[[-3.9586,51.6861],[-3.8982,51.6251],[-3.7539,51.5629],[-3.824,51.6292]]],"5732":[[477,489,685,698,852,2975,5732],[[-0.7277,52.2431],[-0.5014,51.934],[-0.4252,51.9078],[-0.3017,52.2146]]],"5065":[[330,752,1130,1468,5064,5065,5102],[[-0.4633,53.7232],[-0.3799,53.7328],[-0.4157,53.8212]]],"1949":[[717,718,1949,2410,3457,3836,5103,5650,5741],[[-0.7559,53.598],[-0.5077,53.5414],[-0.5047,53.5418],[-0.5939,53.5966]]],"1153":[[1153,1154,1158,1159,1735,3054,3486],[[-2.2088,51.0134],[-2.0189,50.7189],[-1.9988,50.7168],[-1.9406,50.7556]]],"323":[[278,286,323,595,797,3797,4043],[[-2.0133,52.4311],[-1.9261,52.4276],[-1.9347,52.4479],[-1.9534,52.4734]]],"3141":[[254,676,1338,1341,1467,3141,3142,5369],[[-1.3848,53.6864],[-1.2828,53.7179],[-1.277,53.7198],[-1.2765,53.72],[-1.2782,53.7221],[-1.2843,53.723]]],"1909":[[197,204,205,243,1777,1837,1864,1909,2166],[[-2.9635,53.334],[-2.96,53.266],[-2.9126,53.2157],[-2.7162,53.3092]]],"1889":[[369,489,852,1889,2176],[[-0.4878,52.1443],[0.131,52.2351],[0.1071,52.2436],[-0.3017,52.2146]]],"489":[[477,489,685,852,1889,2176,5732],[[-0.7277,52.2431],[-0.5014,51.934],[0.1071,52.2436]]],"5455":[[483,845,2109,3215,5455,5456,5457,5788],[[-3.6947,54.7466],[-3.4955,54.4249],[-2.9617,54.9424],[-3.0007,54.9514],[-3.2531,54.9941],[-3.6946,54.7466]]],"5408":[[197,206,242,244,634,639,2214,5408,5421,5790],[[-3.0777,53.2306],[-3.0532,53.0288],[-2.9021,53.1904],[-2.9327,53.2463],[-2.96,53.266]]],"2936":[[485,2000,2005,2936,2937],[[-3.0448,56.4741],[-2.9967,56.4618],[-2.9783,56.4632],[-2.9248,56.4752],[-3.0175,56.4811]]],"5798":[[371,373,376,1930,3951,4163,5684,5798],[[-3.0167,51.629],[-2.9774,51.5476],[-2.9087,51.5648],[-2.9143,51.5803]]],"387":[[387,388,917,937],[[-3.1543,51.0171],[-2.7529,51.1312],[-2.9657,51.1181],[-2.9692,51.1173]]],"1176":[[1176,1846,1851,1885,2904,5243,5454],[[-3.5721,53.297],[-3.4763,53.1169],[-3.0794,53.2312],[-3.4846,53.3097]]],"754":[[350,642,754,919,996,1723,2285,3812],[[-0.2668,52.5937],[-0.2619,52.5561],[0.0749,52.5483],[0.1902,52.661],[0.199,52.7269]]],"472":[[472,473,879,926,5199],[[1.0869,51.2908],[1.0942,51.2923],[1.0979,51.2948],[1.0956,51.3536]]],"1481":[[1479,1481,1482,1483,3409,3450,3490],[[-1.4273,53.3909],[-1.3562,53.4364],[-1.3792,53.5003],[-1.4168,53.4293]]],"493":[[493,529,535,538,1426,1659,2063,4621],[[-1.1031,53.166],[-0.8681,53.0774],[-0.8655,53.0769],[-0.8097,53.3573],[-1.1004,53.3061]]],"3413":[[552,961,3413,3646,5031],[[-4.1604,57.3361],[-4.0666,57.3011],[-3.7319,57.2536],[-3.6011,57.3172]]],"5761":[[1269,1278,1740,3146,4292,4296,5761],[[-4.1882,50.4228],[-4.1582,50.3835],[-4.1123,50.3681],[-4.0124,50.3718],[-3.7275,50.4439],[-4.1762,50.4272]]],"5741":[[1949,5103,5650,5741],[[-0.7559,53.598],[-0.749,53.5968],[-0.5998,53.5738],[-0.7499,53.5973]]],"615":[[282,615,1572,3254,4099,4171,4172,4499],[[-3.2095,51.4699],[-3.192,51.4639],[-3.1555,51.4657],[-3.1385,51.4735],[-3.1454,51.4951]]],"5488":[[485,843,1997,2324,2937,4957,5488],[[-3.0425,56.5143],[-2.9783,56.4632],[-2.9248,56.4752],[-2.6196,56.564],[-2.8654,56.6544]]],"1651":[[651,1651,1686,3423,4484,5321],[[-4.0303,51.7725],[-3.9641,51.684],[-3.5851,51.7415],[-3.7543,51.7628],[-3.9994,51.7791]]],"1620":[[928,1619,1620,2187,2188,2503,3535],[[-1.7325,54.9751],[-1.6601,54.9594],[-1.6616,54.9724],[-1.7243,54.9886]]],"2424":[[303,798,2401,2424,2425,2429,5046,5051,5099],[[-0.1926,51.5227],[-0.0585,51.4847],[-0.0958,51.5304],[-0.1704,51.5275]]],"657":[[152,657,659,4342,5794],[[-3.2178,51.6694],[-3.1578,51.6745],[-3.167,51.7001],[-3.1963,51.765]]],"670":[[670,1586,1607,1946,4034],[[-1.6052,55.0097],[-1.4822,55.0037],[-1.4785,55.0259],[-1.5,55.0237]]],"310":[[310,315,349,821,1818,5435],[[1.2723,52.574],[1.7115,52.5552],[1.3081,52.6077]]],"1986":[[1985,1986,2004,2527,5186,5208],[[-1.8814,57.5664],[-1.8007,57.4764],[-1.8056,57.5086],[-1.8495,57.5833]]],"1156":[[867,1076,1154,1156,1157,1158,1299],[[-2.5713,50.9133],[-2.2738,50.6782],[-2.0342,50.6515],[-1.9988,50.7168]]],"1349":[[1070,1348,1349,2184,5747],[[-3.0296,53.8494],[-2.9819,53.7564],[-2.7565,53.7448]]],"586":[[586,1042,1161,1162,1431,1800,4221,4483],[[-2.3813,51.7415],[-2.0844,51.8928],[-2.0825,51.9105],[-2.1204,51.9086],[-2.2535,51.8793],[-2.2662,51.8716]]],"727":[[350,537,727,728,729,1537,3986],[[-0.8641,53.0778],[-0.6381,52.904],[-0.4197,52.7603],[0.199,52.7269],[-0.3818,53.0002]]],"1480":[[733,858,1183,1393,1480,1682,3409,3437],[[-1.6047,53.4956],[-1.4168,53.4293],[-1.1142,53.5006],[-1.1385,53.5268],[-1.3817,53.5705]]],"4957":[[325,843,1742,1767,1997,2000,2005,2324,4957,5488],[[-4.0112,56.707],[-3.2948,56.3403],[-2.6196,56.564],[-2.8654,56.6544],[-3.7838,56.717]]],"1688":[[1390,1688,1827,2571,3134,3135,4538],[[-2.06,52.5765],[-2.0093,52.5893],[-2.0008,52.5978],[-1.948,52.6801],[-1.9112,52.7517],[-1.9124,52.7537],[-2.0187,52.6825]]],"2175":[[320,329,420,422,1128,2175,5201,5782],[[-1.8595,52.4614],[-1.7124,52.4519],[-1.7058,52.5161],[-1.7086,52.5278],[-1.7181,52.5246]]],"2971":[[205,290,293,294,1837,2971],[[-2.8113,53.2779],[-2.6649,53.3116],[-2.7555,53.3323]]],"152":[[152,648,652,657,659,4342,5794],[[-3.3006,51.6358],[-3.1578,51.6745],[-3.167,51.7001],[-3.1963,51.765],[-3.2262,51.8084]]],"278":[[278,286,323,395,434,595,797,1178,2502,3797],[[-2.0133,52.4311],[-1.9815,52.397],[-1.8062,52.3946],[-1.8427,52.4404],[-1.9347,52.4479],[-1.9866,52.4409]]],"394":[[393,394,602,1757,2467,3404],[[-0.2581,51.5451],[-0.258,51.5339],[-0.2251,51.5152],[-0.2242,51.5262],[-0.2522,51.555]]],"1161":[[586,1161,1162,1431,4221],[[-2.2662,51.8716],[-2.0844,51.8928],[-2.0825,51.9105],[-2.1204,51.9086],[-2.2535,51.8793]]],"431":[[380,431,1912,1979,2929,2931,3528],[[-4.492,57.4677],[-4.2458,57.422],[-4.2132,57.4602],[-4.2745,57.7083],[-4.2999,57.6989]]],"2924":[[105,182,735,2924,4177],[[-3.3098,51.4168],[-3.2292,51.4106],[-3.228,51.4124],[-3.2172,51.5174]]],"2115":[[231,850,1882,2115,5107],[[-0.1933,51.4611],[-0.1882,51.4309],[-0.1349,51.4901],[-0.1824,51.4774]]],"1827":[[306,383,618,1390,1688,1827,4538],[[-2.06,52.5765],[-1.9621,52.5532],[-1.948,52.6801]]],"1735":[[283,510,956,1153,1154,1158,1735,2625,3486],[[-2.0326,50.7475],[-2.0189,50.7189],[-1.9988,50.7168],[-1.9126,50.7315],[-1.8797,50.765],[-1.8435,51.082]]],"557":[[193,391,541,557,559,560,4782],[[0.3136,51.4313],[0.3434,51.1681],[0.5337,51.2747],[0.4997,51.4001]]],"5327":[[1817,2857,5327,5440],[[1.6079,52.2076],[1.6184,52.2061],[1.6166,52.215]]],"2015":[[2014,2015,2016,2017,3694],[[-5.2651,56.1319],[-4.9223,56.2771],[-4.9556,56.287],[-5.0417,56.2619]]],"1768":[[477,518,700,852,1670,1671,1768,3713],[[-0.9137,52.2454],[-0.8813,52.2294],[-0.4878,52.1443],[-0.614,52.3193],[-0.7383,52.4011]]],"3929":[[467,503,640,992,3929,4722],[[-3.3004,56.1643],[-3.2713,56.1112],[-3.1447,56.1456],[-3.0392,56.199],[-3.0358,56.3136]]],"1090":[[339,1043,1090,1118,1119,1207,1208,1263,2059],[[-1.9237,53.909],[-1.875,53.7507],[-1.7525,53.8025]]],"5208":[[1985,1986,2004,2527,5208],[[-1.8814,57.5664],[-1.8056,57.5086],[-1.8495,57.5833]]],"273":[[273,274,549,3089,5580],[[-0.2405,50.9897],[-0.2348,50.9753],[-0.1632,51.1148],[-0.1627,51.1174],[-0.1688,51.1354]]],"1154":[[510,1153,1154,1156,1158,1735,3054,3486],[[-2.0758,50.7319],[-2.0189,50.7189],[-1.9988,50.7168],[-1.9406,50.7556],[-1.8953,50.8468]]],"373":[[371,372,373,376,377,1930,3951,4163,5684,5798],[[-3.0167,51.629],[-3.0048,51.567],[-2.9774,51.5476],[-2.9087,51.5648],[-2.9143,51.5803]]],"4538":[[383,618,1390,1688,1827,2571,3134,4022,4538],[[-2.114,52.5812],[-2.06,52.5765],[-2.0178,52.5806],[-1.9704,52.5981],[-1.9112,52.7517],[-2.0187,52.6825]]],"1368":[[1182,1368,5211],[[-1.0304,53.7879],[-0.9925,53.7325],[-0.9925,53.7362]]],"1136":[[459,1136,5688,5690],[[-4.3769,55.93],[-4.3543,55.9063],[-4.3159,55.8695],[-4.2862,55.8634]]],"380":[[380,431,667,1912,2929,2931,3528],[[-4.492,57.4677],[-4.2458,57.422],[-3.8484,57.5766],[-4.2999,57.6989]]],"2982":[[341,350,642,728,789,1067,2972,2982,3812],[[-0.2015,52.576],[0.1902,52.661],[0.4029,52.7315],[0.3997,52.7578],[0.0318,52.7567]]],"2220":[[1374,1955,2220,3978],[[-0.3593,53.7813],[-0.3447,53.7626],[-0.3268,53.7561]]],"197":[[197,204,243,1777,1864,1909,5408,5421],[[-2.9635,53.334],[-2.96,53.266],[-2.9314,53.2106],[-2.9126,53.2157],[-2.8131,53.2771]]],"623":[[623,5438,5439,5628,5734],[[0.723,52.24],[1.051,52.0748],[1.0609,52.0712],[1.0625,52.0725],[1.0183,52.1712]]],"2188":[[566,928,1085,1619,1620,2186,2187,2188,2503],[[-1.7432,54.9777],[-1.7325,54.9744],[-1.7174,54.9724],[-1.6616,54.9724],[-1.7243,54.9886]]],"468":[[463,468,570,1556,2807,5266,5782],[[-1.712,52.5342],[-1.7086,52.5278],[-1.6567,52.6083],[-1.59,52.7583],[-1.6517,52.7732],[-1.6877,52.6323]]],"1752":[[464,465,466,616,1752,5744,5775,5776,5777],[[-2.4845,53.1029],[-2.1676,52.9239],[-2.0439,52.98],[-2.0837,53.0407],[-2.1768,53.08]]],"265":[[265,269,297,369,804],[[0.131,52.2351],[0.187,52.1886],[0.3179,52.2774],[0.3126,52.2808]]],"4099":[[382,615,1572,3254,4099,4171,4172,4482,4499],[[-3.192,51.4639],[-3.1555,51.4657],[-3.1385,51.4735],[-3.0992,51.5117],[-3.1712,51.4904]]],"735":[[82,105,182,735,2924,4176,4177],[[-3.3252,51.4122],[-3.2292,51.4106],[-3.228,51.4124],[-3.1999,51.5261],[-3.2172,51.5174]]],"467":[[467,502,503,534,640,992,3929,4722],[[-3.7795,56.1372],[-3.2929,56.1059],[-3.2713,56.1112],[-3.1447,56.1456],[-3.0392,56.199],[-3.0358,56.3136]]],"5692":[[391,559,571,5691,5692],[[0.4614,51.3526],[0.5397,51.3779],[0.5967,51.4195],[0.5963,51.42],[0.4997,51.4001]]],"3409":[[733,1393,1479,1480,1481,1483,1682,3409,3437,3490],[[-1.6047,53.4956],[-1.4273,53.3909],[-1.1142,53.5006],[-1.3817,53.5705]]],"5064":[[330,1130,1374,1468,1955,5064,5065,5102],[[-0.4188,53.7978],[-0.3799,53.7328],[-0.3438,53.7659],[-0.3593,53.7813],[-0.4157,53.8212]]],"5438":[[292,623,5210,5438,5439,5628,5734],[[0.723,52.24],[1.051,52.0748],[1.0609,52.0712],[1.1361,52.056],[1.0183,52.1712]]],"1112":[[1112,3456,4734,5153,5647],[[-1.5746,53.7693],[-1.5379,53.733],[-1.5375,53.7328],[-1.4952,53.765],[-1.4939,53.7785]]],"5437":[[312,315,821,1818,5435,5436,5437],[[1.228,52.6296],[1.2723,52.574],[1.2751,52.5749],[1.2759,52.5753]]],"5046":[[2424,2429,2434,2469,5045,5046],[[-0.1891,51.4322],[-0.0968,51.4672],[-0.0481,51.486],[-0.1099,51.5229]]],"210":[[210,264,1433,5073],[[0.225,51.5596],[0.2715,51.4811],[0.3599,51.6405]]],"2931":[[380,431,1979,2929,2931],[[-4.492,57.4677],[-4.2387,57.4305],[-4.2745,57.7083],[-4.2999,57.6989]]],"4338":[[370,421,3658,4338,5353],[[-1.5669,52.2861],[-1.5202,52.2536],[-1.5476,52.2846],[-1.5619,52.2862]]],"914":[[914,1189,1196],[[-4.2601,55.8442],[-4.2038,55.8354],[-4.1972,55.8573]]],"1144":[[1144,1180,2055,3942],[[-0.1922,53.6153],[-0.1515,53.5658],[-0.1462,53.6014],[-0.1777,53.6164]]],"2103":[[241,987,1534,2103,2535,4408,4409],[[-1.2295,52.9155],[-1.188,52.9239],[-1.0505,52.9599],[-1.1734,52.9785]]],"1042":[[381,586,978,1042,1800,4221,4477,4483],[[-2.4808,51.5695],[-2.273,51.7387],[-2.2535,51.8793],[-2.2662,51.8716],[-2.3813,51.7415],[-2.4752,51.5988]]],"2155":[[743,930,933,1806,1847,2155],[[-3.8221,51.625],[-3.7539,51.5629],[-3.7472,51.5579],[-3.6878,51.5361],[-3.5785,51.5182]]],"1140":[[583,584,585,1140,1142,1187,1710],[[-2.2091,52.5565],[-2.1943,52.5056],[-2.1226,52.4597],[-2.0995,52.5068],[-2.0921,52.5517],[-2.1859,52.5732]]],"304":[[301,304,305,340,453,2068,2182,3416,4657],[[-2.9488,53.491],[-2.8489,53.3529],[-2.525,53.3828],[-2.8607,53.4909]]],"516":[[515,516,517,5210,5439],[[1.0586,52.0746],[1.0609,52.0712],[1.5101,52.3562],[1.5093,52.4379]]],"416":[[381,416,771,1897,3952,4228,4476,4477,5192],[[-2.6702,51.5368],[-2.5647,51.5269],[-2.4124,51.5527],[-2.4752,51.5988],[-2.6667,51.5407]]],"801":[[240,306,383,439,444,620,801,1190,2052,4218],[[-1.9704,52.5981],[-1.9694,52.5075],[-1.9159,52.477],[-1.8522,52.5069],[-1.8802,52.5554]]],"485":[[485,843,2936,2937,5488],[[-2.9967,56.4618],[-2.9783,56.4632],[-2.9248,56.4752],[-2.9242,56.4757],[-2.9779,56.5213]]],"5690":[[459,1136,1195,1280,1753,2021,5688,5690],[[-4.7087,56.0235],[-4.5618,55.9613],[-4.3159,55.8695],[-4.2862,55.8634],[-4.3492,55.9155],[-4.3769,55.93]]],"513":[[513,514,4849,5399],[[-1.1564,53.7775],[-1.0231,53.9568],[-1.0587,53.9593]]],"5099":[[303,798,2424,2443,5051,5099],[[-0.1926,51.5227],[-0.1515,51.5131],[-0.1099,51.5229],[-0.1704,51.5275]]],"1509":[[1211,1509,2041,2042,2043,2097,2547],[[-4.8078,54.8821],[-4.0352,54.8608],[-3.5911,55.0676],[-4.1896,55.1432]]],"991":[[731,991,2248,2972,4609],[[-0.2232,52.937],[0.191,52.756],[0.2927,53.1607]]],"955":[[510,955,956,2625],[[-1.9133,50.731],[-1.9126,50.7315],[-1.8797,50.765],[-1.8953,50.8468]]],"1224":[[1221,1224,2090,2096],[[-2.0538,52.5199],[-2.0226,52.4931],[-2.0231,52.4986]]],"1710":[[583,585,1140,1142,1710],[[-2.2091,52.5565],[-2.1943,52.5056],[-2.1226,52.4597],[-2.0995,52.5068]]],"1800":[[586,1042,1800,3641,3642,4221,4483],[[-2.3813,51.7415],[-2.2256,51.855],[-2.2535,51.8793],[-2.2662,51.8716]]],"583":[[583,584,585,1140,1142,1187,1710],[[-2.2091,52.5565],[-2.1943,52.5056],[-2.1226,52.4597],[-2.0995,52.5068],[-2.0921,52.5517],[-2.1859,52.5732]]],"917":[[387,388,917,1025],[[-3.3399,51.1586],[-3.1543,51.0171],[-2.9657,51.1181]]],"395":[[278,302,320,322,335,395,434,1178,2502],[[-1.9815,52.397],[-1.9743,52.3962],[-1.8062,52.3946],[-1.7491,52.4065],[-1.7124,52.4519],[-1.8427,52.4404],[-1.9261,52.4276]]],"1138":[[729,1137,1138,2063,3986,5701],[[-0.8097,53.3573],[-0.4197,52.7603],[-0.3818,53.0002],[-0.5183,53.2286],[-0.8072,53.3604]]],"5248":[[378,1225,1602,5248,5356],[[-1.2378,54.6056],[-1.2372,54.6054],[-1.2025,54.6071],[-1.2011,54.6072],[-1.2086,54.6279]]],"774":[[1,318,606,671,688,774,4756],[[0.9024,51.8626],[1.2384,51.7298],[1.1794,51.8259],[1.0496,51.9492],[1.0234,51.9373]]],"576":[[535,537,538,576,577,2297,3338,3594,4631,4632,5112],[[-1.3879,53.2244],[-1.3694,53.0303],[-1.3628,53.0213],[-0.8577,52.9477],[-0.809,53.051],[-0.8641,53.0778]]],"430":[[401,413,430,661,662,1692],[[-2.6892,52.3667],[-2.3052,52.1264],[-2.2055,52.1677],[-2.2423,52.3125],[-2.2694,52.3376]]],"519":[[519,892,3607,4386],[[-1.2168,52.5976],[-1.2095,52.584],[-1.1627,52.6098],[-1.1413,52.6225]]],"2160":[[1256,1627,2160,2861],[[-3.23,54.1235],[-3.2028,54.1098],[-3.1905,54.1064],[-3.1721,54.1583]]],"602":[[393,394,602,1592,1757,2467,3404],[[-0.2581,51.5451],[-0.258,51.5339],[-0.2234,51.5056],[-0.2242,51.5262],[-0.2522,51.555]]],"731":[[350,730,731,991,1326,2248,2972,4609],[[-0.5883,52.9247],[0.199,52.7269],[0.2927,53.1607]]],"5447":[[3,2046,3049,5018,5447,5448],[[-3.5752,54.0795],[-3.5023,54.0446],[-2.9912,53.8806],[-2.8874,54.0328],[-3.4112,54.0785]]],"652":[[152,652,653,4253,5370,5794],[[-3.2374,51.7979],[-3.167,51.7001],[-3.1963,51.765],[-3.2262,51.8084],[-3.2335,51.8033]]],"3233":[[3233,3527,4020,5642],[[-4.4695,55.3191],[-4.018,55.3371],[-4.282,55.3541],[-4.335,55.3445]]],"290":[[205,290,294,305,1388,1516,1837,2971,5744],[[-2.8113,53.2779],[-2.4845,53.1029],[-2.5498,53.2381],[-2.6242,53.3825],[-2.7555,53.3323]]],"1256":[[1256,1627,2160,2861],[[-3.23,54.1235],[-3.2028,54.1098],[-3.1905,54.1064],[-3.1721,54.1583]]],"476":[[475,476,563,5667],[[-0.4833,52.1269],[-0.4208,52.15],[-0.4746,52.1559]]],"2922":[[749,977,1404,1970,1978,1980,2922,5052,5053],[[-4.7292,58.1876],[-4.3818,57.8846],[-3.8749,58.02],[-3.4343,58.2656],[-4.5037,58.2107]]],"640":[[467,502,503,534,640,3929],[[-3.7795,56.1372],[-3.2929,56.1059],[-3.2713,56.1112],[-3.1447,56.1456],[-3.0747,56.2029]]],"642":[[341,350,642,728,754,919,1723,2283,2285,2972,2982,3812],[[-0.2668,52.5937],[-0.2619,52.5561],[0.0544,52.5527],[0.3997,52.7578],[0.0318,52.7567]]],"541":[[193,541,557,695,3153,3178,4782],[[0.2699,51.1397],[0.3926,51.1774],[0.4624,51.3144],[0.3299,51.4283],[0.3136,51.4313]]],"718":[[717,718,1949,2410,3457,5103,5650],[[-0.7499,53.5973],[-0.749,53.5968],[-0.5047,53.5418],[-0.5939,53.5966]]],"566":[[566,928,1085,2186,2187,2188,5130],[[-1.7432,54.9777],[-1.7347,54.9738],[-1.7325,54.9744],[-1.7245,54.9781]]],"1180":[[1144,1180,1361,1399,1541,2055],[[-0.1922,53.6153],[-0.1696,53.4787],[-0.109,53.5658],[-0.1462,53.6014]]],"4189":[[374,4188,4189,4903],[[-2.9019,51.563],[-2.7119,51.5859],[-2.7543,51.589],[-2.8447,51.5816]]],"619":[[619,709,762,1030,5450],[[0.3803,51.4616],[0.3913,51.4602],[0.4551,51.5078],[0.3914,51.5656]]],"1482":[[1481,1482,1483,3450],[[-1.4065,53.4188],[-1.3562,53.4364],[-1.3792,53.5003]]],"818":[[347,818,942,975,1897,4999],[[-2.956,51.3453],[-2.5086,51.2908],[-2.6702,51.5368],[-2.745,51.489]]],"1975":[[408,409,1694,1696,1975,2804,3670,4543],[[-1.4884,52.5115],[-1.4678,52.4531],[-1.1545,52.2593],[-1.252,52.404],[-1.4437,52.5011]]],"5751":[[188,220,1730,1731,2672,2673,5666,5719,5720,5721,5728,5751],[[-0.3826,51.6164],[-0.0221,51.664],[0.0105,51.7586],[0.0086,51.759],[-0.3133,51.7449]]],"3695":[[459,1753,2019,2020,2021,2781,3695],[[-4.9479,55.9757],[-4.3769,55.93],[-4.7294,56.2455]]],"4296":[[334,1278,1322,3146,4292,4296,5761],[[-4.3732,50.4179],[-4.1123,50.3681],[-4.1198,50.3818],[-4.1762,50.4272],[-4.2426,50.4447]]],"5526":[[226,228,423,3563,5526],[[-0.5784,51.2457],[-0.3423,51.3056],[-0.4839,51.3482],[-0.5074,51.3394]]],"578":[[578,1405,3027,3719,5253,5770],[[-1.1379,52.027],[-0.9917,51.9286],[-0.907,51.9263],[-0.7955,51.9999],[-0.8673,52.0185]]],"5323":[[336,703,704,898,2135,3915,5323],[[-4.4081,50.7941],[-3.9139,50.796],[-4.0543,51.0676],[-4.0629,51.0795],[-4.1717,51.0682]]],"1846":[[1131,1176,1846,1851,1885,1914,1915,2904,5454],[[-3.6243,53.4373],[-3.5721,53.297],[-3.4763,53.1169],[-3.2808,53.2588],[-3.5406,53.4657]]],"339":[[339,1043,1090,1208,1263,2059,5333],[[-1.875,53.7507],[-1.7525,53.8025],[-1.7343,53.8259],[-1.8408,53.853],[-1.8676,53.8339]]],"1258":[[1257,1258,2047,2654,5018,5766],[[-3.1125,54.1907],[-2.8874,54.0328],[-2.7869,54.0661],[-2.6703,54.2977],[-2.7411,54.3199]]],"4207":[[645,646,647,939,2906,3434,3443,4207,4484,5736],[[-4.1323,51.6752],[-3.9814,51.6275],[-3.9143,51.6672],[-3.9534,51.6913],[-4.1293,51.6997]]],"2616":[[749,1970,2614,2616],[[-3.8749,58.02],[-3.4343,58.2656],[-3.4237,58.4469],[-3.4517,58.479]]],"277":[[60,277,1123,1269,1740,4273],[[-4.0124,50.3718],[-3.545,50.4876],[-3.5142,50.6956]]],"645":[[144,645,647,1171,2906,3434,3443,4207,4213,4484,5736],[[-4.1825,51.7091],[-4.1737,51.6773],[-3.9895,51.646],[-3.9143,51.6672],[-3.9534,51.6913]]],"404":[[183,404,973,1663,2951],[[-2.7873,57.152],[-2.0916,57.1085],[-2.0987,57.1401]]],"1039":[[465,628,1039,1040,1704,2601,3134,3135,4637],[[-2.1223,52.8102],[-2.1064,52.794],[-1.8174,52.698],[-2.0439,52.98]]],"713":[[328,712,713,4754,4755,5733],[[0.5185,51.716],[0.5369,51.6206],[0.5556,51.6072],[0.8866,51.8445],[0.576,51.8658]]],"212":[[211,212,213,4443,5279],[[-0.6172,51.5183],[-0.505,51.4802],[-0.4973,51.5417],[-0.4992,51.6102]]],"5485":[[1887,2134,2147,2810,5485],[[-2.4479,53.759],[-2.3008,53.6942],[-2.3275,53.7945]]],"5034":[[379,594,627,935,1335,2250,5034],[[-1.5608,54.5555],[-1.5594,54.3278],[-1.2672,54.5875],[-1.267,54.588],[-1.3646,54.5922]]],"2511":[[301,452,453,454,2068,2511,2854,5747],[[-3.0431,53.5549],[-3.0098,53.4753],[-2.8483,53.4691],[-2.7565,53.7448],[-2.961,53.6435]]],"2052":[[240,306,439,444,457,649,801,873,2052],[[-1.9621,52.5532],[-1.9283,52.487],[-1.9159,52.477],[-1.8284,52.5125]]],"1049":[[504,1048,1049,5757,5759],[[-1.36,50.8102],[-1.3543,50.7858],[-1.2538,50.71],[-1.3287,50.8217]]],"217":[[217,219,221,362,363],[[-0.5897,51.722],[-0.3669,51.5802],[-0.4045,51.6426],[-0.4833,51.7737]]],"3955":[[743,922,933,1255,3955,4153],[[-3.6878,51.5361],[-3.5355,51.4948],[-3.3993,51.5287]]],"4273":[[60,277,287,1666,2671,2994,4272,4273],[[-3.7304,50.4717],[-3.6111,50.5726],[-3.4061,50.7665],[-3.5284,50.7121]]],"301":[[301,304,340,452,453,2068,2182,2511],[[-3.0098,53.4753],[-2.7384,53.4212],[-2.5685,53.3889],[-2.9683,53.5602]]],"5755":[[484,1938,4418,5678,5755],[[-4.5994,53.295],[-4.5435,53.2739],[-4.3372,53.411],[-4.4822,53.4136]]],"708":[[291,554,708,813,3105,3107],[[0.2795,50.8173],[0.5905,50.8679],[0.7112,50.9745],[0.7749,51.0327]]],"1336":[[1336,1582,1865,5549,5551],[[-0.9094,51.3858],[-0.7928,51.4093],[-0.7194,51.5183],[-0.8915,51.4368]]],"340":[[301,304,305,340,1516,2067,2182,2729,3416],[[-2.8483,53.4691],[-2.6655,53.3441],[-2.525,53.3828],[-2.408,53.4359]]],"2186":[[566,928,1085,2186,2187,2188],[[-1.7432,54.9777],[-1.7325,54.9744],[-1.7245,54.9781]]],"572":[[572,573,628,1704,2394,5697],[[-2.1223,52.8102],[-2.1146,52.6363],[-2.1132,52.6336],[-2.0707,52.5989],[-2.0667,52.6052],[-2.1064,52.794]]],"483":[[483,1164,1571,2040,2109,3215,5455,5457,5788],[[-3.6947,54.7466],[-3.5114,54.6494],[-2.6068,55.0262],[-3.2296,55.0165]]],"503":[[467,502,503,505,534,640,3929],[[-3.7795,56.1372],[-3.4495,56.0896],[-3.2929,56.1059],[-3.2713,56.1112],[-3.1447,56.1456],[-3.0747,56.2029]]],"331":[[331,1608,2448,2450],[[-0.1369,51.5393],[-0.1157,51.55],[-0.1135,51.5615]]],"2530":[[148,1434,1900,2493,2530,5753],[[-5.0752,51.7192],[-4.9009,51.6997],[-4.9337,51.8066],[-5.0591,51.7408]]],"3107":[[252,291,702,708,1884,3107],[[0.0171,50.8734],[0.2976,50.7833],[0.6007,50.8773],[0.4485,50.8813],[0.0412,50.8872]]],"2803":[[544,900,2027,2803,5352,5689],[[-4.4829,55.9042],[-4.413,55.8404],[-4.3159,55.8549],[-4.3812,55.8808],[-4.4603,55.9038]]],"4171":[[282,615,3254,4099,4171,4172],[[-3.2095,51.4699],[-3.192,51.4639],[-3.1555,51.4657],[-3.1385,51.4735],[-3.1638,51.4779],[-3.178,51.4771]]],"283":[[283,510,956,1159,1259,1294,1735,2210,2625],[[-2.2088,51.0134],[-1.9406,50.7556],[-1.9126,50.7315],[-1.8797,50.765],[-1.4954,51.2175],[-1.7746,51.1835],[-2.0948,51.0615]]],"5779":[[148,1747,5773,5779],[[-5.0305,51.6815],[-4.9895,51.6822],[-4.9079,51.684],[-4.9009,51.6997]]],"1749":[[399,1072,1749,1984,2784,5220,5221],[[-6.4139,57.4102],[-5.936,57.248],[-5.1232,57.0628],[-4.7182,57.135],[-4.7183,57.1363],[-4.7186,57.1368]]],"770":[[338,770,969,1259,1896,2210,3983,5425],[[-2.3049,51.2311],[-1.5192,51.098],[-1.4575,51.2157],[-2.1073,51.4674]]],"1682":[[255,521,733,1393,1480,1682,1781,3409,3437],[[-1.6047,53.4956],[-1.4168,53.4293],[-1.1142,53.5006],[-1.47,53.6743]]],"1374":[[1374,1955,2220,3978,5064],[[-0.4115,53.8],[-0.3447,53.7626],[-0.3268,53.7561],[-0.3593,53.7813]]],"2994":[[60,287,1666,2994,3329,4272,4273],[[-3.6111,50.5726],[-3.4501,50.7389],[-3.5284,50.7121]]],"3969":[[454,614,948,1168,2184,3969,5747],[[-2.9775,53.7815],[-2.961,53.6435],[-2.6895,53.6169],[-2.6966,53.7048],[-2.7323,53.7571]]],"194":[[194,236,321,599,1021,1835,5682],[[-1.0789,50.8449],[-0.998,50.8468],[-0.6903,50.8589],[-1.0247,50.9165],[-1.0398,50.917],[-1.0424,50.9169]]],"814":[[814,815,847,2704,4663,5737],[[-4.3621,52.0058],[-4.358,51.8482],[-4.357,51.8478],[-4.0899,52.0951],[-3.8787,52.4126]]],"201":[[201,266,865,866,872],[[-1.327,51.6312],[-1.3174,51.5796],[-0.7767,51.6223],[-1.1905,51.7111],[-1.2359,51.7059]]],"5628":[[292,623,5210,5438,5439,5628,5734],[[0.723,52.24],[1.051,52.0748],[1.0609,52.0712],[1.1361,52.056],[1.0183,52.1712]]],"434":[[278,286,322,335,395,434,2502,3797],[[-2.0133,52.4311],[-1.9743,52.3962],[-1.8062,52.3946],[-1.7491,52.4065],[-1.8427,52.4404],[-1.9369,52.4443]]],"3952":[[381,416,942,1897,3952,4228,4233],[[-2.745,51.489],[-2.5647,51.5269],[-2.4808,51.5695],[-2.6667,51.5407]]],"305":[[290,304,305,340,1516,2067,2069,3416],[[-2.6944,53.434],[-2.689,53.3714],[-2.6888,53.3702],[-2.6649,53.3116],[-2.525,53.3828]]],"5745":[[591,622,2729,3416,4422,5745],[[-2.525,53.3828],[-2.4808,53.2635],[-2.3218,53.4325],[-2.3683,53.4676]]],"873":[[240,329,439,440,457,649,873,1116,2052],[[-1.9004,52.4891],[-1.8991,52.4874],[-1.8878,52.4727],[-1.8595,52.4614],[-1.8284,52.5125],[-1.8576,52.5067]]],"446":[[248,415,446,561,970],[[-0.249,51.9277],[0.1417,51.8783],[0.3605,51.9656]]],"661":[[430,661,662,1692,3635],[[-2.6892,52.3667],[-2.2364,52.1919],[-2.2423,52.3125],[-2.2509,52.3827]]],"3142":[[254,526,1467,3141,3142,4859,5369],[[-1.3556,53.7495],[-1.287,53.717],[-1.277,53.7198],[-1.2765,53.72],[-1.328,53.8719]]],"5713":[[82,1931,4468,4742,5713,5771],[[-3.4033,51.3853],[-3.3252,51.4122],[-3.299,51.5746],[-3.4031,51.3884]]],"5770":[[578,1405,3027,3214,3719,5253,5770],[[-1.1379,52.027],[-1.1334,51.9091],[-0.907,51.9263],[-0.7955,51.9999],[-0.8673,52.0185]]],"4519":[[579,1024,3027,4519,5253],[[-1.3356,52.0703],[-0.9083,51.928],[-1.1114,52.0437],[-1.1461,52.0492]]],"1393":[[255,524,733,1393,1480,1682,3409,3437],[[-1.6047,53.4956],[-1.4168,53.4293],[-1.1142,53.5006],[-1.47,53.6743]]],"964":[[964,2204,2676,4655,4656],[[-0.0426,51.559],[-0.0124,51.5326],[-0.0122,51.5328],[-0.0192,51.5434]]],"1781":[[255,442,521,524,733,1682,1728,1781,2277],[[-1.6534,53.6777],[-1.5192,53.5736],[-1.3789,53.502],[-1.3817,53.5705],[-1.47,53.6743],[-1.5107,53.718]]],"3404":[[393,394,602,1592,2465,3404],[[-0.258,51.5339],[-0.2217,51.4906],[-0.2242,51.5262],[-0.2551,51.5337]]],"5759":[[504,1048,1049,5759],[[-1.36,50.8102],[-1.3543,50.7858],[-1.2538,50.71],[-1.2859,50.7458]]],"5624":[[193,1202,4782,4979,5624],[[0.1404,51.3452],[0.3078,51.414],[0.3299,51.4283],[0.2547,51.4441]]],"478":[[478,569,892,1739,3600,3605,4386],[[-1.1627,52.6098],[-1.0244,52.5372],[-0.7131,52.4853],[-0.6694,52.4913],[-1.1432,52.6468]]],"865":[[201,266,865,866,872],[[-1.327,51.6312],[-1.3174,51.5796],[-0.7767,51.6223],[-1.1905,51.7111],[-1.2359,51.7059]]],"366":[[366,1405,2081,3719,5253],[[-0.9083,51.928],[-0.7436,52.0109],[-0.7963,52.0495],[-0.8673,52.0185]]],"3671":[[1695,3670,3671,4589],[[-1.4437,52.5011],[-1.3956,52.5287],[-1.3636,52.6252],[-1.4365,52.5299]]],"4165":[[648,3236,4088,4165,4742,5771],[[-3.4024,51.3891],[-3.2401,51.5924],[-3.3006,51.6358],[-3.3895,51.5498]]],"1753":[[459,1195,1280,1753,2021,2781,3695,5690],[[-4.8303,56.0832],[-4.7087,56.0235],[-4.5618,55.9613],[-4.4101,55.9189],[-4.3543,55.9063],[-4.3492,55.9155],[-4.7294,56.2455]]],"2247":[[379,594,1563,2247,5228],[[-1.7021,54.413],[-1.3646,54.5922],[-1.5608,54.5555],[-1.5886,54.5298],[-1.7019,54.4132]]],"1884":[[702,1748,1884,3107],[[0.0171,50.8734],[0.0563,50.7965],[0.2795,50.8173],[0.0412,50.8872]]],"4109":[[254,4109,4849,5369,5399],[[-1.2782,53.7221],[-1.2765,53.72],[-1.1564,53.7775],[-1.0442,53.9491]]],"3338":[[538,576,2297,3338,3594],[[-1.3694,53.0303],[-1.3628,53.0213],[-0.8655,53.0769],[-1.3029,53.1056]]],"4499":[[382,615,1572,4099,4172,4482,4499],[[-3.1712,51.4904],[-3.1638,51.4779],[-3.1555,51.4657],[-3.1385,51.4735],[-3.0992,51.5117]]],"4903":[[1930,3951,4188,4189,4903],[[-2.9717,51.5494],[-2.7543,51.589],[-2.8447,51.5816]]],"1992":[[552,863,1992,3646,4777],[[-3.7319,57.2536],[-3.1335,57.4428],[-2.9383,57.5403],[-3.316,57.416],[-3.6011,57.3172]]],"1660":[[300,1660,1661,2073,4409,5780],[[-1.265,52.9163],[-1.2568,52.8622],[-1.0705,52.826],[-1.188,52.9239]]],"1048":[[504,1048,1049,5757,5759],[[-1.36,50.8102],[-1.3543,50.7858],[-1.2538,50.71],[-1.3287,50.8217]]],"291":[[252,291,702,708,813,3105,3107],[[0.0412,50.8872],[0.2976,50.7833],[0.5905,50.8679],[0.7112,50.9745]]],"2004":[[1000,1985,1986,2004,5186,5208],[[-1.8814,57.5664],[-1.7993,57.4738],[-1.8056,57.5086],[-1.8488,57.5741],[-1.8553,57.575]]],"1563":[[594,1563,2247,5228],[[-1.7021,54.413],[-1.5608,54.5555],[-1.5886,54.5298],[-1.7019,54.4132]]],"667":[[380,507,667,1912,5219],[[-4.2469,57.4539],[-4.2132,57.4602],[-3.3424,57.6598],[-3.3212,57.6648],[-3.8484,57.5766]]],"247":[[200,246,247,253,4989],[[-1.4872,50.9419],[-1.4657,50.9182],[-1.3936,50.9702],[-1.4719,50.9497]]],"228":[[226,228,423,3563,5526],[[-0.5784,51.2457],[-0.3423,51.3056],[-0.4839,51.3482],[-0.5074,51.3394]]],"4173":[[1572,3560,4173,4180,4482],[[-3.194,51.5247],[-3.1814,51.4965],[-3.1712,51.4904],[-3.1454,51.4951],[-3.1617,51.518]]],"1467":[[254,1467,3141,3142,5369],[[-1.287,53.717],[-1.277,53.7198],[-1.2765,53.72],[-1.2782,53.7221],[-1.2843,53.723]]],"5219":[[507,667,863,1912,5219],[[-4.2132,57.4602],[-2.9383,57.5403],[-3.3212,57.6648],[-3.8484,57.5766]]],"4335":[[116,1962,2671,4335],[[-3.4061,50.7665],[-3.4008,50.6309],[-3.3939,50.6324],[-3.3501,50.731]]],"1195":[[459,1195,1280,1732,1753,2021,5690],[[-4.7087,56.0235],[-4.5618,55.9613],[-4.4101,55.9189],[-4.3543,55.9063],[-4.31,55.9033],[-4.3769,55.93]]],"5683":[[187,196,5683],[[-1.3249,50.9055],[-1.2325,50.8848],[-1.2266,50.8979]]],"2605":[[246,479,686,2605,3682,5392],[[-1.4872,50.9419],[-0.7707,51.2317],[-0.7595,51.3276],[-0.8622,51.2865]]],"2425":[[303,2401,2424,2425,2429],[[-0.1704,51.5275],[-0.0984,51.5072],[-0.0933,51.5206],[-0.0958,51.5304]]],"4418":[[484,1938,4418,5678,5755],[[-4.5994,53.295],[-4.5435,53.2739],[-4.3372,53.411],[-4.4822,53.4136]]],"5777":[[464,465,466,596,1752,5744,5775,5776,5777],[[-2.4845,53.1029],[-2.1676,52.9239],[-2.0439,52.98],[-2.0837,53.0407],[-2.1768,53.08]]],"262":[[262,263,1463,1545],[[-2.0375,52.5413],[-2.0061,52.5307],[-2.0295,52.5421]]],"712":[[318,328,712,713,4754,5733],[[0.5185,51.716],[0.5369,51.6206],[0.8866,51.8445],[0.9024,51.8626],[0.576,51.8658]]],"669":[[669,810,3441],[[1.1447,51.0984],[1.1483,51.0847],[1.1492,51.0847]]],"5112":[[535,537,538,543,576,1542,4631,4632,5112],[[-1.2447,53.0879],[-0.8577,52.9477],[-0.6292,52.9132],[-0.6465,52.9377],[-0.809,53.051],[-0.8641,53.0778]]],"5436":[[312,315,821,1818,5435,5436,5437],[[1.228,52.6296],[1.2723,52.574],[1.2751,52.5749],[1.2759,52.5753]]],"1299":[[867,1076,1156,1299],[[-2.2738,50.6782],[-2.0342,50.6515],[-2.0758,50.7319]]],"5697":[[572,573,628,2394,5697],[[-2.1223,52.8102],[-2.1146,52.6363],[-2.1132,52.6336],[-2.0707,52.5989],[-2.0667,52.6052]]],"470":[[470,734,919,2285],[[-0.471,52.6516],[-0.2432,52.5675],[-0.2679,52.5986]]],"4176":[[735,3560,4176,4177,4180],[[-3.2792,51.4224],[-3.1617,51.518],[-3.1999,51.5261],[-3.2172,51.5174]]],"248":[[248,415,446,750],[[-0.249,51.9277],[-0.2232,51.9053],[0.1181,51.9351]]],"702":[[252,291,702,1748,1884,3107],[[0.0171,50.8734],[0.0563,50.7965],[0.2976,50.7833],[0.4485,50.8813],[0.0412,50.8872]]],"1912":[[380,431,667,1912,3528,5219],[[-4.492,57.4677],[-4.2458,57.422],[-3.3424,57.6598],[-3.8484,57.5766]]],"422":[[329,420,422,440,1128,2175],[[-1.8795,52.4745],[-1.8595,52.4614],[-1.8207,52.4643],[-1.7366,52.4797],[-1.7181,52.5246]]],"1362":[[651,660,1362,2746,5321],[[-3.7543,51.7628],[-3.3716,51.6676],[-3.5062,51.7292],[-3.5376,51.741]]],"1434":[[148,815,1434,1900,2530,2623,4663,5753],[[-5.0591,51.7408],[-4.9859,51.7103],[-4.9009,51.6997],[-4.2282,51.6881],[-4.357,51.8478],[-4.358,51.8482],[-4.9337,51.8066]]],"4292":[[334,1278,1740,3146,4292,4296,5761],[[-4.2426,50.4447],[-4.1582,50.3835],[-4.1123,50.3681],[-4.0124,50.3718],[-4.1762,50.4272]]],"116":[[116,268,1962,2671,3329,4272,4335],[[-3.4939,50.7014],[-3.4008,50.6309],[-3.3939,50.6324],[-3.3501,50.731],[-3.4053,50.7676],[-3.4501,50.7389]]],"2050":[[796,2050,3253],[[-1.6052,55.2283],[-1.5341,55.1436],[-1.5327,55.1996]]],"3254":[[282,615,1572,3254,4099,4171],[[-3.2095,51.4699],[-3.192,51.4639],[-3.1555,51.4657],[-3.1454,51.4951]]],"2016":[[2014,2015,2016,2017,3234,3694],[[-5.4581,55.6969],[-4.9223,56.2771],[-4.9556,56.287],[-5.0417,56.2619],[-5.2651,56.1319]]],"2081":[[366,1405,2081,3719,5253],[[-0.9083,51.928],[-0.7436,52.0109],[-0.7963,52.0495],[-0.8673,52.0185]]],"4999":[[347,818,942,975,4999],[[-2.956,51.3453],[-2.5086,51.2908],[-2.745,51.489]]],"402":[[402,905,3339,4731,5217],[[-2.3815,57.2188],[-2.1822,57.205],[-2.065,57.2158],[-2.3799,57.2192]]],"2784":[[399,1749,1903,1957,2784],[[-6.6454,57.5544],[-6.5396,57.4326],[-5.936,57.248],[-5.1085,57.0692]]],"2972":[[341,350,642,728,731,991,2972,2982,3812,4609],[[-0.2232,52.937],[-0.2015,52.576],[0.1902,52.661],[0.3997,52.7578],[0.2609,53.1405]]],"362":[[217,219,221,362,363,5668],[[-0.5897,51.722],[-0.3669,51.5802],[-0.4117,51.7963],[-0.4833,51.7737]]],"374":[[374,4188,4189],[[-2.8447,51.5816],[-2.7119,51.5859],[-2.7543,51.589]]],"2614":[[1970,2614,2616],[[-3.4517,58.479],[-3.4343,58.2656],[-3.4237,58.4469]]],"3942":[[1144,2055,3942],[[-0.1922,53.6153],[-0.1462,53.6014],[-0.1777,53.6164]]],"4621":[[493,529,535,1426,4621],[[-1.1004,53.3061],[-0.8681,53.0774],[-0.9614,53.325]]],"5773":[[1747,5773,5779],[[-5.0305,51.6815],[-4.9895,51.6822],[-4.9079,51.684]]],"1571":[[483,1164,1571,5788],[[-3.0007,54.9514],[-2.9591,54.8993],[-2.6068,55.0262]]],"1666":[[287,1666,2671,2994,3329,4273],[[-3.5284,50.7121],[-3.5241,50.7064],[-3.5142,50.6956],[-3.4061,50.7665]]],"798":[[303,798,2424,2445,2447,5051,5099],[[-0.1926,51.5227],[-0.1515,51.5131],[-0.1445,51.5116],[-0.1301,51.5104],[-0.1099,51.5229],[-0.1704,51.5275]]],"526":[[254,526,1873,3142,4859],[[-1.4592,53.8338],[-1.3556,53.7495],[-1.2843,53.723],[-1.2782,53.7221],[-1.328,53.8719]]],"2248":[[731,991,2248],[[-0.0148,52.9663],[0.2609,53.1405],[0.2927,53.1607]]],"3027":[[578,579,1405,3027,3719,4519,5253,5770],[[-1.1461,52.0492],[-1.1379,52.027],[-0.9917,51.9286],[-0.907,51.9263],[-0.7955,51.9999],[-0.8673,52.0185]]],"749":[[749,977,1970,2616,2922,5052],[[-4.4133,57.9432],[-4.2746,57.9499],[-3.8749,58.02],[-3.4343,58.2656],[-3.4237,58.4469],[-4.4041,58.0516]]],"230":[[230,232,233],[[-0.1276,51.3733],[-0.1127,51.3768],[-0.1231,51.3789]]],"3719":[[366,578,1405,2081,3027,3719,5253,5770],[[-1.1379,52.027],[-0.9917,51.9286],[-0.907,51.9263],[-0.7436,52.0109],[-0.7963,52.0495]]],"1059":[[1059,5223,5224],[[-4.4783,55.809],[-4.475,55.8087],[-4.4774,55.8096]]],"628":[[572,573,628,1039,1704,5697],[[-2.1223,52.8102],[-2.1146,52.6363],[-2.1132,52.6336],[-2.0667,52.6052],[-1.915,52.7567]]],"60":[[60,277,1123,1269,2994,4272,4273],[[-3.7304,50.4717],[-3.7275,50.4439],[-3.545,50.4876],[-3.4939,50.7014],[-3.5241,50.7064]]],"1331":[[1331,5479,5480],[[-0.2317,53.747],[0.1156,53.6604],[0.2528,53.6585]]],"3951":[[373,1930,3951,4163,4188,4903,5798],[[-2.9774,51.5476],[-2.9019,51.563],[-2.8447,51.5816],[-2.9687,51.5662]]],"543":[[538,543,730,1542,5112],[[-0.8655,53.0769],[-0.8217,53.0288],[-0.6292,52.9132],[-0.5883,52.9247]]],"5766":[[1062,1257,1258,2047,2654,5766],[[-3.1125,54.1907],[-2.7869,54.0661],[-2.6703,54.2977],[-2.7775,54.6663]]],"336":[[336,704,898,2711,3915,5323],[[-4.1717,51.0682],[-4.1369,51.0059],[-4.0543,51.0676],[-4.0629,51.0795],[-4.1148,51.1065]]],"2097":[[1211,1509,2041,2044,2097,2547],[[-4.4989,54.9534],[-4.0352,54.8608],[-4.1909,55.1637]]],"4637":[[464,465,1039,1704,3135,4637],[[-2.1064,52.794],[-1.9124,52.7537],[-2.0188,52.9449],[-2.0837,53.0407]]],"294":[[205,290,294,1837,2181,2971],[[-2.8113,53.2779],[-2.6649,53.3116],[-2.7555,53.3323]]],"324":[[324,607,1342,1741],[[-1.2131,51.3639],[-1.0774,51.3364],[-0.9623,51.4341],[-1.0024,51.4293]]],"2098":[[204,243,2098,2300],[[-2.9472,53.2675],[-2.9126,53.2157],[-2.8447,53.2051],[-2.8669,53.2304]]],"5185":[[699,701,703,1287,1322,4105,5185,5760],[[-4.9371,50.3754],[-4.7912,50.3551],[-4.3732,50.4179],[-4.4081,50.7941]]],"1287":[[703,704,1287,5185,5760],[[-4.8997,50.3949],[-4.8183,50.4235],[-4.1369,51.0059],[-4.4081,50.7941]]],"987":[[241,987,2103,4402,4408,4409],[[-1.268,52.9009],[-1.188,52.9239],[-1.1625,52.9318],[-1.1024,52.9651],[-1.189,52.9438]]],"378":[[378,1225,1602,5248,5356],[[-1.2378,54.6056],[-1.2372,54.6054],[-1.2025,54.6071],[-1.2011,54.6072],[-1.2086,54.6279]]],"760":[[359,398,760],[[-2.3542,51.3783],[-2.1699,51.3838],[-2.3388,51.3971]]],"2937":[[485,2005,2936,2937,5488],[[-3.0175,56.4811],[-2.9967,56.4618],[-2.9783,56.4632],[-2.9248,56.4752],[-2.9242,56.4757]]],"4754":[[295,712,713,4754,4755,5733],[[0.5185,51.716],[0.5369,51.6206],[0.5665,51.5938],[0.6588,51.7252],[0.576,51.8658]]],"1460":[[1460,3658,4716,5353],[[-1.5476,52.2846],[-1.5202,52.2536],[-1.4339,52.2278],[-1.433,52.2278]]],"1675":[[674,1111,1675,2045],[[-3.0362,55.9086],[-2.8018,55.433],[-2.7713,55.6104],[-2.8416,55.8048]]],"614":[[454,614,2184,3969,5747],[[-2.9775,53.7815],[-2.961,53.6435],[-2.7261,53.7011],[-2.7323,53.7571]]],"2042":[[1211,1509,1700,2040,2042,3215,5763],[[-4.1855,55.0992],[-4.0352,54.8608],[-3.2531,54.9941],[-3.0505,55.0326],[-3.285,55.066]]],"5369":[[254,1467,3141,3142,4109,5369,5399],[[-1.287,53.717],[-1.277,53.7198],[-1.2765,53.72],[-1.1564,53.7775],[-1.1575,53.7775],[-1.2843,53.723]]],"1864":[[197,204,243,1777,1864,1909,2855],[[-2.9635,53.334],[-2.96,53.266],[-2.9126,53.2157],[-2.8131,53.2771]]],"363":[[217,362,363,365,5668],[[-0.5897,51.722],[-0.4045,51.6426],[-0.3815,51.6713],[-0.4117,51.7963],[-0.4833,51.7737]]],"2746":[[648,660,1362,2746,5321],[[-3.5851,51.7415],[-3.3006,51.6358],[-3.5062,51.7292],[-3.5376,51.741]]],"703":[[703,704,898,1287,2135,5185,5323],[[-4.8183,50.4235],[-3.9139,50.796],[-4.1224,51.0457],[-4.1717,51.0682],[-4.7224,50.5353]]],"1070":[[1038,1070,1349,2048,2184,5747],[[-3.0296,53.8494],[-2.9799,53.781],[-2.7565,53.7448],[-2.9884,53.879],[-2.9899,53.8796]]],"728":[[341,350,642,727,728,729,1537,2972,2982,3812],[[-0.6381,52.904],[-0.2015,52.576],[0.1902,52.661],[0.3997,52.7578]]],"1189":[[914,1189,1196],[[-4.2601,55.8442],[-4.2038,55.8354],[-4.1972,55.8573]]],"730":[[543,730,731,1326,1542,4609],[[-0.6465,52.9377],[-0.6292,52.9132],[-0.2209,52.9314],[-0.0148,52.9663]]],"454":[[453,454,614,2184,2511,2854,3969,5747],[[-3.0431,53.5549],[-2.9488,53.491],[-2.7261,53.7011],[-2.7323,53.7571],[-2.9775,53.7815]]],"3236":[[648,922,1255,3236,4165,4742,5771],[[-3.489,51.5214],[-3.4024,51.3891],[-3.2694,51.563],[-3.3006,51.6358]]],"5551":[[1336,1582,1865,5549,5551],[[-0.9094,51.3858],[-0.7928,51.4093],[-0.7194,51.5183],[-0.8915,51.4368]]],"3798":[[240,649,971,3798],[[-1.8522,52.5069],[-1.8097,52.5098],[-1.7817,52.5262]]],"942":[[818,942,975,1897,3952,4233,4999],[[-2.8395,51.3406],[-2.5086,51.2908],[-2.6667,51.5407],[-2.745,51.489]]],"2306":[[2306,2459],[[0.0641,51.5209],[0.109,51.5176]]],"1607":[[670,1586,1607,1946,4034],[[-1.6052,55.0097],[-1.4822,55.0037],[-1.4785,55.0259],[-1.5,55.0237]]],"552":[[552,961,1992,3413,3646,5031],[[-4.1604,57.3361],[-4.0666,57.3011],[-3.7319,57.2536],[-3.316,57.416]]],"415":[[248,415,446,561,750,970],[[-0.249,51.9277],[-0.2232,51.9053],[0.1417,51.8783],[0.3605,51.9656]]],"5673":[[480,2234,5669,5673,5752,5774],[[-2.5706,51.4856],[-2.5653,51.4491],[-2.5129,51.5243],[-2.5658,51.5006]]],"688":[[288,671,688,774],[[1.0189,51.9166],[1.1636,52.0355],[1.0234,51.9373]]],"714":[[714,3201,4115],[[0.4724,51.7448],[0.537,51.7657],[0.5321,51.7643]]],"507":[[507,667,863,1219,2003,4777,5105,5219],[[-3.8484,57.5766],[-3.1335,57.4428],[-2.9485,57.5232],[-2.8133,57.6724],[-3.3212,57.6648]]],"5231":[[255,1206,1231,1728,5170,5231],[[-1.8227,53.6944],[-1.7727,53.6511],[-1.47,53.6743],[-1.6887,53.7322]]],"518":[[477,518,568,569,700,852,1670,1671,1739,1768],[[-0.8813,52.2294],[-0.4878,52.1443],[-0.6694,52.4913],[-0.6807,52.5095],[-0.7131,52.4853]]],"4477":[[381,416,771,978,1042,4221,4476,4477,5192],[[-2.5599,51.5474],[-2.4124,51.5527],[-2.273,51.7387],[-2.2662,51.8716]]],"933":[[743,930,933,1806,2155,3955],[[-3.7566,51.5672],[-3.7539,51.5629],[-3.7472,51.5579],[-3.6878,51.5361],[-3.5346,51.5002],[-3.5785,51.5182]]],"199":[[199,246,249,250,251,479,4989],[[-1.4872,50.9419],[-1.4435,50.8973],[-1.3743,50.8386],[-1.3568,50.8367],[-0.8814,51.2509]]],"1670":[[477,518,568,569,700,852,1670,1671,1739,1768],[[-0.8813,52.2294],[-0.4878,52.1443],[-0.6694,52.4913],[-0.6807,52.5095],[-0.7131,52.4853]]],"1399":[[1180,1399,1413,1541],[[-0.1515,53.5658],[-0.0808,53.5632],[-0.1287,53.5751]]],"1271":[[598,1271,3456],[[-1.5419,53.8139],[-1.4939,53.7785],[-1.5093,53.8017]]],"1931":[[82,105,1931,4468,4742,5713],[[-3.4033,51.3853],[-3.3098,51.4168],[-3.3893,51.3958],[-3.4024,51.3891],[-3.4031,51.3884]]],"4938":[[2428,4936,4938],[[-2.8405,53.3925],[-2.8295,53.3538],[-2.8282,53.3612]]],"869":[[868,869,1894],[[-1.2762,51.7503],[-1.2762,51.7497],[-1.2617,51.6271]]],"647":[[645,647,1847,1848,2906,3434,3443,4207,4484,5736,5772],[[-4.1323,51.6752],[-3.8982,51.6251],[-3.8221,51.625],[-3.824,51.6292],[-3.9534,51.6913],[-4.1293,51.6997]]],"1111":[[674,1111,1675,2045],[[-3.0362,55.9086],[-2.8018,55.433],[-2.7713,55.6104],[-2.8416,55.8048]]],"888":[[511,888,1308,5382],[[-1.5547,54.0011],[-1.4885,54.0313],[-1.2276,54.1575],[-1.5218,54.0749]]],"1998":[[905,1995,1996,1998,5217],[[-2.6282,56.7402],[-2.5569,56.7204],[-2.3019,56.9246],[-2.3799,57.2192],[-2.3815,57.2188]]],"514":[[513,514,4849],[[-1.0587,53.9593],[-1.0442,53.9491],[-1.0231,53.9568]]],"392":[[320,392,1128,1556,2092,5201,5202,5782],[[-1.7181,52.5246],[-1.7124,52.4519],[-1.7058,52.5161],[-1.7086,52.5278],[-1.712,52.5342],[-1.7162,52.5315]]],"1970":[[749,1970,2614,2616,2922],[[-4.2746,57.9499],[-3.8749,58.02],[-3.4343,58.2656],[-3.4237,58.4469],[-3.4517,58.479]]],"502":[[467,502,503,505,640,859],[[-3.4495,56.0896],[-3.3897,56.0422],[-3.1447,56.1456],[-3.3004,56.1643]]],"371":[[371,373,376,981,1930,4163,5684,5798],[[-3.0167,51.629],[-2.9774,51.5476],[-2.9717,51.5494],[-2.9143,51.5803]]],"1207":[[1090,1118,1119,1207],[[-1.9237,53.909],[-1.9058,53.8648],[-1.8676,53.8339],[-1.8887,53.8703]]],"1711":[[1365,1678,1711,2900,2980,3476,3481],[[-0.3538,50.8222],[-0.1411,50.8253],[-0.119,50.8474],[-0.2279,50.9748]]],"372":[[372,373,377,382,1572],[[-3.1454,51.4951],[-3.0992,51.5117],[-2.9687,51.5662],[-2.9894,51.5687],[-3.0048,51.567]]],"4756":[[1,606,671,774,4756],[[0.9307,51.8782],[1.2384,51.7298],[1.1794,51.8259],[1.0234,51.9373]]],"1211":[[1211,1509,2040,2041,2042,2097],[[-4.4989,54.9534],[-4.0352,54.8608],[-3.2296,55.0165],[-3.5911,55.0676],[-4.1741,55.1122]]],"1739":[[478,518,568,569,892,1670,1739],[[-1.1413,52.6225],[-1.0244,52.5372],[-0.614,52.3193],[-0.6694,52.4913],[-0.6807,52.5095]]],"544":[[544,546,2803,2992,5689],[[-4.8136,55.9368],[-4.7088,55.9159],[-4.4561,55.8828],[-4.4603,55.9038]]],"2547":[[1509,2044,2097,2547,3643],[[-4.1909,55.1637],[-4.1896,55.1432],[-4.1855,55.0992],[-4.0568,55.1288]]],"5353":[[1460,3658,4338,4716,5353],[[-1.5659,52.2858],[-1.5202,52.2536],[-1.4339,52.2278],[-1.433,52.2278],[-1.5476,52.2846]]],"465":[[464,465,1039,1752,4637,5776,5777],[[-2.2021,53.0506],[-2.1684,53.0129],[-1.915,52.7567],[-2.0188,52.9449],[-2.0837,53.0407],[-2.1768,53.08]]],"1903":[[399,1903,1957,2784],[[-6.6454,57.5544],[-6.5396,57.4326],[-5.936,57.248]]],"1308":[[511,888,1308,5382],[[-1.5547,54.0011],[-1.4885,54.0313],[-1.2276,54.1575],[-1.5218,54.0749]]],"717":[[715,717,718,1949,3457,5103,5650],[[-0.7499,53.5973],[-0.749,53.5968],[-0.5909,53.5673],[-0.5904,53.5675],[-0.5939,53.5966],[-0.6511,53.6026]]],"361":[[213,361,364,4443],[[-0.8825,51.7518],[-0.4973,51.5417],[-0.4992,51.6102]]],"3560":[[3560,4173,4176,4177,4180],[[-3.2172,51.5174],[-3.1814,51.4965],[-3.1617,51.518],[-3.1999,51.5261]]],"720":[[539,547,720,721],[[0.7417,51.3683],[0.7587,51.3794],[0.7522,51.4374],[0.7496,51.4367]]],"1792":[[260,1237,1238,1792,3522],[[-1.598,53.8063],[-1.584,53.7761],[-1.5838,53.7759],[-1.5898,53.8068]]],"5399":[[513,4109,4849,5369,5399],[[-1.2765,53.72],[-1.1564,53.7775],[-1.0231,53.9568],[-1.0442,53.9491]]],"5778":[[432,433,2687,5778],[[-1.5504,52.8556],[-1.4637,52.879],[-1.4006,52.9053],[-1.4613,52.8857]]],"5450":[[619,709,723,762,1030,5450],[[0.3803,51.4616],[0.3913,51.4602],[0.4551,51.5078],[0.485,51.5946],[0.3914,51.5656]]],"271":[[271,272,549,1032,1678,2980],[[-0.2348,50.9753],[-0.2246,50.8377],[-0.1577,50.9653],[-0.1314,51.1777],[-0.2177,51.2019]]],"3888":[[1703,3888,5742,5781],[[-2.5124,52.6321],[-2.4838,52.694],[-2.4802,52.71],[-2.489,52.7187]]],"1118":[[1043,1090,1118,1119,1207],[[-1.9237,53.909],[-1.9058,53.8648],[-1.866,53.8104],[-1.8676,53.8339],[-1.8887,53.8703]]],"1703":[[963,1703,3888,5781],[[-2.693,52.7093],[-2.4838,52.694],[-2.4802,52.71],[-2.489,52.7187]]],"4408":[[241,987,1534,2103,4408,4409],[[-1.2295,52.9155],[-1.188,52.9239],[-1.1625,52.9318],[-1.1024,52.9651],[-1.1734,52.9785]]],"559":[[193,391,557,559,560,571,5692],[[0.3299,51.4283],[0.4624,51.3144],[0.5337,51.2747],[0.5963,51.42]]],"5775":[[464,466,596,1752,5744,5775,5776,5777],[[-2.4845,53.1029],[-2.1676,52.9239],[-2.0837,53.0407],[-2.1768,53.08]]],"3311":[[1916,3311],[[-4.3747,57.3176],[-4.3233,57.2926]]],"2003":[[507,863,1219,2002,2003,4777,5105],[[-3.3212,57.6648],[-3.1335,57.4428],[-2.4985,57.664],[-2.8133,57.6724]]],"5701":[[1137,1138,1426,2063,3986,5701],[[-0.9614,53.325],[-0.3818,53.0002],[-0.5183,53.2286],[-0.8072,53.3604]]],"505":[[502,503,505,859],[[-3.4495,56.0896],[-3.3897,56.0422],[-3.2713,56.1112]]],"231":[[231,850,1882,2115,5107],[[-0.1933,51.4611],[-0.1882,51.4309],[-0.1349,51.4901],[-0.1824,51.4774]]],"845":[[845,1679,2109,5455],[[-3.5371,54.6773],[-3.5292,54.5034],[-3.4955,54.4249],[-3.5114,54.6494]]],"5321":[[651,1362,1651,2746,5321],[[-3.9502,51.7737],[-3.5062,51.7292],[-3.5376,51.741],[-3.7543,51.7628]]],"1979":[[431,1979,2931],[[-4.492,57.4677],[-4.2745,57.7083],[-4.2999,57.6989]]],"1159":[[283,1153,1159,1294,3054],[[-2.2088,51.0134],[-2.0326,50.7475],[-2.0211,50.7642],[-1.8435,51.082],[-2.0948,51.0615]]],"442":[[255,442,524,1728,1781,2060,2277,3456],[[-1.6534,53.6777],[-1.5192,53.5736],[-1.4326,53.6085],[-1.4939,53.7785]]],"813":[[291,554,708,813,3105,3108],[[0.4485,50.8813],[0.5905,50.8679],[0.8225,50.963],[0.7749,51.0327]]],"2467":[[393,394,602,1357,1757,2467],[[-0.2581,51.5451],[-0.258,51.5339],[-0.2242,51.5262],[-0.258,51.595]]],"328":[[318,328,606,712,713],[[0.5185,51.716],[0.6588,51.7252],[0.8866,51.8445],[0.9307,51.8782]]],"5767":[[400,1557,5767],[[-1.7024,54.6731],[-1.555,54.7058],[-1.5907,54.7995]]],"318":[[318,328,606,712,774],[[0.6588,51.7252],[0.8866,51.8445],[1.0189,51.9166],[0.9307,51.8782],[0.9024,51.8626]]],"206":[[206,242,244,633,634,639,5408,5790],[[-3.0777,53.2306],[-3.0532,53.0288],[-2.9314,53.2106],[-3.0349,53.2347]]],"5721":[[741,745,2673,5719,5720,5721,5751],[[-0.2395,51.7363],[0.1192,51.7074],[0.0665,51.7638],[0.0086,51.759]]],"2434":[[2429,2434,2469,5045,5046],[[-0.1891,51.4322],[-0.0968,51.4672],[-0.0481,51.486],[-0.0984,51.5072]]],"723":[[295,296,711,723,1030,4755,5450],[[0.3914,51.5656],[0.3935,51.4638],[0.7337,51.5707],[0.5556,51.6072],[0.485,51.5946]]],"1243":[[1243,2311,2731,5724,5799],[[-2.5176,53.5585],[-2.5121,53.5144],[-2.2992,53.5124],[-2.3581,53.5393]]],"297":[[265,269,297,369,386],[[0.131,52.2351],[0.1428,52.2037],[0.187,52.1886],[0.3126,52.2808]]],"413":[[401,413,430,662],[[-2.3052,52.1264],[-2.2055,52.1677],[-2.2423,52.3125]]],"377":[[372,373,377,382,1930,4163],[[-3.0992,51.5117],[-2.9717,51.5494],[-2.9671,51.5664],[-2.9894,51.5687],[-3.0048,51.567]]],"2092":[[320,392,448,1128,1556,2092,5201,5202,5782],[[-1.8141,52.5622],[-1.7124,52.4519],[-1.7058,52.5161],[-1.7086,52.5278],[-1.712,52.5342]]],"4143":[[144,815,2623,3363,4143],[[-4.357,51.8478],[-4.2898,51.7429],[-4.2282,51.6881],[-4.1825,51.7091],[-4.2018,51.9578]]],"5781":[[963,1703,3888,5742,5781],[[-2.693,52.7093],[-2.5124,52.6321],[-2.4838,52.694],[-2.4802,52.71],[-2.489,52.7187]]],"4731":[[402,3339,4731,5217],[[-2.3799,57.2192],[-2.1822,57.205],[-2.065,57.2158]]],"1269":[[60,277,1123,1269,1740,5761],[[-4.1123,50.3681],[-4.0124,50.3718],[-3.545,50.4876],[-3.6111,50.5726]]],"671":[[288,606,671,688,774,4756],[[0.9307,51.8782],[1.1794,51.8259],[1.1636,52.0355]]],"4443":[[211,212,213,361,364,4443,5279],[[-0.8825,51.7518],[-0.6172,51.5183],[-0.505,51.4802],[-0.4973,51.5417],[-0.4992,51.6102]]],"2459":[[2306,2459],[[0.0641,51.5209],[0.109,51.5176]]],"3486":[[510,1153,1154,1735,3054,3486],[[-2.0326,50.7475],[-1.9988,50.7168],[-1.9406,50.7556],[-1.8953,50.8468],[-2.0211,50.7642]]],"4486":[[1579,1580,4486,4667],[[-3.3609,51.7572],[-3.3368,51.7709],[-3.3376,51.771],[-3.3467,51.7701]]],"898":[[336,703,704,898,2135,5323],[[-4.4081,50.7941],[-3.9139,50.796],[-4.0543,51.0676],[-4.1717,51.0682]]],"5153":[[260,1112,1238,3522,4734,5153,5647],[[-1.598,53.8063],[-1.5838,53.7759],[-1.5379,53.733],[-1.5375,53.7328],[-1.4952,53.765]]],"4213":[[144,645,1171,3434,3443,4213],[[-4.1825,51.7091],[-4.1737,51.6773],[-4.1323,51.6752],[-3.9605,51.685]]],"1516":[[205,290,305,340,1388,1516,2067],[[-2.7162,53.3092],[-2.5498,53.2381],[-2.5685,53.3889],[-2.6242,53.3825],[-2.6888,53.3702]]],"3915":[[336,2711,3915,5323],[[-4.1224,51.0457],[-4.0543,51.0676],[-4.0629,51.0795],[-4.1148,51.1065]]],"4342":[[152,657,4342],[[-3.167,51.7001],[-3.1593,51.6745],[-3.1578,51.6745]]],"2055":[[1144,1180,1361,1541,2055,3942],[[-0.1922,53.6153],[-0.1696,53.4787],[-0.1287,53.5751],[-0.1462,53.6014],[-0.1777,53.6164]]],"3646":[[552,1992,3413,3646,4777],[[-4.0666,57.3011],[-3.7319,57.2536],[-3.1335,57.4428],[-3.316,57.416]]],"1592":[[602,1592,2465,3404],[[-0.2251,51.5152],[-0.2217,51.4906],[-0.2242,51.5262]]],"554":[[554,708,813,3108],[[0.6007,50.8773],[0.8225,50.963],[0.7749,51.0327]]],"2429":[[303,2424,2425,2429,2434,2469,5046],[[-0.1704,51.5275],[-0.0968,51.4672],[-0.0481,51.486],[-0.0958,51.5304]]],"1996":[[905,1995,1996,1998],[[-2.6282,56.7402],[-2.5569,56.7204],[-2.3019,56.9246],[-2.3815,57.2188]]],"3089":[[273,274,549,781,2101,2980,3089,5580],[[-0.3213,51.0632],[-0.3185,50.8932],[-0.2279,50.9748],[-0.1632,51.1148],[-0.1627,51.1174],[-0.1688,51.1354]]],"1542":[[543,730,1542,4609,5112],[[-0.8217,53.0288],[-0.6292,52.9132],[-0.2232,52.937]]],"2166":[[205,1837,1909,2166,2873],[[-2.877,53.2801],[-2.835,53.2685],[-2.7162,53.3092]]]},"cageNote":"cages for the 600 best-connected stations; others by BFS in the page","ringsKm":[5,10,20],"labelTiers":{"nation":{"fontPx":10,"mpp":1800.0,"shown":[635,5762,350,477,5760,459,639,1043,549,379,704,5788,479,5732,431,5779,5766,5221,1055,495,3228,843,2922,2614,1034,417,1609,1986,991,2994,814,1998,847,2676,1071,5053,5086,4652,4534,3326,3265,4425,3865,3859,3874]},"region":{"fontPx":10,"mpp":600.0,"shown":[635,5762,350,306,477,5760,459,639,1043,432,549,204,2048,393,188,379,388,648,246,704,1326,510,539,5439,1182,5788,535,479,5719,315,5732,5741,586,431,265,513,566,277,1039,5779,770,291,5766,5767,1817,4177,5795,1219,694,501,5186,5763,5221,3441,674,1055,2338,3315,2747,5733,1200,268,747,5654,1965,495,1177,5203,1068,1893,5739,5079,1860,396,1726,1461,5218,2049,3228,2875,5222,843,3413,2931,2922,640,5713,2614,2612,1725,2069,5748,1034,2022,1656,1098,5309,5207,1609,1133,953,1097,2305,5516,5441,815,2093,919,852,1153,5455,1986,273,991,404,814,1992,1563,2016,2784,1287,703,1111,1207,1211,465,1308,2003,813,1996,847,1083,5737,1027,2041,2044,399,1978,3635,1938,1959,1348,2577,5735,796,1627,1679,1194,517,1071,1915,1361,1957,358,224,1061,4020,1060,3989,321,3780,978,631,252,1867,1923,1969,5769,2199,3902,410,1305,4445,5738,2853,553,1781,1616,1472,1078,497,3977,1066,4652,171,1871,2804,3384,4941,2209,3342,3756,5094,2405,4720,5391,2769,4726,3262,4327,4848,3592,4924,3170,4389,3865,3211,3919,3859,2143,4244,93,775,4087,2944,4680,3911,2786,4305,3874,1418,2816,1888,2624]},"town":{"fontPx":11,"mpp":120.0,"shown":[635,5762,350,306,477,5760,459,639,585,1043,432,549,204,2048,5747,393,2729,205,5780,188,379,388,648,246,704,208,1326,463,464,510,539,5439,5799,5736,193,1182,5788,535,479,1897,5719,295,315,5732,489,472,5741,657,586,431,265,513,1224,917,519,652,566,1180,619,578,1846,277,1039,212,5779,770,194,201,446,291,248,4999,2972,230,3951,5766,324,392,361,5767,1817,4177,5795,1219,694,501,334,5186,5763,5221,546,3441,674,1055,2535,2338,4115,5045,2204,1803,3315,963,2747,330,5733,1200,5742,844,268,747,5790,187,5757,5654,1965,495,1177,4198,5653,5203,1808,1065,1068,1893,2973,1850,3378,5739,5079,1860,530,5216,2674,830,198,5428,5138,396,234,1726,5444,5247,3792,654,581,2057,663,525,2423,5009,1461,2970,3504,773,527,5218,4131,710,2049,705,864,1035,1809,333,856,2610,5700,2062,540,261,3228,2875,3529,5222,1044,496,1804,5484,3235,2215,577,286,381,408,1206,260,5730,662,575,843,3413,670,1480,210,2931,914,3233,2922,640,301,572,5713,2614,933,502,3311,930,281,2612,3528,2182,5480,2795,5135,223,455,1725,2069,1146,5765,5264,2037,2053,5748,1034,1391,189,1051,962,941,744,1639,2022,1656,681,605,1185,1291,1218,1098,3230,1816,5179,2615,5309,417,1366,1566,2137,3451,5207,1286,506,202,2025,1053,1609,824,1057,1017,2538,1097,429,936,1994,3470,2611,2131,3730,313,357,209,1716,1610,1307,1797,1799,2305,1217,3234,5516,5441,5442,2977,370,815,1178,1900,241,699,440,236,892,2093,255,5454,320,433,5774,919,5052,1259,1835,1678,622,4734,2000,852,5744,269,466,5776,5752,453,322,569,1153,5455,5761,1651,310,1986,727,1688,1161,2924,2115,1827,557,2015,273,1154,380,623,468,467,5692,1144,1042,1509,991,1138,774,576,430,731,5447,541,718,1975,5751,2616,404,713,5755,3107,283,1374,2994,814,661,5759,478,366,4165,1753,4109,3338,1992,1660,2004,1563,667,5777,470,702,1434,2016,2784,362,1571,2248,749,628,543,336,294,2098,1287,1460,1675,2042,363,703,1070,454,552,688,507,518,199,1670,647,1111,1998,1970,1207,4756,1211,544,2547,5353,465,1903,1308,5778,271,1118,559,2003,813,328,297,413,1269,554,1996,847,1534,524,1322,1935,2802,983,2020,1183,1659,594,504,607,2410,1083,200,973,5737,1742,1537,1027,5794,2781,3694,2021,1695,579,4859,2041,5457,2134,2044,695,399,1388,606,2210,1426,3986,3812,630,666,2711,935,2594,2043,1978,1741,2135,5010,1946,3635,1938,1101,3645,511,351,3527,784,521,1959,1914,2519,1348,2252,629,2096,5448,734,1557,2560,1993,2577,5735,701,221,1062,423,332,570,1024,364,796,2669,1627,1430,1824,2993,1164,3201,750,1054,4657,2731,551,975,2250,1276,1316,1252,3652,1679,1096,1063,2704,698,1335,859,5479,781,517,1071,1997,312,1915,885,2019,2034,1361,2428,2214,1957,1663,1980,1995,288,484,272,961,2783,2023,700,358,981,1340,1984,2904,970,1208,1908,2419,1962,5458,992,264,5053,1700,5753,800,2324,2002,868,1205,2223,2992,560,636,3381,1929,2045,1061,736,512,529,229,1244,4020,582,211,1721,1060,711,3989,3314,1692,1025,1873,3437,1941,1468,1163,2035,1767,5547,555,631,252,253,5734,509,4153,2983,1727,1867,401,534,244,3641,561,1923,2101,3600,638,685,1969,1168,3601,5769,3546,2,1401,1370,2684,5462,742,195,3626,2001,3238,2199,3179,520,2633,1262,4870,3525,2736,834,289,3902,428,403,854,2940,3553,4971,1420,3681,410,855,1129,849,3024,1999,2960,4893,1956,487,1524,1300,1466,1310,2709,4415,1305,1662,4445,5680,908,3037,2898,1920,1773,1624,2703,1312,5178,4871,4059,3313,617,2710,5487,817,807,5704,2853,267,1377,1087,532,1705,589,3526,1787,553,3229,462,567,1623,368,1643,1023,782,1982,1781,860,5086,1715,3550,3947,5307,1470,3554,3520,1179,3639,1616,1514,1603,1082,1782,3768,1502,3343,2638,3627,1311,1520,3638,1519,488,1086,1647,1535,3720,2969,1689,438,4340,1078,1484,1693,4490,2269,3444,1250,1511,3999,4016,1201,4220,1503,1309,497,1707,3281,1473,1403,902,3977,3376,1088,2066,1709,1642,3439,1604,1510,2397,5017,1106,707,1578,1559,3485,1066,3537,5543,5588,5213,5568,5575,5567,5506,5535,1574,5596,5597,5537,5605,4652,5380,2150,3763,5443,171,2211,1871,144,152,1090,1299,3027,60,4637,5185,4443,2618,2109,3670,3183,4233,1748,5392,1147,1398,2658,3384,4920,3741,4708,1760,4941,1769,5230,4042,108,15,1910,2481,3144,4379,1546,71,2243,2613,2189,5342,2930,3491,4534,4821,128,2292,945,4706,1833,3342,1421,3299,5731,5088,2695,3914,2593,2768,3756,3468,1532,3326,4466,5094,3386,2780,1628,1842,4453,1260,5702,3426,5150,3184,1452,4948,2405,4440,2789,4888,1409,2645,63,494,4134,4513,4720,4586,3631,2879,895,1410,833,5391,4973,4818,124,5706,4496,3067,2582,2313,123,4897,4798,1964,4783,3633,3903,4304,92,1100,101,641,2170,4324,1812,1755,4107,1387,2769,3304,4559,4464,3900,2485,4996,2592,3084,2751,3543,2757,1371,2727,3418,4723,4481,5242,3282,4301,2392,3533,4726,2888,3015,1099,925,1554,1652,3265,2178,2884,4451,5658,4516,2407,3301,2622,1517,4715,2808,32,3018,3262,3922,993,100,2226,5142,1507,2144,2690,49,3510,766,2353,974,5125,4315,2386,4607,2489,3591,5644,1581,2254,4049,3288,3331,3371,829,1538,2172,4327,3825,2222,2573,4728,4929,1813,3109,1381,4785,4574,812,4891,4425,298,3166,3828,4549,4922,2849,1395,4924,3465,2373,2191,2655,958,155,43,3860,1026,5703,4792,3428,4540,5493,899,4805,4950,1175,5360,4299,1765,2100,3912,765,3170,3852,3654,4787,3572,4029,2294,988,3735,1172,959,1831,5161,4688,1203,787,4717,4561,2725,2404,4319,2764,5302,2119,4164,4861,4547,3898,1110,5164,146,2123,2821,3175,3916,4803,2054,997,3492,2245,4873,3291,5147,3865,4032,1932,2487,3856,41,2561,3747,3052,5155,456,4860,4284,3285,2378,4355,4112,4318,3203,3764,4223,4356,1150,2732,1724,2881,486,2011,3573,5656,3685,1301,2989,1751,2500,4021,3506,3571,3021,2882,3096,2856,2479,179,4382,1719,3919,3090,565,2621,2572,2494,1684,4370,757,4604,5119,2216,2831,2715,4691,1288,1315,3348,3770,2735,4565,2833,3321,2381,2290,2871,1455,3181,2388,904,4419,1562,176,3556,14,3239,115,931,4932,2859,3283,4608,2200,894,97,2712,3110,2641,3302,4815,3788,4710,3881,5723,412,3083,1264,4312,4562,3742,78,1443,122,5159,1047,1141,3213,3500,5397,2406,150,3014,2272,1033,1214,3210,1272,4855,1508,2008,3187,2082,284,3532,2848,1103,3017,2926,2095,4928,3072,4566,1108,2636,3859,2965,957,2740,4757,2087,184,4913,3117,1296,2583,4847,4046,3064,2414,3306,4529,3242,4819,3357,1379,3066,4460,5175,2921,3364,2588,2665,1919,2860,3346,2749,2143,3068,3467,1820,4840,343,3460,3698,3120,2946,4795,3114,876,2122,5395,3093,3634,5193,1417,3185,4781,4244,1886,1590,4736,2734,2985,2523,4226,311,4878,1372,13,3430,4114,2899,3921,64,4132,3289,385,1438,4030,2949,4083,3225,4087,4050,5139,1922,2944,4680,2771,3269,4730,4067,4914,4108,4417,2786,2976,1236,4313,4591,3896,1764,2473,4054,3124,1283,4942,2837,3760,2698,4320,5174,2852,3956,2823,2497,2817,4709,903,1289,3172,3874,5687,2634,4790,1536,3424,4944,2809,4769,2333,1282,1233,3743,1418,2816,1170,4511,3309,2657,3615,2865,1888,4595,2624,972,3080,5143,3028,3077,4916,3422,1565]},"station":{"fontPx":12,"mpp":30.0,"shown":[635,5762,350,306,477,5760,459,639,585,1043,432,549,204,2048,5747,393,2729,205,5780,303,188,379,388,648,246,704,208,1326,463,464,510,539,5439,5799,5736,193,1182,5788,535,479,1897,5719,295,315,5732,489,472,5741,657,586,2971,431,265,513,1224,917,5248,519,652,566,1180,619,578,1846,277,1039,212,5779,770,194,201,446,291,2425,248,4999,2972,230,3951,5766,324,392,361,5767,1817,4177,5795,1219,694,501,334,5186,5763,5221,1045,546,5249,3441,674,590,1055,751,2535,2338,4115,5045,319,3421,2204,1803,2857,3315,1608,963,2747,330,5733,1200,5742,844,268,747,5790,187,5757,5654,1965,495,1177,4198,5653,5203,1808,1065,1068,1893,500,3046,2973,1850,3378,5739,5079,1860,530,5216,2674,830,198,5428,5138,396,234,1726,5444,5247,3792,5101,654,581,375,2057,663,679,5239,525,2423,5009,1461,2970,3504,2682,773,527,5218,4131,4166,710,2049,705,864,1035,1809,333,5040,856,5635,2610,5700,4125,2062,588,235,5636,2675,540,261,3228,759,2875,3529,5222,1044,5746,3979,3518,496,1804,5484,3235,725,1587,2215,240,577,286,381,408,1206,260,5730,662,863,1572,575,843,3413,670,1480,210,2931,914,3233,2922,640,217,301,572,5713,1195,262,2614,933,502,3311,930,281,1011,2612,3528,2182,5480,2795,237,5135,223,455,1725,2069,1146,5765,620,5264,913,2037,2053,5748,1034,1391,189,1849,1051,962,883,941,222,744,1639,2022,1656,681,605,1185,1291,1218,1098,3230,1816,5179,2615,5309,417,279,1366,1566,3367,2137,2036,3451,738,5207,1286,506,202,2025,1053,1609,1133,953,693,1216,1611,824,1057,5104,1017,2538,1097,429,203,1934,936,1994,786,445,5672,3470,2018,2611,739,2131,1605,5727,592,316,3730,313,357,209,1007,1716,1610,828,1220,531,1132,1307,1797,2029,912,1799,2305,1591,1217,3234,5516,5515,5441,5442,2977,370,815,1178,1900,241,598,699,440,236,892,4221,2093,255,3797,2040,5454,320,433,1128,5774,715,919,391,5052,1259,1835,1678,900,4476,439,622,4734,2000,420,852,1837,5744,269,466,5776,5752,453,322,2005,547,1728,569,457,1238,1153,1889,5455,2936,1176,1481,493,5761,615,1651,1620,310,1986,1156,727,1688,278,1161,2924,2115,1827,557,2015,1768,5208,273,1154,380,2220,623,468,1752,735,467,1144,2103,1042,2155,1140,304,416,485,1509,991,1710,583,395,1138,774,576,430,731,5447,476,642,541,718,818,1975,5751,339,2616,645,404,713,3955,5755,708,340,503,331,2530,3107,283,2994,814,434,305,661,1393,964,3404,5759,478,865,366,4165,1753,4109,3338,1992,1660,1048,2004,1563,667,5777,712,669,470,702,422,1362,1434,2016,2081,402,2784,362,374,1571,798,2248,749,628,543,336,2097,294,2098,1287,1460,1675,614,2042,363,2746,703,1070,728,1189,730,454,3236,942,1607,552,688,507,518,199,1670,1271,1931,647,1111,1998,1970,1207,372,4756,1211,544,2547,5353,465,1903,1308,3560,720,5778,271,3888,1118,1703,559,5775,2003,1979,813,2467,328,2434,723,297,413,1269,898,1516,554,2429,1996,2166,1067,847,1255,1534,524,1322,1740,4959,2072,651,1278,729,1935,2802,627,983,5352,2020,3146,1183,1885,2068,1659,1704,594,504,1454,607,2027,3594,1030,2410,1083,200,743,659,649,973,365,1405,1825,660,5737,1742,1537,1027,1671,5794,2781,3694,2021,1695,579,243,4188,4859,2041,5457,2534,1280,250,2134,2044,382,5783,695,399,922,1388,606,2210,1190,1747,1426,1181,3986,3812,1757,630,666,977,2711,935,2571,2594,2043,1978,1741,2135,3214,5010,1946,3635,1938,1101,3645,511,351,3527,784,3202,521,2465,5031,1959,650,1914,785,1694,2519,1348,259,3605,2252,629,2807,2096,5448,596,347,734,939,1557,2560,1993,2577,5735,701,1580,221,1062,423,332,570,1024,364,796,2669,292,4936,1187,1431,2475,548,1627,1040,1430,1824,5370,3978,2448,584,653,2993,1851,1164,3201,1625,750,1263,1054,452,2731,2493,2975,551,2991,975,2250,4260,2854,1732,1276,1316,398,3535,1252,226,3652,1579,4974,2394,1679,1433,233,1096,4228,2283,646,676,709,1221,1063,2704,220,698,1335,376,3723,859,1130,568,5479,781,1696,4088,1194,850,517,2277,1071,1997,312,1915,885,2019,1496,1723,741,1936,2034,1123,1361,2428,302,2214,1957,2464,475,1663,1980,1995,288,484,272,1413,1777,961,2783,2023,2748,443,789,4722,700,4242,358,2873,2951,981,2300,1340,1984,224,2904,970,1208,196,1908,2419,1962,5458,686,992,2080,982,264,3642,5053,1700,359,5753,800,2324,3108,1229,2002,868,1365,1205,937,2223,2992,571,3013,560,1619,771,636,296,300,3381,1929,2045,1436,1061,1928,736,341,1142,3153,512,448,3339,529,229,1244,2502,4020,3445,582,211,1721,3643,1060,711,3989,3314,1353,5642,1692,1025,2332,5646,321,2059,2900,1225,3780,1873,3437,1941,3536,3252,1468,1163,978,2035,1767,555,3105,1882,2297,631,252,2801,1545,3408,299,1457,253,5734,509,4153,400,2983,1727,1032,3607,1867,401,2796,3476,879,534,244,3641,1686,561,1202,270,1923,2101,4218,1586,1231,726,3600,207,638,4043,2017,685,1969,591,287,1731,1168,2861,285,745,3601,4868,5769,275,3546,2,1401,1370,2662,2684,5462,742,195,3626,2001,4875,3238,2199,3179,520,2633,1262,3365,4870,3525,1881,2213,658,2736,834,2237,2631,1598,3987,289,2779,3902,2916,5057,428,761,276,403,2730,3312,4697,854,2940,3553,4971,1420,1242,2660,3689,3681,410,855,1129,5461,849,3024,192,1999,2960,4893,2169,1956,487,1524,1300,4894,1466,1310,550,2709,4415,1135,1305,1662,593,4445,2661,5680,5287,5758,2584,1143,461,2938,908,3037,680,5743,2898,1383,1920,1773,1624,2703,3971,1312,2412,3436,947,5178,1667,769,3972,2724,4871,1382,4059,3313,617,2710,5487,1822,3531,817,5749,1855,807,5738,2415,5704,2853,267,1377,2579,1087,5190,2076,532,1705,589,3526,1787,553,3229,353,1134,462,567,1645,1623,3472,2417,368,1643,1023,782,3122,1982,3129,1682,1781,526,1592,2503,860,5107,5086,5044,1715,1856,2379,3550,4475,2694,2520,2453,3947,3640,5307,2190,995,1470,3554,2452,3520,2537,5312,1179,3639,1680,1616,1514,1603,1588,1617,5108,1082,2403,1782,1654,1952,1028,3768,841,5091,1502,1094,5483,3343,2638,2275,1245,1634,1708,1596,1951,3627,5311,3998,5308,1311,1213,1520,3638,1519,753,488,3587,1086,1647,2745,5110,1535,3452,2295,3720,2969,1241,2968,2239,1613,2999,5310,1689,3241,533,438,4340,3871,5227,1078,1658,5087,1523,1500,3541,1484,1561,2393,1626,2377,1693,2433,4490,4500,2269,3444,1250,1511,3999,4016,1488,1911,1201,4220,1503,1309,1644,497,1650,1601,1501,1973,2480,1707,3281,2399,1614,1234,1473,1702,3350,1403,902,3977,4949,1314,3330,3376,1498,1235,2986,1192,1376,1475,4015,1088,2066,2366,2201,1709,1474,2874,3463,1642,2322,3439,4487,3440,1604,1925,1510,2397,1492,5017,4219,1653,1533,1106,707,2323,2120,1323,2396,545,1471,3551,1698,891,1578,2086,4168,1559,3485,1066,1344,5624,5551,5021,5549,1329,5472,2365,458,5474,3537,1360,5619,5583,5501,5587,5553,5588,5564,5184,5513,5213,5610,5613,5568,5550,5571,5478,5575,425,191,1317,2422,5567,5542,1712,4037,5115,5518,5544,5599,5603,5506,5617,5535,1772,5529,795,5505,5055,3894,4421,5591,4767,1574,450,5596,5565,5597,3555,5598,5528,5584,3415,5469,5545,5508,5537,5623,5615,3322,5517,5606,1729,5609,5566,5618,5590,5592,5530,5595,5541,2402,5578,5616,2997,5502,808,2590,5536,5499,5524,5534,5016,5594,4904,2880,5538,5473,5570,5563,5614,5602,5525,4970,3011,4652,5380,5640,5385,5641,2150,3763,5443,5482,171,2211,1871,4609,144,4409,3434,4386,3423,1119,2687,2623,4957,152,1090,4538,2511,4273,483,4519,1884,4418,1299,1912,116,1666,3027,3719,60,1331,4637,5185,760,1864,4477,4938,1739,4408,442,318,4143,5781,4731,671,4443,5153,3915,3089,1542,148,1955,4631,2618,2109,3670,2906,4849,4488,82,3389,3183,1396,1541,5421,4272,4543,1916,4979,1748,5392,4402,2162,1147,5580,3163,1398,4589,2804,5333,386,5170,5381,5387,2658,4322,2336,3384,4396,4205,4133,33,4920,2558,2107,4403,2606,3741,4708,3666,1760,4941,1769,5230,4602,4042,2670,4953,4568,108,1064,256,15,4000,2644,1910,2955,5366,2481,5398,3144,58,4379,1546,71,2243,2613,2189,1424,3923,4465,3512,5180,4344,4843,5342,4077,2930,3491,168,4534,4821,4203,128,2292,1878,945,4748,4706,1833,4809,2545,154,3342,1421,4111,4594,3390,2914,3299,5731,18,5338,3455,5088,2695,5412,3914,1761,2593,2768,3756,3468,125,4867,360,2127,118,2227,2341,1532,2678,2923,3326,4466,5094,4573,3417,3386,2780,1628,4246,1842,2869,2287,664,4453,4532,1260,4351,5702,3293,2643,3426,5150,2409,4264,3100,3540,3184,1452,4948,1821,1199,3711,2405,3394,5288,4461,5157,4440,4497,4539,4026,2789,3672,151,3180,346,4325,4888,1409,2645,63,23,494,4134,4513,889,4720,4586,3040,3631,2879,895,4316,482,5089,4659,1410,833,4136,920,5389,4309,5391,4973,5343,4852,4818,411,2024,3303,124,5706,4496,3067,2582,2313,123,76,1354,4897,4636,2198,4193,3505,4798,1964,3473,1521,4783,3903,4304,4851,3848,1852,3427,92,1100,2279,4002,101,2170,2984,3091,4890,4324,2281,1812,1755,4778,4191,3278,4107,2375,4579,4337,1387,4152,2769,3304,1327,3975,4559,967,2142,4377,611,960,4617,3593,4841,4464,2084,2485,3347,4996,2592,4583,355,1279,5123,5204,3084,4625,8,2751,156,5232,4597,4668,3543,47,779,1149,1371,5418,2727,3418,4723,1458,4481,2758,5242,3282,2321,4301,4035,2392,5523,5405,4605,4629,3707,3533,5144,3597,4726,1780,4581,5146,2888,3015,3630,1099,3162,925,2133,2085,4525,4064,1554,1652,3507,5402,2151,4237,3968,3906,2202,3393,3265,4620,2178,3964,3475,2884,4451,5658,4257,4516,5388,2407,4707,682,916,3301,20,2622,1517,4715,2808,5011,4259,32,2649,3425,3018,5674,3262,3922,427,993,100,2750,2226,4899,4126,3099,5142,1507,938,167,3679,5214,3419,4571,5532,4209,2144,4853,4522,3191,2690,49,3510,2909,4611,4616,766,2353,121,974,2797,3070,4393,2707,5756,2411,4640,3508,3429,4333,170,5125,4394,4315,3328,2386,4607,2489,3591,5644,1581,832,3045,4492,5093,3392,2254,2436,3498,4049,901,5056,3288,3708,4553,3331,3371,4128,4179,829,1538,2172,4327,4876,3821,3825,4831,5791,1791,3683,3332,4354,2222,4749,2573,2228,4310,1917,4366,1564,4372,4501,4321,5251,4728,4929,4848,562,2413,3433,1813,3109,133,5432,1381,3074,1151,4785,2903,1733,2723,4788,4826,3118,4574,812,4891,4679,3905,1407,2640,3592,4074,3767,3963,3622,4425,1004,298,4885,2659,3166,4276,1254,3828,4549,4759,4922,53,2668,471,2555,3069,345,5006,932,3619,498,2849,140,3819,85,3385,1395,2078,4907,4924,3465,2373,4799,3092,2688,2191,2655,958,155,43,3860,1026,5703,1167,4792,3428,4540,5493,899,1448,4399,4805,131,1333,3970,4950,3775,3116,4161,1127,4902,3901,1175,5360,4299,1765,2100,3912,765,3789,886,4248,3170,3852,3759,3654,4787,3572,4588,4029,2294,12,988,5176,3735,2739,1188,177,4634,4635,5426,1172,3030,959,2939,1831,1858,5161,4688,4615,3854,4563,3933,3294,4779,2788,2260,1203,3488,25,2738,3664,787,4623,1324,4561,5063,3808,2725,3795,2741,4192,3204,3965,4622,4463,4185,3790,2404,2686,4319,3684,861,1014,4908,4887,2793,4252,2764,3950,5302,2119,4508,4823,4164,612,880,656,4933,4861,4547,929,3112,2259,3123,3898,4262,1110,5164,3286,1555,146,2123,2821,4389,3175,4651,3916,4053,4803,4412,896,2273,354,3637,4813,4311,2054,163,2647,997,5793,3492,2245,4678,4873,2299,4610,2996,4546,3606,1437,3291,5147,4212,3012,3865,66,4032,1932,5344,2487,4829,1453,21,4343,3856,4287,41,1518,2561,4812,4523,4541,3747,918,3261,1815,3052,4930,5155,456,4827,426,4860,4284,3285,2378,4355,4112,3953,3489,5643,4646,1595,792,2767,4318,1415,3203,3207,4811,4346,3764,4223,2167,2224,4577,3277,5317,3800,2104,4647,4356,4380,2887,1150,2564,4036,2732,4531,1724,2881,3620,3661,54,4832,4367,486,3161,4375,3379,4216,2011,4363,2755,1029,3573,5656,3685,3344,2510,1301,4537,4618,4943,1001,2989,1751,3010,2500,3762,5351,4752,4021,1539,1947,3143,3650,59,3506,772,3211,4850,4814,3008,3571,3474,3496,3021,4323,4740,4347,2882,3602,3096,2856,3616,1117,3300,4830,2390,2479,179,4382,1719,2106,149,3919,3029,4102,1547,4293,3090,565,3366,2621,2892,2572,1844,1002,4455,2897,2494,5189,3663,2791,342,104,2877,1684,159,3895,4503,4370,737,89,4454,4604,3590,3773,5119,4810,3545,3048,2216,4627,2831,4911,2395,4557,2629,3176,2715,5433,4626,4040,4691,30,4261,1906,2883,1288,4762,4391,1091,2257,3787,3065,1315,4750,1352,5334,4450,3348,3770,390,3102,1790,4332,162,3071,73,2735,4215,5705,4857,3777,3738,4565,2833,481,4427,3321,4247,2941,4842,3909,2381,2290,3448,4856,3079,2871,1455,3181,3274,3387,2388,2472,2307,5320,904,4419,1562,2327,4780,176,3556,5252,4502,14,3239,4330,1302,5377,115,931,4932,5345,4045,3945,5194,4518,2859,1191,3688,3041,3604,1953,2846,3283,4608,952,29,3782,4274,1332,4544,1186,1784,4234,794,2200,894,3088,3119,1531,4357,4009,3270,4014,4268,2907,613,74,97,4517,3740,4297,2712,3466,2284,5675,3110,1020,4047,2641,3302,4535,4186,4675,2286,1222,4385,4919,5521,4815,3996,3788,4542,4710,3327,3483,3881,4880,4383,1801,3177,5723,412,2893,3083,1264,3700,4312,3168,3742,4175,3356,19,78,1443,5305,4666,122,2006,5159,4507,1047,2642,2714,1141,3213,1397,3500,1445,2896,5397,5109,2406,1921,5359,150,4596,4414,4104,3014,2272,4670,4551,1033,4921,1214,5181,877,4269,3210,3115,4364,5004,1272,4630,4991,1476,4512,5371,4314,75,4855,1508,4239,2008,4998,3632,5354,2161,3932,1664,3940,3709,1009,3187,3164,1093,3849,2626,5634,3948,284,3785,4898,5726,893,1275,3310,4677,130,5404,2384,3532,4951,5386,4493,38,4764,4423,3276,4181,2848,1103,809,3985,3017,1003,2868,4592,696,2926,4197,4413,2095,2726,4928,3279,2652,3072,3208,3224,55,3613,4566,1108,4202,5336,2636,3859,2470,2965,957,1462,3823,2462,1853,3791,4648,946,2740,4141,98,1240,4478,4757,689,2087,2463,4801,3611,2203,184,3442,3022,4836,4913,46,3117,2225,1296,2544,2152,2165,4195,5304,2583,4847,5696,3621,3636,2964,2130,4046,4334,5234,2164,2126,2118,3064,4865,4201,2414,4350,3306,3717,1378,4529,2812,4430,5332,4329,2149,3242,3377,4819,4072,3357,1379,1115,3066,491,4601,3245,2927,4024,4460,2935,4923,4073,31,4182,3612,4504,39,5175,2921,5659,3364,2588,2665,1919,3793,3319,2197,4758,4308,4229,2860,4994,4123,69,4846,1766,3257,5657,5707,3346,2749,2517,2143,3068,2235,3467,1120,3925,3927,1820,4467,4840,2288,343,4926,4789,137,5717,2474,3961,4187,4390,5084,3460,3698,3120,4582,3725,3354,4266,2946,1629,2342,1105,4545,4593,3113,1573,2683,4238,3487,4628,3043,4795,3125,3850,4254,3114,2051,2595,4148,3599,3188,2902,876,3618,1346,2942,77,4733,625,3244,4174,3542,4361,4151,5209,2122,1248,5395,4381,3093,3634,2966,5193,4275,1417,3185,4781,3373,4807,2832,4995,4244,1886,1590,5151,1104,4736,2734,1166,2985,5349,4993,4001,4365,86,22,4129,2523,4226,311,4023,3372,1247,4456,4972,2335,3447,3126,4520,3660,1796,755,3361,1447,1372,70,4793,129,4306,4844,13,3430,4114,4349,1422,1746,3697,93,4240,2899,3921,2471,64,909,2872,5171,2910,887,4132,4438,1600,2140,1249,3931,3289,775,4243,385,4569,4183,1438,4030,2361,4055,81,1669,2949,4401,4083,3513,3225,4087,4200,1423,4050,3042,2304,1838,1674,4613,4368,4510,5350,3774,5789,1319,4530,5139,1273,4639,5715,5337,1922,3388,4800,2317,2944,4680,2496,5394,3095,4576,65,5393,2689,2771,3047,3714,3519,4263,2310,4480,3269,4705,4575,2099,5173,4730,5379,1585,2253,4524,3307,4837,3308,4526,4067,4914,4108,3911,4417,1343,3739,4005,2637,2786,2976,5316,1236,2132,44,2309,5037,5396,119,3268,2697,3063,4955,4008,4313,4796,4591,1687,5340,112,4326,3896,2889,3087,1764,2473,4054,2920,3124,4387,1283,4305,4942,2837,3760,3295,4806,2591,4127,2698,4267,1122,5162,4828,1227,4320,1416,4,3944,4044,3577,690,1655,2632,4515,2263,3603,147,5174,2852,3924,2370,5124,4614,3956,4135,2823,4612,4863,2708,5163,2497,3595,1041,4150,2817,4895,4113,4190,1019,4709,903,5648,4331,1289,5315,4521,5076,3172,3874,4031,4426,2805,4098,5687,2634,5197,4353,2700,4196,1469,3432,4790,2391,5095,5314,4062,2945,4514,4934,2962,2303,1536,3296,3424,4944,91,3610,4170,2809,3962,4769,2128,4838,1901,2333,3406,1282,1568,3272,3648,924,175,3566,3273,3137,1233,2656,113,4603,3743,3907,1918,1418,2790,944,3019,2816,1170,3897,3359,3061,4511,4804,4124,4644,3309,42,4013,4474,4384,3726,4606,2657,2163,1102,3615,3712,1306,2865,3266,3596,1779,3383,5411,3128,4317,5265,1427,1888,4956,4595,3511,2624,2525,2079,4567,3382,4106,5143,3028,3077,2603,4509,3559,1863,52,2065,4007,597,874,990,5303,4144,3044,4137,2706,5229,2733,3103,4086,3687,1832,3411,4739,1990,4916,3422,117,5196,4624,4286,5212,157,2505,34,1840,4650,1565]}},"textFloorPx":9}; /* TUBE-DATA:END */

// THE SAME GRID AS THE ATLAS MAP. The voltage classes, their order, and the rule that decides which
// class a voltage IS are lifted from gridatlas atlas/modules/202609012040-grid-scope.js (composed
// into atlas/cartridges/202609200022-sld-sandbox-v9-8.js), so a person who knows that map recognises
// this one as the same grid. The rule is MEMBERSHIP within half a kilovolt, never "the first class
// this exceeds": that older rule labelled 750 kV as 400 and 50 kV as 33, and a voltage the standard
// classes do not contain is a fact about the data, not a number to round into a familiar one. An
// unclassified voltage is drawn and counted as unclassified.
const TUBE_CLASSES_KV = [400, 275, 220, 132, 66, 33];
const TUBE_CLASS_TOLERANCE_KV = 0.5;
function tubeClassOf(kv){ if (!Number.isFinite(kv)) return null;
  for (const known of TUBE_CLASSES_KV) if (Math.abs(kv - known) <= TUBE_CLASS_TOLERANCE_KV) return known;
  return null; }
// TRANSMISSION, by the Atlas's own test (nearest_transmission: kv >= 275 - 0.5).
function tubeIsTransmission(kv){ return Number(kv) >= 275 - TUBE_CLASS_TOLERANCE_KV; }
// Voltage class is the only thing a colour says here, exactly as a line colour on an underground map
// says only which line it is. The order is the Atlas's, highest class first; five of these are new to
// the engine, the rest are the engine's own ink.
const TUBE_KV = { 400: '#ffb454', 275: '#ff4b3a', 220: '#c89bff', 132: '#5ec8f2', 66: '#6fe3a8', 33: '#94a2b5' };
const TUBE_UNCLASSED = '#6d7d92';
const TUBE_LIT = '#eaf6ff', TUBE_DARK = '#1b2430', TUBE_CAGE = '#7ff0ff', TUBE_GROUND = '#04060a';
const TUBE_TEXT_FLOOR_PX = 9;                       // the engine's floor, kept word for word
// The Atlas's own words about what a picture like this cannot tell you, carried with the numbers so
// they cannot be separated from them by a renderer, a screenshot or a quote.
const TUBE_NOT = 'Not a statement about capacity, headroom, availability or the cost of connecting here.';
function tubeInk(kv){ const c = tubeClassOf(kv); return c === null ? TUBE_UNCLASSED : TUBE_KV[c]; }

const TUBE = { on: false, view: 'nation', focus: -1, hops: 2, kv: 0, t0: 0, phase: '',
               lit: null, litLinks: null, hull: null, lattice: null, morph: 1, drawMs: 0, hit: [] };

// ---- the graph, made once from the data ------------------------------------------------------
const TUBE_ADJ = (() => { const a = TUBE_DATA.stations.map(() => []);
  TUBE_DATA.links132.forEach((L, i) => { a[L[0]].push([L[1], i]); a[L[1]].push([L[0], i]); }); return a; })();
function tubeName(i){ const s = TUBE_DATA.stations[i]; return (s && s[5]) || 'unnamed station'; }
function tubeDegree(i){ return TUBE_ADJ[i] ? TUBE_ADJ[i].length : 0; }
// A BRIDGE LINK is one whose loss cuts the network in two. It is the single most commercial fact on
// the whole picture and it is found here rather than asserted: Tarjan's low-link walk, once.
const TUBE_BRIDGES = (() => { const n = TUBE_ADJ.length, disc = new Int32Array(n).fill(-1), low = new Int32Array(n), br = new Set();
  let t = 0;
  for (let s = 0; s < n; s++) { if (disc[s] >= 0) continue;
    const st = [[s, -1, 0]];
    while (st.length) { const f = st[st.length - 1];
      if (f[2] === 0) { disc[f[0]] = low[f[0]] = t++; }
      if (f[2] < TUBE_ADJ[f[0]].length) { const [to, li] = TUBE_ADJ[f[0]][f[2]++];
        if (li === f[1]) continue;
        if (disc[to] < 0) st.push([to, li, 0]); else low[f[0]] = Math.min(low[f[0]], disc[to]); }
      else { st.pop(); const p = st[st.length - 1];
        if (p) { low[p[0]] = Math.min(low[p[0]], low[f[0]]); if (low[f[0]] > disc[p[0]]) br.add(f[1]); } } } }
  return br; })();
// THE GEOGRAPHY, ONCE, into the disc's own unit square, so the engine's camera does all the rest.
const TUBE_GEO = (() => { const S = TUBE_DATA.stations;
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  const mid = S.reduce((a, s) => a + s[2], 0) / Math.max(1, S.length);
  const k = Math.cos(mid * Math.PI / 180);                       // longitude shortens away from the line
  const p = S.map(s => [s[1] * k, s[2]]);
  for (const q of p) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
  const sc = 1.82 / Math.max(1e-9, Math.max(x1 - x0, y1 - y0));
  return p.map(q => [(q[0] - (x0 + x1) / 2) * sc, (q[1] - (y0 + y1) / 2) * sc]); })();

// ---- the layer, made the way the engine makes one --------------------------------------------
function tubeLayer(){ let el2 = document.getElementById('tubemap');
  if (!el2) { el2 = document.createElement('canvas'); el2.id = 'tubemap'; el2.setAttribute('aria-hidden', 'true');
    const st = document.createElement('style');
    st.textContent = '#tubemap{position:fixed;inset:0;z-index:9;pointer-events:none}';
    // THE DISC'S OWN WORDS BELONG TO THE DISC. While this picture is up the month rings' labels are
    // put away, because a tube map with SEP 26 written across it is two pictures at once.
    st.textContent += 'body.tube-on #labels,body.tube-on #names,body.tube-on #sldnames{display:none}';
    document.head.append(st);
    const c = document.getElementById('c');
    if (c && c.parentNode) c.parentNode.insertBefore(el2, c.nextSibling); else document.body.append(el2); }
  return el2; }
function tubeGone(){ TUBE.on = false; TUBE.hit = [];
  try { document.body.classList.remove('tube-on'); } catch (_) {}
  const el2 = document.getElementById('tubemap'); if (!el2) return;
  const ctx = el2.getContext && el2.getContext('2d');
  if (ctx) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, el2.width, el2.height); } }

// ---- THE CAGE: who is inside it ---------------------------------------------------------------
// Hops along the NETWORK, not miles across the ground: two stops from here is two stops from here
// whichever way the wire bends. A kv filter, when one is typed, refuses to walk through a class it
// was not asked about.
function tubeBFS(from, hops, kv){ const seen = new Map([[from, 0]]), links = new Set(), q = [from];
  for (let h = 0; h < hops; h++) { const next = [];
    for (const a of q) for (const [b, li] of TUBE_ADJ[a]) {
      if (kv && TUBE_DATA.stations[b][3] !== kv && b !== from) continue;
      links.add(li);
      if (!seen.has(b)) { seen.set(b, h + 1); next.push(b); } }
    q.length = 0; q.push(...next); }
  // a link is only inside the cage when BOTH its ends are
  for (const li of Array.from(links)) { const L = TUBE_DATA.links132[li];
    if (!seen.has(L[0]) || !seen.has(L[1])) links.delete(li); }
  return { set: seen, links }; }
// The outline itself: the precomputed hull when the data carries one, else the gift wrap in the page.
function tubeHullOf(pts){ if (pts.length < 3) return pts.slice();
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i];
    while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  lo.pop(); up.pop(); return lo.concat(up); }
function tubeSwell(hull, pad){ if (hull.length < 2) return hull;
  let mx = 0, my = 0; for (const q of hull) { mx += q[0]; my += q[1]; } mx /= hull.length; my /= hull.length;
  return hull.map(q => { const dx = q[0] - mx, dy = q[1] - my, d = Math.max(1e-9, Math.hypot(dx, dy));
    return [q[0] + dx / d * pad, q[1] + dy / d * pad]; }); }

// ---- THE TUBE MAP: the caged set re-laid on an octilinear lattice ----------------------------
// Every station goes to the nearest free crossing of a square lattice; where two want the same
// crossing the second takes the nearest free one, searched outward in rings, so the ORDER of the
// network survives even though the geography does not. That is the whole trick of an underground
// map: keep the sequence, drop the miles.
function tubeLattice(ids, focus){
  const pitch = (TUBE_DATA.defaults && TUBE_DATA.defaults.pitch) || 0.16;
  const rot = ((TUBE_DATA.defaults && TUBE_DATA.defaults.rotation) || 0) * Math.PI / 180;
  const f = TUBE_GEO[focus], cosR = Math.cos(rot), sinR = Math.sin(rot);
  let far = 0; for (const i of ids) far = Math.max(far, Math.hypot(TUBE_GEO[i][0] - f[0], TUBE_GEO[i][1] - f[1]));
  const k = far > 1e-9 ? (pitch * 3.4) / far : 1;                 // the cage fills about seven pitches
  const taken = new Map(), out = new Map();
  const order = ids.slice().sort((a, b) =>
    Math.hypot(TUBE_GEO[a][0] - f[0], TUBE_GEO[a][1] - f[1]) - Math.hypot(TUBE_GEO[b][0] - f[0], TUBE_GEO[b][1] - f[1]));
  for (const i of order) { const dx = (TUBE_GEO[i][0] - f[0]) * k, dy = (TUBE_GEO[i][1] - f[1]) * k;
    const rx = dx * cosR - dy * sinR, ry = dx * sinR + dy * cosR;
    let gx = Math.round(rx / pitch), gy = Math.round(ry / pitch);
    for (let r = 0; r < 40; r++) { let done = false;
      for (let a = -r; a <= r && !done; a++) for (let b = -r; b <= r && !done; b++) {
        if (r > 0 && Math.abs(a) !== r && Math.abs(b) !== r) continue;
        const key = (gx + a) + ',' + (gy + b);
        if (!taken.has(key)) { taken.set(key, i); out.set(i, [(gx + a) * pitch, (gy + b) * pitch]); done = true; } }
      if (done) break; } }
  return out; }
// A LINK IS 0, 45 OR 90 DEGREES AND NOTHING ELSE: the diagonal is taken first and the straight run
// finishes the job, which is what makes a tube map read as a diagram rather than a sketch.
function tubeRoute(a, b){ const dx = b[0] - a[0], dy = b[1] - a[1];
  const ax = Math.abs(dx), ay = Math.abs(dy);
  if (ax < 1e-9 || ay < 1e-9 || Math.abs(ax - ay) < 1e-9) return [a, b];
  const d = Math.min(ax, ay), sx = Math.sign(dx), sy = Math.sign(dy);
  return [a, [a[0] + sx * d, a[1] + sy * d], b]; }
// AN INTERCHANGE is a station where classes meet - the one place a traveller changes line.
function tubeInterchange(i){ const c = TUBE_DATA.stations[i][3];
  for (const [b] of TUBE_ADJ[i]) if (TUBE_DATA.stations[b][3] !== c) return true;
  return false; }

// ---- the drawing ------------------------------------------------------------------------------
function tubeAt(i){ const g = TUBE_GEO[i];
  if (TUBE.lattice && TUBE.lattice.has(i)) { const l = TUBE.lattice.get(i), u = TUBE.morph;
    return [g[0] + (l[0] + TUBE_GEO[TUBE.focus][0] - g[0]) * u, g[1] + (l[1] + TUBE_GEO[TUBE.focus][1] - g[1]) * u]; }
  return g; }
function drawTubeMap(){
  if (!TUBE.on) return;
  const el2 = tubeLayer(), t = performance.now();
  const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  const W = Math.max(1, Math.round(innerWidth * dpr)), H = Math.max(1, Math.round(innerHeight * dpr));
  if (el2.width !== W || el2.height !== H) { el2.width = W; el2.height = H; }
  const ctx = el2.getContext('2d'); if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, innerWidth, innerHeight);
  // THE GROUND. True black, because the marks are what must be read and the disc beneath is not part
  // of this picture at all.
  ctx.fillStyle = TUBE_GROUND; ctx.fillRect(0, 0, innerWidth, innerHeight);
  const px = shapeScale(), S = p => shapePoint(p);
  const caged = TUBE.lit, cagedL = TUBE.litLinks;
  // THE SWEEP. The ring leaves the tapped station and everything it has passed that belongs to the
  // cage stays lit; everything else goes dark. It advances on the frames the shell already draws.
  let sweep = 1e9;
  if (TUBE.phase === 'pulse') { const u = Math.min(1, (t - TUBE.t0) / 1100);
    sweep = u * Math.hypot(innerWidth, innerHeight) * 0.75;
    if (u >= 1) { TUBE.phase = 'lay'; TUBE.t0 = t; }
    try { dirty = true; } catch (_) {} }
  else if (TUBE.phase === 'lay') { const u = Math.min(1, (t - TUBE.t0) / 700);
    TUBE.morph = u < 1 ? u * u * (3 - 2 * u) : 1;
    if (u >= 1) TUBE.phase = 'tube'; try { dirty = true; } catch (_) {} }
  const centre = TUBE.focus >= 0 ? S(tubeAt(TUBE.focus)) : null;
  const passed = p => !centre || sweep >= 1e8 || Math.hypot(p[0] - centre[0], p[1] - centre[1]) <= sweep;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // 1. THE LINKS. Dark ones first, in one batched path, so a phone strokes once and not 5,800 times.
  const L = TUBE_DATA.links132;
  if (!caged || TUBE.phase === 'pulse') { ctx.beginPath();
    for (let i = 0; i < L.length; i++) { if (caged && cagedL.has(i)) continue;
      const a = S(tubeAt(L[i][0])), b = S(tubeAt(L[i][1]));
      if (Math.max(a[0], b[0]) < -40 || Math.min(a[0], b[0]) > innerWidth + 40) continue;
      if (Math.max(a[1], b[1]) < -40 || Math.min(a[1], b[1]) > innerHeight + 40) continue;
      ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
    ctx.lineWidth = 1; ctx.strokeStyle = TUBE_DARK; ctx.stroke(); }
  // 2. THE LIT LINKS, one stroke per voltage class, weight by how many circuits run the route.
  const wantL = caged ? Array.from(cagedL) : L.map((_, i) => i);
  const byW = new Map();
  for (const i of wantL) { const lk = L[i];
    if (caged && (!passed(S(tubeAt(lk[0]))) && !passed(S(tubeAt(lk[1]))))) continue;
    const kvc = Math.max(TUBE_DATA.stations[lk[0]][3], TUBE_DATA.stations[lk[1]][3]);
    const key = kvc + ':' + Math.min(4, lk[3] || 1);
    if (!byW.has(key)) byW.set(key, []); byW.get(key).push(i); }
  for (const [key, list] of byW) { const [kvc, par] = key.split(':').map(Number);
    ctx.beginPath();
    for (const i of list) { const lk = L[i];
      const pts = TUBE.lattice && TUBE.morph > 0.5 ? tubeRoute(S(tubeAt(lk[0])), S(tubeAt(lk[1])))
                                                   : [S(tubeAt(lk[0])), S(tubeAt(lk[1]))];
      ctx.moveTo(pts[0][0], pts[0][1]); for (let j = 1; j < pts.length; j++) ctx.lineTo(pts[j][0], pts[j][1]); }
    ctx.lineWidth = (TUBE.lattice ? 3.2 : 1.3) * (0.8 + 0.35 * par);
    ctx.strokeStyle = tubeInk(kvc); ctx.globalAlpha = caged ? 1 : 0.85; ctx.stroke(); }
  ctx.globalAlpha = 1;
  // 3. THE STATIONS. Binned by voltage class and batched; below a zoom a station is a mark and not a
  //    ring, because 5,800 rings on a telephone is a grey cloud and says nothing.
  const rad = TUBE.lattice ? 5.2 : Math.max(1.1, Math.min(4.2, px * 0.010));
  const bins = new Map(); TUBE.hit = [];
  for (let i = 0; i < TUBE_DATA.stations.length; i++) {
    const inCage = !caged || caged.has(i);
    const p = S(tubeAt(i));
    if (p[0] < -30 || p[0] > innerWidth + 30 || p[1] < -30 || p[1] > innerHeight + 30) continue;
    if (caged && !inCage) { if (TUBE.lattice) continue; }
    if (caged && inCage && !passed(p)) continue;
    const kvc = TUBE_DATA.stations[i][3], key = (caged && !inCage) ? 'dark' : String(kvc);
    if (!bins.has(key)) bins.set(key, []); bins.get(key).push([p, i]);
    if (!caged || inCage) TUBE.hit.push([p[0], p[1], i]); }
  for (const [key, list] of bins) { const dark = key === 'dark';
    ctx.beginPath();
    for (const [p] of list) { ctx.moveTo(p[0] + rad, p[1]); ctx.arc(p[0], p[1], dark ? rad * 0.6 : rad, 0, 6.2832); }
    ctx.fillStyle = dark ? TUBE_DARK : tubeInk(Number(key)); ctx.fill();
    if (!dark && rad >= 3) { ctx.lineWidth = 1.2; ctx.strokeStyle = TUBE_GROUND; ctx.stroke(); } }
  // AN INTERCHANGE RING, only where classes actually meet and only when there is room for it to be a
  // ring rather than a smudge.
  if (rad >= 3) { ctx.beginPath(); let any = false;
    for (const [, list] of bins) for (const [p, i] of list) { if (!tubeInterchange(i)) continue;
      if (caged && !caged.has(i)) continue;
      ctx.moveTo(p[0] + rad * 1.9, p[1]); ctx.arc(p[0], p[1], rad * 1.9, 0, 6.2832); any = true; }
    if (any) { ctx.lineWidth = 1.6; ctx.strokeStyle = TUBE_LIT; ctx.stroke(); } }
  // 4. THE CAGE ITSELF, a fine outline round the lit set, and the ring while it is still travelling.
  if (TUBE.hull && TUBE.phase !== 'pulse') { const h = TUBE.hull.map(q => S(q));
    if (h.length > 2) { ctx.beginPath(); ctx.moveTo(h[0][0], h[0][1]);
      for (let i = 1; i < h.length; i++) ctx.lineTo(h[i][0], h[i][1]);
      ctx.closePath(); ctx.setLineDash([5, 5]); ctx.lineWidth = 1.2; ctx.strokeStyle = TUBE_CAGE;
      ctx.globalAlpha = 0.75; ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; } }
  if (TUBE.phase === 'pulse' && centre) { ctx.beginPath(); ctx.arc(centre[0], centre[1], Math.max(1, sweep), 0, 6.2832);
    ctx.lineWidth = 2.2; ctx.strokeStyle = TUBE_CAGE; ctx.globalAlpha = 0.55; ctx.stroke(); ctx.globalAlpha = 1; }
  // 5. THE NAMES. By tier as the camera comes in, never shrunk, never overlapped, and never under
  //    nine pixels: a name too small to read is worse than no name at all.
  const tiers = TUBE_DATA.labelTiers || {};
  // TRANSMISSION IS ALWAYS TIER ONE, by the Atlas's own test, so the first names a reader sees on
  // this map are the first names they would see on that one.
  const tierOf = i => tubeIsTransmission(TUBE_DATA.stations[i][3]) ? 1
    : (tiers[1] && tiers[1].indexOf(i) >= 0) ? 1 : (tiers[2] && tiers[2].indexOf(i) >= 0) ? 2 : 3;
  const showTier = TUBE.lattice ? 3 : px < 900 ? 1 : px < 2400 ? 2 : 3;
  const size = TUBE.lattice ? 12 : px < 1600 ? 10 : 11;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.font = '600 ' + (size * dpr) + 'px ui-monospace,Menlo,Consolas,monospace';
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const put = [];
  // HOW MANY NAMES A SCREEN CAN HOLD. Dropping what clashes is not enough on its own: five thousand
  // candidates fill every gap and the result is a page of words with a map hidden under it. An
  // underground map names every stop because it has forty of them. So the nation view is given a
  // BUDGET - about one name per two thousand square pixels - spent on the biggest junctions first,
  // and the rest of the names wait for the reader to come closer. Inside a cage every station is
  // named, because that is the whole point of having drawn the cage.
  const budget = TUBE.lattice ? 1e9 : Math.max(8, Math.round(innerWidth * innerHeight / 2000));
  let spent = 0;
  const cand = [];
  for (const [, list] of bins) for (const [p, i] of list) {
    if (caged && !caged.has(i)) continue;
    if (tierOf(i) > showTier) continue;
    cand.push([p, i]); }
  cand.sort((a, b) => (tierOf(a[1]) - tierOf(b[1])) || (tubeDegree(b[1]) - tubeDegree(a[1])));
  if (size >= TUBE_TEXT_FLOOR_PX) for (const [p, i] of cand) {
    if (spent >= budget) break;
    const text = TUBE_DATA.stations[i][5] || 'unnamed';
    const w = ctx.measureText(text).width, h2 = (size + 4) * dpr;
    const slots = [[rad + 5, 0], [-(rad + 5) - w / dpr, 0], [-w / dpr / 2, -(rad + 9)], [-w / dpr / 2, rad + 9]];
    for (const [ox, oy] of slots) { const x0 = Math.round((p[0] + ox) * dpr), y0 = Math.round((p[1] + oy) * dpr) - h2 / 2;
      const pad = (TUBE.lattice ? 1 : 6) * dpr;
      const box = [x0 - pad, y0 - pad * 0.5, x0 + w + pad, y0 + h2 + pad * 0.5];
      let clash = false; for (const q of put) if (box[0] < q[2] && box[2] > q[0] && box[1] < q[3] && box[3] > q[1]) { clash = true; break; }
      if (clash) continue;
      put.push(box); spent++; ctx.fillStyle = TUBE_LIT; ctx.fillText(text, x0, y0 + h2 / 2); break; } }
  // 6. WHERE THE PICTURE CAME FROM, always, and the warning the engine carries, always.
  const small = Math.max(TUBE_TEXT_FLOOR_PX, 10);
  ctx.font = '500 ' + (small * dpr) + 'px ui-monospace,Menlo,Consolas,monospace';
  ctx.textAlign = 'left'; ctx.fillStyle = '#8aa0b6';
  // AT THE TOP, UNDER THE ENGINE'S OWN WARNING, because the foot of a telephone is where the command
  // box lives and a line written there is a line nobody reads.
  // JUST ABOVE THE COMMAND BOX, found by asking the engine where that box actually is, so it is never
  // written under the face's own buttons at the top nor under the box at the foot. Wrapped rather
  // than run off the edge: a line of provenance that leaves the screen is not provenance.
  let ay = innerHeight - 22;
  try { const r = typeof sayRect === 'function' && sayRect(); if (r && r.top > 80) ay = r.top - 12; } catch (_) {}
  const maxW = (innerWidth - 24) * dpr, words = TUBE_DATA.attribution.split(' '), lines = [];
  let cur = '';
  for (const w of words) { const t2 = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t2).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t2; }
  if (cur) lines.push(cur);
  ctx.fillStyle = '#ff7a6b';
  ctx.fillText(typeof DEV_WARNING_SHORT === 'string' ? DEV_WARNING_SHORT : 'DEVELOPMENT ENVIRONMENT',
    Math.round(12 * dpr), Math.round(ay * dpr));
  ctx.fillStyle = '#8aa0b6';
  for (let i = lines.length - 1, k = 1; i >= 0; i--, k++)
    ctx.fillText(lines[i], Math.round(12 * dpr), Math.round((ay - 15 * k) * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  TUBE.drawMs = TUBE.drawMs * 0.8 + (performance.now() - t) * 0.2;
}

// ---- firing it --------------------------------------------------------------------------------
function tubeFit(ids, laid){ if (!ids.length || typeof flyTo !== 'function') return;
  const R = Math.sqrt(SPACE) * BODY_RADIUS_MAX;
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  const f = TUBE.focus >= 0 ? TUBE_GEO[TUBE.focus] : [0, 0];
  for (const i of ids) { const l = laid && TUBE.lattice && TUBE.lattice.get(i);
    const p = l ? [l[0] + f[0], l[1] + f[1]] : tubeAt(i);
    x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  const w = Math.max(0.05, (x1 - x0) * R), h = Math.max(0.05, (y1 - y0) * R);
  // A NAME IS AS WIDE AS THE STATION IT NAMES IS SMALL, so the room left round a tube map is much
  // wider than round a scatter of marks: the widest name on this data is about 14 characters.
  const room = laid ? [2.30, 1.90] : [1.35, 1.55];
  const z = Math.min(innerWidth / (w * room[0]), innerHeight / (h * room[1]));
  flyTo((x0 + x1) / 2 * R, (y0 + y1) / 2 * R, z); }
function tubeFind(place){ const q = String(place || '').trim().toLowerCase(); if (!q) return -1;
  const S = TUBE_DATA.stations;
  for (let i = 0; i < S.length; i++) if (S[i][5] && S[i][5].toLowerCase() === q) return i;
  for (let i = 0; i < S.length; i++) if (S[i][0].toLowerCase() === q) return i;
  for (let i = 0; i < S.length; i++) if (S[i][5] && S[i][5].toLowerCase().indexOf(q) === 0) return i;
  for (let i = 0; i < S.length; i++) if (S[i][5] && S[i][5].toLowerCase().indexOf(q) >= 0) return i;
  return -1; }
// A PLACE THAT MATCHES NOTHING IS REFUSED IN WORDS, with five names to try instead. A picture that
// quietly shows the wrong station is worse than one that says it does not know.
function tubeNearest(place){ const q = String(place || '').trim().toLowerCase();
  const names = TUBE_DATA.stations.map(s => s[5]).filter(Boolean).sort();
  const score = n => { const a = n.toLowerCase(); let k = 0; for (let i = 0; i < Math.min(a.length, q.length); i++) { if (a[i] !== q[i]) break; k++; } return -k; };
  return names.slice().sort((a, b) => score(a) - score(b) || a.localeCompare(b)).slice(0, 5).sort();
}
function tubeNation(){ TUBE.on = true; TUBE.view = 'nation'; TUBE.focus = -1; TUBE.phase = 'nation';
  TUBE.lit = null; TUBE.litLinks = null; TUBE.hull = null; TUBE.lattice = null; TUBE.morph = 0;
  tubeLayer(); try { document.body.classList.add('tube-on'); } catch (_) {}
  tubeFit(TUBE_DATA.stations.map((_, i) => i));
  try { dirty = true; } catch (_) {} }
function tubeCage(i, hops, kv){
  const r = tubeBFS(i, Math.max(1, Math.min(3, hops || 2)), kv || 0);
  TUBE.on = true; TUBE.view = 'station'; TUBE.focus = i; TUBE.hops = hops; TUBE.kv = kv || 0;
  TUBE.lit = r.set; TUBE.litLinks = r.links; TUBE.morph = 0;
  const ids = Array.from(r.set.keys());
  TUBE.lattice = tubeLattice(ids, i);
  const pre = TUBE_DATA.cages && TUBE_DATA.cages[i];
  TUBE.hull = null;
  TUBE.phase = 'pulse'; TUBE.t0 = performance.now();
  tubeLayer(); try { document.body.classList.add('tube-on'); } catch (_) {}
  // FIT THE LATTICE, NOT THE GEOGRAPHY: the picture the reader ends on is the tube map, so the room
  // made for it is the room the tube map needs, names and all.
  tubeFit(ids, true);
  // the outline is taken from the data when the runner has worked it out, else wrapped here
  setTimeout(() => { if (TUBE.focus !== i) return;
    const pts = ids.map(j => { const l = TUBE.lattice.get(j); return [l[0] + TUBE_GEO[i][0], l[1] + TUBE_GEO[i][1]]; });
    TUBE.hull = tubeSwell(pre && pre.hull ? pre.hull : tubeHullOf(pts), 0.07); }, 0);
  try { dirty = true; } catch (_) {}
  return ids.length; }
// ---- TWO CLICKS: the card ---------------------------------------------------------------------
// The engine's own card element and its own classes; every figure says where it came from, and the
// one sentence that keeps a reader honest is at the foot of it.
function tubeCard(i){
  if (typeof card === 'undefined' || !card) return;
  cardToken++; cardShown = null; card.replaceChildren(); card.style.display = 'block'; card.scrollTop = 0;
  card.classList.add('short');
  const x = el('button', 'cc-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'close');
  x.addEventListener('click', () => { card.style.display = 'none'; try { dirty = true; } catch (_) {} });
  card.append(x);
  const put = (s, cls) => card.append(el('div', cls || 'cc-plain', s));
  const S = TUBE_DATA.stations[i];
  put(S[5] || 'unnamed station', 'cc-title');
  const classes = new Set([S[3]]); for (const [b] of TUBE_ADJ[i]) classes.add(TUBE_DATA.stations[b][3]);
  const cls = Array.from(classes).map(v => tubeClassOf(v) === null ? v + ' kV (unclassified)' : tubeClassOf(v) + ' kV');
  put('voltage classes here: ' + cls.join(', ') + ' · from open data'
    + (tubeIsTransmission(S[3]) ? ' · transmission' : ''));
  const deg = tubeDegree(i);
  const bridge = TUBE_ADJ[i].some(([, li]) => TUBE_BRIDGES.has(li));
  put(deg === 1 ? 'SINGLE FED: one link in and out. Losing it loses this station.'
    : bridge ? 'On a BRIDGE link: one of its links, if lost, cuts the network in two.'
             : deg + ' links, none of them a bridge · from open data');
  put('links from here · from open data', 'cc-plain');
  for (const [b, li] of TUBE_ADJ[i]) { const lk = TUBE_DATA.links132[li];
    const row = el('div', 'cc-plain', (TUBE_DATA.stations[b][5] || 'unnamed station') + '  · ' + lk[2] + ' km · '
      + (lk[3] > 1 ? lk[3] + ' circuits' : '1 circuit') + (TUBE_BRIDGES.has(li) ? ' · BRIDGE' : ''));
    row.style.cursor = 'pointer'; row.style.textDecoration = 'underline';
    row.setAttribute('data-tube-to', String(b));
    row.addEventListener('click', () => { tubeCage(b, TUBE.hops, TUBE.kv); tubeCard(b); });
    card.append(row); }
  const n1 = tubeBFS(i, 1, 0).set.size - 1, n2 = tubeBFS(i, 2, 0).set.size - 1, n3 = tubeBFS(i, 3, 0).set.size - 1;
  put('within 1 hop: ' + n1 + ' · within 2: ' + n2 + ' · within 3: ' + n3 + ' · from open data');
  put('Topology from open map data; says nothing about capacity or headroom.', 'cc-refuse');
  put(TUBE_NOT + ' Queue position, committed connections, thermal and fault headroom, consent and commercial terms decide that, and none of them is in this data.', 'cc-plain');
  put(TUBE_DATA.attribution);
  if (typeof layout === 'function') layout(); }

// ---- ONE CLICK on the picture -----------------------------------------------------------------
// The layer takes no pointer events at all; the window listens, exactly as the shapes layer does,
// so the shell's own tap on a dot is untouched when this picture is not up.
addEventListener('pointerdown', function (e) {
  if (!TUBE.on || !TUBE.hit.length) return;
  let best = -1, bd = 22;
  for (const [x, y, i] of TUBE.hit) { const d = Math.hypot(e.clientX - x, e.clientY - y); if (d < bd) { bd = d; best = i; } }
  if (best < 0) return;
  if (TUBE.view === 'station' && TUBE.lit && TUBE.lit.has(best)) tubeCard(best);   // two clicks: the card
  else tubeCage(best, TUBE.hops, TUBE.kv);                                          // one click: the cage
}, { passive: true });
addEventListener('keydown', function (e) { if (e.key === 'Escape' && TUBE.on) tubeGone(); });

// ---- the typed command ------------------------------------------------------------------------
const TUBE_INPUTS = [
  { key: 'view', label: 'view', kind: 'choice', choices: [['nation', 'the whole network'], ['region', 'a region'], ['station', 'one station and its cage']] },
  { key: 'place', label: 'place', kind: 'text' },
  { key: 'hops', label: 'hops along the network', unit: 'stops', kind: 'number', min: 1, max: 3, step: 1 },
  { key: 'kv', label: 'voltage class', kind: 'choice', choices: [[0, 'all']].concat(TUBE_CLASSES_KV.map(v => [v, v + ' kV'])) }
];
function fireGrid(i){ i = i || {};
  const hops = Math.max(1, Math.min(3, i.hops === undefined ? 2 : Number(i.hops) || 2));
  const kv = i.kv === undefined || Number(i.kv) === 0 ? 0 : tubeClassOf(Number(i.kv));
  if (i.kv !== undefined && Number(i.kv) !== 0 && kv === null)
    throw new Error('that is not one of the voltage classes this grid is drawn in: ' + TUBE_CLASSES_KV.join(', ') + ' kV');
  if (typeof endIsolate === 'function') { try { endIsolate(); } catch (_) {} }
  const view = i.place ? 'station' : (i.view || 'nation');
  if (view === 'station' || i.place) {
    const at = tubeFind(i.place);
    if (at < 0) throw new Error('no station of that name is in this data. Nearest names to try: '
      + tubeNearest(i.place).join(', '));
    TUBE.hops = hops; TUBE.kv = kv;
    const n = tubeCage(at, hops, kv);
    return { numbers: { stations_in_the_cage: n, hops, links: TUBE.litLinks.size },
      said: 'the cage is around ' + tubeName(at) + ': ' + n + ' stations within ' + hops + ' hops, laid out as a tube map',
      how: 'hops counted along the network from open map data; the outline is the convex hull of the caged set' }; }
  tubeNation(); TUBE.hops = hops; TUBE.kv = kv;
  return { numbers: { stations: TUBE_DATA.stations.length, links: TUBE_DATA.links132.length },
    said: 'the whole network: tap a station, or type a place, to throw the cage around it',
    how: 'stations and links from open map data, ' + TUBE_DATA.attribution }; }
if (typeof window !== 'undefined') {
  window.KUIPER_TUBE = { data: TUBE_DATA, state: TUBE, fire: fireGrid, cage: tubeCage, card: tubeCard,
                         nation: tubeNation, find: tubeFind, bridges: TUBE_BRIDGES, drawMs: () => TUBE.drawMs };
  try { if (window.FIRE && window.FIRE.register) window.FIRE.register('grid', 'THE GRID', fireGrid, TUBE_INPUTS); } catch (_) {}
  // THE SHELL'S OWN FRAME, not a loop of this file's: the same hook the shapes layer uses.
  try { if (window.__wafer && window.__wafer.onDraw) window.__wafer.onDraw.add(function(){ try { drawTubeMap(); } catch (_) {} }); } catch (_) {}
}
// ===== GRID TUBE MAP: END =======================================================================

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
  // A SYSTEM ENDS ON THE SAME CARD with its own plain words under it; everything else is unchanged.
  if (iso.prog.end.tile === 'system' && systemShown) { systemCard(iso, systemShown);
    if (atHome) { const h = homeCamera(); flyTo(h.x, h.y, h.z); } dirty = true; return; }
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
                // TWO VIEWS, DECLARED. MACRO is the whole string - every module and both home runs to the
                // inverter - fitted to the width of the screen: fine outlines, boxes as dots, one thin line
                // for each cable, and the only words are M1, M10, M20, M30 and the inverter. MICRO is M1 to
                // M4 filling the screen, with the cells, the three boxes and their diode marks, and the
                // connectors. A telephone opens on MICRO, because a whole row on a telephone is a grey
                // smear; a desk opens on MACRO, because there is room for the shape of the thing. The view
                // is a CAMERA and nothing else: what is drawn at any moment is decided by the zoom, so
                // pinching between the two crosses the same thresholds as typing the word.
                mounting: 'fixed', orientation: 'portrait', modules_high: 1, routing: '',
                view: (typeof innerWidth === 'number' && innerWidth > 0 && innerWidth < 700) ? 'micro' : 'macro', sheet: 0,
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
                contact_milliohm: 0.35, return_offset_m: 0.3, lead_gap_m: 0.05,
                // ===== THE MODULE IS A CIRCUIT, AND EVERY PART OF IT IS AN INPUT ==========================
                // These carry the tested parameter set of LIB/solar-params (38 parameters in six groups,
                // 11 named rules, 89 assertions in its test.mjs) into this command. Real lengths vary with
                // the design, the structure and the module, so none of them is a constant any more.
                // Where a value would move a number this command has always reported, the DEFAULT HERE IS
                // THE GEOMETRIC CASE (zero) and the library's own default is named in the box hint: give it
                // and it is used in full.
                module_class: '',                     // MODULE: preset, '' = whatever is typed
                half_cut: 1, cell_cut: 2,             // MODULE: laminate in two halves; cells per column strip
                n_boxes: 3,                           // MODULE: one box (2011 type) or three
                box_along_frac: 0.5,                  // MODULE: box line, as a fraction of the module LENGTH
                box_across_frac_minus: null,          // MODULE: - box across the module WIDTH; null = from box_spacing_m
                box_across_frac_plus: null,           // MODULE: + box across the module WIDTH
                box_w_m: 0.064, box_h_m: 0.024,       // MODULE: the box rectangle itself
                connector_pair_m: 0,                  // MODULE: a mated pair eats this much lead (library 0.060)
                tc_voc_pct_per_k: -0.25,              // MODULE: open circuit temperature coefficient
                max_system_voltage_v: 1500,           // MODULE: the system voltage the class is built for
                table_length_modules: 60,             // STRUCTURE: columns before the row breaks
                gap_table_m: 0.02,                    // STRUCTURE: the gap at that break, added to the run
                clip_offset_m: 0,                     // STRUCTURE: clip line off the box line (library -0.120)
                route_allowance_m: 0,                 // STRUCTURE: gland, bends, clip entry (library 0.080)
                home_run_mm2: null,                   // HOME RUN: null = the site cable size
                termination_extra_m: 0,               // HOME RUN: added once per termination (library 1.0)
                home_run_from: 'start',               // HOME RUN: which end the two string ends are collected at
                ohm_per_km_lead: null, ohm_per_km_site: null,   // CABLE: null = the table for that mm2
                t_min_c: -10, t_max_c: 40 };          // SITE: the cold end sets the longest string allowed
  // ===== THE MODULE CLASSES, AS PRESETS ==========================================================
  // Three real classes by nameless class label only, and one 2011-type single-box module which has NO
  // datasheet behind it at all. Copied from LIB/solar-params/params.mjs PRESETS.
  const PRESETS = {
    'class-T660': { note: '2384 x 1303 mm, 660 Wp, 210 mm half cut, 6 x 22, three boxes on the transverse centre line',
      values: { module_height_m: 2.384, width_m: 1.303, cell_cols: 6, cell_rows: 22, half_cut: 1, cell_cut: 2, n_boxes: 3,
        box_along_frac: 0.5, box_across_frac_minus: 0.174443, box_across_frac_plus: 0.825557,
        box_w_m: 0.064, box_h_m: 0.024, lead_minus_m: 0.280, lead_plus_m: 0.350, lead_mm2: 4,
        module_voc: 45.9, module_vmp: 38.1, tc_voc_pct_per_k: -0.25, max_system_voltage_v: 1500 } },
    'class-W760': { note: '2384 x 1303 mm, 760 Wp, third cut, 6 x 33. The two lead boxes sit near ONE END, not on the mid line',
      values: { module_height_m: 2.384, width_m: 1.303, cell_cols: 6, cell_rows: 33, half_cut: 0, cell_cut: 3, n_boxes: 3,
        box_along_frac: 0.053649, box_across_frac_minus: 0.174520, box_across_frac_plus: 0.825557,
        box_w_m: 0.034, box_h_m: 0.079, lead_minus_m: 0.200, lead_plus_m: 0.400, lead_mm2: 4,
        module_voc: 50.59, module_vmp: 42.3, tc_voc_pct_per_k: -0.22, max_system_voltage_v: 1500 },
      landscape_leads: { lead_minus_m: 1.400, lead_plus_m: 1.400 } },
    'class-J-650': { note: '2465 x 1134 mm, 650 Wp, half cut, 6 x 24, three boxes on the transverse centre line',
      values: { module_height_m: 2.465, width_m: 1.134, cell_cols: 6, cell_rows: 24, half_cut: 1, cell_cut: 2, n_boxes: 3,
        box_along_frac: 0.5, box_across_frac_minus: 0.175397, box_across_frac_plus: 0.823545,
        box_w_m: 0.058, box_h_m: 0.024, lead_minus_m: 0.400, lead_plus_m: 0.300, lead_mm2: 4,
        module_voc: 53.27, module_vmp: 44.6, tc_voc_pct_per_k: -0.25, max_system_voltage_v: 1500 },
      landscape_leads: { lead_minus_m: 1.500, lead_plus_m: 1.500 } },
    'small-2011-single-box': { note: '2011-type 60 cell, 1650 x 990 mm, full cells, ONE box near the top edge carrying both leads. NO DATASHEET: every value is assumed and must be confirmed before it is quoted',
      values: { module_height_m: 1.650, width_m: 0.990, cell_cols: 6, cell_rows: 10, half_cut: 0, cell_cut: 1, n_boxes: 1,
        box_along_frac: 0.06, box_across_frac_minus: 0.5, box_across_frac_plus: 0.5,
        box_w_m: 0.115, box_h_m: 0.085, lead_minus_m: 0.900, lead_plus_m: 0.900, lead_mm2: 4,
        module_voc: 37.0, module_vmp: 30.0, tc_voc_pct_per_k: -0.34, max_system_voltage_v: 1000, modules: 20 } }
  };
  // WHAT A SANE SITE ACTUALLY USES. Outside this the engine does not refuse; it asks "did you mean".
  const PLAUSIBLE = { width_m:[0.5,1.5,'m'], module_height_m:[0.8,2.8,'m'], cell_cols:[4,12,'count'], cell_rows:[8,40,'count'],
    box_w_m:[0.02,0.2,'m'], box_h_m:[0.01,0.2,'m'], lead_minus_m:[0.1,2.0,'m'], lead_plus_m:[0.1,2.0,'m'],
    module_voc:[20,70,'V'], tc_voc_pct_per_k:[-0.45,-0.15,'%/K'],
    max_system_voltage_v:[600,1500,'V'], modules_high:[1,4,'count'], gap_m:[0.005,0.1,'m'], gap_up_m:[0.005,0.3,'m'],
    table_length_modules:[8,120,'count'], gap_table_m:[0.02,5,'m'], clip_offset_m:[-0.6,0.6,'m'],
    route_allowance_m:[0,0.5,'m'], slack_m:[0,0.4,'m'], modules:[8,40,'count'], near_end_m:[2,600,'m'],
    lead_mm2:[2.5,10,'mm2'], cable_mm2:[4,120,'mm2'], t_min_c:[-40,15,'C'], t_max_c:[20,55,'C'] };
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
    // THE LIBRARY'S OWN MERGE ORDER: defaults <- preset <- what was typed. A preset is a module class and
    // nothing else; every value it brings can still be typed over.
    const typed = Object.assign({}, inp || {});
    // the library's key names are accepted as names for this command's own
    if (typed.module_width_m !== undefined) typed.width_m = typed.module_width_m;
    if (typed.module_length_m !== undefined) typed.module_height_m = typed.module_length_m;
    if (typed.cells_across !== undefined) typed.cell_cols = typed.cells_across;
    if (typed.cells_up !== undefined) typed.cell_rows = typed.cells_up;
    if (typed.n !== undefined) typed.modules = typed.n;
    if (typed.voc_stc_v !== undefined) typed.module_voc = typed.voc_stc_v;
    if (typed.home_run_m !== undefined) typed.near_end_m = typed.home_run_m;
    if (typed.site_mm2 !== undefined) typed.cable_mm2 = typed.site_mm2;
    const pre = PRESETS[String(typed.module_class || '')];
    const c = Object.assign({}, DEF, pre ? pre.values : null,
      (pre && pre.landscape_leads && String(typed.orientation || '').toLowerCase() === 'landscape') ? pre.landscape_leads : null,
      typed);
    const N = Math.max(2, Math.min(60, Math.round(c.modules)));
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
    // WHERE THE ROW BREAKS. A table is so many modules long and then there is a gap in the steel; a link
    // that crosses the break has to cross the gap as well. Nothing to declare and nothing to guess: it is
    // in the x of every module.
    const tlm = Math.max(1, Math.round(+c.table_length_modules || 1)), gTab = +c.gap_table_m || 0;
    const x0 = k => colOf(k) * pitch + Math.floor(colOf(k) / tlm) * gTab, y0 = k => rowY[rowOf(k)];
    // THE BOXES ARE NOT AT THE MIDDLE OF ANYTHING UNLESS THE CLASS PUTS THEM THERE. Their positions are
    // two fractions: ACROSS the module's short axis (u) and ALONG its long axis (v). box_spacing_m is kept
    // as the name for the across pair, so every command ever written still means what it said.
    const fM0 = c.box_across_frac_minus === null || c.box_across_frac_minus === undefined
      ? 0.5 - (c.box_spacing_m / 2) / c.width_m : +c.box_across_frac_minus;
    const fP0 = c.box_across_frac_plus === null || c.box_across_frac_plus === undefined
      ? 0.5 + (c.box_spacing_m / 2) / c.width_m : +c.box_across_frac_plus;
    const fV0 = Math.min(1, Math.max(0, +c.box_along_frac));
    const boxSpanM = Math.round(Math.abs(fP0 - fM0) * c.width_m * 1e6) / 1e6;
    const ptAt = (k, want, t) => { const u0 = want === '+' ? fP0 : fM0;
      const u = t ? 1 - u0 : u0, v = t ? 1 - fV0 : fV0;
      return port ? [x0(k) + u * wX, y0(k) + v * wY] : [x0(k) + v * wX, y0(k) + u * wY]; };
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
      // THE ROUTE IS NOT THE DIAGONAL when the cable is clipped: it leaves the box, drops to the clip line
      // c.clip_offset_m away, runs along it and climbs back. Plus the gland exit, the bend radii and the
      // clip entry, which no polyline draws: c.route_allowance_m. Both are zero by default, which is the
      // geometric case this command has always reported; the library's own defaults are -0.120 and 0.080 m.
      const routeExtra = 2 * Math.abs(+c.clip_offset_m || 0) + (+c.route_allowance_m || 0);
      const need = Math.hypot(A[0] - B[0], A[1] - B[1]) + (+c.slack_m || 0) + routeExtra;
      links.push({ from, to, need, back: to < from, cross: rowOf(from) !== rowOf(to),
                   x_from: A[0], x_to: B[0], y_from: A[1], y_to: B[1] }); }
    const longest = links.length ? Math.max(...links.map(l => l.need)) : 0;
    if (c.lead_plus_m === null || c.lead_minus_m === null) {
      const want = longest + (c.lead_slack_m === undefined ? 0.20 : +c.lead_slack_m);
      // the + lead keeps the box spacing it really has and the - lead makes up the rest, which is how
      // a module maker quotes an unequal pair
      const lpWant = Math.min(want * 0.5, boxSpanM);
      if (c.lead_plus_m === null) c.lead_plus_m = Math.round(lpWant * 1000) / 1000;
      if (c.lead_minus_m === null) c.lead_minus_m = Math.round((want - c.lead_plus_m) * 1000) / 1000; }
    // A MATED PAIR EATS LEAD. What is left of the two leads is what can actually span the route.
    const pair = c.lead_plus_m + c.lead_minus_m - (+c.connector_pair_m || 0);
    for (const l of links) { l.reaches = pair + 1e-9 >= l.need;
      l.jumper = !l.reaches && !!c.jumpers ? l.need - pair : 0; }
    const last = order[order.length - 1], row = (cols - 1) * pitch + Math.floor((cols - 1) / tlm) * gTab + wX;
    // HOW FAR A FREE END IS FROM THE NEAR CORNER, along the structure: a cable is clipped to steel, it
    // does not fly. Both ends land at the near end when the + end is in the near half of the table.
    const yBase = rowY[0] + wY / 2;
    // WHICH END THE TWO STRING ENDS ARE COLLECTED AT is a decision, not a fact about the table.
    const xRef = String(c.home_run_from || 'start').toLowerCase() === 'end' ? (cols - 1) * pitch + Math.floor((cols - 1) / tlm) * gTab : 0;
    const run = q => Math.abs(q[0] - xRef) + Math.abs(q[1] - yBase);
    const endRun = run(plusPt(last)), bothNear = endRun <= row / 2;
    const ret = bothNear ? 0 : endRun;
    // conductor_c, when it is given, is the name for both: it sets the lead and the site cable together.
    if (c.conductor_c !== null && c.conductor_c !== undefined && c.conductor_c !== '') { c.t_lead_c = +c.conductor_c; c.t_site_c = +c.conductor_c; }
    const fLead = 1 + 0.00393 * (c.t_lead_c - 20), fSite = 1 + 0.00393 * (c.t_site_c - 20);
    // A JUMPER IS SITE CABLE AND ONE MORE MATED PAIR, at the link it is spliced into.
    const jumpers = links.filter(l => l.jumper > 0), jumper_m = jumpers.reduce((t, l) => t + l.jumper, 0);
    const lead_m = N * pair, field_m = 2 * c.near_end_m + 4 * (+c.termination_extra_m || 0) + run(minusPt(order[0])) + endRun + jumper_m;
    const pairs = links.length + 2 + (bothNear ? 0 : 1) + jumpers.length;
    // A SITE MADE END is a connector fitted to a cut cable by a person on the table: the two home runs
    // always, and the far end return cable's two, when one is laid.
    const siteEnds = 2 + (bothNear ? 0 : 2);
    // THE COPPER'S OWN NUMBER IS AN INPUT TOO, and the home run may be a different size from the array's
    // own cable: on a long run it is the bigger part of the loss.
    const rLead = (c.ohm_per_km_lead === null || c.ohm_per_km_lead === undefined) ? (R20[c.lead_mm2] || 5.09) : +c.ohm_per_km_lead;
    const rSite = (c.ohm_per_km_site === null || c.ohm_per_km_site === undefined) ? (R20[c.cable_mm2] || 3.39) : +c.ohm_per_km_site;
    const hrSize = (c.home_run_mm2 === null || c.home_run_mm2 === undefined) ? c.cable_mm2 : c.home_run_mm2;
    const rHome = (c.ohm_per_km_site === null || c.ohm_per_km_site === undefined) ? (R20[hrSize] || rSite) : rSite;
    const home_m = 2 * c.near_end_m + 4 * (+c.termination_extra_m || 0), array_m = field_m - 2 * c.near_end_m - 4 * (+c.termination_extra_m || 0);
    const ohmLead = rLead * lead_m * fLead / 1000;
    const ohmSite = (rHome * home_m + rSite * array_m) * fSite / 1000;
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
    const baseField = 2 * c.near_end_m + 4 * (+c.termination_extra_m || 0) + Math.abs(ptAt(1, '-', false)[0]) + Math.abs(ptAt(1, '-', false)[1] - yBase) + baseEnd;
    const saved = baseField - field_m;
    const smallest = needs.length ? Math.max(...needs) : 0;
    // ===== THE ELEVEN SANITY RULES =================================================================
    // Copied, words and all, from LIB/solar-params/params.mjs (RULES; its test.mjs asserts them in 89
    // assertions). A rule that says no is not a failure: it is the engine refusing to draw something
    // stupid, and the words it refuses in ARE the answer. Nothing wrong is ever drawn.
    const vocCold = c.module_voc * (1 + (+c.tc_voc_pct_per_k) / 100 * (c.t_min_c - 25));
    const stringVocCold = N * vocCold, nMaxCold = Math.floor(c.max_system_voltage_v / Math.max(1e-9, vocCold));
    const checks = [];
    const ok_ = (n, w) => checks.push({ name: n, ok: true, words: w });
    const no_ = (n, w) => checks.push({ name: n, ok: false, words: w });
    // 1
    (() => { const nb = Math.round(+c.n_boxes);
      if (nb !== 1 && nb !== 3) return no_('wiring_is_buildable', 'n_boxes is ' + c.n_boxes + '. A module carries one box or three; nothing else is drawn.');
      if (N < 2 && routing !== 'one-after-another') return no_('wiring_is_buildable', 'N = ' + N + ': there is nothing to leapfrog over.');
      if ((routing === 'serpentine' || routing === 'zigzag') && rows < 2) return no_('wiring_is_buildable', routing + ' goes out along one tier and back along the one above it, so it needs at least two tiers; modules high is ' + high + '. Use leapfrog on a single tier, or set modules high to 2.');
      ok_('wiring_is_buildable', routing + ' is buildable on ' + rows + ' tier(s) with ' + nb + ' box(es) per module'); })();
    // 2
    (() => { if (Math.round(+c.n_boxes) === 1 && Math.abs(fP0 - fM0) > 1e-6)
        return no_('lead_only_from_terminal_box', 'this module has ONE junction box, so both leads leave that box and the box spacing is zero; the + and the − are asked for ' + boxSpanM.toFixed(3) + ' m apart. A module lead can only leave a junction box that carries one.');
      if (Math.round(+c.n_boxes) === 3 && Math.abs((fM0 + fP0) / 2 - 0.5) > 0.4)
        return no_('lead_only_from_terminal_box', 'the two lead boxes are not the outer pair of the three: the middle box holds a bypass diode and the cross connection only, and no lead leaves it.');
      ok_('lead_only_from_terminal_box', 'every lead leaves and lands on a box that carries a terminal'); })();
    // 3
    (() => { const bad = links.find(l => l.from === l.to);
      if (bad) return no_('no_conductor_inside_one_module', 'a link has both ends on module ' + bad.from + '. A module is never wired to itself; that would short its own string.');
      ok_('no_conductor_inside_one_module', 'no conductor has both ends on the same module'); })();
    // 4
    (() => { const count = new Map(); for (let k = 1; k <= N; k++) { count.set('M' + k + '−', 0); count.set('M' + k + '+', 0); }
      for (const l of links) { count.set('M' + l.from + '+', (count.get('M' + l.from + '+') || 0) + 1); count.set('M' + l.to + '−', (count.get('M' + l.to + '−') || 0) + 1); }
      count.set('M' + order[0] + '−', (count.get('M' + order[0] + '−') || 0) + 1);
      count.set('M' + order[order.length - 1] + '+', (count.get('M' + order[order.length - 1] + '+') || 0) + 1);
      const unused = [...count].filter(e => e[1] === 0).map(e => e[0]), doubled = [...count].filter(e => e[1] > 1).map(e => e[0] + ' x' + e[1]);
      if (unused.length) return no_('every_terminal_used_once', unused.length + ' terminal(s) are wired to nothing: ' + unused.slice(0, 4).join(', ') + (unused.length > 4 ? ' ...' : ''));
      if (doubled.length) return no_('every_terminal_used_once', doubled.length + ' terminal(s) are wired more than once: ' + doubled.slice(0, 4).join(', '));
      ok_('every_terminal_used_once', 'all ' + count.size + ' terminals are used exactly once'); })();
    // 5
    (() => { if (order.length !== N) return no_('walk_visits_all_and_ends_at_inverter', 'the walk visits ' + order.length + ' modules but the string has ' + N);
      if (new Set(order).size !== N) return no_('walk_visits_all_and_ends_at_inverter', 'the walk visits a module twice: ' + order.join(','));
      ok_('walk_visits_all_and_ends_at_inverter', 'the walk visits all ' + N + ' modules once, M' + order[0] + ' first, M' + order[N - 1] + ' last, and both ends reach the inverter'); })();
    // 6
    (() => { const fr = Math.round(+c.n_boxes) === 1 ? [fM0] : [fM0, 0.5, fP0];
      for (const u of fr) { const L = u * c.width_m - c.box_w_m / 2, R = u * c.width_m + c.box_w_m / 2;
        const B = fV0 * c.module_height_m - c.box_h_m / 2, T = fV0 * c.module_height_m + c.box_h_m / 2;
        if (L < -1e-6 || R > c.width_m + 1e-6 || B < -1e-6 || T > c.module_height_m + 1e-6)
          return no_('boxes_inside_module', 'a junction box sticks out of its module: the box spans ' + L.toFixed(3) + '..' + R.toFixed(3) + ' x ' + B.toFixed(3) + '..' + T.toFixed(3) + ' m, the module is 0..' + c.width_m.toFixed(3) + ' x 0..' + c.module_height_m.toFixed(3) + ' m. A junction box is glued to the back glass; it cannot hang over the frame.'); }
      ok_('boxes_inside_module', 'all boxes sit inside their module'); })();
    // 7
    (() => { const keys = ['module_height_m', 'width_m', 'gap_m', 'gap_up_m', 'gap_table_m', 'lead_minus_m', 'lead_plus_m',
        'connector_pair_m', 'route_allowance_m', 'slack_m', 'near_end_m', 'termination_extra_m', 'box_w_m', 'box_h_m'];
      for (const k of keys) if (typeof c[k] === 'number' && c[k] < 0) return no_('non_negative_lengths_and_gaps', k + ' is ' + c[k] + '. A length or a gap is never negative.');
      if (pitch <= 0) return no_('non_negative_lengths_and_gaps', 'the pitch is ' + rnd(pitch, 4) + ' m. Modules would overlap.');
      if (pair <= 0) return no_('non_negative_lengths_and_gaps', 'the lead pair left after the connector is ' + rnd(pair, 4) + ' m. A conductor is never shorter than nothing.');
      ok_('non_negative_lengths_and_gaps', 'every declared length, gap and conductor is zero or longer'); })();
    // 8
    (() => { const anyTurn = !!c.turn_every_second || !!c.turn_alternate_rows;
      if (!anyTurn) return ok_('rear_turn_needs_boxes_on_the_mid_line', 'no module is turned end for end, so the mid line question does not arise');
      if (Math.abs(fV0 - 0.5) > 0.01) return no_('rear_turn_needs_boxes_on_the_mid_line', 'turning a module end for end is refused: the lead boxes sit at ' + fV0.toFixed(3) + ' of the module length, not on the mid line at 0.500. Turn the module and the box line moves from ' + rnd(fV0 * c.module_height_m, 3) + ' m to ' + rnd((1 - fV0) * c.module_height_m, 3) + ' m across the row; the clip line would no longer meet it and every link would have to climb the module. Put the boxes on the mid line, or do not turn this class.');
      if (Math.round(+c.n_boxes) > 1 && Math.abs(fM0 + fP0 - 1) > 0.006) return no_('rear_turn_needs_boxes_on_the_mid_line', 'turning is refused: the minus and plus boxes are not symmetric about the module centre (' + fM0.toFixed(4) + ' + ' + fP0.toFixed(4) + ' = ' + (fM0 + fP0).toFixed(4) + ', not 1.0000). Turning alternate modules would then give two different link lengths instead of one, and the saving the turn is made for would not appear.');
      ok_('rear_turn_needs_boxes_on_the_mid_line', 'the lead boxes are on the mid line and symmetric about the module centre, so the turn is honest'); })();
    // 9
    (() => { if (stringVocCold > c.max_system_voltage_v)
        return no_('cold_voltage_limit', N + ' modules is beyond the cold voltage limit: at ' + c.t_min_c + ' C each module opens to ' + vocCold.toFixed(2) + ' V, so the string stands at ' + stringVocCold.toFixed(0) + ' V against a ' + c.max_system_voltage_v + ' V system. The most this class may take is ' + nMaxCold + '.');
      ok_('cold_voltage_limit', N + ' modules stand at ' + stringVocCold.toFixed(0) + ' V cold, inside the ' + c.max_system_voltage_v + ' V limit (the most is ' + nMaxCold + ')'); })();
    // 10 - outside the plausible range the engine does not refuse; it asks.
    const asks = [];
    const leadTyped = k => typed[k] !== undefined || (pre && pre.values[k] !== undefined);
    for (const k of Object.keys(PLAUSIBLE)) { const v = +c[k], d = PLAUSIBLE[k];
      if ((k === 'lead_minus_m' || k === 'lead_plus_m') && !leadTyped(k)) continue;   // a lead this command sized itself is not a typed value to question
      if (typeof c[k] !== 'number' || Number.isNaN(v) || (v >= d[0] && v <= d[1])) continue;
      let guess = null;
      for (const f2 of [[1000, 'you may have typed millimetres'], [100, 'you may have typed centimetres'], [0.001, 'you may have typed metres where this wants millimetres'], [0.01, 'a factor of 100 out']]) {
        const g = v / f2[0]; if (g >= d[0] && g <= d[1]) { guess = 'did you mean ' + rnd(g, 6) + ' ' + d[2] + '? (' + f2[1] + ')'; break; } }
      if (!guess) guess = 'a real site uses ' + d[0] + ' to ' + d[1] + ' ' + d[2];
      asks.push(k + ' = ' + v + ' ' + d[2] + ' is outside the plausible range ' + d[0] + ' to ' + d[1] + ' - ' + guess); }
    if (asks.length) no_('values_are_plausible', asks.join('; ')); else ok_('values_are_plausible', 'every value is inside its plausible range');
    // 11 - reported, not refused: an open string IS the honest answer about the leads, and it is drawn.
    if (short.length) no_('every_link_reaches', short.length + ' of ' + links.length + ' links do not reach with a lead pair of ' + rnd(pair, 3) + ' m. First: M' + short[0].from + '+ to M' + short[0].to + '− needs ' + rnd(short[0].need, 3) + ' m.');
    else ok_('every_link_reaches', 'every module to module link is made with the supplied leads, none stretched');
    const ASK_ONLY = ['values_are_plausible', 'every_link_reaches'];
    const refused = checks.filter(k => !k.ok && ASK_ONLY.indexOf(k.name) < 0);
    const asked = checks.filter(k => !k.ok && ASK_ONLY.indexOf(k.name) >= 0);
    return { c, N, pitch, pitchY, wX, wY, port, rows, cols, rowY, mount, high, faces, routing, leap, order, links,
             checks, refused, asked, vocCold, stringVocCold, nMaxCold, fM0, fP0, fV0, preset: pre ? String(typed.module_class) : '',
             row, pair, boxSpanM, lead_m, field_m, pairs, siteEnds, ohm, ohmLead, ohmSite, bothNear, endRun, ret,
             short, needs, smallest, jumpers, jumper_m, loop, arrayLoop, homeLoop, sep, saved, hot, fLead, fSite,
             minusPt, plusPt, minus, plus, rowOf, colOf, x0, y0, turned };
  }
  // ===== THE GUARD AT THE DOOR ===================================================================
  // Before a single coordinate is worked out, every value that was TYPED is read and measured. A
  // value that is not a number the engine can hold - nothing, empty, text that is not a number,
  // NaN, infinity - or a number outside what that input can mean, is answered in plain words and
  // NOTHING IS DRAWN. Same guard, same words, as LIB/solar-params/params.mjs validateAndCoerce.
  // Defaults and module-class presets are known good, so only what a person typed is examined.
  const GUARD_NUM = {
    modules:['modules in the string',1,60,1], n:['modules in the string',1,60,1],
    n_boxes:['junction boxes on the module',1,3,1], modules_high:['modules stacked up the table',1,6,1],
    cell_cols:['cells across the module',1,24,1], cell_rows:['cells up the module',1,80,1],
    cells_across:['cells across the module',1,24,1], cells_up:['cells up the module',1,80,1],
    cell_cut:['how many pieces each cell is cut into',1,4,1],
    width_m:['the short side of the module',0.2,2.5,0], module_width_m:['the short side of the module',0.2,2.5,0],
    module_height_m:['the long side of the module',0.2,4,0], module_length_m:['the long side of the module',0.2,4,0],
    box_spacing_m:['the spacing between the two junction boxes',0,2.5,0],
    gap_m:['the gap between modules along the row',0,1,0], gap_up_m:['the gap between tiers',0,1,0],
    ridge_gap_m:['the gap at the ridge',0,2,0], tube_gap_m:['the gap at the torque tube',0,2,0],
    lead_plus_m:['the plus lead',0,5,0], lead_minus_m:['the minus lead',0,5,0],
    lead_slack_m:['the slack allowed at a lead',0,2,0], slack_m:['the slack left at each link',0,2,0],
    lead_gap_m:['the spacing between the two leads',0,2,0], return_offset_m:['the return cable offset',0,5,0],
    lead_mm2:['the module lead cross-section',1,25,0], cable_mm2:['the site cable cross-section',1,400,0],
    near_end_m:['the home run',0,2000,0], home_run_m:['the home run',0,2000,0],
    home_separation_m:['how far apart the two home runs are laid',0,50,0],
    amps:['the string current',0,50,0], module_vmp:['the module voltage at maximum power',5,120,0],
    module_voc:['the open-circuit voltage of one module',5,120,0], voc_stc_v:['the open-circuit voltage of one module',5,120,0],
    t_lead_c:['the temperature of the module leads',-50,150,0], t_site_c:['the temperature of the site cable',-50,150,0],
    rating_c:['the temperature the cable is rated for',-50,150,0], conductor_c:['the conductor temperature',-50,150,0],
    t_min_c:['the coldest the site gets',-60,40,0], t_max_c:['the hottest the site gets',-20,70,0],
    max_system_voltage_v:['the system voltage',100,2000,0], contact_milliohm:['the resistance of one contact',0,100,0],
    tc_voc_pct_per_k:['how the open-circuit voltage moves with temperature',-1,0,0]
  };
  const GUARD_ENUM = {
    orientation:['which way up the module is laid',['portrait','landscape']],
    mounting:['how the modules are mounted',['fixed','tracker','east-west']],
    routing:['the wiring pattern',['','one-after-another','serpentine','leapfrog','zigzag']],
    wiring:['the wiring pattern',['sequential','leapfrog','one-after-another','serpentine','zigzag']]
  };
  const GUARD_SAID = v => v === undefined ? 'nothing' : v === null ? 'null'
    : typeof v === 'number' ? (isFinite(v) ? String(v) : (v !== v ? 'NaN (not a number)' : String(v)))
    : typeof v === 'string' ? (v === '' ? 'nothing at all' : 'the text "' + v + '"')
    : Array.isArray(v) ? 'a list of ' + v.length : 'a ' + typeof v;
  function guardTyped(inp) {
    const bad = [];
    if (inp !== undefined && inp !== null && (typeof inp !== 'object' || Array.isArray(inp)))
      return ['the settings must be given as a set of named values, like {"modules":30}; you typed ' + GUARD_SAID(inp)];
    const t = inp || {};
    for (const k in t) {
      if (!Object.prototype.hasOwnProperty.call(t, k)) continue;
      const v = t[k];
      if (GUARD_ENUM[k]) {
        const e = GUARD_ENUM[k];
        if (typeof v !== 'string' || e[1].indexOf(v) < 0)
          bad.push(e[0] + ' must be one of ' + e[1].filter(x => x !== '').map(x => '"' + x + '"').join(', ') + '; you typed ' + GUARD_SAID(v));
        continue;
      }
      const d = GUARD_NUM[k];
      if (!d) continue;
      if (v === null && (k === 'home_separation_m' || k === 'conductor_c' || k === 'lead_plus_m' || k === 'lead_minus_m')) continue;
      const x = (typeof v === 'number') ? v : (typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);
      if (!isFinite(x)) { bad.push(d[0] + ' must be a number; you typed ' + GUARD_SAID(v)); continue; }
      if (d[3] && Math.round(x) !== x) { bad.push(d[0] + ' must be a whole number from ' + d[1] + ' to ' + d[2] + '; you typed ' + GUARD_SAID(v)); continue; }
      if (x < d[1] || x > d[2]) bad.push(d[0] + ' must be ' + (d[3] ? 'a whole number' : 'a number') + ' from ' + d[1] + ' to ' + d[2] + '; you typed ' + GUARD_SAID(v));
    }
    return bad.slice(0, 6);
  }
  function run(inp) {
    const stopped = guardTyped(inp);
    if (stopped.length) {
      const words = stopped.join('; ') + '. Nothing is drawn until that is a number the engine can hold.';
      return { refused: true, string: null, connections: [],
               checks: [{ rule: 'inputs_are_numbers', name: 'inputs_are_numbers', ok: false, words: words }],
               numbers: { drawn: 'nothing', rules_broken: stopped.length, rule: 'inputs_are_numbers' },
               said: 'NOTHING IS DRAWN. ' + words,
               how: 'every value typed into this command is read and measured before a single coordinate is worked out. A value that is not a number, or a number outside what that input can mean, would put a NaN into the drawing, so it is refused in words instead. Change the input named above and fire again.',
               inputs_used: Object.assign({}, inp || {}) };
    }
    const g = build(inp), c = g.c, worst = g.short.length ? Math.max(...g.short.map(l => l.need - g.pair)) : 0;
    // A RULE THAT SAYS NO IS THE ANSWER. Nothing wrong is drawn: no string, no links, no numbers - the
    // rule's own words, and what to change. (LIB/solar-params RULES, 89 assertions behind them.)
    if (g.refused.length) {
      return { refused: true, string: null, connections: [], checks: g.checks,
               numbers: { drawn: 'nothing', rules_broken: g.refused.length, rule: g.refused[0].name },
               said: 'NOTHING IS DRAWN. ' + g.refused.map(k => k.words).join(' ')
                 + (g.asked.length ? ' Also: ' + g.asked.map(k => k.words).join('; ') + '.' : ''),
               how: 'the eleven sanity rules of the parameter library are checked before anything is drawn, and ' + g.refused.length + ' of them said no. A refusal is not a failure: it is the engine declining to draw something that could not be built. Change the input it names and fire again.',
               inputs_used: Object.assign({}, c) };
    }
    const askWords = g.asked.filter(k => k.name === 'values_are_plausible').map(k => k.words).join('; ');
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
    const said = (askWords ? 'CHECK THESE FIRST: ' + askWords + '. ' : '') + hotWords + name + ': ' + g.N + ' modules over ' + g.rows + (g.rows === 1 ? ' row' : ' rows') + ' of ' + g.cols + ', ' + g.links.length + ' links from ' + Math.min(...g.needs).toFixed(2) + ' to ' + Math.max(...g.needs).toFixed(2) + ' m against a lead pair of ' + g.pair.toFixed(2) + ' m; '
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
    return { connections, refused: false, checks: g.checks,
             numbers: { circuit: open ? 'OPEN, both ends live' : 'closed', current_a: rnd(amps, 2),
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
               + ' half cells, junction boxes ' + g.boxSpanM + ' m apart at mid height, a link is the distance between the boxes it joins; leads ' + c.lead_mm2 + ' mm2, site cable ' + c.cable_mm2
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
    { key:'view', label:'view', kind:'choice', choices:[['macro', 'macro: the whole string'], ['micro', 'micro: M1-M4, close'], ['scale', 'modules to scale']] },
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
    { key:'cell_cols', label:'cells across', kind:'number', min:1, max:24, step:1, group:'MODULE' },
    { key:'cell_rows', label:'cells up', kind:'number', min:2, max:48, step:2, group:'MODULE' },
    // ===== THE REST OF THE MODULE'S OWN CIRCUIT ====================================================
    // Every one of these was a constant in this file an hour ago. They come, with their groups, units,
    // defaults and limits, from LIB/solar-params (38 parameters, 11 rules, 89 assertions).
    { key:'module_class', label:'module class', kind:'choice', group:'MODULE', choices:[
      ['', 'whatever is typed below'],
      ['class-T660', 'T660: 2384 x 1303, 6 x 22 half cut, three boxes'],
      ['class-W760', 'W760: 2384 x 1303, 6 x 33 third cut, boxes near one end'],
      ['class-J-650', 'J-650: 2465 x 1134, 6 x 24 half cut, three boxes'],
      ['small-2011-single-box', '2011 type: 1650 x 990, 60 full cells, ONE box (no datasheet)']] },
    { key:'n_boxes', label:'junction boxes on the module', kind:'choice', group:'MODULE', choices:[[1, 'one, carrying both leads'], [3, 'three, the outer pair carrying the leads']] },
    { key:'half_cut', label:'laminate', kind:'choice', group:'MODULE', choices:[[0, 'whole cells'], [1, 'two parallel halves']] },
    { key:'cell_cut', label:'cells per column strip', kind:'number', group:'MODULE', min:1, max:4, step:1, hint:'1 full, 2 half, 3 third' },
    { key:'box_along_frac', label:'box line along the module', unit:'frac', kind:'number', group:'MODULE', min:0, max:1, step:0.001,
      hint:'0.5 is the transverse centre line; a class with its boxes near one end cannot be turned end for end' },
    { key:'box_across_frac_minus', label:'− box across the module', unit:'frac', kind:'number', group:'MODULE', min:0, max:1, step:0.0001, optional:true, hint:'blank takes it from the box spacing' },
    { key:'box_across_frac_plus', label:'+ box across the module', unit:'frac', kind:'number', group:'MODULE', min:0, max:1, step:0.0001, optional:true },
    { key:'box_w_m', label:'box width', unit:'m', kind:'number', group:'MODULE', min:0.005, max:0.3, step:0.001 },
    { key:'box_h_m', label:'box height', unit:'m', kind:'number', group:'MODULE', min:0.005, max:0.3, step:0.001 },
    { key:'connector_pair_m', label:'a mated pair eats', unit:'m', kind:'number', group:'MODULE', min:0, max:0.3, step:0.005, hint:'the library assumes 0.060; zero keeps the geometric case' },
    { key:'tc_voc_pct_per_k', label:'open circuit coefficient', unit:'%/K', kind:'number', group:'MODULE', min:-1, max:0, step:0.01 },
    { key:'max_system_voltage_v', label:'system voltage', unit:'V', kind:'choice', group:'MODULE', choices:[[1000, '1000'], [1500, '1500']] },
    { key:'table_length_modules', label:'table is this many modules long', kind:'number', group:'STRUCTURE', min:1, max:200, step:1 },
    { key:'gap_table_m', label:'gap at the table break', unit:'m', kind:'number', group:'STRUCTURE', min:0, max:20, step:0.01 },
    { key:'clip_offset_m', label:'clip line off the box line', unit:'m', kind:'number', group:'STRUCTURE', min:-2, max:2, step:0.01, hint:'the library assumes −0.120; zero is the straight geometric case' },
    { key:'route_allowance_m', label:'gland, bends and clip entry', unit:'m', kind:'number', group:'STRUCTURE', min:0, max:2, step:0.01, hint:'the library assumes 0.080' },
    { key:'home_run_from', label:'string ends collected at', kind:'choice', group:'HOME RUN', choices:[['start', 'the near end'], ['end', 'the far end']] },
    { key:'home_run_mm2', label:'home run size', unit:'mm2', kind:'choice', group:'HOME RUN', optional:true, choices:[[4, '4'], [6, '6'], [10, '10']] },
    { key:'termination_extra_m', label:'extra at each termination', unit:'m', kind:'number', group:'HOME RUN', min:0, max:20, step:0.1 },
    { key:'ohm_per_km_lead', label:'lead copper at 20 C', unit:'ohm/km', kind:'number', group:'CABLE', min:0.01, max:100, step:0.01, optional:true },
    { key:'ohm_per_km_site', label:'site copper at 20 C', unit:'ohm/km', kind:'number', group:'CABLE', min:0.01, max:100, step:0.01, optional:true },
    { key:'t_min_c', label:'coldest site temperature', unit:'C', kind:'number', group:'SITE', min:-60, max:40, step:1, hint:'it decides the longest string allowed' },
    { key:'t_max_c', label:'hottest site temperature', unit:'C', kind:'number', group:'SITE', min:-20, max:70, step:1 }
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
        'string is (2-1) x 1.25 x the bifacial current factor x Isc, which sits below the module reverse-current rating. ' +
        'STRING FUSES ARE NOT REQUIRED in this arrangement - but only on the parallel-string ' +
        'term. The inverter backfeed contribution is not published anywhere, so the verdict is ' +
        'conditional and the check is returned twice: once with the inputs blocking reverse ' +
        'current and once without.' },
    '6x5': { id:'6x5', label:'6 trackers x 5 inputs = 30 strings', trackers:6, inputs_per_tracker:5,
      inputs:30, A_per_tracker:75, A_per_input:30, Isc_per_tracker_A:125, strings_in_parallel_per_tracker:5,
      fuse_words:'STRING FUSES ARE REQUIRED in this arrangement. Five strings in parallel on one tracker ' +
        'drive (5-1) x 1.25 x the bifacial current factor x Isc into a faulted string - about 75 A on the default class - which ' +
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
        /* Leg 1 goes north out of the table to the middle of the inter-row gap, so the run
           travels ALONG the row end and never through the faces of the tables to its west. */
        const rowEndY = s.row * rowPitch + tableDepth + (rowPitch - tableDepth) / 2 + e.off;
        const pts = dedupe([[bx, by], [bx, r(rowEndY)], [r(gx), r(rowEndY)], [r(gx), r(ty)], [tx, ty]]);
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
    const faultNoBackfeed = (Np - 1) * I.design_current_factor * I.bifacial_factor * Isc;
    const countRuleFires = Np >= 3;
    const currentRuleFires = faultNoBackfeed > fuseRating;
    const fusesRequired = countRuleFires || currentRuleFires;
    const fuseRuleFired = countRuleFires ? (currentRuleFires ? 'count and current' : 'count') : (currentRuleFires ? 'current' : 'none');
    const backfeedUnconfirmed = I.inputs_block_reverse_current !== 'yes';
    const faultTerm = `(${Np} - 1) x ${I.design_current_factor} x ${I.bifacial_factor} x Isc = ${r(faultNoBackfeed, 2)} A`;
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
    const faultOther = (otherArr.strings_in_parallel_per_tracker - 1) * I.design_current_factor * I.bifacial_factor * Isc;
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
      faultNoBackfeed <= fuseRating ? 'pass' : 'fail', st('module_max_series_fuse_A', 'design_current_factor', 'bifacial_factor'),
      `(${Np} - 1) x ${I.design_current_factor} x ${I.bifacial_factor} x Isc against the ${fuseRating} A module maximum series fuse rating; rule fired: ${fuseRuleFired}`);
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
        'Every home run is a four-leg orthogonal route: out of the table to the inter-row gap, ' +
        'along the row end, up the gathering corridor, then onto its own named inverter input terminal.',
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
    const S = Math.min(1.85 / Math.max(0.5, y1 - y0), 1.90 / Math.max(0.5, x1 - x0));
    const my = (y0 + y1) / 2, mx = (x0 + x1) / 2;
    const U = (x, y) => [(x - mx) * S, (y - my) * S];
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
  // THE COPY DECLARES WHAT IT IS A COPY OF. The 380 lines above are a verbatim carry of
  // LIB/solar-block/block.mjs; nothing here runs that library's own tests, so the one thing that can be
  // checked cheaply is that the copy and the library still name the same version. COPIED_FROM is that
  // declaration, and the CI proof compares it with VERSION in block.mjs, so silent drift is caught.
  const COPIED_FROM = 'solar-block/1.0.0';
  F.block = { buildBlock, blockDrawing, INPUTS, DEFAULTS, MODULE_CLASSES, ARRANGEMENTS, INVERTER_CLASS, COPIED_FROM };
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
const FIRE_SLD_KIND = (typeof window !== 'undefined' ? window : globalThis).FIRE_SLD_KIND ||
  ((typeof window !== 'undefined' ? window : globalThis).FIRE_SLD_KIND = { 'string':'string', 'block':'string' });
// A PROGRAM REGISTERS ITS OWN KIND. Adding a command that draws a single-line diagram means one entry in
// FIRE_SLD_KIND written by the program itself, not a widened chain here, so two bands never edit one line.
const FIRE_DRAWN_ALWAYS = ['site-pulse', 'network'];     // the two the dots draw that carry no sld kind
const FIRE_DRAWS = { includes: n => FIRE_DRAWN_ALWAYS.includes(n) || Object.prototype.hasOwnProperty.call(FIRE_SLD_KIND, n) };
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
    + '#saybody .values td{text-align:left;vertical-align:top}'
    + '#saybody .values tr.bad td{color:#ffb454;font-weight:600}'
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
    + '#saybody .values tr,#saybody .values td{display:block;width:auto}'
    + '#saybody .values td{border-bottom:0;padding:1px 0}'
    + '#saybody .values tr{border-bottom:1px solid #1b2030;padding:4px 0}'
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
    // THE TWO VIEWS ARE TWO WORDS. Typing "macro" or "micro" moves the camera of a drawing already on
    // the screen and changes nothing else; if no string is drawn, the word fires one and it opens there.
    if (/^macro$/i.test(q) || /^micro$/i.test(q)) { const want = q.toLowerCase();
      pin.value = '';
      if (typeof sldShapes !== 'undefined' && sldShapes && sldShapes.g) {
        try { sldShapes.g.c.view = want; if (want === 'macro') stringWholeView(); else stringNearView(); } catch (_) {}
        return; }
      fireCommand('fire string {"view":"' + want + '"}', null); return; }
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
      for (const [words, go] of [['macro: the whole string', () => stringWholeView()], ['micro: M1-M4', () => stringNearView()],
        ['the modules to scale', () => reFire({ view:'scale' })], ['back to the wiring', () => reFire({ view:'macro' })]]) {
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
    if (FIRE_DRAWS.includes(out.name)) {
      // THE BLOCK IS DRAWN BY THE SAME PASS AS THE STRING. Its drawing is already made and carried on
      // out.block.__draw, so it is handed over as the same kind and nothing downstream changes.
      fp.sld = FIRE_SLD_KIND[out.name] ? { kind:FIRE_SLD_KIND[out.name], g:(out[out.name] || out.string || out.block) } : out.name === 'network' ? { kind:'network', net:out.net, solved:out.solved, inputs:c0(text) } : c0(text);
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
  // MICRO IS FOUR MODULES, and it is four on a telephone and four on a desk: the view is named by what
  // it shows, not by how much of the screen happens to be free. M1 to M4 across the band, with a hair
  // of margin so the fourth module is not cut by the edge.
  const wantM = 4.06 * D.g.pitch;
  const zW = (b.right - b.left) * 0.97 / (wantM * D.perM * R * f);
  const z = Math.max(1e-9, Math.min(zH, zW));
  const firstX = D.firstModuleX !== undefined ? D.firstModuleX : D.near.x;
  flyTo(firstX * R * f - (b.left + 6 - innerWidth / 2) / z,
        (D.bounds.y0 + D.bounds.y1) / 2 * R * f + ((b.top + b.bottom) / 2 - innerHeight / 2) / z, z);
}
// WHICH VIEW THE DRAWING OPENS IN IS THE DECLARED INPUT, and nothing else decides it: `view` says macro
// or micro, its default is micro on a telephone and macro on a desk, and the two typed words set it.
function stringViewWord(D){ const c = D && D.g && D.g.c; const v = String((c && c.view) || '').toLowerCase();
  if (v === 'macro' || v === 'micro') return v;
  return (innerWidth < 700) ? 'micro' : 'macro'; }
function stringOpenView(){ const D = sldShapes; if (!D || D.opened) return; D.opened = true;
  stringPlaceView(stringViewSpanM(), stringViewWord(D) === 'macro'); }
function stringWholeView(){ stringPlaceView(0, true); }      // MACRO: the whole string, fitted to the width
function stringNearView(){ const D = sldShapes; if (!D) return; stringPlaceView(stringViewSpanM(), false); }
// THE MICRO END HAS A FLOOR UNDER IT. Going in is going in until the module you are reading fills the
// band - and then it stops. Past that point the wheel only cuts the thing you came to look at: the top
// of the module goes off the top of the band, the bottom off the bottom, and the reader is left with a
// slab of glass and no edges to hold on to. So the camera is CLAMPED. One module, whole, inside the
// band, is the closest the drawing will go; and when the clamp bites the module under the middle of
// the screen is also brought to the middle of the band, so what stops is centred and not half gone.
function stringClampMicro(){
  const D = sldShapes; if (!D || !D.shapes || typeof flyTo !== 'function' || typeof zoom !== 'number') return;
  const R = Math.sqrt(SPACE), f = BODY_RADIUS_MAX, b = shapeBand(true);
  let hU = 0, wU = 0;
  for (const s of D.shapes) { if (s.role !== 'module' || !s.pts || s.pts.length < 2) continue;
    let y0 = 1e9, y1 = -1e9, x0 = 1e9, x1 = -1e9;
    for (const p of s.pts) { if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1];
      if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; }
    hU = Math.max(hU, y1 - y0); wU = Math.max(wU, x1 - x0); break; }
  if (!(hU > 0) || !(wU > 0)) return;
  const zMax = Math.min((b.bottom - b.top) * 0.90 / (hU * R * f), (b.right - b.left) * 0.90 / (wU * R * f));
  if (!(zMax > 0)) return;
  const zUse = Math.min(zoom, zMax);
  // the module nearest the middle of the screen is the one the reader is on; centre it in the band
  const midX = innerWidth / 2, midY = (b.top + b.bottom) / 2;
  let best = null, bd = 1e18;
  for (const s of D.shapes) { if (s.role !== 'module' || !s.pts || s.pts.length < 2) continue;
    let y0 = 1e9, y1 = -1e9, x0 = 1e9, x1 = -1e9;
    for (const p of s.pts) { const q = shapePoint(p);
      if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; }
    const dx = (x0 + x1) / 2 - midX, dy = (y0 + y1) / 2 - midY, d2 = dx * dx + dy * dy;
    if (d2 < bd) { bd = d2; best = s; } }
  if (!best) return;
  // ONLY WHEN IT IS ACTUALLY CUT. The clamp is not a rule about zoom, it is a rule about the module
  // the reader is on: if that module already sits whole inside the band at the zoom in hand, nothing
  // moves. It moves when the module is too big for the band, or when it fits and is simply hanging
  // over an edge - and then the same move fixes both, because the module is put in the middle.
  let sx0 = 1e9, sx1 = -1e9, sy0 = 1e9, sy1 = -1e9;
  for (const p of best.pts) { const q = shapePoint(p);
    if (q[0] < sx0) sx0 = q[0]; if (q[0] > sx1) sx1 = q[0]; if (q[1] < sy0) sy0 = q[1]; if (q[1] > sy1) sy1 = q[1]; }
  const inside = sx0 >= b.left && sx1 <= b.right && sy0 >= b.top && sy1 <= b.bottom;
  if (inside && zoom <= zMax * 1.02) return;
  let ux0 = 1e9, ux1 = -1e9, uy0 = 1e9, uy1 = -1e9;
  for (const p of best.pts) { if (p[0] < ux0) ux0 = p[0]; if (p[0] > ux1) ux1 = p[0];
    if (p[1] < uy0) uy0 = p[1]; if (p[1] > uy1) uy1 = p[1]; }
  const xc = (ux0 + ux1) / 2 * R * f, yc = (uy0 + uy1) / 2 * R * f;
  flyTo(xc - (midX - innerWidth / 2) / zUse, yc + (midY - innerHeight / 2) / zUse, zUse);
}
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
  const viewWord = String(c.view === undefined || c.view === null || c.view === '' ? 'macro' : c.view).toLowerCase();
  const wiring = viewWord !== 'scale';
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
    // ONE BOX OR THREE, as the module class declares. With one box the minus and plus points are the
    // same point (rule 2 holds |fP0 - fM0| <= 1e-6), so drawing three would stack them: draw the one
    // box, and put the two signs inside it, one either side of its centre, since both leads leave it.
    const oneBox = Math.round(+c.n_boxes) === 1;
    const midPt = [(g.minusPt(k)[0] + g.plusPt(k)[0]) / 2, (g.minusPt(k)[1] + g.plusPt(k)[1]) / 2];
    box('box', o, midPt[0] - boxW / 2, midPt[1] - boxH / 2, midPt[0] + boxW / 2, midPt[1] + boxH / 2,
      { fill:'#060a10', node:'M' + k, weight:1, big:wiring, diodeOnly:!oneBox, diode:oneBox });
    for (const [pt, sign] of [[g.minusPt(k), '−'], [g.plusPt(k), '+']]) {
      if (!oneBox) box('box', o, pt[0] - boxW / 2, pt[1] - boxH / 2, pt[0] + boxW / 2, pt[1] + boxH / 2,
        { fill:'#060a10', node:'M' + k, weight:1, big:wiring, diode:true });
      term('M' + k + (sign === '+' ? '+' : '-'), pt[0], pt[1], sign === '+' ? 'module+' : 'module-', k);
      const away = sign === '+' ? 1 : -1;
      marks.push(oneBox
        ? { x:pt[0] + (port ? away * boxW * 0.26 : 0), y:pt[1] + (port ? 0 : away * boxH * 0.26),
            text:sign, size:11, colour:sign === '+' ? SHAPE_RED : SHAPE_INK, minPx:22, mid:true, rank:0 }
        : { x:pt[0] + (port ? 0 : boxW * 0.5 + 0.17), y:pt[1] - (port ? boxH / 2 + 0.17 : 0),
            text:sign, size:11, colour:sign === '+' ? SHAPE_RED : SHAPE_INK, minPx:22, mid:port, rank:0 }); }
    marks.push({ x:(x0 + x1) / 2, y:yb - 0.34, text:'M' + k, size:11, colour:SHAPE_INK, minPx:18, mid:true, rank:0, dodge:true });
    if (turned(k)) marks.push({ x:(x0 + x1) / 2, y:yb - 0.62, text:'rear', size:9, colour:SHAPE_EDGE, minPx:60, mid:true, dodge:true, rank:3 });
    // THE MACRO WORDS. Zoomed out to the whole string every name is a grey tick and thirty of them are a
    // smear, so at that distance FIVE words are written and no others: M1, M10, M20, M30 and the
    // inverter. They are the same names, written larger and never shrunk - a word too small to read is
    // dropped, not drawn faint - and they are a separate mark so that the near names can carry on being
    // dropped by their own rule. 9 px is the floor for any word on this drawing.
    if (k === 1 || k % 10 === 0)
      marks.push({ x:(x0 + x1) / 2, y:yb - 0.34, text:'M' + k, size:11, colour:SHAPE_INK, minPx:0, mid:true, macro:true, rank:0 });
  }
  marks.push({ x:(invX0 + invX1) / 2, y:invY0 - 0.60, text:'inverter', size:11, colour:SHAPE_EDGE, minPx:0, mid:true, macro:true, rank:0 });
  // WHAT HOLDS THE TABLE UP, where it changes the geometry: the ridge of an east west table and the
  // torque tube of a tracker are each drawn as the one fine line they are.
  for (let r = 0; r + 1 < rows; r++) { const gapTop = g.rowY[r + 1], gapBot = g.rowY[r] + wY;
    if (gapTop - gapBot > c.gap_up_m + 1e-6) poly('tube', 0, [[-0.4, (gapTop + gapBot) / 2], [g.row + 0.2, (gapTop + gapBot) / 2]], { node:'tube' }); }

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
      // AT MACRO DISTANCE A CABLE IS ONE LINE. The casing and the centre line are what let a cable read
      // over a cell grid up close; zoomed out to the whole string there is no cell grid, the casing is
      // wider than the run is long, and thirty modules of cable turn into a band of grey. So below the
      // zoom at which a module is about twenty pixels wide, each conductor is a single thin stroke in
      // its own colour - black or red, which is the one thing that must survive - and it thickens back
      // into the near treatment over a short band of zoom rather than snapping.
      const thinAt = 16, fullAt = 34;                                  // screen pixels to one metre
      if (perM < fullAt) {
        const t2 = Math.max(0, Math.min(1, (perM - thinAt) / (fullAt - thinAt)));
        const ink2 = lit ? '#eaf6ff' : s.open ? SHAPE_WARN : (s.plus ? (SHEET ? '#c0271a' : '#ff4b3a') : (SHEET ? '#6f7887' : '#9fb0c4'));
        if (t2 > 0.02) { path(s.pts); ctx.lineWidth = 1 + 3.0 * t2; ctx.strokeStyle = SHEET ? '#f2f4f7' : '#05070b'; ctx.stroke(); }
        path(s.pts); ctx.lineWidth = 1 + 0.5 * t2; ctx.strokeStyle = ink2; ctx.stroke();
        continue; }
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
      // A BOX TOO SMALL TO BE A BOX IS A DOT, NOT A SMALLER BOX. Under six pixels across, a rectangle
      // with an outline and a fill is three grey pixels that say nothing; what a reader wants at that
      // distance is only WHERE the boxes are, so one dot is drawn and the box itself is dropped. This is
      // the macro rule and it is crossed by zooming, not by the word: pinch in and the dots become boxes
      // at the same threshold either way.
      { const aa = S(s.pts[0]), bb2 = S(s.pts[2]);
        const bpx = Math.min(Math.abs(bb2[0] - aa[0]), Math.abs(bb2[1] - aa[1]));
        if (bpx < 6) { const cx2 = (aa[0] + bb2[0]) / 2, cy2 = (aa[1] + bb2[1]) / 2;
          ctx.beginPath(); ctx.arc(Math.round(cx2), Math.round(cy2), 1.3, 0, 6.2832);
          ctx.fillStyle = SHEET ? '#55606e' : SHAPE_PENCIL; ctx.fill(); continue; } }
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
  // NO WORD IS EVER SHRUNK. Nine pixels is the floor for a word on this drawing: under it the word is
  // not written at all. The MACRO words - M1, M10, M20, M30 and the inverter - are the only ones
  // written when the whole string is on the screen, and they fade out as the near names fade in, so
  // pinching from one view to the other is a change of what is worth saying and not a flicker.
  const MACRO_OFF = 46;
  // A WORD IS PAINTED IN THE GLASS'S OWN PIXELS. The rest of the drawing is laid out in css px on a
  // layer scaled by the device ratio, which is right for a line: a hairline stays a hairline. A word is
  // not a line. A word has one true size - the size it arrives at the eye - and that size is counted in
  // the pixels the panel actually has. So for the marks alone the layer's scale is dropped, the word is
  // asked for at its css size times the device ratio, and it lands where it would have landed anyway.
  // The floor is then the floor the reader sees: NINE CSS PIXELS, in this one place, and under it the
  // word is not written at all. Dropped, never shrunk - a word too small to read is worse than none.
  const TEXT_FLOOR_PX = 9;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (const [m] of order2) {
    const sizeCss = m.size || 11;
    if (sizeCss < TEXT_FLOOR_PX) continue;
    if (m.macro) { if (perM > MACRO_OFF) continue; }
    else if (perM < (m.minPx || 0)) continue;
    const p = S([m.x, m.y]); if (p[0] < -40 || p[0] > innerWidth + 40 || p[1] < -20 || p[1] > innerHeight + 20) continue;
    ctx.globalAlpha = m.macro ? Math.max(0, Math.min(1, (MACRO_OFF - perM) / 12)) : 1;
    ctx.font = '600 ' + (sizeCss * dpr) + 'px ui-monospace,Menlo,Consolas,monospace';
    const px = Math.round(p[0] * dpr), py = Math.round(p[1] * dpr);
    const w2 = ctx.measureText(m.text).width, h2 = (sizeCss + 3) * dpr;
    const x0 = px - (m.mid ? w2 / 2 : 0), y0 = py - h2 / 2;
    const box2 = [x0 - dpr, y0, x0 + w2 + dpr, y0 + h2];
    if (m.dodge) { let clash = false;
      for (const q of placed) if (box2[0] < q[2] && box2[2] > q[0] && box2[1] < q[3] && box2[3] > q[1]) { clash = true; break; }
      if (clash) continue; }
    placed.push(box2);
    ctx.textAlign = m.mid ? 'center' : 'left';
    ctx.fillStyle = SHEET ? (m.colour === SHAPE_RED ? '#b3271a' : m.colour === SHAPE_WARN ? '#8a6100' : '#10151c') : m.colour;
    ctx.fillText(m.text, px, py); }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = 1;
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
try { if (window.__wafer && window.__wafer.onDraw) window.__wafer.onDraw.add(function(){ try { stringClampMicro(); placeSldNames(); drawSldShapes(); } catch (_) {} }); } catch (_) {}
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
