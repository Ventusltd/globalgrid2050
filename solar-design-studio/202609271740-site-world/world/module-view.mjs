// module-view.mjs: which modules are drawn in detail, and how far each has opened, from where the viewer looks.
//
// Like the zoom of the early map versions, detail opens where you look: at most CAP modules at once, those nearest
// the view ray (the screen centre) and the eye, nearest first; every other module stays the table's plain outline.
// Each chosen module opens in steps as the eye comes closer (module-geometry.mjs levels 1-3), with hysteresis on the
// choice and on every step, so nothing flickers at a boundary. Ties break on the module key, so the choice is the
// same every time for the same pose. Faces come from the Solar block (block-build.mjs) or the plant layout
// (plant-layout.mjs), read as they are: nothing per module is stored. Pure: no DOM.

import { placeModule, moduleCount } from './module-geometry.mjs';
import { faceFit } from './module-catalogue.mjs';
import { tableOrigin, tableShape } from './station.mjs';

export const CAP = 10;
export const ENTER_M = Object.freeze([22, 12, 7]);   // level 1 (frame, cells), 2 (busbars, split), 3 (the back)
export const LEAVE = 1.2;                             // a level stays until the eye is 1.2 x its entry distance away
export const KEEP = 1.1;                              // a chosen module stays chosen until another scores 1.1 x better

const lerp3 = (A, B, C, D, a, b) => [0, 1, 2].map(i => A[i] * (1 - a) * (1 - b) + B[i] * a * (1 - b) + D[i] * (1 - a) * b + C[i] * a * b);

/** Faces of the placed Solar block's drawn station: both faces of every table, riding the ground as drawn. */
export function blockFaces(built) {
  if (!built?.onTable || !built.station) return [];
  const s = built.station.params, T = tableShape(s), t = s.tilt * Math.PI / 180, out = [];
  for (let n = 0; n < s.tables; n++) for (const side of [-1, 1]) {
    const [x0, y0] = tableOrigin(n, s);
    const at = (u, v) => built.onTable(n, x0 + side * (T.halfRidgeGap + T.depth - v * Math.cos(t)), y0 + u);
    out.push({ key: `block:T${n + 1}:${side < 0 ? 'W' : 'E'}`, table: n + 1, half: side < 0 ? 'west half' : 'east half', span: T.span, run: T.run, at,
      stringOf: (row, col, mps, c) => { const f = faceFit(c, T.span, T.run), groups = Math.ceil(f.columns / mps);
        const r = side > 0 ? f.rows - 1 - row : row, g = Math.floor(col / mps);
        return { string: ((n * 2 + (side > 0 ? 1 : 0)) * f.rows + r) * groups + g + 1, position: col % mps + 1, of: Math.min(mps, f.columns - g * mps) }; } });
  }
  return out;
}

