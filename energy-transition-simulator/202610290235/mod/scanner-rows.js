// scanner-rows: the GPU lab's baked panel rows (lon/lat per public register farm) drawn as tilted tables where they
// are, labelled "estimated from imagery by the Wire Frame Scanner". Each farm is checked: the rows' bounding box must
// overlap the register point (within PAD_M), else the farm is drawn in no place and the check says FAIL.
//
// Provenance of every value used here:
//   row lon/lat ............ estimated  (GPU lab, from satellite imagery; NumPy witness in the row file)
//   register point ......... derived    (public register coordinates, in scanner-rows.farms.json with its source)
//   strip width in plan .... derived    (sample step px x metres per pixel, both from the row file / farms file)
//   tilt, low edge height .. assumed    (TILT_DEG, LOW_M below; not read from the imagery)
//   build year, survey years, imagery date .. derived (farms file, each with its source; rule R5-9 gate)
//   facing side ............ assumed    (equator side of the row; east when rows run within 30 deg of north-south)
// Plain script: pure helpers export to Node (tests/scanner-rows.test.cjs); in the browser it attaches to window.SIM.
(function () {
  'use strict';
  const LABEL = 'estimated from imagery by the Wire Frame Scanner';
  const TILT_DEG = 25, LOW_M = 0.8, PAD_M = 50, CELL_M = 250, GROUPS_MS = 120;
  const R = 6371008.8, D2R = Math.PI / 180;

  // ---- pure helpers (no DOM, no PF) ----
  function bbox(rows) {
    let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
    for (const seg of rows) for (const [lo, la] of seg) { if (lo < w) w = lo; if (lo > e) e = lo; if (la < s) s = la; if (la > n) n = la; }
    return { w, s, e, n };
  }
  // Small-distance local metres around (lat0, lon0): equirectangular, good to well under 0.1 % over a few km.
  const local = (lat0, lon0) => (lat, lon) => [(lon - lon0) * D2R * R * Math.cos(lat0 * D2R), (lat - lat0) * D2R * R];
  function distToBboxM(b, lat, lon) {
    const L = local(lat, lon), cl = [Math.min(Math.max(lon, b.w), b.e), Math.min(Math.max(lat, b.s), b.n)];
    const [x, y] = L(cl[1], cl[0]); return Math.hypot(x, y);
  }
  function nearestRowM(rows, lat, lon) {
    const L = local(lat, lon); let best = Infinity;
    for (const [[lo0, la0], [lo1, la1]] of rows) {
      const [ax, ay] = L(la0, lo0), [bx, by] = L(la1, lo1), dx = bx - ax, dy = by - ay, d2 = dx * dx + dy * dy;
      const t = d2 > 0 ? Math.min(1, Math.max(0, -(ax * dx + ay * dy) / d2)) : 0;
      const d = Math.hypot(ax + t * dx, ay + t * dy); if (d < best) best = d;
    }
    return best;
  }
  // The check: rows' bounding box overlaps the register point (inside, or within padM of its edge).
  function checkFarm(farm, doc, padM = PAD_M) {
    const b = bbox(doc.rows), p = farm.point, d = distToBboxM(b, p.lat, p.lon);
    const L = local(p.lat, p.lon), [x0, y0] = L(b.s, b.w), [x1, y1] = L(b.n, b.e);
    return { register: farm.register, ok: d <= padM, inside: d === 0, distToBboxM: +d.toFixed(2), padM,
      nearestRowM: +nearestRowM(doc.rows, p.lat, p.lon).toFixed(2), runs: doc.rows.length,
      bbox: b, bboxM: [+(x1 - x0).toFixed(1), +(y1 - y0).toFixed(1)] };
  }
  // One run (plan metres a -> b) -> a tilted strip: low edge, high edge, two slanted ends, four legs.
  // widthM is the strip width in plan; facing side as documented above.
  function tableLines(ax, ay, bx, by, widthM, tiltDeg = TILT_DEG, lowM = LOW_M) {
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy); if (!(len > 0)) return [];
    let nx = dy / len, ny = -dx / len;                          // unit across-row normal
    const ns = Math.abs(dx) / len < 0.5;                        // rows within 30 deg of north-south
    if (ns ? nx < 0 : ny > 0) { nx = -nx; ny = -ny; }           // face east (N-S rows) or south (E-W rows)
    const h = widthM / 2, hi = lowM + widthM * Math.tan(tiltDeg * D2R);
    const lo0 = [ax + nx * h, ay + ny * h, lowM], lo1 = [bx + nx * h, by + ny * h, lowM];
    const hi0 = [ax - nx * h, ay - ny * h, hi], hi1 = [bx - nx * h, by - ny * h, hi];
    const seg = (p, q) => [p[0], p[1], p[2], q[0], q[1], q[2]], gnd = p => [p[0], p[1], 0];
    return [seg(lo0, lo1), seg(hi0, hi1), seg(lo0, hi0), seg(lo1, hi1), seg(gnd(lo0), lo0), seg(gnd(lo1), lo1), seg(gnd(hi0), hi0), seg(gnd(hi1), hi1)];
  }
  // Rule R5-9 (survey year before scanning). The LiDAR under a farm is "pre-construction ground" when the build year
  // is the same as or later than ANY DSM or DTM survey year under it, or when any of those years is unknown. Rows are
  // scanned from LiDAR only when every DSM and DTM survey year is later than the build year. Otherwise rows may come
  // only from imagery, labelled estimated. Returns { lidarRows, ground, reason }.
  function surveyGate(buildYear, dsmYears, dtmYears) {
    const yrs = [...(dsmYears || []), ...(dtmYears || [])], ok = y => Number.isInteger(y) && y > 1900;
    if (!ok(buildYear)) return { lidarRows: false, ground: 'pre-construction', reason: 'build year unknown' };
    if (!(dsmYears || []).length || !(dtmYears || []).length || !yrs.every(ok))
      return { lidarRows: false, ground: 'pre-construction', reason: 'a DSM or DTM survey year is unknown' };
    const early = yrs.filter(y => y <= buildYear);
    if (early.length) return { lidarRows: false, ground: 'pre-construction',
      reason: `LiDAR survey ${Math.min(...early)} is not later than the build year ${buildYear}` };
    return { lidarRows: true, ground: 'post-construction', reason: `every LiDAR survey (${yrs.join(', ')}) is later than the build year ${buildYear}` };
  }
  // Where the row file came from: 'lidar' if its source or method names LiDAR/DSM, else 'imagery'.
  const rowSource = doc => /lidar|dsm|dtm/i.test(`${doc.source || ''} ${doc.method || ''}`) ? 'lidar' : 'imagery';
  // Decide whether a farm's row file may be drawn: imagery rows always (labelled estimated); LiDAR rows only past the gate.
  function rowsAllowed(farm, doc) {
    const ly = farm.lidar_survey_years || {}, g = surveyGate(farm.build_year && farm.build_year.value, ly.dsm, ly.dtm);
    const src = rowSource(doc);
    return Object.assign({ source: src, allowed: src === 'imagery' || g.lidarRows }, g);
  }
  const stripWidthM = (farm, doc) => (farm.sample_step_px ? farm.sample_step_px.value : 3) * doc.metres_per_pixel;
  const api = { LABEL, TILT_DEG, LOW_M, PAD_M, surveyGate, rowSource, rowsAllowed, bbox, distToBboxM, nearestRowM, checkFarm, tableLines, stripWidthM };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }

  // ---- browser ----
  const BASE = (document.currentScript && document.currentScript.src.replace(/[^/]*$/, '')) || 'mod/';
  const state = { farms: null, docs: {}, checks: [], busy: false };
  const getJson = async u => { const r = await fetch(BASE + u); if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); };
  async function loadFarms() { if (!state.farms) state.farms = (await getJson('scanner-rows.farms.json')).farms; return state.farms; }
  async function check() {
    const farms = await loadFarms(); state.checks = [];
    for (const f of farms) { const doc = state.docs[f.rows] || (state.docs[f.rows] = await getJson(f.rows)); state.checks.push(checkFarm(f, doc)); }
    return state.checks;
  }
  // Draw one farm: rows binned into CELL_M cells, each cell a block anchored at its own place key (so the terrain
  // under each block is read near its own rows), plus a 30 m mast and a PAD_M ring at the register point.
  async function drawFarm(S, PF, farm, fly) {
    const doc = state.docs[farm.rows] || (state.docs[farm.rows] = await getJson(farm.rows));
    const res = checkFarm(farm, doc); res.gate = rowsAllowed(farm, doc); res.imagery = farm.imagery || null;
    if (!res.gate.allowed) { res.ok = false; return res; }
    if (!res.ok) return res;
    const p = farm.point, a0 = PF.placeKey(p.lat, p.lon), W = stripWidthM(farm, doc), cells = new Map();
    for (const seg of doc.rows) {
      const [[lo0, la0], [lo1, la1]] = seg, q = PF.toLocal(a0, (la0 + la1) / 2, (lo0 + lo1) / 2, 0);
      const k = Math.floor(q.x / CELL_M) + ',' + Math.floor(q.y / CELL_M);
      (cells.get(k) || cells.set(k, []).get(k)).push(seg);
    }
    if (fly) S.map.easeTo({ center: [p.lon, p.lat], zoom: 15.4, pitch: 55, bearing: -20, duration: 1200 });
    let n = 0;
    for (const segs of cells.values()) {
      let sl = 0, so = 0; for (const [[lo0, la0], [lo1, la1]] of segs) { sl += la0 + la1; so += lo0 + lo1; }
      const an = PF.placeKey(sl / (2 * segs.length), so / (2 * segs.length)), L = [];
      for (const [[lo0, la0], [lo1, la1]] of segs) {
        const A = PF.toLocal(an, la0, lo0, 0), B = PF.toLocal(an, la1, lo1, 0);
        for (const l of tableLines(A.x, A.y, B.x, B.y, W)) L.push(l);
      }
      S.addBlock({ lon: an.lon, lat: an.lat, anchor: an, lines: L, buf: PF.wireBuffer(an, L), scannerRows: farm.register, sat: true });
      n += segs.length; await new Promise(r => setTimeout(r, GROUPS_MS));
    }
    const M = [[0, 0, 0, 0, 0, 30]];
    for (let i = 0; i < 48; i++) { const t0 = i / 48 * 2 * Math.PI, t1 = (i + 1) / 48 * 2 * Math.PI; M.push([PAD_M * Math.cos(t0), PAD_M * Math.sin(t0), 0.5, PAD_M * Math.cos(t1), PAD_M * Math.sin(t1), 0.5]); }
    const ap = PF.placeKey(p.lat, p.lon), o = PF.toLocal(ap, p.lat, p.lon, 0);
    const Mo = M.map(l => [l[0] + o.x, l[1] + o.y, l[2], l[3] + o.x, l[4] + o.y, l[5]]);
    S.addBlock({ lon: ap.lon, lat: ap.lat, anchor: ap, lines: Mo, buf: PF.wireBuffer(ap, Mo), scannerRows: farm.register, registerPoint: true });
    return Object.assign(res, { drawnRuns: n, cells: cells.size, stripWidthM: +W.toFixed(3) });
  }
  async function run(btn) {
    const S = window.SIM, PF = window.__pf && window.__pf.PF; if (!S || !PF || state.busy) return state.checks; state.busy = true;
    try {
      btn.textContent = 'Scanner rows: loading...'; S.removeWhere(b => b.scannerRows);
      const farms = await loadFarms(), out = [];
      for (let i = 0; i < farms.length; i++) out.push(await drawFarm(S, PF, farms[i], i === 0));
      state.checks = out;
      const good = out.filter(r => r.ok), f0 = good[0];
      S.info(`Panel rows ${LABEL} (not measured, not a survey). ${good.length}/${out.length} farms pass the on-farm check ` +
        `(rows' box overlaps the register point within ${PAD_M} m). ` + (f0 ? `${f0.register}: ${f0.drawnRuns} runs, box ${f0.bboxM[0]} x ${f0.bboxM[1]} m, ` +
        `nearest row ${f0.nearestRowM} m from the register point. Strip width ${f0.stripWidthM} m (derived); tilt ${TILT_DEG} deg and low edge ${LOW_M} m assumed. ` : '') +
        (f0 && f0.imagery ? `Imagery captured ${f0.imagery.capture_date}, provider accuracy ${f0.imagery.stated_accuracy_m} m. ` : '') +
        (f0 ? `Rule R5-9: ${f0.gate.reason}, so the LiDAR here is ${f0.gate.ground} ground` +
          (f0.gate.lidarRows ? '. ' : ' (for piles and earthworks, never scanned for rows). ') : '') +
        out.filter(r => r.gate && !r.gate.allowed).map(r => `${r.register}: LiDAR rows refused (${r.gate.reason}). `).join('') +
        'Mast and ring mark the register point.');
      btn.textContent = `Scanner rows (${good.length}/${out.length})`;
    } catch (e) { btn.textContent = 'Scanner rows: failed'; console.error(e); }
    state.busy = false; return state.checks;
  }
  function init() {
    if (!window.SIM) return setTimeout(init, 200);
    // Switched OFF (28 Sept): it drew the one scanned farm's rows from any location. The loader (check, state) stays
    // for procedural's fit; there is no button, and run() draws nothing.
    window.SIM.scannerRows = Object.assign({ run: async () => null, check, state }, api);
  }
  init();
})();
