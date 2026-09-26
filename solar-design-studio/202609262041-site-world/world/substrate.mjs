// The substrate: an empty world you can move around in. It owns the loop, the camera and the views;
// everything you see comes from layers listed in manifest.json. Nothing here knows what a layer draws.
// Positions are local metres from the site origin, which is held in float64 British National Grid metres
// (0, 0 until a site is chosen). setOrigin moves the origin and shifts the viewer so they stay put in the world.

import { perspective, view, multiply } from './camera.mjs';
import { VIEWS, fpsOf, step, look, setView, toggle, blocked, AERIAL_MIN_CLEARANCE } from './views.mjs';
import { createFrameGate } from './frame-gate.mjs';
import { initialBudget, adjust } from './device-budget.mjs';
import { createLines } from './lines.mjs';
import { attachInput } from './input.mjs';
import { loadLayers } from './layers.mjs';

const $ = id => document.getElementById(id);
const canvas = $('view'), where = $('where'), status = $('status');
const FADE_M = 450, FOV = 70 * Math.PI / 180, MAX_DT = 0.1;

let state = { view: 'standing', pos: [0, -25, 0], yaw: 0, pitch: -0.12 };
let budget = initialBudget(devicePixelRatio);
let loaded = { generation: '', layers: [] }, vertices = 0;
let origin = { e: 0, n: 0, id: 0 };
let groundVersion = 0; // bumped whenever a layer says new ground has arrived, or the origin moves
let lastGround = 0;    // the last ground height found near the viewer; used where no layer knows the height
const GROUND_MEMORY_M = 20;

const live = () => loaded.layers.filter(l => l.layer);
// A layer that throws is switched off and named; it never takes the rest of the world down with it.
const guarded = (l, fn, fallback) => {
  try { return fn(); } catch (e) { l.layer = null; l.status = 'failed and switched off: ' + e.message; return fallback; }
};
const heightAt = (x, y) => {
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
// Solids are what a person or drone cannot pass through; layers declare them as boxes in local metres.
const solids = () => live().flatMap(l => (typeof l.layer.solids === 'function' ? guarded(l, () => l.layer.solids({ pos: state.pos }), []) : []));

const lines = createLines(canvas, { onRestore: () => gate.invalidate() });
const gate = createFrameGate(draw);
// A layer asks for a redraw; { ground: true } (the default) also says new ground has arrived.
const invalidate = ({ ground = true } = {}) => { if (ground) groundVersion++; gate.invalidate(); };

// Moves the site origin to (e, n) national-grid metres. The viewer is shifted by the same amount the
// other way, so they stand in the same place in the world; layers read the new origin via api.origin().
function setOrigin(e, n) {
  if (!Number.isFinite(e) || !Number.isFinite(n)) throw Error('setOrigin needs finite easting and northing');
  const dx = e - origin.e, dy = n - origin.n;
  state = { ...state, pos: [state.pos[0] - dx, state.pos[1] - dy, state.pos[2]] };
  origin = { e, n, id: origin.id + 1 };
  invalidate();
  return { ...origin };
}

const target = () => fpsOf(VIEWS[state.view], input.get().slow);
const input = attachInput(canvas, $('pad'), {
  onChange: () => { gate.setMoving(input.active(), target()); gate.invalidate(); },
  onLook: (dy, dp) => { state = look(state, dy, dp); gate.invalidate(); },
  onView: v => chooseView(toggle(state.view, v))
});

function draw(now, intervalMs) {
  if (input.active()) {
    const i = input.get(), dt = Math.min(intervalMs / 1000, MAX_DT);
    if (i.turn) state = look(state, i.turn * dt, 0);
    state = step(state, i, dt, heightAt, solids());
    budget = adjust(budget, intervalMs, 1000 / target());
  }
  // Ground can arrive after the viewer does (tiles stream in): a walker's eye follows it, a drone keeps clear.
  const v = VIEWS[state.view], g = heightAt(state.pos[0], state.pos[1]);
  if (v.eye !== null && Math.abs(state.pos[2] - (g + v.eye)) > 1e-6) state = { ...state, pos: [state.pos[0], state.pos[1], g + v.eye] };
  if (v.eye === null && state.pos[2] < g + AERIAL_MIN_CLEARANCE) state = { ...state, pos: [state.pos[0], state.pos[1], g + AERIAL_MIN_CLEARANCE] };
  lines.resize(budget.scale);
  // The view is built at the eye; lines.draw moves each batch by (its origin - eye) in doubles.
  const m = multiply(perspective(FOV, canvas.width / canvas.height, 0.05, 5000), view([0, 0, 0], state.yaw, state.pitch));
  const ctx = { pos: state.pos, heightAt, groundVersion, origin: { ...origin } };
  const batches = live().flatMap(l => (typeof l.layer.lines === 'function' ? guarded(l, () => l.layer.lines(ctx), []) : []));
  vertices = lines.draw(m, state.pos, FADE_M, batches);
  writeReadout();
}

function chooseView(v) {
  const next = setView(state, v, heightAt);
  if (blocked(next.pos, VIEWS[v].body, solids())) return; // e.g. no standing up under a table
  state = next;
  for (const b of document.querySelectorAll('[data-view]')) b.setAttribute('aria-pressed', String(b.dataset.view === v));
  $('lift').hidden = v !== 'aerial';
  if (v !== 'aerial') input.setLift(0);
  gate.setMoving(input.active(), target());
  gate.invalidate();
}

function writeReadout() {
  const [x, y, z] = state.pos, g = heightAt(x, y), v = VIEWS[state.view];
  where.textContent = `${v.label} · E ${x.toFixed(1)} · N ${y.toFixed(1)} · eye ${(z - g).toFixed(2)} m`;
  status.textContent = `${gate.fps()} fps now (moving ${v.fps}, precise ${v.slowFps}, still 0) · ${budget.scale}× resolution · ` +
    `${vertices / 2} lines · ${loaded.layers.map(l => l.id + ': ' + l.status).join('; ') || 'no layers'}`;
}

for (const b of document.querySelectorAll('[data-view]')) b.addEventListener('click', () => { chooseView(b.dataset.view); canvas.focus(); });
$('help-toggle').addEventListener('click', () => {
  const open = $('help').hidden;
  $('help').hidden = !open; $('help-toggle').setAttribute('aria-expanded', String(open));
});
for (const b of document.querySelectorAll('[data-lift]')) {
  const hold = e => { e.preventDefault(); input.setLift(Number(b.dataset.lift)); };
  const release = () => input.setLift(0);
  b.addEventListener('pointerdown', hold);
  for (const t of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(t, release);
}
addEventListener('resize', () => gate.invalidate());
setInterval(() => { if (!input.active()) writeReadout(); }, 1000); // text only: no frame is drawn

try {
  loaded = await loadLayers('./world/manifest.json', { invalidate, origin: () => origin });
} catch (e) {
  loaded = { generation: '', layers: [{ id: 'manifest', status: 'failed: ' + e.message }] };
}
// A site places the world: its centre becomes the origin, so the viewer starts in the middle of the land.
if (loaded.site) origin = { e: loaded.site.centre_e, n: loaded.site.centre_n, id: origin.id + 1 };
chooseView('standing');

// For tests and the console. Read-only views of the live state, and the origin hook.
window.world = Object.freeze({
  origin: () => ({ ...origin }), groundVersion: () => groundVersion, setOrigin,
  state: () => state, budget: () => budget, fps: () => gate.fps(), generation: () => loaded.generation,
  layers: () => loaded.layers.map(({ id, status }) => ({ id, status }))
});
