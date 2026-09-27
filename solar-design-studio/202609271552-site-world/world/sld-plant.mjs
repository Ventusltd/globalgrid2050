// sld-plant.mjs: a whole solar plant as a single-line network, from generic rules, for the diagram and the load flow.
//
// The same rules as plant-template.mjs, with the diagram's refinements:
//   inverters counted at unity power factor (100-400 kVA each) and spread evenly across stations (counts differ by at
//   most one); a remainder of half a station or less becomes one half-size station, never a tiny one;
//   each station transformer is one unit with a list of LV windings (two on a full station, one on a half station),
//   rated at the sum of its inverters, with its vector group, impedance and taps;
//   MV board sections = grid transformers x their LV windings (two above a size threshold), equal feeders per section,
//   each section with its own earthing transformer and NER, spare ways, and optional storage way and harmonic filter;
//   feeders radial chains by default (rings optional, with one normally-open point); each segment sized from the load
//   it carries with the group factor of the circuits leaving the board together, not below the fault minimum (from the
//   computed board fault level plus the inverters' contribution, not the switchgear rating), then an
//   economic step over a small size palette, then upsized until the 0.5 % drop is met;
//   the connection a short, fully ducted, unjointed HV cable to a gas-insulated bay at the operator's substation, with
//   a disconnector, earth switch and surge arresters at the plant end (an overhead tee is an option, off by default).
// Lengths are placeholders until a layout sets them. Illustrative, not a design for any site. Pure.

import { sizeFor, dropPercent, SIZES } from './cable-rating.mjs';
import { gridChoice, faultMinArea, GRID_MVA } from './plant-template.mjs';
import { groupFactor, economicSize, PALETTE, SLD_DEFAULTS, SLD_LABEL } from './sld-rules.mjs';

export const PLANT_DEFAULTS = Object.freeze({
  inverterKVA: 300, invertersPerStation: 20, feederLimitMVA: 25, stationsPerFeederMax: 4, maxUtilisation: 0.9,
  vdropLimitPct: 0.5, faultKA: 20, faultS: 1, soilKmW: 1.2, gridFactor: 1.1, spareWays: 1, storageWay: false,
  harmonicFilter: false, topology: 'radial', pocKv: 400, connection: 'cable', hvLengthM: 1500, headLengthM: 1500,
  headStepM: 250, linkLengthM: 300, acAreaMm2: 400, acSpacingM: 25, linkRingM: 300
});

const up = (steps, v) => steps.find(s => s >= v - 1e-9) ?? steps.at(-1);
const spread = (total, parts) => Array.from({ length: parts }, (_, i) => Math.floor(total / parts) + (i < total % parts ? 1 : 0));

/** Inverters per station: balanced full stations, plus one half-size station for a remainder of half a station or less. */
export function stationSplit(inverters, perMax) {
  const full = Math.floor(inverters / perMax), rem = inverters - full * perMax;
  if (!rem) return spread(inverters, full).map(n => ({ inverters: n, half: false }));
  if (!full || rem > perMax / 2) return spread(inverters, full + 1).map(n => ({ inverters: n, half: false }));
  const half = Math.round(inverters * 0.5 / (full + 0.5));
  return [...spread(inverters - half, full).map(n => ({ inverters: n, half: false })), { inverters: half, half: true }];
}

