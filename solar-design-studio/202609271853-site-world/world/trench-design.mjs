// trench-design.mjs: a trench cross-section designed from the cables it has to carry.
//
// Given a set of circuits (voltage class, conductor, formation, load), it finds the spacing at which every
// circuit stays within its conductor temperature, then sets the trench width, the depth of cover for the land
// use, the bedding / surround / marker / tile stack, and the spoil and backfill volumes. When one trench would be
// wider than a practical limit it offers the other ways out: several narrower trenches side by side, two layers,
// a larger conductor. Along a route it places draw pits (ducted runs) at changes of direction and wherever the
// pulling tension would pass the limit, and joint bays at drum lengths.
//
// Method (our own code, written from the published method, no tables copied):
//   - steady-state conductor temperature by the thermal-circuit method of IEC 60287-1-1 (losses) and
//     IEC 60287-2-1 (internal and external thermal resistances);
//   - the heating of each cable by every other cable in the ground by superposition with image sources (the
//     "unequally loaded groups" approach of IEC 60287-2-1), so a group is rated at its hottest cable;
//   - conductor resistance from the resistivity of the metal with a stated allowance, not from a table;
//   - the air gap inside a duct from a radiation-plus-convection estimate (our own, conservative), not from the
//     standard's duct constants;
//   - pulling tension by the capstan relation (straight runs add friction x weight x length, bends multiply by
//     e^(friction x angle)), with the tensile limit per mm2 of conductor as an input.
// Cover, clearances and layer thicknesses are typical UK practice or generic project rules, each an input to confirm
// against the operator's or client's spec. A design check, not a rating study: a real design uses the maker's cable
// data and a rating study (BS 7671 Appendix 4 / IEC 60364-5-52 for LV; the operator's method for MV and HV).
// Pure: no imports, no DOM.
const PI = Math.PI, SQ3 = Math.sqrt(3);

// ---------------------------------------------------------------------------------------------------------------
// Inputs that are practice, not physics. Each carries its basis so the world can show it.

/** Depth of cover (m, finished ground to the top of the uppermost cable or duct) by land use and class. */
export const COVER = Object.freeze({
  basis: 'typical UK practice; confirm with the network operator or client specification',
  farmland: { dc: 0.91, lv: 0.91, mv: 0.91, hv: 0.91, note: 'good agricultural land, cultivated' },
  'deep-cultivation': { dc: 1.2, lv: 1.2, mv: 1.2, hv: 1.2, note: 'land that is subsoiled or deep-ploughed' },
  'array-field': { dc: 0.6, lv: 0.6, mv: 0.75, hv: 0.9, note: 'inside a fenced array, not cultivated (design choice, to agree)' },
  verge: { dc: 0.45, lv: 0.45, mv: 0.75, hv: 0.9, note: 'verge or footway' },
  'road-crossing': { dc: 0.6, lv: 0.6, mv: 0.75, hv: 0.9, note: 'carriageway: ducted, 150 mm concrete surround, reinstated to the road spec' },
  'track-crossing': { dc: 0.6, lv: 0.6, mv: 0.75, hv: 0.9, note: 'site access track: ducted' }
});

/** Everything below is an input with a stated default; `why` says where it comes from. */
export const DEFAULTS = Object.freeze({
  soilKmW: 1.2,        groundC: 15,       // cleared generic rule: 1.2 K.m/W native, ground at 15 C (IEC 60287 input)
  surroundKmW: 1.0,                        // cleared generic rule: 1.0 K.m/W backfill (used in the sensitivity case only)
  bedMm: 75, surroundAboveMm: 75,          // typical UK practice: 75 mm bed and 75 mm over the top cable or duct
  tapeAboveMm: 200,                        // cleared project rule: warning tape 200 mm above the service
  tileAboveMm: 75,                         // typical practice: tiles on the surround over MV / HV
  sideClearMm: 100,                        // typical practice: wall to the nearest cable or duct
  minGapMm: 75,                            // typical practice: clear gap between circuits so bedding can be placed
  layerGapMm: 150,                         // two layers: clear vertical gap (a bedding layer between them)
  topsoilM: 0.3,                           // topsoil stripped and kept apart (cleared rule: topsoil and subsoil apart)
  bulking: 1.3,                            // loose spoil over bank volume (cleared generic rule)
  maxWidthM: 1.5,                          // one-pass bucket width that a single trench is allowed (design choice)
  betweenTrenchesM: 1.0,                   // undisturbed ground left between parallel trenches (design choice)
  ductWallKmW: 3.5,                        // polyethylene duct wall (typical material property)
  ductBoreRatio: 0.9,                      // bore over outside diameter of the duct (typical twin-wall / SDR)
  emissivity: 0.9, airRiseK: 10,           // duct air gap: radiation at this emissivity plus natural convection at this rise
  mu: 1, diffusivityM2h: 0.0018            // loss-load factor (1 = continuous; a solar day is lower) and soil diffusivity
});

