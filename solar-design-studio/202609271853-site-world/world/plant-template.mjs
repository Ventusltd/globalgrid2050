// plant-template.mjs: a generic, parameterised solar plant block diagram, sized from engineering rules.
//
// Give it a target export in MW and any of the choices below; it works out the string length, strings per
// inverter, stations, 33 kV feeders (radial chains, or rings with a normally-open point), MV board sections with
// normally-open ties, grid transformers and the connection, then sizes each feeder cable segment from the load it
// carries (cable-rating.mjs, IEC 60287 method) and checks every level against its limit. Counts come out of the
// arithmetic, so no size reproduces any real plant. Illustrative: a real design is set by studies.
//
// Ranges (general practice; the defaults sit inside them):
//   string length: cold open-circuit voltage stays under the 1500 V system limit; 12 strings per inverter up to the MPPT
//   cap (MPPT inputs x strings per input, 12 x 2 = 24 by default; a given stringsMax overrides it)
//   string inverters 100-400 kVA; 8-30 per station, a smaller station takes any remainder
//   central inverters (inverterClass 'central'): 500-5000 kVA units, 1-4 per MV skid or container station; strings
//   gathered in DC combiner boxes (8-32 strings a box), so no MPPT cap on strings per inverter; skid transformers in
//   the 0.8-10 MVA steps. Generic class, illustrative: the central-inverter plants of the UK study run 1-3 MVA units
//   station transformers 2.5-10 MVA, ONAN, two LV windings (Dy11y11), one auxiliary transformer each
//   33 kV feeder 20-30 MVA and 2-4 stations; 2-6 solar feeders per board section plus spares
//   grid transformers 1.0-1.2 x the export in total (30-240 MVA steps); connection at 132, 275 or 400 kV (33 kV up to about 30 MW)
//   MV voltage drop 0.5 % or less; conductor short-circuit by the adiabatic rule (IEC 60949, k = 94 for Al XLPE)
// Pure: imports only the cable rating and the module catalogue's cold-Voc rule.

import { sizeFor, dropPercent, rating, SIZES } from './cable-rating.mjs';
import { coldVocOf } from './module-catalogue.mjs';

export const STATION_MVA = Object.freeze([2.5, 3.15, 4, 5, 6.3, 8, 10]);
export const CENTRAL_MVA = Object.freeze([0.8, 1, 1.25, 1.6, 2, 2.5, 3.15, 4, 5, 6.3, 8, 10]);
export const INVERTER_CLASSES = Object.freeze(['string', 'central']);
export const GRID_MVA = Object.freeze([20, 30, 40, 45, 60, 75, 90, 100, 120, 150, 180, 200, 240]);

export const TEMPLATE_DEFAULTS = Object.freeze({
  // The module: the default class A of data/modules.json (nominal 660 W, highest-bin Voc 46.1 V, β Voc -0.25 %/K), the same
  // class the solar block uses; a page passes the selected class or the typed values (tests/plant-network checks they agree).
  dcAcRatio: 1.25, moduleWp: 660, moduleVoc: 46.1, vocCoeffPerK: -0.0025, minCellC: -10, systemV: 1500,
  inverterClass: 'string', inverterKVA: 300, invertersPerStation: 20, stringsPerCombiner: 20, stringsMin: 12, stringsMax: null, mppts: 12, stringsPerMppt: 2, powerFactor: 0.95,
  feederLimitMVA: 25, stationsPerFeederMax: 4, feedersPerBoardMax: 6, spareWays: 1, topology: 'radial',
  gridFactor: 1.1, gridUnits: null, gridBank: 'three-phase', pocKv: null, harmonicFilter: false,
  headLengthM: 1500, linkLengthM: 300, vdropLimitPct: 0.5, maxUtilisation: 0.9, faultKA: 20, faultS: 1, soilKmW: 1.2
});

const up = (steps, v) => steps.find(s => s >= v - 1e-9) ?? null;
const r3 = v => (v == null ? v : Math.round(v * 1000) / 1000);

export const autoPocKv = mw => (mw <= 30 ? 33 : mw <= 150 ? 132 : 400);

/** The sizing cold Voc of one module: the stricter of the coldest cell and Voc x 1.15 (module-catalogue.mjs coldVocOf). */
export const moduleColdVoc = p => coldVocOf({ voc: p.moduleVoc, coeffPctPerK: p.vocCoeffPerK * 100, tC: p.minCellC });
// Modules per string: the typed length, else the most whose sizing cold Voc stays under the limit.
export function modulesPerString(p) {
  if (p.modulesPerString > 0) return p.modulesPerString; // typed (table 2P30); the string check below says if it is over
  return Math.floor(p.systemV / moduleColdVoc(p).v + 1e-9);
}

