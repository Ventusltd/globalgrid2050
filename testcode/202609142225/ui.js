/* Star Generator — ui.js: the shell (GRAMMAR §3 parts, §4 actions, §5 URL, §6 compose, §8 mobile).
 * One DOM order on every lens and both widths. Four verbs, one implementation each. Lenses only lay out.
 */
import { core, U, state, REL, REL_WORDS, KIND, PAL, CLS, CLS_WORD, LENSES, STARS, $, el, esc, fmt, stamp, shortUtc, loadUniverse, loadNames, loadPack, family, familyLines, familyLinks, famName, pageList, trailPush, trailVisits, writeQuery, readQuery, buildGrid, pick, footerText } from './core.js';
import { createGL, draw2D, SEG_STRIDE } from './gl.js';
import ring from './lenses/ring.js';
import particle from './lenses/particle.js';
import chord from './lenses/chord.js';
import river from './lenses/river.js';
import table from './lenses/table.js';
import column from './lenses/column.js';

const lenses = { ring, particle, chord, river, table, column };
const PAGE_ID = 'star-generator 202609142225';
let lens = null, G = null, grid = null, lit = null, view = null, target = null, edgeBuf = new Float32Array(4000 * SEG_STRIDE), geomBuf = null, journeyBuf = new Float32Array(64 * SEG_STRIDE);
let notes = [], labelSpans = new Map(), labelCands = new Uint32Array(0), tweenFrom = null, panelIdx = -1, panelKey = null, panelMeasured = false, hoverIdx = -1;
const D = {};   // DOM refs

/* ================= boot ================= */
(async function boot() {
  for (const id of ['count', 'search', 'trail', 'legend', 'stage', 'gl', 'labels', 'overlay', 'tip', 'hint', 'panel', 'panel-handle', 'panel-body', 'panel-foot', 'lensbar', 'tray', 'sheet', 'footer']) D[id] = document.getElementById(id);
  try { await loadUniverse(); } catch (e) { D.count.textContent = 'live data not loaded'; return failBox(e); }
  D.count.textContent = core.countsLine();
  lit = new Uint8Array(core.N); target = new Float32Array(2 * core.N);
  G = createGL(D.gl, core);
  if (!G.ok) notes.push('GPU not available: drawn without animation');
  for (const [id, L] of Object.entries(lenses)) { if (L.id !== id) throw new Error(`lens ${id} declares id ${L.id}`); }
  mountSearch(); renderLegend(); renderLensbar(); renderTray(); renderTrail(); D.footer.textContent = footerText(PAGE_ID, null);
  mountGestures(); mountKeys(); mountPanelSheet();
  window.__star = { core, state, G, get lens() { return lens; }, get view() { return view; }, get target() { return target; }, get geomBuf() { return geomBuf; }, get edgeBuf() { return edgeBuf; }, recipeJSON: () => recipeJSON(), handOffURL: () => handOffURL(), needsOutside: () => needsOutside() };   // read-only inspection for the proof scripts
  applyQuery(readQuery(), false);
  history.replaceState(null, '', writeQuery(state));
  addEventListener('popstate', () => applyQuery(readQuery(), true));
  addEventListener('resize', () => relayout('resize'));
  requestAnimationFrame(frame);
  loadNames().then(() => { refreshLabels(); if (panelIdx >= 0) renderPanel(panelIdx, panelKey, panelMeasured); }).catch(() => {});
  loadPack().then(onPack).catch(e => notes.push(`pack not loaded: ${e.message}`) && renderFooter());
})();
function failBox(e) { D.stage.prepend(el('div', { class: 'u-fail' }, `Could not load live data: ${e.message}. Check the internet connection and reload.`)); }
function onPack(ps) {
  D.count.title = core.countsTitle(); G.setMass && G.setMass();
  if (G.ok) { const ord = new Float32Array(core.lineKey.length); let f = 0xffffffff, k = 0; for (let i = 0; i < ord.length; i++) { if (core.lineFam[i] !== f) { f = core.lineFam[i]; k = 0; } ord[i] = k++; } G.setLines(core.lineFam, ord, core.lineShared); }
  if (ps && ps.orphans) notes.push(`pack: ${fmt(ps.orphans)} families not in the live index (their lines are not drawn)`);   // gl.js skips lineFam 0xffffffff; the footer says so
  renderLegend(); renderFooter(); refreshLabels(); computeLit(); renderTray(); relayout('pack');
  if (panelIdx >= 0) renderPanel(panelIdx, panelKey, panelMeasured);
}
function renderFooter() { D.footer.textContent = footerText(PAGE_ID, lens) + (G && G.litOnly ? ' · edges drawn: lit only' : '') + (notes.length ? ' · ' + notes.join(' · ') : ''); }

/* ================= view + lit ================= */
function isMobile() { return innerWidth <= 600; }
function openBlockOf(idx) { if (idx < 0) return -1; const c = core.cls[idx]; if (c === 2 || c === 3) return idx; if (c === 4) return core.parent[idx]; return -1; }
function computeLit() {
  lit.fill(0);
  const f = state.focus;
  if (f >= 0) { lit[f] |= 2; for (const n of core.edgesOf(f, -1, 'both', state.kindsOn)) lit[n] |= 1; const o = openBlockOf(f); if (o >= 0 && o !== f) lit[o] |= 1; }
  for (const t of state.trail) lit[t] |= 8;
  for (const k of state.recipe) { const i = recipeEntity(k); if (i >= 0) lit[i] |= 4; }
  for (const b of recipeBlocks()) { lit[b] |= 4; for (const n of core.edgesOf(b, 1, 'out')) lit[n] |= 1; }   // the block that will travel wears the ring too (a family's block is derived, and shown as such)
  if (state.measure >= 0) lit[state.measure] |= 16;
  if (state.cat >= 0) for (let i = core.range.block[0]; i < core.N; i++) if (core.cat[i] !== state.cat) lit[i] |= 32;   // category dim filter: light, never colour
  if (G) G.setLit(lit);
}
function makeView() {
  const r = D.stage.getBoundingClientRect();
  const direct = state.recipe.map(recipeEntity).filter(i => i >= 0), derived = recipeBlocks().filter(b => !direct.includes(b));
  view = { focus: state.focus, focusKey: state.focusKey || (state.focus >= 0 ? core.keyStr[state.focus] : null), open: openBlockOf(state.focus), measure: state.measure, lit, trail: Uint32Array.from(state.trail), recipe: Uint32Array.from([...direct, ...derived]), recipeDerived: Uint32Array.from(derived), kindsOn: state.kindsOn, cat: state.cat, w: r.width, h: r.height, mobile: isMobile(), dpr: Math.min(2, devicePixelRatio || 1), params: view ? view.params : {}, famRec: state.focus >= 0 ? core.famRec[state.focus] : null, lineKey: state.focusKey && state.focusKey.startsWith('line:') ? +state.focusKey.slice(5) : null };
  return view;
}

