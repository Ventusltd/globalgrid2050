// earth-pv.mjs: PV array earthing, bonding, earth-fault and surge checks for an early solar block design (world cartridge,
// loaded only by earth-mount.mjs on the first earthing command). ILLUSTRATIVE, EARLY DESIGN ONLY, NO WARRANTY: textbook
// physics and labelled assumptions the user can change; not a design, not a calculation to any standard, not a substitute
// for an earthing study, a lightning risk assessment or a qualified engineer's sign-off.
// What it works out (methods cited by number and clause only; no table, figure or sentence of any standard is copied):
//   adiabatic conductor rule, k from the metal's physics (BS 7671 543.1.3, IEC 60364-5-54, IEC 60949);
//   LV earth-fault loop and touch voltage at an inverter (BS 7671 Ch. 41, 411.4, 411.6; IEC 60364-4-41; IEC 60909-0 source);
//   DC array insulation and capacitance to earth (IEC 62548-1 6.4.3; IEC TS 62738 6.4): trip thresholds are inputs, not shipped;
//   functional earth conductor (IEC 62548-1 7.3.2.4.4, 6.4.3.5); bonding mesh (IEC 62548-1 7.3.2; IEC TS 62738 6.5.1);
//   electrodes: rod (Dwight 1936), mesh (Laurent-Niemann, Sverak 1984), all piles in parallel with mutual resistance;
//   DC surge critical length (IEC 62548-1 6.6.2.2, coefficient an input) and collection area (IEC 62305-2 Annex A).
// Where a check needs a limit only a standard's table gives, the limit is an input with no default. Pure: no imports, no DOM.

export const LABEL = 'Illustrative, early design only, no warranty. Confirm with a qualified engineer.';

const PI = Math.PI, MU0 = 4e-7 * Math.PI, SQ3 = Math.sqrt(3);
const isNum = v => typeof v === 'number' && Number.isFinite(v);
const need = (v, what) => { if (!isNum(v)) throw Error(`pv-earthing: ${what} must be a number`); return v; };
const round = (x, d = 3) => (isNum(x) ? Math.round(x * 10 ** d) / 10 ** d : x);

// ---------------------------------------------------------------------------------------------------------------
// Materials: handbook physical properties, not any standard's table.
// rho20: resistivity at 20 C, ohm.m; beta: reciprocal temperature coefficient at 0 C, K (1/alpha20 - 20);
// heatCap: volumetric heat capacity, J/(K.m3).
export const METAL = Object.freeze({
  cu: Object.freeze({ name: 'copper', rho20: 1.7241e-8, beta: 234.5, heatCap: 3.45e6 }),
  al: Object.freeze({ name: 'aluminium', rho20: 2.8264e-8, beta: 228, heatCap: 2.5e6 }),
  steel: Object.freeze({ name: 'galvanised steel', rho20: 1.38e-7, beta: 202, heatCap: 3.8e6 })
});
const metal = m => { const x = typeof m === 'string' ? METAL[m] : m; if (!x) throw Error(`pv-earthing: unknown metal ${m}`); return x; };

/** Conductor resistance per metre (ohm/m) at theta C, from resistivity and area (mm2); `factor` covers stranding. */
export function rPerM(areaMm2, theta, m = 'cu', factor = 1.0) {
  const x = metal(m);
  return factor * x.rho20 * (x.beta + theta) / (x.beta + 20) / (need(areaMm2, 'area') * 1e-6);
}

// ---------------------------------------------------------------------------------------------------------------
// Adiabatic conductor rule. Heat balance in the fault time with no heat lost:
//   heatCap * A * dtheta = I^2 * rho(theta) / A * dt,  rho(theta) = rho20 (beta + theta) / (beta + 20)
// integrates to  I^2 t = k^2 A^2  with  k^2 = heatCap (beta + 20) / rho20 * ln((beta + thetaF) / (beta + thetaI)).

