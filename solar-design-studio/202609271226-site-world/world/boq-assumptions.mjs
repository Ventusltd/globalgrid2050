// boq-assumptions.mjs: the default values the bill of quantities falls back on
// when a design item does not say. Every value here is an assumption, not a rule
// from a standard; rows built from them carry status 'assumed' and say so.
// Replace any of them by putting the value on the design item itself.
//
// Imports only road.mjs (pure), so the bill's road layers are the build-up the world draws. No DOM.

import { SURFACES } from './road.mjs';

// One line on the page and at the head of every exported bill.
export const DISCLAIMER = 'Estimates for early design. Confirm with the network operator and a qualified engineer.';

// What every ground-derived number rests on. Readouts and bill rows quote these words.
export const BASIS = Object.freeze({
  ground: 'EA LIDAR Composite DTM 1 m, ±15 cm',
  datum: 'metres above Ordnance Datum Newlyn',
  spoil: 'bank volume, no bulking',
});

// Cable allowances: ONE set, used by the bill (boq.mjs) and the drum schedule (drums.mjs).
// Each is an assumed value with its name, unit and basis, not a figure from a standard.
export const CABLE_ALLOWANCES = Object.freeze({
  terminationM: Object.freeze({ value: 5, unit: 'm per core per end',
    basis: 'Assumed: tail into the switchgear or sealing end plus cut-back for preparation.' }),
  snakingPct: Object.freeze({ value: 1, unit: '% of 3D route length',
    basis: 'Assumed 1 %: lateral snaking, slack and thermal movement; typical practice is 0.5 to 2 %.' }),
});

export const CABLE_DEFAULTS = {
  // Single-core AC cables laid as three per circuit (trefoil or flat).
  coresPerCircuit: 3,
  // Snaking, sag in the trench and cut-off waste, as a share of laid length (CABLE_ALLOWANCES).
  slackPct: CABLE_ALLOWANCES.snakingPct.value,
  // Tail per core per end for glanding and termination, metres (CABLE_ALLOWANCES).
  terminationM: CABLE_ALLOWANCES.terminationM.value,
};

// Road build-ups, top layer first. Thicknesses in millimetres. 'unbound' and 'bound' are the gravel and
// tarmac build-ups road.mjs draws (assumed typical values there too); 'concrete' has no drawn twin.
// roadBuildUp(layers) turns road.mjs layers ({ name, material, thickness in m }) into bill layers, each
// marked assumed because road.mjs itself says its build-ups are assumed typical values.
export const roadBuildUp = (layers) => layers.map((l, i) => ({
  key: /sub-base/.test(l.name) ? 'SUBBASE' : `L${i + 1}`,
  material: `${l.name}, ${l.material}`, thicknessMm: Math.round(l.thickness * 1000), assumed: true,
}));
const fromRoad = (surface) => roadBuildUp(SURFACES[surface].layers);
export const ROAD_BUILD_UPS = {
  unbound: { label: 'gravel access track', layers: fromRoad('gravel'), geotextile: false },
  bound: { label: 'tarmac road', layers: fromRoad('tarmac'), geotextile: false },
  concrete: {
    label: 'concrete hardstanding',
    layers: [
      { key: 'CONC', material: 'concrete slab', thicknessMm: 200 },
      { key: 'SUBBASE', material: 'crushed aggregate sub-base (Type 1 class)', thicknessMm: 150 },
    ],
    geotextile: false,
  },
};

export const FENCE_DEFAULTS = {
  postSpacingM: 3,
};

// Height of the cable or duct envelope the bedding surrounds, when a trench
// section gives neither a duct diameter nor a phase spacing, millimetres.
export const BEDDING_DEFAULTS = {
  envelopeMm: 100,
};
