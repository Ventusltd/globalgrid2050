// rows-geometry: better "Rows from satellite". Reads Esri z17 imagery around the map centre, builds a panel mask
// (darkness test OR a colour test for the bright/grey glare gaps next to dark panels), finds the row DIRECTION locally
// (structure tensor of the mask per 64 px cell, smoothed), finds row centre lines and the real row pitch from the
// profile across the rows, merges pieces into continuous row polylines, and stands them up as tilted tables:
// front edge 0.8 m, back edge 2.4 m, legs every 5 m. Everything is an ESTIMATE from imagery, not a survey.
// Plain script: attaches to window.SIM (map, blocks, addBlock, removeWhere, repaint, info). One block, one buffer.
(function () {
  'use strict';
  const Z = 17, NT = 4, W = NT * 256;                // 4 x 4 tiles = 1024 px, about 760 m square in southern England
  const CELL = 64;                                    // direction cells, about 48 m
  const FRONT = 0.8, BACK = 2.4, LEG = 5;             // table heights (assumed) and leg spacing, metres
  const TILE = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
  const CREDIT = 'Imagery: Esri, Maxar, Earthstar Geographics';

  const lonLatToTile = (lon, lat, z) => { const n = 2 ** z, r = lat * Math.PI / 180;
    return [(lon + 180) / 360 * n, (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n]; };
  const tileToLonLat = (x, y, z) => { const n = 2 ** z; return [x / n * 360 - 180, Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI]; };
  const loadImg = u => new Promise((ok, no) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => ok(im); im.onerror = no; im.src = u; });

  // ---- 1. mask: darkness test, plus colour test (neutral/blue-grey, not vegetation, not soil) near dark panels ----
  function buildMask(d) {
    const N = W * W, strong = new Uint8Array(N), weak = new Uint8Array(N);
    for (let i = 0, k = 0; i < N; i++, k += 4) {
      const r = d[k], g = d[k + 1], b = d[k + 2], lum = 0.3 * r + 0.59 * g + 0.11 * b;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      if (lum < 62 && b >= r - 6) strong[i] = 1;
      else if (lum < 165 && mx - mn < 48 && b >= r - 4 && !(g > r + 8 && g > b + 6) && !(r > b + 16)) weak[i] = 1;
    }
    // integral image of strong pixels -> local density in a 9 x 9 window
    const I = new Uint32Array((W + 1) * (W + 1));
    for (let y = 0; y < W; y++) { let s = 0; for (let x = 0; x < W; x++) { s += strong[y * W + x]; I[(y + 1) * (W + 1) + x + 1] = I[y * (W + 1) + x + 1] + s; } }
    const R = 4, mask = new Uint8Array(N); let nWeak = 0;
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (strong[i]) { mask[i] = 1; continue; } if (!weak[i]) continue;
      const x0 = Math.max(0, x - R), y0 = Math.max(0, y - R), x1 = Math.min(W, x + R + 1), y1 = Math.min(W, y + R + 1);
      const s = I[y1 * (W + 1) + x1] - I[y0 * (W + 1) + x1] - I[y1 * (W + 1) + x0] + I[y0 * (W + 1) + x0];
      if (s > 0.22 * (x1 - x0) * (y1 - y0)) { mask[i] = 1; nWeak++; }
    }
    return { mask, nWeak };
  }

  // ---- 2. local row direction: structure tensor of the mask per cell, doubled-angle smoothing over neighbours ----
  function directions(mask) {
    const nc = W / CELL, cells = [];
    for (let cy = 0; cy < nc; cy++) for (let cx = 0; cx < nc; cx++) {
      let jxx = 0, jyy = 0, jxy = 0, cnt = 0;
      for (let y = cy * CELL + 1; y < (cy + 1) * CELL - 1; y++) for (let x = cx * CELL + 1; x < (cx + 1) * CELL - 1; x++) {
        const i = y * W + x; cnt += mask[i];
        const gx = mask[i + 1] - mask[i - 1], gy = mask[i + W] - mask[i - W];
        jxx += gx * gx; jyy += gy * gy; jxy += gx * gy;
      }
      const fill = cnt / (CELL * CELL), tr = jxx + jyy;
      const coh = tr ? Math.hypot(jxx - jyy, 2 * jxy) / tr : 0;
      const ok = fill > 0.12 && fill < 0.985 && coh > 0.25;
      cells.push({ cx, cy, fill, coh, ok, vx: ok ? (jxx - jyy) * coh : 0, vy: ok ? 2 * jxy * coh : 0 });
    }
    for (const c of cells) {                          // smooth the doubled angle with the 3 x 3 neighbours
      if (!c.ok) continue; let sx = 0, sy = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const x = c.cx + dx, y = c.cy + dy; if (x < 0 || y < 0 || x >= nc || y >= nc) continue;
        const o = cells[y * nc + x], w = dx || dy ? 0.5 : 1; sx += o.vx * w; sy += o.vy * w;
      }
      c.phi = 0.5 * Math.atan2(sy, sx);              // gradient (across-row) angle, pixel frame (y down)
    }
    for (const c of cells) {                          // solid panel cells with no texture: borrow the neighbours' direction
      if (c.ok || c.fill < 0.35) continue; let sx = 0, sy = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const x = c.cx + dx, y = c.cy + dy; if (x < 0 || y < 0 || x >= nc || y >= nc) continue;
        const o = cells[y * nc + x]; if (o.ok) { sx += o.vx; sy += o.vy; } }
      if (sx || sy) { c.phi = 0.5 * Math.atan2(sy, sx); c.ok = true; c.borrowed = true; }
    }
    return cells;
  }

  // ---- 3. per cell: profile across the rows -> pitch, centre lines, depth; walk each line -> runs ----
  function cellSegments(mask, c, mpp, gPitch) {
    const nx = Math.cos(c.phi), ny = Math.sin(c.phi), ux = -ny, uy = nx;
    const ox = (c.cx + 0.5) * CELL, oy = (c.cy + 0.5) * CELL, H = 50, B = 2 * H * 2 + 1;   // bins of 0.5 px over +-50 px
    const prof = new Float32Array(B);
    for (let y = c.cy * CELL; y < (c.cy + 1) * CELL; y++) for (let x = c.cx * CELL; x < (c.cx + 1) * CELL; x++) {
      if (!mask[y * W + x]) continue; const t = (x - ox) * nx + (y - oy) * ny; const b = Math.round((t + H) * 2); if (b >= 0 && b < B) prof[b]++;
    }
    const sm = new Float32Array(B); for (let i = 0; i < B; i++) { let s = 0, w = 0; for (let k = -3; k <= 3; k++) { const j = i + k; if (j < 0 || j >= B) continue; const g = Math.exp(-k * k / 4.5); s += prof[j] * g; w += g; } sm[i] = s / w; }
    // pitch: autocorrelation peak for lags 4.5 .. 16 m
    let mean = 0; for (const v of sm) mean += v; mean /= B;
    let best = 0, bestLag = 0; const l0 = Math.round(4.5 / mpp * 2), l1 = Math.round(16 / mpp * 2);
    for (let L = l0; L <= l1; L++) { let s = 0; for (let i = 0; i + L < B; i++) s += (sm[i] - mean) * (sm[i + L] - mean); s /= (B - L); if (s > best) { best = s; bestLag = L; } }
    const pitchPx = bestLag ? bestLag / 2 : 0;
    let mx = 0, lo = 1e9; for (let i = 20; i < B - 20; i++) { mx = Math.max(mx, sm[i]); if (sm[i] > 0) lo = Math.min(lo, sm[i]); }
    const contrast = mx ? 1 - lo / mx : 0;
    if (!gPitch) return { pitchPx: contrast > 0.5 && best > 0 ? pitchPx : 0 };
    const peaks = [], sep = gPitch * 2 * 0.7;
    if (contrast > 0.45) {
      for (let i = 1; i < B - 1; i++) if (sm[i] >= sm[i - 1] && sm[i] > sm[i + 1] && sm[i] > 0.3 * mx) {
        if (peaks.length && i - peaks[peaks.length - 1].i < sep) { if (sm[i] > peaks[peaks.length - 1].v) peaks[peaks.length - 1] = { i, v: sm[i] }; continue; }
        peaks.push({ i, v: sm[i] });
      }
    } else {                                          // solid panel area: rows not resolved, laid at the measured pitch (estimate)
      const ph = (((Math.round(nx * 1e3) + ox * nx + oy * ny) % gPitch) + gPitch) % gPitch;  // phase tied to the image, so cells line up
      for (let t = -H + ((gPitch - ph) % gPitch); t <= H; t += gPitch) { const i = Math.round((t + H) * 2); if (sm[i] > 0) peaks.push({ i, v: mx, flat: true }); }
    }
    const segs = [];
    for (const p of peaks) {
      let a = p.i, b = p.i; while (a > 0 && sm[a] > p.v / 2) a--; while (b < B - 1 && sm[b] > p.v / 2) b++;
      const depthPx = p.flat ? gPitch * 0.75 : (b - a) / 2, t = p.i / 2 - H;
      const cxp = ox + nx * t, cyp = oy + ny * t;
      let run = null, gap = 0;
      const flush = () => { if (run && run.s1 - run.s0 >= 4) segs.push({ phi: c.phi, depthPx, x0: cxp + ux * run.s0, y0: cyp + uy * run.s0, x1: cxp + ux * run.s1, y1: cyp + uy * run.s1 }); run = null; gap = 0; };
      for (let s = -H; s <= H; s++) {
        const px = cxp + ux * s, py = cyp + uy * s;
        const inCell = px >= c.cx * CELL && px < (c.cx + 1) * CELL && py >= c.cy * CELL && py < (c.cy + 1) * CELL;
        if (!inCell) { if (run) flush(); continue; }
        let on = 0; for (const o of [-1, 0, 1]) { const qx = Math.round(px + nx * o), qy = Math.round(py + ny * o); if (qx >= 0 && qy >= 0 && qx < W && qy < W) on += mask[qy * W + qx]; }
        if (on >= 2) { if (!run) run = { s0: s, s1: s }; else run.s1 = s; gap = 0; }
        else if (run && ++gap > 3) flush();
      }
      flush();
    }
    return { segs, pitchPx, spacings: peaks.slice(1).map((p, k) => (p.i - peaks[k].i) / 2) };
  }

  // ---- 4. merge pieces into continuous rows (same direction, same line, small along-row gap) ----
  function mergeRows(segs) {
    const n = segs.length, par = Int32Array.from({ length: n }, (_, i) => i);
    const find = i => { while (par[i] !== i) i = par[i] = par[par[i]]; return i; };
    for (const s of segs) { s.ux = Math.cos(s.phi + Math.PI / 2); s.uy = Math.sin(s.phi + Math.PI / 2); s.len = Math.hypot(s.x1 - s.x0, s.y1 - s.y0); }
    for (let i = 0; i < n; i++) { const A = segs[i];
      for (let j = i + 1; j < n; j++) { const B = segs[j];
        if (Math.abs(B.x0 - A.x0) > 120 || Math.abs(B.y0 - A.y0) > 120) continue;
        let dphi = Math.abs(A.phi - B.phi) % Math.PI; if (dphi > Math.PI / 2) dphi = Math.PI - dphi; if (dphi > 0.07) continue;
        const nx = -A.uy, ny = A.ux, off = ((B.x0 + B.x1) / 2 - A.x0) * nx + ((B.y0 + B.y1) / 2 - A.y0) * ny;
        if (Math.abs(off) > 1.6) continue;
        const sb0 = (B.x0 - A.x0) * A.ux + (B.y0 - A.y0) * A.uy, sb1 = (B.x1 - A.x0) * A.ux + (B.y1 - A.y0) * A.uy;
        const lo = Math.min(sb0, sb1), hi = Math.max(sb0, sb1);
        if (lo > A.len + 4 || hi < -4) continue;
        par[find(i)] = find(j);
      }
    }
    const groups = new Map(); for (let i = 0; i < n; i++) { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(segs[i]); }
    const rows = [];
    for (const g of groups.values()) {
      let vx = 0, vy = 0; for (const s of g) { vx += Math.cos(2 * s.phi) * s.len; vy += Math.sin(2 * s.phi) * s.len; }
      const phi = 0.5 * Math.atan2(vy, vx), ux = -Math.sin(phi), uy = Math.cos(phi), o = g[0];
      const iv = g.map(s => { const a = (s.x0 - o.x0) * ux + (s.y0 - o.y0) * uy, b = (s.x1 - o.x0) * ux + (s.y1 - o.y0) * uy;
        const nx = Math.cos(phi), ny = Math.sin(phi), off = ((s.x0 + s.x1) / 2 - o.x0) * nx + ((s.y0 + s.y1) / 2 - o.y0) * ny;
        return { a: Math.min(a, b), b: Math.max(a, b), off, depth: s.depthPx }; }).sort((p, q) => p.a - q.a);
      // union of intervals, broken where the gap exceeds 4 px (about 3 m)
      let cur = null; const nx = Math.cos(phi), ny = Math.sin(phi);
      const emit = () => { if (!cur || cur.b - cur.a < 8) return; const off = cur.os / cur.w, dep = cur.ds / cur.w;
        rows.push({ phi, depthPx: dep, pts: [[o.x0 + ux * cur.a + nx * off, o.y0 + uy * cur.a + ny * off], [o.x0 + ux * cur.b + nx * off, o.y0 + uy * cur.b + ny * off]] }); };
      for (const v of iv) {
        const w = v.b - v.a + 1;
        if (cur && v.a <= cur.b + 4) { cur.b = Math.max(cur.b, v.b); cur.os += v.off * w; cur.ds += v.depth * w; cur.w += w; }
        else { emit(); cur = { a: v.a, b: v.b, os: v.off * w, ds: v.depth * w, w }; }
      }
      emit();
    }
    return rows;
  }

  // ---- 5. tables in local metres around the anchor ----
  function tables(rows, toM, pitchM) {
    const L = []; let km = 0;
    for (const r of rows) {
      const P = r.pts.map(([x, y]) => toM(x, y));
      const dx = P[1][0] - P[0][0], dy = P[1][1] - P[0][1], len = Math.hypot(dx, dy); if (len < 6) continue; km += len / 1000;
      const ux = dx / len, uy = dy / len; let nx = -uy, ny = ux;
      if (ny < -0.2 || (Math.abs(ny) <= 0.2 && nx < 0)) { nx = -nx; ny = -ny; }   // back edge to the north (south-facing, assumed)
      const d = Math.min(6, Math.max(2.5, Math.min(r.depthM, pitchM ? pitchM * 0.75 : 6))) / 2;
      const f = s => [P[0][0] + ux * s - nx * d, P[0][1] + uy * s - ny * d], b = s => [P[0][0] + ux * s + nx * d, P[0][1] + uy * s + ny * d];
      const F0 = f(0), F1 = f(len), B0 = b(0), B1 = b(len);
      L.push([F0[0], F0[1], FRONT, F1[0], F1[1], FRONT], [B0[0], B0[1], BACK, B1[0], B1[1], BACK]);
      const k = Math.max(1, Math.round(len / LEG));
      for (let i = 0; i <= k; i++) { const s = len * i / k, A = f(s), C = b(s);
        L.push([A[0], A[1], 0, A[0], A[1], FRONT], [C[0], C[1], 0, C[0], C[1], BACK], [A[0], A[1], FRONT, C[0], C[1], BACK]); }
    }
    return { L, km };
  }

  async function run() {
    const S = window.SIM, PF = window.__pf && window.__pf.PF; if (!S || !PF) return null;
    const bt = document.getElementById('detect'); if (bt) bt.textContent = 'Reading satellite...';
    const t0 = performance.now(), map = S.map, c = map.getCenter(), [tx, ty] = lonLatToTile(c.lng, c.lat, Z);
    const x0 = Math.floor(tx) - NT / 2 + (tx % 1 >= 0.5 ? 1 : 0), y0 = Math.floor(ty) - NT / 2 + (ty % 1 >= 0.5 ? 1 : 0);
    const cv = document.createElement('canvas'); cv.width = cv.height = W; const g = cv.getContext('2d', { willReadFrequently: true });
    try { const jobs = []; for (let j = 0; j < NT; j++) for (let i = 0; i < NT; i++)
      jobs.push(loadImg(TILE.replace('{z}', Z).replace('{x}', x0 + i).replace('{y}', y0 + j)).then(im => g.drawImage(im, i * 256, j * 256)));
      await Promise.all(jobs); } catch (e) { if (bt) bt.textContent = 'Satellite read failed'; return null; }
    const d = g.getImageData(0, 0, W, W).data;
    const an = PF.placeKey(c.lat, c.lng);
    const toM = (px, py) => { const [lon, lat] = tileToLonLat(x0 + px / 256, y0 + py / 256, Z); const q = PF.toLocal(an, lat, lon, 0); return [q.x, q.y]; };
    const a = toM(0, 0), b = toM(W, 0), mpp = Math.hypot(b[0] - a[0], b[1] - a[1]) / W;
    const { mask, nWeak } = buildMask(d);
    const cells = directions(mask);
    const use = cells.filter(cl => cl.ok && cl.phi != null);
    const sp = use.map(cl => cellSegments(mask, cl, mpp, 0).pitchPx).filter(Boolean).sort((p, q) => p - q);
    const gPitch = sp.length ? sp[sp.length >> 1] : 7 / mpp, pitchM = gPitch * mpp;   // median row pitch over resolved cells
    let segs = []; for (const cl of use) segs = segs.concat(cellSegments(mask, cl, mpp, gPitch).segs);
    const rows = mergeRows(segs); for (const r of rows) r.depthM = r.depthPx * mpp;
    const { L, km } = tables(rows, toM, pitchM);
    S.removeWhere(x => x.sat);
    S.addBlock({ lon: an.lon, lat: an.lat, anchor: an, lines: L, buf: PF.wireBuffer(an, L), sat: true, rowsGeometry: true });
    S.repaint();
    // dominant direction, as a compass bearing of the rows
    let vx = 0, vy = 0; for (const r of rows) { const l = Math.hypot(r.pts[1][0] - r.pts[0][0], r.pts[1][1] - r.pts[0][1]); vx += Math.cos(2 * r.phi) * l; vy += Math.sin(2 * r.phi) * l; }
    const pd = 0.5 * Math.atan2(vy, vx), brg = ((Math.atan2(-Math.sin(pd), -Math.cos(pd)) * 180 / Math.PI) % 180 + 180) % 180;
    const stats = { rows: rows.length, km: +km.toFixed(2), pitchM: +pitchM.toFixed(1), bearingDeg: Math.round(brg),
      cellsWithRows: cells.filter(x => x.ok).length, cellsBorrowed: cells.filter(x => x.borrowed).length, pitchCells: sp.length, cells: cells.length, gapPixelsFilled: nWeak, lines: L.length, ms: Math.round(performance.now() - t0), mpp: +mpp.toFixed(3) };
    if (bt) bt.textContent = `Rows from satellite (${stats.rows})`;
    S.info(`Estimated from satellite imagery, not measured: ${stats.rows} continuous rows, ${stats.km} km of tables over about ${Math.round(W * mpp)} m square. ` +
      `Row pitch about ${stats.pitchM} m (estimate); tables drawn 0.8 m front, 2.4 m back, legs every 5 m (assumed). ${CREDIT}.`);
    window.__rowsGeometry = stats; return stats;
  }

  function attach() {
    if (!window.SIM || !window.__pf) return setTimeout(attach, 200);
    const bt = document.getElementById('detect');
    if (bt) bt.onclick = run; else window.SIM.addButton && window.SIM.addButton('Rows from satellite', run);
    window.SIM.rowsGeometry = run;
  }
  attach();
})();
