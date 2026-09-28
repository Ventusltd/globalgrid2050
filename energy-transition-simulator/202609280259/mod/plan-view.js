// mod/plan-view.js - Plan: the massive plan in 2D, the close-up in 3D.
// View > Plan, the key P, or type "plan" (Enter) in any box. Plan puts the camera north-up and flat (pitch 0,
// bearing 0), dims the imagery to 35 % brightness, and redraws what is already on the map as a thin 2D line drawing: every
// wire block projected from its own buffer (the exact vertices the 3D wire draws, heights dropped), the mapped
// grid lines by voltage, substations as rings, and any AC trench and bund layers left exactly as their module drew
// them. Labels come only from objects already on the map, in their provenance style: solid = measured,
// dashed = documented, ghost = estimated (designs are ghost and say "imagined"). A scale bar and a north arrow sit
// top left; the grid-reference line (#where) is untouched.
// Zoom into the wireframe: in plan, zooming in past z17.5 eases the pitch to 60 over 0.6 s and the real 3D wire
// comes back (movement keeps the current mode's speed); zooming back out past z16.5 eases back to plan.
// Walk, Drone or Map (or keys 1 2 3) leave plan: plan off, then the mode's own pitch, zoom and speed; plan adds no ease.
// The 3D wire itself is never restyled: in plan it is hidden, in 3D it is shown as it was.
// Look carried over from the Kuiper drawing look (its published stage tokens: background #090c13, ink #d5dcea,
// dim #7d8799, cyan #2ee6e6, warm #e8b36a, row strokes #8ba6bb at 0.55 to 1.5 px). Values only; no code copied.
// Plain script; attaches to window.SIM. Test hook: SIM.plan = { on(), off(), toggle(), state() }.
(function () {
  'use strict';
  const K = { bg: 'rgba(9,12,19,.78)', ink: '#d5dcea', dim: '#7d8799', row: '#8ba6bb', obj: '#d5dcea', hot: '#e8b36a',
    kv: { '400': '#2ee6e6', '275': '#e8b36a', '132': '#9fd8a8' } };
  const IN = 17.5, OUT = 16.5, EASE = 600, DIM = 0.35, PITCH3D = 60;
  const PROV = ['measured', 'documented', 'estimated'];
  const st = { left: [], kinds: {}, on: false, in3d: false, easing: false, saved: {}, prev: null, eases: [], labels: 0, lines: 0, sig: '' };
  let SIM, map, hud, labelsEl, btn, labelList = [];

  function wait(n) { const S = window.SIM; if (S && S.map && (S.PF || window.__pf)) init(S); else if (n < 400) setTimeout(() => wait(n + 1), 50); }
  // ---- which blocks are what: read from the tags the other mods already set ----
  const skip = b => b.substationLabel !== undefined || b.pulse || b.ground || !b.buf || !b.anchor;
  const isRow = b => !b.registerPoint && !!(b.sat || b.rowsGeometry || b.scannerRows || b.gpuRows || b.registerPoint === undefined && b.plant === false);
  // What each projected block is, from its own module's tag (counted in state().kinds, so a check can say what plan drew).
  const kindOf = b => b.scannerRows ? (b.registerPoint ? 'register-point' : 'scanner-rows') : b.gpuRows ? 'gpu-rows' : b.rowsGeometry ? 'rows-geometry'
    : b.procedural ? 'procedural' : b.pylonsReal ? 'pylons' : b.substation !== undefined ? 'substation' : b.lidarStream ? 'lidar-stream'
    : b.trench || b.kind === 'trench' ? 'trench' : b.plant ? 'plant' : 'other';
  // Only the overlay's 3D wire and its look are hidden in plan. Other modules' own layers (procedural ghost, lidar-stream
  // tiles over imagery, trench-measure) stay exactly as their module draws them: at pitch 0 they are seen from above.
  const HIDE = new Set(['wire', 'wire-look-grid', 'lidar-stream-sat']);   // the streamed ground mesh would cover the 2D drawing (W-ui-plan, 01:55)
  function provOf(b) {
    const p = typeof b.prov === 'string' ? b.prov : '';
    if (b.registerPoint) return 'documented';
    if (/measur/i.test(p) || b.lidar || b.lidarStream) return 'measured';
    if (b.est || b.procedural || b.sat || b.gpuRows || b.scannerRows || b.designPlant || b.built || /estimat|assum|derived/i.test(p)) return 'estimated';
    return 'documented';
  }
  function labelOf(b) {
    if (b.designPlant) return 'design ' + b.designPlant + ' (imagined)';
    if (b.built) return 'block (imagined)';
    if (b.scannerRows && b.registerPoint) return b.scannerRows + ' register point';
    if (b.scannerRows) return 'rows, scanner (estimated)';
    if (b.procedural) return 'procedural ' + b.procedural + ' (estimated)';
    if (b.gpuRows) return 'rows, GPU (estimated)';
    if (b.rowsGeometry) return 'rows (estimated)';
    if (b.substation !== undefined) return '';            // substations are labelled from their mapped points
    if (b.bund) return 'bund ' + b.bund;
    if (b.trench || b.kind === 'trench') return 'trench';
    if (b.plant) return 'solar plant outline (mapped)';
    return '';
  }

  // ---- the 2D drawing: each block's own buffer, anchor-relative Mercator, heights dropped ----
  function drawing() {
    const PF = SIM.PF || window.__pf.PF, feats = [], marks = [], kinds = {};
    let n = 0;
    for (const b of SIM.blocks) {
      if (skip(b)) continue;
      const kd = kindOf(b); kinds[kd] = (kinds[kd] || 0) + 1;
      const o = PF.toMercator(b.anchor.lat, b.anchor.lon, 0), v = b.buf, segs = [];
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (let k = 0; k + 5 < v.length; k += 6) {
        const ax = v[k], ay = v[k + 1], bx = v[k + 3], by = v[k + 4];
        if (Math.abs(ax - bx) < 1e-10 && Math.abs(ay - by) < 1e-10) continue;     // a vertical: a point in plan
        const A = [PF.lngFromMercatorX(o.x + ax), PF.latFromMercatorY(o.y + ay)], B = [PF.lngFromMercatorX(o.x + bx), PF.latFromMercatorY(o.y + by)];
        segs.push([A, B]); x0 = Math.min(x0, A[0], B[0]); x1 = Math.max(x1, A[0], B[0]); y0 = Math.min(y0, A[1], B[1]); y1 = Math.max(y1, A[1], B[1]);
      }
      if (!segs.length) continue;
      n += segs.length;
      const prov = provOf(b);
      if (isRow(b)) {
        // Rows as block outlines: the convex hull of the row ends (derived from the rows, nothing added) at plan scale;
        // the row lines themselves (pieces of 5 m or more; shorter ones are table ends and legs seen from above) from z15.5.
        const pts = []; for (const [A, B] of segs) pts.push(A, B);
        feats.push({ type: 'Feature', properties: { cls: 'row', prov, hull: 1 }, geometry: { type: 'LineString', coordinates: hull(pts) } });
        const k = Math.cos(b.anchor.lat * Math.PI / 180), long = segs.filter(([A, B]) => Math.hypot((B[0] - A[0]) * k, B[1] - A[1]) * 111320 >= 5);
        if (long.length) feats.push({ type: 'Feature', properties: { cls: 'row', prov, hull: 0 }, geometry: { type: 'MultiLineString', coordinates: long } });
      } else feats.push({ type: 'Feature', properties: { cls: 'obj', prov, hull: 0 }, geometry: { type: 'MultiLineString', coordinates: segs } });
      const t = labelOf(b); if (t) marks.push({ t, prov, at: [(x0 + x1) / 2, (y0 + y1) / 2] });
    }
    st.lines = n; st.kinds = kinds;
    return { fc: { type: 'FeatureCollection', features: feats }, marks };
  }
  function hull(P) {                                    // monotone chain, closed ring
    const p = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const q of p) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    const r = lo.slice(0, -1).concat(up.slice(0, -1)); r.push(r[0]); return r;
  }
  const sigOf = () => SIM.blocks.length + ':' + SIM.blocks.reduce((s, b) => s + (b.buf ? b.buf.length : 0), 0);

  // ---- plan look on / off (layers only; the 3D wire is hidden, never changed) ----
  function keep(id, what, val) { const k = id + '|' + what; if (!(k in st.saved)) st.saved[k] = val; }
  function applyPlan() {
    if (!map.getStyle()) return;
    // Custom layers (the 3D wire) are left out of getStyle().layers, so walk the live layer order instead.
    const ids = map.getLayersOrder ? map.getLayersOrder() : (map.style && map.style._order) || [];
    for (const L of ids.map(id => map.getLayer(id)).filter(Boolean)) {
      if (L.id.startsWith('plan-')) continue;
      // Dim by brightness, not opacity: a parent and child tile drawn together at 35 % alpha would add up to a light patch.
      if (L.type === 'raster') { keep(L.id, 'o', map.getPaintProperty(L.id, 'raster-brightness-max') ?? 1); map.setPaintProperty(L.id, 'raster-brightness-max', DIM); }
      else if (L.type === 'custom' && HIDE.has(L.id) || /^g(400|275|132)$/.test(L.id) || L.id === 'subs') {
        keep(L.id, 'v', map.getLayoutProperty(L.id, 'visibility') || 'visible'); map.setLayoutProperty(L.id, 'visibility', 'none');
      }
    }
    const d = drawing(); st.sig = sigOf(); st.marks = d.marks;
    if (map.getSource('plan-wire')) map.getSource('plan-wire').setData(d.fc); else map.addSource('plan-wire', { type: 'geojson', data: d.fc });
    const col = ['match', ['get', 'cls'], 'row', K.row, K.obj];
    const add = (id, spec) => { if (!map.getLayer(id)) map.addLayer(Object.assign({ id }, spec)); };
    add('plan-estimated', { type: 'line', source: 'plan-wire', filter: ['all', ['==', ['get', 'prov'], 'estimated'], ['any', ['==', ['get', 'cls'], 'obj'], ['==', ['get', 'hull'], 1], ['>=', ['zoom'], 15.5]]], paint: { 'line-color': col, 'line-width': 0.7, 'line-opacity': 0.5 } });
    add('plan-documented', { type: 'line', source: 'plan-wire', filter: ['all', ['==', ['get', 'prov'], 'documented'], ['any', ['==', ['get', 'cls'], 'obj'], ['==', ['get', 'hull'], 1], ['>=', ['zoom'], 15.5]]], paint: { 'line-color': col, 'line-width': 0.9, 'line-opacity': 0.9, 'line-dasharray': [4, 2] } });
    add('plan-measured', { type: 'line', source: 'plan-wire', filter: ['all', ['==', ['get', 'prov'], 'measured'], ['any', ['==', ['get', 'cls'], 'obj'], ['==', ['get', 'hull'], 1], ['>=', ['zoom'], 15.5]]], paint: { 'line-color': col, 'line-width': 1, 'line-opacity': 1 } });
    for (const kv of ['132', '275', '400']) {           // the mapped lines, thin, dashed = documented (GridAtlas)
      if (!map.getSource('g' + kv)) continue;
      const on = st.saved['g' + kv + '|v'] !== 'none';
      add('plan-g' + kv, { type: 'line', source: 'g' + kv, layout: { visibility: on ? 'visible' : 'none' }, paint: { 'line-color': K.kv[kv], 'line-width': kv === '400' ? 1.3 : 1, 'line-opacity': 0.9, 'line-dasharray': [6, 2] } });
    }
    if (map.getSource('subs')) add('plan-subs', { type: 'circle', source: 'subs', paint: { 'circle-radius': 3.5, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': K.hot, 'circle-stroke-width': 1 } });
    hud.hidden = false; labelsEl.hidden = false; relabel(); scale();
  }
  function clearPlan() {
    for (const id of ['plan-measured', 'plan-documented', 'plan-estimated', 'plan-g400', 'plan-g275', 'plan-g132', 'plan-subs']) if (map.getLayer(id)) map.removeLayer(id);
    if (map.getSource('plan-wire')) map.removeSource('plan-wire');
    for (const k of Object.keys(st.saved)) {
      const [id, what] = k.split('|'); if (!map.getLayer(id)) continue;
      if (what === 'o') map.setPaintProperty(id, 'raster-brightness-max', st.saved[k]); else map.setLayoutProperty(id, 'visibility', st.saved[k]);
    }
    st.saved = {}; hud.hidden = true; labelsEl.hidden = true; labelsEl.textContent = ''; labelList = [];
    map.triggerRepaint();
  }

  // ---- labels: only from objects on the map; border = provenance ----
  const BORDER = { measured: '1px solid', documented: '1px dashed', estimated: '1px dotted' };
  function kvText(v) {
    const l = String(v || '').split(/[;,]/).map(s => Math.round(+s / 1000)).filter(x => x > 0).sort((a, b) => b - a);
    return l.length ? Array.from(new Set(l)).join('/') + ' kV' : '';
  }
  function relabel() {
    if (!st.on || st.in3d) return;
    const b = map.getBounds(), z = map.getZoom(), W = map.getCanvas().clientWidth, cell = 150, used = new Set(), out = [];
    const take = (t, at, prov, color) => {
      if (!b.contains(at)) return; const p = map.project(at), key = Math.floor(p.x / cell) + ',' + Math.floor(p.y / cell);
      if (used.has(key) || out.length >= 60) return; used.add(key); out.push({ t, at, prov, color });
    };
    for (const m of st.marks || []) take(m.t, m.at, m.prov, m.t.startsWith('rows') ? K.row : K.ink);
    if (map.getSource('act-bunds')) for (const f of map.querySourceFeatures('act-bunds')) {   // AC trench module, if present
      const r = f.geometry.coordinates[0]; if (!r) continue; let x = 0, y = 0; for (const c of r) { x += c[0]; y += c[1]; }
      take('bund ' + (f.properties.id || ''), [x / r.length, y / r.length], 'estimated', K.ink);
    }
    if (map.getSource('act-trench')) { const f = map.querySourceFeatures('act-trench')[0]; if (f) { const c = f.geometry.type === 'LineString' ? f.geometry.coordinates : (f.geometry.coordinates[0] || []); if (c.length) take('AC trench (model)', c[Math.floor(c.length / 2)], 'estimated', K.hot); } }
    if (z >= 11 && map.getSource('subs')) for (const f of map.querySourceFeatures('subs')) {
      if (f.geometry.type !== 'Point') continue; const t = kvText(f.properties.voltage);
      take('substation' + (t ? ' ' + t : ''), f.geometry.coordinates, 'documented', K.hot);
    }
    for (const kv of ['400', '275', '132']) {
      if (!map.getLayer('plan-g' + kv) || map.getLayoutProperty('plan-g' + kv, 'visibility') === 'none') continue;
      for (const f of map.querySourceFeatures('g' + kv)) {
        const lines = f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates;
        for (const l of lines) { const inV = l.filter(c => b.contains(c)); if (inV.length) take(kv + ' kV line', inV[Math.floor(inV.length / 2)], 'documented', K.kv[kv]); }
      }
    }
    labelsEl.textContent = ''; labelList = out;
    for (const L of out) {
      const d = document.createElement('div'); d.className = 'plan-label'; d.textContent = L.t;
      d.style.cssText = `position:absolute;left:0;top:0;white-space:nowrap;font:10px/1.3 ui-monospace,Consolas,monospace;color:${L.color};` +
        `background:${K.bg};border:${BORDER[L.prov]} ${L.color};opacity:${L.prov === 'estimated' ? 0.7 : 1};padding:0 4px;border-radius:2px;`;
      d.dataset.prov = L.prov; labelsEl.appendChild(d); L.el = d;
    }
    st.labels = out.length; place(); void W;
  }
  function place() { for (const L of labelList) { const p = map.project(L.at); L.el.style.transform = `translate(${Math.round(p.x + 6)}px,${Math.round(p.y - 16)}px)`; } }

  // ---- scale bar and north arrow ----
  function scale() {
    if (hud.hidden) return;
    const c = map.getCenter(), mpp = 40075016.686 * Math.cos(c.lat * Math.PI / 180) / (512 * 2 ** map.getZoom());
    const max = 120 * mpp, e = 10 ** Math.floor(Math.log10(max)), m = [5, 2, 1].map(k => k * e).find(v => v <= max) || e, px = m / mpp;
    const txt = m >= 1000 ? (m / 1000) + ' km' : m + ' m';
    hud.querySelector('.plan-bar').setAttribute('width', px.toFixed(1));
    hud.querySelector('.plan-bar-mid').setAttribute('x1', (px / 2).toFixed(1)); hud.querySelector('.plan-bar-mid').setAttribute('x2', (px / 2).toFixed(1));
    hud.querySelector('.plan-bar-end').setAttribute('x1', px.toFixed(1)); hud.querySelector('.plan-bar-end').setAttribute('x2', px.toFixed(1));
    hud.querySelector('.plan-scale-t').textContent = txt;
    hud.querySelector('.plan-north').style.transform = `rotate(${-map.getBearing()}deg)`;
    hud.dataset.metres = m; hud.dataset.px = px.toFixed(1);
  }

  // ---- modes ----
  function ease(pitch, why) {
    st.easing = true; const t0 = performance.now(); st.eases.push({ why, pitch, from: map.getPitch(), t: Math.round(t0) });
    map.easeTo({ pitch, bearing: 0, duration: EASE });
    map.once('moveend', () => { st.easing = false; st.eases[st.eases.length - 1].ms = Math.round(performance.now() - t0); after(); });
  }
  // After the ease, touch the dim once more: with terrain on, a tile rendered to texture mid-ease can keep its
  // earlier look (seen as one lighter square); a fresh paint value makes every tile redraw.
  function after() {
    if (!st.on || st.in3d) return;
    for (const k of Object.keys(st.saved)) { const [id, what] = k.split('|'); if (what === 'o' && map.getLayer(id)) map.setPaintProperty(id, 'raster-brightness-max', map.getPaintProperty(id, 'raster-brightness-max') === DIM ? DIM + 0.001 : DIM); }
    relabel(); scale();
  }
  function on() {
    if (st.on) return; st.on = true; st.in3d = false; st.prev = { pitch: map.getPitch(), bearing: map.getBearing() };
    mark(true); applyPlan();
    ease(0, 'plan');
    SIM.info && SIM.info('Plan: north-up 2D drawing of what is on the map. Solid = measured, dashed = documented, dotted/ghost = estimated. Zoom in past z17.5 for the 3D wire; P or View > Plan to leave.');
  }
  function off() {
    if (!st.on) return; st.on = false; mark(false); clearPlan();
    if (!st.in3d) map.easeTo({ pitch: st.prev ? Math.max(st.prev.pitch, 0) : 0, duration: EASE }); st.in3d = false;
  }
  // One frame later, so the zoom's own moveend has passed before the ease listens for its end.
  // (If plan was left in that frame, e.g. by Walk, the ease is dropped: the mode's own camera wins.)
  function to3d() { st.in3d = true; clearPlan(); st.easing = true; requestAnimationFrame(() => st.on ? ease(PITCH3D, 'zoom-in') : (st.easing = false)); }
  function toPlan() { st.in3d = false; applyPlan(); st.easing = true; requestAnimationFrame(() => st.on ? ease(0, 'zoom-out') : (st.easing = false)); }
  // Walk, Drone or Map (buttons, View menu, keys 1 2 3) leave plan cleanly: plan off, its look cleared, and NO camera
  // move of plan's own, so the mode's pitch, zoom, speed and the current bearing are exactly what the mode sets.
  function leave(why) {
    if (!st.on) return; st.on = false; st.in3d = false; st.easing = false; mark(false); clearPlan();
    st.left.push({ why, t: Math.round(performance.now()) });
  }
  const toggle = () => (st.on ? off() : on());
  function mark(v) { if (btn) { btn.classList.toggle('on', v); btn.setAttribute('aria-pressed', String(v)); } }

  function init(S) {
    if (SIM) return; SIM = S; map = S.map;
    hud = document.createElement('div'); hud.id = 'plan-hud'; hud.hidden = true;
    hud.style.cssText = `position:fixed;left:10px;top:calc(var(--btn, 30px) + 10px);z-index:6;pointer-events:none;color:${K.ink};` +
      `font:10px/1.3 ui-monospace,Consolas,monospace;background:${K.bg};border:1px solid #1a2030;border-radius:4px;padding:6px 8px;`;
    hud.innerHTML = '<div style="display:flex;align-items:center;gap:10px">'
      + '<svg class="plan-north" width="18" height="26" viewBox="0 0 18 26" aria-label="North"><path d="M9 2 L15 20 L9 16 L3 20 Z" fill="none" stroke="' + K.ink + '" stroke-width="1"/><path d="M9 2 L9 16 L3 20 Z" fill="' + K.ink + '"/><text x="9" y="26" fill="' + K.ink + '" font-size="7" text-anchor="middle">N</text></svg>'
      + '<svg width="130" height="22" aria-label="Scale bar"><g transform="translate(2,4)"><rect class="plan-bar" x="0" y="6" width="100" height="3" fill="none" stroke="' + K.ink + '" stroke-width="1"/>'
      + '<line x1="0" x2="0" y1="3" y2="12" stroke="' + K.ink + '"/><line class="plan-bar-mid" x1="50" x2="50" y1="6" y2="12" stroke="' + K.ink + '"/><line class="plan-bar-end" x1="100" x2="100" y1="3" y2="12" stroke="' + K.ink + '"/></g></svg>'
      + '<span class="plan-scale-t"></span></div>'
      + '<div style="color:' + K.dim + ';margin-top:3px">PLAN · north up · <span style="border-bottom:1px solid">measured</span> <span style="border-bottom:1px dashed">documented</span> <span style="border-bottom:1px dotted;opacity:.7">estimated</span></div>';
    document.body.appendChild(hud);
    labelsEl = document.createElement('div'); labelsEl.id = 'plan-labels'; labelsEl.hidden = true;
    labelsEl.style.cssText = 'position:fixed;inset:0;z-index:4;pointer-events:none;overflow:hidden';
    document.body.appendChild(labelsEl);

    map.on('move', () => { if (st.on && !st.in3d) { place(); scale(); } });
    // Blocks other mods add after a move (substation fences, towers) join the drawing at the next moveend or idle.
    const refresh = force => { if (!st.on || st.in3d || st.easing) return; const changed = sigOf() !== st.sig; if (changed) { const d = drawing(); st.sig = sigOf(); st.marks = d.marks; const s = map.getSource('plan-wire'); if (s) s.setData(d.fc); } if (changed || force) relabel(); };
    map.on('moveend', () => refresh(true)); map.on('idle', () => refresh(false));
    // Crossings only: in plan, a zoom that ENDS deeper than z17.5 after starting shallower eases into 3D, and back.
    map.on('zoomstart', () => { if (!st.easing) st.z0 = map.getZoom(); });
    map.on('zoomend', () => {
      if (!st.on || st.easing) return; const z = map.getZoom(), z0 = st.z0 ?? z;
      if (!st.in3d && z > IN && z0 <= IN) to3d(); else if (st.in3d && z < OUT && z0 >= OUT) toPlan();
    });
    map.on('style.load', () => setTimeout(() => { if (st.on && !st.in3d) { st.saved = {}; applyPlan(); } }, 150));
    addEventListener('keydown', e => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if (typing) {
        if (e.key !== 'Enter') return; const v = String(t.value || '').trim().toLowerCase();
        if (!/^plan( on| off)?$/.test(v)) return;
        e.preventDefault(); e.stopImmediatePropagation(); t.value = '';
        if (v === 'plan on') on(); else if (v === 'plan off') off(); else toggle(); return;
      }
      if (e.key === 'p' || e.key === 'P') toggle();
      else if ((e.key === '1' || e.key === '2' || e.key === '3') && !(window.walkFps && window.walkFps.state().on)) leave('key ' + e.key);
    }, true);
    // Clicks reach #walk / #drone / #map2d from the bar and from the View menu (its items click them); capture phase,
    // so plan is off before the page's setMode starts its ease.
    document.addEventListener('click', e => { const t = e.target && e.target.closest && e.target.closest('#walk,#drone,#map2d'); if (t) leave(t.id); }, true);

    // View > Plan: once the menu bar is up, the item sits after Map (3); without a menu bar it is a plain button.
    (function menu(n) {
      const slot = document.querySelector('.gm-panel[data-menu="View"] .gm-slot[data-key="map-item"]');
      if (!slot && n < 200) return setTimeout(() => menu(n + 1), 100);
      btn = document.createElement('button'); btn.id = 'plan-view'; btn.textContent = 'Plan (P)'; btn.setAttribute('aria-pressed', 'false');
      btn.addEventListener('click', () => { toggle(); if (SIM.menu) SIM.menu.close(); });
      if (slot) { const s = document.createElement('div'); s.className = 'gm-slot'; s.dataset.key = 'plan'; s.appendChild(btn); slot.after(s); }
      else if (S.addButton) { const b = S.addButton('Plan (P)', toggle); btn = b; b.id = 'plan-view'; }
      mark(st.on);
    })(0);

    SIM.plan = { on, off, toggle,
      state: () => ({ on: st.on, in3d: st.in3d, easing: st.easing, pitch: +map.getPitch().toFixed(2), bearing: +map.getBearing().toFixed(2), zoom: +map.getZoom().toFixed(2),
        scaleBar: !!(hud && !hud.hidden && hud.querySelector('.plan-bar')), scaleM: hud ? +hud.dataset.metres || 0 : 0, scalePx: hud ? +hud.dataset.px || 0 : 0,
        labels: st.labels, kinds: Object.assign({}, st.kinds), left: st.left.slice(), labelProv: labelList.map(l => l.prov), lines: st.lines, eases: st.eases.slice(),
        dimmed: Object.keys(st.saved).filter(k => k.endsWith('|o')).length, hidden: Object.keys(st.saved).filter(k => k.endsWith('|v')).map(k => k.split('|')[0]) }),
      thresholds: { in: IN, out: OUT, easeMs: EASE, pitch3d: PITCH3D, dim: DIM }, provenance: PROV };
  }
  wait(0);                                              // last, so every const above exists
})();
