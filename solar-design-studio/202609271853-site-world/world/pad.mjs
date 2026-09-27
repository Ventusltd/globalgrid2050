// pad.mjs: level platforms for transformer foundations, inverter skids and battery compounds.
//
// Local metres: x east, y north, z up, as camera.mjs. The ground is any function groundAt(x, y).
// No DOM, no WebGL. Sampling, batters, volumes, the balanced level, the daylight search and the ground with pads in it
// come from the shared earthworks engine (lib/earthworks.mjs), which the trench and road cartridges use too. The
// default export is a pad layer for a host that imports it (it imports the engine, so it is not a blob-URL layer).
//
// A pad is a plan polygon (or a rectangle: centre, width, depth, compass heading) cut or filled to a
// formation level, with a stone layer on top and batters on every side. The finished surface is
//   inside the polygon:  formation + stone
//   outside:             clamp(ground, formation - d / fillBatter, formation + d / cutBatter)
// where d is the plan distance to the polygon. So a batter rises from the formation edge into higher
// ground, falls from it onto lower ground, and meets the ground at the daylight line. Batters are
// horizontal metres per metre of height; corners come out as part-cones (distance is round at a corner).
//
// Volumes are the midpoint rule over square cells, anchored exactly as measure.mjs cutFillForPlatform
// (floor of min x and y, centres at (i + 0.5) cell, the same even-odd test), so the platform share of
// the cut and fill equals cutFillForPlatform to the last digit (tests/pad.test.mjs checks it). Volumes
// are bank (in place) measure: no bulking or shrinkage is applied. import = stone + any fill shortfall;
// export = any surplus cut. Stone volume is the exact polygon area times the thickness.
//
// ASSUMED, TYPICAL VALUES (not from any survey or design for a real site):
//   stone 0.30 m: granular sub-base, as the Type 1 layer of the Specification for Highway Works (MCHW
//     Vol 1) Series 800, clause 803; thickness depends on the ground and the loads, and is a designer's call.
//   batters 1 in 2 in cut and in fill: ASSUMED typical starting slopes, no geotechnical data; the same
//     figures and wording as road.mjs, so one site has one set of slopes. (SHW Series 600 governs the fill
//     materials and compaction, not the slope.)
//   drainage fall: none unless `fall` is given (a fraction, e.g. 0.01 = 1 in 100, falling towards the compass
//     `fallHeading`); 1 in 100 to 1 in 200 is typical for plant pads (assumed). `level` is then the formation at
//     the pad centre.
//   topsoil: `topsoil` metres (0 unless given; 0.3 m typical, assumed) stripped under the platform and batters is
//     reported as volumes.topsoil. It is not counted as fill: it goes to a stockpile for reinstatement.
//   transformer pad 12 x 10 m with a 4 x 4 x 3 m unit: the station library's own figures (station.mjs,
//     source line L100 "4 x 4 x 3 m, 12 x 10 m pad"); plinth 5 x 5 x 0.3 m assumed.
//   inverter skid and battery units: 20 ft container outline, 6.058 x 2.438 x 2.591 m (ISO 668, series 1
//     freight container 1CC external size); pads, plinths, gaps and unit counts assumed.

import {
  inv, polyArea, sampleCells, volumesAt, balance, padHeight, nearPad, daylight as daylightAlong, composeGround
} from './lib/earthworks.mjs';

export { padHeight };
const EPS = 1e-9;
export const PAD_DEFAULTS = Object.freeze({ stone: 0.3, cutBatter: 2, fillBatter: 2, cell: 0.25, maxReach: 120, fall: 0, fallHeading: 0, topsoil: 0 });
const C20 = { w: 2.438, d: 6.058, h: 2.591 };
export const PAD_KINDS = Object.freeze({
  transformer: { width: 12, depth: 10, units: [{ x: 0, y: 0, w: 4, d: 4, h: 3, plinth: { w: 5, d: 5, h: 0.3 } }] },
  inverterSkid: { width: 5, depth: 9, units: [{ x: 0, y: 0, ...C20, plinth: { w: 3, d: 6.6, h: 0.3 } }] },
  batteryCompound: {
    width: 30, depth: 20,
    units: [-8, 0, 8].flatMap(x => [-4.5, 4.5].map(y => ({ x, y, ...C20, plinth: { w: 3, d: 6.6, h: 0.3 } })))
  }
});
export const PAD_COLORS = {
  outline: [0.86, 0.86, 0.82, 0.70], formation: [0.62, 0.58, 0.50, 0.50],
  batter: [0.72, 0.64, 0.48, 0.40], daylight: [0.80, 0.70, 0.50, 0.55], unit: [0.70, 0.80, 0.92, 0.65]
};

// ---------------------------------------------------------------- plan geometry

