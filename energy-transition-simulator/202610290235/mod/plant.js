// plant.js: the morning engine's own plant generator on the map. A "Design" box takes the same typed commands as the
// engine (plant 50mw, plant 50mw south, block 10mva, pitch 6, tilt 25, clear ...). Every command runs through the engine's
// own session (engine/cmd-model.mjs, copied unchanged from v12 with its commit in each header); the layout is the
// engine's layoutPlant (engine/plant-layout.mjs) and the block is its buildBlock (engine/block-build.mjs).
// This file is only the thin adapter: it gives the session a boundary (open land centred on the map centre, sized by
// the engine's own open-land rule), runs the pure functions in local metres (east, north) and draws their lines as
// window.SIM wireframe blocks anchored at that lon/lat, so the drawing stays fixed in real coordinates.
// Assumption, labelled on screen: the ground is taken as flat (height 0 at the anchor); no measured ground is read here.
// Generic, editable parameters only: the engine defaults, changed by what is typed.
(function () {
  const here = document.currentScript && document.currentScript.src ? document.currentScript.src : location.href;
  const E = n => new URL('engine/' + n, here).href;

  function start(SIM, PF) {
    Promise.all([import(E('cmd-model.mjs')), import(E('plant-layout.mjs')), import(E('block-build.mjs')),
      fetch(E('data/cables.json')).then(r => r.json()), fetch(E('data/trench-sections.json')).then(r => r.json()).then(j => j.sections || [])])
      .then(([CM, PL, BB, catalogue, sections]) => mount(SIM, PF, CM, PL, BB, catalogue, sections))
      .catch(e => SIM.info('Design: the engine did not load (' + e.message + ')'));
  }

  function mount(SIM, PF, CM, PL, BB, catalogue, sections) {
    const map = SIM.map;
    let anchor = null, session = null, lastLayout = null, lastBlock = null;

    // ---- panel ----
    const css = document.createElement('style');
    css.textContent = `#design-box{position:absolute;right:8px;top:52px;z-index:4;width:340px;max-width:calc(100vw - 32px);
  font:11px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace;color:#d0d4d8;background:rgba(0,0,0,.78);
  border:1px solid rgba(208,212,216,.25);border-radius:4px;padding:6px 8px}
#design-box input{width:100%;box-sizing:border-box;font:inherit;color:#fff;background:#000;border:1px solid #445;padding:4px 6px}
#design-box .k{color:#8a9096}#design-box .n{color:#fff}#design-box .w{color:#ffb020}#design-box pre{margin:4px 0 0;white-space:pre-wrap}`;
    document.head.appendChild(css);
    const box = document.createElement('div'); box.id = 'design-box';
    box.innerHTML = '<div class="k">Design (type as in the engine: plant 50mw south, block 10mva, pitch 6, tilt 25, clear)</div>'
      + '<input id="design-cmd" spellcheck="false" autocomplete="off" placeholder="plant 50mw"><pre id="design-echo"></pre><pre id="design-nums"></pre>';
    document.body.appendChild(box);
    const $ = id => document.getElementById(id);

    // ---- drawing: engine lines (local metres east, north, up) into SIM blocks at the anchor ----
    function addLines(lines, tag) {
      if (!lines.length) return;
      const a = PF.placeKey(anchor.lat, anchor.lon), off = PF.toLocal(a, anchor.lat, anchor.lon, 0);
      for (let i = 0; i < lines.length; i += 20000) {  // chunks keep each buffer moderate
        const L = lines.slice(i, i + 20000).map(([x0, y0, z0, x1, y1, z1]) => [x0 + off.x, y0 + off.y, z0, x1 + off.x, y1 + off.y, z1]);
        SIM.addBlock({ lon: anchor.lon, lat: anchor.lat, anchor: a, lines: L, buf: PF.wireBuffer(a, L), designPlant: tag });
      }
    }
    const clearDrawn = tag => SIM.removeWhere(b => b.designPlant && (!tag || b.designPlant === tag));

    function plantLines(r) {
      const F = r.frame, T = r.table, P = r.params, out = [];
      const at = (u, v, z) => { const [e, n] = F.en(u, v); return [e, n, z]; };
      const seg = (a, b) => out.push([...a, ...b]);
      const path = (pts, z) => { for (let i = 1; i < pts.length; i++) seg(at(...pts[i - 1], z), at(...pts[i], z)); };
      for (const f of r.fields || [r.boundary]) path([...f, f[0]], 1.5);                          // fence
      const lo = P.lowEdgeM, hi = lo + T.rise, t = r.tables;
      for (let q = 0; q < t.length; q += 6) {                                                        // tables (flat ground)
        const ua = t[q], va = t[q + 1], ub = ua + (r.tableLen?.[q / 6] ?? T.lenU), vb = va + T.depth;
        if (T.south) { const A = at(ua, va, lo), B = at(ub, va, lo), C = at(ub, vb, hi), D = at(ua, vb, hi); seg(A, B); seg(B, C); seg(C, D); seg(D, A); }
        else if (T.tracker) { const z = 1.5, vm = (va + vb) / 2; seg(at(ua, va, z), at(ub, va, z)); seg(at(ub, va, z), at(ub, vb, z)); seg(at(ub, vb, z), at(ua, vb, z)); seg(at(ua, vb, z), at(ua, va, z)); seg(at(ua, vm, z), at(ub, vm, z)); }
        else { const vm = (va + vb) / 2, A = at(ua, va, lo), B = at(ub, va, lo), C = at(ub, vb, lo), D = at(ua, vb, lo), M = at(ua, vm, hi), N = at(ub, vm, hi);
          seg(A, B); seg(D, C); seg(M, N); seg(A, M); seg(M, D); seg(B, N); seg(N, C); }
      }
      const sp = r.spine;                                                                            // roads
      for (const d of [-P.spineWidthM / 2, P.spineWidthM / 2]) path([[sp.u + d, sp.v0], [sp.u + d, sp.v1]], 0.05);
      for (const tr of r.trackRoads) for (const d of [-P.trackWidthM / 2, P.trackWidthM / 2]) path([[tr.u0, tr.v + d], [tr.u1, tr.v + d]], 0.05);
      if (r.access) for (const d of [-P.trackWidthM / 2, P.trackWidthM / 2]) path([[r.access.u0, r.access.v + d], [r.access.u1, r.access.v + d]], 0.05);
      const cube = (u, v, w, dp, h) => { const c = [[u - w / 2, v - dp / 2], [u + w / 2, v - dp / 2], [u + w / 2, v + dp / 2], [u - w / 2, v + dp / 2]];
        for (let i = 0; i < 4; i++) { const a = c[i], b = c[(i + 1) % 4]; seg(at(...a, 0), at(...b, 0)); seg(at(...a, h), at(...b, h)); seg(at(...a, 0), at(...a, h)); } };
      for (const s of r.stations) cube(s.u, s.v, 12, 3, 3);                                          // stations (skid boxes)
      const cm = r.compound; cube(cm.u, cm.v, cm.w, cm.d, 2.4);                                      // compound fence
      return out;
    }
    function groupLines(groups) {                                                                    // buildBlock groups: base + relative xyz pairs
      const out = [];
      for (const G of Object.values(groups)) { const b = G.base, v = G.v;
        for (let i = 0; i + 5 < v.length; i += 6) out.push([b[0] + v[i], b[1] + v[i + 1], b[2] + v[i + 2], b[0] + v[i + 3], b[1] + v[i + 4], b[2] + v[i + 5]]); }
      return out;
    }

    // ---- the engine interface the session calls (cmd-model.mjs createSession) ----
    const f = (x, d = 1) => (Number.isFinite(x) ? x.toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d }) : '-');
    const engine = {
      drawnBoundary: () => null,
      setBoundary: () => {},
      async openLand(input) {           // plant-ui.mjs useOpenLand's square, centred on the anchor (0, 0)
        const ld = { ...PL.LAYOUT_DEFAULTS, ...(input.options || {}) };
        const T = PL.tableGeometry(input.layout, ld, CM.derive({ ...CM.DEFAULTS, mw: input.mw, layout: input.layout }, { catalogue }).tpl);
        const tpl = CM.derive({ ...CM.DEFAULTS, mw: input.mw, layout: input.layout }, { catalogue }).tpl;
        const side = Math.sqrt(Math.ceil(tpl.counts.strings / 2) * T.pitch * (T.lenU + PL.LAYOUT_DEFAULTS.tableGapM) * 1.5) + 2 * input.fenceSetbackM, h = side / 2;
        return [[-h, -h], [h, -h], [h, h], [-h, h]];
      },
      async layout(input) {
        const t0 = performance.now();
        const r = PL.layoutPlant({ boundary: session.state().boundary, targetMW: input.mw, layout: input.layout, template: input.template, piles: false,
          groundAt: () => 0, grid: null, water: [], ohl: null,
          options: { ...(input.options || {}), slopeLimitPct: input.slopeLimitPct, fenceSetbackM: input.fenceSetbackM } });
        r.seconds = (performance.now() - t0) / 1000; lastLayout = r;
        clearDrawn('plant'); addLines(plantLines(r), 'plant');
        return CM.summarize(r);                                        // the engine's own summary (cmd-model.mjs)
      },
      clearPlant() { clearDrawn('plant'); lastLayout = null; },
      async block({ stations, pocKv, at, trench, modulesPerString }) {
        const s0 = lastLayout?.stations?.[0], p = at ? [at.e, at.n] : s0 ? lastLayout.frame.en(s0.u + 20, s0.v + 10) : [0, 0];
        const b = BB.buildBlock({ anchor: p, ground: () => 0, stations, pocKv: pocKv || 400, trench, ...(modulesPerString ? { modulesPerString } : {}) });
        lastBlock = b; clearDrawn('block'); addLines(groupLines(b.groups), 'block');
        return { text: `Block of ${stations} station(s): ${f(b.summary.blockKwp / 1000, 2)} MWp DC, ${b.summary.inventory.installedModules.toLocaleString('en-GB')} modules`, at: { e: p[0], n: p[1] } };
      },
      clearBlock() { clearDrawn('block'); lastBlock = null; },
      piles: async () => 'Piles are not drawn on the map in this module.',
      show: () => 'show is not in this module.', go: () => 'go is not in this module.',
      constraints: () => [], avoid: () => []
    };
    const newSession = () => { session = CM.createSession({ engine, env: { latDeg: anchor?.lat ?? 52, catalogue, sections } }); };

    function numbers() {
      const r = lastLayout, rows = [];
      if (r) {
        const area = Math.abs((r.fields || [r.boundary]).reduce((t, p) => t + PL.polyArea(p), 0)) / 1e4, d = session.derived();
        rows.push(['Asked', `${r.asked.mw} MW export, ${f(r.asked.mwp)} MWp DC`],
          ['Achieved', `${r.built.mw} MW export, ${f(r.built.mwp)} MWp DC${r.fits ? '' : ' (does not all fit)'}`],
          ['Tables', `${r.built.tables.toLocaleString('en-GB')} tables of ${r.table.modules} modules each, ${{ south: 'south-facing', tracker: 'single-axis tracker rows' }[r.layout] || 'east-west'}, ${r.packing} packing`],
          ['Rows', `${r.rows} rows between tracks, runs of ${r.perRun} tables`],
          ['Row pitch', `${f(d.T.pitch, 2)} m${d.gcr ? `, GCR ${f(d.gcr, 2)}` : ''}, tilt ${f(r.layout === 'south' ? d.st.tilt : d.st.tiltEw, 0)} deg`],
          ['Area', `${f(area)} ha inside the fence, ${f(d.lay?.rowsHa)} ha under rows`],
          ['Stations', String(r.built.stations)], ['33 kV feeders', String(r.built.feeders)],
          ['Roads', `${f(r.built.roadM / 1000, 2)} km`], ['Worked out in', `${f(r.seconds, 2)} s`]);
        r.notes.forEach((n, i) => rows.push([i ? '' : 'Notes', n]));
      }
      if (lastBlock) rows.push(['Block', `${f(lastBlock.summary.blockKwp / 1000, 2)} MWp DC, ${lastBlock.summary.inventory.installedModules.toLocaleString('en-GB')} modules`]);
      rows.push(['', PL.LABEL + ' Ground taken as flat here (not measured).']);
      $('design-nums').textContent = rows.map(([k, v]) => (k ? k.padEnd(14) : ' '.repeat(14)) + v).join('\n');
    }

    async function run(line) {
      line = String(line || '').trim(); if (!line) return;
      if (/^clear$/i.test(line)) { clearDrawn(); anchor = null; session = null; lastLayout = null; lastBlock = null; $('design-echo').textContent = 'Cleared.'; $('design-nums').textContent = ''; return; }
      if (!session) { const c = map.getCenter(); anchor = { lon: c.lng, lat: c.lat }; newSession(); }   // origin at the map centre, then fixed
      $('design-echo').textContent = 'Working: ' + line;
      await new Promise(r => setTimeout(r, 0));
      let res;
      try { res = await session.exec(line); } catch (e) { res = { ok: false, text: e.message }; }
      $('design-echo').textContent = (res.ok ? '' : 'Refused: ') + (res.text || line);
      numbers();
      SIM.info(lastLayout ? `Design: ${lastLayout.built.mw} MW, ${lastLayout.built.tables.toLocaleString('en-GB')} tables. ${PL.LABEL}` : 'Design: ' + (res.text || ''));
      window.__design = { last: res, layout: lastLayout ? { asked: lastLayout.asked, built: lastLayout.built, rows: lastLayout.rows, pitch: lastLayout.table.pitch } : null, anchor };
    }
    $('design-cmd').addEventListener('keydown', e => { if (e.key === 'Enter') { const v = e.target.value; e.target.value = ''; run(v); } });
    window.__designRun = run;
  }

  (function wait() { if (window.SIM && window.__pf && window.__pf.PF) start(window.SIM, window.__pf.PF); else setTimeout(wait, 100); })();
})();
