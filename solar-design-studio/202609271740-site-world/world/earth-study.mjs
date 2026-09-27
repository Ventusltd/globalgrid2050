// earth-study.mjs: the earthing study of the placed solar block, from its geometry and single-line network, using the
// three earthing engines (earth-pv.mjs, earth-grid.mjs, earth-screen.mjs). Pure: no DOM. Loaded by earth-mount.mjs only.
//   stations    each station pad's earth ring and rods, in parallel with the array bonding mesh under its field
//   substation  the compound's earth grid (mesh and perimeter rods), EPR, touch, step and fence against tolerable limits
//   array       PV earthing of one 10 MVA station: LV earth-fault loop, DC insulation, bonding mesh, piles (earth-pv)
//   cables      screen bonding of each 33 kV feeder cable (earth-screen): arrangement, standing voltage, SVLs, ECC
// Every figure is illustrative, early design only, with no warranty: soil, fault currents, split factor and clearance
// times are assumptions the owner types over. Standards are cited by number and clause only; nothing is copied.

import { studyEarthGrid, tolerable } from './earth-grid.mjs';
import { blockEarthing, meshResistance, BLOCK_DEFAULTS } from './earth-pv.mjs';
import { recommendBonding, BONDING_DEFAULTS as SB } from './earth-screen.mjs';
import { build as cableBuild, rating } from './cable-rating.mjs';
import { STATION_DEFAULTS as SD, tableShape, tableOrigin } from './station.mjs';
import { ELEC_FOOTER, fmtQ } from './sld-rules.mjs';

// The typed settings and their assumed defaults (every one can be typed over; see cmd-grammar.mjs, earthing verbs).
export const EARTH_DEFAULTS = Object.freeze({
  rho: 100, rhoTyped: false,       // soil resistivity, ohm.m: assumed until typed or surveyed (uniform soil)
  ringDepth: 0.6, rods: 4, rodLength: 2.4, mesh: 5, // station ring depth, rods per station, rod length, substation mesh (m)
  earthTarget: null,               // resistance target, ohm: a typed setting, never a standard's limit; no default
  bonding: 'auto',                 // 33 kV screen bonding: auto (recommended per cable), both-ends, single-point, cross
  split: 0.5,                      // share of the HV earth-fault current returning through the compound grid (assumed)
  hvFaultTs: 0.5, mvFaultTs: 0.5,  // shock (clearance) times, s (assumed)
  standingLimitV: SB.touchLimitV,  // screen standing-voltage limit at an open end, V (a setting: use the operator's own)
  dcSystem: 'floating'             // DC array: floating (IT on DC, insulation monitoring), typical for transformerless string
});                                // inverters; 'earthed' (one pole) only with the inverter maker's galvanic isolation
export const DC_WORDS = Object.freeze({ floating: 'floating (typical for transformerless string inverters): insulation monitoring, no pole earthed',
  earthed: "one pole earthed: only where the inverter gives galvanic isolation, as its maker specifies" });
const PAD_MARGIN = 12;             // the station pad: 12 m round the transformers, as block-build.mjs levels it
const CRUSHED_ROCK = { rhoS: 3000, hS: 0.1 }; // compound surface layer (assumed)
const T = tableShape(SD);

