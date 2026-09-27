// Plan inset: a small top-down plan in a corner, drawn on a 2D canvas (not WebGL). North is always up.
// It shows the site boundary, the terrain tiles (known and loaded), any drawn design items, the viewer's
// position and heading, and a scale bar. A tap or click on the plan calls onFly(x, y) in local metres.
// It draws only when what it would show has changed, so it costs nothing while the viewer stands still.
//
// The first half is pure (no DOM) and tested under node:test; createPlanInset is the thin DOM part.
// Positions are local metres from the site origin: x east, y north. Yaw 0 looks north, +pi/2 looks east.
//
// Data handed to set():
//   viewer   { x, y, yaw }                               required
//   boundary [[x, y], ...]                               optional closed ring (the site boundary)
//   tiles    [{ x0, y0, size, loaded }]                  optional; loaded: true draws brighter
//   items    [{ points: [[x, y], ...], closed, kind }]   optional drawn design items; one point = a marker

export const MIN_SPAN_M = 200;   // the plan never shows less than this across, so a lone viewer is not a dot on nothing
export const PAD_PX = 8;
export const TAP_PX = 6;          // a pointer that moves this far or more between down and up is a drag, not a tap         // clear border inside the canvas
const NICE = [1, 2, 5];

const finite2 = p => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]);

// Bounding box of everything the plan shows. Returns { x0, y0, x1, y1 } or null when there is nothing.
// The site (boundary, tiles, items) sets the frame; the viewer widens it only when they stand outside it.
export function extentOf({ viewer, boundary, tiles, items } = {}) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (x, y) => { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; };
  for (const p of boundary || []) if (finite2(p)) add(p[0], p[1]);
  for (const t of tiles || []) if (Number.isFinite(t?.x0) && Number.isFinite(t?.y0) && t.size > 0) { add(t.x0, t.y0); add(t.x0 + t.size, t.y0 + t.size); }
  for (const it of items || []) for (const p of it?.points || []) if (finite2(p)) add(p[0], p[1]);
  if (viewer && Number.isFinite(viewer.x) && Number.isFinite(viewer.y)) add(viewer.x, viewer.y);
  return x0 <= x1 && y0 <= y1 ? { x0, y0, x1, y1 } : null;
}

// Fits an extent into a w x h pixel canvas, north up, same scale on both axes, grown to at least MIN_SPAN_M.
// Returns { scale (px per metre), cx, cy (world centre), w, h }.
export function fit(extent, w, h, { pad = PAD_PX, minSpan = MIN_SPAN_M } = {}) {
  const e = extent || { x0: 0, y0: 0, x1: 0, y1: 0 };
  const spanX = Math.max(e.x1 - e.x0, minSpan), spanY = Math.max(e.y1 - e.y0, minSpan);
  const iw = Math.max(1, w - 2 * pad), ih = Math.max(1, h - 2 * pad);
  const scale = Math.min(iw / spanX, ih / spanY);
  return { scale, cx: (e.x0 + e.x1) / 2, cy: (e.y0 + e.y1) / 2, w, h };
}

// World metres to canvas pixels (y grows downwards on screen, so north is up).
export function toPlan(f, x, y) {
  return [f.w / 2 + (x - f.cx) * f.scale, f.h / 2 - (y - f.cy) * f.scale];
}

// Canvas pixels back to world metres: the exact inverse of toPlan.
export function toWorld(f, px, py) {
  return [f.cx + (px - f.w / 2) / f.scale, f.cy - (py - f.h / 2) / f.scale];
}

// Unit screen direction of a heading: yaw 0 points up the screen (north), +pi/2 points right (east).
export function headingOnPlan(yaw) {
  return [Math.sin(yaw), -Math.cos(yaw)];
}

// The longest 1, 2 or 5 x 10^k metre bar no longer than maxPx. Returns { metres, px, label }.
export function scaleBar(scale, maxPx) {
  if (!(scale > 0) || !(maxPx > 0)) return { metres: 0, px: 0, label: '' };
  const limit = maxPx / scale;
  let k = Math.floor(Math.log10(limit)), best = 0;
  for (let tries = 0; tries < 3 && !best; tries++, k--) {
    for (const n of NICE) { const m = n * 10 ** k; if (m <= limit + 1e-9 && m > best) best = m; }
  }
  return { metres: best, px: best * scale, label: formatDistance(best) };
}

export function formatDistance(m) {
  if (m >= 1000) return `${+(m / 1000).toFixed(2)} km`;
  if (m >= 1) return `${+m.toFixed(0)} m`;
  return `${+m.toFixed(2)} m`;
}

