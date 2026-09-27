// plant-layout.mjs: a solar plant laid out on measured ground inside a drawn boundary, from generic rules.
//
// Give it a boundary (national-grid metres), a capacity and a layout (south-facing fixed tilt, east-west, or single-axis
// tracker rows north-south, 1P portrait, pitch from their own ground cover ratio, 0.35 by default);
// it keeps tables inside the fence setback and away from mapped water, drops any table on ground that is not
// measured (NaN), steeper than the slope limit, or in a closed hollow, then groups the tables into blocks with a
// station at the block end beside a branch track off a spine road, and routes each 33 kV feeder of the plant
// template (plant-template.mjs) along the tracks to a substation compound at the boundary point nearest the grid.
//
// Rules used (general practice and public standards; the defaults sit inside the ranges):
//   ground cover ratio 0.5 by default: UK plants measured as built from open LiDAR run 0.41-0.52 with 2 portrait
//   tables and 0.63-0.70 with 6-high landscape tables (row pitch 8.0-9.3 m); the v09 default of 0.4 sat below them all;
//   the boundary may be several hedged fields packed as one set (plant-packing.mjs, packing 'fields' by default);
//   tables stand 5-10 m inside the fence; watercourse stand-off 10 m (common Environment Agency byelaw figure;
//   drainage-board strips are typically 8-9 m); south-facing row gap from a ground cover ratio of 0.35-0.5;
//   east-west 2-4 m between tables, ridge gap 0.1-0.5 m; lowest module edge 0.6-1.2 m; table runs 100-200 m with
//   4-6 m cross lanes; stations at the end of a block beside a road; a stone spine road with branch tracks.
// Module and table sizes are a generic 600 W class (2.38 x 1.13 m), two strings per table; not any product.
// Every table then gets its piles automatically (plant-piles.mjs): nobody places a pile.
// Work is done in chunks (a generator), so a page can run it between frames. Pure: no DOM.

import { plantTemplate } from './plant-template.mjs';
import { routeFeeders } from './plant-feeders.mjs';
import { pilesForLayout } from './plant-piles.mjs';
import { tableShape, pitchStretch, winterNoonDeg, halfCols } from './structures.mjs';
import { fieldsOf, fieldSet, packFields, FIELD_DEFAULTS, PACKINGS } from './plant-packing.mjs';
import { surveyNote } from './site-checks.mjs';

export const LABEL = 'Illustrative layout from generic rules, not a design for any site.';
export const LAYOUTS = Object.freeze([['south', 'South-facing, fixed tilt'], ['east-west', 'East-west'], ['tracker', 'Single-axis tracker']]);
export const LAYOUT_DEFAULTS = Object.freeze({
  fenceSetbackM: 8, waterSetbackM: 10, ohlMarginM: 5, slopeLimitPct: 15, twistTolDeg: 3, hollowDepthM: 0.3, hollowRadiusM: 20, slopeStepM: 5,
  gcr: 0.5, gcrTracker: 0.35, ewGapM: 3, ridgeGapM: 0.3, tiltSouthDeg: 25, tiltEwDeg: 10, lowEdgeM: 0.8,
  moduleLongM: 2.384, moduleShortM: 1.134, moduleGapM: 0.02, tableGapM: 0.5, runTargetM: 150, crossLaneM: 5,
  bandTargetM: 150, spineWidthM: 6, trackWidthM: 4, roadClearM: 3, compoundW: 60, compoundD: 40, chunk: 100,
  packing: 'fields', halfTables: true, hedgeSetbackM: 5,
  // Structure (structures.mjs): table format, tracker strings a row, the row gap rule and the tracker cross-slope lines.
  tiers: null, orient: 'portrait', tableCols: null, trackerStrings: 2, rowGap: 'flat', latDeg: 52, maxStretch: 2,
  trackerCrossReviewPct: 7, trackerCrossMaxPct: 10
});
// The v09 rules (one band grid, GCR 0.4), kept typed (packing bands, gcr 0.4) and used by the closed-form witnesses.
export const V09_PACKING = Object.freeze({ packing: 'bands', gcr: 0.4 });
const DEG = Math.PI / 180, AVOID_STEP_M = 10;   // AVOID_STEP_M: test points along a table or row for an area kept clear

