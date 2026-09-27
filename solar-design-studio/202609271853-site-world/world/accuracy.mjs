// accuracy.mjs: the world's accuracy constants and the small pure maths that uses them. No imports, no DOM.
// From the accuracy study (quick wins 1-5): one earth radius; distance to a line, not to a vertex; earth curvature and
// refraction for far ground; one voltage style contract shared with GridAtlas; display precision no finer than the
// stated accuracy of the source. Layers that run from a blob URL (layers/grid.mjs, layers/national.mjs) cannot import
// this file; they carry copies of the style table and tests/accuracy.test.mjs holds the copies equal to this one.

// ---- 1. One earth radius -----------------------------------------------------------------------------------------
// The WGS84 semi-major axis (NIMA TR8350.2), which is the estate's default sphere R_ATLAS (ventus-grid-engine
// engine/geo-core.js; grid-distance-maths docs/EARTH-MODEL.md). Every great-circle or chord distance in the world and
// its tools uses this one value, so a distance here matches GridAtlas exactly. Do not "correct" it to the IUGG mean
// radius 6,371,008.8 m: at GB latitudes that doubles the error (about -2,194 ppm against about -1,078 ppm).
export const EARTH_RADIUS_M = 6378137;
export const EARTH_RADIUS_NAME = 'R_ATLAS, the WGS84 semi-major axis (6,378,137 m)';
const RAD = Math.PI / 180;

/** Great-circle distance in metres between two lon/lat points (degrees, GeoJSON order) on the named sphere. */
export function haversineM(lon1, lat1, lon2, lat2, R = EARTH_RADIUS_M) {
  const p1 = lat1 * RAD, p2 = lat2 * RAD, dp = p2 - p1, dl = (lon2 - lon1) * RAD;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(Math.min(1, Math.max(0, h))), Math.sqrt(Math.min(1, Math.max(0, 1 - h))));
}

/** Arc length in metres for a straight chord between two unit vectors (the GPU form of the same distance). */
export const chordToArcM = (chord, R = EARTH_RADIUS_M) => 2 * R * Math.asin(Math.min(1, Math.max(0, chord / 2)));

// ---- 2. Distance to a line, not to a vertex ------------------------------------------------------------------------
// Plan (horizontal) metres on the national grid. Measuring to the nearest tower overstates the distance to the line by
// about 130 m on average (up to 560 m) in the Atlas study; the nearest point on a span is the true answer.

/** The nearest point on segment a-b to p: { d, k (0..1 along the segment), x, y }. A zero-length segment is its end. */
export function pointToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
  const k = L2 > 0 ? Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / L2)) : 0;
  const x = ax + k * dx, y = ay + k * dy;
  return { d: Math.hypot(px - x, py - y), k, x, y };
}

/** Nearest point of a polyline [[e, n], ...] to [e, n]: { d, seg, foot: [e, n], vertexD }, or null with no point. */
export function nearestOnPolyline([pe, pn], pts) {
  const P = (pts || []).filter(q => Array.isArray(q) && Number.isFinite(q[0]) && Number.isFinite(q[1]));
  if (!P.length || !Number.isFinite(pe) || !Number.isFinite(pn)) return null;
  let best = null, vertexD = Infinity;
  for (const q of P) vertexD = Math.min(vertexD, Math.hypot(q[0] - pe, q[1] - pn));
  const segs = P.length > 1 ? P.length - 1 : 1;
  for (let i = 0; i < segs; i++) {
    const a = P[i], b = P[Math.min(i + 1, P.length - 1)], s = pointToSegment(pe, pn, a[0], a[1], b[0], b[1]);
    if (!best || s.d < best.d) best = { d: s.d, seg: i, foot: [s.x, s.y] };
  }
  return { ...best, vertexD };
}