/** k in A.s^0.5/mm2 for a metal between an initial and a final temperature (C). */
export function adiabaticK(m, thetaI, thetaF) {
  const x = metal(m);
  if (!(thetaF > thetaI)) throw Error('pv-earthing: final temperature must exceed the initial one');
  return Math.sqrt(x.heatCap * (x.beta + 20) / x.rho20 * Math.log((x.beta + thetaF) / (x.beta + thetaI))) / 1e6;
}

/** Least area (mm2) that carries I (A) for t (s) from thetaI to at most thetaF. */
export function adiabaticMinArea(I, t, m, thetaI, thetaF) {
  return need(I, 'current') * Math.sqrt(need(t, 'time')) / adiabaticK(m, thetaI, thetaF);
}

/** Final temperature (C) of area A (mm2) after I (A) for t (s), starting at thetaI. */
export function adiabaticFinalC(I, t, areaMm2, m, thetaI) {
  const x = metal(m), A = areaMm2 * 1e-6;
  return (x.beta + thetaI) * Math.exp(I * I * t * x.rho20 / (x.heatCap * (x.beta + 20) * A * A)) - x.beta;
}

// ---------------------------------------------------------------------------------------------------------------
// LV earth-fault loop: station transformer LV winding -> inverter AC circuit, return in the protective conductor.

export const LV_DEFAULTS = Object.freeze({
  // system (assumed; the owner's block: two 800 V windings on a 10 MVA station transformer, 14 inverters each)
  system: 'TN',              // 'TN': winding star point earthed at the station; 'IT': not earthed (IMD on the winding)
  volts: 800,                // line voltage, V
  cMin: 0.95,                // voltage factor for the least fault current (assumed, after the IEC 60909-0 idea)
  mvFaultMVA: 1143,          // 33 kV source fault level, MVA (assumed: 20 kA at 33 kV)
  mvXR: 10,                  // source X/R (assumed)
  windingMVA: 5,             // rating of one LV winding, MVA (assumed: half of 10 MVA)
  ukPct: 7,                  // winding short-circuit impedance on its own rating, % (assumed)
  txXR: 12,                  // transformer X/R (assumed)
  z0Ratio: 1.0,              // transformer zero-sequence / positive-sequence impedance (assumed; Dyn core type)
  // circuit (assumed; matches the LV AC defaults of the trench work: 3 x 400 mm2 Al single-core, trefoil)
  lengthM: 250,
  phaseMm2: 400, phaseMetal: 'al', phaseFactor: 1.02,
  cpcMm2: 120, cpcMetal: 'cu', cpcFactor: 1.02,
  thetaC: 90,                // conductor temperature assumed at the fault (the hot, least-current case)
  spacingM: 0.06,            // centre distance phase conductor to protective conductor, m (assumed laying)
  freq: 50,
  // protective device (assumed; enter the chosen device's own data)
  inA: 280,                  // device rating, A
  tripMultiple: 10,          // instantaneous pick-up as a multiple of In (assumed, adjustable MCCB)
  clearS: 0.1,               // clearing time used for the adiabatic check, s (assumed)
  // IT first fault
  cPerPhaseUF: 2.0           // total capacitance to earth per phase of the whole winding's system, uF (assumed)
});

/** Loop inductance per metre of a go-and-return pair: mu0/pi * ln(s / sqrt(GMR1 GMR2)), GMR = e^-1/4 r (solid). */
export function loopInductancePerM(a1Mm2, a2Mm2, spacingM) {
  const gmr = a => Math.exp(-0.25) * Math.sqrt(a * 1e-6 / PI);
  return MU0 / PI * Math.log(spacingM / Math.sqrt(gmr(a1Mm2) * gmr(a2Mm2)));
}

