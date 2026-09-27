// piles.mjs: where the piles of a row of solar tables go, how far each stands out of the ground, how deep it
// goes in, and what grading a row needs where the ground is too uneven for a straight table.
//
// Local metres: x east, y north, z up. The ground is any function groundAt(x, y).
// A row is a straight placement line on the ground, [[x0, y0], [x1, y1]]. Tables of tableLength are laid
// along it end to end with tableGap between them, the set centred on the line. Each table is straight and
// rigid, so the tops of its piles lie on one straight line in the vertical section along the row. Piles sit
// pileSpacing apart, centred on their table.
//
// The top-of-pile line of a table is either given (row.top = [zStart, zEnd], the target top level at the two
// ends of the placement line; every table on the row takes that line) or fitted:
//   1. slope b: the one that makes the spread of (ground - b s) over the table's piles smallest, within the
//      along-row slope limit. That spread is convex and piecewise linear in b, so its least value is at a
//      pairwise slope between two piles or at a limit; ties go to the slope nearest the least-squares slope.
//   2. level a: the allowed window [max(g - b s) + revealMin, min(g - b s) + revealMax]; within it, as near
//      the mean nominal reveal as the window allows; if the window is empty, its middle (excess split evenly).
// A pile whose reveal is above revealMax needs fill under it, below revealMin needs cut; the finished ground is
// then level with the allowed limit. Embedment is at least embedMin below the finished ground; with pileStep the
// pile length is rounded up to a stock step and the embedment grows to suit.
// Grading volume: each pile's cut or fill depth over its tributary length (one pile spacing) times the grading
// width (assumed). Slopes: ground gradient at each pile by central differences, split into north-south and
// east-west parts, and checked against the limits for the mounting system.
//
// Shared rules: pile-rules.mjs (embedment, reveal from the table, adjustment and twist tolerances). Twist: rows paired
// front and rear (row.pair = { with: id, depth }) have each table's twist checked against the tolerance.
// No DOM. Pure functions of their inputs. Figures marked ASSUMED are defaults to be replaced by the
// chosen product's datasheet and the site's geotechnical report; they are not design values.

import { PILE_RULES as R, TRACKER_RULES as TR, revealAt, revealBand, trackerHub, twistDeg } from './pile-rules.mjs';

// Typical slope limits, as fractions (rise over run). Sources:
//  [1] K. Anderson, M. Mikofski, "Slope-Aware Backtracking for Single-Axis Trackers", NREL/TP-5K00-76626, 2020,
//      https://docs.nrel.gov/docs/fy20osti/76626.pdf (definitions of axis tilt and cross-axis slope).
//  [2] Sandia PV Performance Modeling Collaborative, "Single Axis Tracking",
//      https://pvpmc.sandia.gov/modeling-guide/1-weather-design-inputs/array-orientation/single-axis-tracking/
//  [3] Trade-press survey of tracker datasheets, 2023-2024 (standard products commonly 8.5-15 % along the axis,
//      terrain-following products more; cross-axis slope commonly 10-20 % with slope-aware backtracking),
//      https://www.solarpowerworldonline.com/2023/01/single-axis-trackers-upgrade-to-handle-uneven-land-sites/
// Single-axis tracker rows run north-south, so its north-south limit applies along the torque tube.
// Fixed-tilt rows run east-west, so its east-west limit applies along the table.
export const LIMITS = {
  tracker: {
    nsMax: 0.10, ewMax: 0.15, along: 'ns',
    note: 'typical single-axis tracker: 10 % along the axis (north-south), 15 % across (east-west) [1][2][3]; ASSUMED',
  },
  fixed: {
    nsMax: 0.20, ewMax: 0.15, along: 'ew',
    note: 'typical fixed tilt: 15 % along the row (east-west), 20 % north-south (changes the effective tilt) [3]; ASSUMED',
  },
};

