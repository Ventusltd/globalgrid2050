// xray.mjs: the as-built X-ray view. Once a trench is backfilled nothing of it shows on the ground; this view draws the
// ground faint and see-through and the buried works bright: every trench's walls and floor, the ducts and cables at their
// true positions in the section, the warning tape and tiles, draw pits and joint bays, at their depth under the measured
// ground. Loaded the first time the X-ray is switched on (xray-ui.mjs); nothing here runs on the first frame.
//
// xrayFilter(batches, extra) is the frame filter: occluders (the hidden ground mesh that hides what is under a hill) are
// dropped so buried lines show, every other batch is drawn at a fraction of its alpha, and the X-ray batches go on top.
// buriedLines(runs, opts) builds those batches from trench runs in local metres. Pure: no DOM.

import { crossSection } from './trench-section.mjs';
import { applyGround, OPERATOR_SPEC } from './spec-rules.mjs';

export const XRAY = Object.freeze({
  dim: 0.3,          // everything above ground at 30 % of its alpha: the ground reads as a faint veil
  rangeM: 900,       // runs further than this from the viewer are left out
  stepM: 6,          // rails follow the ground at this spacing
  sliceEvery: 3,     // a cross-section slice every third step
  colour: Object.freeze({ trench: [0.95, 0.78, 0.4, 0.85], duct: [0.45, 0.85, 1, 1], cable: [1, 0.5, 0.3, 1],
    marker: [1, 0.95, 0.25, 0.9], pit: [0.95, 0.97, 1, 1], joint: [0.8, 0.6, 1, 1] })
});

/** The frame with the X-ray applied: no occluders, the rest dimmed, the X-ray batches added last. */
export function xrayFilter(batches, extra = [], dim = XRAY.dim) {
  const out = [];
  for (const b of batches) {
    if (b.occluder) continue;
    out.push(b.color ? { ...b, color: [b.color[0], b.color[1], b.color[2], (b.color[3] ?? 1) * dim] } : b);
  }
  return out.concat(extra);
}

const len2 = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);

// Points every `step` metres along a plan polyline (and at each corner), with the unit normal (left of travel).
export function samples(pts, step) {
  const out = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], L = len2(a, b);
    if (!(L > 0)) continue;
    const nx = -(b[1] - a[1]) / L, ny = (b[0] - a[0]) / L, k = Math.max(1, Math.ceil(L / step));
    for (let j = out.length ? 1 : 0; j <= k; j++) out.push({ x: a[0] + (b[0] - a[0]) * j / k, y: a[1] + (b[1] - a[1]) * j / k, nx, ny });
  }
  return out;
}

/**
 * buriedLines(runs, { groundAt, eye, pits, joints, rangeM, stepM }) -> { trench, duct, cable, marker, pit, joint } Float32Arrays
 * runs: [{ path: [[x, y]...] local metres, section (trench-sections.json form), cableOdMm }]
 * pits / joints: [{ at: [x, y], l, w, depth }] local metres. Positions are relative to `base` ([x, y, z]).
 */