/** Source impedances at the LV terminals, ohm: { r1, x1, r0, x0 } (grid + transformer; delta HV blocks grid Z0). */
export function sourceSequence(p) {
  const U = p.volts, zg = 1.1 * U * U / (p.mvFaultMVA * 1e6), zt = p.ukPct / 100 * U * U / (p.windingMVA * 1e6);
  const split = (z, xr) => { const r = z / Math.sqrt(1 + xr * xr); return [r, r * xr]; };
  const [rg, xg] = split(zg, p.mvXR), [rt, xt] = split(zt, p.txXR);
  return { r1: rg + rt, x1: xg + xt, r0: p.z0Ratio * rt, x0: p.z0Ratio * xt };
}

/**
 * lvEarthFault(opts) -> { Zs, Rs, Xs, Ief, Ia, disconnects, touchV, cpcMinMm2, cpcFinalC, maxLengthM, ... }
 * TN: Zs = source loop (2 Z1 + Z0)/3 + cable loop; Ief = cMin U0 / |Zs|.
 * IT: first fault current = 3 w C U0 (capacitive; alarm by IMD, no disconnection); second fault on another
 *     phase at a like circuit: current = cMin U / (2 |Zcable loop| + |2 Z1 source|), the double-loop idea.
 */
export function lvEarthFault(opts = {}) {
  const p = { ...LV_DEFAULTS, ...opts }, w = 2 * PI * p.freq, U0 = p.volts / SQ3, L = need(p.lengthM, 'length');
  const s = sourceSequence(p);
  const rp = rPerM(p.phaseMm2, p.thetaC, p.phaseMetal, p.phaseFactor), rc = rPerM(p.cpcMm2, p.thetaC, p.cpcMetal, p.cpcFactor);
  const xl = w * loopInductancePerM(p.phaseMm2, p.cpcMm2, p.spacingM);
  const cable = { r: (rp + rc) * L, x: xl * L };
  const Ia = p.inA * p.tripMultiple;
  const cpcZ = Math.hypot(rc * L, xl * L / 2);   // CPC's share of the loop (half the loop reactance, assumed)
  let out;
  if (p.system === 'IT') {
    const Ifirst = 3 * w * p.cPerPhaseUF * 1e-6 * U0;
    const R2 = 2 * cable.r + 2 * s.r1, X2 = 2 * cable.x + 2 * s.x1, Z2 = Math.hypot(R2, X2);
    const Ief = p.cMin * p.volts / Z2;
    out = { system: 'IT', firstFaultA: Ifirst, Rs: R2, Xs: X2, Zs: Z2, Ief, maxLengthM: maxLen(p, Ia, s, rp, rc, xl, true) };
  } else {
    const Rs = (2 * s.r1 + s.r0) / 3 + cable.r, Xs = (2 * s.x1 + s.x0) / 3 + cable.x, Zs = Math.hypot(Rs, Xs);
    out = { system: 'TN', Rs, Xs, Zs, Ief: p.cMin * U0 / Zs, maxLengthM: maxLen(p, Ia, s, rp, rc, xl, false) };
  }
  const cpcMin = adiabaticMinArea(out.Ief, p.clearS, p.cpcMetal, p.thetaC, 250);
  return { ...out, U0, source: s, cable, Ia, disconnects: out.Ief >= Ia,
    touchV: out.Ief * cpcZ, cpcMinMm2: cpcMin, cpcFinalC: adiabaticFinalC(out.Ief, p.clearS, p.cpcMm2, p.cpcMetal, p.thetaC),
    cpcOk: p.cpcMm2 >= cpcMin, assumed: p, label: LABEL };
}

// Longest circuit whose least fault current still reaches Ia: |Zsrc + L z| = cMin U / Ia, a quadratic in L.
function maxLen(p, Ia, s, rp, rc, xl, it) {
  const Zmax = p.cMin * (it ? p.volts : p.volts / SQ3) / Ia;
  const a = it ? 2 : 1;
  const r0 = it ? 2 * s.r1 : (2 * s.r1 + s.r0) / 3, x0 = it ? 2 * s.x1 : (2 * s.x1 + s.x0) / 3;
  const zr = a * (rp + rc), zx = a * xl;
  // (r0 + L zr)^2 + (x0 + L zx)^2 = Zmax^2
  const A = zr * zr + zx * zx, B = 2 * (r0 * zr + x0 * zx), C = r0 * r0 + x0 * x0 - Zmax * Zmax;
  if (C >= 0) return 0;
  return (-B + Math.sqrt(B * B - 4 * A * C)) / (2 * A);
}

