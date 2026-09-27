// The substrate: an empty world you can move around in. It owns the loop, the camera and the views;
// everything you see comes from layers listed in manifest.json, plus the design being drawn (trenches and cables).
// Positions are local metres from the site origin, which is held in float64 British National Grid metres
// (0, 0 until a site is chosen). setOrigin moves the origin and shifts the viewer so they stay put in the world;
// walking more than 600 m from the origin moves it to the nearest whole kilometre (origin.mjs).
// The design is kept in memory in national-grid metres, so it survives every move of the origin.

import { gridAtlasUrl } from './links.mjs';
import { perspective, view, multiply } from './camera.mjs';
import { VIEWS, fpsOf, step, look, setView, toggle, standOn, AERIAL_MIN_CLEARANCE } from './views.mjs';
import { createFrameGate } from './frame-gate.mjs';
import { initialBudget, adjust } from './device-budget.mjs';
import { createLines } from './lines.mjs';
import { attachInput } from './input.mjs';
import { loadLayers, statusLine } from './layers.mjs';
import { rebaseIfNeeded, toBng, toLocal } from './origin.mjs';
import { arrive } from './arrival.mjs';
import { gridRef } from './bng.mjs';
import { aboutList } from './attribution.mjs';
import { siteFromUrl } from './sites-ui.mjs';
import { sourceKeysFor, OPTIONAL_LAYERS } from './layers-panel.mjs';
import { createLiveTerrain } from './wcs-terrain.mjs';
import { attachLift, TAP_M } from './lift.mjs';
import { fadeFor, farPlane, FADE_M } from './fade.mjs';
// Design, Find, the project tools (file, print, tour, phases), the plan inset, the headset view and the layer
// panels load just after the first frame, not before it (review E, win 2): see "after the first frame" below.
const TOOLS = ['./design-ui.mjs', './find-mount.mjs', './plan-wire.mjs', './project-ui.mjs', './xr.mjs', './layers-ui.mjs',
  './sun-ui.mjs', './buffers-ui.mjs', './ground-readout.mjs', './sun-mode.mjs', './first-showing.mjs', './ohl-ui.mjs', './sld-hook.mjs', './help.mjs', './accuracy.mjs'];

const $ = id => document.getElementById(id);
const canvas = $('view'), where = $('where-line'), status = $('status');
// Layer diagnostics sit behind a closed "Layer details" in Controls; ?debug=1 opens them.
if (new URLSearchParams(location.search).get('debug') === '1') $('layer-details').open = true;
const fadeAt = () => fadeFor(state.view, state.pos[2] - heightAt(state.pos[0], state.pos[1]), layersUi?.rangeM() || 0, design.plantApi?.extentM() || 0) * mag; // x mag: binoculars
const FOV = 70 * Math.PI / 180, MAX_DT = 0.1, ARRIVAL_FPS = 30, ARRIVAL = { height: 80, seconds: 3 }, fov = () => 2 * Math.atan(Math.tan(FOV / 2) / mag);
const JUMP_M = 3000;      // further than this, Find moves the origin and drops in from above instead of flying across
const SITE_HALF_M = 1024; // half the staged site's side: terrain tiles exist within this of its centre
const OBLIQUE = { pitch: -35 * Math.PI / 180, back: 150 }; // arriving at a found place: 35 degrees down from 150 m out

let state = { view: 'standing', pos: [0, -25, 0], yaw: 0, pitch: -0.12 };
let budget = initialBudget(devicePixelRatio);
let loaded = { generation: '', layers: [] }, vertices = 0, readAt = -1e9; // readAt: the status line is written at most 4 times a second while moving
let origin = { e: 0, n: 0, id: 0 };
let groundVersion = 0; // bumped whenever a layer says new ground has arrived, or the origin moves
let lastGround = 0;    // the last ground height found near the viewer; used where no layer knows the height
let arrival = null;    // { pose, t0 } while the drone flies itself somewhere
const GROUND_MEMORY_M = 20;
// Hooks: before/after each frame; items: design-file items; open: each design opened; batches: extra lines (sld-mount.mjs); filter: last (xray-ui.mjs).
const hooks = { before: new Set(), after: new Set(), design: new Set(), items: new Set(), open: new Set(), batches: new Set(), filter: new Set(), commands: new Set() };
let lastBatches = [], driver = null; // commands: typed lines an extension answers; driver: buggy-ui.mjs moves the viewer instead of the walk step
let modules = null, legs = null, mag = 1, nav = null; // module-mount.mjs; jump.mjs (a walker's height), binoculars (mag); nav-flight.mjs
let sunMode = null, first = null; // after the first frame: sun-mode.mjs (plays at up to 30 fps), first-showing.mjs (cards, pin)
let tourPlaying = () => false; // set once the project tools are mounted: a playing tour draws at 30 fps

