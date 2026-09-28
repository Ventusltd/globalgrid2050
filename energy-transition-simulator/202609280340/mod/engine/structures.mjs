// COPIED UNCHANGED from world/v12 structures.mjs at v12 commit 3adcee9 (file last changed f52e11f). Modular star family: public #148673 parseFormat.
// Do not edit here: change the source and re-copy. Everything below this header is byte-identical to the source.
// structures.mjs: the mounting structures the typed bar can build, and the structure checks they raise. Pure: no DOM, no imports.
//
// TABLE FORMATS  "kPn" or "kLn": k modules high up the slope (tiers), portrait (P) or landscape (L), n modules along
//   each tier. South-facing fixed tilt takes 2P, 3P, 4P and landscape 3L, 4L, 5L, 6L (the landscape tables of UK
//   central-inverter plants, measured as built 4 and 6 high); east-west takes 1P (one portrait module each side of
//   the ridge); trackers take 1P or 2P across the torque tube, with 1 to 4 strings along a row. Half tables (half the
//   modules along each tier) fill the ends of rows where a full table does not fit (plant-packing.mjs).
// CATALOGUE  five generic structure classes from the structure study (27 Sept): class ranges only, generic labels; no
//   product, maker, site or person is named, no datasheet text or table copied. Each preset sets typed values the
//   owner can change afterwards; every figure is illustrative and to be replaced by the chosen product's datasheet,
//   the project spec and the geotechnical report.
// CHECKS
//   slope-aware row gap  on ground falling to the north at s (m/m), the winter-noon shadow reaches further: the
//     no-shade pitch is (depth tan(el) + rise) / (tan(el) - s). The typed pitch is stretched by the ratio of that pitch
//     to its flat-ground value, so a north-facing row is shaded no more than the typed pitch shades on the flat.
//     Never shrunk on south-facing ground. Where tan(el) <= s no pitch clears the shadow: the stretch is capped.
//   tracker cross slope  slope across a tracker row (east-west): over the review line the row is kept and flagged for
//     the maker's review; over the exclusion line the row is left out.
//   post height          the post reveal against a hard maximum (a tall rear post at a steep tilt), flagged on the HUD.
//   MPPT cap             strings per inverter at most MPPT inputs x strings per input; with short strings the cap
//     can hold DC/AC under the target, which is said.

export const STRUCTURE_NOTE = 'Illustrative class ranges, generic; replace with the chosen product\'s datasheet, the project spec and the geotechnical report.';

/** "3P12" -> { tiers: 3, orient: 'portrait', cols: 12 }; "4L" -> { tiers: 4, orient: 'landscape', cols: null }; else null. */
export function parseFormat(w) {
  const m = /^(\d)([pl])(\d*)$/i.exec(String(w || ''));
  return m ? { tiers: Number(m[1]), orient: m[2].toLowerCase() === 'l' ? 'landscape' : 'portrait', cols: m[3] ? Number(m[3]) : null } : null;
}
export const formatName = (tiers, orient, cols) => `${tiers}${orient === 'landscape' ? 'L' : 'P'}${cols || ''}`;

// Formats each layout builds; anything else is refused in words.
export const FORMATS = Object.freeze({ south: ['2P', '3P', '4P', '3L', '4L', '5L', '6L'], 'east-west': ['1P'], tracker: ['1P', '2P'] });
export const DEFAULT_COLS = 12; // 3P, 4P and landscape tables when no count is typed (the study's example tables)

/** Refusal in words when a format does not suit a layout, else null. */
export function formatRefusal(layout, tiers, orient) {
  const f = formatName(tiers, orient), ok = FORMATS[layout] || [];
  if (ok.includes(f)) return null;
  const where = Object.entries(FORMATS).filter(([, v]) => v.includes(f)).map(([k]) => k);
  return `${f} tables are ${where.length ? `built for ${where.join(' and ')} layouts` : 'not built here'}; ${layout} takes ${ok.join(', ')}`;
}

/**
 * The table's shape from its format: { tiers, orient, along, up, cols, slope } with along = module side along the row,
 * up = side up the slope, slope = the slant (tiers x up + gaps). p: { moduleLongM, moduleShortM, moduleGapM, tiers, orient, tableCols }.
 */
