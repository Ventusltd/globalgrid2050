// cable-checks.mjs: the Solar block's cable schedule as illustrative checks (Design > Plant > Solar block > Cable checks).
// Per circuit: voltage drop and loading, worked out again from the staged schedule (tools/stage-cable-schedule.mjs)
// at the assumptions chosen in the panel. Every property, rating, factor, spacing and power factor is ASSUMED; the
// numbers are an illustrative check, not a design and not a calculation to any standard. A loading over 100 % is
// said in neutral words ("above 100% at these assumptions"): it is a question about the assumptions, never a verdict.
// Pure: no DOM, no fetch.
//
//   voltage drop, DC string cable   I x L x R(theta)                     (one conductor; % of the string's Vmp)
//   voltage drop, AC phase cable    sqrt(3) x I x L x (R(theta) cos(phi) + X sin(phi))           (% of line volts)
//   R(theta) = R20 x (1 + alpha (theta - 20))
//   loading, AC                     design current / rating of the chosen case (GPU-rated sweep, one rating per case)
//   loading, DC                     design current / (assumed rating in duct x assumed grouping factor), as scheduled

export const CHECK_LABEL = 'Illustrative check, assumptions editable.';
export const AXES = ['size', 'mat', 'inst', 'rho', 'depth', 'nper', 'spacing', 'layers', 'load'];
export const AXIS_WORDS = Object.freeze({
  size: 'Conductor size, mm²', mat: 'Material', inst: 'Installation', rho: 'Soil thermal resistivity, K·m/W', depth: 'Depth to the circuit centres, m',
  nper: 'Circuits per trench', spacing: 'Spacing between circuits, m', layers: 'Layers of circuits', load: 'Load profile'
});
const VALUE_WORDS = { Al: 'aluminium', Cu: 'copper', 'trefoil-direct': 'trefoil, laid direct', 'trefoil-ducted': 'trefoil, each circuit in a duct',
  'flat-spaced': 'flat, one cable width apart', continuous: 'full current all day', solar: 'a solar day (daily cycle)' };
export const valueWords = v => VALUE_WORDS[v] ?? String(v);

// Neutral words for a loading: the only two things this page ever says about one.
export const loadingWords = pct => (!Number.isFinite(pct) ? 'not worked out at these assumptions'
  : pct > 100 ? 'above 100% at these assumptions' : 'within 100% at these assumptions');

const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : NaN);
const rTheta = (r20, alpha, theta) => r20 * (1 + alpha * (theta - 20));
const round = (x, d) => Math.round(x * 10 ** d) / 10 ** d;

// The staged file, checked for shape; throws with a plain reason.
export function parseChecks(doc) {
  if (!doc || doc.schema !== 'world.cable-checks.v1') throw Error('not a cable-checks file (world.cable-checks.v1)');
  for (const k of ['dc', 'ac']) if (!Array.isArray(doc[k]?.rows) || !Array.isArray(doc[k]?.columns)) throw Error(`no ${k} circuits`);
  const a = doc.assumed;
  if (!a?.dc || !a?.ac) throw Error('no assumed cable data');
  const rows = k => doc[k].rows.map(r => Object.fromEntries(doc[k].columns.map((c, i) => [c, r[i]])));
  const cases = doc.cases && AXES.every(k => Array.isArray(doc.cases.axes?.[k])) && Array.isArray(doc.cases.rating_A) ? doc.cases : null;
  return { dc: rows('dc'), ac: rows('ac'), assumed: a, cases, illustrative: String(doc.illustrative || CHECK_LABEL),
    lengths: String(doc.lengths || ''), standards: (doc.standards || []).map(String), sources: doc.sources || [] };
}

// The panel's starting assumptions: the sweep's own baseline, else the first value of every axis; power factor as assumed.
export function defaultChoice(checks) {
  const c = checks.cases, base = c?.baseline || {};
  const out = Object.fromEntries(AXES.map(k => [k, c ? (c.axes[k].includes(base[k]) ? base[k] : c.axes[k][0]) : null]));
  out.size ??= checks.assumed.ac.area_mm2; out.mat ??= checks.assumed.ac.material;
  return { ...out, pf: num(checks.assumed.ac.pf) || 1 };
}

