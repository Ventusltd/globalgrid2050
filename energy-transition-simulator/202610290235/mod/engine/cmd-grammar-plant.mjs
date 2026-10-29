// COPIED UNCHANGED from the v12 world (web/world/cmd-grammar-plant.mjs) at v12 commit 3adcee9 (file last changed a83209f). Modular star family: not known to star-find.
// Do not edit here: change the source and re-copy. Everything below this header is byte-identical to the source.
// cmd-grammar-plant.mjs: the typed words for the plant's inverter class, its packing and the study presets.
//   inverter central 2500kva 2   central inverters of 2500 kVA, two to a station (MV skid or container)
//   inverter string 300kva 20    string inverters of 300 kVA, twenty to a station (the v09 plant)
//   packing fields | packing bands | packing band 400 run 280   how the tables fill the land (plant-packing.mjs)
//   preset central-6l-20          a generic preset from the UK study (structure-presets.mjs)
// Pure: imports only the presets' names.

import { PRESET_IDS } from './structure-presets.mjs';

export const PLANT_KEYS = Object.freeze({
  inverterClass: { label: 'inverter class', choices: ['string', 'central'] },
  inverterKVA: { label: 'inverter rating', unit: 'kVA', min: 100, max: 5000 },
  invertersPerStation: { label: 'inverters per station', unit: '', min: 1, max: 30, int: true },
  packing: { label: 'packing', choices: ['fields', 'bands'] },
  bandM: { label: 'distance between east-west tracks', unit: 'm', min: 100, max: 2000 },
  runM: { label: 'table run between cross lanes', unit: 'm', min: 30, max: 500 },
  hedge: { label: 'hedge setback between fields', unit: 'm', min: 2, max: 10 },
  moduleLong: { label: 'module length', unit: 'm', min: 1, max: 2.6 },
  moduleShort: { label: 'module width', unit: 'm', min: 0.6, max: 1.4 }
});
export const PLANT_COMMANDS = Object.freeze([
  { verb: 'inverter', usage: 'inverter central 2500kva 2  ·  inverter string 300kva 20',
    words: 'central string inverter skid container combiner box station kva class' },
  { verb: 'packing', usage: 'packing fields  ·  packing bands  ·  packing band 400 run 280',
    words: 'fill fields hedges parcels tracks bands runs cross lanes half tables land use' },
  { verb: 'preset', usage: 'preset  ·  preset central-6l-20  ·  preset uk-dense', words: 'study uk practice operational plant class landscape central' }
]);
export const PLANT_VOCAB = { inverter: ['central', 'string'], packing: ['fields', 'bands', 'band', 'run'] };
// A class switched without a rating takes the class's typical one: central 2500 kVA alone, string 300 kVA twenty.
const CLASS_DEFAULT = { central: [2500, 1], string: [300, 20] };

/** Parses inverter, packing and preset into out (set, act, arg); refusals go to bad. */
export function parsePlant(v, rest, out, { put, bad, isNum }) {
  const has = w => rest.includes(w);
  if (v === 'inverter') {
    const cls = has('central') ? 'central' : has('string') ? 'string' : null, ns = rest.filter(isNum);
    const kva = ns.find(x => x.unit === 'kva') || ns.find(x => !x.unit && x.n >= 100), per = ns.find(x => x !== kva && !x.unit);
    if (!cls && !kva && !per) { bad.push('inverter takes central or string, a rating in kVA and inverters per station, such as inverter central 2500kva 2'); return; }
    if (ns.some(x => x.unit && x.unit !== 'kva')) { bad.push('the inverter rating is in kVA, such as inverter central 2500kva'); return; }
    if (cls) put('inverterClass', cls);
    const c = cls || null, k = kva ? kva.n : c ? CLASS_DEFAULT[c][0] : null, n = per ? per.n : c ? CLASS_DEFAULT[c][1] : null;
    if (k != null) put('inverterKVA', k);
    if (n != null) put('invertersPerStation', n);
    if (c === 'central' && ((k != null && (k < 500 || k > 5000)) || (n != null && n > 4))) bad.push('a central inverter is 500 to 5000 kVA, 1 to 4 to a station');
    if (c === 'string' && ((k != null && (k < 100 || k > 400)) || (n != null && n < 8))) bad.push('a string inverter is 100 to 400 kVA, 8 to 30 to a station');
  } else if (v === 'packing') {
    if (has('fields')) put('packing', 'fields');
    if (has('bands')) put('packing', 'bands');
    const at = w => { const i = rest.indexOf(w); return i >= 0 && isNum(rest[i + 1]) ? rest[i + 1].n : null; };
    if (at('band') != null) put('bandM', at('band'));
    if (at('run') != null) put('runM', at('run'));
    if (!Object.keys(out.set).length && !bad.length) bad.push('packing is fields or bands, with band N and run N in metres, such as packing band 400 run 280');
  } else if (v === 'preset') {
    const w = rest.filter(x => typeof x === 'string').join('').replace(/-/g, ''), id = PRESET_IDS.find(k => k.replace(/-/g, '') === w);
    if (w && !id) bad.push(`no preset "${w}"; the presets are ${PRESET_IDS.join(', ')} (type preset for the list)`);
    out.act = 'structure'; out.arg = { id: id || null, preset: true };
  }
}
