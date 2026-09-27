// land.mjs: the land-use lens for farmers and planners. A cartridge: pure functions, no imports, no DOM.
//
// Input: land.json (world.land.v1, cut by tools/features/cut_land.py) and drawn field polygons or the site
// boundary, in British National Grid metres. Each field is { id?, rings: [[[e, n], ...], ...] }; rings are read
// by the even-odd rule, so holes need no particular orientation.
//
// Output, per field and in total:
//   - area by Agricultural Land Classification grade. Post-1988 detailed surveys take precedence where they
//     give a grade; the provisional map (about 1:250,000, grade 3 not split) fills the rest.
//   - area under panels against area kept open between rows, from the row pitch and the table's plan width.
//   - a sheep-grazing capacity note with cited, typical stocking rates, labelled as assumed.
//   - the 2024 crop mix from the Crop Map of England, when land.json carries it: each hexagon is clipped to the
//     field and to the hexagons before it, so the crop areas never add up to more than the field.
//   - land a map marks but does not grade ('Other', non-agricultural, urban) is reported apart, never as a grade.
//
// Areas are integrated by horizontal scanlines: on each line the exact intervals inside each polygon are found,
// intersected, and summed. The error is confined to strips that hold a vertex (step 0.25 m by default).

export const STEP_M = 0.25;
export const BMV = Object.freeze(['Grade 1', 'Grade 2', 'Grade 3a']); // best and most versatile land
export const UNSPLIT_GRADE_3 = 'Grade 3';                              // provisional: may be 3a or 3b
const NOT_A_GRADE_DEFAULT = ['', ' ', 'Not Surveyed'];
// An ALC grade proper; anything else a map carries ('Other', 'Non Agricultural', 'Urban') is not graded land.
export const isGrade = g => /^Grade [1-5][ab]?$/.test(String(g));
export const NOT_GRADED_LABEL = 'Not graded / non-agricultural';

// Typical stocking rates. ASSUMED for any given site: the land, sward, breed and season decide the real figure.
export const SHEEP = Object.freeze({
  solar: Object.freeze({
    low: 4, high: 8, newPasture: Object.freeze([2, 3]),
    basis: 'sheep per hectare of solar farm, grazing between about March and November in the south-west and ' +
      'May to October in the north-east of England',
    source: 'BRE National Solar Centre (2014), Agricultural Good Practice Guidance for Solar Farms, p. 4: ' +
      '"Between 4 and 8 sheep/hectare may be achievable (or 2-3 sheep/ha on newly-established pasture), ' +
      'similar to stocking rates on conventional grassland"',
    url: 'https://files.bregroup.com/solar/NSC_-Guid_Agricultural-good-practice-for-SFs_0914.pdf',
  }),
  grassland: Object.freeze({
    lowlandEweLU: 0.11, lowLU: Object.freeze([1, 1.5]), highLU: Object.freeze([2, 2.5]),
    source: 'AHDB Beef & Lamb, Planning grazing strategies for Better Returns (BRM 8), Table 6 and Figure 3: ' +
      'lowland ewe 0.11 livestock units (from Defra 2010); low stocking 1-1.5 LU/ha, high 2-2.5 LU/ha in season',
    url: 'https://media.ahdb.org.uk/media/Default/Imported%20Publication%20Docs/Planning-grazing-strategies-for-better-returns.pdf',
  }),
  leadingEdgeM: Object.freeze([0.8, 0.9]), // BRE (2014) p. 4: lower edges of modules "typically about 800-900mm high"
});

// ---------- geometry ----------

export function ringArea(ring) {
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x0, y0] = ring[i], [x1, y1] = ring[(i + 1) % ring.length];
    s += x0 * y1 - x1 * y0;
  }
  return s / 2;
}

// Edges of a polygon (rings, even-odd), with its bounding box, ready for scanlines.
export function prepare(rings) {
  const edges = [];
  let y0 = Infinity, y1 = -Infinity, x0 = Infinity, x1 = -Infinity;
  for (const ring of rings || []) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      if (a[1] !== b[1]) edges.push(a[1] < b[1] ? [a[0], a[1], b[0], b[1]] : [b[0], b[1], a[0], a[1]]);
      y0 = Math.min(y0, a[1]); y1 = Math.max(y1, a[1]); x0 = Math.min(x0, a[0]); x1 = Math.max(x1, a[0]);
    }
  }
  return { edges, y0, y1, x0, x1 };
}

