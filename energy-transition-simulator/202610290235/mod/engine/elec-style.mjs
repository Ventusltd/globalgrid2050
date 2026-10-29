// COPIED UNCHANGED from the v12 world (web/world/elec-style.mjs) at v12 commit 3adcee9 (file last changed fdfcbc4). Modular star family: public #148422 rgba.
// Do not edit here: change the source and re-copy. Everything below this header is byte-identical to the source.
// elec-style.mjs: one table for what an electrical line looks like, by voltage level (e4 UI spec, section 3). The 3D
// symbols (sld-symbols.mjs), the solar block's cables (block-ui.mjs, block-gpu.mjs), the SLD panel's classes
// (sld-view.mjs) and the legend (legend-ui.mjs) all read it; no hex colour for an electrical class lives anywhere else.
// Colour means voltage level; red means only "open" or "check". Earth has its own colour and always a dash as well, so it
// reads without colour (colour-blind, print). Conductor-core identification colours are for core labels in text only.
// Pure: no DOM.

// key, words for the legend, colour, SVG dash (null: solid), SLD class.
export const ELEC_CLASSES = Object.freeze([
  { key: 'hv', label: 'HV AC, 132 / 275 / 400 kV', hex: '#9cdbff', dash: null, cls: 'ln' },
  { key: 'mv', label: '33 kV collection', hex: '#ffa050', dash: null, cls: 'mv' },
  { key: 'lv', label: 'LV AC, inverter to station', hex: '#8cffa0', dash: null, cls: 'lv' },
  { key: 'dc', label: 'DC strings and home runs, 1.5 kV class', hex: '#d59cff', dash: null, cls: 'dc' },
  { key: 'earth', label: 'Earth conductors and electrodes', hex: '#d8d89a', dash: '6 3', cls: 'ea' },
  { key: 'bond', label: 'Bonding links', hex: '#d8d89a', dash: '2 3', cls: 'bd' },
  { key: 'open', label: 'Normally-open point, open switch', hex: '#ff5a4a', dash: '5 4', cls: 'op' },
  { key: 'glow', label: 'Follow path', hex: '#c0ffff', dash: null, cls: 'hl' }
].map(Object.freeze));

export const ELEC = Object.freeze(Object.fromEntries(ELEC_CLASSES.map(c => [c.key, c])));

// Every electrical readout ends with this line (re-exported by sld-rules.mjs for the earthing and SLD readouts).
export const ELEC_FOOTER = 'Illustrative — early design, no warranty; confirm with a qualified engineer.';

/** rgba('dc', 0.9) -> [r, g, b, a] in 0..1, for a line batch. */
export function rgba(key, a = 1) {
  const h = ELEC[key]?.hex;
  if (!h) throw Error('elec-style: no class ' + key);
  return [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).concat(a);
}

/** CSS for an SVG drawing under `scope`: each class's stroke and dash, from the table. */
export const elecCss = scope => ELEC_CLASSES.filter(c => c.key !== 'glow')
  .map(c => `${scope} .${c.cls} { stroke: ${c.hex};${c.dash ? ` stroke-dasharray: ${c.dash};` : ''} }`).join('\n');
