// The pair's key set: synthetic plants (anonymous test land, no site) whose table addresses and anchors
// are fixed integer functions of an ordinal. Used by the tests and by export-electron.mjs; the CuPy
// positron reads the addresses and anchors from the electron file, it does not share this code.

import { plantRecord } from './procedural-detail.mjs';

export const PLANTS = Object.freeze([
  { name: 'p30', seed: 20260927, headingDeg: 23.5, table: {} },
  // modules in series changed (28 a string, 88 columns: a short last string) to prove the typed change
  { name: 'p28', seed: 7, headingDeg: -61, table: { modulesPerString: 28, columns: 88, tilt: 25, pileLines: 17 } }
]);

// ordinal n -> address: k bits 0-1, s bit 2, j bits 3-6, r bits 7-9, i the rest (a bijection).
export function address(n) { return { k: n & 3, s: (n >> 2) & 1, j: (n >> 3) & 15, r: (n >> 7) & 7, i: n >> 10 }; }

// Anchor in integer mm: a spread over +-3 km including negatives (exercises floor division), z 0..4.999 m.
export function anchor(n) {
  const a = address(n);
  return [(a.k * 2 + a.s) * 31_417 + a.j * 263_000 - 2_900_000 + a.i * 7, a.r * 129_050 + a.i * 1_032_400 - 3_000_000, (n * 37) % 5000];
}

export const records = () => PLANTS.map(p => ({ name: p.name, rec: plantRecord(p) }));