// Compass heading: 0 = the pad's +v points north, pi/2 = east. u runs across (width), v along (depth).
export function frame(centre, heading = 0) {
  const s = Math.sin(heading), c = Math.cos(heading), [cx, cy] = centre;
  return (u, v) => [cx + u * c + v * s, cy - u * s + v * c];
}

/** Anticlockwise open ring from a polygon, or from { centre, width, depth, heading }. */
export function padFootprint(spec) {
  let pts;
  if (Array.isArray(spec.polygon)) pts = spec.polygon.map(p => [Number(p[0]), Number(p[1])]);
  else {
    if (!(spec.width > 0 && spec.depth > 0) || !Array.isArray(spec.centre)) throw Error('pad: give a polygon, or a centre, width and depth');
    const at = frame(spec.centre, spec.heading || 0), w = spec.width / 2, d = spec.depth / 2;
    pts = [at(-w, -d), at(w, -d), at(w, d), at(-w, d)];
  }
  if (pts.length > 1) { const a = pts[0], b = pts[pts.length - 1]; if (Math.abs(a[0] - b[0]) < EPS && Math.abs(a[1] - b[1]) < EPS) pts.pop(); }
  if (pts.length < 3 || pts.some(p => !Number.isFinite(p[0]) || !Number.isFinite(p[1]))) throw Error('pad: polygon needs three finite points');
  let a = 0;
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; }
  if (Math.abs(a) < EPS) throw Error('pad: polygon has no area');
  return a > 0 ? pts : pts.reverse();
}

/**
 * createPad(spec, groundAt) -> pad
 * spec: polygon [[x, y], ...] or { centre, width, depth, heading }; kind (a PAD_KINDS key) fills in the
 * size and units; level (formation, m) or finishedLevel (top of stone), else the level balances cut and
 * fill; stone, cutBatter, fillBatter, cell, maxReach as PAD_DEFAULTS; units [{ x, y, w, d, h, plinth }].
 */
export function createPad(spec, groundAt) {
  if (typeof groundAt !== 'function') throw Error('pad: groundAt must be a function');
  const kind = spec.kind ? PAD_KINDS[spec.kind] : null;
  if (spec.kind && !kind) throw Error(`pad: unknown kind "${spec.kind}"`);
  const s = { ...PAD_DEFAULTS, ...(kind || {}), ...spec };
  if (!(s.stone >= 0) || !(s.cutBatter >= 0) || !(s.fillBatter >= 0) || !(s.cell > 0)) throw Error('pad: stone, batters and cell must be >= 0 (cell > 0)');
  const pts = padFootprint(s), invCut = inv(s.cutBatter), invFill = inv(s.fillBatter);
  if (!(s.fall >= 0 && s.fall < 0.2) || !(s.topsoil >= 0)) throw Error('pad: fall must be 0 to 0.2 and topsoil >= 0');
  const centre = spec.centre || pts.reduce((m, p) => [m[0] + p[0] / pts.length, m[1] + p[1] / pts.length], [0, 0]);
  const fx = Math.sin(s.fallHeading), fy = Math.cos(s.fallHeading);
  const off = (x, y) => -s.fall * ((x - centre[0]) * fx + (y - centre[1]) * fy); // formation falls towards fallHeading
  const chosen = Number.isFinite(s.level) ? s.level : Number.isFinite(s.finishedLevel) ? s.finishedLevel - s.stone : null;
  let reach = Math.max(s.cutBatter, s.fillBatter) > 0 ? Math.min(4, s.maxReach) : 0, cells, level, v;
  for (;;) {                                                      // grow the sample until the batters fit inside it
    cells = sampleCells(pts, groundAt, s.cell, reach, off);
    level = chosen ?? balance(cells, invCut, invFill);
    v = volumesAt(cells, level, invCut, invFill);
    if (!v.edge || reach >= s.maxReach) break;
    reach = Math.min(reach * 2, s.maxReach);
  }
  const cut = v.platformCut + v.batterCut, fill = v.platformFill + v.batterFill, polygonArea = polyArea(pts);
  const stone = polygonArea * s.stone;
  // Plant level: the lowest point of the finished top against the highest ground under the pad. Below it, the pad
  // sits in a hollow that collects water (a sump) unless it is drained.
  const topLow = level + s.stone + Math.min(...pts.map(p => off(p[0], p[1])));
  return {
    fall: s.fall, fallHeading: s.fallHeading, off, topsoil: s.topsoil,
    plant: { topLow, groundHigh: v.gMax, sump: topLow < v.gMax - 1e-9 },
    kind: spec.kind || null, polygon: pts, centre, heading: s.heading || 0, level, top: level + s.stone,
    stone: s.stone, cutBatter: s.cutBatter, fillBatter: s.fillBatter, balanced: chosen === null, units: s.units || [],
    reach, truncated: v.edge > 0, cell: s.cell,
    volumes: {
      cut, fill, net: cut - fill, stone, import: stone + Math.max(fill - cut, 0), export: Math.max(cut - fill, 0),
      platformCut: v.platformCut, platformFill: v.platformFill, batterCut: v.batterCut, batterFill: v.batterFill,
      area: v.area, polygonArea, footprint: v.footprint, topsoil: v.footprint * s.topsoil
    }
  };
}

