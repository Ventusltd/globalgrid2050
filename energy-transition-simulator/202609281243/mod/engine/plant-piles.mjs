// COPIED UNCHANGED from the v12 world (web/world/plant-piles.mjs) at v12 commit 3adcee9 (file last changed b484f9f). Modular star family: public #147944 planTables.
// Do not edit here: change the source and re-copy. Everything below this header is byte-identical to the source.
// plant-piles.mjs: the piles of every table of a laid-out plant (plant-layout.mjs), fixed tilt or single-axis tracker,
// worked out automatically on the measured ground. Nobody places a pile: piles are an output of the tables.
//
// Each table gets its pile lines from its geometry (pile-rules.mjs tableLines).
// FIXED TILT: a south-facing two-post table has a front and a rear line at 0.2 and 0.8 of its depth, each with its own
// nominal reveal (lowest module edge + rise x fraction - rails); an east-west table has one line under each face.
// The table is one rigid frame, so its tilt never changes: all its posts are fitted together (fitTopLine: the straight
// top within the along-row slope limit with the least reveal spread; ties in slope go to the one nearest the
// least-squares slope, so the fit is unique), the rear top the difference in nominal reveal above the front. The posts
// take the cross slope. Checks: reveal band and head adjustment (planPiles), the twist the ground asks for (from the
// least-squares slopes of the ground, smoothed over 4 m, under the front and rear lines, as a change of rafter angle),
// the lowest module edge's clearance, reveal over the warn and fail heights.
// TRACKER: one line of posts along the torque tube; the tube follows the ground within the bay-to-bay slope change
// (followTopLine); posts off the tube line by more than the height tolerance mean the tracker cannot follow: grading.
// Every table whose ground is not measured under some posts is flagged, never silently filled in.
// gradingSuggestions groups the tables that need grading into patches: regrade, raise, or drop the table.
// Figures are ILLUSTRATIVE (pile-rules.mjs); embedment is provisional. Pure: no DOM. Runs as a generator in chunks.

import { planPiles, fitTopLine, followTopLine, pileStations, LIMITS } from './piles.mjs';
import { PILE_RULES, rulesFor, tableLines, revealBand, twistDeg, withSoil, heightFlags } from './pile-rules.mjs';

export const PILES_LABEL = 'Piles from the tables, automatic, on illustrative rules: embedment provisional (pile tests set it).';
const CHUNK = 8; // tables per planPiles call: a short step on a slow phone (measured ground is slower to sample than a formula)
const SMOOTH_M = 2; // twist is read from the ground averaged over a 4 m cross at each post

function lsSlope(s, g) {
  const n = s.length, ms = s.reduce((a, v) => a + v, 0) / n, mg = g.reduce((a, v) => a + v, 0) / n;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (s[i] - ms) * (g[i] - mg); sxx += (s[i] - ms) ** 2; }
  return sxx > 0 ? sxy / sxx : 0;
}

/**
 * planTables(tables, { groundAt(e, n), system, posts, rules, along, pileSpacing, railDepthM }) -> generator; returns
 * { tables: [result per table], unmeasured, rules, system }. A table in: { lineAt(f) -> [[e0, n0], [e1, n1]] (its pile
 * line at fraction f of the depth from the low edge), length, depth, rise, lowEdgeM, eastWest, key: [lane, start, end] }.
 */
