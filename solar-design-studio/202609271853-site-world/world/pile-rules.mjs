// pile-rules.mjs: the one set of pile rules shared by the pile row tool (piles.mjs), the plant layout (plant-piles.mjs)
// and the solar block (block-build.mjs), with two profiles: fixed tilt and single-axis tracker.
//
// Every figure here is ILLUSTRATIVE and EDITABLE (world.piles.auto({ rules }) and the typed "piles" command): a generic
// starting point to be replaced by the chosen product's datasheet, the project spec and the site's
// geotechnical report (pile load tests set the embedment). None is a design value. Values follow the generic piling
// rules study (pile-rules.json v1, ids as PILING-RULES.md: R reveal, F fixed and K tracker tolerances, S slopes,
// E embedment by soil, L testing); the head adjustment (0.25 m) is the GPU prototype's.
//
// FIXED TILT. Reveal (how far a post stands out of the ground) is DERIVED from the table:
//   module surface at a fraction f up the slope = lowEdge + rise * f; rails hang railDepth below the modules, so
//   reveal = lowEdge + rise * f - railDepth.
// One post at mid-slope: 0.8 m low edge, 2P portrait at 25 deg (rise 2.02 m), 0.3 m rails -> 1.51 m. Two posts at 0.2
// and 0.8 of the depth: 0.90 m front, 2.12 m rear. A fixed rafter keeps its tilt: front and rear are fitted as one rigid
// frame (rear top = front top + the difference in nominal reveal) and the posts take the cross slope.
// Tolerances: a post more than revealAdjust from its nominal is outside the head adjustment (flagged); outside the band
// [nominal - below, nominal + above] the ground is graded. Twist: the change of the rafter angle from one end of the
// table to the other that the ground under the front and rear lines asks for (their least-squares slopes); over
// twistTolDeg the table cannot be warped to follow, so the posts and grading take it.
//
// TRACKER. Posts stand along the torque tube, one line per row, running north-south. The tube height clears the
// ground by clearance at the largest rotation: hub = clearance + (module length / 2) sin(maxRotation); the post reveal is
// the axis height less the bearing offset (R5, R7). A terrain-following tracker bends at its bearings: the tube may
// change slope from bay to bay by at most bayChangeMaxDeg (S5) and slope along the row by at most alongMaxPct (S3).
// Post reveals must sit inside the hard reveal window (R7); head height and plumb are installation tolerances (K1-K6),
// tighter than fixed tilt, stated, not computed.
// A row the tube cannot follow within those limits is flagged: it needs grading.
// Pure: no imports, no DOM.

// Embedment by soil (E, default of each range), fixed and tracker; the soil is chosen per site (default stiff clay).
export const SOILS = Object.freeze({ stiff_clay: [1.6, 2.3], soft_clay_alluvium: [2.6, 3.2], peat_organic: [4.0, 4.5], dense_sand: [1.8, 2.4],
  loose_sand: [2.4, 3.0], gravel_till: [1.6, 2.2], chalk: [1.7, 2.3], weak_rock: [1.2, 1.8] });
const COMMON = {
  label: 'Illustrative pile rules (editable): replace with the product datasheet, the project spec and the geotechnical report.',
  soil: 'stiff_clay',
  embedGpuM: Object.freeze({ min: 1.2, nominal: 1.6 }), // the GPU prototype's figures, for comparison
  proofTestPct: 1.0,       // production proof tests, % of piles (L3, range 0.5-2)
  revealAdjustM: 0.25,     // head adjustment: +/- from nominal without a different post
  embedToReveal: 0.75,     // lateral load, a rule of thumb: embedment at least 0.75 x the post's reveal (longer post)
  gradingWidthM: 2.0,      // width graded along a pile line
  lowEdgeClearM: 0.5,      // lowest module edge over the ground: flagged below this
  pileSpacingM: Object.freeze({ fixed: 5, tracker: 7 }),
  grading: Object.freeze({ dropOverM: 0.6, mergeGapM: 2 }) // deeper than 0.6 m of grading: suggest dropping the table
};

