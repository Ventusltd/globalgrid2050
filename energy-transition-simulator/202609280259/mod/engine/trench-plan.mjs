// COPIED UNCHANGED from world/v12 trench-plan.mjs at v12 commit 3adcee9 (file last changed a36f410). Modular star family: public #148717 sizeTrench.
// Do not edit here: change the source and re-copy. Everything below this header is byte-identical to the source.
// trench-plan.mjs: trenches sized by the rating of the cables in them, for the solar block and the plant feeders.
//
// Given what a trench carries (DC string ducts, LV AC inverter trefoils or 33 kV trefoils: how many, what cable, what
// load), sizeTrench() asks trench-design.mjs for the arrangements that keep every conductor within its temperature
// (one trench, two layers, several trenches side by side) and picks one: the typed split, or else the least dig that
// one bucket pass can open, or else the least dig. planTrenches() applies that to a set of trench runs: it widens or
// splits each run, puts draw pits at every turn of a ducted run and where the pulling tension would pass its limit,
// joint bays at drum lengths, and sums the metres, volumes, pits and bays for the readout and the bill of quantities.
//
// Method: the IEC 60287 thermal method (own code, trench-design.mjs; cable-iec.mjs for the daily solar cycle).
// Standards are cited by number only; no values from any standard. Loads and cable builds are labelled assumptions.
// Pure: no DOM.

import { designOptions, solveGap, section as sectionOf, pullPlan, place, temperatures, PULL, COVER } from './trench-design.mjs';
import { solarDayProfile, lossLoadFactor } from './cable-iec.mjs';

/** Loss-load factor by load profile: continuous (the default, conservative) or a clear solar day, unclipped. */
export const LOADS = Object.freeze({ continuous: 1, 'solar-day': lossLoadFactor(solarDayProfile()) });

export const PLAN_DEFAULTS = Object.freeze({
  soilKmW: 1.2,            // native ground, moist (generic rule; measure on site)
  load: 'continuous',      // or 'solar-day'
  split: 0,                // 0: choose; n: n trenches side by side; or per kind { dc, branch, collector, mv } (the block)
  cover: Object.freeze({ dc: 0.6, lv: 0.91, mv: 0.91 }),   // m to the top of the uppermost duct or cable, by kind; editable
  betweenM: 1.0,           // undisturbed ground between parallel trenches
  drumM: 800,              // cable on one drum: a joint bay each time a circuit passes this length (input)
  tight: 0.95              // a chosen trench at or over this share of its rating is shown as tight
});
/** Why each kind's default cover is what it is (shown beside the number; typed: trench cover dc 0.91). */
export const COVER_WHY = Object.freeze({
  dc: 'inside the fenced array, not cultivated: a design choice to agree (0.91 m if grazed or ploughed later)',
  lv: 'farmland, typical UK practice', mv: 'farmland, typical UK practice' });
const splitOf = (split, group) => (typeof split === 'number' ? split : split?.[group] ?? 0);
const coverOf = (e, kind) => (typeof e.cover === 'number' ? e.cover : e.cover?.[kind] ?? PLAN_DEFAULTS.cover[kind]);

// One circuit of each kind, in trench-design.mjs form. Builds and loads are assumptions, each overridable.
export const CIRCUIT = Object.freeze({
  lv: (i, s) => ({ id: `ac${i + 1}`, cls: 'lv', formation: 'trefoil', loadA: s.loadA,
    cable: { material: s.material ?? 'al', areaMm2: s.areaMm2 ?? 400, odMm: s.odMm ?? 37.4, kind: 'ac' } }),
  mv: (i, s) => ({ id: `mv${i + 1}`, cls: 'mv', formation: 'trefoil', loadA: s.loadA,
    cable: { material: s.material ?? 'al', areaMm2: s.areaMm2 ?? 300, odMm: s.odMm ?? 45, kind: 'ac', screenMm2: 35, u0Kv: 19 } }),
  dc: (i, s) => ({ id: `d${i + 1}`, cls: 'dc', formation: 'duct-bundle', loadA: s.loadA, ductOdMm: s.ductOdMm ?? 90, perDuct: s.perDuct ?? 12,
    cable: { material: 'cu', areaMm2: s.areaMm2 ?? 6, odMm: s.odMm ?? 6, kind: 'dc', flexible: true, insulationMm: 0.7, sheathMm: 0.8 } })
});
const LABEL = { lv: 'LV AC, single-core Al trefoils', mv: '33 kV AC, single-core Al trefoils', dc: 'DC string cables in ducts' };