// The line a tower belongs to: its `line` field, else the "L<i>" prefix of the grid layer's tower ids ("L3T12").
const lineOf = t => (t.line != null ? String(t.line) : (/^(L\d+)T\d+$/.exec(String(t.id || '')) || [])[1] || null);

/**
 * The nearest overhead line to at = { e, n } from towers [{ kind?, e, n, kv?, id | line }] in order along each line:
 * { d, vertexD, foot: [e, n], kv, label, line } measured to the nearest span, or null when no tower is known.
 * Towers with no line id stand alone (distance to the tower itself).
 */
export function nearestLine(at, towers) {
  const lines = new Map();
  (towers || []).forEach((t, i) => {
    if (!t || (t.kind && t.kind !== 'tower') || !Number.isFinite(t.e) || !Number.isFinite(t.n)) return;
    const key = lineOf(t) ?? `solo${i}`;
    if (!lines.has(key)) lines.set(key, { kv: t.kv ?? null, pts: [] });
    lines.get(key).pts.push([t.e, t.n]);
  });
  let best = null;
  for (const [line, l] of lines) {
    const r = nearestOnPolyline([at?.e, at?.n], l.pts);
    if (r && (!best || r.d < best.d)) best = { d: r.d, vertexD: r.vertexD, foot: r.foot, kv: l.kv, line };
  }
  return best && { ...best, label: Number(best.kv) > 0 ? `${best.kv} kV line` : 'overhead line' };
}

// ---- 3. Earth curvature and refraction for far ground ----------------------------------------------------------------
// Seen from the eye, ground at horizontal distance d sits lower than on a flat earth by (1 - k) d^2 / 2R. k = 0.13 is the
// conventional coefficient of terrestrial refraction used in geodetic levelling and viewshed tools: a convention, not a
// measurement (the real value moves with the weather, and can go negative over warm ground). 6.8 cm at 1 km, 61 cm at 3 km.
export const REFRACTION_K = 0.13;
export const REFRACTION_NOTE = 'k = 0.13, the conventional coefficient of refraction (a convention; weather changes it)';
/** Drop per square metre of horizontal distance: the renderer's uniform. */
export const CURVATURE_PER_M2 = (1 - REFRACTION_K) / (2 * EARTH_RADIUS_M);
/** Apparent drop (m) of ground d metres away, with refraction k. */
export const curvatureDrop = (d, k = REFRACTION_K, R = EARTH_RADIUS_M) => ((1 - k) * d * d) / (2 * R);
/** Distance (m) to the sea-level horizon from an eye h metres up, with refraction k; NaN for a negative height. */
export const horizonDistanceM = (h, k = REFRACTION_K, R = EARTH_RADIUS_M) => (h >= 0 ? Math.sqrt((2 * R * h) / (1 - k)) : NaN);

// ---- 4. Voltage style contract ---------------------------------------------------------------------------------------
// Classes and colours follow GridAtlas (data-gridatlas@8bf88da contracts/202608291015-v8-layer-config.json, group
// "Topology": 400, 275, 220, 132 and 66 kV lines). 220 kV and 66 kV keep their own classes. 33 kV is not an Atlas line
// class: it takes the grids pack's cyan (#00b8d4), so the world and the pack draw one palette. Alpha is the world's quiet scheme on its dark background.
// Tower shapes, clearances and compound sizes still come in four structure classes (400/275/132/33); that collapse is a
// rule of the structure tables (220 draws a 275 kV tower, 66 a 132 kV one), never of the colour or the label.
export const VOLTAGE_STYLE = Object.freeze([
  { cls: '400kV', minKv: 345, hex: '#0054ff', alpha: 0.62, source: 'GridAtlas' },
  { cls: '275kV', minKv: 250, hex: '#ff0000', alpha: 0.55, source: 'GridAtlas' },
  { cls: '220kV', minKv: 200, hex: '#ff9900', alpha: 0.52, source: 'GridAtlas' },
  { cls: '132kV', minKv: 100, hex: '#00cc00', alpha: 0.5, source: 'GridAtlas' },
  { cls: '66kV', minKv: 50, hex: '#b200ff', alpha: 0.48, source: 'GridAtlas' },
  { cls: '33kV', minKv: 0, hex: '#00b8d4', alpha: 0.45, source: 'grids pack cyan (no Atlas line class)' }
]);
/** The style class of a nominal kV; unknown or non-positive voltages are the lowest class. */
export function styleClass(kv) {
  const v = Number(kv);
  if (!(v > 0)) return '33kV';
  return VOLTAGE_STYLE.find(s => v >= s.minKv).cls;
}
export const hexToRgb = h => [1, 3, 5].map(i => Math.round((parseInt(h.slice(i, i + 2), 16) / 255) * 1000) / 1000);
/** { cls: [r, g, b, a] } for the renderer. */
export const STYLE_COLORS = Object.freeze(Object.fromEntries(VOLTAGE_STYLE.map(s => [s.cls, [...hexToRgb(s.hex), s.alpha]])));

