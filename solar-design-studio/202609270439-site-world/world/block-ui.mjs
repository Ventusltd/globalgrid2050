// block-ui.mjs: Design > Solar block. Places the owner's 10 MVA station block (block-build.mjs) on the measured ground
// in front of the viewer, chains the stations on 33 kV rings to the grid, and plays the build sequence
// (block-sequence.mjs): Play runs the clock and asks the page for frames at 30 fps; Pause and Step stop the clock,
// so no frame is drawn until something else changes (0 fps). Everything is held in national-grid metres; each line
// group keeps its positions relative to its own base, so a move of the site origin only moves the base.
// Trenches are handed to the design (trenchItems), which cuts them into the ground and draws their cross-sections.

import { toBng } from './origin.mjs';
import { buildBlock, blockCounts, overheadClearance } from './block-build.mjs';
import { mvChain } from './block-mv.mjs';
import { createClock, progress, reveal, partial, stageAt, STAGES, TOTAL } from './block-sequence.mjs';
import { createSiteGround } from './plant-ground.mjs';
import { formatNumber, formatLength } from './measure-format.mjs';
let G = null, X = null; // block-gpu.mjs and block-export.mjs, imported on first use so the section opens as fast as before

export const BLOCK_LABEL = 'Illustrative, not a design for any site.';
const C = { outline: [0.75, 0.75, 0.75, 0.45], tables: [0.62, 0.72, 0.86, 0.8], strings: [0.4, 0.62, 0.95, 0.75], inverters: [0.95, 0.97, 1, 1],
  station: [0.95, 0.97, 1, 1], others: [0.6, 0.67, 0.78, 0.45], rmu: [1, 0.72, 0.35, 1], open: [1, 0.36, 0.3, 1], grid: [0.95, 0.97, 1, 1],
  dc: [0.55, 0.62, 0.7, 1], dcLive: [0.35, 0.8, 1, 1], ac: [0.6, 0.6, 0.62, 1], acLive: [0.55, 1, 0.62, 1], mv: [0.7, 0.6, 0.55, 1],
  mvLive: [1, 0.55, 0.25, 1] };
const FPS = 30, CLEAR_M = 40; // CLEAR_M: tables kept this far from an overhead line (assumed; the line owner sets the easement)
const n0 = x => formatNumber(x, 0), n1 = x => formatNumber(x, 1), n2 = x => formatNumber(x, 2);

