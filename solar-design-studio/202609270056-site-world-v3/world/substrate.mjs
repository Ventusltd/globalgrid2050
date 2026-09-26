// The substrate: an empty world you can move around in. It owns the loop, the camera and the views;
// everything you see comes from layers listed in manifest.json, plus the design being drawn (trenches and cables).
// Positions are local metres from the site origin, which is held in float64 British National Grid metres
// (0, 0 until a site is chosen). setOrigin moves the origin and shifts the viewer so they stay put in the world;
// walking more than 600 m from the origin moves it to the nearest whole kilometre (origin.mjs).
// The design is kept in memory in national-grid metres, so it survives every move of the origin.

import { gridAtlasUrl } from './links.mjs';
import { perspective, view, multiply } from './camera.mjs';
import { VIEWS, fpsOf, step, look, setView, toggle, blocked, AERIAL_MIN_CLEARANCE } from './views.mjs';
import { createFrameGate } from './frame-gate.mjs';
import { initialBudget, adjust } from './device-budget.mjs';
import { createLines } from './lines.mjs';
import { attachInput } from './input.mjs';
import { loadLayers, statusLine } from './layers.mjs';
import { rebaseIfNeeded, toBng, toLocal } from './origin.mjs';
import { arrive } from './arrival.mjs';
import { gridRef, wgs84ToBng } from './bng.mjs';
import { aboutList } from './attribution.mjs';
import { siteFromUrl } from './sites-ui.mjs';
import { sourceKeysFor, OPTIONAL_LAYERS } from './layers-panel.mjs';
import { createLiveTerrain } from './wcs-terrain.mjs';
// Design, Find, the project tools (file, print, tour, phases), the plan inset, the headset view and the layer
// panels load just after the first frame, not before it (review E, win 2): see "after the first frame" below.
const TOOLS = ['./design-ui.mjs', './search-ui.mjs', './plan-wire.mjs', './project-ui.mjs', './xr.mjs', './layers-ui.mjs',
  './sun-ui.mjs', './buffers-ui.mjs', './ground-readout.mjs'];

const $ = id => document.getElementById(id);
const canvas = $('view'), where = $('where-line'), status = $('status');
// Layer diagnostics sit behind a closed "Layer details" in Controls; ?debug=1 opens them.
if (new URLSearchParams(location.search).get('debug') === '1') $('layer-details').open = true;
// The fade distance grows with height above the ground, so a high drone still sees the ground below (phone review).
const fadeAt = () => { const [x, y, z] = state.pos, h = z - heightAt(x, y); return Math.min(4000, FADE_M + Math.max(0, Number.isFinite(h) ? h : 0) * 2.5); };
const FADE_M = 450, FOV = 70 * Math.PI / 180, MAX_DT = 0.1, ARRIVAL_FPS = 30, ARRIVAL = { height: 80, seconds: 3 };
const JUMP_M = 3000;      // further than this, Find moves the origin and drops in from above instead of flying across
const SITE_HALF_M = 1024; // half the staged site's side: terrain tiles exist within this of its centre

let state = { view: 'standing', pos: [0, -25, 0], yaw: 0, pitch: -0.12 };
let budget = initialBudget(devicePixelRatio);
let loaded = { generation: '', layers: [] }, vertices = 0;
let origin = { e: 0, n: 0, id: 0 };
let groundVersion = 0; // bumped whenever a layer says new ground has arrived, or the origin moves
let lastGround = 0;    // the last ground height found near the viewer; used where no layer knows the height
let arrival = null;    // { pose, t0 } while the drone flies itself somewhere
const GROUND_MEMORY_M = 20;
// Extensions (plan inset, project tools) run before and after each drawn frame; lastBatches is what the frame drew.
const hooks = { before: new Set(), after: new Set(), design: new Set() };
let lastBatches = [];
let tourPlaying = () => false; // set once the project tools are mounted: a playing tour draws at 30 fps

