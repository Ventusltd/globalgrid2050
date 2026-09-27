// sld-source.mjs: the plant in the world as a network source for sld-graph.mjs, with national-grid positions.
//   sourceFromBlock(built, anchor, landing)  the owner's solar block (block-build.mjs): his two 5 MVA transformers
//     per station, 14 inverters each on 3 x 400 mm2 Al AC cables along his routes, the 33 kV feeders as routed;
//   sourceFromLayout(result, landing)        a plant laid out in a boundary (plant-layout.mjs), feeders as routed.
// conn: the connection sld-connect.mjs chose (cable to a 400 kV bay, a tee, or a 132 / 33 kV operator substation); null: assumed.
// Illustrative, not a design for any site. Pure.

import { SLD_DEFAULTS, SLD_LABEL } from './sld-rules.mjs';

const polyLen = pts => pts.reduce((t, q, i) => (i ? t + Math.hypot(q[0] - pts[i - 1][0], q[1] - pts[i - 1][1], (q[2] ?? 0) - (pts[i - 1][2] ?? 0)) : 0), 0);

// The connection from the plant-end bay to the landing (sld-connect.mjs chooses it): a straight, fully ducted,
// unjointed cable, or an overhead tee; with no connection chosen, an assumed point 1.5 km away that says so.
function hvOf(conn, kvDefault, plantAt, assumedM = 1500) {
  const c = conn || { rule: 'assumed', kv: kvDefault, connection: 'cable', landing: null,
    text: `no grid data loaded here: a ${kvDefault} kV cable to an assumed landing` };
  const real = !!(c.landing && Number.isFinite(c.landing.e)), kv = c.kv;
  const L = real ? Math.hypot(c.landing.e - plantAt[0], c.landing.n - plantAt[1]) : assumedM;
  const at = real ? [c.landing.e, c.landing.n] : [plantAt[0] + assumedM, plantAt[1]];
  const kind = real ? c.landing.kind : c.connection === 'none' ? 'none' : kv >= 275 ? 'gis-bay' : 'dno-sub';
  return { kv, connection: c.connection === 'ohl-tee' ? 'ohl-tee' : 'cable', rule: c.rule, ruleText: c.text, lengthM: Math.max(20, L),
    ducted: true, unjointed: true, protection: 'tiles', plantAt, path: [plantAt, at], landing: { kind, e: at[0], n: at[1], kv, real, distanceM: L } };
}

/** The placed solar block as a network source. built: buildBlock(...), anchor: [E, N]. */
export function sourceFromBlock(built, anchor, conn = null) {
  const [E, N] = anchor, mv = built.mv, st = built.station, s = st.params;
  const acLen = new Map(), acPath = new Map();
  st.acCables.forEach((c, i) => { if (i % 3 === 0) { acLen.set(i / 3, polyLen(c.points)); acPath.set(i / 3, c.points); } });
  const stations = mv.stations.map(S => {
    const [ox, oy] = S.offset, at = [E + ox + s.transformers[0][0], N + oy + (s.transformers[0][1] + s.transformers.at(-1)[1]) / 2];
    const units = st.transformers.map((t, k) => ({ id: `T${k + 1}`, mva: t.mva, zPct: SLD_DEFAULTS.stZPct, xr: SLD_DEFAULTS.stXR, vector: 'Dy11',
      taps: '±2 × 2.5 %', at: [E + ox + t.point[0], N + oy + t.point[1]],
      windings: [{ id: 'a', kva: st.inverters.filter(i => i.transformer === k + 1).reduce((a, i) => a + i.kva, 0),
        inverters: st.inverters.filter(i => i.transformer === k + 1).map(i => ({ id: `I${i.id}`, kva: i.kva, acAreaMm2: s.acAreaMm2,
          acLengthM: acLen.get(i.id - 1), at: [E + ox + i.point[0], N + oy + i.point[1]],
          acPath: acPath.get(i.id - 1).map(q => [E + ox + q[0], N + oy + q[1], q[2]]) })) }] }));
    return { id: S.id, at, rmuAt: [E + S.rmu[0], N + S.rmu[1]], half: false, inverters: st.inverters.length, kva: st.inventory.aggregateInverterMVA * 1000,
      units, offset: [ox, oy] };
  });
  const mvPath = new Map((built.cables?.mv || []).map(c => [c.id, c.points]));
  const feeders = mv.rings.map(r => ({ id: r.id, section: r.boardA, sectionB: r.boardB, topology: r.topology || (r.openAt ? 'ring' : 'radial'), openAt: r.openAt,
    hops: r.hops.map((h, i) => ({ from: h.from, to: h.to, areaMm2: h.areaMm2 ?? r.areaMm2, lengthM: h.lengthM, open: i === r.open,
      group: h.group || 1, path: mvPath.get(`${r.id}-${i + 1}`) || null })) }));
  const C = mv.compound, boardAt = [E + mv.board[0], N + mv.board[1]];
  const sections = Array.from({ length: mv.sections }, (_, k) => ({ id: `MVB${k + 1}`, gt: `GT${(k % mv.grid.units) + 1}`, winding: 'a',
    spareWays: 1, storageWay: false, harmonicFilter: false, at: [boardAt[0], boardAt[1] - 6 + 4 * k] }));
  const grid = mv.grid.at.map(([x, y], g) => ({ id: `GT${g + 1}`, mva: mv.grid.mva, zPct: SLD_DEFAULTS.gtZPct, xr: SLD_DEFAULTS.gtXR,
    vector: SLD_DEFAULTS.gtVector, hvNeutral: SLD_DEFAULTS.gtHvNeutral, lvWindings: 1, at: [E + x, N + y] }));
  const plantAt = [E + mv.poc.at[0], N + mv.poc.at[1]];
  const hv = hvOf(conn, mv.poc.kv, plantAt);
  return { kind: 'block', label: SLD_LABEL, mw: mv.exportMW, pocKv: hv.kv, params: { acVolts: s.acVolts }, stations, feeders, sections,
    grid: hv.kv === 33 ? [] : grid,
    hv, compound: { at: [E + C.x, N + C.y], w: C.w, d: C.d, boardAt } };
}