// Metals: resistivity at 20 C (ohm.m) and temperature coefficient (physical constants), and the allowance that a
// real stranded conductor's resistance carries over the ideal (compaction, lay, the nominal area being a nominal).
export const METAL = Object.freeze({
  al: { rho20: 2.8264e-8, alpha: 0.00403, density: 2703 },
  cu: { rho20: 1.7241e-8, alpha: 0.00393, density: 8890 }
});
export const R_ALLOWANCE = Object.freeze({ compact: 1.10, flexible: 1.18, why: 'conservative allowance over the ideal resistivity, own estimate; check against the maker\'s data' });

// ---------------------------------------------------------------------------------------------------------------
// One cable: build, losses, internal thermal resistances.

/**
 * cable(c) -> the cable's physical build and per-metre electrical figures at its maximum temperature.
 * c: { material: 'al'|'cu', areaMm2, odMm, kind: 'ac'|'dc', maxC, insulationMm?, sheathMm?, flexible?, u0Kv?,
 *      screenMm2? (MV/HV wire screen, copper), bonding? ('both-ends'|'single-point') }
 */
export function cable(c) {
  const m = METAL[c.material || 'al'], A = c.areaMm2 * 1e-6;
  const dc = Math.sqrt(4 * c.areaMm2 / (PI * (c.flexible ? 0.78 : 0.9))) / 1000;      // conductor diameter, m
  const od = c.odMm / 1000;
  // Insulation and sheath split the radial build unless given; the split only moves T1 against T3 a little.
  const radial = (od - dc) / 2;
  const scr = c.screenMm2 ? 1.0e-3 : 0;
  const ti = c.insulationMm ? c.insulationMm / 1000 : 0.55 * (radial - scr);
  const ts = c.sheathMm ? c.sheathMm / 1000 : Math.max(0.0005, radial - scr - ti);
  const maxC = c.maxC ?? 90;
  const rdc = m.rho20 / A * (c.flexible ? R_ALLOWANCE.flexible : R_ALLOWANCE.compact) * (1 + m.alpha * (maxC - 20));
  let R = rdc, lambda1 = 0, Wd = 0;
  if (c.kind !== 'dc') {
    // Skin and proximity (IEC 60287-1-1 method), round stranded conductor, factors taken as 1 (conservative).
    const f = c.freq || 50, x4 = (8 * PI * f / rdc * 1e-7) ** 2, y = x4 / (192 + 0.8 * x4);
    const s = c.spacingM || od, r = dc / s;
    const yp = y * r * r * (0.312 * r * r + 1.18 / (y + 0.27));
    R = rdc * (1 + y + yp);
    if (c.screenMm2) {
      // Circulating-current screen loss, both ends bonded, trefoil (IEC 60287-1-1 method).
      const w = 2 * PI * f, rs = 1.7241e-8 / (c.screenMm2 * 1e-6) * (1 + 0.00393 * (maxC - 30));
      const dMean = od - 2 * ts - scr, X = 2 * w * 1e-7 * Math.log(2 * s / dMean);
      lambda1 = c.bonding === 'single-point' ? 0 : (rs / R) / (1 + (rs / X) ** 2);
      const di = dc + 2 * ti, Cap = (c.epsR || 2.5) / (18 * Math.log(di / dc)) * 1e-9;
      Wd = w * Cap * ((c.u0Kv || 19) * 1000) ** 2 * (c.tanDelta || 0.004);
    }
  }
  const T1 = (c.insulationKmW || 3.5) / (2 * PI) * Math.log(1 + 2 * ti / dc);
  const T3 = (c.sheathKmW || 5.0) / (2 * PI) * Math.log(1 + 2 * ts / (od - 2 * ts));
  // Weight per metre for pulling: metal plus polymer (0.95 t/m3), roughly.
  const weightNm = 9.81 * (m.density * A + 950 * (PI / 4) * (od * od - dc * dc));
  return { dc, od, R, rdc, lambda1, Wd, T1, T3, maxC, weightNm, areaMm2: c.areaMm2, material: c.material || 'al' };
}