// Sorted, disjoint intervals [[xa, xb], ...] where the line y = const lies inside the polygon (even-odd).
export function intervalsAt(poly, y) {
  if (y < poly.y0 || y >= poly.y1) return [];
  const xs = [];
  for (const [ax, ay, bx, by] of poly.edges) if (ay <= y && y < by) xs.push(ax + (y - ay) * (bx - ax) / (by - ay));
  xs.sort((p, q) => p - q);
  const out = [];
  for (let i = 0; i + 1 < xs.length; i += 2) if (xs[i + 1] > xs[i]) out.push([xs[i], xs[i + 1]]);
  return out;
}

export function intersect(A, B) {
  const out = [];
  for (let i = 0, j = 0; i < A.length && j < B.length;) {
    const lo = Math.max(A[i][0], B[j][0]), hi = Math.min(A[i][1], B[j][1]);
    if (hi > lo) out.push([lo, hi]);
    if (A[i][1] < B[j][1]) i++; else j++;
  }
  return out;
}

export function subtract(A, B) {
  const out = [];
  for (const [a0, a1] of A) {
    let s = a0;
    for (const [b0, b1] of B) {
      if (b1 <= s || b0 >= a1) continue;
      if (b0 > s) out.push([s, b0]);
      s = Math.max(s, b1);
      if (s >= a1) break;
    }
    if (s < a1) out.push([s, a1]);
  }
  return out;
}

export const span = I => I.reduce((s, [a, b]) => s + (b - a), 0);

export function pointInRings(rings, x, y) {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > y) !== (yj > y) && x < xi + (y - yi) * (xj - xi) / (yj - yi)) inside = !inside;
    }
  }
  return inside;
}

// ---------- ALC ----------

// Area (m2) of one field by grade. Returns { grades: {grade: m2}, source: {grade: 'post1988'|'provisional'},
// notGraded: {label: m2}, notGradedM2, fieldM2, unclassifiedM2 } where unclassified is field area outside every
// land.json polygon (e.g. off the box) and notGraded is land a map covers with a label that is not a grade.
export function areaByGrade(fieldRings, land, { step = STEP_M } = {}) {
  const field = prepare(fieldRings);
  const notGrade = new Set(land.not_a_grade || NOT_A_GRADE_DEFAULT);
  const layers = [
    ['post1988', (land.alc?.post1988 || []).filter(p => !notGrade.has(p.grade))],
    ['provisional', land.alc?.provisional || []],
  ].map(([kind, items]) => [kind, items.map(p => ({ grade: p.grade, poly: prepare(p.rings) }))
    .filter(p => p.poly.y1 > field.y0 && p.poly.y0 < field.y1 && p.poly.x1 > field.x0 && p.poly.x0 < field.x1)]);
  const grades = {}, source = {}, notGraded = {};
  let fieldLen = 0, restLen = 0;
  if (!(field.y1 > field.y0)) return { grades, source, notGraded, notGradedM2: 0, fieldM2: 0, unclassifiedM2: 0 };
  const rows = Math.max(1, Math.ceil((field.y1 - field.y0) / step)), dy = (field.y1 - field.y0) / rows;
  for (let k = 0; k < rows; k++) {
    const y = field.y0 + (k + 0.5) * dy;
    let rest = intervalsAt(field, y);
    if (!rest.length) continue;
    fieldLen += span(rest);
    for (const [kind, items] of layers) {
      for (const p of items) {
        if (!rest.length) break;
        const I = intervalsAt(p.poly, y);
        if (!I.length) continue;
        const got = span(intersect(rest, I));
        if (got > 0 && !isGrade(p.grade)) notGraded[p.grade] = (notGraded[p.grade] || 0) + got * dy;
        else if (got > 0) {
          grades[p.grade] = (grades[p.grade] || 0) + got * dy;
          if (!source[p.grade] || source[p.grade] === kind) source[p.grade] = kind; else source[p.grade] = 'both';
        }
        rest = subtract(rest, I);
      }
    }
    restLen += span(rest);
  }
  const notGradedM2 = Object.values(notGraded).reduce((a, b) => a + b, 0);
  return { grades, source, notGraded, notGradedM2, fieldM2: fieldLen * dy, unclassifiedM2: restLen * dy };
}

// ---------- panels and grazing ----------

// Plan (horizontal) width of a table from its sloping length across the row and its tilt.
export const planWidth = (slopeLengthM, tiltDeg) => slopeLengthM * Math.cos(tiltDeg * Math.PI / 180);

