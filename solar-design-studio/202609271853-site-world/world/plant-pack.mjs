// plant-pack.mjs: a laid-out plant as a compact pack, the one source every overview level is drawn from.
//
// Stage 1 of the 500 MW overview (reviews 500mw-lod 1-5): the layout's result (plant-layout.mjs) is packed into typed arrays,
// 26 bytes a table, plus the block / station / feeder graph and a uniform grid index, so a plant of 20,000 tables is
// about 0.5 MB and the whole plant can be drawn from it at any distance without keeping one big line batch.
//
// Per table (structure of arrays, local metres from one plant origin held in doubles):
//   x, y, z  Float32 x3   centre of the table in plan, and the mean height of its four surface corners
//   heading  Int16        the table's long axis, hundredths of a degree anticlockwise from east
//   tilt     Uint8        quarter degrees
//   type     Uint8        index into the pack's table types (sizes, faces, rise)
//   block    Uint16       the block (station) the table belongs to
//   dz       Int16 x4     the four surface corners less z, in centimetres, in local order (-L/2,-D/2), (+L/2,-D/2),
//                          (+L/2,+D/2), (-L/2,+D/2): along the long axis, then across it; the -D/2 edge is the low edge.
// The corners are the module plane as built: on its piles where it has them, else the ground plus the design heights.
// East-west ridges and tracker tubes are derived from the corners and the type, never stored.
// Pure: no DOM, no WebGL.

import { trackerHub } from './pile-rules.mjs';

export const BYTES_PER_TABLE = 26;
export const CELL_M = 250;
const MAGIC = 0x4b505047, VERSION = 1; // 'GPPK'

// Local unit axes for a heading in hundredths of a degree: along (the long axis) and across (90 degrees anticlockwise).
export function axesOf(h) {
  const a = h * Math.PI / 18000, c = Math.cos(a), s = Math.sin(a);
  return { ax: [c, s], dx: [-s, c] };
}

// The four surface corners of table i as [x, y, z] local to the pack origin, in pack order.
export function cornersOf(pack, i) {
  const T = pack.types[pack.type[i]], { ax, dx } = axesOf(pack.heading[i]), L = T.lenU / 2, D = T.depth / 2;
  const x = pack.x[i], y = pack.y[i], z = pack.z[i], out = [];
  for (const [k, [a, d]] of [[-L, -D], [L, -D], [L, D], [-L, D]].entries())
    out.push([x + a * ax[0] + d * dx[0], y + a * ax[1] + d * dx[1], z + pack.dz[i * 4 + k] / 100]);
  return out;
}

// r: a layoutPlant result; surface(q) -> [[a0, a1], [m0, m1], [b0, b1]] the fitted module edges of table q (plant-piles
// edges) or null. Without it, the corners are the ground plus the layout's low edge and rise (as plant-ui draws them).
export function packPlant(r, { surface = null } = {}) {
  const F = r.frame, T = r.table, P = r.params, t = r.tables, n = t.length / 6;
  const bx = r.boundary.map(([u, v]) => F.en(u, v));
  const origin = [Math.min(...bx.map(p => p[0])), Math.min(...bx.map(p => p[1])), 0];
  const heading = F.swap ? -9000 : 0;                       // south rows run east; east-west and tracker rows run north
  const type = { layout: r.layout, lenU: T.lenU, depth: T.depth, rise: T.rise || 0, modules: T.modules, strings: T.strings,
    tracker: !!T.tracker, south: !!T.south, faces: T.south || T.tracker ? 1 : 2, tiltDeg: (T.tilt || 0) * 180 / Math.PI, kWp: T.kWp };
  const pack = allocate(n, origin, [type]);
  const lo = P.lowEdgeM, hi = lo + (T.rise || 0), hub = trackerHub().hub;
  // Block of each table: tables come out in station order, a prefix sum of stations[s].tables.
  let s = 0, left = r.stations[0]?.tables ?? n;
  for (let q = 0; q < n; q++) {
    while (left <= 0 && s < r.stations.length - 1) left = r.stations[++s].tables;
    left--;
    const [ua, va, h0, h1, h2, h3] = t.subarray(q * 6, q * 6 + 6), ub = ua + T.lenU, vb = va + T.depth;
    const tube = T.tracker ? [(h0 + h3) / 2 + hub, (h1 + h2) / 2 + hub] : null;   // a tracker at stow: flat across, on its tube
    const E = surface?.(q) || (tube ? [tube, tube, tube] : [[h0 + lo, h1 + lo], null, T.south ? [h3 + hi, h2 + hi] : [h3 + lo, h2 + lo]]);
    // Surface heights at the frame corners A (ua,va), B (ub,va), C (ub,vb), D (ua,vb).
    const A = E[0][0], B = E[0][1], C = E[2][1], D = E[2][0];
    // Pack order: south (heading 0) is A B C D; swapped frames (heading -90) put +along at ua, -across at va: B A D C.
    const cz = F.swap ? [B, A, D, C] : [A, B, C, D], z = (cz[0] + cz[1] + cz[2] + cz[3]) / 4;
    const [e, nn] = F.en((ua + ub) / 2, (va + vb) / 2);
    pack.x[q] = e - origin[0]; pack.y[q] = nn - origin[1]; pack.z[q] = z;
    pack.heading[q] = heading; pack.tilt[q] = Math.round(type.tiltDeg * 4); pack.type[q] = 0; pack.block[q] = s;
    for (let k = 0; k < 4; k++) pack.dz[q * 4 + k] = Math.round((cz[k] - z) * 100);
  }
  pack.graph = graphOf(r, origin);
  pack.fence = bx.map(([e, nn]) => [e - origin[0], nn - origin[1]]);
  indexPack(pack);
  return pack;
}

