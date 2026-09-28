// COPIED UNCHANGED from the v12 world (web/world/block-trenches.mjs) at v12 commit 3adcee9 (file last changed 9b1ffad). Modular star family: public #148126 stretches.
// Do not edit here: change the source and re-copy. Everything below this header is byte-identical to the source.
// block-trenches.mjs: the solar block's trenches, laid out from what each stretch of route really carries, then sized by
// rating (trench-plan.mjs). One source of truth: the readout, the typed words, the X-ray and the bill of quantities all
// read what this returns.
//
// Layout rules (fixes to our own generator, not design choices):
//   - DC: the home-run ducts of each inverter row run in the aisle in front of the tables, north edge a clear distance
//     short of the first pile line, never under a table. Each stretch carries only the ducts that really pass it
//     (counted from the drawn home runs), so the corridor is as wide as the busiest stretch needs, not the row's total.
//   - AC branch: its own lane south of the DC corridor. The two lanes are rated together (corridorCheck: each lane's heat
//     reaches the other) and moved apart until neither is worse than alone; if the aisle cannot hold both, that is a
//     design fault and it is said in red, not hidden.
//   - Collector: one spine west of the transformers, cut into stretches by the circuits that really pass each one, so the
//     two transformers' circuits where they share a stretch are one group, sized together, never two overlapping trenches.
//   - 33 kV: each ring trench at the ring's load; with one ring end out (N-1, the default) the whole ring from one end.
//     Joint bays where a circuit passes the drum length along its own route.
//   - HV connection: the section follows the connection voltage; nothing above 33 kV is rated here (no cable data).
// Loads: inverter AC at full kVA; DC string current 1.25 x Isc (Isc assumed); all labelled assumptions.
// Pure: no DOM.

import { tableShape, tableOrigin, dcHomeRoutes, STATION_DEFAULTS as SD } from './station.mjs';
import { planTrenches, planRows, sizeTrench, corridorCheck, PLAN_DEFAULTS } from './trench-plan.mjs';

export const BLOCK_DC_ISC_A = 18.5;   // module short-circuit current, assumed: one value for the block and the typed words
export const BLOCK_TRENCH = Object.freeze({
  pileClearM: 0.5,     // clear ground between a trench wall and the nearest pile line (design choice)
  minStretchM: 2,      // a stretch shorter than this carries the larger count of its neighbours
  maxSepM: 4,          // the most ground tried between the DC and AC lanes before the heat is called a fault
  ring: 'n-1'          // 33 kV rings rated with one end out (whole ring from one end) or 'normal' (the larger half)
});
const sum = a => a.reduce((t, x) => t + x, 0);
const f2 = x => x.toFixed(2);

/** Stretches of a line from intervals [[a, b]...]: [{ a, b, n }] with n the intervals that cover it; short pieces merged. */
export function stretches(iv, minM = BLOCK_TRENCH.minStretchM) {
  const bp = [...new Set(iv.flatMap(([a, b]) => [a, b]))].sort((p, q) => p - q);
  const segs = bp.slice(1).map((b, i) => { const a = bp[i], m = (a + b) / 2; return { a, b, n: iv.filter(([p, q]) => p <= m && q >= m).length }; })
    .filter(s => s.b - s.a > 1e-6);
  for (let k = 0; k < segs.length;) {
    const s = segs[k];
    if (s.b - s.a >= minM || segs.length < 2) { k++; continue; }
    const nb = [segs[k - 1], segs[k + 1]].filter(q => q && (q.n > 0 || !s.n)), into = nb.sort((p, q) => q.n - p.n)[0];
    if (!into) { k++; continue; }
    into.n = Math.max(into.n, s.n); into.a = Math.min(into.a, s.a); into.b = Math.max(into.b, s.b);
    segs.splice(k, 1); k = Math.max(0, k - 1);
  }
  const out = [];
  for (const s of segs) { const p = out.at(-1); if (p && p.n === s.n && Math.abs(p.b - s.a) < 1e-6) p.b = s.b; else out.push({ ...s }); }
  return out.filter(s => s.n > 0);
}

