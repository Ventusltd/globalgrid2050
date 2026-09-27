// earth-grid.mjs: station and substation earth grids (world cartridge, loaded by earth-mount.mjs on the first earthing command).
// Soil resistivity, grid resistance, earth potential rise (EPR), step and touch voltages against tolerable limits, transferred
// potential (hot zone), fence earthing, rods, and conductor and mesh sizing, two ways: the published closed-form approximations
// for a regular rectangular mesh (IEEE 80 method), and our own method-of-moments model (line-current segments in a uniform
// half-space with an image; the surface potential sampled on a lattice for the worst touch, step and fence voltages).
// Methods cited by number and clause only; no text, table or figure of any standard is copied, equations are our own code:
//   IEEE 80 cl. 7, 8, 11, 14-16; EN 50522 / IEC 61936-1 cl. 10 (its touch-voltage curve is NOT shipped: pass the points from a
//   licensed copy as limits.curve); IEC 60949 and BS 7671 543.1.3 (adiabatic size, k from the metal's physics); BS 7671 Ch. 54
//   and Section 712, IEC 62548 (the PV side this grid serves). Soil ranges: rough public figures (e.g. Wikipedia "Soil
//   resistivity"), paraphrased into our own round numbers; a Wenner survey on the real land replaces them.
// NO WARRANTY. Illustrative, early design only: a real design needs a measured (usually layered) soil model, the network
// operator's fault level, split factor and clearance times, and a study signed by a qualified engineer. SI units. Pure.
const PI = Math.PI;
export const NOTE = 'Illustrative early design only, no warranty. Confirm with a qualified engineer and a measured soil survey.';

// ----------------------------------------------------------------------------------------------- soil ----
/**
 * Rough electrical resistivity of ground by what BGS maps (ohm.m): typical, low, high. Own round numbers from
 * general public ranges; wet, clayey ground is low, dry sand, gravel and hard rock high. Editable by the user.
 */
export const SOIL_RHO = Object.freeze([
  { key: 'peat',      re: /peat/i,                                      typ: 50,   lo: 20,  hi: 200 },
  { key: 'clay',      re: /\bclay|mudstone|shale|silt(stone)?\b/i,      typ: 30,   lo: 5,   hi: 150 },
  { key: 'alluvium',  re: /alluvi|tidal|lacustrine|marine|estuarine/i,  typ: 40,   lo: 10,  hi: 200 },
  { key: 'till',      re: /till|diamicton|boulder/i,                    typ: 100,  lo: 30,  hi: 400 },
  { key: 'chalk',     re: /chalk/i,                                     typ: 80,   lo: 30,  hi: 250 },
  { key: 'sand',      re: /sand(?!stone)|gravel|river terrace|glaciofluvial/i, typ: 400, lo: 100, hi: 3000 },
  { key: 'sandstone', re: /sandstone|conglomerate|breccia/i,            typ: 300,  lo: 80,  hi: 3000 },
  { key: 'limestone', re: /limestone|dolomite/i,                        typ: 500,  lo: 100, hi: 5000 },
  { key: 'igneous',   re: /granite|basalt|dolerite|gabbro|igneous|schist|gneiss|slate|quartzite/i, typ: 2000, lo: 500, hi: 10000 }
]);
export const SOIL_UNKNOWN = Object.freeze({ key: 'unknown', typ: 100, lo: 30, hi: 1000 });
/**
 * soilFromGround(here) -> { rho, lo, hi, key, from, editable: true }.
 * here is the Site World ground point ({ superficial: [{name, lithology}], bedrock: [{name, lithology}] }, from
 * layers/ground.mjs at()). The shallowest mapped unit governs a grid buried at about 0.6 m; bedrock is used only
 * when no superficial deposit is mapped.
 */
