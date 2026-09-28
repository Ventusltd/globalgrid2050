// mod/engine-lock.js - the site-world 10 MVA block, imported BY URL from its immutable site-world release (never copied),
// locked to real coordinates first and animated second.
//   LOCK: the anchor is a British National Grid point converted through the overlay's own OSTN15 path (place-frame
//   PF.fromBng / toBng); ground(e, n) is the streamed EA LiDAR DTM (window.__lidarStream.heightAt, measured, rule R5);
//   the fallback is the map terrain, counted and labelled "estimated". No second conversion exists in this file.
//   BUILD: File > "Build here (animated)" places the block at the view centre and plays the engine's own build sequence
//   (marks[] prefixes: outline, 23 tables, strings, inverters, DC home cables, AC phase cables, pad, RMU, 33 kV rings,
//   grid) over about 20 s, then the cable-flow pulses. View > "Walk a cable" rides one AC cable at eye height.
//   PROVENANCE, three line styles never mixed, cut in the fragment shader (no extra geometry): SOLID = measured
//   (the ground contact: outline pegs and pile feet on measured ground), DASHED = documented (the library's cable
//   routes and trench depths), GHOST dotted = the engine's assumed equipment (tables, strings, inverters, station, grid).
//   With any estimated ground under the block, the ground contact is drawn ghost, not solid.
//   LOCK BEFORE ANIMATING: the block is built at once on whatever ground is in, then RE-GROUNDED: every R5 tile the rotated
//   block's bounding box touches is asked to arrive (one at a time, the stream's own 40 s gap), and when any of them turns
//   measured the block is rebuilt at the same E, N and bearing without replaying the sequence; the caption follows.
// Static VBOs: every group is uploaded once; the sequence is a growing draw count, the pulses are one small dynamic buffer.
// Lifted (they cannot be imported: the explorer's script is DOM-bound): routeAt and the 'cable' camera from
// Ventusltd/graphics-engines-open-source web/explore.mjs at commit 79e0bd8 (lines 22 and 41).
// Plain script; attaches to window.SIM. Test hook: SIM.engineLock = { build, state, footprints, walkCable, stop, sequence }.
(function () {
  'use strict';
  const RELEASES = ['202609270524', '202609271853'];
  const ENGINE = s => `https://globalgrid2050.com/solar-design-studio/${s}-site-world/world/block-build.mjs`;
  const EYE = 1.7, RIDE_MPS = 4, SEQ_MS = 20000;
  const STYLE = { solid: 0, dashed: 1, ghost: 2 };
  // group -> [colour rgba, style, seconds of the sequence]; the order IS the build sequence
  const PLAN = [
    ['outline', [0.55, 0.9, 1.0, 1.0], 'solid', 1.0], ['tables', [0.61, 0.86, 1.0, 0.95], 'ghost', 6.0], ['strings', [1.0, 0.86, 0.35, 0.8], 'ghost', 3.0],
    ['inverters', [1.0, 0.55, 0.2, 1.0], 'ghost', 1.0], ['dc', [1.0, 0.86, 0.35, 0.75], 'dashed', 3.0], ['ac', [0.75, 0.8, 0.86, 0.95], 'dashed', 2.0],
    ['station', [0.95, 0.97, 1.0, 1.0], 'ghost', 1.0], ['rmu', [0.95, 0.97, 1.0, 1.0], 'ghost', 0.5], ['mv', [1.0, 0.3, 0.3, 0.9], 'dashed', 1.5],
    ['grid', [0.95, 0.97, 1.0, 1.0], 'ghost', 1.0], ['others', [0.61, 0.86, 1.0, 0.5], 'ghost', 0.0], ['open', [1.0, 0.3, 0.3, 0.9], 'ghost', 0.0]
  ];
  const PF = () => window.SIM && (window.SIM.PF || (window.__pf && window.__pf.PF));
  const stream = () => window.__lidarStream;
  let engine = null, stn = null, source = null, loadErr = null, built = null, seq = null, ride = null, cap = null, layerAdded = false, rg = null;

  // ---- lifted from web/explore.mjs @ 79e0bd8 line 22: point at distance d along a route r = { points, lengths, length } ----
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  function routeAt(r, d) { d = clamp(d, 0, r.length); let i = 1; while (i < r.lengths.length - 1 && r.lengths[i] < d) i++; return lerp(r.points[i - 1], r.points[i], (d - r.lengths[i - 1]) / (r.lengths[i] - r.lengths[i - 1])); }
  // ---- lifted from web/explore.mjs @ 79e0bd8 line 41, mode 'cable': eye 1.7 m over the cable, looking 0.5 m ahead ----
  function cableCamera(r, distance, reverse = 1) {
    const p = routeAt(r, distance), q = routeAt(r, clamp(distance + reverse * 0.5, 0, r.length)); let f = [q[0] - p[0], q[1] - p[1], q[2] - p[2]];
    if (Math.hypot(f[0], f[1], f[2]) < 0.001) { let i = 1; while (i < r.lengths.length - 1 && r.lengths[i] <= distance) i++; const a = r.points[i - 1], b = r.points[i]; f = [(b[0] - a[0]) * reverse, (b[1] - a[1]) * reverse, (b[2] - a[2]) * reverse]; }
    return { position: [p[0], p[1], p[2] + EYE], forward: f };
  }
  const route = pts => { const lengths = [0]; for (let i = 1; i < pts.length; i++) lengths.push(lengths[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2])); return { points: pts, lengths, length: lengths[lengths.length - 1] }; };

  // ---- the engine, by URL (first the 0524 release, then 1853 if a same-folder import fails cross-origin) ----
  async function load() {
    if (engine) return engine;
    for (const rel of RELEASES) {
      try { engine = await import(ENGINE(rel)); stn = await import(new URL('./station.mjs', ENGINE(rel)).href); source = ENGINE(rel); return engine; }
      catch (e) { loadErr = `${rel}: ${e && e.message || e}`; console.warn('[engine-lock] import failed', ENGINE(rel), e); }
    }
    throw new Error('engine import failed: ' + loadErr);
  }

  // ---- ground: measured DTM first (R5 stream), map terrain as the labelled fallback ----
  const exag = () => { const m = window.SIM.map, t = m.getTerrain && m.getTerrain(); return (t && t.exaggeration) || 1; };
  const elevNow = () => (window.SIM.map.transform && window.SIM.map.transform.elevation) || 0;
  const rawAt = (lon, lat) => { const m = window.SIM.map; try { const v = m.queryTerrainElevation && m.queryTerrainElevation([lon, lat]); return v == null || !isFinite(v) ? 0 : v; } catch (e) { return 0; } };
  const demAt = (lon, lat) => (rawAt(lon, lat) + elevNow()) / exag();
  function grounds() {
    const P = PF(), st = stream(), used = { measured: 0, estimated: 0, receipt: null };
    const ground = (e, n) => { if (!st || !st.heightAt) return NaN; const h = st.heightAt(e, n); if (h && Number.isFinite(h.h)) { used.measured++; used.receipt = used.receipt || h.receipt; return h.h; } return NaN; };
    const fallback = (e, n) => { used.estimated++; const g = P.fromBng(e, n); return demAt(g.lon, g.lat); };
    return { ground, fallback, used };
  }

  // ---- rotation: the engine's tables run north; bearing turns the block's north axis clockwise by `bearingDeg` ----
  const rot = (E, N, a) => { const c = Math.cos(a), s = Math.sin(a); return { fwd: (x, y) => [E + x * c + y * s, N - x * s + y * c], inv: (e, n) => [(e - E) * c - (n - N) * s, (e - E) * s + (n - N) * c] }; };

  /** build({ e, n } | { lon, lat } | nothing = view centre; bearingDeg (default 0 = north); at: 'anchor' | 'pad' (the pad centre lands on e, n)). */
  async function build(o = {}) {
    const S = window.SIM, P = PF(), eng = await load();
    let e = o.e, n = o.n;
    if (e == null) { const c = o.lon != null ? { lng: o.lon, lat: o.lat } : S.map.getCenter(); const g = P.toBng(c.lat, c.lng); e = g.e; n = g.n; }
    const bearing = (o.bearingDeg || 0) * Math.PI / 180, regroundOf = o.regroundOf || null;
    // at: 'pad': the engine's station pad centre (mid of the transformers, station.mjs STATION_DEFAULTS) lands on (e, n)
    const R0 = rot(e, n, bearing);
    let E = e, N = n;
    if (o.at === 'pad') { const pc = padCentre(); const q = R0.fwd(-pc[0], -pc[1]); E = q[0]; N = q[1]; }
    const R = rot(E, N, bearing), G = grounds();
    const ground = (x, y) => { const q = R.fwd(x - E, y - N); return G.ground(q[0], q[1]); }, fallback = (x, y) => { const q = R.fwd(x - E, y - N); return G.fallback(q[0], q[1]); };
    const t0 = performance.now();
    const b = eng.buildBlock({ anchor: [E, N], ground, fallback, stations: o.stations || 1, pocKv: o.pocKv || 132, towers: [] });
    const tBuild = performance.now() - t0;
    // ---- into the map: every vertex e,n -> (rotated) -> PF.fromBng (OSTN15) -> Mercator about the anchor ----
    const an = P.fromBng(E, N), anchor = P.placeKey(an.lat, an.lon), o0 = P.toMercator(anchor.lat, anchor.lon, 0), base = rawAt(anchor.lon, anchor.lat) + elevNow();
    const mz = P.toMercator(anchor.lat, anchor.lon, 1).z - o0.z;   // metres -> Mercator z at the anchor
    const groups = [], counts = {};
    const bb = { e0: Infinity, n0: Infinity, e1: -Infinity, n1: -Infinity };
    const toV = (x, y, h) => { const q = R.fwd(x - E, y - N), g = P.fromBng(q[0], q[1]), m = P.toMercator(g.lat, g.lon, 0); if (q[0] < bb.e0) bb.e0 = q[0]; if (q[0] > bb.e1) bb.e1 = q[0]; if (q[1] < bb.n0) bb.n0 = q[1]; if (q[1] > bb.n1) bb.n1 = q[1]; return [m.x - o0.x, m.y - o0.y, (h - base) * mz]; };
    const pack = (verts) => { const out = new Float32Array(verts.length * 4); for (let k = 0; k < verts.length; k += 2) { const a = verts[k], c = verts[k + 1], L = Math.hypot((c[0] - a[0]) / mz, (c[1] - a[1]) / mz, (c[2] - a[2]) / mz); out.set([a[0], a[1], a[2], 0], 4 * k); out.set([c[0], c[1], c[2], L], 4 * k + 4); } return out; };
    const unmeasured = b.summary.unmeasured || 0;
    for (const [key, color, style, secs] of PLAN) {
      let verts = [], marks = [];
      if (b.groups[key]) { const g = b.groups[key], v = g.v, bs = g.base; for (let k = 0; k < v.length; k += 3) verts.push(toV(bs[0] + v[k], bs[1] + v[k + 1], bs[2] + v[k + 2])); marks = g.marks.slice(); }
      else if (b.cables[key]) { for (const c of b.cables[key]) { for (let i = 1; i < c.points.length; i++) verts.push(toV(...c.points[i - 1]), toV(...c.points[i])); marks.push(verts.length); } }
      if (!verts.length) continue;
      if (marks.length === 0 || marks[marks.length - 1] < verts.length) marks.push(verts.length);
      const st = key === 'outline' && unmeasured > 0 ? 'ghost' : style;
      groups.push({ key, color, style: STYLE[st], styleName: st, secs, data: pack(verts), n: verts.length, marks, draw: 0, glbuf: null });
      counts[key] = verts.length / 2;
    }
    // walk-fps collision: the table frames as plain local lines (x, y east/north metres about the anchor, z above the anchor ground)
    const lines = []; { const g = b.groups.tables, v = g.v, bs = g.base; for (let k = 0; k + 5 < v.length; k += 6) { const a = P.toLocal(anchor, ...ll(P, R, E, N, bs[0] + v[k], bs[1] + v[k + 1]), 0), c = P.toLocal(anchor, ...ll(P, R, E, N, bs[0] + v[k + 3], bs[1] + v[k + 4]), 0); lines.push([a.x, a.y, bs[2] + v[k + 2] - base, c.x, c.y, bs[2] + v[k + 5] - base]); } }
    if (built) { S.removeWhere(x => x.engineLock); freeBuffers(); }
    S.addBlock({ lon: anchor.lon, lat: anchor.lat, anchor, lines, buf: new Float32Array(0), engineLock: true, prov: unmeasured ? 'estimated' : 'measured' });
    const routes = { ac: b.cables.ac.map(c => ({ id: c.id, r: route(c.points.map(p => { const q = R.fwd(p[0] - E, p[1] - N); return [q[0], q[1], p[2]]; })) })),
      dc: b.cables.dc.map(c => route(c.points.map(p => { const q = R.fwd(p[0] - E, p[1] - N); return [q[0], q[1], p[2]]; }))),
      mv: b.cables.mv.map(c => route(c.points.map(p => { const q = R.fwd(p[0] - E, p[1] - N); return [q[0], q[1], p[2]]; }))) };
    built = { E, N, bearingDeg: o.bearingDeg || 0, anchor, base, mz, o0, groups, counts, routes, block: b, unmeasured, used: G.used, tBuild, pulse: null, pulseOn: false, dz: 0,
      bbox: bb, tiles: tilesTouched(bb), at: o.at || 'anchor', rebuilt: regroundOf ? regroundOf.rebuilt + 1 : 0, opts: { stations: o.stations, pocKv: o.pocKv } };
    ensureLayer(); S.repaint();
    if (regroundOf && seq && !seq.done) { /* the running sequence keeps its place: step() sets every draw next frame */ }
    else if (o.animate !== false && !regroundOf) sequence(); else { for (const g of groups) g.draw = g.n; built.pulseOn = true; }
    caption(); if (!regroundOf) reground(); return state();
  }
  const ll = (P, R, E, N, e, n) => { const q = R.fwd(e - E, n - N), g = P.fromBng(q[0], q[1]); return [g.lat, g.lon]; };
  // ---- re-grounding: the R5 tiles the block's bounding box touches, arrivals stepped one at a time, rebuild when measured ----
  function tilesTouched(bb) {
    const st = stream(), R5 = st && st.R5 && st.R5(); if (!R5 || !isFinite(bb.e0)) return [];
    const out = new Map(); const T = R5.TILE_M || 2048;
    for (let e = Math.floor(bb.e0 / T) * T; e <= bb.e1; e += T) for (let n = Math.floor(bb.n0 / T) * T; n <= bb.n1; n += T) { const t = R5.tileOf(e + 1, n + 1); out.set(t.key, t); }
    return [...out.values()];
  }
  const tileState = t => { const st = stream(), x = st && st.tiles && st.tiles.get(t.key), r = x && x.dtm; return !x ? 'unasked' : !r ? 'asked' : r.pending ? 'pending' : r.none ? 'none' : r.failed ? 'failed' : 'measured'; };
  // lidar-stream's arrive(why) reads the view centre only; until it takes {e, n}, the centre is answered for that one
  // synchronous call and restored at once. The view never moves. (Request to the lidar-stream module: arrive(why, {e, n}).)
  function arriveAt(t, why) {
    const st = stream(), S = window.SIM, P = PF(); if (!st || !st.arrive) return null;
    const g = P.fromBng(t.e0 + 1024, t.n0 + 1024), orig = S.map.getCenter;
    S.map.getCenter = () => ({ lng: g.lon, lat: g.lat });
    try { return st.arrive(why); } catch (e) { return null; } finally { S.map.getCenter = orig; }
  }
  function reground() {
    if (rg) { clearInterval(rg.timer); rg = null; }
    if (!built || !stream()) return;
    const home = built.tiles.find(t => t.key === viewTile()) || null;
    rg = { asked: new Set(), timer: 0, done: false, was: Object.fromEntries(built.tiles.map(t => [t.key, tileState(t)])), homeRestored: false };
    const tick = () => {
      if (!built || !stream()) { clearInterval(rg.timer); rg = null; return; }
      const states = Object.fromEntries(built.tiles.map(t => [t.key, tileState(t)]));
      // any tile newly measured since the last build: rebuild at the same E, N and bearing, the sequence keeps its place
      if (built.unmeasured > 0 && built.tiles.some(t => states[t.key] === 'measured' && rg.was[t.key] !== 'measured')) {
        rg.was = states; rebuildSame().catch(e => console.warn('[engine-lock] reground rebuild failed', e)); return;
      }
      rg.was = states;
      const open = built.tiles.filter(t => ['unasked', 'asked', 'pending'].includes(states[t.key]));
      if (!open.length) {   // every touched tile resolved: give the stream back its own view-centre tile, then stop
        if (home && !rg.homeRestored && stream().arrive && built.tiles.length > 1) { rg.homeRestored = true; try { stream().arrive('Build here (re-grounded)'); } catch (e) { /* stream off */ } }
        clearInterval(rg.timer); rg.done = true; caption(); return;
      }
      const busy = open.some(t => states[t.key] !== 'unasked');   // one arrival at a time: the stream paces the gap
      if (!busy) { const next = open.find(t => states[t.key] === 'unasked'); if (next && !rg.asked.has(next.key)) { rg.asked.add(next.key); arriveAt(next, 'Build here (neighbour tile)'); } }
      if (built.unmeasured > 0) caption();
    };
    rg.timer = setInterval(tick, 1000); tick();
  }
  const viewTile = () => { const st = stream(), R5 = st && st.R5 && st.R5(), P = PF(); if (!R5) return null; const c = window.SIM.map.getCenter(), g = P.toBng(c.lat, c.lng); return R5.tileOf(g.e, g.n).key; };
  async function rebuildSame() { if (!built) return null; const b = built, fp = b.at === 'pad' ? footprints() : null; return build({ e: fp ? fp.pad.e : b.E, n: fp ? fp.pad.n : b.N, at: b.at, bearingDeg: b.bearingDeg, stations: b.opts.stations, pocKv: b.opts.pocKv, animate: false, regroundOf: b }); }
  function freeBuffers() { const gl = layer.gl; if (!gl || !built) return; for (const g of built.groups) if (g.glbuf) { try { gl.deleteBuffer(g.glbuf); } catch (e) { /* context lost */ } g.glbuf = null; } }
  function padCentre() { const s = stn && stn.STATION_DEFAULTS; if (s && s.transformers) { const xs = s.transformers.map(p => p[0]), ys = s.transformers.map(p => p[1]); return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]; } return [155, 332.5]; }

  // ---- the build sequence: marks[] prefixes over about 20 s, group by group; then the pulses ----
  function sequence(ms = SEQ_MS) {
    if (!built) return; if (seq) cancelAnimationFrame(seq.raf);
    const total = built.groups.reduce((s, g) => s + g.secs, 0) || 1, t0 = performance.now();
    for (const g of built.groups) g.draw = 0; built.pulseOn = false;
    const step = now => {
      const t = Math.min(1, (now - t0) / ms); let acc = 0, label = '';
      for (const g of built.groups) {
        const f0 = acc / total, f1 = (acc + g.secs) / total; acc += g.secs;
        if (g.secs === 0) { g.draw = t >= 1 ? g.n : 0; continue; }
        const f = clamp((t - f0) / (f1 - f0), 0, 1), i = Math.min(g.marks.length, Math.floor(f * g.marks.length + 1e-9));
        g.draw = f >= 1 ? g.n : i > 0 ? g.marks[i - 1] : 0; if (f > 0 && f < 1) label = `${g.key} ${i} of ${g.marks.length}`;
      }
      seq.t = t; window.SIM.repaint(); if (label) caption(`building: ${label} (${Math.round(t * 100)} %)${groundNote()}`);
      if (t < 1) seq.raf = requestAnimationFrame(step); else { seq.done = true; built.pulseOn = true; caption(); }
    };
    seq = { t: 0, done: false, raf: requestAnimationFrame(step) };
  }

  // ---- own layer: static VBOs, style cut in the fragment shader by distance along the segment (metres) ----
  const layer = {
    id: 'engine-lock-wire', type: 'custom', renderingMode: '3d',
    onAdd(m, gl) {
      const vs = 'uniform mat4 u; uniform float u_dz; attribute vec4 p; varying float v_d; void main(){ gl_Position = u * vec4(p.xy, p.z + u_dz, 1.0); v_d = p.w; }';
      const fs = 'precision mediump float; uniform vec4 c; uniform int s; varying float v_d; void main(){ if (s == 1 && fract(v_d / 2.0) > 0.7) discard; if (s == 2 && fract(v_d / 0.6) > 0.35) discard; gl_FragColor = c; }';
      const sh = (t, src) => { const o = gl.createShader(t); gl.shaderSource(o, src); gl.compileShader(o); return o; };
      this.pr = gl.createProgram(); gl.attachShader(this.pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(this.pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(this.pr);
      this.loc = { p: gl.getAttribLocation(this.pr, 'p'), u: gl.getUniformLocation(this.pr, 'u'), dz: gl.getUniformLocation(this.pr, 'u_dz'), c: gl.getUniformLocation(this.pr, 'c'), s: gl.getUniformLocation(this.pr, 's') };
      this.pulseBuf = gl.createBuffer(); this.gl = gl; if (built) for (const g of built.groups) g.glbuf = null;
    },
    render(gl, args) {
      if (!built) return; const S = window.SIM, P = PF(), m = args.defaultProjectionData?.mainMatrix || args, a = built.anchor;
      const o = P.toMercator(a.lat, a.lon, rawAt(a.lon, a.lat)), r = Array.from(m);
      for (let k = 0; k < 4; k++) r[12 + k] = m[k] * o.x + m[4 + k] * o.y + m[8 + k] * o.z + m[12 + k];
      const dz = (built.base - (rawAt(a.lon, a.lat) + elevNow())) * built.mz;   // terrain tiles loading after the build: keep the vertices at their own heights
      gl.useProgram(this.pr); gl.enable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.uniformMatrix4fv(this.loc.u, false, new Float32Array(r)); gl.uniform1f(this.loc.dz, dz);
      for (const g of built.groups) {
        if (!g.draw) continue;
        if (!g.glbuf) { g.glbuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, g.glbuf); gl.bufferData(gl.ARRAY_BUFFER, g.data, gl.STATIC_DRAW); }
        gl.bindBuffer(gl.ARRAY_BUFFER, g.glbuf); gl.enableVertexAttribArray(this.loc.p); gl.vertexAttribPointer(this.loc.p, 4, gl.FLOAT, false, 16, 0);
        gl.uniform4fv(this.loc.c, g.color); gl.uniform1i(this.loc.s, g.style); gl.drawArrays(gl.LINES, 0, g.draw);
      }
      if (built.pulseOn) {
        const pulse = pulses(performance.now()); built.pulse = pulse.length / 8;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.pulseBuf); gl.bufferData(gl.ARRAY_BUFFER, pulse, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(this.loc.p); gl.vertexAttribPointer(this.loc.p, 4, gl.FLOAT, false, 16, 0);
        gl.disable(gl.DEPTH_TEST); gl.uniform4fv(this.loc.c, [1.0, 1.0, 0.6, 1.0]); gl.uniform1i(this.loc.s, 0); gl.drawArrays(gl.LINES, 0, pulse.length / 4);
        S.repaint();
      }
    }
  };
  // cable-flow pulses (web/explore.mjs @ 79e0bd8 line 42, inverterMode): one 0.6 m bright dash per route, phase by route index
  function pulses(now) {
    const P = PF(), o0 = built.o0, mz = built.mz, all = [...built.routes.dc, ...built.routes.ac.map(x => x.r), ...built.routes.mv], out = new Float32Array(all.length * 8);
    all.forEach((r, i) => {
      const f = (now / 6000 + i * 0.037) % 1, d = (i % 2 ? 1 - f : f) * r.length, a = routeAt(r, d), b = routeAt(r, Math.min(r.length, d + 0.6));
      const ga = P.fromBng(a[0], a[1]), gb = P.fromBng(b[0], b[1]), ma = P.toMercator(ga.lat, ga.lon, 0), mb = P.toMercator(gb.lat, gb.lon, 0);
      out.set([ma.x - o0.x, ma.y - o0.y, (a[2] - built.base) * mz, 0, mb.x - o0.x, mb.y - o0.y, (b[2] - built.base) * mz, 0.6], 8 * i);
    });
    return out;
  }
  function ensureLayer() { const map = window.SIM.map; if (!map.getLayer(layer.id)) { try { map.addLayer(layer); layerAdded = true; } catch (e) { /* style not ready */ } } }

  // ---- walk a cable: eye height along a selected AC phase cable, driving walk-fps (or the map camera) ----
  function walkCable(i, reverse = 1) {
    if (!built) return null; const P = PF(), S = window.SIM, n = built.routes.ac.length; if (!n) return null;
    if (i == null) { const c = S.map.getCenter(), g = P.toBng(c.lat, c.lng); let best = 0, bd = Infinity; built.routes.ac.forEach((x, k) => { const p = x.r.points[0], d = Math.hypot(p[0] - g.e, p[1] - g.n); if (d < bd) { bd = d; best = k; } }); i = best; }
    i = ((i % n) + n) % n; stopRide(); const r = built.routes.ac[i].r;
    if (window.walkFps) { try { if (!window.walkFps.state().on) window.walkFps.enter(); } catch (e) { /* walk-fps not ready */ } }
    const t0 = performance.now(); ride = { i, id: built.routes.ac[i].id, d: reverse > 0 ? 0 : r.length, raf: 0, reverse, done: false, r };
    const step = now => {
      const dt = Math.min(0.05, (now - (ride.last || now)) / 1000); ride.last = now; ride.d = clamp(ride.d + reverse * RIDE_MPS * dt, 0, r.length);
      const cam = cableCamera(r, ride.d, reverse), g = P.fromBng(cam.position[0], cam.position[1]), yaw = Math.atan2(cam.forward[0], cam.forward[1]) * 180 / Math.PI;
      if (window.walkFps && window.walkFps.state().on) window.walkFps.set({ lon: g.lon, lat: g.lat, yaw, pitch: 84 });
      else S.map.jumpTo({ center: [g.lon, g.lat], zoom: 20.5, bearing: yaw, pitch: 80 });
      ride.lon = g.lon; ride.lat = g.lat; ride.yaw = yaw; ride.z = cam.position[2];
      caption(`walking AC cable ${ride.id}: ${ride.d.toFixed(1)} of ${r.length.toFixed(1)} m, eye ${EYE} m over the cable (route and trench depth documented, drawn dashed)`);
      if ((reverse > 0 && ride.d < r.length) || (reverse < 0 && ride.d > 0)) ride.raf = requestAnimationFrame(step); else { ride.done = true; caption(`end of AC cable ${ride.id} (${r.length.toFixed(1)} m in ${((now - t0) / 1000).toFixed(1)} s)`); }
    };
    ride.raf = requestAnimationFrame(step); return { i, id: ride.id, length: r.length };
  }
  function stopRide() { if (ride && ride.raf) cancelAnimationFrame(ride.raf); ride = null; }
  function stop() { stopRide(); if (seq) cancelAnimationFrame(seq.raf); seq = null; if (rg) { clearInterval(rg.timer); rg = null; } if (built) { window.SIM.removeWhere(x => x.engineLock); freeBuffers(); built = null; } caption(''); window.SIM.repaint(); }

  // ---- captions: measured / estimated ground, counts, source ----
  // the ground state in a few words while the sequence plays (F3 wording: never "no measured LiDAR here yet" once a tile is in)
  function groundNote() {
    if (!built) return ''; const u = built.used;
    if (!u.estimated) return built.rebuilt ? ' · ground measured, re-grounded' : '';
    if (u.measured) return ` · ${u.estimated} of ${u.measured + u.estimated} samples estimated (outside the streamed tile)`;
    return rg && !rg.done ? ' · waiting for measured ground (R5 gap)' : ' · ground estimated (measured ground not streamed here)';
  }
  function caption(t) {
    if (!cap) { cap = document.createElement('div'); cap.id = 'engine-lock-caption'; cap.style.cssText = 'position:absolute;left:50%;transform:translateX(-50%);top:58px;z-index:7;background:rgba(0,0,0,.75);color:#fff;font:12px sans-serif;padding:4px 10px;border-radius:4px;max-width:92vw;pointer-events:none'; document.body.appendChild(cap); }
    if (t == null && built) {
      const u = built.used, tot = u.measured + u.estimated, c = built.counts, s = built.block.summary;
      t = `10 MVA block (the site-world engine, by URL, release ${(source || '').match(/(\d{12})/)?.[1] || '?'}) at E ${built.E.toFixed(1)} N ${built.N.toFixed(1)}, rows ${built.bearingDeg.toFixed(2)}° from grid north. ` +
        (!u.estimated ? `ground: ${tot} samples MEASURED (EA LiDAR 1 m, receipt ${u.receipt || '?'}), solid${built.rebuilt ? ', re-grounded after the tile arrived' : ''}. `
          : u.measured ? `ground: ${u.estimated} of ${tot} samples estimated (outside the streamed tile), ${u.measured} measured (receipt ${u.receipt || '?'}): ground contact drawn ghost${rg && !rg.done ? '; neighbour tile streaming (R5 gap)' : ''}. `
          : `ground: all ${tot} samples ESTIMATED from the map terrain, ground contact drawn ghost: ${rg && !rg.done ? 'waiting for measured ground (R5 gap)' : 'measured ground not streamed here'}. `) +
        `equipment ghost (assumed design), cables dashed (documented routes): ${c.tables / 2 | 0} table segments, ${(built.routes.dc.length)} DC and ${built.routes.ac.length} AC cables, piles ${s.piles.min.toFixed(1)} to ${s.piles.max.toFixed(1)} m` + (built.pulseOn ? ', cable flow pulsing' : '');
    }
    cap.textContent = t || ''; cap.style.display = t ? 'block' : 'none';
  }

  // ---- footprints for the lock test: every table face as a BNG rectangle with its OSTN15 lon/lat corners ----
  function footprints() {
    if (!built) return null; const P = PF(), b = built.block, eng = stn, s = eng.STATION_DEFAULTS, T = eng.tableShape ? eng.tableShape(s) : null;
    const R = rot(built.E, built.N, built.bearingDeg * Math.PI / 180), out = [];
    const corner = (x, y) => { const q = R.fwd(x, y), g = P.fromBng(q[0], q[1]); return { e: q[0], n: q[1], lat: g.lat, lon: g.lon }; };
    if (T && eng.tableOrigin) for (let k = 0; k < s.tables; k++) { const [x0, y0] = eng.tableOrigin(k, s); for (const side of [-1, 1]) { const xa = x0 + side * T.halfRidgeGap, xb = x0 + side * (T.halfRidgeGap + T.depth); out.push({ table: k, side, corners: [corner(xa, y0), corner(xb, y0), corner(xb, y0 + T.span), corner(xa, y0 + T.span)] }); } }
    const pc = padCentre(), pq = R.fwd(pc[0], pc[1]), pg = P.fromBng(pq[0], pq[1]), st = stream(), h = st && st.heightAt ? st.heightAt(pq[0], pq[1]) : null;
    return { anchor: { e: built.E, n: built.N, lat: built.anchor.lat, lon: built.anchor.lon }, bearingDeg: built.bearingDeg, tables: out, table: T, source,
      pad: { e: pq[0], n: pq[1], lat: pg.lat, lon: pg.lon, levelEngine: b.pads[0] && b.pads[0].level, measured: h && h.h, receipt: h && h.receipt, mapTerrain: demAt(pg.lon, pg.lat), cut: b.pads[0] && b.pads[0].cut, fill: b.pads[0] && b.pads[0].fill, unmeasuredPad: b.pads[0] && b.pads[0].unmeasured },
      ground: built.used, unmeasured: built.unmeasured, pf: P.toBng(pg.lat, pg.lon) };
  }
  function state() {
    return { source, loadErr, built: !!built, E: built && built.E, N: built && built.N, bearingDeg: built && built.bearingDeg, counts: built && built.counts, unmeasured: built && built.unmeasured, used: built && built.used,
      tBuildMs: built && built.tBuild, seq: seq && { t: seq.t, done: seq.done }, pulse: built && built.pulseOn ? built.pulse : 0, ride: ride && { i: ride.i, id: ride.id, d: ride.d, done: ride.done, lon: ride.lon, lat: ride.lat, yaw: ride.yaw },
      routes: built && { dc: built.routes.dc.length, ac: built.routes.ac.length, mv: built.routes.mv.length }, layer: !!(window.SIM.map.getLayer && window.SIM.map.getLayer(layer.id)),
      styles: built && Object.fromEntries(built.groups.map(g => [g.key, g.styleName])),
      tiles: built && built.tiles.map(t => ({ key: t.key, state: tileState(t) })), regrounding: !!(rg && !rg.done), rebuilt: built && built.rebuilt, bbox: built && built.bbox };
  }

  // ---- menu: File > Build here (animated), View > Walk a cable (into the menu panels; Scope > More if the bar has no menu) ----
  function menu() {
    const S = window.SIM, mk = (label, fn, title) => { const b = document.createElement('button'); b.textContent = label; b.title = title; b.addEventListener('click', fn); return b; };
    const b1 = mk('Build here (animated)', () => { const st = stream(); if (st && st.arrive) try { st.arrive('Build here (animated)'); } catch (e) { /* stream off */ } build().catch(e => caption('engine: ' + (e.message || e))); }, 'The site-world 10 MVA block at the view centre on the measured ground, built over 20 s, then the cable flow');
    const b2 = mk('Walk a cable', () => { if (!built) { caption('build a block first (File > Build here (animated))'); return; } if (ride && !ride.done) stopRide(); else walkCable(ride ? ride.i + 1 : null); }, 'Ride an AC phase cable at eye height (again: the next cable)');
    const panel = t => document.querySelector(`.gm-panel[data-menu="${t}"]`);
    if (panel('File') && panel('View')) { panel('File').appendChild(b1); panel('View').appendChild(b2); }
    else { S.addButton(b1.textContent, () => b1.click()); S.addButton(b2.textContent, () => b2.click()); }
    S.map.on('style.load', () => setTimeout(() => { if (built) { for (const g of built.groups) g.glbuf = null; ensureLayer(); } }, 80));
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && ride) stopRide(); });
  }
  function wait(n) { if (window.SIM && window.SIM.map && PF() && (document.getElementById('sim-menu') || n > 60)) { menu(); window.SIM.engineLock = { build, state, footprints, walkCable, stop, sequence, load, routeAt, cableCamera, releases: RELEASES }; } else if (n < 400) setTimeout(() => wait(n + 1), 50); }
  wait(0);
})();
