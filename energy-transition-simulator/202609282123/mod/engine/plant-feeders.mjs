// COPIED UNCHANGED from the v12 world (web/world/plant-feeders.mjs) at v12 commit 3adcee9 (file last changed 604729d). Modular star family: public #146457 roadPath.
// Do not edit here: change the source and re-copy. Everything below this header is byte-identical to the source.
// plant-feeders.mjs: the 33 kV feeders of a laid-out plant, routed along its roads, with their trenches and cables.
//
// Each feeder of the plant template runs from its board in the substation compound along the access road, the
// spine and the branch tracks to its first station, then station to station. Routes stay on the road network
// (a comb: one spine, tracks off it), so every route is a set of intervals on a few straight lines. Where several
// circuits share a stretch they share a trench: one circuit in a single trefoil trench, two in a two-circuit
// trench, more in parallel trenches. Where a circuit turns across a road it goes in ducts.
// Cable lengths: route plus 3 % for snaking and 5 m at each end for terminations, three single cores a circuit.
// Voltage drop is worked out on the routed lengths (cable-rating.mjs), replacing the template's placeholder lengths;
// where it passes the limit, the segment that saves most drop per step is upsized, as the template does.
// Trench section ids are those of data/trench-sections.json: farmland cover (0.91 m) for the runs, ducts at crossings.
// The busiest hop's cable is checked by rating (trench-plan.mjs) alone and two circuits side by side as the section
// draws them. Pure: imports only the rating cartridges.

import { dropPercent, SIZES, build } from './cable-rating.mjs';
import { checkAsDrawn } from './trench-plan.mjs';

export const SECTION_FOR = Object.freeze({ one: '33kv-1-agri', two: '33kv-2-agri', crossing: '33kv-1-ducted' });
export const CABLE_ALLOW = Object.freeze({ slack: 0.03, tailM: 5, cores: 3 });

// A point on the road network: on a track (k, u), on the access road (u), or on the spine (v).
function toSpine(pt, net) {
  if (pt.line === 'track') return { parts: [{ key: 't' + pt.k, a: pt.u, b: net.us }], v: net.tracks[pt.k] };
  if (pt.line === 'access') return { parts: [{ key: 'a', a: pt.u, b: net.us }], v: net.cv };
  return { parts: [], v: pt.v };
}

/** Intervals from A to B along the roads, and how many times the route turns across a road. */
export function roadPath(A, B, net) {
  const side = pt => Math.sign(pt.u - net.us);
  if (A.line === 'track' && B.line === 'track' && A.k === B.k && side(A) === side(B)) return { parts: [{ key: 't' + A.k, a: A.u, b: B.u }], turns: 0 };
  const a = toSpine(A, net), b = toSpine(B, net);
  const parts = [...a.parts, ...(a.v !== b.v ? [{ key: 's', a: a.v, b: b.v }] : []), ...b.parts];
  return { parts: parts.filter(q => q.a !== q.b), turns: (a.parts.length ? 1 : 0) + (b.parts.length ? 1 : 0) };
}

/** Sweep a line's intervals into stretches with a constant circuit count: [{ a, b, c }]. */
export function coverage(intervals) {
  const ev = [];
  for (const { a, b } of intervals) { ev.push([Math.min(a, b), 1], [Math.max(a, b), -1]); }
  ev.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  const out = [];
  let c = 0, last = null;
  for (const [x, d] of ev) {
    if (c > 0 && last !== null && x > last) {
      const prev = out[out.length - 1];
      if (prev && prev.c === c && Math.abs(prev.b - last) < 1e-9) prev.b = x; else out.push({ a: last, b: x, c });
    }
    c += d; last = x;
  }
  return out;
}

/** Trench metres by section for a stretch of length L carrying c circuits. */
export function trenchFor(c, L, into) {
  const two = Math.floor(c / 2), one = c % 2;
  if (two) into[SECTION_FOR.two] = (into[SECTION_FOR.two] || 0) + two * L;
  if (one) into[SECTION_FOR.one] = (into[SECTION_FOR.one] || 0) + L;
  return into;
}

/**
 * routeFeeders(template, net, p) -> { feeders, pieces, trenchByType, trenchM, cableBySize, cableM, worstDropPct, crossings }
 * net: { us, cv, spine, access, tracks, stations: [{ id, u, v, k, track }] } in the layout frame.
 */