const memo = new Map();
const r2 = x => Math.round(x * 100) / 100;

/**
 * sizeTrench(kind, n, spec, env) -> { kind, n, trenches, layers, widthM, depthM, corridorM, cover, gapM, ok, utilisation,
 *   hottestC, perMetre, section, options, basis }
 * kind 'lv' | 'mv' | 'dc'; n circuits (DC: ducts); spec { loadA, areaMm2, odMm, ductOdMm, perDuct }.
 */
export function sizeTrench(kind, n, spec, env = {}) {
  const e = { ...PLAN_DEFAULTS, ...env }, key = JSON.stringify([kind, n, spec, e]), split = splitOf(e.split, kind);
  if (memo.has(key)) return memo.get(key);
  const circuits = Array.from({ length: n }, (_, i) => CIRCUIT[kind](i, spec));
  const tenv = { soilKmW: e.soilKmW, mu: LOADS[e.load] ?? 1, betweenTrenchesM: e.betweenM };
  const d = designOptions({ circuits, coverM: coverOf(e, kind), env: tenv, maxTrenches: Math.min(n, Math.max(6, split)) });
  // Chosen: one layer (two only as an option shown), the least dig one bucket pass can open, else the least dig.
  const ok = d.options.filter(o => o.ok && !o.conductor && o.layers === 1);
  const pool = ok.filter(o => o.fitsOneBucket).length ? ok.filter(o => o.fitsOneBucket) : ok;
  let pick = pool.sort((a, b) => a.perMetre.dugBank - b.perMetre.dugBank || a.trenches - b.trenches)[0]
    || d.options.filter(o => !o.conductor && o.layers === 1).sort((a, b) => b.ratingFactor - a.ratingFactor)[0];
  // A typed split applies to the kind it names (planTrenches passes each run its own), never beyond one circuit a trench.
  if (split > 0 && Math.min(n, split) !== pick.trenches) {
    const want = Math.min(n, split);
    pick = d.options.find(o => o.trenches === want && o.layers === 1 && !o.conductor) || optionFor(circuits, want, d.cover, tenv);
  }
  const t0 = pick.sections[0], od = (kind === 'dc' ? spec.ductOdMm ?? 90 : spec.odMm ?? (kind === 'mv' ? 45 : 37.4)) / 1000;
  const foot = kind === 'dc' ? od : 2 * od, mv = kind === 'mv';
  const section = {
    id: `${kind}-sized-${n}`, voltage_class: LABEL[kind], status: 'sized by rating (IEC 60287 method, own code)',
    formation: kind === 'dc' ? 'ducts side by side, one layer' : 'trefoil, direct buried', circuits: t0.circuits,
    cover_to_top_m: t0.coverToTop, trench_width_m: r2(t0.width), trench_depth_m: Math.round(t0.depth * 1000) / 1000,
    phase_spacing_mm: Math.round(od * 1000), circuit_spacing_mm: Math.round((foot + pick.gapM) * 1000),
    bedding: { material: 'sand or stone-free soil', thickness_mm: 75 },
    marker: mv ? { type: 'protection tile over the cables', depth_m: t0.surroundTop } : { type: 'warning tape', depth_m: t0.markers.at(-1).depth },
    ...(kind === 'dc' ? { duct_od_mm: Math.round(od * 1000) } : {})
  };
  const out = {
    kind, n, trenches: pick.trenches, layers: pick.layers, widthM: pick.widestM, depthM: pick.deepestM, corridorM: pick.corridorM,
    cover: d.cover, coverWhy: COVER_WHY[kind], gapM: pick.gapM, ok: pick.ok, utilisation: pick.ratingFactor > 0 ? r2(1 / pick.ratingFactor) : Infinity,
    tight: pick.ok && pick.ratingFactor > 0 && 1 / pick.ratingFactor >= e.tight,
    hottestC: pick.hottestC, perMetre: pick.perMetre, section, name: pick.name, load: e.load, soilKmW: e.soilKmW,
    options: d.options.map(o => ({ name: o.name, ok: o.ok, trenches: o.trenches, layers: o.layers, widestM: o.widestM, corridorM: o.corridorM,
      dugM3PerM: o.perMetre.dugBank, utilisation: o.ratingFactor > 0 ? r2(1 / o.ratingFactor) : Infinity, conductor: o.conductor || null })),
    basis: `cover ${d.cover} m (${COVER_WHY[kind]}); ${COVER.basis}; soil ${e.soilKmW} K.m/W, ${e.load} load`
  };
  memo.set(key, out);
  if (memo.size > 400) memo.delete(memo.keys().next().value);
  return out;
}