/* ================= layout, edges, geometry, journey, grid ================= */
function relayout(reason) {
  if (!lens) return;
  makeView();
  if (G.ok) G.resize(view.w, view.h, view.dpr); else { D.gl.width = view.w * view.dpr; D.gl.height = view.h * view.dpr; G.w = view.w; G.h = view.h; G.dpr = view.dpr; }
  view.params = lens.simplify ? (lens.simplify(view.w) || {}) : {};
  if (lens.overlay) { D.overlay.hidden = false; lens.overlay(core, view, D.overlay, shell); } else { D.overlay.hidden = true; D.overlay.innerHTML = ''; }
  target.fill(NaN);
  const t0 = performance.now(); const res = lens.layout(core, view, target) || {}; const ms = performance.now() - t0;
  // registration check: a class the lens anchors unconditionally (lens.always) must have positions; focus-dependent classes may be NaN
  for (const c of lens.always || []) { const [lo, hi] = core.range[c === 'category' ? 'cat' : c]; let k = 0, any = false; for (let i = lo; i < hi; i++) { if (target[2 * i] !== target[2 * i]) k++; else any = true; } if (!any && hi > lo) throw new Error(`lens ${lens.id} left ${k} ${c} entities unanchored`); }
  lens._layoutMs = ms; lens._home = res.home || { pan: [0, 0], zoom: 1, rotate: 0 }; lens._bounds = res.bounds || [0, 0, view.w, view.h];
  if (G.ok) { G.setPositions(target); if (res.orbit) { const orb = new Float32Array(2 * core.N).fill(-1); const fams = core.familiesOf(res.orbit.parent); const rings = res.orbit.rings || 4, per = Math.ceil(fams.length / rings) || 1; fams.forEach((f, k) => { orb[2 * f] = k % rings; orb[2 * f + 1] = 2 * Math.PI * (Math.floor(k / rings) / per); }); G.setOrbit(orb, true); lens._orb = orb; } else { G.setOrbit(new Float32Array(2 * core.N).fill(-1), false); lens._orb = null; } }
  else G.posB.set(target);
  if (reason === 'lens' || reason === 'home' || reason === 'refresh') { G.view = { pan: [...lens._home.pan], zoom: lens._home.zoom, rotate: lens._home.rotate }; G.geomFade = 0; }
  else if (res.home && res.home.rotate != null && lens.camera && lens.camera(view).rotate) G.view.rotate = res.home.rotate;
  else if (res.home && res.follow && reason === 'navigate') G.view.pan = [...res.home.pan];   // a lens that follows the focus along one axis (river) moves its camera on navigate
  view.pos = target;
  gatherEdges(); gatherGeometry(); gatherJourney();
  grid = buildGrid(target, core.N);
  labelCands = lens.labels(core, view, view.mobile ? 24 : 60) || new Uint32Array(0);
  D.hint.textContent = lens.hint(core, view);
  renderFooter();
  if (!G.ok) draw2D(G, core, edgeBuf, G.edgeCount);
}
function ctrl(mode, bow, ax, ay, bx, by, cx, cy) {
  if (mode === 'centre') return [cx, cy];
  if (mode === 'bow') { const mx = (ax + bx) / 2, my = (ay + by) / 2, dx = bx - ax, dy = by - ay; return [mx - dy * bow, my + dx * bow]; }
  return [(ax + bx) / 2, (ay + by) / 2];
}
function gatherEdges() {
  const E = lens.edges(core, view) || { a: [], b: [] }; const n = Math.min(E.a.length, 4000); if (edgeBuf.length < n * SEG_STRIDE) edgeBuf = new Float32Array(n * SEG_STRIDE);
  const cv = lens.curve || { mode: 'straight' }, cx = view.w / 2, cy = view.h / 2; let k = 0;
  for (let e = 0; e < n; e++) {
    const a = E.a[e], b = E.b[e], kind = E.kind ? E.kind[e] : 0, cls = E.cls ? E.cls[e] : 2, w = E.w ? E.w[e] : 1;
    const ax0 = G.posA[2 * a], ay0 = G.posA[2 * a + 1], bx0 = G.posA[2 * b], by0 = G.posA[2 * b + 1], ax1 = target[2 * a], ay1 = target[2 * a + 1], bx1 = target[2 * b], by1 = target[2 * b + 1];
    if (ax1 !== ax1 || bx1 !== bx1) continue;
    const c0 = ctrl(cv.mode, cv.bow || 0, ax0 !== ax0 ? ax1 : ax0, ay0 !== ay0 ? ay1 : ay0, bx0 !== bx0 ? bx1 : bx0, by0 !== by0 ? by1 : by0, cx, cy), c1 = ctrl(cv.mode, cv.bow || 0, ax1, ay1, bx1, by1, cx, cy);
    const light = cls === 2 ? Math.max(0.6, (lit[a] & 2 || lit[b] & 2) ? 1 : 0.8) : 1;
    const width = cls === 2 ? (kind === 1 || kind === 3 ? 2 : Math.min(3, 1.2 + 0.2 * Math.log2(1 + w))) : 1;
    const flags = (kind === 1 || kind === 2 || kind === 3) ? 2 : 0;
    edgeBuf.set([ax0 !== ax0 ? ax1 : ax0, ay0 !== ay0 ? ay1 : ay0, bx0 !== bx0 ? bx1 : bx0, by0 !== by0 ? by1 : by0, c0[0], c0[1], ax1, ay1, bx1, by1, c1[0], c1[1], width, kind, light, cls, flags], k * SEG_STRIDE); k++;
  }
  G.edgeCount = k; if (G.ok) G.setEdges(edgeBuf, k);
}
function gatherGeometry() {
  const g = lens.geometry ? lens.geometry(core, view) : null; const n = g ? Math.floor(g.length / 9) : 0;
  if (!geomBuf || geomBuf.length < n * SEG_STRIDE) geomBuf = new Float32Array(Math.max(1, n) * SEG_STRIDE);
  for (let i = 0; i < n; i++) { const o = i * 9; geomBuf.set([g[o], g[o + 1], g[o + 4], g[o + 5], g[o + 2], g[o + 3], g[o], g[o + 1], g[o + 4], g[o + 5], g[o + 2], g[o + 3], g[o + 6], g[o + 7], 1, g[o + 8], 1 | (g[o + 8] >= 3 ? 8 : 0)], i * SEG_STRIDE); }
  if (G.ok) G.setGeometry(geomBuf, n); G.geomCount = n;
}
function gatherJourney() {
  const t = state.trail; let k = 0; if (journeyBuf.length < (t.length + 1) * SEG_STRIDE) journeyBuf = new Float32Array((t.length + 1) * SEG_STRIDE);
  let px = NaN, py = NaN, pax = NaN, pay = NaN;
  for (const i of t) { const x = target[2 * i], y = target[2 * i + 1]; if (x !== x) continue; let ax = G.posA[2 * i], ay = G.posA[2 * i + 1]; if (ax !== ax) { ax = x; ay = y; } if (px === px) { journeyBuf.set([pax, pay, ax, ay, (pax + ax) / 2, (pay + ay) / 2, px, py, x, y, (px + x) / 2, (py + y) / 2, 1, 7, 1, 2, 0], k * SEG_STRIDE); k++; } px = x; py = y; pax = ax; pay = ay; }
  if (G.ok) G.setJourney(journeyBuf, k); G.journeyCount = k;
}

/* ================= frame loop, labels, tooltip ================= */
function frame() {
  if (G.ok) { G.frame(); if (G.geomFade < 1) G.geomFade = Math.min(1, G.geomFade + 0.05); placeLabels(); }
  requestAnimationFrame(frame);
}
function refreshLabels() { for (const [i, s] of labelSpans) s.textContent = core.short(i); }
function placeLabels() {
  const used = new Set(), rects = [], order = [];
  if (state.focus >= 0) order.push(state.focus); for (const t of state.trail) if (!order.includes(t)) order.push(t); for (const i of labelCands) if (!order.includes(i)) order.push(i);
  const max = view.mobile ? 24 : 60; let placed = 0;
  for (const i of order) {
    if (placed >= max) break; const p = G.curPos(i); if (!p) continue; let [x, y] = G.toScreen(p[0], p[1]);
    if (lens._orb && lens._orb[2 * i] >= 0) { const ring = lens._orb[2 * i], ang = lens._orb[2 * i + 1] + ((performance.now() - G.time0) / 1000) * 0.25 / (ring + 1); x += Math.cos(ang) * (16 + ring * 18) * G.view.zoom; y += Math.sin(ang) * (16 + ring * 18) * G.view.zoom; }
    if (x < -40 || y < -10 || x > view.w + 40 || y > view.h + 10) continue;
    const text = core.short(i), w = text.length * 6.6 + 8, h = 14, r = [x - w / 2, y - 16 - h / 2, x + w / 2, y - 16 + h / 2];
    if (rects.some(q => !(r[2] < q[0] || r[0] > q[2] || r[3] < q[1] || r[1] > q[3]))) continue;
    rects.push(r); used.add(i); placed++;
    let s = labelSpans.get(i); if (!s) { s = el('span', {}, text); labelSpans.set(i, s); D.labels.append(s); }
    if (s.textContent !== text) s.textContent = text;
    s.style.transform = `translate(${x.toFixed(1)}px,${(y - 16).toFixed(1)}px) translate(-50%,-50%)`; s.hidden = false; s.classList.toggle('lit', (lit[i] & 15) > 0);
  }
  for (const [i, s] of labelSpans) if (!used.has(i)) s.hidden = true;
}