export function soilFromGround(here) {
  const pick = (u) => { const t = `${u?.name || ''} ${u?.lithology || ''}`; return SOIL_RHO.find(s => s.re.test(t)); };
  const sup = here?.superficial || [], rock = (here?.bedrock || [])[0];
  for (const u of sup) { const s = pick(u); if (s) return mk(s, `superficial: ${u.name || u.lithology}`); }
  if (rock) { const s = pick(rock); if (s) return mk(s, `bedrock: ${rock.name || rock.lithology}`); }
  return mk(SOIL_UNKNOWN, here ? 'mapped unit not recognised' : 'no ground data');
  function mk(s, from) { return { rho: s.typ, lo: s.lo, hi: s.hi, key: s.key, from: `BGS 1:625k ${from} (rough assumption)`, editable: true }; }
}
/** Wenner four-probe reading to apparent resistivity (probe depth small against spacing a): rho = 2 pi a R. */
export const wennerRho = (aM, ohms) => 2 * PI * aM * ohms;

// ------------------------------------------------------------------------------- surface layer (Cs) ----
// Distance between two random points in a disc of radius 1: probability density on [0, 2]. Used to average the
// potential a uniform-current foot disc makes on itself (own formulation of the foot resistance).
function discPairPdf(s) { const u = s / 2; return (4 * s / PI) * (Math.acos(u) - u * Math.sqrt(1 - u * u)); }
function discPairMean(f, n = 400) {           // mean of f(s) over pairs in a unit disc, midpoint rule
  let acc = 0; const ds = 2 / n;
  for (let i = 0; i < n; i++) { const s = (i + 0.5) * ds; acc += discPairPdf(s) * f(s) * ds; }
  return acc;
}
const DISC_INV_S = discPairMean(s => 1 / s, 4000);   // mean 1/s in a unit disc (analytic 16/(3 pi) = 1.698)
/**
 * csSeries(rho, rhoS, hS, b=0.08): derating of the foot resistance by a thin resistive surface layer (for
 * example crushed rock), from our own image series: each foot a disc of radius b carrying uniform current on
 * a two-layer ground; Cs = (foot resistance on the layered ground) / (foot resistance on the layer material alone).
 * Cs < 1 when the layer is more resistive than the soil below.
 */
export function csSeries(rho, rhoS, hS, b = 0.08) {
  if (!rhoS || !hS || hS <= 0) return 1;
  const K = (rho - rhoS) / (rho + rhoS);
  let sum = 0;
  for (let n = 1; n < 2000; n++) {
    const z = 2 * n * hS / b, t = Math.pow(K, n);
    if (Math.abs(t) < 1e-9) break;
    sum += 2 * t * discPairMean(s => 1 / Math.hypot(s, z), 200);
  }
  return 1 + sum / DISC_INV_S;
}
/** The published one-line approximation of Cs (IEEE 80 cl. 7), for comparison with csSeries. */
export function csApprox(rho, rhoS, hS) {
  if (!rhoS || !hS || hS <= 0) return 1;
  return 1 - 0.09 * (1 - rho / rhoS) / (2 * hS + 0.09);
}

// ------------------------------------------------------------------------------- tolerable limits ----
/**
 * Tolerable touch and step voltages by the body-current method (IEEE 80 cl. 8, Dalziel's fibrillation
 * threshold: body current k / sqrt(ts), k = 0.116 for a 50 kg person, 0.157 for 70 kg; body 1000 ohm; each
 * foot 3 Cs rhoS ohm roughly, feet in parallel for touch and in series for step).
 * Or, with limits.curve = [[t_s, U_V], ...] from your licensed EN 50522 copy, the touch limit by log-log
 * interpolation of that curve (step is then reported against the IEEE value only, for information).
 */