// Smallest conductor that survives the fault: A >= I * sqrt(t) / k, k = 94 for aluminium XLPE 90 to 250 C.
export const faultMinArea = (kA, s) => SIZES.find(a => a >= kA * 1000 * Math.sqrt(s) / 94) ?? SIZES.at(-1);

/**
 * plantTemplate({ targetMW, ...choices }) -> { params, counts, ratings, nodes, links, feeders, checks, ok, note }
 * nodes: { id, kind, label, rating } ; links: { from, to, kind, kv, mva, areaMm2?, lengthM?, normallyOpen? }
 */
export function plantTemplate(opts = {}) {
  const p = { ...TEMPLATE_DEFAULTS, ...opts }, mw = Number(p.targetMW);
  if (!(mw > 0 && mw <= 5000)) throw new Error('plant template: targetMW must be between 0 and 5000');
  const central = p.inverterClass === 'central';
  if (!INVERTER_CLASSES.includes(p.inverterClass)) throw new Error(`plant template: inverterClass must be ${INVERTER_CLASSES.join(' or ')}`);
  if (central) {
    if (!(p.inverterKVA >= 500 && p.inverterKVA <= 5000)) throw new Error('plant template: a central inverter is 500 to 5000 kVA');
    if (!(p.invertersPerStation >= 1 && p.invertersPerStation <= 4)) throw new Error('plant template: 1 to 4 central inverters per station');
    if (!(p.stringsPerCombiner >= 8 && p.stringsPerCombiner <= 32)) throw new Error('plant template: stringsPerCombiner must be 8 to 32');
  } else {
    if (!(p.inverterKVA >= 100 && p.inverterKVA <= 400)) throw new Error('plant template: inverterKVA must be 100 to 400');
    if (!(p.invertersPerStation >= 8 && p.invertersPerStation <= 30)) throw new Error('plant template: invertersPerStation must be 8 to 30');
  }
  const kvMv = 33, kvPoc = p.pocKv || autoPocKv(mw);
  const mps = modulesPerString(p), stringKWp = mps * p.moduleWp / 1000;
  // The MPPT cap: inputs x strings per input, unless stringsMax is given; central inverters take strings through combiner boxes.
  const sMax = p.stringsMax ?? (central ? Infinity : p.mppts * p.stringsPerMppt);
  const spi = Math.min(sMax, Math.max(p.stringsMin, Math.round(p.inverterKVA * p.dcAcRatio / stringKWp)));
  const inverters = Math.ceil(mw / p.powerFactor * 1000 / p.inverterKVA);

  // Stations: full ones of the chosen size; a smaller station takes the remainder.
  const full = Math.floor(inverters / p.invertersPerStation), rest = inverters % p.invertersPerStation;
  const stationInv = [...Array(full).fill(p.invertersPerStation), ...(rest ? [rest] : [])];
  const stations = stationInv.map((n, i) => ({ id: `S${i + 1}`, inverters: n, kva: n * p.inverterKVA,
    mva: up(central ? CENTRAL_MVA : STATION_MVA, n * p.inverterKVA / 1000) ?? n * p.inverterKVA / 1000 }));
  const combinersPerInverter = central ? Math.ceil(spi / p.stringsPerCombiner) : 0;

  // Feeders: as many stations as both the feeder limit and the cap allow.
  const stMax = Math.max(...stations.map(s => s.kva / 1000));
  const perFeeder = Math.max(1, Math.min(p.stationsPerFeederMax, Math.floor(p.feederLimitMVA / stMax)));
  const nFeeders = Math.ceil(stations.length / perFeeder);
  const cableOpts = { soilKmW: p.soilKmW, kv: kvMv };
  const minArea = faultMinArea(p.faultKA, p.faultS);
  const feeders = [];
  for (let f = 0, k = 0; f < nFeeders; f++) {
    const n = Math.floor(stations.length / nFeeders) + (f < stations.length % nFeeders ? 1 : 0);
    const chain = stations.slice(k, k + n); k += n;
    feeders.push(sizeFeeder(chain, p, cableOpts, minArea));
  }

  // Grid transformers, then feeders packed onto them by load, then board sections of at most N solar ways each.
  const gridTotal = mw * p.gridFactor;
  const grid = kvPoc === kvMv ? { units: 0, mva: null, smallest: false } : gridChoice(mw, gridTotal, p.gridUnits, feeders);
  const { units: gridUnits, mva: gridMVA } = grid;
  const txOf = pack(feeders, Math.max(1, gridUnits));
  const sections = [];                                     // [{ tx, feeders: [] }]
  for (let t = 0; t < Math.max(1, gridUnits); t++) {
    const mine = feeders.filter((f, i) => txOf[i] === t), n = Math.max(1, Math.ceil(mine.length / p.feedersPerBoardMax));
    for (let k = 0; k < n; k++) sections.push({ tx: t, feeders: mine.filter((f, j) => j % n === k) });
  }
  const boards = sections.length;
  const nodes = [], links = [];
  const node = (id, kind, label, rating = {}) => nodes.push({ id, kind, label, rating });
  const link = (from, to, kind, kv, mva, extra = {}) => links.push({ from, to, kind, kv, mva: r3(mva), ...extra });
  node('POC', 'poc', `Connection ${kvPoc} kV`, { kv: kvPoc, exportMW: mw });
  if (p.harmonicFilter && gridUnits) { node('HF', 'harmonic-filter', 'Harmonic filter (optional)', { kv: kvPoc }); link('POC', 'HF', 'hv-bus', kvPoc, 0); }
  for (let g = 0; g < gridUnits; g++) {
    node(`GT${g + 1}`, 'grid-transformer', `Grid transformer ${g + 1}: ${gridMVA} MVA ${kvPoc}/${kvMv} kV, ${p.gridBank}`,
      { mva: gridMVA, kv: [kvPoc, kvMv], bank: p.gridBank });
    link('POC', `GT${g + 1}`, 'hv-cable', kvPoc, gridMVA);
  }
  const boardWays = sections.map(x => x.feeders.length), txLoad = new Array(Math.max(1, gridUnits)).fill(0);
  sections.forEach((sec, b) => {
    node(`MVB${b + 1}`, 'switchboard', `${kvMv} kV board section ${b + 1}`, { kv: kvMv, spareWays: p.spareWays });
    if (gridUnits) link(`GT${sec.tx + 1}`, `MVB${b + 1}`, 'mv-bus', kvMv, gridMVA);
    else link('POC', `MVB${b + 1}`, 'mv-cable', kvMv, mw / p.powerFactor);
    if (b) link(`MVB${b}`, `MVB${b + 1}`, 'bus-tie', kvMv, 0, { normallyOpen: true });
    for (const f of sec.feeders) { f.board = `MVB${b + 1}`; txLoad[sec.tx] += f.loadMVA; }
  });
  feeders.forEach(f => {
    const bid = f.board;
    f.chain.forEach((s, k) => {
      node(s.id, 'station', `Station ${s.id.slice(1)}: ${s.inverters} x ${p.inverterKVA} kVA${central ? ' central' : ''}, ${s.mva} MVA`,
        { mva: s.mva, kva: s.kva, inverters: s.inverters, strings: s.inverters * spi, modulesPerString: mps, inverterClass: p.inverterClass,
          ...(central ? { combiners: s.inverters * combinersPerInverter } : {}) });
      node(`R${s.id.slice(1)}`, 'rmu', `Ring main unit ${s.id.slice(1)}`, { kv: kvMv, amps: 630 });
      node(`A${s.id.slice(1)}`, 'aux', `Auxiliary transformer ${s.id.slice(1)}`, {});
      link(`R${s.id.slice(1)}`, s.id, 'station-tee', kvMv, s.mva); link(s.id, `A${s.id.slice(1)}`, 'aux', 0.4, 0);
      const seg = f.segments[k];
      link(k ? `R${f.chain[k - 1].id.slice(1)}` : bid, `R${s.id.slice(1)}`, 'feeder-cable', kvMv, seg.loadMVA,
        { areaMm2: seg.area, lengthM: seg.lengthM });
    });
  });
  if (p.topology === 'ring') for (let i = 0; i + 1 < feeders.length; i += 2) {
    const a = feeders[i].chain.at(-1).id.slice(1), b = feeders[i + 1].chain.at(-1).id.slice(1);
    link(`R${a}`, `R${b}`, 'feeder-cable', kvMv, 0, { normallyOpen: true, areaMm2: feeders[i].segments.at(-1).area, lengthM: p.linkLengthM });
  }

  const check = (name, value, max, min = -Infinity) => ({ name, value: r3(value), min, max, ok: value <= max + 1e-9 && value >= min - 1e-9 });
  const checks = [
    // The string's cold Voc against the system voltage; fewer modules in series is never a fault here (no minimum).
    check(`string cold Voc V (${moduleColdVoc(p).rule}, ${mps} in series)`, mps * moduleColdVoc(p).v, p.systemV),
    central ? check('strings per DC combiner box', Math.ceil(spi / combinersPerInverter), p.stringsPerCombiner, 1)
      : check('strings per inverter (MPPT cap)', spi, sMax, Math.min(p.stringsMin, sMax)),
    check('DC/AC ratio', spi * stringKWp / p.inverterKVA, 1.4, 1.1),
    check('station load / transformer', Math.max(...stations.map(s => s.kva / 1000 / s.mva)), 1),
    check('feeder load MVA', Math.max(...feeders.map(f => f.loadMVA)), p.feederLimitMVA),
    check('cable utilisation (worst segment)', Math.max(...feeders.flatMap(f => f.segments.map(s => s.utilisation))), p.maxUtilisation),
    check('MV voltage drop % (worst feeder)', Math.max(...feeders.map(f => f.dropPct)), p.vdropLimitPct),
    check('solar feeders per board section', Math.max(...boardWays), p.feedersPerBoardMax),
    // 1.0-1.2 x export; above that only when no standard step fits (grid.smallest), and then it is said so.
    check(grid.smallest ? 'grid transformers / export (smallest standard size that carries the load)' : 'grid transformers / export',
      gridUnits ? gridUnits * gridMVA / mw : 1, grid.smallest ? Infinity : 1.2 + 1e-6, 1.0),
    check('load on each grid transformer', gridUnits ? Math.max(...txLoad) / gridMVA : 0, 1)
  ];
  const counts = { modulesPerString: mps, stringsPerInverter: spi, inverters, strings: inverters * spi, modules: inverters * spi * mps,
    stations: stations.length, combiners: inverters * combinersPerInverter, feeders: nFeeders, stationsPerFeederMax: perFeeder, boardSections: boards, gridTransformers: gridUnits };
  const ratings = { collectorKv: kvMv, pocKv: kvPoc, inverterClass: p.inverterClass, inverterKVA: p.inverterKVA, stationMVA: [...new Set(stations.map(s => s.mva))],
    gridMVA, feederLimitMVA: p.feederLimitMVA, faultMinAreaMm2: minArea, acMVA: r3(inverters * p.inverterKVA / 1000),
    dcMWp: r3(counts.strings * stringKWp / 1000), cableSizesMm2: [...new Set(feeders.flatMap(f => f.segments.map(s => s.area)))].sort((a, b) => a - b) };
  return { params: p, counts, ratings, nodes, links, feeders, checks, ok: checks.every(c => c.ok),
    note: 'Generic template from rating rules; illustrative, not a design for any site. Segment lengths are placeholders until set from a layout.' };
}

