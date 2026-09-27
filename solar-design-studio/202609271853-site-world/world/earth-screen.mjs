// earth-screen.mjs (world cartridge, loaded by earth-mount.mjs): metallic screen (sheath) bonding of single-core MV/HV cable circuits.
// Solid bonding, single-point bonding with an earth continuity conductor (ECC), and cross-bonding with
// link boxes and sheath voltage limiters (SVLs). Standing voltage, circulating current, screen loss factor,
// the effect on current rating, through-fault standing voltage, ECC adiabatic check, and what the single-line
// diagram (SLD) and follow-the-power should show.
//
// Method references, by number only (no text, tables or figures of any standard are reproduced here):
//   IEC 60287-1-1  clause 2.3 (screen loss factor lambda1: circulating current for solid bonding, eddy current,
//                  cross-bonded circuits with unequal minor sections).
//   IEC 60949 and BS 7671 regulation 543.1.3 (adiabatic check of a protective conductor, k from material physics).
//   BS 7671 regulation 411 (conventional touch-voltage idea; the limit here is a user setting).
//   IEEE 575 and IEC 62067 / IEC 60840 annexes (bonding arrangements, SVLs): concepts only.
//   ERA 69-30 is cited by number only; nothing of it is reproduced here.
//   Public background: Wikipedia "Electrical cable", "Carson's equations" (earth return, J. R. Carson 1926),
//   "Inductance" (mutual inductance of parallel conductors), all paraphrased.
//
// Our own code and our own words. Physics used: induced voltage per metre on conductor k from phase currents
// E_k = j w (mu0 / 2 pi) sum_i I_i ln(1 / d_ki) (balanced currents, so the reference distance cancels); a thin
// screen tube has geometric mean radius equal to its mean radius. Constants are physical, or labelled assumptions.
//
// NO WARRANTY. Illustrative, early-design only. A real design uses the cable maker's data, the network
// operator's limits and a study checked by a qualified engineer. Pure: no imports, no DOM. SI inside.

export const DISCLAIMER = 'Illustrative early-design estimate, no warranty: confirm screen bonding with a qualified engineer and the cable maker.';

const PI = Math.PI, MU0_2PI = 2e-7;
export const SCREEN_METAL = Object.freeze({
  Cu: Object.freeze({ rho20: 1.7241e-8, alpha20: 3.93e-3, heatCap: 3.45e6, beta: 234.5 }),   // J/(K m3), K
  Al: Object.freeze({ rho20: 2.8264e-8, alpha20: 4.03e-3, heatCap: 2.5e6, beta: 228 }),
  Pb: Object.freeze({ rho20: 21.4e-8, alpha20: 4.0e-3, heatCap: 1.45e6, beta: 230 })
});

/** Assumptions a user should replace. Each is ours, not a standard's value. */
export const BONDING_DEFAULTS = Object.freeze({
  freq: 50,
  touchLimitV: 50,        // normal standing-voltage limit at an open screen end (set the operator's own value)
  drumM: 750,             // longest cable length on one drum: sets joint spacing (assumption)
  solidAcceptPct: 3,      // accept solid bonding if it costs no more than this % of rating
  thetaScreenC: 70,       // screen temperature when the conductor is at 90 C (assumption)
  eccAreaMm2: 95,         // ECC copper area proposed for single-point bonding (assumption)
  eccMm: { dx: 0, dy: 150 }, // ECC position relative to the trefoil centre, mm (assumption)
  faultS: 1,              // earth fault clearance time for the adiabatic check, s (assumption)
  eccThetaC: [30, 160],   // ECC initial and final temperature for the adiabatic check (PVC-covered, assumption)
  earthOhm: 0.1,          // resistance to earth at each bonding point, tied into the plant earth grid (assumption)
  soilOhmM: 100,          // soil resistivity for the Carson earth-return depth (assumption)
  svlClassesKv: [1, 2, 3, 4.5, 6, 9, 12],  // illustrative SVL continuous-voltage ladder; use the maker's list
  flatEarthPathMargin: 1.08, // flat solid bonding: allowance for an earth path (from our own pair check)
  svlMargin: 1.2          // SVL continuous voltage must exceed the worst through-fault standing voltage x this
});

