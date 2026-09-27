// sld-rules.mjs: the generic electrical rules the single-line diagram generator shares (sld-plant.mjs, block-mv.mjs,
// sld-graph.mjs): group factors for circuits sharing a trench, an economic step on top of the technical cable size,
// the switching and protection devices of each functional way, and the assumed impedances and source.
// Every value here is generic practice or a public standard, or is marked assumed. Illustrative, not a design for any
// site. Pure: imports only the cable rating.

import { rating, SIZES } from './cable-rating.mjs';

export const SLD_LABEL = 'Illustrative, not a design for any site.';

// Group factors for 33 kV trefoil circuits laid direct side by side, about 0.4-0.45 m apart: approximate values in the
// style of the IEC 60502-2 annex tables (a rating study replaces them). Index = circuits in the trench.
const GROUP = [1, 1, 0.87, 0.78, 0.73, 0.69, 0.66, 0.64, 0.62];
export const groupFactor = n => GROUP[Math.max(1, Math.min(GROUP.length - 1, Math.round(n) || 1))];

// Economic step (assumed unit costs, not any supplier's): capitalised I2R loss against a cable cost that grows with the
// conductor area. Loss hours and the present-worth factor are generic solar figures; money is in plain cost units.
export const ECONOMIC = Object.freeze({ lossHours: 1100, pricePerMWh: 60, years: 25, rate: 0.06, costPerM: 30, costPerMm2M: 0.09 });
export const PALETTE = Object.freeze([120, 185, 300, 500, 630, 800, 1000]); // a small stock of sizes, not the full series

/**
 * economicSize(technicalArea, mva, lengthM, opts) -> the palette size, at or above the technical size, whose cable cost
 * plus capitalised losses is least. opts: cable-rating options plus { economic }.
 */
export function economicSize(area, mva, lengthM, opts = {}) {
  const e = { ...ECONOMIC, ...(opts.economic || {}) }, kv = opts.kv || 33, I = mva * 1e6 / (Math.sqrt(3) * kv * 1000);
  const pw = (1 - (1 + e.rate) ** -e.years) / e.rate;
  const cost = a => {
    const R = rating(a, opts).R;                               // ohm per metre at the rated temperature (conservative)
    return lengthM * (e.costPerM + e.costPerMm2M * a * 3) + 3 * I * I * R * lengthM * e.lossHours / 1e6 * e.pricePerMWh * pw;
  };
  const list = PALETTE.filter(a => a >= area && SIZES.includes(a));
  if (!list.length) return area;
  return list.reduce((best, a) => (cost(a) < cost(best) - 1e-9 ? a : best), list[0]);
}

// Devices of each functional way, as the diagram draws them (state: closed unless marked open).
export const DEVICES = Object.freeze({
  'rmu-in': ['switch-disconnector', 'earth-switch'],
  'rmu-out': ['switch-disconnector', 'earth-switch'],
  'rmu-tx': ['circuit-breaker', 'protection 50/51 50N/51N', 'earth-switch'],
  'lv-main': ['main breaker', 'insulation monitor', 'surge protection', 'meter'],
  'lv-way': ['breaker'],                                       // one per inverter; no local isolator at the inverter end
  'mv-way': ['vacuum circuit breaker', 'protection 50/51 50N/51N', 'earth-switch'],
  'mv-incomer': ['vacuum circuit breaker', 'protection 51 87T'],
  'bus-tie': ['vacuum circuit breaker (normally open)'],
  'hv-bay': ['disconnector', 'earth switch', 'surge arresters', 'current and voltage transformers'],
  'gis-bay': ['gas-insulated circuit breaker', 'disconnector', 'earth switch'],
  'earthing': ['earthing transformer (zigzag)', 'neutral earthing resistor']
});

// Isolation at the inverter from every source that feeds it (BS 7671 537 and 712.537; IEC 62548-1 isolation clauses):
// each source present needs a named means of isolation at the inverter. Defaults as the diagram draws them: the PV side's
// DC switch-disconnector is taken from the inverter's datasheet (assumed); the AC side has only the board breaker, no
// local isolator at the inverter end; no BESS. A plain check with editable inputs, not a design.
export const INVERTER_ISOLATION = Object.freeze({ pv: 'DC switch-disconnector in the inverter (datasheet, assumed)', grid: null, bess: undefined });
export function isolationChecks(at = INVERTER_ISOLATION) {
  const WORDS = { pv: 'PV (DC)', grid: 'grid (AC)', bess: 'battery (BESS)' };
  return Object.entries(WORDS).filter(([k]) => at[k] !== undefined).map(([k, w]) => ({ source: w, ok: !!at[k], device: at[k] || 'none at the inverter' }));
}

// Assumed impedances and the grid source. Transformer impedances sit inside the usual ranges (station 6-10 %).
export const SLD_DEFAULTS = Object.freeze({
  sBaseMVA: 100, c: 1.1,                       // IEC 60909 voltage factor for maximum fault current
  sourceKA: null, sourceXR: 14,                // grid fault level at the landing: set, or by voltage below (assumed)
  sourceKAByKv: { 400: 40, 275: 40, 132: 25, 33: 12.5 },
  stZPct: 7, stXR: 10, stVector: 'Dy11y11',    // station transformer, one unit with a list of LV windings
  gtZPct: 14, gtXR: 40, gtVector: 'YNd11', gtHvNeutral: 'solid', gtTwoLvFromMVA: 120,
  tapRange: 0.10, tapStep: 0.0125, tapTarget: 1.0,  // grid transformer on-load tap changer (illustrative, editable)
  hvCableOhmKm: [0.012, 0.19],                 // single-core HV cable, large copper (assumed)
  ohlOhmKm: [0.03, 0.3],                       // overhead line option (assumed)
  lvXOhmKm: 0.08,                              // single-core LV cable reactance (assumed)
  busPu: [1e-6, 1e-5],                         // busbars and closed switching devices
  nerA: 1000, powerFactor: 0.95,               // NER limit (assumed); export at 0.95 for the drop (reactive duty)
  module: { w: 660, vmp: 38.6, imp: 17.1, voc: 45.9 }, dcAreaMm2: 6, dcOhmKm20: 3.08, dcTempC: 70
});

/** Complex numbers as [re, im]: the few operations the solvers need. */
export const C = Object.freeze({
  add: (a, b) => [a[0] + b[0], a[1] + b[1]], sub: (a, b) => [a[0] - b[0], a[1] - b[1]],
  mul: (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]],
  div: (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; },
  conj: a => [a[0], -a[1]], abs: a => Math.hypot(a[0], a[1])
});

/** An impedance of |z| per unit at ratio X/R, as [r, x]. */
export const zOf = (mag, xr) => { const r = mag / Math.sqrt(1 + xr * xr); return [r, r * xr]; };

// Every electrical readout ends with this line (earthing, the single-line diagram, Follow, the check HUD's working).
export { ELEC_FOOTER } from './elec-style.mjs';   // one source for the words

// Quantities by the one number rule (measure-format.mjs): significant figures, one dash for none.
export { fmtQ } from './measure-format.mjs';