// Grid transformers: the least total standard MVA that carries the feeders as packed (fewer units on a tie).
// Within 1.0-1.2 x the export where a standard step allows it; below about 40 MW no step does, and the choice is
// flagged as the smallest standard size that carries the load (smallest: true), not forced up or down.
export function gridChoice(mw, total, fixedUnits = null, feeders = []) {
  const loadTotal = feeders.reduce((s, f) => s + f.loadMVA, 0) || total;
  const first = fixedUnits || Math.max(1, Math.ceil(loadTotal / GRID_MVA.at(-1)));
  const maxLoad = n => { const t = pack(feeders, n), load = new Array(n).fill(0);
    feeders.forEach((f, i) => { load[t[i]] += f.loadMVA; }); return feeders.length ? Math.max(...load) : loadTotal / n; };
  let best = null;
  for (let n = first; n <= (fixedUnits || first + 8); n++) {
    const mva = up(GRID_MVA, maxLoad(n));
    if (mva == null) continue;
    if (!best || n * mva < best.units * best.mva - 1e-9) best = { units: n, mva };
  }
  if (!best) best = { units: first, mva: GRID_MVA.at(-1) };
  best.smallest = best.units * best.mva > 1.2 * mw + 1e-9;
  return best;
}

// Feeders onto n transformers: largest first onto the least-loaded one, then single moves and pairwise swaps
// while they lower the heaviest transformer's load. Returns the transformer index per feeder.
export function pack(feeders, n) {
  const load = new Array(n).fill(0), out = new Array(feeders.length);
  feeders.map((f, i) => [f.loadMVA, i]).sort((a, b) => b[0] - a[0]).forEach(([l, i]) => {
    const t = load.indexOf(Math.min(...load)); out[i] = t; load[t] += l;
  });
  const L = i => feeders[i].loadMVA;
  for (let pass = 0, better = true; better && pass < 200; pass++) {
    better = false;
    const hi = load.indexOf(Math.max(...load));
    for (let i = 0; i < out.length && !better; i++) {
      if (out[i] !== hi) continue;
      for (let t = 0; t < n && !better; t++) {
        if (t === hi) continue;
        if (Math.max(load[hi] - L(i), load[t] + L(i)) < load[hi] - 1e-9) {        // move i to t
          load[hi] -= L(i); load[t] += L(i); out[i] = t; better = true; break;
        }
        for (let j = 0; j < out.length; j++) {                                    // swap i with j on t
          if (out[j] !== t || L(j) >= L(i)) continue;
          const d = L(i) - L(j);
          if (Math.max(load[hi] - d, load[t] + d) < load[hi] - 1e-9) {
            load[hi] -= d; load[t] += d; out[i] = t; out[j] = hi; better = true; break;
          }
        }
      }
    }
  }
  return out;
}