// Air gap between a cable (or a bundle of equivalent diameter De) and the duct bore: 1 / (pi De h), with
// h = radiation (4 e sigma Tm^3) + laminar natural convection of a horizontal cylinder, 1.32 (dT / De)^0.25
// (textbook heat-transfer correlation). Own estimate, not the standard's duct constants; on the high side of them.
export function ductAirT(DeM, p = DEFAULTS, meanC = 60) {
  const Tm = meanC + 273.15, hr = 4 * p.emissivity * 5.67e-8 * Tm ** 3, hc = 1.32 * (p.airRiseK / DeM) ** 0.25;
  return 1 / (PI * DeM * (hr + hc));
}
// ---------------------------------------------------------------------------------------------------------------
// Layout: every conductor and duct placed in the section (u across, z down positive = depth below ground).

/**
 * A circuit: { id, cls: 'dc'|'lv'|'mv'|'hv', cable: {..cable()}, loadA, formation: 'trefoil'|'flat'|'duct-bundle',
 *   ducted?: true, ductOdMm?, perDuct? (cables in one duct, for a bundle), phases? (3 AC, 2 DC) }
 * footprint(c) -> { w, h } of one circuit's group in metres.
 */
export function footprint(ct) {
  const od = ct.cable.odMm / 1000, D = ct.ducted || ct.formation === 'duct-bundle' ? ct.ductOdMm / 1000 : od;
  if (ct.formation === 'duct-bundle') return { w: D, h: D };
  if (ct.formation === 'flat') return { w: 3 * D, h: D };
  return { w: 2 * D, h: D * (1 + SQ3 / 2) };
}

/**
 * place(circuits, g) -> { sources, width, depthToTop, depthBottom }
 * g: { cover, gapM (clear gap between adjacent circuit groups), layers: 1|2, trenches: 1..n, betweenM,
 *      sideClearM, layerGapM }
 * A source is one heat line in the ground: { circuit, u, z, De, W (per unit load^2), ... }.
 */
export function place(circuits, g) {
  const p = { ...DEFAULTS, ...g };
  const side = (g.sideClearM ?? p.sideClearMm / 1000), gap = g.gapM ?? p.minGapMm / 1000;
  const nT = g.trenches || 1, nL = g.layers || 1;
  // Split circuits over trenches (round-robin keeps each trench alike), then over layers.
  const perTrench = Array.from({ length: nT }, () => []);
  circuits.forEach((c, i) => perTrench[Number.isInteger(c.trench) ? Math.min(nT - 1, c.trench) : i % nT].push(c));   // c.trench: fixed
  const trenches = [];
  let u0 = 0;
  const sources = [];
  for (const [ti, list] of perTrench.entries()) {
    const gapT = g.gaps?.[ti] ?? gap, layers = Array.from({ length: nL }, () => []);
    list.forEach((c, i) => layers[Math.floor(i * nL / list.length)].push(c));
    const rowW = row => row.reduce((s, c) => s + footprint(c).w, 0) + Math.max(0, row.length - 1) * gapT;
    const width = Math.max(...layers.map(rowW)) + 2 * side;
    const hMax = row => Math.max(0, ...row.map(c => footprint(c).h));
    let zTop = g.covers?.[ti] ?? g.cover;
    layers.forEach((row, li) => {
      let u = u0 + side + (width - 2 * side - rowW(row)) / 2;
      for (const c of row) {
        const f = footprint(c), od = c.cable.odMm / 1000;
        const D = c.ducted || c.formation === 'duct-bundle' ? c.ductOdMm / 1000 : od;
        const zb = zTop + hMax(row);                          // underside of this layer
        const at = [];
        if (c.formation === 'duct-bundle') at.push([u + D / 2, zb - D / 2]);
        else if (c.formation === 'flat') for (let k = 0; k < 3; k++) at.push([u + D / 2 + k * D, zb - D / 2]);
        else at.push([u + D / 2, zb - D / 2], [u + 1.5 * D, zb - D / 2], [u + D, zb - D / 2 - SQ3 / 2 * D]);
        at.forEach(([uu, zz], k) => sources.push({ circuit: c.id, phase: k + 1, u: uu, z: zz, D, c, layer: li }));
        u += f.w + gapT;
      }
      zTop += hMax(row) + (p.layerGapMm / 1000);
    });
    const depthBottom = zTop - p.layerGapMm / 1000;
    trenches.push({ u0, width, depthBottom });
    u0 += width + (g.betweens?.[ti] ?? g.betweenM ?? p.betweenTrenchesM);
  }
  return { sources, trenches, corridor: trenches.at(-1).u0 + trenches.at(-1).width };
}
// ---------------------------------------------------------------------------------------------------------------
// Temperatures: every source heats every other through the ground (image method); rating by the hottest cable.