// An arrangement designOptions did not try (a typed split beyond its list): solved and sized the same way.
function optionFor(circuits, trenches, cover, tenv) {
  const s = solveGap(circuits, { cover, trenches, layers: 1 }, tenv), sec = sectionOf(s, circuits, tenv);
  const per = {};
  for (const t of sec) for (const [k, v] of Object.entries(t.perMetre)) per[k] = (per[k] || 0) + v;
  return { name: `${trenches} trenches side by side`, ok: s.ok, trenches, layers: 1, gapM: s.gapM, sections: sec, perMetre: per,
    widestM: Math.max(...sec.map(t => t.width)), deepestM: Math.max(...sec.map(t => t.depth)), corridorM: r2(s.layout.corridor),
    hottestC: Math.round(s.thermal.hottest.temp * 10) / 10, ratingFactor: s.thermal.factor };
}

/** The drawn trench checked as it stands: n circuits at the drawn centre pitch. -> { utilisation, hottestC } */
export function checkAsDrawn(kind, n, spec, pitchM, env = {}) {
  const e = { ...PLAN_DEFAULTS, ...env }, sized = sizeTrench(kind, n, spec, env);
  const circuits = Array.from({ length: n }, (_, i) => CIRCUIT[kind](i, spec));
  const foot = (kind === 'dc' ? spec.ductOdMm ?? 90 : 2 * (spec.odMm ?? 37.4)) / 1000;
  const s = solveGap(circuits, { cover: sized.cover, trenches: 1, layers: 1, minGapM: Math.max(0, pitchM - foot) },
    { soilKmW: e.soilKmW, mu: LOADS[e.load] ?? 1 }, { maxGapM: Math.max(0, pitchM - foot) + 1e-6 });
  return { utilisation: r2(1 / s.thermal.factor), hottestC: Math.round(s.thermal.hottest.temp), pitchM, ratingA: spec.loadA * s.thermal.factor };
}

/**
 * corridorCheck(parts, env) -> { utilisation, hottestC, parts: [utilisation] }: sized trenches laid side by side in one
 * corridor, rated as one thermal problem so each part's heat reaches the others (what separate sizings leave out).
 * parts: [{ kind, n, spec, sized (sizeTrench), sepM (undisturbed ground before the next part) }].
 */