export function* planTables(tablesIn, { groundAt, system = 'fixed', posts = 2, rules, along = 'ew', pileSpacing, railDepthM } = {}) {
  const tracker = system === 'tracker', R = { ...(rules || rulesFor(system)), ...(railDepthM != null ? { railDepthM } : {}) };
  const sp = pileSpacing ?? R.pileSpacingM[tracker ? 'tracker' : 'fixed'];
  let last = 0, missing = 0, unmeasured = 0;
  const gq = (e, n) => { const h = groundAt(e, n); if (Number.isFinite(h)) { last = h; return h; } missing++; return last; };
  const gs = (e, n) => { const h = groundAt(e, n); return Number.isFinite(h) ? h : last; };
  const alongMax = tracker ? R.alongMaxPct / 100 : along === 'ns' ? LIMITS.fixed.nsMax : LIMITS.fixed.ewMax;
  const out = [];
  for (let c = 0; c < tablesIn.length; c += CHUNK) {
    // Tables of one length are planned together: a half table closing a row end is planned at its own length.
    const part = tablesIn.slice(c, c + CHUNK), groups = new Map(), meta = [];
    for (const T of part) {
      if (!groups.has(T.length)) groups.set(T.length, []);
      const rows = groups.get(T.length);
      const lines = tableLines({ lowEdgeM: T.lowEdgeM, rise: T.rise, posts: T.eastWest ? 2 : posts, eastWest: T.eastWest, tracker, rules: R });
      const s = pileStations(T.length, T.length, sp, 0).stations.map(p => p.s), m0 = missing, flags = [], base = rows.length;
      const at = (f, v) => { const [[x0, y0], [x1, y1]] = T.lineAt(f), k = v / T.length; return [x0 + (x1 - x0) * k, y0 + (y1 - y0) * k]; };
      const gl = lines.map(L => s.map(v => gq(...at(L.f, v))));
      let twist = 0;
      if (tracker) {
        const tops = followTopLine(s, gl[0], lines[0].nominal, Math.tan(R.bayChangeMaxDeg * Math.PI / 180));
        rows.push({ id: base, line: T.lineAt(0.5), reveal: revealBand(lines[0].nominal, R), tops });
        if (tops.some((z, i) => i && Math.abs(z - tops[i - 1]) / (s[i] - s[i - 1]) > alongMax + 1e-9)) flags.push('slope along the row over the tracker limit');
      } else {
        const fit = fitTopLine(lines.flatMap(() => s), gl.flat(), revealBand(lines[0].nominal, R), alongMax);
        lines.forEach((L, i) => { const d = L.nominal - lines[0].nominal;
          rows.push({ id: base + i, line: T.lineAt(L.f), reveal: revealBand(L.nominal, R), top: [fit.a + d, fit.a + d + fit.b * T.length] }); });
        if (lines.length > 1) {
          const dd = (lines[1].f - lines[0].f) * T.depth, dz = T.eastWest ? 0 : lines[1].nominal - lines[0].nominal;
          // On ground smoothed over a 4 m cross (SMOOTH_M each way), so 1 m LiDAR texture does not read as twist.
          const sm = f => s.map(v => { const [x, y] = at(f, v); return (gs(x, y) + gs(x + SMOOTH_M, y) + gs(x - SMOOTH_M, y) + gs(x, y + SMOOTH_M) + gs(x, y - SMOOTH_M)) / 5; });
          twist = twistDeg(lsSlope(s, sm(lines[0].f)), lsSlope(s, sm(lines[1].f)), T.length, dd, dz);
          if (twist > R.twistTolDeg + 1e-9) flags.push('ground twist over tolerance');
        }
        // Lowest module edge over the ground at the posts' chainages: south the front edge, east-west both eaves.
        const k = R.railDepthM - T.rise * (T.eastWest ? R.pivot : lines[0].f);
        const clear = f => Math.min(...s.map(v => fit.a + fit.b * v + k - gq(...at(f, v))));
        if (Math.min(clear(0), T.eastWest ? clear(1) : Infinity) < R.lowEdgeClearM - 1e-9) flags.push('lowest module edge under clearance');
      }
      if (missing > m0) { flags.push('ground not measured under some posts'); unmeasured++; }
      meta.push({ T, lines, base, twist, flags });
    }
    const plans = new Map([...groups].map(([len, rows]) => [len, planPiles({ rows, groundAt: gs, system: tracker ? 'tracker' : 'fixed', tableLength: len, tableGap: 0,
      pileSpacing: sp, embedMin: R.embedM, embedToReveal: R.embedToReveal, gradingWidth: R.gradingWidthM, revealAdjust: R.revealAdjustM, twistTolDeg: Infinity, limits: { along } })]));
    for (const { T, lines, base, twist, flags } of meta) out.push(tableResult(T, lines, lines.map((_, i) => plans.get(T.length).rows[base + i]), twist, flags, R, tracker));
    yield { phase: 'piles', tables: out.length };
  }
  return { tables: out, unmeasured, rules: R, system: tracker ? 'tracker' : 'fixed' };
}