export function buriedLines(runs, { groundAt, eye = null, pits = [], joints = [], rangeM = XRAY.rangeM, stepM = XRAY.stepM,
  base = [0, 0, 0], spec = OPERATOR_SPEC } = {}) {
  const v = { trench: [], duct: [], cable: [], marker: [], pit: [], joint: [] };
  const push = (k, a, b) => v[k].push(a[0] - base[0], a[1] - base[1], a[2] - base[2], b[0] - base[0], b[1] - base[1], b[2] - base[2]);
  const far = pts => eye && pts.every(p => Math.hypot(p[0] - eye[0], p[1] - eye[1]) > rangeM);
  for (const r of runs) {
    if (!r.path || r.path.length < 2 || far(r.path)) continue;
    const eff = applyGround(r.section, spec, 'normal'), cs = crossSection(r.section, eff, { cableOdMm: r.cableOdMm || null });
    const S = samples(r.path, stepM).map(s => ({ ...s, g: groundAt(s.x, s.y) })).filter(s => Number.isFinite(s.g));
    const P = (s, [u, z]) => [s.x + s.nx * u, s.y + s.ny * u, s.g + z];
    const rails = [
      ['trench', [-cs.width / 2, -cs.depth]], ['trench', [cs.width / 2, -cs.depth]], ['trench', [-cs.topHalf, 0]], ['trench', [cs.topHalf, 0]],
      ...cs.items.map(it => [it.kind === 'duct' ? 'duct' : 'cable', [it.u, it.z]]),
      ...cs.markers.flatMap(m => [['marker', [m.u0, m.z]], ['marker', [m.u1, m.z]]])
    ];
    S.forEach((s, i) => {
      if (i) for (const [k, uz] of rails) push(k, P(S[i - 1], uz), P(s, uz));
      if (i % XRAY.sliceEvery === 0 || i === S.length - 1) {                       // a slice: walls, floor, ducts and cables
        for (let j = 1; j < cs.outline.length; j++) push('trench', P(s, cs.outline[j - 1]), P(s, cs.outline[j]));
        for (const m of cs.markers) push('marker', P(s, [m.u0, m.z]), P(s, [m.u1, m.z]));
        for (const it of cs.items) {
          const n = it.kind === 'duct' ? 10 : 6, k = it.kind === 'duct' ? 'duct' : 'cable';
          for (let q = 0; q < n; q++) {
            const t0 = 2 * Math.PI * q / n, t1 = 2 * Math.PI * (q + 1) / n;
            push(k, P(s, [it.u + it.r * Math.cos(t0), it.z + it.r * Math.sin(t0)]), P(s, [it.u + it.r * Math.cos(t1), it.z + it.r * Math.sin(t1)]));
          }
        }
      }
    });
  }
  const box = (k, [x, y], l, w, depth) => {
    const g = groundAt(x, y);
    if (!Number.isFinite(g) || (eye && Math.hypot(x - eye[0], y - eye[1]) > rangeM)) return;
    const c = [[-l / 2, -w / 2], [l / 2, -w / 2], [l / 2, w / 2], [-l / 2, w / 2]].map(([a, b]) => [x + a, y + b]);
    for (let i = 0; i < 4; i++) {
      const a = c[i], b = c[(i + 1) % 4];
      push(k, [...a, g], [...b, g]); push(k, [...a, g - depth], [...b, g - depth]); push(k, [...a, g], [...a, g - depth]);
    }
  };
  for (const p of pits) box('pit', p.at, p.l ?? 1.2, p.w ?? 0.9, p.depth ?? 1.0);
  for (const j of joints) box('joint', j.at, j.l ?? 4, j.w ?? 1.5, j.depth ?? 1.2);
  const out = {};
  for (const [k, a] of Object.entries(v)) out[k] = new Float32Array(a);
  return out;
}

/** Line batches for the renderer from buriedLines output. */
export function xrayBatches(lines, { base, version }) {
  return Object.entries(lines).filter(([, a]) => a.length).map(([k, a]) => ({ key: 'xray-' + k, version, positions: a, color: XRAY.colour[k], origin: base }));
}

/** Words for the readout: what the X-ray draws. */
export function xraySummary(runs, pits, joints, totals = null) {
  const m = runs.reduce((t, r) => t + r.path.slice(1).reduce((u, q, i) => u + len2(r.path[i], q), 0), 0);
  // totals: the block's own count (trench-plan.mjs), the same numbers as its readout; drawn Design trenches are added to it.
  const n = runs.length, drawn = totals ? n - totals.trenches : 0;
  const what = totals ? `${totals.trenches} trench${totals.trenches === 1 ? '' : 'es'} dug on the block (${Math.round(totals.dugM)} m)`
    + `${drawn > 0 ? ` and ${drawn} drawn in Design` : ''}` : `${n} buried trench run${n === 1 ? '' : 's'} (${Math.round(m)} m)`;
  return `X-ray on: ${what}, ${pits.length} draw pit${pits.length === 1 ? '' : 's'}, `
    + `${joints.length} joint bay${joints.length === 1 ? '' : 's'} shown under the ground. Ducts blue, cables orange, tape and tiles yellow.`;
}
