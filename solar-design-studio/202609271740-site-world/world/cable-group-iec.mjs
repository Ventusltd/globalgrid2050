// cable-group-iec.mjs: continuous and cyclic current rating of buried single-core cables in groups (AC LV, AC MV, DC),
// laid direct or in ducts, by the steady-state thermal method of the IEC 60287 family: every cable heats every other
// through the ground by superposition of image sources (IEC 60287-2-1 clause 4.2, groups), rated at the hottest.
// Cable builds, losses and thermal resistances are in cable-iec.mjs. Standards cited by number and clause only; no
// table, figure or text of any standard is reproduced. Indicative: a real design uses the maker's data and a study.
// Pure: no DOM.

import { DEFAULTS, THERMAL_RHO, acResistance, screenLossFactors, internalThermal, dielectricLoss, trefoilTouchingG, cyclicSelfG,
  mutualG, airGapT4, bundleDiameter } from './cable-iec.mjs';

const PI = Math.PI;
// ---------------------------------------------------------------- layout ----

/**
 * A circuit: { id, cable (from makeCable), formation: 'trefoil'|'flat'|'pair'|'single', x (m), depth (m, to the
 * centre of the group), spacingMm (axial, flat/pair; default touching), touching (trefoil, default true),
 * bonding, load (A, weight for the group scale; default 1), duct: null | { odMm, boreMm, rhoT, mode: 'each'|'shared' } }
 */
function expand(c, k) {
  const cab = c.cable, form = c.formation || (cab.kind === 'dc' ? 'pair' : 'trefoil');
  const duct = c.duct || null, each = duct && (duct.mode || 'each') === 'each';
  const unit = each ? duct.odMm : cab.od;                      // what touches what
  const s = (c.spacingMm || unit) / 1000, x = c.x || 0, y = c.depth;
  let pts;
  if (form === 'trefoil') {
    const a = (c.spacingMm || unit) / 1000;
    pts = [[x, y - a / Math.sqrt(3)], [x - a / 2, y + a / (2 * Math.sqrt(3))], [x + a / 2, y + a / (2 * Math.sqrt(3))]];
  } else if (form === 'flat') pts = [[x - s, y], [x, y], [x + s, y]];
  else if (form === 'pair') pts = [[x - s / 2, y], [x + s / 2, y]];
  else pts = [[x, y]];
  const sPhaseMm = form === 'flat' ? (c.spacingMm || unit) * 2 ** (1 / 3) : (c.spacingMm || unit);
  return { circuit: k, form, pts, duct, each, sPhaseMm, adjMm: c.spacingMm || unit,
    touchingTrefoil: form === 'trefoil' && !duct && !c.spacingMm };
}

/** Build the model: cables (conductors) and elements (heat sources in the soil: a cable or a duct). */
export function buildModel(circuits, opts = {}) {
  const o = { ...DEFAULTS, ...opts }, cables = [], elements = [];
  circuits.forEach((c, k) => {
    const g = expand(c, k), cab = c.cable;
    const ac = acResistance(cab, cab.thetaMaxC, g.sPhaseMm, o.freq);
    const lam = g.form === 'trefoil' || g.form === 'flat'
      ? screenLossFactors(cab, { R: ac.R, sMm: g.adjMm, formation: g.form, bonding: c.bonding || 'solid',
        thetaS: cab.thetaMaxC - 20, freq: o.freq }) : [0, 0, 0];
    const internal = internalThermal(cab), Wd = dielectricLoss(cab, o.freq);
    const members = g.pts.map((p, j) => {
      const idx = cables.length;
      cables.push({ circuit: k, j, x: p[0], y: p[1], cable: cab, R: ac.R, ac, lambda1: lam[j] || 0, Wd, ...internal,
        weight: c.load ?? 1, bonding: c.bonding || 'solid', form: g.form, adjMm: g.adjMm });
      return idx;
    });
    if (g.duct) {
      const need = g.each ? cab.od : bundleDiameter(members.length, cab.od);
      if (need >= g.duct.boreMm) throw new Error(`cable-rating-iec: circuit ${c.id ?? k}: cables (${need.toFixed(0)} mm) do not fit the ${g.duct.boreMm} mm duct bore`);
    }
    if (g.duct && !g.each) {
      elements.push({ x: c.x || 0, y: c.depth, De: g.duct.odMm, members, duct: g.duct,
        bundleMm: bundleDiameter(members.length, cab.od), circuit: k });
    } else {
      members.forEach((idx) => elements.push({ x: cables[idx].x, y: cables[idx].y, De: g.duct ? g.duct.odMm : cab.od,
        members: [idx], duct: g.duct, bundleMm: cab.od, circuit: k, trefoil: g.touchingTrefoil }));
    }
  });
  elements.forEach((e, i) => e.members.forEach((m) => { cables[m].element = i; }));
  return { cables, elements, opts: o };
}

