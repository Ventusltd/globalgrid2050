// Design tools in the world: Trench and Cable, drawn by clicking the ground. The substrate hands in the ground,
// the origin and the viewer; this module owns the design panel (world.html #design), the design held in memory
// and the lines it draws. Routes are kept in national-grid metres, so they survive every move of the origin.
// A trench cuts the ground (composeGround): walkers and the drone follow its floor. A cable is laid in trefoil
// on the floor of its own trench, with the governing installation bend radius for its size; bends tighter than
// that are flagged. Numbers come from measure.mjs, so the readout says what the panels and exports will say.

import { toBng, toLocal } from './origin.mjs';
import { rayFromScreen, pickGround } from './pick.mjs';
import { createRouteTool, describeControls } from './route-tool.mjs';
import { createTrench, composeGround, floorGround } from './trench.mjs';
import { routeCable } from './cable-route.mjs';
import { profile, cableSummary, bendRule, coverAchieved, DESIGN_DEFAULTS } from './measure.mjs';
import { formatNumber, formatLength, formatVolume, formatGradient } from './measure-format.mjs';
import { createEarthworks } from './design-earthworks.mjs';
import { BASIS } from './boq-assumptions.mjs';
import { sectionLabel, cableLabel, pressWord, designHint } from './labels.mjs';
import { groundShareOf, groundRowOf, drawProfile } from './design-ground.mjs';
import { snapPoint, connectionText, draftToNearest, measuredShare, snapRing, nearestSubstation, bearingDeg } from './snap.mjs';
import { createSections } from './design-sections.mjs';

const COLOUR = { draft: [1, 1, 1, 0.95], trench: [1, 0.78, 0.45, 1], cable: [0.55, 1, 0.62, 1], tight: [1, 0.36, 0.3, 1],
  snap: [0.45, 0.92, 1, 1] };
const WHEN = 'installation'; // the cable is being pulled in: the larger of the two radii governs the route

