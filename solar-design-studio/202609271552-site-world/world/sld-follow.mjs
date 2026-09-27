// sld-follow.mjs: Follow, from one solar module to the landing bay, as a list of stops along one continuous path.
//
// module -> its string (the + and - conductors through the series loop) -> the two DC home cables along their trench ->
// the inverter on its pole -> the AC cable (3 x 400 mm2 Al, no local isolator) -> the station LV board -> the station
// transformer and its RMU -> each RMU along the feeder (the normally-open point noted) -> the MV board section -> the
// grid transformer and its HV bay -> the HV cable -> the gas-insulated bay at the substation (or the tower, tee option).
// The AC stops read the network readouts (sld-calc.mjs) so the cumulative drop is the sum of the element drops the
// GPU pair checks. The DC side is worked here: string current at the maximum-power point of a generic module class,
// copper home cables (EN 50618 class, size assumed). Every figure is illustrative, not a design for any site. Pure.

import { tracePath } from './sld-calc.mjs';
import { SLD_DEFAULTS, SLD_LABEL } from './sld-rules.mjs';

const len = pts => pts.reduce((t, q, i) => (i ? t + Math.hypot(q[0] - pts[i - 1][0], q[1] - pts[i - 1][1], q[2] - pts[i - 1][2]) : 0), 0);
const f = (x, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : '—');

/** Panel id 'S2:37:12' <-> { station: 'S2', string: 37, module: 12 }. */
export const panelId = p => `${p.station}:${p.string}:${p.module}`;
export function parsePanel(id) {
  const m = /^(S\d+):(\d+):(\d+)$/.exec(String(id || '').trim());
  return m ? { station: m[1], string: Number(m[2]), module: Number(m[3]) } : null;
}

/** The connected module nearest a ground point [e, n], or null when the point is off every station's tables. */
export function pickPanel(built, anchor, [e, n], reachM = 6) {
  const [E, N] = anchor, strings = built.station.strings.filter(s => s.connected);
  let best = null;
  for (const S of built.mv.stations) {
    const x = e - E - S.offset[0], y = n - N - S.offset[1];
    if (x < -20 || y < -20 || x > 200 || y > 360) continue;
    for (const s of strings) s.modules.forEach((m, k) => {
      const d = Math.hypot(m.terminal[0] - x, m.terminal[1] - y);
      if (d < reachM && (!best || d < best.d)) best = { d, station: S.id, string: s.index, module: k };
    });
  }
  return best && { station: best.station, string: best.string, module: best.module };
}

/**
 * followPath({ built, anchor, graph, sol, ro, panel, groundAt }) -> { stops, points, nodes, branches, panel, label }
 * stops: [{ key, title, at: [e, n, z], view: 'walk' | 'drone' | 'high', leg: [[e, n, z]...] (from the previous stop),
 *           rows: [[label, value]...], dropPct, cumDropPct }]; points: the whole path as one polyline.
 */
