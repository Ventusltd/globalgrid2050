// COPIED UNCHANGED from world/v12 cable-rating.mjs at v12 commit 3adcee9 (file last changed 604729d). Modular star family: not known to star-find.
// Do not edit here: change the source and re-copy. Everything below this header is byte-identical to the source.
// cable-rating.mjs: continuous current rating of a 33 kV single-core aluminium XLPE cable laid direct in trefoil,
// by the steady-state method of IEC 60287-1-1 (losses) and IEC 60287-2-1 (thermal resistances), and the size a
// feeder segment needs for the load it carries.
//
// Indicative only: a real design uses the manufacturer's data and a rating study. The cable build is estimated
// (conductor from its area, 8 mm insulation for 19/33 kV, a 35 mm2 copper wire screen) unless an OD is given.
// Soil thermal resistivity is an input: default 1.2 K.m/W native ground, ground at 15 C, conductor 90 C.
// Pure: no imports, no DOM.

// Nominal aluminium conductor sizes (mm2) this world offers. Resistance at 20 C is worked out from the resistivity of
// aluminium with a stated allowance for stranding and compaction (own estimate, conservative), not taken from any
// standard's table: pass r20OhmKm from the maker's data to replace it. IEC 60228 is cited by number only.
export const SIZES = Object.freeze([35, 50, 70, 95, 120, 150, 185, 240, 300, 400, 500, 630, 800, 1000]);
export const AL_RHO20 = 2.8264e-8, AL_ALPHA20 = 0.00403, STRAND_ALLOWANCE = 1.10;   // ohm.m, 1/K, ratio
/** Resistance at 20 C in ohm per km of an aluminium conductor of `area` mm2 (physical estimate). */
export const alR20 = area => AL_RHO20 / (area * 1e-6) * STRAND_ALLOWANCE * 1000;
// Copper the same way: R20 = rho20 / A x k, k the same stated allowance (own estimate, not a standard's table).
export const CU_RHO20 = 1.7241e-8, CU_ALPHA20 = 0.00393;                             // ohm.m (annealed copper), 1/K
/** Resistance at 20 C in ohm per km of a copper conductor of `area` mm2 (physical estimate). */
export const cuR20 = area => CU_RHO20 / (area * 1e-6) * STRAND_ALLOWANCE * 1000;

export const RATING_DEFAULTS = Object.freeze({
  kv: 33, u0Kv: 19, freq: 50, conductorMaxC: 90, groundC: 15, soilKmW: 1.2, depthM: 0.8,
  insulationMm: 8.0, semiconMm: 1.8, screenMm2: 35, screenMm: 1.0, sheathMm: 3.2,
  xlpeKmW: 3.5, sheathKmW: 3.5, epsR: 2.5, tanDelta: 0.004, bonding: 'both-ends', groupFactor: 1
});

const PI = Math.PI;

// Cable build from the conductor area (mm); a given OD sets the oversheath instead.
export function build(area, p = RATING_DEFAULTS, odMm = null) {
  const dc = Math.sqrt(4 * area / (PI * 0.9));               // compacted stranded conductor
  const di = dc + 2 * (p.insulationMm + p.semiconMm);       // over the insulation screen
  const ds = di + 2 * p.screenMm;                            // over the wire screen
  const od = odMm || ds + 2 * p.sheathMm;
  return { dc, di, ds, od, sheath: (od - ds) / 2 };
}

