// build-rules.mjs: build mode's rules. Real components snap to a grid over the measured ground and click together
// only where the engineering allows; every refusal is a plain sentence that says what to change. Pure: no DOM, no fetch.
//
// Pieces: a TABLE (2P portrait, south-facing, 28 modules a row, the plant layout's own geometry: plant-layout.mjs) and a
// string INVERTER (generic, assumed: 300 kVA as plant-template.mjs, 12 MPPT inputs taking 2 strings each; not a product).
// Rules at placement: measured ground under it; ground no steeper than the slope limit (LAYOUT_DEFAULTS, 15 %, editable);
// outside every overhead line zone (ohl-ui.mjs zonesEN, HSE GS6 reach); no overlap. Strings wire themselves: a table joins
// the nearest inverter with enough free MPPT inputs, or stays unconnected and is said to. The DC trench at each inverter
// must be wide enough for its ducts (station.mjs: 90 mm ducts, 6 strings a duct; the owner's block section is 0.55 m for
// four). Positions are national-grid metres (e, n). Illustrative: early design, estimates only.

import { tableGeometry, LAYOUT_DEFAULTS } from './plant-layout.mjs';
import { stringDesign, stringLine, STRING_ADVICE, ILLUSTRATIVE } from './string-design.mjs';

export const BUILD_NOTE = `Illustrative, assumptions editable. ${ILLUSTRATIVE}`;
export const DEFAULTS = Object.freeze({
  mps: 28, columns: 28, moduleW: 660, moduleLongM: 2.384, moduleShortM: 1.303, // module class A of data/modules.json
  mppt: 12, perMppt: 2, inverterKVA: 300, slopePct: LAYOUT_DEFAULTS.slopeLimitPct, trenchW: 0.55,
  ductOdM: 0.09, ductGapM: 0.03, sideM: 0.05, stringsPerDuct: 6, gapM: LAYOUT_DEFAULTS.tableGapM
});
export const PIECES = Object.freeze({ table: 'Table', inverter: 'Inverter' });
const INV = { w: 1, d: 0.5 };                     // the pole inverter's box in plan (block-build.mjs)
const r1 = v => (Math.round(v * 10) / 10).toFixed(1), r0 = v => Math.round(v).toLocaleString('en-GB');

/** The table for these settings: plan length (east), depth (north), rise, row pitch, modules and strings. */
export function tableOf(P = DEFAULTS) {
  const T = tableGeometry('south', { ...LAYOUT_DEFAULTS, moduleLongM: P.moduleLongM, moduleShortM: P.moduleShortM },
    { counts: { modulesPerString: P.columns }, params: { moduleWp: P.moduleW } });
  const modules = 2 * P.columns, strings = Math.floor(modules / P.mps);
  return { len: T.lenU, depth: T.depth, rise: T.rise, pitch: T.pitch, lowEdge: LAYOUT_DEFAULTS.lowEdgeM, modules, strings,
    spare: modules - strings * P.mps, kWp: modules * P.moduleW / 1000, stepE: T.lenU + P.gapM, stepN: T.pitch };
}

/** Snaps a pointer at (e, n) to the piece's grid (anchored on national-grid multiples, so it never swims). */
export function snap(kind, e, n, P = DEFAULTS) {
  if (kind === 'inverter') return { e: Math.round(e), n: Math.round(n) };
  const T = tableOf(P);
  return { e: Math.round((e - T.len / 2) / T.stepE) * T.stepE, n: Math.round((n - T.depth / 2) / T.stepN) * T.stepN };
}
/** The plan rectangle [e0, n0, e1, n1]: a table from its south-west corner, an inverter round its centre. */
export function rectOf(it, P = DEFAULTS) {
  if (it.kind === 'inverter') return [it.e - INV.w / 2, it.n - INV.d / 2, it.e + INV.w / 2, it.n + INV.d / 2];
  const T = tableOf(P);
  return [it.e, it.n, it.e + T.len, it.n + T.depth];
}
const overlaps = (a, b) => a[0] < b[2] - 1e-6 && b[0] < a[2] - 1e-6 && a[1] < b[3] - 1e-6 && b[1] < a[3] - 1e-6;