/** sldPlant({ targetMW, ...choices }) -> the plant as a network source (see sld-graph.mjs), with counts and checks. */
export function sldPlant(opts = {}) {
  const p = { ...PLANT_DEFAULTS, ...SLD_DEFAULTS, ...opts }, mw = Number(p.targetMW);
  if (!(mw > 0 && mw <= 5000)) throw Error('sld plant: targetMW must be between 0 and 5000');
  if (!(p.inverterKVA >= 100 && p.inverterKVA <= 400)) throw Error('sld plant: inverterKVA must be 100 to 400');
  if (!(p.invertersPerStation >= 8 && p.invertersPerStation <= 30)) throw Error('sld plant: invertersPerStation must be 8 to 30');
  if (![132, 275, 400].includes(p.pocKv)) throw Error('sld plant: connection at 132, 275 or 400 kV');
  const inverters = Math.ceil(mw * 1000 / p.inverterKVA - 1e-9);
  let invNo = 0;
  const stations = stationSplit(inverters, p.invertersPerStation).map((s, i) => {
    const id = `S${i + 1}`, kva = s.inverters * p.inverterKVA, nW = s.half ? 1 : 2;
    const windings = spread(s.inverters, nW).map((k, w) => ({ id: 'ab'[w], kva: k * p.inverterKVA,
      inverters: Array.from({ length: k }, (_, j) => ({ id: `I${++invNo}`, kva: p.inverterKVA, acAreaMm2: p.acAreaMm2,
        acLengthM: p.acSpacingM * (1 + Math.floor(j / 2)) })) }));
    return { id, at: null, rmuAt: null, half: s.half, inverters: s.inverters, kva,
      units: [{ id: 'T', mva: kva / 1000, zPct: p.stZPct, xr: p.stXR, vector: nW === 2 ? p.stVector : 'Dy11', taps: '±2 × 2.5 %', windings }] };
  });

  // Feeders, then grid transformers and board sections; the feeder count is rounded up to fill every section equally.
  const stMax = Math.max(...stations.map(s => s.kva / 1000));
  const per = Math.max(1, Math.min(p.stationsPerFeederMax, Math.floor(p.feederLimitMVA / stMax)));
  const n0 = Math.ceil(stations.length / per);
  const loads0 = spread(stations.length, n0).map(k => ({ loadMVA: k * stMax }));
  const g0 = gridChoice(mw, mw * p.gridFactor, null, loads0);
  const lvW = g0.mva >= p.gtTwoLvFromMVA ? 2 : 1;
  let S = g0.units * lvW, nF = Math.ceil(n0 / S) * S;
  if (nF > stations.length) { nF = Math.max(n0, Math.min(stations.length, nF)); S = Math.min(S, nF); }
  // Fault minimum from the computed board level (grid source + one grid transformer winding, IEC 60909 c = 1.1) plus the
  // inverters' own contribution (about 1.2 x rated current, assumed), not from the switchgear's rated 20 kA.
  const kvHv = p.pocKv, zs = p.c * p.sBaseMVA / (Math.sqrt(3) * kvHv * p.sourceKA), zt = p.gtZPct / 100 * p.sBaseMVA / (g0.mva / lvW);
  const boardKA = p.c / (zs + zt) * p.sBaseMVA / (Math.sqrt(3) * 33) + 1.2 * mw / (Math.sqrt(3) * 33);
  const perSection = Math.ceil(nF / S), counts = spread(stations.length, nF), minArea = faultMinArea(Math.min(p.faultKA, boardKA), p.faultS);
  const opt = { soilKmW: p.soilKmW, kv: 33, pf: p.powerFactor };
  const feeders = [];
  for (let f = 0, k = 0; f < nF; f++) {
    const chain = stations.slice(k, k + counts[f]); k += counts[f];
    const section = `MVB${Math.floor(f / perSection) + 1}`, inSection = f % perSection;
    feeders.push(sizeChain({ id: `F${f + 1}`, section, chain, head: p.headLengthM + inSection * p.headStepM,
      group: groupFactor(Math.min(perSection, nF - Math.floor(f / perSection) * perSection)), p, opt, minArea }));
  }
  const sections = Array.from({ length: S }, (_, s) => ({ id: `MVB${s + 1}`, gt: `GT${Math.floor(s / lvW) + 1}`, winding: 'ab'[s % lvW],
    spareWays: p.spareWays, storageWay: !!p.storageWay, harmonicFilter: !!p.harmonicFilter }));
  const gtLoad = new Map();
  for (const f of feeders) { const gt = sections.find(s => s.id === f.section).gt; gtLoad.set(gt, (gtLoad.get(gt) || 0) + f.loadMVA); }
  const units = Math.ceil(S / lvW), gtMVA = Math.max(g0.mva, up(GRID_MVA, Math.max(...gtLoad.values())));
  const grid = Array.from({ length: units }, (_, g) => ({ id: `GT${g + 1}`, mva: gtMVA, zPct: p.gtZPct, xr: p.gtXR, vector: p.gtVector,
    hvNeutral: p.gtHvNeutral, lvWindings: lvW, at: null }));
  const hv = { kv: p.pocKv, connection: p.connection, rule: 'assumed', ruleText: 'generic plant, no map: connection assumed', lengthM: p.hvLengthM, ducted: true, unjointed: true, protection: 'tiles',
    landing: { kind: p.connection === 'ohl-tee' ? 'tower' : 'gis-bay', e: null, n: null, kv: p.pocKv, real: false, distanceM: p.hvLengthM } };

  const check = (name, value, max, min = -Infinity) => ({ name, value, min, max, ok: value <= max + 1e-9 && value >= min - 1e-9 });
  const invCounts = stations.filter(s => !s.half).map(s => s.inverters);
  const checks = [
    check('inverters per full station differ by at most one', Math.max(...invCounts) - Math.min(...invCounts), 1),
    check('feeder load MVA', Math.max(...feeders.map(f => f.loadMVA)), p.feederLimitMVA),
    check('MV voltage drop % (worst feeder)', Math.max(...feeders.map(f => f.dropPct)), p.vdropLimitPct),
    check('solar feeders per board section', perSection, 6),
    check('load on each grid transformer', Math.max(...gtLoad.values()) / gtMVA, 1)
  ];
  return { kind: 'template', label: SLD_LABEL, mw, pocKv: p.pocKv, params: p, stations, feeders, sections, grid, hv, checks,
    boardFaultKA: boardKA, minAreaMm2: minArea, ok: checks.every(c => c.ok), counts: { inverters, stations: stations.length, halfStations: stations.filter(s => s.half).length,
      feeders: nF, sections: S, gridTransformers: units, gtLvWindings: lvW, perFeeder: per },
    note: `Generic single-line network from rating rules; lengths are placeholders until a layout sets them. ${SLD_LABEL}` };
}

