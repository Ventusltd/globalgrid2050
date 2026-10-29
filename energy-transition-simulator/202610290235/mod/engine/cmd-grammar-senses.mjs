// COPIED UNCHANGED from the v12 world (web/world/cmd-grammar-senses.mjs) at v12 commit 3adcee9 (file last changed b6ebfdb). Modular star family: not known to star-find.
// Do not edit here: change the source and re-copy. Everything below this header is byte-identical to the source.
// cmd-grammar-senses.mjs: the binoculars words of the command line (binoculars, zoom, range), split out of cmd-grammar.mjs
// to keep each cartridge under 400 lines. Pure: parse() hands each verb here with its words. They change no design value
// and stay out of the typed script; the engine (cmd-run.mjs) hands them to senses-mount.mjs.

export const SENSES_COMMANDS = Object.freeze([
  { verb: 'binoculars', usage: 'binoculars on  ·  binoculars off', words: 'binocular lens zoom magnify far horizon look distance rangefinder' },
  { verb: 'zoom', usage: 'zoom 7  ·  zoom 10', words: 'binoculars magnification lens times' },
  { verb: 'range', usage: 'range', words: 'rangefinder distance bearing height what is under the reticle horizon binoculars' }
]);
export const SENSES_VOCAB = Object.freeze({ binoculars: ['on', 'off'], zoom: ['7x', '10x', 'x'], range: [] });
export const SENSES_ALIASES = Object.freeze([['binocular', 'binoculars'], ['rangefinder', 'range']]);
const STEPS = [7, 10];
const isNum = t => t && typeof t === 'object' && Number.isFinite(t.n);

/** parseSenses(v, rest, bad) -> { act: 'binoculars', arg: { on?, zoom?, range? } } or null (refused; the reason pushed on bad). */
export function parseSenses(v, rest, bad) {
  if (v === 'binoculars') return { act: 'binoculars', arg: { on: !rest.includes('off') } };
  if (v === 'range') return { act: 'binoculars', arg: { range: true } };
  const n = rest.find(isNum), w = rest.find(x => typeof x === 'string' && /^\d+x$/.test(x));
  const m = n ? n.n : w ? Number(w.slice(0, -1)) : NaN;
  if (!STEPS.includes(m)) { bad.push(`zoom is ${STEPS.join(' or ')} (the binoculars' steps)${Number.isFinite(m) ? `; you typed ${m}` : ''}`); return null; }
  return { act: 'binoculars', arg: { zoom: m } };
}
