// plant-ui.mjs: Design > Plant layout. The user draws a boundary (the Boundary tool, or the open land around them),
// picks a capacity and a layout, and the plant is laid out on the measured ground (plant-layout.mjs), in slices
// between frames. It is drawn as quiet lines: fence, tables, roads, stations, the compound and the MV trenches.
// Everything is held in national-grid metres; each batch keeps its positions relative to its own base point, so
// a move of the site origin only moves the base (no rebuild, no upload).

import { toBng, toLocal } from './origin.mjs';
import { layoutPlantAsync, LAYOUTS, LABEL, tableGeometry, LAYOUT_DEFAULTS } from './plant-layout.mjs';
import { plantTemplate } from './plant-template.mjs';
import { equipmentSolids, solidLines } from './mv-network.mjs';
import { createSiteGround } from './plant-ground.mjs';
import { formatNumber, formatLength } from './measure-format.mjs';

const COLOUR = { fence: [0.8, 0.8, 0.8, 0.7], tables: [0.6, 0.67, 0.78, 0.55], roads: [0.78, 0.74, 0.62, 0.6],
  equipment: [0.85, 0.88, 0.95, 1], mv: [1, 0.55, 0.25, 0.9] };
const PAUSE = () => new Promise(r => setTimeout(r, 0));