// A short text that changes only when the drawing would: the viewer is rounded to whole plan pixels
// and the heading to whole degrees, so moving within a pixel never costs a redraw.
export function signature(data, w, h) {
  const f = fit(extentOf(data), w, h);
  const v = data?.viewer || {};
  const [px, py] = Number.isFinite(v.x) ? toPlan(f, v.x, v.y) : [NaN, NaN];
  const deg = Number.isFinite(v.yaw) ? Math.round((((v.yaw * 180) / Math.PI) % 360 + 360) % 360) % 360 : 'x';
  const tiles = (data?.tiles || []).map(t => `${t.x0 | 0},${t.y0 | 0},${t.size | 0},${t.loaded ? 1 : 0}`).join(';');
  const bound = (data?.boundary || []).map(p => `${Math.round(p[0])},${Math.round(p[1])}`).join(';');
  const items = (data?.items || []).map(it => `${it.kind || ''}:${it.closed ? 1 : 0}:` +
    (it.points || []).map(p => `${Math.round(p[0] * 10)},${Math.round(p[1] * 10)}`).join(' ')).join('|');
  return [w, h, f.scale.toFixed(6), f.cx.toFixed(1), f.cy.toFixed(1), Math.round(px), Math.round(py), deg, tiles, bound, items].join('#');
}

// Canvas size from the room it has, in CSS pixels: a square, smaller on phones.
export function planSize(vw, vh, coarse) {
  const short = Math.min(vw, vh);
  const side = coarse ? Math.round(short * 0.36) : Math.round(short * 0.24);
  return Math.max(112, Math.min(coarse ? 180 : 200, side));
}

// Start collapsed where the screen is too small to spare the room (a small phone).
export const startCollapsed = (vw, vh) => Math.min(vw, vh) < 430 || Math.max(vw, vh) < 700;

// ---------------------------------------------------------------------------------------------------------
// DOM part. doc is passed in; nothing runs on import.

const CSS = `
#plan { position: fixed; left: 8px; top: 8px; display: flex; flex-direction: column; align-items: flex-start;
  background: var(--panel, rgba(10,10,10,0.86)); border: 1px solid var(--edge, #1c2c3a); border-radius: 6px; overflow: hidden; }
#plan-toggle { min-height: 26px; min-width: 44px; padding: 0 10px; border: 0; background: transparent; color: var(--dim, #6f8ea6);
  font: inherit; font-size: 11px; text-align: left; cursor: pointer; }
#plan-toggle[aria-expanded="true"] { color: var(--text, #cfe9ff); width: 100%; border-bottom: 1px solid var(--edge, #1c2c3a); }
#plan canvas { display: block; cursor: crosshair; touch-action: none; }
#plan canvas[hidden] { display: none; }
@media (pointer: coarse) {
  /* Touch: bottom-left, just above the joypad, clear of the position readout however it wraps. */
  #plan { top: auto; bottom: calc(var(--foot, 20px) + 180px); } /* 16 px clear of the joypad's top */
  #plan-toggle { min-height: 44px; min-width: 64px; font-size: 12px; }
  /* A panel opened as a sheet takes the screen; the plan steps aside until it closes. */
  body:has(.panel:not([hidden])) #plan, body:has(.find-panel:not([hidden])) #plan { display: none; }
}`;

const COLOURS = { tileKnown: 'rgba(111,142,166,0.35)', tileLoaded: 'rgba(156,219,255,0.14)', tileEdge: 'rgba(156,219,255,0.35)',
  boundary: '#cfe9ff', item: '#ffcf7a', viewer: '#ffffff', text: '#cfe9ff', dim: '#6f8ea6' };

// Mounts the plan into doc.body. onFly(x, y) is called with local metres when the plan is tapped.
// Returns { set(data), refresh(), collapsed(), setCollapsed(on), element, redraws() }.
export function createPlanInset(doc, { onFly = () => {}, coarse, win = doc.defaultView } = {}) {
  const style = doc.createElement('style');
  style.textContent = CSS;
  doc.head.appendChild(style);
  const box = doc.createElement('section');
  box.id = 'plan';
  box.setAttribute('aria-label', 'Plan');
  const toggle = doc.createElement('button');
  toggle.id = 'plan-toggle'; toggle.type = 'button'; toggle.textContent = 'Plan';
  toggle.setAttribute('aria-controls', 'plan-canvas');
  const canvas = doc.createElement('canvas');
  canvas.id = 'plan-canvas';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Plan of the site, north up. Tap a place to go there.');
  box.append(toggle, canvas);
  doc.body.appendChild(box);

  const isCoarse = () => (coarse ?? win.matchMedia?.('(pointer: coarse)').matches) === true;
  let data = null, last = '', frame = null, redraws = 0, side = 0;
  let collapsed = startCollapsed(win.innerWidth, win.innerHeight);

  function layout() {
    side = planSize(win.innerWidth, win.innerHeight, isCoarse());
    const dpr = Math.min(win.devicePixelRatio || 1, 3);
    canvas.style.width = canvas.style.height = side + 'px';
    if (canvas.width !== Math.round(side * dpr)) { canvas.width = canvas.height = Math.round(side * dpr); last = ''; }
    canvas.hidden = collapsed;
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.setAttribute('aria-label', collapsed ? 'Show plan' : 'Hide plan');
    box.style.width = collapsed ? '' : side + 'px';
  }

  function draw() {
    if (!data || collapsed) return;
    const sig = signature(data, side, side);
    if (sig === last) return;
    last = sig; redraws++;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const k = canvas.width / side;
    frame = fit(extentOf(data), side, side);
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.clearRect(0, 0, side, side);
    paint(ctx, frame, data, side);
  }

  toggle.addEventListener('click', () => { collapsed = !collapsed; layout(); draw(); });
  // A tap (pointer up within TAP_PX of where it went down) goes there; a drag that starts on the plan does not.
  let down = null;
  canvas.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); down = { x: e.clientX, y: e.clientY, id: e.pointerId }; });
  canvas.addEventListener('pointercancel', () => { down = null; });
  canvas.addEventListener('pointerup', e => {
    const d = down; down = null;
    if (!frame || !d || d.id !== e.pointerId || Math.hypot(e.clientX - d.x, e.clientY - d.y) >= TAP_PX) return;
    e.preventDefault(); e.stopPropagation();
    const r = canvas.getBoundingClientRect();
    const [x, y] = toWorld(frame, (e.clientX - r.left) * (side / r.width), (e.clientY - r.top) * (side / r.height));
    onFly(x, y);
  });
  win.addEventListener('resize', () => { layout(); draw(); });
  layout();

  return {
    element: box,
    set(next) { data = next; draw(); },
    refresh() { last = ''; draw(); },
    collapsed: () => collapsed,
    setCollapsed(on) { collapsed = !!on; layout(); draw(); },
    redraws: () => redraws
  };
}

