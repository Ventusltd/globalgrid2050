// lv-dc-sizing.mjs: LV AC and 1.5 kV DC PV cable sizing, with our own code and editable inputs.
//
// What it does
//   rating()       continuous current rating of the hottest cable in a group, by the steady-state heat-balance
//                  METHOD of the IEC 60287 family (losses: IEC 60287-1-1; thermal resistances: IEC 60287-2-1),
//                  with mutual heating of buried cables by superposition of line sources and their images.
//                  Cables in ducts and in free air use textbook heat transfer (horizontal-annulus and horizontal-cylinder
//                  convection correlations, grey-body radiation) instead of any coefficient table.
//   coordinate()   the overload check of BS 7671 Chapter 43 / IEC 60364-4-43: Ib <= In <= Iz and I2 <= 1.45 Iz (buried: bs7671-checks.mjs).
//   voltDrop()     voltage drop from the conductor's own resistance and reactance at its operating temperature
//                  (the BS 7671 Appendix 4 approach of correcting for the real conductor temperature).
//   stringCircuit()   PV string and home-run cables per BS 7671 Section 712 / IEC 60364-7-712 and IEC 62548-1:
//                     string maximum current, reverse fault current, string protection and cable minimum rating.
//   inverterCircuit() inverter AC cable (default 3 x 400 mm2 Al single-core, trefoil, 800 V) grouped in a trench.
//   minSpacing()      the least circuit (or duct) spacing, hence trench width, at which a group still carries its load.
// Licence note: no table, figure or text of BS 7671, IEC 60364-5-52, the IEC 60287 family or ERA 69-30 is copied
// here. Standards are cited by number and clause only. The method is implemented from first principles; every
// material value is a physical property or a labelled assumption the user can change. Tabulated ratings are used
// only as cross-checks outside this code, never shipped. Indicative only: a real design uses the cable maker's data and
// a rating study signed off by a competent designer. Pure: no DOM; the LV fault level comes from fault-level.mjs.

import { transformerFaultKA } from './fault-level.mjs';
import { coldVocOf } from './module-catalogue.mjs';
import { buriedOverload, buriedProtection } from './bs7671-checks.mjs';
const PI = Math.PI, SIGMA = 5.670374419e-8, K0 = 273.15;
// Physical properties of the conductor metals (handbook values, not from any standard's table).
// rho20: resistivity at 20 C (ohm.mm2/m); alpha: temperature coefficient at 20 C; beta: 1/alpha - 20 (K);
// heatCap: volumetric heat capacity (J/K/m3) for the adiabatic fault rule.
export const METAL = Object.freeze({
  cu: Object.freeze({ rho20: 1 / 58, alpha: 0.00393, beta: 234.5, heatCap: 3.45e6 }),
  al: Object.freeze({ rho20: 1 / 35.38, alpha: 0.00403, beta: 228, heatCap: 2.5e6 })
});

// Cable families. Every number is an ASSUMPTION to replace with the maker's datasheet (labelled 'assumed').
// rFactor: measured resistance over pure-metal resistance (stranding, compaction, tinning); kept on the high side.
export const CABLES = Object.freeze({
  // 0.6/1 kV single-core aluminium, XLPE insulated, PVC or PE sheathed, unarmoured (inverter AC runs).
  'lv-al-1c': Object.freeze({ metal: 'al', fill: 0.9, rFactor: 1.10, insulationMm: 2.2, insulationKmW: 3.5,
    sheathMm: null, sheathKmW: 3.5, odMm: 37.4, emissivity: 0.9, maxC: 90, status: 'assumed' }),
  // 1.5 kV DC PV cable, tinned fine-stranded copper (class 5), cross-linked halogen-free insulation and sheath
  // (product family to EN 50618 / IEC 62930). Conductor limit taken as the continuous 90 C, not the 120 C
  // short-term figure, to stay on the safe side.
  'pv-cu-1c': Object.freeze({ metal: 'cu', fill: 0.8, rFactor: 1.18, insulationMm: 0.7, insulationKmW: 5.0,
    sheathMm: null, sheathKmW: 5.0, odMm: 6.6, emissivity: 0.9, maxC: 90, status: 'assumed' })
});