// ---------------------------------------------------------------- complex helpers ----
const C = (re, im = 0) => ({ re, im });
const add = (a, b) => C(a.re + b.re, a.im + b.im), sub = (a, b) => C(a.re - b.re, a.im - b.im);
const mul = (a, b) => C(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
const div = (a, b) => { const d = b.re * b.re + b.im * b.im; return C((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d); };
const abs = (a) => Math.hypot(a.re, a.im), scale = (a, s) => C(a.re * s, a.im * s);
const polar = (m, deg) => C(m * Math.cos(deg * PI / 180), m * Math.sin(deg * PI / 180));

/** Solve A x = b for complex A (n x n) by Gaussian elimination with partial pivoting. */
export function csolve(A, b) {
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let k = 0; k < n; k++) {
    let p = k; for (let i = k + 1; i < n; i++) if (abs(M[i][k]) > abs(M[p][k])) p = i;
    [M[k], M[p]] = [M[p], M[k]];
    for (let i = k + 1; i < n; i++) {
      const f = div(M[i][k], M[k][k]);
      for (let j = k; j <= n; j++) M[i][j] = sub(M[i][j], mul(f, M[k][j]));
    }
  }
  const x = Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i][n]; for (let j = i + 1; j < n; j++) s = sub(s, mul(M[i][j], x[j]));
    x[i] = div(s, M[i][i]);
  }
  return x;
}

// ---------------------------------------------------------------- geometry ----

/**
 * circuitGeometry({ formation, sMm, screenMeanMm, screenAreaMm2, screenMat })
 * formation 'trefoil' (touching or spaced, sMm = centre spacing) or 'flat' (sMm = adjacent spacing).
 * Returns phase centre positions (m), the screen mean radius and resistance per metre at thetaS.
 */
export function circuitGeometry({ formation = 'trefoil', sMm, screenMeanMm, screenAreaMm2, screenMat = 'Cu',
  thetaS = BONDING_DEFAULTS.thetaScreenC } = {}) {
  const s = sMm / 1000, m = SCREEN_METAL[screenMat];
  if (!m) throw new Error(`screen-bonding: unknown screen metal ${screenMat}`);
  const pos = formation === 'flat' ? [[-s, 0], [0, 0], [s, 0]]
    : [[-s / 2, -s * Math.sqrt(3) / 6], [s / 2, -s * Math.sqrt(3) / 6], [0, s * Math.sqrt(3) / 3]];
  const Rs = m.rho20 / (screenAreaMm2 * 1e-6) * (1 + m.alpha20 * (thetaS - 20));
  return Object.freeze({ formation, s, pos, rs: screenMeanMm / 2000, Rs, screenMat, screenAreaMm2 });
}

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
/** Balanced positive-sequence phase currents of rms I (A), phase order a, b, c. */
export const phaseCurrents = (I) => [polar(I, 0), polar(I, -120), polar(I, 120)];

/** Induced voltage per metre (V/m, complex) on each open screen from the three core currents. */
export function screenEmfPerM(geo, Icore, freq = BONDING_DEFAULTS.freq) {
  const w = 2 * PI * freq;
  return geo.pos.map((pk, k) => {
    let s = C(0);
    for (let i = 0; i < 3; i++) s = add(s, scale(Icore[i], Math.log(1 / (i === k ? geo.rs : dist(pk, geo.pos[i])))));
    return mul(C(0, w * MU0_2PI), s);
  });
}

// ---------------------------------------------------------------- the three arrangements ----