export function corridorCheck(parts, env = {}) {
  const e = { ...PLAN_DEFAULTS, ...env }, circuits = [], gaps = [], betweens = [], covers = [];
  let t0 = 0;
  parts.forEach((p, pi) => {
    const z = p.sized;
    for (let i = 0; i < p.n; i++) circuits.push({ ...CIRCUIT[p.kind](i, p.spec), id: `${pi}:${i}`, trench: t0 + (i % z.trenches) });
    for (let k = 0; k < z.trenches; k++) { gaps.push(z.gapM); covers.push(z.cover); betweens.push(k < z.trenches - 1 ? e.betweenM : p.sepM ?? e.betweenM); }
    t0 += z.trenches;
  });
  const layout = place(circuits, { cover: covers[0], covers, gaps, betweens, trenches: t0, layers: 1 });
  const th = temperatures(layout, { soilKmW: e.soilKmW, mu: LOADS[e.load] ?? 1 });
  const worst = pi => Math.max(...th.perCircuit.filter(c => c.id.startsWith(`${pi}:`)).map(c => 1 / c.factor));
  return { utilisation: r2(1 / th.factor), hottestC: Math.round(th.hottest.temp), parts: parts.map((_, pi) => r2(worst(pi))), corridorM: r2(layout.corridor) };
}