// Site defaults (labelled assumptions, all editable).
export const SITE_DEFAULTS = Object.freeze({
  groundC: 15,        // undisturbed ground temperature at cable depth, summer, Great Britain (assumption)
  soilKmW: 1.2,       // native soil, moist; run 2.0-2.5 for dry sand or drying-out sensitivity
  airC: 30,           // shaded ambient air
  underModuleC: 70,   // air behind the modules where string cables are clipped (conservative)
  ductKmW: 3.5,       // polyethylene duct wall
  freq: 50
});

// ---------------------------------------------------------------------------------------------------------------
// Conductor
/** DC resistance per metre at temperature t (ohm/m). opts.r20OhmPerKm overrides the physical estimate. */
export function rdc(area, t, cable) {
  const m = METAL[cable.metal];
  const r20 = cable.r20OhmPerKm ? cable.r20OhmPerKm / 1000 : m.rho20 / area * cable.rFactor;
  return r20 * (1 + m.alpha * (t - 20));
}

/** AC resistance per metre at temperature t: skin and proximity by the IEC 60287-1-1 (2.1) formulae, round
 *  stranded conductor. For DC (freq 0) it is rdc. sOverD: axial spacing over conductor diameter for proximity. */
export function rac(area, t, cable, { freq = 50, spacingMm = null } = {}) {
  const r = rdc(area, t, cable);
  if (!freq) return r;
  const xs4 = (8 * PI * freq / r * 1e-7) ** 2, ys = xs4 / (192 + 0.8 * xs4);
  const dc = build(area, cable).dc, s = spacingMm || build(area, cable).od, q = dc / s;
  const yp = xs4 / (192 + 0.8 * xs4) * q * q * (0.312 * q * q + 1.18 / (xs4 / (192 + 0.8 * xs4) + 0.27));
  return r * (1 + ys + yp);
}

/** Cable build (mm) from the conductor area and the family; odMm (datasheet) sets the outside. */
export function build(area, cable) {
  const dc = Math.sqrt(4 * area / (PI * cable.fill));
  const di = dc + 2 * cable.insulationMm;
  const od = cable.odMm && cable.odMm > di ? cable.odMm : di + 2 * (cable.sheathMm || 1.8);
  return { dc, di, od, sheath: (od - di) / 2 };
}

/** Adiabatic constant k (A.s^0.5/mm2) for a conductor heated from ti to tf, from its physical properties
 *  (the IEC 60949 formula). Al 90->250 C gives about 94; Cu 90->250 C about 143. */
export function adiabaticK(metal, ti = 90, tf = 250) {
  const m = METAL[metal];
  const K = Math.sqrt(m.heatCap * (m.beta + 20) / (m.rho20 * 1e-6)) * 1e-6;   // A.s^0.5/mm2
  return K * Math.sqrt(Math.log((tf + m.beta) / (ti + m.beta)));
}
// ---------------------------------------------------------------------------------------------------------------
// Heat transfer to air (own physics; no coefficient table)

function air(tC) {                       // dry air near 1 atm, fitted over 0-120 C
  return { k: 0.02424 + 7.9e-5 * tC, nu: 1.32e-5 + 9.2e-8 * tC, pr: 0.71, beta: 1 / (tC + K0) };
}

/** Natural convection from a horizontal cylinder (published correlation, 1975): Nusselt number. */
export function nuCylinder(ra, pr = 0.71) {
  return (0.6 + 0.387 * Math.max(ra, 0) ** (1 / 6) / (1 + (0.559 / pr) ** (9 / 16)) ** (8 / 27)) ** 2;
}

/** Heat per metre (W/m) from a cylinder of diameter dM at ts into still air at ta, convection plus radiation,
 *  less absorbed sun (solarWm2 on the projected width, absorptivity a). */
