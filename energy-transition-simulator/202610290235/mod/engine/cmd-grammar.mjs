// COPIED UNCHANGED from the v12 world (web/world/cmd-grammar.mjs) at v12 commit 3adcee9 (file last changed 0562d4f). Modular star family: public #20973 guard.
// Do not edit here: change the source and re-copy. Everything below this header is byte-identical to the source.
// cmd-grammar.mjs: the typed design language of the site world. One line is one command; parse(line) turns it into
// { verb, set: { key: value }, act, arg } or refuses it in words. Pure: no DOM; imports only its earthing words.
//
// Patterns taken from the Kuiper shell's typed bar (globalgrid2050 kuiper-grid i0097 programs): one input table
// (KEYS: label, unit, min, max) drives the guard and the echo; an alias table maps plain words onto keys; a value
// outside its range is refused, never clamped ("gcr must be a number from 0.2 to 0.8; you typed 4"), and a value
// that fits once divided by 1000 or 100 is named as a likely unit slip; plain-word search needs every word to match.
// Imports pure word tables: table formats and structure names, the plant's inverter, packing and preset words.
import { parseFormat, formatRefusal, STRUCTURE_IDS } from './structures.mjs';
import { PLANT_KEYS, PLANT_COMMANDS, PLANT_VOCAB, parsePlant } from './cmd-grammar-plant.mjs';
import { PRESET_IDS } from './structure-presets.mjs';
import { TRENCH_KEYS_TYPED, TRENCH_COMMANDS, TRENCH_VOCAB, SPLIT_KINDS, COVER_KINDS, parseTrench } from './cmd-grammar-trench.mjs';
import { EARTH_KEYS, EARTH_COMMANDS, EARTH_ALIASES, parseEarth, isThermalSoil } from './cmd-grammar-earth.mjs';
import { SENSES_COMMANDS, SENSES_VOCAB, SENSES_ALIASES, parseSenses } from './cmd-grammar-senses.mjs';
import { SUB_COMMANDS, parseSubCommand } from './sub-grammar.mjs'; import { parseConnect } from './connect-here.mjs'; // go substation 132 · connect here
import { REPD_COMMANDS, parseRepd } from './repd-grammar.mjs'; export { EARTH_KEYS, SPLIT_KINDS, COVER_KINDS }; // REPD: go solar, next bess
export const KEYS = Object.freeze({
  mw: { label: 'plant export', unit: 'MW', min: 1, max: 5000 },
  layout: { label: 'layout', choices: ['south', 'east-west', 'tracker'] },
  tilt: { label: 'tilt', unit: '°', min: 5, max: 40 },
  tiltEw: { label: 'east-west tilt', unit: '°', min: 3, max: 20 },
  pitch: { label: 'row pitch', unit: 'm', min: 3, max: 40 },
  gcr: { label: 'ground cover ratio', unit: '', min: 0.2, max: 0.8 },
  edge: { label: 'lowest module edge', unit: 'm', min: 0.3, max: 2.5 },
  mps: { label: 'modules per string', unit: 'modules', min: 10, max: 40, int: true },
  wp: { label: 'module power', unit: 'W', min: 200, max: 800 },
  voc: { label: 'module open-circuit voltage', unit: 'V', min: 20, max: 80 },
  tempMin: { label: 'coldest cell temperature', unit: '°C', min: -40, max: 15 },
  fence: { label: 'fence setback', unit: 'm', min: 5, max: 10 },
  water: { label: 'watercourse setback', unit: 'm', min: 0, max: 100 },
  slope: { label: 'slope limit', unit: '%', min: 1, max: 40 },
  depth: { label: 'trench depth', unit: 'm', min: 0.45, max: 3 },
  width: { label: 'trench width', unit: 'm', min: 0.25, max: 3 },
  formation: { label: 'cable formation', choices: ['trefoil', 'flat'] },
  size: { label: 'cable size', unit: 'mm²', choices: [35, 50, 70, 95, 120, 150, 185, 240, 300, 400, 500, 630, 800, 1000] },
  metal: { label: 'conductor', choices: ['al', 'cu'] },
  wiring: { label: 'string wiring', choices: ['standard', 'leapfrog'] },
  avoidOhl: { label: 'overhead line zones kept clear', choices: [true, false] },
  stations: { label: 'block size', unit: 'MVA', min: 10, max: 100 },
  pocKv: { label: 'grid connection', unit: 'kV', choices: [132, 275, 400] },
  ...TRENCH_KEYS_TYPED,
  // Structures (structures.mjs): table format, post lines, tracker strings a row, the row gap rule, the MPPT cap, post height.
  tiers: { label: 'modules up the table', unit: '', min: 1, max: 6, int: true },
  orient: { label: 'module orientation', choices: ['portrait', 'landscape'] },
  tableCols: { label: 'modules along each tier', unit: 'modules', min: 4, max: 40, int: true },
  posts: { label: 'post lines per table', choices: [1, 2] },
  trackerStrings: { label: 'strings per tracker row', unit: 'strings', min: 1, max: 4, int: true },
  rowGap: { label: 'row gap rule', choices: ['flat', 'slope'] },
  mppts: { label: 'MPPT inputs per inverter', unit: '', min: 1, max: 24, int: true },
  stringsPerMppt: { label: 'strings per MPPT input', unit: '', min: 1, max: 6, int: true },
  postMax: { label: 'post height limit', unit: 'm', min: 1.5, max: 6 },
  gcrTracker: { label: 'tracker ground cover ratio', unit: '', min: 0.2, max: 0.6 },
  ...PLANT_KEYS // inverter class, packing, hedge setback, module size (cmd-grammar-plant.mjs)
});

