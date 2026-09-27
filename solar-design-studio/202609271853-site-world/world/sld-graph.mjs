// sld-graph.mjs: the network graph behind the single-line diagram, the 3D symbols, the readouts and Follow.
//
// buildGraph(source) turns a plant source (sld-plant.mjs for a generic plant, sld-source.mjs for a placed block or
// layout) into nodes and branches with per-unit impedances on a 100 MVA base:
//   GRID (ideal source) -source impedance- LAND (the bay at the operator's substation, or a tower on the tee option)
//   -HV cable- HVP (plant-end HV busbar) -bay: disconnector, earth switch, surge arresters- GTg.hv -GTg- GTg.a/b (33 kV)
//   -incomer- MVBs (board section; earthing transformer + NER, spare, storage and filter ways) -feeder cables- Sk.R (RMU)
//   -transformer way- Sk.T (station transformer) -LV winding- Sk.Ta (LV board) -breaker, AC cable- Sk.I7 (inverter)
// Bus ties between board sections and a ring's open hop are branches with open: true (drawn, never carrying load).
// Every closed branch is kept once; the solvers (sld-calc.mjs, tools/gpu/sld_pair.py) orient the tree themselves.
// Illustrative, not a design for any site. Pure: imports only the cable rating and the shared rules.

import { impedance, rating, alR20 } from './cable-rating.mjs';
import { SLD_DEFAULTS, DEVICES, zOf, SLD_LABEL } from './sld-rules.mjs';
import { setTaps } from './sld-calc.mjs';

const zb = (kv, sb) => kv * kv / sb;

/**
 * buildGraph(source, opts) -> { nodes, branches, params, label }
 * nodes: { id, kind, kv, label, at: [e, n] | null, s: [p, q] per unit injected (export positive), devices, meta }
 * branches: { id, from, to, kind, kv, z: [r, x] per unit, open, lengthM, areaMm2, ratingA, devices, label, path }
 */