export function airLoss(dM, ts, ta, { emissivity = 0.9, solarWm2 = 0, absorptivity = 0.6 } = {}) {
  const f = air((ts + ta) / 2), dT = Math.max(ts - ta, 1e-6);
  const ra = 9.81 * f.beta * dT * dM ** 3 / (f.nu * f.nu / f.pr);
  const hc = nuCylinder(ra, f.pr) * f.k / dM;
  const Ts = ts + K0, Ta = ta + K0;
  const qr = emissivity * SIGMA * (Ts ** 4 - Ta ** 4);
  return PI * dM * (hc * dT + qr) - absorptivity * solarWm2 * dM;
}

/** Heat per metre (W/m) across the air annulus between a cable bundle (diameter di, temp ti) and a duct bore
 *  (diameter do, temp to): annulus effective-conductivity correlation plus grey-body radiation. */
export function annulusLoss(di, dOut, ti, to, { e1 = 0.9, e2 = 0.9 } = {}) {
  const f = air((ti + to) / 2), dT = ti - to;
  if (Math.abs(dT) < 1e-9) return 0;
  const lc = (dOut - di) / 2, lnR = Math.log(dOut / di);
  const raL = 9.81 * f.beta * Math.abs(dT) * lc ** 3 / (f.nu * f.nu / f.pr);
  const raC = lnR ** 4 / (lc ** 3 * (di ** -0.6 + dOut ** -0.6) ** 5) * raL;
  const keff = Math.max(f.k, f.k * 0.386 * (f.pr / (0.861 + f.pr)) ** 0.25 * raC ** 0.25);
  const qc = 2 * PI * keff * dT / lnR;
  const qr = PI * di * SIGMA * ((ti + K0) ** 4 - (to + K0) ** 4) / (1 / e1 + (1 - e2) / e2 * di / dOut);
  return qc + qr;
}

// Diameter (in cable diameters) of the circle round m touching equal cables: packing geometry.
const BUNDLE = [0, 1, 2, 2.1547, 2.4142, 2.7013, 3, 3, 3.3048, 3.6131, 3.8130, 3.9238, 4.0296];
export const bundleFactor = m => BUNDLE[m] ?? 1.15 * Math.sqrt(m);    // ~ close packing beyond 12
// ---------------------------------------------------------------------------------------------------------------
// Rating: the hottest cable of a group

/**
 * Geometry helpers. Positions are cable (or duct) centres: x across the trench (m), y depth below ground (m).
 * trefoilRow(n, spacingM, depthM, odMm): n touching trefoils, apex up, centroids spaced along x at depth.
 * row(n, spacingM, depthM): n single items side by side (flat) at depth.
 */
export function trefoilRow(n, spacingM, depthM, odMm) {
  const D = odMm / 1000, out = [];
  for (let c = 0; c < n; c++) {
    const x = (c - (n - 1) / 2) * spacingM;
    out.push({ x: x - D / 2, y: depthM + D / (2 * Math.sqrt(3)), circuit: c }, { x: x + D / 2, y: depthM + D / (2 * Math.sqrt(3)), circuit: c },
      { x, y: depthM - D / Math.sqrt(3), circuit: c });
  }
  return out;
}
export function row(n, spacingM, depthM) {
  return Array.from({ length: n }, (_, i) => ({ x: (i - (n - 1) / 2) * spacingM, y: depthM, circuit: i }));
}

// Ground thermal resistance between a line source at p and the point q, with its image above the surface
// (image sources, the superposition used in IEC 60287-2-1 for groups): rho/(2 pi) ln(d'/d).
const mutualT = (rho, p, q) => rho / (2 * PI) * Math.log(Math.hypot(p.x - q.x, p.y + q.y) / Math.hypot(p.x - q.x, p.y - q.y));
// Self: from the surface of diameter D at depth L, rho/(2 pi) ln(u + sqrt(u^2 - 1)), u = 2L/D.
const selfT = (rho, L, D) => { const u = 2 * L / D; return rho / (2 * PI) * Math.log(u + Math.sqrt(u * u - 1)); };

