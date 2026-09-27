// trench-section.mjs: a trench drawn as a true cross-section, and cables drawn at their real outside diameter.
//
// crossSection(section, eff, opts) works in the plane of the section: u across the trench (metres, left of travel
// positive), z up from the ground at the centreline (negative is below ground). It returns the dug outline (walls
// and floor, battered or supported), the layers (formation over-dig, bedding and surround, backfill), every duct or
// cable as a circle in its formation (trefoil or flat) and spacing, each circuit apart, and the markers (tape,
// tiles) at their depths.
//
// sectionLines(...) lays that section along a real trench: full slices near the viewer (walking up to an open
// trench, or bending down to look in) with the layer, tape and tile lines joined between slices; nothing extra
// further away, where the trench's own wall outline is the clean simplified view.
// tubeLines(...) draws a core as a tube of its outside diameter: four lines along it, rings near the viewer.
// Pure: no imports, no DOM.

const SQ3 = Math.sqrt(3);

// Formation and duct use, from the section's words and numbers.
export function formationOf(section) {
  const f = String(section.formation || '').toLowerCase();
  const ducted = Number(section.duct_od_mm) > 0 || /duct/.test(f);
  const kind = /trefoil/.test(f) ? 'trefoil' : /side by side|flat/.test(f) && !/trefoil/.test(f) ? 'flat' : 'trefoil';
  const perCircuit = /ducts side by side|duct groups/.test(f) ? 'group' : 'three';
  return { kind, ducted, perCircuit, circuits: Math.max(1, Number(section.circuits) || 1) };
}

/**
 * crossSection(section, eff, { cableOdMm }) -> { outline, walls, layers, items, markers, supports, width, depth, topHalf }
 * eff: applyGround(...) output (width, depth, benchSlope, cableDepth, overdig, support).
 */
export function crossSection(section, eff, { cableOdMm = null, tapeAboveM = 0.25 } = {}) {
  const w = eff.width, depth = eff.depth, slope = eff.benchSlope || 0, fm = formationOf(section);
  const halfAt = z => w / 2 + slope * (z + depth);                     // wall half-width at height z
  const topHalf = halfAt(0);
  const outline = [[-topHalf, 0], [-w / 2, -depth], [w / 2, -depth], [topHalf, 0]];
  const ductD = fm.ducted && Number(section.duct_od_mm) > 0 ? section.duct_od_mm / 1000 : 0;
  // A cable in a duct defaults to a little over half the duct bore; a direct-laid one to the section's pitch.
  const cableOd = cableOdMm ? cableOdMm / 1000 : ductD ? 0.55 * ductD : (Number(section.phase_spacing_mm) || 45) / 1000;
  const D = ductD || cableOd;                                           // the circle that sets the formation
  const bed = ((section.bedding && section.bedding.thickness_mm) || 75) / 1000;
  const zBed = -eff.cableDepth + bed;                                   // underside of the lowest duct or cable
  const pitch = Math.max(D, (Number(section.phase_spacing_mm) || 0) / 1000);
  const circuitGap = (Number(section.circuit_spacing_mm) || 0) / 1000;
  const items = [];
  for (let c = 0; c < fm.circuits; c++) {
    const uc = fm.circuits === 1 ? 0 : (c - (fm.circuits - 1) / 2) * Math.max(circuitGap, 3 * pitch + 0.1);
    let at;
    if (fm.perCircuit === 'group') at = [[uc, zBed + D / 2]];
    else if (fm.kind === 'trefoil') at = [[uc - D / 2, zBed + D / 2], [uc + D / 2, zBed + D / 2], [uc, zBed + D / 2 + SQ3 * D / 2]];
    else at = [-1, 0, 1].map(k => [uc + k * pitch, zBed + D / 2]);
    at.forEach(([u, z], k) => {
      items.push({ kind: fm.ducted ? 'duct' : 'cable', circuit: c + 1, phase: fm.perCircuit === 'group' ? null : k + 1, u, z, r: D / 2 });
      if (fm.ducted && fm.perCircuit !== 'group') items.push({ kind: 'cable', circuit: c + 1, phase: k + 1, u, z: z - D / 2 + cableOd / 2, r: cableOd / 2 });
    });
  }
  const topItems = Math.max(...items.map(i => i.z + i.r)), lo = Math.min(...items.map(i => i.u - i.r)), hi = Math.max(...items.map(i => i.u + i.r));
  const zSurround = Math.min(topItems + bed, -0.1);
  const layers = [];
  if (eff.overdig > 0) layers.push({ name: 'formation fill', z0: -depth, z1: -eff.cableDepth });
  layers.push({ name: 'bedding and surround', z0: -eff.cableDepth, z1: zSurround }, { name: 'backfill', z0: zSurround, z1: 0 });
  const markers = [];
  const m = section.marker || {}, mz = -(Number(m.depth_m) || 0);
  // Tiles rest on the surround: at the section's marker depth, never down inside the surround.
  if (/tile|board/i.test(m.type || '')) markers.push({ kind: 'tile', z: Math.min(Math.max(mz, zSurround), -0.2), u0: lo - 0.05, u1: hi + 0.05 });
  const zt = Math.min(topItems + tapeAboveM, -0.15);
  markers.push({ kind: 'tape', z: zt, u0: Math.max(-halfAt(zt) + 0.02, lo - 0.05), u1: Math.min(halfAt(zt) - 0.02, hi + 0.05) });
  const supports = /box|sheet|support/.test(eff.support || '') && slope === 0
    ? [-1, 1].map(side => ({ side, u: side * (w / 2 - 0.04), z0: -depth, z1: 0.3 })) : [];
  return { outline, layers, items, markers, supports, width: w, depth, topHalf, halfAt, formation: fm };
}