export function tolerable({ rhoSurf, Cs = 1, ts, bodyKg = 50, curve = null }) {
  const k = bodyKg >= 70 ? 0.157 : 0.116, root = Math.sqrt(ts);
  const touch = (1000 + 1.5 * Cs * rhoSurf) * k / root, step = (1000 + 6 * Cs * rhoSurf) * k / root;
  if (!curve || curve.length < 2) return { touch, step, basis: `IEEE 80 body-current method, ${bodyKg >= 70 ? 70 : 50} kg` };
  return { touch: interpLogLog(curve, ts), step, basis: 'touch: user-supplied EN 50522 curve; step: IEEE 80 method (information)' };
}
function interpLogLog(pts, t) {
  const p = [...pts].sort((a, b) => a[0] - b[0]);
  if (t <= p[0][0]) return p[0][1]; if (t >= p[p.length - 1][0]) return p[p.length - 1][1];
  for (let i = 1; i < p.length; i++) if (t <= p[i][0]) {
    const [t0, u0] = p[i - 1], [t1, u1] = p[i], f = Math.log(t / t0) / Math.log(t1 / t0);
    return Math.exp(Math.log(u0) + f * (Math.log(u1) - Math.log(u0)));
  }
}

// ---------------------------------------------------------------------------- fault current ----
/** Decrement factor for DC offset over a fault of tf seconds (IEEE 80 cl. 15); Ta = X/R / (2 pi f). */
export function decrement(tf, xOverR = 10, f = 50) {
  const Ta = xOverR / (2 * PI * f);
  return Math.sqrt(1 + (Ta / tf) * (1 - Math.exp(-2 * tf / Ta)));
}

// ----------------------------------------------------------------------------- conductor sizing ----
/** Metal properties (physics): volumetric heat capacity J/(K mm3), reciprocal temperature coefficient B (C) at 0 C, resistivity at 20 C (ohm mm). */
export const METAL = Object.freeze({
  Cu:    Object.freeze({ Qc: 3.45e-3, B: 234.5, rho20: 17.241e-6 }),
  Al:    Object.freeze({ Qc: 2.50e-3, B: 228,   rho20: 28.264e-6 }),
  steel: Object.freeze({ Qc: 3.80e-3, B: 202,   rho20: 138e-6 })
});
export const SIZES_MM2 = Object.freeze([16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300, 400]);
/** Adiabatic k (A s^0.5 / mm2) from the metal's properties and the start and final temperatures (IEC 60949 form). */
export function kAdiabatic(metal = 'Cu', thetaI = 30, thetaF = 250) {
  const m = METAL[metal]; if (!m) throw new Error(`earth-grid: unknown metal ${metal}`);
  return Math.sqrt(m.Qc * (m.B + 20) / m.rho20 * Math.log((m.B + thetaF) / (m.B + thetaI)));
}
/**
 * conductorSize({ I, t, metal, thetaI, thetaF, minMm2 }) -> the adiabatic minimum and the next common size.
 * thetaF 250 C suits bolted joints (own conservative assumption); welded joints allow more. minMm2 is a
 * mechanical floor for buried grid copper (own assumption, 50 mm2).
 */
export function conductorSize({ I, t, metal = 'Cu', thetaI = 30, thetaF = 250, minMm2 = 50 }) {
  const k = kAdiabatic(metal, thetaI, thetaF), need = I * Math.sqrt(t) / k;
  const pick = SIZES_MM2.find(s => s >= Math.max(need, minMm2)) ?? null;
  return { k, needMm2: need, pickMm2: pick, dM: pick ? Math.sqrt(4 * pick / (PI * 0.9)) / 1000 : null };
}

// -------------------------------------------------------------------------------- geometry ----
/**
 * gridGeometry(g) from { Lx, Ly, D | (nx, ny), h = 0.6, dM = 0.01, rods: { n = 0, L = 3, dM = 0.016, perimeter = true } }.
 * nx conductors run along y (spaced along x), ny along x. Rods at the corners first, then evenly round the
 * perimeter; with perimeter false, at interior mesh crossings.
 */