// ---------------------------------------------------------------------------------------------------------------
// DC array insulation to earth, first-fault body current, capacitive leakage.

export const ARRAY_DEFAULTS = Object.freeze({
  moduleWp: 600, moduleAreaM2: 2.6,
  isoMOhmM2: 40,             // insulation of a module to its frame, wet, per unit area, Mohm.m2 (assumed, a typical
                             // pass level of module wet-leakage tests; measured site values are often higher)
  cableKm: 0,                // DC cable length (both poles), km, and its insulation to earth (assumed)
  cableIsoMOhmKm: 1000,
  capNFperKWp: 100,          // array capacitance to earth, nF per kWp, wet glass modules (assumed; 50-150 is typical)
  uocMax: 1500,              // largest array voltage, V
  bodyOhm: 1000              // body resistance used for an illustrative contact current, ohm (assumed)
});

/** Healthy insulation resistance (ohm) and capacitance (F) of an array of `kWp` to earth. */
export function arrayInsulation(kWp, opts = {}) {
  const p = { ...ARRAY_DEFAULTS, ...opts };
  const areaM2 = need(kWp, 'kWp') * 1000 / p.moduleWp * p.moduleAreaM2;
  const gModules = areaM2 / (p.isoMOhmM2 * 1e6);
  const gCables = p.cableKm > 0 ? p.cableKm / (p.cableIsoMOhmKm * 1e6) : 0;
  return { kWp, areaM2, risoOhm: 1 / (gModules + gCables), capF: kWp * p.capNFperKWp * 1e-9, assumed: p };
}

/**
 * insulationCheck(risoOhm, { tripKOhm, warnKOhm }) -> state words. tripKOhm has NO default: enter it from
 * IEC 62548-1:2023 6.4.3.2 (Table 2) for the array rating seen by each monitoring device, or a higher value.
 * A healthy array reading under the trip level means nuisance trips: split the array (per inverter) or review.
 */
export function insulationCheck(risoOhm, { tripKOhm, warnKOhm } = {}) {
  if (!isNum(tripKOhm)) return { state: 'no-threshold', words: 'enter the trip threshold from the cited clause' };
  const r = risoOhm / 1000;
  const state = r < tripKOhm ? 'below-trip' : isNum(warnKOhm) && r < warnKOhm ? 'below-warning' : 'above';
  const words = { 'below-trip': 'a healthy wet array reads below the trip level at these assumptions',
    'below-warning': 'a healthy wet array reads between the warning and trip levels at these assumptions',
    above: 'a healthy wet array reads above the set levels at these assumptions' }[state];
  return { state, words, readKOhm: r, tripKOhm, warnKOhm: warnKOhm ?? null };
}

/** Illustrative steady current through a person touching one pole of a floating array: U / (Rbody + Riso). */
export function bodyCurrentFirstFault(risoOhm, opts = {}) {
  const p = { ...ARRAY_DEFAULTS, ...opts };
  return p.uocMax / (p.bodyOhm + risoOhm);
}

/** Capacitive leakage current (A rms) of an array driven by a common-mode ripple of vcmRms (V) at f (Hz). */
export function capacitiveLeakage(capF, vcmRms, f = 150) { return 2 * PI * f * capF * vcmRms; }

/** Residual-current comparison: limitA has NO default (IEC 62548-1 6.4.3.4 gives the rule; not reproduced). */
export function residualCheck(leakA, limitA) {
  if (!isNum(limitA)) return { state: 'no-limit', words: 'enter the residual current limit from the cited clause' };
  return { state: leakA < limitA ? 'below' : 'at-or-above', leakA, limitA,
    words: leakA < limitA ? 'steady leakage below the entered limit at these assumptions'
      : 'steady leakage at or above the entered limit at these assumptions: split the monitoring or review' };
}

