// tables.js: WALK the tables. Real tent tables stood on the MEASURED row runs the page already holds (Scanner rows' row
// file, estimated from imagery), built from the station library, streamed around the camera and drawn through
// SIM.addBlock (the overlay's own wire layer, so the plan (bird's-eye) stays a separate, untouched layer and the morph
// raises and flattens them like every other block).
//
// The station library is IMPORTED by URL (an immutable dated release, same origin on the live site; GitHub Pages sends
// CORS for local runs), never copied: tableShape, tableStrings, inverterSite, dcDucts, dcHomeRoutes, placer.
//
// Provenance of every dimension (said on screen too):
//   row centre lines, row ends ... MEASURED from imagery (the row file; north ends trimmed by the shadow reach, 3.0 m);
//                                  each row's centre is the median of its own unbridged crossings (10 to 12 strips wide),
//                                  cell by cell; shadow-bridged blocks take a pitch comb fitted to both block edges
//   row axis, row pitch ......... MEASURED from the same runs (the axis is the mean run direction)
//   ridge height 3.0 m .......... MEASURED by shadow (the capture date's sun) +/-0.5 m
//   tilt 8 deg .................. DOCUMENTED (planning)
//   low edge 1.33 m ............. DERIVED: the measured ridge minus the documented 8 deg rise over 5 module rows (documented 1.3 to 1.5 m)
//   table width, ridge gap ...... LIBRARY: 5 module rows of 2.384 m at 8 deg gives 2 x 11.88 m + 0.5 m = 24.27 m (measured about 24.3 m)
//   module grid ................. LIBRARY module sizes (1.303 x 2.384 m), columns cut to fit each measured run
//   posts, bracing .............. ASSUMED (a typical bay, from a photograph under a table), dashed; not identifiable from imagery
//   purlins, rafters ............ ASSUMED, drawn solid (the shared wire layer has one style per segment); rails are not drawn
//   pole inverters .............. ASSUMED: every AC trench route end within a table's footprint (+2.6 m) is that table's pole;
//                                  a table with none takes the library site, drawn in a second ghost style
//   DC ducts and home cables .... LIBRARY rule (assumed, illustrative); series links not drawn
//   LV AC trenches .............. the ac-trenches module's own routes (Scope > More > AC trenches); never redrawn here
// Plain script: pure helpers export to Node (tests/tables.cjs); in the browser it attaches to window.SIM.
(function () {
  'use strict';
  const LIB_URL = 'https://globalgrid2050.com/solar-design-studio/202609271853-site-world/world/station.mjs';
  // Farm parameters against the library defaults (height 1.2, tilt 10, rowGap 8, columns 90).
  const FARM = Object.freeze({ tilt: 8, height: 1.33, rowGap: 2.5, ridgeGap: 0.5, tables: 1, inverters: 1 });
  const RIDGE_MEASURED_M = 3.0, SHADOW_TRIM_M = 3.0, CLAIM_M = 2.6, MIN_COVER = 0.7;
  const LOD = Object.freeze({ detailM: 250, outlineM: 2000, hysteresisM: 40, maxDetail: 80, cellM: 512 });
  // Assumed structure (from the photograph under a table): a bay every 4.8 m along the row, an inner post line near the
  // ridge and an outer line near the low edge, a purlin along each post line, a rafter across each bay, one diagonal per bay.
  const STRUCT = Object.freeze({ bayM: 4.8, innerFrac: 0.15, outerFrac: 0.85, hangM: 0.3, dashM: 0.4, ghostDashM: 0.15 });
  const D2R = Math.PI / 180;

  // ---- pure helpers (no DOM, no PF): runs are [ax, ay, bx, by] in local east/north metres ----
  function rowAxis(runs) {                                     // mean run direction, radians east of north (axial)
    let sx = 0, sy = 0;
    for (const [ax, ay, bx, by] of runs) { let dx = bx - ax, dy = by - ay; const l = Math.hypot(dx, dy); if (!(l > 0)) continue; if (dy < 0) { dx = -dx; dy = -dy; } sx += dx / l; sy += dy / l; }
    return Math.atan2(sx, sy);
  }
  const toRow = (th, x, y) => [x * Math.cos(th) - y * Math.sin(th), x * Math.sin(th) + y * Math.cos(th)];   // (u across, v along)
  const fromRow = (th, u, v) => [u * Math.cos(th) + v * Math.sin(th), -u * Math.sin(th) + v * Math.cos(th)];
  function stripStep(us) {                                     // the sampling step across the rows: median positive gap between distinct u
    const s = us.slice().sort((a, b) => a - b), g = []; for (let i = 1; i < s.length; i++) { const d = s[i] - s[i - 1]; if (d > 0.3) g.push(d); }
    g.sort((a, b) => a - b); return g.length ? g[g.length >> 1] : 2.2383;
  }
  const median = a => { const s = a.slice().sort((p, q) => p - q); return s.length ? (s.length & 1 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0; };
  // Rows from the strip runs, on a raster: strips (columns of the sampling step across the rows) x cells of 2 m along the
  // row. In every cell row a run of occupied columns is one crossing. A crossing of 10 to 12 columns is an UNBRIDGED row
  // (a 24.3 m row is about 10.8 strips of 2.24 m); 6 to 9 is a ragged partial (kept for the extent, not for the centre);
  // wider than 12 is a shadow-BRIDGED block of several rows, cut with a comb of the pitch (12 strips: 11 row + 1 gap)
  // fitted by least squares to BOTH block edges. Crossings with the same columns in consecutive cell rows join one row;
  // each row keeps its cells (extent per cell) so tables can be cut where the extent steps or the row breaks.
  function rowsFromRuns(runs, opt = {}) {
    const th = opt.axis != null ? opt.axis : rowAxis(runs), P = [], CELL = 2;
    for (const [ax, ay, bx, by] of runs) { const A = toRow(th, ax, ay), B = toRow(th, bx, by); P.push({ u: (A[0] + B[0]) / 2, v0: Math.min(A[1], B[1]), v1: Math.max(A[1], B[1]) }); }
    const step = opt.step || stripStep(P.map(p => p.u)), u0 = Math.min(...P.map(p => p.u)), maxCols = opt.maxCols || 12, minCols = opt.minCols || 6, wideCols = opt.wideCols || 10, minLen = opt.minLen || 15;
    // column index by walking the distinct u values (gaps measured locally, so the step's rounding never drifts across the farm)
    const us = [...new Set(P.map(p => +p.u.toFixed(2)))].sort((a, b) => a - b), colOf = new Map(); let ci = 0;
    let uc = us[0]; us.forEach(u => { if (u - uc > step * 0.5) { ci += Math.max(1, Math.round((u - uc) / step)); uc = u; } colOf.set(u, ci); });
    const occ = new Map();                                     // vi -> Set of ci
    for (const p of P) { const ci = colOf.get(+p.u.toFixed(2)); for (let vi = Math.floor(p.v0 / CELL); vi <= Math.floor(p.v1 / CELL); vi++) (occ.get(vi) || occ.set(vi, new Set()).get(vi)).add(ci); }
    const vis = [...occ.keys()].sort((a, b) => a - b), open = [], done = [];
    let bridgedCells = 0, unbridgedCells = 0, partialCells = 0;
    for (const vi of vis) {
      const cs = [...occ.get(vi)].sort((a, b) => a - b), crossings = [];
      let c0 = cs[0], prev = cs[0];
      const flush = c1 => { const w = c1 - c0 + 1;
        if (w <= maxCols) { crossings.push({ c0, c1, good: w >= wideCols, bridged: false }); }
        else { const N = Math.max(2, Math.round((w + 1) / maxCols)), a = (c0 + c1 - (maxCols * N - 2)) / 2;   // comb offset: least squares to the west and east edges
          for (let k = 0; k < N; k++) crossings.push({ c0: a + k * maxCols, c1: a + k * maxCols + maxCols - 2, good: false, bridged: true }); } };
      for (let i = 1; i <= cs.length; i++) { if (i === cs.length || cs[i] !== prev + 1) { flush(prev); c0 = cs[i]; } prev = cs[i]; }
      const used = new Set();
      for (const x of crossings) {
        const a = x.c0, b = x.c1; let best = null, bo = 0;      // the open row this crossing overlaps most (at least 60 % of the narrower)
        for (const r of open) { if (used.has(r) || r.last < vi - 2) continue; const o = Math.min(r.c1, b) - Math.max(r.c0, a) + 1;
          if (o >= 0.6 * Math.min(b - a + 1, r.c1 - r.c0 + 1) && o > bo) { bo = o; best = r; } }
        const cell = { vi, c0: a, c1: b, good: x.good, bridged: x.bridged };
        if (x.bridged) bridgedCells++; else if (x.good) unbridgedCells++; else partialCells++;
        if (best) { best.last = vi; best.cells.push(cell);
          if (x.good) { best.nGood++; best.sGood0 += a; best.sGood1 += b; best.c0 = Math.round(best.sGood0 / best.nGood); best.c1 = Math.round(best.sGood1 / best.nGood); }
          else if (!best.nGood && b - a + 1 >= minCols) { best.nAll++; best.sAll0 += a; best.sAll1 += b; best.c0 = Math.round(best.sAll0 / best.nAll); best.c1 = Math.round(best.sAll1 / best.nAll); }
          used.add(best); }
        else { const r = { c0: Math.round(a), c1: Math.round(b), nGood: x.good ? 1 : 0, sGood0: x.good ? a : 0, sGood1: x.good ? b : 0, nAll: 1, sAll0: a, sAll1: b, first: vi, last: vi, cells: [cell] }; open.push(r); used.add(r); }
      }
      for (let i = open.length - 1; i >= 0; i--) if (open[i].last < vi - 2) done.push(open.splice(i, 1)[0]);
    }
    done.push(...open);
    const rows = [], dropped = { narrow: 0, short: 0 };
    for (const r of done) {
      const good = r.cells.filter(c => c.good), src = good.length ? good : r.cells;
      const cc = median(src.map(c => (c.c0 + c.c1) / 2)), n = Math.round(median(src.map(c => c.c1 - c.c0))) + 1, v0 = r.first * CELL, v1 = (r.last + 1) * CELL - SHADOW_TRIM_M;   // north end of a thresholded mask is long by the shadow reach
      if (n < minCols) { dropped.narrow++; continue; } if (v1 - v0 < minLen) { dropped.short++; continue; }
      rows.push({ u: u0 + cc * step, v0, v1, cols: n, cells: r.cells, nGood: good.length, nBridged: r.cells.filter(c => c.bridged).length });
    }
    rows.sort((a, b) => a.u - b.u || a.v0 - b.v0);
    const d = []; for (let i = 1; i < rows.length; i++) for (let j = i - 1; j >= 0 && rows[i].u - rows[j].u < 40; j--) { const g = rows[i].u - rows[j].u, ov = Math.min(rows[i].v1, rows[j].v1) - Math.max(rows[i].v0, rows[j].v0); if (g > 15 && ov > 10) d.push(g); }
    return { axis: th, step, rows, dropped, pitch: d.length ? median(d) : null, raster: { occ, u0, step, CELL }, cells: { unbridged: unbridgedCells, partial: partialCells, bridged: bridgedCells } };
  }
  const halfWidthOf = s => { const run = s.rows * (s.moduleLength + s.moduleGap) - s.moduleGap; return run * Math.cos(s.tilt * D2R) + s.ridgeGap / 2; };
  // Share of a table's footprint (u +/- halfW, v0 to v0 + span) that lies on measured runs of the raster.
  function coverage(t, raster, halfW) {
    const { occ, u0, step, CELL } = raster, a = Math.floor(t.v0 / CELL), b = Math.ceil((t.v0 + t.span) / CELL) - 1; let sum = 0, n = 0;
    for (let vi = a; vi <= b; vi++) { const w = Math.min(t.v0 + t.span, (vi + 1) * CELL) - Math.max(t.v0, vi * CELL); if (w <= 0) continue; n += w; const set = occ.get(vi); if (!set) continue; let cov = 0;
      for (const c of set) { const uc = u0 + c * step, o = Math.min(uc + step / 2, t.u + halfW) - Math.max(uc - step / 2, t.u - halfW); if (o > 0) cov += o; }
      sum += w * Math.min(1, cov / (2 * halfW)); }
    return n ? sum / n : 0;
  }
  // Cut each measured row into tables: first where the row's measured extent steps (its smoothed c0/c1 changes by a
  // strip) or breaks (2 or more empty cells), then to the library span (a shorter last table where the run is not a
  // multiple). Each piece takes its centre from its own unbridged cells. Pieces with under 70 % of their area on runs are dropped.
    const PARTIAL_RUN = 4;
  function tablesFromRows(rows, s, raster) {
    const mw = s.moduleWidth + s.moduleGap, spanDefault = s.columns * mw - s.moduleGap, out = [], halfW = halfWidthOf(s), dropped = { cover: 0, tiny: 0 };
    const CELL = raster ? raster.CELL : 2, u0 = raster ? raster.u0 : null, step = raster ? raster.step : null;
    rows.forEach((r, ri) => {
      const segs = [];
      if (r.cells && raster) {
        // extent per cell, a median over 5 cells (10 m) of the full crossings (partials at ragged ends keep the last extent); a step is a shift of both
        // edges by a strip (the row moved) or of either by two (its width changed); a break is 2 or more empty cells, or 4 or more partial crossings in a row (the mask narrows there)
        const C = r.cells, full = C.map(c => c.good || c.bridged), sm = i => { const w = []; for (let j = Math.max(0, i - 2); j < Math.min(C.length, i + 3); j++) if (full[j]) w.push(C[j]); return w.length ? [Math.round(median(w.map(c => c.c0))), Math.round(median(w.map(c => c.c1)))] : null; };
        let seg = { cells: [C[0]], ext: sm(0) };
        for (let i = 1; i < C.length; i++) { const e = sm(i) || seg.ext, brk = C[i].vi - C[i - 1].vi - 1 >= 2 || (!full[i] && Array.from({ length: PARTIAL_RUN - 1 }, (_, j) => i - 1 - j).every(j => j >= 0 && !full[j]) && (i < PARTIAL_RUN || full[i - PARTIAL_RUN])), d0 = seg.ext ? e[0] - seg.ext[0] : 0, d1 = seg.ext ? e[1] - seg.ext[1] : 0, stp = (Math.abs(d0) >= 1 && Math.abs(d1) >= 1 && Math.sign(d0) === Math.sign(d1)) || Math.abs(d0) >= 2 || Math.abs(d1) >= 2;
          if (brk || stp) { segs.push(seg); seg = { cells: [C[i]], ext: e }; } else seg.cells.push(C[i]); }
        segs.push(seg);
        // ragged partial crossings (6 to 9 strips) at a segment's ends are mask edge, not table: trim them off
        for (const g of segs) { let a = 0, b = g.cells.length - 1; while (a < b && !(g.cells[a].good || g.cells[a].bridged)) a++; while (b > a && !(g.cells[b].good || g.cells[b].bridged)) b--; g.cells = g.cells.slice(a, b + 1); }
      } else segs.push({ cells: null });
      segs.forEach((g, gi) => {
        let v0 = r.v0, v1 = r.v1, u = r.u;
        if (g.cells) { v0 = g.cells[0].vi * CELL; v1 = Math.min(r.v1, (g.cells[g.cells.length - 1].vi + 1) * CELL);   // the row's north end carries the shadow trim
          const good = g.cells.filter(c => c.good), src = good.length ? good : g.cells; u = u0 + median(src.map(c => (c.c0 + c.c1) / 2)) * step; }
        const L = v1 - v0; if (L < 2 * mw) { dropped.tiny++; return; }
        const n = Math.max(1, Math.ceil(L / spanDefault - 1e-9)), len = L / n;
        for (let k = 0; k < n; k++) { const columns = Math.max(1, Math.floor((len + s.moduleGap) / mw)), span = columns * mw - s.moduleGap;
          const t = { id: out.length, row: ri, u, v0: v0 + k * len + (len - span) / 2, columns, span, cov: 1 };
          if (raster) { t.cov = coverage(t, raster, halfW); if (t.cov < MIN_COVER) { dropped.cover++; continue; } }
          out.push(t); }
      });
    });
    out.dropped = dropped; return out;
  }
  // Route ends of the AC trench model (its inverter positions, assumed there): the free end of a one-duct chain, in the model's E/N frame.
  function routeEnds(doc, caseKey = 'A4', tol = 0.3) {
    const c = doc.cases[caseKey]; if (!c) return []; const ends = [];
    for (const r of c.edges) { const V = []; for (let i = 6; i < r.length; i += 2) V.push([r[i], r[i + 1]]); if (V.length) ends.push({ p: V[0], r }, { p: V[V.length - 1], r }); }
    const bins = new Map(), key = (x, y) => Math.floor(x) + ',' + Math.floor(y);
    for (const e of ends) { const k = key(e.p[0], e.p[1]); (bins.get(k) || bins.set(k, []).get(k)).push(e); }
    const alone = e => { const fx = Math.floor(e.p[0]), fy = Math.floor(e.p[1]);
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const b = bins.get((fx + i) + ',' + (fy + j)); if (b) for (const o of b) if (o !== e && Math.hypot(o.p[0] - e.p[0], o.p[1] - e.p[1]) < tol) return false; } return true; };
    return ends.filter(e => e.r[1] === 'c' && e.r[2] === 1 && alone(e)).map(e => e.p);
  }
  // Every route end within a table's footprint plus CLAIM_M is that table's pole (an end in a 2.5 m gap goes to the nearer
  // table). Returns per-table site lists (table-local x, y) and, for the ends no table took, the distance to the nearest table.
  function claimPoles(tables, ends, axis, halfW, claim = CLAIM_M) {
    const c = Math.cos(axis), s = Math.sin(axis), sites = tables.map(() => []), free = [];
    for (const p of ends) { let best = null, bd = 1e9, bl = null;
      for (const t of tables) { const dx = p[0] - t.at[0], dy = p[1] - t.at[1], x = dx * c - dy * s, y = dx * s + dy * c;
        const d = Math.hypot(Math.max(0, Math.abs(x) - halfW), Math.max(0, -y, y - t.span));   // distance to the footprint rectangle
        if (d < bd) { bd = d; best = t; bl = [x, y]; } }
      if (best && bd <= claim) sites[best.id].push(bl); else free.push({ p, d: bd }); }
    return { sites, free };
  }
  // Geometry in table-local metres (x across, y along the row from the south end, z up). seg pushes [x0,y0,z0,x1,y1,z1].
  function outlineLines(shape, s) {
    const { depth, ridge, halfRidgeGap: g } = shape, L = [], span = shape.span;
    for (const side of [-1, 1]) { const xl = side * (g + depth), xr = side * g;
      L.push([xl, 0, s.height, xl, span, s.height], [xr, 0, ridge, xr, span, ridge], [xl, 0, s.height, xr, 0, ridge], [xl, span, s.height, xr, span, ridge]); }
    return L;
  }
  function gridLines(shape, s) {                             // module seams: rows+1 lines along the span, columns+1 up the slope, per face
    const { depth, ridge, halfRidgeGap: g, span, run } = shape, t = s.tilt * D2R, L = [], mw = s.moduleWidth + s.moduleGap, ml = s.moduleLength + s.moduleGap;
    for (const side of [-1, 1]) {
      for (let r = 0; r <= s.rows; r++) { const v = Math.min(run, r * ml), x = side * (g + depth - v * Math.cos(t)), z = s.height + v * Math.sin(t); L.push([x, 0, z, x, span, z]); }
      for (let c = 0; c <= s.columns; c++) { const y = Math.min(span, c * mw); L.push([side * (g + depth), y, s.height, side * g, y, ridge]); }
    }
    return L;
  }
  function dashed(L, a, b, dash) {                           // an assumed member drawn as short dashes (the ghost of a single-colour wire)
    const d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), n = Math.max(1, Math.round(d / dash));
    for (let k = 0; k < n; k += 2) { const t0 = k / n, t1 = Math.min(1, (k + 1) / n); L.push([a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0, a[2] + (b[2] - a[2]) * t0, a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1, a[2] + (b[2] - a[2]) * t1]); }
  }
  function structureLines(shape, s) {                        // ASSUMED: posts and diagonals dashed; purlins and rafters solid; rails not drawn
    const { depth, run, halfRidgeGap: g, span } = shape, t = s.tilt * D2R, L = [], bays = Math.max(1, Math.round(span / STRUCT.bayM)), bay = span / bays;
    for (const side of [-1, 1]) {
      const post = f => ({ x: side * (g + f * depth), z: s.height + (1 - f) * run * Math.sin(t) - STRUCT.hangM }), pi = post(STRUCT.innerFrac), po = post(STRUCT.outerFrac);
      for (let k = 0; k <= bays; k++) { const y = Math.min(span, k * bay + (k < bays ? bay / 2 : 0)); if (k === bays) break;
        for (const p of [pi, po]) dashed(L, [p.x, y, 0], [p.x, y, p.z], STRUCT.dashM);
        L.push([pi.x, y, pi.z, po.x, y, po.z]);                                             // rafter
        if (k + 1 < bays) { const y2 = Math.min(span, (k + 1) * bay + bay / 2);
          L.push([pi.x, y, pi.z, pi.x, y2, pi.z], [po.x, y, po.z, po.x, y2, po.z]);           // purlins along the post lines
          dashed(L, [pi.x, k % 2 ? y2 : y, 0.3], [pi.x, k % 2 ? y : y2, pi.z], STRUCT.dashM); }  // one diagonal per bay
      }
    }
    return L;
  }
  function poleLines(site, L, ghost = false) {                // the library's pole and inverter box (stationSolids sizes); ghost = library site, no route in the trench model
    const dash = ghost ? STRUCT.ghostDashM : STRUCT.dashM;
    dashed(L, [site[0], site[1] + 0.3, 0], [site[0], site[1] + 0.3, site[2]], dash);
    const b = [[site[0] - 0.5, site[1] - 0.25], [site[0] + 0.5, site[1] - 0.25], [site[0] + 0.5, site[1] + 0.25], [site[0] - 0.5, site[1] + 0.25]], z0 = site[2] - 1, z1 = site[2];
    for (let i = 0; i < 4; i++) { const p = b[i], q = b[(i + 1) % 4];
      if (ghost) { dashed(L, [p[0], p[1], z0], [q[0], q[1], z0], dash); dashed(L, [p[0], p[1], z1], [q[0], q[1], z1], dash); dashed(L, [p[0], p[1], z0], [p[0], p[1], z1], dash); }
      else L.push([p[0], p[1], z0, q[0], q[1], z0], [p[0], p[1], z1, q[0], q[1], z1], [p[0], p[1], z0, p[0], p[1], z1]); }
  }
  const polyline = (L, pts) => { for (let i = 1; i < pts.length; i++) L.push([pts[i - 1][0], pts[i - 1][1], pts[i - 1][2], pts[i][0], pts[i][1], pts[i][2]]); };
  function farmParams(defaults) {                            // the library defaults with the farm's measured / documented values in
    const s = { ...defaults, ...FARM }, run = s.rows * (s.moduleLength + s.moduleGap) - s.moduleGap, depth = run * Math.cos(s.tilt * D2R);
    return { params: s, run, depth, width: 2 * (depth + s.ridgeGap / 2), pitch: 2 * depth + s.ridgeGap + s.rowGap, ridge: s.height + run * Math.sin(s.tilt * D2R) };
  }
  const api = { FARM, RIDGE_MEASURED_M, SHADOW_TRIM_M, CLAIM_M, MIN_COVER, LOD, STRUCT, rowAxis, toRow, fromRow, stripStep, median, rowsFromRuns, tablesFromRows, coverage, halfWidthOf, routeEnds, claimPoles, outlineLines, gridLines, structureLines, poleLines, farmParams, dashed };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }

  // ---- browser ----
  const BASE = (document.currentScript && document.currentScript.src.replace(/[^/]*$/, '')) || 'mod/';
  const getJson = async u => { const r = await fetch(u); if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); };
  const on = id => { const e = document.getElementById(id); return !!(e && e.classList.contains('on')); };
  const st = { on: false, userSet: false, farm: null, lib: null, err: '', tables: 0, rows: 0, poles: 0, polesTables: 0, polesLibrary: 0, freeBeside: 0, freeNoRows: 0, detail: 0, outline: 0, cells: 0, built: 0, lastAt: null, trench: 'not loaded', axisDeg: 0, pitch: 0, captionHidden: false, crossings: {} };

  function start(SIM, PF) {
    const map = SIM.map, detail = new Map(), cells = new Map(), shown = { detail: new Set(), cells: new Set() };
    let farm = null, busy = false, pending = false, timer = 0, text = '';
    const cap = document.createElement('div'); cap.id = 'tables-caption';
    cap.style.cssText = 'position:absolute;left:8px;top:36px;z-index:2;max-width:560px;font:12px sans-serif;color:rgba(225,245,255,.92);background:rgba(0,0,0,.55);padding:6px 8px;border-radius:6px;border:1px solid rgba(210,242,255,.3);display:none';
    document.body.appendChild(cap);
    const planOn = () => { try { return !!(SIM.plan && SIM.plan.state && SIM.plan.state().on); } catch (e) { return false; } };
    const syncCap = () => { const hide = planOn(); st.captionHidden = !!text && hide; cap.style.display = text && !hide ? 'block' : 'none'; };   // the plan (bird's-eye) keeps its own captions
    const say = t => { text = t; cap.textContent = t; syncCap(); };
    const btn = SIM.addButton('Tables', () => { st.userSet = true; setOn(!st.on); }); btn.id = 'tables-btn';

    async function loadFarm() {
      if (farm) return farm;
      const [lib, list] = await Promise.all([import(LIB_URL), getJson(BASE + 'scanner-rows.farms.json')]);
      st.lib = lib.STATION_DEFAULTS ? 'loaded' : 'no defaults';
      const f = list.farms[0], doc = await getJson(BASE + f.rows), a0 = PF.placeKey(f.point.lat, f.point.lon), o0 = PF.toLocal(a0, f.point.lat, f.point.lon, 0);
      const runs = doc.rows.map(([[lo0, la0], [lo1, la1]]) => { const A = PF.toLocal(a0, la0, lo0, 0), B = PF.toLocal(a0, la1, lo1, 0); return [A.x - o0.x, A.y - o0.y, B.x - o0.x, B.y - o0.y]; });
      const stepM = f.sample_step_px && doc.metres_per_pixel ? f.sample_step_px.value * doc.metres_per_pixel : undefined, R = rowsFromRuns(runs, { step: stepM }), fp = farmParams(lib.STATION_DEFAULTS), shape = lib.tableShape(fp.params);
      const pieces = tablesFromRows(R.rows, fp.params, R.raster), tablesDropped = pieces.dropped, tables = pieces.map(t => { const at = fromRow(R.axis, t.u, t.v0), c = fromRow(R.axis, t.u, t.v0 + t.span / 2);
        return { ...t, at, cx: c[0], cy: c[1], P: lib.placer([at[0], at[1], 0], R.axis) }; });
      const halfW = shape.halfRidgeGap + shape.depth;
      // pole inverters: the trench model's route ends (its assumed inverter positions), read from the module when it has its file, else from the same file; never redrawn
      let ends = [], trench = 'AC trench data not loaded: poles at the library site';
      try { const A = window.__acTrenches, d = (A && A.doc && A.doc()) || await getJson(BASE + 'ac-trenches-' + (f.register.match(/\d+/) || ['6502'])[0] + '.json');
        const F = d.frame; ends = routeEnds(d, 'A4').map(([e, n]) => { const q = PF.toLocal(a0, F.lat0 + n / F.KY, F.lon0 + e / F.KX, 0); return [q.x - o0.x, q.y - o0.y]; });
        trench = `${ends.length} route ends of the AC trench model (case A4, ${d.cases.A4.routes_en.length} routes)`; } catch (e) { trench += ' (' + e.message + ')'; }
      const claimed = claimPoles(tables, ends, R.axis, halfW);
      for (const t of tables) { const S = claimed.sites[t.id];
        if (S.length) { t.sites = S.map(([x, y]) => [x, y, shape.ridge]); t.siteFrom = 'trench'; } else { t.sites = [lib.inverterSite(0, { ...fp.params, columns: t.columns })]; t.siteFrom = 'library'; }
        t.site = t.sites[0]; }
      const free = claimed.free.map(x => x.p), freeBeside = claimed.free.filter(x => x.d < 15).length;
      farm = { f, a0, o0, lib, fp, shape, R, tables, ends, free, trench, halfW, tablesDropped };
      Object.assign(st, { farm: f.register, rows: R.rows.length, tables: tables.length, poles: tables.reduce((n, t) => n + (t.siteFrom === 'trench' ? t.sites.length : 0), 0), polesTables: tables.filter(t => t.siteFrom === 'trench').length,
        polesLibrary: tables.filter(t => t.siteFrom === 'library').length, freeBeside, freeNoRows: free.length - freeBeside, polesFree: free.length, trench, axisDeg: +(R.axis / D2R).toFixed(2), pitch: R.pitch ? +R.pitch.toFixed(2) : null, dropped: { ...R.dropped, ...tablesDropped }, crossings: R.cells });
      return farm;
    }
    // a block anchored at the table's own place key (perf.js reads the ground there); lines in table-local metres via the placer
    function blockOf(t, lines, tag) {
      const F = farm, g = PF.fromLocal(F.a0, t.cx + F.o0.x, t.cy + F.o0.y, 0), an = PF.placeKey(g.lat, g.lon), o = PF.toLocal(an, g.lat, g.lon, 0), L = [];
      for (const [x0, y0, z0, x1, y1, z1] of lines) { const a = t.P.point([x0, y0, z0]), b = t.P.point([x1, y1, z1]); L.push([a[0] - t.cx + o.x, a[1] - t.cy + o.y, z0, b[0] - t.cx + o.x, b[1] - t.cy + o.y, z1]); }
      return { lon: g.lon, lat: g.lat, anchor: an, lines: L, buf: PF.wireBuffer(an, L), tables: tag, tableId: t.id };
    }
    function detailBlock(t) {
      const F = farm, p = { ...F.fp.params, columns: t.columns }, shape = F.lib.tableShape(p), L = [];
      for (const l of gridLines(shape, p)) L.push(l);
      for (const l of structureLines(shape, p)) L.push(l);
      for (const s of t.sites) poleLines(s, L, t.siteFrom === 'library');
      const strings = F.lib.tableStrings(p, { corners: false });
      for (const d of F.lib.dcDucts(t.sites, p)) polyline(L, d.points);
      for (const r of F.lib.dcHomeRoutes(strings, t.sites, p)) polyline(L, r.points);
      t.strings = strings.length; t.connected = strings.filter(x => x.connected).length; t.segments = L.length;
      return blockOf(t, L, 'detail');
    }
    function cellBlock(key, list) {
      const F = farm, L = [], t0 = list[0], base = { cx: t0.cx, cy: t0.cy, P: F.lib.placer([0, 0, 0], 0) };
      for (const t of list) { const sh = F.lib.tableShape({ ...F.fp.params, columns: t.columns }); for (const [x0, y0, z0, x1, y1, z1] of outlineLines(sh, F.fp.params)) { const a = t.P.point([x0, y0, z0]), b = t.P.point([x1, y1, z1]); L.push([a[0], a[1], z0, b[0], b[1], z1]); } }
      const b = blockOf(base, L, 'outline'); b.cell = key; return b;
    }
    function freePoleBlock(list) {                             // route ends no table claimed: the pole and box alone
      const F = farm, L = [], c = list[0], base = { cx: c[0], cy: c[1], P: F.lib.placer([0, 0, 0], 0) };
      for (const p of list) poleLines([p[0], p[1], F.shape.ridge], L);
      return blockOf(base, L, 'pole');
    }
    function build() {
      if (!st.on || !farm) return;
      const c = map.getCenter(), q = PF.toLocal(farm.a0, c.lat, c.lng, 0), X = q.x - farm.o0.x, Y = q.y - farm.o0.y;
      if (st.lastAt && Math.hypot(X - st.lastAt[0], Y - st.lastAt[1]) < 20 && st.built) return;
      st.lastAt = [X, Y];
      const near = [], wantCells = new Map();
      for (const t of farm.tables) { const d = Math.hypot(t.cx - X, t.cy - Y); t.d = d;
        if (d < LOD.outlineM) { const k = Math.floor(t.cx / LOD.cellM) + ',' + Math.floor(t.cy / LOD.cellM); (wantCells.get(k) || wantCells.set(k, []).get(k)).push(t); }
        if (d < LOD.detailM || (shown.detail.has(t.id) && d < LOD.detailM + LOD.hysteresisM)) near.push(t); }
      near.sort((a, b) => a.d - b.d); const wantDetail = new Set(near.slice(0, LOD.maxDetail).map(t => t.id));
      SIM.removeWhere(b => (b.tables === 'detail' && !wantDetail.has(b.tableId)) || (b.tables === 'outline' && !wantCells.has(b.cell)) || b.tables === 'pole');
      for (const id of [...shown.detail]) if (!wantDetail.has(id)) shown.detail.delete(id);
      for (const k of [...shown.cells]) if (!wantCells.has(k)) shown.cells.delete(k);
      for (const [k, list] of wantCells) { if (shown.cells.has(k)) continue; let b = cells.get(k); if (!b) { b = cellBlock(k, list); cells.set(k, b); } SIM.addBlock(b); shown.cells.add(k); }
      for (const id of wantDetail) { if (shown.detail.has(id)) continue; let b = detail.get(id); if (!b) { b = detailBlock(farm.tables[id]); detail.set(id, b); if (detail.size > 400) detail.delete(detail.keys().next().value); } SIM.addBlock(b); shown.detail.add(id); }
      const fp = farm.free.filter(p => Math.hypot(p[0] - X, p[1] - Y) < LOD.detailM); if (fp.length) SIM.addBlock(freePoleBlock(fp));
      st.detail = shown.detail.size; st.outline = [...wantCells.values()].reduce((n, l) => n + l.length, 0); st.cells = shown.cells.size; st.built++;
      const T = farm.tables[0], A = window.__acTrenches, trOn = !!(A && A.state && A.state().on), dr = farm.tablesDropped || {};
      say(`Tables at ${farm.f.register}: ${farm.tables.length} tables on ${farm.R.rows.length} measured rows (row axis ${st.axisDeg} deg E of N, pitch ${st.pitch} m, from the row file; centres from each row's own unbridged crossings, ` +
        `${st.crossings.unbridged} cells unbridged, ${st.crossings.bridged} comb-fitted in shadow-bridged blocks; tables cut where the extent steps or the row breaks, ${dr.cover || 0} pieces under ${MIN_COVER * 100} % on runs and ${dr.tiny || 0} slivers under two modules dropped; north ends trimmed ${SHADOW_TRIM_M} m for the shadow). ` +
        `Ridge ${farm.shape.ridge.toFixed(2)} m MEASURED by shadow; tilt ${FARM.tilt} deg DOCUMENTED; low edge ${FARM.height} m DERIVED (measured 3.0 m ridge minus the documented 8 deg rise; documented 1.3-1.5 m); width ${farm.fp.width.toFixed(2)} m and module grid from the library. ` +
        `Structure ASSUMED from a photograph: posts and bracing dashed; purlins and rafters assumed, solid; rails are not drawn. ` +
        `Pole inverters: ${st.poles} at route ends of the trench model, claimed by ${st.polesTables} tables (every end within a footprint + ${CLAIM_M} m; ${st.trench}); ${st.polesLibrary} library-site poles (fine-dashed ghost): no AC route in the trench model. ` +
        `Bare poles: beside a table but unclaimed (${st.freeBeside}), no measured rows there (${st.freeNoRows}). ` +
        `DC ducts and home cables: library rule, ${T.connected || 24} of ${T.strings || 30} strings per table connected (illustrative). AC trenches: the AC trenches module (${trOn ? 'on' : 'off: Scope > More > AC trenches'}), never redrawn here. ` +
        `Detail within ${LOD.detailM} m: ${st.detail} tables; outlines to ${LOD.outlineM / 1000} km: ${st.outline}.`);
      map.triggerRepaint();
    }
    async function refresh() { if (!st.on) return; if (busy) { pending = true; return; } busy = true;
      try { await loadFarm(); build(); } catch (e) { st.err = String(e && e.message || e); say('Tables: ' + st.err); }
      busy = false; if (pending) { pending = false; refresh(); } }
    function setOn(v) { st.on = v; btn.classList.toggle('on', v);
      if (v) { st.lastAt = null; refresh(); } else { SIM.removeWhere(b => !!b.tables); shown.detail.clear(); shown.cells.clear(); st.detail = st.outline = 0; say(''); } }
    // streaming: one throttled build per 250 ms while the camera moves (never reset while moving; nothing on moveend)
    map.on('move', () => { if (!st.on || timer) return; timer = setTimeout(() => { timer = 0; syncCap(); if (st.built && st.lastAt) build(); else refresh(); }, 250); });
    // ON by default once you arrive in Walk or Drone at a register solar asset (within 2.5 km of its point), unless the button was used.
    async function autoOn() { if (st.userSet || st.on || !(on('walk') || on('drone'))) return;
      try { const list = farm ? { farms: [farm.f] } : await getJson(BASE + 'scanner-rows.farms.json'), c = map.getCenter();
        for (const f of list.farms) { const q = PF.toLocal(PF.placeKey(f.point.lat, f.point.lon), c.lat, c.lng, 0), o = PF.toLocal(PF.placeKey(f.point.lat, f.point.lon), f.point.lat, f.point.lon, 0);
          if (Math.hypot(q.x - o.x, q.y - o.y) < 2500) { setOn(true); return; } } } catch (e) { st.err = String(e.message || e); } }
    map.on('moveend', autoOn);
    for (const id of ['walk', 'drone']) { const el = document.getElementById(id); if (el) new MutationObserver(autoOn).observe(el, { attributes: true, attributeFilter: ['class'] }); }
    // test hooks: state, refresh, the tables, and look-points (lon, lat, yaw): between two tables (the aisle of the photograph), under the ridge, under a face, a pole
    const at = (t, x, y) => { const p = t.P.point([x, y, 0]), g = PF.fromLocal(farm.a0, p[0] + farm.o0.x, p[1] + farm.o0.y, 0); return { lon: g.lon, lat: g.lat, yaw: +(farm.R.axis / D2R).toFixed(2) }; };
    window.__tables = { state: () => ({ ...st, lib: st.lib, api: Object.keys(api) }), refresh: () => { st.lastAt = null; return refresh(); }, set: v => { st.userSet = true; setOn(v); }, farm: () => farm, syncCaption: syncCap,
      tables: () => farm ? farm.tables.map(t => ({ id: t.id, row: t.row, columns: t.columns, span: +t.span.toFixed(2), cov: +t.cov.toFixed(3), cx: +t.cx.toFixed(1), cy: +t.cy.toFixed(1), site: t.site.map(v => +v.toFixed(2)), sites: t.sites.length, siteFrom: t.siteFrom, d: t.d })) : [],
      look: { between: (i, side = 1) => at(farm.tables[i], side * (farm.halfW + FARM.rowGap / 2), 4), ridge: i => at(farm.tables[i], 0, 4), under: (i, side = 1) => at(farm.tables[i], side * (farm.shape.halfRidgeGap + farm.shape.depth * 0.5), 6),
        pole: i => { const t = farm.tables[i]; return at(t, t.site[0], t.site[1] - 6); }, nearest: () => farm.tables.slice().sort((a, b) => a.d - b.d)[0] },
      params: () => farm ? { changed: FARM, derived: { width: farm.fp.width, pitch: farm.fp.pitch, ridge: farm.fp.ridge, run: farm.fp.run, depth: farm.fp.depth, halfW: farm.halfW }, defaults: farm.lib.STATION_DEFAULTS } : null };
    SIM.tables = window.__tables;
  }
  (function wait(n) { if (window.SIM && window.SIM.map && window.__pf && window.__pf.PF) start(window.SIM, window.__pf.PF); else if (n < 600) setTimeout(() => wait(n + 1), 100); })(0);
})();