export function tableShape(p, mps, layout) {
  const tracker = layout === 'tracker', ew = layout === 'east-west';
  const tiers = ew ? 1 : Math.max(1, Math.round(p.tiers || (tracker ? 1 : 2)));
  const orient = !tracker && !ew && p.orient === 'landscape' ? 'landscape' : 'portrait';
  const along = orient === 'landscape' ? p.moduleLongM : p.moduleShortM, up = orient === 'landscape' ? p.moduleShortM : p.moduleLongM;
  const slope = tiers * up + (tiers - 1) * p.moduleGapM;
  let cols;
  if (tracker) cols = Math.ceil((p.trackerStrings || 2) * mps / tiers);
  else if (ew) cols = mps;
  else cols = p.tableCols || (tiers === 2 && orient === 'portrait' ? mps : DEFAULT_COLS);
  return { tiers, orient, along, up, slope, cols, modules: tiers * cols * (ew ? 2 : 1) };
}
/** Columns of a half table: half the modules along each tier (rounded up), at least one. */
export const halfCols = cols => Math.max(1, Math.ceil(cols / 2));

// ---- slope-aware row gap ----
/** Pitch stretch for ground falling to the north at s (m/m; negative = rising): >= 1, capped at maxStretch. */
export function pitchStretch({ depth, rise, elevDeg, fallN, maxStretch = 2 }) {
  const t = Math.tan(elevDeg * Math.PI / 180);
  if (!(fallN > 0) || !(t > 0)) return 1;
  if (fallN >= t * 0.98) return maxStretch;
  const flat = (depth * t + rise) / t, slopeP = (depth * t + rise) / (t - fallN);
  return Math.min(maxStretch, Math.max(1, slopeP / flat));
}
export const winterNoonDeg = latDeg => 90 - latDeg - 23.44;

// ---- the catalogue ----
// set: typed values (cmd-grammar KEYS) the preset puts in; ranges: the class's range figures in words.
export const STRUCTURES = Object.freeze([
  { id: 'fixed-2p', study: 's1', label: 'Fixed tilt, south facing, 2P portrait (3P and 3L/4L variants; one or two post lines)',
    set: { layout: 'south', tiers: 2, orient: 'portrait', tableCols: null, posts: 2, tilt: 25, gcr: 0.4, edge: 0.8, postMax: 3.0 },
    ranges: 'tilt 15-35° (2P), 5-20° (3P); GCR 0.3-0.5; lowest edge 0.5-1.2 m; post spacing 3-7.5 m; slope 15 % along, 20 % across; twist 3°' },
  { id: 'east-west', study: 's2', label: 'Fixed east-west low-tilt ridge, 1P each face',
    set: { layout: 'east-west', tiers: 1, orient: 'portrait', tableCols: null, posts: 2, tiltEw: 10, edge: 0.8, postMax: 3.0 },
    ranges: 'tilt 8-15°; gap between ridges 2-4 m; ridge gap 0.1-0.5 m; lowest edge 0.5-1.0 m piled; slope 20 % along, 15 % across' },
  { id: 'tracker-1p', study: 's3', label: 'Single-axis tracker, 1P portrait, independent rows',
    set: { layout: 'tracker', tiers: 1, orient: 'portrait', tableCols: null, trackerStrings: 2, gcr: 0.35, postMax: 3.0 },
    ranges: 'GCR 0.28-0.5; hub 1.2-1.6 m; rotation 45-60°; 2-4 strings a row; post spacing 6-12 m; 8.5-15 % along; across the row: maker review over 7 %, left out over 10 %' },
  { id: 'tracker-2p', study: 's4', label: 'Single-axis tracker, 2P portrait, independent rows',
    set: { layout: 'tracker', tiers: 2, orient: 'portrait', tableCols: null, trackerStrings: 4, gcr: 0.38, postMax: 3.0 },
    ranges: 'GCR 0.30-0.50; hub 2.1-2.6 m; rotation 50-60°; 4 strings a row; post spacing 7-10.5 m; 10 % along' },
  { id: 'high-clearance', study: 's5', label: 'High-clearance agrivoltaic, fixed tilt, 2P portrait (the special classes compared: dual-row tracker, vertical bifacial)',
    set: { layout: 'south', tiers: 2, orient: 'portrait', tableCols: null, posts: 2, tilt: 20, gcr: 0.3, edge: 2.5, postMax: 5.0 },
    ranges: 'clear height at least 2.1 m after tolerance (4-4.5 m for tractors); tilt 10-30°; GCR 0.2-0.35; post spacing 6-12 m; reveal warn 4.3 m, fail 5 m' }
]);
export const structureById = id => STRUCTURES.find(s => s.id === id) || null;
export const STRUCTURE_IDS = STRUCTURES.map(s => s.id);