/** Faces of a plant layout: one per south-facing table, two per east-west table (either side of the ridge). */
export function plantFaces(r) {
  if (!r?.tables || !r.frame || !r.table) return [];
  const F = r.frame, T = r.table, lo = r.params.lowEdgeM, hi = lo + T.rise, out = [], tb = r.tables;
  const c = (u, v, z) => { const [e, n] = F.en(u, v); return [e, n, z]; };
  for (let q = 0, i = 0; q < tb.length; q += 6, i++) {
    const [ua, va, h0, h1, h2, h3] = tb.subarray(q, q + 6), ub = ua + T.lenU, vb = va + T.depth;
    const face = (key, A, B, C, D, k) => ({ key: `plant:T${i + 1}${key}`, table: i + 1, half: key ? (key === ':a' ? 'first side' : 'second side') : '',
      span: T.lenU, run: T.slope, at: (u, v) => lerp3(A, B, C, D, u / T.lenU, v / T.slope),
      stringOf: (row, col, mps, cls) => { const f = faceFit(cls, T.lenU, T.slope), groups = Math.max(1, Math.ceil(f.columns / mps)), g = Math.floor(col / mps);
        return { string: ((i * 2 + k) * f.rows + row) * groups + g + 1, position: col % mps + 1, of: Math.min(mps, f.columns - g * mps) }; } });
    // On its piles (v09, plant-piles.mjs): the fitted module edge heights [first, middle, far] as the plant draws them.
    const pe = r.piles?.tables?.[i]?.edges, vm = (va + vb) / 2;
    if (pe && (T.south || T.tracker)) out.push(face('', c(ua, va, pe[0][0]), c(ub, va, pe[0][1]), c(ub, vb, pe[2][1]), c(ua, vb, pe[2][0]), 0));
    else if (pe) {
      const M = c(ua, vm, pe[1][0]), N = c(ub, vm, pe[1][1]);
      out.push(face(':a', c(ua, va, pe[0][0]), c(ub, va, pe[0][1]), N, M, 0), face(':b', c(ua, vb, pe[2][0]), c(ub, vb, pe[2][1]), N, M, 1));
    } else if (T.south || T.tracker) out.push(face('', c(ua, va, h0 + lo), c(ub, va, h1 + lo), c(ub, vb, h2 + (T.tracker ? lo : hi)), c(ua, vb, h3 + (T.tracker ? lo : hi)), 0));
    else {
      const M = c(ua, vm, (h0 + h3) / 2 + hi), N = c(ub, vm, (h1 + h2) / 2 + hi);
      out.push(face(':a', c(ua, va, h0 + lo), c(ub, va, h1 + lo), N, M, 0), face(':b', c(ua, vb, h3 + lo), c(ub, vb, h2 + lo), N, M, 1));
    }
  }
  return out;
}

/** Axis-aligned box round a face (its corners and the middle of each edge), for a quick reach test. */
export function faceBox(f) {
  const p = [[0, 0], [0.5, 0], [1, 0], [0, 1], [0.5, 1], [1, 1], [0, 0.5], [1, 0.5]].map(([a, b]) => f.at(a * f.span, b * f.run));
  return [0, 1, 2].flatMap(i => [Math.min(...p.map(x => x[i])), Math.max(...p.map(x => x[i]))]);
}
const boxDist = (b, e) => Math.hypot(Math.max(b[0] - e[0], 0, e[0] - b[1]), Math.max(b[2] - e[1], 0, e[1] - b[3]), Math.max(b[4] - e[2], 0, e[2] - b[5]));

/** Faces by 50 m plan cell (a face in every cell its box touches), so a frame visits only the faces near the eye (PERF.md 1). */
export const CELL_M = 50;
export function faceGrid(faces, cell = CELL_M) {
  const g = new Map();
  for (const f of faces) {
    const [x0, x1, y0, y1] = f.box;
    for (let i = Math.floor(x0 / cell); i <= Math.floor(x1 / cell); i++) for (let j = Math.floor(y0 / cell); j <= Math.floor(y1 / cell); j++) {
      const k = `${i},${j}`; (g.get(k) || g.set(k, []).get(k)).push(f);
    }
  }
  return { cell, g };
}
/** The faces whose cells lie within r (plan) of the eye; each face once. */
export function facesNear(grid, eye, r = ENTER_M[0] * LEAVE) {
  const { cell, g } = grid, out = new Set();
  for (let i = Math.floor((eye[0] - r) / cell); i <= Math.floor((eye[0] + r) / cell); i++) {
    for (let j = Math.floor((eye[1] - r) / cell); j <= Math.floor((eye[1] + r) / cell); j++) for (const f of g.get(`${i},${j}`) || []) out.add(f);
  }
  return [...out];
}