export function gridGeometry(g) {
  const { Lx, Ly, h = 0.6, dM = 0.01 } = g;
  const nx = g.nx ?? Math.max(2, Math.round(Lx / g.D) + 1), ny = g.ny ?? Math.max(2, Math.round(Ly / g.D) + 1);
  const Dx = Lx / (nx - 1), Dy = Ly / (ny - 1);
  const rodsIn = g.rods || {}, nR = rodsIn.n || 0, Lr = rodsIn.L ?? 3, dR = rodsIn.dM ?? 0.016, perim = rodsIn.perimeter !== false;
  const rods = [];
  if (nR > 0) {
    if (perim) {
      const P = 2 * (Lx + Ly), corners = [[0, 0], [Lx, 0], [Lx, Ly], [0, Ly]];
      corners.slice(0, Math.min(4, nR)).forEach(c => rods.push(c));
      const rest = nR - rods.length;
      for (let i = 0; i < rest; i++) {
        let s = (i + 0.5) * P / rest;
        const along = s < Lx ? [s, 0] : (s -= Lx) < Ly ? [Lx, s] : (s -= Ly) < Lx ? [Lx - s, Ly] : [0, Ly - (s - Lx)];
        rods.push(along);
      }
    } else {
      const nodes = [];
      for (let i = 1; i < nx - 1; i++) for (let j = 1; j < ny - 1; j++) nodes.push([i * Dx, j * Dy]);
      const src = nodes.length ? nodes : [[Lx / 2, Ly / 2]];
      for (let i = 0; i < nR; i++) rods.push(src[Math.floor((i + 0.5) * src.length / nR)]);
    }
  }
  const LC = ny * Lx + nx * Ly, LR = rods.length * Lr, Lp = 2 * (Lx + Ly), A = Lx * Ly;
  return { Lx, Ly, h, dM, nx, ny, Dx, Dy, D: Math.max(Dx, Dy), rods, Lr, dR, perimRods: perim && rods.length > 0, LC, LR, Lp, A };
}

// ------------------------------------------------------------------------- closed form (IEEE 80 cl. 14, 16) ----
/** Grid resistance, Sverak's form (IEEE 80 cl. 14): uniform soil, total buried length LT. */
export function rgSverak(rho, geo) {
  const LT = geo.LC + geo.LR, A = geo.A, h = geo.h;
  return rho * (1 / LT + (1 / Math.sqrt(20 * A)) * (1 + 1 / (1 + h * Math.sqrt(20 / A))));
}
/** Mesh (touch) and step voltage factors for a rectangular grid (IEEE 80 cl. 16). Returns Km, Ki, Ks, n, LM, LS. */
export function meshFactors(geo) {
  const { D, h, dM: d, LC, LR, Lp, A, Lx, Ly } = geo;
  const na = 2 * LC / Lp, nb = Math.sqrt(Lp / (4 * Math.sqrt(A))), n = na * nb;   // nc = nd = 1 for rectangles
  const Kh = Math.sqrt(1 + h / 1.0);
  const Kii = geo.perimRods ? 1 : 1 / Math.pow(2 * n, 2 / n);
  const Km = (1 / (2 * PI)) * (Math.log(D * D / (16 * h * d) + (D + 2 * h) ** 2 / (8 * D * d) - h / (4 * d))
    + (Kii / Kh) * Math.log(8 / (PI * (2 * n - 1))));
  const Ki = 0.644 + 0.148 * n;
  const Ks = (1 / PI) * (1 / (2 * h) + 1 / (D + h) + (1 / D) * (1 - Math.pow(0.5, n - 2)));
  const LM = geo.perimRods ? LC + (1.55 + 1.22 * (geo.Lr / Math.hypot(Lx, Ly))) * LR : LC + LR;
  const LS = 0.75 * LC + 0.85 * LR;
  return { Km, Ki, Ks, n, LM, LS };
}