/**
 * temperatures(layout, env) -> { hottest, factor, perCircuit }
 * factor: how much every load could be multiplied by (all together) before the hottest conductor reaches its
 * maximum. factor < 1 means the layout is overloaded; the circuit's rating in this layout is factor x load.
 */
export function temperatures(layout, env = {}) {
  const p = { ...DEFAULTS, ...env }, rho = p.soilKmW, S = layout.sources;
  // Heat per source at the design load (W/m): all cables in it (a duct bundle holds perDuct cables).
  const heat = S.map(s => {
    const k = s.c.formation === 'duct-bundle' ? (s.c.perDuct || 1) : 1, cb = s.cb || (s.cb = cable({ ...s.c.cable, spacingM: s.D }));
    const Wcond = s.c.loadA ** 2 * cb.R, Wc = Wcond * (1 + cb.lambda1);
    return { Wcond, Wc, W: k * Wc, Wd: k * cb.Wd, cb, k };
  });
  let worst = { factor: Infinity };
  const perCircuit = new Map();
  S.forEach((s, i) => {
    const h = heat[i], cb = h.cb, De = s.D;
    // Ground: self (a line source at depth z of diameter De) plus every other source by its image.
    const u = 2 * s.z / De, self = rho / (2 * PI) * Math.log(u + Math.sqrt(u * u - 1)), selfL = cyclicSelf(self, s.z, De, p);
    let mutualL = 0, mutualD = 0;
    S.forEach((o, j) => {
      if (j === i) return;
      const d = Math.hypot(o.u - s.u, o.z - s.z), d2 = Math.hypot(o.u - s.u, o.z + s.z);
      const f = rho / (2 * PI) * Math.log(d2 / Math.max(d, 1e-6));
      mutualL += p.mu * heat[j].W * f; mutualD += heat[j].Wd * f;
    });
    // Duct: air gap and duct wall carry this duct's own heat; a bundle's cable also sits in its neighbours' heat.
    let inner = 0, innerD = 0;
    if (s.c.ducted || s.c.formation === 'duct-bundle') {
      const n = h.k, DeEq = n > 1 ? 1.15 * Math.sqrt(n) * cb.od : cb.od;
      const Tair = ductAirT(DeEq, p), Twall = p.ductWallKmW / (2 * PI) * Math.log(1 / p.ductBoreRatio);
      inner = h.W * (Tair + Twall); innerD = h.Wd * (Tair + Twall);
    }
    // Conductor rise at the design load, split into the part that scales with load^2 and the dielectric part.
    const load = h.Wcond * cb.T1 + h.Wc * cb.T3 + inner + h.W * selfL + mutualL;   // screen loss enters outside T1
    const diel = cb.Wd * (0.5 * cb.T1 + cb.T3) + innerD + h.Wd * self + mutualD;
    const allow = cb.maxC - p.groundC - diel;
    const factor = allow > 0 ? Math.sqrt(allow / load) : 0;
    const temp = p.groundC + diel + load;
    const cur = perCircuit.get(s.c.id);
    if (!cur || factor < cur.factor) perCircuit.set(s.c.id, { factor, temp, amps: factor * s.c.loadA, loadA: s.c.loadA });
    if (factor < worst.factor) worst = { factor, temp, circuit: s.c.id, phase: s.phase, u: s.u, z: s.z };
  });
  return { hottest: worst, factor: worst.factor, perCircuit: [...perCircuit.entries()].map(([id, v]) => ({ id, ...v })) };
}

