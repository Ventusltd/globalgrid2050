// COPIED UNCHANGED from the v12 world (web/world/structure-presets.mjs) at v12 commit 3adcee9 (file last changed a83209f). Modular star family: not known to star-find.
// Do not edit here: change the source and re-copy. Everything below this header is byte-identical to the source.
// structure-presets.mjs: generic plant presets from an open-data study of large operational UK solar farms, typed as
// "preset <id>" (or "structure <id>"). Each sets typed values the owner can change afterwards; none sets the Solar
// block (its defaults are the owner's and stay as they are).
//
// The study measured rows as built from open 1 m LiDAR (a GPU pair with a CPU witness) at a few older plants, and read
// public planning and trade records at the others. Every preset says its evidence tier: measured (as built), public
// design (planning or public counts), or hypothesis (consistent but not resolved). Sites are not named, and no preset
// reproduces any one plant: module classes are generic and the values sit inside the ranges found.
// Measured distribution behind the defaults: row pitch 8.0-9.3 m as built at four plants (the v09 default was 11.97 m);
// plan cover (GCR) 0.41-0.52 at 2 portrait plants and 0.63-0.70 at 6-high landscape plants; tilt 15-25°.
// Pure: no DOM, no imports.

export const PRESET_NOTE = 'Generic preset from open-data studies of operational UK plants; illustrative class values, not a design for any site.';