// ---- ground: a least-squares plane over a grid of samples; NaN where any sample is not measured ----
export function slopeOver(rect, measured, nx = 5, ny = 3) {
  const pts = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    const e = rect[0] + (rect[2] - rect[0]) * i / (nx - 1), n = rect[1] + (rect[3] - rect[1]) * j / (ny - 1), h = measured(e, n);
    if (!Number.isFinite(h)) return { measured: false, pct: NaN };
    pts.push([e - rect[0], n - rect[1], h]);
  }
  const m = k => pts.reduce((s, p) => s + p[k], 0) / pts.length, mx = m(0), my = m(1), mz = m(2);
  let sxx = 0, syy = 0, sxy = 0, sxz = 0, syz = 0;
  for (const [x, y, z] of pts) { const a = x - mx, b = y - my, c = z - mz; sxx += a * a; syy += b * b; sxy += a * b; sxz += a * c; syz += b * c; }
  const det = sxx * syy - sxy * sxy, gx = det ? (sxz * syy - syz * sxy) / det : 0, gy = det ? (syz * sxx - sxz * sxy) / det : 0;
  return { measured: true, pct: Math.hypot(gx, gy) * 100, fallsTo: Math.abs(gx) > Math.abs(gy) ? (gx > 0 ? 'west' : 'east') : (gy > 0 ? 'south' : 'north') };
}

// ---- overhead line zones: the distance from a rectangle to a zone's outline (0 when they touch or it lies inside) ----
const segSeg = (a, b, c, d) => {
  const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b);
};
const ptSeg = (p, a, b) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy, k = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)) : 0;
  return Math.hypot(p[0] - a[0] - k * dx, p[1] - a[1] - k * dy);
};
const inPoly = (poly, [x, y]) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
};
export function rectToZone(rect, zone) {
  const q = [[rect[0], rect[1]], [rect[2], rect[1]], [rect[2], rect[3]], [rect[0], rect[3]]], pts = zone.pts || [];
  const edges = pts.slice(1).map((p, i) => [pts[i], p]).concat(zone.closed && pts.length > 2 ? [[pts[pts.length - 1], pts[0]]] : []);
  if (!pts.length) return Infinity;
  if (zone.closed && pts.length > 2 && inPoly(pts, [(rect[0] + rect[2]) / 2, (rect[1] + rect[3]) / 2])) return 0;
  if (pts.some(p => p[0] >= rect[0] && p[0] <= rect[2] && p[1] >= rect[1] && p[1] <= rect[3])) return 0;
  let d = Infinity;
  for (const [a, b] of edges.length ? edges : [[pts[0], pts[0]]]) {
    for (let i = 0; i < 4; i++) { const c = q[i], e = q[(i + 1) % 4]; if (segSeg(a, b, c, e)) return 0; d = Math.min(d, ptSeg(c, a, b), ptSeg(a, c, e), ptSeg(b, c, e)); }
  }
  return d;
}

/**
 * checkPlacement(kind, at, ctx) -> { ok, kind, at, rect, reasons: [sentence], notes: [sentence], slope }
 * ctx: { measured(e, n) (NaN where not measured), zones: { state: 'off' | 'none' | 'on', list: [{ pts, closed, reachM }] },
 *   items: [{ id, kind, e, n }], P }. `at` is already snapped.
 */