export const PROFILES = Object.freeze({
  fixed: Object.freeze({ ...COMMON, system: 'fixed', embedM: SOILS.stiff_clay[0], embedMinM: 1.0, // E, E-min
    revealBelowM: 0.4, revealAboveM: 0.6,  // band about nominal; outside it the ground is graded
    // R4, relative: warn when a post stands more than revealWarnAboveM over ITS design height (the rear posts of a 2P
    // table stand 2.12 m by design, so a fixed 2.0 m line flagged every one); revealFailM is a hard maximum for any post.
    revealWarnAboveM: 0.5, revealFailM: 3.0,
    twistTolDeg: 3.0,                      // F6: rafter angle change end to end the table can take
    headTolMm: 30, plumbTolDeg: 2.0,       // F4, F3: installation, stated
    railDepthM: 0.3, pivot: 0.5, twoPost: Object.freeze([0.2, 0.8]) }),
  tracker: Object.freeze({ ...COMMON, system: 'tracker', embedM: SOILS.stiff_clay[1], embedMinM: 1.5,
    axisHeightM: 1.4, bearingDropM: 0.15,  // R5, R7: 1P axis height, bearing offset
    revealWindowM: Object.freeze([0.95, 1.45]), // R7: hard window for every post
    headTolMm: 20, plumbTolDeg: 1.5,       // K: standard pile (drive piles 10 mm, 0.5 deg east-west), installation, stated
    alongMaxPct: 15, crossMaxPct: 7, bayChangeMaxDeg: 0.5, // S3, S4, S5
    maxRotationDeg: 60, moduleLongM: 2.384, lowEdgeFullTiltM: 0.5, twistTolDeg: Infinity })
});
export const PILE_RULES = PROFILES.fixed; // the fixed-tilt profile, the default everywhere
export const TRACKER_RULES = PROFILES.tracker;
export const rulesFor = system => PROFILES[system === 'tracker' ? 'tracker' : 'fixed'];

/** Nominal reveal of a fixed-tilt post at fraction f up the slope of a table: lowEdge + rise f - railDepth. */
export function revealAt({ lowEdgeM, rise, f, railDepthM = PILE_RULES.railDepthM }) {
  if (!(lowEdgeM >= 0) || !(rise >= 0) || !(f >= 0 && f <= 1)) throw new Error('pile rules: need lowEdge >= 0, rise >= 0 and 0 <= f <= 1');
  return lowEdgeM + rise * f - railDepthM;
}

/** Tracker: axis (hub) height, post reveal, and the lowest module edge at full tilt. */
export function trackerHub(R = TRACKER_RULES) {
  const hub = R.axisHeightM;
  return { hub, reveal: hub - R.bearingDropM, lowEdgeFullTilt: hub - R.moduleLongM / 2 * Math.sin(R.maxRotationDeg * Math.PI / 180) };
}

/** The reveal band about a nominal: { min, nominal, max }; a tracker's is its hard window. */
export function revealBand(nominal, rules = PILE_RULES) {
  if (rules.revealWindowM) return { min: rules.revealWindowM[0], nominal, max: rules.revealWindowM[1] };
  return { min: nominal - rules.revealBelowM, nominal, max: nominal + rules.revealAboveM };
}

/**
 * Height checks of one post against its design (nominal) reveal: { high: stands more than revealWarnAboveM above its design
 * height, overMax: stands over the hard maximum revealFailM }. A rule left out never fires.
 */
export function heightFlags(reveal, design, rules = PILE_RULES) {
  const up = rules.revealWarnAboveM, max = rules.revealFailM;
  return { high: Number.isFinite(up) && reveal > design + up + 1e-9, overMax: Number.isFinite(max) && reveal > max + 1e-9 };
}

/** Rules with the embedment of a soil (SOILS) in place of the default. */
export function withSoil(rules, soil) {
  const e = SOILS[soil];
  return e ? { ...rules, soil, embedM: e[rules.system === 'tracker' ? 1 : 0] } : rules;
}

/**
 * Pile lines of a table: [{ f (fraction of the plan depth from the low edge), nominal }].
 * fixed: posts 1 (the pivot) or 2 (front and rear); east-west (ridge): one line per face at the face's pivot;
 * tracker: one line under the tube (f = 0.5).
 */
export function tableLines({ lowEdgeM, rise, posts = 2, eastWest = false, tracker = false, rules = PILE_RULES }) {
  if (tracker) return [{ f: 0.5, nominal: trackerHub(rules.system === 'tracker' ? rules : TRACKER_RULES).reveal }];
  const rd = rules.railDepthM;
  if (eastWest) return [0.25, 0.75].map(f => ({ f, nominal: revealAt({ lowEdgeM, rise, f: rules.pivot, railDepthM: rd }) }));
  const fs = posts === 1 ? [rules.pivot] : rules.twoPost;
  return fs.map(f => ({ f, nominal: revealAt({ lowEdgeM, rise, f, railDepthM: rd }) }));
}

/**
 * Twist, degrees: the change of the rafter angle from one end of a table of length len to the other, when the rear line
 * is dz above the front across the plan distance depth at the first end and the lines' slopes differ by bRear - bFront.
 * With dz = 0 it is the rotation of a flat section.
 */
export function twistDeg(bFront, bRear, len, depth, dz = 0) {
  if (!(depth > 0)) return 0;
  return Math.abs(Math.atan((dz + (bRear - bFront) * len) / depth) - Math.atan(dz / depth)) * 180 / Math.PI;
}
