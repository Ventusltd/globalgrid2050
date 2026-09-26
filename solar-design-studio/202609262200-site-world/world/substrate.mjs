// The substrate: an empty world you can move around in. It owns the loop, the camera and the views;
// everything you see comes from layers listed in manifest.json. Nothing here knows what a layer draws.

import { perspective, view, multiply } from './camera.mjs';
import { VIEWS, fpsOf, step, look, setView, toggle } from './views.mjs';
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

const live = () => loaded.layers.filter(l => l.layer);
// A layer that throws is switched off and named; it never takes the rest of the world down with it.
const guarded = (l, fn, fallback) => {
  try { return fn(); } catch (e) { l.layer = null; l.status = 'failed and switched off: ' + e.message; return fallback; }
};
const heightAt = (x, y) => {
  for (const l of live()) {
    if (typeof l.layer.heightAt !== 'function') continue;
    const h = guarded(l, () => l.layer.heightAt(x, y), NaN);
    if (Number.isFinite(h)) return h;
  }
  return 0; // the empty world is flat at 0 m
};

const lines = createLines(canvas, { onRestore: () => gate.invalidate() });
const gate = createFrameGate(draw);
const target = () => fpsOf(VIEWS[state.view], input.get().slow);
const input = attachInput(canvas, {
  onChange: () => { gate.setMoving(input.active(), target()); gate.invalidate(); },
  onLook: (dy, dp) => { state = look(state, dy, dp); gate.invalidate(); },
  onView: v => chooseView(toggle(state.view, v))
});

function draw(now, intervalMs) {
  if (input.active()) {
    const i = input.get(), dt = Math.min(intervalMs / 1000, MAX_DT);
    if (i.turn) state = look(state, i.turn * dt, 0);
    state = step(state, i, dt, heightAt);
    budget = adjust(budget, intervalMs, 1000 / target());
  }
  lines.resize(budget.scale);
  const m = multiply(perspective(FOV, canvas.width / canvas.height, 0.05, 5000), view(state.pos, state.yaw, state.pitch));
  const ctx = { pos: state.pos, heightAt };
  const batches = live().flatMap(l => (typeof l.layer.lines === 'function' ? guarded(l, () => l.layer.lines(ctx), []) : []));
  vertices = lines.draw(m, state.pos, FADE_M, batches);
  writeReadout();
}

function chooseView(v) {
  state = setView(state, v, heightAt);
  for (const b of document.querySelectorAll('[data-view]')) b.setAttribute('aria-pressed', String(b.dataset.view === v));
  gate.setMoving(input.active(), target());
  gate.invalidate();
}

function writeReadout() {
  const [x, y, z] = state.pos, g = heightAt(x, y), v = VIEWS[state.view];
  where.textContent = `${v.label} · E ${x.toFixed(1)} · N ${y.toFixed(1)} · eye ${(z - g).toFixed(2)} m`;
  status.textContent = `${gate.fps()} fps now (moving ${v.fps}, precise ${v.slowFps}, still 0) · ${budget.scale}× resolution · ` +
    `${vertices / 2} lines · ${loaded.layers.map(l => l.id + ': ' + l.status).join('; ') || 'no layers'}`;
}

for (const b of document.querySelectorAll('[data-view]')) b.addEventListener('click', () => chooseView(toggle(state.view, b.dataset.view)));
$('help-toggle').addEventListener('click', () => {
  const open = $('help').hidden;
  $('help').hidden = !open; $('help-toggle').setAttribute('aria-expanded', String(open));
});
addEventListener('resize', () => gate.invalidate());
setInterval(() => { if (!input.active()) writeReadout(); }, 1000); // text only: no frame is drawn

try {
  loaded = await loadLayers('./world/manifest.json');
} catch (e) {
  loaded = { generation: '', layers: [{ id: 'manifest', status: 'failed: ' + e.message }] };
}
chooseView('standing');

// For tests and the console. Read-only views of the live state.
window.world = Object.freeze({
  state: () => state, budget: () => budget, fps: () => gate.fps(), generation: () => loaded.generation,
  layers: () => loaded.layers.map(({ id, status }) => ({ id, status }))
});