/**
 * rating(spec) -> { amps, hottest, conductorC, surfaceC, parts }
 * spec: {
 *   area, cable (a CABLES entry or overrides), freq (0 for DC),
 *   install: 'buried' | 'ducts' | 'air',
 *   positions: [{x,y}] cable centres ('buried') or duct centres ('ducts'), metres; ignored for 'air',
 *   perDuct: conductors in each duct ('ducts'), duct: { odMm, idMm, kmW },
 *   bundle: conductors touching in one bunch in air ('air'), airC, solarWm2, absorptivity,
 *   groundC, soilKmW, loadShare: [0..1] per position (1 = full rated current, default all 1),
 *   maxC (conductor limit), extraFactor (a user derating, e.g. from the maker's data; default 1)
 * }
 * The rating holds the hottest conductor at maxC with every other conductor carrying loadShare x the same current.
 */
export function rating(spec) {
  const given = Object.fromEntries(Object.entries(spec).filter(([, v]) => v !== undefined));
  const s = { ...SITE_DEFAULTS, freq: 50, extraFactor: 1, ...given };
  const cab = { ...CABLES['lv-al-1c'], ...(typeof s.cable === 'string' ? CABLES[s.cable] : s.cable) };
  const maxC = s.maxC ?? cab.maxC, b = build(s.area, cab), D = b.od / 1000;
  const R = rac(s.area, maxC, cab, { freq: s.freq });
  const T1 = cab.insulationKmW / (2 * PI) * Math.log(1 + 2 * cab.insulationMm / b.dc);
  const T3 = cab.sheathKmW / (2 * PI) * Math.log(b.od / b.di);
  const internal = T1 + T3;                                    // LV: no metallic sheath or armour losses
  const share = i => (s.loadShare ? s.loadShare[i] ?? 1 : 1);

  // conductor temperature of the hottest cable at current I
  const temps = I => {
    const W = I * I * R;                                       // W/m per conductor at the limit temperature
    if (s.install === 'buried') {
      let best = null;
      s.positions.forEach((p, i) => {
        let dT = W * share(i) ** 2 * (internal + selfT(s.soilKmW, p.y, D));
        s.positions.forEach((q, k) => { if (k !== i) dT += W * share(k) ** 2 * mutualT(s.soilKmW, q, p); });
        const t = s.groundC + dT;
        if (!best || t > best.conductorC) best = { index: i, conductorC: t, surfaceC: t - W * share(i) ** 2 * internal };
      });
      return best;
    }
    if (s.install === 'ducts') {
      const m = s.perDuct || 1, du = { odMm: 90, idMm: 77, kmW: s.ductKmW, ...s.duct };
      const Do = du.odMm / 1000, Di = du.idMm / 1000, Db = bundleFactor(m) * D;
      let best = null;
      s.positions.forEach((p, i) => {
        const Q = m * W * share(i) ** 2;                        // heat out of this duct
        let dG = Q * selfT(s.soilKmW, p.y, Do);
        s.positions.forEach((q, k) => { if (k !== i) dG += m * W * share(k) ** 2 * mutualT(s.soilKmW, q, p); });
        const tDuctOut = s.groundC + dG, tBore = tDuctOut + Q * du.kmW / (2 * PI) * Math.log(Do / Di);
        // bundle surface temperature: solve annulusLoss(Db, Di, ts, tBore) = Q by bisection
        let lo = tBore, hi = tBore + 400;
        for (let it = 0; it < 80; it++) { const mid = (lo + hi) / 2; (annulusLoss(Db, Di, mid, tBore) < Q ? lo = mid : hi = mid); }
        const ts = (lo + hi) / 2, t = ts + W * share(i) ** 2 * internal;
        if (!best || t > best.conductorC) best = { index: i, conductorC: t, surfaceC: ts, boreC: tBore, ductOutC: tDuctOut };
      });
      return best;
    }
    // air: one bunch of n touching conductors seen as one cylinder of the bundle diameter
    // A touching bunch loses less than a lone cylinder of its outline (inner faces see each other, inner cables run
    // hotter): the surface loss is cut by bunchFactor (default 0.8 for n > 1, a conservative assumption).
    const n = s.bundle || 1, Db = bundleFactor(n) * D, ta = s.airC, Q = n * W / (n > 1 ? s.bunchFactor ?? 0.8 : 1);
    let lo = ta, hi = ta + 400;
    for (let it = 0; it < 80; it++) {
      const mid = (lo + hi) / 2;
      (airLoss(Db, mid, ta, { emissivity: cab.emissivity, solarWm2: s.solarWm2 || 0, absorptivity: s.absorptivity ?? 0.6 }) < Q ? lo = mid : hi = mid);
    }
    const ts = (lo + hi) / 2;
    return { index: 0, conductorC: ts + W * internal, surfaceC: ts };
  };

  // rating: the current that puts the hottest conductor at maxC (conductor temperature rises monotonically with I)
  let lo = 0, hi = 5000;
  for (let it = 0; it < 70; it++) { const mid = (lo + hi) / 2; (temps(mid).conductorC < maxC ? lo = mid : hi = mid); }
  const amps = lo * s.extraFactor, hot = temps(lo);
  return { amps, hottest: hot.index, conductorC: hot.conductorC, surfaceC: hot.surfaceC, parts: { R, T1, T3, build: b },
    temperatureAt: I => temps(I).conductorC };
}