/** A laid-out plant (plant-layout.mjs result) as a network source: its template stations, feeders routed on its roads. */
export function sourceFromLayout(r, conn = null, { acSpacingM = 25 } = {}) {
  const tpl = r.template, F = r.frame, en = (u, v) => F.en(u, v), P = tpl.params;
  const byId = new Map(r.stations.map(s => [s.id, s]));
  let invNo = 0;
  const stations = tpl.nodes.filter(n => n.kind === 'station').map(n => {
    const s = byId.get(n.id), at = s ? en(s.u, s.v) : null, k = n.rating.inverters, half = [Math.ceil(k / 2), Math.floor(k / 2)];
    const windings = half.filter(x => x > 0).map((m, w) => ({ id: 'ab'[w], kva: m * P.inverterKVA,
      inverters: Array.from({ length: m }, (_, j) => ({ id: `I${++invNo}`, kva: P.inverterKVA, acAreaMm2: 400, acLengthM: acSpacingM * (1 + Math.floor(j / 2)) })) }));
    return { id: n.id, at, rmuAt: at, half: false, inverters: k, kva: n.rating.kva,
      units: [{ id: 'T', mva: n.rating.kva / 1000, zPct: SLD_DEFAULTS.stZPct, xr: SLD_DEFAULTS.stXR, vector: windings.length > 1 ? 'Dy11y11' : 'Dy11',
        taps: '±2 × 2.5 %', windings }] };
  });
  const routed = new Map((r.electrical?.feeders || []).map(f => [f.id, f]));
  const feeders = tpl.feeders.map((f, i) => {
    const e = routed.get(`F${i + 1}`);
    const hops = (e ? e.hops : f.segments.map((sg, k) => ({ from: k ? f.chain[k - 1].id : f.board, to: f.chain[k].id, areaMm2: sg.area, lengthM: sg.lengthM })))
      .map(h => ({ from: h.from, to: h.to, areaMm2: h.areaMm2, lengthM: h.lengthM, open: false, group: 1 }));
    return { id: `F${i + 1}`, section: f.board, sectionB: f.board, topology: 'radial', openAt: null, hops };
  });
  const cm = r.compound, cAt = en(cm.u, cm.v), boards = tpl.nodes.filter(n => n.kind === 'switchboard');
  const gts = tpl.nodes.filter(n => n.kind === 'grid-transformer');
  const txOf = b => (tpl.links.find(l => l.to === b.id && l.kind === 'mv-bus')?.from) || 'GT1';
  const sections = boards.map((b, k) => ({ id: b.id, gt: gts.length ? txOf(b) : 'GT1', winding: 'a', spareWays: P.spareWays, storageWay: false,
    harmonicFilter: false, at: en(cm.u - cm.w / 4, cm.v - 6 + 4 * k) }));
  const grid = (gts.length ? gts : [{ id: 'GT1', rating: { mva: Math.max(20, tpl.params.targetMW * 1.1) } }]).map((g, k) => ({ id: g.id, mva: g.rating.mva,
    zPct: SLD_DEFAULTS.gtZPct, xr: SLD_DEFAULTS.gtXR, vector: SLD_DEFAULTS.gtVector, hvNeutral: SLD_DEFAULTS.gtHvNeutral, lvWindings: 1,
    at: en(cm.u + 4 + (k % 2) * 14 - 2, cm.v - cm.d / 4 + Math.floor(k / 2) * 10) }));
  const kv = [132, 275, 400].includes(tpl.ratings.pocKv) ? tpl.ratings.pocKv : 400;
  const plantAt = en(cm.u + cm.w / 2 - 8, cm.v);
  const hv = hvOf(conn, kv, plantAt);
  return { kind: 'layout', label: SLD_LABEL, mw: tpl.params.targetMW, pocKv: hv.kv, params: {}, stations, feeders, sections,
    grid: hv.kv === 33 ? [] : grid,
    hv, compound: { at: cAt, w: cm.w, d: cm.d, boardAt: sections[0]?.at || cAt } };
}