/** The HV connection's section by voltage: an outline for the X-ray, never rated here (no cable data held). */
export function hvSection(kv) {
  const big = kv > 132, duct = kv > 132 ? 250 : 160, cableOdMm = kv >= 400 ? 145 : kv > 132 ? 125 : 105;
  return { cableOdMm, rated: false, section: {
    id: `hv-connection-${kv}kv`, voltage_class: big ? `${kv} kV connection: to the transmission owner's design` : `${kv} kV connection, fully ducted`,
    formation: big ? 'three ducts flat, spaced' : 'trefoil of three ducts', circuits: 1, cover_to_top_m: big ? 1.0 : 0.91,
    trench_width_m: big ? 1.4 : 0.8, trench_depth_m: big ? 1.6 : 1.4, duct_od_mm: duct, phase_spacing_mm: big ? 450 : duct,
    bedding: { thickness_mm: 100 }, marker: { type: 'protection tile layer', depth_m: big ? 0.85 : 0.8 },
    status: `UNRATED: outline only, duct ${duct} mm OD and cable about ${cableOdMm} mm OD assumed for ${kv} kV; no rating run` } };
}

/**
 * blockTrenches(st, mv, E, N, odMv, env, s) -> { items, plan: { pits, joints, summary, rows, env, totals, faults, notes } }
 * st: station(...); mv: mvChain(...); E, N: the anchor; odMv(area) the 33 kV cable OD; env: the typed sizing inputs
 * { soilKmW, load, split: { dc, branch, collector, mv }, cover: { dc, lv, mv }, drumM, ring }; s: the station geometry the
 * block was built with (modules in series change the table length), STATION_DEFAULTS when left out.
 */
