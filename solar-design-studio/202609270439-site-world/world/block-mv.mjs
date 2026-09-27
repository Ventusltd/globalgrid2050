// block-mv.mjs: stations of the solar block chained on 33 kV rings to the MV board, the grid transformer(s) and the
// connection, laid out and sized from the load. Plant frame: metres east (x) and north (y) of station 1's own
// origin (station.mjs coordinates), heading 0.
//
// Layout: stations in columns of up to `rows` (2 by default) and up to 5 across; a spine trench runs along the south
// edge to the substation compound east of the field, and a feeder trench runs north up the east side of each
// column, beside a track, past each station's ring main unit (RMU) in its transformer compound. Every ring leaves
// one board section, loops through its RMUs and returns to the board, with one normally-open point in the middle
// so each half runs radially. Circuits sharing a stretch share a trench, trefoils 450 mm apart (as the two-circuit
// section in data/trench-sections.json), so the trench widens with the circuits in it.
// Sizing (plant-template.mjs rules): stations per ring from the feeder limit; every segment carries the whole ring
// load when the open point is moved to one end (IEC 60287 rating, cable-rating.mjs), not below the fault minimum
// (adiabatic, IEC 60949); upsized until the normal-running drop is within 0.5 %; grid transformers from the packed
// load (gridChoice). Illustrative, not a design for any site.

import { sizeFor, dropPercent, SIZES } from './cable-rating.mjs';
import { gridChoice, faultMinArea, TEMPLATE_DEFAULTS } from './plant-template.mjs';
import { coverage } from './plant-feeders.mjs';

export const MV_LAYOUT = Object.freeze({ pitchX: 200, pitchY: 800, maxCols: 5, rows: 2, rmu: [162, 332.5], columnX: 172, spineY: -20,
  laneM: 0.45, compound: { w: 90, d: 60, gap: 25 } });