// Daily cycle (the published 1957 loss-factor approach; IEC 60853-2 is the standard route, cited only): the soil
// within Dx of the cable sees the peak loss, beyond it the mean (mu x peak). mu = 1 gives the steady value back.
function cyclicSelf(self, z, De, p) {
  if (!(p.mu < 1)) return self;
  const Dx = 1.02 * Math.sqrt(24 * p.diffusivityM2h), rho = p.soilKmW;
  return Dx <= De ? p.mu * self : rho / (2 * PI) * (Math.log(Dx / De) + p.mu * Math.log(4 * z / Dx));
}
// ---------------------------------------------------------------------------------------------------------------
// Solve: the smallest gap that meets every rating, for one arrangement.

/**
 * solveGap(circuits, g, env) -> { ok, gapM, layout, thermal } : the smallest clear gap between circuit groups
 * (at least the practical minimum) at which every conductor is within its limit. ok=false when even a very
 * wide gap fails (the circuits in that arrangement are too hot: another arrangement or a larger conductor).
 */
export function solveGap(circuits, g, env = {}, { maxGapM = 3 } = {}) {
  const p = { ...DEFAULTS, ...env, ...g }, min = g.minGapM ?? p.minGapMm / 1000;
  const at = gap => { const layout = place(circuits, { ...g, gapM: gap }); return { layout, thermal: temperatures(layout, env) }; };
  let lo = at(min);
  if (lo.thermal.factor >= 1) return { ok: true, gapM: min, ...lo };
  let hi = at(maxGapM);
  if (hi.thermal.factor < 1) return { ok: false, gapM: maxGapM, ...hi };
  let a = min, b = maxGapM;
  for (let k = 0; k < 40 && b - a > 0.005; k++) { const m = (a + b) / 2; if (at(m).thermal.factor >= 1) b = m; else a = m; }
  // Up to the 25 mm grid, then down while the step below still rates: the smallest grid gap that meets the rating.
  let gap = Math.max(min, Math.ceil(b * 40 - 1e-9) / 40), best = at(gap);
  for (let q = Math.round(gap * 40 - 1) / 40, t; q >= min - 1e-9 && (t = at(q)).thermal.factor >= 1; q = Math.round(q * 40 - 1) / 40) { gap = q; best = t; }
  return { ok: true, gapM: gap, ...best };
}
// ---------------------------------------------------------------------------------------------------------------
// The section: layer stack, markers and volumes per metre for a solved layout.

/** section(solved, env) -> per-trench stack and per-metre volumes (bank m3/m), plus a readout. */
export function section(solved, circuits, env = {}) {
  const p = { ...DEFAULTS, ...env }, L = solved.layout, cls = worstClass(circuits);
  const bed = p.bedMm / 1000;
  return L.trenches.map((t, k) => {
    const mine = L.sources.filter(s => s.u >= t.u0 && s.u <= t.u0 + t.width);
    const topItem = Math.min(...mine.map(s => s.z - s.D / 2)), bottomItem = Math.max(...mine.map(s => s.z + s.D / 2));
    const depth = round(bottomItem + bed, 0.025), w = round(t.width, 0.05);
    const surroundTop = Math.max(0.15, topItem - p.surroundAboveMm / 1000);
    const itemsArea = mine.reduce((s, x) => s + PI * x.D * x.D / 4, 0);
    const dug = w * depth;                                                  // vertical sides; batter adds in `ground`
    const surround = w * (depth - surroundTop) - itemsArea;                 // bed + surround material
    const topsoil = w * Math.min(p.topsoilM, surroundTop);
    const backfill = dug - surround - itemsArea;                            // includes the topsoil reinstated
    const tile = cls === 'mv' || cls === 'hv';
    const markers = [
      ...(tile ? [{ kind: 'tile', depth: round(surroundTop, 0.005), width: round(w - 0.1, 0.05) }] : []),
      // Wide trenches carry several tapes side by side so a later dig meets one wherever it opens the ground
      // (IEC TS 62738 7.3.4.9.2 asks for this; one per 0.5 m of cable width is our own rule).
      { kind: 'tape', depth: round(Math.max(0.15, topItem - p.tapeAboveMm / 1000), 0.005), count: Math.max(1, Math.ceil((w - 2 * p.sideClearMm / 1000) / 0.5)),
        note: 'yellow, service named along it' }
    ];
    // Deeper than 1.2 m the sides are supported or battered (general excavation practice, HSE HSG47; cleared rule).
    const support = depth > 1.2 ? 'support (trench box or sheets) or batter the sides' : 'none needed in firm ground; check on site';
    return {
      trench: k + 1, width: w, depth, coverToTop: round(topItem, 0.005), bed, surroundTop: round(surroundTop, 0.005),
      circuits: new Set(mine.map(s => s.circuit)).size, markers, support,
      perMetre: { dugBank: r3(dug), spoilLoose: r3(dug * p.bulking), topsoil: r3(topsoil), beddingSurround: r3(surround),
        backfillReuse: r3(backfill), ductsOrCables: r3(itemsArea) }
    };
  });
}