const live = () => loaded.layers.filter(l => l.layer);
let layersUi = null, groundReadout = null, ohl = null, accuracy = null; // accuracy.mjs, after the first frame; the Layers panel (dash button, layers-ui.mjs): an optional layer switched off is hidden
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
  for (const l of live()) if (typeof l.layer.heightAt === 'function') { const h = guarded(l, () => l.layer.heightAt(x, y), NaN); if (Number.isFinite(h)) return h; }
  return NaN;
};
// Whether a layer measured the ground at (x, y): off it, layers leave out what would stand there (water and roads
// past the LiDAR).
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
const solids = () => shown().flatMap(l => (typeof l.layer.solids === 'function' ? guarded(l, () => l.layer.solids({ pos: state.pos }), []) : []))
  .concat([...(hooks.solids || [])].flatMap(f => { try { return f(state.pos); } catch { return []; } })); // + design tables (table-solids.mjs)

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
// Every known tower, national grid metres: the grid layer's and the national layer's near band (for the canopy mask).
const knownTowers = () => [...gridAssets().filter(a => a.kind === 'tower'),
  ...(live().find(l => l.id === 'national')?.layer?.towers?.() || [])];
// Until design-ui.mjs arrives (just after the first frame) the ground is the layers' own and nothing is designed.
let design = Object.freeze({ heightAt: (x, y) => baseHeight(x, y), batches: () => [], pickAt() {}, shift() {}, putDown() {},
  snapshot: () => ({ tool: null, trenches: [], cables: [], works: [], draft: [], readout: null }), lastFinished: () => null, replace() {}, animating: () => false });

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

// Sun play and the solar block's build sequence (Design) both ask for frames at their own rate; paused, nothing.
const playing = () => !!sunMode?.playing() || design.animating() || !!driver?.moving();
const target = () => (arrival ? ARRIVAL_FPS : !input.active() && playing() ? (sunMode?.playing() ? sunMode.PLAY_FPS : ARRIVAL_FPS) : fpsOf(VIEWS[state.view], input.get().slow));
const moving = () => input.active() || !!arrival || playing() || !!legs?.busy();
const input = attachInput(canvas, $('pad'), {
  onChange: () => { if (input.active()) arrival = null; gate.setMoving(moving(), target()); gate.invalidate(); },
  onLook: (dy, dp) => { arrival = null; state = look(state, dy / mag, dp / mag); gate.invalidate(); },
  onView: v => chooseView(toggle(state.view, v)),
  onClick: (x, y) => { if (!modules?.tap(x, y)) design.pickAt(x, y); } // a tap on a detailed module inspects it
});