// Split an area between ground under tables and open ground between rows. pitch: row-to-row spacing (m);
// tableWidth: plan width of one table across the row (m); excludedFraction: tracks, kit and margins taken out
// first (ASSUMED 0 unless given). Assumes rows spread evenly over the area.
export function panelSplit(areaM2, { pitch, tableWidth, excludedFraction = 0 } = {}) {
  if (!(pitch > 0) || !(tableWidth > 0)) throw new Error('land: row pitch and table width must be positive');
  if (tableWidth > pitch) throw new Error('land: table width cannot exceed the row pitch');
  if (!(excludedFraction >= 0 && excludedFraction < 1)) throw new Error('land: excluded fraction must be 0 to <1');
  const gcr = tableWidth / pitch, excluded = areaM2 * excludedFraction, arrayM2 = areaM2 - excluded;
  return { gcr, excludedM2: excluded, arrayM2, underPanelsM2: arrayM2 * gcr, betweenRowsM2: arrayM2 * (1 - gcr) };
}

// Sheep capacity note for a grazed area. Returns ranges and cited sources; every figure is labelled assumed.
export function grazingNote(grazedM2) {
  const ha = grazedM2 / 1e4, s = SHEEP.solar, g = SHEEP.grassland;
  const ewes = lu => lu / g.lowlandEweLU;
  return {
    assumed: true, grazedHa: ha,
    solarFarm: { low: Math.floor(ha * s.low), high: Math.floor(ha * s.high), perHa: [s.low, s.high], basis: s.basis },
    newPasture: { low: Math.floor(ha * s.newPasture[0]), high: Math.floor(ha * s.newPasture[1]), perHa: [...s.newPasture] },
    grasslandCheck: { ewesPerHa: [Math.round(ewes(g.lowLU[0])), Math.round(ewes(g.highLU[1]))], basis: 'in season, open grassland' },
    sources: [{ text: s.source, url: s.url }, { text: g.source, url: g.url }],
    text: `Assumed: about ${Math.floor(ha * s.low)} to ${Math.floor(ha * s.high)} sheep on ${ha.toFixed(1)} ha of grazed ` +
      `solar farm (${s.low} to ${s.high} per ha; ${s.newPasture[0]} to ${s.newPasture[1]} per ha on new pasture), BRE 2014. ` +
      'Needs module lower edges clear of the sheep (typically 0.8 to 0.9 m) and a grazing plan; not site-specific.',
  };
}

// ---------- crops (CROME 2024) ----------

// One CROME cell's outline: a hexagon of the given side about its centre, flat-topped (vertices east and west:
// columns 1.5 x side apart, as the 2024 cut has them) or pointy; with no side, a square of the given area.
export function cellRing(e, n, { side, area, orientation = 'flat' } = {}) {
  if (!(side > 0)) { const h = Math.sqrt(area) / 2; return [[e - h, n - h], [e + h, n - h], [e + h, n + h], [e - h, n + h]]; }
  const a0 = orientation === 'pointy' ? 30 : 0;
  return Array.from({ length: 6 }, (_, k) => { const a = (a0 + 60 * k) * Math.PI / 180; return [e + side * Math.cos(a), n + side * Math.sin(a)]; });
}

// Crop area by code inside the field. Each cell is clipped to the field and to the cells before it (scanlines, as
// areaByGrade), so the areas add up to at most the field: a hexagon half over the box edge counts half.
export function cropMix(fieldRings, crops, { step = STEP_M } = {}) {
  if (!crops || !Array.isArray(crops.cells) || !(crops.hex_area_m2 > 0)) return null;
  const f = prepare(fieldRings), byCode = {};
  if (!(f.y1 > f.y0)) return [];
  const shape = { side: crops.hex_side_m, area: crops.hex_area_m2, orientation: crops.hex_orientation };
  const cells = crops.cells.map(([e, n, code, prob], i) => ({ i, code, prob, poly: prepare([cellRing(e, n, shape)]) }))
    .filter(c => c.poly.y1 > f.y0 && c.poly.y0 < f.y1 && c.poly.x1 > f.x0 && c.poly.x0 < f.x1)
    .sort((a, b) => a.poly.y0 - b.poly.y0 || a.i - b.i);
  const areaOf = new Float64Array(crops.cells.length);
  const rows = Math.max(1, Math.ceil((f.y1 - f.y0) / step)), dy = (f.y1 - f.y0) / rows;
  let next = 0, active = [];
  for (let k = 0; k < rows; k++) {
    const y = f.y0 + (k + 0.5) * dy;
    while (next < cells.length && cells[next].poly.y0 <= y) active.push(cells[next++]);
    active = active.filter(c => c.poly.y1 > y);
    let rest = intervalsAt(f, y);
    if (!rest.length) continue;
    for (const c of [...active].sort((a, b) => a.i - b.i)) {
      if (!rest.length) break;
      const I = intervalsAt(c.poly, y);
      if (!I.length) continue;
      areaOf[c.i] += span(intersect(rest, I)) * dy;
      rest = subtract(rest, I);
    }
  }
  for (const c of cells) {
    const a = areaOf[c.i];
    if (!(a > 0)) continue;
    const o = byCode[c.code] || (byCode[c.code] = { code: c.code, name: crops.codes?.[c.code]?.name || null,
      group: crops.codes?.[c.code]?.group || null, cells: 0, areaM2: 0, probArea: 0 });
    o.cells++; o.areaM2 += a; o.probArea += (c.prob ?? 0) * a;
  }
  return Object.values(byCode).map(({ probArea, ...c }) => ({ ...c, meanProb: c.areaM2 ? probArea / c.areaM2 : null }))
    .sort((a, b) => b.areaM2 - a.areaM2);
}