/** A plan polyline [[x, y]...] moved sideways by d metres (left of travel positive), corners mitred. */
export function offsetPath(pts, d) {
  if (!d) return pts.map(p => p.slice());
  const n = pts.length, nrm = i => { const a = pts[i], b = pts[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [-(b[1] - a[1]) / l, (b[0] - a[0]) / l]; };
  return pts.map((p, i) => {
    const a = nrm(Math.max(0, i - 1)), b = nrm(Math.min(n - 2, i)), m = [a[0] + b[0], a[1] + b[1]], k = (m[0] * b[0] + m[1] * b[1]) || 1;
    return [p[0] + m[0] * d / k, p[1] + m[1] * d / k];
  });
}

const turnDeg = (a, b, c) => {
  const u = Math.atan2(b[1] - a[1], b[0] - a[0]), v = Math.atan2(c[1] - b[1], c[0] - b[0]);
  let t = Math.abs(u - v) % (2 * Math.PI); if (t > Math.PI) t = 2 * Math.PI - t;
  return t * 180 / Math.PI;
};
const at = (pts, s) => {           // the point s metres along a polyline
  for (let i = 1, run = 0; i < pts.length; i++) {
    const L = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (run + L >= s - 1e-9) { const k = L ? (s - run) / L : 0; return [pts[i - 1][0] + k * (pts[i][0] - pts[i - 1][0]), pts[i - 1][1] + k * (pts[i][1] - pts[i - 1][1])]; }
    run += L;
  }
  return pts.at(-1).slice();
};

/**
 * planTrenches(runs, env, { hops }) -> { items, pits, joints, summary, totals, env }
 * runs: [{ stage, path: [[x, y]...] plan metres, kind, n, spec, group?, ducted?, drawnPitchM?, takeOffs?: [[x, y]] }]
 *   group names the typed split that applies (dc, branch, collector, mv); takeOffs get a draw pit (ducts rise there).
 * hops: [{ stage, path }] cable routes end to end (the 33 kV circuits): a joint bay each time one passes the drum length.
 *   Runs of a stage that has hops take their joint bays from the hops, not from their own length.
 * items: one per trench dug (a split run gives several), { stage, path, section, sizing, cableOdMm, kind }.
 */
export function planTrenches(runs, env = {}, { hops = [] } = {}) {
  const e = { ...PLAN_DEFAULTS, ...env }, items = [], pits = [], joints = [], byStage = {}, hopStages = new Set(hops.map(h => h.stage));
  const pull = { ...PULL, drumM: e.drumM };
  for (const r of runs) {
    const renv = { ...env, split: splitOf(e.split, r.group ?? r.kind) };
    const z = sizeTrench(r.kind, r.n, r.spec, renv), w = z.section.trench_width_m, n = z.trenches, ducted = r.ducted ?? r.kind === 'dc';
    const drawn = r.drawnPitchM ? checkAsDrawn(r.kind, r.n, r.spec, r.drawnPitchM, renv) : null;
    for (let k = 0; k < n; k++) {
      const path = offsetPath(r.path, (k - (n - 1) / 2) * (w + e.betweenM));
      items.push({ stage: r.stage, kind: r.kind, group: r.group ?? r.kind, n: r.n, spec: r.spec, path, section: z.section, sizing: z, drawn, trench: k + 1, of: n,
        cableOdMm: r.kind === 'dc' ? r.spec.odMm ?? 6 : r.spec.odMm ?? 37.4, ducted });
    }
    // Pulls along the run's centreline: pits (ducted) at turns and at the tension limit, joint bays at drum lengths.
    const plan = pullPlan(r.path, CIRCUIT[r.kind](0, r.spec), { ducted, pull });
    for (const p of plan.pits) pits.push({ at: at(r.path, p.at), why: p.why, stage: r.stage, widthM: z.corridorM });
    for (const p of r.takeOffs || []) pits.push({ at: p.slice(), why: 'ducts rise to the inverter', stage: r.stage, widthM: z.corridorM });
    if (!hopStages.has(r.stage)) {
      for (const j of plan.jointBays) joints.push({ at: at(r.path, j.at), why: j.why, stage: r.stage, lengthM: 4, widthM: z.corridorM + 0.6 });
    }
    const L = r.path.slice(1).reduce((t, q, i) => t + Math.hypot(q[0] - r.path[i][0], q[1] - r.path[i][1]), 0);
    const s = byStage[r.stage] ||= { metres: 0, trenchM: 0, dugM3: 0, beddingM3: 0, widest: 0, worst: 0, notOk: 0, split: 1, drawnWorst: 0, tight: 0,
      cover: z.cover, coverWhy: z.coverWhy, corridor: 0 };
    s.metres += L; s.trenchM += L * n; s.dugM3 += L * z.perMetre.dugBank; s.beddingM3 += L * z.perMetre.beddingSurround;
    s.widest = Math.max(s.widest, w); s.worst = Math.max(s.worst, z.utilisation); s.notOk += z.ok ? 0 : 1; s.split = Math.max(s.split, n);
    s.tight += z.tight ? 1 : 0; s.corridor = Math.max(s.corridor, z.corridorM);
    if (drawn) s.drawnWorst = Math.max(s.drawnWorst, drawn.utilisation);
  }
  // Circuits end to end: a joint each drum length along each one; joints within 5 m of each other share one bay.
  for (const h of hops) {
    const L = h.path.slice(1).reduce((t, q, i) => t + Math.hypot(q[0] - h.path[i][0], q[1] - h.path[i][1]), 0);
    for (let d = e.drumM; d < L - 1; d += e.drumM) {
      const p = at(h.path, d), near = joints.find(j => j.stage === h.stage && Math.hypot(j.at[0] - p[0], j.at[1] - p[1]) < 5);
      if (near) near.circuits++;
      else joints.push({ at: p, why: `drum length (${e.drumM} m) along the circuit`, stage: h.stage, lengthM: 4, widthM: 2, circuits: 1 });
    }
  }
  // Ducted runs that meet end to end at an angle: a draw pit at the corner (the ducts turn there).
  const ends = runs.filter(r => r.ducted ?? r.kind === 'dc').flatMap(r => [[r.path[0], r.path[1], r], [r.path.at(-1), r.path.at(-2), r]]);
  for (let i = 0; i < ends.length; i++) for (let j = i + 1; j < ends.length; j++) {
    const [p, pn, ri] = ends[i], [q, qn, rj] = ends[j];
    if (ri === rj || Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.5) continue;
    if (turnDeg(pn, p, qn) > 10) pits.push({ at: p.slice(), why: 'change of direction', stage: ri.stage });
  }
  // A ducted run whose end lands part-way along another ducted run (a T): the ducts turn into the run, so a pit there too.
  for (const r of runs.filter(x => x.ducted ?? x.kind === 'dc')) for (const p of [r.path[0], r.path.at(-1)]) {
    for (const o of runs) {
      if (o === r || !(o.ducted ?? o.kind === 'dc')) continue;
      for (let i = 1; i < o.path.length; i++) {
        const a = o.path[i - 1], b = o.path[i], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1;
        const k = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2));
        if (Math.hypot(a[0] + k * dx - p[0], a[1] + k * dy - p[1]) < 0.5 && k > 0.01 && k < 0.99) { pits.push({ at: p.slice(), why: 'junction', stage: r.stage }); break; }
      }
    }
  }
  // Pits closer than 2 m are one chamber (sized to the duct bank).
  const merged = [];
  for (const p of pits) {
    const m = merged.find(q => q.stage === p.stage && Math.hypot(q.at[0] - p.at[0], q.at[1] - p.at[1]) < 2);
    if (m) m.widthM = Math.max(m.widthM || 0, p.widthM || 0); else merged.push({ ...p });
  }
  for (const s of Object.values(byStage)) { s.pits = 0; s.joints = 0; }
  for (const p of merged) byStage[p.stage].pits++;
  for (const j of joints) if (byStage[j.stage]) byStage[j.stage].joints++;
  const all = Object.values(byStage), routeM = all.reduce((t, s) => t + s.metres, 0), dugM = all.reduce((t, s) => t + s.trenchM, 0);
  return { items, pits: merged, joints, summary: byStage, env: e, totals: { trenches: items.length, routeM, dugM, pits: merged.length, joints: joints.length } };
}