/** Table geometry for a layout: plan length along the row, plan depth across it, row pitch, modules and kWp. The format
 * (structures.mjs tableShape): south 2P (default), 3P, 3L or 4L; east-west 1P each side of a ridge; tracker 1P or 2P across
 * one north-south torque tube carrying trackerStrings strings. strings = modules / modules per string (a string may run on
 * into the next table when the counts do not divide). */
export function tableGeometry(layout, p, tpl) {
  const mps = tpl.counts.modulesPerString, S = tableShape(p, mps, layout), lenU = S.cols * (S.along + p.moduleGapM) - p.moduleGapM;
  const fmt = { tiers: S.tiers, orient: S.orient, cols: S.cols }, kWp = S.modules * tpl.params.moduleWp / 1000;
  if (layout === 'tracker') {       // single-axis: rows north-south, the modules across the tube
    return { lenU, depth: S.slope, pitch: S.slope / p.gcrTracker, slope: S.slope, tilt: 0, modules: S.modules, strings: S.modules / mps,
      kWp, south: false, tracker: true, rise: 0, ...fmt };
  }
  const south = layout === 'south', tilt = (south ? p.tiltSouthDeg : p.tiltEwDeg) * DEG, slope = S.slope;
  const depth = south ? slope * Math.cos(tilt) : 2 * slope * Math.cos(tilt) + p.ridgeGapM;
  const pitch = south ? slope / p.gcr : depth + p.ewGapM;
  return { lenU, depth, pitch, slope, tilt, modules: S.modules, strings: S.modules / mps, kWp, south, rise: slope * Math.sin(tilt), ...fmt };
}

// ---- plane helpers (u, v: the layout frame; south-facing u = east, v = north; east-west u = north, v = east) ----
export function frameOf(layout) {
  const swap = layout !== 'south';
  return { swap, uv: (e, n) => (swap ? [n, e] : [e, n]), en: (u, v) => (swap ? [v, u] : [u, v]) };
}
export function inside(poly, x, y) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
const segDist = (x, y, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay, d2 = dx * dx + dy * dy, t = d2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / d2)) : 0;
  return Math.hypot(x - ax - t * dx, y - ay - t * dy);
};
export function edgeDist(poly, x, y) {
  let d = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) d = Math.min(d, segDist(x, y, poly[j][0], poly[j][1], poly[i][0], poly[i][1]));
  return d;
}
export const polyArea = poly => poly.reduce((s, [x, y], i) => { const [x2, y2] = poly[(i + 1) % poly.length]; return s + x * y2 - x2 * y; }, 0) / 2;

// Nearest distance to any mapped water line, bucketed on a coarse grid (only the nearby cells are searched).
export function waterIndex(lines, reach, cell = 64) {
  const grid = new Map(), key = (i, j) => i + ',' + j;
  for (const pts of lines) for (let k = 1; k < pts.length; k++) {
    const [ax, ay] = pts[k - 1], [bx, by] = pts[k];
    const i0 = Math.floor((Math.min(ax, bx) - reach) / cell), i1 = Math.floor((Math.max(ax, bx) + reach) / cell);
    const j0 = Math.floor((Math.min(ay, by) - reach) / cell), j1 = Math.floor((Math.max(ay, by) + reach) / cell);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const k2 = key(i, j); if (!grid.has(k2)) grid.set(k2, []); grid.get(k2).push([ax, ay, bx, by]);
    }
  }
  return (x, y) => {
    let d = Infinity;
    for (const s of grid.get(key(Math.floor(x / cell), Math.floor(y / cell))) || []) d = Math.min(d, segDist(x, y, ...s));
    return d;
  };
}