/** Module centres of a face for a class, [x, y, z] per module in row order; cached by the caller. */
export function centresOf(f, c) {
  const n = moduleCount(f, c), fit = faceFit(c, f.span, f.run), out = new Float64Array(n * 3);
  for (let r = 0; r < fit.rows; r++) for (let q = 0; q < fit.columns; q++) out.set(placeModule(f, r, q, c).centre, (r * fit.columns + q) * 3);
  return { centres: out, columns: fit.columns, rows: fit.rows };
}

/** The level a module shows at eye distance d, given the level it showed last frame (hysteresis on each step). */
export function levelAt(d, prev = 0) {
  let l = 0;
  for (let k = 1; k <= 3; k++) if (d < ENTER_M[k - 1] * (k <= prev ? LEAVE : 1)) l = k;
  return l;
}

/**
 * Choose the modules to detail. faces with .box (faceBox); eye and dir (unit) in the faces' metres;
 * prev: Map key -> level from the last choice; cache: Map for centres. Returns at most CAP picks, best first:
 * { key, face, row, col, level, d, off } (d: eye distance, off: distance from the view ray).
 */
export function choose(faces, eye, dir, c, prev = new Map(), cache = new Map(), cap = CAP) {
  const reach = ENTER_M[0] * LEAVE, found = [];
  for (const f of faces) {
    if (boxDist(f.box, eye) > reach) continue;
    const ck = `${f.key}|${c.id}`;
    let C = cache.get(ck);
    if (!C) cache.set(ck, (C = centresOf(f, c)));
    const P = C.centres;
    for (let i = 0; i < P.length; i += 3) {
      const vx = P[i] - eye[0], vy = P[i + 1] - eye[1], vz = P[i + 2] - eye[2], along = vx * dir[0] + vy * dir[1] + vz * dir[2];
      if (along <= 0) continue;
      const d = Math.hypot(vx, vy, vz), m = i / 3, row = Math.floor(m / C.columns), col = m % C.columns, key = `${f.key}/${row}/${col}`;
      const was = prev.get(key) || 0, level = levelAt(d, was);
      if (!level) continue;
      const off = Math.hypot(vx - along * dir[0], vy - along * dir[1], vz - along * dir[2]);
      found.push({ key, face: f, row, col, level, d, off, score: (off / along + 0.002 * d) / (was ? KEEP : 1) }); // angle off centre, then nearness
    }
  }
  found.sort((a, b) => a.score - b.score || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return found.slice(0, cap);
}

/** The first chosen module a ray passes through (its quad, split in two triangles), or null. */
export function hitModule(picks, c, origin, dir) {
  let best = null;
  for (const p of picks) {
    const M = placeModule(p.face, p.row, p.col, c);
    for (const [A, B, C] of [[M.P00, M.P10, M.P11], [M.P00, M.P11, M.P01]]) {
      const t = rayTri(origin, dir, A, B, C);
      if (t !== null && (!best || t < best.t)) best = { pick: p, t };
    }
  }
  return best?.pick || null;
}
function rayTri(o, d, a, b, c) { // Moller-Trumbore
  const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const p = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]], det = e1[0] * p[0] + e1[1] * p[1] + e1[2] * p[2];
  if (Math.abs(det) < 1e-12) return null;
  const s = [o[0] - a[0], o[1] - a[1], o[2] - a[2]], u = (s[0] * p[0] + s[1] * p[1] + s[2] * p[2]) / det;
  if (u < 0 || u > 1) return null;
  const q = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]], v = (d[0] * q[0] + d[1] * q[1] + d[2] * q[2]) / det;
  if (v < 0 || u + v > 1) return null;
  const t = (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) / det;
  return t > 0 ? t : null;
}

/** The string length as built for a face (user test H7): the block's inventory or the plant's template; null elsewhere. */
export function builtStringLength(face, { block = null, plant = null } = {}) {
  if (face?.key?.startsWith('block:')) return block?.summary?.inventory?.modulesPerString || null;
  if (face?.key?.startsWith('plant:')) return plant?.template?.counts?.modulesPerString || null;
  return null;
}
