// COPIED UNCHANGED from the v12 world (web/world/fault-level.mjs) at v12 commit 3adcee9 (file last changed a36f410). Modular star family: public #148423 transformerFaultKA.
// Do not edit here: change the source and re-copy. Everything below this header is byte-identical to the source.
// fault-level.mjs: prospective fault current at a solar block's LV board, by the impedance method. Pure: no imports, no DOM.
// The transformer alone gives S / (sqrt3 U z); the inverters add their own limited contribution (1.2 x rated, assumed).
// zPct is an assumption (typical for a 5 MVA unit) until the maker's test certificate gives it. Own formula, no table.

export const TX_FAULT = Object.freeze({ mva: 5, volts: 800, zPct: 7, inverters: 14, inverterKva: 352, inverterMult: 1.2, seconds: 0.2 });

/** transformerFaultKA(o) -> kA at the LV board (transformer plus inverters). */
export function transformerFaultKA(o = {}) {
  const p = { ...TX_FAULT, ...o }, tx = p.mva * 1e6 / (Math.sqrt(3) * p.volts * p.zPct / 100);
  const inv = p.inverters * p.inverterKva * 1000 / (Math.sqrt(3) * p.volts) * p.inverterMult;
  return (tx + inv) / 1000;
}
