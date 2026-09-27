// plant-ui.mjs: Design > Plant layout. The user draws a boundary (the Boundary tool, or the open land around them),
// picks a capacity and a layout, and the plant is laid out on the measured ground (plant-layout.mjs), in slices
// between frames. It is drawn as quiet lines: fence, tables, roads, stations, the compound and the MV trenches.
// Every table is piled automatically (plant-piles.mjs) and drawn on its piles at their fitted heights; piles that need
// grading are drawn warm. Nobody places a pile.
// Everything is held in national-grid metres; each batch keeps its positions relative to its own base point, so
// a move of the site origin only moves the base (no rebuild, no upload).

import { toBng, toLocal } from './origin.mjs';
import { layoutPlantAsync, LAYOUTS, LABEL, tableGeometry, LAYOUT_DEFAULTS } from './plant-layout.mjs';
import { plantTemplate } from './plant-template.mjs';
import { equipmentSolids, solidLines } from './mv-network.mjs';
import { createSiteGround } from './plant-ground.mjs';
import { formatNumber, formatLength, formatVolume } from './measure-format.mjs';
import { pilesForLayout, pileBoqItems, STRIDE } from './plant-piles.mjs';
import { trackerHub } from './pile-rules.mjs';
import { trenchRows } from './plant-feeders.mjs';
import { centralItems, itemSolids } from './plant-central.mjs';
import { packPlant, packSize } from './plant-pack.mjs';
import { createLod } from './plant-lod.mjs';
import { plantView, blockView, boxOfPoints } from './nav-flight.mjs';

const COLOUR = { fence: [0.8, 0.8, 0.8, 0.7], tables: [0.6, 0.67, 0.78, 0.55], roads: [0.78, 0.74, 0.62, 0.6],
  equipment: [0.85, 0.88, 0.95, 1], mv: [1, 0.55, 0.25, 0.9], piles: [0.95, 0.9, 0.55, 1], pileWarn: [1, 0.45, 0.35, 1] };
const LOD_TABLES = 5000; // above this many tables the plant is drawn by distance (plant-lod.mjs), never as one batch
const LOD_COLOUR = { outline: COLOUR.fence, blocks: [0.6, 0.67, 0.78, 0.8], stations: COLOUR.equipment, runs: COLOUR.tables, tables: COLOUR.tables,
  detail: [0.7, 0.78, 0.9, 0.7] };
const PILES_DRAWN_MAX = 200000; // above this many piles none are drawn, never a scatter of flagged ones (the counts cover all)
const PAUSE = () => new Promise(r => setTimeout(r, 0));

