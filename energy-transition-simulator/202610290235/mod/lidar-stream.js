// lidar-stream: rule R5 (the site tile) in the browser. On ARRIVAL (a find or go ends, or Walk, Drone or Build here
// starts, or the "Stream ground" button), the 2,048 m lattice tile under the view centre is streamed from the
// Environment Agency WCS: the DTM first, the DSM at least 40 s later. Each is decoded in memory, turned into a
// wireframe and a receipt; the heights stay in memory only (for heightAt) and are never stored. Moving (walk, fly, pan, zoom) never asks the service.
// Ground: an 8 m wire grid of measured DTM heights, each node drawn at its own DTM height (ODN), not one anchor height. Above ground: DSM minus DTM over 1 m, as wire posts (derived).
// Coordinates: every node is a British National Grid cell centre (e0 + k + 0.5) turned into WGS84 by the
// overlay's one conversion (place-frame fromBng: OSTN15 where loaded, Helmert otherwise, and the label says which).
// Outside coverage the module says "no measured ground here" and draws nothing (never 0 m).
(function () {
  const HERE = document.currentScript ? document.currentScript.src : location.href;
  const STEP = 8, ABOVE_M = 1, DAY_KEY = 'lidarStream.day';
  const PF = () => window.__pf && window.__pf.PF;
  let R5 = null, pacer = null, fetchImpl = null, on = true, btn = null, box = null, gapOverride = null;
  const tiles = new Map(); // tile key -> { tile, dtm: {..}|null, dsm: {..}|null, blocks: [], status }
  let current = null, timer = null, arriving = false;
  function wait(f) { if (window.SIM && PF()) f(); else setTimeout(() => wait(f), 200); }
  const today = () => new Date().toISOString().slice(0, 10);
  function dayUsed() { try { const d = JSON.parse(localStorage.getItem(DAY_KEY) || '{}'); return d.date === today() ? d.used | 0 : 0; } catch (e) { return 0; } }
  function saveDay() { try { localStorage.setItem(DAY_KEY, JSON.stringify({ date: today(), used: pacer.state.used })); } catch (e) { /* private window */ } }

  // The receipt collapses to ONE dim line (tile + receipt sha8); a click on it opens the full receipt, licence and
  // attribution above it, a second click closes it. The line is placed clear of every visible caption (place()).
  let line = null, full = null, open = false;
  function panel() {
    if (box) return full;
    box = document.createElement('div'); box.id = 'lidar-stream-receipt';
    box.style.cssText = 'position:fixed;left:10px;bottom:8px;z-index:5;display:flex;flex-direction:column-reverse;align-items:flex-start;gap:4px;max-width:calc(100vw - 120px)';
    line = document.createElement('div'); line.id = 'lidar-stream-line'; line.title = 'Measured ground: click for the full receipt, licence and attribution';
    line.style.cssText = 'font:11px/15px system-ui,sans-serif;color:var(--dim,#8a9a9a);text-shadow:0 0 3px #000,0 0 1px #000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;cursor:pointer';
    full = document.createElement('div'); full.id = 'lidar-stream-full'; full.hidden = true;
    full.style.cssText = 'max-width:min(560px,calc(100vw - 32px));max-height:50vh;overflow:auto;font:11px/1.35 monospace;color:#dfe;background:rgba(0,0,0,.8);padding:6px 8px;border-radius:6px;white-space:pre-wrap;word-break:break-all';
    line.addEventListener('click', () => setOpen(!open));
    box.append(line, full); document.body.appendChild(box); return full;
  }
  function setOpen(v) { panel(); open = !!v; full.hidden = !open; place(); }
  function summary(t) {
    if (!t) return 'measured ground: arrive somewhere to stream its tile';
    const at = `tile ${t.tile.e0}/${t.tile.n0}`, d = t.dtm;
    if (d && d.sha) return `measured ground: EA LiDAR 1 m, ${at}, receipt ${d.sha.slice(0, 8)}${t.dsm && t.dsm.sha ? '' : t.status && t.status !== 'complete' ? ` (${t.status})` : ''}`;
    return `measured ground: ${at}, ${t.status || (d && d.none) || 'waiting'}`;
  }
  function show() { showText(); place(); }
  function showText() {
    const t = current && tiles.get(current), P = PF();
    panel(); line.textContent = summary(t);
    if (!t) { full.textContent = 'Measured ground (R5): arrive somewhere to stream its 2,048 m tile.'; return; }
    const eng = P && P.engine ? P.engine : (t.engine || '');
    const L = t.arrived ? [t.arrived] : [];
    L.push(`Measured ground, tile ${t.tile.e0} E ${t.tile.n0} N (2,048 m, EPSG:27700): ${t.status}`);
    for (const k of ['dtm', 'dsm']) {
      const r = t[k];
      if (!r) continue;
      if (r.none) { L.push(r.failed ? r.none : `${k.toUpperCase()}: no measured ground here (${r.none})`); continue; }
      if (r.pending) { L.push(`${k.toUpperCase()}: ${r.pending}`); continue; }
      L.push(`${k.toUpperCase()} receipt ${r.sha.slice(0, 12)}: ${r.src.product}, ${r.src.release}; survey year not read yet, so these heights count as pre-construction ground (R5 rule 9); ` +
        `box E ${r.box.e0}-${r.box.e1} N ${r.box.n0}-${r.box.n1}; fetched ${r.at}; ${(r.valid * 100).toFixed(1)}% cells measured; sha256(cells) ${r.sha}`);
    }
    if (t.lifted) L.push(`Near the walker (${LIFT_M} m): ${t.lifted} nodes lie under the coarser map DEM and are drawn at the DEM surface, DOTTED (estimated); solid = measured height.`);
    if (t.objects != null) L.push(`Above ground (DSM - DTM > ${ABOVE_M} m, derived): ${t.objects} posts on the ${STEP} m grid.`);
    L.push(`Placed by ${t.engine || eng || 'place-frame'}. ${R5 ? R5.LICENCE : ''} Source: Environment Agency.`);
    panel().textContent = L.join('\n');
  }

  // Tile -> local wire frame: exact at three control nodes, affine between them (OSTN15 varies by mm over 2 km).
  function frame(t) {
    const P = PF(), g = P.fromBng(t.e0 + 1024, t.n0 + 1024), anchor = P.placeKey(g.lat, g.lon);
    const o = P.bngToWire(anchor, t.e0, t.n0), ex = P.bngToWire(anchor, t.e0 + 2048, t.n0), ny = P.bngToWire(anchor, t.e0, t.n0 + 2048);
    const ax = (ex.x - o.x) / 2048, ay = (ex.y - o.y) / 2048, bx = (ny.x - o.x) / 2048, by = (ny.y - o.y) / 2048;
    return { anchor, engine: g.engine || '', xy: (e, n) => { const de = e - t.e0, dn = n - t.n0; return [o.x + ax * de + bx * dn, o.y + ay * de + by * dn]; } };
  }
  // Height at cell (i, j) counted from the tile's SW corner, or NaN (unmeasured or outside the box).
  function hAt(r, i, j) {
    if (!r || r.none || r.pending) return NaN;
    const c = r.tile.e0 + i - r.geo.west, rr = r.geo.north - (r.tile.n0 + j) - 1;
    if (c < 0 || rr < 0 || c >= r.geo.width || rr >= r.geo.height) return NaN;
    const k = rr * r.geo.width + c; return r.mask[k] ? r.geo.data[k] : NaN;
  }
  // Terrain exaggeration: MapLibre 4.7 returns queryTerrainElevation multiplied by the exaggeration and relative to the
  // centre's elevation (transform.elevation, also exaggerated). terrainAt is the RENDER lift in that same frame, so it
  // must stay exactly what perf.js adds (the per-node cancellation H - gz + gz = H needs the same number on both sides).
  // demAt is the map DEM in true metres (ODN), divided by the exaggeration like coords-readout.js, for DEM vs DTM.
  const exag = () => { const m = window.SIM.map, t = m.getTerrain && m.getTerrain(); return (t && t.exaggeration) || 1; };
  const elevNow = () => (window.SIM.map.transform && window.SIM.map.transform.elevation) || 0;
  function terrainAt(lon, lat) { const m = window.SIM.map; return (m.queryTerrainElevation && m.queryTerrainElevation([lon, lat])) || 0; }
  function demAt(lon, lat) {
    const m = window.SIM.map; if (!(m.getTerrain && m.getTerrain() && m.queryTerrainElevation)) return null;
    const v = m.queryTerrainElevation([lon, lat]); return v == null ? null : (v + (m.transform.elevation || 0)) / exag();
  }
  // The measured DTM height (m, ODN) of the 1 m cell holding (e, n), with the receipt it came from; null outside.
  function heightAt(e, n) {
    for (const t of tiles.values()) {
      const r = t.dtm; if (!r || r.none || r.pending) continue;
      const i = Math.floor(e - t.tile.e0), j = Math.floor(n - t.tile.n0);
      if (i < 0 || j < 0 || i >= 2048 || j >= 2048) continue;
      const h = hAt(r, i, j);
      return Number.isFinite(h) ? { h, receipt: r.sha.slice(0, 12), prov: 'measured', cell: [t.tile.e0 + i, t.tile.n0 + j] } : { h: null, receipt: r.sha.slice(0, 12), why: 'cell not measured' };
    }
    return { h: null, why: 'no streamed tile here' };
  }
  // Datum probe: for up to n wire nodes, the height the GPU draws (buffer z + the overlay's live anchor lift, in
  // metres at the node) minus heightAt at the node. Also the map DEM at the node minus heightAt (for information).
  function probe(n = 200) {
    const P = PF(), out = [];
    for (const [key, t] of tiles) {
      if (!t.H) continue;
      const blk = (t.blks || []).find(b => b.kind === 'ground'); if (!blk) continue;
      const idx = []; for (let k = 0; k < t.N * t.N; k++) if (t.seg[k] >= 0) idx.push(k);
      const gzNow = terrainAt(t.anchor.lon, t.anchor.lat), stride = Math.max(1, Math.floor(idx.length / n));
      for (let q = 0; q < idx.length && out.length < n; q += stride) {
        const k = idx[q], a = k % t.N, b = (k - a) / t.N, e = t.tile.e0 + a * STEP + STEP / 2 + 0.5, nn = t.tile.n0 + b * STEP + STEP / 2 + 0.5;
        const g = P.fromBng(e, nn), mz = blk.buf[6 * t.seg[k] + 2] + P.toMercator(t.anchor.lat, t.anchor.lon, gzNow + elevNow()).z; // back to ODN
        const drawn = mz / P.toMercator(g.lat, g.lon, 1).z, truth = heightAt(e, nn);
        out.push({ e, n: nn, drawn, truth: truth.h, D: drawn - truth.h, demD: demAt(g.lon, g.lat) == null ? null : demAt(g.lon, g.lat) - truth.h, receipt: truth.receipt });
      }
    }
    const D = out.map(o => Math.abs(o.D)), exaggeration = exag(), dm = out.filter(o => o.demD != null), M = dm.map(o => Math.abs(o.demD));
    return { nodes: out.length, maxAbsD: Math.max(...D), meanD: out.reduce((s, o) => s + o.D, 0) / (out.length || 1),
      demNodes: dm.length, maxAbsDemD: M.length ? Math.max(...M) : null, meanDemD: dm.length ? dm.reduce((s, o) => s + o.demD, 0) / dm.length : null, receipt: out[0] && out[0].receipt, exaggeration, sample: out.slice(0, 3) };
  }
  // The walker: the camera's ground point in BNG (Walk and Drone stand the camera there), or null before a map frame.
  const LIFT_M = 150, DOTS = 4, LIFT_CLEAR = 0.25; // 0.25 m over the DEM: a line lying exactly on the DEM mesh z-fights it (seen r8)
  function walker() {
    const T = window.SIM.map.transform, cp = T.getCameraPosition && T.getCameraPosition();
    if (!cp || !cp.lngLat) return null; const g = PF().toBng(cp.lngLat.lat, cp.lngLat.lng); return { e: g.e, n: g.n };
  }
  function draw(key) {
    const t = tiles.get(key), S = window.SIM, P = PF();
    S.removeWhere(b => b.lidarStream === key); if (t) t.blks = [];
    if (!t || !t.dtm || t.dtm.none || t.dtm.pending) return;
    const f = frame(t.tile); t.engine = f.engine;
    const N = 2048 / STEP;
    // HEIGHT DATUM: the overlay lifts every block by the map terrain at its anchor (gz). Each vertex is written as
    // (its own DTM height - gz), so on screen every node sits at its own measured height (ODN), never at one anchor
    // height per block. gz is re-read when the map goes idle and the block is rebuilt if it moved (terrain loading).
    // FRAME (r3): MapLibre 4.7 custom layers draw in a frame whose zero is the centre's elevation (transform.elevation,
    // E), and gz is relative to E too. So a vertex is (H - gz - E): drawn = H - gz - E + gz = H - E, the node at its
    // own measured height in the map's frame. Without E the wire floated E metres up once E was set (Walk: a band overhead).
    const gz = terrainAt(f.anchor.lon, f.anchor.lat), E = elevNow(), base = gz + E;
    const H = new Float32Array(N * N), seg = new Int32Array(N * N).fill(-1);
    for (let b = 0; b < N; b++) for (let a = 0; a < N; a++) H[b * N + a] = hAt(t.dtm, a * STEP + STEP / 2, b * STEP + STEP / 2);
    // NEAR LIFT (r8): within LIFT_M of the walker, a node the map DEM covers is drawn at max(DTM, DEM), because the
    // coarse DEM mesh sits up to ~2 m over the 1 m DTM there and at eye height no depth bias can see under it (r6, r7).
    // (plus LIFT_CLEAR, so the lifted line is not coplanar with the DEM mesh)
    // Every segment touching a lifted node is ESTIMATED (drawn at the DEM, not where it was measured), so it goes to a
    // separate ghost block drawn DOTTED; nodes at their measured height stay in the solid measured block.
    const Z = new Float32Array(H), lift = new Uint8Array(N * N), wk = walker(); let nLift = 0;
    if (wk) {
      const a0 = Math.max(0, Math.floor((wk.e - t.tile.e0 - LIFT_M) / STEP)), a1 = Math.min(N - 1, Math.ceil((wk.e - t.tile.e0 + LIFT_M) / STEP));
      const b0 = Math.max(0, Math.floor((wk.n - t.tile.n0 - LIFT_M) / STEP)), b1 = Math.min(N - 1, Math.ceil((wk.n - t.tile.n0 + LIFT_M) / STEP));
      for (let b = b0; b <= b1; b++) for (let a = a0; a <= a1; a++) {
        const k = b * N + a, e = t.tile.e0 + a * STEP + STEP / 2 + 0.5, n = t.tile.n0 + b * STEP + STEP / 2 + 0.5;
        if (!Number.isFinite(H[k]) || Math.hypot(e - wk.e, n - wk.n) > LIFT_M) continue;
        const g = P.fromBng(e, n), d = demAt(g.lon, g.lat);
        if (d != null && d + LIFT_CLEAR > H[k]) { Z[k] = Math.max(H[k], d + LIFT_CLEAR); lift[k] = 1; nLift++; }
      }
    }
    const X = (a, b) => { const c = STEP / 2, p = f.xy(t.tile.e0 + a * STEP + c + 0.5, t.tile.n0 + b * STEP + c + 0.5); return [p[0], p[1], Z[b * N + a] - base]; };
    const L = [], G = []; let gSegs = 0;
    const ghost = (p, q) => { gSegs++; for (let s = 0; s < DOTS; s++) { const u = s / DOTS, v = (s + 0.5) / DOTS; // dotted: half of each 1/DOTS step drawn
      G.push([p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u, p[2] + (q[2] - p[2]) * u, p[0] + (q[0] - p[0]) * v, p[1] + (q[1] - p[1]) * v, p[2] + (q[2] - p[2]) * v]); } };
    for (let b = 0; b < N; b++) for (let a = 0; a < N; a++) {
      if (!Number.isFinite(H[b * N + a])) continue; const p = X(a, b), k0 = L.length, lp = lift[b * N + a];
      if (a + 1 < N && Number.isFinite(H[b * N + a + 1])) { const q = X(a + 1, b); if (lp || lift[b * N + a + 1]) ghost(p, q); else L.push([p[0], p[1], p[2], q[0], q[1], q[2]]); }
      if (b + 1 < N && Number.isFinite(H[(b + 1) * N + a])) { const q = X(a, b + 1); if (lp || lift[(b + 1) * N + a]) ghost(p, q); else L.push([p[0], p[1], p[2], q[0], q[1], q[2]]); }
      if (L.length > k0) seg[b * N + a] = k0;
    }
    t.gz = gz; t.E = E; t.H = H; t.seg = seg; t.N = N; t.anchor = f.anchor; t.wk = wk; t.lifted = nLift;
    t.blks.push({ lon: f.anchor.lon, lat: f.anchor.lat, anchor: f.anchor, lines: L, buf: P.wireBuffer(f.anchor, L), lidarStream: key,
      prov: 'measured', receipt: t.dtm.sha, kind: 'ground', gz, E });
    if (G.length) t.blks.push({ lon: f.anchor.lon, lat: f.anchor.lat, anchor: f.anchor, lines: G, buf: P.wireBuffer(f.anchor, G), lidarStream: key,
      prov: 'estimated', style: 'ghost', segs: gSegs, receipt: t.dtm.sha, kind: 'ground', lifted: nLift, gz, E });
    t.segs = L.length + gSegs;
    if (t.dsm && !t.dsm.none && !t.dsm.pending) {
      const O = []; let n = 0;
      for (let b = 0; b < N; b++) for (let a = 0; a < N; a++) {
        let top = -Infinity, gi = NaN;
        for (let v = 0; v < STEP; v++) for (let u = 0; u < STEP; u++) {
          const i = a * STEP + u, j = b * STEP + v, s = hAt(t.dsm, i, j), g = hAt(t.dtm, i, j);
          if (Number.isFinite(s) && Number.isFinite(g) && s - g > top) { top = s - g; gi = g; }
        }
        if (!(top > ABOVE_M)) continue;
        n++;
        const p = f.xy(t.tile.e0 + a * STEP + STEP / 2 + 0.5, t.tile.n0 + b * STEP + STEP / 2 + 0.5), z0 = gi - base, z1 = z0 + top, d = 2;
        O.push([p[0], p[1], z0, p[0], p[1], z1],
          [p[0] - d, p[1] - d, z1, p[0] + d, p[1] - d, z1], [p[0] + d, p[1] - d, z1, p[0] + d, p[1] + d, z1],
          [p[0] + d, p[1] + d, z1, p[0] - d, p[1] + d, z1], [p[0] - d, p[1] + d, z1, p[0] - d, p[1] - d, z1]);
      }
      t.objects = n;
      if (O.length) t.blks.push({ lon: f.anchor.lon, lat: f.anchor.lat, anchor: f.anchor, lines: O, buf: P.wireBuffer(f.anchor, O), lidarStream: key,
        prov: 'derived', receipt: t.dsm.sha, kind: 'above-ground', gz, E });
    }
    sync();
  }

  // LAYER ORDER. Wire and Dark: the blocks ride the overlay's solid wire layer, as before. Satellite: they move to this
  // module's own layer, drawn above the imagery in the same colour (still solid, continuous lines = measured) but at
  // alpha SAT_ALPHA with no depth write, so the satellite stays visible through the 8 m grid at close range.
  // DEPTH_BIAS (r3): the map DEM is coarser than the 1 m DTM and sits up to ~2 m above measured nodes at the walker, so
  // a plain depth test hid the near wire at grazing angles. The bias moves only the depth (NDC z, same for x and y, so
  // every line stays exactly where it was measured on screen); in metres it grows with distance, and hills still hide.
  // r5: 0.0006 let 60/3,993 nodes behind a synthetic 180 m ridge show at the crest (1.5 %); 0.0005 draws 2 (0.05 %),
  // with 2,288/2,301 visible far nodes still drawn (tests/lidar-stream.cjs, ridge check).
  // r6 (near check, DEM 2 m over DTM, eye ~3.4 m over DTM): nodes 20-300 m that clear the DTM by >= 3 m are all drawn
  // (70/70 at 0.0004-0.0006, 0/70 with no bias), but only ~56 % of the foreground (716/1,274) is drawn at 0.0005: a
  // constant NDC bias is a few cm near the eye, so the nearest wire under a raised DEM is still lost (fixed r8: NEAR LIFT).
  // r7: a metric pull (depth taken 2.5 m toward the eye, x/y unpulled) was tried and REVERTED: ridge 0/3,993 hidden and
  // 2,285/2,301 visible, but near 0/70 visible and 0/1,274 foreground. At eye height the ray meets a DEM 2 m high tens
  // of metres before the node, so any fixed pull along the ray is far too short; the fix is geometry, not depth.
  const SAT_ALPHA = 0.35, sat = [], DEPTH_BIAS = 0.0005;
  const satMode = () => { const m = window.SIM.map; return !!(m.getSource && m.getSource('sat')); };
  const layer = { id: 'lidar-stream-sat', type: 'custom', renderingMode: '3d',
    onAdd(m, gl) { const sh = (ty, src) => { const o = gl.createShader(ty); gl.shaderSource(o, src); gl.compileShader(o); return o; };
      this.pr = gl.createProgram();
      gl.attachShader(this.pr, sh(gl.VERTEX_SHADER, 'uniform mat4 u; uniform float k; attribute vec3 p; void main(){ gl_Position = u * vec4(p, 1.0); gl_Position.z -= k * gl_Position.w; }'));
      gl.attachShader(this.pr, sh(gl.FRAGMENT_SHADER, 'precision mediump float; uniform vec4 c; void main(){ gl_FragColor = c; }'));
      gl.linkProgram(this.pr); this.vbo = new WeakMap(); },
    render(gl, args) {
      if (!sat.length) return;
      const m = (args && args.defaultProjectionData && args.defaultProjectionData.mainMatrix) || args, P = PF(), loc = gl.getAttribLocation(this.pr, 'p');
      gl.useProgram(this.pr); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
      gl.uniform4f(gl.getUniformLocation(this.pr, 'c'), 0.55, 0.9, 1.0, SAT_ALPHA); gl.uniform1f(gl.getUniformLocation(this.pr, 'k'), DEPTH_BIAS);
      for (const b of sat) {
        let v = this.vbo.get(b); if (!v) { v = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, v); gl.bufferData(gl.ARRAY_BUFFER, b.buf, gl.STATIC_DRAW); this.vbo.set(b, v); }
        const o = P.toMercator(b.anchor.lat, b.anchor.lon, b.gz + (b.E || 0) - elevNow()), r = new Float32Array(m); // build lift, kept in the live frame as E moves
        for (let k = 0; k < 4; k++) r[12 + k] = m[k] * o.x + m[4 + k] * o.y + m[8 + k] * o.z + m[12 + k];
        gl.bindBuffer(gl.ARRAY_BUFFER, v); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
        gl.uniformMatrix4fv(gl.getUniformLocation(this.pr, 'u'), false, r); gl.drawArrays(gl.LINES, 0, b.buf.length / 3);
      }
      gl.depthMask(true);
    } };
  function sync() {
    const S = window.SIM, s = satMode();
    S.removeWhere(b => b.lidarStream); sat.length = 0;
    for (const t of tiles.values()) for (const b of t.blks || []) if (s) sat.push(b); else S.addBlock(b);
    try { if (!S.map.getLayer(layer.id)) S.map.addLayer(layer); } catch (e) { /* style still loading; style.load re-adds */ }
    S.repaint();
  }
  // The one-line receipt never covers a caption: it starts just above the attribution strip and steps up above any
  // VISIBLE caption it would touch (#where, #sim-note, the pylon and procedural captions, anything fixed at the foot).
  function captions() {
    const out = [];
    for (const el of document.body.querySelectorAll('body > *, body > * > [id]')) {
      if (el === box || box.contains(el) || el.id === 'sim-menu' || el.tagName === 'SCRIPT' || !el.textContent.trim()) continue;
      const cs = getComputedStyle(el); if (cs.position !== 'fixed' && cs.position !== 'absolute') continue;
      if (el.checkVisibility && !el.checkVisibility({ checkOpacityProperty: true, checkVisibilityCSS: true })) continue;
      const r = el.getBoundingClientRect(); if (r.width > 0 && r.height > 0 && r.top > innerHeight / 2) out.push(r);
    }
    return out;
  }
  function place() {
    if (!box) return;
    let bottom = 0; const cs = captions();
    for (let k = 0; k < 12; k++) {
      box.style.bottom = bottom + 'px';
      const a = line.getBoundingClientRect(), hit = cs.find(c => a.left < c.right && c.left < a.right && a.top < c.bottom && c.top < a.bottom);
      if (!hit) break; bottom = Math.ceil(innerHeight - hit.top + 3);
    }
  }
  async function fetchProduct(key, k) {
    const t = tiles.get(key), src = R5.SOURCES[k], b = R5.clip(t.tile, src.env);
    if (!b) { t[k] = { none: 'outside the service envelope' }; return; }
    if (!pacer.take()) return; // caller checked why() first
    saveDay();
    const url = R5.wcsUrl(src, b), at = new Date().toISOString(); let status = 0;
    t[k] = { pending: 'streaming...' }; show();
    try {
      const res = await (fetchImpl || fetch)(url, { mode: 'cors' }); status = res.status;
      if (!res.ok) throw Error(`HTTP ${res.status}${res.status === 403 || res.status === 429 ? ', refused; pausing' : ''}`);
      const geo = await R5.decodeGeoTiff(await res.arrayBuffer()), m = R5.measuredMask(geo);
      if (!m.valid) { t[k] = { none: 'no survey: sea, not flown, or a border (exact zeros)' }; return; }
      const sha = await R5.cellSha256(geo.data, crypto.subtle);
      t[k] = { src, box: b, url, at, geo, mask: m.mask, valid: m.frac, sha, tile: t.tile };
    } catch (e) {
      // Status 0 = the request never got an HTTP answer (network, abort, or a response the browser refused). One retry,
      // in this arrival only, through the pacer (40 s gap); movement never triggers it. 403/429 go to the pause via done().
      const reason = (e && e.message) || 'network error';
      t.tries = t.tries || {};
      if (status === 0 && !t.tries[k]) { t.tries[k] = 1; t[k] = null; t.retryNote = `${k.toUpperCase()} fetch failed (${reason}); retrying once`; }
      else if (status === 0) t[k] = { none: `${k.toUpperCase()} fetch failed (${reason}); no measured ground shown`, failed: true };
      else t[k] = { none: e.message };
    } finally { pacer.done(status); if (gapOverride != null) pacer.state.next = Date.now() + gapOverride; }
  }

  function step() {
    clearTimeout(timer); timer = null;
    const t = current && tiles.get(current);
    if (!t || !on) return;
    const need = !t.dtm ? 'dtm' : (!t.dsm && t.dtm && !t.dtm.none && !t.dtm.pending) ? 'dsm' : null;
    if (!need) { t.status = t.dtm && t.dtm.failed ? t.dtm.none : t.dtm && t.dtm.none ? 'no measured ground here' : 'complete'; show(); return; }
    const why = pacer.why(), retry = t.tries && t.tries[need] ? `${t.retryNote}: ` : '';
    if (why) {
      t.status = `${retry}${need.toUpperCase()} ${why}`; show();
      if (!pacer.state.stopped && !/daily cap/.test(why)) timer = setTimeout(step, 1000);
      return;
    }
    t.status = `${retry}streaming the ${need.toUpperCase()}`; show();
    const key = current;
    fetchProduct(key, need).then(() => { draw(key); if (current === key) step(); show(); });
  }

  // ARRIVAL: the only place that may start a fetch (R5 rule 6). Stored wireframe first (rule 5).
  function arrive(why) {
    if (!on || !R5) return null;
    const S = window.SIM, P = PF(), c = S.map.getCenter(), g = P.toBng(c.lat, c.lng), tile = R5.tileOf(g.e, g.n);
    current = tile.key;
    if (!tiles.has(tile.key)) tiles.set(tile.key, { tile, dtm: null, dsm: null, status: `arrived (${why})` });
    const t = tiles.get(tile.key);
    if (!R5.clip(tile, R5.SOURCES.dtm.env)) { t.dtm = { none: 'outside the EA LiDAR envelope (England only)' }; t.status = 'no measured ground here'; }
    // The arrival line lives only in this module's own receipt panel; #info (the landing caption) is never touched.
    t.arrived = `Arrived (${why}): measured ground for tile ${tile.e0} E ${tile.n0} N streams here; moving never fetches.`;
    show(); step(); return tile;
  }

  wait(async () => {
    const S = window.SIM;
    R5 = await import(new URL('lidar-stream/r5.mjs', HERE).href);
    pacer = R5.createPacer({ used: dayUsed() });
    btn = S.addButton ? S.addButton('Stream ground', () => arrive('button')) : null;
    // Arrival hooks, no edits to the overlay: a flyTo (find/go) that ends, and the Walk, Drone and Build here buttons.
    const fly = S.map.flyTo.bind(S.map);
    S.map.flyTo = (...a) => { arriving = true; return fly(...a); };
    S.map.on('style.load', sync);
    const inf = document.getElementById('info'); if (inf && window.MutationObserver) new MutationObserver(place).observe(inf, { childList: true, characterData: true, subtree: true });
    addEventListener('resize', place); setInterval(place, 1000); // captions come and go (the 8 s note); cheap
    addEventListener('keydown', e => { if (e.key === 'Escape' && open) setOpen(false); });
    S.map.on('idle', () => { for (const [k, t] of tiles) { const w = walker(), moved = w && (!t.wk || Math.hypot(w.e - t.wk.e, w.n - t.wk.n) > STEP);
      if (t.H && (moved || Math.abs(terrainAt(t.anchor.lon, t.anchor.lat) - t.gz) > 0.01 || Math.abs(elevNow() - (t.E || 0)) > 0.01)) draw(k); } });
    S.map.on('moveend', () => { if (arriving) { arriving = false; arrive('find or go'); } });
    for (const [id, w] of [['walk', 'Walk'], ['drone', 'Drone'], ['here', 'Build here']]) {
      const el = document.getElementById(id); if (el) el.addEventListener('click', () => setTimeout(() => arrive(w), 1200));
    }
    show();
    window.__lidarStream = {
      arrive, tiles, heightAt, probe, pacer: () => pacer.state, R5: () => R5,
      // Tests and local checks only: serve a fixture instead of the EA; the gap may be shortened ONLY with a fixture.
      useFixture(fn, gapMs) { fetchImpl = fn; gapOverride = gapMs == null ? null : gapMs; pacer.state.next = 0; },
      segs: () => [...tiles.values()].flatMap(t => t.blks || []).reduce((s, b) => s + b.lines.length, 0),
      layer: () => ({ satellite: satMode(), own: sat.length, inWire: S.blocks.filter(b => b.lidarStream).length, alpha: SAT_ALPHA, onMap: !!S.map.getLayer(layer.id) }),
      line: () => { panel(); return { text: line.textContent, rect: line.getBoundingClientRect().toJSON(), open }; }, setOpen, place,
      blocks: () => [...tiles.values()].flatMap(t => t.blks || []).map(b => ({ kind: b.kind, prov: b.prov, style: b.style || 'solid', segs: b.segs || b.lines.length, lifted: b.lifted || 0, receipt: b.receipt, lat: b.lat, lon: b.lon, n: b.lines.length })),
      receipt: () => panel().textContent  // the full receipt (shown on click)
    };
  });
})();
