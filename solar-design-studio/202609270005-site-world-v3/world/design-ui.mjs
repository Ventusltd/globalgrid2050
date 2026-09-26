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
import { profile, cableSummary, bendRule } from './measure.mjs';
import { formatNumber, formatLength, formatVolume, formatGradient } from './measure-format.mjs';
import { createEarthworks } from './design-earthworks.mjs';
import { BASIS } from './boq-assumptions.mjs';
import { snapPoint, connectionText, draftToNearest, measuredShare, snapRing } from './snap.mjs';

const COLOUR = { draft: [1, 1, 1, 0.95], trench: [1, 0.78, 0.45, 1], cable: [0.55, 1, 0.62, 1], tight: [1, 0.36, 0.3, 1],
  snap: [0.45, 0.92, 1, 1] };
const WHEN = 'installation'; // the cable is being pulled in: the larger of the two radii governs the route
const SVG = 'http://www.w3.org/2000/svg';

// deps: { doc, canvas, fov, baseHeight(x, y), origin(), viewer() -> state, invalidate({ ground }), redraw(), assets() }
// assets() -> [{ kind, e, n, kv }] grid equipment (snap.mjs) the cable snaps to and ends at (may be empty).
// measuredAt(x, y) -> measured ground or NaN: the readout says how much of a route stands on measured LiDAR.
export function createDesign({ doc, canvas, fov, baseHeight, origin, viewer, invalidate, redraw, assets = () => [],
  measuredAt = null, onChange = () => {} }) {
  const $ = id => doc.getElementById(id);
  const catalogue = { sections: [], cables: [], rules: [], json: null };
  const design = { tool: null, trenches: [], cables: [], finished: 0, drafts: 0, last: null };
  let built = { o: -1, g: -1, f: -1, key: '', ground: baseHeight, trenches: [], cables: [] };
  let groundVersion = () => 0;
  let snaps = []; // snaps[i]: the asset route point i sits on, if it snapped (kept in step with the route's points)
  const route = createRouteTool({ onChange: st => {
    snaps.length = Math.min(snaps.length, st.points.length); design.drafts++; showReadout(); redraw();
  } });
  // Road, pad, fence, piles and drilled crossing; drum schedule and bill of quantities (design-earthworks.mjs).
  const works = createEarthworks({ doc, origin, baseHeight, groundVersion: () => groundVersion(), heightAt: (x, y) => heightAt(x, y),
    catalogue: () => catalogue, cables: () => build().cables.map(c => ({ route: c, spec: c.spec })), designItems });

  const section = id => catalogue.sections.find(s => s.id === id) || catalogue.sections[0];
  const cableSpec = id => catalogue.cables.find(c => c.id === id) || catalogue.cables[0];
  const toLocalPts = path => path.map(p => toLocal(origin(), p.e, p.n));
  const trenchOf = (sectionId, pts) => {
    const s = section(sectionId);
    return createTrench({ path: pts, width: s.trench_width_m, depth: s.trench_depth_m });
  };
  // Trefoil on the floor: the centreline is lifted so the lower two cores rest on it.
  const cableOf = (cableId, ground, pts) => {
    const spec = cableSpec(cableId), od = spec.od_mm / 1000;
    const bend = bendRule(catalogue.json, { voltageKv: spec.voltage_kv, when: WHEN, odMm: spec.od_mm });
    // The bend rule applies at the cable's inner edge, so the centreline bends at rule + OD/2.
    const r = routeCable({ points: pts, minBendRadius: (bend.radius || 0) + od / 2,
      depthBelowGround: -(od / 2 + od / (2 * Math.sqrt(3))), groundAt: ground, formation: 'trefoil', spacing: od, step: 0.5 });
    return Object.assign(r, { spec, bend, summary: cableSummary(r, { cables: catalogue.json, cableId: spec.id, when: WHEN }) });
  };

  // Local geometry, rebuilt only when the origin, the ground or the finished design changes (plain number checks:
  // heightAt runs this for every height anyone asks for).
  function build() {
    const o = origin(), g = groundVersion(), w = works.version();
    if (built.o === o.id && built.g === g && built.f === design.finished && built.w === w) return built;
    const all = [...design.trenches, ...design.cables], under = works.ground(baseHeight); // roads and pads first
    const trenches = all.map(t => trenchOf(t.section, toLocalPts(t.path)));
    const ground = trenches.length ? composeGround(under, trenches) : under;
    built = { o: o.id, g, w, f: design.finished, key: `${o.id}:${g}:${w}:${design.finished}`, ground, trenches, cables: [] };
    // Each cable lies on its own trench's floor (the trench it was drawn with), not on the composed ground.
    const n = design.trenches.length;
    built.cables = design.cables.map((c, i) => cableOf(c.cable, floorGround(trenches[n + i], under), toLocalPts(c.path)));
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
      return i < n ? [trench] : [{ id: `${id}-cable`, kind: 'cable', cableId: t.cable, results: b.cables[i - n],
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
    b.trenches.forEach((t, i) => out.push(batch('design-trench-' + i, b.key, t.wallLines(baseHeight), COLOUR.trench)));
    b.cables.forEach((c, i) => {
      out.push(batch('design-cable-' + i, b.key, c.drawLines({ includeCentreline: false }), COLOUR.cable));
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
    out.push(batch('design-snap', `${b.key}:${design.drafts}`, rings, COLOUR.snap));
    return out.filter(Boolean);
  }

  // ---- readout ----------------------------------------------------------------------------------------
  // Where the route meets the grid: the substation it ends at, else the nearest substation's distance and bearing.
  function gridRow(pts, endAsset) {
    const list = assets(), [x, y] = pts[pts.length - 1];
    return list.length ? connectionText(toBng(origin(), x, y), list, endAsset) : 'no grid equipment loaded here';
  }
  // Ground for the profile, walked in route order: measured LiDAR where there is some; past its edge the last
  // measured level is held, so the edge of the data never shows up as a cliff in the gradient.
  function levelsAlong() {
    if (!measuredAt) return baseHeight;
    let last = NaN;
    return (x, y) => { const h = measuredAt(x, y); if (Number.isFinite(h)) last = h; return Number.isFinite(last) ? last : baseHeight(x, y); };
  }
  // Rows for the readout and the level profile. spoil: undefined = not yet worked out.
  function measure(kind, sectionId, cableId, pts, spoil, endAsset = null) {
    const s = section(sectionId), t = trenchOf(s.id, pts);
    const rows = [['Trench', `${s.id} · ${s.trench_width_m} m wide × ${s.trench_depth_m} m deep`]];
    let plan = pts;
    if (kind === 'cable') {
      const c = cableOf(cableId, heightAt, pts), cs = c.summary, tight = tightIndices(c);
      plan = c.centreline.map(p => [p[0], p[1]]);
      rows.unshift(['Cable', `${c.spec.voltage_kv} kV ${c.spec.conductor} ${c.spec.csa_mm2} mm² · OD ${c.spec.od_mm} mm`]);
      rows.push(['Minimum bend radius', cs.required.radius == null ? `no ${WHEN} rule for this cable`
        : `${formatNumber(cs.required.radius, 2)} m (${formatNumber(cs.required.multiple, 0)} × OD, ${WHEN})`],
      ['Cable length (plan)', formatLength(cs.length2d)], ['Cable length (3D)', formatLength(cs.length3d)],
      ['Tight bends', tight.length ? `${tight.length} (at point${tight.length > 1 ? 's' : ''} ${tight.map(k => k + 1).join(', ')})` : 'none']);
    }
    const p = profile(levelsAlong(), plan, 1);
    rows.push(['Trench length (plan)', formatLength(t.length2d)], ['Trench length (3D)', formatLength(t.length3dOn(baseHeight))],
      ['Spoil volume', spoil === undefined ? 'on finish' : spoil === null ? 'working out…' : `${formatVolume(spoil, 2)} (${BASIS.spoil})`],
      ['Ground level', `${formatNumber(p.min, 2)} to ${formatNumber(p.max, 2)} ${BASIS.datum}`],
      ['Ground', BASIS.ground], ['Steepest gradient', formatGradient(p.gradient.max)],
      ['Grid connection', gridRow(pts, endAsset)]);
    if (measuredAt) {
      const m = measuredShare(pts, measuredAt);
      // No LiDAR under the route at all: say so instead of naming the survey the levels did not come from.
      if (m.known < 0.5) for (const r of rows) if (r[0] === 'Ground' || r[0] === 'Ground level') r[1] = 'no LiDAR loaded here: levels held flat, not measured';
      if (m.known < m.total - 0.5) rows.push(['Measured ground', `${formatLength(m.known)} of ${formatLength(m.total)}`
        + ' on measured LiDAR; beyond it levels are held flat, not measured']);
    }
    if (design.drafted) rows.push(['Route', 'straight-line first draft to the substation; edit it (Undo removes the last leg)']);
    return { rows, profile: p, depth: s.trench_depth_m };
  }
  function drawProfile(m) {
    const box = $('design-profile-box'), svg = $('design-profile');
    box.hidden = !m;
    if (!m) return;
    const W = 300, H = 90, L = 4, R = 296, T = 14, B = 76, pr = m.profile;
    const lo = pr.min - m.depth, hi = Math.max(pr.max, lo + 0.5), len = Math.max(pr.length2d, 1e-6);
    const X = s => L + (s / len) * (R - L), Y = z => B - ((z - lo) / (hi - lo)) * (B - T);
    const line = (dz, cls) => {
      const el = doc.createElementNS(SVG, 'polyline');
      el.setAttribute('points', pr.pairs.map(([s, z]) => `${X(s).toFixed(1)},${Y(z - dz).toFixed(1)}`).join(' '));
      el.setAttribute('class', cls); return el;
    };
    const text = (x, y, s, anchor = 'start') => {
      const el = doc.createElementNS(SVG, 'text');
      Object.entries({ x, y, 'text-anchor': anchor }).forEach(([k, v]) => el.setAttribute(k, v));
      el.textContent = s; return el;
    };
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.replaceChildren(line(0, 'ground'), line(m.depth, 'floor'), text(L, 10, `${formatNumber(hi, 1)} m`),
      text(L, H - 2, `${formatNumber(lo, 1)} m`), text(R, H - 2, formatLength(pr.length2d), 'end'));
  }
  function showReadout() {
    const pts = route.state.points.map(p => [p[0], p[1]]);
    let m = design.last || { rows: [['Status', design.tool ? `click the ground to start a ${design.tool}` : 'choose a design tool']] };
    if (works.handles(design.tool) && (pts.length || ![design.tool, 'schedule'].includes(design.last?.kind))) m = works.measure(design.tool, pts);
    else if (works.handles(design.tool)) m = design.last;
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
    drawProfile(m.profile ? m : null);
    const toSub = $('design-to-substation');
    if (toSub) toSub.disabled = design.tool !== 'cable' || !pts.length || snaps[pts.length - 1]?.kind === 'substation';
  }

  // ---- actions ----------------------------------------------------------------------------------------
  function finish() {
    const pts = route.state.points, kind = design.tool;
    if (works.handles(kind)) {
      const r = works.finish(kind, pts.map(p => [p[0], p[1]]));
      if (!r) return false;
      design.last = r;
      if (r.done) { route.clear(); invalidate({ ground: true }); onChange(); } // roads and pads are new ground
      showReadout();
      return true;
    }
    if (!kind || !route.finish()) return false;
    const o = origin(), path = pts.map(([x, y]) => toBng(o, x, y)), plan = pts.map(p => [p[0], p[1]]);
    const endAsset = snaps[pts.length - 1] || null;
    const item = { path, section: $('trench-section').value, ...(kind === 'cable' ? { cable: $('cable-type').value } : {}),
      ...(endAsset ? { ends_at: { kind: endAsset.kind, e: endAsset.e, n: endAsset.n, kv: endAsset.kv ?? null } } : {}) };
    (kind === 'trench' ? design.trenches : design.cables).push(item);
    design.finished++;
    design.lastItem = { key: design.finished, kind, path: path.map(p => [p.e, p.n]) };
    const last = measure(kind, item.section, item.cable, plan, null, endAsset); // measured on the ground it has just cut
    design.last = last; design.drafted = false;
    route.clear();
    invalidate({ ground: true }); // new ground: walkers and the drone follow the trench floor
    onChange();
    // Spoil is a fine grid over the whole trench; work it out after the frame, then say it.
    setTimeout(() => {
      const spoil = trenchOf(item.section, plan).spoilVolumeOn(baseHeight);
      item.spoil_m3 = spoil;
      if (design.last === last) { design.last = measure(kind, item.section, item.cable, plan, spoil, endAsset); showReadout(); }
    }, 0);
    return true;
  }
  function choose(tool) {
    design.tool = design.tool === tool ? null : tool;
    works.choose(design.tool);
    design.drafted = false;
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
  function toNearestSubstation() {
    const pts = route.state.points;
    if (design.tool !== 'cable' || !pts.length) return false;
    const t = draftToNearest(pts[pts.length - 1], assets(), origin());
    if (!t) return false;
    design.drafted = true;
    return add([t.x, t.y, heightAt(t.x, t.y)], t.asset);
  }
  // The origin moved by (dx, dy): the route being drawn moves the other way, so it stays put in the world.
  const shift = (dx, dy) => route.state.points.forEach((p, i) => route.movePoint(i, [p[0] - dx, p[1] - dy, p[2]]));

  // ---- page wiring ------------------------------------------------------------------------------------
  for (const b of doc.querySelectorAll('[data-tool]')) b.addEventListener('click', () => { choose(b.dataset.tool); canvas.focus(); });
  $('design-undo').addEventListener('click', () => route.removeLast());
  $('design-finish').addEventListener('click', () => finish());
  $('design-clear').addEventListener('click', () => { design.drafted = false; route.clear(); });
  $('design-to-substation')?.addEventListener('click', () => { toNearestSubstation(); canvas.focus(); });
  const schedule = fn => { design.last = { ...fn(), kind: 'schedule' }; showReadout(); redraw(); };
  $('design-drums')?.addEventListener('click', () => schedule(works.drumSchedule));
  $('design-boq')?.addEventListener('click', () => schedule(works.billOfQuantities));
  $('works-option')?.addEventListener('change', () => { showReadout(); canvas.focus(); });
  for (const id of ['trench-section', 'cable-type']) $(id).addEventListener('change', () => { showReadout(); canvas.focus(); });
  addEventListener('keydown', e => {
    if (!design.tool || e.ctrlKey || e.metaKey || e.altKey) return;
    if (['SELECT', 'INPUT', 'TEXTAREA', 'BUTTON'].includes(e.target?.tagName)) return;
    if (e.code === 'Backspace') { route.removeLast(); e.preventDefault(); }
    else if (e.code === 'Enter' || e.code === 'NumpadEnter') { finish(); e.preventDefault(); }
    else if (e.code === 'Escape') { design.drafted = false; route.clear(); }
  });
  const coarse = matchMedia('(pointer: coarse)').matches;
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
      fill('trench-section', catalogue.sections, s => `${s.voltage_class} · ${s.id} · ${s.trench_width_m} × ${s.trench_depth_m} m`, '33kv-1-dno');
      fill('cable-type', catalogue.cables, c => `${c.voltage_kv} kV ${c.conductor} ${c.csa_mm2} mm² · OD ${c.od_mm} mm`, '33kv-1c-al-xlpe-300');
    } catch (e) {
      for (const b of doc.querySelectorAll('[data-tool]')) b.disabled = true;
      design.last = { rows: [['Status', 'design data could not be loaded: ' + e.message]] };
    }
    showReadout();
  }

  return {
    heightAt, batches, pickAt, shift, finish, loadCatalogue, toNearestSubstation,
    setGroundVersion: fn => { groundVersion = fn; },
    // The last finished trench or cable: { key, kind, path: [[e, n], ...] } in national-grid metres, or null.
    lastFinished: () => design.lastItem || null,
    putDown: () => { if (design.tool) choose(design.tool); },
    // Replaces the whole design (open a file or a link, undo, redo). Paths are national-grid metres.
    replace({ trenches = [], cables = [], works: earthworks = [] } = {}) {
      route.clear();
      works.replace(earthworks);
      Object.assign(design, { trenches: trenches.map(t => ({ ...t })), cables: cables.map(c => ({ ...c })), last: null });
      design.finished++;
      showReadout();
      invalidate({ ground: true });
    },
    // The design in memory, in national-grid metres (export and import come later).
    snapshot: () => JSON.parse(JSON.stringify({ tool: design.tool, trenches: design.trenches, cables: design.cables, works: works.snapshot(),
      draft: route.state.points.map(([x, y]) => toBng(origin(), x, y)),
      snaps: route.state.points.map((_, i) => (snaps[i] ? { kind: snaps[i].kind, e: snaps[i].e, n: snaps[i].n } : null)),
      readout: design.last?.rows || null }))
  };
}
