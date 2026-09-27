// design-import.mjs: turns the GIS, SLD & Financial Sandbox GeoJSON export
// (WGS84 lon/lat) into local-metre geometry for the world viewer.
// Pure: no imports, no DOM. The caller supplies toLocal(lon, lat) -> [x, y]
// (x east, y north, metres). Heights are relative to ground; the caller drapes.

export const MAX_TABLES = 20000;

// Equipment boxes: length along the array axis, width across, height (m).
const EQUIPMENT = {
  string_substation: { len: 6.1, wid: 2.5, h: 3.0, kind: 'skid' },
  central_inverter: { len: 12.2, wid: 2.5, h: 3.0, kind: 'inverter' },
  private_sub: { len: 40, wid: 30, h: 4.0, kind: 'transformer_compound' }
};
const BESS_UNIT = { len: 12.2, wid: 2.5, h: 2.9, gapAlong: 1.5, aisle: 3.5 };
const TABLE_TOP = 2.6, TABLE_UNDER = 0.8, TABLE_GAP = 0.5, EDGE_MARGIN = 2, KEEP_OUT = 4;
const POLY_TYPES = new Set(['array_boundary', 'skid_footprint', 'central_footprint', 'bess_footprint']);
const POINT_TYPES = new Set(['string_substation', 'central_inverter', 'bess_compound', 'poi', 'private_sub', 'export_cable_pin']);
const LINE_TYPES = new Set(['export_cable', '33kv_radial', '33kv_projection_only']);

const num = (v, d) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : d);
const deg = r => r * Math.PI / 180;

// Row frame: bearing b (deg clockwise from north). r = along rows, n = across.
function frame(bearingDeg) {
  const b = deg(bearingDeg);
  const r = [Math.sin(b), Math.cos(b)];
  const n = [Math.cos(b), -Math.sin(b)];
  return {
    r, n, bearingDeg,
    toUV: p => [p[0] * r[0] + p[1] * r[1], p[0] * n[0] + p[1] * n[1]],
    toXY: (u, v) => [u * r[0] + v * n[0], u * r[1] + v * n[1]],
    yaw: Math.atan2(r[1], r[0])
  };
}

// Oriented box -> solid with AABB min/max plus the true footprint quad.
function box(f, cu, cv, len, wid, z0, z1, extra) {
  const hl = len / 2, hw = wid / 2;
  const quad = [[cu - hl, cv - hw], [cu + hl, cv - hw], [cu + hl, cv + hw], [cu - hl, cv + hw]].map(([u, v]) => f.toXY(u, v));
  const xs = quad.map(q => q[0]), ys = quad.map(q => q[1]);
  return {
    min: [Math.min(...xs), Math.min(...ys), z0], max: [Math.max(...xs), Math.max(...ys), z1],
    center: f.toXY(cu, cv), size: [len, wid, z1 - z0], yaw: f.yaw, quad, ...extra
  };
}
const closed = quad => [...quad, quad[0]];

// Even-odd crossings of all rings with the line v = const, as sorted intervals.
function intervalsAt(ringsUV, v) {
  const xs = [];
  for (const ring of ringsUV) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [u1, v1] = ring[j], [u2, v2] = ring[i];
      if ((v1 <= v && v < v2) || (v2 <= v && v < v1)) xs.push(u1 + (v - v1) * (u2 - u1) / (v2 - v1));
    }
  }
  xs.sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i + 1 < xs.length; i += 2) out.push([xs[i], xs[i + 1]]);
  return out;
}
function intersect(a, b) {
  const out = [];
  for (const [a0, a1] of a) for (const [b0, b1] of b) {
    const lo = Math.max(a0, b0), hi = Math.min(a1, b1);
    if (hi > lo) out.push([lo, hi]);
  }
  return out;
}

// Pack oriented rectangles (len along rows, depth across, pitch between rows)
// inside the rings. onSlot(cu, cv) returns false to stop placing (count only).
function pack(ringsLocal, f, len, depth, pitch, gap, margin, onSlot) {
  const rings = ringsLocal.map(r => r.map(f.toUV));
  let vMin = Infinity, vMax = -Infinity;
  for (const r of rings) for (const p of r) { vMin = Math.min(vMin, p[1]); vMax = Math.max(vMax, p[1]); }
  let slots = 0, rows = 0;
  for (let v0 = vMin + margin; v0 + depth <= vMax - margin + 1e-9; v0 += pitch) {
    const v1 = v0 + depth, vm = (v0 + v1) / 2;
    let iv = intersect(intersect(intervalsAt(rings, v0 + 1e-6), intervalsAt(rings, v1 - 1e-6)), intervalsAt(rings, vm));
    iv = intersect(iv, intersect(intervalsAt(rings, v0 - margin), intervalsAt(rings, v1 + margin)));
    let rowUsed = false;
    for (const [lo, hi] of iv) {
      const a = lo + margin, b = hi - margin;
      const n = Math.floor((b - a + gap) / (len + gap));
      if (n < 1) continue;
      const start = a + ((b - a) - (n * len + (n - 1) * gap)) / 2;
      for (let k = 0; k < n; k++) {
        if (onSlot(start + k * (len + gap) + len / 2, vm)) { slots++; rowUsed = true; }
      }
    }
    if (rowUsed) rows++;
  }
  return { slots, rows };
}