// deps: { doc, origin(), viewer(), measuredAt(x, y) local, heightAt(x, y) local, assets() -> [{ kind, e, n }], redraw(),
//   nearest(e, n) -> Promise<{ e, n } | null> the nearest substation in the national index }
export function createPlant({ doc, origin, viewer, measuredAt, heightAt, assets = () => [], nearest = null, redraw, release = () => false, ohlZones = () => null }) {
  const $ = id => doc.getElementById(id);
  const ground = createSiteGround();
  const state = { boundary: null, result: null, draw: null, running: false, version: 0, summary: null, rows: null, pack: null, lod: null };
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

  // The form's values as parameters: the buttons pass these, the typed bar passes its own (and the form then shows them).
  const formParams = () => ({ mw: Number($('plant-mw').value), layout: $('plant-layout').value,
    slopeLimitPct: Number($('plant-slope').value) || 15, fenceSetbackM: Number($('plant-fence').value) || 8 });
  const withForm = (q = {}) => {
    const P = { ...formParams(), ...q };
    for (const [id, k] of [['plant-mw', 'mw'], ['plant-layout', 'layout'], ['plant-slope', 'slopeLimitPct'], ['plant-fence', 'fenceSetbackM']]) if (k in q) $(id).value = String(q[k]);
    return P;
  };
  function setBoundary(path) {
    if (path.length < 3) { say('A boundary needs at least three corners.', true); return false; }
    state.boundary = path.map(p => [p.e, p.n]); clearLayout(false);
    say(`Boundary set: ${path.length} corners. Choose a capacity and press Lay out.`);
    return true;
  }
  // The open land around the viewer: a square big enough for the capacity asked (room for roads, setbacks and overhead line
  // zones), kept on the measured tiles.
  async function useOpenLand(params = {}) {
    await ground.start().catch(() => {});
    const P = withForm(params), mw = P.mw, v = viewer(), c = params.at || toBng(origin(), v.pos[0], v.pos[1]);
    const tpl = plantTemplate({ ...(P.template || {}), targetMW: Math.min(5000, Math.max(1, mw || 1)) });
    const T = tableGeometry(P.layout, { ...LAYOUT_DEFAULTS, ...(P.options || {}) }, tpl);
    const side = Math.sqrt(Math.ceil(tpl.counts.strings / 2) * T.pitch * (T.lenU + LAYOUT_DEFAULTS.tableGapM) * 1.5) + 2 * P.fenceSetbackM;
    const fine = ground.extent(), wide = fine && side > Math.min(fine.e1 - fine.e0, fine.n1 - fine.n0);
    // Larger than the 1 m tiles (500 MW is about 3.3 km square): centred on the measured site, out onto the far ring.
    const x = wide ? ground.extent({ ring: true }) : fine, m = wide && !params.at ? { e: (fine.e0 + fine.e1) / 2, n: (fine.n0 + fine.n1) / 2 } : c;
    let [e0, n0, e1, n1] = [m.e - side / 2, m.n - side / 2, m.e + side / 2, m.n + side / 2];
    if (x) { e0 = Math.max(e0, x.e0 + 1); n0 = Math.max(n0, x.n0 + 1); e1 = Math.min(e1, x.e1 - 1); n1 = Math.min(n1, x.n1 - 1); }
    setBoundary([{ e: e0, n: n0 }, { e: e1, n: n0 }, { e: e1, n: n1 }, { e: e0, n: n1 }]);
    say(`Open land ${wide ? 'on this site' : 'around you'}: ${formatLength(e1 - e0)} × ${formatLength(n1 - n0)}${x ? ', kept on the measured tiles' : ''}`
      + `${wide ? ' (beyond the 1 m tiles, the 8 m far ring)' : ''}. Press Lay out.`);
    redraw();
    return state.boundary;
  }

  // params (all optional; the form fills the rest): { mw, layout: 'south' | 'east-west' | 'tracker', slopeLimitPct, fenceSetbackM,
  //   ohlMargin, openLand: true, options: layout overrides, template: plant template overrides,
  //   avoid: [{ id, test(e, n) }] areas kept clear (the typed session passes its overhead line test as id 'ohl') }
  async function run(params = {}) {
    if (state.running) return null;
    // Short names from tests and older hooks (slope, fence) map onto the form's; the rest pass through withForm.
    if (params.slope != null && params.slopeLimitPct == null) params = { ...params, slopeLimitPct: params.slope };
    if (params.fence != null && params.fenceSetbackM == null) params = { ...params, fenceSetbackM: params.fence };
    if (params.openLand || (params.mw != null && !state.boundary)) await useOpenLand(params);
    if (!state.boundary) { say('Draw a boundary, or use the open land around you, first.', true); return null; }
    state.running = true; $('plant-run').disabled = true;
    const t0 = performance.now();
    try {
      const b = state.boundary, box = { e0: Math.min(...b.map(q => q[0])), n0: Math.min(...b.map(q => q[1])),
        e1: Math.max(...b.map(q => q[0])), n1: Math.max(...b.map(q => q[1])) };
      say('Reading the measured ground under the boundary…');
      const fine = ground.extent(), ring = !!fine && (box.e0 < fine.e0 || box.n0 < fine.n0 || box.e1 > fine.e1 || box.n1 > fine.n1);
      await ground.loadFor(box, k => say(`Reading the measured ground: ${k} tiles`), { ring }).catch(() => null);
      const water = await ground.water().catch(() => []); // the water layer's watercourses (OS Open Rivers), for the setback
      const mid = [(box.e0 + box.e1) / 2, (box.n0 + box.n1) / 2];
      // The compound faces the nearest substation: the national index (read tile by tile) where the page has it, else the
      // substations loaded here. With neither, the layout says so and puts the compound on the south side.
      say('Finding the nearest substation…');
      const national = nearest ? await Promise.resolve().then(() => nearest(mid[0], mid[1])).catch(() => null) : null;
      const sub = national || assets().filter(a => a.kind === 'substation')
        .sort((p, q) => Math.hypot(p.e - mid[0], p.n - mid[1]) - Math.hypot(q.e - mid[0], q.n - mid[1]))[0];
      sample = ground.sampler();
      const P = withForm(params), typedAvoid = Array.isArray(params.avoid);
      // The typed session passes its own overhead line test (or none: "avoid pylons off"); the forms use the zones layer.
      // The survey date check reads the site's data fields (plant-ground.mjs survey); none given, nothing is said.
      const r = await layoutPlantAsync({ boundary: b, targetMW: P.mw, layout: P.layout, template: P.template, avoid: P.avoid, piles: P.piles, survey: ground.survey?.(),
        groundAt: measured(sample), grid: sub ? [sub.e, sub.n] : null, water, ohl: typedAvoid ? null : ohlZones(),
        options: { ...(P.options || {}), slopeLimitPct: P.slopeLimitPct, fenceSetbackM: P.fenceSetbackM,
          ...(Number.isFinite(params.ohlMargin) ? { ohlMarginM: params.ohlMargin } : {}) } },
      { onProgress: p => say(p.phase === 'tables' ? `Laying out: ${p.candidates} positions tried, ${p.accepted} tables fit`
        : p.phase === 'piles' ? `Piling every table: ${p.tables} done` : `Laying out: ${p.phase}`) });
      if (ground.ringShare() > 0) r.notes.push(`${formatNumber(ground.ringShare() * 100, 0)} % of the ground heights read came from the 8 m far ring `
        + 'beyond the 1 m tiles: slopes there are coarse and hollows under 8 m are not seen. Survey before design.');
      await drawPlant(r);
      r.seconds = (performance.now() - t0) / 1000; r.grid = sub || null; r.waterLines = water.length;
      state.result = r; state.version++;
      showReport(r); redraw();
      return state.summary;
    } catch (e) { say(e.message, true); return null; }
    finally { state.running = false; $('plant-run').disabled = false; }
  }

  // A large plant is packed (plant-pack.mjs) and drawn by distance (plant-lod.mjs); tables and piles leave the flat batches.
  async function drawPlant(r) {
    state.lod?.dispose(); state.lod = null; state.pack = null;
    if (r.built.tables > LOD_TABLES) {
      const pt = r.piles?.tables, pack = state.pack = packPlant(r, { surface: q => pt?.[q]?.edges || null }), [pe, pn] = pack.origin;
      let asked = false;
      state.lod = createLod(pack, { colours: LOD_COLOUR, release, version: state.version + 1,
        onPending: () => { if (!asked) { asked = true; setTimeout(() => { asked = false; redraw(); }, 0); } },
        extra: (q, v, b) => { const pr = pt?.[q]; if (pr) for (let i = 0; i < pr.n; i++) { const o = i * STRIDE;     // the piles, near the eye only
          v.push(pr.pa[o] - pe - b[0], pr.pa[o + 1] - pn - b[1], pr.pa[o + 4] - b[2], pr.pa[o] - pe - b[0], pr.pa[o + 1] - pn - b[1], pr.pa[o + 3] - b[2]); } } });
    }
    state.draw = await buildLines(r, { tables: !state.lod });
  }

  // ---- lines, built in slices; absolute national-grid positions kept relative to a base point per batch ----
  async function buildLines(r, { tables: withTables = true } = {}) {
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
    out.fence = make(); for (const f of r.fields || [r.boundary]) path(out.fence, [...f, f[0]], 1.5); // every field of the plant
    out.tables = make();
    const lo = P.lowEdgeM, hi = lo + T.rise, t = r.tables, pt = r.piles?.tables;
    out.piles = make(); out.pileWarn = make();
    const all = (r.piles?.summary.piles || 0) <= PILES_DRAWN_MAX;
    let t0 = performance.now();
    for (let q = 0; withTables && q < t.length; q += 6) {
      const [ua, va, h0, h1, h2, h3] = t.subarray(q, q + 6), ub = ua + (r.tableLen?.[q / 6] ?? T.lenU), vb = va + T.depth, pr = pt?.[q / 6];
      const c = (u, v, z) => { const [e, n] = F.en(u, v); return [e, n, z]; };
      if (pr) for (let i = 0; i < pr.n; i++) {                     // piles, from the ground (or graded ground) to the top
        const o = i * STRIDE, L = pr.pf[i] & 3 ? out.pileWarn : out.piles;
        if (all) seg(L, [pr.pa[o], pr.pa[o + 1], pr.pa[o + 4]], [pr.pa[o], pr.pa[o + 1], pr.pa[o + 3]]);
      }
      // On its piles: the fitted module surface heights; without piles, a fixed height over the ground.
      const hub = trackerHub().hub, fb = T.tracker ? [[(h0 + h3) / 2 + hub, (h1 + h2) / 2 + hub]].flatMap(x => [x, x, x]) : null;
      const [Ea, Em, Eb] = pr ? pr.edges : fb || [[h0 + lo, h1 + lo], [(h0 + h3) / 2 + hi, (h1 + h2) / 2 + hi], T.south ? [h3 + hi, h2 + hi] : [h3 + lo, h2 + lo]];
      if (T.tracker) {                  // tracker at stow: the modules flat on the tube, and the tube along the middle
        const vm = (va + vb) / 2, A = c(ua, va, Ea[0]), B = c(ub, va, Ea[1]), C = c(ub, vb, Eb[1]), D = c(ua, vb, Eb[0]);
        seg(out.tables, A, B); seg(out.tables, B, C); seg(out.tables, C, D); seg(out.tables, D, A); seg(out.tables, c(ua, vm, Em[0]), c(ub, vm, Em[1]));
      } else if (T.south) {
        const A = c(ua, va, Ea[0]), B = c(ub, va, Ea[1]), C = c(ub, vb, Eb[1]), D = c(ua, vb, Eb[0]);
        seg(out.tables, A, B); seg(out.tables, B, C); seg(out.tables, C, D); seg(out.tables, D, A);
      } else {
        const vm = (va + vb) / 2, A = c(ua, va, Ea[0]), B = c(ub, va, Ea[1]), C = c(ub, vb, Eb[1]), D = c(ua, vb, Eb[0]);
        const M = c(ua, vm, Em[0]), N = c(ub, vm, Em[1]);
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
    for (const s of r.stations) if (!s.central) place('station', s.u, s.v, s.id);
    for (const it of centralItems(r)) { const [e, n] = F.en(it.u, it.v); solids.push(...itemSolids(it.kind, [e - ce, n - cn, drawGround(e, n) - cz], it.id)); }
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
    if (d && state.lod) {                                            // a large plant: by distance from the eye
      const v = viewer(), p = toBng(o, v.pos[0], v.pos[1]), [pe, pn] = state.pack.origin;
      out.push(...state.lod.batches([p.e - pe, p.n - pn, v.pos[2]], b => [pe + b[0] - o.e, pn + b[1] - o.n, b[2]]));
    }
    if (d) for (const k of ['fence', 'tables', 'piles', 'pileWarn', 'roads', 'equipment', 'mv']) {
      const L = d[k];
      if (!L.base || L.v.length < 6) continue;
      out.push({ key: 'plant-' + k, version: state.version, positions: L.v, color: COLOUR[k === 'fence' ? 'fence' : k], origin: [L.base[0] - o.e, L.base[1] - o.n, L.base[2]] });
    }
    return out;
  }

  // ---- piles: automatic from the tables; rerun on the laid-out plant with other rules (typed "piles auto") ----
  async function pilesAuto(opts = {}) {
    const r = state.result;
    if (!r || state.running) return null;
    const it = pilesForLayout(r, measured(sample), { posts: opts.posts, mwp: r.built.mwp, rules: opts.rules, soil: opts.soil });
    let x, t0 = performance.now();
    while (!(x = it.next()).done) if (performance.now() - t0 > 10) { await PAUSE(); t0 = performance.now(); }
    r.piles = x.value; state.version++; await drawPlant(r);
    showReport(r); redraw();
    return state.summary.piles;
  }
  const n0 = x => formatNumber(x, 0), n2 = x => formatNumber(x, 2);
  function pileReadout(pl) {
    if (!pl) return [['Piles', 'none: no tables']];
    const s = pl.summary, R = pl.rules, top = s.suggestions[0];
    const tr = s.system === 'tracker', what = tr ? 'posts along each tracker tube' : pl.posts === 1 ? 'one post per table' : 'front and rear posts per table';
    return [['Piles', `${n0(s.piles)} (${n0(s.perMWp)} per MWp), ${what}, automatic`],
      ['Pile metres', `${formatLength(s.totalPileLengthM)} in all; ${formatLength(s.embeddedM)} embedded (${n2(R.embedM)} m each at least; `
        + `soil assumed ${R.soilFrom ? `from ${R.soilFrom}` : `${R.soil.replace(/_/g, ' ')}, not read from the geology here`})`],
      ['Reveal', `${n2(Math.max(0, s.finishedP?.[0] ?? s.revealP[0]))} to ${n2(s.finishedP?.[2] ?? s.revealP[2])} m out of the ground once graded `
        + `(${tr ? 'from the tube height' : `design ${n2(r0(state.result).lowEdgeM)} m low edge plus the table rise`})`],
      ['Pile flags', `${n0(s.revealAdjust)} piles outside ±${n2(R.revealAdjustM)} m adjustment · ${n0(s.revealHigh + s.revealLow)} outside the band · `
        + (tr ? `${n0(s.cannotFollow)} rows the tracker cannot follow (bay to bay ${formatNumber(R.bayChangeMaxDeg, 1)}°, reveal ${n2(R.revealWindowM[0])} to ${n2(R.revealWindowM[1])} m)`
          : `${n0(s.twistTables)} tables where the ground twists over ${formatNumber(R.twistTolDeg, 1)}° · ${n0(s.lowEdgeTables)} with the low edge under ${n2(R.lowEdgeClearM)} m`),
        s.revealHigh + s.revealLow + s.twistTables + s.cannotFollow > 0],
      ['', `${n0(s.embedBelowReveal)} posts lengthened: embedded at least ${n2(R.embedToReveal ?? 0)} × their reveal (lateral load)${s.revealWarn + s.revealFail ? ` · ${n0(s.revealWarn)} more than `
        + `${n2(R.revealWarnAboveM)} m above their design height, ${n0(s.revealFail)} over ${n2(R.revealFailM)} m` : ''}`
        + `${s.unmeasured ? ` · ${n0(s.unmeasured)} tables partly on unmeasured ground` : ''}`],
      ['Pile tests', `${n0(s.proofTests)} production proof tests (${formatNumber(R.proofTestPct, 1)} %, spread evenly); trial piles per zone before works`
        + `${tr ? '' : ` · ground twist median ${formatNumber(s.twistP50Deg, 1)}°, largest ${formatNumber(s.twistMaxDeg, 1)}°`}`],
      ['Grading', s.gradingTables ? `${n0(s.gradingTables)} tables (ground as found: ${n2(s.revealP[0])} to ${n2(s.revealP[2])} m under the post tops): `
        + `${n0(s.regrade)} regrade · ${n0(s.raise)} raise · ${n0(s.drop)} drop · `
        + `cut ${formatVolume(s.cutM3)} / fill ${formatVolume(s.fillM3)} (indicative)` : 'none needed'],
      ...(top ? [['', `Largest patch: ${top.action}, ${top.tables.length} table${top.tables.length === 1 ? '' : 's'}, up to ${n2(top.maxDepth)} m`]] : []),
      ['Pile rules', R.label]];
  }
  const r0 = r => r?.params || { lowEdgeM: NaN };
  const pileSnapshot = pl => (pl ? { ...pl.summary, suggestions: pl.summary.suggestions.length, posts: pl.posts } : null);
  const boqItems = () => pileBoqItems('plant-piles', state.result?.piles?.summary, 'plant');

  // ---- report ----
  function showReport(r) {
    const e = r.electrical, km = m => `${formatNumber(m / 1000, 2)} km`, pct = x => formatNumber(x, 2) + ' %';
    const rows = [['Asked', `${r.asked.mw} MW export, ${formatNumber(r.asked.mwp, 1)} MWp DC`],
      ['Achieved', `${r.built.mw} MW export, ${formatNumber(r.built.mwp, 1)} MWp DC${r.fits ? '' : ' (does not all fit)'}`],
      ['Tables', `${r.built.tables.toLocaleString('en-GB')} tables of ${r.table.modules} modules each${r.built.halfTables ? ` (${r.built.halfTables} half tables)` : ''}, `
        + `${{ south: 'south-facing', tracker: 'single-axis tracker rows' }[r.layout] || 'east-west'}, ${r.packing || 'bands'} packing`],
      ...pileReadout(r.piles), ['Stations', r.stations.some(s => s.central) ? `${r.built.stations} central-inverter stations, `
        + `${r.stations.reduce((t, s) => t + (s.combiners || 0), 0).toLocaleString('en-GB')} DC combiner boxes` : String(r.built.stations)], ['33 kV feeders', String(r.built.feeders)],
      ['Roads', `${km(r.built.roadM)} (spine, ${r.trackRoads.length} track runs${r.access ? ', access' : ''})`]];
    if (e) {
      rows.push(...trenchRows(e, v => formatNumber(v, 2)).rows);
      rows.push(['Worst MV drop', pct(e.worstDropPct)]);
    }
    const sk = r.skipped;
    rows.push(['Left out', `slope ${sk.slope} · twist ${sk.twist || 0} · hollows ${sk.hollow} · water ${sk.water} · overhead line ${sk.ohl}`
      + ` · setback ${sk.setback} · not measured ${sk.unmeasured}`]);
    if (r.grid) {
      const [ce, cn] = r.frame.en(r.compound.u, r.compound.v), d = Math.hypot(r.grid.e - ce, r.grid.n - cn);
      rows.push(['Grid', `compound ${km(d)} from the nearest ${r.grid.kv ? r.grid.kv + ' kV ' : ''}substation (straight line; the connection is not drawn)`]);
    }
    if (r.waterLines) rows.push(['Water', `${r.waterLines} mapped watercourses; tables kept ${r.params.waterSetbackM} m from them`]);
    if (state.pack) { const k = packSize(state.pack);
      rows.push(['Drawn by distance', `${k.tables.toLocaleString('en-GB')} tables packed at ${k.bytesPerTable} B each (${formatNumber(k.tableBytes / 1024, 0)} KB), `
        + `${k.blocks} blocks, ${k.cells} cells of 250 m: outline, blocks, runs, tables, then modules within 80 m`]); }
    rows.push(['Worked out in', r.seconds < 0.1 ? 'under 0.1 s' : `${formatNumber(r.seconds, 1)} s`], ...r.notes.map((n, i) => [i ? '' : 'Notes', n]));
    state.rows = rows;
    $('plant-readout').replaceChildren(...rows.flatMap(([k, v]) => { const dt = doc.createElement('dt'), dd = doc.createElement('dd'); dt.textContent = k; dd.textContent = v; return [dt, dd]; }));
    state.summary = { asked: r.asked, built: r.built, fits: r.fits, skipped: sk, seconds: r.seconds, longestSliceMs: r.longestSliceMs, slowestStep: r.slowestStep,
      trenchM: e?.trenchM ?? 0, trenchByType: e?.trenchByType ?? {}, cableM: e?.cableM ?? 0, cableBySize: e?.cableBySize ?? {},
      worstDropPct: e?.worstDropPct ?? null, notes: r.notes, label: LABEL, piles: pileSnapshot(r.piles) };
    say(`${LABEL} ${r.fits ? 'Laid out.' : r.notes[0]}`, !r.fits);
  }
  function clearLayout(all = true) {
    state.result = null; state.draw = null; state.summary = null; state.version++;
    state.lod?.dispose(); state.lod = null; state.pack = null;
    if (all) state.boundary = null;
    $('plant-readout').replaceChildren(); redraw();
  }
  $('plant-open').addEventListener('click', () => useOpenLand());
  $('plant-run').addEventListener('click', () => run());
  $('plant-clear').addEventListener('click', () => { clearLayout(true); say('Layout cleared.'); });
  say(LABEL);
  return { setBoundary, useOpenLand, run, batches, clear: clearLayout, pilesAuto, boqItems, result: () => state.result, boundary: () => state.boundary,
    version: () => state.version,
    // The plant's diagonal (m) for the far fade, the pack's figures and the drawer's levels (plant-pack.mjs, plant-lod.mjs).
    extentM: () => { const b = state.result && state.boundary; if (!b) return 0;
      const es = b.map(q => q[0]), ns = b.map(q => q[1]); return Math.hypot(Math.max(...es) - Math.min(...es), Math.max(...ns) - Math.min(...ns)); },
    pack: () => (state.pack ? packSize(state.pack) : null), lod: () => state.lod?.stats() ?? null,
    // The camera that frames the whole plant (block null) or block n (from 1), as flyTo options at national-grid (e, n)
    // (nav-flight.mjs: 45 degrees down for the plant, 50 for a block). Null without a packed plant or for no such block.
    frame: (block = null) => { const p = state.pack, pts = p && (block == null ? p.fence : p.blocks[block - 1]?.rect); if (!pts) return null;
      const v = (block == null ? plantView : blockView)(boxOfPoints(pts));
      return { e: p.origin[0] + v.x, n: p.origin[1] + v.y, yaw: v.yaw, pitch: v.pitch, back: v.back, block, blocks: p.blocks.length }; },
    snapshot: () => (state.summary ? JSON.parse(JSON.stringify(state.summary)) : { boundary: state.boundary ? state.boundary.length : 0, running: state.running }) };
}
