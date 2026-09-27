// hud-drops.mjs: the voltage drops the check HUD shows for the placed solar block, worked out the way Follow works them
// (sld-follow.mjs), so the HUD and Follow give one answer:
//   DC  each connected string: the series loop through its modules and its two home cables, at the string current of the
//       generic module class, over the string's own Vmp (modules in series x module Vmp: the typed series length)
//   AC  each inverter's AC cable, read from the block's single-line network solved in sld-calc.mjs (the Follow AC stop)
// Plan lengths (the ground's rise is left out; Follow adds it, a fraction of a percent of the length on a field).
// Illustrative: cable sizes and module values are the SLD's stated assumptions (sld-rules.mjs). Pure: no DOM.

import { sourceFromBlock } from './sld-source.mjs';
import { buildGraph } from './sld-graph.mjs';
import { solve, readouts } from './sld-calc.mjs';
import { SLD_DEFAULTS } from './sld-rules.mjs';

const len = pts => pts.reduce((t, q, i) => (i ? t + Math.hypot(q[0] - pts[i - 1][0], q[1] - pts[i - 1][1]) : 0), 0);

/** The worst DC string drop of station 1 (every station is the same block moved): { pct, string, lengthM, mps } or null. */
export function dcDrop(built, d = SLD_DEFAULTS) {
  const M = d.module, R = d.dcOhmKm20 / 1000 * (1 + 0.00393 * (d.dcTempC - 20)), dc = built?.cables?.dc || [];
  let worst = null;
  (built?.station?.strings || []).forEach((s, i) => {
    const neg = dc[2 * i], pos = dc[2 * i + 1];
    if (!s.connected || !neg || !pos) return;
    const L = len(s.modules.map(m => m.terminal)) + len(pos.points) + len(neg.points), pct = M.imp * R * L / (M.vmp * s.modules.length) * 100;
    if (!worst || pct > worst.pct) worst = { pct, string: i, lengthM: L, mps: s.modules.length };
  });
  return worst;
}

/** The worst inverter AC cable drop from the block's solved network: { pct, id, lengthM } or null. */
export function acDrop(built, anchor) {
  try {
    const g = buildGraph(sourceFromBlock(built, anchor)), ro = readouts(g, solve(g));
    let worst = null;
    for (const b of g.branches) if (b.kind === 'ac-cable') { const r = ro.branches.get(b.id); if (r && (!worst || r.dropPct > worst.pct)) worst = { pct: r.dropPct, id: b.id, lengthM: b.lengthM }; }
    return worst;
  } catch { return null; }   // a network that does not solve says nothing here; the SLD says why
}

/** Both, for the HUD: { dc, ac } (each may be null). */
export const blockDrops = (built, anchor) => ({ dc: dcDrop(built), ac: acDrop(built, anchor) });
