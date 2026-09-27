// Binoculars, the mount: holds the lens (binoculars-lens.mjs) steady and reads the horizon along the bearing.
// Loaded the first time the binoculars are switched on (senses-mount.mjs). While on: the view narrows to 7× or 10×
// (wheel or pinch to step), the look is steadied by the same factor (substrate.mjs divides every look by the
// magnification), a soft circular vignette frames the view and the reticle reads what lies under the centre.
// Horizon profile: along the bearing, the measured ground that makes the skyline (the highest angle seen from the eye,
// Earth curvature and standard refraction included). Its distance comes from the WebGL2 ray cast where "Solid ground
// (GPU)" is on (raycast.mjs, near 2 m and far 8 m grids; the lines stay WebGL1), else from the terrain tiles.
// Nothing is drawn by the mount itself: readings are worked out after frames the world already draws, and once more
// when the view comes to rest, so a still view stays at 0 fps.

import { STEPS, fovFor, stepZoom, curvatureDrop, reading, readingLines, distanceText, GAP_M, REFRACTION_K, MAX_RANGE_M } from './binoculars-lens.mjs';

// Pure: the skyline along grid bearing yaw from eye over measured ground. Returns
// { skyline: { d, angle (deg), aod, point } | null, end: { d, reason: 'beyond' | 'range' }, open: skyline may lie further }.
export function horizonProfile(eye, yaw, measuredAt, { maxM = MAX_RANGE_M, k = REFRACTION_K } = {}) {
  const sx = Math.sin(yaw), sy = Math.cos(yaw);
  let d = 2, best = null, last = null, gapFrom = null, reason = 'range';
  while (d <= maxM) {
    const x = eye[0] + sx * d, y = eye[1] + sy * d, g = measuredAt(x, y);
    if (Number.isFinite(g)) {
      gapFrom = null; last = d;
      const z = g - curvatureDrop(d, k), a = Math.atan2(z - eye[2], d);
      if (!best || a > best.a) best = { d, a, aod: g, point: [x, y, z] };
    } else {
      if (gapFrom === null) gapFrom = d;
      if (d - gapFrom > GAP_M) { reason = 'beyond'; break; }
    }
    d += Math.min(20, 1 + d * 0.005);
  }
  if (!best) return { skyline: null, end: { d: last ?? 0, reason }, open: true };
  const endD = last ?? best.d;
  const open = reason === 'beyond' && best.d >= endD - Math.max(200, 0.05 * endD);
  return { skyline: { d: best.d, angle: best.a * 180 / Math.PI, aod: best.aod, point: best.point }, end: { d: endD, reason }, open };
}
export function horizonText(h, gpu = null) {
  if (!h.skyline) return 'Horizon: beyond measured ground along this bearing.';
  const s = h.skyline, where = gpu ? `${distanceText(gpu)} (GPU ray cast)` : `${distanceText(s.d)} (terrain tiles)`;
  if (h.open) return `Horizon: beyond measured ground; the highest measured ground is ${where}, ${s.aod.toFixed(0)} m AOD`;
  return `Horizon: ${where}, ${s.aod.toFixed(0)} m AOD, ${s.angle >= 0 ? '+' : ''}${s.angle.toFixed(2)}°`;
}

const CSS = `
  #bino { position: fixed; inset: 0; pointer-events: none; }
  #bino[hidden] { display: none; }
  #bino .vig { position: absolute; inset: 0; background: radial-gradient(circle at 50% 50%, transparent 0, transparent 40vmin,
    rgba(0, 0, 0, 0.22) 48vmin, rgba(0, 0, 0, 0.55) 62vmin, rgba(0, 0, 0, 0.78) 85vmin); }
  #bino svg { position: absolute; left: 50%; top: 50%; width: 120px; height: 120px; transform: translate(-50%, -50%); overflow: visible; }
  #bino svg * { stroke: var(--line); stroke-width: 1; fill: none; vector-effect: non-scaling-stroke; }
  #bino .box { position: absolute; left: 50%; bottom: calc(var(--foot) + 12px); transform: translateX(-50%); width: min(440px, calc(100vw - 32px));
    box-sizing: border-box; padding: 6px 10px; background: var(--panel); border: 1px solid var(--edge); border-radius: 6px; color: var(--text);
    font-variant-numeric: tabular-nums; font-size: 12px; line-height: 1.5; }
  #bino .box div:first-child { color: #fff; } #bino .box .dim { color: var(--dim); }
  #bino .mag { position: absolute; left: calc(50% + 66px); top: calc(50% - 76px); color: var(--dim); font-size: 11px; }
  @media (pointer: coarse) { #bino .box { bottom: auto; top: calc(var(--btn) + 40px); } }`;
const RETICLE = '<svg viewBox="-60 -60 120 120" aria-hidden="true"><circle r="3"/><path d="M-60 0h48M12 0h48M0 -60v48M0 12v48"/>'
  + '<path d="M-36 -3v6M-24 -3v6M24 -3v6M36 -3v6M-3 24h6M-3 36h6"/></svg>';
const EVERY_MS = 100, REST_MS = 180;

