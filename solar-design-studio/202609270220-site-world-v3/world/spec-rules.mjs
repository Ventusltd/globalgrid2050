// spec-rules.mjs: which specification a trench is built to, and what the ground does to it.
//
// Two specifications:
//   'operator'  the network operator sections in data/trench-sections.json, with the good-practice
//               ground rules below (our own summary of common UK practice, not any one document).
//   'project'   a project specification the user loads from a local file at run time (schema spec-rules.v1).
//               It is held in memory only: never uploaded, never stored, never written into the page.
// The repo ships only data/spec-example.json, a made-up file clearly labelled "example".
//
// Ground conditions change the trench: an alluvium / soft wet ground option adds support or a batter,
// a formation over-dig with granular fill, a wider working width, a dewatering note and spoil handling.
// Pure: no imports, no DOM.

export const SCHEMA = 'spec-rules.v1';

// Good practice when no project specification is loaded (general UK practice, rounded):
//   tape 200 mm above the cable; backfill compacted in 150 mm layers; 150 mm concrete round ducts under roads;
//   signal cables 600 mm from MV/HV and 300 mm from LV; soil stripped and stored by the Defra soil code
//   (topsoil apart from subsoil); watercourse stand-off 10 m by default (drainage-board byelaw strips are
//   typically 8-9 m; the regulator sets the figure).
// The alluvium numbers are assumed general practice for soft wet ground, not from any document: support below
// 1.2 m (entry depth), a 1 : 1 batter above it, 1 m working strip each side, 150 mm formation over-dig,
// 1.3 bulking for wet clayey spoil.
export const OPERATOR_SPEC = Object.freeze({
  schema: SCHEMA, label: 'Network operator spec', source: 'operator',
  note: 'Operator trench sections (typical UK practice, confirm with the DNO/TO spec); ground rules are general practice.',
  marker: { tape_above_service_m: 0.2 },
  backfill: { layer_mm: 150 },
  ducts: { road_concrete_surround_mm: 150, dc_mains_ducted: true },
  separation: { signal_from_mv_mm: 600, signal_from_lv_mm: 300 },
  spoil: { topsoil_separate: true },
  standoff: { watercourse_m: 10 },
  ground: {
    normal: { label: 'Normal ground' },
    alluvium: {
      label: 'Alluvium / soft wet ground',
      basis: 'General practice for soft, wet, low-strength ground with a high water table.',
      support_below_m: 1.2, batter_h_per_v: 1.0, working_extra_m: 1.0, overdig_m: 0.15,
      formation: 'granular sub-base on geotextile', bulking: 1.3,
      dewatering: 'sump pumping through a settlement tank or silt bag; never straight into a ditch or drain',
      spoil: 'wet spoil kept away from ditch edges, stockpiles low and covered, topsoil and subsoil apart',
      ducts_preferred: true
    }
  }
});

const num = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const txt = v => typeof v === 'string' && v.length > 0 && v.length <= 400;

/**
 * readSpec(json) -> a normalised specification, or throws with a plain reason.
 * Accepts the rules object itself or a wrapper with the rules under `tool` (a private file may carry both).
 * Missing groups fall back to the operator spec, so a project file only says what it changes.
 */