function mountingFor(gcr) {
  if (Math.abs(gcr - 0.75) < 0.05 || gcr > 0.7) return 'east_west_dome';
  if (gcr <= 0.4) return 'tracker';
  return 'fixed_tilt';
}

function ringsOf(geom, toLocal) {
  const conv = ring => {
    const pts = ring.map(c => toLocal(c[0], c[1]));
    if (pts.length > 1) {
      const a = pts[0], b = pts[pts.length - 1];
      if (a[0] === b[0] && a[1] === b[1]) pts.pop();
    }
    return pts;
  };
  if (geom.type === 'Polygon') return [geom.coordinates.map(conv)];
  if (geom.type === 'MultiPolygon') return geom.coordinates.map(p => p.map(conv));
  return [];
}
function polyLength(pts) {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return s;
}

export function importDesign(geojson, toLocal) {
  if (!geojson || geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) throw new Error('importDesign: expected a GeoJSON FeatureCollection');
  if (typeof toLocal !== 'function') throw new Error('importDesign: toLocal(lon, lat) is required');
  const feats = geojson.features.filter(f => f && f.geometry && f.properties && typeof f.properties.type === 'string');
  const skipped = geojson.features.length - feats.length;
  const boundaries = feats.filter(f => f.properties.type === 'array_boundary');
  const bp = boundaries[0]?.properties || {};

  // Array axis: sandbox writes array_rotation_deg on private_sub / export_cable.
  const axisFeat = feats.find(f => Number.isFinite(Number(f.properties.array_rotation_deg)) && f.properties.array_rotation_deg !== null);
  const axisDeg = num(bp.array_rotation_deg, axisFeat ? Number(axisFeat.properties.array_rotation_deg) : 0);
  const gcr = Math.min(0.95, Math.max(0.1, num(bp.tech_ground_coverage_ratio, 0.45) || 0.45));
  const mounting = bp.tech_mounting || mountingFor(gcr);
  const modL = num(bp.tech_module_length_m, 2.38) || 2.38;
  const modW = num(bp.tech_module_width_m, 1.30) || 1.30;
  const modWp = num(bp.tech_module_rating_wp, 0);
  const perString = Math.max(1, Math.round(num(bp.tech_modules_per_string, 28)));
  // Rows east-west (bearing axis+90) for fixed tilt; trackers and east-west
  // domes run rows north-south along the axis. Explicit override wins.
  const rowBearing = num(bp.row_azimuth_deg, num(bp.tech_row_azimuth_deg,
    mounting === 'fixed_tilt' ? axisDeg + 90 : axisDeg));
  const fRow = frame(rowBearing), fAxis = frame(axisDeg + 90); // equipment long side across the axis

  const portrait = mounting === 'tracker' ? 1 : 2;
  const slant = portrait * modL;
  const rise = TABLE_TOP - TABLE_UNDER;
  const depth = mounting === 'tracker' ? slant : Math.sqrt(Math.max(slant * slant - rise * rise, slant * slant * 0.25));
  const pitch = Math.max(depth + 0.5, slant / gcr);
  const tableLen = Math.min(60, Math.max(5, perString * (modW + 0.02)));
  const modsPerTable = portrait * Math.max(1, Math.floor(tableLen / (modW + 0.02)));

  const outlines = [], points = [], cables = [], solids = [];
  const unknownTypes = {}, counts = {};
  const blocks = [], bessAreas = [], keepOut = [];

  for (const f of feats) {
    const t = f.properties.type, g = f.geometry;
    counts[t] = (counts[t] || 0) + 1;
    if (POLY_TYPES.has(t) && (g.type === 'Polygon' || g.type === 'MultiPolygon')) {
      for (const rings of ringsOf(g, toLocal)) {
        rings.forEach((ring, i) => outlines.push({ type: t === 'array_boundary' ? t : (t === 'bess_footprint' ? t : 'block'), sourceType: t, hole: i > 0, points: closed(ring) }));
        if (t === 'skid_footprint' || t === 'central_footprint') blocks.push(rings);
        if (t === 'bess_footprint') bessAreas.push(rings);
      }
    } else if (POINT_TYPES.has(t) && g.type === 'Point') {
      const [x, y] = toLocal(g.coordinates[0], g.coordinates[1]);
      const p = { type: t, x, y, props: { ...f.properties } };
      points.push(p);
      const eq = EQUIPMENT[t];
      if (eq) {
        const [cu, cv] = fAxis.toUV([x, y]);
        const s = box(fAxis, cu, cv, eq.len, eq.wid, 0, eq.h, { type: eq.kind, sourceType: t });
        solids.push(s);
        outlines.push({ type: eq.kind, sourceType: t, points: closed(s.quad) });
        keepOut.push({ x, y, r: Math.hypot(eq.len, eq.wid) / 2 + KEEP_OUT });
      }
    } else if (LINE_TYPES.has(t) && (g.type === 'LineString' || g.type === 'MultiLineString')) {
      const parts = g.type === 'LineString' ? [g.coordinates] : g.coordinates;
      for (const part of parts) {
        const pts = part.map(c => toLocal(c[0], c[1]));
        cables.push({ type: t, role: f.properties.role || (t === 'export_cable' ? 'export' : 'radial'), points: pts, lengthM: polyLength(pts), props: { ...f.properties } });
      }
    } else {
      unknownTypes[t + ':' + g.type] = (unknownTypes[t + ':' + g.type] || 0) + 1;
    }
  }

  // BESS containers packed into each bess_footprint (bounded by area).
  let bessUnits = 0;
  for (const rings of bessAreas) {
    pack(rings, fAxis, BESS_UNIT.len, BESS_UNIT.wid, BESS_UNIT.wid + BESS_UNIT.aisle, BESS_UNIT.gapAlong, 3, (cu, cv) => {
      if (bessUnits >= 2000) return false;
      solids.push(box(fAxis, cu, cv, BESS_UNIT.len, BESS_UNIT.wid, 0, BESS_UNIT.h, { type: 'bess_container', sourceType: 'bess_footprint' }));
      bessUnits++;
      return true;
    });
  }

  // Solar tables: inside block footprints when present (they tile the net
  // array area), otherwise inside each array_boundary.
  const regions = blocks.length ? blocks : boundaries.flatMap(b => ringsOf(b.geometry, toLocal));
  const tables = { solids: [], outlines: [], count: 0, requested: 0, capped: false, rows: 0, cap: MAX_TABLES,
    region: blocks.length ? 'block_footprints' : 'array_boundary', mounting, rowBearingDeg: ((rowBearing % 360) + 360) % 360,
    tableLengthM: tableLen, tableDepthM: depth, pitchM: pitch, modulesPerTable: modsPerTable, heightTop: TABLE_TOP, heightUnder: TABLE_UNDER };
  const blocked = (cu, cv) => {
    const [x, y] = fRow.toXY(cu, cv);
    const half = Math.hypot(tableLen, depth) / 2;
    return keepOut.some(k => Math.hypot(k.x - x, k.y - y) < k.r + half);
  };
  for (const rings of regions) {
    const res = pack(rings, fRow, tableLen, depth, pitch, TABLE_GAP, blocks.length ? 0.5 : EDGE_MARGIN, (cu, cv) => {
      if (blocked(cu, cv)) return false;
      tables.requested++;
      if (tables.count >= MAX_TABLES) { tables.capped = true; return true; }
      const s = box(fRow, cu, cv, tableLen, depth, TABLE_UNDER, TABLE_TOP, { type: 'solar_table' });
      tables.solids.push(s);
      tables.outlines.push({ type: 'solar_table', points: closed(s.quad) });
      tables.count++;
      return true;
    });
    tables.rows += res.rows;
  }

  const cableLen = {};
  for (const c of cables) cableLen[c.role] = (cableLen[c.role] || 0) + c.lengthM;
  const modulesPlaced = tables.count * modsPerTable;
  const stats = {
    features: geojson.features.length, skippedFeatures: skipped, counts, unknownTypes,
    axisDeg, gcr, mounting, module: { lengthM: modL, widthM: modW, wp: modWp },
    moduleCountDeclared: num(bp.tech_module_count, null), modulesPlaced,
    dcMWpDeclared: num(bp.tech_dc_capacity_mwp, null), acMWDeclared: num(bp.tech_ac_capacity_mwac, null),
    dcMWpPlaced: modWp ? modulesPlaced * modWp / 1e6 : null,
    bessMWh: num(bp.fin_bess_mwh, num(bp.fin_string_bess_mwh, points.find(p => p.type === 'bess_compound')?.props.mwh ?? null)),
    bessContainers: bessUnits, tables: tables.count, tablesRequested: tables.requested, tablesCapped: tables.capped,
    cableLengthM: cableLen, equipmentSolids: solids.length
  };
  return { outlines, points, cables, solids, tables, stats };
}