/**
 * Functional (or high-ohmic) earth of one pole: IEC 62548-1 7.3.2.4.4 asks the conductor to carry the lesser of
 * the fault-interrupting device's rating and Umax / R. Also the resistor's power on a hard fault of the other pole.
 */
export function functionalEarthConductor({ uocMax = 1500, resistorOhm = null, deviceA = null } = {}) {
  const viaR = isNum(resistorOhm) && resistorOhm > 0 ? uocMax / resistorOhm : Infinity;
  const viaDev = isNum(deviceA) ? deviceA : Infinity;
  const carryA = Math.min(viaR, viaDev);
  return { carryA: isNum(carryA) ? carryA : null, resistorFaultW: isNum(viaR) ? uocMax * uocMax / resistorOhm : null,
    words: isNum(carryA) ? `the functional earth conductor carries at least ${round(carryA, 3)} A` : 'enter a resistor or device rating' };
}

// ---------------------------------------------------------------------------------------------------------------
// Equipotential bonding of frames and structures: a buried mesh along and across the table rows.

export const BONDING_DEFAULTS = Object.freeze({
  meshM: 20,                 // design choice: cross-bond spacing along the rows; IEC TS 62738 6.5.1 shows a mesh of
                             // this order as an example and says a soil study sets it
  designMinCuMm2: 16,        // design choice for buried bare copper, for mechanical robustness; check against
                             // IEC 62548-1 7.3.2.2, IEC 62305-3 and IEC 60364-5-54 (limits not reproduced)
  faultA: 0, clearS: 0.5,    // current the bond may carry and for how long (0: not a fault path)
  metal: 'cu', thetaI: 30, thetaF: 200
});

/** Bonding mesh for `rows` table rows of length rowLengthM at pitch rowPitchM. */
export function bondingPlan({ rows, rowLengthM, rowPitchM, ...opts }) {
  const p = { ...BONDING_DEFAULTS, ...opts };
  need(rows, 'rows'); need(rowLengthM, 'row length'); need(rowPitchM, 'row pitch');
  const across = Math.max(2, Math.ceil(rowLengthM / p.meshM) + 1);     // cross conductors (perpendicular to rows)
  const runsAlong = Math.max(2, Math.ceil(rows * rowPitchM / p.meshM) + 1);
  const width = (rows - 1) * rowPitchM;
  const lengthM = across * width + runsAlong * rowLengthM;
  const adiabatic = p.faultA > 0 ? adiabaticMinArea(p.faultA, p.clearS, p.metal, p.thetaI, p.thetaF) : 0;
  const sizeMm2 = Math.max(p.designMinCuMm2, adiabatic);
  return { across, runsAlong, meshM: [rowLengthM / (across - 1), width / Math.max(1, runsAlong - 1)],
    lengthM, bonds: across * rows, sizeMm2, adiabaticMm2: adiabatic, areaM2: width * rowLengthM, assumed: p };
}

// ---------------------------------------------------------------------------------------------------------------
// Electrodes. Soil taken as uniform (one resistivity) until a survey says otherwise.

/** Dwight's formula for a vertical rod or pile of length L (m), diameter d (m), top at the surface. */
export function rodResistance(rhoOhmM, L, d) { return rhoOhmM / (2 * PI * L) * (Math.log(8 * L / d) - 1); }

/**
 * Mutual resistance of two parallel vertical rods of length L at spacing s, each carrying a uniform current,
 * by averaging the potential of one along the other (with the ground-surface image):
 *   Rm = rho / (4 pi L^2) * [2L asinh(2L/s) - sqrt(4L^2 + s^2) + s]
 * At s = rod radius this gives the rod's own resistance (Dwight's formula for L >> d).
 */
