// COPIED UNCHANGED from the v12 world (web/world/cmd-model.mjs) at v12 commit 3adcee9 (file last changed 0562d4f). Modular star family: public #148236 moduleOf.
// Do not edit here: change the source and re-copy. Everything below this header is byte-identical to the source.
// cmd-model.mjs: the design as typed. A session holds the typed values, runs each command through an engine (the page's
// plant, block and layers, or a plain CPU layout in tests), echoes what changed in words, keeps an undo stack, and keeps
// the script: the canonical lines that rebuild the design when replayed. Pure: the engine does all the world work.
//
// engine: { layout(input) -> Promise<summary | null>, openLand(input) -> Promise<[[e, n]...]>, drawnBoundary() -> pts | null,
//   setBoundary(pts), clearPlant(), block({ stations, pocKv, at }) -> Promise<{ text, at }>, clearBlock(), piles() -> Promise<text>,
//   show(arg) -> text, go(arg) -> text, constraints(summary, state) -> [text], avoid(state) -> [{ id, test }] }
// summary: { tables, mwp, mw, fits, rowsHa, trenchM, skipped, notes }

import { SECTION_FOR } from './plant-feeders.mjs';
import { parse, help, KEYS, guard } from './cmd-grammar.mjs';
import { tableGeometry, LAYOUT_DEFAULTS } from './plant-layout.mjs';
import { plantTemplate, moduleColdVoc, TEMPLATE_DEFAULTS as TD } from './plant-template.mjs';
import { STRING_ADVICE } from './string-design.mjs';
import { formatNumber, NONE } from './measure-format.mjs';
import { noonSun, rowShade, cableFor, bendOf, trenchOf, stringLoops } from './cmd-derive.mjs';
import { rateText, designText, TRENCH_KEYS, TRENCH_DEFAULTS, trenchEnv } from './cmd-trench.mjs';
import { structureById, catalogueText, formatRefusal, formatName, mpptCap, STRUCTURE_NOTE } from './structures.mjs';
import { presetById, presetText, PRESET_NOTE } from './structure-presets.mjs';

export const DEFAULTS = Object.freeze({
  mw: null, layout: 'south', tilt: LAYOUT_DEFAULTS.tiltSouthDeg, tiltEw: LAYOUT_DEFAULTS.tiltEwDeg, pitch: null, gcr: LAYOUT_DEFAULTS.gcr,
  edge: LAYOUT_DEFAULTS.lowEdgeM, mps: null, tempMin: -10, wp: null, voc: null, fence: LAYOUT_DEFAULTS.fenceSetbackM, water: LAYOUT_DEFAULTS.waterSetbackM,
  slope: LAYOUT_DEFAULTS.slopeLimitPct, avoidOhl: true, depth: 1.11, width: 0.45, formation: 'trefoil', size: 300, metal: 'al',
  wiring: 'standard', stations: 10, pocKv: null, soil: 1.2, load: 'continuous', ...TRENCH_DEFAULTS, boundary: null,
  // structures (structures.mjs): format (null tiers: the layout's own), post lines, tracker strings, row gap, MPPT cap, post height
  tiers: null, orient: 'portrait', tableCols: null, posts: 2, trackerStrings: 2, rowGap: 'slope', mppts: 12, stringsPerMppt: 2, postMax: 3,
  gcrTracker: LAYOUT_DEFAULTS.gcrTracker,
  // inverter class (plant-template.mjs), packing (plant-packing.mjs; band and run null: the packing's own), module size
  inverterClass: 'string', inverterKVA: 300, invertersPerStation: 20, packing: LAYOUT_DEFAULTS.packing, bandM: null, runM: null,
  hedge: LAYOUT_DEFAULTS.hedgeSetbackM, moduleLong: LAYOUT_DEFAULTS.moduleLongM, moduleShort: LAYOUT_DEFAULTS.moduleShortM
}); // depth/width/size/formation: the plant's typed 33 kV trench, 33kv-1-agri (data/trench-sections.json); the block's trenches are sized by rating
const LAYOUT_KEYS = ['mw', 'layout', 'tilt', 'tiltEw', 'pitch', 'gcr', 'edge', 'mps', 'tempMin', 'wp', 'voc', 'fence', 'water', 'slope', 'avoidOhl',
  'tiers', 'orient', 'tableCols', 'posts', 'trackerStrings', 'rowGap', 'mppts', 'stringsPerMppt', 'postMax', 'gcrTracker',
  'inverterClass', 'inverterKVA', 'invertersPerStation', 'packing', 'bandM', 'runM', 'hedge', 'moduleLong', 'moduleShort'];