// Every verb, with a usage line and plain words for the search and for help.
export const COMMANDS = Object.freeze([
  { verb: 'plant', usage: 'plant 100mw south', words: 'lay out solar farm capacity export east-west tracker open land' },
  { verb: 'fill', usage: 'fill boundary', words: 'lay out inside the drawn boundary' },
  { verb: 'boundary', usage: 'boundary 399000 208500, 399800 208500, 399800 209200', words: 'site outline national grid corners' },
  { verb: 'table', usage: 'table 2P27 portrait tilt 25  ·  table 3P12 tilt 15  ·  table 4L12 single  ·  table 2P tracker',
    words: 'rows of modules string length portrait landscape tiers format 3P 4P 3L 4L 6L half' },
  { verb: 'module', usage: 'module 600w voc 50', words: 'panel power open circuit voltage' },
  { verb: 'string', usage: 'string 28  ·  modules per string 28  ·  series 28', words: 'modules in series string length voltage headroom' },
  { verb: 'temp', usage: 'temp min -10', words: 'coldest cell temperature minimum site cold open circuit voltage' },
  { verb: 'tilt', usage: 'tilt 20', words: 'panel angle sun' },
  { verb: 'pitch', usage: 'pitch 7  ·  row width 7', words: 'row spacing shade coverage' },
  { verb: 'gcr', usage: 'gcr 0.4', words: 'ground cover ratio coverage spacing' },
  { verb: 'edge', usage: 'edge 0.8', words: 'lowest module edge clearance grazing' },
  ...TRENCH_COMMANDS,
  { verb: 'soil', usage: 'soil 1.2  ·  soil rho 100  ·  soil rho survey',
    words: 'soil thermal resistivity ground rating dry sand clay ohm metre earthing wenner survey' },
  { verb: 'bend', usage: 'bend radius', words: 'cable minimum bend radius corner' },
  { verb: 'wiring', usage: 'wiring leapfrog', words: 'string dc loop leapfrog standard inductive' },
  { verb: 'loop', usage: 'loop area', words: 'inductive loop string area lightning' },
  { verb: 'piles', usage: 'piles auto', words: 'piling foundations posts automatic' },
  { verb: 'block', usage: 'block 10mva', words: 'station block 10 mva rings' },
  { verb: 'follow', usage: 'follow  ·  follow next  ·  follow play  ·  follow close', words: 'power path module to the grid landing trace' },
  { verb: 'sld', usage: 'sld  ·  sld hide', words: 'single line diagram schematic stations feeders' },
  { verb: 'go', usage: 'go block  ·  go block 3 table 5  ·  go compound  ·  go <place>', words: 'fly to station table compound solar block place town postcode find' },
  { verb: 'show', usage: 'show pylons  ·  show water  ·  show slope 10%  ·  show soil', words: 'layer overhead lines rivers gradient geology' },
  { verb: 'hide', usage: 'hide slope', words: 'layer off' },
  { verb: 'avoid', usage: 'avoid slope 15%  ·  avoid pylons on', words: 'constraint gradient overhead lines keep clear' },
  { verb: 'setback', usage: 'setback water 10  ·  setback fence 8', words: 'watercourse stand-off fence' },
  ...EARTH_COMMANDS, ...SENSES_COMMANDS, ...REPD_COMMANDS, ...SUB_COMMANDS,
  { verb: 'hud', usage: 'hud on  ·  hud off  ·  hud rules', words: 'checks failed red overlay private rules file' },
  { verb: 'structure', usage: 'structure  ·  structure tracker-2p  ·  structure fixed-2p', words: 'mounting class catalogue frame tracker fixed agrivoltaic' },
  ...PLANT_COMMANDS,
  { verb: 'posts', usage: 'posts single  ·  posts twin  ·  posts max 3', words: 'single post line mono twin front rear pile height limit' },
  { verb: 'tracker', usage: 'tracker 3 strings  ·  tracker 2p', words: 'single axis rows strings per row torque tube' },
  { verb: 'rowgap', usage: 'rowgap slope  ·  rowgap flat', words: 'row gap slope aware north facing shade winter pitch' },
  { verb: 'mppt', usage: 'mppt 12 inputs 2', words: 'inverter mppt inputs strings per inverter cap dc ac ratio' },
  { verb: 'undo', usage: 'undo', words: 'take back the last command' },
  { verb: 'script', usage: 'script', words: 'list typed commands design' },
  { verb: 'help', usage: 'help pitch', words: 'commands how' }
]);
const VERBS = COMMANDS.map(c => c.verb);