/** The catalogue in words (typed "structure" alone). */
export function catalogueText() {
  return ['Structures (type structure <name>):', ...STRUCTURES.map(s => `${s.id}: ${s.label}. ${s.ranges}.`), STRUCTURE_NOTE].join('\n');
}

// ---- MPPT cap ----
/** Strings per inverter the MPPTs allow: inputs x strings per input. */
export const mpptCap = ({ mppts = 12, stringsPerMppt = 2 } = {}) => mppts * stringsPerMppt;

/**
 * The structure checks of a laid-out plant, for the HUD: facts { piles summary, rules, skipped, crossReview, table,
 * template counts and params, stretched }. Returns [{ id, failed, line, inputs, standard }].
 */
export function structureChecks(f = {}) {
  const out = [], s = f.piles, R = f.rules || {};
  if (s && Number.isFinite(s.revealFail)) {
    const max = R.revealFailM ?? 3;
    out.push({ id: 'post-height', failed: s.revealFail > 0, line: `${s.revealFail} POSTS OVER ${max.toFixed(1)} M${f.tiltDeg ? ` · TILT ${Math.round(f.tiltDeg)}°` : ''}`,
      inputs: [['Posts over the maximum', s.revealFail], ['Maximum reveal', `${max} m (editable: structure preset or piles rules)`],
        ['Tallest post once graded', `${(s.finishedP?.[2] ?? s.revealP?.[2] ?? NaN).toFixed(2)} m`], ['Posts in all', s.piles]],
      standard: 'EN 1993-5 and EN 1997-1 (piles in bending and embedment); lower tilt, fewer tiers or grading lower the posts' });
  }
  if (f.tracker && f.skipped) {
    const n = f.crossReview || 0, x = f.skipped.cross || 0;
    out.push({ id: 'tracker-cross', failed: n > 0 || x > 0, line: `TRACKER CROSS SLOPE: ${n} ROWS OVER ${f.crossReviewPct ?? 7}% (REVIEW) · ${x} LEFT OUT OVER ${f.crossMaxPct ?? 10}%`,
      inputs: [['Rows kept, over the review line', n], ['Rows left out', x], ['Review line', `${f.crossReviewPct ?? 7} %`], ['Exclusion line', `${f.crossMaxPct ?? 10} %`]],
      standard: 'Tracker maker\'s slope limits (manufacturer data, generic); slope-aware backtracking studied per site' });
  }
  const c = f.counts, P = f.params;
  if (c && P && P.inverterClass !== 'central') {      // central inverters take strings through combiner boxes: no MPPT cap
    const cap = mpptCap(P), stringKWp = c.modulesPerString * P.moduleWp / 1000, dcac = c.stringsPerInverter * stringKWp / P.inverterKVA;
    const capped = c.stringsPerInverter >= cap && dcac < (P.dcAcRatio ?? 1.25) - 0.05;
    out.push({ id: 'mppt-cap', failed: capped, line: `DC/AC ${dcac.toFixed(2)} · STRINGS PER INVERTER CAPPED AT ${cap} (${P.mppts ?? 12} MPPT × ${P.stringsPerMppt ?? 2})`,
      inputs: [['Strings per inverter', c.stringsPerInverter], ['MPPT inputs × strings each', `${P.mppts ?? 12} × ${P.stringsPerMppt ?? 2} = ${cap}`],
        ['String', `${c.modulesPerString} × ${P.moduleWp} W = ${stringKWp.toFixed(1)} kWp`], ['Inverter', `${P.inverterKVA} kVA`], ['DC/AC target', P.dcAcRatio ?? 1.25]],
      standard: 'IEC 62548-1 (array design: string and sub-array connection); inverter MPPT limits from the chosen inverter\'s data', quiet: !capped });
  }
  return out;
}