// Flies the drone smoothly to hover above local [x, y], looking down; any movement key takes over.
function flyTo(x, y, opts = {}) { // a far place moves the origin and drops in; across a plant the drone glides (nav-flight.mjs glides)
  if (state.view !== 'aerial') chooseView('aerial', { arrive: false });
  const pb = nav && design?.plantApi?.result?.() && design.plantApi.boundary(), box = pb && nav.boxOfPoints(pb.map(([e, n]) => toLocal(origin, e, n)));
  if (nav ? !nav.glides(state.pos, [x, y], box) : Math.hypot(x - state.pos[0], y - state.pos[1]) > JUMP_M) {
    const p = toBng(origin, x, y);
    setOrigin(Math.round(p.e / 1000) * 1000, Math.round(p.n / 1000) * 1000);
    [x, y] = toLocal(origin, p.e, p.n);
    state = { ...state, pos: [x, y, heightAt(x, y) + 400] };
  }
  // back: stand off this far behind the point (along the current heading), so a pitch above straight down still sees it.
  const { back = 0, ...rest } = opts, yaw = rest.yaw ?? state.yaw, g = heightAt(x, y), g0 = heightAt(state.pos[0], state.pos[1]);
  const at = [x - back * Math.sin(yaw), y - back * Math.cos(yaw), g], height = back && rest.pitch ? back * Math.tan(-rest.pitch) : (rest.height ?? ARRIVAL.height);
  // nav-flight.mjs descend eases through log(height) in 2-5 s; until it has loaded (after the first frame), arrival.mjs arrive.
  const pose = nav ? nav.descend(state, [x, y, g], { ...rest, back, yaw, groundFrom: g0 }) : arrive(state, at, { ...ARRIVAL, ...rest, yaw, height });
  arrival = { pose, t0: performance.now() }; gate.setMoving(true, ARRIVAL_FPS);
}
function draw(now, intervalMs) {
  for (const f of hooks.before) f(now);
  sunMode?.advance(intervalMs);
  if (arrival) {
    const t = (now - arrival.t0) / 1000;
    state = { ...state, ...arrival.pose(t) };
    if (arrival.pose.done(t)) { arrival = null; gate.setMoving(moving(), target()); }
  } else if (driver && state.view === 'standing') { state = driver.frame(state, input.get(), intervalMs); } else if (input.active() || legs?.busy()) {
    const i = input.get(), dt = Math.min(intervalMs / 1000, MAX_DT);
    if (i.turn) state = look(state, i.turn * dt / mag, 0);
    state = (legs || { step }).step(state, i, dt, heightAt, solids());
    budget = adjust(budget, intervalMs, 1000 / target());
  }
  const r = arrival ? null : rebaseIfNeeded(origin, state.pos);
  if (r) setOrigin(r.e, r.n);
  // Ground can arrive after the viewer does (tiles stream in): a walker's eye follows it (jump.mjs: or a top, or the air), a drone keeps clear.
  const v = VIEWS[state.view], g = heightAt(state.pos[0], state.pos[1]);
  if (!driver && v.eye !== null) state = legs ? legs.hold(state, heightAt, solids()) : Math.abs(state.pos[2] - (g + v.eye)) > 1e-6 ? { ...state, pos: [state.pos[0], state.pos[1], g + v.eye] } : state;
  if (v.eye === null && state.pos[2] < g + AERIAL_MIN_CLEARANCE) state = { ...state, pos: [state.pos[0], state.pos[1], g + AERIAL_MIN_CLEARANCE] };
  lines.resize(budget.scale);
  // The view is built at the eye; lines.draw moves each batch by (its origin - eye) in doubles.
  const fade = fadeAt(), mat = multiply(perspective(fov(), canvas.width / canvas.height, 0.05, farPlane(fade)), view([0, 0, 0], state.yaw, state.pitch));
  lastBatches = collect(state.pos);
  vertices = lines.draw(mat, state.pos, fade, lastBatches);
  if (now - readAt >= 250) { readAt = now; writeReadout(); } // the status line at most 4 times a second while moving (PERF.md 7)
  groundReadout?.update();
  sunMode?.afterDraw({ pos: state.pos, heightAt, groundVersion });
  for (const f of hooks.after) f(now);
}

// What the layers and the design draw around a position; the flat screen and the headset view both draw from this.
function collect(pos) {
  const ctx = { pos, heightAt, measuredAt, known, groundVersion, origin: { ...origin }, sun: sunMode?.sun(), view: state.view }; // view: imagery shows in Drone and Map, never Walk
  const batches = shown().flatMap(l => (typeof l.layer.lines === 'function' ? guarded(l, () => l.layer.lines(ctx), []) : []));
  const out = (sunMode ? sunMode.decorate(batches, ctx) : batches).concat(design.batches(), first?.batches() || [], modules?.batches() || [],
    [...hooks.batches].flatMap(f => f()));
  return [...hooks.filter].reduce((o, f) => f(o, ctx), out); // filters last, e.g. the as-built X-ray (xray-ui.mjs)
}

