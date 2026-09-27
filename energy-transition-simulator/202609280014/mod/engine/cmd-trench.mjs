// COPIED UNCHANGED from world/v12 cmd-trench.mjs at v12 commit 3adcee9 (file last changed 604729d). Modular star family: public #148279 trenchEnv.
// Do not edit here: change the source and re-copy. Everything below this header is byte-identical to the source.
// cmd-trench.mjs: the command line's trench and cable words, as text. Pure: the numbers come from the rating cartridges.
//   cable rate 400 al 28 circuits [pitch 0.25] [lv|mv|dc]   one group of circuits rated together, the BS 7671 433.1 overload
//                                                          check (lv-dc-sizing.mjs) and the trench that carries them
//   trench design                                          the solar block's trenches as sized, or the block's two cases
// One rating path: cable rate and trench design both rate through trench-plan.mjs (trench-design.mjs, the IEC 60287 method
// in our own code) with the same cable build, so one case gives one answer. Standards are cited by number and clause only;
// every value is our own computation or a labelled assumption.

import { PRESETS } from './cable-iec.mjs';
import { build as mvBuild } from './cable-rating.mjs';
import { chooseIn, coordinate, faultArea } from './lv-dc-sizing.mjs';
import { transformerFaultKA, TX_FAULT } from './fault-level.mjs';
import { sizeTrench, checkAsDrawn, LOADS, PLAN_DEFAULTS, ILLUSTRATIVE } from './trench-plan.mjs';
import { STATION_DEFAULTS as SD } from './station.mjs';
import { BLOCK_DC_ISC_A, blockTrenches } from './block-trenches.mjs';
import { station } from './station.mjs';
import { mvChain } from './block-mv.mjs';
import { kvForMW } from './sld-connect.mjs';

export const TRENCH_KEYS = Object.freeze(['soil', 'load', 'splitDc', 'splitBranch', 'splitCollector', 'splitMv', 'coverDc', 'coverLv', 'coverMv',
  'drumM', 'ring']);
/** The typed trench settings' defaults (cmd-model.mjs DEFAULTS): the same values the block is built with. */
export const TRENCH_DEFAULTS = Object.freeze({ splitDc: 0, splitBranch: 0, splitCollector: 0, splitMv: 0, coverDc: PLAN_DEFAULTS.cover.dc,
  coverLv: PLAN_DEFAULTS.cover.lv, coverMv: PLAN_DEFAULTS.cover.mv, drumM: PLAN_DEFAULTS.drumM, ring: 'n-1' });
/** The typed sizing inputs, as trench-plan.mjs and block-build.mjs take them. */
export const trenchEnv = st => ({ soilKmW: st.soil, load: st.load,
  split: { dc: st.splitDc ?? 0, branch: st.splitBranch ?? 0, collector: st.splitCollector ?? 0, mv: st.splitMv ?? 0 },
  cover: { dc: st.coverDc ?? PLAN_DEFAULTS.cover.dc, lv: st.coverLv ?? PLAN_DEFAULTS.cover.lv, mv: st.coverMv ?? PLAN_DEFAULTS.cover.mv },
  drumM: st.drumM ?? PLAN_DEFAULTS.drumM, ring: st.ring ?? 'n-1' });
// The environment for one kind of run: its own typed split (the block's collector for LV, as in trench design).
const envFor = (st, kind) => { const e = trenchEnv(st); return { ...e, split: e.split[kind === 'lv' ? 'collector' : kind] }; };

const f = (v, d = 2) => (Number.isFinite(v) ? v.toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d }) : '–');
const pct = v => `${Math.round(v * 100)} %`;
const BLOCK_LV_A = SD.inverterKVA * 1000 / (Math.sqrt(3) * SD.acVolts);   // the block's inverter at full output
const FOOT = `${ILLUSTRATIVE} (IEC 60287 method, own code; not for construction.)`;
const tight = z => (z.tight ? ' (tight: little margin)' : '');

