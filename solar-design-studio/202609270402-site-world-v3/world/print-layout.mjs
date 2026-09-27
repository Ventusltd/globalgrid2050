// Print sheet layout: the pure parts. No DOM, no WebGL. Units are millimetres on the paper and
// metres in the world (local east, north, up from the site origin, as everywhere else in web/world).
// The sheet follows the GridAtlas print furniture: the drawing first, the credit for exactly the data
// shown beneath it, and a stamp; here the stamp grows into a title block beside the drawing.

import { gridRef, bngToWgs84 } from './bng.mjs';

export const PAPER = Object.freeze({
  A3: { name: 'A3', w: 420, h: 297 },
  A4: { name: 'A4', w: 297, h: 210 },
});

// Scales a surveyor would expect to read off a sheet, smallest denominator first.
export const SCALES = Object.freeze([100, 200, 250, 500, 1000, 1250, 2000, 2500, 5000, 10000, 25000, 50000, 100000]);

// Character width of the sheet's monospace face as a fraction of its size; used to wrap text.
export const MONO_WIDTH = 0.6;

const rect = (x, y, w, h) => ({ x, y, w, h });

// Where everything goes on the paper. Returns rectangles in mm:
//   frame     the drawing border
//   plan      the plan panel (left, the larger); planDraw its drawing area inside the band of grid figures
//   credit    under the plan: the credit for exactly the data shown
//   view      top right, at the screen's shape (aspect = height / width of the captured view)
//   title     the rest of the right-hand column: title block, layers, warning
export function sheetLayout(paperName = 'A3', { aspect = 10 / 16 } = {}) {
  const paper = PAPER[paperName];
  if (!paper) throw Error(`unknown paper ${paperName}; use ${Object.keys(PAPER).join(' or ')}`);
  const small = paper.name === 'A4';
  const m = small ? 8 : 10, gap = small ? 4 : 5, creditH = small ? 24 : 28, band = small ? 6 : 7, titleMin = small ? 92 : 120;
  const frame = rect(m, m, paper.w - 2 * m, paper.h - 2 * m);
  const inner = rect(frame.x + gap, frame.y + gap, frame.w - 2 * gap, frame.h - 2 * gap);
  const planW = Math.round(inner.w * 0.6), rightW = inner.w - planW - gap;
  const plan = rect(inner.x, inner.y, planW, inner.h - creditH - gap);
  const planDraw = rect(plan.x + band, plan.y + band, plan.w - 2 * band, plan.h - 2 * band);
  const credit = rect(inner.x, plan.y + plan.h + gap, planW, creditH);
  const a = Number.isFinite(aspect) && aspect > 0 ? aspect : 10 / 16;
  const viewH = Math.min(rightW * a, inner.h - titleMin - gap);
  const view = rect(inner.x + planW + gap, inner.y, rightW, viewH);
  const title = rect(view.x, view.y + viewH + gap, rightW, inner.h - viewH - gap);
  return { paper, margin: m, gap, band, frame, plan, planDraw, view, credit, title, small };
}

// A round number of the form 1, 2 or 5 x 10^k that is at most `v`.
export function niceBelow(v) {
  if (!(v > 0)) throw Error('niceBelow needs a positive value');
  const p = 10 ** Math.floor(Math.log10(v) + 1e-9);
  for (const f of [5, 2, 1]) if (f * p <= v * (1 + 1e-9)) return f * p;
  return p;
}

// The smallest standard scale at which `extentM` ([width, height] in metres) fits `drawMM`
// ([width, height] in mm). Past the last standard scale, the exact scale is returned.
export function chooseScale(extentM, drawMM) {
  const need = Math.max(extentM[0] * 1000 / drawMM[0], extentM[1] * 1000 / drawMM[1]);
  if (!(need > 0) || !Number.isFinite(need)) throw Error('chooseScale needs a positive extent and drawing area');
  return SCALES.find(s => s >= need - 1e-9) ?? Math.ceil(need);
}

// Bounds of the line batches in local metres, x and y only; z is ignored (the plan looks straight down).
// Each batch's positions are relative to its origin, if it has one. Non-finite points are skipped.
export function batchBounds(batches) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const b of batches || []) {
    if (b.occluder || !b.positions) continue;
    const o = b.origin || [0, 0, 0], p = b.positions;
    for (let i = 0; i + 2 < p.length; i += 3) {
      const x = p[i] + o[0], y = p[i + 1] + o[1];
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  return x0 <= x1 ? { x0, y0, x1, y1 } : null;
}

// The plan's framing: a centre (local metres), a standard scale and the visible extent.
// extent: optional { x0, y0, x1, y1 } in local metres; defaults to the batches' bounds, else 100 m round the centre.
// maxHalf caps the framing so a horizon-wide grid does not shrink the site to a dot.
export function planFrame(layout, { batches = [], extent = null, centre = null, maxHalf = 250, minHalf = 10 } = {}) {
  let e = extent || batchBounds(batches);
  const c = centre || (e ? [(e.x0 + e.x1) / 2, (e.y0 + e.y1) / 2] : [0, 0]);
  const half = [e ? (e.x1 - e.x0) / 2 : 50, e ? (e.y1 - e.y0) / 2 : 50]
    .map(h => Math.min(maxHalf, Math.max(minHalf, h)));
  const d = layout.planDraw;
  const scale = chooseScale([2 * half[0], 2 * half[1]], [d.w, d.h]);
  const mPerMM = scale / 1000;
  return { centre: c, scale, mPerMM, widthM: d.w * mPerMM, heightM: d.h * mPerMM };
}

// Local metres -> paper mm inside the plan's drawing area. North is up the sheet (grid north).
export function planToPaper(frame, layout, x, y) {
  const d = layout.planDraw;
  return [d.x + d.w / 2 + (x - frame.centre[0]) / frame.mPerMM,
          d.y + d.h / 2 - (y - frame.centre[1]) / frame.mPerMM];
}

// A scale bar up to about 0.3 of the plan's width (1-2-5 steps): its length in metres, in mm, and four divisions.
export function scaleBar(frame, layout, { fraction = 0.3 } = {}) {
  const m = niceBelow(layout.planDraw.w * fraction * frame.mPerMM);
  const mm = m / frame.mPerMM;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => ({ m: m * t, mm: mm * t }));
  return { m, mm, ticks, label: m >= 1000 ? `${m / 1000} km` : `${m} m` };
}