/* ================= actions (§4) ================= */
function navigate(idx, opts = {}) {
  if (typeof idx === 'string') { const key = idx; idx = core.resolve(key); if (idx < 0) { showNote(`Key ${key} is not in the published records.`); return; } state.focusKey = key.startsWith('line:') ? key : null; } else state.focusKey = null;
  if (idx < 0 || idx >= core.N) return;
  state.focus = idx; state.measure = -1; state.measureKey = null; trailPush(idx);
  computeLit(); if (!opts.silent) history.pushState(null, '', writeQuery(state));
  renderTrail(); relayout('navigate'); if (!opts.noPanel) renderPanel(idx, state.focusKey, false);
}
function goHome(push = true) { state.focus = -1; state.focusKey = null; state.measure = -1; state.trail.length = 0; computeLit(); if (push) history.pushState(null, '', writeQuery(state)); renderTrail(); closePanel(); relayout('home'); }
function measure(idx, key = null) { if (idx < 0) return; state.measure = idx; state.measureKey = key; computeLit(); history.replaceState(null, '', writeQuery(state)); renderPanel(idx, key, true); }
function recipeEntity(key) { return core.composeEntity(key); }   // a line carried by several families resolves to -1 until a person picks one (never fs[0])
function compose(key) {
  if (typeof key === 'number') key = core.keyStr[key];
  const i = core.resolve(key); if (i < 0) return;
  if (core.cls[i] === 0 || core.cls[i] === 1) { showTrayNote('Compose takes blocks, groups, families and lines'); return; }
  if (!state.recipe.includes(key)) state.recipe.push(key);
  afterRecipe();
}
function uncompose(key) { state.recipe = state.recipe.filter(k => k !== key); afterRecipe(); }
function afterRecipe() { computeLit(); history.replaceState(null, '', writeQuery(state)); try { localStorage.setItem('star-generator.recipe', JSON.stringify(state.recipe)); } catch (e) {} renderTray(); relayout('recipe'); }   // relayout rebuilds view.recipe (direct + derived blocks) for every lens; the camera is kept
function switchLens(id, push = true, opts = {}) {
  if (!lenses[id] || (lens && lens.id === id)) return;
  if (lens && lens.leave) lens.leave();
  lens = lenses[id]; state.lens = id; G.faint = id === 'chord' && !isMobile() ? 0.28 : 0.12;
  if (push) history.pushState(null, '', writeQuery(state));
  D.panel.classList.remove('tall');   // a tall (measured) sheet would hide the new lens; drop to peek, or close when a lens tab was tapped on a phone
  if (opts.closePanel && isMobile()) closePanel();
  renderLensbar(); renderLegend(); relayout('lens'); if (panelIdx >= 0) renderPanel(panelIdx, panelKey, panelMeasured);
}
/** a lens control (show: segment, spider, show 40 more) changes what the lens draws, never the focus, trail or history (§4) */
function refresh(home = false) { relayout(home ? 'refresh' : 'recipe'); }
const shell = { navigate, measure, compose, uncompose, goHome, switchLens, relayout: refresh };

function applyQuery(q, fromPop) {
  notes = q.notes.slice();
  if (q.kindsOn != null) state.kindsOn = q.kindsOn; else state.kindsOn = 0x7f;
  state.cat = q.cat ? (core.catIdx.get(q.cat) ?? -1) : -1;
  state.recipe = (q.recipe || []).map(k => k.trim()).filter(k => core.byKey.has(k) || /^line:\d+$/.test(k)).slice(0, 24);
  if (!q.recipe) { try { const s = JSON.parse(localStorage.getItem('star-generator.recipe') || '[]'); if (Array.isArray(s) && !state.recipe.length) state.recipe = s.filter(k => typeof k === 'string'); } catch (e) {} }
  state.trail = (q.trail || []).map(core.resolve).filter(i => i >= 0);
  state.focus = -1; state.focusKey = null; state.measure = -1;
  if (q.key) { const i = core.resolve(q.key); if (i >= 0) { state.focus = i; state.focusKey = q.key.startsWith('line:') ? q.key : null; trailPush(i); } else notes.push(`Key ${q.key} is not in the published records.`); }
  if (q.m) { const i = core.resolve(q.m); if (i >= 0) { state.measure = i; state.measureKey = q.m.startsWith('line:') ? q.m : null; } }
  const id = q.lens && lenses[q.lens] ? q.lens : (state.lens || 'ring');
  if (lens && lens.leave) lens.leave(); lens = lenses[id]; state.lens = id; G.faint = id === 'chord' && !isMobile() ? 0.28 : 0.12;
  computeLit(); renderLegend(); renderLensbar(); renderTrail(); renderTray(); relayout('lens');
  if (state.measure >= 0) renderPanel(state.measure, state.measureKey, true); else if (state.focus >= 0) renderPanel(state.focus, state.focusKey, false); else if (notes.length) { showNote(notes.join(' · ')); } else closePanel();
}
function showNote(text) { D.panel.hidden = false; D['panel-body'].innerHTML = ''; D['panel-body'].append(el('div', { class: 'u-h' }, 'GLOBALGRID2050'), el('div', { class: 'u-muted' }, text)); D['panel-foot'].innerHTML = ''; D['panel-foot'].append(el('button', { class: 'x', on: { click: () => closePanel() } }, '✕')); }
function showTrayNote(text) { const c = D.tray.querySelector('.cnt'); if (c) { c.textContent = text; setTimeout(renderTray, 2500); } }