// deps: { doc, canvas, fov, baseHeight(x, y), origin(), viewer() -> state, invalidate({ ground }), redraw(), assets() }
// assets() -> [{ kind, e, n, kv }] grid equipment (snap.mjs) the cable snaps to and ends at (may be empty).
// measuredAt(x, y) -> measured ground or NaN: the readout says how much of a route stands on measured LiDAR.
// nearest(e, n) -> Promise<substation asset | null>: the nearest substation anywhere (the national index, read tile by
// tile). Without it the nearest of assets() is used. animate(): the solar block's build sequence started or stopped.
export function createDesign({ doc, canvas, fov, baseHeight, origin, viewer, invalidate, redraw, assets = () => [],
  measuredAt = null, onChange = () => {}, nearest = null, extraItems = () => [], animate = () => {} }) {
  const $ = id => doc.getElementById(id);
  const catalogue = { sections: [], cables: [], rules: [], json: null };
  // view: what the panel is showing. 'choose' a tool, 'draw' a route, or the 'result' of the one just finished.
  const design = { tool: null, trenches: [], cables: [], finished: 0, drafts: 0, last: null, view: 'choose' };
  const coarse = matchMedia('(pointer: coarse)').matches, press = pressWord(coarse);
  let built = { o: -1, g: -1, f: -1, key: '', ground: baseHeight, trenches: [], cables: [] };
  let groundVersion = () => 0;
  let snaps = []; // snaps[i]: the asset route point i sits on, if it snapped (kept in step with the route's points)
  const route = createRouteTool({ onChange: st => {
    snaps.length = Math.min(snaps.length, st.points.length); design.drafts++; if (st.points.length) design.view = 'draw';
    showReadout(); redraw();
  } });
  // Road, pad, fence, piles and drilled crossing; drum schedule and bill of quantities (design-earthworks.mjs).
  const works = createEarthworks({ doc, origin, baseHeight, groundVersion: () => groundVersion(), heightAt: (x, y) => heightAt(x, y),
    catalogue: () => catalogue, cables: () => build().cables.map(c => ({ route: c, spec: c.spec })), designItems, extraItems,
    groundRow: pts => groundRow(pts) });
  const groundShare = pts => groundShareOf(pts, measuredAt), groundRow = pts => groundRowOf(pts, measuredAt); // design-ground.mjs

  const section = id => catalogue.sections.find(s => s.id === id) || catalogue.sections[0];
  const cableSpec = id => catalogue.cables.find(c => c.id === id) || catalogue.cables[0];
  const toLocalPts = path => path.map(p => toLocal(origin(), p.e, p.n));
  // Specification, ground condition, plant layout and solar block (design-sections.mjs, each loaded when first opened).
  const extras = createSections({ doc, origin, viewer, measuredAt, heightAt: (x, y) => heightAt(x, y), baseHeight, assets, nearest,
    redraw, animate, onChange: () => showReadout() });
  const effOf = sectionId => extras.effOf(section(sectionId)); // the trench as it will be dug, in the chosen ground
  const trenchOf = (sectionId, pts, eff = effOf(sectionId)) => createTrench({ path: pts, width: eff.width, depth: eff.depth, benchSlope: eff.benchSlope });
  // Trefoil on the floor: the centreline is lifted so the lower two cores rest on it (on the bed, above any over-dig).
  const cableOf = (cableId, ground, pts, sectionId, overdig = 0) => {
    const spec = cableSpec(cableId), od = spec.od_mm / 1000;
    const bed = (Number(section(sectionId)?.bedding?.thickness_mm) || 0) / 1000 + overdig;
    const bend = bendRule(catalogue.json, { voltageKv: spec.voltage_kv, when: WHEN, odMm: spec.od_mm });
    // The bend rule applies at the cable's inner edge, so the centreline bends at rule + OD/2.
    const r = routeCable({ points: pts, minBendRadius: (bend.radius || 0) + od / 2,
      depthBelowGround: -(bed + od / 2 + od / (2 * Math.sqrt(3))), groundAt: ground, formation: 'trefoil', spacing: od, step: 0.5 });
    return Object.assign(r, { spec, bend, summary: cableSummary(r, { cables: catalogue.json, cableId: spec.id, when: WHEN }) });
  };

  // Local geometry, rebuilt only when the origin, the ground or the finished design changes (plain number checks:
  // heightAt runs this for every height anyone asks for).
  function build() {
    const o = origin(), g = groundVersion(), w = works.version(), bk = extras.key();
    if (built.o === o.id && built.g === g && built.f === design.finished && built.w === w && built.bk === bk) return built;
    const all = [...design.trenches, ...design.cables], under = works.ground(baseHeight); // roads and pads first
    const extra = extras.extra(toLocalPts); // the solar block's open trenches, after the drawn ones
    const trenches = [...all.map(t => trenchOf(t.section, toLocalPts(t.path), t.eff)), ...extra.trenches];
    const ground = trenches.length ? composeGround(under, trenches) : under;
    const sections = [...all.map(t => extras.cross(section(t.section), t.eff || effOf(t.section), t.cable ? cableSpec(t.cable).od_mm : null)),
      ...extra.sections];
    built = { o: o.id, g, w, f: design.finished, bk, key: `${o.id}:${g}:${w}:${design.finished}:${bk}`, ground, trenches, sections, cables: [],
      near: {}, walls: [] };
    // Each cable lies on its own trench's floor (the trench it was drawn with), not on the composed ground.
    const n = design.trenches.length;
    built.cables = design.cables.map((c, i) => cableOf(c.cable, floorGround(trenches[n + i], under), toLocalPts(c.path), c.section, c.eff?.overdig));
    return built;
  }
  const heightAt = (x, y) => build().ground(x, y);
  // Trenches and cables as the bill of quantities reads them (boq.mjs); every cable lies in its own trench.
  function designItems() {
    const b = build(), n = design.trenches.length;
    return [...design.trenches, ...design.cables].flatMap((t, i) => {
      const id = i < n ? `trench-${i + 1}` : `cable-${i - n + 1}`;
      // Spoil from the trench as rebuilt on the ground of now (cached per build), not the figure kept at Finish.
      const spoil = (b.spoil ||= [])[i] ??= b.trenches[i].spoilVolumeOn(baseHeight);
      const trench = { id, kind: 'trench', sectionId: t.section, results: { length3d: b.trenches[i].length3dOn(baseHeight), spoil } };
      // The trench cut for a cable is billed with it (spoil, bedding, tile), never left out.
      // A two-circuit section carries two trefoils: the bill counts both (code review 3); the drawing shows one route.
      return i < n ? [trench] : [{ id: `${id}-cable`, kind: 'cable', cableId: t.cable, circuits: section(t.section).circuits || 1, results: b.cables[i - n],
        trench: { sectionId: trench.sectionId, results: trench.results } }];
    });
  }

  // Positions relative to their first point, worked out in doubles, so far-out lines stay sharp on the GPU.
  function batch(key, version, pos, color) {
    if (!pos || pos.length < 6) return null;
    const o = [pos[0], pos[1], pos[2]], out = new Float32Array(pos.length);
    for (let i = 0; i < pos.length; i++) out[i] = pos[i] - o[i % 3];
    return { key, version, positions: out, color, origin: o };
  }
  const marker = (v, [x, y, z], h, arm) => v.push(x, y, z, x, y, z + h, x - arm, y, z + h, x + arm, y, z + h, x, y - arm, z + h, x, y + arm, z + h);
  const tightIndices = c => [...new Set([...c.violations.map(v => v.index), ...c.summary.below.map(b => b.index)])].sort((a, b) => a - b);

  function batches() {
    const b = build(), out = [];
    b.trenches.forEach((t, i) => out.push(batch('design-trench-' + i, b.key, b.walls[i] ||= t.wallLines(baseHeight), COLOUR.trench)));
    out.push(...extras.detail(b, batch)); // cross-sections near the viewer; cables drawn at their outside diameter
    b.cables.forEach((c, i) => {
      const tight = [], pts = toLocalPts(design.cables[i].path);
      for (const k of tightIndices(c)) { const [x, y] = pts[k]; marker(tight, [x, y, heightAt(x, y)], 3, 1.2); }
      out.push(batch('design-tight-' + i, b.key, tight, COLOUR.tight));
    });
    const d = route.state.points, v = [];
    for (let i = 0; i < d.length; i++) {
      const [x, y] = d[i], z = heightAt(x, y) + 0.05;
      if (i) { const [px, py] = d[i - 1]; v.push(px, py, heightAt(px, py) + 0.05, x, y, z); }
      marker(v, [x, y, z], 1.5, 0.4);
    }
    out.push(batch('design-draft', `${b.key}:${design.drafts}`, v, COLOUR.draft), ...works.batches());
    const rings = [];
    d.forEach(([x, y], i) => { if (snaps[i]) rings.push(...snapRing([x, y, heightAt(x, y)])); });
    out.push(batch('design-snap', `${b.key}:${design.drafts}`, rings, COLOUR.snap), ...extras.batches());
    return out.filter(Boolean);
  }

  // ---- readout ----------------------------------------------------------------------------------------
  // Where the route meets the grid: the substation it ends at, else the nearest substation's distance and bearing.
  // The nearest substation is looked up once per end point; while it is being read the row says so, and the row is
  // filled in (live or finished readout alike) when the answer lands.
  const nearCache = new Map(), waiting = [];
  function nearFrom(end) {
    if (!nearest) return nearestSubstation(end, assets());
    const k = `${Math.round(end.e)},${Math.round(end.n)}`;
    if (nearCache.has(k)) return nearCache.get(k);
    if (nearCache.size > 500) nearCache.clear();
    nearCache.set(k, 'pending');
    Promise.resolve().then(() => nearest(end.e, end.n)).catch(() => null).then(a => {
      nearCache.set(k, a ? { asset: a, d: Math.hypot(a.e - end.e, a.n - end.n), bearing: bearingDeg(end, a) } : null);
      for (const w of waiting.splice(0).filter(w => { if (w.k !== k) waiting.push(w); return w.k === k; })) {
        w.row[1] = connectionText(nearCache.get(k), w.endAsset);
      }
      showReadout();
    });
    return 'pending';
  }
  function gridRow(pts, endAsset) {
    const [x, y] = pts[pts.length - 1], end = toBng(origin(), x, y);
    const row = ['Grid connection', ''];
    const near = endAsset?.kind === 'substation' ? null : nearFrom(end);
    row[1] = connectionText(near, endAsset);
    if (near === 'pending') waiting.push({ k: `${Math.round(end.e)},${Math.round(end.n)}`, row, endAsset });
    return row;
  }
  // Ground for the profile, walked in route order: measured LiDAR where there is some; past its edge the last
  // measured level is held, so the edge of the data never shows up as a cliff in the gradient.
  function levelsAlong() {
    if (!measuredAt) return baseHeight;
    let last = NaN;
    return (x, y) => { const h = measuredAt(x, y); if (Number.isFinite(h)) last = h; return Number.isFinite(last) ? last : baseHeight(x, y); };
  }
  // Rows for the readout and the level profile. spoil: undefined = not yet worked out.
  function measure(kind, sectionId, cableId, pts, spoil, endAsset = null, eff = effOf(sectionId)) {
    const s = section(sectionId), t = trenchOf(s.id, pts, eff);
    const rows = [['Trench', `${sectionLabel(s)} · ${formatNumber(eff.width, 2)} m floor × ${formatNumber(eff.depth, 2)} m deep`]];
    let plan = pts, odMm = null;
    if (kind === 'cable') {
      const c = cableOf(cableId, heightAt, pts, sectionId, eff.overdig), cs = c.summary, tight = tightIndices(c);
      odMm = c.spec.od_mm;
      plan = c.centreline.map(p => [p[0], p[1]]);
      rows.unshift(['Cable', cableLabel(c.spec)]);
      rows.push(['Minimum bend radius', cs.required.radius == null ? `no ${WHEN} rule for this cable`
        : `${formatNumber(cs.required.radius, 2)} m (${formatNumber(cs.required.multiple, 0)} × OD, ${WHEN})`],
      ['Cable length (plan)', formatLength(cs.length2d)], ['Cable length (3D)', formatLength(cs.length3d)],
      ['Tight bends', tight.length ? `${tight.length} (at point${tight.length > 1 ? 's' : ''} ${tight.map(k => k + 1).join(', ')})` : 'none']);
    }
    const cv = coverAchieved(s, odMm);
    rows.splice(kind === 'cable' ? 2 : 1, 0,
      ['Cover', `${formatNumber(cv.cover, 2)} m to the top of the ${s.duct_od_mm ? 'duct' : 'cable'} · section minimum ${formatNumber(cv.required, 2)} m`
        + (cv.ok ? '' : ' · too shallow: choose a deeper section'), !cv.ok],
      ['Section basis', `${s.status}: ${s.source}`, s.status !== 'verified'], ...extras.rows(eff));
    const p = profile(levelsAlong(), plan, 1);
    rows.push(['Trench length (plan)', formatLength(t.length2d)], ['Trench length (3D)', formatLength(t.length3dOn(baseHeight))],
      ['Spoil volume', spoil === undefined ? 'on finish' : spoil === null ? 'working out…' : `${formatVolume(spoil, 2)} (${BASIS.spoil})`], ...extras.spoilRows(spoil, eff),
      ['Ground level', groundShare(pts).none ? 'not measured (no LiDAR here)' : `${formatNumber(p.min, 2)} to ${formatNumber(p.max, 2)} ${BASIS.datum}`],
      groundRow(pts), ['Steepest gradient', groundShare(pts).none ? 'not measured' : formatGradient(p.gradient.max)],
      gridRow(pts, endAsset));
    if (measuredAt) {
      const m = measuredShare(pts, measuredAt);
      if (m.known < m.total - 0.5) rows.push(['Measured ground', `${formatLength(m.known)} of ${formatLength(m.total)}`
        + ' on measured LiDAR; beyond it levels are held flat, not measured']);
    }
    if (design.drafted) rows.push(['Route', 'straight-line first draft to the substation; edit it (Undo removes the last leg)']);
    return { rows, profile: p, depth: eff.depth };
  }
  function showReadout() {
    const pts = route.state.points.map(p => [p[0], p[1]]);
    if (!design.tool && design.view === 'draw') design.view = 'choose';
    // One line that says what to do next, and which parts of the panel show (world.html styles #design[data-state]).
    $('design').dataset.state = design.view;
    $('design-hint').textContent = designHint(design.tool, design.view, pts.length, press);
    let m = design.last || { rows: [['Status', design.tool ? `${press.toLowerCase()} the ground to start a ${design.tool}` : 'choose a design tool']] };
    if (works.handles(design.tool) && (pts.length || ![design.tool, 'schedule'].includes(design.last?.kind))) m = works.measure(design.tool, pts);
    else if (works.handles(design.tool)) m = design.last;
    else if (design.tool === 'boundary') m = { rows: [['Status', `${pts.length} corner${pts.length === 1 ? '' : 's'} · Done closes the boundary`]] };
    else if (design.tool && pts.length >= 2) {
      try { m = measure(design.tool, $('trench-section').value, $('cable-type').value, pts, undefined, snaps[pts.length - 1]); }
      catch (e) { m = { rows: [['Status', e.message]] }; }
    } else if (design.tool && pts.length === 1) m = { rows: [['Status', '1 point · add another']] };
    $('design-readout').replaceChildren(...m.rows.flatMap(([k, v, warn]) => {
      const dt = doc.createElement('dt'), dd = doc.createElement('dd');
      dt.textContent = k; dd.textContent = v;
      if ((k === 'Tight bends' && v !== 'none') || warn) dd.className = 'warn';
      return [dt, dd];
    }));
    drawProfile(doc, m.profile ? m : null);
    const toSub = $('design-to-substation');
    if (toSub) toSub.disabled = design.tool !== 'cable' || !pts.length || snaps[pts.length - 1]?.kind === 'substation';
  }

  // ---- actions ----------------------------------------------------------------------------------------
  // The results of a Finish are brought into view in the Design sheet (on a phone they sat below its fold).
  const showResults = () => $('design-readout')?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  function finish() {
    const done = finishNow();
    if (done) showResults();
    return done;
  }
  function finishNow() {
    const pts = route.state.points, kind = design.tool;
    if (works.handles(kind)) {
      const r = works.finish(kind, pts.map(p => [p[0], p[1]]));
      if (!r) return false;
      design.last = r;
      if (r.done) { design.view = 'result'; route.clear(); invalidate({ ground: true }); onChange(); } // roads and pads are new ground
      showReadout();
      return true;
    }
    if (!kind || !route.finish()) return false;
    if (kind === 'boundary') { // the plant boundary (Plant layout), not a trench
      extras.setBoundary(pts.map(([x, y]) => toBng(origin(), x, y))).then(ok => { if (ok) choose('boundary'); redraw(); });
      route.clear(); return true;
    }
    const o = origin(), path = pts.map(([x, y]) => toBng(o, x, y)), plan = pts.map(p => [p[0], p[1]]);
    const endAsset = snaps[pts.length - 1] || null;
    const item = { path, section: $('trench-section').value, ...(kind === 'cable' ? { cable: $('cable-type').value } : {}),
      ...(endAsset ? { ends_at: { kind: endAsset.kind, e: endAsset.e, n: endAsset.n, kv: endAsset.kv ?? null } } : {}) };
    item.eff = effOf(item.section); item.ground = extras.snapshot().options.ground; item.spec = item.eff.specLabel;
    (kind === 'trench' ? design.trenches : design.cables).push(item);
    design.finished++;
    design.lastItem = { key: design.finished, kind, path: path.map(p => [p.e, p.n]) };
    const last = measure(kind, item.section, item.cable, plan, null, endAsset, item.eff); // measured on the ground it has just cut
    design.last = last; design.drafted = false; design.view = 'result';
    route.clear();
    invalidate({ ground: true }); // new ground: walkers and the drone follow the trench floor
    onChange();
    // Spoil is a fine grid over the whole trench; work it out after the frame, then say it.
    setTimeout(() => {
      const spoil = trenchOf(item.section, plan, item.eff).spoilVolumeOn(baseHeight);
      item.spoil_m3 = spoil;
      if (design.last === last) { design.last = measure(kind, item.section, item.cable, plan, spoil, endAsset, item.eff); showReadout(); }
    }, 0);
    return true;
  }
  function choose(tool) {
    design.tool = design.tool === tool ? null : tool;
    works.choose(design.tool);
    design.drafted = false; design.view = design.tool ? 'draw' : 'choose';
    route.clear();
    for (const b of doc.querySelectorAll('[data-tool]')) b.setAttribute('aria-pressed', String(b.dataset.tool === design.tool));
    showReadout();
  }
  function pickAt(x, y) {
    if (!design.tool) return false;
    const s = viewer();
    const ray = rayFromScreen(x, y, canvas.clientWidth, canvas.clientHeight, s.pos, s.yaw, s.pitch, fov);
    const p = pickGround(ray, heightAt, { maxDistance: 3000 });
    if (!p) return false;
    const snap = design.tool === 'cable' ? snapPoint(p, assets(), origin()) : null;
    return add(snap ? [snap.x, snap.y, heightAt(snap.x, snap.y)] : p, snap?.asset);
  }
  function add(p, asset = null) {
    const n = route.state.points.length;
    snaps[n] = asset; // set first: addPoint redraws the readout
    if (route.addPoint(p)) return true;
    snaps.length = n;
    return false;
  }
  // 'Route to nearest substation': a straight first draft from the last point, ending on the substation.
  // Async: the national index may need a tile read first. Resolves true when the draft point was added.
  async function toNearestSubstation() {
    const pts = route.state.points;
    if (design.tool !== 'cable' || !pts.length) return false;
    const last = pts[pts.length - 1], end = toBng(origin(), last[0], last[1]), n = pts.length;
    const asset = nearest ? await nearest(end.e, end.n).catch(() => null) : nearestSubstation(end, assets())?.asset;
    if (route.state.points.length !== n || route.state.finished) return false; // the route changed meanwhile
    const t = draftToNearest(route.state.points[n - 1], asset, origin());
    if (!t) return false;
    design.drafted = true;
    return add([t.x, t.y, heightAt(t.x, t.y)], t.asset);
  }
  // The origin moved by (dx, dy): the route being drawn moves the other way, so it stays put in the world.
  const shift = (dx, dy) => route.state.points.forEach((p, i) => route.movePoint(i, [p[0] - dx, p[1] - dy, p[2]]));

  // ---- page wiring ------------------------------------------------------------------------------------
  for (const b of doc.querySelectorAll('[data-tool]')) b.addEventListener('click', () => { choose(b.dataset.tool); canvas.focus(); });
  $('design-undo').addEventListener('click', () => { design.drafted = false; route.removeLast(); });
  $('design-finish').addEventListener('click', () => finish());
  $('design-clear').addEventListener('click', () => { design.drafted = false; route.clear(); });
  $('design-to-substation')?.addEventListener('click', () => { toNearestSubstation(); canvas.focus(); });
  const schedule = fn => { design.last = { ...fn(), kind: 'schedule' }; if (!design.tool) design.view = 'result'; showReadout(); redraw(); };
  $('design-drums')?.addEventListener('click', () => schedule(works.drumSchedule));
  $('design-boq')?.addEventListener('click', () => schedule(works.billOfQuantities));
  $('works-option')?.addEventListener('change', () => { showReadout(); canvas.focus(); });
  // Section and cable choices sit behind Options; on a phone, choosing one folds them away again so the ground stays clear.
  const options = open => { $('design-options').hidden = !open; $('design-options-toggle').setAttribute('aria-expanded', String(open)); };
  $('design-options-toggle').addEventListener('click', () => options($('design-options').hidden));
  for (const id of ['trench-section', 'cable-type']) $(id).addEventListener('change', () => { if (coarse) options(false); showReadout(); canvas.focus(); });
  addEventListener('keydown', e => {
    if (!design.tool || e.ctrlKey || e.metaKey || e.altKey) return;
    if (['SELECT', 'INPUT', 'TEXTAREA', 'BUTTON'].includes(e.target?.tagName)) return;
    if (e.code === 'Backspace') { design.drafted = false; route.removeLast(); e.preventDefault(); }
    else if (e.code === 'Enter' || e.code === 'NumpadEnter') { finish(); e.preventDefault(); }
    else if (e.code === 'Escape') { design.drafted = false; route.clear(); }
  });
  $('design-keys').className = coarse ? 'touch' : 'keys';
  $('design-keys').replaceChildren(...describeControls({ touch: coarse }).flatMap(([k, v]) => {
    const dt = doc.createElement('dt'), dd = doc.createElement('dd');
    dt.textContent = k; dd.textContent = v; return [dt, dd];
  }));

  async function loadCatalogue() {
    try {
      const get = async p => { const r = await fetch(p, { cache: 'no-cache' }); if (!r.ok) throw Error(`${p}: HTTP ${r.status}`); return r.json(); };
      const [cables, trenches] = await Promise.all([get('./world/data/cables.json'), get('./world/data/trench-sections.json')]);
      Object.assign(catalogue, { sections: trenches.sections || [], cables: cables.cables || [], rules: cables.rules || [], json: cables });
      const fill = (id, items, label, chosen) => $(id).replaceChildren(...items.map(it => {
        const o = new Option(label(it), it.id); o.selected = it.id === chosen; return o;
      }));
      fill('trench-section', catalogue.sections, s => `${sectionLabel(s)} · ${s.trench_width_m} × ${s.trench_depth_m} m`, DESIGN_DEFAULTS.section);
      fill('cable-type', catalogue.cables, cableLabel, DESIGN_DEFAULTS.cable);
    } catch (e) {
      for (const b of doc.querySelectorAll('[data-tool]')) b.disabled = true;
      design.last = { rows: [['Status', 'design data could not be loaded: ' + e.message]] };
    }
    showReadout();
  }

  return {
    heightAt, batches, pickAt, shift, finish, loadCatalogue, toNearestSubstation,
    animating: extras.animating, plantApi: extras.plantApi, blockApi: extras.blockApi, // Plant layout and Solar block
    setGroundVersion: fn => { groundVersion = fn; },
    // The last finished trench or cable: { key, kind, path: [[e, n], ...] } in national-grid metres, or null.
    lastFinished: () => design.lastItem || null,
    putDown: () => { if (design.tool) choose(design.tool); },
    drawing: () => !!design.tool,
    // Replaces the whole design (open a file or a link, undo, redo). Paths are national-grid metres.
    // Items that cannot be built (under two points, unknown section or cable) are left out, so one bad file or
    // link never stops the world drawing (review, code finding 1).
    replace({ trenches = [], cables = [], works: earthworks = [] } = {}) {
      route.clear();
      works.replace(earthworks);
      const ok = t => { try { trenchOf(t.section, toLocalPts(t.path)); if (t.cable !== undefined) cableSpec(t.cable); return true; } catch { return false; } };
      Object.assign(design, { trenches: trenches.filter(ok).map(t => ({ ...t })), cables: cables.filter(ok).map(c => ({ ...c })),
        last: null, lastItem: null });
      design.finished++;
      showReadout();
      invalidate({ ground: true });
    },
    // The design in memory, in national-grid metres (export and import come later).
    snapshot: () => JSON.parse(JSON.stringify({ tool: design.tool, trenches: design.trenches, cables: design.cables, works: works.snapshot(),
      draft: route.state.points.map(([x, y]) => toBng(origin(), x, y)),
      snaps: route.state.points.map((_, i) => (snaps[i] ? { kind: snaps[i].kind, e: snaps[i].e, n: snaps[i].n } : null)),
      readout: design.last?.rows || null, ...extras.snapshot() }))
  };
}
