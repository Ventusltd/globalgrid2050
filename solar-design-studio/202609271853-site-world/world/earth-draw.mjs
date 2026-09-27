// earth-draw.mjs: the earthing layer in 3D, as line groups in national-grid metres (the same form as sld-symbols.mjs).
// Below the ground, dashed so it reads without colour (straw): each station's pad ring and rods with the transformer tank
// bonds; each field's earth ring and the array bonding mesh along the table rows and across them, with a dotted bond
// down from each table end (structure steel) and each inverter pole; the link from the pad ring to its field; the
// substation compound's earth grid, its rods and the bonded fence corners (and a perimeter conductor 1 m outside the
// fence when the fence touch check asks for one); on the 33 kV cables, the screen bonding points: a straw ring where
// the screens are earthed, a straw box at a cross-bonding link box, a small red box at a single-point open end (SVL).
// Illustrative, early design only, no warranty. Pure: no DOM. groundAt(e, n) gives the ground (m).

import { placeMarks } from './earth-screen.mjs';
import { STATION_DEFAULTS as SD } from './station.mjs';

const DASH = [3, 1.5], DOT = [0.4, 0.4];
function group() { return { base: null, v: [] }; }
const put = (G, p) => { if (!G.base) G.base = [p[0], p[1], p[2]]; G.v.push(p[0] - G.base[0], p[1] - G.base[1], p[2] - G.base[2]); };
const seg = (G, a, b) => { put(G, a); put(G, b); };
// A dashed straight line from a to b (3D), dash pattern [on, off] in metres.
function dashed(G, a, b, [on, off] = DASH) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  if (!(L > 0)) return;
  const at = t => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  for (let d = 0; d < L; d += on + off) seg(G, at(d / L), at(Math.min(L, d + on) / L));
}
// A dashed line that follows the ground at a depth, sampled every `step` metres.
function buried(G, [e0, n0], [e1, n1], depth, groundAt, step = 6) {
  const L = Math.hypot(e1 - e0, n1 - n0), k = Math.max(1, Math.ceil(L / step));
  let p = [e0, n0, groundAt(e0, n0) - depth];
  for (let i = 1; i <= k; i++) {
    const e = e0 + (e1 - e0) * i / k, n = n0 + (n1 - n0) * i / k, q = [e, n, groundAt(e, n) - depth];
    dashed(G, p, q); p = q;
  }
}
const rectLoop = (G, [e0, n0, e1, n1], draw) => { draw(G, [e0, n0], [e1, n0]); draw(G, [e1, n0], [e1, n1]); draw(G, [e1, n1], [e0, n1]); draw(G, [e0, n1], [e0, n0]); };
const rod = (G, [e, n, z], L) => { seg(G, [e, n, z], [e, n, z - L]); seg(G, [e - 0.3, n, z - L], [e + 0.3, n, z - L]); seg(G, [e, n - 0.3, z - L], [e, n + 0.3, z - L]); };
const drop = (G, [e, n], zTop, zBot) => dashed(G, [e, n, zTop], [e, n, zBot], DOT);
function ringMark(G, [e, n, z], r = 0.8) {
  for (let k = 0; k < 12; k++) {
    const a = 2 * Math.PI * k / 12, b = 2 * Math.PI * (k + 1) / 12;
    seg(G, [e + r * Math.cos(a), n + r * Math.sin(a), z], [e + r * Math.cos(b), n + r * Math.sin(b), z]);
  }
}
function boxMark(G, [e, n, z], s = 0.6) {
  const c = [[-s, -s], [s, -s], [s, s], [-s, s]];
  for (let i = 0; i < 4; i++) { const a = c[i], b = c[(i + 1) % 4]; seg(G, [e + a[0], n + a[1], z], [e + b[0], n + b[1], z]); seg(G, [e + a[0], n + a[1], z + 2 * s], [e + b[0], n + b[1], z + 2 * s]);
    seg(G, [e + a[0], n + a[1], z], [e + a[0], n + a[1], z + 2 * s]); }
}

/**
 * earthGroups(study, { block, groundAt, inverters }) -> { earth, open, counts }: groups { base, v: Float32Array }.
 * study: earthStudy(...) (earth-study.mjs); inverters: [[x, y]] of station 1's inverter poles relative to the anchor.
 */