export function mutualRodResistance(rhoOhmM, L, s) {
  return rhoOhmM / (4 * PI * L * L) * (2 * L * Math.asinh(2 * L / s) - Math.sqrt(4 * L * L + s * s) + s);
}

/** Buried mesh or ring of area A (m2), total conductor Ltot (m), depth h (m): Laurent-Niemann and Sverak forms. */
export function meshResistance(rhoOhmM, A, Ltot, h = 0.6) {
  const laurent = rhoOhmM / 4 * Math.sqrt(PI / A) + rhoOhmM / Ltot;
  const sverak = rhoOhmM * (1 / Ltot + 1 / Math.sqrt(20 * A) * (1 + 1 / (1 + h * Math.sqrt(20 / A))));
  return { laurent, sverak };
}

/** Pile positions of a block: rows of tables; returns [{x, y}] in metres. */
export function pileLayout({ rows, tablesPerRow, tableLengthM, tableGapM = 1, pilesPerTable, rowPitchM }) {
  const out = [], step = tableLengthM / Math.max(1, pilesPerTable - 1);
  for (let r = 0; r < rows; r++) for (let t = 0; t < tablesPerRow; t++) {
    const x0 = t * (tableLengthM + tableGapM);
    for (let k = 0; k < pilesPerTable; k++) out.push({ x: x0 + (pilesPerTable > 1 ? k * step : tableLengthM / 2), y: r * rowPitchM });
  }
  return out;
}

/**
 * All piles in parallel, joined by the bonding (equipotential): R = 1 / (1' Rm^-1 1), Rm the mutual resistance
 * matrix. Dense Cholesky: fine up to about a thousand piles in the page; the GPU pair check runs whole blocks.
 */
export function pilesResistance(piles, { rhoOhmM = 100, L = 1.8, d = 0.1 } = {}) {
  const n = piles.length;
  if (!n) throw Error('pv-earthing: no piles');
  if (n > 1500) throw Error('pv-earthing: more than 1500 piles; use the area estimate or the GPU study');
  const M = new Float64Array(n * n), a = d / 2;
  for (let i = 0; i < n; i++) for (let j = i; j < n; j++) {
    const s = i === j ? a : Math.hypot(piles[i].x - piles[j].x, piles[i].y - piles[j].y);
    M[i * n + j] = M[j * n + i] = mutualRodResistance(rhoOhmM, L, s);
  }
  for (let j = 0; j < n; j++) {                                   // Cholesky, in place (lower)
    let dsum = M[j * n + j];
    for (let k = 0; k < j; k++) dsum -= M[j * n + k] ** 2;
    if (!(dsum > 0)) throw Error('pv-earthing: pile matrix not positive definite');
    const ljj = Math.sqrt(dsum); M[j * n + j] = ljj;
    for (let i = j + 1; i < n; i++) {
      let s = M[i * n + j];
      for (let k = 0; k < j; k++) s -= M[i * n + k] * M[j * n + k];
      M[i * n + j] = s / ljj;
    }
  }
  const y = new Float64Array(n).fill(1);
  for (let i = 0; i < n; i++) { let s = y[i]; for (let k = 0; k < i; k++) s -= M[i * n + k] * y[k]; y[i] = s / M[i * n + i]; }
  for (let i = n - 1; i >= 0; i--) { let s = y[i]; for (let k = i + 1; k < n; k++) s -= M[k * n + i] * y[k]; y[i] = s / M[i * n + i]; }
  let sum = 0; for (let i = 0; i < n; i++) sum += y[i];
  const single = mutualRodResistance(rhoOhmM, L, a);
  return { ohm: 1 / sum, single, n, utilisation: single / n / (1 / sum) };  // utilisation: ideal parallel / actual
}

// ---------------------------------------------------------------------------------------------------------------
// Lightning and surges.

/**
 * dcSpdNeed({ routeM, ng, coefficient }): the critical-length comparison of IEC 62548-1 6.6.2.2. Lcrit =
 * coefficient / Ng; the coefficient depends on the installation type and has NO default here (enter it from the
 * cited clause). routeM: longest exposed DC route between inverter and modules (buried or screened lengths out).
 */