const STRUCT = st => ({ tiers: st.tiers, orient: st.orient, tableCols: st.tableCols, trackerStrings: st.trackerStrings, gcrTracker: st.gcrTracker,
  moduleLongM: st.moduleLong ?? LAYOUT_DEFAULTS.moduleLongM, moduleShortM: st.moduleShort ?? LAYOUT_DEFAULTS.moduleShortM });
const PACK = st => ({ packing: st.packing || LAYOUT_DEFAULTS.packing, hedgeSetbackM: st.hedge ?? LAYOUT_DEFAULTS.hedgeSetbackM,
  ...(st.bandM ? { bandTargetM: st.bandM } : {}), ...(st.runM ? { runTargetM: st.runM } : {}) });
// The module (one answer with the block, string-design.mjs): typed power and Voc win; else the selected module class
// (env.moduleClass() -> { wp, voc, coeffPctPerK }); else the template's default class A.
export function moduleOf(st, env = {}) {
  const c = env.moduleClass?.() || null;
  return { wp: st.wp ?? c?.wp ?? TD.moduleWp, voc: st.voc ?? c?.voc ?? TD.moduleVoc,
    coeff: st.voc == null && c?.coeffPctPerK != null ? c.coeffPctPerK / 100 : TD.vocCoeffPerK, typed: st.voc != null };
}
const tplOpts = (st, env) => ({ moduleWp: moduleOf(st, env).wp, moduleVoc: moduleOf(st, env).voc, vocCoeffPerK: moduleOf(st, env).coeff,
  minCellC: st.tempMin ?? -10, mppts: st.mppts, stringsPerMppt: st.stringsPerMppt,
  inverterClass: st.inverterClass || 'string', inverterKVA: st.inverterKVA ?? 300, invertersPerStation: st.invertersPerStation ?? 20,
  ...(st.mps ? { modulesPerString: st.mps } : {}) });
// Typed settings keep their places (a pitch of 7.00 m); the one formatter underneath (measure-format.mjs), one dash for none.
const f = (v, d = 2) => (v == null || !Number.isFinite(v) ? NONE : formatNumber(v, d));
const int = v => f(v, 0);

/** The table, rows, cables and loops the typed values give. env: { latDeg, catalogue }; lay: the last layout summary. */
export function derive(st, env = {}, lay = null) {
  const tpl = plantTemplate({ targetMW: st.mw || 50, ...tplOpts(st, env) });
  const south = st.layout === 'south', base = { ...LAYOUT_DEFAULTS, tiltSouthDeg: st.tilt, tiltEwDeg: st.tiltEw, lowEdgeM: st.edge, ...STRUCT(st) };
  const T0 = tableGeometry(st.layout, base, tpl);
  const gcr = south ? (st.pitch ? T0.slope / st.pitch : st.gcr) : null, ewGapM = !south && st.pitch ? st.pitch - T0.depth : base.ewGapM;
  const T = tableGeometry(st.layout, { ...base, ...(south ? { gcr } : { ewGapM }) }, tpl);
  const sun = noonSun(env.latDeg ?? 51.8), shade = rowShade({ rise: T.rise, depth: T.depth, pitch: T.pitch, elevDeg: sun.winter });
  const cable = cableFor(env.catalogue, st.size, st.metal), bend = bendOf(env.catalogue, cable);
  const trench = trenchOf({ depth: st.depth, width: st.width, formation: st.formation, od: cable ? cable.od : 0.05 });
  const mps = tpl.counts.modulesPerString, cv = moduleColdVoc(tpl.params), loops = stringLoops({ mps });
  const voc = { module: cv.v, string: cv.v * mps, most: Math.floor(tpl.params.systemV / cv.v + 1e-9), rule: cv.rule, moduleVoc: tpl.params.moduleVoc };
  return { st, T, gcr, ewGapM, sun, shade, cable, bend, trench, mps, voc, loops, lay, spoilM3: spoilOf(lay, st, env.sections), tpl, post: postOf(st, T) };
}
// The tallest post by design: south two lines at 0.2 / 0.8 of the depth (one line: mid depth); reveal = low edge + rise x f - rails 0.3 m.
export function postOf(st, T) {
  if (T.tracker) return null;
  const f = st.layout === 'south' ? (st.posts === 1 ? 0.5 : 0.8) : 0.5, reveal = st.edge + T.rise * f - 0.3;
  return { reveal, over: reveal > st.postMax + 1e-9 };
}
// Bank spoil of the plant's MV trenches: each trench type's length x its section; the typed trench replaces the single-circuit
// section the layout routes (SECTION_FOR.one: 33kv-1-agri); two-circuit and ducted crossings keep their catalogue sections.
export const TYPED_SECTION = SECTION_FOR.one;
export function spoilOf(lay, st, sections = []) {
  if (!lay?.trenchByType) return null;
  let v = 0;
  for (const [id, L] of Object.entries(lay.trenchByType)) {
    const sec = (sections || []).find(x => x.id === id);
    v += L * (id === TYPED_SECTION || !sec ? st.width * st.depth : sec.trench_width_m * sec.trench_depth_m);
  }
  return v;
}

