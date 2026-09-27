// cmd-derive.mjs: the quantities a typed command changes, worked out from its inputs. Pure: no DOM.
//   sun and shade    noon sun height at the solstices for the site latitude; the shadow a row casts on level ground
//   cable            outside diameter and bend radius from data/cables.json (installation and final multiples of OD)
//   trench           the cable formation's span and height, the cover left over it, and whether it fits the width
//   string loops     the area enclosed between the + and - conductors of one string, standard and leapfrog wiring,
//                    by the closed-path winding area (shoelace), the text engine's method (closed-path-winding-area.v1)
// Illustrative: conductor routes on the table are ASSUMED (named below); nothing here is a design for any site.

const DEG = Math.PI / 180, TILT_AXIS = 23.44;

/** Noon sun elevation (degrees) on the winter and summer solstices and the equinox, at latitude latDeg. */
export function noonSun(latDeg) {
  return { winter: 90 - latDeg - TILT_AXIS, equinox: 90 - latDeg, summer: Math.min(90, 90 - latDeg + TILT_AXIS) };
}

/** Shadow of a south row on level ground at noon: { shadowM, gapM, shaded } for a table of rise and plan depth. */
export function rowShade({ rise, depth, pitch, elevDeg }) {
  const shadowM = elevDeg > 0 ? rise / Math.tan(elevDeg * DEG) : Infinity, gapM = pitch - depth;
  return { shadowM, gapM, shaded: shadowM > gapM + 1e-9 };
}

// The formation of three single-core cables of outside diameter od (m): trefoil touching, or flat spaced one OD apart.
export function formationOf(formation, od) {
  return formation === 'flat' ? { span: 5 * od, height: od, centres: [[-2 * od, od / 2], [0, od / 2], [2 * od, od / 2]] }
    : { span: 2 * od, height: od * (1 + Math.sqrt(3) / 2), centres: [[-od / 2, od / 2], [od / 2, od / 2], [0, od / 2 + od * Math.sqrt(3) / 2]] };
}

/** The cable from the catalogue (data/cables.json) for a size and conductor, 33 kV single core. */
export function cableFor(catalogue, size, metal = 'al') {
  const list = catalogue?.cables || [];
  const want = metal === 'cu' ? new RegExp(`^33kv-1c-cu-xlpe-${size}(-|$)`) : new RegExp(`^33kv-1c-al-xlpe-${size}$`);
  const c = list.find(x => want.test(x.id));
  return c ? { id: c.id, od: c.od_mm / 1000, odMm: c.od_mm, armoured: /armoured/.test(c.id), status: c.status || 'catalogue' } : null;
}

/** Bend radius at the cable's inner edge: installation and final multiples of OD from the catalogue's rules. */
export function bendOf(catalogue, cable) {
  if (!cable) return null;
  const rules = (catalogue?.rules || []).filter(x => x.voltage_kv === 33 && x.construction === (cable.armoured ? 'single_core_armoured' : 'single_core_unarmoured'));
  const m = when => rules.find(x => x.when === when)?.multiple_of_od ?? null;
  const inst = m('installation'), fin = m('final');
  return { installM: inst ? inst * cable.od : null, finalM: fin ? fin * cable.od : null, installX: inst, finalX: fin,
    source: rules.find(x => x.when === 'installation')?.source || 'no rule in the catalogue' };
}

export const BED_M = 0.075, SIDE_M = 0.1, AGRI_COVER_M = 0.91; // bedding under the cables; side clearance each side (assumed)

/** Trench with its cables: the cover left to the top cable, and whether the formation fits the width. */
export function trenchOf({ depth, width, formation, od }) {
  const f = formationOf(formation, od), cover = depth - BED_M - f.height;
  return { ...f, cover, fits: width >= f.span + 2 * SIDE_M - 1e-9, needWidth: f.span + 2 * SIDE_M, agriShort: AGRI_COVER_M - cover };
}

/** Signed area of a closed polyline (shoelace). */
export function shoelace(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length]; a += x0 * y1 - x1 * y0; }
  return a / 2;
}

// ASSUMED routes on one tier of a portrait table (u along the row, w up the module from its lower edge):
//   junction boxes 0.15 of the module length below the top edge; module leads either side of the box 0.06 m apart;
//   the standard string's return lead clipped to the lower purlin, 0.25 of the module length up.
export const LOOP_ASSUMED = Object.freeze({ jboxFromTop: 0.15, leadHalfGapM: 0.06, purlinAt: 0.25 });

/** The loop between + and - of one string: { standard, leapfrog } each { poly, area } in m and m². */
export function stringLoops({ mps, moduleShortM = 1.134, moduleLongM = 2.384, moduleGapM = 0.02 }, a = LOOP_ASSUMED) {
  const pitch = moduleShortM + moduleGapM, x = i => (i + 0.5) * pitch, L = mps * pitch - moduleGapM;
  const yj = moduleLongM * (1 - a.jboxFromTop), yr = moduleLongM * a.purlinAt, d = a.leadHalfGapM;
  // Standard: out along the boxes from the first module to the last, home along the purlin.
  const standard = [[0, yj], ...Array.from({ length: mps }, (_, i) => [x(i), yj]), [L, yj], [L, yr], [0, yr]];
  // Leapfrog: out on every other module, back on the ones skipped; both ends at the start of the row.
  const odd = Array.from({ length: mps }, (_, i) => i).filter(i => i % 2 === 0), even = Array.from({ length: mps }, (_, i) => i).filter(i => i % 2);
  const leapfrog = [[0, yj + d], ...odd.map(i => [x(i), yj + d]), [L, yj + d], [L, yj - d], ...even.reverse().map(i => [x(i), yj - d]), [0, yj - d]];
  return { standard: { poly: standard, area: Math.abs(shoelace(standard)) }, leapfrog: { poly: leapfrog, area: Math.abs(shoelace(leapfrog)) }, lengthM: L };
}

/** Cold open-circuit voltage of one module and of a string of n (V). */
export function coldVoc({ voc, coeff = -0.0027, minC = -10 }, n) {
  const v = voc * (1 + coeff * (minC - 25));
  return { module: v, string: v * n, most: Math.floor(1500 / v) };
}

const cap = s => String(s || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
/** The ground at a point (layers/ground.mjs at()) in words, and what it means for the trench. */
export function soilEffect(here) {
  const head = 'Soil type from BGS 1:625k';
  if (!here || (here.superficial === null && here.bedrock === null)) return `${head}: not in this site's ground file; trench in normal ground assumed.`;
  const sup = here.superficial || [], rock = (here.bedrock || [])[0];
  const soft = sup.find(s => /alluvi|peat|tidal|lacustrine|marine|clay|silt/i.test(`${s.name} ${s.lithology || ''}`));
  const rockWords = rock ? `bedrock ${cap(rock.name)} (${String(rock.lithology || 'lithology not given').toLowerCase()})` : 'no bedrock mapped here';
  if (soft) return `${head}: ${cap(soft.name)} over ${rockWords} → trench option alluvium / soft wet ground (support or batter, dewatering).`;
  if (sup.length) return `${head}: ${cap(sup[0].name)} over ${rockWords} → trench in normal ground.`;
  const hard = rock && /limestone|sandstone|granite|basalt|dolerite|chalk/i.test(rock.lithology || '');
  return `${head}: no superficial deposit mapped (${here.superficial === null ? 'not imported' : 'queried, none'}); ${rockWords} → trench in normal ground`
    + `${hard ? '; rock may lie near the surface, allow for breaking out' : ''}.`;
}
