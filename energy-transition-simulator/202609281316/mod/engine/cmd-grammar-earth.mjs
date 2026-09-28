// COPIED UNCHANGED from the v12 world (web/world/cmd-grammar-earth.mjs) at v12 commit 3adcee9 (file last changed 8903e78). Modular star family: public #148228 parseEarth.
// Do not edit here: change the source and re-copy. Everything below this header is byte-identical to the source.
// cmd-grammar-earth.mjs: the earthing words of the command line (earthing, earth, soil rho, bonding), split out of
// cmd-grammar.mjs to keep each cartridge under 400 lines. Pure: parse() hands each verb here with its words.

// Earthing settings (typed, checked like KEYS; held by the earthing cartridge, earth-mount.mjs).
export const EARTH_KEYS = Object.freeze({ mesh: { label: 'earth grid mesh spacing', unit: 'm', min: 2, max: 20 },
  ring: { label: 'earth ring depth', unit: 'm', min: 0.3, max: 2 }, rods: { label: 'rods per station', unit: 'rods', min: 0, max: 40, int: true },
  rodLength: { label: 'rod length', unit: 'm', min: 1.2, max: 12 }, target: { label: 'earth resistance target', unit: 'Ω', min: 0.1, max: 50 },
  split: { label: 'split factor', unit: '', min: 0.05, max: 1 }, rho: { label: 'soil resistivity', unit: 'Ω·m', min: 1, max: 10000 } });

// The earthing verbs for help and search, and their plain words (longest first; the grammar applies them to whole words).
export const EARTH_COMMANDS = Object.freeze([
  { verb: 'earthing', usage: 'earthing show  ·  earthing hide  ·  earthing dc floating  ·  earthing dc earthed',
    words: 'earth electrode rod ring grid mesh bonding touch step epr resistance layer' },
  { verb: 'earth', usage: 'earth grid 5m  ·  earth ring 0.6m  ·  earth rods 4 2.4m  ·  earth target 2  ·  earth split 0.5',
    words: 'earthing electrode rod ring grid mesh spacing depth target resistance split factor substation station' },
  { verb: 'bonding', usage: 'bonding single-point  ·  bonding both-ends  ·  bonding cross  ·  bonding auto', words: 'cable screen sheath svl link box ecc earthing' },
]);
export const EARTH_ALIASES = Object.freeze([
  ['soil thermal resistivity', 'soil'], ['thermal resistivity', 'soil'], ['soil resistivity', 'soil rho'],
  ['earth grid', 'earth mesh'], ['earthing grid', 'earth mesh'], ['cross bonded', 'cross'], ['cross-bonded', 'cross'],
  ['cross bonding', 'cross'], ['single point', 'single-point'], ['both ends', 'both-ends'], ['ohm m', 'ohmm'], ['ohm-m', 'ohmm'], ['ohm.m', 'ohmm'],
  ['ohms', 'ohm'], ['resistivity', 'rho'], ['solid', 'both-ends'], ['bond', 'bonding']
]);

const isNum = t => t && typeof t === 'object' && Number.isFinite(t.n);

/** soil N alone (or in K.m/W) is the cable rating's thermal resistivity, not an earthing word. */
export const isThermalSoil = rest => !rest.includes('rho') && !rest.includes('survey') && !rest.some(x => isNum(x) && /^ohm/.test(x.unit || ''));

/**
 * parseEarth(v, rest, bad, eg) -> { act, arg } or null (refused; the reason pushed on bad).
 * v: earthing | earth | soil | bonding; rest: the words and numbers after it; eg(what): an example for the verb.
 */
export function parseEarth(v, rest, bad, eg) {
  const has = w => rest.includes(w);
  if (v === 'earthing' && has('dc')) {   // the DC array's earthing: floating (the default) or one pole earthed
    const d = ['floating', 'earthed'].find(has);
    if (!d) { bad.push('earthing dc takes floating or earthed'); return null; }
    return { act: 'earthing', arg: { what: 'dc', value: d } };
  }
  if (v === 'earthing') return { act: 'earthing', arg: { what: has('hide') ? 'hide' : 'show' } };
  if (v === 'bonding') {
    const b = ['single-point', 'both-ends', 'cross', 'auto'].find(has);
    if (!b) { bad.push('bonding takes single-point, both-ends, cross or auto'); return null; }
    return { act: 'earthing', arg: { what: 'bonding', value: b } };
  }
  const what = v === 'soil' ? (has('survey') ? 'survey' : 'rho') : ['mesh', 'ring', 'rods', 'target', 'split'].find(has);
  if (!what) { bad.push('earth takes grid, ring, rods, target or split, e.g. earth grid 5m'); return null; }
  const ns = rest.filter(isNum);
  const chk = (k, x) => { const K = EARTH_KEYS[k], n = x.unit === 'cm' ? x.n / 100 : x.unit === 'mm' ? x.n / 1000 : x.n;
    const ok = n >= K.min && n <= K.max && (!K.int || Math.round(n) === n);
    if (!ok) bad.push(`${K.label} must be ${K.int ? 'a whole number' : 'a number'} from ${K.min} to ${K.max}${K.unit ? ' ' + K.unit : ''}; you typed ${x.n}${x.unit}`);
    return n; };
  const out = { act: 'earthing', arg: { what: what === 'mesh' ? 'grid' : what, value: null, value2: null } };
  if (what === 'survey') return out;
  if (!ns.length && what !== 'mesh') { bad.push(`${v} ${what} needs a number, e.g. ${eg(what)}`); return null; }
  if (ns[0]) out.arg.value = chk(what, ns[0]);
  if (what === 'rods' && ns[1]) out.arg.value2 = chk('rodLength', ns[1]);
  return out;
}