export function blockTrenches(st, mv, E, N, odMv, env = {}, s = SD) {
  const T = tableShape(s), pitch = T.span + s.aisleGap, clear = BLOCK_TRENCH.pileClearM, e = { ...PLAN_DEFAULTS, ...env };
  const envFor = g => ({ ...env, split: typeof e.split === 'number' ? e.split : e.split?.[g] ?? 0 });
  const runs = [], faults = [], notes = [];
  const dc = { loadA: 1.25 * BLOCK_DC_ISC_A, ductOdMm: s.ductDiameter * 1000, perDuct: 12, areaMm2: 6, odMm: 6 };
  const ac = { loadA: s.inverterKVA * 1000 / (Math.sqrt(3) * s.acVolts), areaMm2: s.acAreaMm2, odMm: s.acDiameter * 1000 };
  const tx = s.transformers, cx = tx[0][0] - s.collectorOffset;

  // ---- DC: each duct's stretch along its row (from the drawn home runs), counted per stretch ----
  const rows = new Map();
  const ductIv = new Map();
  for (const c of dcHomeRoutes(st.strings, st.inverters.map(i => i.point), s)) {
    const y = st.inverters[c.inverter].point[1], xs = c.points.filter(q => Math.abs(q[1] - y) < 1e-6 && q[2] < 0).map(q => q[0]);
    const k = `${c.inverter}:${c.duct}`, d = ductIv.get(k) || { y, lo: Infinity, hi: -Infinity };
    d.lo = Math.min(d.lo, ...xs); d.hi = Math.max(d.hi, ...xs); ductIv.set(k, d);
  }
  for (const i of st.inverters) {
    const y = i.point[1], r = rows.get(y) || { y, row: Math.round((y + 1) / pitch), xs: [], ducts: [], inverters: [] };
    r.xs.push(i.point[0]); r.inverters.push(i); rows.set(y, r);
  }
  for (const d of ductIv.values()) rows.get(d.y).ducts.push([d.lo, d.hi]);
  const laneY = new Map();
  for (const R of rows.values()) {
    const ty = tableOrigin(R.row * 4, s)[1], bottom = R.row > 0 ? ty - s.aisleGap + clear : -Infinity, top = ty - clear;
    const dcS = stretches(R.ducts).map(q => ({ ...q, z: sizeTrench('dc', q.n, dc, envFor('dc')) }));
    const dcMax = Math.max(...dcS.map(q => q.z.corridorM)), dcBig = dcS.reduce((a, q) => (q.n > a.n ? q : a));
    for (const q of dcS) {
      const yc = top - q.z.corridorM / 2, takeOffs = R.xs.filter(x => x >= q.a - 1e-6 && x <= q.b + 1e-6).map(x => [x, yc]);
      runs.push({ stage: 'dc', kind: 'dc', group: 'dc', n: q.n, spec: dc, path: [[q.a, yc], [q.b, yc]], drawnPitchM: s.ductSpacing, takeOffs });
    }
    // AC branch lane: its own trench south of the DC corridor, moved apart until the two heat each other no worse than alone.
    const acS = stretches(R.xs.map(x => [x, cx])).map(q => ({ ...q, z: sizeTrench('lv', q.n, ac, envFor('branch')) }));
    const acMax = Math.max(...acS.map(q => q.z.corridorM)), acBig = acS.reduce((a, q) => (q.n > a.n ? q : a));
    const alone = Math.max(1, dcBig.z.utilisation, acBig.z.utilisation);
    let sep = e.betweenM, chk;
    for (;;) {
      chk = corridorCheck([{ kind: 'dc', n: dcBig.n, spec: dc, sized: dcBig.z, sepM: sep }, { kind: 'lv', n: acBig.n, spec: ac, sized: acBig.z }], env);
      if (chk.utilisation <= alone + 0.005 || sep >= BLOCK_TRENCH.maxSepM) break;
      sep += 0.5;
    }
    const acTop = top - dcMax - sep, acBottom = acTop - acMax;
    for (const q of acS) runs.push({ stage: 'ac', kind: 'lv', group: 'branch', n: q.n, spec: ac, path: [[q.a, acTop - q.z.corridorM / 2], [q.b, acTop - q.z.corridorM / 2]] });
    laneY.set(R.y, acTop - acMax / 2);
    R.check = { sep, util: chk.utilisation, dcMax, acMax };
    if (chk.utilisation > alone + 0.005) faults.push(`Row ${R.row + 1}: the DC and AC lanes heat each other to ${Math.round(chk.utilisation * 100)} % of rating even `
      + `${f2(sep)} m apart. Owner's choice: fewer strings a duct, larger DC cable, or the AC branch in another aisle.`);
    if (acBottom < bottom - 1e-6) faults.push(`Row ${R.row + 1}: the DC corridor (${f2(dcMax)} m) and the AC lane (${f2(acMax)} m, ${f2(sep)} m apart) need `
      + `${f2(top - acBottom + clear)} m; the aisle is ${f2(s.aisleGap)} m, so the AC lane reaches under the tables of row ${R.row}. `
      + 'Owner\'s choice: DC corridor (10 mm² home runs, fewer strings a duct, combiners) or a wider aisle.');
  }
  const seps = [...rows.values()].map(R => R.check);
  notes.push(`Aisles: DC corridor up to ${f2(Math.max(...seps.map(c => c.dcMax)))} m, ${f2(clear)} m clear of the first pile line; AC lane `
    + `${f2(Math.max(...seps.map(c => c.sep)))} m south of it, the two rated together (worst ${Math.round(Math.max(...seps.map(c => c.util)) * 100)} %).`);

  // ---- LV collector: one spine at cx, stretches by the circuits that pass; then a tail into each transformer ----
  const spineIv = st.inverters.map(i => { const a = laneY.get(i.point[1]), b = tx[i.transformer - 1][1]; return [Math.min(a, b), Math.max(a, b)]; });
  for (const q of stretches(spineIv)) runs.push({ stage: 'ac', kind: 'lv', group: 'collector', n: q.n, spec: ac, path: [[cx, q.a], [cx, q.b]], drawnPitchM: 0.25 });
  tx.forEach((t, k) => {
    const n = st.inverters.filter(i => i.transformer === k + 1).length;
    if (n) runs.push({ stage: 'ac', kind: 'lv', group: 'collector', n, spec: ac, path: [[cx, t[1]], [t[0], t[1]]], drawnPitchM: 0.25 });
  });

  // ---- 33 kV: ring trenches at the ring's load (N-1 by default), joint bays along each circuit's own route ----
  const mvaOf = id => mv.stations.find(x => x.id === id)?.mva || 0, amps = m => m * 1e6 / (Math.sqrt(3) * 33000);
  // A radial feeder always carries its whole chain; only a ring splits at its open point in normal running.
  const whole = r => sum(r.stations.map(mvaOf)), ring = e.ring ?? BLOCK_TRENCH.ring;
  const half = r => { if (r.topology !== 'ring' || !(r.open >= 0)) return whole(r); const m = r.stations.map(mvaOf); return Math.max(sum(m.slice(0, r.open)), sum(m.slice(r.open))); };
  const normalA = amps(Math.max(...mv.rings.map(half))), n1A = amps(Math.max(...mv.rings.map(whole))), ringA = ring === 'normal' ? normalA : n1A;
  const od = odMv(mv.rings[0].areaMm2);
  const mvSpec = { loadA: ringA, areaMm2: mv.rings[0].areaMm2, odMm: od };
  for (const tr of mv.trenches) runs.push({ stage: 'mv', kind: 'mv', group: 'mv', n: tr.circuits, spec: mvSpec, path: tr.plan });
  notes.push(ring === 'normal'
    ? `33 kV rings sized for normal running, ${Math.round(normalA)} A a circuit; with one ring end out the ring needs ${Math.round(n1A)} A `
      + '(not rated: curtail during an outage). Type trench ring n-1 to rate it.'
    : `33 kV rings sized with one ring end out (N-1): ${Math.round(n1A)} A a circuit, every circuit in a trench at that load (conservative); `
      + `normal running ${Math.round(normalA)} A. Type trench ring normal to size for normal running.`);

  const plan = planTrenches(runs, env, { hops: mv.circuits.map(c => ({ stage: 'mv', path: c.plan })) }), P = ([x, y]) => ({ e: E + x, n: N + y });
  const items = plan.items.map(t => ({ stage: t.stage, group: t.group, n: t.n, spec: t.spec, path: t.path.map(P), section: t.section, cableOdMm: t.kind === 'mv' ? od : t.cableOdMm,
    sizing: { name: t.sizing.name, utilisation: t.sizing.utilisation, tight: t.sizing.tight, trench: t.trench, of: t.of, drawn: t.drawn }, ducted: t.ducted }));
  // HV connection: fully ducted, from each grid transformer to the connection structure; outline only, never rated here.
  const hv = hvSection(mv.poc.kv);
  for (const g of mv.grid.at) items.push({ stage: 'mv', group: 'hv', path: [P([g[0], g[1]]), P(mv.poc.at)], section: hv.section, cableOdMm: hv.cableOdMm, ducted: true,
    sizing: { name: 'outline', utilisation: null, unrated: true } });
  const hvM = sum(mv.grid.at.map(g => Math.hypot(mv.poc.at[0] - g[0], mv.poc.at[1] - g[1])));
  const unrated = [`HV connection ${mv.poc.kv} kV: no cable data held, so no rating; ${hv.section.status.replace(/^UNRATED: /, '')}.`];
  for (const [stage, x] of Object.entries(plan.summary)) if (x.notOk) faults.push(`${stage.toUpperCase()}: ${x.notOk} run${x.notOk > 1 ? 's' : ''} over rating at the widest arrangement tried.`);
  const totals = { ...plan.totals, trenches: items.length, dugM: plan.totals.dugM + hvM, routeM: plan.totals.routeM + hvM };
  const toEn = w => ({ ...w, at: P(w.at) });
  return { items, plan: { pits: plan.pits.map(toEn), joints: plan.joints.map(toEn), summary: plan.summary, env: plan.env, totals, faults, unrated, notes,
    rows: planRows(plan, { faults, unrated, notes, totals }), aisles: [...rows.values()].map(R => ({ row: R.row + 1, ...R.check })) } };
}