/** Every electrical readout carries this line. */
export const ILLUSTRATIVE = 'Illustrative — early design, no warranty; confirm with a qualified engineer.';
const pctOf = v => `${Math.round(v * 100)} %`;

/**
 * Readout rows for a plan, in words: [label, text, 'tight' | 'fault' | undefined]; tight and fault rows are the ones the
 * reader must look at (drawn amber and red). extra: { faults, unrated, notes: [text], totals } (totals override the plan's).
 */
export function planRows(plan, extra = {}) {
  const name = { dc: 'DC trenches', ac: 'AC trenches', mv: '33 kV trenches' }, rows = [];
  for (const [stage, s] of Object.entries(plan.summary)) {
    const drawn = s.drawnWorst ? ` · the original drawn pitch would load it to ${pctOf(s.drawnWorst)}` : '';
    const over = s.notOk ? ` (${s.notOk} run${s.notOk > 1 ? 's' : ''} over: larger conductor or split)` : '';
    rows.push([name[stage] || stage, `sized by rating: widest ${s.widest.toFixed(2)} m${s.split > 1 ? `, up to ${s.split} side by side` : ''}`
      + ` · worst cable ${pctOf(s.worst)} of rating${over}${drawn}`, s.notOk ? 'fault' : undefined]);
    if (s.tight) rows.push(['', `tight: ${s.tight} run${s.tight > 1 ? 's' : ''} at ${pctOf(plan.env.tight)} of rating or more; little margin for drier soil`, 'tight']);
    rows.push(['', `${Math.round(s.metres)} m of route, ${Math.round(s.trenchM)} m of trench dug · ${Math.round(s.dugM3)} m³ bank · bedding `
      + `${Math.round(s.beddingM3)} m³ · cover ${s.cover.toFixed(2)} m (${s.coverWhy})${s.pits ? ` · ${s.pits} draw pit${s.pits === 1 ? '' : 's'}` : ''}`
      + `${s.joints ? ` · ${s.joints} joint bay${s.joints === 1 ? '' : 's'}` : ''}`]);
  }
  for (const f of extra.faults || []) rows.push(['Design fault', f, 'fault']);
  for (const f of extra.unrated || []) rows.push(['Not rated', f, 'fault']);
  for (const n of extra.notes || []) rows.push(['', n]);
  const t = extra.totals || plan.totals;
  rows.push(['All trenches', `${t.trenches} trenches dug, ${Math.round(t.dugM)} m (on ${Math.round(t.routeM)} m of route) · `
    + `${t.pits} draw pit${t.pits === 1 ? '' : 's'} · ${t.joints} joint bay${t.joints === 1 ? '' : 's'}`]);
  rows.push(['Rating basis', `IEC 60287 method (own code), soil ${plan.env.soilKmW} K.m/W, ${plan.env.load} load. ${ILLUSTRATIVE}`]);
  return rows;
}