// Nearest point on the boundary to (x, y), with the inward normal of that edge.
function nearestEdge(poly, x, y) {
  const ccw = polyArea(poly) > 0;
  let best = null;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[j], [bx, by] = poly[i], dx = bx - ax, dy = by - ay, d2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / d2)), px = ax + t * dx, py = ay + t * dy;
    const d = Math.hypot(x - px, y - py), l = Math.sqrt(d2), n = ccw ? [-dy / l, dx / l] : [dy / l, -dx / l];
    if (!best || d < best.d) best = { d, p: [px, py], n };
  }
  return best;
}

/**
 * layoutSteps(input) -> generator; its return value is the layout.
 * input: { boundary: [[e, n]...], targetMW, layout: 'south' | 'east-west', groundAt(e, n) -> m or NaN,
 *          grid: [e, n] | null (the connection the compound faces), water: [[[e, n]...]...],
 *          ohl: [{ pts: [[e, n]...], closed, reachM }] | null (overhead line zones: no tables within reach + ohlMarginM),
 *          options: {...} }
 */
export function* layoutSteps(input) {
  const layout = ['east-west', 'tracker'].includes(input.layout) ? input.layout : 'south', o = input.options || {};
  const byFields = (o.packing ?? LAYOUT_DEFAULTS.packing) === 'fields' && layout !== 'tracker'; // tracker rows keep the band rule
  const p = { ...LAYOUT_DEFAULTS, ...(byFields ? FIELD_DEFAULTS : {}), ...o, packing: byFields ? 'fields' : 'bands' };
  const asked = Number(input.targetMW);
  if (!(asked >= 1 && asked <= 5000)) throw new Error('plant layout: capacity must be 1 to 5000 MW');
  if (!(p.fenceSetbackM >= 5 && p.fenceSetbackM <= 10)) throw new Error('plant layout: fence setback must be 5 to 10 m');
  if (!PACKINGS.includes(o.packing ?? 'fields')) throw new Error(`plant layout: packing must be ${PACKINGS.join(' or ')}`);
  const F = frameOf(layout), polys = fieldsOf(input.boundary).map(f => f.map(([e, n]) => F.uv(e, n))).filter(f => f.length >= 3 && Math.abs(polyArea(f)) >= 100);
  if (!polys.length) throw new Error('plant layout: the boundary needs at least three corners around some land');
  const FS = fieldSet(polys, p), poly = polys[0];
  const tplOf = mw => plantTemplate({ ...(input.template || {}), targetMW: mw }); // input.template: typed module and string choices
  const tplAsked = tplOf(asked), T = tableGeometry(layout, p, tplAsked);
  const hc = halfCols(T.cols), halfUnits = hc / T.cols, halfLen = hc * (T.lenU + p.moduleGapM) / T.cols - p.moduleGapM;
  const g = (u, v) => { const [e, n] = F.en(u, v); const h = input.groundAt(e, n); return Number.isFinite(h) ? h : NaN; };
  const water = (input.water || []).map(l => l.map(([e, n]) => F.uv(e, n)));
  const waterAt = water.length ? waterIndex(water, p.waterSetbackM + T.lenU) : () => Infinity;
  const half = Math.hypot(T.lenU, T.depth) / 2, ohlZones = (input.ohl || []).map(z => {
    const pts = z.pts.map(([e, n]) => F.uv(e, n)), r = z.reachM + p.ohlMarginM + half;
    return { pts, closed: !!z.closed && pts.length > 2, r, box: [Math.min(...pts.map(q => q[0])) - r, Math.max(...pts.map(q => q[0])) + r,
      Math.min(...pts.map(q => q[1])) - r, Math.max(...pts.map(q => q[1])) + r] };
  });
  // Inside an overhead line zone grown by the margin and the table's half diagonal (GS6 planning zone, illustrative).
  const inOhl = (u, v) => ohlZones.some(z => u > z.box[0] && u < z.box[1] && v > z.box[2] && v < z.box[3]
    && ((z.closed && inside(z.pts, u, v)) || z.pts.some((q, i) => (i || z.closed) && segDist(u, v, ...z.pts[(i || z.pts.length) - 1], ...q) < z.r)));
  const [us0, us1, vs0, vs1] = FS.box;
  const notes = [];
  const survey = surveyNote(input.survey);
  if (survey) notes.push(survey);

  // Compound at the boundary point nearest the grid connection (one for every field), set in by the fence setback.
  let gp = input.grid ? F.uv(...input.grid) : null;
  if (!gp) { gp = [(us0 + us1) / 2, vs0 - 1]; notes.push('No grid connection given: the compound is placed on the south side.'); }
  const ne = polys.map(f => nearestEdge(f, gp[0], gp[1])).reduce((a, b) => (b.d < a.d ? b : a));
  const inset = p.fenceSetbackM + Math.hypot(p.compoundW, p.compoundD) / 2, cu = ne.p[0] + ne.n[0] * inset, cv = ne.p[1] + ne.n[1] * inset;
  const compound = { u: cu, v: cv, w: p.compoundW, d: p.compoundD };
  const okPoint = FS.ok;

  // Spine along v through the middle; the access road runs along v = cv from the compound to it.
  const us = (us0 + us1) / 2;
  let vLo = Infinity, vHi = -Infinity;
  for (let v = vs0; v <= vs1; v += 5) if (okPoint(us, v)) { vLo = Math.min(vLo, v); vHi = Math.max(vHi, v); }
  if (!Number.isFinite(vLo)) { vLo = cv; vHi = byFields ? vs1 : cv; notes.push('The spine road line through the middle is outside the boundary.'); }
  const accessU0 = Math.abs(us - cu) > p.compoundW / 2 ? cu + Math.sign(us - cu) * p.compoundW / 2 : null;
  const rows = Math.max(2, Math.round(p.bandTargetM / T.pitch));
  const band = byFields ? p.bandTargetM : p.trackWidthM + 2 * p.roadClearM + (rows - 1) * T.pitch + T.depth;
  const tracks = [];
  for (let v = Math.min(vLo, cv) + p.trackWidthM / 2; v <= vHi; v += band) tracks.push(v);
  const perRun = Math.max(1, Math.round(p.runTargetM / (T.lenU + p.tableGapM)));
  const runLen = perRun * T.lenU + (perRun - 1) * p.tableGapM, runStep = runLen + p.crossLaneM;
  const spineHalf = p.spineWidthM / 2 + p.roadClearM, trackHalf = p.trackWidthM / 2 + p.roadClearM;
  const inCompound = (ua, ub, va, vb) => ub > cu - p.compoundW / 2 - p.roadClearM && ua < cu + p.compoundW / 2 + p.roadClearM
    && vb > cv - p.compoundD / 2 - p.roadClearM && va < cv + p.compoundD / 2 + p.roadClearM;
  const inAccess = (ua, ub, va, vb) => accessU0 !== null && vb > cv - trackHalf && va < cv + trackHalf
    && ub > Math.min(accessU0, us) && ua < Math.max(accessU0, us);

  // ---- candidate tables ----
  const skipped = { setback: 0, roads: 0, water: 0, ohl: 0, unmeasured: 0, slope: 0, twist: 0, hollow: 0, ...(T.tracker ? { cross: 0 } : {}) };
  const avoid = (input.avoid || []).filter(a => a && typeof a.test === 'function' && a.id);
  const alongPts = (ua, ub, vs) => { const k = Math.max(2, Math.ceil((ub - ua) / AVOID_STEP_M)); return vs.flatMap(v => Array.from({ length: k + 1 }, (_, i) => [ua + (ub - ua) * i / k, v])); };
  for (const a of avoid) skipped[a.id] = skipped[a.id] || 0;
  const acc = { ua: [], va: [], k: [], s: [], j: [], r: [], i: [], h: [], x: [], w: [] };
  // Slope-aware row gap (south, rowGap 'slope'): the gap behind a row is stretched on ground falling to the north
  // (structures.mjs pitchStretch at winter noon), read along the row every 25 m over the flat-ground gap; 80th percentile.
  // The fields packing reads each field on its own, so the pitch follows each field's own fall.
  const aware = layout === 'south' && p.rowGap === 'slope', elev = winterNoonDeg(p.latDeg), gap0 = T.pitch - T.depth;
  const stretchAt = (va, vb, fi = -1) => {
    if (!aware) return 1;
    const f = [], [a0, a1] = fi < 0 ? [us0, us1] : FS.list[fi].box;
    for (let u = a0 + 12.5; u < a1; u += 25) {
      const a = g(u, vb), b = g(u, vb + gap0);
      if (Number.isFinite(a + b) && (fi < 0 ? FS.inAny(u, va) : inside(FS.list[fi].poly, u, va))) f.push((a - b) / gap0);
    }
    if (!f.length) return 1;
    f.sort((x, y) => x - y);
    return pitchStretch({ depth: T.depth, rise: T.rise, elevDeg: elev, fallN: f[Math.floor(0.8 * (f.length - 1))], maxStretch: p.maxStretch });
  };
  const gapStats = { rowsStretched: 0, rowsDropped: 0, maxStretch: 1 };
  const crossRev = p.trackerCrossReviewPct / 100, crossMax = p.trackerCrossMaxPct / 100;
  const lim = p.slopeLimitPct / 100, d5 = p.slopeStepM, R = p.hollowRadiusM;
  // One table position through every check: kept (true), or counted under the check that left it out.
  const consider = (ua, ub, va, vb, m) => {
    const um = (ua + ub) / 2, vm = (va + vb) / 2, L = ub - ua;
    if (inCompound(ua, ub, va, vb) || inAccess(ua, ub, va, vb)) { skipped.roads++; return false; }
    if (waterAt(um, vm) < p.waterSetbackM + Math.hypot(L, T.depth) / 2) { skipped.water++; return false; }
    if (ohlZones.length && inOhl(um, vm)) { skipped.ohl++; return false; }
    // input.avoid: [{ id, test(e, n) }] areas kept clear (overhead line zones); each counts what it kept out in skipped[id].
    // Tested along both long edges and the middle at most AVOID_STEP_M apart, so a long tracker row cannot straddle a zone.
    const av = avoid.length ? avoid.find(a => alongPts(ua, ub, [va, vm, vb]).some(([u, v]) => a.test(...F.en(u, v)))) : null;
    if (av) { skipped[av.id] = (skipped[av.id] || 0) + 1; return false; }
    const h = [g(ua, va), g(ub, va), g(ub, vb), g(ua, vb)], hm = g(um, vm);
    const e5 = g(um + d5, vm), w5 = g(um - d5, vm), n5 = g(um, vm + d5), s5 = g(um, vm - d5);
    if (!Number.isFinite(h[0] + h[1] + h[2] + h[3] + hm + e5 + w5 + n5 + s5)) { skipped.unmeasured++; return false; }
    const gu = (e5 - w5) / (2 * d5), gv = (n5 - s5) / (2 * d5), gl = (h[1] + h[2] - h[0] - h[3]) / (2 * L);
    if (Math.max(Math.hypot(gu, gv), Math.hypot(gl, gv)) > lim + 1e-12) { skipped.slope++; return false; }
    // Per table, before piling (user test H5): the slope along each edge and across each end within the limit, and the
    // twist (the change of cross slope from one end to the other) within the table's tolerance (trackers follow it).
    const edge = Math.max(Math.abs(h[1] - h[0]), Math.abs(h[2] - h[3])) / L, end = Math.max(Math.abs(h[3] - h[0]), Math.abs(h[2] - h[1])) / T.depth;
    if (Math.max(edge, end) > lim + 1e-12) { skipped.slope++; return false; }
    // Tracker rows: the slope across the row (east-west, frame v) over a 10 m base and across each end. Over the
    // exclusion line the row is left out; over the review line it is kept and flagged for the maker's review.
    const cross = T.tracker ? Math.max(Math.abs(gv), end) : 0;
    if (T.tracker && cross > crossMax + 1e-12) { skipped.cross++; return false; }
    const tw = Math.abs(Math.atan((h[3] - h[0]) / T.depth) - Math.atan((h[2] - h[1]) / T.depth)) * 180 / Math.PI;
    if (!T.tracker && tw > p.twistTolDeg + 1e-9) { skipped.twist++; return false; }
    let lowest = Infinity;
    for (let q = 0; q < 8; q++) lowest = Math.min(lowest, g(um + R * Math.cos(q * Math.PI / 4), vm + R * Math.sin(q * Math.PI / 4)));
    if (Number.isFinite(lowest) && lowest - hm >= p.hollowDepthM) { skipped.hollow++; return false; }
    acc.ua.push(ua); acc.va.push(va); acc.k.push(m.k); acc.s.push(m.s); acc.j.push(m.j); acc.r.push(m.r); acc.i.push(m.i);
    acc.h.push(h); acc.x.push(cross > crossRev + 1e-12); acc.w.push(m.units);
    return true;
  };
  let n = 0, packed = null;
  if (byFields) {
    packed = yield* packFields({ fields: FS, T, p, us, spineHalf, tracks, trackHalf, halfLen, halfUnits, consider, accepted: () => acc.ua.length,
      stretch: (fi, va, vb) => stretchAt(va, vb, fi) });
    n = packed.candidates;
    if (aware) Object.assign(gapStats, { rowsStretched: packed.stretched, maxStretch: packed.maxStretch });
  } else {
    for (let k = 0, va = 0; k < tracks.length; k++) for (let r = 0; r < rows; r++) {
      if (!r) va = tracks[k] + trackHalf;
      else if (aware) { const x = stretchAt(va, va + T.depth); va += T.pitch * x; if (x > 1 + 1e-6) gapStats.rowsStretched++; gapStats.maxStretch = Math.max(gapStats.maxStretch, x); }
      else va += T.pitch;
      const vb = va + T.depth;
      if (vb > tracks[k] + band - trackHalf + 1e-6) { gapStats.rowsDropped += rows - r; break; } // stretched past the next track
      if (va > vs1) continue;
      for (const s of [1, -1]) for (let j = 0; ; j++) {
        const near = us + s * (spineHalf + j * runStep);
        if ((s > 0 && near > us1) || (s < 0 && near < us0)) break;
        for (let i = 0; i < perRun; i++) {
          const a = near + s * i * (T.lenU + p.tableGapM), b = a + s * T.lenU, ua = Math.min(a, b), ub = Math.max(a, b);
          if (++n % p.chunk === 0) yield { phase: 'tables', candidates: n, accepted: acc.ua.length };
          const um = (ua + ub) / 2, vm = (va + vb) / 2;
          if (!(okPoint(ua, va) && okPoint(ub, va) && okPoint(ua, vb) && okPoint(ub, vb) && okPoint(um, va) && okPoint(um, vb))) {
            if (FS.inAny(um, vm)) skipped.setback++;
            continue;
          }
          consider(ua, ub, va, vb, { k, s, j, r, i, units: 1 });
        }
      }
    }
  }
  const found = acc.ua.length, foundUnits = acc.w.reduce((t, w) => t + w, 0);
  if (skipped.cross) notes.push(`${skipped.cross} tracker rows left out: more than ${p.trackerCrossMaxPct} % across the row.`);
  if (gapStats.rowsStretched) notes.push(`${gapStats.rowsStretched} row gaps stretched on ground falling to the north (up to ${gapStats.maxStretch.toFixed(2)} x) `
    + `so the winter-noon shadow reaches no further than on flat ground${gapStats.rowsDropped ? `; ${gapStats.rowsDropped} rows no longer fit their bands` : ''}.`);
  if (skipped.twist) notes.push(`${skipped.twist} table positions left out: the ground twists more than ${p.twistTolDeg}° across the table.`);
  if (skipped.unmeasured) notes.push(`${skipped.unmeasured} table positions skipped: the ground there is not measured.`);
  if (!water.length) notes.push('No mapped water loaded here: the watercourse setback is not applied.');
  if (skipped.ohl) notes.push(`${skipped.ohl} table positions kept out of overhead line zones (GS6 planning zone + ${p.ohlMarginM} m, illustrative).`);
  else if (input.ohl == null && !avoid.some(a => a.id === 'ohl')) notes.push('No overhead line zones given: tables are not kept clear of overhead lines.');
  const halves = acc.w.filter(w => w < 1).length;
  if (halves) notes.push(`${halves} half tables close row ends where a full table does not fit.`);

  // ---- capacity: the asked plant, or the largest whole MW whose tables and station pads fit (in whole-table units) ----
  const need = tpl => tpl.nodes.filter(x => x.kind === 'station')
    .reduce((t, st) => t + Math.ceil(st.rating.strings / T.strings) + 1, 0);
  const room = tpl => need(tpl) <= foundUnits + 1e-9;
  let tpl = tplAsked, fits = room(tplAsked);
  if (!fits) {
    let lo = 0, hi = Math.floor(asked);
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (room(tplOf(mid))) lo = mid; else hi = mid; yield { phase: 'capacity' }; }
    if (lo === 0 && room(tplOf(1))) lo = 1;
    tpl = lo ? tplOf(lo) : null;
  }
  const builtMW = tpl ? tpl.params.targetMW : 0;
  yield { phase: 'blocks' };

  // ---- blocks: bands nearest the compound first, then side, run column, row; station at the block end ----
  const order = Array.from({ length: found }, (_, x) => x);
  const bandRank = tracks.map((v, k) => k).sort((a, b) => Math.abs(tracks[a] - cv) - Math.abs(tracks[b] - cv));
  const rank = new Array(tracks.length); bandRank.forEach((k, x) => { rank[k] = x; });
  order.sort((a, b) => rank[acc.k[a]] - rank[acc.k[b]] || acc.s[b] - acc.s[a] || acc.j[a] - acc.j[b] || acc.r[a] - acc.r[b] || acc.i[a] - acc.i[b]
    || acc.va[a] - acc.va[b] || acc.ua[a] - acc.ua[b]);
  const stations = [], used = [];
  let at = 0;
  for (const st of tpl ? tpl.nodes.filter(x => x.kind === 'station') : []) {
    const want = Math.ceil(st.rating.strings / T.strings) + 1, take = [];
    for (let got = 0; at < found && got < want - 1e-9; at++) { take.push(order[at]); got += acc.w[order[at]]; }
    if (!take.length) break;
    // The pad takes the table nearest the track, nearest the spine: the block end beside the road.
    const pad = take.reduce((b, x) => (acc.r[x] < acc.r[b] || (acc.r[x] === acc.r[b] && Math.abs(acc.ua[x] - us) < Math.abs(acc.ua[b] - us)) ? x : b));
    stations.push({ id: st.id, mva: st.rating.mva, inverters: st.rating.inverters, u: acc.ua[pad] + T.lenU * acc.w[pad] / 2, v: acc.va[pad] + T.depth / 2,
      k: acc.k[pad], track: tracks[acc.k[pad]], tables: take.length - 1,
      ...(st.rating.inverterClass === 'central' ? { central: true, combiners: st.rating.combiners } : {}) });
    for (const x of take) if (x !== pad) used.push(x);
  }
  const lenOf = x => (acc.w[x] < 1 ? halfLen : T.lenU);

  // ---- roads cut to the tables they serve ----
  const reach = new Map();
  const stretch = (k, s, d) => { const key = k + ':' + s; reach.set(key, Math.max(reach.get(key) || 0, d)); };
  for (const x of used) stretch(acc.k[x], acc.s[x], Math.abs(acc.ua[x] + (acc.s[x] > 0 ? lenOf(x) : 0) - us));
  for (const st of stations) stretch(st.k, st.u >= us ? 1 : -1, Math.abs(st.u - us) + T.lenU / 2);
  const trackRoads = [...reach].map(([key, d]) => { const [k, s] = key.split(':').map(Number); return { k, v: tracks[k], s, u0: us, u1: us + s * d }; });
  const vUsed = [cv, ...trackRoads.map(t => t.v)];
  const spine = { u: us, v0: Math.min(...vUsed), v1: Math.max(...vUsed) };
  const access = accessU0 === null ? null : { v: cv, u0: accessU0, u1: us };
  const roadM = (spine.v1 - spine.v0) + trackRoads.reduce((t, r) => t + Math.abs(r.u1 - r.u0), 0) + (access ? Math.abs(access.u1 - access.u0) : 0);
  yield { phase: 'feeders' };

  const net = { us, cv, spine, access, tracks, stations, compound };
  const electrical = tpl ? routeFeeders(tpl, net, p) : null;
  yield { phase: 'routes' };                                       // a slice boundary: routing and piling apart (PERF.md 3)
  if (electrical && !electrical.dropOk) {
    const over = electrical.feeders.filter(f => f.dropPct > tpl.params.vdropLimitPct + 1e-9).length;
    notes.push(`${over} feeder(s) over the ${tpl.params.vdropLimitPct} % MV drop at routed lengths (worst ${electrical.worstDropPct.toFixed(2)} %), `
      + 'even at the largest size: a plant this spread is usually split between two or more collector substations.');
  }
  const tables = new Float64Array(used.length * 6);
  used.forEach((x, q) => tables.set([acc.ua[x], acc.va[x], ...acc.h[x]], q * 6));
  // Half tables: each table's plan length along the row (null when every table is whole).
  const tableLen = used.some(x => acc.w[x] < 1) ? Float64Array.from(used, lenOf) : null;
  const units = used.reduce((t, x) => t + acc.w[x], 0);
  const mwpAsked = tplAsked.ratings.dcMWp, mwpBuilt = units * T.kWp / 1000;
  // Piles: automatic from every table (plant-piles.mjs), on the same measured ground; input.piles = false skips them.
  const piles = input.piles === false || !used.length ? null
    : yield* pilesForLayout({ frame: F, table: T, params: p, tables, tableLen }, input.groundAt, { ...(input.piles || {}), mwp: mwpBuilt });
  if (!fits) notes.unshift(builtMW ? `The boundary fits about ${builtMW} MW of the ${asked} MW asked.` : `Nothing fits: ${found} table positions for a ${asked} MW ask.`);
  return {
    label: LABEL, layout, frame: F, table: T, params: p, asked: { mw: asked, mwp: mwpAsked }, fits,
    built: { mw: builtMW, mwp: Math.round(mwpBuilt * 1000) / 1000, tables: used.length, stations: stations.length,
      feeders: tpl ? tpl.counts.feeders : 0, roadM, candidates: n, found, halfTables: tableLen ? used.filter(x => acc.w[x] < 1).length : 0,
      landMWp: Math.round(foundUnits * T.kWp) / 1000 },
    tables, tableLen, stations, compound, spine, access, trackRoads, tracks, boundary: poly, fields: FS.list.map(f => f.poly), gridPoint: gp, skipped,
    notes, template: tpl, electrical, rows, perRun, piles, rowGap: aware ? gapStats : null, packing: p.packing, survey: survey || null,
    crossReview: T.tracker ? used.filter(x => acc.x[x]).length : 0
  };
}

/** Runs the layout to the end in one go (tests, workers). */
export function layoutPlant(input) {
  const it = layoutSteps(input);
  for (;;) { const r = it.next(); if (r.done) return r.value; }
}

/** Runs the layout in slices of at most sliceMs between yields to the page, so no frame waits on it. */
export async function layoutPlantAsync(input, { sliceMs = 12, onProgress = () => {}, now = () => performance.now(), pause } = {}) {
  const it = layoutSteps(input), rest = pause || (() => new Promise(r => setTimeout(r, 0)));
  let longest = 0, slowest = '', at = 'start';
  for (;;) {
    const t0 = now();
    let r, from = at, s0 = t0, step = 0;
    do { r = it.next(); const t = now(); if (t - s0 > step) { step = t - s0; from = at; } s0 = t; at = r.done ? 'done' : r.value.phase; }
    while (!r.done && now() - t0 < sliceMs);
    if (now() - t0 > longest) { longest = now() - t0; slowest = `${from} > ${at} (one step ${step.toFixed(1)} ms)`; }
    if (r.done) return Object.assign(r.value, { longestSliceMs: longest, slowestStep: slowest });
    onProgress(r.value);
    await rest();
  }
}