/**
 * Solid bonding: screens joined and earthed at both ends. Solves the three circulating currents exactly for the
 * geometry (earth path neglected: the balanced currents close among the screens). Returns per-phase screen currents
 * and the circulating-current loss factor lambda1' = Rs |Is|^2 / (R |I|^2) given conductor AC resistance R (ohm/m).
 */
export function solidBonding(geo, { I, R, freq = BONDING_DEFAULTS.freq }) {
  const w = 2 * PI * freq, Ic = phaseCurrents(I), E = screenEmfPerM(geo, Ic, freq);
  const A = [], b = [];
  for (let k = 0; k < 3; k++) {
    const row = [];
    for (let j = 0; j < 3; j++) {
      const L = Math.log(1 / (j === k ? geo.rs : dist(geo.pos[k], geo.pos[j])));
      row.push(add(C(j === k ? geo.Rs : 0), C(0, w * MU0_2PI * L)));
    }
    row.push(C(-1)); A.push(row); b.push(scale(E[k], -1));   // Rs Is + jX.Is + E = V (common drop per metre)
  }
  A.push([C(1), C(1), C(1), C(0)]); b.push(C(0));
  const x = csolve(A, b), Is = x.slice(0, 3);
  const lambda1 = Is.map((i) => geo.Rs * abs(i) ** 2 / (R * I * I));
  return { Is: Is.map(abs), IsPhasor: Is, lambda1, lossWperM: Is.reduce((s, i) => s + geo.Rs * abs(i) ** 2, 0) };
}

/** Closed form for touching or spaced trefoil (the classic result): lambda1' = (Rs/R) / (1 + (Rs/X)^2), X = 2 w 1e-7 ln(2s/d). */
export function solidTrefoilClosed(geo, { R, freq = BONDING_DEFAULTS.freq }) {
  const X = 2 * 2 * PI * freq * 1e-7 * Math.log(geo.s / geo.rs);
  return { X, lambda1: geo.Rs / R / (1 + (geo.Rs / X) ** 2) };
}

/** Single-point bonding: standing voltage (V) at the open end of each screen for a run of lengthM at current I. */
export function standingVoltage(geo, { I, lengthM, freq = BONDING_DEFAULTS.freq }) {
  return screenEmfPerM(geo, phaseCurrents(I), freq).map((e) => abs(e) * lengthM);
}

/** Longest single-point section (m) whose worst standing voltage stays within limitV at current I. */
export function maxSinglePointM(geo, { I, limitV = BONDING_DEFAULTS.touchLimitV, freq = BONDING_DEFAULTS.freq }) {
  return limitV / Math.max(...standingVoltage(geo, { I, lengthM: 1, freq }));
}

/**
 * Cross-bonding of one major section in three minor sections of lengths [a, b, c] (m). Screens are rotated at each
 * link box so each series path passes phases a, b, c in turn. Returns the residual circulating current per path,
 * the loss factor lambda1' (averaged over the path), and the worst standing voltage at the two link boxes.
 * Exact for the geometry under the same "no earth path" assumption as solidBonding.
 */
export function crossBonding(geo, { I, R, minorM, freq = BONDING_DEFAULTS.freq }) {
  const w = 2 * PI * freq, Ic = phaseCurrents(I), E = screenEmfPerM(geo, Ic, freq);
  const perm = (k, p) => (p + k) % 3, Ltot = minorM.reduce((s, x) => s + x, 0);
  const A = [], b = [];
  for (let p = 0; p < 3; p++) {
    const row = [C(0), C(0), C(0)]; let emf = C(0);
    minorM.forEach((Lk, k) => {
      const sp = perm(k, p); emf = add(emf, scale(E[sp], Lk));
      for (let q = 0; q < 3; q++) {
        const sq = perm(k, q), d = sq === sp ? geo.rs : dist(geo.pos[sp], geo.pos[sq]);
        row[q] = add(row[q], scale(add(C(q === p ? geo.Rs : 0), C(0, w * MU0_2PI * Math.log(1 / d))), Lk));
      }
    });
    row.push(C(-1)); A.push(row); b.push(scale(emf, -1));
  }
  A.push([C(1), C(1), C(1), C(0)]); b.push(C(0));
  const J = csolve(A, b).slice(0, 3);
  const lambda1 = geo.Rs * J.reduce((s, j) => s + abs(j) ** 2, 0) / 3 / (R * I * I);
  // Standing voltage at a link box: the screen potential there with the circulating current flowing (small), taken
  // conservatively as the open-circuit emf of the worst minor section on either side.
  const worst = Math.max(...minorM.map((Lk) => Math.max(...E.map(abs)) * Lk));
  return { J: J.map(abs), lambda1, residual: Math.max(...J.map(abs)) / I, linkBoxV: worst, Ltot };
}