const live = () => loaded.layers.filter(l => l.layer);
let layersUi = null, groundReadout = null; // the Layers panel (dash button, layers-ui.mjs): an optional layer switched off is hidden
const shown = () => live().filter(l => !l.hidden);
// A layer that throws is switched off and named; it never takes the rest of the world down with it.
const guarded = (l, fn, fallback) => {
  try { return fn(); } catch (e) { l.layer = null; l.status = 'failed and switched off: ' + e.message; return fallback; }
};
// The ground the layers know, before any design cuts it.
const baseHeight = (x, y) => {
  for (const l of live()) {
    if (typeof l.layer.heightAt !== 'function') continue;
    const h = guarded(l, () => l.layer.heightAt(x, y), NaN);
    if (Number.isFinite(h)) {
      if (Math.hypot(x - state.pos[0], y - state.pos[1]) <= GROUND_MEMORY_M) lastGround = h;
      return h;
    }
  }
  return lastGround; // the empty world is flat at 0 m; past the edge of known ground, keep the last height
};
// Ground actually measured by a layer at (x, y), or NaN: engineering checks use this, never a guess.
const measuredAt = (x, y) => {
  for (const l of live()) {
    if (typeof l.layer.heightAt !== 'function') continue;
    const h = guarded(l, () => l.layer.heightAt(x, y), NaN);
    if (Number.isFinite(h)) return h;
  }
  return NaN;
};
// Whether a layer measured the ground at (x, y): off it, layers leave out what would stand there (water and roads
// past the LiDAR, tester 7).
const known = (x, y) => Number.isFinite(measuredAt(x, y));
// Which layer the ground at (x, y) comes from, in words for the readout.
const GROUND_WORDS = { terrain: 'LiDAR', 'terrain-live': 'live EA LiDAR' }; // the Controls status spells out LIVE_LABEL
const groundSource = (x, y) => {
  for (const l of live()) {
    if (typeof l.layer.heightAt !== 'function') continue;
    if (Number.isFinite(guarded(l, () => l.layer.heightAt(x, y), NaN))) return l.id;
  }
  return null;
};
// The ground everyone stands on: the layers' ground with every finished trench cut into it (design-ui.mjs).
const heightAt = (x, y) => design.heightAt(x, y);
// Solids are what a person or drone cannot pass through; layers declare them as boxes in local metres.
const solids = () => shown().flatMap(l => (typeof l.layer.solids === 'function' ? guarded(l, () => l.layer.solids({ pos: state.pos }), []) : []));

const lines = createLines(canvas, { onRestore: () => gate.invalidate() });
const gate = createFrameGate(draw);
// A layer asks for a redraw; { ground: true } (the default) also says new ground has arrived.
const invalidate = ({ ground = true } = {}) => { if (ground) groundVersion++; gate.invalidate(); };

// Grid equipment the design measures its routes against: substations and towers from the grid layer, if loaded.
function gridAssets() {
  const model = live().find(l => l.id === 'grid')?.layer?.debug?.()?.model;
  if (!model) return [];
  const subs = (model.substations || []).map(s => ({ kind: 'substation', label: `${s.cls} substation`, e: s.e, n: s.n,
    kv: s.kv ?? null, tier: s.tier ?? null, id: s.id })); // no operator: the screen shows the network tier only
  const towers = (model.lines || []).flatMap(l => l.towers.map(t => ({ kind: 'tower', label: `${l.cls} pylon`, e: t.e, n: t.n,
    kv: l.kv ?? null, id: t.id })));
  return [...subs, ...towers];
}
// Until design-ui.mjs arrives (just after the first frame) the ground is the layers' own and nothing is designed.
let design = Object.freeze({ heightAt: (x, y) => baseHeight(x, y), batches: () => [], pickAt() {}, shift() {}, putDown() {},
  snapshot: () => ({ tool: null, trenches: [], cables: [], works: [], draft: [], readout: null }), lastFinished: () => null, replace() {} });

// ---- moving -----------------------------------------------------------------------------------------
// Moves the site origin to (e, n) national-grid metres. The viewer and the route being drawn are shifted by the
// same amount the other way, so they stay in the same place in the world; layers read it via api.origin().
function setOrigin(e, n) {
  if (!Number.isFinite(e) || !Number.isFinite(n)) throw Error('setOrigin needs finite easting and northing');
  const dx = e - origin.e, dy = n - origin.n;
  state = { ...state, pos: [state.pos[0] - dx, state.pos[1] - dy, state.pos[2]] };
  origin = { e, n, id: origin.id + 1 };
  design.shift(dx, dy);
  invalidate();
  return { ...origin };
}