// deps: { api (substrate extension api), world (window.world), doc, onChange() when switched }
export function createBinoculars({ api, world, doc = document, onChange = () => {} }) {
  let on = false, mag = STEPS[0], last = null, lastAt = -Infinity, rest = null, pinch = null;
  const style = doc.createElement('style'); style.textContent = CSS; doc.head.appendChild(style);
  const root = doc.createElement('div');
  root.id = 'bino'; root.hidden = true;
  root.innerHTML = `<div class="vig"></div>${RETICLE}<div class="mag"></div><div class="box" role="status" aria-live="polite"></div>`;
  (api.canvas.parentNode ? api.canvas.after(root) : doc.body.appendChild(root)); // behind the dash, panels and credits
  const box = root.querySelector('.box'), magEl = root.querySelector('.mag');

  // Tower positions (local metres) from the grid and national layers, to tell a pylon from the wire it carries.
  function towers() {
    const o = api.origin(), out = [];
    const model = api.live().find(l => l.id === 'grid')?.layer?.debug?.()?.model;
    for (const l of model?.lines || []) for (const t of l.towers || []) out.push([t.e - o.e, t.n - o.n]);
    for (const t of api.live().find(l => l.id === 'national')?.layer?.towers?.() || []) out.push([t.e - o.e, t.n - o.n]);
    return out;
  }
  const lineClass = key => {
    const i = Number((/^grid\/line\/(\d+)$/.exec(key) || [])[1]);
    return Number.isInteger(i) ? api.live().find(l => l.id === 'grid')?.layer?.debug?.()?.model?.lines?.[i]?.cls ?? null : null;
  };
  // One pixel of the WebGL2 ray cast along (yaw, pitch): metres to measured ground, or null where it is off or finds none.
  function gpuDistance(s, yaw, pitch) {
    const rc = world.raycastApi?.();
    if (!rc?.on?.() || !rc.readData) return null;
    try { const px = rc.readData({ eye: s.pos, yaw, pitch, fovy: api.FOV, width: 1, height: 1 }); return px && px[0] < 1e29 ? px[0] : null; }
    catch { return null; }
  }
  // A reading for the current pose, or for pose { pos, yaw, pitch } near it (tests and the console: worldSenses.binoculars().probe()).
  function probe(pose = null) {
    const s = { ...api.state(), ...(pose || {}) }, c = api.canvas, tol = 3 * api.FOV / Math.max(1, c.clientHeight);
    const r = reading({ pos: s.pos, yaw: s.yaw, pitch: s.pitch, origin: api.origin(), measuredAt: api.measuredAt, batches: api.batches(),
      tol, towers: towers(), lineClass, gpuDistance: gpuDistance(s, s.yaw, s.pitch) });
    const h = horizonProfile(s.pos, s.yaw, api.measuredAt);
    const hg = h.skyline && !h.open ? gpuDistance(s, s.yaw, h.skyline.angle * Math.PI / 180 - 1e-4) : null;
    const agree = hg !== null && Math.abs(hg - h.skyline.d) <= Math.max(20, 0.03 * h.skyline.d) ? hg : null;
    return { ...r, horizon: { ...h, gpu: agree }, mag, at: new Date().toISOString() };
  }
  function measure() {
    last = probe();
    const r = last, h = last.horizon, agree = h.gpu;
    const lines = [...readingLines(r), horizonText(h, agree)];
    box.replaceChildren(...lines.map((t, i) => { const d = doc.createElement('div'); d.textContent = t; if (i >= 3) d.className = 'dim'; return d; }));
    magEl.textContent = `${mag}×`;
    return last;
  }
  // After every frame the world draws (throttled), and once when it comes to rest.
  api.hooks.after.add(now => {
    if (!on) return;
    if (now - lastAt >= EVERY_MS) { lastAt = now; measure(); }
    clearTimeout(rest); rest = setTimeout(() => { if (on) measure(); }, REST_MS);
  });
  const view = api.canvas;
  view.addEventListener('wheel', e => { if (!on) return; e.preventDefault(); e.stopImmediatePropagation(); zoom(stepZoom(mag, -e.deltaY)); },
    { passive: false, capture: true });
  const touches = new Map();
  view.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') touches.set(e.pointerId, [e.clientX, e.clientY]); });
  view.addEventListener('pointermove', e => {
    if (!on || !touches.has(e.pointerId)) return;
    touches.set(e.pointerId, [e.clientX, e.clientY]);
    if (touches.size !== 2) { pinch = null; return; }
    const [a, b] = [...touches.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
    if (!pinch) pinch = d; else if (d > pinch * 1.25) { zoom(stepZoom(mag, 1)); pinch = d; } else if (d < pinch / 1.25) { zoom(stepZoom(mag, -1)); pinch = d; }
  });
  for (const ev of ['pointerup', 'pointercancel']) view.addEventListener(ev, e => { touches.delete(e.pointerId); if (touches.size < 2) pinch = null; });

  function zoom(m) {
    const next = STEPS.includes(Number(m)) ? Number(m) : null;
    if (next === null) throw Error(`the binoculars have ${STEPS.join('× and ')}× steps`);
    mag = next; if (on) api.setMagnification(mag);
    magEl.textContent = `${mag}×`;
    return mag;
  }
  function set(v) {
    on = !!v; root.hidden = !on;
    api.setMagnification(on ? mag : 1);
    if (on) { measure(); api.redraw(); }
    onChange(on);
    return on;
  }
  return {
    set, on: () => on, zoom, mag: () => mag, fov: () => fovFor(mag),
    // The reading in words: worked out now if the binoculars are up, else the last one taken.
    rangeText() { const r = on ? measure() : last; return r ? [...readingLines(r), horizonText(r.horizon, r.horizon.gpu)].join('; ') : 'No reading yet.'; },
    lastText: () => (last ? [...readingLines(last), horizonText(last.horizon, last.horizon.gpu)].join('; ') : null),
    reading: () => last, probe,
    debug: () => ({ on, mag, fovDeg: fovFor(mag) * 180 / Math.PI, reading: last })
  };
}