/** Closed form for trefoil cross-bonding with unequal minor sections: lambda1 = lambda1_solid x (|a + b h + c h^2| / (a+b+c))^2. */
export function crossTrefoilClosed(geo, { R, minorM, freq = BONDING_DEFAULTS.freq }) {
  const [a, b, c] = minorM, h = polar(1, 120), h2 = polar(1, 240);
  const u = abs(add(add(C(a), scale(h, b)), scale(h2, c))) / (a + b + c);
  return { lambda1: solidTrefoilClosed(geo, { R, freq }).lambda1 * u * u, unbalance: u };
}

// ---------------------------------------------------------------- through faults, with earth return ----

/** Carson earth-return depth De (m) for soil resistivity rho (ohm.m): the simplified form, De = 658.5 sqrt(rho/f). */
export const carsonDepth = (rho, freq = BONDING_DEFAULTS.freq) => 658.5 * Math.sqrt(rho / freq);

/**
 * Standing voltage at the open end of a single-point bonded run during a through phase-to-earth fault on phase a
 * (current If, A), fault current returning partly in the ECC (earthed at both ends through earthOhm) and partly
 * in the ground (Carson). Returns |screen - ECC| at the open end (what the SVL sees), the ECC current and the
 * voltage to remote earth. Also the three-phase through-fault value for comparison.
 */
export function faultStandingVoltage(geo, { If3, If1, lengthM, ecc = {}, freq = BONDING_DEFAULTS.freq,
  soilOhmM = BONDING_DEFAULTS.soilOhmM, earthOhm = BONDING_DEFAULTS.earthOhm }) {
  const w = 2 * PI * freq, De = carsonDepth(soilOhmM, freq), rg = w * 4e-7 * PI / 8;   // earth-return resistance per m
  const e = { ...BONDING_DEFAULTS.eccMm, ...ecc }, areaE = e.areaMm2 || BONDING_DEFAULTS.eccAreaMm2;
  const pe = [e.dx / 1000, e.dy / 1000], Re = SCREEN_METAL.Cu.rho20 / (areaE * 1e-6);
  const gmrE = 0.7788 * Math.sqrt(areaE / PI) / 1000;
  const Zm = (d) => C(rg, w * MU0_2PI * Math.log(De / d));
  const L = lengthM, pa = geo.pos[0];
  const Zee = add(C(Re), Zm(gmrE)), Zec = Zm(dist(pe, pa)), Zse = Zm(dist(pe, pa)), Zsc = Zm(geo.rs);
  // ECC current (returning, signed along +x): -2 Rg Ie = L (Zee Ie + Zec If)
  const If = C(If1), Ie = div(scale(mul(Zec, If), -L), add(scale(Zee, L), C(2 * earthOhm)));
  const Ve0 = scale(Ie, -earthOhm), VeL = scale(Ie, earthOhm);
  const VsL = sub(Ve0, scale(add(mul(Zse, Ie), mul(Zsc, If)), L));
  const threePhase = Math.max(...standingVoltage(geo, { I: If3, lengthM, freq }));
  return { toEcc: abs(sub(VsL, VeL)), toRemote: abs(VsL), eccA: abs(Ie), eccShare: abs(Ie) / If1, threePhase };
}