// A radial chain: each segment from the load it carries (group factor at the head), fault minimum, economic step, drop.
function sizeChain({ id, section, chain, head, group, p, opt, minArea }) {
  // A ring (topology 'ring', the same shape as block-mv.mjs) runs back to its board with one normally-open hop in the
  // middle; every hop is sized for the whole ring load (one end out), and the drop is checked for normal running.
  const ring = p.topology === 'ring', total = chain.reduce((t, x) => t + x.kva / 1000, 0), open = ring ? Math.ceil(chain.length / 2) : -1;
  const ends = ring ? [...chain, null] : chain, sum = (a, b) => chain.slice(a, b).reduce((t, x) => t + x.kva / 1000, 0);
  const hops = ends.map((s, k) => {
    const loadMVA = ring ? total : sum(k), g = k && s ? 1 : group, lengthM = k && s ? p.linkLengthM : head;
    const tech = (sizeFor(loadMVA / p.maxUtilisation, { ...opt, minArea, groupFactor: g }) || { area: SIZES.at(-1) }).area;
    return { from: k ? chain[k - 1].id : section, to: s ? s.id : section, loadMVA, lengthM, group: g, technical: tech, open: k === open,
      running: ring ? (k < open ? sum(k, open) : k > open ? sum(open, k) : 0) : loadMVA, areaMm2: economicSize(tech, loadMVA, lengthM, opt) };
  });
  const side = hs => hs.reduce((t, h) => t + dropPercent(h.areaMm2, h.lengthM, h.running, opt), 0);
  const drop = () => (ring ? Math.max(side(hops.slice(0, open)), side(hops.slice(open + 1))) : side(hops));
  for (let guard = 0; drop() > p.vdropLimitPct && guard < 60; guard++) {
    const can = hops.filter(h => h.areaMm2 < SIZES.at(-1)).sort((a, b) => b.running * b.lengthM - a.running * a.lengthM)[0];
    if (!can) break;
    if (ring) for (const h of hops) h.areaMm2 = PALETTE.find(a => a > h.areaMm2) ?? SIZES.at(-1); // a ring keeps one size
    else can.areaMm2 = PALETTE.find(a => a > can.areaMm2) ?? SIZES.at(-1);                          // the next size in the palette
  }
  return { id, section, sectionB: section, topology: ring ? 'ring' : 'radial', openAt: ring ? hops[open].from : null, hops,
    loadMVA: total, dropPct: drop() };
}
