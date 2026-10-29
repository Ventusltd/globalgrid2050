// COPIED UNCHANGED from the v12 world (web/world/plant-central.mjs) at v12 commit 3adcee9 (file last changed a83209f). Modular star family: not known to star-find.
// Do not edit here: change the source and re-copy. Everything below this header is byte-identical to the source.
// plant-central.mjs: what a central-inverter plant adds to the drawing. Each central station (plant-template.mjs,
// inverterClass 'central') is one container on its pad: the central inverters, the MV transformer and switchgear
// together (a 40 ft container, the generic class; a skid is drawn the same size). Its strings reach it through DC
// combiner boxes, one per group of tables: the station's tables in layout order are split into as many groups as it
// has boxes, and each box stands on a post just south of the low edge of its group's middle table.
// Sizes are generic and rounded, not any product; illustrative only. Pure: imports only the placer.

import { placer } from './station.mjs';

export const CENTRAL_EQUIPMENT = Object.freeze({
  skid: { w: 12.2, d: 2.5, h: 2.9, label: 'central inverter station: inverters, MV transformer and switchgear in a 40 ft container (generic)' },
  combiner: { w: 0.9, d: 0.35, h: 1.1, label: 'DC combiner box on a post (generic)' }
});

/**
 * Items of a laid-out plant's central stations in the layout frame: [{ kind: 'skid' | 'combiner', u, v, id, station }].
 * r: plant-layout.mjs result. Tables are stored station by station (each station's r.stations[k].tables in turn).
 */
export function centralItems(r) {
  const out = [], T = r?.table, t = r?.tables;
  if (!T || !t) return out;
  let q0 = 0;
  for (const st of r.stations || []) {
    const n = st.tables || 0;
    if (st.central) {
      out.push({ kind: 'skid', u: st.u, v: st.v, id: st.id, station: st.id });
      const boxes = Math.max(1, Math.min(st.combiners || 1, n));
      for (let b = 0; b < boxes && n; b++) {
        const a = q0 + Math.floor(b * n / boxes), z = q0 + Math.floor((b + 1) * n / boxes) - 1, m = Math.floor((a + z) / 2);
        const L = r.tableLen?.[m] ?? T.lenU;
        out.push({ kind: 'combiner', u: t[m * 6] + L / 2, v: t[m * 6 + 1] - 0.6, id: `${st.id}-CB${b + 1}`, station: st.id });
      }
    }
    q0 += n;
  }
  return out;
}

/** Solids of one item at a placed point (national-grid offsets and ground height), as mv-network.mjs draws them. */
export function itemSolids(kind, at = [0, 0, 0], id = kind, heading = 0) {
  const e = CENTRAL_EQUIPMENT[kind];
  if (!e) throw new Error(`plant central: unknown item ${kind}`);
  const P = placer(at, heading), out = [P.box({ kind, part: 'body', id, min: [-e.w / 2, -e.d / 2, kind === 'combiner' ? 0.5 : 0], max: [e.w / 2, e.d / 2, e.h] })];
  if (kind === 'combiner') out.push(P.box({ kind, part: 'post', id, min: [-0.04, -0.04, 0], max: [0.04, 0.04, 0.5] }));
  return out;
}