/** Adiabatic minimum area (mm2) of a copper ECC for fault If (A) lasting t (s): S = I sqrt(t) / k, k from physics. */
export function adiabaticK(mat = 'Cu', [thI, thF] = BONDING_DEFAULTS.eccThetaC) {
  const m = SCREEN_METAL[mat];
  // k (A s^0.5 / mm2) = sqrt(Qc (B + 20) / rho20 x ln((B + thF) / (B + thI))), Qc in J/(K mm3), rho20 in ohm.mm
  return Math.sqrt(m.heatCap * 1e-9 * (m.beta + 20) / (m.rho20 * 1e3) * Math.log((m.beta + thF) / (m.beta + thI)));
}
export const eccMinAreaMm2 = (If, t = BONDING_DEFAULTS.faultS, mat = 'Cu') => If * Math.sqrt(t) / adiabaticK(mat);

// ---------------------------------------------------------------- rating effect and recommendation ----

/**
 * Approximate rating ratio between two bonding choices, when the ground thermal resistance dominates:
 * I_b / I_a ~ sqrt((1 + lambda_a) / (1 + lambda_b)). The e2 rating engine gives the exact figure (its bonding option).
 */
export const ratingRatio = (lambdaA, lambdaB) => Math.sqrt((1 + lambdaA) / (1 + lambdaB));

/**
 * recommendBonding(run, opts): pick an arrangement for one MV cable run and say why.
 * run = { id, kv, lengthM, loadA, R (ohm/m at 90 C), If3, If1, formation, sMm, screenMeanMm, screenAreaMm2,
 *         screenMat, fromLabel, toLabel }
 * Returns a frozen study with choice, reasons, numbers, link boxes, SVLs, ECC, SLD marks and follow-the-power rows.
 */
