// COPIED UNCHANGED from the v12 world (web/world/plant-packing.mjs) at v12 commit 3adcee9 (file last changed a83209f). Modular star family: public #147017 slice.
// Do not edit here: change the source and re-copy. Everything below this header is byte-identical to the source.
// plant-packing.mjs: how the tables of a plant fill its land. Two packings, both typed (packing fields | packing bands):
//
//   bands   the v09 rule: one row frame over the whole boundary, an east-west track every band (bandTargetM), runs of
//           tables at fixed places from the spine with a cross lane every run (runTargetM), whole tables only.
//   fields  a plant made of hedged fields packed as one set: each field keeps its own row origin (rows start at its own
//           south edge), its own slope-aware row gaps, and its own run origin (tables start at its own west edge, not
//           on a grid laid from the spine); half tables close the row ends; one spine, one compound and one set of
//           tracks serve every field, and tracks come only every bandTargetM (400 m by default: every table within
//           about 200 m of a road; the rows between are walked or driven down the row gaps). Edges a field shares with
//           another (a hedge between two fields of the plant) keep the hedge setback; outer edges keep the fence setback.
//
// Why: an open-data study of large operational UK plants found the v09 packing drew a median of about 0.72 of the rows
// built on the same land, the loss being the spine, the 150 m bands and the setbacks repeated on every hedged field;
// a fill that followed each field came within 1 % of a planning module count. Figures are illustrative rules, not a
// design; every one is typed and can be changed. Pure: no DOM, no imports.

export const PACKINGS = Object.freeze(['fields', 'bands']);
// Defaults the fields packing puts under whatever the owner typed (bands keeps the v09 figures of LAYOUT_DEFAULTS).
export const FIELD_DEFAULTS = Object.freeze({ bandTargetM: 400, runTargetM: 280, crossLaneM: 4 });
export const HEDGE_NEAR_M = 30; // an edge within this of another field of the plant is a hedge between them

const segDist = (x, y, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay, d2 = dx * dx + dy * dy, t = d2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / d2)) : 0;
  return Math.hypot(x - ax - t * dx, y - ay - t * dy);
};
const insidePoly = (poly, x, y) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
};

/** A boundary as a list of fields: one ring [[x, y]...] or several [[[x, y]...]...]. */
export function fieldsOf(boundary) {
  const b = boundary || [];
  return Array.isArray(b[0]?.[0]) ? b.filter(f => Array.isArray(f) && f.length >= 3) : [b];
}

/**
 * The fields in the layout frame with their setbacks: each edge takes the hedge setback where it lies within
 * HEDGE_NEAR_M of another field, else the fence setback. Returns { list, ok(u, v), okIn(i, u, v), inAny(u, v), box }.
 */
export function fieldSet(polys, { fenceSetbackM, hedgeSetbackM = fenceSetbackM }) {
  const list = polys.map(poly => {
    const box = [Math.min(...poly.map(q => q[0])), Math.max(...poly.map(q => q[0])), Math.min(...poly.map(q => q[1])), Math.max(...poly.map(q => q[1]))];
    return { poly, box, sb: null };
  });
  for (const [i, f] of list.entries()) {
    f.sb = f.poly.map((q, k) => {
      if (list.length < 2) return fenceSetbackM;
      const a = f.poly[(k || f.poly.length) - 1], mx = (a[0] + q[0]) / 2, my = (a[1] + q[1]) / 2;
      const near = list.some((g, j) => j !== i && mx > g.box[0] - HEDGE_NEAR_M && mx < g.box[1] + HEDGE_NEAR_M && my > g.box[2] - HEDGE_NEAR_M
        && my < g.box[3] + HEDGE_NEAR_M && g.poly.some((p, m) => segDist(mx, my, ...g.poly[(m || g.poly.length) - 1], ...p) < HEDGE_NEAR_M));
      return near ? Math.min(hedgeSetbackM, fenceSetbackM) : fenceSetbackM;
    });
  }
  const within = (f, u, v) => u >= f.box[0] && u <= f.box[1] && v >= f.box[2] && v <= f.box[3] && insidePoly(f.poly, u, v);
  const okIn = (i, u, v) => {
    const f = list[i];
    if (!within(f, u, v)) return false;
    for (let k = 0, j = f.poly.length - 1; k < f.poly.length; j = k++) if (segDist(u, v, ...f.poly[j], ...f.poly[k]) < f.sb[k] - 1e-9) return false;
    return true;
  };
  const all = list.flatMap(f => f.poly);
  return { list, okIn, ok: (u, v) => list.some((f, i) => okIn(i, u, v)), inAny: (u, v) => list.some(f => within(f, u, v)),
    box: [Math.min(...all.map(q => q[0])), Math.max(...all.map(q => q[0])), Math.min(...all.map(q => q[1])), Math.max(...all.map(q => q[1]))] };
}

