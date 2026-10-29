// mod/wire-look.js - the morning site world's wire look inside the overlay's map camera.
// Plain script; load it after perf.js (menu-bar.js stays last). It changes only how lines are drawn:
//  1. Colour: #9cdbff hairlines (alpha 0.42 on the Wire and Dark ground, 0.85 over satellite imagery, where a
//     faint line would vanish into the photo), premultiplied, never full-bright to the horizon.
//  2. Fade: every line fades with distance beyond where you stand, as the site world's shader does
//     (world/lines.mjs: v_a = clamp(1 - d / u_fade)), with the fade distance from world/fade.mjs: 450 m on foot,
//     growing 2.5 m per metre of height, to 4 km. Here d is the view depth past the map centre (the overlay's
//     camera stands behind the viewer), because the overlay's blocks are drawn without a per-block eye offset.
//  3. Ground: with Survey on (Wire turns it on), world/layers/ground-grid.mjs draws the 1 m grid to 30 m and the
//     10 m grid to 400 m, draped on the map's terrain, following the viewer in 10 m cells; the overlay's flat
//     600 m sheet is taken out while it shows.
// The towers, conductors and every other block keep their own geometry; only the colour and the fade change.
// The world files are carried from the site-world release (see their headers). Test hook: SIM.wireLook.stats().
(function () {
  'use strict';
  const BASE = (document.currentScript && document.currentScript.src) || location.href;
  const LINE = [156 / 255, 219 / 255, 1];
  const C = 2 * Math.PI * 6371008.8;                              // MapLibre's sphere, as place-frame.mjs
  const st = { frames: 0, fadeM: 0, mode: '', alpha: 0, minorSegments: 0, majorSegments: 0, minorRadiusM: 30, gridOn: false, err: '' };
  const override = { fadeM: 0 };                                 // test hook: SIM.wireLook.set({ fadeM })
  let fadeFor = (v, h) => Math.min(4000, 450 + Math.max(0, h) * 2.5), grid = null;

  Promise.all([import(new URL('../world/fade.mjs', BASE).href), import(new URL('../world/layers/ground-grid.mjs', BASE).href)])
    .then(([fade, gg]) => { fadeFor = fade.fadeFor; grid = gg.default; wait(0); })
    .catch(e => { st.err = String(e && e.message || e); wait(0); });

  function wait(n) { const S = window.SIM; if (S && S.wire && S.map && (S.PF || window.__pf)) init(S); else if (n < 400) setTimeout(() => wait(n + 1), 50); }

  const VS = 'uniform mat4 u; uniform float u_near; uniform float u_fade; attribute vec3 p; varying float v_a;'
    + 'void main(){ gl_Position = u * vec4(p, 1.0); v_a = clamp(1.0 - max(gl_Position.w - u_near, 0.0) / u_fade, 0.0, 1.0); }';
  const FS = 'precision mediump float; uniform vec4 u_c; varying float v_a;'
    + 'void main(){ float a = u_c.a * v_a; gl_FragColor = vec4(u_c.rgb * a, a); }';
  function program(gl) {
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; };
    const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw Error('wire-look shader: ' + gl.getProgramInfoLog(pr));
    return { pr, p: gl.getAttribLocation(pr, 'p'), u: gl.getUniformLocation(pr, 'u'), near: gl.getUniformLocation(pr, 'u_near'),
      fade: gl.getUniformLocation(pr, 'u_fade'), c: gl.getUniformLocation(pr, 'u_c') };
  }

  function init(S) {
    if (S.wireLook) return;
    const map = S.map, wire = S.wire, PF = S.PF || window.__pf.PF;
    const on = id => { const e = document.getElementById(id); return !!(e && e.classList.contains('on')); };
    const baseStyle = () => on('wire') ? 'wire' : on('dark') ? 'dark' : 'sat';
    const viewMode = () => on('walk') ? 'walk' : on('drone') ? 'drone' : 'map';

    // The fade for this frame, in the clip-space w units of MapLibre's camera (pixels of the world at this zoom).
    function frameFade() {
      const tr = map.transform, lat = map.getCenter().lat;
      const ppm = 512 * Math.pow(2, map.getZoom()) / (C * Math.cos(lat * Math.PI / 180));
      const camPx = tr && tr.cameraToCenterDistance ? tr.cameraToCenterDistance : 0.5 / Math.tan(0.6435 / 2) * map.getCanvas().clientHeight;
      const above = camPx / ppm * Math.cos(map.getPitch() * Math.PI / 180);
      const mode = viewMode(), fadeM = override.fadeM > 0 ? override.fadeM : mode === 'walk' ? fadeFor('standing', 0) : fadeFor('aerial', above);
      st.fadeM = Math.round(fadeM); st.mode = mode;
      return { near: camPx, fade: Math.max(1, fadeM * ppm) };
    }

    // 1 and 2: the blocks (whatever render perf.js or the overlay installed) drawn with the fading program.
    let P = null, inner = wire.render, frameF = null;
    const wrapped = function (gl, args) {
      try {
        if (!P || P.gl !== gl) { P = program(gl); P.gl = gl; }
        if (this.pr !== P.pr) this.pr = P.pr;                           // onAdd makes a new plain program on each style
        frameF = frameFade();
        const a = baseStyle() === 'sat' ? 0.85 : 0.42; st.alpha = a;
        gl.useProgram(P.pr); gl.uniform1f(P.near, frameF.near); gl.uniform1f(P.fade, frameF.fade); gl.uniform4f(P.c, LINE[0], LINE[1], LINE[2], a);
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        st.frames++;
      } catch (e) { st.err = String(e.message || e); }
      return inner.call(this, gl, args);
    };
    const rewrap = () => { if (wire.render !== wrapped) { inner = wire.render; wire.render = wrapped; map.triggerRepaint(); } };
    rewrap();
    // perf.js may install its render after this mod (scripts load in any order): wrap whatever is current.
    let k = 0; const t = setInterval(() => { rewrap(); if (++k > 60) clearInterval(t); }, 250);

    // 3: the site world's ground grid, in local metres around an anchor near the viewer.
    let anchor = null, gv = 0, lastBump = 0;
    const cache = new Map();                                            // batch key -> { src, buf, n }
    if (grid && grid.init) grid.init({ invalidate: () => map.triggerRepaint() });
    const heightAt = (x, y) => { const g = PF.fromLocal(anchor, x, y, 0); const h = map.queryTerrainElevation ? map.queryTerrainElevation([g.lon, g.lat]) : 0; return Number.isFinite(h) ? h : 0; };
    let demDirty = false;
    map.on('sourcedata', e => { if (e.tile && e.source && e.source.type === 'raster-dem') demDirty = true; });
    map.on('idle', () => { if (demDirty && performance.now() - lastBump > 3000) { demDirty = false; lastBump = performance.now(); gv++; map.triggerRepaint(); } });
    const gridWanted = () => !!grid && on('survey') && map.getZoom() >= 16;

    const layer = {
      id: 'wire-look-grid', type: 'custom', renderingMode: '3d',
      onAdd(m, gl) { this.gl = gl; cache.clear(); },
      render(gl, args) {
        st.gridOn = gridWanted();
        if (!st.gridOn || !P || P.gl !== gl) return;
        // The overlay's flat sheet is replaced while the draped grid shows.
        if (S.blocks.some(b => b.ground)) { for (let i = S.blocks.length - 1; i >= 0; i--) if (S.blocks[i].ground) S.blocks.splice(i, 1); }
        const c = map.getCenter();
        if (!anchor || Math.abs(c.lat - anchor.lat) > 0.01 || Math.abs(c.lng - anchor.lon) > 0.015) { anchor = PF.placeKey(c.lat, c.lng); cache.clear(); gv++; }
        const pos = PF.toLocal(anchor, c.lat, c.lng, 0);
        let batches; try { batches = grid.lines({ pos: [pos.x, pos.y], heightAt, groundVersion: gv }); } catch (e) { st.err = String(e.message || e); return; }
        const m = (args && args.defaultProjectionData && args.defaultProjectionData.mainMatrix) || args;
        const f = frameF || frameFade();
        gl.useProgram(P.pr); gl.uniform1f(P.near, f.near); gl.uniform1f(P.fade, f.fade);
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
        gl.enableVertexAttribArray(P.p);
        for (const b of batches) {
          let e = cache.get(b.key);
          if (!e || e.src !== b.positions) {
            if (!e) { e = { buf: gl.createBuffer() }; cache.set(b.key, e); }
            gl.bindBuffer(gl.ARRAY_BUFFER, e.buf); gl.bufferData(gl.ARRAY_BUFFER, b.positions, gl.STATIC_DRAW);
            e.src = b.positions; e.n = b.positions.length / 3;
            if (b.key === 'ground-grid/minor') st.minorSegments = e.n / 2;
            if (b.key === 'ground-grid/major') st.majorSegments = e.n / 2;
          }
          // Model: origin (local metres, absolute height) to Mercator, then metres to Mercator units (y flips south).
          const o = b.origin || [0, 0, 0], g = PF.fromLocal(anchor, o[0], o[1], 0), M = PF.toMercator(g.lat, g.lon, o[2]);
          const s = 1 / (C * Math.cos(g.lat * Math.PI / 180));
          const mm = new Float32Array(16);
          for (let r = 0; r < 4; r++) {
            mm[r] = m[r] * s; mm[4 + r] = -m[4 + r] * s; mm[8 + r] = m[8 + r] * s;
            mm[12 + r] = m[r] * M.x + m[4 + r] * M.y + m[8 + r] * M.z + m[12 + r];
          }
          gl.uniformMatrix4fv(P.u, false, mm); gl.uniform4f(P.c, b.color[0], b.color[1], b.color[2], b.color[3]);
          gl.bindBuffer(gl.ARRAY_BUFFER, e.buf); gl.vertexAttribPointer(P.p, 3, gl.FLOAT, false, 0, 0);
          gl.drawArrays(gl.LINES, 0, e.n);
        }
        gl.enable(gl.DEPTH_TEST); gl.depthMask(true);
      }
    };
    const addLayer = () => { if (!map.getLayer(layer.id) && map.isStyleLoaded()) { try { map.addLayer(layer); } catch (e) { st.err = String(e.message || e); } } };
    map.on('style.load', () => setTimeout(addLayer, 60)); map.on('idle', addLayer); addLayer();
    map.on('moveend', () => { if (gridWanted()) map.triggerRepaint(); });

    S.wireLook = { stats: () => Object.assign({}, st, { grid: !!grid }), set: o => { Object.assign(override, o); map.triggerRepaint(); } };
  }
})();