/** Conductor temperature at a load current, assuming the rating solution's thermal circuit (for voltage drop). */
export function operatingC(ratingResult, I) { return ratingResult.temperatureAt(I); }
// ---------------------------------------------------------------------------------------------------------------
// Protection, voltage drop, fault

// Conventional operating current over In (I2/In) by device family (the product standards' conventional values):
// BS EN 60898 MCB 1.45; BS EN 60947-2 circuit breaker 1.3; BS 88 / IEC 60269 gG fuse over 16 A 1.6;
// IEC 60269-6 gPV fuse 1.45. Edit when the chosen device's data differs.
export const I2_RATIO = Object.freeze({ mcb: 1.45, mccb: 1.3, gG: 1.6, gPV: 1.45, none: 0 });

// Preferred fixed ratings (A): the R10/R20 steps the device ranges are built on. Adjustable breakers use setStep.
export const PREFERRED = Object.freeze([1, 2, 4, 6, 8, 10, 12, 15, 16, 20, 25, 30, 32, 35, 40, 50, 63, 80, 100, 125, 160,
  200, 250, 315, 320, 400, 500, 630, 800, 1000, 1250, 1600]);

/** Choose In: the smallest preferred rating >= Ib, or an adjustable setting rounded up to setStep (A). */
export function chooseIn(Ib, { device = 'mccb', adjustable = false, setStep = 5, ratings = PREFERRED } = {}) {
  if (adjustable) return Math.ceil(Ib / setStep) * setStep;
  return ratings.find(r => r >= Ib) ?? null;
}

/**
 * coordinate({ Ib, In, Iz, device, overloadLimit }) -> { ok, checks: [{ name, ok, value, limit }] }
 * BS 7671 Regulation 433.1.1 (IEC 60364-4-43, 433.1): Ib <= In <= Iz and I2 <= 1.45 Iz.
 * overloadLimit (default 1.45) may be tightened, e.g. for cables laid direct (see ERA 69-30 table notes).
 */
export function coordinate({ Ib, In, Iz, device = 'mccb', overloadLimit = 1.45 }) {
  const k2 = I2_RATIO[device] ?? 1.45, I2 = k2 * In;
  const checks = [
    { name: 'Ib <= In', ok: Ib <= In + 1e-9, value: Ib, limit: In },
    { name: 'In <= Iz', ok: In <= Iz + 1e-9, value: In, limit: Iz },
    { name: `I2 <= ${overloadLimit} Iz`, ok: !k2 || I2 <= overloadLimit * Iz + 1e-9, value: I2, limit: overloadLimit * Iz }
  ];
  return { ok: checks.every(c => c.ok), I2, checks };
}