// set: typed values (cmd-grammar KEYS). moduleLong/moduleShort are generic module classes (60-cell about 1.65 x 0.99 m).
export const PRESETS = Object.freeze([
  { id: 'central-6l-20', label: 'Central inverters, landscape 6-high tables, about 20°, dense',
    set: { layout: 'south', tiers: 6, orient: 'landscape', tableCols: null, tilt: 20, gcr: 0.65, edge: 0.7, moduleLong: 1.65, moduleShort: 0.99,
      wp: 260, voc: 38, inverterClass: 'central', inverterKVA: 2000, invertersPerStation: 1, packing: 'fields' },
    ranges: 'tilt 18-20°; lowest edge 0.65-0.8 m; top 2.35-3.0 m; slant 6.0-6.5 m; pitch 9.1-9.2 m; GCR 0.63-0.66; row runs 140-150 m',
    evidence: 'measured as built at two plants (6-high landscape chosen over 3P, 4L and 2P by slant length and by row length x public module count)' },
  { id: 'central-deep-15', label: 'Central inverter skids of about 3 MVA, deep 6-7 m tables, 15°, flat drained levels',
    set: { layout: 'south', tiers: 6, orient: 'landscape', tableCols: null, tilt: 15, gcr: 0.66, edge: 0.6, moduleLong: 2.0, moduleShort: 1.0,
      wp: 380, voc: 48, inverterClass: 'central', inverterKVA: 3000, invertersPerStation: 1, packing: 'fields' },
    ranges: 'pitch 9.3 m; plan GCR about 0.7; high edge about 2.1 m; tilt at least 14°',
    evidence: 'rows measured as built (pitch, depth), skid class public; the table form (3P, 4P or 6L) is a hypothesis' },
  { id: 'central-2p-22', label: 'Central inverters with string combiners, 2 portrait, 22°, one spine with pad pairs',
    set: { layout: 'south', tiers: 2, orient: 'portrait', tableCols: null, tilt: 22, gcr: 0.41, edge: 0.96, moduleLong: 1.65, moduleShort: 0.99,
      wp: 255, voc: 38, inverterClass: 'central', inverterKVA: 1500, invertersPerStation: 2, packing: 'fields', bandM: 2000, runM: 280 },
    ranges: 'tilt 21-24°; plan depth 3.2-3.35 m; pitch 8.0 m; GCR 0.41; rows unbroken up to about 280 m; one spine, no east-west tracks',
    evidence: 'measured as built at one plant (rows, pitch, spine, pad pairs); inverter class public' },
  { id: 'central-4l-25', label: 'Container central stations, landscape 4-high (full and half tables), 25°, pitch follows the slope',
    set: { layout: 'south', tiers: 4, orient: 'landscape', tableCols: 26, tilt: 25, gcr: 0.53, edge: 0.8, moduleLong: 2.28, moduleShort: 1.13,
      wp: 550, voc: 50, inverterClass: 'central', inverterKVA: 2250, invertersPerStation: 2, packing: 'fields', rowGap: 'slope' },
    ranges: 'full 4 x 26 and half 4 x 13 tables; top about 2.9 m; pitch 8.66-12.69 m stretched on north-falling ground',
    evidence: 'public design at one plant (planning drawings); a slope-following fill matched its planning module count within 1 %' },
  { id: 'central-3l-25', label: 'Central inverters in pairs at switchgear stations, landscape 3-high, 25°, 3 m height cap',
    set: { layout: 'south', tiers: 3, orient: 'landscape', tableCols: null, tilt: 25, gcr: 0.4, edge: 1.0, postMax: 3,
      inverterClass: 'central', inverterKVA: 1700, invertersPerStation: 2, packing: 'fields' },
    ranges: 'clear gap between rows about 5.4 m; highest point 3 m',
    evidence: 'hypothesis (a planning drawing reference, not seen); the built capacity may need 4L or 2P' },
  { id: 'container-2p', label: 'Container inverter and transformer stations of about 3 MW at zone centres, 2 portrait, 20°',
    set: { layout: 'south', tiers: 2, orient: 'portrait', tableCols: null, tilt: 20, gcr: 0.5, edge: 0.85,
      inverterClass: 'string', inverterKVA: 300, invertersPerStation: 10, packing: 'fields' },
    ranges: 'tilt 10-30°; lowest edge 0.8-0.9 m; top at most 3 m; row gap 2-6 m; 20 ft or 40 ft containers',
    evidence: 'public design at three plants; the inverter class is not stated publicly (string inverters assumed here)' },
  { id: 'string-ew-bifacial', label: 'String inverters, east-west bifacial, tight gap, large field transformers',
    set: { layout: 'east-west', tiers: 1, orient: 'portrait', tableCols: null, tiltEw: 10, pitch: 6, moduleLong: 2.38, moduleShort: 1.3,
      wp: 660, voc: 46, inverterClass: 'string', inverterKVA: 300, invertersPerStation: 30, packing: 'fields' },
    ranges: 'gap between tables about 1 m; pitch about 6 m; two-sided cover about 0.79',
    evidence: 'public design at one plant; the 1 m gap was fitted, not measured' },
  { id: 'string-2p-modern', label: 'String inverters, 2 portrait bifacial, 690 W class, GCR about 0.5',
    set: { layout: 'south', tiers: 2, orient: 'portrait', tableCols: null, tilt: 22, gcr: 0.52, moduleLong: 2.38, moduleShort: 1.3,
      wp: 690, voc: 48, inverterClass: 'string', inverterKVA: 300, invertersPerStation: 20, packing: 'fields' },
    ranges: 'tilt 20-25°; GCR about 0.52; about 170 string inverters of 300 kVA for 50 MW',
    evidence: 'public counts at one plant; the table geometry is assumed' },
  { id: 'early-2p', label: 'Early small plant, 2 portrait, shallow pitch',
    set: { layout: 'south', tiers: 2, orient: 'portrait', tableCols: null, tilt: 20, gcr: 0.45, moduleLong: 1.65, moduleShort: 0.99, wp: 250, voc: 38 },
    ranges: 'tilt 16-22°; plan depth 2.0-4.1 m; pitch 4.9-6.3 m',
    evidence: 'measured as built at two small arrays' },
  { id: 'uk-dense', label: 'UK practice default: south, GCR 0.5-0.55, 15-20°, 5 m setback',
    set: { layout: 'south', tiers: 2, orient: 'portrait', tableCols: null, tilt: 18, gcr: 0.52, fence: 5, packing: 'fields' },
    ranges: 'GCR 0.5-0.55; tilt 15-20°; fence setback 5 m',
    evidence: 'fitted: brings capacity within about 3-11 % of public DC figures at four plants (capacity match only, not geometry)' }
]);
export const PRESET_IDS = PRESETS.map(s => s.id);
export const presetById = id => PRESETS.find(s => s.id === id) || null;

/** The presets in words (typed "preset" alone). */
export function presetText() {
  return ['Presets (type preset <name>):', ...PRESETS.map(s => `${s.id}: ${s.label}. ${s.ranges}. Evidence: ${s.evidence}.`), PRESET_NOTE].join('\n');
}