// What an echo compares, in order: [label, value(d) as text].
const WATCH = [
  ['layout', d => d.st.layout], ['plant export', d => (d.st.mw ? `${int(d.st.mw)} MW` : NONE)],
  ['tilt', d => `${f(d.st.layout === 'south' ? d.st.tilt : d.st.tiltEw, 0)}°`], ['modules per string', d => int(d.mps)],
  ['coldest cell', d => `${f(d.st.tempMin ?? -10, 0)} °C`], ['string cold Voc', d => `${int(d.voc.string)} V`], ['row pitch', d => `${f(d.T.pitch)} m`], ['GCR', d => (d.gcr ? f(d.gcr) : NONE)],
  ['clear gap between rows', d => `${f(d.shade.gapM)} m`], ['midwinter noon shadow', d => `${f(d.shade.shadowM)} m`],
  ['lowest module edge', d => `${f(d.st.edge)} m`], ['top edge', d => `${f(d.st.edge + d.T.rise)} m`],
  ['slope limit', d => `${int(d.st.slope)} %`], ['watercourse setback', d => `${int(d.st.water)} m`], ['fence setback', d => `${f(d.st.fence, 1)} m`],
  ['overhead line zones', d => (d.st.avoidOhl ? 'kept clear' : 'not avoided')],
  ['trench depth', d => `${f(d.st.depth)} m`], ['trench width', d => `${f(d.st.width)} m`], ['formation', d => d.st.formation],
  ['cover to top cable', d => `${f(d.trench.cover)} m`], ['cable', d => (d.cable ? `${d.st.size} mm² ${d.st.metal === 'cu' ? 'Cu' : 'Al'}, OD ${f(d.cable.odMm, 1)} mm` : NONE)],
  ['bend radius (installation)', d => (d.bend?.installM ? `${f(d.bend.installM)} m` : NONE)],
  ['table', d => formatName(d.T.tiers, d.T.orient, d.T.cols)],
  ['post lines', d => (d.T.tracker ? 'one along each tube' : d.st.layout === 'east-west' ? 'one under each face' : d.st.posts === 1 ? 'single' : 'twin')],
  ['strings per tracker row', d => (d.T.tracker ? int(d.st.trackerStrings) : NONE)], ['tracker GCR', d => (d.T.tracker ? f(d.st.gcrTracker) : NONE)],
  ['row gap', d => (d.st.layout === 'south' ? (d.st.rowGap === 'slope' ? 'slope-aware' : 'flat') : NONE)],
  ['inverters', d => `${d.st.inverterClass || 'string'}, ${int(d.st.inverterKVA ?? 300)} kVA, ${int(d.st.invertersPerStation ?? 20)} a station`],
  ['strings per inverter', d => (d.st.inverterClass === 'central' ? `${int(d.tpl.counts.stringsPerInverter)} in ${int(d.tpl.counts.combiners / d.tpl.counts.inverters)} combiner boxes`
    : `${int(d.tpl.counts.stringsPerInverter)} (cap ${mpptCap(d.st)}: ${d.st.mppts} MPPT × ${d.st.stringsPerMppt})`)],
  ['packing', d => `${d.st.packing || 'fields'}${d.st.bandM ? `, tracks every ${int(d.st.bandM)} m` : ''}${d.st.runM ? `, runs ${int(d.st.runM)} m` : ''}`],
  ['hedge setback', d => `${f(d.st.hedge ?? 5, 1)} m`], ['module size', d => `${f(d.st.moduleLong ?? 2.384, 3)} × ${f(d.st.moduleShort ?? 1.134, 3)} m`],
  ['tallest post by design', d => (d.post ? `${f(d.post.reveal)} m (limit ${f(d.st.postMax, 1)} m)` : NONE)],
  ['string wiring', d => d.st.wiring], ['loop area per string', d => `${f(d.loops[d.st.wiring].area, 1)} m²`],
  ['spoil (bank)', d => (d.spoilM3 ? `${int(d.spoilM3)} m³` : NONE)], ['soil', d => `${f(d.st.soil, 1)} K.m/W`], ['load profile', d => d.st.load],
  ['trenches side by side', d => ['Dc', 'Branch', 'Collector', 'Mv'].map(k => `${k.toLowerCase()} ${d.st['split' + k] || 'by rating'}`).join(', ')],
  ['trench cover', d => `dc ${f(d.st.coverDc)} m, lv ${f(d.st.coverLv)} m, 33 kV ${f(d.st.coverMv)} m`], ['cable drum', d => `${int(d.st.drumM)} m`],
  ['33 kV ring case', d => d.st.ring]
];
const COUNTS = [['tables', s => int(s.tables)], ['MWp', s => f(s.mwp, 1)], ['land under rows', s => `${f(s.rowsHa, 1)} ha`],
  ['built', s => `${int(s.mw)} MW${s.fits ? '' : ' (not all fits)'}`]];

