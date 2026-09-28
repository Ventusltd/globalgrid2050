// ac-trenches v2: every LV AC trench at REPD 6502, drawn to scale from mod/ac-trenches-6502.json, for two illustrative
// scenarios at the same stations (author's reference design: 28 three-phase inverters per 10 MVA station, 84 phase cables):
//   A  bunded station, side-entry ducts: 3 x 1C 400 mm2 Al XLPE/PVC unarmoured pulled together in ONE duct per inverter,
//      each duct into its own pre-drilled hole in the bund wall after a straight perpendicular entry.
//   B  direct-buried armoured (1C 400 mm2 Al ATA, HDPE sheath), no bund: the station stands on screw piles and the cables
//      sweep up at their bend radius into bottom-entry gland plates.
// Entry through 1, 2, 3 or 4 sides. Cable OD and MBR are EDITABLE per installation; every duct size, width, layer count and
// bend flag recomputes live (the routes were computed once, at the default radius). 2D plan: every trench at true width,
// holes/ports, roads as wireframe with ducted crossings. 3D: one station at a time (bund walls with holes, or piles and
// units), ducts and cables in section, and the two scenarios ANIMATED. Everything is a MODEL; provenance travels in the JSON.
// Private layer: ?private=1 on a local server only (never shipped). Plain script; attaches to window.SIM.
(function () {
  'use strict';
  const BASE = (document.currentScript && document.currentScript.src.replace(/[^/]*$/, '')) || 'mod/';
  const EYE = 1.7, FAULT = '#ff2bd6', GAP = 0.10, MARGIN = 0.10;
  let doc = null, inst = 'A', sides = '4', on = false, panel = null, scale = null, focus = null, priv = null, anim = null, fillOpacity = 0.72, marks = [];
  const P = { A: { od: 31.5, mbr: 472 }, B: { od: 37.4, mbr: 449 } };           // mm, editable on screen

  // ---- duct and bend maths (pure; exported for the smoke check) ----
  const BANDS = [[2.4, 'very small'], [2.5, 'small'], [2.6, 'moderate'], [2.9, 'significant'], [3.0, 'moderate'], [3.2, 'small'], [Infinity, 'very small']];
  const jamBand = J => BANDS.find(b => J < b[0])[1];
  function clearance(D, d) {   // mm; triangular (J < 2.5): Southwire eq. 7-24; cradled: bottom cable at the invert, two on the wall touching it
    const J = D / d;
    if (J < 2.5) { const x = d / (D - d); return D / 2 - 1.366 * d + (D - d) / 2 * Math.sqrt(Math.max(0, 1 - x * x)); }
    const a = D / 2 - d / 2, y = (d * d - 2 * a * a) / (2 * a); return D / 2 - (y + d / 2);
  }
  function ductCheck(D, d) {
    const J = D / d, fill = 3 * d * d / (D * D), cl = clearance(D, d), band = jamBand(J), fits = D >= 2.1547 * d;
    const pass = fits && fill <= 0.40 && cl >= Math.max(0.1 * D, 25.4) && (band === 'small' || band === 'very small');
    return { J, fill, cl, band, fits, pass, preferred: pass && band === 'very small', config: J < 2.5 ? 'triangular' : 'cradled' };
  }
  // smallest UK duct whose jam stays 'very small' (and passes fill and clearance) over the assumed OD range scaled to the edited OD
  function pickDuct(table, od) {
    const lo = od * 29.7 / 31.5, hi = od * 33.5 / 31.5, uk = table.filter(t => t.uk).sort((a, b) => a.id_mm - b.id_mm);
    const over = (t, key) => { for (let k = 0; k <= 40; k++) if (!ductCheck(t.id_mm, lo + (hi - lo) * k / 40)[key]) return false; return true; };
    for (const key of ['preferred', 'pass']) for (const t of uk) if (over(t, key)) return { duct: t, rule: key === 'preferred' ? 'jam very small over the range' : 'jam small over the range (no very-small duct in the table)', check: ductCheck(t.id_mm, od) };
    return { duct: null, rule: 'no duct in the table passes', check: null };
  }
  function params(d, which) {   // live geometry for an installation
    const p = P[which], od = p.od / 1000, mbr = p.mbr / 1000;
    if (which === 'A') {
      const pk = pickDuct(d.duct_table, p.od), bend = pk.duct ? pk.duct.bend.mm / 1000 : NaN;
      const R = Math.max(bend || 0, mbr), governs = !(bend >= mbr) ? 'cable MBR' : 'duct bend';
      return { which, od, mbr, duct: pk.duct, dcheck: pk.check, drule: pk.rule, unitW: pk.duct ? pk.duct.od_mm / 1000 : NaN, R, governs, mbrFlag: !(mbr <= bend), Ls: d.installations.A.entry.straight_m };
    }
    return { which, od, mbr, R: mbr, governs: 'cable MBR', mbrFlag: false, unitW: od, Ls: d.installations.B.entry.straight_m };
  }
  function width(pp, n, L = 1) {
    const k = Math.ceil(n / Math.max(1, L)); if (k <= 0) return 0;
    if (pp.which === 'A') return k * pp.unitW + (k - 1) * GAP + 2 * MARGIN;
    const m = 3 * k; return m * pp.od + (m - 1) * pp.od + 2 * MARGIN;         // flat layer, one diameter clear (assumed)
  }
  function layersFor(pp, n, avail) { for (let L = 1; L <= 3; L++) if (width(pp, n, L) <= avail + 1e-9) return { L, fault: false }; return { L: 3, fault: true }; }

  // ---- frame (local E/N metres about the register point, WGS84 radii at the register point, as the build) ----
  const llOf = d => (e, n) => [d.frame.lon0 + e / d.frame.KX, d.frame.lat0 + n / d.frame.KY];
  const ll = (e, n) => llOf(doc)(e, n);
  const caseOf = (d, i, s) => d.cases[i + s];
  function edgesOf(d, c) {
    return c.edges.map(r => { const V = []; for (let k = 6; k < r.length; k += 2) V.push([r[k], r[k + 1]]); return { si: r[0], kind: r[1], n: r[2], avail: r[3], L0: r[4], fault0: !!(r[5] & 1), rowx: !!(r[5] & 2), V }; });
  }
  function hull(pts) {
    const Pp = pts.slice().sort((p, q) => p[0] - q[0] || p[1] - q[1]); if (Pp.length < 3) return Pp;
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = [];
    for (const p of Pp) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (let i = Pp.length - 1; i >= 0; i--) { const p = Pp[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }
  // ---- live recompute of one case: widths, layers, faults, bend and entry flags ----
  function evaluate(d, i, s) {
    const c = caseOf(d, i, s), pp = params(d, i), E = edgesOf(d, c);
    let km = 0, widest = { n: 0, w: 0, L: 1, si: -1 }, faults = 0;
    for (const e of E) {
      const { L, fault } = e.kind === 'a' ? { L: 1, fault: false } : layersFor(pp, e.n, e.avail);
      e.L = L; e.w = width(pp, e.n, L); e.fault = fault || e.fault0 || e.rowx; faults += (fault || e.fault0) ? 1 : 0;   // rowx: a row crossing (fault colour, counted apart)
      let len = 0; for (let k = 1; k < e.V.length; k++) len += Math.hypot(e.V[k][0] - e.V[k - 1][0], e.V[k][1] - e.V[k - 1][1]); e.len = len; km += len / 1000;
      if (e.n > widest.n || (e.n === widest.n && (e.w > widest.w || (e.w === widest.w && e.si < widest.si)))) widest = { n: e.n, w: e.w, L, si: e.si };   // ties: lowest station index (as the JSON)
    }
    const bendFlags = c.bends.filter(b => b[2] < pp.R - 1e-6), bendBy = {};   // same tolerance as the build (rmax stored to 1e-6 m)
    for (const b of bendFlags) bendBy[b[4]] = (bendBy[b[4]] || 0) + 1;
    let entryFlags = 0; const entryBy = {};
    for (const p of c.ports) for (const cl of p.clear) if (cl != null && cl < pp.Ls + pp.R - 1e-9) { entryFlags++; entryBy[p.si] = (entryBy[p.si] || 0) + 1; }
    return { c, pp, E, km, widest, faults, bendFlags, bendBy, entryFlags, entryBy };
  }
  function holesOf(d, c) {   // hole / port positions for a case: evenly spread along the wall (or over its clear stretches, ports.t), one per duct (A) or circuit (B)
    const out = [];
    for (const p of c.ports) {
      const B = d.bunds[p.si], w = B.walls.find(x => x.side === p.side); if (!w) continue;
      for (let h = 0; h < p.nh; h++) { const t = p.t && p.t[h] != null ? p.t[h] : (h + 0.5) / p.nh; out.push({ si: p.si, side: p.side, i: h + 1, nh: p.nh, en: [w.p0[0] + (w.p1[0] - w.p0[0]) * t, w.p0[1] + (w.p1[1] - w.p0[1]) * t], out: w.out, clear: p.clear[h] }); }
    }
    return out;
  }
  // ---- 2D plan geometry (pure; the smoke check measures it back) ----
  function planGeo(d, i, s) {
    const ev = evaluate(d, i, s), feats = [], caps = new Map(), ll = llOf(d);
    for (const e of ev.E) {
      for (let k = 1; k < e.V.length; k++) {
        const a = e.V[k - 1], b = e.V[k], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy); if (len < 1e-3) continue;
        const ox = -dy / len * e.w / 2, oy = dx / len * e.w / 2, A1 = [a[0] + ox, a[1] + oy], A2 = [a[0] - ox, a[1] - oy], B1 = [b[0] + ox, b[1] + oy], B2 = [b[0] - ox, b[1] - oy];
        feats.push({ type: 'Feature', properties: { n: e.n, L: e.L, w: +e.w.toFixed(3), fault: e.fault ? 1 : 0, kind: 'quad' }, geometry: { type: 'Polygon', coordinates: [[A1, B1, B2, A2, A1].map(p => ll(...p))] } });
        for (const [key, p, q] of [[a.join(','), A1, A2], [b.join(','), B1, B2]]) { if (!caps.has(key)) caps.set(key, []); caps.get(key).push({ p, q, e }); }
      }
    }
    for (const cl of caps.values()) {
      if (cl.length < 2) continue; const h = hull(cl.flatMap(c => [c.p, c.q])); if (h.length < 3) continue;
      const top = cl.reduce((x, y) => (y.e.w > x.e.w ? y : x)).e;
      feats.push({ type: 'Feature', properties: { n: top.n, L: top.L, w: +top.w.toFixed(3), fault: 0, kind: 'join' }, geometry: { type: 'Polygon', coordinates: [[...h, h[0]].map(p => ll(...p))] } });
    }
    const holes = holesOf(d, ev.c).map(h => ({ type: 'Feature', properties: { id: `${d.bunds[h.si].id} ${h.side}${h.i}`, flag: h.clear != null && h.clear < ev.pp.Ls + ev.pp.R ? 1 : 0 }, geometry: { type: 'Point', coordinates: ll(...h.en) } }));
    const bunds = d.bunds.map(B => { const r = B.walls.map(w => ll(...w.p0)); return { type: 'Feature', properties: { id: B.id, cls: B.cls }, geometry: { type: 'Polygon', coordinates: [[...r, r[0]]] } }; });
    const roads = [];
    for (const t of d.roads.tracks) {
      const V = []; for (let k = 0; k < t.line.length; k += 2) V.push([t.line[k], t.line[k + 1]]);
      roads.push({ type: 'Feature', properties: { kind: 'c', w: t.width_m }, geometry: { type: 'LineString', coordinates: V.map(p => ll(...p)) } });
      for (const sg of [1, -1]) {   // edges at +/- w/2 (vertex normals averaged)
        const E2 = V.map((p, k) => { const a = V[Math.max(0, k - 1)], b = V[Math.min(V.length - 1, k + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return ll(p[0] - dy / l * sg * t.width_m / 2, p[1] + dx / l * sg * t.width_m / 2); });
        roads.push({ type: 'Feature', properties: { kind: 'e', w: t.width_m }, geometry: { type: 'LineString', coordinates: E2 } });
      }
    }
    const cross = ev.c.crossings.map(x => ({ type: 'Feature', properties: { n: x[2], kind: x[4] }, geometry: { type: 'Point', coordinates: ll(x[0], x[1]) } }));
    const bends = ev.bendFlags.map(b => ({ type: 'Feature', properties: { r: b[2] }, geometry: { type: 'Point', coordinates: ll(b[0], b[1]) } }));
    const fc = features => ({ type: 'FeatureCollection', features });
    return { ev, trench: fc(feats), holes: fc(holes), bunds: fc(bunds), roads: fc(roads), cross: fc(cross), bends: fc(bends) };
  }

  function addPlan(map) {
    if (!doc || !on) return;
    const g = planGeo(doc, inst, sides);
    for (const [id, data] of [['act-trench', g.trench], ['act-bunds', g.bunds], ['act-holes', g.holes], ['act-roads', g.roads], ['act-cross', g.cross], ['act-bends', g.bends]]) {
      if (map.getSource(id)) map.getSource(id).setData(data); else map.addSource(id, { type: 'geojson', data });
    }
    const below = map.getLayer('wire') ? 'wire' : undefined;
    const L = (spec) => { if (!map.getLayer(spec.id)) map.addLayer(spec, below); };
    L({ id: 'act-roads', type: 'line', source: 'act-roads', paint: { 'line-color': '#b8c4d0', 'line-width': ['case', ['==', ['get', 'kind'], 'c'], 1, 1.4], 'line-dasharray': [3, 2] } });
    L({ id: 'act-trench', type: 'fill', source: 'act-trench', paint: { 'fill-color': ['case', ['==', ['get', 'fault'], 1], FAULT, ['step', ['get', 'n'], '#ffd23f', 4, '#ff8c1a', 10, '#ff2d55']], 'fill-opacity': fillOpacity } });
    L({ id: 'act-fault', type: 'line', source: 'act-trench', filter: ['==', ['get', 'fault'], 1], paint: { 'line-color': FAULT, 'line-width': 2 } });
    L({ id: 'act-bunds', type: 'line', source: 'act-bunds', paint: { 'line-color': '#ffffff', 'line-width': 2, 'line-dasharray': inst === 'B' ? [2, 2] : [1, 0] } });
    L({ id: 'act-holes', type: 'circle', source: 'act-holes', minzoom: 17, paint: { 'circle-radius': 3, 'circle-color': ['case', ['==', ['get', 'flag'], 1], FAULT, '#39e0ff'], 'circle-stroke-color': '#001', 'circle-stroke-width': 1 } });
    L({ id: 'act-cross', type: 'circle', source: 'act-cross', minzoom: 16.5, paint: { 'circle-radius': 3.5, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': '#7fffd4', 'circle-stroke-width': 2 } });
    L({ id: 'act-bends', type: 'circle', source: 'act-bends', paint: { 'circle-radius': 3, 'circle-color': FAULT } });
    if (map.getLayer('act-bunds')) map.setPaintProperty('act-bunds', 'line-dasharray', inst === 'B' ? [2, 2] : [1, 0]);
    labelView();
  }
  const PLAN_IDS = ['act-bends', 'act-cross', 'act-holes', 'act-bunds', 'act-fault', 'act-trench', 'act-roads'];
  function removePlan(map) { clearMarks(); for (const id of PLAN_IDS) if (map.getLayer(id)) map.removeLayer(id); for (const id of ['act-trench', 'act-bunds', 'act-holes', 'act-roads', 'act-cross', 'act-bends']) if (map.getSource(id)) map.removeSource(id); }
  function clearMarks() { for (const m of marks) { try { m.remove(); } catch (e) { /* gone */ } } marks = []; }
  // labels as DOM markers (the satellite style has no glyphs); guarded so a failed marker never stops the plan or the looker
  function labelView() {
    clearMarks(); const map = window.SIM.map; if (!doc || !on || map.getZoom() < 17) return;
    try {
      const bb = map.getBounds(), ev = evaluate(doc, inst, sides), mk = (txt, at, css) => {
        const el = document.createElement('div'); el.className = 'act-label';
        el.style.cssText = 'font:11px sans-serif;color:#fff;background:rgba(0,0,0,.6);padding:1px 4px;border-radius:3px;white-space:nowrap;pointer-events:none;' + (css || '');
        el.textContent = txt; try { marks.push(new maplibregl.Marker({ element: el }).setLngLat(at).addTo(map)); } catch (e) { /* projection or DEM not ready */ }
      };
      const unit = unitOf;
      const segs = ev.E.filter(e => e.kind === 'c' && e.len >= 8).map(e => { const k = Math.floor(e.V.length / 2), a = e.V[Math.max(0, k - 1)], b = e.V[k]; return { e, at: ll((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) }; })
        .filter(x => bb.contains(x.at)).sort((x, y) => y.e.n - x.e.n || y.e.len - x.e.len).slice(0, 40);
      for (const { e, at } of segs) mk(`${e.n} ${unit(e.n)}${e.L > 1 ? ' in ' + e.L + ' layers' : ''} ${e.w.toFixed(2)} m${e.fault ? ' FLAG' : ''}`, at, e.fault ? 'background:' + FAULT : '');
      if (map.getZoom() >= 19) for (const h of holesOf(doc, ev.c)) { const at = ll(h.en[0] + h.out[0] * 0.8, h.en[1] + h.out[1] * 0.8); if (bb.contains(at)) mk(`${h.side}${h.i}`, at, 'font-size:9px;background:rgba(0,60,120,.8)'); }
      for (const B of doc.bunds) { const at = ll(...B.walls[0].p0); if (bb.contains(at)) mk(`${B.id} ${inst === 'A' ? 'bund' : 'piled station'}: ${B.units_to_draw === 2 ? 'two units seen' : B.units_label}`, at, 'background:rgba(40,40,40,.8)'); }
    } catch (e) { /* labels are optional */ }
  }

  // ---- own wire layer (anchor Mercator point in the matrix, depth test OFF so buried geometry shows as an X-ray) ----
  const wires = [];
  const actWire = {
    id: 'act-wire', type: 'custom', renderingMode: '3d',
    onAdd(m, gl) {
      const vs = 'uniform mat4 u; attribute vec3 p; void main(){ gl_Position = u * vec4(p, 1.0); }', fs = 'precision mediump float; uniform vec4 c; void main(){ gl_FragColor = c; }';
      const sh = (t, src) => { const o = gl.createShader(t); gl.shaderSource(o, src); gl.compileShader(o); return o; };
      this.pr = gl.createProgram(); gl.attachShader(this.pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(this.pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(this.pr); this.buf = gl.createBuffer();
    },
    render(gl, args) {
      const m = args.defaultProjectionData?.mainMatrix || args, map = window.SIM.map, PF = window.SIM.PF || window.__pf.PF;
      gl.useProgram(this.pr); gl.disable(gl.DEPTH_TEST);
      for (const w of wires) {
        const a = w.anchor; let gz = 0; try { gz = (map.queryTerrainElevation && map.queryTerrainElevation([a.lon, a.lat])) || 0; } catch (e) { gz = 0; } const o = PF.toMercator(a.lat, a.lon, gz);
        const r = Array.from(m); for (let k = 0; k < 4; k++) r[12 + k] = m[k] * o.x + m[4 + k] * o.y + m[8 + k] * o.z + m[12 + k];
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buf); gl.bufferData(gl.ARRAY_BUFFER, w.buf, gl.DYNAMIC_DRAW);
        const loc = gl.getAttribLocation(this.pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
        gl.uniformMatrix4fv(gl.getUniformLocation(this.pr, 'u'), false, new Float32Array(r)); gl.uniform4fv(gl.getUniformLocation(this.pr, 'c'), w.color);
        gl.drawArrays(gl.LINES, 0, w.buf.length / 3);
      }
    }
  };
  function ensureWire(map) { if (on && !map.getLayer('act-wire')) map.addLayer(actWire); }

  // ---- section maths: duct / cable positions across a trench (x from the centre line, z below ground < 0) ----
  const FLOOR = 0.9, BED = 0.05;
  function sectionOf(pp, n, L = 1) {
    const k = Math.ceil(n / L), W = width(pp, n, L), items = [];
    for (let g = 0; g < n; g++) {
      const j = Math.floor(g / k), i = g % k;
      if (pp.which === 'A') {
        const D = pp.unitW, x = -W / 2 + MARGIN + D / 2 + i * (D + GAP), z = -FLOOR + BED + D / 2 + j * (D + GAP), Di = pp.duct.id_mm / 1000, d = pp.od;
        const a = Di / 2 - d / 2, y = (d * d - 2 * a * a) / (2 * a), sx = Math.sqrt(Math.max(0, a * a - y * y));   // cradled: bottom + two on the wall
        items.push({ kind: 'duct', x, z, r: D / 2, ri: Di / 2, cables: [[x, z - a], [x - sx, z + y], [x + sx, z + y]], cr: d / 2 });
      } else {
        const d = pp.od; for (let c = 0; c < 3; c++) { const x = -W / 2 + MARGIN + d / 2 + (3 * i + c) * 2 * d, z = -FLOOR + BED + d / 2 + j * (d + 0.1); items.push({ kind: 'cable', x, z, r: d / 2 }); }
      }
    }
    return { W, items };
  }
  function sectionSVG(pp, n, L = 1) {
    const S = sectionOf(pp, n, L), mm = v => +(v * 1000).toFixed(1), fs = Math.max(30, Math.round((mm(S.W) + 600) / 40)), y0 = fs * 2, x0 = -mm(S.W) / 2 - 150, vw = mm(S.W) + 150 + fs * 13, vh = y0 + mm(FLOOR) + fs * 3;
    const o = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0} 0 ${vw} ${vh}" data-width-m="${S.W.toFixed(3)}" style="background:#101418;width:100%">`];
    o.push(`<rect x="${x0}" y="0" width="${vw}" height="${y0}" fill="#1c2a1c"/><line x1="${x0}" y1="${y0}" x2="${x0 + vw}" y2="${y0}" stroke="#9c6" stroke-width="${fs / 6}"/>`);
    o.push(`<rect x="${-mm(S.W) / 2}" y="${y0}" width="${mm(S.W)}" height="${mm(FLOOR)}" fill="#3a2e22" stroke="#e0c090" stroke-width="${fs / 8}"/><rect x="${-mm(S.W) / 2}" y="${y0 + mm(FLOOR - BED)}" width="${mm(S.W)}" height="${mm(BED)}" fill="#8a7a55"/>`);
    for (const it of S.items) {
      if (it.kind === 'duct') {
        o.push(`<circle class="duct" cx="${mm(it.x)}" cy="${y0 - mm(it.z)}" r="${mm(it.r)}" fill="#222" stroke="#ffb81a" stroke-width="4"/>`);
        for (const [cx, cz] of it.cables) o.push(`<circle class="cable" cx="${mm(cx)}" cy="${y0 - mm(cz)}" r="${mm(it.cr)}" fill="#c0c8d0"/>`);
      } else o.push(`<circle class="cable" cx="${mm(it.x)}" cy="${y0 - mm(it.z)}" r="${mm(it.r)}" fill="#c0c8d0" stroke="#333" stroke-width="3"/>`);
    }
    if (pp.which === 'B') for (let x = -S.W / 2 + 0.2; x < S.W / 2; x += 1.0) o.push(`<rect class="spacer" x="${mm(x)}" y="${y0 + mm(FLOOR - BED) - mm(pp.od) - 20}" width="60" height="${mm(pp.od) + 20}" fill="#a0703a" opacity=".8"/>`);
    const sb = S.W > 3 ? 1.0 : 0.5, fl = y0 + mm(FLOOR);
    o.push(`<rect class="scalebar" x="${-mm(S.W) / 2}" y="${fl + fs * 1.1}" width="${mm(sb)}" height="${fs / 3}" fill="#fff"/><text x="${-mm(S.W) / 2 + mm(sb) + fs / 2}" y="${fl + fs * 1.1 + fs / 3}" fill="#fff" font-size="${fs}">${sb} m</text>`);
    o.push(`<text x="${mm(S.W) / 2 + fs / 2}" y="${fl}" fill="#e0c090" font-size="${fs}">floor ${FLOOR} m (assumed)</text></svg>`); return o.join('');
  }

  // ---- 3D at one station: scenario A (bund, holes, ducts) or B (piles, units, flat armoured layer, upsweeps); t animates ----
  const q = (map, lo, la) => { try { const g = map.queryTerrainElevation ? map.queryTerrainElevation([lo, la]) : 0; return g == null || !isFinite(g) ? 0 : g; } catch (e) { return 0; } };
  function partial(V, f) {   // leading fraction f of polyline V (by length)
    if (f >= 1) return V; if (f <= 0) return [V[0]];
    let tot = 0; const L = []; for (let k = 1; k < V.length; k++) { const l = Math.hypot(V[k][0] - V[k - 1][0], V[k][1] - V[k - 1][1]); L.push(l); tot += l; }
    let rem = tot * f; const out = [V[0]];
    for (let k = 1; k < V.length; k++) { if (rem >= L[k - 1]) { out.push(V[k]); rem -= L[k - 1]; } else { const t = rem / L[k - 1]; out.push([V[k - 1][0] + (V[k][0] - V[k - 1][0]) * t, V[k - 1][1] + (V[k][1] - V[k - 1][1]) * t]); break; } }
    return out;
  }
  const ph = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));
  function station3D(S, PF, si, t) {
    const map = S.map, B = doc.bunds[si], ev = evaluate(doc, inst, sides), pp = ev.pp, an = PF.placeKey(B.centre[1], B.centre[0]), g0 = q(map, an.lon, an.lat);
    const loc = (e, n) => { const g = ll(e, n), p = PF.toLocal(an, g[1], g[0], 0); return [p.x, p.y, q(map, g[0], g[1]) - g0]; };
    const Lb = [], Lt = [], Ld = [], Lc = [], Lp = [], Lf = [];   // bund/station (white), trench cut (cyan), ducts (amber), cables (silver), piles (green), flags (magenta)
    const seg = (arr, a, b) => arr.push([a[0], a[1], a[2], b[0], b[1], b[2]]);
    const line = (arr, V, z) => { for (let k = 1; k < V.length; k++) { const a = loc(...V[k - 1]), b = loc(...V[k]); seg(arr, [a[0], a[1], a[2] + z], [b[0], b[1], b[2] + z]); } };
    const tA = inst === 'A' ? { dig: [0, 0.3], lay: [0.3, 0.6], pull: [0.6, 1] } : { dig: [0, 0.25], lay: [0.25, 0.5], pile: [0.5, 0.75], set: [0.75, 1] };
    const edges = ev.E.filter(e => e.si === si);
    // trench cut: edge lines at ground and floor, growing outward from the station (dig phase)
    const fd = ph(t, ...tA.dig);
    for (const e of edges) {
      const V = e.V.slice().reverse(), Vp = partial(V, fd);
      for (let k = 1; k < Vp.length; k++) {
        const a = Vp[k - 1], b = Vp[k], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy); if (l < 1e-3) continue;
        const ox = -dy / l * e.w / 2, oy = dx / l * e.w / 2;
        for (const s of [1, -1]) { line(Lt, [[a[0] + s * ox, a[1] + s * oy], [b[0] + s * ox, b[1] + s * oy]], 0); line(Lt, [[a[0] + s * ox, a[1] + s * oy], [b[0] + s * ox, b[1] + s * oy]], -FLOOR); }
      }
    }
    // ducts / cables along every route of this station (routes rebuilt from the edges they use are not stored: draw per edge, n lines across)
    const fl = ph(t, ...tA.lay), fp = inst === 'A' ? ph(t, ...tA.pull) : fl;
    for (const e of edges) {
      const sec = sectionOf(pp, e.n, e.L), V = e.V;
      for (const it of sec.items) {
        const off = it.x, z = it.z;
        const Vo = V.map((p, k) => { const a = V[Math.max(0, k - 1)], b = V[Math.min(V.length - 1, k + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [p[0] - dy / l * off, p[1] + dx / l * off]; });
        if (inst === 'A') { line(Ld, partial(Vo, fl), z); if (fp > 0) line(Lc, partial(Vo, fp), z); }
        else line(Lc, partial(Vo, fl), z);
      }
    }
    if (inst === 'A') {
      // concrete bund: wall top +0.5 m, footing -0.6 m (assumed); holes as 160 mm rings at 0.8 m invert (assumed) where ducts enter
      const bd = doc.installations.A.bund, hole = doc.installations.A.holes;
      for (const w of B.walls) { const a = loc(...w.p0), b = loc(...w.p1); for (const z of [bd.wall_above_m, 0, -bd.footing_m]) seg(Lb, [a[0], a[1], a[2] + z], [b[0], b[1], b[2] + z]); seg(Lb, [a[0], a[1], a[2] - bd.footing_m], [a[0], a[1], a[2] + bd.wall_above_m]); }
      for (const h of holesOf(doc, ev.c).filter(h => h.si === si)) {
        const c = loc(...h.en), tx = -h.out[1], ty = h.out[0], r = hole.diameter_mm / 2000, zc = c[2] - hole.invert_m + r;
        for (let k = 0; k < 12; k++) { const a1 = k / 12 * 2 * Math.PI, a2 = (k + 1) / 12 * 2 * Math.PI; (h.clear != null && h.clear < pp.Ls + pp.R ? Lf : Lb).push([c[0] + tx * r * Math.cos(a1), c[1] + ty * r * Math.cos(a1), zc + r * Math.sin(a1), c[0] + tx * r * Math.cos(a2), c[1] + ty * r * Math.cos(a2), zc + r * Math.sin(a2)]); }
      }
      if (B.units_to_draw === 2) unitBoxes(B, loc, Lb, 0);
    } else {
      // piled station: footprint dashed at ground, screw piles (assumed) screwed in, units set on the pile caps (only where seen)
      const pl = doc.installations.B.piles, fpile = ph(t, ...tA.pile), fset = ph(t, ...tA.set);
      for (const w of B.walls) { const a = loc(...w.p0), b = loc(...w.p1); for (let k = 0; k < 10; k += 2) { const u0 = k / 10, u1 = (k + 1) / 10; seg(Lb, [a[0] + (b[0] - a[0]) * u0, a[1] + (b[1] - a[1]) * u0, a[2]], [a[0] + (b[0] - a[0]) * u1, a[1] + (b[1] - a[1]) * u1, a[2]]); } }
      for (const p of pilesOf(B, pl)) {
        const c = loc(...p), drop = (1 - fpile) * 3.0, top = pl.cap_above_ground_m + drop, bot = top - pl.shaft_m - pl.cap_above_ground_m;
        seg(Lp, [c[0], c[1], c[2] + bot], [c[0], c[1], c[2] + top]);
        const rot = fpile * 6 * Math.PI, hr = pl.helix_d_m / 2;   // helix near the toe, turning as it goes in
        for (let k = 0; k < 16; k++) { const a1 = rot + k / 16 * 2 * Math.PI, a2 = rot + (k + 1) / 16 * 2 * Math.PI; seg(Lp, [c[0] + hr * Math.cos(a1), c[1] + hr * Math.sin(a1), c[2] + bot + 0.3 + 0.1 * k / 16], [c[0] + hr * Math.cos(a2), c[1] + hr * Math.sin(a2), c[2] + bot + 0.3 + 0.1 * (k + 1) / 16]); }
      }
      if (B.units_to_draw === 2 && fset > 0) unitBoxes(B, loc, Lb, pl.cap_above_ground_m + (1 - fset) * 5);
      // upsweeps: at each port, the cables rise at the MBR into a bottom-entry gland plate under the station (after lay)
      if (fl >= 1) for (const h of holesOf(doc, ev.c).filter(h => h.si === si)) {
        const c = loc(...h.en), R = pp.R, z0 = c[2] - FLOOR + BED + pp.od / 2, ox = -h.out[0], oy = -h.out[1];
        for (let k = 0; k < 8; k++) { const a1 = k / 8 * Math.PI / 2, a2 = (k + 1) / 8 * Math.PI / 2; seg(Lc, [c[0] + ox * R * Math.sin(a1), c[1] + oy * R * Math.sin(a1), z0 + R * (1 - Math.cos(a1))], [c[0] + ox * R * Math.sin(a2), c[1] + oy * R * Math.sin(a2), z0 + R * (1 - Math.cos(a2))]); }
        seg(Lc, [c[0] + ox * R, c[1] + oy * R, z0 + R], [c[0] + ox * R, c[1] + oy * R, c[2] + doc.installations.B.piles.cap_above_ground_m]);
      }
    }
    wires.length = 0;
    wires.push({ anchor: an, buf: PF.wireBuffer(an, Lb), color: [0.95, 0.97, 1.0, 1.0], n: Lb.length, kind: 'station' });
    wires.push({ anchor: an, buf: PF.wireBuffer(an, Ld), color: [1.0, 0.72, 0.1, 1.0], n: Ld.length, kind: 'ducts' });
    wires.push({ anchor: an, buf: PF.wireBuffer(an, Lc), color: [0.75, 0.8, 0.86, 1.0], n: Lc.length, kind: 'cables' });
    wires.push({ anchor: an, buf: PF.wireBuffer(an, Lt), color: [0.5, 0.91, 1.0, 1.0], n: Lt.length, kind: 'trench' });
    wires.push({ anchor: an, buf: PF.wireBuffer(an, Lp), color: [0.35, 1.0, 0.45, 1.0], n: Lp.length, kind: 'piles' });
    wires.push({ anchor: an, buf: PF.wireBuffer(an, Lf), color: [1.0, 0.17, 0.84, 1.0], n: Lf.length, kind: 'flags' });
    S.repaint(); return { station: Lb.length, trench: Lt.length, ducts: Ld.length, cables: Lc.length, piles: Lp.length, flags: Lf.length };
  }
  const ll2en = (c, d = doc) => [(c[0] - d.frame.lon0) * d.frame.KX, (c[1] - d.frame.lat0) * d.frame.KY];
  function unitBoxes(B, loc, arr, lift) {   // two 6.1 x 2.9 x 3.0 m units (documented size; placing estimated), long axis along the bund
    const w0 = B.walls[0], ux = (w0.p1[0] - w0.p0[0]) / w0.len, uy = (w0.p1[1] - w0.p0[1]) / w0.len, c = ll2en(B.centre), long = w0.len >= B.walls[1].len;
    const ax = long ? [ux, uy] : [-uy, ux], ay = [-ax[1], ax[0]], off = Math.max(w0.len, B.walls[1].len) / 4;
    for (const s of [-1, 1]) {
      const cx = c[0] + ax[0] * off * s, cy = c[1] + ax[1] * off * s, Pq = [[-3.05, -1.45], [3.05, -1.45], [3.05, 1.45], [-3.05, 1.45]].map(([i, j]) => loc(cx + ax[0] * i + ay[0] * j, cy + ax[1] * i + ay[1] * j));
      for (let k = 0; k < 4; k++) { const p = Pq[k], r = Pq[(k + 1) % 4]; arr.push([p[0], p[1], p[2] + lift, r[0], r[1], r[2] + lift], [p[0], p[1], p[2] + lift + 3, r[0], r[1], r[2] + lift + 3], [p[0], p[1], p[2] + lift, p[0], p[1], p[2] + lift + 3]); }
    }
  }
  function pilesOf(B, pl, d = doc) {   // 3 x 2 per unit (assumed), under the two unit positions
    const w0 = B.walls[0], ux = (w0.p1[0] - w0.p0[0]) / w0.len, uy = (w0.p1[1] - w0.p0[1]) / w0.len, c = ll2en(B.centre, d), long = w0.len >= B.walls[1].len;
    const ax = long ? [ux, uy] : [-uy, ux], ay = [-ax[1], ax[0]], off = Math.max(w0.len, B.walls[1].len) / 4, out = [];
    for (const s of [-1, 1]) for (const i of [-1, 0, 1]) for (const j of [-0.5, 0.5]) out.push([c[0] + ax[0] * (off * s + i * pl.spacing_m[0]) + ay[0] * j * pl.spacing_m[1], c[1] + ax[1] * (off * s + i * pl.spacing_m[0]) + ay[1] * j * pl.spacing_m[1]]);
    return out;
  }

  // ---- animation of the two scenarios at the focused station ----
  function animate(which) {
    const S = window.SIM, PF = S.PF || (window.__pf && window.__pf.PF); if (!doc) return;
    if (which && which !== inst) { inst = which; redraw(); }
    const si = focusIdx(), B = doc.bunds[si]; S.map.jumpTo({ center: B.centre, zoom: 19.2, pitch: 62, bearing: 25 });
    if (anim) cancelAnimationFrame(anim.raf);
    const t0 = performance.now(), dur = 14000, names = inst === 'A' ? ['dig from the sides', 'lay the ducts', 'pull the cables in through the holes'] : ['dig', 'lay armoured direct (flat, spaced)', 'screw the piles in', 'set the station'];
    const step = now => {
      const t = Math.min(1, (now - t0) / dur), k = inst === 'A' ? (t < 0.3 ? 0 : t < 0.6 ? 1 : 2) : (t < 0.25 ? 0 : t < 0.5 ? 1 : t < 0.75 ? 2 : 3);
      try { station3D(S, PF, si, t); } catch (e) { /* DEM not ready */ }
      anim.t = t; setCaption(`Scenario ${inst} at ${B.id} (illustrative): ${names[k]} (${Math.round(t * 100)} %)`);
      if (t < 1) anim.raf = requestAnimationFrame(step); else { anim.done = true; setCaption(`Scenario ${inst} at ${B.id} (illustrative): complete. ${inst === 'A' ? 'Ducts end at the pre-drilled holes after a straight entry.' : 'Cables rise at their bend radius into bottom-entry gland plates; piles and units are assumed geometry.'}`); }
    };
    anim = { t: 0, done: false, raf: requestAnimationFrame(step), si };
  }
  let cap = null;
  function setCaption(t) { if (!cap) { cap = document.createElement('div'); cap.id = 'act-caption'; cap.style.cssText = 'position:absolute;left:50%;transform:translateX(-50%);top:58px;z-index:7;background:rgba(0,0,0,.75);color:#fff;font:13px sans-serif;padding:4px 10px;border-radius:4px;max-width:90vw'; document.body.appendChild(cap); } cap.textContent = t; cap.style.display = t ? 'block' : 'none'; }
  const focusIdx = () => { const ev = evaluate(doc, inst, sides); if (focus != null) return focus; return ev.widest.si >= 0 ? ev.widest.si : 0; };

  // ---- step in: eye height in the widest approach of the focused case ----
  function stepIn() {
    const S = window.SIM, map = S.map, W = caseOf(doc, inst, sides).widest, V = W.V, k = Math.floor(V.length / 2), a = V[Math.max(0, k - 1)], b = V[k];
    const p = ll((a[0] + b[0]) / 2, (a[1] + b[1]) / 2), B = doc.bunds[W.si], lon = p[0], lat = p[1];
    fillOpacity = 0.25; if (map.getLayer('act-trench')) map.setPaintProperty('act-trench', 'fill-opacity', fillOpacity);
    focus = W.si; try { station3D(S, S.PF || window.__pf.PF, W.si, 1); } catch (e) { /* DEM */ }
    const yaw = Math.atan2((B.centre[0] - lon) * doc.frame.KX, (B.centre[1] - lat) * doc.frame.KY) * 180 / Math.PI;
    if (window.walkFps) { map.jumpTo({ center: [lon, lat], zoom: 19, bearing: yaw, pitch: 80 }); try { window.walkFps.enter(); window.walkFps.set({ lon, lat, yaw, pitch: 78 }); } catch (e) { /* walk-fps not ready */ } }
    else map.jumpTo({ center: [lon, lat], zoom: 20.5, bearing: yaw, pitch: 78 });
    showSection(); info(`Stepped in: eye ${EYE} m in the widest approach, ${B.id}: ${W.n} ${unitOf(W.n)}.`);
  }
  let secBox = null;
  function showSection() {
    if (!doc) return; const ev = evaluate(doc, inst, sides), W = caseOf(doc, inst, sides).widest, pp = ev.pp, L = layersFor(pp, W.n, 99).L;
    if (!secBox) { secBox = document.createElement('div'); secBox.id = 'act-section'; secBox.style.cssText = 'position:absolute;left:8px;right:8px;bottom:34px;z-index:7;background:#101418;border:1px solid #456;border-radius:6px;padding:6px;max-height:55vh;overflow:auto;color:#dfe;font:12px sans-serif'; document.body.appendChild(secBox); }
    const head = pp.which === 'A' ? `${W.n} ducts ${pp.duct ? pp.duct.od_mm + '/' + pp.duct.id_mm + ' mm' : '(no duct passes)'}, each 3 x ${P.A.od} mm cables (${pp.dcheck ? pp.dcheck.config : ''})` : `${W.n} circuits = ${3 * W.n} armoured ${P.B.od} mm cables, flat, one diameter clear, timber spacers`;
    secBox.innerHTML = `<div style="display:flex;justify-content:space-between"><b>End-on section at true scale, MODEL, widest approach (${doc.bunds[W.si].id}): ${head}; ${width(pp, W.n, L).toFixed(3)} m wide. Floor 0.9 m and bed 50 mm assumed${L > 1 ? '; with ' + L + ' layers the floor is kept at 0.9 m (assumed; the extra depth of stacked layers is not modelled)' : ''}. Derating NOT assessed.</b><button id="act-sec-x">close</button></div>${sectionSVG(pp, W.n, L)}`;
    secBox.style.display = 'block'; secBox.querySelector('#act-sec-x').onclick = () => { secBox.style.display = 'none'; };
  }
  function table() {
    if (!doc) return; const ev = evaluate(doc, inst, sides), c = ev.c;
    const rx = s => { const f = (m, n) => `${m} m (${n})`, bad = s.rows_crossed || s.rows_crossed_entry; return `<td${bad ? ' style="background:' + FAULT + '"' : ''}>${f(s.rows_crossed_m, s.rows_crossed)} / ${f(s.rows_crossed_entry_m, s.rows_crossed_entry)}</td>`; };
    const rows = c.stations.map(s => `<tr><td>${s.id}</td><td>${doc.bunds[s.si].cls}</td><td>${Object.entries(s.sides).map(([k, v]) => k + v).join(' ')}</td><td>${s.trench_km}</td><td>${s.widest_n} / ${s.widest_w} m${s.widest_L > 1 ? ' (' + s.widest_L + ' layers)' : ''}</td><td>${ev.bendBy[s.si] || 0}</td><td>${ev.entryBy[s.si] || 0}</td>${rx(s)}<td>${(s.seam_img_runs || []).length}</td><td${(s.panel_runs || []).length || (s.dark_runs || []).length ? ' style="background:' + FAULT + '"' : ''}>${(s.panel_runs || []).length} / ${(s.dark_runs || []).length}</td><td>${s.env_rows_m2}</td><td>${s.d_track_med}</td><td>${s.row_clear_med}</td><td>${s.road_crossings} / ${s.true_crossings}</td><td>${s.routes}${s.unreachable ? ' (' + s.unreachable + ' unreached)' : ''}</td></tr>`).join('');
    const T = c.totals, tot = `<tr style="font-weight:bold"><td>all</td><td></td><td></td><td>${T.trench_km}</td><td>${T.widest.station}: ${T.widest.n} / ${T.widest.w} m</td><td>${ev.bendFlags.length}</td><td>${ev.entryFlags}</td>${rx(T)}<td>${T.seam_img_runs}</td><td>${T.panel_runs || 0} (${T.panel_m || 0} m) / ${T.dark_runs || 0} (${T.dark_m || 0} m)</td><td>${T.env_rows_m2}</td><td></td><td></td><td>${T.road_crossings} / ${T.true_crossings}</td><td>${T.routes}${T.unreachable ? ' (' + T.unreachable + ' unreached)' : ''}</td></tr>`;
    showBox(`<b>Per station, ${inst}${sides} (live bend flags at R = ${ev.pp.R.toFixed(3)} m; the rest computed at the default radius)</b><table style="border-collapse:collapse;font:11px monospace" border="1"><tr><th>st</th><th>class</th><th>holes per side</th><th>trench km</th><th>widest</th><th>bend flags</th><th>entry flags</th><th>rows crossed: chains / entry legs (m, count; closed table mask)</th><th>chain runs &gt;= 1.5 m inside visible panel</th><th>chain runs on unmasked ground: panel-coloured &gt;= 2 m / dark non-green &gt; 1 m</th><th>envelope over rows m2</th><th>to track m (median)</th><th>clear of rows m (median)</th><th>track contacts / true crossings</th><th>routes</th></tr>${rows}${tot}</table><div style="font:11px sans-serif;max-width:900px">Rows crossed: runs over 1 m of centreline inside the closed table mask (rows, table-end blobs and the seams between them); shorter runs are corner clips of the 0.5 m raster. Unmasked ground: imagery cells outside the table mask and off the carved breaks that are panel-coloured (dark, blue-leaning) or dark and not green; the runs are listed per station in the data file and drawn in the fault colour. Track contacts: places where a chain meets the track mask (crossings or edge grazes; the track mask is good to +/-2-6 m). True crossings: the chain enters and leaves on opposite sides of the track line; crossings are ducted.</div>`); box.dataset.kind = 'table';
  }
  let box = null;
  function showBox(html) { if (!box) { box = document.createElement('div'); box.id = 'act-box'; box.style.cssText = 'position:absolute;left:8px;top:120px;z-index:8;background:rgba(10,14,18,.95);color:#dfe;padding:6px;border:1px solid #456;border-radius:6px;max-height:70vh;max-width:96vw;overflow:auto;font:12px sans-serif'; document.body.appendChild(box); } box.dataset.kind = ''; box.innerHTML = '<button id="act-box-x" style="float:right">close</button>' + html; box.style.display = 'block'; box.querySelector('#act-box-x').onclick = () => { box.style.display = 'none'; }; }

  const unitOf = n => inst === 'A' ? (n === 1 ? 'duct' : 'ducts') : (n === 1 ? 'circuit' : 'circuits');
  function rowsLine(T) {   // shown whenever it is not 0 (closed table mask: rows, table-end blobs and the seams between them)
    const a = [];
    if (T.rows_crossed) a.push(`${T.rows_crossed} trench chains (${T.rows_crossed_m} m) at ${T.rows_crossed_stations} stations`);
    if (T.rows_crossed_entry) a.push(`${T.rows_crossed_entry} entry legs (${T.rows_crossed_entry_m} m) at ${T.entry_crossed_stations} stations`);
    if (T.seam_img_runs) a.push(`${T.seam_img_runs} chain runs (${T.seam_img_m} m) 1.5 m or more inside visible panel`);
    const b = [];   // fix round 2: chain runs on imagery that looks like panel but is not in the table mask (not proven clear)
    if (T.panel_runs) b.push(`${T.panel_runs} chain runs of 2 m or more (${T.panel_m} m) on unmasked panel-coloured ground at ${T.panel_stations} stations`);
    if (T.dark_runs) b.push(`${T.dark_runs} chain runs over 1 m (${T.dark_m} m) on unmasked dark non-green ground at ${T.dark_stations} stations`);
    return (a.length ? `ROWS CROSSED: ${a.join('; ')} (magenta). ` : 'Rows crossed: 0 (closed table mask). ') +
      (b.length ? `NOT PROVEN CLEAR: ${b.join('; ')} (magenta). ` : 'Chain runs on unmasked panel-coloured or dark ground: 0. ');
  }
  function info(extra) {
    if (!doc) return; const ev = evaluate(doc, inst, sides), pp = ev.pp, I = doc.installations[inst], T = ev.c.totals;
    const hole = doc.installations.A.holes.diameter_mm, holeFlag = inst === 'A' && pp.duct ? (pp.duct.od_mm > hole ? `FLAG: duct OD ${pp.duct.od_mm} mm exceeds the assumed ${hole} mm hole. ` : pp.duct.od_mm === hole ? `FLAG: duct OD ${pp.duct.od_mm} mm equals the assumed ${hole} mm hole (no clearance). ` : '') : '';
    const duct = inst === 'A' ? (pp.duct ? `Duct ${pp.duct.od_mm}/${pp.duct.id_mm} mm (${pp.drule}; J ${pp.dcheck.J.toFixed(2)} ${pp.dcheck.band}, fill ${(pp.dcheck.fill * 100).toFixed(1)} %, clearance ${pp.dcheck.cl.toFixed(1)} mm, ${pp.dcheck.config}). ` : 'NO duct in the table passes at this OD. ') + holeFlag : '';
    window.SIM.info(`REPD 6502 AC trenches, MODEL (illustrative scenarios on this test ground; not a design, not a survey). ${I.scenario}. Entry through ${sides} side${sides === '1' ? '' : 's'}. ` +
      `Cable OD ${P[inst].od} mm, MBR ${P[inst].mbr} mm (${inst === 'A' ? 'assumed' : 'catalogue'}). ${duct}Governing bend ${pp.R.toFixed(3)} m (${pp.governs})${pp.mbrFlag ? ' FLAG: cable MBR larger than the duct bend' : ''}. ` +
      `Trench ${ev.km.toFixed(2)} km; widest ${ev.widest.n} ${unitOf(ev.widest.n)} ${ev.widest.w.toFixed(2)} m${ev.widest.L > 1 ? ' in ' + ev.widest.L + ' layers' : ''}; bends tighter than ${pp.R.toFixed(2)} m: ${ev.bendFlags.length}; entries too short: ${ev.entryFlags}; width flags ${ev.faults} (magenta). ` +
      `Routes ${T.routes} (${T.cables} cables). ${rowsLine(T)}Track contacts ${T.road_crossings} (crossings or edge grazes; track mask +/-2-6 m); true crossings ${T.true_crossings}, ducted. Rows, gaps, tracks and stations estimated from Esri imagery (2025-03-29); inverters, holes, piles, sections assumed. Derating NOT assessed. ` + (extra || ''));
  }

  function redraw() {
    const S = window.SIM; let walking = false;
    try { walking = !!(window.walkFps && window.walkFps.state().on); } catch (e) { walking = false; }   // walk-fps can throw before DEM tiles exist
    if (S.map.getLayer('act-trench') && !walking) { fillOpacity = 0.72; S.map.setPaintProperty('act-trench', 'fill-opacity', fillOpacity); }
    addPlan(S.map); ensureWire(S.map);
    if (box && box.style.display === 'block' && box.dataset.kind === 'table') table();   // an open per-station table follows the selected case
    const PF = S.PF || (window.__pf && window.__pf.PF); let n = null;
    try { n = station3D(S, PF, focusIdx(), anim && !anim.done ? anim.t : 1); } catch (e) { info('3D not drawn: ' + e.message); }
    if (!anim || anim.done) setCaption(''); syncPanel(); info(); return n;
  }
  function syncPanel() {
    if (!panel) return;
    for (const b of panel.querySelectorAll('button[data-k]')) b.classList.toggle('on', b.dataset.v === (b.dataset.k === 'i' ? inst : sides));
    const od = panel.querySelector('#act-od'), mbr = panel.querySelector('#act-mbr'), fresh = panel.dataset.inst !== inst; panel.dataset.inst = inst;
    if (od && (fresh || document.activeElement !== od)) od.value = P[inst].od; if (mbr && (fresh || document.activeElement !== mbr)) mbr.value = P[inst].mbr;
    const pp = params(doc, inst), r = panel.querySelector('#act-readout');
    if (r) r.textContent = inst === 'A' ? (pp.duct ? `duct ${pp.duct.od_mm}/${pp.duct.id_mm}, J ${pp.dcheck.J.toFixed(2)} ${pp.dcheck.band}, fill ${(pp.dcheck.fill * 100).toFixed(1)} %, bend ${pp.R.toFixed(2)} m (${pp.governs})` : 'no duct passes') : `bend ${pp.R.toFixed(3)} m (cable MBR)`;
  }
  async function toggle(btn) {
    const S = window.SIM; on = !on; if (btn && btn.classList) btn.classList.toggle('on', on);
    if (!on) { if (anim) cancelAnimationFrame(anim.raf); removePlan(S.map); wires.length = 0; if (S.map.getLayer('act-wire')) S.map.removeLayer('act-wire'); for (const el of [panel, secBox, box, cap]) if (el) el.style.display = 'none'; if (scale) { S.map.removeControl(scale); scale = null; } return; }
    if (!doc) doc = await (await fetch(BASE + 'ac-trenches-6502.json')).json();
    loadPrivate();
    if (!panel) makePanel(); panel.style.display = 'flex';
    if (!scale) { scale = new maplibregl.ScaleControl({ maxWidth: 160, unit: 'metric' }); S.map.addControl(scale, 'bottom-left'); }
    S.map.jumpTo({ center: doc.register_point, zoom: 15.2, pitch: 0, bearing: 0 });
    S.map.once('idle', () => redraw());
    return redraw();
  }
  // PRIVATE layer: only with ?private=1 AND a local server (localhost / 127.0.0.1); the file is never shipped with the page
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  async function loadPrivate() {
    try {
      const qs = new URLSearchParams(location.search), local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
      if (qs.get('private') !== '1' || !local || priv) return;
      const r = await fetch(qs.get('privsrc') || BASE + 'sld-layer.json'); if (!r.ok) return; priv = await r.json();
      const b = document.createElement('button'); b.textContent = 'Private: SLD'; b.id = 'act-priv'; b.onclick = () => showBox(`<b>PRIVATE layer (local only): ${esc(priv.source)}</b><div>${priv.sld.stations_count} stations, ${priv.sld.inverters} inverters; model ${priv.model.bunds_seen} bunds x ${priv.model.per_bund} = ${priv.model.inverters}. ${priv.matching}.</div><table border="1" style="font:11px monospace;border-collapse:collapse"><tr><th>SLD station</th><th>area</th><th>feeder</th><th>inverters</th><th>per bus</th></tr>${priv.sld.stations.map(s => `<tr><td>${s.id}</td><td>${s.area}</td><td>${s.feeder}</td><td>${s.inverters}</td><td>${(s.per_bus || []).join(' / ')}</td></tr>`).join('')}</table>`);
      if (panel) panel.appendChild(b);
    } catch (e) { priv = null; }
  }
  function makePanel() {
    panel = document.createElement('div'); panel.id = 'act-panel';
    panel.style.cssText = 'position:absolute;right:8px;top:150px;z-index:6;display:flex;flex-wrap:wrap;gap:4px;align-items:center;max-width:330px;background:rgba(0,0,0,.78);padding:6px;border-radius:6px;font:12px sans-serif;color:#dfe';
    const add = (label, k, v, title) => { const b = document.createElement('button'); b.textContent = label; b.dataset.k = k; b.dataset.v = v; b.title = title || ''; b.onclick = () => { if (k === 'i') inst = v; else sides = v; redraw(); }; panel.appendChild(b); };
    panel.append('Installation'); add('A duct', 'i', 'A', doc.installations.A.label); add('B armoured', 'i', 'B', doc.installations.B.label);
    panel.append('Sides'); for (const v of ['1', '2', '3', '4']) add(v, 's', v, 'ducts or circuits enter through ' + v + ' side(s); holes per side = count assigned');
    const inp = (id, label, title) => { const l = document.createElement('label'); l.textContent = label; l.title = title; const x = document.createElement('input'); x.id = id; x.type = 'number'; x.step = '0.1'; x.style.width = '62px'; l.appendChild(x); panel.appendChild(l); return x; };
    const od = inp('act-od', 'OD mm ', 'cable overall diameter, per installation (A assumed 29.7-33.5; B catalogue 37.40)'), mbr = inp('act-mbr', 'MBR mm ', 'cable minimum bend radius, per installation (A assumed 15 x OD; B catalogue 449); up to 6000 mm');
    const upd = () => { const a = +od.value, b = +mbr.value; if (a > 5 && a < 120) P[inst].od = a; if (b > 50 && b <= 6000) P[inst].mbr = b; redraw(); };
    od.onchange = upd; mbr.onchange = upd; od.oninput = upd; mbr.oninput = upd;
    const ro = document.createElement('div'); ro.id = 'act-readout'; ro.style.cssText = 'flex-basis:100%;font:11px monospace;color:#9fe'; panel.appendChild(ro);
    const sel = document.createElement('select'); sel.id = 'act-station'; sel.innerHTML = '<option value="">widest</option>' + doc.bunds.map((B, i) => `<option value="${i}">${B.id} (${B.cls})</option>`).join(''); sel.onchange = () => { focus = sel.value === '' ? null : +sel.value; const B = doc.bunds[focusIdx()]; window.SIM.map.jumpTo({ center: B.centre, zoom: 18.6 }); redraw(); }; panel.appendChild(sel);
    const btn = (label, id, fn) => { const b = document.createElement('button'); b.textContent = label; b.id = id; b.onclick = fn; panel.appendChild(b); };
    btn('Animate A', 'act-anim-a', () => animate('A')); btn('Animate B', 'act-anim-b', () => animate('B'));
    btn('Step in', 'act-step', stepIn); btn('Section', 'act-sec', showSection); btn('Table', 'act-table', table);
    document.body.appendChild(panel);
  }
  function init() {
    if (!window.SIM || !window.SIM.map) return setTimeout(init, 200);
    const S = window.SIM, b = S.addButton('AC trenches', () => toggle(b)); b.id = 'act-btn';
    S.map.on('style.load', () => setTimeout(() => { addPlan(S.map); ensureWire(S.map); }, 50)); S.map.on('moveend', labelView);
    window.__acTrenches = { rowsLine, jamBand, clearance, ductCheck, pickDuct, params, width, layersFor, evaluate, planGeo, holesOf, sectionOf, sectionSVG, partial, pilesOf,
      toggle: () => toggle(b), select: (i, s) => { if (i) inst = i; if (s) sides = String(s); return redraw(); }, set: (i, od, mbr) => { if (od) P[i].od = od; if (mbr) P[i].mbr = mbr; return redraw(); },
      animate, stepIn, showSection, table, focus: i => { focus = i; return redraw(); },
      state: () => ({ on, inst, sides, loaded: !!doc, priv: !!priv, P: JSON.parse(JSON.stringify(P)), anim: anim ? { t: anim.t, done: anim.done, si: anim.si } : null, wires: wires.map(w => ({ kind: w.kind, n: w.n })) }), doc: () => doc };
  }
  init();
})();
