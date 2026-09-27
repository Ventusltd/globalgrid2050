// Overhead line zones: the distances, each with where it comes from. Pure data, no DOM.
// Figures read from the public HSE documents on 27 September 2026 and cited by title, edition and paragraph only;
// no text is copied. Where a figure is this tool's own, it says so (kind 'assumed' or 'user').
//
// What the world draws from these (ohl-zones.mjs): measured on the ground, horizontally, from below the nearest
// conductor as drawn by the grid layer. Tower heights and sag are ASSUMED there, so every zone is illustrative.
// The zones are generous on purpose. They never show that a place is free of danger: only that it needs checking.

export const GS6 = 'HSE Guidance Note GS6, Avoiding danger from overhead power lines';
export const GS6_4 = `${GS6} (fourth edition, 2013)`;
export const GS6_3 = `${GS6.replace('Avoiding danger from', 'Avoidance of danger from')} electric power lines (third edition, 1997, withdrawn)`;

// The fixed on-screen line (owner's wording rule). The only sentence in the feature that may use the word it uses.
export const DISCLAIMER = 'Illustrative only. Not a safe system of work. Follow HSE GS6 and the network operator\'s instructions.';
// What every flag tells the reader to do.
export const ACTION = 'plan the work under GS6 with the network operator';

export const ZONES = Object.freeze({
  // Ground-level barriers: the safety zone on either side of the line, from the nearest wire. Same for poles and towers.
  barrier: { m: 6, kind: 'guidance', source: `${GS6_4}, paragraph 19` },
  // Work planned within this of the nearest wire (at ground level, horizontally) has risks to manage.
  planning: { m: 10, kind: 'guidance', source: `${GS6_4}, paragraph 11` },
  // The earlier edition's distances for high machinery, by support: kept as a generous floor for the zone, since the
  // current edition gives one planning distance for both. Wood poles 9 m; metal towers and structures 15 m.
  support: { pole: 9, tower: 15, kind: 'guidance', source: `${GS6_3}, paragraph 38` }
});

// Exclusion zones round the conductors for plant, by line voltage (the current edition quotes the ENA figures).
// 66 kV and 132 kV share the 132 kV figure here (the grid layer's classes), which is the larger of the two.
export const EXCLUSION = Object.freeze({
  byClass: { '33kV': 3, '132kV': 6, '275kV': 7, '400kV': 7 },
  kind: 'guidance', source: `${GS6_4}, paragraph 25 (the Energy Networks Association figures it quotes)`
});

// Conductor swing in wind: the current edition asks for the zone to allow for it (paragraph 19) and the earlier
// one names lateral swing on long spans (paragraph 15, note). No figure is given, so this tool supplies one:
// the conductor may swing out through SWING_DEG, so it moves sideways by sag x sin(SWING_DEG). ASSUMED.
export const SWAY = Object.freeze({ swingDeg: 45, minM: 1, kind: 'assumed',
  source: `${GS6_4}, paragraph 19; ${GS6_3}, paragraph 15: allowance asked for, figure assumed by this tool` });
// Uncertainty in where the conductors are: tower positions are inferred from open map data. ASSUMED.
export const POSITION_ALLOWANCE = Object.freeze({ m: 2, kind: 'assumed',
  source: `${GS6_4}, paragraph 25 (allow for uncertainty in measuring); figure assumed by this tool` });

// Goalpost crossing points where plant must pass under the line: through the barriers, one at each end.
export const GOALPOSTS = Object.freeze({ kind: 'guidance', source: `${GS6_4}, paragraphs 21 and 22` });

// The height of plant working on the design (piling rig mast, crane jib, tipper body). USER-SET: the default is a
// typical piling rig mast, not a figure from any source; the reader should enter the tallest plant on the job.
export const WORKING_HEIGHT = Object.freeze({ defaultM: 12, minM: 0, maxM: 80, kind: 'user',
  source: 'Set by the user: the tallest plant or load on the work (default a typical piling rig mast, assumed)' });

// Half-widths of design items (centreline to edge), metres, where the design does not give one. ASSUMED.
export const ITEM_HALF = Object.freeze({ trench: 0.5, cable: 0.5, road: 3, fence: 0.5, piles: 2.5, hdd: 1, pad: 0 });
// A pad drawn by its centre only: its footprint is taken as a disc of this radius. ASSUMED (a large skid pad).
export const PAD_RADIUS_M = 8;

// The zone distance (plan metres from the nearest conductor) for a line on a given support.
export const zoneDistance = support => Math.max(ZONES.planning.m, ZONES.support[support === 'pole' ? 'pole' : 'tower']);
export const exclusionFor = cls => EXCLUSION.byClass[cls] ?? Math.max(...Object.values(EXCLUSION.byClass));
