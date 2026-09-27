// Procedural table detail: every module corner, string and pile of one table generated from its key.
//
// Rule: trig is evaluated ONCE per plant (plantRecord) and carried as Q16 integers; per-detail maths is
// integer only (+ - x and floor division, exact in float64 below 2^53), so the JS page, CuPy and NumPy
// produce the same Int32 millimetre buffer bit for bit. No Math.random; randomness only where the rules
// are silent (pile embed), drawn from mulberry32(fnv1a("<seed>|<table key>|piles")).
//
// Table rules default to the owner's station table (station.mjs STATION_DEFAULTS: 5 rows x 90 columns a
// face, two faces, 1.303 x 2.384 m modules, 0.02 m gap, 10 deg, 30 modules a string, 0.5 m ridge gap,
// 1.2 m lowest edge, 0.9 m underside). Pile embed and its +-0.2 m spread are ILLUSTRATIVE, not designed.
// Illustrative - early design, no warranty; confirm with a qualified engineer.

import { tableKey, detailSeed, mulberry32, intIn, mm } from './procedural-key.mjs';

export const Q = 65536;                 // Q16 fixed point for the plant's trig constants
export const MAGIC = 0x31304450;        // "PD01" little-endian
export const RULES_VERSION = 1;
export const HEADER = 8;                // magic, rules version, modules, piles, anchor x/y/z, strings a table

export const TABLE_DEFAULTS = Object.freeze({
  rows: 5, columns: 90, moduleWidth: 1.303, moduleLength: 2.384, moduleGap: 0.02, tilt: 10,
  ridgeGap: 0.5, height: 1.2, underside: 0.9, modulesPerString: 30,
  pileLines: 19, pileEmbed: 1.6, pileSpread: 0.2
});

// The plant record: all floats become integers here, once. headingDeg is compass (0 = table +y north).
export function plantRecord({ seed = 20260927, headingDeg = 0, table = {} } = {}) {
  const t = { ...TABLE_DEFAULTS, ...table }, R = Math.PI / 180;
  const L = mm(t.moduleLength), W = mm(t.moduleWidth), G = mm(t.moduleGap);
  const cosT = Math.round(Math.cos(t.tilt * R) * Q), sinT = Math.round(Math.sin(t.tilt * R) * Q);
  const run = t.rows * (L + G) - G;
  const rec = {
    seed: seed >>> 0, rulesVersion: RULES_VERSION,
    rows: t.rows, columns: t.columns, L, W, G, halfGap: Math.floor(mm(t.ridgeGap) / 2),
    height: mm(t.height), underside: mm(t.underside), mps: t.modulesPerString,
    cosT, sinT, cosH: Math.round(Math.cos(headingDeg * R) * Q), sinH: Math.round(Math.sin(headingDeg * R) * Q),
    run, depth: Math.floor(run * cosT / Q), span: t.columns * (W + G) - G,
    pileLines: t.pileLines, pileEmbed: mm(t.pileEmbed), pileSpread: mm(t.pileSpread)
  };
  for (const [k, v] of Object.entries(rec)) if (!Number.isSafeInteger(v)) throw new RangeError(`plant record ${k} is not an integer: ${v}`);
  if (rec.rows < 1 || rec.columns < 1 || rec.mps < 1 || rec.pileLines < 2) throw new RangeError('plant record: rows, columns, modules a string >= 1, pile lines >= 2');
  return Object.freeze(rec);
}

export const groupsPerRow = p => Math.ceil(p.columns / p.mps);
export const stringsPerTable = p => 2 * p.rows * groupsPerRow(p);
export const modulesPerTable = p => 2 * p.rows * p.columns;
export const pilesPerTable = p => 2 * p.pileLines;
export const tableInts = p => HEADER + modulesPerTable(p) * 12 + pilesPerTable(p) * 4;
export const tableBytes = p => tableInts(p) * 4;

const fl = (a, b) => Math.floor(a / b);   // exact: |a| < 2^53, b = 2^16 or a small integer