/** rating(area, opts) -> { amps, mva, R, T1, T3, T4, lambda1, Wd, build } */
export function rating(area, opts = {}) {
  const p = { ...RATING_DEFAULTS, ...opts };
  if (!(area > 0)) throw new Error(`cable-rating: no conductor of ${area} mm2`);
  const b = build(area, p, opts.odMm || null), w = 2 * PI * p.freq;
  // AC resistance at the maximum temperature: DC resistance, then skin and proximity (IEC 60287-1-1 2.1).
  const rdc = (opts.r20OhmKm || alR20(area)) / 1000 * (1 + AL_ALPHA20 * (p.conductorMaxC - 20));
  const xs4 = (8 * PI * p.freq / rdc * 1e-7) ** 2, ys = xs4 / (192 + 0.8 * xs4);
  const ratio = b.dc / b.od, yf = xs4 / (192 + 0.8 * xs4);
  const yp = yf * ratio ** 2 * (0.312 * ratio ** 2 + 1.18 / (yf + 0.27));
  const R = rdc * (1 + ys + yp);
  // Dielectric loss (small at 33 kV, kept for completeness).
  const C = p.epsR / (18 * Math.log(b.di / b.dc)) * 1e-9;
  const Wd = w * C * (p.u0Kv * 1000) ** 2 * p.tanDelta;
  // Screen loss factor: bonded both ends, trefoil, circulating current (IEC 60287-1-1 2.3.1).
  const rs = 1.7241e-8 / (p.screenMm2 * 1e-6) * STRAND_ALLOWANCE * (1 + 0.00393 * 50);   // copper wires: resistivity x allowance
  const dMean = (b.di + b.ds) / 2, X = 2 * w * 1e-7 * Math.log(2 * b.od / dMean);
  const lambda1 = p.bonding === 'both-ends' ? rs / R / (1 + (rs / X) ** 2) : 0;
  // Thermal resistances (IEC 60287-2-1): insulation, oversheath, and ground for touching trefoil.
  const T1 = p.xlpeKmW / (2 * PI) * Math.log(1 + 2 * (p.insulationMm + p.semiconMm) / b.dc);
  const T3 = p.sheathKmW / (2 * PI) * Math.log(1 + 2 * b.sheath / b.ds);
  const L = p.depthM + b.od / 1000 * (0.5 + Math.sqrt(3) / 4), u = 2 * L / (b.od / 1000);
  const T4 = 1.5 / PI * p.soilKmW * (Math.log(2 * u) - 0.630);
  const dT = p.conductorMaxC - p.groundC - Wd * (0.5 * T1 + T3 + T4);
  const amps = Math.sqrt(dT / (R * T1 + R * (1 + lambda1) * (T3 + T4))) * p.groupFactor;
  return { area, amps, mva: Math.sqrt(3) * p.kv * amps / 1000, R, T1, T3, T4, lambda1, Wd, build: b };
}

/** Series impedance per metre of a trefoil circuit: { r, x } ohm/m at the rated temperature. */
export function impedance(area, opts = {}) {
  const p = { ...RATING_DEFAULTS, ...opts }, rr = rating(area, p);
  const gmr = 0.39 * rr.build.dc, s = rr.build.od;
  return { r: rr.R, x: 2 * PI * p.freq * 2e-7 * Math.log(s / gmr) };
}

/** Voltage drop in % over a length for a three-phase load in MVA at power factor pf. */
export function dropPercent(area, lengthM, mva, { pf = 0.95, ...opts } = {}) {
  const p = { ...RATING_DEFAULTS, ...opts }, z = impedance(area, p);
  const I = mva * 1e6 / (Math.sqrt(3) * p.kv * 1000), sin = Math.sqrt(1 - pf * pf);
  return Math.sqrt(3) * I * lengthM * (z.r * pf + z.x * sin) / (p.kv * 1000) * 100;
}

/**
 * sizeFor(mva, opts) -> the smallest size whose rating carries the load: { area, amps, loadAmps, utilisation }
 * or null when even the largest will not (the load needs another feeder).
 */
export function sizeFor(mva, opts = {}) {
  const p = { ...RATING_DEFAULTS, ...opts }, loadAmps = mva * 1e6 / (Math.sqrt(3) * p.kv * 1000);
  const min = opts.minArea || 0;
  for (const a of SIZES) {
    if (a < min) continue;
    const r = rating(a, p);
    if (r.amps >= loadAmps) return { area: a, amps: r.amps, loadAmps, utilisation: loadAmps / r.amps };
  }
  return null;
}