// Size each segment of a radial chain from the load it carries, then upsize from the head until the drop is met.
function sizeFeeder(chain, p, cableOpts, minArea) {
  const segments = chain.map((s, k) => {
    const loadMVA = chain.slice(k).reduce((t, x) => t + x.kva / 1000, 0);
    const pick = sizeFor(loadMVA / p.maxUtilisation, { ...cableOpts, minArea }) || { area: SIZES.at(-1) };
    return { loadMVA, area: pick.area, lengthM: k ? p.linkLengthM : p.headLengthM };
  });
  const drop = () => segments.reduce((t, s) => t + dropPercent(s.area, s.lengthM, s.loadMVA, { ...cableOpts, pf: p.powerFactor }), 0);
  for (let guard = 0; drop() > p.vdropLimitPct && guard < 40; guard++) {
    const s = segments.find(x => x.area < SIZES.at(-1));
    if (!s) break;
    // Upsize the segment that saves most drop per step: the most loaded, longest one still below the top size.
    const best = segments.filter(x => x.area < SIZES.at(-1)).sort((a, b) => b.loadMVA * b.lengthM - a.loadMVA * a.lengthM)[0];
    best.area = SIZES[SIZES.indexOf(best.area) + 1];
  }
  for (const s of segments) s.utilisation = s.loadMVA * 1e6 / (Math.sqrt(3) * cableOpts.kv * 1000) / rating(s.area, cableOpts).amps;
  return { chain, segments, loadMVA: segments[0].loadMVA, dropPct: drop() };
}