// deps: { doc, origin(), viewer(), measuredAt(x, y) local, heightAt(x, y) local, towers() -> [{ e, n, kv }], redraw(), animate() }
export function createBlock({ doc, origin, viewer, measuredAt, heightAt, towers = () => [], redraw, animate = () => {} }) {
  const $ = id => doc.getElementById(id);
  const ground = createSiteGround(), clock = createClock();
  const state = { built: null, version: 0, anchor: null, busy: false, stageShown: -1, full: {}, gpuPads: null, playing: false, gpu: null, exp: null };
  const say = (msg, warn = false) => { const el = $('block-status'); el.textContent = msg; el.className = warn ? 'warn' : ''; };
  const local = (e, n) => [e - origin().e, n - origin().n];

  async function gpuPads() {                                // optional, read-only: station and compound pads from the GPU run
    if (state.gpuPads) return state.gpuPads;
    state.gpuPads = [];
    try {
      const site = (await ground.start()).site?.name, r = await fetch(`./world/sites/${site}/gpu-compounds.json`, { cache: 'no-cache' });
      const j = r.ok ? await r.json() : null;
      if (j?.schema === 'gpu-night-a.compounds/1') state.gpuPads = (j.compounds || []).filter(c => Array.isArray(c.poly) && Number.isFinite(c.level_e))
        .map(c => ({ poly: c.poly, level: c.level_e, cut: c.cut_e, fill: c.fill_e }));
    } catch { /* none staged: the world's own pad earthworks */ }
    return state.gpuPads;
  }

  async function place() {
    if (state.busy) return null;
    state.busy = true; $('block-place').disabled = true;
    try {
      const v = viewer(), c = toBng(origin(), v.pos[0], v.pos[1]), stations = Math.min(10, Math.max(1, Math.round(Number($('block-stations').value) || 4)));
      const pocKv = Number($('block-poc').value) || 400, lines = towers();
      // The viewer stands in the first aisle, facing north; where an overhead line would cross the tables the block
      // steps east (60 m at a time, up to 1.2 km) until every table is at least CLEAR_M from it.
      let anchor = [c.e - 16, c.n + 12], moved = 0;
      for (let k = 0; k <= 20; k++) {
        const o = overheadClearance([anchor[0] + 60 * k, anchor[1]], stations, lines);
        if (!o || o.distanceM >= CLEAR_M) { moved = 60 * k; break; }
      }
      anchor = [anchor[0] + moved, anchor[1]];
      const mv = mvChain({ stations, pocKv }), e1 = anchor[0] + mv.compound.x + mv.compound.w, n1 = anchor[1] + mv.rows * 800;
      say('Reading the measured ground under the block…');
      await ground.loadFor({ e0: anchor[0] - 40, n0: anchor[1] - 80, e1, n1 }).catch(() => null);
      const sample = ground.sampler();
      const measured = (e, n) => { const h = sample(e, n); if (Number.isFinite(h)) return h; const [x, y] = local(e, n); return measuredAt(x, y); };
      const fallback = (e, n) => { const [x, y] = local(e, n); return heightAt(x, y); };
      state.gpu = null;
      const b = buildBlock({ anchor, ground: measured, fallback, stations, pocKv, towers: lines, gpuPads: await gpuPads() });
      for (const k of ['dc', 'ac', 'mv']) state.full[k] = cableGroup(b.cables[k], k === 'mv' ? null : 'inverter');
      state.built = b; state.anchor = anchor; state.version++; state.stageShown = -1;
      clock.finish(); refreshItems(); showReadout(b); redraw();
      say(`${BLOCK_LABEL} Placed${moved ? `, ${moved} m east of you to keep ${CLEAR_M} m from the overhead line` : ''}. Play builds it in sequence.`);
      return counts();
    } catch (e) { say(e.message, true); return null; }
    finally { state.busy = false; $('block-place').disabled = false; }
  }

  // GPU-checked placement (block-gpu.mjs): the study's prototype station where the GPU placed it, its build as the feed.
  async function placeGpu() {
    if (state.busy) return null;
    state.busy = true;
    try {
      const site = (await ground.start()).site?.name;
      say('Reading the GPU-checked placement…');
      G ||= await import('./block-gpu.mjs');
      const f = await G.loadPrototype(site), p = G.parsePrototype(f.layout, f.sequence, f.receipt);
      await ground.loadFor(p.bbox).catch(() => null);
      const sample = ground.sampler(), measured = (e, n) => { const h = sample(e, n); if (Number.isFinite(h)) return h; const [x, y] = local(e, n); return measuredAt(x, y); };
      state.built = null; state.gpu = { p, feed: G.buildFeed(p, measured) }; state.version++; state.stageShown = -1;
      clock.finish(); refreshItems(); showGpu(state.gpu); redraw();
      say(G.GPU_LABEL);
      return gpuCounts();
    } catch (e) { say(e.message, true); return null; }
    finally { state.busy = false; }
  }
  // Export route (block-export.mjs): the study's route to the nearest 33 kV substation, its HDD candidates and trench floor.
  // A toggle, drawn alongside whatever else the block shows; nothing is loaded until it is first pressed.
  async function showExport(on = !state.exp) {
    if (state.busy) return null;
    const btn = $('block-export');
    if (!on) { state.exp = null; btn?.setAttribute('aria-pressed', 'false'); redraw(); say('Export route hidden.'); return null; }
    state.busy = true;
    try {
      const site = (await ground.start()).site?.name;
      say('Reading the export route…');
      X ||= await import('./block-export.mjs');
      const f = await X.loadExport(site), p = X.parseExport(f.route, f.witness);
      const sample = ground.sampler(), at = (e, n) => { const h = sample(e, n); if (Number.isFinite(h)) return h; const [x, y] = local(e, n); return measuredAt(x, y); };
      state.exp = { p, groups: X.buildExport(p, at), v: ++state.version };
      btn?.setAttribute('aria-pressed', 'true');
      const rows = X.exportRows(p, { n0, len: formatLength });
      $('block-readout').replaceChildren(...rows.flatMap(([k, t]) => { const dt = doc.createElement('dt'), dd = doc.createElement('dd'); dt.textContent = k; dd.textContent = t; return [dt, dd]; }));
      redraw(); say(X.EXPORT_LABEL);
      return { points: p.pts.length, hdd: p.hdd.length, lengthM: p.lengthM, spoil: p.spoil.electron, groups: state.exp.groups.map(g => g.key) };
    } catch (e) { say(e.message, true); return null; }
    finally { state.busy = false; }
  }
  const exportBatches = () => (state.exp ? state.exp.groups.map(g => ({ key: 'block-export-' + g.key, version: `x${state.exp.v}`,
    positions: g.v, color: X.COLORS[g.key], origin: o3(g.base) })) : []);

  const gpuCounts = () => (state.gpu ? { steps: state.gpu.p.steps.length, groups: state.gpu.feed.groups.length, twisted: state.gpu.p.flags.twisted,
    reveal: state.gpu.p.flags.reveal, unmeasured: state.gpu.feed.unmeasured } : null);
  const gpuHour = () => clock.t() / TOTAL * state.gpu.p.hours;
  function gpuBatches() {
    const h = gpuHour(), out = [];
    for (const g of state.gpu.feed.groups) out.push(prefix('gpu-' + g.key, { v: g.v, base: g.base }, G.countAt(g, h), G.COLORS[g.key]));
    const s = G.feedStage(state.gpu.p, h);
    if (s !== state.stageShown) { state.stageShown = s; $('block-stage').textContent = s; }
    if (state.playing && !clock.playing()) { state.playing = false; clock.pause(); animate(); say(`${G.GPU_LABEL} Built.`); }
    return out.filter(Boolean);
  }
  function showGpu({ p, feed }) {
    const v = viewer(), c = toBng(origin(), v.pos[0], v.pos[1]), n = k => p.steps.filter(s => s.kind === k).length;
    const tw = p.tables.map(t => t.twist).filter(Number.isFinite), f = p.flags;
    const rows = [['Placed at', `${n1(p.origin[0])} E, ${n1(p.origin[1])} N · heading ${n0(p.heading)}° · ${formatLength(Math.hypot(p.origin[0] - c.e, p.origin[1] - c.n))} from you`],
      ['Mean slope', `${n2(p.slope.electron)} % (checked pair ${n2(p.slope.positron)} %)${p.photons.length ? ` · ${p.photons.length} disagreement (${p.photons.join(', ')}), counted` : ''}`],
      ['Tables', `${p.tables.length} · twist ${n2(Math.min(...tw))} to ${n2(Math.max(...tw))}° · ${f.twisted} over the assumed ${n1(p.tol)}° (drawn orange)`],
      ['Piles', f.piles ? `${n0(f.piles)} · ${f.reveal} with a reveal outside the assumed ±${n2(f.revealAdjust)} m adjustment` : 'reveal flags not staged'],
      ['Build feed', `${p.steps.length} steps over ${n0(p.hours)} working hours (assumed rates): ${Object.keys(G.WORDS).map(k => `${n(k)} ${G.WORDS[k].toLowerCase()}`).join(', ')}`],
      ['Ground', feed.unmeasured ? `${n0(feed.unmeasured)} points off the measured tiles were left out` : 'all on measured LiDAR ground'],
      ['Basis', G.GPU_LABEL + (p.receipt ? ` Receipt ${p.receipt.slice(0, 12)}.` : '')]];
    $('block-readout').replaceChildren(...rows.flatMap(([k, t]) => { const dt = doc.createElement('dt'), dd = doc.createElement('dd'); dt.textContent = k; dd.textContent = t; return [dt, dd]; }));
  }

  // All cables of a kind as one line group; marks per inverter (DC, AC) or per circuit (MV).
  function cableGroup(list, by) {
    const v = [], marks = [], base = list[0].points[0];
    list.forEach((c, i) => {
      for (let k = 1; k < c.points.length; k++) for (const p of [c.points[k - 1], c.points[k]]) v.push(p[0] - base[0], p[1] - base[1], p[2] - base[2]);
      if (!by || i === list.length - 1 || list[i + 1][by] !== c[by]) marks.push(v.length / 3);
    });
    return { base, v: new Float32Array(v), marks, items: by ? [...new Set(list.map(c => c[by]))].map(k => list.filter(c => c[by] === k)) : list.map(c => [c]) };
  }

  // ---- drawing: a prefix of each group for the time on the clock ----
  const o3 = base => [base[0] - origin().e, base[1] - origin().n, base[2]];
  const prefix = (key, G, count, color) => (count > 0 && G.v.length ? { key: 'block-' + key, version: `${state.version}:${count}`,
    positions: G.v.subarray(0, count * 3), color, origin: o3(G.base) } : null);
  const upto = (G, whole) => (whole > 0 ? G.marks[Math.min(whole, G.marks.length) - 1] : 0);
  function pulling(key, F, r, color) {                      // the item being pulled in now: its cables so far
    if (!r.part || r.whole >= F.items.length) return null;
    const v = [], base = F.base;
    for (const c of F.items[r.whole]) {
      const pts = partial(c.points, r.part);
      for (let k = 1; k < pts.length; k++) for (const p of [pts[k - 1], pts[k]]) v.push(p[0] - base[0], p[1] - base[1], p[2] - base[2]);
    }
    return v.length ? { key: 'block-pull-' + key, version: `${state.version}:${r.whole}:${r.part.toFixed(4)}`, positions: new Float32Array(v), color, origin: o3(base) } : null;
  }
  function batches() { return [...blockBatches(), ...exportBatches()]; }
  function blockBatches() {
    if (state.gpu) return gpuBatches();
    const b = state.built;
    if (!b) return [];
    const P = progress(clock.t()), G = b.groups, out = [];
    const whole = (k, f) => upto(G[k], reveal(G[k].marks.length, f).whole);
    out.push(prefix('outline', G.outline, upto(G.outline, 1), C.outline), prefix('others', G.others, G.others.v.length / 3, C.others));
    out.push(prefix('tables', G.tables, whole('tables', P.tables), C.tables), prefix('strings', G.strings, whole('strings', P.strings), C.strings));
    out.push(prefix('inverters', G.inverters, whole('inverters', P.inverters), C.inverters));
    const live = P.station >= 1, grid = P.grid >= 1;
    for (const [k, f, col] of [['dc', P.dc, live ? C.dcLive : C.dc], ['ac', P.ac, live ? C.acLive : C.ac], ['mv', P.mv, grid ? C.mvLive : C.mv]]) {
      const F = state.full[k], r = reveal(F.items.length, f);
      out.push(prefix(k, F, upto(F, r.whole), col), pulling(k, F, r, col));
    }
    if (P.station > 0) out.push(prefix('station', G.station, upto(G.station, 1), C.station));
    if (P.mv > 0) out.push(prefix('rmu', G.rmu, G.rmu.v.length / 3, C.rmu));
    if (P.mv >= 1) out.push(prefix('open', G.open, G.open.v.length / 3, C.open));
    if (P.grid > 0) out.push(prefix('grid', G.grid, G.grid.v.length / 3, grid ? C.mvLive : C.grid));
    tick(); refreshItems();
    return out.filter(Boolean);
  }
  // While playing: say the stage when it changes; at the end, stop asking for frames.
  function tick() {
    const s = stageAt(clock.t());
    if (s.index !== state.stageShown) { state.stageShown = s.index; $('block-stage').textContent = `Stage ${s.index + 1} of ${STAGES.length}: ${s.label}`; }
    if (state.playing && !clock.playing()) { state.playing = false; clock.pause(); animate(); say(`${BLOCK_LABEL} Built and energised.`); }
  }

  // Trenches open once their stage starts: DC and AC during the first stage, the ring trenches with the 33 kV stage.
  // Called once a frame (batches) and on every control, never from the ground lookups: those only read items.
  let items = { key: '', list: [] }, dcac = [], mvT = [];
  function refreshItems() {
    const b = state.built;
    if (!b) { if (items.key) items = { key: '', list: [] }; return; }
    if (items.version !== state.version) { dcac = b.trenches.filter(t => t.stage !== 'mv'); mvT = b.trenches.filter(t => t.stage === 'mv'); }
    const P = progress(clock.t()), n = Math.min(dcac.length, reveal(dcac.length, P.trenches).whole + (P.trenches > 0 ? 1 : 0));
    const k = `${state.version}:${n}:${P.mv > 0}`;
    if (k !== items.key) items = { key: k, version: state.version, list: [...dcac.slice(0, n), ...(P.mv > 0 ? mvT : [])] };
  }

  // ---- controls ----
  function play() {
    if (!state.built && !state.gpu) { say('Place the block first.', true); return false; }
    clock.play(); state.playing = true; refreshItems(); animate(); redraw(); return true;
  }
  function pause() { clock.pause(); state.playing = false; refreshItems(); animate(); redraw(); }
  function step() { if (!state.built && !state.gpu) return; clock.step(); state.playing = false; refreshItems(); animate(); redraw(); }
  function clear() {
    state.built = null; state.gpu = null; state.version++; clock.finish(); state.playing = false; refreshItems(); animate();
    $('block-readout').replaceChildren(); $('block-stage').textContent = ''; redraw();
  }

  const counts = () => (state.built ? blockCounts(state.built) : null);
  function showReadout(b) {
    const i = b.summary.inventory, s = b.summary, mv = b.mv, km = m => `${n2(m / 1000)} km`;
    const run = p => p.slice(1).reduce((a, q, k) => a + Math.hypot(q.e - p[k].e, q.n - p[k].n), 0);
    const len = st => km(b.trenches.filter(t => t.stage === st).reduce((a, t) => a + run(t.path), 0));
    const pad = s.pads[0], cp = s.compoundPad;
    const rows = [['Tables', `${i.tables} paired tables · ${n1(i.tableKwp)} kWp each · ${n0(s.blockKwp)} kWp DC`],
      ['Strings', `${i.totalStrings} (${i.connectedStrings} connected, ${i.spareStrings} spare) · ${i.modulesPerString} modules, ${n1(i.stringKwp)} kWp`],
      ['Inverters', `${i.inverters} × ${i.inverterKVA} kVA · ${i.stringsPerInverter[0]} strings in parallel each (12 MPPT × 2), 48 DC conductors`],
      ['Station', `${i.transformers} × ${i.transformerMVA} MVA = ${i.aggregateTransformerMVA} MVA · ${i.invertersPerTransformer} inverters each`],
      ['AC phase cables', `${i.acPhaseCables} × ${i.acAreaMm2} mm² Al, 800 V, ${i.formation}`], ['DC home cables', n0(i.dcHomeCables)],
      ['Piles', `${n0(s.piles.count)} · ${n2(s.piles.min)} to ${n2(s.piles.max)} m out of the measured ground`],
      ['Lowest module edge', `${n2(s.lowEdgeMin)} m above the ground at its lowest`],
      ['Station pad', `level ${n2(pad.level)} m · cut ${n0(pad.cut)} m³, fill ${n0(pad.fill)} m³`],
      ['Trenches', `DC ${len('dc')} · AC ${len('ac')} · 33 kV ${km(mv.trenchM)}`],
      ['33 kV rings', `${mv.rings.length} for ${mv.stations.length} stations (${mv.perRing} a ring by the feeder limit)`],
      ...mv.rings.map(r => ['', `${r.id}: ${r.stations.join(' + ')} · ${r.areaMm2} mm² Al · open at ${r.openAt} · drop ${n2(r.dropPct)} % (${n2(r.outageDropPct)} % one end out)`]),
      ['MV board', `${mv.sections} section${mv.sections > 1 ? 's, normally-open bus tie' : ''} · ${2 * mv.rings.length} ring ways`],
      ['Grid transformer', `${mv.grid.units} × ${mv.grid.mva} MVA ${mv.poc.kv}/33 kV${mv.grid.smallest ? ' (smallest standard size)' : ''}`],
      ['Compound pad', `level ${n2(cp.level)} m · cut ${n0(cp.cut)} m³, fill ${n0(cp.fill)} m³${cp.source ? ' · ' + cp.source : ''}`],
      ['Connection', s.connection ? `${mv.poc.kv} kV line tower ${formatLength(s.connection.distanceM)} from the connection structure (straight tee)`
        : `no ${mv.poc.kv} kV tower loaded near here; connection structure shown`],
      ...(s.overhead ? [['Overhead line', `${s.overhead.kv} kV line ${formatLength(s.overhead.distanceM)} from the nearest table corner` +
        (s.overhead.distanceM < CLEAR_M ? ` (under ${CLEAR_M} m: move the block)` : '')]] : []),
      ['Ground', s.unmeasured ? `${n0(s.unmeasured)} points off the measured tiles took the nearest ground` : 'all on measured LiDAR ground'],
      ['Basis', `${BLOCK_LABEL} Geometry and counts from the owner's explorer station; ring sizes from generic rating rules.`]];
    $('block-readout').replaceChildren(...rows.flatMap(([k, v]) => { const dt = doc.createElement('dt'), dd = doc.createElement('dd'); dt.textContent = k; dd.textContent = v; return [dt, dd]; }));
  }

  $('block-place').addEventListener('click', () => place());
  $('block-gpu').addEventListener('click', () => placeGpu());
  $('block-export')?.addEventListener('click', () => showExport());
  $('block-play').addEventListener('click', () => play());
  $('block-pause').addEventListener('click', () => pause());
  $('block-step').addEventListener('click', () => step());
  $('block-clear').addEventListener('click', () => { clear(); say('Block cleared.'); });
  say(BLOCK_LABEL);
  return { place, placeGpu, showExport, gpuCounts, play, pause, step, clear, batches, trenchItems: () => items.list, counts, animating: () => state.playing,
    fps: FPS, key: () => items.key,
    snapshot: () => ({ placed: !!state.built, t: clock.t(), stage: stageAt(clock.t()).id, playing: state.playing, counts: counts(),
      anchor: state.anchor ? [...state.anchor] : null,
      compound: state.built ? [state.anchor[0] + state.built.mv.compound.x, state.anchor[1] + state.built.mv.compound.y] : null, trenches: state.built ? state.built.trenches.length : 0,
      gpu: state.gpu ? gpuCounts() : null, exportRoute: state.exp ? { hdd: state.exp.p.hdd.length, lengthM: state.exp.p.lengthM } : null }) };
}