/**
 * sectionLines({ trench, groundAt, cs, eye, near = 25, spacing = 2, ringSides = 16 }) -> Float32Array of line pairs
 * trench: createTrench(...) result in local metres; cs: crossSection(...). Only slices within `near` metres of
 * the eye are drawn, so far away the trench is just its wall outline.
 */
export function sectionLines({ trench, groundAt, cs, eye, near = 25, spacing = 2, ringSides = 16 }) {
  const v = [];
  const push = (a, b) => v.push(a[0], a[1], a[2], b[0], b[1], b[2]);
  const L = trench.length2d, count = Math.max(1, Math.floor(L / spacing));
  const slices = [];
  for (let k = 0; k <= count; k++) {
    const s = Math.min(L, k * spacing);
    const [cx, cy] = trench.pointAt(s);
    if (Math.hypot(cx - eye[0], cy - eye[1]) > near) { slices.push(null); continue; }
    const a = trench.pointAt(Math.max(0, s - 0.1)), b = trench.pointAt(Math.min(L, s + 0.1));
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / len, ny = (b[0] - a[0]) / len;
    const g0 = groundAt(cx, cy);
    slices.push(([u, z]) => [cx + nx * u, cy + ny * u, g0 + z]);
  }
  const rails = [];                                   // points repeated on every slice, joined along the trench
  const rail = (key, uz) => rails.push([key, uz]);
  for (const layer of cs.layers) if (layer.z1 < 0) { rail(layer.name + 'L', [-cs.halfAt(layer.z1), layer.z1]); rail(layer.name + 'R', [cs.halfAt(layer.z1), layer.z1]); }
  for (const m of cs.markers) { rail(m.kind + 'L', [m.u0, m.z]); rail(m.kind + 'R', [m.u1, m.z]); }
  slices.forEach((P, k) => {
    if (!P) return;
    for (let i = 1; i < cs.outline.length; i++) push(P(cs.outline[i - 1]), P(cs.outline[i]));
    for (const layer of cs.layers) if (layer.z1 < 0) push(P([-cs.halfAt(layer.z1), layer.z1]), P([cs.halfAt(layer.z1), layer.z1]));
    for (const m of cs.markers) {
      push(P([m.u0, m.z]), P([m.u1, m.z]));
      if (m.kind === 'tile') { push(P([m.u0, m.z + 0.05]), P([m.u1, m.z + 0.05])); push(P([m.u0, m.z]), P([m.u0, m.z + 0.05])); push(P([m.u1, m.z]), P([m.u1, m.z + 0.05])); }
    }
    for (const it of cs.items) {
      const n = it.kind === 'duct' ? ringSides : Math.max(8, ringSides / 2);
      for (let j = 0; j < n; j++) {
        const t0 = 2 * Math.PI * j / n, t1 = 2 * Math.PI * (j + 1) / n;
        push(P([it.u + it.r * Math.cos(t0), it.z + it.r * Math.sin(t0)]), P([it.u + it.r * Math.cos(t1), it.z + it.r * Math.sin(t1)]));
      }
    }
    for (const sp of cs.supports) push(P([sp.u, sp.z0]), P([sp.u, sp.z1]));
    const Q = slices[k + 1];
    if (Q) for (const [, uz] of rails) push(P(uz), Q(uz));
  });
  return new Float32Array(v);
}

/**
 * tubeLines(polyline, od, { eye, near = 20, every = 1, sides = 8 }) -> Float32Array
 * A core drawn at its outside diameter: four lines along it (left, right, top, bottom of the sheath) and, near the
 * eye, a ring every `every` metres. The polyline is the core centre, already bent at its radius by cable-route.mjs.
 */
export function tubeLines(polyline, od, { eye = null, near = 20, every = 1, sides = 8 } = {}) {
  const r = od / 2, v = [], n = polyline.length;
  if (n < 2) return new Float32Array(0);
  const frame = i => {
    const a = polyline[Math.max(0, i - 1)], b = polyline[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    return [-dy / l, dx / l];
  };
  const off = (p, [nx, ny], du, dz) => [p[0] + nx * du, p[1] + ny * du, p[2] + dz];
  const sides4 = [[r, 0], [-r, 0], [0, r], [0, -r]];
  let last = -Infinity, s = 0;
  for (let i = 0; i < n; i++) {
    const p = polyline[i], f = frame(i);
    if (i) {
      const q = polyline[i - 1], g = frame(i - 1);
      s += Math.hypot(p[0] - q[0], p[1] - q[1]);
      for (const [du, dz] of sides4) { const a = off(q, g, du, dz), b = off(p, f, du, dz); v.push(...a, ...b); }
    }
    if (eye && s - last >= every && Math.hypot(p[0] - eye[0], p[1] - eye[1], p[2] - eye[2]) <= near) {
      last = s;
      for (let j = 0; j < sides; j++) {
        const t0 = 2 * Math.PI * j / sides, t1 = 2 * Math.PI * (j + 1) / sides;
        v.push(...off(p, f, r * Math.cos(t0), r * Math.sin(t0)), ...off(p, f, r * Math.cos(t1), r * Math.sin(t1)));
      }
    }
  }
  return new Float32Array(v);
}