export function dcSpdNeed({ routeM, ng, coefficient } = {}) {
  if (!isNum(coefficient)) return { state: 'no-coefficient', words: 'enter the critical-length coefficient from the cited clause' };
  const lcrit = coefficient / need(ng, 'ground flash density');
  const needSpd = need(routeM, 'route length') >= lcrit;
  return { state: needSpd ? 'spd' : 'none-by-this-test', lcritM: lcrit, routeM,
    words: needSpd ? 'route at or over the critical length: DC surge devices at these assumptions'
      : 'route under the critical length at these assumptions; surge devices may still be chosen' };
}

/** Collection area (m2) of an isolated box-shaped structure L x W x H, the IEC 62305-2 Annex A construction. */
export function collectionArea(L, W, H) { return L * W + 2 * 3 * H * (L + W) + PI * (3 * H) ** 2; }

/** Expected dangerous flashes per year to it: Ng (per km2 per year) x area x location factor. */
export function flashesPerYear(ng, areaM2, locationFactor = 1) { return ng * areaM2 * locationFactor * 1e-6; }

// ---------------------------------------------------------------------------------------------------------------
// The owner's 10 MVA block, in one call.

export const BLOCK_DEFAULTS = Object.freeze({
  inverters: 28, inverterKVA: 350, dcAcRatio: 1.25, moduleWp: 600, modulesPerTable: 56,
  rows: 24, tablesPerRow: 16, tableLengthM: 33, pilesPerTable: 6, rowPitchM: 10,
  rhoOhmM: 100, pileL: 1.8, pileD: 0.1, meshDepthM: 0.6,
  ng: 0.5,                   // ground flash density, flashes/km2/yr (assumed, a low-lightning inland site)
  lengthsM: [60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360, 390, 420, 450]  // one winding's 14 circuits
});

/** blockEarthing(opts) -> the checks above for the whole block; `limits` carries user-entered standard limits. */
export function blockEarthing(opts = {}, limits = {}) {
  const b = { ...BLOCK_DEFAULTS, ...opts };
  const kWpBlock = b.inverters * b.inverterKVA * b.dcAcRatio, kWpInv = b.inverterKVA * b.dcAcRatio;
  const invIso = arrayInsulation(kWpInv, { moduleWp: b.moduleWp }), blockIso = arrayInsulation(kWpBlock, { moduleWp: b.moduleWp });
  const circuits = b.lengthsM.map(L => ({ lengthM: L, ...pick(lvEarthFault({ ...(b.lv || {}), lengthM: L })) }));
  const worst = circuits.reduce((w, c) => (c.Ief < w.Ief ? c : w));
  const rowLen = b.tablesPerRow * (b.tableLengthM + 1);
  const bond = bondingPlan({ rows: b.rows, rowLengthM: rowLen, rowPitchM: b.rowPitchM, faultA: worst.Ief, clearS: (b.lv || {}).clearS ?? LV_DEFAULTS.clearS });
  const mesh = meshResistance(b.rhoOhmM, bond.areaM2, bond.lengthM, b.meshDepthM);
  const piles = pileLayout(b);
  return {
    label: LABEL, kWpBlock, kWpInverter: kWpInv, piles: piles.length,
    insulation: { perInverter: invIso, wholeBlock: blockIso,
      perInverterCheck: insulationCheck(invIso.risoOhm, limits.imd || {}),
      bodyCurrentA: bodyCurrentFirstFault(invIso.risoOhm) },
    circuits, worst, bonding: bond, mesh,
    singlePileOhm: rodResistance(b.rhoOhmM, b.pileL, b.pileD),
    spd: dcSpdNeed({ routeM: limits.dcRouteM ?? 0, ng: b.ng, coefficient: limits.lcritCoefficient }),
    assumed: b
  };
}
const pick = r => ({ Zs: r.Zs, Ief: r.Ief, Ia: r.Ia, disconnects: r.disconnects, touchV: r.touchV,
  cpcMinMm2: r.cpcMinMm2, cpcOk: r.cpcOk, maxLengthM: r.maxLengthM });