const target = () => (arrival ? ARRIVAL_FPS : fpsOf(VIEWS[state.view], input.get().slow));
const moving = () => input.active() || !!arrival;
const input = attachInput(canvas, $('pad'), {
  onChange: () => { if (input.active()) arrival = null; gate.setMoving(moving(), target()); gate.invalidate(); },
  onLook: (dy, dp) => { arrival = null; state = look(state, dy, dp); gate.invalidate(); },
  onView: v => chooseView(toggle(state.view, v)),
  onClick: (x, y) => design.pickAt(x, y)
});

// Flies the drone smoothly to hover above local [x, y], looking down; any movement key takes over.
function flyTo(x, y, opts = {}) {
  if (state.view !== 'aerial') chooseView('aerial', { arrive: false });
  if (Math.hypot(x - state.pos[0], y - state.pos[1]) > JUMP_M) { // a far place: move the origin there, drop in from above
    const p = toBng(origin, x, y);
    setOrigin(Math.round(p.e / 1000) * 1000, Math.round(p.n / 1000) * 1000);
    [x, y] = toLocal(origin, p.e, p.n);
    state = { ...state, pos: [x, y, heightAt(x, y) + 400] };
  }
  arrival = { pose: arrive(state, [x, y, heightAt(x, y)], { ...ARRIVAL, ...opts }), t0: performance.now() };
  gate.setMoving(true, ARRIVAL_FPS);
}

function draw(now, intervalMs) {
  for (const f of hooks.before) f(now);
  if (arrival) {
    const t = (now - arrival.t0) / 1000;
    state = { ...state, ...arrival.pose(t) };
    if (arrival.pose.done(t)) { arrival = null; gate.setMoving(moving(), target()); }
  } else if (input.active()) {
    const i = input.get(), dt = Math.min(intervalMs / 1000, MAX_DT);
    if (i.turn) state = look(state, i.turn * dt, 0);
    state = step(state, i, dt, heightAt, solids());
    budget = adjust(budget, intervalMs, 1000 / target());
  }
  const r = arrival ? null : rebaseIfNeeded(origin, state.pos);
  if (r) setOrigin(r.e, r.n);
  // Ground can arrive after the viewer does (tiles stream in): a walker's eye follows it, a drone keeps clear.
  const v = VIEWS[state.view], g = heightAt(state.pos[0], state.pos[1]);
  if (v.eye !== null && Math.abs(state.pos[2] - (g + v.eye)) > 1e-6) state = { ...state, pos: [state.pos[0], state.pos[1], g + v.eye] };
  if (v.eye === null && state.pos[2] < g + AERIAL_MIN_CLEARANCE) state = { ...state, pos: [state.pos[0], state.pos[1], g + AERIAL_MIN_CLEARANCE] };
  lines.resize(budget.scale);
  // The view is built at the eye; lines.draw moves each batch by (its origin - eye) in doubles.
  const mat = multiply(perspective(FOV, canvas.width / canvas.height, 0.05, 5000), view([0, 0, 0], state.yaw, state.pitch));
  lastBatches = collect(state.pos);
  vertices = lines.draw(mat, state.pos, fadeAt(), lastBatches);
  writeReadout();
  groundReadout?.update();
  for (const f of hooks.after) f(now);
}

// What the layers and the design draw around a position; the flat screen and the headset view both draw from this.
function collect(pos) {
  const ctx = { pos, heightAt, measuredAt, known, groundVersion, origin: { ...origin } };
  return shown().flatMap(l => (typeof l.layer.lines === 'function' ? guarded(l, () => l.layer.lines(ctx), []) : [])).concat(design.batches());
}

function chooseView(v, { arrive: fly = true } = {}) {
  const next = setView(state, v, heightAt);
  if (blocked(next.pos, VIEWS[v].body, solids())) return; // e.g. no standing up under a table
  const from = state.view;
  state = next; arrival = null;
  for (const b of document.querySelectorAll('[data-view]')) b.setAttribute('aria-pressed', String(b.dataset.view === v));
  $('lift').hidden = v !== 'aerial';
  if (v !== 'aerial') input.setLift(0);
  if (fly && v === 'aerial' && from !== 'aerial') flyTo(state.pos[0], state.pos[1]);
  gate.setMoving(moving(), target());
  gate.invalidate();
}

