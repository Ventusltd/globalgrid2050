// mod/perf.js - the wire layer, made light (plain script; attaches to window.SIM).
// What it changes, and only in the wire layer's render:
//  1. One GPU buffer per block, uploaded ONCE (STATIC_DRAW) and kept until the block changes. A block counts as
//     changed when its Float32Array `buf` is a different object or length, or when its `rev` number changes
//     (a module that edits b.buf in place sets b.rev++). Buffers of removed blocks are deleted.
//  2. The anchor's Mercator point and ground height are cached per block, not recomputed every frame. Heights are
//     re-read after terrain tiles arrive (map 'idle' / 'terrain'), at most 300 queries per frame.
//  3. Blocks outside the view are skipped (a bounding sphere against the six frustum planes).
//  4. Shader locations are looked up once per program.
// Blocks that arrive as plain { lon, lat, lines } (no anchor/buf) are placed with place-frame.mjs, the same way
// overlay.html places its own, so any module can hand over bare metres.
// LEAD NOTES (overlay.html): (a) add 'perf' to mod/index.json; nothing else is required. Better still, fold this
// render into `wire` itself and drop the per-frame bufferData/getAttribLocation/getUniformLocation/queryTerrainElevation.
// (b) A module that edits b.buf in place must bump b.rev (or call SIM.perf.touch(b)); a new buf object is detected.
// (c) Phone size (390 px): #here-readout and #pf-readout sit over the 2nd/3rd button rows and intercept taps on
// "Rows from satellite"; #info covers the map attribution. (d) Measured 27 Sept, (local path)
(function () {
  'use strict';
  const MOD_URL = (document.currentScript && document.currentScript.src) || location.href;
  const R = 6371008.8, CIRC = 2 * Math.PI * R;                // MapLibre 4.7.1 sphere, as place-frame.mjs
  const mx = lon => (180 + lon) / 360;
  const my = lat => (180 - (180 / Math.PI * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)))) / 360;
  const mz = (alt, lat) => alt / (CIRC * Math.cos(lat * Math.PI / 180));
  const MAX_TERRAIN_QUERIES = 300;

  let PF = null;
  import(new URL('../place-frame.mjs', MOD_URL).href).then(m => { PF = m; if (window.SIM) SIM.repaint(); }).catch(() => {});

  function attach() {
    const SIM = window.SIM;
    if (!SIM || !SIM.wire || !SIM.map) return false;
    const map = SIM.map, wire = SIM.wire, blocks = SIM.blocks;
    if (wire.__perf) return true;
    const cache = new Map();            // block -> { gl, buf, src, len, rev, n, ox, oy, oz, gz, r, lat, lon }
    const progInfo = new WeakMap();     // program -> { loc, u }
    let terrainEpoch = 1;
    const stats = { frames: 0, uploads: 0, uploadBytes: 0, draws: 0, culled: 0, lastMs: 0, sumMs: 0, deleted: 0 };
    const mat = new Float32Array(16), planes = new Float64Array(24);

    const bumpTerrain = () => { terrainEpoch++; map.triggerRepaint(); };
    // Re-read heights only when new terrain tiles have arrived (a flag set by the DEM source), on the next 'idle'.
    let demDirty = false;
    map.on('sourcedata', ev => { if (ev.tile && ev.source && ev.source.type === 'raster-dem') demDirty = true; });
    map.on('idle', () => { if (demDirty) { demDirty = false; bumpTerrain(); } });
    map.on('terrain', bumpTerrain);

    // Bring a bare { lon, lat, lines } block up to the overlay's shape (anchor + anchor-relative Mercator buf).
    function ensurePlaced(b) {
      if (b.anchor && b.buf) return true;
      if (!PF || !b.lines) return false;
      const anchor = PF.placeKey(b.lat, b.lon), off = PF.toLocal(anchor, b.lat, b.lon, 0);
      const L = (off.x || off.y) ? b.lines.map(([a, c, d, e, f, g]) => [a + off.x, c + off.y, d, e + off.x, f + off.y, g]) : b.lines;
      b.anchor = anchor; b.buf = PF.wireBuffer(anchor, L);
      return true;
    }

    function entryFor(gl, b) {
      let e = cache.get(b);
      const v = b.buf, rev = b.rev || 0;
      if (e && e.gl === gl && e.src === v && e.len === v.length && e.rev === rev) return e;
      if (!e || e.gl !== gl) { e = { gl, buf: gl.createBuffer(), gzEpoch: 0 }; cache.set(b, e); }
      gl.bindBuffer(gl.ARRAY_BUFFER, e.buf);
      gl.bufferData(gl.ARRAY_BUFFER, v, gl.STATIC_DRAW);
      stats.uploads++; stats.uploadBytes += v.byteLength;
      e.src = v; e.len = v.length; e.rev = rev; e.n = v.length / 3;
      // Bounding sphere radius in Mercator units (vertices are already anchor-relative).
      let r2 = 0; for (let i = 0; i < v.length; i += 3) { const d = v[i] * v[i] + v[i + 1] * v[i + 1] + v[i + 2] * v[i + 2]; if (d > r2) r2 = d; }
      const a = b.anchor; e.lat = a.lat; e.lon = a.lon; e.ox = mx(a.lon); e.oy = my(a.lat);
      e.r = Math.sqrt(r2) + mz(80, a.lat);           // + 80 m of slack for terrain height
      e.gzEpoch = 0;
      return e;
    }

    // Frustum planes from the column-major view-projection matrix (Gribb and Hartmann).
    function extractPlanes(m) {
      const row = i => [m[i], m[4 + i], m[8 + i], m[12 + i]];
      const r0 = row(0), r1 = row(1), r2 = row(2), r3 = row(3);
      const P = [[0, 1], [0, -1], [1, 1], [1, -1], [2, 1], [2, -1]];
      const rows = [r0, r1, r2];
      for (let k = 0; k < 6; k++) {
        const s = P[k][1], rr = rows[P[k][0]];
        let a = r3[0] + s * rr[0], b = r3[1] + s * rr[1], c = r3[2] + s * rr[2], d = r3[3] + s * rr[3];
        const n = Math.hypot(a, b, c) || 1;
        planes[4 * k] = a / n; planes[4 * k + 1] = b / n; planes[4 * k + 2] = c / n; planes[4 * k + 3] = d / n;
      }
    }
    const visible = (x, y, z, r) => {
      for (let k = 0; k < 6; k++) if (planes[4 * k] * x + planes[4 * k + 1] * y + planes[4 * k + 2] * z + planes[4 * k + 3] < -r) return false;
      return true;
    };

    wire.render = function (gl, args) {
      const t0 = performance.now();
      const m = (args && args.defaultProjectionData && args.defaultProjectionData.mainMatrix) || args;
      const pr = this.pr; if (!pr) return;
      let pi = progInfo.get(pr);
      if (!pi) { pi = { loc: gl.getAttribLocation(pr, 'p'), u: gl.getUniformLocation(pr, 'u') }; progInfo.set(pr, pi); }
      gl.useProgram(pr); gl.enableVertexAttribArray(pi.loc);
      extractPlanes(m);
      const hasTerrain = !!(map.getTerrain && map.getTerrain() && map.queryTerrainElevation);
      let q = 0, draws = 0, culled = 0;
      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];
        if (!ensurePlaced(b) || !b.buf.length) continue;
        const e = entryFor(gl, b); e.seen = stats.frames;
        if (e.gzEpoch !== terrainEpoch && q < MAX_TERRAIN_QUERIES) {
          e.gz = hasTerrain ? (map.queryTerrainElevation([e.lon, e.lat]) || 0) : 0; e.gzEpoch = terrainEpoch; q++;
          e.oz = mz(e.gz, e.lat);
        }
        const ox = e.ox, oy = e.oy, oz = e.oz || 0;
        if (!visible(ox, oy, oz, e.r)) { culled++; continue; }
        for (let k = 0; k < 4; k++) { mat[k] = m[k]; mat[4 + k] = m[4 + k]; mat[8 + k] = m[8 + k]; mat[12 + k] = m[k] * ox + m[4 + k] * oy + m[8 + k] * oz + m[12 + k]; }
        gl.bindBuffer(gl.ARRAY_BUFFER, e.buf);
        gl.vertexAttribPointer(pi.loc, 3, gl.FLOAT, false, 0, 0);
        gl.uniformMatrix4fv(pi.u, false, mat);
        gl.drawArrays(gl.LINES, 0, e.n); draws++;
      }
      if (q >= MAX_TERRAIN_QUERIES) map.triggerRepaint();   // more heights still to read next frame
      // Sweep buffers of removed blocks (cheap: only when the cache outgrows the list, or every 2 s).
      if (cache.size > blocks.length || stats.frames % 120 === 0) {
        for (const [b, e] of cache) if (e.seen !== stats.frames) { e.gl.deleteBuffer(e.buf); cache.delete(b); stats.deleted++; }
      }
      stats.frames++; stats.draws = draws; stats.culled = culled;
      const dt = performance.now() - t0; stats.lastMs = dt; stats.sumMs += dt;
    };
    wire.__perf = true;
    SIM.perf = {
      stats: () => Object.assign({ buffers: cache.size, blocks: blocks.length, meanRenderMs: stats.frames ? stats.sumMs / stats.frames : 0 }, stats),
      reset: () => { stats.frames = 0; stats.uploads = 0; stats.uploadBytes = 0; stats.sumMs = 0; stats.deleted = 0; },
      touch: b => { b.rev = (b.rev || 0) + 1; map.triggerRepaint(); }          // call after editing b.buf in place
    };
    map.triggerRepaint();
    return true;
  }
  if (!attach()) { let n = 0; const t = setInterval(() => { if (attach() || ++n > 100) clearInterval(t); }, 100); }
})();
