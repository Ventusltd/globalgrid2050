// module-geometry.mjs: one module drawn from its catalogue class and the table face it sits on, level by level.
// Nothing per module is stored: a module is its key (face, row, column); its corners come from the face's at(s, t),
// its detail from the class (cellGrid in module-catalogue.mjs). Same key, same class, same lines, every time.
//
// A face is { key, span, run, at(s, t) -> [e, n, z], stringOf(row, col, perString) } in national-grid metres:
// s runs along the row, t up the slope from the low edge. Modules stand portrait (width along s, length along t) unless
// the face says orient 'landscape' (a 3L-6L table): then the length lies along s and the width up the slope.
// Levels: 1 frame, laminate edge and cell grid; 2 busbars and the half-cut split line;
//         3 the back: frame depth and flange, split junction boxes, leads and connectors to the next module in the
//           string, mounting, tracker and grounding holes, drain holes, purlin contact lines, the label.
// Pure: no DOM.

import { sizeM, cellGrid, faceFit, splitRow } from './module-catalogue.mjs';

export const PARTS = Object.freeze(['frame', 'cells', 'bus', 'split', 'back', 'cable', 'holes']);
export const LEVEL_OF = Object.freeze({ frame: 1, cells: 1, bus: 2, split: 2, back: 3, cable: 3, holes: 3 });
export const VERTEX_BUDGET = 12000; // every detailed module together, line vertices

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = a => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const grids = new WeakMap();
const gridOf = c => { let g = grids.get(c); if (!g) grids.set(c, (g = cellGrid(c))); return g; };

/** Where module (row, col) of class c sits on a face: its corners, normal and the frame to place points. */
export function placeModule(face, row, col, c) {
  const [L, W] = sizeM(c), land = face.orient === 'landscape', fit = faceFit(c, face.span, face.run, undefined, face.orient), g = fit.gapM;
  const ds = land ? L : W, dt = land ? W : L;                   // the module's footprint along the row and up the slope
  const s0 = (face.span - (fit.columns * (ds + g) - g)) / 2 + col * (ds + g), t0 = (face.run - (fit.rows * (dt + g) - g)) / 2 + row * (dt + g);
  // P10 steps across the module's width, P01 along its length: landscape turns both a quarter turn on the face.
  const P00 = face.at(s0, t0), P10 = land ? face.at(s0, t0 + W) : face.at(s0 + W, t0), P01 = land ? face.at(s0 + L, t0) : face.at(s0, t0 + L);
  const P11 = face.at(s0 + ds, t0 + dt);
  let nrm = unit(cross(sub(P10, P00), sub(P01, P00)));
  if (nrm[2] < 0) nrm = nrm.map(x => -x);
  const centre = [0, 1, 2].map(i => (P00[i] + P10[i] + P01[i] + P11[i]) / 4);
  // pt(fs, ft, h): fs across the width, ft along the length (fractions, may pass 1 for leads), h metres off the glass.
  const pt = (fs, ft, h = 0) => [0, 1, 2].map(i => P00[i] + (P10[i] - P00[i]) * fs + (P01[i] - P00[i]) * ft
    + (P11[i] - P10[i] - P01[i] + P00[i]) * fs * ft + nrm[i] * h);
  return { P00, P10, P01, P11, centre, normal: nrm, pt, W, L, D: c.size_mm[2] / 1000, fit, gap: g };
}

/** Every module key on a face for a class: [row, col] pairs in row order. */
export function moduleCount(face, c) { const f = faceFit(c, face.span, face.run, undefined, face.orient); return f.rows * f.columns; }

/**
 * Lines for one module at a level into out[part] (flat x, y, z relative to base). grow[level] in 0..1 plays the
 * expand: a level's lines open out from the module centre as it arrives. info: face.stringOf(row, col, perString).
 */