function chooseView(v, { arrive: fly = true } = {}) {
  const next = standOn(setView(state, v, heightAt), VIEWS[v], solids()); // over a table: stand on it (table-solids.mjs)
  if (!next) return; // e.g. no standing up inside a solid
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
  // On screen: a grid reference and the ground (its height above sea level where measured); exact numbers in Layer details.
  let ref = '';
  try { ref = gridRef(p.e, p.n, 8) + ' · '; } catch { /* off the national grid */ }
  const src = groundSource(x, y), known = Number.isFinite(measuredAt(x, y)), up = v.eye === null ? ` · ${Math.round(z - g)} m up` : '';
  where.textContent = `${ref}${known ? `ground ${Math.round(g)} m above sea level` : src ? GROUND_WORDS[src] || src : 'flat, no LiDAR yet'}${up}`;
  $('where-detail').textContent = `${v.label} · ${src ? GROUND_WORDS[src] || src : 'flat, no LiDAR yet'} · easting ${p.e.toFixed(1)} m, ` +
    `northing ${p.n.toFixed(1)} m · ${typeof accuracy?.groundWords === "function" ? accuracy.groundWords(src, g, z - g, known) : `eye ${(z - g).toFixed(1)} m above the ground`}`;
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
  const shown = Object.keys(panels).find(b => $(b).getAttribute('aria-expanded') === 'true');
  if (shown) document.body.dataset.panel = panels[shown]; else delete document.body.dataset.panel;
  if (btn === 'find-toggle' && open) first?.dismissStart();
}
for (const btn of Object.keys(panels)) {
  $(btn).addEventListener('click', () => {
    const open = $(btn).getAttribute('aria-expanded') !== 'true';
    for (const o of Object.keys(panels)) if (o !== btn && $(o).getAttribute('aria-expanded') === 'true') openPanel(o, false);
    openPanel(btn, open);
  });
}
// Up and Down: hold to climb or sink; a quick tap moves the drone 10 m (lift.mjs).
attachLift(document.querySelectorAll('[data-lift]'), { setLift: d => input.setLift(d), tap: d => {
  if (state.view !== 'aerial') return;
  const [x, y, z] = state.pos, floor = heightAt(x, y) + AERIAL_MIN_CLEARANCE;
  state = { ...state, pos: [x, y, Math.max(floor, z + d * TAP_M)] }; gate.invalidate();
} });
addEventListener('resize', () => gate.invalidate());
setInterval(() => { if (!moving() && !tourPlaying()) { writeReadout(); groundReadout?.update(); } layersUi?.refresh(); ohl?.update(); }, 1000); // text only: no frame is drawn

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