export function recommendBonding(run, opts = {}) {
  const o = { ...BONDING_DEFAULTS, ...opts };
  const geo = circuitGeometry({ ...run, thetaS: o.thetaScreenC });
  const I = run.loadA, L = run.lengthM, R = run.R;
  const solid = solidBonding(geo, { I, R, freq: o.freq });
  // Flat formation has a zero-sequence screen emf: with the screens earthed both ends, an earth path shifts the
  // phase split and raised the hottest-phase lambda1 by up to about 7 % in our network pair check (pair-report.json).
  // Trefoil showed no such effect. The classic formula (and solidBonding) ignore the earth path, so allow for it.
  const lamSolid = Math.max(...solid.lambda1) * (geo.formation === 'flat' ? o.flatEarthPathMargin : 1);
  const spLimitM = maxSinglePointM(geo, { I, limitV: o.touchLimitV, freq: o.freq });
  const costPct = (1 - ratingRatio(0, lamSolid)) * 100;          // rating lost by solid vs single-point (eddy ignored)
  const reasons = [];
  let choice;
  if (costPct <= o.solidAcceptPct) {
    choice = 'solid';
    reasons.push(`Solid bonding costs about ${costPct.toFixed(1)} % of rating (limit set ${o.solidAcceptPct} %), and needs no SVL or ECC.`);
  } else if (L <= spLimitM) {
    choice = 'single-point';
    reasons.push(`Solid bonding would cost about ${costPct.toFixed(1)} % of rating; the run (${L.toFixed(0)} m) is within`
      + ` the ${spLimitM.toFixed(0)} m single-point length for a ${o.touchLimitV} V standing voltage.`);
  } else {
    choice = 'cross';
    reasons.push(`Solid bonding would cost about ${costPct.toFixed(1)} % of rating and the run is longer than ${spLimitM.toFixed(0)} m, so the screens are cross-bonded.`);
  }
  const study = { id: run.id, kv: run.kv, lengthM: L, loadA: I, choice, reasons, geometry: geo, disclaimer: DISCLAIMER };
  study.lambda1Solid = lamSolid; study.solidScreenA = Math.max(...solid.Is);
  study.solidLossKW = solid.lossWperM * L / 1000;
  study.solidRatingCostPct = costPct;
  study.singlePointMaxM = spLimitM;
  const marks = [];
  if (choice === 'solid') {
    study.lambda1 = lamSolid; study.lossKW = study.solidLossKW;
    study.standingV = 0; study.linkBoxes = 2; study.svl = null; study.ecc = null;
    marks.push({ atM: 0, kind: 'screen-earth', label: 'screens earthed' }, { atM: L, kind: 'screen-earth', label: 'screens earthed' });
  } else if (choice === 'single-point') {
    const sv = Math.max(...standingVoltage(geo, { I, lengthM: L, freq: o.freq }));
    const fv = faultStandingVoltage(geo, { If3: run.If3, If1: run.If1, lengthM: L, freq: o.freq, soilOhmM: o.soilOhmM, earthOhm: o.earthOhm,
      ecc: { ...o.eccMm, areaMm2: o.eccAreaMm2 } });
    const need = Math.max(fv.toEcc, fv.threePhase) * o.svlMargin / 1000;
    const svl = o.svlClassesKv.find((k) => k >= need) ?? null;
    const eccMin = eccMinAreaMm2(run.If1, o.faultS);
    study.lambda1 = 0; study.lossKW = 0; study.standingV = sv; study.fault = fv; study.linkBoxes = 2;
    study.svl = { count: 3, ucKv: svl, needKv: need, where: 'open end' };
    study.ecc = { areaMm2: o.eccAreaMm2, minAreaMm2: eccMin, ok: o.eccAreaMm2 >= eccMin, eccShare: fv.eccShare };
    if (!svl) reasons.push(`Through-fault standing voltage ${(need / o.svlMargin).toFixed(1)} kV is above the SVL ladder: shorten the section or cross-bond.`);
    if (!study.ecc.ok) reasons.push(`ECC ${o.eccAreaMm2} mm² is below the adiabatic minimum ${eccMin.toFixed(0)} mm²: increase it.`);
    marks.push({ atM: 0, kind: 'screen-earth', label: 'screens earthed, ECC bonded' },
      { atM: L, kind: 'svl-link', label: `SVL link box, 3 SVLs ${svl ?? '?'} kV` }, { atM: L / 2, kind: 'ecc', label: `ECC ${o.eccAreaMm2} mm² Cu, transposed at mid-point` });
  } else {
    const minorMax = Math.min(o.drumM, spLimitM);
    const majors = Math.max(1, Math.ceil(L / (3 * minorMax)));
    const minor = L / (3 * majors), minorM = [minor, minor, minor];
    const xb = crossBonding(geo, { I, R, minorM, freq: o.freq });
    const fv = faultStandingVoltage(geo, { If3: run.If3, If1: run.If1, lengthM: minor, freq: o.freq, soilOhmM: o.soilOhmM, earthOhm: o.earthOhm,
      ecc: { ...o.eccMm, areaMm2: o.eccAreaMm2 } });
    const need = Math.max(fv.toEcc, fv.threePhase) * o.svlMargin / 1000;
    const svl = o.svlClassesKv.find((k) => k >= need) ?? null;
    // Sensitivity: 5 % unequal minor sections, the usual site reality.
    const xbUneq = crossBonding(geo, { I, R, minorM: [minor * 0.95, minor, minor * 1.05], freq: o.freq });
    study.lambda1 = xb.lambda1; study.lambda1Unequal5 = xbUneq.lambda1; study.lossKW = geo.Rs * xb.J.reduce((s, j) => s + j * j, 0) * L / 1000;
    study.standingV = xb.linkBoxV; study.fault = fv; study.majors = majors; study.minorM = minor;
    study.linkBoxes = 4 * majors; study.svl = { count: 6 * majors, ucKv: svl, needKv: need, where: 'cross-bonding link boxes' };
    study.ecc = null;
    for (let m = 0; m < majors; m++) {
      const x0 = m * 3 * minor;
      if (m === 0) marks.push({ atM: 0, kind: 'screen-earth', label: 'screens solidly earthed' });
      marks.push({ atM: x0 + minor, kind: 'cross-link', label: `cross-bonding link box, 3 SVLs ${svl ?? '?'} kV` },
        { atM: x0 + 2 * minor, kind: 'cross-link', label: `cross-bonding link box, 3 SVLs ${svl ?? '?'} kV` },
        { atM: x0 + 3 * minor, kind: 'screen-earth', label: 'screens solidly earthed (star point)' });
    }
    if (!svl) reasons.push('Through-fault standing voltage is above the SVL ladder: shorten the minor sections.');
  }
  study.ratingVsSinglePoint = ratingRatio(0, study.lambda1);
  study.marks = marks;
  study.rows = bondingRows(study);
  return Object.freeze(study);
}