/**
 * Temperatures of every conductor with each circuit current = scale * load. Losses use the conductor resistance
 * at its maximum temperature (the standard's convention); screen losses follow the screen temperature, duct
 * air-gap resistance follows the air temperature, both by fixed-point iteration.
 */
export function temperatures(model, scale) {
  const { cables, elements, opts: o } = model;
  const rho = o.soilKmW, k2p = rho / (2 * PI);
  let thS = cables.map((c) => c.cable.thetaMaxC - 15), thM = elements.map(() => o.ambientC + 20);
  let out;
  for (let it = 0; it < 8; it++) {
    const W = cables.map((c, i) => {
      const I = scale * c.weight, Wc = I * I * c.R;
      let lam = c.lambda1;
      if (c.cable.screen && c.lambda1 > 0) {
        // Screen losses scale with screen resistance: re-evaluate at the current screen temperature.
        const l = screenLossFactors(c.cable, { R: c.R, sMm: c.adjMm, formation: c.form, bonding: c.bonding,
          thetaS: thS[i], freq: o.freq });
        lam = l[c.j] ?? l[0];
      }
      return { I, Wc, lam, Wtot: Wc * (1 + lam) + c.Wd };
    });
    const We = elements.map((e) => e.members.reduce((s, m) => s + W[m].Wtot, 0));
    const dTg = elements.map((e, i) => {
      let G0;
      if (e.trefoil) G0 = o.mu >= 1 ? trefoilTouchingG(e.y + trefoilCentreOffset(e, cables), cables[e.members[0]].cable.od)
        : cyclicTrefoilG(e, cables, o);
      else G0 = cyclicSelfG(e.y, e.De, o.mu, o.diffusivityM2h);
      let sum = We[i] * G0;
      elements.forEach((f, j) => {
        if (j === i) return;
        if (e.trefoil && f.trefoil && f.circuit === e.circuit) return;   // inside the trefoil formula already
        sum += o.mu * We[j] * mutualG(e, f);
      });
      let dt = k2p * sum;
      if (o.dryZone && dt > o.dryZone.critRiseK) {
        const v = o.dryZone.rhoDry / rho; dt = v * dt - (v - 1) * o.dryZone.critRiseK;
      }
      return dt;
    });
    const ductParts = elements.map((e, i) => {
      if (!e.duct) return { wall: 0, air: 0 };
      const bore = e.duct.boreMm, rhoD = e.duct.rhoT ?? THERMAL_RHO.HDPE;
      const wall = We[i] * rhoD / (2 * PI) * Math.log(e.duct.odMm / bore);
      const air = We[i] * airGapT4(e.bundleMm, bore, We[i], thM[i], o.ductAirUVY);
      return { wall, air };
    });
    out = cables.map((c, i) => {
      const e = c.element, w = W[i];
      const surface = o.ambientC + dTg[e] + ductParts[e].wall + ductParts[e].air;
      const dT3 = (w.Wc * (1 + w.lam) + c.Wd) * c.T3;
      const thetaS = surface + dT3;
      const theta = thetaS + (w.Wc + 0.5 * c.Wd) * c.T1;
      return { circuit: c.circuit, j: c.j, I: w.I, W: w.Wtot, lambda1: w.lam, ground: dTg[e], surface, thetaS, theta };
    });
    const nextS = out.map((r) => r.thetaS);
    const nextM = elements.map((e, i) => o.ambientC + dTg[i] + ductParts[i].wall + 0.5 * ductParts[i].air);
    const conv = nextS.every((t, i) => Math.abs(t - thS[i]) < 1e-4) && nextM.every((t, i) => Math.abs(t - thM[i]) < 1e-4);
    thS = nextS; thM = nextM;
    if (conv) break;
  }
  return out;
}