// Plain words to the language's own, longest first. Applied to whole words only.
export const ALIASES = Object.freeze([
  ['strings per mppt', 'inputs'], ['strings per input', 'inputs'], ['row gap', 'rowgap'], ['slope-aware', 'slope'], ['slope aware', 'slope'],
  ['single post line', 'posts single'], ['single post', 'posts single'], ['mono post', 'posts single'], ['twin posts', 'posts twin'],
  ['modules per string', 'string'], ['modules in series', 'string'], ['modules in a string', 'string'], ['string length', 'string'],
  ['coldest cell temperature', 'temp'], ['coldest cell', 'temp'], ['minimum temperature', 'temp'], ['min temp', 'temp'], ['temp min', 'temp'],
  ['temperature', 'temp'], ['coldest', 'temp'], ['series', 'string'], ['mps', 'string'],
  ...EARTH_ALIASES, ...SENSES_ALIASES,
  ['single line diagram', 'sld'], ['single-line diagram', 'sld'],
  ['lowest module edge', 'edge'], ['ground cover ratio', 'gcr'], ['overhead lines', 'pylons'], ['overhead line', 'pylons'],
  ['power lines', 'pylons'], ['inductive loops', 'loop'], ['inductive loop', 'loop'], ['row width', 'pitch'], ['row pitch', 'pitch'],
  ['row spacing', 'pitch'], ['lowest edge', 'edge'], ['low edge', 'edge'], ['panel angle', 'tilt'], ['bend radius', 'bend'],
  ['loop area', 'loop'], ['string wiring', 'wiring'], ['ground cover', 'gcr'], ['go to', 'go'], ['fly to', 'go'], ['lay out', 'plant'],
  ['east west', 'eastwest'], ['east-west', 'eastwest'], ['fence setback', 'setback fence'], ['water setback', 'setback water'],
  ['spacing', 'pitch'], ['angle', 'tilt'], ['clearance', 'edge'], ['goto', 'go'], ['fly', 'go'], ['capacity', 'plant'],
  ['pile', 'piles'], ['piling', 'piles'], ['ohl', 'pylons'], ['towers', 'pylons'], ['pylon', 'pylons'], ['grid', 'pylons'],
  ['rivers', 'water'], ['river', 'water'], ['watercourses', 'water'], ['watercourse', 'water'], ['streams', 'water'],
  ['gradients', 'slope'], ['gradient', 'slope'], ['slopes', 'slope'], ['geology', 'soil'], ['soils', 'soil'], ['ew', 'eastwest'],
  ['solar day', 'solar-day'], ['as built', 'xray'], ['as-built', 'xray'], ['x-ray', 'xray'],
  ['aluminium', 'al'], ['aluminum', 'al'], ['copper', 'cu'], ['sequential', 'standard'], ['station', 'block'], ['commands', 'help'], ['diagram', 'sld'], ['trace', 'follow'], ['trackers', 'tracker']
]);