/** "row pitch 11.97 m → 7.00 m; GCR 0.40 → 0.68; 1,402 tables → 1,402" */
export function echo(a, b) {
  const parts = WATCH.map(([k, v]) => [k, v(a), v(b)]).filter(([, x, y]) => x !== y).map(([k, x, y]) => `${k} ${x} → ${y}`);
  if (a.lay && b.lay && a.lay !== b.lay) parts.push(...COUNTS.map(([k, v]) => [k, v(a.lay), v(b.lay)]).filter(([, x, y]) => x !== y)
    .map(([k, x, y]) => (k === 'tables' ? `${x} tables → ${y}` : `${k} ${x} → ${y}`)));
  else if (!a.lay && b.lay) parts.push(`${int(b.lay.tables)} tables, ${f(b.lay.mwp, 1)} MWp, ${f(b.lay.rowsHa, 1)} ha under rows${b.lay.fits ? '' : ` (${int(b.lay.mw)} MW fits)`}`);
  return parts.join('; ');
}

// Warnings the new values raise (never refusals: the owner decides).
function warnings(d) {
  const w = [];
  if (d.st.layout === 'south' && d.shade.shaded) w.push(`rows shade each other at midwinter noon (${f(d.shade.shadowM)} m shadow, ${f(d.shade.gapM)} m gap)`);
  if (d.trench.cover < 0.91 - 1e-9) w.push(`cover ${f(d.trench.cover)} m is under the 0.91 m asked on good farmland (a network operator's cable standard)`);
  // Owner, 27 Sept: modules in series are his to change; an over-voltage is said, never refused, with the advisory.
  if (d.voc.string > 1500) w.push(`plant layout: ${d.mps} modules in a string reach ${int(d.voc.string)} V cold (module Voc ${f(d.voc.moduleVoc, 1)} V; `
    + `the stricter of ${f(d.st.tempMin ?? -10, 0)} °C and Voc × 1.15, here ${d.voc.rule}), over the 1500 V system limit; at most ${d.voc.most} `
    + `(type string ${d.voc.most}). ${STRING_ADVICE}`);
  if (d.post?.over) w.push(`posts stand ${f(d.post.reveal)} m by design, over the ${f(d.st.postMax, 1)} m limit: lower the tilt, use fewer tiers, `
    + `a lower edge or a single post line (flagged on the HUD). ${STRUCTURE_NOTE}`);
  const c = d.tpl.counts, dcac = c.stringsPerInverter * c.modulesPerString * d.tpl.params.moduleWp / 1000 / d.tpl.params.inverterKVA;
  if (d.st.inverterClass !== 'central' && c.stringsPerInverter >= mpptCap(d.st) && dcac < d.tpl.params.dcAcRatio - 0.05) w.push(`DC/AC ${f(dcac)}: strings per inverter are capped at `
    + `${mpptCap(d.st)} by the MPPTs (${d.st.mppts} × ${d.st.stringsPerMppt}); more strings per input or longer strings raise it (mppt ${d.st.mppts} inputs `
    + `${Math.ceil(Math.round(d.tpl.params.inverterKVA * d.tpl.params.dcAcRatio / (c.modulesPerString * d.tpl.params.moduleWp / 1000)) / d.st.mppts)})`);
  if (!d.trench.fits) w.push(`the ${d.st.formation} needs a ${f(d.trench.needWidth)} m trench; it is ${f(d.st.width)} m`);
  return w;
}

/** The typed values as plant.run parameters. */
// A refusal in words: a fault inside the page (a JavaScript error) is never shown by its programming name.
const inWords = e => (e instanceof TypeError || e instanceof ReferenceError || e instanceof RangeError ? 'That did not run here (a fault in the page)' : e.message);