function allocate(n, origin, types) {
  return { n, origin, types, x: new Float32Array(n), y: new Float32Array(n), z: new Float32Array(n), heading: new Int16Array(n),
    tilt: new Uint8Array(n), type: new Uint8Array(n), block: new Uint16Array(n), dz: new Int16Array(n * 4), graph: null, fence: [], grid: null };
}

// Blocks (one per station): the tables' extent in the plant's own axes, as a rectangle; stations and feeders as a graph.
function graphOf(r, origin) {
  const F = r.frame, loc = (u, v) => { const [e, n] = F.en(u, v); return [e - origin[0], n - origin[1]]; };
  const stations = r.stations.map((s, i) => ({ id: s.id, block: i, at: loc(s.u, s.v), mva: s.mva, inverters: s.inverters, tables: s.tables }));
  const byId = new Map(stations.map(s => [s.id, s]));
  const cm = r.compound, compound = cm ? { at: loc(cm.u, cm.v), w: cm.w, d: cm.d } : null;
  const feeders = (r.electrical?.feeders || []).map(f => ({ id: f.id, stations: f.stations.map(id => byId.get(id)?.block ?? -1), dropPct: f.dropPct }));
  for (const f of feeders) for (const b of f.stations) if (stations[b]) stations[b].feeder = f.id;
  return { stations, compound, feeders };
}

// Blocks' rectangles and the uniform grid index (CSR: tables sorted by cell, cellStart gives each cell's range).
export function indexPack(pack, cellM = CELL_M) {
  const n = pack.n, blocks = new Map();
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < n; i++) {
    x0 = Math.min(x0, pack.x[i]); y0 = Math.min(y0, pack.y[i]); x1 = Math.max(x1, pack.x[i]); y1 = Math.max(y1, pack.y[i]);
    const T = pack.types[pack.type[i]], { ax, dx } = axesOf(pack.heading[i]), a = pack.x[i] * ax[0] + pack.y[i] * ax[1], d = pack.x[i] * dx[0] + pack.y[i] * dx[1];
    let b = blocks.get(pack.block[i]);
    if (!b) blocks.set(pack.block[i], b = { id: pack.block[i], h: pack.heading[i], a0: Infinity, a1: -Infinity, d0: Infinity, d1: -Infinity, z: 0, tables: 0 });
    b.a0 = Math.min(b.a0, a - T.lenU / 2); b.a1 = Math.max(b.a1, a + T.lenU / 2);
    b.d0 = Math.min(b.d0, d - T.depth / 2); b.d1 = Math.max(b.d1, d + T.depth / 2); b.z += pack.z[i]; b.tables++;
  }
  pack.blocks = [...blocks.values()].sort((p, q) => p.id - q.id).map(b => {
    const { ax, dx } = axesOf(b.h), pt = (a, d) => [a * ax[0] + d * dx[0], a * ax[1] + d * dx[1]];
    return { id: b.id, tables: b.tables, z: b.z / b.tables, rect: [pt(b.a0, b.d0), pt(b.a1, b.d0), pt(b.a1, b.d1), pt(b.a0, b.d1)] };
  });
  if (!n) { pack.grid = { cellM, x0: 0, y0: 0, cols: 0, rows: 0, cellStart: new Uint32Array(1), cellTables: new Uint32Array(0), zMin: new Float32Array(0), zMax: new Float32Array(0) }; return pack; }
  const gx0 = Math.floor(x0 / cellM) * cellM, gy0 = Math.floor(y0 / cellM) * cellM;
  const cols = Math.floor((x1 - gx0) / cellM) + 1, rows = Math.floor((y1 - gy0) / cellM) + 1, cells = cols * rows;
  const cellOf = new Uint32Array(n), count = new Uint32Array(cells + 1);
  for (let i = 0; i < n; i++) { const c = Math.floor((pack.y[i] - gy0) / cellM) * cols + Math.floor((pack.x[i] - gx0) / cellM); cellOf[i] = c; count[c + 1]++; }
  for (let c = 0; c < cells; c++) count[c + 1] += count[c];
  const cellTables = new Uint32Array(n), fill = count.slice(0, cells), zMin = new Float32Array(cells).fill(Infinity), zMax = new Float32Array(cells).fill(-Infinity);
  for (let i = 0; i < n; i++) { const c = cellOf[i]; cellTables[fill[c]++] = i; zMin[c] = Math.min(zMin[c], pack.z[i]); zMax[c] = Math.max(zMax[c], pack.z[i]); }
  pack.grid = { cellM, x0: gx0, y0: gy0, cols, rows, cellStart: count, cellTables, zMin, zMax };
  return pack;
}

