// COPIED UNCHANGED from the v12 world (web/world/cable-iec.mjs) at v12 commit 3adcee9 (file last changed 3012c07). Modular star family: public #148197 makeCable.
// Do not edit here: change the source and re-copy. Everything below this header is byte-identical to the source.
// cable-iec.mjs: one buried single-core cable by the IEC 60287 thermal method: its build, losses and thermal resistances.
// Laid direct or in ducts, by the steady-state thermal method of the IEC 60287 family. The group model that rates
// many cables together is cable-group-iec.mjs.
//
// Method references, by number only (no text, tables or figures of any standard are reproduced here):
//   IEC 60287-1-1  clause 1.4 (rating equation), 2.1 (AC resistance, skin and proximity), 2.2 (dielectric loss),
//                  2.3 (screen and sheath loss: circulating and eddy currents, solid and single-point bonding)
//   IEC 60287-2-1  clause 4.1 (internal thermal resistances T1, T3), 4.2 (external T4: single buried cable,
//                  touching trefoil, groups by superposition of images, cables in ducts: air gap, duct wall, ground)
//   IEC 60853-1/-2 (cyclic rating) is the standard route for daily cycles; this file uses the published
//                  1957 loss-factor approach instead, see cyclicGround().
//
// Our own code and our own words. The equations of the method are implemented in our own code; no tabulated data is
// shipped (not the duct U, V, Y constants, not the material tables). Every material constant below is a physical
// property or a stated engineering assumption. The duct air gap is computed from heat-transfer physics; a user may
// pass the standard's duct constants from their own licensed copy.
//
// Indicative engineering only: a real design uses the cable maker's data, measured soil resistivity and a checked
// rating study. Units: SI inside (m, ohm/m, W/m, K.m/W); cable dimensions in mm at the API.
// Pure: no imports, no DOM.

const PI = Math.PI;
const SIGMA = 5.670374419e-8;            // radiation constant, W/m2K4
const G = 9.80665;

/** Conductor and screen metals: resistivity at 20 C (ohm.m) and temperature coefficient at 20 C (1/K). Physics. */
export const METAL = Object.freeze({
  Cu: Object.freeze({ rho20: 1.7241e-8, alpha20: 3.93e-3 }),
  Al: Object.freeze({ rho20: 2.8264e-8, alpha20: 4.03e-3 })
});

/**
 * Thermal resistivities of materials (K.m/W) = 1 / conductivity. Own assumptions from typical polymer
 * conductivities: XLPE ~0.29 W/mK, PE ~0.29, PVC ~0.17, HDPE duct ~0.40, PVC duct ~0.17.
 */
export const THERMAL_RHO = Object.freeze({ XLPE: 3.5, PE: 3.5, PVC: 6.0, HDPE: 2.5, PVCduct: 6.0, EPR: 3.5 });

export const DEFAULTS = Object.freeze({
  freq: 50, ambientC: 15, soilKmW: 1.2, thetaMaxC: 90,
  diffusivityM2h: 0.0018,                 // soil thermal diffusivity (about 5e-7 m2/s), for the cyclic option
  mu: 1,                                  // loss-load factor: 1 = continuous
  dryZone: null,                          // { rhoDry: 2.5, critRiseK: 35 } two-zone drying option (60287-1-1 1.4.2)
  ductAirUVY: null                        // [U, V, Y] from the user's licensed copy of 60287-2-1; null = own physics
});

// ---------------------------------------------------------------- cable build ----

/**
 * makeCable(spec) -> a frozen cable type with its geometry in mm.
 * spec = { kind: 'ac'|'dc', u0Kv, thetaMaxC,
 *   cond: { mat, area, fill=0.9, kR=1.10, r20OhmKm?, ks=1, kp=1 },
 *   ins: { tMm, condScreenMm=0, insScreenMm=0, rhoT, epsR=2.5, tanDelta=0.004 },
 *   screen: null | { mat='Cu', areaMm2, wireMm=1.0 },
 *   sheath: { tMm, rhoT }, odMm? }
 * kR scales the ideal solid-metal resistance up for stranding, lay and tolerance (own conservative assumption;
 * pass r20OhmKm from the maker's data or the conductor standard to replace it). ks, kp default 1 (conservative).
 */