export function checkPlacement(kind, at, { measured = () => NaN, zones = { state: 'off', list: [] }, items = [], P = DEFAULTS } = {}) {
  const it = { kind, e: at.e, n: at.n }, rect = rectOf(it, P), reasons = [], notes = [], name = PIECES[kind] || kind;
  const s = slopeOver(rect, measured, kind === 'table' ? 5 : 3, 3);
  if (!s.measured) reasons.push(`The ground here is not measured (no LiDAR under it), so a ${name.toLowerCase()} can't be checked here. Move onto measured ground.`);
  else if (kind === 'table' && s.pct > P.slopePct + 1e-9) {
    reasons.push(`Ground here falls ${r1(s.pct)} % across the table (down to the ${s.fallsTo}); tables stand on ground up to ${r1(P.slopePct)} %. `
      + (s.pct <= 40 ? `Try flatter ground, or change the limit with: build slope ${Math.ceil(s.pct - 1e-6)}.` : 'That is too steep for any table; try flatter ground.'));
  } else if (kind === 'table') notes.push(`ground falls ${r1(s.pct)} %, limit ${r1(P.slopePct)} %`);
  if (zones.state === 'on') {
    for (const z of zones.list) {
      const d = rectToZone(rect, z);
      if (d <= z.reachM) {
        reasons.push(`Inside an overhead line's safety zone: this ${name.toLowerCase()} comes within ${r1(d)} m of the line, and its zone reaches `
          + `${r1(z.reachM)} m (HSE GS6). Nothing is built under or beside a live line here; move it clear.`);
        break;
      }
    }
  } else notes.push(zones.state === 'none' ? 'no overhead line in the loaded grid data here' : 'overhead line zones not checked: switch Grid on in Layers');
  const hit = items.find(o => overlaps(rect, rectOf(o, P)));
  if (hit) reasons.push(`It would overlap ${hit.kind} ${labelOf(hit, items)}. Pick an empty spot on the grid.`);
  return { ok: !reasons.length, kind, at: { e: at.e, n: at.n }, rect, reasons, notes, slope: s };
}
export const labelOf = (it, items) => items.filter(o => o.kind === it.kind).indexOf(it) + 1;
/** The typed line that places this piece. */
export const typedOf = it => `build ${it.kind} at ${Math.round(it.e * 100) / 100} ${Math.round(it.n * 100) / 100}`;

/**
 * wire(items, P) -> { tables: [{ id, inverter (index or null), strings, inputs, run: [[e, n]...], runM }], inverters: [{ id, inputs, strings,
 *   kWp, dcAc, ducts, widthNeedM }], strings, connected, unconnected, spareModules }
 * Each table, in the order placed, joins the nearest inverter (by its home run) that still has enough free MPPT inputs;
 * a table's strings stay on one inverter. Home runs leave the table end nearer the inverter, 1 m south in the aisle,
 * run east or west along it, then north or south to the inverter.
 */
export function wire(items, P = DEFAULTS) {
  const T = tableOf(P), invs = items.filter(i => i.kind === 'inverter'), tabs = items.filter(i => i.kind === 'table');
  const need = Math.ceil(T.strings / P.perMppt), free = invs.map(() => P.mppt), load = invs.map(() => ({ inputs: 0, strings: 0, tables: 0 }));
  const route = (t, v) => {
    const end = [Math.abs(t.e - v.e) < Math.abs(t.e + T.len - v.e) ? t.e : t.e + T.len, t.n - 1];
    const run = [end, [v.e, end[1]], [v.e, v.n]];
    return { run, runM: Math.abs(v.e - end[0]) + Math.abs(v.n - end[1]) };
  };
  const tables = tabs.map(t => {
    const opts = invs.map((v, k) => ({ k, ...route(t, v) })).filter(o => free[o.k] >= need && T.strings > 0).sort((a, b) => a.runM - b.runM || a.k - b.k);
    const o = opts[0];
    if (!o) return { id: t.id, inverter: null, strings: T.strings, inputs: need, run: null, runM: NaN };
    free[o.k] -= need; Object.assign(load[o.k], { inputs: load[o.k].inputs + need, strings: load[o.k].strings + T.strings, tables: load[o.k].tables + 1 });
    return { id: t.id, inverter: o.k, strings: T.strings, inputs: need, run: o.run, runM: o.runM };
  });
  const inverters = invs.map((v, k) => {
    const L = load[k], kWp = L.strings * P.mps * P.moduleW / 1000, ducts = Math.ceil(L.strings / P.stringsPerDuct);
    return { id: v.id, inputs: L.inputs, strings: L.strings, tables: L.tables, kWp, dcAc: kWp / P.inverterKVA, ducts,
      widthNeedM: ducts ? ducts * P.ductOdM + (ducts - 1) * P.ductGapM + 2 * P.sideM : 0 };
  });
  const strings = tabs.length * T.strings, connected = tables.filter(t => t.inverter !== null).reduce((s, t) => s + t.strings, 0);
  return { tables, inverters, strings, connected, unconnected: strings - connected, spareModules: tabs.length * T.spare, T };
}