// ASSUMED defaults, labelled as such in every result (result.assumed).
// Fixed tilt is the plant layout's table: 28 modules across (32.3 m; class A at -10 °C, the stricter of the cell and Voc x 1.15), 2P portrait at 25 deg (rise 2.02 m), low edge
// 0.8 m, one post at mid-slope -> reveal 1.51 m (pile-rules.mjs). The plant layout passes its own table instead.
const FIXED_RISE = (2 * 2.384 + 0.02) * Math.sin(25 * Math.PI / 180);
export const DEFAULTS = {
  tracker: { tableLength: 60, pileSpacing: TR.pileSpacingM.tracker, tableGap: 1, reveal: revealBand(trackerHub(TR).reveal, TR) },
  fixed: { tableLength: 32.3, pileSpacing: R.pileSpacingM.fixed, tableGap: 0.5,
    reveal: revealBand(revealAt({ lowEdgeM: 0.8, rise: FIXED_RISE, f: R.pivot })) },
  embedMin: R.embedM,  // embedment, metres: in practice set by pile load tests
  gradingWidth: R.gradingWidthM, // width of ground graded along a row, metres
  pileStep: 0,         // stock length step, metres; 0 means piles cut to length
  gradStep: 1.0,       // central-difference half step for the ground gradient, metres
  revealAdjust: R.revealAdjustM, twistTolDeg: R.twistTolDeg,
};

const EPS = 1e-9;

/** Pile chainages along a placement line of length len: [{ table, s }], and the table extents. */
export function pileStations(len, tableLength, pileSpacing, tableGap = 0) {
  if (!(tableLength > 0) || !(pileSpacing > 0)) throw new Error('piles: tableLength and pileSpacing must be positive');
  if (pileSpacing > tableLength + EPS) throw new Error('piles: pileSpacing is longer than the table');
  if (!(tableGap >= 0)) throw new Error('piles: tableGap must be zero or positive');
  const nt = Math.floor((len + tableGap + EPS) / (tableLength + tableGap));
  const used = nt * tableLength + Math.max(nt - 1, 0) * tableGap;
  const off = (len - used) / 2;
  const np = Math.floor(tableLength / pileSpacing + EPS) + 1;
  const over = (tableLength - (np - 1) * pileSpacing) / 2;
  const tables = [], stations = [];
  for (let t = 0; t < nt; t++) {
    const s0 = off + t * (tableLength + tableGap);
    tables.push({ table: t, s0, s1: s0 + tableLength });
    for (let k = 0; k < np; k++) stations.push({ table: t, s: s0 + over + k * pileSpacing });
  }
  return { tables, stations, pilesPerTable: np };
}

const spreadAt = (s, g, b) => {
  let hi = -Infinity, lo = Infinity;
  for (let i = 0; i < s.length; i++) { const d = g[i] - b * s[i]; if (d > hi) hi = d; if (d < lo) lo = d; }
  return { hi, lo, w: hi - lo };
};

/**
 * fitTopLine(s, g, { min, nominal, max }, maxSlope): the straight top-of-pile line z = a + b s for piles at
 * chainages s over ground g. Returns { a, b, spread, window, feasible }.
 */
export function fitTopLine(s, g, reveal, maxSlope = Infinity) {
  const n = s.length;
  if (n < 1 || g.length !== n) throw new Error('piles: fitTopLine needs matching s and g');
  const lim = Math.abs(maxSlope);
  let bls = 0;
  if (n > 1) {
    const ms = s.reduce((p, v) => p + v, 0) / n, mg = g.reduce((p, v) => p + v, 0) / n;
    let sxy = 0, sxx = 0;
    for (let i = 0; i < n; i++) { sxy += (s[i] - ms) * (g[i] - mg); sxx += (s[i] - ms) ** 2; }
    bls = sxx > 0 ? sxy / sxx : 0;
  }
  const clip = (b) => Math.max(-lim, Math.min(lim, b));
  const cand = [clip(bls)];
  if (Number.isFinite(lim)) cand.push(-lim, lim);
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    if (Math.abs(s[j] - s[i]) > EPS) cand.push(clip((g[j] - g[i]) / (s[j] - s[i])));
  }
  let best = null;
  for (const b of cand) {
    const r = spreadAt(s, g, b);
    if (!best || r.w < best.w - 1e-9 || (r.w <= best.w + 1e-9 && Math.abs(b - bls) < Math.abs(best.b - bls))) best = { b, ...r };
  }
  const { b, hi, lo, w } = best;
  const winLo = hi + reveal.min, winHi = lo + reveal.max;
  let mean = 0;
  for (let i = 0; i < n; i++) mean += g[i] - b * s[i];
  const aNom = mean / n + reveal.nominal;
  const feasible = winLo <= winHi + EPS;
  const a = feasible ? Math.max(winLo, Math.min(winHi, aNom)) : (winLo + winHi) / 2;
  return { a, b, spread: w, window: [winLo, winHi], feasible };
}