export function makeCable(spec) {
  const c = spec.cond, i = spec.ins, sc = spec.screen || null, sh = spec.sheath;
  const metal = METAL[c.mat]; if (!metal) throw new Error(`cable-rating-iec: unknown metal ${c.mat}`);
  const dc = c.dcMm || Math.sqrt(4 * c.area / (PI * (c.fill || 0.9)));
  const dcs = dc + 2 * (i.condScreenMm || 0);                 // over conductor screen
  const dins = dcs + 2 * i.tMm;                                // over insulation
  const di = dins + 2 * (i.insScreenMm || 0);                  // over insulation screen
  const ds = sc ? di + 2 * (sc.wireMm || 1.0) : di;            // over metallic screen
  const od = spec.odMm || ds + 2 * sh.tMm;
  const r20 = c.r20OhmKm ? c.r20OhmKm / 1000 : metal.rho20 / (c.area * 1e-6) * (c.kR || 1.10);
  return Object.freeze({
    kind: spec.kind || 'ac', u0Kv: spec.u0Kv || 0, thetaMaxC: spec.thetaMaxC || 90, name: spec.name || '',
    cond: Object.freeze({ mat: c.mat, area: c.area, r20, alpha: metal.alpha20, ks: c.ks ?? 1, kp: c.kp ?? 1 }),
    ins: Object.freeze({ rhoT: i.rhoT ?? THERMAL_RHO.XLPE, epsR: i.epsR ?? 2.5, tanDelta: i.tanDelta ?? 0.004,
      t1Mm: (i.condScreenMm || 0) + i.tMm + (i.insScreenMm || 0) }),
    screen: sc ? Object.freeze({ mat: sc.mat || 'Cu', areaMm2: sc.areaMm2, ...METAL[sc.mat || 'Cu'],
      dMeanMm: (di + ds) / 2, tEqMm: sc.areaMm2 / (PI * (di + ds) / 2), dOutMm: ds }) : null,
    sheath: Object.freeze({ tMm: (od - ds) / 2, rhoT: sh.rhoT ?? THERMAL_RHO.PE }),
    dc, dcs, dins, di, ds, od
  });
}

/**
 * Generic builds for the owner's cases. Estimates, not catalogue data: replace with the maker's datasheet.
 * lvAl(area): 0.6/1 kV single-core Al XLPE, no metallic screen or armour.
 * mvAl(area): 19/33 kV single-core Al XLPE, Cu wire screen, PE oversheath.
 * dcCu(area): 1.5 kV DC single-core fine-stranded tinned Cu, cross-linked insulation and sheath (solar string cable).
 */
export const PRESETS = Object.freeze({
  lvAl: (area, o = {}) => makeCable({ kind: 'ac', u0Kv: 0.6, name: `LV ${area} Al`,
    cond: { mat: 'Al', area, ...o.cond }, ins: { tMm: area >= 300 ? 2.4 : 1.8, rhoT: THERMAL_RHO.XLPE },
    sheath: { tMm: area >= 300 ? 2.2 : 1.8, rhoT: THERMAL_RHO.PVC }, ...o }),
  mvAl: (area, o = {}) => makeCable({ kind: 'ac', u0Kv: 19, name: `33 kV ${area} Al`,
    cond: { mat: 'Al', area, ...o.cond },
    ins: { tMm: 8.0, condScreenMm: 0.8, insScreenMm: 1.0, rhoT: THERMAL_RHO.XLPE, epsR: 2.5, tanDelta: 0.004 },
    screen: { mat: 'Cu', areaMm2: area >= 630 ? 50 : 35, wireMm: 1.0 },
    sheath: { tMm: area >= 630 ? 3.6 : 3.2, rhoT: THERMAL_RHO.PE }, ...o }),
  dcCu: (area, o = {}) => makeCable({ kind: 'dc', u0Kv: 0, name: `DC ${area} Cu`,
    cond: { mat: 'Cu', area, kR: 1.18, fill: 0.78, ...o.cond }, ins: { tMm: 0.7, rhoT: THERMAL_RHO.XLPE },
    sheath: { tMm: 0.8, rhoT: THERMAL_RHO.XLPE }, ...o })
});