/** Station and field rectangles in national-grid metres: { id, pad: [e0, n0, e1, n1], field: [...], off: [dx, dy] }. */
export function blockRects(b) {
  const [E, N] = b.anchor, mv = b.built.mv, s0 = mv.stations[0].offset;
  const txs = SD.transformers, px = txs.map(p => p[0]), py = txs.map(p => p[1]);
  const org = Array.from({ length: SD.tables }, (_, n) => tableOrigin(n, SD));
  const W = Math.max(...org.map(o => o[0])) + T.depth + 1, H = Math.max(...org.map(o => o[1])) + T.span + 1;
  const stations = mv.stations.map((S, i) => {
    const [ox, oy] = S.offset, e = E + ox, n = N + oy;
    return { id: S.id, off: [ox - s0[0], oy - s0[1]], level: b.built.pads?.[i]?.level,
      pad: [e + Math.min(...px) - PAD_MARGIN, n + Math.min(...py) - PAD_MARGIN, e + Math.max(...px) + PAD_MARGIN, n + Math.max(...py) + PAD_MARGIN],
      field: [e - T.depth - 1, n - 3, e + W, n + H], tables: org.map(([x, y]) => [e + x, n + y]) };
  });
  const C = mv.compound;
  return { stations, compound: [E + C.x - C.w / 2, N + C.y - C.d / 2, E + C.x + C.w / 2, N + C.y + C.d / 2], compoundLevel: b.built.compoundPad?.level,
    tableSpan: T.span, fieldRows: SD.tables / 4 };
}
const size = r => [r[2] - r[0], r[3] - r[1]];
const polyLen = pts => pts.reduce((t, p, i) => (i ? t + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);

/**
 * earthStudy({ block: world.block.built(), net: { g, ro } | null, settings }) -> the whole study: { stations, worstStation,
 * substation, array, cables, rects, settings, checks, footer }. net is the single-line network (sld-mount graph()).
 */
export function earthStudy({ block, net = null, settings = {} }) {
  const S = { ...EARTH_DEFAULTS, ...settings }, rects = blockRects(block), rho = S.rho;
  const nerA = net?.g?.params?.nerA ?? 1000, sourceKA = net?.g?.params?.sourceKA ?? 40;
  // ---- array: one 10 MVA station's PV earthing, its AC circuit lengths from the placed design ----
  const inv = block.built.summary?.inventory || {};
  const lengths = (block.built.cables?.ac || []).map(c => polyLen(c.points || [])).filter(x => x > 1);
  const array = blockEarthing({ rhoOhmM: rho, inverterKVA: inv.inverterKVA || SD.inverterKVA, inverters: SD.inverters,
    ...(lengths.length ? { lengthsM: lengths } : {}) });
  // ---- stations: pad ring + rods, in parallel with the field's bonding mesh ----
  const fieldMesh = st => { const [w, h] = size(st.field), bp = array.bonding;
    return meshResistance(rho, w * h, bp.lengthM * (w * h) / Math.max(1, bp.areaM2), S.ringDepth).sverak; };
  const ring = st => { const [Lx, Ly] = size(st.pad);
    return studyEarthGrid({ soil: { rho }, grid: { Lx, Ly, nx: 2, ny: 3, h: S.ringDepth, rods: { n: S.rods, L: S.rodLength } },
      fault: { If: nerA, Sf: 1, ts: S.mvFaultTs, tf: S.mvFaultTs }, fence: null, latticeM: 1, segM: 2 }); };
  const r0 = ring(rects.stations[0]);            // every pad is the same shape: one numerical solve serves them all
  const stations = rects.stations.map(st => {
    const Rring = r0.worst.Rg, Rmesh = fieldMesh(st), R = 1 / (1 / Rring + 1 / Rmesh), epr = nerA * R;
    const pu = r0.numeric ? { touch: r0.numeric.Em / r0.numeric.GPR, step: r0.numeric.Es / r0.numeric.GPR } : { touch: 0.5, step: 0.2 };
    return { id: st.id, Rring, Rmesh, R, epr, touch: pu.touch * epr, step: pu.step * epr, limits: r0.limits };
  });
  const worstStation = stations.reduce((w, s) => (s.touch > w.touch ? s : w), stations[0]);
  // ---- substation compound grid ----
  const [Lx, Ly] = size(rects.compound);
  const sub = studyEarthGrid({ soil: { rho, surface: CRUSHED_ROCK }, grid: { Lx, Ly, D: S.mesh, h: S.ringDepth, rods: { n: Math.max(4, 2 * S.rods), L: S.rodLength } },
    fault: { If: sourceKA * 1000, Sf: S.split, ts: S.hvFaultTs, tf: S.hvFaultTs }, fence: { offsetM: 1, bonded: true, stepM: 3 },
    latticeM: 1.5, segM: Math.max(S.mesh / 2, 2) });
  // ---- 33 kV feeder cables: screen bonding ----
  const cables = [];
  for (const br of net?.g?.branches || []) {
    if (br.kind !== 'feeder-cable' || br.open || !(br.lengthM > 1) || !br.areaMm2) continue;
    const ro = net.ro?.branches?.get(br.id), from = net.ro?.nodes?.get(br.from), c = cableBuild(br.areaMm2);
    const run = { id: br.id, kv: 33, lengthM: br.lengthM, loadA: Math.max(1, ro?.currentA || 0), R: rating(br.areaMm2).R,
      If3: (from?.faultKA || 20) * 1000, If1: nerA, formation: 'trefoil', sMm: c.od, screenMeanMm: (c.di + c.ds) / 2, screenAreaMm2: 35, screenMat: 'Cu' };
    const force = { 'both-ends': { solidAcceptPct: Infinity }, 'single-point': { solidAcceptPct: -1, touchLimitV: 1e9 }, cross: { solidAcceptPct: -1 } }[S.bonding] || {};
    const st = recommendBonding(run, { soilOhmM: rho, touchLimitV: S.standingLimitV, ...force });
    cables.push({ id: br.id, path: br.path || null, study: st });
  }
  const out = { settings: S, rects, nerA, sourceKA, array, stations, worstStation, ring: r0, substation: sub, cables, footer: ELEC_FOOTER };
  out.checks = earthChecks(out);
  return out;
}

const up = s => String(s).toUpperCase();
const gt = f => (f ? '>' : '≤'), lt = f => (f ? '<' : '≥'); // the comparison the numbers show: a passing line never prints '>'
/** Check HUD lines (hud-checks.mjs shape): { id, failed, line, working: { inputs, standard, note } }; red only when failed. */
export function earthChecks(s) {
  const out = [], S = s.settings, rhoWord = `ρ ${fmtQ(S.rho, 'Ω·m', 2)} ${S.rhoTyped ? 'typed' : 'assumed'}`;
  const add = (id, failed, line, inputs, standard) => out.push({ id, failed: !!failed, line: up(line),
    working: { inputs: [...inputs, ['Soil', rhoWord]], standard, note: ELEC_FOOTER } });
  const w = s.worstStation, sub = s.substation, u = sub.worst;
  if (S.earthTarget != null) {
    const worstR = Math.max(...s.stations.map(x => x.R));
    add('earth-target', worstR > S.earthTarget, `STATION EARTH ${fmtQ(worstR, 'Ω', 2)} ${gt(worstR > S.earthTarget)} ${fmtQ(S.earthTarget, 'Ω', 2)} TARGET SET · ${rhoWord}`,
      [['Worst station (ring ∥ array mesh)', fmtQ(worstR, 'Ω', 2)], ['Target', `${S.earthTarget} Ω (typed setting, not a standard's limit)`]], 'BS 7430; BS 7671 Chapter 54');
    add('grid-target', u.Rg > S.earthTarget, `SUBSTATION GRID ${fmtQ(u.Rg, 'Ω', 2)} ${gt(u.Rg > S.earthTarget)} ${fmtQ(S.earthTarget, 'Ω', 2)} TARGET SET`,
      [['Grid resistance (worse of two methods)', fmtQ(u.Rg, 'Ω', 2)], ['Target', `${S.earthTarget} Ω (typed)`]], 'IEEE 80 cl. 14');
  }
  const gin = [['Grid', `${fmtQ(sub.geo.Lx, 'm', 3)} × ${fmtQ(sub.geo.Ly, 'm', 3)}, ${fmtQ(sub.geo.D, 'm', 2)} mesh, ${sub.geo.rods.length} rods`],
    ['Grid current', `${fmtQ(sub.IG, 'A', 3)} (fault ${s.sourceKA} kA assumed × split ${S.split} assumed)`], ['EPR', fmtQ(u.GPR, 'V', 2)]];
  add('grid-touch', !sub.verdict.touch, `SUBSTATION TOUCH ${fmtQ(u.Em, 'V', 2)} ${gt(!sub.verdict.touch)} ${fmtQ(sub.limits.touch, 'V', 2)} TOLERABLE · EPR ${fmtQ(u.GPR, 'V', 2)}`,
    [...gin, ['Touch (worse of two methods)', fmtQ(u.Em, 'V', 2)], ['Tolerable', `${fmtQ(sub.limits.touch, 'V', 2)} (${sub.limits.basis}, crushed rock assumed)`]],
    'IEEE 80 cl. 8, 16; EN 50522 / IEC 61936-1 cl. 10 (its curve not shipped)');
  add('grid-step', !sub.verdict.step, `SUBSTATION STEP ${fmtQ(u.Es, 'V', 2)} ${gt(!sub.verdict.step)} ${fmtQ(sub.limits.step, 'V', 2)} TOLERABLE`,
    [...gin, ['Step (worse of two methods)', fmtQ(u.Es, 'V', 2)], ['Tolerable', fmtQ(sub.limits.step, 'V', 2)]], 'IEEE 80 cl. 8, 16');
  if (sub.fence) add('grid-fence', !sub.fence.pass, `COMPOUND FENCE TOUCH ${fmtQ(sub.fence.touchV, 'V', 2)} ${gt(!sub.fence.pass)} ${fmtQ(sub.fence.limit, 'V', 2)} · ${sub.fence.advice}`,
    [['Fence', sub.fence.bonded ? 'bonded to the grid' : 'separately earthed'], ['Touch 1 m outside', fmtQ(sub.fence.touchV, 'V', 2)]], 'IEEE 80 cl. 17');
  add('station-touch', w.touch > w.limits.touch, `STATION ${w.id} TOUCH ${fmtQ(w.touch, 'V', 2)} ${gt(w.touch > w.limits.touch)} `
    + `${fmtQ(w.limits.touch, 'V', 2)} TOLERABLE · EPR ${fmtQ(w.epr, 'V', 2)}`,
    [['33 kV earth fault', `${fmtQ(s.nerA, 'A', 3)} (NER limit, assumed)`], ['Ring ∥ array mesh', `${fmtQ(w.Rring, 'Ω', 2)} ∥ ${fmtQ(w.Rmesh, 'Ω', 2)} = ${fmtQ(w.R, 'Ω', 2)}`],
      ['Touch on the pad', fmtQ(w.touch, 'V', 2)], ['Tolerable', `${fmtQ(w.limits.touch, 'V', 2)} (${w.limits.basis}, no surface layer)`]], 'IEEE 80 cl. 8; BS 7430');
  const a = s.array.worst;
  add('lv-earth-fault', !a.disconnects, `LV EARTH FAULT ${fmtQ(a.Ief / 1000, 'kA', 3)} ${lt(!a.disconnects)} ${fmtQ(a.Ia / 1000, 'kA', 3)} PICK-UP · CIRCUIT ${fmtQ(a.lengthM, 'm', 3)}`
    + ` (MOST ${fmtQ(a.maxLengthM, 'm', 3)})`, [['Loop impedance', fmtQ(a.Zs * 1000, 'mΩ', 3)], ['Least earth-fault current', fmtQ(a.Ief, 'A', 3)],
    ['Device pick-up', `${fmtQ(a.Ia, 'A', 3)} (assumed trip multiple)`], ['Touch at the inverter', fmtQ(a.touchV, 'V', 2)]], 'BS 7671 411.4; IEC 60364-4-41');
  add('lv-cpc', a.cpcOk === false, `LV PROTECTIVE CONDUCTOR BELOW ${fmtQ(a.cpcMinMm2, 'mm²', 2)} ADIABATIC`, [['Least area', fmtQ(a.cpcMinMm2, 'mm²', 2)]], 'BS 7671 543.1.3');
  // The DC array's earthing, always said (an editable setting: earthing dc floating | earthed); a pole earthed is red.
  add('dc-system', S.dcSystem === 'earthed', S.dcSystem === 'earthed' ? 'DC POLE EARTHED: NEEDS THE INVERTER MAKER’S GALVANIC ISOLATION AND APPROVAL'
    : 'DC ARRAY: FLOATING (TYPICAL FOR TRANSFORMERLESS STRING INVERTERS) · EDITABLE: EARTHING DC EARTHED', [['DC system', DC_WORDS[S.dcSystem]],
    ['LV AC', 'TN, winding star earthed at the station (assumed; IT windings need the inverter maker’s approval)']], 'IEC 62548-1 (array earthing); IEC TS 62738');
  out.at(-1).always = true;
  const cs = s.cables.map(c => c.study), sv = cs.filter(c => c.choice !== 'solid').sort((p, q) => q.standingV - p.standingV)[0];
  if (sv) add('screen-standing', sv.standingV > S.standingLimitV, `33 KV SCREEN ${sv.id} ${sv.choice} ${fmtQ(sv.standingV, 'V', 2)} STANDING `
    + `${gt(sv.standingV > S.standingLimitV)} ${S.standingLimitV} V SET`,
    [['Arrangement', sv.choice], ['Standing voltage, full load', fmtQ(sv.standingV, 'V', 2)], ['Limit', `${S.standingLimitV} V (a setting: the operator's own value)`]],
    'IEC 60287-1-1 2.3; BS 7671 411 (touch idea)');
  const ecc = cs.find(c => c.ecc && !c.ecc.ok);
  if (ecc) add('screen-ecc', true, `33 KV ${ecc.id} ECC ${ecc.ecc.areaMm2} MM² < ${fmtQ(ecc.ecc.minAreaMm2, 'mm²', 2)} ADIABATIC`,
    [['ECC', `${ecc.ecc.areaMm2} mm² Cu (assumed)`], ['Adiabatic minimum', fmtQ(ecc.ecc.minAreaMm2, 'mm²', 2)]], 'IEC 60949; BS 7671 543.1.3');
  const svl = cs.find(c => c.svl && c.svl.ucKv == null);
  if (svl) add('screen-svl', true, `33 KV ${svl.id} THROUGH-FAULT SCREEN VOLTAGE ABOVE THE SVL LADDER`, [['Needs', fmtQ(svl.svl.needKv, 'kV', 2)]], 'IEC 60287-1-1; IEEE 575 (concepts)');
  return out;
}

/** Readout sections for the earthing panel and the SLD: [{ title, rows: [[label, value]] }]; the footer closes the list. */
export function earthRows(s, which = null) {
  const S = s.settings, sub = s.substation, u = sub.worst, w = s.worstStation, a = s.array;
  const rhoV = `${fmtQ(S.rho, 'Ω·m', 2)} (${S.rhoTyped ? 'typed' : 'assumed'}; uniform soil; a Wenner survey replaces it)`;
  const sections = [];
  const st = which ? s.stations.find(x => x.id === which) : null;
  if (st) sections.push({ title: `Station ${st.id} earth`, rows: [
    ['Electrode', `ring ${fmtQ(s.ring.geo.Lx, 'm', 2)} × ${fmtQ(s.ring.geo.Ly, 'm', 2)} at ${S.ringDepth} m + ${S.rods} rods × ${S.rodLength} m`],
    ['Soil ρ', rhoV], ['Ring and rods', fmtQ(st.Rring, 'Ω', 2)], ['Array bonding mesh', fmtQ(st.Rmesh, 'Ω', 2)], ['Together', fmtQ(st.R, 'Ω', 2)],
    ['EPR, 33 kV earth fault', `${fmtQ(st.epr, 'V', 2)} at ${fmtQ(s.nerA, 'A', 3)} (NER limit, assumed)`],
    ['Touch · step on the pad', `${fmtQ(st.touch, 'V', 2)} · ${fmtQ(st.step, 'V', 2)} (tolerable ${fmtQ(st.limits.touch, 'V', 2)} · ${fmtQ(st.limits.step, 'V', 2)})`],
    ['Bonded to', 'transformer tanks, LV board PE bar, inverter frames, table steel, RMU'],
    ['Basis', 'own code after the published rod and grid formulas and a numerical check; BS 7430; BS 7671 Ch. 54; IEEE 80 cl. 8, 14']] });
  else sections.push({ title: 'Stations', rows: [['Soil ρ', rhoV], ['Station earth (ring ∥ mesh)', s.stations.map(x => `${x.id} ${fmtQ(x.R, 'Ω', 2)}`).join(' · ')],
    ['Worst touch · EPR', `${w.id} ${fmtQ(w.touch, 'V', 2)} · ${fmtQ(w.epr, 'V', 2)} (tolerable ${fmtQ(w.limits.touch, 'V', 2)})`]] });
  if (!which || which === 'substation') sections.push({ title: 'Substation earth grid', rows: [
    ['Grid', `${fmtQ(sub.geo.Lx, 'm', 3)} × ${fmtQ(sub.geo.Ly, 'm', 3)}, ${fmtQ(sub.geo.D, 'm', 2)} mesh at ${sub.geo.h} m, ${sub.geo.rods.length} rods × ${sub.geo.Lr} m`],
    ['Resistance', `${fmtQ(u.Rg, 'Ω', 2)} (closed form ${fmtQ(sub.closed.Rg, 'Ω', 2)}${sub.numeric ? `, numerical ${fmtQ(sub.numeric.Rg, 'Ω', 2)}` : ''})`],
    ['Grid current', `${fmtQ(sub.IG, 'A', 3)} (${s.sourceKA} kA assumed × split ${S.split} assumed × decrement ${fmtQ(sub.Df, '', 3)})`],
    ['Earth potential rise', fmtQ(u.GPR, 'V', 2)], ['Touch', `${fmtQ(u.Em, 'V', 2)} (tolerable ${fmtQ(sub.limits.touch, 'V', 2)})`],
    ['Step', `${fmtQ(u.Es, 'V', 2)} (tolerable ${fmtQ(sub.limits.step, 'V', 2)})`],
    ...(sub.fence ? [['Fence (bonded)', `${fmtQ(sub.fence.touchV, 'V', 2)} touch 1 m outside`]] : []),
    ...sub.hot.filter(h => h.exceeded).map(h => [`Hot zone ${h.V} V`, `about ${fmtQ(h.radiusM, 'm', 2)} from the grid centre`]),
    ['Earth conductor', `${sub.conductor.pickMm2 ?? 'over 400'} mm² Cu (needs ${fmtQ(sub.conductor.needMm2, 'mm²', 2)})`],
    ...sub.warnings.map(x => ['Caution', x]), ['Basis', 'IEEE 80 cl. 8, 11, 14-17; EN 50522; IEC 61936-1 cl. 10; IEC 60949']] });
  if (!which) sections.push({ title: 'PV array (one 10 MVA station)', rows: [
    ['LV earth fault, longest circuit', `${fmtQ(a.worst.Ief / 1000, 'kA', 3)} vs pick-up ${fmtQ(a.worst.Ia / 1000, 'kA', 3)}; longest that reaches it ${fmtQ(a.worst.maxLengthM, 'm', 3)}`],
    ['DC array', `${DC_WORDS[S.dcSystem]} (editable: earthing dc floating or earthing dc earthed)`],
    ['Touch at an inverter', `${fmtQ(a.worst.touchV, 'V', 2)} (bond frame, structure and pile locally)`],
    ['DC insulation, one inverter', `${fmtQ(a.insulation.perInverter.risoOhm / 1000, 'kΩ', 2)} healthy wet (${fmtQ(a.insulation.wholeBlock.risoOhm / 1000, 'kΩ', 2)} if one array)`],
    ['Bonding mesh', `${fmtQ(a.bonding.lengthM, 'm', 3)} of ${fmtQ(a.bonding.sizeMm2, 'mm²', 2)} Cu, ${a.bonding.across} cross runs`],
    ['Basis', 'BS 7671 411.4, 543.1.3, Section 712; IEC 62548-1 6.4.3, 7.3.2; IEC TS 62738 6.4, 6.5.1']] });
  if (!which || which === 'cables') {
    const by = {}; for (const c of s.cables) by[c.study.choice] = (by[c.study.choice] || 0) + 1;
    const worst = s.cables.map(c => c.study).sort((p, q) => q.standingV - p.standingV)[0];
    sections.push({ title: '33 kV cable screens', rows: [['Bonding', `${S.bonding}: ${Object.entries(by).map(([k, n]) => `${n} ${k}`).join(', ') || 'no cables'}`],
      ...(worst ? [['Highest standing voltage', `${fmtQ(worst.standingV, 'V', 2)} on ${worst.id} (${worst.choice}; limit set ${S.standingLimitV} V)`]] : []),
      ['Basis', 'IEC 60287-1-1 2.3; IEC 60949; BS 7671 543.1.3']] });
  }
  return { sections, footer: ELEC_FOOTER };
}