// deps: { doc, origin(), viewer(), measuredAt(x, y) local, heightAt(x, y) local, assets() -> [{ kind, e, n }], redraw(),
//   nearest(e, n) -> Promise<{ e, n } | null> the nearest substation in the national index }
export function createPlant({ doc, origin, viewer, measuredAt, heightAt, assets = () => [], nearest = null, redraw }) {
  const $ = id => doc.getElementById(id);
  const ground = createSiteGround();
  const state = { boundary: null, result: null, draw: null, running: false, version: 0, summary: null, rows: null };
  const say = (msg, warn = false) => { const el = $('plant-status'); el.textContent = msg; el.className = warn ? 'warn' : ''; };
  const measured = fn => (e, n) => {
    const h = fn(e, n);
    if (Number.isFinite(h)) return h;
    const [x, y] = toLocal(origin(), e, n);
    return measuredAt(x, y);
  };
  let sample = ground.heightAt;
  const drawGround = (e, n) => { const h = measured(sample)(e, n); if (Number.isFinite(h)) return h; const [x, y] = toLocal(origin(), e, n); return heightAt(x, y); };

  $('plant-layout').replaceChildren(...LAYOUTS.map(([id, label]) => new Option(label, id)));
  ground.start().then(() => {
    // Presets only on open-land sites; elsewhere the capacity is typed.
    $('plant-presets').hidden = !/^open-land-/.test(ground.site()?.name || '');
  }).catch(() => {});
  for (const b of doc.querySelectorAll('#plant-presets [data-mw]')) b.addEventListener('click', () => { $('plant-mw').value = b.dataset.mw; });

  function setBoundary(path) {
    if (path.length < 3) { say('A boundary needs at least three corners.', true); return false; }
    state.boundary = path.map(p => [p.e, p.n]); clearLayout(false);
    say(`Boundary set: ${path.length} corners. Choose a capacity and press Lay out.`);
    return true;
  }
  // The open land around the viewer: a square big enough for the capacity asked, kept on the measured tiles.
  async function useOpenLand() {
    await ground.start().catch(() => {});
    const mw = Number($('plant-mw').value), v = viewer(), c = toBng(origin(), v.pos[0], v.pos[1]);
    const tpl = plantTemplate({ targetMW: Math.min(5000, Math.max(1, mw || 1)) });
    const T = tableGeometry($('plant-layout').value, LAYOUT_DEFAULTS, tpl);
    const side = Math.sqrt(Math.ceil(tpl.counts.strings / 2) * T.pitch * (T.lenU + LAYOUT_DEFAULTS.tableGapM) * 1.35) + 2 * Number($('plant-fence').value);
    const x = ground.extent();
    let [e0, n0, e1, n1] = [c.e - side / 2, c.n - side / 2, c.e + side / 2, c.n + side / 2];
    if (x) { e0 = Math.max(e0, x.e0 + 1); n0 = Math.max(n0, x.n0 + 1); e1 = Math.min(e1, x.e1 - 1); n1 = Math.min(n1, x.n1 - 1); }
    setBoundary([{ e: e0, n: n0 }, { e: e1, n: n0 }, { e: e1, n: n1 }, { e: e0, n: n1 }]);
    say(`Open land around you: ${formatLength(e1 - e0)} × ${formatLength(n1 - n0)}${x ? ', kept on the measured tiles' : ''}. Press Lay out.`);
    redraw();
  }

  async function run() {
    if (state.running) return null;
    if (!state.boundary) { say('Draw a boundary, or use the open land around you, first.', true); return null; }
    state.running = true; $('plant-run').disabled = true;
    const t0 = performance.now();
    try {
      const b = state.boundary, box = { e0: Math.min(...b.map(q => q[0])), n0: Math.min(...b.map(q => q[1])),
        e1: Math.max(...b.map(q => q[0])), n1: Math.max(...b.map(q => q[1])) };
      say('Reading the measured ground under the boundary…');
      await ground.loadFor(box, k => say(`Reading the measured ground: ${k} tiles`)).catch(() => null);
      const water = await ground.water().catch(() => []); // the water layer's watercourses (OS Open Rivers), for the setback
      const mid = [(box.e0 + box.e1) / 2, (box.n0 + box.n1) / 2];
      // The compound faces the nearest substation: the national index (read tile by tile) where the page has it, else the
      // substations loaded here. With neither, the layout says so and puts the compound on the south side.
      say('Finding the nearest substation…');
      const national = nearest ? await Promise.resolve().then(() => nearest(mid[0], mid[1])).catch(() => null) : null;
      const sub = national || assets().filter(a => a.kind === 'substation')
        .sort((p, q) => Math.hypot(p.e - mid[0], p.n - mid[1]) - Math.hypot(q.e - mid[0], q.n - mid[1]))[0];
      sample = ground.sampler();
      const r = await layoutPlantAsync({ boundary: b, targetMW: Number($('plant-mw').value), layout: $('plant-layout').value,
        groundAt: measured(sample), grid: sub ? [sub.e, sub.n] : null, water,
        options: { slopeLimitPct: Number($('plant-slope').value) || 15, fenceSetbackM: Number($('plant-fence').value) || 8 } },
      { onProgress: p => say(p.phase === 'tables' ? `Laying out: ${p.candidates} positions tried, ${p.accepted} tables fit` : `Laying out: ${p.phase}`) });
      state.draw = await buildLines(r);
      r.seconds = (performance.now() - t0) / 1000; r.grid = sub || null; r.waterLines = water.length;
      state.result = r; state.version++;
      showReport(r); redraw();
      return state.summary;
    } catch (e) { say(e.message, true); return null; }
    finally { state.running = false; $('plant-run').disabled = false; }
  }

  // ---- lines, built in slices; absolute national-grid positions kept relative to a base point per batch ----
  async function buildLines(r) {
    const F = r.frame, T = r.table, P = r.params, out = {};
    const make = () => ({ base: null, v: [] });
    const put = (L, e, n, z) => { if (!L.base) L.base = [e, n, z]; L.v.push(e - L.base[0], n - L.base[1], z - L.base[2]); };
    const seg = (L, a, b) => { put(L, ...a); put(L, ...b); };
    const at = (u, v, dz = 0) => { const [e, n] = F.en(u, v); return [e, n, drawGround(e, n) + dz]; };
    const path = (L, pts, dz = 0.05, step = 10) => {                    // a draped line, one point every step metres
      for (let i = 1; i < pts.length; i++) {
        const [u0, v0] = pts[i - 1], [u1, v1] = pts[i], k = Math.max(1, Math.ceil(Math.hypot(u1 - u0, v1 - v0) / step));
        for (let s = 0; s < k; s++) seg(L, at(u0 + (u1 - u0) * s / k, v0 + (v1 - v0) * s / k, dz), at(u0 + (u1 - u0) * (s + 1) / k, v0 + (v1 - v0) * (s + 1) / k, dz));
      }
    };
    out.fence = make(); path(out.fence, [...r.boundary, r.boundary[0]], 1.5);
    out.tables = make();
    const lo = P.lowEdgeM, hi = lo + T.rise, t = r.tables;
    let t0 = performance.now();
    for (let q = 0; q < t.length; q += 6) {
      const [ua, va, h0, h1, h2, h3] = t.subarray(q, q + 6), ub = ua + T.lenU, vb = va + T.depth;
      const c = (u, v, z) => { const [e, n] = F.en(u, v); return [e, n, z]; };
      if (T.south) {
        const A = c(ua, va, h0 + lo), B = c(ub, va, h1 + lo), C = c(ub, vb, h2 + hi), D = c(ua, vb, h3 + hi);
        seg(out.tables, A, B); seg(out.tables, B, C); seg(out.tables, C, D); seg(out.tables, D, A);
      } else {
        const vm = (va + vb) / 2, A = c(ua, va, h0 + lo), B = c(ub, va, h1 + lo), C = c(ub, vb, h2 + lo), D = c(ua, vb, h3 + lo);
        const M = c(ua, vm, (h0 + h3) / 2 + hi), N = c(ub, vm, (h1 + h2) / 2 + hi);
        seg(out.tables, A, B); seg(out.tables, D, C); seg(out.tables, M, N);
        seg(out.tables, A, M); seg(out.tables, M, D); seg(out.tables, B, N); seg(out.tables, N, C);
      }
      if (performance.now() - t0 > 10) { await PAUSE(); t0 = performance.now(); }
    }
    out.roads = make();
    const sp = r.spine;
    for (const d of [-P.spineWidthM / 2, P.spineWidthM / 2]) path(out.roads, [[sp.u + d, sp.v0], [sp.u + d, sp.v1]]);
    for (const tr of r.trackRoads) for (const d of [-P.trackWidthM / 2, P.trackWidthM / 2]) path(out.roads, [[tr.u0, tr.v + d], [tr.u1, tr.v + d]]);
    if (r.access) for (const d of [-P.trackWidthM / 2, P.trackWidthM / 2]) path(out.roads, [[r.access.u0, r.access.v + d], [r.access.u1, r.access.v + d]]);
    await PAUSE();
    // Equipment: station skids at their pads, the compound fence, the switchroom and the grid transformers.
    out.equipment = make();
    const cm = r.compound, [ce, cn] = F.en(cm.u, cm.v), cz = drawGround(ce, cn), base = [ce, cn, cz];
    const solids = [];
    const place = (kind, u, v, id) => { const [e, n] = F.en(u, v); solids.push(...equipmentSolids(kind, [e - ce, n - cn, drawGround(e, n) - cz], 0, id)); };
    for (const s of r.stations) place('station', s.u, s.v, s.id);
    place('switchboard', cm.u - cm.w / 4, cm.v, 'switchroom');
    const gts = r.template?.counts.gridTransformers || 0;
    for (let g = 0; g < gts; g++) place('grid-transformer', cm.u + 4 + (g % 2) * 14 - 2, cm.v - cm.d / 4 + Math.floor(g / 2) * 10, 'GT' + (g + 1));
    out.equipment.base = base; out.equipment.v = solidLines(solids);
    path(out.fence, [[cm.u - cm.w / 2, cm.v - cm.d / 2], [cm.u + cm.w / 2, cm.v - cm.d / 2], [cm.u + cm.w / 2, cm.v + cm.d / 2],
      [cm.u - cm.w / 2, cm.v + cm.d / 2], [cm.u - cm.w / 2, cm.v - cm.d / 2]], 2.4);
    // MV trenches: beside the road they follow, one line per trench wall.
    out.mv = make();
    const off = P.trackWidthM / 2 + 1.5, sOff = P.spineWidthM / 2 + 1.5;
    for (const pc of r.electrical?.pieces || []) {
      const w = (pc.c > 1 ? 0.8 : 0.45) * Math.ceil(pc.c / 2) / 2;
      for (const d of [-w, w]) {
        if (pc.key === 's') path(out.mv, [[r.spine.u + sOff + d, pc.a], [r.spine.u + sOff + d, pc.b]], 0.02);
        else if (pc.key === 'a') path(out.mv, [[pc.a, r.access.v + off + d], [pc.b, r.access.v + off + d]], 0.02);
        else if (pc.key.startsWith('t')) { const v = r.tracks[Number(pc.key.slice(1))] + off + d; path(out.mv, [[pc.a, v], [pc.b, v]], 0.02); }
        else path(out.mv, [[pc.u + d, pc.a + off], [pc.u + d, pc.b]], 0.02);
      }
    }
    for (const k of Object.keys(out)) if (!(out[k].v instanceof Float32Array)) out[k].v = new Float32Array(out[k].v);
    return out;
  }

  function batches() {
    const out = [], o = origin(), d = state.draw;
    if (state.boundary && !d) {                                     // the boundary alone, before a layout
      const v = [], b = state.boundary, z = (e, n) => drawGround(e, n) + 1.5;
      for (let i = 0; i < b.length; i++) { const [e0, n0] = b[i], [e1, n1] = b[(i + 1) % b.length]; v.push(e0, n0, z(e0, n0), e1, n1, z(e1, n1)); }
      const base = v.slice(0, 3), rel = new Float32Array(v.map((x, i) => x - base[i % 3]));
      out.push({ key: 'plant-boundary', version: `${state.version}:${b.length}`, positions: rel, color: COLOUR.fence, origin: [base[0] - o.e, base[1] - o.n, base[2]] });
    }
    if (d) for (const k of ['fence', 'tables', 'roads', 'equipment', 'mv']) {
      const L = d[k];
      if (!L.base || L.v.length < 6) continue;
      out.push({ key: 'plant-' + k, version: state.version, positions: L.v, color: COLOUR[k === 'fence' ? 'fence' : k], origin: [L.base[0] - o.e, L.base[1] - o.n, L.base[2]] });
    }
    return out;
  }

  // ---- report ----
  function showReport(r) {
    const e = r.electrical, km = m => `${formatNumber(m / 1000, 2)} km`, pct = x => formatNumber(x, 2) + ' %';
    const rows = [['Asked', `${r.asked.mw} MW export, ${formatNumber(r.asked.mwp, 1)} MWp DC`],
      ['Achieved', `${r.built.mw} MW export, ${formatNumber(r.built.mwp, 1)} MWp DC${r.fits ? '' : ' (does not all fit)'}`],
      ['Tables', `${r.built.tables} of ${r.table.modules} modules, ${r.layout === 'south' ? 'south-facing' : 'east-west'}`],
      ['Stations', String(r.built.stations)], ['33 kV feeders', String(r.built.feeders)],
      ['Roads', `${km(r.built.roadM)} (spine, ${r.trackRoads.length} track runs${r.access ? ', access' : ''})`]];
    if (e) {
      rows.push(['Trench', km(e.trenchM)], ...Object.entries(e.trenchByType).map(([k, m]) => ['', `${k}: ${km(m)}`]));
      rows.push(['Cable (single core)', km(e.cableM)], ...Object.entries(e.cableBySize).sort((a, b) => a[0] - b[0]).map(([a, m]) => ['', `${a} mm² Al: ${km(m)}`]));
      rows.push(['Worst MV drop', pct(e.worstDropPct)]);
    }
    const sk = r.skipped;
    rows.push(['Left out', `slope ${sk.slope} · hollows ${sk.hollow} · water ${sk.water} · setback ${sk.setback} · not measured ${sk.unmeasured}`]);
    if (r.grid) {
      const [ce, cn] = r.frame.en(r.compound.u, r.compound.v), d = Math.hypot(r.grid.e - ce, r.grid.n - cn);
      rows.push(['Grid', `compound ${km(d)} from the nearest ${r.grid.kv ? r.grid.kv + ' kV ' : ''}substation (straight line; the connection is not drawn)`]);
    }
    if (r.waterLines) rows.push(['Water', `${r.waterLines} mapped watercourses; tables kept ${r.params.waterSetbackM} m from them`]);
    rows.push(['Worked out in', `${formatNumber(r.seconds, 1)} s`], ...r.notes.map((n, i) => [i ? '' : 'Notes', n]));
    state.rows = rows;
    $('plant-readout').replaceChildren(...rows.flatMap(([k, v]) => { const dt = doc.createElement('dt'), dd = doc.createElement('dd'); dt.textContent = k; dd.textContent = v; return [dt, dd]; }));
    state.summary = { asked: r.asked, built: r.built, fits: r.fits, skipped: sk, seconds: r.seconds, longestSliceMs: r.longestSliceMs,
      trenchM: e?.trenchM ?? 0, trenchByType: e?.trenchByType ?? {}, cableM: e?.cableM ?? 0, cableBySize: e?.cableBySize ?? {},
      worstDropPct: e?.worstDropPct ?? null, notes: r.notes, label: LABEL };
    say(`${LABEL} ${r.fits ? 'Laid out.' : r.notes[0]}`, !r.fits);
  }
  function clearLayout(all = true) {
    state.result = null; state.draw = null; state.summary = null; state.version++;
    if (all) state.boundary = null;
    $('plant-readout').replaceChildren(); redraw();
  }
  $('plant-open').addEventListener('click', () => useOpenLand());
  $('plant-run').addEventListener('click', () => run());
  $('plant-clear').addEventListener('click', () => { clearLayout(true); say('Layout cleared.'); });
  say(LABEL);
  return { setBoundary, useOpenLand, run, batches, clear: clearLayout,
    snapshot: () => (state.summary ? JSON.parse(JSON.stringify(state.summary)) : { boundary: state.boundary ? state.boundary.length : 0, running: state.running }) };
}