export function routeFeeders(tpl, net, p) {
  const at = new Map(net.stations.map(s => [s.id, s]));
  const board = net.access ? { line: 'access', u: net.access.u0 } : { line: 'spine', v: net.cv };
  const onRoad = s => ({ line: 'track', k: s.k, u: s.u });
  const byKey = new Map(), stubs = new Map();
  const add = (key, a, b) => { if (!byKey.has(key)) byKey.set(key, []); byKey.get(key).push({ a, b }); };
  const opts = { pf: tpl.params.powerFactor, soilKmW: tpl.params.soilKmW, kv: 33 };
  const cableBySize = {}, trenchByType = {};
  let crossings = 0, cableM = 0, worst = 0, upsized = 0;
  const dropOf = hops => hops.reduce((t, h) => t + dropPercent(h.areaMm2, h.lengthM, h.loadMVA, opts), 0);
  const feeders = tpl.feeders.map((f, fi) => {
    let from = board, fromStub = 0, fromId = null;
    const hops = f.chain.map((st, k) => {
      const s = at.get(st.id), to = onRoad(s), path = roadPath(from, to, net), stub = Math.abs(s.v - s.track);
      for (const q of path.parts) add(q.key, q.a, q.b);
      stubs.set(s.id, (stubs.get(s.id) || 0) + 1);
      if (fromId) stubs.set(fromId, stubs.get(fromId) + 1);
      crossings += path.turns;
      const road = path.parts.reduce((t, q) => t + Math.abs(q.b - q.a), 0), seg = f.segments[k];
      const hop = { from: fromId || f.board, to: s.id, areaMm2: seg.area, loadMVA: seg.loadMVA, lengthM: road + stub + fromStub, parts: path.parts };
      from = to; fromStub = stub; fromId = s.id;
      return hop;
    });
    for (let guard = 0; dropOf(hops) > tpl.params.vdropLimitPct && guard < 60; guard++) {
      const can = hops.filter(h => h.areaMm2 < SIZES.at(-1)).sort((a, b) => b.loadMVA * b.lengthM - a.loadMVA * a.lengthM)[0];
      if (!can) break;
      can.areaMm2 = SIZES[SIZES.indexOf(can.areaMm2) + 1]; upsized++;
    }
    for (const h of hops) {
      const cable = CABLE_ALLOW.cores * (h.lengthM * (1 + CABLE_ALLOW.slack) + 2 * CABLE_ALLOW.tailM);
      cableBySize[h.areaMm2] = (cableBySize[h.areaMm2] || 0) + cable; cableM += cable;
    }
    const drop = dropOf(hops);
    worst = Math.max(worst, drop);
    return { id: `F${fi + 1}`, board: f.board, hops, dropPct: drop, stations: f.chain.map(s => s.id) };
  });

  // Shared stretches: one trench per stretch, sized by the circuits in it.
  const pieces = [];
  let trenchM = 0;
  for (const [key, list] of byKey) for (const { a, b, c } of coverage(list)) {
    pieces.push({ key, a, b, c }); trenchFor(c, b - a, trenchByType); trenchM += b - a;
  }
  for (const [id, c] of stubs) {
    const s = at.get(id), L = Math.abs(s.v - s.track);
    if (L > 0) { pieces.push({ key: 'stub:' + id, a: s.track, b: s.v, c, u: s.u }); trenchFor(c, L, trenchByType); trenchM += L; }
  }
  const crossM = crossings * (p.spineWidthM + 2);
  if (crossM) { trenchByType[SECTION_FOR.crossing] = (trenchByType[SECTION_FOR.crossing] || 0) + crossM; trenchM += crossM; }
  // Rating of the shared trenches: the busiest hop's cable alone, and two such circuits at 450 mm centres.
  const busy = feeders.flatMap(f => f.hops).sort((a, b) => b.loadMVA - a.loadMVA)[0];
  let trenchRating = null;
  if (busy) {
    const spec = { loadA: busy.loadMVA * 1e6 / (Math.sqrt(3) * 33000), areaMm2: busy.areaMm2, odMm: build(busy.areaMm2).od };
    const env = { soilKmW: tpl.params.soilKmW || 1.2 }, one = checkAsDrawn('mv', 1, spec, 0.45, env), two = checkAsDrawn('mv', 2, spec, 0.45, env);
    trenchRating = { hop: `${busy.from} to ${busy.to}`, loadA: Math.round(spec.loadA), areaMm2: busy.areaMm2, one: one.utilisation, two: two.utilisation,
      ok: two.utilisation <= 1, basis: 'IEC 60287 method (own code), 0.91 m cover; indicative' };
  }
  return { feeders, pieces, trenchByType, trenchM, cableBySize, cableM, worstDropPct: worst, crossings, upsized, trenchRating,
    dropOk: worst <= tpl.params.vdropLimitPct + 1e-9 };
}

// Readout rows for the MV trenches and cables that add up, in words (user test H3). Each trench is counted: where more
// than two circuits share a stretch the trenches run side by side, so trench-km can exceed the route. Cable is single
// core (three per circuit, with slack and tails); circuit-km is a third of it.
export const SECTION_WORDS = Object.freeze({ [SECTION_FOR.one]: 'one 33 kV circuit, farmland (0.91 m cover)',
  [SECTION_FOR.two]: 'two 33 kV circuits', [SECTION_FOR.crossing]: 'road crossings, ducted' });
export function trenchRows(e, fmt = v => v.toFixed(2)) {
  const k = m => fmt(m / 1000), types = Object.entries(e.trenchByType || {}).filter(([, m]) => m > 0), total = types.reduce((t, [, m]) => t + m, 0);
  const rows = [['MV trenches', `${k(total)} trench-km, along ${k(e.trenchM)} km of route`]];
  for (const [id, m] of types) rows.push(['', `${SECTION_WORDS[id] || 'other trench'}: ${k(m)} trench-km`]);
  rows.push(['MV cable', `${k(e.cableM / CABLE_ALLOW.cores)} circuit-km (${k(e.cableM)} km of single-core cable)`]);
  for (const [a, m] of Object.entries(e.cableBySize || {}).sort((x, y) => x[0] - y[0])) rows.push(['', `${a} mm² aluminium: ${k(m / CABLE_ALLOW.cores)} circuit-km`]);
  return { rows, trenchKm: total / 1000 };
}