export function buildGraph(src, opts = {}) {
  const p = { ...SLD_DEFAULTS, ...(src.params || {}), ...opts }, sb = p.sBaseMVA, nodes = [], branches = [];
  const node = (id, kind, kv, label, extra = {}) => { nodes.push({ id, kind, kv, label, at: null, s: [0, 0], devices: [], ...extra }); return id; };
  const branch = (id, from, to, kind, kv, z, extra = {}) => branches.push({ id, from, to, kind, kv, z, open: false, devices: [], ...extra });
  const bus = () => [...p.busPu];
  const cablePu = (area, L, kv, g = 1) => { const z = impedance(area, { kv }); return { z: [z.r * L / zb(kv, sb), z.x * L / zb(kv, sb)],
    ratingA: rating(area, { kv, groupFactor: g }).amps }; };
  const txPu = (pct, xr, mva) => zOf(pct / 100 * sb / mva, xr);
  const sin = Math.sqrt(Math.max(0, 1 - p.powerFactor ** 2));
  const hv = src.hv, kvHv = hv.kv;

  // ---- grid source, landing and the HV connection ----
  const Ik = p.sourceKA || p.sourceKAByKv[kvHv] || 40, Sk = Math.sqrt(3) * kvHv * Ik;
  p.sourceKA = Ik;
  node('GRID', 'grid', kvHv, `Grid source, ${Ik} kA at ${kvHv} kV (assumed)`);
  const land = hv.landing || {}, kind = land.kind || 'gis-bay';
  const words = { tower: `${kvHv} kV line tower (overhead tee)`, 'gis-bay': `Gas-insulated bay at the ${kvHv} kV substation`,
    'dno-sub': `${kvHv} kV network operator substation bay`, none: `No nearby connection at ${kvHv} kV (assumed landing)` };
  node('LAND', kind, kvHv, words[kind] || words['gis-bay'], { at: land.e != null ? [land.e, land.n] : null,
    devices: kind === 'tower' || kind === 'none' ? [] : DEVICES['gis-bay'], meta: { real: !!land.real, distanceM: land.distanceM ?? null, rule: hv.rule || null,
      ruleText: hv.ruleText || null } });
  branch('SRC', 'GRID', 'LAND', 'source', kvHv, zOf(p.c * sb / Sk, p.sourceXR), { label: 'Grid source impedance (assumed fault level)' });
  node('HVP', 'hv-bus', kvHv, `${kvHv} kV plant-end busbar`, { at: hv.plantAt || null });
  const ohl = hv.connection === 'ohl-tee', z33 = impedance(630, { kv: 33 }), L = hv.lengthM / 1000;
  const perKm = ohl ? p.ohlOhmKm : kvHv <= 33 ? [z33.r * 1000, z33.x * 1000] : p.hvCableOhmKm;
  branch('HVC', 'LAND', 'HVP', ohl ? 'ohl-tee' : 'hv-cable', kvHv, [perKm[0] * L / zb(kvHv, sb), perKm[1] * L / zb(kvHv, sb)], { lengthM: hv.lengthM,
    label: ohl ? `Overhead tee, ${Math.round(hv.lengthM)} m` : `${kvHv} kV cable, ${Math.round(hv.lengthM)} m, fully ducted, unjointed, ${hv.protection || 'tiles'} over`,
    path: hv.path || null });

  // ---- grid transformers, board sections, earthing, ties ----
  for (const g of src.grid) {
    node(`${g.id}.hv`, 'hv-bay', kvHv, `${g.id} HV bay`, { at: g.at || null, devices: DEVICES['hv-bay'] });
    branch(`${g.id}.bay`, 'HVP', `${g.id}.hv`, 'hv-bay', kvHv, bus(), { devices: DEVICES['hv-bay'], label: `${g.id} bay: disconnector, earth switch, surge arresters` });
    for (let w = 0; w < g.lvWindings; w++) {
      const wid = `${g.id}.${'ab'[w]}`;
      node(wid, 'gt-lv', 33, `${g.id} LV winding ${'ab'[w]}`, { at: g.at || null });
      branch(`${g.id}.${'ab'[w]}.tx`, `${g.id}.hv`, wid, 'gt', kvHv, txPu(g.zPct, g.xr, g.mva / g.lvWindings),
        { label: `Grid transformer ${g.id}: ${g.mva} MVA ${kvHv}/33 kV ${g.vector}, HV neutral ${g.hvNeutral}, on-load taps ±${p.tapRange * 100} %`,
          mva: g.mva, oltc: { range: p.tapRange, step: p.tapStep, target: p.tapTarget } });
    }
  }
  src.sections.forEach((s, i) => {
    node(s.id, 'mv-board', 33, `33 kV board section ${s.id.slice(3)}`, { at: s.at || null, meta: { spareWays: s.spareWays } });
    branch(`${s.id}.inc`, src.grid.length ? `${s.gt}.${s.winding}` : 'HVP', s.id, 'mv-incomer', 33, bus(), { devices: DEVICES['mv-incomer'] });
    node(`${s.id}.NET`, 'earthing', 33, `Earthing transformer + NER, ${p.nerA} A (assumed)`, { at: s.at || null, devices: DEVICES.earthing });
    branch(`${s.id}.net`, s.id, `${s.id}.NET`, 'earthing', 33, bus(), { devices: DEVICES['mv-way'] });
    for (const [on, id, kind, label] of [[s.storageWay, 'BESS', 'storage-way', 'Storage way (optional)'], [s.harmonicFilter, 'HF', 'harmonic-filter', 'Harmonic filter (optional)']]) {
      if (!on) continue;
      node(`${s.id}.${id}`, kind, 33, label);
      branch(`${s.id}.${id.toLowerCase()}`, s.id, `${s.id}.${id}`, kind, 33, bus(), { devices: DEVICES['mv-way'] });
    }
    if (i) branch(`TIE${i}`, src.sections[i - 1].id, s.id, 'bus-tie', 33, bus(), { open: true, devices: DEVICES['bus-tie'], label: 'Bus tie, normally open' });
  });

  // ---- stations: RMU, transformer way, transformer unit(s), LV winding boards, inverters ----
  const rmuOf = id => (id.startsWith('MVB') ? id : `${id}.R`);
  for (const st of src.stations) {
    node(`${st.id}.R`, 'rmu', 33, `Ring main unit ${st.id.slice(1)}`, { at: st.rmuAt || st.at || null, meta: { station: st.id },
      devices: ['incomer: ' + DEVICES['rmu-in'][0], 'outgoer: ' + DEVICES['rmu-out'][0], 'transformer: ' + DEVICES['rmu-tx'].slice(0, 2).join(', ')] });
    st.units.forEach((u, k) => {
      const tid = `${st.id}.${u.id}`;
      node(tid, 'st-hv', 33, `Station ${st.id.slice(1)} transformer ${u.id}: ${round(u.mva)} MVA 33/0.8 kV ${u.vector}, ${u.zPct} %, taps ${u.taps}`,
        { at: u.at || st.at || null, meta: { station: st.id, mva: u.mva } });
      branch(`${tid}.cb`, `${st.id}.R`, tid, 'rmu-tx', 33, bus(), { devices: DEVICES['rmu-tx'], label: 'RMU transformer way (circuit breaker)' });
      for (const w of u.windings) {
        const lv = `${tid}${w.id}`, kvLv = (p.acVolts || 800) / 1000;
        node(lv, 'lv-board', kvLv, `Station ${st.id.slice(1)} LV board ${u.id}${w.id}`, { at: u.at || st.at || null, devices: DEVICES['lv-main'],
          meta: { station: st.id } });
        branch(`${lv}.tx`, tid, lv, 'st-tx', 33, txPu(u.zPct, u.xr, u.mva * w.kva / Math.max(1, u.windings.reduce((t, x) => t + x.kva, 0))),
          { label: `Transformer ${u.id} winding ${w.id}` });
        for (const inv of w.inverters) {
          const iid = `${st.id}.${inv.id}`, mva = inv.kva / 1000, Lm = inv.acLengthM;
          const r = alR20(inv.acAreaMm2) / 1000 * (1 + 0.00403 * 70), zbl = zb(kvLv, sb);
          node(iid, 'inverter', kvLv, `Inverter ${inv.id.slice(1)}, ${inv.kva} kVA`, { at: inv.at || null, s: [mva * p.powerFactor / sb, mva * sin / sb],
            meta: { station: st.id, kva: inv.kva } });
          branch(`${iid}.ac`, lv, iid, 'ac-cable', kvLv, [r * Lm / zbl, p.lvXOhmKm / 1000 * Lm / zbl], { lengthM: Lm, areaMm2: inv.acAreaMm2,
            devices: DEVICES['lv-way'], label: `AC cable 3 × ${inv.acAreaMm2} mm² Al, ${Math.round(Lm)} m, no local isolator`, path: inv.acPath || null });
        }
      }
      if (k === 0) {
        node(`${st.id}.AUX`, 'aux', 0.4, `Auxiliary transformer ${st.id.slice(1)}`, { at: st.at || null });
        branch(`${st.id}.aux`, `${tid}${u.windings[0].id}`, `${st.id}.AUX`, 'aux', kvLvOf(p), txPu(4, 3, 0.1), { label: 'Auxiliary supply' });
      }
    });
  }
  for (const f of src.feeders) f.hops.forEach((h, i) => {
    const from = h.from === 'board' ? f.section : h.from, to = h.to === 'board' ? f.sectionB : h.to;
    const c = cablePu(h.areaMm2, h.lengthM, 33, h.group || 1);
    branch(`${f.id}.${i + 1}`, rmuOf(from), rmuOf(to), 'feeder-cable', 33, c.z, { open: !!h.open, lengthM: h.lengthM, areaMm2: h.areaMm2,
      ratingA: c.ratingA, group: h.group || 1, feeder: f.id, path: h.path || null,
      devices: [from.startsWith('MVB') ? 'board: ' + DEVICES['mv-way'][0] : 'RMU outgoer', to.startsWith('MVB') ? 'board way' : 'RMU incomer'],
      label: `${f.id} ${h.open ? 'normally-open link' : 'feeder cable'}, ${h.areaMm2} mm² Al, ${Math.round(h.lengthM)} m${h.group < 1 ? `, group factor ${h.group}` : ''}` });
  });
  return setTaps({ nodes, branches, params: p, label: SLD_LABEL, kind: src.kind, mw: src.mw ?? null, connection: src.hv.rule || null });
}

const kvLvOf = p => (p.acVolts || 800) / 1000;
const round = x => Math.round(x * 1000) / 1000;

/** The graph as plain JSON for the GPU pair (tools/sld-export.mjs): what the solvers need, in a stable order. */
export function graphJson(g) {
  return { schema: 'sld-graph/1', label: g.label, kind: g.kind, mw: g.mw, sBaseMVA: g.params.sBaseMVA, c: g.params.c,
    nodes: g.nodes.map(n => ({ id: n.id, kind: n.kind, kv: n.kv, s: n.s })),
    branches: g.branches.map(b => ({ id: b.id, from: b.from, to: b.to, kind: b.kind, kv: b.kv, z: b.z, open: b.open, ...(b.tap ? { tap: b.tap } : {}) })) };
}