const r = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
const said = v => (typeof v === 'string' ? `"${v}"` : String(v));
const UNIT_WORDS = ['mw', 'mva', 'kva', 'mm2', 'mm²', 'mm', 'cm', 'm', '%', 'w', 'v', 'kv', 'deg', '°', '°c', 'c', 'ohmm', 'ohm'];
const NUM = /^([-−]?(?:\d+(?:\.\d+)?|\.\d+))(mw|mva|kva|mm2|mm²|mm|cm|m|%|w|v|kv|deg|°c|°|c|ohmm|ohm)?$/;
/** Checks one typed value against KEYS; returns null or the refusal in words. */
export function guard(key, v) {
  const k = KEYS[key];
  if (!k) return `unknown setting ${key}`;
  if (k.choices) {
    if (k.choices.includes(v)) return null;
    return `${k.label} must be one of ${k.choices.map(String).join(', ')}${k.unit ? ' ' + k.unit : ''}; you typed ${said(v)}`;
  }
  if (typeof v !== 'number' || !Number.isFinite(v)) return `${k.label} must be a number; you typed ${said(v)}`;
  if (k.int && Math.round(v) !== v) return `${k.label} must be a whole number from ${k.min} to ${k.max}; you typed ${v}`;
  if (v >= k.min && v <= k.max) return null;
  if (k.int) return `${k.label} must be a whole number from ${k.min} to ${k.max}; you typed ${v}`;   // a count: no unit to have mistyped
  let hint = '';
  for (const [f, why] of key === 'tempMin' ? [] : [[1000, 'you may have typed millimetres'], [100, key === 'gcr' ? 'a percentage' : 'you may have typed centimetres']]) {
    const g = v / f;
    if (g >= k.min && g <= k.max) { hint = ` Did you mean ${r(g, 3)}${k.unit ? ' ' + k.unit : ''}? (${why})`; break; }
  }
  return `${k.label} must be a number from ${k.min} to ${k.max}${k.unit ? ' ' + k.unit : ''}; you typed ${v}${hint ? '.' + hint : ''}`;
}

/** Lower-case words with the aliases applied; numbers keep their unit as { n, unit }. */
export function words(line) {
  let s = ` ${String(line || '').toLowerCase().replace(/#.*$/, '').replace(/[,;]/g, ' , ').replace(/\s+/g, ' ').trim()} `;
  s = s.replace(/ω·m|ωm|ω\.m/g, 'ohmm').replace(/ω/g, 'ohm'); // Ω typed (lower-cased to ω): 2Ω, 100 Ω·m
  for (const [a, b] of ALIASES) s = s.split(` ${a} `).join(` ${b} `);
  const t = s.trim().split(' ').filter(Boolean);
  // "50 MW", "7 m", "15 %": a unit written apart joins its number.
  for (let i = t.length - 1; i > 0; i--) if (UNIT_WORDS.includes(t[i]) && /^-?(\d+(\.\d+)?|\.\d+)$/.test(t[i - 1])) t.splice(i - 1, 2, t[i - 1] + t[i]);
  return t.map(w => { const m = w.match(NUM); return m ? { n: Number(m[1].replace('−', '-')), unit: m[2] || '' } : w; });
}
/** Plain-word search over the commands: every word typed must appear in the usage or the words; usage matches first. At most 8. */
export function search(text, limit = 8) {
  const ws = String(text || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!ws.length) return COMMANDS.slice(0, limit);
  const hay = c => `${c.verb} ${c.usage} ${c.words}`.toLowerCase();
  const exact = COMMANDS.filter(c => c.verb === ws[0] || c.verb.startsWith(ws[0]));
  const rest = COMMANDS.filter(c => !exact.includes(c) && ws.every(w => hay(c).includes(w)))
    .map((c, i) => [c, ws.filter(w => c.usage.includes(w)).length, i]).sort((a, b) => b[1] - a[1] || a[2] - b[2]).map(x => x[0]);
  return [...exact, ...rest].slice(0, limit);
}
/** The usage of a command that best shows the words typed ("slope" -> "avoid slope 15%"). */
export const example = (c, text = '') => { const vs = c.usage.split('  ·  '), w = String(text).toLowerCase().split(/\s+/)[0]; return vs.find(v => w && v.includes(w)) || vs[0]; };
const refuse = (why, line) => ({ ok: false, why, line });
// The words each verb reads besides numbers; any other word is refused, never dropped ("plant 50mw north").
const VOCAB = { plant: ['south', 'eastwest', 'tracker'], fill: ['boundary', 'south', 'eastwest', 'tracker'],
  boundary: ['open', ','], table: ['portrait', 'landscape', 'tilt', 'eastwest', 'tracker', 'single', 'twin', 'south'],
  posts: ['single', 'twin', 'max'], tracker: ['strings', 'string'], rowgap: ['slope', 'flat'], mppt: ['inputs', 'x'],
  module: ['voc', 'size'], string: ['modules'], temp: ['min', 'cell'], ...PLANT_VOCAB,
  ...TRENCH_VOCAB, ...SENSES_VOCAB, wiring: ['leapfrog', 'standard'], piles: ['auto'],
  follow: ['next', 'back', 'play', 'pause', 'close'], sld: ['hide', 'show'], hud: ['on', 'off', 'rules'],
  block: ['poc', 'at'], go: ['block', 'table', 'compound'], show: ['pylons', 'water', 'slope', 'soil', 'earthing'], hide: ['pylons', 'water', 'slope', 'soil', 'earthing'],
  earthing: ['show', 'hide', 'dc', 'floating', 'earthed'], earth: ['mesh', 'ring', 'rods', 'target', 'split'], soil: ['rho', 'survey'], bonding: ['single-point', 'both-ends', 'cross', 'auto'],
  avoid: ['slope', 'pylons', 'water', 'on', 'off'], setback: ['water', 'fence', 'hedge'] };