// ---------------------------------------------------------------------------------------------------------------
// Words for the Check HUD and the single-line diagram. Neutral: says what the numbers show at the assumptions.

export function readout(block) {
  const w = block.worst, ins = block.insulation, rows = [];
  const row = (group, what, value, unit, words, cite) => rows.push({ group, what, value: round(value, 3), unit, words, cite });
  row('LV earth fault', 'least earth-fault current (longest circuit)', w.Ief / 1000, 'kA',
    w.disconnects ? 'reaches the device pick-up at these assumptions' : 'below the device pick-up at these assumptions',
    'BS 7671 411.4; IEC 60364-4-41');
  row('LV earth fault', 'loop impedance, longest circuit', w.Zs * 1000, 'mOhm', `longest circuit that still reaches pick-up: ${round(w.maxLengthM, 0)} m`, 'BS 7671 411.4.4');
  row('LV earth fault', 'prospective touch voltage at the inverter', w.touchV, 'V',
    'local bonding of inverter frame, structure and pile keeps the touch voltage down; check disconnection time', 'BS 7671 411.3.1.2');
  row('Protective conductor', 'least area by the adiabatic rule', w.cpcMinMm2, 'mm2',
    w.cpcOk ? 'chosen size is larger at these assumptions' : 'chosen size is smaller at these assumptions', 'BS 7671 543.1.3');
  row('DC insulation', 'healthy wet insulation, one inverter\'s array', ins.perInverter.risoOhm / 1000, 'kOhm', ins.perInverterCheck.words, 'IEC 62548-1 6.4.3.2');
  row('DC insulation', 'the same if the whole block were one array', ins.wholeBlock.risoOhm / 1000, 'kOhm', 'why each inverter monitors its own array', 'IEC TS 62738 6.4');
  row('DC insulation', 'capacitance to earth, one inverter\'s array', ins.perInverter.capF * 1e6, 'uF', 'compare with the monitoring device\'s capacitance rating', 'IEC 62548-1 6.4.3.2');
  row('Bonding', 'bonding mesh conductor, total length', block.bonding.lengthM, 'm',
    `${block.bonding.across} cross runs, ${block.bonding.runsAlong} runs along, ${round(block.bonding.sizeMm2, 1)} mm2 Cu`, 'IEC 62548-1 7.3.2; IEC TS 62738 6.5.1');
  row('Electrodes', 'bonding mesh to earth (Laurent-Niemann)', block.mesh.laurent, 'Ohm', 'uniform soil assumed; a soil survey replaces it', 'IEEE 80 / EN 50522 style formula');
  row('Electrodes', 'one steel pile to earth', block.singlePileOhm, 'Ohm',
    `${block.piles} bonded piles alone come to about the mesh value (area-limited, GPU study); the two together are not much lower`, 'IEC 62305-3 (earth-termination)');
  row('Surges', 'DC surge devices by the critical-length test', null, '', block.spd.words, 'IEC 62548-1 6.6.2.2; IEC 61643-32');
  return { label: LABEL, rows };
}

/** Badges for single-line diagram nodes: { station: [...], inverter: [...] } short strings. */
export function sldBadges(block) {
  const w = block.worst;
  return {
    station: [`LV earthing: ${block.assumed.lv?.system ?? LV_DEFAULTS.system}`, `bond mesh ${round(block.mesh.laurent, 2)} Ohm (assumed soil)`],
    inverter: [`Zs ${round(w.Zs * 1000, 1)} mOhm, Ief ${round(w.Ief / 1000, 2)} kA (longest)`, `DC Riso ${round(block.insulation.perInverter.risoOhm / 1000, 1)} kOhm healthy wet`],
    label: LABEL
  };
}
