// COPIED UNCHANGED from world/v12 repd-grammar.mjs at v12 commit 3adcee9 (file last changed 954e27a). Modular star family: not known to star-find.
// Do not edit here: change the source and re-copy. Everything below this header is byte-identical to the source.
// repd-grammar.mjs: the typed words for flying between solar and battery projects on the public register (REPD).
// Pure: no imports, no DOM. cmd-grammar.mjs asks parseRepd(line) first; null means "not a REPD line" and the usual
// grammar carries on (so "go block 3" and "go Canterbury" are untouched).
//   go solar                 the nearest ground-mounted solar project, any status
//   go solar operational     ... operational  (also: construction, consented, planning, planned, current, other, all)
//   go solar planned         in planning or consented
//   go solar farm            the nearest operational solar farm (owner direction section 10)
//   go bess · go bess 50     the nearest battery project, of at least 50 MW
//   go roof                  rooftop solar on the register
//   next solar · previous solar · next bess      the next or previous one by distance, same filter as last typed
//   go repd 1234             a project by its REPD reference

// A second 'go' entry (help and search list both; parse takes the REPD words first) and the new verb 'next'.
export const REPD_COMMANDS = Object.freeze([
  { verb: 'go', usage: 'go solar  ·  go solar operational  ·  go solar planned  ·  go bess  ·  go bess 50  ·  go repd 1234',
    words: 'fly repd register solar farm battery bess storage operational planned consented planning nearest survey' },
  { verb: 'next', usage: 'next solar  ·  next bess  ·  previous solar', words: 'fly repd register next previous nearest solar battery bess' }
]);

const TECH = { solar: 'solar', pv: 'solar', bess: 'bess', battery: 'bess', batteries: 'bess', storage: 'bess', roof: 'roof', rooftop: 'roof' };
const CLS = { operational: 'operational', existing: 'operational', built: 'operational', live: 'operational',
  construction: 'construction', building: 'construction', consented: 'consented', approved: 'consented',
  planning: 'planning', submitted: 'planning', planned: 'planned', pipeline: 'planned', proposed: 'planned',
  current: 'current', other: 'other', refused: 'other', withdrawn: 'other', abandoned: 'other', all: 'all', any: 'all' };
const NOISE = new Set(['farm', 'farms', 'park', 'parks', 'site', 'sites', 'project', 'projects', 'the', 'nearest', 'a', 'mw', 'at', 'least', 'over', 'min']);
const LEAD = /^\s*(go\s+to|goto|fly\s+to|fly|go|next|previous|prev|back)\s+/i;

const refuse = (why, line) => ({ ok: false, why, line: String(line).trim() });

/** parseRepd(line) -> null | { ok: true, verb, act: 'repd', set: {}, arg: { op, tech, cls, minMw, ref }, line } | { ok: false, why, line } */
export function parseRepd(line) {
  const text = String(line || '').toLowerCase().replace(/#.*$/, '').trim();
  const m = text.match(LEAD);
  if (!m) return null;
  const lead = m[1].replace(/\s+/g, ' ');
  const op = lead === 'next' ? 'next' : ['previous', 'prev', 'back'].includes(lead) ? 'previous' : 'go';
  const ws = text.slice(m[0].length).replace(/(\d)\s*mw\b/g, '$1').replace(/>=?/g, ' ').split(/\s+/).filter(Boolean);
  if (!ws.length) return null;
  const out = { ok: true, verb: op === 'go' ? 'go' : 'next', act: 'repd', set: {}, line: String(line).trim(), arg: { op, tech: null, cls: null, minMw: 0, ref: null } };
  if (ws[0] === 'repd') {
    if (op !== 'go') return refuse(`${op} takes solar or bess, such as ${op} solar`, line);
    if (ws.length !== 2 || !/^\d{1,6}$/.test(ws[1])) return refuse('go repd takes one REPD reference number, such as go repd 1234', line);
    out.arg.op = 'ref'; out.arg.ref = ws[1];
    return out;
  }
  if (!TECH[ws[0]]) return op === 'go' ? null : refuse(`${op} takes solar, bess or roof, such as ${op} solar`, line);
  out.arg.tech = TECH[ws[0]];
  const nums = [];
  for (const w of ws.slice(1)) {
    if (/^\d+(\.\d+)?$/.test(w)) { nums.push(Number(w)); continue; }
    if (CLS[w]) { if (out.arg.cls && out.arg.cls !== CLS[w]) return refuse(`one status at a time: you typed ${out.arg.cls} and ${CLS[w]}`, line); out.arg.cls = CLS[w]; continue; }
    if (NOISE.has(w)) { if ((w === 'farm' || w === 'farms') && !out.arg.cls && out.arg.tech === 'solar') out.arg.cls = 'operational'; continue; }
    return refuse(`${op === 'go' ? 'go' : op} ${ws[0]} does not read "${w}"; it takes a status (operational, construction, consented, planning, planned, `
      + `current, other, all) and a smallest size in MW, such as go ${ws[0]} planned 50`, line);
  }
  if (nums.length > 1) return refuse(`one size at a time (the smallest MW); you typed ${nums.join(' and ')}`, line);
  if (nums.length) {
    if (!(nums[0] >= 0 && nums[0] <= 5000)) return refuse(`the smallest size is in MW, from 0 to 5000; you typed ${nums[0]}`, line);
    out.arg.minMw = nums[0];
  }
  if (out.arg.cls === 'all') out.arg.cls = null;
  return out;
}

/** The filter a line names, as words for the echo: "solar, operational, at least 50 MW". */
export function filterText({ tech, cls, minMw }) {
  const t = tech === 'bess' ? 'battery (BESS)' : tech === 'roof' ? 'rooftop solar' : 'solar';
  return [t, cls ? (cls === 'planned' ? 'planned (in planning or consented)' : cls === 'current' ? 'current (operational or being built)' : cls) : 'any status',
    minMw ? `at least ${minMw} MW` : ''].filter(Boolean).join(', ');
}