export function readSpec(json) {
  const doc = json && typeof json === 'object' && json.tool && typeof json.tool === 'object' ? json.tool : json;
  if (!doc || typeof doc !== 'object') throw new Error('specification: not a JSON object');
  if (doc.schema !== SCHEMA) throw new Error(`specification: schema must be "${SCHEMA}"`);
  const out = { schema: SCHEMA, source: 'project', label: txt(doc.label) ? doc.label.slice(0, 80) : 'Project specification',
    note: txt(doc.note) ? doc.note : '' };
  for (const k of ['marker', 'backfill', 'ducts', 'separation', 'spoil', 'standoff']) out[k] = { ...OPERATOR_SPEC[k], ...(doc[k] || {}) };
  if (!num(out.marker.tape_above_service_m, 0.05, 1)) throw new Error('specification: marker.tape_above_service_m must be 0.05 to 1 m');
  if (!num(out.backfill.layer_mm, 50, 500)) throw new Error('specification: backfill.layer_mm must be 50 to 500');
  out.ground = { normal: { label: 'Normal ground' } };
  const g = { ...OPERATOR_SPEC.ground.alluvium, ...((doc.ground || {}).alluvium || {}) };
  if (!num(g.support_below_m, 0.5, 3)) throw new Error('specification: ground.alluvium.support_below_m must be 0.5 to 3 m');
  if (!num(g.batter_h_per_v, 0, 3)) throw new Error('specification: ground.alluvium.batter_h_per_v must be 0 to 3');
  if (!num(g.working_extra_m, 0, 5)) throw new Error('specification: ground.alluvium.working_extra_m must be 0 to 5 m');
  if (!num(g.overdig_m, 0, 1)) throw new Error('specification: ground.alluvium.overdig_m must be 0 to 1 m');
  if (!num(g.bulking, 1, 2)) throw new Error('specification: ground.alluvium.bulking must be 1 to 2');
  out.ground.alluvium = g;
  return out;
}

export const GROUNDS = Object.freeze([['normal', 'Normal ground'], ['alluvium', 'Alluvium / soft wet ground']]);

/**
 * applyGround(section, spec, groundId) -> the trench as it will be dug.
 * section: a row of trench-sections.json (trench_width_m, trench_depth_m, ...).
 * Returns { width, depth, benchSlope, cableDepth, support, workingWidth, overdig, bulking, notes, groundLabel, specLabel }.
 *   width, depth, benchSlope feed createTrench(); cableDepth is where the cables sit (the section's own depth).
 */
export function applyGround(section, spec = OPERATOR_SPEC, groundId = 'normal') {
  const s = spec || OPERATOR_SPEC, w = section.trench_width_m, d = section.trench_depth_m;
  const base = { width: w, depth: d, benchSlope: 0, cableDepth: d, overdig: 0, bulking: 1, support: 'none',
    workingWidth: w + 1.0, groundLabel: 'Normal ground', specLabel: s.label, notes: [] };
  base.notes.push(`Backfill in ${s.backfill.layer_mm} mm layers; tape ${s.marker.tape_above_service_m} m above the service`);
  if (d > 1.2) { base.support = 'trench support (boxes or sheets)'; base.notes.push('Deeper than 1.2 m: support before anyone enters'); }
  if (groundId !== 'alluvium') return base;
  const g = s.ground.alluvium, depth = d + g.overdig_m;
  const supported = depth > g.support_below_m || g.batter_h_per_v === 0;
  const topWidth = supported ? w : w + 2 * g.batter_h_per_v * depth;
  return {
    width: w, depth, benchSlope: supported ? 0 : g.batter_h_per_v, cableDepth: d, overdig: g.overdig_m, bulking: g.bulking,
    support: supported ? 'trench boxes or sheet support, walls vertical' : `battered sides ${g.batter_h_per_v} : 1 (horizontal : vertical)`,
    workingWidth: topWidth + 2 * g.working_extra_m, groundLabel: g.label, specLabel: s.label,
    notes: [...base.notes.slice(0, 1),
      `Over-dig ${Math.round(g.overdig_m * 1000)} mm, ${g.formation}`,
      `Dewatering: ${g.dewatering}`, `Spoil: ${g.spoil}`, `Keep ${s.standoff.watercourse_m} m from watercourses`, ...(g.ducts_preferred ? ['Ducts preferred over direct lay in soft ground'] : [])]
  };
}

// Loose volume of spoil once dug: bank volume times the bulking factor.
export const looseSpoil = (bankM3, eff) => bankM3 * (eff?.bulking || 1);