// Piles kept compact: STRIDE numbers each [e, n, ground, top, bottom (ground or finished, the lower), length, embedment,
// reveal before grading, finished reveal] and a flag byte (1 reveal high, 2 reveal low, 4 outside the head adjustment,
// 8 lengthened past the soil embedment by the lateral-load rule (embedToReveal), 16 stands more than revealWarnAboveM over its design height, 32 over the hard
// maximum revealFailM).
export const STRIDE = 9;
function tableResult(T, lines, lr, twist, extra, R, tracker) {
  const piles = lr.flatMap(r => r.tables[0]?.piles || []), tb = lr.map(r => r.tables[0]).filter(Boolean);
  const flags = new Set([...tb.flatMap(t => t.flags), ...extra]);
  if (tracker && tb.some(t => !t.feasible)) flags.add('tracker cannot follow without grading');
  // Module surface at the table ends from a line's top: top + rails + rise x (fraction up the face - the line's).
  const surf = (i, ff) => { const t = tb[i], k = R.railDepthM + T.rise * (ff - (T.eastWest ? R.pivot : lines[i].f));
    return t ? [t.topLevelStart + k, t.topLevelEnd + k] : [NaN, NaN]; };
  const last = lines.length - 1, tube = tb[0] ? [tb[0].topLevelStart + R.bearingDropM, tb[0].topLevelEnd + R.bearingDropM] : [NaN, NaN];
  const edges = tracker ? [tube, tube, tube] : T.eastWest ? [surf(0, 0), surf(0, 1).map((z, j) => (z + surf(1, 1)[j]) / 2), surf(1, 0)]
    : [surf(0, 0), surf(0, 0.5).map((z, j) => (z + surf(last, 0.5)[j]) / 2), surf(last, 1)];
  const pa = new Float64Array(piles.length * STRIDE), pf = new Uint8Array(piles.length);
  let cut = 0, fill = 0, depth = 0, maxCut = 0, maxFill = 0;
  piles.forEach((p, i) => {
    pa.set([p.x, p.y, p.ground, p.top, Math.min(p.ground, p.finishedGround), p.length, p.embed, p.reveal, p.finishedReveal], i * STRIDE);
    const hf = heightFlags(p.finishedReveal, p.reveal - p.adjust, R); // design height: the post's nominal reveal
    pf[i] = (p.flags.includes('reveal-high') ? 1 : 0) | (p.flags.includes('reveal-low') ? 2 : 0) | (p.outsideAdjust ? 4 : 0)
      | (p.embed > R.embedM + 1e-9 ? 8 : 0) | (hf.high ? 16 : 0) | (hf.overMax ? 32 : 0);
    depth = Math.max(depth, p.cut, p.fill); maxCut = Math.max(maxCut, p.cut); maxFill = Math.max(maxFill, p.fill);
  });
  for (const t of tb) { cut += t.cutM3; fill += t.fillM3; }
  const has = f => flags.has(f);
  return { T, flags: [...flags], twistDeg: twist, twisted: has('ground twist over tolerance'), cannotFollow: has('tracker cannot follow without grading'),
    lowEdge: has('lowest module edge under clearance'), unmeasured: has('ground not measured under some posts'), edges, pa, pf, n: piles.length,
    cutM3: cut, fillM3: fill, maxDepth: depth, grading: tb.some(t => !t.feasible), maxCut, maxFill };
}

/**
 * gradingSuggestions(tables, opts): the tables that need grading, as patches sorted by volume. A patch is a run of
 * neighbouring tables (same pile line, ends within mergeGapM) with the same action:
 *   'drop table'  the grading under it is deeper than dropOverM: leave the position empty;
 *   'raise table' lifting the table by its deepest cut leaves every other post at most the head adjustment above
 *                 the band (maxCut + maxFill <= revealAdjust): longer posts, no earthworks;
 *   'regrade'     cut and fill to the finished levels.
 */
export function gradingSuggestions(tables, { rules = PILE_RULES, key = t => t.T.key } = {}) {
  const G = rules.grading, out = [];
  const act = t => (t.maxDepth > G.dropOverM ? 'drop table'
    : t.maxCut + t.maxFill <= rules.revealAdjustM + 1e-9 ? 'raise table' : 'regrade');
  const flagged = tables.map((t, i) => ({ t, i })).filter(x => x.t.grading)
    .sort((a, b) => key(a.t)[0] - key(b.t)[0] || key(a.t)[1] - key(b.t)[1]);
  for (const { t, i } of flagged) {
    const a = act(t), k = key(t), p = out[out.length - 1];
    if (p && p.action === a && p.lane === k[0] && k[1] - p.end <= G.mergeGapM + 1e-9) {
      p.tables.push(i); p.cutM3 += t.cutM3; p.fillM3 += t.fillM3; p.maxDepth = Math.max(p.maxDepth, t.maxDepth); p.end = k[2];
      if (a === 'raise table') p.raiseM = Math.max(p.raiseM, t.maxCut);
    } else out.push({ action: a, tables: [i], cutM3: t.cutM3, fillM3: t.fillM3, maxDepth: t.maxDepth, lane: k[0], end: k[2],
      ...(a === 'raise table' ? { raiseM: t.maxCut } : {}) });
  }
  return out.map(({ lane, end, ...p }) => p).sort((a, b) => (b.cutM3 + b.fillM3) - (a.cutM3 + a.fillM3) || a.tables[0] - b.tables[0]);
}