// ---------------------------------------------------------------- losses (60287-1-1 clause 2) ----

/** DC resistance per metre at theta (C). */
export const rdcAt = (cable, theta) => cable.cond.r20 * (1 + cable.cond.alpha * (theta - 20));

function skinY(x2) {                    // x2 = xs squared; three ranges of the published skin-effect method
  const x = Math.sqrt(x2);
  if (x <= 2.8) { const x4 = x2 * x2; return x4 / (192 + 0.8 * x4); }
  if (x <= 3.8) return -0.136 - 0.0177 * x + 0.0563 * x2;
  return 0.354 * x - 0.733;
}

/**
 * AC resistance per metre at theta: R = R'(1 + ys + yp). sMm = axial spacing between phase conductors
 * (for flat formation pass the geometric mean spacing). DC cables return R'.
 */
export function acResistance(cable, theta, sMm, freq = 50) {
  const r = rdcAt(cable, theta);
  if (cable.kind === 'dc') return { R: r, rdc: r, ys: 0, yp: 0 };
  const base = 8 * PI * freq / r * 1e-7;
  const ys = skinY(base * cable.cond.ks);
  const xp2 = base * cable.cond.kp, xp4 = xp2 * xp2, F = xp4 / (192 + 0.8 * xp4);
  const q = cable.dc / sMm;
  const yp = F * q * q * (0.312 * q * q + 1.18 / (F + 0.27));
  return { R: r * (1 + ys + yp), rdc: r, ys, yp };
}

/** Dielectric loss per phase, W/m: omega C U0^2 tan(delta), C from the insulation diameters. Zero for DC and LV. */
export function dielectricLoss(cable, freq = 50) {
  if (cable.kind === 'dc' || cable.u0Kv < 3) return 0;
  const C = cable.ins.epsR / (18 * Math.log(cable.dins / cable.dcs)) * 1e-9;
  return 2 * PI * freq * C * (cable.u0Kv * 1000) ** 2 * cable.ins.tanDelta;
}

/**
 * Screen loss factors lambda1 for each cable position of a three-phase single-core circuit.
 * formation: 'trefoil' | 'flat'; bonding: 'solid' (both ends) | 'single-point' | 'cross' (ideal cross-bonding);
 * sMm = axial spacing between adjacent phases; R = conductor AC resistance (ohm/m); thetaS = screen temperature.
 * Returns an array of 3 lambda1 (for flat: [outer lagging, middle, outer leading]).
 */
