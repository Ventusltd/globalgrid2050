// Earthworks tools in the Design panel: access road, equipment pad, perimeter fence, pile row and drilled
// crossing, plus the drum schedule for the last cable and the bill of quantities for the whole design.
// design-ui.mjs owns the panel, the clicks and the readout; this module turns finished points into designs using
// the pure cartridges (road, pad, fence, piles, hdd, drums, boq). Items are held in national-grid metres, so they
// survive every move of the origin; local geometry is rebuilt when the origin, the ground or the design changes.
// Roads and pads change the ground: walkers and the drone stand on the finished road and the top of the pad.

import { toBng, toLocal } from './origin.mjs';
import { createRoad, composeRoadGround } from './road.mjs';
import { edgeLines as roadEdges, batterLines as roadBatters } from './road-lines.mjs';
import { createPad, padGround, padLines } from './pad.mjs';
import { createFence, FENCE_TYPES } from './fence.mjs';
import { planPiles } from './piles.mjs';
import { designBore } from './hdd.mjs';
import { planDrums } from './drums.mjs';
import { buildBoq, toCsv } from './boq.mjs';
import { BASIS, roadBuildUp } from './boq-assumptions.mjs';
import { formatNumber, formatLength, formatArea, formatVolume, formatGradient } from './measure-format.mjs';

const COLOUR = { road: [0.86, 0.86, 0.82, 1], batter: [0.62, 0.52, 0.36, 0.8], fence: [0.8, 0.84, 0.9, 0.9],
  pile: [0.95, 0.9, 0.55, 1], pileWarn: [1, 0.45, 0.35, 1], bore: [0.7, 0.6, 1, 1], bay: [1, 0.7, 0.3, 1] };

// Each tool: the option list (value, label) for the one select it uses, and what to say before the first click.
export const TOOLS = Object.freeze({
  road: { label: 'Road surface', options: [['gravel', 'Gravel access track'], ['tarmac', 'Tarmac road']],
    hint: 'click along the road centreline, then Finish' },
  pad: { label: 'Pad type', options: [['transformer', 'Transformer pad'], ['inverterSkid', 'Inverter skid pad'], ['batteryCompound', 'Battery compound']],
    hint: 'click the pad centre (a second click sets its direction), or three or more corners; then Finish' },
  fence: { label: 'Fence type', options: Object.entries(FENCE_TYPES).map(([k, t]) => [k, t.label]).reverse(),
    hint: 'click the corners of the fenced area, then Finish' },
  piles: { label: 'Mounting system', options: [['tracker', 'Single-axis tracker'], ['fixed', 'Fixed tilt']],
    hint: 'click both ends of a table row, then Finish' },
  hdd: { label: 'Crossing under', options: [['road', 'Road'], ['watercourse', 'Watercourse'], ['hedge', 'Hedge']],
    hint: 'click either side of the road, watercourse or hedge, then Finish' }
});
const MIN_POINTS = { road: 2, pad: 1, fence: 3, piles: 2, hdd: 2 };
const APPROACH_M = 150; // plan line each side of the obstacle the bore may use for its entry and exit
const BOQ_SURFACE = { gravel: 'unbound', tarmac: 'bound' };