/** One cable, one build: the block's own 400 mm² Al where that is the cable, so cable rate and trench design agree. */
export function specOf(kind, size, metal, loadA) {
  if (kind === 'dc') return { loadA, areaMm2: size, odMm: size <= 6 ? 6 : 7.2 };
  if (kind === 'mv') return { loadA, areaMm2: size, odMm: mvBuild(size).od, material: metal };
  const block = size === SD.acAreaMm2 && metal === 'al';
  const od = block ? SD.acDiameter * 1000 : PRESETS.lvAl(size, metal === 'cu' ? { cond: { mat: 'Cu', area: size } } : {}).od;
  return { loadA, areaMm2: size, odMm: od, material: metal };
}

/**
 * rateText({ size, metal, circuits, pitchM, kind }, st) -> words. kind: 'lv' (default: the block's 800 V inverter
 * circuits), 'mv' (33 kV, rating only) or 'dc' (string cables, 12 in a duct, n ducts).
 */
export function rateText({ size, metal = 'al', circuits = 1, pitchM = null, kind = 'lv' }, st) {
  const head = `${circuits} × ${size} mm² ${metal === 'cu' ? 'Cu' : 'Al'}`;
  if (kind === 'dc') {
    const loadA = 1.25 * BLOCK_DC_ISC_A, spec = specOf('dc', size, metal, loadA), env = envFor(st, 'dc'), z = sizeTrench('dc', circuits, spec, env);
    const drawn = pitchM ? checkAsDrawn('dc', circuits, spec, pitchM, env) : null;
    return [`DC ${head}: ${circuits} duct${circuits > 1 ? 's' : ''} of 12 string cables each, ${f(loadA, 1)} A a cable = 1.25 × Isc ${BLOCK_DC_ISC_A} A `
      + '(assumed; IEC 62548-1 cl. 7.2):',
    drawn ? `at ${f(pitchM)} m pitch the hottest cable runs at ${pct(drawn.utilisation)} of its rating (${drawn.hottestC} °C).` : '',
    `Needs: ${z.name}, ${f(z.widthM)} m wide, cover ${f(z.cover)} m, ${pct(z.utilisation)} loaded${tight(z)}.`, basis(st), FOOT].filter(Boolean).join('\n');
  }
  const Ib = kind === 'mv' ? 1 : BLOCK_LV_A, spec = specOf(kind, size, metal, Ib), env = envFor(st, kind), pitch = pitchM ?? (kind === 'mv' ? 0.45 : 0.25);
  const one = checkAsDrawn(kind, 1, spec, pitch, env).ratingA, grp = checkAsDrawn(kind, circuits, spec, pitch, env).ratingA;
  const lines = [`${kind === 'mv' ? '33 kV' : 'LV'} ${head} trefoils, ${f(pitch)} m apart, ${f(env.cover[kind])} m cover, soil ${f(st.soil, 1)} K.m/W, `
    + `${st.load} load:`,
  `one circuit alone carries ${Math.round(one)} A${circuits > 1 ? `; ${circuits} together carry ${Math.round(grp)} A each (${pct(grp / one)} of alone)` : ''}.`];
  if (kind === 'lv') {
    const In = chooseIn(Ib, { device: 'mccb', adjustable: true, setStep: 5 }), co = coordinate({ Ib, In, Iz: grp, device: 'mccb' });
    const kA = transformerFaultKA(), need = faultArea(metal, kA, TX_FAULT.seconds);
    lines.push(`Inverter circuit Ib ${Math.round(Ib)} A (${SD.inverterKVA} kVA at ${SD.acVolts} V): ${pct(Ib / grp)} of the grouped rating.`,
      `BS 7671 433.1 / IEC 60364-4-43: ${co.checks.map(c => `${c.name} ${c.ok ? 'yes' : 'NO'}`).join(' · ')} (breaker set to ${In} A).`,
      `LV board fault level about ${Math.round(kA)} kA (${TX_FAULT.mva} MVA at ${TX_FAULT.zPct} % impedance assumed, plus the inverters; impedance method): `
      + `${size} mm² needs ${Math.round(need)} mm² for ${TX_FAULT.seconds} s, ${size >= need ? 'yes' : 'NO'} (BS 7671 434.5.2).`);
    const z = sizeTrench('lv', circuits, spec, env);
    lines.push(`Trench that carries them: ${z.name}, ${f(z.widthM)} m wide${z.trenches > 1 ? ` each, ${f(z.corridorM)} m corridor` : ''}, `
      + `${pct(z.utilisation)} loaded${z.ok ? '' : ' (still over: a larger conductor)'}${tight(z)}.`);
  }
  lines.push(basis(st), FOOT);
  return lines.join('\n');
}