/** The ground with every pad in the list pressed into it (the first pad containing the point wins). */
export const padGround = (pads, groundAt) => composeGround(groundAt, { pads: [...pads] });

// ---------------------------------------------------------------- drawing

// Distance along a ray from a boundary point to where the batter meets the ground (the daylight point).
function daylight(pad, px, py, ux, uy, groundAt) {
  const step = Math.max(pad.cell, 0.1), meets = t => {
    const x = px + ux * t, y = py + uy * t, g = groundAt(x, y);
    return !Number.isFinite(g) || Math.abs(padHeight(pad, x, y, groundAt) - g) < 1e-6;
  };
  return daylightAlong(meets, step, pad.reach + step);
}

/**
 * padLines(pad, groundAt, { spacing = 2, origin }) -> line batches for the substrate.
 * Outline at the top of stone, the formation edge, batter hachures from the formation edge to the
 * daylight line, the daylight line itself, and each unit and its plinth as a wireframe box.
 */
export function padLines(pad, groundAt, { spacing = 2, key = 'pad', version = 0 } = {}) {
  const o = [pad.centre[0], pad.centre[1], pad.top], P = (x, y, z) => [x - o[0], y - o[1], z - o[2]];
  const F = (x, y) => (pad.off ? pad.off(x, y) : 0);
  const ring = z => pad.polygon.flatMap((p, i) => { const q = pad.polygon[(i + 1) % pad.polygon.length]; return [...P(p[0], p[1], z + F(...p)), ...P(q[0], q[1], z + F(...q))]; });
  const hach = [], day = [];
  const n = pad.polygon.length;
  for (let i = 0; i < n; i++) {
    const a = pad.polygon[i], b = pad.polygon[(i + 1) % n], c = pad.polygon[(i + 2) % n];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[1] - a[1]) / len, uy = -(b[0] - a[0]) / len; // outward (anticlockwise ring)
    const rays = [];
    const m = Math.max(1, Math.ceil(len / spacing));
    for (let k = 0; k <= m; k++) rays.push([a[0] + (b[0] - a[0]) * k / m, a[1] + (b[1] - a[1]) * k / m, ux, uy]);
    // Convex corner at b: fan the rays round the part-cone to the next edge's normal.
    const l2 = Math.hypot(c[0] - b[0], c[1] - b[1]), vx = (c[1] - b[1]) / l2, vy = -(c[0] - b[0]) / l2;
    const turn = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    if (turn > 0) for (let f = 1, fans = Math.ceil(turn / (Math.PI / 12)); f < fans; f++) {
      const t = Math.atan2(uy, ux) + turn * f / fans; rays.push([b[0], b[1], Math.cos(t), Math.sin(t)]);
    }
    for (const [x, y, rx, ry] of rays) {
      const t = pad.reach > 0 ? daylight(pad, x, y, rx, ry, groundAt) : 0;
      const dx = x + rx * t, dy = y + ry * t, dz = padHeight(pad, dx, dy, groundAt);
      day.push([dx, dy, Number.isFinite(dz) ? dz : pad.level]);
      if (t > 0.05) hach.push(...P(x, y, pad.level + F(x, y)), ...P(dx, dy, day[day.length - 1][2]));
    }
  }
  const dayPos = day.flatMap((p, i) => { const q = day[(i + 1) % day.length]; return [...P(...p), ...P(...q)]; });
  const units = padUnits(pad).flatMap(bx => boxEdges(bx.corners, bx.z0, bx.z1).map(v => [v[0] - o[0], v[1] - o[1], v[2] - o[2]]).flat());
  const batch = (part, positions) => ({ key: `${key}/${part}`, version, origin: o, color: PAD_COLORS[part], positions: new Float32Array(positions) });
  return [batch('outline', ring(pad.top)), batch('formation', ring(pad.level)), batch('batter', hach),
    batch('daylight', dayPos), batch('unit', units)].filter(b => b.positions.length);
}

// Units and their plinths as boxes: plan corners in local metres, bottom and top heights.
export function padUnits(pad) {
  const at = frame(pad.centre, pad.heading), out = [];
  const corners = (x, y, w, d) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => at(x + a * w / 2, y + b * d / 2));
  for (const u of pad.units) {
    const ph = u.plinth ? u.plinth.h : 0, c = at(u.x, u.y), top = pad.top + (pad.off ? pad.off(c[0], c[1]) : 0);
    if (u.plinth) out.push({ part: 'plinth', corners: corners(u.x, u.y, u.plinth.w, u.plinth.d), z0: top, z1: top + ph });
    out.push({ part: 'unit', corners: corners(u.x, u.y, u.w, u.d), z0: top + ph, z1: top + ph + u.h });
  }
  return out;
}

