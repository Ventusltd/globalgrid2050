// mod/pylons-real.js - lattice pylons and sagging conductors on the real GridAtlas lines.
// Plain script. Attaches to window.SIM ({ map, ... }) and uses the overlay's place frame (window.__pf.PF), so every
// tower is authored in metres around a 100 m place key and lands on its exact WGS84 position.
// What is real: tower positions = GridAtlas line vertices (lines from OpenStreetMap), with vertices closer than
// MERGE_M merged. What is estimated: towers inserted on long straight runs (typical span), tower shape and height,
// arm lengths, insulator length and conductor sag, all by voltage class. Drawn in its own custom layer:
// one GPU buffer per tower block, uploaded once, reused every frame; hidden below zoom MIN_Z.
(function () {
  'use strict';
  const MIN_Z = 14, MAX_TOWERS = 260, MERGE_M = 60, SEG = 12;
  const GA = 'https://ventusltd.github.io/gridatlas/atlas/releases/202608300453-atlas-v9/data';
  // Estimated geometry by voltage class (GB double-circuit lattice types, typical values, not surveyed):
  // H tower height, base half-width, arm heights (fractions of H, bottom to top), arm half-lengths (m),
  // suspension insulator length (m), typical span (m), catenary parameter a = T/w (m), conductor colour.
  const KV = {
    '400': { H: 50, base: 6.0, armZ: [0.62, 0.77, 0.92], arm: [10.5, 12.0, 9.0], ins: 4.5, span: 360, a: 1500, col: [0.25, 0.5, 1.0] },
    '275': { H: 46, base: 5.5, armZ: [0.62, 0.77, 0.92], arm: [9.5, 11.0, 8.2], ins: 3.4, span: 340, a: 1400, col: [1.0, 0.3, 0.3] },
    '132': { H: 27, base: 3.2, armZ: [0.60, 0.76, 0.92], arm: [4.6, 5.3, 4.1], ins: 1.8, span: 280, a: 1100, col: [0.2, 0.9, 0.4] }
  };
  const TOWER_COL = [0.82, 0.86, 0.9];

  let SIM, map, PF, on = true, btn = null;
  const lines = { };                     // kv -> [{ bbox, coords }]
  const runs = new Map();                // `${kv}:${lineIndex}` -> tower list (built lazily, cached)
  const live = new Map();                // tower id -> block { anchor, lon, lat, gz, buf, nTower, nWire, col }
  let gl = null, prog = null, loc = {}, pending = 0, regrades = 0;

  const ready = () => { SIM = window.SIM; PF = window.__pf && window.__pf.PF; return SIM && SIM.map && PF; };
  (function wait(n) { if (ready()) start(); else if (n < 200) setTimeout(() => wait(n + 1), 100); })(0);

  function start() {
    map = SIM.map;
    if (SIM.addButton) { btn = SIM.addButton('Pylons (real)', () => { on = !on; btn.classList.toggle('on', on); refresh(); }); btn.classList.add('on'); }
    Promise.all(Object.keys(KV).map(kv => fetch(`${GA}/grid_${kv}kv.geojson`).then(r => r.json()).then(j => {
      const L = [];
      for (const f of j.features || []) { const g = f.geometry; if (!g) continue;
        for (const c of g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : []) {
          let w = 180, s = 90, e = -180, n = -90; for (const [x, y] of c) { if (x < w) w = x; if (x > e) e = x; if (y < s) s = y; if (y > n) n = y; }
          L.push({ bbox: [w, s, e, n], coords: c }); } }   // properties (names) are never read or shown
      lines[kv] = L;
    }).catch(() => { lines[kv] = []; }))).then(() => { addLayer(); refresh(); });
    map.on('moveend', refresh);
    map.on('style.load', () => setTimeout(() => { addLayer(); refresh(); }, 50));
    map.on('idle', () => { if (pending && regrades < 6) { pending = 0; regrades++; regrade(); } });
  }

  // ---- towers along one GridAtlas line: exact vertices, close ones merged, long runs filled at the typical span ----
  const kx = lat => 111320 * Math.cos(lat * Math.PI / 180);
  const dist = (a, b) => Math.hypot((b[0] - a[0]) * kx((a[1] + b[1]) / 2), (b[1] - a[1]) * 111320);
  function towersOf(kv, li) {
    const id = kv + ':' + li; if (runs.has(id)) return runs.get(id);
    const c = lines[kv][li].coords, P = [];
    for (const p of c) { if (!P.length || dist(P[P.length - 1].p, p) >= MERGE_M) P.push({ p, est: false }); }
    if (P.length > 1 && dist(P[P.length - 1].p, c[c.length - 1]) > 1) P[P.length - 1] = { p: c[c.length - 1], est: false };
    const T = [];
    for (let i = 0; i < P.length; i++) {
      T.push(P[i]);
      if (i + 1 < P.length) { const d = dist(P[i].p, P[i + 1].p), n = Math.round(d / KV[kv].span) - 1;
        for (let k = 1; k <= n; k++) { const t = k / (n + 1), a = P[i].p, b = P[i + 1].p; T.push({ p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], est: true }); } }
    }
    const out = T.map((t, i) => ({ id: `${id}:${i}`, kv, lon: t.p[0], lat: t.p[1], est: t.est }));
    for (let i = 0; i < out.length; i++) {           // along-line direction in local metres (bisector at angle towers)
      const t = out[i], dir = [0, 0];
      for (const j of [i - 1, i + 1]) { const o = out[j]; if (!o) continue; const s = j < i ? 1 : -1;
        const dx = (t.lon - o.lon) * kx(t.lat) * s, dy = (t.lat - o.lat) * 111320 * s, l = Math.hypot(dx, dy) || 1; dir[0] += dx / l; dir[1] += dy / l; }
      const l = Math.hypot(dir[0], dir[1]) || 1; t.u = [dir[0] / l, dir[1] / l]; t.next = out[i + 1] || null;
    }
    runs.set(id, out); return out;
  }

  // ---- geometry in tower-frame metres: (along, left, up) ----
  function lattice(g) {
    const L = [], H = g.H, b = g.base, zw = g.armZ[0] * H - 2, w = b * 0.32, zt = g.armZ[2] * H + 1, wt = w * 0.8;
    const half = z => z <= zw ? b + (w - b) * z / zw : w + (wt - w) * (z - zw) / (zt - zw);
    const lv = [0, zw * 0.3, zw * 0.58, zw * 0.8, zw, ...g.armZ.map(f => f * H), zt];
    const sq = (z) => { const h = half(z); return [[-h, -h, z], [h, -h, z], [h, h, z], [-h, h, z]]; };
    for (let k = 0; k < lv.length; k++) {
      const A = sq(lv[k]);
      for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; if (k > 0) L.push([...A[i], ...A[j]]); }
      if (k + 1 < lv.length) { const B = sq(lv[k + 1]);
        for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; L.push([...A[i], ...B[i]]);
          if (lv[k] < zw) L.push([...A[i], ...B[j]], [...A[j], ...B[i]]); else L.push([...A[i], ...B[j]]); } }
    }
    const top = sq(zt); for (const p of top) L.push([...p, 0, 0, H]);          // earth-wire peak
    g.armZ.forEach((f, k) => { const z = f * H, h = half(z), a = g.arm[k];     // crossarms: two chords to the tip, both sides
      for (const s of [-1, 1]) { const tip = [0, s * a, z];
        L.push([-h, s * h, z, ...tip], [h, s * h, z, ...tip], [-h, s * h, z - 2.2, ...tip], [h, s * h, z - 2.2, ...tip], [...tip, 0, s * a, z - g.ins]); } });
    return L;
  }
  const attach = g => { const P = []; g.armZ.forEach((f, k) => { for (const s of [-1, 1]) P.push([s * g.arm[k], f * g.H - g.ins]); }); P.push([0, g.H]); return P; };

  function elev(lon, lat) { const e = map.queryTerrainElevation ? map.queryTerrainElevation([lon, lat]) : 0; if (e == null) pending = 1; return e || 0; }

  function makeBlock(t) {
    const g = KV[t.kv], an = PF.placeKey(t.lat, t.lon), o = PF.toLocal(an, t.lat, t.lon, 0);
    const u = t.u, v = [-u[1], u[0]], gz = elev(t.lon, t.lat);
    const X = (a, l, z, base = o, uu = u, vv = v, dz = 0) => [base.x + uu[0] * a + vv[0] * l, base.y + uu[1] * a + vv[1] * l, z + dz];
    const T = lattice(g).map(s => [...X(s[0], s[1], s[2]), ...X(s[3], s[4], s[5])]);
    const W = [];
    if (t.next) {                                    // conductors to the next tower: 3 phases per side + earth wire
      const n = t.next, q = PF.toLocal(an, n.lat, n.lon, 0), nv = [-n.u[1], n.u[0]], dz = elev(n.lon, n.lat) - gz;
      const span = Math.hypot(q.x - o.x, q.y - o.y), sag = span * span / (8 * g.a);
      for (const [l, z] of attach(g)) {
        const A = X(0, l, z), B = X(0, l, z, q, n.u, nv, dz); let prev = A;
        for (let k = 1; k <= SEG; k++) { const s = k / SEG, p = [A[0] + (B[0] - A[0]) * s, A[1] + (B[1] - A[1]) * s, A[2] + (B[2] - A[2]) * s - 4 * sag * s * (1 - s) * (l ? 1 : 0.7)];
          W.push([...prev, ...p]); prev = p; }
      }
    }
    const data = PF.wireBuffer(an, T.concat(W)), buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);   // once
    return { pylonsReal: true, lon: t.lon, lat: t.lat, anchor: an, gz, buf, nTower: T.length * 2, nWire: W.length * 2, col: g.col, t };
  }

  function refresh() {
    if (!map || !gl) return;
    const want = new Set();
    if (on && map.getZoom() >= MIN_Z) {
      const b = map.getBounds(), c = map.getCenter(), mx = (b.getEast() - b.getWest()) * 0.25, my = (b.getNorth() - b.getSouth()) * 0.25;
      const W = b.getWest() - mx, E = b.getEast() + mx, S = b.getSouth() - my, N = b.getNorth() + my, cand = [];
      for (const kv of Object.keys(lines)) lines[kv].forEach((ln, li) => {
        const [w, s, e, n] = ln.bbox; if (e < W || w > E || n < S || s > N) return;
        for (const t of towersOf(kv, li)) if (t.lon >= W && t.lon <= E && t.lat >= S && t.lat <= N) cand.push([dist([c.lng, c.lat], [t.lon, t.lat]), t]);
      });
      cand.sort((a, b) => a[0] - b[0]);
      for (const [, t] of cand.slice(0, MAX_TOWERS)) want.add(t.id), live.has(t.id) || live.set(t.id, makeBlock(t));
    }
    for (const [id, bk] of live) if (!want.has(id)) { gl.deleteBuffer(bk.buf); live.delete(id); }
    if (SIM.info && on && live.size) SIM.info(`Pylons: ${live.size} at GridAtlas line vertices (© OpenStreetMap). Heights, arms, sag and infill towers are estimates.`);
    map.triggerRepaint();
  }
  // Terrain arrives after the first build: re-grade the blocks built on missing heights (their spans too).
  function regrade() { for (const [id, bk] of live) { gl.deleteBuffer(bk.buf); live.delete(id); } refresh(); }

  const layer = {
    id: 'pylons-real', type: 'custom', renderingMode: '3d',
    onAdd(m, g) {
      if (gl === g && prog) return; gl = g; live.clear();
      const sh = (t, s) => { const o = g.createShader(t); g.shaderSource(o, s); g.compileShader(o); return o; };
      prog = g.createProgram();
      g.attachShader(prog, sh(g.VERTEX_SHADER, 'uniform mat4 u; attribute vec3 p; void main(){ gl_Position = u * vec4(p, 1.0); }'));
      g.attachShader(prog, sh(g.FRAGMENT_SHADER, 'precision mediump float; uniform vec3 c; void main(){ gl_FragColor = vec4(c, 1.0); }'));
      g.linkProgram(prog); loc = { p: g.getAttribLocation(prog, 'p'), u: g.getUniformLocation(prog, 'u'), c: g.getUniformLocation(prog, 'c') };
    },
    render(g, args) {
      if (!on || map.getZoom() < MIN_Z || !live.size) return;
      const m = (args && args.defaultProjectionData && args.defaultProjectionData.mainMatrix) || args, M = new Float32Array(16);
      g.useProgram(prog); g.enableVertexAttribArray(loc.p);
      for (const bk of live.values()) {
        const a = bk.anchor, o = PF.toMercator(a.lat, a.lon, bk.gz);
        for (let k = 0; k < 16; k++) M[k] = m[k];
        for (let k = 0; k < 4; k++) M[12 + k] = m[k] * o.x + m[4 + k] * o.y + m[8 + k] * o.z + m[12 + k];
        g.uniformMatrix4fv(loc.u, false, M);
        g.bindBuffer(g.ARRAY_BUFFER, bk.buf); g.vertexAttribPointer(loc.p, 3, g.FLOAT, false, 0, 0);
        g.uniform3fv(loc.c, TOWER_COL); g.drawArrays(g.LINES, 0, bk.nTower);
        if (bk.nWire) { g.uniform3fv(loc.c, bk.col); g.drawArrays(g.LINES, bk.nTower, bk.nWire); }
      }
    }
  };
  function addLayer() {
    if (!map.isStyleLoaded()) { map.once('idle', () => { addLayer(); refresh(); }); return; }
    try { if (!map.getLayer('pylons-real')) map.addLayer(layer); } catch (e) { map.once('idle', () => { addLayer(); refresh(); }); }
  }

  window.__pylonsReal = { live, refresh, count: () => live.size, towersOf, KV };
})();