const basis = st => `Soil ${f(st.soil, 1)} K.m/W, ground 15 °C, conductor 90 °C; load ${st.load}${st.load === 'solar-day'
  ? ` (loss-load factor ${f(LOADS['solar-day'])}, no clipping: optimistic where inverters clip; continuous is the BS 7671 compliance basis)` : ''}.`;

// The block's own layout for the typed inputs, as block 10mva builds it (no ground needed for the plan): one source.
let planMemo = { key: '', plan: null };
function blockPlan(st) {
  const env = trenchEnv(st), key = JSON.stringify([env, st.pocKv]);
  if (planMemo.key !== key) {
    // Connection voltage as block 10mva picks it: the typed one, else by plant size (sld-connect.mjs), 132 kV at least.
    const s = station(null, { corners: false }), stationMVA = s.inventory.aggregateInverterMVA;
    const pocKv = [132, 275, 400].includes(st.pocKv) ? st.pocKv : kvForMW(mvChain({ stations: 1, stationMVA, pocKv: 132 }).exportMW, { minKv: 132 });
    const mv = mvChain({ stations: 1, stationMVA, pocKv });
    planMemo = { key, plan: blockTrenches(s, mv, 0, 0, a => mvBuild(a).od, env) };
  }
  return planMemo.plan;
}

/**
 * designText(st, rows) -> words: the placed block's sized trenches (rows from block-ui), or, with no block, the same
 * block's layout for the typed inputs, and the options for its busiest collector stretch and busiest DC stretch.
 */
export function designText(st, rows = null) {
  const line = ([k, v, cls]) => `${k ? k + ': ' : '  '}${cls === 'fault' && !['Design fault', 'Not rated'].includes(k) ? '[OVER] ' : ''}${v}`;
  if (rows?.length) return ['Solar block trenches, sized by rating:', ...rows.map(line)].join('\n');
  const b = blockPlan(st), out = ['No block placed (type block 10mva). The block\'s trenches as it would be built:',...b.plan.rows.map(line)];
  const busiest = g => b.items.filter(t => t.group === g).reduce((a, t) => (t.n > a.n ? t : a));
  for (const [kind, t, what, pitch] of [['lv', busiest('collector'), 'inverter circuits on the busiest collector stretch', 0.25],
    ['dc', busiest('dc'), 'DC ducts on the busiest DC stretch', SD.ductSpacing]]) {
    const env = envFor(st, kind), z = sizeTrench(kind, t.n, t.spec, env), d = checkAsDrawn(kind, t.n, t.spec, pitch, env);
    out.push(`${t.n} ${what}, cover ${f(z.cover)} m: at the original drawn pitch (${f(pitch)} m) ${pct(d.utilisation)} loaded.`,
      ...z.options.filter(o => o.layers === 1 || o.trenches === 1).map(o => `  ${o.name === z.name ? '→' : ' '} ${o.name}: ${f(o.widestM)} m wide, `
        + `corridor ${f(o.corridorM)} m, ${f(o.dugM3PerM)} m³ dug per metre, ${pct(o.utilisation)} loaded${o.ok ? '' : ' (over)'}`
        + `${o.name === z.name ? tight(z) : ''}`));
  }
  out.push('Type trench split collector 2 (or dc, branch, mv) to choose trenches side by side; trench cover dc 0.91, soil 1.5 or load solar-day '
    + 'to change the inputs.', basis(st), FOOT);
  return out.join('\n');
}
