// mod/pylons-real.js - lattice pylons and sagging conductors on the real GridAtlas lines.
// Plain script. Attaches to window.SIM ({ map, addBlock, removeWhere, ... }) and uses the overlay's place frame
// (window.__pf.PF), so every tower is authored in metres around a 100 m place key and lands on its exact WGS84 position.
// ASSUMED AT A MAPPED LINE VERTEX: a tower is assumed at each GridAtlas line vertex (lines from OpenStreetMap, ODbL).
// The file drops node tags, so a vertex may be a bend, not a surveyed tower. A vertex closer than MERGE_M to the
// previous kept one is dropped, never moved. A tower that falls inside a mapped substation footprint (OpenStreetMap,
// ODbL, mod/substations-footprints.odbl.json) is dropped: the line ends at a gantry inside the fence, not a lattice
// tower. ESTIMATED: infill towers on long straight runs (typical
// span), tower shape and height, arm lengths, insulator length and conductor sag, all by voltage class (not surveyed).
// Drawn through the overlay's ONE wire layer (SIM.addBlock): one block per tower, no layer or GL program of its own.
// Hidden below zoom MIN_Z. window.__pylonsReal.check() tests every mapped tower against its GridAtlas vertex with ===.
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
  const here = (document.currentScript && document.currentScript.src) || location.href;
  const FP_URL = new URL('substations-footprints.odbl.json', here).href;
  let fps = [];                          // [{ bbox, ring }] substation footprints, [lon, lat] rings
  let dropped = 0;                       // towers dropped because they fall inside a footprint

  let SIM, map, PF, on = true, btn = null;
  const lines = { };                     // kv -> [{ bbox, coords }]
  const runs = new Map();                // `${kv}:${lineIndex}` -> tower list (built lazily, cached)
  const live = new Map();                // tower id -> block { anchor, lon, lat, gz, buf, nTower, nWire, col }
  let pending = 0, regrades = 0;

  const ready = () => { SIM = window.SIM; PF = window.__pf && window.__pf.PF; return SIM && SIM.map && PF; };
  (function wait(n) { if (ready()) start(); else if (n < 200) setTimeout(() => wait(n + 1), 100); })(0);

  function start() {
    map = SIM.map;
    if (SIM.addButton) { btn = SIM.addButton('Pylons (mapped)', () => { on = !on; btn.classList.toggle('on', on); refresh(); }); btn.classList.add('on'); }
    const fpLoad = fetch(FP_URL).then(r => r.ok ? r.json() : null).then(j => {
      fps = ((j && j.f) || []).map(r => { const ring = r[2]; let w = 180, s = 90, e = -180, n = -90;
        for (const [x, y] of ring) { if (x < w) w = x; if (x > e) e = x; if (y < s) s = y; if (y > n) n = y; }
        return { bbox: [w, s, e, n], ring }; });
    }).catch(() => { fps = []; });
    Promise.all([fpLoad].concat(Object.keys(KV).map(kv => fetch(`${GA}/grid_${kv}kv.geojson`).then(r => r.json()).then(j => {
      const L = [];
      for (const f of j.features || []) { const g = f.geometry; if (!g) continue;
        for (const c of g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : []) {
          let w = 180, s = 90, e = -180, n = -90; for (const [x, y] of c) { if (x < w) w = x; if (x > e) e = x; if (y < s) s = y; if (y > n) n = y; }
          L.push({ bbox: [w, s, e, n], coords: c }); } }   // properties (names) are never read or shown
      lines[kv] = L;
    }).catch(() => { lines[kv] = []; })))).then(refresh);
    map.on('moveend', refresh);
    map.on('idle', () => { if (pending && regrades < 6) { pending = 0; regrades++; regrade(); } });
  }

  // ---- towers along one GridAtlas line: exact vertices, close ones merged, long runs filled at the typical span ----
  const kx = lat => 111320 * Math.cos(lat * Math.PI / 180);
  const dist = (a, b) => Math.hypot((b[0] - a[0]) * kx((a[1] + b[1]) / 2), (b[1] - a[1]) * 111320);
  function inRing(x, y, R) {                         // even-odd point in polygon, [lon, lat]
    let c = false; for (let i = 0, j = R.length - 1; i < R.length; j = i++) { const [xi, yi] = R[i], [xj, yj] = R[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
  function inSubstation(lon, lat) {
    for (const f of fps) { const [w, s, e, n] = f.bbox; if (lon < w || lon > e || lat < s || lat > n) continue; if (inRing(lon, lat, f.ring)) return true; }
    return false; }
  function towersOf(kv, li) {
    const id = kv + ':' + li; if (runs.has(id)) return runs.get(id);
    const c = lines[kv][li].coords, P = [];
    for (const p of c) { if (!P.length || dist(P[P.length - 1].p, p) >= MERGE_M) P.push({ p, est: false }); }
    if (P.length > 1 && dist(P[P.length - 1].p, c[c.length - 1]) > 1) P[P.length - 1] = { p: c[c.length - 1], est: false };
    const T = [];
    for (let i = 0; i < P.length; i++) {
      T.push(P[i]);
      if (i + 1 < P.length) { const d = dist(P[i].p, P[i + 1].p), n = Math.round(d / KV[kv].span) - 1;
        for (let k = 1; k <= n; k++) { const t = k / (n + 1), a = P[i].p, b = P[i + 1].p; T.push({ p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], est: true, seg: [a, b] }); } }
    }
    // Drop towers inside a substation footprint; a span never jumps across a dropped tower (break = no conductor).
    const all = T.map((t, i) => ({ id: `${id}:${i}`, kv, lon: t.p[0], lat: t.p[1], est: t.est, seg: t.seg || null,
      inSub: inSubstation(t.p[0], t.p[1]) }));
    const out = []; let brk = false;
    for (const t of all) { if (t.inSub) { dropped++; brk = true; continue; } t.brk = brk; brk = false; out.push(t); }
    for (let i = 0; i < out.length; i++) {           // along-line direction in local metres (bisector at angle towers)
      const t = out[i], dir = [0, 0];
      for (const j of [i - 1, i + 1]) { const o = out[j]; if (!o) continue; const s = j < i ? 1 : -1;
        const dx = (t.lon - o.lon) * kx(t.lat) * s, dy = (t.lat - o.lat) * 111320 * s, l = Math.hypot(dx, dy) || 1; dir[0] += dx / l; dir[1] += dy / l; }
      const l = Math.hypot(dir[0], dir[1]) || 1; t.u = [dir[0] / l, dir[1] / l]; t.next = out[i + 1] && !out[i + 1].brk ? out[i + 1] : null;
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

  // One block per tower for the ONE wire layer (SIM.addBlock). The wire layer lifts each block by the ground height
  // at its place-key anchor, so the tower's own ground offset (tower minus anchor) is baked into z here.
  function makeBlock(t) {
    const g = KV[t.kv], an = PF.placeKey(t.lat, t.lon), o = PF.toLocal(an, t.lat, t.lon, 0);
    const u = t.u, v = [-u[1], u[0]], ga = elev(an.lon, an.lat), gz = elev(t.lon, t.lat) - ga;
    const X = (a, l, z, base = o, uu = u, vv = v, dz = gz) => [base.x + uu[0] * a + vv[0] * l, base.y + uu[1] * a + vv[1] * l, z + dz];
    const T = lattice(g).map(s => [...X(s[0], s[1], s[2]), ...X(s[3], s[4], s[5])]);
    const W = [];
    if (t.next) {                                    // conductors to the next tower: 3 phases per side + earth wire
      const n = t.next, q = PF.toLocal(an, n.lat, n.lon, 0), nv = [-n.u[1], n.u[0]], dz = elev(n.lon, n.lat) - ga;
      const span = Math.hypot(q.x - o.x, q.y - o.y), sag = span * span / (8 * g.a);
      for (const [l, z] of attach(g)) {
        const A = X(0, l, z), B = X(0, l, z, q, n.u, nv, dz); let prev = A;
        for (let k = 1; k <= SEG; k++) { const s = k / SEG, p = [A[0] + (B[0] - A[0]) * s, A[1] + (B[1] - A[1]) * s, A[2] + (B[2] - A[2]) * s - 4 * sag * s * (1 - s) * (l ? 1 : 0.7)];
          W.push([...prev, ...p]); prev = p; }
      }
    }
    const lines = T.concat(W);
    return { pylonsReal: true, id: t.id, lon: t.lon, lat: t.lat, anchor: an, lines, buf: PF.wireBuffer(an, lines),
      nTower: T.length * 2, nWire: W.length * 2, col: g.col, est: t.est, kv: t.kv, t,
      prov: t.est ? 'estimated: infill tower at the typical span between two mapped vertices'
                   : 'assumed: tower at a mapped line vertex (GridAtlas, OpenStreetMap, ODbL); the vertex may be a bend, not a tower' };
  }

  function refresh() {
    if (!map || !SIM.addBlock) return;
    const want = new Set();
    if (on && map.getZoom() >= MIN_Z) {
      const b = map.getBounds(), c = map.getCenter(), mx = (b.getEast() - b.getWest()) * 0.25, my = (b.getNorth() - b.getSouth()) * 0.25;
      const W = b.getWest() - mx, E = b.getEast() + mx, S = b.getSouth() - my, N = b.getNorth() + my, cand = [];
      for (const kv of Object.keys(lines)) lines[kv].forEach((ln, li) => {
        const [w, s, e, n] = ln.bbox; if (e < W || w > E || n < S || s > N) return;
        for (const t of towersOf(kv, li)) if (t.lon >= W && t.lon <= E && t.lat >= S && t.lat <= N) cand.push([dist([c.lng, c.lat], [t.lon, t.lat]), t]);
      });
      cand.sort((a, b) => a[0] - b[0]);
      for (const [, t] of cand.slice(0, MAX_TOWERS)) { want.add(t.id); if (!live.has(t.id)) live.set(t.id, SIM.addBlock(makeBlock(t))); }
    }
    let gone = 0; for (const id of live.keys()) if (!want.has(id)) { live.delete(id); gone++; }
    if (gone) SIM.removeWhere(b => b.pylonsReal && !want.has(b.id));
    if (SIM.info && on && live.size) SIM.info(label());
    SIM.repaint();
  }
  // The on-screen label: what is a mapped position and what is estimated, with the count of each.
  function label() {
    let m = 0, e = 0; for (const bk of live.values()) bk.est ? e++ : m++;
    return `Pylons: ${m} towers assumed at mapped line vertices (GridAtlas, © OpenStreetMap contributors, ODbL) and ${e} estimated infill towers; ` +
      'none drawn inside a mapped substation footprint. Tower shape, height, arms and conductor sag are estimates by voltage class.';
  }
  // Terrain arrives after the first build: re-grade the blocks built on missing heights (their spans too).
  function regrade() { SIM.removeWhere(b => b.pylonsReal); live.clear(); refresh(); }

  // Exact check: every tower not flagged estimated must equal a vertex of its GridAtlas line (===, no tolerance),
  // and every estimated tower must lie on the straight segment between two vertices of its line (ends === vertices,
  // off-line distance < 1 mm, strictly between the ends); no drawn tower may fall inside a substation footprint.
  function check() {
    let exact = 0, bad = [], est = 0, estBad = [], inSub = [];
    for (const bk of live.values()) {
      const [kv, li] = bk.id.split(':'), c = lines[kv][+li].coords, isV = q => c.some(p => p[0] === q[0] && p[1] === q[1]);
      if (inSubstation(bk.lon, bk.lat)) inSub.push(bk.id);
      if (!bk.est) { if (isV([bk.lon, bk.lat])) exact++; else bad.push(bk.id); continue; }
      est++; const sg = bk.t.seg; if (!sg || !isV(sg[0]) || !isV(sg[1])) { estBad.push(bk.id); continue; }
      const [a, b] = sg, k = kx(bk.lat), ax = (b[0] - a[0]) * k, ay = (b[1] - a[1]) * 111320, px = (bk.lon - a[0]) * k, py = (bk.lat - a[1]) * 111320;
      const L2 = ax * ax + ay * ay, u = (px * ax + py * ay) / L2, off = Math.abs(px * ay - py * ax) / Math.sqrt(L2);
      if (!(off < 0.001 && u > 0 && u < 1)) estBad.push(bk.id);
    }
    return { live: live.size, exact, est, bad, estBad, inSub, dropped, label: label() };
  }

  window.__pylonsReal = { live, refresh, count: () => live.size, towersOf, KV, check, label, lines, inSubstation, fps: () => fps.length };
})();