// deps: { doc, origin(), baseHeight(x, y), groundVersion(), cables() -> [{ route, spec }] finished cables,
//         catalogue() -> { sections, json }, designItems() -> boq items for trenches and cables,
//         heightAt(x, y) the ground with everything built }
export function createEarthworks({ doc, origin, baseHeight, groundVersion, cables, catalogue, designItems, heightAt }) {
  const $ = id => doc.getElementById(id);
  let items = [];                      // { kind, option, path: [{ e, n }] }
  let version = 0, built = { key: '' }, drums = null, csvUrl = null;

  const toLocalPts = path => path.map(p => toLocal(origin(), p.e, p.n));
  const handles = tool => tool in TOOLS;
  const option = tool => ($('works-option')?.value) || TOOLS[tool].options[0][0];

  // ---- one design from points (local metres) ----------------------------------------------------------
  function make(kind, opt, pts, ground) {
    if (kind === 'road') return createRoad({ path: pts, groundAt: ground, surface: opt });
    if (kind === 'pad') {
      if (pts.length >= 3) return createPad({ polygon: pts, kind: opt }, ground);
      const [c, d] = pts, heading = d ? Math.atan2(d[0] - c[0], d[1] - c[1]) : 0;
      return createPad({ kind: opt, centre: c, heading }, ground);
    }
    if (kind === 'fence') {
      const [a, b] = pts, side = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const gates = side >= 6 ? [{ at: side / 2, width: 4 }] : []; // one 4 m gate mid-way along the first side (assumed)
      return createFence({ polygon: pts, type: opt, gates, groundAt: ground });
    }
    if (kind === 'piles') {
      const rows = pts.slice(1).map((p, i) => ({ id: i + 1, line: [pts[i], p] }));
      return planPiles({ rows, groundAt: ground, system: opt });
    }
    const [a, b] = [pts[0], pts[pts.length - 1]], w = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (!(w > 0.5)) throw Error('the two sides of the crossing must be at least 0.5 m apart');
    const ux = (b[0] - a[0]) / w, uy = (b[1] - a[1]) / w;
    const from = [a[0] - ux * APPROACH_M, a[1] - uy * APPROACH_M], to = [b[0] + ux * APPROACH_M, b[1] + uy * APPROACH_M];
    const bore = designBore({ from, to, groundAt: ground, obstacle: { kind: opt, from: APPROACH_M, to: APPROACH_M + w }, fit: true });
    if (!bore.layout) throw Error(bore.checks[0].note); // no valid layout: said plainly, nothing drawn or billed
    return bore;
  }

  // ---- local geometry, rebuilt only when something it depends on changes --------------------------------
  function build() {
    const o = origin(), key = `${o.id}:${groundVersion()}:${version}`;
    if (built.key === key) return built;
    const live = items.map((it, i) => ({ it, i, pts: toLocalPts(it.path) })), byItem = [];
    const of = (kind, g) => live.filter(l => l.it.kind === kind).map(l => (byItem[l.i] = make(kind, l.it.option, l.pts, g)));
    const roads = of('road', baseHeight);
    const roadGround = roads.length ? composeRoadGround(baseHeight, roads) : baseHeight;
    const pads = of('pad', roadGround);
    const ground = pads.length ? padGround(pads, roadGround) : roadGround;
    const fences = of('fence', ground), piles = of('piles', ground), bores = of('hdd', ground);
    built = { key, roads, pads, fences, piles, bores, byItem, roadGround, worksGround: ground, ground: roads.length || pads.length ? ground : null };
    return built;
  }
  // The ground each kind is designed on, the same for the preview, Finish and the rebuilt drawing: roads on the
  // measured ground, pads on the roads, the rest on roads and pads (review A, finding 2).
  const groundFor = kind => { const b = build(); return kind === 'road' ? baseHeight : kind === 'pad' ? b.roadGround : b.worksGround; };
  const ground = base => build().ground || base;

  // ---- readout rows: [label, value, warn?] --------------------------------------------------------------
  function rowsOf(kind, d, draft) {
    if (kind === 'road') {
      const steep = d.steepSections.length;
      return [['Road', `${d.surface === 'tarmac' ? 'Tarmac' : 'Gravel'} · ${formatNumber(d.width, 1)} m wide · crossfall ${formatNumber(d.crossfall * 100, 1)} %`],
        ['Road length (plan)', formatLength(d.length2d)], ['Road length (3D)', formatLength(d.length3d)],
        ['Steepest gradient', formatGradient(d.maxGrade), d.maxGrade > d.maxGradient],
        ['Over 1 in 10', steep ? `${steep} section${steep > 1 ? 's' : ''}` : 'none', steep > 0],
        ['Cut / fill', draft ? 'on finish' : `${formatVolume(d.cutM3)} / ${formatVolume(d.fillM3)} (${BASIS.spoil})`],
        ['Build-up', `${d.materials.map(m => `${m.name} ${formatNumber(m.thickness * 1000, 0)} mm`).join(' · ')} (assumed)`],
        ['Ground', `${BASIS.ground} · ${BASIS.datum}`]];
    }
    if (kind === 'pad') {
      const v = d.volumes;
      return [['Pad', `${formatArea(v.polygonArea)} · formation ${formatNumber(d.level, 2)} m${d.balanced ? ' (cut = fill)' : ''}`],
        ['Ground', `${BASIS.ground} · ${BASIS.datum}`],
        ['Top of stone', `${formatNumber(d.top, 2)} m · ${formatNumber(d.stone * 1000, 0)} mm stone (assumed)`],
        ['Cut / fill', `${formatVolume(v.cut)} / ${formatVolume(v.fill)} (${BASIS.spoil}, no topsoil strip)`],
        ['Stone import', formatVolume(v.import)], ['Surplus to remove', formatVolume(v.export)],
        ['Plant level', d.plant.sump ? `top ${formatNumber(d.plant.topLow, 2)} m is below ground up to ${formatNumber(d.plant.groundHigh, 2)} m: `
          + 'drain it or raise it' : 'top above the ground under the pad', d.plant.sump],
        ['Batters', `1 in ${formatNumber(d.cutBatter, 1)} cut, 1 in ${formatNumber(d.fillBatter, 1)} fill (assumed)`, d.truncated]];
    }
    if (kind === 'fence') {
      const c = d.counts;
      return [['Fence', `${d.label} · ${formatNumber(d.height, 1)} m high`], ['Fence length (3D)', formatLength(d.length3d)],
        ['Area enclosed', formatArea(d.areaM2)], ['Posts', `${c.posts} (${c.cornerPosts} corner, ${c.gatePosts} gate)`],
        ['Strainers / struts', `${c.strainers} / ${c.struts}`], ['Gates', String(c.gates)], ['Basis', d.basis]];
    }
    if (kind === 'piles') {
      const s = d.summary, rev = d.piles.map(p => p.reveal);
      return [['Piles', `${s.piles} in ${s.tables} table${s.tables === 1 ? '' : 's'} (${d.system === 'fixed' ? 'fixed tilt' : 'tracker'})`],
        ['Reveal before grading', !rev.length ? 'no table fits' : Math.min(...rev) < d.assumed.reveal.min || Math.max(...rev) > d.assumed.reveal.max
          ? `outside ${formatNumber(d.assumed.reveal.min, 1)} to ${formatNumber(d.assumed.reveal.max, 1)} m: grading needed`
          : `${formatNumber(Math.min(...rev), 2)} to ${formatNumber(Math.max(...rev), 2)} m`],
        ['Tables needing grading', String(s.tablesNeedingGrading), s.tablesNeedingGrading > 0],
        ['Table slope over limit', `${s.nsSlopeTables} north-south · ${s.ewSlopeTables} east-west · ${s.localSlopeTables} with a local steep spot`,
          s.nsSlopeTables + s.ewSlopeTables > 0],
        ['Grading cut / fill', `${formatVolume(s.cutM3)} / ${formatVolume(s.fillM3)} (indicative)`],
        ['Total pile length', `${formatLength(s.totalPileLengthM)} (embedment ${formatNumber(d.assumed.embedMin, 1)} m, assumed)`]];
    }
    const failed = d.checks.filter(c => !c.ok).map(c => c.id);
    return [['Crossing', `drilled under a ${d.kind} · ${formatNumber(d.product.odMm, 0)} mm duct (assumed)`],
      ['Bore length', d.boreLength === null ? 'none: the profile does not fit' : formatLength(d.boreLength), d.boreLength === null],
      ['Entry to exit (plan)', formatLength(d.planLength)],
      ['Depth of straight', `${formatNumber(d.depth.level, 2)} m level · cover ${formatNumber(d.depth.cover, 1)} m (assumed)`],
      ['Angles', `entry ${formatNumber(d.entry.angleDeg, 0)}° · exit ${formatNumber(d.exit.angleDeg, 0)}° · radius ${formatNumber(d.radius, 0)} m`,
        d.checks.some(c => c.id === 'angles' && c.warn)],
      ['Checks', failed.length ? `fails: ${failed.join(', ')}` : 'all pass (screening only)', failed.length > 0]];
  }
  function measure(kind, pts) {
    if (pts.length < MIN_POINTS[kind]) return { rows: [['Status', pts.length ? `${pts.length} point${pts.length > 1 ? 's' : ''} · add another` : TOOLS[kind].hint]] };
    try { return { rows: rowsOf(kind, make(kind, option(kind), pts, groundFor(kind)), true) }; } catch (e) { return { rows: [['Status', e.message]] }; }
  }
  function finish(kind, pts) {
    if (!handles(kind) || pts.length < MIN_POINTS[kind]) return null;
    let d;
    try { d = make(kind, option(kind), pts, groundFor(kind)); } catch (e) { return { rows: [['Status', e.message]] }; }
    const o = origin();
    items.push({ kind, option: option(kind), path: pts.map(([x, y]) => toBng(o, x, y)) });
    version++;
    return { rows: rowsOf(kind, d, false), done: true, kind };
  }
  // What the bill of quantities reads from each finished item.
  function summary(kind, d) {
    if (kind === 'road') return { length3d: d.length3d, width: d.width, area: d.length2d * d.width, cutM3: d.cutM3, fillM3: d.fillM3,
      buildUp: roadBuildUp(d.materials) };
    if (kind === 'pad') return { polygonArea: d.volumes.polygonArea, cut: d.volumes.cut, fill: d.volumes.fill, level: d.level, stone: d.stone };
    if (kind === 'fence') return { length3d: d.length3d, gates: d.counts.gates, postSpacing: d.postSpacing, bends: d.counts.cornerPosts };
    if (kind === 'piles') return { count: d.summary.piles, totalEmbedmentM: d.piles.reduce((t, p) => t + p.embed, 0) };
    return { boreLength: d.boreLength };
  }

  // ---- drawing ----------------------------------------------------------------------------------------
  function batch(key, v, pos, color) {
    if (!pos || pos.length < 6) return null;
    const o = [pos[0], pos[1], pos[2]], out = new Float32Array(pos.length);
    for (let i = 0; i < pos.length; i++) out[i] = pos[i] - o[i % 3];
    return { key, version: v, positions: out, color, origin: o };
  }
  function batches() {
    const b = build(), k = b.key, out = [];
    b.roads.forEach((r, i) => out.push(batch(`works-road-${i}`, k, roadEdges(r), COLOUR.road),
      batch(`works-road-batter-${i}`, k, roadBatters(r, baseHeight), COLOUR.batter)));
    b.pads.forEach((p, i) => out.push(...padLines(p, baseHeight, { key: `works-pad-${i}`, version: k })));
    b.fences.forEach((f, i) => { const o = [f.polygon[0][0], f.polygon[0][1], b.ground ? b.ground(...f.polygon[0]) : baseHeight(...f.polygon[0])];
      out.push({ key: `works-fence-${i}`, version: k, positions: f.lines(o), color: COLOUR.fence, origin: o }); });
    b.piles.forEach((plan, i) => {
      const ok = [], bad = [];
      for (const p of plan.piles) (p.flags.length ? bad : ok).push(p.x, p.y, Math.min(p.ground, p.finishedGround), p.x, p.y, p.top);
      out.push(batch(`works-piles-${i}`, k, ok, COLOUR.pile), batch(`works-piles-grade-${i}`, k, bad, COLOUR.pileWarn));
    });
    b.bores.forEach((d, i) => out.push(batch(`works-bore-${i}`, k, [...d.lines], COLOUR.bore)));
    if (drums?.key === k) out.push(batch('works-joint-bays', `${k}:${drums.n}`, [...drums.lines], COLOUR.bay));
    return out.filter(Boolean);
  }

  // ---- schedules --------------------------------------------------------------------------------------
  function drumSchedule() {
    const list = cables();
    if (!list.length) return { rows: [['Status', 'draw and finish a cable first']] };
    const { route, spec } = list[list.length - 1];
    try {
      const s = planDrums({ route, cable: spec, rules: catalogue().json?.rules || [], groundAt: heightAt }), t = s.totals;
      drums = { n: (drums?.n || 0) + 1, lines: s.drawLines(), key: build().key };
      return { rows: [['Drum schedule', `${spec.voltage_kv} kV ${spec.csa_mm2} mm² · ${t.cores} cores`],
        ['Drum', `${s.drum.id} (assumed size) · up to ${formatLength(s.drum.maxLength, 0)} (${s.drum.governs})`],
        ['Drums', String(t.drums)], ['Joint bays', `${t.jointBays} (${t.joints} joints)`],
        ['Ordered length', formatLength(t.orderedTotal, 0)], ['Waste', `${formatLength(t.waste, 0)} (${formatNumber(t.wasteFraction * 100, 1)} %)`],
        ...s.issues.slice(0, 3).map(m => ['Issue', m, true]),
        ['Basis', 'largest drum that passes transport, barrel and weight limits; no pulling-tension check (assumed values)']] };
    } catch (e) { return { rows: [['Status', e.message]] }; }
  }
  // Quantities come from the designs as rebuilt now (keyed on the ground version), so an item finished before the
  // LiDAR tiles arrived is billed on the measured ground once they have, never on numbers frozen at Finish.
  function boqDoc() {
    const b = build();
    const own = items.map((it, i) => {
      const id = `${it.kind}-${i + 1}`, r = summary(it.kind, b.byItem[i]);
      // The bill's layers are the build-up road.mjs drew for this road, not a second table.
      if (it.kind === 'road') return { id, kind: 'road', surface: BOQ_SURFACE[it.option], widthM: r.width, buildUp: r.buildUp,
        results: { area: r.area, length3d: r.length3d, cutM3: r.cutM3, fillM3: r.fillM3 } };
      if (it.kind === 'pad') return { id, kind: 'pad', thicknessM: r.stone, thicknessAssumed: true, material: 'Type 1 stone (assumed)', results: r };
      if (it.kind === 'fence') return { id, kind: 'fence', fenceType: it.option, gates: r.gates, postSpacingM: r.postSpacing, path: it.path.map(p => [p.e, p.n]),
        results: { length3d: r.length3d, bends: new Array(r.bends).fill(0) } };
      if (it.kind === 'piles') return { id, kind: 'piles', pileType: it.option, results: r };
      return { id, kind: 'hdd', ducts: 1, ductOdMm: 125, results: r };
    });
    return { items: [...designItems(), ...own] };
  }
  function billOfQuantities() {
    let boq;
    try { boq = buildBoq(boqDoc(), { sections: { sections: catalogue().sections }, cables: catalogue().json }); } catch (e) { return { rows: [['Status', e.message]] }; }
    if (!boq.rows.length) return { rows: [['Status', 'nothing to measure yet: finish a trench, cable, road, pad, fence, pile row or crossing']] };
    const dp = { m: 1, 'm²': 1, 'm³': 2, nr: 0 };
    const link = $('works-csv');
    if (link) {
      if (csvUrl) URL.revokeObjectURL(csvUrl);
      csvUrl = URL.createObjectURL(new Blob([toCsv(boq)], { type: 'text/csv' }));
      link.href = csvUrl; link.hidden = false;
    }
    return { rows: [['Bill of quantities', `${boq.rows.length} rows · quantities only, no rates`],
      ['Basis', `ground ${BASIS.ground} · levels in ${BASIS.datum} · spoil ${BASIS.spoil}`],
      ...boq.rows.map(r => [r.description, `${formatNumber(r.quantity, dp[r.unit] ?? 2)} ${r.unit} · ${r.status} · ${r.basis}`, r.status === 'assumed']),
      ...boq.skipped.map(s => ['Not measured', `${s.id}: ${s.reason}`, true])] };
  }

  // ---- panel ------------------------------------------------------------------------------------------
  // Shows the one option select for the chosen tool (hidden for Trench and Cable, which have their own).
  function choose(tool) {
    const box = $('works-option-box');
    if (!box) return;
    box.hidden = !handles(tool);
    if (!handles(tool)) return;
    $('works-option-label').textContent = TOOLS[tool].label;
    $('works-option').replaceChildren(...TOOLS[tool].options.map(([v, l]) => new Option(l, v)));
  }

  return {
    handles, measure, finish, ground, batches, choose, drumSchedule, billOfQuantities,
    version: () => version,
    snapshot: () => items.map(({ kind, option: opt, path }) => ({ kind, option: opt, path })),
    // Replaces every earthworks item (open a file or a link): [{ kind, option, path: [{ e, n }] }].
    replace(list = []) {
      items = list.filter(it => handles(it.kind) && Array.isArray(it.path))
        .map(it => ({ kind: it.kind, option: TOOLS[it.kind].options.some(([v]) => v === it.option) ? it.option : TOOLS[it.kind].options[0][0],
          path: it.path.map(p => ({ e: p.e, n: p.n })) }));
      drums = null; version++;
    }
  };
}
