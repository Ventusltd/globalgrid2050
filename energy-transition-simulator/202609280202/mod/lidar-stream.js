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

  function panel() {
    if (box) return box;
    box = document.createElement('div'); box.id = 'lidar-stream-receipt';
    box.style.cssText = 'position:absolute;left:8px;bottom:8px;z-index:3;max-width:min(560px,calc(100vw - 32px));font:11px/1.35 monospace;color:#dfe;background:rgba(0,0,0,.72);padding:6px 8px;border-radius:6px;white-space:pre-wrap;word-break:break-all';
    document.body.appendChild(box); return box;
  }
  function show() { showText(); place(); }
  function showText() {
    const t = current && tiles.get(current), P = PF();
    if (!t) { panel().textContent = 'Measured ground (R5): arrive somewhere to stream its 2,048 m tile.'; return; }
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
        const g = P.fromBng(e, nn), mz = blk.buf[6 * t.seg[k] + 2] + P.toMercator(t.anchor.lat, t.anchor.lon, gzNow).z;
        const drawn = mz / P.toMercator(g.lat, g.lon, 1).z, truth = heightAt(e, nn);
        out.push({ e, n: nn, drawn, truth: truth.h, D: drawn - truth.h, demD: demAt(g.lon, g.lat) == null ? null : demAt(g.lon, g.lat) - truth.h, receipt: truth.receipt });
      }
    }
    const D = out.map(o => Math.abs(o.D)), exaggeration = exag(), dm = out.filter(o => o.demD != null), M = dm.map(o => Math.abs(o.demD));
    return { nodes: out.length, maxAbsD: Math.max(...D), meanD: out.reduce((s, o) => s + o.D, 0) / (out.length || 1),
      demNodes: dm.length, maxAbsDemD: M.length ? Math.max(...M) : null, meanDemD: dm.length ? dm.reduce((s, o) => s + o.demD, 0) / dm.length : null, receipt: out[0] && out[0].receipt, exaggeration, sample: out.slice(0, 3) };
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
    const gz = terrainAt(f.anchor.lon, f.anchor.lat);
    const H = new Float32Array(N * N), seg = new Int32Array(N * N).fill(-1);
    for (let b = 0; b < N; b++) for (let a = 0; a < N; a++) H[b * N + a] = hAt(t.dtm, a * STEP + STEP / 2, b * STEP + STEP / 2);
    const X = (a, b) => { const c = STEP / 2, p = f.xy(t.tile.e0 + a * STEP + c + 0.5, t.tile.n0 + b * STEP + c + 0.5); return [p[0], p[1], H[b * N + a] - gz]; };
    const L = [];
    for (let b = 0; b < N; b++) for (let a = 0; a < N; a++) {
      if (!Number.isFinite(H[b * N + a])) continue; const p = X(a, b), k0 = L.length;
      if (a + 1 < N && Number.isFinite(H[b * N + a + 1])) { const q = X(a + 1, b); L.push([p[0], p[1], p[2], q[0], q[1], q[2]]); }
      if (b + 1 < N && Number.isFinite(H[(b + 1) * N + a])) { const q = X(a, b + 1); L.push([p[0], p[1], p[2], q[0], q[1], q[2]]); }
      if (L.length > k0) seg[b * N + a] = k0;
    }
    t.gz = gz; t.H = H; t.seg = seg; t.N = N; t.anchor = f.anchor;
    t.blks.push({ lon: f.anchor.lon, lat: f.anchor.lat, anchor: f.anchor, lines: L, buf: P.wireBuffer(f.anchor, L), lidarStream: key,
      prov: 'measured', receipt: t.dtm.sha, kind: 'ground', gz });
    t.segs = L.length;
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
        const p = f.xy(t.tile.e0 + a * STEP + STEP / 2 + 0.5, t.tile.n0 + b * STEP + STEP / 2 + 0.5), z0 = gi - gz, z1 = z0 + top, d = 2;
        O.push([p[0], p[1], z0, p[0], p[1], z1],
          [p[0] - d, p[1] - d, z1, p[0] + d, p[1] - d, z1], [p[0] + d, p[1] - d, z1, p[0] + d, p[1] + d, z1],
          [p[0] + d, p[1] + d, z1, p[0] - d, p[1] + d, z1], [p[0] - d, p[1] + d, z1, p[0] - d, p[1] - d, z1]);
      }
      t.objects = n;
      if (O.length) t.blks.push({ lon: f.anchor.lon, lat: f.anchor.lat, anchor: f.anchor, lines: O, buf: P.wireBuffer(f.anchor, O), lidarStream: key,
        prov: 'derived', receipt: t.dsm.sha, kind: 'above-ground', gz });
    }
    sync();
  }

  // LAYER ORDER. Wire and Dark: the blocks ride the overlay's solid wire layer, as before. Satellite: they move to this
  // module's own layer, drawn above the imagery in the same colour (still solid, continuous lines = measured) but at
  // alpha SAT_ALPHA with no depth write, so the satellite stays visible through the 8 m grid at close range.
  const SAT_ALPHA = 0.35, sat = [];
  const satMode = () => { const m = window.SIM.map; return !!(m.getSource && m.getSource('sat')); };
  const layer = { id: 'lidar-stream-sat', type: 'custom', renderingMode: '3d',
    onAdd(m, gl) { const sh = (ty, src) => { const o = gl.createShader(ty); gl.shaderSource(o, src); gl.compileShader(o); return o; };
      this.pr = gl.createProgram();
      gl.attachShader(this.pr, sh(gl.VERTEX_SHADER, 'uniform mat4 u; attribute vec3 p; void main(){ gl_Position = u * vec4(p, 1.0); }'));
      gl.attachShader(this.pr, sh(gl.FRAGMENT_SHADER, 'precision mediump float; uniform vec4 c; void main(){ gl_FragColor = c; }'));
      gl.linkProgram(this.pr); this.vbo = new WeakMap(); },
    render(gl, args) {
      if (!sat.length) return;
      const m = (args && args.defaultProjectionData && args.defaultProjectionData.mainMatrix) || args, P = PF(), loc = gl.getAttribLocation(this.pr, 'p');
      gl.useProgram(this.pr); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
      gl.uniform4f(gl.getUniformLocation(this.pr, 'c'), 0.55, 0.9, 1.0, SAT_ALPHA);
      for (const b of sat) {
        let v = this.vbo.get(b); if (!v) { v = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, v); gl.bufferData(gl.ARRAY_BUFFER, b.buf, gl.STATIC_DRAW); this.vbo.set(b, v); }
        const o = P.toMercator(b.anchor.lat, b.anchor.lon, b.gz), r = new Float32Array(m); // the lift the buffer was built with (as perf.js caches it)
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
  // The receipt panel sits above the landing caption (#info, which carries the pylons line); never over it.
  function place() {
    const inf = document.getElementById('info'); if (!box) return;
    box.style.bottom = '8px';
    if (!inf || !inf.textContent.trim() || inf.offsetParent === null) return;
    const a = box.getBoundingClientRect(), c = inf.getBoundingClientRect();
    if (a.left < c.right && c.left < a.right && a.top < c.bottom && c.top < a.bottom) box.style.bottom = Math.ceil(innerHeight - c.top + 6) + 'px';
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
    addEventListener('resize', place);
    S.map.on('idle', () => { for (const [k, t] of tiles) if (t.H && Math.abs(terrainAt(t.anchor.lon, t.anchor.lat) - t.gz) > 0.01) draw(k); });
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
      overlap: () => { const inf = document.getElementById('info'), a = panel().getBoundingClientRect(), c = inf ? inf.getBoundingClientRect() : null;
        return { receipt: a.toJSON(), info: c && c.toJSON(), overlaps: !!c && a.left < c.right && c.left < a.right && a.top < c.bottom && c.top < a.bottom }; },
      blocks: () => [...tiles.values()].flatMap(t => t.blks || []).map(b => ({ kind: b.kind, prov: b.prov, receipt: b.receipt, lat: b.lat, lon: b.lon, n: b.lines.length })),
      receipt: () => panel().textContent
    };
  });
})();