// ----------------------------------------------------------------------- numerical (own method of moments) ----
/** Cut the grid and rods into segments no longer than segM. Segment: [ax, ay, az, bx, by, bz, radius], z down. */
export function segments(geo, segM = null) {
  const s = segM ?? Math.max(0.5, Math.min(geo.D / 3, 3));
  const out = [], a = geo.dM / 2;
  const cut = (x0, y0, z0, x1, y1, z1, r) => {
    const L = Math.hypot(x1 - x0, y1 - y0, z1 - z0), k = Math.max(1, Math.ceil(L / s - 1e-9));
    for (let i = 0; i < k; i++) out.push([x0 + (x1 - x0) * i / k, y0 + (y1 - y0) * i / k, z0 + (z1 - z0) * i / k,
      x0 + (x1 - x0) * (i + 1) / k, y0 + (y1 - y0) * (i + 1) / k, z0 + (z1 - z0) * (i + 1) / k, r]);
  };
  // Cut between crossings so every crossing is a segment end, never a collocation point (two crossing
  // conductors must not share a matching point, or the system is singular).
  for (let i = 0; i < geo.nx; i++) for (let j = 0; j < geo.ny - 1; j++) cut(i * geo.Dx, j * geo.Dy, geo.h, i * geo.Dx, (j + 1) * geo.Dy, geo.h, a);
  for (let j = 0; j < geo.ny; j++) for (let i = 0; i < geo.nx - 1; i++) cut(i * geo.Dx, j * geo.Dy, geo.h, (i + 1) * geo.Dx, j * geo.Dy, geo.h, a);
  for (const [x, y] of geo.rods) cut(x, y, geo.h, x, y, geo.h + geo.Lr, geo.dR / 2);
  return out;
}
// Integral of 1/r along segment A->B seen from point P: ln((r1 + r2 + L) / (r1 + r2 - L)).
function lineInt(px, py, pz, s, mirror) {
  const az = mirror ? -s[2] : s[2], bz = mirror ? -s[5] : s[5];
  const r1 = Math.hypot(px - s[0], py - s[1], pz - az), r2 = Math.hypot(px - s[3], py - s[4], pz - bz);
  const L = Math.hypot(s[3] - s[0], s[4] - s[1], s[5] - s[2]);
  return Math.log((r1 + r2 + L) / Math.max(r1 + r2 - L, 1e-15));
}
const segLen = (s) => Math.hypot(s[3] - s[0], s[4] - s[1], s[5] - s[2]);
// Collocation point on the conductor surface: segment midpoint moved one radius sideways.
function colloc(s) {
  const mx = (s[0] + s[3]) / 2, my = (s[1] + s[4]) / 2, mz = (s[2] + s[5]) / 2;
  const vertical = Math.abs(s[5] - s[2]) > 1e-9;
  return vertical ? [mx + s[6], my, mz] : [mx, my, mz - s[6]];
}
/**
 * solveMoM(rho, segs): currents leaking from each segment when the whole electrode sits at 1 V (half-space,
 * insulating surface by images). Returns { R, I: Float64Array } with R = 1 / sum(I).
 */
export function solveMoM(rho, segs) {
  const n = segs.length, M = new Float64Array(n * n), b = new Float64Array(n).fill(1);
  for (let i = 0; i < n; i++) {
    const [px, py, pz] = colloc(segs[i]);
    for (let j = 0; j < n; j++) {
      const s = segs[j];
      M[i * n + j] = rho / (4 * PI * segLen(s)) * (lineInt(px, py, pz, s, false) + lineInt(px, py, pz, s, true));
    }
  }
  const I = gaussSolve(M, b, n);
  let tot = 0; for (let i = 0; i < n; i++) tot += I[i];
  return { R: 1 / tot, I };
}
function gaussSolve(M, b, n) {
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r * n + c]) > Math.abs(M[p * n + c])) p = r;
    if (p !== c) { for (let k = 0; k < n; k++) { const t = M[c * n + k]; M[c * n + k] = M[p * n + k]; M[p * n + k] = t; } const t = b[c]; b[c] = b[p]; b[p] = t; }
    const d = M[c * n + c];
    for (let r = c + 1; r < n; r++) {
      const f = M[r * n + c] / d; if (f === 0) continue;
      for (let k = c; k < n; k++) M[r * n + k] -= f * M[c * n + k];
      b[r] -= f * b[c];
    }
  }
  const x = new Float64Array(n);
  for (let r = n - 1; r >= 0; r--) { let s = b[r]; for (let k = r + 1; k < n; k++) s -= M[r * n + k] * x[k]; x[r] = s / M[r * n + r]; }
  return x;
}
/** Ground-surface potential at (x, y) for the solved currents (1 V electrode). */
export function surfaceV(rho, segs, I, x, y) {
  let v = 0;
  for (let j = 0; j < segs.length; j++) v += I[j] * 2 * lineInt(x, y, 0, segs[j], false) / (4 * PI * segLen(segs[j]));
  return rho * v;
}
/**
 * numericTouchStep(rho, geo, mom, { step = 0.5, margin = 3 }): on a lattice over the grid plus a margin, the
 * worst touch (1 V minus the surface potential, inside the grid footprint) and worst 1 m step (along x, y),
 * both per volt of EPR.
 */
