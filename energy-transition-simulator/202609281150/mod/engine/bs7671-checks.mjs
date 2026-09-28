// COPIED UNCHANGED from world/v12 bs7671-checks.mjs at v12 commit 3adcee9 (file last changed 9b1ffad). Modular star family: not known to star-find.
// Do not edit here: change the source and re-copy. Everything below this header is byte-identical to the source.
// bs7671-checks.mjs: checks on the LV cable engines from a cross-check against the national wiring rules. Clauses are
// cited by number only; no table, figure or wording of the rules is held here. Every value below is ours, an input,
// and editable. Illustrative, early design, no warranty: confirm with a qualified engineer.

// ---- overload of buried cables (BS 7671 433.1.203) ----
// The general condition (433.1.1) is kept; for a cable in the ground the check is also made with the soil thermal
// resistivity raised by this factor (our sensitivity margin, not a figure from the rules), because a buried cable's
// rating falls as the ground dries. The verdict at the stated soil and at the raised soil are both reported.
export const SOIL_SENSITIVITY = 1.25;
export const BURIED = new Set(['buried', 'ducts', 'direct', 'duct']);

/** buriedOverload({ In, izAt(soilKmW), soilKmW, factor }) -> { name, ok, value, limit, soilKmW } (value In, limit Iz there). */
export function buriedOverload({ In, izAt, soilKmW, factor = SOIL_SENSITIVITY }) {
  const soil = soilKmW * factor, Iz = izAt(soil);
  return { name: `buried cable: In <= Iz at soil +${Math.round((factor - 1) * 100)} % (BS 7671 433.1.203)`, ok: In <= Iz + 1e-9,
    value: In, limit: Iz, soilKmW: soil };
}

// ---- protection of buried LV and DC cable (BS 7671 522.8.10) ----
/** buriedProtection({ armoured, ducted, kind }) -> a check: a cable in the ground needs an earthed armour or metal sheath,
 * or a duct giving like protection. Unarmoured cable laid direct fails. */
export function buriedProtection({ armoured = false, ducted = false, kind = 'LV' } = {}) {
  const ok = !!armoured || !!ducted;
  return { name: `${kind} cable in the ground: armoured and earthed, or in a duct (BS 7671 522.8.10)`, ok,
    value: armoured ? 'armoured' : ducted ? 'ducted' : 'unarmoured, laid direct', limit: 'armour or duct' };
}

// ---- disconnection time by circuit type (BS 7671 411.3.2) ----
// Distribution circuits (411.3.2.3) are allowed longer than small final circuits (411.3.2.2). The times are inputs:
// the distribution time follows 411.3.2.3; the final-circuit time is an input to set from 411.3.2.2 for the circuit.
export const DISCONNECT_S = Object.freeze({ distribution: 5, final: 0.4 });

/** disconnection(p) -> { circuit, permittedS, ia, fastIa }: Ia is the device's current at the permitted time (from its curve,
 * as a multiple of In: p.iaMultipleAtPermitted, assumed); fastIa is its instantaneous pick-up (p.tripMultiple). */
export function disconnection(p) {
  const circuit = p.circuit === 'final' ? 'final' : 'distribution', permittedS = p.permittedS ?? DISCONNECT_S[circuit];
  const mult = circuit === 'final' ? p.tripMultiple : (p.iaMultipleAtPermitted ?? p.tripMultiple);
  return { circuit, permittedS, ia: p.inA * mult, fastIa: p.inA * p.tripMultiple };
}