/**
 * layoutDiagram(d) -> nodes with schematic positions { x, y } in panel units: connection at the top, grid
 * transformers, board sections, then each feeder as a column of ring main units with their stations beside them.
 */
export function layoutDiagram(d) {
  const pos = new Map(), boards = d.nodes.filter(n => n.kind === 'switchboard');
  const byBoard = boards.map(b => d.feeders.filter(f => f.board === b.id));
  let x = 0;
  boards.forEach((b, i) => {
    const w = Math.max(1, byBoard[i].length);
    pos.set(b.id, { x: x + (w - 1) / 2, y: 2 });
    byBoard[i].forEach((f, j) => f.chain.forEach((s, k) => {
      const n = s.id.slice(1);
      pos.set(`R${n}`, { x: x + j, y: 3 + k }); pos.set(s.id, { x: x + j + 0.4, y: 3 + k }); pos.set(`A${n}`, { x: x + j + 0.4, y: 3.4 + k });
    }));
    x += w + 1;
  });
  const gts = d.nodes.filter(n => n.kind === 'grid-transformer');
  gts.forEach((g, i) => { const b = pos.get(`MVB${i + 1}`) || { x: i * 2 }; pos.set(g.id, { x: b.x, y: 1 }); });
  const mid = (Math.max(0, ...[...pos.values()].map(v => v.x))) / 2;
  pos.set('POC', { x: mid, y: 0 }); pos.set('HF', { x: mid + 1, y: 0 });
  return d.nodes.map(n => ({ ...n, ...(pos.get(n.id) || { x: 0, y: 0 }) }));
}