// ---------- the report ----------

const add = (into, from) => { for (const [k, v] of Object.entries(from)) into[k] = (into[k] || 0) + v; return into; };

// fields: [{ id?, rings }] in BNG metres. panels: { pitch, tableWidth, excludedFraction? } or null.
export function landReport(fields, land, { panels = null, step = STEP_M } = {}) {
  const out = { fields: [], total: { fieldM2: 0, unclassifiedM2: 0, notGradedM2: 0, grades: {}, notGraded: {}, source: {} } };
  for (const [i, f] of (fields || []).entries()) {
    const r = areaByGrade(f.rings, land, { step });
    out.fields.push({ id: f.id ?? `field-${i + 1}`, ...r, crops: cropMix(f.rings, land.crops, { step }) });
    out.total.fieldM2 += r.fieldM2; out.total.unclassifiedM2 += r.unclassifiedM2; out.total.notGradedM2 += r.notGradedM2;
    add(out.total.grades, r.grades); add(out.total.notGraded, r.notGraded);
    for (const [g, s] of Object.entries(r.source)) out.total.source[g] = out.total.source[g] && out.total.source[g] !== s ? 'both' : s;
  }
  const t = out.total;
  t.bmvM2 = BMV.reduce((s, g) => s + (t.grades[g] || 0), 0);
  t.possibleBmvM2 = t.grades[UNSPLIT_GRADE_3] || 0; // provisional grade 3: 3a (BMV) or 3b; needs a survey
  if (panels) {
    const split = panelSplit(t.fieldM2, panels);
    const k = split.arrayM2 / (t.fieldM2 || 1);
    split.byGrade = Object.fromEntries(Object.entries(t.grades).map(([g, a]) =>
      [g, { underPanelsM2: a * k * split.gcr, betweenRowsM2: a * k * (1 - split.gcr) }]));
    out.panels = split;
    out.grazing = grazingNote(split.arrayM2);
  }
  out.assumptions = [
    'Grades come from Natural England maps: the provisional map is about 1:250,000 and not for field-level decisions; ' +
      'a detailed ALC survey decides.',
    'Rows are assumed spread evenly across each field, so panel cover falls on every grade in proportion to its area.',
    'Stocking rates are typical published figures, labelled assumed; the land, sward, breed and season decide.',
  ];
  out.sources = (land.sources || []).map(s => ({ id: s.id, name: s.name, licence: s.licence, attribution: s.attribution, url: s.url }));
  out.attribution = land.attribution || '';
  return out;
}

const ha = m2 => `${(m2 / 1e4).toFixed(2)} ha`;

// Plain lines for a panel or the console.
export function reportLines(r) {
  const t = r.total, lines = [`Area: ${ha(t.fieldM2)}` + (t.unclassifiedM2 > 1 ? ` (${ha(t.unclassifiedM2)} outside the land data)` : '')];
  const from = { post1988: 'post-1988 survey', both: 'survey and provisional', provisional: 'provisional' };
  for (const [g, a] of Object.entries(t.grades).sort()) lines.push(`  ${g}: ${ha(a)} (${from[t.source[g]] || 'provisional'})`);
  lines.push(`Best and most versatile (1, 2, 3a): ${ha(t.bmvM2)}`);
  if (t.notGradedM2 > 0) lines.push(`${NOT_GRADED_LABEL}: ${ha(t.notGradedM2)} (no ALC grade; the map marks it ` +
    `${Object.keys(t.notGraded).sort().map(k => `"${k}"`).join(', ')})`);
  if (t.possibleBmvM2 > 0) lines.push(`Provisional grade 3, not split into 3a/3b: ${ha(t.possibleBmvM2)} (a survey would decide)`);
  if (r.panels) {
    const p = r.panels;
    lines.push(`Under panels: ${ha(p.underPanelsM2)} (ground cover ${(p.gcr * 100).toFixed(0)}%); open between rows: ${ha(p.betweenRowsM2)}` +
      (p.excludedM2 > 0 ? `; tracks and kit: ${ha(p.excludedM2)}` : ''));
    lines.push(r.grazing.text);
  }
  lines.push(r.attribution);
  return lines;
}