export function numericTouchStep(rho, geo, segs, I, { step = 0.5, margin = 3 } = {}) {
  const xs = [], ys = [];
  for (let x = -margin; x <= geo.Lx + margin + 1e-9; x += step) xs.push(x);
  for (let y = -margin; y <= geo.Ly + margin + 1e-9; y += step) ys.push(y);
  const V = xs.map(x => ys.map(y => surfaceV(rho, segs, I, x, y)));
  const k = Math.round(1 / step);
  let touch = 0, stepV = 0, at = null;
  for (let i = 0; i < xs.length; i++) for (let j = 0; j < ys.length; j++) {
    const inside = xs[i] >= -1e-9 && xs[i] <= geo.Lx + 1e-9 && ys[j] >= -1e-9 && ys[j] <= geo.Ly + 1e-9;
    if (inside && 1 - V[i][j] > touch) { touch = 1 - V[i][j]; at = [xs[i], ys[j]]; }
    if (i + k < xs.length) stepV = Math.max(stepV, Math.abs(V[i][j] - V[i + k][j]));
    if (j + k < ys.length) stepV = Math.max(stepV, Math.abs(V[i][j] - V[i][j + k]));
  }
  return { touchPU: touch, stepPU: stepV, touchAt: at, lattice: { xs: xs.length, ys: ys.length, step } };
}

// ----------------------------------------------------------------------------- the study ----
/**
 * studyEarthGrid(input) -> the whole early-design earthing check for one station or substation grid.
 * input = {
 *   soil:  { rho, surface: { rhoS: 3000, hS: 0.1 } | null },     rho from soilFromGround() or a Wenner survey
 *   grid:  { Lx, Ly, D, h, dM, rods: { n, L, dM, perimeter } },   see gridGeometry
 *   fault: { If, Sf = 1, xOverR = 10, tf = 0.5, ts = 0.5, tc = 1, f = 50 },
 *            If the single-phase-to-earth fault current at the site (A); Sf the share returning through the grid
 *            (1 = none via overhead earth wires or cable screens: conservative); ts the shock (clearance) time.
 *   bodyKg: 50 | 70, limits: { curve: [[t, U], ...] } | null,
 *   fence: { offsetM = 1, bonded = true } | null, hotV = [430, 650], numeric = true, segM, latticeM
 * }
 */