export function earthGroups(s, { block, groundAt = () => 0, inverters = [] } = {}) {
  const G = { earth: group(), open: group() }, S = s.settings, d = S.ringDepth, R = s.rects;
  const [E, N] = block.anchor, counts = { rods: 0, tableBonds: 0, inverterBonds: 0, marks: 0, stations: R.stations.length };
  const lay = (Gx, a, b) => buried(Gx, a, b, d, groundAt);
  for (const st of R.stations) {
    const z = Number.isFinite(st.level) ? st.level : groundAt((st.pad[0] + st.pad[2]) / 2, (st.pad[1] + st.pad[3]) / 2), zr = z - d;
    // pad ring and its middle cross conductor, rods, the transformer tank bonds
    const p = st.pad, flat = (a, b) => dashed(G.earth, [a[0], a[1], zr], [b[0], b[1], zr]);
    rectLoop(G.earth, p, flat); flat([p[0], (p[1] + p[3]) / 2], [p[2], (p[1] + p[3]) / 2]);
    for (const [x, y] of s.ring.geo.rods) { rod(G.earth, [p[0] + x, p[1] + y, zr], S.rodLength); counts.rods++; }
    for (const [x, y] of SD.transformers) drop(G.earth, [E + st.off[0] + x, N + st.off[1] + y], z, zr);
    // field: earth ring, the bonding mesh along the table columns and across them, table and inverter bonds
    const f = st.field;
    rectLoop(G.earth, f, lay);
    const cols = [...new Set(st.tables.map(t => t[0]))];
    for (const x of cols) lay(G.earth, [x, f[1]], [x, f[3]]);
    const meshM = s.array.bonding.assumed.meshM || 20;
    for (let y = f[1] + meshM; y < f[3] - 1; y += meshM) lay(G.earth, [f[0], y], [f[2], y]);
    for (const [x, y] of st.tables) for (const yy of [y, y + R.tableSpan]) { const g = groundAt(x, yy); drop(G.earth, [x, yy], g, g - d); counts.tableBonds++; }
    for (const [x, y] of inverters) { const e = E + st.off[0] + x, n = N + st.off[1] + y, g = groundAt(e, n); drop(G.earth, [e, n], g + 1, g - d); counts.inverterBonds++; }
    lay(G.earth, [p[0], (p[1] + p[3]) / 2], [f[2], Math.min(f[3], Math.max(f[1], (p[1] + p[3]) / 2))]);  // pad ring to field ring
  }
  // substation compound: the grid, its rods, the bonded fence corners, an outer perimeter conductor if the fence asks
  const c = R.compound, sub = s.substation, geo = sub.geo;
  const cz = Number.isFinite(R.compoundLevel) ? R.compoundLevel : groundAt((c[0] + c[2]) / 2, (c[1] + c[3]) / 2), zg = cz - geo.h;
  const flatC = (a, b) => dashed(G.earth, [a[0], a[1], zg], [b[0], b[1], zg]);
  for (let i = 0; i < geo.nx; i++) flatC([c[0] + i * geo.Dx, c[1]], [c[0] + i * geo.Dx, c[3]]);
  for (let j = 0; j < geo.ny; j++) flatC([c[0], c[1] + j * geo.Dy], [c[2], c[1] + j * geo.Dy]);
  for (const [x, y] of geo.rods) { rod(G.earth, [c[0] + x, c[1] + y, zg], geo.Lr); counts.rods++; }
  for (const q of [[c[0], c[1]], [c[2], c[1]], [c[2], c[3]], [c[0], c[3]]]) drop(G.earth, q, cz + 1.2, zg);
  if (sub.fence && !sub.fence.pass) rectLoop(G.earth, [c[0] - 1, c[1] - 1, c[2] + 1, c[3] + 1], flatC);
  // cable screens: earthed ends, cross-bonding link boxes, single-point open ends
  for (const cab of s.cables) {
    if (!cab.path || cab.path.length < 2) continue;
    for (const m of placeMarks(cab.study.marks, cab.path.map(q => [q[0], q[1]]))) {
      const [e, n] = m.at, g = groundAt(e, n);
      if (m.kind === 'screen-earth') { ringMark(G.earth, [e, n, g + 1]); drop(G.earth, [e, n], g + 1, g - d); }
      else if (m.kind === 'cross-link') boxMark(G.earth, [e, n, g]);
      else if (m.kind === 'svl-link') boxMark(G.open, [e, n, g]);
      else continue;
      counts.marks++;
    }
  }
  for (const k of Object.keys(G)) G[k] = { base: G[k].base, v: new Float32Array(G[k].v) };
  return { ...G, counts };
}
