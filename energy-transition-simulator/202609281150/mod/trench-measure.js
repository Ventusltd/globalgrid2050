// trench-measure: the connect-here cable route drawn as a real trench at TRUE SCALE, below the ground, with its
// cables or ducts in their formation, the protection tile, and a cross-section panel (the X-ray). Every dimension
// is typed or cited, never invented:
//   - cited: a section of the engine's own catalogue (engine/data/trench-sections.json, each with its status and
//     its source clause keyed in that file); "trench auto" picks the section for the route's voltage and circuit
//     count from connect-here, at FARMLAND cover 0.91 m by default (land class assumed and labelled; "trench auto
//     other" for other land). Catalogue status "typical" is shown as "estimated";
//   - typed: "trench w 0.65 d 1.28 cover 0.9 od 160mm" (metres, or mm with the unit).
// The CONSISTENCY check ("trench consistency" or "trench check", window.__trench.consistency()) reads the geometry
// BACK from the Float32 buffers the GPU
// draws (decoded through the page's place frame) and compares width, depth, cover, phase and circuit spacing with
// the typed or cited values: every one must match within 1 cm. A second, independent path measures the width
// through OSTN15 National Grid coordinates (corrected by the Transverse Mercator scale factor).
// Ground: each rib sits on the map's terrain (AWS open DEM, ESTIMATED, metre-level); the trench is dug from that
// ground, so depth and cover are exact relative to it, while the ground height itself is only estimated.
// Plain script. Uses window.SIM { map, blocks, addBlock, removeWhere, repaint, info, addButton } and the page's
// place frame (window.__pf.PF). Reads the connect-here route from its drawn blocks (the middle phase line), and
// never edits connect-here. Illustrative early design, not a construction drawing.
(function () {
  'use strict';
  const HERE = document.currentScript && document.currentScript.src ? document.currentScript.src : location.href;
  const SECTIONS = new URL('engine/data/trench-sections.json', HERE).href;
  const TOL = 0.01;                 // 1 cm: the lane's acceptance tolerance
  const RIB = 10;                   // a cross-section rib every 10 m of route
  const STEP = 5;                   // ground sampled every 5 m along the route
  const CHUNK = 100;                // one block per <= 100 m of route (float precision and terrain follow)
  const NCIRC = 12;                 // 12-gon cable / duct outlines (one vertex exactly at the top)
  // "trench auto [farmland|other]": the catalogue section by land class, voltage and circuits.
  // Farmland is the default (the connect-here route runs from a farm field); the land class is ASSUMED, not looked up,
  // and is shown on the label. Farmland cover is 0.91 m (S1 Table 5.4.1, good agricultural land), the source the
  // catalogue cites. The catalogue has farmland sections at 33 kV; at 132 kV it has only the 0.90 m section, so auto
  // derives the farmland one from it: cover 0.91 m (cited), depth and tile lowered by the same 0.01 m (derived).
  const AUTO = { farmland: { 33: { 1: '33kv-1-agri', 2: '33kv-2-agri' }, 132: { 1: '132kv-1-dno', 2: '132kv-2' } },
                 other:    { 33: { 1: '33kv-1-dno',  2: '33kv-2' },      132: { 1: '132kv-1-dno', 2: '132kv-2' } } };
  const FARM_COVER = 0.91, FARM_SRC = 'S1 Table 5.4.1 (good agricultural land 0.91 m)';
  const q = new URLSearchParams(location.search);
  const st = { sections: null, spec: null, route: null, connectRef: null, blocks: 0, ribs: [], xray: false, auto: false, last: null };

  const ready = () => window.SIM && window.SIM.map && window.__pf && window.__pf.PF;
  (function wait(n) { if (ready()) init(); else if (n < 400) setTimeout(() => wait(n + 1), 50); })(0);

  function init() {
    const SIM = window.SIM, PF = window.__pf.PF, map = SIM.map;

    // ---------------- sections: cited (catalogue) or typed ----------------
    async function sections() {
      if (st.sections) return st.sections;
      st.sections = (await (await fetch(SECTIONS)).json()).sections || [];
      return st.sections;
    }
    const WIDTH_TAG = src => { const m = /Width (assumed|derived|taken|scaled)/i.exec(src || ''); return !m ? 'assumed' : ({ assumed: 'assumed', derived: 'derived', taken: 'estimated', scaled: 'estimated' })[m[1].toLowerCase()]; };
    const STATUS_TAG = { verified: 'cited', typical: 'estimated', assumed: 'assumed' };   // typical = from project drawings or arithmetic: estimated
    // A catalogue section -> the spec the drawing uses. Only trefoil formations are drawn (the AC connection).
    function fromSection(s) {
      if (!/trefoil/i.test(s.formation || '')) throw Error(`section ${s.id}: only trefoil formations are drawn here (${s.formation})`);
      const od = (s.duct_od_mm || s.phase_spacing_mm) / 1000;   // trefoil touching: centre spacing = outer diameter
      if (!(od > 0)) throw Error(`section ${s.id}: no duct or cable diameter`);
      const tag = STATUS_TAG[s.status] || 'assumed';
      return { id: s.id, label: `${s.id} (${s.voltage_class}, ${s.formation})`, w: s.trench_width_m, d: s.trench_depth_m, cover: s.cover_to_top_m,
        od, ducted: !!s.duct_od_mm, circuits: s.circuits || 1, cs: s.circuits > 1 ? (s.circuit_spacing_mm || 0) / 1000 : 0,
        tile: s.marker && Number.isFinite(s.marker.depth_m) ? s.marker.depth_m : null,
        prov: { w: WIDTH_TAG(s.source), d: 'derived', cover: tag, od: s.duct_od_mm ? tag : 'assumed', cs: s.circuits > 1 ? 'derived' : null, tile: tag },
        source: s.source, status: s.status };
    }
    // "trench w 0.65 d 1.28 cover 0.9 od 160mm [circuits 2 cs 600mm] [tile 0.8]"
    function typed(line) {
      const v = {}, re = /\b(w|width|d|depth|cover|od|circuits|cs|tile)\s*=?\s*(-?[\d.]+)\s*(mm|m)?\b/gi; let m;
      while ((m = re.exec(line))) { const k = { width: 'w', depth: 'd' }[m[1].toLowerCase()] || m[1].toLowerCase(); let x = +m[2];
        if (k !== 'circuits') x = (m[3] || '').toLowerCase() === 'mm' ? x / 1000 : (k === 'od' || k === 'cs') && !m[3] && x > 5 ? x / 1000 : x; v[k] = x; }
      for (const k of ['w', 'd', 'cover', 'od']) if (!(v[k] > 0)) throw Error(`typed trench needs ${k} (e.g. trench w 0.65 d 1.28 cover 0.9 od 160mm)`);
      const circuits = Math.max(1, Math.round(v.circuits || 1));
      if (circuits > 1 && !(v.cs > 0)) throw Error('two or more circuits need cs (centre spacing), e.g. cs 600mm');
      const s = { id: 'typed', label: 'typed section', w: v.w, d: v.d, cover: v.cover, od: v.od, ducted: false, circuits, cs: circuits > 1 ? v.cs : 0,
        tile: v.tile > 0 ? v.tile : null, prov: { w: 'typed', d: 'typed', cover: 'typed', od: 'typed', cs: circuits > 1 ? 'typed' : null, tile: 'typed' }, source: 'typed: ' + line.trim(), status: 'typed' };
      validate(s); return s;
    }
    function validate(s) {    // the section must fit: cables below cover and above the trench floor, circuits inside the walls
      const h = s.od + s.od * Math.sqrt(3) / 2, half = (s.circuits - 1) * s.cs / 2 + s.od;
      if (s.cover + h > s.d + 1e-9) throw Error(`section ${s.id}: cover ${s.cover} m + trefoil ${h.toFixed(3)} m is deeper than the trench ${s.d} m`);
      if (half > s.w / 2 + 1e-9) throw Error(`section ${s.id}: the cables (half width ${half.toFixed(3)} m) do not fit a ${s.w} m trench`);
    }
    // Circle centres across the section: offset o (m, + to the left of travel) and height z below ground (negative).
    function formation(s) {
      const r = s.od / 2, top = -s.cover - r, low = top - s.od * Math.sqrt(3) / 2, out = [];
      for (let c = 0; c < s.circuits; c++) {
        const oc = (c - (s.circuits - 1) / 2) * s.cs;
        out.push({ c, p: 'top', o: oc, z: top }, { c, p: 'left', o: oc + r, z: low }, { c, p: 'right', o: oc - r, z: low });
      }
      return out;
    }

    // ---------------- the connect-here route, read from its drawn blocks ----------------
    function connectRoute() {
      const pts = [];
      for (const b of SIM.blocks) {
        if (!b.connect || b.pulse || !b.lines) continue;
        const mid = b.lines.filter(L => L[2] === 1.5 && L[5] === 1.5).filter((_, i) => i % 3 === 1);  // phases -1.2, 0, +1.2: the middle one
        for (const L of mid) {
          const a = PF.fromLocal(b.anchor, L[0], L[1]), e = PF.fromLocal(b.anchor, L[3], L[4]);
          if (!pts.length) pts.push([a.lon, a.lat]);
          pts.push([e.lon, e.lat]);
        }
      }
      const out = [];   // drop repeats under 1 mm (chunk joins)
      for (const p of pts) { const l = out[out.length - 1]; if (!l || planar(l, p) > 0.001) out.push(p); }
      return out.length > 1 ? out : null;
    }
    function planar(a, b) { const an = PF.placeKey(a[1], a[0]), p = PF.toLocal(an, a[1], a[0]), r = PF.toLocal(an, b[1], b[0]); return Math.hypot(r.x - p.x, r.y - p.y); }
    const groundAt = (lon, lat) => (map.queryTerrainElevation && map.queryTerrainElevation([lon, lat])) || 0;

    // ---------------- geometry ----------------
    function circle(L, cx, cy, gz, nx, ny, f, r) {   // a 12-gon in the vertical plane across the route
      const P = []; for (let k = 0; k < NCIRC; k++) { const a = 2 * Math.PI * k / NCIRC, o = f.o + r * Math.cos(a), z = f.z + r * Math.sin(a); P.push([cx + nx * o, cy + ny * o, gz + z]); }
      for (let k = 0; k < NCIRC; k++) L.push([...P[k], ...P[(k + 1) % NCIRC]]);
    }
    function build(route, s) {
      st.drawn = []; st.ribs = []; let total = 0, nextRib = 0, i = 0, nb = 0;
      const F = formation(s), hw = s.w / 2, r = s.od / 2;
      while (i < route.length - 1) {
        const an = PF.placeKey(route[i][1], route[i][0]), g0 = groundAt(an.lon, an.lat), W = [], C = [], T = [], ribs = []; let run = 0;
        while (i < route.length - 1 && run < CHUNK) {
          const A = route[i], B = route[i + 1], pa = PF.toLocal(an, A[1], A[0]), pb = PF.toLocal(an, B[1], B[0]);
          const dx = pb.x - pa.x, dy = pb.y - pa.y, len = Math.hypot(dx, dy);
          if (len < 1e-6) { i++; continue; }
          const tx = dx / len, ty = dy / len, nx = -ty, ny = tx, n = Math.max(1, Math.ceil(len / STEP));
          let prev = null;
          for (let k = 0; k <= n; k++) {
            const t = k / n, x = pa.x + dx * t, y = pa.y + dy * t, g = PF.fromLocal(an, x, y), gz = groundAt(g.lon, g.lat) - g0, ch = total + run + len * t;
            const cur = { x, y, gz };
            if (prev) {
              for (const o of [hw, -hw]) for (const z of [0, -s.d]) W.push([prev.x + nx * o, prev.y + ny * o, prev.gz + z, x + nx * o, y + ny * o, gz + z]);   // walls, top and floor edges
              for (const f of F) C.push([prev.x + nx * f.o, prev.y + ny * f.o, prev.gz + f.z, x + nx * f.o, y + ny * f.o, gz + f.z]);                      // cable / duct centre lines
              if (s.tile) T.push([prev.x, prev.y, prev.gz - s.tile, x, y, gz - s.tile]);
            }
            if (ch >= nextRib - 1e-9) {       // a rib: the true-scale cross-section at this chainage
              const at = { wall: W.length, tile: s.tile ? T.length : -1, cable: C.length }, P = o => [x + nx * o, y + ny * o];
              W.push([...P(hw), gz, ...P(hw), gz - s.d], [...P(hw), gz - s.d, ...P(-hw), gz - s.d], [...P(-hw), gz - s.d, ...P(-hw), gz]);
              if (s.tile) T.push([...P(hw), gz - s.tile, ...P(-hw), gz - s.tile]);
              for (const f of F) circle(C, x, y, gz, nx, ny, f, r);
              ribs.push({ at, ch, lon: g.lon, lat: g.lat, n: { x: nx, y: ny } });
              nextRib = Math.floor(ch / RIB) * RIB + RIB;
            }
            prev = cur;
          }
          run += len; i++;
        }
        total += run;
        const grp = L => ({ lines: L, buf: PF.wireBuffer(an, L) });
        const blk = { lon: an.lon, lat: an.lat, anchor: an, groups: { wall: grp(W), cable: grp(C), tile: grp(T) } };
        st.drawn.push(blk); nb++;
        for (const rb of ribs) st.ribs.push({ ...rb, block: blk });
      }
      st.blocks = nb; st.length = total; st.spec = s; st.route = route;
      SIM.repaint();
      return { blocks: nb, ribs: st.ribs.length, length: total };
    }

    // ---------------- the trench's own map layer ----------------
    // The trench blocks are drawn by this module's own custom layer (not window.SIM.blocks), in three colours: walls
    // and floor (the world's cyan), cables or ducts (pink), protection tile (amber). X-ray on: drawn without the depth
    // test, so the buried works show through the terrain; off: depth-tested like the ground (buried, as in reality).
    const COL = { wall: [0.55, 0.9, 1.0, 1], cable: [1.0, 0.45, 0.7, 1], tile: [1.0, 0.75, 0.2, 1] };
    function withAnchor(m, o) { const r = Array.from(m); for (let k = 0; k < 4; k++) r[12 + k] = m[k] * o.x + m[4 + k] * o.y + m[8 + k] * o.z + m[12 + k]; return new Float32Array(r); }
    const layer = {
      id: 'trench-measure', type: 'custom', renderingMode: '3d',
      onAdd(m, gl) {
        const sh = (t, src) => { const o = gl.createShader(t); gl.shaderSource(o, src); gl.compileShader(o); return o; };
        this.pr = gl.createProgram();
        gl.attachShader(this.pr, sh(gl.VERTEX_SHADER, 'uniform mat4 u; attribute vec3 p; void main(){ gl_Position = u * vec4(p, 1.0); }'));
        gl.attachShader(this.pr, sh(gl.FRAGMENT_SHADER, 'precision mediump float; uniform vec4 c; void main(){ gl_FragColor = c; }'));
        gl.linkProgram(this.pr); this.buf = gl.createBuffer();
      },
      render(gl, args) {
        if (!st.drawn || !st.drawn.length) return;
        const m = args.defaultProjectionData ? args.defaultProjectionData.mainMatrix : args;
        gl.useProgram(this.pr);
        if (st.xray) gl.disable(gl.DEPTH_TEST);
        const loc = gl.getAttribLocation(this.pr, 'p'), uu = gl.getUniformLocation(this.pr, 'u'), uc = gl.getUniformLocation(this.pr, 'c');
        for (const b of st.drawn) {
          const a = b.anchor, gz = groundAt(a.lon, a.lat), o = PF.toMercator(a.lat, a.lon, gz);
          gl.uniformMatrix4fv(uu, false, withAnchor(m, o));
          for (const k of ['wall', 'tile', 'cable']) {
            const v = b.groups[k].buf; if (!v.length) continue;
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buf); gl.bufferData(gl.ARRAY_BUFFER, v, gl.DYNAMIC_DRAW);
            gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
            gl.uniform4fv(uc, COL[k]); gl.drawArrays(gl.LINES, 0, v.length / 3);
          }
        }
      }
    };
    const addLayer = () => { try { if (map.getStyle() && !map.getLayer(layer.id)) map.addLayer(layer); } catch (e) { /* style not ready */ } };
    if (map.isStyleLoaded()) addLayer(); map.on('load', addLayer); map.on('style.load', () => setTimeout(() => { addLayer(); if (st.xray) setXray(true, true); }, 50));
    map.on('idle', addLayer);

    // ---------------- the check: read the drawn Float32 geometry back ----------------
    function vtx(b, grp, li, v) {   // decode vertex v (0 or 1) of line li of group grp of block b from the GPU buffer
      const o = PF.toMercator(b.anchor.lat, b.anchor.lon, 0), k = 6 * li + 3 * v, B = b.groups[grp].buf;
      return PF.mapToWire(b.anchor, o.x + B[k], o.y + B[k + 1], B[k + 2]);
    }
    function measureRib(rb, s) {
      const b = rb.block, a = rb.at.wall, c = rb.at.cable, F = formation(s);
      const lTop = vtx(b, 'wall', a, 0), lBot = vtx(b, 'wall', a, 1), f0 = vtx(b, 'wall', a + 1, 0), f1 = vtx(b, 'wall', a + 1, 1), rTop = vtx(b, 'wall', a + 2, 1);
      const gz = lTop.z, width = Math.hypot(f1.x - f0.x, f1.y - f0.y), depth = lTop.z - lBot.z;
      const centres = [], tops = [];
      for (let j = 0; j < F.length; j++) {
        let sx = 0, sy = 0, sz = 0, zmax = -Infinity;
        for (let k = 0; k < NCIRC; k++) { const p = vtx(b, 'cable', c + j * NCIRC + k, 0); sx += p.x; sy += p.y; sz += p.z; zmax = Math.max(zmax, p.z); }
        centres.push({ x: sx / NCIRC, y: sy / NCIRC, z: sz / NCIRC, c: F[j].c }); tops.push(zmax);
      }
      const cover = gz - Math.max(...tops);
      const pair = [];   // centre spacing within each trefoil (all three pairs)
      for (let c = 0; c < s.circuits; c++) { const C = centres.filter(p => p.c === c); for (let m = 0; m < 3; m++) for (let n = m + 1; n < 3; n++) pair.push(Math.hypot(C[m].x - C[n].x, C[m].y - C[n].y, C[m].z - C[n].z)); }
      let cs = null;
      if (s.circuits > 1) { const cen = c => { const C = centres.filter(p => p.c === c); return { x: (C[0].x + C[1].x + C[2].x) / 3, y: (C[0].y + C[1].y + C[2].y) / 3 }; }; const a0 = cen(0), a1 = cen(1); cs = Math.hypot(a1.x - a0.x, a1.y - a0.y); }
      const tileZ = s.tile ? vtx(b, 'tile', rb.at.tile, 0).z : null;
      return { width, depth, cover, pairs: pair, cs, tile: s.tile ? gz - tileZ : null, rightTopZ: rTop.z - gz, corners: [f0, f1] };
    }
    // Independent width: the two floor corners -> lat/lon -> OSTN15 National Grid, divided by the TM point scale factor.
    function bngWidth(rb, m) {
      if (!PF.toBng) return null;
      const g = m.corners.map(p => PF.fromLocal(rb.block.anchor, p.x, p.y)), t = g.map(p => PF.toBng(p.lat, p.lon));
      if (!t.every(x => x && Number.isFinite(x.e)) || !(t[0].e > 0 && t[0].e < 700000)) return null;
      const E = (t[0].e + t[1].e) / 2 - 400000, k = 0.9996012717 * (1 + E * E / (2 * 6375000 * 6375000));
      return { width: Math.hypot(t[1].e - t[0].e, t[1].n - t[0].n) / k, engine: t[0].engine };
    }
    function check() {
      const s = st.spec; if (!s || !st.ribs.length) return { ok: false, text: 'No trench drawn: run Connect here, then type "trench auto".' };
      const rows = [], worst = { width: 0, depth: 0, cover: 0, od: 0, cs: 0, tile: 0, bng: 0 };
      let bngN = 0, bngEngine = null;
      for (const rb of st.ribs) {
        const m = measureRib(rb, s);
        worst.width = Math.max(worst.width, Math.abs(m.width - s.w));
        worst.depth = Math.max(worst.depth, Math.abs(m.depth - s.d));
        worst.cover = Math.max(worst.cover, Math.abs(m.cover - s.cover));
        for (const p of m.pairs) worst.od = Math.max(worst.od, Math.abs(p - s.od));
        if (s.circuits > 1) worst.cs = Math.max(worst.cs, Math.abs(m.cs - s.cs));
        if (s.tile) worst.tile = Math.max(worst.tile, Math.abs(m.tile - s.tile));
        const bw = bngWidth(rb, m); if (bw) { worst.bng = Math.max(worst.bng, Math.abs(bw.width - s.w)); bngN++; bngEngine = bw.engine; }
      }
      const pass = k => worst[k] <= TOL;
      const items = [['width', s.w, 'w'], ['depth', s.d, 'd'], ['cover', s.cover, 'cover'], ['od', s.od, 'od']];
      if (s.circuits > 1) items.push(['cs', s.cs, 'cs']); if (s.tile) items.push(['tile', s.tile, 'tile']);
      for (const [k, v, p] of items) rows.push({ what: k, value_m: v, prov: s.prov[p], worst_err_m: worst[k], pass: pass(k) });
      if (bngN) rows.push({ what: `width via National Grid (${bngEngine})`, value_m: s.w, prov: 'independent path', worst_err_m: worst.bng, pass: pass('bng'), n: bngN });
      const c = window.__connect, lenErr = c && Number.isFinite(c.route_m) ? Math.abs(st.length - c.route_m) : null;
      if (lenErr !== null) rows.push({ what: 'trench length vs connect-here route', value_m: c.route_m, prov: 'derived (connect-here)', worst_err_m: lenErr, pass: lenErr <= TOL });
      const ok = rows.every(r => r.pass);
      const r = { name: 'consistency', ok, section: s.id, land: s.land || null, land_prov: s.landProv || null, ribs: st.ribs.length, tolerance_m: TOL, rows,
        text: `Trench consistency ${ok ? 'PASS' : 'FAIL'} (drawn = ${s.status === 'typed' ? 'typed' : 'catalogue'} values; not a site survey): ${st.ribs.length} ribs of ${s.id}` +
          (s.land ? `, land ${s.land} (${s.landProv})` : '') + ', read back from the drawn buffers. ' +
          rows.map(x => `${x.what} ${x.value_m.toFixed(3)} m (${x.prov}) worst ${(x.worst_err_m * 1000).toFixed(2)} mm`).join('; ') + '. Tolerance 10 mm.' };
      st.last = r; return r;
    }

    // ---------------- X-ray: see through the ground, and the true-scale section panel ----------------
    const panel = document.createElement('div');
    panel.id = 'trench-panel';
    panel.style.cssText = 'position:absolute;right:8px;bottom:170px;z-index:3;width:min(360px,calc(100vw - 32px));max-height:calc(100vh - 330px);overflow:auto;font:11px/1.4 ui-monospace,Consolas,monospace;color:#dfe;background:rgba(0,0,0,.8);border:1px solid rgba(160,220,255,.3);border-radius:6px;padding:6px 8px;display:none';
    panel.innerHTML = '<div id="trench-head"></div><svg id="trench-svg" width="100%" viewBox="0 0 340 200" style="display:block;background:#05080c;margin:4px 0"></svg><div id="trench-foot" style="white-space:pre-wrap"></div>'
      + '<input id="trench-cmd" spellcheck="false" autocomplete="off" placeholder="trench auto | trench go | trench 132kv-1-dno | trench w 0.65 d 1.28 cover 0.9 od 160mm | trench consistency | trench auto other | xray off" style="width:100%;box-sizing:border-box;font:inherit;color:#fff;background:#000;border:1px solid #456;padding:4px 6px;margin-top:4px">';
    document.body.appendChild(panel);
    const $ = id => document.getElementById(id);
    function nearestRib() {
      if (!st.ribs.length) return null; const c = map.getCenter(); let best = null, bd = Infinity;
      for (const rb of st.ribs) { const d = (rb.lon - c.lng) ** 2 * Math.cos(c.lat * Math.PI / 180) ** 2 + (rb.lat - c.lat) ** 2; if (d < bd) { bd = d; best = rb; } }
      return best;
    }
    // The section panel is drawn from the DECODED rib (the geometry the GPU has), at one true scale for both axes.
    function drawPanel() {
      const s = st.spec, rb = nearestRib(); if (!s || !rb) return;
      const m = measureRib(rb, s), F = formation(s), W = 340, H = 200, span = Math.max(s.w + 0.4, 1.2), deep = s.d + 0.25, k = Math.min((W - 60) / span, (H - 40) / deep);
      const X = o => W / 2 - o * k, Y = z => 20 - z * k, hw = s.w / 2;
      const ln = (x0, y0, x1, y1, c = '#8fdcff', dash = '') => `<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" stroke="${c}" stroke-width="1.2" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`;
      const tx = (x, y, t, a = 'middle') => `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" fill="#dfe" font-size="10" text-anchor="${a}">${t}</text>`;
      let g = ln(0, Y(0), W, Y(0), '#6b5', '4 3') + tx(6, Y(0) - 4, 'ground (DEM, estimated)', 'start');
      g += ln(X(hw), Y(0), X(hw), Y(-m.depth)) + ln(X(hw), Y(-m.depth), X(-hw), Y(-m.depth)) + ln(X(-hw), Y(-m.depth), X(-hw), Y(0));
      if (s.tile) g += ln(X(hw), Y(-m.tile), X(-hw), Y(-m.tile), '#fb3', '3 2') + tx(X(-hw) + 4, Y(-m.tile) + 3, `tile ${m.tile.toFixed(3)}`, 'start');
      for (const f of F) g += `<circle cx="${X(f.o).toFixed(1)}" cy="${Y(f.z).toFixed(1)}" r="${(s.od / 2 * k).toFixed(1)}" fill="none" stroke="#f7a" stroke-width="1.2"/>`;
      g += ln(X(hw), H - 12, X(-hw), H - 12, '#dfe') + tx(W / 2, H - 15, `w ${m.width.toFixed(3)} m`);
      g += ln(X(-hw) + 30, Y(0), X(-hw) + 30, Y(-m.depth), '#dfe') + tx(X(-hw) + 34, Y(-m.depth / 2), `d ${m.depth.toFixed(3)}`, 'start');
      const topZ = F[0].z + s.od / 2;
      g += ln(X(0) + 2, Y(0), X(0) + 2, Y(topZ), '#fb3') + tx(X(0) + 6, Y(topZ / 2), `cover ${m.cover.toFixed(3)}`, 'start');
      g += tx(W - 6, 12, `one scale both axes: ${k.toFixed(0)} px per m`, 'end');
      $('trench-svg').innerHTML = g;
      $('trench-head').textContent = `Trench X-ray: ${s.label}\nsection at chainage ${Math.round(rb.ch)} m, ${rb.lat.toFixed(6)}, ${rb.lon.toFixed(6)}`;
      $('trench-head').style.whiteSpace = 'pre-wrap';
      const p = s.prov, od = s.ducted ? 'duct OD' : 'cable OD';
      $('trench-foot').textContent = `width ${s.w} m [${p.w}] · depth ${s.d} m [${p.d}] · cover ${s.cover} m [${p.cover}] · ${od} ${(s.od * 1000).toFixed(0)} mm [${p.od}]`
        + (s.circuits > 1 ? ` · ${s.circuits} circuits at ${(s.cs * 1000).toFixed(0)} mm [${p.cs}]` : '') + (s.tile ? ` · tile at ${s.tile} m [${p.tile}]` : '')
        + (s.land ? `\nLand: ${s.land} [${s.landProv}${s.landProv === 'assumed' ? ', not looked up; type "trench auto other" for other land' : ''}]` : '')
        + `\nSource (${s.status === 'typical' ? 'estimated' : s.status}): ${s.source}` + (st.last ? `\nConsistency ${st.last.ok ? 'PASS' : 'FAIL'}: drawn = typed/cited within 1 cm at ${st.last.ribs} ribs.` : '')
        + '\nIllustrative early design; the network operator decides the real connection.';
    }
    // Close enough to see true scale: X-ray lifts the zoom limit to 22 (about 2.5 cm per pixel at 51 N) and puts it back after.
    function setXray(on, again) {
      if (again) st.xray = false;
      if (on && !st.xray) { if (st.maxZoom == null) st.maxZoom = map.getMaxZoom(); map.setMaxZoom(Math.max(st.maxZoom, 22)); }
      if (!on && st.xray && st.maxZoom != null) { map.setMaxZoom(st.maxZoom); st.maxZoom = null; }
      st.xray = !!on; SIM.repaint(); panel.style.display = on ? 'block' : 'none'; xb.classList.toggle('on', st.xray);
      try { if (map.getLayer('sat')) map.setPaintProperty('sat', 'raster-opacity', on ? 0.35 : 1); } catch (e) { /* style swap in flight */ }
      if (on) drawPanel();
    }
    map.on('moveend', () => { if (st.xray) drawPanel(); });

    // ---------------- typed commands ----------------
    async function cmd(line) {
      line = String(line || '').trim(); const low = line.toLowerCase();
      try {
        if (/^xray\s+(on|off)$/.test(low)) { setXray(low.endsWith('on')); return say(`X-ray ${st.xray ? 'on' : 'off'}.`); }
        if (/^trench\s+go$/.test(low)) {     // walk to the nearest section, looking along the trench
          const rb = nearestRib(); if (!rb) return say('No trench drawn yet.');
          if (!st.xray) setXray(true);
          const brg = Math.atan2(rb.n.y, -rb.n.x) * 180 / Math.PI;   // route direction (east of north) from the rib normal
          map.jumpTo({ center: [rb.lon, rb.lat], zoom: 22, pitch: 70, bearing: brg + 25 });
          return say(`At the section at chainage ${Math.round(rb.ch)} m, looking along the trench. True scale.`);
        }
        if (/^trench\s+(check|consistency)$/.test(low)) { const r = check(); drawPanel(); return say(r.text); }
        if (/^trench\s+off$/.test(low)) { st.drawn = []; SIM.repaint(); st.ribs = []; st.spec = null; st.auto = false; setXray(false); return say('Trench removed.'); }
        const route = connectRoute(); if (!route) return say('No connect-here route yet: press "Connect here" first.');
        let s;
        const am = /^trench\s+auto(?:\s+(farmland|farm|agricultural|other))?$/.exec(low);
        if (am) {
          const c = window.__connect, all = await sections(); if (!c) return say('No connect-here route yet.');
          const land = am[1] ? (am[1] === 'other' ? 'other' : 'farmland') : (st.land || 'farmland');
          const id = AUTO[land][c.kv] && AUTO[land][c.kv][c.n];
          if (!id) return say(`No cited section in the catalogue for ${c.kv} kV with ${c.n} circuit(s) on ${land}. Type one: trench w .. d .. cover .. od .. (and circuits, cs).`);
          s = fromSection(all.find(x => x.id === id));
          if (land === 'farmland' && s.cover < FARM_COVER - 1e-9) {      // derive the farmland section: cover to 0.91 m
            const dz = FARM_COVER - s.cover;
            s = Object.assign({}, s, { id: s.id + '@farmland', label: s.label + ' at farmland cover', cover: FARM_COVER, d: +(s.d + dz).toFixed(3),
              tile: s.tile ? +(s.tile + dz).toFixed(3) : s.tile, prov: Object.assign({}, s.prov, { cover: 'cited', d: 'derived', tile: 'derived' }),
              status: 'verified cover, derived depth', source: `Cover ${FARM_COVER} m: ${FARM_SRC}. Depth and tile lowered by ${(dz * 1000).toFixed(0)} mm from ${s.id} (derived). ${s.id}: ${s.source}` });
          }
          s.land = land; s.landProv = am[1] ? 'typed' : (st.landProv || 'assumed');
          st.land = land; st.landProv = s.landProv; st.auto = true;
        } else if (/^trench\s/.test(low)) {
          const id = low.split(/\s+/)[1], all = await sections(), x = all.find(y => y.id === id);
          if (x) s = fromSection(x);
          else if (/^[a-z0-9]+-[a-z0-9-]+$/.test(id)) return say(`No section "${id}". Known: ${all.map(y => y.id).join(', ')}`);
          else s = typed(line);
          st.auto = false;
        }
        else return say('Type: trench auto | trench go | trench <section id> | trench w .. d .. cover .. od .. | trench auto other | trench consistency | trench off | xray on | xray off');
        validate(s); st.connectRef = window.__connect;
        const b = build(route, s), r = check();
        setXray(true);
        return say(`Trench ${s.id}: ${b.ribs} true-scale sections over ${(b.length / 1000).toFixed(2)} km in ${b.blocks} blocks. ${r.text}`);
      } catch (e) { return say('Trench: ' + e.message); }
    }
    function say(t) { SIM.info(t); window.__trench.lastText = t; return t; }
    $('trench-cmd').addEventListener('keydown', e => { if (e.key === 'Enter') { const v = e.target.value; e.target.value = ''; cmd(v); } });
    const xb = SIM.addButton('Trench X-ray', () => { if (!st.spec) cmd('trench auto'); else setXray(!st.xray); });

    // Follow connect-here: when its route changes and the trench is on "auto", redraw it.
    setInterval(() => { if (st.auto && window.__connect && window.__connect !== st.connectRef && !document.hidden) { st.connectRef = window.__connect; setTimeout(() => cmd('trench auto'), 800); } }, 700);

    window.__trench = { cmd, check, consistency: check, blocks: () => st.drawn || [], spec: () => st.spec, ribs: () => st.ribs.length, route: () => st.route, measureRib: i => measureRib(st.ribs[i], st.spec), lastText: '' };
    if (q.get('trench')) { const want = q.get('trench'); const t0 = Date.now();
      (function go() { if (window.__connect && connectRoute()) cmd(want === '1' ? 'trench auto' : 'trench ' + want); else if (Date.now() - t0 < 60000) setTimeout(go, 500); })(); }
  }
})();