function worstClass(circuits) { const o = ['dc', 'lv', 'mv', 'hv']; return circuits.map(c => c.cls).sort((a, b) => o.indexOf(b) - o.indexOf(a))[0]; }
const round = (x, q) => Math.ceil(x / q - 1e-9) * q;
const r3 = x => Math.round(x * 1000) / 1000;

// ---------------------------------------------------------------------------------------------------------------
// Options for one case: one trench, split, two layers, larger conductor; each solved and sized.

/**
 * designOptions({ circuits, landUse, env, upsize }) -> { cover, options: [...] }
 * upsize(circuit) -> a circuit with a larger conductor (optional).
 */
export function designOptions({ circuits, landUse = 'farmland', env = {}, upsize = null, maxTrenches = 6, coverM = null }) {
  const p = { ...DEFAULTS, ...env }, cls = worstClass(circuits), cover = coverM ?? (COVER[landUse] || COVER.farmland)[cls];
  const opts = [];
  const add = (name, cs, g, extra = {}) => {
    const s = solveGap(cs, { cover, ...g }, env);
    const sec = section(s, cs, env);
    const widest = Math.max(...sec.map(t => t.width));
    opts.push({
      name, ok: s.ok, fitsOneBucket: widest <= p.maxWidthM + 1e-9, gapM: s.gapM, trenches: sec.length,
      layers: g.layers || 1, corridorM: round(s.layout.corridor, 0.05), widestM: widest, deepestM: Math.max(...sec.map(t => t.depth)),
      hottestC: r1(s.thermal.hottest.temp), ratingFactor: r3(s.thermal.factor),
      perMetre: sumPerMetre(sec), sections: sec, ...extra
    });
  };
  add('one trench, one layer', circuits, { trenches: 1, layers: 1 });
  add('one trench, two layers', circuits, { trenches: 1, layers: 2 });
  for (let n = 2; n <= maxTrenches; n++) {
    add(`${n} trenches side by side, ${p.betweenTrenchesM} m apart`, circuits, { trenches: n, layers: 1 });
    if (opts[opts.length - 1].fitsOneBucket && opts[opts.length - 1].ok) break;
  }
  if (upsize) {
    const big = circuits.map(upsize);
    add(`larger conductor (${big[0].cable.areaMm2} mm2 ${big[0].cable.material}), one trench`, big, { trenches: 1, layers: 1 }, { conductor: big[0].cable.areaMm2 });
    for (let n = 2; n <= maxTrenches; n++) {
      add(`larger conductor, ${n} trenches`, big, { trenches: n, layers: 1 }, { conductor: big[0].cable.areaMm2 });
      if (opts[opts.length - 1].fitsOneBucket && opts[opts.length - 1].ok) break;
    }
  }
  return { cover, landUse, coverBasis: COVER.basis, cls, options: opts };
}

function sumPerMetre(sec) {
  const o = {};
  for (const t of sec) for (const [k, v] of Object.entries(t.perMetre)) o[k] = r3((o[k] || 0) + v);
  return o;
}
const r1 = x => Math.round(x * 10) / 10;

/** Check a drawn section as it stands: circuits at a centre pitch in one row at a cover. */
export function checkDrawn(circuits, { cover, pitchM }, env = {}) {
  const w = footprint(circuits[0]).w;
  const layout = place(circuits, { cover, gapM: Math.max(0, pitchM - w), trenches: 1, layers: 1 });
  return { layout, thermal: temperatures(layout, env) };
}
// ---------------------------------------------------------------------------------------------------------------
// Along the route: draw pits, pull sections, joint bays.