/* ================= header parts: search, trail, legend, lens bar ================= */
function mountSearch() {
  const input = el('input', { class: 'u-search', placeholder: 'Search a name, #family, Sym, x-group or line number', 'aria-label': 'Search' }), hits = el('div', { class: 'u-hits' });
  input.addEventListener('input', () => { hits.innerHTML = ''; const q = input.value; if (!q.trim()) return; for (const h of core.search(q)) { if (h.note) hits.append(el('span', { class: 'u-muted' }, h.note)); else hits.append(el('button', { class: 'u-chip', on: { click: () => { hits.innerHTML = ''; input.value = ''; navigate(h.key); } } }, h.label)); } });
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { const b = hits.querySelector('button'); if (b) b.click(); } if (e.key === 'Escape') { hits.innerHTML = ''; input.blur(); } });
  D.search.append(input, hits); D.searchInput = input;
}
function renderTrail() {
  const t = D.trail; t.innerHTML = '';
  t.append(el('a', { href: '?lens=' + state.lens, class: 'root', title: 'home', on: { click: e => { e.preventDefault(); goHome(); } } }, 'GLOBALGRID2050'));
  state.trail.forEach((idx, i) => {
    const a = el('a', { href: '#', title: `visited ${ordinalWord(trailVisits(idx))}`, on: { click: e => { e.preventDefault(); state.trail = state.trail.slice(0, i + 1); state.trail.pop(); navigate(idx); } } }, core.label(idx));
    longPress(a, () => { a.title = `visited ${ordinalWord(trailVisits(idx))}`; showTip(a.getBoundingClientRect().left, a.getBoundingClientRect().top, a.title); });
    t.append(' › ', a);
  });
  t.scrollLeft = t.scrollWidth;
}
const ordinalWord = n => n + (n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th');
function renderLegend() {
  D.legend.innerHTML = '';
  const draws = lens ? lens.draws : REL_WORDS;
  REL_WORDS.forEach((word, k) => {
    const loaded = k < 5 || !!U.pack; const on = (state.kindsOn >> k) & 1;
    const chip = el('button', { class: 'lg' + (k === 5 ? ' dot' : k === 6 ? ' dash' : '') + (!loaded || !draws.includes(word) ? ' off' : '') + (on ? ' on' : ' off'), title: !loaded ? 'not loaded' : !draws.includes(word) ? `not drawn by the ${lens ? lens.id : ''} lens` : k === 6 && core.entangledStats ? `${core.entangledStats.stated} stated · ${core.entangledStats.listed} listed · ${core.entangledStats.stated - core.entangledStats.listed} not yet known` : k === 5 && core.randomStats ? `${core.randomStats.edges} random edges · ${core.randomStats.drawn} joined to families by name · seed ${core.randomStats.seed}` : '', on: { click: () => { state.kindsOn ^= 1 << k; if (G) G.kindsOn = state.kindsOn; computeLit(); history.replaceState(null, '', writeQuery(state)); renderLegend(); relayout('recipe'); } } }, el('i', { style: `background:${REL[word]};color:${REL[word]}` }), word);   // relayout, not gatherEdges alone: it rebuilds view.kindsOn and re-runs the lens geometry (the chord lens's idle chords are geometry), keeping the camera
    if (word === 'used by') longPress(chip, () => showTip(chip.getBoundingClientRect().left, chip.getBoundingClientRect().top, 'the reversed reading of "uses" (families) and "depends on" (blocks)'));
    D.legend.append(chip);
  });
  if (G) G.kindsOn = state.kindsOn;
  D.legend.append(el('span', { class: 'sep' }));
  U.cats.forEach((c, i) => D.legend.append(el('button', { class: 'lg cat' + (state.cat >= 0 && state.cat !== i ? ' dim' : '') + (state.cat === i ? ' on' : ''), title: c.blurb || '', on: { click: () => { state.cat = state.cat === i ? -1 : i; computeLit(); history.replaceState(null, '', writeQuery(state)); renderLegend(); relayout('cat'); } } }   /* computeLit sets and clears the dim bit (lit |= 32) and uploads it through G.setLit; without it a stale dim stays on the GPU */, el('i', { style: `background:${c.colour}` }), c.title)));
}
function renderLensbar() {
  D.lensbar.innerHTML = '';
  for (const id of LENSES) D.lensbar.append(el('a', { href: writeQuery({ ...state, lens: id }), class: lens && lens.id === id ? 'on' : '', on: { click: e => { e.preventDefault(); switchLens(id, true, { closePanel: true }); } } }, id));
}

/* ================= key panel (§3.6) ================= */
function closePanel() { D.panel.hidden = true; panelIdx = -1; panelKey = null; panelMeasured = false; D.panel.classList.remove('tall'); }
/** height of the stage a person can still see above the phone sheet (the whole stage on desktop) */
function visibleStageBand() { const s = D.stage.getBoundingClientRect(); if (!isMobile() || D.panel.hidden) return s.height; const p = D.panel.getBoundingClientRect(); return Math.max(80, Math.min(s.bottom, p.top) - s.top); }
function provRow() { return el('div', { class: 'p-prov' }, `blocks.json ${shortUtc(U.generated)} · index.json ${shortUtc(U.index.generated_utc)}` + (U.packStats ? ` · pack ${shortUtc(U.packStats.built)} sha256 ${(U.packStats.sha || '').slice(0, 7)}` : '')); }
function chip(text, onClick, colour, attrs = {}) { return el('button', { class: 'u-chip', style: colour ? `border-color:${colour}` : null, on: { click: onClick }, ...attrs }, text); }
function link(text, href, colour) { return el('a', { class: 'u-chip', href, target: '_blank', rel: 'noopener', style: colour ? `border-color:${colour}` : null }, text); }
function sect(host, title, items, colour, render, step = 40, label = 'more') { if (!items.length) return; host.append(el('div', { class: 'u-sub', style: `color:${colour}` }, title), pageList(el('div', { class: 'u-page' }), items, render, step, label)); }
const entChip = (i, colour, extra = '') => chip(core.label(i) + extra, () => navigate(i), colour);
async function renderPanel(idx, key, measured) {
  panelIdx = idx; panelKey = key; panelMeasured = !!measured; const wasHidden = D.panel.hidden; D.panel.hidden = false; const B = D['panel-body']; B.innerHTML = ''; B.scrollTop = 0;
  if (wasHidden && isMobile()) { const r = D.stage.getBoundingClientRect(); if (r.top < 0 || r.top > innerHeight * 0.3) D.stage.scrollIntoView({ block: 'start' }); }   // the picture stays visible above the sheet at peek height (§8); the page is not moved when the stage top is already in view, so a tapped tile stays where the finger left it
  const cls = core.cls[idx], r = core.rec[idx], isLine = key && key.startsWith('line:');
  B.append(el('div', { class: 'u-h' }, isLine ? core.labelKey(key) + (core.parent[idx] >= 0 ? ` · ${core.short(core.parent[idx])}` : '') : core.label(idx), el('span', { class: 'p-class' }, isLine ? 'line' : CLS_WORD[cls])), provRow());
  if (notes.length) B.append(el('div', { class: 'u-muted' }, notes.join(' · ')));
  if (cls === 2) blockPanel(B, idx, r); else if (cls === 3) groupPanel(B, idx, r); else if (cls === 0) catPanel(B, idx, r); else if (cls === 1) repoPanel(B, idx, r); else await familyPanel(B, idx, r, isLine ? +key.slice(5) : null, measured);
  const F = D['panel-foot']; F.innerHTML = '';
  F.append(chip('Navigate here', () => navigate(key || idx)), chip('Measure', () => { D.panel.classList.add('tall'); measure(idx, key); }), chip('Add to recipe', () => compose(key || core.keyStr[idx])));
  const om = el('div', { class: 'open-in' }); const menu = el('div', { class: 'menu' }); menu.hidden = true;
  for (const id of LENSES) if (!lens || id !== lens.id) menu.append(el('a', { href: writeQuery({ ...state, lens: id, focus: idx, focusKey: key }), on: { click: e => { e.preventDefault(); menu.hidden = true; if (state.focus !== idx) navigate(key || idx, { noPanel: true }); switchLens(id); } } }, id));
  om.append(chip('Open in ▾', () => { menu.hidden = !menu.hidden; }), menu); F.append(om, el('button', { class: 'x', title: 'close the panel (the trail and the key stay)', 'aria-label': 'close', on: { click: () => closePanel() } }, '✕'));   // ✕ closes; home is the root crumb of the trail
  if (lens && lens.overlay && lens.scrollTo) lens.scrollTo(idx, visibleStageBand());
}
function blockPanel(B, idx, b) {
  const c = U.catOf.get(b.category) || {}; B.append(el('div', { class: 'u-eyebrow', style: `color:${c.colour || PAL.muted}` }, `${c.title || b.category} · block ${b.number}`));
  if (b.description) B.append(el('div', {}, b.description));
  B.append(el('div', { class: 'u-muted' }, core.kindSentence(b)));
  B.append(el('div', { class: 'u-muted' }, `${fmt(b.functions || 0)} functions inside · lives in ${(b.repos || []).length ? b.repos.map(x => x.replace(/^Ventusltd\//, '')).join(', ') : 'not yet known'} · first written ${b.first_written ? b.first_written.slice(0, 10) : 'not yet known'}` + (b.state === 'UNSETTLED' ? ' · not agreed' : '')));
  const links = el('div', { class: 'u-links' }, link('Block page ↗', `${STARS}table.html?block=${b.symbol}`));
  if (b.live && b.live[0]) links.append(link('Live page ↗', b.live[0], REL['shared line']));
  if (b.files && b.files[0]) links.append(link('File at commit ↗', `https://github.com/${b.files[0].repo}/blob/${b.files[0].commit}/${b.files[0].path}`));
  if (b.kind !== 'auto') links.append(link('Add to an app ↗', `https://ventusltd.github.io/code-generator/?blocks=${b.symbol}`));
  B.append(links);
  const dep = core.edgesOf(idx, 1, 'out'), used = core.edgesOf(idx, 1, 'in');
  sect(B, `→ depends on (${dep.length})`, [...dep], REL['depends on'], t => { const via = core.viaOf(idx, t); return entChip(t, REL['depends on'], via ? ` through ${via.join(', ')}` : ''); });
  sect(B, `← used by (${used.length})`, [...used], REL['used by'], t => entChip(t, REL['used by']));
  if (core.parent[idx] >= 0) B.append(el('div', { class: 'u-sub', style: `color:${REL.contains}` }, '◂ contained in'), el('div', { class: 'u-page' }, entChip(core.parent[idx], REL.contains)));
  const repos = core.edgesOf(idx, 0, 'in').filter(i => core.cls[i] === 1);
  sect(B, `▸ found in (${repos.length})`, [...repos], REL.contains, t => entChip(t, REL.contains));
  const fams = [...core.familiesOf(idx)];
  sect(B, `contains (${fams.length} families)`, fams, REL.contains, t => entChip(t, REL.contains), 40, 'more');
  if (b.needs && b.needs.length) B.append(el('div', { class: 'u-sub' }, 'needs from elsewhere:'), el('div', { class: 'u-need' }, b.needs.slice(0, 8).map(n => n.meaning || n.name).join(' · ') + (b.needs.length > 8 ? ` · (${b.needs.length - 8} more)` : '')));
}
function groupPanel(B, idx, sym) {
  B.append(el('div', { class: 'u-muted' }, 'off the table: the code-generator cannot pick it yet'));
  const fams = [...core.familiesOf(idx)];
  sect(B, `contains (${fams.length} families)`, fams, REL.contains, t => entChip(t, REL.contains));
  const dep = core.edgesOf(idx, 1, 'in'); sect(B, `← used by (${dep.length})`, [...dep], REL['used by'], t => entChip(t, REL['used by']));
}
function catPanel(B, idx, c) {
  if (c.blurb) B.append(el('div', {}, c.blurb));
  const bl = core.edgesOf(idx, 0, 'out').filter(i => core.cls[i] === 2);
  sect(B, `contains (${bl.length} blocks)`, [...bl], REL.contains, t => entChip(t, REL.contains));
}
function repoPanel(B, idx, name) {
  const bl = [...core.edgesOf(idx, 0, 'out')].sort((a, b) => core.cat[a] - core.cat[b]);
  B.append(el('div', { class: 'u-links' }, link('Repository ↗', `https://github.com/Ventusltd/${name}`)));
  B.append(el('div', { class: 'u-sub', style: `color:${REL.contains}` }, `contains (${bl.length} blocks)`));
  let last = -1; const host = el('div', { class: 'u-page' });
  for (const t of bl) { if (core.cat[t] !== last) { last = core.cat[t]; host.append(el('div', { class: 'u-eyebrow', style: `width:100%;color:${core.colour(t)}` }, U.cats[last] ? U.cats[last].title : 'not yet known')); } host.append(entChip(t, REL.contains)); }
  B.append(host);
  const ent = core.edgesOf(idx, 6, 'in'); sect(B, `↔ entangled (${ent.length})`, [...ent], REL.entangled, t => entChip(t, REL.entangled));
}
async function familyPanel(B, idx, n, lineN, measured) {
  const wait = el('div', { class: 'u-muted' }, `Loading family #${n}…`); B.append(wait);
  let rec; try { rec = await core.loadFamilyEdges(idx); } catch (e) { wait.replaceWith(el('div', { class: 'u-fail' }, `Could not load family #${n}: ${e.message}`)); return; }
  wait.remove(); if (panelIdx !== idx) return;
  if (!rec) { B.append(el('div', { class: 'u-muted' }, `Family #${n} is not in the published records.`)); return; }
  computeLit(); gatherEdges();
  const L = familyLinks(rec, n), p = (rec.places || [])[0], pk = core.famPack ? core.famPack[idx] : null;
  B.append(el('div', { class: 'u-muted' }, `${rec.kind || 'code'} · ${fmt(rec.lines.length)} numbered lines · in ${(rec.repos || []).length} repositories · ${rec.standalone ? 'self-contained' : 'needs context'}` + (pk && pk.first_written ? ` · first written ${pk.first_written.slice(0, 10)}` : '')));
  const links = el('div', { class: 'u-links' });
  for (const gg of (U.famGroups.get(n) || [])) { const gi = core.resolve(U.bySym.has(gg) ? `block:${gg}` : `group:${gg}`); if (gi >= 0) links.append(chip(`◂ contained in ${core.label(gi)}`, () => navigate(gi), REL.contains)); }
  links.append(link('Function page ↗', L.page)); if (L.gh) links.append(link(`File at commit ↗ #L${p.first}-L${p.last}`, L.gh)); if (L.live) links.append(link('Live page ↗', L.live, REL['shared line']));
  B.append(links);
  if (lineN != null) {
    const fs = core.familiesOfLine(lineN) || [];
    B.append(el('div', { class: 'u-sub', style: `color:${PAL.key}` }, `line ${fmt(lineN)}`), el('div', { class: 'u-muted' }, `quoted from ${core.parent[idx] >= 0 ? core.label(core.parent[idx]) : 'not yet known'}`));
    if (p) B.append(el('div', { class: 'u-links' }, link(`File at commit ↗ #L${lineN}`, `https://github.com/${p.repo}/blob/${p.commit}/${p.path}#L${lineN}`)));
    const others = [...fs].filter(f => f !== idx); if (others.length) sect(B, `also in: (${others.length} others)`, others, REL['shared line'], t => entChip(t, REL['shared line']));
    if (U.packStats) B.append(el('div', { class: 'u-muted' }, `${fmt(U.packStats.distinct)} distinct numbers in this pack · ${fmt(U.packStats.unique)} unique per index.json`));
  }
  const uses = core.edgesOf(idx, 2, 'out'), usedBy = core.edgesOf(idx, 2, 'in');
  const linksFirst = isMobile();   // on a phone the numbered lines come before the uses / used by lists, so the text is within reach of the peek sheet
  const usesLists = () => { sect(B, `→ uses (${uses.length})`, [...uses], REL.uses, t => entChip(t, REL.uses)); sect(B, `← used by (${usedBy.length})`, [...usedBy], REL['used by'], t => entChip(t, REL['used by'])); };
  if (!linksFirst) usesLists();
  B.append(el('div', { class: 'u-sub' }, 'Numbered lines (permanent keys)'));
  const pre = el('div', { class: 'u-code' }); B.append(pre);
  const keySpan = k => { const fs = core.familiesOfLine(k); const shared = fs && fs.length > 1; return `<span class="u-key"${shared ? ` style="color:${REL['shared line']}" title="shared with ${fmt(fs.length - 1)} other families"` : ''}>${k}</span>`; };   // a shared line's key wears the shared line colour, and says with how many
  if (measured) { pre.textContent = 'Fetching the code at its pinned commit…'; try { const rows = await familyLines(rec); if (panelIdx !== idx) return; pre.innerHTML = rows.map(r => `<div class="u-line${r.key === lineN ? ' on' : ''}">${keySpan(r.key)} │ ${esc(r.text)}</div>`).join(''); const on = pre.querySelector('.on'); B.scrollTop += pre.getBoundingClientRect().top - B.getBoundingClientRect().top - 6; if (on) pre.scrollTop = Math.max(0, on.offsetTop - pre.clientHeight / 2); } catch (e) { pre.textContent = `The code could not be fetched (${e.message}); the line keys are ${rec.lines.join(', ')}.`; } }
  else pre.innerHTML = rec.lines.map(k => `<div class="u-line${k === lineN ? ' on' : ''}">${keySpan(k)} │ <span class="u-muted">text on Measure</span></div>`).join('');
  if (linksFirst) usesLists();
  if (U.pack) { const sh = core.sharedOf(idx); gatherEdges(); sect(B, `≡ shared line (${sh.length}) (whole pack · first 8 per line)`, sh, REL['shared line'], s => entChip(s.idx, REL['shared line'], ` (${s.w} shared)`)); }
  else { const sh = await core.sharedLoaded(n, rec.lines); if (panelIdx !== idx) return; sect(B, `≡ shared line (${sh.length}) (loaded records only)`, sh, REL['shared line'], s => entChip(s.idx, REL['shared line'], ` (${s.w} shared)`)); }
  const rnd = core.edgeIds(idx, 5, 'both'); if (rnd.length) { const E = core.edges; sect(B, `? random link (p = ${rnd.map(e => E.w[e].toFixed(2)).join(', ')})`, rnd, REL['random link'], e => entChip(E.a[e] === idx ? E.b[e] : E.a[e], REL['random link'], ` (p = ${E.w[e].toFixed(2)})`)); }
  const ent = core.edgesOf(idx, 6, 'out'); sect(B, `↔ entangled (${ent.length})`, [...ent], REL.entangled, t => entChip(t, REL.entangled));
}
function mountPanelSheet() {
  let y0 = 0, h0 = 0; const H = D['panel-handle'];
  H.addEventListener('pointerdown', e => { y0 = e.clientY; h0 = D.panel.getBoundingClientRect().height; H.setPointerCapture(e.pointerId); });
  H.addEventListener('pointerup', e => { const dy = e.clientY - y0; if (dy < -40) D.panel.classList.add('tall'); else if (dy > 40) { if (D.panel.classList.contains('tall')) D.panel.classList.remove('tall'); else closePanel(); } });
}

/* ================= compose tray and recipe sheet (§6) ================= */
function recipeCounts() { const c = { block: 0, group: 0, family: 0, line: 0 }; for (const k of state.recipe) c[k.split(':')[0]] = (c[k.split(':')[0]] || 0) + 1; return c; }
/** what will travel and what stays a note, in words: `2 blocks will travel (Ss, Vd) · #511 pinned as a note · line 17 · pick one` */
function countWords() {
  if (!state.recipe.length) return '';
  const bl = recipeBlocks(), parts = [];
  parts.push(bl.length ? `${bl.length} block${bl.length === 1 ? '' : 's'} will travel (${bl.map(i => core.rec[i].symbol).join(', ')})` : 'no block will travel yet');
  const fams = state.recipe.filter(k => k.startsWith('family:')).map(k => '#' + k.slice(7)); if (fams.length) parts.push(`${fams.slice(0, 3).join(', ')}${fams.length > 3 ? ` +${fams.length - 3}` : ''} pinned as ${fams.length === 1 ? 'a note' : 'notes'}`);
  const grp = state.recipe.filter(k => k.startsWith('group:')).map(k => k.slice(6)); if (grp.length) parts.push(`${grp.join(', ')} off the table`);
  for (const k of state.recipe) if (k.startsWith('line:')) { const n = +k.slice(5), r = core.resolveLine(n); parts.push(r.fams === null ? `line ${fmt(n)} · line index still loading` : r.idx >= 0 ? `line ${fmt(n)} pinned as a note` : `line ${fmt(n)} · carried by ${fmt(r.fams.length)} families · pick one`); }
  return parts.join(' · ');
}
/** the same tally in numerals for the 430 px tray, e.g. `2 blocks · 1 note`; the full words of countWords() go on the title of the chips and of the count */
function countShort() {
  if (!state.recipe.length) return '';
  const parts = [], bl = recipeBlocks().length;
  parts.push(`${bl} block${bl === 1 ? '' : 's'}`);
  let notes = state.recipe.filter(k => k.startsWith('family:')).length, pick = 0, loading = 0;
  for (const k of state.recipe) if (k.startsWith('line:')) { const r = core.resolveLine(+k.slice(5)); if (r.fams === null) loading++; else if (r.idx >= 0) notes++; else pick++; }
  if (notes) parts.push(`${notes} note${notes === 1 ? '' : 's'}`);
  if (pick) parts.push(`${pick} to pick`);
  if (loading) parts.push(`${loading} loading`);
  const grp = state.recipe.filter(k => k.startsWith('group:')).length; if (grp) parts.push(`${grp} off the table`);
  return parts.join(' · ');
}
function lineChipText(k) { const n = +k.slice(5), r = core.resolveLine(n); if (r.fams === null) return `line ${fmt(n)} · index loading`; if (r.idx >= 0) return `line ${fmt(n)} → ${core.short(r.idx)}${core.parent[r.idx] >= 0 ? ` → ${core.short(core.parent[r.idx])}` : ''}`; return `line ${fmt(n)} · ${fmt(r.fams.length)} families · pick one`; }
function famChipText(i) { return core.short(i) + (core.parent[i] >= 0 && core.cls[core.parent[i]] === 2 ? ` → ${core.short(core.parent[i])}` : core.parent[i] >= 0 ? ` → ${core.short(core.parent[i])} (off the table)` : ''); }
function renderTray() {
  D.tray.innerHTML = ''; D.tray.onclick = e => { if (e.target === D.tray || e.target.classList.contains('chips') || e.target.classList.contains('cnt')) openRecipeSheet(); };
  if (!state.recipe.length) { D.tray.append(el('span', { class: 'cnt' }, 'Recipe: nothing yet · tap Add to recipe on any key')); return; }
  const chips = el('div', { class: 'chips' });
  const words = countWords();
  for (const k of state.recipe) { const i = recipeEntity(k); const text = k.startsWith('line:') ? lineChipText(k) : core.cls[i] === 4 ? famChipText(i) : core.short(i); chips.append(el('span', { class: 'rc', style: `border-color:${i >= 0 ? core.colour(i) : PAL.muted}`, title: words }, text, el('button', { title: 'remove', on: { click: e => { e.stopPropagation(); uncompose(k); } } }, '×'))); }
  D.tray.append(chips, el('span', { class: 'cnt', title: words }, countShort()), el('button', { class: 'go', on: { click: e => { e.stopPropagation(); handOff(); } } }, 'Hand off →'));
  chips.scrollLeft = chips.scrollWidth;   // the newest key is the last chip: it is scrolled into view, with its × reachable, at every width
}
/** the table blocks that will travel in `?blocks=`: block → itself; family → its block; line → its family's block only when the line has one family or a person picked one */
function recipeBlocks() { const out = []; for (const k of state.recipe) { const i = recipeEntity(k); if (i < 0) continue; const b = core.cls[i] === 2 ? i : core.cls[i] === 4 && core.parent[i] >= 0 && core.cls[core.parent[i]] === 2 ? core.parent[i] : -1; if (b >= 0 && !out.includes(b)) out.push(b); } return out; }
function needsOutside() { const bl = recipeBlocks().map(i => core.rec[i]); const inside = new Set(bl.flatMap(b => (b.inside || []).map(x => x.name))); const need = new Map(); for (const b of bl) for (const n of b.needs || []) if (!inside.has(n.name) && !need.has(n.name)) need.set(n.name, n.meaning || n.name); return [...need.entries()].map(([name, meaning]) => ({ name, meaning })); }
function handOffURL() { const syms = recipeBlocks().map(i => core.rec[i].symbol); const fams = state.recipe.filter(k => k.startsWith('family:')).map(k => k.slice(7)); const lines = state.recipe.filter(k => k.startsWith('line:')).map(k => k.slice(5)); return `https://ventusltd.github.io/code-generator/?blocks=${syms.join(',')}${fams.length ? `&families=${fams.join(',')}` : ''}${lines.length ? `&lines=${lines.join(',')}` : ''}&from=star-generator&data=${stamp(U.generated)}`; }
function handOff() { if (!state.recipe.length) return; window.open(handOffURL(), '_blank', 'noopener'); }
async function recipeJSON() {
  const blocks = recipeBlocks().map(i => { const b = core.rec[i]; return { symbol: b.symbol, number: b.number, title: b.title, category: b.category, files: (b.files || []).map(f => ({ repo: f.repo, commit: f.commit, path: f.path })) }; });
  const families = [], lines = [];
  for (const k of state.recipe) if (k.startsWith('family:') || k.startsWith('line:')) {
    const isLine = k.startsWith('line:'), r = isLine ? core.resolveLine(+k.slice(5)) : null, i = isLine ? r.idx : core.resolve(k);
    if (isLine && i < 0) { lines.push({ key: +k.slice(5), family: null, families_carrying: r.fams ? r.fams.length : null, repo: null, commit: null, path: null, note: r.fams === null ? 'line index not loaded' : `carried by ${r.fams.length} families · none chosen` }); continue; }
    if (i < 0) continue;
    const n = core.rec[i]; let rec = null; try { rec = await family(n); } catch (e) {} const p = rec && rec.places && rec.places[0]; const place = p ? { repo: p.repo, commit: p.commit, path: p.path, first: p.first, last: p.last } : null; const blk = core.parent[i] >= 0 ? core.short(core.parent[i]) : null;
    if (!isLine) families.push({ n, name: core.famName[i] || null, block: blk, place, note: place ? undefined : 'no pinned place' });
    else lines.push({ key: +k.slice(5), family: n, families_carrying: r.fams.length, chosen: r.chosen || undefined, block: blk, repo: p ? p.repo : null, commit: p ? p.commit : null, path: p ? p.path : null, note: p ? undefined : 'no pinned place' });
  }
  return { schema: 'star-generator.recipe.v1', made_utc: new Date().toISOString(), data: { blocks_json: U.generated, index_json: U.index.generated_utc, pack: U.packStats ? U.packStats.built : null }, keys: state.recipe.slice(), blocks, families, lines, needs: needsOutside(), trail: state.trail.map(i => core.keyStr[i]) };
}
function copyText(t, btn) { navigator.clipboard && navigator.clipboard.writeText(t).then(() => { btn.textContent = 'copied'; setTimeout(() => btn.textContent = btn.dataset.t, 1500); }).catch(() => { btn.textContent = 'copy failed'; }); }
function openRecipeSheet() {
  const S = D.sheet; S.hidden = false; S.innerHTML = '';
  S.append(el('div', { class: 'u-h' }, 'Recipe', el('span', { class: 'p-class' }, countWords() || 'nothing yet')), el('button', { class: 'u-chip', style: 'float:right', on: { click: () => S.hidden = true } }, '✕ close'));
  // the three actions sit directly under the heading (and stay reachable), never below the fold
  const bC = chip('Copy recipe', () => recipeJSON().then(j => copyText(JSON.stringify(j, null, 1), bC))), bM = chip('Copy command', () => copyText(`gh workflow run generate.yml -R Ventusltd/code-generator -f name=${(prompt('name for the app', 'my-app') || 'my-app').toLowerCase().replace(/[^a-z0-9-]/g, '-')} -f blocks=${recipeBlocks().map(i => core.rec[i].symbol).join(',')}`, bM));
  bC.dataset.t = 'Copy recipe'; bM.dataset.t = 'Copy command';
  S.append(el('div', { class: 'row act' }, chip('Hand off →', handOff), bC, bM));
  S.append(el('div', { class: 'u-muted' }, 'block → itself · group → itself (off the table: the code-generator cannot pick it yet) · family → its block, the family pinned · line → its family → its block when the line has one family or you pick one; a line carried by several families stays a note until you pick. The first block is the main one.'));
  const list = el('div');
  state.recipe.forEach((k, i) => {
    const isLine = k.startsWith('line:'), r = isLine ? core.resolveLine(+k.slice(5)) : null, idx = isLine ? r.idx : core.resolve(k);
    let text = idx >= 0 ? (isLine ? core.labelKey(k) : core.label(idx)) + (core.cls[idx] === 3 ? ' · off the table: the code-generator cannot pick it yet' : core.cls[idx] === 4 && core.parent[idx] >= 0 ? ` → ${core.short(core.parent[idx])}` : '') : k;
    if (isLine) text = r.fams === null ? `line ${fmt(k.slice(5))} · line index still loading` : idx >= 0 ? `line ${fmt(k.slice(5))} → ${core.label(idx)}${core.parent[idx] >= 0 ? ` → ${core.short(core.parent[idx])}` : ''}${r.chosen ? ' (picked)' : ''}` : `line ${fmt(k.slice(5))} · carried by ${fmt(r.fams.length)} families · pick one`;
    const row = el('div', { class: 'ch' }, el('button', { style: `border-left:3px solid ${idx >= 0 ? core.colour(idx) : PAL.muted}`, on: { click: () => { if (isLine && idx < 0 && r.fams) { lineChooser(+k.slice(5)); return; } S.hidden = true; navigate(k); } } }, text));
    if (isLine && r.fams && r.fams.length > 1) row.append(chip('pick', () => lineChooser(+k.slice(5)), REL['shared line'], { title: `choose which of the ${fmt(r.fams.length)} families this line stands for` }));
    if (isMobile()) row.append(chip('▲', () => { if (i > 0) { [state.recipe[i - 1], state.recipe[i]] = [state.recipe[i], state.recipe[i - 1]]; afterRecipe(); openRecipeSheet(); } }), chip('▼', () => { if (i < state.recipe.length - 1) { [state.recipe[i + 1], state.recipe[i]] = [state.recipe[i], state.recipe[i + 1]]; afterRecipe(); openRecipeSheet(); } })); else { row.draggable = true; row.addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', String(i))); row.addEventListener('dragover', e => e.preventDefault()); row.addEventListener('drop', e => { e.preventDefault(); const from = +e.dataTransfer.getData('text/plain'); const [m] = state.recipe.splice(from, 1); state.recipe.splice(i, 0, m); afterRecipe(); openRecipeSheet(); }); }
    row.append(chip('×', () => { uncompose(k); openRecipeSheet(); })); list.append(row);
  });
  S.append(list);
  // needs from outside: the count first; names deduplicated by meaning, one-letter names behind `show all`
  const need = needsOutside(), byMeaning = [...new Map(need.map(n => [n.meaning, n])).values()], shown = byMeaning.filter(n => n.meaning.length > 1);
  const needBox = el('div', { class: 'u-need' }, need.length ? `needs: ${need.length} from outside` + (shown.length ? ` · ${shown.slice(0, 8).map(n => n.meaning).join(', ')}` : '') : 'needs: 0');
  S.append(el('div', { class: 'u-sub' }, 'needs from outside:'), needBox);
  if (need.length > shown.slice(0, 8).length) S.append(chip(`show all ${need.length}`, () => { needBox.textContent = `needs: ${need.length} from outside · ` + need.map(n => n.meaning === n.name ? n.name : `${n.name} (${n.meaning})`).join(', '); }));
  const files = recipeBlocks().flatMap(i => (core.rec[i].files || []).map(f => `${f.repo.replace(/^Ventusltd\//, '')}/${f.path} @ ${String(f.commit).slice(0, 7)}`));
  S.append(el('div', { class: 'u-sub' }, `pinned files (${files.length})`), el('div', { class: 'pin' }, files.length ? files.map(f => el('div', {}, f)) : 'no pinned place'));
  S.append(el('div', { class: 'u-muted' }, 'families and lines travel as notes until the picker reads them · no commit travels in the URL: the picker takes commits from the same blocks.json'));
  S.append(el('div', { class: 'u-muted' }, el('a', { href: 'https://ventusltd.github.io/code-generator/', target: '_blank', rel: 'noopener' }, 'pairs and apps that already mix these blocks ↗'), ' · ', el('span', { style: 'overflow-wrap:anywhere' }, handOffURL())));
}
/** the chooser for a line carried by several families: the person picks, the star never guesses (paged 40) */
function lineChooser(n) {
  const S = D.sheet, r = core.resolveLine(n); if (!r.fams) return; S.hidden = false; S.innerHTML = '';
  S.append(el('div', { class: 'u-h' }, `line ${fmt(n)} · carried by ${fmt(r.fams.length)} families · pick one`, el('span', { class: 'p-class' }, 'line')), el('div', { class: 'u-muted' }, 'The block of the family you pick will travel in the hand-off; until then the line is a note.'));
  const host = el('div');
  pageList(host, [...r.fams], f => el('div', { class: 'ch' }, el('button', { style: `border-left:3px solid ${core.colour(f)}`, on: { click: () => { core.lineChoice.set(n, f); afterRecipe(); openRecipeSheet(); } } }, core.label(f) + (core.parent[f] >= 0 ? ` → ${core.short(core.parent[f])}` : ''))), 40, 'families');
  S.append(host, el('div', { class: 'row' }, chip('back to the recipe', () => openRecipeSheet())));
}

/* ================= sheets: chooser, context ================= */
function chooser(list) { const S = D.sheet; S.hidden = false; S.innerHTML = ''; S.append(el('div', { class: 'u-h' }, 'Which one?')); for (const i of list) S.append(el('div', { class: 'ch' }, el('button', { on: { click: () => { S.hidden = true; navigate(i); } } }, core.label(i), el('span', { class: 'p-class' }, CLS_WORD[core.cls[i]])))); S.append(el('button', { class: 'u-chip', on: { click: () => S.hidden = true } }, 'cancel')); }
function contextSheet(idx) {
  const S = D.sheet; S.hidden = false; S.innerHTML = ''; S.append(el('div', { class: 'u-h' }, core.label(idx), el('span', { class: 'p-class' }, CLS_WORD[core.cls[idx]])));
  S.append(el('div', { class: 'row' }, chip('Navigate here', () => { S.hidden = true; navigate(idx); }), chip('Measure', () => { S.hidden = true; measure(idx); }), chip('Add to recipe', () => { S.hidden = true; compose(idx); })));
  const row = el('div', { class: 'row' }, el('span', { class: 'u-muted' }, 'Open in:')); for (const id of LENSES) row.append(chip(id, () => { S.hidden = true; if (state.focus !== idx) navigate(idx, { noPanel: true }); switchLens(id); })); S.append(row);
  const bL = chip('Copy link', () => copyText(location.origin + location.pathname + writeQuery({ ...state, focus: idx, focusKey: null }), bL)); bL.dataset.t = 'Copy link';
  S.append(el('div', { class: 'row' }, bL, chip('close', () => S.hidden = true)));
}
function showTip(x, y, text) { D.tip.hidden = false; D.tip.textContent = text; const r = D.stage.getBoundingClientRect(); D.tip.style.left = Math.max(0, Math.min(r.width - 160, x - r.left + 8)) + 'px'; D.tip.style.top = Math.max(0, y - r.top - 24) + 'px'; clearTimeout(showTip.t); showTip.t = setTimeout(() => D.tip.hidden = true, 1800); }
function longPress(node, fn) { let t = null; node.addEventListener('pointerdown', () => { t = setTimeout(fn, 450); }); for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) node.addEventListener(ev, () => clearTimeout(t)); node.addEventListener('contextmenu', e => { e.preventDefault(); fn(); }); }

/* ================= gestures on the stage (§4) ================= */
function hitAt(cx, cy) {
  const r = D.gl.getBoundingClientRect(); const sx = cx - r.left, sy = cy - r.top; const [lx, ly] = G.toLayout(sx, sy);
  if (lens.hit) { const h = lens.hit(core, view, lx, ly); if (h >= 0) return { idx: h, second: -1 }; }
  const zoom = G.view.zoom || 1; const prefer = lens._orb ? (i => { const o = lens._orb; if (o[2 * i] < 0) return null; const ring = o[2 * i], ang = o[2 * i + 1] + ((performance.now() - G.time0) / 1000) * 0.25 / (ring + 1); return [Math.cos(ang) * (16 + ring * 18) / zoom, Math.sin(ang) * (16 + ring * 18) / zoom]; }) : null;
  const p = pick(grid, lx, ly, 22 / zoom, prefer);
  if (p.idx >= 0 && p.second >= 0 && (p.d2 - p.d) * zoom < 6) return { idx: p.idx, second: p.second };
  return { idx: p.idx, second: -1 };
}
function mountGestures() {
  const c = D.gl; const pts = new Map(); let down = null, lastTap = 0, pressT = null, pinch0 = null, moved = false;
  c.addEventListener('pointerdown', e => {
    c.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) { down = { x: e.clientX, y: e.clientY, t: performance.now(), pan: [...G.view.pan], rot: G.view.rotate, button: e.button }; moved = false; clearTimeout(pressT); pressT = setTimeout(() => { if (!moved && pts.size === 1) { const h = hitAt(down.x, down.y); if (h.idx >= 0) { if (state.measure === h.idx) contextSheet(h.idx); else measure(h.idx); } down = null; } }, 450); }
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, zoom: G.view.zoom, x: a.x, y: a.y }; clearTimeout(pressT); down = null; }
  });
  c.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) { hover(e); return; } pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2 && pinch0) { const [a, b] = [...pts.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); const cam = lens.camera ? lens.camera(view) : { zoom: [0.5, 6] }; if (cam.zoom) G.view.zoom = Math.max(cam.zoom[0], Math.min(cam.zoom[1], pinch0.zoom * d / pinch0.d)); return; }
    if (!down) return; const dx = e.clientX - down.x, dy = e.clientY - down.y; if (!moved && Math.hypot(dx, dy) > 6) { moved = true; clearTimeout(pressT); }
    if (!moved) return; const cam = lens.camera ? lens.camera(view) : { pan: true, rotate: false };
    if (cam.rotate) { const r = D.gl.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2; G.view.rotate = down.rot + (Math.atan2(e.clientY - cy, e.clientX - cx) - Math.atan2(down.y - cy, down.x - cx)); }
    else if (cam.pan === true) G.view.pan = [down.pan[0] + dx, down.pan[1] + dy]; else if (cam.pan === 'x') G.view.pan = [down.pan[0] + dx, down.pan[1]]; else if (cam.pan === 'y') G.view.pan = [down.pan[0], down.pan[1] + dy];
  });
  const up = e => {
    const had = pts.get(e.pointerId); pts.delete(e.pointerId); clearTimeout(pressT);
    if (pinch0 && pts.size <= 1 && had) { const dx = had.x - pinch0.x, scale = G.view.zoom / pinch0.zoom; if (Math.abs(scale - 1) < 0.1 && Math.abs(dx) > 60) switchLens(LENSES[(LENSES.indexOf(lens.id) + (dx < 0 ? 1 : LENSES.length - 1)) % LENSES.length]); pinch0 = null; down = null; return; }
    if (!down) return; const dt = performance.now() - down.t, dist = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    if (dist <= 6 && dt <= 350) {
      const now = performance.now(); if (now - lastTap < 300) { lastTap = 0; G.view = { pan: [...lens._home.pan], zoom: lens._home.zoom, rotate: lens._home.rotate }; down = null; return; } lastTap = now;
      const h = hitAt(e.clientX, e.clientY);
      if (h.second >= 0) chooser([h.idx, h.second]); else if (h.idx >= 0) { if (h.idx === state.focus && !state.focusKey) measure(h.idx); else navigate(h.idx); }
    }
    down = null;
  };
  c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
  c.addEventListener('contextmenu', e => { e.preventDefault(); const h = hitAt(e.clientX, e.clientY); if (h.idx >= 0) contextSheet(h.idx); });
  c.addEventListener('wheel', e => { e.preventDefault(); const cam = lens.camera ? lens.camera(view) : { zoom: [0.5, 6] }; if (!cam.zoom) return; G.view.zoom = Math.max(cam.zoom[0], Math.min(cam.zoom[1], G.view.zoom * (e.deltaY < 0 ? 1.1 : 0.9))); }, { passive: false });
  function hover(e) { if (isMobile()) return; const h = hitAt(e.clientX, e.clientY); if (h.idx !== hoverIdx) { hoverIdx = h.idx; if (h.idx >= 0) showTip(e.clientX, e.clientY, core.label(h.idx)); else D.tip.hidden = true; } }
  c.addEventListener('pointerleave', () => { hoverIdx = -1; D.tip.hidden = true; });
  D.overlay.addEventListener('scroll', () => { G.view.pan = [0, -D.overlay.scrollTop]; });
}
function mountKeys() {
  addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.key === '/') { e.preventDefault(); D.searchInput.focus(); }
    else if (e.key >= '1' && e.key <= '6') switchLens(LENSES[+e.key - 1]);
    else if (e.key === '[' || e.key === ']') switchLens(LENSES[(LENSES.indexOf(lens.id) + (e.key === ']' ? 1 : LENSES.length - 1)) % LENSES.length]);
    else if (e.key === 'Enter' && state.focus >= 0) measure(state.focus, state.focusKey);
    else if (e.key === '+' && state.focus >= 0) compose(state.focusKey || core.keyStr[state.focus]);
    else if (e.key === 'Backspace') { if (state.trail.length > 1) { state.trail.pop(); const i = state.trail.pop(); navigate(i); } else goHome(); }
    else if (e.key === 'Escape') { closePanel(); D.sheet.hidden = true; }
  });
}