// The rated case for a choice: { rating_A, width_m } or null when the sweep has no such case.
export function caseFor(cases, choice) {
  if (!cases) return null;
  let i = 0;
  for (const k of AXES) {
    const j = cases.axes[k].indexOf(choice[k]);
    if (j < 0) return null;
    i = i * cases.axes[k].length + j;
  }
  const rating = num(cases.rating_A[i]);
  return Number.isFinite(rating) && rating > 0 ? { rating_A: rating, width_m: num(cases.width_m?.[i]) } : null;
}

// AC phase cables at a choice: per circuit length, voltage drop (V and % of line volts) and loading.
export function acChecks(checks, choice) {
  const a = checks.assumed.ac, r20 = num(a.r20_ohm_km?.[choice.mat]?.[choice.size]), alpha = num(a.alpha?.[choice.mat]);
  const pf = Math.min(1, Math.max(0.5, num(choice.pf) || 1)), sin = Math.sqrt(1 - pf * pf);
  const R = rTheta(r20, alpha, num(a.theta_C)), X = num(a.x_ohm_km) || 0, rated = caseFor(checks.cases, choice);
  const circuits = checks.ac.map(c => {
    const vd = Math.sqrt(3) * num(c.current_A) * num(c.length_m) / 1000 * (R * pf + X * sin);
    const loading = rated ? 100 * num(c.design_current_A) / rated.rating_A : NaN;
    return { id: c.id, inverter: c.inverter, phase: c.phase, length_m: num(c.length_m), vd_V: vd, vd_pct: 100 * vd / num(a.volts), loading_pct: loading };
  });
  return { rating_A: rated?.rating_A ?? NaN, width_m: rated?.width_m ?? NaN, r_ohm_km: R, circuits, summary: summarise(circuits) };
}

// DC string cables as scheduled: per circuit voltage drop (% of the string's Vmp) and loading.
export function dcChecks(checks) {
  const d = checks.assumed.dc, R = rTheta(num(d.r20_ohm_km), num(d.alpha), num(d.theta_C)), vmp = num(checks.assumed.string_vmp_V);
  const circuits = checks.dc.map(c => {
    const vd = num(c.current_A) * num(c.length_m) / 1000 * R;
    return { id: c.id, inverter: c.inverter, string: c.string, length_m: num(c.length_m), vd_V: vd, vd_pct: 100 * vd / vmp,
      loading_pct: 100 * num(c.design_current_A) / num(c.rating_A) };
  });
  // A string's drop is both its conductors' (NEG and POS together).
  const strings = new Map();
  for (const c of circuits) { const k = `${c.inverter}:${c.string}`; strings.set(k, (strings.get(k) || 0) + c.vd_pct); }
  const perString = summarise([...strings.values()].map(vd_pct => ({ vd_pct, loading_pct: NaN }))).vd_pct;
  return { r_ohm_km: R, circuits, summary: { ...summarise(circuits), strings: perString } };
}

// Min, median and max of voltage drop and loading, and how many circuits are above 100 % at these assumptions.
export function summarise(circuits) {
  const stat = k => {
    const v = circuits.map(c => c[k]).filter(Number.isFinite).sort((x, y) => x - y);
    return v.length ? { min: v[0], median: v[Math.floor(v.length / 2)], max: v[v.length - 1] } : null;
  };
  return { count: circuits.length, vd_pct: stat('vd_pct'), loading_pct: stat('loading_pct'),
    above100: circuits.filter(c => c.loading_pct > 100).length };
}

// Rows for a table, numbers rounded for the screen.
export const tableRow = c => [c.id, round(c.length_m, 1), round(c.vd_V, 2), round(c.vd_pct, 2), Number.isFinite(c.loading_pct) ? round(c.loading_pct, 1) : null];

// One line for the block's main readout (user test H6): AC and DC loading at the starting assumptions, in the same
// neutral words as the Cable checks fold; no verdict.
export function checkLine(checks, choice = defaultChoice(checks)) {
  const A = acChecks(checks, choice).summary, D = dcChecks(checks).summary, n = x => (Math.round(x * 10) / 10).toFixed(1);
  const part = (what, s) => (s.loading_pct ? `${what} ${n(s.loading_pct.max)} % at most, ${loadingWords(s.loading_pct.max)}`
    + (s.above100 ? ` (${s.above100} of ${s.count})` : '') : `${what} ${loadingWords(NaN)}`);
  return `${part('AC cables', A)} · ${part('DC cables', D)}. Change the assumptions under Cable checks.`;
}