function slopeAt(groundAt, x, y, h) {
  const gx = (groundAt(x + h, y) - groundAt(x - h, y)) / (2 * h);
  const gy = (groundAt(x, y + h) - groundAt(x, y - h)) / (2 * h);
  return { gx, gy };
}

/**
 * planPiles({ rows, groundAt, system, ...options }) -> { rows, piles, summary, limits, assumed }
 * rows: [{ id?, line: [[x0, y0], [x1, y1]], top?: [zStart, zEnd] }]
 * system: 'tracker' (default) or 'fixed'. Options override DEFAULTS[system] and DEFAULTS:
 *   tableLength, pileSpacing, tableGap, reveal { min, nominal, max }, embedMin, gradingWidth, pileStep, gradStep,
 *   limits { nsMax, ewMax } (override LIMITS[system]).
 */
export function planPiles(opts) {
  const { rows, groundAt } = opts;
  const system = opts.system || 'tracker';
  if (!LIMITS[system]) throw new Error(`piles: unknown system ${system}`);
  if (typeof groundAt !== 'function') throw new Error('piles: groundAt(x, y) is required');
  if (!Array.isArray(rows)) throw new Error('piles: rows must be an array');
  const D = DEFAULTS[system];
  const tableLength = opts.tableLength ?? D.tableLength, pileSpacing = opts.pileSpacing ?? D.pileSpacing;
  const tableGap = opts.tableGap ?? D.tableGap;
  const reveal = { ...D.reveal, ...(opts.reveal || {}) };
  const embedMin = opts.embedMin ?? DEFAULTS.embedMin, gradingWidth = opts.gradingWidth ?? DEFAULTS.gradingWidth;
  const pileStep = opts.pileStep ?? DEFAULTS.pileStep, gradStep = opts.gradStep ?? DEFAULTS.gradStep;
  const revealAdjust = opts.revealAdjust ?? DEFAULTS.revealAdjust, twistTol = opts.twistTolDeg ?? DEFAULTS.twistTolDeg;
  const embedRatio = opts.embedToReveal ?? 0; // embedment at least this x the post's finished reveal (lateral load)
  const limits = { ...LIMITS[system], ...(opts.limits || {}) };
  if (!(reveal.min <= reveal.nominal && reveal.nominal <= reveal.max)) throw new Error('piles: need reveal min <= nominal <= max');
  if (!(embedMin > 0)) throw new Error('piles: embedMin must be positive');
  const alongMax = limits.along === 'ns' ? limits.nsMax : limits.ewMax;

  const outRows = [], allPiles = [];
  const sum = { rows: 0, tables: 0, piles: 0, revealHigh: 0, revealLow: 0, tablesNeedingGrading: 0,
    cutM3: 0, fillM3: 0, nsSlopeTables: 0, ewSlopeTables: 0, topSlopeTables: 0, localSlopeTables: 0, totalPileLengthM: 0,
    revealAdjust: 0, twistTables: 0, embedBelowReveal: 0 };
  rows.forEach((row, ri) => {
    const [[x0, y0], [x1, y1]] = row.line;
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (!(len > EPS)) throw new Error(`piles: row ${row.id ?? ri} has no length`);
    const ux = (x1 - x0) / len, uy = (y1 - y0) / len;
    const { tables, stations } = pileStations(len, tableLength, pileSpacing, tableGap);
    const rv = row.reveal ? { ...reveal, ...row.reveal } : reveal;   // per-row band: a two-post table's rear line
    const rowOut = { id: row.id ?? ri, length: len, bearingDeg: (Math.atan2(ux, uy) * 180 / Math.PI + 360) % 360,
      tables: [], flags: [], cutM3: 0, fillM3: 0 };
    if (!tables.length) rowOut.flags.push('row shorter than one table');
    for (const tb of tables) {
      const st = stations.filter((p) => p.table === tb.table);
      const s = st.map((p) => p.s);
      const xy = s.map((v) => [x0 + ux * v, y0 + uy * v]);
      const g = xy.map(([x, y]) => groundAt(x, y));
      if (g.some((v) => !Number.isFinite(v))) throw new Error(`piles: no ground under row ${rowOut.id}`);
      const fit = row.tops ? { a: 0, b: 0, given: true, at: st.map(p => row.tops[stations.indexOf(p)]) }
        : row.top ? { a: row.top[0], b: (row.top[1] - row.top[0]) / len, given: true }
          : fitTopLine(s, g, rv, alongMax);
      const topOf = k => (fit.at ? fit.at[k] : fit.a + fit.b * s[k]);
      if (fit.at) fit.b = st.length > 1 ? (fit.at[st.length - 1] - fit.at[0]) / (s[st.length - 1] - s[0]) : 0;
      const tOut = { table: tb.table, s0: tb.s0, s1: tb.s1, topLevelStart: fit.at ? fit.at[0] : fit.a + fit.b * tb.s0,
        topLevelEnd: fit.at ? fit.at[st.length - 1] : fit.a + fit.b * tb.s1, topSlope: fit.b, twistDeg: 0, given: !!fit.given, feasible: true,
        piles: [], cutM3: 0, fillM3: 0, maxNs: 0, maxEw: 0, nsSlope: 0, ewSlope: 0, flags: [] };
      st.forEach((p, k) => {
        const [x, y] = xy[k], ground = g[k], top = topOf(k), rev = top - ground;
        const fill = Math.max(rev - rv.max, 0), cut = Math.max(rv.min - rev, 0);
        const finished = ground + fill - cut, finRev = top - finished;
        const emb = Math.max(embedMin, embedRatio * finRev);
        let length = finRev + emb;
        if (pileStep > 0) length = Math.ceil(length / pileStep - 1e-9) * pileStep;
        const { gx, gy } = slopeAt(groundAt, x, y, gradStep);
        const flags = [];
        if (rev > rv.max + EPS) flags.push('reveal-high');
        if (rev < rv.min - EPS) flags.push('reveal-low');
        const adjust = rev - rv.nominal, outsideAdjust = Math.abs(adjust) > revealAdjust + EPS;
        if (outsideAdjust) sum.revealAdjust++;
        if (emb > embedMin + EPS) sum.embedBelowReveal++; // lengthened past the soil's embedment by the lateral-load rule
        const pile = { row: rowOut.id, table: tb.table, index: k, s: p.s, x, y, ground, top, reveal: rev, cut, fill,
          finishedGround: finished, finishedReveal: finRev, embed: length - finRev, toe: top - length, length, adjust, outsideAdjust,
          slopeNs: gy, slopeEw: gx, slopeAlong: gx * ux + gy * uy, slopeCross: -gx * uy + gy * ux, flags };
        tOut.piles.push(pile); allPiles.push(pile);
        tOut.cutM3 += cut * pileSpacing * gradingWidth; tOut.fillM3 += fill * pileSpacing * gradingWidth;
        tOut.maxNs = Math.max(tOut.maxNs, Math.abs(gy)); tOut.maxEw = Math.max(tOut.maxEw, Math.abs(gx)); // local, 1 m
        tOut.nsSlope += gy / st.length; tOut.ewSlope += gx / st.length;                                   // table mean
        if (flags.length) { tOut.feasible = false; if (flags[0] === 'reveal-high') sum.revealHigh++; else sum.revealLow++; }
        sum.piles++; sum.totalPileLengthM += length;
      });
      if (!tOut.feasible) { tOut.flags.push('grading needed'); sum.tablesNeedingGrading++; }
      // Slope limits apply to the table: the mean ground gradient over its piles, so a ditch, a bank or LiDAR noise
      // under one pile does not flag the table. The worst 1 m point gradient is kept as maxNs / maxEw ("local").
      tOut.nsSlope = Math.abs(tOut.nsSlope); tOut.ewSlope = Math.abs(tOut.ewSlope);
      if (tOut.nsSlope > limits.nsMax + EPS) { tOut.flags.push('north-south slope over limit'); sum.nsSlopeTables++; }
      if (tOut.ewSlope > limits.ewMax + EPS) { tOut.flags.push('east-west slope over limit'); sum.ewSlopeTables++; }
      if (tOut.maxNs > limits.nsMax + EPS || tOut.maxEw > limits.ewMax + EPS) sum.localSlopeTables++;
      if (Math.abs(fit.b) > alongMax + EPS) { tOut.flags.push('table slope over limit'); sum.topSlopeTables++; }
      rowOut.cutM3 += tOut.cutM3; rowOut.fillM3 += tOut.fillM3;
      for (const f of tOut.flags) if (!rowOut.flags.includes(f)) rowOut.flags.push(f);
      rowOut.tables.push(tOut); sum.tables++;
    }
    sum.cutM3 += rowOut.cutM3; sum.fillM3 += rowOut.fillM3; sum.rows++;
    outRows.push(rowOut);
  });
  // Twist: a front row and its rear row carry one rigid table each; their top slopes may differ only by the tolerance.
  rows.forEach((row, ri) => {
    const mi = row.pair ? outRows.findIndex(r => r.id === row.pair.with) : -1, mate = outRows[mi];
    if (!mate || (mi < ri && rows[mi].pair?.with === outRows[ri].id)) return; // each pair once
    outRows[ri].tables.forEach((t, k) => {
      const m = mate.tables[k]; if (!m) return;
      t.twistDeg = m.twistDeg = twistDeg(t.topSlope, m.topSlope, tableLength, row.pair.depth);
      if (t.twistDeg > twistTol + EPS) {
        for (const x of [t, m]) if (!x.flags.includes('twist over tolerance')) x.flags.push('twist over tolerance');
        sum.twistTables++;
      }
    });
  });
  return {
    system, rows: outRows, piles: allPiles, summary: sum,
    limits: { nsMax: limits.nsMax, ewMax: limits.ewMax, alongMax, note: limits.note },
    assumed: { tableLength, pileSpacing, tableGap, reveal, embedMin, gradingWidth, pileStep, gradStep, revealAdjust, twistTolDeg: twistTol,
      note: 'ASSUMED defaults unless passed in: replace with the product datasheet and the geotechnical report. '
        + 'Embedment is the same for every pile, independent of reveal: set it from pile tests. Grading volumes are '
        + 'indicative: depth x pile spacing x grading width per pile.' },
  };
}