// Module n of a table (build order: face -1 then +1, row 0..rows-1, column 0..columns-1) and its string.
export function moduleAddress(p, n) {
  const perFace = p.rows * p.columns, face = n < perFace ? 0 : 1, rest = n - face * perFace;
  const row = fl(rest, p.columns), column = rest - row * p.columns, g = groupsPerRow(p);
  return { face, side: face ? 1 : -1, row, column, string: (face * p.rows + row) * g + fl(column, p.mps), inString: column % p.mps };
}

// Rotate a local (x across, y along) mm vector by the plant heading and add the anchor.
const place = (p, ax, ay, lx, ly) => [ax + fl(lx * p.cosH + ly * p.sinH, Q), ay + fl(ly * p.cosH - lx * p.sinH, Q)];

// The detail of one table as an Int32Array in millimetres, plant-relative.
// anchor: [x, y, z] integer mm of the table's ridge-centre foot (from the plant layout, quantised once).
export function generateTable(p, addr, anchor) {
  const key = tableKey(addr), seed = detailSeed(p.seed, key, 'piles');
  const [ax, ay, az] = anchor.map(v => { if (!Number.isSafeInteger(v) || Math.abs(v) > 2e9) throw new RangeError(`anchor must be integer mm, got ${v}`); return v; });
  const nM = modulesPerTable(p), nP = pilesPerTable(p), out = new Int32Array(tableInts(p));
  out[0] = MAGIC; out[1] = p.rulesVersion; out[2] = nM; out[3] = nP; out[4] = ax; out[5] = ay; out[6] = az; out[7] = stringsPerTable(p);
  const dvs = [0, p.L, p.L, 0], dus = [0, 0, p.W, p.W];
  let o = HEADER;
  for (let side = -1; side <= 1; side += 2) for (let r = 0; r < p.rows; r++) {
    const rr = side === 1 ? p.rows - 1 - r : r, v0 = rr * (p.L + p.G);
    for (let c = 0; c < p.columns; c++) {
      const u0 = c * (p.W + p.G);
      for (let k = 0; k < 4; k++) {
        const vv = v0 + dvs[k];
        const lx = side * (p.halfGap + p.depth - fl(vv * p.cosT, Q)), ly = u0 + dus[k];
        const [x, y] = place(p, ax, ay, lx, ly);
        out[o++] = x; out[o++] = y; out[o++] = az + p.height + fl(vv * p.sinT, Q);
      }
    }
  }
  const next = mulberry32(seed), px = p.halfGap + fl(p.depth, 2);
  for (let line = 0; line < p.pileLines; line++) {
    const ly = fl(line * p.span, p.pileLines - 1);
    for (let side = -1; side <= 1; side += 2) {
      const [x, y] = place(p, ax, ay, side * px, ly);
      out[o++] = x; out[o++] = y; out[o++] = az + p.underside;
      out[o++] = intIn(next(), p.pileEmbed - p.pileSpread, p.pileEmbed + p.pileSpread);
    }
  }
  return { key, seed, buf: out, bytes: out.byteLength };
}

// Read-back helpers for the renderer and the pickers (views, no copies).
export const moduleCorners = (p, buf, n) => buf.subarray(HEADER + n * 12, HEADER + n * 12 + 12);
export function pile(p, buf, n) { const s = HEADER + modulesPerTable(p) * 12 + n * 4; return buf.subarray(s, s + 4); }
export function stringModules(p, s) {
  const g = groupsPerRow(p), faceRow = fl(s, g), group = s - faceRow * g, face = fl(faceRow, p.rows), row = faceRow - face * p.rows;
  const rowStart = face * p.rows * p.columns + row * p.columns, first = rowStart + group * p.mps;
  return { face, row, group, first, count: Math.min(first + p.mps, rowStart + p.columns) - first };
}

// Float32 positions relative to the table anchor, in metres, for a GPU buffer (the camera stays float64).
export function toLocalFloat32(buf) {
  const nM = buf[2], out = new Float32Array(nM * 12), ax = buf[4], ay = buf[5], az = buf[6];
  for (let i = 0; i < nM * 4; i++) {
    const s = HEADER + i * 3;
    out[i * 3] = (buf[s] - ax) / 1000; out[i * 3 + 1] = (buf[s + 1] - ay) / 1000; out[i * 3 + 2] = (buf[s + 2] - az) / 1000;
  }
  return out;
}