// Digits per grid reference that suit a tick spacing: 1 m -> 10 figures, 100 m -> 6, 1 km -> 4.
export const digitsFor = spacing => Math.max(2, Math.min(10, 2 * (5 - Math.floor(Math.log10(spacing) + 1e-9))));

// National Grid ticks along the plan's edges, every `spacing` metres (3 to 8 across the width).
// Each tick has its paper position and the grid-reference figures for that line, via gridRef.
// Lines that fall outside the National Grid are dropped rather than mislabelled.
export function gridTicks(frame, layout, origin, { target = 5 } = {}) {
  const spacing = niceBelow(frame.widthM / target);
  const digits = digitsFor(spacing), d = layout.planDraw;
  const half = [frame.widthM / 2, frame.heightM / 2];
  const ce = origin.e + frame.centre[0], cn = origin.n + frame.centre[1];
  const eastings = [], northings = [];
  for (let e = Math.ceil((ce - half[0]) / spacing) * spacing; e <= ce + half[0] + 1e-6; e += spacing) {
    const ref = safeRef(e, cn, digits);
    if (!ref) continue;
    eastings.push({ e, x: d.x + d.w / 2 + (e - ce) / frame.mPerMM, square: ref.square, label: ref.east });
  }
  for (let n = Math.ceil((cn - half[1]) / spacing) * spacing; n <= cn + half[1] + 1e-6; n += spacing) {
    const ref = safeRef(ce, n, digits);
    if (!ref) continue;
    northings.push({ n, y: d.y + d.h / 2 - (n - cn) / frame.mPerMM, square: ref.square, label: ref.north });
  }
  // The 100 km squares the plan covers, from its corners and centre (not only where ticks fall).
  const squares = [...new Set([[-1, 1], [1, 1], [0, 0], [-1, -1], [1, -1]]
    .map(([sx, sy]) => safeRef(ce + sx * half[0], cn + sy * half[1], 2)?.square).filter(Boolean))];
  return { spacing, digits, eastings, northings, squares };
}

function safeRef(e, n, digits) {
  try {
    const [square, east, north] = gridRef(e, n, digits).split(' ');
    return { square, east, north };
  } catch { return null; }
}

// Full grid reference for a local point, or null off the grid. 10 figures is a 1 m reference.
export function refAt(origin, x, y, digits = 10) {
  try { return gridRef(origin.e + x, origin.n + y, digits); } catch { return null; }
}

// Angle from grid north to true north at a grid point, degrees, east positive. The plan is drawn
// grid-north up; this says how far true north leans from it. Null off the grid.
export function trueNorthOffset(e, n) {
  if (!(e >= 0 && e < 700000 && n >= 0 && n < 1300000)) return null;
  const a = bngToWgs84(e, n), b = bngToWgs84(e, n + 1000);
  // Grid north's bearing (from true north) is the bearing of a 1 km step up the grid.
  const lat = a.lat * Math.PI / 180;
  const dx = (b.lon - a.lon) * Math.cos(lat), dy = b.lat - a.lat;
  return -Math.atan2(dx, dy) * 180 / Math.PI;
}

// Compass words for a view heading; yaw 0 is north, pi/2 east (as in camera.mjs).
export function bearingText(yaw) {
  const deg = ((yaw * 180 / Math.PI) % 360 + 360) % 360;
  const names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return `${names[Math.round(deg / 45) % 8]} (${deg.toFixed(0).padStart(3, '0')}°)`;
}

// Word-wraps text to lines of at most `widthMM` at font size `sizeMM` in the monospace face.
// A word longer than a line is broken rather than allowed to spill past the frame.
export function wrapText(text, widthMM, sizeMM) {
  const max = Math.max(8, Math.floor(widthMM / (sizeMM * MONO_WIDTH)));
  const lines = [];
  let line = '';
  for (let word of String(text || '').split(/\s+/).filter(Boolean)) {
    while (word.length > max) { if (line) { lines.push(line); line = ''; } lines.push(word.slice(0, max)); word = word.slice(max); }
    if (!line) line = word;
    else if (line.length + 1 + word.length <= max) line += ' ' + word;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines;
}

// The credit split into entries (footerText joins them with ' · '), each wrapped, then fitted to
// `maxLines`, shrinking the font down to `minSize` before it would ever drop a line. Returns
// { size, lines, fits }. fits is false only if even the smallest size overflows; the caller must say so.
export function fitCredit(text, widthMM, maxHeightMM, { size = 2.4, minSize = 1.6, lead = 1.3 } = {}) {
  const entries = String(text || '').split(' · ').filter(Boolean);
  for (let s = size; s >= minSize - 1e-9; s = Math.round((s - 0.1) * 10) / 10) {
    const lines = entries.flatMap(t => wrapText(t, widthMM, s));
    if (lines.length * s * lead <= maxHeightMM) return { size: s, lines, fits: true };
  }
  const lines = entries.flatMap(t => wrapText(t, widthMM, minSize));
  return { size: minSize, lines, fits: false };
}