/** Voltage drop (%). DC two-wire: 2 I L R / U. AC three-phase: sqrt3 I L (R cos + X sin) / U (U line-line).
 *  r, x in ohm/m per conductor at the operating temperature. */
export function voltDrop({ dc = false, I, lengthM, r, x = 0, U, pf = 1 }) {
  if (dc) return 2 * I * lengthM * r / U * 100;
  const sin = Math.sqrt(Math.max(0, 1 - pf * pf));
  return Math.sqrt(3) * I * lengthM * (r * pf + x * sin) / U * 100;
}

/** Reactance per metre of a trefoil (or flat, geometric-mean spacing) circuit, from geometry. */
export function reactance(area, cable, { freq = 50, spacingMm = null, flat = false } = {}) {
  const b = build(area, cable), s = spacingMm || b.od, gmd = flat ? s * Math.cbrt(2) : s;
  return 2 * PI * freq * 2e-7 * Math.log(gmd / (0.3894 * b.dc));        // GMR of a stranded conductor ~ 0.39 d (assumption)
}

/** Fault withstand, adiabatic (BS 7671 Regulation 434.5.2; IEC 60949): minimum area for kA over seconds. */
export function faultArea(metal, kA, seconds, ti = 90, tf = 250) {
  return kA * 1000 * Math.sqrt(seconds) / adiabaticK(metal, ti, tf);
}

// ---------------------------------------------------------------------------------------------------------------
// PV strings (BS 7671 Section 712 / IEC 60364-7-712; array design per IEC 62548-1:2023 6.5, 7.2.2 and Annex F)

export const STRING_DEFAULTS = Object.freeze({
  moduleIsc: 18.0,       // A at STC (assumption for a ~600 W bifacial module; use the datasheet)
  moduleImp: 17.0,       // A at MPP
  moduleVoc: 45, moduleVmp: 38,   // chosen so 30 in series stay under 1.5 kV at -10 C; use the datasheet
  vocCoeffPerK: -0.0027, minCellC: -10,
  kCorr: null, bifaciality: 0.7, rearRatio: 0.15, // correction (IEC 62548-1 Annex F); null: 1 + bifaciality x rear/front irradiance (own method, assumed)
  modulesPerString: 30,
  stringsPerInput: 2,    // strings in parallel on one independent input (12 MPPT x 2); the 'whole array' for faults
  backfeedA: 0,          // backfeed from the inverter into the array (datasheet; 0 for most string inverters)
  moduleMaxOcpr: 30,     // module maximum overcurrent protection rating (datasheet)
  cableRatedDcV: 1500,   // cable rated DC voltage (EN 50618 family)
  fuses: 'auto',         // 'auto' (fit only when the reverse fault current needs them), true, false
  fuseLowMult: 1.0,      // In must exceed fuseLowMult x Istring,max; raise it where cloud-edge events are frequent
  fuseRatings: [10, 12, 15, 16, 20, 25, 30, 32],
  area: 6, lengthM: 120, vdLimitPct: 3,
  underModule: { install: 'air', bundle: 2 },
  homeRun: null          // e.g. { install: 'ducts', positions, perDuct, duct }
});

/**
 * stringCircuit(opts) -> { Istring, IFstring, needFuse, fuse, need, Iz, legs, vdPct, checks, ok }
 * Istring,max = 1.25 x Kcorr x Isc(STC). Reverse fault current into a faulted string from the other Ns - 1 in
 * parallel: IF = (Ns - 1) x Istring,max (Istring,max for a lone string). String protection is needed where
 * IF + backfeed exceeds the module's maximum overcurrent protection rating; a fitted device sits above
 * fuseLowMult x Istring,max and not above that module rating. Minimum cable rating: In where protected,
 * IF + backfeed where not, and never below Istring,max. Every leg (under modules, home run) must meet it.
 */