function paint(ctx, f, data, side) {
  const P = (x, y) => toPlan(f, x, y);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // Tiles: every known tile faintly, loaded ones filled.
  for (const t of data.tiles || []) {
    const [ax, ay] = P(t.x0, t.y0 + t.size), s = t.size * f.scale;
    if (t.loaded) { ctx.fillStyle = COLOURS.tileLoaded; ctx.fillRect(ax, ay, s, s); }
    ctx.strokeStyle = t.loaded ? COLOURS.tileEdge : COLOURS.tileKnown; ctx.lineWidth = 1;
    ctx.strokeRect(ax + 0.5, ay + 0.5, Math.max(0, s - 1), Math.max(0, s - 1));
  }
  // Site boundary.
  const ring = (data.boundary || []).filter(finite2);
  if (ring.length > 2) {
    ctx.beginPath();
    ring.forEach((p, i) => { const [x, y] = P(p[0], p[1]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.closePath(); ctx.strokeStyle = COLOURS.boundary; ctx.lineWidth = 1.5; ctx.setLineDash([5, 3]); ctx.stroke(); ctx.setLineDash([]);
  }
  // Design items: lines, closed shapes, or single-point markers.
  ctx.strokeStyle = ctx.fillStyle = COLOURS.item; ctx.lineWidth = 1.5;
  for (const it of data.items || []) {
    const pts = (it.points || []).filter(finite2).map(p => P(p[0], p[1]));
    if (pts.length === 1) { ctx.fillRect(pts[0][0] - 2, pts[0][1] - 2, 4, 4); continue; }
    if (pts.length < 2) continue;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    if (it.closed) ctx.closePath();
    ctx.stroke();
  }
  // Viewer: a dot with a heading wedge.
  const v = data.viewer;
  if (v && Number.isFinite(v.x) && Number.isFinite(v.y)) {
    const [vx, vy] = P(v.x, v.y), [hx, hy] = headingOnPlan(v.yaw || 0), L = 14, W = 5;
    ctx.fillStyle = COLOURS.viewer;
    ctx.beginPath();
    ctx.moveTo(vx + hx * L, vy + hy * L);
    ctx.lineTo(vx - hy * W, vy + hx * W);
    ctx.lineTo(vx + hy * W, vy - hx * W);
    ctx.closePath(); ctx.globalAlpha = 0.85; ctx.fill(); ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(vx, vy, 3, 0, 2 * Math.PI); ctx.fill();
  }
  // North arrow and scale bar.
  ctx.font = '11px system-ui, sans-serif'; ctx.fillStyle = COLOURS.text; ctx.textBaseline = 'top';
  ctx.fillText('N', side - 16, 6);
  ctx.beginPath(); ctx.moveTo(side - 12.5, 19); ctx.lineTo(side - 12.5, 30); ctx.strokeStyle = COLOURS.text; ctx.lineWidth = 1; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(side - 12.5, 18); ctx.lineTo(side - 15.5, 23); ctx.lineTo(side - 9.5, 23); ctx.closePath(); ctx.fill();
  const bar = scaleBar(f.scale, side * 0.4);
  if (bar.px > 0) {
    const x0 = 8, y = side - 8;
    ctx.strokeStyle = COLOURS.text; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x0, y - 4); ctx.lineTo(x0, y); ctx.lineTo(x0 + bar.px, y); ctx.lineTo(x0 + bar.px, y - 4); ctx.stroke();
    ctx.textBaseline = 'bottom'; ctx.fillText(bar.label, x0 + 2, y - 3);
  }
}