const isNum = t => t && typeof t === 'object' && Number.isFinite(t.n);

/**
 * parse(line) -> { ok: true, verb, set, act, arg, line } | { ok: false, why, line }
 *   set: typed values by KEYS key (already guarded); act: 'layout' | 'fill' | 'boundary' | 'block' | 'piles' | 'go' | 'show' | 'follow' | 'sld'
 *   | 'explain' | 'undo' | 'help' | 'script' | null; arg: what the act needs.
 */
export function parse(line) {
  const t = words(line), hop = parseSubCommand(line) || parseRepd(line) || parseConnect(line); if (hop) return hop; // journey, then REPD, then connect here
  if (!t.length) return refuse('nothing typed', line);
  if (t[0] === 'set' && t.length > 1) t.shift(); // "set pitch 7" is "pitch 7"
  let [v, ...rest] = t;
  if (typeof v !== 'string') return refuse(`a command starts with a word, such as ${VERBS.slice(0, 4).join(', ')}; type help for all`, line);
  if (!VERBS.includes(v)) {
    const c = VERBS.filter(x => x.startsWith(v));
    if (c.length === 1) v = c[0];
    else if (c.length > 1) return refuse(`"${v}" could be ${c.join(', ')}; type more letters`, line);
    else {
      const s = search(v, 3).map(x => example(x, v));
      return refuse(`"${v}" is not a command.${s.length ? ` Try ${s.join(', ')}.` : ''} Type help for all.`, line);
    }
  }
  const out = { ok: true, verb: v, set: {}, act: null, arg: {}, line: String(line).trim() };
  // go <place>: words go looks up in Find (a town, a postcode, a grid reference), not a block or a table.
  if (v === 'go' && rest.some(w => typeof w === 'string' && !(VOCAB.go || []).includes(w)) && !rest.includes('block')) {
    const place = String(line).trim().replace(/^\s*(go\s+to|goto|fly\s+to|fly|go)\s+/i, '').trim();
    return { ok: true, verb: 'go', set: {}, act: 'find', arg: { place }, line: String(line).trim() };
  }
  const bad = [], stray = ['help', 'structure', 'preset'].includes(v) ? [] : rest.filter(w => typeof w === 'string' && !(VOCAB[v] || []).includes(w) && !/^\d[pl]\d*$/.test(w));
  if (stray.length) {
    const takes = (VOCAB[v] || []).filter(w => w !== ',');
    return refuse(`${v} does not read "${stray[0]}"; ${takes.length ? `it takes ${takes.join(', ')} and numbers` : 'it takes a number'}`
      + ` (e.g. ${example(COMMANDS.find(c => c.verb === v))}). Nothing was changed.`, line);
  }
  const put = (key, val) => { const g = guard(key, val); if (g) bad.push(g); else out.set[key] = val; };
  const num = (i, key, units = []) => {
    let x = rest[i];
    if (isNum(x) && KEYS[key].unit === 'm' && (x.unit === 'cm' || x.unit === 'mm')) x = { n: x.n / (x.unit === 'cm' ? 100 : 1000), unit: 'm' };
    if (!isNum(x)) {
      const said = `${v} ${rest.slice(0, i).filter(w => typeof w === 'string').join(' ')}`.trim(), c = COMMANDS.find(k => k.verb === v);
      const eg = c.usage.split('  ·  ').find(u => u.startsWith(said + ' ')) || example(c);
      bad.push(`${said} needs a number, e.g. ${eg}`); return;
    }
    if (x.unit && units.length && !units.includes(x.unit)) { bad.push(`${KEYS[key].label} is in ${units[0] || KEYS[key].unit}; you typed ${x.n}${x.unit}`); return; }
    put(key, x.n);
  };
  const after = w => { const i = rest.indexOf(w); return i < 0 ? -1 : i + 1; };
  const has = w => rest.includes(w);
  switch (v) {
    case 'plant': case 'fill': {
      const n = rest.find(isNum);
      if (n) { if (n.unit && n.unit !== 'mw') bad.push(`plant capacity is in MW; you typed ${n.n}${n.unit}`); else put('mw', n.n); }
      if (has('south')) put('layout', 'south');
      if (has('eastwest')) put('layout', 'east-west');
      if (has('tracker')) put('layout', 'tracker');
      out.act = v === 'fill' ? 'fill' : 'layout';
      break;
    }
    case 'boundary': {
      if (has('open')) { out.act = 'boundary'; out.arg = { open: true }; break; }
      const pts = [];
      let cur = [];
      for (const x of [...rest, ',']) {
        if (x === ',') { if (cur.length) { pts.push(cur); cur = []; } continue; }
        if (isNum(x)) cur.push(x.n); else { bad.push(`boundary points are "easting northing" pairs in metres; "${x}" is not a number`); break; }
      }
      if (pts.some(p => p.length !== 2)) bad.push('each boundary corner is two numbers, easting then northing, separated by commas');
      else if (pts.length < 3) bad.push('a boundary needs at least three corners');
      else if (pts.some(([e, n]) => !(e > 0 && e < 700000 && n > 0 && n < 1300000))) bad.push('boundary corners are national-grid metres (easting 0 to 700000)');
      out.act = 'boundary'; out.arg = { points: pts };
      break;
    }
    case 'table': {
      // kPn / kLn (structures.mjs): n is the string length for 2P south, 1P east-west and trackers; for 3P, 3L and 4L it
      // is the modules along each tier (strings then run on across tables).
      const f = rest.find(w => typeof w === 'string' && /^\d[pl]\d*$/.test(w)), F = parseFormat(f);
      if (F) {
        const lay = has('tracker') ? 'tracker' : has('eastwest') ? 'east-west' : has('south') || F.tiers > 1 ? 'south' : 'east-west';
        const no = formatRefusal(lay, F.tiers, F.orient);
        if (no) bad.push(no);
        else {
          put('layout', lay); put('tiers', F.tiers); put('orient', F.orient);
          const own = lay === 'south' && !(F.tiers === 2 && F.orient === 'portrait'); // 3P, 3L, 4L: n along each tier
          if (F.cols !== null) put(own ? 'tableCols' : 'mps', F.cols);
          if (!own) out.set.tableCols = null;
        }
        if (has('landscape') && F.orient === 'portrait') bad.push(`${f.toUpperCase()} is portrait; landscape tables are 3L to 6L, such as table 4L12`);
      } else if (has('landscape')) bad.push('landscape takes a format: table 3L12, table 4L26 or table 6L12');
      else if (has('eastwest')) put('layout', 'east-west');
      if (has('single')) put('posts', 1);
      if (has('twin')) put('posts', 2);
      if (after('tilt') > 0) num(after('tilt'), (out.set.layout || '') === 'east-west' ? 'tiltEw' : 'tilt', ['°', 'deg']);
      if (!f && after('tilt') < 0 && !has('eastwest') && !has('single') && !has('twin')) bad.push('table needs a format, such as table 2P27 portrait tilt 25');
      break;
    }
    case 'structure': {
      const w = rest.filter(x => typeof x === 'string').join('').replace(/-/g, ''), id = [...STRUCTURE_IDS, ...PRESET_IDS].find(k => k.replace(/-/g, '') === w);
      if (w && !id) bad.push(`no structure "${w}"; the catalogue has ${STRUCTURE_IDS.join(', ')}; presets: type preset for the list`);
      out.act = 'structure'; out.arg = { id: id || null };
      break;
    }
    case 'posts': {
      if (has('max')) { const i = rest.findIndex(isNum); if (i >= 0) num(i, 'postMax', ['m']); else bad.push('posts max needs metres, such as posts max 3'); }
      else if (has('single') || rest.some(x => isNum(x) && x.n === 1)) put('posts', 1);
      else if (has('twin') || rest.some(x => isNum(x) && x.n === 2)) put('posts', 2);
      else bad.push('posts takes single, twin (or 1, 2) or max N');
      break;
    }
    case 'tracker': {
      put('layout', 'tracker');
      const F = parseFormat(rest.find(w => typeof w === 'string' && /^\d[pl]\d*$/.test(w)));
      if (F) { const no = formatRefusal('tracker', F.tiers, F.orient); if (no) bad.push(no); else { put('tiers', F.tiers); put('orient', 'portrait'); } }
      const n = rest.find(isNum);
      if (n) put('trackerStrings', n.n);
      if (!F && !n) bad.push('tracker takes strings per row (tracker 3 strings) or a format (tracker 2p)');
      break;
    }
    case 'inverter': case 'packing': case 'preset': parsePlant(v, rest, out, { put, bad, isNum }); break;
    case 'rowgap': if (has('slope')) put('rowGap', 'slope'); else if (has('flat')) put('rowGap', 'flat'); else bad.push('rowgap is slope or flat'); break;
    case 'mppt': {
      const ns = rest.filter(isNum);
      if (!ns.length) { bad.push('mppt needs the MPPT inputs and strings per input, such as mppt 12 inputs 2'); break; }
      put('mppts', ns[0].n);
      if (ns[1]) put('stringsPerMppt', ns[1].n);
      break;
    }
    case 'module': {
      const w = rest.find(x => isNum(x) && x.unit === 'w');
      if (w) put('wp', w.n);
      if (after('voc') > 0) num(after('voc'), 'voc', ['v']);
      if (after('size') > 0) { num(after('size'), 'moduleLong', ['m']); num(after('size') + 1, 'moduleShort', ['m']); } // module 260w size 1.65 0.99
      if (!w && after('voc') < 0 && after('size') < 0) bad.push('module needs a power, a Voc or a size, such as module 600w voc 50');
      break;
    }
    case 'string': { const n = rest.find(isNum); if (n) put('mps', n.n); else bad.push('string needs a number of modules in series, such as string 28'); break; }
    case 'temp': { const n = rest.find(isNum); if (!n) bad.push('temp needs the coldest cell temperature in °C, such as temp min -10');
      else if (n.unit && !['c', '°c', '°', 'deg'].includes(n.unit)) bad.push(`the coldest cell is in °C; you typed ${n.n}${n.unit}`); else put('tempMin', n.n); break; }
    case 'tilt': num(0, 'tilt', ['°', 'deg']); out.arg.maybeEw = true; break;
    case 'pitch': num(0, 'pitch', ['m']); break;
    case 'gcr': num(0, 'gcr'); break;
    case 'edge': num(0, 'edge', ['m']); break;
    case 'trench': case 'cable': case 'load': case 'xray': parseTrench(v, rest, out, { has, after, num, put, bad, guard }); break;
    case 'bend': out.act = 'explain'; out.arg = { what: 'bend' }; break;
    case 'loop': out.act = 'explain'; out.arg = { what: 'loop' }; break;
    case 'wiring': {
      const w = rest.find(x => x === 'leapfrog' || x === 'standard');
      if (w) put('wiring', w); else bad.push('wiring is leapfrog or standard');
      break;
    }
    case 'piles': if (!has('auto')) bad.push('piles are placed from the tables: type piles auto'); out.act = 'piles'; break;
    case 'block': {
      const n = rest.find(isNum);
      const mva = n ? n.n : 10;
      if (n && n.unit && n.unit !== 'mva') bad.push(`block size is in MVA; you typed ${n.n}${n.unit}`);
      else if (mva % 10) bad.push(`the block is built of 10 MVA stations: type 10 to 100 MVA in steps of 10; you typed ${mva}`);
      else put('stations', mva);
      if (after('poc') > 0 && isNum(rest[after('poc')])) put('pocKv', rest[after('poc')].n);
      const ia = after('at');
      if (ia > 0) { if (isNum(rest[ia]) && isNum(rest[ia + 1])) out.arg.at = { e: rest[ia].n, n: rest[ia + 1].n }; else bad.push('block at takes an easting and a northing'); }
      out.act = 'block';
      break;
    }
    case 'follow': out.act = 'follow'; out.arg = { step: ['next', 'back', 'play', 'pause', 'close'].find(has) || null }; break;
    case 'sld': out.act = 'sld'; out.arg = { on: !has('hide') }; break;
    case 'hud': out.act = 'hud'; out.arg = { rules: has('rules'), on: !has('off') }; break;
    case 'go': {
      const ib = after('block'), it = after('table');
      if (has('compound')) out.arg = { compound: true };
      else if (ib > 0 && isNum(rest[ib])) out.arg = { block: rest[ib].n, table: it > 0 && isNum(rest[it]) ? rest[it].n : null };
      else if (has('block') && it < 0) out.arg = { block: null, table: null };           // go block: the placed solar block
      else if (isNum(rest[0]) && isNum(rest[1])) out.arg = { e: rest[0].n, n: rest[1].n };
      else bad.push('go takes block N [table M], compound, or an easting and northing');
      out.act = 'go';
      break;
    }
    case 'earthing': case 'earth': case 'soil': case 'bonding': {
      if (v === 'soil' && isThermalSoil(rest)) { num(0, 'soil'); break; }     // soil N: thermal resistivity (cable rating)
      const e = parseEarth(v, rest, bad, w => example(COMMANDS.find(c => c.verb === v), w));
      if (e) { out.act = e.act; out.arg = e.arg; }
      break;
    }
    case 'show': case 'hide': {
      if (has('earthing')) { out.act = 'earthing'; out.arg = { what: v }; break; }
      const what = rest.find(x => ['pylons', 'water', 'slope', 'soil'].includes(x));
      if (!what) { bad.push(`${v} takes pylons, water, slope, soil or earthing`); break; }
      const pct = rest.find(isNum);
      if (pct && what === 'slope') { const g = guard('slope', pct.n); if (g) bad.push(g.replace('slope limit', 'slope shown from')); else out.arg.limit = pct.n; }
      out.act = 'show'; Object.assign(out.arg, { layer: what, on: v === 'show' });
      break;
    }
    case 'avoid': {
      if (has('slope')) { const n = rest.find(isNum); if (n) put('slope', n.n); else bad.push('avoid slope needs a percentage, such as avoid slope 15%'); }
      else if (has('pylons')) put('avoidOhl', !has('off'));
      else if (has('water')) { const n = rest.find(isNum); if (n) put('water', n.n); else bad.push('avoid water needs a setback in metres'); }
      else bad.push('avoid takes slope N%, pylons on|off or water N');
      break;
    }
    case 'setback': {
      const n = rest.find(isNum);
      if (!n) bad.push('setback needs metres, such as setback water 10');
      else if (has('water')) put('water', n.n);
      else if (has('fence')) put('fence', n.n);
      else if (has('hedge')) put('hedge', n.n);
      else bad.push('setback takes water or fence');
      break;
    }
    case 'binoculars': case 'zoom': case 'range': { const s = parseSenses(v, rest, bad); if (s) { out.act = s.act; out.arg = s.arg; } break; }
    case 'undo': out.act = 'undo'; break;
    case 'script': out.act = 'script'; break;
    case 'help': out.act = 'help'; out.arg = { topic: rest.filter(x => typeof x === 'string').join(' ') }; break;
  }
  if (bad.length) return refuse(bad.slice(0, 3).join('; ') + '. Nothing was changed.', line);
  return out;
}

/** Help text: every usage, or the commands matching a topic. */
export function help(topic = '') {
  const list = topic ? search(topic, 24) : COMMANDS;
  if (!list.length) return `No command matches "${topic}". Type help for all.`;
  return list.map(c => c.usage).join('\n');
}