export function studyEarthGrid(input) {
  const soil = input.soil || {}, rho = soil.rho ?? SOIL_UNKNOWN.typ, sur = soil.surface || null;
  const fault = { Sf: 1, xOverR: 10, tf: 0.5, ts: 0.5, tc: 1, f: 50, ...(input.fault || {}) };
  const geo = gridGeometry(input.grid);
  const rhoSurf = sur ? sur.rhoS : rho;
  const Cs = sur ? csSeries(rho, sur.rhoS, sur.hS) : 1;
  const lim = tolerable({ rhoSurf, Cs, ts: fault.ts, bodyKg: input.bodyKg ?? 50, curve: input.limits?.curve });
  const Df = decrement(fault.tf, fault.xOverR, fault.f);
  const IG = Df * fault.Sf * fault.If;
  const Rg = rgSverak(rho, geo);
  const mf = meshFactors(geo);
  const Em = rho * mf.Km * mf.Ki * IG / mf.LM, Es = rho * mf.Ks * mf.Ki * IG / mf.LS;
  const closed = { Rg, GPR: IG * Rg, Em, Es };
  let numeric = null, fenceOut = null;
  if (input.numeric !== false) {
    const segs = segments(geo, input.segM);
    const mom = solveMoM(rho, segs), GPR = IG * mom.R;
    const ts_ = numericTouchStep(rho, geo, segs, mom.I, { step: input.latticeM ?? 0.5 });
    numeric = { Rg: mom.R, GPR, Em: ts_.touchPU * GPR, Es: ts_.stepPU * GPR, touchAt: ts_.touchAt, segments: segs.length, lattice: ts_.lattice };
    if (input.fence !== null) fenceOut = fenceCheck(rho, geo, segs, mom.I, GPR, input.fence || {}, lim);
  }
  // Verdicts take the worse of the two: the closed form runs high on resistance for small or long, narrow grids
  // (up to about 30 % in the pair check) and can run low on touch (about 10 %), so neither alone is trusted.
  const use = numeric ? { Rg: Math.max(numeric.Rg, closed.Rg), GPR: Math.max(numeric.GPR, closed.GPR),
    Em: Math.max(numeric.Em, closed.Em), Es: Math.max(numeric.Es, closed.Es) } : closed;
  const warnings = [];
  if (numeric) {
    if (closed.Rg > 1.15 * numeric.Rg) warnings.push(
      `closed-form grid resistance ${((closed.Rg / numeric.Rg - 1) * 100).toFixed(0)} % above the numerical model (small or elongated grid): EPR shown is the higher, conservative value`);
    if (closed.Em < 0.95 * numeric.Em) warnings.push(`closed-form touch ${((1 - closed.Em / numeric.Em) * 100).toFixed(0)} % below the numerical model: the numerical value is used`);
  } else warnings.push('closed form only: run the numerical model before relying on the result');
  const GPR = use.GPR, req = rho / (2 * PI * use.Rg);             // equivalent hemisphere radius
  const hotV = input.hotV || [430, 650];
  const hot = hotV.map(v => ({ V: v, exceeded: GPR > v, radiusM: GPR > v ? GPR * req / v : 0 }));
  const conductor = conductorSize({ I: fault.If, t: fault.tc, metal: input.metal || 'Cu' });
  const gprBelowTouch = GPR <= lim.touch;
  const verdict = {
    touch: gprBelowTouch || use.Em <= lim.touch, step: use.Es <= lim.step,
    conductor: conductor.pickMm2 !== null && Math.PI * (geo.dM / 2) ** 2 * 1e6 * 0.9 >= conductor.needMm2
  };
  return {
    note: NOTE, rho, Cs, rhoSurf, limits: lim, geo, Df, IG, closed, numeric, worst: use, warnings, metal: input.metal || 'Cu', gprBelowTouch, hot, fence: fenceOut,
    conductor, verdict, pass: verdict.touch && verdict.step && (!fenceOut || fenceOut.pass),
    sources: 'IEEE 80 cl. 8, 11, 14-16; EN 50522; IEC 61936-1 cl. 10; IEC 60949; BS 7671 543.1.3 (method only, no text copied)'
  };
}
/**
 * Fence touch voltage. Bonded fence: at EPR, so a hand on it 1 m outside sees EPR minus the ground there.
 * Separately earthed fence: floats at roughly the mean ground potential along its line, so the touch is that
 * mean minus the ground 1 m either side. Sampled round the whole fence line.
 */