export function screenLossFactors(cable, { R, sMm, formation = 'trefoil', bonding = 'solid', thetaS = 70, freq = 50 }) {
  const sc = cable.screen;
  if (!sc || cable.kind === 'dc') return [0, 0, 0];
  const w = 2 * PI * freq;
  const Rs = sc.rho20 / (sc.areaMm2 * 1e-6) * (1 + sc.alpha20 * (thetaS - 20));
  const d = sc.dMeanMm;
  if (bonding === 'solid') {
    const X = 2 * w * 1e-7 * Math.log(2 * sMm / d);
    if (formation === 'trefoil') { const l = Rs / R / (1 + (Rs / X) ** 2); return [l, l, l]; }
    // Flat, not transposed: unequal circulating currents in the three screens (60287-1-1 2.3.1, 2.3.2 approach).
    const Xm = 2 * w * 1e-7 * Math.log(2), P = X + Xm, Q = X - Xm / 3, rs2 = Rs * Rs;
    const common = 0.75 * P * P / (rs2 + P * P) + 0.25 * Q * Q / (rs2 + Q * Q);
    const cross = 2 * Rs * P * Q * Xm / (Math.sqrt(3) * (rs2 + P * P) * (rs2 + Q * Q));
    const mid = Rs / R * Q * Q / (rs2 + Q * Q);
    return [Rs / R * (common + cross), mid, Rs / R * (common - cross)];
  }
  // Single-point or cross-bonded: no circulating current; eddy current loss only (60287-1-1 2.3.6).
  const m = w / Rs * 1e-7, r = d / (2 * sMm), m2 = m * m, base = m2 / (1 + m2);
  const beta1 = Math.sqrt(4 * PI * w / (1e7 * sc.rho20 * (1 + sc.alpha20 * (thetaS - 20))));
  const ts = sc.tEqMm, Ds = sc.dOutMm;
  const gs = 1 + (ts / Ds) ** 1.74 * (beta1 * Ds * 1e-3 - 1.6);
  const tail = (beta1 * ts) ** 4 / 12e12;
  const eddy = (l0, d1, d2) => Rs / R * (gs * l0 * (1 + d1 + d2) + tail);
  if (formation === 'trefoil') {
    const l0 = 3 * base * r * r, d1 = (1.14 * m ** 2.45 + 0.33) * r ** (0.92 * m + 1.66);
    const l = Math.max(0, eddy(l0, d1, 0)); return [l, l, l];
  }
  const lag = eddy(1.5 * base * r * r, -0.74 * (m + 2) * Math.sqrt(m) / (2 + (m - 0.3) ** 2) * r ** (m + 1),
    0.92 * m ** 3.7 * r ** (m + 2));
  const mid = eddy(6 * base * r * r, 0.86 * m ** 3.08 * r ** (1.4 * m + 0.7), 0);
  const lead = eddy(1.5 * base * r * r, 4.7 * m ** 0.7 * r ** (0.16 * m + 2), 21 * m ** 3.3 * r ** (1.47 * m + 5.06));
  return [lag, mid, lead].map((x) => Math.max(0, x));
}

// ---------------------------------------------------------------- thermal resistances (60287-2-1 clause 4) ----

/** Internal thermal resistances of a single-core cable, K.m/W: T1 insulation (with semicons), T3 oversheath. */
export function internalThermal(cable) {
  const T1 = cable.ins.rhoT / (2 * PI) * Math.log(1 + 2 * cable.ins.t1Mm / cable.dc);
  const T3 = cable.sheath.rhoT / (2 * PI) * Math.log(1 + 2 * cable.sheath.tMm / cable.ds);
  return { T1, T2: 0, T3 };
}

/** Self term of an isolated buried source: ln(u + sqrt(u^2 - 1)), u = 2L/De (image method, isothermal surface). */
export const selfG = (Lm, DeMm) => { const u = 2 * Lm / (DeMm / 1000); return Math.log(u + Math.sqrt(u * u - 1)); };

/** Mutual term between two buried sources: ln(d'/d), d' to the image of the other source above ground. */
export function mutualG(a, b) {
  const dx = a.x - b.x, d = Math.hypot(dx, a.y - b.y), di = Math.hypot(dx, a.y + b.y);
  return Math.log(di / d);
}

/**
 * Touching trefoil, equally loaded, direct in ground, hottest cable (60287-2-1 4.2.4 approach), as a multiple of
 * rho/(2 pi): 3 [ln(2u) - 0.630]; L to the trefoil centre. Returned as {near, far} so the cyclic option can weight it.
 */
export function trefoilTouchingG(Lm, DeMm) {
  const u = 2 * Lm / (DeMm / 1000);
  return 3 * (Math.log(2 * u) - 0.630);
}