export function followPath({ built, anchor, graph, sol, ro, panel, groundAt = () => 0 }) {
  const P = typeof panel === 'string' ? parsePanel(panel) : panel;
  const S = P && built.mv.stations.find(s => s.id === P.station);
  const str = S && built.station.strings[P.string];
  if (!S || !str || !str.connected || !str.modules[P.module]) throw Error('follow: no connected module ' + (typeof panel === 'string' ? panel : panelId(P || {})));
  const [E, N] = anchor, [ox, oy] = S.offset, d = SLD_DEFAULTS, M = d.module;
  // Station 1 is drawn in full; the others are the same block moved, so their points ride their own ground.
  const move = q => { if (!ox && !oy) return q; const e = q[0] + ox, n = q[1] + oy; return [e, n, q[2] - groundAt(q[0], q[1]) + groundAt(e, n)]; };
  const local = q => move([E + q[0], N + q[1], groundAt(E + q[0], N + q[1]) + (q[2] ?? 0)]);
  const gnd = (q, h = 0.5) => [q[0], q[1], groundAt(q[0], q[1]) + h];
  const stops = [];
  // cum: the cables' voltage drop only; a transformer's voltage change (txPct) is said on its own, never added to it
  // (user test H6).
  let cum = 0, tx = 0, run = 0, prev = null;
  const stop = (key, title, at, view, leg, rows, dropPct = 0, lengthM = 0, txPct = 0) => {
    cum += dropPct; tx += txPct; run += lengthM;
    const path = [...(prev ? [prev] : []), ...leg, at];
    stops.push({ key, title, at, view, leg: path, dropPct, cumDropPct: cum, txPct, lengthM: run,
      rows: [...rows, ['Length so far', `${f(run, 0)} m`], ['Cable voltage drop here', `${f(dropPct, 3)} %`],
        ...(txPct ? [['Transformer voltage change', `${f(txPct, 3)} % (not a cable drop)`]] : []), ['Cable drop so far', `${f(cum, 3)} %`]] });
    prev = at;
  };

  // ---- DC: module, string loop, home cables ----
  const mods = str.modules.map(m => local(m.terminal)), mod = mods[P.module], vStr = M.vmp * str.modules.length;
  stop('module', `Module ${P.module + 1} of string ${P.string + 1}, station ${S.id.slice(1)}`, mod, 'walk', [],
    [['What', `Solar module, ${M.w} W class (generic)`], ['Voltage', `${f(M.vmp)} V DC at maximum power`], ['Current', `${f(M.imp)} A`]]);
  const dc = built.cables.dc, neg = dc[2 * P.string], pos = dc[2 * P.string + 1];
  const seriesM = len(mods), R = d.dcOhmKm20 / 1000 * (1 + 0.00393 * (d.dcTempC - 20));
  const dropSeries = M.imp * R * seriesM / vStr * 100;
  stop('string', `String ${P.string + 1}: ${str.modules.length} modules in series`, mods.at(-1), 'walk', mods.slice(P.module),
    [['What', 'String loop, + and − conductors through every module'], ['Voltage', `${f(vStr, 0)} V DC`], ['Current', `${f(M.imp)} A`],
      ['Cable', `module leads, ${d.dcAreaMm2} mm² Cu (assumed)`]], dropSeries, seriesM);
  const pp = pos.points.map(move), np = neg.points.map(move), homeM = len(pp) + len(np);
  stop('dc', 'DC home cables, + and −, in the DC trench', pp.at(-1), 'walk', pp,
    [['What', `Two home cables (+ ${f(len(pp), 0)} m, − ${f(len(np), 0)} m), duct ${neg.id.split('-')[0]}`], ['Voltage', `${f(vStr, 0)} V DC`],
      ['Current', `${f(M.imp)} A`], ['Cable', `${d.dcAreaMm2} mm² Cu, EN 50618 class (assumed size)`]], M.imp * R * homeM / vStr * 100, homeM);

  // ---- AC: up the network tree from the inverter ----
  const invNode = `${S.id}.I${pos.inverter + 1}`, trail = tracePath(graph, sol, invNode), node = new Map(graph.nodes.map(x => [x.id, x]));
  const br = new Map(graph.branches.map(x => [x.id, x])), acPts = built.cables.ac[3 * pos.inverter].points.map(move);
  const fe = graph.branches.find(b => b.kind === 'feeder-cable' && trail.some(t => t.branch === b.id))?.feeder;
  const feeder = fe && graph.branches.filter(b => b.feeder === fe), open = feeder?.find(b => b.open);
  const nodeAt = id => { const a = node.get(id)?.at; return a ? gnd(a, 1.5) : prev; };
  const fault = id => `${f(ro.nodes.get(id).faultKA, 2)} kA (${f(ro.nodes.get(id).faultMVA, 0)} MVA)`, carry = { drop: 0, tx: 0, len: 0 };
  const isTx = b => /^(st-tx|gt)$/.test(b?.kind || '');
  for (let i = 0; i < trail.length; i++) {
    const { node: id } = trail[i], n = node.get(id), into = i ? ro.branches.get(trail[i - 1].branch) : null, b = i ? br.get(trail[i - 1].branch) : null;
    const k = n.kind, at = id === invNode ? acPts[0] : nodeAt(id), kv = n.kv < 1 ? `${f(n.kv * 1000, 0)} V AC` : `${n.kv} kV AC`;
    const cur = x => (x ? `${f(x.currentA, 1)} A` : '—'), base = [['Voltage level', kv], ['Fault level', fault(id)]];
    // The grid transformer's LV terminals and the plant-end busbar are passed through, not stopped at: their drop and
    // length are carried into the next stop (the transformer with its HV bay, then the HV cable to the landing).
    if (k === 'gt-lv' || k === 'hv-bus') { carry[isTx(b) ? 'tx' : 'drop'] += into ? into.dropPct : 0; carry.len += b?.lengthM || 0; continue; }
    if (k === 'inverter') { stop('inverter', `Inverter ${pos.inverter + 1} on its pole`, at, 'walk', [], [['What', n.label], ...base,
      ['Current', cur(ro.branches.get(trail[0].branch))]]); continue; }
    const cable = b?.areaMm2 ? `${b.areaMm2} mm² Al, ${f(b.lengthM, 0)} m` : b?.lengthM ? `${f(b.lengthM, 0)} m` : '—';
    const leg = b?.path ? orient(b.path.map(q => (q.length > 2 ? q : gnd(q, 0))), prev) : [];
    const view = (b?.lengthM || 0) > 500 ? 'high' : k === 'lv-board' ? 'walk' : 'drone';
    const title = k === 'lv-board' ? `Station ${S.id.slice(1)} LV board ${id.split('.').at(-1)}` : k === 'st-hv' ? n.label.split(':')[0]
      : k === 'rmu' ? `${n.label}${id === `${S.id}.R` ? ' (this station)' : ''}` : k === 'mv-board' ? n.label : k === 'gt-lv' ? `Grid transformer ${id.split('.')[0]}`
      : k === 'hv-bay' ? `Grid transformer ${id.split('.')[0]} and its HV bay: disconnector, earth switch, surge arresters`
      : n.label;
    // The leg into this stop by what it is: an overhead line is never called a cable; a transformer or bay has no leg row.
    const legName = b?.kind === 'ohl-tee' ? 'Overhead line' : /^(st-tx|gt|hv-bay|source)$/.test(b?.kind || '') ? null : 'Cable';
    const rows = [['What', b?.label || n.label], ...base, ['Current', cur(into)], ...(legName ? [[legName, cable]] : [])];
    if (b?.kind === 'st-tx' || b?.kind === 'gt') {                 // a transformer: its current on the lower-voltage side too
      const lv = node.get(trail[i - 1].node).kv;
      rows.splice(3, 1, ['Current', `${f(into.currentA, 1)} A at ${b.kv} kV · ${f(into.currentA * b.kv / lv / 1000, 2)} kA at ${lv < 1 ? f(lv * 1000, 0) + ' V' : lv + ' kV'}`]);
    }
    if (k === 'rmu' && feeder) rows.push(['Feeder', open ? `${fe} ring: normally-open point at ${open.id}` : `${fe} radial chain: no normally-open point`]);
    if (k === 'mv-board') rows.push(['Board', `earthing transformer + NER on this section; ${graph.branches.some(x => x.kind === 'bus-tie') ? 'bus tie normally open' : 'one section'}`]);
    if (id === 'LAND') rows.push(['Connection', n.meta?.ruleText || 'assumed']);
    if (k === 'lv-board') { stop('ac', `AC cable, 3 × 400 mm² Al, no local isolator, to ${title}`, acPts.at(-1), 'walk', acPts.slice(1), rows, into.dropPct, b.lengthM || 0); continue; }
    const here = into ? into.dropPct : 0;
    stop(k, title, at, view, leg, rows, (isTx(b) ? 0 : here) + carry.drop, (b?.lengthM || 0) + carry.len, (isTx(b) ? here : 0) + carry.tx);
    carry.drop = 0; carry.tx = 0; carry.len = 0;
  }
  const points = stops.flatMap((s, i) => (i ? s.leg.slice(1) : s.leg));
  return { stops, points, panel: panelId(P), nodes: trail.map(t => t.node), branches: trail.map(t => t.branch).filter(Boolean),
    dcDropPct: stops[2].cumDropPct, acDropPct: cum - stops[2].cumDropPct, transformerPct: tx, label: SLD_LABEL };
}

// A cable path runs whichever way it was drawn: start it at the end nearer where Follow is now.
function orient(pts, from) {
  if (!from || pts.length < 2) return pts;
  const d = q => Math.hypot(q[0] - from[0], q[1] - from[1]);
  return d(pts[0]) <= d(pts.at(-1)) ? pts : [...pts].reverse();
}