export function layoutInput(st, env = {}) {
  const d = derive(st, env), south = st.layout === 'south';
  return { mw: st.mw, layout: st.layout, slopeLimitPct: st.slope, fenceSetbackM: st.fence,
    options: { tiltSouthDeg: st.tilt, tiltEwDeg: st.tiltEw, lowEdgeM: st.edge, waterSetbackM: st.water, ...STRUCT(st), ...PACK(st), rowGap: st.rowGap,
      ...(env.latDeg ? { latDeg: env.latDeg } : {}), ...(south ? { gcr: d.gcr } : st.layout === 'tracker' ? {} : { ewGapM: d.ewGapM }) },
    template: tplOpts(st, env), piles: { posts: st.posts, rules: { revealFailM: st.postMax } } };
}

// Applies typed values; returns { st } or { why } (refused in words).
function applySet(st0, c, env) {
  const set = { ...c.set }, st = { ...st0 };
  if (c.arg.maybeEw && 'tilt' in set && st.layout === 'east-west') {
    const g = guard('tiltEw', set.tilt); if (g) return { why: g }; set.tiltEw = set.tilt; delete set.tilt;
  }
  if ('gcr' in set && (set.layout || st.layout) === 'tracker') { set.gcrTracker = set.gcr; delete set.gcr; st.pitch = null; }
  if ('gcr' in set) { if ((set.layout || st.layout) !== 'south') return { why: 'east-west rows are set by the gap between them: type pitch' }; st.pitch = null; }
  Object.assign(st, set);
  // A format kept from another layout that this one does not build goes back to the layout's own; one typed now is refused.
  const bad = formatRefusal(st.layout, st.tiers || (st.layout === 'tracker' || st.layout === 'east-west' ? 1 : 2), st.orient);
  if (bad && ('tiers' in set || 'orient' in set)) return { why: bad };
  if (bad) Object.assign(st, { tiers: null, orient: 'portrait', tableCols: null });
  if (st.posts === 1 && st.layout === 'east-west' && ('posts' in set || 'layout' in set)) {
    if ('posts' in set) return { why: 'a single post line is built for south-facing tables here; east-west keeps one line under each face' };
    st.posts = 2;
  }
  let d;
  try { d = derive(st, env); } catch (e) { return { why: e.message.replace(/^plant template: /, '') }; } // an inverter class and rating that do not agree
  if (st.layout === 'south' && st.pitch && !(d.gcr <= KEYS.gcr.max)) return { why: `row pitch ${f(st.pitch)} m leaves no room: the table is ${f(d.T.depth)} m deep in plan `
    + `and ${f(d.T.slope)} m up the slope, so the ground cover ratio would be ${f(d.T.slope / st.pitch)} (most ${KEYS.gcr.max}); the least pitch is ${f(d.T.slope / KEYS.gcr.max)} m` };
  if (st.layout === 'east-west' && st.pitch && d.ewGapM < 0.5) {
    return { why: `row pitch ${f(st.pitch)} m leaves ${f(d.ewGapM)} m between east-west tables; at least 0.5 m (least pitch ${f(d.T.pitch - d.ewGapM + 0.5)} m)` };
  }
  if (!d.cable) return { why: `no 33 kV ${st.metal === 'cu' ? 'copper' : 'aluminium'} single core of ${st.size} mm² in the cable catalogue` };
  return { st };
}
// The typed string length and coldest cell go with every rebuild of the block, so a re-size never drops them.
const strOf = st => ({ ...(st.mps ? { modulesPerString: st.mps } : {}), ...(st.tempMin !== DEFAULTS.tempMin ? { tempMinC: st.tempMin } : {}) });
const same = (a, b, keys) => keys.every(k => JSON.stringify(a[k]) === JSON.stringify(b[k]));
const fmtPts = pts => pts.map(([e, n]) => `${Math.round(e)} ${Math.round(n)}`).join(', ');
const ANIM = [['tilt', ['tilt', 'tiltEw']], ['rows', ['pitch', 'gcr', 'layout', 'edge']], ['trench', ['depth', 'width', 'formation', 'size', 'metal']],
  ['loop', ['wiring', 'mps']]];