/** The one-line status under the tools. */
export function statusWords(items, W, P = DEFAULTS) {
  const nt = items.filter(i => i.kind === 'table').length, ni = W.inverters.length;
  if (!items.length) return 'Nothing built yet. Choose Table, then click the ground.';
  const kWp = nt * W.T.kWp, runs = W.tables.map(t => t.runM).filter(Number.isFinite), inputs = W.inverters.map(v => `${v.inputs} of ${P.mppt}`).join(', ');
  return `${r0(nt)} table${nt === 1 ? '' : 's'} · ${r0(W.strings)} strings of ${P.mps} · ${r1(kWp)} kWp DC · ${ni} inverter${ni === 1 ? '' : 's'}`
    + (ni ? ` (inputs used ${inputs})` : ' (place an inverter to wire the strings)')
    + (W.unconnected ? ` · ${W.unconnected} strings unconnected` : '') + (runs.length ? ` · longest home run ${r0(Math.max(...runs))} m` : '');
}

/**
 * HUD checks for what was built, in hud-checks.mjs form: { id, failed, line, working: { inputs, standard, note }, always?, advice? }.
 * cat / cls: the module catalogue and class (data/modules.json); the string voltage is skipped until they load.
 */
export function buildChecks(items, W, P = DEFAULTS, { cat = null, cls = null } = {}) {
  const out = [], add = (id, failed, line, inputs, standard) => out.push({ id, failed: !!failed, line, working: { inputs, standard, note: BUILD_NOTE } });
  if (!items.some(i => i.kind === 'table')) return out;
  const sd = cls && cat ? stringDesign({ cls, cat, mps: P.mps, tempMinC: cat.coldest_cell_C }) : null;
  if (sd) {
    add('build-voc', !sd.ok, `BUILT ${stringLine(sd)}`, [['Modules in series', P.mps], ['Coldest cell', `${sd.tempMinC} °C`],
      ['String Voc', `${sd.stringV.toFixed(1)} V`], ['System voltage', `${sd.systemV} V`], ['Most in series here', sd.most], ['Change', 'build string N']],
      'IEC 62548-1 (array maximum voltage at the lowest expected cell temperature)');
    Object.assign(out.at(-1), { always: true, advice: STRING_ADVICE });
  }
  if (W.unconnected) {
    add('build-mppt', true, `${W.unconnected} BUILT STRINGS UNCONNECTED · NO FREE MPPT INPUT`, [['Strings built', W.strings], ['Connected', W.connected],
      ['Inverters', W.inverters.length], ['MPPT inputs each (assumed)', `${P.mppt} × ${P.perMppt} strings`],
      ['Inputs used', W.inverters.map(v => v.inputs).join(', ') || 'no inverter placed'], ['Fix', 'place another inverter nearer the red tables']],
      'IEC 62548-1 (strings connected only to inputs rated for them)');
  }
  const narrow = W.inverters.filter(v => v.ducts && P.trenchW < v.widthNeedM - 1e-9);
  if (narrow.length) {
    const v = narrow[0];
    add('build-trench', true, `DC TRENCH ${P.trenchW.toFixed(2)} M < ${v.widthNeedM.toFixed(2)} M FOR ${v.ducts} DUCTS AT INVERTER ${W.inverters.indexOf(v) + 1}`,
      [['Trench as set', `${P.trenchW} m (build trench W)`], ['Strings into this inverter', v.strings], ['Ducts', `${v.ducts} × ${P.ductOdM * 1000} mm, ${P.stringsPerDuct} strings a duct`],
        ['Width the ducts need', `${v.widthNeedM.toFixed(2)} m (ducts, ${P.ductGapM * 1000} mm between, ${P.sideM * 1000} mm each side)`]],
      'Rule of thumb from the owner\'s block DC section (0.55 m for four 90 mm ducts); not a standard');
  }
  if (W.spareModules) {
    add('build-spare', true, `${W.spareModules} BUILT MODULES IN NO STRING (${2 * P.columns} A TABLE, ${P.mps} IN SERIES)`,
      [['Modules a table', 2 * P.columns], ['Modules in series', P.mps], ['Left over a table', W.T.spare]], 'IEC 62548-1 (string design)');
  }
  return out;
}