const NAME = { solid: 'Solid (both ends)', 'single-point': 'Single-point, with ECC', cross: 'Cross-bonded' };

/** Rows for the follow-the-power panel and the Check HUD, in the same [label, value] form as sld-follow.mjs. */
export function bondingRows(s) {
  const f = (x, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : '—');
  const rows = [['Screen bonding', NAME[s.choice]], ['Screen loss factor', `λ1 ${f(s.lambda1, 3)}${s.choice === 'solid' ? ` (${f(s.solidScreenA, 0)} A in each screen)` : ''}`],
    ['Screen loss', `${f(s.lossKW, 2)} kW over ${f(s.lengthM, 0)} m`],
    ['Rating vs single-point', `${f(s.ratingVsSinglePoint * 100, 1)} %`],
    ['Standing voltage, full load', s.choice === 'solid' ? '0 V (screens earthed both ends)' : `${f(s.standingV, 0)} V at ${s.choice === 'cross' ? 'link boxes' : 'the open end'}`]];
  if (s.fault) rows.push(['Standing voltage, through fault', `${f(Math.max(s.fault.toEcc, s.fault.threePhase) / 1000, 2)} kV`]);
  if (s.svl) rows.push(['SVLs', `${s.svl.count} × ${s.svl.ucKv ?? '?'} kV class at ${s.svl.where}`]);
  rows.push(['Link boxes', `${s.linkBoxes}${s.choice === 'cross' ? ` (${s.majors} major section${s.majors > 1 ? 's' : ''} of 3 × ${f(s.minorM, 0)} m)` : ''}`]);
  if (s.ecc) rows.push(['ECC', `${s.ecc.areaMm2} mm² Cu (adiabatic minimum ${f(s.ecc.minAreaMm2, 0)} mm²)${s.ecc.ok ? '' : ' — too small'}`]);
  rows.push(['Why', s.reasons[0]], ['Note', DISCLAIMER]);
  return rows;
}

/** Map marks along a cable path (array of [x, y, z?] points) to world positions for the SLD / 3D overlay. */
export function placeMarks(marks, path) {
  const seg = []; let tot = 0;
  for (let i = 1; i < path.length; i++) { const l = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); seg.push(l); tot += l; }
  return marks.map((m) => {
    let d = Math.min(Math.max(0, m.atM), tot) * (tot ? 1 : 0), i = 0;
    while (i < seg.length - 1 && d > seg[i]) { d -= seg[i]; i++; }
    const a = path[i], b = path[Math.min(i + 1, path.length - 1)], t = seg[i] ? d / seg[i] : 0;
    return { ...m, at: a.map((v, k) => v + ((b[k] ?? v) - v) * t) };
  });
}