export function stringCircuit(opts = {}) {
  const p = { ...STRING_DEFAULTS, ...opts }, cab = { ...CABLES['pv-cu-1c'], ...(p.cable || {}) };
  const kCorr = p.kCorr ?? 1 + (p.bifaciality || 0) * (p.rearRatio || 0), Istring = 1.25 * kCorr * p.moduleIsc, ns = p.stringsPerInput;
  const voc = p.modulesPerString * coldVocOf({ voc: p.moduleVoc, coeffPctPerK: p.vocCoeffPerK * 100, tC: p.minCellC }).v; // stricter of the two ways
  const IFstring = ns > 1 ? (ns - 1) * Istring : Istring;
  const needFuse = p.fuses === 'auto' ? IFstring + p.backfeedA > p.moduleMaxOcpr : !!p.fuses;
  let fuse = null;
  if (needFuse) {
    const In = p.fuseRatings.find(r => r > p.fuseLowMult * Istring && r <= p.moduleMaxOcpr) ?? null;
    fuse = { In, window: [p.fuseLowMult * Istring, p.moduleMaxOcpr] };
  }
  const need = Math.max(Istring, needFuse ? fuse?.In ?? Infinity : IFstring + p.backfeedA);
  const legs = [];
  const under = rating({ area: p.area, cable: cab, freq: 0, airC: SITE_DEFAULTS.underModuleC, ...p.underModule });
  legs.push({ leg: 'under modules', Iz: under.amps, at: under });
  if (p.homeRun) { const h = rating({ area: p.area, cable: cab, freq: 0, ...p.homeRun }); legs.push({ leg: 'home run', Iz: h.amps, at: h }); }
  const gov = legs.reduce((a, l) => (l.Iz < a.Iz ? l : a)), Iz = gov.Iz;
  // voltage drop at the MPP current, conductor at its operating temperature on the governing leg
  const tOp = Math.min(cab.maxC, gov.at.temperatureAt(p.moduleImp));
  const vmp = p.modulesPerString * p.moduleVmp;
  const vdPct = voltDrop({ dc: true, I: p.moduleImp, lengthM: p.lengthM, r: rdc(p.area, tOp, cab), U: vmp });
  const checks = [
    { name: 'Voc(cold) <= cable rated DC voltage', ok: voc <= p.cableRatedDcV, value: voc, limit: p.cableRatedDcV },
    ...(needFuse ? [{ name: 'string fuse inside the window', ok: fuse.In != null, value: fuse.In, limit: fuse.window }] : []),
    { name: needFuse ? 'Iz >= In (string protected)' : 'Iz >= reverse fault current + backfeed (no string protection)',
      ok: Iz >= need, value: need, limit: Iz },
    { name: `voltage drop <= ${p.vdLimitPct} %`, ok: vdPct <= p.vdLimitPct, value: vdPct, limit: p.vdLimitPct }
  ];
  for (const l of legs) delete l.at;
  return { kCorr, Istring, IFstring, voc, needFuse, fuse, need, Iz, legs, vdPct, operatingC: tOp, checks, ok: checks.every(c => c.ok) };
}
// ---------------------------------------------------------------------------------------------------------------
// Inverter AC circuits

export const AC_DEFAULTS = Object.freeze({
  kva: 350, volts: 800, pf: 1.0,      // inverter at full apparent power; pf only shapes the voltage drop
  area: 400, cable: 'lv-al-1c', circuits: 28, spacingM: 0.25, depthM: 0.8,
  lengthM: 250, vdLimitPct: 3, device: 'mccb', adjustable: true, setStep: 5, overloadLimit: 1.45,
  faultKA: Math.round(transformerFaultKA()), faultS: 0.2, soilKmW: SITE_DEFAULTS.soilKmW, groundC: SITE_DEFAULTS.groundC   // kA: impedance method
});