// ---- 5. Precision to the accuracy of the source ------------------------------------------------------------------------
// A number is shown no finer than the stated accuracy of where it came from. Accuracies are as the providers state them.
export const SOURCE_ACCURACY = Object.freeze({
  terrain: { m: 0.15, basis: 'Environment Agency LIDAR DTM 1 m: stated vertical accuracy about 15 cm RMSE' },
  'terrain-live': { m: 0.15, basis: 'Environment Agency LIDAR DTM 1 m (live service): stated vertical accuracy about 15 cm RMSE' },
  coarse: { m: 4, basis: 'Copernicus DEM GLO-30: stated absolute vertical accuracy under 4 m (90 % linear error)' },
  'bng-helmert': { m: 3.5, basis: 'national grid by the 7-parameter transform without the shift grid: about 3.5 m' },
  ostn15: { m: 0.1, basis: 'national grid by the OSTN15 shift grid: about 0.1 m' }
});

/** Decimal places for a stated accuracy (m): the digit of the accuracy's own order. 0.15 -> 1, 3.5 -> 0, 30 -> -1. */
export function decimalsFor(accuracyM) {
  const a = Number(accuracyM);
  if (!(a > 0) || !Number.isFinite(a)) return null; // no stated accuracy: no digits can be justified
  return Math.ceil(-Math.log10(a) - 1e-9) + 0; // + 0: no -0
}

/** value rounded to the accuracy, as text: "12.3", "12", "1,230"; "n/a" for a non-number or no stated accuracy. */
export function formatAtAccuracy(value, accuracyM) {
  const dp = decimalsFor(accuracyM), v = Number(value);
  if (dp === null || value === null || value === '' || !Number.isFinite(v)) return 'n/a';
  if (dp >= 0) { const s = v.toFixed(dp); return /^-0(\.0*)?$/.test(s) ? s.slice(1) : s; }
  const q = 10 ** -dp, r = Math.round(v / q) * q;
  return (r === 0 ? 0 : r).toLocaleString('en-GB');
}

/** The ground height and eye height words for the Controls detail line, rounded to the ground source's accuracy. */
export function groundWords(source, groundM, eyeM, known) {
  const acc = known ? SOURCE_ACCURACY[source]?.m : null;
  const eye = acc ? formatAtAccuracy(eyeM, acc) : formatAtAccuracy(eyeM, 1);
  const horizon = horizonDistanceM(eyeM); // over ground as level as the spot underfoot: hills bring it nearer
  return `eye ${eye} m above the ground${acc ? ` · ground ${formatAtAccuracy(groundM, acc)} m above sea level (±${acc} m stated)` : ''}`
    + (eyeM > 0 && Number.isFinite(horizon) ? ` · level-ground horizon ${formatAtAccuracy(horizon / 1000, 0.1)} km (${REFRACTION_NOTE})` : '');
}