function writeReadout() {
  const [x, y, z] = state.pos, g = heightAt(x, y), v = VIEWS[state.view], p = toBng(origin, x, y);
  let place = `E ${p.e.toFixed(1)} · N ${p.n.toFixed(1)}`;
  try { place = `${gridRef(p.e, p.n, 10)} · ${place}`; } catch { /* off the national grid: local metres only */ }
  const src = groundSource(x, y);
  // The ground word comes early so a narrow phone, which cuts the line short, still shows it.
  where.textContent = `${v.label} · ${src ? GROUND_WORDS[src] || src : 'flat, no LiDAR yet'} · eye ${(z - g).toFixed(2)} m · ${place}`;
  // When still, no frame is drawn, so the rate is 0 whatever the last second's counter still holds.
  status.textContent = `${moving() || tourPlaying() ? gate.fps() : 0} fps now (moving ${v.fps}, precise ${v.slowFps}, still 0) · ${budget.scale}× resolution · ` +
    `${vertices / 2} lines · ${loaded.layers.map(l => `${l.id}: ${statusLine(l)}`).join('; ') || 'no layers'}`;
}

// ---- page controls ----------------------------------------------------------------------------------
for (const b of document.querySelectorAll('[data-view]')) b.addEventListener('click', () => { chooseView(b.dataset.view); canvas.focus(); });
// One panel at a time: Find, Design, Layers and Controls share the space under the dash on a phone.
let search = null;
const panels = { 'help-toggle': 'help', 'design-toggle': 'design', 'find-toggle': 'find', 'layers-toggle': 'layers' };
// GridAtlas opens at the spot you are standing on (latitude, longitude and zoom only; no project reference).
$('to-gridatlas').addEventListener('click', () => {
  const url = gridAtlasUrl({ origin, pos: state.pos });
  if (url) open(url, '_blank', 'noopener');
});
function openPanel(btn, open) {
  if (btn === 'find-toggle') { if (search) (open ? search.open() : search.close()); }
  else $(panels[btn]).hidden = !open;
  $(btn).setAttribute('aria-expanded', String(open));
  if (btn === 'design-toggle' && !open) design.putDown(); // closing Design puts the tool down
}
for (const btn of Object.keys(panels)) {
  $(btn).addEventListener('click', () => {
    const open = $(btn).getAttribute('aria-expanded') !== 'true';
    for (const o of Object.keys(panels)) if (o !== btn && $(o).getAttribute('aria-expanded') === 'true') openPanel(o, false);
    openPanel(btn, open);
  });
}
for (const b of document.querySelectorAll('[data-lift]')) {
  const hold = e => { e.preventDefault(); input.setLift(Number(b.dataset.lift)); };
  const release = () => input.setLift(0);
  b.addEventListener('pointerdown', hold);
  for (const t of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(t, release);
}
addEventListener('resize', () => gate.invalidate());
setInterval(() => { if (!moving() && !tourPlaying()) { writeReadout(); groundReadout?.update(); } layersUi?.refresh(); }, 1000); // text only: no frame is drawn

// The full credit lines under Controls, for exactly the data on screen; the footer line is written by layers-ui.mjs.
let attribution = null;
function writeCredits() {
  if (!attribution) return;
  $('credits').replaceChildren(...aboutList(sourceKeysFor(shown().map(l => l.id)), attribution).map(c => {
    const li = document.createElement('li'), a = document.createElement('a');
    a.href = c.link || c.licence_url || '#'; a.target = '_blank'; a.rel = 'noopener';
    a.textContent = `${c.line} (${c.licence})`; li.append(a); return li;
  }));
}

// Find: a REPD project, postcode or "lat, lon"; the drone flies there. Near the staged site there is terrain.
function mountFind(createSearchPanel) {
  const siteNear = (lat, lon) => {
    if (!loaded.site) return false;
    const p = wgs84ToBng(lat, lon);
    return Math.abs(p.e - loaded.site.centre_e) <= SITE_HALF_M && Math.abs(p.n - loaded.site.centre_n) <= SITE_HALF_M;
  };
  const loadIndex = () => fetch('./world/data/projects.json', { cache: 'no-cache' })
    .then(r => { if (!r.ok) throw Error(`HTTP ${r.status}`); return r.json(); });
  search = createSearchPanel(document.body, {
    loadIndex, attribution, hasTerrain: siteNear, liveTerrain: true,
    onChoose: ({ lat, lon, e, n }) => { // a postcode brings its own national-grid figures
      const p = Number.isFinite(e) && Number.isFinite(n) ? { e, n } : wgs84ToBng(lat, lon), [x, y] = toLocal(origin, p.e, p.n);
      openPanel('find-toggle', false);
      flyTo(x, y, { height: 150 });
      canvas.focus();
    }
  });
  search.element.id = 'find';
  // Test sites (staged locally) sit under the search; project-ui.mjs fills the list and shows it.
  const sites = document.createElement('section'), h = document.createElement('h3'), box = document.createElement('div');
  Object.assign(sites, { id: 'site-section', className: 'site-section', hidden: true });
  h.textContent = 'Test sites'; box.id = 'site-box';
  sites.append(h, box); search.element.append(sites);
  // Escape inside the box closes it; keep the Find button in step.
  search.element.addEventListener('keydown', e => { if (e.key === 'Escape') $('find-toggle').setAttribute('aria-expanded', 'false'); });
}

try {
  // Optional layers that start off load on first switch-on (review E); the sun and buffer controls need theirs now.
  const deferred = OPTIONAL_LAYERS.map(l => l.id).filter(id => !['grid', 'shade', 'buffers'].includes(id));
  loaded = await loadLayers('./world/manifest.json', { invalidate, origin: () => origin, site: await siteFromUrl(), deferred });
} catch (e) {
  loaded = { generation: '', layers: [{ id: 'manifest', status: 'failed: ' + e.message }] };
}
// Live ground from the EA service wherever the staged tiles do not reach. It comes after the staged terrain
// layer, so staged, hash-checked tiles always win where both exist; boxes inside a staged site are not fetched.
{
  const staged = loaded.layers.find(l => l.id === 'terrain');
  const skip = (e0, n0, size) => {
    if (!staged?.layer || staged.layer.debug?.().indexState === 'failed' || !loaded.site) return false;
    const { centre_e: ce, centre_n: cn } = loaded.site;
    return e0 >= ce - SITE_HALF_M && n0 >= cn - SITE_HALF_M && e0 + size <= ce + SITE_HALF_M && n0 + size <= cn + SITE_HALF_M;
  };
  const layer = createLiveTerrain({ origin: () => origin, invalidate: () => invalidate(), skip });
  let failed = null; // set by guarded() if the layer throws; otherwise the status is the layer's own, live
  loaded.layers.push({ id: layer.id, layer, set status(t) { failed = t; },
    get status() { return failed || 'not hash-checked'; } }); // the Controls line adds the layer's own words in brackets
}
// A site places the world: its centre becomes the origin, so the viewer starts in the middle of the land.
if (loaded.site) origin = { e: loaded.site.centre_e, n: loaded.site.centre_n, id: origin.id + 1 };
chooseView('standing');

// ---- after the first frame ----------------------------------------------------------------------------
await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
const [{ createDesign }, { createSearchPanel }, { mountPlan }, { mountProject }, { attachHeadset }, { mountLayersUi },
  { mountSunControl }, { mountBuffers }, { mountGroundReadout }] = await Promise.all(TOOLS.map(p => import(p)));
design = createDesign({ doc: document, canvas, fov: FOV, baseHeight, origin: () => origin, viewer: () => state,
  invalidate, redraw: () => gate.invalidate(), assets: gridAssets, measuredAt,
  // The nearest substation anywhere, from the grid layer's national index (tiles read as needed).
  nearest: async (e, n) => live().find(l => l.id === 'grid')?.layer?.nearestSubstation?.(e, n) ?? null,
  onChange: () => hooks.design.forEach(f => f()) });
design.setGroundVersion(() => groundVersion);
await design.loadCatalogue();
invalidate(); // the ground now comes through the design (trenches, roads and pads cut into it)
try { attribution = await (await fetch('./world/data/attribution.json', { cache: 'no-cache' })).json(); } catch { /* the fixed footer stays */ }
// Layers panel, from the dash's Layers button; GridAtlas sits in its header. Grid starts on; the rest start off.
const shade = loaded.layers.find(l => l.id === 'shade' && l.layer);
let sunUi = null; // the date and time control, shown while the terrain shadow is on
const buffers = mountBuffers({ layer: loaded.layers.find(l => l.id === 'buffers' && l.layer)?.layer, origin: () => origin, design: () => design.snapshot() });
try {
  layersUi = mountLayersUi({ items: loaded.layers, host: $('layers-slot'), footer: $('attribution'), attribution,
    invalidate: () => gate.invalidate(),
    onChange: ids => { sunUi?.show(ids.includes('shade')); buffers?.refresh(ids.includes('buffers')); writeCredits();
      groundReadout?.reset(); groundReadout?.update(); } });
} catch (e) { console.warn('layers panel: not wired: ' + e.message); }
if (buffers) setInterval(() => buffers.refresh(layersUi?.panel.isOn('buffers')), 1000); // origin moves, new drawn items
try { sunUi = mountSunControl($('layers-slot'), { layer: shade?.layer, site: loaded.site }); sunUi?.show(!!layersUi?.panel.isOn('shade')); }
catch (e) { console.warn('sun control: ' + e.message); }
// Escape inside the list closes the Layers panel and hands focus back to its dash button.
layersUi?.panel.element.addEventListener('close', () => { openPanel('layers-toggle', false); $('layers-toggle').focus(); });
// Ground readout: under the walker's feet, and along the last finished trench or cable (Design panel).
const panelOpen = () => Object.keys(panels).some(b => $(b).getAttribute('aria-expanded') === 'true');
groundReadout = mountGroundReadout({ doc: document, layer: () => live().find(l => l.id === 'ground')?.layer || null,
  on: () => !!layersUi?.panel.isOn('ground'), feet: $('ground-feet'), box: $('ground-readout'), finished: design.lastFinished,
  here: () => toBng(origin, state.pos[0], state.pos[1]), walking: () => state.view === 'standing' && !panelOpen() });
writeCredits();
mountFind(createSearchPanel);

// What extensions may read and change. The design stays in national-grid metres; replace swaps it whole.
const api = {
  canvas, gate, hooks, live, guarded, heightAt, invalidate, FOV, FADE_M, VIEWS, flyTo,
  state: () => state, origin: () => ({ ...origin }), site: () => loaded.site || null, generation: () => loaded.generation,
  batches: () => lastBatches, redraw: () => draw(performance.now(), 0), moving: () => input.active(), attribution: () => attribution,
  setPose(p) { arrival = null; state = { ...state, ...p }; gate.invalidate(); },
  setView: v => { if (state.view !== v) chooseView(v, { arrive: false }); },
  resumeGate: () => gate.setMoving(moving(), target()), // after a tour pauses, the walk carries on at its own rate
  design: () => design.snapshot(), replaceDesign: d => design.replace(d)
};
const plan = mountPlan(api);
const project = mountProject(api);
tourPlaying = project.playing;
// Headset view (in Controls): hidden where the browser cannot run it; on leaving, the flat screen carries on from there.
attachHeadset($('headset'), {
  lines, heightAt, solids, collect, fade: FADE_M, state: () => state,
  leave: next => { state = { ...state, ...next }; chooseView(state.view, { arrive: false }); }
});

// For tests and the console. Read-only views of the live state, and the origin and arrival hooks.
window.world = Object.freeze({
  origin: () => ({ ...origin }), groundVersion: () => groundVersion, setOrigin, heightAt, measuredAt, groundSource,
  liveTerrain: () => live().find(l => l.id === 'terrain-live')?.layer.debug() ?? null,
  state: () => state, budget: () => budget, fps: () => gate.fps(), generation: () => loaded.generation,
  layers: () => loaded.layers.map(({ id, status, layer }) => ({ id, status, detail: layer?.status ?? null })), // detail: the layer's own word
  // Flies the drone to national-grid (e, n): the arrival is smooth and capped at 30 fps.
  flyTo: (e, n, opts) => { const [x, y] = toLocal(origin, e, n); flyTo(x, y, opts); },
  plan, project,
  layersOn: () => layersUi?.panel.onIds() || [], setLayer: (id, on) => layersUi?.panel.set(id, on),
  design: () => design.snapshot() // the design in memory, in national-grid metres (export and import come later)
});