/** inverterCircuit(opts) -> { Ib, In, Iz, utilisation, conductorC, vdPct, faultMinArea, coordination, checks, ok } */
export function inverterCircuit(opts = {}) {
  const p = { ...AC_DEFAULTS, ...opts }, cab = { ...CABLES['lv-al-1c'], ...(typeof p.cable === 'string' ? CABLES[p.cable] : p.cable) };
  const Ib = p.kva * 1000 / (Math.sqrt(3) * p.volts);
  const positions = trefoilRow(p.circuits, p.spacingM, p.depthM, cab.odMm);
  const at = soilKmW => rating({ area: p.area, cable: cab, install: 'buried', positions, soilKmW, groundC: p.groundC, freq: 50 }), rt = at(p.soilKmW);
  const In = chooseIn(Ib, p), co = coordinate({ Ib, In, Iz: rt.amps, device: p.device, overloadLimit: p.overloadLimit });
  const bs = [buriedOverload({ In, izAt: s => at(s).amps, soilKmW: p.soilKmW }), buriedProtection({ armoured: !!cab.armoured, ducted: !!p.ducted })];
  const tOp = Math.min(cab.maxC, rt.temperatureAt(Ib));
  const vdPct = voltDrop({ I: Ib, lengthM: p.lengthM, r: rac(p.area, tOp, cab), x: reactance(p.area, cab), U: p.volts, pf: p.pf });
  const faultMin = faultArea(cab.metal, p.faultKA, p.faultS);
  const checks = [...co.checks,
    { name: `voltage drop <= ${p.vdLimitPct} %`, ok: vdPct <= p.vdLimitPct, value: vdPct, limit: p.vdLimitPct },
    { name: 'area >= adiabatic fault minimum', ok: p.area >= faultMin, value: faultMin, limit: p.area }, ...bs];
  return { Ib, In, Iz: rt.amps, buried: bs, utilisation: Ib / rt.amps, conductorAtIbC: tOp, vdPct, faultMinArea: faultMin,
    coordination: co, checks, ok: checks.every(c => c.ok) };
}

/**
 * minSpacing(opts) -> { spacingM, widthM, Iz } or null.
 * The least centre spacing of n circuits (trefoils, or ducts for DC) in one layer at which the hottest still
 * carries `needA`. widthM = (n - 1) x spacing + one item's width + 2 x edge clearance.
 * opts: { kind: 'trefoil' | 'ducts', n, needA, area, cable, depthM, perDuct, duct, soilKmW, groundC, freq,
 *         edgeM (default 0.1), stepM (0.01), maxM (2.0) }
 */
export function minSpacing(o) {
  const cab = { ...(o.kind === 'ducts' ? CABLES['pv-cu-1c'] : CABLES['lv-al-1c']), ...(typeof o.cable === 'string' ? CABLES[o.cable] : o.cable) };
  const itemW = o.kind === 'ducts' ? (o.duct?.odMm ?? 90) / 1000 : 2 * cab.odMm / 1000;
  const edge = o.edgeM ?? 0.1, step = o.stepM ?? 0.01, maxM = o.maxM ?? 2.0;
  const at = s => rating(o.kind === 'ducts'
    ? { area: o.area, cable: cab, install: 'ducts', positions: row(o.n, s, o.depthM), perDuct: o.perDuct, duct: o.duct,
        soilKmW: o.soilKmW, groundC: o.groundC, freq: o.freq ?? 0 }
    : { area: o.area, cable: cab, install: 'buried', positions: trefoilRow(o.n, s, o.depthM, cab.odMm),
        soilKmW: o.soilKmW, groundC: o.groundC, freq: o.freq ?? 50 }).amps;
  for (let s = itemW; s <= maxM + 1e-9; s += step) {
    const Iz = at(s);
    if (Iz >= o.needA) return { spacingM: Math.round(s * 100) / 100, widthM: Math.round(((o.n - 1) * s + itemW + 2 * edge) * 100) / 100, Iz };
  }
  return null;
}