function boxEdges(c, z0, z1) {
  const out = [];
  for (let i = 0; i < 4; i++) {
    const p = c[i], q = c[(i + 1) % 4];
    out.push([p[0], p[1], z0], [q[0], q[1], z0], [p[0], p[1], z1], [q[0], q[1], z1], [p[0], p[1], z0], [p[0], p[1], z1]);
  }
  return out;
}

/** Solids for walkers and the drone: the plan-aligned box round each plinth and unit. */
export function padSolids(pad) {
  return padUnits(pad).map(b => {
    const xs = b.corners.map(p => p[0]), ys = b.corners.map(p => p[1]);
    return { min: [Math.min(...xs), Math.min(...ys), b.z0], max: [Math.max(...xs), Math.max(...ys), b.z1] };
  });
}

const fmt = (x, dp = 1) => (Math.abs(x) < 0.5 * 10 ** -dp ? 0 : x).toFixed(dp).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** "Pad 120.0 m² · formation 101.20 m (balanced) · cut 35.2 m³ · fill 35.2 m³ · stone 36.0 m³ · import 36.0 m³" */
export function formatPadLine(pad) {
  const v = pad.volumes;
  return [`Pad ${fmt(v.polygonArea)} m²`, `formation ${fmt(pad.level, 2)} m${pad.balanced ? ' (balanced)' : ''}`,
    `cut ${fmt(v.cut)} m³`, `fill ${fmt(v.fill)} m³`, `stone ${fmt(v.stone)} m³`,
    `import ${fmt(v.import)} m³`, v.export > 0.05 ? `surplus ${fmt(v.export)} m³` : null,
    pad.topsoil > 0 ? `topsoil strip ${fmt(v.topsoil)} m³` : 'bank volumes, no topsoil strip',
    pad.plant.sump ? 'top below the highest ground under the pad' : null,
    pad.truncated ? 'batters reach past the sampled area' : null].filter(Boolean).join(' · ');
}

// ---------------------------------------------------------------- layer

/**
 * createPadLayer({ pads }) or, from the manifest, config.pads: [{ kind, e, n, heading, ... }] in national-grid
 * metres (or x, y local, or polygon_en [[e, n], ...]). List it BEFORE terrain: its heightAt returns the
 * finished pad surface near a pad and NaN elsewhere, so the ground everyone stands on includes the pads.
 */
export function createPadLayer(opts = {}) {
  let api = null, ground = null, busy = false, built = { version: null, pads: [], batches: [] };
  const specs = () => {
    const list = opts.pads || api?.config?.pads || [], o = api?.origin?.() || { e: 0, n: 0 };
    return list.map(p => ({
      ...p, centre: p.centre || (Number.isFinite(p.e) ? [p.e - o.e, p.n - o.n] : Number.isFinite(p.x) ? [p.x, p.y] : undefined),
      polygon: p.polygon || (p.polygon_en ? p.polygon_en.map(([e, n]) => [e - o.e, n - o.n]) : undefined)
    }));
  };
  const layer = {
    id: 'pad', status: 'waiting for ground',
    init(a) { api = a; layer.status = 'ready'; },
    heightAt(x, y) {
      if (busy || !ground) return NaN;
      busy = true;                                             // the substrate's ground asks us again: say NaN
      try { for (const p of built.pads) if (nearPad(p, x, y)) return padHeight(p, x, y, ground); return NaN; } finally { busy = false; }
    },
    lines(ctx) {
      if (typeof ctx.heightAt !== 'function') return [];
      const o = api?.origin?.(), version = `${o ? `${o.e},${o.n},${o.id}` : ''}@${ctx.groundVersion ?? 0}`;
      if (built.version === version) return built.batches;
      ground = null; busy = true;                              // build on the bare ground, not on the old pads
      try {
        const raw = (x, y) => ctx.heightAt(x, y);
        const pads = specs().map(s => createPad(s, raw));
        const batches = pads.flatMap((p, i) => padLines(p, raw, { key: `pad/${i}`, version }));
        built = { version, pads, batches, solids: pads.flatMap(padSolids) };
        layer.status = pads.map(formatPadLine).join(' | ') || 'no pads';
        ground = raw;
      } catch (e) { layer.status = 'pads not built: ' + e.message; built = { version, pads: [], batches: [], solids: [] }; }
      finally { busy = false; }
      return built.batches;
    },
    solids: () => built.solids || [],
    debug: () => built
  };
  return layer;
}

export default createPadLayer();
