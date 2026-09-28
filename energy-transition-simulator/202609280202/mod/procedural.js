// procedural.js: procedural fill ANYWHERE. Each public register asset (REPD: ground solar and battery storage) in view
// gets a wireframe anchored at its published register point and sized from its published capacity.
// Solar: the morning engine's own generator, the same one plant.js runs (engine/cmd-model.mjs derive + layoutInput,
// engine/plant-layout.mjs layoutPlantAsync), on a square of open land sized by plant.js's open-land rule. No new generator.
// Battery storage: a container yard sized by a stated, ASSUMED rule (below), since the engine has no battery generator.
// EV forecourts: not drawn, because no public register of forecourts with capacity is loaded here (said on screen).
// Calibration, said as it is: see CALIB below. No layout dimension is calibrated on a measured sample yet (N = 0).
// Every dimension is an engine default or an assumption, and says so.
// Arrival and view only: the register index is the overlay's own local file; nothing is fetched on movement.
(function () {
  'use strict';
  const here = document.currentScript && document.currentScript.src ? document.currentScript.src : location.href;
  const E = n => new URL('engine/' + n, here).href;
  // Calibration state, said as it is: the six measured samples hold ground heights only (no row pitch, no fenced area), so
  // N = 0 measured samples calibrate the south formula. Where the page has loaded imagery row runs (Scanner rows, derived
  // from imagery, estimated) INSIDE a site's own box, the rows are fitted to them (azimuth, and pitch when the engine rule
  // accepts it); a site with none inside its box keeps the south formula, tagged not calibrated. MW per hectare stays engine-derived.
  const CALIB = { N: 0, pitchTag: 'engine default (gcr formula), not calibrated', mwPerHaTag: 'derived from the engine site box, not calibrated' };
  const LABEL = `procedural estimate (formula calibrated on ${CALIB.N} measured samples: the 6 samples hold ground only; imagery row runs, estimated, set row azimuth and pitch only for a site with runs inside its own box)`;
  const MAX_ASSETS = 4, MIN_ZOOM = 12, REACH_DEG = 0.015;   // a site whose register point is within ~1.5 km of the view counts
  // GHOST style (the night's line-style rule: solid = measured, dashed = documented, ghost = estimated). Procedural wire is
  // estimated, so it is drawn by this module's OWN layer, faint and see-through, never in the solid cyan of measured wire,
  // and the satellite stays visible under it.
  const GHOST_RGBA = [0.82, 0.95, 1.0, 0.32];
  // Battery yard, ASSUMED (not measured, not cited): 2 h duration, 3.7 MWh per 20 ft container (6.06 x 2.44 x 2.9 m),
  // containers in rows of 10 at 3 m gaps, rows 6 m apart, fence 10 m outside.
  const BESS = { hours: 2, mwhPerUnit: 3.7, w: 6.06, d: 2.44, h: 2.9, perRow: 10, gap: 3, aisle: 6, fence: 10 };
  // Overhead line zones. Line geometry: READ from what pylons-real already loaded (its towersOf runs along the GridAtlas
  // lines), never copied or fetched here. reachM, ASSUMED: the conductor outreach pylons-real estimates for the voltage
  // (its largest arm half-length) plus 6 m horizontal, the barrier distance of HSE GS6, which the engine's plant-layout
  // cites for its overhead line zone ("GS6 planning zone, illustrative"). The engine adds its own ohlMarginM on top.
  const GS6_M = 6, SQUARE = 'square site box at register point, not the real field';

  function start(SIM, PF) {
    Promise.all([import(E('cmd-model.mjs')), import(E('plant-layout.mjs')), fetch(E('data/cables.json')).then(r => r.json()),
      fetch(new URL('find-go.data.json', here).href).then(r => r.json())])
      .then(([CM, PL, catalogue, reg]) => mount(SIM, PF, CM, PL, catalogue, reg))
      .catch(e => SIM.info('Procedural: did not load (' + e.message + ')'));
  }

  function mount(SIM, PF, CM, PL, catalogue, reg) {
    const f = reg.fields, ix = k => f.indexOf(k);
    const rows = reg.records.map(x => ({ ref: x[ix('ref')], tech: reg.tech[x[ix('tech')]], mw: x[ix('mw10')] / 10,
      lat: x[ix('lat5')] / 1e5, lon: x[ix('lon5')] / 1e5 })).filter(r => (r.tech === 'solar' || r.tech === 'bess') && r.mw > 0);
    const map = SIM.map, cache = new Map(), ghost = [];
    let on = false, busy = false, pending = false, shown = [];
    const layer = { id: 'procedural-ghost', type: 'custom', renderingMode: '3d',
      onAdd(m, gl) { const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; };
        this.pr = gl.createProgram();
        gl.attachShader(this.pr, sh(gl.VERTEX_SHADER, 'uniform mat4 u; attribute vec3 p; void main(){ gl_Position = u * vec4(p, 1.0); }'));
        gl.attachShader(this.pr, sh(gl.FRAGMENT_SHADER, 'precision mediump float; uniform vec4 c; void main(){ gl_FragColor = c; }'));
        gl.linkProgram(this.pr); this.gl = gl; },
      render(gl, args) {
        if (!ghost.length) return;
        const m = args.defaultProjectionData?.mainMatrix || args, loc = gl.getAttribLocation(this.pr, 'p');
        gl.useProgram(this.pr); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
        gl.uniform4fv(gl.getUniformLocation(this.pr, 'c'), GHOST_RGBA);
        for (const b of ghost) {
          if (!b.vbo) { b.vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b.vbo); gl.bufferData(gl.ARRAY_BUFFER, b.buf, gl.STATIC_DRAW); }
          const a = b.anchor, gz = (map.queryTerrainElevation && map.queryTerrainElevation([a.lon, a.lat])) || 0, o = PF.toMercator(a.lat, a.lon, gz), r = Array.from(m);
          for (let k = 0; k < 4; k++) r[12 + k] = m[k] * o.x + m[4 + k] * o.y + m[8 + k] * o.z + m[12 + k];
          gl.bindBuffer(gl.ARRAY_BUFFER, b.vbo); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
          gl.uniformMatrix4fv(gl.getUniformLocation(this.pr, 'u'), false, new Float32Array(r)); gl.drawArrays(gl.LINES, 0, b.buf.length / 3);
        }
        gl.depthMask(true);
      } };
    const addLayer = () => { try { if (!map.getLayer(layer.id)) map.addLayer(layer); } catch (e) { map.once('idle', addLayer); } };
    addLayer(); map.on('style.load', addLayer);                 // the Satellite / Dark / Wire buttons replace the style
    const drop = fn => { for (let i = ghost.length - 1; i >= 0; i--) if (fn(ghost[i])) { const b = ghost.splice(i, 1)[0];
      if (b.vbo && layer.gl) layer.gl.deleteBuffer(b.vbo); } map.triggerRepaint(); };
    const cap = document.createElement('div'); cap.id = 'procedural-caption';   // its own caption, never #info
    cap.style.cssText = 'position:absolute;right:8px;top:150px;z-index:2;max-width:440px;font:12px sans-serif;color:rgba(225,245,255,.9);'
      + 'background:rgba(0,0,0,.55);padding:6px 8px;border-radius:6px;border:1px dashed rgba(210,242,255,.45);display:none';
    document.body.appendChild(cap);
    const say = t => { cap.textContent = t; cap.style.display = t ? 'block' : 'none'; };

    function place(r, lines) {                                  // local metres at the register point -> anchored block
      const a = PF.placeKey(r.lat, r.lon), off = PF.toLocal(a, r.lat, r.lon, 0), out = [];
      for (let i = 0; i < lines.length; i += 20000) {
        const L = lines.slice(i, i + 20000).map(([x0, y0, z0, x1, y1, z1]) => [x0 + off.x, y0 + off.y, z0, x1 + off.x, y1 + off.y, z1]);
        out.push({ lon: r.lon, lat: r.lat, anchor: a, lines: L, buf: PF.wireBuffer(a, L), procedural: r.ref });
      }
      return out;
    }
    const box = (out, x, y, w, d, z0, h) => { const c = [[x, y], [x + w, y], [x + w, y + d], [x, y + d]];
      for (let i = 0; i < 4; i++) { const p = c[i], q = c[(i + 1) % 4]; out.push([p[0], p[1], z0, q[0], q[1], z0], [p[0], p[1], z0 + h, q[0], q[1], z0 + h], [p[0], p[1], z0, p[0], p[1], z0 + h]); } };

    const segD = (px, py, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy,
      t = L ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L)) : 0; return Math.hypot(px - ax - t * dx, py - ay - t * dy); };
    // Overhead lines (round r4): every GridAtlas line the page has ALREADY loaded (pylons-real holds the whole national files),
    // never only the tiles in view, so a site's clearance does not change with pan or zoom. Only spans within the site's own
    // reach (sqrt2*h + reachM + 50 m of the register point) count. Nothing fetched here. null = no line data loaded yet.
    function ohlNear(r, R) {                                    // real line spans within reach of the site box, in its local metres
      const P = window.__pylonsReal; if (!P || !P.lines || !P.towersOf || !P.KV) return null;
      const kvs = Object.keys(P.KV); if (!kvs.every(kv => Array.isArray(P.lines[kv]))) return null;
      const a = PF.placeKey(r.lat, r.lon), off = PF.toLocal(a, r.lat, r.lon, 0), out = [], k = Math.cos(r.lat * Math.PI / 180);
      for (const kv of kvs) { const reachM = Math.max(...P.KV[kv].arm) + GS6_M, lim = Math.SQRT2 * R + reachM + 50, dLa = (lim + 200) / 111320, dLo = dLa / k;
        P.lines[kv].forEach((ln, li) => { const [w, s, e, n] = ln.bbox;
          if (e < r.lon - dLo || w > r.lon + dLo || n < r.lat - dLa || s > r.lat + dLa) return;   // bbox far from the site: skip
          const pts = P.towersOf(kv, li).map(t => { const q = PF.toLocal(a, t.lat, t.lon, 0); return [q.x - off.x, q.y - off.y]; });
          for (let i = 1; i < pts.length; i++) if (segD(0, 0, ...pts[i - 1], ...pts[i]) < lim) out.push({ pts: [pts[i - 1], pts[i]], closed: false, reachM, kv }); }); }
      return out;                                               // one zone per span near the site, so far-away spans cost nothing
    }
    const ohlSay = (ohl, what) => ohl === null ? 'no overhead line data loaded for this site box: clearance not applied'
      : ohl.length ? what : 'no mapped overhead line within reach of this site box: nothing kept out';
    const crosses = (c, a, b) => { const ccw = (p, q, r) => (r[1] - p[1]) * (q[0] - p[0]) > (q[1] - p[1]) * (r[0] - p[0]);
      return c.some((p, i) => { const q = c[(i + 1) % 4]; return ccw(p, a, b) !== ccw(q, a, b) && ccw(p, q, a) !== ccw(p, q, b); }); };
    const rowDocs = () => { const R = window.SIM && window.SIM.scannerRows; return R && R.state && R.state.docs ? Object.values(R.state.docs) : []; };
    const sig = () => { const P = window.__pylonsReal;          // redo when the national line files or row files arrive, never on camera moves
      return 'lines' + (P && P.lines ? Object.keys(P.lines).filter(kv => Array.isArray(P.lines[kv])).sort().join(',') : '') + '|rows' + rowDocs().length; };
    // Row fit (round r3): the measured rows the page has ALREADY loaded (Scanner rows: the lab's row files, lon/lat runs from
    // imagery), never fetched here. Only runs whose midpoint lies inside THIS site's own square box (within h of the register
    // point, in PF.toLocal metres) count, so a site is never credited with a neighbour's rows and the fit does not depend on
    // the camera. The box used for the test is the south default box (the engine's layout before any fit), so it does not
    // depend on the fit it feeds. Azimuth: axial median, compass degrees 0-180; pitch: the row file's own reading.
    // No runs inside the box: null, and the south formula stays, tagged not calibrated.
    const wrap90 = d => ((d % 180) + 270) % 180 - 90;           // to (-90, 90]
    function halfSide(st, latDeg) {                                     // plant.js's open-land rule: half the square site box side, metres
      const tpl = CM.derive(st, { catalogue }).tpl, ld = { ...PL.LAYOUT_DEFAULTS, ...(CM.layoutInput(st, { latDeg, catalogue }).options || {}) }, T0 = PL.tableGeometry(st.layout, ld, tpl);
      return (Math.sqrt(Math.ceil(tpl.counts.strings / 2) * T0.pitch * (T0.lenU + PL.LAYOUT_DEFAULTS.tableGapM) * 1.5) + 2 * st.fence) / 2;
    }
    function fitRows(r) {
      const a = PF.placeKey(r.lat, r.lon), off = PF.toLocal(a, r.lat, r.lon, 0), hBox = halfSide({ ...CM.DEFAULTS, mw: r.mw }, r.lat), az = [], pitches = [];
      for (const doc of rowDocs()) { let n0 = 0;
        for (const [[lo0, la0], [lo1, la1]] of doc.rows || []) {
          const M = PF.toLocal(a, (la0 + la1) / 2, (lo0 + lo1) / 2, 0);
          if (Math.abs(M.x - off.x) > hBox || Math.abs(M.y - off.y) > hBox) continue;
          const A = PF.toLocal(a, la0, lo0, 0), B = PF.toLocal(a, la1, lo1, 0); az.push(Math.atan2(B.x - A.x, B.y - A.y) * 180 / Math.PI); n0++; }
        if (n0 && doc.row_pitch_m > 0) pitches.push(doc.row_pitch_m); }
      if (!az.length) return { n: 0, boxHalfM: hBox };
      let sx = 0, sy = 0; for (const d of az) { sx += Math.cos(d * Math.PI / 90); sy += Math.sin(d * Math.PI / 90); }
      const c = Math.atan2(sy, sx) * 90 / Math.PI, dev = az.map(d => wrap90(d - c)).sort((p, q) => p - q);
      pitches.sort((p, q) => p - q);
      return { azDeg: ((c + dev[dev.length >> 1]) % 180 + 180) % 180, pitchM: pitches.length ? pitches[pitches.length >> 1] : null, n: az.length, boxHalfM: hBox };
    }

    async function solar(r) {                                   // the engine's generator, as plant.js runs it
      // Rows fitted to the measured rows inside the site's own box when there are any: rows within 45 deg of north-south use the engine's
      // east-west (tent) layout, others its south layout; the residual angle turns the whole layout about the register point.
      const fr = fitRows(r), fit = fr.n ? fr : null, st = { ...CM.DEFAULTS, mw: r.mw };
      let rot = 0, pitchUsed = false;
      if (fit) { st.layout = Math.abs(wrap90(fit.azDeg)) <= 45 ? 'east-west' : 'south'; rot = wrap90(fit.azDeg - (st.layout === 'south' ? 90 : 0));
        if (fit.pitchM) { const d = CM.derive({ ...st, pitch: fit.pitchM }, { catalogue });   // the engine's own pitch rule, kept only if it fits
          pitchUsed = st.layout === 'south' ? d.gcr > 0 && d.gcr <= 0.9 : d.ewGapM >= 0.5; if (pitchUsed) st.pitch = fit.pitchM; } }
      const env = { latDeg: r.lat, catalogue }, inp = CM.layoutInput(st, env);
      const h = halfSide(st, r.lat), side = 2 * h;
      const ohlR = ohlNear(r, h), ohl = ohlR || [], th = rot * Math.PI / 180, cs = Math.cos(th), sn = Math.sin(th);
      const turn = ([e, n], s = 1) => [e * cs + s * n * sn, -s * e * sn + n * cs];     // clockwise by rot (s = -1: back)
      const ohlL = ohl.map(z => ({ ...z, pts: z.pts.map(q => turn(q, -1)) }));        // the real spans, in the layout's own frame
      const res = await PL.layoutPlantAsync({ boundary: [[-h, -h], [h, -h], [h, h], [-h, h]], targetMW: r.mw, layout: st.layout, template: inp.template,
        piles: false, groundAt: () => 0, grid: null, water: [], ohl: ohlL.length ? ohlL : null, options: { ...inp.options, slopeLimitPct: st.slope, fenceSetbackM: st.fence } });
      const Fr0 = res.frame, Fr = { en: (u, v) => turn(Fr0.en(u, v)) }, T = res.table, P = res.params, out = [], at = (u, v, z) => [...Fr.en(u, v), z], seg = (a, b) => out.push([...a, ...b]);
      const rowAz = ((st.layout === 'south' ? 90 : 0) + rot + 180) % 180;
      const rowTag = fit ? `row azimuth ${rowAz.toFixed(1)} deg, pitch ${T.pitch.toFixed(2)} m, fitted to ${fit.n.toLocaleString('en-GB')} measured rows inside a ${Math.round(2 * fit.boxHalfM).toLocaleString('en-GB')} m square around the register point`
        + (pitchUsed ? ' (pitch: the row file reading, estimated from imagery)' : ` (pitch: engine default, the row file's ${fit.pitchM ? fit.pitchM + ' m' : 'none'} did not fit the engine rule)`)
        : `south formula, not calibrated: row azimuth 90 deg, pitch ${T.pitch.toFixed(2)} m`;
      for (const fl of res.fields || [res.boundary]) for (let i = 0; i < fl.length; i++) seg(at(...fl[i], 1.5), at(...fl[(i + 1) % fl.length], 1.5));
      const lo = P.lowEdgeM, hi = lo + T.rise, t = res.tables;
      for (let q = 0; q < t.length; q += 6) { const ua = t[q], va = t[q + 1], ub = ua + (res.tableLen?.[q / 6] ?? T.lenU), vb = va + T.depth;
        const A = at(ua, va, lo), B = at(ub, va, lo), C = at(ub, vb, hi), D = at(ua, vb, hi); seg(A, B); seg(B, C); seg(C, D); seg(D, A); }
      const tb = [];
      for (let q = 0; q < t.length; q += 6) { const ua = t[q], va = t[q + 1], ub = ua + (res.tableLen?.[q / 6] ?? T.lenU), vb = va + T.depth;
        tb.push([Fr.en(ua, va), Fr.en(ub, va), Fr.en(ub, vb), Fr.en(ua, vb)]); }
      for (const s of res.stations) { const [e, n] = Fr.en(s.u, s.v); box(out, e - 6, n - 1.5, 12, 3, 0, 3); }
      const kept = (res.skipped && res.skipped.ohl) || 0, areaHa = side * side / 1e4, mwPerHa = r.mw / areaHa;
      const rowsV = [...new Set(Array.from({ length: t.length / 6 }, (_, i) => Math.round(t[6 * i + 1] * 1000) / 1000))].sort((a, b) => a - b);
      return { lines: out, geom: { ohl, ohlLoaded: ohlR !== null, ohlRadiusM: h, marginM: P.ohlMarginM, tables: tb, containers: [], skipped: kept,
          formula: { pitchM: T.pitch, pitchTag: fit && pitchUsed ? 'row file reading, estimated from imagery' : CALIB.pitchTag, rowAzDeg: rowAz, layout: st.layout, fitN: fit ? fit.n : 0, fitBoxHalfM: fr.boxHalfM, fitAzDeg: fit ? fit.azDeg : null, rowTag, areaHa, mwPerHa, mwPerHaTag: CALIB.mwPerHaTag, N: CALIB.N,
            boundary: [[-h, -h], [h, -h], [h, h], [-h, h]], rowsV } },
        text: `${r.mw} MW solar: ${res.built.tables.toLocaleString('en-GB')} tables, ${rowTag}, `
          + `site box ${areaHa.toFixed(1)} ha = ${mwPerHa.toFixed(2)} MW/ha (${CALIB.mwPerHaTag}), ${res.built.stations} stations; `
          + ohlSay(ohlR, `${kept.toLocaleString('en-GB')} table positions kept out of overhead line zones (illustrative)`)
          + `; ${SQUARE}` };
    }
    function bess(r) {                                          // ASSUMED yard rule (see BESS above)
      const n = Math.max(1, Math.ceil(r.mw * BESS.hours / BESS.mwhPerUnit)), cols = Math.min(n, BESS.perRow), nr = Math.ceil(n / BESS.perRow);
      const W = cols * BESS.w + (cols - 1) * BESS.gap, D = nr * BESS.d + (nr - 1) * BESS.aisle, out = [], ohlR = ohlNear(r, Math.max(W, D) / 2 + BESS.fence), ohl = ohlR || [];
      const margin = PL.LAYOUT_DEFAULTS.ohlMarginM, cont = [];  // the engine's own margin, so tables and containers keep the same clearance
      const near = c => ohl.some(z => { const [a, b] = z.pts, lim = z.reachM + margin;   // box within reach + margin of the span
        return c.some(p => segD(...p, ...a, ...b) < lim) || [a, b].some(p => Math.hypot(Math.max(c[0][0] - p[0], 0, p[0] - c[2][0]),
          Math.max(c[0][1] - p[1], 0, p[1] - c[2][1])) < lim) || crosses(c, a, b); });
      let dropped = 0;
      for (let k = 0; k < n; k++) { const x = -W / 2 + (k % BESS.perRow) * (BESS.w + BESS.gap), y = -D / 2 + Math.floor(k / BESS.perRow) * (BESS.d + BESS.aisle);
        const c = [[x, y], [x + BESS.w, y], [x + BESS.w, y + BESS.d], [x, y + BESS.d]];
        if (near(c)) { dropped++; continue; } cont.push(c); box(out, x, y, BESS.w, BESS.d, 0, BESS.h); }
      box(out, -W / 2 - BESS.fence, -D / 2 - BESS.fence, W + 2 * BESS.fence, D + 2 * BESS.fence, 0, 2.4);
      return { lines: out, geom: { ohl, ohlLoaded: ohlR !== null, ohlRadiusM: Math.max(W, D) / 2 + BESS.fence, marginM: margin, tables: [], containers: cont, skipped: dropped },
        text: `${r.mw} MW storage: ${n - dropped} of ${n} containers (assumed 2 h, 3.7 MWh each); `
          + ohlSay(ohlR, `${dropped} container positions kept out of overhead line zones (illustrative)`) + `; ${SQUARE}` };
    }

    async function refresh() {
      if (!on) return; if (busy) { pending = true; return; } busy = true;
      try {
        const c = map.getCenter(), b = map.getBounds(), k = Math.cos(c.lat * Math.PI / 180);
        const inView = r => r.lat > b.getSouth() - REACH_DEG && r.lat < b.getNorth() + REACH_DEG && r.lon > b.getWest() - REACH_DEG / k && r.lon < b.getEast() + REACH_DEG / k;
        const near = map.getZoom() < MIN_ZOOM ? [] : rows.filter(inView)
          .map(r => ({ r, d: Math.hypot(r.lat - c.lat, (r.lon - c.lng) * k) })).sort((a, z) => a.d - z.d).slice(0, MAX_ASSETS).map(x => x.r);
        const texts = [];
        for (const r of near) {
          const sg = sig(), old = cache.get(r.ref);            // redo once the real lines arrive (pylons-real loads them async)
          if (!old || old.sig !== sg) { const g = r.tech === 'bess' ? bess(r) : await solar(r);
            if (old) { drop(x => x.procedural === r.ref); shown = shown.filter(z => z !== r.ref); }
            cache.set(r.ref, { blocks: place(r, g.lines), text: g.text, n: g.lines.length, geom: g.geom, sig: sg }); }
          texts.push(cache.get(r.ref).text);
        }
        const keep = new Set(near.map(r => r.ref));
        drop(x => !keep.has(x.procedural));
        for (const r of near) if (!shown.includes(r.ref)) for (const bl of cache.get(r.ref).blocks) { delete bl.vbo; ghost.push(bl); }
        map.triggerRepaint();
        shown = near.map(r => r.ref);
        btn.textContent = `Procedural (${shown.length})`;
        say(shown.length ? `${LABEL}. Ghost lines = estimated (solid = measured, dashed = documented). At register points, sized from register capacity: ${texts.join('; ')}. EV forecourts: no register loaded, not drawn.`
          : `Procedural: no register solar or storage in view${map.getZoom() < MIN_ZOOM ? ' (zoom in to ' + MIN_ZOOM + ')' : ''}. ${LABEL}.`);
        window.__procedural = { label: LABEL, style: 'ghost', ghostBlocks: ghost.length, layer: !!map.getLayer(layer.id), calibN: CALIB.N, shown: near.map(r => ({ ref: r.ref, tech: r.tech, mw: r.mw, lat: r.lat, lon: r.lon, segments: cache.get(r.ref).n, text: cache.get(r.ref).text, geom: cache.get(r.ref).geom })) };
      } catch (e) { say('Procedural: ' + e.message); }
      busy = false; if (pending) { pending = false; refresh(); }
    }
    const btn = SIM.addButton('Procedural', () => { on = !on; btn.classList.toggle('on', on); if (on) refresh(); else { drop(() => true); shown = []; say(''); btn.textContent = 'Procedural'; } });
    btn.id = 'procedural';
    map.on('moveend', refresh);
    window.__proceduralRefresh = refresh; window.__proceduralFit = ref => { const r = rows.find(x => x.ref === ref); return r ? fitRows(r) : null; }; window.__proceduralGhost = () => ghost.length;
    window.__proceduralOhl = ref => { const r = rows.find(x => x.ref === ref), c = cache.get(ref); if (!r || !c) return null;   // fresh, not the cache
      const o = ohlNear(r, c.geom.ohlRadiusM); return { loaded: o !== null, spans: o ? o.length : 0, key: o ? o.map(z => z.kv + ':' + z.pts.flat().map(v => v.toFixed(2)).join(',')).join('|') : '' }; };
  }

  (function wait() { if (window.SIM && window.__pf && window.__pf.PF) start(window.SIM, window.__pf.PF); else setTimeout(wait, 100); })();
})();