export function moduleLines(M, c, level, out, base, grow = {}, info = null) {
  const g = gridOf(c), k = l => 0.25 + 0.75 * Math.min(1, Math.max(0, grow[l] ?? 1));
  let part = null, kk = 1;
  const P = (fs, ft, h) => { const p = M.pt(0.5 + (fs - 0.5) * kk, 0.5 + (ft - 0.5) * kk, h); return [p[0] - base[0], p[1] - base[1], p[2] - base[2]]; };
  const seg = (a, b) => { if (part) out[part].push(...a, ...b); };
  const line = (s0, t0, s1, t1, h) => seg(P(s0, t0, h), P(s1, t1, h));
  const rect = (s0, t0, s1, t1, h) => { line(s0, t0, s1, t0, h); line(s1, t0, s1, t1, h); line(s1, t1, s0, t1, h); line(s0, t1, s0, t0, h); };
  const box = (s0, t0, s1, t1, h0, h1) => { rect(s0, t0, s1, t1, h0); rect(s0, t0, s1, t1, h1);
    for (const [s, t] of [[s0, t0], [s1, t0], [s1, t1], [s0, t1]]) seg(P(s, t, h0), P(s, t, h1)); };
  const use = (name) => { const l = LEVEL_OF[name]; part = l in grow && !(grow[l] > 0) ? null : name; kk = k(l); }; // not opened yet: skipped
  const lift = 0.003; // front lines sit just above the glass so they are not lost in the table outline

  if (level >= 1) {
    use('frame'); rect(0, 0, 1, 1, lift); rect(...g.laminate, lift);
    use('cells');
    const [ls0, , ls1] = g.laminate, cols = c.cells.columns, rows = c.cells.rows, half = splitRow(c);
    for (const [r0, r1] of [[0, half], [half, rows]]) {
      const top = g.cells[(r1 - 1) * cols][3], bot = g.cells[r0 * cols][1];
      for (let q = 0; q < cols; q++) { const [s0, , s1] = g.cells[q]; line(s0, bot, s0, top, lift); line(s1, bot, s1, top, lift); }
      for (let r = r0; r < r1; r++) line(ls0, g.cells[r * cols][1], ls1, g.cells[r * cols][1], lift);
      line(ls0, top, ls1, top, lift);
    }
  }
  if (level >= 2) {
    use('bus');
    const rows = c.cells.rows, cols = c.cells.columns, half = splitRow(c);
    for (const [r0, r1] of [[0, half], [half, rows]]) {
      const bot = g.cells[r0 * cols][1], top = g.cells[(r1 - 1) * cols][3];
      for (const s of g.bus) line(s, bot, s, top, lift);
    }
    use('split'); line(g.laminate[0], g.split, g.laminate[2], g.split, lift * 2); line(0, g.split, 1, g.split, lift * 2);
  }
  if (level >= 3) {
    const D = M.D, fl = c.frame.flange_mm / 1000 / M.W, flT = c.frame.flange_mm / 1000 / M.L, back = -D;
    use('back');
    box(0, 0, 1, 1, 0, back);                                 // frame depth
    rect(fl, flT, 1 - fl, 1 - flT, back);                     // inner edge of the back flange
    const [bw, bl, bh] = c.junction_boxes.box_mm.map(v => v / 1000), jb = c.junction_boxes.positions;
    const zj = -0.004;                                        // boxes sit on the rear glass or backsheet
    for (const [s, t] of jb) box(s - bw / 2 / M.W, t - bl / 2 / M.L, s + bw / 2 / M.W, t + bl / 2 / M.L, zj, zj - bh);
    rect(0.4, 0.86, 0.6, 0.93, zj);                           // the label (position assumed)
    for (const tm of c.holes[0].t_mm) {                       // purlins meet the frame at the outer mounting holes
      const t = 0.5 + tm / 1000 / M.L;
      if (Math.abs(tm) === Math.max(...c.holes[0].t_mm.map(Math.abs))) { line(-0.01, t, 1.01, t, back - 0.004); line(-0.01, t, 1.01, t, back - 0.06); }
    }
    use('holes');
    for (const h of c.holes) for (const tm of h.t_mm) for (const s of [fl / 2, 1 - fl / 2]) {
      const t = 0.5 + tm / 1000 / M.L, hs = h.size_mm[0] / 2000 / M.W, ht = h.size_mm[1] / 2000 / M.L;
      rect(s - hs, t - ht, s + hs, t + ht, back - 0.001);
    }
    for (let i = 0; i < c.drain_holes; i++) {                 // drain holes near the corners of the lower frame
      const s = [0.04, 0.12, 0.88, 0.96][i % 4], t = i < 4 ? 0.004 : 0.996;
      line(s - 0.01, t, s + 0.01, t, back - 0.001);
    }
    use('cable');
    const dz = zj - bh / 2, jm = jb[0], jp = jb[jb.length - 1], span = (1 - jp[0]) + jm[0] + (M.gap ?? 0.02) / M.W;
    const pm = c.cable.plus_mm / 1000 / M.W, mm = c.cable.minus_mm / 1000 / M.W, mate = span * pm / (pm + mm);
    const lead = (s0, t, len, dir, end) => {               // a lead from its box to its connector; slack hangs lower
      const s1 = s0 + dir * (end ? len : Math.min(len, dir > 0 ? mate : span - mate)), sag = Math.max(0.02, (len - Math.abs(s1 - s0)) * M.W / 2);
      const mid = (s0 + s1) / 2, drop = end ? 0.12 : 0;
      seg(P(s0, t, dz), P(mid, t, dz - sag)); seg(P(mid, t, dz - sag), P(s1, t, dz - 0.02)); seg(P(s1, t, dz - 0.02), P(s1, t, dz - 0.02 - drop));
      const cs = 0.06 / M.W, ct = 0.012 / M.L;                 // the connector body
      box(Math.min(s1, s1 - dir * cs), t - ct, Math.max(s1, s1 - dir * cs), t + ct, dz - 0.01 - drop, dz - 0.03 - drop);
    };
    const first = !info || info.position === 1, last = !info || info.position === info.of;
    lead(jp[0], jp[1], pm, 1, last);    // + to the next module's - (or, at the string end, down to the string cable)
    lead(jm[0], jm[1], mm, -1, first);  // - from the previous module's +
  }
  return out;
}

/** Vertex counts a module adds at each level (for the budget), measured once per class. */
export function levelCost(c) {
  const face = { span: 10, run: 10, at: (s, t) => [s, t, 0] }, M = placeModule(face, 0, 0, c), n = [];
  for (let l = 1; l <= 3; l++) { const o = Object.fromEntries(PARTS.map(p => [p, []])); moduleLines(M, c, l, o, [0, 0, 0]);
    n.push(PARTS.reduce((a, p) => a + o[p].length / 3, 0)); }
  return n; // [level 1, level 2, level 3] totals
}