export const PULL = Object.freeze({
  friction: 0.35,                 // cable on a lubricated PE duct (typical 0.2-0.5; own conservative choice)
  frictionDirect: 0.5,            // cable on rollers in an open trench, allowing for roller drag (own choice)
  tensileNmm2: { al: 30, cu: 50 },// cleared generic rule: pulling-eye limit per mm2 of conductor
  sidewallNm: 3000,               // bend sidewall pressure limit, N per m of bend radius (typical for XLPE, to agree)
  pitAtTurnDeg: 10,               // a change of direction above this gets a draw pit (cleared rule: every change of direction)
  drumM: 800,                     // one cable length on a drum (input: depends on size and drum; joint bays at this)
  jointBay: { lengthM: 4.0, extraWidthM: 0.6 },   // typical joint bay for LV/MV single-core (design choice)
  pit: { internalM: [1.2, 0.9], covers: 'D400 where vehicles run, C250 elsewhere (cleared rule)' },
  basis: 'capstan relation; limits are inputs and the cable maker\'s figures govern'
});

/**
 * pullPlan(route, circuit, { ducted }) -> { pits, jointBays, sections }. circuit.maxPullN (or pull.maxPullN): the maker's absolute cap, N.
 * route: [[x, y], ...] in metres. A pit at every change of direction over pitAtTurnDeg (ducted runs; the cable
 * then pulls straight through each), and more wherever the tension or the drum length would be exceeded. Pulls are
 * worked from one end; a bend inside a pull multiplies the tension by e^(mu theta).
 */
export function pullPlan(route, ct, { ducted = true, pull = PULL } = {}) {
  const cb = cable(ct.cable), phases = ct.formation === 'duct-bundle' ? (ct.perDuct || 1) : ducted ? 1 : 3;
  const mu = ducted ? pull.friction : pull.frictionDirect, wN = cb.weightNm * phases;
  const stressN = pull.tensileNmm2[cb.material] * ct.cable.areaMm2 * phases, capN = ct.maxPullN ?? pull.maxPullN;
  const Tmax = capN > 0 ? Math.min(stressN, capN) : stressN;   // the conductor stress limit, capped by the maker's maximum
  // Walk the polyline: segment lengths and turn angles.
  const segs = [];
  for (let i = 1; i < route.length; i++) {
    const [ax, ay] = route[i - 1], [bx, by] = route[i];
    segs.push({ len: Math.hypot(bx - ax, by - ay), dir: Math.atan2(by - ay, bx - ax) });
  }
  const turn = i => { let d = Math.abs(segs[i].dir - segs[i - 1].dir) % (2 * PI); return d > PI ? 2 * PI - d : d; };
  const pits = [], jointBays = [], sections = [];
  let T = 0, run = 0, drum = 0, chain = 0, start = 0;
  const cut = (at, why) => { sections.push({ from: r1(start), to: r1(at), lengthM: r1(at - start), tensionN: Math.round(T), limitN: Math.round(Tmax) }); start = at; T = 0; run = 0; };
  segs.forEach((s, i) => {
    if (i > 0) {
      const th = turn(i);
      if (ducted && th * 180 / PI > pull.pitAtTurnDeg) { pits.push({ at: r1(chain), why: 'change of direction' }); cut(chain, 'turn'); }
      else T *= Math.exp(mu * th);
    }
    // Along the segment in 1 m steps so the pit or joint lands where the limit is reached.
    for (let x = 0; x < s.len; x += 1) {
      const dl = Math.min(1, s.len - x);
      if (T + mu * wN * dl > Tmax) { if (ducted) pits.push({ at: r1(chain), why: 'pulling tension' }); else jointBays.push({ at: r1(chain), why: 'pulling tension' }); cut(chain); }
      if (drum + dl > pull.drumM) { jointBays.push({ at: r1(chain), why: 'drum length' }); drum = 0; if (!ducted) cut(chain); }
      T += mu * wN * dl; chain += dl; run += dl; drum += dl;
    }
  });
  cut(chain);
  // A joint must sit in a pit or joint bay, never direct-buried (cleared rule); in a ducted run it goes in a pit.
  return { lengthM: r1(chain), pits, jointBays, sections, limitN: Math.round(Tmax), weightNm: r3(wN), friction: mu };
}