export function fenceCheck(rho, geo, segs, I, GPR, { offsetM = 1, bonded = true, stepM = 1 } = {}, lim) {
  const o = offsetM, line = [];
  const x0 = -o, y0 = -o, x1 = geo.Lx + o, y1 = geo.Ly + o;
  for (let x = x0; x <= x1 + 1e-9; x += stepM) { line.push([x, y0, 0, -1]); line.push([x, y1, 0, 1]); }
  for (let y = y0 + stepM; y < y1 - 1e-9; y += stepM) { line.push([x0, y, -1, 0]); line.push([x1, y, 1, 0]); }
  const vAt = (x, y) => surfaceV(rho, segs, I, x, y) * GPR;
  const onLine = line.map(([x, y]) => vAt(x, y));
  const fenceV = bonded ? GPR : onLine.reduce((a, b) => a + b, 0) / onLine.length;
  let worst = 0;
  line.forEach(([x, y, nx, ny]) => {
    worst = Math.max(worst, Math.abs(fenceV - vAt(x + nx, y + ny)));
    if (!bonded) worst = Math.max(worst, Math.abs(fenceV - vAt(x - nx, y - ny)));
  });
  return { bonded, offsetM: o, fenceV, touchV: worst, limit: lim.touch, pass: worst <= lim.touch,
    advice: worst <= lim.touch ? 'fence touch within the limit' : bonded
      ? 'add a perimeter conductor about 1 m outside the fence, bonded, or a resistive surface layer outside'
      : 'move the fence further from the grid, or bond it and add an outer perimeter conductor' };
}
/**
 * designGrid(base, { spacings, rodCounts }): the lightest regular grid (least buried copper) that meets touch
 * and step by the closed form, trying each spacing and rod count. Early sizing only; confirm numerically.
 */
export function designGrid(base, { spacings = [20, 15, 12, 10, 8, 7, 6, 5, 4, 3], rodCounts = [0, 4, 8, 16, 24] } = {}) {
  const tries = [];
  for (const D of spacings) for (const n of rodCounts) {
    const r = studyEarthGrid({ ...base, numeric: false, fence: null, grid: { ...base.grid, D, rods: { ...(base.grid.rods || {}), n } } });
    tries.push({ D, rods: n, copperM: r.geo.LC + r.geo.LR, Em: r.closed.Em, Es: r.closed.Es, touch: r.limits.touch, step: r.limits.step, pass: r.verdict.touch && r.verdict.step });
  }
  const ok = tries.filter(t => t.pass).sort((a, b) => a.copperM - b.copperM);
  return { best: ok[0] || null, tries, note: NOTE };
}
/** Check HUD rows: [label, value, 'ok' | 'fail' | 'info']. Plain words, units shown. */
export function checkRows(s) {
  const r = (v, d = 0) => Number(v).toFixed(d), u = s.worst;
  const rows = [
    ['Soil resistivity', `${r(s.rho)} Ω·m${s.Cs < 1 ? `, surface layer ${r(s.rhoSurf)} Ω·m (Cs ${r(s.Cs, 2)})` : ''}`, 'info'],
    ['Grid resistance', `${r(u.Rg, 3)} Ω (closed form ${r(s.closed.Rg, 3)}${s.numeric ? `, numerical ${r(s.numeric.Rg, 3)}` : ''} Ω)`, 'info'],
    ['Grid current', `${r(s.IG)} A (decrement ${r(s.Df, 2)})`, 'info'],
    ['Earth potential rise', `${r(u.GPR)} V`, s.hot[0]?.exceeded ? 'fail' : 'ok'],
    ['Touch voltage', `${r(u.Em)} V, limit ${r(s.limits.touch)} V`, s.verdict.touch ? 'ok' : 'fail'],
    ['Step voltage', `${r(u.Es)} V, limit ${r(s.limits.step)} V`, s.verdict.step ? 'ok' : 'fail']
  ];
  for (const h of s.hot) if (h.exceeded) rows.push([`Hot zone ${h.V} V`, `about ${r(h.radiusM)} m from the grid centre`, 'info']);
  if (s.fence) rows.push([`Fence (${s.fence.bonded ? 'bonded' : 'separate'})`, `${r(s.fence.touchV)} V touch${s.fence.pass ? '' : ': ' + s.fence.advice}`, s.fence.pass ? 'ok' : 'fail']);
  rows.push(['Earth conductor', `${s.conductor.pickMm2 ?? 'over 400'} mm² ${s.metal} (needs ${r(s.conductor.needMm2)} mm²)`, s.verdict.conductor ? 'ok' : 'fail']);
  for (const w of s.warnings) rows.push(['Caution', w, 'info']);
  rows.push(['Note', NOTE, 'info']);
  return rows;
}