// Load per station: the block's inverters at their rating (MVA).
export function mvChain({ stations = 4, stationMVA = 9.856, pocKv = 400, layout = MV_LAYOUT, ...opts } = {}) {
  const p = { ...TEMPLATE_DEFAULTS, ...opts }, L = layout, n = Math.round(stations);
  if (!(n >= 1 && n <= 10)) throw Error('solar block: 1 to 10 stations');
  if (![132, 275, 400].includes(pocKv)) throw Error('solar block: connection at 132, 275 or 400 kV');
  const rows = n <= 3 ? 1 : Math.min(L.rows, Math.ceil(n / L.maxCols)), cols = Math.ceil(n / rows);
  const st = Array.from({ length: n }, (_, s) => {
    const col = Math.floor(s / rows), row = s % rows, off = [col * L.pitchX, row * L.pitchY];
    return { id: `S${s + 1}`, index: s, col, row, offset: off, rmu: [off[0] + L.rmu[0], off[1] + L.rmu[1]], mva: stationMVA };
  });
  const fieldE = (cols - 1) * L.pitchX + L.columnX + 8;
  const c = { x: fieldE + L.compound.gap + L.compound.w / 2, y: L.spineY - 5, w: L.compound.w, d: L.compound.d };
  const board = [c.x - c.w / 2 + 12, c.y], gt0 = [c.x + 4, c.y + 12], poc = [c.x + c.w / 2 - 10, c.y];

  // Network lines: 's' the spine (coordinate x), 'c<col>' a column (coordinate y), 'r<s>' a station's stub (x).
  const colX = col => col * L.pitchX + L.columnX;
  const up = s => [{ key: 'c' + s.col, a: L.spineY, b: s.rmu[1] }, { key: 'r' + s.index, a: colX(s.col), b: s.rmu[0] }];
  const path = (A, B) => {                                  // A, B: 'board' or a station
    if (A === 'board') return [{ key: 's', a: board[0], b: colX(B.col) }, ...up(B)];
    if (B === 'board') return path('board', A).map(q => ({ ...q, a: q.b, b: q.a })).reverse();
    const out = [{ key: 'r' + A.index, a: A.rmu[0], b: colX(A.col) }];
    if (A.col === B.col) out.push({ key: 'c' + A.col, a: A.rmu[1], b: B.rmu[1] });
    else out.push({ key: 'c' + A.col, a: A.rmu[1], b: L.spineY }, { key: 's', a: colX(A.col), b: colX(B.col) }, { key: 'c' + B.col, a: L.spineY, b: B.rmu[1] });
    out.push({ key: 'r' + B.index, a: colX(B.col), b: B.rmu[0] });
    return out;
  };

  // Rings: as many stations as the feeder limit allows (at most 4), in column order.
  const per = Math.max(1, Math.min(p.stationsPerFeederMax, Math.floor(p.feederLimitMVA / stationMVA)));
  const nRings = Math.ceil(n / per), rings = [];
  const opt = { soilKmW: p.soilKmW, kv: 33, pf: p.powerFactor }, minArea = faultMinArea(p.faultKA, p.faultS);
  for (let k = 0, s0 = 0; k < nRings; k++) {
    const m = Math.floor(n / nRings) + (k < n % nRings ? 1 : 0), chain = st.slice(s0, s0 + m); s0 += m;
    const ends = ['board', ...chain, 'board'], hops = [];
    for (let h = 0; h + 1 < ends.length; h++) {
      const parts = path(ends[h], ends[h + 1]).filter(q => Math.abs(q.b - q.a) > 1e-9);
      hops.push({ from: ends[h] === 'board' ? 'board' : ends[h].id, to: ends[h + 1] === 'board' ? 'board' : ends[h + 1].id, parts,
        lengthM: parts.reduce((t, q) => t + Math.abs(q.b - q.a), 0) });
    }
    const open = Math.ceil(m / 2);                          // the hop left open: the middle of the ring
    const load = chain.reduce((t, s) => t + s.mva, 0);
    const pick = sizeFor(load / p.maxUtilisation, { ...opt, minArea });
    let area = pick ? pick.area : SIZES.at(-1);
    // Normal running: stations before the open hop from leg A, the rest from leg B (each half radial).
    const dropWith = a => {
      const side = (hs, sts) => hs.reduce((t, h, i) => t + dropPercent(a, h.lengthM, sts.slice(i).reduce((u, s) => u + s.mva, 0), opt), 0);
      const A = side(hops.slice(0, open), chain.slice(0, open)), B = side(hops.slice(open + 1).reverse(), chain.slice(open).reverse());
      const outage = side(hops.slice(0, m), chain);          // leg B out: the whole ring from leg A
      return { normal: Math.max(A, B), outage };
    };
    while (dropWith(area).normal > p.vdropLimitPct && area < SIZES.at(-1)) area = SIZES[SIZES.indexOf(area) + 1];
    const d = dropWith(area);
    rings.push({ id: `F${k + 1}`, stations: chain.map(s => s.id), hops, open, openAt: hops[open].to === 'board' ? hops[open].from : hops[open].to,
      loadMVA: load, areaMm2: area, carries: pick ? pick.amps : null, dropPct: d.normal, outageDropPct: d.outage });
  }

  // Board sections: at most 6 ways each, one per grid transformer at least; the two ends of a ring on different sections.
  const exportMW = n * stationMVA * p.powerFactor;
  const grid = gridChoice(exportMW, exportMW * p.gridFactor, null, rings.map(r => ({ loadMVA: r.loadMVA })));
  const sections = Math.max(1, grid.units, Math.ceil(2 * rings.length / p.feedersPerBoardMax));
  rings.forEach((r, k) => { r.boardA = `MVB${(k % sections) + 1}`; r.boardB = `MVB${((k + (sections > 1 ? 1 : 0)) % sections) + 1}`; });

  // Circuits: each hop is one three-core circuit; lanes on each line in the order circuits first use it.
  const lanes = new Map(), laneOf = (key, id) => { if (!lanes.has(key)) lanes.set(key, []); const l = lanes.get(key); if (!l.includes(id)) l.push(id); return l.indexOf(id); };
  const circuits = rings.flatMap(r => r.hops.map((h, i) => ({ id: `${r.id}-${i + 1}`, ring: r.id, from: h.from, to: h.to, parts: h.parts,
    lengthM: h.lengthM, areaMm2: r.areaMm2, normallyOpen: i === r.open })));
  for (const cc of circuits) for (const q of cc.parts) q.lane = laneOf(q.key, cc.id);
  const lineOf = key => (key === 's' ? { along: 'x', at: L.spineY } : key[0] === 'c' ? { along: 'y', at: colX(Number(key.slice(1))) }
    : { along: 'x', at: st[Number(key.slice(1))].rmu[1] });
  const off = (key, lane) => (lane - ((lanes.get(key).length - 1) / 2)) * L.laneM;
  const xy = (key, v, lane) => { const g = lineOf(key), o = off(key, lane); return g.along === 'x' ? [v, g.at + o] : [g.at + o, v]; };
  for (const cc of circuits) cc.plan = cc.parts.flatMap(q => [xy(q.key, q.a, q.lane), xy(q.key, q.b, q.lane)])
    .filter((pt, i, a) => !i || Math.hypot(pt[0] - a[i - 1][0], pt[1] - a[i - 1][1]) > 1e-6);
  const trenches = [];
  for (const key of lanes.keys()) {
    const list = circuits.flatMap(cc => cc.parts.filter(q => q.key === key).map(q => ({ a: Math.min(q.a, q.b), b: Math.max(q.a, q.b), lane: q.lane })));
    for (const s of coverage(list)) {
      const inside = list.filter(q => q.a < s.b - 1e-9 && q.b > s.a + 1e-9).map(q => off(key, q.lane));
      const lo = Math.min(...inside), hi = Math.max(...inside), w = hi - lo + L.laneM, mid = (lo + hi) / 2, g = lineOf(key);
      const plan = g.along === 'x' ? [[s.a, g.at + mid], [s.b, g.at + mid]] : [[g.at + mid, s.a], [g.at + mid, s.b]];
      trenches.push({ key, circuits: s.c, width: Math.max(0.45, w), plan, lengthM: s.b - s.a });
    }
  }
  const trenchM = trenches.reduce((t, x) => t + x.lengthM, 0);
  const cableM = circuits.reduce((t, cc) => t + 3 * (cc.lengthM * 1.03 + 10), 0);
  return { stations: st, rows, cols, rings, circuits, trenches, trenchM, cableM, compound: c, board, sections,
    grid: { units: grid.units, mva: grid.mva, smallest: grid.smallest, at: Array.from({ length: grid.units }, (_, g) => [gt0[0] + g * 16, gt0[1]]) },
    poc: { kv: pocKv, at: poc }, exportMW, perRing: per, minAreaMm2: minArea,
    note: 'Illustrative, not a design for any site: ring sizes from generic rating rules, routes along assumed tracks.' };
}