// Trefoil formula wants L to the trefoil centre; elements hold the cable centre, so recover the centroid depth.
function trefoilCentreOffset(e, cables) {
  const c = cables[e.members[0]], ys = cables.filter((x) => x.circuit === c.circuit).map((x) => x.y);
  return ys.reduce((a, b) => a + b, 0) / ys.length - e.y;
}
function cyclicTrefoilG(e, cables, o) {
  const De = cables[e.members[0]].cable.od, L = e.y + trefoilCentreOffset(e, cables);
  const Dx = 1.02 * Math.sqrt(24 * o.diffusivityM2h) * 1000;
  if (Dx <= De) return o.mu * trefoilTouchingG(L, De);
  return 3 * (Math.log(Dx / De) - 0.630) + 3 * o.mu * Math.log(4 * L * 1000 / Dx);
}

/**
 * groupRating(circuits, opts) -> { scale, perCircuit: [{ id, amps, load, utilisation }], hottest, cables, model }
 * scale = the factor on every circuit's `load` that brings the hottest conductor to its maximum temperature. With
 * load in amps, utilisation = 1/scale (above 1 = overloaded). With no loads, scale is the equal-current rating in A.
 */
export function groupRating(circuits, opts = {}) {
  const model = buildModel(circuits, opts);
  const excess = (s) => {
    const t = temperatures(model, s);
    return Math.max(...t.map((r, i) => r.theta - model.cables[i].cable.thetaMaxC));
  };
  let lo = 0, hi = 1;
  if (excess(0) > 0) return { scale: 0, perCircuit: [], hottest: null, cables: temperatures(model, 0), model,
    note: 'dielectric and ambient heat alone exceed the limit' };
  while (excess(hi) < 0 && hi < 1e5) hi *= 2;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (excess(m) < 0) lo = m; else hi = m; }
  const t = temperatures(model, lo);
  let h = 0; t.forEach((r, i) => { if (r.theta > t[h].theta) h = i; });
  return {
    scale: lo,
    perCircuit: circuits.map((c, k) => ({ id: c.id ?? k, amps: lo * (c.load ?? 1), load: c.load ?? null,
      utilisation: c.load ? 1 / lo : null })),
    hottest: { circuit: t[h].circuit, cable: t[h].j, theta: t[h].theta }, cables: t, model
  };
}

/** Rating in amps of one circuit alone. */
export function circuitRating(circuit, opts = {}) {
  return groupRating([{ ...circuit, load: undefined, x: 0 }], opts).scale;
}

/**
 * Row of n identical circuits at pitch (m), in `rows` layers `rowGapM` apart; the first layer at depth.
 * Returns circuits ready for groupRating.
 */
export function rowLayout({ n, pitchM, depth, rows = 1, rowGapM = 0.3, ...circuit }) {
  const perRow = Math.ceil(n / rows), out = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / perRow), k = i % perRow, inRow = Math.min(perRow, n - r * perRow);
    out.push({ ...circuit, id: i, x: (k - (inRow - 1) / 2) * pitchM, depth: depth + r * rowGapM });
  }
  return out;
}

/**
 * Smallest pitch (m) at which n identical circuits in a row carry `load` amps each; width adds the group's own
 * footprint and an edge clearance each side. Returns null if even maxPitchM will not carry the load.
 */
export function pitchForLoad({ n, load, maxPitchM = 2, edgeM = 0.1, ...rest }, opts = {}) {
  const ok = (p) => groupRating(rowLayout({ n, pitchM: p, ...rest, load }), opts).scale >= 1;
  const unit = (rest.duct ? rest.duct.odMm : rest.cable.od) / 1000 * (rest.formation === 'flat' ? 3 : 2);
  if (!ok(maxPitchM)) return null;
  let lo = unit, hi = maxPitchM;
  if (ok(lo)) hi = lo;
  else for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (ok(m)) hi = m; else lo = m; }
  const rows = rest.rows || 1, perRow = Math.ceil(n / rows);
  return { pitchM: hi, widthM: (perRow - 1) * hi + unit + 2 * edgeM };
}

/** Export of the soil problem at a rating, for the numerical pair check: element centres, diameters, losses. */
export function soilProblem(result) {
  const { model, cables } = result, o = model.opts;
  return {
    soilKmW: o.soilKmW, ambientC: o.ambientC,
    elements: model.elements.map((e, i) => {
      const W = e.members.reduce((s, m) => s + cables[m].W, 0);
      return { x: e.x, y: e.y, De: e.De / 1000, W, trefoil: !!e.trefoil, circuit: e.circuit,
        groundRiseJs: cables[e.members[0]].ground };
    })
  };
}