/**
 * Cyclic ground term (the published 1957 loss-factor method): the soil inside diameter Dx sees the peak loss, beyond it the mean
 * (loss-load factor mu). Dx = 1.02 sqrt(24 h * diffusivity). Returns the self G to use in place of selfG.
 */
export function cyclicSelfG(Lm, DeMm, mu, diffusivityM2h) {
  if (mu >= 1) return selfG(Lm, DeMm);
  const Dx = 1.02 * Math.sqrt(24 * diffusivityM2h) * 1000;       // mm
  if (Dx <= DeMm) return mu * selfG(Lm, DeMm);
  return Math.log(Dx / DeMm) + mu * Math.log(4 * Lm * 1000 / Dx);
}

/**
 * Air gap between a cable (or a bundle of equivalent diameter DeMm) and the duct bore DbMm, K.m/W, for total heat
 * W (W/m) at mean air temperature thetaM. Own physics: conduction with natural convection in a horizontal annulus
 * (a published effective-conductivity correlation for a horizontal annulus) in parallel with grey-body radiation. If uvy = [U, V, Y] is given (the
 * user's licensed constants for 60287-2-1 4.2.7.1) the empirical form U / (1 + 0.1 (V + Y thetaM) De) is used.
 */
export function airGapT4(DeMm, DbMm, W, thetaM, uvy = null, eps = 0.9) {
  if (uvy) return uvy[0] / (1 + 0.1 * (uvy[1] + uvy[2] * thetaM) * DeMm);
  const Di = DeMm / 1000, Do = DbMm / 1000;
  if (Do <= Di * 1.0001) return 0;
  const Tk = thetaM + 273.15, k = 0.02414 + 7.4e-5 * thetaM, nu = 1.34e-5 + 9.2e-8 * thetaM, Pr = 0.71;
  const alpha = nu / Pr, Lc = (Do - Di) / 2, lnr = Math.log(Do / Di);
  const Grad = 4 * SIGMA * Tk ** 3 * PI * Di / (1 / eps + Di / Do * (1 / eps - 1));
  let T = lnr / (2 * PI * k);
  for (let it = 0; it < 12; it++) {
    const dT = Math.max(0.05, W * T);
    const RaL = G * (1 / Tk) * dT * Lc ** 3 / (nu * alpha);
    const Rac = lnr ** 4 / (Lc ** 3 * (Di ** -0.6 + Do ** -0.6) ** 5) * RaL;
    const keff = k * Math.max(1, 0.386 * (Pr / (0.861 + Pr)) ** 0.25 * Rac ** 0.25);
    const Tnew = 1 / (2 * PI * keff / lnr + Grad);
    if (Math.abs(Tnew - T) < 1e-6) { T = Tnew; break; }
    T = 0.5 * (T + Tnew);
  }
  return T;
}

/** Diameter of the circle that holds n touching cables of diameter d in a ring (own geometry). */
export const bundleDiameter = (n, d) => (n <= 1 ? d : d * (1 + 1 / Math.sin(PI / n)));

// ---------------------------------------------------------------- solar day ----

/** Per-unit current over 24 h for a solar plant: half-sine between sunrise and sunset, clipped at `clip`. */
export function solarDayProfile({ sunrise = 6, sunset = 18, clip = 1, stepH = 0.25 } = {}) {
  const out = [];
  for (let t = 0; t < 24; t += stepH) {
    const x = (t + stepH / 2 - sunrise) / (sunset - sunrise);
    out.push(x > 0 && x < 1 ? Math.min(clip, Math.sin(PI * x)) / clip : 0);
  }
  return out;
}

/** Loss-load factor mu = mean of (I / Imax)^2 over the day. */
export function lossLoadFactor(profile) {
  const m = Math.max(...profile); if (!(m > 0)) return 0;
  return profile.reduce((s, p) => s + (p / m) ** 2, 0) / profile.length;
}