/** Where a horizontal line v crosses a ring: the inside intervals [[u0, u1]...], sorted. */
export function slice(poly, v) {
  const xs = [];
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > v) !== (yj > v)) xs.push(xi + (v - yi) * (xj - xi) / (yj - yi));
  }
  xs.sort((a, b) => a - b);
  const out = [];
  for (let k = 0; k + 1 < xs.length; k += 2) out.push([xs[k], xs[k + 1]]);
  return out;
}
const intersect = (A, B) => {
  const out = [];
  for (const [a0, a1] of A) for (const [b0, b1] of B) { const lo = Math.max(a0, b0), hi = Math.min(a1, b1); if (hi > lo) out.push([lo, hi]); }
  return out;
};

/**
 * Fields packing, as a generator: every table position it tries goes to c.consider(ua, ub, va, vb, meta), which runs the
 * ground, road, water and overhead-line checks and keeps or counts it. c: { fields (fieldSet), T, p, us, spineHalf,
 * tracks, trackHalf, halfLen, halfUnits, stretch(i, va, vb) -> x >= 1, consider }. Yields progress every p.chunk tries.
 */
export function* packFields(c) {
  const { fields, T, p, us, spineHalf, tracks, trackHalf } = c, step = 1, eps = 1e-9;
  const runStep = Math.max(1, Math.round(p.runTargetM / (T.lenU + p.tableGapM))) * (T.lenU + p.tableGapM) - p.tableGapM + p.crossLaneM;
  const perRun = Math.max(1, Math.round(p.runTargetM / (T.lenU + p.tableGapM)));
  let n = 0;
  const stats = { half: 0, rows: 0, stretched: 0, maxStretch: 1 };
  for (const [fi, f] of fields.list.entries()) {
    const sb0 = Math.min(...f.sb);
    let va = f.box[2] + sb0, r = 0;
    while (va + T.depth <= f.box[3] - sb0 + eps) {
      const vb = va + T.depth, tk = tracks.findIndex(t => va < t + trackHalf && vb > t - trackHalf);
      if (tk >= 0) { va = tracks[tk] + trackHalf; r = 0; continue; }     // the row starts past the track
      let k = 0;
      for (let q = 0; q < tracks.length; q++) if (tracks[q] <= va) k = q;
      const strip = intersect(intersect(slice(f.poly, va + eps), slice(f.poly, (va + vb) / 2)), slice(f.poly, vb - eps));
      // Either side of the spine; a piece that starts at the field edge starts past its setback, one at the spine does not.
      const pieces = strip.flatMap(([u0, u1]) => [[u0, Math.min(u1, us - spineHalf), sb0], [Math.max(u0, us + spineHalf), u1, u0 >= us + spineHalf ? sb0 : 0]])
        .filter(([a, b]) => b - a >= c.halfLen);
      for (const [lo, hi, in0] of pieces) {
        let a = lo + in0, inRun = 0;
        while (a + c.halfLen <= hi + eps) {
          if (++n % p.chunk === 0) yield { phase: 'tables', candidates: n, accepted: c.accepted?.() };
          let len = T.lenU;
          const fits = L => a + L <= hi + eps && [[a, va], [a + L, va], [a, vb], [a + L, vb], [a + L / 2, va], [a + L / 2, vb]].every(([u, v]) => fields.okIn(fi, u, v));
          if (!fits(len)) {
            if (p.halfTables && c.halfLen < T.lenU && fits(c.halfLen)) len = c.halfLen;
            else { a += step; inRun = 0; continue; }
          }
          const units = len < T.lenU ? c.halfUnits : 1, mid = a + len / 2;
          if (units < 1) stats.half++;
          c.consider(a, a + len, va, vb, { k, s: mid >= us ? 1 : -1, j: Math.floor(Math.abs(mid - us) / runStep), r, i: inRun, units, field: fi });
          a += len + p.tableGapM; inRun++;
          if (inRun >= perRun) { a += p.crossLaneM - p.tableGapM; inRun = 0; }
        }
      }
      stats.rows++;
      const x = c.stretch(fi, va, vb);
      if (x > 1 + 1e-6) stats.stretched++;
      stats.maxStretch = Math.max(stats.maxStretch, x);
      va += T.pitch * x; r++;
    }
  }
  return { candidates: n, ...stats };
}