// The tables of one cell, as a subarray of table ids.
export const cellTables = (pack, c) => pack.grid.cellTables.subarray(pack.grid.cellStart[c], pack.grid.cellStart[c + 1]);

// ---- binary: header JSON (origin, types, graph, fence) + the eight arrays, 26 B a table ----
const FIELDS = [['x', Float32Array, 1], ['y', Float32Array, 1], ['z', Float32Array, 1], ['heading', Int16Array, 1],
  ['dz', Int16Array, 4], ['block', Uint16Array, 1], ['tilt', Uint8Array, 1], ['type', Uint8Array, 1]];

export function encodePack(pack) {
  const head = new TextEncoder().encode(JSON.stringify({ n: pack.n, origin: pack.origin, types: pack.types, graph: pack.graph, fence: pack.fence, cellM: pack.grid?.cellM ?? CELL_M }));
  const pad = (4 - ((12 + head.length) % 4)) % 4, body = pack.n * BYTES_PER_TABLE;
  const buf = new ArrayBuffer(12 + head.length + pad + body + 4), dv = new DataView(buf);
  dv.setUint32(0, MAGIC, true); dv.setUint32(4, VERSION, true); dv.setUint32(8, head.length, true);
  new Uint8Array(buf, 12, head.length).set(head);
  let at = 12 + head.length + pad;
  for (const [k, C, w] of FIELDS) {
    const bytes = pack.n * w * C.BYTES_PER_ELEMENT;
    new Uint8Array(buf, at, bytes).set(new Uint8Array(pack[k].buffer, pack[k].byteOffset, bytes)); at += bytes;
  }
  return buf;
}

export function decodePack(buf) {
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== MAGIC) throw Error('not a plant pack');
  if (dv.getUint32(4, true) !== VERSION) throw Error(`plant pack version ${dv.getUint32(4, true)} is not ${VERSION}`);
  const len = dv.getUint32(8, true), head = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 12, len)));
  const pack = allocate(head.n, head.origin, head.types);
  let at = 12 + len + ((4 - ((12 + len) % 4)) % 4);
  for (const [k, C, w] of FIELDS) { const bytes = head.n * w * C.BYTES_PER_ELEMENT; pack[k] = new C(buf.slice(at, at + bytes)); at += bytes; }
  pack.graph = head.graph; pack.fence = head.fence;
  return indexPack(pack, head.cellM);
}

// What the pack holds, in the figures a reader checks: tables, bytes a table, bytes in all, blocks, cells.
export const packSize = pack => ({ tables: pack.n, bytesPerTable: BYTES_PER_TABLE, tableBytes: pack.n * BYTES_PER_TABLE,
  blocks: pack.blocks.length, stations: pack.graph?.stations.length ?? 0, feeders: pack.graph?.feeders.length ?? 0,
  cells: pack.grid.cols * pack.grid.rows, indexBytes: pack.grid.cellStart.byteLength + pack.grid.cellTables.byteLength });