try {
  // Optional layers that start off load on first switch-on (review E); the sun and buffer controls need theirs now.
  loaded = await loadLayers('./world/manifest.json', { invalidate, origin: () => origin, towers: knownTowers, site: await siteFromUrl(), started: item => item.layer?.mountControls?.(document.body),
    deferred: OPTIONAL_LAYERS.map(l => l.id).filter(id => !['grid', 'shade', 'buffers'].includes(id)), first: ['terrain', 'ground-grid'] }); // the ground first
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
const nearestSub = async (e, n) => live().find(l => l.id === 'grid')?.layer?.nearestSubstation?.(e, n) ?? null; // national index
const [{ createDesign }, { mountFind }, { mountPlan }, { mountProject }, { attachHeadset }, { mountLayersUi },
  { mountSunControl }, { mountBuffers }, { mountGroundReadout }, { attachSunMode }, { mountFirstShowing }, { attachOhl }, { sldHook }, , accuracyModule] = await Promise.all(TOOLS.map(p => import(p)));
accuracy = accuracyModule; await loaded.rest; // grid, shade and buffers start just after the first frame; their controls need them
design = createDesign({ doc: document, canvas, fov, baseHeight, origin: () => origin, viewer: () => state, extraItems: () => ohl?.layer.boqItems() ?? [],
  ohlZones: () => ohl?.layer.zonesEN() ?? null, // the plant layout keeps tables out of the overhead line zones
  invalidate, redraw: () => gate.invalidate(), release: key => lines.release(key), assets: gridAssets, measuredAt, nearest: nearestSub, onChange: () => hooks.design.forEach(f => f()),
  animate: () => gate.setMoving(moving(), target()) });
design.setGroundVersion(() => groundVersion);
await design.loadCatalogue();
invalidate(); // the ground now comes through the design (trenches, roads and pads cut into it)
try { attribution = await (await fetch('./world/data/attribution.json', { cache: 'no-cache' })).json(); } catch { /* the fixed footer stays */ }
// Layers panel, from the dash's Layers button; GridAtlas sits in its header. Grid starts on; the rest start off.
const shade = loaded.layers.find(l => l.id === 'shade' && l.layer); let sunUi = null; // the shadow's date and time (sun-ui.mjs)
const dv = { design: () => design.snapshot(), designVersion: () => design.version?.(), origin: () => origin }; // keyed on the version, copied on change
ohl = attachOhl(loaded.layers, { ...dv, measuredAt, invalidate: () => gate.invalidate() }); // overhead line zones, on whenever the grid is
const buffers = mountBuffers({ layer: loaded.layers.find(l => l.id === 'buffers' && l.layer)?.layer, ...dv });
try {
  layersUi = mountLayersUi({ items: loaded.layers, host: $('layers-slot'), footer: $('attribution'), attribution,
    invalidate: () => gate.invalidate(),
    onChange: ids => { sunUi?.show(ids.includes('shade') && !sunMode?.on()); buffers?.refresh(ids.includes('buffers')); writeCredits();
      ohl?.onChange(ids, () => layersUi?.panel); groundReadout?.reset(); groundReadout?.update(); } });
} catch (e) { console.warn('layers panel: not wired: ' + e.message); }
if (buffers) setInterval(() => buffers.refresh(layersUi?.panel.isOn('buffers')), 1000); // origin moves, new drawn items
ohl.mount($('layers-slot'), () => layersUi?.panel);
try { sunUi = mountSunControl($('layers-slot'), { layer: shade?.layer, site: loaded.site }); sunUi?.show(!!layersUi?.panel.isOn('shade')); }
catch (e) { console.warn('sun control: ' + e.message); }
// Sun mode (Sun switch in Layers): switches the terrain shadow on through the panel, shows its time bar, lights the grid.
try {
  sunMode = attachSunMode({ pos: () => state.pos, heightAt, origin: () => origin, site: () => loaded.site,
    layer: id => live().find(l => l.id === id)?.layer || null, base: new URL('./world/', location.href).href,
    setShade: on => { if (layersUi && layersUi.panel.isOn('shade') !== on) layersUi.panel.set('shade', on); },
    onToggle: on => sunUi?.show(!on && !!layersUi?.panel.isOn('shade')), redraw: () => gate.invalidate(),
    onPlay: () => { gate.setMoving(moving(), target()); gate.invalidate(); } });
} catch (e) { console.warn('sun mode: ' + e.message); }
// Escape inside the list closes the Layers panel and hands focus back to its dash button.
layersUi?.panel.element.addEventListener('close', () => { openPanel('layers-toggle', false); $('layers-toggle').focus(); });
// Ground readout: under the walker's feet, and along the last finished trench or cable (Design panel).
const panelOpen = () => Object.keys(panels).some(b => $(b).getAttribute('aria-expanded') === 'true');
groundReadout = mountGroundReadout({ doc: document, layer: () => live().find(l => l.id === 'ground')?.layer || null,
  on: () => !!layersUi?.panel.isOn('ground'), feet: $('ground-feet'), box: $('ground-readout'), finished: design.lastFinished,
  here: () => toBng(origin, state.pos[0], state.pos[1]), walking: () => state.view === 'standing' && !panelOpen() });
writeCredits();
first = mountFirstShowing({ canvas, redraw: () => gate.invalidate(), origin: () => origin, heightAt, groundVersion: () => groundVersion,
  assets: gridAssets, nearest: nearestSub, openFind: () => { if ($('find-toggle').getAttribute('aria-expanded') !== 'true') $('find-toggle').click(); } });
search = mountFind({ site: () => loaded.site, attribution, origin: () => origin, SITE_HALF_M, first: () => first, canvas,
  close: () => openPanel('find-toggle', false), flyTo: (x, y) => flyTo(x, y, OBLIQUE) }); // find-mount.mjs

// What extensions may read and change. The design stays in national-grid metres; replace swaps it whole.
const api = {
  canvas, gate, hooks, live, guarded, heightAt, invalidate, get FOV() { return fov(); }, FADE_M, VIEWS, flyTo, solids, measuredAt,
  state: () => state, origin: () => ({ ...origin }), site: () => loaded.site || null, generation: () => loaded.generation,
  batches: () => lastBatches, redraw: () => draw(performance.now(), 0), moving: () => input.active(), attribution: () => attribution,
  setPose(p) { arrival = null; state = { ...state, ...p }; gate.invalidate(); }, setMagnification(m) { mag = Math.max(1, Number(m) || 1); gate.invalidate(); }, setLegs(l) { legs = l; },
  setView: v => { if (state.view !== v) chooseView(v, { arrive: false }); }, setDriver: d => { driver = d; arrival = null; gate.setMoving(moving(), target()); gate.invalidate(); },
  resumeGate: () => gate.setMoving(moving(), target()), // after a tour pauses, the walk carries on at its own rate
  design: () => design.snapshot(), replaceDesign: d => design.replace(d), input, solids, measuredAt // input, solids, setDriver: the buggy
};
const plan = mountPlan(api), sld = sldHook({ api, design, doc: document }), project = mountProject(api); // sld: diagram and Follow
modules = (await import('./module-mount.mjs')).mountModules(api, { block: design.blockApi, plant: design.plantApi });
tourPlaying = project.playing;
// Headset view (in Controls): hidden where the browser cannot run it; on leaving, the flat screen carries on from there.
attachHeadset($('headset'), { lines, heightAt, solids, collect, fade: FADE_M, state: () => state,
  leave: next => { state = { ...state, ...next }; chooseView(state.view, { arrive: false }); } });

// Solid ground (GPU), in Controls: raycast.mjs, only where WebGL2 exists, off by default, fetched on the first switch-on; hides if WebGL2 fails.
let raycast = null;
if (typeof WebGL2RenderingContext !== 'undefined' && $('raycast')) {
  const b = $('raycast'); b.hidden = false;
  b.addEventListener('click', async () => {
    try {
      if (!raycast) raycast = (await import('./raycast.mjs')).mountRaycast({ lines, canvas, get FOV() { return fov(); }, measuredAt, invalidate, doc: document,
        state: () => state, groundVersion: () => groundVersion, origin: () => ({ ...origin }), sun: () => sunMode?.sun() });
    } catch (e) { console.warn('solid ground: ' + e.message); raycast = null; }
    if (!raycast) { b.hidden = true; return; }
    const on = !raycast.on(); raycast.set(on); b.setAttribute('aria-pressed', String(on));
  });
}
// For tests and the console. Read-only views of the live state, and the origin and arrival hooks.
window.world = Object.freeze({
  raycast: () => raycast?.debug() ?? null, raycastApi: () => raycast,
  origin: () => ({ ...origin }), groundVersion: () => groundVersion, setOrigin, heightAt, measuredAt, groundSource,
  liveTerrain: () => live().find(l => l.id === 'terrain-live')?.layer.debug() ?? null,
  state: () => state, budget: () => budget, fps: () => gate.fps(), generation: () => loaded.generation,
  layers: () => loaded.layers.map(({ id, status, layer }) => ({ id, status, detail: layer?.status ?? null })), // detail: the layer's own word
  // Flies the drone to national-grid (e, n): the arrival is smooth and capped at 30 fps.
  flyTo: (e, n, opts) => { const [x, y] = toLocal(origin, e, n); flyTo(x, y, opts); },
  plan, project, ohl: () => ohl?.layer.debug() ?? null, layerDebug: id => live().find(l => l.id === id)?.layer?.debug?.() ?? null, setRange: mi => layersUi?.range?.set(mi),
  layersOn: () => layersUi?.panel.onIds() || [], setLayer: (id, on) => layersUi?.panel.set(id, on),
  sun: () => sunMode?.debug() ?? null, place: () => first?.place() ?? null, // the place last found and pinned
  design: () => design.snapshot(), // the design in memory, in national-grid metres
  // Plant layout, Solar block, automatic piles, single-line diagram (world.sld), module detail on zoom (module-mount.mjs)
  plant: design.plantApi, block: design.blockApi, piles: design.pilesApi, sld, module: modules.api
});
// The command line (cmd-mount.mjs): a key and a dash button only; the bar and its engines load on first use. The Key (legend-ui.mjs).
import('./cmd-mount.mjs').then(m => { window.worldCmd = m.mountCommandLine({ api, world: window.world, project, ohl }); }).catch(e => console.warn('command line: ' + e.message));
import('./legend-ui.mjs').then(m => { window.worldLegend = m.mountLegend({ api }); }).catch(e => console.warn('key: ' + e.message)); // what the colours mean
// Buggy, check HUD, jump and binoculars, and more: extensions.mjs, each loaded after the first frame in its own chunk.
import('./extensions.mjs').then(m => m.mountExtensions({ api })).catch(e => console.warn('extensions: ' + e.message));
import('./nav-flight.mjs').then(m => { nav = m; }).catch(e => console.warn('flights: ' + e.message)); // glides and log-height descents