/**
 * followTopLine(s, g, nominal, bayMax): a terrain-following tube over posts at chainages s on ground g. It starts at
 * ground + nominal and, pass after pass, pulls each inner post towards the straight line through its neighbours until
 * the slope changes by at most bayMax from bay to bay. Returns the tops.
 */
export function followTopLine(s, g, nominal, bayMax, passes = 400) {
  const t = g.map(v => v + nominal), n = t.length;
  for (let k = 0; k < passes; k++) {
    let moved = 0;
    for (let i = 1; i < n - 1; i++) {
      const h1 = s[i] - s[i - 1], h2 = s[i + 1] - s[i], mid = (t[i - 1] * h2 + t[i + 1] * h1) / (h1 + h2);
      const e = bayMax / (1 / h1 + 1 / h2), d = t[i] - mid, c = Math.max(-e, Math.min(e, d));
      if (Math.abs(c - d) > 1e-12) { t[i] = mid + c; moved++; }
    }
    if (!moved) break;
  }
  return t;
}

/** Reveal distribution of a set of piles: percentiles 0, 5, 25, 50, 75, 95, 100 (nearest-rank). */
export function revealPercentiles(piles) {
  const v = piles.map((p) => p.reveal).sort((a, b) => a - b);
  if (!v.length) return [];
  return [0, 5, 25, 50, 75, 95, 100].map((q) => v[Math.min(v.length - 1, Math.max(0, Math.ceil(q / 100 * v.length) - 1))]);
}