/** Totals for readouts and the bill: counts, pile metres (embedment provisional), flags, suggestions. */
export function pileSummary(res, { mwp = 0, rules = res.rules || PILE_RULES } = {}) {
  const t = res.tables, sug = gradingSuggestions(t, { rules }), n = k => t.filter(x => x[k]).length;
  const acts = a => sug.filter(x => x.action === a).reduce((m, x) => m + x.tables.length, 0);
  const s = { system: res.system || 'fixed', tables: t.length, piles: t.reduce((m, x) => m + x.n, 0), totalPileLengthM: 0, embeddedM: 0,
    revealedM: 0, revealAdjust: 0, revealHigh: 0, revealLow: 0, embedBelowReveal: 0, twistTables: n('twisted'), cannotFollow: n('cannotFollow'),
    lowEdgeTables: n('lowEdge'), gradingTables: n('grading'), cutM3: 0, fillM3: 0, drop: acts('drop table'), raise: acts('raise table'),
    regrade: acts('regrade'), unmeasured: res.unmeasured, revealWarn: 0, revealFail: 0 };
  const tw = t.map(x => x.twistDeg).sort((a, b) => a - b);                // twist at table level
  s.twistP50Deg = tw.length ? tw[Math.floor((tw.length - 1) / 2)] : 0; s.twistMaxDeg = tw.length ? tw[tw.length - 1] : 0;
  const H = new Uint32Array(1501), HF = new Uint32Array(1501), bin = v => Math.max(0, Math.min(1500, Math.round((v + 5) * 100))); // 1 cm, -5..10 m
  for (const x of t) {
    for (let i = 0; i < x.n; i++) {
      const o = i * STRIDE, f = x.pf[i];
      s.totalPileLengthM += x.pa[o + 5]; s.embeddedM += x.pa[o + 6]; s.revealedM += x.pa[o + 8]; H[bin(x.pa[o + 7])]++; HF[bin(x.pa[o + 8])]++;
      if (f & 4) s.revealAdjust++;
      if (f & 8) s.embedBelowReveal++;
      if (f & 32) s.revealFail++; else if (f & 16) s.revealWarn++;
      if (f & 1) s.revealHigh++; else if (f & 2) s.revealLow++;
    }
    s.cutM3 += x.cutM3; s.fillM3 += x.fillM3;
  }
  const pct = h => [0, 50, 100].map(q => {                            // nearest rank, to the centimetre
    const want = Math.max(1, Math.ceil(q / 100 * s.piles)); let c = 0;
    for (let b = 0; b < h.length; b++) if ((c += h[b]) >= want) return b / 100 - 5;
    return NaN;
  });
  // revealP: the ground as found (before grading; may be negative where the ground stands above the post top);
  // finishedP: how far the posts stand out once graded, never below the band (user test H5).
  s.revealP = pct(H); s.finishedP = pct(HF);
  s.perMWp = mwp > 0 ? s.piles / mwp : null;
  s.proofTests = Math.ceil(s.piles * (rules.proofTestPct ?? 1) / 100); // production proof tests (L3), spread evenly
  s.suggestions = sug.slice(0, 20);
  s.label = PILES_LABEL;
  return s;
}

/** Bill of quantities items (boq.mjs 'piles'): count and total embedded length, provisional. */
export function pileBoqItems(id, s, pileType = 'plant') {
  if (!s || !s.piles) return [];
  return [{ id, kind: 'piles', pileType, results: { count: s.piles, totalEmbedmentM: s.embeddedM, totalPileLengthM: s.totalPileLengthM } }];
}

/** The tables of a plant layout (plant-layout.mjs result) as planTables inputs, in national-grid e, n. */
export function layoutTables(r) {
  const F = r.frame, T = r.table, P = r.params, t = r.tables, out = [];
  for (let q = 0; q < t.length; q += 6) {
    const ua = t[q], va = t[q + 1], L = r.tableLen?.[q / 6] ?? T.lenU;   // a half table closing a row end is shorter
    out.push({ length: L, depth: T.depth, rise: T.rise, lowEdgeM: P.lowEdgeM, eastWest: !T.south && !T.tracker, key: [va, ua, ua + L],
      lineAt: f => [F.en(ua, va + f * T.depth), F.en(ua + L, va + f * T.depth)] });
  }
  return out;
}

/** Piles for a laid-out plant, as a generator (sliced between frames); returns { tables, summary, posts, system }. */
export function* pilesForLayout(r, groundAt, { posts = 2, rules, soil, mwp = r.built?.mwp ?? 0 } = {}) {
  const system = r.table.tracker ? 'tracker' : 'fixed', R = withSoil({ ...rulesFor(system), ...(rules || {}) }, soil);
  const res = yield* planTables(layoutTables(r), { groundAt, system, posts, rules: R, along: r.frame.swap ? 'ns' : 'ew' });
  yield { phase: 'piles', tables: res.tables.length };                   // the summary in a slice of its own (PERF.md 3)
  return { ...res, posts: r.table.south ? posts : r.table.tracker ? 1 : 2, summary: pileSummary(res, { mwp, rules: R }) };
}