export function createSession({ engine, env = {} }) {
  let st = { ...DEFAULTS }, lay = null, script = [], block = null, pending = false;
  const hist = [];
  const view = () => derive(st, env, lay);
  async function runLayout() {
    if (!st.boundary) {
      const drawn = engine.drawnBoundary?.();
      // Whole metres, as the script writes it, so a replay packs the very same boundary (the fields packing starts at its edges).
      const got = drawn || await engine.openLand(layoutInput(st, env));
      st = { ...st, boundary: got && got.map(([e, n]) => [Math.round(e), Math.round(n)]) };
      if (!st.boundary) return { why: 'no boundary: draw one (Plant > Draw boundary) or stand on open land' };
      script.splice(Math.max(0, script.length - 1), 0, `boundary ${fmtPts(st.boundary)}`); // before the line that asked for it
    }
    await engine.setBoundary?.(st.boundary);
    const s = await engine.layout({ ...layoutInput(st, env), avoid: st.avoidOhl ? engine.avoid?.(st) || [] : [] });
    if (!s) return { why: 'the layout did not run (see the Plant readout)' };
    lay = s; pending = false;
    return { s };
  }
  async function exec(line, { replay = false } = {}) {
    const c = parse(line);
    if (!c.ok) return { ok: false, text: c.why, line };
    if (c.act === 'help') return { ok: true, text: help(c.arg.topic), line, quiet: true };
    if (c.act === 'script') {
      const typed = new Set(script.flatMap(l => Object.keys(parse(l).set || {})));
      const plantTrench = new Set(['depth', 'width', 'formation', 'size']);   // the plant's 33 kV feeder trench, not the block's
      const assumed = ['tilt', 'gcr', 'edge', 'tempMin', 'wp', 'voc', 'fence', 'water', 'slope', 'depth', 'width', 'formation', 'size', 'wiring', ...TRENCH_KEYS]
        .filter(k => !typed.has(k) && !(k === 'gcr' && typed.has('pitch')))
        .map(k => `${plantTrench.has(k) ? 'plant 33 kV feeder ' : ''}${KEYS[k].label} ${st[k] ?? moduleOf(st, env)[k]}${KEYS[k].unit ? ' ' + KEYS[k].unit : ''}`);
      if (block) assumed.push('block trenches: LV 400 mm² Al and DC 6 mm² Cu, each trench sized by rating (type trench design)');
      return { ok: true, line, quiet: true, text: `${script.length ? script.join('\n') : 'Nothing typed yet.'}`
        + `\nTYPED: ${[...typed].map(k => KEYS[k]?.label || k).join(', ') || 'nothing'}\nASSUMED (defaults): ${assumed.join(', ')}` };
    }
    if (c.act === 'undo') return undo();
    if (c.act === 'structure' && !c.arg.id) return { ok: true, text: c.arg.preset ? presetText() : catalogueText(), line, quiet: true };
    if (c.act === 'structure') { // a preset of typed values, echoed and undone like any other line
      const S = structureById(c.arg.id) || presetById(c.arg.id), bad = Object.entries(S.set).map(([k, v]) => (v === null ? null : guard(k, v))).filter(Boolean);
      if (bad.length) return { ok: false, text: bad.join('; ') + '. Nothing was changed.', line };
      c.set = { ...S.set }; c.act = null; c.structure = S;
    }
    const view_ = async fn => { try { return { ok: true, text: await fn(), line, quiet: true }; } catch (e) { return { ok: false, text: inWords(e) + '.', line }; } };
    if (c.act === 'show') return view_(() => engine.show(c.arg));
    if (c.act === 'rate') return view_(() => rateText(c.arg, st));
    if (c.act === 'xray') return view_(() => (engine.xray ? engine.xray(c.arg.on) : 'X-ray is not in this build.'));
    if (c.act === 'trench-design' && !Object.keys(c.set).length) return view_(async () => designText(st, await engine.trenchRows?.()));
    if (c.act === 'explain') { const d = view(); return { ok: true, text: explain(c.arg.what, d), line, quiet: true, anim: c.arg.what === 'bend' ? 'trench' : 'loop', d, before: d }; }
    // Earthing (earth-mount.mjs): its settings live in the cartridge; the typed line joins the script so a replay rebuilds it.
    if (c.act === 'earthing') {
      const r = await view_(async () => { if (!engine.earthing) throw Error('earthing is not in this build'); return engine.earthing(c.arg); });
      if (r.ok) script.push(canonical(c));
      return r;
    }
    if (c.act === 'binoculars') return view_(async () => { if (!engine.binoculars) throw Error('the binoculars are not in this build'); return engine.binoculars(c.arg); });
    if (c.act === 'hud') return view_(async () => { if (!engine.hud) throw Error('the check HUD is not in this build'); return engine.hud(c.arg); });
    if (c.act === 'repd') return replay ? { ok: true, text: 'REPD flight not replayed.', line, quiet: true } // a flight is not part of the design
      : view_(async () => { if (!engine.repd) throw Error('REPD flights are not in this build'); return engine.repd(c.arg); });
    if (c.act === 'journey') return view_(async () => { if (!engine.journey) throw Error('The journey is not in this build'); return engine.journey(c.arg); });
    if (c.act === 'connect') return replay ? { ok: true, text: 'Connection plan not replayed.', line, quiet: true } // connect here (connect-mount.mjs)
      : view_(async () => { if (!engine.connect) throw Error('connect here is not in this build'); return engine.connect(c.arg); });
    if (c.act === 'find') return view_(async () => { if (!engine.find) throw Error('Find is not in this build'); return engine.find(c.arg); });
    if (c.act === 'go') return view_(async () => { if (pending) await runLayout(); return engine.go(c.arg, lay); });
    // Follow the power and the single-line diagram read the world; they change no typed value and stay out of the script.
    if (c.act === 'follow') return view_(async () => { if (pending) await runLayout(); if (!engine.follow) throw Error('Follow is not in this build'); return engine.follow(c.arg, lay); });
    if (c.act === 'sld') return view_(async () => { if (pending) await runLayout(); if (!engine.sld) throw Error('the single-line diagram is not in this build'); return engine.sld(c.arg, lay); });
    const before = { st, lay, script: script.slice(), block, d: view() };
    const a = applySet(st, c, env);
    if (a.why) return { ok: false, text: a.why + '. Nothing was changed.', line };
    if (!c.act && same(st, a.st, Object.keys(DEFAULTS))) return { ok: true, text: `No change: ${c.line} is already set.`, line, quiet: true }; // not an undo step
    st = a.st;
    let extra = [];
    try {
      if (c.act === 'boundary') {
        st = { ...st, boundary: c.arg.open ? null : c.arg.points };
        if (st.boundary) await engine.setBoundary?.(st.boundary);
        if (lay && st.boundary) { if (replay) pending = true; else { const r = await runLayout(); if (r.why) throw Error(r.why); } }
      } else if (c.act === 'fill' && !st.boundary && !engine.drawnBoundary?.()) {
        throw Error('fill needs a boundary: draw one (Plant > Draw boundary), or type plant 50mw to use the open land around you');
      }
      if (c.act === 'fill' && !st.mw) throw Error('fill needs a capacity first: plant 50mw, or fill 50mw');
      if (c.act === 'layout' && !st.mw) throw Error('plant needs a capacity, such as plant 50mw south');
      const redo = c.act === 'layout' || c.act === 'fill' || (lay && !same(before.st, st, LAYOUT_KEYS));
      script.push(canonical(c));
      if (redo) {
        if (replay) pending = true;
        else { const r = await runLayout(); if (r.why) throw Error(r.why); extra = engine.constraints?.(lay, st) || []; }
      }
      if (c.act === 'block') {
        if (pending) await runLayout();
        const at = c.arg.at || block?.at || null, b = await engine.block({ stations: st.stations / 10, pocKv: st.pocKv, at, trench: trenchEnv(st), frame: !replay, ...strOf(st) });
        block = { at: b.at, stations: st.stations }; extra.push(b.text);
        script[script.length - 1] = `block ${st.stations}mva${st.pocKv ? ` poc ${st.pocKv}` : ''}${b.at ? ` at ${Math.round(b.at.e)} ${Math.round(b.at.n)}` : ''}`;
      }
      if (('mps' in c.set || 'tempMin' in c.set) && engine.strings) { const t = await engine.strings({ mps: st.mps, tempMinC: st.tempMin }); if (t) extra.push(t); }
      if (c.act === 'piles') { if (pending) await runLayout(); extra.push(await engine.piles(lay)); }
      if (block && c.act !== 'block' && !same(before.st, st, TRENCH_KEYS)) {     // soil, load or split typed: the block's trenches re-sized
        await engine.block({ stations: st.stations / 10, pocKv: st.pocKv, at: block.at, trench: trenchEnv(st), ...strOf(st) }); extra.push('Block trenches re-sized.');
      }
      if (c.act === 'trench-design') extra.push(designText(st, await engine.trenchRows?.()));
    } catch (e) {
      st = before.st; lay = before.lay; script = before.script; block = before.block;
      return { ok: false, text: inWords(e) + '. Nothing was changed.', line };
    }
    const after = view(), said = echo(before.d, after);
    hist.push({ line: c.line, before });
    const warn = warnings(after).filter(w => !before.d.lay !== !after.lay || !warnings(before.d).includes(w)); // all of them on a new layout
    const keys = Object.keys(c.set), anim = (ANIM.find(([, ks]) => ks.some(k => keys.includes(k))) || [null])[0];
    if (c.structure) extra.unshift(`${c.structure.evidence ? 'Preset' : 'Structure'} ${c.structure.id}: ${c.structure.label}. Class ranges: ${c.structure.ranges}.`
      + (c.structure.evidence ? ` Evidence: ${c.structure.evidence}. ${PRESET_NOTE}` : ` ${STRUCTURE_NOTE}`));
    const text = [said || (c.act ? '' : `${c.line}: set (the same as before, to the precision shown)`), ...extra, ...warn.map(w => 'Note: ' + w)].filter(Boolean).join('\n');
    return { ok: true, text, line, anim, d: after, before: before.d };
  }
  async function undo() {
    const h = hist.pop();
    if (!h) return { ok: false, text: 'Nothing to undo.', line: 'undo' };
    const now = view(), b = h.before, layoutChanged = b.lay !== lay || !same(b.st, st, [...LAYOUT_KEYS, 'boundary']);
    st = b.st; script = b.script;
    if (block && !b.block) engine.clearBlock?.();
    else if (b.block && (block !== b.block || !same(now.st, b.st, TRENCH_KEYS))) {
      await engine.block({ stations: b.block.stations / 10, pocKv: b.st.pocKv, at: b.block.at, trench: trenchEnv(b.st), ...strOf(b.st) });
    }
    block = b.block;
    if (engine.strings && !same(b.st, now.st, ['mps', 'tempMin'])) await engine.strings({ mps: st.mps, tempMinC: st.tempMin });
    if (layoutChanged) {
      if (b.lay) { const r = await runLayout(); if (r.s) lay = r.s; } else { lay = null; engine.clearPlant?.(); if (st.boundary) await engine.setBoundary?.(st.boundary); }
    }
    const said = echo(now, view());
    return { ok: true, text: `Undid "${h.line}"${said ? ': ' + said : '.'}`, line: 'undo', anim: null, d: view() };
  }
  // Replays a script from the start: values are set line by line, the layout runs once where it is needed and at the end.
  async function replay(lines) {
    st = { ...DEFAULTS }; lay = null; script = []; block = null; pending = false; hist.length = 0;
    const out = [];
    for (const l of lines) { if (!String(l).trim() || /^\s*#/.test(l)) continue; out.push(await exec(l, { replay: true })); }
    if (pending) { const r = await runLayout(); out.push(r.why ? { ok: false, text: r.why } : { ok: true, text: echo(derive(st, env), view()) }); }
    hist.length = 0;
    return out;
  }
  return { exec, undo, replay, script: () => script.slice(), state: () => ({ ...st }), layout: () => lay, derived: view, history: () => hist.length };
}

// The line kept in the script: the typed words, in the language's own spelling.
function canonical(c) {
  if (c.act === 'boundary') return c.arg.open ? 'boundary open' : `boundary ${fmtPts(c.arg.points)}`;
  return c.line.replace(/\s+/g, ' ').trim();
}

/** Words for "bend radius" and "loop area". */
export function explain(what, d) {
  if (what === 'bend') {
    if (!d.bend?.installM) return 'No bend rule in the catalogue for this cable.';
    return `${d.st.size} mm² ${d.st.metal === 'cu' ? 'Cu' : 'Al'} (OD ${f(d.cable.odMm, 1)} mm): bend radius ${f(d.bend.installM)} m while pulling`
      + ` (${d.bend.installX} × OD), ${f(d.bend.finalM)} m set in place (${d.bend.finalX} × OD). ${d.bend.source}`;
  }
  const L = d.loops;
  return `Loop between + and − of one ${d.mps}-module string: standard ${f(L.standard.area, 1)} m², leapfrog ${f(L.leapfrog.area, 1)} m²`
    + ` (${f(100 * (1 - L.leapfrog.area / L.standard.area), 0)} % less). Routes on the table assumed; wiring ${d.st.wiring}.`;
}

/** The counts an echo compares, from a plant layout (plant-layout.mjs result). */
export const summarize = r => (r ? { tables: r.built.tables, mwp: r.built.mwp, mw: r.built.mw, fits: r.fits,
  rowsHa: r.built.tables * r.table.pitch * (r.table.lenU + r.params.tableGapM) / 1e4, trenchM: r.electrical?.trenchM ?? 0,
  trenchByType: { ...(r.electrical?.trenchByType || {}) }, crossReview: r.crossReview || 0, rowGap: r.rowGap ? { ...r.rowGap } : null,
  skipped: { ...r.skipped }, notes: r.notes.slice() } : null);
